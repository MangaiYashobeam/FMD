import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth';
import prisma from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

/**
 * Super Admin Controller
 * System-wide administration for company owners
 */
export class AdminController {
  /**
   * Get all accounts (system-wide)
   */
  async getAllAccounts(req: AuthRequest, res: Response): Promise<void> {
    const { status, search, limit = 50, offset = 0 } = req.query;

    const where: any = {};

    if (status) {
      where.subscriptionStatus = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { dealershipName: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [accounts, total] = await Promise.all([
      prisma.account.findMany({
        where,
        include: {
          subscriptionPlan: true,
          accountUsers: {
            include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
          },
          _count: {
            select: {
              vehicles: true,
              syncJobs: true,
              payments: true,
            },
          },
        },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.account.count({ where }),
    ]);

    res.json({
      data: accounts,
      pagination: { total, limit: parseInt(limit as string), offset: parseInt(offset as string) },
    });
  }

  /**
   * Get system-wide statistics
   */
  async getSystemStats(_req: AuthRequest, res: Response): Promise<void> {
    const [
      totalAccounts,
      activeAccounts,
      totalUsers,
      totalVehicles,
      totalPosts,
      recentPayments,
      subscriptionBreakdown,
    ] = await Promise.all([
      prisma.account.count(),
      prisma.account.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.vehicle.count(),
      prisma.facebookPost.count(),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
          status: 'succeeded',
        },
      }),
      prisma.account.groupBy({
        by: ['subscriptionPlanId'],
        _count: true,
      }),
    ]);

    res.json({
      accounts: {
        total: totalAccounts,
        active: activeAccounts,
        inactive: totalAccounts - activeAccounts,
      },
      users: totalUsers,
      vehicles: totalVehicles,
      posts: totalPosts,
      revenue: {
        last30Days: parseFloat(recentPayments._sum.amount?.toString() || '0'),
      },
      subscriptions: subscriptionBreakdown,
    });
  }

  /**
   * Get all payments (system-wide)
   */
  async getAllPayments(req: AuthRequest, res: Response): Promise<void> {
    const { status, limit = 50, offset = 0, startDate, endDate } = req.query;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          account: {
            select: {
              id: true,
              name: true,
              dealershipName: true,
            },
          },
        },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({
      data: payments,
      pagination: { total, limit: parseInt(limit as string), offset: parseInt(offset as string) },
    });
  }

  /**
   * Get revenue analytics
   */
  async getRevenueAnalytics(req: AuthRequest, res: Response): Promise<void> {
    const { period = '30d' } = req.query;

    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const payments = await prisma.payment.findMany({
      where: {
        createdAt: { gte: startDate },
        status: 'succeeded',
      },
      select: {
        amount: true,
        createdAt: true,
        account: {
          select: {
            subscriptionPlan: { select: { name: true } },
          },
        },
      },
    });

    // Group by day
    const dailyRevenue: Record<string, number> = {};
    payments.forEach(payment => {
      const day = payment.createdAt.toISOString().split('T')[0];
      dailyRevenue[day] = (dailyRevenue[day] || 0) + parseFloat(payment.amount.toString());
    });

    // Calculate totals
    const totalRevenue = payments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
    const avgDaily = totalRevenue / days;

    res.json({
      period,
      totalRevenue,
      avgDailyRevenue: avgDaily,
      transactionCount: payments.length,
      dailyRevenue,
    });
  }

