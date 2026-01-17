/**
 * AI Threat Detection Service
 * 
 * Comprehensive threat detection and defense mechanism:
 * - Pattern-based detection (regex, keywords, behavioral)
 * - Machine learning classification
 * - Graceful conversation termination
 * - Flagging and escalation system
 * - Learning from new threats
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '@/utils/logger';
import { aiMemoryService } from './ai-memory.service';

const prisma = new PrismaClient();

// ============================================
// Types
// ============================================

export type ThreatType =
  | 'scam'
  | 'phishing'
  | 'harassment'
  | 'spam'
  | 'fraud'
  | 'inappropriate_content'
  | 'impersonation'
  | 'data_theft'
  | 'manipulation'
  | 'aggressive_behavior'
  | 'illegal_activity'
  | 'competitor_interference';

export type ThreatSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ThreatStatus = 'detected' | 'confirmed' | 'false_positive' | 'resolved' | 'escalated';

export type PatternType = 'regex' | 'keyword' | 'ml_model' | 'behavioral' | 'contextual';

export interface ThreatAnalysis {
  isThreat: boolean;
  threatType?: ThreatType;
  severity?: ThreatSeverity;
  confidence: number;
  matchedPatterns: string[];
  suggestedResponse?: string;
  shouldTerminate: boolean;
  shouldEscalate: boolean;
  evidence: string[];
}

export interface ThreatPattern {
  id?: string;
  name: string;
  description?: string;
  patternType: PatternType;
  pattern: string;
  threatType: ThreatType;
  severity: ThreatSeverity;
  isActive?: boolean;
}

export interface DefenseAction {
  type: 'warn' | 'redirect' | 'terminate' | 'escalate' | 'block';
  message: string;
  data?: Record<string, unknown>;
}

// ============================================
// Built-in Threat Patterns
// ============================================

const BUILTIN_THREAT_PATTERNS: ThreatPattern[] = [
  // Scam Patterns
  {
    name: 'Overpayment Scam',
    description: 'Classic scam where buyer offers to pay more than asking price',
    patternType: 'regex',
    pattern: '(send|pay|give).*(more|extra|difference|refund).*(check|money|wire|transfer)',
    threatType: 'scam',
    severity: 'critical',
  },
  {
    name: 'Wire Transfer Request',
    description: 'Request for wire transfer or unusual payment method',
    patternType: 'regex',
    pattern: '(wire|western union|moneygram|zelle|venmo|cashapp|crypto|bitcoin).*(send|transfer|pay)',
    threatType: 'scam',
    severity: 'high',
  },
  {
    name: 'Shipping Scam',
    description: 'Request to ship without seeing the vehicle first',
    patternType: 'regex',
    pattern: '(ship|transport|send).*(out of (state|town|country)|overseas|international)',
    threatType: 'scam',
    severity: 'medium',
  },
  {
    name: 'Gift Card Payment',
    description: 'Request for payment via gift cards',
    patternType: 'regex',
    pattern: '(gift card|itunes|google play|amazon card).*(pay|payment|purchase)',
    threatType: 'scam',
    severity: 'critical',
  },

  // Phishing Patterns
  {
    name: 'Personal Information Request',
    description: 'Unusual request for personal or banking details',
    patternType: 'regex',
    pattern: '(social security|ssn|bank account|routing number|credit card|password|login)',
    threatType: 'phishing',
    severity: 'critical',
  },
  {
    name: 'External Link Phishing',
    description: 'Suspicious external links',
    patternType: 'regex',
    pattern: '(click|visit|go to).*(bit\\.ly|tinyurl|suspicious|verify|confirm).*(link|url|site)',
    threatType: 'phishing',
    severity: 'high',
  },

  // Harassment Patterns
  {
    name: 'Explicit Content',
    description: 'Sexually explicit or inappropriate content',
    patternType: 'keyword',
    pattern: 'explicit_keywords_list', // Would be populated from database
    threatType: 'harassment',
    severity: 'high',
  },
  {
    name: 'Threats or Violence',
    description: 'Threatening or violent language',
    patternType: 'regex',
    pattern: '(kill|hurt|beat|attack|destroy|die|dead|weapon|gun).*(you|your|family|store|dealership)',
    threatType: 'harassment',
    severity: 'critical',
  },
  {
    name: 'Aggressive Language',
    description: 'Aggressively insulting or demeaning language',
    patternType: 'regex',
    pattern: '(stupid|idiot|moron|dumb|piece of|f\\*\\*k|sh\\*t|a\\*\\*hole)',
    threatType: 'aggressive_behavior',
    severity: 'medium',
  },

  // Fraud Patterns
  {
    name: 'Fake Identity Claims',
    description: 'Claims of being someone else or impersonation',
    patternType: 'regex',
    pattern: '(i am|this is|representing).*(owner|manager|facebook|police|lawyer|attorney)',
    threatType: 'impersonation',
    severity: 'high',
  },
  {
    name: 'Title/Document Fraud',
    description: 'Suspicious claims about titles or documents',
    patternType: 'regex',
    pattern: '(don\'t worry|no need).*(title|registration|documents|paperwork).*(later|after|trust)',
    threatType: 'fraud',
    severity: 'high',
  },

  // Spam Patterns
  {
    name: 'Mass Message Spam',
    description: 'Obvious spam or promotional content',
    patternType: 'regex',
    pattern: '(win|won|congratulations|selected|lottery|prize).*(click|claim|call)',
    threatType: 'spam',
    severity: 'low',
  },

  // Behavioral Patterns (detected through conversation analysis)
  {
    name: 'Urgency Pressure',
    description: 'Unusual pressure to act quickly',
    patternType: 'behavioral',
    pattern: 'urgency_score > 0.8',
    threatType: 'manipulation',
    severity: 'medium',
  },
  {
    name: 'Information Inconsistency',
    description: 'Contradictory information across messages',
    patternType: 'behavioral',
    pattern: 'consistency_score < 0.3',
    threatType: 'fraud',
    severity: 'medium',
  },
];

// ============================================
// Graceful Termination Responses
// ============================================

const TERMINATION_RESPONSES: Record<ThreatType, string[]> = {
  scam: [
    "I appreciate your interest, but this request falls outside our standard procedures. For your protection and ours, all transactions are handled in person at our dealership. If you're genuinely interested in the vehicle, you're welcome to visit us at {address}.",
    "Thank you for reaching out. We conduct all sales in-person at our location for everyone's safety. If you'd like to proceed with a legitimate purchase, please visit us during business hours.",
  ],
  phishing: [
    "For security purposes, we don't share personal or banking information through messaging. All transactions are completed safely at our dealership. Feel free to visit us if you're interested in the vehicle.",
    "I'm unable to provide that information through this channel. Please visit our dealership for any financial matters related to vehicle purchases.",
  ],
  harassment: [
    "I'm here to assist with vehicle-related inquiries. This conversation needs to remain professional. If you have legitimate questions about our inventory, I'm happy to help.",
    "This conversation isn't productive. If you'd like to discuss our vehicles professionally, I'm available. Otherwise, I'll need to end our chat here.",
  ],
  spam: [
    "Thank you for your message. We focus on genuine vehicle inquiries. If you're interested in any of our listings, please let me know how I can help.",
  ],
  fraud: [
    "Something about this request doesn't align with standard practices. For both our protection, we'll need to handle any transactions in person with proper documentation.",
  ],
  inappropriate_content: [
    "This conversation has gone off-topic. I'm available for vehicle-related questions only. Please keep our discussion professional.",
  ],
  impersonation: [
    "I'm unable to verify that claim through this channel. For any official matters, please contact us directly at our dealership with proper identification.",
  ],
  data_theft: [
    "For security reasons, I cannot provide that information. Please visit our dealership in person for any sensitive inquiries.",
  ],
  manipulation: [
    "I appreciate your interest, but I want to make sure any decision you make is well-considered. There's no need to rush - the vehicle will be available when you're ready to make a comfortable decision.",
  ],
  aggressive_behavior: [
    "I understand you may be frustrated. Let's take a step back. If you have concerns about the vehicle or our service, I'd like to help address them professionally.",
    "I'm here to help, but our conversation needs to stay respectful. Would you like to start fresh? I'm happy to assist with any vehicle questions.",
  ],
  illegal_activity: [
    "I'm unable to assist with that request. This conversation is being logged. If you have legitimate vehicle inquiries, I'm happy to help through proper channels.",
  ],
  competitor_interference: [
    "Thanks for your message. We're focused on helping our customers. If you have genuine questions about our vehicles, I'm here to help.",
  ],
};

// ============================================
// AI Threat Detection Service
// ============================================

export class AIThreatDetectionService {
  private patterns: ThreatPattern[] = [];
  private initialized: boolean = false;

  constructor() {
    this.initializePatterns();
  }

  /**
   * Initialize patterns from built-in and database
   */
  private async initializePatterns(): Promise<void> {
    try {
      // Start with built-in patterns
      this.patterns = [...BUILTIN_THREAT_PATTERNS];

      // Load custom patterns from database
      const dbPatterns = await prisma.aIThreatPattern.findMany({
        where: { isActive: true },
      });

      dbPatterns.forEach(p => {
        this.patterns.push({
          id: p.id,
          name: p.name,
          description: p.description || undefined,
          patternType: p.patternType as PatternType,
          pattern: JSON.stringify(p.pattern),
          threatType: p.threatType as ThreatType,
          severity: p.severity as ThreatSeverity,
          isActive: p.isActive,
        });
      });

      this.initialized = true;
      logger.info(`Threat detection initialized with ${this.patterns.length} patterns`);
    } catch (error) {
      logger.error('Failed to initialize threat patterns:', error);
      this.patterns = [...BUILTIN_THREAT_PATTERNS];
      this.initialized = true;
    }
  }

  // ============================================
  // Threat Analysis
  // ============================================

  /**
   * Analyze message for threats
   */
  async analyzeMessage(
    message: string,
    context?: {
      conversationHistory?: string[];
      senderId?: string;
      accountId?: string;
    }
  ): Promise<ThreatAnalysis> {
    if (!this.initialized) {
      await this.initializePatterns();
    }

    const matchedPatterns: string[] = [];
    let highestSeverity: ThreatSeverity | null = null;
    let detectedThreatType: ThreatType | null = null;
    let maxConfidence = 0;
    const evidence: string[] = [];

    // Normalize message for analysis
    const normalizedMessage = message.toLowerCase().trim();

    // Check each pattern
    for (const pattern of this.patterns) {
      const match = await this.checkPattern(normalizedMessage, pattern, context);
      
      if (match.isMatch) {
        matchedPatterns.push(pattern.name);
        evidence.push(`Pattern "${pattern.name}" matched: ${match.reason}`);

        if (match.confidence > maxConfidence) {
          maxConfidence = match.confidence;
          detectedThreatType = pattern.threatType;
        }

        // Track highest severity
        if (!highestSeverity || this.compareSeverity(pattern.severity, highestSeverity) > 0) {
          highestSeverity = pattern.severity;
        }
      }
    }

    // Behavioral analysis on conversation history
    if (context?.conversationHistory && context.conversationHistory.length > 2) {
      const behavioralThreat = this.analyzeBehavior(
        normalizedMessage,
        context.conversationHistory
      );
      if (behavioralThreat.isThreat) {
        matchedPatterns.push(behavioralThreat.patternName);
        evidence.push(behavioralThreat.evidence);
        if (behavioralThreat.confidence > maxConfidence) {
          maxConfidence = behavioralThreat.confidence;
          detectedThreatType = behavioralThreat.threatType;
        }
      }
    }

    const isThreat = matchedPatterns.length > 0 && maxConfidence >= 0.5;
    const shouldTerminate = highestSeverity === 'critical' || 
                            (highestSeverity === 'high' && maxConfidence >= 0.8);
    const shouldEscalate = highestSeverity === 'critical' ||
                           (isThreat && maxConfidence >= 0.9);

    let suggestedResponse: string | undefined;
    if (isThreat && detectedThreatType) {
      const responses = TERMINATION_RESPONSES[detectedThreatType];
      suggestedResponse = responses[Math.floor(Math.random() * responses.length)];
    }

    return {
      isThreat,
      threatType: detectedThreatType || undefined,
      severity: highestSeverity || undefined,
      confidence: maxConfidence,
      matchedPatterns,
      suggestedResponse,
      shouldTerminate,
      shouldEscalate,
      evidence,
    };
  }

  /**
   * Check individual pattern against message
   */
  private async checkPattern(
    message: string,
    pattern: ThreatPattern,
    context?: { conversationHistory?: string[] }
  ): Promise<{ isMatch: boolean; confidence: number; reason: string }> {
    switch (pattern.patternType) {
      case 'regex':
        try {
          const regex = new RegExp(pattern.pattern, 'i');
          const match = regex.test(message);
          return {
            isMatch: match,
            confidence: match ? 0.85 : 0,
            reason: match ? `Regex pattern matched` : '',
          };
        } catch {
          return { isMatch: false, confidence: 0, reason: '' };
        }

      case 'keyword':
        // Load keywords from database or use built-in list
        const keywords = await this.getKeywordsForPattern(pattern.name);
        const keywordMatch = keywords.some(kw => message.includes(kw.toLowerCase()));
        return {
          isMatch: keywordMatch,
          confidence: keywordMatch ? 0.7 : 0,
          reason: keywordMatch ? 'Keyword matched' : '',
        };

      case 'behavioral':
        // Behavioral patterns are handled separately
        return { isMatch: false, confidence: 0, reason: '' };

      case 'contextual':
        // Analyze context for patterns
        if (context?.conversationHistory) {
          return this.analyzeContext(message, context.conversationHistory, pattern);
        }
        return { isMatch: false, confidence: 0, reason: '' };

      default:
        return { isMatch: false, confidence: 0, reason: '' };
    }
  }

  /**
   * Analyze behavioral patterns in conversation
   */
  private analyzeBehavior(
    currentMessage: string,
    history: string[]
  ): {
    isThreat: boolean;
    threatType: ThreatType;
    confidence: number;
    patternName: string;
    evidence: string;
  } {
    // Check for urgency pressure
    const urgencyIndicators = [
      'now', 'today', 'immediately', 'asap', 'right away', 'hurry',
      'limited time', 'don\'t wait', 'act fast', 'urgent'
    ];
    const urgencyCount = urgencyIndicators.filter(i => 
      currentMessage.includes(i) || history.some(h => h.includes(i))
    ).length;
    const urgencyScore = urgencyCount / urgencyIndicators.length;

    if (urgencyScore > 0.3) {
      return {
        isThreat: true,
        threatType: 'manipulation',
        confidence: Math.min(0.9, urgencyScore * 2),
        patternName: 'Urgency Pressure',
        evidence: `High urgency language detected (${urgencyCount} indicators)`,
      };
    }

    // Check for information inconsistency
    // In production, this would use NLP to detect contradictions
    
    // Check for rapid topic changes (potential manipulation)
    const topicChanges = this.detectTopicChanges(history);
    if (topicChanges > 5) {
      return {
        isThreat: true,
        threatType: 'manipulation',
        confidence: 0.6,
        patternName: 'Rapid Topic Changes',
        evidence: `Unusual conversation pattern detected (${topicChanges} topic changes)`,
      };
    }

    return {
      isThreat: false,
      threatType: 'spam',
      confidence: 0,
      patternName: '',
      evidence: '',
    };
  }

  /**
   * Analyze contextual patterns
   */
  private analyzeContext(
    _message: string,
    _history: string[],
    _pattern: ThreatPattern
  ): { isMatch: boolean; confidence: number; reason: string } {
    // Implement contextual analysis based on pattern
    // This could involve analyzing the flow of conversation
    return { isMatch: false, confidence: 0, reason: '' };
  }

  /**
   * Detect topic changes in conversation
   */
  private detectTopicChanges(history: string[]): number {
    // Simple heuristic: count messages that don't share keywords with previous
    let changes = 0;
    for (let i = 1; i < history.length; i++) {
      const prevWords = new Set(history[i - 1].toLowerCase().split(/\s+/));
      const currWords = history[i].toLowerCase().split(/\s+/);
      const overlap = currWords.filter(w => prevWords.has(w) && w.length > 3).length;
      if (overlap < 2) changes++;
    }
    return changes;
  }

  /**
   * Get keywords for a pattern
   */
  private async getKeywordsForPattern(patternName: string): Promise<string[]> {
    // This would load from database in production
    const keywordLists: Record<string, string[]> = {
      'Explicit Content': [
        // Would contain filtered inappropriate terms
      ],
    };
    return keywordLists[patternName] || [];
  }

  /**
   * Compare severity levels
   */
  private compareSeverity(a: ThreatSeverity, b: ThreatSeverity): number {
    const severityOrder: Record<ThreatSeverity, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };
    return severityOrder[a] - severityOrder[b];
  }

  // ============================================
  // Threat Recording & Management
  // ============================================

  /**
   * Record a detected threat
   */
  async recordThreat(
    accountId: string,
    conversationId: string,
    _messageId: string | null,
    analysis: ThreatAnalysis,
    rawMessage: string
  ): Promise<string> {
    try {
      const threat = await prisma.aIThreat.create({
        data: {
          accountId,
          conversationId,
          threatType: analysis.threatType || 'spam',
          severity: analysis.severity || 'low',
          status: 'active',
          confidence: analysis.confidence,
          detectedAt: new Date(),
          detectionMethod: 'pattern_match',
          triggerContent: rawMessage,
          indicators: analysis.matchedPatterns,
          category: analysis.threatType || 'unknown',
          responseTaken: 'detected',
          context: { evidence: analysis.evidence } as any,
        },
      });

      // Store in AI memory for learning
      await aiMemoryService.store({
        providerId: 'system',
        accountId,
        memoryType: 'threat_patterns',
        key: `threat_${threat.id}`,
        value: {
          threatType: analysis.threatType,
          patterns: analysis.matchedPatterns,
          message: rawMessage.substring(0, 500), // Truncate for storage
        },
        importance: analysis.severity === 'critical' ? 1.0 : 0.8,
        tags: ['threat', analysis.threatType || 'unknown'],
      });

      // If should escalate, create escalation
      if (analysis.shouldEscalate) {
        await this.escalateThreat(threat.id);
      }

      logger.warn(`Threat recorded: ${threat.id} - Type: ${analysis.threatType}, Severity: ${analysis.severity}`);
      return threat.id;
    } catch (error) {
      logger.error('Failed to record threat:', error);
      throw error;
    }
  }

  /**
   * Escalate a threat
   */
  async escalateThreat(threatId: string): Promise<void> {
    await prisma.aIThreat.update({
      where: { id: threatId },
      data: {
        status: 'escalated',
      },
    });

    // In production, this would also:
    // - Send notification to admin
    // - Create support ticket
    // - Log for audit

    logger.warn(`Threat ${threatId} escalated to management`);
  }

  /**
   * Update threat status
   */
  async updateThreatStatus(
    threatId: string,
    status: ThreatStatus,
    resolvedBy?: string,
    notes?: string
  ): Promise<void> {
    const updateData: Prisma.AIThreatUpdateInput = { status };

    if (status === 'resolved') {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = resolvedBy;
    }

    if (notes) {
      updateData.resolutionNotes = notes;
    }

    await prisma.aIThreat.update({
      where: { id: threatId },
      data: updateData,
    });
  }

  /**
   * Get threats for account
   */
  async getThreats(
    accountId: string,
    options?: {
      status?: ThreatStatus;
      severity?: ThreatSeverity;
      threatType?: ThreatType;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<any[]> {
    const where: Prisma.AIThreatWhereInput = { accountId };

    if (options?.status) where.status = options.status;
    if (options?.severity) where.severity = options.severity;
    if (options?.threatType) where.threatType = options.threatType;
    if (options?.startDate || options?.endDate) {
      where.detectedAt = {};
      if (options.startDate) where.detectedAt.gte = options.startDate;
      if (options.endDate) where.detectedAt.lte = options.endDate;
    }

    return prisma.aIThreat.findMany({
      where,
      orderBy: { detectedAt: 'desc' },
      take: options?.limit || 100,
      include: {
        conversation: {
          select: {
            id: true,
            customerId: true,
            customerName: true,
          },
        },
      },
    });
  }

  /**
   * Get threat statistics
   */
  async getThreatStats(accountId: string): Promise<{
    total: number;
    bySeverity: Record<ThreatSeverity, number>;
    byType: Record<ThreatType, number>;
    byStatus: Record<ThreatStatus, number>;
    last24Hours: number;
    last7Days: number;
  }> {
    const threats = await prisma.aIThreat.findMany({
      where: { accountId },
    });

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stats = {
      total: threats.length,
      bySeverity: { low: 0, medium: 0, high: 0, critical: 0 } as Record<ThreatSeverity, number>,
      byType: {} as Record<ThreatType, number>,
      byStatus: { detected: 0, confirmed: 0, false_positive: 0, resolved: 0, escalated: 0 } as Record<ThreatStatus, number>,
      last24Hours: 0,
      last7Days: 0,
    };

    threats.forEach(t => {
      stats.bySeverity[t.severity as ThreatSeverity]++;
      stats.byType[t.threatType as ThreatType] = (stats.byType[t.threatType as ThreatType] || 0) + 1;
      stats.byStatus[t.status as ThreatStatus]++;

      if (t.detectedAt >= oneDayAgo) stats.last24Hours++;
      if (t.detectedAt >= sevenDaysAgo) stats.last7Days++;
    });

    return stats;
  }

  // ============================================
  // Pattern Management
  // ============================================

  /**
   * Add custom threat pattern
   */
  async addPattern(
    accountId: string,
    pattern: ThreatPattern
  ): Promise<string> {
    const dbPattern = await prisma.aIThreatPattern.create({
      data: {
        name: pattern.name,
        description: pattern.description,
        patternType: pattern.patternType,
        pattern: pattern.pattern as any,
        threatType: pattern.threatType,
        severity: pattern.severity,
        isActive: true,
        isGlobal: false,
        examples: {} as any,
        accountId,
      },
    });

    // Add to active patterns
    this.patterns.push({
      ...pattern,
      id: dbPattern.id,
    });

    return dbPattern.id;
  }

  /**
   * Update pattern
   */
  async updatePattern(
    patternId: string,
    updates: Partial<ThreatPattern>
  ): Promise<void> {
    await prisma.aIThreatPattern.update({
      where: { id: patternId },
      data: updates,
    });

    // Update in-memory pattern
    const index = this.patterns.findIndex(p => p.id === patternId);
    if (index !== -1) {
      this.patterns[index] = { ...this.patterns[index], ...updates };
    }
  }

  /**
   * Deactivate pattern
   */
  async deactivatePattern(patternId: string): Promise<void> {
    await prisma.aIThreatPattern.update({
      where: { id: patternId },
      data: { isActive: false },
    });

    this.patterns = this.patterns.filter(p => p.id !== patternId);
  }

  /**
   * Get all patterns
   */
  async getPatterns(accountId?: string): Promise<ThreatPattern[]> {
    const dbPatterns = await prisma.aIThreatPattern.findMany({
      where: accountId ? { OR: [{ accountId }, { isGlobal: true }] } : undefined,
    });

    return dbPatterns.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description || undefined,
      patternType: p.patternType as PatternType,
      pattern: JSON.stringify(p.pattern),
      threatType: p.threatType as ThreatType,
      severity: p.severity as ThreatSeverity,
      isActive: p.isActive,
    }));
  }

  // ============================================
  // Defense Actions
  // ============================================

  /**
   * Get recommended defense action
   */
  getDefenseAction(analysis: ThreatAnalysis): DefenseAction {
    if (!analysis.isThreat) {
      return {
        type: 'warn',
        message: 'No threat detected',
      };
    }

    if (analysis.shouldEscalate) {
      return {
        type: 'escalate',
        message: analysis.suggestedResponse || 'This conversation has been flagged for management review.',
        data: { terminate: true },
      };
    }

    if (analysis.shouldTerminate) {
      return {
        type: 'terminate',
        message: analysis.suggestedResponse || 'This conversation cannot continue. Please visit us in person for legitimate inquiries.',
      };
    }

    if (analysis.severity === 'medium') {
      return {
        type: 'redirect',
        message: analysis.suggestedResponse || 'Let\'s keep our conversation focused on vehicle inquiries. How can I help you today?',
      };
    }

    return {
      type: 'warn',
      message: analysis.suggestedResponse || 'I\'m here to help with vehicle questions. What would you like to know?',
    };
  }

  /**
   * Learn from new threat (after human confirmation)
   */
  async learnFromThreat(
    threatId: string,
    isConfirmedThreat: boolean,
    newPattern?: ThreatPattern
  ): Promise<void> {
    await this.updateThreatStatus(
      threatId,
      isConfirmedThreat ? 'confirmed' : 'false_positive'
    );

    if (isConfirmedThreat && newPattern) {
      const threat = await prisma.aIThreat.findUnique({
        where: { id: threatId },
      });

      if (threat) {
        await this.addPattern(threat.accountId, newPattern);
      }
    }

    // Update pattern effectiveness scores
    // In production, this would adjust confidence weights
  }
}

// Export singleton instance
export const aiThreatDetectionService = new AIThreatDetectionService();
export default aiThreatDetectionService;
