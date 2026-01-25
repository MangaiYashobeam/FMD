/**
 * AI Orchestrator Service
 * 
 * Manages AI agent assignments, hierarchical permissions,
 * session context preservation, and seamless agent handoffs
 * 
 * @version 1.0.0
 * @author FMD Engineering Team
 */

import { logger } from '@/utils/logger';
// prisma import reserved for future database persistence
// import prisma from '@/config/database';
import { copilotModelService, COPILOT_MODELS, CopilotModel, RoutingRule } from './copilot-models.service';
import { EventEmitter } from 'events';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type UserHierarchy = 'super_admin' | 'admin' | 'manager' | 'user' | 'guest';

export interface AIAssignment {
  id: string;
  taskType: string;
  primaryModel: string;
  fallbackModel: string;
  allowedModels: string[];
  assignedBy: string; // super_admin, admin, or company-wide
  assignmentLevel: 'global' | 'company' | 'team' | 'user';
  priority: number;
  conditions?: Record<string, any>;
  createdAt: Date;
  expiresAt?: Date;
}

export interface SessionNote {
  id: string;
  sessionId: string;
  accountId: string;
  userId: string;
  agentId: string;
  modelId: string;
  timestamp: Date;
  noteType: 'context' | 'handoff' | 'summary' | 'preference' | 'error';
  content: string;
  metadata: Record<string, any>;
  expiresAt: Date; // Auto-destroy after 1 week
}

export interface AgentHandoff {
  fromAgent: string;
  fromModel: string;
  toAgent: string;
  toModel: string;
  reason: string;
  contextSummary: string;
  timestamp: Date;
  seamless: boolean; // If true, user doesn't notice the switch
}

export interface OrchestratorState {
  activeAssignments: Map<string, AIAssignment>;
  sessionNotes: Map<string, SessionNote[]>;
  handoffHistory: AgentHandoff[];
  modelPreferences: Map<string, string>; // userId -> preferred model
}

// ============================================
// TASK TYPE DEFINITIONS
// ============================================

export const TASK_TYPES = {
  // Image/Vision Tasks
  SCREENSHOT_ANALYSIS: 'screenshot_analysis',
  IMAGE_RECOGNITION: 'image_recognition',
  DOCUMENT_OCR: 'document_ocr',
  
  // Customer Interaction
  CUSTOMER_SERVICE: 'customer_service',
  LEAD_QUALIFICATION: 'lead_qualification',
  CHAT_SUPPORT: 'chat_support',
  
  // Code Tasks
  CODE_GENERATION: 'code_generation',
  CODE_REVIEW: 'code_review',
  DEBUGGING: 'debugging',
  REFACTORING: 'refactoring',
  
  // Analysis Tasks
  DATA_ANALYSIS: 'data_analysis',
  MARKET_RESEARCH: 'market_research',
  COMPETITOR_ANALYSIS: 'competitor_analysis',
  
  // Automation Tasks
  BROWSER_AUTOMATION: 'browser_automation',
  WORKFLOW_EXECUTION: 'workflow_execution',
  PATTERN_LEARNING: 'pattern_learning',
  
  // Content Tasks
  CONTENT_WRITING: 'content_writing',
  LISTING_GENERATION: 'listing_generation',
  EMAIL_DRAFTING: 'email_drafting',
  
  // Complex Tasks
  STRATEGIC_PLANNING: 'strategic_planning',
  COMPLEX_REASONING: 'complex_reasoning',
  MULTI_STEP_WORKFLOW: 'multi_step_workflow',
} as const;

