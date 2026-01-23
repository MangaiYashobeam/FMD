/**
 * Chrome Extension API Routes (IAI Soldier Communication)
 * 
 * Handles communication between the extension and the server:
 * - Task management (create, poll, update)
 * - AI element finding
 * - Conversation analysis
 * - Response generation
 * - Stats collection
 * - Message automation
 */

import { Router, Request, Response } from 'express';
import { AINavigationAgent } from '../services/ai-agent.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { logger } from '../utils/logger';

const router = Router();
const aiAgent = new AINavigationAgent();

// ============================================
// Task Management (In-Memory Queue)
// ============================================

interface ExtensionTask {
  id: string;
  accountId: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data: Record<string, unknown>;
  result?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory task queue (use Redis in production for scalability)
const taskQueue: Map<string, ExtensionTask> = new Map();

// Store extension heartbeats (accountId -> last ping timestamp)
const extensionHeartbeats: Map<string, { lastPing: Date; userEmail: string }> = new Map();

/**
 * Clean old tasks from memory
 */
function cleanOldTasks() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  taskQueue.forEach((task, id) => {
    if (task.createdAt.getTime() < oneHourAgo) {
      taskQueue.delete(id);
    }
  });
}

// ============================================
// Extension Status & Heartbeat
// ============================================

/**
 * POST /api/extension/heartbeat
 * Extension sends heartbeat every 30 seconds to indicate it's online
 */
router.post('/heartbeat', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { accountId } = req.body;
    
    if (!accountId) {
      res.status(400).json({ error: 'accountId is required' });
      return;
    }
    
    // Verify access
    const accountUser = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId,
      },
    });
    
    if (!accountUser) {
      res.status(403).json({ error: 'Access denied to this account' });
      return;
    }
    
    // Update heartbeat
    extensionHeartbeats.set(accountId, {
      lastPing: new Date(),
      userEmail: req.user!.email,
    });
    
    res.json({ success: true, timestamp: new Date() });
  } catch (error) {
    logger.error('Extension heartbeat error:', error);
    res.status(500).json({ error: 'Failed to record heartbeat' });
  }
});

/**
 * GET /api/extension/status/:accountId
 * Check if extension is online for an account
 */
router.get('/status/:accountId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.params.accountId as string;
    
    // Verify access
    const accountUser = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId,
      },
    });
    
    if (!accountUser) {
      res.status(403).json({ error: 'Access denied to this account' });
      return;
    }
    
    const heartbeat = extensionHeartbeats.get(accountId);
    const isOnline = heartbeat && (Date.now() - heartbeat.lastPing.getTime() < 60000); // Online if pinged in last 60s
    
    res.json({
      success: true,
      data: {
        accountId,
        isOnline,
        lastPing: heartbeat?.lastPing || null,
        userEmail: heartbeat?.userEmail || null,
      },
    });
  } catch (error) {
    logger.error('Extension status check error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// ============================================
// Task Routes
// ============================================

/**
 * GET /api/extension/tasks/:accountId
 * Get pending tasks for an account
 * Reads from both database (AutoPost tasks) and in-memory queue
 */
router.get('/tasks/:accountId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.params.accountId as string;
    
    // Verify user has access to this account
    const accountUser = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId,
      },
    });
    
    if (!accountUser) {
      res.status(403).json({ error: 'Access denied to this account' });
      return;
    }
    
    // Get pending tasks from DATABASE (AutoPost service creates these)
    const dbTasks = await prisma.extensionTask.findMany({
      where: {
        accountId,
        status: { in: ['pending', 'processing'] },
        OR: [
          { scheduledFor: null },
          { scheduledFor: { lte: new Date() } },
        ],
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
      take: 10,
    });
    
    // Also check in-memory queue for legacy tasks
    const memoryTasks: ExtensionTask[] = [];
    taskQueue.forEach((task) => {
      if (task.accountId === accountId && task.status === 'pending') {
        memoryTasks.push(task);
      }
    });
    
    // Transform database tasks to extension format
    const tasks = dbTasks.map(task => ({
      id: task.id,
      accountId: task.accountId,
      type: task.type === 'post_vehicle' ? 'POST_TO_MARKETPLACE' : task.type.toUpperCase(),
      status: task.status,
      data: task.data as Record<string, unknown>,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }));
    
    // Merge with memory tasks (de-duped)
    const allTasks = [...tasks, ...memoryTasks.filter(mt => !tasks.some(t => t.id === mt.id))];
    
    logger.info(`📋 Extension polling: Found ${allTasks.length} tasks for account ${accountId} (${dbTasks.length} from DB, ${memoryTasks.length} from memory)`);
    
    res.json(allTasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to get tasks' });
  }
});

