/**
 * Two-Factor Authentication Routes
 * Handles 2FA setup, verification, and management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { twoFactorService } from '@/services/two-factor.service';
import { securityAuditService, SecurityEventType } from '@/services/security-audit.service';
import { authenticate } from '@/middleware/auth';
import { body, validationResult } from 'express-validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/auth/2fa/status
 * Check if 2FA is enabled for current user
 */
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const isEnabled = await twoFactorService.isEnabled(userId);
    const backupCodeCount = isEnabled ? await twoFactorService.getBackupCodeCount(userId) : 0;
    
    res.json({
      success: true,
      data: {
        enabled: isEnabled,
        backupCodesRemaining: backupCodeCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/2fa/setup
 * Generate new 2FA secret and QR code
 */
router.post('/setup', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    
    // Check if 2FA is already enabled
    const isEnabled = await twoFactorService.isEnabled(userId);
    if (isEnabled) {
      res.status(400).json({
        success: false,
        error: 'Two-factor authentication is already enabled. Disable it first to set up again.',
      });
      return;
    }
    
    // Generate new secret
    const { secret, otpAuthUrl, backupCodes } = twoFactorService.generateSecret();
    
    // Store temporarily in session or return for client-side handling
    // Note: Secret should NOT be stored until user verifies it works
    res.json({
      success: true,
      data: {
        secret,
        otpAuthUrl,
        backupCodes,
        message: 'Scan the QR code with your authenticator app, then verify with a code to complete setup.',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/2fa/enable
 * Verify and enable 2FA
 */
router.post('/enable', [
  body('secret').notEmpty().withMessage('Secret is required'),
  body('code').isLength({ min: 6, max: 6 }).withMessage('Code must be 6 digits'),
  body('backupCodes').isArray({ min: 10 }).withMessage('Backup codes are required'),
], async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }
    
    const userId = (req as any).user.id;
    const { secret, code, backupCodes } = req.body;
    
    const success = await twoFactorService.enable(userId, secret, code, backupCodes);
    
    if (!success) {
      await securityAuditService.logFromRequest(req, SecurityEventType.TWO_FA_FAILED, {
        success: false,
        details: { reason: 'Invalid verification code during setup' },
      });
      
      res.status(400).json({
        success: false,
        error: 'Invalid verification code. Please try again.',
      });
      return;
    }
    
    await securityAuditService.logFromRequest(req, SecurityEventType.TWO_FA_ENABLED, {
      details: { method: 'TOTP' },
    });
    
    res.json({
      success: true,
      message: 'Two-factor authentication has been enabled successfully.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/2fa/disable
 * Disable 2FA
 */
router.post('/disable', [
  body('code').notEmpty().withMessage('Verification code is required'),
], async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }
    
    const userId = (req as any).user.id;
    const { code } = req.body;
    
    const success = await twoFactorService.disable(userId, code);
    
    if (!success) {
      await securityAuditService.logFromRequest(req, SecurityEventType.TWO_FA_FAILED, {
        success: false,
        details: { reason: 'Invalid code during disable attempt' },
      });
      
      res.status(400).json({
        success: false,
        error: 'Invalid verification code. Two-factor authentication was not disabled.',
      });
      return;
    }
    
    await securityAuditService.logFromRequest(req, SecurityEventType.TWO_FA_DISABLED);
    
    res.json({
      success: true,
      message: 'Two-factor authentication has been disabled.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/2fa/verify
 * Verify 2FA code during login
 */
router.post('/verify', [
  body('code').notEmpty().withMessage('Verification code is required'),
], async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }
    
    const userId = (req as any).user.id;
    const { code } = req.body;
    
    const result = await twoFactorService.verify(userId, code);
    
    if (!result.success) {
      await securityAuditService.logFromRequest(req, SecurityEventType.TWO_FA_FAILED, {
        success: false,
        details: { reason: 'Invalid verification code' },
      });
      
      res.status(401).json({
        success: false,
        error: 'Invalid verification code.',
      });
      return;
    }
    
    await securityAuditService.logFromRequest(req, SecurityEventType.TWO_FA_VERIFIED, {
      details: { method: result.method },
    });
    
    res.json({
      success: true,
      method: result.method,
      message: result.method === 'backup' 
        ? 'Verified with backup code. Consider regenerating your backup codes.'
        : 'Verification successful.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/2fa/backup-codes/regenerate
 * Generate new backup codes
 */
router.post('/backup-codes/regenerate', [
  body('code').isLength({ min: 6, max: 6 }).withMessage('Current TOTP code is required'),
], async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }
    
    const userId = (req as any).user.id;
    const { code } = req.body;
    
    const newCodes = await twoFactorService.regenerateBackupCodes(userId, code);
    
    if (!newCodes) {
      res.status(400).json({
        success: false,
        error: 'Invalid verification code. Backup codes were not regenerated.',
      });
      return;
    }
    
    await securityAuditService.logFromRequest(req, SecurityEventType.TWO_FA_ENABLED, {
      details: { action: 'backup_codes_regenerated' },
    });
    
    res.json({
      success: true,
      data: {
        backupCodes: newCodes,
        message: 'New backup codes generated. Store them safely - this is the only time they will be shown.',
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
