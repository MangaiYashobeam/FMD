import { Request, Response } from 'express';
import { emailService } from '@/services/email.service';
import { queueEmail } from '@/queues/email.queue';
import prisma from '@/config/database';
import { logger } from '@/utils/logger';
import { AuthRequest } from '@/middleware/auth';

/**
 * Email Controller
 * Admin endpoints for email management and testing
 */

/**
 * Send test email
 * POST /api/email/test
 */
export async function sendTestEmail(req: Request, res: Response) {
  try {
    const { to, subject, body } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, subject, body',
      });
    }

    const result = await emailService.sendEmail({
      to,
      subject,
      html: body,
      text: body.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    });

    return res.json({
      success: result,
      message: result ? 'Test email sent successfully' : 'Failed to send test email',
    });
  } catch (error) {
    logger.error('Send test email error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send test email',
    });
  }
}

/**
 * Get email logs
 * GET /api/email/logs
 */
export async function getEmailLogs(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const status = req.query.status as string;

    const skip = (page - 1) * limit;

    const where = status ? { status } : {};

    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.emailLog.count({ where }),
    ]);

    return res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error('Get email logs error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch email logs',
    });
  }
}

/**
 * Resend failed email
 * POST /api/email/resend/:logId
 */
export async function resendEmail(req: Request, res: Response) {
  try {
    const { logId } = req.params;

    const log = await prisma.emailLog.findUnique({
      where: { id: String(logId) },
    });

    if (!log) {
      return res.status(404).json({
        success: false,
        error: 'Email log not found',
      });
    }

    // Queue for retry
    await queueEmail({
      to: log.recipient,
      subject: `[RESEND] ${log.subject}`,
      html: '<p>This is a resend of a previously failed email.</p>',
    });

    return res.json({
      success: true,
      message: 'Email queued for resending',
    });
  } catch (error) {
    logger.error('Resend email error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to resend email',
    });
  }
}

/**
 * Get email statistics
 * GET /api/email/stats
 */
export async function getEmailStats(req: Request, res: Response) {
  try {
    const period = req.query.period as string || '7d'; // 7d, 30d, 90d

    let daysAgo = 7;
    if (period === '30d') daysAgo = 30;
    else if (period === '90d') daysAgo = 90;

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - daysAgo);

    // Get stats grouped by status and date
    const stats = await prisma.$queryRaw<Array<any>>`
      SELECT 
        status,
        COUNT(*)::integer as count,
        DATE(created_at) as date
      FROM email_logs
      WHERE created_at >= ${dateFrom}
      GROUP BY status, DATE(created_at)
      ORDER BY date DESC
    `;

    // Get totals by status
    const totals = await prisma.emailLog.groupBy({
      by: ['status'],
      where: {
        createdAt: {
          gte: dateFrom,
        },
      },
      _count: {
        status: true,
      },
    });

    return res.json({
      success: true,
      data: {
        period,
        stats,
        totals: totals.map(t => ({
          status: t.status,
          count: t._count.status,
        })),
      },
    });
  } catch (error) {
    logger.error('Get email stats error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch email statistics',
    });
  }
}

/**
 * Send bulk email (admin only)
 * POST /api/email/bulk
 */
export async function sendBulkEmail(req: Request, res: Response) {
  try {
    const { recipients, subject, body, accountId } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Recipients must be a non-empty array',
      });
    }

    if (!subject || !body) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: subject, body',
      });
    }

    // Queue emails with lower priority for bulk sends
    for (const recipient of recipients) {
      await queueEmail(
        {
          to: recipient,
          subject,
          html: body,
          text: body.replace(/<[^>]*>/g, ''),
        },
        5 // Lower priority
      );
    }

    // Log bulk send
    const authReq = req as AuthRequest;
    if (authReq.user) {
      await prisma.auditLog.create({
        data: {
          userId: authReq.user.id,
          action: 'BULK_EMAIL_SENT',
          entityType: 'email',
          entityId: 'bulk',
          metadata: {
            recipientCount: recipients.length,
            subject,
            accountId,
          },
        },
      });
    }

    return res.json({
      success: true,
      message: `Queued ${recipients.length} emails for sending`,
      data: {
        count: recipients.length,
      },
    });
  } catch (error) {
    logger.error('Send bulk email error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to queue bulk emails',
    });
  }
}

/**
 * Get email templates
 * GET /api/email/templates
 */
export async function getEmailTemplates(_req: Request, res: Response) {
  const templates = [
    {
      id: 'welcome',
      name: 'Welcome Email',
      description: 'Sent to new users upon registration',
      variables: ['userName', 'userEmail', 'tempPassword'],
    },
    {
      id: 'password-reset',
      name: 'Password Reset',
      description: 'Sent when user requests password reset',
      variables: ['userName', 'resetUrl'],
    },
    {
      id: 'sync-complete',
      name: 'Sync Completion',
      description: 'Sent after inventory sync completes',
      variables: ['accountName', 'imported', 'updated', 'failed'],
    },
    {
      id: 'payment-receipt',
      name: 'Payment Receipt',
      description: 'Sent after successful payment',
      variables: ['accountName', 'amount', 'invoiceUrl'],
    },
    {
      id: 'payment-failed',
      name: 'Payment Failed',
      description: 'Sent when payment fails',
      variables: ['amount', 'reason'],
    },
    {
      id: 'daily-digest',
      name: 'Daily Digest',
      description: 'Daily summary of activity',
      variables: ['newPosts', 'totalViews', 'messages', 'syncStatus'],
    },
  ];

  return res.json({
    success: true,
    data: templates,
  });
}
