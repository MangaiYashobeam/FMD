/**
 * Email Tracking Service
 * Handles open tracking, click tracking, and engagement analytics
 * 
 * @module TrackingService
 * @author DealersFace
 */

import { logger } from '@/utils/logger';
import prisma from '@/config/database';
import { createHash } from 'crypto';

// Tracking Configuration
const TRACKING_CONFIG = {
  baseUrl: process.env.TRACKING_BASE_URL || process.env.API_URL || 'https://api.dealersface.com',
  openPath: '/api/email/track/open',
  clickPath: '/api/email/track/click',
  unsubscribePath: '/api/email/track/unsubscribe',
  
  // Tracking pixel (1x1 transparent GIF)
  trackingPixel: Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
  ),
};

interface TrackingEvent {
  trackingId: string;
  eventType: 'OPEN' | 'CLICK' | 'BOUNCE' | 'COMPLAINT' | 'DELIVERY' | 'UNSUBSCRIBE';
  clickedUrl?: string;
  bounceType?: string;
  bounceReason?: string;
  ipAddress?: string;
  userAgent?: string;
  country?: string;
  city?: string;
  metadata?: Record<string, any>;
}

export interface EngagementStats {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  uniqueOpens: number;
  totalClicked: number;
  uniqueClicks: number;
  totalBounced: number;
  totalComplaints: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  clickToOpenRate: number;
}

/**
 * Email Tracking Service
 */
export class TrackingService {
  constructor() {
    logger.info('📊 Email Tracking Service initialized');
  }

  /**
   * Generate open tracking pixel URL
   */
  getOpenTrackingUrl(trackingId: string): string {
    const encoded = this.encodeTrackingId(trackingId);
    return `${TRACKING_CONFIG.baseUrl}${TRACKING_CONFIG.openPath}/${encoded}.gif`;
  }

  /**
   * Generate click tracking URL
   */
  getClickTrackingUrl(trackingId: string, originalUrl: string): string {
    const encodedTracking = this.encodeTrackingId(trackingId);
    const encodedUrl = Buffer.from(originalUrl).toString('base64url');
    return `${TRACKING_CONFIG.baseUrl}${TRACKING_CONFIG.clickPath}/${encodedTracking}?url=${encodedUrl}`;
  }

  /**
   * Generate unsubscribe URL
   */
  getUnsubscribeUrl(trackingId: string, email: string): string {
    const token = this.generateUnsubscribeToken(trackingId, email);
    return `${TRACKING_CONFIG.baseUrl}${TRACKING_CONFIG.unsubscribePath}?token=${token}`;
  }

  /**
   * Inject open tracking pixel into HTML
   */
  injectOpenTracker(html: string, trackingId: string): string {
    const trackingUrl = this.getOpenTrackingUrl(trackingId);
    const pixel = `<img src="${trackingUrl}" width="1" height="1" alt="" style="display:none;visibility:hidden;width:1px;height:1px;border:0;" />`;
    
    // Try to inject before </body> or at the end
    if (html.includes('</body>')) {
      return html.replace('</body>', `${pixel}</body>`);
    }
    return html + pixel;
  }

  /**
   * Inject click tracking into all links
   */
  injectClickTracker(html: string, trackingId: string): string {
    // Regular expression to find all href attributes
    const linkRegex = /href=["']([^"']+)["']/gi;
    
    return html.replace(linkRegex, (match, url) => {
      // Skip tracking URLs, mailto:, tel:, and anchors
      if (
        url.startsWith('#') ||
        url.startsWith('mailto:') ||
        url.startsWith('tel:') ||
        url.includes('/track/') ||
        url.startsWith('data:')
      ) {
        return match;
      }
      
      const trackingUrl = this.getClickTrackingUrl(trackingId, url);
      return `href="${trackingUrl}"`;
    });
  }

  /**
   * Add unsubscribe header and footer
   */
  addUnsubscribeOption(
    html: string,
    trackingId: string,
    email: string
  ): string {
    const unsubscribeUrl = this.getUnsubscribeUrl(trackingId, email);
    
    const unsubscribeHtml = `
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #6b7280;">
        <p>
          If you no longer wish to receive these emails, you can 
          <a href="${unsubscribeUrl}" style="color: #2563eb;">unsubscribe here</a>.
        </p>
      </div>
    `;
    
    // Inject before </body> or at the end
    if (html.includes('</body>')) {
      return html.replace('</body>', `${unsubscribeHtml}</body>`);
    }
    return html + unsubscribeHtml;
  }

