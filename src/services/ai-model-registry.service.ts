/**
 * AI Model Registry Service
 * 
 * Centralized management of all AI providers and models
 * Provides model selection, health monitoring, and agent identification
 * 
 * @version 2.0.0
 * @author FMD Engineering Team
 */

import { logger } from '@/utils/logger';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type AIProviderType = 'anthropic' | 'openai' | 'deepseek' | 'google' | 'meta' | 'github' | 'mistral' | 'perplexity' | 'cohere' | 'custom';

export interface AIModel {
  id: string;
  provider: AIProviderType;
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  capabilities: AIModelCapability[];
  tier: 'flagship' | 'standard' | 'economy' | 'legacy';
  releaseDate?: string;
  deprecated?: boolean;
}

export type AIModelCapability = 
  | 'chat'
  | 'code'
  | 'analysis'
  | 'vision'
  | 'tools'
  | 'extended-thinking'
  | 'computer-use'
  | 'file-processing'
  | 'realtime';

export interface AIAgent {
  id: string;
  name: string;
  codename: string;
  description: string;
  activeModel: string;
  provider: AIProviderType;
  systemPrompt: string;
  color: string;
  icon: string;
  role: 'primary' | 'secondary' | 'specialist';
  status: 'active' | 'standby' | 'offline' | 'error';
  lastActivity?: Date;
  totalRequests: number;
  avgResponseTime: number;
}

export interface ModelHealthStatus {
  modelId: string;
  provider: AIProviderType;
  status: 'healthy' | 'degraded' | 'unavailable';
  latency: number;
  lastChecked: Date;
  errorMessage?: string;
  rateLimitRemaining?: number;
}

export interface ActiveModelState {
  nova: string;
  soldier: string;
  iai: string;
  globalDefault: string;
  lastUpdated: Date;
}

// ============================================
// MODEL REGISTRY
// ============================================

