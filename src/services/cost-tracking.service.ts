/**
 * AI Cost Tracking Service
 * 
 * Tracks and calculates costs for all AI model invocations
 * with per-user, per-company, and per-model aggregation
 * 
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import prisma from '@/config/database';
import { COPILOT_MODELS } from './copilot-models.service';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface CostEntry {
  id?: string;
  modelId: string;
  accountId?: string;
  userId?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  createdAt: Date;
}

export interface CostSummary {
  totalCost: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  requestCount: number;
  byModel: Record<string, { cost: number; tokens: number; requests: number }>;
  byDay?: Record<string, number>;
}

export interface CostAlert {
  type: 'daily_limit' | 'monthly_limit' | 'spike' | 'high_usage';
  threshold: number;
  currentValue: number;
  accountId?: string;
  userId?: string;
  message: string;
  triggeredAt: Date;
}

export interface CostLimits {
  dailyLimit?: number;
  monthlyLimit?: number;
  perRequestLimit?: number;
}

// ============================================
// COST TRACKING SERVICE
// ============================================

export class CostTrackingService extends EventEmitter {
  private inMemoryTotals: Map<string, { cost: number; tokens: number }> = new Map();
  private aggregationInterval: NodeJS.Timeout | null = null;
  private readonly AGGREGATION_INTERVAL = 300000; // 5 minutes

  constructor() {
    super();
    this.startAggregation();
  }

  // ============================================
  // COST CALCULATION
  // ============================================

  /**
   * Calculate cost for a model invocation
   */
  calculateCost(modelId: string, inputTokens: number, outputTokens: number): {
    inputCost: number;
    outputCost: number;
    totalCost: number;
  } {
    const model = COPILOT_MODELS[modelId];
    
    if (!model) {
      logger.warn(`[CostTracking] Unknown model: ${modelId}, using default pricing`);
      // Default pricing if model not found
      return {
        inputCost: (inputTokens / 1000000) * 1,
        outputCost: (outputTokens / 1000000) * 3,
        totalCost: (inputTokens / 1000000) * 1 + (outputTokens / 1000000) * 3,
      };
    }

    const inputCost = (inputTokens / 1000000) * model.costPerMillion.input;
    const outputCost = (outputTokens / 1000000) * model.costPerMillion.output;
    
    return {
      inputCost: Math.round(inputCost * 1000000) / 1000000, // 6 decimal precision
      outputCost: Math.round(outputCost * 1000000) / 1000000,
      totalCost: Math.round((inputCost + outputCost) * 1000000) / 1000000,
    };
  }

  // ============================================
  // COST RECORDING
  // ============================================

  /**
   * Record a cost entry for a model invocation
   */
  async recordCost(entry: {
    modelId: string;
    inputTokens: number;
    outputTokens: number;
    accountId?: string;
    userId?: string;
  }): Promise<CostEntry> {
    const { inputCost, outputCost, totalCost } = this.calculateCost(
      entry.modelId,
      entry.inputTokens,
      entry.outputTokens
    );

    const costEntry: CostEntry = {
      modelId: entry.modelId,
      accountId: entry.accountId,
      userId: entry.userId,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      totalTokens: entry.inputTokens + entry.outputTokens,
      inputCost,
      outputCost,
      totalCost,
      createdAt: new Date(),
    };

    // Update in-memory totals for quick aggregation
    this.updateInMemoryTotals(costEntry);

    // Persist to database
    await this.persistCostEntry(costEntry);

    // Check for alerts
    await this.checkCostAlerts(costEntry);

    // Emit event for real-time tracking
    this.emit('costRecorded', costEntry);

    return costEntry;
  }

  private updateInMemoryTotals(entry: CostEntry): void {
    // Update global totals
    const globalKey = 'global';
    const global = this.inMemoryTotals.get(globalKey) || { cost: 0, tokens: 0 };
    global.cost += entry.totalCost;
    global.tokens += entry.totalTokens;
    this.inMemoryTotals.set(globalKey, global);

    // Update per-account totals
    if (entry.accountId) {
      const accountKey = `account:${entry.accountId}`;
      const account = this.inMemoryTotals.get(accountKey) || { cost: 0, tokens: 0 };
      account.cost += entry.totalCost;
      account.tokens += entry.totalTokens;
      this.inMemoryTotals.set(accountKey, account);
    }

    // Update per-model totals
    const modelKey = `model:${entry.modelId}`;
    const model = this.inMemoryTotals.get(modelKey) || { cost: 0, tokens: 0 };
    model.cost += entry.totalCost;
    model.tokens += entry.totalTokens;
    this.inMemoryTotals.set(modelKey, model);
  }

  private async persistCostEntry(entry: CostEntry): Promise<void> {
    try {
      await prisma.aIModelUsage.create({
        data: {
          modelId: entry.modelId,
          agentId: 'system', // Required field
          accountId: entry.accountId,
          userId: entry.userId,
          inputTokens: entry.inputTokens,
          outputTokens: entry.outputTokens,
          latencyMs: 0, // Can be updated separately
          success: true,
        },
      });
    } catch (error: any) {
      logger.debug('[CostTracking] Could not persist cost entry:', error.message);
    }
  }

  // ============================================
  // COST QUERIES
  // ============================================

  /**
   * Get cost summary for a time period
   */
  async getCostSummary(options: {
    accountId?: string;
    userId?: string;
    modelId?: string;
    startDate?: Date;
    endDate?: Date;
    groupByDay?: boolean;
  }): Promise<CostSummary> {
    try {
      const where: any = {};
      
      if (options.accountId) where.accountId = options.accountId;
      if (options.userId) where.userId = options.userId;
      if (options.modelId) where.modelId = options.modelId;
      if (options.startDate || options.endDate) {
        where.createdAt = {};
        if (options.startDate) where.createdAt.gte = options.startDate;
        if (options.endDate) where.createdAt.lte = options.endDate;
      }

      const usageRecords = await prisma.aIModelUsage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      const byModel: Record<string, { cost: number; tokens: number; requests: number }> = {};
      const byDay: Record<string, number> = {};
      let totalCost = 0;
      let totalTokens = 0;
      let inputCost = 0;
      let outputCost = 0;

      for (const record of usageRecords) {
        const { inputCost: iCost, outputCost: oCost, totalCost: tCost } = this.calculateCost(
          record.modelId,
          record.inputTokens,
          record.outputTokens
        );

        totalCost += tCost;
        totalTokens += record.inputTokens + record.outputTokens;
        inputCost += iCost;
        outputCost += oCost;

        // By model
        if (!byModel[record.modelId]) {
          byModel[record.modelId] = { cost: 0, tokens: 0, requests: 0 };
        }
        byModel[record.modelId].cost += tCost;
        byModel[record.modelId].tokens += record.inputTokens + record.outputTokens;
        byModel[record.modelId].requests++;

        // By day
        if (options.groupByDay) {
          const dayKey = record.createdAt.toISOString().split('T')[0];
          byDay[dayKey] = (byDay[dayKey] || 0) + tCost;
        }
      }

      return {
        totalCost: Math.round(totalCost * 1000000) / 1000000,
        totalTokens,
        inputCost: Math.round(inputCost * 1000000) / 1000000,
        outputCost: Math.round(outputCost * 1000000) / 1000000,
        requestCount: usageRecords.length,
        byModel,
        byDay: options.groupByDay ? byDay : undefined,
      };
    } catch (error: any) {
      logger.debug('[CostTracking] Cost summary query failed:', error.message);
      return {
        totalCost: 0,
        totalTokens: 0,
        inputCost: 0,
        outputCost: 0,
        requestCount: 0,
        byModel: {},
      };
    }
  }

  /**
   * Get daily cost for an account
   */
  async getDailyCost(accountId?: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const summary = await this.getCostSummary({
      accountId,
      startDate: today,
    });

    return summary.totalCost;
  }

  /**
   * Get monthly cost for an account
   */
  async getMonthlyCost(accountId?: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const summary = await this.getCostSummary({
      accountId,
      startDate: startOfMonth,
    });

    return summary.totalCost;
  }

  // ============================================
  // COST ALERTS
  // ============================================

  private async checkCostAlerts(entry: CostEntry): Promise<void> {
    if (!entry.accountId) return;

    try {
      // Get company preferences with cost limits
      const preferences = await prisma.companyAIPreferences.findUnique({
        where: { accountId: entry.accountId },
      });

      if (!preferences) return;

      const dailyCost = await this.getDailyCost(entry.accountId);
      const monthlyCost = await this.getMonthlyCost(entry.accountId);

      // Check daily limit
      if (preferences.costBudgetDaily && dailyCost > Number(preferences.costBudgetDaily)) {
        const alert: CostAlert = {
          type: 'daily_limit',
          threshold: Number(preferences.costBudgetDaily),
          currentValue: dailyCost,
          accountId: entry.accountId,
          message: `Daily cost limit exceeded: $${dailyCost.toFixed(4)} / $${Number(preferences.costBudgetDaily).toFixed(2)}`,
          triggeredAt: new Date(),
        };
        this.emit('costAlert', alert);
        logger.warn(`[CostTracking] ${alert.message}`);
      }

      // Check monthly limit
      if (preferences.costBudgetMonthly && monthlyCost > Number(preferences.costBudgetMonthly)) {
        const alert: CostAlert = {
          type: 'monthly_limit',
          threshold: Number(preferences.costBudgetMonthly),
          currentValue: monthlyCost,
          accountId: entry.accountId,
          message: `Monthly cost limit exceeded: $${monthlyCost.toFixed(4)} / $${Number(preferences.costBudgetMonthly).toFixed(2)}`,
          triggeredAt: new Date(),
        };
        this.emit('costAlert', alert);
        logger.warn(`[CostTracking] ${alert.message}`);
      }
    } catch (error: any) {
      logger.debug('[CostTracking] Alert check failed:', error.message);
    }
  }

  // ============================================
  // AGGREGATION
  // ============================================

  /**
   * Start periodic cost aggregation
   */
  private startAggregation(): void {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }

    this.aggregationInterval = setInterval(() => {
      this.aggregateCosts();
    }, this.AGGREGATION_INTERVAL);

    logger.debug('[CostTracking] Aggregation started');
  }

  /**
   * Aggregate costs and persist to tracking table
   */
  private async aggregateCosts(): Promise<void> {
    try {
      const today = new Date();
      const dateKey = today.toISOString().split('T')[0];

      // Get current day's summary
      const summary = await this.getCostSummary({
        startDate: new Date(dateKey),
      });

      // Persist to aggregation table
      // Note: AICostTracking uses a compound unique key (modelId, accountId, period, periodStart)
      // For simplicity, we'll just create new entries or skip if exists
      try {
        await prisma.aICostTracking.create({
          data: {
            modelId: 'all',
            accountId: 'system', // Required field
            period: 'daily',
            periodStart: new Date(dateKey),
            periodEnd: new Date(new Date(dateKey).getTime() + 24 * 60 * 60 * 1000),
            totalCost: summary.totalCost,
            inputTokens: Math.round(summary.totalTokens * 0.6),
            outputTokens: Math.round(summary.totalTokens * 0.4),
            requestCount: summary.requestCount,
          },
        });
      } catch (error: any) {
        // If already exists, update it
        if (error.code === 'P2002') {
          await prisma.aICostTracking.updateMany({
            where: {
              modelId: 'all',
              accountId: 'system',
              period: 'daily',
              periodStart: new Date(dateKey),
            },
            data: {
              totalCost: summary.totalCost,
              inputTokens: Math.round(summary.totalTokens * 0.6),
              outputTokens: Math.round(summary.totalTokens * 0.4),
              requestCount: summary.requestCount,
            },
          });
        }
      }

      logger.debug(`[CostTracking] Aggregated daily costs: $${summary.totalCost.toFixed(4)}`);
    } catch (error: any) {
      logger.debug('[CostTracking] Aggregation failed:', error.message);
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Get real-time in-memory totals
   */
  getRealtimeTotals(): { global: { cost: number; tokens: number }; byModel: Record<string, { cost: number; tokens: number }> } {
    const global = this.inMemoryTotals.get('global') || { cost: 0, tokens: 0 };
    const byModel: Record<string, { cost: number; tokens: number }> = {};

    this.inMemoryTotals.forEach((value, key) => {
      if (key.startsWith('model:')) {
        byModel[key.replace('model:', '')] = value;
      }
    });

    return { global, byModel };
  }

  /**
   * Get model pricing info
   */
  getModelPricing(modelId: string): { inputPerMillion: number; outputPerMillion: number } | null {
    const model = COPILOT_MODELS[modelId];
    if (!model) return null;

    return {
      inputPerMillion: model.costPerMillion.input,
      outputPerMillion: model.costPerMillion.output,
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }
    this.removeAllListeners();
  }
}

// Singleton export
export const costTrackingService = new CostTrackingService();
