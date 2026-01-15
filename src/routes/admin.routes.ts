import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate } from '@/middleware/auth';
import { requireSuperAdmin } from '@/middleware/rbac';
import { AdminController } from '@/controllers/admin.controller';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate, adminValidators } from '@/middleware/validation';
import * as systemController from '@/controllers/system.controller';

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

// ============================================
// System Settings Routes
// ============================================

/**
 * @route   GET /api/admin/system-settings
 * @desc    Get all system settings
 * @access  Super Admin
 */
router.get('/system-settings', asyncHandler(systemController.getSystemSettings));

/**
 * @route   PUT /api/admin/system-settings
 * @desc    Update system settings
 * @access  Super Admin
 */
router.put(
  '/system-settings',
  validate([
    body('type').isIn(['general', 'email', 'security', 'integrations']).withMessage('Invalid settings type'),
    body('settings').isObject().withMessage('Settings must be an object'),
  ]),
  asyncHandler(systemController.updateSystemSettings)
);

/**
 * @route   POST /api/admin/system-settings/test-email
 * @desc    Test email configuration
 * @access  Super Admin
 */
router.post(
  '/system-settings/test-email',
  validate([
    body('provider').isIn(['smtp', 'sendgrid', 'ses', 'mailgun']).withMessage('Invalid email provider'),
  ]),
  asyncHandler(systemController.testEmailConfiguration)
);

// ============================================
// Subscription Plans Routes
// ============================================

/**
 * @route   GET /api/admin/subscription-plans
 * @desc    Get all subscription plans
 * @access  Super Admin
 */
router.get('/subscription-plans', asyncHandler(systemController.getSubscriptionPlans));

/**
 * @route   POST /api/admin/subscription-plans
 * @desc    Create a new subscription plan
 * @access  Super Admin
 */
router.post(
  '/subscription-plans',
  validate([
    body('name').trim().notEmpty().isLength({ max: 100 }).withMessage('Plan name is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('interval').isIn(['month', 'year']).withMessage('Interval must be month or year'),
  ]),
  asyncHandler(systemController.createSubscriptionPlan)
);

/**
 * @route   PUT /api/admin/subscription-plans/:planId
 * @desc    Update a subscription plan
 * @access  Super Admin
 */
router.put(
  '/subscription-plans/:planId',
  validate([
    param('planId').isUUID().withMessage('Invalid plan ID'),
  ]),
  asyncHandler(systemController.updateSubscriptionPlan)
);

/**
 * @route   DELETE /api/admin/subscription-plans/:planId
 * @desc    Delete a subscription plan
 * @access  Super Admin
 */
router.delete(
  '/subscription-plans/:planId',
  validate([
    param('planId').isUUID().withMessage('Invalid plan ID'),
  ]),
  asyncHandler(systemController.deleteSubscriptionPlan)
);

// ============================================
// Email Templates Routes
// ============================================

/**
 * @route   GET /api/admin/email-templates
 * @desc    Get all email templates
 * @access  Super Admin
 */
router.get('/email-templates', asyncHandler(systemController.getEmailTemplates));

/**
 * @route   POST /api/admin/email-templates
 * @desc    Create a new email template
 * @access  Super Admin
 */
router.post(
  '/email-templates',
  validate([
    body('name').trim().notEmpty().isLength({ max: 100 }).withMessage('Template name is required'),
    body('slug').trim().notEmpty().isLength({ max: 100 }).withMessage('Template slug is required'),
    body('subject').trim().notEmpty().isLength({ max: 200 }).withMessage('Subject is required'),
    body('htmlContent').trim().notEmpty().withMessage('HTML content is required'),
  ]),
  asyncHandler(systemController.createEmailTemplate)
);

/**
 * @route   PUT /api/admin/email-templates/:templateId
 * @desc    Update an email template
 * @access  Super Admin
 */
router.put(
  '/email-templates/:templateId',
  validate([
    param('templateId').isUUID().withMessage('Invalid template ID'),
  ]),
  asyncHandler(systemController.updateEmailTemplate)
);

/**
 * @route   DELETE /api/admin/email-templates/:templateId
 * @desc    Delete an email template
 * @access  Super Admin
 */
router.delete(
  '/email-templates/:templateId',
  validate([
    param('templateId').isUUID().withMessage('Invalid template ID'),
  ]),
  asyncHandler(systemController.deleteEmailTemplate)
);

export default router;
