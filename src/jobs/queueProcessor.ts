import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '@/utils/logger';
import { SyncController } from '@/controllers/sync.controller';

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

// Define queues
export const syncQueue = new Queue('sync', { connection });
export const facebookQueue = new Queue('facebook', { connection });

/**
 * Initialize queue processors
 */
export const initializeQueueProcessor = async () => {
  logger.info('Initializing queue processors...');

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
