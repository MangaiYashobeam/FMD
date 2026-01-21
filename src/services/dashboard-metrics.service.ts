/**
 * Dashboard Metrics Service
 * 
 * Comprehensive metrics collection and analytics for the super admin dashboard.
 * Provides real-time data on:
 * - Transaction analytics
 * - Worker/Soldier deployment status
 * - Security metrics
 * - Connection status
 * - System health
 * 
 * Security: All data is sanitized and access is controlled via RBAC
 */

import prisma from '@/config/database';
import { logger } from '@/utils/logger';
import { workerQueueService } from './worker-queue.service';
import Redis from 'ioredis';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface TransactionMetrics {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  pendingTransactions: number;
  totalRevenue: number;
  averageTransactionValue: number;
  transactionsByDay: Record<string, { count: number; revenue: number }>;
  transactionsByPlan: Array<{ plan: string; count: number; revenue: number }>;
}

export interface WorkerMetrics {
  totalSoldiers: number;
  activeSoldiers: number;
  idleSoldiers: number;
  offlineSoldiers: number;
  totalTasksProcessed: number;
  totalTasksPending: number;
  totalTasksFailed: number;
  averageTaskDuration: number;
  workerDetails: WorkerDetail[];
}

export interface WorkerDetail {
  workerId: string;
  status: 'active' | 'idle' | 'offline';
  lastHeartbeat: Date | null;
  browsersActive: number;
  tasksProcessed: number;
  tasksInProgress: number;
  tasksFailed: number;
  cpuUsage?: number;
  memoryUsage?: number;
  uptime?: number;
}

export interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  connectionsByMethod: {
    extension: number;
    oauth: number;
    worker: number;
    api: number;
  };
  connectionHealth: {
    healthy: number;
    degraded: number;
    failed: number;
  };
  recentDisconnections: number;
}

export interface SecurityMetrics {
  totalSecurityEvents: number;
  criticalEvents: number;
  warningEvents: number;
  infoEvents: number;
  blockedIPs: number;
  rateLimitExceeded: number;
  authFailures: number;
  suspiciousActivities: number;
  lastSecurityIncident: Date | null;
  securityScore: number; // 0-100
  recentEvents: SecurityEvent[];
}

export interface SecurityEvent {
  id: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  ipAddress?: string;
  userId?: string;
  timestamp: Date;
}

export interface SystemHealthMetrics {
  status: 'healthy' | 'degraded' | 'critical';
  uptime: number;
  databaseConnected: boolean;
  redisConnected: boolean;
  workerQueueHealthy: boolean;
  lastHealthCheck: Date;
  responseTime: number;
  errorRate: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
}

export interface ActivityMetrics {
  lastActivity: Date | null;
  activitiesLast24h: number;
  activitiesLast7d: number;
  topActivities: Array<{ type: string; count: number }>;
  activeUsers: number;
  peakActivityHour: number;
  activityByHour: Record<number, number>;
}

export interface DashboardOverview {
  timestamp: Date;
  transactions: TransactionMetrics;
  workers: WorkerMetrics;
  connections: ConnectionMetrics;
  security: SecurityMetrics;
  systemHealth: SystemHealthMetrics;
  activity: ActivityMetrics;
}

// ============================================================================
// Dashboard Metrics Service
// ============================================================================

class DashboardMetricsService {
  private redis: Redis | null = null;
  private metricsCache: Map<string, { data: any; expiry: number }> = new Map();
  private readonly CACHE_TTL = 30000; // 30 seconds cache

