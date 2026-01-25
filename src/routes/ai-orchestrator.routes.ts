/**
 * AI Orchestrator API Routes
 * 
 * Endpoints for AI model management and intelligent routing
 * 
 * @version 2.0.0 - Added health, cost, and rate limit endpoints
 */

import { Router, Response } from 'express';
import { logger } from '@/utils/logger';
import { 
  copilotModelService, 
  COPILOT_MODELS, 
} from '@/services/copilot-models.service';
import { 
  aiOrchestrator, 
  TASK_TYPES, 
  DEFAULT_TASK_ASSIGNMENTS,
} from '@/services/ai-orchestrator.service';
import { modelHealthService } from '@/services/model-health.service';
import { costTrackingService } from '@/services/cost-tracking.service';
import { rateLimitService } from '@/services/rate-limit.service';
import { authenticate, AuthRequest } from '@/middleware/auth';
import { requireAdmin, requireAccountOwner } from '@/middleware/rbac';

const router = Router();

// ============================================
// MODEL ENDPOINTS
// ============================================

/**
 * GET /api/ai-orchestrator/models
 * Get all available Copilot models
 */
router.get('/models', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const allModels = copilotModelService.getAllModels();
    const families = ['gpt', 'claude', 'gemini', 'codex', 'raptor'];
    const grouped: Record<string, typeof allModels> = {};
    
    families.forEach(family => {
      grouped[family] = allModels.filter(m => m.family === family);
    });

    res.json({
      success: true,
      data: {
        models: allModels,
        grouped,
        total: allModels.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching models:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch models' });
  }
});

/**
 * GET /api/ai-orchestrator/models/:modelId
 * Get a specific model's details
 */
router.get('/models/:modelId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const modelId = req.params.modelId as string;
    const model = COPILOT_MODELS[modelId as keyof typeof COPILOT_MODELS];

    if (!model) {
      return res.status(404).json({ success: false, error: 'Model not found' });
    }

    const usageStats = copilotModelService.getUsageStats().get(modelId);

    return res.json({
      success: true,
      data: {
        model,
        usage: usageStats || { totalCalls: 0, totalTokens: { input: 0, output: 0 }, averageLatency: 0 },
      },
    });
  } catch (error) {
    logger.error('Error fetching model:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch model' });
  }
});

// ============================================
// ROUTING RULES ENDPOINTS
// ============================================

/**
 * GET /api/ai-orchestrator/routing/rules
 * Get all routing rules
 */
router.get('/routing/rules', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const rules = copilotModelService.getRoutingRules();
    res.json({ success: true, data: { rules, total: rules.length } });
  } catch (error) {
    logger.error('Error fetching routing rules:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch routing rules' });
  }
});

/**
 * POST /api/ai-orchestrator/routing/rules
 * Create a new routing rule
 */
router.post('/routing/rules', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, priority, conditions, targetModel, fallbackModel } = req.body;

    if (!name || !targetModel) {
      return res.status(400).json({ success: false, error: 'Name and target model are required' });
    }

    const rule = copilotModelService.addRoutingRule({
      id: `custom-${Date.now()}`,
      name,
      description: description || '',
      priority: priority || 50,
      conditions: conditions || [],
      targetModel,
      fallbackModel: fallbackModel || targetModel,
      enabled: true,
    });

    logger.info('Created routing rule:', { name, targetModel, userId: req.user?.id });
    return res.json({ success: true, data: rule });
  } catch (error) {
    logger.error('Error creating routing rule:', error);
    return res.status(500).json({ success: false, error: 'Failed to create routing rule' });
  }
});

/**
 * PUT /api/ai-orchestrator/routing/rules/:ruleId
 * Update a routing rule
 */
