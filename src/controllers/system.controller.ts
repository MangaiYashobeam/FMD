import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import nodemailer from 'nodemailer';

interface SystemSettingsRecord {
  id: string;
  key: string;
  value: any;
  createdAt: Date;
  updatedAt: Date;
}

// Default system settings
const defaultSettings = {
  general: {
    siteName: 'DealersFace',
    siteUrl: 'https://dealersface.com',
    supportEmail: 'support@dealersface.com',
    maintenanceMode: false,
    allowRegistration: true,
    requireEmailVerification: true,
    maxAccountsPerUser: 3,
    defaultTrialDays: 14,
  },
  email: {
    provider: 'smtp',
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: parseInt(process.env.SMTP_PORT || '587'),
    smtpUser: process.env.SMTP_USER || '',
    smtpPassword: '', // Never return password
    smtpSecure: process.env.SMTP_SECURE === 'true',
    fromEmail: process.env.SMTP_FROM || 'fb-api@dealersface.com',
    fromName: process.env.SMTP_FROM_NAME || 'DealersFace',
  },
  security: {
    twoFactorRequired: false,
    sessionTimeout: 60,
    passwordPolicy: 'medium',
    rateLimitPerMinute: 500,
    ipWhitelist: [],
  },
  integrations: {
    facebookAppId: process.env.FACEBOOK_APP_ID || '',
    facebookAppSecret: '', // Never return secret
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    stripeSecretKey: '', // Never return secret
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    awsBucket: process.env.AWS_BUCKET || '',
    firebaseProjectId: '',
  },
};

