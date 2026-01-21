/**
 * Worker Queue Service
 * 
 * Integrates the Node.js backend with Python headless browser workers
 * Uses Redis for task distribution with cryptographic security.
 * 
 * Security Features:
 * - HMAC-SHA256 task signing
 * - AES-256-GCM payload encryption
 * - Replay attack prevention
 * - Input validation
 * 
 * This service provides an alternative to the Chrome extension (IAI Soldier)
 * for headless, server-side Facebook automation.
 */

import Redis from 'ioredis';
import { logger } from '@/utils/logger';
import prisma from '@/config/database';
import { unifiedSecurityService } from './unified-security.service';

// Task types matching Python workers
export enum WorkerTaskType {
  POST_VEHICLE = 'post_vehicle',
  POST_ITEM = 'post_item',
  VALIDATE_SESSION = 'validate_session',
  REFRESH_SESSION = 'refresh_session',
  DELETE_LISTING = 'delete_listing',
  UPDATE_LISTING = 'update_listing',
}

export enum TaskPriority {
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low',
}

export enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRY = 'retry',
}

interface VehiclePostData {
  year: number;
  make: string;
  model: string;
  price: number;
  mileage?: number;
  vin?: string;
  body_style?: string;
  fuel_type?: string;
  transmission?: string;
  exterior_color?: string;
  interior_color?: string;
  description?: string;
  location: string;
}

export interface WorkerTask {
  id: string;
  type: WorkerTaskType;
  account_id: string;
  data: Record<string, any>;
  priority: TaskPriority;
  created_at: string;
  retry_count: number;
}

interface TaskResult {
  task_id: string;
  status: TaskStatus;
  worker_id?: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
  data?: Record<string, any>;
}

class WorkerQueueService {
  private redis: Redis | null = null;
  private subscriber: Redis | null = null;
  private isInitialized = false;
  private queueName = 'fmd:tasks:pending';  // Updated queue name
  private resultChannel = 'fmd:results';
  private securityEnabled = false;

  /**
   * Initialize Redis connections
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      logger.warn('REDIS_URL not configured - Worker queue service disabled');
      return;
    }

    try {
      // Main Redis connection for publishing
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 100, 3000),
        // TLS options for production
        ...(process.env.REDIS_TLS === 'true' && {
          tls: {
            rejectUnauthorized: process.env.NODE_ENV === 'production',
          },
        }),
      });

      // Subscriber connection for receiving results
      this.subscriber = new Redis(redisUrl, {
        ...(process.env.REDIS_TLS === 'true' && {
          tls: {
            rejectUnauthorized: process.env.NODE_ENV === 'production',
          },
        }),
      });

      // Subscribe to result channel
      await this.subscriber.subscribe(this.resultChannel);
      
      this.subscriber.on('message', async (channel, message) => {
        if (channel === this.resultChannel) {
          await this.handleTaskResult(JSON.parse(message));
        }
      });

      // Test connection
      await this.redis.ping();
      
      // Check if security service is available
      this.securityEnabled = unifiedSecurityService.isAvailable();
      if (!this.securityEnabled) {
        logger.warn('⚠️  Unified security not available - tasks will NOT be signed');
      }
      
      this.isInitialized = true;
      logger.info('✅ Worker queue service initialized', {
        securityEnabled: this.securityEnabled,
        queueName: this.queueName,
      });
      
    } catch (error) {
      logger.error('Failed to initialize worker queue service', { error });
    }
  }

  /**
   * Check if the service is available
   */
  isAvailable(): boolean {
    return this.isInitialized && this.redis !== null;
  }

