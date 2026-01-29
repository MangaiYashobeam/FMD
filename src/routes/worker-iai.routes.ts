/**
 * Worker IAI Routes
 * 
 * These routes allow Python workers to communicate with the Node.js API
 * Authentication is via X-Worker-Secret header instead of JWT
 * 
 * Endpoints:
 * - POST /api/worker/iai/log-activity - Log soldier activity
 * - POST /api/worker/iai/update-status - Update soldier status  
 * - POST /api/worker/iai/task-complete - Report task completion
 * - POST /api/worker/iai/heartbeat - Worker heartbeat
 */

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '@/config/database';
import { logger } from '@/utils/logger';

// WebSocket notification stub - logs for now, can be enhanced with real WebSocket later
function emitIAISoldierUpdate(accountId: string, event: any): void {
  logger.debug('[IAI Update] WebSocket notification', { accountId, event });
}

const router = Router();

// Worker secret validation middleware
const validateWorkerSecret = (req: Request, res: Response, next: NextFunction): void => {
  const workerSecret = req.headers['x-worker-secret'] as string;
  const expectedSecret = process.env.WORKER_SECRET || 'fmd-worker-secret-2024';
  
  if (!workerSecret || workerSecret !== expectedSecret) {
    logger.warn('[Worker IAI] Unauthorized worker request', {
      providedSecret: workerSecret ? '***' : 'none',
      ip: req.ip,
      path: req.path,
    });
    res.status(401).json({
      success: false,
      error: 'Unauthorized - Invalid worker secret',
    });
    return;
  }
  
  next();
};

// Apply worker secret validation to all routes
router.use(validateWorkerSecret);

/**
 * POST /log-activity
 * Log soldier activity event
 */