  /**
   * Record a tracking event
   */
  async recordEvent(event: TrackingEvent): Promise<void> {
    try {
      // Create tracking event record
      await prisma.emailTrackingEvent.create({
        data: {
          trackingId: event.trackingId,
          eventType: event.eventType,
          clickedUrl: event.clickedUrl,
          bounceType: event.bounceType,
          bounceReason: event.bounceReason,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          country: event.country,
          city: event.city,
          metadata: event.metadata,
        },
      });

      // Update email log stats
      await this.updateEmailLogStats(event);

      // Update aggregate stats
      await this.updateAggregateStats(event);

      logger.debug(`📊 Recorded ${event.eventType} event for ${event.trackingId}`);
    } catch (error) {
      logger.error('Failed to record tracking event:', error);
    }
  }

  /**
   * Handle open tracking request
   */
  async handleOpenTracking(
    trackingId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<Buffer> {
    await this.recordEvent({
      trackingId,
      eventType: 'OPEN',
      ipAddress,
      userAgent,
    });

    // Return tracking pixel
    return TRACKING_CONFIG.trackingPixel;
  }

  /**
   * Handle click tracking request
   */
  async handleClickTracking(
    trackingId: string,
    encodedUrl: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    // Decode the original URL
    const originalUrl = Buffer.from(encodedUrl, 'base64url').toString();

    await this.recordEvent({
      trackingId,
      eventType: 'CLICK',
      clickedUrl: originalUrl,
      ipAddress,
      userAgent,
    });

    return originalUrl;
  }

  /**
   * Handle unsubscribe request
   */
  async handleUnsubscribe(token: string): Promise<{ success: boolean; email?: string }> {
    try {
      const decoded = this.decodeUnsubscribeToken(token);
      if (!decoded) {
        return { success: false };
      }

      const { trackingId, email } = decoded;

      // Add to suppression list
      await prisma.emailSuppression.upsert({
        where: { email: email.toLowerCase() },
        update: {
          reason: 'UNSUBSCRIBE',
          details: `Unsubscribed via tracking link`,
          isActive: true,
          updatedAt: new Date(),
        },
        create: {
          email: email.toLowerCase(),
          reason: 'UNSUBSCRIBE',
          details: `Unsubscribed via tracking link`,
          sourceType: 'TRACKING',
          sourceId: trackingId,
        },
      });

      // Record event
      await this.recordEvent({
        trackingId,
        eventType: 'UNSUBSCRIBE',
      });

      logger.info(`📧 Unsubscribed: ${email}`);
      return { success: true, email };

    } catch (error) {
      logger.error('Unsubscribe handling failed:', error);
      return { success: false };
    }
  }

  /**
   * Process bounce notification
   */
  async processBounce(
    messageId: string,
    bounceType: 'HARD' | 'SOFT',
    bounceReason: string
  ): Promise<void> {
    try {
      // Find email log by message ID
      const emailLog = await prisma.emailLog.findFirst({
        where: { messageId },
      });

      if (!emailLog) {
        logger.warn(`Bounce received for unknown message: ${messageId}`);
        return;
      }

      // Update email log
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: 'BOUNCED',
          bounceType,
          bounceReason,
          bouncedAt: new Date(),
        },
      });

      // Find tracking ID from metadata
      const trackingId = (emailLog.metadata as any)?.trackingId;
      if (trackingId) {
        await this.recordEvent({
          trackingId,
          eventType: 'BOUNCE',
          bounceType,
          bounceReason,
        });
      }

      // Add hard bounces to suppression list
      if (bounceType === 'HARD') {
        await prisma.emailSuppression.upsert({
          where: { email: emailLog.recipient.toLowerCase() },
          update: {
            reason: 'BOUNCE_HARD',
            details: bounceReason,
            isActive: true,
            updatedAt: new Date(),
          },
          create: {
            email: emailLog.recipient.toLowerCase(),
            reason: 'BOUNCE_HARD',
            details: bounceReason,
            sourceType: 'BOUNCE',
            sourceId: emailLog.id,
          },
        });
      }

