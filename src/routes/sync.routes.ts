import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { SyncController } from '@/controllers/sync.controller';
import { asyncHandler } from '@/utils/asyncHandler';

const router = Router();
const controller = new SyncController();

router.use(authenticate);

/**
 * @route   POST /api/sync/manual
 * @desc    Trigger manual sync
 * @access  Private
 */
router.post('/manual', asyncHandler(controller.triggerSync.bind(controller)));

/**
 * @route   GET /api/sync/status/:jobId
 * @desc    Get sync job status
 * @access  Private
 */
router.get('/status/:jobId', asyncHandler(controller.getStatus.bind(controller)));

/**
 * @route   GET /api/sync/history
 * @desc    Get sync history
 * @access  Private
 */
router.get('/history', asyncHandler(controller.getHistory.bind(controller)));

/**
 * @route   GET /api/sync/scheduler/status
 * @desc    Get scheduler status
 * @access  Private
 */
router.get('/scheduler/status', asyncHandler(controller.getSchedulerStatus.bind(controller)));

export default router;
