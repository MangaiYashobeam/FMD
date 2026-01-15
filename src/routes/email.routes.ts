import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as emailController from '@/controllers/email.controller';
import { authenticate } from '@/middleware/auth';
import { requireSuperAdmin, requireRole, UserRole } from '@/middleware/rbac';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate } from '@/middleware/validation';
import emailTrackingRoutes from './email-tracking.routes';

const router = Router();

// ============================================
// Email Tracking Routes (Public - no auth)
// ============================================
router.use('/track', emailTrackingRoutes);

/**
 * Email Routes
 * System Domain: dealersface.com
 * Default Sender: fb-api@dealersface.com
 */

// All routes require authentication
router.use(authenticate);

// ============================================
// Email Configuration
// ============================================

/**
 * @route   GET /api/email/config
 * @desc    Get email system configuration
 * @access  Super Admin
 */
router.get('/config', requireSuperAdmin, asyncHandler(emailController.getEmailConfig));

/**
 * @route   PUT /api/email/config
 * @desc    Update email system configuration
 * @access  Super Admin
 */
router.put(
  '/config',
  requireSuperAdmin,
  validate([
    body('smtpHost').optional().isString(),
    body('smtpPort').optional().isInt({ min: 1, max: 65535 }),
    body('smtpUser').optional().isString(),
    body('smtpPassword').optional().isString(),
    body('fromEmail').optional().isEmail(),
    body('fromName').optional().isString(),
  ]),
  asyncHandler(emailController.updateEmailConfig)
);

// ============================================
// Email Composition (Super Admin)
// ============================================

/**
 * @route   POST /api/email/compose
 * @desc    Compose and send custom email
 * @access  Super Admin
 */
router.post(
  '/compose',
  requireSuperAdmin,
  validate([
    body('to').notEmpty().withMessage('Recipients are required'),
    body('subject').trim().notEmpty().isLength({ max: 500 }).withMessage('Subject is required'),
    body('body').trim().notEmpty().withMessage('Email body is required'),
    body('cc').optional().isArray(),
    body('bcc').optional().isArray(),
    body('templateSlug').optional().isString(),
    body('variables').optional().isObject(),
  ]),
  asyncHandler(emailController.composeEmail)
);

/**
 * @route   GET /api/email/recipients
 * @desc    Get available recipients (users, accounts)
 * @access  Super Admin
 */
router.get(
  '/recipients',
  requireSuperAdmin,
  validate([
    query('type').optional().isIn(['users', 'admins', 'accounts', 'all']),
    query('search').optional().isString(),
  ]),
  asyncHandler(emailController.getRecipients)
);

// ============================================
// Test & Bulk Email
// ============================================

/**
 * @route   POST /api/email/test
 * @desc    Send test email
 * @access  Admin+
 */
router.post(
  '/test',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validate([
    body('to').isEmail().withMessage('Valid email required'),
    body('subject').optional().isString(),
    body('body').optional().isString(),
  ]),
  asyncHandler(emailController.sendTestEmail)
);

/**
 * @route   POST /api/email/bulk
 * @desc    Send bulk emails (announcements, newsletters)
 * @access  Super Admin
 */
router.post(
  '/bulk',
  requireSuperAdmin,
  validate([
    body('recipients').isArray({ min: 1 }).withMessage('At least one recipient is required'),
    body('subject').trim().notEmpty().withMessage('Subject is required'),
    body('body').trim().notEmpty().withMessage('Content is required'),
  ]),
  asyncHandler(emailController.sendBulkEmail)
);

// ============================================
// Email Logs
// ============================================

/**
 * @route   GET /api/email/logs
 * @desc    Get email logs
 * @access  Admin+
 */
router.get(
  '/logs',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validate([
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['SENT', 'FAILED', 'PENDING', 'QUEUED']),
    query('search').optional().isString(),
  ]),
  asyncHandler(emailController.getEmailLogs)
);

/**
 * @route   GET /api/email/logs/:logId
 * @desc    Get single email log details
 * @access  Admin+
 */
router.get(
  '/logs/:logId',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validate([param('logId').isUUID()]),
  asyncHandler(emailController.getEmailLogDetails)
);

/**
 * @route   POST /api/email/resend/:logId
 * @desc    Resend a failed email
 * @access  Admin+
 */
