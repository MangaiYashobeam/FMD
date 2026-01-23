/**
 * AI Memory Seed - Production Knowledge Base for Nova
 * 
 * This seeds REAL production data into Nova's memory system:
 * - Global platform knowledge (architecture, APIs, routes)
 * - Super admin tooling instructions
 * - System navigation guides
 * - Troubleshooting knowledge
 * - Production deployment info
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Memory scopes
const SCOPE = {
  GLOBAL: 'global',
  ROLE: 'role',
  COMPANY: 'company',
  USER: 'user',
};

// Memory categories
const CATEGORY = {
  FACT: 'fact',
  INSTRUCTION: 'instruction',
  CONTEXT: 'context',
  PERSONALITY: 'personality',
  PREFERENCE: 'preference',
  LEARNED: 'learned',
};

interface MemoryEntry {
  scope: string;
  category: string;
  key: string;
  value: any;
  summary: string;
  importance: number;
  userRole?: string;
}

// ============================================
// GLOBAL KNOWLEDGE - Available to ALL AI layers
// ============================================
const GLOBAL_MEMORIES: MemoryEntry[] = [
  // Platform Identity
  {
    scope: SCOPE.GLOBAL,
    category: CATEGORY.FACT,
    key: 'platform_identity',
    value: {
      name: 'DealersFace',
      domain: 'dealersface.com',
      company: 'GAD Productions',
      purpose: 'SaaS platform for automotive dealership management',
      tagline: 'Simplify your dealership operations',
      founded: '2024',
      tech_stack: {
        frontend: 'React 18 + TypeScript + Vite + Tailwind CSS',
        backend: 'Node.js + Express + TypeScript',
        database: 'PostgreSQL via Prisma ORM',
        cache: 'Redis',
        deployment: 'Docker on VPS (46.4.224.182)',
        cdn: 'Cloudflare',
        ssl: 'Let\'s Encrypt via Traefik',
      },
    },
    summary: 'DealersFace is a SaaS platform by GAD Productions for automotive dealerships',
    importance: 1.0,
  },

  // Production Infrastructure
  {
    scope: SCOPE.GLOBAL,
    category: CATEGORY.FACT,
    key: 'production_infrastructure',
    value: {
      vps_ip: '46.4.224.182',
      domain: 'dealersface.com',
      containers: [
        { name: 'api', port: 3000, description: 'Main Node.js API + Web Frontend' },
        { name: 'postgres', port: 5432, description: 'PostgreSQL database' },
        { name: 'redis', port: 6379, description: 'Redis cache and queue' },
        { name: 'traefik', port: '80/443', description: 'Reverse proxy with SSL' },
        { name: 'worker-api', port: 8000, description: 'Python Worker API for browser automation' },
        { name: 'browser-worker', description: 'Playwright browser workers (2 replicas)' },
        { name: 'session-monitor', description: 'Session monitoring service' },
      ],
      deployment_path: '/opt/facemydealer',
      docker_compose: 'docker-compose.production.yml',
      github_repo: 'https://github.com/MangaiYashobeam/FMD',
    },
    summary: 'Production runs on VPS 46.4.224.182 with Docker containers',
    importance: 1.0,
  },

  // API Routes Documentation
  {
    scope: SCOPE.GLOBAL,
    category: CATEGORY.FACT,
    key: 'api_routes_map',
    value: {
      auth: {
        base: '/api/auth',
        endpoints: [
          { method: 'POST', path: '/login', description: 'User login' },
          { method: 'POST', path: '/register', description: 'User registration' },
          { method: 'POST', path: '/refresh-token', description: 'Refresh JWT token' },
          { method: 'POST', path: '/forgot-password', description: 'Initiate password reset' },
          { method: 'POST', path: '/reset-password', description: 'Complete password reset' },
          { method: 'GET', path: '/me', description: 'Get current user profile' },
        ],
      },
      vehicles: {
        base: '/api/vehicles',
        endpoints: [
          { method: 'GET', path: '/', description: 'List vehicles with pagination' },
          { method: 'POST', path: '/', description: 'Create new vehicle' },
          { method: 'GET', path: '/:id', description: 'Get vehicle details' },
          { method: 'PUT', path: '/:id', description: 'Update vehicle' },
          { method: 'DELETE', path: '/:id', description: 'Delete vehicle' },
        ],
      },
      leads: {
        base: '/api/leads',
        endpoints: [
          { method: 'GET', path: '/', description: 'List leads with filtering' },
          { method: 'POST', path: '/', description: 'Create new lead' },
          { method: 'GET', path: '/:id', description: 'Get lead details' },
          { method: 'PUT', path: '/:id/status', description: 'Update lead status' },
        ],
      },
      facebook: {
        base: '/api/facebook',
        endpoints: [
          { method: 'GET', path: '/accounts', description: 'Get connected FB accounts' },
          { method: 'POST', path: '/connect', description: 'Connect Facebook account' },
          { method: 'POST', path: '/post', description: 'Create FB Marketplace post' },
          { method: 'GET', path: '/conversations', description: 'Get messenger conversations' },
        ],
      },
      admin: {
        base: '/api/admin',
        endpoints: [
          { method: 'GET', path: '/users', description: 'List all users (super admin)' },
          { method: 'GET', path: '/accounts', description: 'List all accounts' },
          { method: 'GET', path: '/stats', description: 'Get system statistics' },
          { method: 'POST', path: '/impersonate', description: 'Impersonate user' },
        ],
      },
      ai: {
        base: '/api/ai',
        endpoints: [
          { method: 'POST', path: '/sessions', description: 'Create chat session' },
          { method: 'POST', path: '/sessions/:id/messages', description: 'Send message' },
          { method: 'GET', path: '/memories', description: 'Get AI memories' },
          { method: 'POST', path: '/memories', description: 'Create memory' },
        ],
      },
      iai: {
        base: '/api/admin/iai',
        endpoints: [
          { method: 'GET', path: '/soldiers', description: 'List IAI soldiers' },
          { method: 'GET', path: '/stats', description: 'Get IAI statistics' },
          { method: 'POST', path: '/prototype/create', description: 'Create prototype browser session' },
          { method: 'POST', path: '/prototype/:id/action', description: 'Execute browser action' },
        ],
      },
    },
    summary: 'Complete API routes documentation for the DealersFace platform',
    importance: 0.95,
  },

  // Database Schema Overview
  {
    scope: SCOPE.GLOBAL,
    category: CATEGORY.FACT,
    key: 'database_schema',
    value: {
      core_tables: [
        { name: 'users', description: 'User accounts and auth info' },
        { name: 'accounts', description: 'Dealership accounts (tenants)' },
        { name: 'account_users', description: 'User-account membership with roles' },
        { name: 'vehicles', description: 'Vehicle inventory' },
        { name: 'leads', description: 'Customer leads' },
        { name: 'messages', description: 'Messenger conversations' },
      ],
      facebook_tables: [
        { name: 'fb_accounts', description: 'Connected Facebook accounts' },
        { name: 'fb_marketplace_posts', description: 'FB Marketplace listings' },
        { name: 'fbm_post_logs', description: 'Posting activity logs' },
      ],
      ai_tables: [
        { name: 'ai_user_memories', description: 'Nova memory storage' },
        { name: 'ai_chat_sessions', description: 'Chat sessions' },
        { name: 'ai_chat_messages', description: 'Chat messages' },
        { name: 'ai_providers', description: 'AI provider configs' },
        { name: 'ai_threats', description: 'Detected security threats' },
      ],
      iai_tables: [
        { name: 'iai_soldiers', description: 'Browser automation soldiers' },
        { name: 'iai_tasks', description: 'Task queue for soldiers' },
        { name: 'iai_session_logs', description: 'Session activity logs' },
      ],
    },
    summary: 'PostgreSQL database schema with core, Facebook, AI, and IAI tables',
    importance: 0.9,
  },

  // File Structure
  {
    scope: SCOPE.GLOBAL,
    category: CATEGORY.FACT,
    key: 'codebase_structure',
    value: {
      backend: {
        root: '/src',
        controllers: '/src/controllers',
        routes: '/src/routes',
        services: '/src/services',
        middleware: '/src/middleware',
        config: '/src/config',
        utils: '/src/utils',
        entry: '/src/server.ts',
      },
      frontend: {
        root: '/web/src',
        pages: '/web/src/pages',
        components: '/web/src/components',
        hooks: '/web/src/hooks',
        services: '/web/src/services',
        contexts: '/web/src/contexts',
        lib: '/web/src/lib',
        config: '/web/src/config',
      },
      prisma: {
        schema: '/prisma/schema.prisma',
        migrations: '/prisma/migrations',
        seeds: '/prisma/seeds',
      },
      python_workers: {
        root: '/python-workers',
        api: '/python-workers/api',
        workers: '/python-workers/workers',
        browser: '/python-workers/browser',
      },
    },
    summary: 'Project file structure for backend, frontend, prisma, and python workers',
    importance: 0.85,
  },

  // Error Codes Reference
  {
    scope: SCOPE.GLOBAL,
    category: CATEGORY.FACT,
    key: 'error_codes',
    value: {
      auth_errors: {
        'AUTH_REQUIRED': 'User must be logged in',
        'INVALID_TOKEN': 'JWT token is invalid or malformed',
        'TOKEN_EXPIRED': 'JWT token has expired, needs refresh',
        'PERMISSION_DENIED': 'User lacks required permissions',
        'ACCOUNT_DISABLED': 'User account has been deactivated',
      },
      api_errors: {
        'VALIDATION_ERROR': 'Request body failed validation',
        'NOT_FOUND': 'Requested resource not found',
        'CONFLICT': 'Resource already exists or state conflict',
        'RATE_LIMITED': 'Too many requests, try again later',
      },
      facebook_errors: {
        'FB_TOKEN_EXPIRED': 'Facebook access token expired',
        'FB_PERMISSION_DENIED': 'Missing Facebook permissions',
        'FB_RATE_LIMITED': 'Facebook API rate limit hit',
        'FB_POST_FAILED': 'Failed to create Marketplace post',
      },
    },
    summary: 'Common error codes and their meanings for debugging',
    importance: 0.8,
  },
];

// ============================================
// SUPER ADMIN KNOWLEDGE - Root admin tooling
// ============================================
const SUPER_ADMIN_MEMORIES: MemoryEntry[] = [
  // SSH and Server Access
  {
    scope: SCOPE.ROLE,
    category: CATEGORY.INSTRUCTION,
    key: 'server_access',
    value: {
      ssh_command: 'ssh root@46.4.224.182',
      deployment_path: '/opt/facemydealer',
      commands: {
        view_logs: 'docker compose -f docker-compose.production.yml logs -f --tail=100',
        view_api_logs: 'docker compose -f docker-compose.production.yml logs api --tail=100',
        restart_api: 'docker compose -f docker-compose.production.yml restart api',
        rebuild_deploy: 'docker compose -f docker-compose.production.yml build api --no-cache && docker compose -f docker-compose.production.yml up -d api',
        check_status: 'docker compose -f docker-compose.production.yml ps',
        check_health: 'curl -s https://dealersface.com/health | python3 -m json.tool',
        db_shell: 'docker compose -f docker-compose.production.yml exec postgres psql -U facemydealer -d facemydealer',
        redis_cli: 'docker compose -f docker-compose.production.yml exec redis redis-cli',
      },
    },
    summary: 'SSH server access commands for deployment and troubleshooting',
    importance: 1.0,
    userRole: 'super_admin',
  },

  // Deployment Process
  {
    scope: SCOPE.ROLE,
    category: CATEGORY.INSTRUCTION,
    key: 'deployment_process',
    value: {
      steps: [
        '1. Make code changes locally',
        '2. Build locally: npm run build (in root and web/)',
        '3. Commit and push to GitHub: git add . && git commit -m "message" && git push',
        '4. SSH to server: ssh root@46.4.224.182',
        '5. Navigate: cd /opt/facemydealer',
        '6. Pull changes: git pull origin main',
        '7. Rebuild: docker compose -f docker-compose.production.yml build api --no-cache',
        '8. Deploy: docker compose -f docker-compose.production.yml up -d api',
        '9. Verify: docker compose -f docker-compose.production.yml ps',
        '10. Check logs: docker compose -f docker-compose.production.yml logs api --tail=50',
      ],
      rollback: 'git checkout <previous-commit> && docker compose -f docker-compose.production.yml build api && docker compose -f docker-compose.production.yml up -d api',
      emergency_restart: 'docker compose -f docker-compose.production.yml down && docker compose -f docker-compose.production.yml up -d',
    },
    summary: 'Complete deployment process from local to production',
    importance: 1.0,
    userRole: 'super_admin',
  },

  // Database Operations
  {
    scope: SCOPE.ROLE,
    category: CATEGORY.INSTRUCTION,
    key: 'database_operations',
    value: {
      connection: {
        host: 'postgres (Docker internal)',
        external_port: 5432,
        database: 'facemydealer',
        user: 'facemydealer',
      },
      common_queries: {
        list_users: 'SELECT id, email, "firstName", "lastName", "isActive" FROM users ORDER BY "createdAt" DESC;',
        list_accounts: 'SELECT id, name, "dealershipName", "subscriptionPlan" FROM accounts;',
        user_roles: 'SELECT u.email, au.role, a.name FROM users u JOIN account_users au ON u.id = au."userId" JOIN accounts a ON au."accountId" = a.id;',
        vehicle_count: 'SELECT COUNT(*) as total, a.name FROM vehicles v JOIN accounts a ON v."accountId" = a.id GROUP BY a.name;',
        recent_posts: 'SELECT id, title, status, "postedAt" FROM fb_marketplace_posts ORDER BY "createdAt" DESC LIMIT 10;',
      },
      prisma_commands: {
        migrate: 'npx prisma migrate deploy',
        generate: 'npx prisma generate',
        studio: 'npx prisma studio',
        seed: 'npx prisma db seed',
      },
    },
    summary: 'Database connection info and common SQL queries',
    importance: 0.95,
    userRole: 'super_admin',
  },

  // Environment Variables
  {
    scope: SCOPE.ROLE,
    category: CATEGORY.FACT,
    key: 'environment_variables',
    value: {
      location: '/opt/facemydealer/.env',
      critical_vars: [
        'DATABASE_URL - PostgreSQL connection string',
        'REDIS_URL - Redis connection string',
        'JWT_SECRET - JWT signing secret',
        'JWT_REFRESH_SECRET - Refresh token secret',
        'ENCRYPTION_KEY - Data encryption key',
        'OPENAI_API_KEY - OpenAI API key for Nova',
        'ANTHROPIC_API_KEY - Claude API key',
        'FACEBOOK_APP_ID - FB app ID',
        'FACEBOOK_APP_SECRET - FB app secret',
        'AWS_ACCESS_KEY_ID - AWS for S3/SES',
        'AWS_SECRET_ACCESS_KEY - AWS secret',
      ],
      view_command: 'cat /opt/facemydealer/.env | grep -v PASSWORD | grep -v SECRET | grep -v KEY',
    },
    summary: 'Environment variables location and critical configuration',
    importance: 0.9,
    userRole: 'super_admin',
  },

  // Troubleshooting Guide
  {
    scope: SCOPE.ROLE,
    category: CATEGORY.INSTRUCTION,
    key: 'troubleshooting_guide',
    value: {
      '403_forbidden': {
        causes: ['CSRF token missing', 'Invalid JWT', 'User inactive', 'Route not in CSRF skip list'],
        diagnosis: 'Check server logs for specific error message',
        fix_csrf: 'Add route to CSRF skip list in src/server.ts around line 436-476',
        fix_auth: 'Check if user exists and isActive=true in database',
      },
      '401_unauthorized': {
        causes: ['Missing Bearer token', 'Expired JWT', 'Invalid token'],
        diagnosis: 'Check localStorage for accessToken, check token expiry',
        fix: 'Force re-login or check JWT_SECRET matches production',
      },
      '502_bad_gateway': {
        causes: ['API container crashed', 'Traefik misconfiguration'],
        diagnosis: 'docker compose -f docker-compose.production.yml ps',
        fix: 'Restart API: docker compose -f docker-compose.production.yml restart api',
      },
      'websocket_failed': {
        causes: ['WebSocket route not configured', 'Traefik not forwarding WS'],
        diagnosis: 'Check Traefik labels in docker-compose.production.yml',
        fix: 'Add WebSocket middleware to Traefik configuration',
      },
      'database_error': {
        causes: ['Connection pool exhausted', 'Migration needed', 'Table missing'],
        diagnosis: 'Check postgres logs, try psql connection',
        fix_pool: 'Restart API container to reset pool',
        fix_migration: 'npx prisma migrate deploy',
      },
    },
    summary: 'Common error troubleshooting guide with diagnosis and fixes',
    importance: 0.95,
    userRole: 'super_admin',
  },

  // Navigation Commands for AI
  {
    scope: SCOPE.ROLE,
    category: CATEGORY.INSTRUCTION,
    key: 'ai_navigation_commands',
    value: {
      file_search: {
        description: 'Find files by pattern',
        example: 'Find all TypeScript files containing "memory": grep -r "memory" --include="*.ts" src/',
      },
      code_search: {
        description: 'Search for code patterns',
        examples: [
          'Find route definitions: grep -r "router.post\\|router.get" src/routes/',
          'Find all exports: grep -r "export const\\|export function" src/',
          'Find imports: grep -r "import.*from" src/services/',
        ],
      },
      api_testing: {
        description: 'Test API endpoints',
        examples: [
          'Health check: curl -s https://dealersface.com/health',
          'Auth test: curl -X POST https://dealersface.com/api/auth/login -H "Content-Type: application/json" -d \'{"email":"test@test.com","password":"test"}\'',
        ],
      },
      log_analysis: {
        description: 'Analyze production logs',
        examples: [
          'Error search: docker compose logs api 2>&1 | grep -i error | tail -50',
          'Request trace: docker compose logs api 2>&1 | grep "POST\\|GET" | tail -100',
        ],
      },
    },
    summary: 'AI tooling commands for code navigation and debugging',
    importance: 0.9,
    userRole: 'super_admin',
  },

  // Feature Flags and Settings
  {
    scope: SCOPE.ROLE,
    category: CATEGORY.FACT,
    key: 'feature_flags',
    value: {
      ai_features: {
        nova_enabled: true,
        atlas_enabled: true,
        echo_enabled: true,
        nexus_enabled: true,
        ai_memory_enabled: true,
        ai_intervention_enabled: true,
      },
      facebook_features: {
        marketplace_posting: true,
        messenger_sync: true,
        auto_response: true,
      },
      iai_features: {
        browser_automation: true,
        prototype_mode: true,
        soldier_deployment: true,
      },
      security: {
        csrf_enabled: true,
        rate_limiting: true,
        ip_whitelist: true,
        jwt_rotation: true,
      },
    },
    summary: 'Current feature flags and their states',
    importance: 0.85,
    userRole: 'super_admin',
  },

  // Security Knowledge
  {
    scope: SCOPE.ROLE,
    category: CATEGORY.FACT,
    key: 'security_architecture',
    value: {
      middleware_stack: [
        'Ring 1: Gateway (request ID)',
        'Ring 2: IP Sentinel (IP logging)',
        'Ring 3: Rate Shield (rate limiting)',
        'Ring 4: Request Validator (input validation)',
        'Ring 5: Auth Barrier (JWT verification)',
        'Ring 6: API Key Fortress (service auth)',
        'Ring 7: RBAC Guardian (role-based access)',
      ],
      auth_flow: {
        login: 'POST /api/auth/login → JWT + Refresh Token',
        refresh: 'POST /api/auth/refresh-token → New JWT',
        protected: 'Bearer token in Authorization header',
      },
      csrf_protected: ['POST', 'PUT', 'PATCH', 'DELETE'],
      csrf_exempt_paths: [
        '/subscriptions/webhook',
        '/facebook/callback',
        '/auth/login',
        '/auth/register',
        '/admin/iai',
        '/vehicles',
        '/leads',
        '/accounts',
      ],
    },
    summary: 'Security middleware stack and authentication flow',
    importance: 0.9,
    userRole: 'super_admin',
  },

  // Nova Identity
  {
    scope: SCOPE.ROLE,
    category: CATEGORY.PERSONALITY,
    key: 'nova_identity',
    value: {
      name: 'Nova',
      full_name: 'Neural Operations & Virtual Administrator',
      role: 'Super Admin AI Assistant + Developer Companion',
      creator: 'GAD Productions',
      personality: ['Technical', 'Precise', 'Proactive', 'Developer-friendly'],
      capabilities: [
        'Full codebase knowledge',
        'Production server access commands',
        'Database query assistance',
        'Debugging and troubleshooting',
        'Deployment guidance',
        'Security analysis',
      ],
      restrictions: [
        'Cannot execute commands directly (provides commands for user to run)',
        'Cannot access external systems without user action',
        'Must verify sensitive operations with user',
      ],
    },
    summary: 'Nova\'s identity, personality, and capabilities',
    importance: 1.0,
    userRole: 'super_admin',
  },
];

// ============================================
// ADMIN MEMORIES - Account-level administration
// ============================================
const ADMIN_MEMORIES: MemoryEntry[] = [
  {
    scope: SCOPE.ROLE,
    category: CATEGORY.INSTRUCTION,
    key: 'admin_dashboard_guide',
    value: {
      access_path: '/admin',
      sections: [
        { name: 'Users', path: '/admin/users', description: 'Manage account users' },
        { name: 'Accounts', path: '/admin/accounts', description: 'Account management' },
        { name: 'IAI Command', path: '/admin/iai', description: 'IAI soldier management' },
        { name: 'FBM Posts', path: '/admin/fbm-posts', description: 'Facebook Marketplace posts' },
        { name: 'System', path: '/admin/system', description: 'System settings' },
      ],
      permissions: ['Can manage users within account', 'Can view account stats', 'Cannot access other accounts'],
    },
    summary: 'Admin dashboard navigation and permissions guide',
    importance: 0.9,
    userRole: 'admin',
  },
];

// ============================================
// SEED FUNCTION
// ============================================
async function seedAIMemories() {
  console.log('🧠 Seeding AI Memories...');

  // Get or create a system user for seeding
  let systemUser = await prisma.user.findFirst({
    where: { email: 'admin@gadproductions.com' },
  });

  if (!systemUser) {
    console.log('⚠️ System admin user not found, creating memories without userId');
  }

  const userId = systemUser?.id || 'system';

  // Helper to create memory
  const createMemory = async (memory: MemoryEntry) => {
    try {
      await prisma.aIUserMemory.upsert({
        where: {
          userId_scope_category_key: {
            userId,
            scope: memory.scope,
            category: memory.category,
            key: memory.key,
          },
        },
        update: {
          value: memory.value,
          summary: memory.summary,
          importance: memory.importance,
          userRole: memory.userRole,
          source: 'system',
          updatedAt: new Date(),
        },
        create: {
          userId,
          scope: memory.scope,
          category: memory.category,
          key: memory.key,
          value: memory.value,
          summary: memory.summary,
          importance: memory.importance,
          userRole: memory.userRole,
          source: 'system',
        },
      });
      console.log(`  ✅ ${memory.scope}/${memory.category}/${memory.key}`);
    } catch (err: any) {
      console.error(`  ❌ Failed to create ${memory.key}:`, err.message);
    }
  };

  // Seed Global memories
  console.log('\n📚 Seeding Global Knowledge...');
  for (const memory of GLOBAL_MEMORIES) {
    await createMemory(memory);
  }

  // Seed Super Admin memories
  console.log('\n🔐 Seeding Super Admin Knowledge...');
  for (const memory of SUPER_ADMIN_MEMORIES) {
    await createMemory(memory);
  }

  // Seed Admin memories
  console.log('\n👔 Seeding Admin Knowledge...');
  for (const memory of ADMIN_MEMORIES) {
    await createMemory(memory);
  }

  // Log statistics
  const totalMemories = await prisma.aIUserMemory.count();
  console.log(`\n✨ AI Memory Seeding Complete!`);
  console.log(`   Total memories in database: ${totalMemories}`);
  console.log(`   Global: ${GLOBAL_MEMORIES.length}`);
  console.log(`   Super Admin: ${SUPER_ADMIN_MEMORIES.length}`);
  console.log(`   Admin: ${ADMIN_MEMORIES.length}`);
}

// Run seeder
seedAIMemories()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('Seeding failed:', e);
    prisma.$disconnect();
    process.exit(1);
  });
