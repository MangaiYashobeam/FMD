/**
 * Chrome Extension API Routes
 * 
 * Handles communication between the extension and the server:
 * - Task management
 * - Scrape results
 * - Element finding with AI
 * - Account info
 */

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { verifyToken } from '../middleware/auth';
import { AINavigationAgent } from '../services/ai-agent.service';

const router = Router();
const aiAgent = new AINavigationAgent();

// ============================================
// Task Management
// ============================================

/**
 * GET /api/extension/tasks/:accountId/pending
 * Get pending tasks for an account
 */
router.get('/tasks/:accountId/pending', verifyToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    
    // Verify user owns this account
    if (req.user.dealerAccountId !== accountId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const tasks = await prisma.extensionTask.findMany({
      where: {
        accountId,
        status: 'pending',
      },
      orderBy: {
        priority: 'desc',
      },
      take: 10,
    });
    
    res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to get tasks' });
  }
});

/**
 * POST /api/extension/tasks
 * Create a new task
 */
router.post('/tasks', verifyToken, async (req, res) => {
  try {
    const { type, data, priority = 5 } = req.body;
    const accountId = req.user.dealerAccountId;
    
    const task = await prisma.extensionTask.create({
      data: {
        accountId,
        type,
        data,
        priority,
        status: 'pending',
      },
    });
    
    res.json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

/**
 * POST /api/extension/tasks/:taskId/complete
 * Mark task as completed
 */
router.post('/tasks/:taskId/complete', verifyToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { result } = req.body;
    
    const task = await prisma.extensionTask.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        result,
        completedAt: new Date(),
      },
    });
    
    // Process results based on task type
    await processTaskResult(task);
    
    res.json({ success: true, task });
  } catch (error) {
    console.error('Complete task error:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

/**
 * POST /api/extension/tasks/:taskId/failed
 * Mark task as failed
 */
router.post('/tasks/:taskId/failed', verifyToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { error } = req.body;
    
    const task = await prisma.extensionTask.update({
      where: { id: taskId },
      data: {
        status: 'failed',
        result: { error },
        completedAt: new Date(),
      },
    });
    
    res.json({ success: true, task });
  } catch (error) {
    console.error('Fail task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

/**
 * POST /api/extension/tasks/:taskId/status
 * Update task status
 */
router.post('/tasks/:taskId/status', verifyToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status, result } = req.body;
    
    const task = await prisma.extensionTask.update({
      where: { id: taskId },
      data: {
        status,
        result: result || undefined,
        completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined,
      },
    });
    
    res.json({ success: true, task });
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({ error: 'Failed to update task status' });
  }
});

// ============================================
// Scrape Results
// ============================================

/**
 * POST /api/extension/scrape-result
 * Store scraped data from extension
 */
router.post('/scrape-result', verifyToken, async (req, res) => {
  try {
    const { type, accountId, ...data } = req.body;
    
    switch (type) {
      case 'inbox':
        await processInboxScrape(accountId, data);
        break;
      case 'conversation':
        await processConversationScrape(accountId, data);
        break;
      case 'listing':
        await processListingScrape(accountId, data);
        break;
      default:
        console.log('Unknown scrape type:', type);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Scrape result error:', error);
    res.status(500).json({ error: 'Failed to process scrape result' });
  }
});

// ============================================
// AI Element Finding
// ============================================

/**
 * POST /api/extension/find-element
 * Use AI to find element selector
 */
router.post('/find-element', verifyToken, async (req, res) => {
  try {
    const { description, pageHtml, url } = req.body;
    
    const result = await aiAgent.findElement({
      targetDescription: description,
      pageContext: pageHtml,
      url,
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
router.post('/analyze-conversation', verifyToken, async (req, res) => {
  try {
    const { messages, vehicleInfo } = req.body;
    
    const analysis = await aiAgent.analyzeConversation(messages, vehicleInfo);
    
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
router.post('/generate-response', verifyToken, async (req, res) => {
  try {
    const { messages, vehicleInfo, dealerProfile, responseType } = req.body;
    
    const response = await aiAgent.generateLeadResponse({
      leadMessages: messages,
      vehicleInfo,
      dealerProfile,
      responseType,
    });
    
    res.json(response);
  } catch (error) {
    console.error('Generate response error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

// ============================================
// Account Info
// ============================================

/**
 * GET /api/extension/account
 * Get account info and stats
 */
router.get('/account', verifyToken, async (req, res) => {
  try {
    const accountId = req.user.dealerAccountId;
    
    // Get dealer account
    const account = await prisma.dealerAccount.findUnique({
      where: { id: accountId },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Get stats
    const [listingsCount, leadsCount, responsesCount, pendingTasksCount] = await Promise.all([
      prisma.vehicle.count({ where: { dealerAccountId: accountId } }),
      prisma.lead.count({ where: { dealerAccountId: accountId } }),
      prisma.lead.count({ 
        where: { 
          dealerAccountId: accountId,
          autoResponded: true,
        },
      }),
      prisma.extensionTask.count({
        where: {
          accountId,
          status: 'pending',
        },
      }),
    ]);
    
    res.json({
      id: account.id,
      name: account.businessName || account.user.name,
      email: account.user.email,
      stats: {
        listings: listingsCount,
        leads: leadsCount,
        responses: responsesCount,
        pendingTasks: pendingTasksCount,
        unreadMessages: 0, // TODO: Track unread
      },
    });
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({ error: 'Failed to get account info' });
  }
});

// ============================================
// Helper Functions
// ============================================

async function processTaskResult(task: any) {
  switch (task.type) {
    case 'scrape_inbox':
      if (task.result?.conversations) {
        await processInboxScrape(task.accountId, task.result);
      }
      break;
    case 'scrape_conversation':
      if (task.result?.messages) {
        await processConversationScrape(task.accountId, task.result);
      }
      break;
    case 'post_vehicle':
      // Update vehicle status
      if (task.data?.vehicleId) {
        await prisma.vehicle.update({
          where: { id: task.data.vehicleId },
          data: {
            facebookStatus: task.status === 'completed' ? 'posted' : 'failed',
            facebookListingUrl: task.result?.listingUrl,
          },
        });
      }
      break;
  }
}

async function processInboxScrape(accountId: string, data: any) {
  const { conversations } = data;
  
  for (const conv of conversations || []) {
    // Check if lead exists
    const existingLead = await prisma.lead.findFirst({
      where: {
        dealerAccountId: accountId,
        facebookConversationId: conv.id,
      },
    });
    
    if (!existingLead) {
      // Create new lead
      await prisma.lead.create({
        data: {
          dealerAccountId: accountId,
          facebookConversationId: conv.id,
          name: conv.name,
          source: 'facebook_marketplace',
          status: 'new',
          lastMessage: conv.preview,
          lastMessageAt: new Date(),
        },
      });
    } else {
      // Update existing lead
      await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          lastMessage: conv.preview,
          lastMessageAt: new Date(),
          isUnread: conv.isUnread,
        },
      });
    }
  }
}

async function processConversationScrape(accountId: string, data: any) {
  const { messages, conversationId } = data;
  
  // Find the lead
  const lead = await prisma.lead.findFirst({
    where: {
      dealerAccountId: accountId,
      facebookConversationId: conversationId,
    },
  });
  
  if (!lead) return;
  
  // Analyze conversation with AI
  const analysis = await aiAgent.analyzeConversation(messages, null);
  
  // Update lead with analysis
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      score: analysis.leadScore,
      intent: analysis.buyerIntent,
      extractedInfo: analysis.extractedInfo,
      suggestedActions: analysis.suggestedActions,
    },
  });
  
  // Store messages
  for (const msg of messages) {
    await prisma.message.upsert({
      where: {
        leadId_facebookMessageId: {
          leadId: lead.id,
          facebookMessageId: msg.id,
        },
      },
      create: {
        leadId: lead.id,
        facebookMessageId: msg.id,
        text: msg.text,
        sender: msg.sender,
        isOutgoing: msg.isOutgoing,
        sentAt: new Date(msg.time || Date.now()),
      },
      update: {},
    });
  }
}

async function processListingScrape(accountId: string, data: any) {
  // Store scraped listing data for comparison/sync
  console.log('Processing listing scrape:', data);
}

export default router;