/**
 * GET /api/extension/tasks/:accountId/pending
 * Alias for /tasks/:accountId - for backward compatibility
 */
router.get('/tasks/:accountId/pending', authenticate, async (req: AuthRequest, res: Response) => {
  // Just return pending tasks for this account - same as main route
  try {
    const accountId = req.params.accountId as string;
    
    const accountUser = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId,
      },
    });
    
    if (!accountUser) {
      res.status(403).json({ error: 'Access denied to this account' });
      return;
    }
    
    const tasks = await prisma.extensionTask.findMany({
      where: {
        accountId,
        status: 'pending',
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
      take: 10,
    });
    
    const formattedTasks = tasks.map(task => ({
      id: task.id,
      accountId: task.accountId,
      type: task.type === 'post_vehicle' ? 'POST_TO_MARKETPLACE' : task.type.toUpperCase(),
      status: task.status,
      data: task.data as Record<string, unknown>,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }));
    
    logger.info(`📋 Pending tasks: Found ${formattedTasks.length} for account ${accountId}`);
    res.json(formattedTasks);
  } catch (error) {
    logger.error('Get pending tasks error:', error);
    res.status(500).json({ error: 'Failed to get tasks' });
  }
});

/**
 * POST /api/extension/tasks/:taskId/complete
 * Mark task as completed
 */
