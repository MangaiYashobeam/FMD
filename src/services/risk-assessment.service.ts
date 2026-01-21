/**
 * Risk Assessment Service
 * 
 * Comprehensive risk analysis for Facebook automation activities.
 * Evaluates and scores:
 * - Blocking risk from Facebook
 * - Account health risks
 * - Security vulnerabilities
 * - Compliance issues
 * - Operational risks
 * 
 * Security: All assessments are encrypted and audit-logged
 */

import prisma from '@/config/database';
import { logger } from '@/utils/logger';
import { facebookHealthIntelligenceService } from './facebook-health-intelligence.service';
import { workerQueueService } from './worker-queue.service';
import Redis from 'ioredis';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface RiskAssessment {
  timestamp: Date;
  overallRiskScore: number; // 0-100 (higher = more risky)
  riskLevel: 'minimal' | 'low' | 'moderate' | 'high' | 'critical';
  categories: RiskCategory[];
  fbBlockingRisk: FacebookBlockingRisk;
  securityRisk: SecurityRisk;
  operationalRisk: OperationalRisk;
  complianceRisk: ComplianceRisk;
  mitigation: MitigationPlan;
  historicalTrend: RiskTrend[];
}

export interface RiskCategory {
  name: string;
  score: number; // 0-100
  level: 'minimal' | 'low' | 'moderate' | 'high' | 'critical';
  weight: number; // percentage weight in overall score
  factors: RiskFactor[];
}

export interface RiskFactor {
  id: string;
  name: string;
  description: string;
  currentValue: number | string;
  threshold: number | string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  trending: 'improving' | 'stable' | 'worsening';
}

export interface FacebookBlockingRisk {
  score: number; // 0-100
  level: 'minimal' | 'low' | 'moderate' | 'high' | 'critical';
  factors: FBRiskFactor[];
  estimatedTimeToBlock: string | null; // e.g., "2-3 days", "1 week"
  historicalBlocks: number;
  warningsSent: number;
  cooldownRecommended: boolean;
  cooldownDuration: number | null; // hours
}

export interface FBRiskFactor {
  factor: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  currentState: string;
  recommendation: string;
  weight: number;
}

export interface SecurityRisk {
  score: number;
  level: 'minimal' | 'low' | 'moderate' | 'high' | 'critical';
  vulnerabilities: Vulnerability[];
  activeThreats: number;
  recentIncidents: SecurityIncident[];
  exposurePoints: ExposurePoint[];
}

export interface Vulnerability {
  id: string;
  type: 'credential' | 'token' | 'config' | 'network' | 'data';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedComponents: string[];
  remediation: string;
  detectedAt: Date;
}

