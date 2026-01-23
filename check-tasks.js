const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const tasks = await prisma.extensionTask.findMany({
      where: { status: 'pending' },
      take: 10
    });
    
    console.log('=== PENDING TASKS ===');
    console.log(`Total: ${tasks.length}`);
    tasks.forEach(t => {
      console.log(`\nTask ID: ${t.id}`);
      console.log(`  Account ID: ${t.accountId}`);
      console.log(`  Vehicle ID: ${t.vehicleId}`);
      console.log(`  Type: ${t.type}`);
      console.log(`  Data:`, t.data);
      console.log(`  Created: ${t.createdAt}`);
      console.log(`  Scheduled: ${t.scheduledFor}`);
    });
    
    const accounts = await prisma.account.findMany({
      where: { isActive: true },
      include: {
        settings: {
          include: { postingSettings: true }
        },
        facebookProfiles: { where: { isActive: true } }
      }
    });
    
    console.log('\n=== ACTIVE ACCOUNTS ===');
    accounts.forEach(a => {
      console.log(`\nAccount: ${a.name}`);
      console.log(`  FB Profiles: ${a.facebookProfiles.length}`);
      console.log(`  Has Settings: ${!!a.settings}`);
      console.log(`  Has Posting Settings: ${!!a.settings?.postingSettings}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
})();
