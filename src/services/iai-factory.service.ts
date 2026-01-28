/**
 * IAI Factory Service v2.3.0
 * 
 * Three-Class Soldier Architecture:
 * - IAI Soldiers: User-side Chrome extension, includes USM (Ultra Speed Mode)
 * - IAI Stealth Soldiers: Chromium-based, invisible, human-like patterns
 * - NOVA Soldiers: Peak automation, full AI integration, intelligent
 * 
 * Core Capabilities:
 * - Blueprint CRUD with validation and classification
 * - Instance spawning with rate limiting and targeting
 * - Hot-swap pattern injection at birth
 * - Lifespan management and auto-termination
 * - Connection map storage for visual builder
 * - Predefined templates management
 * - Factory statistics and monitoring
 */

// import { PrismaClient } from '@prisma/client'; // Uncomment when migrating to DB storage
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// v2.3.0 Type Definitions - Three-Class Architecture
// ============================================

// Soldier Genre - Three official soldier classes
type SoldierGenre = 'SOLDIER' | 'STEALTH' | 'NOVA';

// Execution Source - Where the soldier runs
type ExecutionSource = 'EXTENSION' | 'CHROMIUM';

// Soldier Mode - How the soldier behaves
type SoldierMode = 'USM' | 'STEALTH' | 'HYBRID' | 'NOVA_AI';

// Mission Profile - Targeting profiles
type MissionProfile = 'FBM_LISTING' | 'FBM_MESSAGES' | 'FBM_FULL' | 'TRAINING' | 'INTELLIGENCE' | 'CUSTOM';

// Instance Status
type InstanceStatus = 'PENDING' | 'SPAWNING' | 'ACTIVE' | 'TERMINATING' | 'TERMINATED' | 'ERROR';

// Blueprint types aligned with soldier classes
const BLUEPRINT_TYPES = ['STANDARD', 'USM', 'STEALTH', 'NOVA', 'HYBRID', 'CUSTOM'] as const;
type BlueprintType = typeof BLUEPRINT_TYPES[number];

interface BlueprintCreateInput {
  name: string;
  description?: string | null;
  type: BlueprintType;
  // v2.3.0 Classification
  targetGenre: SoldierGenre;
  targetSource: ExecutionSource;
  targetMode: SoldierMode;
  // Configuration
  baseConfig: Record<string, unknown>;
  containerIds: string[];
  patternIds: string[];
  hotSwapEnabled: boolean;
  hotSwapPatterns: string[];
  creationRate: number;
  maxConcurrent: number;
  lifespan: number;
  autoRespawn: boolean;
  targeting: Record<string, unknown>;
  schedule: Record<string, unknown>;
  isActive: boolean;
  priority: number;
  tags: string[];
  createdBy: string;
  accountId: string;
}

interface BlueprintUpdateInput {
  name?: string;
  description?: string | null;
  type?: BlueprintType;
  targetGenre?: SoldierGenre;
  targetSource?: ExecutionSource;
  targetMode?: SoldierMode;
  baseConfig?: Record<string, unknown>;
  containerIds?: string[];
  patternIds?: string[];
  hotSwapEnabled?: boolean;
  hotSwapPatterns?: string[];
  creationRate?: number;
  maxConcurrent?: number;
  lifespan?: number;
  autoRespawn?: boolean;
  targeting?: Record<string, unknown>;
  schedule?: Record<string, unknown>;
  isActive?: boolean;
  priority?: number;
  tags?: string[];
}

interface ConnectionMapCreateInput {
  name: string;
  description?: string | null;
  nodes: Record<string, unknown>;
  connections: Record<string, unknown>;
  viewport?: Record<string, unknown>;
  isTemplate?: boolean;
  templateType?: string;
  templateTags?: string[];
  createdBy: string;
  accountId: string;
}

