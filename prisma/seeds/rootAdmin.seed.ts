import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Root Admin Seed
 * Creates the system owner/super admin account for GAD Productions
 * 
 * Credentials:
 * - Email: admin@gadproductions.com
 * - Password: GadAdmin2026!Temp (MUST BE CHANGED ON FIRST LOGIN)
 */

async function seedRootAdmin() {
  console.log('🔐 Creating root admin user...\n');

  const adminEmail = 'admin@gadproductions.com';
  const tempPassword = 'GadAdmin2026!Temp';
  const accountName = 'GAD Productions - System Management';

  // Check if admin already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: adminEmail },
    include: {
      accountUsers: {
        include: { account: true },
      },
    },
  });

  if (existingUser) {
    console.log('✅ Root admin already exists:');
    console.log(`   - Email: ${existingUser.email}`);
    console.log(`   - User ID: ${existingUser.id}`);
    console.log(`   - Name: ${existingUser.firstName} ${existingUser.lastName}`);
    
    const superAdminRole = existingUser.accountUsers.find(
      au => au.role === 'SUPER_ADMIN'
    );
    
    if (superAdminRole) {
      console.log(`   - Role: SUPER_ADMIN ✓`);
      console.log(`   - Account: ${superAdminRole.account.name}`);
    } else {
      console.log('   ⚠️  User exists but does not have SUPER_ADMIN role');
      console.log('   Updating role...');
      
      // Create system account if needed and assign SUPER_ADMIN role
      let systemAccount = await prisma.account.findFirst({
        where: { name: accountName },
      });

      if (!systemAccount) {
        systemAccount = await prisma.account.create({
          data: {
            name: accountName,
            dealershipName: 'GAD Productions',
            subscriptionStatus: 'active',
            isActive: true,
          },
        });
        console.log(`   Created system account: ${systemAccount.id}`);
      }

      await prisma.accountUser.upsert({
        where: {
          accountId_userId: {
            accountId: systemAccount.id,
            userId: existingUser.id,
          },
        },
        update: { role: 'SUPER_ADMIN' },
        create: {
          accountId: systemAccount.id,
          userId: existingUser.id,
          role: 'SUPER_ADMIN',
        },
      });
      console.log('   ✅ SUPER_ADMIN role assigned');
    }
    
    return;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  // Create transaction for user + account + role
  const result = await prisma.$transaction(async (tx) => {
    // Create user
    const user = await tx.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        firstName: 'GAD',
        lastName: 'Admin',
        emailVerified: true, // Pre-verified
        isActive: true,
      },
    });

    // Create system management account
    const account = await tx.account.create({
      data: {
        name: accountName,
        dealershipName: 'GAD Productions',
        subscriptionStatus: 'active',
        isActive: true,
      },
    });

    // Assign SUPER_ADMIN role
    await tx.accountUser.create({
      data: {
        userId: user.id,
        accountId: account.id,
        role: 'SUPER_ADMIN',
      },
    });

    // Create account settings
    await tx.accountSettings.create({
      data: {
        accountId: account.id,
      },
    });

    // Log the action
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: 'ROOT_ADMIN_CREATED',
        entityType: 'user',
        entityId: user.id,
        metadata: {
          email: adminEmail,
          accountId: account.id,
          createdBy: 'system_seed',
        },
      },
    });

    return { user, account };
  });

  console.log('✅ Root admin created successfully!\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  ROOT ADMIN CREDENTIALS (CHANGE PASSWORD IMMEDIATELY)');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Email:    ${adminEmail}`);
  console.log(`  Password: ${tempPassword}`);
  console.log(`  User ID:  ${result.user.id}`);
  console.log(`  Role:     SUPER_ADMIN`);
  console.log(`  Account:  ${result.account.name}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('\n⚠️  IMPORTANT: Change this password after first login!\n');
}

async function main() {
  try {
    await seedRootAdmin();
  } catch (error) {
    console.error('❌ Error seeding root admin:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();

export { seedRootAdmin };
