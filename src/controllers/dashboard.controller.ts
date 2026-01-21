/**
 * Dashboard Controller
 * 
 * Comprehensive dashboard endpoints for Super Admin with full visibility,
 * and limited views for Admin/User roles.
 * 
 * Security: Role-based access control with SUPER_ADMIN-only routes
 */

import { Request, Response, NextFunction } from 'express';
import { dashboardMetricsService } from '@/services/dashboard-metrics.service';
import { facebookHealthIntelligenceService } from '@/services/facebook-health-intelligence.service';
import { riskAssessmentService } from '@/services/risk-assessment.service';
import { workerQueueService } from '@/services/worker-queue.service';
import { logger } from '@/utils/logger';
import { UserRole } from '@/middleware/rbac';
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

interface DashboardResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
  requestId: string;
}

// ============================================================================
// Dashboard Controller Class
// ============================================================================

class DashboardController {
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
   * Log dashboard access
   */
  private async logAccess(
    req: AuthenticatedRequest,
    action: string,
    endpoint: string
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: 'DASHBOARD_ACCESS',
          entityType: 'Dashboard',
          entityId: endpoint,
          userId: req.user?.id,
          metadata: {
            action,
            role: req.user?.role,
            path: req.path,
          },
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
        },
      });
    } catch (error) {
      logger.error('Failed to log dashboard access', { error });
    }
  }

  // ==========================================================================
  // SUPER ADMIN ENDPOINTS (Full Access)
  // ==========================================================================

  /**
   * GET /api/dashboard/super-admin/overview
   * Complete system overview - SUPER_ADMIN only
   */
  async getSuperAdminOverview(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const requestId = this.generateRequestId();

    try {
      await this.logAccess(req, 'VIEW_OVERVIEW', 'super-admin-overview');

      const [overview, systemRisk, fbHealth] = await Promise.all([
        dashboardMetricsService.getDashboardOverview(),
        riskAssessmentService.assessSystemRisk(),
        facebookHealthIntelligenceService.getSystemHealthReport(),
      ]);

      const response: DashboardResponse = {
        success: true,
        data: {
          overview,
          systemRisk: {
            overallScore: systemRisk.overallRiskScore,
            level: systemRisk.riskLevel,
            categories: systemRisk.categories.map(c => ({
              name: c.name,
              score: c.score,
              level: c.level,
            })),
            mitigation: systemRisk.mitigation,
          },
          facebookHealth: {
            totalProfiles: fbHealth.totalProfiles,
            averageScore: fbHealth.averageHealthScore,
            distribution: fbHealth.healthDistribution,
            topRisks: fbHealth.topRisks,
          },
        },
        timestamp: new Date().toISOString(),
        requestId,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getSuperAdminOverview', { error, requestId });
      next(error);
    }
  }

  /**
   * GET /api/dashboard/super-admin/transactions
   * Full transaction analytics - SUPER_ADMIN only
   */
  async getTransactionAnalytics(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const requestId = this.generateRequestId();

    try {
      await this.logAccess(req, 'VIEW_TRANSACTIONS', 'transaction-analytics');

      const transactions = await dashboardMetricsService.getTransactionMetrics();

      const response: DashboardResponse = {
        success: true,
        data: {
          transactions,
          summary: {
            totalRevenue: transactions.totalRevenue,
            averageOrderValue: transactions.averageTransactionValue,
            total: transactions.totalTransactions,
            successful: transactions.successfulTransactions,
            failed: transactions.failedTransactions,
            pending: transactions.pendingTransactions,
            conversionRate: transactions.totalTransactions > 0
              ? (transactions.successfulTransactions / transactions.totalTransactions * 100).toFixed(2)
              : '0',
          },
        },
        timestamp: new Date().toISOString(),
        requestId,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getTransactionAnalytics', { error, requestId });
      next(error);
    }
  }

  /**
   * GET /api/dashboard/super-admin/workers
   * Worker/Soldier deployment metrics - SUPER_ADMIN only
   */
  async getWorkerMetrics(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const requestId = this.generateRequestId();

    try {
      await this.logAccess(req, 'VIEW_WORKERS', 'worker-metrics');

      const [workerMetrics, queueStats] = await Promise.all([
        dashboardMetricsService.getWorkerMetrics(),
        workerQueueService.getQueueStats(),
      ]);

      const response: DashboardResponse = {
        success: true,
        data: {
          soldiers: {
            total: workerMetrics.totalSoldiers,
            active: workerMetrics.activeSoldiers,
            idle: workerMetrics.idleSoldiers,
            offline: workerMetrics.offlineSoldiers,
          },
          tasks: {
            processed: workerMetrics.totalTasksProcessed,
            pending: workerMetrics.totalTasksPending,
            failed: workerMetrics.totalTasksFailed,
            successRate: workerMetrics.totalTasksProcessed > 0
              ? ((workerMetrics.totalTasksProcessed - workerMetrics.totalTasksFailed) / workerMetrics.totalTasksProcessed * 100).toFixed(2)
              : '0',
          },
          queue: {
            size: queueStats.pending,
            processing: queueStats.processing,
            completed: queueStats.completed,
            failed: queueStats.failed,
          },
          workerDetails: workerMetrics.workerDetails.map(w => ({
            id: w.workerId,
            status: w.status,
            tasksProcessed: w.tasksProcessed,
            lastHeartbeat: w.lastHeartbeat,
            uptime: w.uptime,
          })),
        },
        timestamp: new Date().toISOString(),
        requestId,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getWorkerMetrics', { error, requestId });
      next(error);
    }
  }

  /**
   * GET /api/dashboard/super-admin/security
   * Security metrics and incidents - SUPER_ADMIN only
   */
  async getSecurityMetrics(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const requestId = this.generateRequestId();

    try {
      await this.logAccess(req, 'VIEW_SECURITY', 'security-metrics');

      const [securityMetrics, systemRisk] = await Promise.all([
        dashboardMetricsService.getSecurityMetrics(),
        riskAssessmentService.assessSystemRisk(),
      ]);

      const response: DashboardResponse = {
        success: true,
        data: {
          metrics: securityMetrics,
          threats: {
            activeThreats: systemRisk.securityRisk.activeThreats,
            vulnerabilities: systemRisk.securityRisk.vulnerabilities.length,
            recentIncidents: systemRisk.securityRisk.recentIncidents.slice(0, 5),
          },
          riskLevel: systemRisk.securityRisk.level,
        },
        timestamp: new Date().toISOString(),
        requestId,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getSecurityMetrics', { error, requestId });
      next(error);
    }
  }

  /**
   * GET /api/dashboard/super-admin/facebook-health
   * Facebook health intelligence - SUPER_ADMIN only
   */
  async getFacebookHealthIntelligence(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const requestId = this.generateRequestId();

    try {
      await this.logAccess(req, 'VIEW_FB_HEALTH', 'facebook-health');

      const [fbHealth, systemRisk] = await Promise.all([
        facebookHealthIntelligenceService.getSystemHealthReport(),
        riskAssessmentService.assessSystemRisk(),
      ]);

      // Extract profiles with critical health
      const criticalProfiles = fbHealth.profiles.filter(
        p => p.overallHealth.status === 'critical' || p.overallHealth.status === 'poor'
      );

      const response: DashboardResponse = {
        success: true,
        data: {
          overview: {
            totalProfiles: fbHealth.totalProfiles,
            averageHealthScore: fbHealth.averageHealthScore,
            averageAuthorityScore: fbHealth.averageAuthorityScore,
          },
          healthDistribution: fbHealth.healthDistribution,
          criticalProfiles: criticalProfiles.slice(0, 10).map(p => ({
            profileId: p.profileId,
            healthScore: p.overallHealth.score,
            healthStatus: p.overallHealth.status,
            trend: p.overallHealth.trend,
            topRisks: p.riskIndicators.slice(0, 3),
            lastUpdated: p.lastUpdated,
          })),
          blockingRisk: {
            score: systemRisk.fbBlockingRisk.score,
            level: systemRisk.fbBlockingRisk.level,
            estimatedTimeToBlock: systemRisk.fbBlockingRisk.estimatedTimeToBlock,
            factors: systemRisk.fbBlockingRisk.factors,
            cooldownRecommended: systemRisk.fbBlockingRisk.cooldownRecommended,
            cooldownDuration: systemRisk.fbBlockingRisk.cooldownDuration,
          },
          topRisks: fbHealth.topRisks,
          recommendations: fbHealth.systemWideRecommendations,
        },
        timestamp: new Date().toISOString(),
        requestId,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getFacebookHealthIntelligence', { error, requestId });
      next(error);
    }
  }

  /**
   * GET /api/dashboard/super-admin/risk-assessment
   * Complete risk assessment - SUPER_ADMIN only
   */
  async getRiskAssessment(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const requestId = this.generateRequestId();

    try {
      await this.logAccess(req, 'VIEW_RISK', 'risk-assessment');

      const systemRisk = await riskAssessmentService.assessSystemRisk();

      const response: DashboardResponse = {
        success: true,
        data: {
          overall: {
            score: systemRisk.overallRiskScore,
            level: systemRisk.riskLevel,
            timestamp: systemRisk.timestamp,
          },
          categories: systemRisk.categories,
          facebook: systemRisk.fbBlockingRisk,
          security: {
            score: systemRisk.securityRisk.score,
            level: systemRisk.securityRisk.level,
            vulnerabilities: systemRisk.securityRisk.vulnerabilities,
            activeThreats: systemRisk.securityRisk.activeThreats,
          },
          operational: systemRisk.operationalRisk,
          compliance: systemRisk.complianceRisk,
          mitigation: systemRisk.mitigation,
          historicalTrend: systemRisk.historicalTrend,
        },
        timestamp: new Date().toISOString(),
        requestId,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getRiskAssessment', { error, requestId });
      next(error);
    }
  }

  /**
   * GET /api/dashboard/super-admin/activity
   * Activity feed and audit log - SUPER_ADMIN only
   */
  async getActivityFeed(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const requestId = this.generateRequestId();

    try {
      await this.logAccess(req, 'VIEW_ACTIVITY', 'activity-feed');

      const activityMetrics = await dashboardMetricsService.getActivityMetrics();

      const response: DashboardResponse = {
        success: true,
        data: {
          lastActivity: activityMetrics.lastActivity,
          topActivities: activityMetrics.topActivities,
          activityByHour: activityMetrics.activityByHour,
          activitiesLast24h: activityMetrics.activitiesLast24h,
          activitiesLast7d: activityMetrics.activitiesLast7d,
          activeUsers: activityMetrics.activeUsers,
          peakActivityHour: activityMetrics.peakActivityHour,
        },
        timestamp: new Date().toISOString(),
        requestId,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getActivityFeed', { error, requestId });
      next(error);
    }
  }

  /**
   * GET /api/dashboard/super-admin/connections
   * Connection status across all accounts - SUPER_ADMIN only
   */
  async getConnectionStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const requestId = this.generateRequestId();

    try {
      await this.logAccess(req, 'VIEW_CONNECTIONS', 'connection-status');

      const connectionMetrics = await dashboardMetricsService.getConnectionMetrics();

      const response: DashboardResponse = {
        success: true,
        data: {
          summary: {
            total: connectionMetrics.totalConnections,
            active: connectionMetrics.activeConnections,
            healthy: connectionMetrics.connectionHealth.healthy,
            degraded: connectionMetrics.connectionHealth.degraded,
            failed: connectionMetrics.connectionHealth.failed,
          },
          byMethod: connectionMetrics.connectionsByMethod,
          recentDisconnections: connectionMetrics.recentDisconnections,
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
   * GET /api/dashboard/super-admin/system-health
   * System health overview - SUPER_ADMIN only
   */
  async getSystemHealth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const requestId = this.generateRequestId();

    try {
      await this.logAccess(req, 'VIEW_SYSTEM_HEALTH', 'system-health');

      const [systemHealth, operationalRisk] = await Promise.all([
        dashboardMetricsService.getSystemHealthMetrics(),
        riskAssessmentService.assessSystemRisk(),
      ]);

      const response: DashboardResponse = {
        success: true,
        data: {
          health: systemHealth,
          operational: {
            stability: operationalRisk.operationalRisk.systemStability,
            queueBacklog: operationalRisk.operationalRisk.queueBacklog,
            failureRate: operationalRisk.operationalRisk.failureRate,
            bottlenecks: operationalRisk.operationalRisk.bottlenecks,
          },
          workers: operationalRisk.operationalRisk.workerHealth,
        },
        timestamp: new Date().toISOString(),
        requestId,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getSystemHealth', { error, requestId });
      next(error);
    }
  }

  // ==========================================================================
  // ADMIN ENDPOINTS (Limited Access)
  // ==========================================================================

  /**
   * GET /api/dashboard/admin/overview
   * Admin-level overview - ADMIN and above
   */
  async getAdminOverview(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const requestId = this.generateRequestId();

    try {
      await this.logAccess(req, 'VIEW_ADMIN_OVERVIEW', 'admin-overview');

      const [transactions, connections, activity] = await Promise.all([
        dashboardMetricsService.getTransactionMetrics(),
        dashboardMetricsService.getConnectionMetrics(),
        dashboardMetricsService.getActivityMetrics(),
      ]);

      const response: DashboardResponse = {
        success: true,
        data: {
          transactions: {
            total: transactions.totalTransactions,
            successful: transactions.successfulTransactions,
            revenue: transactions.totalRevenue,
          },
          connections: {
            total: connections.totalConnections,
            active: connections.activeConnections,
            healthy: connections.connectionHealth.healthy,
          },
          activity: {
            lastActivity: activity.lastActivity,
            activeUsers: activity.activeUsers,
          },
        },
        timestamp: new Date().toISOString(),
        requestId,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getAdminOverview', { error, requestId });
      next(error);
    }
  }

  /**
   * GET /api/dashboard/admin/account/:accountId/health
   * Account-specific health - ADMIN and above
   */
  async getAccountHealth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const requestId = this.generateRequestId();
    const accountId = req.params.accountId as string;

    try {
      await this.logAccess(req, 'VIEW_ACCOUNT_HEALTH', `account-${accountId}`);

      const [fbHealth, risk] = await Promise.all([
        facebookHealthIntelligenceService.getAccountHealthReport(accountId),
        riskAssessmentService.assessAccountRisk(accountId),
      ]);

      const response: DashboardResponse = {
        success: true,
        data: {
          health: {
            averageScore: fbHealth.averageHealthScore,
            distribution: fbHealth.healthDistribution,
            totalProfiles: fbHealth.totalProfiles,
          },
          risk: {
            overall: risk.overallRiskScore,
            level: risk.riskLevel,
            fbBlocking: risk.fbBlockingRisk.score,
          },
          recommendations: fbHealth.systemWideRecommendations?.slice(0, 5) || [],
        },
        timestamp: new Date().toISOString(),
        requestId,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getAccountHealth', { error, requestId });
      next(error);
    }
  }

  // ==========================================================================
  // USER ENDPOINTS (Basic Access)
  // ==========================================================================

  /**
   * GET /api/dashboard/user/profile/:profileId/health
   * Profile-specific health - User level
   */
  async getProfileHealth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const requestId = this.generateRequestId();
    const profileId = req.params.profileId as string;

    try {
      await this.logAccess(req, 'VIEW_PROFILE_HEALTH', `profile-${profileId}`);

      const healthReport = await facebookHealthIntelligenceService.analyzeProfileHealth(profileId);

      const response: DashboardResponse = {
        success: true,
        data: {
          health: {
            score: healthReport.overallHealth.score,
            status: healthReport.overallHealth.status,
            trend: healthReport.overallHealth.trend,
          },
          authority: {
            score: healthReport.authorityScore.score,
            yearsActive: healthReport.authorityScore.yearsActive,
            trustLevel: healthReport.authorityScore.trustLevel,
          },
          risks: healthReport.riskIndicators.map(r => ({
            type: r.type,
            level: r.level,
            description: r.description,
          })),
          recommendations: healthReport.recommendations.slice(0, 3),
        },
        timestamp: new Date().toISOString(),
        requestId,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getProfileHealth', { error, requestId });
      next(error);
    }
  }

  /**
   * GET /api/dashboard/user/connection-methods
   * Available connection methods for user
   */
  async getConnectionMethods(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const requestId = this.generateRequestId();

    try {
      await this.logAccess(req, 'VIEW_CONNECTION_METHODS', 'connection-methods');

      // Available connection methods with their status
      const connectionMethods = [
        {
          id: 'extension',
          name: 'Browser Extension',
          description: 'Connect via Chrome extension for real-time automation',
          status: 'available',
          recommended: true,
          features: ['Real-time posting', 'Session persistence', 'Auto-retry'],
        },
        {
          id: 'oauth',
          name: 'Facebook OAuth',
          description: 'Connect via official Facebook OAuth flow',
          status: 'available',
          recommended: false,
          features: ['Official API', 'Limited features', 'Rate limited'],
        },
        {
          id: 'worker',
          name: 'Worker/Soldier',
          description: 'Connect via Python worker for headless automation',
          status: 'available',
          recommended: true,
          features: ['Headless operation', 'High throughput', 'Scalable'],
        },
        {
          id: 'api',
          name: 'Direct API',
          description: 'Connect via direct API integration',
          status: 'available',
          recommended: false,
          features: ['Fast', 'Limited capabilities', 'Requires tokens'],
        },
      ];

      const response: DashboardResponse = {
        success: true,
        data: {
          methods: connectionMethods,
          currentMethod: req.user?.accountId ? 'extension' : null,
        },
        timestamp: new Date().toISOString(),
        requestId,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getConnectionMethods', { error, requestId });
      next(error);
    }
  }

  // ==========================================================================
  // REAL-TIME ENDPOINTS
  // ==========================================================================

  /**
   * GET /api/dashboard/realtime/metrics
   * Real-time metrics for live dashboard updates
   */
  async getRealtimeMetrics(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const requestId = this.generateRequestId();

    try {
      const [queueStats, activeWorkers] = await Promise.all([
        workerQueueService.getQueueStats(),
        workerQueueService.getActiveWorkers(),
      ]);

      const response: DashboardResponse = {
        success: true,
        data: {
          queue: {
            pending: queueStats.pending,
            processing: queueStats.processing,
            completed: queueStats.completed,
            failed: queueStats.failed,
          },
          workers: {
            active: activeWorkers.filter(w => {
              const lastHb = w.last_heartbeat ? new Date(w.last_heartbeat) : null;
              return lastHb && (Date.now() - lastHb.getTime()) < 60000;
            }).length,
            total: activeWorkers.length,
          },
          timestamp: Date.now(),
        },
        timestamp: new Date().toISOString(),
        requestId,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getRealtimeMetrics', { error, requestId });
      next(error);
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * POST /api/dashboard/refresh-cache
   * Force refresh of all dashboard caches - SUPER_ADMIN only
   */
  async refreshCache(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const requestId = this.generateRequestId();

    try {
      await this.logAccess(req, 'REFRESH_CACHE', 'cache-refresh');

      // Clear all service caches
      dashboardMetricsService.clearCache();
      facebookHealthIntelligenceService.clearCache();
      riskAssessmentService.clearCache();

      const response: DashboardResponse = {
        success: true,
        data: {
          message: 'All dashboard caches cleared successfully',
          clearedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
        requestId,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in refreshCache', { error, requestId });
      next(error);
    }
  }
}

// Export singleton instance
export const dashboardController = new DashboardController();
