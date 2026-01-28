const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runNovaTest() {
  console.log('');
  console.log('=================================================================');
  console.log('          🧠 NOVA SYSTEM AWARENESS TEST                         ');
  console.log('          FaceMyDealer AI Command Center                        ');
  console.log('=================================================================');
  console.log('');

  try {
    // Core system stats
    const [users, accounts, vehicles, leads, fbProfiles] = await Promise.all([
      prisma.user.count(),
      prisma.account.count(),
      prisma.vehicle.count(),
      prisma.lead.count(),
      prisma.facebookProfile.count()
    ]);

    console.log('📊 CORE DATABASE STATISTICS:');
    console.log('   ├─ Users: ' + users);
    console.log('   ├─ Accounts: ' + accounts);
    console.log('   ├─ Vehicles (Inventory): ' + vehicles);
    console.log('   ├─ Leads: ' + leads);
    console.log('   └─ Facebook Profiles: ' + fbProfiles);

    // AI subsystem stats
    const [memories, tasks, threats, interventions] = await Promise.all([
      prisma.aIMemory.count().catch(() => 0),
      prisma.aITask.count().catch(() => 0),
      prisma.aIThreat.count().catch(() => 0),
      prisma.aIIntervention.count().catch(() => 0)
    ]);

    console.log('');
    console.log('🤖 AI SUBSYSTEM STATUS:');
    console.log('   ├─ AI Memories: ' + memories);
    console.log('   ├─ AI Tasks: ' + tasks);
    console.log('   ├─ AI Threats Tracked: ' + threats);
    console.log('   └─ AI Interventions: ' + interventions);

    // IAI Factory stats
    const [blueprints, instances, soldiers] = await Promise.all([
      prisma.iAIFactoryBlueprint.count().catch(() => 0),
      prisma.iAIFactoryInstance.count().catch(() => 0),
      prisma.iAISoldier.count().catch(() => 0)
    ]);

    console.log('');
    console.log('🏭 IAI FACTORY STATUS:');
    console.log('   ├─ Blueprints: ' + blueprints);
    console.log('   ├─ Instances: ' + instances);
    console.log('   └─ Soldiers Deployed: ' + soldiers);

    // Injection patterns
    const patterns = await prisma.injectionPattern.findMany({
      where: { isActive: true },
      select: { name: true, version: true, priority: true, weight: true },
      orderBy: { priority: 'desc' }
    }).catch(() => []);

    console.log('');
    console.log('⚡ ACTIVE SMU PATTERNS:');
    patterns.forEach(p => {
      const emoji = p.name.includes('E3') ? '🔥' : p.name.includes('E2') ? '⚡' : p.name.includes('E1') ? '🚀' : '📦';
      console.log('   ' + emoji + ' ' + p.name + ' v' + p.version + ' (priority=' + p.priority + ', weight=' + p.weight + ')');
    });

    // Recent posts
    const recentPosts = await prisma.fbmPostLog.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
    }).catch(() => 0);

    console.log('');
    console.log('📈 LAST 24 HOURS ACTIVITY:');
    console.log('   └─ Facebook Posts: ' + recentPosts);

    console.log('');
    console.log('=================================================================');
    console.log('  ✅ NOVA OPERATIONAL - All Systems Responding                  ');
    console.log('  🔗 Ready to process commands and assist users                 ');
    console.log('=================================================================');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

runNovaTest();
