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

// ============================================
// Facebook Configuration Routes (SUPER_ADMIN)
// ============================================

/**
 * @route   GET /api/admin/facebook/config
 * @desc    Get Facebook configuration and stats
 * @access  Super Admin
 */
router.get('/facebook/config', asyncHandler(systemController.getFacebookConfig));

/**
 * @route   PUT /api/admin/facebook/config
 * @desc    Update Facebook App ID and Secret
 * @access  Super Admin
 */
router.put(
  '/facebook/config',
  validate([
    body('appId').optional().trim().isLength({ min: 10, max: 20 }).withMessage('Invalid App ID format'),
    body('appSecret').optional().trim().isLength({ min: 20, max: 64 }).withMessage('Invalid App Secret format'),
  ]),
  asyncHandler(systemController.updateFacebookConfig)
);

/**
 * @route   POST /api/admin/facebook/config/test
 * @desc    Test Facebook configuration by getting app access token
 * @access  Super Admin
 */
router.post('/facebook/config/test', asyncHandler(systemController.testFacebookConfig));

/**
 * @route   GET /api/admin/facebook/profiles
 * @desc    Get all Facebook profiles across all accounts
 * @access  Super Admin
 */
router.get(
  '/facebook/profiles',
  validate([
    query('status').optional().isIn(['active', 'inactive', 'expiring']).withMessage('Invalid status filter'),
    query('search').optional().trim().isLength({ max: 100 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ]),
  asyncHandler(systemController.getAllFacebookProfiles)
);

/**
 * @route   POST /api/admin/facebook/profiles/:profileId/revoke
 * @desc    Revoke/deactivate a Facebook profile
 * @access  Super Admin
 */
router.post(
  '/facebook/profiles/:profileId/revoke',
  validate([
    param('profileId').isUUID().withMessage('Invalid profile ID'),
  ]),
  asyncHandler(systemController.revokeFacebookProfile)
);

// ============================================
// Extension Configuration Routes (SUPER_ADMIN)
// ============================================

/**
 * @route   GET /api/admin/extension/config
 * @desc    Get Chrome Extension configuration and stats
 * @access  Super Admin
 */
router.get('/extension/config', asyncHandler(systemController.getExtensionConfig));

/**
 * @route   PUT /api/admin/extension/config
 * @desc    Update Extension configuration (Extension ID, Facebook App credentials)
 * @access  Super Admin
 */
router.put(
  '/extension/config',
  validate([
    body('extensionId').optional({ values: 'falsy' }).trim().custom((value) => {
      // Allow empty string or valid Chrome extension ID (32 lowercase letters)
      if (!value || value === '') return true;
      if (!/^[a-z]{32}$/.test(value)) {
        throw new Error('Chrome Extension ID must be 32 lowercase letters');
      }
      return true;
    }),
    body('facebookAppId').optional({ values: 'falsy' }).trim().custom((value) => {
      if (!value || value === '') return true;
      if (!/^\d{10,20}$/.test(value)) {
        throw new Error('Facebook App ID must be 10-20 digits');
      }
      return true;
    }),
    body('facebookAppSecret').optional({ values: 'falsy' }).trim().isLength({ min: 20, max: 64 }).withMessage('Invalid App Secret format'),
  ]),
  asyncHandler(systemController.updateExtensionConfig)
);

/**
 * @route   POST /api/admin/extension/config/test
 * @desc    Test Extension configuration
 * @access  Super Admin
 */
router.post('/extension/config/test', asyncHandler(systemController.testExtensionConfig));

// ============================================
// Error Monitoring Routes - Nova Diagnostics (SUPER_ADMIN)
// ============================================

/**
 * @route   GET /api/admin/errors
 * @desc    Get all system errors for Nova diagnostics
 * @access  Super Admin
 */
router.get('/errors', asyncHandler(systemController.getSystemErrors));

/**
 * @route   GET /api/admin/errors/stats
 * @desc    Get error statistics and trends
 * @access  Super Admin
 */
router.get('/errors/stats', asyncHandler(systemController.getErrorStats));

/**
 * @route   GET /api/admin/errors/extension
 * @desc    Get extension-specific errors
 * @access  Super Admin
 */
router.get('/errors/extension', asyncHandler(systemController.getExtensionErrors));

/**
 * @route   POST /api/admin/errors/:errorId/resolve
 * @desc    Mark an error as resolved with diagnostic notes
 * @access  Super Admin
 */
router.post(
  '/errors/:errorId/resolve',
  validate([
    param('errorId').isString().withMessage('Invalid error ID'),
    body('resolution').optional().trim().isLength({ max: 1000 }),
    body('preventionPlan').optional().trim().isLength({ max: 1000 }),
  ]),
  asyncHandler(systemController.resolveError)
);

export default router;
