/**
 * Intelliceil Middleware
 * 
 * Express middleware that integrates with the Intelliceil security service
 * to monitor traffic and block malicious requests
 */

import { Request, Response, NextFunction } from 'express';
import { intelliceilService } from '@/services/intelliceil.service';
import { ipIntelligenceService } from '@/services/ip-intelligence.service';
import geoip from 'geoip-lite';

// Extend Request type to include Intelliceil data
declare global {
  namespace Express {
    interface Request {
      intelliceil?: {
        allowed: boolean;
        reason?: string;
        ip: string;
        country?: string;
        city?: string;
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
 * Main Intelliceil middleware
 * Monitors all incoming requests and blocks malicious traffic
 */

// Paths that should bypass Intelliceil blocking (critical infrastructure & GREEN ROUTE)
// This MUST match GREEN_ROUTE_SKIP_PATHS in security.ts to prevent blocking extension/dashboard APIs
const BYPASS_PATHS = [
  // ============ HEALTH & AUTH ============
  '/api/health',
  '/health',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh-token',
  '/api/auth/facebook/callback',
  '/api/facebook/callback',
  '/api/config/facebook',
  
  // ============ TRAINING CONSOLE (ROOT) ============
  '/api/training/console/heartbeat',
  '/api/training/console/status',
  '/api/training/console/health-ping',
  '/api/training/console/log',
  '/api/training/',
  
  // ============ EXTENSION GREEN ROUTE ============
  '/api/extension/status',
  '/api/extension/heartbeat',
  '/api/extension/tasks',
  '/api/extension/account',
  '/api/extension/sync',
  '/api/extension/health',
  '/api/extension/ai-provider',
  '/api/extension/conversations',
  '/api/extension/stats',
  '/api/extension/generate-response',
  '/api/extension/generate-description',
  '/api/extension/analyze-conversation',
  '/api/extension/find-element',
  '/api/extension/detect-ui-changes',
  '/api/extension/iai/',  // Extension IAI soldier registration/heartbeat
  
  // ============ IAI GREEN ROUTE ============
  '/api/iai/pattern',
  '/api/iai/metrics',
  '/api/iai/register',
  '/api/iai/heartbeat',
  '/api/iai/log-activity',
  '/api/admin/iai/',
  
  // ============ INJECTION GREEN ROUTE ============
  '/api/injection/stats',
  '/api/injection/containers',
  '/api/injection/metrics',
  '/api/injection/slot/',
  '/api/injection/patterns',
  '/api/injection/overrides',  // Pattern overrides for Root Admin
  
  // ============ ADMIN DASHBOARD GREEN ROUTE ============
  '/api/admin/stats',
  '/api/admin/accounts',
  '/api/ai-center/dashboard',
  '/api/ai-center/chat',
  '/api/messages/conversations',
  '/api/notifications/stream',
  '/api/api-dashboard',
  
  // ============ INTELLICEIL SELF (Prevent recursion) ============
  '/api/intelliceil/',
];

/**
 * Check if path matches GREEN ROUTE bypass patterns
 * Supports exact match, endsWith, and startsWith (for wildcard paths ending in /)
 */
function isGreenRoute(path: string): boolean {
  return BYPASS_PATHS.some(p => {
    // Exact match
    if (path === p) return true;
    // EndsWith match (e.g., /api/health)
    if (path.endsWith(p)) return true;
    // StartsWith match for wildcard paths (ending in /)
    if (p.endsWith('/') && path.startsWith(p)) return true;
    // Also check if path starts with the bypass path (e.g., /api/extension/tasks/123)
    if (path.startsWith(p)) return true;
    return false;
  });
}

export function intelliceilMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    // Skip blocking for GREEN ROUTE paths (critical infrastructure)
    if (isGreenRoute(req.path)) {
      next();
      return;
    }
    
    const ip = getClientIP(req);
    
    // Get geo location
    let country: string | undefined;
    let city: string | undefined;
    let lat: number | undefined;
    let lon: number | undefined;
    
    try {
      const geo = geoip.lookup(ip);
      if (geo) {
        country = geo.country;
        city = geo.city;
        lat = geo.ll?.[0];
        lon = geo.ll?.[1];
      }
    } catch {
      // GeoIP lookup failed, continue without location
    }

    // Record request and get decision
    const decision = intelliceilService.recordRequest({
      ip,
      endpoint: req.path,
      method: req.method,
      referer: req.headers.referer,
      userAgent: req.headers['user-agent'],
      country,
      city,
      lat,
      lon,
    });

    // Attach Intelliceil data to request
    req.intelliceil = {
      allowed: decision.allowed,
      reason: decision.reason,
      ip,
      country,
      city,
    };

    // If request is blocked, return 429
    if (!decision.allowed) {
      res.status(429).json({
        success: false,
        error: 'Request blocked by Intelliceil security',
        reason: decision.reason,
        retryAfter: 60,
      });
      return;
    }

    next();
  } catch (error) {
    // If Intelliceil fails, allow the request through to prevent service disruption
    console.error('Intelliceil middleware error:', error);
    next();
  }
}

/**
 * Lightweight monitoring middleware (doesn't block, just records)
 * Use this for public routes that should still be monitored
 */
export function intelliceilMonitor(req: Request, _res: Response, next: NextFunction): void {
  try {
    const ip = getClientIP(req);
    
    // Get geo location
    let country: string | undefined;
    let city: string | undefined;
    let lat: number | undefined;
    let lon: number | undefined;
    
    try {
      const geo = geoip.lookup(ip);
      if (geo) {
        country = geo.country;
        city = geo.city;
        lat = geo.ll?.[0];
        lon = geo.ll?.[1];
      }
    } catch {
      // Continue without location
    }

    // Record but don't block
    intelliceilService.recordRequest({
      ip,
      endpoint: req.path,
      method: req.method,
      referer: req.headers.referer,
      userAgent: req.headers['user-agent'],
      country,
      city,
      lat,
      lon,
    });
    
    // Persist IP intelligence to database asynchronously (for Intelliheat analytics)
    // This enables heat maps, bot detection, threat assessment in dashboard
    const userAgent = req.headers['user-agent'] || '';
    ipIntelligenceService.analyzeIP(ip, userAgent).catch(() => {
      // Silent fail - don't block request on analytics errors
    });
  } catch (error) {
    // If monitoring fails, continue without blocking
    console.error('Intelliceil monitor error:', error);
  }

  next();
}

export default intelliceilMiddleware;
