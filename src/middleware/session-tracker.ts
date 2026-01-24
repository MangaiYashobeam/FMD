/**
 * Session Tracking Middleware
 * 
 * Comprehensive session tracking for authenticated users and visitors
 * Integrates with IntelliCeil and IP Intelligence services
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import prisma from '@/config/database';
import { ipIntelligenceService } from '@/services/ip-intelligence.service';
import { AuthRequest } from '@/middleware/auth';
import crypto from 'crypto';

// ============================================
// Types
// ============================================

interface _SessionContext {
  sessionId: string;
  userId?: string;
  visitorId?: string;
  fingerprint: string;
  ipAddress: string;
  userAgent: string;
  isAuthenticated: boolean;
}

// ============================================
// Session ID Generation
// ============================================

function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ============================================
// IP Address Extraction
// ============================================

export function getClientIP(req: Request): string {
  // Check various headers for real IP (behind proxy/load balancer)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
    return ips[0].trim();
  }
  
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return typeof realIp === 'string' ? realIp : realIp[0];
  }
  
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) {
    return typeof cfIp === 'string' ? cfIp : cfIp[0];
  }
  
  return req.ip || req.socket.remoteAddress || '0.0.0.0';
}

// ============================================
// Session Tracking Middleware
// ============================================

/**
 * Track authenticated user sessions
 */
export const trackUserSession = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next();
    }
    
    const userId = req.user.id;
    const ipAddress = getClientIP(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const sessionToken = req.headers['x-session-token'] as string || generateSessionId();
    
    // Check for existing active session
    let session = await prisma.userSession.findFirst({
      where: {
        userId,
        sessionToken,
        isActive: true,
      },
    });
    
    if (session) {
      // Update last activity
      await prisma.userSession.update({
        where: { id: session.id },
        data: { lastActiveAt: new Date() },
      });
    } else {
      // Analyze IP
      const ipAnalysis = await ipIntelligenceService.analyzeIP(ipAddress, userAgent);
      const deviceInfo = ipIntelligenceService.parseDeviceInfo(userAgent);
      
      // Create new session
      session = await prisma.userSession.create({
        data: {
          userId,
          sessionToken,
          ipAddress,
          userAgent,
          deviceType: deviceInfo.deviceType,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          loginMethod: 'token',
          ipInfo: ipAnalysis as any,
          botScore: ipAnalysis.bot.confidence,
          threatLevel: ipAnalysis.threat.level,
          country: ipAnalysis.geo.country,
          countryCode: ipAnalysis.geo.countryCode,
          city: ipAnalysis.geo.city,
          latitude: ipAnalysis.geo.latitude,
          longitude: ipAnalysis.geo.longitude,
          timezone: ipAnalysis.geo.timezone,
        },
      });
      
      // Update user's current session
      await prisma.user.update({
        where: { id: userId },
        data: {
          currentSessionId: session.id,
          lastActiveAt: new Date(),
          lastIpAddress: ipAddress,
          lastUserAgent: userAgent,
        },
      });
    }
    
    // Attach session to request
    (req as any).session = session;
    
    next();
  } catch (error) {
    logger.error('Session tracking failed:', error);
    next(); // Don't block request on tracking failure
  }
};

/**
 * Track session activity
 */
export const trackSessionActivity = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();
  const session = (req as any).session;
  
  // Track on response finish
  res.on('finish', async () => {
    try {
      if (!session) return;
      
      const responseTime = Date.now() - startTime;
      
      await prisma.sessionActivity.create({
        data: {
          sessionId: session.id,
          action: req.method === 'GET' ? 'page_view' : 'api_call',
          path: req.path,
          method: req.method,
          statusCode: res.statusCode,
          responseMs: responseTime,
          details: {
            query: req.query,
            referer: req.headers.referer,
          },
        },
      });
    } catch (error) {
      // Silent fail for activity tracking
    }
  });
  
  next();
};

/**
 * Track visitor sessions (anonymous users)
 */