  /**
   * Initialize Redis connection for metrics
   */
  async initialize(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        });
        await this.redis.connect();
        logger.info('Dashboard metrics service initialized with Redis');
      } catch (error) {
        logger.warn('Redis not available for metrics caching', { error });
      }
    }
  }

  /**
   * Get cached data or fetch fresh
   */
  private async getCachedOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const cached = this.metricsCache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data as T;
    }

    const data = await fetcher();
    this.metricsCache.set(key, { data, expiry: Date.now() + this.CACHE_TTL });
    return data;
  }

  // =========================================================================
  // Transaction Metrics
  // =========================================================================

  /**
   * Get comprehensive transaction metrics
   */
  async getTransactionMetrics(days: number = 30): Promise<TransactionMetrics> {
    return this.getCachedOrFetch(`transactions:${days}`, async () => {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [payments, aggregates, byPlan] = await Promise.all([
        prisma.payment.findMany({
          where: { createdAt: { gte: startDate } },
          include: {
            account: {
              include: { subscriptionPlan: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.payment.aggregate({
          where: { createdAt: { gte: startDate } },
          _count: true,
          _sum: { amount: true },
          _avg: { amount: true },
        }),
        prisma.payment.groupBy({
          by: ['status'],
          where: { createdAt: { gte: startDate } },
          _count: true,
          _sum: { amount: true },
        }),
      ]);

      // Group by day
      const transactionsByDay: Record<string, { count: number; revenue: number }> = {};
      payments.forEach(p => {
        const day = p.createdAt.toISOString().split('T')[0];
        if (!transactionsByDay[day]) {
          transactionsByDay[day] = { count: 0, revenue: 0 };
        }
        transactionsByDay[day].count++;
        if (p.status === 'succeeded') {
          transactionsByDay[day].revenue += parseFloat(p.amount.toString());
        }
      });

      // Group by plan
      const planMap = new Map<string, { count: number; revenue: number }>();
      payments.forEach(p => {
        const planName = p.account?.subscriptionPlan?.name || 'Unknown';
        const existing = planMap.get(planName) || { count: 0, revenue: 0 };
        existing.count++;
        if (p.status === 'succeeded') {
          existing.revenue += parseFloat(p.amount.toString());
        }
        planMap.set(planName, existing);
      });

      const statusCounts = byPlan.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalTransactions: aggregates._count || 0,
        successfulTransactions: statusCounts['succeeded'] || 0,
        failedTransactions: statusCounts['failed'] || 0,
        pendingTransactions: statusCounts['pending'] || 0,
        totalRevenue: parseFloat(aggregates._sum.amount?.toString() || '0'),
        averageTransactionValue: parseFloat(aggregates._avg.amount?.toString() || '0'),
        transactionsByDay,
        transactionsByPlan: Array.from(planMap.entries()).map(([plan, data]) => ({
          plan,
          ...data,
        })),
      };
    });
  }

  // =========================================================================
  // Worker/Soldier Metrics
  // =========================================================================

  /**
   * Get comprehensive worker deployment metrics
   */
  async getWorkerMetrics(): Promise<WorkerMetrics> {
    return this.getCachedOrFetch('workers', async () => {
      // Get queue stats
      const queueStats = await workerQueueService.getQueueStats();
      const activeWorkers = await workerQueueService.getActiveWorkers();

      // Determine worker status based on heartbeat
      const now = Date.now();
      const HEARTBEAT_TIMEOUT = 60000; // 60 seconds
      const IDLE_THRESHOLD = 30000; // 30 seconds

      const workerDetails: WorkerDetail[] = activeWorkers.map(w => {
        const lastHeartbeat = w.last_heartbeat ? new Date(w.last_heartbeat) : null;
        const timeSinceHeartbeat = lastHeartbeat ? now - lastHeartbeat.getTime() : Infinity;

        let status: 'active' | 'idle' | 'offline';
        if (timeSinceHeartbeat > HEARTBEAT_TIMEOUT) {
          status = 'offline';
        } else if (w.browsers_active > 0 || timeSinceHeartbeat < IDLE_THRESHOLD) {
          status = 'active';
        } else {
          status = 'idle';
        }

        return {
          workerId: w.worker_id,
          status,
          lastHeartbeat,
          browsersActive: w.browsers_active,
          tasksProcessed: w.tasks_processed,
          tasksInProgress: w.browsers_active, // Assuming 1 browser = 1 task
          tasksFailed: 0, // Would need additional tracking
        };
      });

      const activeSoldiers = workerDetails.filter(w => w.status === 'active').length;
      const idleSoldiers = workerDetails.filter(w => w.status === 'idle').length;
      const offlineSoldiers = workerDetails.filter(w => w.status === 'offline').length;

      return {
        totalSoldiers: workerDetails.length,
        activeSoldiers,
        idleSoldiers,
        offlineSoldiers,
        totalTasksProcessed: queueStats.completed,
        totalTasksPending: queueStats.pending,
        totalTasksFailed: queueStats.failed,
        averageTaskDuration: 0, // Would need task duration tracking
        workerDetails,
      };
    });
  }

  // =========================================================================
  // Connection Metrics
  // =========================================================================

  /**
   * Get connection status metrics
   */
  async getConnectionMetrics(): Promise<ConnectionMetrics> {
    return this.getCachedOrFetch('connections', async () => {
      const [
        totalProfiles,
        activeProfiles,
        recentDisconnections,
        extensionTasks,
      ] = await Promise.all([
        prisma.facebookProfile.count(),
        prisma.facebookProfile.count({ where: { isActive: true } }),
        prisma.facebookProfile.count({
          where: {
            isActive: false,
            updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        }),
        prisma.extensionTask.count({
          where: {
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        }),
      ]);

      // Get worker connections
      const workers = await workerQueueService.getActiveWorkers();
      const workerConnections = workers.filter(w => {
        const lastHb = w.last_heartbeat ? new Date(w.last_heartbeat) : null;
        return lastHb && (Date.now() - lastHb.getTime()) < 120000;
      }).length;

      // Estimate connection methods (would need better tracking in production)
      const connectionsByMethod = {
        extension: extensionTasks > 0 ? Math.ceil(extensionTasks / 10) : 0,
        oauth: Math.ceil(activeProfiles * 0.3),
        worker: workerConnections,
        api: Math.ceil(activeProfiles * 0.2),
      };

      // Calculate health - using 0.9 threshold for healthy connections
      const healthRatio = totalProfiles > 0 ? Math.min(activeProfiles / totalProfiles, 0.9) : 0.9;
      
      return {
        totalConnections: totalProfiles,
        activeConnections: activeProfiles,
        connectionsByMethod,
        connectionHealth: {
          healthy: Math.ceil(activeProfiles * healthRatio),
          degraded: Math.ceil(activeProfiles * (1 - healthRatio) * 0.5),
          failed: totalProfiles - activeProfiles,
        },
        recentDisconnections,
      };
    });
  }

  // =========================================================================
  // Security Metrics
  // =========================================================================

  /**
   * Get security event metrics
   */
  async getSecurityMetrics(): Promise<SecurityMetrics> {
    return this.getCachedOrFetch('security', async () => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Query audit logs for security events
      const [recentEvents, criticalCount, warningCount, authFailures] = await Promise.all([
        prisma.auditLog.findMany({
          where: {
            createdAt: { gte: twentyFourHoursAgo },
            action: {
              in: [
                'LOGIN_FAILED', 'RATE_LIMIT_EXCEEDED', 'CSRF_VIOLATION',
                'INJECTION_ATTEMPT', 'UNAUTHORIZED_ACCESS', 'SUSPICIOUS_ACTIVITY',
                'IP_BLOCKED', 'TWO_FA_FAILED',
              ],
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        prisma.auditLog.count({
          where: {
            createdAt: { gte: sevenDaysAgo },
            action: { in: ['CSRF_VIOLATION', 'INJECTION_ATTEMPT', 'UNAUTHORIZED_ACCESS', 'SUSPICIOUS_ACTIVITY'] },
          },
        }),
        prisma.auditLog.count({
          where: {
            createdAt: { gte: sevenDaysAgo },
            action: { in: ['LOGIN_FAILED', 'RATE_LIMIT_EXCEEDED', 'TWO_FA_FAILED'] },
          },
        }),
        prisma.auditLog.count({
          where: {
            createdAt: { gte: sevenDaysAgo },
            action: 'LOGIN_FAILED',
          },
        }),
      ]);

      // Calculate security score (100 = perfect, decreases with incidents)
      const criticalWeight = 10;
      const warningWeight = 2;
      const baseScore = 100;
      const penaltyScore = Math.min(100, (criticalCount * criticalWeight) + (warningCount * warningWeight));
      const securityScore = Math.max(0, baseScore - penaltyScore);

      // Map to security events
      const mappedEvents: SecurityEvent[] = recentEvents.map(e => ({
        id: e.id,
        type: e.action,
        severity: this.getSeverityFromAction(e.action),
        message: this.getMessageFromAction(e.action, e.metadata as Record<string, any>),
        ipAddress: e.ipAddress || undefined,
        userId: e.userId || undefined,
        timestamp: e.createdAt,
      }));

      const lastCritical = mappedEvents.find(e => e.severity === 'CRITICAL');

      return {
        totalSecurityEvents: recentEvents.length,
        criticalEvents: criticalCount,
        warningEvents: warningCount,
        infoEvents: recentEvents.length - criticalCount - warningCount,
        blockedIPs: 0, // Would need IP blocking tracking
        rateLimitExceeded: recentEvents.filter(e => e.action === 'RATE_LIMIT_EXCEEDED').length,
        authFailures,
        suspiciousActivities: criticalCount,
        lastSecurityIncident: lastCritical?.timestamp || null,
        securityScore,
        recentEvents: mappedEvents.slice(0, 10),
      };
    });
  }

  private getSeverityFromAction(action: string): 'INFO' | 'WARNING' | 'CRITICAL' {
    const criticalActions = ['CSRF_VIOLATION', 'INJECTION_ATTEMPT', 'UNAUTHORIZED_ACCESS', 'SUSPICIOUS_ACTIVITY'];
    const warningActions = ['LOGIN_FAILED', 'RATE_LIMIT_EXCEEDED', 'TWO_FA_FAILED', 'IP_BLOCKED'];
    
    if (criticalActions.includes(action)) return 'CRITICAL';
    if (warningActions.includes(action)) return 'WARNING';
    return 'INFO';
  }

  private getMessageFromAction(action: string, _metadata?: Record<string, unknown>): string {
    const messages: Record<string, string> = {
      'LOGIN_FAILED': 'Failed login attempt',
      'RATE_LIMIT_EXCEEDED': 'Rate limit exceeded',
      'CSRF_VIOLATION': 'CSRF token validation failed',
      'INJECTION_ATTEMPT': 'Potential injection attack detected',
      'UNAUTHORIZED_ACCESS': 'Unauthorized access attempt',
      'SUSPICIOUS_ACTIVITY': 'Suspicious activity detected',
      'IP_BLOCKED': 'IP address blocked',
      'TWO_FA_FAILED': '2FA verification failed',
    };
    return messages[action] || action;
  }

  // =========================================================================
  // System Health Metrics
  // =========================================================================

  /**
   * Get system health metrics
   */
  async getSystemHealthMetrics(): Promise<SystemHealthMetrics> {
    const startTime = Date.now();

    // Check database
    let databaseConnected = true;
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      databaseConnected = false;
    }

    // Check Redis
    let redisConnected = this.redis?.status === 'ready';

    // Check worker queue
    let workerQueueHealthy = true;
    try {
      await workerQueueService.getQueueStats();
    } catch {
      workerQueueHealthy = false;
    }

    const responseTime = Date.now() - startTime;

    // Get memory usage
    const memUsage = process.memoryUsage();
    const memoryUsage = {
      used: Math.round(memUsage.heapUsed / 1024 / 1024),
      total: Math.round(memUsage.heapTotal / 1024 / 1024),
      percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
    };

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (!databaseConnected) {
      status = 'critical';
    } else if (!redisConnected || !workerQueueHealthy) {
      status = 'degraded';
    }

    return {
      status,
      uptime: process.uptime(),
      databaseConnected,
      redisConnected,
      workerQueueHealthy,
      lastHealthCheck: new Date(),
      responseTime,
      errorRate: 0, // Would need error tracking
      memoryUsage,
    };
  }

  // =========================================================================
  // Activity Metrics
  // =========================================================================

  /**
   * Get activity metrics
   */
  async getActivityMetrics(): Promise<ActivityMetrics> {
    return this.getCachedOrFetch('activity', async () => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [
        last24h,
        last7d,
        activityTypes,
        lastActivityRecord,
        activeUsers,
      ] = await Promise.all([
        prisma.auditLog.count({ where: { createdAt: { gte: twentyFourHoursAgo } } }),
        prisma.auditLog.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
        prisma.auditLog.groupBy({
          by: ['action'],
          where: { createdAt: { gte: sevenDaysAgo } },
          _count: true,
          orderBy: { _count: { action: 'desc' } },
          take: 10,
        }),
        prisma.auditLog.findFirst({ orderBy: { createdAt: 'desc' } }),
        prisma.user.count({
          where: {
            lastLoginAt: { gte: twentyFourHoursAgo },
            isActive: true,
          },
        }),
      ]);

      // Calculate activity by hour
      const hourlyActivity = await prisma.auditLog.findMany({
        where: { createdAt: { gte: twentyFourHoursAgo } },
        select: { createdAt: true },
      });

      const activityByHour: Record<number, number> = {};
      hourlyActivity.forEach(a => {
        const hour = a.createdAt.getHours();
        activityByHour[hour] = (activityByHour[hour] || 0) + 1;
      });

      // Find peak hour
      let peakHour = 0;
      let maxActivity = 0;
      Object.entries(activityByHour).forEach(([hour, count]) => {
        if (count > maxActivity) {
          maxActivity = count;
          peakHour = parseInt(hour);
        }
      });

      return {
        lastActivity: lastActivityRecord?.createdAt || null,
        activitiesLast24h: last24h,
        activitiesLast7d: last7d,
        topActivities: activityTypes.map(t => ({ type: t.action, count: t._count })),
        activeUsers,
        peakActivityHour: peakHour,
        activityByHour,
      };
    });
  }

  // =========================================================================
  // Full Dashboard Overview
  // =========================================================================

  /**
   * Get complete dashboard overview
   */
  async getDashboardOverview(): Promise<DashboardOverview> {
    const [transactions, workers, connections, security, systemHealth, activity] = await Promise.all([
      this.getTransactionMetrics(),
      this.getWorkerMetrics(),
      this.getConnectionMetrics(),
      this.getSecurityMetrics(),
      this.getSystemHealthMetrics(),
      this.getActivityMetrics(),
    ]);

    return {
      timestamp: new Date(),
      transactions,
      workers,
      connections,
      security,
      systemHealth,
      activity,
    };
  }

  /**
   * Clear metrics cache
   */
  clearCache(): void {
    this.metricsCache.clear();
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    if (this.redis) {
      this.redis.disconnect();
    }
    this.metricsCache.clear();
  }
}

// Singleton export
export const dashboardMetricsService = new DashboardMetricsService();
