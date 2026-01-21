"""
Facebook Authentication Handler
Handles login, 2FA, and session validation
"""
import asyncio
from typing import Optional, Dict, Any, Callable, Awaitable
from datetime import datetime
import structlog
from playwright.async_api import Page, TimeoutError as PlaywrightTimeout

from facebook.selectors import FacebookSelectors
from browser.anti_detect import random_delay, add_human_behavior
from browser.session import SessionManager, FacebookSessionValidator

logger = structlog.get_logger()


class FacebookAuth:
    """
    Handles Facebook authentication flows:
    - Email/password login
    - Two-factor authentication (2FA)
    - Session validation
    - Security checkpoint handling
    """
    
    def __init__(self, page: Page, session_manager: SessionManager):
        self.page = page
        self.session_manager = session_manager
        self.selectors = FacebookSelectors
        self._2fa_callback: Optional[Callable[[str], Awaitable[str]]] = None
    
    def set_2fa_callback(self, callback: Callable[[str], Awaitable[str]]):
        """
        Set callback for 2FA code retrieval
        
        The callback receives account_id and should return the 2FA code
        This allows integration with various 2FA sources (TOTP, SMS forwarding, etc.)
        """
        self._2fa_callback = callback
    
    async def is_logged_in(self) -> bool:
        """Check if currently logged into Facebook"""
        try:
            # Navigate to Facebook home if not there
            current_url = self.page.url
            if 'facebook.com' not in current_url:
                await self.page.goto(self.selectors.URLS['home'])
                await self.page.wait_for_load_state('networkidle')
            
            # Check for logged-in indicators
            logged_in_selectors = [
                self.selectors.LOGIN['logged_in_indicator'],
                self.selectors.LOGIN['profile_menu'],
                self.selectors.LOGIN['home_feed']
            ]
            
            for selector in logged_in_selectors:
                try:
                    element = await self.page.wait_for_selector(
                        selector, 
                        timeout=3000,
                        state='visible'
                    )
                    if element:
                        logger.info("User is logged in")
                        return True
                except PlaywrightTimeout:
                    continue
            
            # Check URL - login page means not logged in
            if '/login' in self.page.url or '/checkpoint' in self.page.url:
                return False
            
            return False
            
        except Exception as e:
            logger.error("Error checking login status", error=str(e))
            return False
    
    async def login(
        self,
        email: str,
        password: str,
        account_id: str,
        timeout: int = 30000
    ) -> Dict[str, Any]:
        """
        Perform Facebook login
        
        Args:
            email: Facebook email/phone
            password: Facebook password
            account_id: Account identifier for session storage
            timeout: Timeout in milliseconds
            
        Returns:
            Dict with success status and details
        """
        result = {
            'success': False,
            'requires_2fa': False,
            'checkpoint': False,
            'error': None
        }
        
        try:
            # Add human behavior helpers
            await add_human_behavior(self.page)
            
            # Go to login page
            logger.info("Navigating to Facebook login", account_id=account_id)
            await self.page.goto(self.selectors.URLS['login'])
            await self.page.wait_for_load_state('networkidle')
            await random_delay(1000, 2000)
            
            # Check if already logged in (from saved session)
            if await self.is_logged_in():
                result['success'] = True
                result['message'] = 'Already logged in from saved session'
                return result
            
            # Fill email with human-like typing
            logger.info("Entering credentials", account_id=account_id)
            email_input = await self.page.wait_for_selector(
                self.selectors.LOGIN['email_input'],
                timeout=timeout
            )
            await email_input.click()
            await random_delay(200, 500)
            await self.page.type(
                self.selectors.LOGIN['email_input'],
                email,
                delay=50 + (100 * 0.5)  # Human-like typing speed
            )
            
            await random_delay(500, 1000)
            
            # Fill password
            password_input = await self.page.wait_for_selector(
                self.selectors.LOGIN['password_input']
            )
            await password_input.click()
            await random_delay(200, 400)
            await self.page.type(
                self.selectors.LOGIN['password_input'],
                password,
                delay=40 + (80 * 0.5)
            )
            
            await random_delay(500, 1000)
            
            # Click login button
            try:
                login_btn = await self.page.wait_for_selector(
                    self.selectors.LOGIN['login_button'],
                    timeout=5000
                )
            except PlaywrightTimeout:
                login_btn = await self.page.wait_for_selector(
                    self.selectors.LOGIN['login_button_alt'],
                    timeout=5000
                )
            
            await login_btn.click()
            
            # Wait for navigation
            await self.page.wait_for_load_state('networkidle')
            await random_delay(2000, 3000)
            
            # Check result
            current_url = self.page.url
            
            # Check for 2FA
            if '/checkpoint' in current_url or '/two_step_verification' in current_url:
                logger.info("2FA required", account_id=account_id)
                result['requires_2fa'] = True
                
                # Try to handle 2FA if callback is set
                if self._2fa_callback:
                    code = await self._2fa_callback(account_id)
                    if code:
                        two_fa_result = await self._handle_2fa(code)
                        if two_fa_result['success']:
                            result['success'] = True
                            result['requires_2fa'] = False
                        else:
                            result['error'] = two_fa_result.get('error')
                        return result
                
                return result
            
            # Check for security checkpoint
            checkpoint = await self.page.query_selector(
                self.selectors.LOGIN['checkpoint_container']
            )
            if checkpoint:
                logger.warning("Security checkpoint detected", account_id=account_id)
                result['checkpoint'] = True
                result['error'] = 'Security checkpoint requires manual verification'
                return result
            
            # Check if login successful
            if await self.is_logged_in():
                logger.info("Login successful", account_id=account_id)
                
                # Save session
                storage_state = await self.page.context.storage_state()
                await self.session_manager.save_session(account_id, storage_state)
                
                result['success'] = True
                return result
            
            # Login failed
            error_element = await self.page.query_selector(self.selectors.COMMON['error_message'])
            if error_element:
                result['error'] = await error_element.text_content()
            else:
                result['error'] = 'Login failed - unknown reason'
            
            return result
            
        except PlaywrightTimeout as e:
            result['error'] = f'Timeout during login: {str(e)}'
            logger.error("Login timeout", account_id=account_id, error=str(e))
            return result
            
        except Exception as e:
            result['error'] = f'Login error: {str(e)}'
            logger.error("Login failed", account_id=account_id, error=str(e))
            return result
    
    async def _handle_2fa(self, code: str) -> Dict[str, Any]:
        """Handle 2FA code entry"""
        result = {'success': False, 'error': None}
        
        try:
            # Find and fill 2FA input
            two_fa_input = await self.page.wait_for_selector(
                self.selectors.LOGIN['two_fa_input'],
                timeout=10000
            )
            
            await two_fa_input.click()
            await random_delay(200, 400)
            await self.page.type(
                self.selectors.LOGIN['two_fa_input'],
                code,
                delay=100
            )
            
            await random_delay(500, 1000)
            
            # Submit
            submit_btn = await self.page.wait_for_selector(
                self.selectors.LOGIN['two_fa_submit']
            )
            await submit_btn.click()
            
            await self.page.wait_for_load_state('networkidle')
            await random_delay(2000, 3000)
            
            # Check for "remember browser" option
            try:
                remember_btn = await self.page.wait_for_selector(
                    self.selectors.LOGIN['trust_browser_button'],
                    timeout=5000
                )
                if remember_btn:
                    await remember_btn.click()
                    await self.page.wait_for_load_state('networkidle')
            except PlaywrightTimeout:
                pass
            
            # Verify login success
            if await self.is_logged_in():
                result['success'] = True
            else:
                result['error'] = '2FA verification failed'
            
            return result
            
        except Exception as e:
            result['error'] = f'2FA handling error: {str(e)}'
            return result
    
    async def validate_session(self, account_id: str) -> bool:
        """
        Validate that current session is still valid
        
        Args:
            account_id: Account identifier
            
        Returns:
            True if session is valid and logged in
        """
        try:
            # Load saved session
            session_data = await self.session_manager.load_session(account_id)
            
            if not session_data:
                logger.info("No saved session", account_id=account_id)
                return False
            
            # Validate cookies exist
            if not FacebookSessionValidator.validate(session_data):
                logger.warning("Session cookies invalid", account_id=account_id)
                return False
            
            # Navigate to Facebook and check actual login state
            await self.page.goto(self.selectors.URLS['home'])
            await self.page.wait_for_load_state('networkidle')
            
            is_logged = await self.is_logged_in()
            
            if not is_logged:
                logger.warning("Session expired", account_id=account_id)
                await self.session_manager.delete_session(account_id)
            
            return is_logged
            
        except Exception as e:
            logger.error("Session validation error", 
                        account_id=account_id, 
                        error=str(e))
            return False
    
    async def logout(self) -> bool:
        """
        Log out from Facebook
        
        Returns:
            True if logout successful
        """
        try:
            # Go to settings
            await self.page.goto('https://www.facebook.com/settings')
            await self.page.wait_for_load_state('networkidle')
            
            # Find logout option
            await self.page.click('[aria-label="Account"]')
            await random_delay(500, 1000)
            
            logout_btn = await self.page.wait_for_selector(
                '//span[text()="Log Out"]',
                timeout=5000
            )
            await logout_btn.click()
            
            await self.page.wait_for_load_state('networkidle')
            
            return '/login' in self.page.url
            
        except Exception as e:
            logger.error("Logout failed", error=str(e))
            return False


