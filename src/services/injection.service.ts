/**
 * IAI Injection Service
 * 
 * Comprehensive code injection system for IAI instances.
 * Manages containers, patterns, and injection execution.
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

const prisma = new PrismaClient();

// Types
export interface InjectionContainer {
  id: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  color: string | null;
  isActive: boolean;
  isDefault: boolean;
  priority: number;
  config: Record<string, any>;
  metadata: Record<string, any>;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  patterns?: InjectionPattern[];
}

export interface InjectionPattern {
  id: string;
  containerId: string;
  name: string;
  description: string | null;
  code: string;
  codeType: string;
  version: string;
  isDefault: boolean;
  isActive: boolean;
  priority: number;
  weight: number;
  timeout: number;
  retryCount: number;
  failureAction: string;
  preConditions: any[];
  postActions: any[];
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  avgExecutionTime: number;
  lastExecutedAt: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastError: string | null;
  tags: string[];
  metadata: Record<string, any>;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InjectionResult {
  success: boolean;
  containerId: string;
  patternId: string;
  patternName: string;
  executionTimeMs: number;
  output?: any;
  error?: string;
}

export interface InjectionOptions {
  containerId?: string;
  patternId?: string;
  forceDefault?: boolean;
  selectionStrategy?: 'random' | 'weighted' | 'priority' | 'round-robin';
  input?: Record<string, any>;
  timeout?: number;
  iaiInstanceId?: string;
  missionId?: string;
  taskId?: string;
}

// Service Events
class InjectionEventEmitter extends EventEmitter {}
export const injectionEvents = new InjectionEventEmitter();

/**
 * Injection Service Class
 */
class InjectionService {
  private static instance: InjectionService;
  private roundRobinIndex: Map<string, number> = new Map();

  private constructor() {
    logger.info('[InjectionService] Initialized');
  }

  static getInstance(): InjectionService {
    if (!InjectionService.instance) {
      InjectionService.instance = new InjectionService();
    }
    return InjectionService.instance;
  }

  // ============================================
  // Container Management
  // ============================================

  async createContainer(data: {
    name: string;
    description?: string;
    category?: string;
    icon?: string;
    color?: string;
    isActive?: boolean;
    isDefault?: boolean;
    priority?: number;
    config?: Record<string, any>;
    metadata?: Record<string, any>;
    createdBy?: string;
  }): Promise<InjectionContainer> {
    try {
      // If setting as default, unset other defaults in same category
      if (data.isDefault) {
        await prisma.injectionContainer.updateMany({
          where: { category: data.category || 'custom', isDefault: true },
          data: { isDefault: false }
        });
      }

      const container = await prisma.injectionContainer.create({
        data: {
          name: data.name,
          description: data.description,
          category: data.category || 'custom',
          icon: data.icon,
          color: data.color,
          isActive: data.isActive ?? true,
          isDefault: data.isDefault ?? false,
          priority: data.priority ?? 0,
          config: data.config || {},
          metadata: data.metadata || {},
          createdBy: data.createdBy
        }
      });

      logger.info(`[InjectionService] Created container: ${container.name}`);
      injectionEvents.emit('container:created', container);
      return container as InjectionContainer;
    } catch (error: any) {
      logger.error('[InjectionService] Failed to create container:', error);
      throw error;
    }
  }

  async getContainer(id: string, includePatterns = true): Promise<InjectionContainer | null> {
    const container = await prisma.injectionContainer.findUnique({
      where: { id },
      include: includePatterns ? { patterns: { where: { isActive: true }, orderBy: { priority: 'desc' } } } : undefined
    });
    return container as InjectionContainer | null;
  }

  async getContainerByName(name: string, includePatterns = true): Promise<InjectionContainer | null> {
    const container = await prisma.injectionContainer.findUnique({
      where: { name },
      include: includePatterns ? { patterns: { where: { isActive: true }, orderBy: { priority: 'desc' } } } : undefined
    });
    return container as InjectionContainer | null;
  }

