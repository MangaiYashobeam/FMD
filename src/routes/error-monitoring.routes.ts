/**
 * Error Monitoring Routes
 * 
 * API endpoints for error monitoring and AI intervention system
 */

import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '@/middleware/auth';
import { errorMonitoringService, errorMonitoringEvents } from '@/services/error-monitoring.service';
import { aiInterventionService, aiInterventionEvents } from '@/services/ai-intervention.service';
import { logger } from '@/utils/logger';
import prisma from '@/config/database';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Helper to safely get string from query params
const getQueryString = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
};

// Helper to safely get string from params (ensures string type)
const getParamString = (value: string | string[]): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] || '';
  return '';
};

// Helper to safely parse int from query params
const getQueryInt = (value: unknown, defaultVal: number): number => {
  const str = getQueryString(value);
  if (!str) return defaultVal;
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? defaultVal : parsed;
};

/**
 * Check if user is admin/super admin
 */
const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId: req.user!.id },
    });

    if (!accountUser || !['SUPER_ADMIN', 'ADMIN', 'ACCOUNT_OWNER'].includes(accountUser.role)) {
      res.status(403).json({ success: false, error: 'Admin access required' });
      return;
    }

    next();
  } catch {
    res.status(500).json({ success: false, error: 'Authorization check failed' });
  }
};

// ============================================
// Error Logging (from frontend)
// ============================================

router.post('/log', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId },
    });

    const sessionHeader = req.headers['x-session-id'];
    const sessionToken = req.body.sessionToken || getQueryString(sessionHeader) || 'unknown';

    const errorData = {
      userId,
      accountId: accountUser?.accountId,
      sessionToken,
      errorType: req.body.errorType || 'unknown',
      errorCode: req.body.errorCode,
      errorMessage: req.body.errorMessage || 'No message provided',
      stackTrace: req.body.stackTrace,
      endpoint: req.body.endpoint,
      httpMethod: req.body.httpMethod,
      httpStatus: req.body.httpStatus,
      requestPayload: req.body.requestPayload,
      responsePayload: req.body.responsePayload,
      userAction: req.body.userAction,
      pageUrl: req.body.pageUrl,
      component: req.body.component,
      severity: req.body.severity || 'ERROR',
    };

    const errorLog = await errorMonitoringService.logError(errorData);

    res.status(201).json({
      success: true,
      data: { id: errorLog.id, logged: true },
    });
  } catch (error) {
    logger.error('Failed to log error:', error);
    res.status(500).json({ success: false, error: 'Failed to log error' });
  }
});

router.post('/batch-log', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId },
    });

    const sessionHeader = req.headers['x-session-id'];
    const defaultSessionToken = getQueryString(sessionHeader) || 'unknown';
    const errors = req.body.errors || [];
    const results = [];

    for (const err of errors) {
      const errorLog = await errorMonitoringService.logError({
        userId,
        accountId: accountUser?.accountId,
        sessionToken: err.sessionToken || defaultSessionToken,
        errorType: err.errorType || 'unknown',
        errorCode: err.errorCode,
        errorMessage: err.errorMessage || 'No message provided',
        stackTrace: err.stackTrace,
        endpoint: err.endpoint,
        httpMethod: err.httpMethod,
        httpStatus: err.httpStatus,
        userAction: err.userAction,
        pageUrl: err.pageUrl,
        component: err.component,
        severity: err.severity || 'ERROR',
      });
      results.push({ id: errorLog.id });
    }

    res.status(201).json({
      success: true,
      data: { logged: results.length, errors: results },
    });
  } catch (error) {
    logger.error('Failed to batch log errors:', error);
    res.status(500).json({ success: false, error: 'Failed to log errors' });
  }
});

// ============================================
// User-Facing Endpoints
// ============================================

router.get('/my-tickets', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const tickets = await errorMonitoringService.getUserActiveTickets(userId);
    res.json({ success: true, data: { tickets } });
  } catch (error) {
    logger.error('Failed to get user tickets:', error);
    res.status(500).json({ success: false, error: 'Failed to get tickets' });
  }
});

router.post('/interventions/:id/feedback', async (req: AuthRequest, res: Response) => {
  try {
    const id = getParamString(req.params.id);
    const { wasHelpful, userFeedback, stepsCompleted } = req.body;

    await aiInterventionService.recordFeedback(id, {
      wasHelpful,
      userFeedback,
      stepsCompleted,
    });

    res.json({ success: true, message: 'Feedback recorded' });
  } catch (error) {
    logger.error('Failed to record feedback:', error);
    res.status(500).json({ success: false, error: 'Failed to record feedback' });
  }
});

// ============================================
// Admin Endpoints
// ============================================