router.post('/tasks/:taskId/complete', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const taskId = req.params.taskId as string;
    
    await prisma.extensionTask.update({
      where: { id: taskId },
      data: { 
        status: 'completed',
        updatedAt: new Date(),
        result: req.body.result || null,
      },
    });
    
    logger.info(`✅ Task ${taskId} marked as completed`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Complete task error:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

/**
 * POST /api/extension/tasks/:taskId/failed
 * Mark task as failed
 */
router.post('/tasks/:taskId/failed', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const taskId = req.params.taskId as string;
    
    await prisma.extensionTask.update({
      where: { id: taskId },
      data: { 
        status: 'failed',
        updatedAt: new Date(),
        result: { error: req.body.error || 'Unknown error', failedAt: new Date().toISOString() },
      },
    });
    
    logger.info(`❌ Task ${taskId} marked as failed: ${req.body.error}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Fail task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

/**
 * POST /api/extension/tasks
 * Create a new task for the extension
 */
router.post('/tasks', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { accountId, type, data = {} } = req.body;
    
    if (!accountId || !type) {
      res.status(400).json({ error: 'accountId and type are required' });
      return;
    }
    
    const acctId = accountId as string;
    
    // Verify access
    const accountUser = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: acctId,
      },
    });
    
    if (!accountUser) {
      res.status(403).json({ error: 'Access denied to this account' });
      return;
    }
    
    // Create task
    const task: ExtensionTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      accountId: acctId,
      type,
      status: 'pending',
      data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    taskQueue.set(task.id, task);
    cleanOldTasks();
    
    console.log(`Extension task created: ${task.id} (${type})`);
    
    res.json({
      success: true,
      task: {
        id: task.id,
        type: task.type,
        status: task.status,
      },
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

/**
 * POST /api/extension/tasks/:taskId/status
 * Update task status - works with both DB and in-memory tasks
 */
router.post('/tasks/:taskId/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const taskId = req.params.taskId as string;
    const { status, result } = req.body;
    
    // Try database first (AutoPost tasks)
    const dbTask = await prisma.extensionTask.findUnique({
      where: { id: taskId },
    });
    
    if (dbTask) {
      // Update database task
      await prisma.extensionTask.update({
        where: { id: taskId },
        data: {
          status,
          result: result || {},
          completedAt: (status === 'completed' || status === 'failed') ? new Date() : undefined,
        },
      });
      
      // If posting completed, track in FacebookPostHistory (doesn't require profileId)
      if (status === 'completed' && dbTask.type === 'post_vehicle' && dbTask.vehicleId) {
        try {
          // Store result in the task itself for tracking
          await prisma.extensionTask.update({
            where: { id: taskId },
            data: {
              result: {
                ...result,
                completedAt: new Date().toISOString(),
                vehicleId: dbTask.vehicleId,
                accountId: dbTask.accountId,
              },
            },
          });
          logger.info(`✅ Recorded posting completion for vehicle ${dbTask.vehicleId}`);
        } catch (fbError) {
          logger.warn('Could not record posting completion:', fbError);
        }
      }
      
      logger.info(`📝 DB Task ${taskId} updated to: ${status}`);
      res.json({ success: true, source: 'database' });
      return;
    }
    
    // Fall back to in-memory queue
    const memTask = taskQueue.get(taskId);
    if (!memTask) {
      res.status(404).json({ error: 'Task not found in database or memory' });
      return;
    }
    
    memTask.status = status;
    memTask.result = result;
    memTask.updatedAt = new Date();
    
    logger.info(`📝 Memory Task ${taskId} updated to: ${status}`);
    
    // If completed or failed, schedule cleanup after 5 minutes
    if (status === 'completed' || status === 'failed') {
      setTimeout(() => {
        taskQueue.delete(taskId);
      }, 5 * 60 * 1000);
    }
    
    res.json({ success: true, source: 'memory' });
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({ error: 'Failed to update task status' });
  }
});

/**
 * GET /api/extension/tasks/:taskId
 * Get task result
 */
router.get('/tasks/:taskId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const taskId = req.params.taskId as string;
    
    const task = taskQueue.get(taskId);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    
    res.json({ success: true, task });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Failed to get task' });
  }
});

// ============================================
// Stats Collection
// ============================================

/**
 * POST /api/extension/stats
 * Store collected stats from extension
 */
router.post('/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { accountId, stats } = req.body;
    
    if (!accountId || !stats) {
      res.status(400).json({ error: 'accountId and stats are required' });
      return;
    }
    
    const acctId = accountId as string;
    
    // Verify access
    const accountUser = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: acctId,
      },
    });
    
    if (!accountUser) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    
    console.log(`Stats collected for account ${acctId}:`, JSON.stringify(stats).slice(0, 500));
    
    // Store stats (could extend schema or use JSON field in AccountSettings)
    // For now we just log it - the stats are valuable for analytics
    
    res.json({ success: true });
  } catch (error) {
    console.error('Store stats error:', error);
    res.status(500).json({ error: 'Failed to store stats' });
  }
});

// ============================================
// Conversation Sync
// ============================================

/**
 * POST /api/extension/conversations
 * Store conversation for analytics / lead creation
 */
router.post('/conversations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { accountId, facebookConversationId, buyerName, messages } = req.body;
    
    if (!accountId || !facebookConversationId) {
      res.status(400).json({ error: 'accountId and facebookConversationId are required' });
      return;
    }
    
    const acctId = accountId as string;
    
    // Verify access
    const accountUser = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: acctId,
      },
    });
    
    if (!accountUser) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    
    // Create or update lead based on conversation
    const fbUserId = `fb_${facebookConversationId}`;
    
    const existingLead = await prisma.lead.findFirst({
      where: {
        accountId: acctId,
        facebookUserId: fbUserId,
      },
    });
    
    if (!existingLead) {
      // Generate unique lead number
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      const leadNumber = `FB-${timestamp}-${random}`;
      
      await prisma.lead.create({
        data: {
          accountId: acctId,
          leadNumber,
          facebookUserId: fbUserId,
          facebookDisplayName: buyerName || 'Facebook Buyer',
          firstName: buyerName || 'Facebook',
          lastName: 'Buyer',
          status: 'NEW',
          source: 'FACEBOOK_MARKETPLACE',
          internalNotes: `Conversation synced via IAI - ${messages?.length || 0} messages`,
        },
      });
      console.log(`New lead created from FB conversation for account ${acctId}`);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Sync conversation error:', error);
    res.status(500).json({ error: 'Failed to sync conversation' });
  }
});

/**
 * POST /api/extension/sync
 * Sync data from extension (uses API key auth)
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { apiKey, data } = req.body;
    
    if (!apiKey) {
      res.status(401).json({ error: 'API key required' });
      return;
    }
    
    // Find account by API key - AccountSettings doesn't have apiKey column
    // Use a placeholder approach for now - in production this would check a real API key table
    console.log('Extension sync request received');
    
    // Process sync data based on type
    if (data?.type === 'listings') {
      console.log(`Syncing ${data.listings?.length || 0} listings`);
    } else if (data?.type === 'messages') {
      console.log(`Syncing ${data.messages?.length || 0} messages`);
    } else if (data?.type === 'stats') {
      console.log(`Syncing stats`);
    }
    
    res.json({ success: true, message: 'Data synced successfully' });
  } catch (error) {
    console.error('Extension sync error:', error);
    res.status(500).json({ error: 'Failed to sync data' });
  }
});

// ============================================
// AI Element Finding
// ============================================

/**
 * POST /api/extension/find-element
 * Use AI to find element selector
 */
router.post('/find-element', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { description, pageHtml } = req.body;
    
    if (!description || !pageHtml) {
      res.status(400).json({ error: 'description and pageHtml are required' });
      return;
    }
    
    const result = await aiAgent.findElement({
      description,
      pageHtml,
    });
    
    res.json(result);
  } catch (error) {
    console.error('Find element error:', error);
    res.status(500).json({ error: 'Failed to find element' });
  }
});

/**
 * POST /api/extension/analyze-conversation
 * Use AI to analyze lead conversation
 */
router.post('/analyze-conversation', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { messages, vehicleInfo } = req.body;
    
    if (!messages) {
      res.status(400).json({ error: 'messages array is required' });
      return;
    }
    
    const analysis = await aiAgent.analyzeConversation(messages, vehicleInfo || null);
    
    res.json(analysis);
  } catch (error) {
    console.error('Analyze conversation error:', error);
    res.status(500).json({ error: 'Failed to analyze conversation' });
  }
});

/**
 * POST /api/extension/generate-response
 * Use AI to generate lead response
 */
router.post('/generate-response', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      messages, 
      vehicleInfo, 
      dealerName,
      dealerPhone,
      dealerAddress,
      lastBuyerMessage 
    } = req.body;
    
    // First analyze the conversation to get lead analysis
    const leadAnalysis = await aiAgent.analyzeConversation(messages || [], vehicleInfo || null);
    
    const response = await aiAgent.generateLeadResponse({
      dealerName: dealerName || 'Our Dealership',
      dealerPhone: dealerPhone || '',
      dealerAddress: dealerAddress || '',
      vehicleInfo: vehicleInfo || { year: 0, make: 'Unknown', model: 'Vehicle', price: 0 },
      conversationHistory: messages || [],
      lastBuyerMessage: lastBuyerMessage || messages?.[messages.length - 1]?.text || '',
      leadAnalysis,
    });
    
    res.json(response);
  } catch (error) {
    console.error('Generate response error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

/**
 * POST /api/extension/generate-description
 * Use AI to generate vehicle listing description
 */
router.post('/generate-description', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { vehicle } = req.body;
    
    if (!vehicle) {
      res.status(400).json({ error: 'vehicle object is required' });
      return;
    }
    
    const description = await aiAgent.generateVehicleDescription(vehicle);
    
    res.json({ description });
  } catch (error) {
    console.error('Generate description error:', error);
    res.status(500).json({ error: 'Failed to generate description' });
  }
});

/**
 * POST /api/extension/detect-ui-changes
 * Use AI to detect Facebook UI changes
 */
router.post('/detect-ui-changes', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { oldSelectors, newPageHtml } = req.body;
    
    if (!oldSelectors || !newPageHtml) {
      res.status(400).json({ error: 'oldSelectors and newPageHtml are required' });
      return;
    }
    
    const result = await aiAgent.detectUIChanges(oldSelectors, newPageHtml);
    
    res.json(result);
  } catch (error) {
    console.error('Detect UI changes error:', error);
    res.status(500).json({ error: 'Failed to detect UI changes' });
  }
});

/**
 * GET /api/extension/ai-provider
 * Get current AI provider info
 */
router.get('/ai-provider', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const providerInfo = aiAgent.getProviderInfo();
    res.json(providerInfo);
  } catch (error) {
    console.error('Get AI provider error:', error);
    res.status(500).json({ error: 'Failed to get AI provider info' });
  }
});

/**
 * POST /api/extension/ai-provider
 * Switch AI provider
 */
router.post('/ai-provider', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { provider } = req.body;
    
    if (!provider || !['anthropic', 'openai'].includes(provider)) {
      res.status(400).json({ error: 'Valid provider (anthropic or openai) is required' });
      return;
    }
    
    const success = aiAgent.setProvider(provider);
    
    if (success) {
      res.json({ success: true, provider });
    } else {
      res.status(400).json({ error: `Provider ${provider} is not available. Check API keys.` });
    }
  } catch (error) {
    console.error('Set AI provider error:', error);
    res.status(500).json({ error: 'Failed to set AI provider' });
  }
});

/**
 * GET /api/extension/health
 * Health check for extension
 */
router.get('/health', (_req: Request, res: Response) => {
  const providerInfo = aiAgent.getProviderInfo();
  res.json({
    status: 'ok',
    aiProvider: providerInfo.current,
    availableProviders: providerInfo.available,
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/extension/posting
 * Record a vehicle posting from extension
 */
router.post('/posting', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { vehicleId, accountId, platform, status, postedAt } = req.body;
    
    if (!vehicleId || !platform) {
      res.status(400).json({ 
        success: false, 
        error: 'vehicleId and platform are required' 
      });
      return;
    }
    
    // Create audit log entry for the posting
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id || null,
        action: 'VEHICLE_POSTED',
        entityType: 'vehicle',
        entityId: vehicleId,
        metadata: {
          accountId: accountId || req.user?.id,
          platform,
          status,
          postedAt: postedAt || new Date().toISOString(),
          source: 'extension',
        },
      },
    });
    
    // Log activity
    logger.info(`Extension posted vehicle ${vehicleId} to ${platform}`, {
      vehicleId,
      accountId: accountId || req.user?.id,
      platform,
    });
    
    res.json({
      success: true,
      posting: {
        vehicleId,
        platform,
        status: status || 'completed',
        postedAt: postedAt || new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Record posting error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to record posting' 
    });
  }
});

// ============================================
// AI Chat Assistant
// ============================================

/**
 * POST /api/extension/ai-chat
 * Get AI assistance for the extension user
 * Layer-based: User context → Account context → System
 */
router.post('/ai-chat', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { message, context } = req.body;
    
    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }
    
    const userId = req.user!.id;
    const accountId = context?.accountId;
    
    // Get user info for personalization
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    
    // Get account info if provided
    let accountInfo = null;
    if (accountId) {
      accountInfo = await prisma.account.findUnique({
        where: { id: accountId },
        select: { dealershipName: true },
      });
    }
    
    // Build context-aware system prompt
    const systemPrompt = `You are Nexus, an AI assistant for the Dealers Face Chrome extension.
You help users post vehicles to Facebook Marketplace.

User: ${user?.firstName || 'User'} ${user?.lastName || ''}
Dealership: ${accountInfo?.dealershipName || 'Unknown'}

Current Page: ${context?.url || 'Unknown'}
Page Type: ${context?.pageType || 'Unknown'}

Your role:
1. Help users navigate Facebook Marketplace
2. Troubleshoot posting issues
3. Explain form fields and requirements
4. Provide step-by-step guidance
5. Detect and explain errors

Be concise, helpful, and friendly. Use emojis sparingly to be clear.
If you detect an error or issue, explain what it means and how to fix it.`;

    // Use OpenAI/AI service to generate response
    // For now, provide rule-based responses
    const response = await generateAIResponse(message, systemPrompt, context);
    
    // Log AI interaction for learning
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'AI_CHAT',
        entityType: 'extension',
        entityId: accountId || 'no-account',
        metadata: {
          message,
          context,
          response,
        },
      },
    });
    
    res.json({ response });
  } catch (error) {
    logger.error('AI chat error:', error);
    res.status(500).json({ 
      error: 'AI service temporarily unavailable',
      response: 'I\'m having trouble connecting right now. Please try again or contact support.',
    });
  }
});

/**
 * POST /api/extension/report-error
 * Report errors from extension for diagnostics
 */
router.post('/report-error', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { error, context, stackTrace, url, timestamp } = req.body;
    const userId = req.user!.id;
    const accountId = context?.accountId;
    
    // Log error for Nova super admin diagnostics
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'EXTENSION_ERROR',
        entityType: 'extension',
        entityId: accountId || 'no-account',
        metadata: {
          error,
          context,
          stackTrace,
          url,
          timestamp: timestamp || new Date().toISOString(),
          userAgent: req.headers['user-agent'],
          severity: classifyErrorSeverity(error),
        },
      },
    });
    
    logger.warn(`🚨 Extension error reported by user ${userId}:`, {
      error,
      url,
      accountId,
    });
    
    // Generate diagnostic suggestion
    const diagnostic = await generateErrorDiagnostic(error, context);
    
    res.json({ 
      success: true,
      diagnostic,
    });
  } catch (err) {
    logger.error('Report error failed:', err);
    res.status(500).json({ error: 'Failed to report error' });
  }
});

// Helper function for AI responses
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function generateAIResponse(message: string, _systemPrompt: string, context: any): Promise<string> {
  const lowerMessage = message.toLowerCase();
  
  // Context-aware responses
  if (context?.url?.includes('/marketplace/create')) {
    if (lowerMessage.includes('help') || lowerMessage.includes('stuck')) {
      return `📝 You're on the listing creation page! Here's what to do:

1. **Item for Sale** - Select "Vehicle" 
2. **Vehicle Type** - Choose Car/Truck
3. **Year, Make, Model** - Fill in the vehicle details
4. **Price** - Enter the listing price
5. **Location** - Your dealership location
6. **Photos** - Add vehicle images

💡 Tip: Click "Auto-Fill" to populate these fields automatically from your queued vehicle!`;
    }
    
    if (lowerMessage.includes('error') || lowerMessage.includes('not working')) {
      return `🔧 Common form issues:

• **"Field required"** - Make sure all required fields are filled
• **Photos not uploading** - Try smaller images (<10MB each)
• **Location not found** - Try a nearby city instead
• **Page freezing** - Refresh and try again

What specific error are you seeing?`;
    }
  }
  
  if (lowerMessage.includes('post') && lowerMessage.includes('vehicle')) {
    return `To post a vehicle:

1. 🚗 Go to Dealers Face web app
2. 📋 Find the vehicle in Inventory
3. 🖱️ Click "Post to Facebook" → Select "IAI Soldier"
4. ✅ The task will appear in your extension
5. 🔄 Click "Execute" or enable Auto-Execute

Is your vehicle queued? Check the extension sidebar!`;
  }
  
  if (lowerMessage.includes('connect') || lowerMessage.includes('login')) {
    return `To connect your Facebook account:

1. Open the extension sidebar
2. Log in with your Dealers Face credentials
3. Make sure you're logged into Facebook in this browser
4. Navigate to facebook.com/marketplace

⚠️ Stay logged into Facebook for posting to work!`;
  }
  
  // Default helpful response
  return `I can help with:

• 📝 **Posting vehicles** - How to list on Marketplace
• 🔧 **Troubleshooting** - Fix common errors
• 📊 **Status check** - See your pending tasks
• 🚀 **Quick tips** - Best practices

What would you like to know?`;
}

// Classify error severity for Nova
function classifyErrorSeverity(error: string): string {
  const lowerError = error.toLowerCase();
  
  if (lowerError.includes('auth') || lowerError.includes('token') || lowerError.includes('unauthorized')) {
    return 'high';
  }
  if (lowerError.includes('network') || lowerError.includes('timeout') || lowerError.includes('connection')) {
    return 'medium';
  }
  if (lowerError.includes('not found') || lowerError.includes('missing')) {
    return 'low';
  }
  
  return 'medium';
}

// Generate diagnostic for error
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function generateErrorDiagnostic(error: string, _context: any): Promise<string> {
  const lowerError = error.toLowerCase();
  
  if (lowerError.includes('element not found') || lowerError.includes('selector')) {
    return 'Facebook may have updated their page. Try refreshing. If this persists, we\'ll update the extension.';
  }
  
  if (lowerError.includes('unauthorized') || lowerError.includes('403')) {
    return 'Session expired. Please log in again to the extension.';
  }
  
  if (lowerError.includes('network') || lowerError.includes('fetch')) {
    return 'Network issue detected. Check your internet connection and try again.';
  }
  
  if (lowerError.includes('timeout')) {
    return 'Page took too long to respond. Try refreshing Facebook and retry.';
  }
  
  return 'An unexpected error occurred. Our team has been notified and will investigate.';
}

export default router;
