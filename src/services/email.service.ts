import nodemailer from 'nodemailer';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { logger } from '@/utils/logger';
import prisma from '@/config/database';

/**
 * Email Service
 * Handles all email sending with template support and queuing
 * Default Domain: dealersface.com
 * System Sender: fb-api@dealersface.com
 * 
 * Supports both SES API (recommended) and SMTP
 */

// System email defaults
const SYSTEM_DOMAIN = 'dealersface.com';
const SYSTEM_FROM_EMAIL = `fb-api@${SYSTEM_DOMAIN}`;
const SYSTEM_FROM_NAME = 'Dealers Face';
const SYSTEM_SUPPORT_EMAIL = `support@${SYSTEM_DOMAIN}`;
const SYSTEM_NOREPLY_EMAIL = `noreply@${SYSTEM_DOMAIN}`;

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  from?: string; // Optional override for from address
  fromName?: string; // Optional override for from name
  attachments?: Array<{
    filename: string;
    content?: Buffer;
    path?: string;
  }>;
}

export interface EmailTemplate {
  name: string;
  subject: string;
  html: string;
  text?: string;
}

export interface ComposeEmailOptions {
  to: string | string[];
  subject: string;
  body: string; // HTML body
  templateSlug?: string; // Optional template to use
  variables?: Record<string, any>; // Template variables
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  scheduledAt?: Date; // For scheduled sending
  attachments?: Array<{ filename: string; content?: Buffer; path?: string }>;
}

export class EmailService {
  private transporter!: nodemailer.Transporter;
  private sesClient: SESClient | null = null;
  private useSesApi: boolean = false;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    // Check for SES API credentials (preferred - no SMTP ports needed)
    const sesAccessKey = process.env.AWS_ACCESS_KEY_ID || process.env.SES_ACCESS_KEY_ID;
    const sesSecretKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.SES_SECRET_ACCESS_KEY;
    const sesRegion = process.env.SES_REGION || process.env.AWS_REGION || 'eu-north-1';
    
    // Use dealersface.com as default system domain
    this.fromEmail = process.env.EMAIL_FROM || SYSTEM_FROM_EMAIL;
    this.fromName = process.env.EMAIL_FROM_NAME || SYSTEM_FROM_NAME;

    // Prefer SES API over SMTP (works on Railway without port issues)
    if (sesAccessKey && sesSecretKey) {
      logger.info(`📧 Configuring email with Amazon SES API (${sesRegion})`);
      this.sesClient = new SESClient({
        region: sesRegion,
        credentials: {
          accessKeyId: sesAccessKey,
          secretAccessKey: sesSecretKey,
        },
      });
      this.useSesApi = true;
      return;
    }

    // Fallback to SMTP (SES SMTP or generic)
    const sesHost = process.env.SES_SMTP_HOST;
    const sesUser = process.env.SES_SMTP_USER;
    const sesPass = process.env.SES_SMTP_PASS;
    
