/**
 * Email Tracking Routes
 * Handles open tracking pixels, click tracking, and unsubscribe
 */

import { Router, Request, Response } from 'express';
import { trackingService } from '@/services/mail-engine/tracking.service';
import { logger } from '@/utils/logger';
import prisma from '@/config/database';

const router = Router();

/**
 * Open tracking pixel
 * GET /api/email/track/open/:trackingId.gif
 * Returns a 1x1 transparent GIF and records the open
 */
router.get('/open/:trackingId.gif', async (req: Request, res: Response) => {
  try {
    const trackingId = req.params.trackingId as string;
    
    // Extract client info
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = (req.ip || req.socket.remoteAddress || '') as string;

    // Handle open tracking and get pixel
    const gif = await trackingService.handleOpenTracking(
      trackingId,
      ipAddress,
      userAgent
    );
    
    res.set({
      'Content-Type': 'image/gif',
      'Content-Length': gif.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    
    res.send(gif);
  } catch (error) {
    logger.error('Open tracking error:', error);
    // Still return the GIF even on error
    const gif = trackingService.getTrackingPixel();
    res.set('Content-Type', 'image/gif');
    res.send(gif);
  }
});

/**
 * Click tracking redirect
 * GET /api/email/track/click/:trackingId
 * Query params: url (encoded destination URL)
 */
router.get('/click/:trackingId', async (req: Request, res: Response) => {
  try {
    const trackingId = req.params.trackingId as string;
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      res.status(400).send('Missing URL parameter');
      return;
    }

    // Extract client info
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = (req.ip || req.socket.remoteAddress || '') as string;

    // Handle click tracking and get destination URL
    const destinationUrl = await trackingService.handleClickTracking(
      trackingId,
      url,
      ipAddress,
      userAgent
    );

    // Validate URL
    if (!destinationUrl.startsWith('http://') && !destinationUrl.startsWith('https://')) {
      res.status(400).send('Invalid URL');
      return;
    }

    // Redirect to destination
    res.redirect(302, destinationUrl);
  } catch (error) {
    logger.error('Click tracking error:', error);
    res.status(500).send('Tracking error');
  }
});

/**
 * Unsubscribe handler
 * GET /api/email/track/unsubscribe
 * Query params: token
 */
router.get('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Unsubscribe Error</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>Invalid Request</h1>
          <p>The unsubscribe link is invalid or expired.</p>
        </body>
        </html>
      `);
      return;
    }

    // Decode token to get email for display
    const decoded = (trackingService as any).decodeUnsubscribeToken(token);
    const email = decoded?.email || 'your email';

    // Show confirmation page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Unsubscribe</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
          .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #333; }
          p { color: #666; margin: 20px 0; }
          button { background: #dc3545; color: white; border: none; padding: 12px 24px; font-size: 16px; border-radius: 4px; cursor: pointer; }
          button:hover { background: #c82333; }
          .cancel { background: #6c757d; margin-left: 10px; }
          .cancel:hover { background: #5a6268; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Unsubscribe from Emails</h1>
          <p>Are you sure you want to unsubscribe <strong>${email}</strong> from our mailing list?</p>
          <form method="POST" action="/api/email/track/unsubscribe">
            <input type="hidden" name="token" value="${token}" />
            <button type="submit">Yes, Unsubscribe</button>
            <button type="button" class="cancel" onclick="window.close()">Cancel</button>
          </form>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    logger.error('Unsubscribe page error:', error);
    res.status(500).send('Server error');
  }
});

/**
 * Process unsubscribe confirmation
 * POST /api/email/track/unsubscribe
 */
router.post('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).send('Missing token parameter');
      return;
    }

    // Process unsubscribe
    const result = await trackingService.handleUnsubscribe(token);

    if (!result.success) {
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Unsubscribe Error</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>Invalid Link</h1>
          <p>This unsubscribe link is invalid or has expired.</p>
        </body>
        </html>
      `);
      return;
    }

    // Show success page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Unsubscribed</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
          .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #28a745; }
          p { color: #666; margin: 20px 0; }
          .check { font-size: 64px; color: #28a745; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="check">✓</div>
          <h1>Successfully Unsubscribed</h1>
          <p>You have been unsubscribed from our mailing list.</p>
          <p><strong>${result.email}</strong> will no longer receive emails from us.</p>
          <p style="font-size: 14px; color: #999; margin-top: 30px;">
            If you unsubscribed by mistake, please contact support@dealersface.com
          </p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    logger.error('Unsubscribe process error:', error);
    res.status(500).send('Server error');
  }
});

/**
 * Webhook endpoint for external bounce/delivery notifications
 * POST /api/email/track/webhook
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { type, messageId, bounceType, reason } = req.body;

    if (!type || !messageId) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }

    switch (type) {
      case 'bounce':
        await trackingService.processBounce(
          messageId,
          bounceType === 'Permanent' ? 'HARD' : 'SOFT',
          reason || 'Unknown'
        );
        break;

      case 'complaint':
        await trackingService.processComplaint(messageId);
        break;

      case 'delivery':
        // Mark as delivered
        await prisma.emailLog.updateMany({
          where: { messageId },
          data: {
            status: 'DELIVERED',
            deliveredAt: new Date(),
          },
        });
        break;

      default:
        res.status(400).json({ error: 'Unknown event type' });
        return;
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

/**
 * Get tracking stats for a specific email
 * GET /api/email/track/stats/:trackingId
 */
router.get('/stats/:trackingId', async (req: Request, res: Response) => {
  try {
    const trackingId = req.params.trackingId as string;

    const events = await prisma.emailTrackingEvent.findMany({
      where: { trackingId },
      orderBy: { createdAt: 'desc' },
    });

    const stats = {
      trackingId,
      opens: events.filter((e) => e.eventType === 'OPEN').length,
      clicks: events.filter((e) => e.eventType === 'CLICK').length,
      uniqueOpens: new Set(
        events.filter((e) => e.eventType === 'OPEN').map((e) => e.ipAddress)
      ).size,
      uniqueClicks: new Set(
        events.filter((e) => e.eventType === 'CLICK').map((e) => e.ipAddress)
      ).size,
      events: events.map((e) => ({
        type: e.eventType,
        timestamp: e.createdAt,
        url: e.clickedUrl,
        userAgent: e.userAgent,
        ipAddress: e.ipAddress,
      })),
    };

    res.json(stats);
  } catch (error) {
    logger.error('Get tracking stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export default router;
