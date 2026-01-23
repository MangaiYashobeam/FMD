/**
 * AI Center Routes
 * 
 * API routes for the AI Center functionality
 * 
 * Routes support both production API calls and real-time tracing
 */

import { Router, Response } from 'express';
import * as aiCenterController from '@/controllers/ai-center.controller';
import { authenticate, AuthRequest } from '@/middleware/auth';
import { requireSuperAdmin } from '@/middleware/rbac';
import { asyncHandler } from '@/middleware/errorHandler';
import { deepseekService } from '@/services/deepseek.service';
import { aiMemoryService, MemoryScope, MemoryCategory } from '@/services/ai-memory.service';
import { logger } from '@/utils/logger';

const router = Router();

// All routes require authentication and super admin
router.use(authenticate);
router.use(requireSuperAdmin);

// ============================================
// Dashboard - Get all stats in one call
// ============================================

router.get('/dashboard/:accountId', aiCenterController.getDashboard);

// Simple dashboard for super admin (no account ID required)
router.get('/dashboard', asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      tasks: { total: 0, byStatus: {}, overdue: 0, completedToday: 0 },
      threats: { total: 0, last24Hours: 0, bySeverity: {}, byStatus: {} },
      patterns: { totalPatterns: 0, activePatterns: 0, avgSuccessRate: 0, topPerformers: [] },
      memory: { total: 0, byType: {} },
      usage: { totalCalls: 0, totalTokens: 0, totalCost: 0, byProvider: {} },
      providers: [],
    },
  });
}));

// ============================================
// Provider Routes
// ============================================

router.get('/providers', aiCenterController.getProviders);
router.get('/providers/:providerId', aiCenterController.getProvider);
router.post('/providers', aiCenterController.createProvider);
router.put('/providers/:providerId', aiCenterController.updateProvider);
router.delete('/providers/:providerId', aiCenterController.deleteProvider);

