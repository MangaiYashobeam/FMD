import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate } from '@/middleware/auth';
import { FacebookController } from '@/controllers/facebook.controller';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate, facebookValidators } from '@/middleware/validation';

const router = Router();
const controller = new FacebookController();

/**
 * @route   GET /api/facebook/callback
 * @desc    Handle Facebook OAuth callback (browser redirect)
 * @access  Public (uses state token for auth)
 */
router.get(
  '/callback',
  asyncHandler(controller.handleOAuthCallback.bind(controller))
);

// All routes below require authentication
router.use(authenticate);

/**
 * @route   GET /api/facebook/auth-url
 * @desc    Get Facebook OAuth URL
 * @access  Private
 */
router.get(
  '/auth-url',
  validate(facebookValidators.getAuthUrl),
  asyncHandler(controller.getAuthUrl.bind(controller))
);

/**
 * @route   POST /api/facebook/callback
 * @desc    Handle Facebook OAuth callback (POST)
 * @access  Private
 */
router.post(
  '/callback',
  validate(facebookValidators.callback),
  asyncHandler(controller.handleCallback.bind(controller))
);

/**
 * @route   GET /api/facebook/profiles
 * @desc    Get connected Facebook profiles
 * @access  Private
 */
router.get(
  '/profiles',
  validate(facebookValidators.getProfiles),
  asyncHandler(controller.getProfiles.bind(controller))
);

/**
 * @route   GET /api/facebook/connections
 * @desc    Get Facebook connections for current user's account
 * @access  Private
 */
router.get(
  '/connections',
  asyncHandler(controller.getConnections.bind(controller))
);

/**
 * @route   DELETE /api/facebook/connections/:id
 * @desc    Disconnect a Facebook profile
 * @access  Private
 */
router.delete(
  '/connections/:id',
  validate([param('id').isUUID().withMessage('Invalid connection ID')]),
  asyncHandler(controller.disconnect.bind(controller))
);

/**
 * @route   GET /api/facebook/groups
 * @desc    Get Facebook groups for posting
 * @access  Private
 */
router.get(
  '/groups',
  asyncHandler(controller.getGroups.bind(controller))
);

/**
 * @route   POST /api/facebook/groups
 * @desc    Add a Facebook group for posting
 * @access  Private
 */
router.post(
  '/groups',
  validate([
    body('groupId').notEmpty().withMessage('Group ID is required'),
    body('groupName').optional().isString().isLength({ max: 255 }),
  ]),
  asyncHandler(controller.addGroup.bind(controller))
);

/**
 * @route   DELETE /api/facebook/groups/:id
 * @desc    Remove a Facebook group
 * @access  Private
 */
router.delete(
  '/groups/:id',
  validate([param('id').isUUID().withMessage('Invalid group ID')]),
  asyncHandler(controller.removeGroup.bind(controller))
);

/**
 * @route   PUT /api/facebook/groups/:id/toggle-auto-post
 * @desc    Toggle auto-post for a group
 * @access  Private
 */
router.put(
  '/groups/:id/toggle-auto-post',
  validate([param('id').isUUID().withMessage('Invalid group ID')]),
  asyncHandler(controller.toggleGroupAutoPost.bind(controller))
);

/**
 * @route   POST /api/facebook/post
 * @desc    Create Facebook Marketplace post
 * @access  Private
 */
router.post(
  '/post',
  validate(facebookValidators.createPost),
  asyncHandler(controller.createPost.bind(controller))
);

/**
 * @route   DELETE /api/facebook/post/:id
 * @desc    Delete Facebook post
 * @access  Private
 */
router.delete(
  '/post/:id',
  validate([param('id').isUUID().withMessage('Invalid post ID')]),
  asyncHandler(controller.deletePost.bind(controller))
);

/**
 * @route   GET /api/facebook/posts
 * @desc    Get post history
 * @access  Private
 */
router.get(
  '/posts',
  validate([
    query('vehicleId').optional().isUUID().withMessage('Invalid vehicle ID'),
  ]),
  asyncHandler(controller.getPostHistory.bind(controller))
);

/**
 * @route   POST /api/facebook/marketplace/confirm
 * @desc    Confirm marketplace post from Chrome extension
 * @access  Private
 */
router.post(
  '/marketplace/confirm',
  validate([
    body('postId').isUUID().withMessage('Invalid post ID'),
    body('facebookPostId').optional().isString().isLength({ max: 100 }),
    body('status').isIn(['success', 'failed']).withMessage('Invalid status'),
    body('errorMessage').optional().isString().isLength({ max: 500 }),
  ]),
  asyncHandler(controller.confirmMarketplacePost.bind(controller))
);

/**
 * @route   POST /api/facebook/session/import
 * @desc    Import Facebook session cookies for worker automation
 * @access  Private (Super Admin only)
 */
router.post(
  '/session/import',
  validate([
    body('accountId').notEmpty().withMessage('Account ID is required'),
    body('cookies').isArray({ min: 1 }).withMessage('Cookies array is required'),
    body('cookies.*.name').isString().withMessage('Cookie name is required'),
    body('cookies.*.value').isString().withMessage('Cookie value is required'),
  ]),
  asyncHandler(controller.importSession.bind(controller))
);

/**
 * @route   GET /api/facebook/session/status/:accountId
 * @desc    Check if a Facebook session exists for automation
 * @access  Private
 */
router.get(
  '/session/status/:accountId',
  validate([param('accountId').isUUID().withMessage('Invalid account ID')]),
  asyncHandler(controller.getSessionStatus.bind(controller))
);

export default router;
