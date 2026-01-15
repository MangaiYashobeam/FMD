import { Router } from 'express';
import { param, query, body } from 'express-validator';
import multer from 'multer';
import path from 'path';
import { authenticate } from '@/middleware/auth';
import { SyncController } from '@/controllers/sync.controller';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate, syncValidators } from '@/middleware/validation';

const router = Router();
const controller = new SyncController();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedExtensions = ['.csv', '.xlsx', '.xls', '.xml'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: CSV, Excel (.xlsx, .xls), XML'));
    }
  },
});

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

/**
 * @route   POST /api/sync/upload
 * @desc    Upload inventory file (CSV, Excel, XML)
 * @access  Private
 */
router.post(
  '/upload',
  upload.single('file'),
  validate([
    body('accountId').isUUID().withMessage('Invalid account ID'),
    body('skipHeader').optional().isBoolean(),
    body('updateExisting').optional().isBoolean(),
    body('markMissingSold').optional().isBoolean(),
    body('delimiter').optional().isIn(['comma', 'semicolon', 'tab', 'pipe']),
  ]),
  asyncHandler(controller.uploadInventoryFile.bind(controller))
);

export default router;
