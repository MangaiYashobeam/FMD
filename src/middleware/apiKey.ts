import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '@/config/database';
import { AppError } from './errorHandler';
import { logger } from '@/utils/logger';

/**
 * API Key Authentication Middleware
 * For Chrome Extension and external API integrations
 */

export interface ApiKeyRequest extends Request {
  apiKey?: {
    id: string;
    name: string;
    userId: string;
    accountId: string;
    permissions: string[];
  };
}

/**
 * Generate a new API key
 */
export const generateApiKey = (): { key: string; hash: string } => {
  // Generate 32-byte random key
  const key = `fmd_${crypto.randomBytes(32).toString('hex')}`;
  // Hash for storage
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return { key, hash };
};

/**
 * Validate API key format
 */
const isValidApiKeyFormat = (key: string): boolean => {
  return /^fmd_[a-f0-9]{64}$/.test(key);
};

/**
 * API Key Authentication Middleware
 * Supports both header (X-API-Key) and query parameter (api_key)
 */
export const authenticateApiKey = async (
  req: ApiKeyRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    // Get API key from header or query
    const apiKeyRaw = 
      req.headers['x-api-key'] as string ||
      req.query.api_key as string;

    if (!apiKeyRaw) {
      throw new AppError('API key required', 401);
    }

    // Validate format
    if (!isValidApiKeyFormat(apiKeyRaw)) {
      throw new AppError('Invalid API key format', 401);
    }

    // Hash the provided key to compare with stored hash
    const keyHash = crypto.createHash('sha256').update(apiKeyRaw).digest('hex');

    // Find API key in database
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
          },
        },
        account: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    if (!apiKey) {
      logger.warn('Invalid API key used', {
        ip: req.ip,
        path: req.path,
        keyPrefix: apiKeyRaw.substring(0, 10),
      });
      throw new AppError('Invalid API key', 401);
    }

    // Check if key is active
    if (!apiKey.isActive) {
      throw new AppError('API key is disabled', 401);
    }

    // Check if key is expired
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      throw new AppError('API key has expired', 401);
    }

    // Check if user and account are active
    if (!apiKey.user.isActive) {
      throw new AppError('User account is inactive', 401);
    }

    if (!apiKey.account.isActive) {
      throw new AppError('Account is inactive', 401);
    }

    // Update last used timestamp
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    // Attach API key info to request
    req.apiKey = {
      id: apiKey.id,
      name: apiKey.name,
      userId: apiKey.userId,
      accountId: apiKey.accountId,
      permissions: apiKey.permissions as string[],
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Check if API key has specific permission
 */
export const requireApiPermission = (permission: string) => {
  return (req: ApiKeyRequest, _res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return next(new AppError('API key authentication required', 401));
    }

    if (!req.apiKey.permissions.includes(permission) && !req.apiKey.permissions.includes('*')) {
      logger.warn('API key permission denied', {
        keyId: req.apiKey.id,
        requiredPermission: permission,
        actualPermissions: req.apiKey.permissions,
      });
      return next(new AppError('Insufficient API key permissions', 403));
    }

    next();
  };
};

/**
 * API Key permissions enum
 */
export enum ApiPermission {
  READ_VEHICLES = 'read:vehicles',
  WRITE_VEHICLES = 'write:vehicles',
  READ_POSTS = 'read:posts',
  WRITE_POSTS = 'write:posts',
  READ_ACCOUNT = 'read:account',
  EXTENSION_POST = 'extension:post',
  EXTENSION_SYNC = 'extension:sync',
  ALL = '*',
}

export default {
  authenticateApiKey,
  requireApiPermission,
  generateApiKey,
  ApiPermission,
};
