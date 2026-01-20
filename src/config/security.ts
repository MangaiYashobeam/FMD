/**
 * Security Configuration
 * 
 * Centralized security constants and validation for production hardening
 */

import { logger } from '@/utils/logger';

// Insecure secret patterns to reject
const INSECURE_SECRETS = [
  'secret',
  'fallback-secret',
  'fallback-secret-for-dev',
  'default-key',
  'changeme',
  'password',
  '12345',
  'test',
  'development',
];

/**
 * Get JWT secret with validation
 * Throws in production if secret is missing or insecure
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: JWT_SECRET environment variable is not set in production!');
    }
    logger.warn('⚠️  JWT_SECRET not set - using insecure default (development only)');
    return 'dev-only-insecure-secret-do-not-use-in-production';
  }
  
  // Check for insecure patterns
  const lowerSecret = secret.toLowerCase();
  if (INSECURE_SECRETS.some(pattern => lowerSecret === pattern || lowerSecret.includes(pattern))) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: JWT_SECRET is using an insecure default value!');
    }
    logger.warn('⚠️  JWT_SECRET appears to be an insecure default value');
  }
  
  // Check minimum length
  if (secret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: JWT_SECRET must be at least 32 characters long!');
    }
    logger.warn('⚠️  JWT_SECRET is shorter than recommended (32 chars minimum)');
  }
  
  return secret;
}

/**
 * Get JWT refresh secret with validation
 */
export function getJwtRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: JWT_REFRESH_SECRET environment variable is not set in production!');
    }
    logger.warn('⚠️  JWT_REFRESH_SECRET not set - using derived secret (development only)');
    return getJwtSecret() + '-refresh';
  }
  
  return secret;
}

/**
 * Get encryption key for sensitive data
 */
export function getEncryptionKey(): Buffer {
  const secret = getJwtSecret();
  // Create a 32-byte key from the JWT secret
  return Buffer.from(secret.padEnd(32, '0').slice(0, 32));
}

/**
 * Validate all required security configurations on startup
 */
export function validateSecurityConfig(): void {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check JWT secrets
  if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      errors.push('JWT_SECRET is not set');
    } else {
      warnings.push('JWT_SECRET is not set');
    }
  }
  
  if (!process.env.JWT_REFRESH_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      errors.push('JWT_REFRESH_SECRET is not set');
    } else {
      warnings.push('JWT_REFRESH_SECRET is not set');
    }
  }
  
  // Check database URL
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is not set');
  }
  
  // Check CORS origin in production
  if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGINS) {
    warnings.push('CORS_ORIGINS not set - using restrictive default');
  }
  
  // Check rate limit configuration
  if (!process.env.RATE_LIMIT_WINDOW_MS) {
    warnings.push('RATE_LIMIT_WINDOW_MS not set - using default');
  }
  
  // Log results
  if (warnings.length > 0) {
    warnings.forEach(w => logger.warn(`⚠️  Security Warning: ${w}`));
  }
  
  if (errors.length > 0) {
    errors.forEach(e => logger.error(`🚨 Security Error: ${e}`));
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Security configuration errors: ${errors.join(', ')}`);
    }
  }
  
  logger.info('✅ Security configuration validated');
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(data: string, visibleChars = 4): string {
  if (!data || data.length <= visibleChars * 2) {
    return '***';
  }
  return data.slice(0, visibleChars) + '***' + data.slice(-visibleChars);
}
