/**
 * AI Chat Routes - Nova's Communication Endpoints
 * 
 * Endpoints:
 * - POST /api/ai/sessions - Create new chat session
 * - GET /api/ai/sessions - List user's sessions
 * - GET /api/ai/sessions/:sessionId - Get session with messages
 * - PUT /api/ai/sessions/:sessionId - Update session
 * - DELETE /api/ai/sessions/:sessionId - Delete session
 * - POST /api/ai/sessions/:sessionId/messages - Send message
 * - GET /api/ai/sessions/:sessionId/messages - Get messages
 * - POST /api/ai/upload - Upload file attachment
 * - GET /api/ai/file-types - Get allowed file types
 * - GET /api/ai/memories - Get user's memories
 * - POST /api/ai/memories - Create memory
 * - DELETE /api/ai/memories/:memoryId - Delete memory
 * - GET /api/ai/notifications/stream - SSE for real-time AI notifications to user
 * 
 * Super Admin Conversation Control:
 * - POST /api/ai/sessions/:sessionId/stop - Stop active conversation
 * - GET /api/ai/sessions/:sessionId/thoughts - Get AI thoughts
 * - GET /api/ai/sessions/:sessionId/thoughts/stream - SSE for real-time thoughts
 * - GET /api/ai/sessions/:sessionId/checkpoints - Get conversation checkpoints
 * - POST /api/ai/checkpoints/:checkpointId/revert - Revert to checkpoint
 * - GET /api/ai/sessions/:sessionId/file-changes - Get file changes
 * - POST /api/ai/sessions/:sessionId/watch - Start watching conversation
 * - DELETE /api/ai/sessions/:sessionId/watch - Stop watching conversation
 * - GET /api/ai/sessions/:sessionId/state - Get full conversation state
 * - GET /api/ai/active-conversations - Get all active conversations
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticate } from '@/middleware/auth';
import { aiChatController } from '@/controllers/ai-chat.controller';
import { aiInterventionEvents } from '@/services/ai-intervention.service';
import { logger } from '@/utils/logger';

const router = Router();

// Configure multer for memory storage (files kept in buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// All routes require authentication
router.use(authenticate);

// ============================================
// User Notification Stream (SSE)
// ============================================

/**
 * @route GET /api/ai/notifications/stream
 * @desc SSE endpoint for real-time AI notifications to user
 * @access Private (authenticated users)
 */
