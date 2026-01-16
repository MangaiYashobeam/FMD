/**
 * Intelliceil Routes
 * 
 * API routes for the Intelliceil security dashboard
 * All routes require SUPER_ADMIN access
 */

import { Router } from 'express';
import intelliceilController from '@/controllers/intelliceil.controller';

const router = Router();

// Status & monitoring
router.get('/status', intelliceilController.getStatus);
router.get('/geo-locations', intelliceilController.getGeoLocations);
router.get('/traffic-history', intelliceilController.getTrafficHistory);

// Configuration
router.get('/config', intelliceilController.getConfig);
router.put('/config', intelliceilController.updateConfig);

// IP management
router.post('/block-ip', intelliceilController.blockIP);
router.post('/unblock-ip', intelliceilController.unblockIP);

// Mitigation controls
router.post('/mitigation/activate', intelliceilController.activateMitigation);
router.post('/mitigation/deactivate', intelliceilController.deactivateMitigation);

// Trusted domains
router.post('/trusted-domains', intelliceilController.addTrustedDomain);
router.delete('/trusted-domains', intelliceilController.removeTrustedDomain);

export default router;
