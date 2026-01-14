import crypto from 'crypto';
import { logger } from '@/utils/logger';

/**
 * Encryption Service for sensitive data
 * Uses AES-256-CBC for encrypting Facebook credentials and other sensitive information
 */

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

export class EncryptionService {
  private encryptionKey: Buffer;

  constructor() {
    const key = process.env.FB_CREDENTIALS_KEY;
    
    if (!key) {
      throw new Error('FB_CREDENTIALS_KEY environment variable is required');
    }

    if (key.length !== 64) {
      throw new Error('FB_CREDENTIALS_KEY must be 64 characters (32 bytes in hex)');
    }

    this.encryptionKey = Buffer.from(key, 'hex');
  }

  /**
   * Encrypt text using AES-256-CBC
   * @param text - Plain text to encrypt
   * @returns Encrypted text in format: iv:encryptedData (both hex-encoded)
   */
  encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Return iv:encrypted (both in hex)
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      logger.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt text encrypted with encrypt()
   * @param text - Encrypted text in format: iv:encryptedData
   * @returns Decrypted plain text
   */
  decrypt(text: string): string {
    try {
      const parts = text.split(':');
      
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encryptedData = Buffer.from(parts[1], 'hex');
      
      const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);
      
      let decrypted = decipher.update(encryptedData);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      logger.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt array of strings (for 2FA codes)
   * @param items - Array of strings to encrypt
   * @returns Array of encrypted strings
   */
  encryptArray(items: string[]): string[] {
    return items.map(item => this.encrypt(item));
  }

  /**
   * Decrypt array of strings
   * @param items - Array of encrypted strings
   * @returns Array of decrypted strings
   */
  decryptArray(items: string[]): string[] {
    return items.map(item => this.decrypt(item));
  }

  /**
   * Generate a secure random encryption key
   * @returns 64-character hex string (32 bytes)
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash a password using bcrypt (for application passwords, not for encryption)
   * @param password - Plain text password
   * @returns Hashed password
   */
  static async hashPassword(password: string): Promise<string> {
    const bcrypt = await import('bcrypt');
    return bcrypt.hash(password, 12);
  }

  /**
   * Verify a password against a hash
   * @param password - Plain text password
   * @param hash - Hashed password
   * @returns True if password matches
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    const bcrypt = await import('bcrypt');
    return bcrypt.compare(password, hash);
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();
