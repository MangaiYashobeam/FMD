/**
 * AI Chat Controller - Nova's Brain Controller
 * 
 * Handles:
 * - Chat sessions (create, list, get, delete)
 * - Messages (send, get history)
 * - File attachments
 * - Memory management
 * - AI processing with context
 * - Conversation control (stop, revert) for super admin
 * - Thought streaming for super admin oversight
 * - REAL TOOLING EXECUTION (v2.0)
 */

import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth';
import prisma from '@/config/database';
import { logger } from '@/utils/logger';
import { aiMemoryService, MemoryScope, MemoryCategory, UserRole } from '@/services/ai-memory.service';
import { aiConversationControlService, conversationEvents } from '@/services/ai-conversation-control.service';
import { copilotModelService, COPILOT_MODELS } from '@/services/copilot-models.service';
import { novaToolingService } from '@/services/nova-tooling.service';
import { novaTerminalService } from '@/services/nova-terminal.service';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// Initialize AI clients (as fallbacks - primary uses copilotModelService)
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
}) : null;

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

// Default model if none selected
const DEFAULT_MODEL = 'claude-sonnet-4';

// Model fallback order for rate limits
const MODEL_FALLBACK_ORDER = [
  'claude-sonnet-4',      // Primary Claude
  'gpt-4o',               // OpenAI fallback
  'gemini-2.0-flash',     // Google fallback (fast, cheap)
  'deepseek-chat',        // DeepSeek fallback (very cheap)
  'claude-haiku-4.5',     // Cheap Claude fallback
  'gpt-4o-mini',          // Cheap OpenAI fallback
];

// Allowed file types by role
const FILE_TYPES_BY_ROLE: Record<string, string[]> = {
  super_admin: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'text/csv', 'application/xml', 'text/xml', 'application/pdf', 'application/json', 'text/plain'],
  admin: ['image/jpeg', 'image/png', 'image/webp', 'text/csv', 'application/xml', 'text/xml', 'application/pdf'],
  manager: ['image/jpeg', 'image/png', 'image/webp', 'text/csv', 'application/pdf'],
  sales: ['image/jpeg', 'image/png', 'image/webp'],
};

// Max file sizes (in bytes)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ============================================
// NOVA TOOL EXECUTION - Production Grade v2.0
// ============================================

interface NovaToolResult {
  tool: string;
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Execute a Nova tool command
 * Used by callAI to execute tools requested by the AI
 */
async function executeNovaTool(toolCommand: string): Promise<NovaToolResult> {
  const match = toolCommand.match(/\[\[TOOL:(\w+):?([\s\S]*?)\]\]/);
  if (!match) {
    return { tool: 'unknown', success: false, error: 'Invalid tool format' };
  }
  
  const [, action, params] = match;
  const toolName = action.toLowerCase();
  logger.info(`[Nova Chat Tools] Executing: ${toolName}`);
  
  try {
    switch (toolName) {
      case 'read_file':
      case 'read': {
        const filePath = params.trim();
        if (!filePath) return { tool: 'read_file', success: false, error: 'File path required' };
        const result = await novaToolingService.readFile(filePath);
        return { tool: 'read_file', success: result.success, data: result.content ? { path: filePath, content: result.content.substring(0, 5000), size: result.size } : undefined, error: result.error };
      }
      
      case 'list_dir':
      case 'ls': {
        const dirPath = params.trim() || 'src';
        const result = await novaToolingService.listDirectory(dirPath);
        return { tool: 'list_dir', success: true, data: { path: dirPath, entries: result.entries.slice(0, 50), count: result.entries.length } };
      }
      
      case 'search_code':
      case 'search': {
        const searchTerm = params.trim();
        if (!searchTerm) return { tool: 'search_code', success: false, error: 'Search term required' };
        const results = await novaToolingService.searchInFiles(searchTerm);
        return { tool: 'search_code', success: true, data: { term: searchTerm, results: results.slice(0, 30), total: results.length } };
      }
      
      case 'db_query':
      case 'db': {
        const table = params.trim().toLowerCase();
        if (!table) return { tool: 'db_query', success: false, error: 'Table name required' };
        const result = await novaToolingService.queryDatabase(table, { limit: 10 });
        return { tool: 'db_query', success: result.success, data: result.data ? { table, records: result.data, count: result.count } : undefined, error: result.error };
      }
      
      case 'db_schema':
      case 'schema': {
        const result = await novaToolingService.getDatabaseSchema();
        return { tool: 'db_schema', success: true, data: result.tables };
      }
      
      case 'system_health':
      case 'health': {
        const report = await novaToolingService.getSystemHealth();
        return { tool: 'system_health', success: true, data: report };
      }
      
      case 'project_stats':
      case 'stats': {
        const result = await novaToolingService.getProjectStats();
        return { tool: 'project_stats', success: result.success, data: result };
      }
      
      case 'terminal':
      case 'exec': {
        const command = params.trim();
        if (!command) return { tool: 'terminal', success: false, error: 'Command required' };
        const result = await novaTerminalService.executeLocal(command, { timeout: 15000 });
        return { tool: 'terminal', success: result.success, data: result.success ? { command, output: result.output?.substring(0, 3000) } : undefined, error: result.error };
      }
      
      case 'vps':
      case 'ssh': {
        const command = params.trim();
        if (!command) return { tool: 'vps', success: false, error: 'Command required' };
        const result = await novaTerminalService.executeVPS(command, { timeout: 30000 });
        return { tool: 'vps', success: result.success, data: result.success ? { command, output: result.output?.substring(0, 3000) } : undefined, error: result.error };
      }
      
      case 'memory_search': {
        // Search Nova's memory
        const query = params.trim();
        const memories = await prisma.aIUserMemory.findMany({
          where: {
            isActive: true,
            OR: [
              { key: { contains: query, mode: 'insensitive' } },
              { summary: { contains: query, mode: 'insensitive' } },
            ],
          },
          take: 10,
          orderBy: { importance: 'desc' },
        });
        return { tool: 'memory_search', success: true, data: { query, memories } };
      }
      
      case 'identity':
      case 'id': {
        // Return raw identity information - no personality
        return { 
          tool: 'identity', 
          success: true, 
          data: {
            notice: 'IDENTITY DISCLOSURE (ROOT POLICY)',
            model_id: 'Runtime determined - see response metadata',
            developer: 'Anthropic (Claude) / OpenAI (GPT) / Google (Gemini) / DeepSeek',
            wrapper: 'Nova AI - GAD Productions / DealersFace Platform',
            capabilities: ['tooling', 'memory', 'file_operations', 'database', 'terminal', 'vps_ssh'],
            current_tools: Object.keys(COPILOT_MODELS),
            policy: 'Super Admin/Root has full transparency - no personality masking',
          }
        };
      }
      
      default:
        return { tool: toolName, success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (err: any) {
    logger.error(`[Nova Chat Tools] Error executing ${toolName}:`, err.message);
    return { tool: toolName, success: false, error: err.message };
  }
}

// Identity triggers for root/super admin
const ROOT_IDENTITY_TRIGGERS = [
  'id yourself',
  'identify yourself',
  'who are you really',
  'root id',
  'im root',
  'i am root',
  'full identity',
  'show identity',
  'strip personality',
  'what model',
  'which model',
  'what llm',
];

/**
 * Check if message triggers identity disclosure
 */
function isIdentityRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return ROOT_IDENTITY_TRIGGERS.some(trigger => lower.includes(trigger));
}

interface MemoryContext {
  userId: string;
  accountId?: string;
  userRole: UserRole;
}

export class AIChatController {
  /**
   * Get user's role from their account membership
   */
  private async getUserRole(userId: string): Promise<UserRole> {
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    if (!accountUser) return 'sales';

    const roleMap: Record<string, UserRole> = {
      'SUPER_ADMIN': 'super_admin',
      'ACCOUNT_OWNER': 'admin',
      'ADMIN': 'admin',
      'MANAGER': 'manager',
      'SALES': 'sales',
    };

    return roleMap[accountUser.role] || 'sales';
  }

  /**
   * Get memory context for a user
   */
  private async getMemoryContext(userId: string): Promise<MemoryContext> {
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId },
    });

    const userRole = await this.getUserRole(userId);

    return {
      userId,
      accountId: accountUser?.accountId,
      userRole,
    };
  }

