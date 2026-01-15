/**
 * Lead & ADF Routes
 * All routes for lead management and ADF operations
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate } from '@/middleware/auth';
import { leadController, adfConfigController } from '@/controllers/lead.controller';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate } from '@/middleware/validation';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// ===========================================
// Lead Routes
// ===========================================

/**
 * @route   GET /api/leads
 * @desc    Get all leads for account
 * @access  Private
 */
router.get(
  '/',
  validate([
    query('accountId').isUUID().withMessage('Invalid account ID'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['NEW', 'ASSIGNED', 'CONTACTED', 'QUALIFIED', 'APPOINTMENT', 'NEGOTIATING', 'WON', 'LOST', 'ARCHIVED']),
    query('source').optional().isIn(['FACEBOOK_MARKETPLACE', 'FACEBOOK_PAGE', 'WEBSITE', 'WALK_IN', 'PHONE', 'EMAIL', 'REFERRAL', 'THIRD_PARTY', 'ADF_IMPORT', 'MANUAL']),
    query('assignedTo').optional().isUUID(),
    query('search').optional().isString(),
    query('sortBy').optional().isIn(['createdAt', 'updatedAt', 'firstName', 'lastName', 'status', 'priority']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
  ]),
  asyncHandler(leadController.getLeads.bind(leadController))
);

/**
 * @route   GET /api/leads/stats
 * @desc    Get lead statistics for account
 * @access  Private
 */
router.get(
  '/stats',
  validate([
    query('accountId').isUUID().withMessage('Invalid account ID'),
  ]),
  asyncHandler(leadController.getStats.bind(leadController))
);

/**
 * @route   GET /api/leads/:id
 * @desc    Get single lead by ID
 * @access  Private
 */
router.get(
  '/:id',
  validate([
    param('id').isUUID().withMessage('Invalid lead ID'),
  ]),
  asyncHandler(leadController.getLead.bind(leadController))
);

/**
 * @route   POST /api/leads
 * @desc    Create new lead
 * @access  Private
 */
router.post(
  '/',
  validate([
    body('accountId').isUUID().withMessage('Invalid account ID'),
    body('firstName').optional().isString().trim().isLength({ max: 100 }),
    body('lastName').optional().isString().trim().isLength({ max: 100 }),
    body('fullName').optional().isString().trim().isLength({ max: 200 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().isString().trim().isLength({ max: 20 }),
    body('source').optional().isIn(['FACEBOOK_MARKETPLACE', 'FACEBOOK_PAGE', 'WEBSITE', 'WALK_IN', 'PHONE', 'EMAIL', 'REFERRAL', 'THIRD_PARTY', 'ADF_IMPORT', 'MANUAL']),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    body('vehicleId').optional().isUUID(),
    body('interestedVehicle').optional().isString().trim(),
    body('interestedYear').optional().isInt({ min: 1900, max: 2030 }),
    body('interestedMake').optional().isString().trim(),
    body('interestedModel').optional().isString().trim(),
    body('hasTradeIn').optional().isBoolean(),
    body('tradeYear').optional().isInt({ min: 1900, max: 2030 }),
    body('tradeMake').optional().isString().trim(),
    body('tradeModel').optional().isString().trim(),
    body('customerComments').optional().isString().trim(),
    body('facebookUserId').optional().isString(),
    body('facebookUsername').optional().isString(),
    body('facebookDisplayName').optional().isString(),
  ]),
  asyncHandler(leadController.createLead.bind(leadController))
);

/**
 * @route   PATCH /api/leads/:id
 * @desc    Update lead
 * @access  Private
 */
router.patch(
  '/:id',
  validate([
    param('id').isUUID().withMessage('Invalid lead ID'),
    body('status').optional().isIn(['NEW', 'ASSIGNED', 'CONTACTED', 'QUALIFIED', 'APPOINTMENT', 'NEGOTIATING', 'WON', 'LOST', 'ARCHIVED']),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    body('assignedToId').optional().isUUID(),
    body('firstName').optional().isString().trim().isLength({ max: 100 }),
    body('lastName').optional().isString().trim().isLength({ max: 100 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().isString().trim().isLength({ max: 20 }),
    body('nextFollowUpAt').optional().isISO8601(),
    body('appointmentAt').optional().isISO8601(),
    body('closedReason').optional().isString().trim(),
  ]),
  asyncHandler(leadController.updateLead.bind(leadController))
);

/**
 * @route   DELETE /api/leads/:id
 * @desc    Delete lead
 * @access  Private (Admin only)
 */
router.delete(
  '/:id',
  validate([
    param('id').isUUID().withMessage('Invalid lead ID'),
  ]),
  asyncHandler(leadController.deleteLead.bind(leadController))
);

/**
 * @route   POST /api/leads/:id/adf
 * @desc    Send ADF for lead
 * @access  Private
 */
router.post(
  '/:id/adf',
  validate([
    param('id').isUUID().withMessage('Invalid lead ID'),
    body('method').isIn(['EMAIL', 'DMS']).withMessage('Invalid method'),
    body('recipients').optional().isArray(),
    body('recipients.*').optional().isEmail(),
    body('endpoint').optional().isURL(),
  ]),
  asyncHandler(leadController.sendADF.bind(leadController))
);

/**
 * @route   GET /api/leads/:id/adf/preview
 * @desc    Get ADF XML preview for lead
 * @access  Private
 */
router.get(
  '/:id/adf/preview',
  validate([
    param('id').isUUID().withMessage('Invalid lead ID'),
  ]),
  asyncHandler(leadController.getADFPreview.bind(leadController))
);

/**
 * @route   POST /api/leads/:id/communications
 * @desc    Add communication to lead
 * @access  Private
 */
router.post(
  '/:id/communications',
  validate([
    param('id').isUUID().withMessage('Invalid lead ID'),
    body('type').isIn(['EMAIL', 'SMS', 'PHONE', 'FACEBOOK_MESSAGE', 'AI_RESPONSE']).withMessage('Invalid type'),
    body('direction').isIn(['INBOUND', 'OUTBOUND']).withMessage('Invalid direction'),
    body('content').isString().trim().notEmpty().withMessage('Content is required'),
    body('subject').optional().isString().trim(),
    body('contentHtml').optional().isString(),
    body('recipientEmail').optional().isEmail(),
    body('recipientPhone').optional().isString(),
  ]),
  asyncHandler(leadController.addCommunication.bind(leadController))
);

/**
 * @route   POST /api/leads/:id/notes
 * @desc    Add note to lead
 * @access  Private
 */
router.post(
  '/:id/notes',
  validate([
    param('id').isUUID().withMessage('Invalid lead ID'),
    body('note').isString().trim().notEmpty().withMessage('Note is required'),
  ]),
  asyncHandler(leadController.addNote.bind(leadController))
);

// ===========================================
// ADF Configuration Routes
// ===========================================

/**
 * @route   GET /api/leads/config/adf
 * @desc    Get ADF configuration for account
 * @access  Private (Admin only)
 */
router.get(
  '/config/adf',
  validate([
    query('accountId').isUUID().withMessage('Invalid account ID'),
  ]),
  asyncHandler(adfConfigController.getConfiguration.bind(adfConfigController))
);

/**
 * @route   PUT /api/leads/config/adf
 * @desc    Update ADF configuration
 * @access  Private (Admin only)
 */
router.put(
  '/config/adf',
  validate([
    body('accountId').isUUID().withMessage('Invalid account ID'),
    body('dmsProvider').optional().isString().trim(),
    body('dmsEndpoint').optional().isURL(),
    body('dmsUsername').optional().isString().trim(),
    body('dmsPassword').optional().isString(),
    body('dmsApiKey').optional().isString(),
    body('adfEmailEnabled').optional().isBoolean(),
    body('adfEmailRecipients').optional().isArray(),
    body('adfEmailRecipients.*').optional().isEmail(),
    body('adfEmailSender').optional().isEmail(),
    body('adfEmailSubjectPrefix').optional().isString().trim(),
    body('autoAssignEnabled').optional().isBoolean(),
    body('roundRobinEnabled').optional().isBoolean(),
    body('defaultAssigneeId').optional().isUUID(),
    body('aiAssistantEnabled').optional().isBoolean(),
    body('aiAutoResponse').optional().isBoolean(),
    body('aiDelayMinutes').optional().isInt({ min: 0, max: 60 }),
    body('duplicateCheckEnabled').optional().isBoolean(),
    body('duplicateWindowHours').optional().isInt({ min: 1, max: 168 }),
  ]),
  asyncHandler(adfConfigController.updateConfiguration.bind(adfConfigController))
);

/**
 * @route   POST /api/leads/config/adf/test-dms
 * @desc    Test DMS connection
 * @access  Private (Admin only)
 */
router.post(
  '/config/adf/test-dms',
  validate([
    body('accountId').isUUID().withMessage('Invalid account ID'),
    body('endpoint').isURL().withMessage('Valid endpoint URL required'),
    body('username').optional().isString(),
    body('password').optional().isString(),
    body('apiKey').optional().isString(),
  ]),
  asyncHandler(adfConfigController.testDMSConnection.bind(adfConfigController))
);

/**
 * @route   POST /api/leads/config/adf/mappings
 * @desc    Add/Update sales rep mapping
 * @access  Private (Admin only)
 */
router.post(
  '/config/adf/mappings',
  validate([
    body('accountId').isUUID().withMessage('Invalid account ID'),
    body('userId').isUUID().withMessage('Invalid user ID'),
    body('facebookUsername').optional().isString().trim(),
    body('facebookUserId').optional().isString().trim(),
    body('facebookDisplayName').optional().isString().trim(),
    body('dmsRepId').optional().isString().trim(),
    body('dmsRepName').optional().isString().trim(),
    body('dmsRepEmail').optional().isEmail(),
    body('isActive').optional().isBoolean(),
    body('maxLeadsPerDay').optional().isInt({ min: 1, max: 100 }),
  ]),
  asyncHandler(adfConfigController.upsertSalesRepMapping.bind(adfConfigController))
);

/**
 * @route   DELETE /api/leads/config/adf/mappings/:id
 * @desc    Delete sales rep mapping
 * @access  Private (Admin only)
 */
router.delete(
  '/config/adf/mappings/:id',
  validate([
    param('id').isUUID().withMessage('Invalid mapping ID'),
  ]),
  asyncHandler(adfConfigController.deleteSalesRepMapping.bind(adfConfigController))
);

export default router;
