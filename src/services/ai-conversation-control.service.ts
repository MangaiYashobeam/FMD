/**
 * AI Conversation Control Service
 * 
 * Manages:
 * - Conversation state and control (start, stop, abort)
 * - Thought streaming for super admin oversight
 * - Checkpoints and conversation history
 * - File change tracking and reversion
 * - Real-time watching by super admins
 */

import prisma from '@/config/database';
import { logger } from '@/utils/logger';
import { EventEmitter } from 'events';

// Types
export type ConversationStatus = 'idle' | 'thinking' | 'streaming' | 'stopped' | 'completed';
export type ThoughtType = 'reasoning' | 'tool_call' | 'tool_result' | 'decision' | 'reflection';
export type FileChangeType = 'create' | 'modify' | 'delete';

interface ThoughtLog {
  id: string;
  sessionId: string;
  messageId?: string;
  thoughtType: ThoughtType;
  content: string;
  sequence: number;
  toolName?: string;
  toolInput?: any;
  toolOutput?: any;
  durationMs?: number;
  createdAt: Date;
}

interface FileChange {
  filePath: string;
  fileType: string;
  changeType: FileChangeType;
  beforeContent?: string;
  afterContent?: string;
  diff?: string;
  linesAdded: number;
  linesRemoved: number;
}

interface CheckpointData {
  sessionId: string;
  messageId: string;
  name?: string;
  description?: string;
  conversationState: any[];
  memoryState?: any[];
  fileChanges?: FileChange[];
  createdBy: string;
  isAutomatic?: boolean;
}

// Event emitter for real-time updates
class ConversationEventEmitter extends EventEmitter {}
export const conversationEvents = new ConversationEventEmitter();

export class AIConversationControlService {
  // In-memory state for active conversations (for real-time control)
  private activeConversations = new Map<string, {
    status: ConversationStatus;
    thoughtSequence: number;
    stopRequested: boolean;
    abortController?: AbortController;
  }>();

  // ============================================
  // Conversation Control
  // ============================================

  /**
   * Start a conversation - create control record
   */
  async startConversation(sessionId: string, messageId: string): Promise<void> {
    // Initialize in-memory state
    this.activeConversations.set(sessionId, {
      status: 'thinking',
      thoughtSequence: 0,
      stopRequested: false,
      abortController: new AbortController(),
    });

    // Create or update control record
    await prisma.aIConversationControl.upsert({
      where: { sessionId },
      update: {
        status: 'thinking',
        currentMessageId: messageId,
        stopRequested: false,
        stopRequestedBy: null,
        stopRequestedAt: null,
        lastActivityAt: new Date(),
      },
      create: {
        sessionId,
        status: 'thinking',
        currentMessageId: messageId,
      },
    });

    // Emit event for watchers
    conversationEvents.emit(`conversation:${sessionId}`, {
      type: 'status_change',
      status: 'thinking',
      messageId,
    });

    logger.info(`Conversation started: ${sessionId}`);
  }

  /**
   * Update conversation status
   */
  async updateStatus(sessionId: string, status: ConversationStatus): Promise<void> {
    const state = this.activeConversations.get(sessionId);
    if (state) {
      state.status = status;
    }

    await prisma.aIConversationControl.update({
      where: { sessionId },
      data: {
        status,
        lastActivityAt: new Date(),
      },
    });

    conversationEvents.emit(`conversation:${sessionId}`, {
      type: 'status_change',
      status,
    });
  }

  /**
   * Request to stop a conversation
   */
  async requestStop(sessionId: string, requestedBy: string): Promise<boolean> {
    const state = this.activeConversations.get(sessionId);
    
    if (!state) {
      logger.warn(`No active conversation found for session: ${sessionId}`);
      return false;
    }

    // Set stop flag
    state.stopRequested = true;
    
    // Abort any ongoing API calls
    if (state.abortController) {
      state.abortController.abort();
    }

    // Update database
    await prisma.aIConversationControl.update({
      where: { sessionId },
      data: {
        status: 'stopped',
        stopRequested: true,
        stopRequestedBy: requestedBy,
        stopRequestedAt: new Date(),
        lastActivityAt: new Date(),
      },
    });

    conversationEvents.emit(`conversation:${sessionId}`, {
      type: 'stopped',
      stoppedBy: requestedBy,
    });

    logger.info(`Conversation stopped by ${requestedBy}: ${sessionId}`);
    return true;
  }

  /**
   * Check if stop was requested
   */
  isStopRequested(sessionId: string): boolean {
    const state = this.activeConversations.get(sessionId);
    return state?.stopRequested ?? false;
  }

  /**
   * Get abort signal for a conversation
   */
  getAbortSignal(sessionId: string): AbortSignal | undefined {
    return this.activeConversations.get(sessionId)?.abortController?.signal;
  }

  /**
   * Complete a conversation
   */
  async completeConversation(sessionId: string): Promise<void> {
    this.activeConversations.delete(sessionId);

    await prisma.aIConversationControl.update({
      where: { sessionId },
      data: {
        status: 'completed',
        lastActivityAt: new Date(),
      },
    });

    conversationEvents.emit(`conversation:${sessionId}`, {
      type: 'completed',
    });
  }