router.get('/stats', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId: req.user!.id },
    });

    const accountId = accountUser?.role === 'SUPER_ADMIN' 
      ? undefined 
      : accountUser?.accountId;

    const stats = await errorMonitoringService.getErrorStats(accountId);
    const interventionStats = await aiInterventionService.getInterventionStats(accountId);

    res.json({
      success: true,
      data: { errors: stats, interventions: interventionStats },
    });
  } catch (error) {
    logger.error('Failed to get stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get statistics' });
  }
});

router.get('/tickets', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId: req.user!.id },
    });

    const statusStr = getQueryString(req.query.status);
    const severityStr = getQueryString(req.query.severity);
    const alertColorStr = getQueryString(req.query.alertColor);

    const filters = {
      status: statusStr ? statusStr.split(',') as any : undefined,
      severity: severityStr ? severityStr.split(',') as any : undefined,
      alertColor: alertColorStr ? alertColorStr.split(',') : undefined,
      accountId: accountUser?.role === 'SUPER_ADMIN' ? undefined : accountUser?.accountId,
      limit: getQueryInt(req.query.limit, 50),
      offset: getQueryInt(req.query.offset, 0),
    };

    const result = await errorMonitoringService.getTickets(filters);

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to get tickets:', error);
    res.status(500).json({ success: false, error: 'Failed to get tickets' });
  }
});

router.get('/tickets/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const ticketId = getParamString(req.params.id);
    const ticket = await prisma.errorTicket.findUnique({
      where: { id: ticketId },
      include: {
        errorLogs: { orderBy: { createdAt: 'desc' } },
        interventions: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!ticket) {
      res.status(404).json({ success: false, error: 'Ticket not found' });
      return;
    }

    res.json({ success: true, data: ticket });
  } catch (error) {
    logger.error('Failed to get ticket:', error);
    res.status(500).json({ success: false, error: 'Failed to get ticket' });
  }
});

router.put('/tickets/:id/status', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const ticketId = getParamString(req.params.id);
    const { status, resolutionMethod, resolutionNotes, escalatedTo, escalationReason } = req.body;

    const ticket = await errorMonitoringService.updateTicketStatus(
      ticketId,
      status,
      { resolutionMethod, resolutionNotes, escalatedTo, escalationReason }
    );

    res.json({ success: true, data: ticket });
  } catch (error) {
    logger.error('Failed to update ticket status:', error);
    res.status(500).json({ success: false, error: 'Failed to update ticket' });
  }
});

router.post('/tickets/:id/escalate', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const ticketId = getParamString(req.params.id);
    const { reason } = req.body;
    await aiInterventionService.escalateToAdmin(ticketId, reason || 'Manual escalation');
    res.json({ success: true, message: 'Ticket escalated' });
  } catch (error) {
    logger.error('Failed to escalate ticket:', error);
    res.status(500).json({ success: false, error: 'Failed to escalate ticket' });
  }
});

router.post('/tickets/:id/intervene', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const ticketId = getParamString(req.params.id);
    const ticket = await prisma.errorTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      res.status(404).json({ success: false, error: 'Ticket not found' });
      return;
    }

    await errorMonitoringService.requestAIIntervention(ticket);
    res.json({ success: true, message: 'AI intervention triggered' });
  } catch (error) {
    logger.error('Failed to trigger intervention:', error);
    res.status(500).json({ success: false, error: 'Failed to trigger intervention' });
  }
});

// ============================================
// Configuration Endpoints
// ============================================

router.get('/config', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId: req.user!.id },
    });

    const config = await errorMonitoringService.getConfig(
      accountUser?.role === 'SUPER_ADMIN' ? undefined : accountUser?.accountId
    );

    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Failed to get config:', error);
    res.status(500).json({ success: false, error: 'Failed to get configuration' });
  }
});

router.put('/config', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId: req.user!.id },
    });

    const accountId = accountUser?.role === 'SUPER_ADMIN' && req.body.global
      ? null
      : accountUser?.accountId ?? null;

    const config = await errorMonitoringService.updateConfig(accountId, req.body);

    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Failed to update config:', error);
    res.status(500).json({ success: false, error: 'Failed to update configuration' });
  }
});

// ============================================
// Error Patterns
// ============================================

router.get('/patterns', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const patterns = await prisma.errorPattern.findMany({
      orderBy: [
        { totalOccurrences: 'desc' },
        { lastUpdated: 'desc' },
      ],
      take: getQueryInt(req.query.limit, 50),
    });

    res.json({ success: true, data: { patterns } });
  } catch (error) {
    logger.error('Failed to get patterns:', error);
    res.status(500).json({ success: false, error: 'Failed to get patterns' });
  }
});

router.put('/patterns/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const patternId = getParamString(req.params.id);
    const { rootCause, solution, preventionTips, isVerified, severity } = req.body;

    const pattern = await prisma.errorPattern.update({
      where: { id: patternId },
      data: {
        rootCause,
        solution,
        preventionTips,
        isVerified,
        severity,
        lastUpdated: new Date(),
      },
    });

    res.json({ success: true, data: pattern });
  } catch (error) {
    logger.error('Failed to update pattern:', error);
    res.status(500).json({ success: false, error: 'Failed to update pattern' });
  }
});

