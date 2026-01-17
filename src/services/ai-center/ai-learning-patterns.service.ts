/**
 * AI Learning Patterns Service
 * 
 * Exhaustive and advanced learning pattern system:
 * - Success pattern identification
 * - Response effectiveness tracking
 * - Negotiation tactic learning
 * - Objection handling patterns
 * - Continuous improvement algorithms
 * - Pattern discovery and optimization
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';
import { aiMemoryService } from './ai-memory.service';

const prisma = new PrismaClient();

// ============================================
// Types
// ============================================

export type PatternCategory =
  | 'response_template'
  | 'negotiation_tactic'
  | 'objection_handler'
  | 'closing_technique'
  | 'rapport_builder'
  | 'information_request'
  | 'follow_up_strategy'
  | 'urgency_creator'
  | 'value_proposition'
  | 'trust_builder';

export type LearningOutcome =
  | 'sale_completed'
  | 'appointment_set'
  | 'test_drive_scheduled'
  | 'contact_info_obtained'
  | 'positive_response'
  | 'continued_engagement'
  | 'no_response'
  | 'negative_response'
  | 'conversation_ended'
  | 'threat_avoided';

export interface Pattern {
  id?: string;
  name: string;
  category: PatternCategory;
  description?: string;
  triggerConditions: TriggerCondition[];
  responseTemplate: string;
  variables: PatternVariable[];
  successMetrics: SuccessMetrics;
  contextRequirements?: string[];
}

export interface TriggerCondition {
  type: 'keyword' | 'intent' | 'sentiment' | 'context' | 'sequence';
  value: string;
  operator?: 'contains' | 'equals' | 'regex' | 'gt' | 'lt';
}

export interface PatternVariable {
  name: string;
  source: 'inventory' | 'customer' | 'conversation' | 'dealer' | 'calculated';
  fallback?: string;
}

export interface SuccessMetrics {
  totalUses: number;
  successfulUses: number;
  successRate: number;
  avgResponseTime: number;
  avgConversationLength: number;
  outcomeDistribution: Record<LearningOutcome, number>;
}

export interface PatternMatch {
  patternId: string;
  confidence: number;
  triggeredBy: string[];
  suggestedResponse: string;
  variables: Record<string, string>;
}

export interface LearningEvent {
  conversationId: string;
  messageId: string;
  patternUsed: string;
  response: string;
  outcome: LearningOutcome;
  customerReaction?: string;
  timeToResponse?: number;
}

// ============================================
// Built-in Learning Patterns
// ============================================

const BUILTIN_PATTERNS: Pattern[] = [
  // Response Templates
  {
    name: 'Warm Greeting Response',
    category: 'response_template',
    description: 'Friendly initial response to inquiries',
    triggerConditions: [
      { type: 'intent', value: 'greeting', operator: 'equals' },
      { type: 'sequence', value: 'first_message', operator: 'equals' },
    ],
    responseTemplate: "Hi {customerName}! Thanks for reaching out about the {vehicleTitle}. I'm here to help! {question}",
    variables: [
      { name: 'customerName', source: 'customer', fallback: 'there' },
      { name: 'vehicleTitle', source: 'inventory' },
      { name: 'question', source: 'calculated', fallback: 'What would you like to know about it?' },
    ],
    successMetrics: {
      totalUses: 0,
      successfulUses: 0,
      successRate: 0.85,
      avgResponseTime: 0,
      avgConversationLength: 0,
      outcomeDistribution: {} as Record<LearningOutcome, number>,
    },
  },
  {
    name: 'Availability Confirmation',
    category: 'response_template',
    description: 'Confirm vehicle availability with enthusiasm',
    triggerConditions: [
      { type: 'intent', value: 'availability_check', operator: 'equals' },
      { type: 'keyword', value: 'still available|still got|is this available', operator: 'regex' },
    ],
    responseTemplate: "Yes! The {vehicleTitle} is still available! 🎉 It's a fantastic {condition} vehicle with {mileage} miles. {ctaQuestion}",
    variables: [
      { name: 'vehicleTitle', source: 'inventory' },
      { name: 'condition', source: 'inventory', fallback: 'great condition' },
      { name: 'mileage', source: 'inventory', fallback: 'low' },
      { name: 'ctaQuestion', source: 'calculated', fallback: 'Would you like to come see it?' },
    ],
    successMetrics: {
      totalUses: 0,
      successfulUses: 0,
      successRate: 0.78,
      avgResponseTime: 0,
      avgConversationLength: 0,
      outcomeDistribution: {} as Record<LearningOutcome, number>,
    },
  },

  // Negotiation Tactics
  {
    name: 'Anchor High Strategy',
    category: 'negotiation_tactic',
    description: 'Set expectations with market value before discussing price',
    triggerConditions: [
      { type: 'intent', value: 'price_inquiry', operator: 'equals' },
      { type: 'keyword', value: 'price|cost|how much', operator: 'regex' },
    ],
    responseTemplate: "Great question! The {vehicleTitle} is listed at ${price}. Similar {year} {make} {model}s in the area are going for ${marketRange}. Our price reflects {valueProps}. What's your budget range?",
    variables: [
      { name: 'vehicleTitle', source: 'inventory' },
      { name: 'price', source: 'inventory' },
      { name: 'year', source: 'inventory' },
      { name: 'make', source: 'inventory' },
      { name: 'model', source: 'inventory' },
      { name: 'marketRange', source: 'calculated' },
      { name: 'valueProps', source: 'inventory', fallback: 'excellent condition and full service history' },
    ],
    successMetrics: {
      totalUses: 0,
      successfulUses: 0,
      successRate: 0.72,
      avgResponseTime: 0,
      avgConversationLength: 0,
      outcomeDistribution: {} as Record<LearningOutcome, number>,
    },
  },
  {
    name: 'Counter Offer Response',
    category: 'negotiation_tactic',
    description: 'Respond to low offers while keeping engagement',
    triggerConditions: [
      { type: 'intent', value: 'make_offer', operator: 'equals' },
      { type: 'context', value: 'offer_below_floor', operator: 'equals' },
    ],
    responseTemplate: "I appreciate the offer! ${offeredPrice} is a bit below where we can go. The {vehicleTitle} is priced at ${price} based on {justification}. Could you come up to ${counterOffer}? I think we can work something out.",
    variables: [
      { name: 'offeredPrice', source: 'conversation' },
      { name: 'vehicleTitle', source: 'inventory' },
      { name: 'price', source: 'inventory' },
      { name: 'justification', source: 'calculated' },
      { name: 'counterOffer', source: 'calculated' },
    ],
    successMetrics: {
      totalUses: 0,
      successfulUses: 0,
      successRate: 0.65,
      avgResponseTime: 0,
      avgConversationLength: 0,
      outcomeDistribution: {} as Record<LearningOutcome, number>,
    },
  },
  {
    name: 'Cash Deal Incentive',
    category: 'negotiation_tactic',
    description: 'Offer slight discount for cash deals',
    triggerConditions: [
      { type: 'keyword', value: 'cash|pay today|cash today', operator: 'regex' },
      { type: 'intent', value: 'negotiate', operator: 'equals' },
    ],
    responseTemplate: "Cash today definitely gets my attention! 💰 While we're competitively priced, for a cash deal closing today, I could do ${cashPrice}. That's a ${savings} savings. What do you say?",
    variables: [
      { name: 'cashPrice', source: 'calculated' },
      { name: 'savings', source: 'calculated' },
    ],
    successMetrics: {
      totalUses: 0,
      successfulUses: 0,
      successRate: 0.75,
      avgResponseTime: 0,
      avgConversationLength: 0,
      outcomeDistribution: {} as Record<LearningOutcome, number>,
    },
  },

  // Objection Handlers
  {
    name: 'Price Too High Objection',
    category: 'objection_handler',
    description: 'Handle complaints about price',
    triggerConditions: [
      { type: 'intent', value: 'price_objection', operator: 'equals' },
      { type: 'keyword', value: 'expensive|too much|too high|overpriced', operator: 'regex' },
    ],
    responseTemplate: "I understand price is important! Let me share why the {vehicleTitle} is valued at ${price}: {keyFeatures}. Comparable vehicles are selling for ${comparison}. That said, I want to earn your business - what budget are you working with?",
    variables: [
      { name: 'vehicleTitle', source: 'inventory' },
      { name: 'price', source: 'inventory' },
      { name: 'keyFeatures', source: 'inventory' },
      { name: 'comparison', source: 'calculated' },
    ],
    successMetrics: {
      totalUses: 0,
      successfulUses: 0,
      successRate: 0.58,
      avgResponseTime: 0,
      avgConversationLength: 0,
      outcomeDistribution: {} as Record<LearningOutcome, number>,
    },
  },
  {
    name: 'Need To Think Objection',
    category: 'objection_handler',
    description: 'Handle hesitation without pressure',
    triggerConditions: [
      { type: 'intent', value: 'delay', operator: 'equals' },
      { type: 'keyword', value: 'think about|consider|not sure|maybe', operator: 'regex' },
    ],
    responseTemplate: "Absolutely, it's a big decision! While you're thinking, is there anything specific I can address? {interestIndicator} Also, just so you know - I'd hate for you to miss out if someone else shows interest.",
    variables: [
      { name: 'interestIndicator', source: 'conversation', fallback: 'Sometimes talking through concerns helps.' },
    ],
    successMetrics: {
      totalUses: 0,
      successfulUses: 0,
      successRate: 0.52,
      avgResponseTime: 0,
      avgConversationLength: 0,
      outcomeDistribution: {} as Record<LearningOutcome, number>,
    },
  },
  {
    name: 'Checking Other Options',
    category: 'objection_handler',
    description: 'When customer wants to shop around',
    triggerConditions: [
      { type: 'intent', value: 'comparison_shopping', operator: 'equals' },
      { type: 'keyword', value: 'other options|shop around|compare|looking at others', operator: 'regex' },
    ],
    responseTemplate: "Smart shopping! What other vehicles are you considering? I might be able to help compare. {uniqueValue} If you find something better, no hard feelings - but let me know if you decide on this one!",
    variables: [
      { name: 'uniqueValue', source: 'inventory', fallback: 'This one stands out because of its condition and history.' },
    ],
    successMetrics: {
      totalUses: 0,
      successfulUses: 0,
      successRate: 0.48,
      avgResponseTime: 0,
      avgConversationLength: 0,
      outcomeDistribution: {} as Record<LearningOutcome, number>,
    },
  },

  // Closing Techniques
  {
    name: 'Assumptive Close',
    category: 'closing_technique',
    description: 'Assume the sale and move to logistics',
    triggerConditions: [
      { type: 'context', value: 'high_interest_signals', operator: 'equals' },
      { type: 'sequence', value: 'multiple_positive_responses', operator: 'equals' },
    ],
    responseTemplate: "Perfect! It sounds like the {vehicleTitle} is exactly what you're looking for. When would you like to take it home? We can have the paperwork ready and you driving by {timeframe}!",
    variables: [
      { name: 'vehicleTitle', source: 'inventory' },
      { name: 'timeframe', source: 'calculated', fallback: 'this afternoon' },
    ],
    successMetrics: {
      totalUses: 0,
      successfulUses: 0,
      successRate: 0.62,
      avgResponseTime: 0,
      avgConversationLength: 0,
      outcomeDistribution: {} as Record<LearningOutcome, number>,
    },
  },
  {
    name: 'Alternative Close',
    category: 'closing_technique',
    description: 'Offer two positive options',
    triggerConditions: [
      { type: 'context', value: 'appointment_discussion', operator: 'equals' },
      { type: 'intent', value: 'schedule', operator: 'equals' },
    ],
    responseTemplate: "Great! Would {option1} or {option2} work better for you to come see the {vehicleTitle}? I'll make sure it's pulled up and ready for you.",
    variables: [
      { name: 'option1', source: 'calculated', fallback: 'tomorrow morning' },
      { name: 'option2', source: 'calculated', fallback: 'Saturday afternoon' },
      { name: 'vehicleTitle', source: 'inventory' },
    ],
    successMetrics: {
      totalUses: 0,
      successfulUses: 0,
      successRate: 0.71,
      avgResponseTime: 0,
      avgConversationLength: 0,
      outcomeDistribution: {} as Record<LearningOutcome, number>,
    },
  },

  // Rapport Builders
  {
    name: 'Personal Connection',
    category: 'rapport_builder',
    description: 'Build personal connection with customer',
    triggerConditions: [
      { type: 'context', value: 'personal_info_shared', operator: 'equals' },
    ],
    responseTemplate: "{empathyStatement} {relatedComment} Now, about the {vehicleTitle} - {transition}",
    variables: [
      { name: 'empathyStatement', source: 'calculated' },
      { name: 'relatedComment', source: 'calculated' },
      { name: 'vehicleTitle', source: 'inventory' },
      { name: 'transition', source: 'calculated', fallback: 'what questions can I answer for you?' },
    ],
    successMetrics: {
      totalUses: 0,
      successfulUses: 0,
      successRate: 0.69,
      avgResponseTime: 0,
      avgConversationLength: 0,
      outcomeDistribution: {} as Record<LearningOutcome, number>,
    },
  },

  // Follow-Up Strategies
  {
    name: '24 Hour Follow Up',
    category: 'follow_up_strategy',
    description: 'Follow up after 24 hours of no response',
    triggerConditions: [
      { type: 'context', value: 'no_response_24h', operator: 'equals' },
    ],
    responseTemplate: "Hi {customerName}! Just following up on the {vehicleTitle} you asked about. It's still available! Did you have any other questions? No pressure - just want to make sure you have all the info you need.",
    variables: [
      { name: 'customerName', source: 'customer', fallback: 'there' },
      { name: 'vehicleTitle', source: 'inventory' },
    ],
    successMetrics: {
      totalUses: 0,
      successfulUses: 0,
      successRate: 0.35,
      avgResponseTime: 0,
      avgConversationLength: 0,
      outcomeDistribution: {} as Record<LearningOutcome, number>,
    },
  },
  {
    name: 'Post Test Drive Follow Up',
    category: 'follow_up_strategy',
    description: 'Follow up after test drive without decision',
    triggerConditions: [
      { type: 'context', value: 'post_test_drive', operator: 'equals' },
      { type: 'context', value: 'no_decision', operator: 'equals' },
    ],
    responseTemplate: "Hi {customerName}! Hope you're doing well. Wanted to check in after your test drive of the {vehicleTitle}. What did you think? If you have any questions or want to discuss numbers, I'm here!",
    variables: [
      { name: 'customerName', source: 'customer' },
      { name: 'vehicleTitle', source: 'inventory' },
    ],
    successMetrics: {
      totalUses: 0,
      successfulUses: 0,
      successRate: 0.45,
      avgResponseTime: 0,
      avgConversationLength: 0,
      outcomeDistribution: {} as Record<LearningOutcome, number>,
    },
  },

  // Trust Builders
  {
    name: 'Transparency Response',
    category: 'trust_builder',
    description: 'Build trust through transparency about vehicle issues',
    triggerConditions: [
      { type: 'intent', value: 'history_inquiry', operator: 'equals' },
      { type: 'keyword', value: 'accident|history|carfax|problems', operator: 'regex' },
    ],
    responseTemplate: "Great question - transparency is important to us! According to the Carfax, {historyInfo}. I can send you the full report if you'd like. We stand behind our vehicles.",
    variables: [
      { name: 'historyInfo', source: 'inventory', fallback: 'this vehicle has a clean history' },
    ],
    successMetrics: {
      totalUses: 0,
      successfulUses: 0,
      successRate: 0.73,
      avgResponseTime: 0,
      avgConversationLength: 0,
      outcomeDistribution: {} as Record<LearningOutcome, number>,
    },
  },
];

// ============================================
// AI Learning Patterns Service
// ============================================

export class AILearningPatternsService {
  private patterns: Map<string, Pattern> = new Map();
  private initialized: boolean = false;

  constructor() {
    this.initializePatterns();
  }

  /**
   * Initialize patterns from built-in and database
   */
  private async initializePatterns(): Promise<void> {
    try {
      // Load built-in patterns
      BUILTIN_PATTERNS.forEach((p, index) => {
        const id = `builtin_${index}`;
        this.patterns.set(id, { ...p, id });
      });

      // Load custom patterns from database
      const dbPatterns = await prisma.aILearningPattern.findMany({
        where: { isActive: true },
      });

      dbPatterns.forEach(p => {
        const trigger = p.trigger as any || {};
        const response = p.response as any || {};
        this.patterns.set(p.id, {
          id: p.id,
          name: trigger.name || p.patternType,
          category: p.category as PatternCategory,
          description: trigger.description,
          triggerConditions: trigger.conditions as TriggerCondition[] || [],
          responseTemplate: response.template || '',
          variables: response.variables as PatternVariable[] || [],
          successMetrics: {
            totalUses: p.usageCount || 0,
            successfulUses: Math.round((p.successRate || 0) * (p.usageCount || 0)),
            successRate: p.successRate || 0,
            avgResponseTime: 0,
            avgConversationLength: 0,
            outcomeDistribution: {} as Record<LearningOutcome, number>,
          },
          contextRequirements: trigger.contextRequirements as string[] || undefined,
        });
      });

      this.initialized = true;
      logger.info(`Learning patterns initialized: ${this.patterns.size} patterns loaded`);
    } catch (error) {
      logger.error('Failed to initialize learning patterns:', error);
      this.initialized = true;
    }
  }

  // ============================================
  // Pattern Matching
  // ============================================

  /**
   * Find matching patterns for a message
   */
  async findMatchingPatterns(
    message: string,
    context?: {
      intent?: string;
      sentiment?: string;
      conversationHistory?: string[];
      customerData?: Record<string, unknown>;
      vehicleData?: Record<string, unknown>;
      dealerData?: Record<string, unknown>;
    }
  ): Promise<PatternMatch[]> {
    if (!this.initialized) {
      await this.initializePatterns();
    }

    const matches: PatternMatch[] = [];
    const normalizedMessage = message.toLowerCase();

    for (const [patternId, pattern] of this.patterns) {
      const matchResult = this.evaluatePattern(pattern, normalizedMessage, context);
      
      if (matchResult.isMatch) {
        // Build response with variables
        const variables = this.resolveVariables(pattern.variables, context);
        const suggestedResponse = this.applyVariables(pattern.responseTemplate, variables);

        matches.push({
          patternId,
          confidence: matchResult.confidence,
          triggeredBy: matchResult.triggeredConditions,
          suggestedResponse,
          variables,
        });
      }
    }

    // Sort by confidence
    matches.sort((a, b) => b.confidence - a.confidence);

    return matches;
  }

  /**
   * Evaluate if pattern matches
   */
  private evaluatePattern(
    pattern: Pattern,
    message: string,
    context?: Record<string, unknown>
  ): { isMatch: boolean; confidence: number; triggeredConditions: string[] } {
    let matchedConditions = 0;
    const triggeredConditions: string[] = [];

    for (const condition of pattern.triggerConditions) {
      const conditionMatch = this.evaluateCondition(condition, message, context);
      if (conditionMatch) {
        matchedConditions++;
        triggeredConditions.push(`${condition.type}:${condition.value}`);
      }
    }

    // Require at least one condition to match, confidence based on percentage
    const isMatch = matchedConditions > 0;
    const confidence = matchedConditions / pattern.triggerConditions.length;

    return { isMatch, confidence, triggeredConditions };
  }

  /**
   * Evaluate single condition
   */
  private evaluateCondition(
    condition: TriggerCondition,
    message: string,
    context?: Record<string, unknown>
  ): boolean {
    switch (condition.type) {
      case 'keyword':
        if (condition.operator === 'regex') {
          try {
            return new RegExp(condition.value, 'i').test(message);
          } catch {
            return false;
          }
        }
        return message.includes(condition.value.toLowerCase());

      case 'intent':
        return context?.intent === condition.value;

      case 'sentiment':
        return context?.sentiment === condition.value;

      case 'context':
        return context?.[condition.value] !== undefined;

      case 'sequence':
        // Check conversation sequence patterns
        const history = context?.conversationHistory as string[] | undefined;
        if (condition.value === 'first_message') {
          return !history || history.length === 0;
        }
        if (condition.value === 'multiple_positive_responses') {
          // Would analyze history for positive sentiment
          return false;
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Resolve variable values from context
   */
  private resolveVariables(
    variables: PatternVariable[],
    context?: Record<string, unknown>
  ): Record<string, string> {
    const resolved: Record<string, string> = {};

    for (const variable of variables) {
      let value: string | undefined;

      switch (variable.source) {
        case 'inventory':
          const vehicleData = context?.vehicleData as Record<string, unknown> | undefined;
          value = vehicleData?.[variable.name] as string | undefined;
          break;

        case 'customer':
          const customerData = context?.customerData as Record<string, unknown> | undefined;
          value = customerData?.[variable.name] as string | undefined;
          break;

        case 'conversation':
          const convData = context?.conversationData as Record<string, unknown> | undefined;
          value = convData?.[variable.name] as string | undefined;
          break;

        case 'dealer':
          const dealerData = context?.dealerData as Record<string, unknown> | undefined;
          value = dealerData?.[variable.name] as string | undefined;
          break;

        case 'calculated':
          // Would run calculation logic
          value = this.calculateVariable(variable.name, context);
          break;
      }

      resolved[variable.name] = value || variable.fallback || `{${variable.name}}`;
    }

    return resolved;
  }

  /**
   * Calculate dynamic variable value
   */
  private calculateVariable(
    name: string,
    context?: Record<string, unknown>
  ): string | undefined {
    const vehicleData = context?.vehicleData as Record<string, unknown> | undefined;
    
    switch (name) {
      case 'marketRange':
        const price = vehicleData?.price as number | undefined;
        if (price) {
          const low = Math.round(price * 0.95);
          const high = Math.round(price * 1.15);
          return `$${low.toLocaleString()} - $${high.toLocaleString()}`;
        }
        return undefined;

      case 'cashPrice':
        const listPrice = vehicleData?.price as number | undefined;
        if (listPrice) {
          return Math.round(listPrice * 0.97).toLocaleString();
        }
        return undefined;

      case 'savings':
        const origPrice = vehicleData?.price as number | undefined;
        if (origPrice) {
          return Math.round(origPrice * 0.03).toLocaleString();
        }
        return undefined;

      case 'counterOffer':
        const offered = context?.conversationData as Record<string, unknown> | undefined;
        const offeredPrice = offered?.offeredPrice as number | undefined;
        const asking = vehicleData?.price as number | undefined;
        if (offeredPrice && asking) {
          // Counter at 80% between offer and asking
          return Math.round(offeredPrice + (asking - offeredPrice) * 0.8).toLocaleString();
        }
        return undefined;

      case 'question':
        // Generate appropriate question based on context
        return 'What would you like to know about it?';

      case 'ctaQuestion':
        return 'Would you like to schedule a time to see it?';

      default:
        return undefined;
    }
  }

  /**
   * Apply variables to template
   */
  private applyVariables(
    template: string,
    variables: Record<string, string>
  ): string {
    let result = template;
    for (const [name, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{${name}\\}`, 'g'), value);
    }
    return result;
  }

  // ============================================
  // Learning & Optimization
  // ============================================

  /**
   * Record pattern usage and outcome
   */
  async recordPatternUsage(event: LearningEvent): Promise<void> {
    try {
      const pattern = this.patterns.get(event.patternUsed);
      if (!pattern || !pattern.id) return;

      // Update pattern metrics
      const metrics = pattern.successMetrics;
      metrics.totalUses++;

      const isSuccess = [
        'sale_completed',
        'appointment_set',
        'test_drive_scheduled',
        'contact_info_obtained',
        'positive_response',
        'continued_engagement',
      ].includes(event.outcome);

      if (isSuccess) {
        metrics.successfulUses++;
      }

      metrics.successRate = metrics.successfulUses / metrics.totalUses;
      metrics.outcomeDistribution[event.outcome] = 
        (metrics.outcomeDistribution[event.outcome] || 0) + 1;

      // Update in database if custom pattern
      if (!event.patternUsed.startsWith('builtin_')) {
        await prisma.aILearningPattern.update({
          where: { id: event.patternUsed },
          data: {
            usageCount: metrics.totalUses,
            successRate: metrics.successRate,
            lastUsed: new Date(),
          },
        });
      }

      // Store in memory for learning
      await aiMemoryService.store({
        providerId: 'system',
        accountId: 'system',
        memoryType: 'learned_responses',
        key: `outcome_${event.conversationId}_${event.messageId}`,
        value: {
          patternId: event.patternUsed,
          patternName: pattern.name,
          category: pattern.category,
          outcome: event.outcome,
          customerReaction: event.customerReaction,
          responseTime: event.timeToResponse,
        },
        importance: isSuccess ? 0.9 : 0.6,
        tags: ['learning', pattern.category, event.outcome],
      });

      logger.debug(`Pattern usage recorded: ${pattern.name} -> ${event.outcome}`);
    } catch (error) {
      logger.error('Failed to record pattern usage:', error);
    }
  }

  /**
   * Discover new patterns from successful conversations
   */
  async discoverPatterns(
    accountId: string,
    options?: { minSuccessRate?: number; minSamples?: number }
  ): Promise<Pattern[]> {
    const minSuccessRate = options?.minSuccessRate || 0.7;
    const minSamples = options?.minSamples || 10;

    // Get successful conversation data from memory
    const successMemories = await aiMemoryService.search({
      providerId: 'system',
      accountId,
      memoryType: 'learned_responses',
      tags: ['learning'],
    });

    // Group by pattern category and analyze
    const categoryStats = new Map<string, {
      responses: string[];
      outcomes: LearningOutcome[];
      successCount: number;
    }>();

    successMemories.forEach(memory => {
      const value = memory.value as any;
      const category = value.category || 'unknown';
      
      if (!categoryStats.has(category)) {
        categoryStats.set(category, { responses: [], outcomes: [], successCount: 0 });
      }

      const stats = categoryStats.get(category)!;
      stats.outcomes.push(value.outcome);
      if (['sale_completed', 'appointment_set', 'positive_response'].includes(value.outcome)) {
        stats.successCount++;
      }
    });

    // Find categories with high success that could become patterns
    const discoveredPatterns: Pattern[] = [];

    for (const [category, stats] of categoryStats) {
      const successRate = stats.successCount / stats.outcomes.length;
      
      if (successRate >= minSuccessRate && stats.outcomes.length >= minSamples) {
        // In production, this would use NLP to extract common patterns
        logger.info(`Potential pattern discovered in ${category}: ${(successRate * 100).toFixed(1)}% success rate`);
      }
    }

    return discoveredPatterns;
  }

  /**
   * Optimize existing pattern based on performance
   */
  async optimizePattern(patternId: string): Promise<{
    original: Pattern;
    suggestions: string[];
    recommendedChanges: Record<string, unknown>;
  }> {
    const pattern = this.patterns.get(patternId);
    if (!pattern) {
      throw new Error('Pattern not found');
    }

    const suggestions: string[] = [];
    const recommendedChanges: Record<string, unknown> = {};

    const metrics = pattern.successMetrics;

    // Analyze performance
    if (metrics.successRate < 0.5 && metrics.totalUses > 20) {
      suggestions.push('Consider revising response template - below 50% success rate');
      suggestions.push('Review trigger conditions for accuracy');
    }

    if (metrics.successRate > 0.8 && metrics.totalUses > 50) {
      suggestions.push('High performing pattern - consider expanding trigger conditions');
    }

    // Analyze outcome distribution
    const outcomes = metrics.outcomeDistribution;
    if ((outcomes['no_response'] || 0) > metrics.totalUses * 0.4) {
      suggestions.push('High no-response rate - response may be too generic or not engaging');
      recommendedChanges.addEngagement = true;
    }

    if ((outcomes['negative_response'] || 0) > metrics.totalUses * 0.2) {
      suggestions.push('High negative response rate - review tone and content');
      recommendedChanges.reviewTone = true;
    }

    return {
      original: pattern,
      suggestions,
      recommendedChanges,
    };
  }

  // ============================================
  // Pattern Management
  // ============================================

  /**
   * Create new custom pattern
   */
  async createPattern(
    accountId: string,
    pattern: Omit<Pattern, 'id'>
  ): Promise<string> {
    const dbPattern = await prisma.aILearningPattern.create({
      data: {
        accountId,
        patternType: pattern.category,
        category: pattern.category,
        trigger: {
          name: pattern.name,
          description: pattern.description,
          conditions: pattern.triggerConditions,
          contextRequirements: pattern.contextRequirements,
        } as any,
        response: {
          template: pattern.responseTemplate,
          variables: pattern.variables,
        } as any,
        successRate: 0,
        sampleSize: 0,
        confidence: 0.5,
        isActive: true,
      },
    });

    // Add to in-memory patterns
    this.patterns.set(dbPattern.id, { ...pattern, id: dbPattern.id });

    return dbPattern.id;
  }

  /**
   * Update pattern
   */
  async updatePattern(
    patternId: string,
    updates: Partial<Pattern>
  ): Promise<void> {
    if (patternId.startsWith('builtin_')) {
      throw new Error('Cannot update built-in patterns');
    }

    const updateData: any = {};
    
    if (updates.category) {
      updateData.category = updates.category;
      updateData.patternType = updates.category;
    }
    
    if (updates.name || updates.description || updates.triggerConditions || updates.contextRequirements) {
      updateData.trigger = {
        name: updates.name,
        description: updates.description,
        conditions: updates.triggerConditions,
        contextRequirements: updates.contextRequirements,
      };
    }
    
    if (updates.responseTemplate || updates.variables) {
      updateData.response = {
        template: updates.responseTemplate,
        variables: updates.variables,
      };
    }

    await prisma.aILearningPattern.update({
      where: { id: patternId },
      data: updateData,
    });

    // Update in-memory
    const existing = this.patterns.get(patternId);
    if (existing) {
      this.patterns.set(patternId, { ...existing, ...updates });
    }
  }

  /**
   * Delete pattern
   */
  async deletePattern(patternId: string): Promise<void> {
    if (patternId.startsWith('builtin_')) {
      throw new Error('Cannot delete built-in patterns');
    }

    await prisma.aILearningPattern.update({
      where: { id: patternId },
      data: { isActive: false },
    });

    this.patterns.delete(patternId);
  }

  /**
   * Get all patterns
   */
  async getPatterns(
    options?: { category?: PatternCategory; accountId?: string }
  ): Promise<Pattern[]> {
    if (!this.initialized) {
      await this.initializePatterns();
    }

    let patterns = Array.from(this.patterns.values());

    if (options?.category) {
      patterns = patterns.filter(p => p.category === options.category);
    }

    return patterns;
  }

  /**
   * Get pattern performance report
   */
  async getPerformanceReport(_accountId?: string): Promise<{
    totalPatterns: number;
    byCategory: Record<string, { count: number; avgSuccessRate: number }>;
    topPerformers: { pattern: Pattern; successRate: number }[];
    needsImprovement: { pattern: Pattern; successRate: number }[];
  }> {
    const patterns = await this.getPatterns();

    const byCategory: Record<string, { count: number; avgSuccessRate: number; totalSuccess: number }> = {};

    patterns.forEach(p => {
      if (!byCategory[p.category]) {
        byCategory[p.category] = { count: 0, avgSuccessRate: 0, totalSuccess: 0 };
      }
      byCategory[p.category].count++;
      byCategory[p.category].totalSuccess += p.successMetrics.successRate;
    });

    // Calculate averages
    Object.keys(byCategory).forEach(cat => {
      byCategory[cat].avgSuccessRate = byCategory[cat].totalSuccess / byCategory[cat].count;
    });

    // Sort by success rate
    const sorted = patterns
      .filter(p => p.successMetrics.totalUses > 0)
      .sort((a, b) => b.successMetrics.successRate - a.successMetrics.successRate);

    return {
      totalPatterns: patterns.length,
      byCategory,
      topPerformers: sorted.slice(0, 5).map(p => ({
        pattern: p,
        successRate: p.successMetrics.successRate,
      })),
      needsImprovement: sorted.slice(-5).reverse().map(p => ({
        pattern: p,
        successRate: p.successMetrics.successRate,
      })),
    };
  }

  /**
   * Get best pattern for context
   */
  async getBestPattern(
    message: string,
    context?: Record<string, unknown>
  ): Promise<PatternMatch | null> {
    const matches = await this.findMatchingPatterns(message, context);
    
    if (matches.length === 0) return null;

    // Weight by both confidence and historical success rate
    const weighted = matches.map(match => {
      const pattern = this.patterns.get(match.patternId);
      const successWeight = pattern?.successMetrics.successRate || 0.5;
      return {
        ...match,
        weightedScore: match.confidence * 0.6 + successWeight * 0.4,
      };
    });

    weighted.sort((a, b) => b.weightedScore - a.weightedScore);
    return weighted[0];
  }
}

// Export singleton instance
export const aiLearningPatternsService = new AILearningPatternsService();
export default aiLearningPatternsService;
