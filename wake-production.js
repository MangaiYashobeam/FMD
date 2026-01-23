#!/usr/bin/env node

/**
 * Production Wake-Up Script
 * Directly initializes PostingSettings and creates tasks
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function wakeUpProduction() {
  console.log('🚀 WAKING UP PRODUCTION SYSTEM...\n');

  try {
    // 1. Get all active accounts
    const accounts = await prisma.account.findMany({
      where: { isActive: true },
      include: {
        settings: {
          include: {
            postingSettings: true
          }
        },
        facebookProfiles: {
          where: { isActive: true }
        }
      }
    });

    console.log(`✅ Found ${accounts.length} active accounts`);

    // 2. Enable PostingSettings for each account with Facebook
    let settingsCreated = 0;
    let settingsEnabled = 0;

    for (const account of accounts) {
      if (account.facebookProfiles.length === 0) {
        console.log(`  ⏭️  Skipping ${account.name} - no Facebook profiles`);
        continue;
      }

      if (!account.settings) {
        // Create AccountSettings first
        const newSettings = await prisma.accountSettings.create({
          data: {
            accountId: account.id
          }
        });
        account.settings = newSettings;
        console.log(`  ✅ Created AccountSettings for: ${account.name}`);
      }

      if (!account.settings.postingSettings) {
        // Create PostingSettings
        await prisma.postingSettings.create({
          data: {
            accountSettingsId: account.settings.id,
            postOnMonday: true,
            postOnTuesday: true,
            postOnWednesday: true,
            postOnThursday: true,
            postOnFriday: true,
            postOnSaturday: false,
            postOnSunday: false,
            postFromHour: 9,
            postUntilHour: 17,
            postIntervalMinutes: 30,
            dailyPostLimit: 20
          }
        });
        settingsCreated++;
        console.log(`  ✅ Created PostingSettings for: ${account.name}`);
      } else {
        console.log(`  ℹ️  PostingSettings already exist for: ${account.name}`);
      }
    }

    console.log(`\n✅ Settings created: ${settingsCreated}`);
    console.log(`✅ Settings enabled: ${settingsEnabled}`);

    // 3. Create immediate tasks for vehicles without recent posts
    console.log('\n📋 Creating immediate tasks for vehicles...');

    const vehicles = await prisma.vehicle.findMany({
      where: {
        account: {
          isActive: true,
          facebookProfiles: {
            some: {
              isActive: true
            }
          }
        }
      },
      include: {
        account: {
          include: {
            facebookProfiles: {
              where: { isActive: true },
              take: 1
            }
          }
        },
        facebookPosts: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          },
          take: 1
        }
      },
      take: 50
    });

    const vehiclesWithoutRecentPosts = vehicles.filter(v => v.facebookPosts.length === 0 && v.account.facebookProfiles.length > 0);
    console.log(`Found ${vehiclesWithoutRecentPosts.length} vehicles without posts in last 24h`);

    let tasksCreated = 0;
    for (const vehicle of vehiclesWithoutRecentPosts) {
      const fbProfile = vehicle.account.facebookProfiles[0];
      
      // Check if task already exists
      const existingTask = await prisma.extensionTask.findFirst({
        where: {
          accountId: vehicle.accountId,
          vehicleId: vehicle.id,
          status: { in: ['PENDING', 'PROCESSING'] }
        }
      });

      if (!existingTask) {
        await prisma.extensionTask.create({
          data: {
            accountId: vehicle.accountId,
            vehicleId: vehicle.id,
            type: 'POST_TO_FACEBOOK',
            status: 'PENDING',
            priority: 1,
            data: {
              profileId: fbProfile.id,
              vehicleId: vehicle.id
            },
            scheduledFor: new Date()
          }
        });
        tasksCreated++;
      }
    }

    console.log(`✅ Created ${tasksCreated} immediate tasks\n`);

    // 4. Get system status
    const pendingTasks = await prisma.extensionTask.count({
      where: { status: 'PENDING' }
    });

    const settingsCount = await prisma.postingSettings.count();

    const recentPosts = await prisma.facebookPost.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });

    console.log('📊 SYSTEM STATUS:');
    console.log(`  Pending tasks: ${pendingTasks}`);
    console.log(`  Posting settings configured: ${settingsCount}`);
    console.log(`  Posts last 24h: ${recentPosts}`);
    console.log(`  Active accounts: ${accounts.length}`);

    console.log('\n🎉 PRODUCTION SYSTEM IS NOW AWAKE!\n');
    console.log('📌 Next steps:');
    console.log('  1. Extension will poll for tasks every 5-30 seconds');
    console.log('  2. AutoPost service runs every minute');
    console.log('  3. Reload extension in Chrome to pick up new code');
    console.log('  4. Check badge shows "ON" (green) when active\n');

  } catch (error) {
    console.error('❌ Error waking up production:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

wakeUpProduction()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
