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

/**
 * @route   GET /api/auth/extension-login
 * @desc    Handle login from Chrome extension - redirects to dashboard with tokens set
 * @access  Public (token in query params)
 */
router.get('/extension-login', async (req: Request, res: Response) => {
  try {
    const { token, refreshToken, redirect = '/dashboard' } = req.query;
    
    if (!token || typeof token !== 'string') {
      // Redirect to login page if no token
      res.redirect('https://dealersface.com/login?error=missing_token');
      return;
    }
    
    // Verify the token is valid (don't need to decode fully, just check it works)
    const jwt = require('jsonwebtoken');
    const { getJwtSecret } = require('@/config/security');
    const jwtSecret = getJwtSecret();
    
    try {
      const decoded = jwt.verify(token, jwtSecret);
      logger.info(`Extension login for user ${decoded.id || decoded.userId}`);
    } catch (jwtError) {
      logger.warn('Extension login with invalid token');
      res.redirect('https://dealersface.com/login?error=invalid_token');
      return;
    }
    
    // Build the redirect URL with tokens as hash params (so they're not logged in server logs)
    const redirectPath = typeof redirect === 'string' ? redirect : '/dashboard';
    const safeRedirect = redirectPath.startsWith('/') ? redirectPath : '/dashboard';
    
    // Create HTML page that sets localStorage and redirects
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Logging in...</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; }
    .loader { text-align: center; }
    .spinner { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.2); border-top-color: #0066ff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <p>Logging you in...</p>
  </div>
  <script>
    try {
      // Store tokens in localStorage
      localStorage.setItem('accessToken', ${JSON.stringify(token)});
      ${refreshToken && typeof refreshToken === 'string' ? `localStorage.setItem('refreshToken', ${JSON.stringify(refreshToken)});` : ''}
      
      // Redirect to dashboard
      window.location.href = ${JSON.stringify(safeRedirect)};
    } catch (e) {
      console.error('Failed to set tokens:', e);
      window.location.href = '/login?error=storage_failed';
    }
  </script>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error: any) {
    logger.error('Extension login error:', error.message);
    res.redirect('https://dealersface.com/login?error=server_error');
  }
});

export default router;
