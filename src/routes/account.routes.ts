import { Router } from 'express';
import { authenticate } from '@/middleware/auth';

const router = Router();

router.use(authenticate);

/**
 * @route   GET /api/accounts
 * @desc    Get user's accounts
 * @access  Private
 */
router.get('/', (_req, res) => {
  res.json({ success: true, data: [], message: 'Account routes - coming soon' });
});

/**
 * @route   GET /api/accounts/:id
 * @desc    Get account details
 * @access  Private
 */
router.get('/:id', (_req, res) => {
  res.json({ success: true, data: null });
});

/**
 * @route   PUT /api/accounts/:id/settings
 * @desc    Update account settings
 * @access  Private
 */
router.put('/:id/settings', (_req, res) => {
  res.json({ success: true, data: null });
});

export default router;