router.post(
  '/resend/:logId',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validate([param('logId').isUUID()]),
  asyncHandler(emailController.resendEmail)
);

/**
 * @route   GET /api/email/stats
 * @desc    Get email statistics
 * @access  Admin+
 */
router.get(
  '/stats',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  asyncHandler(emailController.getEmailStats)
);

// ============================================
// Email Templates
// ============================================

/**
 * @route   GET /api/email/templates
 * @desc    Get all email templates
 * @access  Admin+
 */
router.get(
  '/templates',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  asyncHandler(emailController.getTemplates)
);

/**
 * @route   GET /api/email/templates/:templateId
 * @desc    Get single template
 * @access  Super Admin
 */
router.get(
  '/templates/:templateId',
  requireSuperAdmin,
  validate([param('templateId').isUUID()]),
  asyncHandler(emailController.getTemplate)
);

/**
 * @route   POST /api/email/templates
 * @desc    Create email template
 * @access  Super Admin
 */
router.post(
  '/templates',
  requireSuperAdmin,
  validate([
    body('name').trim().notEmpty().withMessage('Template name is required'),
    body('slug').trim().notEmpty().withMessage('Slug is required'),
    body('subject').trim().notEmpty().withMessage('Subject is required'),
    body('htmlContent').trim().notEmpty().withMessage('HTML content is required'),
    body('textContent').optional().isString(),
    body('variables').optional().isArray(),
    body('description').optional().isString(),
  ]),
  asyncHandler(emailController.createTemplate)
);

/**
 * @route   PUT /api/email/templates/:templateId
 * @desc    Update email template
 * @access  Super Admin
 */
router.put(
  '/templates/:templateId',
  requireSuperAdmin,
  validate([param('templateId').isUUID()]),
  asyncHandler(emailController.updateTemplate)
);

/**
 * @route   DELETE /api/email/templates/:templateId
 * @desc    Delete email template
 * @access  Super Admin
 */
router.delete(
  '/templates/:templateId',
  requireSuperAdmin,
  validate([param('templateId').isUUID()]),
  asyncHandler(emailController.deleteTemplate)
);

/**
 * @route   POST /api/email/templates/:templateId/preview
 * @desc    Preview template with variables
 * @access  Super Admin
 */
router.post(
  '/templates/:templateId/preview',
  requireSuperAdmin,
  validate([
    param('templateId').isUUID(),
    body('variables').optional().isObject(),
  ]),
  asyncHandler(emailController.previewTemplate)
);

/**
 * @route   POST /api/email/templates/seed-defaults
 * @desc    Seed default system templates
 * @access  Super Admin
 */
router.post(
  '/templates/seed-defaults',
  requireSuperAdmin,
  asyncHandler(emailController.seedDefaultTemplates)
);

// ============================================
// B2B System Email Triggers
// Internal endpoints for automated system emails
// ============================================

/**
 * @route   POST /api/email/trigger/welcome
 * @desc    Trigger welcome email for new user
 * @access  Admin+ (internal use)
 */
router.post(
  '/trigger/welcome',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validate([
    body('userId').isUUID().withMessage('Valid user ID is required'),
    body('tempPassword').optional().isString(),
  ]),
  asyncHandler(emailController.triggerWelcomeEmail)
);

/**
 * @route   POST /api/email/trigger/password-reset
 * @desc    Trigger password reset email
 * @access  Admin+ (internal use)
 */
router.post(
  '/trigger/password-reset',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validate([
    body('userId').isUUID().withMessage('Valid user ID is required'),
    body('resetToken').notEmpty().withMessage('Reset token is required'),
  ]),
  asyncHandler(emailController.triggerPasswordResetEmail)
);

/**
 * @route   POST /api/email/trigger/invitation
 * @desc    Trigger account invitation email
 * @access  Admin+ (internal use)
 */
router.post(
  '/trigger/invitation',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validate([
    body('inviteeEmail').isEmail().withMessage('Valid invitee email is required'),
    body('accountName').notEmpty().withMessage('Account name is required'),
    body('inviteToken').notEmpty().withMessage('Invite token is required'),
    body('inviterName').optional().isString(),
    body('role').optional().isString(),
  ]),
  asyncHandler(emailController.triggerInvitationEmail)
);

/**
 * @route   POST /api/email/trigger/new-lead
 * @desc    Trigger new lead notification email
 * @access  Admin+ (internal use)
 */
