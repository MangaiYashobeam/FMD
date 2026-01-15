import { Request, Response } from 'express';
import { emailService, SYSTEM_DOMAIN, SYSTEM_FROM_EMAIL, SYSTEM_SUPPORT_EMAIL } from '@/services/email.service';
import { queueEmail } from '@/queues/email.queue';
import prisma from '@/config/database';
import { logger } from '@/utils/logger';
import { AuthRequest } from '@/middleware/auth';

/**
 * Email Controller
 * Admin endpoints for email management, composition, and templates
 * System Domain: dealersface.com
 * Default Sender: fb-api@dealersface.com
 */

// Default system email templates
const DEFAULT_EMAIL_TEMPLATES = [
  {
    name: 'Welcome Email',
    slug: 'welcome',
    subject: 'Welcome to DealersFace! 🚗',
    description: 'Sent to new users upon registration',
    variables: ['userName', 'userEmail', 'tempPassword', 'loginUrl'],
    isSystem: true,
    htmlContent: `
<h1 style="color: #2563eb; margin-bottom: 20px;">Welcome to DealersFace!</h1>
<p>Hi {{userName}},</p>
<p>Thank you for joining DealersFace - your automated Facebook Marketplace solution for auto dealerships.</p>

{{#if tempPassword}}
<div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #374151;">Your Login Credentials</h3>
  <p><strong>Email:</strong> {{userEmail}}</p>
  <p><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px;">{{tempPassword}}</code></p>
  <p style="color: #dc2626; font-size: 14px;">⚠️ Please change your password after first login</p>
</div>
{{/if}}

<h3>What's Next?</h3>
<ul>
  <li>Complete your profile setup</li>
  <li>Configure your FTP sync settings</li>
  <li>Connect your Facebook account</li>
  <li>Start posting vehicles to Marketplace</li>
</ul>

<div style="margin: 30px 0;">
  <a href="{{loginUrl}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
    Log In to Your Account
  </a>
</div>

<p>If you have any questions, our support team is here to help!</p>
    `,
  },
  {
    name: 'Password Reset',
    slug: 'password-reset',
    subject: 'Reset Your Password - DealersFace',
    description: 'Sent when user requests password reset',
    variables: ['userName', 'resetUrl'],
    isSystem: true,
    htmlContent: `
<h1 style="color: #2563eb; margin-bottom: 20px;">Password Reset Request</h1>
<p>Hi {{userName}},</p>
<p>We received a request to reset your password for your DealersFace account.</p>

<div style="margin: 30px 0;">
  <a href="{{resetUrl}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
    Reset Password
  </a>
</div>

<p style="color: #6b7280; font-size: 14px;">
  Or copy and paste this link into your browser:<br>
  <a href="{{resetUrl}}" style="color: #2563eb;">{{resetUrl}}</a>
</p>

<p style="color: #dc2626; font-size: 14px;">⚠️ This link will expire in 1 hour</p>

<p>If you didn't request this, please ignore this email or contact support if you have concerns.</p>
    `,
  },
  {
    name: 'New Lead Notification',
    slug: 'new-lead',
    subject: '🔔 New Lead: {{customerName}} - {{vehicleInfo}}',
    description: 'Sent when a new lead is received',
    variables: ['customerName', 'customerEmail', 'customerPhone', 'vehicleInfo', 'source', 'leadUrl'],
    isSystem: true,
    htmlContent: `
<h1 style="color: #16a34a; margin-bottom: 20px;">🎉 New Lead Received!</h1>

<div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
  <h3 style="margin-top: 0; color: #166534;">Customer Information</h3>
  <table style="width: 100%;">
    <tr>
      <td style="padding: 5px 0;"><strong>Name:</strong></td>
      <td>{{customerName}}</td>
    </tr>
    <tr>
      <td style="padding: 5px 0;"><strong>Email:</strong></td>
      <td><a href="mailto:{{customerEmail}}">{{customerEmail}}</a></td>
    </tr>
    <tr>
      <td style="padding: 5px 0;"><strong>Phone:</strong></td>
      <td><a href="tel:{{customerPhone}}">{{customerPhone}}</a></td>
    </tr>
    <tr>
      <td style="padding: 5px 0;"><strong>Vehicle Interest:</strong></td>
      <td>{{vehicleInfo}}</td>
    </tr>
    <tr>
      <td style="padding: 5px 0;"><strong>Source:</strong></td>
      <td>{{source}}</td>
    </tr>
  </table>
</div>

<div style="margin: 30px 0;">
  <a href="{{leadUrl}}" style="background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
    View Lead Details
  </a>
</div>
    `,
  },
  {
    name: 'Sync Completion',
    slug: 'sync-complete',
    subject: '✅ Inventory Sync Complete - {{accountName}}',
    description: 'Sent after inventory sync completes',
    variables: ['accountName', 'imported', 'updated', 'failed', 'dashboardUrl'],
    isSystem: true,
    htmlContent: `
<h1 style="color: #16a34a; margin-bottom: 20px;">✅ Sync Completed Successfully</h1>
<p>Your inventory sync for <strong>{{accountName}}</strong> has been completed.</p>

<div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #16a34a;">Sync Results</h3>
  <table style="width: 100%;">
    <tr>
      <td><strong>New Vehicles:</strong></td>
      <td style="text-align: right; font-size: 18px; color: #16a34a;">{{imported}}</td>
    </tr>
    <tr>
      <td><strong>Updated:</strong></td>
      <td style="text-align: right; font-size: 18px; color: #2563eb;">{{updated}}</td>
    </tr>
    <tr>
      <td><strong>Failed:</strong></td>
      <td style="text-align: right; font-size: 18px; color: #dc2626;">{{failed}}</td>
    </tr>
  </table>
</div>

<p>Your vehicles are now ready to be posted to Facebook Marketplace!</p>

<div style="margin: 30px 0;">
  <a href="{{dashboardUrl}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
    View Inventory
  </a>
</div>
    `,
  },
  {
    name: 'Payment Receipt',
    slug: 'payment-receipt',
    subject: '💳 Payment Receipt - ${{amount}}',
    description: 'Sent after successful payment',
    variables: ['accountName', 'amount', 'invoiceUrl', 'paymentDate'],
    isSystem: true,
    htmlContent: `
<h1 style="color: #2563eb; margin-bottom: 20px;">Payment Received</h1>
<p>Thank you for your payment!</p>

<div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3 style="margin-top: 0;">Payment Details</h3>
  <table style="width: 100%;">
    <tr>
      <td><strong>Account:</strong></td>
      <td style="text-align: right;">{{accountName}}</td>
    </tr>
    <tr>
      <td><strong>Amount Paid:</strong></td>
      <td style="text-align: right; font-size: 18px; color: #16a34a;"><strong>\${{amount}}</strong></td>
    </tr>
    <tr>
      <td><strong>Date:</strong></td>
      <td style="text-align: right;">{{paymentDate}}</td>
    </tr>
  </table>
</div>

<div style="margin: 30px 0;">
  <a href="{{invoiceUrl}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
    View Invoice
  </a>
</div>

<p style="color: #6b7280; font-size: 14px;">
  Keep this email for your records. You can access your invoice anytime from your dashboard.
</p>
    `,
  },
  {
    name: 'Payment Failed',
    slug: 'payment-failed',
    subject: '⚠️ Payment Failed - Action Required',
    description: 'Sent when payment fails',
    variables: ['amount', 'reason', 'billingUrl'],
    isSystem: true,
    htmlContent: `
<h1 style="color: #dc2626; margin-bottom: 20px;">Payment Failed</h1>
<p>We were unable to process your payment of <strong>\${{amount}}</strong>.</p>

<div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
  <h3 style="margin-top: 0; color: #dc2626;">Reason</h3>
  <p>{{reason}}</p>
</div>

<h3>What to do next:</h3>
<ol>
  <li>Check your payment method is valid and has sufficient funds</li>
  <li>Update your payment information in your dashboard</li>
  <li>Contact your bank if you need assistance</li>
</ol>

<div style="margin: 30px 0;">
  <a href="{{billingUrl}}" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
    Update Payment Method
  </a>
</div>

<p style="color: #6b7280; font-size: 14px;">
  Your account will be suspended if payment is not received within 7 days.
</p>
    `,
  },
  {
    name: 'Account Suspended',
    slug: 'account-suspended',
    subject: '🚫 Account Suspended - {{accountName}}',
    description: 'Sent when an account is suspended',
    variables: ['accountName', 'reason', 'supportEmail'],
    isSystem: true,
    htmlContent: `
<h1 style="color: #dc2626; margin-bottom: 20px;">Account Suspended</h1>
<p>Your DealersFace account <strong>{{accountName}}</strong> has been suspended.</p>

<div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
  <h3 style="margin-top: 0; color: #dc2626;">Reason</h3>
  <p>{{reason}}</p>
</div>

<p>If you believe this is a mistake or would like to appeal, please contact our support team:</p>

<div style="margin: 30px 0;">
  <a href="mailto:{{supportEmail}}" style="background: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
    Contact Support
  </a>
</div>
    `,
  },
  {
    name: 'Account Invitation',
    slug: 'account-invitation',
    subject: '📨 You\'ve been invited to {{accountName}} on DealersFace',
    description: 'Sent when a user is invited to an account',
    variables: ['inviterName', 'accountName', 'role', 'inviteUrl'],
    isSystem: true,
    htmlContent: `
<h1 style="color: #2563eb; margin-bottom: 20px;">You've Been Invited!</h1>
<p><strong>{{inviterName}}</strong> has invited you to join <strong>{{accountName}}</strong> on DealersFace.</p>

<div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3 style="margin-top: 0;">Invitation Details</h3>
  <table style="width: 100%;">
    <tr>
      <td><strong>Account:</strong></td>
      <td>{{accountName}}</td>
    </tr>
    <tr>
      <td><strong>Your Role:</strong></td>
      <td>{{role}}</td>
    </tr>
  </table>
</div>

<div style="margin: 30px 0;">
  <a href="{{inviteUrl}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
    Accept Invitation
  </a>
</div>

<p style="color: #6b7280; font-size: 14px;">
  This invitation will expire in 7 days.
</p>
    `,
  },
  {
    name: 'Daily Digest',
    slug: 'daily-digest',
    subject: '📊 Your Daily DealersFace Report',
    description: 'Daily summary of activity',
    variables: ['newPosts', 'totalViews', 'messages', 'newLeads', 'syncStatus', 'dashboardUrl'],
    isSystem: true,
    htmlContent: `
<h1 style="color: #2563eb; margin-bottom: 20px;">Your Daily Report</h1>
<p>Here's what happened in the last 24 hours:</p>

<div style="display: flex; flex-wrap: wrap; gap: 15px; margin: 20px 0;">
  <div style="flex: 1; min-width: 120px; background: #eff6ff; padding: 15px; border-radius: 8px; text-align: center;">
    <div style="font-size: 32px; font-weight: bold; color: #2563eb;">{{newPosts}}</div>
    <div style="color: #6b7280;">New Posts</div>
  </div>
  <div style="flex: 1; min-width: 120px; background: #f0fdf4; padding: 15px; border-radius: 8px; text-align: center;">
    <div style="font-size: 32px; font-weight: bold; color: #16a34a;">{{totalViews}}</div>
    <div style="color: #6b7280;">Total Views</div>
  </div>
  <div style="flex: 1; min-width: 120px; background: #fef3c7; padding: 15px; border-radius: 8px; text-align: center;">
    <div style="font-size: 32px; font-weight: bold; color: #d97706;">{{messages}}</div>
    <div style="color: #6b7280;">Messages</div>
  </div>
  <div style="flex: 1; min-width: 120px; background: #fce7f3; padding: 15px; border-radius: 8px; text-align: center;">
    <div style="font-size: 32px; font-weight: bold; color: #db2777;">{{newLeads}}</div>
    <div style="color: #6b7280;">New Leads</div>
  </div>
</div>

<p><strong>Last Sync:</strong> {{syncStatus}}</p>

<div style="margin: 30px 0;">
  <a href="{{dashboardUrl}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
    View Full Dashboard
  </a>
</div>
    `,
  },
  {
    name: 'System Announcement',
    slug: 'system-announcement',
    subject: '📢 {{announcementTitle}}',
    description: 'System-wide announcements from admin',
    variables: ['announcementTitle', 'announcementContent', 'ctaText', 'ctaUrl'],
    isSystem: true,
    htmlContent: `
<h1 style="color: #2563eb; margin-bottom: 20px;">{{announcementTitle}}</h1>

<div style="line-height: 1.6;">
  {{announcementContent}}
</div>

{{#if ctaUrl}}
<div style="margin: 30px 0;">
  <a href="{{ctaUrl}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
    {{ctaText}}
  </a>
</div>
{{/if}}
    `,
  },
];

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
  try {
    const templates = await prisma.emailTemplate.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });

    return res.json({
      success: true,
      data: { templates },
    });
  } catch (error) {
    logger.error('Get email templates error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch email templates',
    });
  }
}