  async listContainers(options?: {
    category?: string;
    isActive?: boolean;
    includePatterns?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ containers: InjectionContainer[]; total: number }> {
    const where: any = {};
    if (options?.category) where.category = options.category;
    if (options?.isActive !== undefined) where.isActive = options.isActive;

    const [containers, total] = await Promise.all([
      prisma.injectionContainer.findMany({
        where,
        include: options?.includePatterns ? { 
          patterns: { 
            where: { isActive: true }, 
            orderBy: { priority: 'desc' } 
          } 
        } : undefined,
        orderBy: [{ isDefault: 'desc' }, { priority: 'desc' }, { name: 'asc' }],
        take: options?.limit,
        skip: options?.offset
      }),
      prisma.injectionContainer.count({ where })
    ]);

    return { containers: containers as InjectionContainer[], total };
  }

  async updateContainer(id: string, data: Partial<{
    name: string;
    description: string;
    category: string;
    icon: string;
    color: string;
    isActive: boolean;
    isDefault: boolean;
    priority: number;
    config: Record<string, any>;
    metadata: Record<string, any>;
  }>): Promise<InjectionContainer> {
    // If setting as default, unset other defaults in same category
    if (data.isDefault) {
      const existing = await this.getContainer(id, false);
      if (existing) {
        await prisma.injectionContainer.updateMany({
          where: { category: data.category || existing.category, isDefault: true, NOT: { id } },
          data: { isDefault: false }
        });
      }
    }

    const container = await prisma.injectionContainer.update({
      where: { id },
      data
    });

    logger.info(`[InjectionService] Updated container: ${container.name}`);
    injectionEvents.emit('container:updated', container);
    return container as InjectionContainer;
  }

  async deleteContainer(id: string): Promise<void> {
    const container = await this.getContainer(id, false);
    if (container) {
      await prisma.injectionContainer.delete({ where: { id } });
      logger.info(`[InjectionService] Deleted container: ${container.name}`);
      injectionEvents.emit('container:deleted', container);
    }
  }

  // ============================================
  // Pattern Management
  // ============================================

  async createPattern(data: {
    containerId: string;
    name: string;
    description?: string;
    code: string;
    codeType?: string;
    version?: string;
    isDefault?: boolean;
    isActive?: boolean;
    priority?: number;
    weight?: number;
    timeout?: number;
    retryCount?: number;
    failureAction?: string;
    preConditions?: any[];
    postActions?: any[];
    tags?: string[];
    metadata?: Record<string, any>;
    createdBy?: string;
  }): Promise<InjectionPattern> {
    try {
      // If setting as default, unset other defaults in same container
      if (data.isDefault) {
        await prisma.injectionPattern.updateMany({
          where: { containerId: data.containerId, isDefault: true },
          data: { isDefault: false }
        });
      }

      const pattern = await prisma.injectionPattern.create({
        data: {
          containerId: data.containerId,
          name: data.name,
          description: data.description,
          code: data.code,
          codeType: data.codeType || 'javascript',
          version: data.version || '1.0.0',
          isDefault: data.isDefault ?? false,
          isActive: data.isActive ?? true,
          priority: data.priority ?? 0,
          weight: data.weight ?? 100,
          timeout: data.timeout ?? 30000,
          retryCount: data.retryCount ?? 3,
          failureAction: data.failureAction || 'skip',
          preConditions: data.preConditions || [],
          postActions: data.postActions || [],
          tags: data.tags || [],
          metadata: data.metadata || {},
          createdBy: data.createdBy
        }
      });

      logger.info(`[InjectionService] Created pattern: ${pattern.name} in container ${data.containerId}`);
      injectionEvents.emit('pattern:created', pattern);
      return pattern as InjectionPattern;
    } catch (error: any) {
      logger.error('[InjectionService] Failed to create pattern:', error);
      throw error;
    }
  }

  async getPattern(id: string): Promise<InjectionPattern | null> {
    const pattern = await prisma.injectionPattern.findUnique({
      where: { id }
    });
    return pattern as InjectionPattern | null;
  }

  async listPatterns(options?: {
    containerId?: string;
    isActive?: boolean;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{ patterns: InjectionPattern[]; total: number }> {
    const where: any = {};
    if (options?.containerId) where.containerId = options.containerId;
    if (options?.isActive !== undefined) where.isActive = options.isActive;
    if (options?.tags && options.tags.length > 0) {
      where.tags = { hasSome: options.tags };
    }

    const [patterns, total] = await Promise.all([
      prisma.injectionPattern.findMany({
        where,
        orderBy: [{ isDefault: 'desc' }, { priority: 'desc' }, { weight: 'desc' }],
        take: options?.limit,
        skip: options?.offset
      }),
      prisma.injectionPattern.count({ where })
    ]);

    return { patterns: patterns as InjectionPattern[], total };
  }

  async updatePattern(id: string, data: Partial<{
    name: string;
    description: string;
    code: string;
    codeType: string;
    version: string;
    isDefault: boolean;
    isActive: boolean;
    priority: number;
    weight: number;
    timeout: number;
    retryCount: number;
    failureAction: string;
    preConditions: any[];
    postActions: any[];
    tags: string[];
    metadata: Record<string, any>;
  }>): Promise<InjectionPattern> {
    // If setting as default, unset other defaults in same container
    if (data.isDefault) {
      const existing = await this.getPattern(id);
      if (existing) {
        await prisma.injectionPattern.updateMany({
          where: { containerId: existing.containerId, isDefault: true, NOT: { id } },
          data: { isDefault: false }
        });
      }
    }

    const pattern = await prisma.injectionPattern.update({
      where: { id },
      data
    });

    logger.info(`[InjectionService] Updated pattern: ${pattern.name}`);
    injectionEvents.emit('pattern:updated', pattern);
    return pattern as InjectionPattern;
  }

  async deletePattern(id: string): Promise<void> {
    const pattern = await this.getPattern(id);
    if (pattern) {
      await prisma.injectionPattern.delete({ where: { id } });
      logger.info(`[InjectionService] Deleted pattern: ${pattern.name}`);
      injectionEvents.emit('pattern:deleted', pattern);
    }
  }

  // ============================================
  // Injection Execution
  // ============================================

  /**
   * Select a pattern from a container based on the selection strategy
   */
  async selectPattern(containerId: string, strategy: 'random' | 'weighted' | 'priority' | 'round-robin' = 'random'): Promise<InjectionPattern | null> {
    const patterns = await prisma.injectionPattern.findMany({
      where: { containerId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { priority: 'desc' }]
    });

    if (patterns.length === 0) return null;

    // If only one pattern, return it
    if (patterns.length === 1) return patterns[0] as InjectionPattern;

    // Check for default pattern first (if forceDefault would be used)
    const defaultPattern = patterns.find(p => p.isDefault);

    switch (strategy) {
      case 'priority':
        // Return highest priority (already sorted)
        return patterns[0] as InjectionPattern;

      case 'weighted':
        // Weighted random selection
        const totalWeight = patterns.reduce((sum, p) => sum + p.weight, 0);
        let random = Math.random() * totalWeight;
        for (const pattern of patterns) {
          random -= pattern.weight;
          if (random <= 0) return pattern as InjectionPattern;
        }
        return patterns[0] as InjectionPattern;

      case 'round-robin':
        // Round-robin selection
        const currentIndex = this.roundRobinIndex.get(containerId) || 0;
        const selected = patterns[currentIndex % patterns.length];
        this.roundRobinIndex.set(containerId, currentIndex + 1);
        return selected as InjectionPattern;

      case 'random':
      default:
        // Pure random (but default pattern if it exists gets slight preference)
        if (defaultPattern && Math.random() < 0.3) {
          return defaultPattern as InjectionPattern;
        }
        const randomIndex = Math.floor(Math.random() * patterns.length);
        return patterns[randomIndex] as InjectionPattern;
    }
  }

  /**
   * Select a pattern from a container by container name (USM support)
   * Used for Ultra Speed Mode hot-swap from specific containers
   */
  async selectPatternFromContainerByName(
    containerName: string, 
    strategy: 'random' | 'weighted' | 'priority' | 'round-robin' = 'weighted'
  ): Promise<{ pattern: InjectionPattern | null; container: InjectionContainer | null }> {
    const container = await this.getContainerByName(containerName, false);
    
    if (!container || !container.isActive) {
      logger.warn(`[InjectionService] Container "${containerName}" not found or inactive`);
      return { pattern: null, container: null };
    }

    const pattern = await this.selectPattern(container.id, strategy);
    
    if (pattern) {
      logger.info(`[InjectionService] Selected pattern "${pattern.name}" from container "${containerName}" using ${strategy} strategy`);
    }

    return { pattern, container };
  }

  /**
   * Get all patterns from USM (Ultra Speed Mode) container for hot-swap
   */
  async getUSMPatterns(): Promise<{ patterns: InjectionPattern[]; container: InjectionContainer | null }> {
    const container = await this.getContainerByName('IAI Soldiers USM', true);
    
    if (!container || !container.isActive) {
      logger.warn('[InjectionService] USM container not found or inactive');
      return { patterns: [], container: null };
    }

    const patterns = container.patterns || [];
    logger.info(`[InjectionService] Found ${patterns.length} USM patterns for hot-swap`);
    
    return { patterns: patterns as InjectionPattern[], container };
  }

  /**
   * Select best pattern for Ultra Speed Mode using weighted random
   * Factors in success rate, execution time, and weight
   */
  async selectUSMPattern(): Promise<{ pattern: InjectionPattern | null; container: InjectionContainer | null }> {
    const { patterns, container } = await this.getUSMPatterns();
    
    if (patterns.length === 0) {
      // Fallback to FBM-Official-P1 if no USM patterns exist
      logger.warn('[InjectionService] No USM patterns found, falling back to FBM-Official-P1');
      const fallbackPattern = await prisma.injectionPattern.findFirst({
        where: { name: 'FBM-Official-P1', isActive: true }
      });
      if (fallbackPattern) {
        const fallbackContainer = await this.getContainer(fallbackPattern.containerId, false);
        return { pattern: fallbackPattern as InjectionPattern, container: fallbackContainer };
      }
      return { pattern: null, container: null };
    }

    // Weighted selection based on successCount and weight
    const activePatterns = patterns.filter(p => p.isActive);
    if (activePatterns.length === 0) {
      return { pattern: null, container };
    }

    // Calculate weights: base weight + (successCount * 10) - (failureCount * 5)
    const weightedPatterns = activePatterns.map(p => ({
      pattern: p,
      calculatedWeight: Math.max(1, p.weight + (p.successCount * 10) - (p.failureCount * 5))
    }));

    const totalWeight = weightedPatterns.reduce((sum, wp) => sum + wp.calculatedWeight, 0);
    let random = Math.random() * totalWeight;

    for (const wp of weightedPatterns) {
      random -= wp.calculatedWeight;
      if (random <= 0) {
        logger.info(`[InjectionService] USM hot-swap selected: ${wp.pattern.name} (weight: ${wp.calculatedWeight})`);
        return { pattern: wp.pattern, container };
      }
    }

    return { pattern: activePatterns[0], container };
  }

  /**
   * Execute an injection
   */
  async inject(options: InjectionOptions): Promise<InjectionResult> {
    const startTime = Date.now();
    let pattern: InjectionPattern | null = null;
    let container: InjectionContainer | null = null;

    try {
      // Get pattern - either specified or selected
      if (options.patternId) {
        pattern = await this.getPattern(options.patternId);
        if (pattern) {
          container = await this.getContainer(pattern.containerId, false);
        }
      } else if (options.containerId) {
        container = await this.getContainer(options.containerId, false);
        if (container && container.isActive) {
          if (options.forceDefault) {
            const patterns = await prisma.injectionPattern.findMany({
              where: { containerId: options.containerId, isDefault: true, isActive: true }
            });
            pattern = patterns[0] as InjectionPattern || null;
          } else {
            pattern = await this.selectPattern(options.containerId, options.selectionStrategy);
          }
        }
      } else {
        // Select from default container
        const defaultContainers = await prisma.injectionContainer.findMany({
          where: { isDefault: true, isActive: true }
        });
        if (defaultContainers.length > 0) {
          container = defaultContainers[0] as InjectionContainer;
          pattern = await this.selectPattern(container.id, options.selectionStrategy);
        }
      }

      if (!pattern || !container) {
        return {
          success: false,
          containerId: options.containerId || '',
          patternId: options.patternId || '',
          patternName: '',
          executionTimeMs: Date.now() - startTime,
          error: 'No active pattern found for injection'
        };
      }

      // Create injection log
      const log = await prisma.injectionLog.create({
        data: {
          containerId: container.id,
          patternId: pattern.id,
          iaiInstanceId: options.iaiInstanceId,
          missionId: options.missionId,
          taskId: options.taskId,
          status: 'running',
          input: options.input || {}
        }
      });

      // Execute the pattern
      let output: any;
      let error: string | undefined;
      let success = false;

      try {
        output = await this.executePattern(pattern, options.input, options.timeout);
        success = true;
      } catch (execError: any) {
        error = execError.message;
        logger.error(`[InjectionService] Pattern execution failed: ${pattern.name}`, execError);
      }

      const executionTimeMs = Date.now() - startTime;

      // Update injection log
      await prisma.injectionLog.update({
        where: { id: log.id },
        data: {
          status: success ? 'success' : 'failure',
          executionTimeMs,
          output: output || null,
          error,
          completedAt: new Date()
        }
      });

      // Update pattern statistics
      await this.updatePatternStats(pattern.id, success, executionTimeMs, error);

      const result: InjectionResult = {
        success,
        containerId: container.id,
        patternId: pattern.id,
        patternName: pattern.name,
        executionTimeMs,
        output,
        error
      };

      injectionEvents.emit('injection:completed', result);
      return result;
    } catch (error: any) {
      logger.error('[InjectionService] Injection failed:', error);
      return {
        success: false,
        containerId: container?.id || options.containerId || '',
        patternId: pattern?.id || options.patternId || '',
        patternName: pattern?.name || '',
        executionTimeMs: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Execute the actual pattern code
   */
  private async executePattern(pattern: InjectionPattern, input?: Record<string, any>, timeout?: number): Promise<any> {
    const executeTimeout = timeout || pattern.timeout;

    // Create a sandboxed execution environment
    const sandboxedExec = new Promise(async (resolve, reject) => {
      try {
        // Parse the code based on type
        switch (pattern.codeType) {
          case 'json':
            // JSON patterns are data-only, return parsed
            resolve(JSON.parse(pattern.code));
            break;

          case 'workflow':
            // Workflow patterns define steps
            const workflow = JSON.parse(pattern.code);
            resolve(workflow);
            break;

          case 'javascript':
          default:
            // JavaScript patterns - create a function and execute
            // SECURITY: In production, use vm2 or similar for true sandboxing
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const fn = new AsyncFunction('input', 'context', pattern.code);
            
            const context = {
              logger,
              patternId: pattern.id,
              patternName: pattern.name,
              containerId: pattern.containerId,
              timestamp: new Date().toISOString()
            };

            const result = await fn(input || {}, context);
            resolve(result);
            break;
        }
      } catch (error) {
        reject(error);
      }
    });

    // Apply timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Pattern execution timed out after ${executeTimeout}ms`)), executeTimeout);
    });

    return Promise.race([sandboxedExec, timeoutPromise]);
  }

  /**
   * Update pattern statistics after execution
   */
  private async updatePatternStats(patternId: string, success: boolean, executionTimeMs: number, error?: string): Promise<void> {
    const pattern = await this.getPattern(patternId);
    if (!pattern) return;

    const newTotalExecutions = pattern.totalExecutions + 1;
    const newSuccessCount = pattern.successCount + (success ? 1 : 0);
    const newFailureCount = pattern.failureCount + (success ? 0 : 1);
    
    // Calculate new average execution time
    const newAvgExecutionTime = Math.round(
      (pattern.avgExecutionTime * pattern.totalExecutions + executionTimeMs) / newTotalExecutions
    );

    await prisma.injectionPattern.update({
      where: { id: patternId },
      data: {
        totalExecutions: newTotalExecutions,
        successCount: newSuccessCount,
        failureCount: newFailureCount,
        avgExecutionTime: newAvgExecutionTime,
        lastExecutedAt: new Date(),
        lastSuccessAt: success ? new Date() : undefined,
        lastFailureAt: success ? undefined : new Date(),
        lastError: success ? null : error
      }
    });
  }

  // ============================================
  // Statistics & Analytics
  // ============================================

  async getInjectionStats(options?: {
    containerId?: string;
    patternId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    totalContainers: number;
    activeContainers: number;
    totalPatterns: number;
    activePatterns: number;
    totalInjections: number;
    successRate: number;
    avgDuration: number;
    recentInjections: any[];
    topContainers: any[];
    topPatterns: { id: string; name: string; executions: number; successRate: number }[];
    recentFailures: { patternName: string; error: string; timestamp: Date }[];
  }> {
    const where: any = {};
    if (options?.containerId) where.containerId = options.containerId;
    if (options?.patternId) where.patternId = options.patternId;
    if (options?.startDate || options?.endDate) {
      where.startedAt = {};
      if (options.startDate) where.startedAt.gte = options.startDate;
      if (options.endDate) where.startedAt.lte = options.endDate;
    }

    // Fetch containers, patterns, and logs in parallel
    const [containers, allPatterns, logs] = await Promise.all([
      prisma.injectionContainer.findMany(),
      prisma.injectionPattern.findMany({
        orderBy: { totalExecutions: 'desc' }
      }),
      prisma.injectionLog.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: 1000
      })
    ]);

    // Container stats
    const totalContainers = containers.length;
    const activeContainers = containers.filter(c => c.isActive).length;

    // Pattern stats
    const totalPatterns = allPatterns.length;
    const activePatterns = allPatterns.filter(p => p.isActive).length;

    // Injection stats
    const totalInjections = logs.length;
    const successCount = logs.filter(l => l.status === 'success').length;
    const successRate = totalInjections > 0 ? (successCount / totalInjections) * 100 : 0;
    const avgDuration = totalInjections > 0 
      ? logs.reduce((sum, l) => sum + (l.executionTimeMs || 0), 0) / totalInjections 
      : 0;

    // Top patterns
    const topPatterns = allPatterns.slice(0, 10).map(p => ({
      id: p.id,
      name: p.name,
      executions: p.totalExecutions,
      successRate: p.totalExecutions > 0 ? (p.successCount / p.totalExecutions) * 100 : 0
    }));

    // Top containers
    const topContainers = containers
      .map(c => {
        const containerLogs = logs.filter(l => l.containerId === c.id);
        const containerSuccess = containerLogs.filter(l => l.status === 'success').length;
        return {
          id: c.id,
          name: c.name,
          executions: containerLogs.length,
          successRate: containerLogs.length > 0 ? (containerSuccess / containerLogs.length) * 100 : 0
        };
      })
      .sort((a, b) => b.executions - a.executions)
      .slice(0, 5);

    // Recent injections (last 10)
    const recentInjections = logs.slice(0, 10).map(l => ({
      id: l.id,
      patternId: l.patternId,
      containerId: l.containerId,
      status: l.status,
      executionTimeMs: l.executionTimeMs,
      startedAt: l.startedAt
    }));

    // Recent failures
    const recentFailures = logs
      .filter(l => l.status === 'failure')
      .slice(0, 10)
      .map(l => ({
        patternName: allPatterns.find(p => p.id === l.patternId)?.name || 'Unknown',
        error: l.error || 'Unknown error',
        timestamp: l.startedAt
      }));

    return {
      totalContainers,
      activeContainers,
      totalPatterns,
      activePatterns,
      totalInjections,
      successRate: Math.round(successRate * 100) / 100,
      avgDuration: Math.round(avgDuration),
      recentInjections,
      topContainers,
      topPatterns,
      recentFailures
    };
  }

  async getContainerStats(containerId: string): Promise<{
    totalPatterns: number;
    activePatterns: number;
    totalExecutions: number;
    successRate: number;
    avgExecutionTime: number;
  }> {
    const [patterns, logs] = await Promise.all([
      prisma.injectionPattern.findMany({ where: { containerId } }),
      prisma.injectionLog.findMany({ 
        where: { containerId },
        orderBy: { startedAt: 'desc' },
        take: 500
      })
    ]);

    const activePatterns = patterns.filter(p => p.isActive).length;
    const totalExecutions = logs.length;
    const successCount = logs.filter(l => l.status === 'success').length;
    const successRate = totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0;
    const avgExecutionTime = totalExecutions > 0 
      ? logs.reduce((sum, l) => sum + (l.executionTimeMs || 0), 0) / totalExecutions 
      : 0;

    return {
      totalPatterns: patterns.length,
      activePatterns,
      totalExecutions,
      successRate: Math.round(successRate * 100) / 100,
      avgExecutionTime: Math.round(avgExecutionTime)
    };
  }
}

// Export singleton instance
export const injectionService = InjectionService.getInstance();
export default injectionService;
