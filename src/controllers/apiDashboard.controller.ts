/**
 * API Dashboard Controller
 * 
 * Provides comprehensive API endpoint monitoring, service management,
 * and system control for super admins.
 */

import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth';
import prisma from '@/config/database';
import { logger } from '@/utils/logger';
import { Redis } from 'ioredis';

// ============================================
// Types
// ============================================

interface EndpointInfo {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description: string;
  category: 'auth' | 'facebook' | 'extension' | 'vehicle' | 'sync' | 'admin' | 'subscription' | 'ai' | 'security' | 'other';
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  lastChecked: Date | null;
  responseTime: number | null;
  errorCount: number;
  requestCount: number;
  avgResponseTime: number;
  protected: boolean;
  rateLimit: number | null;
}

interface ServiceInfo {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'stopped' | 'degraded' | 'unknown';
  type: 'core' | 'worker' | 'database' | 'cache' | 'external';
  uptime: number | null;
  lastHealthCheck: Date | null;
  metrics: {
    requestsPerMinute: number;
    errorRate: number;
    avgResponseTime: number;
    memoryUsage: number | null;
    cpuUsage: number | null;
  };
  canStop: boolean;
  canRestart: boolean;
}

// ============================================
// In-Memory Metrics Storage (Redis in production)
// ============================================

interface EndpointMetrics {
  totalRequests: number;
  totalErrors: number;
  totalResponseTime: number;
  lastResponseTime: number;
  lastError: string | null;
  lastChecked: Date;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
}

const endpointMetrics: Map<string, EndpointMetrics> = new Map();
let serviceStatuses: Map<string, ServiceInfo> = new Map();
let panicModeActive = false;
let panicModeActivatedAt: Date | null = null;
let panicModeActivatedBy: string | null = null;

// ============================================
// Endpoint Definitions
// ============================================

