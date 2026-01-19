import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth';
import prisma from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { getSyncQueue } from '@/jobs/queueProcessor';
import { FTPService } from '@/services/ftp.service';
import { CSVParserService, ParsedVehicle } from '@/services/csvParser.service';
import { schedulerService } from '@/services/scheduler.service';
import * as XLSX from 'xlsx';
import * as xml2js from 'xml2js';

export class SyncController {
  /**
   * Trigger manual sync
   */
  async triggerSync(req: AuthRequest, res: Response) {
    let { accountId } = req.body;

    // If no accountId provided, get user's first account
    if (!accountId) {
      const userAccount = await prisma.accountUser.findFirst({
        where: { userId: req.user!.id },
        select: { accountId: true },
      });
      if (!userAccount) {
        throw new AppError('No account found for user', 404);
      }
      accountId = userAccount.accountId;
    }

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

    // Get account settings
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    // Create sync job record
    const syncJob = await prisma.syncJob.create({
      data: {
        accountId,
        status: 'PENDING',
        triggeredBy: req.user!.id,
      },
    });

    // Queue the sync job
    const queue = getSyncQueue();
    if (queue) {
      await queue.add('sync-inventory', {
        syncJobId: syncJob.id,
        accountId,
      });
    } else {
      logger.warn('Redis not available - sync job created but not queued for background processing');
    }

    logger.info(`Manual sync triggered: ${syncJob.id} for account ${accountId}`);

    res.json({
      success: true,
      data: { jobId: syncJob.id },
      message: 'Sync job queued successfully',
    });
  }

