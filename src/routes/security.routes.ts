/**
 * ============================================
 * FaceMyDealer - Security Dashboard Routes
 * ============================================
 * 
 * Routes for:
 * - Security dashboard overview
 * - Green Route analytics & logs
 * - Origin validation logs
 * - Account whitelist management
 */

import { Router } from 'express';
import securityController from '../controllers/security-dashboard.controller';
import { authenticate } from '../middleware/auth';
import { setAccountContext } from '../middleware/account.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(setAccountContext);

// ============================================
// DASHBOARD
// ============================================

// Get security dashboard overview
router.get('/dashboard', securityController.getSecurityDashboard);

// ============================================
// GREEN ROUTE LOGS
// ============================================

// Get Green Route request logs
router.get('/green-route/logs', securityController.getGreenRouteLogs);

// Get specific log detail (click modal)
router.get('/green-route/logs/:id', securityController.getGreenRouteLogDetail);

// ============================================
// BLOCKED REQUESTS
// ============================================

// Get blocked origin validation requests
router.get('/blocked-requests', securityController.getBlockedRequests);

// ============================================
// WHITELIST MANAGEMENT
// ============================================

// Get all whitelisted accounts
router.get('/whitelist', securityController.getWhitelist);

// Add account to whitelist
router.post('/whitelist/:accountId', securityController.addToWhitelist);

// Remove account from whitelist
router.delete('/whitelist/:accountId', securityController.removeFromWhitelist);

// Update whitelist permissions
router.patch('/whitelist/:accountId', securityController.updateWhitelist);

// ============================================
// ANALYTICS
// ============================================

// Get endpoint analytics
router.get('/analytics/endpoints', securityController.getEndpointAnalytics);

// Get request timeline for charts
router.get('/analytics/timeline', securityController.getRequestTimeline);

export default router;