// Default task-to-model mappings (can be overridden by admins)
export const DEFAULT_TASK_ASSIGNMENTS: Record<string, AIAssignment> = {
  [TASK_TYPES.SCREENSHOT_ANALYSIS]: {
    id: 'default-screenshot',
    taskType: TASK_TYPES.SCREENSHOT_ANALYSIS,
    primaryModel: 'claude-opus-4.5',
    fallbackModel: 'gpt-4o',
    allowedModels: ['claude-opus-4.5', 'gpt-4o', 'gemini-2.5-pro'],
    assignedBy: 'system',
    assignmentLevel: 'global',
    priority: 100,
    createdAt: new Date(),
  },
  [TASK_TYPES.IMAGE_RECOGNITION]: {
    id: 'default-image',
    taskType: TASK_TYPES.IMAGE_RECOGNITION,
    primaryModel: 'claude-opus-4.5',
    fallbackModel: 'gpt-4o',
    allowedModels: ['claude-opus-4.5', 'gpt-4o', 'gemini-2.5-pro'],
    assignedBy: 'system',
    assignmentLevel: 'global',
    priority: 100,
    createdAt: new Date(),
  },
  [TASK_TYPES.CUSTOMER_SERVICE]: {
    id: 'default-customer',
    taskType: TASK_TYPES.CUSTOMER_SERVICE,
    primaryModel: 'gpt-4o',
    fallbackModel: 'claude-sonnet-4',
    allowedModels: ['gpt-4o', 'claude-sonnet-4', 'gpt-5-mini'],
    assignedBy: 'system',
    assignmentLevel: 'global',
    priority: 90,
    createdAt: new Date(),
  },
  [TASK_TYPES.CODE_GENERATION]: {
    id: 'default-code-gen',
    taskType: TASK_TYPES.CODE_GENERATION,
    primaryModel: 'gpt-5.1-codex',
    fallbackModel: 'claude-sonnet-4.5',
    allowedModels: ['gpt-5.1-codex', 'gpt-5.1-codex-max', 'claude-sonnet-4.5', 'claude-opus-4.5'],
    assignedBy: 'system',
    assignmentLevel: 'global',
    priority: 85,
    createdAt: new Date(),
  },
  [TASK_TYPES.CODE_REVIEW]: {
    id: 'default-code-review',
    taskType: TASK_TYPES.CODE_REVIEW,
    primaryModel: 'claude-sonnet-4.5',
    fallbackModel: 'gpt-5.1-codex',
    allowedModels: ['claude-sonnet-4.5', 'gpt-5.1-codex', 'claude-opus-4.5'],
    assignedBy: 'system',
    assignmentLevel: 'global',
    priority: 85,
    createdAt: new Date(),
  },
  [TASK_TYPES.DEBUGGING]: {
    id: 'default-debug',
    taskType: TASK_TYPES.DEBUGGING,
    primaryModel: 'claude-opus-4.5',
    fallbackModel: 'gpt-5.1-codex',
    allowedModels: ['claude-opus-4.5', 'gpt-5.1-codex', 'claude-sonnet-4.5'],
    assignedBy: 'system',
    assignmentLevel: 'global',
    priority: 88,
    createdAt: new Date(),
  },
  [TASK_TYPES.DATA_ANALYSIS]: {
    id: 'default-data',
    taskType: TASK_TYPES.DATA_ANALYSIS,
    primaryModel: 'claude-opus-4.5',
    fallbackModel: 'gpt-5',
    allowedModels: ['claude-opus-4.5', 'gpt-5', 'gemini-2.5-pro'],
    assignedBy: 'system',
    assignmentLevel: 'global',
    priority: 85,
    createdAt: new Date(),
  },
  [TASK_TYPES.BROWSER_AUTOMATION]: {
    id: 'default-automation',
    taskType: TASK_TYPES.BROWSER_AUTOMATION,
    primaryModel: 'claude-sonnet-4',
    fallbackModel: 'claude-opus-4.5',
    allowedModels: ['claude-sonnet-4', 'claude-opus-4.5'],
    assignedBy: 'system',
    assignmentLevel: 'global',
    priority: 87,
    createdAt: new Date(),
  },
  [TASK_TYPES.CONTENT_WRITING]: {
    id: 'default-content',
    taskType: TASK_TYPES.CONTENT_WRITING,
    primaryModel: 'claude-sonnet-4.5',
    fallbackModel: 'gpt-4o',
    allowedModels: ['claude-sonnet-4.5', 'gpt-4o', 'claude-opus-4.5'],
    assignedBy: 'system',
    assignmentLevel: 'global',
    priority: 80,
    createdAt: new Date(),
  },
  [TASK_TYPES.LISTING_GENERATION]: {
    id: 'default-listing',
    taskType: TASK_TYPES.LISTING_GENERATION,
    primaryModel: 'gpt-4o',
    fallbackModel: 'claude-sonnet-4',
    allowedModels: ['gpt-4o', 'claude-sonnet-4', 'gpt-5-mini'],
    assignedBy: 'system',
    assignmentLevel: 'global',
    priority: 82,
    createdAt: new Date(),
  },
  [TASK_TYPES.COMPLEX_REASONING]: {
    id: 'default-reasoning',
    taskType: TASK_TYPES.COMPLEX_REASONING,
    primaryModel: 'claude-opus-4.5',
    fallbackModel: 'gpt-5',
    allowedModels: ['claude-opus-4.5', 'gpt-5', 'gpt-5.1'],
    assignedBy: 'system',
    assignmentLevel: 'global',
    priority: 95,
    createdAt: new Date(),
  },
  [TASK_TYPES.STRATEGIC_PLANNING]: {
    id: 'default-strategy',
    taskType: TASK_TYPES.STRATEGIC_PLANNING,
    primaryModel: 'gpt-5',
    fallbackModel: 'claude-opus-4.5',
    allowedModels: ['gpt-5', 'claude-opus-4.5', 'gpt-5.1'],
    assignedBy: 'system',
    assignmentLevel: 'global',
    priority: 92,
    createdAt: new Date(),
  },
};

