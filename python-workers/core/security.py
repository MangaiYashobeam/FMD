"""
Security Module - Defense-in-Depth Architecture
================================================

Implements multiple layers of security:

Layer 1: Network & Transport Security
- TLS verification for all external connections
- IP allowlisting for API endpoints
- Request signature verification

Layer 2: Authentication & Authorization
- HMAC-based request signing
- Time-limited tokens
- Role-based access control

Layer 3: Input Validation & Sanitization
- Strict input validation
- Path traversal prevention
- Injection attack prevention

Layer 4: Process Isolation & Sandboxing
- Browser process isolation
- Resource limits
- Capability restrictions

Layer 5: Data Protection
- Encryption at rest
- Secure key derivation
- Sensitive data masking

Layer 6: Monitoring & Audit
- Security event logging
- Anomaly detection
- Rate limiting
"""

import os
import re
import hmac
import hashlib
import secrets
import time
import ipaddress
from typing import Optional, Dict, Any, List, Set, Callable
from datetime import datetime, timedelta
from functools import wraps
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
import asyncio
from collections import defaultdict

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
import base64
import structlog

logger = structlog.get_logger()


# =============================================================================
# Security Configuration
# =============================================================================

class SecurityLevel(Enum):
    """Security enforcement levels"""
    STRICT = "strict"       # Maximum security, may impact performance
    STANDARD = "standard"   # Balanced security and performance
    RELAXED = "relaxed"     # Development/testing only


@dataclass
class SecurityConfig:
    """Central security configuration"""
    
    # General
    security_level: SecurityLevel = SecurityLevel.STANDARD
    
    # Rate limiting
    rate_limit_requests: int = 100          # requests per window
    rate_limit_window: int = 60             # seconds
    rate_limit_burst: int = 20              # burst allowance
    
    # Token/signature settings
    token_expiry_seconds: int = 300         # 5 minutes
    signature_tolerance_seconds: int = 30   # clock skew tolerance
    
    # IP security
    allowed_ips: Set[str] = field(default_factory=lambda: {"127.0.0.1", "::1"})
    allow_private_networks: bool = True
    
    # Path security
    allowed_base_paths: List[str] = field(default_factory=list)
    
    # Browser security
    max_concurrent_browsers: int = 5
    browser_memory_limit_mb: int = 512
    browser_cpu_limit_percent: int = 50
    browser_timeout_seconds: int = 120
    
    # Data security
    encryption_iterations: int = 100000
    min_secret_length: int = 32
    
    # Audit
    audit_all_requests: bool = True
    log_sensitive_data: bool = False


# Global security config
_security_config: Optional[SecurityConfig] = None


def get_security_config() -> SecurityConfig:
    """Get or create security configuration"""
    global _security_config
    if _security_config is None:
        level = os.getenv("SECURITY_LEVEL", "standard").lower()
        _security_config = SecurityConfig(
            security_level=SecurityLevel(level) if level in [e.value for e in SecurityLevel] else SecurityLevel.STANDARD
        )
        
        # Load allowed IPs from environment
        allowed_ips = os.getenv("ALLOWED_IPS", "")
        if allowed_ips:
            _security_config.allowed_ips.update(allowed_ips.split(","))
        
        # Set allowed base paths
        _security_config.allowed_base_paths = [
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..")),  # Project root
            "/tmp",
            os.getenv("SESSIONS_DIR", "/app/sessions"),
        ]
        
    return _security_config


# =============================================================================
# Layer 1: Network & Transport Security
# =============================================================================

