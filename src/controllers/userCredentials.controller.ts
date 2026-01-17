import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

/**
 * UserCredentialsController
 * 
 * NOTE: This feature requires database migration. The following columns
 * need to be added to the users table:
 * - fb_username
 * - fb_password
 * - fb_2fa_codes
 * - fb_last_sync
 * 
 * Run `npx prisma migrate deploy` on production to enable this feature.
 */
export class UserCredentialsController {
  private readonly FEATURE_UNAVAILABLE_MSG = 'Facebook credentials feature requires database migration. Please contact support.';

  /**
   * Get user's Facebook credentials (decrypted)
   */
  async getCredentials(_req: AuthRequest, res: Response) {
    logger.warn('UserCredentialsController.getCredentials called but feature is disabled');
    throw new AppError(this.FEATURE_UNAVAILABLE_MSG, 503);
  }

  /**
   * Update user's Facebook credentials
   */
  async updateCredentials(_req: AuthRequest, res: Response) {
    logger.warn('UserCredentialsController.updateCredentials called but feature is disabled');
    throw new AppError(this.FEATURE_UNAVAILABLE_MSG, 503);
  }

  /**
   * Delete user's Facebook credentials
   */
  async deleteCredentials(_req: AuthRequest, res: Response) {
    logger.warn('UserCredentialsController.deleteCredentials called but feature is disabled');
    throw new AppError(this.FEATURE_UNAVAILABLE_MSG, 503);
  }

  /**
   * Use a 2FA code (mark as used by removing it from the list)
   */
  async use2FACode(_req: AuthRequest, res: Response) {
    logger.warn('UserCredentialsController.use2FACode called but feature is disabled');
    throw new AppError(this.FEATURE_UNAVAILABLE_MSG, 503);
  }

  /**
   * Get next available 2FA code without marking it as used
   */
  async getNext2FACode(_req: AuthRequest, res: Response) {
    logger.warn('UserCredentialsController.getNext2FACode called but feature is disabled');
    throw new AppError(this.FEATURE_UNAVAILABLE_MSG, 503);
  }

  /**
   * Add new 2FA codes to the list
   */
  async add2FACodes(_req: AuthRequest, res: Response) {
    logger.warn('UserCredentialsController.add2FACodes called but feature is disabled');
    throw new AppError(this.FEATURE_UNAVAILABLE_MSG, 503);
  }
}

export const userCredentialsController = new UserCredentialsController();
