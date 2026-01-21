"""
Browser Pool Manager - Manages multiple headless browser instances
Each browser is dedicated to a specific Facebook account
"""
import asyncio
import uuid
from typing import Dict, Optional, List, Any
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
import structlog
from playwright.async_api import async_playwright, Browser, BrowserContext, Page, Playwright

from core.config import get_settings, BROWSER_ARGS, USER_AGENTS, VIEWPORTS
from core.redis_client import get_redis_queue
from browser.session import SessionManager
from browser.anti_detect import apply_stealth

logger = structlog.get_logger()


class BrowserInstance:
    """
    Represents a single browser instance dedicated to one Facebook account
    """
    
    def __init__(
        self,
        browser_id: str,
        account_id: str,
        context: BrowserContext,
        page: Page,
        worker_id: str
    ):
        self.browser_id = browser_id
        self.account_id = account_id
        self.context = context
        self.page = page
        self.worker_id = worker_id
        self.created_at = datetime.utcnow()
        self.last_activity = datetime.utcnow()
        self.task_count = 0
        self.is_busy = False
        self.is_healthy = True
    
    def touch(self):
        """Update last activity timestamp"""
        self.last_activity = datetime.utcnow()
    
    def is_idle(self, timeout_seconds: int = 600) -> bool:
        """Check if browser has been idle too long"""
        return (datetime.utcnow() - self.last_activity).seconds > timeout_seconds
    
    async def health_check(self) -> bool:
        """Verify browser is still functional"""
        try:
            await self.page.evaluate("() => document.readyState")
            self.is_healthy = True
            return True
        except Exception as e:
            logger.error("Browser health check failed", browser_id=self.browser_id, error=str(e))
            self.is_healthy = False
            return False