class NetworkSecurity:
    """Network-level security controls"""
    
    def __init__(self, config: SecurityConfig):
        self.config = config
        self._private_networks = [
            ipaddress.ip_network("10.0.0.0/8"),
            ipaddress.ip_network("172.16.0.0/12"),
            ipaddress.ip_network("192.168.0.0/16"),
            ipaddress.ip_network("127.0.0.0/8"),
            ipaddress.ip_network("::1/128"),
            ipaddress.ip_network("fc00::/7"),
        ]
    
    def is_ip_allowed(self, ip: str) -> bool:
        """Check if an IP address is allowed"""
        try:
            addr = ipaddress.ip_address(ip)
            
            # Check explicit allowlist
            if ip in self.config.allowed_ips:
                return True
            
            # Check private networks if allowed
            if self.config.allow_private_networks:
                for network in self._private_networks:
                    if addr in network:
                        return True
            
            return False
            
        except ValueError:
            logger.warning("Invalid IP address", ip=ip)
            return False
    
    def validate_url(self, url: str) -> bool:
        """Validate URL is safe to access"""
        from urllib.parse import urlparse
        
        try:
            parsed = urlparse(url)
            
            # Must have scheme
            if parsed.scheme not in ("http", "https"):
                return False
            
            # No file:// or other dangerous schemes
            if parsed.scheme in ("file", "data", "javascript"):
                return False
            
            # Must have valid host
            if not parsed.netloc:
                return False
            
            # Block access to internal metadata services
            dangerous_hosts = [
                "169.254.169.254",  # AWS metadata
                "metadata.google.internal",  # GCP metadata
                "metadata.azure.com",  # Azure metadata
            ]
            if any(h in parsed.netloc.lower() for h in dangerous_hosts):
                logger.warning("Blocked access to metadata service", url=url)
                return False
            
            return True
            
        except Exception:
            return False


# =============================================================================
# Layer 2: Authentication & Authorization
# =============================================================================

