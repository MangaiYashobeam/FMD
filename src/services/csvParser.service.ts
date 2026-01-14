import fs from 'fs';
import csv from 'csv-parser';
import { logger } from '@/utils/logger';

export interface VehicleCSVRow {
  DealerID?: string;
  DealerName?: string;
  IsNew?: string;
  VIN: string;
  Stock?: string;
  Year: string;
  Make: string;
  Model: string;
  Trim?: string;
  BodyStyle?: string;
  BodyType?: string;
  FactoryCertified?: string;
  DealerCertified?: string;
  ModelCode?: string;
  ListPrice?: string;
  SpecialPrice?: string;
  CostPrice?: string;
  SpecialPrice1?: string;
  SpecialPrice2?: string;
  Mileage?: string;
  ChromeStyleID?: string;
  FuelType?: string;
  Exteriorcolor?: string;
  Exteriorcolorcode?: string;
  Interiorcolor?: string;
  Interiorcolorcode?: string;
  Interiormaterial?: string;
  Wheelbase?: string;
  DoorCount?: string;
  EngineDisplacement?: string;
  Cylinders?: string;
  Drivetrain?: string;
  Transmission?: string;
  TransmissionType?: string;
  OptionDescription?: string;
  OptionCodes?: string;
  PhotoURL?: string;
  PhotoTimestamp?: string;
  DealerComments?: string;
  InstockDate?: string;
  LastModifiedDate?: string;
  VideoURL?: string;
  CityMPG?: string;
  HwyMPG?: string;
  ExtraField1?: string;
  ExtraField2?: string;
  ExtraField3?: string;
  VehicleID?: string;
  Address1?: string;
  City?: string;
  State?: string;
  Zip?: string;
  'Dealer Phone'?: string;
  'Dealer Email'?: string;
  WholesalePrice?: string;
  'Website URL'?: string;
  Length?: string;
  'Engine Description'?: string;
}

export interface ParsedVehicle {
  vin: string;
  dealerId?: string;
  stockNumber?: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  bodyStyle?: string;
  bodyType?: string;
  isNew: boolean;
  factoryCertified: boolean;
  dealerCertified: boolean;
  listPrice?: number;
  specialPrice?: number;
  costPrice?: number;
  wholesalePrice?: number;
  mileage?: number;
  exteriorColor?: string;
  exteriorColorCode?: string;
  interiorColor?: string;
  interiorColorCode?: string;
  interiorMaterial?: string;
  engineDescription?: string;
  engineDisplacement?: string;
  cylinders?: string;
  drivetrain?: string;
  transmission?: string;
  transmissionType?: string;
  fuelType?: string;
  cityMpg?: number;
  hwyMpg?: number;
  optionDescription?: string;
  optionCodes?: string;
  dealerComments?: string;
  videoUrl?: string;
  photoUrls: string[];
  instockDate?: Date;
  lastModifiedDate?: Date;
}

/**
 * Parse CSV file and return vehicle data
 */
export const parseCSVFile = async (filePath: string): Promise<ParsedVehicle[]> => {
  return new Promise((resolve, reject) => {
    const vehicles: ParsedVehicle[] = [];
    const errors: string[] = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row: VehicleCSVRow) => {
        try {
          const vehicle = parseVehicleRow(row);
          if (vehicle) {
            vehicles.push(vehicle);
          }
        } catch (error) {
          errors.push(`Error parsing row for VIN ${row.VIN}: ${error}`);
          logger.warn(`CSV parsing error for VIN ${row.VIN}:`, error);
        }
      })
      .on('end', () => {
        logger.info(`CSV parsing completed: ${vehicles.length} vehicles parsed, ${errors.length} errors`);
        if (errors.length > 0) {
          logger.warn('CSV parsing errors:', errors);
        }
        resolve(vehicles);
      })
      .on('error', (error) => {
        logger.error('CSV parsing failed:', error);
        reject(error);
      });
  });
};

/**
 * Parse a single CSV row into a vehicle object
 */
