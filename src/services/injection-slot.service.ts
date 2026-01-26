/**
 * IAI Injection Slot
 * 
 * The injection slot is a runtime mechanism that allows IAI instances
 * to dynamically load, execute, and swap behavior patterns.
 * 
 * Key Features:
 * - Hot-swappable patterns at birth or runtime
 * - Pattern validation before injection
 * - Execution context isolation
 * - Performance tracking per slot
 */

import { logger } from '../utils/logger';
import { injectionService, InjectionPattern, InjectionContainer, InjectionResult } from './injection.service';

export interface InjectionSlotConfig {
  containerId?: string;
  containerName?: string;
  patternId?: string;
  patternName?: string;
  selectionStrategy?: 'default' | 'random' | 'weighted' | 'priority';
  autoLoad?: boolean;
  timeout?: number;
  enableFallback?: boolean;
  fallbackPatternId?: string;
}

export interface SlotState {
  isLoaded: boolean;
  isActive: boolean;
  containerId: string | null;
  containerName: string | null;
  patternId: string | null;
  patternName: string | null;
  patternVersion: string | null;
  loadedAt: Date | null;
  lastExecutedAt: Date | null;
  executionCount: number;
  successCount: number;
  failureCount: number;
  avgExecutionTimeMs: number;
}

export interface SlotExecutionContext {
  iaiInstanceId: string;
  missionId?: string;
  taskId?: string;
  vehicleData?: Record<string, any>;
  accountId?: string;
  sessionData?: Record<string, any>;
  customInput?: Record<string, any>;
}

/**
 * IAI Injection Slot Class
 * 
 * Each IAI instance has one or more slots that can be loaded with patterns
 */
export class InjectionSlot {
  private slotId: string;
  private iaiInstanceId: string;
  private config: InjectionSlotConfig;
  private state: SlotState;
  private loadedPattern: InjectionPattern | null = null;
  private loadedContainer: InjectionContainer | null = null;
  private injectionSvc: typeof injectionService;

