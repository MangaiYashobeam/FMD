import { Router } from 'express';
import { query } from 'express-validator';
import { authenticate } from '@/middleware/auth';
import { AnalyticsController } from '@/controllers/analytics.controller';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate } from '@/middleware/validation';

const router = Router();
const controller = new AnalyticsController();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/analytics/overview
 * @desc    Get analytics overview with key metrics
 * @access  Private
 */
router.get(
  '/overview',
  validate([
    query('period').optional().isIn(['day', 'week', 'month']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ]),
  asyncHandler(controller.getOverview.bind(controller))
);

/**
 * @route   GET /api/analytics
 * @desc    Alias for /overview - for backward compatibility
 * @access  Private
 */
router.get(
  '/',
  validate([
    query('period').optional().isIn(['day', 'week', 'month']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ]),
  asyncHandler(controller.getOverview.bind(controller))
);

/**
 * @route   GET /api/analytics/leads-trend
 * @desc    Get leads trend over time
 * @access  Private
 */
router.get(
  '/leads-trend',
  validate([
    query('days').optional().isInt({ min: 1, max: 365 }),
  ]),
  asyncHandler(controller.getLeadsTrend.bind(controller))
);

/**
 * @route   GET /api/analytics/lead-sources
 * @desc    Get breakdown of lead sources
 * @access  Private
 */
router.get(
  '/lead-sources',
  asyncHandler(controller.getLeadSources.bind(controller))
);

/**
 * @route   GET /api/analytics/top-vehicles
 * @desc    Get top performing vehicles
 * @access  Private
 */
router.get(
  '/top-vehicles',
  validate([
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ]),
  asyncHandler(controller.getTopVehicles.bind(controller))
);

/**
 * @route   GET /api/analytics/activity
 * @desc    Get recent activity feed
 * @access  Private
 */
router.get(
  '/activity',
  validate([
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ]),
  asyncHandler(controller.getActivity.bind(controller))
);

/**
 * @route   GET /api/analytics/metrics
 * @desc    Get key metrics with month-over-month comparison
 * @access  Private
 */
router.get(
  '/metrics',
  asyncHandler(controller.getMetrics.bind(controller))
);

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get full analytics dashboard data in one call
 * @access  Private
 */
router.get(
  '/dashboard',
  validate([
    query('period').optional().isIn(['7d', '30d', '90d', 'year']),
  ]),
  asyncHandler(controller.getDashboard.bind(controller))
);

export default router;