router.put('/routing/rules/:ruleId', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const ruleId = req.params.ruleId as string;
    const rule = copilotModelService.updateRoutingRule(ruleId, req.body);

    if (!rule) {
      return res.status(404).json({ success: false, error: 'Routing rule not found' });
    }

    logger.info('Updated routing rule:', { ruleId, userId: req.user?.id });
    return res.json({ success: true, data: rule });
  } catch (error) {
    logger.error('Error updating routing rule:', error);
    return res.status(500).json({ success: false, error: 'Failed to update routing rule' });
  }
});

/**
 * DELETE /api/ai-orchestrator/routing/rules/:ruleId
 * Delete a routing rule
 */
router.delete('/routing/rules/:ruleId', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const ruleId = req.params.ruleId as string;
    copilotModelService.deleteRoutingRule(ruleId);
    logger.info('Deleted routing rule:', { ruleId, userId: req.user?.id });
    res.json({ success: true, message: 'Routing rule deleted' });
  } catch (error) {
    logger.error('Error deleting routing rule:', error);
    res.status(500).json({ success: false, error: 'Failed to delete routing rule' });
  }
});

/**
 * POST /api/ai-orchestrator/routing/test
 * Test routing with a given context
 */
router.post('/routing/test', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { content, contentType, command, timeSensitive } = req.body;

    const result = copilotModelService.routeToModel({
      content: content || '',
      contentType: contentType || 'text',
      command,
      contextLength: content?.length || 0,
      timeSensitive: timeSensitive || false,
    });

    res.json({
      success: true,
      data: {
        selectedModel: result.model.id,
        modelDetails: result.model,
        matchedRule: result.rule?.name || 'default',
        routingReason: result.reason,
      },
    });
  } catch (error) {
    logger.error('Error testing routing:', error);
    res.status(500).json({ success: false, error: 'Failed to test routing' });
  }
});

// ============================================
// TASK ASSIGNMENTS ENDPOINTS
// ============================================

/**
 * GET /api/ai-orchestrator/assignments
 * Get all task assignments
 */
router.get('/assignments', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const assignments = aiOrchestrator.getAllAssignments();
    
    // Flatten the assignments from all levels
    const flatAssignments = [
      ...assignments.global.map(a => ({ ...a, isDefault: false })),
      ...assignments.company.map(a => ({ ...a, isDefault: false })),
      ...assignments.team.map(a => ({ ...a, isDefault: false })),
      ...assignments.user.map(a => ({ ...a, isDefault: false })),
    ];
    
    // Add defaults
    Object.entries(DEFAULT_TASK_ASSIGNMENTS).forEach(([taskType, assignment]) => {
      if (!flatAssignments.find(a => a.taskType === taskType)) {
        flatAssignments.push({ ...assignment, isDefault: true });
      }
    });

    res.json({
      success: true,
      data: {
        assignments: flatAssignments,
        taskTypes: Object.values(TASK_TYPES),
        total: flatAssignments.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching assignments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch assignments' });
  }
});

/**
 * POST /api/ai-orchestrator/assignments
 * Create a new task assignment
 */
router.post('/assignments', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      taskType, 
      primaryModel, 
      fallbackModel, 
      allowedModels,
      assignmentLevel,
      priority,
      conditions,
      expiresInDays 
    } = req.body;

    if (!taskType || !primaryModel) {
      return res.status(400).json({ success: false, error: 'Task type and primary model are required' });
    }

    const userRole = req.user?.role === 'SUPER_ADMIN' ? 'super_admin' : 
                     req.user?.role === 'ACCOUNT_OWNER' ? 'admin' : 'manager';

    const result = await aiOrchestrator.setTaskAssignment(
      taskType, 
      {
        taskType,
        primaryModel,
        fallbackModel: fallbackModel || primaryModel,
        allowedModels: allowedModels || [primaryModel],
        assignedBy: userRole,
        assignmentLevel: assignmentLevel || 'company',
        priority: priority || 50,
        conditions,
        expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : undefined,
      },
      {
        userId: req.user?.id || 'system',
        userRole: userRole as any,
        accountId: req.body.accountId,
      }
    );

    if (!result.success) {
      return res.status(403).json({ success: false, error: result.error });
    }

    logger.info('Created task assignment:', { taskType, primaryModel, userId: req.user?.id });
    return res.json({ success: true, data: result.assignment });
  } catch (error) {
    logger.error('Error creating assignment:', error);
    return res.status(500).json({ success: false, error: 'Failed to create assignment' });
  }
});

