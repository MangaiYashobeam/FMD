/**
 * Nova Monitoring Routes
 * 
 * API endpoints for Nova monitoring integration:
 * - Admin notifications
 * - Active alerts
 * - Chat history
 * - Conversation memory
 * - Error analysis triggers
 */

import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '@/middleware/auth';
import { requireSuperAdmin } from '@/middleware/rbac';
import { novaMonitoringService, novaMonitoringEvents } from '@/services/nova-monitoring.service';
import { logger } from '@/utils/logger';
import jwt from 'jsonwebtoken';
import prisma from '@/config/database';

const router = Router();

// ============================================
// SSE Stream for Admin Notifications (before auth)
// ============================================

/**
 * @route GET /api/nova/notifications/stream
 * @desc SSE endpoint for real-time admin notifications
 * @access Super Admin (token in query param)
 */
router.get('/notifications/stream', async (req, res: Response) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : null;
    
    if (!token) {
      res.status(401).json({ success: false, error: 'Token required' });
      return;
    }

    // Verify token
    let decoded: { id: string };
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
    } catch {
      res.status(401).json({ success: false, error: 'Invalid token' });
      return;
    }

    // Verify super admin
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId: decoded.id, role: 'SUPER_ADMIN' },
    });

    if (!accountUser) {
      res.status(403).json({ success: false, error: 'Super admin access required' });
      return;
    }

    const userId = decoded.id;

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send initial connection event with existing notifications
    const existingNotifications = novaMonitoringService.getAdminNotifications(userId);
    res.write(`data: ${JSON.stringify({ 
      type: 'connected',
      notifications: existingNotifications.slice(-20),
    })}\n\n`);

    // Handler for new notifications
    const onNotification = (data: { userId: string; notification: any }) => {
      if (data.userId === userId) {
        res.write(`data: ${JSON.stringify({ 
          type: 'notification',
          notification: data.notification,
        })}\n\n`);
      }
    };

    // Handler for health checks
    const onHealthCheck = (data: any) => {
      res.write(`data: ${JSON.stringify({ 
        type: 'health',
        data,
      })}\n\n`);
    };

    // Subscribe to events
    novaMonitoringEvents.on('admin:notification', onNotification);
    novaMonitoringEvents.on('health:check', onHealthCheck);

    // Heartbeat
    const heartbeat = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
    }, 30000);

    // Cleanup
    req.on('close', () => {
      clearInterval(heartbeat);
      novaMonitoringEvents.off('admin:notification', onNotification);
      novaMonitoringEvents.off('health:check', onHealthCheck);
      logger.info(`Admin ${userId} disconnected from Nova notifications`);
    });

    logger.info(`Admin ${userId} connected to Nova notification stream`);
  } catch (error) {
    logger.error('Nova notification stream error:', error);
    res.status(500).json({ success: false, error: 'Stream failed' });
  }
});

// All other routes require authentication
router.use(authenticate);

// ============================================
// Admin Notifications
// ============================================

/**
 * @route GET /api/nova/notifications
 * @desc Get admin notifications
 * @access Super Admin
 */
router.get('/notifications', requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const notifications = novaMonitoringService.getAdminNotifications(userId);

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount: notifications.filter(n => !n.isRead).length,
      },
    });
  } catch (error) {
    logger.error('Failed to get notifications:', error);
    res.status(500).json({ success: false, error: 'Failed to get notifications' });
  }
});

/**
 * @route PUT /api/nova/notifications/:id/read
 * @desc Mark notification as read
 * @access Super Admin
 */
router.put('/notifications/:id/read', requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const notificationId = req.params.id as string;

    novaMonitoringService.markNotificationRead(userId, notificationId);

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to mark notification read:', error);
    res.status(500).json({ success: false, error: 'Failed to update notification' });
  }
});

// ============================================
// Active Alerts
// ============================================

/**
 * @route GET /api/nova/alerts
 * @desc Get all active alerts
 * @access Super Admin
 */
router.get('/alerts', requireSuperAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const alerts = novaMonitoringService.getActiveAlerts();

    res.json({
      success: true,
      data: {
        alerts,
        total: alerts.length,
        criticalCount: alerts.filter(a => a.severity === 'CRITICAL' || a.severity === 'FATAL').length,
      },
    });
  } catch (error) {
    logger.error('Failed to get alerts:', error);
    res.status(500).json({ success: false, error: 'Failed to get alerts' });
  }
});

