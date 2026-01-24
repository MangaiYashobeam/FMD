/**
 * IP Intelligence Service
 * 
 * Comprehensive IP analysis, bot detection, and threat assessment
 * Integrates with IntelliCeil for unified security analytics
 */

import { logger } from '@/utils/logger';
import prisma from '@/config/database';
import crypto from 'crypto';
import { UAParser } from 'ua-parser-js';

// ============================================
// Types & Interfaces
// ============================================

export interface IPAnalysisResult {
  ipAddress: string;
  
  // Geolocation
  geo: {
    country: string | null;
    countryCode: string | null;
    region: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    timezone: string | null;
    isp: string | null;
    org: string | null;
    asn: string | null;
  };
  
  // Threat Assessment
  threat: {
    score: number; // 0-100
    level: 'NORMAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    isProxy: boolean;
    isVpn: boolean;
    isTor: boolean;
    isDatacenter: boolean;
    isKnownAbuser: boolean;
    reasons: string[];
  };
  
  // Bot Detection
  bot: {
    isBot: boolean;
    confidence: number; // 0-100
    name: string | null;
    type: string | null; // search_engine, scraper, monitoring, malicious
    identifiers: string[];
    isGoodBot: boolean;
  };
  
  // Statistics
  stats: {
    totalRequests: number;
    requestsToday: number;
    firstSeenAt: Date;
    lastRequestAt: Date;
    isBlocked: boolean;
  };
}

export interface DeviceInfo {
  deviceType: string | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  isBot: boolean;
  botName: string | null;
}

export interface VisitorClassification {
  type: 'first_time' | 'returning' | 'frequent' | 'loyal';
  heatScore: number;
  potentialUser: boolean;
  potentialScore: number;
  visitCount: number;
}

// Known good bots (search engines, monitoring)
const KNOWN_GOOD_BOTS: { name: string; pattern: RegExp; type: string }[] = [
  { name: 'Googlebot', pattern: /googlebot/i, type: 'search_engine' },
  { name: 'Googlebot-Image', pattern: /googlebot-image/i, type: 'search_engine' },
  { name: 'Bingbot', pattern: /bingbot/i, type: 'search_engine' },
  { name: 'Yahoo! Slurp', pattern: /slurp/i, type: 'search_engine' },
  { name: 'DuckDuckBot', pattern: /duckduckbot/i, type: 'search_engine' },
  { name: 'Baiduspider', pattern: /baiduspider/i, type: 'search_engine' },
  { name: 'YandexBot', pattern: /yandexbot/i, type: 'search_engine' },
  { name: 'facebookexternalhit', pattern: /facebookexternalhit/i, type: 'social' },
  { name: 'Twitterbot', pattern: /twitterbot/i, type: 'social' },
  { name: 'LinkedInBot', pattern: /linkedinbot/i, type: 'social' },
  { name: 'Uptimebot', pattern: /uptimebot|uptimerobot/i, type: 'monitoring' },
  { name: 'Pingdom', pattern: /pingdom/i, type: 'monitoring' },
  { name: 'GTmetrix', pattern: /gtmetrix/i, type: 'monitoring' },
];

