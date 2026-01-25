/**
 * AI Model Registry Routes
 * 
 * API endpoints for AI model selection, agent management,
 * and comprehensive AI system status
 * 
 * @version 1.0.0
 */

import { Router, Request, Response } from 'express';
import { aiModelRegistry, AI_MODELS, AI_AGENTS } from '@/services/ai-model-registry.service';
import { novaToolingService } from '@/services/nova-tooling.service';
import { logger } from '@/utils/logger';

const router = Router();

// ============================================
// AGENT STATUS ENDPOINTS
// ============================================

/**
 * GET /ai-models/agents
 * Get all AI agents with their current status and model assignments
 */
router.get('/agents', async (req: Request, res: Response) => {
  try {
    const report = aiModelRegistry.getAgentStatusReport();
    
    res.json({
      success: true,
      data: {
        agents: report.agents.map(agent => ({
          id: agent.id,
          name: agent.name,
          codename: agent.codename,
          description: agent.description,
          activeModel: agent.activeModel,
          modelDisplayName: AI_MODELS[agent.activeModel]?.displayName || 'Unknown',
          provider: agent.provider,
          color: agent.color,
          icon: agent.icon,
          role: agent.role,
          status: agent.status,
          lastActivity: agent.lastActivity,
          totalRequests: agent.totalRequests,
          avgResponseTime: Math.round(agent.avgResponseTime),
        })),
        activeAgent: report.activeAgent ? {
          id: report.activeAgent.id,
          name: report.activeAgent.name,
          codename: report.activeAgent.codename,
          model: report.activeAgent.activeModel,
          modelDisplayName: AI_MODELS[report.activeAgent.activeModel]?.displayName,
        } : null,
        systemHealth: report.systemHealth,
      },
    });
  } catch (error: any) {
    logger.error('[AI Models] Failed to get agents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /ai-models/agents/active
 * Get the currently serving agent with full details
 */
router.get('/agents/active', async (req: Request, res: Response) => {
  try {
    const activeAgent = novaToolingService.getActiveAgent();
    
    if (!activeAgent) {
      return res.json({
        success: true,
        data: null,
        message: 'No active agent serving',
      });
    }

    res.json({
      success: true,
      data: {
        ...activeAgent,
        greeting: `🌟 ${activeAgent.name} (${activeAgent.codename}) is online and serving via ${activeAgent.modelDisplayName}`,
      },
    });
  } catch (error: any) {
    logger.error('[AI Models] Failed to get active agent:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /ai-models/agents/:agentId
 * Get specific agent details
 */
router.get('/agents/:agentId', async (req: Request, res: Response) => {
  try {
    const agent = aiModelRegistry.getAgent(req.params.agentId);
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
    }

    const model = AI_MODELS[agent.activeModel];

    res.json({
      success: true,
      data: {
        ...agent,
        modelDetails: model ? {
          id: model.id,
          displayName: model.displayName,
          provider: model.provider,
          tier: model.tier,
          contextWindow: model.contextWindow,
          capabilities: model.capabilities,
        } : null,
      },
    });
  } catch (error: any) {
    logger.error('[AI Models] Failed to get agent:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /ai-models/agents/:agentId/model
 * Change the model for an agent
 */
router.put('/agents/:agentId/model', async (req: Request, res: Response) => {
  try {
    const { modelId } = req.body;
    const { agentId } = req.params;

    if (!modelId) {
      return res.status(400).json({
        success: false,
        error: 'modelId is required',
      });
    }

    const result = await aiModelRegistry.setActiveModelForAgent(agentId, modelId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    logger.info(`[AI Models] Model changed for ${agentId}: ${result.previousModel} -> ${result.newModel}`);

    res.json({
      success: true,
      data: {
        agentId,
        previousModel: result.previousModel,
        previousModelName: AI_MODELS[result.previousModel]?.displayName,
        newModel: result.newModel,
        newModelName: AI_MODELS[result.newModel]?.displayName,
      },
    });
  } catch (error: any) {
    logger.error('[AI Models] Failed to change model:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /ai-models/agents/:agentId/status
 * Update agent status
 */
router.put('/agents/:agentId/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const { agentId } = req.params;

    if (!['active', 'standby', 'offline', 'error'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be: active, standby, offline, or error',
      });
    }

    aiModelRegistry.updateAgentStatus(agentId, status);

    res.json({
      success: true,
      data: { agentId, status },
    });
  } catch (error: any) {
    logger.error('[AI Models] Failed to update status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// MODEL ENDPOINTS
// ============================================

/**
 * GET /ai-models/models
 * Get all available AI models
 */
router.get('/models', async (req: Request, res: Response) => {
  try {
    const { provider, tier, capability } = req.query;

    let models = aiModelRegistry.getAllModels();

    if (provider) {
      models = models.filter(m => m.provider === provider);
    }

    if (tier) {
      models = models.filter(m => m.tier === tier);
    }

    if (capability) {
      models = models.filter(m => m.capabilities.includes(capability as any));
    }

    res.json({
      success: true,
      data: models.map(model => ({
        id: model.id,
        provider: model.provider,
        displayName: model.displayName,
        tier: model.tier,
        contextWindow: model.contextWindow,
        maxOutputTokens: model.maxOutputTokens,
        inputPricePerMillion: model.inputPricePerMillion,
        outputPricePerMillion: model.outputPricePerMillion,
        capabilities: model.capabilities,
        releaseDate: model.releaseDate,
      })),
      meta: {
        total: models.length,
        filters: { provider, tier, capability },
      },
    });
  } catch (error: any) {
    logger.error('[AI Models] Failed to get models:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /ai-models/models/:modelId
 * Get specific model details
 */
router.get('/models/:modelId', async (req: Request, res: Response) => {
  try {
    const model = aiModelRegistry.getModel(req.params.modelId);

    if (!model) {
      return res.status(404).json({
        success: false,
        error: 'Model not found',
      });
    }

    res.json({
      success: true,
      data: model,
    });
  } catch (error: any) {
    logger.error('[AI Models] Failed to get model:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /ai-models/models/:modelId/health
 * Check health of a specific model
 */
router.get('/models/:modelId/health', async (req: Request, res: Response) => {
  try {
    const health = await aiModelRegistry.checkModelHealth(req.params.modelId);

    res.json({
      success: true,
      data: health,
    });
  } catch (error: any) {
    logger.error('[AI Models] Health check failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PROVIDER ENDPOINTS
// ============================================

/**
 * GET /ai-models/providers
 * Get all configured AI providers and their status
 */
router.get('/providers', async (req: Request, res: Response) => {
  try {
    const providers = await aiModelRegistry.checkAllProvidersHealth();

    // Group models by provider
    const modelsByProvider = new Map<string, number>();
    for (const model of Object.values(AI_MODELS)) {
      modelsByProvider.set(
        model.provider,
        (modelsByProvider.get(model.provider) || 0) + 1
      );
    }

    res.json({
      success: true,
      data: providers.map(p => ({
        ...p,
        modelCount: modelsByProvider.get(p.provider) || 0,
      })),
    });
  } catch (error: any) {
    logger.error('[AI Models] Failed to get providers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SYSTEM STATE ENDPOINTS
// ============================================

/**
 * GET /ai-models/state
 * Get complete AI system state
 */
router.get('/state', async (req: Request, res: Response) => {
  try {
    const activeModels = aiModelRegistry.getActiveModelsState();
    const agentReport = aiModelRegistry.getAgentStatusReport();
    const providers = await aiModelRegistry.checkAllProvidersHealth();

    res.json({
      success: true,
      data: {
        activeModels,
        agents: agentReport.agents.map(a => ({
          id: a.id,
          name: a.name,
          status: a.status,
          model: a.activeModel,
        })),
        activeAgent: agentReport.activeAgent?.name || null,
        systemHealth: agentReport.systemHealth,
        configuredProviders: providers.filter(p => p.configured).map(p => p.provider),
        timestamp: new Date(),
      },
    });
  } catch (error: any) {
    logger.error('[AI Models] Failed to get state:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /ai-models/chat
 * Send a message through a specific agent
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { agentId, messages, options } = req.body;

    if (!agentId || !messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'agentId and messages array are required',
      });
    }

    const result = await aiModelRegistry.sendMessage(agentId, messages, options);

    res.json({
      success: result.success,
      data: {
        response: result.response,
        model: result.model,
        agent: result.agent,
        latency: result.latency,
      },
      error: result.error,
    });
  } catch (error: any) {
    logger.error('[AI Models] Chat failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