/**
 * Get email system configuration
 * GET /api/email/config
 */
export async function getEmailConfig(_req: Request, res: Response) {
  try {
    const systemConfig = emailService.getSystemConfig();
    
    // Get stored SMTP settings
    const storedSettings = await prisma.systemSettings.findUnique({
      where: { key: 'email' },
    });

    const settings = storedSettings?.value as Record<string, any> || {};

    return res.json({
      success: true,
      data: {
        systemDomain: systemConfig.domain,
        defaultFromEmail: systemConfig.fromEmail,
        defaultFromName: systemConfig.fromName,
        supportEmail: systemConfig.supportEmail,
        noreplyEmail: systemConfig.noreplyEmail,
        smtpHost: settings.smtpHost || process.env.SMTP_HOST || '',
        smtpPort: settings.smtpPort || process.env.SMTP_PORT || 587,
        smtpUser: settings.smtpUser || process.env.SMTP_USER || '',
        smtpSecure: settings.smtpSecure || false,
        fromEmail: settings.fromEmail || systemConfig.fromEmail,
        fromName: settings.fromName || systemConfig.fromName,
        isConfigured: !!(process.env.SMTP_PASSWORD || settings.smtpPassword),
      },
    });
  } catch (error) {
    logger.error('Get email config error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get email configuration',
    });
  }
}

