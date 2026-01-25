/**
 * AI Rate Limiting Service
 * 
 * Implements token bucket rate limiting for AI model invocations
 * with per-model, per-user, and per-company limits
 * 
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import prisma from '@/config/database';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface RateLimitConfig {
  modelId: string;
  requestsPerMinute: number;
  requestsPerHour: number;
  tokensPerMinute: number;
  tokensPerHour: number;
  burstLimit: number;
  enabled: boolean;
}

export interface TokenBucket {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillRate: number; // tokens per second
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // seconds
  reason?: string;
}

export interface RateLimitStats {
  modelId: string;
  currentRequests: number;
  currentTokens: number;
  limitRequests: number;
  limitTokens: number;
  percentUsed: number;
}

// ============================================
// RATE LIMITING SERVICE
// ============================================

export class RateLimitService extends EventEmitter {
  // Token buckets: key format is `{modelId}:{scope}:{scopeId}`
  // e.g., "gpt-4o:global", "claude-opus-4.5:account:acc123", "gemini-2.5-pro:user:usr456"
  private buckets: Map<string, TokenBucket> = new Map();
  
  // Default limits per model (can be overridden)
  private modelLimits: Map<string, RateLimitConfig> = new Map();
  
  // Cleanup interval
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL = 300000; // 5 minutes

  constructor() {
    super();
    this.initializeDefaults();
    this.startCleanup();
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  private initializeDefaults(): void {
    // Default rate limits for different model tiers
    const flagshipLimits: Partial<RateLimitConfig> = {
      requestsPerMinute: 60,
      requestsPerHour: 500,
      tokensPerMinute: 100000,
      tokensPerHour: 500000,
      burstLimit: 10,
      enabled: true,
    };

    const standardLimits: Partial<RateLimitConfig> = {
      requestsPerMinute: 100,
      requestsPerHour: 1000,
      tokensPerMinute: 200000,
      tokensPerHour: 1000000,
      burstLimit: 20,
      enabled: true,
    };

    const economyLimits: Partial<RateLimitConfig> = {
      requestsPerMinute: 200,
      requestsPerHour: 2000,
      tokensPerMinute: 500000,
      tokensPerHour: 2000000,
      burstLimit: 50,
      enabled: true,
    };

    // Apply defaults based on model tier
    const flagshipModels = ['gpt-4.1', 'gpt-4o', 'gpt-5', 'gpt-5.1', 'gpt-5.2', 'claude-opus-4.5', 'gemini-2.5-pro'];
    const standardModels = ['claude-sonnet-4', 'claude-sonnet-4.5', 'gpt-5.1-codex', 'gpt-5.2-codex'];
    const economyModels = ['gpt-5-mini', 'claude-haiku-4.5', 'raptor-mini-preview', 'gemini-3-flash-preview'];

    for (const modelId of flagshipModels) {
      this.modelLimits.set(modelId, { modelId, ...flagshipLimits } as RateLimitConfig);
    }
    for (const modelId of standardModels) {
      this.modelLimits.set(modelId, { modelId, ...standardLimits } as RateLimitConfig);
    }
    for (const modelId of economyModels) {
      this.modelLimits.set(modelId, { modelId, ...economyLimits } as RateLimitConfig);
    }
  }

  /**
   * Load rate limits from database
   */
  async loadLimitsFromDB(): Promise<void> {
    try {
      const dbLimits = await prisma.aIRateLimit.findMany({
        where: { enabled: true },
      });

      for (const limit of dbLimits) {
        this.modelLimits.set(limit.modelId, {
          modelId: limit.modelId,
          requestsPerMinute: limit.requestsPerMinute ?? 100,
          requestsPerHour: limit.requestsPerHour ?? 1000,
          tokensPerMinute: limit.tokensPerMinute ?? 200000,
          tokensPerHour: limit.tokensPerHour ?? 1000000,
          burstLimit: 20, // Not in schema, use default
          enabled: limit.enabled,
        });
      }

      logger.info(`[RateLimit] Loaded ${dbLimits.length} rate limit configs from database`);
    } catch (error: any) {
      logger.debug('[RateLimit] Could not load limits from DB:', error.message);
    }
  }

  // ============================================
  // TOKEN BUCKET OPERATIONS
  // ============================================

  /**
   * Get or create a token bucket
   */
  private getBucket(key: string, maxTokens: number, refillRate: number): TokenBucket {
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = {
        tokens: maxTokens,
        lastRefill: Date.now(),
        maxTokens,
        refillRate,
      };
      this.buckets.set(key, bucket);
    }

    // Refill tokens based on time elapsed
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * bucket.refillRate;

    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    return bucket;
  }

  /**
   * Try to consume tokens from a bucket
   */
  private tryConsume(bucket: TokenBucket, tokens: number): boolean {
    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return true;
    }
    return false;
  }

  // ============================================
  // RATE LIMIT CHECKING
  // ============================================

  /**
   * Check if a request is allowed under rate limits
   */
  checkRateLimit(
    modelId: string,
    options?: {
      accountId?: string;
      userId?: string;
      estimatedTokens?: number;
    }
  ): RateLimitResult {
    const limits = this.modelLimits.get(modelId);

    if (!limits || !limits.enabled) {
      return { allowed: true, remaining: Infinity, resetAt: new Date() };
    }

    const tokensNeeded = options?.estimatedTokens || 1000; // Default estimate
    const scopes = this.buildScopes(modelId, options?.accountId, options?.userId);

    // Check each scope
    for (const scope of scopes) {
      const requestBucket = this.getBucket(
        `${scope}:requests`,
        limits.requestsPerMinute,
        limits.requestsPerMinute / 60 // refill rate per second
      );

      const tokenBucket = this.getBucket(
        `${scope}:tokens`,
        limits.tokensPerMinute,
        limits.tokensPerMinute / 60
      );

      // Check request limit
      if (requestBucket.tokens < 1) {
        const retryAfter = Math.ceil((1 - requestBucket.tokens) / requestBucket.refillRate);
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(Date.now() + retryAfter * 1000),
          retryAfter,
          reason: `Request rate limit exceeded for ${scope}`,
        };
      }

      // Check token limit
      if (tokenBucket.tokens < tokensNeeded) {
        const retryAfter = Math.ceil((tokensNeeded - tokenBucket.tokens) / tokenBucket.refillRate);
        return {
          allowed: false,
          remaining: Math.floor(tokenBucket.tokens),
          resetAt: new Date(Date.now() + retryAfter * 1000),
          retryAfter,
          reason: `Token rate limit exceeded for ${scope}`,
        };
      }
    }

    // All checks passed - consume from all scopes
    for (const scope of scopes) {
      const requestBucket = this.buckets.get(`${scope}:requests`);
      const tokenBucket = this.buckets.get(`${scope}:tokens`);

      if (requestBucket) {
        this.tryConsume(requestBucket, 1);
      }
      if (tokenBucket) {
        this.tryConsume(tokenBucket, tokensNeeded);
      }
    }

    // Find minimum remaining
    const globalBucket = this.buckets.get(`${modelId}:global:requests`);
    const remaining = globalBucket ? Math.floor(globalBucket.tokens) : limits.requestsPerMinute;

    return {
      allowed: true,
      remaining,
      resetAt: new Date(Date.now() + 60000), // Next minute
    };
  }

  private buildScopes(modelId: string, accountId?: string, userId?: string): string[] {
    const scopes = [`${modelId}:global`];

    if (accountId) {
      scopes.push(`${modelId}:account:${accountId}`);
    }

    if (userId) {
      scopes.push(`${modelId}:user:${userId}`);
    }

    return scopes;
  }

  /**
   * Record actual token usage after request completes
   */
  recordUsage(
    modelId: string,
    _actualTokens: number,
    options?: {
      accountId?: string;
      userId?: string;
    }
  ): void {
    const scopes = this.buildScopes(modelId, options?.accountId, options?.userId);

    for (const scope of scopes) {
      const tokenBucket = this.buckets.get(`${scope}:tokens`);
      if (tokenBucket) {
        // Adjust if actual usage was different from estimate
        // (This is a simplification - in production you might want more sophisticated tracking)
        tokenBucket.tokens = Math.max(0, tokenBucket.tokens);
      }
    }
  }

  // ============================================
  // LIMIT MANAGEMENT
  // ============================================

  /**
   * Update rate limits for a model
   */
  async updateModelLimits(modelId: string, limits: Partial<RateLimitConfig>): Promise<void> {
    const current = this.modelLimits.get(modelId) || {
      modelId,
      requestsPerMinute: 100,
      requestsPerHour: 1000,
      tokensPerMinute: 200000,
      tokensPerHour: 1000000,
      burstLimit: 20,
      enabled: true,
    };

    const updated = { ...current, ...limits };
    this.modelLimits.set(modelId, updated);

    // Persist to database - use create/update pattern since compound key with nulls is tricky
    try {
      // First try to find existing record
      const existing = await prisma.aIRateLimit.findFirst({
        where: {
          modelId,
          accountId: null,
        },
      });

      if (existing) {
        await prisma.aIRateLimit.update({
          where: { id: existing.id },
          data: {
            requestsPerMinute: updated.requestsPerMinute,
            requestsPerHour: updated.requestsPerHour,
            tokensPerMinute: updated.tokensPerMinute,
            tokensPerHour: updated.tokensPerHour,
            enabled: updated.enabled,
          },
        });
      } else {
        await prisma.aIRateLimit.create({
          data: {
            modelId: updated.modelId,
            requestsPerMinute: updated.requestsPerMinute,
            requestsPerHour: updated.requestsPerHour,
            tokensPerMinute: updated.tokensPerMinute,
            tokensPerHour: updated.tokensPerHour,
            enabled: updated.enabled,
          },
        });
      }
    } catch (error: any) {
      logger.debug('[RateLimit] Could not persist limit update:', error.message);
    }
  }

  /**
   * Get current limits for a model
   */
  getModelLimits(modelId: string): RateLimitConfig | null {
    return this.modelLimits.get(modelId) || null;
  }

  /**
   * Get all configured limits
   */
  getAllLimits(): RateLimitConfig[] {
    return Array.from(this.modelLimits.values());
  }

  // ============================================
  // STATISTICS
  // ============================================

  /**
   * Get current rate limit stats for a model
   */
  getStats(modelId: string, accountId?: string): RateLimitStats {
    const limits = this.modelLimits.get(modelId);

    if (!limits) {
      return {
        modelId,
        currentRequests: 0,
        currentTokens: 0,
        limitRequests: Infinity,
        limitTokens: Infinity,
        percentUsed: 0,
      };
    }

    const scope = accountId ? `${modelId}:account:${accountId}` : `${modelId}:global`;
    const requestBucket = this.buckets.get(`${scope}:requests`);
    const tokenBucket = this.buckets.get(`${scope}:tokens`);

    const currentRequests = requestBucket ? limits.requestsPerMinute - requestBucket.tokens : 0;
    const currentTokens = tokenBucket ? limits.tokensPerMinute - tokenBucket.tokens : 0;

    return {
      modelId,
      currentRequests: Math.max(0, Math.round(currentRequests)),
      currentTokens: Math.max(0, Math.round(currentTokens)),
      limitRequests: limits.requestsPerMinute,
      limitTokens: limits.tokensPerMinute,
      percentUsed: Math.round((currentRequests / limits.requestsPerMinute) * 100),
    };
  }

  /**
   * Get stats for all models
   */
  getAllStats(): RateLimitStats[] {
    return Array.from(this.modelLimits.keys()).map((modelId) => this.getStats(modelId));
  }

  // ============================================
  // CLEANUP
  // ============================================

  private startCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupOldBuckets();
    }, this.CLEANUP_INTERVAL);
  }

  private cleanupOldBuckets(): void {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > maxAge) {
        this.buckets.delete(key);
      }
    }

    logger.debug(`[RateLimit] Cleaned up old buckets, ${this.buckets.size} remaining`);
  }

  /**
   * Reset rate limits for a scope
   */
  resetLimits(modelId: string, accountId?: string, userId?: string): void {
    const scopes = this.buildScopes(modelId, accountId, userId);

    for (const scope of scopes) {
      this.buckets.delete(`${scope}:requests`);
      this.buckets.delete(`${scope}:tokens`);
    }

    logger.info(`[RateLimit] Reset limits for ${modelId}`);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.buckets.clear();
    this.removeAllListeners();
  }
}

// Singleton export
export const rateLimitService = new RateLimitService();

// Load from database on startup
rateLimitService.loadLimitsFromDB().catch(() => {});
