import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '@/utils/logger';
import { iipcService } from '@/services/iipc.service';

/**
 * Custom in-memory store that allows resetting keys
 */
class ResettableStore {
  private hits: Map<string, { count: number; resetTime: number }> = new Map();
  private windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const now = Date.now();
    let record = this.hits.get(key);
    
    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + this.windowMs };
      this.hits.set(key, record);
    }
    
    record.count++;
    return { totalHits: record.count, resetTime: new Date(record.resetTime) };
  }

  async decrement(key: string): Promise<void> {
    const record = this.hits.get(key);
    if (record && record.count > 0) {
      record.count--;
    }
  }

  async resetKey(key: string): Promise<void> {
    this.hits.delete(key);
  }

  async resetAll(): Promise<void> {
    this.hits.clear();
  }

  // Reset all keys containing a specific IP
  async resetIP(ip: string): Promise<number> {
    let count = 0;
    for (const key of this.hits.keys()) {
      if (key.includes(ip)) {
        this.hits.delete(key);
        count++;
      }
    }
    return count;
  }

  // Get all keys (for debugging)
  getKeys(): string[] {
    return Array.from(this.hits.keys());
  }
}

// Create shared stores
const generalStore = new ResettableStore(15 * 60 * 1000);
const authStore = new ResettableStore(15 * 60 * 1000);
const passwordResetStore = new ResettableStore(60 * 60 * 1000);

/**
 * Reset rate limits for a specific IP across all limiters
 */
export async function resetRateLimitsForIP(ip: string): Promise<{ cleared: number }> {
  let cleared = 0;
  cleared += await generalStore.resetIP(ip);
  cleared += await authStore.resetIP(ip);
  cleared += await passwordResetStore.resetIP(ip);
  logger.info(`Rate limits cleared for IP ${ip}: ${cleared} entries`);
  return { cleared };
}

/**
 * Reset all rate limits (use with caution)
 */
export async function resetAllRateLimits(): Promise<void> {
  await generalStore.resetAll();
  await authStore.resetAll();
  await passwordResetStore.resetAll();
  logger.info('All rate limits cleared');
}

/**
 * Check if IP can bypass rate limiting via IIPC
 */
function canBypassRateLimit(req: Request): boolean {
  // Check if already computed by iipcCheck middleware
  if (req.iipc?.canOverrideRateLimit) {
    return true;
  }
  
  // Otherwise check directly with IIPC service
  const ip = getClientIPForRateLimit(req);
  return iipcService.isSuperAdminIP(ip);
}

/**
 * Get client IP for rate limiting
 */
function getClientIPForRateLimit(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) 
      ? forwardedFor[0] 
      : forwardedFor.split(',')[0];
    return ips.trim();
  }
  return req.ip || 'unknown';
}

/**
 * Security Middleware
 * Production-grade security protections
 */

// ============================================
// Rate Limiters
// ============================================

/**
 * High-frequency GREEN ROUTE endpoints that bypass rate limiting
 * These are internal dashboard/extension polling endpoints
 */
const GREEN_ROUTE_SKIP_PATHS = [
  '/extension/status',
  '/extension/heartbeat',
  '/extension/tasks',
  '/admin/stats',
  '/admin/accounts',
  '/ai-center/dashboard',
  '/ai-center/chat',
  '/injection/stats',
  '/injection/containers',
  '/messages/conversations',
  '/iai/pattern',
  '/training/console',
  '/facebook/callback',
  '/auth/facebook/callback',
  '/config/facebook',
  '/health',
  '/api-dashboard',
  '/notifications/stream',
];

