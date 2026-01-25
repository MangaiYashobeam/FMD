/**
 * Facebook Session Routes
 * =======================
 * 
 * Handles session-based authentication for Facebook Marketplace posting.
 * REPLACES OAuth entirely - sessions are captured from extension and synced.
 * 
 * Endpoints:
 * - POST /capture    - Capture session from extension
 * - POST /sync       - Sync session from desktop to server
 * - GET /status/:id  - Get session status
 * - POST /validate   - Validate session is still active
 * - DELETE /:id      - Revoke session
 * - POST /totp/setup - Setup 2FA for auto-recovery
 * - POST /totp/verify - Verify TOTP code
 * - GET /totp/generate - Generate TOTP code for recovery
 */

import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole, UserRole } from '../middleware/rbac';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { 
  sessionSecurityService, 
  FbCookie, 
  StorageState,
  SessionSecurityEventType 
} from '../services/session-security.service';

const router = Router();

// ============================================
// Types
// ============================================

interface CaptureSessionBody {
  cookies: FbCookie[];
  localStorage?: Array<{ name: string; value: string }>;
  userAgent?: string;
  browserFingerprint?: string;
}

interface SyncSessionBody {
  accountId: string;
  storageState: StorageState;
  source: 'extension' | 'server';
  timestamp: number;
}

interface TotpSetupBody {
  existingSecret?: string; // If user wants to use their own secret
}

interface TotpVerifyBody {
  code: string;
}

// ============================================
// Session Capture & Management
// ============================================

/**
 * POST /api/fb-session/capture
 * Capture session cookies from extension
 */
router.post('/capture', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { cookies, localStorage, userAgent, browserFingerprint }: CaptureSessionBody = req.body;

    if (!cookies || !Array.isArray(cookies)) {
      res.status(400).json({ success: false, error: 'Cookies array is required' });
      return;
    }

    // Get user's account
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId },
      include: { account: true }
    });

    if (!accountUser) {
      res.status(400).json({ success: false, error: 'No account found for user' });
      return;
    }

    const accountId = accountUser.accountId;

    // Validate cookies
    const validation = sessionSecurityService.validateCookies(cookies);
    if (!validation.isValid) {
      res.status(400).json({ 
        success: false, 
        error: validation.reason,
        recommendations: validation.recommendations 
      });
      return;
    }

    // Encrypt session data
    const encryptedCookies = await sessionSecurityService.encrypt(JSON.stringify(cookies));
    
    let encryptedLocalStorage: { encrypted: string; salt: string; iv: string; authTag: string } | null = null;
    if (localStorage && localStorage.length > 0) {
      encryptedLocalStorage = await sessionSecurityService.encrypt(JSON.stringify(localStorage));
    }

    // Get client IP
    const ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0] || 
                      req.socket.remoteAddress || 
                      'unknown';

    // Generate browser fingerprint if not provided
    const fingerprint = browserFingerprint || 
      sessionSecurityService.generateBrowserFingerprint(userAgent || req.headers['user-agent'] || '', ipAddress);

    // Check for existing session with this FB user
    const existingSession = await prisma.fbSession.findFirst({
      where: {
        accountId,
        fbUserId: validation.fbUserId
      }
    });

    let session;
    if (existingSession) {
      // Update existing session
      session = await prisma.fbSession.update({
        where: { id: existingSession.id },
        data: {
          encryptedCookies: encryptedCookies.encrypted,
          encryptedLocalStorage: encryptedLocalStorage?.encrypted,
          encryptionSalt: encryptedCookies.salt,
          encryptionIv: encryptedCookies.iv,
          sessionStatus: 'ACTIVE',
          source: 'EXTENSION',
          userAgent,
          ipAddress,
          browserFingerprint: fingerprint,
          capturedAt: new Date(),
          expiresAt: validation.expiresAt,
          lastValidatedAt: new Date(),
          fbUserName: validation.fbUserId, // Will be updated with actual name if available
        }
      });
    } else {
      // Create new session
      session = await prisma.fbSession.create({
        data: {
          accountId,
          fbUserId: validation.fbUserId,
          encryptedCookies: encryptedCookies.encrypted,
          encryptedLocalStorage: encryptedLocalStorage?.encrypted,
          encryptionSalt: encryptedCookies.salt,
          encryptionIv: encryptedCookies.iv,
          sessionStatus: 'ACTIVE',
          source: 'EXTENSION',
          userAgent,
          ipAddress,
          browserFingerprint: fingerprint,
          expiresAt: validation.expiresAt,
          lastValidatedAt: new Date(),
        }
      });
    }

    // Log security event
    await sessionSecurityService.logSecurityEvent({
      type: SessionSecurityEventType.SESSION_CAPTURED,
      accountId,
      details: {
        sessionId: session.id,
        fbUserId: validation.fbUserId,
        cookieCount: cookies.length,
        source: 'extension'
      },
      ipAddress,
      userAgent
    });

    logger.info('Session captured successfully', {
      sessionId: session.id,
      accountId,
      fbUserId: validation.fbUserId
    });

    res.json({
      success: true,
      sessionId: session.id,
      fbUserId: validation.fbUserId,
      expiresAt: validation.expiresAt,
      status: session.sessionStatus,
      recommendations: validation.recommendations
    });
  } catch (error) {
    logger.error('Session capture error:', error);
    res.status(500).json({ success: false, error: 'Failed to capture session' });
  }
});

