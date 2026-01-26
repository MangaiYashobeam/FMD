/**
 * GitHub Copilot Models Integration Service
 * 
 * Complete integration with all GitHub Copilot selectable models
 * with real endpoints and intelligent routing
 * 
 * Supports TWO API modes:
 * 1. GitHub Copilot API - Access all models through GitHub's unified API
 * 2. Direct API - Access models through their native APIs (OpenAI, Anthropic, Google)
 * 
 * @version 4.0.0 - Added GitHub Copilot API integration
 * @author FMD Engineering Team
 */

import { logger } from '@/utils/logger';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// Google AI SDK - optional import with fallback
let GoogleGenerativeAI: any = null;
try {
  GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
} catch (e) {
  logger.debug('[CopilotModels] @google/generative-ai not installed, Gemini will use fallback');
}

// GitHub Copilot API Configuration
const GITHUB_MODELS_API_URL = 'https://models.inference.ai.azure.com/chat/completions';

// API Mode types
export type APIMode = 'copilot' | 'direct';

// ============================================
// COPILOT MODEL DEFINITIONS (From Screenshot)
// ============================================

export type CopilotModelTier = 'flagship' | 'standard' | 'preview' | 'economy';
export type CopilotModelFamily = 'gpt' | 'claude' | 'gemini' | 'raptor' | 'codex';

export interface CopilotModel {
  id: string;
  displayName: string;
  family: CopilotModelFamily;
  tier: CopilotModelTier;
  multiplier: string; // e.g., "3x", "1x", "0.33x" from the screenshot
  capabilities: string[];
  endpoint: {
    provider: 'openai' | 'anthropic' | 'google' | 'internal' | 'copilot';
    model: string; // Model ID for direct API
    copilotModel?: string; // Model ID for GitHub Copilot API (if different)
    baseUrl?: string;
  };
  costPerMillion: {
    input: number;
    output: number;
  };
  contextWindow: number;
  maxOutput: number;
  specializations: string[];
  isPreview: boolean;
  discount?: number; // 10% discount indicator
  apiMode: APIMode; // Which API to use: 'copilot' or 'direct'
}

