/**
 * Facebook OAuth Routes
 * 
 * Handles Facebook OAuth for both web app and Chrome extension.
 * Extension uses POST /callback, web app uses GET redirect flow.
 */

import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import axios from 'axios';
import prisma from '../config/database';
import jwt from 'jsonwebtoken';

const router = Router();

/**
 * GET /api/auth/facebook/config
 * Get Facebook OAuth configuration (safe to expose)
 */
router.get('/config', (_req: Request, res: Response) => {
  res.json({
    appId: process.env.FACEBOOK_APP_ID || '',
    scope: 'email,public_profile',
    version: 'v18.0',
    available: true,
  });
});

/**
 * POST /api/auth/facebook/callback
 * Handle Facebook OAuth callback from Chrome extension
 * Extension sends authorization code, we exchange it for token
 */
router.post('/callback', async (req: Request, res: Response) => {
  try {
    const { code, redirectUri } = req.body;
    
    if (!code) {
      res.status(400).json({
        success: false,
        error: 'Authorization code is required',
      });
      return;
    }
    
    logger.info('Extension OAuth callback received');
    
    // Use extension-specific credentials if redirect is from Chrome extension
    const isExtensionCallback = redirectUri?.includes('chromiumapp.org');
    const appId = isExtensionCallback 
      ? (process.env.FACEBOOK_EXTENSION_APP_ID || process.env.FACEBOOK_APP_ID)
      : process.env.FACEBOOK_APP_ID;
    const appSecret = isExtensionCallback 
      ? (process.env.FACEBOOK_EXTENSION_APP_SECRET || process.env.FACEBOOK_APP_SECRET)
      : process.env.FACEBOOK_APP_SECRET;
    
    logger.info(`Using ${isExtensionCallback ? 'extension' : 'web'} Facebook credentials for callback`);
    logger.info(`App ID: ${appId?.substring(0, 8)}...`);
    logger.info(`Redirect URI: ${redirectUri}`);
    
    // Exchange code for access token with Facebook
    let tokenResponse;
    try {
      tokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
        params: {
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          code,
        },
      });
    } catch (fbError: unknown) {
      const err = fbError as { response?: { data?: unknown; status?: number }; message?: string };
      logger.error('Facebook token exchange failed:', JSON.stringify({
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      }));
      throw fbError;
    }
    
    const { access_token: accessToken, expires_in: expiresIn } = tokenResponse.data;
    
    // Get user info from Facebook
    const userResponse = await axios.get('https://graph.facebook.com/v18.0/me', {
      params: {
        access_token: accessToken,
        fields: 'id,name,email',
      },
    });
    
    const fbUser = userResponse.data;
    logger.info(`Facebook user retrieved: ${fbUser.name} (${fbUser.id})`);
    
    // Find existing user by email or look up by FacebookProfile
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: fbUser.email },
          {
            facebookProfiles: {
              some: {
                facebookUserId: fbUser.id,
              },
            },
          },
        ],
      },
      include: {
        accountUsers: {
          include: {
            account: true,
          },
        },
        facebookProfiles: true,
      },
    });
    
    if (!user) {
      // Create new user with Facebook login
      const nameParts = (fbUser.name || 'Facebook User').split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || 'User';
      
      user = await prisma.user.create({
        data: {
          email: fbUser.email || `fb_${fbUser.id}@facebook.local`,
          firstName,
          lastName,
        },
        include: {
          accountUsers: {
            include: {
              account: true,
            },
          },
          facebookProfiles: true,
        },
      });
      
      logger.info(`New user created from Facebook: ${user.id}`);
    }
    
    // Get or create the user's dealer account
    let dealerAccount = user.accountUsers[0]?.account;
    
    if (!dealerAccount) {
      // Create a default account for this user
      dealerAccount = await prisma.account.create({
        data: {
          name: `${fbUser.name}'s Dealership`,
          accountUsers: {
            create: {
              userId: user.id,
              role: 'ADMIN',
            },
          },
        },
      });
      logger.info(`Default account created for user: ${dealerAccount.id}`);
    }
    
    // Create or update FacebookProfile to store the OAuth token
    const tokenExpiry = new Date(Date.now() + (expiresIn || 3600) * 1000);
    
    await prisma.facebookProfile.upsert({
      where: {
        accountId_pageId: {
          accountId: dealerAccount.id,
          pageId: fbUser.id, // Using FB user ID as page ID for personal account
        },
      },
      update: {
        accessToken,
        tokenExpiresAt: tokenExpiry,
        facebookUserName: fbUser.name,
        isActive: true,
      },
      create: {
        accountId: dealerAccount.id,
        userId: user.id,
        pageId: fbUser.id,
        pageName: fbUser.name || 'Personal Account',
        facebookUserId: fbUser.id,
        facebookUserName: fbUser.name,
        accessToken,
        tokenExpiresAt: tokenExpiry,
        category: 'Personal',
      },
    });
    
    // Generate JWT token for API auth
    const serverToken = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
      },
      process.env.JWT_SECRET || 'fallback-secret-for-dev',
      { expiresIn: '7d' }
    );
    
    logger.info(`Extension OAuth successful for user ${user.id}`);
    
    res.json({
      success: true,
      accessToken,
      expiresIn: expiresIn || 3600,
      serverToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        facebookId: fbUser.id,
      },
      dealerAccount: {
        id: dealerAccount.id,
        name: dealerAccount.name,
      },
    });
  } catch (error: unknown) {
    const err = error as { response?: { data?: { error?: { message?: string } }; status?: number }; message?: string };
    const errorDetails = {
      message: err.message,
      responseData: err.response?.data,
      responseStatus: err.response?.status,
    };
    logger.error('Extension OAuth error:', JSON.stringify(errorDetails, null, 2));
    res.status(500).json({
      success: false,
      error: err.response?.data?.error?.message || err.message || 'Failed to complete Facebook authentication',
      details: process.env.NODE_ENV !== 'production' ? errorDetails : undefined,
    });
  }
});

/**
 * POST /api/auth/facebook/refresh
 * Refresh Facebook access token
 * TODO: Implement token refresh when needed
 */
router.post('/refresh', (_req: Request, res: Response) => {
  res.status(501).json({
    success: false,
    error: 'Token refresh not yet implemented',
  });
});

/**
 * POST /api/auth/facebook/disconnect
 * Disconnect Facebook from user account
 */
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const { userId, profileId } = req.body;
    
    if (!userId && !profileId) {
      res.status(400).json({
        success: false,
        error: 'userId or profileId is required',
      });
      return;
    }
    
    // Delete Facebook profiles
    if (profileId) {
      await prisma.facebookProfile.delete({
        where: { id: profileId },
      });
      logger.info(`Facebook profile disconnected: ${profileId}`);
    } else if (userId) {
      // Delete all profiles for this user
      await prisma.facebookProfile.deleteMany({
        where: { userId },
      });
      logger.info(`All Facebook profiles disconnected for user: ${userId}`);
    }
    
    res.json({
      success: true,
      message: 'Facebook account disconnected successfully',
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    logger.error('Disconnect error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to disconnect Facebook account',
    });
  }
});

export default router;