router.post(
  '/trigger/new-lead',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validate([
    body('recipientEmail').isEmail().withMessage('Valid recipient email is required'),
    body('customerName').notEmpty().withMessage('Customer name is required'),
    body('customerEmail').optional().isEmail(),
    body('customerPhone').optional().isString(),
    body('vehicleInfo').optional().isString(),
    body('source').optional().isString(),
    body('leadId').optional().isUUID(),
  ]),
  asyncHandler(emailController.triggerNewLeadEmail)
);

/**
 * @route   POST /api/email/trigger/sync-complete
 * @desc    Trigger sync completion email
 * @access  Admin+ (internal use)
 */
router.post(
  '/trigger/sync-complete',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validate([
    body('recipientEmail').isEmail().withMessage('Valid recipient email is required'),
    body('accountName').notEmpty().withMessage('Account name is required'),
    body('imported').optional().isInt({ min: 0 }),
    body('updated').optional().isInt({ min: 0 }),
    body('failed').optional().isInt({ min: 0 }),
  ]),
  asyncHandler(emailController.triggerSyncCompleteEmail)
);

/**
 * @route   POST /api/email/trigger/payment-receipt
 * @desc    Trigger payment receipt email
 * @access  Admin+ (internal use)
 */
router.post(
  '/trigger/payment-receipt',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validate([
    body('recipientEmail').isEmail().withMessage('Valid recipient email is required'),
    body('accountName').notEmpty().withMessage('Account name is required'),
    body('amount').notEmpty().withMessage('Amount is required'),
    body('invoiceId').optional().isString(),
    body('paymentDate').optional().isString(),
  ]),
  asyncHandler(emailController.triggerPaymentReceiptEmail)
);

/**
 * @route   POST /api/email/trigger/payment-failed
 * @desc    Trigger payment failed email
 * @access  Admin+ (internal use)
 */
router.post(
  '/trigger/payment-failed',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validate([
    body('recipientEmail').isEmail().withMessage('Valid recipient email is required'),
    body('amount').notEmpty().withMessage('Amount is required'),
    body('reason').optional().isString(),
  ]),
  asyncHandler(emailController.triggerPaymentFailedEmail)
);

/**
 * @route   POST /api/email/trigger/account-suspended
 * @desc    Trigger account suspended email
 * @access  Super Admin
 */
router.post(
  '/trigger/account-suspended',
  requireSuperAdmin,
  validate([
    body('recipientEmail').isEmail().withMessage('Valid recipient email is required'),
    body('accountName').notEmpty().withMessage('Account name is required'),
    body('reason').optional().isString(),
  ]),
  asyncHandler(emailController.triggerAccountSuspendedEmail)
);

/**
 * @route   POST /api/email/trigger/announcement
 * @desc    Trigger system announcement email (bulk)
 * @access  Super Admin
 */
router.post(
  '/trigger/announcement',
  requireSuperAdmin,
  validate([
    body('recipientEmails').isArray({ min: 1 }).withMessage('At least one recipient is required'),
    body('announcementTitle').trim().notEmpty().withMessage('Announcement title is required'),
    body('announcementContent').trim().notEmpty().withMessage('Announcement content is required'),
    body('ctaText').optional().isString(),
    body('ctaUrl').optional().isURL(),
  ]),
  asyncHandler(emailController.triggerAnnouncementEmail)
);

// ============================================
// Mail Engine Management (Super Admin)
// ============================================

/**
 * @route   GET /api/email/engine/status
 * @desc    Get mail engine status
 * @access  Super Admin
 */
router.get(
  '/engine/status',
  requireSuperAdmin,
  asyncHandler(emailController.getMailEngineStatus)
);

/**
 * @route   GET /api/email/engine/queue
 * @desc    Get queue statistics
 * @access  Super Admin
 */
router.get(
  '/engine/queue',
  requireSuperAdmin,
  asyncHandler(emailController.getQueueStats)
);

/**
 * @route   POST /api/email/engine/queue/start
 * @desc    Start queue processor
 * @access  Super Admin
 */
router.post(
  '/engine/queue/start',
  requireSuperAdmin,
  asyncHandler(emailController.startQueue)
);

/**
 * @route   POST /api/email/engine/queue/stop
 * @desc    Stop queue processor
 * @access  Super Admin
 */
