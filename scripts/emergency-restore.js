// Emergency Database Restore Script
const bcrypt = require('./node_modules/bcryptjs');
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function restoreData() {
  console.log('🔄 Starting emergency database restore...');

  try {
    // Create password hash
    const passwordHash = await bcrypt.hash('Admin123!', 10);

    // 1. Create main account
    console.log('📦 Creating account...');
    const account = await prisma.account.create({
      data: {
        id: 'd285d16f-6318-412e-81ef-dcd45fe09a73', // Keep same ID
        name: 'GAD Productions',
        dealershipName: 'GAD Productions',
        subscriptionStatus: 'active',
        isActive: true,
      }
    });
    console.log('✅ Account created:', account.id);

    // 2. Create admin user
    console.log('👤 Creating admin user...');
    const adminUser = await prisma.user.create({
      data: {
        id: '63ae6e9d-76e6-495a-9907-7a1e16dba467', // Keep same ID
        email: 'admin@gadproductions.com',
        passwordHash: passwordHash,
        firstName: 'Admin',
        lastName: 'User',
        isActive: true,
        emailVerified: true,
      }
    });
    console.log('✅ Admin user created:', adminUser.email);

    // 3. Link user to account as super admin
    console.log('🔗 Linking user to account...');
    await prisma.accountUser.create({
      data: {
        accountId: account.id,
        userId: adminUser.id,
        role: 'SUPER_ADMIN',
        isPrimary: true,
      }
    });
    console.log('✅ User linked as SUPER_ADMIN');

    // 4. Create subscription plans
    console.log('📋 Creating subscription plans...');
    await prisma.subscriptionPlan.createMany({
      data: [
        {
          id: 'plan_free',
          name: 'Free Trial',
          description: '14-day free trial with basic features',
          priceMonthly: 0,
          priceYearly: 0,
          features: JSON.stringify(['5 vehicles', 'Basic posting', 'Email support']),
          maxVehicles: 5,
          maxPosts: 10,
          maxAccounts: 1,
          isActive: true,
        },
        {
          id: 'plan_starter',
          name: 'Starter',
          description: 'For small dealerships',
          priceMonthly: 49.99,
          priceYearly: 499,
          features: JSON.stringify(['25 vehicles', 'Unlimited posting', 'Priority support', 'Analytics']),
          maxVehicles: 25,
          maxPosts: 100,
          maxAccounts: 1,
          isActive: true,
        },
        {
          id: 'plan_professional',
          name: 'Professional',
          description: 'For growing dealerships',
          priceMonthly: 99.99,
          priceYearly: 999,
          features: JSON.stringify(['100 vehicles', 'Unlimited posting', '24/7 support', 'Advanced analytics', 'Team access']),
          maxVehicles: 100,
          maxPosts: -1,
          maxAccounts: 5,
          isActive: true,
        },
        {
          id: 'plan_enterprise',
          name: 'Enterprise',
          description: 'For large dealership groups',
          priceMonthly: 299.99,
          priceYearly: 2999,
          features: JSON.stringify(['Unlimited vehicles', 'Unlimited posting', 'Dedicated support', 'Custom integrations', 'White label']),
          maxVehicles: -1,
          maxPosts: -1,
          maxAccounts: -1,
          isActive: true,
        },
      ],
      skipDuplicates: true,
    });
    console.log('✅ Subscription plans created');

    // 5. Create sample vehicles
    console.log('🚗 Creating sample vehicles...');
    const vehicles = [
      {
        stockNumber: 'STK001',
        vin: '1HGCM82633A123456',
        year: 2024,
        make: 'Toyota',
        model: 'Camry',
        trim: 'XSE',
        price: 32999,
        mileage: 5000,
        exteriorColor: 'White',
        interiorColor: 'Black',
        transmission: 'Automatic',
        drivetrain: 'FWD',
        fuelType: 'Gasoline',
        engine: '2.5L 4-Cylinder',
        description: 'Beautiful 2024 Toyota Camry XSE with low miles!',
        status: 'available',
        isPosted: false,
        accountId: account.id,
      },
      {
        stockNumber: 'STK002',
        vin: '5YJSA1E26MF123456',
        year: 2023,
        make: 'Tesla',
        model: 'Model S',
        trim: 'Plaid',
        price: 89999,
        mileage: 12000,
        exteriorColor: 'Red',
        interiorColor: 'White',
        transmission: 'Automatic',
        drivetrain: 'AWD',
        fuelType: 'Electric',
        engine: 'Tri Motor',
        description: 'Stunning Tesla Model S Plaid - 0-60 in 1.99 seconds!',
        status: 'available',
        isPosted: false,
        accountId: account.id,
      },
      {
        stockNumber: 'STK003',
        vin: 'WVWZZZ3CZWE123456',
        year: 2024,
        make: 'Volkswagen',
        model: 'ID.4',
        trim: 'Pro S Plus',
        price: 52999,
        mileage: 2500,
        exteriorColor: 'Blue',
        interiorColor: 'Gray',
        transmission: 'Automatic',
        drivetrain: 'AWD',
        fuelType: 'Electric',
        engine: 'Dual Motor',
        description: 'Family-friendly electric SUV with great range!',
        status: 'available',
        isPosted: false,
        accountId: account.id,
      },
    ];

    for (const vehicle of vehicles) {
      await prisma.vehicle.create({ data: vehicle });
    }
    console.log('✅ Sample vehicles created');

    console.log('\n' + '='.repeat(60));
    console.log('🎉 DATABASE RESTORE COMPLETE!');
    console.log('='.repeat(60));
    console.log('\n📝 Login Credentials:');
    console.log('   Email: admin@gadproductions.com');
    console.log('   Password: Admin123!');
    console.log('\n💡 Account ID:', account.id);
    console.log('💡 User ID:', adminUser.id);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error restoring database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

restoreData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
