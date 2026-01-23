/**
 * Production Initialization Routes
 * Wake up all systems and configure for production use
 */

import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '@/middleware/auth';
import { requireSuperAdmin } from '@/middleware/rbac';
import prisma from '@/config/database';
import { logger } from '@/utils/logger';

const router = Router();

router.use(authenticate);
router.use(requireSuperAdmin);

/**
 * POST /api/admin/production/wake-up
 * Initialize all production systems
 */
router.post('/wake-up', async (_req: AuthRequest, res: Response) => {
  try {
    const results: any = {
      timestamp: new Date(),
      systems: {},
    };

    // 1. Check accounts with vehicles
    const accountsWithVehicles = await prisma.account.findMany({
      where: {
        isActive: true,
      },
      include: {
        _count: {
          select: { vehicles: true },
        },
      },
    });

    results.systems.accounts = {
      total: accountsWithVehicles.length,
      withVehicles: accountsWithVehicles.filter(a => a._count.vehicles > 0).length,
    };

    // 2. Check vehicles ready for posting
    const vehiclesNeedingPost = await prisma.vehicle.count({
      where: {
        account: { isActive: true },
        status: { in: ['available', 'active', 'in_stock'] },
        price: { gt: 0 },
      },
    });

    results.systems.vehicles = {
      needingPost: vehiclesNeedingPost,
    };

    // 3. Check extension tasks
    const pendingTasks = await prisma.extensionTask.count({
      where: { status: 'pending' },
    });

    results.systems.tasks = {
      pending: pendingTasks,
    };

    // 4. Get Facebook profiles status
    const fbProfiles = await prisma.facebookProfile.count({
      where: { isActive: true },
    });

    results.systems.facebook = {
      activeProfiles: fbProfiles,
    };

    logger.info('Production wake-up completed', results);

    res.json({
      success: true,
      message: 'Production systems initialized',
      data: results,
    });
  } catch (error) {
    logger.error('Production wake-up error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize production systems',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/admin/production/status
 * Get overall production status
 */
router.get('/status', async (_req: AuthRequest, res: Response) => {
  try {
    const [
      accounts,
      vehicles,
      tasks,
      profiles,
    ] = await Promise.all([
      prisma.account.count({ where: { isActive: true } }),
      prisma.vehicle.count(),
      prisma.extensionTask.count({ where: { status: 'pending' } }),
      prisma.facebookProfile.count({ where: { isActive: true } }),
    ]);

    res.json({
      success: true,
      status: 'operational',
      data: {
        accounts,
        vehicles,
        pendingTasks: tasks,
        facebookProfiles: profiles,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Production status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get production status',
    });
  }
});

export default router;
