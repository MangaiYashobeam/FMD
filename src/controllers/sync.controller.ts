import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth';
import prisma from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { syncQueue } from '@/jobs/queueProcessor';
import { FTPService } from '@/services/ftp.service';
import { CSVParserService } from '@/services/csvParser.service';
import { schedulerService } from '@/services/scheduler.service';

export class SyncController {
  /**
   * Trigger manual sync
   */
  async triggerSync(req: AuthRequest, res: Response) {
    const { accountId } = req.body;

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId,
        role: { in: ['ACCOUNT_OWNER', 'ADMIN', 'SALES_REP'] },
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    // Get account settings
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    // Create sync job record
    const syncJob = await prisma.syncJob.create({
      data: {
        accountId,
        status: 'PENDING',
        triggeredBy: req.user!.id,
      },
    });

    // Queue the sync job
    await syncQueue.add('sync-inventory', {
      syncJobId: syncJob.id,
      accountId,
    });

    logger.info(`Manual sync triggered: ${syncJob.id} for account ${accountId}`);

    res.json({
      success: true,
      data: { jobId: syncJob.id },
      message: 'Sync job queued successfully',
    });
  }

  /**
   * Get sync job status
   */
  async getStatus(req: AuthRequest, res: Response) {
    const { jobId } = req.params;

    const syncJob = await prisma.syncJob.findUnique({
      where: { id: jobId as string },
      include: {
        account: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!syncJob) {
      throw new AppError('Sync job not found', 404);
    }

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: syncJob.accountId,
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    res.json({
      success: true,
      data: syncJob,
    });
  }

  /**
   * Get sync history
   */
  async getHistory(req: AuthRequest, res: Response) {
    const accountId = req.query.accountId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId,
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    const [jobs, total] = await Promise.all([
      prisma.syncJob.findMany({
        where: { accountId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.syncJob.count({ where: { accountId } }),
    ]);

    res.json({
      success: true,
      data: {
        jobs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  }

  /**
   * Process sync job (called by queue worker)
   */
  static async processSyncJob(syncJobId: string) {
    try {
      const syncJob = await prisma.syncJob.findUnique({
        where: { id: syncJobId },
        include: { account: true },
      });

      if (!syncJob) {
        throw new Error('Sync job not found');
      }

      // Update status to processing
      await prisma.syncJob.update({
        where: { id: syncJobId },
        data: { status: 'PROCESSING', startedAt: new Date() },
      });

      const account = syncJob.account;

      // Connect to FTP and download CSV
      const ftpService = new FTPService();
      await ftpService.connect({
        host: account.ftpHost!,
        port: account.ftpPort!,
        username: account.ftpUsername!,
        password: account.ftpPassword!,
        path: account.csvPath!,
        protocol: 'ftp',
      });

      const tempPath = `/tmp/sync_${syncJobId}.csv`;
      const csvContent = await ftpService.downloadFile(account.csvPath!, tempPath);

      // Parse CSV
      const csvParser = new CSVParserService();
      const vehicles = await csvParser.parseCSVContent(csvContent);

      // Update database
      let imported = 0;
      let updated = 0;
      let failed = 0;

      for (const vehicleData of vehicles) {
        try {
          const existing = await prisma.vehicle.findFirst({
            where: {
              accountId: account.id,
              vin: vehicleData.vin,
            },
          });

          if (existing) {
            await prisma.vehicle.update({
              where: { id: existing.id },
              data: {
                ...vehicleData,
                source: 'FTP',
                updatedAt: new Date(),
              },
            });
            updated++;
          } else {
            await prisma.vehicle.create({
              data: {
                ...vehicleData,
                accountId: account.id,
                source: 'FTP',
              },
            });
            imported++;
          }
        } catch (error) {
          logger.error(`Failed to import vehicle ${vehicleData.vin}:`, error);
          failed++;
        }
      }

      // Update sync job
      await prisma.syncJob.update({
        where: { id: syncJobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          recordsImported: imported,
          recordsUpdated: updated,
          recordsFailed: failed,
        },
      });

      logger.info(`Sync completed: ${syncJobId} - Imported: ${imported}, Updated: ${updated}, Failed: ${failed}`);
    } catch (error: any) {
      logger.error(`Sync job failed: ${syncJobId}`, error);
      await prisma.syncJob.update({
        where: { id: syncJobId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: error.message,
        },
      });
      throw error;
    }
  }

  /**
   * Get scheduler status
   */
  async getSchedulerStatus(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const status = schedulerService.getStatus();
      res.json(status);
    } catch (error) {
      logger.error('Error getting scheduler status:', error);
      throw new AppError('Failed to get scheduler status', 500);
    }
  }
}
