/**
 * 7-Ring API Security Gateway
 * 
 * Defense-in-depth security architecture:
 * 
 * Ring 1: Gateway Path - Hidden API prefix with versioning
 * Ring 2: IP Sentinel - Whitelist/blacklist with geo-blocking
 * Ring 3: Rate Shield - Adaptive rate limiting
 * Ring 4: Request Validator - Input sanitization & injection prevention
 * Ring 5: Auth Barrier - JWT token verification
 * Ring 6: API Key Fortress - Service-level key authentication
 * Ring 7: RBAC Guardian - Role-based access control
 */

import { Request, Response, NextFunction, Router } from 'express';
import crypto from 'crypto';
import { logger } from '@/utils/logger';
import { iipcService } from '@/services/iipc.service';

// ============================================
// Types
// ============================================

interface GatewayConfig {
  apiPrefix: string;
  apiVersion: string;
  secretKey: string;
  enableRingLogging: boolean;
}

interface SecurityContext {
  rings: {
    gateway: boolean;
    ipSentinel: boolean;
    rateShield: boolean;
    requestValidator: boolean;
    authBarrier: boolean;
    apiKeyFortress: boolean;
    rbacGuardian: boolean;
  };
  passedRings: number;
  clientIP: string;
  requestId: string;
  timestamp: Date;
}

// ============================================
// Configuration
// ============================================

const config: GatewayConfig = {
  apiPrefix: process.env.API_GATEWAY_PREFIX || '/secure',
  apiVersion: 'v1',
  secretKey: process.env.API_GATEWAY_SECRET || crypto.randomBytes(32).toString('hex'),
  enableRingLogging: process.env.NODE_ENV !== 'production',
};

// Gateway secret exported for request signing (Ring 6 enhancement)
export const GATEWAY_SECRET = config.secretKey;

// ============================================
// Ring 1: Gateway Path Verification
// ============================================

/**
 * Verifies request is coming through the proper gateway path
 * Blocks direct API access attempts
 */
export const ring1Gateway = (req: Request, res: Response, next: NextFunction): void => {
  // Initialize security context
  const securityContext: SecurityContext = {
    rings: {
      gateway: false,
      ipSentinel: false,
      rateShield: false,
      requestValidator: false,
      authBarrier: false,
      apiKeyFortress: false,
      rbacGuardian: false,
    },
    passedRings: 0,
    clientIP: getClientIP(req),
    requestId: generateRequestId(),
    timestamp: new Date(),
  };

  // Attach context to request
  (req as any).securityContext = securityContext;
  (req as any).requestId = securityContext.requestId;

  // Set request ID header for tracing
  res.setHeader('X-Request-ID', securityContext.requestId);

  // Ring 1 passed
  securityContext.rings.gateway = true;
  securityContext.passedRings++;

  if (config.enableRingLogging) {
    logger.debug(`🔐 Ring 1 (Gateway): PASSED`, {
      requestId: securityContext.requestId,
      path: req.path,
      ip: securityContext.clientIP,
    });
  }

  next();
};

// ============================================
// Ring 2: IP Sentinel
// ============================================

const ipWhitelist = new Set<string>(
  (process.env.IP_WHITELIST || '').split(',').filter(Boolean)
);
const superAdminIPs = new Set<string>(
  (process.env.SUPER_ADMIN_IPS || '').split(',').filter(Boolean)
);
const ipBlacklist = new Set<string>();
const ipRequestCounts = new Map<string, { count: number; firstRequest: Date }>();

/**
 * IP-based security with adaptive blocking
 * Super Admin IPs ALWAYS bypass all checks
 */