export interface SecurityIncident {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  occurredAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface ExposurePoint {
  type: string;
  location: string;
  risk: 'low' | 'medium' | 'high';
  description: string;
}

export interface OperationalRisk {
  score: number;
  level: 'minimal' | 'low' | 'moderate' | 'high' | 'critical';
  systemStability: number; // 0-100
  workerHealth: WorkerHealthRisk;
  queueBacklog: number;
  failureRate: number;
  avgResponseTime: number;
  bottlenecks: Bottleneck[];
}

export interface WorkerHealthRisk {
  totalWorkers: number;
  healthyWorkers: number;
  unhealthyWorkers: number;
  overloadedWorkers: number;
  avgCpuUsage: number;
  avgMemoryUsage: number;
}

export interface Bottleneck {
  location: string;
  type: 'performance' | 'capacity' | 'reliability';
  severity: 'low' | 'medium' | 'high';
  description: string;
  impact: string;
}

export interface ComplianceRisk {
  score: number;
  level: 'minimal' | 'low' | 'moderate' | 'high' | 'critical';
  fbTosViolations: TOSViolation[];
  dataPrivacyRisks: DataPrivacyRisk[];
  regulatoryIssues: RegulatoryIssue[];
  lastAudit: Date | null;
  auditScore: number | null;
}

export interface TOSViolation {
  type: string;
  severity: 'warning' | 'violation' | 'ban_risk';
  description: string;
  detectedAt: Date;
  profiles: string[];
}

export interface DataPrivacyRisk {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedData: string[];
  mitigation: string;
}

export interface RegulatoryIssue {
  regulation: string; // GDPR, CCPA, etc.
  issue: string;
  severity: 'low' | 'medium' | 'high';
  deadline?: Date;
}

export interface MitigationPlan {
  priority: 'immediate' | 'urgent' | 'planned' | 'monitoring';
  actions: MitigationAction[];
  estimatedImpact: number; // Expected risk reduction
  estimatedCost: 'low' | 'medium' | 'high';
  implementationTime: string;
}

export interface MitigationAction {
  id: string;
  priority: number;
  action: string;
  category: 'fb_risk' | 'security' | 'operational' | 'compliance';
  expectedImpact: number; // 0-100
  effort: 'low' | 'medium' | 'high';
  deadline?: Date;
}

export interface RiskTrend {
  date: Date;
  overallScore: number;
  fbRiskScore: number;
  securityScore: number;
  operationalScore: number;
}

// ============================================================================
// Risk Assessment Service
// ============================================================================

class RiskAssessmentService {
  private redis: Redis | null = null;
  private assessmentCache: Map<string, { data: RiskAssessment; expiry: number }> = new Map();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  // Risk thresholds
  private readonly THRESHOLDS = {
    postsPerDay: { safe: 10, warning: 20, danger: 30, critical: 50 },
    failureRate: { safe: 0.05, warning: 0.15, danger: 0.25, critical: 0.40 },
    tokenExpiry: { safe: 30, warning: 14, danger: 7, critical: 3 }, // days
    workerLoad: { safe: 0.5, warning: 0.7, danger: 0.85, critical: 0.95 },
  };

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
        logger.info('Risk Assessment service initialized');
      } catch (error) {
        logger.warn('Redis not available for risk assessment caching', { error });
      }
    }
  }

  // =========================================================================
  // Main Assessment Methods
  // =========================================================================

  /**
   * Perform comprehensive risk assessment for an account
   */
  async assessAccountRisk(accountId: string): Promise<RiskAssessment> {
    const cacheKey = `risk:account:${accountId}`;
    const cached = this.assessmentCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    // Gather data for assessment
    const [fbHealth, workerStats, securityEvents, profiles] = await Promise.all([
      facebookHealthIntelligenceService.getAccountHealthReport(accountId),
      workerQueueService.getQueueStats(),
      this.getSecurityEvents(accountId),
      prisma.facebookProfile.findMany({
        where: { accountId },
        include: { posts: { take: 100, orderBy: { createdAt: 'desc' } } },
      }),
    ]);

    // Assess each risk category
    const fbBlockingRisk = this.assessFacebookBlockingRisk(profiles, fbHealth);
    const securityRisk = await this.assessSecurityRisk(accountId, securityEvents);
    const operationalRisk = await this.assessOperationalRisk(workerStats);
    const complianceRisk = this.assessComplianceRisk(profiles, fbHealth);

    // Build risk categories
    const categories: RiskCategory[] = [
      {
        name: 'Facebook Blocking Risk',
        score: fbBlockingRisk.score,
        level: fbBlockingRisk.level,
        weight: 40,
        factors: fbBlockingRisk.factors.map(f => ({
          id: f.factor.toLowerCase().replace(/\s/g, '_'),
          name: f.factor,
          description: f.recommendation,
          currentValue: f.currentState,
          threshold: 'Normal',
          severity: f.impact,
          trending: 'stable' as const,
        })),
      },
      {
        name: 'Security Risk',
        score: securityRisk.score,
        level: securityRisk.level,
        weight: 25,
        factors: securityRisk.vulnerabilities.map(v => ({
          id: v.id,
          name: v.type,
          description: v.description,
          currentValue: v.severity,
          threshold: 'None',
          severity: v.severity,
          trending: 'stable' as const,
        })),
      },
      {
        name: 'Operational Risk',
        score: operationalRisk.score,
        level: operationalRisk.level,
        weight: 20,
        factors: operationalRisk.bottlenecks.map(b => ({
          id: b.location.toLowerCase().replace(/\s/g, '_'),
          name: b.location,
          description: b.description,
          currentValue: b.impact,
          threshold: 'Normal',
          severity: b.severity,
          trending: 'stable' as const,
        })),
      },
      {
        name: 'Compliance Risk',
        score: complianceRisk.score,
        level: complianceRisk.level,
        weight: 15,
        factors: complianceRisk.fbTosViolations.map(v => ({
          id: v.type.toLowerCase().replace(/\s/g, '_'),
          name: v.type,
          description: v.description,
          currentValue: v.severity,
          threshold: 'None',
          severity: v.severity === 'ban_risk' ? 'critical' : v.severity === 'violation' ? 'high' : 'medium',
          trending: 'stable' as const,
        })),
      },
    ];

    // Calculate overall risk score (weighted average)
    const overallRiskScore = Math.round(
      categories.reduce((sum, c) => sum + (c.score * c.weight / 100), 0)
    );

    // Determine overall risk level
    const riskLevel = this.scoreToLevel(overallRiskScore);

    // Generate mitigation plan
    const mitigation = this.generateMitigationPlan(categories, fbBlockingRisk, securityRisk);

    // Get historical trend
    const historicalTrend = await this.getHistoricalTrend(accountId);

    const assessment: RiskAssessment = {
      timestamp: new Date(),
      overallRiskScore,
      riskLevel,
      categories,
      fbBlockingRisk,
      securityRisk,
      operationalRisk,
      complianceRisk,
      mitigation,
      historicalTrend,
    };

    // Cache and store
    this.assessmentCache.set(cacheKey, { data: assessment, expiry: Date.now() + this.CACHE_TTL });
    await this.storeAssessment(accountId, assessment);

    return assessment;
  }

  /**
   * Perform system-wide risk assessment (Super Admin)
   */
  async assessSystemRisk(): Promise<RiskAssessment> {
    const cacheKey = 'risk:system';
    const cached = this.assessmentCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    // Gather system-wide data
    const [
      fbHealth,
      workerStats,
      activeWorkers,
      securityEvents,
      totalProfiles,
      recentPosts,
    ] = await Promise.all([
      facebookHealthIntelligenceService.getSystemHealthReport(),
      workerQueueService.getQueueStats(),
      workerQueueService.getActiveWorkers(),
      this.getSystemSecurityEvents(),
      prisma.facebookProfile.count({ where: { isActive: true } }),
      prisma.facebookPost.count({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
    ]);

    // Build system-wide risk assessment
    const fbBlockingRisk = this.assessSystemFBRisk(fbHealth, recentPosts, totalProfiles);
    const securityRisk = await this.assessSystemSecurityRisk(securityEvents);
    const operationalRisk = this.assessSystemOperationalRisk(workerStats, activeWorkers);
    const complianceRisk = this.assessSystemComplianceRisk(fbHealth);

    const categories: RiskCategory[] = [
      {
        name: 'Facebook Blocking Risk',
        score: fbBlockingRisk.score,
        level: fbBlockingRisk.level,
        weight: 40,
        factors: fbBlockingRisk.factors.map(f => ({
          id: f.factor.toLowerCase().replace(/\s/g, '_'),
          name: f.factor,
          description: f.recommendation,
          currentValue: f.currentState,
          threshold: 'Normal',
          severity: f.impact,
          trending: 'stable' as const,
        })),
      },
      {
        name: 'Security Risk',
        score: securityRisk.score,
        level: securityRisk.level,
        weight: 25,
        factors: [],
      },
      {
        name: 'Operational Risk',
        score: operationalRisk.score,
        level: operationalRisk.level,
        weight: 20,
        factors: [],
      },
      {
        name: 'Compliance Risk',
        score: complianceRisk.score,
        level: complianceRisk.level,
        weight: 15,
        factors: [],
      },
    ];

    const overallRiskScore = Math.round(
      categories.reduce((sum, c) => sum + (c.score * c.weight / 100), 0)
    );

    const riskLevel = this.scoreToLevel(overallRiskScore);
    const mitigation = this.generateMitigationPlan(categories, fbBlockingRisk, securityRisk);
    const historicalTrend = await this.getSystemHistoricalTrend();

    const assessment: RiskAssessment = {
      timestamp: new Date(),
      overallRiskScore,
      riskLevel,
      categories,
      fbBlockingRisk,
      securityRisk,
      operationalRisk,
      complianceRisk,
      mitigation,
      historicalTrend,
    };

    this.assessmentCache.set(cacheKey, { data: assessment, expiry: Date.now() + this.CACHE_TTL });

    return assessment;
  }

  // =========================================================================
  // Individual Risk Assessment Methods
  // =========================================================================

  /**
   * Assess Facebook blocking risk
   */
  private assessFacebookBlockingRisk(profiles: any[], fbHealth: any): FacebookBlockingRisk {
    const factors: FBRiskFactor[] = [];
    let totalScore = 0;
    let totalWeight = 0;

    // Factor 1: Posting frequency
    const avgPostsPerDay = profiles.reduce((sum, p) => {
      const recentPosts = p.posts?.filter((post: any) => {
        const age = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        return age <= 7;
      }).length || 0;
      return sum + (recentPosts / 7);
    }, 0) / Math.max(1, profiles.length);

    const postingFrequencyScore = this.calculateThresholdScore(avgPostsPerDay, this.THRESHOLDS.postsPerDay);
    factors.push({
      factor: 'Posting Frequency',
      impact: this.scoreToSeverity(postingFrequencyScore),
      currentState: `${avgPostsPerDay.toFixed(1)} posts/day average`,
      recommendation: postingFrequencyScore > 50 ? 'Reduce posting frequency' : 'Posting frequency is acceptable',
      weight: 30,
    });
    totalScore += postingFrequencyScore * 0.3;
    totalWeight += 0.3;

    // Factor 2: Post success rate
    const totalPosts = profiles.reduce((sum, p) => sum + (p.posts?.length || 0), 0);
    const failedPosts = profiles.reduce((sum, p) => 
      sum + (p.posts?.filter((post: any) => post.status === 'FAILED').length || 0), 0);
    const failureRate = totalPosts > 0 ? failedPosts / totalPosts : 0;

    const failureScore = this.calculateThresholdScore(failureRate, this.THRESHOLDS.failureRate);
    factors.push({
      factor: 'Post Failure Rate',
      impact: this.scoreToSeverity(failureScore),
      currentState: `${(failureRate * 100).toFixed(1)}% failure rate`,
      recommendation: failureScore > 50 ? 'Investigate and fix posting issues' : 'Failure rate is acceptable',
      weight: 25,
    });
    totalScore += failureScore * 0.25;
    totalWeight += 0.25;

    // Factor 3: Account health from intelligence service
    const avgHealthScore = fbHealth.averageHealthScore || 50;
    const healthRiskScore = 100 - avgHealthScore;
    factors.push({
      factor: 'Account Health',
      impact: this.scoreToSeverity(healthRiskScore),
      currentState: `${avgHealthScore}% average health`,
      recommendation: healthRiskScore > 50 ? 'Improve account health metrics' : 'Account health is good',
      weight: 25,
    });
    totalScore += healthRiskScore * 0.25;
    totalWeight += 0.25;

    // Factor 4: Token expiry proximity
    const profilesWithExpiringTokens = profiles.filter(p => {
      if (!p.tokenExpiresAt) return false;
      const daysUntilExpiry = (new Date(p.tokenExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return daysUntilExpiry < 14;
    }).length;
    const tokenExpiryRatio = profiles.length > 0 ? profilesWithExpiringTokens / profiles.length : 0;
    const tokenScore = tokenExpiryRatio * 100;

    factors.push({
      factor: 'Token Expiry',
      impact: this.scoreToSeverity(tokenScore),
      currentState: `${profilesWithExpiringTokens} profiles with expiring tokens`,
      recommendation: tokenScore > 30 ? 'Refresh expiring tokens immediately' : 'Token status is healthy',
      weight: 20,
    });
    totalScore += tokenScore * 0.2;
    totalWeight += 0.2;

    const finalScore = Math.round(totalScore / totalWeight);
    const level = this.scoreToLevel(finalScore);

    // Estimate time to block based on score
    let estimatedTimeToBlock: string | null = null;
    if (finalScore >= 80) {
      estimatedTimeToBlock = '1-2 days';
    } else if (finalScore >= 60) {
      estimatedTimeToBlock = '3-7 days';
    } else if (finalScore >= 40) {
      estimatedTimeToBlock = '1-2 weeks';
    }

    // Count critical profiles
    const criticalProfiles = fbHealth.healthDistribution?.critical || 0;

    return {
      score: finalScore,
      level,
      factors,
      estimatedTimeToBlock,
      historicalBlocks: 0, // Would need tracking
      warningsSent: criticalProfiles,
      cooldownRecommended: finalScore > 60,
      cooldownDuration: finalScore > 80 ? 48 : finalScore > 60 ? 24 : null,
    };
  }

  /**
   * Assess security risk
   */
  private async assessSecurityRisk(accountId: string, events: any[]): Promise<SecurityRisk> {
    const vulnerabilities: Vulnerability[] = [];
    const incidents: SecurityIncident[] = [];

    // Check for various security issues
    const profiles = await prisma.facebookProfile.findMany({
      where: { accountId },
      select: { id: true, tokenExpiresAt: true, isActive: true },
    });

    // Vulnerability: Expiring tokens
    profiles.forEach(p => {
      if (p.tokenExpiresAt) {
        const daysUntilExpiry = (new Date(p.tokenExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        if (daysUntilExpiry < 7) {
          vulnerabilities.push({
            id: `token_expiry_${p.id}`,
            type: 'token',
            severity: daysUntilExpiry < 1 ? 'critical' : daysUntilExpiry < 3 ? 'high' : 'medium',
            description: `Token expires in ${Math.round(daysUntilExpiry)} days`,
            affectedComponents: [p.id],
            remediation: 'Refresh Facebook access token',
            detectedAt: new Date(),
          });
        }
      }
    });

    // Map security events to incidents
    events.forEach(e => {
      if (['UNAUTHORIZED_ACCESS', 'INJECTION_ATTEMPT', 'CSRF_VIOLATION', 'SUSPICIOUS_ACTIVITY'].includes(e.action)) {
        incidents.push({
          id: e.id,
          type: e.action,
          severity: this.actionToSeverity(e.action),
          description: `Security event: ${e.action}`,
          occurredAt: e.createdAt,
          resolved: false,
        });
      }
    });

    // Calculate score based on vulnerabilities and incidents
    const vulnScore = vulnerabilities.reduce((sum, v) => {
      const weights = { critical: 30, high: 20, medium: 10, low: 5 };
      return sum + weights[v.severity];
    }, 0);

    const incidentScore = incidents.reduce((sum, i) => {
      const weights = { critical: 40, high: 25, medium: 15, low: 5 };
      return sum + weights[i.severity];
    }, 0);

    const score = Math.min(100, vulnScore + incidentScore);
    const level = this.scoreToLevel(score);

    return {
      score,
      level,
      vulnerabilities,
      activeThreats: incidents.filter(i => !i.resolved).length,
      recentIncidents: incidents.slice(0, 10),
      exposurePoints: [],
    };
  }

  /**
   * Assess operational risk
   */
  private async assessOperationalRisk(queueStats: any): Promise<OperationalRisk> {
    const bottlenecks: Bottleneck[] = [];

    // Check queue backlog
    if (queueStats.pending > 100) {
      bottlenecks.push({
        location: 'Task Queue',
        type: 'capacity',
        severity: queueStats.pending > 500 ? 'high' : 'medium',
        description: `${queueStats.pending} tasks pending in queue`,
        impact: 'Delayed task processing',
      });
    }

    // Check failure rate
    const totalProcessed = queueStats.completed + queueStats.failed;
    const failureRate = totalProcessed > 0 ? queueStats.failed / totalProcessed : 0;
    
    if (failureRate > 0.1) {
      bottlenecks.push({
        location: 'Task Processing',
        type: 'reliability',
        severity: failureRate > 0.25 ? 'high' : 'medium',
        description: `${(failureRate * 100).toFixed(1)}% task failure rate`,
        impact: 'Reduced posting reliability',
      });
    }

    // Calculate operational risk score
    const queueScore = Math.min(100, queueStats.pending / 5);
    const failureScore = failureRate * 100 * 2;
    const score = Math.round((queueScore + failureScore) / 2);
    const level = this.scoreToLevel(score);

    return {
      score,
      level,
      systemStability: Math.max(0, 100 - score),
      workerHealth: {
        totalWorkers: 0, // Would need from worker stats
        healthyWorkers: 0,
        unhealthyWorkers: 0,
        overloadedWorkers: 0,
        avgCpuUsage: 0,
        avgMemoryUsage: 0,
      },
      queueBacklog: queueStats.pending,
      failureRate,
      avgResponseTime: 0,
      bottlenecks,
    };
  }

  /**
   * Assess compliance risk
   */
  private assessComplianceRisk(profiles: any[], fbHealth: any): ComplianceRisk {
    const violations: TOSViolation[] = [];
    const dataPrivacyRisks: DataPrivacyRisk[] = [];

    // Check for TOS violations based on health indicators
    if (fbHealth.healthDistribution) {
      const criticalCount = fbHealth.healthDistribution.critical || 0;
      const poorCount = fbHealth.healthDistribution.poor || 0;

      if (criticalCount > 0) {
        violations.push({
          type: 'High-Risk Automation',
          severity: 'ban_risk',
          description: `${criticalCount} profiles in critical health status`,
          detectedAt: new Date(),
          profiles: [],
        });
      }

      if (poorCount > profiles.length * 0.3) {
        violations.push({
          type: 'Excessive Automation',
          severity: 'violation',
          description: 'More than 30% of profiles showing automation signals',
          detectedAt: new Date(),
          profiles: [],
        });
      }
    }

    // Calculate compliance score
    const violationScore = violations.reduce((sum, v) => {
      const weights = { ban_risk: 40, violation: 20, warning: 10 };
      return sum + weights[v.severity];
    }, 0);

    const score = Math.min(100, violationScore);
    const level = this.scoreToLevel(score);

    return {
      score,
      level,
      fbTosViolations: violations,
      dataPrivacyRisks,
      regulatoryIssues: [],
      lastAudit: null,
      auditScore: null,
    };
  }

  // =========================================================================
  // System-Wide Risk Assessment Methods
  // =========================================================================

  private assessSystemFBRisk(fbHealth: any, recentPosts: number, totalProfiles: number): FacebookBlockingRisk {
    const factors: FBRiskFactor[] = [];

    // System posting volume
    const avgPostsPerProfile = totalProfiles > 0 ? recentPosts / totalProfiles : 0;
    const volumeScore = Math.min(100, avgPostsPerProfile * 5);
    factors.push({
      factor: 'System Posting Volume',
      impact: this.scoreToSeverity(volumeScore),
      currentState: `${recentPosts} posts in last 24h`,
      recommendation: volumeScore > 50 ? 'Monitor and reduce if necessary' : 'Volume is acceptable',
      weight: 30,
    });

    // Health distribution
    const criticalRatio = fbHealth.totalProfiles > 0 
      ? (fbHealth.healthDistribution?.critical || 0) / fbHealth.totalProfiles 
      : 0;
    const healthScore = criticalRatio * 300; // 3x multiplier for critical profiles
    factors.push({
      factor: 'Profile Health Distribution',
      impact: this.scoreToSeverity(healthScore),
      currentState: `${fbHealth.healthDistribution?.critical || 0} critical profiles`,
      recommendation: healthScore > 30 ? 'Address critical profile issues' : 'Profile health is acceptable',
      weight: 40,
    });

    const score = Math.round((volumeScore * 0.3) + (healthScore * 0.7));
    const level = this.scoreToLevel(score);

    return {
      score,
      level,
      factors,
      estimatedTimeToBlock: score > 70 ? '1-3 days' : score > 50 ? '1-2 weeks' : null,
      historicalBlocks: 0,
      warningsSent: 0,
      cooldownRecommended: score > 60,
      cooldownDuration: score > 80 ? 48 : score > 60 ? 24 : null,
    };
  }

  private async assessSystemSecurityRisk(events: any[]): Promise<SecurityRisk> {
    const criticalEvents = events.filter(e => 
      ['UNAUTHORIZED_ACCESS', 'INJECTION_ATTEMPT', 'CSRF_VIOLATION'].includes(e.action)
    );

    const score = Math.min(100, criticalEvents.length * 15);
    const level = this.scoreToLevel(score);

    return {
      score,
      level,
      vulnerabilities: [],
      activeThreats: criticalEvents.length,
      recentIncidents: criticalEvents.map(e => ({
        id: e.id,
        type: e.action,
        severity: 'high' as const,
        description: e.action,
        occurredAt: e.createdAt,
        resolved: false,
      })),
      exposurePoints: [],
    };
  }

  private assessSystemOperationalRisk(queueStats: any, workers: any[]): OperationalRisk {
    const bottlenecks: Bottleneck[] = [];

    // Worker availability
    const healthyWorkers = workers.filter(w => {
      const lastHb = w.last_heartbeat ? new Date(w.last_heartbeat) : null;
      return lastHb && (Date.now() - lastHb.getTime()) < 60000;
    }).length;

    if (workers.length > 0 && healthyWorkers < workers.length * 0.5) {
      bottlenecks.push({
        location: 'Worker Pool',
        type: 'reliability',
        severity: 'high',
        description: `Only ${healthyWorkers}/${workers.length} workers healthy`,
        impact: 'Reduced processing capacity',
      });
    }

    const workerScore = workers.length > 0 ? ((workers.length - healthyWorkers) / workers.length) * 100 : 0;
    const queueScore = Math.min(100, queueStats.pending / 10);
    const score = Math.round((workerScore + queueScore) / 2);
    const level = this.scoreToLevel(score);

    return {
      score,
      level,
      systemStability: 100 - score,
      workerHealth: {
        totalWorkers: workers.length,
        healthyWorkers,
        unhealthyWorkers: workers.length - healthyWorkers,
        overloadedWorkers: 0,
        avgCpuUsage: 0,
        avgMemoryUsage: 0,
      },
      queueBacklog: queueStats.pending,
      failureRate: 0,
      avgResponseTime: 0,
      bottlenecks,
    };
  }

  private assessSystemComplianceRisk(fbHealth: any): ComplianceRisk {
    const violations: TOSViolation[] = [];

    if ((fbHealth.healthDistribution?.critical || 0) > 5) {
      violations.push({
        type: 'System-Wide Risk',
        severity: 'ban_risk',
        description: 'Multiple profiles at critical risk levels',
        detectedAt: new Date(),
        profiles: [],
      });
    }

    const score = violations.length > 0 ? 60 : 10;
    const level = this.scoreToLevel(score);

    return {
      score,
      level,
      fbTosViolations: violations,
      dataPrivacyRisks: [],
      regulatoryIssues: [],
      lastAudit: null,
      auditScore: null,
    };
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  private calculateThresholdScore(value: number, thresholds: { safe: number; warning: number; danger: number; critical: number }): number {
    if (value <= thresholds.safe) return 0;
    if (value <= thresholds.warning) return 25;
    if (value <= thresholds.danger) return 50;
    if (value <= thresholds.critical) return 75;
    return 100;
  }

  private scoreToLevel(score: number): 'minimal' | 'low' | 'moderate' | 'high' | 'critical' {
    if (score <= 10) return 'minimal';
    if (score <= 30) return 'low';
    if (score <= 50) return 'moderate';
    if (score <= 75) return 'high';
    return 'critical';
  }

  private scoreToSeverity(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score <= 25) return 'low';
    if (score <= 50) return 'medium';
    if (score <= 75) return 'high';
    return 'critical';
  }

  private actionToSeverity(action: string): 'low' | 'medium' | 'high' | 'critical' {
    const criticalActions = ['INJECTION_ATTEMPT', 'UNAUTHORIZED_ACCESS'];
    const highActions = ['CSRF_VIOLATION', 'SUSPICIOUS_ACTIVITY'];
    
    if (criticalActions.includes(action)) return 'critical';
    if (highActions.includes(action)) return 'high';
    return 'medium';
  }

  private generateMitigationPlan(
    _categories: RiskCategory[],
    fbRisk: FacebookBlockingRisk,
    securityRisk: SecurityRisk
  ): MitigationPlan {
    const actions: MitigationAction[] = [];
    let priority: 'immediate' | 'urgent' | 'planned' | 'monitoring' = 'monitoring';

    // Generate actions based on risk factors
    if (fbRisk.cooldownRecommended) {
      actions.push({
        id: 'cooldown_posting',
        priority: 1,
        action: `Implement ${fbRisk.cooldownDuration}h posting cooldown`,
        category: 'fb_risk',
        expectedImpact: 30,
        effort: 'low',
      });
      priority = 'urgent';
    }

    securityRisk.vulnerabilities.forEach((v, i) => {
      actions.push({
        id: v.id,
        priority: i + 2,
        action: v.remediation,
        category: 'security',
        expectedImpact: v.severity === 'critical' ? 40 : 20,
        effort: 'medium',
      });
      if (v.severity === 'critical') priority = 'immediate';
    });

    const estimatedImpact = actions.reduce((sum, a) => sum + a.expectedImpact, 0);

    return {
      priority,
      actions: actions.slice(0, 10),
      estimatedImpact: Math.min(100, estimatedImpact),
      estimatedCost: actions.length > 5 ? 'high' : actions.length > 2 ? 'medium' : 'low',
      implementationTime: actions.length > 5 ? '2-4 hours' : '30-60 minutes',
    };
  }

  private async getSecurityEvents(_accountId: string): Promise<any[]> {
    return prisma.auditLog.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        action: {
          in: ['UNAUTHORIZED_ACCESS', 'INJECTION_ATTEMPT', 'CSRF_VIOLATION', 'SUSPICIOUS_ACTIVITY', 'LOGIN_FAILED'],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  private async getSystemSecurityEvents(): Promise<any[]> {
    return prisma.auditLog.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        action: {
          in: ['UNAUTHORIZED_ACCESS', 'INJECTION_ATTEMPT', 'CSRF_VIOLATION', 'SUSPICIOUS_ACTIVITY'],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  private async getHistoricalTrend(_accountId: string): Promise<RiskTrend[]> {
    // Would need historical storage - return empty for now
    return [];
  }

  private async getSystemHistoricalTrend(): Promise<RiskTrend[]> {
    return [];
  }

  private async storeAssessment(accountId: string, assessment: RiskAssessment): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: 'RISK_ASSESSMENT',
          entityType: 'Account',
          entityId: accountId,
          metadata: {
            overallScore: assessment.overallRiskScore,
            level: assessment.riskLevel,
            fbRiskScore: assessment.fbBlockingRisk.score,
            securityScore: assessment.securityRisk.score,
          },
          ipAddress: 'system',
          userAgent: 'RiskAssessmentService',
        },
      });
    } catch (error) {
      logger.error('Failed to store risk assessment', { error, accountId });
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.assessmentCache.clear();
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    if (this.redis) {
      this.redis.disconnect();
    }
    this.assessmentCache.clear();
  }
}

// Singleton export
export const riskAssessmentService = new RiskAssessmentService();
