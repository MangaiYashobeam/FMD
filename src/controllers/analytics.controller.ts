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
}