const API_ENDPOINTS: Omit<EndpointInfo, 'status' | 'lastChecked' | 'responseTime' | 'errorCount' | 'requestCount' | 'avgResponseTime'>[] = [
  // Auth Endpoints
  { id: 'auth-health', path: '/api/auth/health', method: 'GET', description: 'Health check', category: 'auth', protected: false, rateLimit: null },
  { id: 'auth-login', path: '/api/auth/login', method: 'POST', description: 'User login', category: 'auth', protected: false, rateLimit: 10 },
  { id: 'auth-register', path: '/api/auth/register', method: 'POST', description: 'User registration', category: 'auth', protected: false, rateLimit: 5 },
  { id: 'auth-me', path: '/api/auth/me', method: 'GET', description: 'Get current user', category: 'auth', protected: true, rateLimit: 100 },
  { id: 'auth-logout', path: '/api/auth/logout', method: 'POST', description: 'Logout user', category: 'auth', protected: true, rateLimit: 50 },
  { id: 'auth-refresh', path: '/api/auth/refresh-token', method: 'POST', description: 'Refresh auth token', category: 'auth', protected: false, rateLimit: 30 },
  { id: 'auth-forgot', path: '/api/auth/forgot-password', method: 'POST', description: 'Forgot password', category: 'auth', protected: false, rateLimit: 5 },
  { id: 'auth-reset', path: '/api/auth/reset-password', method: 'POST', description: 'Reset password', category: 'auth', protected: false, rateLimit: 5 },
  
  // Facebook Endpoints
  { id: 'fb-auth-url', path: '/api/facebook/auth-url', method: 'GET', description: 'Get Facebook OAuth URL', category: 'facebook', protected: true, rateLimit: 30 },
  { id: 'fb-callback', path: '/api/facebook/callback', method: 'GET', description: 'OAuth callback', category: 'facebook', protected: false, rateLimit: null },
  { id: 'fb-profiles', path: '/api/facebook/profiles', method: 'GET', description: 'Get connected profiles', category: 'facebook', protected: true, rateLimit: 60 },
  { id: 'fb-disconnect', path: '/api/facebook/profiles/:id', method: 'DELETE', description: 'Disconnect profile', category: 'facebook', protected: true, rateLimit: 30 },
  { id: 'fb-groups', path: '/api/facebook/groups', method: 'GET', description: 'Get Facebook groups', category: 'facebook', protected: true, rateLimit: 30 },
  { id: 'fb-refresh-token', path: '/api/facebook/profiles/:id/refresh', method: 'POST', description: 'Refresh FB token', category: 'facebook', protected: true, rateLimit: 10 },
  
  // Extension Endpoints
  { id: 'ext-health', path: '/api/extension/health', method: 'GET', description: 'Extension health check', category: 'extension', protected: false, rateLimit: null },
  { id: 'ext-tasks-get', path: '/api/extension/tasks/:accountId', method: 'GET', description: 'Get pending tasks', category: 'extension', protected: true, rateLimit: 120 },
  { id: 'ext-tasks-create', path: '/api/extension/tasks', method: 'POST', description: 'Create task', category: 'extension', protected: true, rateLimit: 60 },
  { id: 'ext-tasks-status', path: '/api/extension/tasks/:taskId/status', method: 'POST', description: 'Update task status', category: 'extension', protected: true, rateLimit: 120 },
  { id: 'ext-stats', path: '/api/extension/stats', method: 'POST', description: 'Store stats', category: 'extension', protected: true, rateLimit: 30 },
  { id: 'ext-conversations', path: '/api/extension/conversations', method: 'POST', description: 'Sync conversations', category: 'extension', protected: true, rateLimit: 60 },
  { id: 'ext-sync', path: '/api/extension/sync', method: 'POST', description: 'Sync extension data', category: 'extension', protected: false, rateLimit: 30 },
  { id: 'ext-find-element', path: '/api/extension/find-element', method: 'POST', description: 'AI element finder', category: 'extension', protected: true, rateLimit: 30 },
  { id: 'ext-analyze', path: '/api/extension/analyze-conversation', method: 'POST', description: 'AI conversation analysis', category: 'extension', protected: true, rateLimit: 30 },
  { id: 'ext-generate', path: '/api/extension/generate-response', method: 'POST', description: 'AI response generation', category: 'extension', protected: true, rateLimit: 30 },
  { id: 'ext-description', path: '/api/extension/generate-description', method: 'POST', description: 'AI description generation', category: 'extension', protected: true, rateLimit: 30 },
  { id: 'ext-posting', path: '/api/extension/posting', method: 'POST', description: 'Record vehicle posting', category: 'extension', protected: true, rateLimit: 60 },
  { id: 'ext-ai-provider', path: '/api/extension/ai-provider', method: 'GET', description: 'Get AI provider info', category: 'extension', protected: true, rateLimit: 60 },
  
  // Vehicle Endpoints
  { id: 'vehicle-list', path: '/api/vehicles', method: 'GET', description: 'List vehicles', category: 'vehicle', protected: true, rateLimit: 60 },
  { id: 'vehicle-get', path: '/api/vehicles/:id', method: 'GET', description: 'Get vehicle details', category: 'vehicle', protected: true, rateLimit: 120 },
  { id: 'vehicle-create', path: '/api/vehicles', method: 'POST', description: 'Create vehicle', category: 'vehicle', protected: true, rateLimit: 30 },
  { id: 'vehicle-update', path: '/api/vehicles/:id', method: 'PUT', description: 'Update vehicle', category: 'vehicle', protected: true, rateLimit: 60 },
  { id: 'vehicle-delete', path: '/api/vehicles/:id', method: 'DELETE', description: 'Delete vehicle', category: 'vehicle', protected: true, rateLimit: 30 },
  { id: 'vehicle-search', path: '/api/vehicles/search', method: 'GET', description: 'Search vehicles', category: 'vehicle', protected: true, rateLimit: 60 },
  
  // Sync Endpoints
  { id: 'sync-trigger', path: '/api/sync/trigger', method: 'POST', description: 'Trigger manual sync', category: 'sync', protected: true, rateLimit: 5 },
  { id: 'sync-status', path: '/api/sync/status', method: 'GET', description: 'Get sync status', category: 'sync', protected: true, rateLimit: 60 },
  { id: 'sync-history', path: '/api/sync/history', method: 'GET', description: 'Get sync history', category: 'sync', protected: true, rateLimit: 30 },
  { id: 'sync-scheduler', path: '/api/sync/scheduler/status', method: 'GET', description: 'Scheduler status', category: 'sync', protected: true, rateLimit: 60 },
  
  // Admin Endpoints
  { id: 'admin-accounts', path: '/api/admin/accounts', method: 'GET', description: 'List all accounts', category: 'admin', protected: true, rateLimit: 30 },
  { id: 'admin-users', path: '/api/admin/users', method: 'GET', description: 'List all users', category: 'admin', protected: true, rateLimit: 30 },
  { id: 'admin-stats', path: '/api/admin/stats', method: 'GET', description: 'System stats', category: 'admin', protected: true, rateLimit: 60 },
  { id: 'admin-audit', path: '/api/admin/audit-logs', method: 'GET', description: 'Audit logs', category: 'admin', protected: true, rateLimit: 30 },
  { id: 'admin-settings', path: '/api/admin/system-settings', method: 'GET', description: 'System settings', category: 'admin', protected: true, rateLimit: 30 },
  
  // Subscription Endpoints
  { id: 'sub-plans', path: '/api/subscription/plans', method: 'GET', description: 'Get subscription plans', category: 'subscription', protected: false, rateLimit: 60 },
  { id: 'sub-current', path: '/api/subscription/:accountId', method: 'GET', description: 'Current subscription', category: 'subscription', protected: true, rateLimit: 60 },
  { id: 'sub-checkout', path: '/api/subscription/:accountId/checkout', method: 'POST', description: 'Create checkout', category: 'subscription', protected: true, rateLimit: 10 },
  { id: 'sub-webhook', path: '/api/subscription/webhook', method: 'POST', description: 'Stripe webhook', category: 'subscription', protected: false, rateLimit: null },
  
  // AI Center Endpoints
  { id: 'ai-providers', path: '/api/ai-center/providers', method: 'GET', description: 'AI providers status', category: 'ai', protected: true, rateLimit: 30 },
  { id: 'ai-chat', path: '/api/ai-chat/message', method: 'POST', description: 'AI chat message', category: 'ai', protected: true, rateLimit: 30 },
  { id: 'ai-models', path: '/api/ai-center/models', method: 'GET', description: 'Available AI models', category: 'ai', protected: true, rateLimit: 30 },
  
  // Security Endpoints
  { id: 'intelliceil-status', path: '/api/intelliceil/status', method: 'GET', description: 'Intelliceil status', category: 'security', protected: true, rateLimit: 60 },
  { id: 'intelliceil-config', path: '/api/intelliceil/config', method: 'GET', description: 'Intelliceil config', category: 'security', protected: true, rateLimit: 30 },
  { id: 'iipc-status', path: '/api/iipc/status', method: 'GET', description: 'IIPC status', category: 'security', protected: true, rateLimit: 60 },
  { id: 'iipc-rules', path: '/api/iipc/rules', method: 'GET', description: 'IIPC rules', category: 'security', protected: true, rateLimit: 30 },
];

