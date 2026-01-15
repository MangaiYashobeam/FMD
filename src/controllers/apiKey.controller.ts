import { Response, Request } from 'express';
import { AuthRequest } from '@/middleware/auth';
import { generateApiKey, ApiPermission } from '@/middleware/apiKey';
import prisma from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import type { UserRole } from '@prisma/client';

// Helper to safely get IP address (handles x-forwarded-for being string or array)
const getClientIP = (req: Request | AuthRequest): string | null => {
  // Check x-forwarded-for header first (for proxies)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ip?.trim() || null;
  }
  // Fall back to req.ip
  const ip = req.ip;
  if (typeof ip === 'string') return ip;
  return null;
};

// Allowed admin roles
const ADMIN_ROLES: UserRole[] = ['ACCOUNT_OWNER', 'ADMIN', 'SUPER_ADMIN'];

/**
 * API Key Controller
 * Manage API keys for Chrome Extension and integrations
 */
export class ApiKeyController {
  /**
   * List all API keys for user in account
   */
  async listKeys(req: AuthRequest, res: Response) {
    const accountId = req.query.accountId as string;

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId,
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    const keys = await prisma.apiKey.findMany({
      where: {
        userId: req.user!.id,
        accountId,
      },
      select: {
        id: true,
        name: true,
        permissions: true,
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: keys,
    });
  }

  /**
   * Create new API key
   */
  async createKey(req: AuthRequest, res: Response) {
    const { accountId, name, permissions, expiresAt } = req.body;

    // Verify user has access (must be owner or admin)
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId,
        role: { in: ADMIN_ROLES },
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied - must be owner or admin', 403);
    }

    // Generate key
    const { key, hash } = generateApiKey();

    // Validate permissions
    const validPermissions = Object.values(ApiPermission);
    const requestedPermissions = permissions || [ApiPermission.EXTENSION_POST];
    
    for (const perm of requestedPermissions) {
      if (!validPermissions.includes(perm)) {
        throw new AppError(`Invalid permission: ${perm}`, 400);
      }
    }

    // Create in database
    const apiKey = await prisma.apiKey.create({
      data: {
        name: name || 'Chrome Extension',
        keyHash: hash,
        userId: req.user!.id,
        accountId,
        permissions: requestedPermissions,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    // Log key creation
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'API_KEY_CREATED',
        entityType: 'api_key',
        entityId: apiKey.id,
        ipAddress: getClientIP(req),
        userAgent: req.get('user-agent'),
        metadata: {
          keyName: name,
          permissions: requestedPermissions,
        },
      },
    });

    logger.info(`API key created: ${apiKey.id} by user ${req.user!.id}`);

    // Return the key ONLY ONCE - user must save it
    res.status(201).json({
      success: true,
      data: {
        id: apiKey.id,
        name: apiKey.name,
        key, // This is the only time the full key is returned
        permissions: apiKey.permissions,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      },
      message: 'API key created. Save this key securely - it will not be shown again.',
    });
  }

  /**
   * Update API key (name, permissions, active status)
   */
  async updateKey(req: AuthRequest, res: Response) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { name, permissions, isActive } = req.body;

    if (!id || typeof id !== 'string') {
      throw new AppError('Invalid API key ID', 400);
    }

    // Get existing key
    const existingKey = await prisma.apiKey.findUnique({
      where: { id },
    });

    if (!existingKey) {
      throw new AppError('API key not found', 404);
    }

    // Verify ownership or admin access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: existingKey.accountId,
        role: { in: ADMIN_ROLES },
      },
    });

    if (!hasAccess && existingKey.userId !== req.user!.id) {
      throw new AppError('Access denied', 403);
    }

    // Validate permissions if provided
    if (permissions) {
      const validPermissions = Object.values(ApiPermission);
      for (const perm of permissions) {
        if (!validPermissions.includes(perm)) {
          throw new AppError(`Invalid permission: ${perm}`, 400);
        }
      }
    }

    // Update key
    const updated = await prisma.apiKey.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(permissions !== undefined && { permissions }),
        ...(isActive !== undefined && { isActive }),
      },
      select: {
        id: true,
        name: true,
        permissions: true,
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        updatedAt: true,
      },
    });

    // Log update
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'API_KEY_UPDATED',
        entityType: 'api_key',
        entityId: id,
        ipAddress: getClientIP(req),
        metadata: { changes: { name, permissions, isActive } },
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  }

  /**
   * Revoke (delete) API key
   */
  async revokeKey(req: AuthRequest, res: Response) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id || typeof id !== 'string') {
      throw new AppError('Invalid API key ID', 400);
    }

    // Get existing key
    const existingKey = await prisma.apiKey.findUnique({
      where: { id },
    });

    if (!existingKey) {
      throw new AppError('API key not found', 404);
    }

    // Verify ownership or admin access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: existingKey.accountId,
        role: { in: ADMIN_ROLES },
      },
    });

    if (!hasAccess && existingKey.userId !== req.user!.id) {
      throw new AppError('Access denied', 403);
    }

    // Delete key
    await prisma.apiKey.delete({
      where: { id },
    });

    // Log deletion
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'API_KEY_REVOKED',
        entityType: 'api_key',
        entityId: id,
        ipAddress: getClientIP(req),
        metadata: { keyName: existingKey.name },
      },
    });

    logger.info(`API key revoked: ${id} by user ${req.user!.id}`);

    res.json({
      success: true,
      message: 'API key revoked successfully',
    });
  }

  /**
   * Get available permissions
   */
  async getPermissions(_req: AuthRequest, res: Response) {
    res.json({
      success: true,
      data: Object.entries(ApiPermission).map(([key, value]) => ({
        name: key,
        value,
        description: getPermissionDescription(value),
      })),
    });
  }
}

/**
 * Get human-readable permission description
 */
function getPermissionDescription(permission: string): string {
  const descriptions: Record<string, string> = {
    [ApiPermission.READ_VEHICLES]: 'Read vehicle inventory',
    [ApiPermission.WRITE_VEHICLES]: 'Create and update vehicles',
    [ApiPermission.READ_POSTS]: 'View Facebook posts',
    [ApiPermission.WRITE_POSTS]: 'Create and manage posts',
    [ApiPermission.READ_ACCOUNT]: 'Read account information',
    [ApiPermission.EXTENSION_POST]: 'Chrome extension posting capability',
    [ApiPermission.EXTENSION_SYNC]: 'Chrome extension sync capability',
    [ApiPermission.ALL]: 'Full access to all operations',
  };
  return descriptions[permission] || 'Unknown permission';
}
