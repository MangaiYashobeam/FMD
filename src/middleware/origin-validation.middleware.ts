/**
 * Origin Validation & Pattern Obfuscation Middleware
 * 
 * Security Controls for Public Routes:
 * 1. Origin Validation - Only allow requests from our browser extension
 * 2. Pattern Obfuscation - Minify/encode request patterns before processing
 * 
 * These controls are enforced globally across all API endpoints
 */

import { Request, Response, NextFunction } from 'express';
// crypto reserved for future HMAC verification
// import crypto from 'crypto';
import { logger } from '../utils/logger';
import prisma from '../config/database';

// Extend Express Request for origin validation data
declare global {
  namespace Express {
    interface Request {
      originValidation?: {
        isValid: boolean;
        source: 'extension' | 'webapp' | 'mobile' | 'api-key' | 'internal' | 'unknown';
        extensionId?: string;
        verified: boolean;
        timestamp: number;
      };
      patternObfuscation?: {
        decoded: boolean;
        originalPattern?: string;
        obfuscationType?: 'base64' | 'hex' | 'compressed' | 'none';
      };
    }
  }
}

// Configuration
const ORIGIN_CONFIG = {
  // Allowed Chrome extension IDs
  ALLOWED_EXTENSION_IDS: new Set([
    process.env.CHROME_EXTENSION_ID,
    process.env.CHROME_EXTENSION_ID_DEV,
    // Add any known extension IDs
  ].filter(Boolean) as string[]),
  
  // Allowed webapp origins
  ALLOWED_WEBAPP_ORIGINS: new Set([
    'https://dealersface.com',
    'https://www.dealersface.com',
    'http://localhost:3000',
    'http://localhost:5173',
    process.env.FRONTEND_URL,
    process.env.API_URL,
  ].filter(Boolean) as string[]),
  
  // Public endpoints that don't require origin validation
  PUBLIC_ENDPOINTS: new Set([
    '/api/auth/health',
    '/api/health',
    '/api/subscriptions/webhook',
    '/api/facebook/deauthorize',
    '/api/facebook/data-deletion',
  ]),
  
  // Endpoints that allow API key authentication (bypasses origin check)
  API_KEY_ENDPOINTS: new Set([
    '/api/sync/',
    '/api/vehicles/',
    '/api/leads/',
  ]),
};

/**
 * Validate request origin is from our ecosystem
 */
export const validateOrigin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();
  const path = req.path;
  
  // Initialize origin validation context
  req.originValidation = {
    isValid: false,
    source: 'unknown',
    verified: false,
    timestamp: startTime,
  };
  
  // Skip public endpoints
  if (ORIGIN_CONFIG.PUBLIC_ENDPOINTS.has(path)) {
    req.originValidation.isValid = true;
    req.originValidation.source = 'internal';
    return next();
  }
  
  // Check for API key authentication
  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey && Array.from(ORIGIN_CONFIG.API_KEY_ENDPOINTS).some(ep => path.startsWith(ep))) {
    req.originValidation.isValid = true;
    req.originValidation.source = 'api-key';
    return next();
  }
  
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const extensionId = req.headers['x-extension-id'] as string;
  
  // 1. Check Chrome Extension origin
  if (origin.startsWith('chrome-extension://')) {
    const extractedId = origin.replace('chrome-extension://', '').split('/')[0];
    req.originValidation.extensionId = extractedId;
    
    if (ORIGIN_CONFIG.ALLOWED_EXTENSION_IDS.has(extractedId)) {
      req.originValidation.isValid = true;
      req.originValidation.source = 'extension';
      req.originValidation.verified = true;
      return next();
    }
    
    // Allow but mark as unverified extension
    req.originValidation.isValid = true;
    req.originValidation.source = 'extension';
    return next();
  }
  
  // 2. Check Firefox Extension origin
  if (origin.startsWith('moz-extension://')) {
    req.originValidation.isValid = true;
    req.originValidation.source = 'extension';
    return next();
  }
  
  // 3. Check webapp origin
  if (ORIGIN_CONFIG.ALLOWED_WEBAPP_ORIGINS.has(origin)) {
    req.originValidation.isValid = true;
    req.originValidation.source = 'webapp';
    req.originValidation.verified = true;
    return next();
  }
  
  // 4. Check extension header (for requests from Facebook pages)
  if (extensionId && ORIGIN_CONFIG.ALLOWED_EXTENSION_IDS.has(extensionId)) {
    req.originValidation.isValid = true;
    req.originValidation.source = 'extension';
    req.originValidation.extensionId = extensionId;
    return next();
  }
  
  // 5. Check for internal/server requests (no origin)
  if (!origin && !referer) {
    // Allow server-to-server with proper auth
    if (req.headers.authorization || apiKey) {
      req.originValidation.isValid = true;
      req.originValidation.source = 'internal';
      return next();
    }
  }
  
  // 6. Check referer for webapp
  if (referer) {
    const refererOrigin = new URL(referer).origin;
    if (ORIGIN_CONFIG.ALLOWED_WEBAPP_ORIGINS.has(refererOrigin)) {
      req.originValidation.isValid = true;
      req.originValidation.source = 'webapp';
      return next();
    }
  }
  
  // Origin not validated - log and block
  logger.warn(`[OriginValidation] Blocked request from origin: ${origin || 'none'}, path: ${path}`);
  
  // Log blocked request for analysis
  prisma.originValidationLog.create({
    data: {
      path,
      method: req.method,
      origin: origin || null,
      referer: referer || null,
      extensionId: extensionId || null,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || '',
      blocked: true,
      reason: 'Origin not in allowed list',
    },
  }).catch(() => {});
  
  res.status(403).json({
    success: false,
    error: 'Origin not allowed',
    code: 'ORIGIN_VALIDATION_FAILED',
    message: 'This API only accepts requests from authorized sources',
  });
};

