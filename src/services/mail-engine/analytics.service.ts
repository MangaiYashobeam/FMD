/**
 * Email Analytics Service
 * Aggregates email statistics and performance metrics
 */

import { logger } from '@/utils/logger';
import prisma from '@/config/database';

interface AnalyticsOptions {
  startDate: Date;
  endDate: Date;
  period?: 'HOUR' | 'DAY' | 'WEEK' | 'MONTH';
  accountId?: string;
  domain?: string;
}

export interface AnalyticsData {
  overview: {
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalClicked: number;
    totalBounced: number;
    totalComplaints: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
  };
  timeSeries: Array<{
    period: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
  }>;
  topPerformingTemplates: Array<{
    templateSlug: string;
    sent: number;
    openRate: number;
    clickRate: number;
  }>;
  domainHealth: {
    domain: string;
    reputation: number;
    deliverabilityScore: number;
    recentBounceRate: number;
    recentComplaintRate: number;
  };
}

/**
 * Email Analytics Service
 * Provides comprehensive analytics and reporting
 */
class EmailAnalyticsService {
  /**
   * Get comprehensive analytics
   */
  async getAnalytics(options: AnalyticsOptions): Promise<AnalyticsData> {
    const { startDate, endDate, period = 'DAY', accountId, domain } = options;

    // Build where clause
    const where: any = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (accountId) {
      where.accountId = accountId;
    }

    // Get overview stats
    const overview = await this.getOverviewStats(where);

    // Get time series data
    const timeSeries = await this.getTimeSeriesStats(startDate, endDate, period, where);

    // Get top performing templates
    const topPerformingTemplates = await this.getTopTemplates(where);

    // Get domain health
    const targetDomain = domain || process.env.MAIL_DOMAIN || 'dealersface.com';
    const domainHealth = await this.getDomainHealth(targetDomain);

    return {
      overview,
      timeSeries,
      topPerformingTemplates,
      domainHealth,
    };
  }

  /**
   * Get overview statistics
   */
  private async getOverviewStats(where: any) {
    const [totals, openedCount, clickedCount] = await Promise.all([
      prisma.emailLog.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      prisma.emailLog.count({
        where: {
          ...where,
          openedAt: { not: null },
        },
      }),
      prisma.emailLog.count({
        where: {
          ...where,
          clickedAt: { not: null },
        },
      }),
    ]);

    // Calculate totals
    let totalSent = 0;
    let totalDelivered = 0;
    let totalBounced = 0;
    let totalComplaints = 0;

    for (const stat of totals) {
      const count = stat._count.id;
      switch (stat.status) {
        case 'SENT':
        case 'DELIVERED':
        case 'OPENED':
        case 'CLICKED':
          totalSent += count;
          if (stat.status !== 'SENT') {
            totalDelivered += count;
          }
          break;
        case 'BOUNCED':
          totalSent += count;
          totalBounced += count;
          break;
        case 'COMPLAINED':
          totalSent += count;
          totalComplaints += count;
          break;
      }
    }

    // Also count delivered status explicitly
    const deliveredOnly = totals.find((t) => t.status === 'DELIVERED');
    if (deliveredOnly) {
      totalDelivered = deliveredOnly._count.id;
    }

    return {
      totalSent,
      totalDelivered,
      totalOpened: openedCount,
      totalClicked: clickedCount,
      totalBounced,
      totalComplaints,
      deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
      openRate: totalDelivered > 0 ? (openedCount / totalDelivered) * 100 : 0,
      clickRate: totalDelivered > 0 ? (clickedCount / totalDelivered) * 100 : 0,
      bounceRate: totalSent > 0 ? (totalBounced / totalSent) * 100 : 0,
    };
  }