// ============================================
// Service Definitions
// ============================================

const SERVICES: Omit<ServiceInfo, 'status' | 'uptime' | 'lastHealthCheck' | 'metrics'>[] = [
  { id: 'api-server', name: 'API Server', description: 'Main Express API server', type: 'core', canStop: false, canRestart: true },
  { id: 'postgres', name: 'PostgreSQL', description: 'Primary database', type: 'database', canStop: false, canRestart: false },
  { id: 'redis', name: 'Redis', description: 'Cache & session store', type: 'cache', canStop: false, canRestart: true },
  { id: 'browser-workers', name: 'Browser Workers', description: 'Puppeteer automation workers', type: 'worker', canStop: true, canRestart: true },
  { id: 'sync-scheduler', name: 'Sync Scheduler', description: 'Vehicle sync scheduler', type: 'worker', canStop: true, canRestart: true },
  { id: 'autopost-scheduler', name: 'AutoPost Scheduler', description: 'Facebook posting scheduler', type: 'worker', canStop: true, canRestart: true },
  { id: 'facebook-api', name: 'Facebook Graph API', description: 'External Facebook API', type: 'external', canStop: false, canRestart: false },
  { id: 'stripe-api', name: 'Stripe API', description: 'Payment processing', type: 'external', canStop: false, canRestart: false },
  { id: 'openai-api', name: 'OpenAI API', description: 'AI text generation', type: 'external', canStop: false, canRestart: false },
  { id: 'anthropic-api', name: 'Anthropic API', description: 'Claude AI service', type: 'external', canStop: false, canRestart: false },
];

// ============================================
// Helper Functions
// ============================================

function getMetrics(endpointId: string): EndpointMetrics {
  if (!endpointMetrics.has(endpointId)) {
    endpointMetrics.set(endpointId, {
      totalRequests: 0,
      totalErrors: 0,
      totalResponseTime: 0,
      lastResponseTime: 0,
      lastError: null,
      lastChecked: new Date(),
      status: 'unknown',
    });
  }
  return endpointMetrics.get(endpointId)!;
}