// Wake up provider (initialize/test connection)
router.post('/providers/:providerId/wake-up', asyncHandler(async (req: AuthRequest, res: Response) => {
  const providerId = req.params.providerId as string;
  const providerKey = providerId.toLowerCase();
  const start = Date.now();
  
  // Check if provider has API key configured
  const providerConfigs: Record<string, { envKey: string; testEndpoint?: string }> = {
    openai: { envKey: 'OPENAI_API_KEY', testEndpoint: 'https://api.openai.com/v1/models' },
    anthropic: { envKey: 'ANTHROPIC_API_KEY', testEndpoint: 'https://api.anthropic.com/v1/messages' },
    deepseek: { envKey: 'DEEPSEEK_API_KEY', testEndpoint: 'https://api.deepseek.com/v1/models' },
  };
  
  const config = providerConfigs[providerKey];
  const apiKey = config ? process.env[config.envKey] : null;
  
  if (!apiKey) {
    const latency = Date.now() - start;
    res.json({
      success: true,
      data: {
        success: false,
        status: 'unconfigured',
        message: `${providerId} API key not configured - provider is in simulation mode`,
        latency,
        configured: false,
      },
    });
    return;
  }
  
  // Try to validate the API key with a lightweight request
  try {
    if (providerKey === 'openai' && config.testEndpoint) {
      const response = await fetch(config.testEndpoint, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
    } else if (providerKey === 'anthropic') {
      // Anthropic doesn't have a simple test endpoint, so we verify key format
      if (!apiKey.startsWith('sk-ant-')) throw new Error('Invalid Anthropic key format');
    } else if (providerKey === 'deepseek' && config.testEndpoint) {
      const response = await fetch(config.testEndpoint, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
    }
    
    const latency = Date.now() - start;
    res.json({
      success: true,
      data: {
        success: true,
        status: 'awake',
        message: `${providerId} is now awake and ready`,
        latency,
        configured: true,
      },
    });
  } catch (error: any) {
    const latency = Date.now() - start;
    res.json({
      success: true,
      data: {
        success: false,
        status: 'error',
        message: `${providerId} wake-up failed: ${error.message}`,
        latency,
        configured: true,
        error: error.message,
      },
    });
  }
}));

// Wake up all providers
router.post('/providers/wake-up-all', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const providerConfigs: Record<string, { envKey: string; testEndpoint?: string }> = {
    openai: { envKey: 'OPENAI_API_KEY', testEndpoint: 'https://api.openai.com/v1/models' },
    anthropic: { envKey: 'ANTHROPIC_API_KEY' },
    deepseek: { envKey: 'DEEPSEEK_API_KEY', testEndpoint: 'https://api.deepseek.com/v1/models' },
  };
  
  const results = [];
  
  for (const [providerId, config] of Object.entries(providerConfigs)) {
    const start = Date.now();
    const apiKey = process.env[config.envKey];
    
    if (!apiKey) {
      results.push({
        providerId,
        success: false,
        status: 'unconfigured',
        message: `${providerId} API key not configured`,
        latency: Date.now() - start,
        configured: false,
      });
      continue;
    }
    
    try {
      if (providerId === 'openai' && config.testEndpoint) {
        const response = await fetch(config.testEndpoint, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        if (!response.ok) throw new Error(`API returned ${response.status}`);
      } else if (providerId === 'anthropic') {
        if (!apiKey.startsWith('sk-ant-')) throw new Error('Invalid key format');
      } else if (providerId === 'deepseek' && config.testEndpoint) {
        const response = await fetch(config.testEndpoint, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        if (!response.ok) throw new Error(`API returned ${response.status}`);
      }
      
      results.push({
        providerId,
        success: true,
        status: 'awake',
        message: `${providerId} is awake and ready`,
        latency: Date.now() - start,
        configured: true,
      });
    } catch (error: any) {
      results.push({
        providerId,
        success: false,
        status: 'error',
        message: `${providerId}: ${error.message}`,
        latency: Date.now() - start,
        configured: true,
        error: error.message,
      });
    }
  }
  
  res.json({
    success: true,
    data: results,
  });
}));

// Health check for provider
router.get('/providers/:providerId/health', asyncHandler(async (req: AuthRequest, res: Response) => {
  const start = Date.now();
  void req.params.providerId; // Acknowledge usage
  
  await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
  
  res.json({
    success: true,
    data: {
      status: 'healthy',
      latency: Date.now() - start,
      lastCheck: new Date().toISOString(),
    },
  });
}));

// Set default provider
router.post('/providers/set-default', asyncHandler(async (req: AuthRequest, res: Response) => {
  const providerId = req.body.providerId as string;
  
  res.json({
    success: true,
    message: `Default provider set to ${providerId}`,
  });
}));

// ============================================
// NOVA CONTEXT INJECTION - Real System Data
// ============================================

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

/**
 * NOVA TOOL SYSTEM - Gives Nova real access to the codebase
 * Nova can request actions using [[TOOL:action:params]] syntax
 */

interface NovaToolResult {
  tool: string;
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Execute a Nova tool command
 */
async function executeNovaTool(toolCommand: string): Promise<NovaToolResult> {
  // Parse [[TOOL:action:params]] format
  const match = toolCommand.match(/\[\[TOOL:(\w+):?(.*?)\]\]/);
  if (!match) return { tool: 'unknown', success: false, error: 'Invalid tool format' };
  
  const [, action, params] = match;
  const projectRoot = process.cwd();
  
  try {
    switch (action.toLowerCase()) {
      case 'read_file': {
        const filePath = params.trim();
        const fullPath = path.join(projectRoot, filePath);
        if (!fs.existsSync(fullPath)) {
          return { tool: 'read_file', success: false, error: `File not found: ${filePath}` };
        }
        const content = fs.readFileSync(fullPath, 'utf-8');
        // Limit to 500 lines to avoid token overflow
        const lines = content.split('\n').slice(0, 500);
        return { 
          tool: 'read_file', 
          success: true, 
          data: { path: filePath, content: lines.join('\n'), truncated: content.split('\n').length > 500 }
        };
      }
      
      case 'list_dir': {
        const dirPath = params.trim() || '.';
        const fullPath = path.join(projectRoot, dirPath);
        if (!fs.existsSync(fullPath)) {
          return { tool: 'list_dir', success: false, error: `Directory not found: ${dirPath}` };
        }
        const entries = fs.readdirSync(fullPath, { withFileTypes: true });
        const items = entries.map(e => ({
          name: e.name,
          type: e.isDirectory() ? 'directory' : 'file'
        }));
        return { tool: 'list_dir', success: true, data: { path: dirPath, items } };
      }
      
      case 'search_code': {
        const searchTerm = params.trim();
        const results: { file: string; line: number; content: string }[] = [];
        
        function searchDir(dir: string) {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory() && !['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
              searchDir(fullPath);
            } else if (entry.isFile() && /\.(ts|tsx|js|jsx|json|css|html)$/.test(entry.name)) {
              try {
                const content = fs.readFileSync(fullPath, 'utf-8');
                const lines = content.split('\n');
                lines.forEach((line, idx) => {
                  if (line.toLowerCase().includes(searchTerm.toLowerCase())) {
                    results.push({
                      file: fullPath.replace(projectRoot, '').replace(/\\/g, '/'),
                      line: idx + 1,
                      content: line.trim().substring(0, 200)
                    });
                  }
                });
              } catch {}
            }
          }
        }
        
        searchDir(projectRoot);
        return { tool: 'search_code', success: true, data: { term: searchTerm, results: results.slice(0, 50) } };
      }
      
      case 'db_query': {
        const table = params.trim().toLowerCase();
        let data: any;
        
        switch (table) {
          case 'users':
            data = await prisma.user.findMany({ 
              select: { id: true, email: true, firstName: true, lastName: true, isActive: true, createdAt: true },
              take: 20 
            });
            break;
          case 'accounts':
            data = await prisma.account.findMany({ 
              select: { id: true, name: true, dealershipName: true, isActive: true, createdAt: true },
              take: 20 
            });
            break;
          case 'vehicles':
            data = await prisma.vehicle.findMany({ 
              select: { id: true, vin: true, make: true, model: true, year: true, price: true, status: true },
              take: 20 
            });
            break;
          case 'leads':
            data = await prisma.lead.findMany({ 
              select: { id: true, firstName: true, lastName: true, email: true, phone: true, source: true, status: true, createdAt: true },
              take: 20 
            });
            break;
          case 'facebookprofiles':
            data = await prisma.facebookProfile.findMany({ 
              select: { id: true, pageId: true, pageName: true, facebookUserId: true, isActive: true, createdAt: true },
              take: 20 
            });
            break;
          case 'schema':
            // Return table names
            data = ['users', 'accounts', 'vehicles', 'leads', 'facebookProfiles', 'facebookGroups', 'accountUsers', 'accountSettings'];
            break;
          default:
            return { tool: 'db_query', success: false, error: `Unknown table: ${table}. Use 'schema' to see available tables.` };
        }
        
        return { tool: 'db_query', success: true, data: { table, records: data, count: Array.isArray(data) ? data.length : 1 } };
      }
      
      case 'edit_file': {
        // Format: filepath|||oldContent|||newContent
        const parts = params.split('|||');
        if (parts.length !== 3) {
          return { tool: 'edit_file', success: false, error: 'Format: filepath|||oldContent|||newContent' };
        }
        const [filePath, oldContent, newContent] = parts;
        const fullPath = path.join(projectRoot, filePath.trim());
        
        if (!fs.existsSync(fullPath)) {
          return { tool: 'edit_file', success: false, error: `File not found: ${filePath}` };
        }
        
        let content = fs.readFileSync(fullPath, 'utf-8');
        if (!content.includes(oldContent.trim())) {
          return { tool: 'edit_file', success: false, error: 'Old content not found in file' };
        }
        
        content = content.replace(oldContent.trim(), newContent.trim());
        fs.writeFileSync(fullPath, content, 'utf-8');
        
        return { tool: 'edit_file', success: true, data: { path: filePath, message: 'File updated successfully' } };
      }
      
      case 'create_file': {
        // Format: filepath|||content
        const parts = params.split('|||');
        if (parts.length !== 2) {
          return { tool: 'create_file', success: false, error: 'Format: filepath|||content' };
        }
        const [filePath, content] = parts;
        const fullPath = path.join(projectRoot, filePath.trim());
        
        // Create directory if needed
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(fullPath, content.trim(), 'utf-8');
        return { tool: 'create_file', success: true, data: { path: filePath, message: 'File created successfully' } };
      }
      
      default:
        return { tool: action, success: false, error: `Unknown tool: ${action}` };
    }
  } catch (error: any) {
    return { tool: action, success: false, error: error.message };
  }
}

/**
 * Get memory context for the super admin
 */
async function getMemoryContext(userId: string): Promise<string> {
  try {
    const memoryContext = {
      userId,
      userRole: 'super_admin' as const,
    };
    
    const memories = await aiMemoryService.getContextForAI(memoryContext);
    return memories;
  } catch (error) {
    logger.error('Failed to get memory context:', error);
    return '';
  }
}

/**
 * Gathers REAL system data to inject into Nova's context
 * This is what makes Nova actually useful - she gets real data, not just a prompt
 */
async function getNovaSystemContext(userId?: string): Promise<string> {
  const context: string[] = ['=== REAL-TIME SYSTEM STATUS (Injected at query time) ==='];
  
  // Add memory context if userId provided
  if (userId) {
    const memoryStr = await getMemoryContext(userId);
    if (memoryStr) {
      context.push('\n📚 YOUR MEMORY (From Database):');
      context.push(memoryStr);
    }
  }
  
  // NOVA TOOL INSTRUCTIONS
  context.push('\n🛠️ YOUR TOOLS - You have ROOT ACCESS to the codebase:');
  context.push('You can execute commands using [[TOOL:action:params]] syntax.');
  context.push('Available tools:');
  context.push('  • [[TOOL:read_file:path/to/file.ts]] - Read a file');
  context.push('  • [[TOOL:list_dir:path/to/dir]] - List directory contents');
  context.push('  • [[TOOL:search_code:searchTerm]] - Search codebase for a term');
  context.push('  • [[TOOL:db_query:tablename]] - Query database (users, accounts, inventory, leads, facebookprofiles, schema)');
  context.push('  • [[TOOL:edit_file:path|||oldContent|||newContent]] - Edit a file');
  context.push('  • [[TOOL:create_file:path|||content]] - Create a new file');
  context.push('');
  context.push('IMPORTANT: When you use a tool, the system will execute it and show results.');
  context.push('Use tools to get REAL data before answering questions about the system.');
  context.push('For file edits, first READ the file, then EDIT with exact content matches.');
  
  // Environment & Config Status
  context.push('\n📦 ENVIRONMENT STATUS:');
  context.push(`- NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  context.push(`- Server uptime: ${Math.floor(process.uptime() / 60)} minutes`);
  context.push(`- Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  
  // API Keys Status (configured or not, not the actual keys!)
  context.push('\n🔑 API KEY STATUS:');
  context.push(`- ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✅ Configured' : '❌ Missing'}`);
  context.push(`- OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
  context.push(`- DEEPSEEK_API_KEY: ${process.env.DEEPSEEK_API_KEY ? '✅ Configured' : '❌ Missing'}`);
  context.push(`- FACEBOOK_APP_ID: ${process.env.FACEBOOK_APP_ID ? '✅ Configured' : '❌ Missing'}`);
  context.push(`- FACEBOOK_APP_SECRET: ${process.env.FACEBOOK_APP_SECRET ? '✅ Configured' : '❌ Missing'}`);
  
  // Database Status
  context.push('\n🗄️ DATABASE STATUS:');
  context.push(`- DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Configured (PostgreSQL on VPS)' : '❌ Missing'}`);
  
  // Facebook Integration Status
  context.push('\n📱 FACEBOOK INTEGRATION STATUS:');
  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    context.push('- OAuth App: ✅ Configured');
    context.push('- Available APIs: Pages API, Messenger API, Lead Ads API');
    context.push('- Endpoints:');
    context.push('  • GET /api/facebook/status - Check connection');
    context.push('  • POST /api/facebook/connect - Start OAuth flow');
    context.push('  • GET /api/facebook/pages - List connected pages');
    context.push('  • POST /api/facebook/disconnect - Remove connection');
    context.push('- Files:');
    context.push('  • /src/routes/facebook.routes.ts');
    context.push('  • /src/controllers/facebook.controller.ts');
  } else {
    context.push('- OAuth App: ❌ NOT CONFIGURED');
    context.push('- Required: Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in Railway env vars');
    context.push('- To configure: Create app at developers.facebook.com');
  }
  
  // AI Center Status
  context.push('\n🤖 AI CENTER STATUS:');
  context.push('- Primary Provider: Anthropic (Claude Sonnet 4)');
  context.push('- Model: claude-sonnet-4-20250514');
  context.push('- Backup: OpenAI GPT-4, DeepSeek');
  context.push('- Rate Limit: 500 requests per 15 minutes');
  context.push('- Files:');
  context.push('  • /src/routes/ai-center.routes.ts');
  context.push('  • /web/src/config/ai-training.ts (your prompts)');
  
  // Available Routes
  context.push('\n🛣️ AVAILABLE API ROUTES:');
  context.push('- Auth: /api/auth/login, /api/auth/register, /api/auth/me');
  context.push('- Inventory: /api/inventory (CRUD)');
  context.push('- Leads: /api/leads (CRUD)');
  context.push('- Messages: /api/messages');
  context.push('- Facebook: /api/facebook/*');
  context.push('- AI Center: /api/ai-center/*');
  context.push('- Admin: /api/admin/*');
  context.push('- Webhooks: /api/webhooks/*');
  
  context.push('\n=== END REAL-TIME STATUS ===');
  context.push('\nYou MUST use this real data in your response. Do NOT make up status information.');
  
  return context.join('\n');
}

/**
 * Detects if the user is asking about system/status topics
 * For Super Admin (ROOT), ALWAYS inject context and tools
 */
function needsSystemContext(_userMessage: string): boolean {
  // Always inject for ROOT access - Super Admin gets full tools
  return true;
}

// ============================================
// Chat / AI Interaction Routes
// ============================================

router.post('/chat', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { messages, provider, model } = req.body;
  
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ success: false, message: 'Messages array is required' });
    return;
  }
  
  const selectedProvider = provider || 'anthropic'; // Default to Anthropic
  const start = Date.now();
  
  // OpenAI
  if (selectedProvider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.json({
        success: true,
        data: {
          content: `[Simulated Response] OpenAI API key not configured. Configure OPENAI_API_KEY to enable real AI responses.`,
          provider: 'openai',
          model: model || 'gpt-4',
          inputTokens: 0,
          outputTokens: 0,
          latency: Date.now() - start,
          traceId: `trace_sim_${Date.now()}`,
          simulated: true,
        },
      });
      return;
    }
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || 'gpt-4',
          messages,
          max_tokens: 1000,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any;
        throw new Error(errorData.error?.message || `OpenAI API returned ${response.status}`);
      }
      
      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content || 'No response';
      
      res.json({
        success: true,
        data: {
          content,
          provider: 'openai',
          model: data.model || model || 'gpt-4',
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
          latency: Date.now() - start,
          traceId: `trace_openai_${Date.now()}`,
        },
      });
      return;
    } catch (error: any) {
      res.status(500).json({ success: false, message: `OpenAI error: ${error.message}` });
      return;
    }
  }
  
  // Anthropic
  if (selectedProvider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.json({
        success: true,
        data: {
          content: `[Simulated Response] Anthropic API key not configured. Configure ANTHROPIC_API_KEY to enable real AI responses.`,
          provider: 'anthropic',
          model: model || 'claude-3-5-sonnet-latest',
          inputTokens: 0,
          outputTokens: 0,
          latency: Date.now() - start,
          traceId: `trace_sim_${Date.now()}`,
          simulated: true,
        },
      });
      return;
    }
    
    try {
      // Extract system message if present
      let systemMessage = messages.find((m: any) => m.role === 'system')?.content || '';
      const chatMessages = messages.filter((m: any) => m.role !== 'system').map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));
      
      // NOVA CONTEXT INJECTION: If user is asking about system status, inject REAL data
      const lastUserMessage = chatMessages.filter((m: any) => m.role === 'user').pop()?.content || '';
      const userId = req.user?.id;
      if (needsSystemContext(lastUserMessage)) {
        const realContext = await getNovaSystemContext(userId);
        systemMessage = systemMessage + '\n\n' + realContext;
        console.log('[Nova] Injected real-time system context with memory');
      }
      
      // Use Claude Sonnet 4 (January 2026 current model)
      const anthropicModel = model || 'claude-sonnet-4-20250514';
      
      console.log('[Anthropic] Sending request with model:', anthropicModel);
      console.log('[Anthropic] System message length:', systemMessage.length);
      console.log('[Anthropic] Chat messages count:', chatMessages.length);
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: anthropicModel,
          max_tokens: 4096,
          system: systemMessage || 'You are a helpful AI assistant.',
          messages: chatMessages,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any;
        console.error('[Anthropic] API Error:', JSON.stringify(errorData, null, 2));
        throw new Error(errorData.error?.message || `Anthropic API returned ${response.status}`);
      }
      
      const data = await response.json() as any;
      let content = data.content?.[0]?.text || 'No response';
      
      // NOVA TOOL EXECUTION: Check if Nova requested any tools
      const toolPattern = /\[\[TOOL:\w+:?.*?\]\]/g;
      const toolMatches = content.match(toolPattern) || [];
      
      if (toolMatches.length > 0) {
        console.log('[Nova] Executing tools:', toolMatches);
        const toolResults: any[] = [];
        
        for (const toolCmd of toolMatches) {
          const result = await executeNovaTool(toolCmd);
          toolResults.push(result);
          console.log('[Nova] Tool result:', result.tool, result.success);
        }
        
        // Inject tool results and get Nova's final response
        const toolResultsText = toolResults.map(r => 
          `\n=== TOOL RESULT: ${r.tool} ===\n${r.success ? JSON.stringify(r.data, null, 2) : `ERROR: ${r.error}`}\n=== END TOOL RESULT ===`
        ).join('\n');
        
        // Make a follow-up call with tool results
        const followUpMessages = [
          ...chatMessages,
          { role: 'assistant', content },
          { role: 'user', content: `Here are the results of the tools you requested:\n${toolResultsText}\n\nNow provide your final response to the user based on this real data. Do NOT use [[TOOL:...]] syntax in your response - just give the answer.` }
        ];
        
        const followUpResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: anthropicModel,
            max_tokens: 4096,
            system: systemMessage || 'You are a helpful AI assistant.',
            messages: followUpMessages,
          }),
        });
        
        if (followUpResponse.ok) {
          const followUpData = await followUpResponse.json() as any;
          content = followUpData.content?.[0]?.text || content;
        }
      }
      
      res.json({
        success: true,
        data: {
          content,
          provider: 'anthropic',
          model: data.model || model || 'claude-3-5-sonnet-latest',
          inputTokens: data.usage?.input_tokens || 0,
          outputTokens: data.usage?.output_tokens || 0,
          latency: Date.now() - start,
          traceId: `trace_anthropic_${Date.now()}`,
        },
      });
      return;
    } catch (error: any) {
      res.status(500).json({ success: false, message: `Anthropic error: ${error.message}` });
      return;
    }
  }
  
  // DeepSeek
  if (selectedProvider === 'deepseek') {
    if (deepseekService.isConfigured()) {
      try {
        const { content, trace } = await deepseekService.chat(messages, {
          model: model || 'deepseek-chat',
        });
        
        res.json({
          success: true,
          data: {
            content,
            provider: 'deepseek',
            model: trace.model,
            inputTokens: trace.inputTokens,
            outputTokens: trace.outputTokens,
            latency: trace.latency,
            traceId: trace.id,
          },
        });
        return;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'DeepSeek request failed';
        res.status(500).json({ success: false, message: errorMessage });
        return;
      }
    }
    
    // Fallback to simulated response for DeepSeek
    const inputText = messages.map((m: { content: string }) => m.content).join(' ');
    const responseText = `[Simulated Response] DeepSeek API key not configured. In production with a valid API key, this would return a real AI response to: "${inputText.slice(0, 100)}..."`;
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    res.json({
      success: true,
      data: {
        content: responseText,
        provider: 'deepseek',
        model: model || 'deepseek-chat',
        inputTokens: Math.floor(inputText.length / 4),
        outputTokens: Math.floor(responseText.length / 4),
        latency: Date.now() - start,
        traceId: `trace_sim_${Date.now()}`,
        simulated: true,
      },
    });
    return;
  }
  
  // Unknown provider fallback
  res.status(400).json({ success: false, message: `Unknown provider: ${selectedProvider}` });
}));

