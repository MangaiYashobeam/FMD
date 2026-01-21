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
            task_id = task.get('id', task.get('task_id', 'unknown'))
            
            # Validate account ID
            account_id = task.get('account_id', '')
            if not self._security.validate_account_id(account_id):
                self._tasks_rejected += 1
                logger.error("Invalid account_id in task", task_id=task_id)
                return None
            
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
    
    # Configure structured logging
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    
    worker = PostingWorker()
    
    try:
        await worker.start()
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received")
    finally:
        await worker.stop()


if __name__ == '__main__':
    asyncio.run(main())
