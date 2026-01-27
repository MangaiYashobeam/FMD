/**
 * ============================================
 * Enterprise Security Routes
 * ============================================
 * 
 * Comprehensive security management API for SUPER_ADMIN
 * 
 * Features:
 * - SSRF Prevention (Domain Allowlist Management)
 * - Private IP Blocking Configuration
 * - Security Analytics & Audit Logs
 * - Real-time Threat Monitoring
 * 
 * SECURITY: All routes require SUPER_ADMIN authentication
 * SECURITY: Rate limited to prevent abuse
 * SECURITY: Input validation and sanitization on all inputs
 */

import { Router, Response } from 'express';
import type { ParsedQs } from 'qs';
import { authenticate, AuthRequest } from '@middleware/auth';
import { requireSuperAdmin } from '@middleware/rbac';
import prisma from '@config/database';
import { logger } from '@utils/logger';
import rateLimit from 'express-rate-limit';

const router = Router();

// ============================================
// RATE LIMITING
// ============================================

// Strict rate limiting for security management operations
const securityRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute (1/second avg)
  message: { 
    success: false, 
    error: 'Too many requests, please slow down',
    code: 'RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// SECURITY UTILITIES
// ============================================

/**
 * Sanitize domain input - prevent XSS and injection
 */
function sanitizeDomain(domain: string | undefined): string | null {
  if (!domain || typeof domain !== 'string') return null;
  
  // Remove control characters, trim whitespace
  let cleaned = domain.replace(/[\x00-\x1f\x7f]/g, '').trim().toLowerCase();
  
  // Length validation (max 253 chars per DNS spec)
  if (cleaned.length === 0 || cleaned.length > 253) return null;
  
  // Remove protocol if present
  cleaned = cleaned.replace(/^https?:\/\//, '');
  
  // Remove trailing slashes/paths
  cleaned = cleaned.split('/')[0];
  
  // Validate domain format (allow wildcards)
  const domainPattern = /^(\*\.)?[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;
  const suffixPattern = /^\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;
  
  if (!domainPattern.test(cleaned) && !suffixPattern.test(cleaned)) {
    return null;
  }
  
  return cleaned;
}

/**
 * Sanitize IP address/range input
 */
function sanitizeIPInput(ip: string | undefined): string | null {
  if (!ip || typeof ip !== 'string') return null;
  
  const cleaned = ip.replace(/[\x00-\x1f\x7f]/g, '').trim();
  
  // Length limit
  if (cleaned.length === 0 || cleaned.length > 45) return null;
  
  // IPv4 pattern (with optional CIDR)
  const ipv4Pattern = /^(\d{1,3}\.){1,3}(\d{1,3}|\*)(\/\d{1,2})?$/;
  
  // IPv6 pattern (simplified)
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(\/\d{1,3})?$/;
  
  // Special patterns (prefixes)
  const prefixPattern = /^(\d{1,3}\.){1,3}$/;
  
  if (!ipv4Pattern.test(cleaned) && !ipv6Pattern.test(cleaned) && !prefixPattern.test(cleaned) && cleaned !== 'localhost') {
    return null;
  }
  
  // Additional validation for IPv4 octets (0-255)
  if (ipv4Pattern.test(cleaned)) {
    const parts = cleaned.replace(/\/\d+$/, '').split('.');
    for (const part of parts) {
      if (part !== '*') {
        const num = parseInt(part, 10);
        if (num < 0 || num > 255) return null;
      }
    }
  }
  
  return cleaned;
}

/**
 * Validate UUID format
 */
function isValidUUID(id: string | undefined): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Sanitize text input - comprehensive XSS prevention
 */
function sanitizeText(text: string | undefined, maxLength: number = 500): string | null {
  if (!text || typeof text !== 'string') return null;
  
  // Remove control characters
  let cleaned = text.replace(/[\x00-\x1f\x7f]/g, '').trim();
  
  // Remove HTML tags and dangerous characters
  cleaned = cleaned
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>"'`\\]/g, '') // Remove dangerous chars
    .replace(/javascript:/gi, '') // Remove JS protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .substring(0, maxLength);
  
  return cleaned || null;
}

/**
 * Extract single string from query param (prevent array pollution)
 * Handles Express ParsedQs types properly
 */
type QueryParam = string | string[] | ParsedQs | ParsedQs[] | undefined;
function getSingleParam(param: QueryParam): string | undefined {
  if (typeof param === 'string') return param;
  if (Array.isArray(param)) {
    const first = param[0];
    return typeof first === 'string' ? first : undefined;
  }
  return undefined;
}

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

// All routes require authentication, SUPER_ADMIN role, and rate limiting
router.use(authenticate);
router.use(requireSuperAdmin);
router.use(securityRateLimit);

// ============================================
// SSRF DOMAIN ALLOWLIST MANAGEMENT
// ============================================

/**
 * GET /api/enterprise-security/ssrf/domains
 * Get all SSRF allowlist domains with analytics
 */
router.get('/ssrf/domains', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const domains = await prisma.ssrfAllowlistDomain.findMany({
      orderBy: [
        { category: 'asc' },
        { createdAt: 'desc' }
      ],
      include: {
        _count: {
          select: { proxyRequests: true }
        }
      }
    });
    
    // Group by category for UI
    const grouped = domains.reduce((acc, domain) => {
      const cat = domain.category || 'Other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push({
        ...domain,
        totalRequests: domain._count.proxyRequests
      });
      return acc;
    }, {} as Record<string, any[]>);
    
    // Get analytics summary
    const totalRequests = await prisma.ssrfProxyLog.count();
    const blockedRequests = await prisma.ssrfProxyLog.count({
      where: { blocked: true }
    });
    const last24hRequests = await prisma.ssrfProxyLog.count({
      where: {
        timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    });
    
    logger.info('[EnterpriseSecurity] SSRF domains fetched', {
      userId: req.user?.id,
      totalDomains: domains.length
    });
    
    res.json({
      success: true,
      data: {
        domains,
        grouped,
        analytics: {
          totalDomains: domains.length,
          totalRequests,
          blockedRequests,
          last24hRequests,
          blockRate: totalRequests > 0 ? ((blockedRequests / totalRequests) * 100).toFixed(2) : '0'
        }
      }
    });
  } catch (error) {
    logger.error('[EnterpriseSecurity] Failed to fetch SSRF domains:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch SSRF domains' });
  }
});

