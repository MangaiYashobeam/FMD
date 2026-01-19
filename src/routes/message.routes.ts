import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate } from '@/middleware/auth';
import { MessageController } from '@/controllers/message.controller';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate } from '@/middleware/validation';

const router = Router();
const controller = new MessageController();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/messages/conversations
 * @desc    Get all conversations for the authenticated user
 * @access  Private
 */
router.get(
  '/conversations',
  validate([
    query('source').optional().isIn(['all', 'facebook', 'messenger', 'instagram']),
    query('unreadOnly').optional().isBoolean(),
  ]),
  asyncHandler(controller.getConversations.bind(controller))
);

/**
 * @route   GET /api/messages/conversations/:id
 * @desc    Get messages for a specific conversation
 * @access  Private
 */
router.get(
  '/conversations/:id',
  validate([
    param('id').isUUID().withMessage('Invalid conversation ID'),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('before').optional().isISO8601(),
  ]),
  asyncHandler(controller.getMessages.bind(controller))
);

/**
 * @route   POST /api/messages/conversations/:id
 * @desc    Send a message to a conversation
 * @access  Private
 */
router.post(
  '/conversations/:id',
  validate([
    param('id').isUUID().withMessage('Invalid conversation ID'),
    body('text').notEmpty().trim().isLength({ min: 1, max: 5000 }),
  ]),
  asyncHandler(controller.sendMessage.bind(controller))
);

/**
 * @route   POST /api/messages/conversations/:id/archive
 * @desc    Archive a conversation
 * @access  Private
 */
router.post(
  '/conversations/:id/archive',
  validate([
    param('id').isUUID().withMessage('Invalid conversation ID'),
  ]),
  asyncHandler(controller.archiveConversation.bind(controller))
);

/**
 * @route   POST /api/messages/conversations/:id/star
 * @desc    Star/unstar a conversation
 * @access  Private
 */
router.post(
  '/conversations/:id/star',
  validate([
    param('id').isUUID().withMessage('Invalid conversation ID'),
  ]),
  asyncHandler(controller.toggleStar.bind(controller))
);

/**
 * @route   POST /api/messages/sync
 * @desc    Sync messages from Facebook (called by Chrome extension)
 * @access  Private
 */
router.post(
  '/sync',
  validate([
    body('facebookUserId').optional().isString(),
    body('facebookUsername').optional().isString(),
    body('leadId').optional().isUUID(),
    body('messages').optional().isArray(),
    body('messages.*.text').optional().isString(),
    body('messages.*.sender').optional().isString(),
    body('messages.*.sentAt').optional().isISO8601(),
    body('messages.*.isOutgoing').optional().isBoolean(),
    body('messages.*.facebookMessageId').optional().isString(),
  ]),
  asyncHandler(controller.syncFromFacebook.bind(controller))
);

/**
 * @route   GET /api/messages/stats
 * @desc    Get messaging statistics
 * @access  Private
 */
router.get(
  '/stats',
  asyncHandler(controller.getStats.bind(controller))
);

export default router;