class BrowserPoolManager:
    """
    Manages a pool of browser instances across multiple accounts
    
    Features:
    - Lazy browser creation (created on-demand)
    - Session persistence (saves/loads Facebook cookies)
    - Auto-cleanup of idle browsers
    - Health monitoring
    - Resource limits
    """
    
    def __init__(self, worker_id: str):
        self.worker_id = worker_id
        self.settings = get_settings()
        self._playwright: Optional[Playwright] = None
        self._browser: Optional[Browser] = None
        self._instances: Dict[str, BrowserInstance] = {}  # browser_id -> instance
        self._account_map: Dict[str, str] = {}  # account_id -> browser_id
        self._session_manager = SessionManager()
        self._redis: Optional[Any] = None
        self._lock = asyncio.Lock()
        self._cleanup_task: Optional[asyncio.Task] = None
    
    async def start(self):
        """Initialize the browser pool"""
        logger.info("Starting browser pool", worker_id=self.worker_id)
        
        # Connect to Redis
        self._redis = await get_redis_queue()
        
        # Launch Playwright
        self._playwright = await async_playwright().start()
        
        # Launch browser (shared across contexts)
        self._browser = await self._playwright.chromium.launch(
            headless=self.settings.headless,
            args=BROWSER_ARGS,
        )
        
        # Start cleanup task
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        
        logger.info("Browser pool started", 
                   worker_id=self.worker_id,
                   headless=self.settings.headless)
    
    async def stop(self):
        """Shutdown the browser pool"""
        logger.info("Stopping browser pool", worker_id=self.worker_id)
        
        # Cancel cleanup task
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        
        # Close all browser instances
        for browser_id in list(self._instances.keys()):
            await self.release_browser(browser_id)
        
        # Close browser and playwright
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
        
        logger.info("Browser pool stopped", worker_id=self.worker_id)
    
    async def get_browser(self, account_id: str) -> Optional[BrowserInstance]:
        """
        Get or create a browser instance for an account
        Returns None if pool is at capacity
        """
        async with self._lock:
            # Check if account already has a browser
            if account_id in self._account_map:
                browser_id = self._account_map[account_id]
                instance = self._instances.get(browser_id)
                if instance and instance.is_healthy:
                    instance.touch()
                    return instance
                else:
                    # Unhealthy, clean up and recreate
                    await self._cleanup_instance(browser_id)
            
            # Check capacity
            if len(self._instances) >= self.settings.max_concurrent_browsers:
                # Try to evict an idle browser
                evicted = await self._evict_idle_browser()
                if not evicted:
                    logger.warning("Browser pool at capacity", 
                                 current=len(self._instances),
                                 max=self.settings.max_concurrent_browsers)
                    return None
            
            # Create new browser instance
            return await self._create_browser(account_id)
    
    async def _create_browser(self, account_id: str) -> BrowserInstance:
        """Create a new browser instance for an account"""
        browser_id = f"browser_{uuid.uuid4().hex[:8]}"
        
        logger.info("Creating browser instance", 
                   browser_id=browser_id, 
                   account_id=account_id)
        
        # Load saved session if available
        session_data = await self._session_manager.load_session(account_id)
        
        # Select random user agent and viewport for variety
        import random
        user_agent = random.choice(USER_AGENTS)
        viewport = random.choice(VIEWPORTS)
        
        # Create browser context with session
        context_options = {
            'user_agent': user_agent,
            'viewport': viewport,
            'locale': 'en-US',
            'timezone_id': 'America/New_York',
        }
        
        if session_data:
            context_options['storage_state'] = session_data
        
        context = await self._browser.new_context(**context_options)
        
        # Apply anti-detection measures
        if self.settings.enable_anti_detect:
            await apply_stealth(context)
        
        # Create page
        page = await context.new_page()
        
        # Create instance
        instance = BrowserInstance(
            browser_id=browser_id,
            account_id=account_id,
            context=context,
            page=page,
            worker_id=self.worker_id
        )
        
        # Register
        self._instances[browser_id] = instance
        self._account_map[account_id] = browser_id
        
        # Register in Redis
        await self._redis.register_browser(browser_id, account_id, self.worker_id)
        
        logger.info("Browser instance created", 
                   browser_id=browser_id,
                   account_id=account_id,
                   has_session=session_data is not None)
        
        return instance
    
    async def release_browser(self, browser_id: str):
        """Release a browser instance and save its session"""
        async with self._lock:
            await self._cleanup_instance(browser_id)
    
    async def _cleanup_instance(self, browser_id: str):
        """Internal cleanup of a browser instance"""
        instance = self._instances.pop(browser_id, None)
        if not instance:
            return
        
        # Remove from account map
        if instance.account_id in self._account_map:
            del self._account_map[instance.account_id]
        
        # Save session before closing
        try:
            session_data = await instance.context.storage_state()
            await self._session_manager.save_session(instance.account_id, session_data)
        except Exception as e:
            logger.error("Failed to save session", 
                        browser_id=browser_id,
                        error=str(e))
        
        # Close context
        try:
            await instance.context.close()
        except Exception as e:
            logger.error("Failed to close context", 
                        browser_id=browser_id,
                        error=str(e))
        
        # Unregister from Redis
        await self._redis.unregister_browser(browser_id, self.worker_id)
        
        logger.info("Browser instance released", 
                   browser_id=browser_id,
                   account_id=instance.account_id)
    
    async def _evict_idle_browser(self) -> bool:
        """Evict the most idle browser to make room"""
        idle_browsers = [
            (bid, inst) for bid, inst in self._instances.items()
            if not inst.is_busy and inst.is_idle(self.settings.browser_idle_timeout)
        ]
        
        if not idle_browsers:
            return False
        
        # Sort by last activity (oldest first)
        idle_browsers.sort(key=lambda x: x[1].last_activity)
        
        # Evict oldest
        browser_id, _ = idle_browsers[0]
        await self._cleanup_instance(browser_id)
        return True
    
    async def _cleanup_loop(self):
        """Background task to clean up idle browsers"""
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute
                
                async with self._lock:
                    for browser_id in list(self._instances.keys()):
                        instance = self._instances[browser_id]
                        
                        # Skip busy instances
                        if instance.is_busy:
                            continue
                        
                        # Check if idle
                        if instance.is_idle(self.settings.browser_idle_timeout):
                            logger.info("Evicting idle browser", browser_id=browser_id)
                            await self._cleanup_instance(browser_id)
                        
                        # Health check remaining browsers
                        elif not await instance.health_check():
                            logger.warning("Evicting unhealthy browser", browser_id=browser_id)
                            await self._cleanup_instance(browser_id)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Cleanup loop error", error=str(e))
    
    @asynccontextmanager
    async def use_browser(self, account_id: str):
        """
        Context manager for using a browser instance
        Automatically marks as busy/free and handles errors
        """
        instance = await self.get_browser(account_id)
        if not instance:
            raise RuntimeError(f"Could not acquire browser for account {account_id}")
        
        instance.is_busy = True
        try:
            yield instance
            instance.task_count += 1
            instance.touch()
        finally:
            instance.is_busy = False
            # Update activity in Redis
            await self._redis.update_browser_activity(instance.browser_id)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get pool statistics"""
        return {
            'worker_id': self.worker_id,
            'total_browsers': len(self._instances),
            'max_browsers': self.settings.max_concurrent_browsers,
            'browsers': [
                {
                    'browser_id': inst.browser_id,
                    'account_id': inst.account_id,
                    'is_busy': inst.is_busy,
                    'is_healthy': inst.is_healthy,
                    'task_count': inst.task_count,
                    'idle_seconds': (datetime.utcnow() - inst.last_activity).seconds,
                }
                for inst in self._instances.values()
            ]
        }