/**
 * POST /api/fb-session/sync
 * Sync session from desktop extension to server
 */
router.post('/sync', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { accountId, storageState, source, timestamp }: SyncSessionBody = req.body;

    // Verify user owns account
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId, accountId }
    });

    if (!accountUser) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    // Validate cookies
    const validation = sessionSecurityService.validateCookies(storageState.cookies);
    if (!validation.isValid) {
      res.status(400).json({ 
        success: false, 
        error: validation.reason 
      });
      return;
    }

    // Encrypt session data
    const encryptedCookies = await sessionSecurityService.encrypt(JSON.stringify(storageState.cookies));
    
    let encryptedLocalStorage: { encrypted: string; salt: string; iv: string; authTag: string } | null = null;
    if (storageState.origins && storageState.origins.length > 0) {
      encryptedLocalStorage = await sessionSecurityService.encrypt(JSON.stringify(storageState.origins));
    }

    const ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0] || 
                      req.socket.remoteAddress;

    // Upsert session
    const session = await prisma.fbSession.upsert({
      where: {
        accountId_fbUserId: {
          accountId,
          fbUserId: validation.fbUserId || 'unknown'
        }
      },
      update: {
        encryptedCookies: encryptedCookies.encrypted,
        encryptedLocalStorage: encryptedLocalStorage?.encrypted,
        encryptionSalt: encryptedCookies.salt,
        encryptionIv: encryptedCookies.iv,
        sessionStatus: 'ACTIVE',
        lastSyncedAt: new Date(timestamp),
        expiresAt: validation.expiresAt,
      },
      create: {
        accountId,
        fbUserId: validation.fbUserId,
        encryptedCookies: encryptedCookies.encrypted,
        encryptedLocalStorage: encryptedLocalStorage?.encrypted,
        encryptionSalt: encryptedCookies.salt,
        encryptionIv: encryptedCookies.iv,
        sessionStatus: 'ACTIVE',
        source: source === 'extension' ? 'EXTENSION' : 'SERVER',
        expiresAt: validation.expiresAt,
        lastSyncedAt: new Date(timestamp),
      }
    });

    // Log sync
    await prisma.fbSessionSyncLog.create({
      data: {
        sessionId: session.id,
        direction: source === 'extension' ? 'EXTENSION_TO_SERVER' : 'SERVER_TO_EXTENSION',
        status: 'SUCCESS',
        sourceDevice: req.headers['x-browser-id']?.toString() || 'unknown',
        cookiesCount: storageState.cookies.length,
      }
    });

    // Log security event
    await sessionSecurityService.logSecurityEvent({
      type: SessionSecurityEventType.SESSION_SYNCED,
      accountId,
      details: {
        sessionId: session.id,
        direction: source === 'extension' ? 'to_server' : 'to_extension',
        cookieCount: storageState.cookies.length
      },
      ipAddress
    });

    res.json({ 
      success: true, 
      syncedAt: timestamp,
      sessionId: session.id,
      expiresAt: validation.expiresAt
    });
  } catch (error) {
    logger.error('Session sync error:', error);
    res.status(500).json({ success: false, error: 'Failed to sync session' });
  }
});

