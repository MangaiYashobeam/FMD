"""
Session Worker - Monitors and maintains Facebook sessions
Runs periodic health checks and refresh tasks
"""
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import structlog

from core.config import get_settings
from core.redis_client import get_redis_queue
from browser.session import SessionManager

logger = structlog.get_logger()


class SessionWorker:
    """
    Background worker that monitors session health
    
    Responsibilities:
    - Periodic session validation
    - Session refresh before expiration
    - Dead session cleanup
    - Session health reporting
    """
    
    def __init__(self):
        self.settings = get_settings()
        self._session_manager = SessionManager()
        self._redis: Optional[any] = None
        self._running = False
        
        # Configuration
        self._check_interval = 300  # 5 minutes
        self._refresh_threshold_days = 7  # Refresh if older than this
        self._max_session_age_days = 30
    
    async def start(self):
        """Start the session monitor"""
        logger.info("Starting session worker")
        
        self._running = True
        self._redis = await get_redis_queue()
        
        await self._main_loop()
    
    async def stop(self):
        """Stop the session monitor"""
        logger.info("Stopping session worker")
        self._running = False
    
    async def _main_loop(self):
        """Main monitoring loop"""
        while self._running:
            try:
                await self._check_all_sessions()
                await asyncio.sleep(self._check_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Session check error", error=str(e))
                await asyncio.sleep(60)  # Back off on errors
    
    async def _check_all_sessions(self):
        """Check health of all stored sessions"""
        logger.info("Checking session health")
        
        sessions = await self._session_manager.list_sessions()
        
        healthy = 0
        needs_refresh = 0
        expired = 0
        
        for session in sessions:
            account_id = session['account_id']
            age_days = session['age_days']
            
            # Check if expired
            if age_days > self._max_session_age_days:
                logger.warning("Session expired",
                             account_id=account_id,
                             age_days=age_days)
                await self._session_manager.delete_session(account_id)
                expired += 1
                continue
            
            # Check if needs refresh
            if age_days > self._refresh_threshold_days:
                logger.info("Session needs refresh",
                          account_id=account_id,
                          age_days=age_days)
                await self._queue_refresh_task(account_id)
                needs_refresh += 1
                continue
            
            healthy += 1
        
        # Report stats
        await self._report_stats({
            'total_sessions': len(sessions),
            'healthy': healthy,
            'needs_refresh': needs_refresh,
            'expired': expired,
            'checked_at': datetime.utcnow().isoformat()
        })
        
        logger.info("Session check complete",
                   total=len(sessions),
                   healthy=healthy,
                   needs_refresh=needs_refresh,
                   expired=expired)
    
    async def _queue_refresh_task(self, account_id: str):
        """Queue a session refresh task"""
        task = {
            'id': f'refresh_{account_id}_{datetime.utcnow().timestamp()}',
            'type': 'refresh_session',
            'account_id': account_id,
            'data': {},
            'priority': 'low',
            'created_at': datetime.utcnow().isoformat()
        }
        
        await self._redis.enqueue_task(
            self.settings.task_queue_name,
            task,
            priority='low'
        )
    
    async def _report_stats(self, stats: dict):
        """Report session stats to Redis"""
        try:
            await self._redis.store_session_stats(stats)
        except Exception as e:
            logger.warning("Failed to report session stats", error=str(e))


async def main():
    """Entry point for session worker"""
    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer()
        ]
    )
    
    worker = SessionWorker()
    
    try:
        await worker.start()
    except KeyboardInterrupt:
        pass
    finally:
        await worker.stop()


if __name__ == '__main__':
    asyncio.run(main())