  /**
   * Update account status (activate/deactivate)
   */
  async updateAccountStatus(req: AuthRequest, res: Response): Promise<void> {
    const accountId = req.params.accountId as string;
    const { isActive, reason } = req.body;

    const account = await prisma.account.update({
      where: { id: accountId },
      data: { isActive },
    });

    // Log action
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: isActive ? 'ACCOUNT_ACTIVATED' : 'ACCOUNT_DEACTIVATED',
        entityType: 'Account',
        entityId: accountId,
        metadata: { isActive, reason },
      },
    });

    logger.info(`Account ${accountId} ${isActive ? 'activated' : 'deactivated'} by admin ${req.user!.id}`);

    res.json(account);
  }

  /**
   * Get all users (system-wide)
   */
  async getAllUsers(req: AuthRequest, res: Response): Promise<void> {
    const { search, limit = 50, offset = 0, role } = req.query;

    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search as string, mode: 'insensitive' } },
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    let users = await prisma.user.findMany({
      where,
      include: {
        accountUsers: {
          include: {
            account: { select: { id: true, name: true } },
          },
        },
      },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      orderBy: { createdAt: 'desc' },
    });

    // Filter by role if specified
    if (role) {
      users = users.filter(user =>
        user.accountUsers.some(au => au.role === role)
      );
    }

    const total = await prisma.user.count({ where });

    res.json({
      data: users.map(user => ({
        ...user,
        passwordHash: undefined, // Don't expose password hash
      })),
      pagination: { total, limit: parseInt(limit as string), offset: parseInt(offset as string) },
    });
  }

  /**
   * Update user role
   */
  async updateUserRole(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.params.userId as string;
    const accountId = req.params.accountId as string;
    const { role } = req.body;

    if (!['SUPER_ADMIN', 'ACCOUNT_OWNER', 'ADMIN', 'SALES_REP', 'VIEWER'].includes(role)) {
      throw new AppError('Invalid role', 400);
    }

    const accountUser = await prisma.accountUser.update({
      where: {
        accountId_userId: {
          accountId,
          userId,
        },
      },
      data: { role },
    });

    // Log action
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'USER_ROLE_UPDATED',
        entityType: 'AccountUser',
        entityId: accountUser.id,
        metadata: { userId, accountId, newRole: role },
      },
    });

    logger.info(`User ${userId} role updated to ${role} in account ${accountId} by admin ${req.user!.id}`);

    res.json(accountUser);
  }

  /**
   * Get audit logs (system-wide or account-specific)
   */
  async getAuditLogs(req: AuthRequest, res: Response): Promise<void> {
    const { accountId, userId, action, limit = 100, offset = 0, startDate, endDate } = req.query;

    const where: any = {};

    if (accountId) {
      where.entityId = accountId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (action) {
      where.action = action;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      data: logs,
      pagination: { total, limit: parseInt(limit as string), offset: parseInt(offset as string) },
    });
  }

  /**
   * Create new account (for onboarding clients)
   * 
   * SECURITY: 
   * - Uses cryptographically secure temporary password
   * - Explicit field allowlist prevents mass assignment
   * - Password is NEVER logged
   */
  async createAccount(req: AuthRequest, res: Response): Promise<void> {
    const {
      name,
      dealershipName,
      ownerEmail,
      ownerFirstName,
      ownerLastName,
      subscriptionPlanId,
    } = req.body;

    // SECURITY: Validate required fields
    if (!name || !dealershipName || !ownerEmail) {
      res.status(400).json({ error: 'Missing required fields: name, dealershipName, ownerEmail' });
      return;
    }

    // Check if owner user exists
    let ownerUser = await prisma.user.findUnique({
      where: { email: ownerEmail },
    });

    // Create owner user if doesn't exist
    let tempPassword: string | undefined;
    if (!ownerUser) {
      const bcrypt = require('bcrypt');
      const crypto = require('crypto');
      // SECURITY: Use cryptographically secure random password
      tempPassword = crypto.randomBytes(16).toString('base64url').slice(0, 16);

      ownerUser = await prisma.user.create({
        data: {
          email: ownerEmail,
          firstName: ownerFirstName,
          lastName: ownerLastName,
          passwordHash: await bcrypt.hash(tempPassword, 12), // SECURITY: Cost factor 12
          emailVerified: false,
        },
      });

      // SECURITY: NEVER log the actual password
      logger.info(`Created new user ${ownerUser.id} - temporary password generated (not logged for security)`);
    }

    // SECURITY: Create account with explicit fields only - prevents mass assignment
    const account = await prisma.account.create({
      data: {
        name,
        dealershipName,
        subscriptionPlanId: subscriptionPlanId || undefined,
        subscriptionStatus: 'trial',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
      },
    });

    // Add owner to account
    await prisma.accountUser.create({
      data: {
        accountId: account.id,
        userId: ownerUser.id,
        role: 'ACCOUNT_OWNER',
      },
    });

    // Create default settings
    await prisma.accountSettings.create({
      data: {
        accountId: account.id,
      },
    });

    // Log action
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'ACCOUNT_CREATED',
        entityType: 'Account',
        entityId: account.id,
        metadata: { name, dealershipName, ownerEmail },
      },
    });

    logger.info(`Account ${account.id} created by admin ${req.user!.id} for owner ${ownerUser.id}`);

    res.status(201).json({
      account,
      owner: {
        id: ownerUser.id,
        email: ownerUser.email,
      },
    });
  }

  /**
   * Delete account (soft delete)
   */
  async deleteAccount(req: AuthRequest, res: Response): Promise<void> {
    const accountId = req.params.accountId as string;
    const { reason } = req.body;

    await prisma.account.update({
      where: { id: accountId },
      data: { isActive: false },
    });

    // Log action
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'ACCOUNT_DELETED',
        entityType: 'Account',
        entityId: accountId,
        metadata: { reason },
      },
    });

    logger.warn(`Account ${accountId} deleted by admin ${req.user!.id}: ${reason}`);

    res.json({ success: true, message: 'Account deactivated' });
  }
}
