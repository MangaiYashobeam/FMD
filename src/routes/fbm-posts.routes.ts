/**
 * FBM Posts Routes - Facebook Marketplace Post Tracking & Debugging
 * 
 * Super Admin: Full visibility into all posts across all accounts
 * Admin/User: Limited to their account's posts
 */

import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '@/middleware/auth';
import { requireRole } from '@/middleware/rbac';
import prisma from '@/config/database';
import { logger } from '@/utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// FBM Post Log Service
// ============================================

export class FBMPostLogService {
  /**
   * Create a new FBM post log entry
   */
  static async createLog(data: {
    accountId: string;
    vehicleId: string;
    userId: string;
    method: 'iai' | 'soldier' | 'hybrid';
    triggerType: 'manual' | 'auto_post' | 'scheduled' | 'retry';
    extensionTaskId?: string;
    vehicleData?: any;
    requestData?: any;
    parentLogId?: string;
    attemptNumber?: number;
  }) {
    const log = await prisma.fBMPostLog.create({
      data: {
        accountId: data.accountId,
        vehicleId: data.vehicleId,
        userId: data.userId,
        method: data.method,
        triggerType: data.triggerType,
        status: 'initiated',
        stage: 'init',
        extensionTaskId: data.extensionTaskId,
        vehicleData: data.vehicleData,
        requestData: data.requestData,
        parentLogId: data.parentLogId,
        attemptNumber: data.attemptNumber || 1,
        stageHistory: [{
          stage: 'init',
          timestamp: new Date().toISOString(),
          message: `Post initiated via ${data.method} method (${data.triggerType})`,
        }],
        riskLevel: this.assessRiskLevel(data),
        riskFactors: this.assessRiskFactors(data),
      },
    });

    // Log the event
    await this.addEvent(log.id, {
      eventType: 'info',
      stage: 'init',
      message: `FBM post initiated for vehicle ${data.vehicleId}`,
      source: 'api',
      details: { method: data.method, triggerType: data.triggerType },
    });

    logger.info(`FBM Post Log created: ${log.id} for vehicle ${data.vehicleId}`);
    return log;
  }

  /**
   * Update log status and stage
   */
  static async updateLog(logId: string, updates: {
    status?: string;
    stage?: string;
    errorCode?: string;
    errorMessage?: string;
    errorDetails?: any;
    responseData?: any;
    facebookPostId?: string;
    fbPostId?: string;
    success?: boolean;
  }) {
    const currentLog = await prisma.fBMPostLog.findUnique({
      where: { id: logId },
    });

    if (!currentLog) {
      throw new Error(`FBM Post Log not found: ${logId}`);
    }

    const stageHistory = (currentLog.stageHistory as any[]) || [];
    if (updates.stage && updates.stage !== currentLog.stage) {
      stageHistory.push({
        stage: updates.stage,
        timestamp: new Date().toISOString(),
        previousStage: currentLog.stage,
      });
    }

    const updateData: any = {
      ...updates,
      stageHistory,
      updatedAt: new Date(),
    };

    // Set timing fields
    if (updates.status === 'queued' && !currentLog.queuedAt) {
      updateData.queuedAt = new Date();
    }
    if (updates.status === 'processing' && !currentLog.processingAt) {
      updateData.processingAt = new Date();
    }
    if (updates.status === 'completed' || updates.status === 'failed') {
      updateData.completedAt = new Date();
      updateData.duration = Math.floor(
        (new Date().getTime() - currentLog.initiatedAt.getTime()) / 1000
      );
    }

    const updatedLog = await prisma.fBMPostLog.update({
      where: { id: logId },
      data: updateData,
    });

    // Add event for status change
    if (updates.status && updates.status !== currentLog.status) {
      await this.addEvent(logId, {
        eventType: updates.status === 'failed' ? 'error' : 'stage_change',
        stage: updates.stage || currentLog.stage,
        message: `Status changed: ${currentLog.status} → ${updates.status}`,
        source: 'api',
        details: updates.errorDetails,
      });
    }

    return updatedLog;
  }

  /**
   * Add an event to a post log
   */
  static async addEvent(postLogId: string, event: {
    eventType: 'stage_change' | 'error' | 'warning' | 'info' | 'debug';
    stage: string;
    message: string;
    source?: string;
    details?: any;
  }) {
    return prisma.fBMPostEvent.create({
      data: {
        postLogId,
        eventType: event.eventType,
        stage: event.stage,
        message: event.message,
        source: event.source || 'api',
        details: event.details,
      },
    });
  }

  /**
   * Assess risk level for a posting attempt
   */
  static assessRiskLevel(data: any): string {
    const factors = this.assessRiskFactors(data);
    const criticalFactors = (factors as any[]).filter((f: any) => f.severity === 'critical').length;
    const highFactors = (factors as any[]).filter((f: any) => f.severity === 'high').length;

    if (criticalFactors > 0) return 'critical';
    if (highFactors > 1) return 'high';
    if (highFactors > 0 || (factors as any[]).length > 2) return 'medium';
    return 'low';
  }

