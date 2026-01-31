/**
 * Session Security Service
 * =========================
 * 
 * Handles encryption/decryption of Facebook session cookies and TOTP secrets.
 * Uses AES-256-GCM for authenticated encryption with per-record salts.
 * 
 * SECURITY NOTES:
 * - All session data is encrypted at rest
 * - Per-session random salt (16 bytes)
 * - PBKDF2 key derivation (100k iterations)
 * - GCM provides integrity verification
 * - TOTP secrets are never logged or exposed
 */

import crypto from 'crypto';
import { OTP } from 'otplib';
import QRCode from 'qrcode';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';

// Create OTP instance for TOTP operations
const otp = new OTP({ strategy: 'totp' });

// Configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const IV_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;

// Master encryption key from environment - CRITICAL: must be configured in production
function getMasterKey(): string {
  const key = process.env.SESSION_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: SESSION_ENCRYPTION_KEY or JWT_SECRET must be set in production!');
    }
    // Development fallback with warning
    console.warn('⚠️  Using insecure default encryption key - NOT FOR PRODUCTION');
    return 'dev-only-insecure-key-change-in-production';
  }
  return key;
}
const MASTER_KEY = getMasterKey();

// Types
export interface EncryptedData {
  encrypted: string;
  salt: string;
  iv: string;
  authTag: string;
}

export interface FbCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
}

export interface StorageState {
  cookies: FbCookie[];
  origins?: Array<{
    origin: string;
    localStorage?: Array<{ name: string; value: string }>;
  }>;
  timestamp?: number;
}

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  fbUserId?: string;
  expiresAt?: Date;
  recommendations?: string[];
}

export interface TotpSetupResult {
  secret: string;
  qrCodeDataUrl: string;
  manualEntryKey: string;
  backupCodes: string[];
}

export interface SecurityEvent {
  type: SessionSecurityEventType;
  accountId: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export enum SessionSecurityEventType {
  SESSION_CAPTURED = 'session_captured',
  SESSION_SYNCED = 'session_synced',
  SESSION_EXPIRED = 'session_expired',
  SESSION_REVOKED = 'session_revoked',
  SESSION_VALIDATED = 'session_validated',
  SESSION_VALIDATION_FAILED = 'session_validation_failed',
  TOTP_SETUP = 'totp_setup',
  TOTP_VERIFIED = 'totp_verified',
  TOTP_RECOVERY_USED = 'totp_recovery_used',
  TOTP_RECOVERY_FAILED = 'totp_recovery_failed',
  TOTP_LOCKED = 'totp_locked',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity'
}

class SessionSecurityService {
  // ============================================
  // Encryption / Decryption
  // ============================================

