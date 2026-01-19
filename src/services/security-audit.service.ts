/**
 * Security Audit Logging Service
 * Logs all security-relevant events to the database
 */

import prisma from '@/config/database';
import { logger } from '@/utils/logger';
import { Request } from 'express';
import { SecurityContext } from '@/middleware/security.middleware';

// Security event types
export enum SecurityEventType {
  // Authentication events
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_COMPLETE = 'PASSWORD_RESET_COMPLETE',
  
  // 2FA events
  TWO_FA_ENABLED = 'TWO_FA_ENABLED',
  TWO_FA_DISABLED = 'TWO_FA_DISABLED',
  TWO_FA_VERIFIED = 'TWO_FA_VERIFIED',
  TWO_FA_FAILED = 'TWO_FA_FAILED',
  
  // Account events
  ACCOUNT_CREATED = 'ACCOUNT_CREATED',
  ACCOUNT_DELETED = 'ACCOUNT_DELETED',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  USER_INVITED = 'USER_INVITED',
  USER_REMOVED = 'USER_REMOVED',
  ROLE_CHANGED = 'ROLE_CHANGED',
  
  // API & Access events
  API_KEY_CREATED = 'API_KEY_CREATED',
  API_KEY_REVOKED = 'API_KEY_REVOKED',
  FACEBOOK_CONNECTED = 'FACEBOOK_CONNECTED',
  FACEBOOK_DISCONNECTED = 'FACEBOOK_DISCONNECTED',
  
  // Security events
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  CSRF_VIOLATION = 'CSRF_VIOLATION',
  INJECTION_ATTEMPT = 'INJECTION_ATTEMPT',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  IP_BLOCKED = 'IP_BLOCKED',
  
  // Data events
  BULK_DELETE = 'BULK_DELETE',
  DATA_EXPORT = 'DATA_EXPORT',
  SETTINGS_CHANGED = 'SETTINGS_CHANGED',
  
  // Admin events
  ADMIN_IMPERSONATE = 'ADMIN_IMPERSONATE',
  ADMIN_CONFIG_CHANGE = 'ADMIN_CONFIG_CHANGE',
}

// Severity levels
export enum SecuritySeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

// Event severity mapping
const eventSeverityMap: Record<SecurityEventType, SecuritySeverity> = {
  [SecurityEventType.LOGIN_SUCCESS]: SecuritySeverity.INFO,
  [SecurityEventType.LOGIN_FAILED]: SecuritySeverity.WARNING,
  [SecurityEventType.LOGOUT]: SecuritySeverity.INFO,
  [SecurityEventType.TOKEN_REFRESH]: SecuritySeverity.INFO,
  [SecurityEventType.PASSWORD_CHANGE]: SecuritySeverity.WARNING,
  [SecurityEventType.PASSWORD_RESET_REQUEST]: SecuritySeverity.WARNING,
  [SecurityEventType.PASSWORD_RESET_COMPLETE]: SecuritySeverity.WARNING,
  [SecurityEventType.TWO_FA_ENABLED]: SecuritySeverity.INFO,
  [SecurityEventType.TWO_FA_DISABLED]: SecuritySeverity.WARNING,
  [SecurityEventType.TWO_FA_VERIFIED]: SecuritySeverity.INFO,
  [SecurityEventType.TWO_FA_FAILED]: SecuritySeverity.WARNING,
  [SecurityEventType.ACCOUNT_CREATED]: SecuritySeverity.INFO,
  [SecurityEventType.ACCOUNT_DELETED]: SecuritySeverity.CRITICAL,
  [SecurityEventType.ACCOUNT_SUSPENDED]: SecuritySeverity.WARNING,
  [SecurityEventType.USER_INVITED]: SecuritySeverity.INFO,
  [SecurityEventType.USER_REMOVED]: SecuritySeverity.WARNING,
  [SecurityEventType.ROLE_CHANGED]: SecuritySeverity.WARNING,
  [SecurityEventType.API_KEY_CREATED]: SecuritySeverity.INFO,
  [SecurityEventType.API_KEY_REVOKED]: SecuritySeverity.WARNING,
  [SecurityEventType.FACEBOOK_CONNECTED]: SecuritySeverity.INFO,
  [SecurityEventType.FACEBOOK_DISCONNECTED]: SecuritySeverity.INFO,
  [SecurityEventType.RATE_LIMIT_EXCEEDED]: SecuritySeverity.WARNING,
  [SecurityEventType.CSRF_VIOLATION]: SecuritySeverity.CRITICAL,
  [SecurityEventType.INJECTION_ATTEMPT]: SecuritySeverity.CRITICAL,
  [SecurityEventType.UNAUTHORIZED_ACCESS]: SecuritySeverity.CRITICAL,
  [SecurityEventType.SUSPICIOUS_ACTIVITY]: SecuritySeverity.CRITICAL,
  [SecurityEventType.IP_BLOCKED]: SecuritySeverity.WARNING,
  [SecurityEventType.BULK_DELETE]: SecuritySeverity.WARNING,
  [SecurityEventType.DATA_EXPORT]: SecuritySeverity.INFO,
  [SecurityEventType.SETTINGS_CHANGED]: SecuritySeverity.INFO,
  [SecurityEventType.ADMIN_IMPERSONATE]: SecuritySeverity.CRITICAL,
  [SecurityEventType.ADMIN_CONFIG_CHANGE]: SecuritySeverity.WARNING,
};

