/**
 * Intelliceil Enterprise Security Middleware
 * 
 * This middleware integrates all Intelliceil enterprise security features:
 * - Request signature validation (HMAC)
 * - SQL injection detection
 * - XSS detection
 * - Bot detection
 * - IP reputation checking
 * - Honeypot trap detection
 * - Token fingerprinting
 * - Rate limiting with smart mitigation
 */

import { Request, Response, NextFunction } from 'express';
import intelliceilService from '../services/intelliceil.service';
import { logger } from '../utils/logger';

// Extend Express Request type for enterprise security data
declare global {
  namespace Express {
    interface Request {
      intelliceilEnterprise?: {
        allowed: boolean;
        threatScore: number;
        flags: string[];
        botDetection: {
          isBot: boolean;
          confidence: number;
        };
        ipReputation: {
          score: number;
          isMalicious: boolean;
        };
      };
    }
  }
}

/**
 * Main Intelliceil enterprise security middleware
 * Performs comprehensive security checks on all incoming requests
 */
/**
 * Extract real client IP from proxy headers
 * Priority: CF-Connecting-IP > X-Real-IP > X-Forwarded-For > req.ip
 */
function getRealClientIP(req: Request): string {
  // Cloudflare header (most reliable when using CF)
  const cfIP = req.headers['cf-connecting-ip'];
  if (cfIP && typeof cfIP === 'string') return cfIP;
  
  // X-Real-IP (set by nginx/traefik)
  const realIP = req.headers['x-real-ip'];
  if (realIP && typeof realIP === 'string') return realIP;
  
  // X-Forwarded-For (can be comma-separated list, take first)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = (typeof forwardedFor === 'string' ? forwardedFor : forwardedFor[0]).split(',');
    return ips[0].trim();
  }
  
  // Fallback to Express req.ip or socket address
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Check if IP is an internal Docker/proxy IP that should be skipped for blocking
 */
function isInternalProxyIP(ip: string): boolean {
  // Docker default bridge networks
  if (ip.startsWith('172.') || ip.startsWith('::ffff:172.')) return true;
  // Docker internal
  if (ip.startsWith('10.') || ip.startsWith('::ffff:10.')) return true;
  // Localhost
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return true;
  return false;
}

// GREEN ROUTE bypass paths - critical infrastructure that should NOT be blocked
const GREEN_ROUTE_BYPASS = [
  // Health & Auth
  '/api/health', '/health',
  '/api/auth/login', '/api/auth/register', '/api/auth/refresh-token',
  '/api/auth/facebook/callback', '/api/facebook/callback',
  '/api/config/facebook',
  '/auth/login', '/auth/register', '/auth/refresh-token',
  '/auth/facebook/callback', '/facebook/callback',
  '/config/facebook',
  
  // Extension GREEN ROUTE
  '/api/extension/', '/extension/',
  
  // IAI GREEN ROUTE - Critical for soldiers
  '/api/iai/pattern', '/api/iai/metrics', '/api/iai/register',
  '/api/iai/heartbeat', '/api/iai/log-activity', '/api/iai/',
  '/iai/pattern', '/iai/metrics', '/iai/register',
  '/iai/heartbeat', '/iai/log-activity', '/iai/',
  
  // Injection GREEN ROUTE
  '/api/injection/', '/injection/',
  
  // Admin GREEN ROUTE
  '/api/admin/', '/admin/',
  
  // Training console
  '/api/training/', '/training/',
];

/**
 * Check if path is a GREEN ROUTE bypass
 */
function isGreenRoutePath(path: string): boolean {
  return GREEN_ROUTE_BYPASS.some(bypass => {
    if (path === bypass) return true;
    if (bypass.endsWith('/') && path.startsWith(bypass)) return true;
    if (path.startsWith(bypass)) return true;
    return false;
  });
}

export const intelliceilEnterpriseMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // GREEN ROUTE BYPASS - Skip ALL security checks for critical infrastructure
    if (isGreenRoutePath(req.path)) {
      next();
      return;
    }
    
    const rawIP = req.ip || req.socket.remoteAddress || 'unknown';
    const ip = getRealClientIP(req);
    
    // Skip security checks for internal proxy IPs (Traefik, Docker internal)
    if (isInternalProxyIP(rawIP) && ip === rawIP) {
      // No real client IP found, this is an internal request - allow it
      next();
      return;
    }
    
    const userAgent = req.headers['user-agent'] || '';
    const endpoint = req.path;
    const method = req.method;
    const referer = req.headers['referer'] as string | undefined;
    
    // Extract signature headers if present
    const signature = req.headers['x-signature'] as string | undefined;
    const timestamp = req.headers['x-timestamp'] ? parseInt(req.headers['x-timestamp'] as string) : undefined;
    const nonce = req.headers['x-nonce'] as string | undefined;

    // 1. Record the request for traffic analysis
    const trafficDecision = intelliceilService.recordRequest({
      ip,
      endpoint,
      method,
      referer,
      userAgent,
      country: (req.headers['cf-ipcountry'] || req.headers['x-country']) as string | undefined,
    });

    // If basic traffic check blocks the request, deny immediately
    if (!trafficDecision.allowed) {
      logger.warn(`🛡️ Intelliceil blocked request from ${ip}: ${trafficDecision.reason}`);
      res.status(429).json({
        error: 'Request blocked',
        reason: 'Traffic limits exceeded',
        code: 'INTELLICEIL_BLOCKED'
      });
      return;
    }

    // 2. Perform comprehensive security check
    const securityResult = await intelliceilService.performSecurityCheck({
      ip,
      endpoint,
      userAgent,
      body: { ...req.body, ...req.query, ...req.params },
      signature,
      timestamp,
      nonce,
    });

    // Attach security info to request for downstream use
    req.intelliceilEnterprise = {
      allowed: securityResult.valid,
      threatScore: securityResult.threatScore || 0,
      flags: securityResult.reason ? [securityResult.reason] : [],
      botDetection: intelliceilService.detectBot(userAgent, ip, Date.now()),
      ipReputation: await intelliceilService.checkIPReputation(ip),
    };

    // Block high-threat requests
    if (!securityResult.valid && (securityResult.threatScore || 0) >= 70) {
      logger.warn(`🚨 High threat request blocked from ${ip}: ${securityResult.reason}`);
      res.status(403).json({
        error: 'Security check failed',
        reason: 'Request blocked for security reasons',
        code: 'INTELLICEIL_SECURITY_BLOCK'
      });
      return;
    }

    // Log medium-threat requests but allow them
    if ((securityResult.threatScore || 0) >= 30) {
      logger.info(`⚠️ Medium threat request from ${ip}: ${securityResult.reason}`);
    }

    next();
  } catch (error) {
    logger.error('Intelliceil middleware error:', error);
    // Don't block on middleware errors, but log them
    next();
  }
};

