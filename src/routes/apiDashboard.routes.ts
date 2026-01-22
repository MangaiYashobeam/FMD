/**
 * API Dashboard Routes
 * 
 * Provides endpoints for comprehensive API monitoring and service management.
 * All routes require super admin authentication.
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate } from '@/middleware/auth';
import { requireSuperAdmin } from '@/middleware/rbac';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate } from '@/middleware/validation';
import * as apiDashboardController from '@/controllers/apiDashboard.controller';

const router = Router();

// All routes require authentication and super admin role
router.use(authenticate);
router.use(requireSuperAdmin);

// ============================================
// Dashboard Overview
// ============================================

/**
 * @route   GET /api/admin/api-dashboard
 * @desc    Get comprehensive API dashboard data
 * @access  Super Admin
 */
router.get('/', asyncHandler(apiDashboardController.getDashboardData));

/**
 * @route   GET /api/admin/api-dashboard/categories
 * @desc    Get endpoint categories summary
 * @access  Super Admin
 */
router.get('/categories', asyncHandler(apiDashboardController.getEndpointCategories));

// ============================================
// Endpoint Management
// ============================================

/**
 * @route   GET /api/admin/api-dashboard/endpoints
 * @desc    Get all API endpoints with status
 * @access  Super Admin
 */
router.get(
  '/endpoints',
  validate([
    query('category').optional().isIn(['auth', 'facebook', 'extension', 'vehicle', 'sync', 'admin', 'subscription', 'ai', 'security', 'other']).withMessage('Invalid category'),
  ]),
  asyncHandler(apiDashboardController.getEndpoints)
);

/**
 * @route   GET /api/admin/api-dashboard/endpoints/:endpointId
 * @desc    Get single endpoint details
 * @access  Super Admin
 */
router.get(
  '/endpoints/:endpointId',
  validate([
    param('endpointId').isString().notEmpty().withMessage('Endpoint ID is required'),
  ]),
  asyncHandler(apiDashboardController.getEndpointDetails)
);

/**
 * @route   POST /api/admin/api-dashboard/endpoints/:endpointId/health-check
 * @desc    Run health check on specific endpoint
 * @access  Super Admin
 */
router.post(
  '/endpoints/:endpointId/health-check',
  validate([
    param('endpointId').isString().notEmpty().withMessage('Endpoint ID is required'),
  ]),
  asyncHandler(apiDashboardController.checkEndpointHealth)
);

// ============================================
// Service Management
// ============================================

/**
 * @route   GET /api/admin/api-dashboard/services
 * @desc    Get all services status
 * @access  Super Admin
 */
router.get('/services', asyncHandler(apiDashboardController.getServices));

/**
 * @route   GET /api/admin/api-dashboard/services/:serviceId
 * @desc    Get single service details
 * @access  Super Admin
 */
router.get(
  '/services/:serviceId',
  validate([
    param('serviceId').isString().notEmpty().withMessage('Service ID is required'),
  ]),
  asyncHandler(apiDashboardController.getServiceDetails)
);

/**
 * @route   POST /api/admin/api-dashboard/services/:serviceId/control
 * @desc    Control a service (start, stop, restart, pause)
 * @access  Super Admin
 */
router.post(
  '/services/:serviceId/control',
  validate([
    param('serviceId').isString().notEmpty().withMessage('Service ID is required'),
    body('action').isIn(['start', 'stop', 'restart', 'pause']).withMessage('Invalid action. Use: start, stop, restart, pause'),
  ]),
  asyncHandler(apiDashboardController.controlService)
);

// ============================================
// System Control
// ============================================

/**
 * @route   POST /api/admin/api-dashboard/health-check
 * @desc    Run health check on all endpoints
 * @access  Super Admin
 */
router.post('/health-check', asyncHandler(apiDashboardController.runFullHealthCheck));

/**
 * @route   POST /api/admin/api-dashboard/panic
 * @desc    Activate PANIC mode - stops all non-essential services
 * @access  Super Admin
 */
router.post(
  '/panic',
  validate([
    body('reason').optional().isString().isLength({ max: 500 }).withMessage('Reason must be less than 500 characters'),
  ]),
  asyncHandler(apiDashboardController.activatePanicMode)
);

/**
 * @route   DELETE /api/admin/api-dashboard/panic
 * @desc    Deactivate PANIC mode - resumes all services
 * @access  Super Admin
 */
router.delete('/panic', asyncHandler(apiDashboardController.deactivatePanicMode));

export default router;
