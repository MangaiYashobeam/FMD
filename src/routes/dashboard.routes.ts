/**
 * Dashboard Routes
 * 
 * Protected routes for the comprehensive dashboard system.
 * Implements role-based access control:
 * - SUPER_ADMIN: Full system-wide access
 * - ADMIN/ACCOUNT_OWNER: Account-level access
 * - USER: Profile-level access only
 * 
 * Security: All routes require authentication and role verification
 */

import { Router } from 'express';
import { dashboardController } from '@/controllers/dashboard.controller';
import { authenticate } from '@/middleware/auth';
import { requireRole, requirePermission, UserRole } from '@/middleware/rbac';
import { generalLimiter } from '@/middleware/security';

const router = Router();

// ============================================================================
// Middleware Composition
// ============================================================================

// Base authentication for all dashboard routes
router.use(authenticate);

// Use general limiter for all dashboard routes (rate limiting handled by security middleware)
const dashboardLimiter = generalLimiter;

// ============================================================================
// SUPER ADMIN ROUTES - Full System Access
// ============================================================================

/**
 * @route   GET /api/dashboard/super-admin/overview
 * @desc    Complete system overview with all metrics
 * @access  SUPER_ADMIN only
 */
router.get(
  '/super-admin/overview',
  dashboardLimiter,
  requireRole(UserRole.SUPER_ADMIN),
  requirePermission('MANAGE_ALL_ACCOUNTS'),
  dashboardController.getSuperAdminOverview.bind(dashboardController)
);

/**
 * @route   GET /api/dashboard/super-admin/transactions
 * @desc    Full transaction analytics and revenue data
 * @access  SUPER_ADMIN only
 */
router.get(
  '/super-admin/transactions',
  dashboardLimiter,
  requireRole(UserRole.SUPER_ADMIN),
  requirePermission('MANAGE_ALL_ACCOUNTS'),
  dashboardController.getTransactionAnalytics.bind(dashboardController)
);

/**
 * @route   GET /api/dashboard/super-admin/workers
 * @desc    Worker/Soldier deployment metrics and status
 * @access  SUPER_ADMIN only
 */
router.get(
  '/super-admin/workers',
  dashboardLimiter,
  requireRole(UserRole.SUPER_ADMIN),
  requirePermission('MANAGE_ALL_ACCOUNTS'),
  dashboardController.getWorkerMetrics.bind(dashboardController)
);

/**
 * @route   GET /api/dashboard/super-admin/security
 * @desc    Security metrics, threats, and incidents
 * @access  SUPER_ADMIN only
 */
router.get(
  '/super-admin/security',
  dashboardLimiter,
  requireRole(UserRole.SUPER_ADMIN),
  requirePermission('MANAGE_ALL_ACCOUNTS'),
  dashboardController.getSecurityMetrics.bind(dashboardController)
);

/**
 * @route   GET /api/dashboard/super-admin/facebook-health
 * @desc    Facebook health intelligence across all accounts
 * @access  SUPER_ADMIN only
 */
router.get(
  '/super-admin/facebook-health',
  dashboardLimiter,
  requireRole(UserRole.SUPER_ADMIN),
  requirePermission('MANAGE_ALL_ACCOUNTS'),
  dashboardController.getFacebookHealthIntelligence.bind(dashboardController)
);

/**
 * @route   GET /api/dashboard/super-admin/risk-assessment
 * @desc    Complete system risk assessment with mitigation plans
 * @access  SUPER_ADMIN only
 */
router.get(
  '/super-admin/risk-assessment',
  dashboardLimiter,
  requireRole(UserRole.SUPER_ADMIN),
  requirePermission('MANAGE_ALL_ACCOUNTS'),
  dashboardController.getRiskAssessment.bind(dashboardController)
);

/**
 * @route   GET /api/dashboard/super-admin/activity
 * @desc    Activity feed and audit logs
 * @access  SUPER_ADMIN only
 */
router.get(
  '/super-admin/activity',
  dashboardLimiter,
  requireRole(UserRole.SUPER_ADMIN),
  requirePermission('MANAGE_ALL_ACCOUNTS'),
  dashboardController.getActivityFeed.bind(dashboardController)
);

/**
 * @route   GET /api/dashboard/super-admin/connections
 * @desc    Connection status across all accounts
 * @access  SUPER_ADMIN only
 */
router.get(
  '/super-admin/connections',
  dashboardLimiter,
  requireRole(UserRole.SUPER_ADMIN),
  requirePermission('MANAGE_ALL_ACCOUNTS'),
  dashboardController.getConnectionStatus.bind(dashboardController)
);

/**
 * @route   GET /api/dashboard/super-admin/system-health
 * @desc    System health and infrastructure status
 * @access  SUPER_ADMIN only
 */
router.get(
  '/super-admin/system-health',
  dashboardLimiter,
  requireRole(UserRole.SUPER_ADMIN),
  requirePermission('MANAGE_ALL_ACCOUNTS'),
  dashboardController.getSystemHealth.bind(dashboardController)
);

/**
 * @route   POST /api/dashboard/super-admin/refresh-cache
 * @desc    Force refresh of all dashboard caches
 * @access  SUPER_ADMIN only
 */
router.post(
  '/super-admin/refresh-cache',
  dashboardLimiter,
  requireRole(UserRole.SUPER_ADMIN),
  requirePermission('MANAGE_SYSTEM_SETTINGS'),
  dashboardController.refreshCache.bind(dashboardController)
);

// ============================================================================
// ADMIN ROUTES - Account-Level Access
// ============================================================================

/**
 * @route   GET /api/dashboard/admin/overview
 * @desc    Admin-level overview with limited metrics
 * @access  ADMIN and above
 */
router.get(
  '/admin/overview',
  dashboardLimiter,
  requireRole(UserRole.ADMIN),
  dashboardController.getAdminOverview.bind(dashboardController)
);

/**
 * @route   GET /api/dashboard/admin/account/:accountId/health
 * @desc    Account-specific health metrics
 * @access  ADMIN and above (must own account or be SUPER_ADMIN)
 */
router.get(
  '/admin/account/:accountId/health',
  dashboardLimiter,
  requireRole(UserRole.ADMIN),
  dashboardController.getAccountHealth.bind(dashboardController)
);

// ============================================================================
// USER ROUTES - Profile-Level Access
// ============================================================================

/**
 * @route   GET /api/dashboard/user/profile/:profileId/health
 * @desc    Profile-specific health metrics
 * @access  All authenticated users (must own profile)
 */
router.get(
  '/user/profile/:profileId/health',
  dashboardLimiter,
  requireRole(UserRole.VIEWER),
  dashboardController.getProfileHealth.bind(dashboardController)
);

/**
 * @route   GET /api/dashboard/user/connection-methods
 * @desc    Available connection methods for user
 * @access  All authenticated users
 */
router.get(
  '/user/connection-methods',
  dashboardLimiter,
  requireRole(UserRole.VIEWER),
  dashboardController.getConnectionMethods.bind(dashboardController)
);

// ============================================================================
// REAL-TIME ROUTES - Available to all authenticated users
// ============================================================================

/**
 * @route   GET /api/dashboard/realtime/metrics
 * @desc    Real-time metrics for live dashboard updates
 * @access  ADMIN and above
 */
router.get(
  '/realtime/metrics',
  dashboardLimiter,
  requireRole(UserRole.ADMIN),
  dashboardController.getRealtimeMetrics.bind(dashboardController)
);

// ============================================================================
// Export
// ============================================================================

export default router;
