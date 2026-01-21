"""
Unified Security Module
=======================

Provides cryptographic security for communication between Python workers and Node.js.
This creates a "Security Dome" ensuring:

1. Task Authenticity - HMAC-SHA256 signatures  
2. Payload Confidentiality - AES-256-GCM encryption
3. Replay Prevention - Timestamps + nonces
4. Input Validation - Shared dangerous pattern detection

Both Node.js and Python workers use identical algorithms.

CRITICAL: This module MUST match the Node.js unified-security.service.ts exactly!
"""

import os
import re
import time
import hmac
import hashlib
import base64
import json
import secrets
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass
from datetime import datetime
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.backends import default_backend
import structlog

logger = structlog.get_logger()

# Protocol version - MUST match Node.js
SECURITY_PROTOCOL_VERSION = '1.0'

# Maximum age for valid signatures (5 minutes)
MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000

# Nonce cache to prevent replay attacks
_used_nonces: Dict[str, float] = {}

# Dangerous patterns to detect (MUST match Node.js)
DANGEROUS_PATTERNS = [
    re.compile(r'<script', re.IGNORECASE),
    re.compile(r'javascript:', re.IGNORECASE),
    re.compile(r'on\w+\s*=', re.IGNORECASE),
    re.compile(r'\.\./', re.IGNORECASE),
    re.compile(r'%2e%2e', re.IGNORECASE),
    re.compile(r';\s*exec', re.IGNORECASE),
    re.compile(r';\s*drop', re.IGNORECASE),
    re.compile(r'--'),
    re.compile(r"'\s*or\s+'", re.IGNORECASE),
]

# Validation patterns
ACCOUNT_ID_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{1,64}$')
TASK_ID_PATTERN = re.compile(r'^(task_|vehicle_|validate_|setup_)[a-f0-9]{8,32}$')


@dataclass
class VerificationResult:
    """Result of task signature verification"""
    valid: bool
    error: Optional[str] = None
    task: Optional[Dict[str, Any]] = None


