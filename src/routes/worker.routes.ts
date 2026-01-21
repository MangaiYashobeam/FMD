/**
 * Worker Management Routes
 * 
 * API endpoints for managing Python headless browser workers
 */

import { Router, Request, Response } from 'express';
import { workerQueueService, TaskPriority } from '@/services/worker-queue.service';
import { requireSuperAdmin } from '@/middleware/rbac';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * Get worker queue status and statistics
 * GET /api/workers/status
 */
router.get('/status', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const isAvailable = workerQueueService.isAvailable();
    
    if (!isAvailable) {
      return res.json({
        available: false,
        message: 'Worker queue not configured (REDIS_URL not set)',
        stats: null,
        workers: [],
      });
    }

    const [stats, workers] = await Promise.all([
      workerQueueService.getQueueStats(),
      workerQueueService.getActiveWorkers(),
    ]);

    return res.json({
      available: true,
      stats,
      workers,
    });
    
  } catch (error) {
    logger.error('Failed to get worker status', { error });
    return res.status(500).json({ error: 'Failed to get worker status' });
  }
});

/**
 * Queue a vehicle for posting via Python worker
 * POST /api/workers/queue-vehicle
 */
router.post('/queue-vehicle', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const {
      accountId,
      vehicle,
      photos,
      groups,
      priority = 'normal',
    } = req.body;

    if (!accountId || !vehicle) {
      return res.status(400).json({ error: 'accountId and vehicle are required' });
    }

    const taskPriority = priority === 'high' ? TaskPriority.HIGH : 
                         priority === 'low' ? TaskPriority.LOW : TaskPriority.NORMAL;

    const taskId = await workerQueueService.queueVehiclePosting(
      accountId,
      vehicle,
      photos || [],
      groups || [],
      taskPriority
    );

    if (!taskId) {
      return res.status(503).json({ error: 'Worker queue not available' });
    }

    return res.json({
      success: true,
      taskId,
      message: 'Vehicle posting task queued',
    });
    
  } catch (error) {
    logger.error('Failed to queue vehicle posting', { error });
    return res.status(500).json({ error: 'Failed to queue vehicle posting' });
  }
});

/**
 * Get task status
 * GET /api/workers/task/:taskId
 */
router.get('/task/:taskId', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const taskId = req.params.taskId as string;

    const status = await workerQueueService.getTaskStatus(taskId);

    if (!status) {
      return res.status(404).json({ error: 'Task not found' });
    }

    return res.json(status);
    
  } catch (error) {
    logger.error('Failed to get task status', { error });
    return res.status(500).json({ error: 'Failed to get task status' });
  }
});

/**
 * Validate a Facebook session
 * POST /api/workers/validate-session
 */
router.post('/validate-session', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required' });
    }

    const taskId = await workerQueueService.queueSessionValidation(accountId);

    if (!taskId) {
      return res.status(503).json({ error: 'Worker queue not available' });
    }

    return res.json({
      success: true,
      taskId,
      message: 'Session validation queued',
    });
    
  } catch (error) {
    logger.error('Failed to queue session validation', { error });
    return res.status(500).json({ error: 'Failed to queue session validation' });
  }
});

/**
 * Cleanup old task records
 * POST /api/workers/cleanup
 */
router.post('/cleanup', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { olderThanDays = 7 } = req.body;

    await workerQueueService.cleanupOldTasks(olderThanDays);

    return res.json({
      success: true,
      message: `Cleaned up tasks older than ${olderThanDays} days`,
    });
    
  } catch (error) {
    logger.error('Failed to cleanup tasks', { error });
    return res.status(500).json({ error: 'Failed to cleanup tasks' });
  }
});

/**
 * Receive task results from Python workers
 * POST /api/workers/task-result
 * (Called by Python workers)
 */
router.post('/task-result', async (req: Request, res: Response) => {
  try {
    const workerSecret = req.headers['x-worker-secret'];
    
    // Verify worker authentication
    if (workerSecret !== process.env.WORKER_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = req.body;
    
    logger.info('Received task result from worker', {
      taskId: result.task_id,
      status: result.status,
      workerId: result.worker_id,
    });

    // The result will be processed via Redis pub/sub in workerQueueService
    // This endpoint is for workers that don't use pub/sub

    return res.json({ received: true });
    
  } catch (error) {
    logger.error('Failed to process task result', { error });
    return res.status(500).json({ error: 'Failed to process task result' });
  }
});

export default router;