// All models from the screenshot - exactly as shown
// Using GitHub Copilot API for all models where available
export const COPILOT_MODELS: Record<string, CopilotModel> = {
  // === GPT MODELS (via Copilot API) ===
  'gpt-4.1': {
    id: 'gpt-4.1',
    displayName: 'GPT-4.1',
    family: 'gpt',
    tier: 'flagship',
    multiplier: '0x',
    capabilities: ['chat', 'code', 'analysis', 'vision', 'tools'],
    endpoint: { provider: 'copilot', model: 'gpt-4-turbo-preview', copilotModel: 'gpt-4.1' },
    costPerMillion: { input: 10, output: 30 },
    contextWindow: 128000,
    maxOutput: 4096,
    specializations: ['general', 'code-review', 'documentation'],
    isPreview: false,
    discount: 10,
    apiMode: 'copilot',
  },
  'gpt-4o': {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    family: 'gpt',
    tier: 'flagship',
    multiplier: '0x',
    capabilities: ['chat', 'code', 'analysis', 'vision', 'tools', 'audio'],
    endpoint: { provider: 'copilot', model: 'gpt-4o', copilotModel: 'gpt-4o' },
    costPerMillion: { input: 2.5, output: 10 },
    contextWindow: 128000,
    maxOutput: 16384,
    specializations: ['multimodal', 'customer-service', 'real-time'],
    isPreview: false,
    discount: 10,
    apiMode: 'copilot',
  },
  'gpt-5-mini': {
    id: 'gpt-5-mini',
    displayName: 'GPT-5 mini',
    family: 'gpt',
    tier: 'standard',
    multiplier: '0x',
    capabilities: ['chat', 'code', 'analysis', 'tools'],
    endpoint: { provider: 'copilot', model: 'gpt-4o-mini', copilotModel: 'gpt-5-mini' },
    costPerMillion: { input: 0.15, output: 0.6 },
    contextWindow: 128000,
    maxOutput: 16384,
    specializations: ['quick-tasks', 'simple-queries', 'batch-processing'],
    isPreview: false,
    discount: 10,
    apiMode: 'copilot',
  },
  'gpt-5': {
    id: 'gpt-5',
    displayName: 'GPT-5',
    family: 'gpt',
    tier: 'flagship',
    multiplier: '1x',
    capabilities: ['chat', 'code', 'analysis', 'vision', 'tools', 'reasoning'],
    endpoint: { provider: 'copilot', model: 'o1', copilotModel: 'gpt-5' },
    costPerMillion: { input: 15, output: 60 },
    contextWindow: 200000,
    maxOutput: 100000,
    specializations: ['complex-reasoning', 'research', 'planning'],
    isPreview: false,
    apiMode: 'copilot',
  },
  'gpt-5.1': {
    id: 'gpt-5.1',
    displayName: 'GPT-5.1',
    family: 'gpt',
    tier: 'flagship',
    multiplier: '1x',
    capabilities: ['chat', 'code', 'analysis', 'vision', 'tools', 'reasoning'],
    endpoint: { provider: 'copilot', model: 'o1', copilotModel: 'gpt-5.1' },
    costPerMillion: { input: 15, output: 60 },
    contextWindow: 200000,
    maxOutput: 100000,
    specializations: ['complex-reasoning', 'advanced-code'],
    isPreview: false,
    apiMode: 'copilot',
  },
  'gpt-5.2': {
    id: 'gpt-5.2',
    displayName: 'GPT-5.2',
    family: 'gpt',
    tier: 'flagship',
    multiplier: '1x',
    capabilities: ['chat', 'code', 'analysis', 'vision', 'tools', 'reasoning', 'agents'],
    endpoint: { provider: 'copilot', model: 'o1', copilotModel: 'gpt-5.2' },
    costPerMillion: { input: 15, output: 60 },
    contextWindow: 200000,
    maxOutput: 100000,
    specializations: ['autonomous-agents', 'complex-workflows'],
    isPreview: false,
    apiMode: 'copilot',
  },
  
  // === CODEX MODELS (via Copilot API) ===
  'gpt-5-codex-preview': {
    id: 'gpt-5-codex-preview',
    displayName: 'GPT-5-Codex (Preview)',
    family: 'codex',
    tier: 'preview',
    multiplier: '1x',
    capabilities: ['code', 'code-generation', 'code-review', 'refactoring'],
    endpoint: { provider: 'copilot', model: 'o1', copilotModel: 'gpt-5-codex' },
    costPerMillion: { input: 15, output: 60 },
    contextWindow: 200000,
    maxOutput: 100000,
    specializations: ['code-generation', 'debugging', 'architecture'],
    isPreview: true,
    apiMode: 'copilot',
  },
  'gpt-5.1-codex': {
    id: 'gpt-5.1-codex',
    displayName: 'GPT-5.1-Codex',
    family: 'codex',
    tier: 'flagship',
    multiplier: '1x',
    capabilities: ['code', 'code-generation', 'code-review', 'refactoring', 'testing'],
    endpoint: { provider: 'copilot', model: 'o1', copilotModel: 'gpt-5.1-codex' },
    costPerMillion: { input: 15, output: 60 },
    contextWindow: 200000,
    maxOutput: 100000,
    specializations: ['full-stack', 'system-design', 'testing'],
    isPreview: false,
    apiMode: 'copilot',
  },
  'gpt-5.1-codex-max': {
    id: 'gpt-5.1-codex-max',
    displayName: 'GPT-5.1-Codex-Max',
    family: 'codex',
    tier: 'flagship',
    multiplier: '1x',
    capabilities: ['code', 'code-generation', 'code-review', 'refactoring', 'testing', 'architecture'],
    endpoint: { provider: 'copilot', model: 'o1', copilotModel: 'gpt-5.1-codex-max' },
    costPerMillion: { input: 20, output: 80 },
    contextWindow: 200000,
    maxOutput: 100000,
    specializations: ['enterprise', 'large-codebases', 'migrations'],
    isPreview: false,
    apiMode: 'copilot',
  },
  'gpt-5.1-codex-mini-preview': {
    id: 'gpt-5.1-codex-mini-preview',
    displayName: 'GPT-5.1-Codex-Mini (Preview)',
    family: 'codex',
    tier: 'preview',
    multiplier: '0.33x',
    capabilities: ['code', 'code-generation', 'quick-fixes'],
    endpoint: { provider: 'copilot', model: 'o1-mini', copilotModel: 'gpt-5.1-codex-mini' },
    costPerMillion: { input: 3, output: 12 },
    contextWindow: 128000,
    maxOutput: 65536,
    specializations: ['quick-edits', 'simple-generation'],
    isPreview: true,
    apiMode: 'copilot',
  },
  'gpt-5.2-codex': {
    id: 'gpt-5.2-codex',
    displayName: 'GPT-5.2-Codex',
    family: 'codex',
    tier: 'flagship',
    multiplier: '1x',
    capabilities: ['code', 'code-generation', 'autonomous-coding', 'agents'],
    endpoint: { provider: 'copilot', model: 'o1', copilotModel: 'gpt-5.2-codex' },
    costPerMillion: { input: 15, output: 60 },
    contextWindow: 200000,
    maxOutput: 100000,
    specializations: ['autonomous-development', 'full-projects'],
    isPreview: false,
    apiMode: 'copilot',
  },

  // === GROK MODELS (via Copilot API) ===
  'grok-code-fast-1': {
    id: 'grok-code-fast-1',
    displayName: 'Grok Code Fast 1',
    family: 'gpt',
    tier: 'standard',
    multiplier: '0x',
    capabilities: ['chat', 'code', 'fast-inference'],
    endpoint: { provider: 'copilot', model: 'grok-code-fast-1', copilotModel: 'grok-code-fast-1' },
    costPerMillion: { input: 0.5, output: 1.5 },
    contextWindow: 128000,
    maxOutput: 8192,
    specializations: ['fast-code', 'quick-edits'],
    isPreview: false,
    apiMode: 'copilot',
  },

  // === RAPTOR MODELS (via Copilot API) ===
  'raptor-mini-preview': {
    id: 'raptor-mini-preview',
    displayName: 'Raptor mini (Preview)',
    family: 'raptor',
    tier: 'preview',
    multiplier: '0x',
    capabilities: ['chat', 'code', 'fast-inference'],
    endpoint: { provider: 'copilot', model: 'raptor-mini', copilotModel: 'raptor-mini' },
    costPerMillion: { input: 0.1, output: 0.4 },
    contextWindow: 64000,
    maxOutput: 8192,
    specializations: ['ultra-fast', 'simple-tasks'],
    isPreview: true,
    discount: 10,
    apiMode: 'copilot',
  },

  // === CLAUDE MODELS (via Copilot API) ===
  'claude-haiku-4.5': {
    id: 'claude-haiku-4.5',
    displayName: 'Claude Haiku 4.5',
    family: 'claude',
    tier: 'economy',
    multiplier: '0.33x',
    capabilities: ['chat', 'code', 'analysis', 'fast-response'],
    endpoint: { provider: 'copilot', model: 'claude-3-haiku-20240307', copilotModel: 'claude-haiku-4.5' },
    costPerMillion: { input: 0.25, output: 1.25 },
    contextWindow: 200000,
    maxOutput: 4096,
    specializations: ['quick-tasks', 'classification', 'extraction'],
    isPreview: false,
    apiMode: 'copilot',
  },
  'claude-opus-4.5': {
    id: 'claude-opus-4.5',
    displayName: 'Claude Opus 4.5',
    family: 'claude',
    tier: 'flagship',
    multiplier: '3x',
    capabilities: ['chat', 'code', 'analysis', 'vision', 'tools', 'extended-thinking', 'computer-use'],
    endpoint: { provider: 'copilot', model: 'claude-opus-4-20250514', copilotModel: 'claude-opus-4.5' },
    costPerMillion: { input: 15, output: 75 },
    contextWindow: 200000,
    maxOutput: 32000,
    specializations: ['complex-reasoning', 'image-analysis', 'screenshots', 'computer-use'],
    isPreview: false,
    apiMode: 'copilot',
  },
  'claude-sonnet-4': {
    id: 'claude-sonnet-4',
    displayName: 'Claude Sonnet 4',
    family: 'claude',
    tier: 'standard',
    multiplier: '1x',
    capabilities: ['chat', 'code', 'analysis', 'vision', 'tools', 'computer-use'],
    endpoint: { provider: 'copilot', model: 'claude-sonnet-4-20250514', copilotModel: 'claude-sonnet-4' },
    costPerMillion: { input: 3, output: 15 },
    contextWindow: 200000,
    maxOutput: 16000,
    specializations: ['balanced', 'general-purpose', 'coding'],
    isPreview: false,
    apiMode: 'copilot',
  },
  'claude-sonnet-4.5': {
    id: 'claude-sonnet-4.5',
    displayName: 'Claude Sonnet 4.5',
    family: 'claude',
    tier: 'standard',
    multiplier: '1x',
    capabilities: ['chat', 'code', 'analysis', 'vision', 'tools', 'extended-thinking'],
    endpoint: { provider: 'copilot', model: 'claude-3-5-sonnet-20241022', copilotModel: 'claude-sonnet-4.5' },
    costPerMillion: { input: 3, output: 15 },
    contextWindow: 200000,
    maxOutput: 8192,
    specializations: ['coding', 'analysis', 'writing'],
    isPreview: false,
    apiMode: 'copilot',
  },

  // === GEMINI MODELS (via Copilot API) ===
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    family: 'gemini',
    tier: 'flagship',
    multiplier: '1x',
    capabilities: ['chat', 'code', 'analysis', 'vision', 'tools', 'long-context'],
    endpoint: { provider: 'copilot', model: 'gemini-1.5-pro', copilotModel: 'gemini-2.5-pro' },
    costPerMillion: { input: 1.25, output: 5 },
    contextWindow: 2000000,
    maxOutput: 8192,
    specializations: ['document-analysis', 'long-context', 'video'],
    isPreview: false,
    apiMode: 'copilot',
  },
  'gemini-3-flash-preview': {
    id: 'gemini-3-flash-preview',
    displayName: 'Gemini 3 Flash (Preview)',
    family: 'gemini',
    tier: 'preview',
    multiplier: '0.33x',
    capabilities: ['chat', 'code', 'analysis', 'vision', 'realtime'],
    endpoint: { provider: 'copilot', model: 'gemini-2.0-flash', copilotModel: 'gemini-3-flash' },
    costPerMillion: { input: 0.075, output: 0.3 },
    contextWindow: 1000000,
    maxOutput: 8192,
    specializations: ['fast-inference', 'streaming', 'real-time'],
    isPreview: true,
    apiMode: 'copilot',
  },
  'gemini-3-pro-preview': {
    id: 'gemini-3-pro-preview',
    displayName: 'Gemini 3 Pro (Preview)',
    family: 'gemini',
    tier: 'preview',
    multiplier: '1x',
    capabilities: ['chat', 'code', 'analysis', 'vision', 'tools', 'agents'],
    endpoint: { provider: 'copilot', model: 'gemini-2.0-flash', copilotModel: 'gemini-3-pro' },
    costPerMillion: { input: 0.5, output: 2 },
    contextWindow: 1000000,
    maxOutput: 8192,
    specializations: ['advanced-reasoning', 'planning'],
    isPreview: true,
    apiMode: 'copilot',
  },
};

