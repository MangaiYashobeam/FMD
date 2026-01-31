import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth';
import prisma from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import axios from 'axios';
import crypto from 'crypto';
import { getJwtSecret } from '@/config/security';

// Sign OAuth state to prevent tampering
function signState(data: object): string {
  const payload = JSON.stringify(data);
  const signature = crypto
    .createHmac('sha256', getJwtSecret())
    .update(payload)
    .digest('hex');
  return Buffer.from(JSON.stringify({ payload, signature })).toString('base64');
}

// Verify and decode signed state
function verifyState(state: string): { accountId: string; userId: string; returnUrl: string } | null {
  try {
    const { payload, signature } = JSON.parse(Buffer.from(state, 'base64').toString());
    const expectedSignature = crypto
      .createHmac('sha256', getJwtSecret())
      .update(payload)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      logger.warn('OAuth state signature mismatch - possible tampering attempt');
      return null;
    }
    
    return JSON.parse(payload);
  } catch (error) {
    logger.error('Failed to verify OAuth state:', error);
    return null;
  }
}

export class FacebookController {
  /**
   * Get user's primary account ID
   */
  private async getUserAccountId(userId: string): Promise<string> {
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId },
      select: { accountId: true },
    });
    
    if (!accountUser) {
      throw new AppError('No account found for user', 404);
    }
    
    return accountUser.accountId;
  }

  /**
   * Get Facebook OAuth URL
   */
  async getAuthUrl(req: AuthRequest, res: Response) {
    let accountId = req.query.accountId as string;

    // If no accountId provided, get user's primary account
    if (!accountId) {
      accountId = await this.getUserAccountId(req.user!.id);
    }

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId,
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    const appId = process.env.FACEBOOK_APP_ID;
    if (!appId) {
      throw new AppError('Facebook App ID not configured', 500);
    }
    
    // Use FACEBOOK_REDIRECT_URI if set, otherwise construct from API_URL or FRONTEND_URL
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI || 
      `${process.env.API_URL || process.env.FRONTEND_URL || 'http://localhost:5000'}/api/facebook/callback`;
    
    // Sign the state to prevent tampering (HMAC signed)
    const state = signState({ 
      accountId, 
      userId: req.user!.id,
      returnUrl: req.query.returnUrl || '/app/facebook',
      timestamp: Date.now() // Add timestamp for expiry check
    });

    // Request permissions for pages and marketplace
    // Note: Advanced permissions (pages_*) require App Review
    // For Development Mode, we use basic scopes + pages_show_list
    // After App Review approval, uncomment the full scopes
    const scopes = [
      'public_profile',
      'email',
      // These require App Review:
      // 'pages_manage_posts',
      // 'pages_read_engagement', 
      // 'pages_show_list',
    ].join(',');

    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${state}` +
      `&scope=${scopes}` +
      `&response_type=code`;

    logger.info(`Facebook auth URL generated for account ${accountId}`);

    res.json({
      success: true,
      data: { url: authUrl },
    });
  }

  /**
   * Handle Facebook OAuth callback (GET - browser redirect)
   */
  async handleOAuthCallback(req: AuthRequest, res: Response) {
    const { code, state, error, error_description } = req.query;
    
    // Debug logging
    logger.info(`Facebook OAuth callback received - URL: ${req.originalUrl}`);
    logger.info(`Facebook OAuth callback params - code: ${code ? 'present' : 'missing'}, state: ${state ? 'present' : 'missing'}, error: ${error || 'none'}`);

    // Handle user denial
    if (error) {
      logger.warn(`Facebook OAuth error: ${error} - ${error_description}`);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/app/facebook?error=${encodeURIComponent(error_description as string || 'OAuth failed')}`);
    }

    if (!code || !state) {
      logger.warn(`Facebook OAuth missing params - Full query: ${JSON.stringify(req.query)}`);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/app/facebook?error=Missing authorization code`);
    }

    try {
      // Verify and decode signed state (prevents tampering)
      const stateData = verifyState(state as string);
      
      if (!stateData) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        return res.redirect(`${frontendUrl}/app/facebook?error=Invalid or tampered state`);
      }
      
      const { accountId, userId, returnUrl } = stateData;

      // Exchange code for access token
      const redirectUri = process.env.FACEBOOK_REDIRECT_URI || 
        `${process.env.API_URL || process.env.FRONTEND_URL || 'http://localhost:5000'}/api/facebook/callback`;
      
      const tokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
        params: {
          client_id: process.env.FACEBOOK_APP_ID,
          client_secret: process.env.FACEBOOK_APP_SECRET,
          redirect_uri: redirectUri,
          code,
        },
      });

      const { access_token: accessToken } = tokenResponse.data;

      // Get user info
      const userResponse = await axios.get('https://graph.facebook.com/v18.0/me', {
        params: {
          access_token: accessToken,
          fields: 'id,name,email',
        },
      });

      const fbUser = userResponse.data;

      // Get user's pages
      const pagesResponse = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
        params: {
          access_token: accessToken,
        },
      });

      // Store pages/profiles in database
      const profiles = [];
      
      // Delete existing profiles for this account (one Facebook per account policy)
      // This ensures clean reconnection when user switches Facebook accounts
      await prisma.facebookProfile.deleteMany({
        where: { accountId }
      });
      logger.info(`Cleared existing Facebook profiles for account ${accountId} before reconnection`);
      
      // If no pages, create a personal profile for Marketplace posting
      if (!pagesResponse.data.data || pagesResponse.data.data.length === 0) {
        const profile = await prisma.facebookProfile.upsert({
          where: {
            accountId_pageId: {
              accountId,
              pageId: fbUser.id,
            },
          },
          create: {
            facebookUserId: fbUser.id,
            facebookUserName: fbUser.name,
            accountId,
            userId,
            pageId: fbUser.id,
            pageName: fbUser.name || 'Personal Profile',
            accessToken,
            tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
            category: 'PERSONAL',
          },
          update: {
            pageName: fbUser.name || 'Personal Profile',
            facebookUserName: fbUser.name,
            accessToken,
            category: 'PERSONAL',
          },
        });
        profiles.push(profile);
      } else {
        // Store each page
        for (const page of pagesResponse.data.data) {
          const profile = await prisma.facebookProfile.upsert({
            where: {
              accountId_pageId: {
                accountId,
                pageId: page.id,
              },
            },
            create: {
              facebookUserId: fbUser.id,
              facebookUserName: fbUser.name,
              accountId,
              userId,
              pageId: page.id,
              pageName: page.name,
              accessToken: page.access_token,
              tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
              category: page.category || 'Business',
            },
            update: {
              pageName: page.name,
              facebookUserName: fbUser.name,
              accessToken: page.access_token,
              category: page.category || 'Business',
            },
          });
          profiles.push(profile);
        }
      }

      logger.info(`Facebook connected: ${profiles.length} profile(s) for account ${accountId}`);

      // Redirect back to frontend
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}${returnUrl || '/facebook'}?success=true&connected=${profiles.length}`);
    } catch (error: any) {
      logger.error('Facebook OAuth callback error:', error.response?.data || error.message);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/app/facebook?error=${encodeURIComponent('Failed to connect Facebook')}`);
    }
  }

  /**
   * Handle Facebook OAuth callback (POST)
   */
  async handleCallback(req: AuthRequest, res: Response) {
    const { code, state } = req.body;

    if (!code || !state) {
      throw new AppError('Missing code or state parameter', 400);
    }

    // Verify and decode signed state (prevents tampering)
    const stateData = verifyState(state);
    
    if (!stateData) {
      throw new AppError('Invalid or tampered state parameter', 400);
    }
    
    const { accountId } = stateData;

    // Exchange code for access token
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI || 
      `${process.env.API_URL || process.env.FRONTEND_URL || 'http://localhost:5000'}/api/facebook/callback`;
    
    const tokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        redirect_uri: redirectUri,
        code,
      },
    });

    const { access_token: accessToken } = tokenResponse.data;

    // Get user's pages
    const pagesResponse = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
      params: {
        access_token: accessToken,
      },
    });

    // Store pages in database
    const profiles = [];
    for (const page of pagesResponse.data.data) {
      const profile = await prisma.facebookProfile.upsert({
        where: {
          accountId_pageId: {
            accountId,
            pageId: page.id,
          },
        },
        create: {
          facebookUserId: page.id,
          accountId,
          userId: req.user!.id,
          pageId: page.id,
          pageName: page.name,
          accessToken: page.access_token,
          tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
          category: page.category || 'UNKNOWN',
        },
        update: {
          pageName: page.name,
          accessToken: page.access_token,
          category: page.category || 'UNKNOWN',
        },
      });
      profiles.push(profile);
    }

    logger.info(`Facebook pages connected: ${profiles.length} for account ${accountId}`);

    res.json({
      success: true,
      data: { profiles },
      message: 'Facebook pages connected successfully',
    });
  }

  /**
   * Get connected Facebook profiles
   */
  async getProfiles(req: AuthRequest, res: Response) {
    let accountId = req.query.accountId as string;

    // If no accountId, get user's primary account
    if (!accountId) {
      accountId = await this.getUserAccountId(req.user!.id);
    }

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId,
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    const profiles = await prisma.facebookProfile.findMany({
      where: { accountId },
      select: {
        id: true,
        pageId: true,
        pageName: true,
        facebookUserName: true,
        category: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: profiles,
    });
  }

  /**
   * Get Facebook connections for current user's account
   */
  async getConnections(req: AuthRequest, res: Response) {
    const accountId = await this.getUserAccountId(req.user!.id);

    const profiles = await prisma.facebookProfile.findMany({
      where: { accountId },
      select: {
        id: true,
        pageId: true,
        pageName: true,
        facebookUserName: true,
        category: true,
        isActive: true,
        lastSyncAt: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: {
        connections: profiles,
        isConnected: profiles.length > 0,
      },
    });
  }

  /**
   * Disconnect a Facebook profile
   */
  async disconnect(req: AuthRequest, res: Response) {
    const id = req.params.id as string;

    const profile = await prisma.facebookProfile.findUnique({
      where: { id },
    });

    if (!profile) {
      throw new AppError('Connection not found', 404);
    }

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: profile.accountId,
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    // Delete the profile
    await prisma.facebookProfile.delete({
      where: { id: id as string },
    });

    logger.info(`Facebook profile disconnected: ${id}`);

    res.json({
      success: true,
      message: 'Facebook disconnected successfully',
    });
  }

  /**
   * Get Facebook groups for posting
   */
  async getGroups(req: AuthRequest, res: Response) {
    const accountId = await this.getUserAccountId(req.user!.id);

    const groups = await (prisma as any).facebookGroup.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: {
        groups: groups.map((g: any) => ({
          id: g.id,
          groupId: g.groupId,
          name: g.name,
          url: g.url,
          memberCount: g.memberCount,
          isActive: g.isActive,
          autoPost: g.autoPost,
          lastPosted: g.lastPostedAt,
        })),
      },
    });
  }

  /**
   * Add a Facebook group for posting
   */
  async addGroup(req: AuthRequest, res: Response) {
    const { groupId, groupName } = req.body;
    const accountId = await this.getUserAccountId(req.user!.id);

    // Extract group ID from URL if full URL provided
    let extractedGroupId = groupId;
    if (groupId.includes('facebook.com/groups/')) {
      const match = groupId.match(/groups\/([^/?]+)/);
      if (match) {
        extractedGroupId = match[1];
      }
    }

    // Check if group already exists
    const existing = await (prisma as any).facebookGroup.findUnique({
      where: {
        accountId_groupId: {
          accountId,
          groupId: extractedGroupId,
        },
      },
    });

    if (existing) {
      throw new AppError('This group is already added', 400);
    }

    // Create group
    const group = await (prisma as any).facebookGroup.create({
      data: {
        accountId,
        groupId: extractedGroupId,
        name: groupName || `Group ${extractedGroupId}`,
        url: `https://www.facebook.com/groups/${extractedGroupId}`,
        isActive: true,
        autoPost: false,
      },
    });

    logger.info(`Facebook group added: ${group.id} for account ${accountId}`);

    res.json({
      success: true,
      data: {
        id: group.id,
        groupId: group.groupId,
        name: group.name,
        url: group.url,
        isActive: group.isActive,
        autoPost: group.autoPost,
      },
      message: 'Group added successfully',
    });
  }

  /**
   * Remove a Facebook group
   */
  async removeGroup(req: AuthRequest, res: Response) {
    const id = req.params.id as string;

    const group = await (prisma as any).facebookGroup.findUnique({
      where: { id },
    });

    if (!group) {
      throw new AppError('Group not found', 404);
    }

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: group.accountId,
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    await (prisma as any).facebookGroup.delete({
      where: { id },
    });

    logger.info(`Facebook group removed: ${id}`);

    res.json({
      success: true,
      message: 'Group removed successfully',
    });
  }

  /**
   * Toggle auto-post for a group
   */
  async toggleGroupAutoPost(req: AuthRequest, res: Response) {
    const id = req.params.id as string;

    const group = await (prisma as any).facebookGroup.findUnique({
      where: { id },
    });

    if (!group) {
      throw new AppError('Group not found', 404);
    }

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: group.accountId,
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    const updated = await (prisma as any).facebookGroup.update({
      where: { id },
      data: { autoPost: !group.autoPost },
    });

    res.json({
      success: true,
      data: { autoPost: updated.autoPost },
      message: `Auto-post ${updated.autoPost ? 'enabled' : 'disabled'}`,
    });
  }

  /**
   * Get post history
   */
  async getPostHistory(req: AuthRequest, res: Response) {
    const { vehicleId } = req.query;
    const accountId = await this.getUserAccountId(req.user!.id);

    const where: any = {
      vehicle: { accountId },
    };

    if (vehicleId) {
      where.vehicleId = vehicleId;
    }

    const posts = await prisma.facebookPost.findMany({
      where,
      include: {
        vehicle: {
          select: {
            id: true,
            year: true,
            make: true,
            model: true,
            stockNumber: true,
          },
        },
        profile: {
          select: {
            id: true,
            pageName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({
      success: true,
      data: posts,
    });
  }

  /**
   * Create Facebook Marketplace post
   */
  async createPost(req: AuthRequest, res: Response) {
    const { vehicleId, profileId } = req.body;

    // Get vehicle
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { account: true },
    });

    if (!vehicle) {
      throw new AppError('Vehicle not found', 404);
    }

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: vehicle.accountId,
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    // Get Facebook profile
    const profile = await prisma.facebookProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile || profile.accountId !== vehicle.accountId) {
      throw new AppError('Facebook profile not found', 404);
    }

    // Create post data
    const postData = {
      message: `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ' ' + vehicle.trim : ''}\n\n` +
        `Price: $${vehicle.price?.toLocaleString() || 'Contact for price'}\n` +
        `Mileage: ${vehicle.mileage?.toLocaleString() || 'N/A'} miles\n` +
        `Stock #: ${vehicle.stockNumber}\n\n` +
        `${vehicle.description || ''}`,
      link: vehicle.imageUrls?.[0] || '',
    };

    try {
      // Post to Facebook
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${profile.pageId}/feed`,
        postData,
        {
          params: {
            access_token: profile.accessToken,
          },
        }
      );

      // Save post record
      const post = await prisma.facebookPost.create({
        data: {
          vehicleId,
          profileId,
          postId: response.data.id,
          status: 'ACTIVE',
          message: postData.message,
        },
      });

      logger.info(`Facebook post created: ${post.id} for vehicle ${vehicleId}`);

      res.json({
        success: true,
        data: post,
        message: 'Post created successfully',
      });
    } catch (error: any) {
      logger.error('Facebook post error:', error.response?.data || error.message);
      throw new AppError('Failed to create Facebook post', 500);
    }
  }

  /**
   * Delete Facebook post
   */
  async deletePost(req: AuthRequest, res: Response) {
    const { id } = req.params;

    const post = await prisma.facebookPost.findUnique({
      where: { id: id as string },
      include: {
        vehicle: true,
        profile: true,
      },
    });

    if (!post) {
      throw new AppError('Post not found', 404);
    }

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: post.vehicle.accountId,
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    try {
      // Delete from Facebook
      await axios.delete(
        `https://graph.facebook.com/v18.0/${post.postId}`,
        {
          params: {
            access_token: post.profile.accessToken,
          },
        }
      );

      // Update status in database
      await prisma.facebookPost.update({
        where: { id: id as string },
        data: { status: 'DELETED', deletedAt: new Date() },
      });

      logger.info(`Facebook post deleted: ${id}`);

      res.json({
        success: true,
        message: 'Post deleted successfully',
      });
    } catch (error: any) {
      logger.error('Facebook delete error:', error.response?.data || error.message);
      throw new AppError('Failed to delete Facebook post', 500);
    }
  }

  /**
   * Confirm marketplace post from Chrome extension
   */
  async confirmMarketplacePost(req: AuthRequest, res: Response) {
    const { vehicleId, postUrl, postedAt } = req.body;

    if (!vehicleId || !postUrl) {
      throw new AppError('Vehicle ID and post URL are required', 400);
    }

    // Verify vehicle exists and user has access
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        account: {
          include: {
            accountUsers: true,
            facebookProfiles: true,
          },
        },
      },
    });

    if (!vehicle) {
      throw new AppError('Vehicle not found', 404);
    }

    const hasAccess = vehicle.account.accountUsers.some(
      (au) => au.userId === req.user!.id
    );

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    // Use first available Facebook profile or create a placeholder
    let profileId = vehicle.account.facebookProfiles[0]?.id;

    if (!profileId) {
      // Create a placeholder profile for personal marketplace posts
      const placeholderProfile = await prisma.facebookProfile.create({
        data: {
          facebookUserId: 'marketplace-personal',
          accountId: vehicle.accountId,
          userId: req.user!.id,
          pageId: 'personal-marketplace',
          pageName: 'Personal Marketplace',
          accessToken: 'personal-token',
          tokenExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          category: 'PERSONAL',
        },
      });
      profileId = placeholderProfile.id;
    }

    // Create marketplace post record
    const post = await prisma.facebookPost.create({
      data: {
        vehicleId,
        profileId,
        postId: postUrl,
        message: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        status: 'PUBLISHED',
        createdAt: postedAt ? new Date(postedAt) : new Date(),
      },
    });

    logger.info(`Marketplace post confirmed: ${post.id} for vehicle ${vehicleId}`);

    res.json({
      success: true,
      data: post,
      message: 'Marketplace post confirmed successfully',
    });
  }

  /**
   * Import Facebook session cookies for worker automation
   * POST /api/facebook/session/import
   */
  async importSession(req: AuthRequest, res: Response) {
    const { accountId, cookies, localStorage, origin } = req.body;

    // Verify user has access to the account
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId,
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied to this account', 403);
    }

    // Call Python worker API to store the session
    const workerApiUrl = process.env.WORKER_API_URL || 'http://worker-api:8000';
    const workerSecret = process.env.WORKER_SECRET || process.env.ENCRYPTION_KEY || '';

    try {
      const response = await axios.post(
        `${workerApiUrl}/api/sessions/import`,
        {
          account_id: accountId,
          cookies,
          local_storage: localStorage || {},
          origin: origin || 'https://www.facebook.com',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': workerSecret,
          },
          timeout: 30000,
        }
      );

      logger.info(`Facebook session imported for account ${accountId}: ${cookies.length} cookies`);

      res.json({
        success: true,
        data: response.data,
        message: 'Session cookies imported successfully. Worker can now automate this account.',
      });
    } catch (error: any) {
      logger.error('Failed to import Facebook session:', error.response?.data || error.message);
      throw new AppError(
        error.response?.data?.detail || 'Failed to import session to worker',
        error.response?.status || 500
      );
    }
  }

  /**
   * Check Facebook session status for automation
   * GET /api/facebook/session/status/:accountId
   */
  async getSessionStatus(req: AuthRequest, res: Response) {
    const accountId = req.params.accountId as string;

    // Verify user has access to the account
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId,
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied to this account', 403);
    }

    // Call Python worker API to check session status
    const workerApiUrl = process.env.WORKER_API_URL || 'http://worker-api:8000';
    const workerSecret = process.env.WORKER_SECRET || process.env.ENCRYPTION_KEY || '';

    try {
      const response = await axios.get(
        `${workerApiUrl}/api/sessions/${accountId}`,
        {
          headers: {
            'X-API-Key': workerSecret,
          },
          timeout: 10000,
        }
      );

      res.json({
        success: true,
        data: {
          accountId,
          hasSession: response.data.has_session,
          checkedAt: response.data.checked_at,
          savedAt: response.data.saved_at,
          ageDays: response.data.age_days,
          expiresAt: response.data.expires_at,
          cookieCount: response.data.cookie_count,
          hasRequiredCookies: response.data.has_required_cookies,
          facebookUserId: response.data.facebook_user_id,
          cookieDetails: response.data.cookie_details || [],
        },
        message: response.data.has_session 
          ? 'Session found and can be used for automation'
          : 'No session found. Import cookies to enable automation.',
      });
    } catch (error: any) {
      if (error.response?.status === 404) {
        res.json({
          success: true,
          data: {
            accountId,
            hasSession: false,
            checkedAt: new Date().toISOString(),
          },
          message: 'No session found. Import cookies to enable automation.',
        });
        return;
      }
      logger.error('Failed to check session status:', error.response?.data || error.message);
      throw new AppError(
        error.response?.data?.detail || 'Failed to check session status',
        error.response?.status || 500
      );
    }
  }
}