// ============================================
// Summaries and Reports
// ============================================

router.get('/summaries', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId: req.user!.id },
    });

    const summaries = await prisma.aIInterventionSummary.findMany({
      where: accountUser?.role === 'SUPER_ADMIN'
        ? {}
        : { accountId: accountUser?.accountId },
      orderBy: { createdAt: 'desc' },
      take: getQueryInt(req.query.limit, 30),
    });

    res.json({ success: true, data: { summaries } });
  } catch (error) {
    logger.error('Failed to get summaries:', error);
    res.status(500).json({ success: false, error: 'Failed to get summaries' });
  }
});

router.post('/summaries/generate', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId: req.user!.id },
    });

    const accountId = accountUser?.role === 'SUPER_ADMIN'
      ? undefined
      : accountUser?.accountId;

    const summary = await errorMonitoringService.generateDailySummary(accountId);

    if (accountUser?.role === 'SUPER_ADMIN') {
      await aiInterventionService.generateRootAISummary(summary.id);
    }

    res.json({ success: true, data: summary });
  } catch (error) {
    logger.error('Failed to generate summary:', error);
    res.status(500).json({ success: false, error: 'Failed to generate summary' });
  }
});

router.post('/summaries/:id/root-summary', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const summaryId = getParamString(req.params.id);
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId: req.user!.id },
    });

    if (accountUser?.role !== 'SUPER_ADMIN') {
      res.status(403).json({ success: false, error: 'Super admin access required' });
      return;
    }

    const rootSummary = await aiInterventionService.generateRootAISummary(summaryId);

    res.json({ success: true, data: { rootSummary } });
  } catch (error) {
    logger.error('Failed to generate root summary:', error);
    res.status(500).json({ success: false, error: 'Failed to generate summary' });
  }
});

// ============================================
// Real-time Monitoring (SSE)
// ============================================

router.get('/stream', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    const onError = (data: any) => {
      res.write(`data: ${JSON.stringify({ type: 'error', data })}\n\n`);
    };

    const onTicket = (data: any) => {
      res.write(`data: ${JSON.stringify({ type: 'ticket', data })}\n\n`);
    };

    const onIntervention = (data: any) => {
      res.write(`data: ${JSON.stringify({ type: 'intervention', data })}\n\n`);
    };

    const onScan = (data: any) => {
      res.write(`data: ${JSON.stringify({ type: 'scan', data })}\n\n`);
    };

    errorMonitoringEvents.on('error:new', onError);
    errorMonitoringEvents.on('ticket:created', onTicket);
    errorMonitoringEvents.on('ticket:updated', onTicket);
    errorMonitoringEvents.on('ticket:critical', onTicket);
    errorMonitoringEvents.on('scan:complete', onScan);
    aiInterventionEvents.on('message:sent', onIntervention);
    aiInterventionEvents.on('ticket:escalated', onIntervention);

    const heartbeat = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
      errorMonitoringEvents.off('error:new', onError);
      errorMonitoringEvents.off('ticket:created', onTicket);
      errorMonitoringEvents.off('ticket:updated', onTicket);
      errorMonitoringEvents.off('ticket:critical', onTicket);
      errorMonitoringEvents.off('scan:complete', onScan);
      aiInterventionEvents.off('message:sent', onIntervention);
      aiInterventionEvents.off('ticket:escalated', onIntervention);
    });

  } catch (error) {
    logger.error('SSE stream error:', error);
    res.status(500).json({ success: false, error: 'Stream failed' });
  }
});

// ============================================
// User Activity Monitoring
// ============================================

router.get('/users/:userId/errors', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const userId = getParamString(req.params.userId);
    const errors = await errorMonitoringService.getUserActiveErrors(userId);
    res.json({ success: true, data: { errors } });
  } catch (error) {
    logger.error('Failed to get user errors:', error);
    res.status(500).json({ success: false, error: 'Failed to get user errors' });
  }
});

router.get('/interventions', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId: req.user!.id },
    });

    const interventions = await prisma.aIIntervention.findMany({
      where: accountUser?.role === 'SUPER_ADMIN'
        ? {}
        : { ticket: { accountId: accountUser?.accountId } },
      include: {
        ticket: {
          select: {
            ticketNumber: true,
            title: true,
            severity: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: getQueryInt(req.query.limit, 50),
      skip: getQueryInt(req.query.offset, 0),
    });

    res.json({ success: true, data: { interventions } });
  } catch (error) {
    logger.error('Failed to get interventions:', error);
    res.status(500).json({ success: false, error: 'Failed to get interventions' });
  }
});

export default router;
