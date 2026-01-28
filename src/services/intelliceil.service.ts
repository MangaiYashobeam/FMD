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
 * 
 * Enterprise Security Features:
 * - HMAC Request Signature Validation
 * - JWT Token Fingerprinting
 * - SQL Injection Detection
 * - XSS Attack Detection
 * - Bot Detection & CAPTCHA Triggers
 * - IP Reputation Checking
 * - Encrypted Payload Validation
 */

import { logger } from '@/utils/logger';
import prisma from '@/config/database';
import { EventEmitter } from 'events';
import crypto from 'crypto';

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
  strictMitigation: boolean; // When true, blocks ALL non-whitelisted traffic during mitigation
  notifyOnAttack: boolean;
  notifyEmail: string;
  // Enterprise Security Settings
  enableSignatureValidation: boolean;
  enableTokenFingerprinting: boolean;
  enableSQLInjectionDetection: boolean;
  enableXSSDetection: boolean;
  enableBotDetection: boolean;
  enableIPReputation: boolean;
  botDetectionThreshold: number; // 0-100
  signatureSecret: string;
}

// Enterprise Security Types
export interface RequestSignature {
  signature: string;
  timestamp: number;
  nonce: string;
}

export interface TokenFingerprint {
  fingerprint: string;
  userAgent: string;
  ip: string;
  acceptLanguage?: string;
  timezone?: string;
  createdAt: Date;
}

export interface SecurityValidationResult {
  valid: boolean;
  reason: string;
  threatScore?: number;
  recommendation?: string;
}

export interface BotDetectionResult {
  isBot: boolean;
  confidence: number;
  reason: string;
  indicators?: string[];
}

export interface IPReputationResult {
  ip: string;
  score: number;
  threats: string[];
  lastChecked: Date;
  isMalicious: boolean;
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
  // Docker internal networks (reverse proxies like Traefik)
  '172.16.0.0/12',  // Docker default bridge range
  '10.0.0.0/8',     // Docker overlay networks
  '192.168.0.0/16', // Local networks
  '127.0.0.0/8',    // Localhost
];

// ============================================
// Enterprise Security Patterns
// ============================================

