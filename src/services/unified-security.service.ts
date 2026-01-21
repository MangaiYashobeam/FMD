/**
 * Unified Security Service
 * 
 * Provides cryptographic security for communication between Node.js and Python workers.
 * This creates a "Security Dome" ensuring:
 * 
 * 1. Task Authenticity - HMAC-SHA256 signatures
 * 2. Payload Confidentiality - AES-256-GCM encryption
 * 3. Replay Prevention - Timestamps + nonces
 * 4. Input Validation - Shared dangerous pattern detection
 * 
 * Both Node.js and Python workers use identical algorithms.
 */

import crypto from 'crypto';
import { logger } from '@/utils/logger';

// Protocol version for compatibility checking
const SECURITY_PROTOCOL_VERSION = '1.0';

// Maximum age for valid signatures (5 minutes)
const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;

// Nonce cache to prevent replay attacks
const usedNonces = new Map<string, number>();

// Dangerous patterns to detect in input (shared with Python)
const DANGEROUS_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /\.\.\//,
  /%2e%2e/i,
  /;\s*exec/i,
  /;\s*drop/i,
  /--/,
  /'\s*or\s+'/i,
];

// Account ID pattern
const ACCOUNT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

// Task ID pattern
const TASK_ID_PATTERN = /^(task_|vehicle_|validate_|setup_)[a-f0-9]{8,32}$/;

interface SignedTask {
  task_id: string;
  type: string;
  account_id: string;
  data: Record<string, any>;
  data_hash: string;  // Hash of original data for integrity verification
  priority: string;
  created_at: string;
  retry_count: number;
  // Security fields
  signature: string;
  timestamp: number;
  nonce: string;
  protocol_version: string;
  encrypted_payload?: string;
}

interface TaskData {
  id: string;
  type: string;
  account_id: string;
  data: Record<string, any>;
  priority: string;
  created_at: string;
  retry_count: number;
}

interface VerificationResult {
  valid: boolean;
  error?: string;
  task?: TaskData;
}

class UnifiedSecurityService {
  private workerSecret: Buffer | null = null;
  private encryptionKey: Buffer | null = null;
  private isInitialized = false;

  /**
   * Initialize the security service with secrets
   */
  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    const workerSecretStr = process.env.WORKER_SECRET;
    const encryptionKeyStr = process.env.ENCRYPTION_KEY || process.env.WORKER_SECRET;

    if (!workerSecretStr) {
      logger.warn('⚠️  WORKER_SECRET not configured - task signing disabled');
      return;
    }

    if (workerSecretStr.length < 32) {
      logger.error('🚨 WORKER_SECRET must be at least 32 characters');
      if (process.env.NODE_ENV === 'production') {
        throw new Error('WORKER_SECRET must be at least 32 characters in production');
      }
      return;
    }

    // Derive 256-bit key from secret using SHA-256
    this.workerSecret = crypto.createHash('sha256').update(workerSecretStr).digest();
    
    // Derive encryption key (separate from signing key for defense in depth)
    const encryptionSalt = 'fmd-encryption-v1';
    this.encryptionKey = crypto.createHash('sha256')
      .update(encryptionKeyStr + encryptionSalt)
      .digest();

    this.isInitialized = true;
    logger.info('✅ Unified security service initialized');