/**
 * POST /api/enterprise-security/ssrf/domains
 * Add a new domain to SSRF allowlist
 */
router.post('/ssrf/domains', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { domain, category, description, matchType } = req.body;
    
    // Sanitize and validate domain
    const sanitizedDomain = sanitizeDomain(domain);
    if (!sanitizedDomain) {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid domain format',
        code: 'INVALID_DOMAIN'
      });
      return;
    }
    
    // Validate category
    const validCategories = ['facebook', 'aws', 'cloudflare', 'dealer', 'cdn', 'internal', 'other'];
    const safeCategory = validCategories.includes(category?.toLowerCase()) 
      ? category.toLowerCase() 
      : 'other';
    
    // Validate matchType - disallow regex for security (ReDoS prevention)
    const validMatchTypes = ['exact', 'suffix', 'wildcard'];
    const safeMatchType = validMatchTypes.includes(matchType?.toLowerCase()) 
      ? matchType.toLowerCase() 
      : 'exact';
    
    // Sanitize description using comprehensive sanitizer
    const safeDescription = sanitizeText(description, 500);
    
    // Create domain entry (use unique constraint for race condition safety)
    // Create domain entry (use unique constraint for race condition safety)
    let newDomain;
    try {
      newDomain = await prisma.ssrfAllowlistDomain.create({
        data: {
          domain: sanitizedDomain,
          category: safeCategory,
          description: safeDescription,
          matchType: safeMatchType,
          isActive: true,
          addedBy: req.user?.id || 'system',
          createdAt: new Date()
        }
      });
    } catch (dbError: any) {
      // Handle unique constraint violation (race condition safe)
      if (dbError.code === 'P2002') {
        res.status(409).json({ 
          success: false, 
          error: 'Domain already exists in allowlist',
          code: 'DUPLICATE_DOMAIN'
        });
        return;
      }
      throw dbError;
    }
    
    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'SSRF_DOMAIN_ADDED',
        entityType: 'ssrf_allowlist',
        entityId: newDomain.id,
        ipAddress: req.ip,
        metadata: {
          domain: sanitizedDomain,
          category: safeCategory,
          matchType: safeMatchType
        }
      }
    });
    
    logger.info('[EnterpriseSecurity] SSRF domain added', {
      userId: req.user?.id,
      domain: sanitizedDomain,
      category: safeCategory
    });
    
    res.status(201).json({
      success: true,
      data: newDomain
    });
  } catch (error) {
    logger.error('[EnterpriseSecurity] Failed to add SSRF domain:', error);
    res.status(500).json({ success: false, error: 'Failed to add SSRF domain' });
  }
});

