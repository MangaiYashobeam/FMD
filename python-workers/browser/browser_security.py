"""
Browser Security Module
=======================

Provides hardened browser configuration that balances:
1. Security (sandboxing, process isolation, permissions)
2. Performance (resource limits, optimized flags)
3. Stealth (anti-detection, fingerprint masking)

NEVER disable security features in production unless absolutely necessary.
"""

import os
import random
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from enum import Enum
import structlog

from core.config import get_settings, BROWSER_ARGS, BROWSER_ARGS_CONTAINER

logger = structlog.get_logger()


class SecurityMode(Enum):
    """Browser security modes"""
    STRICT = "strict"       # Maximum security, suitable for untrusted content
    STANDARD = "standard"   # Balanced security, suitable for automation
    CONTAINER = "container" # For containerized environments (Docker, etc.)


@dataclass
class BrowserSecurityConfig:
    """
    Browser security configuration
    
    All settings are security-conscious defaults
    """
    
    # Security mode
    mode: SecurityMode = SecurityMode.STANDARD
    
    # Process isolation
    enable_sandbox: bool = True
    enable_site_isolation: bool = True
    
    # Resource limits
    max_memory_mb: int = 512
    max_cpu_percent: int = 50
    max_pages: int = 5
    page_timeout_ms: int = 30000
    navigation_timeout_ms: int = 60000
    
    # Network security
    block_mixed_content: bool = True
    block_insecure_downloads: bool = True
    allowed_domains: List[str] = field(default_factory=lambda: [
        "facebook.com",
        "www.facebook.com",
        "m.facebook.com",
        "web.facebook.com",
        "*.facebook.com",
        "*.fbcdn.net",
        "*.fbsbx.com",
    ])
    
    # Privacy/stealth
    disable_webrtc_leak: bool = True
    disable_canvas_fingerprinting: bool = False  # May break some sites
    randomize_viewport: bool = True
    randomize_user_agent: bool = True
    
    # Logging
    enable_console_logging: bool = True
    log_network_requests: bool = False
    
    # Cleanup
    clear_storage_on_exit: bool = False
    clear_cookies_on_exit: bool = False


def get_secure_browser_args(
    config: Optional[BrowserSecurityConfig] = None,
    is_container: bool = False
) -> List[str]:
    """
    Get security-hardened browser launch arguments
    
    Args:
        config: Security configuration
        is_container: Whether running in container environment
    
    Returns:
        List of Chrome/Chromium arguments
    """
    if config is None:
        config = BrowserSecurityConfig()
    
    args = list(BROWSER_ARGS)  # Start with base args
    
    # Add container-specific args if needed
    if is_container or config.mode == SecurityMode.CONTAINER:
        args.extend(BROWSER_ARGS_CONTAINER)
        logger.info("Using container browser arguments (sandbox disabled)")
    
    # Site isolation (SECURITY CRITICAL)
    if config.enable_site_isolation:
        args.append('--enable-features=IsolateOrigins,site-per-process')
    
    # WebRTC leak prevention
    if config.disable_webrtc_leak:
        args.extend([
            '--disable-webrtc',
            '--disable-webrtc-encryption',
            '--disable-webrtc-hw-decoding',
            '--disable-webrtc-hw-encoding',
        ])
    
    # Memory limits
    if config.max_memory_mb:
        # Note: This is advisory, not enforced by Chrome
        args.append(f'--js-flags=--max-old-space-size={config.max_memory_mb}')
    
    # Reduce attack surface
    args.extend([
        '--disable-file-system',
        '--disable-notifications',
        '--disable-speech-api',
        '--disable-speech-synthesis-api',
        '--disable-geolocation',
        '--disable-media-stream',
        '--disable-remote-fonts',
    ])
    
    # Block dangerous features
    args.extend([
        '--disable-features=DownloadBubble,DownloadBubbleV2',
        '--disable-component-update',
        '--disable-domain-reliability',
        '--disable-features=AudioServiceOutOfProcess',
    ])
    
    return args


def get_browser_context_options(
    config: Optional[BrowserSecurityConfig] = None,
    user_agent: Optional[str] = None,
    viewport: Optional[Dict[str, int]] = None,
) -> Dict[str, Any]:
    """
    Get secure browser context options for Playwright
    
    Returns options dict for browser.new_context()
    """
    from core.config import USER_AGENTS, VIEWPORTS
    
    if config is None:
        config = BrowserSecurityConfig()
    
    # Select user agent
    if user_agent:
        ua = user_agent
    elif config.randomize_user_agent:
        ua = random.choice(USER_AGENTS)
    else:
        ua = USER_AGENTS[0]
    
    # Select viewport
    if viewport:
        vp = viewport
    elif config.randomize_viewport:
        vp = random.choice(VIEWPORTS)
    else:
        vp = VIEWPORTS[0]
    
    options = {
        'user_agent': ua,
        'viewport': vp,
        'ignore_https_errors': False,  # NEVER ignore HTTPS errors in production
        'java_script_enabled': True,
        'bypass_csp': False,  # SECURITY: Don't bypass Content Security Policy
        'locale': 'en-US',
        'timezone_id': 'America/New_York',
        
        # Permissions - deny by default
        'permissions': [],  # Empty = deny all
        
        # HTTP credentials (if needed)
        # 'http_credentials': {'username': '', 'password': ''},
        
        # Geolocation (disabled for privacy)
        'geolocation': None,
        
        # Recording (disabled by default)
        'record_video_dir': None,
        'record_video_size': None,
        'record_har_path': None,
    }
    
    # Device scale factor for consistent rendering
    options['device_scale_factor'] = 1
    
    # Color scheme
    options['color_scheme'] = 'light'
    
    # Reduce motion preference
    options['reduced_motion'] = 'no-preference'
    
    # Force colors
    options['forced_colors'] = 'none'
    
    return options


