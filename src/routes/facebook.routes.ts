import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { FacebookController } from '@/controllers/facebook.controller';
import { asyncHandler } from '@/utils/asyncHandler';

const router = Router();
const controller = new FacebookController();

router.use(authenticate);

/**
 * @route   GET /api/facebook/auth-url
 * @desc    Get Facebook OAuth URL
 * @access  Private
 */
router.get('/auth-url', asyncHandler(controller.getAuthUrl.bind(controller)));

/**
 * @route   POST /api/facebook/callback
 * @desc    Handle Facebook OAuth callback
 * @access  Private
 */
router.post('/callback', asyncHandler(controller.handleCallback.bind(controller)));

/**
 * @route   GET /api/facebook/profiles
 * @desc    Get connected Facebook profiles
 * @access  Private
 */
router.get('/profiles', asyncHandler(controller.getProfiles.bind(controller)));

/**
 * @route   POST /api/facebook/post
 * @desc    Create Facebook Marketplace post
 * @access  Private
 */
router.post('/post', asyncHandler(controller.createPost.bind(controller)));

/**
 * @route   DELETE /api/facebook/post/:id
 * @desc    Delete Facebook post
 * @access  Private
 */
router.delete('/post/:id', asyncHandler(controller.deletePost.bind(controller)));

export default router;