/**
 * @route POST /api/nova/alerts/analyze
 * @desc Trigger error analysis
 * @access Super Admin
 */
router.post('/alerts/analyze', requireSuperAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await novaMonitoringService.analyzeCurrentErrors();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Failed to analyze errors:', error);
    res.status(500).json({ success: false, error: 'Failed to analyze errors' });
  }
});

// ============================================
// Chat History
// ============================================

/**
 * @route GET /api/nova/history
 * @desc Get admin chat history
 * @access Super Admin
 */
router.get('/history', requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 20;

    const history = await novaMonitoringService.getAdminChatHistory(userId, limit);

    res.json({
      success: true,
      data: {
        sessions: history,
        total: history.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get chat history:', error);
    res.status(500).json({ success: false, error: 'Failed to get chat history' });
  }
});

/**
 * @route GET /api/nova/history/:sessionId
 * @desc Get full chat history for a session with context
 * @access Private
 */
router.get('/history/:sessionId', async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await novaMonitoringService.getChatHistoryWithContext(sessionId, limit);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Failed to get session history:', error);
    res.status(500).json({ success: false, error: 'Failed to get session history' });
  }
});

/**
 * @route GET /api/nova/history/user/:userId/sessions
 * @desc Get all chat sessions for a user
 * @access Super Admin
 */
router.get('/history/user/:userId/sessions', requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const { type, status = 'active' } = req.query;

    const sessions = await prisma.aIChatSession.findMany({
      where: {
        userId: userId,
        status: status as string,
        ...(type && { sessionType: type as string }),
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    res.json({
      success: true,
      data: {
        sessions,
        total: sessions.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get user sessions:', error);
    res.status(500).json({ success: false, error: 'Failed to get sessions' });
  }
});

// ============================================
// Conversation Memory
// ============================================

/**
 * @route GET /api/nova/memory/:userId
 * @desc Get conversation memory for a user
 * @access Super Admin
 */
router.get('/memory/:userId', requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const memory = novaMonitoringService.getConversationMemory(userId);

    // Also get persisted memory from database
    const persistedMemories = await prisma.aIUserMemory.findMany({
      where: {
        userId: userId,
        category: 'CONVERSATION',
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    res.json({
      success: true,
      data: {
        currentMemory: memory || null,
        persistedMemories: persistedMemories.map(m => ({
          key: m.key,
          value: JSON.parse(m.value as string),
          updatedAt: m.updatedAt,
        })),
      },
    });
  } catch (error) {
    logger.error('Failed to get conversation memory:', error);
    res.status(500).json({ success: false, error: 'Failed to get memory' });
  }
});

/**
 * @route POST /api/nova/memory
 * @desc Store conversation context
 * @access Private
 */
router.post('/memory', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { sessionId, context } = req.body;

    if (!sessionId || !context) {
      res.status(400).json({ success: false, error: 'sessionId and context required' });
      return;
    }

    await novaMonitoringService.storeConversationContext(userId, sessionId, context);

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to store conversation context:', error);
    res.status(500).json({ success: false, error: 'Failed to store context' });
  }
});

// ============================================
// Health Status
// ============================================

/**
 * @route GET /api/nova/health
 * @desc Get Nova monitoring health status
 * @access Super Admin
 */
router.get('/health', requireSuperAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    // Get various health metrics
    const [
      totalErrors,
      criticalTickets,
      unprocessedErrors,
      recentInterventions,
    ] = await Promise.all([
      prisma.userSessionErrorLog.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.errorTicket.count({
        where: {
          severity: { in: ['CRITICAL', 'FATAL'] },
          status: { notIn: ['RESOLVED', 'CLOSED'] },
        },
      }),
      prisma.userSessionErrorLog.count({
        where: { processed: false },
      }),
      prisma.aIIntervention.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const activeAlerts = novaMonitoringService.getActiveAlerts();

    res.json({
      success: true,
      data: {
        status: criticalTickets > 0 ? 'critical' : unprocessedErrors > 10 ? 'warning' : 'healthy',
        metrics: {
          totalErrors24h: totalErrors,
          criticalTickets,
          unprocessedErrors,
          recentInterventions,
          activeAlerts: activeAlerts.length,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get health status:', error);
    res.status(500).json({ success: false, error: 'Failed to get health status' });
  }
});

export default router;
