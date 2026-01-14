import { Router } from 'express';
import { authenticate } from '@/middleware/auth';

const router = Router();

// All vehicle routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/vehicles
 * @desc    Get all vehicles for account
 * @access  Private
 */
router.get('/', (_req, res) => {
  // TODO: Implement
  res.json({ success: true, data: [], message: 'Vehicle routes - coming soon' });
});

/**
 * @route   GET /api/vehicles/:id
 * @desc    Get single vehicle
 * @access  Private
 */
router.get('/:id', (_req, res) => {
  res.json({ success: true, data: null });
});

/**
 * @route   POST /api/vehicles
 * @desc    Create vehicle
 * @access  Private
 */
router.post('/', (_req, res) => {
  res.json({ success: true, data: null });
});

/**
 * @route   PUT /api/vehicles/:id
 * @desc    Update vehicle
 * @access  Private
 */
router.put('/:id', (_req, res) => {
  res.json({ success: true, data: null });
});

/**
 * @route   DELETE /api/vehicles/:id
 * @desc    Delete vehicle
 * @access  Private
 */
router.delete('/:id', (_req, res) => {
  res.json({ success: true, message: 'Deleted' });
});

export default router;