  /**
   * Queue a vehicle posting task
   */
  async queueVehiclePosting(
    accountId: string,
    vehicle: VehiclePostData,
    photos: string[],
    groups: string[] = [],
    priority: TaskPriority = TaskPriority.NORMAL
  ): Promise<string | null> {
    if (!this.isAvailable()) {
      logger.warn('Worker queue not available - cannot queue vehicle posting');
      return null;
    }

    // Validate account ID
    if (!unifiedSecurityService.validateAccountId(accountId)) {
      logger.error('Invalid account ID format', { accountId });
      unifiedSecurityService.logSecurityEvent('invalid_account_id', 'medium', { accountId });
      return null;
    }

    // Validate task data
    const taskData = { vehicle, photos, groups };
    const validation = unifiedSecurityService.validateTaskData(taskData);
    if (!validation.valid) {
      logger.error('Task data validation failed', { error: validation.error });
      unifiedSecurityService.logSecurityEvent('invalid_task_data', 'medium', { 
        error: validation.error,
        accountId,
      });
      return null;
    }

    const taskId = unifiedSecurityService.generateTaskId('vehicle');
    
    const task = {
      id: taskId,
      type: WorkerTaskType.POST_VEHICLE,
      account_id: accountId,
      data: taskData,
      priority,
      created_at: new Date().toISOString(),
      retry_count: 0,
    };

    try {
      // Sign the task if security is enabled
      let taskToQueue: any = task;
      if (this.securityEnabled) {
        taskToQueue = unifiedSecurityService.signTask(task, true); // encrypt sensitive data
        logger.debug('Task signed for secure transmission', { taskId });
      }

      // Add to queue based on priority
      const queueKey = priority === TaskPriority.HIGH 
        ? 'fmd:tasks:high' 
        : priority === TaskPriority.LOW 
          ? 'fmd:tasks:low'
          : this.queueName;

      await this.redis!.lpush(queueKey, JSON.stringify(taskToQueue));

      // Store task metadata for tracking
      await this.redis!.hset(
        `fmd:task:${taskId}`,
        {
          status: TaskStatus.PENDING,
          created_at: task.created_at,
          account_id: accountId,
          type: task.type,
          signed: this.securityEnabled ? 'true' : 'false',
        }
      );

      // Set expiration for task metadata (7 days)
      await this.redis!.expire(`fmd:task:${taskId}`, 60 * 60 * 24 * 7);

      logger.info('Vehicle posting task queued', {
        taskId,
        accountId,
        make: vehicle.make,
        model: vehicle.model,
        signed: this.securityEnabled,
      });

      return taskId;
      
    } catch (error) {
      logger.error('Failed to queue vehicle posting task', { error, taskId });
      return null;
    }
  }