/**
 * GET /api/fb-session/status/:accountId
 * Get current session status for an account
 */
router.get('/status/:accountId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const accountId = req.params.accountId as string;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    // Verify access
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId, accountId }
    });

    if (!accountUser) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    // Get active session
    const session = await prisma.fbSession.findFirst({
      where: { 
        accountId,
        sessionStatus: 'ACTIVE'
      },
      include: {
        totpSecret: {
          select: { isVerified: true }
        }
      },
      orderBy: { capturedAt: 'desc' }
    });

    if (!session) {
      res.json({
        success: true,
        hasSession: false,
        status: 'none',
        has2FA: false
      });
      return;
    }

    // Check if session needs refresh
    const needsRefresh = session.expiresAt 
      ? sessionSecurityService.sessionNeedsRefresh(session.expiresAt)
      : true;

    res.json({
      success: true,
      hasSession: true,
      sessionId: session.id,
      fbUserId: session.fbUserId,
      fbUserName: session.fbUserName,
      status: session.sessionStatus,
      source: session.source,
      capturedAt: session.capturedAt,
      expiresAt: session.expiresAt,
      lastValidatedAt: session.lastValidatedAt,
      lastSyncedAt: session.lastSyncedAt,
      has2FA: session.totpSecret?.isVerified || false,
      needsRefresh,
      healthMetrics: {
        validationCount: session.validationCount,
        failedValidations: session.failedValidations,
        successfulTasks: session.successfulTasks,
        failedTasks: session.failedTasks
      }
    });
  } catch (error) {
    logger.error('Session status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get session status' });
  }
});

/**
 * POST /api/fb-session/validate
 * Validate if a session is still active
 */
router.post('/validate', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { sessionId } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    // Get session
    const session = await prisma.fbSession.findUnique({
      where: { id: sessionId },
      include: { account: true }
    });

    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }

    // Verify access
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId, accountId: session.accountId }
    });

    if (!accountUser) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    // Validate session
    const validation = await sessionSecurityService.validateSession(sessionId);

    // Log event
    await sessionSecurityService.logSecurityEvent({
      type: validation.isValid 
        ? SessionSecurityEventType.SESSION_VALIDATED 
        : SessionSecurityEventType.SESSION_VALIDATION_FAILED,
      accountId: session.accountId,
      details: {
        sessionId,
        isValid: validation.isValid,
        reason: validation.reason
      }
    });

    res.json({
      success: true,
      isValid: validation.isValid,
      reason: validation.reason,
      expiresAt: validation.expiresAt,
      recommendations: validation.recommendations
    });
  } catch (error) {
    logger.error('Session validation error:', error);
    res.status(500).json({ success: false, error: 'Failed to validate session' });
  }
});

/**
 * DELETE /api/fb-session/:sessionId
 * Revoke a session
 */
router.delete('/:sessionId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const sessionId = req.params.sessionId as string;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    // Get session
    const session = await prisma.fbSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }

    // Verify access
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId, accountId: session.accountId }
    });

    if (!accountUser) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    // Mark session as invalid and clear encrypted data
    await prisma.fbSession.update({
      where: { id: sessionId },
      data: {
        sessionStatus: 'INVALID',
        encryptedCookies: '', // Clear sensitive data
        encryptedLocalStorage: null,
      }
    });

    // Log security event
    await sessionSecurityService.logSecurityEvent({
      type: SessionSecurityEventType.SESSION_REVOKED,
      accountId: session.accountId,
      details: {
        sessionId,
        revokedBy: userId
      }
    });

    logger.info('Session revoked', { sessionId, accountId: session.accountId, revokedBy: userId });

    res.json({ success: true, message: 'Session revoked' });
  } catch (error) {
    logger.error('Session revoke error:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke session' });
  }
});

// ============================================
// 2FA TOTP Management
// ============================================

