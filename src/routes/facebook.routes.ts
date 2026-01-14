import { Router } from 'express';
import { authenticate } from '@/middleware/auth';

const router = Router();

router.use(authenticate);

/**
 * @route   GET /api/facebook/auth-url
 * @desc    Get Facebook OAuth URL
 * @access  Private
 */
router.get('/auth-url', (_req, res) => {
  res.json({ success: true, data: { url: '#' }, message: 'Facebook routes - coming soon' });
});

/**
 * @route   POST /api/facebook/callback
 * @desc    Handle Facebook OAuth callback
 * @access  Private
 */
router.post('/callback', (_req, res) => {
  res.json({ success: true, data: null });
});

/**
 * @route   GET /api/facebook/profiles
 * @desc    Get connected Facebook profiles
 * @access  Private
 */
router.get('/profiles', (_req, res) => {
  res.json({ success: true, data: [] });
});

/**
 * @route   POST /api/facebook/post
 * @desc    Create Facebook Marketplace post
 * @access  Private
 */
router.post('/post', (_req, res) => {
  res.json({ success: true, data: null });
});

export default router;