/**
 * General API rate limiter - 500 requests per 15 minutes (increased for admin dashboard)
 * GREEN ROUTE endpoints skip rate limiting entirely
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased from 100 to handle admin dashboard polling
  store: generalStore as any,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    if (req.path === '/health') return true;
    
    // Skip for GREEN ROUTE high-frequency endpoints
    if (GREEN_ROUTE_SKIP_PATHS.some(p => req.path.includes(p))) {
      return true;
    }
    
    // Skip for IIPC whitelisted IPs (super admin)
    return canBypassRateLimit(req);
  },
  keyGenerator: (req) => {
    // Use forwarded IP if behind proxy, otherwise use direct IP
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
      || req.ip 
      || 'unknown';
  },
  handler: (req, res, _next, options) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('user-agent'),
    });
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Strict rate limiter for auth endpoints - 5 requests per 15 minutes
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  store: authStore as any,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip for IIPC whitelisted IPs (super admin can bypass login blocks)
    return canBypassRateLimit(req);
  },
  keyGenerator: (req) => {
    // Include email in key for login attempts to prevent distributed attacks
    const email = req.body?.email?.toLowerCase() || '';
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
      || req.ip 
      || 'unknown';
    return `${ip}-${email}`;
  },
  handler: (req, res, _next, options) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      email: req.body?.email,
      path: req.path,
    });
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Password reset rate limiter - 3 requests per hour
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  store: passwordResetStore as any,
  message: {
    success: false,
    message: 'Too many password reset attempts. Please try again later.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip for IIPC whitelisted IPs
    return canBypassRateLimit(req);
  },
  keyGenerator: (req) => {
    const email = req.body?.email?.toLowerCase() || '';
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
      || req.ip 
      || 'unknown';
    return `pwd-reset-${ip}-${email}`;
  },
  handler: (req, res, _next, options) => {
    logger.warn('Password reset rate limit exceeded', {
      ip: req.ip,
      email: req.body?.email,
    });
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * API endpoint rate limiter - 200 requests per 15 minutes
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    success: false,
    message: 'API rate limit exceeded. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Upload rate limiter - 20 uploads per hour
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: {
    success: false,
    message: 'Upload limit exceeded. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// Security Headers
// ============================================

/**
 * Add additional security headers
 */
export const securityHeaders = (_req: Request, res: Response, next: NextFunction) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS filter
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remove X-Powered-By header
  res.removeHeader('X-Powered-By');
  
  next();
};

// ============================================
// Request Sanitization
// ============================================

/**
 * Sanitize request body, query, and params
 */
export const sanitizeRequest = (req: Request, _res: Response, next: NextFunction) => {
  // Recursively sanitize object
  const sanitize = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    
    if (typeof obj === 'string') {
      // Remove null bytes
      let sanitized = obj.replace(/\0/g, '');
      // Remove potential prototype pollution
      if (sanitized === '__proto__' || sanitized === 'constructor' || sanitized === 'prototype') {
        return '';
      }
      return sanitized;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    
    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const key of Object.keys(obj)) {
        // Prevent prototype pollution
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue;
        }
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }
    
    return obj;
  };
  
  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query) as any;
  if (req.params) req.params = sanitize(req.params);
  
  next();
};

// ============================================
// SQL/NoSQL Injection Prevention
// ============================================

const INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|UNION|DECLARE)\b)/gi,
  /(\$where|\$gt|\$lt|\$ne|\$or|\$and|\$regex|\$exists)/gi,
  /(javascript:|data:|vbscript:)/gi,
  /(<script|<\/script|on\w+\s*=)/gi,
];

/**
 * Check for potential injection attacks
 * NOTE: Bypasses AI chat routes since they contain legitimate SQL/code terms in prompts
 */
export const injectionGuard = (req: Request, res: Response, next: NextFunction) => {
  // BYPASS: AI chat routes need SQL terms in prompts for context
  if (req.path.includes('/ai-center/chat') || req.path.includes('/ai/')) {
    next();
    return;
  }
  
  const checkValue = (value: any, path: string): boolean => {
    if (typeof value !== 'string') return false;
    
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(value)) {
        logger.warn('Potential injection attack detected', {
          ip: req.ip,
          path: req.path,
          field: path,
          value: value.substring(0, 100),
        });
        return true;
      }
    }
    return false;
  };
  
  const checkObject = (obj: any, prefix: string = ''): boolean => {
    if (!obj || typeof obj !== 'object') return false;
    
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'string' && checkValue(value, path)) {
        return true;
      }
      
      if (typeof value === 'object' && checkObject(value, path)) {
        return true;
      }
    }
    return false;
  };
  
  // Check body, query, and params
  if (checkObject(req.body, 'body') || 
      checkObject(req.query, 'query') || 
      checkObject(req.params, 'params')) {
    res.status(400).json({
      success: false,
      message: 'Invalid request data',
    });
    return;
  }
  
  next();
};