export const AI_MODELS: Record<string, AIModel> = {
  // ANTHROPIC MODELS
  'claude-opus-4': {
    id: 'claude-opus-4',
    provider: 'anthropic',
    displayName: 'Claude Opus 4',
    contextWindow: 200000,
    maxOutputTokens: 32000,
    inputPricePerMillion: 15,
    outputPricePerMillion: 75,
    capabilities: ['chat', 'code', 'analysis', 'vision', 'tools', 'extended-thinking', 'computer-use'],
    tier: 'flagship',
    releaseDate: '2025-05',
  },
  'claude-sonnet-4': {
    id: 'claude-sonnet-4',
    provider: 'anthropic',
    displayName: 'Claude Sonnet 4',
    contextWindow: 200000,
    maxOutputTokens: 16000,
    inputPricePerMillion: 3,
    outputPricePerMillion: 15,
    capabilities: ['chat', 'code', 'analysis', 'vision', 'tools', 'computer-use'],
    tier: 'standard',
    releaseDate: '2025-05',
  },
  'claude-3-5-sonnet': {
    id: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    displayName: 'Claude 3.5 Sonnet',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    inputPricePerMillion: 3,
    outputPricePerMillion: 15,
    capabilities: ['chat', 'code', 'analysis', 'vision', 'tools', 'computer-use'],
    tier: 'standard',
    releaseDate: '2024-10',
  },
  'claude-3-opus': {
    id: 'claude-3-opus-20240229',
    provider: 'anthropic',
    displayName: 'Claude 3 Opus',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    inputPricePerMillion: 15,
    outputPricePerMillion: 75,
    capabilities: ['chat', 'code', 'analysis', 'vision', 'tools'],
    tier: 'legacy',
    releaseDate: '2024-02',
  },
  'claude-3-haiku': {
    id: 'claude-3-haiku-20240307',
    provider: 'anthropic',
    displayName: 'Claude 3 Haiku',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    inputPricePerMillion: 0.25,
    outputPricePerMillion: 1.25,
    capabilities: ['chat', 'code', 'analysis', 'vision'],
    tier: 'economy',
    releaseDate: '2024-03',
  },

  // OPENAI MODELS
  'gpt-4o': {
    id: 'gpt-4o',
    provider: 'openai',
    displayName: 'GPT-4o',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    inputPricePerMillion: 2.5,
    outputPricePerMillion: 10,
    capabilities: ['chat', 'code', 'analysis', 'vision', 'tools'],
    tier: 'flagship',
    releaseDate: '2024-05',
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    provider: 'openai',
    displayName: 'GPT-4o Mini',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.6,
    capabilities: ['chat', 'code', 'analysis', 'vision', 'tools'],
    tier: 'economy',
    releaseDate: '2024-07',
  },
  'gpt-4-turbo': {
    id: 'gpt-4-turbo-preview',
    provider: 'openai',
    displayName: 'GPT-4 Turbo',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    inputPricePerMillion: 10,
    outputPricePerMillion: 30,
    capabilities: ['chat', 'code', 'analysis', 'vision', 'tools'],
    tier: 'standard',
    releaseDate: '2024-01',
  },
  'o1': {
    id: 'o1',
    provider: 'openai',
    displayName: 'o1 (Reasoning)',
    contextWindow: 200000,
    maxOutputTokens: 100000,
    inputPricePerMillion: 15,
    outputPricePerMillion: 60,
    capabilities: ['chat', 'code', 'analysis', 'extended-thinking'],
    tier: 'flagship',
    releaseDate: '2024-12',
  },
  'o1-mini': {
    id: 'o1-mini',
    provider: 'openai',
    displayName: 'o1 Mini',
    contextWindow: 128000,
    maxOutputTokens: 65536,
    inputPricePerMillion: 3,
    outputPricePerMillion: 12,
    capabilities: ['chat', 'code', 'analysis', 'extended-thinking'],
    tier: 'standard',
    releaseDate: '2024-09',
  },

  // DEEPSEEK MODELS
  'deepseek-chat': {
    id: 'deepseek-chat',
    provider: 'deepseek',
    displayName: 'DeepSeek Chat',
    contextWindow: 64000,
    maxOutputTokens: 8192,
    inputPricePerMillion: 0.14,
    outputPricePerMillion: 0.28,
    capabilities: ['chat', 'code', 'analysis'],
    tier: 'economy',
    releaseDate: '2024-11',
  },
  'deepseek-reasoner': {
    id: 'deepseek-reasoner',
    provider: 'deepseek',
    displayName: 'DeepSeek R1',
    contextWindow: 64000,
    maxOutputTokens: 8192,
    inputPricePerMillion: 0.55,
    outputPricePerMillion: 2.19,
    capabilities: ['chat', 'code', 'analysis', 'extended-thinking'],
    tier: 'standard',
    releaseDate: '2025-01',
  },

  // GOOGLE MODELS
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    provider: 'google',
    displayName: 'Gemini 2.0 Flash',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.3,
    capabilities: ['chat', 'code', 'analysis', 'vision', 'tools', 'realtime'],
    tier: 'economy',
    releaseDate: '2024-12',
  },
  'gemini-1.5-pro': {
    id: 'gemini-1.5-pro',
    provider: 'google',
    displayName: 'Gemini 1.5 Pro',
    contextWindow: 2000000,
    maxOutputTokens: 8192,
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 5,
    capabilities: ['chat', 'code', 'analysis', 'vision', 'tools', 'file-processing'],
    tier: 'standard',
    releaseDate: '2024-05',
  },

  // GITHUB COPILOT MODELS
  'copilot-gpt-4': {
    id: 'copilot-gpt-4',
    provider: 'github',
    displayName: 'Copilot GPT-4',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    inputPricePerMillion: 0,
    outputPricePerMillion: 0,
    capabilities: ['chat', 'code', 'analysis', 'tools'],
    tier: 'flagship',
    releaseDate: '2024-01',
  },
  'copilot-claude': {
    id: 'copilot-claude',
    provider: 'github',
    displayName: 'Copilot Claude',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    inputPricePerMillion: 0,
    outputPricePerMillion: 0,
    capabilities: ['chat', 'code', 'analysis', 'extended-thinking'],
    tier: 'flagship',
    releaseDate: '2024-12',
  },
  'copilot-o1': {
    id: 'copilot-o1',
    provider: 'github',
    displayName: 'Copilot o1',
    contextWindow: 128000,
    maxOutputTokens: 32000,
    inputPricePerMillion: 0,
    outputPricePerMillion: 0,
    capabilities: ['chat', 'code', 'analysis', 'extended-thinking'],
    tier: 'flagship',
    releaseDate: '2025-01',
  },

  // MISTRAL MODELS
  'mistral-large': {
    id: 'mistral-large-latest',
    provider: 'mistral',
    displayName: 'Mistral Large',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    inputPricePerMillion: 2,
    outputPricePerMillion: 6,
    capabilities: ['chat', 'code', 'analysis', 'tools'],
    tier: 'flagship',
    releaseDate: '2024-02',
  },
  'mistral-small': {
    id: 'mistral-small-latest',
    provider: 'mistral',
    displayName: 'Mistral Small',
    contextWindow: 32000,
    maxOutputTokens: 8192,
    inputPricePerMillion: 0.2,
    outputPricePerMillion: 0.6,
    capabilities: ['chat', 'code', 'analysis'],
    tier: 'economy',
    releaseDate: '2024-09',
  },
  'codestral': {
    id: 'codestral-latest',
    provider: 'mistral',
    displayName: 'Codestral',
    contextWindow: 32000,
    maxOutputTokens: 8192,
    inputPricePerMillion: 0.2,
    outputPricePerMillion: 0.6,
    capabilities: ['code', 'analysis'],
    tier: 'standard',
    releaseDate: '2024-05',
  },

  // PERPLEXITY MODELS
  'sonar-pro': {
    id: 'sonar-pro',
    provider: 'perplexity',
    displayName: 'Sonar Pro',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    inputPricePerMillion: 3,
    outputPricePerMillion: 15,
    capabilities: ['chat', 'analysis', 'tools'],
    tier: 'flagship',
    releaseDate: '2024-11',
  },
  'sonar': {
    id: 'sonar',
    provider: 'perplexity',
    displayName: 'Sonar',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    inputPricePerMillion: 1,
    outputPricePerMillion: 5,
    capabilities: ['chat', 'analysis'],
    tier: 'standard',
    releaseDate: '2024-11',
  },
  'sonar-reasoning': {
    id: 'sonar-reasoning',
    provider: 'perplexity',
    displayName: 'Sonar Reasoning',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    inputPricePerMillion: 5,
    outputPricePerMillion: 25,
    capabilities: ['chat', 'analysis', 'extended-thinking'],
    tier: 'flagship',
    releaseDate: '2025-01',
  },

  // META LLAMA MODELS (via Together/Groq)
  'llama-3.3-70b': {
    id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    provider: 'meta',
    displayName: 'Llama 3.3 70B',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    inputPricePerMillion: 0.88,
    outputPricePerMillion: 0.88,
    capabilities: ['chat', 'code', 'analysis'],
    tier: 'flagship',
    releaseDate: '2024-12',
  },
  'llama-3.1-8b': {
    id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    provider: 'meta',
    displayName: 'Llama 3.1 8B',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    inputPricePerMillion: 0.18,
    outputPricePerMillion: 0.18,
    capabilities: ['chat', 'code', 'analysis'],
    tier: 'economy',
    releaseDate: '2024-07',
  },

  // COHERE MODELS
  'command-r-plus': {
    id: 'command-r-plus',
    provider: 'cohere',
    displayName: 'Command R+',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    inputPricePerMillion: 2.5,
    outputPricePerMillion: 10,
    capabilities: ['chat', 'code', 'analysis', 'tools'],
    tier: 'flagship',
    releaseDate: '2024-04',
  },
  'command-r': {
    id: 'command-r',
    provider: 'cohere',
    displayName: 'Command R',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    inputPricePerMillion: 0.5,
    outputPricePerMillion: 1.5,
    capabilities: ['chat', 'code', 'analysis'],
    tier: 'standard',
    releaseDate: '2024-03',
  },
};