/**
 * PUT /api/enterprise-security/ssrf/domains/:id
 * Update an existing SSRF allowlist domain
 */
router.put('/ssrf/domains/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { isActive, category, description, matchType } = req.body;
    
    // Validate UUID
    if (!isValidUUID(id)) {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid domain ID',
        code: 'INVALID_ID'
      });
      return;
    }
    
    // Verify domain exists
    const existing = await prisma.ssrfAllowlistDomain.findUnique({
      where: { id }
    });
    
    if (!existing) {
      res.status(404).json({ 
        success: false, 
        error: 'Domain not found',
        code: 'NOT_FOUND'
      });
      return;
    }
    
    // Build update data
    const updateData: any = { updatedAt: new Date() };
    
    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive;
    }
    
    if (category) {
      const validCategories = ['facebook', 'aws', 'cloudflare', 'dealer', 'cdn', 'internal', 'other'];
      if (validCategories.includes(category.toLowerCase())) {
        updateData.category = category.toLowerCase();
      }
    }
    
    if (description !== undefined) {
      updateData.description = description 
        ? description.toString().replace(/[<>]/g, '').substring(0, 500) 
        : null;
    }
    
    if (matchType) {
      const validMatchTypes = ['exact', 'suffix', 'wildcard', 'regex'];
      if (validMatchTypes.includes(matchType.toLowerCase())) {
        updateData.matchType = matchType.toLowerCase();
      }
    }
    
    const updatedDomain = await prisma.ssrfAllowlistDomain.update({
      where: { id },
      data: updateData
    });
    
    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'SSRF_DOMAIN_UPDATED',
        entityType: 'ssrf_allowlist',
        entityId: id,
        ipAddress: req.ip,
        metadata: {
          domain: existing.domain,
          changes: updateData
        }
      }
    });
    
    logger.info('[EnterpriseSecurity] SSRF domain updated', {
      userId: req.user?.id,
      domainId: id,
      changes: Object.keys(updateData)
    });
    
    res.json({
      success: true,
      data: updatedDomain
    });
  } catch (error) {
    logger.error('[EnterpriseSecurity] Failed to update SSRF domain:', error);
    res.status(500).json({ success: false, error: 'Failed to update SSRF domain' });
  }
});

/**
 * DELETE /api/enterprise-security/ssrf/domains/:id
 * Remove a domain from SSRF allowlist
 */
router.delete('/ssrf/domains/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    
    // Validate UUID
    if (!isValidUUID(id)) {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid domain ID',
        code: 'INVALID_ID'
      });
      return;
    }
    
    // Verify domain exists
    const existing = await prisma.ssrfAllowlistDomain.findUnique({
      where: { id }
    });
    
    if (!existing) {
      res.status(404).json({ 
        success: false, 
        error: 'Domain not found',
        code: 'NOT_FOUND'
      });
      return;
    }
    
    // Delete domain
    await prisma.ssrfAllowlistDomain.delete({
      where: { id }
    });
    
    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'SSRF_DOMAIN_DELETED',
        entityType: 'ssrf_allowlist',
        entityId: id,
        ipAddress: req.ip,
        metadata: {
          domain: existing.domain,
          category: existing.category
        }
      }
    });
    
    logger.info('[EnterpriseSecurity] SSRF domain deleted', {
      userId: req.user?.id,
      domain: existing.domain
    });
    
    res.json({
      success: true,
      message: 'Domain removed from allowlist'
    });
  } catch (error) {
    logger.error('[EnterpriseSecurity] Failed to delete SSRF domain:', error);
    res.status(500).json({ success: false, error: 'Failed to delete SSRF domain' });
  }
});