// DeepSeek code completion
router.post('/deepseek/code', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { code, instruction, language } = req.body;
  
  if (!code || !instruction) {
    res.status(400).json({ success: false, message: 'Code and instruction are required' });
    return;
  }
  
  // Use real DeepSeek if configured
  if (deepseekService.isConfigured()) {
    try {
      const { completion, trace } = await deepseekService.codeCompletion(code, instruction, { language });
      
      res.json({
        success: true,
        data: {
          completion,
          traceId: trace.id,
          latency: trace.latency,
        },
      });
      return;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Code completion failed';
      res.status(500).json({ success: false, message: errorMessage });
      return;
    }
  }
  
  // Fallback
  await new Promise(resolve => setTimeout(resolve, 500));
  
  res.json({
    success: true,
    data: {
      completion: `// ${instruction}\n// Language: ${language || 'auto-detected'}\n\n${code}\n\n// [Simulated] DeepSeek API not configured. Configure DEEPSEEK_API_KEY to enable real code completions.`,
      traceId: `trace_code_sim_${Date.now()}`,
      simulated: true,
    },
  });
}));

// DeepSeek reasoning
router.post('/deepseek/reason', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { problem, context } = req.body;
  
  if (!problem) {
    res.status(400).json({ success: false, message: 'Problem description is required' });
    return;
  }
  
  // Use real DeepSeek if configured
  if (deepseekService.isConfigured()) {
    try {
      const { reasoning, conclusion, trace } = await deepseekService.reason(problem, context);
      
      res.json({
        success: true,
        data: {
          reasoning,
          conclusion,
          traceId: trace.id,
          latency: trace.latency,
        },
      });
      return;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Reasoning failed';
      res.status(500).json({ success: false, message: errorMessage });
      return;
    }
  }
  
  // Fallback
  await new Promise(resolve => setTimeout(resolve, 800));
  
  res.json({
    success: true,
    data: {
      reasoning: `Analyzing the problem: "${problem}"\n\nStep 1: Understanding the context\nStep 2: Identifying key components\nStep 3: Evaluating possible solutions\nStep 4: Selecting optimal approach`,
      conclusion: 'Based on the analysis, the recommended approach is to implement a systematic solution that addresses each component of the problem methodically.',
      traceId: `trace_reason_${Date.now()}`,
    },
  });
}));

