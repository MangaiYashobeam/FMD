/**
 * IIPC Routes
 * 
 * API routes for the Internal IP Controller
 */

import { Router } from 'express';
import { iipcController } from '@/controllers/iipc.controller';
import { iipcCheck } from '@/middleware/iipc';

const router = Router();

// Apply IIPC check to all routes
router.use(iipcCheck);

// ============================================
// Status & Info
// ============================================

// Get full status (Super Admin)
router.get('/status', iipcController.getStatus);

// Check current IP
router.get('/check-ip', iipcController.checkCurrentIP);

// ============================================
// Configuration (Super Admin)
// ============================================

// Get/Update configuration
router.get('/config', iipcController.getConfig);
router.put('/config', iipcController.updateConfig);

// Role settings
router.get('/role-settings', iipcController.getRoleSettings);
router.put('/role-settings', iipcController.updateRoleSettings);

// ============================================
// IP Rules Management
// ============================================

// Get all rules
router.get('/rules', iipcController.getRules);

// Add/Update/Delete rules
router.post('/rules', iipcController.addRule);
router.put('/rules/:id', iipcController.updateRule);
router.delete('/rules/:id', iipcController.deleteRule);

// ============================================
// Super Admin IP Management
// ============================================

router.get('/super-admin-ips', iipcController.getSuperAdminIPs);
router.post('/super-admin-ips', iipcController.addSuperAdminIP);
router.delete('/super-admin-ips', iipcController.removeSuperAdminIP);

// ============================================
// User IP Management
// ============================================

// Whitelist own IP (self-service)
router.post('/whitelist-own', iipcController.whitelistOwnIP);

// Get user's IPs
router.get('/user/:userId/ips', iipcController.getUserIPs);
router.get('/my-ips', iipcController.getUserIPs);

// ============================================
// Emergency Access
// ============================================

router.post('/emergency/request', iipcController.requestEmergencyAccess);
router.post('/emergency/verify', iipcController.verifyEmergencyAccess);

// ============================================
// Rate Limit Control (Super Admin)
// ============================================

// Reset rate limits for specific IP or current IP
router.post('/reset-rate-limits', iipcController.resetRateLimits);

// Reset ALL rate limits (use with caution)
router.post('/reset-all-rate-limits', iipcController.resetAllRateLimits);

export default router;
