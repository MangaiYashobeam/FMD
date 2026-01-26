/**
 * Extension Token Exchange Routes - Secure API for Extension Authentication
 * 
 * These routes replace the need for bundled secrets in the extension.
 * The extension calls these endpoints to get ephemeral session tokens.
 * 
 * Flow:
 * 1. Extension authenticates user (login)
 * 2. Extension calls /api/extension/token/exchange with user JWT
 * 3. Server validates and returns session token + signing key
 * 4. Extension uses session token for all subsequent requests
 * 5. Extension signs sensitive requests with per-session signing key
 */

import { Router, Request, Response } from 'express';
import {
  generateExtensionSessionToken,
  validateExtensionSessionToken,
  revokeToken,
  revokeAllUserTokens,
  revokeDeviceTokens,
  TokenExchangeRequest,
} from '../services/extension-token.service';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import {
  logSecurityEvent,
  SecurityEventType,
} from '../middleware/enterprise-security.middleware';

const router = Router();

// ============================================
// TOKEN EXCHANGE ENDPOINT
// ============================================

/**
 * POST /api/extension/token/exchange
 * Exchange user JWT for extension session token
 * 
 * Body:
 * - userJwt: string (required) - User's authentication JWT
 * - extensionId: string (required) - Chrome extension ID
 * - extensionVersion: string (required) - Extension version
 * - deviceFingerprint: string (required) - Client device fingerprint
 * - timestamp: number (required) - Request timestamp
 * - nonce: string (required) - Unique nonce for replay prevention
 */