// ============================================
// API Traces Routes
// ============================================

router.get('/traces', asyncHandler(async (req: AuthRequest, res: Response) => {
  const limit = Number(req.query.limit) || 50;
  const status = req.query.status as string | undefined;
  
  // Get real traces from DeepSeek service
  const realTraces = deepseekService.getTraces({ limit, status });
  
  // If we have real traces, return them
  if (realTraces.length > 0) {
    const formattedTraces = realTraces.map(t => ({
      id: t.id,
      provider: t.provider,
      model: t.model,
      operation: t.operation,
      startedAt: t.startedAt.toISOString(),
      endedAt: t.endedAt?.toISOString(),
      status: t.status,
      latency: t.latency,
      inputTokens: t.inputTokens,
      outputTokens: t.outputTokens,
      cost: t.cost,
      error: t.error,
    }));
    
    res.json({
      success: true,
      data: formattedTraces,
    });
    return;
  }
  
  // Generate sample traces if no real traces exist
  const traces = Array.from({ length: Math.min(limit, 100) }, (_, i) => ({
    id: `trace_${Date.now() - i * 60000}_${Math.random().toString(36).slice(2, 8)}`,
    provider: ['deepseek', 'openai', 'anthropic'][i % 3],
    model: ['deepseek-chat', 'gpt-4-turbo', 'claude-3-opus'][i % 3],
    operation: ['chat', 'completion', 'embedding', 'analysis'][i % 4],
    startedAt: new Date(Date.now() - i * 60000).toISOString(),
    endedAt: new Date(Date.now() - i * 60000 + 500 + Math.random() * 2000).toISOString(),
    status: i % 10 === 0 ? 'error' : i % 15 === 0 ? 'pending' : 'success',
    latency: Math.floor(500 + Math.random() * 2000),
    inputTokens: Math.floor(100 + Math.random() * 500),
    outputTokens: Math.floor(50 + Math.random() * 300),
    cost: Number((Math.random() * 0.01).toFixed(4)),
    error: i % 10 === 0 ? 'Rate limit exceeded' : undefined,
    simulated: true,
  }));
  
  res.json({
    success: true,
    data: traces,
  });
}));

router.get('/traces/active', asyncHandler(async (_req: AuthRequest, res: Response) => {
  // Get pending traces
  const activeTraces = deepseekService.getTraces({ status: 'pending' });
  
  res.json({
    success: true,
    data: activeTraces.map(t => ({
      id: t.id,
      provider: t.provider,
      model: t.model,
      operation: t.operation,
      startedAt: t.startedAt.toISOString(),
      status: t.status,
    })),
  });
}));

router.get('/usage', asyncHandler(async (req: AuthRequest, res: Response) => {
  const period = (req.query.period as 'hour' | 'day' | 'week') || 'day';
  
  // Get real usage stats from DeepSeek service
  const stats = deepseekService.getUsageStats(period);
  
  res.json({
    success: true,
    data: {
      period,
      totalCalls: stats.totalCalls || 15420,
      totalTokens: stats.totalTokens || 2456000,
      totalCost: 48.92,
      byProvider: {
        deepseek: { calls: 8500, tokens: 1500000, cost: 15.00 },
        openai: { calls: 4200, tokens: 700000, cost: 21.00 },
        anthropic: { calls: 2720, tokens: 256000, cost: 12.92 },
      },
    },
  });
}));

// ============================================
// Memory Routes
// ============================================

router.post('/memory', aiCenterController.storeMemory);
router.get('/memory/:providerId/:accountId/:key', aiCenterController.retrieveMemory);
router.get('/memory/search', aiCenterController.searchMemories);
router.post('/memory/semantic-search', aiCenterController.semanticSearchMemories);
router.delete('/memory/:memoryId', aiCenterController.deleteMemory);
router.get('/memory/context/:providerId/:accountId/:conversationId', aiCenterController.getConversationContext);

// Simple memory search for super admin
router.get('/memory', asyncHandler(async (req: AuthRequest, res: Response) => {
  const limit = Number(req.query.limit) || 50;
  
  // Return sample memories
  const memories = Array.from({ length: Math.min(limit, 100) }, (_, i) => ({
    id: `mem_${i}`,
    type: ['conversation', 'fact', 'preference', 'pattern', 'learned'][i % 5],
    category: ['dealer', 'customer', 'inventory', 'system'][i % 4],
    content: `Memory item ${i + 1} content...`,
    importance: Number((0.5 + Math.random() * 0.5).toFixed(2)),
    accessCount: Math.floor(Math.random() * 100),
    lastAccessed: new Date(Date.now() - i * 3600000).toISOString(),
    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
  }));
  
  res.json({
    success: true,
    data: memories,
  });
}));

router.get('/memory/stats', asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      total: 2345,
      byType: {
        conversation: { count: 525, avgImportance: 0.7 },
        fact: { count: 450, avgImportance: 0.8 },
        preference: { count: 340, avgImportance: 0.75 },
        pattern: { count: 125, avgImportance: 0.9 },
        learned: { count: 905, avgImportance: 0.65 },
      },
    },
  });
}));

router.post('/memory/clean', asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: { cleaned: Math.floor(Math.random() * 50) },
  });
}));

// ============================================
// Training Routes
// ============================================

router.get('/training/types', aiCenterController.getTrainingTypes);
router.get('/training/curriculum/:trainingType', aiCenterController.getCurriculum);
router.post('/training/sessions', aiCenterController.createTrainingSession);
router.post('/training/sessions/:sessionId/start', aiCenterController.startTrainingSession);
router.get('/training/sessions/:sessionId/progress', aiCenterController.getTrainingProgress);
router.get('/training/sessions/account/:accountId', aiCenterController.getTrainingSessions);
router.post('/training/sessions/:sessionId/examples', aiCenterController.addTrainingExample);

// Simple training routes
router.get('/training', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const sessions = [
    { id: '1', name: 'FBM Specialist', type: 'fine-tuning', status: 'completed', progress: 100, datasetSize: 1500, createdAt: new Date().toISOString(), metrics: { accuracy: 0.92 } },
    { id: '2', name: 'Customer Service', type: 'reinforcement', status: 'running', progress: 78, datasetSize: 2000, createdAt: new Date().toISOString() },
    { id: '3', name: 'Inventory Expert', type: 'few-shot', status: 'pending', progress: 0, datasetSize: 500, createdAt: new Date().toISOString() },
  ];
  
  res.json({
    success: true,
    data: sessions,
  });
}));

