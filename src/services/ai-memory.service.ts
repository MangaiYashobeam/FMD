/**
 * AI Memory Service - Nova's Hierarchical Memory System
 * 
 * Memory Hierarchy (from most specific to global):
 * 1. USER - Individual user memories
 * 2. COMPANY - Account/company-wide memories
 * 3. ROLE - Role-specific memories (admin, manager, sales)
 * 4. GLOBAL - Nova's core knowledge (big brain)
 * 
 * Memory flows DOWN: Higher levels inform lower levels
 * Lower levels can't write to higher levels without permission
 * 
 * Memory Duration Configuration:
 * - SUPER_ADMIN: Unlimited memory (never expires)
 * - ADMIN/USER: 3 months memory retention
 * - GLOBAL: Never expires
 */

import prisma from '@/config/database';
import { logger } from '@/utils/logger';

// Memory Duration Config (in milliseconds)
export const MEMORY_DURATION = {
  SUPER_ADMIN: null, // Unlimited - never expires
  ADMIN: 90 * 24 * 60 * 60 * 1000, // 3 months
  USER: 90 * 24 * 60 * 60 * 1000,  // 3 months
  GLOBAL: null, // Never expires
};

// Memory Scopes (hierarchy order)
export enum MemoryScope {
  GLOBAL = 'global',   // Nova's core knowledge
  ROLE = 'role',       // Role-specific (admin, manager, sales)
  COMPANY = 'company', // Account/company specific
  USER = 'user',       // Individual user
}

// Memory Categories
export enum MemoryCategory {
  PREFERENCE = 'preference',    // User/company preferences
  CONTEXT = 'context',          // Contextual information
  LEARNED = 'learned',          // Learned from conversations
  FACT = 'fact',                // Factual information
  INSTRUCTION = 'instruction',  // How to do things
  PERSONALITY = 'personality',  // Personality traits for Nova
}

// User roles for role-based memory
export type UserRole = 'super_admin' | 'admin' | 'manager' | 'sales';

interface MemoryEntry {
  id: string;
  scope: MemoryScope;
  category: MemoryCategory;
  key: string;
  value: any;
  summary?: string;
  importance: number;
  userRole?: string;
  userId?: string;
  accountId?: string;
}

interface MemoryContext {
  userId: string;
  accountId?: string;
  userRole: UserRole;
}

interface CreateMemoryInput {
  scope: MemoryScope;
  category: MemoryCategory;
  key: string;
  value: any;
  summary?: string;
  importance?: number;
  expiresAt?: Date;
  sourceMessageId?: string;
}

class AIMemoryService {
  /**
   * Get all relevant memories for a user context
   * Retrieves memories from all applicable hierarchy levels
   */
  async getMemoriesForContext(context: MemoryContext, options: {
    categories?: MemoryCategory[];
    limit?: number;
    includeExpired?: boolean;
  } = {}): Promise<MemoryEntry[]> {
    const { userId, accountId, userRole } = context;
    const { categories, limit = 100, includeExpired = false } = options;

    const now = new Date();
    const baseWhere: any = {
      isActive: true,
    };

    if (!includeExpired) {
      baseWhere.OR = [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ];
    }

    if (categories?.length) {
      baseWhere.category = { in: categories };
    }

    // Build queries for each hierarchy level the user can access
    const queries: Promise<any[]>[] = [];

    // 1. GLOBAL memories (everyone can access)
    queries.push(
      prisma.aIUserMemory.findMany({
        where: {
          ...baseWhere,
          scope: MemoryScope.GLOBAL,
        },
        orderBy: [
          { importance: 'desc' },
          { accessCount: 'desc' },
        ],
        take: limit,
      })
    );

    // 2. ROLE memories (based on user's role)
    queries.push(
      prisma.aIUserMemory.findMany({
        where: {
          ...baseWhere,
          scope: MemoryScope.ROLE,
          userRole: userRole,
        },
        orderBy: [
          { importance: 'desc' },
          { accessCount: 'desc' },
        ],
        take: limit,
      })
    );

    // 3. COMPANY memories (if user has an account)
    if (accountId) {
      queries.push(
        prisma.aIUserMemory.findMany({
          where: {
            ...baseWhere,
            scope: MemoryScope.COMPANY,
            accountId: accountId,
          },
          orderBy: [
            { importance: 'desc' },
            { accessCount: 'desc' },
          ],
          take: limit,
        })
      );
    }

    // 4. USER memories (personal)
    queries.push(
      prisma.aIUserMemory.findMany({
        where: {
          ...baseWhere,
          scope: MemoryScope.USER,
          userId: userId,
        },
        orderBy: [
          { importance: 'desc' },
          { accessCount: 'desc' },
        ],
        take: limit,
      })
    );

    // Execute all queries in parallel
    const results = await Promise.all(queries);
    
    // Flatten and dedupe (user-level overrides higher levels for same key)
    const memoryMap = new Map<string, MemoryEntry>();
    
    // Process in reverse order (global first) so specific overrides general
    for (const memories of results) {
      for (const memory of memories) {
        const uniqueKey = `${memory.category}:${memory.key}`;
        memoryMap.set(uniqueKey, memory);
      }
    }

    // Sort by importance and return
    const allMemories = Array.from(memoryMap.values());
    allMemories.sort((a, b) => b.importance - a.importance);

    // Update access counts (fire and forget)
    this.updateAccessCounts(allMemories.map(m => m.id)).catch(err => 
      logger.error('Failed to update memory access counts:', err)
    );

    return allMemories.slice(0, limit);
  }

