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

    // Verify user has access to account
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId,
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
}
