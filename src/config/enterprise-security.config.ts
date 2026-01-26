/**
 * Enterprise Security Configuration
 * PCI-DSS & SOC2 Compliance Settings
 * 
 * This file centralizes all security configuration for easy auditing
 * and compliance verification.
 */

import crypto from 'crypto';

// ============================================
// ENVIRONMENT VALIDATION
// ============================================

const requiredSecurityEnvVars = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'FB_CREDENTIALS_KEY',
  'SESSION_TOKEN_SECRET',
];

// Optional security env vars (for documentation)
// GREEN_ROUTE_SECRET, CHROME_EXTENSION_ID, SENTRY_DSN

// ============================================
// SECURITY CONFIGURATION
// ============================================

export const securityConfig = {
  // ─────────────────────────────────────────
  // JWT Configuration (PCI-DSS 8.2)
  // ─────────────────────────────────────────
  jwt: {
    accessTokenExpiry: '15m',     // Short-lived access tokens
    refreshTokenExpiry: '7d',     // Refresh tokens last 7 days
    algorithm: 'HS256' as const,  // HMAC-SHA256
    issuer: 'dealersface.com',
    audience: 'dealersface-api',
  },

  // ─────────────────────────────────────────
  // Session Configuration
  // ─────────────────────────────────────────
  session: {
    extensionTokenExpiry: 24 * 60 * 60 * 1000,    // 24 hours
    signatureValidityWindow: 5 * 60 * 1000,        // 5 minutes
    maxTokensPerUser: 5,                           // Prevent token farming
  },

  // ─────────────────────────────────────────
  // Password Requirements (PCI-DSS 8.2.3)
  // ─────────────────────────────────────────
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxAge: 90,                    // Days before password expires
    historyCount: 12,              // Remember last N passwords
    lockoutThreshold: 5,           // Failed attempts before lockout
    lockoutDuration: 30,           // Minutes
  },

  // ─────────────────────────────────────────
  // Rate Limiting (DDoS Protection)
  // ─────────────────────────────────────────
  rateLimits: {
    general: {
      windowMs: 15 * 60 * 1000,    // 15 minutes
      max: 500,                    // Requests per window
    },
    auth: {
      windowMs: 15 * 60 * 1000,
      max: 5,                      // Login attempts per window
    },
    passwordReset: {
      windowMs: 60 * 60 * 1000,    // 1 hour
      max: 3,                      // Reset attempts per hour
    },
    api: {
      windowMs: 15 * 60 * 1000,
      max: 200,
    },
    upload: {
      windowMs: 60 * 60 * 1000,
      max: 20,
    },
  },

  // ─────────────────────────────────────────
  // CORS Configuration
  // ─────────────────────────────────────────
  cors: {
    allowedOrigins: [
      'https://dealersface.com',
      'https://www.dealersface.com',
      // Development
      'http://localhost:3000',
      'http://localhost:5173',
    ],
    allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'X-Request-Signature',
      'X-Request-Timestamp',
      'X-Request-Nonce',
      'X-Extension-ID',
      'CF-Connecting-IP',
      'CF-Ray',
      'CF-IPCountry',
    ],
    exposedHeaders: ['X-CSRF-Token', 'CF-Ray', 'X-Request-ID'],
    maxAge: 86400,                 // 24 hours
    credentials: true,
  },

  // ─────────────────────────────────────────
  // Security Headers (PCI-DSS 6.5.7)
  // ─────────────────────────────────────────
  headers: {
    // HSTS - Force HTTPS
    hsts: {
      maxAge: 63072000,            // 2 years
      includeSubDomains: true,
      preload: true,
    },
    // CSP - XSS Prevention
    csp: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'strict-dynamic'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'https://*.fbcdn.net'],
      connectSrc: [
        "'self'",
        'https://dealersface.com',
        'https://graph.facebook.com',
        'wss://dealersface.com',
      ],
      frameAncestors: ["'self'"],
      formAction: ["'self'"],
      baseUri: ["'self'"],
    },
    // X-Frame-Options
    frameOptions: 'DENY',
    // X-Content-Type-Options
    contentTypeOptions: 'nosniff',
    // Referrer-Policy
    referrerPolicy: 'strict-origin-when-cross-origin',
    // X-XSS-Protection (legacy)
    xssProtection: '1; mode=block',
  },

  // ─────────────────────────────────────────
  // Encryption Settings (PCI-DSS 3.4, 4.1)
  // ─────────────────────────────────────────
  encryption: {
    algorithm: 'aes-256-gcm' as const,
    keyDerivation: 'scrypt' as const,
    saltLength: 32,
    ivLength: 16,
    tagLength: 16,
    scryptOptions: {
      N: 16384,
      r: 8,
      p: 1,
    },
  },

  // ─────────────────────────────────────────
  // Audit Logging (PCI-DSS 10.x)
  // ─────────────────────────────────────────
  audit: {
    // Events that require logging
    requiredEvents: [
      'LOGIN_SUCCESS',
      'LOGIN_FAILURE',
      'LOGOUT',
      'PASSWORD_CHANGE',
      'PASSWORD_RESET_REQUEST',
      'MFA_ENABLED',
      'MFA_DISABLED',
      'PERMISSION_CHANGE',
      'DATA_EXPORT',
      'CREDENTIALS_ACCESS',
      'CREDENTIALS_UPDATE',
      'ADMIN_ACTION',
    ],
    // PCI-relevant paths
    pciPaths: [
      '/api/auth/login',
      '/api/auth/logout',
      '/api/auth/register',
      '/api/auth/password',
      '/api/user-credentials',
      '/api/facebook/credentials',
      '/api/subscriptions',
      '/api/account',
    ],
    // Log retention (PCI-DSS 10.7)
    retentionDays: 365,           // 1 year minimum
    immutable: true,              // Prevent modification/deletion
  },

  // ─────────────────────────────────────────
  // Threat Intelligence
  // ─────────────────────────────────────────
  threatIntel: {
    autoBlockThreshold: 100,      // Auto-block at this threat score
    scoreDecayRate: 10,           // Points per hour
    maxReasons: 10,               // Limit stored reasons
  },

  // ─────────────────────────────────────────
  // Extension Security
  // ─────────────────────────────────────────
  extension: {
    allowedIds: [
      process.env.CHROME_EXTENSION_ID || '',
      'local-dev-extension',
    ].filter(Boolean),
    tokenRefreshWindow: 2 * 60 * 60 * 1000,  // 2 hours before expiry
  },

  // ─────────────────────────────────────────
  // Request Validation
  // ─────────────────────────────────────────
  validation: {
    maxRequestSize: 10 * 1024 * 1024,         // 10MB
    maxTrainingUploadSize: 50 * 1024 * 1024,  // 50MB
    maxArrayLength: 10000,
    maxObjectKeys: 1000,
    maxStringLength: 100000,
    maxRecursionDepth: 10,
  },
};