  /**
   * Assess risk factors for a posting attempt
   */
  static assessRiskFactors(data: any): any[] {
    const factors: any[] = [];

    // Check vehicle data completeness
    if (!data.vehicleData) {
      factors.push({
        factor: 'missing_vehicle_data',
        severity: 'high',
        message: 'Vehicle data not captured',
      });
    } else {
      if (!data.vehicleData.photos || data.vehicleData.photos.length === 0) {
        factors.push({
          factor: 'no_photos',
          severity: 'high',
          message: 'No photos available for posting',
        });
      }
      if (!data.vehicleData.price) {
        factors.push({
          factor: 'no_price',
          severity: 'medium',
          message: 'Price not set',
        });
      }
      if (!data.vehicleData.description) {
        factors.push({
          factor: 'no_description',
          severity: 'low',
          message: 'Description not provided',
        });
      }
    }

    // Check retry count
    if (data.attemptNumber && data.attemptNumber > 2) {
      factors.push({
        factor: 'multiple_retries',
        severity: 'medium',
        message: `Attempt #${data.attemptNumber}`,
      });
    }

    return factors;
  }

  /**
   * Get statistics for dashboard
   */
  static async getStats(accountId?: string, timeRange: string = '24h') {
    const timeFilter = this.getTimeFilter(timeRange);
    const whereClause: any = { createdAt: { gte: timeFilter } };
    if (accountId) {
      whereClause.accountId = accountId;
    }

    const [total, byStatus, byMethod, byRisk, recentFails] = await Promise.all([
      prisma.fBMPostLog.count({ where: whereClause }),
      prisma.fBMPostLog.groupBy({
        by: ['status'],
        where: whereClause,
        _count: true,
      }),
      prisma.fBMPostLog.groupBy({
        by: ['method'],
        where: whereClause,
        _count: true,
      }),
      prisma.fBMPostLog.groupBy({
        by: ['riskLevel'],
        where: whereClause,
        _count: true,
      }),
      prisma.fBMPostLog.findMany({
        where: { ...whereClause, success: false },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          vehicle: { select: { year: true, make: true, model: true, vin: true } },
          user: { select: { email: true, firstName: true, lastName: true } },
          account: { select: { name: true } },
        },
      }),
    ]);

    const succeeded = byStatus.find(s => s.status === 'completed')?._count || 0;
    const failed = byStatus.find(s => s.status === 'failed')?._count || 0;
    const pending = total - succeeded - failed;

    return {
      total,
      succeeded,
      failed,
      pending,
      successRate: total > 0 ? Math.round((succeeded / total) * 100) : 0,
      byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
      byMethod: byMethod.reduce((acc, m) => ({ ...acc, [m.method]: m._count }), {}),
      byRisk: byRisk.reduce((acc, r) => ({ ...acc, [r.riskLevel]: r._count }), {}),
      recentFails,
    };
  }

  private static getTimeFilter(timeRange: string): Date {
    const now = new Date();
    switch (timeRange) {
      case '1h': return new Date(now.getTime() - 60 * 60 * 1000);
      case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default: return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }
}

// ============================================
// Super Admin Routes
// ============================================

/**
 * GET /api/fbm-posts/admin/stats
 * Get global FBM posting statistics (Super Admin only)
 */
router.get('/admin/stats', requireRole('SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const timeRange = (req.query.timeRange as string) || '24h';
    const stats = await FBMPostLogService.getStats(undefined, timeRange);

    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error getting FBM stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get FBM statistics' });
  }
});

/**
 * GET /api/fbm-posts/admin/logs
 * Get all FBM post logs (Super Admin only)
 */
router.get('/admin/logs', requireRole('SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = '1',
      limit = '50',
      status,
      method,
      triggerType,
      riskLevel,
      accountId,
      userId,
      success,
      timeRange = '24h',
      search,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = {
      createdAt: { gte: FBMPostLogService['getTimeFilter'](timeRange as string) },
    };

    if (status) whereClause.status = status;
    if (method) whereClause.method = method;
    if (triggerType) whereClause.triggerType = triggerType;
    if (riskLevel) whereClause.riskLevel = riskLevel;
    if (accountId) whereClause.accountId = accountId;
    if (userId) whereClause.userId = userId;
    if (success !== undefined) whereClause.success = success === 'true';
    if (search) {
      whereClause.OR = [
        { vehicle: { vin: { contains: search as string, mode: 'insensitive' } } },
        { vehicle: { make: { contains: search as string, mode: 'insensitive' } } },
        { vehicle: { model: { contains: search as string, mode: 'insensitive' } } },
        { errorMessage: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.fBMPostLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          vehicle: { select: { id: true, year: true, make: true, model: true, vin: true, stockNumber: true, imageUrls: true } },
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          account: { select: { id: true, name: true, dealershipName: true } },
          _count: { select: { events: true, retryLogs: true } },
        },
      }),
      prisma.fBMPostLog.count({ where: whereClause }),
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    logger.error('Error getting FBM logs:', error);
    res.status(500).json({ success: false, error: 'Failed to get FBM logs' });
  }
});