// ============================================
// PRIVATE IP BLOCKING CONFIGURATION
// ============================================

/**
 * GET /api/enterprise-security/ssrf/blocked-ips
 * Get all blocked IP prefixes/ranges
 */
router.get('/ssrf/blocked-ips', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const blockedIPs = await prisma.ssrfBlockedIP.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { blockEvents: true }
        }
      }
    });
    
    // Get block statistics
    const totalBlocks = await prisma.ssrfBlockEvent.count();
    const last24hBlocks = await prisma.ssrfBlockEvent.count({
      where: {
        timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    });
    
    logger.info('[EnterpriseSecurity] Blocked IPs fetched', {
      userId: req.user?.id,
      totalRules: blockedIPs.length
    });
    
    res.json({
      success: true,
      data: {
        blockedIPs: blockedIPs.map(ip => ({
          ...ip,
          totalBlocks: ip._count.blockEvents
        })),
        analytics: {
          totalRules: blockedIPs.length,
          totalBlocks,
          last24hBlocks
        }
      }
    });
  } catch (error) {
    logger.error('[EnterpriseSecurity] Failed to fetch blocked IPs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch blocked IPs' });
  }
});

/**
 * POST /api/enterprise-security/ssrf/blocked-ips
 * Add a new IP prefix/range to block list
 */
router.post('/ssrf/blocked-ips', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { ipPrefix, reason, category } = req.body;
    
    // Sanitize and validate IP
    const sanitizedIP = sanitizeIPInput(ipPrefix);
    if (!sanitizedIP) {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid IP address or prefix format',
        code: 'INVALID_IP'
      });
      return;
    }
    
    // Validate category
    const validCategories = ['private', 'loopback', 'linklocal', 'cloud_metadata', 'custom'];
    const safeCategory = validCategories.includes(category?.toLowerCase()) 
      ? category.toLowerCase() 
      : 'custom';
    
    // Sanitize reason using comprehensive sanitizer
    const safeReason = sanitizeText(reason, 500) || 'No reason provided';
    
    // Create blocked IP entry (use unique constraint for race condition safety)
    let newBlockedIP;
    try {
      newBlockedIP = await prisma.ssrfBlockedIP.create({
        data: {
          ipPrefix: sanitizedIP,
          reason: safeReason,
          category: safeCategory,
          isActive: true,
          addedBy: req.user?.id || 'system',
          createdAt: new Date()
        }
      });
    } catch (dbError: any) {
      // Handle unique constraint violation (race condition safe)
      if (dbError.code === 'P2002') {
        res.status(409).json({ 
          success: false, 
          error: 'IP prefix already blocked',
          code: 'DUPLICATE_IP'
        });
        return;
      }
      throw dbError;
    }
    
    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'SSRF_IP_BLOCKED',
        entityType: 'ssrf_blocked_ip',
        entityId: newBlockedIP.id,
        ipAddress: req.ip,
        metadata: {
          ipPrefix: sanitizedIP,
          reason: safeReason,
          category: safeCategory
        }
      }
    });
    
    logger.info('[EnterpriseSecurity] IP prefix blocked', {
      userId: req.user?.id,
      ipPrefix: sanitizedIP,
      category: safeCategory
    });
    
    res.status(201).json({
      success: true,
      data: newBlockedIP
    });
  } catch (error) {
    logger.error('[EnterpriseSecurity] Failed to block IP:', error);
    res.status(500).json({ success: false, error: 'Failed to block IP' });
  }
});

/**
 * DELETE /api/enterprise-security/ssrf/blocked-ips/:id
 * Remove an IP prefix from block list
 */