// ============================================
// SESSION NOTES ENDPOINTS
// ============================================

/**
 * POST /api/ai-orchestrator/sessions/:sessionId/note
 * Add a note to a session
 */
router.post('/sessions/:sessionId/note', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const { noteType, content, metadata, agentId, modelId } = req.body;

    const note = aiOrchestrator.addSessionNote({
      sessionId,
      accountId: req.body.accountId || 'default',
      userId: req.user?.id || 'system',
      agentId: agentId || 'system',
      modelId: modelId || 'default',
      noteType: noteType || 'context',
      content,
      metadata: metadata || {},
    });

    res.json({ success: true, data: note });
  } catch (error) {
    logger.error('Error adding session note:', error);
    res.status(500).json({ success: false, error: 'Failed to add session note' });
  }
});

/**
 * GET /api/ai-orchestrator/sessions/:sessionId/notes
 * Get session notes
 */
router.get('/sessions/:sessionId/notes', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const noteType = req.query.type as string | undefined;

    const notes = aiOrchestrator.getSessionNotes(sessionId, {
      noteType: noteType as any,
      limit: 50,
    });

    res.json({ success: true, data: { notes, total: notes.length, sessionId } });
  } catch (error) {
    logger.error('Error fetching session notes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch session notes' });
  }
});

/**
 * GET /api/ai-orchestrator/sessions/:sessionId/context
 * Get context summary for handoff
 */
router.get('/sessions/:sessionId/context', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const contextSummary = aiOrchestrator.buildContextSummary(sessionId);
    res.json({ success: true, data: contextSummary });
  } catch (error) {
    logger.error('Error building context summary:', error);
    res.status(500).json({ success: false, error: 'Failed to build context summary' });
  }
});

// ============================================
// HANDOFF ENDPOINTS
// ============================================

/**
 * POST /api/ai-orchestrator/handoff
 * Execute a seamless agent handoff
 */
router.post('/handoff', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId, fromAgent, fromModel, toAgent, toModel, reason, preserveContext } = req.body;

    if (!sessionId || !fromModel || !toModel) {
      return res.status(400).json({ 
        success: false, 
        error: 'Session ID, from model, and to model are required' 
      });
    }

    const result = await aiOrchestrator.executeHandoff({
      sessionId,
      fromAgent: fromAgent || 'system',
      fromModel,
      toAgent: toAgent || 'system',
      toModel,
      reason: reason || 'User requested',
      preserveContext: preserveContext !== false,
    });

    logger.info('Executed handoff:', { sessionId, fromModel, toModel, userId: req.user?.id });
    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error executing handoff:', error);
    return res.status(500).json({ success: false, error: 'Failed to execute handoff' });
  }
});

// ============================================
// COMPANY PREFERENCES ENDPOINTS
// ============================================

const companyPreferences = new Map<string, any>();

/**
 * GET /api/ai-orchestrator/company/preferences
 * Get company AI preferences
 */
router.get('/company/preferences', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const accountId = (req.body.accountId || req.query.accountId || 'default') as string;
    
    const prefs = companyPreferences.get(accountId) || {
      defaultModel: null,
      allowedModels: [],
      blockedModels: [],
      maxTokensPerRequest: 0,
      maxRequestsPerDay: 0,
      enableVision: true,
      enableCodeGen: true,
      enableAutomation: true,
      customInstructions: '',
    };

    return res.json({ success: true, data: prefs });
  } catch (error) {
    logger.error('Error fetching company preferences:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch company preferences' });
  }
});

/**
 * PUT /api/ai-orchestrator/company/preferences
 * Update company AI preferences
 */
