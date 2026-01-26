/**
 * Facebook OAuth Routes - RE-ENABLED with OAuth Approval
 * 
 * ✅ OAuth is now approved and enabled alongside session-based authentication.
 * 
 * This provides multiple authentication options:
 * 1. OAuth (primary) - For users with approved Facebook App
 * 2. Session cookies (fallback) - For Marketplace automation
 * 3. TOTP 2FA (recovery) - For session restoration
 * 
 * All methods work together for maximum reliability.
 */

import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import prisma from '@/config/database';
import axios from 'axios';
import jwt from 'jsonwebtoken';

const router = Router();

/**
 * GET /api/auth/facebook/config
 * Returns Facebook OAuth configuration for the extension
 */
router.get('/config', (_req: Request, res: Response) => {
  const appId = process.env.FACEBOOK_EXTENSION_APP_ID || process.env.FACEBOOK_APP_ID || '';
  logger.info('Facebook config requested', { hasAppId: !!appId });
  
  res.json({
    success: true,
    appId,
    scope: 'email,public_profile',
    version: 'v18.0',
    available: !!appId,
    // Also provide info about backup auth methods
    authMethods: {
      oauth: !!appId,
      sessionCapture: true,
      totp2FA: true,
    },
  });
});

/**
 * POST /api/auth/facebook/callback
 * Handle OAuth callback from extension - exchange code for tokens
 */
router.post('/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, redirectUri } = req.body;
    
    if (!code) {
      logger.warn('OAuth callback missing code');
      res.status(400).json({ 
        success: false, 
        error: 'Missing authorization code' 
      });      return;    }

    logger.info('Processing OAuth callback from extension');

    // Use extension app credentials if available
    const appId = process.env.FACEBOOK_EXTENSION_APP_ID || process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_EXTENSION_APP_SECRET || process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      logger.error('Facebook app credentials not configured');
      res.status(500).json({ 
        success: false, 
        error: 'Facebook app not configured' 
      });
      return;
    }

    // Exchange code for access token
    const tokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      },
    });

    const { access_token: accessToken, expires_in } = tokenResponse.data;
    logger.info('Facebook access token obtained');

    // Get user info from Facebook
    const userResponse = await axios.get('https://graph.facebook.com/v18.0/me', {
      params: {
        access_token: accessToken,
        fields: 'id,name,email,picture',
      },
    });

    const fbUser = userResponse.data;
    logger.info(`Facebook user info retrieved: ${fbUser.name} (${fbUser.id})`);

    // Check if user exists by email
    let user = await prisma.user.findFirst({
      where: { email: fbUser.email || `fb_${fbUser.id}@facebook.local` },
    });

    // Create user if doesn't exist
    if (!user) {
      const [firstName, ...lastNameParts] = (fbUser.name || 'Facebook User').split(' ');
      user = await prisma.user.create({
        data: {
          email: fbUser.email || `fb_${fbUser.id}@facebook.local`,
          firstName,
          lastName: lastNameParts.join(' ') || null,
          emailVerified: !!fbUser.email,
          loginMethod: 'facebook',
        },
      });
      logger.info(`New user created from Facebook: ${user.id}`);
    }

    // Get or create dealer account for user
    let accountUser = await prisma.accountUser.findFirst({
      where: { userId: user.id },
      include: { account: true },
    });

    if (!accountUser) {
      // Create a new account for this user
      const account = await prisma.account.create({
        data: {
          name: `${fbUser.name}'s Dealership`,
        },
      });
      accountUser = await prisma.accountUser.create({
        data: {
          userId: user.id,
          accountId: account.id,
          role: 'ADMIN',
        },
        include: { account: true },
      });
      logger.info(`New dealer account created: ${account.id}`);
    }

    // Store Facebook profile/connection
    const tokenExpiry = new Date(Date.now() + (expires_in || 3600) * 1000);
    
    await prisma.facebookProfile.upsert({
      where: {
        accountId_pageId: {
          accountId: accountUser.accountId,
          pageId: fbUser.id,
        },
      },
      create: {
        facebookUserId: fbUser.id,
        facebookUserName: fbUser.name,
        accountId: accountUser.accountId,
        userId: user.id,
        pageId: fbUser.id,
        pageName: fbUser.name || 'Personal Profile',
        accessToken,
        tokenExpiresAt: tokenExpiry,
        category: 'PERSONAL',
      },
      update: {
        facebookUserName: fbUser.name,
        accessToken,
        tokenExpiresAt: tokenExpiry,
      },
    });

    // Generate server JWT token for API calls
    const serverToken = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        accountIds: [accountUser.accountId],
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '30d' }
    );

    logger.info(`OAuth login successful for user ${user.id}`);

    res.json({
      success: true,
      accessToken, // Facebook access token
      serverToken, // JWT for our API
      refreshToken,
      tokenExpiry: tokenExpiry.toISOString(),
      user: {
        id: user.id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || fbUser.name,
        email: user.email,
        avatar: fbUser.picture?.data?.url,
      },
      dealerAccount: {
        id: accountUser.accountId,
        name: accountUser.account.name,
      },
    });

  } catch (error: any) {
    logger.error('OAuth callback error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message || 'OAuth authentication failed',
    });
  }
});

