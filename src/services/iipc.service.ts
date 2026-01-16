/**
 * IIPC - Internal IP Controller Service
 * 
 * Manages IP-based access control for the platform:
 * - Super Admin: Full control, can override all security blocks
 * - Admin/Dealers: Can whitelist own IP for OAuth
 * - Sales Reps: Limited IP whitelisting
 * 
 * Features:
 * - IP whitelisting per user, role, or globally
 * - Network/LAN range support (CIDR notation)
 * - Computer name tracking
 * - Emergency email verification fallback
 * - Override for rate limiting and security blocks
 */

import { logger } from '@/utils/logger';
import prisma from '@/config/database';
import { EventEmitter } from 'events';
import crypto from 'crypto';

// ============================================
// Types & Interfaces
// ============================================

export type IPAccessLevel = 'SUPER_ADMIN' | 'ADMIN' | 'DEALER' | 'SALES_REP' | 'USER';
export type IPRuleType = 'WHITELIST' | 'BLACKLIST';
export type IPRuleScope = 'GLOBAL' | 'ROLE' | 'USER' | 'NETWORK';

export interface IPRule {
  id: string;
  ip: string; // Can be single IP or CIDR (e.g., 192.168.1.0/24)
  type: IPRuleType;
  scope: IPRuleScope;
  scopeValue?: string; // Role name or User ID
  computerName?: string;
  description?: string;
  canOverrideRateLimit: boolean;
  canOverrideLoginBlock: boolean;
  canOverrideAllSecurity: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export interface RoleIPSettings {
  role: IPAccessLevel;
  canWhitelistOwnIP: boolean;
  canWhitelistForOAuth: boolean;
  requireIPMatch: boolean;
  allowEmailFallback: boolean;
  maxWhitelistedIPs: number;
}

export interface EmergencyAccessRequest {
  id: string;
  userId: string;
  requestedIP: string;
  verificationCode: string;
  verificationSentAt: Date;
  verifiedAt?: Date;
  expiresAt: Date;
  status: 'PENDING' | 'VERIFIED' | 'EXPIRED' | 'DENIED';
}

export interface IIPCConfig {
  enabled: boolean;
  enforceIPMatching: boolean;
  allowEmergencyAccess: boolean;
  emergencyCodeExpireMinutes: number;
  defaultRoleSettings: Record<IPAccessLevel, RoleIPSettings>;
  globalWhitelistedIPs: string[];
  superAdminOverrideIPs: string[];
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: IIPCConfig = {
  enabled: true,
  enforceIPMatching: false, // Start disabled, super admin can enable
  allowEmergencyAccess: true,
  emergencyCodeExpireMinutes: 15,
  defaultRoleSettings: {
    SUPER_ADMIN: {
      role: 'SUPER_ADMIN',
      canWhitelistOwnIP: true,
      canWhitelistForOAuth: true,
      requireIPMatch: false,
      allowEmailFallback: true,
      maxWhitelistedIPs: 100,
    },
    ADMIN: {
      role: 'ADMIN',
      canWhitelistOwnIP: true,
      canWhitelistForOAuth: true,
      requireIPMatch: false,
      allowEmailFallback: true,
      maxWhitelistedIPs: 20,
    },
    DEALER: {
      role: 'DEALER',
      canWhitelistOwnIP: true,
      canWhitelistForOAuth: true,
      requireIPMatch: false,
      allowEmailFallback: true,
      maxWhitelistedIPs: 10,
    },
    SALES_REP: {
      role: 'SALES_REP',
      canWhitelistOwnIP: true,
      canWhitelistForOAuth: false,
      requireIPMatch: false,
      allowEmailFallback: true,
      maxWhitelistedIPs: 5,
    },
    USER: {
      role: 'USER',
      canWhitelistOwnIP: false,
      canWhitelistForOAuth: false,
      requireIPMatch: false,
      allowEmailFallback: true,
      maxWhitelistedIPs: 0,
    },
  },
  globalWhitelistedIPs: [],
  superAdminOverrideIPs: ['86.40.131.65'], // Default super admin IP
};

// ============================================
// IIPC Service Class
// ============================================

class IIPCService extends EventEmitter {
  private config: IIPCConfig;
  private ipRules: Map<string, IPRule> = new Map();
  private emergencyRequests: Map<string, EmergencyAccessRequest> = new Map();
  private _userIPCache: Map<string, string[]> = new Map(); // userId -> IPs (reserved for future use)

