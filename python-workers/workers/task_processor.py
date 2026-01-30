"""
Task Processor - Core task execution logic
Handles different task types and routes them appropriately
"""
import asyncio
from typing import Dict, Any, Optional, Callable, Awaitable
from datetime import datetime
from enum import Enum
import structlog
import httpx

from core.config import get_settings
from browser.manager import BrowserPoolManager, BrowserInstance
from facebook.auth import FacebookAuth
from facebook.marketplace import MarketplacePoster
from browser.session import SessionManager

logger = structlog.get_logger()


class TaskType(str, Enum):
    """Supported task types - handles both old and new formats"""
    # Original formats
    POST_VEHICLE = 'post_vehicle'
    POST_ITEM = 'post_item'
    VALIDATE_SESSION = 'validate_session'
    REFRESH_SESSION = 'refresh_session'
    DELETE_LISTING = 'delete_listing'
    UPDATE_LISTING = 'update_listing'
    # Node.js API formats (uppercase)
    POST_TO_MARKETPLACE = 'POST_TO_MARKETPLACE'
    SOLDIER_POST_TO_MARKETPLACE = 'SOLDIER_POST_TO_MARKETPLACE'
    PUPPETEER_POST_TO_MARKETPLACE = 'PUPPETEER_POST_TO_MARKETPLACE'


class TaskStatus(str, Enum):
    """Task execution statuses"""
    PENDING = 'pending'
    PROCESSING = 'processing'
    COMPLETED = 'completed'
    FAILED = 'failed'
    RETRY = 'retry'


