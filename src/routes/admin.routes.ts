import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate } from '@/middleware/auth';
import { requireSuperAdmin } from '@/middleware/rbac';
import { AdminController } from '@/controllers/admin.controller';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate, adminValidators } from '@/middleware/validation';

const router = Router();
const controller = new AdminController();

// All routes require authentication and super admin role
router.use(authenticate);
router.use(requireSuperAdmin);

/**
 * @route   GET /api/admin/accounts
 * @desc    Get all accounts (system-wide)
 * @access  Super Admin
 */
router.get(
  '/accounts',
  validate(adminValidators.getAllAccounts),
  asyncHandler(controller.getAllAccounts.bind(controller))
);

/**
 * @route   POST /api/admin/accounts
 * @desc    Create new account
 * @access  Super Admin
 */
router.post(
  '/accounts',
  validate([
    body('name').trim().notEmpty().isLength({ max: 200 }).withMessage('Invalid name'),
    body('dealershipName').optional().trim().isLength({ max: 200 }),
    body('ownerEmail').isEmail().normalizeEmail(),
    body('ownerFirstName').trim().notEmpty().isLength({ max: 100 }),
    body('ownerLastName').trim().notEmpty().isLength({ max: 100 }),
  ]),
  asyncHandler(controller.createAccount.bind(controller))
);

/**
 * @route   PUT /api/admin/accounts/:accountId/status
 * @desc    Update account status (activate/deactivate)
 * @access  Super Admin
 */
router.put(
  '/accounts/:accountId/status',
  validate(adminValidators.updateAccountStatus),
  asyncHandler(controller.updateAccountStatus.bind(controller))
);

/**
 * @route   DELETE /api/admin/accounts/:accountId
 * @desc    Delete account (soft delete)
 * @access  Super Admin
 */
router.delete(
  '/accounts/:accountId',
  validate([param('accountId').isUUID().withMessage('Invalid account ID')]),
  asyncHandler(controller.deleteAccount.bind(controller))
);

/**
 * @route   GET /api/admin/users
 * @desc    Get all users (system-wide)
 * @access  Super Admin
 */
router.get(
  '/users',
  validate([
    query('search').optional().trim().isLength({ max: 200 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ]),
  asyncHandler(controller.getAllUsers.bind(controller))
);

/**
 * @route   PUT /api/admin/users/:userId/accounts/:accountId/role
 * @desc    Update user role in account
 * @access  Super Admin
 */
router.put(
  '/users/:userId/accounts/:accountId/role',
  validate([
    param('userId').isUUID().withMessage('Invalid user ID'),
    param('accountId').isUUID().withMessage('Invalid account ID'),
    body('role').isIn(['VIEWER', 'SALES_REP', 'ADMIN', 'ACCOUNT_OWNER', 'SUPER_ADMIN']).withMessage('Invalid role'),
  ]),
  asyncHandler(controller.updateUserRole.bind(controller))
);

/**
 * @route   GET /api/admin/stats
 * @desc    Get system-wide statistics
 * @access  Super Admin
 */
router.get('/stats', asyncHandler(controller.getSystemStats.bind(controller)));

/**
 * @route   GET /api/admin/payments
 * @desc    Get all payments (system-wide)
 * @access  Super Admin
 */
router.get(
  '/payments',
  validate(adminValidators.getAllPayments),
  asyncHandler(controller.getAllPayments.bind(controller))
);

/**
 * @route   GET /api/admin/revenue
 * @desc    Get revenue analytics
 * @access  Super Admin
 */
router.get(
  '/revenue',
  validate([
    query('period').optional().isIn(['7d', '30d', '90d', '365d']).withMessage('Invalid period'),
  ]),
  asyncHandler(controller.getRevenueAnalytics.bind(controller))
);

/**
 * @route   GET /api/admin/audit-logs
 * @desc    Get audit logs
 * @access  Super Admin
 */
router.get(
  '/audit-logs',
  validate([
    query('userId').optional().isUUID(),
    query('action').optional().isString().isLength({ max: 100 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ]),
  asyncHandler(controller.getAuditLogs.bind(controller))
);

export default router;
