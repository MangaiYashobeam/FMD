/**
 * AI Center Controller
 * 
 * Handles all API requests for the AI Center functionality:
 * - Provider management
 * - Memory operations
 * - Training sessions
 * - Threat detection
 * - Learning patterns
 * - Task management
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  aiMemoryService,
  aiTrainingCenterService,
  aiThreatDetectionService,
  aiLearningPatternsService,
  aiTaskService,
} from '@/services/ai-center';

const prisma = new PrismaClient();

// ============================================
// Provider Management
// ============================================

// Default providers (used when database is empty)
const DEFAULT_PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    displayName: 'Anthropic',
    type: 'anthropic',
    isActive: true,
    defaultModel: 'claude-3-5-sonnet-20241022',
    availableModels: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-3-opus-20240229'],
    healthStatus: process.env.ANTHROPIC_API_KEY ? 'healthy' : 'unknown',
    capabilities: ['text', 'analysis', 'reasoning'],
    apiKey: process.env.ANTHROPIC_API_KEY ? '***configured***' : null,
  },
  {
    id: 'openai',
    name: 'OpenAI GPT-4',
    displayName: 'OpenAI',
    type: 'openai',
    isActive: true,
    defaultModel: 'gpt-4-turbo',
    availableModels: ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    healthStatus: process.env.OPENAI_API_KEY ? 'healthy' : 'unknown',
    capabilities: ['text', 'embeddings', 'vision'],
    apiKey: process.env.OPENAI_API_KEY ? '***configured***' : null,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    displayName: 'DeepSeek AI',
    type: 'deepseek',
    isActive: !!process.env.DEEPSEEK_API_KEY,
    defaultModel: 'deepseek-chat',
    availableModels: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
    healthStatus: process.env.DEEPSEEK_API_KEY ? 'healthy' : 'unknown',
    capabilities: ['text', 'code', 'reasoning'],
    apiKey: process.env.DEEPSEEK_API_KEY ? '***configured***' : null,
  },
];

/**
 * Get all AI providers
 */
export async function getProviders(_req: Request, res: Response, _next: NextFunction) {
  try {
    const providers = await prisma.aIProvider.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    // If no providers in database, return defaults
    if (providers.length === 0) {
      res.json({
        success: true,
        data: DEFAULT_PROVIDERS,
      });
      return;
    }

    res.json({
      success: true,
      data: providers,
    });
  } catch (error) {
    // On any error, return defaults
    res.json({
      success: true,
      data: DEFAULT_PROVIDERS,
    });
  }
}

/**
 * Get provider by ID
 */