// ============================================
// AI ORCHESTRATOR SERVICE
// ============================================

class AIOrchestrator extends EventEmitter {
  private state: OrchestratorState;
  private sessionCleanupInterval: NodeJS.Timeout | null = null;
  private readonly SESSION_NOTE_TTL = 7 * 24 * 60 * 60 * 1000; // 1 week in ms

  constructor() {
    super();
    this.state = {
      activeAssignments: new Map(Object.entries(DEFAULT_TASK_ASSIGNMENTS)),
      sessionNotes: new Map(),
      handoffHistory: [],
      modelPreferences: new Map(),
    };
    this.startSessionCleanup();
    logger.info('[AIOrchestrator] Initialized with default task assignments');
  }

  // ============================================
  // SESSION NOTE MANAGEMENT
  // ============================================

  /**
   * Add a session note (internal context for AI continuity)
   */
  addSessionNote(note: Omit<SessionNote, 'id' | 'timestamp' | 'expiresAt'>): SessionNote {
    const fullNote: SessionNote = {
      ...note,
      id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + this.SESSION_NOTE_TTL),
    };

    const sessionNotes = this.state.sessionNotes.get(note.sessionId) || [];
    sessionNotes.push(fullNote);
    this.state.sessionNotes.set(note.sessionId, sessionNotes);

    // Persist to database asynchronously
    this.persistSessionNote(fullNote).catch(err => 
      logger.error('[AIOrchestrator] Failed to persist session note:', err)
    );