router.put('/company/preferences', authenticate, requireAccountOwner, async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.body.accountId || 'default';
    const updates = { ...req.body };
    delete updates.accountId;

    const existing = companyPreferences.get(accountId) || {};
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    companyPreferences.set(accountId, updated);

    logger.info('Updated company preferences:', { accountId, userId: req.user?.id });
    return res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error updating company preferences:', error);
    return res.status(500).json({ success: false, error: 'Failed to update company preferences' });
  }
});

// ============================================
// ANALYTICS ENDPOINTS
// ============================================

/**
 * GET /api/ai-orchestrator/analytics
 * Get AI usage analytics
 */
router.get('/analytics', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const usageStats = copilotModelService.getUsageStats();
    const modelStats: any[] = [];

    usageStats.forEach((stats, modelId) => {
      modelStats.push({ modelId, ...stats });
    });

    res.json({
      success: true,
      data: {
        models: modelStats,
        totalRequests: modelStats.reduce((sum, m) => sum + m.totalCalls, 0),
        totalTokens: modelStats.reduce((sum, m) => ({
          input: sum.input + m.totalTokens.input,
          output: sum.output + m.totalTokens.output,
        }), { input: 0, output: 0 }),
      },
    });
  } catch (error) {
    logger.error('Error fetching analytics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

// ============================================
// DASHBOARD ENDPOINT
// ============================================

/**
 * GET /api/ai-orchestrator/dashboard
 * Get complete dashboard data
 */
router.get('/dashboard', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const allModels = copilotModelService.getAllModels();
    const rules = copilotModelService.getRoutingRules();
    const assignments = aiOrchestrator.getAllAssignments();

    // Calculate stats
    const modelsByTier: Record<string, number> = {};
    const modelsByFamilyCount: Record<string, number> = {};

    allModels.forEach(model => {
      modelsByTier[model.tier] = (modelsByTier[model.tier] || 0) + 1;
      modelsByFamilyCount[model.family] = (modelsByFamilyCount[model.family] || 0) + 1;
    });

    const allAssignments = [
      ...assignments.global,
      ...assignments.company,
      ...assignments.team,
      ...assignments.user,
    ];

    res.json({
      success: true,
      data: {
        models: {
          total: allModels.length,
          byFamily: modelsByFamilyCount,
          byTier: modelsByTier,
        },
        routing: {
          totalRules: rules.length,
          enabledRules: rules.filter(r => r.enabled).length,
        },
        assignments: {
          total: allAssignments.length + Object.keys(DEFAULT_TASK_ASSIGNMENTS).length,
          taskTypes: Object.values(TASK_TYPES),
        },
        sessions: {
          totalSessions: 0,
          totalNotes: 0,
          totalHandoffs: 0,
          activeAssignments: allAssignments.length,
        },
        userRole: req.user?.role || 'user',
      },
    });
  } catch (error) {
    logger.error('Error fetching dashboard data:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard data' });
  }
});

// ============================================
// INVOKE ENDPOINT
// ============================================

/**
 * POST /api/ai-orchestrator/invoke
 * Invoke AI with intelligent routing
 */
router.post('/invoke', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { messages, model: preferredModel, taskType, context, options } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ success: false, error: 'Messages array is required' });
    }

    let modelId = preferredModel;
    let routingReason = 'User specified';

    if (!modelId) {
      if (taskType) {
        const assignment = aiOrchestrator.getAssignmentForTask(taskType, {
          userId: req.user?.id,
          accountId: req.body.accountId,
        });
        if (assignment) {
          modelId = assignment.primaryModel;
          routingReason = `Task assignment: ${taskType}`;
        }
      }

      if (!modelId) {
        const routingResult = copilotModelService.routeToModel({
          content: messages[messages.length - 1]?.content || '',
          contentType: context?.contentType || 'text',
          command: context?.command,
          contextLength: JSON.stringify(messages).length,
          timeSensitive: context?.timeSensitive || false,
        });
        modelId = routingResult.model.id;
        routingReason = routingResult.reason;
      }
    }

    const result = await copilotModelService.invoke(modelId, messages, options);

    return res.json({
      success: true,
      data: {
        response: result.response,
        model: modelId,
        routingReason,
        tokensUsed: result.tokensUsed,
      },
    });
  } catch (error) {
    logger.error('Error invoking AI:', error);
    return res.status(500).json({ success: false, error: 'Failed to invoke AI' });
  }
});