const parseVehicleRow = (row: VehicleCSVRow): ParsedVehicle | null => {
  // VIN is required
  if (!row.VIN || !row.Year || !row.Make || !row.Model) {
    logger.warn('Skipping row: missing required fields (VIN, Year, Make, or Model)');
    return null;
  }

  // Parse photo URLs
  const photoUrls = row.PhotoURL
    ? row.PhotoURL.split(',').map((url) => url.trim()).filter((url) => url.length > 0)
    : [];

  // Parse dates
  const instockDate = row.InstockDate ? parseDate(row.InstockDate) : undefined;
  const lastModifiedDate = row.LastModifiedDate ? parseDate(row.LastModifiedDate) : undefined;

  const vehicle: ParsedVehicle = {
    vin: sanitizeString(row.VIN) || '',
    dealerId: sanitizeString(row.DealerID),
    stockNumber: sanitizeString(row.Stock),
    year: parseInt(row.Year, 10),
    make: sanitizeString(row.Make) || '',
    model: sanitizeString(row.Model) || '',
    trim: sanitizeString(row.Trim),
    bodyStyle: sanitizeString(row.BodyStyle),
    bodyType: sanitizeString(row.BodyType),
    isNew: row.IsNew?.toLowerCase() === 'new' || row.IsNew === '1',
    factoryCertified: row.FactoryCertified === '1' || row.FactoryCertified?.toLowerCase() === 'true',
    dealerCertified: row.DealerCertified === '1' || row.DealerCertified?.toLowerCase() === 'true',
    listPrice: parsePrice(row.ListPrice),
    specialPrice: parsePrice(row.SpecialPrice),
    costPrice: parsePrice(row.CostPrice),
    wholesalePrice: parsePrice(row.WholesalePrice),
    mileage: parseNumber(row.Mileage),
    exteriorColor: sanitizeString(row.Exteriorcolor),
    exteriorColorCode: sanitizeString(row.Exteriorcolorcode),
    interiorColor: sanitizeString(row.Interiorcolor),
    interiorColorCode: sanitizeString(row.Interiorcolorcode),
    interiorMaterial: sanitizeString(row.Interiormaterial),
    engineDescription: sanitizeString(row['Engine Description']),
    engineDisplacement: sanitizeString(row.EngineDisplacement),
    cylinders: sanitizeString(row.Cylinders),
    drivetrain: sanitizeString(row.Drivetrain),
    transmission: sanitizeString(row.Transmission),
    transmissionType: sanitizeString(row.TransmissionType),
    fuelType: sanitizeString(row.FuelType),
    cityMpg: parseNumber(row.CityMPG),
    hwyMpg: parseNumber(row.HwyMPG),
    optionDescription: sanitizeString(row.OptionDescription),
    optionCodes: sanitizeString(row.OptionCodes),
    dealerComments: sanitizeString(row.DealerComments),
    videoUrl: sanitizeString(row.VideoURL),
    photoUrls,
    instockDate,
    lastModifiedDate,
  };

  return vehicle;
};

/**
 * Sanitize string input
 */
const sanitizeString = (value?: string): string | undefined => {
  if (!value || value.trim() === '') return undefined;
  return value.trim();
};

/**
 * Parse price string to number
 */
const parsePrice = (value?: string): number | undefined => {
  if (!value) return undefined;
  const cleanValue = value.replace(/[$,]/g, '');
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? undefined : parsed;
};

/**
 * Parse number string
 */
const parseNumber = (value?: string): number | undefined => {
  if (!value) return undefined;
  const cleanValue = value.replace(/,/g, '');
  const parsed = parseInt(cleanValue, 10);
  return isNaN(parsed) ? undefined : parsed;
};

/**
 * Parse date string
 */
const parseDate = (value: string): Date | undefined => {
  try {
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  } catch {
    return undefined;
  }
};

/**
 * Validate parsed vehicles
 */
export const validateVehicles = (vehicles: ParsedVehicle[]): { valid: ParsedVehicle[]; invalid: ParsedVehicle[] } => {
  const valid: ParsedVehicle[] = [];
  const invalid: ParsedVehicle[] = [];

  vehicles.forEach((vehicle) => {
    if (isValidVehicle(vehicle)) {
      valid.push(vehicle);
    } else {
      invalid.push(vehicle);
      logger.warn(`Invalid vehicle data for VIN: ${vehicle.vin}`);
    }
  });

  return { valid, invalid };
};

/**
 * Check if vehicle data is valid
 */
const isValidVehicle = (vehicle: ParsedVehicle): boolean => {
  // Basic validation
  if (!vehicle.vin || vehicle.vin.length !== 17) {
    return false;
  }

  if (!vehicle.year || vehicle.year < 1900 || vehicle.year > new Date().getFullYear() + 1) {
    return false;
  }

  if (!vehicle.make || !vehicle.model) {
    return false;
  }

  return true;
};
