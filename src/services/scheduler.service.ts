import cron from 'node-cron';
import { logger } from '@/utils/logger';
import prisma from '@/config/database';
import { syncQueue } from '@/jobs/queueProcessor';

/**
 * Initialize scheduled jobs
 */
export const initializeScheduledJobs = () => {
  logger.info('Initializing scheduled jobs...');

  // Auto-sync job - runs every hour and checks which accounts need syncing
  cron.schedule('0 * * * *', async () => {
    logger.info('Running auto-sync scheduler...');
    await checkAndQueueAutoSyncs();
  });

  logger.info('Scheduled jobs initialized');
};

/**
 * Check accounts that need auto-sync and queue them
 */
const checkAndQueueAutoSyncs = async () => {
  try {
    // Get all active accounts with auto-sync enabled
    const accounts = await prisma.account.findMany({
      where: {
        isActive: true,
      },
      include: {
        settings: true,
        syncJobs: {
          where: {
            status: {
              in: ['completed', 'failed'],
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    logger.info(`Found ${accounts.length} active accounts to check`);

    for (const account of accounts) {
      // Skip if auto-sync is disabled
      if (!account.settings?.autoSyncEnabled) {
        continue;
      }

      const syncIntervalHours = account.settings?.syncIntervalHours || 3;
      const lastSync = account.syncJobs[0];

      // Check if enough time has passed since last sync
      if (lastSync) {
        const hoursSinceLastSync =
          (Date.now() - lastSync.createdAt.getTime()) / (1000 * 60 * 60);

        if (hoursSinceLastSync < syncIntervalHours) {
          logger.debug(
            `Account ${account.id} - skipping sync, last sync was ${hoursSinceLastSync.toFixed(1)} hours ago`
          );
          continue;
        }
      }

      // Queue sync job
      logger.info(`Queueing auto-sync for account: ${account.id} (${account.name})`);
      await syncQueue.add('auto-sync', {
        accountId: account.id,
        type: 'auto',
      });
    }
  } catch (error) {
    logger.error('Error in auto-sync scheduler:', error);
  }
};

/**
 * Manually trigger sync for an account
 */
export const triggerManualSync = async (accountId: string) => {
  logger.info(`Triggering manual sync for account: ${accountId}`);

  const job = await syncQueue.add('manual-sync', {
    accountId,
    type: 'manual',
  });

  return job.id;
};
