/**
 * Intelliceil - Intelligent Traffic Security System
 * 
 * Anti-DDoS and Exchange Security that works by:
 * 1. Constantly monitoring traffic patterns, sources, types
 * 2. Averaging data to establish baseline "normal" traffic
 * 3. Allowing 25% extra above average before alerting
 * 4. At 30% above average, activating smart mitigation
 * 5. Smart mitigation only blocks abnormal traffic, not all traffic
 * 6. Trusted sources (Facebook, dealers, etc.) always pass through
 */

import { logger } from '@/utils/logger';
import prisma from '@/config/database';
import { EventEmitter } from 'events';

// ============================================
// Types & Interfaces
// ============================================

export interface TrafficSnapshot {
  timestamp: Date;
  requestsPerSecond: number;
  uniqueIPs: number;
  avgResponseTime: number;
  bySource: Record<string, number>;
  byEndpoint: Record<string, number>;
  byCountry: Record<string, number>;
  byMethod: Record<string, number>;
}

export interface TrafficBaseline {
  avgRequestsPerSecond: number;
  avgUniqueIPsPerMinute: number;
  avgResponseTime: number;
  peakRequestsPerSecond: number;
  normalSourceDistribution: Record<string, number>;
  normalEndpointDistribution: Record<string, number>;
  lastUpdated: Date;
  sampleCount: number;
}

export interface ThreatLevel {
  level: 'NORMAL' | 'ELEVATED' | 'ATTACK' | 'CRITICAL';
  percentage: number; // % above baseline
  triggeredAt: Date | null;
  mitigationActive: boolean;
  blockedRequests: number;
  allowedRequests: number;
}

export interface GeoLocation {
  ip: string;
  country: string;
  countryCode: string;
  city: string;
  lat: number;
  lon: number;
  isTrusted: boolean;
  requestCount: number;
  lastSeen: Date;
}

export interface IntelliceilConfig {
  enabled: boolean;
  alertThreshold: number; // Default 25%
  mitigationThreshold: number; // Default 30%
  baselineSampleMinutes: number; // How long to sample for baseline
  trustedDomains: string[];
  trustedIPs: string[];
  blockedIPs: string[];
  blockedCountries: string[];
  maxRequestsPerIP: number;
  windowSeconds: number;
  autoMitigate: boolean;
  notifyOnAttack: boolean;
  notifyEmail: string;
}

// ============================================
// Trusted Sources (Always Allowed)
// ============================================

const DEFAULT_TRUSTED_DOMAINS = [
  // Social Media Platforms
  'facebook.com',
  'www.facebook.com',
  'graph.facebook.com',
  'instagram.com',
  'www.instagram.com',
  
  // Automotive Marketplaces
  'cargurus.com',
  'www.cargurus.com',
  'carmax.com',
  'www.carmax.com',
  'donedeal.ie',
  'www.donedeal.ie',
  'autotrader.com',
  'www.autotrader.com',
  'autotrader.co.uk',
  'www.autotrader.co.uk',
  'cars.com',
  'www.cars.com',
  'kbb.com', // Kelly's Blue Book
  'www.kbb.com',
  'edmunds.com',
  'www.edmunds.com',
  'truecar.com',
  'www.truecar.com',
  
  // DMS Providers
  'dealertrack.com',
  'cdk.com',
  'reynoldsandreynolds.com',
  'dealersocket.com',
  'vinsolutions.com',
  'eleadcrm.com',
  
  // Payment Processors
  'stripe.com',
  'api.stripe.com',
  
  // Our own domains
  'dealersface.com',
  'www.dealersface.com',
  'fmd-production.up.railway.app',
];

const TRUSTED_IP_RANGES = [
  // Facebook IP ranges (example - would need real ranges)
  '157.240.0.0/16',
  '31.13.0.0/16',
  // Cloudflare
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '104.16.0.0/12',
  '108.162.192.0/18',
  '131.0.72.0/22',
  '141.101.64.0/18',
  '162.158.0.0/15',
  '172.64.0.0/13',
  '173.245.48.0/20',
  '188.114.96.0/20',
  '190.93.240.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
];