  /**
   * Get a specific memory by key
   */
  async getMemory(
    context: MemoryContext,
    category: MemoryCategory,
    key: string
  ): Promise<MemoryEntry | null> {
    const { userId, accountId, userRole } = context;

    // Search from most specific to most general
    const scopes = [
      { scope: MemoryScope.USER, userId },
      { scope: MemoryScope.COMPANY, accountId },
      { scope: MemoryScope.ROLE, userRole },
      { scope: MemoryScope.GLOBAL },
    ].filter(s => s.accountId !== undefined || s.scope !== MemoryScope.COMPANY);

    for (const scopeQuery of scopes) {
      const memory = await prisma.aIUserMemory.findFirst({
        where: {
          category,
          key,
          isActive: true,
          ...(scopeQuery.scope === MemoryScope.USER && { userId: scopeQuery.userId }),
          ...(scopeQuery.scope === MemoryScope.COMPANY && { accountId: scopeQuery.accountId }),
          ...(scopeQuery.scope === MemoryScope.ROLE && { userRole: scopeQuery.userRole }),
          ...(scopeQuery.scope === MemoryScope.GLOBAL && { scope: MemoryScope.GLOBAL }),
        },
      });

      if (memory) {
        // Update access count
        await prisma.aIUserMemory.update({
          where: { id: memory.id },
          data: {
            accessCount: { increment: 1 },
            lastAccessed: new Date(),
          },
        });
        return memory as MemoryEntry;
      }
    }

    return null;
  }

  /**
   * Create a new memory
   * Applies automatic expiration based on user role:
   * - SUPER_ADMIN: Unlimited (no expiration)
   * - ADMIN/USER: 3 months
   * - GLOBAL scope: Never expires
   */
  async createMemory(
    context: MemoryContext,
    input: CreateMemoryInput
  ): Promise<MemoryEntry> {
    const { userId, accountId, userRole } = context;
    const { scope, category, key, value, summary, importance = 0.5, expiresAt, sourceMessageId } = input;

    // Validate scope permissions
    this.validateScopePermission(userRole, scope);

    // Calculate expiration based on role and scope
    let calculatedExpiry = expiresAt;
    if (!calculatedExpiry && scope !== MemoryScope.GLOBAL) {
      // Apply role-based expiration
      const durationKey = userRole.toUpperCase() as keyof typeof MEMORY_DURATION;
      const duration = MEMORY_DURATION[durationKey] || MEMORY_DURATION.USER;
      if (duration !== null) {
        calculatedExpiry = new Date(Date.now() + duration);
      }
      // If duration is null (super_admin), no expiration is set
    }

    const memory = await prisma.aIUserMemory.create({
      data: {
        userId,
        accountId,
        scope,
        userRole: scope === MemoryScope.ROLE ? userRole : null,
        category,
        key,
        value,
        summary,
        importance,
        expiresAt: calculatedExpiry,
        sourceMessageId,
        source: sourceMessageId ? 'conversation' : 'manual',
      },
    });

    logger.info(`Memory created: ${scope}/${category}/${key} by user ${userId}, expires: ${calculatedExpiry || 'never'}`);
    return memory as MemoryEntry;
  }

