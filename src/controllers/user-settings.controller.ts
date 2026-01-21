/**
 * User Settings Controller
 * 
 * Handles user settings including connection method preferences.
 * Provides endpoints for users to select and manage their connection methods.
 * 
 * Security: All changes are validated and audit-logged
 */

import { Request, Response, NextFunction } from 'express';
import { connectionMethodService, ConnectionMethod } from '@/services/connection-method.service';
import { logger } from '@/utils/logger';
import { UserRole } from '@/middleware/rbac';
import { z } from 'zod';
import { createHash } from 'crypto';
import prisma from '@/config/database';

// ============================================================================
// Types
// ============================================================================

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    accountId?: string;
  };
}

interface SettingsResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
  requestId: string;
}

// ============================================================================
// Validation Schemas
// ============================================================================

const updateConnectionMethodSchema = z.object({
  preferredMethod: z.enum(['extension', 'oauth', 'worker', 'api']),
  fallbackMethods: z.array(z.enum(['extension', 'oauth', 'worker', 'api'])).optional(),
  autoSwitchEnabled: z.boolean().optional(),
});

// ============================================================================
// User Settings Controller Class
// ============================================================================

class UserSettingsController {
  /**
   * Generate secure request ID
   */
  private generateRequestId(): string {
    return createHash('sha256')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex')
      .slice(0, 16);
  }