export interface AuditLogEntry {
  eventType: SecurityEventType;
  userId?: string;
  accountId?: string;
  targetUserId?: string;
  targetResourceId?: string;
  targetResourceType?: string;
  ipAddress: string;
  userAgent: string;
  requestPath?: string;
  requestMethod?: string;
  details?: Record<string, any>;
  success: boolean;
  errorMessage?: string;
}

class SecurityAuditService {
  /**
   * Log a security event to the database
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      const severity = eventSeverityMap[entry.eventType] || SecuritySeverity.INFO;
      
      // Log to database using AuditLog model
      await prisma.auditLog.create({
        data: {
          action: entry.eventType,
          entityType: entry.targetResourceType || 'SYSTEM',
          entityId: entry.targetResourceId || entry.userId || 'unknown',
          userId: entry.userId,
          metadata: {
            accountId: entry.accountId,
            targetUserId: entry.targetUserId,
            success: entry.success,
            errorMessage: entry.errorMessage,
            requestPath: entry.requestPath,
            requestMethod: entry.requestMethod,
            ...(entry.details || {}),
          },
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });
      
      // Also log to application logger for real-time monitoring
      const logMessage = `[SECURITY AUDIT] ${entry.eventType}`;
      const logData = {
        severity,
        userId: entry.userId,
        accountId: entry.accountId,
        ip: entry.ipAddress,
        success: entry.success,
        details: entry.details,
      };
      
      if (severity === SecuritySeverity.CRITICAL) {
        logger.error(logMessage, logData);
      } else if (severity === SecuritySeverity.WARNING) {
        logger.warn(logMessage, logData);
      } else {
        logger.info(logMessage, logData);
      }
      
      // For critical events, trigger alerts
      if (severity === SecuritySeverity.CRITICAL) {
        await this.triggerSecurityAlert(entry);
      }
    } catch (error) {
      // Never fail silently on audit logging errors
      logger.error('Failed to write security audit log', { error, entry });
    }
  }

  /**
   * Log from a request object (convenience method)
   */
  async logFromRequest(
    req: Request,
    eventType: SecurityEventType,
    options: Partial<AuditLogEntry> = {}
  ): Promise<void> {
    const context = (req as any).securityContext as SecurityContext | undefined;
    const user = (req as any).user;
    
    await this.log({
      eventType,
      userId: user?.id || options.userId,
      accountId: user?.accountIds?.[0] || options.accountId,
      ipAddress: context?.ip || req.ip || 'unknown',
      userAgent: context?.userAgent || req.headers['user-agent'] || 'unknown',
      requestPath: req.path,
      requestMethod: req.method,
      success: true,
      ...options,
    });
  }

  /**
   * Trigger security alerts for critical events
   */
  private async triggerSecurityAlert(entry: AuditLogEntry): Promise<void> {
    try {
      // Log critical alert
      logger.error('🚨 CRITICAL SECURITY EVENT', {
        eventType: entry.eventType,
        userId: entry.userId,
        ip: entry.ipAddress,
        details: entry.details,
      });
      
      // TODO: Send email/Slack notification for critical events
      // await notificationService.sendSecurityAlert(entry);
    } catch (error) {
      logger.error('Failed to trigger security alert', { error });
    }
  }

  /**
   * Query audit logs with filters
   */
  async query(filters: {
    userId?: string;
    eventTypes?: SecurityEventType[];
    startDate?: Date;
    endDate?: Date;
    ipAddress?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const where: any = {};
    
    if (filters.userId) where.userId = filters.userId;
    if (filters.eventTypes?.length) where.action = { in: filters.eventTypes };
    if (filters.ipAddress) where.ipAddress = filters.ipAddress;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }
    
    return prisma.auditLog.findMany({
      where,
      take: filters.limit || 100,
      skip: filters.offset || 0,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get security summary for dashboard
   */
  async getSecuritySummary(hours: number = 24): Promise<{
    totalEvents: number;
    criticalEvents: number;
    failedLogins: number;
    suspiciousActivities: number;
    topIPs: { ip: string; count: number }[];
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const [totalEvents, criticalEvents, failedLogins, suspiciousActivities] = await Promise.all([
      prisma.auditLog.count({
        where: {
          createdAt: { gte: since },
        },
      }),
      prisma.auditLog.count({
        where: {
          createdAt: { gte: since },
          action: { in: [
            SecurityEventType.CSRF_VIOLATION,
            SecurityEventType.INJECTION_ATTEMPT,
            SecurityEventType.UNAUTHORIZED_ACCESS,
            SecurityEventType.SUSPICIOUS_ACTIVITY,
          ]},
        },
      }),
      prisma.auditLog.count({
        where: {
          createdAt: { gte: since },
          action: SecurityEventType.LOGIN_FAILED,
        },
      }),
      prisma.auditLog.count({
        where: {
          createdAt: { gte: since },
          action: SecurityEventType.SUSPICIOUS_ACTIVITY,
        },
      }),
    ]);
    
    // Get top IPs
    const ipCounts = await prisma.auditLog.groupBy({
      by: ['ipAddress'],
      where: {
        createdAt: { gte: since },
      },
      _count: { ipAddress: true },
      orderBy: { _count: { ipAddress: 'desc' } },
      take: 10,
    });
    
    return {
      totalEvents,
      criticalEvents,
      failedLogins,
      suspiciousActivities,
      topIPs: ipCounts.map(item => ({
        ip: item.ipAddress || 'unknown',
        count: item._count.ipAddress,
      })),
    };
  }
}

export const securityAuditService = new SecurityAuditService();