/**
 * GET /api/fbm-posts/admin/logs/:logId
 * Get detailed FBM post log with events (Super Admin only)
 */
router.get('/admin/logs/:logId', requireRole('SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { logId } = req.params;

    const log = await prisma.fBMPostLog.findUnique({
      where: { id: logId },
      include: {
        vehicle: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        account: { select: { id: true, name: true, dealershipName: true } },
        extensionTask: true,
        parentLog: { select: { id: true, status: true, createdAt: true } },
        retryLogs: { select: { id: true, status: true, attemptNumber: true, createdAt: true } },
        events: { orderBy: { timestamp: 'asc' } },
      },
    });

    if (!log) {
      res.status(404).json({ success: false, error: 'FBM post log not found' });
      return;
    }

    res.json({ success: true, data: log });
  } catch (error) {
    logger.error('Error getting FBM log detail:', error);
    res.status(500).json({ success: false, error: 'Failed to get FBM log detail' });
  }
});

/**
 * POST /api/fbm-posts/admin/logs/:logId/retry
 * Manually retry a failed post (Super Admin only)
 */
router.post('/admin/logs/:logId/retry', requireRole('SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { logId } = req.params;
    const { method } = req.body; // Optional: override method

    const originalLog = await prisma.fBMPostLog.findUnique({
      where: { id: logId },
      include: { vehicle: true },
    });

    if (!originalLog) {
      res.status(404).json({ success: false, error: 'FBM post log not found' });
      return;
    }

    if (originalLog.status !== 'failed') {
      res.status(400).json({ success: false, error: 'Can only retry failed posts' });
      return;
    }

    // Create retry log
    const retryLog = await FBMPostLogService.createLog({
      accountId: originalLog.accountId,
      vehicleId: originalLog.vehicleId,
      userId: req.user!.id,
      method: (method as any) || originalLog.method as any,
      triggerType: 'retry',
      vehicleData: originalLog.vehicleData,
      parentLogId: originalLog.id,
      attemptNumber: originalLog.attemptNumber + 1,
    });

    // Update original log
    await prisma.fBMPostLog.update({
      where: { id: logId },
      data: { retryCount: originalLog.retryCount + 1 },
    });

    res.json({
      success: true,
      message: 'Retry initiated',
      data: { retryLogId: retryLog.id },
    });
  } catch (error) {
    logger.error('Error retrying FBM post:', error);
    res.status(500).json({ success: false, error: 'Failed to retry FBM post' });
  }
});

/**
 * GET /api/fbm-posts/admin/accounts
 * Get accounts with FBM posting activity (Super Admin only)
 */
router.get('/admin/accounts', requireRole('SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const timeRange = (req.query.timeRange as string) || '24h';
    const timeFilter = FBMPostLogService['getTimeFilter'](timeRange);

    const accounts = await prisma.account.findMany({
      where: {
        fbmPostLogs: {
          some: { createdAt: { gte: timeFilter } },
        },
      },
      select: {
        id: true,
        name: true,
        dealershipName: true,
        _count: {
          select: {
            fbmPostLogs: { where: { createdAt: { gte: timeFilter } } },
          },
        },
        fbmPostLogs: {
          where: { createdAt: { gte: timeFilter } },
          select: { success: true },
        },
      },
    });

    const accountStats = accounts.map(acc => ({
      id: acc.id,
      name: acc.name || acc.dealershipName,
      total: acc._count.fbmPostLogs,
      succeeded: acc.fbmPostLogs.filter(l => l.success).length,
      failed: acc.fbmPostLogs.filter(l => !l.success).length,
      successRate: acc._count.fbmPostLogs > 0
        ? Math.round((acc.fbmPostLogs.filter(l => l.success).length / acc._count.fbmPostLogs) * 100)
        : 0,
    }));

    res.json({ success: true, data: accountStats });
  } catch (error) {
    logger.error('Error getting FBM accounts:', error);
    res.status(500).json({ success: false, error: 'Failed to get FBM accounts' });
  }
});

// ============================================
// User/Account Routes
// ============================================

/**
 * GET /api/fbm-posts/stats
 * Get FBM posting statistics for current user's account
 */
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.user!.accountIds[0];
    if (!accountId) {
      res.status(400).json({ success: false, error: 'No account found' });
      return;
    }

    const timeRange = (req.query.timeRange as string) || '24h';
    const stats = await FBMPostLogService.getStats(accountId, timeRange);

    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error getting FBM stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get FBM statistics' });
  }
});

