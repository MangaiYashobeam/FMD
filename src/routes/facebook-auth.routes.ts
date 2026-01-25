/**
 * Facebook OAuth Routes - DEPRECATED
 * 
 * ⚠️ DEPRECATED: OAuth is being phased out in favor of session-based authentication
 * 
 * Facebook's Marketplace API is not publicly available, so OAuth tokens cannot be
 * used to post vehicles. Instead, we now use browser session cookies captured via
 * the Chrome extension, combined with TOTP-based 2FA for session recovery.
 * 
 * New system: See fb-session.routes.ts for the session-based API
 * 
 * This file is kept for backward compatibility during migration.
 * All routes now return deprecation warnings.
 */

import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';

const router = Router();

// Deprecation warning helper
const sendDeprecationWarning = (res: Response, oldEndpoint: string, newEndpoint: string) => {
  res.status(410).json({
    success: false,
    deprecated: true,
    error: `OAuth authentication is deprecated. Facebook Marketplace does not support API posting.`,
    message: `Please use session-based authentication instead.`,
    migration: {
      oldEndpoint,
      newEndpoint,
      documentation: '/docs/SESSION_AUTH_MIGRATION.md',
    },
    newAuthSystem: {
      description: 'Session-based authentication with browser cookies and TOTP 2FA',
      endpoints: {
        captureSession: 'POST /api/fb-session/capture',
        syncSession: 'POST /api/fb-session/sync',
        validateSession: 'POST /api/fb-session/validate',
        setup2FA: 'POST /api/fb-session/totp/setup',
        verify2FA: 'POST /api/fb-session/totp/verify',
      },
    },
  });
};

/**
 * GET /api/auth/facebook/config
 * DEPRECATED - OAuth configuration
 */
router.get('/config', (_req: Request, res: Response) => {
  logger.warn('DEPRECATED: /api/auth/facebook/config called - OAuth is deprecated');
  res.json({
    appId: '',
    scope: '',
    version: '',
    available: false,
    deprecated: true,
    deprecationNotice: 'OAuth is deprecated. Use session-based auth via /api/fb-session/*',
    migration: {
      newEndpoint: 'GET /api/fb-session/status/:accountId',
      documentation: 'Session-based authentication uses browser cookies, not OAuth tokens',
    },
  });
});

/**
 * POST /api/auth/facebook/callback
 * DEPRECATED - OAuth callback (both extension and web)
 */
router.post('/callback', async (req: Request, res: Response) => {
  logger.warn('DEPRECATED: /api/auth/facebook/callback called - OAuth is deprecated');
  sendDeprecationWarning(res, 'POST /api/auth/facebook/callback', 'POST /api/fb-session/capture');
});

/**
 * POST /api/auth/facebook/refresh
 * DEPRECATED - Token refresh
 */
router.post('/refresh', (_req: Request, res: Response) => {
  logger.warn('DEPRECATED: /api/auth/facebook/refresh called - OAuth is deprecated');
  sendDeprecationWarning(res, 'POST /api/auth/facebook/refresh', 'POST /api/fb-session/validate');
});

/**
 * POST /api/auth/facebook/disconnect
 * DEPRECATED - Disconnect Facebook OAuth
 */
router.post('/disconnect', async (req: Request, res: Response) => {
  logger.warn('DEPRECATED: /api/auth/facebook/disconnect called - OAuth is deprecated');
  sendDeprecationWarning(res, 'POST /api/auth/facebook/disconnect', 'DELETE /api/fb-session/:sessionId');
});

export default router;
