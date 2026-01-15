import { Queue, Worker } from 'bullmq';
import { getRedisConnection } from '@/config/redis';
import { logger } from '@/utils/logger';
import { SyncController } from '@/controllers/sync.controller';
import prisma from '@/config/database';
import axios from 'axios';

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
 * Process a single Facebook Marketplace post job
 */
async function processFacebookPost(jobData: {
  vehicleId: string;
  profileId: string;
  accountId: string;
}) {
  const { vehicleId, profileId } = jobData;

  // Get vehicle data
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: {
      photos: true,
      account: true,
    },
  });

  if (!vehicle) {
    throw new Error(`Vehicle not found: ${vehicleId}`);
  }

  // Get Facebook profile
  const profile = await prisma.facebookProfile.findUnique({
    where: { id: profileId },
  });

  if (!profile) {
    throw new Error(`Facebook profile not found: ${profileId}`);
  }

  // Build post message
  const postMessage = buildVehiclePostMessage(vehicle);

  // Check if this is a page post or needs marketplace extension
  if (profile.pageId === 'personal-marketplace') {
    // Personal marketplace - create pending post for Chrome extension to complete
    const post = await prisma.facebookPost.create({
      data: {
        vehicleId,
        profileId,
        postId: `pending-${Date.now()}`,
        message: postMessage,
        status: 'PENDING_EXTENSION',
      },
    });

    logger.info(`Facebook post queued for extension: ${post.id}`);
    return { postId: post.id, status: 'PENDING_EXTENSION' };
  }

  // Page post via Graph API
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${profile.pageId}/feed`,
      {
        message: postMessage,
        link: vehicle.imageUrls?.[0] || undefined,
      },
      {
        params: { access_token: profile.accessToken },
      }
    );

    // Save successful post
    const post = await prisma.facebookPost.create({
      data: {
        vehicleId,
        profileId,
        postId: response.data.id,
        message: postMessage,
        status: 'PUBLISHED',
      },
    });

    logger.info(`Facebook post published: ${post.id}`);
    return { postId: post.id, fbPostId: response.data.id, status: 'PUBLISHED' };
  } catch (error: any) {
    // Save failed post
    await prisma.facebookPost.create({
      data: {
        vehicleId,
        profileId,
        postId: `failed-${Date.now()}`,
        message: postMessage,
        status: 'FAILED',
      },
    });

    throw new Error(`Facebook API error: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Build vehicle post message
 */
function buildVehiclePostMessage(vehicle: any): string {
  const lines = [
    `🚗 ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ' ' + vehicle.trim : ''}`,
    '',
    vehicle.price ? `💰 Price: $${vehicle.price.toLocaleString()}` : '💰 Contact for price',
    vehicle.mileage ? `📍 Mileage: ${vehicle.mileage.toLocaleString()} miles` : '',
    vehicle.exteriorColor ? `🎨 Color: ${vehicle.exteriorColor}` : '',
    vehicle.transmission ? `⚙️ Transmission: ${vehicle.transmission}` : '',
    vehicle.fuelType ? `⛽ Fuel: ${vehicle.fuelType}` : '',
    '',
    vehicle.vin ? `VIN: ${vehicle.vin}` : '',
    `Stock #: ${vehicle.stockNumber}`,
    '',
    vehicle.description || 'Contact us for more details!',
    '',
    `📞 ${vehicle.account?.phone || 'Call for info'}`,
  ];

  return lines.filter(line => line !== '').join('\n');
}

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

  // Facebook worker - with real posting logic
  const facebookWorker = new Worker(
    'facebook',
    async (job) => {
      logger.info(`Processing Facebook job: ${job.id}`, job.data);
      
      const result = await processFacebookPost(job.data);
      
      return result;
    },
    { connection, concurrency: 5 }
  );

  facebookWorker.on('completed', (job, result) => {
    logger.info(`Facebook job ${job.id} completed:`, result);
  });

  facebookWorker.on('failed', (job, err) => {
    logger.error(`Facebook job ${job?.id} failed:`, err);
  });

  logger.info('Queue processors initialized successfully');
};
