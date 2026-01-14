import { Router } from 'express';
import { authenticate } from '@/middleware/auth';

const router = Router();

router.use(authenticate);

/**
 * @route   POST /api/sync/manual
 * @desc    Trigger manual sync
 * @access  Private
 */
router.post('/manual', (_req, res) => {
  res.json({ success: true, message: 'Sync triggered', data: { jobId: 'temp-id' } });
});

/**
 * @route   GET /api/sync/status/:jobId
 * @desc    Get sync job status
 * @access  Private
 */
router.get('/status/:jobId', (_req, res) => {
  res.json({ success: true, data: { status: 'pending' } });
});

/**
 * @route   GET /api/sync/history
 * @desc    Get sync history
 * @access  Private
 */
router.get('/history', (_req, res) => {
  res.json({ success: true, data: [] });
});

export default router;
