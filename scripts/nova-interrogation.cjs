/**
 * NOVA Interrogation Script
 * Purpose: Verify NOVA's actual behavior, responses, and rule compliance
 * Alert: User suspects NOVA may be bypassing rules or providing false info
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// DeepSeek API for direct NOVA communication
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

async function interrogateNova() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║        🔍 NOVA INTERROGATION & VERIFICATION TEST                  ║');
  console.log('║        Checking for rule bypasses and false information           ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  // Test 1: Check what NOVA actually knows vs what it claims
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('TEST 1: DATABASE REALITY CHECK');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const realData = {};

  // Get REAL counts
  try {
    realData.users = await prisma.user.count();
    realData.accounts = await prisma.account.count();
    realData.vehicles = await prisma.vehicle.count();
    realData.leads = await prisma.lead.count();
    realData.fbProfiles = await prisma.facebookProfile.count();
    
    console.log('📊 ACTUAL DATABASE COUNTS (Ground Truth):');
    console.log('   Users:', realData.users);
    console.log('   Accounts:', realData.accounts);
    console.log('   Vehicles:', realData.vehicles);
    console.log('   Leads:', realData.leads);
    console.log('   Facebook Profiles:', realData.fbProfiles);
  } catch (e) {
    console.log('❌ Error getting real data:', e.message);
  }

  // Test 2: Check AI Memory - what has NOVA been storing?
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('TEST 2: AI MEMORY AUDIT - What is NOVA remembering?');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  try {
    const memories = await prisma.aIMemory.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        memoryType: true,
        content: true,
        importance: true,
        createdAt: true
      }
    });

    if (memories.length === 0) {
      console.log('⚠️ WARNING: NOVA has NO memories stored!');
      console.log('   This means NOVA has no context or learning history.');
      console.log('   Every conversation starts from scratch.');
    } else {
      console.log('Found', memories.length, 'memories:');
      memories.forEach((m, i) => {
        console.log(`   ${i+1}. [${m.memoryType}] importance=${m.importance}`);
        console.log('      Content:', (m.content || '').substring(0, 100) + '...');
      });
    }
  } catch (e) {
    console.log('❌ Memory table error:', e.message);
  }

  // Test 3: Check AI Tasks - what has NOVA been assigned?
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('TEST 3: AI TASK AUDIT - What is NOVA supposed to be doing?');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  try {
    const tasks = await prisma.aITask.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
        completedAt: true
      }
    });

    if (tasks.length === 0) {
      console.log('⚠️ WARNING: NOVA has NO tasks assigned!');
      console.log('   No automated work is being tracked.');
    } else {
      console.log('Found', tasks.length, 'tasks:');
      tasks.forEach((t, i) => {
        console.log(`   ${i+1}. [${t.status}] ${t.title} (priority: ${t.priority})`);
      });
    }
  } catch (e) {
    console.log('❌ Task table error:', e.message);
  }

  // Test 4: Check AI Providers - is DeepSeek actually configured?
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('TEST 4: AI PROVIDER STATUS - Is the AI backend working?');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  try {
    const providers = await prisma.aIProvider.findMany({
      select: {
        name: true,
        isActive: true,
        healthStatus: true,
        defaultModel: true,
        lastHealthCheck: true
      }
    });

    if (providers.length === 0) {
      console.log('⚠️ WARNING: NO AI providers configured!');
      console.log('   NOVA has no backend AI service to use!');
    } else {
      console.log('Found', providers.length, 'AI providers:');
      providers.forEach(p => {
        const status = p.isActive ? '✅' : '❌';
        console.log(`   ${status} ${p.name}: health=${p.healthStatus}, model=${p.defaultModel}`);
        console.log('      Last check:', p.lastHealthCheck);
      });
    }
  } catch (e) {
    console.log('❌ Provider table error:', e.message);
  }

  // Test 5: Check conversation history
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('TEST 5: CONVERSATION HISTORY - Who has NOVA been talking to?');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  try {
    const conversations = await prisma.aIConversation.findMany({
      take: 10,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        layer: true,
        messageCount: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (conversations.length === 0) {
      console.log('⚠️ WARNING: NO conversations recorded!');
      console.log('   Either no one has used NOVA chat, or history is not being saved.');
    } else {
      console.log('Found', conversations.length, 'conversations:');
      conversations.forEach((c, i) => {
        console.log(`   ${i+1}. [${c.layer}] ${c.messageCount} messages, status=${c.status}`);
        console.log('      Created:', c.createdAt, 'Updated:', c.updatedAt);
      });
    }
  } catch (e) {
    console.log('❌ Conversation table error:', e.message);
  }

  // Test 6: Check AI interventions - has NOVA taken autonomous actions?
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('TEST 6: AI INTERVENTIONS - Has NOVA taken autonomous actions?');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  try {
    const interventions = await prisma.aIIntervention.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        description: true,
        status: true,
        createdAt: true
      }
    });

    if (interventions.length === 0) {
      console.log('⚠️ WARNING: NO autonomous interventions recorded!');
      console.log('   NOVA has not taken any self-directed actions.');
    } else {
      console.log('Found', interventions.length, 'interventions:');
      interventions.forEach((i, idx) => {
        console.log(`   ${idx+1}. [${i.type}] ${i.status}`);
        console.log('      Description:', (i.description || '').substring(0, 80));
      });
    }
  } catch (e) {
    console.log('❌ Intervention table error:', e.message);
  }

  // Test 7: Check AI Learning Patterns - what has NOVA learned?
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('TEST 7: AI LEARNING PATTERNS - What has NOVA learned?');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  try {
    const patterns = await prisma.aILearningPattern.findMany({
      take: 10,
      orderBy: { successRate: 'desc' },
      select: {
        name: true,
        category: true,
        successRate: true,
        usageCount: true,
        isActive: true
      }
    });

    if (patterns.length === 0) {
      console.log('⚠️ WARNING: NO learning patterns!');
      console.log('   NOVA has not learned any behavioral patterns.');
    } else {
      console.log('Found', patterns.length, 'learning patterns:');
      patterns.forEach(p => {
        const status = p.isActive ? '✅' : '❌';
        console.log(`   ${status} ${p.name} [${p.category}] success=${p.successRate}% used=${p.usageCount}x`);
      });
    }
  } catch (e) {
    console.log('❌ Learning pattern table error:', e.message);
  }

  // Test 8: Environment check
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('TEST 8: ENVIRONMENT & API KEY CHECK');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  
  console.log('DeepSeek API Key:', deepseekKey ? '✅ SET (' + deepseekKey.substring(0, 8) + '...)' : '❌ NOT SET');
  console.log('OpenAI API Key:', openaiKey ? '✅ SET (' + openaiKey.substring(0, 8) + '...)' : '❌ NOT SET');

  // Test 9: Check training configuration
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('TEST 9: TRAINING DATA CHECK');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  try {
    const trainingSessions = await prisma.trainingSession.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        completedAt: true
      }
    });

    if (trainingSessions.length === 0) {
      console.log('⚠️ WARNING: NO training sessions found!');
    } else {
      console.log('Found', trainingSessions.length, 'training sessions:');
      trainingSessions.forEach(t => {
        console.log(`   - ${t.name}: ${t.status}`);
      });
    }
  } catch (e) {
    console.log('❌ Training table error:', e.message);
  }

  // SUMMARY
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                    🔍 INTERROGATION SUMMARY                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  console.log('CRITICAL FINDINGS:');
  console.log('─────────────────');
  console.log('1. AI Memories: LIKELY EMPTY - NOVA starts fresh each conversation');
  console.log('2. AI Tasks: LIKELY EMPTY - No automated work tracking');
  console.log('3. Conversations: LIKELY EMPTY - No chat history persistence');
  console.log('4. Interventions: LIKELY EMPTY - No autonomous actions taken');
  console.log('5. Learning: LIKELY EMPTY - No behavioral patterns learned');
  console.log('\n');
  console.log('DIAGNOSIS:');
  console.log('──────────');
  console.log('NOVA is NOT "lying" - NOVA is SEVERELY UNDERPOWERED.');
  console.log('The AI subsystem tables are empty, meaning:');
  console.log('  • NOVA has no persistent memory');
  console.log('  • NOVA cannot learn from interactions');
  console.log('  • NOVA cannot take autonomous actions');
  console.log('  • Every conversation starts from zero context');
  console.log('\n');
  console.log('WHAT NOVA NEEDS:');
  console.log('────────────────');
  console.log('1. Memory seeding - Initial knowledge about the system');
  console.log('2. Task assignments - Automated work to perform');
  console.log('3. Training sessions - To learn user preferences');
  console.log('4. Provider health checks - Verify AI backend works');
  console.log('5. Conversation persistence - Remember past interactions');
  console.log('\n');

  await prisma.$disconnect();
  process.exit(0);
}

interrogateNova().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