// ============================================
// HEALTH MONITORING ENDPOINTS
// ============================================

/**
 * GET /api/ai-orchestrator/health
 * Get health status of all providers
 */
router.get('/health', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const providerHealth = modelHealthService.getAllProviderHealth();
    
    const healthSummary = {
      providers: providerHealth,
      overall: providerHealth.every(p => p.status === 'healthy') 
        ? 'healthy' 
        : providerHealth.some(p => p.status === 'unhealthy') 
          ? 'degraded' 
          : 'healthy',
      lastCheck: new Date().toISOString(),
    };

    res.json({ success: true, data: healthSummary });
  } catch (error) {
    logger.error('Error fetching health status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch health status' });
  }
});

/**
 * GET /api/ai-orchestrator/health/:provider
 * Get health status for a specific provider
 */
router.get('/health/:provider', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const provider = req.params.provider as 'openai' | 'anthropic' | 'google';
    const health = modelHealthService.getAllProviderHealth().find(p => p.provider === provider);
    
    if (!health) {
      return res.status(404).json({ success: false, error: 'Provider not found' });
    }

    return res.json({ success: true, data: health });
  } catch (error) {
    logger.error('Error fetching provider health:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch provider health' });
  }
});

/**
 * POST /api/ai-orchestrator/health/check
 * Trigger a manual health check
 */
router.post('/health/check', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    await modelHealthService.checkAllProviders();
    const health = modelHealthService.getAllProviderHealth();
    res.json({ success: true, data: { providers: health, checkedAt: new Date().toISOString() } });
  } catch (error) {
    logger.error('Error running health check:', error);
    res.status(500).json({ success: false, error: 'Failed to run health check' });
  }
});

// ============================================
// COST TRACKING ENDPOINTS
// ============================================

/**
 * GET /api/ai-orchestrator/costs
 * Get cost summary
 */
router.get('/costs', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const accountId = (req.query.accountId || req.body.accountId) as string | undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const summary = await costTrackingService.getCostSummary({
      accountId,
      startDate,
      endDate,
      groupByDay: req.query.groupByDay === 'true',
    });

    res.json({ success: true, data: summary });
  } catch (error) {
    logger.error('Error fetching costs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch costs' });
  }
});

/**
 * GET /api/ai-orchestrator/costs/daily
 * Get daily cost
 */
router.get('/costs/daily', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const accountId = (req.query.accountId || req.body.accountId) as string | undefined;
    const dailyCost = await costTrackingService.getDailyCost(accountId);
    res.json({ success: true, data: { dailyCost, date: new Date().toISOString().split('T')[0] } });
  } catch (error) {
    logger.error('Error fetching daily cost:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch daily cost' });
  }
});

/**
 * GET /api/ai-orchestrator/costs/monthly
 * Get monthly cost
 */
router.get('/costs/monthly', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const accountId = (req.query.accountId || req.body.accountId) as string | undefined;
    const monthlyCost = await costTrackingService.getMonthlyCost(accountId);
    res.json({ success: true, data: { monthlyCost, month: new Date().toISOString().slice(0, 7) } });
  } catch (error) {
    logger.error('Error fetching monthly cost:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch monthly cost' });
  }
});

/**
 * GET /api/ai-orchestrator/costs/realtime
 * Get real-time cost totals
 */