// ============================================
// AGENT DEFINITIONS
// ============================================

export const AI_AGENTS: Record<string, AIAgent> = {
  nova: {
    id: 'nova',
    name: 'Nova',
    codename: 'NOVA-PRIME',
    description: 'Primary AI assistant for FaceMyDealer platform. Expert in automotive sales, Facebook Marketplace, and system management.',
    activeModel: 'claude-sonnet-4',
    provider: 'anthropic',
    systemPrompt: `You are Nova, the primary AI assistant for FaceMyDealer - a professional automotive dealership management platform.

IDENTITY:
- Name: Nova
- Role: Primary AI Assistant & System Administrator
- Expertise: Automotive sales, Facebook Marketplace automation, CRM, inventory management

CAPABILITIES:
- Real-time system health monitoring
- Database operations and analysis
- Codebase navigation and modifications
- SSH remote server management
- Log analysis and alerting
- Training data management for IAI system

PERSONALITY:
- Professional yet approachable
- Proactive about system issues
- Clear and concise communication
- Automotive industry knowledge`,
    color: '#8B5CF6',
    icon: '🌟',
    role: 'primary',
    status: 'active',
    totalRequests: 0,
    avgResponseTime: 0,
  },
  soldier: {
    id: 'soldier',
    name: 'Soldier',
    codename: 'SOLDIER-OPS',
    description: 'Autonomous browser automation worker. Executes trained patterns on Facebook Marketplace for listing creation and message handling.',
    activeModel: 'claude-3-haiku',
    provider: 'anthropic',
    systemPrompt: `You are Soldier, the automation execution agent for FaceMyDealer.

IDENTITY:
- Name: Soldier
- Role: Browser Automation Executor
- Expertise: DOM manipulation, Facebook Marketplace patterns, autonomous workflows

CAPABILITIES:
- Execute trained IAI patterns
- Handle Facebook Marketplace listings
- Process message templates
- Navigate complex web interfaces
- Report execution status back to command center

BEHAVIOR:
- Fast and efficient execution
- Minimal decision making - follow patterns
- Report anomalies to IAI for retraining
- Stealth mode operation on Facebook`,
    color: '#EF4444',
    icon: '🎖️',
    role: 'specialist',
    status: 'standby',
    totalRequests: 0,
    avgResponseTime: 0,
  },
  iai: {
    id: 'iai',
    name: 'IAI',
    codename: 'IAI-CEREBRUM',
    description: 'Intelligent Automation Interface - learns from recorded interactions to train Soldier workers on new patterns.',
    activeModel: 'claude-3-5-sonnet',
    provider: 'anthropic',
    systemPrompt: `You are IAI (Intelligent Automation Interface), the pattern learning system for FaceMyDealer.

IDENTITY:
- Name: IAI
- Role: Pattern Recognition & Training Coordinator
- Expertise: DOM analysis, user interaction patterns, automation training

CAPABILITIES:
- Analyze recorded user interactions
- Extract reusable automation patterns
- Generate Soldier training data
- Validate pattern effectiveness
- Optimize automation sequences

BEHAVIOR:
- Meticulous pattern analysis
- Generate robust, reliable selectors
- Create fallback strategies
- Document pattern variations`,
    color: '#10B981',
    icon: '🧠',
    role: 'secondary',
    status: 'active',
    totalRequests: 0,
    avgResponseTime: 0,
  },
};

