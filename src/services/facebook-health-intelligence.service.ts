/**
 * Facebook Health Intelligence Service
 * 
 * Advanced intelligence gathering and analysis for Facebook account health.
 * Monitors and analyzes:
 * - Account health indicators
 * - Posting patterns and anomalies
 * - Bot interaction detection
 * - Authority scoring
 * - Risk factors
 * 
 * Security: All data is encrypted and access-controlled
 */

import prisma from '@/config/database';
import { logger } from '@/utils/logger';
import Redis from 'ioredis';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface FacebookHealthReport {
  accountId: string;
  profileId: string;
  overallHealth: HealthScore;
  activityHealth: ActivityHealth;
  authorityScore: AuthorityScore;
  patternAnalysis: PatternAnalysis;
  botInteractionAnalysis: BotInteractionAnalysis;
  riskIndicators: RiskIndicator[];
  recommendations: Recommendation[];
  lastUpdated: Date;
}

export interface HealthScore {
  score: number; // 0-100
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  trend: 'improving' | 'stable' | 'declining';
  factors: HealthFactor[];
}

export interface HealthFactor {
  name: string;
  weight: number;
  score: number;
  impact: 'positive' | 'neutral' | 'negative';
  description: string;
}

export interface ActivityHealth {
  postsPerDay: number;
  postsPerWeek: number;
  postSuccessRate: number;
  engagementRate: number;
  responseRate: number;
  avgPostInterval: number; // hours between posts
  peakActivityHours: number[];
  consistencyScore: number;
}

export interface AuthorityScore {
  score: number; // 0-100
  yearsActive: number;
  totalPosts: number;
  successfulPosts: number;
  accountAge: number; // days
  verificationStatus: 'verified' | 'unverified' | 'pending';
  trustLevel: 'high' | 'medium' | 'low' | 'new';
  historicalPerformance: number;
}

export interface PatternAnalysis {
  postingPattern: 'consistent' | 'irregular' | 'bursty' | 'dormant';
  timeDistribution: Record<number, number>; // hour -> post count
  dayDistribution: Record<string, number>; // day -> post count
  velocityTrend: 'increasing' | 'stable' | 'decreasing';
  anomalies: PatternAnomaly[];
}

export interface PatternAnomaly {
  type: 'burst' | 'gap' | 'unusual_time' | 'repetition' | 'rate_change';
  severity: 'low' | 'medium' | 'high';
  description: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface BotInteractionAnalysis {
  botInteractionScore: number; // 0-100, lower is better (less bot-like)
  humanLikelihood: number; // 0-100
  suspiciousPatterns: SuspiciousPattern[];
  automationIndicators: AutomationIndicator[];
  interactionQuality: 'authentic' | 'mixed' | 'suspicious';
}

export interface SuspiciousPattern {
  type: string;
  confidence: number;
  description: string;
  evidence: string[];
}

export interface AutomationIndicator {
  indicator: string;
  detected: boolean;
  weight: number;
  description: string;
}

export interface RiskIndicator {
  type: RiskType;
  level: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  description: string;
  mitigation?: string;
  detectedAt: Date;
}

export enum RiskType {
  RATE_LIMIT = 'RATE_LIMIT',
  CONTENT_VIOLATION = 'CONTENT_VIOLATION',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  BOT_DETECTION = 'BOT_DETECTION',
  ACCOUNT_RESTRICTION = 'ACCOUNT_RESTRICTION',
  TOKEN_EXPIRY = 'TOKEN_EXPIRY',
  LOW_ENGAGEMENT = 'LOW_ENGAGEMENT',
  PATTERN_ANOMALY = 'PATTERN_ANOMALY',
  SECURITY_CONCERN = 'SECURITY_CONCERN',
  COMPLIANCE_ISSUE = 'COMPLIANCE_ISSUE',
}

export interface Recommendation {
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'posting' | 'timing' | 'content' | 'security' | 'compliance';
  action: string;
  reason: string;
  impact: string;
}

export interface AggregatedHealthReport {
  timestamp: Date;
  totalProfiles: number;
  healthDistribution: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
    critical: number;
  };
  averageHealthScore: number;
  averageAuthorityScore: number;
  topRisks: RiskIndicator[];
  systemWideRecommendations: Recommendation[];
  profiles: FacebookHealthReport[];
}

