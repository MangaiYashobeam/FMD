/**
 * Connection Method Service
 * 
 * Manages user connection method preferences and status.
 * Supports: Extension, OAuth, Worker/Soldier, Direct API
 * 
 * Note: Preferences are stored in Redis for fast access
 * Security: All method changes are audit-logged
 */

import prisma from '@/config/database';
import { logger } from '@/utils/logger';
import Redis from 'ioredis';

// ============================================================================
// Types & Interfaces
// ============================================================================

export enum ConnectionMethod {
  EXTENSION = 'extension',
  OAUTH = 'oauth',
  WORKER = 'worker',
  API = 'api',
}

export interface ConnectionMethodConfig {
  id: ConnectionMethod;
  name: string;
  description: string;
  features: string[];
  requirements: string[];
  limitations: string[];
  status: 'available' | 'maintenance' | 'deprecated';
  recommended: boolean;
  setupSteps: SetupStep[];
}

export interface SetupStep {
  order: number;
  title: string;
  description: string;
  action?: string;
}

export interface UserConnectionPreference {
  userId: string;
  accountId: string;
  preferredMethod: ConnectionMethod;
  fallbackMethods: ConnectionMethod[];
  autoSwitchEnabled: boolean;
  lastUpdated: Date;
  methodStatus: MethodStatus[];
}

export interface MethodStatus {
  method: ConnectionMethod;
  isConfigured: boolean;
  isActive: boolean;
  lastUsed: Date | null;
  health: 'healthy' | 'degraded' | 'offline';
  errorCount: number;
}

export interface ConnectionAttempt {
  method: ConnectionMethod;
  timestamp: Date;
  success: boolean;
  error?: string;
  latencyMs?: number;
}

// ============================================================================
// Connection Method Configurations
// ============================================================================

const CONNECTION_METHODS: ConnectionMethodConfig[] = [
  {
    id: ConnectionMethod.EXTENSION,
    name: 'Browser Extension',
    description: 'Connect via Chrome extension for real-time automation with your browser session',
    features: [
      'Real-time posting using browser session',
      'Automatic session persistence',
      'Smart retry on failures',
      'Visual confirmation of posts',
      'Natural human-like behavior',
    ],
    requirements: [
      'Chrome browser (latest version)',
      'FaceMyDealer extension installed',
      'Facebook logged in on browser',
    ],
    limitations: [
      'Requires browser to be open',
      'Limited to one browser session',
      'Manual token refresh may be needed',
    ],
    status: 'available',
    recommended: true,
    setupSteps: [
      { order: 1, title: 'Install Extension', description: 'Download and install the Chrome extension', action: 'install_extension' },
      { order: 2, title: 'Login to Facebook', description: 'Log in to Facebook in your Chrome browser' },
      { order: 3, title: 'Connect Account', description: 'Click the extension icon and connect your account' },
      { order: 4, title: 'Verify Connection', description: 'Check that the extension shows "Connected" status' },
    ],
  },
  {
    id: ConnectionMethod.OAUTH,
    name: 'Facebook OAuth',
    description: 'Connect via official Facebook OAuth flow using Graph API',
    features: [
      'Official Facebook API integration',
      'Secure OAuth 2.0 authentication',
      'Access to Pages and Groups',
      'Stable API endpoints',
    ],
    requirements: [
      'Facebook Business account',
      'App permissions granted',
      'Valid access tokens',
    ],
    limitations: [
      'Rate limited by Facebook',
      'Limited to official API features',
      'Requires periodic token refresh',
      'May not support all posting features',
    ],
    status: 'available',
    recommended: false,
    setupSteps: [
      { order: 1, title: 'Start OAuth Flow', description: 'Click to begin Facebook authorization', action: 'start_oauth' },
      { order: 2, title: 'Grant Permissions', description: 'Allow FaceMyDealer to access your Facebook account' },
      { order: 3, title: 'Select Pages/Groups', description: 'Choose which Pages and Groups to connect' },
      { order: 4, title: 'Complete Setup', description: 'Finish the connection process' },
    ],
  },
  {
    id: ConnectionMethod.WORKER,
    name: 'Worker/Soldier',
    description: 'Connect via headless Python worker for high-throughput automation',
    features: [
      'Headless browser automation',
      'High throughput posting',
      'Scalable to multiple workers',
      'Background operation (no browser needed)',
      '24/7 automated posting',
      'Smart scheduling and queuing',
    ],
    requirements: [
      'Worker deployment configured',
      'Valid Facebook credentials',
      'Server/VPS with Python installed',
    ],
    limitations: [
      'Requires server setup',
      'Higher detection risk if not configured properly',
      'Requires credential management',
    ],
    status: 'available',
    recommended: true,
    setupSteps: [
      { order: 1, title: 'Deploy Worker', description: 'Set up a Python worker on your server', action: 'deploy_worker' },
      { order: 2, title: 'Configure Credentials', description: 'Securely add Facebook credentials to worker' },
      { order: 3, title: 'Start Worker', description: 'Launch the worker process' },
      { order: 4, title: 'Monitor Status', description: 'Check worker health in dashboard' },
    ],
  },
  {
    id: ConnectionMethod.API,
    name: 'Direct API',
    description: 'Connect via direct API integration with access tokens',
    features: [
      'Fast API calls',
      'Low latency posting',
      'Simple integration',
      'Programmatic access',
    ],
    requirements: [
      'Valid access tokens',
      'API knowledge',
      'Token refresh mechanism',
    ],
    limitations: [
      'Limited to API-supported features',
      'Requires manual token management',
      'May have stability issues',
      'Not recommended for production',
    ],
    status: 'available',
    recommended: false,
    setupSteps: [
      { order: 1, title: 'Generate Token', description: 'Create a long-lived access token', action: 'generate_token' },
      { order: 2, title: 'Configure API', description: 'Enter your token in settings' },
      { order: 3, title: 'Test Connection', description: 'Verify the API connection works' },
    ],
  },
];

