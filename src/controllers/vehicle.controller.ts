import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth';
import prisma from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

export class VehicleController {
  /**
   * Get all vehicles for account
   */
  async getVehicles(req: AuthRequest, res: Response) {
    const accountId = req.query.accountId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    // Verify user has access to account (SUPER_ADMIN or account member)
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        OR: [
          { role: 'SUPER_ADMIN' },
          { accountId },
        ],
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied to this account', 403);
    }

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where: { accountId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          facebookPosts: {
            select: {
              id: true,
              status: true,
              postId: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.vehicle.count({ where: { accountId } }),
    ]);

    res.json({
      success: true,
      data: {
        vehicles,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  }

  /**
   * Get single vehicle
   */
  async getVehicle(req: AuthRequest, res: Response) {
    const { id } = req.params;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: id as string },
      include: {
        account: {
          select: {
            id: true,
            name: true,
          },
        },
        facebookPosts: {
          orderBy: { createdAt: 'desc' },
        },
      },
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

    res.json({
      success: true,
      data: vehicle,
    });
  }

  /**
   * Create vehicle manually
   */
  async createVehicle(req: AuthRequest, res: Response) {
    const { accountId, vin, stockNumber, year, make, model, trim, price, mileage, description, imageUrls } = req.body;

    // Verify user has access (SUPER_ADMIN has access to all accounts)
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        OR: [
          { role: 'SUPER_ADMIN' },
          { accountId, role: { in: ['ACCOUNT_OWNER', 'ADMIN'] } },
        ],
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    // Check if VIN already exists
    const existing = await prisma.vehicle.findFirst({
      where: {
        accountId,
        vin,
      },
    });

    if (existing) {
      throw new AppError('Vehicle with this VIN already exists', 409);
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        accountId,
        vin,
        stockNumber,
        year,
        make,
        model,
        trim,
        price,
        mileage,
        description,
        imageUrls,
        source: 'MANUAL',
      },
    });

    logger.info(`Vehicle created: ${vehicle.id} by user ${req.user!.id}`);

    res.status(201).json({
      success: true,
      data: vehicle,
    });
  }