// ============================================
// Request Size Limiter
// ============================================

/**
 * Check request size
 */
export const requestSizeGuard = (maxSize: number = 10 * 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    
    if (contentLength > maxSize) {
      logger.warn('Request too large', {
        ip: req.ip,
        path: req.path,
        size: contentLength,
        maxSize,
      });
      res.status(413).json({
        success: false,
        message: 'Request entity too large',
      });
      return;
    }
    
    next();
  };
};

// ============================================
// IP Blacklist/Whitelist
// ============================================

const blacklistedIPs = new Set<string>();
const whitelistedIPs = new Set<string>();

/**
 * Add IP to blacklist
 */
export const blacklistIP = (ip: string) => {
  blacklistedIPs.add(ip);
  logger.warn('IP blacklisted', { ip });
};

/**
 * Remove IP from blacklist
 */
export const unblacklistIP = (ip: string) => {
  blacklistedIPs.delete(ip);
};

/**
 * Add IP to whitelist
 */
export const whitelistIP = (ip: string) => {
  whitelistedIPs.add(ip);
};

/**
 * Check IP against blacklist
 */
export const ipFilter = (req: Request, res: Response, next: NextFunction) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
    || req.ip 
    || 'unknown';
  
  // Check whitelist first
  if (whitelistedIPs.has(ip)) {
    return next();
  }
  
  // Check blacklist
  if (blacklistedIPs.has(ip)) {
    logger.warn('Blacklisted IP attempted access', { ip, path: req.path });
    return res.status(403).json({
      success: false,
      message: 'Access denied',
    });
  }
  
  next();
};

// ============================================
// Suspicious Activity Tracker
// ============================================

interface SuspiciousActivity {
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  paths: string[];
}

const suspiciousIPs = new Map<string, SuspiciousActivity>();

/**
 * Track suspicious activity and auto-blacklist
 */
export const suspiciousActivityTracker = (req: Request, _res: Response, next: NextFunction) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
    || req.ip 
    || 'unknown';
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\.\.\//, // Path traversal
    /\.(php|asp|aspx|jsp|cgi)$/i, // Script extensions
    /(wp-admin|wp-login|phpmyadmin|admin\.php)/i, // Common attack targets
    /(\%00|\%2e\%2e)/i, // Encoded attacks
  ];
  
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(req.path) || pattern.test(req.originalUrl)
  );
  
  if (isSuspicious) {
    const activity = suspiciousIPs.get(ip) || {
      count: 0,
      firstSeen: new Date(),
      lastSeen: new Date(),
      paths: [],
    };
    
    activity.count++;
    activity.lastSeen = new Date();
    activity.paths.push(req.path);
    
    suspiciousIPs.set(ip, activity);
    
    logger.warn('Suspicious activity detected', {
      ip,
      path: req.path,
      count: activity.count,
    });
    
    // Auto-blacklist after 10 suspicious requests
    if (activity.count >= 10) {
      blacklistIP(ip);
      logger.error('IP auto-blacklisted due to suspicious activity', { ip, activity });
    }
  }
  
  next();
};

// ============================================
// Clean up expired tracking data
// ============================================
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  for (const [ip, activity] of suspiciousIPs.entries()) {
    if (activity.lastSeen < oneHourAgo) {
      suspiciousIPs.delete(ip);
    }
  }
}, 15 * 60 * 1000); // Clean up every 15 minutes

export default {
  generalLimiter,
  authLimiter,
  passwordResetLimiter,
  apiLimiter,
  uploadLimiter,
  securityHeaders,
  sanitizeRequest,
  injectionGuard,
  requestSizeGuard,
  ipFilter,
  blacklistIP,
  unblacklistIP,
  whitelistIP,
  suspiciousActivityTracker,
};