export async function getProvider(req: Request, res: Response, next: NextFunction) {
  try {
    const providerId = req.params.providerId as string;

    const provider = await prisma.aIProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      res.status(404).json({
        success: false,
        error: 'Provider not found',
      });
      return;
    }

    res.json({
      success: true,
      data: provider,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create AI provider
 */
export async function createProvider(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      accountId,
      name,
      displayName,
      apiKey,
      apiEndpoint,
      defaultModel,
      availableModels,
      capabilities,
      maxTokensPerMinute,
      maxRequestsPerMinute,
    } = req.body;

    const provider = await prisma.aIProvider.create({
      data: {
        accountId,
        name,
        displayName: displayName || name,
        apiKey,
        apiEndpoint,
        defaultModel,
        availableModels: availableModels || [],
        capabilities: capabilities || {},
        maxTokensPerMinute: maxTokensPerMinute || 100000,
        maxRequestsPerMinute: maxRequestsPerMinute || 60,
        isActive: true,
        healthStatus: 'unknown',
      },
    });

    res.status(201).json({
      success: true,
      data: provider,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update AI provider
 */
export async function updateProvider(req: Request, res: Response, next: NextFunction) {
  try {
    const providerId = req.params.providerId as string;
    const updates = req.body;

    const provider = await prisma.aIProvider.update({
      where: { id: providerId },
      data: updates,
    });

    res.json({
      success: true,
      data: provider,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete AI provider
 */
export async function deleteProvider(req: Request, res: Response, next: NextFunction) {
  try {
    const providerId = req.params.providerId as string;

    await prisma.aIProvider.update({
      where: { id: providerId },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'Provider deactivated',
    });
  } catch (error) {
    next(error);
  }
}

// ============================================
// Memory Operations
// ============================================

/**
 * Store memory
 */
export async function storeMemory(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      providerId,
      accountId,
      memoryType,
      key,
      value,
      importance,
      tags,
      expiresAt,
    } = req.body;

    const memoryId = await aiMemoryService.store({
      providerId,
      accountId,
      memoryType,
      key,
      value,
      importance,
      tags,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    res.status(201).json({
      success: true,
      data: { id: memoryId },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieve memory
 */
export async function retrieveMemory(req: Request, res: Response, next: NextFunction) {
  try {
    const providerId = req.params.providerId as string;
    const memoryType = req.params.memoryType as string;
    const key = req.params.key as string;

    const memory = await aiMemoryService.retrieve(providerId, memoryType as any, key);

    if (!memory) {
      res.status(404).json({
        success: false,
        error: 'Memory not found',
      });
      return;
    }

    res.json({
      success: true,
      data: memory,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Search memories
 */
export async function searchMemories(req: Request, res: Response, next: NextFunction) {
  try {
    const { providerId, accountId, memoryType, tags, minImportance, limit } = req.query;

    const memories = await aiMemoryService.search({
      providerId: providerId as string,
      accountId: accountId as string,
      memoryType: memoryType as any,
      tags: tags ? (tags as string).split(',') : undefined,
      minImportance: minImportance ? parseFloat(minImportance as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      data: memories,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Semantic search memories
 */
export async function semanticSearchMemories(req: Request, res: Response, next: NextFunction) {
  try {
    const { providerId, accountId, query, threshold, limit } = req.body;

    const memories = await aiMemoryService.semanticSearch({
      providerId,
      accountId,
      query,
      similarityThreshold: threshold || 0.7,
      limit: limit || 10,
    });

    res.json({
      success: true,
      data: memories,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete memory
 */
export async function deleteMemory(req: Request, res: Response, next: NextFunction) {
  try {
    const memoryId = req.params.memoryId as string;

    await aiMemoryService.delete(memoryId);

    res.json({
      success: true,
      message: 'Memory deleted',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get conversation context
 */
export async function getConversationContext(req: Request, res: Response, next: NextFunction) {
  try {
    const providerId = req.params.providerId as string;
    const accountId = req.params.accountId as string;
    const conversationId = req.params.conversationId as string;

    const context = await aiMemoryService.getConversationContext(
      providerId,
      accountId,
      conversationId
    );

    res.json({
      success: true,
      data: context,
    });
  } catch (error) {
    next(error);
  }
}

// ============================================
// Training Operations
// ============================================

/**
 * Get available training types
 */
export async function getTrainingTypes(_req: Request, res: Response, next: NextFunction) {
  try {
    const types = aiTrainingCenterService.getAvailableTrainingTypes();

    res.json({
      success: true,
      data: types,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create training session
 */
export async function createTrainingSession(req: Request, res: Response, next: NextFunction) {
  try {
    const { providerId, accountId, name, description, trainingType, config } = req.body;

    const sessionId = await aiTrainingCenterService.createSession(
      providerId,
      accountId,
      { name, description, trainingType, config }
    );

    res.status(201).json({
      success: true,
      data: { id: sessionId },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Start training session
 */
export async function startTrainingSession(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.params.sessionId as string;

    await aiTrainingCenterService.startSession(sessionId);

    res.json({
      success: true,
      message: 'Training session started',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get training session progress
 */
export async function getTrainingProgress(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.params.sessionId as string;

    const progress = await aiTrainingCenterService.getSessionProgress(sessionId);

    res.json({
      success: true,
      data: progress,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get training sessions
 */
export async function getTrainingSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const accountId = req.params.accountId as string;
    const { status, trainingType } = req.query;

    const sessions = await aiTrainingCenterService.getSessions(accountId, {
      status: status as string,
      trainingType: trainingType as string,
    });

    res.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Add training example
 */
export async function addTrainingExample(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.params.sessionId as string;
    const { accountId, input, expectedOutput, category, context, quality } = req.body;

    const exampleId = await aiTrainingCenterService.addTrainingExample(
      sessionId,
      accountId,
      { input, expectedOutput, category, context, quality }
    );

    res.status(201).json({
      success: true,
      data: { id: exampleId },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get curriculum for training type
 */
export async function getCurriculum(req: Request, res: Response, next: NextFunction) {
  try {
    const trainingType = req.params.trainingType as string;

    const curriculum = aiTrainingCenterService.getCurriculumForType(trainingType as any);

    res.json({
      success: true,
      data: curriculum,
    });
  } catch (error) {
    next(error);
  }
}

// ============================================
// Threat Detection Operations
// ============================================

/**
 * Analyze message for threats
 */
export async function analyzeMessageThreats(req: Request, res: Response, next: NextFunction) {
  try {
    const { message, conversationHistory, senderId, accountId } = req.body;

    const analysis = await aiThreatDetectionService.analyzeMessage(message, {
      conversationHistory,
      senderId,
      accountId,
    });

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get threats for account
 */
export async function getThreats(req: Request, res: Response, next: NextFunction) {
  try {
    const accountId = req.params.accountId as string;
    const { status, severity, threatType, startDate, endDate, limit } = req.query;

    const threats = await aiThreatDetectionService.getThreats(accountId, {
      status: status as any,
      severity: severity as any,
      threatType: threatType as any,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      data: threats,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get threat statistics
 */
export async function getThreatStats(req: Request, res: Response, next: NextFunction) {
  try {
    const accountId = req.params.accountId as string;

    const stats = await aiThreatDetectionService.getThreatStats(accountId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update threat status
 */
export async function updateThreatStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const threatId = req.params.threatId as string;
    const { status, resolvedBy, notes } = req.body;

    await aiThreatDetectionService.updateThreatStatus(threatId, status, resolvedBy, notes);

    res.json({
      success: true,
      message: 'Threat status updated',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Escalate threat
 */
export async function escalateThreat(req: Request, res: Response, next: NextFunction) {
  try {
    const threatId = req.params.threatId as string;

    await aiThreatDetectionService.escalateThreat(threatId);

    res.json({
      success: true,
      message: 'Threat escalated',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get threat patterns
 */
export async function getThreatPatterns(req: Request, res: Response, next: NextFunction) {
  try {
    const { accountId } = req.query;

    const patterns = await aiThreatDetectionService.getPatterns(accountId as string);

    res.json({
      success: true,
      data: patterns,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Add threat pattern
 */
export async function addThreatPattern(req: Request, res: Response, next: NextFunction) {
  try {
    const { accountId, name, description, patternType, pattern, threatType, severity } = req.body;

    const patternId = await aiThreatDetectionService.addPattern(accountId, {
      name,
      description,
      patternType,
      pattern,
      threatType,
      severity,
    });

    res.status(201).json({
      success: true,
      data: { id: patternId },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================
// Learning Patterns Operations
// ============================================

/**
 * Find matching patterns
 */
export async function findMatchingPatterns(req: Request, res: Response, next: NextFunction) {
  try {
    const { message, intent, sentiment, conversationHistory, customerData, vehicleData, dealerData } = req.body;

    const matches = await aiLearningPatternsService.findMatchingPatterns(message, {
      intent,
      sentiment,
      conversationHistory,
      customerData,
      vehicleData,
      dealerData,
    });

    res.json({
      success: true,
      data: matches,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get best pattern
 */
export async function getBestPattern(req: Request, res: Response, next: NextFunction) {
  try {
    const { message, context } = req.body;

    const pattern = await aiLearningPatternsService.getBestPattern(message, context);

    res.json({
      success: true,
      data: pattern,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Record pattern usage
 */
export async function recordPatternUsage(req: Request, res: Response, next: NextFunction) {
  try {
    const { conversationId, messageId, patternUsed, response, outcome, customerReaction, timeToResponse } = req.body;

    await aiLearningPatternsService.recordPatternUsage({
      conversationId,
      messageId,
      patternUsed,
      response,
      outcome,
      customerReaction,
      timeToResponse,
    });

    res.json({
      success: true,
      message: 'Pattern usage recorded',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all patterns
 */
export async function getPatterns(req: Request, res: Response, next: NextFunction) {
  try {
    const { category, accountId } = req.query;

    const patterns = await aiLearningPatternsService.getPatterns({
      category: category as any,
      accountId: accountId as string,
    });

    res.json({
      success: true,
      data: patterns,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create pattern
 */
export async function createPattern(req: Request, res: Response, next: NextFunction) {
  try {
    const { accountId, name, category, description, triggerConditions, responseTemplate, variables, successMetrics, contextRequirements } = req.body;

    const patternId = await aiLearningPatternsService.createPattern(accountId, {
      name,
      category,
      description,
      triggerConditions,
      responseTemplate,
      variables,
      successMetrics,
      contextRequirements,
    });

    res.status(201).json({
      success: true,
      data: { id: patternId },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get pattern performance report
 */
export async function getPatternPerformanceReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { accountId } = req.query;

    const report = await aiLearningPatternsService.getPerformanceReport(accountId as string);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Optimize pattern
 */
export async function optimizePattern(req: Request, res: Response, next: NextFunction) {
  try {
    const patternId = req.params.patternId as string;

    const optimization = await aiLearningPatternsService.optimizePattern(patternId);

    res.json({
      success: true,
      data: optimization,
    });
  } catch (error) {
    next(error);
  }
}

// ============================================
// Task Operations
// ============================================

/**
 * Create task
 */
export async function createTask(req: Request, res: Response, next: NextFunction) {
  try {
    const taskInput = req.body;

    const taskId = await aiTaskService.createTask(taskInput);

    res.status(201).json({
      success: true,
      data: { id: taskId },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get task
 */
export async function getTask(req: Request, res: Response, next: NextFunction) {
  try {
    const taskId = req.params.taskId as string;

    const task = await aiTaskService.getTask(taskId);

    if (!task) {
      res.status(404).json({
        success: false,
        error: 'Task not found',
      });
      return;
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get tasks
 */
export async function getTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const accountId = req.params.accountId as string;
    const { status, type, priority, startDate, endDate, limit } = req.query;

    const tasks = await aiTaskService.getTasks(accountId, {
      status: status as any,
      type: type as any,
      priority: priority as any,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get task summary
 */
export async function getTaskSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const accountId = req.params.accountId as string;

    const summary = await aiTaskService.getTaskSummary(accountId);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Execute task
 */
export async function executeTask(req: Request, res: Response, next: NextFunction) {
  try {
    const taskId = req.params.taskId as string;

    const result = await aiTaskService.executeTask(taskId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Approve task
 */
export async function approveTask(req: Request, res: Response, next: NextFunction) {
  try {
    const taskId = req.params.taskId as string;
    const { approvedBy } = req.body;

    await aiTaskService.approveTask(taskId, approvedBy || 'admin');

    res.json({
      success: true,
      message: 'Task approved and executed',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reject task
 */
export async function rejectTask(req: Request, res: Response, next: NextFunction) {
  try {
    const taskId = req.params.taskId as string;
    const { rejectedBy, reason } = req.body;

    await aiTaskService.rejectTask(taskId, rejectedBy || 'admin', reason);

    res.json({
      success: true,
      message: 'Task rejected',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Cancel task
 */
export async function cancelTask(req: Request, res: Response, next: NextFunction) {
  try {
    const taskId = req.params.taskId as string;
    const { cancelledBy } = req.body;

    await aiTaskService.cancelTask(taskId, cancelledBy);

    res.json({
      success: true,
      message: 'Task cancelled',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get pending approvals
 */
export async function getPendingApprovals(req: Request, res: Response, next: NextFunction) {
  try {
    const accountId = req.query.accountId as string;

    const approvals = await aiTaskService.getPendingApprovals(accountId);

    res.json({
      success: true,
      data: approvals,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get task capabilities
 */
export async function getTaskCapabilities(_req: Request, res: Response, next: NextFunction) {
  try {
    const capabilities = aiTaskService.getTaskCapabilities();

    res.json({
      success: true,
      data: capabilities,
    });
  } catch (error) {
    next(error);
  }
}

// ============================================
// Dashboard & Analytics
// ============================================

/**
 * Get AI Center dashboard data
 */
export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const accountId = req.params.accountId as string;

    // Get various stats in parallel
    const [
      taskSummary,
      threatStats,
      patternReport,
      memoryStats,
    ] = await Promise.all([
      aiTaskService.getTaskSummary(accountId),
      aiThreatDetectionService.getThreatStats(accountId),
      aiLearningPatternsService.getPerformanceReport(accountId),
      getMemoryStats(accountId),
    ]);

    res.json({
      success: true,
      data: {
        tasks: taskSummary,
        threats: threatStats,
        patterns: patternReport,
        memory: memoryStats,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Helper: Get memory statistics
 */
async function getMemoryStats(accountId: string) {
  const memories = await prisma.aIMemory.groupBy({
    by: ['memoryType'],
    where: { accountId },
    _count: true,
    _avg: { importance: true },
  });

  const total = await prisma.aIMemory.count({ where: { accountId } });

  return {
    total,
    byType: memories.reduce((acc, m) => {
      acc[m.memoryType] = { count: m._count, avgImportance: m._avg.importance };
      return acc;
    }, {} as Record<string, { count: number; avgImportance: number | null }>),
  };
}

// ============================================
// Audit Logs
// ============================================

/**
 * Get audit logs
 */
export async function getAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const accountId = req.params.accountId as string;
    const { entityType, entityId, action, startDate, endDate, limit } = req.query;

    const where: any = { accountId };
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (action) where.action = action;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const logs = await prisma.aIAuditLog.findMany({
      where,
      orderBy: { performedAt: 'desc' },
      take: limit ? parseInt(limit as string) : 100,
    });

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
}
