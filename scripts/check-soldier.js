const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== QUERYING SOLDIERS ===\n');
  
  const soldiers = await prisma.iAISoldier.findMany({
    include: { account: true }
  });
  
  console.log('=== ALL SOLDIERS ===');
  soldiers.forEach(s => {
    console.log(`ID: ${s.soldierId} | Status: ${s.status} | Genre: ${s.genre} | Tasks: ${s.tasksCompleted}/${s.tasksFailed} | LastHeartbeat: ${s.lastHeartbeatAt}`);
  });
  
  const stealth = soldiers.find(s => s.soldierId === 'STEALTH-1');
  if (stealth) {
    console.log('\n=== STEALTH-1 FULL DETAILS ===');
    console.log(JSON.stringify(stealth, null, 2));
    
    console.log('\n=== STEALTH-1 ACTIVITY LOGS ===');
    const logs = await prisma.iAIActivityLog.findMany({
      where: { soldierId: stealth.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    
    if (logs.length === 0) {
      console.log('NO LOGS FOUND for this soldier!');
    } else {
      logs.forEach(l => {
        console.log(`[${l.createdAt}] ${l.eventType}: ${l.message}`);
      });
    }
    
    // Check Redis for pending tasks
    console.log('\n=== CHECKING PENDING TASKS ===');
    // Note: Would need Redis client here
  } else {
    console.log('STEALTH-1 not found!');
  }
  
  // Check all activity logs
  console.log('\n=== RECENT ACTIVITY LOGS (ALL) ===');
  const allLogs = await prisma.iAIActivityLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  allLogs.forEach(l => {
    console.log(`[${l.createdAt}] ${l.soldierId}: ${l.eventType} - ${l.message}`);
  });
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Error:', e);
  prisma.$disconnect();
});