class TaskProcessor:
    """
    Processes automation tasks from the queue
    
    Responsibilities:
    - Execute different task types
    - Report results back to main API
    - Handle errors and retries
    - Manage task lifecycle
    """
    
    def __init__(
        self,
        browser_pool: BrowserPoolManager,
        worker_id: str
    ):
        self.browser_pool = browser_pool
        self.worker_id = worker_id
        self.settings = get_settings()
        self._session_manager = SessionManager()
        self._http_client: Optional[httpx.AsyncClient] = None
        
        # Task handlers registry - handle all task type formats
        self._handlers: Dict[TaskType, Callable] = {
            # Original formats
            TaskType.POST_VEHICLE: self._handle_post_vehicle,
            TaskType.POST_ITEM: self._handle_post_item,
            TaskType.VALIDATE_SESSION: self._handle_validate_session,
            TaskType.REFRESH_SESSION: self._handle_refresh_session,
            # Node.js API formats - map to same handlers
            TaskType.POST_TO_MARKETPLACE: self._handle_post_vehicle,
            TaskType.SOLDIER_POST_TO_MARKETPLACE: self._handle_post_vehicle,
            TaskType.PUPPETEER_POST_TO_MARKETPLACE: self._handle_post_vehicle,
        }
    
    async def start(self):
        """Initialize the task processor"""
        self._http_client = httpx.AsyncClient(
            base_url=self.settings.api_base_url,
            timeout=30.0
        )
        logger.info("Task processor started", worker_id=self.worker_id)
    
    async def stop(self):
        """Cleanup resources"""
        if self._http_client:
            await self._http_client.aclose()
        logger.info("Task processor stopped", worker_id=self.worker_id)
    
    async def process_task(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process a single task
        
        Args:
            task: Task data dict containing:
                - id: Task ID
                - type: Task type (TaskType enum value)
                - account_id: Facebook account ID
                - data: Task-specific payload
                - retry_count: Number of retries so far
                
        Returns:
            Result dict with status and details
        """
        task_id = task.get('id')
        task_type = task.get('type')
        account_id = task.get('account_id')
        soldier_id = task.get('soldier_id', task.get('soldierId', f'worker-{self.worker_id}'))
        
        result = {
            'task_id': task_id,
            'status': TaskStatus.PROCESSING,
            'started_at': datetime.utcnow().isoformat(),
            'worker_id': self.worker_id,
            'error': None,
            'data': {}
        }
        
        # 💓 HEARTBEAT: Log task start to IAI
        logger.info("💓 Processing task", 
                   task_id=task_id,
                   task_type=task_type,
                   account_id=account_id,
                   soldier_id=soldier_id)
        
        await self._log_iai_activity(
            soldier_id=soldier_id,
            event_type='task_start',
            message=f'Started processing {task_type}',
            task_data={'taskId': task_id, 'taskType': task_type}
        )
        
        try:
            # Validate task type
            try:
                task_type_enum = TaskType(task_type)
            except ValueError:
                result['status'] = TaskStatus.FAILED
                result['error'] = f'Unknown task type: {task_type}'
                await self._log_iai_activity(
                    soldier_id=soldier_id,
                    event_type='task_failed',
                    message=f'Unknown task type: {task_type}',
                    task_data={'taskId': task_id, 'error': result['error']}
                )
                return result
            
            # Get handler
            handler = self._handlers.get(task_type_enum)
            if not handler:
                result['status'] = TaskStatus.FAILED
                result['error'] = f'No handler for task type: {task_type}'
                await self._log_iai_activity(
                    soldier_id=soldier_id,
                    event_type='task_failed',
                    message=f'No handler for task type: {task_type}',
                    task_data={'taskId': task_id, 'error': result['error']}
                )
                return result
            
            # Execute task with browser
            async with self.browser_pool.use_browser(account_id) as browser:
                # 💓 Log task execution start
                await self._log_iai_activity(
                    soldier_id=soldier_id,
                    event_type='task_executing',
                    message=f'Executing {task_type} with browser',
                    task_data={'taskId': task_id, 'taskType': task_type}
                )
                
                task_result = await handler(task, browser)
                
                result['data'] = task_result
                result['status'] = (
                    TaskStatus.COMPLETED if task_result.get('success') 
                    else TaskStatus.FAILED
                )
                
                if not task_result.get('success'):
                    result['error'] = task_result.get('error')
            
            # Report result to main API
            await self._report_task_result(result)
            
            # 💓 HEARTBEAT: Log task completion to IAI
            if result['status'] == TaskStatus.COMPLETED:
                await self._log_iai_activity(
                    soldier_id=soldier_id,
                    event_type='task_complete',
                    message=f'Successfully completed {task_type}',
                    task_data={'taskId': task_id, 'result': result['data']}
                )
            else:
                await self._log_iai_activity(
                    soldier_id=soldier_id,
                    event_type='task_failed',
                    message=f'Task failed: {result["error"]}',
                    task_data={'taskId': task_id, 'error': result['error']}
                )
            
        except RuntimeError as e:
            # Browser pool at capacity
            result['status'] = TaskStatus.RETRY
            result['error'] = str(e)
            logger.warning("Browser unavailable, will retry", 
                          task_id=task_id,
                          error=str(e))
            await self._log_iai_activity(
                soldier_id=soldier_id,
                event_type='task_retry',
                message=f'Browser unavailable, will retry: {str(e)}',
                task_data={'taskId': task_id, 'error': str(e)}
            )
            
        except Exception as e:
            result['status'] = TaskStatus.FAILED
            result['error'] = str(e)
            logger.error("Task processing failed",
                        task_id=task_id,
                        error=str(e))
            
            # Report failure
            await self._report_task_result(result)
            
            # 💓 HEARTBEAT: Log failure to IAI
            await self._log_iai_activity(
                soldier_id=soldier_id,
                event_type='task_failed',
                message=f'Task processing failed: {str(e)}',
                task_data={'taskId': task_id, 'error': str(e)}
            )
        
        result['completed_at'] = datetime.utcnow().isoformat()
        return result
    
    async def _handle_post_vehicle(
        self,
        task: Dict[str, Any],
        browser: BrowserInstance
    ) -> Dict[str, Any]:
        """Handle vehicle posting task"""
        data = task.get('data', {})
        account_id = task.get('account_id')
        
        # Initialize auth and check session
        auth = FacebookAuth(browser.page, self._session_manager)
        
        if not await auth.is_logged_in():
            # Try to validate/restore session
            valid = await auth.validate_session(account_id)
            if not valid:
                return {
                    'success': False,
                    'error': 'Not logged in and no valid session'
                }
        
        # Create marketplace poster
        poster = MarketplacePoster(browser.page)
        
        # Download photos if URLs provided
        photos = await self._download_photos(data.get('photos', []))
        
        # Create listing
        result = await poster.create_vehicle_listing(
            vehicle_data=data.get('vehicle', {}),
            photos=photos,
            post_to_groups=data.get('groups', [])
        )
        
        # Cleanup downloaded photos
        await self._cleanup_photos(photos)
        
        return result
    
    async def _handle_post_item(
        self,
        task: Dict[str, Any],
        browser: BrowserInstance
    ) -> Dict[str, Any]:
        """Handle general item posting task"""
        data = task.get('data', {})
        account_id = task.get('account_id')
        
        auth = FacebookAuth(browser.page, self._session_manager)
        
        if not await auth.is_logged_in():
            valid = await auth.validate_session(account_id)
            if not valid:
                return {
                    'success': False,
                    'error': 'Not logged in and no valid session'
                }
        
        poster = MarketplacePoster(browser.page)
        photos = await self._download_photos(data.get('photos', []))
        
        result = await poster.create_item_listing(
            item_data=data.get('item', {}),
            photos=photos
        )
        
        await self._cleanup_photos(photos)
        
        return result
    
    async def _handle_validate_session(
        self,
        task: Dict[str, Any],
        browser: BrowserInstance
    ) -> Dict[str, Any]:
        """Validate a Facebook session is still active"""
        account_id = task.get('account_id')
        
        auth = FacebookAuth(browser.page, self._session_manager)
        is_valid = await auth.validate_session(account_id)
        
        return {
            'success': True,
            'session_valid': is_valid,
            'account_id': account_id
        }
    
    async def _handle_refresh_session(
        self,
        task: Dict[str, Any],
        browser: BrowserInstance
    ) -> Dict[str, Any]:
        """Attempt to refresh a session by navigating around"""
        account_id = task.get('account_id')
        
        auth = FacebookAuth(browser.page, self._session_manager)
        
        if not await auth.is_logged_in():
            return {
                'success': False,
                'error': 'Session invalid and cannot refresh without credentials'
            }
        
        # Navigate around to refresh cookies
        await browser.page.goto('https://www.facebook.com/')
        await asyncio.sleep(2)
        await browser.page.goto('https://www.facebook.com/marketplace/')
        await asyncio.sleep(2)
        
        # Save refreshed session
        storage_state = await browser.context.storage_state()
        await self._session_manager.save_session(account_id, storage_state)
        
        return {
            'success': True,
            'account_id': account_id,
            'message': 'Session refreshed'
        }
    
    async def _download_photos(self, photo_urls: list) -> list:
        """Download photos from URLs to temp files"""
        import tempfile
        import os
        
        downloaded = []
        
        for url in photo_urls:
            try:
                if url.startswith('http'):
                    response = await self._http_client.get(url)
                    if response.status_code == 200:
                        # Create temp file
                        suffix = '.jpg' if '.jpg' in url.lower() else '.png'
                        fd, path = tempfile.mkstemp(suffix=suffix)
                        os.write(fd, response.content)
                        os.close(fd)
                        downloaded.append(path)
                else:
                    # Assume local path
                    if os.path.exists(url):
                        downloaded.append(url)
            except Exception as e:
                logger.warning("Failed to download photo", url=url, error=str(e))
        
        return downloaded
    
    async def _cleanup_photos(self, photos: list):
        """Remove temporary downloaded photos"""
        import os
        import tempfile
        
        temp_dir = tempfile.gettempdir()
        
        for photo in photos:
            try:
                # Only delete if it's in temp directory
                if photo.startswith(temp_dir):
                    os.remove(photo)
            except Exception:
                pass
    
    async def _report_task_result(self, result: Dict[str, Any]):
        """Report task result back to main API with activity logging"""
        try:
            # 💓 HEARTBEAT: Report task result to main API
            logger.info("💓 Reporting task result to API",
                       task_id=result.get('task_id'),
                       status=result.get('status'))
            
            response = await self._http_client.post(
                '/api/worker/task-result',
                json=result,
                headers={
                    'X-Worker-ID': self.worker_id,
                    'X-Worker-Secret': self.settings.worker_secret
                }
            )
            
            if response.status_code == 200:
                logger.info("✅ Task result reported successfully",
                           task_id=result.get('task_id'))
            else:
                logger.warning("⚠️ Failed to report task result",
                             task_id=result.get('task_id'),
                             status=response.status_code)
                             
        except Exception as e:
            logger.error("❌ Error reporting task result",
                        task_id=result.get('task_id'),
                        error=str(e))
    async def _log_iai_activity(self, soldier_id: str, event_type: str, message: str, task_data: Optional[Dict] = None):
        """
        💓 HEARTBEAT: Log activity to IAI Stealth Soldier system
        Routes task updates to the new worker-authenticated endpoint
        """
        try:
            logger.info(f"📝 IAI Activity: {soldier_id} | {event_type} | {message}")
            
            payload = {
                'soldierId': soldier_id,
                'eventType': event_type,
                'message': message,
                'taskData': task_data or {},
                'taskId': task_data.get('taskId') if task_data else None,
                'taskType': task_data.get('taskType') if task_data else None,
            }
            
            # Use the worker-authenticated endpoint (not extension endpoint)
            response = await self._http_client.post(
                '/api/worker/iai/worker/activity',
                json=payload,
                headers={
                    'X-Worker-ID': self.worker_id,
                    'X-Worker-Secret': self.settings.worker_secret
                }
            )
            
            if response.status_code == 200:
                logger.info(f"✅ IAI Activity logged: {event_type}")
            else:
                logger.warning(f"⚠️ Failed to log IAI activity: {response.status_code} - {response.text}")
                
        except Exception as e:
            logger.error(f"❌ IAI Activity log failed: {str(e)}")