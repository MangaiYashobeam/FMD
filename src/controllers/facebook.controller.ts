import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth';
import prisma from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import axios from 'axios';

export class FacebookController {
  /**
   * Get Facebook OAuth URL
   */
  async getAuthUrl(req: AuthRequest, res: Response) {
    const accountId = req.query.accountId as string;

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
    const redirectUri = `${process.env.API_URL}/api/facebook/callback`;
    const state = Buffer.from(JSON.stringify({ accountId, userId: req.user!.id })).toString('base64');

    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${state}` +
      `&scope=pages_manage_posts,pages_read_engagement,pages_show_list`;

    res.json({
      success: true,
      data: { url: authUrl },
    });
  }

  /**
   * Handle Facebook OAuth callback
   */
  async handleCallback(req: AuthRequest, res: Response) {
    const { code, state } = req.body;

    if (!code || !state) {
      throw new AppError('Missing code or state parameter', 400);
    }

    // Decode state
    const { accountId } = JSON.parse(Buffer.from(state, 'base64').toString());

    // Exchange code for access token
    const tokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        redirect_uri: `${process.env.API_URL}/api/facebook/callback`,
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
    const accountId = req.query.accountId as string;

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
}

