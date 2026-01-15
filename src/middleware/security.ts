import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '@/utils/logger';

/**
 * Security Middleware
 * Production-grade security protections
 */

// ============================================
// Rate Limiters
// ============================================

/**
 * General API rate limiter - 100 requests per 15 minutes
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
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
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
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
  message: {
    success: false,
    message: 'Too many password reset attempts. Please try again later.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
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
 */
export const injectionGuard = (req: Request, res: Response, next: NextFunction) => {
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