// ============================================
// TASK-BASED MODEL ROUTING RULES
// ============================================

export interface RoutingRule {
  id: string;
  name: string;
  description: string;
  priority: number; // Higher = more priority
  conditions: RoutingCondition[];
  targetModel: string;
  fallbackModel: string;
  enabled: boolean;
}

export interface RoutingCondition {
  type: 'command' | 'content-type' | 'keyword' | 'file-type' | 'user-role' | 'context-length' | 'time-sensitive';
  operator: 'equals' | 'contains' | 'startsWith' | 'matches' | 'greaterThan' | 'lessThan';
  value: string | number | string[];
}

export const DEFAULT_ROUTING_RULES: RoutingRule[] = [
  // Screenshot/Image Analysis → Claude Opus 4.5 (best vision)
  {
    id: 'screenshot-analysis',
    name: 'Screenshot Analysis',
    description: 'Route image/screenshot analysis to Claude Opus for best vision capabilities',
    priority: 100,
    conditions: [
      { type: 'content-type', operator: 'contains', value: 'image' },
      { type: 'keyword', operator: 'contains', value: ['screenshot', 'image', 'picture', 'photo', 'analyze this'] },
    ],
    targetModel: 'claude-opus-4.5',
    fallbackModel: 'gpt-4o',
    enabled: true,
  },
  
  // Customer Service → GPT-4o (natural conversation)
  {
    id: 'customer-service',
    name: 'Customer Service',
    description: 'Route customer service interactions to GPT-4o for natural conversation',
    priority: 90,
    conditions: [
      { type: 'keyword', operator: 'contains', value: ['help', 'support', 'question', 'issue', 'problem', 'inquiry'] },
      { type: 'command', operator: 'startsWith', value: '/support' },
    ],
    targetModel: 'gpt-4o',
    fallbackModel: 'claude-sonnet-4',
    enabled: true,
  },

  // Complex Code Generation → GPT-5.1-Codex
  {
    id: 'complex-code',
    name: 'Complex Code Generation',
    description: 'Route complex coding tasks to GPT-5.1-Codex',
    priority: 85,
    conditions: [
      { type: 'keyword', operator: 'contains', value: ['generate', 'create', 'build', 'implement', 'refactor', 'architecture'] },
      { type: 'file-type', operator: 'contains', value: ['.ts', '.tsx', '.js', '.py', '.java', '.go'] },
    ],
    targetModel: 'gpt-5.1-codex',
    fallbackModel: 'claude-sonnet-4',
    enabled: true,
  },

  // Quick Code Edits → Claude Haiku (fast, cheap)
  {
    id: 'quick-code',
    name: 'Quick Code Edits',
    description: 'Route simple code fixes to Claude Haiku for speed',
    priority: 80,
    conditions: [
      { type: 'keyword', operator: 'contains', value: ['fix', 'typo', 'syntax', 'simple', 'quick'] },
      { type: 'context-length', operator: 'lessThan', value: 500 },
    ],
    targetModel: 'claude-haiku-4.5',
    fallbackModel: 'gpt-5-mini',
    enabled: true,
  },

  // Long Document Analysis → Gemini 2.5 Pro (2M context)
  {
    id: 'long-document',
    name: 'Long Document Analysis',
    description: 'Route long documents to Gemini for massive context window',
    priority: 95,
    conditions: [
      { type: 'context-length', operator: 'greaterThan', value: 100000 },
      { type: 'keyword', operator: 'contains', value: ['analyze', 'summarize', 'review', 'document'] },
    ],
    targetModel: 'gemini-2.5-pro',
    fallbackModel: 'claude-opus-4.5',
    enabled: true,
  },

  // Complex Reasoning → Claude Opus / GPT-5
  {
    id: 'complex-reasoning',
    name: 'Complex Reasoning',
    description: 'Route complex reasoning tasks to flagship models',
    priority: 88,
    conditions: [
      { type: 'keyword', operator: 'contains', value: ['explain', 'why', 'analyze', 'compare', 'strategy', 'plan'] },
    ],
    targetModel: 'claude-opus-4.5',
    fallbackModel: 'gpt-5',
    enabled: true,
  },

  // Real-time/Fast Response → Gemini Flash
  {
    id: 'real-time',
    name: 'Real-time Response',
    description: 'Route time-sensitive requests to Gemini Flash',
    priority: 92,
    conditions: [
      { type: 'time-sensitive', operator: 'equals', value: 'true' },
      { type: 'command', operator: 'startsWith', value: '/fast' },
    ],
    targetModel: 'gemini-3-flash-preview',
    fallbackModel: 'claude-haiku-4.5',
    enabled: true,
  },

  // Automation/Browser Tasks → Claude Sonnet (computer-use)
  {
    id: 'automation',
    name: 'Browser Automation',
    description: 'Route automation tasks to Claude with computer-use',
    priority: 87,
    conditions: [
      { type: 'keyword', operator: 'contains', value: ['automate', 'browser', 'click', 'navigate', 'fill', 'form'] },
      { type: 'command', operator: 'startsWith', value: '/automate' },
    ],
    targetModel: 'claude-sonnet-4',
    fallbackModel: 'claude-opus-4.5',
    enabled: true,
  },
];