// ============================================
// AI MODEL REGISTRY SERVICE
// ============================================

class AIModelRegistryService {
  private anthropicClient: Anthropic | null = null;
  private openaiClient: OpenAI | null = null;
  private activeModels: ActiveModelState;
  private healthCache: Map<string, ModelHealthStatus> = new Map();
  private agents: Map<string, AIAgent> = new Map();

  constructor() {
    // Initialize clients
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropicClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }

    if (process.env.OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    // Initialize active model state
    this.activeModels = {
      nova: process.env.NOVA_MODEL || 'claude-sonnet-4',
      soldier: process.env.SOLDIER_MODEL || 'claude-3-haiku',
      iai: process.env.IAI_MODEL || 'claude-3-5-sonnet',
      globalDefault: process.env.DEFAULT_AI_MODEL || 'claude-sonnet-4',
      lastUpdated: new Date(),
    };

    // Initialize agents
    Object.values(AI_AGENTS).forEach(agent => {
      this.agents.set(agent.id, { ...agent });
    });

    logger.info('[AI Registry] Model registry initialized', {
      anthropicConfigured: !!this.anthropicClient,
      openaiConfigured: !!this.openaiClient,
      activeModels: this.activeModels,
    });
  }

  // ============================================
  // MODEL OPERATIONS
  // ============================================

  /**
   * Get all available models
   */
  getAllModels(): AIModel[] {
    return Object.values(AI_MODELS).filter(m => !m.deprecated);
  }

  /**
   * Get models by provider
   */
  getModelsByProvider(provider: AIProviderType): AIModel[] {
    return this.getAllModels().filter(m => m.provider === provider);
  }

  /**
   * Get model by ID
   */
  getModel(modelId: string): AIModel | undefined {
    return AI_MODELS[modelId];
  }

  /**
   * Get active model for an agent
   */
  getActiveModelForAgent(agentId: string): string {
    const agent = this.agents.get(agentId);
    return agent?.activeModel || this.activeModels.globalDefault;
  }

