/**
 * Facebook OAuth Routes
 * 
 * Handles Facebook OAuth authentication flow for the Chrome Extension
 */

import { Router } from 'express';
import { FACEBOOK_CONFIG } from '../config/facebook';
import { prisma } from '../lib/prisma';
import jwt from 'jsonwebtoken';

const router = Router();

// ============================================
// OAuth Callback
// ============================================

/**
 * POST /api/auth/facebook/callback
 * Exchange authorization code for access token
 */
router.post('/callback', async (req, res) => {
  try {
    const { code, redirectUri } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }
    
    // Exchange code for token with Facebook
    const tokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', FACEBOOK_CONFIG.appId);
    tokenUrl.searchParams.set('client_secret', process.env.FACEBOOK_APP_SECRET!);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);
    
    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      console.error('Facebook token error:', tokenData.error);
      return res.status(400).json({ error: tokenData.error.message });
    }
    
    const { access_token, expires_in } = tokenData;
    
    // Get long-lived token
    const longLivedTokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    longLivedTokenUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longLivedTokenUrl.searchParams.set('client_id', FACEBOOK_CONFIG.appId);
    longLivedTokenUrl.searchParams.set('client_secret', process.env.FACEBOOK_APP_SECRET!);
    longLivedTokenUrl.searchParams.set('fb_exchange_token', access_token);
    
    const longLivedResponse = await fetch(longLivedTokenUrl.toString());
    const longLivedData = await longLivedResponse.json();
    
    const longLivedToken = longLivedData.access_token || access_token;
    const tokenExpiry = longLivedData.expires_in || expires_in;
    
    // Get user profile from Facebook
    const userResponse = await fetch(
      `https://graph.facebook.com/v18.0/me?fields=id,name,email,picture&access_token=${longLivedToken}`
    );
    const userData = await userResponse.json();
    
    if (userData.error) {
      console.error('Facebook user error:', userData.error);
      return res.status(400).json({ error: userData.error.message });
    }
    
    // Find or create user in our database
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { facebookId: userData.id },
          { email: userData.email },
        ],
      },
      include: {
        dealerAccount: true,
      },
    });
    
    if (!user) {
      // Create new user
      user = await prisma.user.create({
        data: {
          facebookId: userData.id,
          email: userData.email,
          name: userData.name,
          profilePicture: userData.picture?.data?.url,
          facebookAccessToken: longLivedToken,
          facebookTokenExpiry: new Date(Date.now() + tokenExpiry * 1000),
        },
        include: {
          dealerAccount: true,
        },
      });
    } else {
      // Update existing user
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          facebookId: userData.id,
          facebookAccessToken: longLivedToken,
          facebookTokenExpiry: new Date(Date.now() + tokenExpiry * 1000),
          profilePicture: userData.picture?.data?.url,
        },
        include: {
          dealerAccount: true,
        },
      });
    }
    
    // Create dealer account if not exists
    let dealerAccount = user.dealerAccount;
    
    if (!dealerAccount) {
      dealerAccount = await prisma.dealerAccount.create({
        data: {
          userId: user.id,
          businessName: user.name,
          facebookConnected: true,
          facebookUserId: userData.id,
        },
      });
    } else {
      dealerAccount = await prisma.dealerAccount.update({
        where: { id: dealerAccount.id },
        data: {
          facebookConnected: true,
          facebookUserId: userData.id,
        },
      });
    }
    
    // Generate JWT for extension
    const serverToken = jwt.sign(
      {
        userId: user.id,
        dealerAccountId: dealerAccount.id,
        facebookId: userData.id,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      accessToken: longLivedToken,
      expiresIn: tokenExpiry,
      serverToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        facebookId: userData.id,
      },
      dealerAccount: {
        id: dealerAccount.id,
        businessName: dealerAccount.businessName,
      },
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * POST /api/auth/facebook/refresh
 * Refresh access token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { accessToken } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({ error: 'Access token required' });
    }
    
    // Exchange for new long-lived token
    const tokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    tokenUrl.searchParams.set('grant_type', 'fb_exchange_token');
    tokenUrl.searchParams.set('client_id', FACEBOOK_CONFIG.appId);
    tokenUrl.searchParams.set('client_secret', process.env.FACEBOOK_APP_SECRET!);
    tokenUrl.searchParams.set('fb_exchange_token', accessToken);
    
    const response = await fetch(tokenUrl.toString());
    const data = await response.json();
    
    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }
    
    res.json({
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

/**
 * GET /api/auth/facebook/verify
 * Verify access token is still valid
 */
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ valid: false, error: 'No token provided' });
    }
    
    // Verify with our server first
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Get user and their Facebook token
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    
    if (!user?.facebookAccessToken) {
      return res.status(401).json({ valid: false, error: 'No Facebook token' });
    }
    
    // Verify Facebook token
    const debugUrl = `https://graph.facebook.com/debug_token?input_token=${user.facebookAccessToken}&access_token=${FACEBOOK_CONFIG.appId}|${process.env.FACEBOOK_APP_SECRET}`;
    const response = await fetch(debugUrl);
    const data = await response.json();
    
    if (data.data?.is_valid) {
      res.json({
        valid: true,
        expiresAt: data.data.expires_at,
        userId: user.facebookId,
      });
    } else {
      res.json({
        valid: false,
        error: data.data?.error?.message || 'Token invalid',
      });
    }
  } catch (error) {
    console.error('Token verify error:', error);
    res.status(401).json({ valid: false, error: 'Verification failed' });
  }
});

/**
 * POST /api/auth/facebook/disconnect
 * Disconnect Facebook account
 */
router.post('/disconnect', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Update user
    await prisma.user.update({
      where: { id: decoded.userId },
      data: {
        facebookAccessToken: null,
        facebookTokenExpiry: null,
      },
    });
    
    // Update dealer account
    await prisma.dealerAccount.update({
      where: { id: decoded.dealerAccountId },
      data: {
        facebookConnected: false,
      },
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: 'Disconnect failed' });
  }
});

export default router;
