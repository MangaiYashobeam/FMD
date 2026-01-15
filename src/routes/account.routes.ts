import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { hasPermission } from '@/middleware/rbac';
import { AccountController } from '@/controllers/account.controller';
import { accountSettingsController } from '@/controllers/accountSettings.controller';
import { asyncHandler } from '@/utils/asyncHandler';

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
router.get('/:id', asyncHandler(controller.getAccount.bind(controller)));

/**
 * @route   PUT /api/accounts/:id/settings
 * @desc    Update account settings
 * @access  Private
 */
router.put('/:id/settings', asyncHandler(controller.updateSettings.bind(controller)));

/**
 * @route   POST /api/accounts/:id/invite
 * @desc    Invite user to account
 * @access  Private
 */
router.post('/:id/invite', asyncHandler(controller.inviteUser.bind(controller)));

/**
 * @route   DELETE /api/accounts/:id/users/:userId
 * @desc    Remove user from account
 * @access  Private
 */
router.delete('/:id/users/:userId', asyncHandler(controller.removeUser.bind(controller)));

// ============================================
// Client Admin Routes (NEW)
// ============================================

/**
 * @route   GET /api/accounts/current
 * @desc    Get current user's account info
 * @access  Private
 */
router.get('/current', hasPermission('account:read'), accountSettingsController.getCurrentAccount);

/**
 * @route   GET /api/accounts/settings
 * @desc    Get account settings
 * @access  Private
 */
router.get('/settings', hasPermission('account:read'), accountSettingsController.getSettings);

/**
 * @route   PUT /api/accounts/settings
 * @desc    Update account settings
 * @access  Private
 */
router.put('/settings', hasPermission('account:update'), accountSettingsController.updateSettings);

/**
 * @route   GET /api/accounts/settings/templates
 * @desc    Get description templates
 * @access  Private
 */
router.get('/settings/templates', hasPermission('account:read'), accountSettingsController.getTemplates);

/**
 * @route   POST /api/accounts/settings/templates
 * @desc    Create description template
 * @access  Private
 */
router.post('/settings/templates', hasPermission('account:update'), accountSettingsController.createTemplate);

/**
 * @route   PUT /api/accounts/settings/templates/:id
 * @desc    Update description template
 * @access  Private
 */
router.put('/settings/templates/:id', hasPermission('account:update'), accountSettingsController.updateTemplate);

/**
 * @route   DELETE /api/accounts/settings/templates/:id
 * @desc    Delete description template
 * @access  Private
 */
router.delete('/settings/templates/:id', hasPermission('account:update'), accountSettingsController.deleteTemplate);

/**
 * @route   GET /api/accounts/users
 * @desc    Get team members
 * @access  Private
 */
router.get('/users', hasPermission('account:read'), accountSettingsController.getUsers);

/**
 * @route   POST /api/accounts/users
 * @desc    Create team member
 * @access  Private
 */
router.post('/users', hasPermission('user:create'), accountSettingsController.createUser);

/**
 * @route   DELETE /api/accounts/users/:id
 * @desc    Delete team member
 * @access  Private
 */
router.delete('/users/:id', hasPermission('user:delete'), accountSettingsController.deleteUser);

export default router;

