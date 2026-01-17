/**
 * Facebook OAuth Routes
 * 
 * NOTE: This feature requires database migration. The following columns
 * need to be added to the users table:
 * - facebook_id
 * - facebook_access_token
 * - facebook_token_expiry
 * 
 * Run `npx prisma migrate deploy` on production to enable this feature.
 */

import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';

const router = Router();

const FEATURE_UNAVAILABLE_MSG = 'Facebook OAuth feature requires database migration. Please contact support.';

/**
 * GET /api/auth/facebook/config
 * Get Facebook OAuth configuration (safe to expose)
 */
router.get('/config', (_req: Request, res: Response) => {
  res.json({
    appId: process.env.FACEBOOK_APP_ID || '',
    scope: 'email,public_profile,pages_show_list,pages_read_engagement',
    version: 'v18.0',
    available: false,
    message: FEATURE_UNAVAILABLE_MSG,
  });
});

/**
 * POST /api/auth/facebook/callback
 * Handle Facebook OAuth callback - DISABLED
 */
router.post('/callback', (_req: Request, res: Response) => {
  logger.warn('Facebook OAuth callback called but feature is disabled');
  res.status(503).json({
    success: false,
    error: FEATURE_UNAVAILABLE_MSG,
  });
});

/**
 * POST /api/auth/facebook/refresh
 * Refresh Facebook access token - DISABLED
 */
router.post('/refresh', (_req: Request, res: Response) => {
  logger.warn('Facebook token refresh called but feature is disabled');
  res.status(503).json({
    success: false,
    error: FEATURE_UNAVAILABLE_MSG,
  });
});

/**
 * POST /api/auth/facebook/disconnect
 * Disconnect Facebook from user account - DISABLED
 */
router.post('/disconnect', (_req: Request, res: Response) => {
  logger.warn('Facebook disconnect called but feature is disabled');
  res.status(503).json({
    success: false,
    error: FEATURE_UNAVAILABLE_MSG,
  });
});

export default router;