/**
 * Update email configuration
 * PUT /api/email/config
 */
export async function updateEmailConfig(req: Request, res: Response) {
  try {
    const { smtpHost, smtpPort, smtpUser, smtpPassword, smtpSecure, fromEmail, fromName } = req.body;

    // Get existing settings
    const existing = await prisma.systemSettings.findUnique({
      where: { key: 'email' },
    });

    const existingValue = (existing?.value as Record<string, any>) || {};

    // Merge settings (don't overwrite password with empty value)
    const newSettings = {
      ...existingValue,
      smtpHost: smtpHost || existingValue.smtpHost,
      smtpPort: smtpPort || existingValue.smtpPort,
      smtpUser: smtpUser || existingValue.smtpUser,
      smtpSecure: smtpSecure !== undefined ? smtpSecure : existingValue.smtpSecure,
      fromEmail: fromEmail || existingValue.fromEmail,
      fromName: fromName || existingValue.fromName,
    };

    // Only update password if provided and not masked
    if (smtpPassword && smtpPassword !== '********') {
      newSettings.smtpPassword = smtpPassword;
    }

    await prisma.systemSettings.upsert({
      where: { key: 'email' },
      update: { value: newSettings },
      create: { key: 'email', value: newSettings },
    });

    // Audit log
    const authReq = req as AuthRequest;
    await prisma.auditLog.create({
      data: {
        userId: authReq.user?.id,
        action: 'EMAIL_CONFIG_UPDATE',
        entityType: 'system_settings',
        entityId: 'email',
        metadata: { updated: Object.keys(req.body) },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    return res.json({
      success: true,
      message: 'Email configuration updated successfully',
    });
  } catch (error) {
    logger.error('Update email config error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update email configuration',
    });
  }
}

/**
 * Compose and send email (Super Admin feature)
 * POST /api/email/compose
 */
export async function composeEmail(req: Request, res: Response) {
  try {
    const { to, subject, body, cc, bcc, templateSlug, variables, replyTo } = req.body;
    const authReq = req as AuthRequest;

    // Parse recipients
    const recipients = Array.isArray(to) ? to : to.split(',').map((e: string) => e.trim());

    const result = await emailService.composeAndSend(
      {
        to: recipients,
        subject,
        body,
        cc,
        bcc,
        templateSlug,
        variables,
        replyTo,
      },
      authReq.user?.id
    );

    if (result.success) {
      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: authReq.user?.id,
          action: 'EMAIL_COMPOSED',
          entityType: 'email',
          entityId: result.messageId || 'composed',
          metadata: {
            recipients: recipients.length,
            subject,
            templateUsed: templateSlug || null,
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });

      return res.json({
        success: true,
        message: `Email sent successfully to ${recipients.length} recipient(s)`,
        data: { messageId: result.messageId },
      });
    }

    return res.status(500).json({
      success: false,
      error: result.error || 'Failed to send email',
    });
  } catch (error) {
    logger.error('Compose email error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to compose and send email',
    });
  }
}