  /**
   * Update an existing memory
   */
  async updateMemory(
    context: MemoryContext,
    memoryId: string,
    updates: Partial<Pick<CreateMemoryInput, 'value' | 'summary' | 'importance' | 'expiresAt'>>
  ): Promise<MemoryEntry | null> {
    const { userId } = context;

    // Get the memory first to check permissions
    const existing = await prisma.aIUserMemory.findUnique({
      where: { id: memoryId },
    });

    if (!existing) {
      return null;
    }

    // Check if user can modify this memory
    if (!this.canModifyMemory(context, existing as MemoryEntry)) {
      throw new Error('Insufficient permissions to modify this memory');
    }

    const updated = await prisma.aIUserMemory.update({
      where: { id: memoryId },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });

    logger.info(`Memory updated: ${memoryId} by user ${userId}`);
    return updated as MemoryEntry;
  }

  /**
   * Delete a memory (soft delete)
   */
  async deleteMemory(context: MemoryContext, memoryId: string): Promise<boolean> {
    const existing = await prisma.aIUserMemory.findUnique({
      where: { id: memoryId },
    });

    if (!existing) {
      return false;
    }

    if (!this.canModifyMemory(context, existing as MemoryEntry)) {
      throw new Error('Insufficient permissions to delete this memory');
    }

    await prisma.aIUserMemory.update({
      where: { id: memoryId },
      data: { isActive: false },
    });

    logger.info(`Memory deleted: ${memoryId} by user ${context.userId}`);
    return true;
  }

  /**
   * Store a memory learned from conversation
   */
  async learnFromConversation(
    context: MemoryContext,
    messageId: string,
    learnings: Array<{
      category: MemoryCategory;
      key: string;
      value: any;
      summary: string;
      importance?: number;
    }>
  ): Promise<MemoryEntry[]> {
    const created: MemoryEntry[] = [];

    for (const learning of learnings) {
      try {
        // User-level memories from conversations
        const memory = await this.createMemory(context, {
          scope: MemoryScope.USER,
          category: learning.category,
          key: learning.key,
          value: learning.value,
          summary: learning.summary,
          importance: learning.importance || 0.6,
          sourceMessageId: messageId,
        });
        created.push(memory);
      } catch (err) {
        logger.error(`Failed to create learning memory:`, err);
      }
    }

    return created;
  }

  /**
   * Get memories formatted for AI context
   */
  async getContextForAI(context: MemoryContext): Promise<string> {
    const memories = await this.getMemoriesForContext(context, {
      limit: 50,
    });

    if (memories.length === 0) {
      return '';
    }

    // Group by category
    const grouped: Record<string, MemoryEntry[]> = {};
    for (const memory of memories) {
      if (!grouped[memory.category]) {
        grouped[memory.category] = [];
      }
      grouped[memory.category].push(memory);
    }

    // Format for AI consumption
    let contextStr = '## Your Memory (What you know about this user/context):\n\n';

    for (const [category, mems] of Object.entries(grouped)) {
      contextStr += `### ${category.charAt(0).toUpperCase() + category.slice(1)}:\n`;
      for (const mem of mems) {
        const scopeLabel = mem.scope === MemoryScope.GLOBAL ? '(Global)' : 
                          mem.scope === MemoryScope.ROLE ? `(${mem.userRole})` :
                          mem.scope === MemoryScope.COMPANY ? '(Company)' : '(Personal)';
        contextStr += `- ${mem.key}: ${mem.summary || JSON.stringify(mem.value)} ${scopeLabel}\n`;
      }
      contextStr += '\n';
    }

    return contextStr;
  }

  /**
   * Initialize global Nova memories (big brain foundation)
   */
  async initializeGlobalMemories(): Promise<void> {
    const globalMemories = [
      {
        category: MemoryCategory.PERSONALITY,
        key: 'identity',
        value: { name: 'Nova', role: 'AI Assistant' },
        summary: 'I am Nova, the AI assistant for Dealers Face platform',
        importance: 1.0,
      },
      {
        category: MemoryCategory.PERSONALITY,
        key: 'tone',
        value: { style: 'professional', friendly: true, helpful: true },
        summary: 'I communicate professionally but warmly, always aiming to be helpful',
        importance: 0.9,
      },
      {
        category: MemoryCategory.INSTRUCTION,
        key: 'platform_purpose',
        value: { purpose: 'Facebook Marketplace automation for car dealers' },
        summary: 'Dealers Face helps auto dealers post vehicles to Facebook Marketplace',
        importance: 0.95,
      },
      {
        category: MemoryCategory.INSTRUCTION,
        key: 'capabilities',
        value: { 
          can: ['answer questions', 'help with listings', 'analyze data', 'provide guidance'],
          cannot: ['access external systems directly', 'make purchases', 'share private data']
        },
        summary: 'I can help with questions, listings, data analysis, and platform guidance',
        importance: 0.9,
      },
    ];

    for (const mem of globalMemories) {
      const existing = await prisma.aIUserMemory.findFirst({
        where: {
          scope: MemoryScope.GLOBAL,
          category: mem.category,
          key: mem.key,
        },
      });

      if (!existing) {
        await prisma.aIUserMemory.create({
          data: {
            userId: 'system',
            scope: MemoryScope.GLOBAL,
            category: mem.category,
            key: mem.key,
            value: mem.value,
            summary: mem.summary,
            importance: mem.importance,
            source: 'system',
          },
        });
        logger.info(`Initialized global memory: ${mem.key}`);
      }
    }
  }

