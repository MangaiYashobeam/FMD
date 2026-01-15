import IORedis from 'ioredis';
import { logger } from '@/utils/logger';

let redisConnection: IORedis | null = null;

export const getRedisConnection = (): IORedis | null => {
  if (redisConnection) {
    return redisConnection;
  }

  try {
    // Railway provides REDIS_URL, parse it if available
    if (process.env.REDIS_URL) {
      logger.info('Connecting to Redis using REDIS_URL...');
      redisConnection = new IORedis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        enableOfflineQueue: false,
      });
    } else if (process.env.REDIS_HOST) {
      // Fallback to individual config
      logger.info('Connecting to Redis using individual config...');
      redisConnection = new IORedis({
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        enableOfflineQueue: false,
      });
    } else {
      logger.warn('⚠️  No Redis configuration found. Queue features will be disabled.');
      return null;
    }

    redisConnection.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });

    redisConnection.on('connect', () => {
      logger.info('✅ Redis connected successfully');
    });

    return redisConnection;
  } catch (error) {
    logger.error('Failed to create Redis connection:', error);
    return null;
  }
};

export const closeRedisConnection = async (): Promise<void> => {
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
    logger.info('Redis connection closed');
  }
};