router.post(
  '/engine/queue/stop',
  requireSuperAdmin,
  asyncHandler(emailController.stopQueue)
);

/**
 * @route   POST /api/email/engine/queue/retry/:queueId
 * @desc    Retry a failed queued email
 * @access  Super Admin
 */
router.post(
  '/engine/queue/retry/:queueId',
  requireSuperAdmin,
  validate([param('queueId').isUUID()]),
  asyncHandler(emailController.retryQueuedEmail)
);

/**
 * @route   DELETE /api/email/engine/queue/:queueId
 * @desc    Cancel a queued email
 * @access  Super Admin
 */
router.delete(
  '/engine/queue/:queueId',
  requireSuperAdmin,
  validate([param('queueId').isUUID()]),
  asyncHandler(emailController.cancelQueuedEmail)
);

// ============================================
// Domain Management
// ============================================

/**
 * @route   GET /api/email/domains
 * @desc    Get all configured email domains
 * @access  Super Admin
 */
router.get(
  '/domains',
  requireSuperAdmin,
  asyncHandler(emailController.getDomains)
);

/**
 * @route   POST /api/email/domains
 * @desc    Add a new email domain
 * @access  Super Admin
 */
router.post(
  '/domains',
  requireSuperAdmin,
  validate([
    body('domain').trim().notEmpty().withMessage('Domain is required'),
    body('hourlyLimit').optional().isInt({ min: 1 }),
    body('dailyLimit').optional().isInt({ min: 1 }),
  ]),
  asyncHandler(emailController.addDomain)
);

/**
 * @route   GET /api/email/domains/:domain/dns
 * @desc    Get DNS records for domain setup
 * @access  Super Admin
 */
router.get(
  '/domains/:domain/dns',
  requireSuperAdmin,
  asyncHandler(emailController.getDomainDnsRecords)
);

/**
 * @route   POST /api/email/domains/:domain/verify
 * @desc    Verify domain DNS configuration
 * @access  Super Admin
 */
router.post(
  '/domains/:domain/verify',
  requireSuperAdmin,
  asyncHandler(emailController.verifyDomain)
);

// ============================================
// Suppression List Management
// ============================================

/**
 * @route   GET /api/email/suppressions
 * @desc    Get suppression list
 * @access  Super Admin
 */
router.get(
  '/suppressions',
  requireSuperAdmin,
  validate([
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('reason').optional().isString(),
  ]),
  asyncHandler(emailController.getSuppressions)
);

/**
 * @route   POST /api/email/suppressions
 * @desc    Add email to suppression list
 * @access  Super Admin
 */
router.post(
  '/suppressions',
  requireSuperAdmin,
  validate([
    body('email').isEmail().withMessage('Valid email required'),
    body('reason').trim().notEmpty().withMessage('Reason is required'),
    body('details').optional().isString(),
  ]),
  asyncHandler(emailController.addSuppression)
);

/**
 * @route   DELETE /api/email/suppressions/:email
 * @desc    Remove email from suppression list
 * @access  Super Admin
 */
router.delete(
  '/suppressions/:email',
  requireSuperAdmin,
  asyncHandler(emailController.removeSuppression)
);

// ============================================
// Analytics
// ============================================

/**
 * @route   GET /api/email/analytics
 * @desc    Get comprehensive email analytics
 * @access  Super Admin
 */
router.get(
  '/analytics',
  requireSuperAdmin,
  validate([
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('period').optional().isIn(['HOUR', 'DAY', 'WEEK', 'MONTH']),
    query('accountId').optional().isUUID(),
  ]),
  asyncHandler(emailController.getAnalytics)
);

/**
 * @route   GET /api/email/analytics/export
 * @desc    Export email analytics to CSV
 * @access  Super Admin
 */
router.get(
  '/analytics/export',
  requireSuperAdmin,
  validate([
    query('startDate').isISO8601().withMessage('Start date is required'),
    query('endDate').isISO8601().withMessage('End date is required'),
  ]),
  asyncHandler(emailController.exportAnalytics)
);

/**
 * @route   GET /api/email/report/:messageId
 * @desc    Get detailed report for a specific email
 * @access  Super Admin
 */
router.get(
  '/report/:messageId',
  requireSuperAdmin,
  asyncHandler(emailController.getMessageReport)
);

export default router;