// ============================================
// Intelliceil Service Class
// ============================================

class IntelliceilService extends EventEmitter {
  private config: IntelliceilConfig;
  private baseline: TrafficBaseline;
  private currentSnapshot: TrafficSnapshot;
  private threatLevel: ThreatLevel;
  private trafficHistory: TrafficSnapshot[] = [];
  private ipRequestCounts: Map<string, { count: number; firstSeen: Date; blocked: boolean }> = new Map();
  private geoLocations: Map<string, GeoLocation> = new Map();
  private blockedRequests: number = 0;
  private allowedRequests: number = 0;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private baselineInterval: NodeJS.Timeout | null = null;
  private registeredDMSDomains: Set<string> = new Set();

  constructor() {
    super();
    
    this.config = {
      enabled: true,
      alertThreshold: 25,
      mitigationThreshold: 30,
      baselineSampleMinutes: 60,
      trustedDomains: [...DEFAULT_TRUSTED_DOMAINS],
      trustedIPs: [],
      blockedIPs: [],
      blockedCountries: [],
      maxRequestsPerIP: 100,
      windowSeconds: 60,
      autoMitigate: true,
      notifyOnAttack: true,
      notifyEmail: 'admin@dealersface.com',
    };

    this.baseline = {
      avgRequestsPerSecond: 10, // Default starting point
      avgUniqueIPsPerMinute: 50,
      avgResponseTime: 100,
      peakRequestsPerSecond: 50,
      normalSourceDistribution: {},
      normalEndpointDistribution: {},
      lastUpdated: new Date(),
      sampleCount: 0,
    };

    this.currentSnapshot = this.createEmptySnapshot();

    this.threatLevel = {
      level: 'NORMAL',
      percentage: 0,
      triggeredAt: null,
      mitigationActive: false,
      blockedRequests: 0,
      allowedRequests: 0,
    };

    logger.info('🛡️ Intelliceil Security System initialized');
  }

  // ============================================
  // Initialization
  // ============================================

  async initialize(): Promise<void> {
    try {
      // Load config from database
      await this.loadConfig();
      
      // Load registered DMS domains
      await this.loadDMSDomains();
      
      // Start monitoring
      this.startMonitoring();
      
      // Start baseline calculation
      this.startBaselineCalculation();
      
      logger.info('🛡️ Intelliceil fully operational');
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize Intelliceil:', error);
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const settings = await prisma.systemSettings.findFirst({
        where: { key: 'intelliceil' }
      });
      if (settings?.value) {
        const savedConfig = settings.value as any;
        this.config = { ...this.config, ...savedConfig };
      }
    } catch (error) {
      logger.warn('Could not load Intelliceil config, using defaults');
    }
  }

  private async loadDMSDomains(): Promise<void> {
    try {
      // Get all unique FTP hosts from accounts (these are DMS systems)
      const accounts = await prisma.account.findMany({
        where: { ftpHost: { not: null } },
        select: { ftpHost: true },
      });
      
      accounts.forEach(acc => {
        if (acc.ftpHost) {
          this.registeredDMSDomains.add(acc.ftpHost);
        }
      });
      
      logger.info(`Loaded ${this.registeredDMSDomains.size} registered DMS domains`);
    } catch (error) {
      logger.warn('Could not load DMS domains');
    }
  }

  // ============================================
  // Traffic Monitoring
  // ============================================

  private startMonitoring(): void {
    // Update snapshot every second
    this.monitoringInterval = setInterval(() => {
      this.analyzeTraffic();
    }, 1000);
  }

  private startBaselineCalculation(): void {
    // Recalculate baseline every 5 minutes
    this.baselineInterval = setInterval(() => {
      this.updateBaseline();
    }, 5 * 60 * 1000);
  }

  private createEmptySnapshot(): TrafficSnapshot {
    return {
      timestamp: new Date(),
      requestsPerSecond: 0,
      uniqueIPs: 0,
      avgResponseTime: 0,
      bySource: {},
      byEndpoint: {},
      byCountry: {},
      byMethod: {},
    };
  }

