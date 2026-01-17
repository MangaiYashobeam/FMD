import { Router, Request, Response } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import { AuthController } from '@/controllers/auth.controller';
import { authenticate } from '@/middleware/auth';
import { validate, authValidators } from '@/middleware/validation';
import prisma from '@/config/database';
import bcrypt from 'bcrypt';

const router = Router();
const authController = new AuthController();

// ============================================
// Diagnostic Route (TEMPORARY - Remove in production)
// ============================================

/**
 * @route   GET /api/auth/health
 * @desc    Check auth system health
 * @access  Public
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    // Check database connection
    const dbCheck = await prisma.$queryRaw`SELECT 1 as ok`;
    
    // Check if super admin exists
    const superAdmin = await prisma.user.findUnique({
      where: { email: 'admin@gadproductions.com' },
      select: { 
        id: true, 
        email: true, 
        isActive: true,
        accountUsers: {
          select: { role: true }
        }
      },
    });

    // Check environment variables
    const envCheck = {
      JWT_SECRET: !!process.env.JWT_SECRET,
      JWT_REFRESH_SECRET: !!process.env.JWT_REFRESH_SECRET,
      DATABASE_URL: !!process.env.DATABASE_URL,
    };

    res.json({
      success: true,
      data: {
        database: dbCheck ? 'connected' : 'error',
        superAdmin: superAdmin ? {
          exists: true,
          active: superAdmin.isActive,
          roles: superAdmin.accountUsers.map(au => au.role),
        } : { exists: false },
        environment: envCheck,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

/**
 * @route   GET /api/auth/debug-login
 * @desc    Debug login step by step
 * @access  Public (TEMPORARY)
 */
router.get('/debug-login', async (_req: Request, res: Response): Promise<void> => {
  const email = 'admin@gadproductions.com';
  const password = 'GadAdmin2026!Temp';
  const steps: Record<string, any> = {};
  
  try {
    // Step 1: Find user
    steps.step1_findUser = 'starting';
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        isActive: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
      },
    });
    steps.step1_findUser = user ? { found: true, active: user.isActive, hasPasswordHash: !!user.passwordHash } : { found: false };

    if (!user) {
      res.json({ success: false, steps, error: 'User not found' });
      return;
    }

    // Step 2: Check password
    steps.step2_passwordCheck = 'starting';
    const isPasswordValid = user.passwordHash 
      ? await bcrypt.compare(password, user.passwordHash)
      : false;
    steps.step2_passwordCheck = { valid: isPasswordValid };

    if (!isPasswordValid) {
      res.json({ success: false, steps, error: 'Invalid password' });
      return;
    }

    // Step 3: Check JWT secrets
    steps.step3_jwtSecrets = {
      JWT_SECRET: !!process.env.JWT_SECRET,
      JWT_REFRESH_SECRET: !!process.env.JWT_REFRESH_SECRET,
      JWT_SECRET_LENGTH: process.env.JWT_SECRET?.length || 0,
    };

    // Step 4: Try to create refresh token record
    steps.step4_refreshToken = 'starting';
    try {
      const testToken = await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: 'test-debug-token-' + Date.now(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      // Clean up test token
      await prisma.refreshToken.delete({ where: { id: testToken.id } });
      steps.step4_refreshToken = { success: true };
    } catch (err: any) {
      steps.step4_refreshToken = { success: false, error: err.message };
    }

    // Step 5: Try to update user last login
    steps.step5_updateUser = 'starting';
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
      steps.step5_updateUser = { success: true };
    } catch (err: any) {
      steps.step5_updateUser = { success: false, error: err.message };
    }

    // Step 6: Try to create audit log
    steps.step6_auditLog = 'starting';
    try {
      const log = await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'DEBUG_TEST',
          entityType: 'user',
          entityId: user.id,
          ipAddress: 'debug-test',
          userAgent: 'debug-test',
        },
      });
      // Clean up
      await prisma.auditLog.delete({ where: { id: log.id } });
      steps.step6_auditLog = { success: true };
    } catch (err: any) {
      steps.step6_auditLog = { success: false, error: err.message };
    }

    res.json({ success: true, steps, message: 'All steps passed - login should work' });
  } catch (error: any) {
    res.json({ 
      success: false, 
      steps, 
      error: error.message,
      stack: error.stack 
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

export default router;
