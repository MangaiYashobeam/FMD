/**
 * ============================================
 * FaceMyDealer - Security Dashboard Controller
 * ============================================
 * 
 * API endpoints for:
 * - Green Route analytics
 * - Origin validation logs
 * - Account whitelist management
 * - Security dashboard data
 */

import { Request, Response } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import whitelistService from '../services/account-whitelist.service';

const prisma = new PrismaClient();

/**
 * GET /api/security/dashboard
 * Get security dashboard overview (Super Admin only)
 */
export async function getSecurityDashboard(req: Request, res: Response): Promise<void> {
  try {
    const accountUser = (req as any).accountUser;
    
    if (accountUser?.role !== UserRole.SUPER_ADMIN) {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }

    // Get time ranges
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    // Future use: const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    // Future use: const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Parallel queries for dashboard data
    const [
      greenRouteStats,
      originValidationStats,
      whitelistStats,
      recentGreenRouteRequests,
      blockedRequests,
      topEndpoints
    ] = await Promise.all([
      // Green Route statistics
      prisma.greenRouteLog.groupBy({
        by: ['source'],
        _count: { id: true },
        where: { createdAt: { gte: last24h } }
      }),
      
      // Origin validation statistics
      prisma.originValidationLog.groupBy({
        by: ['blocked'],
        _count: { id: true },
        where: { createdAt: { gte: last24h } }
      }),
      
      // Whitelist statistics
      whitelistService.getWhitelistStats(),
      
      // Recent Green Route requests
      prisma.greenRouteLog.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          requestId: true,
          path: true,
          method: true,
          source: true,
          accountId: true,
          ipAddress: true,
          responseStatus: true,
          responseTimeMs: true,
          verified: true,
          whitelisted: true,
          createdAt: true
        }
      }),
      
      // Recent blocked requests
      prisma.originValidationLog.findMany({
        where: { blocked: true },
        take: 50,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          path: true,
          method: true,
          origin: true,
          ipAddress: true,
          reason: true,
          source: true,
          createdAt: true
        }
      }),
      
      // Top endpoints by request count
      prisma.greenRouteAnalytics.findMany({
        take: 20,
        orderBy: { requestCount: 'desc' }
      })
    ]);

    // Calculate totals
    const totalGreenRouteRequests = greenRouteStats.reduce((sum, s) => sum + s._count.id, 0);
    const blockedCount = originValidationStats.find(s => s.blocked)?.['_count']?.id || 0;
    const allowedCount = originValidationStats.find(s => !s.blocked)?.['_count']?.id || 0;

    res.json({
      overview: {
        greenRouteRequests24h: totalGreenRouteRequests,
        blockedRequests24h: blockedCount,
        allowedRequests24h: allowedCount,
        whitelistedAccounts: whitelistStats.total,
        greenRouteAccounts: whitelistStats.withGreenRoute
      },
      sourceBreakdown: greenRouteStats.map(s => ({
        source: s.source,
        count: s._count.id
      })),
      recentRequests: recentGreenRouteRequests,
      blockedRequests,
      topEndpoints
    });
  } catch (error: any) {
    console.error('Security dashboard error:', error);
    res.status(500).json({ error: error.message || 'Failed to load dashboard' });
  }
}

/**
 * GET /api/security/green-route/logs
 * Get Green Route request logs (Super Admin only)
 */
export async function getGreenRouteLogs(req: Request, res: Response): Promise<void> {
  try {
    const accountUser = (req as any).accountUser;
    
    if (accountUser?.role !== UserRole.SUPER_ADMIN) {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }

    const { 
      source, 
      accountId, 
      path,
      startDate, 
      endDate, 
      limit = '100', 
      offset = '0' 
    } = req.query;

    const where: any = {};
    
    if (typeof source === 'string') where.source = source;
    if (typeof accountId === 'string') where.accountId = accountId;
    if (typeof path === 'string') where.path = { contains: path };
    if (startDate || endDate) {
      where.createdAt = {};
      if (typeof startDate === 'string') where.createdAt.gte = new Date(startDate);
      if (typeof endDate === 'string') where.createdAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.greenRouteLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(typeof limit === 'string' ? limit : '100'),
        skip: parseInt(typeof offset === 'string' ? offset : '0')
      }),
      prisma.greenRouteLog.count({ where })
    ]);

    res.json({ 
      logs, 
      total, 
      limit: parseInt(typeof limit === 'string' ? limit : '100'), 
      offset: parseInt(typeof offset === 'string' ? offset : '0') 
    });
  } catch (error: any) {
    console.error('Get Green Route logs error:', error);
    res.status(500).json({ error: error.message || 'Failed to get logs' });
  }
}