      logger.info(`📬 Processed ${bounceType} bounce for ${emailLog.recipient}`);

    } catch (error) {
      logger.error('Failed to process bounce:', error);
    }
  }

  /**
   * Process complaint (spam report)
   */
  async processComplaint(messageId: string, complaintType?: string): Promise<void> {
    try {
      const emailLog = await prisma.emailLog.findFirst({
        where: { messageId },
      });

      if (!emailLog) {
        logger.warn(`Complaint received for unknown message: ${messageId}`);
        return;
      }

      // Update email log
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          isComplaint: true,
        },
      });

      // Find tracking ID
      const trackingId = (emailLog.metadata as any)?.trackingId;
      if (trackingId) {
        await this.recordEvent({
          trackingId,
          eventType: 'COMPLAINT',
          metadata: { complaintType },
        });
      }

      // Always suppress complainers
      await prisma.emailSuppression.upsert({
        where: { email: emailLog.recipient.toLowerCase() },
        update: {
          reason: 'COMPLAINT',
          details: complaintType || 'Spam complaint',
          isActive: true,
          updatedAt: new Date(),
        },
        create: {
          email: emailLog.recipient.toLowerCase(),
          reason: 'COMPLAINT',
          details: complaintType || 'Spam complaint',
          sourceType: 'COMPLAINT',
          sourceId: emailLog.id,
        },
      });

      logger.warn(`⚠️ Complaint processed for ${emailLog.recipient}`);

    } catch (error) {
      logger.error('Failed to process complaint:', error);
    }
  }

  /**
   * Update email log stats based on event
   */
  private async updateEmailLogStats(event: TrackingEvent): Promise<void> {
    try {
      // Find email log by tracking ID in metadata
      const emailLog = await prisma.emailLog.findFirst({
        where: {
          metadata: {
            path: ['trackingId'],
            equals: event.trackingId,
          },
        },
      });

      if (!emailLog) {
        // Try to find in queue
        const queueEntry = await prisma.emailQueue.findUnique({
          where: { trackingId: event.trackingId },
        });
        if (!queueEntry) return;

        // Find corresponding log by message ID
        if (queueEntry.messageId) {
          const log = await prisma.emailLog.findFirst({
            where: { messageId: queueEntry.messageId },
          });
          if (log) {
            await this.updateLogForEvent(log.id, event);
          }
        }
        return;
      }

      await this.updateLogForEvent(emailLog.id, event);

    } catch (error) {
      logger.debug('Could not update email log stats:', error);
    }
  }

  /**
   * Update a specific log entry for an event
   */
  private async updateLogForEvent(logId: string, event: TrackingEvent): Promise<void> {
    const updates: any = {};

    switch (event.eventType) {
      case 'OPEN':
        updates.openedAt = new Date();
        updates.openCount = { increment: 1 };
        break;
      case 'CLICK':
        updates.clickedAt = new Date();
        updates.clickCount = { increment: 1 };
        break;
      case 'DELIVERY':
        updates.status = 'DELIVERED';
        updates.deliveredAt = new Date();
        break;
      case 'BOUNCE':
        updates.status = 'BOUNCED';
        updates.bounceType = event.bounceType;
        updates.bounceReason = event.bounceReason;
        updates.bouncedAt = new Date();
        break;
      case 'COMPLAINT':
        updates.isComplaint = true;
        break;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.emailLog.update({
        where: { id: logId },
        data: updates,
      });
    }
  }

  /**
   * Update aggregate statistics
   */
  private async updateAggregateStats(_event: TrackingEvent): Promise<void> {
    // This would update EmailStats table
    // Implementation depends on desired granularity
  }

  /**
   * Get engagement statistics for a time period
   */
  async getEngagementStats(
    startDate: Date,
    endDate: Date,
    accountId?: string
  ): Promise<EngagementStats> {
    const where: any = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (accountId) {
      where.accountId = accountId;
    }

    const [
      totalSent,
      totalDelivered,
      opened,
      clicked,
      bounced,
      complaints,
    ] = await Promise.all([
      prisma.emailLog.count({
        where: { ...where, status: 'SENT' },
      }),
      prisma.emailLog.count({
        where: { ...where, deliveredAt: { not: null } },
      }),
      prisma.emailLog.aggregate({
        where,
        _count: { openedAt: true },
        _sum: { openCount: true },
      }),
      prisma.emailLog.aggregate({
        where,
        _count: { clickedAt: true },
        _sum: { clickCount: true },
      }),
      prisma.emailLog.count({
        where: { ...where, status: 'BOUNCED' },
      }),
      prisma.emailLog.count({
        where: { ...where, isComplaint: true },
      }),
    ]);

    const uniqueOpens = opened._count.openedAt || 0;
    const totalOpened = opened._sum.openCount || 0;
    const uniqueClicks = clicked._count.clickedAt || 0;
    const totalClicked = clicked._sum.clickCount || 0;

    // Calculate rates
    const openRate = totalSent > 0 ? (uniqueOpens / totalSent) * 100 : 0;
    const clickRate = totalSent > 0 ? (uniqueClicks / totalSent) * 100 : 0;
    const bounceRate = totalSent > 0 ? (bounced / totalSent) * 100 : 0;
    const clickToOpenRate = uniqueOpens > 0 ? (uniqueClicks / uniqueOpens) * 100 : 0;

    return {
      totalSent,
      totalDelivered,
      totalOpened,
      uniqueOpens,
      totalClicked,
      uniqueClicks,
      totalBounced: bounced,
      totalComplaints: complaints,
      openRate: Math.round(openRate * 100) / 100,
      clickRate: Math.round(clickRate * 100) / 100,
      bounceRate: Math.round(bounceRate * 100) / 100,
      clickToOpenRate: Math.round(clickToOpenRate * 100) / 100,
    };
  }

  /**
   * Get click analytics for a specific email
   */
  async getClickAnalytics(trackingId: string): Promise<{
    url: string;
    clicks: number;
    firstClick: Date;
    lastClick: Date;
  }[]> {
    const events = await prisma.emailTrackingEvent.groupBy({
      by: ['clickedUrl'],
      where: {
        trackingId,
        eventType: 'CLICK',
        clickedUrl: { not: null },
      },
      _count: { id: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
    });

    return events.map(e => ({
      url: e.clickedUrl!,
      clicks: e._count.id,
      firstClick: e._min.createdAt!,
      lastClick: e._max.createdAt!,
    }));
  }

  /**
   * Encode tracking ID for URL
   */
  private encodeTrackingId(trackingId: string): string {
    return Buffer.from(trackingId).toString('base64url');
  }

  /**
   * Decode tracking ID from URL
   */
  decodeTrackingId(encoded: string): string {
    return Buffer.from(encoded, 'base64url').toString();
  }

  /**
   * Generate unsubscribe token
   */
  private generateUnsubscribeToken(trackingId: string, email: string): string {
    const data = JSON.stringify({ trackingId, email, ts: Date.now() });
    const encoded = Buffer.from(data).toString('base64url');
    const signature = createHash('sha256')
      .update(encoded + (process.env.JWT_SECRET || 'secret'))
      .digest('hex')
      .substring(0, 16);
    return `${encoded}.${signature}`;
  }

  /**
   * Decode and verify unsubscribe token
   */
  private decodeUnsubscribeToken(
    token: string
  ): { trackingId: string; email: string } | null {
    try {
      const [encoded, signature] = token.split('.');
      const expectedSig = createHash('sha256')
        .update(encoded + (process.env.JWT_SECRET || 'secret'))
        .digest('hex')
        .substring(0, 16);

      if (signature !== expectedSig) {
        return null;
      }

      const data = JSON.parse(Buffer.from(encoded, 'base64url').toString());
      return { trackingId: data.trackingId, email: data.email };
    } catch {
      return null;
    }
  }

  /**
   * Get tracking pixel response
   */
  getTrackingPixel(): Buffer {
    return TRACKING_CONFIG.trackingPixel;
  }

  /**
   * Get tracking pixel content type
   */
  getTrackingPixelContentType(): string {
    return 'image/gif';
  }
}

// Export singleton
export const trackingService = new TrackingService();