  /**
   * Initialize role-specific memories
   */
  async initializeRoleMemories(): Promise<void> {
    const roleMemories: Array<{ role: UserRole; memories: any[] }> = [
      {
        role: 'super_admin',
        memories: [
          {
            category: MemoryCategory.INSTRUCTION,
            key: 'access_level',
            value: { level: 'full', canImpersonate: true, canManageAll: true },
            summary: 'Super Admin has full platform access including impersonation',
            importance: 1.0,
          },
        ],
      },
      {
        role: 'admin',
        memories: [
          {
            category: MemoryCategory.INSTRUCTION,
            key: 'access_level',
            value: { level: 'account', canManageTeam: true, canViewReports: true },
            summary: 'Admin can manage their dealership team and view all reports',
            importance: 1.0,
          },
        ],
      },
      {
        role: 'manager',
        memories: [
          {
            category: MemoryCategory.INSTRUCTION,
            key: 'access_level',
            value: { level: 'team', canAssignTasks: true, canViewTeamReports: true },
            summary: 'Manager can assign tasks and view team performance',
            importance: 1.0,
          },
        ],
      },
      {
        role: 'sales',
        memories: [
          {
            category: MemoryCategory.INSTRUCTION,
            key: 'access_level',
            value: { level: 'personal', canPostListings: true, canRespondLeads: true },
            summary: 'Sales can post listings and respond to their assigned leads',
            importance: 1.0,
          },
        ],
      },
    ];

    for (const roleData of roleMemories) {
      for (const mem of roleData.memories) {
        const existing = await prisma.aIUserMemory.findFirst({
          where: {
            scope: MemoryScope.ROLE,
            userRole: roleData.role,
            category: mem.category,
            key: mem.key,
          },
        });

        if (!existing) {
          await prisma.aIUserMemory.create({
            data: {
              userId: 'system',
              scope: MemoryScope.ROLE,
              userRole: roleData.role,
              category: mem.category,
              key: mem.key,
              value: mem.value,
              summary: mem.summary,
              importance: mem.importance,
              source: 'system',
            },
          });
          logger.info(`Initialized ${roleData.role} memory: ${mem.key}`);
        }
      }
    }
  }

  // ============================================
  // Private Helpers
  // ============================================

  private validateScopePermission(userRole: UserRole, scope: MemoryScope): void {
    // Super admin can write to any scope
    if (userRole === 'super_admin') return;

    // Admin can write to company and below
    if (userRole === 'admin' && scope === MemoryScope.GLOBAL) {
      throw new Error('Only super_admin can write global memories');
    }

    // Manager can write to user scope only
    if (userRole === 'manager' && [MemoryScope.GLOBAL, MemoryScope.ROLE, MemoryScope.COMPANY].includes(scope)) {
      throw new Error('Managers can only write user-level memories');
    }

    // Sales can only write user scope
    if (userRole === 'sales' && scope !== MemoryScope.USER) {
      throw new Error('Sales users can only write user-level memories');
    }
  }

  private canModifyMemory(context: MemoryContext, memory: MemoryEntry): boolean {
    const { userId, accountId, userRole } = context;

    // Super admin can modify anything
    if (userRole === 'super_admin') return true;

    // Users can modify their own memories
    if (memory.scope === MemoryScope.USER && memory.userId === userId) return true;

    // Admins can modify company memories
    if (userRole === 'admin' && memory.scope === MemoryScope.COMPANY && memory.accountId === accountId) {
      return true;
    }

    return false;
  }

  private async updateAccessCounts(memoryIds: string[]): Promise<void> {
    if (memoryIds.length === 0) return;

    await prisma.aIUserMemory.updateMany({
      where: { id: { in: memoryIds } },
      data: {
        accessCount: { increment: 1 },
        lastAccessed: new Date(),
      },
    });
  }
}

export const aiMemoryService = new AIMemoryService();
export default aiMemoryService;