// SQL Injection Detection Patterns (Comprehensive)
const SQL_INJECTION_PATTERNS = [
  // Classic patterns
  /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
  /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
  /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
  /((\%27)|(\'))union/i,
  
  // Command execution
  /exec(\s|\+)+(s|x)p\w+/i,
  /xp_cmdshell/i,
  /sp_executesql/i,
  /sp_makewebtask/i,
  /xp_reg\w+/i,
  
  // DDL/DML operations
  /UNION(\s+)SELECT/i,
  /UNION\s+ALL\s+SELECT/i,
  /INSERT(\s+)INTO/i,
  /DELETE(\s+)FROM/i,
  /DROP(\s+)(TABLE|DATABASE|INDEX|VIEW)/i,
  /UPDATE(\s+)\w+(\s+)SET/i,
  /SELECT(\s+).*(\s+)FROM/i,
  /TRUNCATE(\s+)TABLE/i,
  /ALTER(\s+)(TABLE|DATABASE)/i,
  /CREATE(\s+)(TABLE|DATABASE|INDEX|VIEW|PROCEDURE|FUNCTION)/i,
  /GRANT\s+\w+/i,
  /REVOKE\s+\w+/i,
  /MERGE\s+INTO/i,
  /REPLACE\s+INTO/i,
  
  // Boolean logic bypass
  /\bOR\b.*=.*\bOR\b/i,
  /\bAND\b.*=.*\bAND\b/i,
  /1\s*=\s*1/i,
  /1\s*=\s*'1'/i,
  /''\s*OR\s*''/i,
  /'\s*OR\s*'x'\s*=\s*'x/i,
  /'\s*OR\s*1\s*=\s*1/i,
  /'\s*AND\s*1\s*=\s*0/i,
  /'\s*OR\s*''='/i,
  /admin'\s*--/i,
  /'\s*OR\s*'\d+'\s*=\s*'\d+/i,
  /'\s*;\s*--/i,
  
  // Comment injection
  /;\s*--/i,
  /\/\*.*\*\//i,
  /--\s*$/i,
  /#\s*$/i,
  /\/\*!\d+/i,
  
  // Time-based blind injection
  /WAITFOR(\s+)DELAY/i,
  /BENCHMARK\s*\(/i,
  /SLEEP\s*\(/i,
  /pg_sleep/i,
  /DBMS_LOCK\.SLEEP/i,
  
  // Information schema probing
  /INFORMATION_SCHEMA/i,
  /SCHEMA_NAME/i,
  /TABLE_NAME/i,
  /COLUMN_NAME/i,
  /sys\.tables/i,
  /sys\.columns/i,
  /mysql\.user/i,
  /pg_catalog/i,
  
  // Stacked queries
  /;\s*(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)/i,
  
  // XPATH injection
  /extractvalue\s*\(/i,
  /updatexml\s*\(/i,
  /xmltype\s*\(/i,
  
  // Subquery injection
  /\(\s*SELECT\s+/i,
  
  // Out-of-band
  /INTO\s+(OUT|DUMP)FILE/i,
  /LOAD_FILE\s*\(/i,
  /UTL_HTTP/i,
  /UTL_INADDR/i,
  
  // NoSQL injection patterns
  /\$where\s*:/i,
  /\$gt\s*:/i,
  /\$lt\s*:/i,
  /\$ne\s*:/i,
  /\$regex\s*:/i,
  /\$or\s*:\s*\[/i,
  /\$and\s*:\s*\[/i,
  /\{\s*"\$/i,
  
  // Hex encoding bypass
  /0x[0-9a-fA-F]{8,}/i,
  /CHAR\s*\(\s*\d+/i,
  /CHR\s*\(\s*\d+/i,
  /CONCAT\s*\(/i,
  /CONCAT_WS\s*\(/i,
  
  // Database-specific
  /@@version/i,
  /@@datadir/i,
  /VERSION\s*\(\s*\)/i,
  /DATABASE\s*\(\s*\)/i,
  /USER\s*\(\s*\)/i,
  /CURRENT_USER/i,
  /SESSION_USER/i,
  /SYSTEM_USER/i,
];

// XSS Attack Detection Patterns (Comprehensive)
const XSS_PATTERNS = [
  // Script tags
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<script[^>]*>/gi,
  /<\/script>/gi,
  
  // Protocol handlers
  /javascript\s*:/gi,
  /vbscript\s*:/gi,
  /livescript\s*:/gi,
  /mocha\s*:/gi,
  
  // Event handlers (comprehensive list)
  /on(abort|activate|afterprint|afterupdate|beforeactivate|beforecopy|beforecut|beforedeactivate|beforeeditfocus|beforepaste|beforeprint|beforeunload|beforeupdate|blur|bounce|cellchange|change|click|contextmenu|controlselect|copy|cut|dataavailable|datasetchanged|datasetcomplete|dblclick|deactivate|drag|dragend|dragenter|dragleave|dragover|dragstart|drop|error|errorupdate|filterchange|finish|focus|focusin|focusout|hashchange|help|input|keydown|keypress|keyup|layoutcomplete|load|losecapture|message|mousedown|mouseenter|mouseleave|mousemove|mouseout|mouseover|mouseup|mousewheel|move|moveend|movestart|offline|online|pagehide|pageshow|paste|popstate|progress|propertychange|readystatechange|reset|resize|resizeend|resizestart|rowenter|rowexit|rowsdelete|rowsinserted|scroll|search|select|selectionchange|selectstart|start|stop|storage|submit|timeout|touchcancel|touchend|touchmove|touchstart|unload|wheel)\s*=/gi,
  
  // HTML injection tags
  /<iframe[^>]*>/gi,
  /<object[^>]*>/gi,
  /<embed[^>]*>/gi,
  /<link[^>]*>/gi,
  /<meta[^>]*>/gi,
  /<style[^>]*>/gi,
  /<img[^>]*onerror/gi,
  /<img[^>]*onload/gi,
  /<svg[^>]*onload/gi,
  /<body[^>]*onload/gi,
  /<video[^>]*>/gi,
  /<audio[^>]*>/gi,
  /<source[^>]*>/gi,
  /<marquee[^>]*>/gi,
  /<bgsound[^>]*>/gi,
  /<base[^>]*>/gi,
  /<applet[^>]*>/gi,
  /<form[^>]*>/gi,
  /<input[^>]*>/gi,
  /<button[^>]*>/gi,
  /<keygen[^>]*>/gi,
  /<textarea[^>]*>/gi,
  /<select[^>]*>/gi,
  /<details[^>]*>/gi,
  /<isindex[^>]*>/gi,
  
  // DOM manipulation
  /eval\s*\(/gi,
  /document\.(cookie|location|write|writeln|domain|URL|referrer)/gi,
  /window\.(location|open|name|status)/gi,
  /innerHTML\s*=/gi,
  /outerHTML\s*=/gi,
  /\.appendChild\s*\(/gi,
  /\.insertAdjacentHTML\s*\(/gi,
  /\.insertBefore\s*\(/gi,
  /\.replaceChild\s*\(/gi,
  /\.createContextualFragment\s*\(/gi,
  /\.write\s*\(/gi,
  /\.writeln\s*\(/gi,
  /\.open\s*\(\s*['"]text\/html/gi,
  
  // String manipulation for payload
  /fromCharCode/gi,
  /String\.fromCharCode/gi,
  /String\.raw/gi,
  /atob\s*\(/gi,
  /btoa\s*\(/gi,
  /decodeURI\s*\(/gi,
  /decodeURIComponent\s*\(/gi,
  /unescape\s*\(/gi,
  
  // Encoded payloads
  /%3C\s*script/gi,
  /&#x3C;script/gi,
  /&#60;script/gi,
  /\\x3c\s*script/gi,
  /\\u003c\s*script/gi,
  
  // Data URI
  /data:\s*text\/html/gi,
  /data:\s*image\/svg\+xml/gi,
  /data:\s*application\/x-www-form-urlencoded/gi,
  
  // CSS injection
  /expression\s*\(/gi,
  /@import/gi,
  /behavior\s*:/gi,
  /-moz-binding/gi,
  /binding\s*:/gi,
  
  // Angular/Vue/React specific
  /\{\{.*\}\}/gi,
  /\[innerHTML\]/gi,
  /v-html\s*=/gi,
  /dangerouslySetInnerHTML/gi,
  /ng-bind-html/gi,
  
  // Prototype pollution
  /__proto__/gi,
  /constructor\s*\[/gi,
  /prototype\s*\[/gi,
  
  // Template literals
  /\$\{[^}]*\}/gi,
  
  // SVG specific XSS
  /<svg[^>]*>.*<animate[^>]*>/gi,
  /<svg[^>]*>.*<set[^>]*>/gi,
  /<svg[^>]*>.*<handler[^>]*>/gi,
  /xlink:href\s*=\s*["']javascript/gi,
  
  // Fetch/XMLHttpRequest data exfiltration
  /new\s+XMLHttpRequest/gi,
  /fetch\s*\(/gi,
  /\.send\s*\(/gi,
  
  // Top/parent/self access
  /top\.location/gi,
  /parent\.location/gi,
  /self\.location/gi,
  /frames\[/gi,
];

// Bot User Agent Patterns
const BOT_USER_AGENTS = [
  /headless/i,
  /phantomjs/i,
  /selenium/i,
  /webdriver/i,
  /puppeteer/i,
  /playwright/i,
  /electron/i,
  /nightmare/i,
  /casperjs/i,
  /slimerjs/i,
  /splash/i,
  /htmlunit/i,
  /python-requests/i,
  /curl\//i,
  /wget\//i,
  /httpie/i,
  /axios/i,
  /node-fetch/i,
  /got\//i,
  /libwww/i,
  /lwp-/i,
  /java\//i,
  /httpclient/i,
  /okhttp/i,
  /scrapy/i,
  /bot\b/i,
  /crawler/i,
  /spider/i,
  /scan/i,
];

// Honeypot Endpoints (trap attackers)
const HONEYPOT_ENDPOINTS = [
  '/admin.php',
  '/wp-admin',
  '/wp-login.php',
  '/phpmyadmin',
  '/.env',
  '/.git/config',
  '/config.php',
  '/backup.sql',
  '/database.sql',
  '/shell.php',
  '/c99.php',
  '/r57.php',
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
  
  // Runtime blocked IPs (blocked during mitigation, not persisted)
  private runtimeBlockedIPs: Map<string, { blockedAt: Date; reason: string }> = new Map();
  
  // Enterprise Security Private Members
  private ipReputationCache: Map<string, IPReputationResult> = new Map();
  private tokenFingerprintCache: Map<string, TokenFingerprint> = new Map();
  private requestTimingCache: Map<string, number[]> = new Map();
  private usedNonces: Set<string> = new Set();
  private nonceCleanupInterval: NodeJS.Timeout | null = null;
  private securityMetrics = {
    sqlInjectionAttempts: 0,
    xssAttempts: 0,
    botDetections: 0,
    signatureFailures: 0,
    replayAttempts: 0,
    honeypotHits: 0,
  };

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
      strictMitigation: true, // When true, blocks ALL non-whitelisted traffic during mitigation
      notifyOnAttack: true,
      notifyEmail: 'admin@dealersface.com',
      // Enterprise Security Defaults
      enableSignatureValidation: true,
      enableTokenFingerprinting: true,
      enableSQLInjectionDetection: true,
      enableXSSDetection: true,
      enableBotDetection: true,
      enableIPReputation: true,
      botDetectionThreshold: 70,
      signatureSecret: process.env.INTELLICEIL_SECRET || crypto.randomBytes(32).toString('hex'),
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
    
    // Calculate percentage above baseline (with safeguards against very small baseline)
    let percentageAbove = 0;
    if (baselineRps >= 1) {
      // Normal calculation when baseline is meaningful
      percentageAbove = ((rps - baselineRps) / baselineRps) * 100;
    } else if (baselineRps > 0 && baselineRps < 1) {
      // For very small baseline, treat it as 1 to avoid huge percentages
      percentageAbove = ((rps - 1) / 1) * 100;
    } else {
      // If baseline is 0 or negative, just use rps as percentage
      percentageAbove = rps > 0 ? Math.min(rps * 10, 999) : 0;
    }
    
    // Cap the percentage to prevent absurdly large numbers
    this.threatLevel.percentage = Math.max(0, Math.min(percentageAbove, 9999));

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
    // Clear runtime blocked IPs when mitigation is deactivated
    this.runtimeBlockedIPs.clear();
    logger.info('🛡️ Intelliceil mitigation deactivated - Traffic normalized, runtime blocks cleared');
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
    // Always check manually blocked IPs first
    if (this.config.blockedIPs.includes(ip)) {
      return { allowed: false, reason: 'IP is manually blocked' };
    }
    
    // Check runtime blocked IPs (blocked during mitigation)
    if (this.runtimeBlockedIPs.has(ip)) {
      return { allowed: false, reason: 'IP blocked during mitigation' };
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
      // Block this IP for rate limit violation
      this.runtimeBlockedIPs.set(ip, { blockedAt: new Date(), reason: 'Rate limit exceeded' });
      return { allowed: false, reason: 'Rate limit exceeded during mitigation' };
    }

    // STRICT MITIGATION MODE: Block ALL non-whitelisted traffic
    if (this.config.strictMitigation) {
      // Block this IP during strict mitigation
      this.runtimeBlockedIPs.set(ip, { blockedAt: new Date(), reason: 'Not whitelisted during strict mitigation' });
      return { allowed: false, reason: 'Not whitelisted during strict mitigation' };
    }

    // SOFT MITIGATION: Check if request pattern is normal
    const isNormalPattern = this.isNormalRequestPattern(ip, source);
    if (!isNormalPattern) {
      this.runtimeBlockedIPs.set(ip, { blockedAt: new Date(), reason: 'Abnormal traffic pattern' });
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
    securityMetrics: {
      sqlInjectionAttempts: number;
      xssAttempts: number;
      botDetections: number;
      signatureFailures: number;
      replayAttempts: number;
      honeypotHits: number;
      ipReputationCacheSize: number;
      tokenFingerprintCacheSize: number;
    };
    blockedIPsList: { ip: string; reason: string; blockedAt: string | null }[];
    runtimeBlockedCount: number;
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

    // Combine manually blocked IPs with runtime blocked IPs for display
    const allBlockedIPs = [
      ...this.config.blockedIPs.map(ip => ({ ip, reason: 'Manually blocked', blockedAt: null })),
      ...Array.from(this.runtimeBlockedIPs.entries()).map(([ip, data]) => ({
        ip,
        reason: data.reason,
        blockedAt: data.blockedAt.toISOString(),
      })),
    ];

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
      securityMetrics: this.getSecurityMetrics(),
      blockedIPsList: allBlockedIPs, // Full list of blocked IPs with reasons
      runtimeBlockedCount: this.runtimeBlockedIPs.size,
    };
  }

  // Get blocked IPs list
  getBlockedIPsList(): { ip: string; reason: string; blockedAt: string | null }[] {
    return [
      ...this.config.blockedIPs.map(ip => ({ ip, reason: 'Manually blocked', blockedAt: null })),
      ...Array.from(this.runtimeBlockedIPs.entries()).map(([ip, data]) => ({
        ip,
        reason: data.reason,
        blockedAt: data.blockedAt.toISOString(),
      })),
    ];
  }

  // Clear runtime blocked IPs (when mitigation is deactivated)
  clearRuntimeBlockedIPs(): void {
    this.runtimeBlockedIPs.clear();
  }

  // Manual controls
  manualBlock(ip: string): void {
    if (!this.config.blockedIPs.includes(ip)) {
      this.config.blockedIPs.push(ip);
      this.updateConfig({ blockedIPs: this.config.blockedIPs });
    }
    // Also remove from runtime if it was there
    this.runtimeBlockedIPs.delete(ip);
  }

  manualUnblock(ip: string): void {
    this.config.blockedIPs = this.config.blockedIPs.filter(i => i !== ip);
    this.updateConfig({ blockedIPs: this.config.blockedIPs });
    // Also remove from runtime blocked
    this.runtimeBlockedIPs.delete(ip);
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

  // ============================================
  // ENTERPRISE SECURITY FEATURES
  // ============================================

  /**
   * Validates HMAC request signature for API authenticity
   * Prevents request tampering and replay attacks
   */
  validateRequestSignature(
    payload: string,
    signature: string,
    timestamp: number,
    nonce?: string
  ): SecurityValidationResult {
    if (!this.config.enableSignatureValidation) {
      return { valid: true, reason: 'Signature validation disabled' };
    }

    // Check timestamp freshness (5 minute window)
    const now = Date.now();
    const age = Math.abs(now - timestamp);
    if (age > 5 * 60 * 1000) {
      this.securityMetrics.replayAttempts++;
      return { 
        valid: false, 
        reason: 'Request timestamp expired',
        threatScore: 80,
        recommendation: 'Possible replay attack - block IP'
      };
    }

    // Check nonce for replay prevention
    if (nonce) {
      if (this.usedNonces.has(nonce)) {
        this.securityMetrics.replayAttempts++;
        return { 
          valid: false, 
          reason: 'Nonce already used',
          threatScore: 95,
          recommendation: 'Replay attack detected - block IP immediately'
        };
      }
      this.usedNonces.add(nonce);
      // Clean old nonces every hour
      this.scheduleNonceCleanup();
    }

    // Verify HMAC signature
    const dataToSign = `${timestamp}.${payload}${nonce ? '.' + nonce : ''}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.config.signatureSecret)
      .update(dataToSign)
      .digest('hex');

    if (signature !== expectedSignature) {
      this.securityMetrics.signatureFailures++;
      return { 
        valid: false, 
        reason: 'Invalid signature',
        threatScore: 70,
        recommendation: 'Request tampering detected'
      };
    }

    return { valid: true, reason: 'Signature valid' };
  }

  /**
   * Generates a new request signature for outgoing requests
   */
  generateRequestSignature(payload: string): RequestSignature {
    const timestamp = Date.now();
    const nonce = crypto.randomBytes(16).toString('hex');
    const dataToSign = `${timestamp}.${payload}.${nonce}`;
    const signature = crypto
      .createHmac('sha256', this.config.signatureSecret)
      .update(dataToSign)
      .digest('hex');

    return { timestamp, nonce, signature };
  }

  /**
   * Creates a token fingerprint for session binding
   * Prevents token theft by binding tokens to device/browser
   */
  createTokenFingerprint(
    userId: string,
    userAgent: string,
    ip: string,
    acceptLanguage?: string,
    acceptEncoding?: string
  ): TokenFingerprint {
    const fingerprintData = `${userAgent}|${acceptLanguage || ''}|${acceptEncoding || ''}`;
    const fingerprint = crypto
      .createHash('sha256')
      .update(fingerprintData)
      .digest('hex')
      .substring(0, 32);

    const tokenFingerprint: TokenFingerprint = {
      fingerprint,
      userAgent,
      ip,
      createdAt: new Date(),
    };

    this.tokenFingerprintCache.set(`${userId}:${fingerprint}`, tokenFingerprint);
    return tokenFingerprint;
  }

  /**
   * Validates token fingerprint against stored fingerprint
   */
  validateTokenFingerprint(
    storedFingerprint: TokenFingerprint,
    currentUserAgent: string,
    currentIP: string
  ): SecurityValidationResult {
    if (!this.config.enableTokenFingerprinting) {
      return { valid: true, reason: 'Token fingerprinting disabled' };
    }

    // Check user agent match
    if (storedFingerprint.userAgent !== currentUserAgent) {
      return {
        valid: false,
        reason: 'User agent mismatch',
        threatScore: 75,
        recommendation: 'Possible token theft - force re-authentication'
      };
    }

    // IP change is suspicious but not always malicious (mobile networks)
    if (storedFingerprint.ip !== currentIP) {
      return {
        valid: true, // Allow but flag
        reason: 'IP address changed',
        threatScore: 30,
        recommendation: 'Monitor for additional suspicious activity'
      };
    }

    return { valid: true, reason: 'Fingerprint valid' };
  }

  /**
   * Detects SQL injection attempts in input
   */
  detectSQLInjection(input: string): SecurityValidationResult {
    if (!this.config.enableSQLInjectionDetection) {
      return { valid: true, reason: 'SQL injection detection disabled' };
    }

    if (!input || typeof input !== 'string') {
      return { valid: true, reason: 'No input to check' };
    }

    const normalizedInput = input.toLowerCase().trim();
    
    for (const pattern of SQL_INJECTION_PATTERNS) {
      if (pattern.test(normalizedInput)) {
        this.securityMetrics.sqlInjectionAttempts++;
        logger.warn(`🚨 SQL Injection attempt detected: ${input.substring(0, 100)}`);
        return {
          valid: false,
          reason: 'SQL injection pattern detected',
          threatScore: 95,
          recommendation: 'Block request and log IP'
        };
      }
    }

    return { valid: true, reason: 'No SQL injection detected' };
  }

  /**
   * Detects XSS attempts in input
   */
  detectXSS(input: string): SecurityValidationResult {
    if (!this.config.enableXSSDetection) {
      return { valid: true, reason: 'XSS detection disabled' };
    }

    if (!input || typeof input !== 'string') {
      return { valid: true, reason: 'No input to check' };
    }

    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(input)) {
        this.securityMetrics.xssAttempts++;
        logger.warn(`🚨 XSS attempt detected: ${input.substring(0, 100)}`);
        return {
          valid: false,
          reason: 'XSS pattern detected',
          threatScore: 90,
          recommendation: 'Sanitize input and log attempt'
        };
      }
    }

    return { valid: true, reason: 'No XSS detected' };
  }

  /**
   * Scans request body/params for SQL injection and XSS
   */
  validateRequestInput(input: Record<string, unknown>): SecurityValidationResult {
    const results: SecurityValidationResult[] = [];

    const scanValue = (value: unknown, path: string): void => {
      if (typeof value === 'string') {
        const sqlResult = this.detectSQLInjection(value);
        if (!sqlResult.valid) {
          results.push({ ...sqlResult, reason: `${sqlResult.reason} in ${path}` });
        }
        const xssResult = this.detectXSS(value);
        if (!xssResult.valid) {
          results.push({ ...xssResult, reason: `${xssResult.reason} in ${path}` });
        }
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => scanValue(item, `${path}[${index}]`));
      } else if (value && typeof value === 'object') {
        Object.entries(value).forEach(([key, val]) => scanValue(val, `${path}.${key}`));
      }
    };

    Object.entries(input).forEach(([key, value]) => scanValue(value, key));

    if (results.length > 0) {
      const maxThreatScore = Math.max(...results.map(r => r.threatScore || 0));
      return {
        valid: false,
        reason: results.map(r => r.reason).join('; '),
        threatScore: maxThreatScore,
        recommendation: 'Block request - malicious input detected'
      };
    }

    return { valid: true, reason: 'Input validated' };
  }

  /**
   * Detects automated bot traffic
   */
  detectBot(
    userAgent: string,
    ip: string,
    requestTimestamp?: number
  ): BotDetectionResult {
    if (!this.config.enableBotDetection) {
      return { isBot: false, confidence: 0, reason: 'Bot detection disabled' };
    }

    let botScore = 0;
    const indicators: string[] = [];

    // Check known bot user agents
    for (const pattern of BOT_USER_AGENTS) {
      if (pattern.test(userAgent)) {
        botScore += 50;
        indicators.push(`Known bot pattern: ${pattern.source}`);
        break;
      }
    }

    // Check for missing or suspicious user agent
    if (!userAgent || userAgent.length < 20) {
      botScore += 30;
      indicators.push('Missing or short user agent');
    }

    // Check request timing regularity
    if (requestTimestamp) {
      const timings = this.requestTimingCache.get(ip) || [];
      timings.push(requestTimestamp);
      
      // Keep last 20 request timestamps
      if (timings.length > 20) {
        timings.shift();
      }
      this.requestTimingCache.set(ip, timings);

      // Check for robotic timing (too regular intervals)
      if (timings.length >= 5) {
        const intervals = [];
        for (let i = 1; i < timings.length; i++) {
          intervals.push(timings[i] - timings[i - 1]);
        }
        
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = this.calculateVariance(intervals);
        const coefficientOfVariation = variance > 0 ? Math.sqrt(variance) / avgInterval : 0;
        
        // Very regular timing (low variance) is suspicious
        if (coefficientOfVariation < 0.1 && intervals.length >= 5) {
          botScore += 25;
          indicators.push('Suspiciously regular request timing');
        }

        // Very fast requests (< 100ms average)
        if (avgInterval < 100) {
          botScore += 20;
          indicators.push('Inhuman request speed');
        }
      }
    }

    // Check request rate
    const ipData = this.ipRequestCounts.get(ip);
    if (ipData) {
      const requestsPerMinute = ipData.count / Math.max(1, (Date.now() - ipData.firstSeen.getTime()) / 60000);
      if (requestsPerMinute > 60) {
        botScore += 20;
        indicators.push(`High request rate: ${requestsPerMinute.toFixed(1)}/min`);
      }
    }

    const isBot = botScore >= this.config.botDetectionThreshold;
    
    if (isBot) {
      this.securityMetrics.botDetections++;
      logger.info(`🤖 Bot detected (score: ${botScore}): ${indicators.join(', ')}`);
    }

    return {
      isBot,
      confidence: Math.min(100, botScore),
      reason: indicators.join('; ') || 'No bot indicators',
      indicators,
    };
  }

  /**
   * Checks IP reputation against threat intelligence
   */
  async checkIPReputation(ip: string): Promise<IPReputationResult> {
    if (!this.config.enableIPReputation) {
      return { ip, score: 100, threats: [], lastChecked: new Date(), isMalicious: false };
    }

    // Check cache first
    const cached = this.ipReputationCache.get(ip);
    if (cached && (Date.now() - cached.lastChecked.getTime()) < 3600000) {
      return cached; // Cache for 1 hour
    }

    const threats: string[] = [];
    let score = 100;

    // Check if IP is in known bad ranges (Tor exit nodes, known botnets, etc.)
    const knownBadRanges = [
      '185.220.', // Tor exit nodes common range
      '104.244.', // Another common abuse range
      '45.33.',   // Common VPS abuse
    ];

    for (const range of knownBadRanges) {
      if (ip.startsWith(range)) {
        score -= 30;
        threats.push('IP in suspicious range');
        break;
      }
    }

    // Check internal threat intelligence
    const ipData = this.ipRequestCounts.get(ip);
    if (ipData) {
      if (ipData.blocked) {
        score -= 50;
        threats.push('Previously blocked');
      }
      
      // High request rate
      const requestsPerMinute = ipData.count / Math.max(1, (Date.now() - ipData.firstSeen.getTime()) / 60000);
      if (requestsPerMinute > 100) {
        score -= 20;
        threats.push('Abnormally high request rate');
      }
    }

    // Check if IP was involved in attacks
    if (this.config.blockedIPs.includes(ip)) {
      score = 0;
      threats.push('Blacklisted');
    }

    const result: IPReputationResult = {
      ip,
      score: Math.max(0, score),
      threats,
      lastChecked: new Date(),
      isMalicious: score < 30,
    };

    this.ipReputationCache.set(ip, result);
    return result;
  }

  /**
   * Checks if endpoint is a honeypot trap
   */
  checkHoneypot(endpoint: string): { isHoneypot: boolean; action: string } {
    const normalizedEndpoint = endpoint.toLowerCase();
    
    for (const honeypot of HONEYPOT_ENDPOINTS) {
      if (normalizedEndpoint.includes(honeypot)) {
        this.securityMetrics.honeypotHits++;
        logger.warn(`🍯 Honeypot triggered: ${endpoint}`);
        return { 
          isHoneypot: true, 
          action: 'block_and_flag' 
        };
      }
    }

    return { isHoneypot: false, action: 'allow' };
  }

  /**
   * Decrypts and validates encrypted payload
   */
  decryptPayload(encryptedData: string, key: string, iv: string): { success: boolean; data?: string; error?: string } {
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        Buffer.from(key, 'hex'),
        Buffer.from(iv, 'hex')
      );
      
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return { success: true, data: decrypted };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Decryption failed'
      };
    }
  }

  /**
   * Encrypts payload for secure transmission
   */
  encryptPayload(data: string): { encryptedData: string; iv: string; key: string } {
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      key: key.toString('hex'),
    };
  }

  /**
   * Comprehensive security check for incoming requests
   */
  async performSecurityCheck(request: {
    ip: string;
    endpoint: string;
    userAgent: string;
    body?: Record<string, unknown>;
    signature?: string;
    timestamp?: number;
    nonce?: string;
  }): Promise<SecurityValidationResult> {
    const results: SecurityValidationResult[] = [];

    // 1. Check honeypot
    const honeypotResult = this.checkHoneypot(request.endpoint);
    if (honeypotResult.isHoneypot) {
      this.manualBlock(request.ip);
      return {
        valid: false,
        reason: 'Honeypot trap triggered',
        threatScore: 100,
        recommendation: 'IP automatically blocked'
      };
    }

    // 2. Check IP reputation
    const ipReputation = await this.checkIPReputation(request.ip);
    if (ipReputation.isMalicious) {
      results.push({
        valid: false,
        reason: `Malicious IP: ${ipReputation.threats.join(', ')}`,
        threatScore: 100 - ipReputation.score,
      });
    }

    // 3. Check bot detection
    const botResult = this.detectBot(request.userAgent, request.ip, Date.now());
    if (botResult.isBot) {
      results.push({
        valid: false,
        reason: `Bot detected: ${botResult.reason}`,
        threatScore: botResult.confidence,
      });
    }

    // 4. Validate signature if provided
    if (request.signature && request.timestamp) {
      const signatureResult = this.validateRequestSignature(
        JSON.stringify(request.body || {}),
        request.signature,
        request.timestamp,
        request.nonce
      );
      if (!signatureResult.valid) {
        results.push(signatureResult);
      }
    }

    // 5. Validate request body
    if (request.body) {
      const inputResult = this.validateRequestInput(request.body);
      if (!inputResult.valid) {
        results.push(inputResult);
      }
    }

    // Aggregate results
    if (results.length > 0) {
      const maxThreatScore = Math.max(...results.map(r => r.threatScore || 0));
      return {
        valid: false,
        reason: results.map(r => r.reason).join('; '),
        threatScore: maxThreatScore,
        recommendation: maxThreatScore >= 80 
          ? 'Block IP immediately' 
          : 'Log and monitor'
      };
    }

    return { valid: true, reason: 'All security checks passed' };
  }

  /**
   * Helper: Calculate variance of numbers array
   */
  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    return numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / numbers.length;
  }

  /**
   * Helper: Schedule nonce cleanup
   */
  private scheduleNonceCleanup(): void {
    if (this.nonceCleanupInterval) return;
    
    this.nonceCleanupInterval = setInterval(() => {
      // Clear all nonces every hour (they expire in 5 mins anyway)
      this.usedNonces.clear();
    }, 3600000);
  }

  /**
   * Get security metrics
   */
  getSecurityMetrics(): typeof this.securityMetrics & { ipReputationCacheSize: number; tokenFingerprintCacheSize: number } {
    return {
      ...this.securityMetrics,
      ipReputationCacheSize: this.ipReputationCache.size,
      tokenFingerprintCacheSize: this.tokenFingerprintCache.size,
    };
  }

  /**
   * Reset security metrics
   */
  resetSecurityMetrics(): void {
    this.securityMetrics = {
      sqlInjectionAttempts: 0,
      xssAttempts: 0,
      botDetections: 0,
      signatureFailures: 0,
      replayAttempts: 0,
      honeypotHits: 0,
    };
  }

  // Cleanup
  shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.baselineInterval) {
      clearInterval(this.baselineInterval);
    }
    if (this.nonceCleanupInterval) {
      clearInterval(this.nonceCleanupInterval);
    }
    
    // Clear caches
    this.ipReputationCache.clear();
    this.tokenFingerprintCache.clear();
    this.requestTimingCache.clear();
    this.usedNonces.clear();
    
    logger.info('🛡️ Intelliceil shutdown complete');
  }
}

// Export singleton instance
export const intelliceilService = new IntelliceilService();
export default intelliceilService;
