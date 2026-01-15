/**
 * DealersFace Mail Engine
 * Self-hosted email sending system similar to WordPress wp_mail
 * Uses local MTA (Postfix/Sendmail) with full deliverability support
 * 
 * @module MailEngine
 * @author DealersFace
 */

import { logger } from '@/utils/logger';
import prisma from '@/config/database';
import { mtaService, MTAStatus } from './mta.service';
import { dkimService } from './dkim.service';
import { emailQueueService, QueueStats } from './queue.service';
import { trackingService, EngagementStats } from './tracking.service';
import { emailAnalyticsService, AnalyticsData } from './analytics.service';

// Mail Engine Configuration
const ENGINE_CONFIG = {
  systemDomain: process.env.MAIL_DOMAIN || 'dealersface.com',
  defaultFromEmail: process.env.DEFAULT_FROM_EMAIL || 'fb-api@dealersface.com',
  defaultFromName: process.env.DEFAULT_FROM_NAME || 'DealersFace',
  supportEmail: process.env.SUPPORT_EMAIL || 'support@dealersface.com',
  
  // Feature flags
  enableTracking: process.env.MAIL_ENABLE_TRACKING !== 'false',
  enableQueue: process.env.MAIL_ENABLE_QUEUE !== 'false',
  enableDkim: process.env.MAIL_ENABLE_DKIM !== 'false',
  
  // Rate limiting defaults
  defaultHourlyLimit: parseInt(process.env.MAIL_HOURLY_LIMIT || '100'),
  defaultDailyLimit: parseInt(process.env.MAIL_DAILY_LIMIT || '1000'),
};

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  fromName?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  
  // Tracking options
  trackOpens?: boolean;
  trackClicks?: boolean;
  addUnsubscribe?: boolean;
  
  // Scheduling
  scheduledAt?: Date;
  priority?: number;
  
  // Context
  templateSlug?: string;
  accountId?: string;
  userId?: string;
  metadata?: Record<string, any>;
  
  // Delivery options
  useQueue?: boolean;
  immediate?: boolean; // Skip queue, send immediately
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  queueId?: string;
  trackingId?: string;
  error?: string;
}

export interface MailEngineStatus {
  initialized: boolean;
  mta: MTAStatus;
  queueEnabled: boolean;
  queueRunning: boolean;
  dkimEnabled: boolean;
  trackingEnabled: boolean;
  systemDomain: string;
  defaultFromEmail: string;
}

/**
 * DealersFace Mail Engine
 * Main entry point for all email sending operations
 */
class MailEngine {
  private initialized: boolean = false;
  private queueRunning: boolean = false;

  constructor() {
    logger.info('🚀 DealersFace Mail Engine loading...');
  }

  /**
   * Initialize the mail engine
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Check MTA availability
      await mtaService.checkMTAAvailability();

      // Setup default domain if needed
      await this.ensureDefaultDomain();

      // Start queue processor if enabled
      if (ENGINE_CONFIG.enableQueue) {
        emailQueueService.start();
        this.queueRunning = true;
      }

      this.initialized = true;
      logger.info('✅ Mail Engine initialized successfully');
      logger.info(`   Domain: ${ENGINE_CONFIG.systemDomain}`);
      logger.info(`   From: ${ENGINE_CONFIG.defaultFromEmail}`);
      logger.info(`   Queue: ${ENGINE_CONFIG.enableQueue ? 'enabled' : 'disabled'}`);
      logger.info(`   DKIM: ${ENGINE_CONFIG.enableDkim ? 'enabled' : 'disabled'}`);
      logger.info(`   Tracking: ${ENGINE_CONFIG.enableTracking ? 'enabled' : 'disabled'}`);

    } catch (error) {
      logger.error('Failed to initialize Mail Engine:', error);
      throw error;
    }
  }

  /**
   * Ensure default domain is configured
   */
  private async ensureDefaultDomain(): Promise<void> {
    const domain = ENGINE_CONFIG.systemDomain;

    const existing = await prisma.emailDomain.findUnique({
      where: { domain },
    });

    if (!existing) {
      // Create default domain
      await prisma.emailDomain.create({
        data: {
          domain,
          isDefault: true,
          hourlyLimit: ENGINE_CONFIG.defaultHourlyLimit,
          dailyLimit: ENGINE_CONFIG.defaultDailyLimit,
        },
      });

      logger.info(`📧 Created default email domain: ${domain}`);

      // Setup DKIM if enabled
      if (ENGINE_CONFIG.enableDkim) {
        try {
          const dkimConfig = await dkimService.setupDomain(domain);
          logger.info(`🔐 DKIM configured for ${domain}`);
          logger.info(`   Add this DNS TXT record:`);
          logger.info(`   ${dkimConfig.selector}._domainkey.${domain}`);
        } catch (err) {
          logger.warn('Failed to setup DKIM:', err);
        }
      }
    }
  }

