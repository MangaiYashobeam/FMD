import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth';
import prisma from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { FTPService } from '@/services/ftp.service';

export class AccountController {
  /**
   * Get current user's primary account
   * Auto-creates an account if the user doesn't have one (recovery for orphaned users)
   */
  async getCurrentAccount(req: AuthRequest, res: Response) {
    let accountUser = await prisma.accountUser.findFirst({
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

    // Auto-create account if user doesn't have one (recovery for orphaned users)
    if (!accountUser) {
      logger.warn(`User ${req.user!.id} has no account - auto-creating one`);
      
      // Get user details for account name
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { firstName: true, lastName: true, email: true },
      });
      
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Create a new account and link to user
      const accountName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}'s Dealership`
        : `${user.email.split('@')[0]}'s Dealership`;
      
      const newAccount = await prisma.account.create({
        data: {
          name: accountName,
          dealershipName: accountName,
          accountUsers: {
            create: {
              userId: req.user!.id,
              role: 'ACCOUNT_OWNER',
            },
          },
        },
        include: {
          _count: {
            select: {
              vehicles: true,
              facebookProfiles: true,
            },
          },
        },
      });

      logger.info(`Auto-created account ${newAccount.id} for user ${req.user!.id}`);

      // Return the newly created account
      res.json({
        success: true,
        data: {
          id: newAccount.id,
          name: newAccount.name,
          dealershipName: newAccount.dealershipName,
          ftpHost: newAccount.ftpHost,
          ftpPort: newAccount.ftpPort,
          ftpUsername: newAccount.ftpUsername,
          csvPath: newAccount.csvPath,
          autoSync: newAccount.autoSync,
          syncInterval: newAccount.syncInterval,
          role: 'ACCOUNT_OWNER',
          vehicleCount: newAccount._count.vehicles,
          facebookProfileCount: newAccount._count.facebookProfiles,
          createdAt: newAccount.createdAt,
          _autoCreated: true, // Flag to indicate this was auto-created
        },
      });
      return;
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
    const { host, port, username, password, path } = req.body;

    if (!host || !username || !password) {
      throw new AppError('Missing required FTP credentials', 400);
    }

    const ftpService = new FTPService();
    
    try {
      const success = await ftpService.testConnection({
        host,
        port: port || 21,
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

    // Verify user is owner, admin, or super admin
    const accountUser = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: id as string,
        role: { in: ['SUPER_ADMIN', 'ACCOUNT_OWNER', 'ADMIN'] },
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

    // Verify user is owner, admin, or super admin
    const accountUser = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: id as string,
        role: { in: ['SUPER_ADMIN', 'ACCOUNT_OWNER', 'ADMIN'] },
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

    // Verify user is owner, admin, or super admin
    const accountUser = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: id as string,
        role: { in: ['SUPER_ADMIN', 'ACCOUNT_OWNER', 'ADMIN'] },
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

  /**
   * Update dealership information
   */
  async updateDealership(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { name, dealershipName, address, city, state, zip, phone, website, logoUrl } = req.body;

    // Verify user has access
    const accountUser = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: id as string,
        role: { in: ['SUPER_ADMIN', 'ACCOUNT_OWNER', 'ADMIN'] },
      },
    });

    if (!accountUser) {
      throw new AppError('Access denied', 403);
    }

    const updated = await prisma.account.update({
      where: { id: id as string },
      data: {
        ...(name !== undefined && { name }),
        ...(dealershipName !== undefined && { dealershipName }),
        ...(address !== undefined && { address }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(zip !== undefined && { zip }),
        ...(phone !== undefined && { phone }),
        ...(website !== undefined && { website }),
        ...(logoUrl !== undefined && { logoUrl }),
      },
      select: {
        id: true,
        name: true,
        dealershipName: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        phone: true,
        website: true,
        logoUrl: true,
        updatedAt: true,
      },
    });

    logger.info(`Dealership info updated: ${id} by user ${req.user!.id}`);

    res.json({
      success: true,
      data: updated,
    });
  }

  /**
   * Get notification settings
   */
  async getNotificationSettings(req: AuthRequest, res: Response) {
    const { id } = req.params;

    // Verify user has access
    const accountUser = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: id as string,
      },
    });

    if (!accountUser) {
      throw new AppError('Access denied', 403);
    }

    // Return notification settings defaults until schema is migrated
    // In future, fetch from accountSettings table
    res.json({
      success: true,
      data: {
        emailSyncComplete: true,
        emailSyncError: true,
        emailNewLead: true,
        pushNotifications: false,
      },
    });
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { emailSyncComplete, emailSyncError, emailNewLead, pushNotifications } = req.body;

    // Verify user has access
    const accountUser = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: id as string,
        role: { in: ['SUPER_ADMIN', 'ACCOUNT_OWNER', 'ADMIN'] },
      },
    });

    if (!accountUser) {
      throw new AppError('Access denied', 403);
    }

    // For now, just acknowledge the settings until schema is updated
    // These will be stored when notification fields are migrated
    const settings = {
      emailSyncComplete: emailSyncComplete ?? true,
      emailSyncError: emailSyncError ?? true,
      emailNewLead: emailNewLead ?? true,
      pushNotifications: pushNotifications ?? false,
      updatedAt: new Date(),
    };

    logger.info(`Notification settings updated: ${id} by user ${req.user!.id}`);

    res.json({
      success: true,
      data: settings,
    });
  }
}
