import { Router } from 'express';
import { param } from 'express-validator';
import { authenticate } from '@/middleware/auth';
import { AccountController } from '@/controllers/account.controller';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate, accountValidators } from '@/middleware/validation';

const router = Router();
const controller = new AccountController();

router.use(authenticate);

/**
 * @route   GET /api/accounts
 * @desc    Get user's accounts
 * @access  Private
 */
router.get('/', asyncHandler(controller.getAccounts.bind(controller)));

/**
 * @route   GET /api/accounts/:id
 * @desc    Get account details
 * @access  Private
 */
router.get(
  '/:id',
  validate(accountValidators.getById),
  asyncHandler(controller.getAccount.bind(controller))
);

/**
 * @route   PUT /api/accounts/:id/settings
 * @desc    Update account settings
 * @access  Private
 */
router.put(
  '/:id/settings',
  validate(accountValidators.updateSettings),
  asyncHandler(controller.updateSettings.bind(controller))
);

/**
 * @route   POST /api/accounts/:id/invite
 * @desc    Invite user to account
 * @access  Private
 */
router.post(
  '/:id/invite',
  validate(accountValidators.inviteUser),
  asyncHandler(controller.inviteUser.bind(controller))
);

/**
 * @route   DELETE /api/accounts/:id/users/:userId
 * @desc    Remove user from account
 * @access  Private
 */
router.delete(
  '/:id/users/:userId',
  validate([
    param('id').isUUID().withMessage('Invalid account ID'),
    param('userId').isUUID().withMessage('Invalid user ID'),
  ]),
  asyncHandler(controller.removeUser.bind(controller))
);

export default router;

