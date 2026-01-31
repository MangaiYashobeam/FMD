/**
 * Production-Grade Security Middleware
 * Implements CSRF protection, request signing, security headers
 */

import { RequestHandler } from 'express';
import crypto from 'crypto';
import { logger } from '@/utils/logger';

// ============================================
// CSRF Token Protection
// ============================================

const CSRF_TOKEN_LENGTH = 32;
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

interface CSRFTokenData {
  token: string;
  createdAt: number;
}

// In-memory store for CSRF tokens (use Redis in production for scaling)
const csrfTokenStore = new Map<string, CSRFTokenData>();

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Middleware to set CSRF token in cookie and make it available
 */
export const csrfTokenProvider: RequestHandler = (req, res, next) => {
  // Check if token exists in cookie
  let csrfToken = req.cookies?.[CSRF_COOKIE_NAME];
  
  if (!csrfToken || !csrfTokenStore.has(csrfToken)) {
    // Generate new token
    csrfToken = generateCSRFToken();
    csrfTokenStore.set(csrfToken, {
      token: csrfToken,
      createdAt: Date.now(),
    });
    
    // Set secure cookie
    res.cookie(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: CSRF_TOKEN_EXPIRY,
    });
  }
  
  // Make token available in response header for client to read
  res.setHeader('x-csrf-token', csrfToken);
  
  // Attach to request for validation
  (req as any).csrfToken = csrfToken;
  
  next();
};

/**
 * Middleware to validate CSRF token on state-changing requests
 * 
 * SECURITY: API key bypass requires actual API key validation later in the chain.
 * We mark the request as needing API key validation rather than blindly skipping CSRF.
 */
export const csrfProtection: RequestHandler = (req, res, next) => {
  // Skip CSRF for safe methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    next();
    return;
  }
  
  // Skip for API key authenticated requests (machine-to-machine)
  // SECURITY: The API key will be validated by the apiKey middleware downstream.
  // We only skip CSRF here because API keys are bearer tokens that can't be forged via CSRF.
  // The request MUST have proper API key validation middleware applied to be secure.
  if (req.headers['x-api-key']) {
    // Mark that this request bypassed CSRF due to API key claim
    // The API key middleware MUST validate this, or the request should be rejected
    (req as any).__csrfBypassedViaApiKey = true;
    next();
    return;
  }
  
  // Skip for webhook endpoints that use signature verification
  // Also skip for Python worker endpoints (use X-Worker-Secret auth)
  const webhookPaths = [
    '/api/subscriptions/webhook', 
    '/api/facebook/deauthorize', 
    '/api/email/track',
    '/api/workers/task-result',      // Python workers use X-Worker-Secret
    '/api/workers/session-export',   // Python workers use X-Worker-Secret  
    '/api/worker/iai',               // Python worker IAI endpoints
  ];
  if (webhookPaths.some(path => req.path.includes(path))) {
    next();
    return;
  }
  
  const tokenFromHeader = req.headers[CSRF_HEADER_NAME] as string;
  const tokenFromCookie = req.cookies?.[CSRF_COOKIE_NAME];
  
  if (!tokenFromHeader || !tokenFromCookie) {
    logger.warn('CSRF token missing', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      hasHeader: !!tokenFromHeader,
      hasCookie: !!tokenFromCookie,
    });
    
    res.status(403).json({
      success: false,
      message: 'CSRF token missing',
      code: 'CSRF_TOKEN_MISSING',
    });
    return;
  }
  
  // Validate tokens match and exist in store
  if (tokenFromHeader !== tokenFromCookie || !csrfTokenStore.has(tokenFromCookie)) {
    logger.warn('CSRF token validation failed', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    
    res.status(403).json({
      success: false,
      message: 'CSRF token validation failed',
      code: 'CSRF_TOKEN_INVALID',
    });
    return;
  }
  
  // Check token expiry
  const tokenData = csrfTokenStore.get(tokenFromCookie);
  if (tokenData && Date.now() - tokenData.createdAt > CSRF_TOKEN_EXPIRY) {
    csrfTokenStore.delete(tokenFromCookie);
    
    res.status(403).json({
      success: false,
      message: 'CSRF token expired',
      code: 'CSRF_TOKEN_EXPIRED',
    });
    return;
  }
  
  next();
};

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of csrfTokenStore.entries()) {
    if (now - data.createdAt > CSRF_TOKEN_EXPIRY) {
      csrfTokenStore.delete(token);
    }
  }
}, 60 * 60 * 1000); // Every hour

