/**
 * IAI Factory Service
 * 
 * Handles IAI Blueprint management, instance spawning, lifecycle control,
 * hot-swap mechanics, and connection map persistence.
 * 
 * Core Capabilities:
 * - Blueprint CRUD with validation
 * - Instance spawning with rate limiting
 * - Hot-swap pattern injection at birth
 * - Lifespan management and auto-termination
 * - Connection map storage for visual builder
 * - Factory statistics and monitoring
 */

// import { PrismaClient } from '@prisma/client'; // Uncomment when migrating to DB storage
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// Types
// ============================================

interface BlueprintCreateInput {
  name: string;
  description?: string | null;
  type: string;
  baseConfig: Record<string, any>;
  containerIds: string[];
  patternIds: string[];
  hotSwapEnabled: boolean;
  hotSwapPatterns: string[];
  creationRate: number;
  maxConcurrent: number;
  lifespan: number;
  autoRespawn: boolean;
  targeting: Record<string, any>;
  schedule: Record<string, any>;
  isActive: boolean;
  priority: number;
  tags: string[];
  createdBy: string;
}

interface BlueprintUpdateInput {
  name?: string;
  description?: string | null;
  type?: string;
  baseConfig?: Record<string, any>;
  containerIds?: string[];
  patternIds?: string[];
  hotSwapEnabled?: boolean;
  hotSwapPatterns?: string[];
  creationRate?: number;
  maxConcurrent?: number;
  lifespan?: number;
  autoRespawn?: boolean;
  targeting?: Record<string, any>;
  schedule?: Record<string, any>;
  isActive?: boolean;
  priority?: number;
  tags?: string[];
}

interface ConnectionMapCreateInput {
  name: string;
  nodes: Record<string, any>;
  connections: Record<string, any>;
  createdBy: string;
}

