/**
 * User Settings Routes
 * 
 * Protected routes for user settings management.
 * Includes connection method preferences and account settings.
 * 
 * Security: All routes require authentication
 */

import { Router } from 'express';
import { userSettingsController } from '@/controllers/user-settings.controller';
import { authenticate } from '@/middleware/auth';
import { requireRole, UserRole } from '@/middleware/rbac';
import { generalLimiter } from '@/middleware/security';

const router = Router();

// ============================================================================
// Middleware
// ============================================================================

// All settings routes require authentication
router.use(authenticate);

// Rate limiting using general limiter
const standardLimiter = generalLimiter;

// ============================================================================
// CONNECTION METHOD ROUTES
// ============================================================================

/**
 * @route   GET /api/settings/connection-methods
 * @desc    Get all available connection methods with configurations
 * @access  All authenticated users
 */
router.get(
  '/connection-methods',
  standardLimiter,
  requireRole(UserRole.VIEWER),
  userSettingsController.getAvailableConnectionMethods.bind(userSettingsController)
);

/**
 * @route   GET /api/settings/connection-methods/:methodId
 * @desc    Get detailed info about a specific connection method
 * @access  All authenticated users
 */
router.get(
  '/connection-methods/:methodId',
  standardLimiter,
  requireRole(UserRole.VIEWER),
  userSettingsController.getConnectionMethodDetails.bind(userSettingsController)
);

/**
 * @route   GET /api/settings/connection-preference
 * @desc    Get user's current connection method preference
 * @access  All authenticated users
 */
router.get(
  '/connection-preference',
  standardLimiter,
  requireRole(UserRole.VIEWER),
  userSettingsController.getConnectionPreference.bind(userSettingsController)
);

/**
 * @route   PUT /api/settings/connection-preference
 * @desc    Update user's connection method preference
 * @access  All authenticated users
 */
router.put(
  '/connection-preference',
  standardLimiter,
  requireRole(UserRole.VIEWER),
  userSettingsController.updateConnectionPreference.bind(userSettingsController)
);

/**
 * @route   GET /api/settings/connection-status
 * @desc    Get current connection status for all methods
 * @access  All authenticated users
 */
router.get(
  '/connection-status',
  standardLimiter,
  requireRole(UserRole.VIEWER),
  userSettingsController.getConnectionStatus.bind(userSettingsController)
);

/**
 * @route   POST /api/settings/test-connection
 * @desc    Test a specific connection method
 * @access  All authenticated users
 */
router.post(
  '/test-connection',
  standardLimiter,
  requireRole(UserRole.VIEWER),
  userSettingsController.testConnection.bind(userSettingsController)
);

// ============================================================================
// Export
// ============================================================================

export default router;
