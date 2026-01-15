/**
 * Email Queue Processor Service
 * Handles reliable email delivery with queueing, retries, and bounce handling
 * 
 * @module EmailQueueService
 * @author DealersFace
 */

import { logger } from '@/utils/logger';
import prisma from '@/config/database';
import { mtaService, MTAEmailOptions, MTASendResult } from './mta.service';
import { trackingService } from './tracking.service';
import { randomBytes } from 'crypto';

// Queue Configuration
const QUEUE_CONFIG = {
  // Processing intervals (ms)
  processingInterval: parseInt(process.env.EMAIL_QUEUE_INTERVAL || '5000'), // 5 seconds
  batchSize: parseInt(process.env.EMAIL_QUEUE_BATCH_SIZE || '10'),
  
  // Retry configuration
  maxRetries: 3,
  retryDelays: [60, 300, 1800, 3600], // 1min, 5min, 30min, 1hour
  
  // Rate limiting
  maxPerSecond: 10,
  maxPerMinute: 100,
  
  // Bounce handling
  softBounceRetryHours: 24,
  hardBounceSuppressionDays: 365,
};

interface QueueEmailOptions {
  from: string;
  fromName?: string;
  to: string;
  toName?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  priority?: number; // 1-10 (1 = highest)
  scheduledAt?: Date;
  trackOpens?: boolean;
  trackClicks?: boolean;
  templateSlug?: string;
  accountId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface QueueStats {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  deferred: number;
  todaySent: number;
  todayFailed: number;
}

/**
 * Email Queue Service
 */
export class EmailQueueService {
  private isProcessing: boolean = false;
  private processingTimer: NodeJS.Timeout | null = null;

  constructor() {
    logger.info('📬 Email Queue Service initialized');
  }

  /**
   * Start the queue processor
   */
  start(): void {
    if (this.processingTimer) {
      return;
    }

    logger.info('🚀 Starting email queue processor');

    this.processingTimer = setInterval(
      () => this.processQueue(),
      QUEUE_CONFIG.processingInterval
    );

    // Process immediately on start
    this.processQueue();
  }

  /**
   * Stop the queue processor
   */
  stop(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
      logger.info('⏹️ Email queue processor stopped');
    }
  }

  /**
   * Queue an email for sending
   */
  async queueEmail(options: QueueEmailOptions): Promise<string> {
    const trackingId = this.generateTrackingId();

    // Inject tracking if enabled
    let htmlContent = options.html;
    if (options.trackOpens !== false) {
      htmlContent = trackingService.injectOpenTracker(htmlContent, trackingId);
    }
    if (options.trackClicks !== false) {
      htmlContent = trackingService.injectClickTracker(htmlContent, trackingId);
    }

    const queueEntry = await prisma.emailQueue.create({
      data: {
        fromEmail: options.from,
        fromName: options.fromName,
        toEmail: options.to.toLowerCase(),
        toName: options.toName,
        ccEmails: options.cc || [],
        bccEmails: options.bcc || [],
        replyTo: options.replyTo,
        subject: options.subject,
        htmlContent,
        textContent: options.text,
        trackingId,
        trackOpens: options.trackOpens !== false,
        trackClicks: options.trackClicks !== false,
        priority: options.priority || 5,
        scheduledAt: options.scheduledAt,
        templateSlug: options.templateSlug,
        accountId: options.accountId,
        userId: options.userId,
        status: 'PENDING',
      },
    });

    logger.debug(`📥 Email queued: ${queueEntry.id} to ${options.to}`);

    return queueEntry.id;
  }

  /**
   * Queue multiple emails (batch)
   */
  async queueBatch(emails: QueueEmailOptions[]): Promise<string[]> {
    const ids: string[] = [];
    
    for (const email of emails) {
      const id = await this.queueEmail(email);
      ids.push(id);
    }

    logger.info(`📥 Queued batch of ${emails.length} emails`);
    return ids;
  }

  /**
   * Process the email queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const now = new Date();

      // Get pending emails ready to send
      const pendingEmails = await prisma.emailQueue.findMany({
        where: {
          status: { in: ['PENDING', 'DEFERRED'] },
          AND: [
            {
              OR: [
                { scheduledAt: null },
                { scheduledAt: { lte: now } },
              ],
            },
            {
              OR: [
                { nextAttemptAt: null },
                { nextAttemptAt: { lte: now } },
              ],
            },
          ],
        },
        orderBy: [
          { priority: 'asc' },
          { createdAt: 'asc' },
        ],
        take: QUEUE_CONFIG.batchSize,
      });

      if (pendingEmails.length === 0) {
        this.isProcessing = false;
        return;
      }

      logger.debug(`📤 Processing ${pendingEmails.length} queued emails`);

      // Process each email
      for (const email of pendingEmails) {
        await this.processEmail(email);
      }

    } catch (error) {
      logger.error('Queue processing error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single queued email
   */
  private async processEmail(email: any): Promise<void> {
    try {
      // Mark as processing
      await prisma.emailQueue.update({
        where: { id: email.id },
        data: { status: 'PROCESSING' },
      });

      // Build MTA options
      const mtaOptions: MTAEmailOptions = {
        from: email.fromEmail,
        fromName: email.fromName,
        to: email.toEmail,
        cc: email.ccEmails,
        bcc: email.bccEmails,
        replyTo: email.replyTo,
        subject: email.subject,
        html: email.htmlContent,
        text: email.textContent,
        trackingId: email.trackingId,
      };

      // Send via MTA
      const result = await mtaService.sendEmail(mtaOptions);

      // Update queue entry and create log
      await this.handleSendResult(email, result);

    } catch (error: any) {
      logger.error(`Failed to process email ${email.id}:`, error);
      
      await this.handleSendFailure(email, error.message);
    }
  }