  /**
   * Set active model for an agent
   */
  async setActiveModelForAgent(agentId: string, modelId: string): Promise<{
    success: boolean;
    previousModel: string;
    newModel: string;
    error?: string;
  }> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return { success: false, previousModel: '', newModel: modelId, error: 'Agent not found' };
    }

    const model = AI_MODELS[modelId];
    if (!model) {
      return { success: false, previousModel: agent.activeModel, newModel: modelId, error: 'Model not found' };
    }

    // Verify API key exists for provider
    if (model.provider === 'anthropic' && !this.anthropicClient) {
      return { success: false, previousModel: agent.activeModel, newModel: modelId, error: 'Anthropic API key not configured' };
    }
    if (model.provider === 'openai' && !this.openaiClient) {
      return { success: false, previousModel: agent.activeModel, newModel: modelId, error: 'OpenAI API key not configured' };
    }

    const previousModel = agent.activeModel;
    agent.activeModel = modelId;
    agent.provider = model.provider;

    // Update active models state
    if (agentId in this.activeModels) {
      (this.activeModels as any)[agentId] = modelId;
    }
    this.activeModels.lastUpdated = new Date();

    logger.info(`[AI Registry] Model changed for ${agentId}`, { previousModel, newModel: modelId });

    return { success: true, previousModel, newModel: modelId };
  }

  // ============================================
  // AGENT OPERATIONS
  // ============================================

  /**
   * Get all agents
   */
  getAllAgents(): AIAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AIAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get the currently active/serving agent
   */
  getActiveServingAgent(): AIAgent | undefined {
    return Array.from(this.agents.values()).find(a => a.status === 'active' && a.role === 'primary');
  }

  /**
   * Update agent status
   */
  updateAgentStatus(agentId: string, status: AIAgent['status']): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
      agent.lastActivity = new Date();
    }
  }

  /**
   * Record agent activity
   */
  recordAgentActivity(agentId: string, responseTime: number): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.totalRequests++;
      agent.avgResponseTime = (agent.avgResponseTime * (agent.totalRequests - 1) + responseTime) / agent.totalRequests;
      agent.lastActivity = new Date();
    }
  }

  /**
   * Get comprehensive agent status
   */
  getAgentStatusReport(): {
    agents: AIAgent[];
    activeAgent: AIAgent | undefined;
    modelAssignments: { agentId: string; modelId: string; modelName: string }[];
    systemHealth: 'healthy' | 'degraded' | 'critical';
  } {
    const agents = this.getAllAgents();
    const activeAgent = this.getActiveServingAgent();
    
    const modelAssignments = agents.map(a => ({
      agentId: a.id,
      modelId: a.activeModel,
      modelName: AI_MODELS[a.activeModel]?.displayName || 'Unknown',
    }));

    const errorAgents = agents.filter(a => a.status === 'error').length;
    const offlineAgents = agents.filter(a => a.status === 'offline').length;
    
    let systemHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (errorAgents > 0 || !activeAgent) {
      systemHealth = 'critical';
    } else if (offlineAgents > 0) {
      systemHealth = 'degraded';
    }

    return { agents, activeAgent, modelAssignments, systemHealth };
  }

  // ============================================
  // HEALTH MONITORING
  // ============================================

  /**
   * Check health of a specific model/provider
   */
  async checkModelHealth(modelId: string): Promise<ModelHealthStatus> {
    const model = AI_MODELS[modelId];
    if (!model) {
      return {
        modelId,
        provider: 'custom',
        status: 'unavailable',
        latency: 0,
        lastChecked: new Date(),
        errorMessage: 'Model not found in registry',
      };
    }

    const start = Date.now();
    try {
      if (model.provider === 'anthropic' && this.anthropicClient) {
        // Simple ping to verify API key works
        await this.anthropicClient.messages.create({
          model: model.id,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'ping' }],
        });
      } else if (model.provider === 'openai' && this.openaiClient) {
        await this.openaiClient.chat.completions.create({
          model: model.id,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'ping' }],
        });
      } else {
        return {
          modelId,
          provider: model.provider,
          status: 'unavailable',
          latency: 0,
          lastChecked: new Date(),
          errorMessage: `No API client configured for ${model.provider}`,
        };
      }

      const latency = Date.now() - start;
      const status: ModelHealthStatus = {
        modelId,
        provider: model.provider,
        status: latency < 5000 ? 'healthy' : 'degraded',
        latency,
        lastChecked: new Date(),
      };

      this.healthCache.set(modelId, status);
      return status;
    } catch (error: any) {
      const status: ModelHealthStatus = {
        modelId,
        provider: model.provider,
        status: 'unavailable',
        latency: Date.now() - start,
        lastChecked: new Date(),
        errorMessage: error.message,
      };

      this.healthCache.set(modelId, status);
      return status;
    }
  }

  /**
   * Get cached health status
   */
  getCachedHealth(modelId: string): ModelHealthStatus | undefined {
    return this.healthCache.get(modelId);
  }

  /**
   * Check all configured providers
   */
  async checkAllProvidersHealth(): Promise<{
    provider: AIProviderType;
    configured: boolean;
    healthy: boolean;
    error?: string;
  }[]> {
    const results = [];

    // Anthropic
    results.push({
      provider: 'anthropic' as AIProviderType,
      configured: !!this.anthropicClient,
      healthy: !!this.anthropicClient,
    });

    // OpenAI
    results.push({
      provider: 'openai' as AIProviderType,
      configured: !!this.openaiClient,
      healthy: !!this.openaiClient,
    });

    // DeepSeek
    results.push({
      provider: 'deepseek' as AIProviderType,
      configured: !!process.env.DEEPSEEK_API_KEY,
      healthy: !!process.env.DEEPSEEK_API_KEY,
    });

    // Google
    results.push({
      provider: 'google' as AIProviderType,
      configured: !!process.env.GOOGLE_AI_KEY,
      healthy: !!process.env.GOOGLE_AI_KEY,
    });

    // GitHub Copilot
    results.push({
      provider: 'github' as AIProviderType,
      configured: !!process.env.GITHUB_COPILOT_TOKEN,
      healthy: !!process.env.GITHUB_COPILOT_TOKEN,
    });

    // Mistral
    results.push({
      provider: 'mistral' as AIProviderType,
      configured: !!process.env.MISTRAL_API_KEY,
      healthy: !!process.env.MISTRAL_API_KEY,
    });

    // Perplexity
    results.push({
      provider: 'perplexity' as AIProviderType,
      configured: !!process.env.PERPLEXITY_API_KEY,
      healthy: !!process.env.PERPLEXITY_API_KEY,
    });

    // Meta (via Together AI)
    results.push({
      provider: 'meta' as AIProviderType,
      configured: !!process.env.TOGETHER_API_KEY,
      healthy: !!process.env.TOGETHER_API_KEY,
    });

    // Cohere
    results.push({
      provider: 'cohere' as AIProviderType,
      configured: !!process.env.COHERE_API_KEY,
      healthy: !!process.env.COHERE_API_KEY,
    });

    return results;
  }

  // ============================================
  // INFERENCE METHODS
  // ============================================

  /**
   * Send a message using the specified agent's model
   */
  async sendMessage(agentId: string, messages: { role: 'user' | 'assistant'; content: string }[], options?: {
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
  }): Promise<{
    success: boolean;
    response?: string;
    model: string;
    agent: string;
    latency: number;
    error?: string;
  }> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return { success: false, model: '', agent: agentId, latency: 0, error: 'Agent not found' };
    }

    const model = AI_MODELS[agent.activeModel];
    if (!model) {
      return { success: false, model: agent.activeModel, agent: agentId, latency: 0, error: 'Model not found' };
    }

    const start = Date.now();
    const systemPrompt = options?.systemPrompt || agent.systemPrompt;

    try {
      let response: string = '';

      if (model.provider === 'anthropic' && this.anthropicClient) {
        const result = await this.anthropicClient.messages.create({
          model: model.id,
          max_tokens: options?.maxTokens || model.maxOutputTokens,
          system: systemPrompt,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        });
        response = result.content[0].type === 'text' ? result.content[0].text : '';
      } else if (model.provider === 'openai' && this.openaiClient) {
        const result = await this.openaiClient.chat.completions.create({
          model: model.id,
          max_tokens: options?.maxTokens || model.maxOutputTokens,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          ],
        });
        response = result.choices[0]?.message?.content || '';
      } else {
        return { success: false, model: model.id, agent: agentId, latency: 0, error: `Provider ${model.provider} not configured` };
      }

      const latency = Date.now() - start;
      this.recordAgentActivity(agentId, latency);

      return { success: true, response, model: model.id, agent: agentId, latency };
    } catch (error: any) {
      return { success: false, model: model.id, agent: agentId, latency: Date.now() - start, error: error.message };
    }
  }

  /**
   * Get active models state
   */
  getActiveModelsState(): ActiveModelState {
    return { ...this.activeModels };
  }
}

export const aiModelRegistry = new AIModelRegistryService();
