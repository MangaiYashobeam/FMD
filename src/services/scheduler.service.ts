import cron from 'node-cron';
import { logger } from '@/utils/logger';
import prisma from '@/config/database';
import { syncQueue } from '@/jobs/queueProcessor';

/**
 * Auto-Sync Scheduler Service
 * Manages automatic inventory synchronization for all accounts
 */

export class SchedulerService {
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private isInitialized = false;

  /**
   * Initialize all scheduled jobs
   */
  initialize() {
    if (this.isInitialized) {
      logger.warn('Scheduler already initialized');
      return;
    }

    logger.info('Initializing auto-sync scheduler...');

    // Main auto-sync job - runs every hour
    const autoSyncJob = cron.schedule('0 * * * *', async () => {
      await this.checkAndQueueAutoSyncs();
    });

    this.cronJobs.set('auto-sync', autoSyncJob);
    this.isInitialized = true;

    logger.info('✅ Auto-sync scheduler started (runs every hour)');

    // Run immediately on startup
    this.checkAndQueueAutoSyncs();
  }

  /**
   * Check all accounts and queue syncs for those that need it
   */
  async checkAndQueueAutoSyncs() {
    try {
      logger.info('🔍 Checking accounts for auto-sync...');

      // Get all active accounts with auto-sync enabled and FTP configured
      const accounts = await prisma.account.findMany({
        where: {
          isActive: true,
          autoSync: true,
          ftpHost: { not: null },
          ftpUsername: { not: null },
          csvPath: { not: null },
        },
        include: {
          syncJobs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      logger.info(`Found ${accounts.length} accounts with auto-sync enabled`);

      let syncedCount = 0;
      let skippedCount = 0;

      for (const account of accounts) {
        const shouldSync = await this.shouldTriggerSync(account);

        if (shouldSync) {
          await this.queueSync(account);
          syncedCount++;
        } else {
          skippedCount++;
        }
      }

      logger.info(`✅ Auto-sync check complete: ${syncedCount} queued, ${skippedCount} skipped`);
    } catch (error) {
      logger.error('❌ Error in auto-sync scheduler:', error);
    }
  }

  /**
   * Determine if account should be synced
   */
  private async shouldTriggerSync(account: any): Promise<boolean> {
    const syncInterval = account.syncInterval || 3; // Default 3 hours
    const lastSync = account.syncJobs[0];

    // No previous sync - trigger immediately
    if (!lastSync) {
      logger.info(`Account "${account.name}" - No previous sync, triggering now`);
      return true;
    }

    // Don't trigger if there's already a pending/processing job
    if (lastSync.status === 'PENDING' || lastSync.status === 'PROCESSING') {
      logger.debug(`Account "${account.name}" - Sync already in progress`);
      return false;
    }

    // Calculate hours since last sync
    const lastSyncTime = new Date(lastSync.createdAt);
    const now = new Date();
    const hoursSinceLastSync = (now.getTime() - lastSyncTime.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastSync >= syncInterval) {
      logger.info(`Account "${account.name}" - ${hoursSinceLastSync.toFixed(1)}h since last sync (interval: ${syncInterval}h)`);
      return true;
    }

    logger.debug(`Account "${account.name}" - Last sync ${hoursSinceLastSync.toFixed(1)}h ago (next in ${(syncInterval - hoursSinceLastSync).toFixed(1)}h)`);
    return false;
  }

  /**
   * Queue a sync job for an account
   */
  private async queueSync(account: any) {
    try {
      // Create sync job
      const syncJob = await prisma.syncJob.create({
        data: {
          accountId: account.id,
          status: 'PENDING',
          triggeredBy: 'AUTO',
        },
      });

      // Add to queue
      await syncQueue.add('sync-inventory', {
        jobId: syncJob.id,
        accountId: account.id,
      });

      logger.info(`📋 Auto-sync job ${syncJob.id} queued for "${account.name}"`);
    } catch (error) {
      logger.error(`❌ Error queueing sync for account ${account.id}:`, error);
    }
  }

  /**
   * Manually trigger sync for specific account
   */
  async triggerManualSync(accountId: string, userId: string) {
    try {
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        include: {
          syncJobs: {
            where: { status: { in: ['PENDING', 'PROCESSING'] } },
          },
        },
      });

      if (!account) {
        throw new Error('Account not found');
      }

      // Check if there's already a sync in progress
      if (account.syncJobs.length > 0) {
        throw new Error('Sync already in progress for this account');
      }

      // Create manual sync job
      const syncJob = await prisma.syncJob.create({
        data: {
          accountId,
          status: 'PENDING',
          triggeredBy: 'MANUAL',
        },
      });

      // Add to queue
      await syncQueue.add('sync-inventory', {
        jobId: syncJob.id,
        accountId,
        userId,
      });

      logger.info(`📋 Manual sync job ${syncJob.id} triggered by user ${userId}`);

      return syncJob;
    } catch (error) {
      logger.error(`Error triggering manual sync:`, error);
      throw error;
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      activeJobs: Array.from(this.cronJobs.keys()),
      nextRun: 'Every hour on the hour (0 * * * *)',
    };
  }

  /**
   * Stop all scheduled jobs
   */
  shutdown() {
    logger.info('Shutting down scheduler...');

    for (const [name, job] of this.cronJobs.entries()) {
      job.stop();
      logger.info(`Stopped job: ${name}`);
    }

    this.cronJobs.clear();
    this.isInitialized = false;
    logger.info('✅ Scheduler shut down');
  }
}

// Export singleton instance
export const schedulerService = new SchedulerService();

// Export legacy function for backward compatibility
export const initializeScheduledJobs = () => {
  schedulerService.initialize();
};