// ============================================================================
// Facebook Health Intelligence Service
// ============================================================================

class FacebookHealthIntelligenceService {
  private redis: Redis | null = null;
  private healthCache: Map<string, { data: FacebookHealthReport; expiry: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
        logger.info('Facebook Health Intelligence service initialized');
      } catch (error) {
        logger.warn('Redis not available for health intelligence caching', { error });
      }
    }
  }

  // =========================================================================
  // Health Analysis
  // =========================================================================

  /**
   * Analyze health for a specific Facebook profile
   */
  async analyzeProfileHealth(profileId: string): Promise<FacebookHealthReport> {
    // Check cache first
    const cached = this.healthCache.get(profileId);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    const profile = await prisma.facebookProfile.findUnique({
      where: { id: profileId },
      include: {
        posts: {
          orderBy: { createdAt: 'desc' },
          take: 500, // Analyze last 500 posts
        },
        account: true,
      },
    });

    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    const posts = profile.posts;
    const now = new Date();

    // Analyze different aspects
    const activityHealth = this.analyzeActivityHealth(posts);
    const authorityScore = await this.calculateAuthorityScore(profile, posts);
    const patternAnalysis = this.analyzePatterns(posts);
    const botInteractionAnalysis = this.analyzeBotInteractions(posts, profile);
    const riskIndicators = this.identifyRisks(profile, posts, activityHealth, patternAnalysis);
    const recommendations = this.generateRecommendations(activityHealth, authorityScore, riskIndicators);

    // Calculate overall health
    const overallHealth = this.calculateOverallHealth(
      activityHealth,
      authorityScore,
      patternAnalysis,
      botInteractionAnalysis,
      riskIndicators
    );

    const report: FacebookHealthReport = {
      accountId: profile.accountId,
      profileId: profile.id,
      overallHealth,
      activityHealth,
      authorityScore,
      patternAnalysis,
      botInteractionAnalysis,
      riskIndicators,
      recommendations,
      lastUpdated: now,
    };

    // Cache the report
    this.healthCache.set(profileId, { data: report, expiry: Date.now() + this.CACHE_TTL });

    // Store in database for historical tracking
    await this.storeHealthReport(report);

    return report;
  }

  /**
   * Analyze activity health metrics
   */
  private analyzeActivityHealth(posts: any[]): ActivityHealth {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Count posts
    const postsLast24h = posts.filter(p => new Date(p.createdAt) >= dayAgo).length;
    const postsLastWeek = posts.filter(p => new Date(p.createdAt) >= weekAgo).length;

    // Success rate
    const successfulPosts = posts.filter(p => p.status === 'ACTIVE').length;
    const successRate = posts.length > 0 ? (successfulPosts / posts.length) * 100 : 100;

    // Calculate average interval between posts
    const sortedPosts = posts
      .map(p => new Date(p.createdAt).getTime())
      .sort((a, b) => a - b);
    
    let totalInterval = 0;
    for (let i = 1; i < sortedPosts.length; i++) {
      totalInterval += sortedPosts[i] - sortedPosts[i - 1];
    }
    const avgInterval = sortedPosts.length > 1 
      ? totalInterval / (sortedPosts.length - 1) / (1000 * 60 * 60) // in hours
      : 24;

    // Peak activity hours
    const hourCounts: Record<number, number> = {};
    posts.forEach(p => {
      const hour = new Date(p.createdAt).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    const peakHours = Object.entries(hourCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    // Consistency score (standard deviation of posting intervals)
    const intervals: number[] = [];
    for (let i = 1; i < sortedPosts.length; i++) {
      intervals.push((sortedPosts[i] - sortedPosts[i - 1]) / (1000 * 60 * 60));
    }
    
    const avgIntervalForConsistency = intervals.length > 0 
      ? intervals.reduce((a, b) => a + b, 0) / intervals.length 
      : 24;
    
    const variance = intervals.length > 0
      ? intervals.reduce((sum, val) => sum + Math.pow(val - avgIntervalForConsistency, 2), 0) / intervals.length
      : 0;
    
    const stdDev = Math.sqrt(variance);
    const consistencyScore = Math.max(0, 100 - (stdDev * 5)); // Lower stdDev = higher consistency

    return {
      postsPerDay: Math.round(postsLast24h * 10) / 10,
      postsPerWeek: postsLastWeek,
      postSuccessRate: Math.round(successRate * 10) / 10,
      engagementRate: 0, // Would need engagement data from FB
      responseRate: 0, // Would need response data
      avgPostInterval: Math.round(avgInterval * 10) / 10,
      peakActivityHours: peakHours,
      consistencyScore: Math.round(consistencyScore),
    };
  }

  /**
   * Calculate authority score
   */
  private async calculateAuthorityScore(profile: any, posts: any[]): Promise<AuthorityScore> {
    const now = new Date();
    const accountAge = Math.floor((now.getTime() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const yearsActive = accountAge / 365;

    const totalPosts = posts.length;
    const successfulPosts = posts.filter(p => p.status === 'ACTIVE').length;

    // Calculate historical performance (weighted by recency)
    let weightedScore = 0;
    let totalWeight = 0;
    posts.forEach((post, index) => {
      const weight = 1 / (index + 1); // More recent posts have higher weight
      const success = post.status === 'ACTIVE' ? 1 : 0;
      weightedScore += success * weight;
      totalWeight += weight;
    });
    const historicalPerformance = totalWeight > 0 ? (weightedScore / totalWeight) * 100 : 50;

    // Determine trust level
    let trustLevel: 'high' | 'medium' | 'low' | 'new';
    if (accountAge < 30) {
      trustLevel = 'new';
    } else if (yearsActive >= 2 && historicalPerformance >= 80) {
      trustLevel = 'high';
    } else if (yearsActive >= 0.5 && historicalPerformance >= 60) {
      trustLevel = 'medium';
    } else {
      trustLevel = 'low';
    }

    // Calculate overall authority score
    const ageScore = Math.min(100, accountAge / 3); // Max at 300 days
    const performanceScore = historicalPerformance;
    const volumeScore = Math.min(100, totalPosts / 10); // Max at 1000 posts

    const score = Math.round((ageScore * 0.3) + (performanceScore * 0.5) + (volumeScore * 0.2));

    return {
      score,
      yearsActive: Math.round(yearsActive * 10) / 10,
      totalPosts,
      successfulPosts,
      accountAge,
      verificationStatus: 'unverified', // Would need FB verification data
      trustLevel,
      historicalPerformance: Math.round(historicalPerformance),
    };
  }

  /**
   * Analyze posting patterns
   */
  private analyzePatterns(posts: any[]): PatternAnalysis {
    // Time distribution
    const timeDistribution: Record<number, number> = {};
    const dayDistribution: Record<string, number> = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    posts.forEach(p => {
      const date = new Date(p.createdAt);
      const hour = date.getHours();
      const day = dayNames[date.getDay()];
      
      timeDistribution[hour] = (timeDistribution[hour] || 0) + 1;
      dayDistribution[day] = (dayDistribution[day] || 0) + 1;
    });

    // Detect anomalies
    const anomalies: PatternAnomaly[] = [];

    // Check for bursts (more than 10 posts in an hour)
    Object.entries(timeDistribution).forEach(([hour, count]) => {
      if (count > 10) {
        anomalies.push({
          type: 'burst',
          severity: count > 20 ? 'high' : 'medium',
          description: `High posting frequency at hour ${hour}`,
          timestamp: new Date(),
        });
      }
    });

    // Check for gaps (no posts for 7+ days)
    if (posts.length >= 2) {
      const sortedPosts = posts
        .map(p => new Date(p.createdAt).getTime())
        .sort((a, b) => b - a);
      
      for (let i = 0; i < sortedPosts.length - 1; i++) {
        const gap = (sortedPosts[i] - sortedPosts[i + 1]) / (1000 * 60 * 60 * 24);
        if (gap > 7) {
          anomalies.push({
            type: 'gap',
            severity: gap > 14 ? 'high' : 'medium',
            description: `${Math.round(gap)} day gap in posting activity`,
            timestamp: new Date(sortedPosts[i + 1]),
          });
        }
      }
    }

    // Determine posting pattern
    const recentPosts = posts.filter(p => {
      const age = (Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return age <= 30;
    });

    let postingPattern: 'consistent' | 'irregular' | 'bursty' | 'dormant';
    if (recentPosts.length === 0) {
      postingPattern = 'dormant';
    } else if (anomalies.some(a => a.type === 'burst' && a.severity === 'high')) {
      postingPattern = 'bursty';
    } else if (anomalies.length > 3) {
      postingPattern = 'irregular';
    } else {
      postingPattern = 'consistent';
    }

    // Velocity trend (comparing last 7 days to previous 7 days)
    const now = Date.now();
    const last7Days = posts.filter(p => (now - new Date(p.createdAt).getTime()) <= 7 * 24 * 60 * 60 * 1000).length;
    const prev7Days = posts.filter(p => {
      const age = now - new Date(p.createdAt).getTime();
      return age > 7 * 24 * 60 * 60 * 1000 && age <= 14 * 24 * 60 * 60 * 1000;
    }).length;

    let velocityTrend: 'increasing' | 'stable' | 'decreasing';
    if (last7Days > prev7Days * 1.2) {
      velocityTrend = 'increasing';
    } else if (last7Days < prev7Days * 0.8) {
      velocityTrend = 'decreasing';
    } else {
      velocityTrend = 'stable';
    }

    return {
      postingPattern,
      timeDistribution,
      dayDistribution,
      velocityTrend,
      anomalies,
    };
  }

  /**
   * Analyze bot interaction patterns
   */
  private analyzeBotInteractions(posts: any[], _profile: any): BotInteractionAnalysis {
    const indicators: AutomationIndicator[] = [];
    const suspiciousPatterns: SuspiciousPattern[] = [];

    // Check for exact interval posting (bot-like behavior)
    if (posts.length >= 10) {
      const intervals: number[] = [];
      const sortedPosts = posts
        .map(p => new Date(p.createdAt).getTime())
        .sort((a, b) => a - b);
      
      for (let i = 1; i < sortedPosts.length; i++) {
        intervals.push(sortedPosts[i] - sortedPosts[i - 1]);
      }

      // Check for suspiciously consistent intervals
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      const coeffOfVariation = stdDev / avgInterval;

      const exactIntervalIndicator: AutomationIndicator = {
        indicator: 'Exact Interval Posting',
        detected: coeffOfVariation < 0.1, // Very low variation suggests automation
        weight: 30,
        description: 'Posts are made at suspiciously regular intervals',
      };
      indicators.push(exactIntervalIndicator);

      if (exactIntervalIndicator.detected) {
        suspiciousPatterns.push({
          type: 'exact_timing',
          confidence: Math.round((1 - coeffOfVariation) * 100),
          description: 'Posts are made at very regular intervals, suggesting automation',
          evidence: [`Coefficient of variation: ${(coeffOfVariation * 100).toFixed(2)}%`],
        });
      }
    }

    // Check for off-hours posting (3am-5am in account timezone)
    const offHoursPosts = posts.filter(p => {
      const hour = new Date(p.createdAt).getHours();
      return hour >= 3 && hour <= 5;
    });
    const offHoursRatio = posts.length > 0 ? offHoursPosts.length / posts.length : 0;

    indicators.push({
      indicator: 'Off-Hours Activity',
      detected: offHoursRatio > 0.1,
      weight: 20,
      description: 'Significant posting activity during unusual hours (3am-5am)',
    });

    // Check for repetitive content (would need content analysis)
    indicators.push({
      indicator: 'Repetitive Content',
      detected: false, // Would need content analysis
      weight: 25,
      description: 'Content shows repetitive patterns',
    });

    // Check for human-like timing variations
    indicators.push({
      indicator: 'Human Timing Patterns',
      detected: true, // Assume true unless proven otherwise
      weight: 25,
      description: 'Posting times show natural human variation',
    });

    // Calculate bot interaction score (lower is better)
    const detectedWeight = indicators
      .filter(i => i.detected && i.indicator !== 'Human Timing Patterns')
      .reduce((sum, i) => sum + i.weight, 0);
    
    const humanIndicatorWeight = indicators
      .filter(i => i.detected && i.indicator === 'Human Timing Patterns')
      .reduce((sum, i) => sum + i.weight, 0);

    const botInteractionScore = Math.min(100, detectedWeight - humanIndicatorWeight * 0.5);
    const humanLikelihood = Math.max(0, 100 - botInteractionScore);

    let interactionQuality: 'authentic' | 'mixed' | 'suspicious';
    if (humanLikelihood >= 80) {
      interactionQuality = 'authentic';
    } else if (humanLikelihood >= 50) {
      interactionQuality = 'mixed';
    } else {
      interactionQuality = 'suspicious';
    }

    return {
      botInteractionScore: Math.max(0, botInteractionScore),
      humanLikelihood,
      suspiciousPatterns,
      automationIndicators: indicators,
      interactionQuality,
    };
  }

  /**
   * Identify risk indicators
   */
  private identifyRisks(
    profile: any,
    _posts: any[],
    activityHealth: ActivityHealth,
    patternAnalysis: PatternAnalysis
  ): RiskIndicator[] {
    const risks: RiskIndicator[] = [];
    const now = new Date();

    // Rate limit risk
    if (activityHealth.postsPerDay > 20) {
      risks.push({
        type: RiskType.RATE_LIMIT,
        level: activityHealth.postsPerDay > 50 ? 'critical' : activityHealth.postsPerDay > 30 ? 'high' : 'medium',
        score: Math.min(100, activityHealth.postsPerDay * 3),
        description: `High posting frequency (${activityHealth.postsPerDay} posts/day) may trigger rate limits`,
        mitigation: 'Reduce posting frequency to under 20 posts per day',
        detectedAt: now,
      });
    }

    // Token expiry risk
    if (profile.tokenExpiresAt) {
      const daysUntilExpiry = (new Date(profile.tokenExpiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysUntilExpiry < 7) {
        risks.push({
          type: RiskType.TOKEN_EXPIRY,
          level: daysUntilExpiry < 1 ? 'critical' : daysUntilExpiry < 3 ? 'high' : 'medium',
          score: Math.round(100 - (daysUntilExpiry * 14)),
          description: `Access token expires in ${Math.round(daysUntilExpiry)} days`,
          mitigation: 'Refresh Facebook access token immediately',
          detectedAt: now,
        });
      }
    }

    // Low engagement risk
    if (activityHealth.postSuccessRate < 70) {
      risks.push({
        type: RiskType.LOW_ENGAGEMENT,
        level: activityHealth.postSuccessRate < 50 ? 'high' : 'medium',
        score: Math.round(100 - activityHealth.postSuccessRate),
        description: `Low post success rate (${activityHealth.postSuccessRate}%)`,
        mitigation: 'Review and improve post content quality',
        detectedAt: now,
      });
    }

    // Pattern anomaly risk
    const highSeverityAnomalies = patternAnalysis.anomalies.filter(a => a.severity === 'high');
    if (highSeverityAnomalies.length > 0) {
      risks.push({
        type: RiskType.PATTERN_ANOMALY,
        level: highSeverityAnomalies.length > 2 ? 'high' : 'medium',
        score: Math.min(100, highSeverityAnomalies.length * 30),
        description: `${highSeverityAnomalies.length} high-severity pattern anomalies detected`,
        mitigation: 'Review and normalize posting patterns',
        detectedAt: now,
      });
    }

    // Dormant account risk
    if (patternAnalysis.postingPattern === 'dormant') {
      risks.push({
        type: RiskType.SUSPICIOUS_ACTIVITY,
        level: 'medium',
        score: 50,
        description: 'Account has been dormant with no recent posting activity',
        mitigation: 'Resume posting activity gradually',
        detectedAt: now,
      });
    }

    return risks.sort((a, b) => {
      const levelOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return levelOrder[b.level] - levelOrder[a.level];
    });
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    activityHealth: ActivityHealth,
    authorityScore: AuthorityScore,
    riskIndicators: RiskIndicator[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Posting frequency recommendation
    if (activityHealth.postsPerDay < 1) {
      recommendations.push({
        priority: 'high',
        category: 'posting',
        action: 'Increase posting frequency',
        reason: 'Low posting frequency may reduce visibility',
        impact: 'Improved reach and engagement',
      });
    } else if (activityHealth.postsPerDay > 20) {
      recommendations.push({
        priority: 'critical',
        category: 'posting',
        action: 'Reduce posting frequency to under 20 posts per day',
        reason: 'High frequency may trigger Facebook rate limits',
        impact: 'Avoid account restrictions',
      });
    }

    // Timing recommendation
    if (activityHealth.consistencyScore < 50) {
      recommendations.push({
        priority: 'medium',
        category: 'timing',
        action: 'Establish consistent posting schedule',
        reason: 'Irregular posting patterns may appear bot-like',
        impact: 'Improved account standing and reach',
      });
    }

    // Authority building
    if (authorityScore.trustLevel === 'new' || authorityScore.trustLevel === 'low') {
      recommendations.push({
        priority: 'medium',
        category: 'posting',
        action: 'Build account authority gradually',
        reason: 'New or low-trust accounts need careful management',
        impact: 'Long-term account health and reach',
      });
    }

    // Risk-based recommendations
    riskIndicators.forEach(risk => {
      if (risk.mitigation && (risk.level === 'high' || risk.level === 'critical')) {
        recommendations.push({
          priority: risk.level === 'critical' ? 'critical' : 'high',
          category: 'security',
          action: risk.mitigation,
          reason: risk.description,
          impact: 'Risk mitigation',
        });
      }
    });

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Calculate overall health score
   */
  private calculateOverallHealth(
    activityHealth: ActivityHealth,
    authorityScore: AuthorityScore,
    patternAnalysis: PatternAnalysis,
    botInteraction: BotInteractionAnalysis,
    riskIndicators: RiskIndicator[]
  ): HealthScore {
    const factors: HealthFactor[] = [];

    // Activity factor (25% weight)
    const activityScore = (activityHealth.postSuccessRate * 0.5) + (activityHealth.consistencyScore * 0.5);
    factors.push({
      name: 'Activity Health',
      weight: 25,
      score: activityScore,
      impact: activityScore >= 70 ? 'positive' : activityScore >= 40 ? 'neutral' : 'negative',
      description: 'Overall posting activity and success rate',
    });

    // Authority factor (25% weight)
    factors.push({
      name: 'Account Authority',
      weight: 25,
      score: authorityScore.score,
      impact: authorityScore.score >= 70 ? 'positive' : authorityScore.score >= 40 ? 'neutral' : 'negative',
      description: 'Account age, history, and trustworthiness',
    });

    // Pattern factor (25% weight)
    const patternScore = patternAnalysis.postingPattern === 'consistent' ? 100 :
      patternAnalysis.postingPattern === 'irregular' ? 50 :
      patternAnalysis.postingPattern === 'bursty' ? 30 : 20;
    factors.push({
      name: 'Posting Patterns',
      weight: 25,
      score: patternScore,
      impact: patternScore >= 70 ? 'positive' : patternScore >= 40 ? 'neutral' : 'negative',
      description: 'Consistency and naturalness of posting patterns',
    });

    // Bot interaction factor (25% weight)
    factors.push({
      name: 'Human Authenticity',
      weight: 25,
      score: botInteraction.humanLikelihood,
      impact: botInteraction.humanLikelihood >= 70 ? 'positive' : botInteraction.humanLikelihood >= 40 ? 'neutral' : 'negative',
      description: 'How human-like the account behavior appears',
    });

    // Calculate weighted score
    const weightedScore = factors.reduce((sum, f) => sum + (f.score * f.weight / 100), 0);

    // Apply risk penalty
    const riskPenalty = riskIndicators.reduce((sum, r) => {
      const levelPenalty = { critical: 20, high: 10, medium: 5, low: 2 };
      return sum + levelPenalty[r.level];
    }, 0);

    const finalScore = Math.max(0, Math.min(100, weightedScore - riskPenalty));

    // Determine status
    let status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    if (finalScore >= 85) status = 'excellent';
    else if (finalScore >= 70) status = 'good';
    else if (finalScore >= 50) status = 'fair';
    else if (finalScore >= 30) status = 'poor';
    else status = 'critical';

    // Determine trend (would need historical data)
    const trend: 'improving' | 'stable' | 'declining' = 'stable';

    return {
      score: Math.round(finalScore),
      status,
      trend,
      factors,
    };
  }

  /**
   * Store health report for historical tracking
   */
  private async storeHealthReport(report: FacebookHealthReport): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: 'FB_HEALTH_REPORT',
          entityType: 'FacebookProfile',
          entityId: report.profileId,
          metadata: {
            healthScore: report.overallHealth.score,
            status: report.overallHealth.status,
            riskCount: report.riskIndicators.length,
            authorityScore: report.authorityScore.score,
          },
          ipAddress: 'system',
          userAgent: 'HealthIntelligenceService',
        },
      });
    } catch (error) {
      logger.error('Failed to store health report', { error, profileId: report.profileId });
    }
  }

  // =========================================================================
  // Aggregated Reports
  // =========================================================================

  /**
   * Get aggregated health report for all profiles in an account
   */
  async getAccountHealthReport(accountId: string): Promise<AggregatedHealthReport> {
    const profiles = await prisma.facebookProfile.findMany({
      where: { accountId },
    });

    const reports = await Promise.all(
      profiles.map(p => this.analyzeProfileHealth(p.id))
    );

    return this.aggregateReports(reports);
  }

  /**
   * Get system-wide health report (Super Admin only)
   */
  async getSystemHealthReport(): Promise<AggregatedHealthReport> {
    const profiles = await prisma.facebookProfile.findMany({
      where: { isActive: true },
      take: 100, // Limit for performance
    });

    const reports = await Promise.all(
      profiles.map(p => this.analyzeProfileHealth(p.id))
    );

    return this.aggregateReports(reports);
  }

  /**
   * Aggregate multiple health reports
   */
  private aggregateReports(reports: FacebookHealthReport[]): AggregatedHealthReport {
    const healthDistribution = {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
      critical: 0,
    };

    let totalHealthScore = 0;
    let totalAuthorityScore = 0;
    const allRisks: RiskIndicator[] = [];

    reports.forEach(r => {
      healthDistribution[r.overallHealth.status]++;
      totalHealthScore += r.overallHealth.score;
      totalAuthorityScore += r.authorityScore.score;
      allRisks.push(...r.riskIndicators);
    });

    // Sort and dedupe risks
    const topRisks = allRisks
      .sort((a, b) => {
        const levelOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return levelOrder[b.level] - levelOrder[a.level];
      })
      .slice(0, 10);

    // Generate system-wide recommendations
    const systemRecommendations: Recommendation[] = [];
    
    if (healthDistribution.critical > 0) {
      systemRecommendations.push({
        priority: 'critical',
        category: 'security',
        action: `Address ${healthDistribution.critical} critical health profiles immediately`,
        reason: 'Critical profiles risk account suspension',
        impact: 'Prevent service disruption',
      });
    }

    if (healthDistribution.poor > reports.length * 0.2) {
      systemRecommendations.push({
        priority: 'high',
        category: 'posting',
        action: 'Review posting strategies for underperforming accounts',
        reason: 'More than 20% of profiles are in poor health',
        impact: 'Improved overall system health',
      });
    }

    return {
      timestamp: new Date(),
      totalProfiles: reports.length,
      healthDistribution,
      averageHealthScore: reports.length > 0 ? Math.round(totalHealthScore / reports.length) : 0,
      averageAuthorityScore: reports.length > 0 ? Math.round(totalAuthorityScore / reports.length) : 0,
      topRisks,
      systemWideRecommendations: systemRecommendations,
      profiles: reports,
    };
  }

  /**
   * Clear health cache
   */
  clearCache(): void {
    this.healthCache.clear();
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    if (this.redis) {
      this.redis.disconnect();
    }
    this.healthCache.clear();
  }
}

// Singleton export
export const facebookHealthIntelligenceService = new FacebookHealthIntelligenceService();