  // ============================================
  // Thought Logging (Super Admin Visibility)
  // ============================================

  /**
   * Log a thought during AI processing
   */
  async logThought(
    sessionId: string,
    thoughtType: ThoughtType,
    content: string,
    options?: {
      messageId?: string;
      toolName?: string;
      toolInput?: any;
      toolOutput?: any;
      durationMs?: number;
    }
  ): Promise<ThoughtLog> {
    const state = this.activeConversations.get(sessionId);
    const sequence = state ? ++state.thoughtSequence : 0;

    const thought = await prisma.aIThoughtLog.create({
      data: {
        sessionId,
        messageId: options?.messageId,
        thoughtType,
        content,
        sequence,
        toolName: options?.toolName,
        toolInput: options?.toolInput,
        toolOutput: options?.toolOutput,
        durationMs: options?.durationMs,
      },
    });

    // Emit for real-time watchers
    conversationEvents.emit(`conversation:${sessionId}`, {
      type: 'thought',
      thought: {
        id: thought.id,
        thoughtType,
        content,
        sequence,
        toolName: options?.toolName,
        createdAt: thought.createdAt,
      },
    });

    return thought as ThoughtLog;
  }

  /**
   * Get thoughts for a session
   */
  async getThoughts(sessionId: string, options?: {
    messageId?: string;
    limit?: number;
  }): Promise<ThoughtLog[]> {
    const thoughts = await prisma.aIThoughtLog.findMany({
      where: {
        sessionId,
        ...(options?.messageId && { messageId: options.messageId }),
        isVisible: true,
      },
      orderBy: { sequence: 'asc' },
      take: options?.limit,
    });

    return thoughts as ThoughtLog[];
  }

  /**
   * Hide a thought (super admin action)
   */
  async hideThought(thoughtId: string): Promise<void> {
    await prisma.aIThoughtLog.update({
      where: { id: thoughtId },
      data: { isVisible: false },
    });
  }

  // ============================================
  // Checkpoints and Reversion
  // ============================================

  /**
   * Create a checkpoint
   */
  async createCheckpoint(data: CheckpointData): Promise<string> {
    // Get checkpoint number
    const lastCheckpoint = await prisma.aIConversationCheckpoint.findFirst({
      where: { sessionId: data.sessionId },
      orderBy: { checkpointNumber: 'desc' },
    });
    const checkpointNumber = (lastCheckpoint?.checkpointNumber ?? 0) + 1;

    // Create checkpoint
    const checkpoint = await prisma.aIConversationCheckpoint.create({
      data: {
        sessionId: data.sessionId,
        messageId: data.messageId,
        checkpointNumber,
        name: data.name || `Checkpoint ${checkpointNumber}`,
        description: data.description,
        conversationState: data.conversationState,
        memoryState: data.memoryState,
        createdBy: data.createdBy,
        isAutomatic: data.isAutomatic ?? true,
      },
    });

    // Track file changes if any
    if (data.fileChanges?.length) {
      await prisma.aIFileChange.createMany({
        data: data.fileChanges.map(fc => ({
          checkpointId: checkpoint.id,
          messageId: data.messageId,
          filePath: fc.filePath,
          fileType: fc.fileType,
          changeType: fc.changeType,
          beforeContent: fc.beforeContent,
          afterContent: fc.afterContent,
          diff: fc.diff,
          linesAdded: fc.linesAdded,
          linesRemoved: fc.linesRemoved,
        })),
      });
    }

    conversationEvents.emit(`conversation:${data.sessionId}`, {
      type: 'checkpoint_created',
      checkpointId: checkpoint.id,
      checkpointNumber,
    });

    logger.info(`Checkpoint created: ${checkpoint.id} for session ${data.sessionId}`);
    return checkpoint.id;
  }

  /**
   * Get checkpoints for a session
   */
  async getCheckpoints(sessionId: string) {
    return prisma.aIConversationCheckpoint.findMany({
      where: {
        sessionId,
        isActive: true,
      },
      include: {
        fileChanges: {
          select: {
            id: true,
            filePath: true,
            changeType: true,
            linesAdded: true,
            linesRemoved: true,
            isReverted: true,
          },
        },
      },
      orderBy: { checkpointNumber: 'desc' },
    });
  }

