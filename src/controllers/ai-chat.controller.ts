/**
 * AI Chat Controller - Nova's Brain Controller
 * 
 * Handles:
 * - Chat sessions (create, list, get, delete)
 * - Messages (send, get history)
 * - File attachments
 * - Memory management
 * - AI processing with context
 */

import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth';
import prisma from '@/config/database';
import { logger } from '@/utils/logger';
import { aiMemoryService, MemoryScope, MemoryCategory, UserRole } from '@/services/ai-memory.service';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// Initialize AI clients
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
}) : null;

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

// Allowed file types by role
const FILE_TYPES_BY_ROLE: Record<string, string[]> = {
  super_admin: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'text/csv', 'application/xml', 'text/xml', 'application/pdf', 'application/json', 'text/plain'],
  admin: ['image/jpeg', 'image/png', 'image/webp', 'text/csv', 'application/xml', 'text/xml', 'application/pdf'],
  manager: ['image/jpeg', 'image/png', 'image/webp', 'text/csv', 'application/pdf'],
  sales: ['image/jpeg', 'image/png', 'image/webp'],
};

// Max file sizes (in bytes)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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
   */
  async sendMessage(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const sessionId = req.params.sessionId as string;
      const { content, attachmentIds = [] } = req.body;

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

      // Link attachments if any
      if (attachmentIds.length > 0) {
        await prisma.aIChatAttachment.updateMany({
          where: { id: { in: attachmentIds } },
          data: { messageId: userMessage.id },
        });
      }

      // Get conversation history
      const history = await prisma.aIChatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        take: 20, // Last 20 messages for context
        include: { attachments: true },
      });

      // Get memory context for AI
      const memoryContextStr = await aiMemoryService.getContextForAI(memoryContext);

      // Get attachments content for this message
      const attachmentContext = await this.getAttachmentContext(attachmentIds);

      // Build AI prompt
      const systemPrompt = this.buildSystemPrompt(memoryContext.userRole, user, memoryContextStr);

      // Process with AI
      const startTime = Date.now();
      const aiResponse = await this.callAI(systemPrompt, history, content, attachmentContext);
      const processingMs = Date.now() - startTime;

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
            attachments: attachmentIds.length,
            memoryContext: true,
          },
        },
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
      }

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
    } catch (error) {
      logger.error('Failed to send message:', error);
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
    attachmentContext: string
  ): Promise<{ content: string; tokensUsed?: number; model: string; memoriesAccessed?: string[]; learnings?: any[] }> {
    
    // Format conversation history
    const messages = history.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    // Add current message with attachment context if any
    const currentContent = attachmentContext 
      ? `${userMessage}\n\n[Attached files context]:\n${attachmentContext}`
      : userMessage;

    messages.push({ role: 'user', content: currentContent });

    // Try Anthropic first, fall back to OpenAI
    if (anthropic) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          messages: messages,
        });

        const content = response.content[0].type === 'text' ? response.content[0].text : '';
        
        return {
          content,
          tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
          model: 'claude-sonnet-4-20250514',
        };
      } catch (err) {
        logger.error('Anthropic API error:', err);
      }
    }

    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
          ],
          max_tokens: 4096,
        });

        return {
          content: response.choices[0]?.message?.content || 'I apologize, I could not generate a response.',
          tokensUsed: response.usage?.total_tokens,
          model: 'gpt-4o-mini',
        };
      } catch (err) {
        logger.error('OpenAI API error:', err);
      }
    }

    // Fallback if no API available
    return {
      content: 'I apologize, but I am currently unable to process requests. Please try again later or contact support.',
      model: 'fallback',
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
}

export const aiChatController = new AIChatController();
export default aiChatController;
