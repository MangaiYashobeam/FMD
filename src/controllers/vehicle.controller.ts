import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth';
import prisma from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { FTPService } from '@/services/ftp.service';
import { CSVParserService } from '@/services/csvParser.service';
import { getRedisConnection } from '@/config/redis';
import { FBMPostLogService } from '@/routes/fbm-posts.routes';
import { injectionService, InjectionPattern } from '@/services/injection.service';

/**
 * Helper to check if account has active session for Facebook posting
 * Returns session info if available, null otherwise
 */
async function getActiveSession(accountId: string) {
  // First check for FbSession (new session-based auth)
  const fbSession = await prisma.fbSession.findFirst({
    where: {
      accountId,
      sessionStatus: 'ACTIVE',
    },
    orderBy: { lastValidatedAt: 'desc' },
  });

  if (fbSession) {
    return {
      type: 'session' as const,
      id: fbSession.id,
      facebookUserId: fbSession.fbUserId,
      facebookUserName: fbSession.fbUserName,
      hasTotp: await prisma.fbTotpSecret.findFirst({
        where: { accountId, isVerified: true },
        select: { id: true },
      }) !== null,
    };
  }

  // Fall back to legacy FacebookProfile (deprecated)
  const fbProfile = await prisma.facebookProfile.findFirst({
    where: {
      accountId,
      isActive: true,
    },
    select: {
      id: true,
      facebookUserId: true,
      facebookUserName: true,
      accessToken: true,
      tokenExpiresAt: true,
    },
  });

  if (fbProfile && fbProfile.accessToken) {
    // Check token expiry
    if (fbProfile.tokenExpiresAt && new Date(fbProfile.tokenExpiresAt) > new Date()) {
      logger.warn(`Account ${accountId} using deprecated FacebookProfile auth - migrate to session-based auth`);
      return {
        type: 'profile' as const,
        id: fbProfile.id,
        facebookUserId: fbProfile.facebookUserId,
        facebookUserName: fbProfile.facebookUserName,
        deprecated: true,
      };
    }
  }

  return null;
}

export class VehicleController {
  /**
   * Get all vehicles for account
   * If no accountId is provided, auto-detect from user's primary account
   * Supports optional status filter (e.g., ?status=ACTIVE)
   */
  async getVehicles(req: AuthRequest, res: Response) {
    let accountId = req.query.accountId as string;
    const status = req.query.status as string | undefined; // Optional status filter (ACTIVE, SOLD, etc.)
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    // If no accountId provided, get user's first/primary account
    if (!accountId) {
      const userAccount = await prisma.accountUser.findFirst({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'asc' }, // Get the first/oldest account
        select: { accountId: true },
      });
      
      if (!userAccount) {
        throw new AppError('No account associated with this user', 404);
      }
      
      accountId = userAccount.accountId;
      logger.info(`Auto-detected accountId ${accountId} for user ${req.user!.id}`);
    }

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

    // Build where clause - support optional status filter
    // Normalize status to lowercase for case-insensitive matching
    const whereClause: { accountId: string; status?: string } = { accountId };
    if (status) {
      whereClause.status = status.toLowerCase();
    }

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where: whereClause,
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
      prisma.vehicle.count({ where: whereClause }),
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
   * SECURITY: Uses explicit field allowlist to prevent mass assignment attacks
   */
  async updateVehicle(req: AuthRequest, res: Response) {
    const { id } = req.params;
    
    // SECURITY: Explicit field allowlist - prevents mass assignment of sensitive fields
    const ALLOWED_UPDATE_FIELDS = [
      'vin', 'stockNumber', 'year', 'make', 'model', 'trim', 'bodyType',
      'extColor', 'intColor', 'mileage', 'price', 'costPrice', 'marketPrice',
      'description', 'features', 'photos', 'status', 'condition',
      'engine', 'transmission', 'drivetrain', 'fuelType', 'mpgCity', 'mpgHighway',
      'doors', 'passengers', 'titleStatus', 'warranty', 'carfaxUrl',
      'marketplaceNotes', 'internalNotes', 'priority', 'tags',
      'scheduledPostDate', 'lastPostedAt', 'postingStatus',
    ] as const;
    
    // Filter to only allowed fields
    const updates: Record<string, unknown> = {};
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }
    