export const trackVisitorSession = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Skip if already authenticated
    if ((req as AuthRequest).user) {
      return next();
    }
    
    // Skip static assets and health checks
    const skipPaths = ['/health', '/favicon.ico', '/robots.txt', '/sitemap.xml'];
    if (skipPaths.includes(req.path) || req.path.startsWith('/assets/')) {
      return next();
    }
    
    const ipAddress = getClientIP(req);
    const userAgent = req.headers['user-agent'] || '';
    const acceptLanguage = req.headers['accept-language'] || '';
    
    // Generate fingerprint
    const fingerprint = ipIntelligenceService.generateFingerprint(ipAddress, userAgent, acceptLanguage);
    
    // Check for existing visitor session cookie
    const existingSessionToken = req.cookies?.['visitor_session'];
    
    if (existingSessionToken) {
      // Update existing session
      const session = await prisma.visitorSession.findUnique({
        where: { sessionToken: existingSessionToken },
      });
      
      if (session) {
        await prisma.visitorSession.update({
          where: { id: session.id },
          data: {
            pageViews: { increment: 1 },
            exitPage: req.path,
          },
        });
        
        // Track page view
        await prisma.visitorPageView.create({
          data: {
            sessionId: session.id,
            path: req.path,
            title: req.headers['x-page-title'] as string || null,
          },
        });
        
        (req as any).visitorSession = session;
        return next();
      }
    }
    
    // Get or create visitor
    const ipAnalysis = await ipIntelligenceService.analyzeIP(ipAddress, userAgent);
    const deviceInfo = ipIntelligenceService.parseDeviceInfo(userAgent);
    
    const { visitor, isNew } = await ipIntelligenceService.trackVisitor(
      fingerprint,
      ipAddress,
      userAgent,
      ipAnalysis.geo.country || undefined,
      ipAnalysis.geo.city || undefined
    );
    
    // Create new visitor session
    const sessionToken = generateSessionId();
    const newSession = await prisma.visitorSession.create({
      data: {
        visitorId: visitor.id,
        sessionToken,
        ipAddress,
        userAgent,
        entryPage: req.path,
        referrer: req.headers.referer || null,
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        country: ipAnalysis.geo.country,
        countryCode: ipAnalysis.geo.countryCode,
        city: ipAnalysis.geo.city,
        latitude: ipAnalysis.geo.latitude,
        longitude: ipAnalysis.geo.longitude,
        ipInfo: ipAnalysis as any,
        botScore: ipAnalysis.bot.confidence,
        pageViews: 1,
      },
    });
    
    // Set session cookie
    res.cookie('visitor_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 60 * 1000, // 30 minutes
    });
    
    // Track initial page view
    await prisma.visitorPageView.create({
      data: {
        sessionId: newSession.id,
        path: req.path,
      },
    });
    
    (req as any).visitorSession = newSession;
    (req as any).visitor = visitor;
    (req as any).isNewVisitor = isNew;
    
    next();
  } catch (error) {
    logger.error('Visitor tracking failed:', error);
    next(); // Don't block request on tracking failure
  }
};

/**
 * Record user login
 */