/**
 * Signature validation middleware for sensitive endpoints
 * Requires X-Signature, X-Timestamp headers
 */
export const requireSignature = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const signature = req.headers['x-signature'] as string;
  const timestamp = parseInt(req.headers['x-timestamp'] as string);
  const nonce = req.headers['x-nonce'] as string | undefined;

  if (!signature || !timestamp) {
    res.status(401).json({
      error: 'Missing signature',
      message: 'This endpoint requires request signing',
      code: 'SIGNATURE_REQUIRED'
    });
    return;
  }

  const payload = JSON.stringify(req.body);
  const result = intelliceilService.validateRequestSignature(payload, signature, timestamp, nonce);

  if (!result.valid) {
    logger.warn(`🚨 Invalid signature from ${req.ip}: ${result.reason}`);
    res.status(403).json({
      error: 'Invalid signature',
      message: result.reason,
      code: 'SIGNATURE_INVALID'
    });
    return;
  }

  next();
};

/**
 * Bot detection middleware
 * Blocks requests detected as automated bots
 */
export const blockBots = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  const botResult = intelliceilService.detectBot(userAgent, ip, Date.now());

  if (botResult.isBot && botResult.confidence >= 70) {
    logger.info(`🤖 Bot blocked from ${ip}: ${botResult.reason}`);
    res.status(403).json({
      error: 'Automated requests not allowed',
      code: 'BOT_DETECTED'
    });
    return;
  }

  next();
};

/**
 * Input validation middleware
 * Scans request body for SQL injection and XSS
 */
export const validateInput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const input = { ...req.body, ...req.query, ...req.params };
  const result = intelliceilService.validateRequestInput(input);

  if (!result.valid) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    logger.warn(`🚨 Malicious input detected from ${ip}: ${result.reason}`);
    
    // Block the IP if threat score is high
    if ((result.threatScore || 0) >= 90) {
      intelliceilService.manualBlock(ip);
    }

    res.status(400).json({
      error: 'Invalid input',
      message: 'Request contains potentially malicious content',
      code: 'MALICIOUS_INPUT'
    });
    return;
  }

  next();
};

/**
 * Honeypot middleware
 * Sets up trap endpoints to catch scanners
 */
export const honeypotTrap = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { isHoneypot, action } = intelliceilService.checkHoneypot(req.path);

  if (isHoneypot) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    logger.warn(`🍯 Honeypot triggered by ${ip} at ${req.path}`);
    
    if (action === 'block_and_flag') {
      intelliceilService.manualBlock(ip);
    }

    // Return a fake "interesting" response to waste attacker's time
    res.status(200).send('<!DOCTYPE html><html><head><title>Admin Panel</title></head><body><h1>Loading...</h1><script>setTimeout(function(){window.location.reload()},5000);</script></body></html>');
    return;
  }

  next();
};

/**
 * Token fingerprint validation middleware
 * Validates that the token is being used from the same device/browser
 */
export const validateTokenFingerprint = (storedFingerprint: {
  userAgent: string;
  ip: string;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const currentUserAgent = req.headers['user-agent'] || '';
    const currentIP = req.ip || req.socket.remoteAddress || 'unknown';

    const result = intelliceilService.validateTokenFingerprint(
      { ...storedFingerprint, fingerprint: '', createdAt: new Date() },
      currentUserAgent,
      currentIP
    );

    if (!result.valid && (result.threatScore || 0) >= 70) {
      logger.warn(`🚨 Token fingerprint mismatch for ${currentIP}: ${result.reason}`);
      res.status(401).json({
        error: 'Session validation failed',
        message: 'Please re-authenticate',
        code: 'TOKEN_FINGERPRINT_MISMATCH'
      });
      return;
    }

    next();
  };
};

/**
 * API rate limiting with Intelliceil awareness
 */
export const apiRateLimit = (maxRequests: number, windowSeconds: number) => {
  const requestCounts = new Map<string, { count: number; windowStart: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const record = requestCounts.get(ip);
    
    if (!record || (now - record.windowStart) > windowSeconds * 1000) {
      requestCounts.set(ip, { count: 1, windowStart: now });
      next();
      return;
    }

    record.count++;

    if (record.count > maxRequests) {
      logger.info(`🛑 Rate limit exceeded for ${ip}: ${record.count}/${maxRequests} in ${windowSeconds}s`);
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Maximum ${maxRequests} requests per ${windowSeconds} seconds`,
        retryAfter: Math.ceil((record.windowStart + windowSeconds * 1000 - now) / 1000),
        code: 'RATE_LIMIT_EXCEEDED'
      });
      return;
    }

    next();
  };
};

export default intelliceilEnterpriseMiddleware;