/**
 * GET /api/fbm-posts/logs
 * Get FBM post logs for current user's account
 */
router.get('/logs', async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.user!.accountIds[0];
    if (!accountId) {
      res.status(400).json({ success: false, error: 'No account found' });
      return;
    }

    const {
      page = '1',
      limit = '20',
      status,
      method,
      success,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 50);
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = { accountId };
    if (status) whereClause.status = status;
    if (method) whereClause.method = method;
    if (success !== undefined) whereClause.success = success === 'true';

    const [logs, total] = await Promise.all([
      prisma.fBMPostLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          vehicle: { select: { id: true, year: true, make: true, model: true, vin: true, stockNumber: true, imageUrls: true } },
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          _count: { select: { events: true } },
        },
      }),
      prisma.fBMPostLog.count({ where: whereClause }),
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    logger.error('Error getting FBM logs:', error);
    res.status(500).json({ success: false, error: 'Failed to get FBM logs' });
  }
});

/**
 * GET /api/fbm-posts/logs/:logId
 * Get detailed FBM post log for current user's account
 */
router.get('/logs/:logId', async (req: AuthRequest, res: Response) => {
  try {
    const { logId } = req.params;
    const accountId = req.user!.accountIds[0];

    const log = await prisma.fBMPostLog.findFirst({
      where: { id: logId, accountId },
      include: {
        vehicle: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        extensionTask: true,
        events: { orderBy: { timestamp: 'asc' } },
        retryLogs: { select: { id: true, status: true, attemptNumber: true, createdAt: true } },
      },
    });

    if (!log) {
      res.status(404).json({ success: false, error: 'FBM post log not found' });
      return;
    }

    res.json({ success: true, data: log });
  } catch (error) {
    logger.error('Error getting FBM log detail:', error);
    res.status(500).json({ success: false, error: 'Failed to get FBM log detail' });
  }
});

/**
 * POST /api/fbm-posts/logs/:logId/retry
 * Retry a failed post
 */
router.post('/logs/:logId/retry', async (req: AuthRequest, res: Response) => {
  try {
    const { logId } = req.params;
    const accountId = req.user!.accountIds[0];

    const originalLog = await prisma.fBMPostLog.findFirst({
      where: { id: logId, accountId },
    });

    if (!originalLog) {
      res.status(404).json({ success: false, error: 'FBM post log not found' });
      return;
    }

    if (originalLog.status !== 'failed') {
      res.status(400).json({ success: false, error: 'Can only retry failed posts' });
      return;
    }

    // Create retry log
    const retryLog = await FBMPostLogService.createLog({
      accountId: originalLog.accountId,
      vehicleId: originalLog.vehicleId,
      userId: req.user!.id,
      method: originalLog.method as any,
      triggerType: 'retry',
      vehicleData: originalLog.vehicleData,
      parentLogId: originalLog.id,
      attemptNumber: originalLog.attemptNumber + 1,
    });

    res.json({
      success: true,
      message: 'Retry initiated',
      data: { retryLogId: retryLog.id },
    });
  } catch (error) {
    logger.error('Error retrying FBM post:', error);
    res.status(500).json({ success: false, error: 'Failed to retry FBM post' });
  }
});

// ============================================
// Internal API for updating logs
// ============================================

/**
 * POST /api/fbm-posts/internal/update
 * Internal endpoint for updating FBM post logs (used by extension/workers)
 */
router.post('/internal/update', async (req: AuthRequest, res: Response) => {
  try {
    const { logId, ...updates } = req.body;

    if (!logId) {
      res.status(400).json({ success: false, error: 'logId required' });
      return;
    }

    const updatedLog = await FBMPostLogService.updateLog(logId, updates);
    res.json({ success: true, data: updatedLog });
  } catch (error) {
    logger.error('Error updating FBM log:', error);
    res.status(500).json({ success: false, error: 'Failed to update FBM log' });
  }
});

/**
 * POST /api/fbm-posts/internal/event
 * Internal endpoint for adding events to FBM post logs
 */
router.post('/internal/event', async (req: AuthRequest, res: Response) => {
  try {
    const { logId, eventType, stage, message, source, details } = req.body;

    if (!logId || !eventType || !stage || !message) {
      res.status(400).json({ success: false, error: 'logId, eventType, stage, and message required' });
      return;
    }

    const event = await FBMPostLogService.addEvent(logId, {
      eventType,
      stage,
      message,
      source,
      details,
    });

    res.json({ success: true, data: event });
  } catch (error) {
    logger.error('Error adding FBM event:', error);
    res.status(500).json({ success: false, error: 'Failed to add FBM event' });
  }
});

export default router;