  constructor() {
    super();
    this.config = { ...DEFAULT_CONFIG };
    logger.info('🔐 IIPC (Internal IP Controller) initialized');
  }

  // ============================================
  // Initialization
  // ============================================

  async initialize(): Promise<void> {
    try {
      await this.loadConfig();
      await this.loadIPRules();
      logger.info('🔐 IIPC fully operational');
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize IIPC:', error);
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const settings = await prisma.systemSettings.findFirst({
        where: { key: 'iipc' }
      });
      if (settings?.value) {
        const savedConfig = settings.value as any;
        this.config = { ...this.config, ...savedConfig };
      }
    } catch (error) {
      logger.warn('Could not load IIPC config, using defaults');
    }
  }

  private async loadIPRules(): Promise<void> {
    try {
      const settings = await prisma.systemSettings.findFirst({
        where: { key: 'iipc_rules' }
      });
      if (settings?.value) {
        const rules = settings.value as any[];
        rules.forEach(rule => {
          this.ipRules.set(rule.id, {
            ...rule,
            createdAt: new Date(rule.createdAt),
            updatedAt: new Date(rule.updatedAt),
            expiresAt: rule.expiresAt ? new Date(rule.expiresAt) : undefined,
          });
        });
      }
    } catch (error) {
      logger.warn('Could not load IIPC rules');
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await prisma.systemSettings.upsert({
        where: { key: 'iipc' },
        create: { key: 'iipc', value: this.config as any },
        update: { value: this.config as any },
      });
    } catch (error) {
      logger.error('Failed to save IIPC config:', error);
    }
  }

  private async saveIPRules(): Promise<void> {
    try {
      const rules = Array.from(this.ipRules.values());
      await prisma.systemSettings.upsert({
        where: { key: 'iipc_rules' },
        create: { key: 'iipc_rules', value: rules as any },
        update: { value: rules as any },
      });
    } catch (error) {
      logger.error('Failed to save IIPC rules:', error);
    }
  }

  // ============================================
  // IP Validation & Checking
  // ============================================

  /**
   * Check if an IP address matches a rule (supports CIDR notation)
   */
  private ipMatchesRule(ip: string, ruleIP: string): boolean {
    // Exact match
    if (ip === ruleIP) return true;

    // CIDR match
    if (ruleIP.includes('/')) {
      return this.ipInCIDR(ip, ruleIP);
    }

    // Wildcard match (e.g., 192.168.1.*)
    if (ruleIP.includes('*')) {
      const pattern = ruleIP.replace(/\./g, '\\.').replace(/\*/g, '\\d+');
      return new RegExp(`^${pattern}$`).test(ip);
    }

    return false;
  }

  /**
   * Check if IP is in CIDR range
   */
  private ipInCIDR(ip: string, cidr: string): boolean {
    const [range, bits] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits)) - 1);
    
    const ipNum = this.ipToNumber(ip);
    const rangeNum = this.ipToNumber(range);
    