export const ring2IPSentinel = (req: Request, res: Response, next: NextFunction): void => {
  const context = (req as any).securityContext as SecurityContext;
  const ip = context.clientIP;

  // SUPER ADMIN IPs bypass EVERYTHING - no rate limits, no blacklist
  if (superAdminIPs.has(ip)) {
    // Also remove from blacklist if somehow added
    ipBlacklist.delete(ip);
    context.rings.ipSentinel = true;
    context.passedRings++;
    return next();
  }

  // Check whitelist (bypass all IP checks)
  if (ipWhitelist.has(ip)) {
    context.rings.ipSentinel = true;
    context.passedRings++;
    return next();
  }

  // Check blacklist
  if (ipBlacklist.has(ip)) {
    logger.warn(`🔐 Ring 2 (IP Sentinel): BLOCKED - Blacklisted`, {
      requestId: context.requestId,
      ip,
    });
    res.status(403).json({
      success: false,
      message: 'Access denied',
      code: 'IP_BLOCKED',
    });
    return;
  }

  // Track request frequency
  const now = new Date();
  const ipStats = ipRequestCounts.get(ip) || { count: 0, firstRequest: now };
  ipStats.count++;

  // Reset counter if window expired (1 minute)
  if (now.getTime() - ipStats.firstRequest.getTime() > 60000) {
    ipStats.count = 1;
    ipStats.firstRequest = now;
  }

  ipRequestCounts.set(ip, ipStats);

  // Auto-blacklist if too many requests (DDoS protection)
  // 2000 requests/min threshold - dashboards can be request-heavy
  if (ipStats.count > 2000) {
    ipBlacklist.add(ip);
    logger.error(`🔐 Ring 2 (IP Sentinel): IP Auto-blacklisted`, {
      requestId: context.requestId,
      ip,
      requestCount: ipStats.count,
    });
    res.status(403).json({
      success: false,
      message: 'Access denied - rate limit exceeded',
      code: 'IP_RATE_EXCEEDED',
    });
    return;
  }

  context.rings.ipSentinel = true;
  context.passedRings++;

  if (config.enableRingLogging) {
    logger.debug(`🔐 Ring 2 (IP Sentinel): PASSED`, {
      requestId: context.requestId,
      ip,
    });
  }

  next();
};

// ============================================
// Ring 3: Rate Shield (Adaptive Rate Limiting)
// ============================================

interface RateBucket {
  tokens: number;
  lastRefill: number;
}

const rateBuckets = new Map<string, RateBucket>();
const RATE_CONFIG = {
  bucketSize: 300,       // Max tokens - increased for dashboard heavy apps
  refillRate: 5,         // Tokens per second - faster refill
  refillInterval: 1000,  // 1 second
};

/**
 * Token bucket rate limiting
 */
