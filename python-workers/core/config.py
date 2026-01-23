"""
Configuration management for the Python workers

Security-hardened configuration with defense-in-depth approach
"""
import os
import secrets
from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache
from typing import Optional, List


class Settings(BaseSettings):
    """Application settings loaded from environment"""
    
    # Database
    database_url: str = "postgresql://localhost:5432/facemydealer"
    
    # Redis
    redis_url: str = "redis://localhost:6379"
    
    # Main API
    api_base_url: str = "https://dealersface.com"
    
    # Security - REQUIRED in production
    encryption_key: str = ""  # Must be set in production
    worker_secret: str = ""   # Must be at least 32 chars for HMAC
    api_key: str = ""         # API key for authentication
    session_secret: str = ""  # Legacy: alias for encryption_key
    
    # CORS - restrict in production
    cors_origins: str = ""  # Comma-separated list, empty = localhost only
    
    # Security Level: strict, standard, relaxed
    security_level: str = "standard"
    
    # IP Allowlist (comma-separated, empty = allow private networks)
    allowed_ips: str = ""
    
    # Worker settings
    worker_id: str = "worker-1"
    max_concurrent_browsers: int = 5
    max_browsers_per_pool: int = 10
    headless: bool = True
    
    # Timing
    task_poll_interval: int = 5  # seconds
    session_check_interval: int = 300  # 5 minutes
    browser_idle_timeout: int = 600  # 10 minutes
    
    # Resource limits
    browser_memory_limit_mb: int = 512
    browser_timeout_seconds: int = 120
    
    # Rate limiting
    rate_limit_requests: int = 100
    rate_limit_window: int = 60
    
    # Queue settings - IMPORTANT: Must match what Node.js API pushes to
    # Default: fmd:tasks:soldier:pending (for soldier worker tasks)
    task_queue_name: str = "fmd:tasks:soldier:pending"
    max_task_retries: int = 3
    
    # Paths
    sessions_dir: str = "/app/sessions"
    
    # Feature flags
    enable_anti_detect: bool = True
    enable_session_rotation: bool = True
    
    # Monitoring
    enable_security_audit: bool = True
    log_level: str = "INFO"
    debug: bool = False  # Legacy: debug mode
    
    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"  # Ignore unknown env vars for forward compatibility
    
    @field_validator("worker_secret")
    @classmethod
    def validate_worker_secret(cls, v):
        """Ensure worker secret is strong enough"""
        if v and len(v) < 32:
            raise ValueError("WORKER_SECRET must be at least 32 characters")
        return v
    
    def get_cors_origins(self) -> List[str]:
        """Get parsed CORS origins list"""
        if not self.cors_origins:
            # Default: localhost only in production
            return [
                "http://localhost:3000",
                "http://localhost:8000",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:8000",
            ]
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
    
    def get_allowed_ips(self) -> List[str]:
        """Get parsed allowed IPs list"""
        if not self.allowed_ips:
            return []
        return [ip.strip() for ip in self.allowed_ips.split(",") if ip.strip()]
    
    def is_production(self) -> bool:
        """Check if running in production mode"""
        return self.api_base_url and "localhost" not in self.api_base_url


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Secure browser launch arguments
# Note: Performance-optimized while maintaining security
BROWSER_ARGS = [
    # Anti-detection (essential for Facebook)
    '--disable-blink-features=AutomationControlled',
    
    # Memory/performance optimization
    '--disable-dev-shm-usage',
    '--disable-gpu',
    
    # Sandboxing - KEEP ENABLED for security
    # Only disable in trusted container environments
    # '--no-sandbox',
    # '--disable-setuid-sandbox',
    
    # Window configuration
    '--window-size=1920,1080',
    
    # Reduce fingerprinting surface
    '--disable-extensions',
    '--disable-plugins',
    
    # Performance optimizations
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-breakpad',
    '--disable-component-extensions-with-background-pages',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-hang-monitor',
    '--disable-ipc-flooding-protection',
    '--disable-popup-blocking',
    '--disable-prompt-on-repost',
    '--disable-renderer-backgrounding',
    '--disable-sync',
    '--force-color-profile=srgb',
    
    # Privacy/security
    '--disable-client-side-phishing-detection',
    '--metrics-recording-only',
    '--no-first-run',
    '--password-store=basic',
    '--use-mock-keychain',
    
    # Logging
    '--enable-logging=stderr',
    '--log-level=1',
]

# Additional args for containerized/sandboxed environments ONLY
BROWSER_ARGS_CONTAINER = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
]

# REMOVED: --disable-web-security (security vulnerability)
# REMOVED: --disable-features=IsolateOrigins,site-per-process (security risk)

# User agents rotation
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
]

# Viewport sizes for variety
VIEWPORTS = [
    {'width': 1920, 'height': 1080},
    {'width': 1366, 'height': 768},
    {'width': 1536, 'height': 864},
    {'width': 1440, 'height': 900},
]