  /**
   * Get sync job status
   */
  async getStatus(req: AuthRequest, res: Response) {
    const { jobId } = req.params;

    const syncJob = await prisma.syncJob.findUnique({
      where: { id: jobId as string },
      include: {
        account: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!syncJob) {
      throw new AppError('Sync job not found', 404);
    }

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: syncJob.accountId,
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    res.json({
      success: true,
      data: syncJob,
    });
  }

  /**
   * Get sync history
   */
  async getHistory(req: AuthRequest, res: Response) {
    let accountId = req.query.accountId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // If no accountId provided, get user's first account
    if (!accountId) {
      const userAccount = await prisma.accountUser.findFirst({
        where: { userId: req.user!.id },
        select: { accountId: true },
      });
      if (!userAccount) {
        throw new AppError('No account found for user', 404);
      }
      accountId = userAccount.accountId;
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

    const [jobs, total] = await Promise.all([
      prisma.syncJob.findMany({
        where: { accountId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.syncJob.count({ where: { accountId } }),
    ]);

    res.json({
      success: true,
      data: {
        jobs,
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
   * Process sync job (called by queue worker)
   */
  static async processSyncJob(syncJobId: string) {
    try {
      const syncJob = await prisma.syncJob.findUnique({
        where: { id: syncJobId },
        include: { account: true },
      });

      if (!syncJob) {
        throw new Error('Sync job not found');
      }

      // Update status to processing
      await prisma.syncJob.update({
        where: { id: syncJobId },
        data: { status: 'PROCESSING', startedAt: new Date() },
      });

      const account = syncJob.account;

      // Connect to FTP and download CSV
      const ftpService = new FTPService();
      await ftpService.connect({
        host: account.ftpHost!,
        port: account.ftpPort!,
        username: account.ftpUsername!,
        password: account.ftpPassword!,
        path: account.csvPath!,
        protocol: 'ftp',
      });

      const tempPath = `/tmp/sync_${syncJobId}.csv`;
      const csvContent = await ftpService.downloadFile(account.csvPath!, tempPath);

      // Parse CSV
      const csvParser = new CSVParserService();
      const vehicles = await csvParser.parseCSVContent(csvContent);

      // Update database
      let imported = 0;
      let updated = 0;
      let failed = 0;

      for (const vehicleData of vehicles) {
        try {
          const existing = await prisma.vehicle.findFirst({
            where: {
              accountId: account.id,
              vin: vehicleData.vin,
            },
          });

          if (existing) {
            await prisma.vehicle.update({
              where: { id: existing.id },
              data: {
                ...vehicleData,
                source: 'FTP',
                updatedAt: new Date(),
              },
            });
            updated++;
          } else {
            await prisma.vehicle.create({
              data: {
                ...vehicleData,
                accountId: account.id,
                source: 'FTP',
              },
            });
            imported++;
          }
        } catch (error) {
          logger.error(`Failed to import vehicle ${vehicleData.vin}:`, error);
          failed++;
        }
      }

      // Update sync job
      await prisma.syncJob.update({
        where: { id: syncJobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          recordsImported: imported,
          recordsUpdated: updated,
          recordsFailed: failed,
        },
      });

      logger.info(`Sync completed: ${syncJobId} - Imported: ${imported}, Updated: ${updated}, Failed: ${failed}`);
    } catch (error: any) {
      logger.error(`Sync job failed: ${syncJobId}`, error);
      await prisma.syncJob.update({
        where: { id: syncJobId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: error.message,
        },
      });
      throw error;
    }
  }

  /**
   * Get scheduler status
   */
  async getSchedulerStatus(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const status = schedulerService.getStatus();
      res.json(status);
    } catch (error) {
      logger.error('Error getting scheduler status:', error);
      throw new AppError('Failed to get scheduler status', 500);
    }
  }

  /**
   * Upload inventory file (CSV, Excel, XML)
   */
  async uploadInventoryFile(req: AuthRequest, res: Response): Promise<void> {
    const file = req.file;
    const { accountId, skipHeader, updateExisting, markMissingSold, delimiter } = req.body;

    if (!file) {
      throw new AppError('No file uploaded', 400);
    }

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

    // Get account
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    // Create sync job record
    const syncJob = await prisma.syncJob.create({
      data: {
        accountId,
        status: 'PROCESSING',
        triggeredBy: req.user!.id,
        startedAt: new Date(),
      },
    });

    logger.info(`File upload sync started: ${syncJob.id} for account ${accountId}`);

    try {
      // Parse file based on extension
      const fileExt = file.originalname.toLowerCase().split('.').pop();
      let vehicles: ParsedVehicle[] = [];

      if (fileExt === 'csv') {
        vehicles = await this.parseCSVBuffer(file.buffer, {
          skipHeader: skipHeader === 'true',
          delimiter: delimiter || 'comma',
        });
      } else if (fileExt === 'xlsx' || fileExt === 'xls') {
        vehicles = await this.parseExcelBuffer(file.buffer);
      } else if (fileExt === 'xml') {
        vehicles = await this.parseXMLBuffer(file.buffer);
      } else {
        throw new AppError('Unsupported file format', 400);
      }

      logger.info(`Parsed ${vehicles.length} vehicles from uploaded file`);

      // Track existing VINs if markMissingSold is enabled
      let existingVINs: string[] = [];
      if (markMissingSold === 'true') {
        const existingVehicles = await prisma.vehicle.findMany({
          where: { accountId, status: { not: 'SOLD' } },
          select: { vin: true },
        });
        existingVINs = existingVehicles.map((v) => v.vin);
      }

      // Update database
      let imported = 0;
      let updated = 0;
      let failed = 0;
      const uploadedVINs: string[] = [];

      for (const vehicleData of vehicles) {
        try {
          uploadedVINs.push(vehicleData.vin);

          const existing = await prisma.vehicle.findFirst({
            where: {
              accountId,
              vin: vehicleData.vin,
            },
          });

          if (existing) {
            if (updateExisting === 'true' || updateExisting === true) {
              await prisma.vehicle.update({
                where: { id: existing.id },
                data: {
                  ...this.mapVehicleData(vehicleData),
                  source: 'UPLOAD',
                  updatedAt: new Date(),
                },
              });
              updated++;
            }
          } else {
            await prisma.vehicle.create({
              data: {
                ...this.mapVehicleData(vehicleData),
                accountId,
                source: 'UPLOAD',
              },
            });
            imported++;
          }
        } catch (error) {
          logger.error(`Failed to import vehicle ${vehicleData.vin}:`, error);
          failed++;
        }
      }

      // Mark missing vehicles as sold if enabled
      let markedSold = 0;
      if (markMissingSold === 'true') {
        const missingVINs = existingVINs.filter((vin) => !uploadedVINs.includes(vin));
        if (missingVINs.length > 0) {
          const result = await prisma.vehicle.updateMany({
            where: {
              accountId,
              vin: { in: missingVINs },
              status: { not: 'SOLD' },
            },
            data: {
              status: 'SOLD',
              updatedAt: new Date(),
            },
          });
          markedSold = result.count;
          logger.info(`Marked ${markedSold} vehicles as sold (not in upload)`);
        }
      }

      // Update sync job
      await prisma.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          recordsImported: imported,
          recordsUpdated: updated,
          recordsFailed: failed,
        },
      });

      logger.info(
        `Upload sync completed: ${syncJob.id} - Imported: ${imported}, Updated: ${updated}, Failed: ${failed}, Marked Sold: ${markedSold}`
      );

      res.json({
        success: true,
        data: {
          jobId: syncJob.id,
          imported,
          updated,
          failed,
          markedSold,
          totalProcessed: vehicles.length,
        },
        message: 'File uploaded and processed successfully',
      });
    } catch (error: any) {
      logger.error(`File upload sync failed: ${syncJob.id}`, error);
      await prisma.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: error.message,
        },
      });
      throw new AppError(error.message || 'Failed to process uploaded file', 500);
    }
  }

  /**
   * Parse CSV buffer
   */
  private async parseCSVBuffer(
    buffer: Buffer,
    _options: { skipHeader: boolean; delimiter: string }
  ): Promise<ParsedVehicle[]> {
    const content = buffer.toString('utf-8');
    // Delimiter options: comma=',', semicolon=';', tab='\t', pipe='|'
    // For now, use the standard CSV parser which handles common formats
    const csvParser = new CSVParserService();
    return csvParser.parseCSVContent(content);
  }

  /**
   * Parse Excel buffer
   */
  private async parseExcelBuffer(buffer: Buffer): Promise<ParsedVehicle[]> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<any>(worksheet);

    return data
      .map((row) => this.parseExcelRow(row))
      .filter((v): v is ParsedVehicle => v !== null);
  }

  /**
   * Parse Excel row to ParsedVehicle
   */
  private parseExcelRow(row: any): ParsedVehicle | null {
    // Map Excel columns to vehicle fields (flexible column name matching)
    const vin = row.VIN || row.vin || row['Vehicle ID'];
    const year = row.Year || row.year || row.YEAR;
    const make = row.Make || row.make || row.MAKE;
    const model = row.Model || row.model || row.MODEL;

    if (!vin || !year || !make || !model) {
      return null;
    }

    const photoUrls = row.PhotoURL || row.Photos || row.Images || '';

    return {
      vin: String(vin).trim(),
      stockNumber: row.Stock || row.StockNumber || row['Stock Number'],
      year: parseInt(String(year), 10),
      make: String(make).trim(),
      model: String(model).trim(),
      trim: row.Trim || row.trim,
      bodyStyle: row.BodyStyle || row['Body Style'],
      bodyType: row.BodyType || row['Body Type'],
      isNew: row.IsNew === 'New' || row.IsNew === '1' || row.IsNew === true,
      factoryCertified: row.FactoryCertified === '1' || row.FactoryCertified === true,
      dealerCertified: row.DealerCertified === '1' || row.DealerCertified === true,
      listPrice: this.parseNumber(row.ListPrice || row.Price || row.MSRP),
      specialPrice: this.parseNumber(row.SpecialPrice || row.SalePrice),
      mileage: this.parseNumber(row.Mileage || row.Miles || row.Odometer),
      exteriorColor: row.ExteriorColor || row['Exterior Color'] || row.Color,
      interiorColor: row.InteriorColor || row['Interior Color'],
      fuelType: row.FuelType || row['Fuel Type'],
      transmission: row.Transmission,
      drivetrain: row.Drivetrain,
      dealerComments: row.DealerComments || row.Comments || row.Description,
      photoUrls: String(photoUrls)
        .split(',')
        .map((url) => url.trim())
        .filter((url) => url.length > 0),
    };
  }

  /**
   * Parse XML buffer
   */
  private async parseXMLBuffer(buffer: Buffer): Promise<ParsedVehicle[]> {
    const content = buffer.toString('utf-8');
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(content);

    // Common XML structures for vehicle data
    const vehicles =
      result.vehicles?.vehicle ||
      result.inventory?.vehicle ||
      result.data?.vehicle ||
      result.root?.vehicle ||
      [];

    const vehicleArray = Array.isArray(vehicles) ? vehicles : [vehicles];

    return vehicleArray
      .map((v) => this.parseXMLVehicle(v))
      .filter((v): v is ParsedVehicle => v !== null);
  }

  /**
   * Parse XML vehicle node to ParsedVehicle
   */
  private parseXMLVehicle(node: any): ParsedVehicle | null {
    if (!node) return null;

    const vin = node.vin || node.VIN;
    const year = node.year || node.Year;
    const make = node.make || node.Make;
    const model = node.model || node.Model;

    if (!vin || !year || !make || !model) {
      return null;
    }

    const photoUrls = node.photos?.photo || node.images?.image || node.PhotoURL || '';
    const photoArray = Array.isArray(photoUrls)
      ? photoUrls
      : String(photoUrls)
          .split(',')
          .map((url) => url.trim())
          .filter((url) => url.length > 0);

    return {
      vin: String(vin).trim(),
      stockNumber: node.stock || node.Stock || node.stockNumber,
      year: parseInt(String(year), 10),
      make: String(make).trim(),
      model: String(model).trim(),
      trim: node.trim || node.Trim,
      bodyStyle: node.bodyStyle || node.BodyStyle,
      bodyType: node.bodyType || node.BodyType,
      isNew: node.isNew === 'New' || node.isNew === '1' || node.isNew === 'true',
      factoryCertified: node.factoryCertified === '1' || node.factoryCertified === 'true',
      dealerCertified: node.dealerCertified === '1' || node.dealerCertified === 'true',
      listPrice: this.parseNumber(node.listPrice || node.price || node.Price),
      specialPrice: this.parseNumber(node.specialPrice || node.salePrice),
      mileage: this.parseNumber(node.mileage || node.Mileage || node.miles),
      exteriorColor: node.exteriorColor || node.ExteriorColor || node.color,
      interiorColor: node.interiorColor || node.InteriorColor,
      fuelType: node.fuelType || node.FuelType,
      transmission: node.transmission || node.Transmission,
      drivetrain: node.drivetrain || node.Drivetrain,
      dealerComments: node.comments || node.description || node.DealerComments,
      photoUrls: photoArray,
    };
  }

  /**
   * Parse number from various formats
   */
  private parseNumber(value: any): number | undefined {
    if (!value) return undefined;
    const cleanValue = String(value).replace(/[$,]/g, '');
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? undefined : parsed;
  }

  /**
   * Map ParsedVehicle to database vehicle fields
   */
  private mapVehicleData(vehicle: ParsedVehicle): any {
    return {
      vin: vehicle.vin,
      stockNumber: vehicle.stockNumber,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim,
      bodyStyle: vehicle.bodyStyle,
      bodyType: vehicle.bodyType,
      isNew: vehicle.isNew,
      factoryCertified: vehicle.factoryCertified,
      dealerCertified: vehicle.dealerCertified,
      listPrice: vehicle.listPrice,
      specialPrice: vehicle.specialPrice,
      costPrice: vehicle.costPrice,
      wholesalePrice: vehicle.wholesalePrice,
      mileage: vehicle.mileage,
      exteriorColor: vehicle.exteriorColor,
      exteriorColorCode: vehicle.exteriorColorCode,
      interiorColor: vehicle.interiorColor,
      interiorColorCode: vehicle.interiorColorCode,
      interiorMaterial: vehicle.interiorMaterial,
      engineDescription: vehicle.engineDescription,
      engineDisplacement: vehicle.engineDisplacement,
      cylinders: vehicle.cylinders,
      drivetrain: vehicle.drivetrain,
      transmission: vehicle.transmission,
      transmissionType: vehicle.transmissionType,
      fuelType: vehicle.fuelType,
      cityMpg: vehicle.cityMpg,
      hwyMpg: vehicle.hwyMpg,
      optionDescription: vehicle.optionDescription,
      optionCodes: vehicle.optionCodes,
      dealerComments: vehicle.dealerComments,
      videoUrl: vehicle.videoUrl,
      photoUrls: vehicle.photoUrls,
      instockDate: vehicle.instockDate,
      lastModifiedDate: vehicle.lastModifiedDate,
    };
  }
}