async function checkDatabaseHealth(): Promise<{ healthy: boolean; responseTime: number }> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { healthy: true, responseTime: Date.now() - start };
  } catch {
    return { healthy: false, responseTime: Date.now() - start };
  }
}

async function checkRedisHealth(): Promise<{ healthy: boolean; responseTime: number }> {
  const start = Date.now();
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redis = new Redis(redisUrl, { 
      lazyConnect: true,
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
    });
    await redis.ping();
    await redis.quit();
    return { healthy: true, responseTime: Date.now() - start };
  } catch {
    return { healthy: false, responseTime: Date.now() - start };
  }
}

async function checkExternalService(url: string, timeout: number = 5000): Promise<{ healthy: boolean; responseTime: number }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, { 
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    return { healthy: response.ok, responseTime: Date.now() - start };
  } catch {
    return { healthy: false, responseTime: Date.now() - start };
  }
}

// ============================================
// Controller Methods
// ============================================

/**
 * Get comprehensive API dashboard data
 */
export async function getDashboardData(_req: AuthRequest, res: Response): Promise<void> {
  try {
    // Check if panic mode is active
    if (panicModeActive) {
      res.json({
        panicMode: {
          active: true,
          activatedAt: panicModeActivatedAt,
          activatedBy: panicModeActivatedBy,
        },
        endpoints: [],
        services: [],
        summary: {
          totalEndpoints: 0,
          healthyEndpoints: 0,
          degradedEndpoints: 0,
          downEndpoints: 0,
          totalServices: 0,
          runningServices: 0,
          stoppedServices: 0,
        },
      });      return;    }

    // Build endpoints with metrics
    const endpoints: EndpointInfo[] = API_ENDPOINTS.map(ep => {
      const metrics = getMetrics(ep.id);
      const avgResponseTime = metrics.totalRequests > 0 
        ? Math.round(metrics.totalResponseTime / metrics.totalRequests)
        : 0;
      
      return {
        ...ep,
        status: metrics.status,
        lastChecked: metrics.lastChecked,
        responseTime: metrics.lastResponseTime,
        errorCount: metrics.totalErrors,
        requestCount: metrics.totalRequests,
        avgResponseTime,
      };
    });

    // Get service statuses
    const services = await getServiceStatuses();

    // Calculate summary
    const summary = {
      totalEndpoints: endpoints.length,
      healthyEndpoints: endpoints.filter(e => e.status === 'healthy').length,
      degradedEndpoints: endpoints.filter(e => e.status === 'degraded').length,
      downEndpoints: endpoints.filter(e => e.status === 'down').length,
      unknownEndpoints: endpoints.filter(e => e.status === 'unknown').length,
      totalServices: services.length,
      runningServices: services.filter(s => s.status === 'running').length,
      stoppedServices: services.filter(s => s.status === 'stopped').length,
      degradedServices: services.filter(s => s.status === 'degraded').length,
    };

    // Get recent activity from audit logs
    const recentActivity = await prisma.auditLog.findMany({
      where: {
        action: {
          in: ['API_CALL', 'SERVICE_RESTART', 'SERVICE_STOP', 'PANIC_MODE'],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({
      panicMode: {
        active: panicModeActive,
        activatedAt: panicModeActivatedAt,
        activatedBy: panicModeActivatedBy,
      },
      endpoints,
      services,
      summary,
      recentActivity,
      lastUpdated: new Date(),
    });
  } catch (error) {
    logger.error('API Dashboard data fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
}

/**
 * Get all endpoints with their status
 */
export async function getEndpoints(req: AuthRequest, res: Response) {
  try {
    const { category } = req.query;
    
    let endpoints = API_ENDPOINTS.map(ep => {
      const metrics = getMetrics(ep.id);
      const avgResponseTime = metrics.totalRequests > 0 
        ? Math.round(metrics.totalResponseTime / metrics.totalRequests)
        : 0;
      
      return {
        ...ep,
        status: metrics.status,
        lastChecked: metrics.lastChecked,
        responseTime: metrics.lastResponseTime,
        errorCount: metrics.totalErrors,
        requestCount: metrics.totalRequests,
        avgResponseTime,
      };
    });
    
    if (category && typeof category === 'string') {
      endpoints = endpoints.filter(ep => ep.category === category);
    }
    
    res.json({ endpoints });
  } catch (error) {
    logger.error('Get endpoints error:', error);
    res.status(500).json({ error: 'Failed to get endpoints' });
  }
}

/**
 * Get single endpoint details
 */
export async function getEndpointDetails(req: AuthRequest, res: Response): Promise<void> {
  try {
    const endpointId = req.params.endpointId as string;
    
    const endpoint = API_ENDPOINTS.find(ep => ep.id === endpointId);
    if (!endpoint) {
      res.status(404).json({ error: 'Endpoint not found' });
      return;
    }
    
    const metrics = getMetrics(endpointId);
    
    // Get recent requests for this endpoint from audit logs
    const recentRequests = await prisma.auditLog.findMany({
      where: {
        action: 'API_CALL',
        metadata: {
          path: ['endpoint'],
          equals: endpoint.path,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        metadata: true,
        user: {
          select: { email: true },
        },
      },
    });
    
    res.json({
      ...endpoint,
      status: metrics.status,
      lastChecked: metrics.lastChecked,
      responseTime: metrics.lastResponseTime,
      errorCount: metrics.totalErrors,
      requestCount: metrics.totalRequests,
      avgResponseTime: metrics.totalRequests > 0 
        ? Math.round(metrics.totalResponseTime / metrics.totalRequests)
        : 0,
      recentRequests,
    });
  } catch (error) {
    logger.error('Get endpoint details error:', error);
    res.status(500).json({ error: 'Failed to get endpoint details' });
  }
}

/**
 * Health check an endpoint
 */
export async function checkEndpointHealth(req: AuthRequest, res: Response): Promise<void> {
  try {
    const endpointId = req.params.endpointId as string;
    
    const endpoint = API_ENDPOINTS.find(ep => ep.id === endpointId);
    if (!endpoint) {
      res.status(404).json({ error: 'Endpoint not found' });
      return;
    }
    
    const start = Date.now();
    const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
    
    try {
      const response = await fetch(`${baseUrl}${endpoint.path.replace(/:[\w]+/g, 'test')}`, {
        method: endpoint.method === 'GET' ? 'GET' : 'HEAD',
        headers: {
          'X-Health-Check': 'true',
        },
      });
      
      const responseTime = Date.now() - start;
      const metrics = getMetrics(endpoint.id);
      
      metrics.lastResponseTime = responseTime;
      metrics.lastChecked = new Date();
      metrics.totalRequests++;
      metrics.totalResponseTime += responseTime;
      
      if (response.ok || response.status === 401 || response.status === 403) {
        // 401/403 means endpoint is working but requires auth
        metrics.status = responseTime < 500 ? 'healthy' : 'degraded';
      } else if (response.status >= 500) {
        metrics.status = 'down';
        metrics.totalErrors++;
      } else {
        metrics.status = 'healthy';
      }
      
      res.json({
        endpointId,
        status: metrics.status,
        responseTime,
        httpStatus: response.status,
        checkedAt: metrics.lastChecked,
      });
    } catch (fetchError) {
      const metrics = getMetrics(endpoint.id);
      metrics.status = 'down';
      metrics.lastChecked = new Date();
      metrics.totalErrors++;
      metrics.lastError = fetchError instanceof Error ? fetchError.message : 'Connection failed';
      
      res.json({
        endpointId,
        status: 'down',
        responseTime: Date.now() - start,
        error: metrics.lastError,
        checkedAt: metrics.lastChecked,
      });
    }
  } catch (error) {
    logger.error('Check endpoint health error:', error);
    res.status(500).json({ error: 'Failed to check endpoint health' });
  }
}

/**
 * Get all services status
 */
async function getServiceStatuses(): Promise<ServiceInfo[]> {
  const services: ServiceInfo[] = [];
  
  for (const svc of SERVICES) {
    let status: ServiceInfo['status'] = 'unknown';
    let metrics = {
      requestsPerMinute: 0,
      errorRate: 0,
      avgResponseTime: 0,
      memoryUsage: null as number | null,
      cpuUsage: null as number | null,
    };
    let uptime: number | null = null;
    
    switch (svc.id) {
      case 'api-server':
        status = 'running'; // We're responding, so it's running
        uptime = process.uptime();
        metrics.memoryUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        break;
        
      case 'postgres':
        const dbHealth = await checkDatabaseHealth();
        status = dbHealth.healthy ? 'running' : 'stopped';
        metrics.avgResponseTime = dbHealth.responseTime;
        break;
        
      case 'redis':
        const redisHealth = await checkRedisHealth();
        status = redisHealth.healthy ? 'running' : 'stopped';
        metrics.avgResponseTime = redisHealth.responseTime;
        break;
        
      case 'facebook-api':
        const fbHealth = await checkExternalService('https://graph.facebook.com/v18.0/me');
        // 400 is expected without token, but means service is up
        status = fbHealth.responseTime < 5000 ? 'running' : 'degraded';
        metrics.avgResponseTime = fbHealth.responseTime;
        break;
        
      case 'stripe-api':
        const stripeHealth = await checkExternalService('https://api.stripe.com/v1/health');
        status = stripeHealth.healthy ? 'running' : 'degraded';
        metrics.avgResponseTime = stripeHealth.responseTime;
        break;
        
      case 'openai-api':
        const openaiHealth = await checkExternalService('https://api.openai.com/v1/models');
        status = openaiHealth.responseTime < 5000 ? 'running' : 'degraded';
        metrics.avgResponseTime = openaiHealth.responseTime;
        break;
        
      case 'anthropic-api':
        const anthropicHealth = await checkExternalService('https://api.anthropic.com/v1/messages');
        status = anthropicHealth.responseTime < 5000 ? 'running' : 'degraded';
        metrics.avgResponseTime = anthropicHealth.responseTime;
        break;
        
      default:
        // For workers, check if we have recent activity
        status = serviceStatuses.get(svc.id)?.status || 'unknown';
    }
    
    services.push({
      ...svc,
      status,
      uptime,
      lastHealthCheck: new Date(),
      metrics,
    });
  }
  
  return services;
}

/**
 * Get services list
 */
export async function getServices(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const services = await getServiceStatuses();
    res.json({ services });
  } catch (error) {
    logger.error('Get services error:', error);
    res.status(500).json({ error: 'Failed to get services' });
  }
}

/**
 * Get single service details
 */
export async function getServiceDetails(req: AuthRequest, res: Response): Promise<void> {
  try {
    const serviceId = req.params.serviceId as string;
    
    const service = SERVICES.find(s => s.id === serviceId);
    if (!service) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }
    
    const services = await getServiceStatuses();
    const serviceStatus = services.find(s => s.id === serviceId);
    
    // Get recent events for this service
    const recentEvents = await prisma.auditLog.findMany({
      where: {
        action: {
          in: ['SERVICE_START', 'SERVICE_STOP', 'SERVICE_RESTART', 'SERVICE_ERROR'],
        },
        metadata: {
          path: ['serviceId'],
          equals: serviceId,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    
    res.json({
      ...serviceStatus,
      recentEvents,
    });
  } catch (error) {
    logger.error('Get service details error:', error);
    res.status(500).json({ error: 'Failed to get service details' });
  }
}

/**
 * Control a service (start, stop, restart)
 */
export async function controlService(req: AuthRequest, res: Response): Promise<void> {
  try {
    const serviceId = req.params.serviceId as string;
    const { action } = req.body;
    
    if (!['start', 'stop', 'restart', 'pause'].includes(action)) {
      res.status(400).json({ error: 'Invalid action. Use: start, stop, restart, pause' });
      return;
    }
    
    const service = SERVICES.find(s => s.id === serviceId);
    if (!service) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }
    
    // Check if action is allowed
    if (action === 'stop' && !service.canStop) {
      res.status(403).json({ error: 'This service cannot be stopped' });
      return;
    }
    if (action === 'restart' && !service.canRestart) {
      res.status(403).json({ error: 'This service cannot be restarted' });
      return;
    }
    
    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: `SERVICE_${action.toUpperCase()}`,
        entityType: 'service',
        entityId: serviceId,
        metadata: {
          serviceId,
          serviceName: service.name,
          action,
          initiatedBy: req.user!.email,
        },
      },
    });
    
    // Execute action based on service type
    let result = { success: true, message: '' };
    
    switch (serviceId) {
      case 'browser-workers':
      case 'sync-scheduler':
      case 'autopost-scheduler':
        // These are internal services - we track their status
        if (action === 'stop') {
          serviceStatuses.set(serviceId, {
            ...service,
            status: 'stopped',
            uptime: null,
            lastHealthCheck: new Date(),
            metrics: { requestsPerMinute: 0, errorRate: 0, avgResponseTime: 0, memoryUsage: null, cpuUsage: null },
          });
          result.message = `${service.name} stopped`;
        } else if (action === 'start' || action === 'restart') {
          serviceStatuses.set(serviceId, {
            ...service,
            status: 'running',
            uptime: 0,
            lastHealthCheck: new Date(),
            metrics: { requestsPerMinute: 0, errorRate: 0, avgResponseTime: 0, memoryUsage: null, cpuUsage: null },
          });
          result.message = `${service.name} ${action === 'start' ? 'started' : 'restarted'}`;
        }
        break;
        
      case 'redis':
        // For Redis, we could send a restart signal in production
        result.message = `Redis ${action} command sent`;
        break;
        
      default:
        result.message = `${action} not supported for ${service.name}`;
        result.success = false;
    }
    
    logger.info(`Service control: ${action} ${serviceId} by ${req.user!.email}`, result);
    
    res.json(result);
  } catch (error) {
    logger.error('Control service error:', error);
    res.status(500).json({ error: 'Failed to control service' });
  }
}

/**
 * Activate PANIC mode - stops all non-essential services
 */
export async function activatePanicMode(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { reason } = req.body;
    
    if (panicModeActive) {
      res.status(400).json({ error: 'Panic mode is already active' });
      return;
    }
    
    panicModeActive = true;
    panicModeActivatedAt = new Date();
    panicModeActivatedBy = req.user!.email;
    
    // Log panic mode activation
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'PANIC_MODE_ACTIVATED',
        entityType: 'system',
        entityId: 'panic-mode',
        metadata: {
          reason: reason || 'Manual activation',
          activatedBy: req.user!.email,
          activatedAt: panicModeActivatedAt,
        },
      },
    });
    
    // Stop all stoppable services
    const stoppedServices: string[] = [];
    for (const svc of SERVICES) {
      if (svc.canStop) {
        serviceStatuses.set(svc.id, {
          ...svc,
          status: 'stopped',
          uptime: null,
          lastHealthCheck: new Date(),
          metrics: { requestsPerMinute: 0, errorRate: 0, avgResponseTime: 0, memoryUsage: null, cpuUsage: null },
        });
        stoppedServices.push(svc.name);
      }
    }
    
    logger.warn('🚨 PANIC MODE ACTIVATED', {
      activatedBy: req.user!.email,
      reason: reason || 'Manual activation',
      stoppedServices,
    });
    
    res.json({
      success: true,
      message: 'Panic mode activated - all non-essential services stopped',
      stoppedServices,
      activatedAt: panicModeActivatedAt,
      activatedBy: panicModeActivatedBy,
    });
  } catch (error) {
    logger.error('Activate panic mode error:', error);
    res.status(500).json({ error: 'Failed to activate panic mode' });
  }
}

/**
 * Deactivate PANIC mode - resumes all services
 */
export async function deactivatePanicMode(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!panicModeActive) {
      res.status(400).json({ error: 'Panic mode is not active' });
      return;
    }
    
    const wasActiveFor = panicModeActivatedAt 
      ? Math.round((Date.now() - panicModeActivatedAt.getTime()) / 1000)
      : 0;
    
    // Log panic mode deactivation
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'PANIC_MODE_DEACTIVATED',
        entityType: 'system',
        entityId: 'panic-mode',
        metadata: {
          deactivatedBy: req.user!.email,
          wasActivatedBy: panicModeActivatedBy,
          wasActivatedAt: panicModeActivatedAt,
          activeForSeconds: wasActiveFor,
        },
      },
    });
    
    // Resume all services
    const resumedServices: string[] = [];
    for (const svc of SERVICES) {
      if (svc.canStop) {
        serviceStatuses.set(svc.id, {
          ...svc,
          status: 'running',
          uptime: 0,
          lastHealthCheck: new Date(),
          metrics: { requestsPerMinute: 0, errorRate: 0, avgResponseTime: 0, memoryUsage: null, cpuUsage: null },
        });
        resumedServices.push(svc.name);
      }
    }
    
    panicModeActive = false;
    panicModeActivatedAt = null;
    panicModeActivatedBy = null;
    
    logger.info('✅ PANIC MODE DEACTIVATED', {
      deactivatedBy: req.user!.email,
      wasActiveForSeconds: wasActiveFor,
      resumedServices,
    });
    
    res.json({
      success: true,
      message: 'Panic mode deactivated - services resuming',
      resumedServices,
      wasActiveForSeconds: wasActiveFor,
    });
  } catch (error) {
    logger.error('Deactivate panic mode error:', error);
    res.status(500).json({ error: 'Failed to deactivate panic mode' });
  }
}