    const smtpHost = sesHost || process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SES_SMTP_PORT || process.env.SMTP_PORT || '587');
    const smtpUser = sesUser || process.env.SMTP_USER || process.env.EMAIL_FROM;
    const smtpPass = sesPass || process.env.SMTP_PASSWORD;

    if (!smtpPass) {
      logger.warn('No email credentials configured - using test account');
      this.createTestAccount();
    } else {
      logger.info(`📧 Configuring email with ${sesHost ? 'Amazon SES SMTP' : 'SMTP'}: ${smtpHost}:${smtpPort}`);
      
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
      });

      this.verifyConnection();
    }
  }

  private async createTestAccount() {
    try {
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      logger.info(`📧 Email test account created: ${testAccount.user}`);
    } catch (error) {
      logger.error('Failed to create email test account:', error);
    }
  }

  private async verifyConnection() {
    try {
      await this.transporter.verify();
      logger.info('✅ Email service connected successfully');
    } catch (error) {
      logger.error('❌ Email service connection failed:', error);
    }
  }

  /**
   * Send email via SES API
   */
  private async sendViaSesApi(options: EmailOptions): Promise<{ success: boolean; messageId?: string }> {
    if (!this.sesClient) {
      throw new Error('SES client not initialized');
    }

    const fromEmail = options.from || this.fromEmail;
    const fromName = options.fromName || this.fromName;
    const toAddresses = Array.isArray(options.to) ? options.to : [options.to];

    const command = new SendEmailCommand({
      Source: `"${fromName}" <${fromEmail}>`,
      Destination: {
        ToAddresses: toAddresses,
        CcAddresses: options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : undefined,
        BccAddresses: options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : undefined,
      },
      Message: {
        Subject: { Data: options.subject, Charset: 'UTF-8' },
        Body: {
          Html: options.html ? { Data: options.html, Charset: 'UTF-8' } : undefined,
          Text: options.text ? { Data: options.text, Charset: 'UTF-8' } : undefined,
        },
      },
      ReplyToAddresses: options.replyTo ? [options.replyTo] : undefined,
    });

    const response = await this.sesClient.send(command);
    return { success: true, messageId: response.MessageId };
  }

  /**
   * Send email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const fromEmail = options.from || this.fromEmail;
      const fromName = options.fromName || this.fromName;
      
      let messageId: string | undefined;
      
      // Use SES API if available (preferred - no port issues)
      if (this.useSesApi && this.sesClient) {
        const result = await this.sendViaSesApi(options);
        messageId = result.messageId;
        logger.info(`📧 Email sent via SES API: ${messageId} to ${options.to}`);
      } else {
        // Fallback to SMTP
        const info = await this.transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
          subject: options.subject,
          text: options.text,
          html: options.html,
          cc: options.cc,
          bcc: options.bcc,
          replyTo: options.replyTo,
          attachments: options.attachments,
        });
        
        messageId = info.messageId;
        logger.info(`📧 Email sent via SMTP: ${messageId} to ${options.to}`);
        
        // Log preview URL for test accounts
        if (process.env.NODE_ENV === 'development') {
          const previewUrl = nodemailer.getTestMessageUrl(info);
          if (previewUrl) {
            logger.info(`📧 Preview URL: ${previewUrl}`);
          }
        }
      }

      // Save to database
      await this.logEmail(options, 'SENT', messageId);

      return true;
    } catch (error) {
      logger.error('Failed to send email:', error);
      await this.logEmail(options, 'FAILED', undefined, error);
      return false;
    }
  }

  /**
   * Send email using template
   */
  async sendTemplateEmail(
    template: EmailTemplate,
    to: string | string[],
    variables: Record<string, any> = {}
  ): Promise<boolean> {
    const html = this.replaceVariables(template.html, variables);
    const text = template.text ? this.replaceVariables(template.text, variables) : undefined;
    const subject = this.replaceVariables(template.subject, variables);

    return this.sendEmail({
      to,
      subject,
      html,
      text,
    });
  }

  /**
   * Replace variables in template
   */
  private replaceVariables(template: string, variables: Record<string, any>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, String(value));
    }
    return result;
  }

  /**
   * Log email to database
   */
  private async logEmail(
    options: EmailOptions,
    status: string,
    messageId?: string,
    error?: any
  ) {
    try {
      await prisma.emailLog.create({
        data: {
          recipient: Array.isArray(options.to) ? options.to.join(', ') : options.to,
          subject: options.subject,
          status,
          messageId,
          errorMessage: error ? JSON.stringify(error) : null,
        },
      });
    } catch (err) {
      logger.error('Failed to log email:', err);
    }
  }

  /**
   * Welcome email for new users
   */
  async sendWelcomeEmail(userEmail: string, userName: string, tempPassword?: string) {
    const template: EmailTemplate = {
      name: 'welcome',
      subject: 'Welcome to Dealers Face! 🚗',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Welcome to Dealers Face!</h1>
          <p>Hi ${userName},</p>
          <p>Thank you for joining Dealers Face - your automated Facebook Marketplace solution for auto dealerships.</p>
          
          ${tempPassword ? `
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Your Login Credentials</h3>
              <p><strong>Email:</strong> ${userEmail}</p>
              <p><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px;">${tempPassword}</code></p>
              <p style="color: #dc2626; font-size: 14px;">⚠️ Please change your password after first login</p>
            </div>
          ` : ''}
          
          <h3>What's Next?</h3>
          <ul>
            <li>Complete your profile setup</li>
            <li>Configure your FTP sync settings</li>
            <li>Connect your Facebook account</li>
            <li>Start posting vehicles to Marketplace</li>
          </ul>
          
          <p>If you have any questions, our support team is here to help!</p>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px;">
              This is an automated message from Dealers Face. Please do not reply to this email.
            </p>
          </div>
        </div>
      `,
    };

    return this.sendTemplateEmail(template, userEmail, { userName, userEmail, tempPassword });
  }

  /**
   * Password reset email
   */
  async sendPasswordResetEmail(userEmail: string, resetToken: string, userName: string) {
    const resetUrl = `${process.env.API_URL}/reset-password?token=${resetToken}`;

    const template: EmailTemplate = {
      name: 'password-reset',
      subject: 'Reset Your Password - Dealers Face',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Password Reset Request</h1>
          <p>Hi ${userName},</p>
          <p>We received a request to reset your password for your Dealers Face account.</p>
          
          <div style="margin: 30px 0;">
            <a href="${resetUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Or copy and paste this link into your browser:<br>
            <a href="${resetUrl}">${resetUrl}</a>
          </p>
          
          <p style="color: #dc2626; font-size: 14px;">
            ⚠️ This link will expire in 1 hour
          </p>
          
          <p>If you didn't request this, please ignore this email or contact support if you have concerns.</p>
        </div>
      `,
    };

    return this.sendTemplateEmail(template, userEmail, { userName, resetUrl });
  }

  /**
   * Sync completion notification
   */
  async sendSyncCompletionEmail(
    userEmail: string,
    accountName: string,
    stats: { imported: number; updated: number; failed: number }
  ) {
    const template: EmailTemplate = {
      name: 'sync-complete',
      subject: `Inventory Sync Complete - ${accountName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #16a34a;">✅ Sync Completed Successfully</h1>
          <p>Your inventory sync for <strong>${accountName}</strong> has been completed.</p>
          
          <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #16a34a;">Sync Results</h3>
            <table style="width: 100%;">
              <tr>
                <td><strong>New Vehicles:</strong></td>
                <td style="text-align: right;">${stats.imported}</td>
              </tr>
              <tr>
                <td><strong>Updated:</strong></td>
                <td style="text-align: right;">${stats.updated}</td>
              </tr>
              <tr>
                <td><strong>Failed:</strong></td>
                <td style="text-align: right; color: ${stats.failed > 0 ? '#dc2626' : '#6b7280'};">${stats.failed}</td>
              </tr>
            </table>
          </div>
          
          <p>Your vehicles are now ready to be posted to Facebook Marketplace!</p>
        </div>
      `,
    };

    return this.sendTemplateEmail(template, userEmail, { accountName, ...stats });
  }

  /**
   * Payment receipt email
   */
  async sendPaymentReceiptEmail(
    userEmail: string,
    amount: number,
    invoiceUrl: string,
    accountName: string
  ) {
    const template: EmailTemplate = {
      name: 'payment-receipt',
      subject: `Payment Receipt - $${amount.toFixed(2)}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Payment Received</h1>
          <p>Thank you for your payment!</p>
          
          <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Payment Details</h3>
            <table style="width: 100%;">
              <tr>
                <td><strong>Account:</strong></td>
                <td style="text-align: right;">${accountName}</td>
              </tr>
              <tr>
                <td><strong>Amount Paid:</strong></td>
                <td style="text-align: right; font-size: 18px; color: #16a34a;"><strong>$${amount.toFixed(2)}</strong></td>
              </tr>
              <tr>
                <td><strong>Date:</strong></td>
                <td style="text-align: right;">${new Date().toLocaleDateString()}</td>
              </tr>
            </table>
          </div>
          
          <div style="margin: 30px 0;">
            <a href="${invoiceUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Invoice
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Keep this email for your records. You can access your invoice anytime from your dashboard.
          </p>
        </div>
      `,
    };

    return this.sendTemplateEmail(template, userEmail, { accountName, amount, invoiceUrl });
  }

  /**
   * Payment failure notification
   */
  async sendPaymentFailedEmail(userEmail: string, amount: number, reason: string) {
    const template: EmailTemplate = {
      name: 'payment-failed',
      subject: '⚠️ Payment Failed - Action Required',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #dc2626;">Payment Failed</h1>
          <p>We were unable to process your payment of <strong>$${amount.toFixed(2)}</strong>.</p>
          
          <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <h3 style="margin-top: 0; color: #dc2626;">Reason</h3>
            <p>${reason}</p>
          </div>
          
          <h3>What to do next:</h3>
          <ol>
            <li>Check your payment method is valid and has sufficient funds</li>
            <li>Update your payment information in your dashboard</li>
            <li>Contact your bank if you need assistance</li>
          </ol>
          
          <div style="margin: 30px 0;">
            <a href="${process.env.API_URL}/dashboard/billing" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Update Payment Method
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Your account will be suspended if payment is not received within 7 days.
          </p>
        </div>
      `,
    };

    return this.sendTemplateEmail(template, userEmail, { amount, reason });
  }

  /**
   * Daily digest email
   */
  async sendDailyDigest(
    userEmail: string,
    stats: {
      newPosts: number;
      totalViews: number;
      messages: number;
      syncStatus: string;
    }
  ) {
    const template: EmailTemplate = {
      name: 'daily-digest',
      subject: '📊 Your Daily Dealers Face Report',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Your Daily Report</h1>
          <p>Here's what happened in the last 24 hours:</p>
          
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0;">
            <div style="background: #eff6ff; padding: 15px; border-radius: 8px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #2563eb;">${stats.newPosts}</div>
              <div style="color: #6b7280;">New Posts</div>
            </div>
            <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #16a34a;">${stats.totalViews}</div>
              <div style="color: #6b7280;">Total Views</div>
            </div>
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #d97706;">${stats.messages}</div>
              <div style="color: #6b7280;">Messages</div>
            </div>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center;">
              <div style="font-size: 14px; font-weight: bold; color: #4b5563;">${stats.syncStatus}</div>
              <div style="color: #6b7280;">Last Sync</div>
            </div>
          </div>
          
          <div style="margin: 30px 0;">
            <a href="${process.env.API_URL}/dashboard" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Full Dashboard
            </a>
          </div>
        </div>
      `,
    };

    return this.sendTemplateEmail(template, userEmail, stats);
  }

  /**
   * Compose and send custom email (Super Admin feature)
   */
  async composeAndSend(options: ComposeEmailOptions, senderId?: string): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      let htmlContent = options.body;
      let subject = options.subject;

      // If template is specified, load and use it
      if (options.templateSlug) {
        const template = await prisma.emailTemplate.findUnique({
          where: { slug: options.templateSlug },
        });
        
        if (template && template.isActive) {
          htmlContent = this.replaceVariables(template.htmlContent, options.variables || {});
          subject = this.replaceVariables(template.subject, options.variables || {});
        }
      }

      // Wrap body in system email template if not using a template
      if (!options.templateSlug) {
        htmlContent = this.wrapInSystemTemplate(subject, htmlContent);
      }

      const success = await this.sendEmail({
        to: options.to,
        subject,
        html: htmlContent,
        cc: options.cc?.join(', '),
        bcc: options.bcc?.join(', '),
        replyTo: options.replyTo,
        attachments: options.attachments,
      });

      // Log the composed email
      if (success) {
        await prisma.emailLog.create({
          data: {
            recipient: Array.isArray(options.to) ? options.to.join(', ') : options.to,
            subject,
            status: 'SENT',
            metadata: {
              type: 'composed',
              provider: 'smtp',
              templateSlug: options.templateSlug || null,
              sentBy: senderId || 'system',
            },
          },
        });
      }

      return { success, messageId: success ? 'sent' : undefined };
    } catch (error: any) {
      logger.error('Failed to compose and send email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send email using database template
   */
  async sendWithDbTemplate(
    templateSlug: string,
    to: string | string[],
    variables: Record<string, any> = {}
  ): Promise<boolean> {
    try {
      const template = await prisma.emailTemplate.findUnique({
        where: { slug: templateSlug },
      });

      if (!template) {
        logger.error(`Email template not found: ${templateSlug}`);
        return false;
      }

      if (!template.isActive) {
        logger.warn(`Email template is inactive: ${templateSlug}`);
        return false;
      }

      const html = this.replaceVariables(template.htmlContent, variables);
      const text = template.textContent ? this.replaceVariables(template.textContent, variables) : undefined;
      const subject = this.replaceVariables(template.subject, variables);

      return this.sendEmail({
        to,
        subject,
        html: this.wrapInSystemTemplate(subject, html),
        text,
      });
    } catch (error) {
      logger.error('Failed to send template email:', error);
      return false;
    }
  }

  /**
   * Wrap email content in system template
   */
  private wrapInSystemTemplate(title: string, content: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">
                🚗 DealersFace
              </h1>
              <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                Facebook Marketplace Automation
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px 40px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
                      This email was sent by DealersFace
                    </p>
                    <p style="margin: 0 0 10px 0; color: #9ca3af; font-size: 12px;">
                      Powered by GAD Productions LLC
                    </p>
                    <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                      <a href="https://${SYSTEM_DOMAIN}" style="color: #2563eb; text-decoration: none;">dealersface.com</a> |
                      <a href="mailto:${SYSTEM_SUPPORT_EMAIL}" style="color: #2563eb; text-decoration: none;">Contact Support</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <!-- Unsubscribe -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 20px auto 0;">
          <tr>
            <td style="text-align: center; color: #9ca3af; font-size: 11px;">
              <p style="margin: 0;">
                You received this email because you are a registered user of DealersFace.<br>
                © ${new Date().getFullYear()} GAD Productions LLC. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  /**
   * Get system email configuration
   */
  getSystemConfig() {
    return {
      domain: SYSTEM_DOMAIN,
      fromEmail: this.fromEmail,
      fromName: this.fromName,
      supportEmail: SYSTEM_SUPPORT_EMAIL,
      noreplyEmail: SYSTEM_NOREPLY_EMAIL,
    };
  }

  /**
   * Send bulk emails (for announcements, newsletters)
   */
  async sendBulkEmails(
    recipients: string[],
    subject: string,
    htmlContent: string,
    options?: {
      delayMs?: number;
      batchSize?: number;
    }
  ): Promise<{ sent: number; failed: number; errors: string[] }> {
    const results = { sent: 0, failed: 0, errors: [] as string[] };
    const batchSize = options?.batchSize || 50;
    const delayMs = options?.delayMs || 100;

    const wrappedHtml = this.wrapInSystemTemplate(subject, htmlContent);

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (email) => {
        try {
          const success = await this.sendEmail({
            to: email,
            subject,
            html: wrappedHtml,
          });
          if (success) {
            results.sent++;
          } else {
            results.failed++;
            results.errors.push(`Failed to send to ${email}`);
          }
        } catch (error: any) {
          results.failed++;
          results.errors.push(`${email}: ${error.message}`);
        }
      }));

      // Delay between batches to avoid rate limiting
      if (i + batchSize < recipients.length && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }
}

export const emailService = new EmailService();
export { SYSTEM_DOMAIN, SYSTEM_FROM_EMAIL, SYSTEM_FROM_NAME, SYSTEM_SUPPORT_EMAIL, SYSTEM_NOREPLY_EMAIL };

/**
 * Send team invitation email
 * Exported function for easy import in routes
 */
export interface TeamInvitationEmailOptions {
  to: string;
  inviterName: string;
  accountName: string;
  role: string;
  inviteLink: string;
  temporaryPassword: string;
}

export async function sendTeamInvitationEmail(options: TeamInvitationEmailOptions): Promise<boolean> {
  const { to, inviterName, accountName, role, inviteLink, temporaryPassword } = options;
  
  const roleDisplay = role.charAt(0).toUpperCase() + role.slice(1);
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #2563eb;">You've Been Invited! 🎉</h1>
      <p>Hi there,</p>
      <p><strong>${inviterName}</strong> has invited you to join <strong>${accountName}</strong> on DealersFace as a <strong>${roleDisplay}</strong>.</p>
      
      <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
        <h3 style="margin-top: 0; color: #1e40af;">Your Login Credentials</h3>
        <table style="width: 100%;">
          <tr>
            <td><strong>Email:</strong></td>
            <td style="font-family: monospace;">${to}</td>
          </tr>
          <tr>
            <td><strong>Temporary Password:</strong></td>
            <td style="font-family: monospace; color: #dc2626;">${temporaryPassword}</td>
          </tr>
        </table>
      </div>
      
      <div style="margin: 30px 0; text-align: center;">
        <a href="${inviteLink}" style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
          Accept Invitation & Login
        </a>
      </div>
      
      <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; color: #92400e;">
          ⚠️ <strong>Important:</strong> Please change your password after your first login for security purposes.
        </p>
      </div>
      
      <p style="color: #6b7280; font-size: 14px;">
        If the button above doesn't work, copy and paste this link into your browser:<br>
        <a href="${inviteLink}" style="color: #2563eb; word-break: break-all;">${inviteLink}</a>
      </p>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      
      <p style="color: #6b7280; font-size: 13px;">
        If you didn't expect this invitation, you can safely ignore this email.
      </p>
    </div>
  `;
  
  return emailService.sendEmail({
    to,
    subject: `You're invited to join ${accountName} on DealersFace`,
    html,
    text: `
You've Been Invited!

${inviterName} has invited you to join ${accountName} on DealersFace as a ${roleDisplay}.

Your Login Credentials:
- Email: ${to}
- Temporary Password: ${temporaryPassword}

Login here: ${inviteLink}

IMPORTANT: Please change your password after your first login for security purposes.

If you didn't expect this invitation, you can safely ignore this email.
    `.trim(),
  });
}