/**
 * Get available recipients
 * GET /api/email/recipients
 */
export async function getRecipients(req: Request, res: Response) {
  try {
    const { type, search } = req.query;
    const searchStr = search ? String(search) : undefined;

    let users: any[] = [];
    let accounts: any[] = [];

    // Build search condition
    const searchCondition = searchStr ? {
      OR: [
        { email: { contains: searchStr, mode: 'insensitive' as const } },
        { firstName: { contains: searchStr, mode: 'insensitive' as const } },
        { lastName: { contains: searchStr, mode: 'insensitive' as const } },
      ],
    } : {};

    if (!type || type === 'all' || type === 'users') {
      users = await prisma.user.findMany({
        where: {
          isActive: true,
          ...searchCondition,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          accountUsers: {
            select: {
              role: true,
              account: {
                select: { name: true },
              },
            },
          },
        },
        take: 50,
      });
    }

    if (!type || type === 'all' || type === 'admins') {
      const admins = await prisma.accountUser.findMany({
        where: {
          role: { in: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNT_OWNER'] },
          user: { isActive: true },
        },
        select: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          role: true,
          account: {
            select: { name: true },
          },
        },
        take: 50,
      });

      if (type === 'admins') {
        users = admins.map(a => ({
          ...a.user,
          role: a.role,
          accountName: a.account.name,
        }));
      }
    }

    if (!type || type === 'all' || type === 'accounts') {
      accounts = await prisma.account.findMany({
        where: {
          isActive: true,
          ...(searchStr ? {
            OR: [
              { name: { contains: searchStr, mode: 'insensitive' } },
              { dealershipName: { contains: searchStr, mode: 'insensitive' } },
            ],
          } : {}),
        },
        select: {
          id: true,
          name: true,
          dealershipName: true,
          accountUsers: {
            where: { role: { in: ['ACCOUNT_OWNER', 'ADMIN'] } },
            select: {
              user: {
                select: { email: true, firstName: true, lastName: true },
              },
            },
          },
        },
        take: 50,
      });
    }

    return res.json({
      success: true,
      data: {
        users: users.map(u => ({
          id: u.id,
          email: u.email,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
          type: 'user',
        })),
        accounts: accounts.map(a => ({
          id: a.id,
          name: a.dealershipName || a.name,
          emails: a.accountUsers.map((au: any) => au.user.email),
          type: 'account',
        })),
      },
    });
  } catch (error) {
    logger.error('Get recipients error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch recipients',
    });
  }
}