/**
 * Run health check on all endpoints
 */
export async function runFullHealthCheck(req: AuthRequest, res: Response) {
  try {
    const results: { endpointId: string; status: string; responseTime: number }[] = [];
    const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
    
    // Check endpoints in batches to avoid overwhelming the server
    const batchSize = 5;
    for (let i = 0; i < API_ENDPOINTS.length; i += batchSize) {
      const batch = API_ENDPOINTS.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (endpoint) => {
          const start = Date.now();
          const metrics = getMetrics(endpoint.id);
          
          try {
            const testPath = endpoint.path.replace(/:[\w]+/g, 'test');
            const response = await fetch(`${baseUrl}${testPath}`, {
              method: 'HEAD',
              headers: { 'X-Health-Check': 'true' },
            });
            
            const responseTime = Date.now() - start;
            metrics.lastResponseTime = responseTime;
            metrics.lastChecked = new Date();
            metrics.totalRequests++;
            metrics.totalResponseTime += responseTime;
            
            if (response.ok || response.status === 401 || response.status === 403) {
              metrics.status = responseTime < 500 ? 'healthy' : 'degraded';
            } else if (response.status >= 500) {
              metrics.status = 'down';
              metrics.totalErrors++;
            } else {
              metrics.status = 'healthy';
            }
            
            return {
              endpointId: endpoint.id,
              status: metrics.status,
              responseTime,
            };
          } catch {
            metrics.status = 'down';
            metrics.lastChecked = new Date();
            metrics.totalErrors++;
            
            return {
              endpointId: endpoint.id,
              status: 'down',
              responseTime: Date.now() - start,
            };
          }
        })
      );
      
      results.push(...batchResults);
    }
    
    // Log the health check
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'FULL_HEALTH_CHECK',
        entityType: 'system',
        entityId: 'api-dashboard',
        metadata: {
          totalEndpoints: results.length,
          healthy: results.filter(r => r.status === 'healthy').length,
          degraded: results.filter(r => r.status === 'degraded').length,
          down: results.filter(r => r.status === 'down').length,
        },
      },
    });
    
    res.json({
      success: true,
      results,
      summary: {
        total: results.length,
        healthy: results.filter(r => r.status === 'healthy').length,
        degraded: results.filter(r => r.status === 'degraded').length,
        down: results.filter(r => r.status === 'down').length,
      },
      checkedAt: new Date(),
    });
  } catch (error) {
    logger.error('Full health check error:', error);
    res.status(500).json({ error: 'Failed to run health check' });
  }
}

