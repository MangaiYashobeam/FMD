import { Router } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import { AuthController } from '@/controllers/auth.controller';
import { authenticate } from '@/middleware/auth';
import { validate, authValidators } from '@/middleware/validation';

const router = Router();
const authController = new AuthController();

// ============================================
// Public Routes
// ============================================

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  validate(authValidators.register),
  asyncHandler(authController.register)
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  validate(authValidators.login),
  asyncHandler(authController.login)
);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public
 */
router.post(
  '/refresh-token',
  validate(authValidators.refreshToken),
  asyncHandler(authController.refreshToken)
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticate, asyncHandler(authController.logout));

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', authenticate, asyncHandler(authController.getCurrentUser));

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post(
  '/forgot-password',
  validate(authValidators.forgotPassword),
  asyncHandler(authController.forgotPassword)
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password
 * @access  Public
 */
router.post(
  '/reset-password',
  validate(authValidators.resetPassword),
  asyncHandler(authController.resetPassword)
);

// ============================================
// Super Admin Impersonation Routes
// ============================================

/**
 * @route   GET /api/auth/impersonation/targets
 * @desc    Get list of users available for impersonation
 * @access  Super Admin only
 */
router.get(
  '/impersonation/targets',
  authenticate,
  asyncHandler(authController.getImpersonationTargets)
);

/**
 * @route   POST /api/auth/impersonate/:userId
 * @desc    Start impersonating another user
 * @access  Super Admin only
 */
router.post(
  '/impersonate/:userId',
  authenticate,
  asyncHandler(authController.impersonateUser)
);

/**
 * @route   POST /api/auth/end-impersonation
 * @desc    End impersonation and restore admin session
 * @access  Private (called with stored admin token)
 */
router.post(
  '/end-impersonation',
  authenticate,
  asyncHandler(authController.endImpersonation)
);

export default router;