router.post('/exchange', async (req: Request, res: Response) => {
  try {
    const {
      userJwt,
      extensionId,
      extensionVersion,
      deviceFingerprint,
      timestamp,
      nonce,
    } = req.body;

    // Validate required fields
    if (!userJwt || !extensionId || !deviceFingerprint || !timestamp || !nonce) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields',
        required: ['userJwt', 'extensionId', 'deviceFingerprint', 'timestamp', 'nonce'],
      });
      return;
    }

    // Log exchange attempt
    logger.info('[TokenExchange] Exchange request received', {
      extensionId,
      extensionVersion,
      ip: req.ip,
    });

    // Generate session token
    const request: TokenExchangeRequest = {
      userJwt,
      extensionId,
      extensionVersion: extensionVersion || '1.0.0',
      deviceFingerprint,
      timestamp: Number(timestamp),
      nonce,
    };

    const result = await generateExtensionSessionToken(request);

    if (!result.success) {
      logSecurityEvent(
        req,
        SecurityEventType.INVALID_TOKEN,
        false,
        { error: result.error, extensionId },
        'MEDIUM'
      );

      res.status(401).json({
        success: false,
        message: result.error || 'Token exchange failed',
      });
      return;
    }

    // Log successful exchange
    logSecurityEvent(
      req,
      SecurityEventType.LOGIN_SUCCESS,
      true,
      { extensionId, capabilities: result.capabilities },
      'LOW'
    );

    res.json({
      success: true,
      data: {
        sessionToken: result.sessionToken,
        signingKey: result.signingKey,
        expiresAt: result.expiresAt,
        capabilities: result.capabilities,
      },
    });

  } catch (error) {
    logger.error('[TokenExchange] Error', { error });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// ============================================
// TOKEN VALIDATION ENDPOINT
// ============================================

/**
 * POST /api/extension/token/validate
 * Validate an extension session token
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { sessionToken } = req.body;

    if (!sessionToken) {
      res.status(400).json({
        success: false,
        message: 'Session token required',
      });
      return;
    }

    const result = await validateExtensionSessionToken(sessionToken);

    if (!result.valid) {
      res.status(401).json({
        success: false,
        message: result.error || 'Invalid token',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        valid: true,
        userId: result.payload?.userId,
        accountId: result.payload?.accountId,
        capabilities: result.payload?.capabilities,
        expiresAt: result.payload?.expiresAt,
      },
    });

  } catch (error) {
    logger.error('[TokenValidate] Error', { error });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// ============================================
// TOKEN REFRESH ENDPOINT
// ============================================

/**
 * POST /api/extension/token/refresh
 * Refresh an expiring session token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const {
      sessionToken,
      extensionId,
      deviceFingerprint,
    } = req.body;

    if (!sessionToken) {
      res.status(400).json({
        success: false,
        message: 'Session token required',
      });
      return;
    }

    // Validate existing token
    const validation = await validateExtensionSessionToken(sessionToken);
    
    if (!validation.valid || !validation.payload) {
      res.status(401).json({
        success: false,
        message: validation.error || 'Invalid token',
      });
      return;
    }

    // Check if token is within refresh window (last 2 hours before expiry)
    const refreshWindowMs = 2 * 60 * 60 * 1000;
    const timeUntilExpiry = validation.payload.expiresAt - Date.now();
    
    if (timeUntilExpiry > refreshWindowMs) {
      res.json({
        success: true,
        data: {
          refreshed: false,
          message: 'Token still valid, refresh not needed',
          expiresAt: validation.payload.expiresAt,
        },
      });
      return;
    }

    // Generate new token
    const request: TokenExchangeRequest = {
      userJwt: '', // Not needed for refresh - we use existing validation
      extensionId: extensionId || validation.payload.extensionId,
      extensionVersion: '1.0.0',
      deviceFingerprint: deviceFingerprint || validation.payload.deviceFingerprint,
      timestamp: Date.now(),
      nonce: `refresh_${Date.now()}_${Math.random().toString(36)}`,
    };

    // Generate fresh JWT for internal use
    const jwt = require('jsonwebtoken');
    const tempJwt = jwt.sign(
      { id: validation.payload.userId },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );
    request.userJwt = tempJwt;

    const result = await generateExtensionSessionToken(request);

    if (!result.success) {
      res.status(500).json({
        success: false,
        message: result.error || 'Token refresh failed',
      });
      return;
    }

    // Revoke old token
    await revokeToken(validation.payload.tokenId);

    logger.info('[TokenRefresh] Token refreshed', {
      userId: validation.payload.userId,
      oldTokenId: validation.payload.tokenId,
    });

    res.json({
      success: true,
      data: {
        refreshed: true,
        sessionToken: result.sessionToken,
        signingKey: result.signingKey,
        expiresAt: result.expiresAt,
        capabilities: result.capabilities,
      },
    });

  } catch (error) {
    logger.error('[TokenRefresh] Error', { error });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// ============================================
// TOKEN REVOCATION ENDPOINTS
// ============================================

/**
 * POST /api/extension/token/revoke
 * Revoke current session token (logout from extension)
 */
router.post('/revoke', async (req: Request, res: Response) => {
  try {
    const { sessionToken } = req.body;

    if (!sessionToken) {
      res.status(400).json({
        success: false,
        message: 'Session token required',
      });
      return;
    }

    // Validate token to get token ID
    const validation = await validateExtensionSessionToken(sessionToken);
    
    if (!validation.valid || !validation.payload) {
      // Token already invalid/expired - that's fine
      res.json({
        success: true,
        message: 'Token already invalid',
      });
      return;
    }

    // Revoke token
    await revokeToken(validation.payload.tokenId);

    logSecurityEvent(
      req,
      SecurityEventType.LOGOUT,
      true,
      { tokenId: validation.payload.tokenId },
      'LOW'
    );

    res.json({
      success: true,
      message: 'Token revoked successfully',
    });

  } catch (error) {
    logger.error('[TokenRevoke] Error', { error });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * POST /api/extension/token/revoke-all
 * Revoke all tokens for current user (logout from all devices)
 * Requires authentication
 */
router.post('/revoke-all', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const count = await revokeAllUserTokens(userId);

    logSecurityEvent(
      req,
      SecurityEventType.LOGOUT,
      true,
      { action: 'revoke_all', tokenCount: count },
      'LOW'
    );

    res.json({
      success: true,
      message: `Revoked ${count} token(s)`,
      data: { revokedCount: count },
    });

  } catch (error) {
    logger.error('[TokenRevokeAll] Error', { error });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * POST /api/extension/token/revoke-device
 * Revoke all tokens for a specific device
 * Requires authentication
 */
router.post('/revoke-device', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { deviceFingerprint } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    if (!deviceFingerprint) {
      res.status(400).json({
        success: false,
        message: 'Device fingerprint required',
      });
      return;
    }

    const count = await revokeDeviceTokens(userId, deviceFingerprint);

    logSecurityEvent(
      req,
      SecurityEventType.LOGOUT,
      true,
      { action: 'revoke_device', deviceFingerprint, tokenCount: count },
      'LOW'
    );

    res.json({
      success: true,
      message: `Revoked ${count} token(s) for device`,
      data: { revokedCount: count },
    });

  } catch (error) {
    logger.error('[TokenRevokeDevice] Error', { error });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// ============================================
// TOKEN INFO ENDPOINT (DEBUG/ADMIN)
// ============================================

/**
 * GET /api/extension/token/info
 * Get information about current session token
 */
router.post('/info', async (req: Request, res: Response) => {
  try {
    const { sessionToken } = req.body;

    if (!sessionToken) {
      res.status(400).json({
        success: false,
        message: 'Session token required',
      });
      return;
    }

    const validation = await validateExtensionSessionToken(sessionToken);

    if (!validation.valid || !validation.payload) {
      res.status(401).json({
        success: false,
        message: validation.error || 'Invalid token',
      });
      return;
    }

    const payload = validation.payload;

    res.json({
      success: true,
      data: {
        tokenId: payload.tokenId,
        userId: payload.userId,
        accountId: payload.accountId,
        extensionId: payload.extensionId,
        capabilities: payload.capabilities,
        issuedAt: new Date(payload.issuedAt).toISOString(),
        expiresAt: new Date(payload.expiresAt).toISOString(),
        timeRemaining: payload.expiresAt - Date.now(),
      },
    });

  } catch (error) {
    logger.error('[TokenInfo] Error', { error });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export default router;
