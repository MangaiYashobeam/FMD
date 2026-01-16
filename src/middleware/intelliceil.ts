/**
 * Intelliceil Middleware
 * 
 * Express middleware that integrates with the Intelliceil security service
 * to monitor traffic and block malicious requests
 */

import { Request, Response, NextFunction } from 'express';
import { intelliceilService } from '@/services/intelliceil.service';
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
export function intelliceilMiddleware(req: Request, res: Response, next: NextFunction): void {
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
}

/**
 * Lightweight monitoring middleware (doesn't block, just records)
 * Use this for public routes that should still be monitored
 */
export function intelliceilMonitor(req: Request, _res: Response, next: NextFunction): void {
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

  next();
}

export default intelliceilMiddleware;