/**
 * POST /api/auth/facebook/refresh
 * Refresh Facebook access token (for long-lived tokens)
 */
router.post('/refresh', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { accessToken: currentToken } = req.body;
    
    if (!currentToken) {
      res.status(400).json({ 
        success: false, 
        error: 'Current access token required' 
      });      return;    }

    const appId = process.env.FACEBOOK_EXTENSION_APP_ID || process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_EXTENSION_APP_SECRET || process.env.FACEBOOK_APP_SECRET;

    // Exchange for long-lived token
    const response = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: currentToken,
      },
    });

    const { access_token: newToken, expires_in } = response.data;
    const tokenExpiry = new Date(Date.now() + (expires_in || 5184000) * 1000); // Default 60 days

    // Update stored token
    const accountIds = req.user!.accountIds || [];
    const accountId = accountIds[0] || (await prisma.accountUser.findFirst({
      where: { userId: req.user!.id },
      select: { accountId: true },
    }))?.accountId;

    if (accountId) {
      await prisma.facebookProfile.updateMany({
        where: { 
          accountId,
          userId: req.user!.id,
        },
        data: {
          accessToken: newToken,
          tokenExpiresAt: tokenExpiry,
        },
      });
    }

    logger.info(`Facebook token refreshed for user ${req.user!.id}`);

    res.json({
      success: true,
      accessToken: newToken,
      tokenExpiry: tokenExpiry.toISOString(),
    });

  } catch (error: any) {
    logger.error('Token refresh error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || 'Token refresh failed',
    });
  }
});

/**
 * POST /api/auth/facebook/disconnect
 * Disconnect Facebook account
 */
router.post('/disconnect', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { accountId } = req.body;
    
    const accountIds = req.user!.accountIds || [];
    const targetAccountId = accountId || accountIds[0] || (await prisma.accountUser.findFirst({
      where: { userId: req.user!.id },
      select: { accountId: true },
    }))?.accountId;

    if (!targetAccountId) {
      res.status(400).json({ 
        success: false, 
        error: 'No account found' 
      });      return;    }

    // Delete Facebook profiles for this account
    const deleted = await prisma.facebookProfile.deleteMany({
      where: {
        accountId: targetAccountId,
        userId: req.user!.id,
      },
    });

    logger.info(`Facebook disconnected: ${deleted.count} profiles removed for user ${req.user!.id}`);

    res.json({
      success: true,
      message: `Disconnected ${deleted.count} Facebook profile(s)`,
    });

  } catch (error: any) {
    logger.error('Disconnect error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to disconnect Facebook',
    });
  }
});

export default router;