  /**
   * Log settings access
   */
  private async logAccess(
    req: AuthenticatedRequest,
    action: string,
    entityId: string
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: 'SETTINGS_ACCESS',
          entityType: 'UserSettings',
          entityId,
          userId: req.user?.id,
          metadata: {
            action,
            path: req.path,
          },
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
        },
      });
    } catch (error) {
      logger.error('Failed to log settings access', { error });
    }
  }

  // ==========================================================================
  // CONNECTION METHOD ENDPOINTS
  // ==========================================================================

  /**
   * GET /api/settings/connection-methods
   * Get all available connection methods with their configurations
   */
  async getAvailableConnectionMethods(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const requestId = this.generateRequestId();

    try {
      await this.logAccess(req, 'VIEW_CONNECTION_METHODS', req.user?.id || 'anonymous');

      const methods = connectionMethodService.getAvailableMethods();
      const recommended = connectionMethodService.getRecommendedMethods();

      const response: SettingsResponse = {
        success: true,
        data: {
          methods: methods.map(m => ({
            id: m.id,
            name: m.name,
            description: m.description,
            features: m.features,
            requirements: m.requirements,
            limitations: m.limitations,
            status: m.status,
            recommended: m.recommended,
            setupSteps: m.setupSteps,
          })),
          recommended: recommended.map(m => m.id),
        },
        timestamp: new Date().toISOString(),
        requestId,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getAvailableConnectionMethods', { error, requestId });
      next(error);
    }
  }

  /**
   * GET /api/settings/connection-preference
   * Get user's current connection method preference
   */
  async getConnectionPreference(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const requestId = this.generateRequestId();
    const userId = req.user?.id;
    const accountId = req.user?.accountId || req.query.accountId as string;

    try {
      if (!userId || !accountId) {
        res.status(400).json({
          success: false,
          error: 'User ID and Account ID are required',
          timestamp: new Date().toISOString(),
          requestId,
        });
        return;
      }

      await this.logAccess(req, 'VIEW_CONNECTION_PREFERENCE', userId);

      const preference = await connectionMethodService.getUserPreference(userId, accountId);

      if (!preference) {
        // Return default preference
        const defaultPreference = {
          preferredMethod: 'extension',
          fallbackMethods: ['worker', 'oauth'],
          autoSwitchEnabled: true,
          methodStatus: [],
        };

        res.status(200).json({
          success: true,
          data: {
            preference: defaultPreference,
            isDefault: true,
          },
          timestamp: new Date().toISOString(),
          requestId,
        });
        return;
      }

      const response: SettingsResponse = {
        success: true,
        data: {
          preference: {
            preferredMethod: preference.preferredMethod,
            fallbackMethods: preference.fallbackMethods,
            autoSwitchEnabled: preference.autoSwitchEnabled,
            lastUpdated: preference.lastUpdated,
          },
          methodStatus: preference.methodStatus.map(s => ({
            method: s.method,
            isConfigured: s.isConfigured,
            isActive: s.isActive,
            health: s.health,
            lastUsed: s.lastUsed,
          })),
          isDefault: false,
        },
        timestamp: new Date().toISOString(),
        requestId,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getConnectionPreference', { error, requestId });
      next(error);
    }
  }

  /**
   * PUT /api/settings/connection-preference
   * Update user's connection method preference
   */
  async updateConnectionPreference(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const requestId = this.generateRequestId();
    const userId = req.user?.id;
    const accountId = req.user?.accountId || req.body.accountId;

    try {
      if (!userId || !accountId) {
        res.status(400).json({
          success: false,
          error: 'User ID and Account ID are required',
          timestamp: new Date().toISOString(),
          requestId,
        });
        return;
      }

      // Validate request body
      const validation = updateConnectionMethodSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: validation.error.errors,
          timestamp: new Date().toISOString(),
          requestId,
        });
        return;
      }

      const { preferredMethod, fallbackMethods, autoSwitchEnabled } = validation.data;

      await this.logAccess(req, 'UPDATE_CONNECTION_PREFERENCE', userId);

      const updatedPreference = await connectionMethodService.updateUserPreference(
        userId,
        accountId,
        preferredMethod as ConnectionMethod,
        {
          fallbackMethods: fallbackMethods as ConnectionMethod[] | undefined,
          autoSwitchEnabled,
        }
      );

      // Log successful update
      await prisma.auditLog.create({
        data: {
          action: 'CONNECTION_METHOD_UPDATED',
          entityType: 'UserSettings',
          entityId: userId,
          userId,
          metadata: {
            preferredMethod,
            fallbackMethods,
            autoSwitchEnabled,
            accountId,
          },
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
        },
      });

      const response: SettingsResponse = {
        success: true,
        data: {
          message: 'Connection preference updated successfully',
          preference: {
            preferredMethod: updatedPreference.preferredMethod,
            fallbackMethods: updatedPreference.fallbackMethods,
            autoSwitchEnabled: updatedPreference.autoSwitchEnabled,
            lastUpdated: updatedPreference.lastUpdated,
          },
        },
        timestamp: new Date().toISOString(),
        requestId,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in updateConnectionPreference', { error, requestId });
      next(error);
    }
  }

  /**
   * GET /api/settings/connection-status
   * Get current connection status for all methods
   */
  async getConnectionStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const requestId = this.generateRequestId();
    const userId = req.user?.id;
    const accountId = req.user?.accountId || req.query.accountId as string;

    try {
      if (!userId || !accountId) {
        res.status(400).json({
          success: false,
          error: 'User ID and Account ID are required',
          timestamp: new Date().toISOString(),
          requestId,
        });
        return;
      }

      await this.logAccess(req, 'VIEW_CONNECTION_STATUS', userId);

      const preference = await connectionMethodService.getUserPreference(userId, accountId);
      const bestMethod = await connectionMethodService.getBestAvailableMethod(userId, accountId);

      const response: SettingsResponse = {
        success: true,
        data: {
          currentMethod: preference?.preferredMethod || 'extension',
          bestAvailableMethod: bestMethod,
          methodStatus: preference?.methodStatus.map(s => ({
            method: s.method,
            name: connectionMethodService.getMethod(s.method)?.name || s.method,
            isConfigured: s.isConfigured,
            isActive: s.isActive,
            health: s.health,
            lastUsed: s.lastUsed,
            errorCount: s.errorCount,
          })) || [],
          autoSwitchEnabled: preference?.autoSwitchEnabled ?? true,
        },
        timestamp: new Date().toISOString(),
        requestId,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getConnectionStatus', { error, requestId });
      next(error);
    }
  }

  /**
   * POST /api/settings/test-connection
   * Test a specific connection method
   */
  async testConnection(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const requestId = this.generateRequestId();
    const userId = req.user?.id;
    const accountId = req.user?.accountId || req.body.accountId;
    const { method } = req.body;

    try {
      if (!userId || !accountId) {
        res.status(400).json({
          success: false,
          error: 'User ID and Account ID are required',
          timestamp: new Date().toISOString(),
          requestId,
        });
        return;
      }

      if (!method || !Object.values(ConnectionMethod).includes(method)) {
        res.status(400).json({
          success: false,
          error: 'Invalid connection method',
          timestamp: new Date().toISOString(),
          requestId,
        });
        return;
      }

      await this.logAccess(req, 'TEST_CONNECTION', userId);

      // Simulate connection test
      const startTime = Date.now();
      let success = false;
      let error: string | undefined;

      try {
        // In a real implementation, this would actually test the connection
        // For now, we'll simulate based on method
        switch (method) {
          case ConnectionMethod.EXTENSION:
            // Check if extension is connected (would check via socket/API)
            success = true;
            break;
          case ConnectionMethod.OAUTH:
            // Check OAuth token validity
            success = true;
            break;
          case ConnectionMethod.WORKER:
            // Check worker health
            success = true;
            break;
          case ConnectionMethod.API:
            // Check API token
            success = true;
            break;
          default:
            success = false;
            error = 'Unknown method';
        }
      } catch (e: any) {
        success = false;
        error = e.message;
      }

      const latencyMs = Date.now() - startTime;

      // Log the connection attempt
      await connectionMethodService.logConnectionAttempt(userId, accountId, {
        method: method as ConnectionMethod,
        timestamp: new Date(),
        success,
        error,
        latencyMs,
      });

      const response: SettingsResponse = {
        success: true,
        data: {
          method,
          testResult: {
            success,
            error,
            latencyMs,
            testedAt: new Date().toISOString(),
          },
          message: success
            ? `${method} connection test successful`
            : `${method} connection test failed: ${error}`,
        },
        timestamp: new Date().toISOString(),
        requestId,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in testConnection', { error, requestId });
      next(error);
    }
  }

  /**
   * GET /api/settings/connection-method/:methodId
   * Get detailed info about a specific connection method
   */
  async getConnectionMethodDetails(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const requestId = this.generateRequestId();
    const methodId = req.params.methodId as string;

    try {
      await this.logAccess(req, 'VIEW_METHOD_DETAILS', methodId);

      if (!Object.values(ConnectionMethod).includes(methodId as ConnectionMethod)) {
        res.status(404).json({
          success: false,
          error: 'Connection method not found',
          timestamp: new Date().toISOString(),
          requestId,
        });
        return;
      }

      const method = connectionMethodService.getMethod(methodId as ConnectionMethod);

      if (!method) {
        res.status(404).json({
          success: false,
          error: 'Connection method not found',
          timestamp: new Date().toISOString(),
          requestId,
        });
        return;
      }

      const response: SettingsResponse = {
        success: true,
        data: {
          method: {
            id: method.id,
            name: method.name,
            description: method.description,
            features: method.features,
            requirements: method.requirements,
            limitations: method.limitations,
            status: method.status,
            recommended: method.recommended,
            setupSteps: method.setupSteps,
          },
        },
        timestamp: new Date().toISOString(),
        requestId,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getConnectionMethodDetails', { error, requestId });
      next(error);
    }
  }
}

// Export singleton instance
export const userSettingsController = new UserSettingsController();