/**
 * POST /api/fb-session/totp/setup
 * Setup 2FA for auto-recovery
 */
router.post('/totp/setup', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { existingSecret }: TotpSetupBody = req.body;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    // Get user's account
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId },
      include: { 
        account: true,
        user: { select: { email: true } }
      }
    });

    if (!accountUser) {
      res.status(400).json({ success: false, error: 'No account found' });
      return;
    }

    const accountId = accountUser.accountId;

    // Get active session to get FB user ID
    const session = await prisma.fbSession.findFirst({
      where: { accountId, sessionStatus: 'ACTIVE' }
    });

    if (!session?.fbUserId) {
      res.status(400).json({ 
        success: false, 
        error: 'No active Facebook session found. Please capture a session first.' 
      });
      return;
    }

    // Generate or use existing secret
    const setupResult = await sessionSecurityService.generateTotpSecret(
      accountUser.user.email,
      session.fbUserId
    );

    const secretToUse = existingSecret || setupResult.secret;

    // Encrypt secret
    const encryptedSecret = await sessionSecurityService.encryptTotpSecret(secretToUse);

    // Check for existing TOTP secret
    const existingTotpSecret = await prisma.fbTotpSecret.findUnique({
      where: { accountId }
    });

    let totpSecret;
    if (existingTotpSecret) {
      // Update existing
      totpSecret = await prisma.fbTotpSecret.update({
        where: { id: existingTotpSecret.id },
        data: {
          fbUserId: session.fbUserId,
          encryptedSecret: encryptedSecret.encrypted,
          encryptionSalt: encryptedSecret.salt,
          encryptionIv: encryptedSecret.iv,
          isVerified: false, // Requires re-verification
        }
      });
    } else {
      // Create new
      totpSecret = await prisma.fbTotpSecret.create({
        data: {
          accountId,
          fbUserId: session.fbUserId,
          encryptedSecret: encryptedSecret.encrypted,
          encryptionSalt: encryptedSecret.salt,
          encryptionIv: encryptedSecret.iv,
        }
      });
    }

    // Link session to TOTP secret
    await prisma.fbSession.update({
      where: { id: session.id },
      data: { totpSecretId: totpSecret.id }
    });

    // Log security event
    await sessionSecurityService.logSecurityEvent({
      type: SessionSecurityEventType.TOTP_SETUP,
      accountId,
      details: {
        totpSecretId: totpSecret.id,
        usedExistingSecret: !!existingSecret
      }
    });

    res.json({
      success: true,
      totpSecretId: totpSecret.id,
      qrCodeDataUrl: existingSecret ? undefined : setupResult.qrCodeDataUrl,
      manualEntryKey: existingSecret ? undefined : setupResult.manualEntryKey,
      backupCodes: existingSecret ? undefined : setupResult.backupCodes,
      message: 'Please verify with a TOTP code to complete setup'
    });
  } catch (error) {
    logger.error('TOTP setup error:', error);
    res.status(500).json({ success: false, error: 'Failed to setup 2FA' });
  }
});

/**
 * POST /api/fb-session/totp/verify
 * Verify TOTP code to complete setup
 */
router.post('/totp/verify', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { code }: TotpVerifyBody = req.body;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!code || code.length !== 6) {
      res.status(400).json({ success: false, error: 'Invalid code format' });
      return;
    }

    // Get user's account
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId }
    });

    if (!accountUser) {
      res.status(400).json({ success: false, error: 'No account found' });
      return;
    }

    const accountId = accountUser.accountId;

    // Verify code
    const isValid = await sessionSecurityService.verifyTotpCode(accountId, code);

    if (isValid) {
      // Update session to mark 2FA enabled
      await prisma.fbSession.updateMany({
        where: { accountId, sessionStatus: 'ACTIVE' },
        data: { has2FA: true }
      });

      // Log security event
      await sessionSecurityService.logSecurityEvent({
        type: SessionSecurityEventType.TOTP_VERIFIED,
        accountId,
        details: { verified: true }
      });
    }

    res.json({
      success: isValid,
      message: isValid 
        ? '2FA successfully verified and enabled' 
        : 'Invalid verification code'
    });
  } catch (error) {
    logger.error('TOTP verify error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify code' });
  }
});