// Known bad bots / scrapers
const KNOWN_BAD_BOTS: { name: string; pattern: RegExp; type: string }[] = [
  { name: 'SemrushBot', pattern: /semrushbot/i, type: 'scraper' },
  { name: 'AhrefsBot', pattern: /ahrefsbot/i, type: 'scraper' },
  { name: 'MJ12bot', pattern: /mj12bot/i, type: 'scraper' },
  { name: 'DotBot', pattern: /dotbot/i, type: 'scraper' },
  { name: 'Screaming Frog', pattern: /screaming frog/i, type: 'scraper' },
  { name: 'Scrapy', pattern: /scrapy/i, type: 'scraper' },
  { name: 'Python-urllib', pattern: /python-urllib/i, type: 'scraper' },
  { name: 'Go-http-client', pattern: /go-http-client/i, type: 'scraper' },
  { name: 'Curl', pattern: /^curl\//i, type: 'tool' },
  { name: 'Wget', pattern: /wget/i, type: 'tool' },
];

// ============================================
// IP Intelligence Service Class
// ============================================

class IPIntelligenceService {
  private geoCache: Map<string, { data: any; expires: number }> = new Map();
  private readonly CACHE_TTL = 3600000; // 1 hour
  
  /**
   * Analyze an IP address comprehensively
   */
  async analyzeIP(ipAddress: string, userAgent?: string): Promise<IPAnalysisResult> {
    try {
      // Check cache first
      const cached = await this.getCachedIPData(ipAddress);
      
      if (cached && this.isCacheValid(cached.lastUpdated)) {
        // Update request count
        await this.incrementRequestCount(ipAddress);
        return this.formatCachedResult(cached, userAgent);
      }
      
      // Fetch fresh data
      const [geoData, botResult] = await Promise.all([
        this.fetchGeoLocation(ipAddress),
        this.detectBot(userAgent || '', ipAddress),
      ]);
      
      // Calculate threat score
      const threatAssessment = await this.assessThreat(ipAddress, geoData, botResult);
      
      // Store in database
      const stored = await this.storeIPIntelligence(ipAddress, geoData, threatAssessment, botResult);
      
      return {
        ipAddress,
        geo: {
          country: geoData?.country || null,
          countryCode: geoData?.countryCode || null,
          region: geoData?.region || null,
          city: geoData?.city || null,
          latitude: geoData?.lat || null,
          longitude: geoData?.lon || null,
          timezone: geoData?.timezone || null,
          isp: geoData?.isp || null,
          org: geoData?.org || null,
          asn: geoData?.as || null,
        },
        threat: threatAssessment,
        bot: botResult,
        stats: {
          totalRequests: stored.totalRequests,
          requestsToday: stored.requestsToday,
          firstSeenAt: stored.firstSeenAt,
          lastRequestAt: stored.lastRequestAt,
          isBlocked: stored.isBlocked,
        },
      };
    } catch (error) {
      logger.error('IP analysis failed:', { ipAddress, error });
      return this.getDefaultResult(ipAddress);
    }
  }
  
  /**
   * Detect if user agent is a bot
   */
  detectBot(userAgent: string, _ipAddress?: string): {
    isBot: boolean;
    confidence: number;
    name: string | null;
    type: string | null;
    identifiers: string[];
    isGoodBot: boolean;
  } {
    const indicators: string[] = [];
    let confidence = 0;
    let detectedBot: { name: string; type: string; isGood: boolean } | null = null;
    
    if (!userAgent) {
      return {
        isBot: true,
        confidence: 90,
        name: 'Empty User Agent',
        type: 'unknown',
        identifiers: ['empty_user_agent'],
        isGoodBot: false,
      };
    }
    
    const _uaLower = userAgent.toLowerCase();
    
    // Check known good bots
    for (const bot of KNOWN_GOOD_BOTS) {
      if (bot.pattern.test(userAgent)) {
        detectedBot = { name: bot.name, type: bot.type, isGood: true };
        indicators.push(`known_good_bot:${bot.name}`);
        confidence = 95;
        break;
      }
    }
    
    // Check known bad bots
    if (!detectedBot) {
      for (const bot of KNOWN_BAD_BOTS) {
        if (bot.pattern.test(userAgent)) {
          detectedBot = { name: bot.name, type: bot.type, isGood: false };
          indicators.push(`known_bad_bot:${bot.name}`);
          confidence = 95;
          break;
        }
      }
    }
    
    // Check for common bot patterns
    if (!detectedBot) {
      // Generic bot patterns
      if (/bot|crawl|spider|slurp|fetch|scrape/i.test(userAgent)) {
        indicators.push('bot_keyword');
        confidence += 30;
      }
      
      // Automation tools
      if (/headless|phantom|selenium|puppeteer|playwright/i.test(userAgent)) {
        indicators.push('automation_tool');
        confidence += 40;
        detectedBot = { name: 'Automation Tool', type: 'automation', isGood: false };
      }
      
      // Suspicious patterns
      if (/http:\/\/|www\./i.test(userAgent)) {
        indicators.push('url_in_ua');
        confidence += 20;
      }
      
      // Very short user agent
      if (userAgent.length < 20) {
        indicators.push('short_ua');
        confidence += 15;
      }
      
      // No browser info
      const parser = new UAParser(userAgent);
      const browser = parser.getBrowser();
      if (!browser.name) {
        indicators.push('no_browser_detected');
        confidence += 20;
      }
      
      // Unusual characters
      if (/[\x00-\x1f]/.test(userAgent)) {
        indicators.push('control_chars');
        confidence += 25;
      }
    }
    
    const isBot = confidence >= 50 || detectedBot !== null;
    
    return {
      isBot,
      confidence: Math.min(confidence, 100),
      name: detectedBot?.name || (isBot ? 'Unknown Bot' : null),
      type: detectedBot?.type || (isBot ? 'unknown' : null),
      identifiers: indicators,
      isGoodBot: detectedBot?.isGood || false,
    };
  }
  
  /**
   * Parse device info from user agent
   */
  parseDeviceInfo(userAgent: string): DeviceInfo {
    const parser = new UAParser(userAgent);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();
    
    const botResult = this.detectBot(userAgent, '');
    
    let deviceType = 'desktop';
    if (device.type === 'mobile') deviceType = 'mobile';
    else if (device.type === 'tablet') deviceType = 'tablet';
    
    return {
      deviceType,
      browser: browser.name || null,
      browserVersion: browser.version || null,
      os: os.name || null,
      osVersion: os.version || null,
      isBot: botResult.isBot,
      botName: botResult.name,
    };
  }
  
  /**
   * Generate browser fingerprint
   */
  generateFingerprint(ipAddress: string, userAgent: string, acceptLanguage?: string): string {
    const data = `${ipAddress}|${userAgent}|${acceptLanguage || ''}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
  }
  
  /**
   * Classify a visitor based on their history
   */
  async classifyVisitor(fingerprint: string): Promise<VisitorClassification> {
    try {
      const visitor = await prisma.visitor.findUnique({
        where: { fingerprint },
      });
      
      if (!visitor) {
        return {
          type: 'first_time',
          heatScore: 0,
          potentialUser: false,
          potentialScore: 0,
          visitCount: 1,
        };
      }
      
      // Calculate heat score based on visit frequency
      const daysSinceFirst = Math.max(1, Math.floor(
        (Date.now() - visitor.firstVisitAt.getTime()) / (1000 * 60 * 60 * 24)
      ));
      const visitsPerDay = visitor.visitCount / daysSinceFirst;
      const heatScore = Math.min(100, Math.floor(visitsPerDay * 20 + Math.log2(visitor.visitCount + 1) * 10));
      
      // Determine visitor type
      let visitorType: 'first_time' | 'returning' | 'frequent' | 'loyal' = 'returning';
      if (visitor.visitCount === 1) visitorType = 'first_time';
      else if (visitor.visitCount >= 10) visitorType = 'loyal';
      else if (visitor.visitCount >= 5) visitorType = 'frequent';
      
      // Calculate potential user score
      const potentialScore = this.calculatePotentialUserScore(visitor);
      
      return {
        type: visitorType,
        heatScore,
        potentialUser: potentialScore >= 50,
        potentialScore,
        visitCount: visitor.visitCount,
      };
    } catch (error) {
      logger.error('Failed to classify visitor:', error);
      return {
        type: 'first_time',
        heatScore: 0,
        potentialUser: false,
        potentialScore: 0,
        visitCount: 1,
      };
    }
  }
  
  /**
   * Calculate potential user score
   */
  private calculatePotentialUserScore(visitor: any): number {
    let score = 0;
    
    // Visit count factor (max 30 points)
    score += Math.min(30, visitor.visitCount * 3);
    
    // Recency factor (max 20 points)
    const daysSinceLastVisit = Math.floor(
      (Date.now() - visitor.lastVisitAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceLastVisit === 0) score += 20;
    else if (daysSinceLastVisit <= 1) score += 15;
    else if (daysSinceLastVisit <= 7) score += 10;
    else if (daysSinceLastVisit <= 30) score += 5;
    
    // Not a bot (20 points)
    if (!visitor.isBotConfirmed) score += 20;
    
    // Engagement factor (max 30 points) - would need page view data
    // For now, estimate based on visit frequency
    const daysSinceFirst = Math.max(1, Math.floor(
      (Date.now() - visitor.firstVisitAt.getTime()) / (1000 * 60 * 60 * 24)
    ));
    const frequency = visitor.visitCount / daysSinceFirst;
    if (frequency >= 1) score += 30;
    else if (frequency >= 0.5) score += 20;
    else if (frequency >= 0.2) score += 10;
    
    return Math.min(100, score);
  }
  
  /**
   * Track or update visitor
   */
  async trackVisitor(
    fingerprint: string,
    ipAddress: string,
    userAgent: string,
    country?: string,
    city?: string
  ): Promise<{ visitor: any; isNew: boolean }> {
    try {
      const botResult = this.detectBot(userAgent, ipAddress);
      
      const existing = await prisma.visitor.findUnique({
        where: { fingerprint },
      });
      
      if (existing) {
        // Update existing visitor
        const updated = await prisma.visitor.update({
          where: { fingerprint },
          data: {
            visitCount: { increment: 1 },
            lastVisitAt: new Date(),
            lastIpAddress: ipAddress,
            lastUserAgent: userAgent,
            lastCountry: country,
            lastCity: city,
            botScore: botResult.confidence,
            isBotConfirmed: botResult.isBot && botResult.confidence >= 90,
            botName: botResult.name,
            botIndicators: botResult.identifiers,
          },
        });
        
        // Update heat score
        const classification = await this.classifyVisitor(fingerprint);
        await prisma.visitor.update({
          where: { fingerprint },
          data: {
            heatScore: classification.heatScore,
            visitorType: classification.type,
            potentialUser: classification.potentialUser,
            potentialScore: classification.potentialScore,
          },
        });
        
        return { visitor: updated, isNew: false };
      }
      
      // Create new visitor
      const visitor = await prisma.visitor.create({
        data: {
          fingerprint,
          visitCount: 1,
          heatScore: 0,
          visitorType: 'first_time',
          lastIpAddress: ipAddress,
          lastUserAgent: userAgent,
          lastCountry: country,
          lastCity: city,
          botScore: botResult.confidence,
          isBotConfirmed: botResult.isBot && botResult.confidence >= 90,
          botName: botResult.name,
          botIndicators: botResult.identifiers,
        },
      });
      
      return { visitor, isNew: true };
    } catch (error) {
      logger.error('Failed to track visitor:', error);
      throw error;
    }
  }
  
  /**
   * Get IP intelligence summary for dashboard
   */
  async getIPSummary(limit = 100): Promise<{
    totalIPs: number;
    blockedIPs: number;
    bots: { confirmed: number; suspected: number };
    threatLevels: Record<string, number>;
    topCountries: { country: string; count: number }[];
    recentActivity: any[];
  }> {
    try {
      const [
        totalIPs,
        blockedIPs,
        confirmedBots,
        threatCounts,
        countryCounts,
        recentIPs,
      ] = await Promise.all([
        prisma.iPIntelligence.count(),
        prisma.iPIntelligence.count({ where: { isBlocked: true } }),
        prisma.iPIntelligence.count({ where: { isBotConfirmed: true } }),
        prisma.iPIntelligence.groupBy({
          by: ['threatLevel'],
          _count: true,
        }),
        prisma.iPIntelligence.groupBy({
          by: ['country'],
          _count: true,
          orderBy: { _count: { country: 'desc' } },
          take: 10,
        }),
        prisma.iPIntelligence.findMany({
          orderBy: { lastRequestAt: 'desc' },
          take: limit,
          select: {
            ipAddress: true,
            country: true,
            city: true,
            threatScore: true,
            threatLevel: true,
            isBotConfirmed: true,
            botName: true,
            isBlocked: true,
            totalRequests: true,
            lastRequestAt: true,
          },
        }),
      ]);
      
      const suspectedBots = await prisma.iPIntelligence.count({
        where: { botScore: { gte: 50 }, isBotConfirmed: false },
      });
      
      return {
        totalIPs,
        blockedIPs,
        bots: { confirmed: confirmedBots, suspected: suspectedBots },
        threatLevels: threatCounts.reduce((acc, t) => {
          acc[t.threatLevel] = t._count;
          return acc;
        }, {} as Record<string, number>),
        topCountries: countryCounts
          .filter(c => c.country)
          .map(c => ({ country: c.country!, count: c._count })),
        recentActivity: recentIPs,
      };
    } catch (error) {
      logger.error('Failed to get IP summary:', error);
      return {
        totalIPs: 0,
        blockedIPs: 0,
        bots: { confirmed: 0, suspected: 0 },
        threatLevels: {},
        topCountries: [],
        recentActivity: [],
      };
    }
  }
  
  /**
   * Get visitor analytics for dashboard
   */
  async getVisitorAnalytics(): Promise<{
    totalVisitors: number;
    byType: Record<string, number>;
    potentialUsers: number;
    confirmedBots: number;
    heatDistribution: { range: string; count: number }[];
    recentVisitors: any[];
    conversionRate: number;
  }> {
    try {
      const [
        totalVisitors,
        typeCounts,
        potentialUsers,
        confirmedBots,
        converted,
        recentVisitors,
      ] = await Promise.all([
        prisma.visitor.count(),
        prisma.visitor.groupBy({
          by: ['visitorType'],
          _count: true,
        }),
        prisma.visitor.count({ where: { potentialUser: true } }),
        prisma.visitor.count({ where: { isBotConfirmed: true } }),
        prisma.visitor.count({ where: { convertedUserId: { not: null } } }),
        prisma.visitor.findMany({
          orderBy: { lastVisitAt: 'desc' },
          take: 50,
          select: {
            id: true,
            fingerprint: true,
            visitCount: true,
            heatScore: true,
            visitorType: true,
            potentialUser: true,
            potentialScore: true,
            lastIpAddress: true,
            lastCountry: true,
            lastCity: true,
            isBotConfirmed: true,
            botName: true,
            firstVisitAt: true,
            lastVisitAt: true,
          },
        }),
      ]);
      
      // Heat score distribution
      const heatRanges = await Promise.all([
        prisma.visitor.count({ where: { heatScore: { gte: 0, lt: 20 } } }),
        prisma.visitor.count({ where: { heatScore: { gte: 20, lt: 40 } } }),
        prisma.visitor.count({ where: { heatScore: { gte: 40, lt: 60 } } }),
        prisma.visitor.count({ where: { heatScore: { gte: 60, lt: 80 } } }),
        prisma.visitor.count({ where: { heatScore: { gte: 80 } } }),
      ]);
      
      return {
        totalVisitors,
        byType: typeCounts.reduce((acc, t) => {
          acc[t.visitorType] = t._count;
          return acc;
        }, {} as Record<string, number>),
        potentialUsers,
        confirmedBots,
        heatDistribution: [
          { range: '0-19 (Cold)', count: heatRanges[0] },
          { range: '20-39 (Cool)', count: heatRanges[1] },
          { range: '40-59 (Warm)', count: heatRanges[2] },
          { range: '60-79 (Hot)', count: heatRanges[3] },
          { range: '80-100 (Blazing)', count: heatRanges[4] },
        ],
        recentVisitors,
        conversionRate: totalVisitors > 0 ? (converted / totalVisitors) * 100 : 0,
      };
    } catch (error) {
      logger.error('Failed to get visitor analytics:', error);
      return {
        totalVisitors: 0,
        byType: {},
        potentialUsers: 0,
        confirmedBots: 0,
        heatDistribution: [],
        recentVisitors: [],
        conversionRate: 0,
      };
    }
  }
  
  // ============================================
  // Private Helper Methods
  // ============================================
  
  private async fetchGeoLocation(ipAddress: string): Promise<any> {
    try {
      // Check memory cache
      const cached = this.geoCache.get(ipAddress);
      if (cached && cached.expires > Date.now()) {
        return cached.data;
      }
      
      // Skip localhost/private IPs
      if (this.isPrivateIP(ipAddress)) {
        return { country: 'Local', countryCode: 'LO', city: 'Localhost' };
      }
      
      // Use ip-api.com (free, no API key needed, 45 req/min limit)
      const response = await fetch(
        `http://ip-api.com/json/${ipAddress}?fields=status,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`,
        { signal: AbortSignal.timeout(5000) }
      );
      
      if (!response.ok) return null;
      
      const data = await response.json() as { status: string; country?: string; countryCode?: string; region?: string; regionName?: string; city?: string; zip?: string; lat?: number; lon?: number; timezone?: string; isp?: string; org?: string; as?: string; query?: string };
      
      if (data.status === 'success') {
        // Cache the result
        this.geoCache.set(ipAddress, {
          data,
          expires: Date.now() + this.CACHE_TTL,
        });
        return data;
      }
      
      return null;
    } catch (error) {
      logger.debug('Geo lookup failed:', { ipAddress, error: (error as Error).message });
      return null;
    }
  }
  
  private async assessThreat(
    ipAddress: string,
    geoData: any,
    botResult: any
  ): Promise<{
    score: number;
    level: 'NORMAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    isProxy: boolean;
    isVpn: boolean;
    isTor: boolean;
    isDatacenter: boolean;
    isKnownAbuser: boolean;
    reasons: string[];
  }> {
    let score = 0;
    const reasons: string[] = [];
    
    // Bot factor
    if (botResult.isBot) {
      if (!botResult.isGoodBot) {
        score += 30;
        reasons.push(`Detected as bot: ${botResult.name || 'Unknown'}`);
      }
    }
    
    // Check if IP is in known blocklist
    const isBlocked = await prisma.iPIntelligence.findFirst({
      where: { ipAddress, isBlocked: true },
    });
    
    if (isBlocked) {
      score += 50;
      reasons.push('Previously blocked IP');
    }
    
    // Check request rate (potential DDoS)
    const recentRequests = await prisma.iPIntelligence.findFirst({
      where: { ipAddress },
      select: { requestsToday: true },
    });
    
    if (recentRequests && recentRequests.requestsToday > 1000) {
      score += 20;
      reasons.push('High request volume');
    }
    
    // Datacenter/proxy detection (simplified - would use external service in production)
    const isDatacenter = this.isDatacenterIP(geoData?.isp || '', geoData?.org || '');
    if (isDatacenter) {
      score += 15;
      reasons.push('Datacenter IP detected');
    }
    
    // Determine threat level
    let level: 'NORMAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'NORMAL';
    if (score >= 80) level = 'CRITICAL';
    else if (score >= 60) level = 'HIGH';
    else if (score >= 40) level = 'MEDIUM';
    else if (score >= 20) level = 'LOW';
    
    return {
      score,
      level,
      isProxy: false, // Would need external API
      isVpn: false, // Would need external API
      isTor: this.isTorExitNode(ipAddress),
      isDatacenter,
      isKnownAbuser: isBlocked !== null,
      reasons,
    };
  }
  
  private async storeIPIntelligence(
    ipAddress: string,
    geoData: any,
    threat: any,
    bot: any
  ) {
    const existing = await prisma.iPIntelligence.findUnique({
      where: { ipAddress },
    });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (existing) {
      // Check if it's a new day for request counting
      const lastReqDate = new Date(existing.lastRequestAt);
      lastReqDate.setHours(0, 0, 0, 0);
      const isSameDay = lastReqDate.getTime() === today.getTime();
      
      return prisma.iPIntelligence.update({
        where: { ipAddress },
        data: {
          totalRequests: { increment: 1 },
          requestsToday: isSameDay ? { increment: 1 } : 1,
          lastRequestAt: new Date(),
          lastUpdated: new Date(),
          threatScore: threat.score,
          threatLevel: threat.level,
          isBotConfirmed: bot.isBot && bot.confidence >= 90,
          botScore: bot.confidence,
          botName: bot.name,
          botType: bot.type,
          botIdentifiers: bot.identifiers,
        },
      });
    }
    
    return prisma.iPIntelligence.create({
      data: {
        ipAddress,
        country: geoData?.country || null,
        countryCode: geoData?.countryCode || null,
        region: geoData?.regionName || null,
        city: geoData?.city || null,
        latitude: geoData?.lat || null,
        longitude: geoData?.lon || null,
        timezone: geoData?.timezone || null,
        isp: geoData?.isp || null,
        org: geoData?.org || null,
        asn: geoData?.as || null,
        threatScore: threat.score,
        threatLevel: threat.level,
        isProxy: threat.isProxy,
        isVpn: threat.isVpn,
        isTor: threat.isTor,
        isDatacenter: threat.isDatacenter,
        isKnownAbuser: threat.isKnownAbuser,
        isBotConfirmed: bot.isBot && bot.confidence >= 90,
        botScore: bot.confidence,
        botName: bot.name,
        botType: bot.type,
        botIdentifiers: bot.identifiers,
        totalRequests: 1,
        requestsToday: 1,
        rawData: geoData || {},
      },
    });
  }
  
  private async getCachedIPData(ipAddress: string) {
    return prisma.iPIntelligence.findUnique({
      where: { ipAddress },
    });
  }
  
  private isCacheValid(lastUpdated: Date): boolean {
    const age = Date.now() - lastUpdated.getTime();
    return age < this.CACHE_TTL;
  }
  
  private async incrementRequestCount(ipAddress: string) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const existing = await prisma.iPIntelligence.findUnique({
        where: { ipAddress },
      });
      
      if (!existing) return;
      
      const lastReqDate = new Date(existing.lastRequestAt);
      lastReqDate.setHours(0, 0, 0, 0);
      const isSameDay = lastReqDate.getTime() === today.getTime();
      
      await prisma.iPIntelligence.update({
        where: { ipAddress },
        data: {
          totalRequests: { increment: 1 },
          requestsToday: isSameDay ? { increment: 1 } : 1,
          lastRequestAt: new Date(),
        },
      });
    } catch (error) {
      // Silent fail for increment
    }
  }
  
  private formatCachedResult(cached: any, userAgent?: string): IPAnalysisResult {
    // Re-detect bot if new user agent provided
    const botResult = userAgent
      ? this.detectBot(userAgent, cached.ipAddress)
      : {
          isBot: cached.isBotConfirmed,
          confidence: cached.botScore,
          name: cached.botName,
          type: cached.botType,
          identifiers: cached.botIdentifiers || [],
          isGoodBot: false,
        };
    
    return {
      ipAddress: cached.ipAddress,
      geo: {
        country: cached.country,
        countryCode: cached.countryCode,
        region: cached.region,
        city: cached.city,
        latitude: cached.latitude,
        longitude: cached.longitude,
        timezone: cached.timezone,
        isp: cached.isp,
        org: cached.org,
        asn: cached.asn,
      },
      threat: {
        score: cached.threatScore,
        level: cached.threatLevel as any,
        isProxy: cached.isProxy,
        isVpn: cached.isVpn,
        isTor: cached.isTor,
        isDatacenter: cached.isDatacenter,
        isKnownAbuser: cached.isKnownAbuser,
        reasons: [],
      },
      bot: botResult,
      stats: {
        totalRequests: cached.totalRequests,
        requestsToday: cached.requestsToday,
        firstSeenAt: cached.firstSeenAt,
        lastRequestAt: cached.lastRequestAt,
        isBlocked: cached.isBlocked,
      },
    };
  }
  
  private getDefaultResult(ipAddress: string): IPAnalysisResult {
    return {
      ipAddress,
      geo: {
        country: null,
        countryCode: null,
        region: null,
        city: null,
        latitude: null,
        longitude: null,
        timezone: null,
        isp: null,
        org: null,
        asn: null,
      },
      threat: {
        score: 0,
        level: 'NORMAL',
        isProxy: false,
        isVpn: false,
        isTor: false,
        isDatacenter: false,
        isKnownAbuser: false,
        reasons: [],
      },
      bot: {
        isBot: false,
        confidence: 0,
        name: null,
        type: null,
        identifiers: [],
        isGoodBot: false,
      },
      stats: {
        totalRequests: 0,
        requestsToday: 0,
        firstSeenAt: new Date(),
        lastRequestAt: new Date(),
        isBlocked: false,
      },
    };
  }
  
  private isPrivateIP(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return ip === '::1' || ip === 'localhost';
    
    // 10.x.x.x
    if (parts[0] === 10) return true;
    // 172.16.x.x - 172.31.x.x
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.x.x
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 127.x.x.x
    if (parts[0] === 127) return true;
    
    return false;
  }
  
  private isDatacenterIP(isp: string, org: string): boolean {
    const dcPatterns = [
      /amazon|aws|azure|google cloud|digitalocean|linode|vultr|ovh|hetzner|cloudflare/i,
    ];
    
    const combined = `${isp} ${org}`;
    return dcPatterns.some(p => p.test(combined));
  }
  
  private isTorExitNode(_ip: string): boolean {
    // In production, would check against Tor exit node list
    // For now, return false
    return false;
  }
}

export const ipIntelligenceService = new IPIntelligenceService();
export default ipIntelligenceService;