export async function recordLogin(
  userId: string,
  email: string,
  role: string,
  ipAddress: string,
  userAgent: string,
  loginMethod: string,
  success: boolean,
  failureReason?: string
): Promise<void> {
  try {
    // Analyze IP
    const ipAnalysis = await ipIntelligenceService.analyzeIP(ipAddress, userAgent);
    const deviceInfo = ipIntelligenceService.parseDeviceInfo(userAgent);
    
    // Check for suspicious activity
    const suspiciousReasons: string[] = [];
    
    // Multiple failed logins?
    const recentFailures = await prisma.adminLoginAudit.count({
      where: {
        email,
        success: false,
        timestamp: { gte: new Date(Date.now() - 3600000) }, // Last hour
      },
    });
    
    if (recentFailures >= 3) {
      suspiciousReasons.push('Multiple failed login attempts');
    }
    
    // Bot detected?
    if (ipAnalysis.bot.isBot && !ipAnalysis.bot.isGoodBot) {
      suspiciousReasons.push(`Bot detected: ${ipAnalysis.bot.name}`);
    }
    
    // High threat score?
    if (ipAnalysis.threat.score >= 50) {
      suspiciousReasons.push(`High threat score: ${ipAnalysis.threat.score}`);
    }
    
    // Create audit log
    await prisma.adminLoginAudit.create({
      data: {
        userId,
        email,
        role,
        ipAddress,
        userAgent,
        loginMethod,
        success,
        failureReason,
        country: ipAnalysis.geo.country,
        city: ipAnalysis.geo.city,
        suspicious: suspiciousReasons.length > 0,
        suspiciousReasons,
      },
    });
    
    if (success) {
      // Update user login info
      await prisma.user.update({
        where: { id: userId },
        data: {
          lastLoginAt: new Date(),
          lastActiveAt: new Date(),
          lastIpAddress: ipAddress,
          lastUserAgent: userAgent,
          loginMethod,
          loginCount: { increment: 1 },
        },
      });
      
      // Calculate and update heat score
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { loginCount: true, createdAt: true },
      });
      
      if (user) {
        const daysSinceCreated = Math.max(1, Math.floor(
          (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        ));
        const loginsPerDay = user.loginCount / daysSinceCreated;
        const heatScore = Math.min(100, Math.floor(loginsPerDay * 15 + Math.log2(user.loginCount + 1) * 12));
        
        await prisma.user.update({
          where: { id: userId },
          data: { visitHeatScore: heatScore },
        });
      }
      
      // Create user session
      const sessionToken = generateSessionId();
      const session = await prisma.userSession.create({
        data: {
          userId,
          sessionToken,
          ipAddress,
          userAgent,
          deviceType: deviceInfo.deviceType,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          loginMethod,
          ipInfo: ipAnalysis as any,
          botScore: ipAnalysis.bot.confidence,
          threatLevel: ipAnalysis.threat.level,
          country: ipAnalysis.geo.country,
          countryCode: ipAnalysis.geo.countryCode,
          city: ipAnalysis.geo.city,
          latitude: ipAnalysis.geo.latitude,
          longitude: ipAnalysis.geo.longitude,
          timezone: ipAnalysis.geo.timezone,
        },
      });
      
      // Update user's current session
      await prisma.user.update({
        where: { id: userId },
        data: { currentSessionId: session.id },
      });
    }
    
    // Log suspicious activity
    if (suspiciousReasons.length > 0) {
      logger.warn('Suspicious login activity:', {
        email,
        ipAddress,
        reasons: suspiciousReasons,
      });
    }
  } catch (error) {
    logger.error('Failed to record login:', error);
  }
}

/**
 * Record logout and finalize session
 */
export async function recordLogout(userId: string, sessionId?: string): Promise<void> {
  try {
    const whereClause = sessionId
      ? { id: sessionId }
      : { userId, isActive: true };
    
    // Get active session
    const session = await prisma.userSession.findFirst({
      where: whereClause,
    });
    
    if (session) {
      const duration = Math.floor((Date.now() - session.loginAt.getTime()) / 1000);
      
      await prisma.userSession.update({
        where: { id: session.id },
        data: {
          isActive: false,
          logoutAt: new Date(),
          duration,
        },
      });
    }
    
    // Clear user's current session
    await prisma.user.update({
      where: { id: userId },
      data: { currentSessionId: null },
    });
  } catch (error) {
    logger.error('Failed to record logout:', error);
  }
}

/**
 * Link visitor to user on signup/login
 */
export async function linkVisitorToUser(fingerprint: string, userId: string): Promise<void> {
  try {
    await prisma.visitor.updateMany({
      where: { fingerprint, convertedUserId: null },
      data: {
        convertedAt: new Date(),
        convertedUserId: userId,
      },
    });
    
    logger.info('Linked visitor to user:', { fingerprint, userId });
  } catch (error) {
    logger.error('Failed to link visitor to user:', error);
  }
}

export default {
  trackUserSession,
  trackSessionActivity,
  trackVisitorSession,
  recordLogin,
  recordLogout,
  linkVisitorToUser,
  getClientIP,
};
