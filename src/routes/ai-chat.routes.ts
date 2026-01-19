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
 */

import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '@/middleware/auth';
import { aiChatController } from '@/controllers/ai-chat.controller';

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

export default router;
