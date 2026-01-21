import cron from 'node-cron';
import { logger } from '@/utils/logger';
import prisma from '@/config/database';

/**
 * AutoPost Service - Facebook Marketplace Automation
 * 
 * Mirrors Glo3D functionality:
 * - Scheduled posting based on day/hour settings
 * - Post frequency control (every X minutes)
 * - Daily limits
 * - Auto-renew listings every X days
 * - Auto-repost after expiration
 * - Price updates when inventory changes
 * 
 * How it works:
 * 1. Runs every minute to check which accounts need posting
 * 2. Creates ExtensionTask entries for vehicles that need posting
 * 3. Extension picks up tasks and executes via IAI Soldier
 * 4. Results are tracked and status updated
 */

interface PostingAccount {
  id: string;
  name: string;
  settings: {
    postingSettings: PostingSettingsConfig | null;
  } | null;
  vehicles: any[];
  _count: {
    vehicles: number;
  };
}

interface PostingSettingsConfig {
  id: string;
  postOnSunday: boolean;
  postOnMonday: boolean;
  postOnTuesday: boolean;
  postOnWednesday: boolean;
  postOnThursday: boolean;
  postOnFriday: boolean;
  postOnSaturday: boolean;
  postFromHour: number;
  postUntilHour: number;
  postIntervalMinutes: number;
  dailyPostLimit: number;
  postingPriority: string;
  includeVideos: boolean;
  videoSource: string;
  autoRenewEnabled: boolean;
  renewFrequencyDays: number;
  autoRepostEnabled: boolean;
  repostFrequencyDays: number;
  autoUpdatePrices: boolean;
  priceChangeThreshold: number;
  isActive: boolean;
  lastPostAt: Date | null;
  postsToday: number;
  totalPosts: number;
}

export class AutoPostService {
  private cronJob: cron.ScheduledTask | null = null;
  private isInitialized = false;
  private isProcessing = false;

  /**
   * Initialize the auto-post scheduler
   * Runs every minute to check for pending posts
   */
  initialize() {
    if (this.isInitialized) {
      logger.warn('AutoPost service already initialized');
      return;
    }

    logger.info('🚀 Initializing AutoPost service...');

    // Run every minute to check for pending posts
    this.cronJob = cron.schedule('* * * * *', async () => {
      await this.processAutoPost();
    });

    // Reset daily counters at midnight
    cron.schedule('0 0 * * *', async () => {
      await this.resetDailyCounters();
    });

    this.isInitialized = true;
    logger.info('✅ AutoPost service started (checks every minute)');

    // Run immediately on startup
    this.processAutoPost();
  }