router.get('/costs/realtime', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const totals = costTrackingService.getRealtimeTotals();
    res.json({ success: true, data: totals });
  } catch (error) {
    logger.error('Error fetching realtime costs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch realtime costs' });
  }
});

/**
 * GET /api/ai-orchestrator/costs/pricing/:modelId
 * Get pricing for a model
 */
router.get('/costs/pricing/:modelId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const modelId = req.params.modelId as string;
    const pricing = costTrackingService.getModelPricing(modelId);
    if (!pricing) {
      return res.status(404).json({ success: false, error: 'Model not found' });
    }
    return res.json({ success: true, data: pricing });
  } catch (error) {
    logger.error('Error fetching pricing:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch pricing' });
  }
});

// ============================================
// RATE LIMITING ENDPOINTS
// ============================================

/**
 * GET /api/ai-orchestrator/rate-limits
 * Get all rate limit configurations
 */
router.get('/rate-limits', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const limits = rateLimitService.getAllLimits();
    res.json({ success: true, data: { limits, total: limits.length } });
  } catch (error) {
    logger.error('Error fetching rate limits:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch rate limits' });
  }
});

/**
 * GET /api/ai-orchestrator/rate-limits/:modelId
 * Get rate limit for a specific model
 */
router.get('/rate-limits/:modelId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const modelId = req.params.modelId as string;
    const limits = rateLimitService.getModelLimits(modelId);
    if (!limits) {
      return res.status(404).json({ success: false, error: 'Model rate limits not found' });
    }
    return res.json({ success: true, data: limits });
  } catch (error) {
    logger.error('Error fetching model rate limits:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch model rate limits' });
  }
});

/**
 * PUT /api/ai-orchestrator/rate-limits/:modelId
 * Update rate limits for a model
 */
router.put('/rate-limits/:modelId', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const modelId = req.params.modelId as string;
    await rateLimitService.updateModelLimits(modelId, req.body);
    const updated = rateLimitService.getModelLimits(modelId);
    logger.info('Updated rate limits:', { modelId, userId: req.user?.id });
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error updating rate limits:', error);
    res.status(500).json({ success: false, error: 'Failed to update rate limits' });
  }
});

/**
 * GET /api/ai-orchestrator/rate-limits/stats
 * Get rate limit usage stats
 */
router.get('/rate-limits/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const accountId = (req.query.accountId) as string | undefined;
    
    if (accountId) {
      // Get stats for specific account
      const allLimits = rateLimitService.getAllLimits();
      const stats = allLimits.map(l => rateLimitService.getStats(l.modelId, accountId));
      return res.json({ success: true, data: { stats, accountId } });
    }
    
    const stats = rateLimitService.getAllStats();
    return res.json({ success: true, data: { stats } });
  } catch (error) {
    logger.error('Error fetching rate limit stats:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch rate limit stats' });
  }
});

/**
 * POST /api/ai-orchestrator/rate-limits/:modelId/reset
 * Reset rate limits for a model
 */
router.post('/rate-limits/:modelId/reset', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const modelId = req.params.modelId as string;
    const { accountId, userId } = req.body;
    rateLimitService.resetLimits(modelId, accountId, userId);
    logger.info('Reset rate limits:', { modelId, accountId, userId });
    res.json({ success: true, message: 'Rate limits reset' });
  } catch (error) {
    logger.error('Error resetting rate limits:', error);
    res.status(500).json({ success: false, error: 'Failed to reset rate limits' });
  }
});

/**
 * POST /api/ai-orchestrator/rate-limits/check
 * Check if a request would be allowed
 */
router.post('/rate-limits/check', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { modelId, estimatedTokens, accountId, userId } = req.body;
    
    if (!modelId) {
      return res.status(400).json({ success: false, error: 'Model ID is required' });
    }

    const result = rateLimitService.checkRateLimit(modelId, {
      accountId,
      userId,
      estimatedTokens,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error checking rate limit:', error);
    return res.status(500).json({ success: false, error: 'Failed to check rate limit' });
  }
});

export default router;