  /**
   * Handle send result
   */
  private async handleSendResult(email: any, result: MTASendResult): Promise<void> {
    const now = new Date();

    if (result.success) {
      // Success - update queue and create log
      await prisma.$transaction([
        prisma.emailQueue.update({
          where: { id: email.id },
          data: {
            status: 'SENT',
            messageId: result.messageId,
            mtaMessageId: result.mtaMessageId,
            mtaResponse: result.mtaResponse,
            processedAt: now,
            lastAttemptAt: now,
            attempts: { increment: 1 },
          },
        }),
        prisma.emailLog.create({
          data: {
            recipient: email.toEmail,
            subject: email.subject,
            status: 'SENT',
            messageId: result.messageId,
            mtaMessageId: result.mtaMessageId,
            mtaResponse: result.mtaResponse,
            sentAt: now,
            accountId: email.accountId,
            userId: email.userId,
            templateSlug: email.templateSlug,
            metadata: {
              trackingId: email.trackingId,
              from: email.fromEmail,
            },
          },
        }),
      ]);

      logger.info(`✅ Email sent: ${email.id} to ${email.toEmail}`);

    } else if (result.shouldRetry && email.attempts < QUEUE_CONFIG.maxRetries) {
      // Temporary failure - schedule retry
      const nextAttempt = this.calculateNextRetry(email.attempts);

      await prisma.emailQueue.update({
        where: { id: email.id },
        data: {
          status: 'DEFERRED',
          errorMessage: result.error,
          mtaResponse: result.mtaResponse,
          lastAttemptAt: now,
          nextAttemptAt: nextAttempt,
          attempts: { increment: 1 },
        },
      });

      logger.warn(`⏳ Email deferred: ${email.id}, retry at ${nextAttempt.toISOString()}`);

    } else {
      // Permanent failure or max retries exceeded
      await this.handlePermanentFailure(email, result);
    }
  }

  /**
   * Handle send failure (exception)
   */
  private async handleSendFailure(email: any, errorMessage: string): Promise<void> {
    const now = new Date();

    if (email.attempts < QUEUE_CONFIG.maxRetries) {
      // Schedule retry
      const nextAttempt = this.calculateNextRetry(email.attempts);

      await prisma.emailQueue.update({
        where: { id: email.id },
        data: {
          status: 'DEFERRED',
          errorMessage,
          lastAttemptAt: now,
          nextAttemptAt: nextAttempt,
          attempts: { increment: 1 },
        },
      });
    } else {
      // Max retries exceeded
      await prisma.$transaction([
        prisma.emailQueue.update({
          where: { id: email.id },
          data: {
            status: 'FAILED',
            errorMessage,
            lastAttemptAt: now,
            attempts: { increment: 1 },
          },
        }),
        prisma.emailLog.create({
          data: {
            recipient: email.toEmail,
            subject: email.subject,
            status: 'FAILED',
            errorMessage,
            accountId: email.accountId,
            userId: email.userId,
            templateSlug: email.templateSlug,
            retryCount: email.attempts + 1,
            metadata: {
              trackingId: email.trackingId,
              from: email.fromEmail,
            },
          },
        }),
      ]);
    }
  }

  /**
   * Handle permanent failure
   */
  private async handlePermanentFailure(email: any, result: MTASendResult): Promise<void> {
    const now = new Date();

    // Determine if it's a hard bounce
    const isHardBounce = this.isHardBounce(result.error || '');

    await prisma.$transaction([
      prisma.emailQueue.update({
        where: { id: email.id },
        data: {
          status: 'FAILED',
          errorMessage: result.error,
          mtaResponse: result.mtaResponse,
          lastAttemptAt: now,
          attempts: { increment: 1 },
        },
      }),
      prisma.emailLog.create({
        data: {
          recipient: email.toEmail,
          subject: email.subject,
          status: isHardBounce ? 'BOUNCED' : 'FAILED',
          messageId: result.messageId,
          errorMessage: result.error,
          mtaResponse: result.mtaResponse,
          bounceType: isHardBounce ? 'HARD' : 'SOFT',
          bounceReason: result.error,
          bouncedAt: now,
          accountId: email.accountId,
          userId: email.userId,
          templateSlug: email.templateSlug,
          retryCount: email.attempts + 1,
          metadata: {
            trackingId: email.trackingId,
            from: email.fromEmail,
          },
        },
      }),
    ]);

    // Add to suppression list for hard bounces
    if (isHardBounce) {
      await this.addToSuppression(
        email.toEmail,
        'BOUNCE_HARD',
        result.error || 'Hard bounce'
      );
    }

    logger.error(`❌ Email failed permanently: ${email.id} to ${email.toEmail}`);
  }