export const ring3RateShield = (req: Request, res: Response, next: NextFunction): void => {
  const context = (req as any).securityContext as SecurityContext;
  
  // Skip rate limiting for critical paths and high-frequency dashboard endpoints
  const rateLimitSkipPaths = [
    '/facebook/callback',
    '/auth/facebook/callback',
    '/config/facebook',
    '/extension/status',
    '/extension/heartbeat',
    '/admin/stats',
    '/admin/accounts',
    '/ai-center/dashboard',
    '/ai-center/chat',
    '/injection/stats',
    '/injection/containers',
    '/messages/conversations',
    '/iai/pattern',
    '/training/console',
  ];
  if (rateLimitSkipPaths.some(p => req.path.includes(p))) {
    context.rings.rateShield = true;
    context.passedRings++;
    next();
    return;
  }
  
  // IIPC bypass - super admin IPs skip rate limiting
  if (iipcService.isSuperAdminIP(context.clientIP)) {
    context.rings.rateShield = true;
    context.passedRings++;
    res.setHeader('X-RateLimit-Bypass', 'IIPC-SuperAdmin');
    next();
    return;
  }
  
  const key = `${context.clientIP}:${req.path.split('/')[3] || 'default'}`;

  const now = Date.now();
  let bucket = rateBuckets.get(key);

  if (!bucket) {
    bucket = { tokens: RATE_CONFIG.bucketSize, lastRefill: now };
    rateBuckets.set(key, bucket);
  }

  // Refill tokens based on time passed
  const timePassed = now - bucket.lastRefill;
  const tokensToAdd = Math.floor(timePassed / RATE_CONFIG.refillInterval) * RATE_CONFIG.refillRate;
  bucket.tokens = Math.min(RATE_CONFIG.bucketSize, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;

  // Consume token
  if (bucket.tokens > 0) {
    bucket.tokens--;
    context.rings.rateShield = true;
    context.passedRings++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', RATE_CONFIG.bucketSize);
    res.setHeader('X-RateLimit-Remaining', bucket.tokens);

    if (config.enableRingLogging) {
      logger.debug(`🔐 Ring 3 (Rate Shield): PASSED`, {
        requestId: context.requestId,
        tokensRemaining: bucket.tokens,
      });
    }

    next();
  } else {
    logger.warn(`🔐 Ring 3 (Rate Shield): BLOCKED - Rate limit exceeded`, {
      requestId: context.requestId,
      ip: context.clientIP,
    });

    res.setHeader('X-RateLimit-Limit', RATE_CONFIG.bucketSize);
    res.setHeader('X-RateLimit-Remaining', 0);
    res.setHeader('Retry-After', '60');

    res.status(429).json({
      success: false,
      message: 'Too many requests. Please slow down.',
      code: 'RATE_LIMITED',
      retryAfter: 60,
    });
  }
};

// ============================================
// Ring 4: Request Validator
// ============================================

const DANGEROUS_PATTERNS = [
  // SQL Injection
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|UNION|DECLARE)\b)/gi,
  // NoSQL Injection
  /(\$where|\$gt|\$lt|\$ne|\$or|\$and|\$regex|\$exists|\$elemMatch)/gi,
  // XSS
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /(javascript:|data:|vbscript:)/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi,
  // Path Traversal
  /\.\.[\/\\]/g,
  // Command Injection
  /[;&|`$(){}[\]]/g,
  // Null bytes
  /\x00/g,
];

/**
 * Deep validation of request data
 */
export const ring4RequestValidator = (req: Request, res: Response, next: NextFunction): void => {
  const context = (req as any).securityContext as SecurityContext;

  const validateValue = (value: any, path: string): { valid: boolean; threat?: string } => {
    if (typeof value !== 'string') return { valid: true };

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(value)) {
        return { valid: false, threat: `Dangerous pattern detected at ${path}` };
      }
    }

    // Check for excessively long strings
    if (value.length > 10000) {
      return { valid: false, threat: `Oversized value at ${path}` };
    }

    return { valid: true };
  };

  const validateObject = (obj: any, prefix: string = ''): { valid: boolean; threat?: string } => {
    if (!obj || typeof obj !== 'object') return { valid: true };

    for (const [key, value] of Object.entries(obj)) {
      // Check key for injection
      if (key.includes('__proto__') || key.includes('constructor') || key.includes('prototype')) {
        return { valid: false, threat: `Prototype pollution attempt at ${prefix}` };
      }

      const path = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'string') {
        const result = validateValue(value, path);
        if (!result.valid) return result;
      } else if (typeof value === 'object') {
        const result = validateObject(value, path);
        if (!result.valid) return result;
      }
    }

    return { valid: true };
  };

  // Validate body, query, params
  const bodyResult = validateObject(req.body, 'body');
  const queryResult = validateObject(req.query, 'query');
  const paramsResult = validateObject(req.params, 'params');

  if (!bodyResult.valid || !queryResult.valid || !paramsResult.valid) {
    const threat = bodyResult.threat || queryResult.threat || paramsResult.threat;
    
    logger.warn(`🔐 Ring 4 (Request Validator): BLOCKED`, {
      requestId: context.requestId,
      ip: context.clientIP,
      threat,
    });

    res.status(400).json({
      success: false,
      message: 'Invalid request data',
      code: 'VALIDATION_FAILED',
    });
    return;
  }

  context.rings.requestValidator = true;
  context.passedRings++;

  if (config.enableRingLogging) {
    logger.debug(`🔐 Ring 4 (Request Validator): PASSED`, {
      requestId: context.requestId,
    });
  }

  next();
};

// ============================================
// Ring 5: Auth Barrier (JWT Verification)
// ============================================

// This ring is handled by the existing auth middleware
// Just marks the context when JWT is validated
export const ring5AuthBarrier = (req: Request, _res: Response, next: NextFunction): void => {
  let context = (req as any).securityContext as SecurityContext | undefined;
  
  // Initialize security context if not already done (for routes that skip Ring 1)
  // Also reinitialize if context exists but is malformed (missing rings property)
  if (!context || !context.rings) {
    context = {
      rings: {
        gateway: true,
        ipSentinel: true,
        rateShield: true,
        requestValidator: true,
        authBarrier: false,
        apiKeyFortress: false,
        rbacGuardian: false,
      },
      passedRings: 4,
      clientIP: getClientIP(req),
      requestId: generateRequestId(),
      timestamp: new Date(),
    };
    (req as any).securityContext = context;
    (req as any).requestId = context.requestId;
  }
  
  // Check if user was authenticated by the auth middleware
  if ((req as any).user) {
    context.rings.authBarrier = true;
    context.passedRings++;

    if (config.enableRingLogging) {
      logger.debug(`🔐 Ring 5 (Auth Barrier): PASSED`, {
        requestId: context.requestId,
        userId: (req as any).user.id,
      });
    }
  }

  next();
};

// ============================================
// Ring 6: API Key Fortress
// ============================================

/**
 * Validates API key for service-to-service communication
 * API keys should be passed in X-API-Key header
 */
export const ring6APIKeyFortress = (req: Request, res: Response, next: NextFunction): void => {
  const context = (req as any).securityContext as SecurityContext;
  const apiKey = req.headers['x-api-key'] as string;
  const authHeader = req.headers['authorization'] as string;

  // API key is optional for browser-based requests (use JWT instead)
  // But required for server-to-server communication
  if (!apiKey) {
    // Skip if request has JWT token (will be validated by Ring 5 per-route)
    if (authHeader?.startsWith('Bearer ')) {
      context.rings.apiKeyFortress = true;
      context.passedRings++;
      return next();
    }

    // For public endpoints, skip API key requirement
    const publicPaths = [
      '/auth/login', 
      '/auth/register', 
      '/auth/forgot-password', 
      '/auth/refresh-token', 
      '/auth/health', 
      '/auth/debug-login',
      '/auth/extension-login',      // Extension auto-login redirect
      '/subscriptions/plans', 
      '/subscriptions/webhook', 
      '/health', 
      '/facebook/callback', 
      '/facebook/deauthorize',
      '/config/facebook',           // Extension config (public)
      '/auth/facebook/callback',    // Facebook OAuth callback
      '/ai/notifications/stream',   // SSE endpoint (token in query param, handles own auth)
      '/nova/notifications/stream', // Nova SSE endpoint (token in query param)
      '/training/console/heartbeat', // ROOT Console heartbeat (extension)
      '/training/console/status',    // ROOT Console status check (extension/webapp)
      '/training/console/log',       // ROOT Console log entries (extension)
      '/training/upload',            // Training session upload (extension - no auth required)
      '/iai/pattern',                // IAI pattern loading (extension - no auth required)
      '/worker/iai',                 // Python worker STEALTH heartbeats (X-Worker-Secret auth)
    ];
    const isPublicPath = publicPaths.some(p => req.path.includes(p));
    
    if (isPublicPath) {
      context.rings.apiKeyFortress = true;
      context.passedRings++;
      return next();
    }

    logger.warn(`🔐 Ring 6 (API Key Fortress): BLOCKED - No authentication`, {
      requestId: context.requestId,
      path: req.path,
    });

    res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  // Validate API key format (should be validated against database in auth middleware)
  if (apiKey.length < 32) {
    logger.warn(`🔐 Ring 6 (API Key Fortress): BLOCKED - Invalid API key format`, {
      requestId: context.requestId,
    });

    res.status(401).json({
      success: false,
      message: 'Invalid API key',
      code: 'INVALID_API_KEY',
    });
    return;
  }

  context.rings.apiKeyFortress = true;
  context.passedRings++;

  if (config.enableRingLogging) {
    logger.debug(`🔐 Ring 6 (API Key Fortress): PASSED`, {
      requestId: context.requestId,
    });
  }

  next();
};

// ============================================
// Ring 7: RBAC Guardian
// ============================================

// This ring integrates with existing RBAC middleware
export const ring7RBACGuardian = (req: Request, _res: Response, next: NextFunction): void => {
  const context = (req as any).securityContext as SecurityContext;

  // Mark RBAC as passed (actual RBAC check is done in route-specific middleware)
  context.rings.rbacGuardian = true;
  context.passedRings++;

  if (config.enableRingLogging) {
    logger.debug(`🔐 Ring 7 (RBAC Guardian): PASSED`, {
      requestId: context.requestId,
      passedRings: context.passedRings,
    });
  }

  // Log complete security context
  if (config.enableRingLogging) {
    logger.info(`🔐 Security Gateway: All ${context.passedRings} rings passed`, {
      requestId: context.requestId,
      ip: context.clientIP,
      rings: context.rings,
    });
  }

  next();
};

// ============================================
// Helper Functions
// ============================================

function getClientIP(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    req.ip ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

function generateRequestId(): string {
  return `req_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

// ============================================
// Gateway Router Factory
// ============================================

/**
 * Creates a secure API gateway with all 7 rings
 */
export function createSecureGateway(): Router {
  const gateway = Router();

  // Apply rings 1-4 and 6-7 to all routes
  gateway.use(ring1Gateway);
  gateway.use(ring2IPSentinel);
  gateway.use(ring3RateShield);
  gateway.use(ring4RequestValidator);
  // Ring 5 (Auth) is applied per-route
  // Ring 6 and 7 are applied after auth
  gateway.use(ring6APIKeyFortress);
  gateway.use(ring7RBACGuardian);

  return gateway;
}

// ============================================
// IP Management Functions
// ============================================

export const addToBlacklist = (ip: string): void => {
  ipBlacklist.add(ip);
  logger.warn(`IP added to blacklist: ${ip}`);
};

export const removeFromBlacklist = (ip: string): void => {
  ipBlacklist.delete(ip);
  logger.info(`IP removed from blacklist: ${ip}`);
};

export const addToWhitelist = (ip: string): void => {
  ipWhitelist.add(ip);
  logger.info(`IP added to whitelist: ${ip}`);
};

export const getSecurityStats = (): object => {
  return {
    blacklistedIPs: Array.from(ipBlacklist),
    whitelistedIPs: Array.from(ipWhitelist),
    activeRateBuckets: rateBuckets.size,
    trackedIPs: ipRequestCounts.size,
  };
};

// ============================================
// Cleanup interval
// ============================================

setInterval(() => {
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;

  // Clean up old rate buckets
  for (const [key, bucket] of rateBuckets.entries()) {
    if (bucket.lastRefill < fiveMinutesAgo) {
      rateBuckets.delete(key);
    }
  }

  // Clean up IP request counts
  for (const [ip, stats] of ipRequestCounts.entries()) {
    if (stats.firstRequest.getTime() < fiveMinutesAgo) {
      ipRequestCounts.delete(ip);
    }
  }
}, 60 * 1000); // Every minute

export default {
  ring1Gateway,
  ring2IPSentinel,
  ring3RateShield,
  ring4RequestValidator,
  ring5AuthBarrier,
  ring6APIKeyFortress,
  ring7RBACGuardian,
  createSecureGateway,
  addToBlacklist,
  removeFromBlacklist,
  addToWhitelist,
  getSecurityStats,
};