  /**
   * Queue a session validation task
   */
  async queueSessionValidation(accountId: string): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }

    // Validate account ID
    if (!unifiedSecurityService.validateAccountId(accountId)) {
      logger.error('Invalid account ID for session validation', { accountId });
      return null;
    }

    const taskId = unifiedSecurityService.generateTaskId('validate');
    
    const task = {
      id: taskId,
      type: WorkerTaskType.VALIDATE_SESSION,
      account_id: accountId,
      data: {},
      priority: TaskPriority.LOW,
      created_at: new Date().toISOString(),
      retry_count: 0,
    };

    try {
      // Sign the task if security is enabled
      let taskToQueue: any = task;
      if (this.securityEnabled) {
        taskToQueue = unifiedSecurityService.signTask(task, false);
      }

      await this.redis!.rpush(this.queueName, JSON.stringify(taskToQueue));
      
      logger.info('Session validation task queued', { taskId, accountId });
      return taskId;
      
    } catch (error) {
      logger.error('Failed to queue session validation', { error });
      return null;
    }
  }

  /**
   * Get task status
   */
  async getTaskStatus(taskId: string): Promise<TaskResult | null> {
    if (!this.isAvailable()) {
      return null;
    }

    // Validate task ID format
    if (!unifiedSecurityService.validateTaskId(taskId)) {
      logger.warn('Invalid task ID format requested', { taskId });
      return null;
    }

    try {
      const data = await this.redis!.hgetall(`fmd:task:${taskId}`);
      
      if (!data || Object.keys(data).length === 0) {
        return null;
      }

      return {
        task_id: taskId,
        status: data.status as TaskStatus,
        worker_id: data.worker_id,
        started_at: data.started_at,
        completed_at: data.completed_at,
        error: data.error,
        data: data.result ? JSON.parse(data.result) : undefined,
      };
      
    } catch (error) {
      logger.error('Failed to get task status', { error, taskId });
      return null;
    }
  }

  /**
   * Handle task result from Python worker
   */
  private async handleTaskResult(result: TaskResult) {
    try {
      const taskId = result.task_id;
      
      // Validate task ID
      if (!unifiedSecurityService.validateTaskId(taskId)) {
        logger.error('Invalid task ID in result', { taskId });
        unifiedSecurityService.logSecurityEvent('invalid_result_task_id', 'high', { taskId });
        return;
      }

      // If result includes a signature, verify it
      if ((result as any).signature && this.securityEnabled) {
        const verification = unifiedSecurityService.verifyTask(result as any);
        if (!verification.valid) {
          logger.error('Result signature verification failed', { 
            taskId, 
            error: verification.error 
          });
          unifiedSecurityService.logSecurityEvent('invalid_result_signature', 'critical', {
            taskId,
            error: verification.error,
          });
          return;
        }
        logger.debug('Result signature verified', { taskId });
      }

      // Update task metadata
      await this.redis!.hset(
        `fmd:task:${taskId}`,
        {
          status: result.status,
          completed_at: result.completed_at || new Date().toISOString(),
          worker_id: result.worker_id || '',
          error: result.error || '',
          result: result.data ? JSON.stringify(result.data) : '',
        }
      );

      // Update database based on result
      if (result.status === TaskStatus.COMPLETED) {
        await this.handleCompletedTask(result);
      } else if (result.status === TaskStatus.FAILED) {
        await this.handleFailedTask(result);
      }

      logger.info('Task result processed', {
        taskId,
        status: result.status,
        workerId: result.worker_id,
      });
      
    } catch (error) {
      logger.error('Failed to handle task result', { error, result });
    }
  }

  /**
   * Handle completed task - update vehicle/listing status in database
   */
  private async handleCompletedTask(result: TaskResult) {
    const data = result.data || {};
    
    // If it was a vehicle posting, update the listing record
    if (data.listing_id || data.listing_url) {
      try {
        // Find the corresponding extension task and update it
        await prisma.extensionTask.updateMany({
          where: {
            type: 'post_vehicle',
            status: 'processing',
          },
          data: {
            status: 'completed',
            completedAt: new Date(),
            result: data,
          },
        });
      } catch (error) {
        logger.error('Failed to update task completion in database', { error });
      }
    }
  }

  /**
   * Handle failed task - log error and update status
   */
  private async handleFailedTask(result: TaskResult) {
    try {
      await prisma.extensionTask.updateMany({
        where: {
          type: 'post_vehicle',
          status: 'processing',
        },
        data: {
          status: 'failed',
          completedAt: new Date(),
          result: { error: result.error },
        },
      });
    } catch (error) {
      logger.error('Failed to update task failure in database', { error });
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    securityEnabled: boolean;
  }> {
    if (!this.isAvailable()) {
      return { pending: 0, processing: 0, completed: 0, failed: 0, securityEnabled: false };
    }

    try {
      // Count pending in all priority queues
      const pendingNormal = await this.redis!.llen(this.queueName);
      const pendingHigh = await this.redis!.llen('fmd:tasks:high');
      const pendingLow = await this.redis!.llen('fmd:tasks:low');
      const pending = pendingNormal + pendingHigh + pendingLow;
      
      // Count by status
      const keys = await this.redis!.keys('fmd:task:*');
      let processing = 0;
      let completed = 0;
      let failed = 0;

      for (const key of keys.slice(0, 1000)) { // Limit to prevent slowdown
        const status = await this.redis!.hget(key, 'status');
        if (status === TaskStatus.PROCESSING) processing++;
        else if (status === TaskStatus.COMPLETED) completed++;
        else if (status === TaskStatus.FAILED) failed++;
      }

      return { pending, processing, completed, failed, securityEnabled: this.securityEnabled };
      
    } catch (error) {
      logger.error('Failed to get queue stats', { error });
      return { pending: 0, processing: 0, completed: 0, failed: 0, securityEnabled: false };
    }
  }

  /**
   * Get active workers
   */
  async getActiveWorkers(): Promise<Array<{
    worker_id: string;
    last_heartbeat: string;
    browsers_active: number;
    tasks_processed: number;
  }>> {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      const keys = await this.redis!.keys('fmd:worker:*');
      const workers = [];

      for (const key of keys) {
        const data = await this.redis!.hgetall(key);
        if (data && Object.keys(data).length > 0) {
          workers.push({
            worker_id: data.worker_id || key.split(':').pop()!,
            last_heartbeat: data.last_heartbeat || '',
            browsers_active: parseInt(data.browsers_active || '0'),
            tasks_processed: parseInt(data.tasks_processed || '0'),
          });
        }
      }

      return workers;
      
    } catch (error) {
      logger.error('Failed to get active workers', { error });
      return [];
    }
  }

  /**
   * Cleanup old task metadata
   */
  async cleanupOldTasks(olderThanDays: number = 7) {
    if (!this.isAvailable()) {
      return;
    }

    try {
      const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      const keys = await this.redis!.keys('fmd:task:*');
      let cleaned = 0;

      for (const key of keys) {
        const createdAt = await this.redis!.hget(key, 'created_at');
        if (createdAt && new Date(createdAt).getTime() < cutoff) {
          await this.redis!.del(key);
          cleaned++;
        }
      }

      logger.info('Cleaned up old task metadata', { cleaned });
      
    } catch (error) {
      logger.error('Failed to cleanup old tasks', { error });
    }
  }

  /**
   * Shutdown the service
   */
  async shutdown() {
    if (this.subscriber) {
      await this.subscriber.unsubscribe();
      this.subscriber.disconnect();
    }
    
    if (this.redis) {
      this.redis.disconnect();
    }

    this.isInitialized = false;
    logger.info('Worker queue service shutdown');
  }
}

// Singleton instance
export const workerQueueService = new WorkerQueueService();
