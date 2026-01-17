/**
 * Facebook OAuth Routes
 * 
 * Handles Facebook OAuth authentication flow for the Chrome Extension
 */

import { Router, Request, Response } from 'express';
import { FACEBOOK_CONFIG } from '../config/facebook';
import prisma from '@/config/database';
import jwt from 'jsonwebtoken';

const router = Router();

// Facebook API response types
interface FacebookTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

interface FacebookUserResponse {
  id?: string;
  name?: string;
  email?: string;
  picture?: {
    data?: {
      url?: string;
    };
  };
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

// ============================================
// OAuth Callback
// ============================================

/**
 * POST /api/auth/facebook/callback
 * Exchange authorization code for access token
 */
router.post('/callback', async (req: Request, res: Response) => {
  try {
    const { code, redirectUri } = req.body;
    
    if (!code) {
      res.status(400).json({ error: 'Authorization code required' });
      return;
    }
    
    // Exchange code for token with Facebook
    const tokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', FACEBOOK_CONFIG.appId);
    tokenUrl.searchParams.set('client_secret', process.env.FACEBOOK_APP_SECRET || '');
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);
    
    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json() as FacebookTokenResponse;
    
    if (tokenData.error) {
      console.error('Facebook token error:', tokenData.error);
      res.status(400).json({ error: tokenData.error.message });
      return;
    }
    
    const { access_token, expires_in } = tokenData;
    
    if (!access_token) {
      res.status(400).json({ error: 'Failed to get access token' });
      return;
    }
    
    // Get long-lived token
    const longLivedTokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    longLivedTokenUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longLivedTokenUrl.searchParams.set('client_id', FACEBOOK_CONFIG.appId);
    longLivedTokenUrl.searchParams.set('client_secret', process.env.FACEBOOK_APP_SECRET || '');
    longLivedTokenUrl.searchParams.set('fb_exchange_token', access_token);
    
    const longLivedResponse = await fetch(longLivedTokenUrl.toString());
    const longLivedData = await longLivedResponse.json() as FacebookTokenResponse;
    
    const longLivedToken = longLivedData.access_token || access_token;
    const tokenExpiry = longLivedData.expires_in || expires_in || 3600;
    
    // Get user profile from Facebook
    const userResponse = await fetch(
      `https://graph.facebook.com/v18.0/me?fields=id,name,email,picture&access_token=${longLivedToken}`
    );
    const userData = await userResponse.json() as FacebookUserResponse;
    
    if (userData.error) {
      console.error('Facebook user error:', userData.error);
      res.status(400).json({ error: userData.error.message });
      return;
    }
    
    if (!userData.id) {
      res.status(400).json({ error: 'Failed to get Facebook user ID' });
      return;
    }
    
    // Find or create user in our database
    // First, try to find by Facebook ID stored in settings or by email
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { facebookId: userData.id },
          ...(userData.email ? [{ email: userData.email }] : []),
        ],
      },
    });
    
    if (!user) {
      // Create new user
      user = await prisma.user.create({
        data: {
          facebookId: userData.id,
          email: userData.email || `${userData.id}@facebook.placeholder`,
          firstName: userData.name?.split(' ')[0] || 'Facebook',
          lastName: userData.name?.split(' ').slice(1).join(' ') || 'User',
          passwordHash: '', // No password for OAuth users
          facebookAccessToken: longLivedToken,
          facebookTokenExpiry: new Date(Date.now() + tokenExpiry * 1000),
        },
      });
    } else {
      // Update existing user with Facebook token
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          facebookId: userData.id,
          facebookAccessToken: longLivedToken,
          facebookTokenExpiry: new Date(Date.now() + tokenExpiry * 1000),
        },
      });
    }
    
    // Generate JWT tokens
    const jwtToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );
    
    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '30d' }
    );
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
        facebookConnected: true,
      },
      tokens: {
        accessToken: jwtToken,
        refreshToken,
        expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
      },
      facebook: {
        userId: userData.id,
        name: userData.name,
        picture: userData.picture?.data?.url,
        tokenExpiry: new Date(Date.now() + tokenExpiry * 1000).toISOString(),
      },
    });
  } catch (error) {
    console.error('Facebook OAuth error:', error);
    res.status(500).json({ error: 'Failed to process Facebook authentication' });
  }
});

/**
 * GET /api/auth/facebook/config
 * Get Facebook OAuth configuration (safe to expose)
 */
router.get('/config', (_req: Request, res: Response) => {
  res.json({
    appId: FACEBOOK_CONFIG.appId,
    scope: FACEBOOK_CONFIG.oauth.scope.join(','),
    version: FACEBOOK_CONFIG.oauth.graphVersion,
  });
});

/**
 * POST /api/auth/facebook/refresh
 * Refresh Facebook access token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { userId, currentToken } = req.body;
    
    if (!userId || !currentToken) {
      res.status(400).json({ error: 'userId and currentToken are required' });
      return;
    }
    
    // Verify user exists and token matches
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user || user.facebookAccessToken !== currentToken) {
      res.status(401).json({ error: 'Invalid user or token' });
      return;
    }
    
    // Get new long-lived token
    const longLivedTokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    longLivedTokenUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longLivedTokenUrl.searchParams.set('client_id', FACEBOOK_CONFIG.appId);
    longLivedTokenUrl.searchParams.set('client_secret', process.env.FACEBOOK_APP_SECRET || '');
    longLivedTokenUrl.searchParams.set('fb_exchange_token', currentToken);
    
    const response = await fetch(longLivedTokenUrl.toString());
    const data = await response.json() as FacebookTokenResponse;
    
    if (data.error) {
      res.status(400).json({ error: data.error.message });
      return;
    }
    
    if (!data.access_token) {
      res.status(400).json({ error: 'Failed to refresh token' });
      return;
    }
    
    // Update user's token
    await prisma.user.update({
      where: { id: userId },
      data: {
        facebookAccessToken: data.access_token,
        facebookTokenExpiry: new Date(Date.now() + (data.expires_in || 3600) * 1000),
      },
    });
    
    res.json({
      success: true,
      token: data.access_token,
      expiresIn: data.expires_in,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

/**
 * POST /api/auth/facebook/disconnect
 * Disconnect Facebook from user account
 */
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        facebookId: null,
        facebookAccessToken: null,
        facebookTokenExpiry: null,
      },
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect Facebook' });
  }
});

export default router;
