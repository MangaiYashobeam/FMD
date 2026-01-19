import fs from 'fs';
import { Readable } from 'stream';
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
 * Supports case-insensitive column matching
 */
const parseVehicleRow = (row: VehicleCSVRow): ParsedVehicle | null => {
  // Normalize row keys to handle case-insensitive matching
  const normalizedRow: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(row)) {
    normalizedRow[key.toLowerCase().replace(/[_\s-]/g, '')] = value as string;
  }
  
  // Helper to get value with multiple possible keys
  const getValue = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const normalizedKey = key.toLowerCase().replace(/[_\s-]/g, '');
      if (normalizedRow[normalizedKey]) {
        return normalizedRow[normalizedKey];
      }
    }
    return undefined;
  };

  // Get required fields with flexible matching
  const vin = getValue('VIN', 'vin', 'Vehicle Identification Number', 'vehicleid');
  const year = getValue('Year', 'year', 'ModelYear', 'model_year');
  const make = getValue('Make', 'make', 'Manufacturer');
  const model = getValue('Model', 'model');
  
  // VIN is required
  if (!vin || !year || !make || !model) {
    logger.warn('Skipping row: missing required fields (VIN, Year, Make, or Model)', {
      hasVin: !!vin,
      hasYear: !!year,
      hasMake: !!make,
      hasModel: !!model,
    });
    return null;
  }

  // Parse photo URLs using flexible matching
  const photoUrlStr = getValue('PhotoURL', 'Photos', 'Images', 'Photo', 'ImageURL');
  const photoUrls = photoUrlStr
    ? photoUrlStr.split(',').map((url) => url.trim()).filter((url) => url.length > 0)
    : [];

  // Parse dates using flexible matching
  const instockDateStr = getValue('InstockDate', 'InStockDate', 'DateAdded', 'AddedDate');
  const lastModifiedStr = getValue('LastModifiedDate', 'ModifiedDate', 'UpdatedDate');
  const instockDate = instockDateStr ? parseDate(instockDateStr) : undefined;
  const lastModifiedDate = lastModifiedStr ? parseDate(lastModifiedStr) : undefined;

  const vehicle: ParsedVehicle = {
    vin: sanitizeString(vin) || '',
    dealerId: sanitizeString(getValue('DealerID', 'DealerId', 'Dealer')),
    stockNumber: sanitizeString(getValue('Stock', 'StockNumber', 'Stock#', 'StockNo')),
    year: parseInt(year, 10),
    make: sanitizeString(make) || '',
    model: sanitizeString(model) || '',
    trim: sanitizeString(getValue('Trim', 'TrimLevel')),
    bodyStyle: sanitizeString(getValue('BodyStyle', 'Body Style', 'Body')),
    bodyType: sanitizeString(getValue('BodyType', 'Body Type')),
    isNew: getValue('IsNew', 'New', 'Condition')?.toLowerCase() === 'new' || getValue('IsNew') === '1',
    factoryCertified: getValue('FactoryCertified', 'Factory Certified') === '1' || getValue('FactoryCertified')?.toLowerCase() === 'true',
    dealerCertified: getValue('DealerCertified', 'Dealer Certified') === '1' || getValue('DealerCertified')?.toLowerCase() === 'true',
    listPrice: parsePrice(getValue('ListPrice', 'Price', 'MSRP', 'AskingPrice')),
    specialPrice: parsePrice(getValue('SpecialPrice', 'SalePrice', 'InternetPrice')),
    costPrice: parsePrice(getValue('CostPrice', 'Cost', 'Invoice')),
    wholesalePrice: parsePrice(getValue('WholesalePrice', 'Wholesale')),
    mileage: parseNumber(getValue('Mileage', 'Miles', 'Odometer')),
    exteriorColor: sanitizeString(getValue('Exteriorcolor', 'ExteriorColor', 'Exterior Color', 'Color')),
    exteriorColorCode: sanitizeString(getValue('Exteriorcolorcode', 'ExteriorColorCode')),
    interiorColor: sanitizeString(getValue('Interiorcolor', 'InteriorColor', 'Interior Color')),
    interiorColorCode: sanitizeString(getValue('Interiorcolorcode', 'InteriorColorCode')),
    interiorMaterial: sanitizeString(getValue('Interiormaterial', 'InteriorMaterial', 'Interior Material')),
    engineDescription: sanitizeString(getValue('Engine Description', 'EngineDescription', 'Engine')),
    engineDisplacement: sanitizeString(getValue('EngineDisplacement', 'Engine Displacement', 'Displacement')),
    cylinders: sanitizeString(getValue('Cylinders', 'Cylinder')),
    drivetrain: sanitizeString(getValue('Drivetrain', 'Drive', 'DriveType')),
    transmission: sanitizeString(getValue('Transmission', 'Trans')),
    transmissionType: sanitizeString(getValue('TransmissionType', 'Transmission Type')),
    fuelType: sanitizeString(getValue('FuelType', 'Fuel', 'Fuel Type')),
    cityMpg: parseNumber(getValue('CityMPG', 'City MPG', 'MPGCity')),
    hwyMpg: parseNumber(getValue('HwyMPG', 'Highway MPG', 'MPGHighway', 'HighwayMPG')),
    optionDescription: sanitizeString(getValue('OptionDescription', 'Options', 'Features')),
    optionCodes: sanitizeString(getValue('OptionCodes', 'Option Codes')),
    dealerComments: sanitizeString(getValue('DealerComments', 'Comments', 'Description', 'Notes')),
    videoUrl: sanitizeString(getValue('VideoURL', 'Video')),
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

export class CSVParserService {
  /**
   * Parse CSV content from string
   */
  async parseCSVContent(content: string): Promise<ParsedVehicle[]> {
    return new Promise((resolve, reject) => {
      const vehicles: ParsedVehicle[] = [];
      const stream = Readable.from([content]);

      stream
        .pipe(csv())
        .on('data', (row: VehicleCSVRow) => {
          try {
            const vehicle = parseVehicleRow(row);
            if (vehicle && isValidVehicle(vehicle)) {
              vehicles.push(vehicle);
            }
          } catch (error) {
            logger.warn('Failed to parse CSV row:', error);
          }
        })
        .on('end', () => {
          logger.info(`Parsed ${vehicles.length} vehicles from CSV content`);
          resolve(vehicles);
        })
        .on('error', reject);
    });
  }
}