// ============================================================================
// Connection Method Service Class
// ============================================================================

class ConnectionMethodService {
  private redis: Redis | null = null;
  private readonly PREF_PREFIX = 'connection_pref:';
  private readonly PREF_CACHE_TTL = 86400; // 24 hours for preferences

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
        logger.info('Connection Method Service initialized');
      } catch (error) {
        logger.warn('Redis not available for connection method caching', { error });
      }
    }
  }

  /**
   * Get all available connection methods
   */
  getAvailableMethods(): ConnectionMethodConfig[] {
    return CONNECTION_METHODS.filter(m => m.status !== 'deprecated');
  }

  /**
   * Get connection method by ID
   */
  getMethod(methodId: ConnectionMethod): ConnectionMethodConfig | null {
    return CONNECTION_METHODS.find(m => m.id === methodId) || null;
  }

  /**
   * Get recommended methods
   */
  getRecommendedMethods(): ConnectionMethodConfig[] {
    return CONNECTION_METHODS.filter(m => m.recommended && m.status === 'available');
  }

  /**
   * Get user's connection preference from Redis
   */
  async getUserPreference(userId: string, accountId: string): Promise<UserConnectionPreference | null> {
    const key = `${this.PREF_PREFIX}${userId}:${accountId}`;
    
    // Try Redis first
    if (this.redis) {
      try {
        const cached = await this.redis.get(key);
        if (cached) {
          const pref = JSON.parse(cached);
          pref.lastUpdated = new Date(pref.lastUpdated);
          pref.methodStatus = await this.getMethodStatuses(userId, accountId);
          return pref;
        }
      } catch (error) {
        logger.warn('Cache read error', { error });
      }
    }

    // Return default preference
    const methodStatus = await this.getMethodStatuses(userId, accountId);
    
    return {
      userId,
      accountId,
      preferredMethod: ConnectionMethod.EXTENSION,
      fallbackMethods: [ConnectionMethod.WORKER, ConnectionMethod.OAUTH],
      autoSwitchEnabled: true,
      lastUpdated: new Date(),
      methodStatus,
    };
  }

  /**
   * Update user's connection preference
   */
  async updateUserPreference(
    userId: string,
    accountId: string,
    preferredMethod: ConnectionMethod,
    options?: {
      fallbackMethods?: ConnectionMethod[];
      autoSwitchEnabled?: boolean;
    }
  ): Promise<UserConnectionPreference> {
    // Validate method exists
    const method = this.getMethod(preferredMethod);
    if (!method || method.status === 'deprecated') {
      throw new Error(`Invalid or deprecated connection method: ${preferredMethod}`);
    }

    const preference = {
      userId,
      accountId,
      preferredMethod,
      fallbackMethods: options?.fallbackMethods || [ConnectionMethod.WORKER, ConnectionMethod.OAUTH],
      autoSwitchEnabled: options?.autoSwitchEnabled ?? true,
      lastUpdated: new Date(),
    };

    // Save to Redis
    const key = `${this.PREF_PREFIX}${userId}:${accountId}`;
    if (this.redis) {
      try {
        await this.redis.setex(key, this.PREF_CACHE_TTL, JSON.stringify(preference));
      } catch (error) {
        logger.warn('Cache write error', { error });
      }
    }

    // Log the change
    await this.logConnectionMethodChange(userId, accountId, preferredMethod);

    // Return updated preference with method statuses
    const methodStatus = await this.getMethodStatuses(userId, accountId);
    return { ...preference, methodStatus };
  }

  /**
   * Log connection method change
   */
  private async logConnectionMethodChange(
    userId: string,
    accountId: string,
    newMethod: ConnectionMethod
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: 'CONNECTION_METHOD_CHANGED',
          entityType: 'User',
          entityId: userId,
          userId,
          metadata: {
            newMethod,
            accountId,
          },
          ipAddress: 'system',
          userAgent: 'ConnectionMethodService',
        },
      });
    } catch (error) {
      logger.error('Failed to log connection method change', { error });
    }
  }

  /**
   * Get method statuses for a user
   */
  private async getMethodStatuses(userId: string, accountId: string): Promise<MethodStatus[]> {
    const statuses: MethodStatus[] = [];

    for (const method of CONNECTION_METHODS) {
      const status = await this.checkMethodStatus(userId, accountId, method.id);
      statuses.push(status);
    }

    return statuses;
  }

  /**
   * Check status of a specific method for user
   */
  private async checkMethodStatus(
    userId: string,
    accountId: string,
    method: ConnectionMethod
  ): Promise<MethodStatus> {
    // Get recent connection attempts from audit log
    const recentAttempts = await prisma.auditLog.findMany({
      where: {
        userId,
        action: 'CONNECTION_ATTEMPT',
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Filter for this method
    const methodAttempts = recentAttempts.filter(a => {
      const meta = a.metadata as any;
      return meta?.method === method;
    });

    const errorCount = methodAttempts.filter(a => {
      const meta = a.metadata as any;
      return !meta?.success;
    }).length;

    // Determine health based on error rate
    let health: 'healthy' | 'degraded' | 'offline' = 'healthy';
    if (errorCount > 5) {
      health = 'offline';
    } else if (errorCount > 2) {
      health = 'degraded';
    }

    // Check if method is configured based on FB profiles
    let isConfigured = false;
    const profiles = await prisma.facebookProfile.findMany({
      where: { accountId, isActive: true },
      select: { id: true, accessToken: true },
    });

    switch (method) {
      case ConnectionMethod.EXTENSION:
        // Check if any profile has an active session
        isConfigured = profiles.length > 0;
        break;
      case ConnectionMethod.OAUTH:
        // Check if any profile has OAuth token
        isConfigured = profiles.some(p => !!p.accessToken);
        break;
      case ConnectionMethod.WORKER:
        // Check if worker is assigned (check audit logs for worker assignment)
        const workerAssignment = await prisma.auditLog.findFirst({
          where: {
            action: 'WORKER_ASSIGNED',
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        });
        isConfigured = !!workerAssignment;
        break;
      case ConnectionMethod.API:
        // Check if any profile has API token
        isConfigured = profiles.some(p => !!p.accessToken);
        break;
    }

    return {
      method,
      isConfigured,
      isActive: isConfigured && health !== 'offline',
      lastUsed: methodAttempts[0]?.createdAt || null,
      health,
      errorCount,
    };
  }

  /**
   * Log a connection attempt
   */
  async logConnectionAttempt(
    userId: string,
    accountId: string,
    attempt: ConnectionAttempt
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: 'CONNECTION_ATTEMPT',
          entityType: 'Account',
          entityId: accountId,
          userId,
          metadata: {
            method: attempt.method,
            success: attempt.success,
            error: attempt.error,
            latencyMs: attempt.latencyMs,
          },
          ipAddress: 'system',
          userAgent: 'ConnectionMethodService',
        },
      });
    } catch (error) {
      logger.error('Failed to log connection attempt', { error });
    }
  }

  /**
   * Get best available method for user
   */
  async getBestAvailableMethod(
    userId: string,
    accountId: string
  ): Promise<ConnectionMethod> {
    const preference = await this.getUserPreference(userId, accountId);
    if (!preference) {
      return ConnectionMethod.EXTENSION; // Default
    }

    // Check if preferred method is healthy
    const preferredStatus = preference.methodStatus.find(
      s => s.method === preference.preferredMethod
    );

    if (preferredStatus?.isConfigured && preferredStatus?.health === 'healthy') {
      return preference.preferredMethod;
    }

    // If auto-switch is enabled, try fallback methods
    if (preference.autoSwitchEnabled) {
      for (const fallback of preference.fallbackMethods) {
        const status = preference.methodStatus.find(s => s.method === fallback);
        if (status?.isConfigured && status?.health === 'healthy') {
          return fallback;
        }
      }
    }

    // Return preferred method even if degraded
    return preference.preferredMethod;
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    if (this.redis) {
      this.redis.disconnect();
    }
  }
}

// Singleton export
export const connectionMethodService = new ConnectionMethodService();
