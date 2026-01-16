/**
 * IIPC Middleware
 * 
 * Integrates IIPC access control into Express request pipeline
 */

import { Request, Response, NextFunction } from 'express';
import { iipcService, IPAccessLevel } from '@/services/iipc.service';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      iipc?: {
        allowed: boolean;
        reason?: string;
        canOverrideRateLimit: boolean;
        canOverrideLoginBlock: boolean;
        canOverrideAllSecurity: boolean;
        requiresEmergencyVerification: boolean;
        clientIP: string;
      };
    }
  }
}

/**
 * Get real client IP from various headers
 */
function getClientIP(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) 
      ? forwardedFor[0] 
      : forwardedFor.split(',')[0];
    return ips.trim();
  }
  
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP;
  }
  
  const cfConnectingIP = req.headers['cf-connecting-ip'];
  if (cfConnectingIP) {
    return Array.isArray(cfConnectingIP) ? cfConnectingIP[0] : cfConnectingIP;
  }
  
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Get computer name from headers (if available)
 */
function getComputerName(req: Request): string | undefined {
  return req.headers['x-computer-name'] as string | undefined;
}

/**
 * IIPC Check Middleware
 * Checks IP access and attaches result to request
 * Does NOT block - just provides info for other middleware to use
 */
export function iipcCheck(req: Request, _res: Response, next: NextFunction): void {
  try {
    const clientIP = getClientIP(req);
    const computerName = getComputerName(req);
    
    // Get user info from request if available (from auth middleware)
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role as IPAccessLevel | undefined;

    const result = iipcService.checkIPAccess({
      ip: clientIP,
      userId,
      userRole,
      computerName,
      isLoginAttempt: req.path.includes('/login'),
    });

    // Attach IIPC data to request
    req.iipc = {
      ...result,
      clientIP,
    };

    next();
  } catch (error) {
    console.error('IIPC middleware error:', error);
    // On error, allow request but without IIPC benefits
    req.iipc = {
      allowed: true,
      canOverrideRateLimit: false,
      canOverrideLoginBlock: false,
      canOverrideAllSecurity: false,
      requiresEmergencyVerification: false,
      clientIP: getClientIP(req),
    };
    next();
  }
}

/**
 * IIPC Enforce Middleware
 * Use this on routes that require strict IP checking
 * Will block requests if IP is not allowed
 */
export function iipcEnforce(req: Request, res: Response, next: NextFunction): void {
  try {
    // Run check first if not already done
    if (!req.iipc) {
      const clientIP = getClientIP(req);
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role as IPAccessLevel | undefined;

      const result = iipcService.checkIPAccess({
        ip: clientIP,
        userId,
        userRole,
      });

      req.iipc = { ...result, clientIP };
    }

    // Enforce access
    if (!req.iipc.allowed) {
      if (req.iipc.requiresEmergencyVerification) {
        res.status(403).json({
          success: false,
          error: 'IP not authorized',
          reason: req.iipc.reason,
          requiresEmergencyVerification: true,
          message: 'Please verify via email to access from this IP',
        });
      } else {
        res.status(403).json({
          success: false,
          error: 'IP not authorized',
          reason: req.iipc.reason,
        });
      }
      return;
    }

    next();
  } catch (error) {
    console.error('IIPC enforce error:', error);
    next(); // Allow on error to prevent lockout
  }
}

/**
 * Rate Limit Override Middleware
 * Skips rate limiting if IIPC allows override
 */
export function iipcRateLimitOverride(rateLimitMiddleware: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if IIPC allows override
    if (req.iipc?.canOverrideRateLimit || req.iipc?.canOverrideAllSecurity) {
      return next(); // Skip rate limiting
    }
    
    // Apply normal rate limiting
    return rateLimitMiddleware(req, res, next);
  };
}

/**
 * Login Block Override Check
 * Returns true if the IP can bypass login blocks
 */
export function canBypassLoginBlock(req: Request): boolean {
  return !!(req.iipc?.canOverrideLoginBlock || req.iipc?.canOverrideAllSecurity);
}

/**
 * Security Override Check
 * Returns true if the IP can bypass all security
 */
export function canBypassAllSecurity(req: Request): boolean {
  return !!req.iipc?.canOverrideAllSecurity;
}

export default iipcCheck;
