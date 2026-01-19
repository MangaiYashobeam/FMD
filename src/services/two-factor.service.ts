/**
 * Two-Factor Authentication Service
 * TOTP-based 2FA for enhanced account security
 * 
 * Note: 2FA fields (twoFactorEnabled, twoFactorSecret, twoFactorBackupCodes)
 * are added via migration. Types will resolve after `npx prisma generate`.
 */

import crypto from 'crypto';
import prisma from '@/config/database';
import { logger } from '@/utils/logger';

// TOTP configuration
const TOTP_CONFIG = {
  digits: 6,
  period: 30, // seconds
  algorithm: 'SHA1',
  issuer: 'DealersFace',
};

// Base32 alphabet for encoding
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

class TwoFactorService {
  /**
   * Generate a new 2FA secret for a user
   */
  generateSecret(): { secret: string; otpAuthUrl: string; backupCodes: string[] } {
    // Generate 20 random bytes (160 bits) for the secret
    const secretBytes = crypto.randomBytes(20);
    const secret = this.base32Encode(secretBytes);
    
    // Generate backup codes
    const backupCodes = this.generateBackupCodes(10);
    
    // Generate otpauth URL for QR code
    const otpAuthUrl = `otpauth://totp/${TOTP_CONFIG.issuer}?secret=${secret}&issuer=${TOTP_CONFIG.issuer}&algorithm=${TOTP_CONFIG.algorithm}&digits=${TOTP_CONFIG.digits}&period=${TOTP_CONFIG.period}`;
    
    return { secret, otpAuthUrl, backupCodes };
  }