  constructor(iaiInstanceId: string, config: InjectionSlotConfig = {}) {
    this.slotId = `slot_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    this.iaiInstanceId = iaiInstanceId;
    this.config = {
      selectionStrategy: 'default',
      autoLoad: true,
      timeout: 30000,
      enableFallback: true,
      ...config
    };
    this.state = {
      isLoaded: false,
      isActive: false,
      containerId: null,
      containerName: null,
      patternId: null,
      patternName: null,
      patternVersion: null,
      loadedAt: null,
      lastExecutedAt: null,
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      avgExecutionTimeMs: 0
    };
    this.injectionSvc = injectionService;

    logger.info(`[InjectionSlot] Created slot ${this.slotId} for IAI ${iaiInstanceId}`);

    // Auto-load if configured
    if (this.config.autoLoad) {
      this.load().catch(err => {
        logger.warn(`[InjectionSlot] Auto-load failed for ${this.slotId}:`, err.message);
      });
    }
  }

  /**
   * Load a pattern into the slot
   */
  async load(options?: {
    containerId?: string;
    containerName?: string;
    patternId?: string;
    patternName?: string;
    forceReload?: boolean;
  }): Promise<boolean> {
    try {
      // Use provided options or fall back to config
      const targetContainerId = options?.containerId || this.config.containerId;
      const targetContainerName = options?.containerName || this.config.containerName;
      const targetPatternId = options?.patternId || this.config.patternId;
      const targetPatternName = options?.patternName || this.config.patternName;

      // If already loaded and not forcing reload, skip
      if (this.state.isLoaded && !options?.forceReload) {
        if (this.state.patternId === targetPatternId) {
          logger.debug(`[InjectionSlot] Pattern already loaded in slot ${this.slotId}`);
          return true;
        }
      }

      // Get container first
      let container: InjectionContainer | null = null;
      
      if (targetContainerId) {
        container = await this.injectionSvc.getContainer(targetContainerId);
      } else if (targetContainerName) {
        container = await this.injectionSvc.getContainerByName(targetContainerName);
      } else {
        // Get default container
        const { containers } = await this.injectionSvc.listContainers({
          isActive: true,
          includePatterns: true
        });
        container = containers.find((cont: InjectionContainer) => cont.isDefault) || containers[0];
      }

      if (!container) {
        logger.warn(`[InjectionSlot] No container found for slot ${this.slotId}`);
        return false;
      }

      this.loadedContainer = container;

      // Get pattern from container
      let pattern: InjectionPattern | null = null;

      if (targetPatternId) {
        pattern = await this.injectionSvc.getPattern(targetPatternId);
      } else if (targetPatternName && container.patterns) {
        pattern = container.patterns.find(p => p.name === targetPatternName) || null;
      } else if (container.patterns && container.patterns.length > 0) {
        // Select based on strategy
        pattern = this.selectPattern(container.patterns);
      }

      if (!pattern) {
        logger.warn(`[InjectionSlot] No pattern found for slot ${this.slotId}`);
        return false;
      }

      // Load the pattern
      this.loadedPattern = pattern;
      this.state = {
        ...this.state,
        isLoaded: true,
        isActive: true,
        containerId: container.id,
        containerName: container.name,
        patternId: pattern.id,
        patternName: pattern.name,
        patternVersion: pattern.version,
        loadedAt: new Date()
      };

      logger.info(`[InjectionSlot] Loaded pattern "${pattern.name}" (v${pattern.version}) into slot ${this.slotId}`);
      return true;

    } catch (error: any) {
      logger.error(`[InjectionSlot] Failed to load pattern into slot ${this.slotId}:`, error);
      return false;
    }
  }

  /**
   * Select a pattern based on the configured strategy
   */
  private selectPattern(patterns: InjectionPattern[]): InjectionPattern | null {
    if (!patterns || patterns.length === 0) return null;

    const activePatterns = patterns.filter(p => p.isActive);
    if (activePatterns.length === 0) return null;

    switch (this.config.selectionStrategy) {
      case 'default':
        return activePatterns.find(p => p.isDefault) || activePatterns[0];

      case 'priority':
        return activePatterns.sort((a, b) => b.priority - a.priority)[0];

      case 'weighted': {
        const totalWeight = activePatterns.reduce((sum, p) => sum + p.weight, 0);
        let random = Math.random() * totalWeight;
        for (const pattern of activePatterns) {
          random -= pattern.weight;
          if (random <= 0) return pattern;
        }
        return activePatterns[0];
      }

      case 'random':
        return activePatterns[Math.floor(Math.random() * activePatterns.length)];

      default:
        return activePatterns[0];
    }
  }

  /**
   * Execute the loaded pattern
   */
  async execute(context: SlotExecutionContext): Promise<InjectionResult> {
    const startTime = Date.now();

    if (!this.state.isLoaded || !this.loadedPattern) {
      // Try to load first
      const loaded = await this.load();
      if (!loaded) {
        return {
          success: false,
          containerId: '',
          patternId: '',
          patternName: '',
          executionTimeMs: Date.now() - startTime,
          error: 'No pattern loaded in slot'
        };
      }
    }

    try {
      // Build injection input
      const input: Record<string, any> = {
        ...context.customInput,
        vehicleData: context.vehicleData,
        accountId: context.accountId,
        sessionData: context.sessionData,
        slotId: this.slotId,
        iaiInstanceId: this.iaiInstanceId
      };

      // Execute via injection service
      const result = await this.injectionSvc.inject({
        containerId: this.state.containerId!,
        patternId: this.state.patternId!,
        input,
        timeout: this.config.timeout,
        iaiInstanceId: context.iaiInstanceId,
        missionId: context.missionId,
        taskId: context.taskId
      });

      // Update state
      this.state.lastExecutedAt = new Date();
      this.state.executionCount++;
      
      if (result.success) {
        this.state.successCount++;
      } else {
        this.state.failureCount++;
        
        // Try fallback if enabled
        if (this.config.enableFallback && this.config.fallbackPatternId && !result.success) {
          logger.info(`[InjectionSlot] Attempting fallback pattern for slot ${this.slotId}`);
          return this.executeFallback(context, startTime);
        }
      }

      // Update average execution time
      const totalTime = this.state.avgExecutionTimeMs * (this.state.executionCount - 1) + result.executionTimeMs;
      this.state.avgExecutionTimeMs = Math.round(totalTime / this.state.executionCount);

      return result;

    } catch (error: any) {
      this.state.failureCount++;
      this.state.executionCount++;
      
      return {
        success: false,
        containerId: this.state.containerId || '',
        patternId: this.state.patternId || '',
        patternName: this.state.patternName || '',
        executionTimeMs: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Execute fallback pattern
   */
  private async executeFallback(context: SlotExecutionContext, startTime: number): Promise<InjectionResult> {
    if (!this.config.fallbackPatternId) {
      return {
        success: false,
        containerId: this.state.containerId || '',
        patternId: this.state.patternId || '',
        patternName: this.state.patternName || '',
        executionTimeMs: Date.now() - startTime,
        error: 'No fallback pattern configured'
      };
    }

    try {
      const result = await this.injectionSvc.inject({
        patternId: this.config.fallbackPatternId,
        input: {
          ...context.customInput,
          vehicleData: context.vehicleData,
          isFallback: true
        },
        iaiInstanceId: context.iaiInstanceId
      });

      return {
        ...result,
        patternName: `${result.patternName} (fallback)`
      };
    } catch (error: any) {
      return {
        success: false,
        containerId: this.state.containerId || '',
        patternId: this.config.fallbackPatternId,
        patternName: 'fallback',
        executionTimeMs: Date.now() - startTime,
        error: `Fallback failed: ${error.message}`
      };
    }
  }

  /**
   * Hot-swap the pattern in this slot
   */
  async swap(newPatternId: string): Promise<boolean> {
    logger.info(`[InjectionSlot] Hot-swapping pattern in slot ${this.slotId} to ${newPatternId}`);
    
    const previousPattern = this.state.patternId;
    const result = await this.load({ patternId: newPatternId, forceReload: true });
    
    if (result) {
      logger.info(`[InjectionSlot] Successfully swapped from ${previousPattern} to ${newPatternId}`);
    }
    
    return result;
  }

  /**
   * Unload the pattern from this slot
   */
  unload(): void {
    this.loadedPattern = null;
    this.loadedContainer = null;
    this.state = {
      ...this.state,
      isLoaded: false,
      isActive: false,
      containerId: null,
      containerName: null,
      patternId: null,
      patternName: null,
      patternVersion: null
    };
    logger.info(`[InjectionSlot] Unloaded pattern from slot ${this.slotId}`);
  }

  /**
   * Get the current slot state
   */
  getState(): SlotState {
    return { ...this.state };
  }

  /**
   * Get the loaded pattern (if any)
   */
  getPattern(): InjectionPattern | null {
    return this.loadedPattern;
  }

  /**
   * Get the loaded container (if any)
   */
  getContainer(): InjectionContainer | null {
    return this.loadedContainer;
  }

  /**
   * Get parsed pattern code (workflow)
   */
  getWorkflow(): any {
    if (!this.loadedPattern) return null;
    
    try {
      return JSON.parse(this.loadedPattern.code);
    } catch {
      return this.loadedPattern.code;
    }
  }

  /**
   * Get slot ID
   */
  getId(): string {
    return this.slotId;
  }
}

/**
 * Factory function to create an injection slot for an IAI instance
 */
export function createInjectionSlot(
  iaiInstanceId: string,
  config?: InjectionSlotConfig
): InjectionSlot {
  return new InjectionSlot(iaiInstanceId, config);
}

/**
 * Create a slot pre-loaded with DealersFace-FBM container
 */
export function createFBMSlot(iaiInstanceId: string): InjectionSlot {
  return new InjectionSlot(iaiInstanceId, {
    containerName: 'DealersFace-FBM',
    selectionStrategy: 'default',
    autoLoad: true,
    timeout: 120000, // 2 minutes for full FBM flow
    enableFallback: true
  });
}

export default InjectionSlot;