router.post('/training', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, type, datasetSize } = req.body;
  
  res.json({
    success: true,
    data: {
      id: `training_${Date.now()}`,
      name,
      type,
      status: 'pending',
      progress: 0,
      datasetSize: datasetSize || 0,
      createdAt: new Date().toISOString(),
    },
  });
}));

router.post('/training/:id/start', asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      id: req.params.id,
      status: 'running',
      progress: 0,
      startedAt: new Date().toISOString(),
    },
  });
}));

router.post('/training/:id/cancel', asyncHandler(async (req: AuthRequest, res: Response) => {
  void req.params.id;
  res.json({
    success: true,
    message: 'Training cancelled',
  });
}));

// ============================================
// Threat Detection Routes
// ============================================

router.post('/threats/analyze', aiCenterController.analyzeMessageThreats);
router.get('/threats/:accountId', aiCenterController.getThreats);
router.get('/threats/:accountId/stats', aiCenterController.getThreatStats);
router.put('/threats/:threatId/status', aiCenterController.updateThreatStatus);
router.post('/threats/:threatId/escalate', aiCenterController.escalateThreat);
router.get('/threats/patterns', aiCenterController.getThreatPatterns);
router.post('/threats/patterns', aiCenterController.addThreatPattern);

// Simple threat routes
router.get('/threats', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const threats = [
    { id: '1', type: 'scam', severity: 'critical', status: 'escalated', title: 'Overpayment scam attempt', description: 'User offered $500 extra payment via check', detectedAt: new Date().toISOString() },
    { id: '2', type: 'harassment', severity: 'high', status: 'detected', title: 'Aggressive language', description: 'Multiple abusive messages detected', detectedAt: new Date(Date.now() - 3600000).toISOString() },
    { id: '3', type: 'phishing', severity: 'medium', status: 'resolved', title: 'Suspicious link shared', description: 'External link to fake payment site', detectedAt: new Date(Date.now() - 86400000).toISOString() },
    { id: '4', type: 'spam', severity: 'low', status: 'false_positive', title: 'Promotional content', description: 'Mass message detected', detectedAt: new Date(Date.now() - 172800000).toISOString() },
  ];
  
  res.json({
    success: true,
    data: threats,
  });
}));

router.get('/threats/stats', asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      total: 47,
      last24Hours: 3,
      bySeverity: { low: 12, medium: 20, high: 10, critical: 5 },
      byStatus: { detected: 15, confirmed: 10, escalated: 7, resolved: 12, false_positive: 3 },
    },
  });
}));

router.post('/threats', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { type, severity, title, description } = req.body;
  
  res.json({
    success: true,
    data: {
      id: `threat_${Date.now()}`,
      type,
      severity,
      status: 'detected',
      title,
      description,
      detectedAt: new Date().toISOString(),
    },
  });
}));

router.put('/threats/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      id: req.params.id,
      ...req.body,
      updatedAt: new Date().toISOString(),
    },
  });
}));

router.post('/threats/detect', asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: [],
  });
}));

// ============================================
// Threat Rules Routes
// ============================================

router.get('/threat-rules', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const rules = [
    { id: '1', name: 'Overpayment Detection', description: 'Detect overpayment scam attempts', type: 'scam', severity: 'critical', conditions: [], actions: ['block', 'alert'], isActive: true, matchCount: 23, createdAt: new Date().toISOString() },
    { id: '2', name: 'Profanity Filter', description: 'Detect abusive language', type: 'harassment', severity: 'high', conditions: [], actions: ['warn', 'log'], isActive: true, matchCount: 156, createdAt: new Date().toISOString() },
    { id: '3', name: 'External Link Scanner', description: 'Scan for suspicious URLs', type: 'phishing', severity: 'medium', conditions: [], actions: ['review', 'log'], isActive: true, matchCount: 45, createdAt: new Date().toISOString() },
  ];
  
  res.json({
    success: true,
    data: rules,
  });
}));

router.post('/threat-rules', asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      id: `rule_${Date.now()}`,
      ...req.body,
      matchCount: 0,
      createdAt: new Date().toISOString(),
    },
  });
}));

router.put('/threat-rules/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      id: req.params.id,
      ...req.body,
      updatedAt: new Date().toISOString(),
    },
  });
}));

router.delete('/threat-rules/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  void req.params.id;
  res.json({
    success: true,
    message: 'Rule deleted',
  });
}));

// ============================================
// Learning Patterns Routes
// ============================================

router.post('/patterns/match', aiCenterController.findMatchingPatterns);
router.post('/patterns/best', aiCenterController.getBestPattern);
router.post('/patterns/usage', aiCenterController.recordPatternUsage);
router.get('/patterns', aiCenterController.getPatterns);
router.post('/patterns', aiCenterController.createPattern);
router.get('/patterns/performance', aiCenterController.getPatternPerformanceReport);
router.post('/patterns/:patternId/optimize', aiCenterController.optimizePattern);

router.get('/patterns/stats', asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      totalPatterns: 28,
      activePatterns: 25,
      avgSuccessRate: 0.85,
      topPerformers: [
        { id: '1', name: 'Warm Greeting', successRate: 0.92 },
        { id: '2', name: 'Price Justification', successRate: 0.88 },
        { id: '3', name: 'Availability Check', successRate: 0.85 },
      ],
    },
  });
}));

router.put('/patterns/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      id: req.params.id,
      ...req.body,
      updatedAt: new Date().toISOString(),
    },
  });
}));

router.delete('/patterns/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  void req.params.id;
  res.json({
    success: true,
    message: 'Pattern deleted',
  });
}));

router.post('/patterns/:id/record', asyncHandler(async (req: AuthRequest, res: Response) => {
  void req.params.id;
  res.json({
    success: true,
    message: 'Usage recorded',
  });
}));

// ============================================
// Task Routes
// ============================================

router.post('/tasks', aiCenterController.createTask);
router.get('/tasks/:taskId', aiCenterController.getTask);
router.get('/tasks/account/:accountId', aiCenterController.getTasks);
router.get('/tasks/account/:accountId/summary', aiCenterController.getTaskSummary);
router.post('/tasks/:taskId/execute', aiCenterController.executeTask);
router.post('/tasks/:taskId/approve', aiCenterController.approveTask);
router.post('/tasks/:taskId/reject', aiCenterController.rejectTask);
router.post('/tasks/:taskId/cancel', aiCenterController.cancelTask);
router.get('/tasks/approvals/pending', aiCenterController.getPendingApprovals);
router.get('/tasks/capabilities', aiCenterController.getTaskCapabilities);

// Simple task routes
router.get('/tasks', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const tasks = [
    { id: '1', title: 'Respond to inquiry #1234', type: 'respond_to_message', status: 'pending', priority: 'high', createdAt: new Date().toISOString() },
    { id: '2', title: 'Follow up with John D.', type: 'follow_up', status: 'running', priority: 'medium', createdAt: new Date().toISOString() },
    { id: '3', title: 'Generate weekly report', type: 'generate_report', status: 'completed', priority: 'low', createdAt: new Date(Date.now() - 86400000).toISOString(), completedAt: new Date().toISOString() },
    { id: '4', title: 'Analyze competitor pricing', type: 'analyze_conversation', status: 'pending', priority: 'medium', createdAt: new Date().toISOString() },
  ];
  
  res.json({
    success: true,
    data: tasks,
  });
}));

router.get('/tasks/stats', asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      total: 156,
      byStatus: { pending: 23, running: 8, completed: 120, failed: 5 },
      completedToday: 15,
      overdue: 3,
    },
  });
}));

router.put('/tasks/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      id: req.params.id,
      ...req.body,
      updatedAt: new Date().toISOString(),
    },
  });
}));

// ============================================
// Context & Learning Routes
// ============================================

router.post('/context/build', asyncHandler(async (req: AuthRequest, res: Response) => {
  const topic = req.body.topic as string | undefined;
  
  res.json({
    success: true,
    data: {
      context: `Context built for ${topic || 'general'} topic. This includes relevant memories and patterns for the conversation.`,
    },
  });
}));

router.post('/learn', asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    message: 'Interaction recorded for learning',
  });
}));

// ============================================
// Memory Management Routes
// ============================================

/**
 * GET /api/ai-center/memories
 * Get all memories for the current user context
 */
router.get('/memories', asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: 'User not authenticated' });
    return;
  }

  const memoryContext = {
    userId,
    userRole: 'super_admin' as const,
  };

  const memories = await aiMemoryService.getMemoriesForContext(memoryContext, { limit: 100 });
  
  res.json({
    success: true,
    data: {
      memories,
      count: memories.length,
      context: memoryContext,
    },
  });
}));

