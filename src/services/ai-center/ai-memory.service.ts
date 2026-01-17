/**
 * AI Memory Service
 * 
 * Manages persistent shared memory for AI agents including:
 * - Dealer profiles and preferences
 * - Inventory knowledge
 * - Customer patterns and history
 * - Conversation context
 * - Learned responses and strategies
 * - Threat patterns
 * 
 * Features:
 * - Semantic search with embeddings
 * - Memory importance decay
 * - Version control for memories
 * - Automatic memory consolidation
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '@/utils/logger';
import OpenAI from 'openai';

const prisma = new PrismaClient();

// ============================================
// Types
// ============================================

export type MemoryType = 
  | 'dealer_profile'
  | 'inventory'
  | 'customer_patterns'
  | 'conversation_context'
  | 'learned_responses'
  | 'threat_patterns'
  | 'pricing_strategies'
  | 'negotiation_tactics'
  | 'objection_handling'
  | 'vehicle_knowledge'
  | 'market_data'
  | 'competitor_info';

export interface MemoryEntry {
  id?: string;
  providerId: string;
  accountId: string;
  memoryType: MemoryType;
  key: string;
  value: Record<string, unknown>;
  embedding?: number[];
  confidence?: number;
  source?: string;
  context?: Record<string, unknown>;
  tags?: string[];
  importance?: number;
  expiresAt?: Date;
}

export interface MemorySearchOptions {
  providerId?: string;
  accountId: string;
  memoryType?: MemoryType;
  tags?: string[];
  minImportance?: number;
  limit?: number;
  includeExpired?: boolean;
}

export interface SemanticSearchOptions extends MemorySearchOptions {
  query: string;
  similarityThreshold?: number;
}

// ============================================
// AI Memory Service
// ============================================

export class AIMemoryService {
  private openai: OpenAI | null = null;
  private embeddingModel = 'text-embedding-3-small';

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
  }

  // ============================================
  // Memory CRUD Operations
  // ============================================

  /**
   * Store a memory entry
   */
  async store(entry: MemoryEntry): Promise<string> {
    try {
      // Generate embedding for semantic search
      const embedding = await this.generateEmbedding(
        `${entry.key}: ${JSON.stringify(entry.value)}`
      );

      const memory = await prisma.aIMemory.upsert({
        where: {
          providerId_memoryType_key: {
            providerId: entry.providerId,
            memoryType: entry.memoryType,
            key: entry.key,
          },
        },
        create: {
          providerId: entry.providerId,
          accountId: entry.accountId,
          memoryType: entry.memoryType,
          key: entry.key,
          value: entry.value as Prisma.JsonObject,
          embedding: embedding || undefined,
          confidence: entry.confidence ?? 1.0,
          source: entry.source,
          context: entry.context as Prisma.JsonObject,
          tags: entry.tags ?? [],
          importance: entry.importance ?? 0.5,
          expiresAt: entry.expiresAt,
        },
        update: {
          value: entry.value as Prisma.JsonObject,
          embedding: embedding || undefined,
          confidence: entry.confidence,
          context: entry.context as Prisma.JsonObject,
          tags: entry.tags,
          importance: entry.importance,
          expiresAt: entry.expiresAt,
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      logger.info(`Memory stored: ${entry.memoryType}/${entry.key}`);
      return memory.id;
    } catch (error) {
      logger.error('Failed to store memory:', error);
      throw error;
    }
  }

  /**
   * Store multiple memories at once
   */
  async storeBatch(entries: MemoryEntry[]): Promise<string[]> {
    const results: string[] = [];
    
    for (const entry of entries) {
      try {
        const id = await this.store(entry);
        results.push(id);
      } catch (error) {
        logger.error(`Failed to store memory ${entry.key}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Retrieve a specific memory
   */
  async retrieve(
    providerId: string,
    memoryType: MemoryType,
    key: string
  ): Promise<MemoryEntry | null> {
    try {
      const memory = await prisma.aIMemory.findUnique({
        where: {
          providerId_memoryType_key: {
            providerId,
            memoryType,
            key,
          },
        },
      });

      if (!memory || !memory.isActive) return null;

      // Update access count and last accessed
      await prisma.aIMemory.update({
        where: { id: memory.id },
        data: {
          accessCount: { increment: 1 },
          lastAccessed: new Date(),
        },
      });

      return this.toMemoryEntry(memory);
    } catch (error) {
      logger.error('Failed to retrieve memory:', error);
      return null;
    }
  }

  /**
   * Search memories by criteria
   */
  async search(options: MemorySearchOptions): Promise<MemoryEntry[]> {
    try {
      const where: Prisma.AIMemoryWhereInput = {
        accountId: options.accountId,
        isActive: true,
      };

      if (options.providerId) {
        where.providerId = options.providerId;
      }

      if (options.memoryType) {
        where.memoryType = options.memoryType;
      }

      if (options.tags && options.tags.length > 0) {
        where.tags = { hasSome: options.tags };
      }

      if (options.minImportance) {
        where.importance = { gte: options.minImportance };
      }

      if (!options.includeExpired) {
        where.OR = [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ];
      }

      const memories = await prisma.aIMemory.findMany({
        where,
        orderBy: [
          { importance: 'desc' },
          { accessCount: 'desc' },
          { updatedAt: 'desc' },
        ],
        take: options.limit ?? 100,
      });

      return memories.map(m => this.toMemoryEntry(m));
    } catch (error) {
      logger.error('Failed to search memories:', error);
      return [];
    }
  }

  /**
   * Semantic search using embeddings
   */
  async semanticSearch(options: SemanticSearchOptions): Promise<MemoryEntry[]> {
    try {
      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(options.query);
      
      if (!queryEmbedding) {
        // Fall back to keyword search
        return this.keywordSearch(options);
      }

      // Get all candidate memories
      const memories = await this.search({
        ...options,
        limit: options.limit ? options.limit * 3 : 300, // Get more to filter by similarity
      });

      // Calculate cosine similarity and filter
      const threshold = options.similarityThreshold ?? 0.7;
      const scoredMemories = memories
        .map(memory => ({
          memory,
          similarity: memory.embedding 
            ? this.cosineSimilarity(queryEmbedding, memory.embedding)
            : 0,
        }))
        .filter(item => item.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, options.limit ?? 10);

      return scoredMemories.map(item => item.memory);
    } catch (error) {
      logger.error('Semantic search failed:', error);
      return this.keywordSearch(options);
    }
  }

  /**
   * Keyword-based search fallback
   */
  private async keywordSearch(options: SemanticSearchOptions): Promise<MemoryEntry[]> {
    const words = options.query.toLowerCase().split(/\s+/);
    
    const memories = await this.search({
      accountId: options.accountId,
      providerId: options.providerId,
      memoryType: options.memoryType,
      limit: (options.limit ?? 10) * 2,
    });

    // Score by keyword matches
    const scored = memories.map(memory => {
      const text = `${memory.key} ${JSON.stringify(memory.value)}`.toLowerCase();
      const matches = words.filter(word => text.includes(word)).length;
      return { memory, score: matches / words.length };
    });

    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit ?? 10)
      .map(item => item.memory);
  }

  /**
   * Delete a memory
   */
  async delete(id: string): Promise<boolean> {
    try {
      await prisma.aIMemory.update({
        where: { id },
        data: { isActive: false },
      });
      return true;
    } catch (error) {
      logger.error('Failed to delete memory:', error);
      return false;
    }
  }

  /**
   * Hard delete a memory
   */
  async hardDelete(id: string): Promise<boolean> {
    try {
      await prisma.aIMemory.delete({ where: { id } });
      return true;
    } catch (error) {
      logger.error('Failed to hard delete memory:', error);
      return false;
    }
  }

  // ============================================
  // Specialized Memory Operations
  // ============================================

  /**
   * Store dealer profile information
   */
  async storeDealerProfile(
    providerId: string,
    accountId: string,
    profile: {
      businessName: string;
      address: string;
      phone: string;
      email?: string;
      hours?: Record<string, string>;
      policies?: Record<string, string>;
      specialties?: string[];
      preferredBrands?: string[];
      salesApproach?: string;
      uniqueSellingPoints?: string[];
    }
  ): Promise<void> {
    const entries: MemoryEntry[] = [
      {
        providerId,
        accountId,
        memoryType: 'dealer_profile',
        key: 'basic_info',
        value: {
          businessName: profile.businessName,
          address: profile.address,
          phone: profile.phone,
          email: profile.email,
        },
        importance: 1.0,
        tags: ['profile', 'contact', 'essential'],
      },
      {
        providerId,
        accountId,
        memoryType: 'dealer_profile',
        key: 'operating_hours',
        value: profile.hours || {},
        importance: 0.9,
        tags: ['profile', 'hours'],
      },
      {
        providerId,
        accountId,
        memoryType: 'dealer_profile',
        key: 'policies',
        value: profile.policies || {},
        importance: 0.85,
        tags: ['profile', 'policies', 'rules'],
      },
      {
        providerId,
        accountId,
        memoryType: 'dealer_profile',
        key: 'specialties',
        value: {
          specialties: profile.specialties || [],
          preferredBrands: profile.preferredBrands || [],
          uniqueSellingPoints: profile.uniqueSellingPoints || [],
        },
        importance: 0.8,
        tags: ['profile', 'specialties', 'brands'],
      },
      {
        providerId,
        accountId,
        memoryType: 'dealer_profile',
        key: 'sales_approach',
        value: { approach: profile.salesApproach || 'professional_friendly' },
        importance: 0.9,
        tags: ['profile', 'sales', 'style'],
      },
    ];

    await this.storeBatch(entries);
  }

  /**
   * Store vehicle inventory knowledge
   */
  async storeVehicleKnowledge(
    providerId: string,
    accountId: string,
    vehicle: {
      id: string;
      vin?: string;
      year: number;
      make: string;
      model: string;
      trim?: string;
      price: number;
      mileage: number;
      condition?: string;
      features?: string[];
      history?: Record<string, unknown>;
      carfaxUrl?: string;
      photos?: string[];
      notes?: string;
    }
  ): Promise<void> {
    await this.store({
      providerId,
      accountId,
      memoryType: 'inventory',
      key: `vehicle_${vehicle.id}`,
      value: vehicle,
      importance: 0.8,
      tags: ['inventory', vehicle.make.toLowerCase(), vehicle.model.toLowerCase()],
      context: {
        vehicleId: vehicle.id,
        priceRange: this.getPriceRange(vehicle.price),
        yearRange: this.getYearRange(vehicle.year),
      },
    });
  }

  /**
   * Store customer interaction pattern
   */
  async storeCustomerPattern(
    providerId: string,
    accountId: string,
    pattern: {
      customerId?: string;
      patternType: string; // inquiry_style, negotiation_behavior, communication_preference
      pattern: Record<string, unknown>;
      effectiveness?: number;
    }
  ): Promise<void> {
    const key = pattern.customerId 
      ? `customer_${pattern.customerId}_${pattern.patternType}`
      : `general_${pattern.patternType}_${Date.now()}`;

    await this.store({
      providerId,
      accountId,
      memoryType: 'customer_patterns',
      key,
      value: pattern.pattern,
      importance: pattern.customerId ? 0.7 : 0.6,
      confidence: pattern.effectiveness ?? 0.5,
      tags: ['customer', pattern.patternType],
    });
  }

  /**
   * Store learned response strategy
   */
  async storeLearnedResponse(
    providerId: string,
    accountId: string,
    response: {
      scenario: string;
      trigger: string;
      response: string;
      effectiveness: number;
      sampleSize: number;
    }
  ): Promise<void> {
    await this.store({
      providerId,
      accountId,
      memoryType: 'learned_responses',
      key: `response_${response.scenario}_${Date.now()}`,
      value: {
        trigger: response.trigger,
        response: response.response,
        sampleSize: response.sampleSize,
      },
      confidence: response.effectiveness,
      importance: Math.min(0.5 + (response.effectiveness * 0.5), 1.0),
      tags: ['response', response.scenario],
    });
  }

  /**
   * Get full context for AI conversation
   */
  async getConversationContext(
    providerId: string,
    accountId: string,
    vehicleId?: string,
    customerId?: string
  ): Promise<{
    dealerProfile: Record<string, unknown>;
    vehicleInfo?: Record<string, unknown>;
    customerHistory?: Record<string, unknown>;
    learnedResponses: MemoryEntry[];
    relevantPatterns: MemoryEntry[];
  }> {
    // Get dealer profile
    const profileMemories = await this.search({
      providerId,
      accountId,
      memoryType: 'dealer_profile',
    });

    const dealerProfile: Record<string, unknown> = {};
    profileMemories.forEach(m => {
      dealerProfile[m.key] = m.value;
    });

    // Get vehicle info if provided
    let vehicleInfo: Record<string, unknown> | undefined;
    if (vehicleId) {
      const vehicleMemory = await this.retrieve(
        providerId,
        'inventory',
        `vehicle_${vehicleId}`
      );
      if (vehicleMemory) {
        vehicleInfo = vehicleMemory.value;
      }
    }

    // Get customer history if provided
    let customerHistory: Record<string, unknown> | undefined;
    if (customerId) {
      const customerMemories = await this.search({
        providerId,
        accountId,
        memoryType: 'customer_patterns',
        tags: [customerId],
        limit: 20,
      });
      if (customerMemories.length > 0) {
        customerHistory = {
          patterns: customerMemories.map(m => m.value),
        };
      }
    }

    // Get learned responses
    const learnedResponses = await this.search({
      providerId,
      accountId,
      memoryType: 'learned_responses',
      minImportance: 0.6,
      limit: 20,
    });

    // Get relevant patterns
    const relevantPatterns = await this.search({
      providerId,
      accountId,
      memoryType: 'negotiation_tactics',
      minImportance: 0.6,
      limit: 10,
    });

    return {
      dealerProfile,
      vehicleInfo,
      customerHistory,
      learnedResponses,
      relevantPatterns,
    };
  }

  // ============================================
  // Memory Maintenance
  // ============================================

  /**
   * Apply importance decay to old memories
   */
  async applyDecay(accountId: string, decayFactor = 0.995): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await prisma.aIMemory.updateMany({
      where: {
        accountId,
        lastAccessed: { lt: thirtyDaysAgo },
        importance: { gt: 0.1 },
      },
      data: {
        importance: { multiply: decayFactor },
      },
    });

    return result.count;
  }

  /**
   * Clean up expired memories
   */
  async cleanupExpired(accountId: string): Promise<number> {
    const result = await prisma.aIMemory.deleteMany({
      where: {
        accountId,
        expiresAt: { lt: new Date() },
      },
    });

    return result.count;
  }

  /**
   * Consolidate similar memories
   */
  async consolidate(
    providerId: string,
    accountId: string,
    memoryType: MemoryType
  ): Promise<number> {
    // Get all memories of type
    const memories = await this.search({
      providerId,
      accountId,
      memoryType,
      limit: 1000,
    });

    if (memories.length < 2) return 0;

    // Find similar memories using embeddings
    const consolidated: Set<string> = new Set();
    let count = 0;

    for (let i = 0; i < memories.length; i++) {
      if (consolidated.has(memories[i].id!)) continue;

      const similar: MemoryEntry[] = [memories[i]];

      for (let j = i + 1; j < memories.length; j++) {
        if (consolidated.has(memories[j].id!)) continue;

        if (memories[i].embedding && memories[j].embedding) {
          const similarity = this.cosineSimilarity(
            memories[i].embedding!,
            memories[j].embedding!
          );

          if (similarity > 0.9) {
            similar.push(memories[j]);
            consolidated.add(memories[j].id!);
          }
        }
      }

      // Merge similar memories
      if (similar.length > 1) {
        await this.mergeMemories(similar);
        count += similar.length - 1;
      }
    }

    return count;
  }

  /**
   * Merge similar memories into one
   */
  private async mergeMemories(memories: MemoryEntry[]): Promise<void> {
    // Keep the one with highest importance
    const sorted = memories.sort((a, b) => 
      (b.importance ?? 0) - (a.importance ?? 0)
    );

    const primary = sorted[0];
    const others = sorted.slice(1);

    // Merge context and tags
    const mergedTags = new Set(primary.tags ?? []);
    const mergedContext: Record<string, unknown> = { ...(primary.context ?? {}) };

    for (const memory of others) {
      (memory.tags ?? []).forEach(tag => mergedTags.add(tag));
      Object.assign(mergedContext, memory.context ?? {});
      mergedContext[`merged_from_${memory.id}`] = memory.key;
    }

    // Update primary memory
    await prisma.aIMemory.update({
      where: { id: primary.id },
      data: {
        tags: Array.from(mergedTags),
        context: mergedContext as Prisma.JsonObject,
        accessCount: { increment: others.reduce((sum, m) => sum + (m as any).accessCount || 0, 0) },
      },
    });

    // Delete merged memories
    for (const memory of others) {
      await this.delete(memory.id!);
    }
  }

  /**
   * Get memory statistics
   */
  async getStats(accountId: string): Promise<{
    totalMemories: number;
    byType: Record<string, number>;
    avgImportance: number;
    mostAccessed: MemoryEntry[];
    recentlyUpdated: MemoryEntry[];
  }> {
    const memories = await prisma.aIMemory.findMany({
      where: { accountId, isActive: true },
    });

    const byType: Record<string, number> = {};
    let totalImportance = 0;

    memories.forEach(m => {
      byType[m.memoryType] = (byType[m.memoryType] || 0) + 1;
      totalImportance += m.importance;
    });

    const mostAccessed = await prisma.aIMemory.findMany({
      where: { accountId, isActive: true },
      orderBy: { accessCount: 'desc' },
      take: 10,
    });

    const recentlyUpdated = await prisma.aIMemory.findMany({
      where: { accountId, isActive: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    return {
      totalMemories: memories.length,
      byType,
      avgImportance: memories.length > 0 ? totalImportance / memories.length : 0,
      mostAccessed: mostAccessed.map(m => this.toMemoryEntry(m)),
      recentlyUpdated: recentlyUpdated.map(m => this.toMemoryEntry(m)),
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Generate embedding vector for text
   */
  private async generateEmbedding(text: string): Promise<number[] | null> {
    if (!this.openai) return null;

    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text.slice(0, 8000), // Limit input length
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      return null;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Convert Prisma model to MemoryEntry
   */
  private toMemoryEntry(model: any): MemoryEntry {
    return {
      id: model.id,
      providerId: model.providerId,
      accountId: model.accountId,
      memoryType: model.memoryType as MemoryType,
      key: model.key,
      value: model.value as Record<string, unknown>,
      embedding: model.embedding,
      confidence: model.confidence,
      source: model.source,
      context: model.context as Record<string, unknown>,
      tags: model.tags,
      importance: model.importance,
      expiresAt: model.expiresAt,
    };
  }

  /**
   * Get price range category
   */
  private getPriceRange(price: number): string {
    if (price < 10000) return 'budget';
    if (price < 25000) return 'economy';
    if (price < 45000) return 'mid-range';
    if (price < 75000) return 'premium';
    return 'luxury';
  }

  /**
   * Get year range category
   */
  private getYearRange(year: number): string {
    const currentYear = new Date().getFullYear();
    const age = currentYear - year;
    
    if (age <= 1) return 'new';
    if (age <= 3) return 'nearly-new';
    if (age <= 6) return 'used';
    if (age <= 10) return 'older';
    return 'classic';
  }
}

// Export singleton instance
export const aiMemoryService = new AIMemoryService();
export default aiMemoryService;
