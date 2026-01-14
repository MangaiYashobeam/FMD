import { Response } from 'express';
import prisma from '@/config/database';
import { AuthRequest } from '@/middleware/auth';
import { AppError } from '@/middleware/errorHandler';
import { encryptionService } from '@/services/encryption.service';
import { logger } from '@/utils/logger';

export class UserCredentialsController {
  /**
   * Get user's Facebook credentials (decrypted)
   */
  async getCredentials(req: AuthRequest, res: Response) {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        fbUsername: true,
        fbPassword: true,
        fb2faCodes: true,
        fbLastSync: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Decrypt credentials before sending
    const credentials = {
      username: user.fbUsername ? encryptionService.decrypt(user.fbUsername) : null,
      password: user.fbPassword ? encryptionService.decrypt(user.fbPassword) : null,
      twoFactorCodes: user.fb2faCodes.length > 0 
        ? encryptionService.decryptArray(user.fb2faCodes) 
        : [],
      lastSync: user.fbLastSync,
      hasCredentials: !!(user.fbUsername && user.fbPassword),
    };

    logger.info(`Facebook credentials accessed by user ${userId}`);

    res.json({
      success: true,
      data: credentials,
    });
  }

  /**
   * Update user's Facebook credentials
   */
  async updateCredentials(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const { username, password, twoFactorCodes } = req.body;

    if (!username || !password) {
      throw new AppError('Username and password are required', 400);
    }

    // Validate email format for username
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(username)) {
      throw new AppError('Invalid email format for username', 400);
    }

    // Validate 2FA codes if provided
    if (twoFactorCodes && !Array.isArray(twoFactorCodes)) {
      throw new AppError('twoFactorCodes must be an array', 400);
    }

    // Encrypt credentials
    const encryptedUsername = encryptionService.encrypt(username);
    const encryptedPassword = encryptionService.encrypt(password);
    const encrypted2FACodes = twoFactorCodes 
      ? encryptionService.encryptArray(twoFactorCodes.filter((code: string) => code.trim()))
      : [];

    await prisma.user.update({
      where: { id: userId },
      data: {
        fbUsername: encryptedUsername,
        fbPassword: encryptedPassword,
        fb2faCodes: encrypted2FACodes,
        fbLastSync: new Date(),
      },
    });

    logger.info(`Facebook credentials updated for user ${userId}`);

    // Log credential update in audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE_FB_CREDENTIALS',
        entityType: 'USER',
        entityId: userId,
        metadata: {
          hasUsername: !!username,
          hasPassword: !!password,
          twoFactorCodesCount: encrypted2FACodes.length,
        },
      },
    });

    res.json({
      success: true,
      message: 'Facebook credentials updated successfully',
      data: {
        hasCredentials: true,
        twoFactorCodesCount: encrypted2FACodes.length,
      },
    });
  }

  /**
   * Delete user's Facebook credentials
   */
  async deleteCredentials(req: AuthRequest, res: Response) {
    const userId = req.user!.id;

    await prisma.user.update({
      where: { id: userId },
      data: {
        fbUsername: null,
        fbPassword: null,
        fb2faCodes: [],
        fbLastSync: null,
      },
    });

    logger.info(`Facebook credentials deleted for user ${userId}`);

    // Log credential deletion in audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'DELETE_FB_CREDENTIALS',
        entityType: 'USER',
        entityId: userId,
      },
    });

    res.json({
      success: true,
      message: 'Facebook credentials deleted successfully',
    });
  }

  /**
   * Use a 2FA code (mark as used by removing it from the list)
   */
  async use2FACode(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const { code } = req.body;

    if (!code) {
      throw new AppError('2FA code is required', 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fb2faCodes: true },
    });

    if (!user || user.fb2faCodes.length === 0) {
      throw new AppError('No 2FA codes available', 404);
    }

    // Decrypt all codes
    const decrypted2FACodes = encryptionService.decryptArray(user.fb2faCodes);

    // Find and remove the used code
    const codeIndex = decrypted2FACodes.indexOf(code);
    
    if (codeIndex === -1) {
      throw new AppError('Invalid 2FA code', 400);
    }

    // Remove the used code
    decrypted2FACodes.splice(codeIndex, 1);

    // Re-encrypt remaining codes
    const encrypted2FACodes = encryptionService.encryptArray(decrypted2FACodes);

    await prisma.user.update({
      where: { id: userId },
      data: {
        fb2faCodes: encrypted2FACodes,
      },
    });

    logger.info(`2FA code used for user ${userId}, ${decrypted2FACodes.length} codes remaining`);

    res.json({
      success: true,
      message: '2FA code marked as used',
      data: {
        remainingCodes: decrypted2FACodes.length,
        warning: decrypted2FACodes.length < 2 
          ? 'Low on backup codes! Please generate new codes soon.' 
          : null,
      },
    });
  }

  /**
   * Get next available 2FA code without marking it as used
   */
  async getNext2FACode(req: AuthRequest, res: Response) {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fb2faCodes: true },
    });

    if (!user || user.fb2faCodes.length === 0) {
      throw new AppError('No 2FA codes available', 404);
    }

    // Decrypt and return the first available code
    const decrypted2FACodes = encryptionService.decryptArray(user.fb2faCodes);
    const nextCode = decrypted2FACodes[0];

    res.json({
      success: true,
      data: {
        code: nextCode,
        totalCodes: decrypted2FACodes.length,
      },
    });
  }

  /**
   * Add new 2FA codes to the list
   */
  async add2FACodes(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const { codes } = req.body;

    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      throw new AppError('Codes array is required and must not be empty', 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fb2faCodes: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Decrypt existing codes
    const existing2FACodes = user.fb2faCodes.length > 0 
      ? encryptionService.decryptArray(user.fb2faCodes) 
      : [];

    // Filter and add new codes
    const newCodes = codes
      .map((code: string) => code.trim())
      .filter((code: string) => code && !existing2FACodes.includes(code));

    if (newCodes.length === 0) {
      throw new AppError('No new valid codes to add', 400);
    }

    // Combine and encrypt
    const allCodes = [...existing2FACodes, ...newCodes];
    const encrypted2FACodes = encryptionService.encryptArray(allCodes);

    await prisma.user.update({
      where: { id: userId },
      data: {
        fb2faCodes: encrypted2FACodes,
      },
    });

    logger.info(`Added ${newCodes.length} new 2FA codes for user ${userId}`);

    res.json({
      success: true,
      message: `Added ${newCodes.length} new backup codes`,
      data: {
        totalCodes: allCodes.length,
        addedCodes: newCodes.length,
      },
    });
  }
}

export const userCredentialsController = new UserCredentialsController();
