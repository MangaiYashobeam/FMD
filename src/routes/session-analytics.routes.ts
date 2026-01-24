/**
 * Session Analytics Routes
 * 
 * API routes for session tracking, visitor analytics, and admin insights
 * All routes require SUPER_ADMIN access
 */

import { Router, Response } from 'express';
import { AuthRequest } from '@/middleware/auth';
import { requireSuperAdmin } from '@/middleware/rbac';
import { authenticate } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import prisma from '@/config/database';
import { ipIntelligenceService } from '@/services/ip-intelligence.service';

const router = Router();

// All routes require authentication and super admin
router.use(authenticate, requireSuperAdmin);

// ============================================
// User Sessions
// ============================================

/**
 * Get active user sessions
 */
router.get('/sessions/active', async (_req: AuthRequest, res: Response) => {
  try {
    const sessions = await prisma.userSession.findMany({
      where: { isActive: true },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            accountUsers: {
              select: { role: true },
            },
          },
        },
      },
      orderBy: { lastActiveAt: 'desc' },
    });
    
    res.json({
      success: true,
      data: sessions.map(s => ({
        ...s,
        user: {
          ...s.user,
          role: s.user.accountUsers[0]?.role || 'UNKNOWN',
        },
      })),
      total: sessions.length,
    });
  } catch (error) {
    logger.error('Failed to get active sessions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sessions' });
  }
});

/**
 * Get session history with pagination
 */