  /**
   * Generate backup codes for recovery
   */
  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric codes
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
  }

  /**
   * Verify a TOTP code
   */
  verifyCode(secret: string, code: string, window: number = 1): boolean {
    const secretBytes = this.base32Decode(secret);
    const now = Math.floor(Date.now() / 1000);
    const timeStep = Math.floor(now / TOTP_CONFIG.period);
    
    // Check current time step and adjacent windows
    for (let i = -window; i <= window; i++) {
      const expectedCode = this.generateTOTP(secretBytes, timeStep + i);
      if (code === expectedCode) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Generate TOTP code for a given time step
   */
  private generateTOTP(secretBytes: Buffer, timeStep: number): string {
    // Convert time step to 8-byte buffer (big-endian)
    const timeBuffer = Buffer.alloc(8);
    for (let i = 7; i >= 0; i--) {
      timeBuffer[i] = timeStep & 0xff;
      timeStep = Math.floor(timeStep / 256);
    }
    
    // Generate HMAC-SHA1
    const hmac = crypto.createHmac('sha1', secretBytes);
    hmac.update(timeBuffer);
    const hash = hmac.digest();
    
    // Dynamic truncation
    const offset = hash[hash.length - 1] & 0x0f;
    const binary = 
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);
    
    // Get 6-digit code
    const otp = binary % Math.pow(10, TOTP_CONFIG.digits);
    return otp.toString().padStart(TOTP_CONFIG.digits, '0');
  }

  /**
   * Base32 encode bytes
   */
  private base32Encode(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;

      while (bits >= 5) {
        output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
  }

  /**
   * Base32 decode string to bytes
   */
  private base32Decode(encoded: string): Buffer {
    const cleanedInput = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '');
    const output: number[] = [];
    let bits = 0;
    let value = 0;

    for (let i = 0; i < cleanedInput.length; i++) {
      const index = BASE32_ALPHABET.indexOf(cleanedInput[i]);
      if (index === -1) continue;
      
      value = (value << 5) | index;
      bits += 5;

      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(output);
  }

  /**
   * Enable 2FA for a user
   */
  async enable(userId: string, secret: string, verificationCode: string, backupCodes: string[]): Promise<boolean> {
    // Verify the code first
    if (!this.verifyCode(secret, verificationCode)) {
      return false;
    }
    
    try {
      // Hash backup codes before storing
      const hashedBackupCodes = backupCodes.map(code => 
        crypto.createHash('sha256').update(code).digest('hex')
      );
      
      // Store in database (using any to handle pending migration fields)
      await (prisma.user.update as any)({
        where: { id: userId },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: this.encryptSecret(secret),
          twoFactorBackupCodes: hashedBackupCodes,
        },
      });
      
      logger.info(`2FA enabled for user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Failed to enable 2FA', { error, userId });
      throw error;
    }
  }

  /**
   * Disable 2FA for a user
   */
  async disable(userId: string, verificationCode: string): Promise<boolean> {
    try {
      const user = await (prisma.user.findUnique as any)({
        where: { id: userId },
        select: { twoFactorSecret: true },
      });
      
      if (!user?.twoFactorSecret) {
        return false;
      }
      
      const secret = this.decryptSecret(user.twoFactorSecret);
      
      // Verify the code before disabling
      if (!this.verifyCode(secret, verificationCode)) {
        return false;
      }
      
      await (prisma.user.update as any)({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: [],
        },
      });
      
      logger.info(`2FA disabled for user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Failed to disable 2FA', { error, userId });
      throw error;
    }
  }

  /**
   * Verify 2FA code for login
   */
  async verify(userId: string, code: string): Promise<{ success: boolean; method: 'totp' | 'backup' | null }> {
    try {
      const user = await (prisma.user.findUnique as any)({
        where: { id: userId },
        select: { 
          twoFactorSecret: true, 
          twoFactorBackupCodes: true,
        },
      });
      
      if (!user?.twoFactorSecret) {
        return { success: false, method: null };
      }
      
      const secret = this.decryptSecret(user.twoFactorSecret);
      
      // Try TOTP first
      if (this.verifyCode(secret, code)) {
        return { success: true, method: 'totp' };
      }
      
      // Try backup codes
      const hashedCode = crypto.createHash('sha256').update(code.toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex');
      const backupCodes = user.twoFactorBackupCodes as string[];
      const codeIndex = backupCodes.indexOf(hashedCode);
      
      if (codeIndex !== -1) {
        // Remove used backup code
        const updatedCodes = [...backupCodes];
        updatedCodes.splice(codeIndex, 1);
        
        await (prisma.user.update as any)({
          where: { id: userId },
          data: { twoFactorBackupCodes: updatedCodes },
        });
        
        logger.warn(`Backup code used for user ${userId}. Remaining: ${updatedCodes.length}`);
        return { success: true, method: 'backup' };
      }
      
      return { success: false, method: null };
    } catch (error) {
      logger.error('Failed to verify 2FA', { error, userId });
      return { success: false, method: null };
    }
  }

  /**
   * Check if user has 2FA enabled
   */
  async isEnabled(userId: string): Promise<boolean> {
    const user = await (prisma.user.findUnique as any)({
      where: { id: userId },
      select: { twoFactorEnabled: true },
    });
    return user?.twoFactorEnabled ?? false;
  }

  /**
   * Generate new backup codes (regenerate)
   */
  async regenerateBackupCodes(userId: string, verificationCode: string): Promise<string[] | null> {
    try {
      const user = await (prisma.user.findUnique as any)({
        where: { id: userId },
        select: { twoFactorSecret: true },
      });
      
      if (!user?.twoFactorSecret) {
        return null;
      }
      
      const secret = this.decryptSecret(user.twoFactorSecret);
      
      // Verify the code first
      if (!this.verifyCode(secret, verificationCode)) {
        return null;
      }
      
      // Generate new backup codes
      const newBackupCodes = this.generateBackupCodes(10);
      const hashedBackupCodes = newBackupCodes.map(code => 
        crypto.createHash('sha256').update(code).digest('hex')
      );
      
      await (prisma.user.update as any)({
        where: { id: userId },
        data: { twoFactorBackupCodes: hashedBackupCodes },
      });
      
      logger.info(`Backup codes regenerated for user ${userId}`);
      return newBackupCodes;
    } catch (error) {
      logger.error('Failed to regenerate backup codes', { error, userId });
      throw error;
    }
  }

  /**
   * Get remaining backup code count
   */
  async getBackupCodeCount(userId: string): Promise<number> {
    const user = await (prisma.user.findUnique as any)({
      where: { id: userId },
      select: { twoFactorBackupCodes: true },
    });
    return (user?.twoFactorBackupCodes as string[])?.length ?? 0;
  }

  /**
   * Encrypt 2FA secret for storage
   */
  private encryptSecret(secret: string): string {
    const key = Buffer.from(process.env.JWT_SECRET || 'default-key').slice(0, 32).toString('hex').slice(0, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt 2FA secret from storage
   */
  private decryptSecret(encryptedSecret: string): string {
    const key = Buffer.from(process.env.JWT_SECRET || 'default-key').slice(0, 32).toString('hex').slice(0, 32);
    const [ivHex, encrypted] = encryptedSecret.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

export const twoFactorService = new TwoFactorService();