  /**
   * Calculate next retry time
   */
  private calculateNextRetry(currentAttempts: number): Date {
    const delaySeconds = QUEUE_CONFIG.retryDelays[
      Math.min(currentAttempts, QUEUE_CONFIG.retryDelays.length - 1)
    ];
    return new Date(Date.now() + delaySeconds * 1000);
  }

  /**
   * Check if error indicates a hard bounce
   */
  private isHardBounce(error: string): boolean {
    const hardBouncePatterns = [
      /^5[0-5][0-9]/,           // 5xx SMTP codes
      /user unknown/i,
      /mailbox not found/i,
      /invalid recipient/i,
      /no such user/i,
      /does not exist/i,
      /undeliverable/i,
      /recipient rejected/i,
      /mailbox unavailable/i,
    ];

    return hardBouncePatterns.some(pattern => pattern.test(error));
  }

  /**
   * Add email to suppression list
   */
  private async addToSuppression(
    email: string,
    reason: string,
    details: string
  ): Promise<void> {
    try {
      const expiresAt = reason === 'BOUNCE_SOFT'
        ? new Date(Date.now() + QUEUE_CONFIG.softBounceRetryHours * 3600000)
        : new Date(Date.now() + QUEUE_CONFIG.hardBounceSuppressionDays * 86400000);

      await prisma.emailSuppression.upsert({
        where: { email: email.toLowerCase() },
        update: {
          reason,
          details,
          isActive: true,
          expiresAt,
          updatedAt: new Date(),
        },
        create: {
          email: email.toLowerCase(),
          reason,
          details,
          isActive: true,
          expiresAt,
        },
      });

      logger.info(`🚫 Added to suppression list: ${email} (${reason})`);
    } catch (error) {
      logger.error('Failed to add to suppression:', error);
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [pending, processing, sent, failed, deferred, todaySent, todayFailed] = await Promise.all([
      prisma.emailQueue.count({ where: { status: 'PENDING' } }),
      prisma.emailQueue.count({ where: { status: 'PROCESSING' } }),
      prisma.emailQueue.count({ where: { status: 'SENT' } }),
      prisma.emailQueue.count({ where: { status: 'FAILED' } }),
      prisma.emailQueue.count({ where: { status: 'DEFERRED' } }),
      prisma.emailLog.count({
        where: {
          status: 'SENT',
          sentAt: { gte: todayStart },
        },
      }),
      prisma.emailLog.count({
        where: {
          status: 'FAILED',
          createdAt: { gte: todayStart },
        },
      }),
    ]);

    return {
      pending,
      processing,
      sent,
      failed,
      deferred,
      todaySent,
      todayFailed,
    };
  }

  /**
   * Retry a failed email
   */
  async retryEmail(emailId: string): Promise<boolean> {
    const email = await prisma.emailQueue.findUnique({
      where: { id: emailId },
    });

    if (!email || email.status !== 'FAILED') {
      return false;
    }

    await prisma.emailQueue.update({
      where: { id: emailId },
      data: {
        status: 'PENDING',
        attempts: 0,
        errorMessage: null,
        nextAttemptAt: null,
      },
    });

    logger.info(`🔄 Retrying email: ${emailId}`);
    return true;
  }

  /**
   * Cancel a pending email
   */
  async cancelEmail(emailId: string): Promise<boolean> {
    const result = await prisma.emailQueue.updateMany({
      where: {
        id: emailId,
        status: { in: ['PENDING', 'DEFERRED'] },
      },
      data: {
        status: 'FAILED',
        errorMessage: 'Cancelled by user',
      },
    });

    return result.count > 0;
  }

  /**
   * Purge old queue entries
   */
  async purgeOldEntries(daysOld: number = 30): Promise<number> {
    const cutoff = new Date(Date.now() - daysOld * 86400000);

    const result = await prisma.emailQueue.deleteMany({
      where: {
        status: { in: ['SENT', 'FAILED'] },
        processedAt: { lt: cutoff },
      },
    });

    logger.info(`🗑️ Purged ${result.count} old queue entries`);
    return result.count;
  }

  /**
   * Generate tracking ID
   */
  private generateTrackingId(): string {
    return randomBytes(16).toString('hex');
  }
}

// Export singleton
export const emailQueueService = new EmailQueueService();