  /**
   * Derive encryption key from master key and salt using PBKDF2
   */
  private async deriveKey(salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        MASTER_KEY,
        salt,
        PBKDF2_ITERATIONS,
        KEY_LENGTH,
        'sha256',
        (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey);
        }
      );
    });
  }

  /**
   * Encrypt data using AES-256-GCM
   * AuthTag is appended to the encrypted data (standard pattern for storage without separate authTag column)
   */
  async encrypt(plaintext: string): Promise<EncryptedData> {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = await this.deriveKey(salt);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    
    // Append authTag to encrypted data (format: encrypted:authTag)
    const encryptedWithTag = encrypted + ':' + authTag.toString('base64');

    return {
      encrypted: encryptedWithTag,
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64')  // Also return separately for compatibility
    };
  }

  /**
   * Decrypt data using AES-256-GCM
   * Handles both old format (authTag passed separately) and new format (authTag appended to encrypted)
   */
  async decrypt(data: EncryptedData): Promise<string> {
    const salt = Buffer.from(data.salt, 'base64');
    const iv = Buffer.from(data.iv, 'base64');
    const key = await this.deriveKey(salt);
    
    let encrypted = data.encrypted;
    let authTag: Buffer;
    
    // Check if authTag is embedded in encrypted data (new format: encrypted:authTag)
    if (data.encrypted.includes(':')) {
      const parts = data.encrypted.split(':');
      encrypted = parts[0];
      authTag = Buffer.from(parts[1], 'base64');
    } else if (data.authTag && data.authTag.length > 0) {
      // Old format: authTag passed separately
      authTag = Buffer.from(data.authTag, 'base64');
    } else {
      throw new Error('No authentication tag found - cannot decrypt');
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // ============================================
  // Session Encryption
  // ============================================

  /**
   * Encrypt session cookies for storage
   */
  async encryptSession(cookies: FbCookie[]): Promise<EncryptedData> {
    const sessionData = JSON.stringify(cookies);
    return this.encrypt(sessionData);
  }

  /**
   * Decrypt session cookies
   */
  async decryptSession(encryptedData: EncryptedData): Promise<FbCookie[]> {
    const decrypted = await this.decrypt(encryptedData);
    return JSON.parse(decrypted);
  }

  /**
   * Encrypt storage state (cookies + localStorage)
   */
  async encryptStorageState(state: StorageState): Promise<{
    encryptedCookies: EncryptedData;
    encryptedLocalStorage?: EncryptedData;
  }> {
    const encryptedCookies = await this.encrypt(JSON.stringify(state.cookies));
    
    let encryptedLocalStorage: EncryptedData | undefined;
    if (state.origins && state.origins.length > 0) {
      encryptedLocalStorage = await this.encrypt(JSON.stringify(state.origins));
    }

    return { encryptedCookies, encryptedLocalStorage };
  }

  /**
   * Decrypt storage state
   */
  async decryptStorageState(
    encryptedCookies: EncryptedData,
    encryptedLocalStorage?: EncryptedData
  ): Promise<StorageState> {
    const cookies = JSON.parse(await this.decrypt(encryptedCookies));
    
    let origins;
    if (encryptedLocalStorage) {
      origins = JSON.parse(await this.decrypt(encryptedLocalStorage));
    }

    return { cookies, origins };
  }

  // ============================================
  // Cookie Validation
  // ============================================

  /**
   * Validate cookies are for Facebook and contain required data
   */
  validateCookies(cookies: FbCookie[]): ValidationResult {
    const requiredCookies = ['c_user', 'xs', 'datr'];
    const fbCookies = cookies.filter(c => 
      c.domain?.includes('facebook.com') || c.domain?.includes('.facebook.com')
    );

    if (fbCookies.length === 0) {
      return {
        isValid: false,
        reason: 'No Facebook cookies found'
      };
    }

    const missingCookies = requiredCookies.filter(name =>
      !fbCookies.some(c => c.name === name)
    );

    if (missingCookies.length > 0) {
      return {
        isValid: false,
        reason: `Missing required cookies: ${missingCookies.join(', ')}`
      };
    }

    // Extract user ID from c_user cookie
    const cUserCookie = fbCookies.find(c => c.name === 'c_user');
    const fbUserId = cUserCookie?.value;

    // Check for near-expiry cookies
    const now = Date.now() / 1000;
    const sevenDays = 7 * 24 * 60 * 60;
    const nearExpiryCookies = fbCookies.filter(c => 
      c.expires && c.expires - now < sevenDays
    );

    const recommendations: string[] = [];
    if (nearExpiryCookies.length > 0) {
      recommendations.push('Some cookies will expire soon. Consider refreshing your session.');
    }

    // Find earliest expiry
    const expiries = fbCookies
      .filter(c => c.expires)
      .map(c => c.expires!);
    const earliestExpiry = expiries.length > 0 
      ? new Date(Math.min(...expiries) * 1000)
      : undefined;

    return {
      isValid: true,
      fbUserId,
      expiresAt: earliestExpiry,
      recommendations
    };
  }

  /**
   * Validate a stored session is still valid
   */
  async validateSession(sessionId: string): Promise<ValidationResult> {
    try {
      const session = await prisma.fbSession.findUnique({
        where: { id: sessionId }
      });

      if (!session) {
        return { isValid: false, reason: 'Session not found' };
      }

      if (session.sessionStatus !== 'ACTIVE') {
        return { 
          isValid: false, 
          reason: `Session status is ${session.sessionStatus}` 
        };
      }

      // Decrypt and validate cookies
      const encryptedData: EncryptedData = {
        encrypted: session.encryptedCookies,
        salt: session.encryptionSalt,
        iv: session.encryptionIv,
        authTag: '' // We store salt and iv together with the encrypted data
      };

      // For this implementation, we store authTag as part of the encrypted data
      // You may need to adjust based on actual storage format
      const cookies = await this.decryptSession(encryptedData);
      const validation = this.validateCookies(cookies);

      // Update last validated timestamp
      await prisma.fbSession.update({
        where: { id: sessionId },
        data: { 
          lastValidatedAt: new Date(),
          validationCount: { increment: 1 }
        }
      });

      return validation;
    } catch (error) {
      logger.error('Session validation error:', error);
      return { 
        isValid: false, 
        reason: 'Failed to validate session' 
      };
    }
  }

  // ============================================
  // TOTP (2FA) Functions
  // ============================================

  /**
   * Generate a new TOTP secret
   */
  async generateTotpSecret(accountName: string, _fbUserId?: string): Promise<TotpSetupResult> {
    const secret = otp.generateSecret();
    const issuer = 'DealersFace';
    
    // Generate QR code using OTP URI
    const otpauth = otp.generateURI({ issuer, label: accountName, secret });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

    // Generate backup codes
    const backupCodes = Array.from({ length: 8 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    return {
      secret,
      qrCodeDataUrl,
      manualEntryKey: secret,
      backupCodes
    };
  }

  /**
   * Encrypt TOTP secret for storage
   */
  async encryptTotpSecret(secret: string): Promise<EncryptedData> {
    return this.encrypt(secret);
  }

  /**
   * Decrypt TOTP secret
   */
  async decryptTotpSecret(encryptedData: EncryptedData): Promise<string> {
    return this.decrypt(encryptedData);
  }

  /**
   * Generate current TOTP code
   */
  async generateTotpCode(accountId: string): Promise<string | null> {
    try {
      const totpSecret = await prisma.fbTotpSecret.findUnique({
        where: { accountId }
      });

      if (!totpSecret || !totpSecret.isVerified) {
        return null;
      }

      if (totpSecret.isLocked) {
        const now = new Date();
        if (totpSecret.lockedUntil && totpSecret.lockedUntil > now) {
          logger.warn('TOTP secret is locked', { accountId });
          return null;
        }
        // Unlock if lock has expired
        await prisma.fbTotpSecret.update({
          where: { id: totpSecret.id },
          data: { isLocked: false, lockedUntil: null }
        });
      }

      // Decrypt secret
      const secret = await this.decryptTotpSecret({
        encrypted: totpSecret.encryptedSecret,
        salt: totpSecret.encryptionSalt,
        iv: totpSecret.encryptionIv,
        authTag: '' // Adjust based on storage format
      });

      // Generate code using OTP class
      const code = await otp.generate({ secret });

      // Update usage tracking
      await prisma.fbTotpSecret.update({
        where: { id: totpSecret.id },
        data: {
          lastUsedAt: new Date(),
          useCount: { increment: 1 }
        }
      });

      return code;
    } catch (error) {
      logger.error('TOTP code generation error:', error);
      return null;
    }
  }

  /**
   * Verify a TOTP code
   */
  async verifyTotpCode(accountId: string, code: string): Promise<boolean> {
    try {
      const totpSecret = await prisma.fbTotpSecret.findUnique({
        where: { accountId }
      });

      if (!totpSecret) {
        return false;
      }

      // Check if locked
      if (totpSecret.isLocked) {
        const now = new Date();
        if (totpSecret.lockedUntil && totpSecret.lockedUntil > now) {
          return false;
        }
      }

      // Decrypt secret
      const secret = await this.decryptTotpSecret({
        encrypted: totpSecret.encryptedSecret,
        salt: totpSecret.encryptionSalt,
        iv: totpSecret.encryptionIv,
        authTag: ''
      });

      // Verify using OTP class
      const result = await otp.verify({ token: code, secret });
      const isValid = result.valid;

      if (isValid) {
        // Reset failed attempts on success
        await prisma.fbTotpSecret.update({
          where: { id: totpSecret.id },
          data: {
            isVerified: true,
            verifiedAt: totpSecret.verifiedAt || new Date(),
            failedAttempts: 0,
            isLocked: false,
            lockedUntil: null
          }
        });
      } else {
        // Increment failed attempts
        const newFailedAttempts = totpSecret.failedAttempts + 1;
        const shouldLock = newFailedAttempts >= 5;
        
        await prisma.fbTotpSecret.update({
          where: { id: totpSecret.id },
          data: {
            failedAttempts: newFailedAttempts,
            lastFailedAt: new Date(),
            isLocked: shouldLock,
            lockedUntil: shouldLock 
              ? new Date(Date.now() + 30 * 60 * 1000) // Lock for 30 minutes
              : null,
            lockReason: shouldLock ? 'Too many failed attempts' : null
          }
        });

        if (shouldLock) {
          await this.logSecurityEvent({
            type: SessionSecurityEventType.TOTP_LOCKED,
            accountId,
            details: { reason: 'Too many failed attempts' }
          });
        }
      }

      return isValid;
    } catch (error) {
      logger.error('TOTP verification error:', error);
      return false;
    }
  }

  // ============================================
  // Security Event Logging
  // ============================================

  /**
   * Log a security event
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: `security.${event.type}`,
          entityType: 'fb_session',
          entityId: event.accountId,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          metadata: event.details as Prisma.InputJsonValue
        }
      });

      // Log critical events
      if ([
        SessionSecurityEventType.SUSPICIOUS_ACTIVITY,
        SessionSecurityEventType.TOTP_LOCKED,
        SessionSecurityEventType.TOTP_RECOVERY_FAILED
      ].includes(event.type)) {
        logger.warn('Critical security event', {
          type: event.type,
          accountId: event.accountId,
          details: event.details
        });
      }
    } catch (error) {
      logger.error('Failed to log security event:', error);
    }
  }

  // ============================================
  // Session Management Utilities
  // ============================================

  /**
   * Extract Facebook user ID from cookies
   */
  extractFbUserId(cookies: FbCookie[]): string | null {
    const cUser = cookies.find(c => c.name === 'c_user');
    return cUser?.value || null;
  }

  /**
   * Estimate session expiry from cookies
   */
  estimateSessionExpiry(cookies: FbCookie[]): Date | null {
    const sessionCookies = cookies.filter(c => 
      ['c_user', 'xs'].includes(c.name) && c.expires
    );

    if (sessionCookies.length === 0) return null;

    const minExpiry = Math.min(...sessionCookies.map(c => c.expires!));
    return new Date(minExpiry * 1000);
  }

  /**
   * Check if session needs refresh (expires within 7 days)
   */
  sessionNeedsRefresh(expiresAt: Date | null): boolean {
    if (!expiresAt) return true;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return expiresAt.getTime() - Date.now() < sevenDays;
  }

  /**
   * Generate a secure browser fingerprint
   */
  generateBrowserFingerprint(userAgent: string, ipAddress?: string): string {
    const data = `${userAgent}|${ipAddress || 'unknown'}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
  }
}

// Export singleton instance
export const sessionSecurityService = new SessionSecurityService();
export default sessionSecurityService;