def get_page_security_settings(
    config: Optional[BrowserSecurityConfig] = None
) -> Dict[str, Any]:
    """
    Get page-level security settings
    
    Returns settings to apply after page creation
    """
    if config is None:
        config = BrowserSecurityConfig()
    
    return {
        'default_timeout': config.page_timeout_ms,
        'default_navigation_timeout': config.navigation_timeout_ms,
        
        # Request interception settings
        'route_patterns': {
            # Block analytics/tracking
            'block': [
                '**/analytics**',
                '**/tracking**',
                '**/pixel.facebook.com/**',
                '**/connect.facebook.net/signals/**',
            ],
            # Allow essential resources
            'allow': [
                '**/*.facebook.com/**',
                '**/*.fbcdn.net/**',
            ]
        }
    }


async def apply_page_security(page, config: Optional[BrowserSecurityConfig] = None):
    """
    Apply security settings to a Playwright page
    
    Should be called after page creation
    """
    if config is None:
        config = BrowserSecurityConfig()
    
    # Set timeouts
    page.set_default_timeout(config.page_timeout_ms)
    page.set_default_navigation_timeout(config.navigation_timeout_ms)
    
    # Block dangerous requests (optional)
    if config.log_network_requests:
        page.on('request', lambda req: logger.debug(
            "Network request",
            url=req.url[:100],
            method=req.method
        ))
    
    # Block mixed content downloads
    if config.block_insecure_downloads:
        async def block_downloads(download):
            logger.warning("Blocked download attempt", url=download.url)
            await download.cancel()
        
        # Note: Playwright doesn't have direct download blocking,
        # but you can handle the 'download' event
        page.on('download', block_downloads)


class BrowserResourceMonitor:
    """
    Monitor browser resource usage for security/stability
    """
    
    def __init__(self, config: BrowserSecurityConfig):
        self.config = config
        self._page_count = 0
        self._contexts = []
    
    def can_create_page(self) -> bool:
        """Check if we can create another page within limits"""
        return self._page_count < self.config.max_pages
    
    def register_page(self):
        """Register a new page creation"""
        self._page_count += 1
        logger.debug("Page created", total_pages=self._page_count)
    
    def unregister_page(self):
        """Unregister a page (on close)"""
        self._page_count = max(0, self._page_count - 1)
        logger.debug("Page closed", total_pages=self._page_count)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get resource usage statistics"""
        return {
            'page_count': self._page_count,
            'max_pages': self.config.max_pages,
            'pages_available': self.config.max_pages - self._page_count,
        }


def validate_url_for_navigation(url: str, config: Optional[BrowserSecurityConfig] = None) -> bool:
    """
    Validate that a URL is safe to navigate to
    
    Returns True if URL passes security checks
    """
    from core.security import get_input_validator, NetworkSecurity, get_security_config
    
    if config is None:
        config = BrowserSecurityConfig()
    
    validator = get_input_validator()
    network = NetworkSecurity(get_security_config())
    
    # Basic URL validation
    if not validator.validate_url(url):
        logger.warning("URL failed validation", url=url[:100])
        return False
    
    # Check against allowed domains
    from urllib.parse import urlparse
    parsed = urlparse(url)
    hostname = parsed.hostname or ""
    
    # Check domain allowlist
    for allowed in config.allowed_domains:
        if allowed.startswith("*."):
            # Wildcard match
            suffix = allowed[1:]  # Remove *
            if hostname.endswith(suffix) or hostname == suffix[1:]:
                return True
        else:
            if hostname == allowed:
                return True
    
    logger.warning("URL not in allowed domains", url=url[:100], hostname=hostname)
    return False


def get_stealth_scripts() -> List[str]:
    """
    Get JavaScript snippets for browser stealth
    
    These scripts help avoid bot detection while maintaining security
    """
    return [
        # Override navigator.webdriver
        """
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
            configurable: true
        });
        """,
        
        # Override chrome automation
        """
        window.chrome = {
            runtime: {},
            loadTimes: function() {},
            csi: function() {},
            app: {}
        };
        """,
        
        # Override permissions API
        """
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );
        """,
        
        # Override plugins
        """
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5].map(() => ({
                name: 'Chrome PDF Plugin',
                filename: 'internal-pdf-viewer'
            })),
            configurable: true
        });
        """,
        
        # Override languages
        """
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
            configurable: true
        });
        """,
    ]


async def setup_secure_browser_context(browser, config: Optional[BrowserSecurityConfig] = None):
    """
    Create a security-hardened browser context
    
    Returns configured browser context
    """
    from browser.anti_detect import setup_anti_detection
    
    if config is None:
        config = BrowserSecurityConfig()
    
    # Get secure context options
    options = get_browser_context_options(config)
    
    # Create context
    context = await browser.new_context(**options)
    
    # Apply stealth scripts to all new pages
    for script in get_stealth_scripts():
        await context.add_init_script(script)
    
    logger.info("Secure browser context created",
               user_agent=options['user_agent'][:50],
               viewport=options['viewport'])
    
    return context