router.delete('/ssrf/blocked-ips/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    
    // Validate UUID
    if (!isValidUUID(id)) {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid ID',
        code: 'INVALID_ID'
      });
      return;
    }
    
    // Verify exists
    const existing = await prisma.ssrfBlockedIP.findUnique({
      where: { id }
    });
    
    if (!existing) {
      res.status(404).json({ 
        success: false, 
        error: 'Blocked IP not found',
        code: 'NOT_FOUND'
      });
      return;
    }
    
    // Delete
    await prisma.ssrfBlockedIP.delete({
      where: { id }
    });
    
    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'SSRF_IP_UNBLOCKED',
        entityType: 'ssrf_blocked_ip',
        entityId: id,
        ipAddress: req.ip,
        metadata: {
          ipPrefix: existing.ipPrefix
        }
      }
    });
    
    logger.info('[EnterpriseSecurity] IP prefix unblocked', {
      userId: req.user?.id,
      ipPrefix: existing.ipPrefix
    });
    
    res.json({
      success: true,
      message: 'IP prefix removed from block list'
    });
  } catch (error) {
    logger.error('[EnterpriseSecurity] Failed to unblock IP:', error);
    res.status(500).json({ success: false, error: 'Failed to unblock IP' });
  }
});

// ============================================
// SECURITY ANALYTICS
// ============================================

/**
 * GET /api/enterprise-security/analytics
 * Get comprehensive security analytics
 */
router.get('/analytics', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Extract and validate timeRange (prevent array pollution)
    const rawTimeRange = getSingleParam(req.query.timeRange) || '24h';
    const validTimeRanges = ['1h', '6h', '24h', '7d', '30d'];
    const timeRange = validTimeRanges.includes(rawTimeRange) ? rawTimeRange : '24h';
    
    // Calculate time range
    const timeRangeMs: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    
    const startTime = new Date(Date.now() - timeRangeMs[timeRange]);
    
    // Get SSRF statistics
    const [
      totalProxyRequests,
      blockedProxyRequests,
      ssrfBlocksByDomain,
      ssrfBlocksByIP,
      recentBlocks
    ] = await Promise.all([
      prisma.ssrfProxyLog.count({
        where: { timestamp: { gte: startTime } }
      }),
      prisma.ssrfProxyLog.count({
        where: { timestamp: { gte: startTime }, blocked: true }
      }),
      prisma.ssrfProxyLog.groupBy({
        by: ['domain'],
        where: { timestamp: { gte: startTime }, blocked: true },
        _count: true,
        orderBy: { _count: { domain: 'desc' } },
        take: 10
      }),
      prisma.ssrfBlockEvent.groupBy({
        by: ['ipPrefix'],
        where: { timestamp: { gte: startTime } },
        _count: true,
        orderBy: { _count: { ipPrefix: 'desc' } },
        take: 10
      }),
      prisma.ssrfProxyLog.findMany({
        where: { timestamp: { gte: startTime }, blocked: true },
        orderBy: { timestamp: 'desc' },
        take: 20,
        select: {
          id: true,
          domain: true,
          ip: true,
          reason: true,
          timestamp: true
        }
      })
    ]);
    
    // Get audit log statistics
    const securityAuditLogs = await prisma.auditLog.findMany({
      where: {
        action: { startsWith: 'SSRF_' },
        createdAt: { gte: startTime }
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        action: true,
        entityType: true,
        userId: true,
        createdAt: true,
        metadata: true
      }
    });
    
    logger.info('[EnterpriseSecurity] Analytics fetched', {
      userId: req.user?.id,
      timeRange
    });
    
    res.json({
      success: true,
      data: {
        timeRange,
        ssrf: {
          totalRequests: totalProxyRequests,
          blockedRequests: blockedProxyRequests,
          blockRate: totalProxyRequests > 0 
            ? ((blockedProxyRequests / totalProxyRequests) * 100).toFixed(2) 
            : '0',
          topBlockedDomains: ssrfBlocksByDomain.map(d => ({
            domain: d.domain,
            count: d._count
          })),
          topBlockedIPs: ssrfBlocksByIP.map(ip => ({
            ipPrefix: ip.ipPrefix,
            count: ip._count
          })),
          recentBlocks
        },
        auditLogs: securityAuditLogs
      }
    });
  } catch (error) {
    logger.error('[EnterpriseSecurity] Failed to fetch analytics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/enterprise-security/audit-logs
 * Get detailed security audit logs
 */
router.get('/audit-logs', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Use getSingleParam to prevent array pollution attacks
    const pageParam = getSingleParam(req.query.page) || '1';
    const limitParam = getSingleParam(req.query.limit) || '50';
    const actionParam = getSingleParam(req.query.action);
    const entityTypeParam = getSingleParam(req.query.entityType);
    
    // Validate and sanitize pagination with strict bounds
    const pageNum = Math.max(1, Math.min(1000, parseInt(pageParam, 10) || 1));
    const limitNum = Math.max(1, Math.min(100, parseInt(limitParam, 10) || 50));
    const skip = (pageNum - 1) * limitNum;
    
    // Build filter with strict sanitization
    const where: any = {};
    
    if (actionParam) {
      // Only allow uppercase letters and underscores for action names
      const sanitizedAction = actionParam.toUpperCase().replace(/[^A-Z_]/g, '').slice(0, 50);
      if (sanitizedAction) {
        where.action = { startsWith: sanitizedAction };
      }
    }
    
    if (entityTypeParam) {
      // Only allow lowercase letters and underscores for entity types
      const sanitizedEntityType = entityTypeParam.toLowerCase().replace(/[^a-z_]/g, '').slice(0, 50);
      if (sanitizedEntityType) {
        where.entityType = sanitizedEntityType;
      }
    }
    
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      }),
      prisma.auditLog.count({ where })
    ]);
    
    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    logger.error('[EnterpriseSecurity] Failed to fetch audit logs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
  }
});