  // Record incoming request
  recordRequest(data: {
    ip: string;
    endpoint: string;
    method: string;
    source?: string;
    referer?: string;
    userAgent?: string;
    responseTime?: number;
    country?: string;
    city?: string;
    lat?: number;
    lon?: number;
  }): { allowed: boolean; reason?: string } {
    if (!this.config.enabled) {
      return { allowed: true };
    }

    const { ip, endpoint, method, source, referer, country, city, lat, lon } = data;

    // Update current snapshot
    this.currentSnapshot.requestsPerSecond++;
    this.currentSnapshot.byEndpoint[endpoint] = (this.currentSnapshot.byEndpoint[endpoint] || 0) + 1;
    this.currentSnapshot.byMethod[method] = (this.currentSnapshot.byMethod[method] || 0) + 1;
    
    if (country) {
      this.currentSnapshot.byCountry[country] = (this.currentSnapshot.byCountry[country] || 0) + 1;
    }

    // Track source
    const sourceKey = this.extractSource(referer, source);
    this.currentSnapshot.bySource[sourceKey] = (this.currentSnapshot.bySource[sourceKey] || 0) + 1;

    // Update geo location
    if (lat && lon) {
      this.updateGeoLocation(ip, country || 'Unknown', city || 'Unknown', lat, lon);
    }

    // Check if request should be allowed
    const decision = this.shouldAllowRequest(ip, sourceKey, country);
    
    if (decision.allowed) {
      this.allowedRequests++;
      this.threatLevel.allowedRequests++;
    } else {
      this.blockedRequests++;
      this.threatLevel.blockedRequests++;
    }

    // Track IP request count
    this.trackIPRequest(ip, !decision.allowed);

    return decision;
  }

  private extractSource(referer?: string, source?: string): string {
    if (source) return source;
    if (!referer) return 'direct';
    
    try {
      const url = new URL(referer);
      return url.hostname;
    } catch {
      return 'unknown';
    }
  }

  private trackIPRequest(ip: string, blocked: boolean): void {
    const now = new Date();
    const existing = this.ipRequestCounts.get(ip);
    
    if (existing) {
      // Check if window has expired
      const windowStart = new Date(now.getTime() - this.config.windowSeconds * 1000);
      if (existing.firstSeen < windowStart) {
        // Reset window
        this.ipRequestCounts.set(ip, { count: 1, firstSeen: now, blocked });
      } else {
        existing.count++;
        existing.blocked = blocked;
      }
    } else {
      this.ipRequestCounts.set(ip, { count: 1, firstSeen: now, blocked });
    }

    // Update unique IPs count
    this.currentSnapshot.uniqueIPs = this.ipRequestCounts.size;
  }

  private updateGeoLocation(ip: string, country: string, city: string, lat: number, lon: number): void {
    const existing = this.geoLocations.get(ip);
    const isTrusted = this.isTrustedIP(ip);
    
    if (existing) {
      existing.requestCount++;
      existing.lastSeen = new Date();
    } else {
      this.geoLocations.set(ip, {
        ip,
        country,
        countryCode: country.substring(0, 2).toUpperCase(),
        city,
        lat,
        lon,
        isTrusted,
        requestCount: 1,
        lastSeen: new Date(),
      });
    }
  }

  // ============================================
  // Traffic Analysis & Threat Detection
  // ============================================