/**
 * Pattern Obfuscation - Decode obfuscated request patterns
 * Clients should encode sensitive patterns before sending
 */
export const decodePattern = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  req.patternObfuscation = {
    decoded: false,
    obfuscationType: 'none',
  };
  
  try {
    // Check for obfuscated body
    const obfuscatedPattern = req.body?._obfuscatedPattern;
    const obfuscationType = req.headers['x-pattern-encoding'] as string;
    
    if (obfuscatedPattern && obfuscationType) {
      let decodedBody: any;
      
      switch (obfuscationType) {
        case 'base64':
          decodedBody = JSON.parse(
            Buffer.from(obfuscatedPattern, 'base64').toString('utf8')
          );
          break;
          
        case 'hex':
          decodedBody = JSON.parse(
            Buffer.from(obfuscatedPattern, 'hex').toString('utf8')
          );
          break;
          
        case 'compressed':
          // For gzip compressed patterns
          const zlib = require('zlib');
          const compressed = Buffer.from(obfuscatedPattern, 'base64');
          decodedBody = JSON.parse(zlib.gunzipSync(compressed).toString('utf8'));
          break;
          
        default:
          // Unknown encoding, use as-is
          decodedBody = obfuscatedPattern;
      }
      
      // Replace body with decoded content
      req.patternObfuscation.originalPattern = obfuscatedPattern;
      req.patternObfuscation.obfuscationType = obfuscationType as any;
      req.patternObfuscation.decoded = true;
      
      // Merge decoded body
      delete req.body._obfuscatedPattern;
      req.body = { ...req.body, ...decodedBody };
    }
    
    next();
  } catch (error) {
    logger.error('[PatternObfuscation] Failed to decode pattern:', error);
    // Don't block on decode error, pass through
    next();
  }
};

/**
 * Encode pattern for response (used by API to send obfuscated data)
 */
export function obfuscatePattern(
  data: any,
  encoding: 'base64' | 'hex' | 'compressed' = 'base64'
): { _obfuscatedPattern: string; encoding: string } {
  const jsonData = JSON.stringify(data);
  
  switch (encoding) {
    case 'base64':
      return {
        _obfuscatedPattern: Buffer.from(jsonData).toString('base64'),
        encoding: 'base64',
      };
      
    case 'hex':
      return {
        _obfuscatedPattern: Buffer.from(jsonData).toString('hex'),
        encoding: 'hex',
      };
      
    case 'compressed':
      const zlib = require('zlib');
      return {
        _obfuscatedPattern: zlib.gzipSync(jsonData).toString('base64'),
        encoding: 'compressed',
      };
      
    default:
      return {
        _obfuscatedPattern: Buffer.from(jsonData).toString('base64'),
        encoding: 'base64',
      };
  }
}

/**
 * Generate client-side obfuscation helper code
 */
export function getClientObfuscationHelper(): string {
  return `
// Pattern Obfuscation Helper for FaceMyDealer Extension
const PatternObfuscation = {
  encode: function(data, encoding = 'base64') {
    const json = JSON.stringify(data);
    switch (encoding) {
      case 'base64':
        return { _obfuscatedPattern: btoa(json), encoding: 'base64' };
      case 'hex':
        return { 
          _obfuscatedPattern: Array.from(json)
            .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
            .join(''),
          encoding: 'hex'
        };
      default:
        return { _obfuscatedPattern: btoa(json), encoding: 'base64' };
    }
  },
  
  decode: function(pattern, encoding = 'base64') {
    switch (encoding) {
      case 'base64':
        return JSON.parse(atob(pattern));
      case 'hex':
        return JSON.parse(
          pattern.match(/.{2}/g).map(b => String.fromCharCode(parseInt(b, 16))).join('')
        );
      default:
        return JSON.parse(atob(pattern));
    }
  }
};
`;
}

/**
 * Middleware to enforce ecosystem-only communication
 * Strict mode - blocks all non-ecosystem requests
 */
export const enforceEcosystem = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Must have passed origin validation first
  if (!req.originValidation?.isValid) {
    res.status(403).json({
      success: false,
      error: 'Ecosystem access required',
      code: 'ECOSYSTEM_ONLY',
      message: 'This endpoint requires access through the FaceMyDealer ecosystem',
    });
    return;
  }
  
  // For strict ecosystem endpoints, require extension or webapp
  const allowedSources = ['extension', 'webapp', 'internal'];
  if (!allowedSources.includes(req.originValidation.source)) {
    res.status(403).json({
      success: false,
      error: 'Invalid access source',
      code: 'ECOSYSTEM_SOURCE_INVALID',
      message: 'Access must be through extension or webapp',
    });
    return;
  }
  
  next();
};

/**
 * Log all origin validation requests for security analysis
 */
export const logOriginValidation = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  if (req.originValidation) {
    prisma.originValidationLog.create({
      data: {
        path: req.path,
        method: req.method,
        origin: req.headers.origin || null,
        referer: req.headers.referer as string || null,
        extensionId: req.originValidation.extensionId || null,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || '',
        blocked: false,
        source: req.originValidation.source,
        verified: req.originValidation.verified,
      },
    }).catch(() => {});
  }
  next();
};

export default {
  validateOrigin,
  decodePattern,
  obfuscatePattern,
  enforceEcosystem,
  logOriginValidation,
  getClientObfuscationHelper,
};
