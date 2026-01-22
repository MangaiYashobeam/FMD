import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
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
// ============================================
// Facebook Configuration (SUPER_ADMIN)
// ============================================

// Input sanitization helper
function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .slice(0, 500); // Limit length
}

// Validate Facebook App ID format (numeric string, typically 15-16 digits)
function isValidFacebookAppId(appId: string): boolean {
  return /^\d{10,20}$/.test(appId);
}

// Get Facebook configuration (public - for extension)
export const getPublicFacebookConfig = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { key: 'integrations' },
    });

    const integrations = settings?.value as any || {};
    
    // Only return public, non-sensitive values
    // For extension, prefer FACEBOOK_EXTENSION_APP_ID if set
    const appId = integrations.facebookExtensionAppId || 
                  process.env.FACEBOOK_EXTENSION_APP_ID || 
                  integrations.facebookAppId || 
                  process.env.FACEBOOK_APP_ID || '';
    
    res.json({
      success: true,
      data: {
        appId,
        scope: 'email,public_profile',
        version: 'v18.0',
        configured: !!appId,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get full Facebook configuration (SUPER_ADMIN only)
export const getFacebookConfig = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { key: 'integrations' },
    });

    const integrations = settings?.value as any || {};

    // Get global Facebook stats
    const [totalProfiles, activeProfiles, totalPosts, recentPosts] = await Promise.all([
      prisma.facebookProfile.count(),
      prisma.facebookProfile.count({ where: { isActive: true } }),
      prisma.facebookPost.count(),
      prisma.facebookPost.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    // Get accounts with Facebook connected
    const accountsWithFacebook = await prisma.account.findMany({
      where: {
        facebookProfiles: { some: { isActive: true } },
      },
      select: {
        id: true,
        name: true,
        facebookProfiles: {
          where: { isActive: true },
          select: {
            id: true,
            pageName: true,
            facebookUserId: true,
            isActive: true,
            tokenExpiresAt: true,
            lastSyncAt: true,
          },
        },
      },
      take: 50,
    });

    // Check for expiring tokens (within 7 days)
    const expiringTokens = await prisma.facebookProfile.count({
      where: {
        isActive: true,
        tokenExpiresAt: {
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          gte: new Date(),
        },
      },
    });

    res.json({
      success: true,
      data: {
        config: {
          appId: integrations.facebookAppId || process.env.FACEBOOK_APP_ID || '',
          appSecret: integrations.facebookAppSecret ? '********' : '',
          hasSecret: !!(integrations.facebookAppSecret || process.env.FACEBOOK_APP_SECRET),
          configured: !!(integrations.facebookAppId || process.env.FACEBOOK_APP_ID),
          oauthRedirectUri: process.env.FACEBOOK_REDIRECT_URI || `${process.env.API_URL || process.env.FRONTEND_URL || 'https://dealersface.com'}/api/facebook/callback`,
          extensionRedirectPattern: 'https://*.chromiumapp.org/*',
        },
        stats: {
          totalProfiles,
          activeProfiles,
          totalPosts,
          recentPosts,
          expiringTokens,
          accountsWithFacebook: accountsWithFacebook.length,
        },
        accounts: accountsWithFacebook.map(acc => ({
          id: acc.id,
          name: acc.name,
          profiles: acc.facebookProfiles.map(p => ({
            id: p.id,
            pageName: p.pageName,
            facebookUserId: p.facebookUserId,
            isActive: p.isActive,
            tokenExpiring: p.tokenExpiresAt ? new Date(p.tokenExpiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : false,
            lastSync: p.lastSyncAt,
          })),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update Facebook configuration (SUPER_ADMIN only)
export const updateFacebookConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { appId, appSecret } = req.body;

    // Sanitize inputs
    const sanitizedAppId = sanitizeInput(appId);
    
    // Validate App ID format
    if (sanitizedAppId && !isValidFacebookAppId(sanitizedAppId)) {
      throw new AppError('Invalid Facebook App ID format. Must be 10-20 digits.', 400);
    }

    // Get existing settings
    const existing = await prisma.systemSettings.findUnique({
      where: { key: 'integrations' },
    });

    const currentIntegrations = existing?.value as any || {};

    // Build updated settings
    const updatedIntegrations = {
      ...currentIntegrations,
      facebookAppId: sanitizedAppId || currentIntegrations.facebookAppId || '',
    };

    // Only update secret if provided and not masked
    if (appSecret && appSecret !== '********') {
      // Validate secret format (typically 32 hex characters)
      const sanitizedSecret = sanitizeInput(appSecret);
      if (sanitizedSecret.length < 20 || sanitizedSecret.length > 64) {
        throw new AppError('Invalid Facebook App Secret format', 400);
      }
      updatedIntegrations.facebookAppSecret = sanitizedSecret;
    }

    // Upsert settings
    await prisma.systemSettings.upsert({
      where: { key: 'integrations' },
      update: { value: updatedIntegrations },
      create: { key: 'integrations', value: updatedIntegrations },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: (req as any).user?.id,
        action: 'FACEBOOK_CONFIG_UPDATE',
        entityType: 'system_settings',
        entityId: 'integrations',
        metadata: { 
          appIdUpdated: !!sanitizedAppId,
          secretUpdated: !!(appSecret && appSecret !== '********'),
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      success: true,
      message: 'Facebook configuration updated successfully',
      data: {
        appId: updatedIntegrations.facebookAppId,
        hasSecret: !!updatedIntegrations.facebookAppSecret,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Test Facebook configuration
export const testFacebookConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { key: 'integrations' },
    });

    const integrations = settings?.value as any || {};
    const appId = integrations.facebookAppId || process.env.FACEBOOK_APP_ID;
    const appSecret = integrations.facebookAppSecret || process.env.FACEBOOK_APP_SECRET;

    if (!appId) {
      throw new AppError('Facebook App ID not configured', 400);
    }

    if (!appSecret) {
      throw new AppError('Facebook App Secret not configured', 400);
    }

    // Test by getting an app access token
    const axios = (await import('axios')).default;
    const response = await axios.get('https://graph.facebook.com/oauth/access_token', {
      params: {
        client_id: appId,
        client_secret: appSecret,
        grant_type: 'client_credentials',
      },
    });

    if (response.data.access_token) {
      // Log success
      await prisma.auditLog.create({
        data: {
          userId: (req as any).user?.id,
          action: 'FACEBOOK_CONFIG_TEST_SUCCESS',
          entityType: 'system_settings',
          entityId: 'integrations',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });

      res.json({
        success: true,
        message: 'Facebook configuration is valid',
        data: {
          appId,
          tokenType: response.data.token_type,
        },
      });
    } else {
      throw new AppError('Could not obtain app access token', 400);
    }
  } catch (error: any) {
    // Log failure
    await prisma.auditLog.create({
      data: {
        userId: (req as any).user?.id,
        action: 'FACEBOOK_CONFIG_TEST_FAILED',
        entityType: 'system_settings',
        entityId: 'integrations',
        metadata: { error: error.message },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    if (error.response?.data?.error) {
      const fbError = error.response.data.error;
      throw new AppError(`Facebook API Error: ${fbError.message || fbError.type}`, 400);
    }
    next(error);
  }
};

// Revoke Facebook profile access
export const revokeFacebookProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profileId = req.params.profileId as string;

    if (!profileId) {
      throw new AppError('Profile ID is required', 400);
    }

    const profile = await prisma.facebookProfile.findUnique({
      where: { id: profileId },
      include: { account: true },
    });

    if (!profile) {
      throw new AppError('Facebook profile not found', 404);
    }

    // Deactivate the profile
    await prisma.facebookProfile.update({
      where: { id: profileId },
      data: { isActive: false },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: (req as any).user?.id,
        action: 'FACEBOOK_PROFILE_REVOKED',
        entityType: 'facebook_profile',
        entityId: profileId,
        metadata: { 
          accountId: profile.accountId,
          accountName: profile.account?.name,
          pageName: profile.pageName,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      success: true,
      message: `Facebook profile "${profile.pageName}" has been revoked`,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Extension Configuration (SUPER_ADMIN only)
// ============================================

// Get Extension configuration
export const getExtensionConfig = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { key: 'integrations' },
    });

    const integrations = settings?.value as any || {};

    // Get extension usage stats from audit logs
    const [totalSessions, activeSessions, totalPosts, recentPosts] = await Promise.all([
      // Count unique extension sessions (from audit logs with extension source)
      prisma.auditLog.count({
        where: { action: { contains: 'extension' } },
      }),
      // Active sessions in last 24 hours
      prisma.auditLog.count({
        where: {
          action: { contains: 'extension' },
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      // Total posts (all sources as proxy)
      prisma.facebookPost.count(),
      // Recent posts
      prisma.facebookPost.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    // Get extension Facebook App ID (separate from web app)
    const extensionAppId = integrations.extensionFacebookAppId || 
                          process.env.FACEBOOK_EXTENSION_APP_ID || 
                          '';
    const extensionAppSecret = integrations.extensionFacebookAppSecret || 
                              process.env.FACEBOOK_EXTENSION_APP_SECRET || 
                              '';
    const extensionId = integrations.chromeExtensionId || 
                        process.env.EXTENSION_ID || 
                        '';

    res.json({
      success: true,
      data: {
        config: {
          extensionId: extensionId,
          facebookAppId: extensionAppId,
          facebookAppSecret: extensionAppSecret ? '********' : '',
          hasSecret: !!extensionAppSecret,
          configured: !!(extensionAppId && extensionId),
          apiUrl: process.env.API_URL || 'https://dealersface.com',
          oauthRedirectPattern: 'https://*.chromiumapp.org/*',
          chromeWebStoreUrl: extensionId 
            ? `https://chrome.google.com/webstore/detail/${extensionId}`
            : null,
        },
        status: {
          extensionId: extensionId ? 'configured' : 'not-configured',
          facebookAppId: extensionAppId ? 'configured' : 'not-configured',
          facebookAppSecret: extensionAppSecret ? 'configured' : 'not-configured',
          oauthReady: !!(extensionAppId && extensionAppSecret),
        },
        stats: {
          totalSessions,
          activeSessions,
          totalPosts,
          recentPosts,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update Extension configuration
export const updateExtensionConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { extensionId, facebookAppId, facebookAppSecret } = req.body;

    // Get existing settings
    const existing = await prisma.systemSettings.findUnique({
      where: { key: 'integrations' },
    });

    const currentIntegrations = existing?.value as any || {};

    // Build updated settings
    const updatedIntegrations = {
      ...currentIntegrations,
    };

    // Update extension ID if provided
    if (extensionId !== undefined) {
      const sanitizedExtId = sanitizeInput(extensionId);
      if (sanitizedExtId && (sanitizedExtId.length < 20 || sanitizedExtId.length > 40)) {
        throw new AppError('Invalid Chrome Extension ID format', 400);
      }
      updatedIntegrations.chromeExtensionId = sanitizedExtId || '';
    }

    // Update Facebook App ID if provided
    if (facebookAppId !== undefined) {
      const sanitizedAppId = sanitizeInput(facebookAppId);
      if (sanitizedAppId && !isValidFacebookAppId(sanitizedAppId)) {
        throw new AppError('Invalid Facebook App ID format. Must be 10-20 digits.', 400);
      }
      updatedIntegrations.extensionFacebookAppId = sanitizedAppId || '';
    }

    // Only update secret if provided and not masked
    if (facebookAppSecret && facebookAppSecret !== '********') {
      const sanitizedSecret = sanitizeInput(facebookAppSecret);
      if (sanitizedSecret.length < 20 || sanitizedSecret.length > 64) {
        throw new AppError('Invalid Facebook App Secret format', 400);
      }
      updatedIntegrations.extensionFacebookAppSecret = sanitizedSecret;
    }

    // Upsert settings
    await prisma.systemSettings.upsert({
      where: { key: 'integrations' },
      update: { value: updatedIntegrations },
      create: { key: 'integrations', value: updatedIntegrations },
    });

    logger.info('Extension configuration updated by super admin');

    res.json({
      success: true,
      message: 'Extension configuration updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Test Extension configuration
export const testExtensionConfig = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { key: 'integrations' },
    });

    const integrations = settings?.value as any || {};

    const extensionAppId = integrations.extensionFacebookAppId || 
                          process.env.FACEBOOK_EXTENSION_APP_ID || '';
    const extensionAppSecret = integrations.extensionFacebookAppSecret || 
                              process.env.FACEBOOK_EXTENSION_APP_SECRET || '';
    const extensionId = integrations.chromeExtensionId || 
                        process.env.EXTENSION_ID || '';

    if (!extensionAppId || !extensionAppSecret) {
      throw new AppError('Extension Facebook App credentials not configured', 400);
    }

    if (!extensionId) {
      throw new AppError('Chrome Extension ID not configured', 400);
    }

    // Test Facebook credentials by getting app access token
    const response = await fetch(
      `https://graph.facebook.com/oauth/access_token?client_id=${extensionAppId}&client_secret=${extensionAppSecret}&grant_type=client_credentials`
    );

    const data = await response.json() as { 
      error?: { message: string }; 
      access_token?: string; 
      token_type?: string;
    };

    if (data.error) {
      throw new AppError(`Facebook API Error: ${data.error.message}`, 400);
    }

    if (!data.access_token) {
      throw new AppError('Failed to get app access token from Facebook', 400);
    }

    res.json({
      success: true,
      message: 'Extension configuration is valid! Facebook credentials verified.',
      data: {
        extensionIdConfigured: !!extensionId,
        facebookCredentialsValid: true,
        tokenType: data.token_type || 'bearer',
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get all Facebook profiles (SUPER_ADMIN dashboard)
export const getAllFacebookProfiles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, search, limit = 50, offset = 0 } = req.query;

    const where: any = {};
    
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    } else if (status === 'expiring') {
      where.isActive = true;
      where.tokenExpiresAt = {
        lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        gte: new Date(),
      };
    }

    if (search) {
      const searchTerm = sanitizeInput(search as string);
      where.OR = [
        { pageName: { contains: searchTerm, mode: 'insensitive' } },
        { facebookUserName: { contains: searchTerm, mode: 'insensitive' } },
        { account: { name: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    const [profiles, total] = await Promise.all([
      prisma.facebookProfile.findMany({
        where,
        include: {
          account: { select: { id: true, name: true } },
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          _count: { select: { posts: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Number(limit), 100),
        skip: Number(offset),
      }),
      prisma.facebookProfile.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        profiles: profiles.map(p => ({
          id: p.id,
          pageName: p.pageName,
          pageId: p.pageId,
          facebookUserId: p.facebookUserId,
          facebookUserName: p.facebookUserName,
          category: p.category,
          isActive: p.isActive,
          tokenExpiresAt: p.tokenExpiresAt,
          tokenExpiring: p.tokenExpiresAt ? new Date(p.tokenExpiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : false,
          lastSyncAt: p.lastSyncAt,
          postCount: p._count.posts,
          account: p.account,
          user: p.user,
          createdAt: p.createdAt,
        })),
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + profiles.length < total,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Error Monitoring for Nova Super Admin
// ============================================

/**
 * Get all system errors for Nova diagnostics
 */
export const getSystemErrors = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { severity, source } = req.query;
    const limitParam = req.query.limit;
    const offsetParam = req.query.offset;
    const limit = typeof limitParam === 'string' ? parseInt(limitParam, 10) : 100;
    const offset = typeof offsetParam === 'string' ? parseInt(offsetParam, 10) : 0;

    // Build where clause
    const where: any = {
      action: { in: ['EXTENSION_ERROR', 'API_ERROR', 'SYSTEM_ERROR', 'AUTH_ERROR'] },
    };

    // Filter by severity if provided
    if (severity && typeof severity === 'string') {
      where.metadata = {
        path: ['severity'],
        equals: severity,
      };
    }

    // Filter by source (extension, api, system)
    if (source && typeof source === 'string') {
      where.entityType = source;
    }

    // Get errors from audit log
    const [errors, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 500),
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Parse errors into diagnostic format
    const diagnosticErrors = errors.map(err => {
      const metadata = (err.metadata as any) || {};
      return {
        id: err.id,
        type: err.action,
        source: err.entityType,
        accountId: err.entityId,
        severity: metadata.severity || 'medium',
        error: metadata.error || 'Unknown error',
        context: {
          url: metadata.url,
          stackTrace: metadata.stackTrace,
          userAgent: metadata.userAgent,
        },
        userStruggle: metadata.userStruggle,
        user: err.user,
        timestamp: err.createdAt,
        isResolved: metadata.resolved || false,
        resolution: metadata.resolution,
      };
    });

    res.json({
      success: true,
      data: {
        errors: diagnosticErrors,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + errors.length < total,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get error statistics for Nova dashboard
 */
export const getErrorStats = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const errorActions = ['EXTENSION_ERROR', 'API_ERROR', 'SYSTEM_ERROR', 'AUTH_ERROR'];

    // Get counts by time period
    const [last24h, lastWeek, lastMonth, totalErrors] = await Promise.all([
      prisma.auditLog.count({
        where: {
          action: { in: errorActions },
          createdAt: { gte: oneDayAgo },
        },
      }),
      prisma.auditLog.count({
        where: {
          action: { in: errorActions },
          createdAt: { gte: oneWeekAgo },
        },
      }),
      prisma.auditLog.count({
        where: {
          action: { in: errorActions },
          createdAt: { gte: oneMonthAgo },
        },
      }),
      prisma.auditLog.count({
        where: { action: { in: errorActions } },
      }),
    ]);

    // Get errors by type for last 24h
    const recentErrors = await prisma.auditLog.findMany({
      where: {
        action: { in: errorActions },
        createdAt: { gte: oneDayAgo },
      },
      select: { action: true, entityType: true, metadata: true },
    });

    // Aggregate by severity
    const severityCounts = { high: 0, medium: 0, low: 0 };
    const sourceCounts: Record<string, number> = {};

    for (const err of recentErrors) {
      const metadata = (err.metadata as any) || {};
      const severity = metadata.severity || 'medium';
      severityCounts[severity as keyof typeof severityCounts]++;

      const source = err.entityType || 'unknown';
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    }

    // Get top error messages
    const errorMessages: Record<string, number> = {};
    for (const err of recentErrors) {
      const metadata = (err.metadata as any) || {};
      const message = (metadata.error || 'Unknown error').substring(0, 100);
      errorMessages[message] = (errorMessages[message] || 0) + 1;
    }

    const topErrors = Object.entries(errorMessages)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([message, count]) => ({ message, count }));

    res.json({
      success: true,
      data: {
        summary: {
          last24h,
          lastWeek,
          lastMonth,
          total: totalErrors,
        },
        bySeverity: severityCounts,
        bySource: sourceCounts,
        topErrors,
        healthStatus: last24h > 100 ? 'critical' : last24h > 50 ? 'warning' : 'healthy',
        alertThreshold: {
          critical: 100,
          warning: 50,
          current: last24h,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get extension-specific errors for diagnostics
 */
export const getExtensionErrors = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limitParam = req.query.limit;
    const offsetParam = req.query.offset;
    const limit = typeof limitParam === 'string' ? parseInt(limitParam, 10) : 50;
    const offset = typeof offsetParam === 'string' ? parseInt(offsetParam, 10) : 0;

    const [errors, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          action: 'EXTENSION_ERROR',
        },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      prisma.auditLog.count({
        where: { action: 'EXTENSION_ERROR' },
      }),
    ]);

    // Analyze extension errors for patterns
    const patterns: Record<string, { count: number; suggestions: string[] }> = {};
    
    for (const err of errors) {
      const metadata = (err.metadata as any) || {};
      const errorText = metadata.error || '';
      
      // Classify error patterns
      if (errorText.includes('element not found') || errorText.includes('selector')) {
        if (!patterns['selector_issues']) {
          patterns['selector_issues'] = {
            count: 0,
            suggestions: [
              'Facebook may have updated their UI - check for selector changes',
              'Consider using more resilient selector strategies (aria-labels, roles)',
              'Add fallback selectors for common elements',
            ],
          };
        }
        patterns['selector_issues'].count++;
      }
      
      if (errorText.includes('timeout') || errorText.includes('took too long')) {
        if (!patterns['timeout_issues']) {
          patterns['timeout_issues'] = {
            count: 0,
            suggestions: [
              'Facebook may be slow - consider increasing timeout',
              'Network issues on user side',
              'Heavy page load - wait for complete render',
            ],
          };
        }
        patterns['timeout_issues'].count++;
      }
      
      if (errorText.includes('auth') || errorText.includes('token') || errorText.includes('403')) {
        if (!patterns['auth_issues']) {
          patterns['auth_issues'] = {
            count: 0,
            suggestions: [
              'User needs to re-authenticate',
              'Token may have expired',
              'Check if user is still logged into Facebook',
            ],
          };
        }
        patterns['auth_issues'].count++;
      }
    }

    res.json({
      success: true,
      data: {
        errors: errors.map(err => {
          const metadata = (err.metadata as any) || {};
          return {
            id: err.id,
            error: metadata.error,
            url: metadata.url,
            severity: metadata.severity || 'medium',
            context: metadata.context,
            userStruggle: metadata.userStruggle,
            user: err.user,
            timestamp: err.createdAt,
          };
        }),
        patterns,
        pagination: {
          total,
          limit,
          offset,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resolve an error with diagnostic notes
 */
export const resolveError = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { errorId } = req.params;
    const resolutionRaw = req.body.resolution;
    const preventionPlanRaw = req.body.preventionPlan;
    const resolution = typeof resolutionRaw === 'string' ? resolutionRaw : undefined;
    const preventionPlan = typeof preventionPlanRaw === 'string' ? preventionPlanRaw : undefined;

    const error = await prisma.auditLog.findUnique({
      where: { id: errorId },
    });

    if (!error) {
      throw new AppError('Error not found', 404);
    }

    // Update metadata with resolution
    const currentMetadata = (error.metadata as any) || {};
    await prisma.auditLog.update({
      where: { id: errorId },
      data: {
        metadata: {
          ...currentMetadata,
          resolved: true,
          resolvedAt: new Date().toISOString(),
          resolution,
          preventionPlan,
        },
      },
    });

    logger.info(`Error ${errorId} resolved`, { resolution, preventionPlan });

    res.json({
      success: true,
      message: 'Error marked as resolved',
    });
  } catch (error) {
    next(error);
  }
};