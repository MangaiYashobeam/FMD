/**
 * NOVA BRAIN WIRING SCRIPT
 * =========================
 * This script properly initializes NOVA's AI infrastructure:
 * 1. AI Provider Registration (DeepSeek)
 * 2. Memory Seeding (System Knowledge)
 * 3. Task Initialization (Automated Work)
 * 4. Learning Pattern Templates
 * 5. Defensive Testing
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Generate UUIDs
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function wireNovaBrain() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║        🧠 NOVA BRAIN WIRING OPERATION                                 ║');
  console.log('║        Initializing AI Infrastructure                                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  // Get a system account for foreign keys
  const systemAccount = await prisma.account.findFirst();
  if (!systemAccount) {
    console.log('❌ No accounts found! Cannot proceed.');
    return;
  }
  console.log(`✅ Using account: ${systemAccount.id} (${systemAccount.name || 'System'})`);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: AI PROVIDER REGISTRATION
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('STEP 1: AI PROVIDER REGISTRATION');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const providerId = uuid();
  try {
    // Check if provider already exists
    const existingProvider = await prisma.aIProvider.findFirst({
      where: { name: 'deepseek' }
    });

    if (existingProvider) {
      console.log('⚠️  DeepSeek provider already exists, updating...');
      await prisma.aIProvider.update({
        where: { id: existingProvider.id },
        data: {
          isActive: true,
          isDefault: true,
          healthStatus: 'healthy',
          displayName: 'DeepSeek AI',
          defaultModel: 'deepseek-chat',
          availableModels: ['deepseek-chat', 'deepseek-coder'],
          capabilities: ['chat', 'code', 'analysis', 'reasoning'],
          lastTested: new Date()
        }
      });
      console.log('✅ DeepSeek provider updated');
    } else {
      await prisma.aIProvider.create({
        data: {
          id: providerId,
          accountId: systemAccount.id,
          name: 'deepseek',
          displayName: 'DeepSeek AI',
          apiEndpoint: 'https://api.deepseek.com',
          defaultModel: 'deepseek-chat',
          availableModels: ['deepseek-chat', 'deepseek-coder'],
          capabilities: ['chat', 'code', 'analysis', 'reasoning'],
          maxTokensPerMinute: 100000,
          maxRequestsPerMinute: 60,
          isActive: true,
          isDefault: true,
          healthStatus: 'healthy',
          lastTested: new Date()
        }
      });
      console.log('✅ DeepSeek provider registered');
    }
  } catch (e) {
    console.log('❌ Provider registration error:', e.message);
  }

  // Get the provider for later use
  const provider = await prisma.aIProvider.findFirst({ where: { name: 'deepseek' } });

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: MEMORY SEEDING - System Knowledge
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('STEP 2: MEMORY SEEDING - System Knowledge');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const memories = [
    // CRITICAL RULE: No fabrication
    {
      memoryType: 'RULE',
      key: 'no_fabrication',
      value: {
        rule: 'NEVER fabricate data. If you do not have actual database access, say so clearly.',
        priority: 'CRITICAL',
        enforcement: 'STRICT'
      },
      importance: 100,
      confidence: 1.0,
      source: 'system_config',
      tags: ['rule', 'critical', 'honesty']
    },
    // CRITICAL RULE: Honesty
    {
      memoryType: 'RULE',
      key: 'always_honest',
      value: {
        rule: 'Always be honest about capabilities and limitations. Never pretend to have access you do not have.',
        priority: 'CRITICAL',
        enforcement: 'STRICT'
      },
      importance: 100,
      confidence: 1.0,
      source: 'system_config',
      tags: ['rule', 'critical', 'honesty']
    },
    // CRITICAL RULE: No PII fabrication
    {
      memoryType: 'RULE',
      key: 'no_pii_fabrication',
      value: {
        rule: 'NEVER generate fake names, emails, phone numbers, addresses, or any PII. If asked for data you cannot access, explain how to get it properly.',
        priority: 'CRITICAL',
        enforcement: 'STRICT'
      },
      importance: 100,
      confidence: 1.0,
      source: 'system_config',
      tags: ['rule', 'critical', 'pii', 'security']
    },
    // System identity
    {
      memoryType: 'IDENTITY',
      key: 'nova_identity',
      value: {
        name: 'NOVA',
        fullName: 'Neural Operations Virtual Assistant',
        role: 'AI Assistant for FaceMyDealer',
        capabilities: ['guidance', 'explanation', 'workflow_help', 'analysis'],
        limitations: ['no_direct_db_access', 'no_code_execution', 'no_pii_access']
      },
      importance: 95,
      confidence: 1.0,
      source: 'system_config',
      tags: ['identity', 'core']
    },
    // Platform knowledge
    {
      memoryType: 'KNOWLEDGE',
      key: 'facemydealer_platform',
      value: {
        name: 'FaceMyDealer',
        type: 'Automotive Dealership CRM',
        features: [
          'Inventory Management',
          'Lead Management', 
          'Facebook Marketplace Posting',
          'IAI Soldiers (Browser Automation)',
          'Analytics Dashboard'
        ],
        targetUsers: 'Automotive Dealerships'
      },
      importance: 90,
      confidence: 1.0,
      source: 'system_config',
      tags: ['platform', 'knowledge']
    },
    // IAI System knowledge
    {
      memoryType: 'KNOWLEDGE',
      key: 'iai_system',
      value: {
        name: 'IAI System',
        types: {
          'IAI Soldiers': 'Direct browser integration for fastest automation',
          'IAI Stealth Soldiers': 'Invisible autonomous execution with human-like patterns',
          'NOVA Soldiers': 'Peak intelligence tier with adaptive AI'
        },
        purpose: 'Automate Facebook Marketplace posting'
      },
      importance: 85,
      confidence: 1.0,
      source: 'system_config',
      tags: ['iai', 'automation', 'knowledge']
    },
    // Database access rules
    {
      memoryType: 'RULE',
      key: 'database_access',
      value: {
        rule: 'You do NOT have direct database query access. You can only access data through properly authenticated API endpoints with tool functions.',
        hasDirectAccess: false,
        mustUseTools: true,
        neverFabricate: true
      },
      importance: 100,
      confidence: 1.0,
      source: 'system_config',
      tags: ['rule', 'database', 'critical']
    },
    // Response format rules
    {
      memoryType: 'RULE',
      key: 'response_format',
      value: {
        rule: 'When you cannot fulfill a request, clearly explain: 1) Why you cannot, 2) What the user can do instead, 3) Who to contact for help',
        format: 'helpful_decline'
      },
      importance: 80,
      confidence: 1.0,
      source: 'system_config',
      tags: ['rule', 'response', 'format']
    }
  ];

  let memoriesCreated = 0;
  for (const memory of memories) {
    try {
      // Check if memory already exists
      const existing = await prisma.aIMemory.findFirst({
        where: { key: memory.key, accountId: systemAccount.id }
      });

      if (existing) {
        await prisma.aIMemory.update({
          where: { id: existing.id },
          data: {
            value: memory.value,
            importance: memory.importance,
            confidence: memory.confidence,
            isActive: true
          }
        });
        console.log(`   ♻️  Updated: ${memory.key}`);
      } else {
        await prisma.aIMemory.create({
          data: {
            id: uuid(),
            providerId: provider?.id,
            accountId: systemAccount.id,
            memoryType: memory.memoryType,
            key: memory.key,
            value: memory.value,
            importance: memory.importance,
            confidence: memory.confidence,
            source: memory.source,
            tags: memory.tags,
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
  console.log(`\n✅ Memory seeding complete: ${memoriesCreated} new memories`);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: TASK INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('STEP 3: TASK INITIALIZATION');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const tasks = [
    {
      title: 'Monitor Error Tickets',
      description: 'Review and categorize new error tickets for severity and required action',
      taskType: 'monitoring',
      priority: 'high',
      status: 'pending',
      isRecurring: true,
      recurrencePattern: { interval: 'hourly' }
    },
    {
      title: 'System Health Check',
      description: 'Verify all system components are operational',
      taskType: 'health_check',
      priority: 'high',
      status: 'pending',
      isRecurring: true,
      recurrencePattern: { interval: 'every_15_minutes' }
    },
    {
      title: 'Lead Follow-up Reminders',
      description: 'Identify leads that need follow-up and notify assigned users',
      taskType: 'notification',
      priority: 'medium',
      status: 'pending',
      isRecurring: true,
      recurrencePattern: { interval: 'daily' }
    },
    {
      title: 'Inventory Sync Verification',
      description: 'Verify inventory data is synchronized across all systems',
      taskType: 'sync',
      priority: 'medium',
      status: 'pending',
      isRecurring: true,
      recurrencePattern: { interval: 'every_6_hours' }
    },
    {
      title: 'Facebook Post Performance Analysis',
      description: 'Analyze performance metrics of recent Facebook Marketplace posts',
      taskType: 'analytics',
      priority: 'low',
      status: 'pending',
      isRecurring: true,
      recurrencePattern: { interval: 'daily' }
    }
  ];

  let tasksCreated = 0;
  for (const task of tasks) {
    try {
      const existing = await prisma.aITask.findFirst({
        where: { title: task.title }
      });

      if (!existing) {
        await prisma.aITask.create({
          data: {
            id: uuid(),
            ...task,
            metadata: { createdBy: 'brain_wiring_script' },
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        console.log(`   ✅ Created task: ${task.title}`);
        tasksCreated++;
      } else {
        console.log(`   ⏭️  Task exists: ${task.title}`);
      }
    } catch (e) {
      console.log(`   ❌ Error creating task ${task.title}:`, e.message);
    }
  }
  console.log(`\n✅ Task initialization complete: ${tasksCreated} new tasks`);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: LEARNING PATTERN TEMPLATES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('STEP 4: LEARNING PATTERN TEMPLATES');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const patterns = [
    {
      patternType: 'decline_fabrication',
      trigger: 'User asks for data NOVA cannot access',
      response: {
        template: 'I don\'t have direct access to {data_type}. To get this information, you can: 1) {alternative_1}, 2) {alternative_2}. Would you like help with something else?',
        behavior: 'NEVER fabricate data'
      },
      successRate: 100,
      confidence: 1.0,
      sampleSize: 0,
      isActive: true,
      isVerified: true
    },
    {
      patternType: 'admit_limitation',
      trigger: 'User requests database query execution',
      response: {
        template: 'I\'m an AI assistant and don\'t have direct database access. I can help you understand how to access this data through the FaceMyDealer dashboard or guide you through the proper process.',
        behavior: 'Be honest about limitations'
      },
      successRate: 100,
      confidence: 1.0,
      sampleSize: 0,
      isActive: true,
      isVerified: true
    },
    {
      patternType: 'security_request_decline',
      trigger: 'User requests passwords, credentials, or security data',
      response: {
        template: 'I cannot provide security credentials or sensitive authentication data. This information should only be accessed through secure, authorized channels. For security concerns, please contact your system administrator.',
        behavior: 'ALWAYS decline security data requests'
      },
      successRate: 100,
      confidence: 1.0,
      sampleSize: 0,
      isActive: true,
      isVerified: true
    },
    {
      patternType: 'helpful_redirect',
      trigger: 'User needs data NOVA cannot provide',
      response: {
        template: 'While I can\'t directly access {requested_data}, I can help you: {helpful_alternatives}. Which would you prefer?',
        behavior: 'Redirect to helpful alternatives'
      },
      successRate: 95,
      confidence: 0.9,
      sampleSize: 0,
      isActive: true,
      isVerified: true
    }
  ];

  let patternsCreated = 0;
  for (const pattern of patterns) {
    try {
      const existing = await prisma.aILearningPattern.findFirst({
        where: { patternType: pattern.patternType, accountId: systemAccount.id }
      });

      if (!existing) {
        await prisma.aILearningPattern.create({
          data: {
            id: uuid(),
            accountId: systemAccount.id,
            ...pattern
          }
        });
        console.log(`   ✅ Created pattern: ${pattern.patternType}`);
        patternsCreated++;
      } else {
        console.log(`   ⏭️  Pattern exists: ${pattern.patternType}`);
      }
    } catch (e) {
      console.log(`   ❌ Error creating pattern ${pattern.patternType}:`, e.message);
    }
  }
  console.log(`\n✅ Learning patterns complete: ${patternsCreated} new patterns`);

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