interface Blueprint {
  id: string;
  name: string;
  description: string | null;
  type: string;
  baseConfig: Record<string, any>;
  containerIds: string[];
  patternIds: string[];
  hotSwapEnabled: boolean;
  hotSwapPatterns: string[];
  creationRate: number;
  maxConcurrent: number;
  lifespan: number;
  autoRespawn: boolean;
  targeting: Record<string, any>;
  schedule: Record<string, any>;
  isActive: boolean;
  priority: number;
  tags: string[];
  stats: {
    totalCreated: number;
    activeCount: number;
    successRate: number;
    avgLifespan: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface Instance {
  id: string;
  blueprintId: string;
  blueprintName: string;
  status: string;
  currentPattern: string | null;
  assignedCompany: string | null;
  assignedUser: string | null;
  containerId: string | null;
  spawnedAt: string;
  lastActiveAt: string | null;
  expiresAt: string | null;
  executionCount: number;
  successCount: number;
  errorCount: number;
  config: Record<string, any>;
}

interface FactoryStats {
  totalBlueprints: number;
  activeBlueprints: number;
  totalInstances: number;
  activeInstances: number;
  spawningRate: number;
  terminationRate: number;
  avgSuccessRate: number;
  avgLifespan: number;
  recentActivity: Array<{
    type: string;
    message: string;
    timestamp: string;
  }>;
}

// ============================================
// In-Memory Storage (Production would use Redis/Database)
// ============================================

// Blueprint storage
const blueprints = new Map<string, Blueprint>();

// Instance storage
const instances = new Map<string, Instance>();

// Connection map storage
const connectionMaps = new Map<string, any>();

// Activity log
const activityLog: Array<{ type: string; message: string; timestamp: string }> = [];

// Stats tracking
let spawningCount = 0;
let terminationCount = 0;

// ============================================
// Helper Functions
// ============================================

function addActivity(type: string, message: string) {
  activityLog.unshift({
    type,
    message,
    timestamp: new Date().toISOString(),
  });
  // Keep only last 100 entries
  if (activityLog.length > 100) {
    activityLog.pop();
  }
}

function selectHotSwapPattern(blueprint: Blueprint): string | null {
  if (!blueprint.hotSwapEnabled || blueprint.hotSwapPatterns.length === 0) {
    return null;
  }
  // Random selection for hot-swap
  const randomIndex = Math.floor(Math.random() * blueprint.hotSwapPatterns.length);
  return blueprint.hotSwapPatterns[randomIndex];
}

function selectContainer(blueprint: Blueprint): string | null {
  if (blueprint.containerIds.length === 0) {
    return null;
  }
  // Random selection
  const randomIndex = Math.floor(Math.random() * blueprint.containerIds.length);
  return blueprint.containerIds[randomIndex];
}

function selectTarget(blueprint: Blueprint): { companyId: string | null; userId: string | null } {
  const targeting = blueprint.targeting;
  let companyId: string | null = null;
  let userId: string | null = null;

  if (targeting.companyIds && targeting.companyIds.length > 0) {
    const randomIndex = Math.floor(Math.random() * targeting.companyIds.length);
    companyId = targeting.companyIds[randomIndex];
  }

  if (targeting.userIds && targeting.userIds.length > 0) {
    const randomIndex = Math.floor(Math.random() * targeting.userIds.length);
    userId = targeting.userIds[randomIndex];
  }

  return { companyId, userId };
}

// ============================================
// Service Implementation
// ============================================

class IAIFactoryService {
  // ============================================
  // Factory Stats
  // ============================================

  async getFactoryStats(): Promise<FactoryStats> {
    const allBlueprints = Array.from(blueprints.values());
    const allInstances = Array.from(instances.values());
    const activeInstances = allInstances.filter(i => !['terminated', 'error'].includes(i.status));

    const totalSuccess = allInstances.reduce((sum, i) => sum + i.successCount, 0);
    const totalExecutions = allInstances.reduce((sum, i) => sum + i.executionCount, 0);
    const avgSuccessRate = totalExecutions > 0 ? totalSuccess / totalExecutions : 0;

    // Calculate avg lifespan from terminated instances
    const terminatedInstances = allInstances.filter(i => i.status === 'terminated');
    let avgLifespan = 0;
    if (terminatedInstances.length > 0) {
      const totalLifespan = terminatedInstances.reduce((sum, i) => {
        const spawn = new Date(i.spawnedAt).getTime();
        const end = i.lastActiveAt ? new Date(i.lastActiveAt).getTime() : Date.now();
        return sum + (end - spawn);
      }, 0);
      avgLifespan = Math.round((totalLifespan / terminatedInstances.length) / 60000); // minutes
    }

    return {
      totalBlueprints: allBlueprints.length,
      activeBlueprints: allBlueprints.filter(b => b.isActive).length,
      totalInstances: allInstances.length,
      activeInstances: activeInstances.length,
      spawningRate: spawningCount,
      terminationRate: terminationCount,
      avgSuccessRate,
      avgLifespan,
      recentActivity: activityLog.slice(0, 20),
    };
  }

  // ============================================
  // Blueprint Management
  // ============================================

  async listBlueprints(options?: {
    isActive?: boolean;
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<Blueprint[]> {
    let result = Array.from(blueprints.values());

    if (options?.isActive !== undefined) {
      result = result.filter(b => b.isActive === options.isActive);
    }

    if (options?.type) {
      result = result.filter(b => b.type === options.type);
    }

    // Sort by priority descending
    result.sort((a, b) => b.priority - a.priority);

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 50;
    return result.slice(offset, offset + limit);
  }

  async getBlueprint(id: string): Promise<Blueprint | null> {
    return blueprints.get(id) || null;
  }

  async createBlueprint(input: BlueprintCreateInput): Promise<Blueprint> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const blueprint: Blueprint = {
      id,
      name: input.name,
      description: input.description || null,
      type: input.type,
      baseConfig: input.baseConfig,
      containerIds: input.containerIds,
      patternIds: input.patternIds,
      hotSwapEnabled: input.hotSwapEnabled,
      hotSwapPatterns: input.hotSwapPatterns,
      creationRate: input.creationRate,
      maxConcurrent: input.maxConcurrent,
      lifespan: input.lifespan,
      autoRespawn: input.autoRespawn,
      targeting: input.targeting,
      schedule: input.schedule,
      isActive: input.isActive,
      priority: input.priority,
      tags: input.tags,
      stats: {
        totalCreated: 0,
        activeCount: 0,
        successRate: 0,
        avgLifespan: 0,
      },
      createdAt: now,
      updatedAt: now,
    };

    blueprints.set(id, blueprint);
    addActivity('create', `Blueprint "${input.name}" created`);
    logger.info('[IAI_FACTORY] Blueprint created', { id, name: input.name, type: input.type });

    return blueprint;
  }

  async updateBlueprint(id: string, input: BlueprintUpdateInput): Promise<Blueprint | null> {
    const existing = blueprints.get(id);
    if (!existing) {
      return null;
    }

    const updated: Blueprint = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    // Preserve nested objects properly
    if (input.targeting !== undefined) {
      updated.targeting = input.targeting;
    }
    if (input.schedule !== undefined) {
      updated.schedule = input.schedule;
    }
    if (input.baseConfig !== undefined) {
      updated.baseConfig = input.baseConfig;
    }

    blueprints.set(id, updated);
    addActivity('update', `Blueprint "${updated.name}" updated`);
    logger.info('[IAI_FACTORY] Blueprint updated', { id, name: updated.name });

    return updated;
  }

  async deleteBlueprint(id: string): Promise<void> {
    const blueprint = blueprints.get(id);
    if (blueprint) {
      // Terminate all instances from this blueprint
      await this.terminateAllInstances(id);
      blueprints.delete(id);
      addActivity('delete', `Blueprint "${blueprint.name}" deleted`);
      logger.info('[IAI_FACTORY] Blueprint deleted', { id, name: blueprint.name });
    }
  }

  async activateBlueprint(id: string): Promise<Blueprint | null> {
    const blueprint = blueprints.get(id);
    if (!blueprint) {
      return null;
    }

    blueprint.isActive = true;
    blueprint.updatedAt = new Date().toISOString();
    blueprints.set(id, blueprint);
    addActivity('activate', `Blueprint "${blueprint.name}" activated`);
    logger.info('[IAI_FACTORY] Blueprint activated', { id, name: blueprint.name });

    return blueprint;
  }

  async deactivateBlueprint(id: string): Promise<Blueprint | null> {
    const blueprint = blueprints.get(id);
    if (!blueprint) {
      return null;
    }

    blueprint.isActive = false;
    blueprint.updatedAt = new Date().toISOString();
    blueprints.set(id, blueprint);
    addActivity('deactivate', `Blueprint "${blueprint.name}" deactivated`);
    logger.info('[IAI_FACTORY] Blueprint deactivated', { id, name: blueprint.name });

    return blueprint;
  }

  // ============================================
  // Instance Spawning & Management
  // ============================================

  async spawnInstances(blueprintId: string, count: number): Promise<Instance[]> {
    const blueprint = blueprints.get(blueprintId);
    if (!blueprint) {
      throw new Error('Blueprint not found');
    }

    // Check max concurrent limit
    const currentActive = Array.from(instances.values())
      .filter(i => i.blueprintId === blueprintId && !['terminated', 'error'].includes(i.status))
      .length;

    const canSpawn = Math.min(count, blueprint.maxConcurrent - currentActive);
    if (canSpawn <= 0) {
      logger.warn('[IAI_FACTORY] Max concurrent limit reached', { blueprintId, current: currentActive, max: blueprint.maxConcurrent });
      return [];
    }

    const spawnedInstances: Instance[] = [];
    const now = new Date();

    for (let i = 0; i < canSpawn; i++) {
      const instanceId = uuidv4();
      const { companyId, userId } = selectTarget(blueprint);
      const containerId = selectContainer(blueprint);
      const currentPattern = selectHotSwapPattern(blueprint) || 
        (blueprint.patternIds.length > 0 ? blueprint.patternIds[Math.floor(Math.random() * blueprint.patternIds.length)] : null);

      // Calculate expiration based on lifespan
      let expiresAt: string | null = null;
      if (blueprint.lifespan > 0) {
        expiresAt = new Date(now.getTime() + blueprint.lifespan * 60000).toISOString();
      }

      const instance: Instance = {
        id: instanceId,
        blueprintId,
        blueprintName: blueprint.name,
        status: 'spawning',
        currentPattern,
        assignedCompany: companyId,
        assignedUser: userId,
        containerId,
        spawnedAt: now.toISOString(),
        lastActiveAt: null,
        expiresAt,
        executionCount: 0,
        successCount: 0,
        errorCount: 0,
        config: {
          ...blueprint.baseConfig,
          hotSwapEnabled: blueprint.hotSwapEnabled,
          autoRespawn: blueprint.autoRespawn,
        },
      };

      instances.set(instanceId, instance);
      spawnedInstances.push(instance);

      // Update to active after short delay (simulating spawn process)
      setTimeout(() => {
        const inst = instances.get(instanceId);
        if (inst && inst.status === 'spawning') {
          inst.status = 'active';
          inst.lastActiveAt = new Date().toISOString();
          instances.set(instanceId, inst);
        }
      }, 500 + Math.random() * 500);
    }

    // Update blueprint stats
    blueprint.stats.totalCreated += spawnedInstances.length;
    blueprint.stats.activeCount = Array.from(instances.values())
      .filter(i => i.blueprintId === blueprintId && !['terminated', 'error'].includes(i.status))
      .length;
    blueprints.set(blueprintId, blueprint);

    // Update spawning counter
    spawningCount = spawnedInstances.length;
    setTimeout(() => { spawningCount = 0; }, 60000);

    addActivity('spawn', `Spawned ${spawnedInstances.length} instance(s) from "${blueprint.name}"`);
    logger.info('[IAI_FACTORY] Instances spawned', {
      blueprintId,
      count: spawnedInstances.length,
      instanceIds: spawnedInstances.map(i => i.id),
    });

    return spawnedInstances;
  }

  async listInstances(options?: {
    status?: string;
    blueprintId?: string;
    limit?: number;
    offset?: number;
  }): Promise<Instance[]> {
    let result = Array.from(instances.values());

    if (options?.status) {
      result = result.filter(i => i.status === options.status);
    }

    if (options?.blueprintId) {
      result = result.filter(i => i.blueprintId === options.blueprintId);
    }

    // Sort by spawn time descending
    result.sort((a, b) => new Date(b.spawnedAt).getTime() - new Date(a.spawnedAt).getTime());

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 100;
    return result.slice(offset, offset + limit);
  }

  async getInstance(id: string): Promise<Instance | null> {
    return instances.get(id) || null;
  }

  async terminateInstance(id: string): Promise<Instance | null> {
    const instance = instances.get(id);
    if (!instance) {
      return null;
    }

    instance.status = 'terminated';
    instance.lastActiveAt = new Date().toISOString();
    instances.set(id, instance);

    // Update blueprint stats
    const blueprint = blueprints.get(instance.blueprintId);
    if (blueprint) {
      blueprint.stats.activeCount = Array.from(instances.values())
        .filter(i => i.blueprintId === instance.blueprintId && !['terminated', 'error'].includes(i.status))
        .length;
      blueprints.set(instance.blueprintId, blueprint);

      // Handle auto-respawn
      if (blueprint.autoRespawn && blueprint.isActive) {
        logger.info('[IAI_FACTORY] Auto-respawning instance', { blueprintId: instance.blueprintId });
        setTimeout(() => {
          this.spawnInstances(instance.blueprintId, 1).catch(err => {
            logger.error('[IAI_FACTORY] Auto-respawn failed', { error: err.message });
          });
        }, 1000);
      }
    }

    terminationCount++;
    setTimeout(() => { terminationCount = Math.max(0, terminationCount - 1); }, 60000);

    addActivity('terminate', `Instance ${id.slice(0, 8)}... terminated`);
    logger.info('[IAI_FACTORY] Instance terminated', { id, blueprintId: instance.blueprintId });

    return instance;
  }

  async terminateAllInstances(blueprintId?: string): Promise<{ terminated: number }> {
    let toTerminate = Array.from(instances.values())
      .filter(i => !['terminated', 'error'].includes(i.status));

    if (blueprintId) {
      toTerminate = toTerminate.filter(i => i.blueprintId === blueprintId);
    }

    for (const instance of toTerminate) {
      instance.status = 'terminated';
      instance.lastActiveAt = new Date().toISOString();
      instances.set(instance.id, instance);
    }

    // Update blueprint stats
    if (blueprintId) {
      const blueprint = blueprints.get(blueprintId);
      if (blueprint) {
        blueprint.stats.activeCount = 0;
        blueprints.set(blueprintId, blueprint);
      }
    } else {
      for (const blueprint of blueprints.values()) {
        blueprint.stats.activeCount = 0;
        blueprints.set(blueprint.id, blueprint);
      }
    }

    addActivity('terminate_all', `Terminated ${toTerminate.length} instance(s)`);
    logger.info('[IAI_FACTORY] Mass termination', { count: toTerminate.length, blueprintId });

    return { terminated: toTerminate.length };
  }

  // ============================================
  // Connection Maps
  // ============================================

  async listConnectionMaps(): Promise<any[]> {
    return Array.from(connectionMaps.values());
  }

  async createConnectionMap(input: ConnectionMapCreateInput): Promise<any> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const map = {
      id,
      name: input.name,
      nodes: input.nodes,
      connections: input.connections,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    connectionMaps.set(id, map);
    addActivity('connection_map', `Connection map "${input.name}" created`);
    logger.info('[IAI_FACTORY] Connection map created', { id, name: input.name });

    return map;
  }

  async deleteConnectionMap(id: string): Promise<void> {
    const map = connectionMaps.get(id);
    if (map) {
      connectionMaps.delete(id);
      addActivity('connection_map', `Connection map "${map.name}" deleted`);
      logger.info('[IAI_FACTORY] Connection map deleted', { id, name: map.name });
    }
  }

  // ============================================
  // USM Container Preload (Ultra Speed Mode)
  // ============================================

  /**
   * Preload USM patterns into the USM container for hot-swap ready deployment
   * This ensures the Ultra Speed Mode container is always ready with patterns
   */
  async preloadUSMPatterns(prisma: any): Promise<{
    success: boolean;
    container: any | null;
    patterns: any[];
    message: string;
  }> {
    try {
      logger.info('[IAI_FACTORY] Starting USM pattern preload...');
      
      // Find or create USM container
      let usmContainer = await prisma.injectionContainer.findFirst({
        where: { name: 'IAI Soldiers USM' }
      });

      if (!usmContainer) {
        // Create USM container if it doesn't exist
        usmContainer = await prisma.injectionContainer.create({
          data: {
            name: 'IAI Soldiers USM',
            description: 'Ultra Speed Mode container for high-performance IAI soldiers with hot-swap capability',
            category: 'usm',
            isActive: true,
            config: {
              mode: 'ultra_speed',
              hotSwapEnabled: true,
              priorityLevel: 'critical',
              maxConcurrentPatterns: 100,
              cacheEnabled: true
            }
          }
        });
        logger.info('[IAI_FACTORY] Created USM container', { id: usmContainer.id });
        addActivity('usm_container', 'USM container created for hot-swap deployment');
      }

      // Ensure container is active
      if (!usmContainer.isActive) {
        usmContainer = await prisma.injectionContainer.update({
          where: { id: usmContainer.id },
          data: { isActive: true }
        });
        logger.info('[IAI_FACTORY] Activated USM container');
      }

      // Get existing patterns in USM container
      const existingPatterns = await prisma.injectionPattern.findMany({
        where: { containerId: usmContainer.id }
      });

      // If no patterns, create default USM patterns
      if (existingPatterns.length === 0) {
        const defaultUSMPatterns = [
          {
            name: 'USM-HotSwap-Alpha',
            codeType: 'usm_soldier',
            code: '/* USM Pattern Alpha - Ultra Speed Hot-Swap Ready */\nconst USM_MODE = "ALPHA";\nconst SPEED_MULTIPLIER = 3;\nconst HOT_SWAP_READY = true;',
            description: 'Primary USM pattern for high-speed operations',
            weight: 100,
            containerId: usmContainer.id,
            isActive: true,
            config: {
              speedMode: 'ultra',
              hotSwapPriority: 1,
              autoActivate: true
            }
          },
          {
            name: 'USM-HotSwap-Beta',
            codeType: 'usm_soldier',
            code: '/* USM Pattern Beta - Balanced Speed & Stealth */\nconst USM_MODE = "BETA";\nconst SPEED_MULTIPLIER = 2;\nconst STEALTH_MODE = true;\nconst HOT_SWAP_READY = true;',
            description: 'Balanced USM pattern with stealth capabilities',
            weight: 80,
            containerId: usmContainer.id,
            isActive: true,
            config: {
              speedMode: 'balanced',
              hotSwapPriority: 2,
              stealthEnabled: true
            }
          },
          {
            name: 'USM-HotSwap-Gamma',
            codeType: 'usm_soldier',
            code: '/* USM Pattern Gamma - Maximum Throughput */\nconst USM_MODE = "GAMMA";\nconst SPEED_MULTIPLIER = 5;\nconst BATCH_MODE = true;\nconst HOT_SWAP_READY = true;',
            description: 'Maximum throughput USM pattern for bulk operations',
            weight: 60,
            containerId: usmContainer.id,
            isActive: true,
            config: {
              speedMode: 'maximum',
              hotSwapPriority: 3,
              batchProcessing: true
            }
          }
        ];

        for (const patternData of defaultUSMPatterns) {
          await prisma.injectionPattern.create({ data: patternData });
          logger.info('[IAI_FACTORY] Created USM pattern', { name: patternData.name });
        }
        
        addActivity('usm_patterns', `Created ${defaultUSMPatterns.length} default USM patterns`);
      }

      // Get final count of patterns
      const finalPatterns = await prisma.injectionPattern.findMany({
        where: { containerId: usmContainer.id, isActive: true }
      });

      logger.info('[IAI_FACTORY] USM preload complete', {
        containerId: usmContainer.id,
        patternCount: finalPatterns.length
      });

      addActivity('usm_preload', `USM container preloaded with ${finalPatterns.length} patterns`);

      return {
        success: true,
        container: usmContainer,
        patterns: finalPatterns,
        message: `USM container ready with ${finalPatterns.length} hot-swap patterns`
      };

    } catch (error: any) {
      logger.error('[IAI_FACTORY] USM preload failed', { error: error.message });
      return {
        success: false,
        container: null,
        patterns: [],
        message: `USM preload failed: ${error.message}`
      };
    }
  }

  // ============================================
  // Lifecycle Management (Background Tasks)
  // ============================================

  startLifecycleManager(): void {
    // Check for expired instances every 30 seconds
    setInterval(() => {
      const now = Date.now();
      for (const instance of instances.values()) {
        if (instance.status !== 'terminated' && instance.expiresAt) {
          const expiresAt = new Date(instance.expiresAt).getTime();
          if (now >= expiresAt) {
            logger.info('[IAI_FACTORY] Instance expired, terminating', { id: instance.id });
            this.terminateInstance(instance.id).catch(err => {
              logger.error('[IAI_FACTORY] Failed to terminate expired instance', { id: instance.id, error: err.message });
            });
          }
        }
      }
    }, 30000);

    // Process scheduled blueprints every minute
    setInterval(() => {
      for (const blueprint of blueprints.values()) {
        if (blueprint.isActive && blueprint.schedule.enabled && blueprint.schedule.cronExpression) {
          // Simple schedule check (in production, use proper cron parser)
          // For now, just check if it should run based on current time
          const now = new Date();
          
          // Check date range
          if (blueprint.schedule.startDate && new Date(blueprint.schedule.startDate) > now) {
            continue;
          }
          if (blueprint.schedule.endDate && new Date(blueprint.schedule.endDate) < now) {
            continue;
          }

          // Very simple cron-like check (production should use node-cron or similar)
          // This is placeholder logic
          const shouldRun = Math.random() < 0.1; // 10% chance each minute for demo
          if (shouldRun) {
            logger.info('[IAI_FACTORY] Scheduled spawn triggered', { blueprintId: blueprint.id, name: blueprint.name });
            this.spawnInstances(blueprint.id, blueprint.creationRate).catch(err => {
              logger.error('[IAI_FACTORY] Scheduled spawn failed', { blueprintId: blueprint.id, error: err.message });
            });
          }
        }
      }
    }, 60000);

    logger.info('[IAI_FACTORY] Lifecycle manager started');
  }
}

// Export singleton instance
export const iaiFactoryService = new IAIFactoryService();

// Start lifecycle manager on import
iaiFactoryService.startLifecycleManager();
