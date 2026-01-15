import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '@/middleware/auth';
import { FacebookController } from '@/controllers/facebook.controller';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate, facebookValidators } from '@/middleware/validation';

const router = Router();
const controller = new FacebookController();

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
 * @desc    Handle Facebook OAuth callback
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

export default router;
