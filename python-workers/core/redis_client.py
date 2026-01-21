"""
Redis client for task queue management
"""
import json
import asyncio
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import redis.asyncio as redis
import structlog

from core.config import get_settings

logger = structlog.get_logger()


class RedisQueue:
    """
    Redis-based task queue for distributing posting jobs across workers
    """
    
    # Queue names
    TASK_QUEUE = "fmd:tasks:pending"
    PROCESSING_QUEUE = "fmd:tasks:processing"
    COMPLETED_QUEUE = "fmd:tasks:completed"
    FAILED_QUEUE = "fmd:tasks:failed"
    
    # Session management
    SESSION_PREFIX = "fmd:session:"
    BROWSER_PREFIX = "fmd:browser:"
    LOCK_PREFIX = "fmd:lock:"
    
    def __init__(self):
        self.settings = get_settings()
        self._client: Optional[redis.Redis] = None
        self._pubsub: Optional[redis.client.PubSub] = None
    
    async def connect(self):
        """Establish Redis connection"""
        if self._client is None:
            self._client = redis.from_url(
                self.settings.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            logger.info("Connected to Redis", url=self.settings.redis_url)
    
    async def disconnect(self):
        """Close Redis connection"""
        if self._client:
            await self._client.close()
            self._client = None
            logger.info("Disconnected from Redis")
    
    @property
    def client(self) -> redis.Redis:
        if self._client is None:
            raise RuntimeError("Redis not connected. Call connect() first.")
        return self._client
    
    # ==========================================
    # Task Queue Operations
    # ==========================================
    
    async def enqueue_task(self, task: Dict[str, Any], priority: int = 5) -> str:
        """
        Add a task to the queue with priority (1-10, higher = more urgent)
        """
        task_id = task.get('id', f"task_{datetime.utcnow().timestamp()}")
        task['queued_at'] = datetime.utcnow().isoformat()
        task['priority'] = priority
        
        # Use sorted set for priority queue
        score = (10 - priority) * 1000000000 + datetime.utcnow().timestamp()
        await self.client.zadd(self.TASK_QUEUE, {json.dumps(task): score})
        
        logger.info("Task enqueued", task_id=task_id, priority=priority)
        return task_id
    
    async def dequeue_task(self, queue_name: str = None, timeout: int = 0, worker_id: str = None) -> Optional[Dict[str, Any]]:
        """
        Get the next task from the queue (highest priority first)
        Atomically moves task to processing queue
        
        Args:
            queue_name: Queue name (optional, defaults to TASK_QUEUE)
            timeout: Blocking timeout in seconds (optional, not used with sorted sets)
            worker_id: Worker ID to assign to task (optional)
        """
        # Use specified queue or default
        task_queue = f"fmd:tasks:{queue_name}:pending" if queue_name else self.TASK_QUEUE
        
        # Get highest priority task (lowest score)
        result = await self.client.zpopmin(task_queue, count=1)
        
        if not result:
            return None
        
        task_json, score = result[0]
        task = json.loads(task_json)
        
        # Add to processing queue with worker info (if worker_id provided)
        if worker_id:
            task['worker_id'] = worker_id
        task['started_at'] = datetime.utcnow().isoformat()
        
        await self.client.hset(
            self.PROCESSING_QUEUE,
            task.get('id', f"task_{datetime.utcnow().timestamp()}"),
            json.dumps(task)
        )
        
        logger.info("Task dequeued", task_id=task.get('id'), worker_id=worker_id)
        return task
    
    async def complete_task(self, task_id: str, result: Dict[str, Any]):
        """Mark a task as completed"""
        # Get from processing queue
        task_json = await self.client.hget(self.PROCESSING_QUEUE, task_id)
        if task_json:
            task = json.loads(task_json)
            task['completed_at'] = datetime.utcnow().isoformat()
            task['result'] = result
            
            # Move to completed queue (with TTL for cleanup)
            await self.client.hset(self.COMPLETED_QUEUE, task_id, json.dumps(task))
            await self.client.hdel(self.PROCESSING_QUEUE, task_id)
            
            # Set expiry on completed tasks (7 days)
            await self.client.expire(self.COMPLETED_QUEUE, 7 * 24 * 60 * 60)
            
            logger.info("Task completed", task_id=task_id)
    
    async def fail_task(self, task_id: str, error: str, retry: bool = True):
        """Mark a task as failed, optionally requeue for retry"""
        task_json = await self.client.hget(self.PROCESSING_QUEUE, task_id)
        if task_json:
            task = json.loads(task_json)
            task['failed_at'] = datetime.utcnow().isoformat()
            task['error'] = error
            task['retry_count'] = task.get('retry_count', 0) + 1
            
            await self.client.hdel(self.PROCESSING_QUEUE, task_id)
            
            if retry and task['retry_count'] < 3:
                # Requeue with lower priority
                task['priority'] = max(1, task.get('priority', 5) - 1)
                await self.enqueue_task(task, task['priority'])
                logger.info("Task requeued for retry", task_id=task_id, retry_count=task['retry_count'])
            else:
                await self.client.hset(self.FAILED_QUEUE, task_id, json.dumps(task))
                logger.error("Task failed permanently", task_id=task_id, error=error)
    
    async def get_queue_stats(self) -> Dict[str, int]:
        """Get queue statistics"""
        return {
            'pending': await self.client.zcard(self.TASK_QUEUE),
            'processing': await self.client.hlen(self.PROCESSING_QUEUE),
            'completed': await self.client.hlen(self.COMPLETED_QUEUE),
            'failed': await self.client.hlen(self.FAILED_QUEUE),
        }
    
    # ==========================================
    # Session Management
    # ==========================================
    
    async def store_session(self, account_id: str, session_data: Dict[str, Any], ttl: int = 86400):
        """Store encrypted session data"""
        key = f"{self.SESSION_PREFIX}{account_id}"
        await self.client.setex(key, ttl, json.dumps(session_data))
        logger.info("Session stored", account_id=account_id)
    
    async def get_session(self, account_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve session data"""
        key = f"{self.SESSION_PREFIX}{account_id}"
        data = await self.client.get(key)
        return json.loads(data) if data else None
    
    async def delete_session(self, account_id: str):
        """Delete session data"""
        key = f"{self.SESSION_PREFIX}{account_id}"
        await self.client.delete(key)
        logger.info("Session deleted", account_id=account_id)
    
    async def extend_session_ttl(self, account_id: str, ttl: int = 86400):
        """Extend session TTL"""
        key = f"{self.SESSION_PREFIX}{account_id}"
        await self.client.expire(key, ttl)
    
    # ==========================================
    # Worker Management
    # ==========================================
    
    async def register_worker(self, worker_id: str, metadata: Dict[str, Any]):
        """Register a worker instance"""
        key = f"fmd:worker:{worker_id}"
        data = {
            **metadata,
            'worker_id': worker_id,
            'registered_at': datetime.utcnow().isoformat(),
            'last_heartbeat': datetime.utcnow().isoformat(),
            'status': 'active'
        }
        await self.client.hset(key, mapping={k: json.dumps(v) if isinstance(v, (dict, list)) else str(v) for k, v in data.items()})
        await self.client.expire(key, 3600)  # 1 hour TTL
        await self.client.sadd("fmd:workers:active", worker_id)
        logger.info("Worker registered", worker_id=worker_id)
    
    async def unregister_worker(self, worker_id: str):
        """Unregister a worker instance"""
        key = f"fmd:worker:{worker_id}"
        await self.client.delete(key)
        await self.client.srem("fmd:workers:active", worker_id)
        # Clean up worker's browsers
        browser_ids = await self.client.smembers(f"fmd:worker:{worker_id}:browsers")
        for browser_id in browser_ids:
            await self.client.delete(f"{self.BROWSER_PREFIX}{browser_id}")
        await self.client.delete(f"fmd:worker:{worker_id}:browsers")
        logger.info("Worker unregistered", worker_id=worker_id)
    
    async def worker_heartbeat(self, worker_id: str):
        """Update worker heartbeat"""
        key = f"fmd:worker:{worker_id}"
        await self.client.hset(key, 'last_heartbeat', datetime.utcnow().isoformat())
        await self.client.expire(key, 3600)
    
    async def get_active_workers(self) -> List[Dict[str, Any]]:
        """Get all active workers"""
        worker_ids = await self.client.smembers("fmd:workers:active")
        workers = []
        for worker_id in worker_ids:
            data = await self.client.hgetall(f"fmd:worker:{worker_id}")
            if data:
                data['worker_id'] = worker_id
                workers.append(data)
        return workers
    
    # ==========================================
    # Browser Pool Management
    # ==========================================
    
    async def register_browser(self, browser_id: str, account_id: str, worker_id: str):
        """Register an active browser instance"""
        key = f"{self.BROWSER_PREFIX}{browser_id}"
        data = {
            'account_id': account_id,
            'worker_id': worker_id,
            'started_at': datetime.utcnow().isoformat(),
            'last_activity': datetime.utcnow().isoformat(),
        }
        await self.client.hset(key, mapping=data)
        await self.client.expire(key, 3600)  # 1 hour TTL
        
        # Add to worker's browser list
        await self.client.sadd(f"fmd:worker:{worker_id}:browsers", browser_id)
    
    async def update_browser_activity(self, browser_id: str):
        """Update browser's last activity timestamp"""
        key = f"{self.BROWSER_PREFIX}{browser_id}"
        await self.client.hset(key, 'last_activity', datetime.utcnow().isoformat())
        await self.client.expire(key, 3600)
    
    async def unregister_browser(self, browser_id: str, worker_id: str):
        """Remove browser from registry"""
        key = f"{self.BROWSER_PREFIX}{browser_id}"
        await self.client.delete(key)
        await self.client.srem(f"fmd:worker:{worker_id}:browsers", browser_id)
    
    async def get_active_browsers(self, worker_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all active browsers, optionally filtered by worker"""
        if worker_id:
            browser_ids = await self.client.smembers(f"fmd:worker:{worker_id}:browsers")
        else:
            # Get all browsers (scan for browser keys)
            browser_ids = []
            async for key in self.client.scan_iter(f"{self.BROWSER_PREFIX}*"):
                browser_ids.append(key.replace(self.BROWSER_PREFIX, ''))
        
        browsers = []
        for browser_id in browser_ids:
            data = await self.client.hgetall(f"{self.BROWSER_PREFIX}{browser_id}")
            if data:
                data['browser_id'] = browser_id
                browsers.append(data)
        
        return browsers
    
    # ==========================================
    # Distributed Locking
    # ==========================================
    
    async def acquire_lock(self, resource: str, timeout: int = 30) -> bool:
        """Acquire a distributed lock"""
        key = f"{self.LOCK_PREFIX}{resource}"
        return await self.client.set(key, "locked", nx=True, ex=timeout)
    
    async def release_lock(self, resource: str):
        """Release a distributed lock"""
        key = f"{self.LOCK_PREFIX}{resource}"
        await self.client.delete(key)
    
    # ==========================================
    # Pub/Sub for Real-time Updates
    # ==========================================
    
    async def publish_event(self, channel: str, event: Dict[str, Any]):
        """Publish an event to subscribers"""
        await self.client.publish(f"fmd:{channel}", json.dumps(event))
    
    async def subscribe(self, *channels: str):
        """Subscribe to event channels"""
        self._pubsub = self.client.pubsub()
        await self._pubsub.subscribe(*[f"fmd:{c}" for c in channels])
        return self._pubsub


# Singleton instance
_queue_instance: Optional[RedisQueue] = None


async def get_redis_queue() -> RedisQueue:
    """Get or create Redis queue instance"""
    global _queue_instance
    if _queue_instance is None:
        _queue_instance = RedisQueue()
        await _queue_instance.connect()
    return _queue_instance