interface Blueprint {
  id: string;
  accountId: string;
  name: string;
  description: string | null;
  version: string;
  type: BlueprintType;
  // v2.3.0 Classification
  targetGenre: SoldierGenre;
  targetSource: ExecutionSource;
  targetMode: SoldierMode;
  // Configuration
  baseConfig: Record<string, unknown>;
  containerIds: string[];
  patternIds: string[];
  hotSwapEnabled: boolean;
  hotSwapPatterns: string[];
  creationRate: number;
  maxConcurrent: number;
  lifespan: number;
  autoRespawn: boolean;
  targeting: Record<string, unknown>;
  schedule: Record<string, unknown>;
  isActive: boolean;
  priority: number;
  tags: string[];
  stats: {
    totalCreated: number;
    activeCount: number;
    successRate: number;
    avgLifespan: number;
  };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface Instance {
  id: string;
  instanceId: string;
  blueprintId: string;
  blueprintName: string;
  soldierId: string | null;
  status: InstanceStatus;
  currentPattern: string | null;
  assignedCompany: string | null;
  assignedUser: string | null;
  containerId: string | null;
  spawnedAt: string;
  lastActiveAt: string | null;
  expiresAt: string | null;
  terminatedAt: string | null;
  executionCount: number;
  successCount: number;
  errorCount: number;
  config: Record<string, unknown>;
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
  // v2.3.0 Classification stats
  byGenre: Record<SoldierGenre, number>;
  bySource: Record<ExecutionSource, number>;
  byMode: Record<SoldierMode, number>;
  recentActivity: Array<{
    type: string;
    message: string;
    timestamp: string;
  }>;
}

interface PredefinedTemplate {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  category: string;
  nodes: unknown[]; // Array of node definitions
  connections: unknown[]; // Array of connection definitions
  baseConfig: Record<string, unknown>;
  targetGenre: SoldierGenre;
  targetSource: ExecutionSource;
  targetMode: SoldierMode;
  targetMission: MissionProfile;
  icon: string | null;
  color: string | null;
  tags: string[];
  popularity: number;
  isActive: boolean;
  version: string;
  createdAt: string;
  updatedAt: string;
}

interface ConnectionMap {
  id: string;
  accountId: string;
  name: string;
  description: string | null;
  nodes: Record<string, unknown>;
  connections: Record<string, unknown>;
  viewport: Record<string, unknown>;
  isTemplate: boolean;
  templateType: string | null;
  templateTags: string[];
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// In-Memory Storage (Production uses Database via Prisma)
// ============================================

// Blueprint storage
const blueprints = new Map<string, Blueprint>();

// Instance storage
const instances = new Map<string, Instance>();

// Connection map storage
const connectionMaps = new Map<string, ConnectionMap>();

// Predefined templates storage
const predefinedTemplates = new Map<string, PredefinedTemplate>();

// Activity log
const activityLog: Array<{ type: string; message: string; timestamp: string }> = [];

// Stats tracking
let spawningCount = 0;
let terminationCount = 0;

// ============================================
// Initialize Default Predefined Templates
// ============================================

function initializeDefaultTemplates(): void {
  const defaultTemplates: PredefinedTemplate[] = [
    {
      id: 'tpl-fbm-usm-soldier',
      name: 'fbm-usm-soldier',
      displayName: 'FBM USM Soldier',
      description: 'Ultra Speed Mode soldier for Facebook Marketplace vehicle listing. Runs in user Chrome extension with maximum performance.',
      category: 'fbm',
      nodes: [{ id: 'soldier-1', type: 'iai', label: 'USM Soldier', config: { genre: 'SOLDIER', mode: 'USM' } }],
      connections: [],
      baseConfig: { speedMultiplier: 3, stealthLevel: 'low', humanSimulation: false },
      targetGenre: 'SOLDIER',
      targetSource: 'EXTENSION',
      targetMode: 'USM',
      targetMission: 'FBM_LISTING',
      icon: 'Zap',
      color: '#3B82F6',
      tags: ['fbm', 'usm', 'fast', 'listing'],
      popularity: 0,
      isActive: true,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tpl-fbm-stealth-soldier',
      name: 'fbm-stealth-soldier',
      displayName: 'FBM Stealth Soldier',
      description: 'Invisible Chromium-based soldier with human-like patterns. Runs on dealersface-fbm server for maximum undetectability.',
      category: 'fbm',
      nodes: [{ id: 'stealth-1', type: 'iai', label: 'Stealth Soldier', config: { genre: 'STEALTH', mode: 'STEALTH' } }],
      connections: [],
      baseConfig: { speedMultiplier: 1, stealthLevel: 'maximum', humanSimulation: true, antiDetection: true },
      targetGenre: 'STEALTH',
      targetSource: 'CHROMIUM',
      targetMode: 'STEALTH',
      targetMission: 'FBM_LISTING',
      icon: 'Ghost',
      color: '#8B5CF6',
      tags: ['fbm', 'stealth', 'chromium', 'invisible'],
      popularity: 0,
      isActive: true,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tpl-nova-full-automation',
      name: 'nova-full-automation',
      displayName: 'NOVA Full Automation',
      description: 'Peak automation tier with full NOVA AI integration. Intelligent decision-making, analytics, and adaptive behavior.',
      category: 'intelligence',
      nodes: [{ id: 'nova-1', type: 'iai', label: 'NOVA Soldier', config: { genre: 'NOVA', mode: 'NOVA_AI' } }],
      connections: [],
      baseConfig: { aiIntegration: true, decisionEngine: true, learningEnabled: true, analyticsLevel: 'full' },
      targetGenre: 'NOVA',
      targetSource: 'CHROMIUM',
      targetMode: 'NOVA_AI',
      targetMission: 'FBM_FULL',
      icon: 'Brain',
      color: '#F59E0B',
      tags: ['nova', 'ai', 'intelligent', 'full-automation'],
      popularity: 0,
      isActive: true,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tpl-hybrid-balanced',
      name: 'hybrid-balanced',
      displayName: 'Hybrid Balanced',
      description: 'Balanced hybrid configuration combining extension speed with stealth patterns. Good for moderate volume.',
      category: 'general',
      nodes: [{ id: 'hybrid-1', type: 'iai', label: 'Hybrid Soldier', config: { genre: 'SOLDIER', mode: 'HYBRID' } }],
      connections: [],
      baseConfig: { speedMultiplier: 2, stealthLevel: 'moderate', humanSimulation: true },
      targetGenre: 'SOLDIER',
      targetSource: 'EXTENSION',
      targetMode: 'HYBRID',
      targetMission: 'FBM_LISTING',
      icon: 'Layers',
      color: '#10B981',
      tags: ['hybrid', 'balanced', 'moderate'],
      popularity: 0,
      isActive: true,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tpl-messenger-stealth',
      name: 'messenger-stealth',
      displayName: 'Messenger Stealth',
      description: 'Stealth soldier optimized for Facebook Marketplace message handling. Human-like response patterns.',
      category: 'messaging',
      nodes: [{ id: 'messenger-1', type: 'iai', label: 'Messenger Soldier', config: { genre: 'STEALTH', mode: 'STEALTH' } }],
      connections: [],
      baseConfig: { messageMode: true, responseDelay: 'human', typingSimulation: true },
      targetGenre: 'STEALTH',
      targetSource: 'CHROMIUM',
      targetMode: 'STEALTH',
      targetMission: 'FBM_MESSAGES',
      icon: 'MessageSquare',
      color: '#EC4899',
      tags: ['messaging', 'stealth', 'responses'],
      popularity: 0,
      isActive: true,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  for (const template of defaultTemplates) {
    predefinedTemplates.set(template.id, template);
  }

  logger.info('[IAI_FACTORY] Default templates initialized', { count: defaultTemplates.length });
}

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
  const targeting = blueprint.targeting as { companyIds?: string[]; userIds?: string[] };
  let companyId: string | null = null;
  let userId: string | null = null;

  if (targeting.companyIds && Array.isArray(targeting.companyIds) && targeting.companyIds.length > 0) {
    const randomIndex = Math.floor(Math.random() * targeting.companyIds.length);
    companyId = targeting.companyIds[randomIndex];
  }

  if (targeting.userIds && Array.isArray(targeting.userIds) && targeting.userIds.length > 0) {
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
    const activeInstances = allInstances.filter(i => !['TERMINATED', 'ERROR'].includes(i.status));

    const totalSuccess = allInstances.reduce((sum, i) => sum + i.successCount, 0);
    const totalExecutions = allInstances.reduce((sum, i) => sum + i.executionCount, 0);
    const avgSuccessRate = totalExecutions > 0 ? totalSuccess / totalExecutions : 0;

    // Calculate avg lifespan from terminated instances
    const terminatedInstances = allInstances.filter(i => i.status === 'TERMINATED');
    let avgLifespan = 0;
    if (terminatedInstances.length > 0) {
      const totalLifespan = terminatedInstances.reduce((sum, i) => {
        const spawn = new Date(i.spawnedAt).getTime();
        const end = i.lastActiveAt ? new Date(i.lastActiveAt).getTime() : Date.now();
        return sum + (end - spawn);
      }, 0);
      avgLifespan = Math.round((totalLifespan / terminatedInstances.length) / 60000); // minutes
    }

    // v2.3.0: Calculate classification stats
    const byGenre: Record<SoldierGenre, number> = { SOLDIER: 0, STEALTH: 0, NOVA: 0 };
    const bySource: Record<ExecutionSource, number> = { EXTENSION: 0, CHROMIUM: 0 };
    const byMode: Record<SoldierMode, number> = { USM: 0, STEALTH: 0, HYBRID: 0, NOVA_AI: 0 };

    for (const blueprint of allBlueprints) {
      if (blueprint.isActive) {
        byGenre[blueprint.targetGenre]++;
        bySource[blueprint.targetSource]++;
        byMode[blueprint.targetMode]++;
      }
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
      byGenre,
      bySource,
      byMode,
      recentActivity: activityLog.slice(0, 20),
    };
  }

  // ============================================
  // Blueprint Management
  // ============================================

  async listBlueprints(options?: {
    isActive?: boolean;
    type?: BlueprintType;
    // v2.3.0 Filters
    genre?: SoldierGenre;
    source?: ExecutionSource;
    mode?: SoldierMode;
    accountId?: string;
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

    // v2.3.0 Classification filters
    if (options?.genre) {
      result = result.filter(b => b.targetGenre === options.genre);
    }

    if (options?.source) {
      result = result.filter(b => b.targetSource === options.source);
    }

    if (options?.mode) {
      result = result.filter(b => b.targetMode === options.mode);
    }

    if (options?.accountId) {
      result = result.filter(b => b.accountId === options.accountId);
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
      accountId: input.accountId,
      name: input.name,
      description: input.description || null,
      version: '1.0.0',
      type: input.type,
      // v2.3.0 Classification
      targetGenre: input.targetGenre,
      targetSource: input.targetSource,
      targetMode: input.targetMode,
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
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    blueprints.set(id, blueprint);
    addActivity('create', `Blueprint "${input.name}" (${input.targetGenre}/${input.targetMode}) created`);
    logger.info('[IAI_FACTORY] Blueprint created', { 
      id, 
      name: input.name, 
      type: input.type,
      genre: input.targetGenre,
      source: input.targetSource,
      mode: input.targetMode,
    });

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
        instanceId,
        blueprintId,
        blueprintName: blueprint.name,
        soldierId: null,
        status: 'SPAWNING',
        currentPattern,
        assignedCompany: companyId,
        assignedUser: userId,
        containerId,
        spawnedAt: now.toISOString(),
        lastActiveAt: null,
        expiresAt,
        terminatedAt: null,
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
        if (inst && inst.status === 'SPAWNING') {
          inst.status = 'ACTIVE';
          inst.lastActiveAt = new Date().toISOString();
          instances.set(instanceId, inst);
        }
      }, 500 + Math.random() * 500);
    }

    // Update blueprint stats
    blueprint.stats.totalCreated += spawnedInstances.length;
    blueprint.stats.activeCount = Array.from(instances.values())
      .filter(i => i.blueprintId === blueprintId && !['TERMINATED', 'ERROR'].includes(i.status))
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

    instance.status = 'TERMINATED';
    instance.lastActiveAt = new Date().toISOString();
    instance.terminatedAt = new Date().toISOString();
    instances.set(id, instance);

    // Update blueprint stats
    const blueprint = blueprints.get(instance.blueprintId);
    if (blueprint) {
      blueprint.stats.activeCount = Array.from(instances.values())
        .filter(i => i.blueprintId === instance.blueprintId && !['TERMINATED', 'ERROR'].includes(i.status))
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
      .filter(i => !['TERMINATED', 'ERROR'].includes(i.status));

    if (blueprintId) {
      toTerminate = toTerminate.filter(i => i.blueprintId === blueprintId);
    }

    for (const instance of toTerminate) {
      instance.status = 'TERMINATED';
      instance.lastActiveAt = new Date().toISOString();
      instance.terminatedAt = new Date().toISOString();
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
  // Connection Maps (v2.3.0 - Server-side persistence)
  // ============================================

  async listConnectionMaps(options?: {
    accountId?: string;
    isTemplate?: boolean;
    isActive?: boolean;
  }): Promise<ConnectionMap[]> {
    let result = Array.from(connectionMaps.values());

    if (options?.accountId) {
      result = result.filter(m => m.accountId === options.accountId);
    }

    if (options?.isTemplate !== undefined) {
      result = result.filter(m => m.isTemplate === options.isTemplate);
    }

    if (options?.isActive !== undefined) {
      result = result.filter(m => m.isActive === options.isActive);
    }

    return result;
  }

  async getConnectionMap(id: string): Promise<ConnectionMap | null> {
    return connectionMaps.get(id) || null;
  }

  async createConnectionMap(input: ConnectionMapCreateInput): Promise<ConnectionMap> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const map: ConnectionMap = {
      id,
      accountId: input.accountId,
      name: input.name,
      description: input.description || null,
      nodes: input.nodes,
      connections: input.connections,
      viewport: input.viewport || {},
      isTemplate: input.isTemplate || false,
      templateType: input.templateType || null,
      templateTags: input.templateTags || [],
      isActive: true,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    connectionMaps.set(id, map);
    addActivity('connection_map', `Connection map "${input.name}" created`);
    logger.info('[IAI_FACTORY] Connection map created', { id, name: input.name });

    return map;
  }

  async updateConnectionMap(id: string, input: Partial<ConnectionMapCreateInput>): Promise<ConnectionMap | null> {
    const existing = connectionMaps.get(id);
    if (!existing) {
      return null;
    }

    const updated: ConnectionMap = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    connectionMaps.set(id, updated);
    addActivity('connection_map', `Connection map "${updated.name}" updated`);
    logger.info('[IAI_FACTORY] Connection map updated', { id, name: updated.name });

    return updated;
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
  // Predefined Templates (v2.3.0)
  // ============================================

  async listPredefinedTemplates(options?: {
    category?: string;
    genre?: SoldierGenre;
    source?: ExecutionSource;
    mode?: SoldierMode;
    isActive?: boolean;
  }): Promise<PredefinedTemplate[]> {
    let result = Array.from(predefinedTemplates.values());

    if (options?.category) {
      result = result.filter(t => t.category === options.category);
    }

    if (options?.genre) {
      result = result.filter(t => t.targetGenre === options.genre);
    }

    if (options?.source) {
      result = result.filter(t => t.targetSource === options.source);
    }

    if (options?.mode) {
      result = result.filter(t => t.targetMode === options.mode);
    }

    if (options?.isActive !== undefined) {
      result = result.filter(t => t.isActive === options.isActive);
    }

    // Sort by popularity descending
    result.sort((a, b) => b.popularity - a.popularity);

    return result;
  }

  async getPredefinedTemplate(id: string): Promise<PredefinedTemplate | null> {
    return predefinedTemplates.get(id) || null;
  }

  async getPredefinedTemplateByName(name: string): Promise<PredefinedTemplate | null> {
    for (const template of predefinedTemplates.values()) {
      if (template.name === name) {
        return template;
      }
    }
    return null;
  }

  async usePredefinedTemplate(templateId: string): Promise<{ success: boolean; template: PredefinedTemplate | null }> {
    const template = predefinedTemplates.get(templateId);
    if (!template) {
      return { success: false, template: null };
    }

    // Increment popularity
    template.popularity++;
    template.updatedAt = new Date().toISOString();
    predefinedTemplates.set(templateId, template);

    addActivity('template_used', `Template "${template.displayName}" used`);
    logger.info('[IAI_FACTORY] Predefined template used', { id: templateId, name: template.name });

    return { success: true, template };
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
        if (instance.status !== 'TERMINATED' && instance.expiresAt) {
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
        if (blueprint.isActive && (blueprint.schedule as Record<string, unknown>).enabled && (blueprint.schedule as Record<string, unknown>).cronExpression) {
          // Simple schedule check (in production, use proper cron parser)
          // For now, just check if it should run based on current time
          const now = new Date();
          const schedule = blueprint.schedule as Record<string, unknown>;
          
          // Check date range
          if (schedule.startDate && new Date(schedule.startDate as string) > now) {
            continue;
          }
          if (schedule.endDate && new Date(schedule.endDate as string) < now) {
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

// Initialize default templates and start lifecycle manager on import
initializeDefaultTemplates();
iaiFactoryService.startLifecycleManager();

// Export types for external use
export type {
  SoldierGenre,
  ExecutionSource,
  SoldierMode,
  MissionProfile,
  InstanceStatus,
  BlueprintType,
  Blueprint,
  Instance,
  FactoryStats,
  PredefinedTemplate,
  ConnectionMap,
  BlueprintCreateInput,
  BlueprintUpdateInput,
  ConnectionMapCreateInput,
};

export { BLUEPRINT_TYPES };
