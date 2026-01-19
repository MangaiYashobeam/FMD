/**
 * Posting Settings Routes
 * 
 * API endpoints for Facebook Marketplace auto-posting configuration
 * Similar to Glo3D's settings interface
 */

import { Router, Response } from 'express';
import { body } from 'express-validator';
import { authenticate, AuthRequest } from '@/middleware/auth';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate } from '@/middleware/validation';
import prisma from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/posting/settings
 * Get posting settings for user's primary account
 */
router.get(
  '/settings',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;

    // Get user's primary account
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId },
      include: {
        account: {
          include: {
            settings: {
              include: {
                postingSettings: true,
              },
            },
          },
        },
      },
    });

    if (!accountUser) {
      throw new AppError('No account found', 404);
    }

    // Return settings or defaults
    const postingSettings = accountUser.account.settings?.postingSettings || {
      // Default settings
      postOnSunday: true,
      postOnMonday: true,
      postOnTuesday: true,
      postOnWednesday: true,
      postOnThursday: true,
      postOnFriday: true,
      postOnSaturday: true,
      postFromHour: 8,
      postUntilHour: 20,
      postIntervalMinutes: 20,
      dailyPostLimit: 0,
      postingPriority: 'descending',
      includeVideos: true,
      videoSource: 'videotour',
      autoRenewEnabled: true,
      renewFrequencyDays: 7,
      autoRepostEnabled: true,
      repostFrequencyDays: 30,
      autoUpdatePrices: true,
      priceChangeThreshold: 100,
      isActive: false,
      lastPostAt: null,
      postsToday: 0,
      totalPosts: 0,
    };

    res.json({
      success: true,
      data: {
        settings: postingSettings,
        accountId: accountUser.accountId,
        accountName: accountUser.account.name,
      },
    });
  })
);

/**
 * PUT /api/posting/settings
 * Update posting settings
 */
router.put(
  '/settings',
  validate([
    body('postOnSunday').optional().isBoolean(),
    body('postOnMonday').optional().isBoolean(),
    body('postOnTuesday').optional().isBoolean(),
    body('postOnWednesday').optional().isBoolean(),
    body('postOnThursday').optional().isBoolean(),
    body('postOnFriday').optional().isBoolean(),
    body('postOnSaturday').optional().isBoolean(),
    body('postFromHour').optional().isInt({ min: 0, max: 23 }),
    body('postUntilHour').optional().isInt({ min: 0, max: 23 }),
    body('postIntervalMinutes').optional().isInt({ min: 5, max: 120 }),
    body('dailyPostLimit').optional().isInt({ min: 0 }),
    body('postingPriority').optional().isIn(['ascending', 'descending']),
    body('includeVideos').optional().isBoolean(),
    body('videoSource').optional().isIn(['walkaround', 'videotour']),
    body('conditionTemplate').optional().isString(),
    body('postingLocation').optional().isString(),
    body('postingRadius').optional().isInt({ min: 1, max: 100 }),
    body('autoRenewEnabled').optional().isBoolean(),
    body('renewFrequencyDays').optional().isInt({ min: 1, max: 30 }),
    body('autoRepostEnabled').optional().isBoolean(),
    body('repostFrequencyDays').optional().isInt({ min: 7, max: 90 }),
    body('autoUpdatePrices').optional().isBoolean(),
    body('priceChangeThreshold').optional().isFloat({ min: 0 }),
    body('isActive').optional().isBoolean(),
  ]),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;

    // Get user's primary account
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId },
      include: {
        account: {
          include: {
            settings: true,
          },
        },
      },
    });

    if (!accountUser) {
      throw new AppError('No account found', 404);
    }

    // Check permission (only admins and owners can update settings)
    if (!['ACCOUNT_OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(accountUser.role)) {
      throw new AppError('Permission denied', 403);
    }

    // Ensure account settings exist
    let accountSettings = accountUser.account.settings;
    if (!accountSettings) {
      accountSettings = await prisma.accountSettings.create({
        data: {
          accountId: accountUser.accountId,
        },
      });
    }

    // Upsert posting settings
    const postingSettings = await prisma.postingSettings.upsert({
      where: {
        accountSettingsId: accountSettings.id,
      },
      update: {
        ...req.body,
        updatedAt: new Date(),
      },
      create: {
        accountSettingsId: accountSettings.id,
        ...req.body,
      },
    });

    logger.info(`Posting settings updated for account ${accountUser.accountId} by user ${userId}`);

    res.json({
      success: true,
      data: {
        settings: postingSettings,
      },
      message: 'Posting settings updated successfully',
    });
  })
);

/**
 * GET /api/posting/status
 * Get current posting status and stats
 */