  /**
   * Send an email (main entry point)
   * Similar to WordPress wp_mail()
   */
  async send(options: SendEmailOptions): Promise<SendResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Normalize options
      const normalizedOptions = this.normalizeOptions(options);

      // Check suppression list
      const recipients = this.normalizeRecipients(normalizedOptions.to);
      const suppressedEmails = await this.checkSuppression(recipients);

      if (suppressedEmails.length > 0) {
        logger.debug(`Skipping suppressed emails: ${suppressedEmails.join(', ')}`);
        const activeRecipients = recipients.filter(
          (r) => !suppressedEmails.includes(r)
        );
        if (activeRecipients.length === 0) {
          return {
            success: false,
            error: 'All recipients are suppressed',
          };
        }
        normalizedOptions.to = activeRecipients;
      }

      // Inject tracking if enabled
      let processedHtml = normalizedOptions.html;
      let trackingId: string | undefined;

      if (ENGINE_CONFIG.enableTracking) {
        trackingId = this.generateTrackingId();
        
        if (normalizedOptions.trackOpens !== false) {
          processedHtml = trackingService.injectOpenTracker(processedHtml, trackingId);
        }
        if (normalizedOptions.trackClicks !== false) {
          processedHtml = trackingService.injectClickTracker(processedHtml, trackingId);
        }
        if (normalizedOptions.addUnsubscribe) {
          const email = Array.isArray(normalizedOptions.to)
            ? normalizedOptions.to[0]
            : normalizedOptions.to;
          processedHtml = trackingService.addUnsubscribeOption(
            processedHtml,
            trackingId,
            email
          );
        }
      }

      // Decide whether to queue or send immediately
      const useQueue =
        ENGINE_CONFIG.enableQueue &&
        normalizedOptions.useQueue !== false &&
        !normalizedOptions.immediate;