router.post('/log-activity', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      soldierId,
      eventType,
      message,
      details,
      taskId,
      vehicleId,
      severity = 'info',
    } = req.body;

    if (!soldierId || !eventType || !message) {
      res.status(400).json({
        success: false,
        error: 'soldierId, eventType, and message are required',
      });
      return;
    }

    // Get soldier to get accountId
    const soldier = await prisma.iAISoldier.findUnique({
      where: { id: soldierId },
      select: { id: true, accountId: true },
    });

    if (!soldier) {
      res.status(404).json({
        success: false,
        error: 'Soldier not found',
      });
      return;
    }

    // Create activity log entry
    const activity = await prisma.iAIActivityLog.create({
      data: {
        soldierId,
        accountId: soldier.accountId,
        eventType,
        message,
        eventData: details ? details : undefined,
        taskId: taskId || null,
        taskType: vehicleId ? 'VEHICLE_POST' : undefined,
      },
    });

    // Update soldier's lastActivityAt
    await prisma.iAISoldier.update({
      where: { id: soldierId },
      data: { 
        lastHeartbeatAt: new Date(),
        // Update activity counter if this is a significant event
        ...(eventType === 'TASK_START' && { currentTaskStartedAt: new Date() }),
      },
    });

    // Emit real-time update via WebSocket
    emitIAISoldierUpdate(soldier.accountId, {
      type: 'activity',
      soldierId,
      activity: {
        id: activity.id,
        eventType,
        message,
        details,
        severity,
        timestamp: activity.createdAt,
      },
    });

    logger.info(`[Worker IAI] Activity logged for soldier ${soldierId}: ${eventType}`, {
      message,
      taskId,
      vehicleId,
    });

    res.json({
      success: true,
      activityId: activity.id,
      timestamp: activity.createdAt,
    });
  } catch (error: any) {
    logger.error('[Worker IAI] Failed to log activity:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /update-status
 * Update soldier status
 */
router.post('/update-status', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      soldierId,
      status,
      currentTask,
      progress,
      error: errorMessage,
    } = req.body;

    if (!soldierId || !status) {
      res.status(400).json({
        success: false,
        error: 'soldierId and status are required',
      });
      return;
    }

    // Validate status
    const validStatuses = ['IDLE', 'READY', 'WORKING', 'ERROR', 'OFFLINE', 'PAUSED', 'ONLINE'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
      return;
    }

    // Update soldier status
    const updateData: any = {
      status,
      lastHeartbeatAt: new Date(),
    };

    if (currentTask !== undefined) {
      updateData.currentTaskType = currentTask;
    }
    if (errorMessage) {
      updateData.lastError = errorMessage;
      updateData.lastErrorAt = new Date();
    }

    const soldier = await prisma.iAISoldier.update({
      where: { id: soldierId },
      data: updateData,
      include: { account: true },
    });

    // Emit real-time update via WebSocket
    emitIAISoldierUpdate(soldier.accountId, {
      type: 'status',
      soldierId,
      status,
      currentTask,
      progress,
      lastHeartbeatAt: soldier.lastHeartbeatAt,
    });

    // Log the status change as an activity
    await prisma.iAIActivityLog.create({
      data: {
        soldierId,
        accountId: soldier.accountId,
        eventType: 'status_change',
        message: `Status changed to ${status}${currentTask ? `: ${currentTask}` : ''}`,
        eventData: { status, currentTask, progress, errorMessage },
      },
    });

    logger.info(`[Worker IAI] Status updated for soldier ${soldierId}: ${status}`);

    res.json({
      success: true,
      soldier: {
        id: soldier.id,
        status: soldier.status,
        currentTaskType: soldier.currentTaskType,
        lastHeartbeatAt: soldier.lastHeartbeatAt,
      },
    });
  } catch (error: any) {
    logger.error('[Worker IAI] Failed to update status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /task-complete
 * Report task completion
 */
router.post('/task-complete', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      soldierId,
      taskId,
      success,
      duration,
      error: errorMessage,
      result,
    } = req.body;

    if (!soldierId || !taskId || success === undefined) {
      res.status(400).json({
        success: false,
        error: 'soldierId, taskId, and success are required',
      });
      return;
    }

    // Update soldier stats
    const updateData: any = {
      status: 'READY',
      currentTaskId: null,
      currentTaskType: null,
      currentTaskStartedAt: null,
      lastHeartbeatAt: new Date(),
    };

    if (success) {
      updateData.tasksCompleted = { increment: 1 };
    } else {
      updateData.tasksFailed = { increment: 1 };
      updateData.lastError = errorMessage || 'Task failed';
      updateData.lastErrorAt = new Date();
    }

    const soldier = await prisma.iAISoldier.update({
      where: { id: soldierId },
      data: updateData,
      include: { account: true },
    });

    // Calculate new success rate
    const totalTasks = soldier.tasksCompleted + soldier.tasksFailed;
    if (totalTasks > 0) {
      const successRate = (soldier.tasksCompleted / totalTasks) * 100;
      await prisma.iAISoldier.update({
        where: { id: soldierId },
        data: { successRate: Math.round(successRate * 10) / 10 },
      });
    }

    // Log task completion as activity
    await prisma.iAIActivityLog.create({
      data: {
        soldierId,
        accountId: soldier.accountId,
        eventType: success ? 'task_complete' : 'task_fail',
        message: success 
          ? `Task ${taskId} completed successfully${duration ? ` in ${duration}ms` : ''}`
          : `Task ${taskId} failed: ${errorMessage || 'Unknown error'}`,
        eventData: { taskId, success, duration, result, errorMessage },
        taskId,
        taskResult: result ? result : undefined,
      },
    });

    // Emit real-time update via WebSocket
    emitIAISoldierUpdate(soldier.accountId, {
      type: 'task_complete',
      soldierId,
      taskId,
      success,
      duration,
      tasksCompleted: soldier.tasksCompleted,
      tasksFailed: soldier.tasksFailed,
      successRate: soldier.successRate,
    });

    logger.info(`[Worker IAI] Task ${taskId} completed for soldier ${soldierId}: ${success ? 'SUCCESS' : 'FAILED'}`);

    res.json({
      success: true,
      soldier: {
        id: soldier.id,
        status: soldier.status,
        tasksCompleted: soldier.tasksCompleted,
        tasksFailed: soldier.tasksFailed,
        successRate: soldier.successRate,
      },
    });
  } catch (error: any) {
    logger.error('[Worker IAI] Failed to complete task:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /heartbeat
 * Worker heartbeat to keep soldier alive
 */
router.post('/heartbeat', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      soldierId,
      workerId,
      browserStatus,
      memoryUsage,
      cpuUsage,
      currentTask,
      queuePosition,
    } = req.body;

    if (!soldierId) {
      res.status(400).json({
        success: false,
        error: 'soldierId is required',
      });
      return;
    }

    // Check if soldier exists
    const existingSoldier = await prisma.iAISoldier.findUnique({
      where: { id: soldierId },
    });

    if (!existingSoldier) {
      res.status(404).json({
        success: false,
        error: 'Soldier not found',
      });
      return;
    }

    // Update heartbeat
    const updateData: any = {
      lastHeartbeatAt: new Date(),
    };

    // If soldier was offline, bring it back online
    if (existingSoldier.status === 'OFFLINE') {
      updateData.status = 'READY';
    }

    if (currentTask) {
      updateData.currentTaskType = currentTask;
    }

    const soldier = await prisma.iAISoldier.update({
      where: { id: soldierId },
      data: updateData,
      include: { account: true },
    });

    // Emit heartbeat via WebSocket for real-time UI updates
    emitIAISoldierUpdate(soldier.accountId, {
      type: 'heartbeat',
      soldierId,
      status: soldier.status,
      currentTaskType: soldier.currentTaskType,
      lastHeartbeatAt: soldier.lastHeartbeatAt,
      metadata: {
        workerId,
        browserStatus,
        memoryUsage,
        cpuUsage,
        queuePosition,
      },
    });

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      soldier: {
        id: soldier.id,
        status: soldier.status,
        currentTaskType: soldier.currentTaskType,
      },
    });
  } catch (error: any) {
    logger.error('[Worker IAI] Failed to process heartbeat:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /soldiers/:accountId
 * Get all soldiers for an account (for worker initialization)
 */
router.get('/soldiers/:accountId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountId } = req.params;

    const accountIdStr = Array.isArray(accountId) ? accountId[0] : accountId;
    
    const soldiers = await prisma.iAISoldier.findMany({
      where: { accountId: accountIdStr },
      select: {
        id: true,
        soldierId: true,
        status: true,
        browserId: true,
        genre: true,
        executionSource: true,
      },
    });

    res.json({
      success: true,
      soldiers,
    });
  } catch (error: any) {
    logger.error('[Worker IAI] Failed to get soldiers:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
