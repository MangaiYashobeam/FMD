import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate } from '@/middleware/auth';
import { ApiKeyController } from '@/controllers/apiKey.controller';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate } from '@/middleware/validation';

const router = Router();
const controller = new ApiKeyController();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/users/me/api-keys
 * @desc    List API keys for current user
 * @access  Private
 */
router.get(
  '/',
  validate([
    query('accountId').isUUID().withMessage('Account ID is required'),
  ]),
  asyncHandler(controller.listKeys.bind(controller))
);

/**
 * @route   POST /api/users/me/api-keys
 * @desc    Create new API key
 * @access  Private (Owner/Admin)
 */
router.post(
  '/',
  validate([
    body('accountId').isUUID().withMessage('Account ID is required'),
    body('name').optional().trim().isLength({ max: 100 }).withMessage('Name too long'),
    body('permissions').optional().isArray().withMessage('Permissions must be an array'),
    body('expiresAt').optional().isISO8601().withMessage('Invalid expiration date'),
  ]),
  asyncHandler(controller.createKey.bind(controller))
);

/**
 * @route   GET /api/users/me/api-keys/permissions
 * @desc    Get available API key permissions
 * @access  Private
 */
router.get(
  '/permissions',
  asyncHandler(controller.getPermissions.bind(controller))
);

/**
 * @route   PUT /api/users/me/api-keys/:id
 * @desc    Update API key
 * @access  Private (Owner/Admin)
 */
router.put(
  '/:id',
  validate([
    param('id').isUUID().withMessage('Invalid key ID'),
    body('name').optional().trim().isLength({ max: 100 }),
    body('permissions').optional().isArray(),
    body('isActive').optional().isBoolean(),
  ]),
  asyncHandler(controller.updateKey.bind(controller))
);

/**
 * @route   DELETE /api/users/me/api-keys/:id
 * @desc    Revoke API key
 * @access  Private (Owner/Admin or key owner)
 */
router.delete(
  '/:id',
  validate([
    param('id').isUUID().withMessage('Invalid key ID'),
  ]),
  asyncHandler(controller.revokeKey.bind(controller))
);

export default router;
