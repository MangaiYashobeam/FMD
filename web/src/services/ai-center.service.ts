/**
 * AI Center Service
 * Frontend service for AI Center API interactions
 * 
 * Production-ready API client with:
 * - Full CRUD operations for all AI Center modules
 * - Real-time tracing support
 * - Error handling and retry logic
 * - Type safety
 */

import { AxiosError } from 'axios';
import { api } from '../lib/api';

const API_BASE = '/api/ai-center';

// ============================================
// Types
// ============================================

export interface AIProvider {
  id: string;
  name: string;
  displayName: string;
  type: 'openai' | 'anthropic' | 'deepseek' | 'github' | 'copilot' | 'mistral' | 'xai' | 'perplexity' | 'custom';
  isActive: boolean;
  defaultModel: string;
  availableModels: string[];
  healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  capabilities: string[];
  lastHealthCheck?: string;
  config?: Record<string, any>;
}

export interface DashboardStats {
  tasks: {
    total: number;
    byStatus: Record<string, number>;
    overdue: number;
    completedToday: number;
  };
  threats: {
    total: number;
    last24Hours: number;
    bySeverity: Record<string, number>;
    byStatus: Record<string, number>;
  };
  patterns: {
    totalPatterns: number;
    activePatterns: number;
    avgSuccessRate: number;
    topPerformers: { id: string; name: string; successRate: number }[];
  };
  memory: {
    total: number;
    byType: Record<string, { count: number; avgImportance: number }>;
  };
  usage: {
    totalCalls: number;
    totalTokens: number;
    totalCost: number;
    byProvider: Record<string, { calls: number; tokens: number; cost: number }>;
  };
  providers: {
    id: string;
    name: string;
    isActive: boolean;
    healthStatus: string;
    defaultModel: string;
  }[];
}

export interface APITrace {
  id: string;
  provider: string;
  model: string;
  operation: string;
  startedAt: string;
  endedAt?: string;
  status: 'pending' | 'success' | 'error';
  latency?: number;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  error?: string;
}

export interface MemoryItem {
  id: string;
  type: string;
  category: string;
  content: any;
  importance: number;
  accessCount: number;
  lastAccessed: string;
  createdAt: string;
  expiresAt?: string;
  metadata?: Record<string, any>;
}

