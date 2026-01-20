import { Router, Request, Response } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import { AuthController } from '@/controllers/auth.controller';
import { authenticate } from '@/middleware/auth';
import { validate, authValidators } from '@/middleware/validation';
import prisma from '@/config/database';
import { logger } from '@/utils/logger';

const router = Router();
const authController = new AuthController();

// ============================================
// Health Check (Safe for production)
// ============================================

/**
 * @route   GET /api/auth/health
 * @desc    Basic health check (no sensitive data)
 * @access  Public
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    // Check database connection only
    await prisma.$queryRaw`SELECT 1 as ok`;
    
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Auth health check failed:', error.message);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
    });
  }
});
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

// ============================================
// Profile & Security Routes
// ============================================

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authenticate, asyncHandler(authController.updateProfile));

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password', authenticate, asyncHandler(authController.changePassword));

/**
 * @route   GET /api/auth/sessions
 * @desc    Get active sessions
 * @access  Private
 */
router.get('/sessions', authenticate, asyncHandler(authController.getActiveSessions));

/**
 * @route   POST /api/auth/sessions/revoke-others
 * @desc    Revoke all other sessions
 * @access  Private
 */
router.post('/sessions/revoke-others', authenticate, asyncHandler(authController.revokeOtherSessions));

export default router;