class TwoFactorAuthManager:
    """
    Manages 2FA code generation/retrieval for multiple accounts
    Supports TOTP (authenticator apps) and external code sources
    """
    
    def __init__(self):
        self._totp_secrets: Dict[str, str] = {}
        self._code_callback: Optional[Callable[[str], Awaitable[str]]] = None
    
    def register_totp_secret(self, account_id: str, secret: str):
        """
        Register a TOTP secret for an account
        This allows automatic 2FA code generation
        """
        self._totp_secrets[account_id] = secret
    
    def set_code_callback(self, callback: Callable[[str], Awaitable[str]]):
        """
        Set callback for retrieving 2FA codes from external source
        (e.g., SMS forwarding service, Telegram bot)
        """
        self._code_callback = callback
    
    async def get_code(self, account_id: str) -> Optional[str]:
        """Get 2FA code for an account"""
        # Try TOTP first
        if account_id in self._totp_secrets:
            return self._generate_totp(account_id)
        
        # Try callback
        if self._code_callback:
            return await self._code_callback(account_id)
        
        return None
    
    def _generate_totp(self, account_id: str) -> str:
        """Generate TOTP code from secret"""
        try:
            import pyotp
            secret = self._totp_secrets[account_id]
            totp = pyotp.TOTP(secret)
            return totp.now()
        except ImportError:
            logger.error("pyotp not installed - cannot generate TOTP")
            return None
        except Exception as e:
            logger.error("TOTP generation failed", 
                        account_id=account_id, 
                        error=str(e))
            return None