    // SECURITY: Warn if client tried to update disallowed fields
    const attemptedFields = Object.keys(req.body);
    const disallowedFields = attemptedFields.filter(f => 
      !ALLOWED_UPDATE_FIELDS.includes(f as typeof ALLOWED_UPDATE_FIELDS[number]) && 
      f !== 'updatedAt'
    );
    if (disallowedFields.length > 0) {
      logger.warn('Vehicle update: Attempted to update disallowed fields', {
        vehicleId: id,
        userId: req.user!.id,
        disallowedFields,
      });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: id as string },
    });

    if (!vehicle) {
      throw new AppError('Vehicle not found', 404);
    }

    // Verify user has access (SUPER_ADMIN has access to all accounts)
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        OR: [
          { role: 'SUPER_ADMIN' },
          { accountId: vehicle.accountId, role: { in: ['ACCOUNT_OWNER', 'ADMIN', 'SALES_REP'] } },
        ],
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

    // Verify user has access (SUPER_ADMIN has access to all accounts)
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        OR: [
          { role: 'SUPER_ADMIN' },
          { accountId: vehicle.accountId, role: { in: ['ACCOUNT_OWNER', 'ADMIN'] } },
        ],
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

    // Verify user has access (SUPER_ADMIN has access to all accounts)
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        OR: [
          { role: 'SUPER_ADMIN' },
          { accountId, role: { in: ['ACCOUNT_OWNER', 'ADMIN', 'SALES_REP'] } },
        ],
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
   * - IAI: Browser automation through Chrome extension (uses browser session)
   * - Soldier: Server-side headless browser automation (uses synced session cookies)
   * - API: Facebook Graph API (DEPRECATED - no Marketplace API exists)
   * Plus optional Facebook Pixel tracking for retargeting
   */
  async postToFacebook(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { title, price, description, photos, method, ultraSpeed, includePixelTracking } = req.body;

    // Get the vehicle with account
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: id as string },
      include: { 
        account: true,
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
    // Uses browser's logged-in Facebook session (captured cookies)
    // =====================================================
    if (method === 'iai') {
      // Check if account has an active session for posting
      const activeSession = await getActiveSession(vehicle.accountId);
      
      if (!activeSession) {
        res.json({
          success: false,
          message: 'No active Facebook session. Please capture a session via the Chrome extension.',
          data: {
            method: 'iai',
            status: 'no_session',
            instructions: [
              '1. Install the Dealers Face Chrome extension',
              '2. Log into Facebook in Chrome',
              '3. Click the extension icon and select "Capture Session"',
              '4. Return here to post your vehicle',
            ],
          },
        });
        return;
      }

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

      // =====================================================
      // IAI HOT-SWAP PATTERN SELECTION SYSTEM
      // Ultra Speed Mode: Select from USM container only
      // Normal Mode: Select from all available patterns
      // =====================================================
      let selectedPattern: InjectionPattern | null = null;
      let patternName = 'FBM-Official-P1'; // Default fallback
      let containerId: string | null = null;
      let containerName: string | null = null;

      if (ultraSpeed) {
        // Ultra Speed Mode - Hot-swap from USM container exclusively
        logger.info(`[IAI] Ultra Speed Mode activated for vehicle ${id} - selecting from USM container`);
        // Try standard selection first
        let usmPattern: InjectionPattern | null = null;
        let usmContainer: any = null;
        
        const usmResult = await injectionService.selectUSMPattern();
        if (usmResult.pattern) {
          usmPattern = usmResult.pattern;
          usmContainer = usmResult.container;
        } else {
          // RECOVERY: If USM selection failed, try explicit lookup of the V1 Gemini3 pattern
          logger.warn(`[IAI] Standard USM selection failed, attempting direct lookup for 'FBM-UltraSPEED v1 Gemini3'`);
          const explicitPattern = await injectionService.getPatternByName('FBM-UltraSPEED v1 Gemini3');
          if (explicitPattern) {
            usmPattern = explicitPattern;
            usmContainer = await injectionService.getContainer(explicitPattern.containerId, false);
            logger.info(`[IAI] Recovered USM pattern via direct lookup: ${explicitPattern.name}`);
          }
        }
        
        if (usmPattern) {
          selectedPattern = usmPattern;
          patternName = usmPattern.name;
          containerId = usmContainer?.id || null;
          containerName = 'IAI Soldiers USM';
          logger.info(`[IAI] USM Hot-swap selected: ${patternName} (container: ${containerName})`);
        } else {
          // Fallback to default if USM patterns unavailable
          logger.error(`[IAI] CRITICAL: No USM patterns available anywhere. Using FBM-Official-P1 fallback.`);
          patternName = 'FBM-Official-P1';
          
          // Try to get P1 object to ensure consistent state
          const p1Pattern = await injectionService.getPatternByName('FBM-Official-P1');
          if (p1Pattern) {
            selectedPattern = p1Pattern;
            containerId = p1Pattern.containerId;
          }
        }
      } else {
        // Normal Mode - Hot-swap from all available patterns using weighted random
        logger.info(`[IAI] Normal mode for vehicle ${id} - hot-swap from all patterns`);
        const { patterns } = await injectionService.listPatterns({ isActive: true });
        
        if (patterns.length > 0) {
          // Weighted random selection based on successCount
          const weightedPatterns = patterns.map(p => ({
            pattern: p,
            calculatedWeight: Math.max(1, p.weight + (p.successCount * 10) - (p.failureCount * 5))
          }));
          
          const totalWeight = weightedPatterns.reduce((sum, wp) => sum + wp.calculatedWeight, 0);
          let random = Math.random() * totalWeight;
          
          for (const wp of weightedPatterns) {
            random -= wp.calculatedWeight;
            if (random <= 0) {
              selectedPattern = wp.pattern;
              patternName = wp.pattern.name;
              containerId = wp.pattern.containerId;
              break;
            }
          }
          
          // Fallback to first pattern if selection fails
          if (!selectedPattern && patterns.length > 0) {
            selectedPattern = patterns[0];
            patternName = patterns[0].name;
            containerId = patterns[0].containerId;
          }
          
          logger.info(`[IAI] Hot-swap selected: ${patternName} (weight: ${selectedPattern?.weight || 0}, success: ${selectedPattern?.successCount || 0})`);
        }
      }

      // Get pattern code for the extension
      const patternCode = selectedPattern?.code || null;
      const patternMetadata = selectedPattern?.metadata || {};

      const task = await prisma.extensionTask.create({
        data: {
          accountId: vehicle.accountId,
          type: 'POST_TO_MARKETPLACE',
          status: 'pending',
          priority: ultraSpeed ? 10 : 5, // Higher priority for ultra speed
          vehicleId: vehicle.id,
          data: {
            action: 'create_listing',
            vehicle: vehicleData,
            pixelTracking: includePixelTracking ? pixelEvent : null,
            fbmLogId: fbmLog?.id,  // Include log ID for status updates
            ultraSpeed: ultraSpeed || false, // Ultra Speed flag for extension
            patternName: patternName, // Pattern to load
            patternId: selectedPattern?.id || null,
            containerId: containerId,
            containerName: containerName || 'default',
            patternCode: patternCode, // Include full pattern code for extension
            patternMetadata: patternMetadata,
            hotSwapInfo: {
              enabled: true,
              mode: ultraSpeed ? 'usm' : 'normal',
              selectedAt: new Date().toISOString(),
              patternWeight: selectedPattern?.weight || 100,
              patternSuccessCount: selectedPattern?.successCount || 0,
            },
            sessionInfo: {
              type: activeSession.type,
              facebookUserId: activeSession.facebookUserId,
              facebookUserName: activeSession.facebookUserName,
            },
            instructions: {
              navigateTo: 'marketplace_create_vehicle',
              fillForm: true,
              uploadPhotos: true,
              submit: false, // Require manual review before publish
              useUltraSpeed: ultraSpeed || false,
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

      // Create a pending Facebook post record (using session's FB user as reference)
      try {
        // Get or create a minimal profile reference for post tracking
        const profileId = activeSession.type === 'profile' ? activeSession.id : null;
        
        if (profileId) {
          await prisma.facebookPost.create({
            data: {
              vehicleId: vehicle.id,
              profileId: profileId,
              status: 'pending',
              message: vehicleData.description,
            },
          });
        }
      } catch (postErr) {
        logger.warn(`Could not create Facebook post record: ${postErr}`);
      }

      logger.info(`IAI task created for vehicle ${id}: ${task.id}${includePixelTracking ? ' (with pixel tracking)' : ''}${ultraSpeed ? ' (ULTRA SPEED)' : ''} - Pattern: ${patternName}`);

      res.json({
        success: true,
        message: ultraSpeed 
          ? `Task queued with ULTRA SPEED (${patternName}). Open Facebook in Chrome with extension active.`
          : `Task queued for IAI Soldier (${patternName}). Open Facebook in Chrome with extension active.`,
        data: { 
          taskId: task.id, 
          fbmLogId: fbmLog?.id,
          method: 'iai',
          status: 'pending',
          pixelTracking: includePixelTracking,
          ultraSpeed: ultraSpeed || false,
          // Hot-swap pattern info
          patternName: patternName,
          patternId: selectedPattern?.id || null,
          containerId: containerId,
          containerName: containerName || 'default',
          hotSwap: {
            enabled: true,
            mode: ultraSpeed ? 'usm' : 'normal',
            container: ultraSpeed ? 'IAI Soldiers USM' : 'all',
          },
          sessionInfo: {
            facebookUserId: activeSession.facebookUserId,
            facebookUserName: activeSession.facebookUserName,
            hasTotp: activeSession.type === 'session' ? activeSession.hasTotp : false,
          },
          instructions: ultraSpeed ? [
            '⚡ ULTRA SPEED MODE ACTIVE',
            `📦 Pattern: ${patternName} (from USM container)`,
            '1. Ensure Chrome Extension is installed and logged in',
            '2. Open Facebook.com in the same browser',
            '3. The IAI Soldier will execute with 3x faster delays',
            '4. Your browser fingerprint enables faster posting',
          ] : [
            `📦 Hot-swap selected: ${patternName}`,
            '1. Ensure Chrome Extension is installed and logged in',
            '2. Open Facebook.com in the same browser (logged in as ' + (activeSession.facebookUserName || activeSession.facebookUserId) + ')',
            '3. The IAI Soldier will automatically detect and execute the task',
            '4. Review the listing before publishing',
          ],
        },
      });
      return;
    }

    // =====================================================
    // METHOD 2: SOLDIER WORKERS (Server-side Headless Browser)
    // Uses session cookies synced from Chrome extension
    // =====================================================
    if (method === 'soldier') {
      // Check if account has an active session for posting
      const activeSession = await getActiveSession(vehicle.accountId);
      
      if (!activeSession) {
        res.json({
          success: false,
          message: 'No active Facebook session. Please capture a session via the Chrome extension first.',
          data: {
            method: 'soldier',
            status: 'no_session',
            instructions: [
              '1. Install the Dealers Face Chrome extension',
              '2. Log into Facebook in Chrome',
              '3. Click the extension icon and select "Capture Session"',
              '4. Session cookies will be synced for Soldier Workers',
              '5. Return here to post your vehicle',
            ],
          },
        });
        return;
      }

      // For soldier workers, also check if we have TOTP for recovery
      const hasTotp = activeSession.type === 'session' ? activeSession.hasTotp : false;
      if (!hasTotp) {
        logger.warn(`Account ${vehicle.accountId} using Soldier without 2FA - session recovery may fail`);
      }

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
              sessionInfo: {
                type: activeSession.type,
                sessionId: activeSession.type === 'session' ? activeSession.id : null,
                facebookUserId: activeSession.facebookUserId,
                facebookUserName: activeSession.facebookUserName,
                hasTotp: hasTotp,
              },
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
            // Session info for workers to fetch from API
            sessionInfo: {
              type: activeSession.type,
              sessionId: activeSession.type === 'session' ? activeSession.id : null,
              facebookUserId: activeSession.facebookUserId,
              hasTotp: hasTotp,
            },
          }));
          
          // Update log to processing status
          if (fbmLog) {
            await FBMPostLogService.updateLog(fbmLog.id, {
              status: 'queued',
              stage: 'task_created',
              queuedAt: new Date(),
            });
          }

          // Register a "Stealth Soldier" in IAI Command Center for visibility
          try {
            // Get next soldier number with STEALTH prefix
            const lastStealthSoldier = await prisma.iAISoldier.findFirst({
              where: { genre: 'STEALTH' },
              orderBy: { soldierNumber: 'desc' },
            });
            const nextStealthNumber = (lastStealthSoldier?.soldierNumber || 0) + 1;

            const stealthSoldier = await prisma.iAISoldier.create({
              data: {
                soldierId: `STEALTH-${nextStealthNumber}`,
                soldierNumber: nextStealthNumber,
                accountId: vehicle.accountId,
                userId: req.user?.id || null,
                // v2.3.0 Classification - Stealth Soldier
                genre: 'STEALTH',
                executionSource: 'CHROMIUM',
                mode: 'STEALTH',
                missionProfile: 'STEALTH_POST',
                // Status
                status: 'WORKING',
                currentTaskType: 'POST_TO_MARKETPLACE',
                lastHeartbeatAt: new Date(),
                sessionStartAt: new Date(),
                totalSessions: 1,
                // Task info
                extensionVersion: 'server-worker',
              },
            });

            // Log the birth
            await prisma.iAIActivityLog.create({
              data: {
                soldierId: stealthSoldier.id,
                accountId: vehicle.accountId,
                eventType: 'status_change',
                message: `🥷 Stealth Soldier ${stealthSoldier.soldierId} deployed for vehicle ${vehicleData.title || vehicle.id}`,
                eventData: {
                  taskId: task.id,
                  vehicleId: vehicle.id,
                  method: 'soldier',
                  facebookUserId: activeSession.facebookUserId,
                },
              },
            });

            logger.info(`Stealth Soldier ${stealthSoldier.soldierId} registered for task ${task.id}`);
          } catch (soldierErr) {
            logger.warn(`Could not register Stealth Soldier: ${soldierErr}`);
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

        // Create a pending Facebook post record if we have a profile reference
        try {
          const profileId = activeSession.type === 'profile' ? activeSession.id : null;
          if (profileId) {
            await prisma.facebookPost.create({
              data: {
                vehicleId: vehicle.id,
                profileId: profileId,
                status: 'queued_soldier',
                message: vehicleData.description,
              },
            });
          }
        } catch (postErr) {
          logger.warn(`Could not create Facebook post record: ${postErr}`);
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
            sessionInfo: {
              facebookUserId: activeSession.facebookUserId,
              facebookUserName: activeSession.facebookUserName,
              hasTotp: hasTotp,
            },
            features: [
              '🤖 Fully automated headless browser posting',
              '🔒 Secure server-side processing using your synced session',
              '📸 Automatic photo upload',
              '🛡️ Anti-detection measures',
              hasTotp ? '🔐 2FA enabled for automatic session recovery' : '⚠️ No 2FA - manual recovery if session expires',
            ],
            instructions: [
              'Your listing is being processed by our Soldier Workers',
              `Using Facebook session for: ${activeSession.facebookUserName || activeSession.facebookUserId}`,
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
    // METHOD 3: PUPPETEER (IAI Stealth Soldiers - Headless Chromium)
    // Server-side automation with random hot-swap patterns
    // Maximum stealth for headless browsers that lack user fingerprints
    // =====================================================
    if (method === 'puppeteer') {
      // Check if account has an active session for posting
      const activeSession = await getActiveSession(vehicle.accountId);
      
      if (!activeSession) {
        res.json({
          success: false,
          message: 'No active Facebook session. Please capture a session via the Chrome extension first.',
          data: {
            method: 'puppeteer',
            status: 'no_session',
            instructions: [
              '1. Install the Dealers Face Chrome extension',
              '2. Log into Facebook in Chrome',
              '3. Click the extension icon and select "Capture Session"',
              '4. Session cookies will be synced for IAI Stealth Soldiers',
              '5. Return here to post your vehicle',
            ],
          },
        });
        return;
      }

      // For puppeteer soldiers, TOTP is recommended for recovery
      const hasTotp = activeSession.type === 'session' ? activeSession.hasTotp : false;
      if (!hasTotp) {
        logger.warn(`Account ${vehicle.accountId} using Puppeteer without 2FA - session recovery may fail`);
      }

      // Create FBM Post Log entry for tracking
      let fbmLog: any = null;
      try {
        fbmLog = await FBMPostLogService.createLog({
          accountId: vehicle.accountId,
          vehicleId: vehicle.id,
          userId: req.user!.id,
          method: 'soldier', // Log as soldier type (headless)
          triggerType: 'manual',
          vehicleData: vehicleData,
          requestData: { title, price, description, photos, method: 'puppeteer', includePixelTracking },
        });
        logger.info(`FBM Post Log created: ${fbmLog.id} for vehicle ${id} (puppeteer/stealth soldier method)`);
        await FBMPostLogService.notifyAI(fbmLog.id, 'post_initiated');
      } catch (logError) {
        logger.error(`Failed to create FBM Post Log: ${logError}`);
      }

      // Create pixel event if enabled
      const pixelEvent = await createPixelEvent();

      // =====================================================
      // HOT-SWAP PATTERN SYSTEM FOR STEALTH SOLDIERS
      // Random pattern selection is CRUCIAL for headless browsers
      // They need more variation as they lack user fingerprints/history
      // =====================================================
      let selectedPattern: InjectionPattern | null = null;
      let patternSource = 'fallback';
      
      try {
        // Use injection service for pattern selection
        // Get active patterns from containers with FBM-related patterns
        const { patterns: activePatterns } = await injectionService.listPatterns({
          limit: 100,
          isActive: true,
        });

        // Filter for FBM/Marketplace patterns
        const fbmPatterns = activePatterns.filter((p: InjectionPattern) => 
          p.name.toLowerCase().includes('fbm') ||
          p.name.toLowerCase().includes('marketplace') ||
          p.name.toLowerCase().includes('official') ||
          p.tags?.includes('verified') ||
          p.tags?.includes('production')
        );

        if (fbmPatterns.length > 0) {
          // Weighted random selection - prefer patterns with higher success
          const totalWeight = fbmPatterns.reduce((sum: number, p: InjectionPattern) => sum + (p.successCount + 1), 0);
          let random = Math.random() * totalWeight;
          
          for (const pattern of fbmPatterns) {
            random -= (pattern.successCount + 1);
            if (random <= 0) {
              selectedPattern = pattern;
              patternSource = 'hot-swap';
              break;
            }
          }
          
          // Fallback to first if random selection failed
          if (!selectedPattern) {
            selectedPattern = fbmPatterns[0];
            patternSource = 'first-available';
          }

          if (selectedPattern) {
            logger.info(`[PUPPETEER HOT-SWAP] Selected pattern: ${selectedPattern.name} (${selectedPattern.id}) from ${fbmPatterns.length} available patterns`);
          }
        } else if (activePatterns.length > 0) {
          // No FBM-specific patterns, try to find Official-P1
          const officialPattern = activePatterns.find((p: InjectionPattern) => 
            p.name.toLowerCase().includes('official-p1')
          );
          if (officialPattern) {
            selectedPattern = officialPattern;
            patternSource = 'official-fallback';
            logger.info(`[PUPPETEER] Using Official-P1 pattern: ${selectedPattern.name}`);
          } else {
            // Use first available active pattern
            selectedPattern = activePatterns[0];
            patternSource = 'any-active';
            logger.warn(`[PUPPETEER] No FBM patterns found, using first available: ${selectedPattern.name}`);
          }
        } else {
          logger.warn(`[PUPPETEER] No patterns found at all`);
          patternSource = 'none';
        }
      } catch (patternError) {
        logger.error(`[PUPPETEER] Pattern fetch failed: ${patternError}`);
        patternSource = 'error-fallback';
      }

      try {
        // Get workflow from pattern metadata if available
        const patternWorkflow = selectedPattern?.metadata?.workflow || selectedPattern?.code || null;
        const patternStepCount = Array.isArray(patternWorkflow) ? patternWorkflow.length : 0;

        // Create task in database for tracking
        const task = await prisma.extensionTask.create({
          data: {
            accountId: vehicle.accountId,
            type: 'PUPPETEER_POST_TO_MARKETPLACE',
            status: 'pending',
            priority: 8, // Higher priority for stealth soldiers
            vehicleId: vehicle.id,
            data: {
              action: 'stealth_soldier_create_listing',
              vehicle: vehicleData,
              pixelTracking: includePixelTracking ? pixelEvent : null,
              fbmLogId: fbmLog?.id,
              targetPlatform: 'facebook_marketplace',
              useHeadlessBrowser: true,
              workerType: 'puppeteer_stealth',
              // Hot-swap pattern info
              patternId: selectedPattern?.id || null,
              patternName: selectedPattern?.name || 'FBM-Official-P1',
              patternSource: patternSource,
              patternCode: selectedPattern?.code || null, // The actual pattern code/workflow
              patternStepCount: patternStepCount,
              sessionInfo: {
                type: activeSession.type,
                sessionId: activeSession.type === 'session' ? activeSession.id : null,
                facebookUserId: activeSession.facebookUserId,
                facebookUserName: activeSession.facebookUserName,
                hasTotp: hasTotp,
              },
              stealthConfig: {
                randomDelays: true,
                humanLikeTyping: true,
                mouseMovement: true,
                viewportJitter: true,
                cookieWarming: true,
              },
              instructions: {
                navigateTo: 'marketplace_create_vehicle',
                fillForm: true,
                uploadPhotos: true,
                handleCaptcha: true,
                submit: false, // Require approval
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

        // Push to Redis queue for Puppeteer Workers to pick up
        const redisQueue = getRedisConnection();
        if (redisQueue) {
          await redisQueue.lpush('fmd:tasks:puppeteer:pending', JSON.stringify({
            taskId: task.id,
            fbmLogId: fbmLog?.id,
            type: 'PUPPETEER_POST_TO_MARKETPLACE',
            accountId: vehicle.accountId,
            vehicleId: vehicle.id,
            vehicle: vehicleData,
            createdAt: new Date().toISOString(),
            priority: 8,
            // Pattern hot-swap info for worker
            patternId: selectedPattern?.id,
            patternName: selectedPattern?.name || 'FBM-Official-P1',
            patternCode: selectedPattern?.code, // The pattern code to execute
            patternStepCount: patternStepCount,
            // Session info for workers to fetch cookies
            sessionInfo: {
              type: activeSession.type,
              sessionId: activeSession.type === 'session' ? activeSession.id : null,
              facebookUserId: activeSession.facebookUserId,
              hasTotp: hasTotp,
            },
          }));
          
          logger.info(`[PUPPETEER] Task queued to Redis: ${task.id} with pattern: ${selectedPattern?.name || 'FBM-Official-P1'}`);
        } else {
          logger.warn('[PUPPETEER] Redis not available - task created but not queued');
          if (fbmLog) {
            await FBMPostLogService.updateLog(fbmLog.id, {
              riskLevel: 'medium',
              riskFactors: [{ message: 'Redis not available - task may not be processed automatically', severity: 'medium' }],
            });
          }
        }

        // Track pattern usage - just log, don't update totalExecutions as updatePattern doesn't support it
        if (selectedPattern?.id) {
          logger.info(`[PUPPETEER] Pattern ${selectedPattern.name} selected for use (total executions: ${selectedPattern.totalExecutions})`);
        }

        logger.info(`[PUPPETEER STEALTH SOLDIER] Task created for vehicle ${id}: ${task.id} using pattern: ${selectedPattern?.name || 'FBM-Official-P1'} (source: ${patternSource})`);

        res.json({
          success: true,
          message: 'Task queued for IAI Stealth Soldier. Server-side Chromium will execute automatically.',
          data: { 
            taskId: task.id,
            fbmLogId: fbmLog?.id,
            method: 'puppeteer',
            status: 'queued',
            pixelTracking: includePixelTracking,
            // Hot-swap pattern info
            pattern: {
              id: selectedPattern?.id,
              name: selectedPattern?.name || 'FBM-Official-P1',
              source: patternSource,
              stepCount: patternStepCount,
            },
            estimatedProcessingTime: '2-5 minutes',
            sessionInfo: {
              facebookUserId: activeSession.facebookUserId,
              facebookUserName: activeSession.facebookUserName,
              hasTotp: hasTotp,
            },
            features: [
              '🥷 IAI Stealth Soldier - Maximum stealth mode',
              '🔄 Hot-swap pattern: ' + (selectedPattern?.name || 'FBM-Official-P1'),
              '🎭 Puppeteer-stealth with anti-detection',
              '🖥️ Fully server-side - no browser required',
              '🔒 Secure green route API',
              hasTotp ? '🔐 2FA enabled for session recovery' : '⚠️ No 2FA - manual recovery if session expires',
            ],
            instructions: [
              '✅ Task submitted to IAI Stealth Soldiers',
              `🔄 Using hot-swap pattern: ${selectedPattern?.name || 'FBM-Official-P1'}`,
              'Server-side Chromium will execute the posting workflow',
              'Check posting status in Settings > Posting History',
            ],
          },
        });
        return;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`[PUPPETEER] Stealth Soldier post failed for vehicle ${id}: ${errorMessage}`);
        
        if (fbmLog) {
          try {
            await FBMPostLogService.updateLog(fbmLog.id, {
              status: 'failed',
              stage: 'task_created',
              errorCode: 'PUPPETEER_INIT_ERROR',
              errorMessage: errorMessage,
              errorDetails: { stack: error instanceof Error ? error.stack : null },
              completedAt: new Date(),
            });
          } catch (e) {
            logger.error(`Failed to update FBM log with error: ${e}`);
          }
        }
        
        throw new AppError(`IAI Stealth Soldier error: ${errorMessage}`, 500);
      }
    }

    // =====================================================
    // METHOD 4: API (Facebook Graph API - DEPRECATED)
    // ⚠️ DEPRECATED: Facebook does NOT have a public Marketplace API
    // This method is kept for historical reference only
    // =====================================================
    if (method === 'api') {
      // IMPORTANT: Facebook does NOT have a public Marketplace API
      // The Graph API can only post to Pages, not Marketplace
      // This method is deprecated in favor of session-based IAI/Soldier methods
      
      res.json({
        success: false,
        message: 'The API posting method is deprecated. Facebook does not have a public Marketplace API.',
        data: { 
          method: 'api',
          status: 'deprecated',
          deprecationNotice: true,
          limitations: [
            '❌ Facebook has NO public Marketplace API',
            '❌ Graph API can only post to Facebook Pages, NOT Marketplace',
            '❌ OAuth tokens cannot be used for Marketplace listings',
          ],
          recommendation: {
            method: 'iai',
            reason: 'Use IAI or Soldier method for Marketplace listings',
            description: 'These methods use browser session cookies to automate posting directly to Marketplace',
          },
          migration: {
            step1: 'Capture your Facebook session via the Chrome extension',
            step2: 'Enable 2FA for automatic session recovery (optional but recommended)',
            step3: 'Use method="iai" or method="soldier" when posting vehicles',
          },
        },
      });
      return;
    }

    // Unknown method
    res.json({
      success: false,
      message: `Unknown posting method: ${method}. Use 'iai', 'soldier', or 'puppeteer'.`,
      data: { 
        availableMethods: {
          iai: 'Browser automation via Chrome Extension - Uses your logged-in browser session. Supports Ultra Speed mode.',
          soldier: 'Headless Playwright automation via Soldier Workers - Uses synced session cookies.',
          puppeteer: 'IAI Stealth Soldiers (Headless Chromium) - Maximum stealth with hot-swap patterns.',
        },
        deprecatedMethods: {
          api: 'DEPRECATED - Facebook does not have a public Marketplace API',
        },
        recommended: 'puppeteer',
        note: 'All methods require capturing a Facebook session via the Chrome extension first.',
        sessionSetup: [
          '1. Install the Dealers Face Chrome extension',
          '2. Log into Facebook in Chrome',
          '3. Click the extension icon and select "Capture Session"',
          '4. (Optional) Enable 2FA for automatic session recovery',
        ],
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

    // Verify access - check for SUPER_ADMIN first (has access to all accounts), then account-level roles
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        OR: [
          { role: 'SUPER_ADMIN' }, // Super admin has access to all accounts
          { 
            accountId: vehicle.accountId,
            role: { in: ['ACCOUNT_OWNER', 'ADMIN', 'SALES_REP'] },
          },
        ],
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