    // Start nonce cleanup interval
    setInterval(() => this.cleanupNonces(), 60 * 1000);
  }

  /**
   * Check if security service is available
   */
  isAvailable(): boolean {
    return this.isInitialized && this.workerSecret !== null;
  }

  /**
   * Sign a task for transmission to Python workers
   */
  signTask(task: TaskData, encryptSensitiveData = true): SignedTask {
    if (!this.isAvailable()) {
      throw new Error('Security service not initialized');
    }

    // Generate timestamp and nonce
    const timestamp = Date.now();
    const nonce = crypto.randomBytes(16).toString('hex');

    // Compute hash of original data for signature (before encryption)
    const dataHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(task.data || {}, Object.keys(task.data || {}).sort()))
      .digest('hex');

    // Prepare data for signing
    let dataToInclude = task.data;
    let encryptedPayload: string | undefined;

    // Optionally encrypt sensitive data
    if (encryptSensitiveData && task.data) {
      const { encrypted, iv, authTag } = this.encryptPayload(JSON.stringify(task.data));
      encryptedPayload = `${iv}:${authTag}:${encrypted}`;
      dataToInclude = { encrypted: true };
    }

    // Create signing string (deterministic, includes data hash)
    const signingString = this.createSigningString({
      task_id: task.id,
      type: task.type,
      account_id: task.account_id,
      timestamp,
      nonce,
      data_hash: dataHash,
    });

    // Generate HMAC-SHA256 signature
    const signature = crypto
      .createHmac('sha256', this.workerSecret!)
      .update(signingString)
      .digest('hex');

    const signedTask: SignedTask = {
      task_id: task.id,
      type: task.type,
      account_id: task.account_id,
      data: dataToInclude,
      data_hash: dataHash,  // Include hash for verification
      priority: task.priority,
      created_at: task.created_at,
      retry_count: task.retry_count,
      signature,
      timestamp,
      nonce,
      protocol_version: SECURITY_PROTOCOL_VERSION,
    };

    if (encryptedPayload) {
      signedTask.encrypted_payload = encryptedPayload;
    }

    return signedTask;
  }

  /**
   * Verify a task signature (for tasks received from workers)
   */
  verifyTask(signedTask: SignedTask): VerificationResult {
    if (!this.isAvailable()) {
      return { valid: false, error: 'Security service not initialized' };
    }

    try {
      // Check protocol version
      if (signedTask.protocol_version !== SECURITY_PROTOCOL_VERSION) {
        return { valid: false, error: `Protocol version mismatch: ${signedTask.protocol_version}` };
      }

      // Check timestamp (within 5 minutes)
      const age = Date.now() - signedTask.timestamp;
      if (age > MAX_SIGNATURE_AGE_MS) {
        return { valid: false, error: 'Signature expired' };
      }
      if (age < -60000) { // Allow 1 minute clock skew
        return { valid: false, error: 'Timestamp in future' };
      }

      // Check nonce (prevent replay)
      const nonceKey = `${signedTask.task_id}:${signedTask.nonce}`;
      if (usedNonces.has(nonceKey)) {
        return { valid: false, error: 'Nonce already used (replay attack?)' };
      }

      // Get data hash for signing verification
      const dataHash = signedTask.data_hash || '';

      // Recreate signing string (includes data_hash)
      const signingString = this.createSigningString({
        task_id: signedTask.task_id,
        type: signedTask.type,
        account_id: signedTask.account_id,
        timestamp: signedTask.timestamp,
        nonce: signedTask.nonce,
        data_hash: dataHash,
      });

      // Verify signature using constant-time comparison
      const expectedSignature = crypto
        .createHmac('sha256', this.workerSecret!)
        .update(signingString)
        .digest('hex');

      const signatureBuffer = Buffer.from(signedTask.signature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');

      if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
        return { valid: false, error: 'Invalid signature' };
      }

      // Mark nonce as used
      usedNonces.set(nonceKey, Date.now());

      // Decrypt payload if encrypted
      let decryptedData = signedTask.data;
      if (signedTask.encrypted_payload) {
        const [iv, authTag, encrypted] = signedTask.encrypted_payload.split(':');
        decryptedData = JSON.parse(this.decryptPayload(encrypted, iv, authTag));
      }

      // Verify data integrity (for non-encrypted data)
      if (!signedTask.encrypted_payload && dataHash) {
        const actualHash = crypto
          .createHash('sha256')
          .update(JSON.stringify(decryptedData || {}, Object.keys(decryptedData || {}).sort()))
          .digest('hex');
        if (actualHash !== dataHash) {
          return { valid: false, error: 'Data integrity check failed (data tampered?)' };
        }
      }

      // Return verified task
      return {
        valid: true,
        task: {
          id: signedTask.task_id,
          type: signedTask.type,
          account_id: signedTask.account_id,
          data: decryptedData,
          priority: signedTask.priority,
          created_at: signedTask.created_at,
          retry_count: signedTask.retry_count,
        },
      };

    } catch (error) {
      logger.error('Task verification failed', { error });
      return { valid: false, error: 'Verification failed' };
    }
  }

  /**
   * Create deterministic signing string
   */
  private createSigningString(params: {
    task_id: string;
    type: string;
    account_id: string;
    timestamp: number;
    nonce: string;
    data_hash: string;
  }): string {
    // Include data hash to prevent tampering with task data
    return [
      params.task_id,
      params.type,
      params.account_id,
      params.timestamp.toString(),
      params.nonce,
      params.data_hash,
    ].join('|');
  }

  /**
   * Encrypt payload using AES-256-GCM
   */
  private encryptPayload(plaintext: string): { encrypted: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey!, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag().toString('base64');
    
    return {
      encrypted,
      iv: iv.toString('base64'),
      authTag,
    };
  }

  /**
   * Decrypt payload using AES-256-GCM
   */
  private decryptPayload(encrypted: string, ivBase64: string, authTagBase64: string): string {
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey!, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Cleanup old nonces to prevent memory growth
   */
  private cleanupNonces(): void {
    const cutoff = Date.now() - MAX_SIGNATURE_AGE_MS;
    let cleaned = 0;

    for (const [key, timestamp] of usedNonces.entries()) {
      if (timestamp < cutoff) {
        usedNonces.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned ${cleaned} expired nonces`);
    }
  }

  // ==========================================================================
  // Input Validation (shared patterns with Python)
  // ==========================================================================

  /**
   * Check if string contains dangerous patterns
   */
  containsDangerousContent(value: string): boolean {
    if (!value || typeof value !== 'string') {
      return false;
    }

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(value)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Validate account ID format
   */
  validateAccountId(accountId: string): boolean {
    if (!accountId || typeof accountId !== 'string') {
      return false;
    }
    if (this.containsDangerousContent(accountId)) {
      return false;
    }
    return ACCOUNT_ID_PATTERN.test(accountId);
  }

  /**
   * Validate task ID format
   */
  validateTaskId(taskId: string): boolean {
    if (!taskId || typeof taskId !== 'string') {
      return false;
    }
    return TASK_ID_PATTERN.test(taskId);
  }

  /**
   * Validate task data structure
   */
  validateTaskData(data: Record<string, any>): { valid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Task data must be an object' };
    }

    // Check for dangerous content in all string values
    const checkValue = (val: any, path: string): string | null => {
      if (typeof val === 'string') {
        if (this.containsDangerousContent(val)) {
          return `Dangerous content detected at ${path}`;
        }
      } else if (Array.isArray(val)) {
        for (let i = 0; i < val.length; i++) {
          const result = checkValue(val[i], `${path}[${i}]`);
          if (result) return result;
        }
      } else if (val && typeof val === 'object') {
        for (const [key, value] of Object.entries(val)) {
          const result = checkValue(value, `${path}.${key}`);
          if (result) return result;
        }
      }
      return null;
    };

    const danger = checkValue(data, 'data');
    if (danger) {
      return { valid: false, error: danger };
    }

    return { valid: true };
  }

  /**
   * Sanitize string input
   */
  sanitizeString(value: string, maxLength = 1000): string {
    if (!value || typeof value !== 'string') {
      return '';
    }

    // Truncate
    let sanitized = value.slice(0, maxLength);

    // Remove null bytes
    sanitized = sanitized.replace(/\x00/g, '');

    // Remove control characters (except newlines/tabs)
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized.trim();
  }

  // ==========================================================================
  // Security Event Logging
  // ==========================================================================

  /**
   * Log a security event
   */
  logSecurityEvent(
    eventType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any>
  ): void {
    const event = {
      timestamp: new Date().toISOString(),
      event_type: eventType,
      severity,
      ...details,
    };

    if (severity === 'critical' || severity === 'high') {
      logger.error('🚨 Security Event', event);
    } else if (severity === 'medium') {
      logger.warn('⚠️  Security Event', event);
    } else {
      logger.info('🔒 Security Event', event);
    }
  }

  /**
   * Generate a secure task ID
   */
  generateTaskId(prefix: string = 'task'): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(8).toString('hex');
    return `${prefix}_${timestamp}${random}`;
  }
}

// Export singleton instance
export const unifiedSecurityService = new UnifiedSecurityService();

// Auto-initialize on import
unifiedSecurityService.initialize();