  private analyzeTraffic(): void {
    const rps = this.currentSnapshot.requestsPerSecond;
    const baselineRps = this.baseline.avgRequestsPerSecond;
    
    // Calculate percentage above baseline
    const percentageAbove = baselineRps > 0 
      ? ((rps - baselineRps) / baselineRps) * 100 
      : 0;

    this.threatLevel.percentage = Math.max(0, percentageAbove);

    // Determine threat level
    const previousLevel = this.threatLevel.level;
    
    if (percentageAbove >= this.config.mitigationThreshold) {
      this.threatLevel.level = 'CRITICAL';
      if (!this.threatLevel.mitigationActive && this.config.autoMitigate) {
        this.activateMitigation();
      }
    } else if (percentageAbove >= this.config.alertThreshold) {
      this.threatLevel.level = 'ATTACK';
      if (!this.threatLevel.triggeredAt) {
        this.threatLevel.triggeredAt = new Date();
        this.emit('attack-detected', { percentage: percentageAbove, rps });
        this.sendAttackAlert(percentageAbove, rps);
      }
    } else if (percentageAbove >= 10) {
      this.threatLevel.level = 'ELEVATED';
    } else {
      this.threatLevel.level = 'NORMAL';
      if (this.threatLevel.mitigationActive) {
        this.deactivateMitigation();
      }
      this.threatLevel.triggeredAt = null;
    }

    if (previousLevel !== this.threatLevel.level) {
      this.emit('threat-level-changed', this.threatLevel);
      logger.info(`🛡️ Intelliceil threat level: ${previousLevel} → ${this.threatLevel.level}`);
    }

    // Save snapshot to history
    this.trafficHistory.push({ ...this.currentSnapshot });
    
    // Keep only last hour of history
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.trafficHistory = this.trafficHistory.filter(s => s.timestamp > oneHourAgo);

    // Reset current snapshot for next second
    this.currentSnapshot = this.createEmptySnapshot();

    // Emit real-time data
    this.emit('traffic-update', this.getStatus());
  }

  private activateMitigation(): void {
    this.threatLevel.mitigationActive = true;
    logger.warn('🛡️ Intelliceil MITIGATION ACTIVATED - Blocking abnormal traffic');
    this.emit('mitigation-activated');
  }

  private deactivateMitigation(): void {
    this.threatLevel.mitigationActive = false;
    logger.info('🛡️ Intelliceil mitigation deactivated - Traffic normalized');
    this.emit('mitigation-deactivated');
  }

  private async sendAttackAlert(percentage: number, rps: number): Promise<void> {
    if (!this.config.notifyOnAttack) return;
    
    logger.warn(`🚨 ATTACK DETECTED: ${percentage.toFixed(1)}% above baseline (${rps} req/s)`);
    
    // TODO: Send email notification via email service
    this.emit('attack-alert', {
      percentage,
      rps,
      timestamp: new Date(),
      threatLevel: this.threatLevel.level,
    });
  }

  // ============================================
  // Request Filtering (Smart Mitigation)
  // ============================================

  private shouldAllowRequest(ip: string, source: string, country?: string): { allowed: boolean; reason?: string } {
    // Always check blocked IPs first
    if (this.config.blockedIPs.includes(ip)) {
      return { allowed: false, reason: 'IP is blocked' };
    }

    // Check blocked countries
    if (country && this.config.blockedCountries.includes(country)) {
      return { allowed: false, reason: 'Country is blocked' };
    }

    // If mitigation is not active, allow all (except blocked)
    if (!this.threatLevel.mitigationActive) {
      return { allowed: true };
    }

    // === MITIGATION MODE ===
    // During mitigation, only allow trusted sources

    // Check if IP is trusted
    if (this.isTrustedIP(ip)) {
      return { allowed: true };
    }

    // Check if source domain is trusted
    if (this.isTrustedSource(source)) {
      return { allowed: true };
    }

    // Check if source is a registered DMS domain
    if (this.registeredDMSDomains.has(source)) {
      return { allowed: true };
    }

    // Check IP request rate
    const ipData = this.ipRequestCounts.get(ip);
    if (ipData && ipData.count > this.config.maxRequestsPerIP) {
      return { allowed: false, reason: 'Rate limit exceeded during mitigation' };
    }

    // Check if request pattern is normal
    const isNormalPattern = this.isNormalRequestPattern(ip, source);
    if (!isNormalPattern) {
      return { allowed: false, reason: 'Abnormal traffic pattern during mitigation' };
    }

    return { allowed: true };
  }

  private isTrustedIP(ip: string): boolean {
    // Check explicit trusted IPs
    if (this.config.trustedIPs.includes(ip)) {
      return true;
    }

    // Check trusted IP ranges
    for (const range of TRUSTED_IP_RANGES) {
      if (this.ipInRange(ip, range)) {
        return true;
      }
    }

    return false;
  }