      if (useQueue) {
        // Queue the email
        const recipients = this.normalizeRecipients(normalizedOptions.to);
        const queueIds: string[] = [];

        for (const recipient of recipients) {
          const queueId = await emailQueueService.queueEmail({
            from: normalizedOptions.from || ENGINE_CONFIG.defaultFromEmail,
            fromName: normalizedOptions.fromName || ENGINE_CONFIG.defaultFromName,
            to: recipient,
            cc: normalizedOptions.cc,
            bcc: normalizedOptions.bcc,
            replyTo: normalizedOptions.replyTo,
            subject: normalizedOptions.subject,
            html: processedHtml,
            text: normalizedOptions.text,
            priority: normalizedOptions.priority,
            scheduledAt: normalizedOptions.scheduledAt,
            trackOpens: normalizedOptions.trackOpens,
            trackClicks: normalizedOptions.trackClicks,
            templateSlug: normalizedOptions.templateSlug,
            accountId: normalizedOptions.accountId,
            userId: normalizedOptions.userId,
          });
          queueIds.push(queueId);
        }

        return {
          success: true,
          queueId: queueIds[0],
          trackingId,
        };
      } else {
        // Send immediately via MTA
        const result = await mtaService.sendEmail({
          from: normalizedOptions.from || ENGINE_CONFIG.defaultFromEmail,
          fromName: normalizedOptions.fromName || ENGINE_CONFIG.defaultFromName,
          to: normalizedOptions.to,
          cc: normalizedOptions.cc,
          bcc: normalizedOptions.bcc,
          replyTo: normalizedOptions.replyTo,
          subject: normalizedOptions.subject,
          html: processedHtml,
          text: normalizedOptions.text,
          trackingId,
        });

        // Log the email
        await this.logEmail(normalizedOptions, result, trackingId);

        return {
          success: result.success,
          messageId: result.messageId,
          trackingId,
          error: result.error,
        };
      }
    } catch (error: any) {
      logger.error('Mail Engine send error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send email using a database template
   */
  async sendWithTemplate(
    templateSlug: string,
    to: string | string[],
    variables: Record<string, any> = {},
    options: Partial<SendEmailOptions> = {}
  ): Promise<SendResult> {
    // Load template from database
    const template = await prisma.emailTemplate.findUnique({
      where: { slug: templateSlug },
    });

    if (!template) {
      return {
        success: false,
        error: `Template not found: ${templateSlug}`,
      };
    }

    if (!template.isActive) {
      return {
        success: false,
        error: `Template is inactive: ${templateSlug}`,
      };
    }

    // Replace variables in template
    let html = template.htmlContent;
    let text = template.textContent || '';
    let subject = template.subject;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      html = html.replace(regex, String(value ?? ''));
      text = text.replace(regex, String(value ?? ''));
      subject = subject.replace(regex, String(value ?? ''));
    }

    return this.send({
      to,
      subject,
      html,
      text: text || undefined,
      templateSlug,
      ...options,
    });
  }

  /**
   * Get mail engine status
   */
  async getStatus(): Promise<MailEngineStatus> {
    const mtaStatus = mtaService.getStatus();
    // Get queue stats (we don't need to store it, just verify it works)
    await emailQueueService.getStats();

    return {
      initialized: this.initialized,
      mta: mtaStatus,
      queueEnabled: ENGINE_CONFIG.enableQueue,
      queueRunning: this.queueRunning,
      dkimEnabled: ENGINE_CONFIG.enableDkim,
      trackingEnabled: ENGINE_CONFIG.enableTracking,
      systemDomain: ENGINE_CONFIG.systemDomain,
      defaultFromEmail: ENGINE_CONFIG.defaultFromEmail,
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    return emailQueueService.getStats();
  }

  /**
   * Get engagement statistics
   */
  async getEngagementStats(startDate: Date, endDate: Date, accountId?: string): Promise<EngagementStats> {
    return trackingService.getEngagementStats(startDate, endDate, accountId);
  }

  /**
   * Get analytics data
   */
  async getAnalytics(options: {
    startDate: Date;
    endDate: Date;
    period?: 'HOUR' | 'DAY' | 'WEEK' | 'MONTH';
    accountId?: string;
    domain?: string;
  }): Promise<AnalyticsData> {
    return emailAnalyticsService.getAnalytics(options);
  }

  /**
   * Setup DKIM for a domain
   */
  async setupDomain(domain: string) {
    return dkimService.setupDomain(domain);
  }

  /**
   * Get DNS records for a domain
   */
  async getDnsRecords(domain: string) {
    return dkimService.getDnsRecords(domain);
  }

  /**
   * Verify domain configuration
   */
  async verifyDomain(domain: string) {
    return dkimService.verifyDomain(domain);
  }

  /**
   * Add email to suppression list
   */
  async suppressEmail(
    email: string,
    reason: string,
    details?: string
  ): Promise<void> {
    await prisma.emailSuppression.upsert({
      where: { email: email.toLowerCase() },
      update: {
        reason,
        details,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        email: email.toLowerCase(),
        reason,
        details,
        sourceType: 'MANUAL',
      },
    });
  }

  /**
   * Remove email from suppression list
   */
  async unsuppressEmail(email: string): Promise<void> {
    await prisma.emailSuppression.updateMany({
      where: { email: email.toLowerCase() },
      data: { isActive: false },
    });
  }

  /**
   * Check if email is suppressed
   */
  async isEmailSuppressed(email: string): Promise<boolean> {
    const suppression = await prisma.emailSuppression.findFirst({
      where: {
        email: email.toLowerCase(),
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });
    return !!suppression;
  }

  /**
   * Handle tracking webhook (for external bounce/complaint notifications)
   */
  async handleWebhook(
    type: 'bounce' | 'complaint' | 'delivery',
    data: {
      messageId: string;
      recipient?: string;
      bounceType?: string;
      reason?: string;
    }
  ): Promise<void> {
    switch (type) {
      case 'bounce':
        await trackingService.processBounce(
          data.messageId,
          data.bounceType === 'Permanent' ? 'HARD' : 'SOFT',
          data.reason || 'Unknown bounce'
        );
        break;
      case 'complaint':
        await trackingService.processComplaint(data.messageId);
        break;
      case 'delivery':
        // Mark as delivered
        await prisma.emailLog.updateMany({
          where: { messageId: data.messageId },
          data: {
            status: 'DELIVERED',
            deliveredAt: new Date(),
          },
        });
        break;
    }
  }

  /**
   * Start queue processor (if not running)
   */
  startQueue(): void {
    emailQueueService.start();
    this.queueRunning = true;
  }

  /**
   * Stop queue processor
   */
  stopQueue(): void {
    emailQueueService.stop();
    this.queueRunning = false;
  }

  /**
   * Retry a failed email
   */
  async retryEmail(queueId: string): Promise<boolean> {
    return emailQueueService.retryEmail(queueId);
  }

  /**
   * Cancel a pending email
   */
  async cancelEmail(queueId: string): Promise<boolean> {
    return emailQueueService.cancelEmail(queueId);
  }

  // Private helper methods

  private normalizeOptions(options: SendEmailOptions): SendEmailOptions {
    return {
      ...options,
      trackOpens: options.trackOpens ?? ENGINE_CONFIG.enableTracking,
      trackClicks: options.trackClicks ?? ENGINE_CONFIG.enableTracking,
      useQueue: options.useQueue ?? true,
      priority: options.priority ?? 5,
    };
  }

  private normalizeRecipients(to: string | string[]): string[] {
    if (Array.isArray(to)) {
      return to.map((e) => e.trim().toLowerCase());
    }
    return [to.trim().toLowerCase()];
  }

  private async checkSuppression(emails: string[]): Promise<string[]> {
    const suppressions = await prisma.emailSuppression.findMany({
      where: {
        email: { in: emails.map((e) => e.toLowerCase()) },
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      select: { email: true },
    });
    return suppressions.map((s) => s.email);
  }

  private generateTrackingId(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(16).toString('hex');
  }

  private async logEmail(
    options: SendEmailOptions,
    result: any,
    trackingId?: string
  ): Promise<void> {
    const recipients = this.normalizeRecipients(options.to);

    for (const recipient of recipients) {
      await prisma.emailLog.create({
        data: {
          recipient,
          subject: options.subject,
          status: result.success ? 'SENT' : 'FAILED',
          messageId: result.messageId,
          mtaMessageId: result.mtaMessageId,
          mtaResponse: result.mtaResponse,
          errorMessage: result.error,
          sentAt: result.success ? new Date() : undefined,
          accountId: options.accountId,
          userId: options.userId,
          templateSlug: options.templateSlug,
          metadata: {
            trackingId,
            from: options.from || ENGINE_CONFIG.defaultFromEmail,
            ...options.metadata,
          },
        },
      });
    }
  }
}

// Export singleton
export const mailEngine = new MailEngine();

// Export sub-services for direct access if needed
export { mtaService } from './mta.service';
export { dkimService } from './dkim.service';
export { emailQueueService } from './queue.service';
export { trackingService } from './tracking.service';
export { emailAnalyticsService } from './analytics.service';