/**
 * Get single email log details
 * GET /api/email/logs/:logId
 */
export async function getEmailLogDetails(req: Request, res: Response) {
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

    return res.json({
      success: true,
      data: log,
    });
  } catch (error) {
    logger.error('Get email log details error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch email log details',
    });
  }
}

/**
 * Get all templates (from database)
 * GET /api/email/templates
 */
export async function getTemplates(_req: Request, res: Response) {
  try {
    const templates = await prisma.emailTemplate.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });

    return res.json({
      success: true,
      data: { templates },
    });
  } catch (error) {
    logger.error('Get templates error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch templates',
    });
  }
}

/**
 * Get single template
 * GET /api/email/templates/:templateId
 */
export async function getTemplate(req: Request, res: Response) {
  try {
    const { templateId } = req.params;

    const template = await prisma.emailTemplate.findUnique({
      where: { id: String(templateId) },
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    return res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error('Get template error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch template',
    });
  }
}

/**
 * Create email template
 * POST /api/email/templates
 */
export async function createTemplate(req: Request, res: Response) {
  try {
    const { name, slug, subject, htmlContent, textContent, variables, description, isActive } = req.body;
    const authReq = req as AuthRequest;

    // Check if slug exists
    const existing = await prisma.emailTemplate.findUnique({
      where: { slug },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'A template with this slug already exists',
      });
    }

    const template = await prisma.emailTemplate.create({
      data: {
        name,
        slug,
        subject,
        htmlContent,
        textContent,
        variables: variables || [],
        description,
        isActive: isActive !== false,
        isSystem: false,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: authReq.user?.id,
        action: 'EMAIL_TEMPLATE_CREATE',
        entityType: 'email_template',
        entityId: template.id,
        metadata: { templateName: name, slug },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Template created successfully',
      data: template,
    });
  } catch (error) {
    logger.error('Create template error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create template',
    });
  }
}