class UnifiedSecurity:
    """
    Unified security service matching Node.js implementation.
    
    Provides:
    - Task signing and verification
    - Payload encryption/decryption
    - Input validation
    - Replay attack prevention
    """
    
    def __init__(self):
        self._worker_secret: Optional[bytes] = None
        self._encryption_key: Optional[bytes] = None
        self._is_initialized = False
    
    def initialize(self, worker_secret: Optional[str] = None) -> bool:
        """
        Initialize security with the shared secret.
        
        Args:
            worker_secret: Shared secret (defaults to WORKER_SECRET env var)
        
        Returns:
            True if initialized successfully
        """
        if self._is_initialized:
            return True
        
        secret = worker_secret or os.getenv('WORKER_SECRET', '')
        encryption_key_str = os.getenv('ENCRYPTION_KEY', '') or secret
        
        if not secret:
            logger.warning("WORKER_SECRET not configured - security disabled")
            return False
        
        if len(secret) < 32:
            logger.error("WORKER_SECRET must be at least 32 characters")
            return False
        
        # Derive 256-bit key from secret using SHA-256 (matches Node.js)
        self._worker_secret = hashlib.sha256(secret.encode()).digest()
        
        # Derive encryption key (separate from signing key)
        encryption_salt = 'fmd-encryption-v1'
        self._encryption_key = hashlib.sha256(
            (encryption_key_str + encryption_salt).encode()
        ).digest()
        
        self._is_initialized = True
        logger.info("Unified security initialized")
        
        return True
    
    def is_available(self) -> bool:
        """Check if security service is available"""
        return self._is_initialized and self._worker_secret is not None
    
    # =========================================================================
    # Task Signing
    # =========================================================================
    
    def sign_task(
        self, 
        task: Dict[str, Any], 
        encrypt_sensitive: bool = True
    ) -> Dict[str, Any]:
        """
        Sign a task for transmission to Node.js.
        
        Args:
            task: Task dictionary with id, type, account_id, data, etc.
            encrypt_sensitive: Whether to encrypt the data payload
        
        Returns:
            Signed task with signature, timestamp, nonce, protocol_version
        """
        if not self.is_available():
            raise RuntimeError("Security service not initialized")
        
        # Generate timestamp and nonce
        timestamp = int(time.time() * 1000)  # milliseconds
        nonce = secrets.token_hex(16)
        
        # Prepare data
        data_to_include = task.get('data', {})
        encrypted_payload = None
        
        if encrypt_sensitive and data_to_include:
            encrypted_payload = self._encrypt_payload(json.dumps(data_to_include))
            data_to_include = {'encrypted': True}
        
        # Compute hash of original data for signature (before encryption)
        original_data = task.get('data', {})
        data_hash = hashlib.sha256(
            json.dumps(original_data, sort_keys=True).encode()
        ).hexdigest()
        
        # Create signing string (MUST match Node.js)
        signing_string = self._create_signing_string(
            task_id=task.get('id', task.get('task_id', '')),
            task_type=task.get('type', ''),
            account_id=task.get('account_id', ''),
            timestamp=timestamp,
            nonce=nonce,
            data_hash=data_hash
        )
        
        # Generate HMAC-SHA256 signature
        signature = hmac.new(
            self._worker_secret,
            signing_string.encode(),
            hashlib.sha256
        ).hexdigest()
        
        signed_task = {
            'task_id': task.get('id', task.get('task_id', '')),
            'type': task.get('type', ''),
            'account_id': task.get('account_id', ''),
            'data': data_to_include,
            'data_hash': data_hash,  # Include hash for verification
            'priority': task.get('priority', 'normal'),
            'created_at': task.get('created_at', datetime.utcnow().isoformat()),
            'retry_count': task.get('retry_count', 0),
            'signature': signature,
            'timestamp': timestamp,
            'nonce': nonce,
            'protocol_version': SECURITY_PROTOCOL_VERSION,
        }
        
        if encrypted_payload:
            signed_task['encrypted_payload'] = encrypted_payload
        
        return signed_task
    
    def verify_task(self, signed_task: Dict[str, Any]) -> VerificationResult:
        """
        Verify a task signature from Node.js.
        
        Args:
            signed_task: Task with signature, timestamp, nonce, etc.
        
        Returns:
            VerificationResult with valid flag and decrypted task
        """
        if not self.is_available():
            return VerificationResult(valid=False, error="Security service not initialized")
        
        try:
            # Check protocol version
            protocol = signed_task.get('protocol_version', '')
            if protocol != SECURITY_PROTOCOL_VERSION:
                return VerificationResult(
                    valid=False, 
                    error=f"Protocol version mismatch: {protocol}"
                )
            
            # Check timestamp (within 5 minutes)
            timestamp = signed_task.get('timestamp', 0)
            now_ms = int(time.time() * 1000)
            age = now_ms - timestamp
            
            if age > MAX_SIGNATURE_AGE_MS:
                return VerificationResult(valid=False, error="Signature expired")
            if age < -60000:  # Allow 1 minute clock skew
                return VerificationResult(valid=False, error="Timestamp in future")
            
            # Check nonce (prevent replay)
            task_id = signed_task.get('task_id', '')
            nonce = signed_task.get('nonce', '')
            nonce_key = f"{task_id}:{nonce}"
            
            if nonce_key in _used_nonces:
                return VerificationResult(
                    valid=False, 
                    error="Nonce already used (replay attack?)"
                )
            
            # Get the data hash from the signed task
            data_hash = signed_task.get('data_hash', '')
            
            # Recreate signing string (include data_hash)
            signing_string = self._create_signing_string(
                task_id=task_id,
                task_type=signed_task.get('type', ''),
                account_id=signed_task.get('account_id', ''),
                timestamp=timestamp,
                nonce=nonce,
                data_hash=data_hash
            )
            
            # Verify signature using constant-time comparison
            expected_signature = hmac.new(
                self._worker_secret,
                signing_string.encode(),
                hashlib.sha256
            ).hexdigest()
            
            if not hmac.compare_digest(
                signed_task.get('signature', ''), 
                expected_signature
            ):
                return VerificationResult(valid=False, error="Invalid signature")
            
            # Mark nonce as used
            _used_nonces[nonce_key] = time.time()
            
            # Decrypt payload if encrypted
            decrypted_data = signed_task.get('data', {})
            if signed_task.get('encrypted_payload'):
                decrypted_json = self._decrypt_payload(signed_task['encrypted_payload'])
                decrypted_data = json.loads(decrypted_json)
            
            # Verify data integrity (for non-encrypted data)
            if not signed_task.get('encrypted_payload') and data_hash:
                actual_hash = hashlib.sha256(
                    json.dumps(decrypted_data, sort_keys=True).encode()
                ).hexdigest()
                if actual_hash != data_hash:
                    return VerificationResult(
                        valid=False, 
                        error="Data integrity check failed (data tampered?)"
                    )
            
            # Return verified task
            return VerificationResult(
                valid=True,
                task={
                    'id': task_id,
                    'type': signed_task.get('type', ''),
                    'account_id': signed_task.get('account_id', ''),
                    'data': decrypted_data,
                    'priority': signed_task.get('priority', 'normal'),
                    'created_at': signed_task.get('created_at', ''),
                    'retry_count': signed_task.get('retry_count', 0),
                }
            )
            
        except Exception as e:
            logger.error("Task verification failed", error=str(e))
            return VerificationResult(valid=False, error=f"Verification failed: {str(e)}")
    
    def _create_signing_string(
        self,
        task_id: str,
        task_type: str,
        account_id: str,
        timestamp: int,
        nonce: str,
        data_hash: str = ''
    ) -> str:
        """Create deterministic signing string (MUST match Node.js)"""
        # Include data hash to prevent tampering with task data
        return '|'.join([
            task_id,
            task_type,
            account_id,
            str(timestamp),
            nonce,
            data_hash
        ])
    
    # =========================================================================
    # Encryption
    # =========================================================================
    
    def _encrypt_payload(self, plaintext: str) -> str:
        """
        Encrypt payload using AES-256-GCM.
        
        Returns: "iv_base64:auth_tag_base64:ciphertext_base64"
        """
        iv = secrets.token_bytes(12)  # 96-bit IV for GCM
        aesgcm = AESGCM(self._encryption_key)
        
        ciphertext = aesgcm.encrypt(iv, plaintext.encode(), None)
        
        # Split ciphertext and auth tag (last 16 bytes)
        encrypted = ciphertext[:-16]
        auth_tag = ciphertext[-16:]
        
        return ':'.join([
            base64.b64encode(iv).decode(),
            base64.b64encode(auth_tag).decode(),
            base64.b64encode(encrypted).decode()
        ])
    
    def _decrypt_payload(self, encrypted_str: str) -> str:
        """
        Decrypt payload using AES-256-GCM.
        
        Args:
            encrypted_str: "iv_base64:auth_tag_base64:ciphertext_base64"
        """
        parts = encrypted_str.split(':')
        if len(parts) != 3:
            raise ValueError("Invalid encrypted payload format")
        
        iv = base64.b64decode(parts[0])
        auth_tag = base64.b64decode(parts[1])
        ciphertext = base64.b64decode(parts[2])
        
        # Reconstruct ciphertext with auth tag
        full_ciphertext = ciphertext + auth_tag
        
        aesgcm = AESGCM(self._encryption_key)
        plaintext = aesgcm.decrypt(iv, full_ciphertext, None)
        
        return plaintext.decode()
    
    # =========================================================================
    # Input Validation (matches Node.js)
    # =========================================================================
    
    def contains_dangerous_content(self, value: str) -> bool:
        """Check if string contains dangerous patterns"""
        if not value or not isinstance(value, str):
            return False
        
        for pattern in DANGEROUS_PATTERNS:
            if pattern.search(value):
                return True
        return False
    
    def validate_account_id(self, account_id: str) -> bool:
        """Validate account ID format"""
        if not account_id or not isinstance(account_id, str):
            return False
        if self.contains_dangerous_content(account_id):
            return False
        return bool(ACCOUNT_ID_PATTERN.match(account_id))
    
    def validate_task_id(self, task_id: str) -> bool:
        """Validate task ID format"""
        if not task_id or not isinstance(task_id, str):
            return False
        return bool(TASK_ID_PATTERN.match(task_id))
    
    def validate_task_data(self, data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Validate task data structure.
        
        Returns: (is_valid, error_message)
        """
        if not isinstance(data, dict):
            return False, "Task data must be a dictionary"
        
        def check_value(val: Any, path: str) -> Optional[str]:
            if isinstance(val, str):
                if self.contains_dangerous_content(val):
                    return f"Dangerous content detected at {path}"
            elif isinstance(val, list):
                for i, item in enumerate(val):
                    result = check_value(item, f"{path}[{i}]")
                    if result:
                        return result
            elif isinstance(val, dict):
                for k, v in val.items():
                    result = check_value(v, f"{path}.{k}")
                    if result:
                        return result
            return None
        
        danger = check_value(data, 'data')
        if danger:
            return False, danger
        
        return True, None
    
    def sanitize_string(self, value: str, max_length: int = 1000) -> str:
        """Sanitize string input"""
        if not value or not isinstance(value, str):
            return ''
        
        # Truncate
        sanitized = value[:max_length]
        
        # Remove null bytes
        sanitized = sanitized.replace('\x00', '')
        
        # Remove control characters (except newlines/tabs)
        sanitized = ''.join(
            c for c in sanitized 
            if c.isprintable() or c in '\n\t\r'
        )
        
        return sanitized.strip()
    
    # =========================================================================
    # Security Events
    # =========================================================================
    
    def log_security_event(
        self,
        event_type: str,
        severity: str,
        details: Dict[str, Any]
    ):
        """Log a security event"""
        event = {
            'timestamp': datetime.utcnow().isoformat(),
            'event_type': event_type,
            'severity': severity,
            **details
        }
        
        if severity in ('critical', 'high'):
            logger.error("Security Event", **event)
        elif severity == 'medium':
            logger.warning("Security Event", **event)
        else:
            logger.info("Security Event", **event)
    
    def generate_task_id(self, prefix: str = 'task') -> str:
        """Generate a secure task ID"""
        timestamp = hex(int(time.time()))[2:]
        random_part = secrets.token_hex(8)
        return f"{prefix}_{timestamp}{random_part}"


def cleanup_nonces():
    """Cleanup expired nonces to prevent memory growth"""
    cutoff = time.time() - (MAX_SIGNATURE_AGE_MS / 1000)
    expired = [key for key, ts in _used_nonces.items() if ts < cutoff]
    for key in expired:
        del _used_nonces[key]
    if expired:
        logger.debug(f"Cleaned {len(expired)} expired nonces")


# Singleton instance
_security_instance: Optional[UnifiedSecurity] = None


def get_unified_security() -> UnifiedSecurity:
    """Get or create the unified security singleton"""
    global _security_instance
    if _security_instance is None:
        _security_instance = UnifiedSecurity()
        _security_instance.initialize()
    return _security_instance


# Auto-cleanup nonces periodically (should be called from event loop)
async def start_nonce_cleanup_task():
    """Start background task to cleanup nonces"""
    import asyncio
    while True:
        await asyncio.sleep(60)
        cleanup_nonces()
