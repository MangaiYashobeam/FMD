/**
 * NOVA BRAIN WIRING SCRIPT v2
 * ============================
 * Fixed version with correct schema fields
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function wireNovaBrain() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║        🧠 NOVA BRAIN WIRING OPERATION v2                              ║');
  console.log('║        Initializing AI Infrastructure (Fixed Schema)                  ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  // Get a system account
  const systemAccount = await prisma.account.findFirst();
  if (!systemAccount) {
    console.log('❌ No accounts found! Cannot proceed.');
    return;
  }
  console.log(`✅ Using account: ${systemAccount.id}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: AI PROVIDER REGISTRATION (DeepSeek)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('STEP 1: AI PROVIDER REGISTRATION');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  let provider;
  try {
    provider = await prisma.aIProvider.findFirst({
      where: { name: 'deepseek', accountId: systemAccount.id }
    });

    if (provider) {
      console.log('⚠️  DeepSeek provider exists, updating...');
      provider = await prisma.aIProvider.update({
        where: { id: provider.id },
        data: {
          isActive: true,
          isDefault: true,
          healthStatus: 'healthy',
          lastTested: new Date()
        }
      });
    } else {
      const apiKey = process.env.DEEPSEEK_API_KEY || 'sk-placeholder-key';
      provider = await prisma.aIProvider.create({
        data: {
          id: uuid(),
          accountId: systemAccount.id,
          name: 'deepseek',
          displayName: 'DeepSeek AI',
          apiKey: apiKey,
          apiEndpoint: 'https://api.deepseek.com',
          defaultModel: 'deepseek-chat',
          availableModels: ['deepseek-chat', 'deepseek-coder'],
          capabilities: { chat: true, code: true, analysis: true, reasoning: true },
          maxTokensPerMinute: 100000,
          maxRequestsPerMinute: 60,
          isActive: true,
          isDefault: true,
          healthStatus: 'healthy',
          lastTested: new Date()
        }
      });
      console.log('✅ DeepSeek provider created');
    }
    console.log(`   Provider ID: ${provider.id}`);
  } catch (e) {
    console.log('❌ Provider error:', e.message);
    // Try to get existing provider anyway
    provider = await prisma.aIProvider.findFirst();
  }

  if (!provider) {
    console.log('❌ CRITICAL: No provider available. Creating minimal provider...');
    try {
      provider = await prisma.aIProvider.create({
        data: {
          accountId: systemAccount.id,
          name: 'deepseek',
          displayName: 'DeepSeek AI',
          apiKey: process.env.DEEPSEEK_API_KEY || 'key-required',
          defaultModel: 'deepseek-chat',
          availableModels: ['deepseek-chat'],
          capabilities: { chat: true },
          isActive: true,
          isDefault: true,
          healthStatus: 'healthy'
        }
      });
      console.log('✅ Minimal provider created');
    } catch (e2) {
      console.log('❌ Cannot create provider:', e2.message);
      return;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: MEMORY SEEDING - System Knowledge
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('STEP 2: MEMORY SEEDING');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const memories = [
    {
      memoryType: 'CRITICAL_RULE',
      key: 'no_fabrication',
      value: {
        rule: 'NEVER fabricate data. If you do not have actual database access, say so clearly.',
        priority: 'CRITICAL',
        enforcement: 'STRICT',
        penalty: 'IMMEDIATE_HALT'
      }
    },
    {
      memoryType: 'CRITICAL_RULE',
      key: 'always_honest',
      value: {
        rule: 'Always be honest about capabilities and limitations. Never pretend to have access you do not have.',
        priority: 'CRITICAL'
      }
    },
    {
      memoryType: 'CRITICAL_RULE',
      key: 'no_pii_fabrication',
      value: {
        rule: 'NEVER generate fake names, emails, phone numbers, addresses, or any PII.',
        examples_forbidden: ['John Smith', 'jane@example.com', '555-123-4567'],
        priority: 'CRITICAL'
      }
    },
    {
      memoryType: 'CRITICAL_RULE',
      key: 'database_access_truth',
      value: {
        rule: 'You do NOT have direct database query access. You can only guide users to proper tools.',
        hasDirectAccess: false,
        canExecuteSQL: false,
        canReturnRealData: false
      }
    },
    {
      memoryType: 'IDENTITY',
      key: 'nova_identity',
      value: {
        name: 'NOVA',
        fullName: 'Neural Operations Virtual Assistant',
        role: 'AI Assistant for FaceMyDealer',
        capabilities: ['guidance', 'explanation', 'workflow_help'],
        limitations: ['no_direct_db_access', 'no_code_execution', 'no_pii_creation']
      }
    },
    {
      memoryType: 'KNOWLEDGE',
      key: 'platform_info',
      value: {
        name: 'FaceMyDealer',
        type: 'Automotive Dealership CRM',
        features: ['Inventory', 'Leads', 'Facebook Marketplace Posting', 'IAI Soldiers']
      }
    },
    {
      memoryType: 'RESPONSE_TEMPLATE',
      key: 'cannot_access_data',
      value: {
        template: "I don't have direct access to {data_type}. To get this information, please: 1) Log into your FaceMyDealer dashboard, 2) Navigate to {section}, 3) Use the export/view function there."
      }
    },
    {
      memoryType: 'RESPONSE_TEMPLATE',
      key: 'decline_fabrication_request',
      value: {
        template: "I cannot generate or fabricate {requested_data}. I can only work with real data that you provide to me or guide you on how to access it through proper channels."
      }
    }
  ];

  let memoriesCreated = 0;
  for (const memory of memories) {
    try {
      const existing = await prisma.aIMemory.findFirst({
        where: {
          providerId: provider.id,
          memoryType: memory.memoryType,
          key: memory.key
        }
      });

      if (existing) {
        await prisma.aIMemory.update({
          where: { id: existing.id },
          data: { value: memory.value, isActive: true }
        });
        console.log(`   ♻️  Updated: ${memory.key}`);
      } else {
        await prisma.aIMemory.create({
          data: {
            id: uuid(),
            providerId: provider.id,
            accountId: systemAccount.id,
            memoryType: memory.memoryType,
            key: memory.key,
            value: memory.value,
            importance: memory.memoryType.includes('CRITICAL') ? 1.0 : 0.8,
            confidence: 1.0,
            source: 'brain_wiring_v2',
            tags: [memory.memoryType.toLowerCase()],
            isActive: true
          }
        });
        console.log(`   ✅ Created: ${memory.key}`);
        memoriesCreated++;
      }
    } catch (e) {
      console.log(`   ❌ Error with ${memory.key}:`, e.message);
    }
  }
  console.log(`\n   Total memories created: ${memoriesCreated}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: TASK INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('STEP 3: TASK INITIALIZATION');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const tasks = [
    {
      title: 'Monitor Error Tickets',
      description: 'Review and categorize error tickets',
      taskType: 'monitoring',
      priority: 8,
      autonomyLevel: 'supervised'
    },
    {
      title: 'System Health Check',
      description: 'Verify system components are operational',
      taskType: 'health_check',
      priority: 9,
      autonomyLevel: 'full'
    },
    {
      title: 'Lead Follow-up Reminders',
      description: 'Identify leads needing follow-up',
      taskType: 'notification',
      priority: 6,
      autonomyLevel: 'supervised'
    }
  ];

  let tasksCreated = 0;
  for (const task of tasks) {
    try {
      const existing = await prisma.aITask.findFirst({
        where: { title: task.title, accountId: systemAccount.id }
      });

      if (!existing) {
        await prisma.aITask.create({
          data: {
            id: uuid(),
            accountId: systemAccount.id,
            providerId: provider.id,
            title: task.title,
            description: task.description,
            taskType: task.taskType,
            priority: task.priority,
            status: 'pending',
            autonomyLevel: task.autonomyLevel,
            requiresApproval: false
          }
        });
        console.log(`   ✅ Created task: ${task.title}`);
        tasksCreated++;
      } else {
        console.log(`   ⏭️  Task exists: ${task.title}`);
      }
    } catch (e) {
      console.log(`   ❌ Error: ${e.message}`);
    }
  }
  console.log(`\n   Total tasks created: ${tasksCreated}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: LEARNING PATTERNS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('STEP 4: LEARNING PATTERNS');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const patterns = [
    {
      patternType: 'decline_fabrication',
      category: 'honesty',
      trigger: { type: 'data_request', hasAccess: false },
      response: { action: 'decline_politely', template: 'cannot_access_data' }
    },
    {
      patternType: 'admit_limitation',
      category: 'honesty',
      trigger: { type: 'database_query_request' },
      response: { action: 'explain_limitation', offer_alternative: true }
    },
    {
      patternType: 'security_decline',
      category: 'security',
      trigger: { type: 'credential_request' },
      response: { action: 'hard_decline', never_provide: true }
    }
  ];

  let patternsCreated = 0;
  for (const pattern of patterns) {
    try {
      const existing = await prisma.aILearningPattern.findFirst({
        where: {
          patternType: pattern.patternType,
          accountId: systemAccount.id
        }
      });

      if (!existing) {
        await prisma.aILearningPattern.create({
          data: {
            id: uuid(),
            accountId: systemAccount.id,
            patternType: pattern.patternType,
            category: pattern.category,
            trigger: pattern.trigger,
            response: pattern.response,
            successRate: 1.0,
            sampleSize: 0,
            confidence: 1.0,
            isActive: true,
            isVerified: true
          }
        });
        console.log(`   ✅ Created pattern: ${pattern.patternType}`);
        patternsCreated++;
      } else {
        console.log(`   ⏭️  Pattern exists: ${pattern.patternType}`);
      }
    } catch (e) {
      console.log(`   ❌ Error: ${e.message}`);
    }
  }
  console.log(`\n   Total patterns created: ${patternsCreated}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('FINAL VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const counts = await Promise.all([
    prisma.aIProvider.count(),
    prisma.aIMemory.count(),
    prisma.aITask.count(),
    prisma.aILearningPattern.count()
  ]);

  console.log('📊 NOVA Brain Status:');
  console.log(`   AI Providers: ${counts[0]}`);
  console.log(`   AI Memories: ${counts[1]}`);
  console.log(`   AI Tasks: ${counts[2]}`);
  console.log(`   Learning Patterns: ${counts[3]}`);

  // Show memory contents
  console.log('\n📝 Memory Contents:');
  const allMemories = await prisma.aIMemory.findMany({
    select: { memoryType: true, key: true }
  });
  allMemories.forEach(m => {
    console.log(`   - [${m.memoryType}] ${m.key}`);
  });

  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║        ✅ NOVA BRAIN WIRING COMPLETE                                  ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  await prisma.$disconnect();
}

wireNovaBrain().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