  /**
   * Get time series statistics
   */
  private async getTimeSeriesStats(
    startDate: Date,
    endDate: Date,
    period: 'HOUR' | 'DAY' | 'WEEK' | 'MONTH',
    baseWhere: any
  ): Promise<Array<{
    period: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
  }>> {
    // Generate time buckets
    const buckets: Date[] = [];
    let current = new Date(startDate);

    while (current <= endDate) {
      buckets.push(new Date(current));
      switch (period) {
        case 'HOUR':
          current.setHours(current.getHours() + 1);
          break;
        case 'DAY':
          current.setDate(current.getDate() + 1);
          break;
        case 'WEEK':
          current.setDate(current.getDate() + 7);
          break;
        case 'MONTH':
          current.setMonth(current.getMonth() + 1);
          break;
      }
    }

    // Get data for each bucket
    const result: Array<{
      period: string;
      sent: number;
      delivered: number;
      opened: number;
      clicked: number;
      bounced: number;
    }> = [];

    for (let i = 0; i < buckets.length - 1; i++) {
      const bucketStart = buckets[i];
      const bucketEnd = buckets[i + 1];

      const [stats, opened, clicked] = await Promise.all([
        prisma.emailLog.groupBy({
          by: ['status'],
          where: {
            ...baseWhere,
            createdAt: {
              gte: bucketStart,
              lt: bucketEnd,
            },
          },
          _count: { id: true },
        }),
        prisma.emailLog.count({
          where: {
            ...baseWhere,
            openedAt: {
              gte: bucketStart,
              lt: bucketEnd,
            },
          },
        }),
        prisma.emailLog.count({
          where: {
            ...baseWhere,
            clickedAt: {
              gte: bucketStart,
              lt: bucketEnd,
            },
          },
        }),
      ]);

      let sent = 0;
      let delivered = 0;
      let bounced = 0;

      for (const stat of stats) {
        sent += stat._count.id;
        if (stat.status === 'DELIVERED' || stat.status === 'OPENED' || stat.status === 'CLICKED') {
          delivered += stat._count.id;
        }
        if (stat.status === 'BOUNCED') {
          bounced += stat._count.id;
        }
      }

      result.push({
        period: this.formatPeriodLabel(bucketStart, period),
        sent,
        delivered,
        opened,
        clicked,
        bounced,
      });
    }

    return result;
  }

  /**
   * Get top performing templates
   */
  private async getTopTemplates(baseWhere: any): Promise<
    Array<{
      templateSlug: string;
      sent: number;
      openRate: number;
      clickRate: number;
    }>
  > {
    // Get templates with most sends
    const templates = await prisma.emailLog.groupBy({
      by: ['templateSlug'],
      where: {
        ...baseWhere,
        templateSlug: { not: null },
      },
      _count: { id: true },
      orderBy: {
        _count: { id: 'desc' },
      },
      take: 10,
    });

    const result: Array<{
      templateSlug: string;
      sent: number;
      openRate: number;
      clickRate: number;
    }> = [];

    for (const template of templates) {
      if (!template.templateSlug) continue;

      const [totalSent, opened, clicked] = await Promise.all([
        prisma.emailLog.count({
          where: {
            ...baseWhere,
            templateSlug: template.templateSlug,
          },
        }),
        prisma.emailLog.count({
          where: {
            ...baseWhere,
            templateSlug: template.templateSlug,
            openedAt: { not: null },
          },
        }),
        prisma.emailLog.count({
          where: {
            ...baseWhere,
            templateSlug: template.templateSlug,
            clickedAt: { not: null },
          },
        }),
      ]);

      result.push({
        templateSlug: template.templateSlug,
        sent: totalSent,
        openRate: totalSent > 0 ? (opened / totalSent) * 100 : 0,
        clickRate: totalSent > 0 ? (clicked / totalSent) * 100 : 0,
      });
    }

    return result;
  }