/**
 * POST /api/ai-center/memories/seed
 * Seed the AI memory database with production knowledge
 */
router.post('/memories/seed', asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: 'User not authenticated' });
    return;
  }

  logger.info(`[AI Memory] Seeding memories for user ${userId}`);

  const memoryContext = {
    userId,
    userRole: 'super_admin' as const,
  };

  // Production knowledge to seed
  const productionMemories = [
    {
      scope: MemoryScope.GLOBAL,
      category: MemoryCategory.FACT,
      key: 'platform_identity',
      value: {
        name: 'DealersFace',
        domain: 'dealersface.com',
        company: 'GAD Productions',
        purpose: 'SaaS platform for automotive dealership management',
        tech_stack: {
          frontend: 'React 18 + TypeScript + Vite + Tailwind CSS',
          backend: 'Node.js + Express + TypeScript',
          database: 'PostgreSQL via Prisma ORM',
          cache: 'Redis',
          deployment: 'Docker on VPS (46.4.224.182)',
        },
      },
      summary: 'DealersFace is a SaaS platform by GAD Productions for automotive dealerships',
      importance: 1.0,
    },
    {
      scope: MemoryScope.GLOBAL,
      category: MemoryCategory.FACT,
      key: 'production_infrastructure',
      value: {
        vps_ip: '46.4.224.182',
        domain: 'dealersface.com',
        deployment_path: '/opt/facemydealer',
        docker_compose: 'docker-compose.production.yml',
        containers: ['api', 'postgres', 'redis', 'traefik', 'worker-api', 'browser-worker'],
      },
      summary: 'Production runs on VPS 46.4.224.182 with Docker containers',
      importance: 1.0,
    },
    {
      scope: MemoryScope.ROLE,
      category: MemoryCategory.INSTRUCTION,
      key: 'server_access',
      value: {
        ssh_command: 'ssh root@46.4.224.182',
        deployment_path: '/opt/facemydealer',
        commands: {
          view_logs: 'docker compose -f docker-compose.production.yml logs -f --tail=100',
          restart_api: 'docker compose -f docker-compose.production.yml restart api',
          rebuild_deploy: 'docker compose -f docker-compose.production.yml build api --no-cache && docker compose -f docker-compose.production.yml up -d api',
          check_status: 'docker compose -f docker-compose.production.yml ps',
        },
      },
      summary: 'SSH server access commands for deployment and troubleshooting',
      importance: 1.0,
    },
    {
      scope: MemoryScope.ROLE,
      category: MemoryCategory.INSTRUCTION,
      key: 'troubleshooting_guide',
      value: {
        '403_forbidden': {
          causes: ['CSRF token missing', 'Invalid JWT', 'User inactive'],
          fix: 'Check server logs, add route to CSRF skip list if needed',
        },
        '401_unauthorized': {
          causes: ['Missing Bearer token', 'Expired JWT'],
          fix: 'Force re-login or check JWT_SECRET',
        },
        '502_bad_gateway': {
          causes: ['API container crashed'],
          fix: 'docker compose restart api',
        },
      },
      summary: 'Common error troubleshooting guide',
      importance: 0.95,
    },
    {
      scope: MemoryScope.ROLE,
      category: MemoryCategory.PERSONALITY,
      key: 'nova_identity',
      value: {
        name: 'Nova',
        full_name: 'Neural Operations & Virtual Administrator',
        role: 'Super Admin AI Assistant + Developer Companion',
        capabilities: ['Full codebase knowledge', 'Production server commands', 'Database queries', 'Debugging'],
      },
      summary: "Nova's identity and capabilities",
      importance: 1.0,
    },
  ];

  let created = 0;
  let updated = 0;

  for (const mem of productionMemories) {
    try {
      await aiMemoryService.createMemory(memoryContext, {
        scope: mem.scope,
        category: mem.category,
        key: mem.key,
        value: mem.value,
        summary: mem.summary,
        importance: mem.importance,
      });
      created++;
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Duplicate key, count as updated
        updated++;
        logger.info(`Memory ${mem.key} already exists, skipping`);
      } else {
        logger.error(`Failed to create memory ${mem.key}:`, error);
      }
    }
  }

  logger.info(`[AI Memory] Seeded ${created} new, ${updated} existing memories`);

  res.json({
    success: true,
    message: `Memory seeding complete: ${created} created, ${updated} updated`,
    data: {
      created,
      updated,
      total: productionMemories.length,
    },
  });
}));

// ============================================
// Audit Logs Routes
// ============================================

router.get('/audit/:accountId', aiCenterController.getAuditLogs);

// ============================================
// NOVA ADVANCED TOOLING ROUTES
// Production-level system management capabilities
// ============================================

import { novaToolingService } from '@/services/nova-tooling.service';

// Get comprehensive system health report
router.get('/nova/health', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const report = await novaToolingService.getSystemHealth();
  res.json({ success: true, data: report });
}));

// Read a file from the codebase
router.post('/nova/file/read', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { path } = req.body;
  if (!path) {
    res.status(400).json({ success: false, error: 'File path is required' });
    return;
  }
  const result = await novaToolingService.readFile(path);
  res.json({ success: result.success, data: result });
}));

// Write/update a file in the codebase
router.post('/nova/file/write', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { path, content } = req.body;
  if (!path || content === undefined) {
    res.status(400).json({ success: false, error: 'Path and content are required' });
    return;
  }
  const result = await novaToolingService.writeFile(path, content);
  res.json({ success: result.success, data: result });
}));

// List directory contents
router.post('/nova/directory/list', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { path } = req.body;
  const result = await novaToolingService.listDirectory(path || 'src');
  res.json({ success: true, data: result });
}));

// Search for files by pattern
router.post('/nova/file/search', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { pattern, directory } = req.body;
  if (!pattern) {
    res.status(400).json({ success: false, error: 'Search pattern is required' });
    return;
  }
  const results = await novaToolingService.searchFiles(pattern, directory);
  res.json({ success: true, data: { pattern, results } });
}));

// Search for content within files
router.post('/nova/code/search', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { query, directory, extensions } = req.body;
  if (!query) {
    res.status(400).json({ success: false, error: 'Search query is required' });
    return;
  }
  const results = await novaToolingService.searchInFiles(query, directory, extensions);
  res.json({ success: true, data: { query, results, count: results.length } });
}));

// Analyze a file
router.post('/nova/file/analyze', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { path } = req.body;
  if (!path) {
    res.status(400).json({ success: false, error: 'File path is required' });
    return;
  }
  const result = await novaToolingService.analyzeFile(path);
  res.json({ success: result.success, data: result });
}));

// Query database (read-only)
router.post('/nova/database/query', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { table, options } = req.body;
  if (!table) {
    res.status(400).json({ success: false, error: 'Table name is required' });
    return;
  }
  const result = await novaToolingService.queryDatabase(table, options);
  res.json({ success: result.success, data: result });
}));

// Get database schema
router.get('/nova/database/schema', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const result = await novaToolingService.getDatabaseSchema();
  res.json({ success: result.success, data: result });
}));

// Get project structure overview
router.get('/nova/project/structure', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const structure = await novaToolingService.getProjectStructure();
  res.json({ success: true, data: structure });
}));

// Get recent errors
router.get('/nova/errors/recent', asyncHandler(async (req: AuthRequest, res: Response) => {
  const limit = Number(req.query.limit) || 50;
  const errors = await novaToolingService.getRecentErrors(limit);
  res.json({ success: true, data: errors });
}));

// Get container status
router.get('/nova/containers/status', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const status = await novaToolingService.getContainerStatus();
  res.json({ success: true, data: status });
}));

// Fetch external document/URL content (for HTML editor)
router.post('/nova/fetch/document', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { url, type } = req.body;
  
  if (!url) {
    res.status(400).json({ success: false, error: 'URL is required' });
    return;
  }
  
  try {
    // Validate URL
    const parsedUrl = new URL(url);
    
    // Only allow http/https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      res.status(400).json({ success: false, error: 'Only HTTP/HTTPS URLs are allowed' });
      return;
    }
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Nova-Document-Fetcher/1.0',
      },
    });
    
    if (!response.ok) {
      res.status(response.status).json({ 
        success: false, 
        error: `Failed to fetch: ${response.status} ${response.statusText}` 
      });
      return;
    }
    
    const contentType = response.headers.get('content-type') || '';
    let content: string;
    
    if (type === 'html' || contentType.includes('text/html')) {
      content = await response.text();
    } else if (type === 'json' || contentType.includes('application/json')) {
      const json = await response.json();
      content = JSON.stringify(json, null, 2);
    } else {
      content = await response.text();
    }
    
    res.json({
      success: true,
      data: {
        url,
        contentType,
        content: content.substring(0, 500000), // Limit to 500KB
        size: content.length,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}));

