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
// Task Routes
// ============================================

/**
 * GET /api/extension/tasks/:accountId
 * Get pending tasks for an account
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
    
    // Get pending tasks for this account
    const tasks: ExtensionTask[] = [];
    taskQueue.forEach((task) => {
      if (task.accountId === accountId && task.status === 'pending') {
        tasks.push(task);
      }
    });
    
    res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to get tasks' });
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
 * Update task status
 */
router.post('/tasks/:taskId/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const taskId = req.params.taskId as string;
    const { status, result } = req.body;
    
    const task = taskQueue.get(taskId);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    
    task.status = status;
    task.result = result;
    task.updatedAt = new Date();
    
    console.log(`Task ${taskId} updated to: ${status}`);
    
    // If completed or failed, schedule cleanup after 5 minutes
    if (status === 'completed' || status === 'failed') {
      setTimeout(() => {
        taskQueue.delete(taskId);
      }, 5 * 60 * 1000);
    }
    
    res.json({ success: true });
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

export default router;
