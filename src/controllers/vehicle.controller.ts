import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth';
import prisma from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { FTPService } from '@/services/ftp.service';
import { CSVParserService } from '@/services/csvParser.service';
import { getRedisConnection } from '@/config/redis';
import { FBMPostLogService } from '@/routes/fbm-posts.routes';

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
   * - Soldier: Server-side headless browser automation
   * - API: Facebook Graph API (requires Business verification)
   * Plus optional Facebook Pixel tracking for retargeting
   */
  async postToFacebook(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { title, price, description, photos, method, includePixelTracking } = req.body;

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

    // Build comprehensive vehicle data for Facebook Marketplace posting
    const vehicleData = {
      // Basic info
      title: title || `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ' ' + vehicle.trim : ''}`,
      price: price || Number(vehicle.price) || 0,
      description: description || vehicle.description || '',
      photos: photos || vehicle.imageUrls || [],
      
      // Required Marketplace fields
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim,
      mileage: vehicle.mileage,
      vin: vehicle.vin,
      condition: vehicle.isNew ? 'new' : 'used',
      
      // Transmission & Drivetrain
      transmission: vehicle.transmission || vehicle.transmissionType,
      transmissionType: vehicle.transmissionType,
      drivetrain: vehicle.drivetrain,
      
      // Engine
      fuelType: vehicle.fuelType,
      engineDescription: vehicle.engineDescription,
      engineDisplacement: vehicle.engineDisplacement,
      cylinders: vehicle.cylinders,
      
      // Colors
      exteriorColor: vehicle.exteriorColor,
      interiorColor: vehicle.interiorColor,
      
      // Body
      bodyType: vehicle.bodyType,
      bodyStyle: vehicle.bodyStyle,
      
      // Facebook Marketplace specific fields
      titleStatus: (vehicle as any).titleStatus || 'clean',
      numberOfDoors: (vehicle as any).numberOfDoors,
      numberOfSeats: (vehicle as any).numberOfSeats,
      vehicleType: (vehicle as any).vehicleType || 'car_truck',
      sellerType: (vehicle as any).sellerType || 'dealer',
      
      // Additional info
      stockNumber: vehicle.stockNumber,
      cityMpg: vehicle.cityMpg,
      hwyMpg: vehicle.hwyMpg,
      factoryCertified: vehicle.factoryCertified,
      dealerCertified: vehicle.dealerCertified,
    };

    // Helper function to create pixel event for tracking
    const createPixelEvent = async () => {
      if (!includePixelTracking) return null;
      
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

      // Store pixel event in database for metrics tracking
      try {
        await prisma.pixelEvent.create({
          data: {
            accountId: vehicle.accountId,
            vehicleId: vehicle.id,
            eventType: 'InitiateCheckout',
            eventId: pixelEventData.eventId,
            eventData: pixelEventData as any,
            source: 'marketplace_post',
          },
        });
        logger.info(`Pixel event recorded for vehicle ${id}: ${pixelEventData.eventId}`);
      } catch (e) {
        // Table may not exist yet, log and continue
        logger.warn(`Pixel event storage failed (table may not exist): ${e}`);
      }

      return pixelEventData;
    };

    // =====================================================
    // METHOD 1: IAI (Browser Automation via Chrome Extension)
    // =====================================================
    if (method === 'iai') {
      // Create FBM Post Log entry for tracking
      let fbmLog: any = null;
      try {
        fbmLog = await FBMPostLogService.createLog({
          accountId: vehicle.accountId,
          vehicleId: vehicle.id,
          userId: req.user!.id,
          method: 'iai',
          triggerType: 'manual',
          vehicleData: vehicleData,
          requestData: { title, price, description, photos, method, includePixelTracking },
        });
        logger.info(`FBM Post Log created: ${fbmLog.id} for vehicle ${id}`);
        // Notify AI about post initiation
        await FBMPostLogService.notifyAI(fbmLog.id, 'post_initiated');
      } catch (logError) {
        // Log error but don't block the post
        logger.error(`Failed to create FBM Post Log: ${logError}`);
      }

      // Create pixel event if enabled
      const pixelEvent = await createPixelEvent();

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
            pixelTracking: includePixelTracking ? pixelEvent : null,
            fbmLogId: fbmLog?.id,  // Include log ID for status updates
            instructions: {
              navigateTo: 'marketplace_create_vehicle',
              fillForm: true,
              uploadPhotos: true,
              submit: false, // Require manual review before publish
            },
          },
        },
      });

      // Update FBM log with task ID
      if (fbmLog) {
        try {
          await FBMPostLogService.updateLog(fbmLog.id, {
            status: 'queued',
            stage: 'task_created',
            extensionTaskId: task.id,
          });
        } catch (e) {
          logger.error(`Failed to update FBM log with task ID: ${e}`);
        }
      }

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

      logger.info(`IAI task created for vehicle ${id}: ${task.id}${includePixelTracking ? ' (with pixel tracking)' : ''}`);

      res.json({
        success: true,
        message: 'Task queued for IAI Soldier. Open Facebook in Chrome with extension active.',
        data: { 
          taskId: task.id, 
          fbmLogId: fbmLog?.id,
          method: 'iai',
          status: 'pending',
          pixelTracking: includePixelTracking,
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
    // METHOD 2: SOLDIER WORKERS (Server-side Headless Browser)
    // =====================================================
    if (method === 'soldier') {
      // Create FBM Post Log entry for tracking
      let fbmLog: any = null;
      try {
        fbmLog = await FBMPostLogService.createLog({
          accountId: vehicle.accountId,
          vehicleId: vehicle.id,
          userId: req.user!.id,
          method: 'soldier',
          triggerType: 'manual',
          vehicleData: vehicleData,
          requestData: { title, price, description, photos, method, includePixelTracking },
        });
        logger.info(`FBM Post Log created: ${fbmLog.id} for vehicle ${id} (soldier method)`);
        // Notify AI about post initiation
        await FBMPostLogService.notifyAI(fbmLog.id, 'post_initiated');
      } catch (logError) {
        // Log error but don't block the post
        logger.error(`Failed to create FBM Post Log: ${logError}`);
      }

      // Create pixel event if enabled
      const pixelEvent = await createPixelEvent();

      // Queue task for Python Soldier Workers (headless Playwright browsers)
      try {
        // Create task in database for tracking
        const task = await prisma.extensionTask.create({
          data: {
            accountId: vehicle.accountId,
            type: 'SOLDIER_POST_TO_MARKETPLACE',
            status: 'pending',
            priority: 5,
            vehicleId: vehicle.id,
            data: {
              action: 'soldier_create_listing',
              vehicle: vehicleData,
              pixelTracking: includePixelTracking ? pixelEvent : null,
              fbmLogId: fbmLog?.id,  // Include log ID for status updates
              targetPlatform: 'facebook_marketplace',
              useHeadlessBrowser: true,
              workerType: 'soldier',
              instructions: {
                navigateTo: 'marketplace_create_vehicle',
                fillForm: true,
                uploadPhotos: true,
                handleCaptcha: true,
                submit: false, // Require manual approval setting
              },
            },
          },
        });

        // Update FBM log with task ID
        if (fbmLog) {
          try {
            await FBMPostLogService.updateLog(fbmLog.id, {
              status: 'queued',
              stage: 'task_created',
              extensionTaskId: task.id,
            });
          } catch (e) {
            logger.error(`Failed to update FBM log with task ID: ${e}`);
          }
        }

        // Push to Redis queue for Soldier Workers to pick up
        const redisQueue = getRedisConnection();
        if (redisQueue) {
          await redisQueue.lpush('fmd:tasks:soldier:pending', JSON.stringify({
            taskId: task.id,
            fbmLogId: fbmLog?.id,  // Include log ID for status updates from worker
            type: 'POST_TO_MARKETPLACE',
            accountId: vehicle.accountId,
            vehicleId: vehicle.id,
            vehicle: vehicleData,
            createdAt: new Date().toISOString(),
            priority: 5,
          }));
          
          // Update log to processing status
          if (fbmLog) {
            await FBMPostLogService.updateLog(fbmLog.id, {
              status: 'queued',
              stage: 'task_created',
              queuedAt: new Date(),
            });
          }
        } else {
          logger.warn('Redis not available - Soldier Worker task created but not queued');
          if (fbmLog) {
            await FBMPostLogService.updateLog(fbmLog.id, {
              riskLevel: 'high',
              riskFactors: [{ message: 'Redis not available - task may not be processed', severity: 'high' }],
            });
          }
        }

        // Create a pending Facebook post record
        const fbProfile = vehicle.account.facebookProfiles?.[0];
        if (fbProfile) {
          await prisma.facebookPost.create({
            data: {
              vehicleId: vehicle.id,
              profileId: fbProfile.id,
              status: 'queued_soldier',
              message: vehicleData.description,
            },
          });
        }

        logger.info(`Soldier Worker task created for vehicle ${id}: ${task.id}${includePixelTracking ? ' (with pixel tracking)' : ''}`);

        res.json({
          success: true,
          message: 'Task queued for Soldier Worker. Your listing will be processed automatically.',
          data: { 
            taskId: task.id,
            fbmLogId: fbmLog?.id,
            method: 'soldier',
            status: 'queued',
            pixelTracking: includePixelTracking,
            estimatedProcessingTime: '1-5 minutes',
            features: [
              '🤖 Fully automated headless browser posting',
              '🔒 Secure server-side processing',
              '📸 Automatic photo upload',
              '🛡️ Anti-detection measures',
              '⚡ No browser extension required',
            ],
            instructions: [
              'Your listing is being processed by our Soldier Workers',
              'You will receive a notification when complete',
              'Check the posting status in Settings > Posting History',
            ],
          },
        });
        return;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Soldier Worker post failed for vehicle ${id}: ${errorMessage}`);
        
        // Log the failure
        if (fbmLog) {
          try {
            await FBMPostLogService.updateLog(fbmLog.id, {
              status: 'failed',
              stage: 'task_created',
              errorCode: 'SOLDIER_INIT_ERROR',
              errorMessage: errorMessage,
              errorDetails: { stack: error instanceof Error ? error.stack : null },
              completedAt: new Date(),
            });
          } catch (e) {
            logger.error(`Failed to update FBM log with error: ${e}`);
          }
        }
        
        throw new AppError(`Soldier Worker error: ${errorMessage}`, 500);
      }
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
      message: `Unknown posting method: ${method}. Use 'iai', 'api', or 'soldier'.`,
      data: { 
        availableMethods: {
          iai: 'Browser automation via Chrome Extension - RECOMMENDED for Marketplace',
          soldier: 'Headless browser automation via Soldier Workers - Server-side processing',
          api: 'Facebook Graph API - Page posts only, no Marketplace',
        },
        note: 'Facebook Pixel tracking is an optional addon, not a posting method.',
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

  /**
   * Refresh vehicle data from FTP/CSV source
   * Fetches the latest CSV file and updates this specific vehicle with current data
   */
  async refreshFromSource(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;

    // Get the vehicle with account info
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: id as string },
      include: { account: true },
    });

    if (!vehicle) {
      throw new AppError('Vehicle not found', 404);
    }

    // Verify access
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

    const account = vehicle.account;

    // Check if account has FTP configured
    if (!account.ftpHost || !account.ftpUsername || !account.csvPath) {
      throw new AppError('FTP/CSV source not configured for this account', 400);
    }

    try {
      // Connect to FTP and download CSV
      const ftpService = new FTPService();
      await ftpService.connect({
        host: account.ftpHost,
        port: account.ftpPort || 21,
        username: account.ftpUsername,
        password: account.ftpPassword || '',
        path: account.csvPath,
        protocol: 'ftp',
      });

      const tempPath = `/tmp/refresh_${vehicle.id}_${Date.now()}.csv`;
      await ftpService.downloadFile(account.csvPath, tempPath);
      
      // Read the file content
      const fs = await import('fs');
      const csvContent = fs.readFileSync(tempPath, 'utf-8');

      // Parse CSV
      const csvParser = new CSVParserService();
      const vehicles = await csvParser.parseCSVContent(csvContent);

      // Find this specific vehicle by VIN
      const matchingVehicle = vehicles.find(v => v.vin === vehicle.vin);

      if (!matchingVehicle) {
        throw new AppError('Vehicle not found in CSV source. It may have been removed from inventory.', 404);
      }

      // Update the vehicle with fresh data from CSV
      const updated = await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          // Price fields
          price: matchingVehicle.listPrice || matchingVehicle.specialPrice || vehicle.price,
          listPrice: matchingVehicle.listPrice,
          specialPrice: matchingVehicle.specialPrice,
          costPrice: matchingVehicle.costPrice,
          wholesalePrice: matchingVehicle.wholesalePrice,
          // Other updatable fields
          mileage: matchingVehicle.mileage || vehicle.mileage,
          description: matchingVehicle.dealerComments || vehicle.description,
          imageUrls: matchingVehicle.photoUrls?.length ? matchingVehicle.photoUrls : vehicle.imageUrls,
          exteriorColor: matchingVehicle.exteriorColor || vehicle.exteriorColor,
          interiorColor: matchingVehicle.interiorColor || vehicle.interiorColor,
          transmission: matchingVehicle.transmission || vehicle.transmission,
          fuelType: matchingVehicle.fuelType || vehicle.fuelType,
          drivetrain: matchingVehicle.drivetrain || vehicle.drivetrain,
          engineDescription: matchingVehicle.engineDescription || vehicle.engineDescription,
          // Metadata
          lastModifiedDate: matchingVehicle.lastModifiedDate || new Date(),
          updatedAt: new Date(),
        },
      });

      // Cleanup temp file
      try {
        fs.unlinkSync(tempPath);
      } catch {}

      // Close FTP connection
      ftpService.disconnect();

      logger.info(`Vehicle ${vehicle.id} refreshed from CSV source by user ${req.user!.id}`);

      res.json({
        success: true,
        data: updated,
        message: 'Vehicle data refreshed from CSV source',
      });
    } catch (error: any) {
      logger.error(`Failed to refresh vehicle ${id} from source:`, error);
      throw new AppError(error.message || 'Failed to refresh from source', 500);
    }
  }
}