  private isTrustedSource(source: string): boolean {
    // Direct match
    if (this.config.trustedDomains.includes(source)) {
      return true;
    }

    // Check if it's a subdomain of a trusted domain
    for (const trusted of this.config.trustedDomains) {
      if (source.endsWith('.' + trusted) || source === trusted) {
        return true;
      }
    }

    return false;
  }

  private ipInRange(ip: string, cidr: string): boolean {
    const [range, bits] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits)) - 1);
    
    const ipNum = this.ipToNumber(ip);
    const rangeNum = this.ipToNumber(range);
    
    return (ipNum & mask) === (rangeNum & mask);
  }

  private ipToNumber(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  }

  private isNormalRequestPattern(ip: string, source: string): boolean {
    // Check if the source was seen in normal traffic
    const normalSources = this.baseline.normalSourceDistribution;
    const sourceCount = normalSources[source] || 0;
    
    // If source has been seen before in normal traffic, allow it
    if (sourceCount > 0) {
      return true;
    }

    // Check request rate for this IP
    const ipData = this.ipRequestCounts.get(ip);
    if (ipData) {
      const elapsedSeconds = (Date.now() - ipData.firstSeen.getTime()) / 1000;
      const requestsPerSecond = ipData.count / Math.max(1, elapsedSeconds);
      
      // If IP is making more than 5 requests per second, it's suspicious
      if (requestsPerSecond > 5) {
        return false;
      }
    }

    return true;
  }

  // ============================================
  // Baseline Calculation
  // ============================================

  private updateBaseline(): void {
    if (this.trafficHistory.length < 60) {
      // Need at least 1 minute of data
      return;
    }

    // Only use data from normal periods
    const normalSnapshots = this.trafficHistory.filter(s => {
      const rps = s.requestsPerSecond;
      const threshold = this.baseline.avgRequestsPerSecond * (1 + this.config.alertThreshold / 100);
      return rps <= threshold;
    });

    if (normalSnapshots.length < 30) {
      return; // Not enough normal data
    }

    // Calculate new baseline
    const totalRps = normalSnapshots.reduce((sum, s) => sum + s.requestsPerSecond, 0);
    const avgRps = totalRps / normalSnapshots.length;

    const peakRps = Math.max(...normalSnapshots.map(s => s.requestsPerSecond));

    // Aggregate source distribution
    const sourceDistribution: Record<string, number> = {};
    normalSnapshots.forEach(s => {
      Object.entries(s.bySource).forEach(([source, count]) => {
        sourceDistribution[source] = (sourceDistribution[source] || 0) + count;
      });
    });

    // Aggregate endpoint distribution
    const endpointDistribution: Record<string, number> = {};
    normalSnapshots.forEach(s => {
      Object.entries(s.byEndpoint).forEach(([endpoint, count]) => {
        endpointDistribution[endpoint] = (endpointDistribution[endpoint] || 0) + count;
      });
    });

    // Smooth baseline update (weighted average)
    const weight = 0.3; // New data weight
    this.baseline = {
      avgRequestsPerSecond: this.baseline.avgRequestsPerSecond * (1 - weight) + avgRps * weight,
      avgUniqueIPsPerMinute: this.baseline.avgUniqueIPsPerMinute,
      avgResponseTime: this.baseline.avgResponseTime,
      peakRequestsPerSecond: Math.max(this.baseline.peakRequestsPerSecond, peakRps),
      normalSourceDistribution: sourceDistribution,
      normalEndpointDistribution: endpointDistribution,
      lastUpdated: new Date(),
      sampleCount: this.baseline.sampleCount + normalSnapshots.length,
    };

    logger.debug(`Intelliceil baseline updated: ${this.baseline.avgRequestsPerSecond.toFixed(2)} req/s`);
    this.emit('baseline-updated', this.baseline);
  }

  // ============================================
  // Configuration Management
  // ============================================

  async updateConfig(newConfig: Partial<IntelliceilConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    // Save to database
    try {
      await prisma.systemSettings.upsert({
        where: { key: 'intelliceil' },
        create: {
          key: 'intelliceil',
          value: this.config as any,
        },
        update: {
          value: this.config as any,
        },
      });
    } catch (error) {
      logger.error('Failed to save Intelliceil config:', error);
    }

    this.emit('config-updated', this.config);
  }

  getConfig(): IntelliceilConfig {
    return { ...this.config };
  }

  // ============================================
  // Status & Reporting
  // ============================================

  getStatus(): {
    config: IntelliceilConfig;
    baseline: TrafficBaseline;
    threatLevel: ThreatLevel;
    currentRps: number;
    blockedRequests: number;
    allowedRequests: number;
    uniqueIPs: number;
    geoLocations: GeoLocation[];
    trafficHistory: { timestamp: Date; rps: number }[];
    topSources: { source: string; count: number }[];
    topEndpoints: { endpoint: string; count: number }[];
    topCountries: { country: string; count: number }[];
  } {
    // Get current RPS from last snapshot in history
    const lastSnapshot = this.trafficHistory[this.trafficHistory.length - 1];
    const currentRps = lastSnapshot?.requestsPerSecond || 0;

    // Aggregate traffic history for chart
    const trafficHistory = this.trafficHistory.slice(-60).map(s => ({
      timestamp: s.timestamp,
      rps: s.requestsPerSecond,
    }));

    // Get top sources
    const sourceAggregation: Record<string, number> = {};
    this.trafficHistory.slice(-60).forEach(s => {
      Object.entries(s.bySource).forEach(([source, count]) => {
        sourceAggregation[source] = (sourceAggregation[source] || 0) + count;
      });
    });
    const topSources = Object.entries(sourceAggregation)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get top endpoints
    const endpointAggregation: Record<string, number> = {};
    this.trafficHistory.slice(-60).forEach(s => {
      Object.entries(s.byEndpoint).forEach(([endpoint, count]) => {
        endpointAggregation[endpoint] = (endpointAggregation[endpoint] || 0) + count;
      });
    });
    const topEndpoints = Object.entries(endpointAggregation)
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get top countries
    const countryAggregation: Record<string, number> = {};
    this.trafficHistory.slice(-60).forEach(s => {
      Object.entries(s.byCountry).forEach(([country, count]) => {
        countryAggregation[country] = (countryAggregation[country] || 0) + count;
      });
    });
    const topCountries = Object.entries(countryAggregation)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      config: this.getConfig(),
      baseline: { ...this.baseline },
      threatLevel: { ...this.threatLevel },
      currentRps,
      blockedRequests: this.blockedRequests,
      allowedRequests: this.allowedRequests,
      uniqueIPs: this.ipRequestCounts.size,
      geoLocations: Array.from(this.geoLocations.values()),
      trafficHistory,
      topSources,
      topEndpoints,
      topCountries,
    };
  }

  // Manual controls
  manualBlock(ip: string): void {
    if (!this.config.blockedIPs.includes(ip)) {
      this.config.blockedIPs.push(ip);
      this.updateConfig({ blockedIPs: this.config.blockedIPs });
    }
  }

  manualUnblock(ip: string): void {
    this.config.blockedIPs = this.config.blockedIPs.filter(i => i !== ip);
    this.updateConfig({ blockedIPs: this.config.blockedIPs });
  }

  manualActivateMitigation(): void {
    this.activateMitigation();
  }

  manualDeactivateMitigation(): void {
    this.deactivateMitigation();
  }

  addTrustedDomain(domain: string): void {
    if (!this.config.trustedDomains.includes(domain)) {
      this.config.trustedDomains.push(domain);
      this.updateConfig({ trustedDomains: this.config.trustedDomains });
    }
  }

  removeTrustedDomain(domain: string): void {
    this.config.trustedDomains = this.config.trustedDomains.filter(d => d !== domain);
    this.updateConfig({ trustedDomains: this.config.trustedDomains });
  }

  // Cleanup
  shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.baselineInterval) {
      clearInterval(this.baselineInterval);
    }
    logger.info('🛡️ Intelliceil shutdown complete');
  }
}

// Export singleton instance
export const intelliceilService = new IntelliceilService();
export default intelliceilService;