// ============================================
// SECURITY CONFIGURATION
// ============================================

/**
 * GET /api/enterprise-security/config
 * Get enterprise security configuration
 */
router.get('/config', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Get or create config
    let config = await prisma.enterpriseSecurityConfig.findFirst();
    
    if (!config) {
      config = await prisma.enterpriseSecurityConfig.create({
        data: {
          ssrfProtectionEnabled: true,
          privateIPBlockingEnabled: true,
          domainAllowlistEnabled: true,
          strictModeEnabled: false,
          auditLoggingEnabled: true,
          realTimeAlertsEnabled: true,
          maxRequestsPerMinute: 1000,
          blockDuration: 3600,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('[EnterpriseSecurity] Failed to fetch config:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch config' });
  }
});

/**
 * PUT /api/enterprise-security/config
 * Update enterprise security configuration
 */
router.put('/config', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowedFields = [
      'ssrfProtectionEnabled',
      'privateIPBlockingEnabled',
      'domainAllowlistEnabled',
      'strictModeEnabled',
      'auditLoggingEnabled',
      'realTimeAlertsEnabled',
      'maxRequestsPerMinute',
      'blockDuration'
    ];
    
    // Build update data with validation
    const updateData: any = { updatedAt: new Date() };
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field.endsWith('Enabled')) {
          updateData[field] = Boolean(req.body[field]);
        } else if (field === 'maxRequestsPerMinute') {
          const val = parseInt(req.body[field]);
          if (val >= 10 && val <= 100000) {
            updateData[field] = val;
          }
        } else if (field === 'blockDuration') {
          const val = parseInt(req.body[field]);
          if (val >= 60 && val <= 86400 * 30) {
            updateData[field] = val;
          }
        }
      }
    }
    
    // Get existing config
    let config = await prisma.enterpriseSecurityConfig.findFirst();
    
    if (config) {
      config = await prisma.enterpriseSecurityConfig.update({
        where: { id: config.id },
        data: updateData
      });
    } else {
      config = await prisma.enterpriseSecurityConfig.create({
        data: {
          ...updateData,
          ssrfProtectionEnabled: updateData.ssrfProtectionEnabled ?? true,
          privateIPBlockingEnabled: updateData.privateIPBlockingEnabled ?? true,
          domainAllowlistEnabled: updateData.domainAllowlistEnabled ?? true,
          createdAt: new Date()
        }
      });
    }
    
    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'ENTERPRISE_SECURITY_CONFIG_UPDATED',
        entityType: 'enterprise_security_config',
        entityId: config.id,
        ipAddress: req.ip,
        metadata: {
          changes: updateData
        }
      }
    });
    
    logger.info('[EnterpriseSecurity] Config updated', {
      userId: req.user?.id,
      changes: Object.keys(updateData)
    });
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('[EnterpriseSecurity] Failed to update config:', error);
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

export default router;