// ============================================
// Request Signing for Sensitive Operations
// ============================================

const REQUEST_SIGNATURE_HEADER = 'x-request-signature';
const REQUEST_TIMESTAMP_HEADER = 'x-request-timestamp';
const SIGNATURE_VALIDITY_WINDOW = 5 * 60 * 1000; // 5 minutes

/**
 * Generate request signature for sensitive operations
 */
export function generateRequestSignature(
  method: string,
  path: string,
  body: object,
  timestamp: number,
  secret: string
): string {
  const payload = `${method}|${path}|${JSON.stringify(body)}|${timestamp}`;
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Middleware to validate request signatures for sensitive endpoints
 */
export const requireRequestSignature: RequestHandler = (req, res, next) => {
  const signature = req.headers[REQUEST_SIGNATURE_HEADER] as string;
  const timestamp = parseInt(req.headers[REQUEST_TIMESTAMP_HEADER] as string, 10);
  
  if (!signature || !timestamp) {
    logger.warn('Missing request signature', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    
    res.status(403).json({
      success: false,
      message: 'Request signature required',
      code: 'SIGNATURE_REQUIRED',
    });
    return;
  }
  
  // Check timestamp validity (prevent replay attacks)
  const now = Date.now();
  if (Math.abs(now - timestamp) > SIGNATURE_VALIDITY_WINDOW) {
    logger.warn('Request signature timestamp invalid', {
      path: req.path,
      timestamp,
      serverTime: now,
    });
    
    res.status(403).json({
      success: false,
      message: 'Request timestamp expired',
      code: 'SIGNATURE_EXPIRED',
    });
    return;
  }
  
  // Verify signature
  const secret = process.env.REQUEST_SIGNING_SECRET || process.env.JWT_SECRET || '';
  const expectedSignature = generateRequestSignature(
    req.method,
    req.path,
    req.body || {},
    timestamp,
    secret
  );
  
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    logger.warn('Request signature mismatch', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    
    res.status(403).json({
      success: false,
      message: 'Invalid request signature',
      code: 'SIGNATURE_INVALID',
    });
    return;
  }
  
  next();
};

// ============================================
// Security Headers
// ============================================

/**
 * Comprehensive security headers middleware
 */
export const securityHeaders: RequestHandler = (_req, res, next) => {
  // Strict Transport Security - force HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // XSS Protection (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy (formerly Feature-Policy)
  res.setHeader('Permissions-Policy', 
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()');
  
  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://connect.facebook.net https://www.facebook.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://graph.facebook.com https://www.facebook.com wss:",
    "frame-src 'self' https://www.facebook.com https://web.facebook.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ];
  
  // Only set CSP in production to avoid dev issues
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
  } else {
    // Looser CSP for development
    res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: wss: data: blob:");
  }
  
  // Remove server identification
  res.removeHeader('X-Powered-By');
  
  next();
};

// ============================================
// Request Context for Audit Logging
// ============================================

export interface SecurityContext {
  requestId: string;
  ip: string;
  userAgent: string;
  userId?: string;
  accountId?: string;
  action?: string;
  resource?: string;
  timestamp: Date;
}

/**
 * Attach security context to request for audit logging
 */
export const attachSecurityContext: RequestHandler = (req, _res, next) => {
  const context: SecurityContext = {
    requestId: crypto.randomUUID(),
    ip: (req.ip || req.socket.remoteAddress || 'unknown').replace('::ffff:', ''),
    userAgent: req.headers['user-agent'] || 'unknown',
    timestamp: new Date(),
  };
  
  (req as any).securityContext = context;
  
  next();
};

// ============================================
// Sensitive Operations List
// ============================================

export const SENSITIVE_OPERATIONS = [
  { method: 'POST', path: '/api/auth/change-password' },
  { method: 'DELETE', path: '/api/accounts' },
  { method: 'POST', path: '/api/admin/users' },
  { method: 'DELETE', path: '/api/admin/users' },
  { method: 'PUT', path: '/api/admin/settings' },
  { method: 'POST', path: '/api/admin/impersonate' },
  { method: 'POST', path: '/api/email/bulk' },
  { method: 'DELETE', path: '/api/vehicles/bulk' },
];

/**
 * Check if request is a sensitive operation
 */
export function isSensitiveOperation(method: string, path: string): boolean {
  return SENSITIVE_OPERATIONS.some(
    op => op.method === method && path.includes(op.path)
  );
}