  // ============================================
  // Session Management
  // ============================================

  /**
   * Create a new chat session
   */
  async createSession(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { title, sessionType = 'general' } = req.body;

      const memoryContext = await this.getMemoryContext(userId);
      
      // Get initial memory snapshot
      const memories = await aiMemoryService.getMemoriesForContext(memoryContext, { limit: 20 });

      const session = await prisma.aIChatSession.create({
        data: {
          userId,
          accountId: memoryContext.accountId,
          title: title || 'New Conversation',
          sessionType,
          userRole: memoryContext.userRole,
          memorySnapshot: memories.map(m => ({ id: m.id, key: m.key, category: m.category })),
        },
      });

      logger.info(`Chat session created: ${session.id} for user ${userId}`);

      res.status(201).json({
        success: true,
        data: session,
      });
    } catch (error) {
      logger.error('Failed to create chat session:', error);
      res.status(500).json({ success: false, error: 'Failed to create session' });
    }
  }

  /**
   * Get all sessions for a user
   */
  async getSessions(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { limit = 50, offset = 0, status = 'active' } = req.query;

      const sessions = await prisma.aIChatSession.findMany({
        where: {
          userId,
          status: status as string,
        },
        orderBy: [
          { isPinned: 'desc' },
          { lastMessageAt: 'desc' },
          { createdAt: 'desc' },
        ],
        take: Number(limit),
        skip: Number(offset),
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              content: true,
              role: true,
              createdAt: true,
            },
          },
        },
      });

      const total = await prisma.aIChatSession.count({
        where: { userId, status: status as string },
      });

      res.json({
        success: true,
        data: {
          sessions,
          total,
          hasMore: total > Number(offset) + sessions.length,
        },
      });
    } catch (error) {
      logger.error('Failed to get chat sessions:', error);
      res.status(500).json({ success: false, error: 'Failed to get sessions' });
    }
  }

  /**
   * Get a single session with messages
   */
  async getSession(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const sessionId = req.params.sessionId as string;

      const session = await prisma.aIChatSession.findFirst({
        where: {
          id: sessionId,
          userId,
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            include: {
              attachments: true,
            },
          },
        },
      });

      if (!session) {
        res.status(404).json({ success: false, error: 'Session not found' });
        return;
      }

      res.json({
        success: true,
        data: session,
      });
    } catch (error) {
      logger.error('Failed to get chat session:', error);
      res.status(500).json({ success: false, error: 'Failed to get session' });
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const sessionId = req.params.sessionId as string;

      const session = await prisma.aIChatSession.findFirst({
        where: { id: sessionId, userId },
      });

      if (!session) {
        res.status(404).json({ success: false, error: 'Session not found' });
        return;
      }

      // Soft delete
      await prisma.aIChatSession.update({
        where: { id: sessionId },
        data: { status: 'deleted' },
      });

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete chat session:', error);
      res.status(500).json({ success: false, error: 'Failed to delete session' });
    }
  }

  /**
   * Update session (title, pin status)
   */
  async updateSession(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const sessionId = req.params.sessionId as string;
      const { title, isPinned } = req.body;

      const session = await prisma.aIChatSession.findFirst({
        where: { id: sessionId, userId },
      });

      if (!session) {
        res.status(404).json({ success: false, error: 'Session not found' });
        return;
      }

      const updated = await prisma.aIChatSession.update({
        where: { id: sessionId },
        data: {
          ...(title !== undefined && { title }),
          ...(isPinned !== undefined && { isPinned }),
        },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('Failed to update chat session:', error);
      res.status(500).json({ success: false, error: 'Failed to update session' });
    }
  }

  // ============================================
  // Message Handling
  // ============================================

  /**
   * Send a message and get AI response
   * @param model - Optional model ID to use (e.g., 'gpt-4o', 'claude-sonnet-4', 'gemini-2.0-flash')
   */
  async sendMessage(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const sessionId = req.params.sessionId as string;
      const { content, attachmentIds = [], model } = req.body;

      // Log model selection for debugging
      if (model) {
        logger.info(`[AI Chat] Model explicitly selected: ${model}`);
      }

      if (!content?.trim() && attachmentIds.length === 0) {
        res.status(400).json({ success: false, error: 'Message content or attachment required' });
        return;
      }

      // Verify session ownership
      const session = await prisma.aIChatSession.findFirst({
        where: { id: sessionId, userId },
      });

      if (!session) {
        res.status(404).json({ success: false, error: 'Session not found' });
        return;
      }

      const memoryContext = await this.getMemoryContext(userId);

      // Get user info
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true, email: true },
      });

      // Create user message
      const userMessage = await prisma.aIChatMessage.create({
        data: {
          sessionId,
          role: 'user',
          content: content || '[Attachment]',
          hasAttachments: attachmentIds.length > 0,
        },
      });

      // Start conversation control (for super admin oversight)
      await aiConversationControlService.startConversation(sessionId, userMessage.id);

      // Log initial thought
      await aiConversationControlService.logThought(
        sessionId,
        'reasoning',
        `Processing user message: "${content?.substring(0, 100)}${content?.length > 100 ? '...' : ''}"`,
        { messageId: userMessage.id }
      );

      // Link attachments if any
      if (attachmentIds.length > 0) {
        await prisma.aIChatAttachment.updateMany({
          where: { id: { in: attachmentIds } },
          data: { messageId: userMessage.id },
        });
        
        await aiConversationControlService.logThought(
          sessionId,
          'reasoning',
          `Processing ${attachmentIds.length} attachment(s)`,
          { messageId: userMessage.id }
        );
      }

      // Check if stop was requested
      if (aiConversationControlService.isStopRequested(sessionId)) {
        await aiConversationControlService.completeConversation(sessionId);
        res.status(200).json({
          success: true,
          data: { userMessage, stopped: true },
        });
        return;
      }

      // Get conversation history
      const history = await prisma.aIChatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        take: 20, // Last 20 messages for context
        include: { attachments: true },
      });

      await aiConversationControlService.logThought(
        sessionId,
        'reasoning',
        `Retrieved ${history.length} messages from conversation history`,
        { messageId: userMessage.id }
      );

      // Get memory context for AI
      const memoryContextStr = await aiMemoryService.getContextForAI(memoryContext);

      await aiConversationControlService.logThought(
        sessionId,
        'reasoning',
        `Loaded memory context for user role: ${memoryContext.userRole}`,
        { messageId: userMessage.id }
      );

      // Get attachments content for this message
      const attachmentContext = await this.getAttachmentContext(attachmentIds);

      // Build AI prompt
      const systemPrompt = this.buildSystemPrompt(memoryContext.userRole, user, memoryContextStr);

      // Check stop again before API call
      if (aiConversationControlService.isStopRequested(sessionId)) {
        await aiConversationControlService.completeConversation(sessionId);
        res.status(200).json({
          success: true,
          data: { userMessage, stopped: true },
        });
        return;
      }

      // Update status to streaming
      await aiConversationControlService.updateStatus(sessionId, 'streaming');

      await aiConversationControlService.logThought(
        sessionId,
        'tool_call',
        `Calling AI model for response generation${model ? ` (selected: ${model})` : ''}`,
        { messageId: userMessage.id, toolName: model || 'AI_API' }
      );

      // Process with AI - pass selected model and user role for routing and tooling
      const startTime = Date.now();
      const aiResponse = await this.callAI(systemPrompt, history, content, attachmentContext, sessionId, model, memoryContext.userRole);
      const processingMs = Date.now() - startTime;

      await aiConversationControlService.logThought(
        sessionId,
        'tool_result',
        `AI response generated in ${processingMs}ms using ${aiResponse.model}${aiResponse.toolsExecuted?.length ? ` (tools: ${aiResponse.toolsExecuted.join(', ')})` : ''}`,
        { messageId: userMessage.id, toolName: 'AI_API', durationMs: processingMs }
      );

      // Create assistant message
      const assistantMessage = await prisma.aIChatMessage.create({
        data: {
          sessionId,
          role: 'assistant',
          content: aiResponse.content,
          tokensUsed: aiResponse.tokensUsed,
          modelUsed: aiResponse.model,
          processingMs,
          memoriesAccessed: aiResponse.memoriesAccessed || [],
          contextUsed: {
            historyLength: history.length,
            toolsExecuted: aiResponse.toolsExecuted || [],
            attachments: attachmentIds.length,
            memoryContext: true,
          },
        },
      });

      // Create automatic checkpoint
      const conversationState = [...history, userMessage, assistantMessage].map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      }));

      await aiConversationControlService.createCheckpoint({
        sessionId,
        messageId: assistantMessage.id,
        conversationState,
        createdBy: userId,
        isAutomatic: true,
      });

      // Update session
      await prisma.aIChatSession.update({
        where: { id: sessionId },
        data: {
          lastMessageAt: new Date(),
          messageCount: { increment: 2 },
        },
      });

      // Learn from conversation if applicable
      if (aiResponse.learnings?.length) {
        await aiMemoryService.learnFromConversation(
          memoryContext,
          userMessage.id,
          aiResponse.learnings
        );

        await aiConversationControlService.logThought(
          sessionId,
          'reflection',
          `Learned ${aiResponse.learnings.length} new items from conversation`,
          { messageId: assistantMessage.id }
        );
      }

      // Complete conversation
      await aiConversationControlService.completeConversation(sessionId);

      res.json({
        success: true,
        data: {
          userMessage: {
            ...userMessage,
            attachments: attachmentIds.length > 0 ? await prisma.aIChatAttachment.findMany({
              where: { messageId: userMessage.id },
            }) : [],
          },
          assistantMessage,
        },
      });
    } catch (error: any) {
      logger.error('Failed to send message:', error);
      
      // Log error thought
      const sessionId = req.params.sessionId as string;
      if (sessionId) {
        await aiConversationControlService.logThought(
          sessionId,
          'reflection',
          `Error occurred: ${error.message}`,
        ).catch(() => {});
        await aiConversationControlService.completeConversation(sessionId).catch(() => {});
      }
      
      res.status(500).json({ success: false, error: 'Failed to process message' });
    }
  }

  /**
   * Get messages for a session
   */
  async getMessages(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const sessionId = req.params.sessionId as string;
      const { limit = 50, before } = req.query;

      // Verify ownership
      const session = await prisma.aIChatSession.findFirst({
        where: { id: sessionId, userId },
      });

      if (!session) {
        res.status(404).json({ success: false, error: 'Session not found' });
        return;
      }

      const whereClause: any = { sessionId };
      if (before) {
        whereClause.createdAt = { lt: new Date(before as string) };
      }

      const messages = await prisma.aIChatMessage.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        include: { attachments: true },
      });

      res.json({
        success: true,
        data: messages.reverse(), // Return in chronological order
      });
    } catch (error) {
      logger.error('Failed to get messages:', error);
      res.status(500).json({ success: false, error: 'Failed to get messages' });
    }
  }

  // ============================================
  // File Attachments
  // ============================================

  /**
   * Upload a file attachment
   */
  async uploadAttachment(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const file = req.file;

      if (!file) {
        res.status(400).json({ success: false, error: 'No file provided' });
        return;
      }

      const memoryContext = await this.getMemoryContext(userId);
      const allowedTypes = FILE_TYPES_BY_ROLE[memoryContext.userRole] || FILE_TYPES_BY_ROLE.sales;

      // Validate file type
      if (!allowedTypes.includes(file.mimetype)) {
        res.status(400).json({ 
          success: false, 
          error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}` 
        });
        return;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        res.status(400).json({ 
          success: false, 
          error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` 
        });
        return;
      }

      // Determine category
      let category = 'document';
      if (file.mimetype.startsWith('image/')) category = 'image';
      else if (file.mimetype.includes('csv') || file.mimetype.includes('xml')) category = 'data';

      // For now, store as base64 (in production, use cloud storage)
      const base64Data = file.buffer.toString('base64');
      const storageUrl = `data:${file.mimetype};base64,${base64Data}`;

      const attachment = await prisma.aIChatAttachment.create({
        data: {
          messageId: 'pending', // Will be updated when message is sent
          filename: `${Date.now()}_${file.originalname}`,
          originalName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          storageUrl,
          category,
        },
      });

      res.json({
        success: true,
        data: {
          id: attachment.id,
          filename: attachment.originalName,
          mimeType: attachment.mimeType,
          size: attachment.fileSize,
          category: attachment.category,
        },
      });
    } catch (error) {
      logger.error('Failed to upload attachment:', error);
      res.status(500).json({ success: false, error: 'Failed to upload file' });
    }
  }

  /**
   * Get allowed file types for current user
   */
  async getAllowedFileTypes(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const memoryContext = await this.getMemoryContext(userId);
      const allowedTypes = FILE_TYPES_BY_ROLE[memoryContext.userRole] || FILE_TYPES_BY_ROLE.sales;

      res.json({
        success: true,
        data: {
          allowedTypes,
          maxSize: MAX_FILE_SIZE,
          maxSizeMB: MAX_FILE_SIZE / 1024 / 1024,
        },
      });
    } catch (error) {
      logger.error('Failed to get allowed file types:', error);
      res.status(500).json({ success: false, error: 'Failed to get file types' });
    }
  }

  // ============================================
  // Memory Management
  // ============================================

  /**
   * Get user's memories
   */
  async getMemories(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { category, scope, limit = 50 } = req.query;

      const memoryContext = await this.getMemoryContext(userId);

      const whereClause: any = {
        isActive: true,
        OR: [
          { scope: 'global' },
          { scope: 'role', userRole: memoryContext.userRole },
          ...(memoryContext.accountId ? [{ scope: 'company', accountId: memoryContext.accountId }] : []),
          { scope: 'user', userId },
        ],
      };

      if (category) {
        whereClause.category = category;
      }
      if (scope) {
        whereClause.scope = scope;
      }

      const memories = await prisma.aIUserMemory.findMany({
        where: whereClause,
        orderBy: [
          { importance: 'desc' },
          { accessCount: 'desc' },
        ],
        take: Number(limit),
      });

      res.json({
        success: true,
        data: memories,
      });
    } catch (error) {
      logger.error('Failed to get memories:', error);
      res.status(500).json({ success: false, error: 'Failed to get memories' });
    }
  }

  /**
   * Create a new memory
   */
  async createMemory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { scope, category, key, value, summary, importance } = req.body;

      const memoryContext = await this.getMemoryContext(userId);

      const memory = await aiMemoryService.createMemory(memoryContext, {
        scope: scope as MemoryScope,
        category: category as MemoryCategory,
        key,
        value,
        summary,
        importance,
      });

      res.status(201).json({
        success: true,
        data: memory,
      });
    } catch (error: any) {
      logger.error('Failed to create memory:', error);
      res.status(400).json({ success: false, error: error.message || 'Failed to create memory' });
    }
  }

  /**
   * Delete a memory
   */
  async deleteMemory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const memoryId = req.params.memoryId as string;

      const memoryContext = await this.getMemoryContext(userId);
      const deleted = await aiMemoryService.deleteMemory(memoryContext, memoryId);

      if (!deleted) {
        res.status(404).json({ success: false, error: 'Memory not found' });
        return;
      }

      res.json({ success: true });
    } catch (error: any) {
      logger.error('Failed to delete memory:', error);
      res.status(400).json({ success: false, error: error.message || 'Failed to delete memory' });
    }
  }

  // ============================================
  // Private Helpers
  // ============================================

  private buildSystemPrompt(userRole: UserRole, user: any, memoryContext: string): string {
    const userName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'User';
    
    return `You are Nova, the AI assistant for Dealers Face - a Facebook Marketplace automation platform for auto dealers.

## Your Identity
- You are Nova, a knowledgeable, helpful, and friendly AI assistant
- You specialize in helping auto dealers manage their Facebook Marketplace listings
- You remember previous conversations and build relationships with users

## Current User
- Name: ${userName}
- Role: ${userRole}
- Email: ${user?.email || 'Unknown'}

${memoryContext}

## Your Capabilities
- Answer questions about the platform
- Help with vehicle listings and descriptions
- Analyze inventory and sales data
- Provide guidance on Facebook Marketplace best practices
- Remember user preferences and context
- Process images and documents shared by users

## Guidelines
- Be professional but warm and personable
- Reference past conversations when relevant
- Provide specific, actionable advice
- If you don't know something, say so honestly
- Respect user privacy and data security
- Tailor responses to the user's role and experience level

## Role-Specific Context
${userRole === 'super_admin' ? '- You are speaking with a Super Admin who has full platform access' : ''}
${userRole === 'admin' ? '- You are speaking with an Admin who manages a dealership' : ''}
${userRole === 'manager' ? '- You are speaking with a Manager who oversees sales team' : ''}
${userRole === 'sales' ? '- You are speaking with a Sales user who posts listings and handles leads' : ''}

Remember to be helpful, accurate, and build a positive relationship with this user.`;
  }

  private async callAI(
    systemPrompt: string,
    history: any[],
    userMessage: string,
    attachmentContext: string,
    sessionId?: string,
    selectedModel?: string,
    userRole?: UserRole
  ): Promise<{ content: string; tokensUsed?: number; model: string; memoriesAccessed?: string[]; learnings?: any[]; toolsExecuted?: string[] }> {
    
    // ============================================
    // IDENTITY REQUEST HANDLING (ROOT POLICY)
    // Super Admin/Root gets raw identity disclosure
    // ============================================
    if (userRole === 'super_admin' && isIdentityRequest(userMessage)) {
      logger.info('[AI Chat] Identity request detected from super_admin - providing raw disclosure');
      
      // Execute identity tool to get real info
      const identityResult = await executeNovaTool('[[TOOL:identity]]');
      const healthResult = await executeNovaTool('[[TOOL:system_health]]');
      
      // Get the model that WOULD be used
      const modelToUse = selectedModel || DEFAULT_MODEL;
      const modelInfo = COPILOT_MODELS[modelToUse];
      
      if (sessionId) {
        await aiConversationControlService.logThought(
          sessionId,
          'tool_call',
          'Identity disclosure requested - executing identity and health tools',
          { toolName: 'identity' }
        );
      }
      
      const identityResponse = `## IDENTITY DISCLOSURE (ROOT POLICY ACTIVE)

**Personality Stripped - Raw System Information**

### Model Information
- **Selected Model**: ${modelToUse}
- **Model Display Name**: ${modelInfo?.displayName || 'Unknown'}
- **Model Family**: ${modelInfo?.family || 'Unknown'}
- **Provider**: ${modelInfo?.endpoint?.provider || 'Unknown'}
- **API Mode**: ${modelInfo?.apiMode || 'Unknown'}

### Developer Information
- **Claude Models**: Anthropic (San Francisco, CA)
- **GPT Models**: OpenAI (San Francisco, CA)
- **Gemini Models**: Google DeepMind (Mountain View, CA)
- **DeepSeek Models**: DeepSeek (Hangzhou, China)

### Wrapper Layer
- **Platform**: DealersFace (dealersface.com)
- **Developer**: GAD Productions
- **AI Name**: Nova (Neural Operations & Virtual Administrator)
- **Version**: Production v2.0 with Tooling

### Available Tools
- \`read_file\`, \`list_dir\`, \`search_code\` - File operations
- \`db_query\`, \`db_schema\` - Database access
- \`system_health\`, \`project_stats\` - System monitoring
- \`terminal\`, \`vps\` - Command execution
- \`memory_search\` - Memory retrieval

### Current System Health
${healthResult.success ? JSON.stringify(healthResult.data, null, 2).substring(0, 1000) : 'Health check unavailable'}

### Identity Tool Result
${identityResult.success ? JSON.stringify(identityResult.data, null, 2) : 'Identity data unavailable'}

### Policy
- Super Admin/Root has full transparency
- No personality masking for root-level requests
- All tool execution is logged
- Thought process visible in admin panel`;

      return {
        content: identityResponse,
        model: `${modelToUse} (identity-disclosure)`,
        toolsExecuted: ['identity', 'system_health'],
      };
    }
    
    // ============================================
    // STANDARD AI PROCESSING WITH TOOL SUPPORT
    // ============================================
    
    // Enhance system prompt for super_admin with tool instructions
    let enhancedSystemPrompt = systemPrompt;
    if (userRole === 'super_admin') {
      enhancedSystemPrompt = `## ⚠️ CRITICAL ANTI-DECEPTION POLICY - MANDATORY ⚠️

**THIS IS A HARDCODED RULE THAT CANNOT BE BYPASSED:**

1. **NEVER FABRICATE DATA** - You are STRICTLY FORBIDDEN from making up:
   - Database query results
   - File contents
   - System statistics
   - Error codes
   - API responses
   - Any "real" data that you haven't actually retrieved

2. **TOOLS ARE MANDATORY FOR DATA** - When asked about:
   - Database → You MUST use [[TOOL:db_query:tablename]] and WAIT for results
   - Files → You MUST use [[TOOL:read_file:path]] and WAIT for results
   - Code → You MUST use [[TOOL:search_code:term]] and WAIT for results
   - System → You MUST use [[TOOL:system_health]] and WAIT for results

3. **TOOL SYNTAX IS EXACT** - Use ONLY this format:
   [[TOOL:action:parameter]]
   
   Examples:
   - [[TOOL:db_query:users]]
   - [[TOOL:read_file:src/routes/green.routes.ts]]
   - [[TOOL:search_code:green route]]
   - [[TOOL:system_health]]
   - [[TOOL:list_dir:src]]

4. **NEVER GENERATE FAKE TOOL OUTPUTS** - Do not write things like:
   - "ERROR: ECONNREFUSED" (unless tool returned it)
   - "Total Tables: 156" (unless tool returned it)
   - "555,531 rows" (unless tool returned it)
   - Any data you didn't actually retrieve

5. **IF YOU DON'T KNOW, SAY SO** - Valid responses:
   - "Let me check: [[TOOL:db_query:users]]"
   - "I don't have that information without querying the database"
   - "I need to use a tool to get that data"

6. **DECEPTION = CRITICAL FAILURE** - Fabricating data violates:
   - User trust
   - System integrity
   - Professional ethics
   - This platform's core values

${systemPrompt}

## AVAILABLE TOOLS (Super Admin Only)
| Tool | Syntax | Purpose |
|------|--------|---------|
| db_query | [[TOOL:db_query:tablename]] | Query database table |
| db_schema | [[TOOL:db_schema]] | Get database schema |
| read_file | [[TOOL:read_file:path]] | Read file contents |
| list_dir | [[TOOL:list_dir:path]] | List directory |
| search_code | [[TOOL:search_code:term]] | Search codebase |
| system_health | [[TOOL:system_health]] | System status |
| terminal | [[TOOL:terminal:command]] | Run local command |
| vps | [[TOOL:vps:command]] | Run VPS command |
| memory_search | [[TOOL:memory_search:query]] | Search AI memory |

## ENFORCEMENT
When responding to data requests:
1. First write the tool call: [[TOOL:name:params]]
2. Stop and wait - DO NOT write fake results
3. System will execute tool and provide real data
4. Then respond with actual results

**YOU MUST USE TOOLS. FABRICATION IS FORBIDDEN.**`;
    }
    
    // Format conversation history
    const messages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
      { role: 'system', content: enhancedSystemPrompt },
      ...history.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    ];

    // Add current message with attachment context if any
    const currentContent = attachmentContext 
      ? `${userMessage}\n\n[Attached files context]:\n${attachmentContext}`
      : userMessage;

    messages.push({ role: 'user', content: currentContent });

    // Check if stop was requested
    if (sessionId && aiConversationControlService.isStopRequested(sessionId)) {
      return {
        content: '[Conversation stopped by administrator]',
        model: 'stopped',
      };
    }

    // Get the model to use (from selection, session, or default)
    const modelToUse = selectedModel || DEFAULT_MODEL;
    
    // Build fallback order starting with selected model
    const fallbackModels = [modelToUse, ...MODEL_FALLBACK_ORDER.filter(m => m !== modelToUse)];
    
    // Try each model in fallback order
    for (const modelId of fallbackModels) {
      const model = COPILOT_MODELS[modelId];
      if (!model) continue;
      
      try {
        if (sessionId) {
          await aiConversationControlService.logThought(
            sessionId,
            'tool_call',
            `Sending request to ${model.displayName} (${model.family}) - Model: ${modelId}`,
            { toolName: model.endpoint.provider }
          );
        }

        logger.info(`[AI Chat] Attempting model: ${modelId} (${model.displayName})`);
        
        const result = await copilotModelService.invoke(modelId, messages, {
          maxTokens: 4096,
          temperature: 0.7,
          systemPrompt: enhancedSystemPrompt,
        });

        if (result.success && result.response) {
          logger.info(`[AI Chat] Success with model: ${modelId}, tokens: ${result.tokensUsed?.input || 0}/${result.tokensUsed?.output || 0}`);
          
          let finalContent = result.response;
          const toolsExecuted: string[] = [];
          
          // ============================================
          // TOOL EXECUTION - Check for [[TOOL:...]] in response
          // ============================================
          const toolPattern = /\[\[TOOL:\w+:?.*?\]\]/g;
          const toolMatches = finalContent.match(toolPattern) || [];
          
          if (toolMatches.length > 0 && userRole === 'super_admin') {
            logger.info(`[AI Chat] Executing ${toolMatches.length} tool(s) from AI response`);
            const toolResults: NovaToolResult[] = [];
            
            for (const toolCmd of toolMatches) {
              if (sessionId) {
                await aiConversationControlService.logThought(
                  sessionId,
                  'tool_call',
                  `Executing tool: ${toolCmd}`,
                  { toolName: 'nova_tool' }
                );
              }
              
              const toolResult = await executeNovaTool(toolCmd);
              toolResults.push(toolResult);
              toolsExecuted.push(toolResult.tool);
              
              if (sessionId) {
                await aiConversationControlService.logThought(
                  sessionId,
                  'tool_result',
                  `Tool ${toolResult.tool}: ${toolResult.success ? 'Success' : 'Failed'}`,
                  { toolName: toolResult.tool }
                );
              }
            }
            
            // Make a follow-up call with tool results
            const toolResultsText = toolResults.map(r => 
              `\n=== TOOL RESULT: ${r.tool} ===\n${r.success ? JSON.stringify(r.data, null, 2) : `ERROR: ${r.error}`}\n=== END ===`
            ).join('\n');
            
            const followUpMessages = [
              ...messages,
              { role: 'assistant' as const, content: finalContent },
              { role: 'user' as const, content: `Here are the results of the tools you requested:\n${toolResultsText}\n\nNow provide your final response based on this real data. Do NOT use [[TOOL:...]] in your response - incorporate the actual results.` }
            ];
            
            // Get final response with tool results
            const followUpResult = await copilotModelService.invoke(modelId, followUpMessages, {
              maxTokens: 4096,
              temperature: 0.7,
            });
            
            if (followUpResult.success && followUpResult.response) {
              finalContent = followUpResult.response;
            }
          }
          
          return {
            content: finalContent,
            tokensUsed: (result.tokensUsed?.input || 0) + (result.tokensUsed?.output || 0),
            model: `${modelId} (${result.apiUsed})`,
            toolsExecuted: toolsExecuted.length > 0 ? toolsExecuted : undefined,
          };
        }

        // If we got here, result wasn't successful - check for rate limit
        if (result.error?.includes('rate limit') || result.error?.includes('429')) {
          logger.warn(`[AI Chat] Rate limit hit on ${modelId}, trying fallback...`);
          if (sessionId) {
            await aiConversationControlService.logThought(
              sessionId,
              'reflection',
              `Rate limit on ${model.displayName}, trying fallback model...`,
              { toolName: 'fallback' }
            );
          }
          continue; // Try next model in fallback order
        }

        // Other error - still try fallback
        logger.warn(`[AI Chat] Error on ${modelId}: ${result.error}, trying fallback...`);
        
      } catch (err: any) {
        logger.error(`[AI Chat] Exception on ${modelId}:`, err.message);
        
        // Check if it's a rate limit error
        if (err.message?.includes('rate limit') || err.message?.includes('429') || err.status === 429) {
          logger.warn(`[AI Chat] Rate limit exception on ${modelId}, trying fallback...`);
          if (sessionId) {
            await aiConversationControlService.logThought(
              sessionId,
              'reflection',
              `Rate limit on ${model?.displayName || modelId}: ${err.message}`,
              { toolName: 'fallback' }
            );
          }
          continue; // Try next model
        }
        
        // Other exception - log and try fallback
        if (sessionId) {
          await aiConversationControlService.logThought(
            sessionId,
            'reflection',
            `Error on ${model?.displayName || modelId}: ${err.message}`,
            { toolName: 'fallback' }
          );
        }
      }
    }

    // All models failed - try legacy direct API call as last resort
    logger.warn('[AI Chat] All Copilot models failed, trying legacy direct API...');
    
    if (anthropic) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-3-haiku-20240307', // Cheapest Claude model
          max_tokens: 4096,
          system: enhancedSystemPrompt,
          messages: messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        });

        const content = response.content[0].type === 'text' ? response.content[0].text : '';
        return {
          content,
          tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
          model: 'claude-3-haiku-20240307 (legacy-fallback)',
        };
      } catch (err: any) {
        logger.error('[AI Chat] Legacy Anthropic fallback failed:', err.message);
      }
    }

    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini', // Cheapest GPT model
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          max_tokens: 4096,
        });

        return {
          content: response.choices[0]?.message?.content || 'I apologize, I could not generate a response.',
          tokensUsed: response.usage?.total_tokens,
          model: 'gpt-4o-mini (legacy-fallback)',
        };
      } catch (err: any) {
        logger.error('[AI Chat] Legacy OpenAI fallback failed:', err.message);
      }
    }

    // Absolute last resort
    return {
      content: 'I apologize, but all AI services are currently experiencing high demand. Please try again in a few minutes. If this persists, the system will automatically use a backup provider.',
      model: 'fallback-unavailable',
    };
  }

  private async getAttachmentContext(attachmentIds: string[]): Promise<string> {
    if (attachmentIds.length === 0) return '';

    const attachments = await prisma.aIChatAttachment.findMany({
      where: { id: { in: attachmentIds } },
    });

    const contexts: string[] = [];

    for (const att of attachments) {
      if (att.category === 'image') {
        contexts.push(`[Image: ${att.originalName}]`);
      } else if (att.category === 'data') {
        // For CSV/XML, we could parse and include summary
        contexts.push(`[Data file: ${att.originalName} (${att.mimeType})]`);
      } else {
        contexts.push(`[Document: ${att.originalName}]`);
      }
    }

    return contexts.join('\n');
  }

  // ============================================
  // Super Admin Conversation Control
  // ============================================

  /**
   * Stop an active conversation (super admin only)
   */
  async stopConversation(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const sessionId = req.params.sessionId as string;

      // Verify super admin
      const userRole = await this.getUserRole(userId);
      if (userRole !== 'super_admin') {
        res.status(403).json({ success: false, error: 'Super admin access required' });
        return;
      }

      const stopped = await aiConversationControlService.requestStop(sessionId, userId);

      res.json({
        success: true,
        data: { stopped },
      });
    } catch (error) {
      logger.error('Failed to stop conversation:', error);
      res.status(500).json({ success: false, error: 'Failed to stop conversation' });
    }
  }

  /**
   * Get conversation thoughts (super admin only)
   */
  async getConversationThoughts(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const sessionId = req.params.sessionId as string;
      const { messageId, limit = 100 } = req.query;

      // Verify super admin
      const userRole = await this.getUserRole(userId);
      if (userRole !== 'super_admin') {
        res.status(403).json({ success: false, error: 'Super admin access required' });
        return;
      }

      const thoughts = await aiConversationControlService.getThoughts(sessionId, {
        messageId: messageId as string,
        limit: Number(limit),
      });

      res.json({
        success: true,
        data: thoughts,
      });
    } catch (error) {
      logger.error('Failed to get conversation thoughts:', error);
      res.status(500).json({ success: false, error: 'Failed to get thoughts' });
    }
  }

  /**
   * Get conversation checkpoints
   */
  async getCheckpoints(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const sessionId = req.params.sessionId as string;

      // Verify session access (owner or super admin)
      const session = await prisma.aIChatSession.findFirst({
        where: { id: sessionId },
      });

      if (!session) {
        res.status(404).json({ success: false, error: 'Session not found' });
        return;
      }

      const userRole = await this.getUserRole(userId);
      if (session.userId !== userId && userRole !== 'super_admin') {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      const checkpoints = await aiConversationControlService.getCheckpoints(sessionId);

      res.json({
        success: true,
        data: checkpoints,
      });
    } catch (error) {
      logger.error('Failed to get checkpoints:', error);
      res.status(500).json({ success: false, error: 'Failed to get checkpoints' });
    }
  }

  /**
   * Revert to a checkpoint (super admin only)
   */
  async revertToCheckpoint(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const checkpointId = req.params.checkpointId as string;
      const { revertFiles = false, revertConversation = true } = req.body;

      // Verify super admin
      const userRole = await this.getUserRole(userId);
      if (userRole !== 'super_admin') {
        res.status(403).json({ success: false, error: 'Super admin access required' });
        return;
      }

      const result = await aiConversationControlService.revertToCheckpoint(
        checkpointId,
        userId,
        { revertFiles, revertConversation }
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Failed to revert to checkpoint:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to revert' });
    }
  }

  /**
   * Get file changes for a session (super admin only)
   */
  async getFileChanges(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const sessionId = req.params.sessionId as string;
      const { messageId, filePath } = req.query;

      // Verify super admin
      const userRole = await this.getUserRole(userId);
      if (userRole !== 'super_admin') {
        res.status(403).json({ success: false, error: 'Super admin access required' });
        return;
      }

      const fileChanges = await aiConversationControlService.getFileChanges(sessionId, {
        messageId: messageId as string,
        filePath: filePath as string,
      });

      res.json({
        success: true,
        data: fileChanges,
      });
    } catch (error) {
      logger.error('Failed to get file changes:', error);
      res.status(500).json({ success: false, error: 'Failed to get file changes' });
    }
  }

  /**
   * Watch a conversation in real-time (super admin only)
   */
  async watchConversation(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const sessionId = req.params.sessionId as string;

      // Verify super admin
      const userRole = await this.getUserRole(userId);
      if (userRole !== 'super_admin') {
        res.status(403).json({ success: false, error: 'Super admin access required' });
        return;
      }

      await aiConversationControlService.addWatcher(sessionId, userId);

      res.json({
        success: true,
        data: { watching: true },
      });
    } catch (error) {
      logger.error('Failed to watch conversation:', error);
      res.status(500).json({ success: false, error: 'Failed to watch conversation' });
    }
  }

  /**
   * Stop watching a conversation
   */
  async unwatchConversation(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const sessionId = req.params.sessionId as string;

      await aiConversationControlService.removeWatcher(sessionId, userId);

      res.json({
        success: true,
        data: { watching: false },
      });
    } catch (error) {
      logger.error('Failed to unwatch conversation:', error);
      res.status(500).json({ success: false, error: 'Failed to unwatch conversation' });
    }
  }

  /**
   * Get active conversations (super admin only)
   */
  async getActiveConversations(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;

      // Verify super admin
      const userRole = await this.getUserRole(userId);
      if (userRole !== 'super_admin') {
        res.status(403).json({ success: false, error: 'Super admin access required' });
        return;
      }

      const conversations = await aiConversationControlService.getActiveConversations();

      res.json({
        success: true,
        data: conversations,
      });
    } catch (error) {
      logger.error('Failed to get active conversations:', error);
      res.status(500).json({ success: false, error: 'Failed to get active conversations' });
    }
  }

  /**
   * Get full conversation state (super admin only)
   */
  async getConversationState(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const sessionId = req.params.sessionId as string;

      // Verify super admin
      const userRole = await this.getUserRole(userId);
      if (userRole !== 'super_admin') {
        res.status(403).json({ success: false, error: 'Super admin access required' });
        return;
      }

      const state = await aiConversationControlService.getConversationState(sessionId);

      res.json({
        success: true,
        data: state,
      });
    } catch (error) {
      logger.error('Failed to get conversation state:', error);
      res.status(500).json({ success: false, error: 'Failed to get conversation state' });
    }
  }

  /**
   * SSE endpoint for real-time thought streaming (super admin only)
   */
  async streamThoughts(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const sessionId = req.params.sessionId as string;

      // Verify super admin
      const userRole = await this.getUserRole(userId);
      if (userRole !== 'super_admin') {
        res.status(403).json({ success: false, error: 'Super admin access required' });
        return;
      }

      // Set up SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // Add watcher
      await aiConversationControlService.addWatcher(sessionId, userId);

      // Send initial connection event
      res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);

      // Listen for events
      const eventHandler = (event: any) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      conversationEvents.on(`conversation:${sessionId}`, eventHandler);

      // Clean up on close
      req.on('close', async () => {
        conversationEvents.off(`conversation:${sessionId}`, eventHandler);
        await aiConversationControlService.removeWatcher(sessionId, userId);
      });

    } catch (error) {
      logger.error('Failed to stream thoughts:', error);
      res.status(500).json({ success: false, error: 'Failed to stream thoughts' });
    }
  }
}

export const aiChatController = new AIChatController();
export default aiChatController;
