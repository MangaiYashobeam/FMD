"""
Setup Session Script - Interactive session creation
Run this locally to set up Facebook sessions with 2FA
"""
import asyncio
import sys
import getpass
from typing import Optional
import structlog

from playwright.async_api import async_playwright

from browser.session import SessionManager
from browser.anti_detect import apply_stealth
from facebook.auth import FacebookAuth, TwoFactorAuthManager
from facebook.selectors import FacebookSelectors
from core.config import get_settings, BROWSER_ARGS, USER_AGENTS

logger = structlog.get_logger()


async def setup_session_interactive(
    account_id: str,
    email: str,
    password: str,
    totp_secret: Optional[str] = None,
    headless: bool = False
):
    """
    Interactively set up a Facebook session
    
    This function:
    1. Opens a browser (visible by default for manual 2FA)
    2. Logs into Facebook
    3. Handles 2FA (automatic with TOTP secret, or manual)
    4. Saves the session for later use
    
    Args:
        account_id: Unique identifier for this account
        email: Facebook email/phone
        password: Facebook password
        totp_secret: Optional TOTP secret for automatic 2FA
        headless: Whether to run headless (default False for interactive)
    """
    session_manager = SessionManager()
    two_fa_manager = TwoFactorAuthManager()
    
    if totp_secret:
        two_fa_manager.register_totp_secret(account_id, totp_secret)
    
    print(f"\n🚀 Setting up session for account: {account_id}")
    print(f"   Email: {email}")
    print(f"   2FA: {'Automatic (TOTP)' if totp_secret else 'Manual'}")
    print(f"   Mode: {'Headless' if headless else 'Visible browser'}")
    print()
    
    async with async_playwright() as playwright:
        # Launch browser
        browser = await playwright.chromium.launch(
            headless=headless,
            args=BROWSER_ARGS
        )
        
        # Create context with realistic settings
        context = await browser.new_context(
            user_agent=USER_AGENTS[0],
            viewport={'width': 1920, 'height': 1080},
            locale='en-US',
            timezone_id='America/New_York'
        )
        
        # Apply anti-detection
        settings = get_settings()
        if settings.enable_anti_detect:
            await apply_stealth(context)
        
        # Create page
        page = await context.new_page()
        
        # Create auth handler
        auth = FacebookAuth(page, session_manager)
        
        # Set up 2FA callback
        async def get_2fa_code(acc_id: str) -> str:
            if totp_secret:
                code = two_fa_manager._generate_totp(acc_id)
                print(f"   Generated 2FA code: {code}")
                return code
            else:
                print("\n⚠️  2FA Code Required!")
                print("   Check your authenticator app or SMS")
                code = input("   Enter 2FA code: ").strip()
                return code
        
        auth.set_2fa_callback(get_2fa_code)
        
        # Attempt login
        print("📱 Logging into Facebook...")
        result = await auth.login(
            email=email,
            password=password,
            account_id=account_id
        )
        
        if result['success']:
            print("\n✅ Login successful!")
            
            # Save session
            storage_state = await context.storage_state()
            await session_manager.save_session(account_id, storage_state)
            
            print(f"💾 Session saved for account: {account_id}")
            print("\n   The session is now stored and can be used by workers.")
            print("   Session will be valid for approximately 30 days.")
            
        elif result['requires_2fa'] and not result.get('error'):
            print("\n⚠️  Manual 2FA required")
            print("   Please complete 2FA in the browser window...")
            print("   Press Enter when done, or 'q' to quit")
            
            # Wait for manual completion
            while True:
                await asyncio.sleep(2)
                
                if await auth.is_logged_in():
                    print("\n✅ Login completed!")
                    
                    storage_state = await context.storage_state()
                    await session_manager.save_session(account_id, storage_state)
                    
                    print(f"💾 Session saved for account: {account_id}")
                    break
                
                # Check for user input (non-blocking)
                # Note: This is a simplified version
                
        elif result['checkpoint']:
            print("\n❌ Security checkpoint detected!")
            print("   Facebook requires additional verification.")
            print("   Please complete the security check in the browser.")
            print("   Press Enter when done...")
            
            input()
            
            if await auth.is_logged_in():
                storage_state = await context.storage_state()
                await session_manager.save_session(account_id, storage_state)
                print(f"💾 Session saved for account: {account_id}")
            else:
                print("   Login still not complete. Please try again later.")
                
        else:
            print(f"\n❌ Login failed: {result.get('error', 'Unknown error')}")
        
        # Keep browser open briefly for verification
        if not headless:
            print("\n   Browser will close in 5 seconds...")
            await asyncio.sleep(5)
        
        await browser.close()


async def list_sessions():
    """List all stored sessions"""
    session_manager = SessionManager()
    sessions = await session_manager.list_sessions()
    
    if not sessions:
        print("\n📭 No sessions found")
        return
    
    print(f"\n📋 Found {len(sessions)} session(s):\n")
    
    for session in sessions:
        status = "✅" if session['age_days'] < 25 else "⚠️"
        print(f"   {status} {session['account_id']}")
        print(f"      Age: {session['age_days']} days")
        print(f"      Cookies: {session['cookie_count']}")
        print(f"      Saved: {session['saved_at']}")
        print()


async def validate_session(account_id: str):
    """Validate a specific session"""
    session_manager = SessionManager()
    
    print(f"\n🔍 Validating session for: {account_id}")
    
    is_valid = await session_manager.is_session_valid(account_id)
    
    if is_valid:
        print("   ✅ Session is valid")
    else:
        print("   ❌ Session is invalid or expired")


def main():
    """Interactive CLI for session management"""
    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer()
        ]
    )
    
    print("\n" + "="*60)
    print("   FaceMyDealer Session Setup Tool")
    print("="*60)
    
    while True:
        print("\n📌 Options:")
        print("   1. Set up new session")
        print("   2. List all sessions")
        print("   3. Validate a session")
        print("   4. Delete a session")
        print("   5. Exit")
        
        choice = input("\nSelect option (1-5): ").strip()
        
        if choice == '1':
            print("\n--- New Session Setup ---")
            account_id = input("Account ID (unique identifier): ").strip()
            email = input("Facebook email/phone: ").strip()
            password = getpass.getpass("Facebook password: ")
            
            has_totp = input("Do you have a TOTP secret? (y/n): ").lower() == 'y'
            totp_secret = None
            if has_totp:
                totp_secret = input("TOTP secret: ").strip()
            
            headless = input("Run headless? (y/n, default n): ").lower() == 'y'
            
            asyncio.run(setup_session_interactive(
                account_id=account_id,
                email=email,
                password=password,
                totp_secret=totp_secret,
                headless=headless
            ))
            
        elif choice == '2':
            asyncio.run(list_sessions())
            
        elif choice == '3':
            account_id = input("Account ID to validate: ").strip()
            asyncio.run(validate_session(account_id))
            
        elif choice == '4':
            account_id = input("Account ID to delete: ").strip()
            confirm = input(f"Delete session for {account_id}? (yes/no): ")
            if confirm.lower() == 'yes':
                session_manager = SessionManager()
                asyncio.run(session_manager.delete_session(account_id))
                print(f"✅ Session deleted: {account_id}")
            else:
                print("Cancelled")
                
        elif choice == '5':
            print("\n👋 Goodbye!")
            break
            
        else:
            print("Invalid option")


if __name__ == '__main__':
    main()