router.get(
  '/status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;

    const accountUser = await prisma.accountUser.findFirst({
      where: { userId },
    });

    if (!accountUser) {
      throw new AppError('No account found', 404);
    }

    // Get stats
    const [
      totalVehicles,
      postedVehicles,
      pendingTasks,
      recentPosts,
    ] = await Promise.all([
      prisma.vehicle.count({
        where: {
          accountId: accountUser.accountId,
          status: { in: ['IN_STOCK', 'AVAILABLE', 'ACTIVE'] },
        },
      }),
      prisma.facebookPost.count({
        where: {
          profile: { accountId: accountUser.accountId },
          status: 'ACTIVE',
        },
      }),
      prisma.extensionTask.count({
        where: {
          accountId: accountUser.accountId,
          type: 'post_vehicle',
          status: 'pending',
        },
      }),
      prisma.facebookPost.findMany({
        where: {
          profile: { accountId: accountUser.accountId },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          vehicle: {
            select: {
              year: true,
              make: true,
              model: true,
              stockNumber: true,
            },
          },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalVehicles,
          postedVehicles,
          unpostedVehicles: totalVehicles - postedVehicles,
          pendingTasks,
        },
        recentPosts: recentPosts.map((post) => ({
          id: post.id,
          vehicle: `${post.vehicle.year} ${post.vehicle.make} ${post.vehicle.model}`,
          stockNumber: post.vehicle.stockNumber,
          status: post.status,
          postedAt: post.postedAt,
          postUrl: post.postUrl,
        })),
      },
    });
  })
);

/**
 * POST /api/posting/trigger
 * Manually trigger posting for a specific vehicle or next in queue
 */
router.post(
  '/trigger',
  validate([
    body('vehicleId').optional().isUUID(),
  ]),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { vehicleId } = req.body;

    const accountUser = await prisma.accountUser.findFirst({
      where: { userId },
    });

    if (!accountUser) {
      throw new AppError('No account found', 404);
    }

    let vehicle;

    if (vehicleId) {
      // Post specific vehicle
      vehicle = await prisma.vehicle.findFirst({
        where: {
          id: vehicleId,
          accountId: accountUser.accountId,
        },
      });

      if (!vehicle) {
        throw new AppError('Vehicle not found', 404);
      }
    } else {
      // Get next vehicle to post
      vehicle = await prisma.vehicle.findFirst({
        where: {
          accountId: accountUser.accountId,
          status: { in: ['IN_STOCK', 'AVAILABLE', 'ACTIVE'] },
          price: { gt: 0 },
          facebookPosts: {
            none: {
              status: 'ACTIVE',
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!vehicle) {
        throw new AppError('No vehicles available to post', 404);
      }
    }

    // Create posting task
    const task = await prisma.extensionTask.create({
      data: {
        accountId: accountUser.accountId,
        type: 'post_vehicle',
        status: 'pending',
        priority: 10, // High priority for manual trigger
        vehicleId: vehicle.id,
        data: {
          vehicle: {
            id: vehicle.id,
            vin: vehicle.vin,
            stockNumber: vehicle.stockNumber,
            year: vehicle.year,
            make: vehicle.make,
            model: vehicle.model,
            trim: vehicle.trim,
            title: `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''}`,
            price: Number(vehicle.price || vehicle.listPrice || 0),
            mileage: vehicle.mileage,
            exteriorColor: vehicle.exteriorColor,
            transmission: vehicle.transmission,
            fuelType: vehicle.fuelType,
            bodyStyle: vehicle.bodyStyle,
            description: vehicle.dealerComments,
            photos: vehicle.imageUrls || [],
          },
          triggeredBy: userId,
          manual: true,
        },
      },
    });

    logger.info(`Manual posting triggered for vehicle ${vehicle.stockNumber || vehicle.vin} by user ${userId}`);

    res.json({
      success: true,
      data: {
        taskId: task.id,
        vehicle: {
          id: vehicle.id,
          title: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          stockNumber: vehicle.stockNumber,
        },
      },
      message: 'Posting task created. The extension will process it shortly.',
    });
  })
);

/**
 * POST /api/posting/pause
 * Pause auto-posting
 */
router.post(
  '/pause',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;

    const accountUser = await prisma.accountUser.findFirst({
      where: { userId },
      include: {
        account: {
          include: {
            settings: true,
          },
        },
      },
    });

    if (!accountUser?.account.settings) {
      throw new AppError('No settings found', 404);
    }

    await prisma.postingSettings.update({
      where: {
        accountSettingsId: accountUser.account.settings.id,
      },
      data: {
        isActive: false,
      },
    });

    logger.info(`Auto-posting paused for account ${accountUser.accountId}`);

    res.json({
      success: true,
      message: 'Auto-posting paused',
    });
  })
);

/**
 * POST /api/posting/resume
 * Resume auto-posting
 */
router.post(
  '/resume',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;

    const accountUser = await prisma.accountUser.findFirst({
      where: { userId },
      include: {
        account: {
          include: {
            settings: true,
          },
        },
      },
    });

    if (!accountUser?.account.settings) {
      throw new AppError('No settings found', 404);
    }

    await prisma.postingSettings.update({
      where: {
        accountSettingsId: accountUser.account.settings.id,
      },
      data: {
        isActive: true,
      },
    });

    logger.info(`Auto-posting resumed for account ${accountUser.accountId}`);

    res.json({
      success: true,
      message: 'Auto-posting resumed',
    });
  })
);

export default router;