// ============================================
// COPILOT MODEL SERVICE
// ============================================

export class CopilotModelService {
  private anthropicClient: Anthropic | null = null;
  private openaiClient: OpenAI | null = null;
  private googleClient: any = null; // GoogleGenerativeAI when available
  private copilotApiKey: string | null = null;
  private routingRules: RoutingRule[] = [...DEFAULT_ROUTING_RULES];
  private modelUsageStats: Map<string, { requests: number; tokens: number; latency: number[] }> = new Map();
  private apiMode: APIMode = 'copilot'; // Default to Copilot API

  constructor() {
    this.initializeClients();
  }

  private initializeClients(): void {
    // GitHub Copilot API (primary)
    if (process.env.GITHUB_COPILOT_API_KEY) {
      this.copilotApiKey = process.env.GITHUB_COPILOT_API_KEY;
      this.apiMode = 'copilot';
      logger.info('[CopilotModels] GitHub Copilot API configured');
    }
    
    // Direct API fallbacks
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    if (process.env.OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    // Initialize Google Gemini client if SDK available and API key present
    if (process.env.GOOGLE_AI_KEY && GoogleGenerativeAI) {
      try {
        this.googleClient = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
        logger.info('[CopilotModels] Google Gemini client initialized');
      } catch (error: any) {
        logger.warn('[CopilotModels] Failed to initialize Google client:', error.message);
      }
    }
    
    logger.info('[CopilotModels] Initialized with providers:', {
      copilot: !!this.copilotApiKey,
      anthropic: !!this.anthropicClient,
      openai: !!this.openaiClient,
      google: !!this.googleClient,
      apiMode: this.apiMode,
    });
  }

  /**
   * Get the current API mode
   */
  getApiMode(): APIMode {
    return this.apiMode;
  }

  /**
   * Set the API mode (copilot or direct)
   */
  setApiMode(mode: APIMode): void {
    this.apiMode = mode;
    logger.info(`[CopilotModels] API mode changed to: ${mode}`);
  }

  /**
   * Check if Copilot API is available
   */
  isCopilotApiAvailable(): boolean {
    return !!this.copilotApiKey;
  }

  // ============================================
  // MODEL SELECTION & ROUTING
  // ============================================

  /**
   * Get all available Copilot models
   */
  getAllModels(): CopilotModel[] {
    return Object.values(COPILOT_MODELS);
  }

  /**
   * Get models by family
   */
  getModelsByFamily(family: CopilotModelFamily): CopilotModel[] {
    return this.getAllModels().filter(m => m.family === family);
  }

  /**
   * Get models by tier
   */
  getModelsByTier(tier: CopilotModelTier): CopilotModel[] {
    return this.getAllModels().filter(m => m.tier === tier);
  }

  /**
   * Intelligent model routing based on context
   */
  routeToModel(context: {
    content: string;
    contentType?: string;
    command?: string;
    fileType?: string;
    userRole?: string;
    contextLength?: number;
    timeSensitive?: boolean;
  }): { model: CopilotModel; rule: RoutingRule | null; reason: string } {
    // Sort rules by priority (descending)
    const sortedRules = [...this.routingRules]
      .filter(r => r.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (this.evaluateConditions(rule.conditions, context)) {
        const model = COPILOT_MODELS[rule.targetModel];
        if (model && this.isModelAvailable(model)) {
          return { model, rule, reason: rule.description };
        }
        // Try fallback
        const fallback = COPILOT_MODELS[rule.fallbackModel];
        if (fallback && this.isModelAvailable(fallback)) {
          return { model: fallback, rule, reason: `Fallback: ${rule.description}` };
        }
      }
    }

    // Default: Claude Sonnet 4 (balanced)
    const defaultModel = COPILOT_MODELS['claude-sonnet-4'];
    return { model: defaultModel, rule: null, reason: 'Default balanced model' };
  }

  private evaluateConditions(conditions: RoutingCondition[], context: any): boolean {
    return conditions.some(condition => {
      const value = this.getContextValue(context, condition.type);
      return this.evaluateCondition(condition, value);
    });
  }

  private getContextValue(context: any, type: string): any {
    switch (type) {
      case 'command': return context.command || '';
      case 'content-type': return context.contentType || '';
      case 'keyword': return context.content || '';
      case 'file-type': return context.fileType || '';
      case 'user-role': return context.userRole || '';
      case 'context-length': return context.contextLength || context.content?.length || 0;
      case 'time-sensitive': return context.timeSensitive ? 'true' : 'false';
      default: return '';
    }
  }

  private evaluateCondition(condition: RoutingCondition, value: any): boolean {
    switch (condition.operator) {
      case 'equals':
        return String(value).toLowerCase() === String(condition.value).toLowerCase();
      case 'contains':
        if (Array.isArray(condition.value)) {
          return condition.value.some(v => String(value).toLowerCase().includes(v.toLowerCase()));
        }
        return String(value).toLowerCase().includes(String(condition.value).toLowerCase());
      case 'startsWith':
        return String(value).toLowerCase().startsWith(String(condition.value).toLowerCase());
      case 'matches':
        return new RegExp(String(condition.value), 'i').test(String(value));
      case 'greaterThan':
        return Number(value) > Number(condition.value);
      case 'lessThan':
        return Number(value) < Number(condition.value);
      default:
        return false;
    }
  }

  private isModelAvailable(model: CopilotModel): boolean {
    // If Copilot API is available and model supports it, it's available
    if (this.copilotApiKey && model.apiMode === 'copilot') {
      return true;
    }
    // Fall back to direct API check
    switch (model.endpoint.provider) {
      case 'copilot': return !!this.copilotApiKey;
      case 'anthropic': return !!this.anthropicClient;
      case 'openai': return !!this.openaiClient;
      case 'google': return !!this.googleClient;
      case 'internal': return true;
      default: return false;
    }
  }

  // ============================================
  // ROUTING RULE MANAGEMENT
  // ============================================

  getRoutingRules(): RoutingRule[] {
    return [...this.routingRules];
  }

  addRoutingRule(rule: RoutingRule): void {
    this.routingRules.push(rule);
    this.routingRules.sort((a, b) => b.priority - a.priority);
  }

  updateRoutingRule(ruleId: string, updates: Partial<RoutingRule>): boolean {
    const index = this.routingRules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      this.routingRules[index] = { ...this.routingRules[index], ...updates };
      return true;
    }
    return false;
  }

