import { Response } from 'express';
import prisma from '@/config/database';
import { AuthRequest } from '@/middleware/auth';
import { logger } from '@/utils/logger';

export class AnalyticsController {
  /**
   * Get analytics overview - key metrics
   */
  async getOverview(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { startDate, endDate, period = 'month' } = req.query;

      // Get user's account
      const accountUser = await prisma.accountUser.findFirst({
        where: { userId },
        include: { account: true },
      });

      if (!accountUser) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }

      const accountId = accountUser.accountId;
      
      // Calculate date range
      const now = new Date();
      let dateStart: Date;
      
      if (startDate) {
        dateStart = new Date(startDate as string);
      } else {
        switch (period) {
          case 'day':
            dateStart = new Date(now.setDate(now.getDate() - 1));
            break;
          case 'week':
            dateStart = new Date(now.setDate(now.getDate() - 7));
            break;
          case 'month':
          default:
            dateStart = new Date(now.setMonth(now.getMonth() - 1));
            break;
        }
      }

      const dateEnd = endDate ? new Date(endDate as string) : new Date();

      // Get metrics
      const [
        totalVehicles,
        activeListings,
        totalLeads,
        newLeadsThisPeriod,
        facebookPosts,
        activeProfiles,
        messagesCount,
        conversionRate,
      ] = await Promise.all([
        // Total vehicles
        prisma.vehicle.count({ where: { accountId } }),
        
        // Active listings (vehicles with active FB posts)
        prisma.facebookPost.count({
          where: {
            vehicle: { accountId },
            status: 'ACTIVE',
          },
        }),
        
        // Total leads
        prisma.lead.count({ where: { accountId } }),
        
        // New leads this period
        prisma.lead.count({
          where: {
            accountId,
            createdAt: { gte: dateStart, lte: dateEnd },
          },
        }),
        
        // Facebook posts this period
        prisma.facebookPost.count({
          where: {
            vehicle: { accountId },
            createdAt: { gte: dateStart, lte: dateEnd },
          },
        }),
        
        // Active Facebook profiles
        prisma.facebookProfile.count({
          where: { accountId, isActive: true },
        }),
        
        // Messages this period
        prisma.message.count({
          where: {
            lead: { accountId },
            sentAt: { gte: dateStart, lte: dateEnd },
          },
        }),
        
        // Calculate conversion (leads that converted to sales)
        prisma.lead.count({
          where: {
            accountId,
            status: 'WON',
            closedAt: { gte: dateStart, lte: dateEnd },
          },
        }),
      ]);

      // Calculate averages and rates
      const conversionPercentage = totalLeads > 0 ? ((conversionRate / totalLeads) * 100).toFixed(1) : 0;

