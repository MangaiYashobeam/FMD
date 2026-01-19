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
    
    // Exchange code for access token with Facebook
    const tokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        redirect_uri: redirectUri,
        code,
      },
    });
    
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
    const err = error as { response?: { data?: unknown }; message?: string };
    logger.error('Extension OAuth error:', err.response?.data || err.message);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to complete Facebook authentication',
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
 * TODO: Implement when needed
 */
router.post('/disconnect', (_req: Request, res: Response) => {
  res.status(501).json({
    success: false,
    error: 'Disconnect not yet implemented',
  });
});

export default router;