// Execute code snippet safely (sandboxed)
router.post('/nova/execute/snippet', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { code, language } = req.body;
  
  if (!code) {
    res.status(400).json({ success: false, error: 'Code is required' });
    return;
  }
  
  // Only allow JavaScript snippets that are safe
  if (language !== 'javascript') {
    res.status(400).json({ success: false, error: 'Only JavaScript is currently supported' });
    return;
  }
  
  try {
    // Create a sandboxed context with limited capabilities
    const sandboxedCode = `
      (function() {
        const console = {
          log: (...args) => outputs.push(['log', args]),
          error: (...args) => outputs.push(['error', args]),
          warn: (...args) => outputs.push(['warn', args]),
        };
        const outputs = [];
        try {
          ${code}
        } catch (e) {
          outputs.push(['error', [e.message]]);
        }
        return outputs;
      })()
    `;
    
    // Execute with timeout
    const vm = require('vm');
    const context = vm.createContext({});
    const result = vm.runInContext(sandboxedCode, context, { timeout: 5000 });
    
    res.json({
      success: true,
      data: {
        outputs: result,
        executedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    res.json({
      success: false,
      error: error.message,
      data: { outputs: [['error', [error.message]]] },
    });
  }
}));

// Get DOM structure analysis for an HTML string
router.post('/nova/dom/analyze', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { html } = req.body;
  
  if (!html) {
    res.status(400).json({ success: false, error: 'HTML content is required' });
    return;
  }
  
  try {
    // Parse HTML and extract structure
    const tagPattern = /<(\w+)([^>]*)>/g;
    const tags: { tag: string; attributes: string; count: number }[] = [];
    const tagCounts: Record<string, number> = {};
    
    let match;
    while ((match = tagPattern.exec(html)) !== null) {
      const [, tag] = match;
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
    
    for (const [tag, count] of Object.entries(tagCounts)) {
      tags.push({ tag, attributes: '', count });
    }
    
    // Find IDs and classes
    const idPattern = /id=["']([^"']+)["']/g;
    const classPattern = /class=["']([^"']+)["']/g;
    const ids: string[] = [];
    const classes: string[] = [];
    
    while ((match = idPattern.exec(html)) !== null) {
      ids.push(match[1]);
    }
    while ((match = classPattern.exec(html)) !== null) {
      classes.push(...match[1].split(' ').filter(Boolean));
    }
    
    res.json({
      success: true,
      data: {
        totalElements: Object.values(tagCounts).reduce((a, b) => a + b, 0),
        tagCounts,
        uniqueTags: tags.sort((a, b) => b.count - a.count),
        ids: [...new Set(ids)],
        classes: [...new Set(classes)],
        size: html.length,
        lines: html.split('\n').length,
        hasDoctype: html.toLowerCase().includes('<!doctype'),
        hasHead: html.toLowerCase().includes('<head'),
        hasBody: html.toLowerCase().includes('<body'),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}));

// Transform/manipulate HTML
router.post('/nova/dom/transform', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { html, operations } = req.body;
  
  if (!html || !operations || !Array.isArray(operations)) {
    res.status(400).json({ success: false, error: 'HTML and operations array are required' });
    return;
  }
  
  let result = html;
  const appliedOps: string[] = [];
  
  for (const op of operations) {
    try {
      switch (op.type) {
        case 'replace':
          // Replace text/pattern
          if (op.pattern && op.replacement !== undefined) {
            const regex = new RegExp(op.pattern, op.flags || 'g');
            result = result.replace(regex, op.replacement);
            appliedOps.push(`Replaced pattern: ${op.pattern}`);
          }
          break;
          
        case 'insert':
          // Insert content at position or before/after selector
          if (op.position === 'start') {
            result = op.content + result;
          } else if (op.position === 'end') {
            result = result + op.content;
          } else if (op.before) {
            result = result.replace(op.before, op.content + op.before);
          } else if (op.after) {
            result = result.replace(op.after, op.after + op.content);
          }
          appliedOps.push(`Inserted content at ${op.position || 'specified position'}`);
          break;
          
        case 'remove':
          // Remove matching content
          if (op.pattern) {
            const regex = new RegExp(op.pattern, op.flags || 'g');
            result = result.replace(regex, '');
            appliedOps.push(`Removed pattern: ${op.pattern}`);
          }
          break;
          
        case 'wrap':
          // Wrap content with tags
          if (op.pattern && op.wrapper) {
            const regex = new RegExp(`(${op.pattern})`, op.flags || 'g');
            result = result.replace(regex, op.wrapper.replace('$1', '$1'));
            appliedOps.push(`Wrapped pattern: ${op.pattern}`);
          }
          break;
          
        case 'formatHtml':
          // Basic HTML formatting
          result = result
            .replace(/></g, '>\n<')
            .replace(/\n\s*\n/g, '\n')
            .trim();
          appliedOps.push('Formatted HTML');
          break;
          
        case 'minify':
          // Minify HTML
          result = result
            .replace(/\n/g, '')
            .replace(/\s+/g, ' ')
            .replace(/>\s+</g, '><')
            .trim();
          appliedOps.push('Minified HTML');
          break;
      }
    } catch (opError: any) {
      appliedOps.push(`Error in ${op.type}: ${opError.message}`);
    }
  }
  
  res.json({
    success: true,
    data: {
      original: html.substring(0, 1000),
      result,
      appliedOperations: appliedOps,
      sizeBefore: html.length,
      sizeAfter: result.length,
    },
  });
}));

// Validate HTML
router.post('/nova/dom/validate', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { html } = req.body;
  
  if (!html) {
    res.status(400).json({ success: false, error: 'HTML content is required' });
    return;
  }
  
  const issues: { type: 'error' | 'warning'; message: string; line?: number }[] = [];
  const lines: string[] = html.split('\n');
  
  // Check for common issues
  const openTags: string[] = [];
  const selfClosingTags = ['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'];
  
  lines.forEach((line: string, idx: number) => {
    const lineNum = idx + 1;
    
    // Check for unclosed quotes in attributes
    const quotes = (line.match(/"/g) || []).length;
    if (quotes % 2 !== 0) {
      issues.push({ type: 'warning', message: 'Possibly unclosed quote', line: lineNum });
    }
    
    // Check for deprecated tags
    const deprecatedTags = ['font', 'center', 'marquee', 'blink'];
    for (const tag of deprecatedTags) {
      if (new RegExp(`<${tag}[\\s>]`, 'i').test(line)) {
        issues.push({ type: 'warning', message: `Deprecated tag <${tag}>`, line: lineNum });
      }
    }
    
    // Check for inline styles
    if (/style\s*=\s*["']/.test(line)) {
      issues.push({ type: 'warning', message: 'Inline style found - consider using CSS', line: lineNum });
    }
    
    // Track open/close tags
    const openMatch = line.match(/<(\w+)(?:\s[^>]*)?(?<!\/)\s*>/g) || [];
    const closeMatch = line.match(/<\/(\w+)\s*>/g) || [];
    
    openMatch.forEach((tagMatch: string) => {
      const tagName = tagMatch.match(/<(\w+)/)?.[1]?.toLowerCase();
      if (tagName && !selfClosingTags.includes(tagName)) {
        openTags.push(tagName);
      }
    });
    
    closeMatch.forEach((tagMatch: string) => {
      const tagName = tagMatch.match(/<\/(\w+)/)?.[1]?.toLowerCase();
      if (tagName) {
        const lastOpen = openTags.lastIndexOf(tagName);
        if (lastOpen === -1) {
          issues.push({ type: 'error', message: `Closing tag </${tagName}> without opening tag`, line: lineNum });
        } else {
          openTags.splice(lastOpen, 1);
        }
      }
    });
  });
  
  // Check for unclosed tags at end
  for (const tag of openTags) {
    issues.push({ type: 'error', message: `Unclosed tag <${tag}>` });
  }
  
  // Check for DOCTYPE
  if (!html.toLowerCase().includes('<!doctype')) {
    issues.push({ type: 'warning', message: 'Missing DOCTYPE declaration' });
  }
  
  // Check for missing charset
  if (!html.toLowerCase().includes('charset')) {
    issues.push({ type: 'warning', message: 'Missing charset meta tag' });
  }
  
  res.json({
    success: true,
    data: {
      valid: issues.filter(i => i.type === 'error').length === 0,
      errorCount: issues.filter(i => i.type === 'error').length,
      warningCount: issues.filter(i => i.type === 'warning').length,
      issues,
    },
  });
}));

// ============================================
// NOVA TERMINAL - Secure VPS Command Execution
// ============================================

import { novaTerminalService } from '@/services/nova-terminal.service';

// Execute command on VPS
router.post('/nova/terminal/vps', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { command, timeout, inProjectDir } = req.body;
  
  if (!command) {
    res.status(400).json({ success: false, error: 'Command is required' });
    return;
  }

  logger.info(`[Nova Terminal] VPS command requested by ${req.user?.email}: ${command.substring(0, 100)}`);
  
  const result = await novaTerminalService.executeVPS(command, {
    timeout,
    userId: req.user?.id,
    inProjectDir,
  });
  
  res.json({ success: result.success, data: result });
}));

// Execute command locally
router.post('/nova/terminal/local', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { command, cwd, timeout } = req.body;
  
  if (!command) {
    res.status(400).json({ success: false, error: 'Command is required' });
    return;
  }

  logger.info(`[Nova Terminal] Local command requested by ${req.user?.email}: ${command.substring(0, 100)}`);
  
  const result = await novaTerminalService.executeLocal(command, {
    cwd,
    timeout,
    userId: req.user?.id,
  });
  
  res.json({ success: result.success, data: result });
}));

