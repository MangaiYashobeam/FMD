"""
API Client for communicating with the Node.js API
Sends activity logs and status updates for IAI Stealth Soldiers
"""
import aiohttp
import asyncio
from typing import Optional, Dict, Any
from datetime import datetime
import structlog

from core.config import get_settings

logger = structlog.get_logger()


class APIClient:
    """
    HTTP client for communicating with the main API.
    
    Handles:
    - Activity logging for soldiers
    - Heartbeat updates
    - Task status updates
    """
    
    def __init__(self):
        self.settings = get_settings()
        self.base_url = self.settings.api_base_url.rstrip('/')
        self._session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP session"""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=30),
                headers={
                    'Content-Type': 'application/json',
                    'X-Worker-Secret': self.settings.worker_secret,
                }
            )
        return self._session
    
    async def close(self):
        """Close the HTTP session"""
        if self._session and not self._session.closed:
            await self._session.close()
    
    async def log_soldier_activity(
        self,
        soldier_id: str,
        account_id: str,
        event_type: str,
        message: str,
        event_data: Optional[Dict[str, Any]] = None,
        task_id: Optional[str] = None,
        task_type: Optional[str] = None,
    ) -> bool:
        """
        Log an activity event for a soldier.
        
        Args:
            soldier_id: The soldier's ID (e.g., 'STEALTH-1')
            account_id: The account UUID
            event_type: Type of event (task_start, task_complete, task_failed, etc.)
            message: Human-readable message
            event_data: Additional event metadata
            task_id: Optional task ID
            task_type: Optional task type
            
        Returns:
            True if logged successfully, False otherwise
        """
        try:
            session = await self._get_session()
            
            payload = {
                'soldierId': soldier_id,
                'accountId': account_id,
                'eventType': event_type,
                'message': message,
                'eventData': event_data or {},
                'taskId': task_id,
                'taskType': task_type,
                'timestamp': datetime.utcnow().isoformat(),
            }
            
            # Use internal worker API endpoint (no auth required for worker)
            url = f"{self.base_url}/api/worker/iai/log-activity"
            
            async with session.post(url, json=payload) as response:
                if response.status == 200:
                    logger.debug("Activity logged", 
                               soldier_id=soldier_id, 
                               event_type=event_type)
                    return True
                else:
                    text = await response.text()
                    logger.warning("Failed to log activity",
                                  status=response.status,
                                  response=text[:200])
                    return False
                    
        except Exception as e:
            logger.error("API error logging activity", error=str(e))
            return False
    
    async def update_soldier_status(
        self,
        soldier_id: str,
        account_id: str,
        status: str,
        current_task_type: Optional[str] = None,
        progress: Optional[int] = None,
    ) -> bool:
        """
        Update soldier status in database.
        
        Args:
            soldier_id: The soldier's ID
            account_id: The account UUID
            status: New status (WORKING, IDLE, ERROR, etc.)
            current_task_type: Optional current task being performed
            progress: Optional progress percentage (0-100)
            
        Returns:
            True if updated successfully
        """
        try:
            session = await self._get_session()
            
            payload = {
                'soldierId': soldier_id,
                'accountId': account_id,
                'status': status,
                'currentTaskType': current_task_type,
                'progress': progress,
                'lastHeartbeatAt': datetime.utcnow().isoformat(),
            }
            
            url = f"{self.base_url}/api/worker/iai/update-status"
            
            async with session.post(url, json=payload) as response:
                return response.status == 200
                
        except Exception as e:
            logger.error("API error updating status", error=str(e))
            return False
    
    async def complete_task(
        self,
        task_id: str,
        soldier_id: str,
        account_id: str,
        success: bool,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> bool:
        """
        Report task completion to the API.
        
        Args:
            task_id: The task ID
            soldier_id: The soldier that completed the task
            account_id: The account UUID
            success: Whether task succeeded
            result: Optional result data
            error: Optional error message if failed
            
        Returns:
            True if reported successfully
        """
        try:
            session = await self._get_session()
            
            payload = {
                'taskId': task_id,
                'soldierId': soldier_id,
                'accountId': account_id,
                'success': success,
                'result': result or {},
                'error': error,
                'completedAt': datetime.utcnow().isoformat(),
            }
            
            url = f"{self.base_url}/api/worker/iai/task-complete"
            
            async with session.post(url, json=payload) as response:
                return response.status == 200
                
        except Exception as e:
            logger.error("API error completing task", error=str(e))
            return False


# Singleton instance
_api_client: Optional[APIClient] = None


def get_api_client() -> APIClient:
    """Get or create the API client singleton"""
    global _api_client
    if _api_client is None:
        _api_client = APIClient()
    return _api_client
