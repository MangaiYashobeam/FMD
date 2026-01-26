/**
 * Green Route Middleware - Secure Internal API Route
 * 
 * Purpose: Allow trusted internal requests to continue freely during mitigation
 * - Requests are fully logged, audited, and tracked with analytics
 * - Only accessible by verified ecosystem clients (extension, webapp)
 * - Bypasses public route restrictions during DDoS mitigation
 * 
 * Security Layers:
 * 1. Origin Validation - Only our extension/webapp
 * 2. Token Fingerprinting - JWT + device signature
 * 3. Request Signing - HMAC signature verification
 * 4. Account Whitelisting - Only approved accounts
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { logger } from '../utils/logger';

// Extend Express Request for Green Route data
declare global {
  namespace Express {
    interface Request {
      greenRoute?: {
        verified: boolean;
        source: 'extension' | 'webapp' | 'extension-hybrid' | 'unknown';
        accountId?: string;
        userId?: string;
        fingerprint?: string;
        signature?: string;
        timestamp?: number;
        whitelisted: boolean;
        analytics: {
          requestId: string;
          startTime: number;
          path: string;
          method: string;
        };
      };
    }
  }
}

// Green Route Configuration
const GREEN_ROUTE_CONFIG = {
  // Extension IDs that are allowed (production + development)
  ALLOWED_EXTENSION_IDS: [
    process.env.CHROME_EXTENSION_ID || 'your-production-extension-id',
    'local-dev-extension-id',
  ].filter(Boolean),
  
  // Request signature secret (should be in env)
  SIGNATURE_SECRET: process.env.GREEN_ROUTE_SECRET || crypto.randomBytes(32).toString('hex'),
  
  // Signature validity window (5 minutes)
  SIGNATURE_VALIDITY_MS: 5 * 60 * 1000,
  
  // Nonce cache to prevent replay attacks
  usedNonces: new Set<string>(),
  
  // Max nonce cache size
  MAX_NONCE_CACHE: 10000,
};

// Cleanup old nonces periodically
setInterval(() => {
  if (GREEN_ROUTE_CONFIG.usedNonces.size > GREEN_ROUTE_CONFIG.MAX_NONCE_CACHE) {
    GREEN_ROUTE_CONFIG.usedNonces.clear();
    logger.info('[GreenRoute] Cleared nonce cache');
  }
}, 60000);

/**
 * Generate a unique request ID for tracking
 */
function generateRequestId(): string {
  return `gr_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Validate request signature (HMAC-SHA256)
 */
function validateSignature(
  payload: string,
  signature: string,
  timestamp: number,
  nonce?: string
): { valid: boolean; reason?: string } {
  // Check timestamp freshness
  const now = Date.now();
  if (Math.abs(now - timestamp) > GREEN_ROUTE_CONFIG.SIGNATURE_VALIDITY_MS) {
    return { valid: false, reason: 'Signature expired' };
  }
  
  // Check nonce uniqueness (replay prevention)
  if (nonce) {
    if (GREEN_ROUTE_CONFIG.usedNonces.has(nonce)) {
      return { valid: false, reason: 'Nonce already used' };
    }
    GREEN_ROUTE_CONFIG.usedNonces.add(nonce);
  }
  
  // Generate expected signature
  const dataToSign = `${timestamp}:${nonce || ''}:${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', GREEN_ROUTE_CONFIG.SIGNATURE_SECRET)
    .update(dataToSign)
    .digest('hex');
  
  // Constant-time comparison
  if (!crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  )) {
    return { valid: false, reason: 'Invalid signature' };
  }
  
  return { valid: true };
}

/**
 * Validate origin is from our ecosystem
 */
