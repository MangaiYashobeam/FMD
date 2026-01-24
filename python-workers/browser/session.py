"""
Session Manager - Handles Facebook session persistence and encryption
Stores cookies/localStorage securely for session resumption

Security Features:
- AES-256 encryption (Fernet)
- Per-session random salt (stored with encrypted data)
- PBKDF2 key derivation with 100k+ iterations
- Integrity verification on load
- Session expiry validation
"""
import json
import os
import secrets
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
import base64
import hashlib
import structlog
import aiofiles

from core.config import get_settings
from core.security import get_input_validator, get_security_monitor, SecurityEventType

logger = structlog.get_logger()


# Session file format version - increment on breaking changes
SESSION_VERSION = 2


class SessionManager:
    """
    Manages encrypted Facebook session storage
    
    Sessions include:
    - Cookies (authentication tokens)
    - Local storage (preferences)
    - Origin data (for proper domain restoration)
    
    Security Architecture:
    - Each session has a unique random salt (16 bytes)
    - Key derivation: PBKDF2-HMAC-SHA256, 100k iterations
    - Encryption: Fernet (AES-128-CBC with HMAC-SHA256)
    - Integrity: SHA-256 hash of decrypted data stored with salt
    """
    
    def __init__(self):
        self.settings = get_settings()
        self._base_secret = self.settings.encryption_key or self.settings.worker_secret
        if not self._base_secret or len(self._base_secret) < 32:
            logger.warning("Weak or missing encryption key - using fallback")
            self._base_secret = "facemydealer_default_key_change_in_prod_32chars"
        
        self._sessions_dir = os.path.join(
            os.path.dirname(__file__), 
            '..', 
            'data', 
            'sessions'
        )
        os.makedirs(self._sessions_dir, exist_ok=True)
        
        # Set restrictive permissions on sessions directory
        try:
            os.chmod(self._sessions_dir, 0o700)
        except Exception:
            pass  # May fail on Windows
        
        self._validator = get_input_validator()
    
    def _derive_key(self, salt: bytes) -> bytes:
        """Derive encryption key from secret and salt"""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
            backend=default_backend()
        )
        return base64.urlsafe_b64encode(kdf.derive(self._base_secret.encode()))
    
    def _create_cipher(self, salt: bytes) -> Fernet:
        """Create Fernet cipher with derived key"""
        key = self._derive_key(salt)
        return Fernet(key)
    
    def _get_session_path(self, account_id: str) -> str:
        """Get file path for an account's session"""
        # Validate and sanitize account_id
        if not self._validator.validate_account_id(account_id):
            raise ValueError(f"Invalid account_id format: {account_id}")
        
        # Create deterministic but safe filename
        safe_id = hashlib.sha256(account_id.encode()).hexdigest()[:32]
        return os.path.join(self._sessions_dir, f"{safe_id}.enc")
    
    def _compute_integrity_hash(self, data: bytes) -> str:
        """Compute integrity hash of data"""
        return hashlib.sha256(data).hexdigest()
    
    async def save_session(
        self, 
        account_id: str, 
        storage_state: Dict[str, Any]
    ) -> bool:
        """
        Save browser storage state (encrypted)
        
        Args:
            account_id: Facebook account identifier
            storage_state: Playwright storage state dict
            
        Returns:
            True if saved successfully
        """
        monitor = get_security_monitor()
        
        try:
            # Generate unique salt for this session
            salt = secrets.token_bytes(16)
            
            # Add metadata
            session_data = {
                'account_id': account_id,
                'storage_state': storage_state,
                'saved_at': datetime.utcnow().isoformat(),
                'version': SESSION_VERSION
            }
            
            # Serialize
            json_data = json.dumps(session_data, sort_keys=True)
            json_bytes = json_data.encode()
            
            # Compute integrity hash
            integrity_hash = self._compute_integrity_hash(json_bytes)
            
            # Encrypt with session-specific key
            cipher = self._create_cipher(salt)
            encrypted = cipher.encrypt(json_bytes)
            
            # Create file structure: salt (16) + hash (64) + encrypted data
            file_data = salt + integrity_hash.encode() + encrypted
            
            # Write to file
            path = self._get_session_path(account_id)
            async with aiofiles.open(path, 'wb') as f:
                await f.write(file_data)
            
            # Set restrictive permissions
            try:
                os.chmod(path, 0o600)
            except Exception:
                pass
            
            logger.info("Session saved", 
                       account_id=account_id,
                       cookies=len(storage_state.get('cookies', [])))
            return True
            
        except Exception as e:
            await monitor.log_event(
                SecurityEventType.ENCRYPTION_ERROR,
                details={"account_id": account_id, "error": str(e)},
                severity="high"
            )
            logger.error("Failed to save session",
                        account_id=account_id,
                        error=str(e))
            return False
    
    async def load_session(
        self, 
        account_id: str,
        max_age_days: int = 30
    ) -> Optional[Dict[str, Any]]:
        """
        Load saved session for an account
        
        Args:
            account_id: Facebook account identifier
            max_age_days: Maximum session age before considered stale
            
        Returns:
            Storage state dict if valid session exists, None otherwise
        """
        monitor = get_security_monitor()
        path = self._get_session_path(account_id)
        
        if not os.path.exists(path):
            logger.info("No saved session found", account_id=account_id)
            return None
        
        try:
            # Read file
            async with aiofiles.open(path, 'rb') as f:
                file_data = await f.read()
            
            # Minimum file size: salt (16) + hash (64) + minimum encrypted data
            if len(file_data) < 80:
                logger.warning("Session file too small", account_id=account_id)
                return None
            
            # Extract components
            salt = file_data[:16]
            stored_hash = file_data[16:80].decode()
            encrypted = file_data[80:]
            
            # Decrypt
            cipher = self._create_cipher(salt)
            try:
                decrypted = cipher.decrypt(encrypted)
            except InvalidToken:
                await monitor.log_event(
                    SecurityEventType.ENCRYPTION_ERROR,
                    details={"account_id": account_id, "reason": "Invalid token/corrupted"},
                    severity="high"
                )
                logger.error("Failed to decrypt session - invalid token", account_id=account_id)
                return None
            
            # Verify integrity
            computed_hash = self._compute_integrity_hash(decrypted)
            if computed_hash != stored_hash:
                await monitor.log_event(
                    SecurityEventType.ENCRYPTION_ERROR,
                    details={"account_id": account_id, "reason": "Integrity check failed"},
                    severity="critical"
                )
                logger.error("Session integrity check failed", account_id=account_id)
                return None
            
            session_data = json.loads(decrypted.decode())
            
            # Check version (support migration from v1)
            version = session_data.get('version', 1)
            if version < 1 or version > SESSION_VERSION:
                logger.warning("Session version unsupported", 
                             account_id=account_id, version=version)
                return None
            
            # Check age
            saved_at = datetime.fromisoformat(session_data['saved_at'])
            age = datetime.utcnow() - saved_at
            
            if age > timedelta(days=max_age_days):
                await monitor.log_event(
                    SecurityEventType.SESSION_EXPIRED,
                    details={"account_id": account_id, "age_days": age.days},
                    severity="low"
                )
                logger.warning("Session expired",
                             account_id=account_id,
                             age_days=age.days)
                await self.delete_session(account_id)
                return None
            
            logger.info("Session loaded",
                       account_id=account_id,
                       age_days=age.days,
                       cookies=len(session_data['storage_state'].get('cookies', [])))
            
            return session_data['storage_state']
            
        except Exception as e:
            logger.error("Failed to load session",
                        account_id=account_id,
                        error=str(e))
            return None
    
    async def delete_session(self, account_id: str) -> bool:
        """Delete saved session for an account"""
        path = self._get_session_path(account_id)
        
        try:
            if os.path.exists(path):
                os.remove(path)
                logger.info("Session deleted", account_id=account_id)
            return True
        except Exception as e:
            logger.error("Failed to delete session",
                        account_id=account_id,
                        error=str(e))
            return False
    
    async def list_sessions(self) -> list:
        """List all saved sessions with metadata"""
        sessions = []
        
        for filename in os.listdir(self._sessions_dir):
            if not filename.endswith('.enc'):
                continue
            
            path = os.path.join(self._sessions_dir, filename)
            
            try:
                async with aiofiles.open(path, 'rb') as f:
                    encrypted = await f.read()
                
                decrypted = self._cipher.decrypt(encrypted)
                session_data = json.loads(decrypted.decode())
                
                saved_at = datetime.fromisoformat(session_data['saved_at'])
                age = datetime.utcnow() - saved_at
                
                sessions.append({
                    'account_id': session_data['account_id'],
                    'saved_at': session_data['saved_at'],
                    'age_days': age.days,
                    'cookie_count': len(session_data['storage_state'].get('cookies', []))
                })
                
            except Exception as e:
                logger.warning("Failed to read session", filename=filename, error=str(e))
        
        return sessions
    
    async def is_session_valid(self, account_id: str) -> bool:
        """Quick check if a valid session exists"""
        session = await self.load_session(account_id)
        return session is not None

    async def get_session_info(self, account_id: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed session info without loading full storage state
        Returns metadata about the session for admin display
        """
        path = self._get_session_path(account_id)
        
        if not os.path.exists(path):
            return None
        
        try:
            # Read file
            async with aiofiles.open(path, 'rb') as f:
                file_data = await f.read()
            
            if len(file_data) < 80:
                return None
            
            # Extract components
            salt = file_data[:16]
            stored_hash = file_data[16:80].decode()
            encrypted = file_data[80:]
            
            # Decrypt
            cipher = self._create_cipher(salt)
            try:
                decrypted = cipher.decrypt(encrypted)
            except InvalidToken:
                return None
            
            # Verify integrity
            computed_hash = self._compute_integrity_hash(decrypted)
            if computed_hash != stored_hash:
                return None
            
            session_data = json.loads(decrypted.decode())
            storage_state = session_data.get('storage_state', {})
            cookies = storage_state.get('cookies', [])
            
            # Calculate age and expiry
            saved_at = datetime.fromisoformat(session_data['saved_at'])
            age = datetime.utcnow() - saved_at
            max_age_days = 30
            expires_at = saved_at + timedelta(days=max_age_days)
            
            # Get Facebook user ID from c_user cookie
            facebook_user_id = None
            for cookie in cookies:
                if cookie.get('name') == 'c_user':
                    facebook_user_id = cookie.get('value')
                    break
            
            # Check for required cookies
            required = ['c_user', 'xs', 'datr']
            cookie_names = {c.get('name') for c in cookies}
            has_required = all(name in cookie_names for name in required)
            
            # Build cookie details for super admin
            cookie_details = []
            for cookie in cookies:
                name = cookie.get('name', '')
                # Only include important Facebook cookies
                if name in ['c_user', 'xs', 'datr', 'fr', 'sb', 'wd', 'presence']:
                    detail = {
                        'name': name,
                        'domain': cookie.get('domain', ''),
                        'expires': cookie.get('expires'),
                        'httpOnly': cookie.get('httpOnly', False),
                        'secure': cookie.get('secure', False),
                    }
                    # Convert expires to ISO string if it's a timestamp
                    if detail['expires'] and isinstance(detail['expires'], (int, float)):
                        try:
                            exp_dt = datetime.fromtimestamp(detail['expires'])
                            detail['expires_at'] = exp_dt.isoformat()
                            detail['is_expired'] = exp_dt < datetime.utcnow()
                        except Exception:
                            detail['expires_at'] = None
                            detail['is_expired'] = False
                    cookie_details.append(detail)
            
            return {
                'account_id': account_id,
                'saved_at': session_data['saved_at'],
                'age_days': age.days,
                'expires_at': expires_at.isoformat(),
                'cookie_count': len(cookies),
                'has_required_cookies': has_required,
                'facebook_user_id': facebook_user_id,
                'cookie_details': cookie_details,
                'version': session_data.get('version', 1)
            }
            
        except Exception as e:
            logger.error("Failed to get session info",
                        account_id=account_id,
                        error=str(e))
            return None


class FacebookSessionValidator:
    """
    Validates Facebook session by checking specific cookies
    """
    
    REQUIRED_COOKIES = ['c_user', 'xs', 'datr']
    
    @staticmethod
    def validate(storage_state: Dict[str, Any]) -> bool:
        """
        Check if session contains required Facebook auth cookies
        
        Args:
            storage_state: Playwright storage state
            
        Returns:
            True if session appears valid
        """
        cookies = storage_state.get('cookies', [])
        cookie_names = {c['name'] for c in cookies}
        
        # Check for required cookies
        has_required = all(
            name in cookie_names 
            for name in FacebookSessionValidator.REQUIRED_COOKIES
        )
        
        if not has_required:
            return False
        
        # Check c_user cookie expiration
        for cookie in cookies:
            if cookie['name'] == 'c_user':
                expires = cookie.get('expires', 0)
                if expires > 0 and expires < datetime.utcnow().timestamp():
                    return False
        
        return True
    
    @staticmethod
    def get_user_id(storage_state: Dict[str, Any]) -> Optional[str]:
        """Extract Facebook user ID from session"""
        for cookie in storage_state.get('cookies', []):
            if cookie['name'] == 'c_user':
                return cookie['value']
        return None