/**
 * GET /api/security/green-route/logs/:id
 * Get detailed info for a specific Green Route request
 */
export async function getGreenRouteLogDetail(req: Request, res: Response): Promise<void> {
  try {
    const accountUser = (req as any).accountUser;
    
    if (accountUser?.role !== UserRole.SUPER_ADMIN) {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }

    const id = typeof req.params.id === 'string' ? req.params.id : undefined;
    if (!id) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    const log = await prisma.greenRouteLog.findUnique({
      where: { id }
    });

    if (!log) {
      res.status(404).json({ error: 'Log not found' });
      return;
    }

    // Get account details if accountId exists
    let account = null;
    if (log.accountId) {
      account = await prisma.account.findUnique({
        where: { id: log.accountId },
        select: {
          id: true,
          name: true,
          dealershipName: true,
          isActive: true
        }
      });
    }

    // Get user details if userId exists
    let user = null;
    if (log.userId) {
      user = await prisma.user.findUnique({
        where: { id: log.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true
        }
      });
    }

    res.json({
      log,
      account,
      user
    });
  } catch (error: any) {
    console.error('Get Green Route log detail error:', error);
    res.status(500).json({ error: error.message || 'Failed to get log detail' });
  }
}

/**
 * GET /api/security/blocked-requests
 * Get blocked origin validation requests
 */
export async function getBlockedRequests(req: Request, res: Response): Promise<void> {
  try {
    const accountUser = (req as any).accountUser;
    
    if (accountUser?.role !== UserRole.SUPER_ADMIN) {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }

    const { 
      reason, 
      source,
      startDate, 
      endDate, 
      limit = '100', 
      offset = '0' 
    } = req.query;

    const where: any = { blocked: true };
    
    if (typeof reason === 'string') where.reason = { contains: reason };
    if (typeof source === 'string') where.source = source;
    if (startDate || endDate) {
      where.createdAt = {};
      if (typeof startDate === 'string') where.createdAt.gte = new Date(startDate);
      if (typeof endDate === 'string') where.createdAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.originValidationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(typeof limit === 'string' ? limit : '100'),
        skip: parseInt(typeof offset === 'string' ? offset : '0')
      }),
      prisma.originValidationLog.count({ where })
    ]);

    res.json({ logs, total });
  } catch (error: any) {
    console.error('Get blocked requests error:', error);
    res.status(500).json({ error: error.message || 'Failed to get blocked requests' });
  }
}

/**
 * GET /api/security/whitelist
 * Get all whitelisted accounts
 */
export async function getWhitelist(req: Request, res: Response): Promise<void> {
  try {
    const accountUser = (req as any).accountUser;
    
    if (accountUser?.role !== UserRole.SUPER_ADMIN) {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }

    const { greenRouteAccess, apiKeyAccess, limit, offset } = req.query;

    const accounts = await whitelistService.getWhitelistedAccounts({
      greenRouteAccess: greenRouteAccess === 'true' ? true : greenRouteAccess === 'false' ? false : undefined,
      apiKeyAccess: apiKeyAccess === 'true' ? true : apiKeyAccess === 'false' ? false : undefined,
      limit: typeof limit === 'string' ? parseInt(limit) : undefined,
      offset: typeof offset === 'string' ? parseInt(offset) : undefined
    });

    const stats = await whitelistService.getWhitelistStats();

    res.json({ accounts, stats });
  } catch (error: any) {
    console.error('Get whitelist error:', error);
    res.status(500).json({ error: error.message || 'Failed to get whitelist' });
  }
}

/**
 * POST /api/security/whitelist/:accountId
 * Add account to whitelist
 */
export async function addToWhitelist(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const accountUser = (req as any).accountUser;
    
    if (accountUser?.role !== UserRole.SUPER_ADMIN) {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }

    const accountId = typeof req.params.accountId === 'string' ? req.params.accountId : '';
    const { greenRouteAccess, apiKeyAccess, extensionAccess, customRateLimit, reason, notes } = req.body;

    const result = await whitelistService.whitelistAccount(accountId, user.id, {
      greenRouteAccess,
      apiKeyAccess,
      extensionAccess,
      customRateLimit,
      reason,
      notes
    });

    res.json({ success: true, whitelist: result });
  } catch (error: any) {
    console.error('Add to whitelist error:', error);
    res.status(500).json({ error: error.message || 'Failed to add to whitelist' });
  }
}