    return fullNote;
  }

  /**
   * Get session notes for AI context
   */
  getSessionNotes(sessionId: string, options?: {
    noteType?: SessionNote['noteType'];
    limit?: number;
    includeHandoffs?: boolean;
  }): SessionNote[] {
    let notes = this.state.sessionNotes.get(sessionId) || [];
    
    // Filter by type if specified
    if (options?.noteType) {
      notes = notes.filter(n => n.noteType === options.noteType);
    }

    // Sort by timestamp descending
    notes.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Limit results
    if (options?.limit) {
      notes = notes.slice(0, options.limit);
    }

    return notes;
  }

  /**
   * Build context summary from session notes for handoff
   */
  buildContextSummary(sessionId: string): string {
    const notes = this.getSessionNotes(sessionId, { limit: 20 });
    if (notes.length === 0) return '';

    const contextParts: string[] = [];
    
    // Get recent context notes
    const contextNotes = notes.filter(n => n.noteType === 'context').slice(0, 5);
    if (contextNotes.length > 0) {
      contextParts.push('Recent Context:');
      contextNotes.forEach(n => contextParts.push(`- ${n.content}`));
    }

    // Get user preferences
    const prefNotes = notes.filter(n => n.noteType === 'preference');
    if (prefNotes.length > 0) {
      contextParts.push('\nUser Preferences:');
      prefNotes.forEach(n => contextParts.push(`- ${n.content}`));
    }

    // Get any error context
    const errorNotes = notes.filter(n => n.noteType === 'error').slice(0, 3);
    if (errorNotes.length > 0) {
      contextParts.push('\nRecent Issues:');
      errorNotes.forEach(n => contextParts.push(`- ${n.content}`));
    }

    return contextParts.join('\n');
  }

  private async persistSessionNote(note: SessionNote): Promise<void> {
    try {
      // Database persistence is optional - in-memory always works
      // Prisma schema needs migration before this will work
      logger.debug(`[AIOrchestrator] Session note stored in memory: ${note.id}`);
    } catch (error: any) {
      // Table might not exist yet - log but don't fail
      logger.debug('[AIOrchestrator] Database persistence skipped - table not migrated');
    }
  }

  private startSessionCleanup(): void {
    // Clean up expired notes every hour
    this.sessionCleanupInterval = setInterval(() => {
      this.cleanupExpiredNotes();
    }, 60 * 60 * 1000);
  }

  private async cleanupExpiredNotes(): Promise<void> {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, notes] of this.state.sessionNotes.entries()) {
      const validNotes = notes.filter(n => n.expiresAt.getTime() > now);
      cleanedCount += notes.length - validNotes.length;
      
      if (validNotes.length === 0) {
        this.state.sessionNotes.delete(sessionId);
      } else {
        this.state.sessionNotes.set(sessionId, validNotes);
      }
    }

    // Also clean database (if table exists)
    try {
      // Database cleanup is optional - in-memory always works
      logger.debug('[AIOrchestrator] In-memory cleanup complete');
    } catch (error) {
      // Table might not exist
    }

    if (cleanedCount > 0) {
      logger.info(`[AIOrchestrator] Cleaned up ${cleanedCount} expired session notes`);
    }
  }

  // ============================================
  // TASK ASSIGNMENT MANAGEMENT
  // ============================================

  /**
   * Get the assigned model for a task type
   * Respects hierarchy: user > team > company > global
   */
  getAssignmentForTask(taskType: string, context: {
    userId?: string;
    accountId?: string;
    teamId?: string;
    userRole?: UserHierarchy;
  }): AIAssignment | null {
    const assignments: AIAssignment[] = [];

    // Collect all matching assignments
    for (const [, assignment] of this.state.activeAssignments) {
      if (assignment.taskType === taskType) {
        // Check if assignment applies to this context
        if (this.assignmentApplies(assignment, context)) {
          assignments.push(assignment);
        }
      }
    }

    if (assignments.length === 0) {
      return DEFAULT_TASK_ASSIGNMENTS[taskType] || null;
    }

    // Sort by specificity (user > team > company > global) then priority
    assignments.sort((a, b) => {
      const levelOrder = { user: 4, team: 3, company: 2, global: 1 };
      const levelDiff = levelOrder[b.assignmentLevel] - levelOrder[a.assignmentLevel];
      return levelDiff !== 0 ? levelDiff : b.priority - a.priority;
    });

    return assignments[0];
  }

  private assignmentApplies(assignment: AIAssignment, context: {
    userId?: string;
    accountId?: string;
    teamId?: string;
  }): boolean {
    switch (assignment.assignmentLevel) {
      case 'global': return true;
      case 'company': return !!context.accountId;
      case 'team': return !!context.teamId;
      case 'user': return !!context.userId;
      default: return false;
    }
  }

  /**
   * Set a task assignment (requires proper hierarchy)
   */
  async setTaskAssignment(
    taskType: string,
    assignment: Omit<AIAssignment, 'id' | 'createdAt'>,
    setBy: {
      userId: string;
      userRole: UserHierarchy;
      accountId?: string;
    }
  ): Promise<{ success: boolean; error?: string; assignment?: AIAssignment }> {
    // Validate permissions
    const canSet = this.canSetAssignment(setBy.userRole, assignment.assignmentLevel);
    if (!canSet) {
      return { 
        success: false, 
        error: `User role ${setBy.userRole} cannot set ${assignment.assignmentLevel} level assignments` 
      };
    }

    // Validate models exist
    const primaryModel = COPILOT_MODELS[assignment.primaryModel];
    if (!primaryModel) {
      return { success: false, error: `Primary model ${assignment.primaryModel} not found` };
    }

    const fullAssignment: AIAssignment = {
      ...assignment,
      id: `assign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      taskType,
      createdAt: new Date(),
    };

    // Store assignment
    const key = this.getAssignmentKey(fullAssignment, setBy.accountId);
    this.state.activeAssignments.set(key, fullAssignment);

    // Persist to database
    await this.persistAssignment(fullAssignment, setBy);

    logger.info(`[AIOrchestrator] Task assignment set: ${taskType} -> ${assignment.primaryModel}`, {
      setBy: setBy.userId,
      level: assignment.assignmentLevel,
    });

    return { success: true, assignment: fullAssignment };
  }

  private canSetAssignment(userRole: UserHierarchy, assignmentLevel: AIAssignment['assignmentLevel']): boolean {
    const roleHierarchy: Record<UserHierarchy, number> = {
      super_admin: 100,
      admin: 80,
      manager: 60,
      user: 40,
      guest: 0,
    };

    const levelRequirements: Record<AIAssignment['assignmentLevel'], number> = {
      global: 100, // Only super_admin
      company: 80, // Admin or higher
      team: 60,    // Manager or higher
      user: 40,    // User can set own
    };

    return roleHierarchy[userRole] >= levelRequirements[assignmentLevel];
  }

  private getAssignmentKey(assignment: AIAssignment, accountId?: string): string {
    return `${assignment.assignmentLevel}:${accountId || 'global'}:${assignment.taskType}`;
  }

  private async persistAssignment(assignment: AIAssignment, _setBy: { userId: string; accountId?: string }): Promise<void> {
    try {
      // Database persistence is optional - in-memory always works
      logger.debug(`[AIOrchestrator] Task assignment stored in memory: ${assignment.taskType}`);
    } catch (error: any) {
      // Table might not exist yet
      logger.debug('[AIOrchestrator] Database persistence skipped - table not migrated');
    }
  }

  // ============================================
  // SEAMLESS AGENT HANDOFF
  // ============================================

  /**
   * Execute a seamless handoff between agents/models
   * User should not notice the switch
   */
  async executeHandoff(params: {
    sessionId: string;
    fromAgent: string;
    fromModel: string;
    toAgent: string;
    toModel: string;
    reason: string;
    preserveContext: boolean;
  }): Promise<AgentHandoff> {
    const contextSummary = params.preserveContext 
      ? this.buildContextSummary(params.sessionId)
      : '';

    const handoff: AgentHandoff = {
      fromAgent: params.fromAgent,
      fromModel: params.fromModel,
      toAgent: params.toAgent,
      toModel: params.toModel,
      reason: params.reason,
      contextSummary,
      timestamp: new Date(),
      seamless: true,
    };

    // Record handoff in history
    this.state.handoffHistory.push(handoff);
    if (this.state.handoffHistory.length > 1000) {
      this.state.handoffHistory.shift();
    }

    // Add handoff note to session (for the new agent to read)
    if (contextSummary) {
      this.addSessionNote({
        sessionId: params.sessionId,
        accountId: '', // Will be set from session
        userId: '',
        agentId: params.toAgent,
        modelId: params.toModel,
        noteType: 'handoff',
        content: `Handoff from ${params.fromAgent} (${params.fromModel}): ${params.reason}\n\nContext:\n${contextSummary}`,
        metadata: {
          fromAgent: params.fromAgent,
          fromModel: params.fromModel,
          reason: params.reason,
        },
      });
    }

    this.emit('handoff', handoff);
    
    logger.info(`[AIOrchestrator] Handoff executed: ${params.fromAgent} -> ${params.toAgent}`, {
      reason: params.reason,
      contextPreserved: params.preserveContext,
    });

    return handoff;
  }

  /**
   * Detect if a task requires a model switch
   */
  detectRequiredSwitch(currentModel: string, taskContext: {
    content: string;
    contentType?: string;
    taskType?: string;
    hasImages?: boolean;
    contextLength?: number;
  }): { needsSwitch: boolean; suggestedModel?: string; reason?: string } {
    const current = COPILOT_MODELS[currentModel];
    if (!current) {
      return { needsSwitch: false };
    }

    // Check for vision requirements
    if (taskContext.hasImages && !current.capabilities.includes('vision')) {
      return {
        needsSwitch: true,
        suggestedModel: 'claude-opus-4.5',
        reason: 'Task requires vision capabilities',
      };
    }

    // Check for long context
    if (taskContext.contextLength && taskContext.contextLength > current.contextWindow * 0.8) {
      const longerContextModel = this.findModelWithLongerContext(taskContext.contextLength);
      if (longerContextModel) {
        return {
          needsSwitch: true,
          suggestedModel: longerContextModel.id,
          reason: 'Context exceeds current model capacity',
        };
      }
    }

    // Check task type assignment
    if (taskContext.taskType) {
      const assignment = this.getAssignmentForTask(taskContext.taskType, {});
      if (assignment && assignment.primaryModel !== currentModel) {
        return {
          needsSwitch: true,
          suggestedModel: assignment.primaryModel,
          reason: `Task type ${taskContext.taskType} is assigned to ${assignment.primaryModel}`,
        };
      }
    }

    return { needsSwitch: false };
  }

  private findModelWithLongerContext(requiredLength: number): CopilotModel | null {
    const models = Object.values(COPILOT_MODELS)
      .filter(m => m.contextWindow > requiredLength)
      .sort((a, b) => a.contextWindow - b.contextWindow);
    return models[0] || null;
  }

  // ============================================
  // INTELLIGENT ROUTING
  // ============================================

  /**
   * Route a request to the optimal model based on all factors
   */
  routeRequest(params: {
    sessionId: string;
    userId?: string;
    accountId?: string;
    userRole?: UserHierarchy;
    content: string;
    contentType?: string;
    command?: string;
    taskType?: string;
    hasImages?: boolean;
    timeSensitive?: boolean;
  }): {
    model: CopilotModel;
    agent: string;
    reason: string;
    fromRule?: RoutingRule;
    fromAssignment?: AIAssignment;
  } {
    // 1. Check for explicit task assignment first (highest priority)
    if (params.taskType) {
      const assignment = this.getAssignmentForTask(params.taskType, {
        userId: params.userId,
        accountId: params.accountId,
        userRole: params.userRole,
      });

      if (assignment) {
        const model = COPILOT_MODELS[assignment.primaryModel];
        if (model) {
          return {
            model,
            agent: this.getAgentForModel(model.id),
            reason: `Task assignment: ${params.taskType}`,
            fromAssignment: assignment,
          };
        }
      }
    }

    // 2. Use copilot service routing (content-based)
    const routingResult = copilotModelService.routeToModel({
      content: params.content,
      contentType: params.contentType,
      command: params.command,
      contextLength: params.content.length,
      timeSensitive: params.timeSensitive,
    });

    return {
      model: routingResult.model,
      agent: this.getAgentForModel(routingResult.model.id),
      reason: routingResult.reason,
      fromRule: routingResult.rule || undefined,
    };
  }

  private getAgentForModel(modelId: string): string {
    const model = COPILOT_MODELS[modelId];
    if (!model) return 'nova';

    // Map model families to agents
    if (model.family === 'claude') {
      if (model.capabilities.includes('computer-use')) return 'soldier';
      return 'nova';
    }
    if (model.family === 'codex') return 'iai';
    return 'nova';
  }

  // ============================================
  // STATISTICS & MONITORING
  // ============================================

  getStats(): {
    totalSessions: number;
    totalNotes: number;
    totalHandoffs: number;
    activeAssignments: number;
    recentHandoffs: AgentHandoff[];
  } {
    let totalNotes = 0;
    for (const notes of this.state.sessionNotes.values()) {
      totalNotes += notes.length;
    }

    return {
      totalSessions: this.state.sessionNotes.size,
      totalNotes,
      totalHandoffs: this.state.handoffHistory.length,
      activeAssignments: this.state.activeAssignments.size,
      recentHandoffs: this.state.handoffHistory.slice(-10),
    };
  }

  /**
   * Get all task assignments grouped by level
   */
  getAllAssignments(): {
    global: AIAssignment[];
    company: AIAssignment[];
    team: AIAssignment[];
    user: AIAssignment[];
  } {
    const result = { global: [], company: [], team: [], user: [] } as Record<string, AIAssignment[]>;
    
    for (const assignment of this.state.activeAssignments.values()) {
      result[assignment.assignmentLevel].push(assignment);
    }

    return result as any;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
    }
    this.removeAllListeners();
  }
}

// Singleton export
export const aiOrchestrator = new AIOrchestrator();