// ============================================
// SECURITY VALIDATION
// ============================================

export function validateSecurityEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required env vars
  for (const envVar of requiredSecurityEnvVars) {
    if (!process.env[envVar]) {
      errors.push(`Missing required security environment variable: ${envVar}`);
    }
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET should be at least 32 characters');
  }

  // Validate NODE_ENV
  if (process.env.NODE_ENV === 'production') {
    // Production-specific checks
    if (!process.env.DATABASE_URL?.includes('ssl=require')) {
      // Warning only - some setups use internal SSL
      console.warn('[Security] Consider using SSL for database connection in production');
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================
// CRYPTO UTILITIES
// ============================================

/**
 * Generate cryptographically secure random string
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate secure nonce for replay prevention
 */
export function generateNonce(): string {
  return `${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * Constant-time string comparison (timing attack prevention)
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ============================================
// COMPLIANCE HELPER
// ============================================

export const compliance = {
  pciDss: {
    version: '4.0',
    requirements: {
      '3.4': 'Render PAN unreadable (encryption)',
      '4.1': 'Strong cryptography for transmission',
      '6.5.1': 'Injection flaws',
      '6.5.3': 'Insecure cryptographic storage',
      '6.5.4': 'Insecure communications',
      '6.5.7': 'XSS',
      '6.5.9': 'CSRF',
      '8.2': 'Unique user authentication',
      '8.2.3': 'Password complexity',
      '10.1': 'Audit trails',
      '10.2': 'Automated audit trails',
      '10.3': 'Record audit trail entries',
      '10.5': 'Secure audit trails',
      '10.7': 'Retain audit trail history',
    },
  },
  soc2: {
    type: 'Type II',
    trustServiceCriteria: {
      'CC6.1': 'Security measures',
      'CC6.6': 'Encryption',
      'CC6.7': 'Transmission security',
      'CC7.2': 'System monitoring',
    },
  },
};

export default securityConfig;