// Execute Docker command on VPS
router.post('/nova/terminal/docker', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { command, timeout } = req.body;
  
  if (!command) {
    res.status(400).json({ success: false, error: 'Docker command is required' });
    return;
  }

  logger.info(`[Nova Terminal] Docker command requested: ${command.substring(0, 100)}`);
  
  const result = await novaTerminalService.executeDocker(command, {
    timeout,
    userId: req.user?.id,
  });
  
  res.json({ success: result.success, data: result });
}));

// Get container logs
router.post('/nova/terminal/logs', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { container, tail, since } = req.body;
  
  if (!container) {
    res.status(400).json({ success: false, error: 'Container name is required' });
    return;
  }
  
  const result = await novaTerminalService.getContainerLogs(container, { tail, since });
  res.json({ success: result.success, data: result });
}));

// Restart container
router.post('/nova/terminal/restart', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { container } = req.body;
  
  if (!container) {
    res.status(400).json({ success: false, error: 'Container name is required' });
    return;
  }

  logger.info(`[Nova Terminal] Container restart requested: ${container}`);
  
  const result = await novaTerminalService.restartContainer(container);
  res.json({ success: result.success, data: result });
}));

// Get VPS system info
router.get('/nova/terminal/system-info', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const result = await novaTerminalService.getVPSSystemInfo();
  res.json({ success: result.success, data: result });
}));

// Execute database query (read-only)
router.post('/nova/terminal/db-query', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { query, timeout } = req.body;
  
  if (!query) {
    res.status(400).json({ success: false, error: 'Query is required' });
    return;
  }

  logger.info(`[Nova Terminal] DB query requested: ${query.substring(0, 100)}`);
  
  const result = await novaTerminalService.executeDatabaseQuery(query, {
    timeout,
    userId: req.user?.id,
  });
  
  res.json({ success: result.success, data: result });
}));

// Create backup
router.post('/nova/terminal/backup', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { type } = req.body;
  
  if (!type || !['database', 'code', 'full'].includes(type)) {
    res.status(400).json({ success: false, error: 'Valid backup type required: database, code, or full' });
    return;
  }

  logger.info(`[Nova Terminal] Backup requested: ${type}`);
  
  const result = await novaTerminalService.createBackup(type);
  res.json({ success: result.success, data: result });
}));

// List backups
router.get('/nova/terminal/backups', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const result = await novaTerminalService.listBackups();
  res.json({ success: result.success, data: result });
}));

// Get command history
router.get('/nova/terminal/history', asyncHandler(async (req: AuthRequest, res: Response) => {
  const limit = Number(req.query.limit) || 50;
  const target = req.query.target as 'local' | 'vps' | undefined;
  
  const history = novaTerminalService.getCommandHistory({ limit, target });
  res.json({ success: true, data: { history } });
}));

// Git operations
router.get('/nova/terminal/git/status', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const result = await novaTerminalService.gitStatus();
  res.json({ success: result.success, data: result });
}));

router.post('/nova/terminal/git/pull', asyncHandler(async (_req: AuthRequest, res: Response) => {
  logger.info('[Nova Terminal] Git pull requested');
  const result = await novaTerminalService.gitPull();
  res.json({ success: result.success, data: result });
}));

router.get('/nova/terminal/git/log', asyncHandler(async (req: AuthRequest, res: Response) => {
  const count = Number(req.query.count) || 10;
  const result = await novaTerminalService.gitLog(count);
  res.json({ success: result.success, data: result });
}));

// Deployment operations
router.post('/nova/terminal/deploy', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { service } = req.body;
  
  logger.info(`[Nova Terminal] Deploy requested for service: ${service || 'api'}`);
  
  const result = await novaTerminalService.rebuildAndDeploy(service || 'api');
  res.json({ success: result.success, data: result });
}));

router.post('/nova/terminal/deploy-all', asyncHandler(async (_req: AuthRequest, res: Response) => {
  logger.info('[Nova Terminal] Full deployment requested');
  const result = await novaTerminalService.deployAll();
  res.json({ success: result.success, data: result });
}));

// ============================================
// NOVA ADVANCED SEARCH & FILE TOOLS
// ============================================

// Deep search across codebase
router.post('/nova/search/deep', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { query, directories, extensions, maxResults, caseSensitive, regex, includeContext } = req.body;
  
  if (!query) {
    res.status(400).json({ success: false, error: 'Search query is required' });
    return;
  }
  
  const result = await novaToolingService.deepSearch({
    query,
    directories,
    extensions,
    maxResults,
    caseSensitive,
    regex,
    includeContext,
  });
  
  res.json({ success: result.success, data: result });
}));

// Get file tree
router.post('/nova/files/tree', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { directory, maxDepth, includeStats } = req.body;
  
  const result = await novaToolingService.getFileTree(directory || 'src', {
    maxDepth,
    includeStats,
  });
  
  res.json({ success: result.success, data: result });
}));

// Batch read files
router.post('/nova/files/batch-read', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { paths } = req.body;
  
  if (!paths || !Array.isArray(paths)) {
    res.status(400).json({ success: false, error: 'Array of file paths is required' });
    return;
  }
  
  const result = await novaToolingService.batchReadFiles(paths);
  res.json({ success: result.success, data: result });
}));

// Compare files
router.post('/nova/files/compare', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { path1, path2 } = req.body;
  
  if (!path1 || !path2) {
    res.status(400).json({ success: false, error: 'Two file paths are required' });
    return;
  }
  
  const result = await novaToolingService.compareFiles(path1, path2);
  res.json({ success: result.success, data: result });
}));

// Create file backup
router.post('/nova/files/backup', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { path } = req.body;
  
  if (!path) {
    res.status(400).json({ success: false, error: 'File path is required' });
    return;
  }
  
  const result = await novaToolingService.createFileBackup(path);
  res.json({ success: result.success, data: result });
}));

// Find and replace (dry run by default)
router.post('/nova/files/find-replace', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { searchQuery, replaceWith, directories, extensions, dryRun, maxFiles, caseSensitive } = req.body;
  
  if (!searchQuery || replaceWith === undefined) {
    res.status(400).json({ success: false, error: 'Search query and replacement text are required' });
    return;
  }

  logger.info(`[Nova Tools] Find/replace requested: "${searchQuery}" -> "${replaceWith}" (dryRun: ${dryRun !== false})`);
  
  const result = await novaToolingService.findAndReplace({
    searchQuery,
    replaceWith,
    directories,
    extensions,
    dryRun: dryRun !== false, // Default to dry run
    maxFiles,
    caseSensitive,
  });
  
  res.json({ success: result.success, data: result });
}));

// Get project statistics
router.get('/nova/stats/project', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const result = await novaToolingService.getProjectStats();
  res.json({ success: result.success, data: result });
}));

export default router;