/**
 * Update email template
 * PUT /api/email/templates/:templateId
 */
export async function updateTemplate(req: Request, res: Response) {
  try {
    const { templateId } = req.params;
    const { name, slug, subject, htmlContent, textContent, variables, description, isActive } = req.body;
    const authReq = req as AuthRequest;

    const existing = await prisma.emailTemplate.findUnique({
      where: { id: String(templateId) },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    // Check slug uniqueness if changed
    if (slug && slug !== existing.slug) {
      const slugExists = await prisma.emailTemplate.findUnique({
        where: { slug },
      });
      if (slugExists) {
        return res.status(400).json({
          success: false,
          error: 'A template with this slug already exists',
        });
      }
    }

    const template = await prisma.emailTemplate.update({
      where: { id: String(templateId) },
      data: {
        name: name || existing.name,
        slug: slug || existing.slug,
        subject: subject || existing.subject,
        htmlContent: htmlContent || existing.htmlContent,
        textContent: textContent !== undefined ? textContent : existing.textContent,
        variables: variables !== undefined ? variables : existing.variables,
        description: description !== undefined ? description : existing.description,
        isActive: isActive !== undefined ? isActive : existing.isActive,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: authReq.user?.id,
        action: 'EMAIL_TEMPLATE_UPDATE',
        entityType: 'email_template',
        entityId: template.id,
        metadata: { templateName: template.name },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    return res.json({
      success: true,
      message: 'Template updated successfully',
      data: template,
    });
  } catch (error) {
    logger.error('Update template error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update template',
    });
  }
}

/**
 * Delete email template
 * DELETE /api/email/templates/:templateId
 */
export async function deleteTemplate(req: Request, res: Response) {
  try {
    const { templateId } = req.params;
    const authReq = req as AuthRequest;

    const existing = await prisma.emailTemplate.findUnique({
      where: { id: String(templateId) },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    if (existing.isSystem) {
      return res.status(400).json({
        success: false,
        error: 'System templates cannot be deleted',
      });
    }

    await prisma.emailTemplate.delete({
      where: { id: String(templateId) },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: authReq.user?.id,
        action: 'EMAIL_TEMPLATE_DELETE',
        entityType: 'email_template',
        entityId: templateId,
        metadata: { templateName: existing.name },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    return res.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    logger.error('Delete template error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete template',
    });
  }
}

/**
 * Preview template with variables
 * POST /api/email/templates/:templateId/preview
 */
export async function previewTemplate(req: Request, res: Response) {
  try {
    const { templateId } = req.params;
    const { variables } = req.body;

    const template = await prisma.emailTemplate.findUnique({
      where: { id: String(templateId) },
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    // Replace variables in content
    let previewHtml = template.htmlContent;
    let previewSubject = template.subject;

    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        previewHtml = previewHtml.replace(regex, String(value));
        previewSubject = previewSubject.replace(regex, String(value));
      }
    }

    return res.json({
      success: true,
      data: {
        subject: previewSubject,
        html: previewHtml,
        variables: template.variables,
      },
    });
  } catch (error) {
    logger.error('Preview template error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to preview template',
    });
  }
}

/**
 * Seed default system templates
 * POST /api/email/templates/seed-defaults
 */
export async function seedDefaultTemplates(req: Request, res: Response) {
  try {
    const authReq = req as AuthRequest;
    let created = 0;
    let skipped = 0;

    for (const template of DEFAULT_EMAIL_TEMPLATES) {
      // Check if already exists
      const existing = await prisma.emailTemplate.findUnique({
        where: { slug: template.slug },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.emailTemplate.create({
        data: {
          name: template.name,
          slug: template.slug,
          subject: template.subject,
          htmlContent: template.htmlContent,
          description: template.description,
          variables: template.variables,
          isSystem: template.isSystem,
          isActive: true,
        },
      });
      created++;
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: authReq.user?.id,
        action: 'EMAIL_TEMPLATES_SEEDED',
        entityType: 'email_template',
        entityId: 'system',
        metadata: { created, skipped, total: DEFAULT_EMAIL_TEMPLATES.length },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    return res.json({
      success: true,
      message: `Seeded ${created} templates (${skipped} already existed)`,
      data: { created, skipped },
    });
  } catch (error) {
    logger.error('Seed templates error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to seed default templates',
    });
  }
}