router.get('/sessions/history', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const skip = (page - 1) * limit;
    
    const userId = req.query.userId as string;
    const ipAddress = req.query.ip as string;
    const dateFrom = req.query.from ? new Date(req.query.from as string) : undefined;
    const dateTo = req.query.to ? new Date(req.query.to as string) : undefined;
    
    const where: any = {};
    if (userId) where.userId = userId;
    if (ipAddress) where.ipAddress = ipAddress;
    if (dateFrom || dateTo) {
      where.loginAt = {};
      if (dateFrom) where.loginAt.gte = dateFrom;
      if (dateTo) where.loginAt.lte = dateTo;
    }
    
    const [sessions, total] = await Promise.all([
      prisma.userSession.findMany({
        where,
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { loginAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.userSession.count({ where }),
    ]);
    
    res.json({
      success: true,
      data: sessions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Failed to get session history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

/**
 * Get session statistics
 */
router.get('/sessions/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const [
      activeSessions,
      sessionsToday,
      sessionsWeek,
      sessionsMonth,
      avgDuration,
      uniqueUsers,
      byDevice,
      byCountry,
      byBrowser,
    ] = await Promise.all([
      prisma.userSession.count({ where: { isActive: true } }),
      prisma.userSession.count({ where: { loginAt: { gte: today } } }),
      prisma.userSession.count({ where: { loginAt: { gte: weekAgo } } }),
      prisma.userSession.count({ where: { loginAt: { gte: monthAgo } } }),
      prisma.userSession.aggregate({
        where: { duration: { not: null } },
        _avg: { duration: true },
      }),
      prisma.userSession.findMany({
        where: { loginAt: { gte: monthAgo } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      prisma.userSession.groupBy({
        by: ['deviceType'],
        _count: true,
        where: { loginAt: { gte: monthAgo } },
      }),
      prisma.userSession.groupBy({
        by: ['country'],
        _count: true,
        where: { loginAt: { gte: monthAgo } },
        orderBy: { _count: { country: 'desc' } },
        take: 10,
      }),
      prisma.userSession.groupBy({
        by: ['browser'],
        _count: true,
        where: { loginAt: { gte: monthAgo } },
        orderBy: { _count: { browser: 'desc' } },
        take: 5,
      }),
    ]);
    
    res.json({
      success: true,
      data: {
        overview: {
          activeSessions,
          sessionsToday,
          sessionsWeek,
          sessionsMonth,
          avgDuration: Math.round(avgDuration._avg.duration || 0),
          uniqueUsersMonth: uniqueUsers.length,
        },
        distribution: {
          byDevice: byDevice.reduce((acc, d) => {
            if (d.deviceType) acc[d.deviceType] = d._count;
            return acc;
          }, {} as Record<string, number>),
          byCountry: byCountry
            .filter(c => c.country)
            .map(c => ({ country: c.country!, count: c._count })),
          byBrowser: byBrowser
            .filter(b => b.browser)
            .map(b => ({ browser: b.browser!, count: b._count })),
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get session stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

/**
 * Terminate a session
 */
router.post('/sessions/:sessionId/terminate', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    
    const session = await prisma.userSession.findUnique({
      where: { id: sessionId },
    });
    
    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }
    
    const duration = Math.floor((Date.now() - session.loginAt.getTime()) / 1000);
    
    await prisma.userSession.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        logoutAt: new Date(),
        duration,
      },
    });
    
    logger.info('Session terminated by admin:', {
      sessionId,
      adminId: req.user?.id,
    });
    
    res.json({
      success: true,
      message: 'Session terminated',
    });
  } catch (error) {
    logger.error('Failed to terminate session:', error);
    res.status(500).json({ success: false, error: 'Failed to terminate session' });
  }
});

// ============================================
// Visitor Analytics
// ============================================

/**
 * Get visitor analytics overview
 */
router.get('/visitors/analytics', async (_req: AuthRequest, res: Response) => {
  try {
    const analytics = await ipIntelligenceService.getVisitorAnalytics();
    
    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    logger.error('Failed to get visitor analytics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

/**
 * Get visitors list with filtering
 */
router.get('/visitors', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const skip = (page - 1) * limit;
    
    const visitorType = req.query.type as string;
    const isBot = req.query.isBot === 'true';
    const potentialUser = req.query.potentialUser === 'true';
    const minHeat = parseInt(req.query.minHeat as string) || 0;
    
    const where: any = {};
    if (visitorType) where.visitorType = visitorType;
    if (req.query.isBot !== undefined) where.isBotConfirmed = isBot;
    if (req.query.potentialUser !== undefined) where.potentialUser = potentialUser;
    if (minHeat > 0) where.heatScore = { gte: minHeat };
    
    const [visitors, total] = await Promise.all([
      prisma.visitor.findMany({
        where,
        orderBy: { lastVisitAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.visitor.count({ where }),
    ]);
    
    res.json({
      success: true,
      data: visitors,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Failed to get visitors:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch visitors' });
  }
});

/**
 * Get visitor sessions
 */
router.get('/visitors/:visitorId/sessions', async (req: AuthRequest, res: Response) => {
  try {
    const { visitorId } = req.params;
    
    const sessions = await prisma.visitorSession.findMany({
      where: { visitorId },
      include: {
        pageViewed: true,
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
    
    res.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    logger.error('Failed to get visitor sessions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sessions' });
  }
});

// ============================================
// IP Intelligence
// ============================================

/**
 * Get IP intelligence summary
 */
router.get('/ip/summary', async (_req: AuthRequest, res: Response) => {
  try {
    const summary = await ipIntelligenceService.getIPSummary();
    
    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error('Failed to get IP summary:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch IP data' });
  }
});

/**
 * Analyze specific IP
 */
router.get('/ip/analyze/:ip', async (req: AuthRequest, res: Response) => {
  try {
    const { ip } = req.params;
    const userAgent = req.query.userAgent as string;
    
    const analysis = await ipIntelligenceService.analyzeIP(ip, userAgent);
    
    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    logger.error('Failed to analyze IP:', error);
    res.status(500).json({ success: false, error: 'Failed to analyze IP' });
  }
});

/**
 * Get IP list with filtering
 */
router.get('/ip/list', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const skip = (page - 1) * limit;
    
    const threatLevel = req.query.threat as string;
    const isBot = req.query.isBot === 'true';
    const isBlocked = req.query.blocked === 'true';
    
    const where: any = {};
    if (threatLevel) where.threatLevel = threatLevel;
    if (req.query.isBot !== undefined) where.isBotConfirmed = isBot;
    if (req.query.blocked !== undefined) where.isBlocked = isBlocked;
    
    const [ips, total] = await Promise.all([
      prisma.iPIntelligence.findMany({
        where,
        orderBy: { lastRequestAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.iPIntelligence.count({ where }),
    ]);
    
    res.json({
      success: true,
      data: ips,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Failed to get IP list:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch IPs' });
  }
});

/**
 * Block an IP
 */
router.post('/ip/block', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { ipAddress, reason } = req.body;
    
    if (!ipAddress) {
      res.status(400).json({ success: false, error: 'IP address required' });
      return;
    }
    
    await prisma.iPIntelligence.upsert({
      where: { ipAddress },
      create: {
        ipAddress,
        isBlocked: true,
        blockedAt: new Date(),
        blockedReason: reason || 'Manual block',
        autoBlocked: false,
      },
      update: {
        isBlocked: true,
        blockedAt: new Date(),
        blockedReason: reason || 'Manual block',
        autoBlocked: false,
      },
    });
    
    logger.info('IP blocked by admin:', {
      ipAddress,
      reason,
      adminId: req.user?.id,
    });
    
    res.json({
      success: true,
      message: `IP ${ipAddress} blocked`,
    });
  } catch (error) {
    logger.error('Failed to block IP:', error);
    res.status(500).json({ success: false, error: 'Failed to block IP' });
  }
});

/**
 * Unblock an IP
 */
router.post('/ip/unblock', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { ipAddress } = req.body;
    
    if (!ipAddress) {
      res.status(400).json({ success: false, error: 'IP address required' });
      return;
    }
    
    await prisma.iPIntelligence.update({
      where: { ipAddress },
      data: {
        isBlocked: false,
        blockedAt: null,
        blockedReason: null,
      },
    });
    
    logger.info('IP unblocked by admin:', {
      ipAddress,
      adminId: req.user?.id,
    });
    
    res.json({
      success: true,
      message: `IP ${ipAddress} unblocked`,
    });
  } catch (error) {
    logger.error('Failed to unblock IP:', error);
    res.status(500).json({ success: false, error: 'Failed to unblock IP' });
  }
});

// ============================================
// Admin Login Audit
// ============================================

/**
 * Get admin login history
 */
router.get('/admin-logins', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const skip = (page - 1) * limit;
    
    const email = req.query.email as string;
    const suspicious = req.query.suspicious === 'true';
    const success = req.query.success !== 'false';
    
    const where: any = {};
    if (email) where.email = { contains: email, mode: 'insensitive' };
    if (req.query.suspicious !== undefined) where.suspicious = suspicious;
    if (req.query.success !== undefined) where.success = success;
    
    const [logins, total] = await Promise.all([
      prisma.adminLoginAudit.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      prisma.adminLoginAudit.count({ where }),
    ]);
    
    res.json({
      success: true,
      data: logins,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Failed to get admin logins:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch logins' });
  }
});

// ============================================
// User Analytics
// ============================================

/**
 * Get user analytics with heat scores
 */
router.get('/users/analytics', async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalUsers,
      activeToday,
      activeWeek,
      byRole,
      heatDistribution,
      topUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: { lastActiveAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      prisma.user.count({
        where: { lastActiveAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
      prisma.accountUser.groupBy({
        by: ['role'],
        _count: true,
      }),
      Promise.all([
        prisma.user.count({ where: { visitHeatScore: { gte: 0, lt: 20 } } }),
        prisma.user.count({ where: { visitHeatScore: { gte: 20, lt: 40 } } }),
        prisma.user.count({ where: { visitHeatScore: { gte: 40, lt: 60 } } }),
        prisma.user.count({ where: { visitHeatScore: { gte: 60, lt: 80 } } }),
        prisma.user.count({ where: { visitHeatScore: { gte: 80 } } }),
      ]),
      prisma.user.findMany({
        orderBy: { visitHeatScore: 'desc' },
        take: 10,
        include: {
          accountUsers: {
            select: { role: true },
          },
        },
      }),
    ]);
    
    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          activeToday,
          activeWeek,
        },
        byRole: byRole.reduce((acc, r) => {
          acc[r.role] = r._count;
          return acc;
        }, {} as Record<string, number>),
        heatDistribution: [
          { range: '0-19 (New)', count: heatDistribution[0] },
          { range: '20-39 (Occasional)', count: heatDistribution[1] },
          { range: '40-59 (Regular)', count: heatDistribution[2] },
          { range: '60-79 (Frequent)', count: heatDistribution[3] },
          { range: '80-100 (Power User)', count: heatDistribution[4] },
        ],
        topUsers: topUsers.map(u => ({
          id: u.id,
          email: u.email,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
          role: u.accountUsers[0]?.role || 'UNKNOWN',
          heatScore: u.visitHeatScore,
          loginCount: u.loginCount,
          lastLoginAt: u.lastLoginAt,
          lastActiveAt: u.lastActiveAt,
        })),
      },
    });
  } catch (error) {
    logger.error('Failed to get user analytics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

/**
 * Get specific user's sessions
 */
router.get('/users/:userId/sessions', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    
    const [user, sessions] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          lastLoginAt: true,
          lastActiveAt: true,
          loginCount: true,
          visitHeatScore: true,
          lastIpAddress: true,
        },
      }),
      prisma.userSession.findMany({
        where: { userId },
        orderBy: { loginAt: 'desc' },
        take: 50,
      }),
    ]);
    
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    
    res.json({
      success: true,
      data: {
        user,
        sessions,
      },
    });
  } catch (error) {
    logger.error('Failed to get user sessions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sessions' });
  }
});

// ============================================
// Known Bots Registry
// ============================================

/**
 * Get known bots
 */
router.get('/bots', async (req: AuthRequest, res: Response) => {
  try {
    const type = req.query.type as string;
    const isGood = req.query.good === 'true';
    
    const where: any = {};
    if (type) where.type = type;
    if (req.query.good !== undefined) where.isGood = isGood;
    
    const bots = await prisma.knownBot.findMany({
      where,
      orderBy: { totalRequests: 'desc' },
    });
    
    res.json({
      success: true,
      data: bots,
    });
  } catch (error) {
    logger.error('Failed to get known bots:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch bots' });
  }
});

/**
 * Add known bot
 */
router.post('/bots', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, type, userAgentPattern, ipRanges, isGood, description, website } = req.body;
    
    if (!name || !type) {
      res.status(400).json({ success: false, error: 'Name and type required' });
      return;
    }
    
    const bot = await prisma.knownBot.create({
      data: {
        name,
        type,
        userAgentPattern,
        ipRanges: ipRanges || [],
        isGood: isGood || false,
        description,
        website,
      },
    });
    
    res.json({
      success: true,
      data: bot,
    });
  } catch (error) {
    logger.error('Failed to add bot:', error);
    res.status(500).json({ success: false, error: 'Failed to add bot' });
  }
});

export default router;
