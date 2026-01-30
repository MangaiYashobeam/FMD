"""
Posting Worker - Main worker loop for processing posting tasks
Continuously polls Redis queue and processes tasks

Security Features:
- HMAC signature verification for all tasks
- Encrypted payload decryption
- Replay attack prevention
- Input validation
"""
import asyncio
import signal
import uuid
from datetime import datetime
from typing import Optional
import structlog
import httpx

from core.config import get_settings
from core.redis_client import get_redis_queue
from core.unified_security import get_unified_security, start_nonce_cleanup_task
from browser.manager import BrowserPoolManager
from workers.task_processor import TaskProcessor, TaskStatus

logger = structlog.get_logger()


class PostingWorker:
    """
    Main worker that processes Marketplace posting tasks
    
    Features:
    - Continuous queue polling
    - Graceful shutdown
    - Health reporting
    - Task retry handling
    - Cryptographic task verification
    """
    
    def __init__(self, worker_id: Optional[str] = None):
        self.worker_id = worker_id or f"worker_{uuid.uuid4().hex[:8]}"
        self.settings = get_settings()
        self._browser_pool: Optional[BrowserPoolManager] = None
        self._task_processor: Optional[TaskProcessor] = None
        self._redis: Optional[any] = None
        self._security = get_unified_security()
        self._running = False
        self._shutdown_event = asyncio.Event()
        self._tasks_processed = 0
        self._tasks_failed = 0
        self._tasks_rejected = 0  # Security rejections
        self._started_at: Optional[datetime] = None
        self._current_soldier_id: Optional[str] = None  # Track assigned soldier ID
        self._heartbeat_task: Optional[asyncio.Task] = None  # 💓 Periodic heartbeat
    
    async def start(self):
        """Start the worker"""
        logger.info("Starting posting worker", worker_id=self.worker_id)
        
        self._running = True
        self._started_at = datetime.utcnow()
        
        # Initialize security
        security_enabled = self._security.is_available()
        if not security_enabled:
            logger.warning("Security NOT available - tasks will be processed without verification!")
        
        # Initialize Redis connection
        self._redis = await get_redis_queue()
        
        # Initialize browser pool
        self._browser_pool = BrowserPoolManager(self.worker_id)
        await self._browser_pool.start()
        
        # Initialize task processor
        self._task_processor = TaskProcessor(
            self._browser_pool,
            self.worker_id
        )
        await self._task_processor.start()
        
        # Register worker in Redis
        await self._redis.register_worker(
            self.worker_id,
            {
                'started_at': self._started_at.isoformat(),
                'max_browsers': self.settings.max_concurrent_browsers,
                'security_enabled': security_enabled
            }
        )
        
        # Set up signal handlers for graceful shutdown
        self._setup_signal_handlers()
        
        # Start nonce cleanup background task
        asyncio.create_task(start_nonce_cleanup_task())
        
        # 💓 Start periodic heartbeat task for STEALTH soldiers
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        
        logger.info("Posting worker started",
                   worker_id=self.worker_id,
                   max_browsers=self.settings.max_concurrent_browsers,
                   security_enabled=security_enabled)
        
        # Start main loop
        await self._main_loop()
    
    async def stop(self):
        """Stop the worker gracefully"""
        logger.info("Stopping posting worker", worker_id=self.worker_id)
        
        self._running = False
        self._shutdown_event.set()
        
        # Cancel heartbeat task
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass
        
        # Stop task processor
        if self._task_processor:
            await self._task_processor.stop()
        
        # Stop browser pool (saves sessions)
        if self._browser_pool:
            await self._browser_pool.stop()
        
        # Unregister from Redis
        if self._redis:
            await self._redis.unregister_worker(self.worker_id)
        
        logger.info("Posting worker stopped",
                   worker_id=self.worker_id,
                   tasks_processed=self._tasks_processed,
                   tasks_failed=self._tasks_failed)
    
    def _setup_signal_handlers(self):
        """Set up handlers for graceful shutdown"""
        loop = asyncio.get_event_loop()
        
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(
                    sig,
                    lambda: asyncio.create_task(self._signal_handler(sig))
                )
            except NotImplementedError:
                # Windows doesn't support add_signal_handler
                pass
    
    async def _signal_handler(self, sig):
        """Handle shutdown signal"""
        logger.info("Received shutdown signal", signal=sig)
        await self.stop()
    
    async def _main_loop(self):
        """Main task processing loop"""
        queue_name = self.settings.task_queue_name
        poll_interval = 1.0  # seconds
        
        logger.info("Starting main loop", queue=queue_name)
        
        while self._running:
            try:
                # Check if we can take more tasks
                pool_stats = self._browser_pool.get_stats()
                busy_browsers = sum(
                    1 for b in pool_stats['browsers'] if b['is_busy']
                )
                
                if busy_browsers >= self.settings.max_concurrent_browsers:
                    # At capacity, wait before polling
                    await asyncio.sleep(poll_interval)
                    continue
                
                # Poll for task with blocking timeout
                task = await self._redis.dequeue_task(
                    queue_name,
                    timeout=5  # Block for 5 seconds waiting for task
                )
                
                if task:
                    # Verify task signature before processing
                    verified_task = await self._verify_task(task)
                    if verified_task:
                        # Process verified task in background
                        asyncio.create_task(self._process_task(verified_task))
                    # If verification failed, task is rejected (logged in _verify_task)
                else:
                    # No task, brief sleep
                    await asyncio.sleep(poll_interval)
                
                # Update health in Redis
                await self._update_health()
                
            except asyncio.CancelledError:
                logger.info("Main loop cancelled")
                break
                
            except Exception as e:
                logger.error("Error in main loop", error=str(e))
                await asyncio.sleep(5)  # Back off on errors
    
    async def _verify_task(self, task: dict) -> Optional[dict]:
        """
        Verify task signature and decrypt payload.
        
        Returns verified task dict or None if verification fails.
        """
        # Check if task has security fields
        has_signature = 'signature' in task
        
        if has_signature and self._security.is_available():
            # Verify signed task
            result = self._security.verify_task(task)
            
            if not result.valid:
                self._tasks_rejected += 1
                self._security.log_security_event(
                    'task_verification_failed',
                    'high',
                    {
                        'task_id': task.get('task_id', task.get('id', 'unknown')),
                        'error': result.error,
                        'worker_id': self.worker_id
                    }
                )
                logger.error("Task verification FAILED - rejecting task",
                           task_id=task.get('task_id', task.get('id')),
                           error=result.error)
                return None
            
            logger.debug("Task signature verified",
                        task_id=result.task.get('id'))
            return result.task
        
        elif has_signature and not self._security.is_available():
            # Task is signed but we can't verify - REJECT in production
            logger.warning("Received signed task but security not initialized")
            self._tasks_rejected += 1
            return None
        
        else:
            # Unsigned task - validate input at least
            task_id = task.get('id', task.get('taskId', task.get('task_id', 'unknown')))
            
            # Validate account ID - handle both camelCase (Node.js) and snake_case
            account_id = task.get('accountId', task.get('account_id', ''))
            if not account_id:
                logger.warning("No account_id or accountId in task", task_id=task_id, task_keys=list(task.keys()))
            
            if not self._security.validate_account_id(account_id):
                self._tasks_rejected += 1
                logger.error("Invalid account_id in task", task_id=task_id, account_id=account_id)
                return None
            
            # Normalize to snake_case for consistency in processing
            task['account_id'] = account_id
            if 'id' not in task and 'taskId' in task:
                task['id'] = task['taskId']
            
            # Validate task data
            data = task.get('data', {})
            is_valid, error = self._security.validate_task_data(data)
            if not is_valid:
                self._tasks_rejected += 1
                logger.error("Invalid task data", task_id=task_id, error=error)
                return None
            
            logger.debug("Unsigned task validated", task_id=task_id)
            return task
    
    async def _process_task(self, task: dict):
        """Process a single task"""
        task_id = task.get('id', 'unknown')
        
        # Extract soldier ID from task for heartbeats
        soldier_id = task.get('soldier_id', task.get('soldierId'))
        if soldier_id and soldier_id != self._current_soldier_id:
            self.set_soldier_id(soldier_id)
        
        try:
            logger.info("Processing task", task_id=task_id)
            
            result = await self._task_processor.process_task(task)
            
            if result['status'] == TaskStatus.COMPLETED:
                self._tasks_processed += 1
                logger.info("Task completed", task_id=task_id)
                
            elif result['status'] == TaskStatus.RETRY:
                # Re-queue for retry
                retry_count = task.get('retry_count', 0) + 1
                max_retries = self.settings.max_task_retries
                
                if retry_count < max_retries:
                    task['retry_count'] = retry_count
                    await self._redis.requeue_task(
                        self.settings.task_queue_name,
                        task,
                        delay_seconds=30 * retry_count  # Exponential backoff
                    )
                    logger.info("Task requeued for retry",
                              task_id=task_id,
                              retry_count=retry_count)
                else:
                    self._tasks_failed += 1
                    logger.error("Task max retries exceeded",
                                task_id=task_id,
                                retries=retry_count)
                                
            else:
                self._tasks_failed += 1
                logger.error("Task failed",
                            task_id=task_id,
                            error=result.get('error'))
                            
        except Exception as e:
            self._tasks_failed += 1
            logger.error("Task processing error",
                        task_id=task_id,
                        error=str(e))
    
    async def _update_health(self):
        """Update worker health status in Redis"""
        stats = self._browser_pool.get_stats()
        
        health_data = {
            'worker_id': self.worker_id,
            'last_heartbeat': datetime.utcnow().isoformat(),
            'uptime_seconds': (datetime.utcnow() - self._started_at).total_seconds(),
            'tasks_processed': self._tasks_processed,
            'tasks_failed': self._tasks_failed,
            'tasks_rejected': self._tasks_rejected,
            'security_enabled': self._security.is_available(),
            'browsers_active': stats['total_browsers'],
            'browsers_busy': sum(1 for b in stats['browsers'] if b['is_busy']),
            'browsers_max': stats['max_browsers']
        }
        
        await self._redis.update_worker_health(self.worker_id, health_data)
    
    async def _heartbeat_loop(self):
        """
        💓 STEALTH SOLDIER HEARTBEAT LOOP
        Fetches ALL STEALTH soldiers from API and sends heartbeats for them every 30 seconds
        This keeps ALL STEALTH soldiers visible in the IAI Command Center
        """
        logger.info("💓 Starting heartbeat loop", worker_id=self.worker_id)
        
        # HTTP client for API calls
        async with httpx.AsyncClient(
            base_url=self.settings.api_base_url,
            timeout=15.0
        ) as client:
            while self._running:
                try:
                    # First, fetch all STEALTH soldiers from the API
                    stealth_soldiers = await self._fetch_stealth_soldiers(client)
                    
                    if stealth_soldiers:
                        stats = self._browser_pool.get_stats() if self._browser_pool else {}
                        busy_browsers = sum(1 for b in stats.get('browsers', []) if b.get('is_busy', False))
                        
                        # Send heartbeat for EACH stealth soldier
                        for soldier in stealth_soldiers:
                            soldier_id = soldier.get('soldierId') or soldier.get('soldier_id')
                            if not soldier_id:
                                continue
                            
                            # Determine status - WORKING if this is the active soldier, else ONLINE
                            is_active = soldier_id == self._current_soldier_id and busy_browsers > 0
                            status = 'WORKING' if is_active else 'ONLINE'
                            
                            payload = {
                                'soldierId': soldier_id,
                                'status': status,
                                'workerId': self.worker_id,
                                'browserCount': stats.get('total_browsers', 0),
                                'cpuUsage': None,
                                'memoryUsageMb': None,
                            }
                            
                            try:
                                response = await client.post(
                                    '/api/worker/iai/worker/heartbeat',
                                    json=payload,
                                    headers={
                                        'X-Worker-Secret': self.settings.worker_secret,
                                        'Content-Type': 'application/json'
                                    }
                                )
                                
                                if response.status_code == 200:
                                    logger.debug("💚 Heartbeat sent", 
                                               soldier_id=soldier_id,
                                               status=status)
                                else:
                                    logger.warning("⚠️ Heartbeat failed", 
                                                 soldier_id=soldier_id,
                                                 status_code=response.status_code)
                            except Exception as e:
                                logger.error("❌ Heartbeat error for soldier", 
                                           soldier_id=soldier_id, error=str(e))
                            
                            # Small delay between heartbeats to avoid overwhelming API
                            await asyncio.sleep(0.5)
                        
                        logger.info("💚 Batch heartbeat complete", 
                                  soldier_count=len(stealth_soldiers))
                    else:
                        logger.debug("💤 No STEALTH soldiers found")
                    
                    # Wait 30 seconds before next heartbeat cycle
                    await asyncio.sleep(30)
                    
                except asyncio.CancelledError:
                    logger.info("💓 Heartbeat loop cancelled")
                    break
                except Exception as e:
                    logger.error("❌ Heartbeat loop error", error=str(e))
                    await asyncio.sleep(30)  # Still wait on error
        
        logger.info("💓 Heartbeat loop stopped")
    
    async def _fetch_stealth_soldiers(self, client: httpx.AsyncClient) -> list:
        """
        Fetch all STEALTH soldiers from the API
        Returns list of soldier objects with soldierId
        """
        try:
            response = await client.get(
                '/api/worker/iai/worker/soldiers',
                headers={
                    'X-Worker-Secret': self.settings.worker_secret,
                    'Content-Type': 'application/json'
                },
                params={'genre': 'STEALTH'}
            )
            
            if response.status_code == 200:
                data = response.json()
                soldiers = data.get('soldiers', []) if isinstance(data, dict) else data
                logger.debug("🔍 Fetched STEALTH soldiers", count=len(soldiers))
                return soldiers
            else:
                logger.warning("⚠️ Failed to fetch soldiers", 
                             status_code=response.status_code)
                return []
        except Exception as e:
            logger.error("❌ Error fetching soldiers", error=str(e))
            return []
    
    def set_soldier_id(self, soldier_id: str):
        """Set the current soldier ID for heartbeats"""
        self._current_soldier_id = soldier_id
        logger.info("🎖️ Soldier ID assigned", soldier_id=soldier_id)
    
    def get_stats(self) -> dict:
        """Get worker statistics"""
        uptime = None
        if self._started_at:
            uptime = (datetime.utcnow() - self._started_at).total_seconds()
        
        browser_stats = {}
        if self._browser_pool:
            browser_stats = self._browser_pool.get_stats()
        
        return {
            'worker_id': self.worker_id,
            'running': self._running,
            'started_at': self._started_at.isoformat() if self._started_at else None,
            'uptime_seconds': uptime,
            'tasks_processed': self._tasks_processed,
            'tasks_failed': self._tasks_failed,
            'tasks_rejected': self._tasks_rejected,
            'security_enabled': self._security.is_available(),
            'browser_pool': browser_stats
        }


async def main():
    """Entry point for running worker standalone"""
    import sys
    import logging
    
    # Force stdout to be unbuffered
    sys.stdout.reconfigure(line_buffering=True)
    
    print("=" * 50, flush=True)
    print("POSTING WORKER STARTING", flush=True)
    print("=" * 50, flush=True)
    
    # Configure standard logging first
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        handlers=[logging.StreamHandler(sys.stdout)]
    )
    
    # Configure structured logging
    structlog.configure(
        processors=[
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.dev.ConsoleRenderer()  # Human-readable output
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    
    print("Logger configured, creating worker...", flush=True)
    worker = PostingWorker()
    print(f"Worker created: {worker.worker_id}", flush=True)
    
    try:
        print("Starting worker.start()...", flush=True)
        await worker.start()
    except KeyboardInterrupt:
        print("Keyboard interrupt received", flush=True)
    except Exception as e:
        print(f"ERROR in worker: {type(e).__name__}: {e}", flush=True)
        import traceback
        traceback.print_exc()
    finally:
        print("Stopping worker...", flush=True)
        await worker.stop()


if __name__ == '__main__':
    asyncio.run(main())
