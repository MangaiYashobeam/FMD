/**
 * Model Health Monitoring Service
 * 
 * Monitors the health status of all AI model providers
 * and tracks performance metrics for intelligent routing decisions
 * 
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import prisma from '@/config/database';

// ============================================
// TYPES & INTERFACES
// ============================================

export type ProviderName = 'openai' | 'anthropic' | 'google';
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface ProviderHealth {
  provider: ProviderName;
  status: HealthStatus;
  latencyMs: number;
  lastCheck: Date;
  errorRate: number; // percentage
  consecutiveFailures: number;
  message?: string;
}

export interface ModelHealth {
  modelId: string;
  provider: ProviderName;
  status: HealthStatus;
  avgLatencyMs: number;
  p95LatencyMs: number;
  successRate: number;
  lastUsed: Date | null;
  requestCount24h: number;
  isAvailable: boolean;
}

export interface HealthCheckResult {
  success: boolean;
  latencyMs: number;
  error?: string;
}

// ============================================
// MODEL HEALTH SERVICE
// ============================================

export class ModelHealthService extends EventEmitter {
  private providerHealth: Map<ProviderName, ProviderHealth> = new Map();
  private modelMetrics: Map<string, {
    latencies: number[];
    successes: number;
    failures: number;
    lastUsed: Date | null;
  }> = new Map();
  
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 60000; // 1 minute
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private readonly LATENCY_THRESHOLD_MS = 5000;

  constructor() {
    super();
    this.initializeProviders();
  }

  private initializeProviders(): void {
    const providers: ProviderName[] = ['openai', 'anthropic', 'google'];
    
    for (const provider of providers) {
      this.providerHealth.set(provider, {
        provider,
        status: 'unknown',
        latencyMs: 0,
        lastCheck: new Date(),
        errorRate: 0,
        consecutiveFailures: 0,
      });
    }
  }

  // ============================================
  // HEALTH CHECK OPERATIONS
  // ============================================

  /**
   * Start periodic health checks
   */
  startMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Initial check
    this.checkAllProviders();

    // Schedule periodic checks
    this.healthCheckInterval = setInterval(() => {
      this.checkAllProviders();
    }, this.HEALTH_CHECK_INTERVAL);

    logger.info('[ModelHealth] Health monitoring started');
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    logger.info('[ModelHealth] Health monitoring stopped');
  }

  /**
   * Check health of all providers
   */
  async checkAllProviders(): Promise<void> {
    const checks = ['openai', 'anthropic', 'google'].map((provider) =>
      this.checkProviderHealth(provider as ProviderName)
    );
    
    await Promise.allSettled(checks);
    
    // Persist health status to database
    await this.persistHealthStatus();
  }

  /**
   * Check health of a specific provider
   */
  async checkProviderHealth(provider: ProviderName): Promise<ProviderHealth> {
    const start = Date.now();
    let result: HealthCheckResult;

    try {
      switch (provider) {
        case 'openai':
          result = await this.checkOpenAI();
          break;
        case 'anthropic':
          result = await this.checkAnthropic();
          break;
        case 'google':
          result = await this.checkGoogle();
          break;
        default:
          result = { success: false, latencyMs: 0, error: 'Unknown provider' };
      }
    } catch (error: any) {
      result = { success: false, latencyMs: Date.now() - start, error: error.message };
    }

    const currentHealth = this.providerHealth.get(provider)!;
    
    // Update health status
    const newHealth: ProviderHealth = {
      provider,
      latencyMs: result.latencyMs,
      lastCheck: new Date(),
      consecutiveFailures: result.success ? 0 : currentHealth.consecutiveFailures + 1,
      errorRate: this.calculateErrorRate(provider, result.success),
      status: this.determineStatus(result, currentHealth.consecutiveFailures),
      message: result.error,
    };

    this.providerHealth.set(provider, newHealth);

    // Emit events for status changes
    if (currentHealth.status !== newHealth.status) {
      this.emit('statusChange', { provider, oldStatus: currentHealth.status, newStatus: newHealth.status });
      
      if (newHealth.status === 'unhealthy') {
        this.emit('providerDown', { provider, message: result.error });
        logger.warn(`[ModelHealth] Provider ${provider} marked as unhealthy: ${result.error}`);
      } else if (newHealth.status === 'healthy' && currentHealth.status === 'unhealthy') {
        this.emit('providerRecovered', { provider });
        logger.info(`[ModelHealth] Provider ${provider} recovered`);
      }
    }

    return newHealth;
  }

  private async checkOpenAI(): Promise<HealthCheckResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { success: false, latencyMs: 0, error: 'API key not configured' };
    }

    const start = Date.now();
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
      });
      
      const latencyMs = Date.now() - start;
      
      if (!response.ok) {
        return { success: false, latencyMs, error: `HTTP ${response.status}` };
      }
      
      return { success: true, latencyMs };
    } catch (error: any) {
      return { success: false, latencyMs: Date.now() - start, error: error.message };
    }
  }

  private async checkAnthropic(): Promise<HealthCheckResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { success: false, latencyMs: 0, error: 'API key not configured' };
    }

    const start = Date.now();
    try {
      // Anthropic doesn't have a models endpoint, so we'll do a minimal request
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
        signal: AbortSignal.timeout(15000),
      });
      
      const latencyMs = Date.now() - start;
      
      // Any response (even 400 for validation) means API is reachable
      if (response.status === 200 || response.status === 400) {
        return { success: true, latencyMs };
      }
      
      return { success: false, latencyMs, error: `HTTP ${response.status}` };
    } catch (error: any) {
      return { success: false, latencyMs: Date.now() - start, error: error.message };
    }
  }

  private async checkGoogle(): Promise<HealthCheckResult> {
    const apiKey = process.env.GOOGLE_AI_KEY;
    if (!apiKey) {
      return { success: false, latencyMs: 0, error: 'API key not configured' };
    }

    const start = Date.now();
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
        { signal: AbortSignal.timeout(10000) }
      );
      
      const latencyMs = Date.now() - start;
      
      if (!response.ok) {
        return { success: false, latencyMs, error: `HTTP ${response.status}` };
      }
      
      return { success: true, latencyMs };
    } catch (error: any) {
      return { success: false, latencyMs: Date.now() - start, error: error.message };
    }
  }

  private calculateErrorRate(provider: ProviderName, success: boolean): number {
    // Simple exponential moving average
    const current = this.providerHealth.get(provider)?.errorRate || 0;
    const alpha = 0.2; // Smoothing factor
    const newValue = success ? 0 : 100;
    return current * (1 - alpha) + newValue * alpha;
  }

  private determineStatus(result: HealthCheckResult, consecutiveFailures: number): HealthStatus {
    if (!result.success && consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      return 'unhealthy';
    }
    if (!result.success || result.latencyMs > this.LATENCY_THRESHOLD_MS) {
      return 'degraded';
    }
    return 'healthy';
  }

  // ============================================
  // MODEL METRICS TRACKING
  // ============================================

  /**
   * Record a model invocation result
   */
  recordInvocation(modelId: string, success: boolean, latencyMs: number): void {
    let metrics = this.modelMetrics.get(modelId);
    
    if (!metrics) {
      metrics = { latencies: [], successes: 0, failures: 0, lastUsed: null };
      this.modelMetrics.set(modelId, metrics);
    }

    metrics.latencies.push(latencyMs);
    if (metrics.latencies.length > 100) {
      metrics.latencies.shift();
    }

    if (success) {
      metrics.successes++;
    } else {
      metrics.failures++;
    }

    metrics.lastUsed = new Date();
  }

  /**
   * Get health metrics for a specific model
   */
  getModelHealth(modelId: string, provider: ProviderName): ModelHealth {
    const metrics = this.modelMetrics.get(modelId);
    const providerHealth = this.providerHealth.get(provider);

    if (!metrics) {
      return {
        modelId,
        provider,
        status: providerHealth?.status || 'unknown',
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        successRate: 100,
        lastUsed: null,
        requestCount24h: 0,
        isAvailable: providerHealth?.status === 'healthy',
      };
    }

    const totalRequests = metrics.successes + metrics.failures;
    const avgLatency = metrics.latencies.length > 0
      ? metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length
      : 0;
    
    const sortedLatencies = [...metrics.latencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p95Latency = sortedLatencies[p95Index] || 0;

    return {
      modelId,
      provider,
      status: providerHealth?.status || 'unknown',
      avgLatencyMs: Math.round(avgLatency),
      p95LatencyMs: Math.round(p95Latency),
      successRate: totalRequests > 0 ? (metrics.successes / totalRequests) * 100 : 100,
      lastUsed: metrics.lastUsed,
      requestCount24h: totalRequests, // Simplified for now
      isAvailable: providerHealth?.status === 'healthy' || providerHealth?.status === 'degraded',
    };
  }

  // ============================================
  // DATABASE PERSISTENCE
  // ============================================

  /**
   * Persist health status to database
   */
  private async persistHealthStatus(): Promise<void> {
    try {
      const healthRecords = Array.from(this.providerHealth.values()).map((h) => ({
        modelId: `provider:${h.provider}`,
        provider: h.provider,
        status: h.status,
        latencyMs: h.latencyMs || null,
        errorRate: h.errorRate,
        failsCount: h.consecutiveFailures,
        lastChecked: h.lastCheck,
        lastError: h.message || null,
        metadata: { consecutiveFailures: h.consecutiveFailures, message: h.message },
      }));

      for (const record of healthRecords) {
        await prisma.aIModelHealth.upsert({
          where: { modelId: record.modelId },
          update: {
            status: record.status,
            latencyMs: record.latencyMs,
            errorRate: record.errorRate,
            failsCount: record.failsCount,
            lastChecked: record.lastChecked,
            lastError: record.lastError,
            metadata: record.metadata,
          },
          create: record,
        });
      }
    } catch (error: any) {
      logger.debug('[ModelHealth] Could not persist health status:', error.message);
    }
  }

  /**
   * Load health status from database
   */
  async loadHealthFromDB(): Promise<void> {
    try {
      const records = await prisma.aIModelHealth.findMany();
      
      for (const record of records) {
        if (record.modelId.startsWith('provider:')) {
          const provider = record.modelId.replace('provider:', '') as ProviderName;
          const metadata = (record.metadata as any) || {};
          this.providerHealth.set(provider, {
            provider,
            status: record.status as HealthStatus,
            latencyMs: record.latencyMs ?? 0,
            lastCheck: record.lastChecked,
            errorRate: record.errorRate ? Number(record.errorRate) : 0,
            consecutiveFailures: record.failsCount,
            message: record.lastError || metadata.message || undefined,
          });
        }
      }

      logger.info(`[ModelHealth] Loaded ${records.length} health records from database`);
    } catch (error: any) {
      logger.debug('[ModelHealth] Could not load health from DB:', error.message);
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Get all provider health statuses
   */
  getAllProviderHealth(): ProviderHealth[] {
    return Array.from(this.providerHealth.values());
  }

  /**
   * Check if a provider is available for routing
   */
  isProviderAvailable(provider: ProviderName): boolean {
    const health = this.providerHealth.get(provider);
    return health?.status === 'healthy' || health?.status === 'degraded';
  }

  /**
   * Get the best available provider for a model family
   */
  getBestProvider(preferredProvider: ProviderName, fallback: ProviderName): ProviderName {
    if (this.isProviderAvailable(preferredProvider)) {
      return preferredProvider;
    }
    if (this.isProviderAvailable(fallback)) {
      return fallback;
    }
    // Last resort: return preferred and let it fail
    return preferredProvider;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopMonitoring();
    this.removeAllListeners();
  }
}

// Singleton export
export const modelHealthService = new ModelHealthService();

// Start monitoring on load
modelHealthService.loadHealthFromDB().then(() => {
  modelHealthService.startMonitoring();
}).catch(() => {
  modelHealthService.startMonitoring();
});