// Get all system settings
export const getSystemSettings = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.systemSettings.findMany() as SystemSettingsRecord[];
    
    // Build response with defaults merged with stored settings
    const result: Record<string, any> = {};
    
    for (const key of Object.keys(defaultSettings)) {
      const stored = settings.find((s: SystemSettingsRecord) => s.key === key);
      result[key] = stored 
        ? { ...defaultSettings[key as keyof typeof defaultSettings], ...stored.value as object }
        : defaultSettings[key as keyof typeof defaultSettings];
    }

    // Mask sensitive values
    if (result.email?.smtpPassword) {
      result.email.smtpPassword = '********';
    }
    if (result.integrations?.facebookAppSecret) {
      result.integrations.facebookAppSecret = '********';
    }
    if (result.integrations?.stripeSecretKey) {
      result.integrations.stripeSecretKey = '********';
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Update system settings
export const updateSystemSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, settings } = req.body;

    if (!type || !settings) {
      throw new AppError('Type and settings are required', 400);
    }

    const validTypes = ['general', 'email', 'security', 'integrations'];
    if (!validTypes.includes(type)) {
      throw new AppError(`Invalid settings type. Must be one of: ${validTypes.join(', ')}`, 400);
    }

    // Get existing settings
    const existing = await prisma.systemSettings.findUnique({
      where: { key: type },
    });

    // Merge with existing settings (don't overwrite with empty values for secrets)
    let mergedSettings = { ...settings };
    if (type === 'email' && existing) {
      const existingValue = existing.value as any;
      if (!settings.smtpPassword || settings.smtpPassword === '********') {
        mergedSettings.smtpPassword = existingValue.smtpPassword || '';
      }
    }
    if (type === 'integrations' && existing) {
      const existingValue = existing.value as any;
      if (!settings.facebookAppSecret || settings.facebookAppSecret === '********') {
        mergedSettings.facebookAppSecret = existingValue.facebookAppSecret || '';
      }
      if (!settings.stripeSecretKey || settings.stripeSecretKey === '********') {
        mergedSettings.stripeSecretKey = existingValue.stripeSecretKey || '';
      }
      if (!settings.awsSecretAccessKey || settings.awsSecretAccessKey === '********') {
        mergedSettings.awsSecretAccessKey = existingValue.awsSecretAccessKey || '';
      }
    }

    // Upsert the settings
    const updated = await prisma.systemSettings.upsert({
      where: { key: type },
      update: { value: mergedSettings },
      create: { key: type, value: mergedSettings },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: (req as any).user?.id,
        action: 'SYSTEM_SETTINGS_UPDATE',
        entityType: 'system_settings',
        entityId: type,
        metadata: { settingsType: type },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      success: true,
      message: `${type} settings updated successfully`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// Test email configuration
export const testEmailConfiguration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider, smtpHost, smtpPort, smtpUser, smtpPassword, smtpSecure, fromEmail, fromName } = req.body;

    if (provider === 'smtp') {
      if (!smtpHost || !smtpPort || !smtpUser) {
        throw new AppError('SMTP host, port, and username are required', 400);
      }

      // Get stored password if not provided
      let password = smtpPassword;
      if (!password || password === '********') {
        const stored = await prisma.systemSettings.findUnique({
          where: { key: 'email' },
        });
        if (stored) {
          const storedValue = stored.value as any;
          password = storedValue.smtpPassword;
        }
      }

      // Create test transporter
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure || smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: password,
        },
      });

      // Verify connection
      await transporter.verify();

      // Send test email to admin
      const testTo = (req as any).user?.email || fromEmail;
      await transporter.sendMail({
        from: `"${fromName || 'Dealers Face'}" <${fromEmail}>`,
        to: testTo,
        subject: 'Email Configuration Test - Dealers Face',
        text: 'This is a test email to verify your email server configuration is working correctly.',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">Email Configuration Test</h1>
            <p>This is a test email to verify your email server configuration is working correctly.</p>
            <p style="color: #16a34a; font-weight: bold;">✓ Your email server is configured correctly!</p>
            <hr style="border: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #6b7280; font-size: 12px;">
              Sent from Dealers Face System Settings
            </p>
          </div>
        `,
      });

      res.json({
        success: true,
        message: `Test email sent successfully to ${testTo}`,
      });
    } else {
      throw new AppError(`Email provider '${provider}' test not implemented yet`, 400);
    }
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      throw new AppError('Could not connect to SMTP server. Check host and port.', 400);
    }
    if (error.code === 'EAUTH') {
      throw new AppError('SMTP authentication failed. Check username and password.', 400);
    }
    next(error);
  }
};

// Get subscription plans
export const getSubscriptionPlans = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { displayOrder: 'asc' },
    });

    res.json({
      success: true,
      data: { plans },
    });
  } catch (error) {
    next(error);
  }
};

// Create subscription plan
export const createSubscriptionPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      slug,
      description,
      price,
      interval,
      features,
      vehicleLimit,
      userLimit,
      postLimit,
      isActive,
      isPopular,
    } = req.body;

    if (!name || price === undefined || !interval) {
      throw new AppError('Name, price, and interval are required', 400);
    }

    // Generate slug if not provided
    const finalSlug = slug || name.toLowerCase().replace(/\s+/g, '-');

    // Check if slug exists
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { slug: finalSlug },
    });
    if (existing) {
      throw new AppError('A plan with this slug already exists', 400);
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        slug: finalSlug,
        description: description || null,
        basePrice: price,
        billingInterval: interval === 'year' ? 'yearly' : 'monthly',
        features: features || [],
        maxVehicles: vehicleLimit === -1 ? -1 : (vehicleLimit || 100),
        includedUsers: userLimit === -1 ? -1 : (userLimit || 5),
        maxPosts: postLimit === -1 ? -1 : (postLimit || 500),
        extraUserPrice: 0,
        isActive: isActive !== false,
        isPopular: isPopular === true,
        displayOrder: await prisma.subscriptionPlan.count() + 1,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: (req as any).user?.id,
        action: 'SUBSCRIPTION_PLAN_CREATE',
        entityType: 'subscription_plan',
        entityId: plan.id,
        metadata: { planName: name },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.status(201).json({
      success: true,
      message: 'Subscription plan created successfully',
      data: plan,
    });
  } catch (error) {
    next(error);
  }
};

// Update subscription plan
export const updateSubscriptionPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const planId = req.params.planId as string;
    const {
      name,
      slug,
      description,
      price,
      interval,
      features,
      vehicleLimit,
      userLimit,
      postLimit,
      isActive,
      isPopular,
      sortOrder,
    } = req.body;

    const existing = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!existing) {
      throw new AppError('Subscription plan not found', 404);
    }

    // Check slug uniqueness if changed
    if (slug && slug !== existing.slug) {
      const slugExists = await prisma.subscriptionPlan.findUnique({
        where: { slug },
      });
      if (slugExists) {
        throw new AppError('A plan with this slug already exists', 400);
      }
    }

    const plan = await prisma.subscriptionPlan.update({
      where: { id: planId },
      data: {
        name: name || existing.name,
        slug: slug || existing.slug,
        description: description !== undefined ? description : existing.description,
        basePrice: price !== undefined ? price : existing.basePrice,
        billingInterval: interval ? (interval === 'year' ? 'yearly' : 'monthly') : existing.billingInterval,
        features: features !== undefined ? features : existing.features,
        maxVehicles: vehicleLimit !== undefined ? vehicleLimit : existing.maxVehicles,
        includedUsers: userLimit !== undefined ? userLimit : existing.includedUsers,
        maxPosts: postLimit !== undefined ? postLimit : existing.maxPosts,
        isActive: isActive !== undefined ? isActive : existing.isActive,
        isPopular: isPopular !== undefined ? isPopular : existing.isPopular,
        displayOrder: sortOrder !== undefined ? sortOrder : existing.displayOrder,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: (req as any).user?.id,
        action: 'SUBSCRIPTION_PLAN_UPDATE',
        entityType: 'subscription_plan',
        entityId: plan.id,
        metadata: { planName: plan.name },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      success: true,
      message: 'Subscription plan updated successfully',
      data: plan,
    });
  } catch (error) {
    next(error);
  }
};

// Delete subscription plan
export const deleteSubscriptionPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const planId = req.params.planId as string;

    const existing = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
      include: { accounts: true },
    });

    if (!existing) {
      throw new AppError('Subscription plan not found', 404);
    }

    // Check if any accounts are using this plan
    if (existing.accounts && existing.accounts.length > 0) {
      throw new AppError(`Cannot delete plan. ${existing.accounts.length} account(s) are using this plan.`, 400);
    }

    await prisma.subscriptionPlan.delete({
      where: { id: planId },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: (req as any).user?.id,
        action: 'SUBSCRIPTION_PLAN_DELETE',
        entityType: 'subscription_plan',
        entityId: planId as string,
        metadata: { planName: existing.name },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      success: true,
      message: 'Subscription plan deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Get email templates
export const getEmailTemplates = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await prisma.emailTemplate.findMany({
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: { templates },
    });
  } catch (error) {
    next(error);
  }
};

// Create email template
export const createEmailTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, slug, subject, htmlContent, textContent, variables, description, isActive } = req.body;

    if (!name || !slug || !subject || !htmlContent) {
      throw new AppError('Name, slug, subject, and HTML content are required', 400);
    }

    // Check if slug exists
    const existing = await prisma.emailTemplate.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new AppError('A template with this slug already exists', 400);
    }

    const template = await prisma.emailTemplate.create({
      data: {
        name,
        slug,
        subject,
        htmlContent,
        textContent: textContent || null,
        variables: variables || [],
        description: description || null,
        isActive: isActive !== false,
        isSystem: false,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: (req as any).user?.id,
        action: 'EMAIL_TEMPLATE_CREATE',
        entityType: 'email_template',
        entityId: template.id,
        metadata: { templateName: name },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.status(201).json({
      success: true,
      message: 'Email template created successfully',
      data: template,
    });
  } catch (error) {
    next(error);
  }
};

// Update email template
export const updateEmailTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const templateId = req.params.templateId as string;
    const { name, slug, subject, htmlContent, textContent, variables, description, isActive } = req.body;

    const existing = await prisma.emailTemplate.findUnique({
      where: { id: templateId },
    });

    if (!existing) {
      throw new AppError('Email template not found', 404);
    }

    // Check slug uniqueness if changed
    if (slug && slug !== existing.slug) {
      const slugExists = await prisma.emailTemplate.findUnique({
        where: { slug },
      });
      if (slugExists) {
        throw new AppError('A template with this slug already exists', 400);
      }
    }

    const template = await prisma.emailTemplate.update({
      where: { id: templateId },
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

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: (req as any).user?.id,
        action: 'EMAIL_TEMPLATE_UPDATE',
        entityType: 'email_template',
        entityId: template.id,
        metadata: { templateName: template.name },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      success: true,
      message: 'Email template updated successfully',
      data: template,
    });
  } catch (error) {
    next(error);
  }
};

// Delete email template
export const deleteEmailTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const templateId = req.params.templateId as string;

    const existing = await prisma.emailTemplate.findUnique({
      where: { id: templateId },
    });

    if (!existing) {
      throw new AppError('Email template not found', 404);
    }

    if (existing.isSystem) {
      throw new AppError('System templates cannot be deleted', 400);
    }

    await prisma.emailTemplate.delete({
      where: { id: templateId },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: (req as any).user?.id,
        action: 'EMAIL_TEMPLATE_DELETE',
        entityType: 'email_template',
        entityId: templateId as string,
        metadata: { templateName: existing.name },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      success: true,
      message: 'Email template deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