/**
 * GET /api/fb-session/totp/generate
 * Generate TOTP code for recovery (internal use)
 * Requires SUPER_ADMIN or worker auth
 */
router.get('/totp/generate/:accountId', 
  authenticate, 
  requireRole(UserRole.SUPER_ADMIN),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const accountId = req.params.accountId as string;

      // Generate code
      const code = await sessionSecurityService.generateTotpCode(accountId);

      if (!code) {
        res.status(400).json({ 
          success: false, 
          error: 'No verified TOTP secret found or secret is locked' 
        });
        return;
      }

      // Log recovery attempt
      const totpSecret = await prisma.fbTotpSecret.findUnique({
        where: { accountId }
      });

      if (totpSecret) {
        await prisma.fbRecoveryLog.create({
          data: {
            totpSecretId: totpSecret.id,
            success: true,
            triggeredBy: 'manual',
          }
        });
      }

      // Log security event
      await sessionSecurityService.logSecurityEvent({
        type: SessionSecurityEventType.TOTP_RECOVERY_USED,
        accountId,
        details: {
          triggeredBy: req.user?.id,
          method: 'manual'
        }
      });

      res.json({
        success: true,
        code,
        validFor: 30, // seconds
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error('TOTP generate error:', error);
      res.status(500).json({ success: false, error: 'Failed to generate code' });
    }
  }
);

/**
 * DELETE /api/fb-session/totp/:accountId
 * Remove TOTP secret
 */
router.delete('/totp/:accountId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const accountId = req.params.accountId as string;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    // Verify access
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId, accountId }
    });

    if (!accountUser) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    // Delete TOTP secret
    await prisma.fbTotpSecret.delete({
      where: { accountId }
    }).catch(() => {
      // Ignore if doesn't exist
    });

    // Update sessions
    await prisma.fbSession.updateMany({
      where: { accountId },
      data: { has2FA: false, totpSecretId: null }
    });

    res.json({ success: true, message: '2FA removed' });
  } catch (error) {
    logger.error('TOTP remove error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove 2FA' });
  }
});

// ============================================
// Internal Endpoints (for Python workers)
// ============================================

/**
 * GET /api/fb-session/internal/export/:accountId
 * Export session for use by Nova workers
 * Requires worker authentication
 */
router.get('/internal/export/:accountId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Verify worker auth token
    const authHeader = req.headers.authorization;
    const workerToken = process.env.WORKER_API_TOKEN;
    
    if (!authHeader || !workerToken || authHeader !== `Bearer ${workerToken}`) {
      res.status(401).json({ success: false, error: 'Invalid worker authentication' });
      return;
    }

    const accountId = req.params.accountId as string;

    // Get active session
    const session = await prisma.fbSession.findFirst({
      where: {
        accountId,
        sessionStatus: 'ACTIVE'
      },
      orderBy: { lastSyncedAt: 'desc' }
    });

    if (!session) {
      res.status(404).json({ success: false, error: 'No active session found' });
      return;
    }

    // Decrypt session data
    const cookies = await sessionSecurityService.decrypt({
      encrypted: session.encryptedCookies,
      salt: session.encryptionSalt,
      iv: session.encryptionIv,
      authTag: ''
    });

    let origins;
    if (session.encryptedLocalStorage) {
      origins = await sessionSecurityService.decrypt({
        encrypted: session.encryptedLocalStorage,
        salt: session.encryptionSalt,
        iv: session.encryptionIv,
        authTag: ''
      });
    }

    // Update last used
    await prisma.fbSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() }
    });

    res.json({
      success: true,
      storageState: {
        cookies: JSON.parse(cookies),
        origins: origins ? JSON.parse(origins) : undefined,
        timestamp: session.lastSyncedAt?.getTime() || session.capturedAt.getTime()
      },
      sessionId: session.id,
      has2FA: session.has2FA
    });
  } catch (error) {
    logger.error('Session export error:', error);
    res.status(500).json({ success: false, error: 'Failed to export session' });
  }
});

export default router;