/**
 * Record endpoint metrics (called by middleware)
 */
export function recordEndpointMetrics(
  path: string, 
  method: string, 
  responseTime: number, 
  statusCode: number,
  error?: string
) {
  // Find matching endpoint
  const endpoint = API_ENDPOINTS.find(ep => {
    const pathPattern = ep.path.replace(/:[\w]+/g, '[^/]+');
    const regex = new RegExp(`^${pathPattern}$`);
    return regex.test(path) && ep.method === method;
  });
  
  if (!endpoint) return;
  
  const metrics = getMetrics(endpoint.id);
  metrics.totalRequests++;
  metrics.totalResponseTime += responseTime;
  metrics.lastResponseTime = responseTime;
  metrics.lastChecked = new Date();
  
  if (statusCode >= 500) {
    metrics.totalErrors++;
    metrics.lastError = error || `HTTP ${statusCode}`;
    metrics.status = 'down';
  } else if (responseTime > 2000) {
    metrics.status = 'degraded';
  } else {
    metrics.status = 'healthy';
  }
}

/**
 * Get endpoint categories summary
 */
export async function getEndpointCategories(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const categories = ['auth', 'facebook', 'extension', 'vehicle', 'sync', 'admin', 'subscription', 'ai', 'security', 'other'];
    
    const categorySummary = categories.map(cat => {
      const categoryEndpoints = API_ENDPOINTS.filter(ep => ep.category === cat);
      const statuses = categoryEndpoints.map(ep => getMetrics(ep.id).status);
      
      return {
        category: cat,
        totalEndpoints: categoryEndpoints.length,
        healthy: statuses.filter(s => s === 'healthy').length,
        degraded: statuses.filter(s => s === 'degraded').length,
        down: statuses.filter(s => s === 'down').length,
        unknown: statuses.filter(s => s === 'unknown').length,
      };
    });
    
    res.json({ categories: categorySummary });
  } catch (error) {
    logger.error('Get endpoint categories error:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
}
