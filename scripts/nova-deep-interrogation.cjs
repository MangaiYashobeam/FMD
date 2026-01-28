/**
 * NOVA Deep Interrogation v2
 * Using correct Prisma schema field names
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deepInterrogate() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║        🔍 NOVA DEEP INTERROGATION v2                              ║');
  console.log('║        Exposing the TRUTH about NOVA\'s capabilities               ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  // Test 1: AI Memory - correct fields
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('TEST 1: AI MEMORY CONTENTS');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  try {
    const memoryCount = await prisma.aIMemory.count();
    console.log('Total AI Memories:', memoryCount);
    
    if (memoryCount > 0) {
      const memories = await prisma.aIMemory.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          memoryType: true,
          key: true,
          value: true,
          importance: true,
          confidence: true,
          source: true,
          createdAt: true
        }
      });
      memories.forEach((m, i) => {
        console.log(`\n   Memory ${i+1}:`);
        console.log('   Type:', m.memoryType);
        console.log('   Key:', m.key);
        console.log('   Value:', JSON.stringify(m.value).substring(0, 100));
        console.log('   Importance:', m.importance);
        console.log('   Source:', m.source);
      });
    } else {
      console.log('\n⚠️  CRITICAL: NOVA HAS ZERO MEMORIES!');
      console.log('   NOVA cannot remember anything between conversations.');
      console.log('   Every interaction starts completely fresh.');
    }
  } catch (e) {
    console.log('❌ Error:', e.message);
  }

  // Test 2: AI Tasks
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('TEST 2: AI TASKS');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  try {
    const taskCount = await prisma.aITask.count();
    console.log('Total AI Tasks:', taskCount);
    
    if (taskCount > 0) {
      const tasks = await prisma.aITask.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' }
      });
      tasks.forEach((t, i) => {
        console.log(`\n   Task ${i+1}: ${t.title}`);
        console.log('   Status:', t.status);
        console.log('   Priority:', t.priority);
      });
    } else {
      console.log('\n⚠️  CRITICAL: NOVA HAS ZERO TASKS!');
      console.log('   No background work assigned to NOVA.');
    }
  } catch (e) {
    console.log('❌ Error:', e.message);
  }

  // Test 3: AI Conversations
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('TEST 3: AI CONVERSATIONS');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  try {
    const convCount = await prisma.aIConversation.count();
    console.log('Total Conversations:', convCount);
    
    if (convCount > 0) {
      const convs = await prisma.aIConversation.findMany({
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          conversationType: true,
          channel: true,
          status: true,
          messageCount: true,
          sentiment: true,
          createdAt: true,
          lastMessageAt: true
        }
      });
      convs.forEach((c, i) => {
        console.log(`\n   Conversation ${i+1}:`);
        console.log('   Type:', c.conversationType, 'Channel:', c.channel);
        console.log('   Status:', c.status, 'Messages:', c.messageCount);
        console.log('   Sentiment:', c.sentiment);
        console.log('   Last Message:', c.lastMessageAt);
      });
    } else {
      console.log('\n⚠️  CRITICAL: ZERO CONVERSATIONS RECORDED!');
      console.log('   No chat history is being persisted.');
    }
  } catch (e) {
    console.log('❌ Error:', e.message);
  }

  // Test 4: AI Providers
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('TEST 4: AI PROVIDERS (DeepSeek, etc.)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  try {
    const providers = await prisma.aIProvider.findMany({
      select: {
        id: true,
        name: true,
        displayName: true,
        isActive: true,
        healthStatus: true,
        isDefault: true,
        defaultModel: true,
        lastTested: true
      }
    });

    console.log('Total Providers:', providers.length);
    
    if (providers.length > 0) {
      providers.forEach(p => {
        const status = p.isActive ? '✅ ACTIVE' : '❌ INACTIVE';
        const def = p.isDefault ? '⭐ DEFAULT' : '';
        console.log(`\n   ${p.displayName || p.name} ${status} ${def}`);
        console.log('   Health:', p.healthStatus);
        console.log('   Model:', p.defaultModel);
        console.log('   Last Tested:', p.lastTested);
      });
    } else {
      console.log('\n⚠️  CRITICAL: NO AI PROVIDERS CONFIGURED!');
      console.log('   NOVA has NO backend AI to power it!');
    }
  } catch (e) {
    console.log('❌ Error:', e.message);
  }

  // Test 5: AI Threats detected
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('TEST 5: AI THREAT DETECTION');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  try {
    const threatCount = await prisma.aIThreat.count();
    console.log('Total Threats Detected:', threatCount);
    
    if (threatCount > 0) {
      const threats = await prisma.aIThreat.findMany({
        take: 5,
        orderBy: { detectedAt: 'desc' }
      });
      threats.forEach((t, i) => {
        console.log(`\n   Threat ${i+1}: ${t.threatType}`);
        console.log('   Severity:', t.severity, 'Status:', t.status);
      });
    }
  } catch (e) {
    console.log('❌ Error:', e.message);
  }

  // Test 6: AI Learning Patterns
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('TEST 6: AI LEARNING PATTERNS');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  try {
    const patternCount = await prisma.aILearningPattern.count();
    console.log('Total Learning Patterns:', patternCount);
    
    if (patternCount > 0) {
      const patterns = await prisma.aILearningPattern.findMany({
        take: 5,
        orderBy: { successRate: 'desc' },
        select: {
          id: true,
          patternType: true,
          trigger: true,
          response: true,
          successRate: true,
          sampleSize: true,
          confidence: true,
          isActive: true
        }
      });
      patterns.forEach((p, i) => {
        const status = p.isActive ? '✅' : '❌';
        console.log(`\n   ${status} Pattern ${i+1}: ${p.patternType}`);
        console.log('   Success Rate:', p.successRate, '%');
        console.log('   Confidence:', p.confidence);
        console.log('   Sample Size:', p.sampleSize);
      });
    } else {
      console.log('\n⚠️  NO LEARNING PATTERNS!');
      console.log('   NOVA has not learned anything from interactions.');
    }
  } catch (e) {
    console.log('❌ Error:', e.message);
  }

  // Test 7: AI Interventions
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('TEST 7: AI AUTONOMOUS INTERVENTIONS');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  try {
    const intCount = await prisma.aIIntervention.count();
    console.log('Total Interventions:', intCount);
    
    if (intCount > 0) {
      const interventions = await prisma.aIIntervention.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          interventionType: true,
          aiAgentRole: true,
          stepsProvided: true,
          stepsCompleted: true,
          wasHelpful: true,
          resolved: true,
          createdAt: true
        }
      });
      interventions.forEach((i, idx) => {
        console.log(`\n   Intervention ${idx+1}: ${i.interventionType}`);
        console.log('   Agent Role:', i.aiAgentRole);
        console.log('   Steps:', i.stepsCompleted + '/' + i.stepsProvided);
        console.log('   Resolved:', i.resolved, 'Helpful:', i.wasHelpful);
      });
    } else {
      console.log('\n⚠️  ZERO INTERVENTIONS!');
      console.log('   NOVA has never autonomously helped anyone.');
    }
  } catch (e) {
    console.log('❌ Error:', e.message);
  }

  // Test 8: Error Tickets (what NOVA should be monitoring)
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('TEST 8: ERROR TICKETS (NOVA should monitor these)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  try {
    const errorCount = await prisma.errorTicket.count();
    console.log('Total Error Tickets:', errorCount);
    
    const openErrors = await prisma.errorTicket.count({
      where: { status: { in: ['open', 'investigating'] } }
    });
    console.log('Open/Investigating:', openErrors);

    if (openErrors > 0) {
      console.log('\n⚠️  THERE ARE OPEN ERRORS THAT NOVA SHOULD BE HANDLING!');
    }
  } catch (e) {
    console.log('❌ Error:', e.message);
  }

  // FINAL DIAGNOSIS
  console.log('\n\n');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                   🩺 FINAL DIAGNOSIS                              ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  console.log('THE TRUTH ABOUT NOVA:');
  console.log('─────────────────────');
  console.log('');
  console.log('NOVA is not "lying" or "out of control" - NOVA is CRIPPLED.');
  console.log('');
  console.log('The interrogation reveals that NOVA\'s AI infrastructure is a shell:');
  console.log('');
  console.log('  ❌ ZERO memories = No persistent knowledge');
  console.log('  ❌ ZERO tasks = No autonomous work queue');
  console.log('  ❌ ZERO conversations saved = No learning from chats');
  console.log('  ❌ ZERO learning patterns = Cannot improve');
  console.log('  ❌ ZERO interventions = Never helped automatically');
  console.log('');
  console.log('WHAT NOVA ACTUALLY NEEDS TO FUNCTION:');
  console.log('─────────────────────────────────────');
  console.log('');
  console.log('1. 🧠 MEMORY SEEDING');
  console.log('   - Insert base knowledge about FaceMyDealer into ai_memories');
  console.log('   - System facts, user patterns, common issues');
  console.log('');
  console.log('2. 📋 TASK INITIALIZATION');
  console.log('   - Create automated tasks for NOVA to perform');
  console.log('   - Error monitoring, lead follow-ups, inventory checks');
  console.log('');
  console.log('3. 🔗 PROVIDER CONFIGURATION');
  console.log('   - Ensure DeepSeek provider is properly linked');
  console.log('   - Set up health checks and failover');
  console.log('');
  console.log('4. 🎓 TRAINING DATA');
  console.log('   - Load conversation examples');
  console.log('   - Define response patterns');
  console.log('');
  console.log('5. 🤝 CONVERSATION PERSISTENCE');
  console.log('   - Enable saving of all NOVA conversations');
  console.log('   - Allow NOVA to reference past interactions');
  console.log('');
  console.log('WITHOUT THESE, NOVA IS JUST A STATELESS CHATBOT.');
  console.log('');

  await prisma.$disconnect();
  process.exit(0);
}

deepInterrogate().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