  /**
   * Main auto-post processing loop
   */
  async processAutoPost() {
    if (this.isProcessing) {
      logger.debug('AutoPost already processing, skipping...');
      return;
    }

    this.isProcessing = true;

    try {
      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday
      const currentHour = now.getHours();

      logger.debug(`🔍 AutoPost check: Day ${currentDay}, Hour ${currentHour}`);

      // Get all accounts with active posting settings
      const accounts = await this.getEligibleAccounts(currentDay, currentHour);

      if (accounts.length === 0) {
        logger.debug('No accounts eligible for posting at this time');
        return;
      }

      logger.info(`📋 Found ${accounts.length} accounts eligible for auto-posting`);

      for (const account of accounts) {
        await this.processAccountPosting(account);
      }

    } catch (error) {
      logger.error('❌ AutoPost processing error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get accounts that are eligible for posting right now
   */
  private async getEligibleAccounts(currentDay: number, currentHour: number): Promise<PostingAccount[]> {
    const dayColumns = [
      'postOnSunday',
      'postOnMonday',
      'postOnTuesday',
      'postOnWednesday',
      'postOnThursday',
      'postOnFriday',
      'postOnSaturday',
    ];

    // Use raw query for day filtering since Prisma doesn't support dynamic column access
    const accounts = await prisma.account.findMany({
      where: {
        isActive: true,
        settings: {
          postingSettings: {
            isActive: true,
            postFromHour: { lte: currentHour },
            postUntilHour: { gt: currentHour },
          },
        },
      },
      include: {
        settings: {
          include: {
            postingSettings: true,
          },
        },
        vehicles: {
          where: {
            status: { in: ['IN_STOCK', 'AVAILABLE', 'ACTIVE'] },
            facebookPosts: {
              none: {
                status: 'ACTIVE',
              },
            },
          },
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { vehicles: true },
        },
      },
    });

    // Filter by day
    return accounts.filter((account) => {
      const settings = account.settings?.postingSettings;
      if (!settings) return false;

      const dayField = dayColumns[currentDay] as keyof PostingSettingsConfig;
      return settings[dayField] === true;
    }) as PostingAccount[];
  }

  /**
   * Process posting for a single account
   */
  private async processAccountPosting(account: PostingAccount) {
    const settings = account.settings?.postingSettings;
    if (!settings) return;

    logger.info(`🏢 Processing account: ${account.name}`);

    // Check if we've hit daily limit
    if (settings.dailyPostLimit > 0 && settings.postsToday >= settings.dailyPostLimit) {
      logger.info(`📊 Account ${account.name} hit daily limit (${settings.postsToday}/${settings.dailyPostLimit})`);
      return;
    }

    // Check if enough time has passed since last post
    if (settings.lastPostAt) {
      const minutesSinceLastPost = (Date.now() - settings.lastPostAt.getTime()) / (1000 * 60);
      if (minutesSinceLastPost < settings.postIntervalMinutes) {
        logger.debug(`⏳ Account ${account.name} - Next post in ${(settings.postIntervalMinutes - minutesSinceLastPost).toFixed(1)} minutes`);
        return;
      }
    }

    // Get vehicles to post
    const vehicles = await this.getVehiclesToPost(account, settings);

    if (vehicles.length === 0) {
      logger.debug(`📭 No vehicles to post for ${account.name}`);
      return;
    }

    // Create posting task for the first eligible vehicle
    const vehicle = vehicles[0];
    await this.createPostingTask(account, vehicle, settings);
  }

  /**
   * Get vehicles that need to be posted
   */
  private async getVehiclesToPost(account: PostingAccount, settings: PostingSettingsConfig) {
    const orderBy = settings.postingPriority === 'ascending' 
      ? { createdAt: 'asc' as const }
      : { createdAt: 'desc' as const };

    return prisma.vehicle.findMany({
      where: {
        accountId: account.id,
        status: { in: ['IN_STOCK', 'AVAILABLE', 'ACTIVE'] },
        // Has valid price
        price: { gt: 0 },
        // Has photos (array not empty)
        NOT: { imageUrls: { isEmpty: true } },
        // Not already posted or needs repost
        OR: [
          // Never posted
          { facebookPosts: { none: {} } },
          // Posted but needs renewal
          settings.autoRenewEnabled ? {
            facebookPosts: {
              some: {
                status: 'ACTIVE',
                postedAt: {
                  lt: new Date(Date.now() - settings.renewFrequencyDays * 24 * 60 * 60 * 1000),
                },
              },
            },
          } : {},
          // Posted but failed, retry
          {
            facebookPosts: {
              some: {
                status: 'FAILED',
                retryCount: { lt: 3 },
              },
            },
          },
        ],
      },
      orderBy,
      take: 5,
      include: {
        facebookPosts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  /**
   * Create a posting task for the extension to execute
   */
  private async createPostingTask(account: PostingAccount, vehicle: any, settings: PostingSettingsConfig) {
    try {
      // Check for existing pending task for this vehicle
      const existingTask = await prisma.extensionTask.findFirst({
        where: {
          accountId: account.id,
          vehicleId: vehicle.id,
          type: 'post_vehicle',
          status: { in: ['pending', 'processing'] },
        },
      });

      if (existingTask) {
        logger.debug(`📋 Task already exists for vehicle ${vehicle.stockNumber || vehicle.vin}`);
        return;
      }

      // Generate posting data
      const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''}`;
      const price = vehicle.price || vehicle.listPrice || vehicle.specialPrice || 0;
      
      // Create the task for Chrome extension (IAI Soldier)
      const task = await prisma.extensionTask.create({
        data: {
          accountId: account.id,
          type: 'post_vehicle',
          status: 'pending',
          priority: 5,
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
              title,
              price: Number(price),
              mileage: vehicle.mileage,
              exteriorColor: vehicle.exteriorColor,
              transmission: vehicle.transmission,
              fuelType: vehicle.fuelType,
              bodyStyle: vehicle.bodyStyle,
              description: vehicle.dealerComments || this.generateDescription(vehicle),
              photos: vehicle.imageUrls || [],
              videoUrl: settings.includeVideos ? vehicle.videoUrl : null,
            },
            settings: {
              includeVideos: settings.includeVideos,
              videoSource: settings.videoSource,
            },
          },
          scheduledFor: new Date(),
        },
      });

      // Also queue to Python workers if available (dual-mode)
      // Python workers provide headless automation when extension is not online
      try {
        const { workerQueueService } = await import('@/services/worker-queue.service');
        if (workerQueueService.isAvailable()) {
          const location = account.name || 'Miami, FL'; // Use account name as location fallback
          await workerQueueService.queueVehiclePosting(
            account.id,
            {
              year: vehicle.year,
              make: vehicle.make,
              model: vehicle.model,
              price: Number(price),
              mileage: vehicle.mileage,
              vin: vehicle.vin,
              body_style: vehicle.bodyStyle,
              fuel_type: vehicle.fuelType,
              transmission: vehicle.transmission,
              exterior_color: vehicle.exteriorColor,
              description: vehicle.dealerComments || this.generateDescription(vehicle),
              location,
            },
            vehicle.imageUrls || [],
            [] // groups - can be configured per account
          );
          logger.debug(`📤 Also queued to Python workers for ${title}`);
        }
      } catch (workerError) {
        // Python workers are optional, don't fail if not available
        logger.debug('Python worker queue not available:', workerError);
      }

      // Update posting settings
      await prisma.postingSettings.update({
        where: { id: settings.id },
        data: {
          lastPostAt: new Date(),
          postsToday: { increment: 1 },
          totalPosts: { increment: 1 },
        },
      });

      logger.info(`✅ Created posting task ${task.id} for ${title} (${account.name})`);

    } catch (error) {
      logger.error(`❌ Failed to create posting task:`, error);
    }
  }

  /**
   * Generate vehicle description
   */
  private generateDescription(vehicle: any): string {
    const parts = [
      `🚗 ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''}`,
      '',
    ];

    if (vehicle.mileage) {
      parts.push(`📍 Mileage: ${Number(vehicle.mileage).toLocaleString()} miles`);
    }

    if (vehicle.exteriorColor) {
      parts.push(`🎨 Color: ${vehicle.exteriorColor}`);
    }

    if (vehicle.transmission) {
      parts.push(`⚙️ Transmission: ${vehicle.transmission}`);
    }

    if (vehicle.fuelType) {
      parts.push(`⛽ Fuel: ${vehicle.fuelType}`);
    }

    if (vehicle.vin) {
      parts.push(`🔑 VIN: ...${vehicle.vin.slice(-6)}`);
    }

    if (vehicle.stockNumber) {
      parts.push(`📋 Stock #: ${vehicle.stockNumber}`);
    }

    parts.push('', '✅ Financing Available', '✅ Trade-ins Welcome', '', '📞 Contact us for more information!');

    return parts.join('\n');
  }

  /**
   * Reset daily counters at midnight
   */
  private async resetDailyCounters() {
    try {
      await prisma.postingSettings.updateMany({
        data: {
          postsToday: 0,
        },
      });
      logger.info('🔄 Reset daily posting counters');
    } catch (error) {
      logger.error('❌ Failed to reset daily counters:', error);
    }
  }

  /**
   * Process auto-renewals for existing listings
   */
  async processAutoRenewals() {
    try {
      const accounts = await prisma.account.findMany({
        where: {
          isActive: true,
          settings: {
            postingSettings: {
              isActive: true,
              autoRenewEnabled: true,
            },
          },
        },
        include: {
          settings: {
            include: {
              postingSettings: true,
            },
          },
        },
      });

      for (const account of accounts) {
        const settings = account.settings?.postingSettings;
        if (!settings) continue;

        const renewalThreshold = new Date(Date.now() - settings.renewFrequencyDays * 24 * 60 * 60 * 1000);

        // Find posts that need renewal
        const postsToRenew = await prisma.facebookPost.findMany({
          where: {
            profile: {
              accountId: account.id,
            },
            status: 'ACTIVE',
            postedAt: { lt: renewalThreshold },
          },
          include: {
            vehicle: true,
          },
        });

        for (const post of postsToRenew) {
          await prisma.extensionTask.create({
            data: {
              accountId: account.id,
              type: 'renew_listing',
              status: 'pending',
              vehicleId: post.vehicleId,
              data: {
                postId: post.postId,
                vehicleId: post.vehicleId,
              },
            },
          });
        }

        if (postsToRenew.length > 0) {
          logger.info(`📋 Created ${postsToRenew.length} renewal tasks for ${account.name}`);
        }
      }
    } catch (error) {
      logger.error('❌ Auto-renewal processing error:', error);
    }
  }

  /**
   * Check and update prices for existing listings
   */
  async processAutopriceUpdates() {
    try {
      const activePosts = await prisma.facebookPost.findMany({
        where: {
          status: 'ACTIVE',
        },
        include: {
          vehicle: true,
          profile: {
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
          },
        },
      });

      for (const post of activePosts) {
        const settings = post.profile.account.settings?.postingSettings;
        if (!settings?.autoUpdatePrices) continue;

        // Check if price changed significantly
        const currentPrice = Number(post.vehicle.price || 0);
        const postedPrice = (post as any).postedPrice || currentPrice; // Would need to store this
        const priceDiff = Math.abs(currentPrice - postedPrice);

        if (priceDiff >= Number(settings.priceChangeThreshold)) {
          await prisma.extensionTask.create({
            data: {
              accountId: post.profile.accountId,
              type: 'update_price',
              status: 'pending',
              vehicleId: post.vehicleId,
              data: {
                postId: post.postId,
                newPrice: currentPrice,
                oldPrice: postedPrice,
              },
            },
          });

          logger.info(`💰 Price update task created: ${post.vehicle.stockNumber} (${postedPrice} → ${currentPrice})`);
        }
      }
    } catch (error) {
      logger.error('❌ Price update processing error:', error);
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      processing: this.isProcessing,
      nextCheck: 'Every minute',
    };
  }

  /**
   * Shutdown the service
   */
  shutdown() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isInitialized = false;
    logger.info('🛑 AutoPost service stopped');
  }
}

// Export singleton instance
export const autoPostService = new AutoPostService();
