"""Browser management module"""
from browser.manager import BrowserPoolManager, BrowserInstance
from browser.session import SessionManager
from browser.anti_detect import apply_stealth

__all__ = [
    'BrowserPoolManager',
    'BrowserInstance', 
    'SessionManager',
    'apply_stealth'
]