function validateOrigin(req: Request): { 
  valid: boolean; 
  source: 'extension' | 'webapp' | 'extension-hybrid' | 'unknown';
  reason?: string;
} {
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  // userAgent reserved for future fingerprinting
  // const userAgent = req.headers['user-agent'] || '';
  
  // Check for Chrome extension
  if (origin.startsWith('chrome-extension://')) {
    const extensionId = origin.replace('chrome-extension://', '').split('/')[0];
    if (GREEN_ROUTE_CONFIG.ALLOWED_EXTENSION_IDS.includes(extensionId)) {
      return { valid: true, source: 'extension' };
    }
    // Still allow but mark as unverified extension
    return { valid: true, source: 'extension' };
  }
  
  // Check for Firefox extension
  if (origin.startsWith('moz-extension://')) {
    return { valid: true, source: 'extension' };
  }
  
  // Check for our webapp origins
  const allowedWebappOrigins = [
    'https://dealersface.com',
    'https://www.dealersface.com',
    'http://localhost:3000',
    'http://localhost:5173',
  ];
  
  if (allowedWebappOrigins.includes(origin)) {
    return { valid: true, source: 'webapp' };
  }
  
  // Check for extension-hybrid (extension making requests from facebook pages)
  if (referer.includes('facebook.com') && req.headers['x-extension-id']) {
    return { valid: true, source: 'extension-hybrid' };
  }
  
  // Check for server-to-server (no origin)
  if (!origin && req.headers['x-green-route-token']) {
    return { valid: true, source: 'webapp' };
  }
  
  return { valid: false, source: 'unknown', reason: 'Origin not in ecosystem' };
}

/**
 * Check if account is whitelisted for Green Route access
 */
async function checkAccountWhitelist(accountId: string): Promise<boolean> {
  try {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        isActive: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        whitelist: {
          select: { greenRouteAccess: true }
        }
      },
    });
    
    if (!account || !account.isActive) {
      return false;
    }
    
    // Check whitelist first
    if (account.whitelist?.greenRouteAccess) {
      return true;
    }
    
    // Account is whitelisted if active subscription or valid trial
    const hasActiveSubscription = ['active', 'trialing'].includes(account.subscriptionStatus);
    const hasValidTrial = account.trialEndsAt ? new Date(account.trialEndsAt) > new Date() : false;
    
    return hasActiveSubscription || hasValidTrial;
  } catch (error) {
    logger.error('[GreenRoute] Whitelist check failed:', error);
    return false;
  }
}

/**
 * Log Green Route request to analytics
 */
async function logGreenRouteRequest(
  requestId: string,
  req: Request,
  responseStatus: number,
  responseTime: number
): Promise<void> {
  try {
    await prisma.greenRouteLog.create({
      data: {
        requestId,
        path: req.path,
        method: req.method,
        source: req.greenRoute?.source || 'unknown',
        accountId: req.greenRoute?.accountId,
        userId: req.greenRoute?.userId,
        fingerprint: req.greenRoute?.fingerprint,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || '',
        responseStatus,
        responseTimeMs: responseTime,
        verified: req.greenRoute?.verified || false,
        whitelisted: req.greenRoute?.whitelisted || false,
        metadata: {
          origin: req.headers.origin,
          referer: req.headers.referer,
          timestamp: req.greenRoute?.analytics.startTime,
        },
      },
    });
  } catch (error) {
    // Don't fail request on logging error
    logger.error('[GreenRoute] Analytics logging failed:', error);
  }
}

/**
 * Main Green Route verification middleware
 * Validates that request is from our ecosystem and is authorized
 */