  /**
   * Get domain health metrics
   */
  async getDomainHealth(domain: string): Promise<{
    domain: string;
    reputation: number;
    deliverabilityScore: number;
    recentBounceRate: number;
    recentComplaintRate: number;
  }> {
    // Get domain from database
    const domainRecord = await prisma.emailDomain.findUnique({
      where: { domain },
    });

    // Get recent stats (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentStats = await prisma.emailLog.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      _count: { id: true },
    });

    let totalRecent = 0;
    let recentBounced = 0;
    let recentComplaints = 0;
    let recentDelivered = 0;

    for (const stat of recentStats) {
      totalRecent += stat._count.id;
      if (stat.status === 'BOUNCED') {
        recentBounced += stat._count.id;
      }
      if (stat.status === 'COMPLAINED') {
        recentComplaints += stat._count.id;
      }
      if (stat.status === 'DELIVERED' || stat.status === 'OPENED' || stat.status === 'CLICKED') {
        recentDelivered += stat._count.id;
      }
    }

    const recentBounceRate = totalRecent > 0 ? (recentBounced / totalRecent) * 100 : 0;
    const recentComplaintRate = totalRecent > 0 ? (recentComplaints / totalRecent) * 100 : 0;

    // Calculate deliverability score (0-100)
    // Based on bounce rate, complaint rate, and delivery rate
    let deliverabilityScore = 100;
    deliverabilityScore -= recentBounceRate * 10; // -10 points per 1% bounce
    deliverabilityScore -= recentComplaintRate * 50; // -50 points per 1% complaint
    deliverabilityScore = Math.max(0, Math.min(100, deliverabilityScore));

    return {
      domain,
      reputation: domainRecord?.reputation || 100,
      deliverabilityScore,
      recentBounceRate,
      recentComplaintRate,
    };
  }

  /**
   * Update aggregate stats (called periodically)
   */
  async updateAggregateStats(): Promise<void> {
    try {
      const now = new Date();
      const hourStart = new Date(now);
      hourStart.setMinutes(0, 0, 0);

      // Calculate stats for current hour
      const stats = await this.getOverviewStats({
        createdAt: {
          gte: hourStart,
          lt: now,
        },
      });

      // Upsert into EmailStats table
      const whereClause: any = {
        period_periodStart_domain_accountId: {
          period: 'HOUR',
          periodStart: hourStart,
          domain: undefined,
          accountId: undefined,
        },
      };
      
      await prisma.emailStats.upsert({
        where: whereClause,
        update: {
          totalSent: stats.totalSent,
          totalDelivered: stats.totalDelivered,
          totalOpened: stats.totalOpened,
          totalClicked: stats.totalClicked,
          totalBounced: stats.totalBounced,
          totalComplaints: stats.totalComplaints,
          openRate: stats.openRate,
          clickRate: stats.clickRate,
          bounceRate: stats.bounceRate,
        },
        create: {
          period: 'HOUR',
          periodStart: hourStart,
          periodEnd: new Date(hourStart.getTime() + 60 * 60 * 1000), // 1 hour later
          totalSent: stats.totalSent,
          totalDelivered: stats.totalDelivered,
          totalOpened: stats.totalOpened,
          totalClicked: stats.totalClicked,
          totalBounced: stats.totalBounced,
          totalComplaints: stats.totalComplaints,
          openRate: stats.openRate,
          clickRate: stats.clickRate,
          bounceRate: stats.bounceRate,
        },
      });

      logger.debug('Updated aggregate email stats');
    } catch (error) {
      logger.error('Failed to update aggregate stats:', error);
    }
  }

  /**
   * Get email delivery report for a specific message
   */
  async getMessageReport(messageId: string) {
    const emailLog = await prisma.emailLog.findFirst({
      where: { messageId },
    });

    if (!emailLog) {
      return null;
    }

    // Get tracking events
    const events = await prisma.emailTrackingEvent.findMany({
      where: {
        OR: [
          { emailLogId: emailLog.id },
          { trackingId: (emailLog.metadata as any)?.trackingId },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      id: emailLog.id,
      messageId: emailLog.messageId,
      recipient: emailLog.recipient,
      subject: emailLog.subject,
      status: emailLog.status,
      sentAt: emailLog.sentAt,
      deliveredAt: emailLog.deliveredAt,
      openedAt: emailLog.openedAt,
      clickedAt: emailLog.clickedAt,
      bouncedAt: emailLog.bouncedAt,
      bounceType: emailLog.bounceType,
      bounceReason: emailLog.bounceReason,
      complainedAt: emailLog.complainedAt,
      openCount: emailLog.openCount,
      clickCount: emailLog.clickCount,
      events: events.map((e) => ({
        type: e.eventType,
        timestamp: e.createdAt,
        url: e.url,
        userAgent: e.userAgent,
        ipAddress: e.ipAddress,
      })),
    };
  }

  /**
   * Export analytics to CSV
   */
  async exportToCsv(startDate: Date, endDate: Date): Promise<string> {
    const logs = await prisma.emailLog.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = [
      'ID',
      'Recipient',
      'Subject',
      'Status',
      'Sent At',
      'Delivered At',
      'Opened At',
      'Clicked At',
      'Open Count',
      'Click Count',
      'Bounce Type',
      'Template',
    ];

    const rows = logs.map((log) => [
      log.id,
      log.recipient,
      `"${(log.subject || '').replace(/"/g, '""')}"`,
      log.status,
      log.sentAt?.toISOString() || '',
      log.deliveredAt?.toISOString() || '',
      log.openedAt?.toISOString() || '',
      log.clickedAt?.toISOString() || '',
      log.openCount || 0,
      log.clickCount || 0,
      log.bounceType || '',
      log.templateSlug || '',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  private formatPeriodLabel(date: Date, period: 'HOUR' | 'DAY' | 'WEEK' | 'MONTH'): string {
    switch (period) {
      case 'HOUR':
        return date.toISOString().slice(0, 13) + ':00';
      case 'DAY':
        return date.toISOString().slice(0, 10);
      case 'WEEK':
        return `Week of ${date.toISOString().slice(0, 10)}`;
      case 'MONTH':
        return date.toISOString().slice(0, 7);
      default:
        return date.toISOString();
    }
  }
}

export const emailAnalyticsService = new EmailAnalyticsService();
