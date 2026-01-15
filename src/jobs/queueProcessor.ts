import { Queue, Worker } from 'bullmq';
import { getRedisConnection } from '@/config/redis';
import { logger } from '@/utils/logger';
import { SyncController } from '@/controllers/sync.controller';

// Queue instances (only available if Redis is connected)
let syncQueue: Queue | null = null;
let facebookQueue: Queue | null = null;

/**
 * Get sync queue instance
 */
export const getSyncQueue = () => syncQueue;

/**
 * Get facebook queue instance
 */
export const getFacebookQueue = () => facebookQueue;

/**
 * Initialize queue processors
 */
export const initializeQueueProcessor = async () => {
  logger.info('Initializing queue processors...');

  const connection = getRedisConnection();
  
  if (!connection) {
    throw new Error('Redis connection unavailable. Cannot initialize queue processors.');
  }

  // Define queues
  syncQueue = new Queue('sync', { connection });
  facebookQueue = new Queue('facebook', { connection });

  // Sync worker
  const syncWorker = new Worker(
    'sync',
    async (job) => {
      logger.info(`Processing sync job: ${job.id}`);
      const { syncJobId } = job.data;
      await SyncController.processSyncJob(syncJobId);
      return { success: true };
    },
    { connection, concurrency: 2 }
  );

  syncWorker.on('completed', (job) => {
    logger.info(`Sync job ${job.id} completed`);
  });

  syncWorker.on('failed', (job, err) => {
    logger.error(`Sync job ${job?.id} failed:`, err);
  });

  // Facebook worker
  const facebookWorker = new Worker(
    'facebook',
    async (job) => {
      logger.info(`Processing Facebook job: ${job.id}`);
      // TODO: Implement Facebook posting logic
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { success: true };
    },
    { connection, concurrency: 5 }
  );

  facebookWorker.on('completed', (job) => {
    logger.info(`Facebook job ${job.id} completed`);
  });

  facebookWorker.on('failed', (job, err) => {
    logger.error(`Facebook job ${job?.id} failed:`, err);
  });

  logger.info('Queue processors initialized successfully');
};