    return (ipNum & mask) === (rangeNum & mask);
  }

  private ipToNumber(ip: string): number {
    const parts = ip.split('.').map(Number);
    return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
  }

  /**
   * Main access check - called during authentication
   */
  checkIPAccess(data: {
    ip: string;
    userId?: string;
    userRole?: IPAccessLevel;
    computerName?: string;
    isLoginAttempt?: boolean;
    isRateLimited?: boolean;
    isSecurityBlocked?: boolean;
  }): {
    allowed: boolean;
    reason?: string;
    canOverrideRateLimit: boolean;
    canOverrideLoginBlock: boolean;
    canOverrideAllSecurity: boolean;
    requiresEmergencyVerification: boolean;
  } {
    const { ip, userId, userRole } = data;
    // Note: isRateLimited and isSecurityBlocked are available in data for future use

    // Default response
    const result = {
      allowed: true,
      reason: undefined as string | undefined,
      canOverrideRateLimit: false,
      canOverrideLoginBlock: false,
      canOverrideAllSecurity: false,
      requiresEmergencyVerification: false,
    };

    // If IIPC is disabled, allow all
    if (!this.config.enabled) {
      return result;
    }

    // Check super admin override IPs first
    if (this.config.superAdminOverrideIPs.some(sip => this.ipMatchesRule(ip, sip))) {
      result.canOverrideRateLimit = true;
      result.canOverrideLoginBlock = true;
      result.canOverrideAllSecurity = true;
      logger.info(`IIPC: Super admin override IP detected: ${ip}`);
      return result;
    }

    // Check global whitelisted IPs
    if (this.config.globalWhitelistedIPs.some(wip => this.ipMatchesRule(ip, wip))) {
      result.canOverrideRateLimit = true;
      return result;
    }

    // Check IP rules
    const matchingRules = this.getMatchingRules(ip, userId, userRole);
    
    // Check for blacklist first
    const blacklistRule = matchingRules.find(r => r.type === 'BLACKLIST' && r.isActive);
    if (blacklistRule) {
      result.allowed = false;
      result.reason = `IP blacklisted: ${blacklistRule.description || 'Access denied'}`;
      return result;
    }

    // Check for whitelist rules
    const whitelistRules = matchingRules.filter(r => r.type === 'WHITELIST' && r.isActive);
    
    if (whitelistRules.length > 0) {
      // Get the most permissive rule
      const bestRule = whitelistRules.reduce((best, current) => {
        if (current.canOverrideAllSecurity) return current;
        if (current.canOverrideLoginBlock && !best.canOverrideAllSecurity) return current;
        if (current.canOverrideRateLimit && !best.canOverrideLoginBlock) return current;
        return best;
      });

      result.canOverrideRateLimit = bestRule.canOverrideRateLimit;
      result.canOverrideLoginBlock = bestRule.canOverrideLoginBlock;
      result.canOverrideAllSecurity = bestRule.canOverrideAllSecurity;
      return result;
    }

    // If IP matching is enforced and user has a role that requires it
    if (this.config.enforceIPMatching && userRole) {
      const roleSettings = this.config.defaultRoleSettings[userRole];
      if (roleSettings?.requireIPMatch) {
        // Check if user has any whitelisted IPs
        const userIPs = this.getUserWhitelistedIPs(userId || '');
        if (userIPs.length > 0 && !userIPs.some(uip => this.ipMatchesRule(ip, uip))) {
          result.allowed = false;
          result.reason = 'IP not in user whitelist';
          
          // Check if emergency access is allowed
          if (roleSettings.allowEmailFallback && this.config.allowEmergencyAccess) {
            result.requiresEmergencyVerification = true;
          }
        }
      }
    }

    return result;
  }

  /**
   * Get all rules matching an IP/user/role
   */
  private getMatchingRules(ip: string, userId?: string, userRole?: IPAccessLevel): IPRule[] {
    const now = new Date();
    return Array.from(this.ipRules.values()).filter(rule => {
      // Check expiry
      if (rule.expiresAt && rule.expiresAt < now) return false;
      
      // Check if IP matches
      if (!this.ipMatchesRule(ip, rule.ip)) return false;

      // Check scope
      switch (rule.scope) {
        case 'GLOBAL':
          return true;
        case 'ROLE':
          return rule.scopeValue === userRole;
        case 'USER':
          return rule.scopeValue === userId;
        case 'NETWORK':
          return true; // Network rules apply to matching IPs
        default:
          return false;
      }
    });
  }

  /**
   * Get user's whitelisted IPs
   */
  getUserWhitelistedIPs(userId: string): string[] {
    const rules = Array.from(this.ipRules.values()).filter(
      r => r.type === 'WHITELIST' && r.scope === 'USER' && r.scopeValue === userId && r.isActive
    );
    return rules.map(r => r.ip);
  }

  // ============================================
  // IP Rule Management
  // ============================================

  async addIPRule(rule: Omit<IPRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<IPRule> {
    const newRule: IPRule = {
      ...rule,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.ipRules.set(newRule.id, newRule);
    await this.saveIPRules();
    
    this.emit('rule-added', newRule);
    logger.info(`IIPC: Rule added - ${newRule.ip} (${newRule.scope})`);
    
    return newRule;
  }

  async updateIPRule(id: string, updates: Partial<IPRule>): Promise<IPRule | null> {
    const rule = this.ipRules.get(id);
    if (!rule) return null;

    const updatedRule: IPRule = {
      ...rule,
      ...updates,
      id: rule.id, // Preserve ID
      createdAt: rule.createdAt, // Preserve creation date
      updatedAt: new Date(),
    };

    this.ipRules.set(id, updatedRule);
    await this.saveIPRules();
    
    this.emit('rule-updated', updatedRule);
    return updatedRule;
  }

  async deleteIPRule(id: string): Promise<boolean> {
    const rule = this.ipRules.get(id);
    if (!rule) return false;

    this.ipRules.delete(id);
    await this.saveIPRules();
    
    this.emit('rule-deleted', rule);
    logger.info(`IIPC: Rule deleted - ${rule.ip}`);
    
    return true;
  }

  getAllRules(): IPRule[] {
    return Array.from(this.ipRules.values());
  }

  getRulesByScope(scope: IPRuleScope, scopeValue?: string): IPRule[] {
    return Array.from(this.ipRules.values()).filter(
      r => r.scope === scope && (!scopeValue || r.scopeValue === scopeValue)
    );
  }

  // ============================================
  // Emergency Access
  // ============================================

  async requestEmergencyAccess(userId: string, ip: string): Promise<{
    success: boolean;
    verificationId?: string;
    message: string;
  }> {
    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // Generate verification code
    const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const request: EmergencyAccessRequest = {
      id: crypto.randomUUID(),
      userId,
      requestedIP: ip,
      verificationCode,
      verificationSentAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.emergencyCodeExpireMinutes * 60 * 1000),
      status: 'PENDING',
    };

    this.emergencyRequests.set(request.id, request);

    // TODO: Send email with verification code
    // For now, log it
    logger.info(`IIPC Emergency Access: Code ${verificationCode} sent to ${user.email}`);

    return {
      success: true,
      verificationId: request.id,
      message: 'Verification code sent to your email',
    };
  }

  async verifyEmergencyAccess(verificationId: string, code: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const request = this.emergencyRequests.get(verificationId);
    if (!request) {
      return { success: false, message: 'Invalid verification request' };
    }

    if (request.status !== 'PENDING') {
      return { success: false, message: 'Verification already processed' };
    }

    if (request.expiresAt < new Date()) {
      request.status = 'EXPIRED';
      return { success: false, message: 'Verification code expired' };
    }

    if (request.verificationCode !== code.toUpperCase()) {
      return { success: false, message: 'Invalid verification code' };
    }

    // Mark as verified
    request.status = 'VERIFIED';
    request.verifiedAt = new Date();

    // Temporarily whitelist the IP for this user (24 hours)
    await this.addIPRule({
      ip: request.requestedIP,
      type: 'WHITELIST',
      scope: 'USER',
      scopeValue: request.userId,
      description: 'Emergency access - temporary',
      canOverrideRateLimit: true,
      canOverrideLoginBlock: true,
      canOverrideAllSecurity: false,
      createdBy: request.userId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      isActive: true,
    });

    logger.info(`IIPC: Emergency access granted for user ${request.userId} from ${request.requestedIP}`);

    return { success: true, message: 'Emergency access granted for 24 hours' };
  }

  // ============================================
  // Configuration Management
  // ============================================

  async updateConfig(updates: Partial<IIPCConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    await this.saveConfig();
    this.emit('config-updated', this.config);
  }

  getConfig(): IIPCConfig {
    return { ...this.config };
  }

  async updateRoleSettings(role: IPAccessLevel, settings: Partial<RoleIPSettings>): Promise<void> {
    this.config.defaultRoleSettings[role] = {
      ...this.config.defaultRoleSettings[role],
      ...settings,
    };
    await this.saveConfig();
  }

  getRoleSettings(role: IPAccessLevel): RoleIPSettings {
    return { ...this.config.defaultRoleSettings[role] };
  }

  getAllRoleSettings(): Record<IPAccessLevel, RoleIPSettings> {
    return { ...this.config.defaultRoleSettings };
  }

  // ============================================
  // Super Admin IP Management
  // ============================================

  async addSuperAdminIP(ip: string): Promise<void> {
    if (!this.config.superAdminOverrideIPs.includes(ip)) {
      this.config.superAdminOverrideIPs.push(ip);
      await this.saveConfig();
      logger.info(`IIPC: Super admin IP added: ${ip}`);
    }
  }

  async removeSuperAdminIP(ip: string): Promise<void> {
    this.config.superAdminOverrideIPs = this.config.superAdminOverrideIPs.filter(i => i !== ip);
    await this.saveConfig();
    logger.info(`IIPC: Super admin IP removed: ${ip}`);
  }

  getSuperAdminIPs(): string[] {
    return [...this.config.superAdminOverrideIPs];
  }

  // ============================================
  // Global Whitelist Management
  // ============================================

  async addGlobalWhitelistIP(ip: string): Promise<void> {
    if (!this.config.globalWhitelistedIPs.includes(ip)) {
      this.config.globalWhitelistedIPs.push(ip);
      await this.saveConfig();
    }
  }

  async removeGlobalWhitelistIP(ip: string): Promise<void> {
    this.config.globalWhitelistedIPs = this.config.globalWhitelistedIPs.filter(i => i !== ip);
    await this.saveConfig();
  }

  // ============================================
  // User IP Whitelist (Self-service)
  // ============================================

  async whitelistUserIP(userId: string, userRole: IPAccessLevel, ip: string, description?: string): Promise<{
    success: boolean;
    message: string;
    rule?: IPRule;
  }> {
    const roleSettings = this.config.defaultRoleSettings[userRole];
    
    if (!roleSettings.canWhitelistOwnIP) {
      return { success: false, message: 'Your role does not allow IP whitelisting' };
    }

    // Check max IPs
    const currentIPs = this.getUserWhitelistedIPs(userId);
    if (currentIPs.length >= roleSettings.maxWhitelistedIPs) {
      return { 
        success: false, 
        message: `Maximum ${roleSettings.maxWhitelistedIPs} IPs allowed for your role` 
      };
    }

    const rule = await this.addIPRule({
      ip,
      type: 'WHITELIST',
      scope: 'USER',
      scopeValue: userId,
      description: description || 'Self-whitelisted',
      canOverrideRateLimit: true,
      canOverrideLoginBlock: false,
      canOverrideAllSecurity: false,
      createdBy: userId,
      isActive: true,
    });

    return { success: true, message: 'IP whitelisted successfully', rule };
  }

  // ============================================
  // Status & Statistics
  // ============================================

  getStatus(): {
    config: IIPCConfig;
    totalRules: number;
    rulesByScope: Record<IPRuleScope, number>;
    rulesByType: Record<IPRuleType, number>;
    superAdminIPs: string[];
    globalWhitelistIPs: string[];
    pendingEmergencyRequests: number;
  } {
    const rules = Array.from(this.ipRules.values());
    
    const rulesByScope: Record<IPRuleScope, number> = {
      GLOBAL: 0,
      ROLE: 0,
      USER: 0,
      NETWORK: 0,
    };

    const rulesByType: Record<IPRuleType, number> = {
      WHITELIST: 0,
      BLACKLIST: 0,
    };

    rules.forEach(rule => {
      rulesByScope[rule.scope]++;
      rulesByType[rule.type]++;
    });

    const pendingRequests = Array.from(this.emergencyRequests.values()).filter(
      r => r.status === 'PENDING' && r.expiresAt > new Date()
    ).length;

    return {
      config: this.getConfig(),
      totalRules: rules.length,
      rulesByScope,
      rulesByType,
      superAdminIPs: this.getSuperAdminIPs(),
      globalWhitelistIPs: [...this.config.globalWhitelistedIPs],
      pendingEmergencyRequests: pendingRequests,
    };
  }

  // ============================================
  // Shutdown
  // ============================================

  shutdown(): void {
    logger.info('🔐 IIPC shutting down...');
    this.emergencyRequests.clear();
    this._userIPCache.clear();
    this.emit('shutdown');
    logger.info('🔐 IIPC shutdown complete');
  }
}

// Export singleton instance
export const iipcService = new IIPCService();
export default iipcService;