  /**
   * Revert to a checkpoint
   */
  async revertToCheckpoint(
    checkpointId: string,
    revertedBy: string,
    options?: {
      revertFiles?: boolean;
      revertConversation?: boolean;
    }
  ): Promise<{
    conversationState: any[];
    fileChangesToRevert: any[];
  }> {
    const checkpoint = await prisma.aIConversationCheckpoint.findUnique({
      where: { id: checkpointId },
      include: {
        fileChanges: true,
      },
    });

    if (!checkpoint) {
      throw new Error('Checkpoint not found');
    }

    const result = {
      conversationState: checkpoint.conversationState as any[],
      fileChangesToRevert: [] as any[],
    };

    // Mark checkpoint as reverted
    await prisma.aIConversationCheckpoint.update({
      where: { id: checkpointId },
      data: {
        revertedAt: new Date(),
        revertedBy,
      },
    });

    // Revert files if requested
    if (options?.revertFiles && checkpoint.fileChanges.length > 0) {
      result.fileChangesToRevert = checkpoint.fileChanges.map((fc: any) => ({
        filePath: fc.filePath,
        changeType: fc.changeType,
        beforeContent: fc.beforeContent,
        afterContent: fc.afterContent,
      }));

      // Mark file changes as reverted
      await prisma.aIFileChange.updateMany({
        where: { checkpointId },
        data: {
          isReverted: true,
          revertedAt: new Date(),
          revertedBy,
        },
      });
    }

    // Revert conversation if requested
    if (options?.revertConversation) {
      // Delete messages after this checkpoint
      await prisma.aIChatMessage.deleteMany({
        where: {
          sessionId: checkpoint.sessionId,
          createdAt: { gt: checkpoint.createdAt },
        },
      });

      // Deactivate checkpoints after this one
      await prisma.aIConversationCheckpoint.updateMany({
        where: {
          sessionId: checkpoint.sessionId,
          checkpointNumber: { gt: checkpoint.checkpointNumber },
        },
        data: { isActive: false },
      });
    }

    conversationEvents.emit(`conversation:${checkpoint.sessionId}`, {
      type: 'reverted',
      checkpointId,
      checkpointNumber: checkpoint.checkpointNumber,
      revertedBy,
    });

    logger.info(`Reverted to checkpoint ${checkpointId} by ${revertedBy}`);
    return result;
  }

  // ============================================
  // File Change Tracking
  // ============================================

  /**
   * Track a file change
   */
  async trackFileChange(
    checkpointId: string,
    messageId: string,
    change: FileChange
  ): Promise<void> {
    await prisma.aIFileChange.create({
      data: {
        checkpointId,
        messageId,
        filePath: change.filePath,
        fileType: change.fileType,
        changeType: change.changeType,
        beforeContent: change.beforeContent,
        afterContent: change.afterContent,
        diff: change.diff,
        linesAdded: change.linesAdded,
        linesRemoved: change.linesRemoved,
      },
    });
  }

  /**
   * Get file changes for a session
   */
  async getFileChanges(sessionId: string, options?: {
    messageId?: string;
    filePath?: string;
  }) {
    const checkpoints = await prisma.aIConversationCheckpoint.findMany({
      where: { sessionId },
      select: { id: true },
    });

    const checkpointIds = checkpoints.map((c: { id: string }) => c.id);

    return prisma.aIFileChange.findMany({
      where: {
        checkpointId: { in: checkpointIds },
        ...(options?.messageId && { messageId: options.messageId }),
        ...(options?.filePath && { filePath: options.filePath }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================
  // Super Admin Watching
  // ============================================

  /**
   * Add a watcher to a conversation
   */
  async addWatcher(sessionId: string, userId: string): Promise<void> {
    const control = await prisma.aIConversationControl.findUnique({
      where: { sessionId },
    });

    if (control) {
      const watchers = control.watchingUsers || [];
      if (!watchers.includes(userId)) {
        await prisma.aIConversationControl.update({
          where: { sessionId },
          data: {
            watchingUsers: [...watchers, userId],
          },
        });
      }
    }

    conversationEvents.emit(`conversation:${sessionId}`, {
      type: 'watcher_added',
      userId,
    });
  }

  /**
   * Remove a watcher from a conversation
   */
  async removeWatcher(sessionId: string, userId: string): Promise<void> {
    const control = await prisma.aIConversationControl.findUnique({
      where: { sessionId },
    });

    if (control) {
      const watchers = (control.watchingUsers || []).filter((w: string) => w !== userId);
      await prisma.aIConversationControl.update({
        where: { sessionId },
        data: { watchingUsers: watchers },
      });
    }

    conversationEvents.emit(`conversation:${sessionId}`, {
      type: 'watcher_removed',
      userId,
    });
  }

  /**
   * Get conversation state for super admin
   */
  async getConversationState(sessionId: string) {
    const control = await prisma.aIConversationControl.findUnique({
      where: { sessionId },
    });

    const thoughts = await this.getThoughts(sessionId, { limit: 100 });
    const checkpoints = await this.getCheckpoints(sessionId);

    return {
      control,
      thoughts,
      checkpoints,
      isActive: this.activeConversations.has(sessionId),
    };
  }

  /**
   * Get all active conversations (for super admin dashboard)
   */
  async getActiveConversations() {
    return prisma.aIConversationControl.findMany({
      where: {
        status: { in: ['thinking', 'streaming'] },
      },
      include: {
        // We'd need relations here - for now just get the basics
      },
      orderBy: { lastActivityAt: 'desc' },
    });
  }
}

export const aiConversationControlService = new AIConversationControlService();
export default aiConversationControlService;
