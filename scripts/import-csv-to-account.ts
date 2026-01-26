/**
 * Script to import CSV inventory to a specific account
 * Usage: npx tsx scripts/import-csv-to-account.ts <csvFilePath> <accountId>
 */

import fs from 'fs';
import csv from 'csv-parser';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

interface CSVRow {
  VIN: string;
  Stock: string;
  Year: string;
  Make: string;
  Model: string;
  Trim: string;
  BodyStyle: string;
  BodyType: string;
  IsNew: string;
  FactoryCertified: string;
  DealerCertified: string;
  ListPrice: string;
  SpecialPrice: string;
  CostPrice: string;
  WholesalePrice: string;
  Mileage: string;
  Exteriorcolor: string;
  Exteriorcolorcode: string;
  Interiorcolor: string;
  Interiorcolorcode: string;
  Interiormaterial: string;
  FuelType: string;
  Transmission: string;
  TransmissionType: string;
  Drivetrain: string;
  EngineDisplacement: string;
  Cylinders: string;
  CityMPG: string;
  HwyMPG: string;
  DealerComments: string;
  PhotoURL: string;
  VideoURL: string;
  'Engine Description': string;
  [key: string]: string;
}

function parseNumber(value: string | undefined): number | null {
  if (!value || value.trim() === '') return null;
  const cleaned = value.replace(/[$,]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'new';
}

async function importCSV(csvPath: string, accountId: string) {
  console.log(`📥 Importing CSV from: ${csvPath}`);
  console.log(`📦 Target account: ${accountId}`);

  // Verify account exists
  const account = await prisma.account.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }

  console.log(`✅ Account found: ${account.name}`);

  const vehicles: any[] = [];

  // Parse CSV
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row: CSVRow) => {
        const vin = row.VIN?.trim();
        const year = parseInt(row.Year, 10);
        const make = row.Make?.trim();
        const model = row.Model?.trim();

        if (!vin || !year || !make || !model) {
          console.log(`⚠️ Skipping row - missing required fields: VIN=${vin}, Year=${year}, Make=${make}, Model=${model}`);
          return;
        }

        // Parse photo URLs
        const photoUrls = row.PhotoURL
          ? row.PhotoURL.split(',').map((url: string) => url.trim()).filter((url: string) => url.length > 0)
          : [];

        vehicles.push({
          id: uuidv4(),
          accountId,
          vin,
          stockNumber: row.Stock?.trim() || null,
          year,
          make,
          model,
          trim: row.Trim?.trim() || null,
          bodyStyle: row.BodyStyle?.trim() || null,
          bodyType: row.BodyType?.trim() || null,
          isNew: parseBoolean(row.IsNew),
          factoryCertified: parseBoolean(row.FactoryCertified),
          dealerCertified: parseBoolean(row.DealerCertified),
          price: parseNumber(row.ListPrice) || parseNumber(row.SpecialPrice),
          listPrice: parseNumber(row.ListPrice),
          specialPrice: parseNumber(row.SpecialPrice),
          costPrice: parseNumber(row.CostPrice),
          wholesalePrice: parseNumber(row.WholesalePrice),
          mileage: parseNumber(row.Mileage) ? parseInt(row.Mileage, 10) : null,
          exteriorColor: row.Exteriorcolor?.trim() || null,
          exteriorColorCode: row.Exteriorcolorcode?.trim() || null,
          interiorColor: row.Interiorcolor?.trim() || null,
          interiorColorCode: row.Interiorcolorcode?.trim() || null,
          interiorMaterial: row.Interiormaterial?.trim() || null,
          fuelType: row.FuelType?.trim() || null,
          transmission: row.Transmission?.trim() || null,
          transmissionType: row.TransmissionType?.trim() || null,
          drivetrain: row.Drivetrain?.trim() || null,
          engineDisplacement: row.EngineDisplacement?.trim() || null,
          cylinders: row.Cylinders?.trim() || null,
          engineDescription: row['Engine Description']?.trim() || null,
          cityMpg: parseNumber(row.CityMPG) ? parseInt(row.CityMPG, 10) : null,
          hwyMpg: parseNumber(row.HwyMPG) ? parseInt(row.HwyMPG, 10) : null,
          description: row.DealerComments || null,
          dealerComments: row.DealerComments || null,
          videoUrl: row.VideoURL?.trim() || null,
          imageUrls: photoUrls,
          source: 'UPLOAD',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      })
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`📊 Parsed ${vehicles.length} vehicles from CSV`);

  // Insert vehicles
  let imported = 0;
  let updated = 0;
  let failed = 0;

  for (const vehicle of vehicles) {
    try {
      // Check if vehicle already exists
      const existing = await prisma.vehicle.findFirst({
        where: {
          accountId,
          vin: vehicle.vin,
        },
      });

      if (existing) {
        // Update existing
        await prisma.vehicle.update({
          where: { id: existing.id },
          data: {
            ...vehicle,
            id: existing.id,
            updatedAt: new Date(),
          },
        });
        updated++;
        console.log(`📝 Updated: ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.vin})`);
      } else {
        // Create new
        await prisma.vehicle.create({
          data: vehicle,
        });
        imported++;
        console.log(`✅ Imported: ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.vin})`);
      }
    } catch (error: any) {
      failed++;
      console.error(`❌ Failed: ${vehicle.vin} - ${error.message}`);
    }
  }

  console.log(`\n📊 Import Summary:`);
  console.log(`   Imported: ${imported}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total: ${vehicles.length}`);
}

// Main execution
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: npx tsx scripts/import-csv-to-account.ts <csvFilePath> <accountId>');
  process.exit(1);
}

const [csvPath, accountId] = args;

importCSV(csvPath, accountId)
  .then(() => {
    console.log('\n✅ Import complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
