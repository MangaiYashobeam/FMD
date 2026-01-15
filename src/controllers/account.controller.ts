import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth';
import prisma from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { FTPService } from '@/services/ftp.service';

export class AccountController {
  /**
   * Get current user's primary account
   */
  async getCurrentAccount(req: AuthRequest, res: Response) {
    const accountUser = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
      },
      include: {
        account: {
          include: {
            _count: {
              select: {
                vehicles: true,
                facebookProfiles: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc', // Return the oldest (first) account
      },
    });

    if (!accountUser) {
      throw new AppError('No account found for user', 404);
    }

    res.json({
      success: true,
      data: {
        id: accountUser.account.id,
        name: accountUser.account.name,
        dealershipName: accountUser.account.dealershipName,
        ftpHost: accountUser.account.ftpHost,
        ftpPort: accountUser.account.ftpPort,
        ftpUsername: accountUser.account.ftpUsername,
        csvPath: accountUser.account.csvPath,
        autoSync: accountUser.account.autoSync,
        syncInterval: accountUser.account.syncInterval,
        role: accountUser.role,
        vehicleCount: accountUser.account._count.vehicles,
        facebookProfileCount: accountUser.account._count.facebookProfiles,
        createdAt: accountUser.account.createdAt,
      },
    });
  }

  /**
   * Test FTP connection
   */
  async testFtpConnection(req: AuthRequest, res: Response) {
    const { host, username, password, path } = req.body;

    if (!host || !username || !password) {
      throw new AppError('Missing required FTP credentials', 400);
    }

    const ftpService = new FTPService();
    
    try {
      const success = await ftpService.testConnection({
        host,
        port: 21,
        username,
        password,
        path: path || '/',
        protocol: 'ftp',
      });

      if (success) {
        logger.info(`FTP connection test successful for ${host} by user ${req.user!.id}`);
        res.json({
          success: true,
          message: 'FTP connection successful',
        });
      } else {
        throw new AppError('FTP connection failed', 400);
      }
    } catch (error: any) {
      logger.error(`FTP connection test failed for ${host}:`, error);
      throw new AppError(error.message || 'FTP connection failed', 400);
    }
  }

  /**
   * Get user's accounts
   */
  async getAccounts(req: AuthRequest, res: Response) {
    const accounts = await prisma.accountUser.findMany({
      where: {
        userId: req.user!.id,
      },
      include: {
        account: {
          include: {
            _count: {
              select: {
                vehicles: true,
                facebookProfiles: true,
              },
            },
          },
        },
      },
    });

    res.json({
      success: true,
      data: accounts.map((au) => ({
        id: au.account.id,
        name: au.account.name,
        dealershipName: au.account.dealershipName,
        role: au.role,
        vehicleCount: au.account._count.vehicles,
        facebookProfileCount: au.account._count.facebookProfiles,
        createdAt: au.account.createdAt,
      })),
    });
  }

  /**
   * Get account details
   */
  async getAccount(req: AuthRequest, res: Response) {
    const { id } = req.params;

    const accountUser = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: id as string,
      },
      include: {
        account: {
          include: {
            accountUsers: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            facebookProfiles: true,
            syncJobs: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
          },
        },
      },
    });

    if (!accountUser) {
      throw new AppError('Account not found or access denied', 404);
    }

    res.json({
      success: true,
      data: accountUser.account,
    });
  }

  /**
   * Update account settings
   */
  async updateSettings(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { ftpHost, ftpPort, ftpUsername, ftpPassword, csvPath, autoSync, syncInterval } = req.body;

    // Verify user is owner or admin
    const accountUser = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: id as string,
        role: { in: ['ACCOUNT_OWNER', 'ADMIN'] },
      },
    });

    if (!accountUser) {
      throw new AppError('Access denied', 403);
    }

    const updated = await prisma.account.update({
      where: { id: id as string },
      data: {
        ftpHost,
        ftpPort,
        ftpUsername,
        ftpPassword,
        csvPath,
        autoSync,
        syncInterval,
      },
    });

    logger.info(`Account settings updated: ${id} by user ${req.user!.id}`);

    res.json({
      success: true,
      data: updated,
    });
  }

  /**
   * Invite user to account
   */
  async inviteUser(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { email, role } = req.body;

    // Verify user is owner or admin
    const accountUser = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: id as string,
        role: { in: ['ACCOUNT_OWNER', 'ADMIN'] },
      },
    });

    if (!accountUser) {
      throw new AppError('Access denied', 403);
    }

    // Find user by email
    const invitedUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!invitedUser) {
      throw new AppError('User not found', 404);
    }

    // Check if already a member
    const existing = await prisma.accountUser.findFirst({
      where: {
        userId: invitedUser.id,
        accountId: id as string,
      },
    });

    if (existing) {
      throw new AppError('User is already a member of this account', 409);
    }

    const newMember = await prisma.accountUser.create({
      data: {
        userId: invitedUser.id,
        accountId: id as string,
        role,
      },
    });

    logger.info(`User invited: ${invitedUser.id} to account ${id} by ${req.user!.id}`);

    res.json({
      success: true,
      data: newMember,
      message: 'User invited successfully',
    });
  }

  /**
   * Remove user from account
   */
  async removeUser(req: AuthRequest, res: Response) {
    const { id, userId } = req.params;

    // Verify user is owner or admin
    const accountUser = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: id as string,
        role: { in: ['ACCOUNT_OWNER', 'ADMIN'] },
      },
    });

    if (!accountUser) {
      throw new AppError('Access denied', 403);
    }

    // Cannot remove yourself
    if (userId === req.user!.id) {
      throw new AppError('Cannot remove yourself from account', 400);
    }

    await prisma.accountUser.deleteMany({
      where: {
        userId: userId as string,
        accountId: id as string,
      },
    });

    logger.info(`User removed: ${userId} from account ${id} by ${req.user!.id}`);

    res.json({
      success: true,
      message: 'User removed successfully',
    });
  }
}