router.get('/notifications/stream', async (req: Request & { user?: any }, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send initial connected event
    res.write(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`);

    // Handler for AI intervention messages
    const onIntervention = (data: any) => {
      // Only send to the specific user this intervention is for
      if (data.userId === userId) {
        res.write(`data: ${JSON.stringify({ 
          type: 'ai_intervention', 
          data: {
            sessionId: data.sessionId,
            messageId: data.messageId,
            interventionId: data.interventionId,
            ticketId: data.ticketId,
            message: 'Nova has a message for you about an issue we detected.',
          }
        })}\n\n`);
        logger.info(`AI notification sent to user ${userId}`);
      }
    };

    // Handler for ticket escalations
    const onEscalation = (data: any) => {
      if (data.userId === userId) {
        res.write(`data: ${JSON.stringify({ 
          type: 'ticket_escalated', 
          data: {
            ticketId: data.ticketId,
            priority: data.priority,
            message: 'A support ticket has been escalated for your account.',
          }
        })}\n\n`);
      }
    };

    // Subscribe to events
    aiInterventionEvents.on('message:sent', onIntervention);
    aiInterventionEvents.on('ticket:escalated', onEscalation);

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
    }, 30000);

    // Cleanup on connection close
    req.on('close', () => {
      clearInterval(heartbeat);
      aiInterventionEvents.off('message:sent', onIntervention);
      aiInterventionEvents.off('ticket:escalated', onEscalation);
      logger.info(`User ${userId} disconnected from notification stream`);
    });

    logger.info(`User ${userId} connected to notification stream`);

  } catch (error) {
    logger.error('Notification stream error:', error);
    res.status(500).json({ success: false, error: 'Stream failed' });
  }
});

// ============================================
// Session Management
// ============================================

/**
 * @route POST /api/ai/sessions
 * @desc Create a new chat session
 * @access Private
 */
router.post('/sessions', aiChatController.createSession.bind(aiChatController));

/**
 * @route GET /api/ai/sessions
 * @desc Get user's chat sessions
 * @access Private
 */
router.get('/sessions', aiChatController.getSessions.bind(aiChatController));

/**
 * @route GET /api/ai/sessions/:sessionId
 * @desc Get a specific session with messages
 * @access Private
 */
router.get('/sessions/:sessionId', aiChatController.getSession.bind(aiChatController));

/**
 * @route PUT /api/ai/sessions/:sessionId
 * @desc Update a session (title, pin status)
 * @access Private
 */
router.put('/sessions/:sessionId', aiChatController.updateSession.bind(aiChatController));

/**
 * @route DELETE /api/ai/sessions/:sessionId
 * @desc Delete a session
 * @access Private
 */
router.delete('/sessions/:sessionId', aiChatController.deleteSession.bind(aiChatController));

// ============================================
// Message Handling
// ============================================

/**
 * @route POST /api/ai/sessions/:sessionId/messages
 * @desc Send a message and get AI response
 * @access Private
 */
router.post('/sessions/:sessionId/messages', aiChatController.sendMessage.bind(aiChatController));

/**
 * @route GET /api/ai/sessions/:sessionId/messages
 * @desc Get messages for a session
 * @access Private
 */
router.get('/sessions/:sessionId/messages', aiChatController.getMessages.bind(aiChatController));

// ============================================
// File Upload
// ============================================

/**
 * @route POST /api/ai/upload
 * @desc Upload a file attachment
 * @access Private
 */
router.post('/upload', upload.single('file'), aiChatController.uploadAttachment.bind(aiChatController));

/**
 * @route GET /api/ai/file-types
 * @desc Get allowed file types for current user
 * @access Private
 */
router.get('/file-types', aiChatController.getAllowedFileTypes.bind(aiChatController));

// ============================================
// Memory Management
// ============================================

/**
 * @route GET /api/ai/memories
 * @desc Get user's memories
 * @access Private
 */
router.get('/memories', aiChatController.getMemories.bind(aiChatController));

/**
 * @route POST /api/ai/memories
 * @desc Create a new memory
 * @access Private
 */
router.post('/memories', aiChatController.createMemory.bind(aiChatController));

/**
 * @route DELETE /api/ai/memories/:memoryId
 * @desc Delete a memory
 * @access Private
 */
router.delete('/memories/:memoryId', aiChatController.deleteMemory.bind(aiChatController));

// ============================================
// Super Admin Conversation Control
// ============================================

/**
 * @route GET /api/ai/active-conversations
 * @desc Get all active conversations (super admin only)
 * @access Super Admin
 */
router.get('/active-conversations', aiChatController.getActiveConversations.bind(aiChatController));

/**
 * @route POST /api/ai/sessions/:sessionId/stop
 * @desc Stop an active conversation
 * @access Super Admin
 */
router.post('/sessions/:sessionId/stop', aiChatController.stopConversation.bind(aiChatController));

/**
 * @route GET /api/ai/sessions/:sessionId/thoughts
 * @desc Get AI thoughts for a session
 * @access Super Admin
 */
router.get('/sessions/:sessionId/thoughts', aiChatController.getConversationThoughts.bind(aiChatController));

/**
 * @route GET /api/ai/sessions/:sessionId/thoughts/stream
 * @desc SSE endpoint for real-time thought streaming
 * @access Super Admin
 */
router.get('/sessions/:sessionId/thoughts/stream', aiChatController.streamThoughts.bind(aiChatController));

/**
 * @route GET /api/ai/sessions/:sessionId/checkpoints
 * @desc Get conversation checkpoints
 * @access Private (owner or super admin)
 */
router.get('/sessions/:sessionId/checkpoints', aiChatController.getCheckpoints.bind(aiChatController));

/**
 * @route POST /api/ai/checkpoints/:checkpointId/revert
 * @desc Revert to a checkpoint
 * @access Super Admin
 */
router.post('/checkpoints/:checkpointId/revert', aiChatController.revertToCheckpoint.bind(aiChatController));

/**
 * @route GET /api/ai/sessions/:sessionId/file-changes
 * @desc Get file changes for a session
 * @access Super Admin
 */
router.get('/sessions/:sessionId/file-changes', aiChatController.getFileChanges.bind(aiChatController));

/**
 * @route POST /api/ai/sessions/:sessionId/watch
 * @desc Start watching a conversation
 * @access Super Admin
 */
router.post('/sessions/:sessionId/watch', aiChatController.watchConversation.bind(aiChatController));

/**
 * @route DELETE /api/ai/sessions/:sessionId/watch
 * @desc Stop watching a conversation
 * @access Private
 */
router.delete('/sessions/:sessionId/watch', aiChatController.unwatchConversation.bind(aiChatController));

/**
 * @route GET /api/ai/sessions/:sessionId/state
 * @desc Get full conversation state
 * @access Super Admin
 */
router.get('/sessions/:sessionId/state', aiChatController.getConversationState.bind(aiChatController));

export default router;