      return res.json({
        success: true,
        data: {
          inventory: {
            total: totalVehicles,
            active: activeListings,
            pending: totalVehicles - activeListings,
          },
          leads: {
            total: totalLeads,
            new: newLeadsThisPeriod,
            converted: conversionRate,
            conversionRate: conversionPercentage,
          },
          facebook: {
            posts: facebookPosts,
            activeProfiles,
          },
          engagement: {
            messages: messagesCount,
          },
          period: {
            start: dateStart.toISOString(),
            end: dateEnd.toISOString(),
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching analytics overview:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
    }
  }

  /**
   * Get leads trend over time
   */
  async getLeadsTrend(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { days = 30 } = req.query;

      const accountUser = await prisma.accountUser.findFirst({
        where: { userId },
      });

      if (!accountUser) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Number(days));

      // Get leads grouped by day
      const leads = await prisma.lead.groupBy({
        by: ['createdAt'],
        where: {
          accountId: accountUser.accountId,
          createdAt: { gte: startDate },
        },
        _count: true,
      });

      // Format into daily data points
      const dailyData: { date: string; count: number }[] = [];
      const dateMap = new Map<string, number>();

      leads.forEach((l) => {
        const dateKey = l.createdAt.toISOString().split('T')[0];
        dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + l._count);
      });

      // Fill in all days in range
      for (let i = 0; i < Number(days); i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        const dateKey = date.toISOString().split('T')[0];
        dailyData.push({
          date: dateKey,
          count: dateMap.get(dateKey) || 0,
        });
      }

      return res.json({
        success: true,
        data: dailyData,
      });
    } catch (error) {
      logger.error('Error fetching leads trend:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch leads trend' });
    }
  }

  /**
   * Get lead sources breakdown
   */
  async getLeadSources(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      const accountUser = await prisma.accountUser.findFirst({
        where: { userId },
      });

      if (!accountUser) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }

      const sources = await prisma.lead.groupBy({
        by: ['source'],
        where: { accountId: accountUser.accountId },
        _count: true,
      });

      const data = sources.map((s) => ({
        source: s.source || 'Unknown',
        count: s._count,
      }));

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Error fetching lead sources:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch lead sources' });
    }
  }

  /**
   * Get top performing vehicles
   */
  async getTopVehicles(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { limit = 10 } = req.query;

      const accountUser = await prisma.accountUser.findFirst({
        where: { userId },
      });

      if (!accountUser) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }

      // Get vehicles with most leads
      const vehicles = await prisma.vehicle.findMany({
        where: { accountId: accountUser.accountId },
        include: {
          _count: {
            select: {
              leads: true,
            },
          },
        },
        orderBy: {
          leads: { _count: 'desc' },
        },
        take: Number(limit),
      });

      const data = vehicles.map((v) => ({
        id: v.id,
        year: v.year,
        make: v.make,
        model: v.model,
        vin: v.vin,
        price: v.price,
        leads: v._count.leads,
      }));

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Error fetching top vehicles:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch top vehicles' });
    }
  }

  /**
   * Get recent activity feed
   */
  async getActivity(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { limit = 20 } = req.query;

      const accountUser = await prisma.accountUser.findFirst({
        where: { userId },
      });

      if (!accountUser) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }

      // Get recent activities from multiple sources
      const [recentLeads, recentPosts, recentMessages] = await Promise.all([
        prisma.lead.findMany({
          where: { accountId: accountUser.accountId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            fullName: true,
            firstName: true,
            lastName: true,
            source: true,
            createdAt: true,
          },
        }),
        prisma.facebookPost.findMany({
          where: { vehicle: { accountId: accountUser.accountId } },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            vehicle: {
              select: { year: true, make: true, model: true },
            },
          },
        }),
        prisma.message.findMany({
          where: { lead: { accountId: accountUser.accountId } },
          orderBy: { sentAt: 'desc' },
          take: 10,
          include: {
            lead: {
              select: { fullName: true, firstName: true, lastName: true },
            },
          },
        }),
      ]);

      // Combine and sort activities
      const activities = [
        ...recentLeads.map((l) => ({
          type: 'lead' as const,
          id: l.id,
          description: `New lead from ${l.fullName || `${l.firstName || ''} ${l.lastName || ''}`.trim() || 'Unknown'}`,
          source: l.source,
          timestamp: l.createdAt,
        })),
        ...recentPosts.map((p) => ({
          type: 'post' as const,
          id: p.id,
          description: `Posted ${p.vehicle.year} ${p.vehicle.make} ${p.vehicle.model} to Facebook`,
          status: p.status,
          timestamp: p.createdAt,
        })),
        ...recentMessages.map((m) => ({
          type: 'message' as const,
          id: m.id,
          description: `${m.isOutgoing ? 'Sent message to' : 'Received message from'} ${m.lead.fullName || `${m.lead.firstName || ''} ${m.lead.lastName || ''}`.trim() || 'Unknown'}`,
          isOutgoing: m.isOutgoing,
          timestamp: m.sentAt,
        })),
      ]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, Number(limit));

      return res.json({
        success: true,
        data: activities,
      });
    } catch (error) {
      logger.error('Error fetching activity:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch activity' });
    }
  }

  /**
   * Get key metrics summary
   */
  async getMetrics(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      const accountUser = await prisma.accountUser.findFirst({
        where: { userId },
      });

      if (!accountUser) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }

      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const [
        leadsThisMonth,
        leadsLastMonth,
        postsThisMonth,
        postsLastMonth,
        messagesThisMonth,
        messagesLastMonth,
      ] = await Promise.all([
        prisma.lead.count({
          where: { accountId: accountUser.accountId, createdAt: { gte: thisMonth } },
        }),
        prisma.lead.count({
          where: { accountId: accountUser.accountId, createdAt: { gte: lastMonth, lt: thisMonth } },
        }),
        prisma.facebookPost.count({
          where: { vehicle: { accountId: accountUser.accountId }, createdAt: { gte: thisMonth } },
        }),
        prisma.facebookPost.count({
          where: { vehicle: { accountId: accountUser.accountId }, createdAt: { gte: lastMonth, lt: thisMonth } },
        }),
        prisma.message.count({
          where: { lead: { accountId: accountUser.accountId }, sentAt: { gte: thisMonth } },
        }),
        prisma.message.count({
          where: { lead: { accountId: accountUser.accountId }, sentAt: { gte: lastMonth, lt: thisMonth } },
        }),
      ]);

      const calculateChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous * 100).toFixed(1);
      };

      return res.json({
        success: true,
        data: {
          leads: {
            current: leadsThisMonth,
            previous: leadsLastMonth,
            change: calculateChange(leadsThisMonth, leadsLastMonth),
          },
          posts: {
            current: postsThisMonth,
            previous: postsLastMonth,
            change: calculateChange(postsThisMonth, postsLastMonth),
          },
          messages: {
            current: messagesThisMonth,
            previous: messagesLastMonth,
            change: calculateChange(messagesThisMonth, messagesLastMonth),
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching metrics:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch metrics' });
    }
  }

  /**
   * Get full analytics dashboard data in one call
   * Returns overview, trends, sources, top vehicles, and activity
   */
  async getDashboard(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { period = '30d' } = req.query;

      const accountUser = await prisma.accountUser.findFirst({
        where: { userId },
      });

      if (!accountUser) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }

      const accountId = accountUser.accountId;
      
      // Calculate date ranges based on period
      const now = new Date();
      let days = 30;
      switch (period) {
        case '7d': days = 7; break;
        case '30d': days = 30; break;
        case '90d': days = 90; break;
        case 'year': days = 365; break;
      }
      
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const prevStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);

      // Run all queries in parallel
      const [
        // Current period metrics
        totalVehicles,
        activeListings,
        totalLeads,
        totalPosts,
        // Previous period metrics for changes
        prevLeads,
        prevPosts,
        // Lead sources breakdown
        leadSources,
        // Top vehicles with leads count
        topVehicles,
        // Recent activities
        recentLeads,
        recentPosts,
        // Daily leads for chart
        dailyLeads,
        // Daily posts (as proxy for views)
        dailyPosts,
        // Conversion rate
        wonLeads,
        // Sold vehicles for avg days calculation
        soldVehiclesCount,
      ] = await Promise.all([
        prisma.vehicle.count({ where: { accountId } }),
        prisma.facebookPost.count({ where: { vehicle: { accountId }, status: 'ACTIVE' } }),
        prisma.lead.count({ where: { accountId, createdAt: { gte: startDate } } }),
        prisma.facebookPost.count({ where: { vehicle: { accountId }, createdAt: { gte: startDate } } }),
        prisma.lead.count({ where: { accountId, createdAt: { gte: prevStartDate, lt: startDate } } }),
        prisma.facebookPost.count({ where: { vehicle: { accountId }, createdAt: { gte: prevStartDate, lt: startDate } } }),
        prisma.lead.groupBy({
          by: ['source'],
          where: { accountId, createdAt: { gte: startDate } },
          _count: true,
        }),
        prisma.vehicle.findMany({
          where: { accountId },
          include: {
            _count: { select: { leads: true, facebookPosts: true } },
          },
          orderBy: { leads: { _count: 'desc' } },
          take: 5,
        }),
        prisma.lead.findMany({
          where: { accountId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, fullName: true, firstName: true, lastName: true, source: true, createdAt: true },
        }),
        prisma.facebookPost.findMany({
          where: { vehicle: { accountId } },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { vehicle: { select: { year: true, make: true, model: true } } },
        }),
        prisma.$queryRaw<{ date: string; count: bigint }[]>`
          SELECT DATE("created_at") as date, COUNT(*) as count 
          FROM "leads" 
          WHERE "account_id" = ${accountId} AND "created_at" >= ${startDate}
          GROUP BY DATE("created_at")
          ORDER BY date ASC
        `,
        prisma.$queryRaw<{ date: string; count: bigint }[]>`
          SELECT DATE(fp."created_at") as date, COUNT(*) as count 
          FROM "facebook_posts" fp
          JOIN "vehicles" v ON fp."vehicle_id" = v.id
          WHERE v."account_id" = ${accountId} AND fp."created_at" >= ${startDate}
          GROUP BY DATE(fp."created_at")
          ORDER BY date ASC
        `,
        prisma.lead.count({ where: { accountId, status: 'WON', createdAt: { gte: startDate } } }),
        prisma.vehicle.count({ where: { accountId, status: 'SOLD' } }),
      ]);

      // Calculate changes
      const calculateChange = (current: number, previous: number): number => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
      };

      // Estimate total views based on posts (average 50 views per post)
      const totalViews = totalPosts * 50;
      const prevViews = prevPosts * 50;

      // Calculate conversion rate
      const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : '0';

      // Calculate average days on market (estimate based on sold count)
      const avgDaysOnMarket = soldVehiclesCount > 0 ? Math.round(days / 2) : 14;

      // Format lead sources with percentages
      const totalSourceLeads = leadSources.reduce((sum, s) => sum + s._count, 0);
      const sourceBreakdown = leadSources.map(s => ({
        source: s.source || 'Direct',
        count: s._count,
        percentage: totalSourceLeads > 0 ? Math.round((s._count / totalSourceLeads) * 100) : 0,
      }));

      // Format top vehicles
      const formattedTopVehicles = topVehicles.map(v => ({
        id: v.id,
        vehicle: `${v.year} ${v.make} ${v.model}`,
        views: v._count.facebookPosts * 50, // Estimate views
        leads: v._count.leads,
        status: v.status?.toLowerCase() || 'active',
      }));

      // Format charts - fill in missing dates
      const leadsChartMap = new Map(dailyLeads.map(d => [String(d.date), Number(d.count)]));
      const viewsChartMap = new Map(dailyPosts.map(d => [String(d.date), Number(d.count) * 50]));
      
      const leadsChart: { date: string; value: number }[] = [];
      const viewsChart: { date: string; value: number }[] = [];
      
      for (let i = 0; i < Math.min(days, 30); i++) {
        const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const dateKey = date.toISOString().split('T')[0];
        leadsChart.push({ date: dateKey, value: leadsChartMap.get(dateKey) || 0 });
        viewsChart.push({ date: dateKey, value: viewsChartMap.get(dateKey) || 0 });
      }

      // Format recent activity
      const recentActivity = [
        ...recentLeads.map(l => ({
          id: l.id,
          type: 'lead',
          message: `New lead from ${l.fullName || `${l.firstName || ''} ${l.lastName || ''}`.trim() || 'Unknown'} via ${l.source || 'Direct'}`,
          timestamp: l.createdAt.toISOString(),
        })),
        ...recentPosts.map(p => ({
          id: p.id,
          type: 'post',
          message: `Posted ${p.vehicle.year} ${p.vehicle.make} ${p.vehicle.model} to Marketplace`,
          timestamp: p.createdAt.toISOString(),
        })),
      ]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);

      return res.json({
        success: true,
        data: {
          overview: {
            totalListings: totalVehicles,
            totalLeads,
            totalViews,
            totalPosts,
            conversionRate: parseFloat(conversionRate),
            averageDaysOnMarket: avgDaysOnMarket,
          },
          changes: {
            listings: calculateChange(activeListings, activeListings),
            leads: calculateChange(totalLeads, prevLeads),
            views: calculateChange(totalViews, prevViews),
            posts: calculateChange(totalPosts, prevPosts),
          },
          leadsChart,
          viewsChart,
          sourceBreakdown: sourceBreakdown.length > 0 ? sourceBreakdown : [
            { source: 'Facebook Marketplace', count: 0, percentage: 100 },
          ],
          topVehicles: formattedTopVehicles.length > 0 ? formattedTopVehicles : [],
          recentActivity,
        },
      });
    } catch (error) {
      logger.error('Error fetching analytics dashboard:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch analytics dashboard' });
    }
  }
}
