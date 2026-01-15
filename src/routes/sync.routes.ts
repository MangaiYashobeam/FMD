import { Router } from 'express';
import { param, query } from 'express-validator';
import { authenticate } from '@/middleware/auth';
import { SyncController } from '@/controllers/sync.controller';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate, syncValidators } from '@/middleware/validation';

const router = Router();
const controller = new SyncController();

router.use(authenticate);

/**
 * @route   POST /api/sync/manual
 * @desc    Trigger manual sync
 * @access  Private
 */
router.post(
  '/manual',
  validate(syncValidators.trigger),
  asyncHandler(controller.triggerSync.bind(controller))
);

/**
 * @route   GET /api/sync/status/:jobId
 * @desc    Get sync job status
 * @access  Private
 */
router.get(
  '/status/:jobId',
  validate([param('jobId').isUUID().withMessage('Invalid job ID')]),
  asyncHandler(controller.getStatus.bind(controller))
);

/**
 * @route   GET /api/sync/history
 * @desc    Get sync history
 * @access  Private
 */
router.get(
  '/history',
  validate([
    query('accountId').isUUID().withMessage('Invalid account ID'),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ]),
  asyncHandler(controller.getHistory.bind(controller))
);

/**
 * @route   GET /api/sync/scheduler/status
 * @desc    Get scheduler status
 * @access  Private
 */
router.get('/scheduler/status', asyncHandler(controller.getSchedulerStatus.bind(controller)));

export default router;