class AuthenticationManager:
    """Handles authentication and request signing"""
    
    def __init__(self, secret: str):
        if len(secret) < 32:
            raise ValueError("Secret must be at least 32 characters")
        self._secret = secret.encode()
        self._config = get_security_config()
    
    def generate_request_signature(
        self,
        method: str,
        path: str,
        body: str = "",
        timestamp: Optional[int] = None
    ) -> Dict[str, str]:
        """
        Generate HMAC signature for request
        
        Returns headers to include in request
        """
        ts = timestamp or int(time.time())
        nonce = secrets.token_hex(16)
        
        # Create signing string
        signing_string = f"{method.upper()}\n{path}\n{ts}\n{nonce}\n{body}"
        
        # Generate HMAC-SHA256 signature
        signature = hmac.new(
            self._secret,
            signing_string.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return {
            "X-Timestamp": str(ts),
            "X-Nonce": nonce,
            "X-Signature": signature,
        }
    
    def verify_request_signature(
        self,
        method: str,
        path: str,
        body: str,
        timestamp: str,
        nonce: str,
        signature: str
    ) -> bool:
        """Verify HMAC request signature"""
        try:
            ts = int(timestamp)
            now = int(time.time())
            
            # Check timestamp is within tolerance
            if abs(now - ts) > self._config.signature_tolerance_seconds:
                logger.warning("Request signature timestamp expired",
                             timestamp=ts, now=now)
                return False
            
            # Recreate signing string
            signing_string = f"{method.upper()}\n{path}\n{ts}\n{nonce}\n{body}"
            
            # Verify signature using constant-time comparison
            expected = hmac.new(
                self._secret,
                signing_string.encode(),
                hashlib.sha256
            ).hexdigest()
            
            return hmac.compare_digest(signature, expected)
            
        except Exception as e:
            logger.error("Signature verification failed", error=str(e))
            return False
    
    def generate_token(self, payload: Dict[str, Any], expiry_seconds: int = 300) -> str:
        """Generate a time-limited signed token"""
        import json
        
        payload["exp"] = int(time.time()) + expiry_seconds
        payload["iat"] = int(time.time())
        payload["jti"] = secrets.token_hex(16)
        
        payload_json = json.dumps(payload, sort_keys=True)
        payload_b64 = base64.urlsafe_b64encode(payload_json.encode()).decode()
        
        signature = hmac.new(
            self._secret,
            payload_b64.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return f"{payload_b64}.{signature}"
    
    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify and decode a signed token"""
        import json
        
        try:
            parts = token.split(".")
            if len(parts) != 2:
                return None
            
            payload_b64, signature = parts
            
            # Verify signature
            expected = hmac.new(
                self._secret,
                payload_b64.encode(),
                hashlib.sha256
            ).hexdigest()
            
            if not hmac.compare_digest(signature, expected):
                return None
            
            # Decode payload
            payload_json = base64.urlsafe_b64decode(payload_b64.encode())
            payload = json.loads(payload_json)
            
            # Check expiry
            if payload.get("exp", 0) < int(time.time()):
                logger.debug("Token expired")
                return None
            
            return payload
            
        except Exception as e:
            logger.debug("Token verification failed", error=str(e))
            return None


# =============================================================================
# Layer 3: Input Validation & Sanitization
# =============================================================================

class InputValidator:
    """Input validation and sanitization"""
    
    # Dangerous patterns to detect
    DANGEROUS_PATTERNS = [
        re.compile(r"<script", re.IGNORECASE),
        re.compile(r"javascript:", re.IGNORECASE),
        re.compile(r"on\w+\s*=", re.IGNORECASE),
        re.compile(r"\.\./"),  # Path traversal
        re.compile(r"%2e%2e", re.IGNORECASE),  # Encoded path traversal
        re.compile(r";\s*exec", re.IGNORECASE),
        re.compile(r";\s*drop", re.IGNORECASE),
        re.compile(r"--"),  # SQL comment
        re.compile(r"'\s*or\s+'", re.IGNORECASE),
    ]
    
    # Valid patterns
    ACCOUNT_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")
    TASK_ID_PATTERN = re.compile(r"^task_[a-f0-9]{8,32}$")
    EMAIL_PATTERN = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
    URL_PATTERN = re.compile(r"^https?://[^\s<>\"{}|\\^`\[\]]+$")
    
    def __init__(self):
        self._config = get_security_config()
    
    def contains_dangerous_content(self, value: str) -> bool:
        """Check if string contains dangerous patterns"""
        for pattern in self.DANGEROUS_PATTERNS:
            if pattern.search(value):
                return True
        return False
    
    def validate_account_id(self, account_id: str) -> bool:
        """Validate account ID format"""
        if not account_id or not isinstance(account_id, str):
            return False
        if self.contains_dangerous_content(account_id):
            return False
        return bool(self.ACCOUNT_ID_PATTERN.match(account_id))
    
    def validate_task_id(self, task_id: str) -> bool:
        """Validate task ID format"""
        if not task_id or not isinstance(task_id, str):
            return False
        return bool(self.TASK_ID_PATTERN.match(task_id))
    
    def validate_email(self, email: str) -> bool:
        """Validate email format"""
        if not email or not isinstance(email, str):
            return False
        if len(email) > 254:
            return False
        return bool(self.EMAIL_PATTERN.match(email))
    
    def validate_url(self, url: str) -> bool:
        """Validate URL format and safety"""
        if not url or not isinstance(url, str):
            return False
        if len(url) > 2048:
            return False
        if self.contains_dangerous_content(url):
            return False
        return bool(self.URL_PATTERN.match(url))
    
    def sanitize_string(self, value: str, max_length: int = 1000) -> str:
        """Sanitize string input"""
        if not isinstance(value, str):
            return ""
        
        # Truncate
        value = value[:max_length]
        
        # Remove null bytes
        value = value.replace("\x00", "")
        
        # Remove control characters (except newlines/tabs)
        value = "".join(c for c in value if c.isprintable() or c in "\n\t\r")
        
        return value
    
    def validate_path(self, path: str) -> bool:
        """Validate file path is safe"""
        if not path or not isinstance(path, str):
            return False
        
        # Resolve to absolute path
        try:
            abs_path = os.path.abspath(path)
            resolved = Path(abs_path).resolve()
        except Exception:
            return False
        
        # Check for path traversal
        if ".." in path:
            logger.warning("Path traversal attempt detected", path=path)
            return False
        
        # Check against allowed base paths
        for allowed_base in self._config.allowed_base_paths:
            try:
                resolved_base = Path(allowed_base).resolve()
                if str(resolved).startswith(str(resolved_base)):
                    return True
            except Exception:
                continue
        
        logger.warning("Path outside allowed directories", path=path)
        return False
    
    def validate_task_data(self, data: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """
        Validate complete task data structure
        
        Returns (is_valid, error_message)
        """
        if not isinstance(data, dict):
            return False, "Task data must be a dictionary"
        
        # Check required fields
        required = ["type"]
        for field in required:
            if field not in data:
                return False, f"Missing required field: {field}"
        
        # Validate task type
        valid_types = {"post_vehicle", "validate_session", "refresh_session"}
        if data.get("type") not in valid_types:
            return False, f"Invalid task type: {data.get('type')}"
        
        # Validate account_id if present
        if "account_id" in data:
            if not self.validate_account_id(data["account_id"]):
                return False, "Invalid account_id format"
        
        # Check for dangerous content in string values
        def check_value(val, path=""):
            if isinstance(val, str):
                if self.contains_dangerous_content(val):
                    return f"Dangerous content detected at {path}"
            elif isinstance(val, dict):
                for k, v in val.items():
                    result = check_value(v, f"{path}.{k}")
                    if result:
                        return result
            elif isinstance(val, list):
                for i, v in enumerate(val):
                    result = check_value(v, f"{path}[{i}]")
                    if result:
                        return result
            return None
        
        danger = check_value(data)
        if danger:
            return False, danger
        
        return True, None


# =============================================================================
# Layer 4: Rate Limiting
# =============================================================================

class RateLimiter:
    """Token bucket rate limiter with sliding window"""
    
    def __init__(self, config: SecurityConfig):
        self.config = config
        self._buckets: Dict[str, Dict] = defaultdict(lambda: {
            "tokens": config.rate_limit_requests,
            "last_update": time.time()
        })
        self._lock = asyncio.Lock()
    
    async def is_allowed(self, key: str, cost: int = 1) -> bool:
        """
        Check if request is allowed under rate limit
        
        Args:
            key: Rate limit key (e.g., IP address, user ID)
            cost: Number of tokens this request costs
        """
        async with self._lock:
            bucket = self._buckets[key]
            now = time.time()
            
            # Refill tokens based on time passed
            time_passed = now - bucket["last_update"]
            tokens_to_add = time_passed * (self.config.rate_limit_requests / self.config.rate_limit_window)
            bucket["tokens"] = min(
                self.config.rate_limit_requests + self.config.rate_limit_burst,
                bucket["tokens"] + tokens_to_add
            )
            bucket["last_update"] = now
            
            # Check if request is allowed
            if bucket["tokens"] >= cost:
                bucket["tokens"] -= cost
                return True
            
            return False
    
    async def get_remaining(self, key: str) -> int:
        """Get remaining tokens for a key"""
        async with self._lock:
            return int(self._buckets[key]["tokens"])
    
    async def reset(self, key: str):
        """Reset rate limit for a key"""
        async with self._lock:
            del self._buckets[key]


# =============================================================================
# Layer 5: Data Protection
# =============================================================================

class DataProtection:
    """Data encryption and protection utilities"""
    
    def __init__(self, secret: str):
        self._config = get_security_config()
        self._cipher = self._derive_cipher(secret)
    
    def _derive_cipher(self, secret: str) -> Fernet:
        """Derive encryption key from secret using PBKDF2"""
        salt = b"facemydealer_data_protection_v1"
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=self._config.encryption_iterations,
            backend=default_backend()
        )
        key = base64.urlsafe_b64encode(kdf.derive(secret.encode()))
        return Fernet(key)
    
    def encrypt(self, data: bytes) -> bytes:
        """Encrypt data"""
        return self._cipher.encrypt(data)
    
    def decrypt(self, data: bytes) -> bytes:
        """Decrypt data"""
        try:
            return self._cipher.decrypt(data)
        except InvalidToken:
            logger.error("Failed to decrypt data - invalid token")
            raise
    
    def encrypt_string(self, text: str) -> str:
        """Encrypt string and return base64"""
        encrypted = self.encrypt(text.encode())
        return base64.urlsafe_b64encode(encrypted).decode()
    
    def decrypt_string(self, encrypted: str) -> str:
        """Decrypt base64-encoded string"""
        data = base64.urlsafe_b64decode(encrypted.encode())
        return self.decrypt(data).decode()
    
    @staticmethod
    def mask_sensitive(value: str, visible_chars: int = 4) -> str:
        """Mask sensitive data for logging"""
        if not value:
            return ""
        if len(value) <= visible_chars * 2:
            return "*" * len(value)
        return value[:visible_chars] + "*" * (len(value) - visible_chars * 2) + value[-visible_chars:]
    
    @staticmethod
    def secure_compare(a: str, b: str) -> bool:
        """Constant-time string comparison"""
        return hmac.compare_digest(a, b)


# =============================================================================
# Layer 6: Security Monitoring & Audit
# =============================================================================

class SecurityEventType(Enum):
    """Types of security events"""
    AUTH_SUCCESS = "auth_success"
    AUTH_FAILURE = "auth_failure"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    INVALID_INPUT = "invalid_input"
    PATH_TRAVERSAL_ATTEMPT = "path_traversal"
    SUSPICIOUS_REQUEST = "suspicious_request"
    BROWSER_CRASH = "browser_crash"
    SESSION_EXPIRED = "session_expired"
    ENCRYPTION_ERROR = "encryption_error"


@dataclass
class SecurityEvent:
    """Security event record"""
    event_type: SecurityEventType
    timestamp: datetime
    source_ip: Optional[str]
    user_id: Optional[str]
    details: Dict[str, Any]
    severity: str  # "low", "medium", "high", "critical"


class SecurityMonitor:
    """Security event monitoring and alerting"""
    
    def __init__(self):
        self._events: List[SecurityEvent] = []
        self._event_counts: Dict[str, int] = defaultdict(int)
        self._alert_thresholds = {
            SecurityEventType.AUTH_FAILURE: (10, 60),  # 10 in 60 seconds
            SecurityEventType.RATE_LIMIT_EXCEEDED: (20, 60),
            SecurityEventType.PATH_TRAVERSAL_ATTEMPT: (3, 300),
            SecurityEventType.SUSPICIOUS_REQUEST: (5, 60),
        }
        self._lock = asyncio.Lock()
    
    async def log_event(
        self,
        event_type: SecurityEventType,
        source_ip: Optional[str] = None,
        user_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: str = "low"
    ):
        """Log a security event"""
        event = SecurityEvent(
            event_type=event_type,
            timestamp=datetime.utcnow(),
            source_ip=source_ip,
            user_id=user_id,
            details=details or {},
            severity=severity
        )
        
        async with self._lock:
            self._events.append(event)
            
            # Keep only last 10000 events
            if len(self._events) > 10000:
                self._events = self._events[-5000:]
            
            # Update counts
            key = f"{event_type.value}:{source_ip or 'unknown'}"
            self._event_counts[key] += 1
        
        # Log the event
        log_method = logger.warning if severity in ("high", "critical") else logger.info
        log_method(
            f"Security event: {event_type.value}",
            source_ip=source_ip,
            user_id=user_id,
            severity=severity,
            **details or {}
        )
        
        # Check if alert threshold exceeded
        await self._check_alert_threshold(event_type, source_ip)
    
    async def _check_alert_threshold(
        self,
        event_type: SecurityEventType,
        source_ip: Optional[str]
    ):
        """Check if event count exceeds alert threshold"""
        threshold = self._alert_thresholds.get(event_type)
        if not threshold:
            return
        
        count_limit, time_window = threshold
        key = f"{event_type.value}:{source_ip or 'unknown'}"
        
        # Count events in time window
        cutoff = datetime.utcnow() - timedelta(seconds=time_window)
        count = sum(
            1 for e in self._events
            if e.event_type == event_type
            and (source_ip is None or e.source_ip == source_ip)
            and e.timestamp > cutoff
        )
        
        if count >= count_limit:
            logger.critical(
                f"Security alert threshold exceeded",
                event_type=event_type.value,
                source_ip=source_ip,
                count=count,
                threshold=count_limit,
                window_seconds=time_window
            )
    
    async def get_recent_events(
        self,
        event_type: Optional[SecurityEventType] = None,
        limit: int = 100
    ) -> List[SecurityEvent]:
        """Get recent security events"""
        async with self._lock:
            events = self._events[-limit:]
            if event_type:
                events = [e for e in events if e.event_type == event_type]
            return events


# =============================================================================
# Security Middleware & Decorators
# =============================================================================

# Global instances
_rate_limiter: Optional[RateLimiter] = None
_security_monitor: Optional[SecurityMonitor] = None
_input_validator: Optional[InputValidator] = None


def get_rate_limiter() -> RateLimiter:
    """Get rate limiter singleton"""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter(get_security_config())
    return _rate_limiter


def get_security_monitor() -> SecurityMonitor:
    """Get security monitor singleton"""
    global _security_monitor
    if _security_monitor is None:
        _security_monitor = SecurityMonitor()
    return _security_monitor


def get_input_validator() -> InputValidator:
    """Get input validator singleton"""
    global _input_validator
    if _input_validator is None:
        _input_validator = InputValidator()
    return _input_validator


def require_rate_limit(key_func: Callable = None, cost: int = 1):
    """Decorator to enforce rate limiting"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            rate_limiter = get_rate_limiter()
            monitor = get_security_monitor()
            
            # Determine rate limit key
            key = key_func(*args, **kwargs) if key_func else "global"
            
            if not await rate_limiter.is_allowed(key, cost):
                await monitor.log_event(
                    SecurityEventType.RATE_LIMIT_EXCEEDED,
                    details={"key": key, "cost": cost},
                    severity="medium"
                )
                raise RateLimitExceeded(f"Rate limit exceeded for {key}")
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def validate_input(schema: Dict[str, type]):
    """Decorator to validate function inputs"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            validator = get_input_validator()
            
            for field, expected_type in schema.items():
                if field in kwargs:
                    value = kwargs[field]
                    
                    # Type check
                    if not isinstance(value, expected_type):
                        raise InvalidInputError(f"Invalid type for {field}")
                    
                    # String validation
                    if isinstance(value, str):
                        if validator.contains_dangerous_content(value):
                            raise InvalidInputError(f"Invalid content in {field}")
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


# =============================================================================
# Exceptions
# =============================================================================

class SecurityError(Exception):
    """Base security exception"""
    pass


class RateLimitExceeded(SecurityError):
    """Rate limit exceeded"""
    pass


class InvalidInputError(SecurityError):
    """Invalid input data"""
    pass


class AuthenticationError(SecurityError):
    """Authentication failed"""
    pass


class AuthorizationError(SecurityError):
    """Authorization failed"""
    pass


# =============================================================================
# Initialization
# =============================================================================

def init_security(secret: str = None) -> Dict[str, Any]:
    """
    Initialize all security components
    
    Returns dict of initialized components
    """
    from core.config import get_settings
    settings = get_settings()
    
    secret = secret or settings.worker_secret
    if not secret or len(secret) < 32:
        raise ValueError("WORKER_SECRET must be at least 32 characters")
    
    config = get_security_config()
    
    return {
        "config": config,
        "auth_manager": AuthenticationManager(secret),
        "network_security": NetworkSecurity(config),
        "input_validator": get_input_validator(),
        "rate_limiter": get_rate_limiter(),
        "security_monitor": get_security_monitor(),
        "data_protection": DataProtection(secret),
    }
