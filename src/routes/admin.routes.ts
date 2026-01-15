import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { requireSuperAdmin } from '@/middleware/rbac';
import { AdminController } from '@/controllers/admin.controller';
import { asyncHandler } from '@/utils/asyncHandler';

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
router.get('/accounts', asyncHandler(controller.getAllAccounts.bind(controller)));

/**
 * @route   POST /api/admin/accounts
 * @desc    Create new account
 * @access  Super Admin
 */
router.post('/accounts', asyncHandler(controller.createAccount.bind(controller)));

/**
 * @route   PUT /api/admin/accounts/:accountId/status
 * @desc    Update account status (activate/deactivate)
 * @access  Super Admin
 */
router.put('/accounts/:accountId/status', asyncHandler(controller.updateAccountStatus.bind(controller)));

/**
 * @route   DELETE /api/admin/accounts/:accountId
 * @desc    Delete account (soft delete)
 * @access  Super Admin
 */
router.delete('/accounts/:accountId', asyncHandler(controller.deleteAccount.bind(controller)));

/**
 * @route   GET /api/admin/users
 * @desc    Get all users (system-wide)
 * @access  Super Admin
 */
router.get('/users', asyncHandler(controller.getAllUsers.bind(controller)));

/**
 * @route   PUT /api/admin/users/:userId/accounts/:accountId/role
 * @desc    Update user role in account
 * @access  Super Admin
 */
router.put('/users/:userId/accounts/:accountId/role', asyncHandler(controller.updateUserRole.bind(controller)));

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
router.get('/payments', asyncHandler(controller.getAllPayments.bind(controller)));

/**
 * @route   GET /api/admin/revenue
 * @desc    Get revenue analytics
 * @access  Super Admin
 */
router.get('/revenue', asyncHandler(controller.getRevenueAnalytics.bind(controller)));

/**
 * @route   GET /api/admin/audit-logs
 * @desc    Get audit logs
 * @access  Super Admin
 */
router.get('/audit-logs', asyncHandler(controller.getAuditLogs.bind(controller)));

export default router;
