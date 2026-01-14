import { Router } from 'express';
import { authenticate as authMiddleware } from '@/middleware/auth';
import { asyncHandler } from '@/utils/asyncHandler';
import { userCredentialsController } from '@/controllers/userCredentials.controller';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @route   GET /api/users/me/facebook-credentials
 * @desc    Get user's Facebook credentials (decrypted)
 * @access  Private
 */
router.get(
  '/facebook-credentials',
  asyncHandler(userCredentialsController.getCredentials.bind(userCredentialsController))
);

/**
 * @route   PUT /api/users/me/facebook-credentials
 * @desc    Update user's Facebook credentials
 * @access  Private
 */
router.put(
  '/facebook-credentials',
  asyncHandler(userCredentialsController.updateCredentials.bind(userCredentialsController))
);

/**
 * @route   DELETE /api/users/me/facebook-credentials
 * @desc    Delete user's Facebook credentials
 * @access  Private
 */
router.delete(
  '/facebook-credentials',
  asyncHandler(userCredentialsController.deleteCredentials.bind(userCredentialsController))
);

/**
 * @route   POST /api/users/me/facebook-credentials/use-code
 * @desc    Mark a 2FA code as used (removes it from the list)
 * @access  Private
 */
router.post(
  '/facebook-credentials/use-code',
  asyncHandler(userCredentialsController.use2FACode.bind(userCredentialsController))
);

/**
 * @route   GET /api/users/me/facebook-credentials/next-code
 * @desc    Get next available 2FA code without marking it as used
 * @access  Private
 */
router.get(
  '/facebook-credentials/next-code',
  asyncHandler(userCredentialsController.getNext2FACode.bind(userCredentialsController))
);

/**
 * @route   POST /api/users/me/facebook-credentials/add-codes
 * @desc    Add new 2FA backup codes
 * @access  Private
 */
router.post(
  '/facebook-credentials/add-codes',
  asyncHandler(userCredentialsController.add2FACodes.bind(userCredentialsController))
);

export default router;