export interface LearningPattern {
  id: string;
  name: string;
  description: string;
  pattern: string;
  category: string;
  isActive: boolean;
  successRate: number;
  usageCount: number;
  triggerConditions: string[];
  actions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TrainingSession {
  id: string;
  name: string;
  type: 'fine-tuning' | 'reinforcement' | 'few-shot' | 'prompt-engineering';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  datasetSize: number;
  metrics?: {
    accuracy?: number;
    loss?: number;
    iterations?: number;
  };
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface AITask {
  id: string;
  title: string;
  description?: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  autonomyLevel?: string;
  scheduledFor?: string;
  dueAt?: string;
  startedAt?: string;
  completedAt?: string;
  result?: any;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface Threat {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'detected' | 'confirmed' | 'escalated' | 'resolved' | 'false_positive';
  title: string;
  description?: string;
  source?: string;
  evidence?: string[];
  affectedEntities?: string[];
  detectedAt: string;
  resolvedAt?: string;
  metadata?: Record<string, any>;
}

export interface ThreatRule {
  id: string;
  name: string;
  description: string;
  type: string;
  severity: string;
  conditions: any[];
  actions: string[];
  isActive: boolean;
  matchCount: number;
  createdAt: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  content: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latency: number;
  traceId: string;
}

// ============================================
// API Response Handler
// ============================================

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

async function handleRequest<T>(request: Promise<any>): Promise<T> {
  try {
    const response = await request;
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Request failed');
  } catch (error) {
    const axiosError = error as AxiosError<ApiResponse<any>>;
    const message = axiosError.response?.data?.message || axiosError.message || 'Unknown error';
    console.error('AI Center API Error:', message);
    throw new Error(message);
  }
}

// ============================================
// Dashboard API
// ============================================

export const dashboardApi = {
  /**
   * Get comprehensive dashboard statistics
   */
  async getStats(accountId?: string): Promise<DashboardStats> {
    const params = accountId ? { accountId } : {};
    return handleRequest(api.get(`${API_BASE}/dashboard`, { params }));
  },
};

// ============================================
// Providers API
// ============================================

export const providersApi = {
  /**
   * Get all AI providers
   */
  async getAll(): Promise<AIProvider[]> {
    return handleRequest(api.get(`${API_BASE}/providers`));
  },

  /**
   * Get provider by ID
   */
  async getById(id: string): Promise<AIProvider> {
    return handleRequest(api.get(`${API_BASE}/providers/${id}`));
  },

  /**
   * Wake up / initialize a provider
   */
  async wakeUp(id: string): Promise<{ success: boolean; status: string; message: string; latency: number; configured: boolean; error?: string }> {
    return handleRequest(api.post(`${API_BASE}/providers/${id}/wake-up`));
  },

  /**
   * Wake up all providers
   */
  async wakeUpAll(): Promise<{ providerId: string; success: boolean; status: string; message: string; latency: number; configured: boolean; error?: string }[]> {
    return handleRequest(api.post(`${API_BASE}/providers/wake-up-all`));
  },

  /**
   * Check provider health
   */
  async checkHealth(id: string): Promise<{ status: string; latency: number; lastCheck: string }> {
    return handleRequest(api.get(`${API_BASE}/providers/${id}/health`));
  },

  /**
   * Update provider configuration
   */
  async update(id: string, data: Partial<AIProvider>): Promise<void> {
    return handleRequest(api.put(`${API_BASE}/providers/${id}`, data));
  },

  /**
   * Set default provider
   */
  async setDefault(providerId: string): Promise<void> {
    return handleRequest(api.post(`${API_BASE}/providers/set-default`, { providerId }));
  },
};

// ============================================
// Chat API
// ============================================

export const chatApi = {
  /**
   * Send chat message
   */
  async send(
    messages: ChatMessage[],
    options?: {
      provider?: string;
      model?: string;
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
    }
  ): Promise<ChatResponse> {
    return handleRequest(api.post(`${API_BASE}/chat`, { messages, ...options }));
  },

  /**
   * DeepSeek code completion
   */
  async codeCompletion(
    code: string,
    instruction: string,
    language?: string
  ): Promise<{ completion: string; traceId: string }> {
    return handleRequest(api.post(`${API_BASE}/deepseek/code`, { code, instruction, language }));
  },

  /**
   * DeepSeek reasoning
   */
  async reason(
    problem: string,
    context?: string
  ): Promise<{ reasoning: string; conclusion: string; traceId: string }> {
    return handleRequest(api.post(`${API_BASE}/deepseek/reason`, { problem, context }));
  },
};

// ============================================
// Traces API
// ============================================

export const tracesApi = {
  /**
   * Get API traces
   */
  async getAll(options?: {
    provider?: string;
    status?: string;
    limit?: number;
    since?: string;
  }): Promise<APITrace[]> {
    return handleRequest(api.get(`${API_BASE}/traces`, { params: options }));
  },

  /**
   * Get active traces
   */
  async getActive(): Promise<APITrace[]> {
    return handleRequest(api.get(`${API_BASE}/traces/active`));
  },

  /**
   * Get usage statistics
   */
  async getUsage(period?: 'hour' | 'day' | 'week' | 'month'): Promise<any> {
    return handleRequest(api.get(`${API_BASE}/usage`, { params: { period } }));
  },
};

// ============================================
// Memory API
// ============================================

export const memoryApi = {
  /**
   * Search memories
   */
  async search(options?: {
    type?: string;
    category?: string;
    query?: string;
    limit?: number;
    minImportance?: number;
  }): Promise<MemoryItem[]> {
    return handleRequest(api.get(`${API_BASE}/memory`, { params: options }));
  },

  /**
   * Store a memory
   */
  async store(data: {
    type: string;
    category: string;
    content: any;
    metadata?: Record<string, any>;
    importance?: number;
    expiresIn?: number;
  }): Promise<MemoryItem> {
    return handleRequest(api.post(`${API_BASE}/memory`, data));
  },

  /**
   * Get memory statistics
   */
  async getStats(): Promise<any> {
    return handleRequest(api.get(`${API_BASE}/memory/stats`));
  },

  /**
   * Delete memory
   */
  async delete(id: string): Promise<void> {
    return handleRequest(api.delete(`${API_BASE}/memory/${id}`));
  },

  /**
   * Clean expired memories
   */
  async cleanExpired(): Promise<{ cleaned: number }> {
    return handleRequest(api.post(`${API_BASE}/memory/clean`));
  },
};

// ============================================
// Patterns API
// ============================================

export const patternsApi = {
  /**
   * Get patterns
   */
  async getAll(options?: {
    category?: string;
    isActive?: boolean;
    minSuccessRate?: number;
  }): Promise<LearningPattern[]> {
    return handleRequest(api.get(`${API_BASE}/patterns`, { params: options }));
  },

  /**
   * Get pattern statistics
   */
  async getStats(): Promise<any> {
    return handleRequest(api.get(`${API_BASE}/patterns/stats`));
  },

  /**
   * Create pattern
   */
  async create(data: {
    name: string;
    description: string;
    pattern: string;
    category: string;
    triggerConditions?: string[];
    actions?: string[];
    isActive?: boolean;
  }): Promise<LearningPattern> {
    return handleRequest(api.post(`${API_BASE}/patterns`, data));
  },

  /**
   * Update pattern
   */
  async update(id: string, data: Partial<LearningPattern>): Promise<LearningPattern> {
    return handleRequest(api.put(`${API_BASE}/patterns/${id}`, data));
  },

  /**
   * Delete pattern
   */
  async delete(id: string): Promise<void> {
    return handleRequest(api.delete(`${API_BASE}/patterns/${id}`));
  },

  /**
   * Record pattern usage
   */
  async recordUsage(id: string, success: boolean): Promise<void> {
    return handleRequest(api.post(`${API_BASE}/patterns/${id}/record`, { success }));
  },
};

// ============================================
// Training API
// ============================================

export const trainingApi = {
  /**
   * Get training sessions
   */
  async getSessions(options?: {
    status?: string;
    type?: string;
  }): Promise<TrainingSession[]> {
    return handleRequest(api.get(`${API_BASE}/training`, { params: options }));
  },

  /**
   * Create training session
   */
  async createSession(data: {
    name: string;
    type: string;
    datasetSize?: number;
  }): Promise<TrainingSession> {
    return handleRequest(api.post(`${API_BASE}/training`, data));
  },

  /**
   * Start training session
   */
  async startSession(id: string): Promise<TrainingSession> {
    return handleRequest(api.post(`${API_BASE}/training/${id}/start`));
  },

  /**
   * Cancel training session
   */
  async cancelSession(id: string): Promise<void> {
    return handleRequest(api.post(`${API_BASE}/training/${id}/cancel`));
  },
};

// ============================================
// Tasks API
// ============================================

export const tasksApi = {
  /**
   * Get tasks
   */
  async getAll(options?: {
    status?: string;
    type?: string;
    priority?: string;
    limit?: number;
  }): Promise<AITask[]> {
    return handleRequest(api.get(`${API_BASE}/tasks`, { params: options }));
  },

  /**
   * Get task statistics
   */
  async getStats(): Promise<any> {
    return handleRequest(api.get(`${API_BASE}/tasks/stats`));
  },

  /**
   * Create task
   */
  async create(data: {
    title: string;
    description?: string;
    type: string;
    priority?: string;
    metadata?: Record<string, any>;
    scheduledFor?: string;
    dueAt?: string;
  }): Promise<AITask> {
    return handleRequest(api.post(`${API_BASE}/tasks`, data));
  },

  /**
   * Execute task
   */
  async execute(id: string): Promise<AITask> {
    return handleRequest(api.post(`${API_BASE}/tasks/${id}/execute`));
  },

  /**
   * Cancel task
   */
  async cancel(id: string): Promise<void> {
    return handleRequest(api.post(`${API_BASE}/tasks/${id}/cancel`));
  },

  /**
   * Update task
   */
  async update(id: string, data: Partial<AITask>): Promise<AITask> {
    return handleRequest(api.put(`${API_BASE}/tasks/${id}`, data));
  },
};

// ============================================
// Threats API
// ============================================

export const threatsApi = {
  /**
   * Get threats
   */
  async getAll(options?: {
    type?: string;
    severity?: string;
    status?: string;
    limit?: number;
    since?: string;
  }): Promise<Threat[]> {
    return handleRequest(api.get(`${API_BASE}/threats`, { params: options }));
  },

  /**
   * Get threat statistics
   */
  async getStats(): Promise<any> {
    return handleRequest(api.get(`${API_BASE}/threats/stats`));
  },

  /**
   * Create threat manually
   */
  async create(data: {
    type: string;
    severity: string;
    title: string;
    description?: string;
    source?: string;
    evidence?: string[];
    affectedEntities?: string[];
  }): Promise<Threat> {
    return handleRequest(api.post(`${API_BASE}/threats`, data));
  },

  /**
   * Update threat
   */
  async update(id: string, data: Partial<Threat>): Promise<Threat> {
    return handleRequest(api.put(`${API_BASE}/threats/${id}`, data));
  },

  /**
   * Run threat detection on data
   */
  async detect(data: any): Promise<Threat[]> {
    return handleRequest(api.post(`${API_BASE}/threats/detect`, { data }));
  },
};

// ============================================
// Threat Rules API
// ============================================

export const threatRulesApi = {
  /**
   * Get threat rules
   */
  async getAll(options?: {
    isActive?: boolean;
    type?: string;
  }): Promise<ThreatRule[]> {
    return handleRequest(api.get(`${API_BASE}/threat-rules`, { params: options }));
  },

  /**
   * Create threat rule
   */
  async create(data: {
    name: string;
    description?: string;
    type: string;
    severity: string;
    conditions: any[];
    actions: string[];
    isActive?: boolean;
  }): Promise<ThreatRule> {
    return handleRequest(api.post(`${API_BASE}/threat-rules`, data));
  },

  /**
   * Update threat rule
   */
  async update(id: string, data: Partial<ThreatRule>): Promise<ThreatRule> {
    return handleRequest(api.put(`${API_BASE}/threat-rules/${id}`, data));
  },

  /**
   * Delete threat rule
   */
  async delete(id: string): Promise<void> {
    return handleRequest(api.delete(`${API_BASE}/threat-rules/${id}`));
  },
};

// ============================================
// Context & Learning API
// ============================================

export const contextApi = {
  /**
   * Build context from memories
   */
  async build(options: {
    accountId?: string;
    userId?: string;
    topic?: string;
    maxTokens?: number;
  }): Promise<{ context: string }> {
    return handleRequest(api.post(`${API_BASE}/context/build`, options));
  },

  /**
   * Learn from interaction
   */
  async learn(data: {
    input: string;
    output: string;
    feedback?: string;
    metadata?: Record<string, any>;
    accountId?: string;
    userId?: string;
  }): Promise<void> {
    return handleRequest(api.post(`${API_BASE}/learn`, data));
  },
};

// ============================================
// Default Export
// ============================================

export const aiCenterService = {
  dashboard: dashboardApi,
  providers: providersApi,
  chat: chatApi,
  traces: tracesApi,
  memory: memoryApi,
  patterns: patternsApi,
  training: trainingApi,
  tasks: tasksApi,
  threats: threatsApi,
  threatRules: threatRulesApi,
  context: contextApi,
};

export default aiCenterService;