/**
 * DELETE /api/security/whitelist/:accountId
 * Remove account from whitelist
 */
export async function removeFromWhitelist(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const accountUser = (req as any).accountUser;
    
    if (accountUser?.role !== UserRole.SUPER_ADMIN) {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }

    const accountId = typeof req.params.accountId === 'string' ? req.params.accountId : '';
    const { reason } = req.body;

    await whitelistService.removeFromWhitelist(accountId, user.id, reason);

    res.json({ success: true, message: 'Account removed from whitelist' });
  } catch (error: any) {
    console.error('Remove from whitelist error:', error);
    res.status(500).json({ error: error.message || 'Failed to remove from whitelist' });
  }
}

/**
 * PATCH /api/security/whitelist/:accountId
 * Update whitelist permissions
 */
export async function updateWhitelist(req: Request, res: Response): Promise<void> {
  try {
    const accountUser = (req as any).accountUser;
    
    if (accountUser?.role !== UserRole.SUPER_ADMIN) {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }

    const accountId = typeof req.params.accountId === 'string' ? req.params.accountId : '';
    const { greenRouteAccess, apiKeyAccess, extensionAccess, customRateLimit, reason, notes } = req.body;

    const result = await whitelistService.updateWhitelistPermissions(accountId, {
      greenRouteAccess,
      apiKeyAccess,
      extensionAccess,
      customRateLimit,
      reason,
      notes
    });

    res.json({ success: true, whitelist: result });
  } catch (error: any) {
    console.error('Update whitelist error:', error);
    res.status(500).json({ error: error.message || 'Failed to update whitelist' });
  }
}

/**
 * GET /api/security/analytics/endpoints
 * Get endpoint analytics
 */
export async function getEndpointAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const accountUser = (req as any).accountUser;
    
    if (accountUser?.role !== UserRole.SUPER_ADMIN) {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }

    const { limit = '50' } = req.query;

    const analytics = await prisma.greenRouteAnalytics.findMany({
      orderBy: { requestCount: 'desc' },
      take: parseInt(typeof limit === 'string' ? limit : '50')
    });

    res.json({ analytics });
  } catch (error: any) {
    console.error('Get endpoint analytics error:', error);
    res.status(500).json({ error: error.message || 'Failed to get analytics' });
  }
}

/**
 * GET /api/security/analytics/timeline
 * Get request timeline for charts
 */
export async function getRequestTimeline(req: Request, res: Response): Promise<void> {
  try {
    const accountUser = (req as any).accountUser;
    
    if (accountUser?.role !== UserRole.SUPER_ADMIN) {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }

    const { hours = '24' } = req.query;
    const hoursNum = parseInt(typeof hours === 'string' ? hours : '24');
    const startTime = new Date(Date.now() - hoursNum * 60 * 60 * 1000);

    // Get hourly counts
    const logs = await prisma.greenRouteLog.findMany({
      where: { createdAt: { gte: startTime } },
      select: { createdAt: true, source: true }
    });

    // Group by hour
    const timeline: Record<string, Record<string, number>> = {};
    
    logs.forEach(log => {
      const hour = log.createdAt.toISOString().slice(0, 13) + ':00:00.000Z';
      if (!timeline[hour]) timeline[hour] = { total: 0, extension: 0, webapp: 0, other: 0 };
      timeline[hour].total++;
      if (log.source === 'extension' || log.source === 'extension-hybrid') {
        timeline[hour].extension++;
      } else if (log.source === 'webapp') {
        timeline[hour].webapp++;
      } else {
        timeline[hour].other++;
      }
    });

    // Convert to array sorted by time
    const timelineArray = Object.entries(timeline)
      .map(([time, counts]) => ({ time, ...counts }))
      .sort((a, b) => a.time.localeCompare(b.time));

    res.json({ timeline: timelineArray });
  } catch (error: any) {
    console.error('Get request timeline error:', error);
    res.status(500).json({ error: error.message || 'Failed to get timeline' });
  }
}

export default {
  getSecurityDashboard,
  getGreenRouteLogs,
  getGreenRouteLogDetail,
  getBlockedRequests,
  getWhitelist,
  addToWhitelist,
  removeFromWhitelist,
  updateWhitelist,
  getEndpointAnalytics,
  getRequestTimeline
};