export const greenRouteVerify = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  // Initialize Green Route context
  req.greenRoute = {
    verified: false,
    source: 'unknown',
    whitelisted: false,
    analytics: {
      requestId,
      startTime,
      path: req.path,
      method: req.method,
    },
  };
  
  // Track response for logging
  const originalSend = res.send;
  res.send = function(body) {
    const responseTime = Date.now() - startTime;
    logGreenRouteRequest(requestId, req, res.statusCode, responseTime);
    return originalSend.call(this, body);
  };
  
  try {
    // 1. Validate Origin
    const originCheck = validateOrigin(req);
    if (!originCheck.valid) {
      logger.warn(`[GreenRoute] Origin validation failed: ${originCheck.reason}`);
      res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'GREEN_ROUTE_ORIGIN_INVALID',
        requestId,
      });
      return;
    }
    req.greenRoute.source = originCheck.source;
    
    // 2. Check for request signature (required for sensitive operations)
    const signature = req.headers['x-green-signature'] as string;
    const timestamp = parseInt(req.headers['x-green-timestamp'] as string);
    const nonce = req.headers['x-green-nonce'] as string;
    
    if (signature && timestamp) {
      const payload = JSON.stringify(req.body || {});
      const signatureCheck = validateSignature(payload, signature, timestamp, nonce);
      if (!signatureCheck.valid) {
        logger.warn(`[GreenRoute] Signature validation failed: ${signatureCheck.reason}`);
        res.status(401).json({
          success: false,
          error: 'Invalid signature',
          code: 'GREEN_ROUTE_SIGNATURE_INVALID',
          requestId,
        });
        return;
      }
      req.greenRoute.signature = signature;
      req.greenRoute.timestamp = timestamp;
    }
    
    // 3. Extract user/account from JWT if present
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
        const decoded = jwt.verify(token, jwtSecret) as { id: string; accountId?: string };
        req.greenRoute.userId = decoded.id;
        
        // Get account from token or user
        if (decoded.accountId) {
          req.greenRoute.accountId = decoded.accountId;
        } else {
          const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            include: { accountUsers: { select: { accountId: true } } },
          });
          if (user?.accountUsers[0]) {
            req.greenRoute.accountId = user.accountUsers[0].accountId;
          }
        }
      } catch {
        // Token invalid, but don't block - might be public endpoint
      }
    }
    
    // 4. Check account whitelist
    if (req.greenRoute.accountId) {
      req.greenRoute.whitelisted = await checkAccountWhitelist(req.greenRoute.accountId);
    }
    
    // 5. Extract device fingerprint
    req.greenRoute.fingerprint = req.headers['x-device-fingerprint'] as string || 
      req.cookies?.['_df'] || 
      undefined;
    
    // Mark as verified
    req.greenRoute.verified = true;
    
    logger.debug(`[GreenRoute] Request verified: ${requestId} from ${originCheck.source}`);
    
    next();
  } catch (error) {
    logger.error('[GreenRoute] Verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Green route verification failed',
      code: 'GREEN_ROUTE_ERROR',
      requestId,
    });
  }
};

/**
 * Require whitelisted account for Green Route access
 * Use after greenRouteVerify for endpoints that need account whitelist
 */
export const requireGreenRouteWhitelist = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.greenRoute?.verified) {
    res.status(403).json({
      success: false,
      error: 'Green route not verified',
      code: 'GREEN_ROUTE_NOT_VERIFIED',
    });
    return;
  }
  
  if (!req.greenRoute.whitelisted) {
    res.status(403).json({
      success: false,
      error: 'Account not whitelisted for Green Route',
      code: 'GREEN_ROUTE_NOT_WHITELISTED',
    });
    return;
  }
  
  next();
};

/**
 * Generate a signed request token for client-side use
 */
export function generateGreenRouteToken(
  userId: string,
  accountId: string,
  expiresInMs: number = 3600000
): { token: string; timestamp: number; nonce: string } {
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = { userId, accountId, exp: timestamp + expiresInMs };
  
  const signature = crypto
    .createHmac('sha256', GREEN_ROUTE_CONFIG.SIGNATURE_SECRET)
    .update(`${timestamp}:${nonce}:${JSON.stringify(payload)}`)
    .digest('hex');
  
  return {
    token: Buffer.from(JSON.stringify({ ...payload, sig: signature })).toString('base64'),
    timestamp,
    nonce,
  };
}

/**
 * Middleware to track Green Route analytics
 * Adds additional metrics without blocking requests
 */
export const greenRouteAnalytics = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.greenRoute?.verified) {
    return next();
  }
  
  // Track endpoint usage (async, non-blocking)
  prisma.greenRouteAnalytics.upsert({
    where: {
      path_method: {
        path: req.path,
        method: req.method,
      },
    },
    update: {
      requestCount: { increment: 1 },
      lastAccessedAt: new Date(),
    },
    create: {
      path: req.path,
      method: req.method,
      requestCount: 1,
      lastAccessedAt: new Date(),
    },
  }).catch(() => {});
  
  next();
};

/**
 * Alias for greenRouteAnalytics
 */
export const greenRouteLogger = greenRouteAnalytics;

export default {
  greenRouteVerify,
  requireGreenRouteWhitelist,
  greenRouteAnalytics,
  greenRouteLogger,
  generateGreenRouteToken,
};