  deleteRoutingRule(ruleId: string): boolean {
    const index = this.routingRules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      this.routingRules.splice(index, 1);
      return true;
    }
    return false;
  }

  // ============================================
  // MODEL INVOCATION
  // ============================================

  async invoke(modelId: string, messages: { role: 'user' | 'assistant' | 'system'; content: string }[], options?: {
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
    images?: string[]; // base64 images for vision
    forceDirectApi?: boolean; // Force direct API even if Copilot available
  }): Promise<{
    success: boolean;
    response?: string;
    model: string;
    latency: number;
    tokensUsed?: { input: number; output: number };
    error?: string;
    apiUsed: 'copilot' | 'direct';
  }> {
    const model = COPILOT_MODELS[modelId];
    if (!model) {
      return { success: false, model: modelId, latency: 0, error: 'Model not found', apiUsed: 'direct' };
    }

    const start = Date.now();

    try {
      let response: string = '';
      let tokensUsed = { input: 0, output: 0 };
      let apiUsed: 'copilot' | 'direct' = 'direct';

      // Use Copilot API if available and not forced to direct
      if (this.copilotApiKey && model.apiMode === 'copilot' && !options?.forceDirectApi) {
        ({ response, tokensUsed } = await this.invokeCopilotApi(model, messages, options));
        apiUsed = 'copilot';
      } else {
        // Fall back to direct API calls
        switch (model.endpoint.provider) {
          case 'copilot':
            // If Copilot provider but no key, try to use the underlying model via direct API
            if (this.openaiClient && model.endpoint.model.includes('gpt')) {
              ({ response, tokensUsed } = await this.invokeOpenAI(model, messages, options));
            } else if (this.anthropicClient && model.endpoint.model.includes('claude')) {
              ({ response, tokensUsed } = await this.invokeAnthropic(model, messages, options));
            } else if (this.googleClient && model.endpoint.model.includes('gemini')) {
              ({ response, tokensUsed } = await this.invokeGoogle(model, messages, options));
            } else {
              throw new Error('No API client available for this model');
            }
            break;
          case 'anthropic':
            ({ response, tokensUsed } = await this.invokeAnthropic(model, messages, options));
            break;
          case 'openai':
            ({ response, tokensUsed } = await this.invokeOpenAI(model, messages, options));
            break;
          case 'google':
          ({ response, tokensUsed } = await this.invokeGoogle(model, messages, options));
          break;
        default:
          return { success: false, model: modelId, latency: 0, error: `Provider ${model.endpoint.provider} not implemented`, apiUsed: 'direct' };
        }
      }

      const latency = Date.now() - start;
      this.recordUsage(modelId, tokensUsed.input + tokensUsed.output, latency);

      return { success: true, response, model: modelId, latency, tokensUsed, apiUsed };
    } catch (error: any) {
      return { success: false, model: modelId, latency: Date.now() - start, error: error.message, apiUsed: 'direct' };
    }
  }

  /**
   * Invoke model via GitHub Copilot API
   * Uses the unified GitHub Models API endpoint
   */
  private async invokeCopilotApi(model: CopilotModel, messages: any[], options?: any): Promise<{ response: string; tokensUsed: { input: number; output: number } }> {
    if (!this.copilotApiKey) throw new Error('GitHub Copilot API key not configured');

    const copilotModel = model.endpoint.copilotModel || model.endpoint.model;
    
    const requestBody = {
      model: copilotModel,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: options?.maxTokens || model.maxOutput,
      temperature: options?.temperature ?? 0.7,
    };

    const response = await fetch(GITHUB_MODELS_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.copilotApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[CopilotModels] Copilot API error:', { status: response.status, error: errorText });
      throw new Error(`Copilot API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json() as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    
    const responseText = result.choices?.[0]?.message?.content || '';
    const tokensUsed = {
      input: result.usage?.prompt_tokens || 0,
      output: result.usage?.completion_tokens || 0,
    };

    logger.debug('[CopilotModels] Copilot API response:', { model: copilotModel, tokens: tokensUsed });

    return { response: responseText, tokensUsed };
  }

  private async invokeAnthropic(model: CopilotModel, messages: any[], options?: any): Promise<{ response: string; tokensUsed: { input: number; output: number } }> {
    if (!this.anthropicClient) throw new Error('Anthropic client not configured');

    const systemPrompt = options?.systemPrompt || messages.find(m => m.role === 'system')?.content || '';
    const userMessages = messages.filter(m => m.role !== 'system');

    const result = await this.anthropicClient.messages.create({
      model: model.endpoint.model,
      max_tokens: options?.maxTokens || model.maxOutput,
      system: systemPrompt,
      messages: userMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: options?.images && m.role === 'user' ? [
          ...options.images.map((img: string) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/png' as const, data: img } })),
          { type: 'text' as const, text: m.content }
        ] : m.content,
      })),
    });

    const response = result.content[0].type === 'text' ? result.content[0].text : '';
    return { response, tokensUsed: { input: result.usage.input_tokens, output: result.usage.output_tokens } };
  }

  private async invokeOpenAI(model: CopilotModel, messages: any[], options?: any): Promise<{ response: string; tokensUsed: { input: number; output: number } }> {
    if (!this.openaiClient) throw new Error('OpenAI client not configured');

    const result = await this.openaiClient.chat.completions.create({
      model: model.endpoint.model,
      max_tokens: options?.maxTokens || model.maxOutput,
      temperature: options?.temperature,
      messages: messages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: options?.images && m.role === 'user' ? [
          { type: 'text' as const, text: m.content },
          ...options.images.map((img: string) => ({ type: 'image_url' as const, image_url: { url: `data:image/png;base64,${img}` } })),
        ] : m.content,
      })),
    });

    const response = result.choices[0]?.message?.content || '';
    return { 
      response, 
      tokensUsed: { 
        input: result.usage?.prompt_tokens || 0, 
        output: result.usage?.completion_tokens || 0 
      } 
    };
  }

  private async invokeGoogle(model: CopilotModel, messages: any[], options?: any): Promise<{ response: string; tokensUsed: { input: number; output: number } }> {
    if (!this.googleClient) {
      // Fallback to OpenAI if Google isn't available
      logger.warn('[CopilotModels] Google client not configured, falling back to OpenAI');
      return this.invokeOpenAI(model, messages, options);
    }

    try {
      const genModel = this.googleClient.getGenerativeModel({ 
        model: model.endpoint.model,
        generationConfig: {
          maxOutputTokens: options?.maxTokens || model.maxOutput,
          temperature: options?.temperature || 0.7,
        },
      });
      
      // Build chat history from previous messages
      const systemMessage = messages.find((m: any) => m.role === 'system');
      const chatMessages = messages.filter((m: any) => m.role !== 'system');
      
      // Format history for Gemini (user/model roles)
      const history = chatMessages.slice(0, -1).map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      // Start chat with optional system instruction
      const chat = genModel.startChat({ 
        history,
        systemInstruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined,
      });
      
      const lastMessage = chatMessages[chatMessages.length - 1];
      
      // Handle images if present
      let messageParts: any[] = [];
      if (options?.images && options.images.length > 0) {
        // Add images as inline data
        for (const img of options.images) {
          messageParts.push({
            inlineData: {
              mimeType: 'image/png',
              data: img, // base64 string
            },
          });
        }
      }
      messageParts.push({ text: lastMessage.content });
      
      const result = await chat.sendMessage(messageParts);
      const response = result.response.text();

      // Try to get token counts if available
      const usage = result.response.usageMetadata;
      const tokensUsed = {
        input: usage?.promptTokenCount || 0,
        output: usage?.candidatesTokenCount || 0,
      };

      logger.debug(`[CopilotModels] Gemini response received, tokens: ${tokensUsed.input}/${tokensUsed.output}`);
      return { response, tokensUsed };
    } catch (error: any) {
      logger.error('[CopilotModels] Gemini invocation failed:', error.message);
      // Fallback to OpenAI on error
      logger.warn('[CopilotModels] Falling back to OpenAI');
      return this.invokeOpenAI(model, messages, options);
    }
  }

  private recordUsage(modelId: string, tokens: number, latency: number): void {
    const stats = this.modelUsageStats.get(modelId) || { requests: 0, tokens: 0, latency: [] };
    stats.requests++;
    stats.tokens += tokens;
    stats.latency.push(latency);
    if (stats.latency.length > 100) stats.latency.shift();
    this.modelUsageStats.set(modelId, stats);
  }

  getUsageStats(): Map<string, { requests: number; tokens: number; avgLatency: number }> {
    const result = new Map();
    this.modelUsageStats.forEach((stats, modelId) => {
      const avgLatency = stats.latency.length > 0 
        ? stats.latency.reduce((a, b) => a + b, 0) / stats.latency.length 
        : 0;
      result.set(modelId, { requests: stats.requests, tokens: stats.tokens, avgLatency });
    });
    return result;
  }
}

// Singleton export
export const copilotModelService = new CopilotModelService();