  /**
   * Update vehicle
   */
  async updateVehicle(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const updates = req.body;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: id as string },
    });

    if (!vehicle) {
      throw new AppError('Vehicle not found', 404);
    }

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: vehicle.accountId,
        role: { in: ['ACCOUNT_OWNER', 'ADMIN', 'SALES_REP'] },
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    const updated = await prisma.vehicle.update({
      where: { id: id as string },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });

    logger.info(`Vehicle updated: ${id} by user ${req.user!.id}`);

    res.json({
      success: true,
      data: updated,
    });
  }

  /**
   * Delete vehicle
   */
  async deleteVehicle(req: AuthRequest, res: Response) {
    const { id } = req.params;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: id as string },
    });

    if (!vehicle) {
      throw new AppError('Vehicle not found', 404);
    }

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: vehicle.accountId,
        role: { in: ['ACCOUNT_OWNER', 'ADMIN'] },
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    await prisma.vehicle.delete({
      where: { id: id as string },
    });

    logger.info(`Vehicle deleted: ${id} by user ${req.user!.id}`);

    res.json({
      success: true,
      message: 'Vehicle deleted successfully',
    });
  }

  /**
   * Bulk update vehicle status
   */
  async bulkUpdateStatus(req: AuthRequest, res: Response) {
    const { vehicleIds, status, accountId } = req.body;

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId,
        role: { in: ['ACCOUNT_OWNER', 'ADMIN', 'SALES_REP'] },
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    const result = await prisma.vehicle.updateMany({
      where: {
        id: { in: vehicleIds },
        accountId,
      },
      data: {
        status,
        updatedAt: new Date(),
      },
    });

    logger.info(`Bulk status update: ${result.count} vehicles updated by user ${req.user!.id}`);

    res.json({
      success: true,
      data: { updated: result.count },
    });
  }

  /**
   * Post vehicle to Facebook via multiple methods
   * - IAI: Browser automation through Chrome extension
   * - API: Facebook Graph API (requires Business verification)
   * - Pixel: Tracking only (fires conversion events)
   */
  async postToFacebook(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { title, price, description, photos, method } = req.body;

    // Get the vehicle with account and Facebook profiles
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: id as string },
      include: { 
        account: {
          include: {
            facebookProfiles: true,
          },
        },
      },
    });

    if (!vehicle) {
      throw new AppError('Vehicle not found', 404);
    }

    // Verify access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: vehicle.accountId,
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    // Build vehicle data for posting
    const vehicleData = {
      title: title || `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      price: price || Number(vehicle.price) || 0,
      description: description || vehicle.description || '',
      photos: photos || vehicle.imageUrls || [],
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim,
      mileage: vehicle.mileage,
      vin: vehicle.vin,
      condition: vehicle.isNew ? 'new' : 'used',
      transmission: vehicle.transmission,
      fuelType: vehicle.fuelType,
      exteriorColor: vehicle.exteriorColor,
      bodyType: vehicle.bodyType,
      stockNumber: vehicle.stockNumber,
    };

    // =====================================================
    // METHOD 1: IAI (Browser Automation via Chrome Extension)
    // =====================================================
    if (method === 'iai') {
      const task = await prisma.extensionTask.create({
        data: {
          accountId: vehicle.accountId,
          type: 'POST_TO_MARKETPLACE',
          status: 'pending',
          priority: 5,
          vehicleId: vehicle.id,
          data: {
            action: 'create_listing',
            vehicle: vehicleData,
            instructions: {
              navigateTo: 'marketplace_create_vehicle',
              fillForm: true,
              uploadPhotos: true,
              submit: false, // Require manual review before publish
            },
          },
        },
      });

      // Create a pending Facebook post record
      const fbProfile = vehicle.account.facebookProfiles?.[0];
      if (fbProfile) {
        await prisma.facebookPost.create({
          data: {
            vehicleId: vehicle.id,
            profileId: fbProfile.id,
            status: 'pending',
            message: vehicleData.description,
          },
        });
      }

      logger.info(`IAI task created for vehicle ${id}: ${task.id}`);

      res.json({
        success: true,
        message: 'Task queued for IAI Soldier. Open Facebook in Chrome with extension active.',
        data: { 
          taskId: task.id, 
          method: 'iai',
          status: 'pending',
          instructions: [
            '1. Ensure Chrome Extension is installed and logged in',
            '2. Open Facebook.com in the same browser',
            '3. The IAI Soldier will automatically detect and execute the task',
            '4. Review the listing before publishing',
          ],
        },
      });
      return;
    }

    // =====================================================
    // METHOD 2: PIXEL (Conversion Tracking Only)
    // =====================================================
    if (method === 'pixel') {
      // Get account settings for Pixel ID (for future use with custom Pixel ID)
      const _settings = await prisma.accountSettings.findUnique({
        where: { accountId: vehicle.accountId },
      });

      // Fire a "ViewContent" and "InitiateCheckout" event for the vehicle
      // This helps with retargeting and conversion tracking
      const pixelEventData = {
        event: 'InitiateCheckout',
        eventId: `post_${vehicle.id}_${Date.now()}`,
        vehicleData: {
          content_type: 'vehicle',
          content_ids: [vehicle.id],
          content_name: vehicleData.title,
          value: vehicleData.price,
          currency: 'USD',
          content_category: 'Vehicles',
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
        },
        timestamp: new Date().toISOString(),
      };

      // Store the pixel event for the frontend to fire
      // (Pixel events must be fired from the browser, not server)
      
      logger.info(`Pixel event prepared for vehicle ${id}`);

      res.json({
        success: true,
        message: 'Pixel tracking event prepared. Note: Pixel cannot directly post to Marketplace.',
        data: { 
          method: 'pixel',
          event: pixelEventData,
          instructions: [
            'Facebook Pixel is for TRACKING only, not posting.',
            'The pixel event will be fired when users interact with this vehicle.',
            'Use IAI method to actually post to Facebook Marketplace.',
          ],
          note: 'Facebook Pixel tracks conversions but cannot create Marketplace listings.',
        },
      });
      return;
    }

    // =====================================================
    // METHOD 3: API (Facebook Graph API - Limited)
    // =====================================================
    if (method === 'api') {
      // Check if account has a connected Facebook profile with valid token
      const fbProfile = vehicle.account.facebookProfiles?.[0];
      
      if (!fbProfile || !fbProfile.accessToken) {
        res.json({
          success: false,
          message: 'No Facebook profile connected. Please connect via Settings > Facebook.',
          data: { 
            method: 'api',
            status: 'no_profile',
            instructions: [
              'Go to Settings > Facebook Integration',
              'Click "Connect Facebook Page"',
              'Authorize the required permissions',
            ],
          },
        });
        return;
      }

      // Check token expiry
      if (new Date(fbProfile.tokenExpiresAt) < new Date()) {
        res.json({
          success: false,
          message: 'Facebook token expired. Please reconnect your Facebook page.',
          data: { 
            method: 'api',
            status: 'token_expired',
          },
        });
        return;
      }

      // IMPORTANT: Facebook does NOT have a public Marketplace API
      // The Graph API can only post to Pages, not Marketplace
      // This creates a Page post with vehicle info (not a Marketplace listing)
      
      try {
        const pagePostMessage = `🚗 ${vehicleData.title}\n\n` +
          `💰 Price: $${vehicleData.price.toLocaleString()}\n` +
          `📍 Mileage: ${vehicleData.mileage?.toLocaleString() || 'N/A'} miles\n` +
          `🎨 Color: ${vehicleData.exteriorColor || 'See photos'}\n\n` +
          `${vehicleData.description?.slice(0, 500) || 'Contact us for more details!'}\n\n` +
          `Stock #${vehicleData.stockNumber || 'N/A'} | VIN: ${vehicleData.vin?.slice(-6) || 'Ask us'}`;

        // Note: This would post to the PAGE, not Marketplace
        // Marketplace API does not exist for general public use
        
        logger.info(`API post attempted for vehicle ${id} (Page post only)`);

        res.json({
          success: true,
          message: 'Facebook Graph API can only post to Pages, not Marketplace. Consider using IAI method.',
          data: { 
            method: 'api',
            status: 'page_post_only',
            limitations: [
              '⚠️ Facebook has NO public Marketplace API',
              '⚠️ Graph API can only post to Facebook Pages',
              '⚠️ Marketplace listings require browser automation (IAI)',
              '✅ Page posts can include vehicle details and photos',
              '✅ Page posts can link to your website inventory',
            ],
            recommendation: 'Use IAI method for actual Marketplace listings',
            pagePostContent: pagePostMessage,
          },
        });
        return;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`API post failed for vehicle ${id}: ${errorMessage}`);
        throw new AppError(`Facebook API error: ${errorMessage}`, 500);
      }
    }

    // Unknown method
    res.json({
      success: false,
      message: `Unknown posting method: ${method}. Use 'iai', 'api', or 'pixel'.`,
      data: { 
        availableMethods: {
          iai: 'Browser automation via Chrome Extension - RECOMMENDED for Marketplace',
          api: 'Facebook Graph API - Page posts only, no Marketplace',
          pixel: 'Conversion tracking only - Cannot create listings',
        },
      },
    });
  }

  /**
   * Get posting task status
   */
  async getPostingTaskStatus(req: AuthRequest, res: Response): Promise<void> {
    const taskId = req.params.taskId as string;

    const task = await prisma.extensionTask.findUnique({
      where: { id: taskId },
      include: {
        // vehicle: true, // If relation exists
      },
    });

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Verify access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: task.accountId,
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    res.json({
      success: true,
      data: {
        taskId: task.id,
        type: task.type,
        status: task.status,
        result: task.result,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
      },
    });
  }

  /**
   * Get pending tasks for extension
   */
  async getPendingTasks(req: AuthRequest, res: Response): Promise<void> {
    const accountId = req.query.accountId as string;

    if (!accountId) {
      throw new AppError('accountId is required', 400);
    }

    // Verify access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId,
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    const tasks = await prisma.extensionTask.findMany({
      where: {
        accountId,
        status: 'pending',
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
      take: 10,
    });

    res.json({
      success: true,
      data: tasks,
    });
  }
}
