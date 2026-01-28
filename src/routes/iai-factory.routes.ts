/**
 * IAI Factory Routes v2.3.0
 * 
 * Three-Class Soldier Architecture:
 * - IAI Soldiers: User-side Chrome extension, includes USM (Ultra Speed Mode)
 * - IAI Stealth Soldiers: Chromium-based, invisible, human-like patterns
 * - NOVA Soldiers: Peak automation, full AI integration
 * 
 * API endpoints for IAI Blueprint management, instance spawning, 
 * connection builder persistence, and predefined templates.
 * 
 * ⚠️ SECURITY: These routes control IAI creation - SUPER_ADMIN only.
 */

import { Router, Response, NextFunction } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { 
  iaiFactoryService,
  BLUEPRINT_TYPES,
  type SoldierGenre,
  type ExecutionSource,
  type SoldierMode,
} from '../services/iai-factory.service';
import {
  sanitizeString,
  sanitizeUUID,
  sanitizeInteger,
  sanitizeBoolean,
  sanitizeJSON,
  getRealIP,
  getUserAgent,
  createAuditLog,
  isSuperAdmin,
} from '../utils/admin-security';

const router = Router();

// ============================================
// v2.3.0 Classification Constants
// ============================================
const VALID_GENRES: SoldierGenre[] = ['SOLDIER', 'STEALTH', 'NOVA'];
const VALID_SOURCES: ExecutionSource[] = ['EXTENSION', 'CHROMIUM'];
const VALID_MODES: SoldierMode[] = ['USM', 'STEALTH', 'HYBRID', 'NOVA_AI'];
const ALLOWED_BLUEPRINT_TYPES = ['STANDARD', 'USM', 'STEALTH', 'HYBRID', 'NOVA', 'CUSTOM'] as const;

// ============================================
// SECURITY: Authenticate ALL requests first
// ============================================
router.use(authenticate);

// ============================================
// SECURITY: Require SUPER_ADMIN for ALL routes
// ============================================
router.use((req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    logger.warn('[IAI_FACTORY_SECURITY] Unauthenticated access attempt', {
      path: req.path,
      ip: getRealIP(req),
    });
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  if (!isSuperAdmin(req)) {
    logger.warn('[IAI_FACTORY_SECURITY] Non-admin access attempt blocked', {
      userId: req.user.id,
      role: req.user.role,
      path: req.path,
      method: req.method,
      ip: getRealIP(req),
    });
    
    createAuditLog({
      userId: req.user.id,
      action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      resource: 'iai_factory',
      ipAddress: getRealIP(req),
      userAgent: getUserAgent(req),
      success: false,
      errorMessage: 'Non-super-admin attempted to access IAI factory routes',
      metadata: {
        path: req.path,
        method: req.method,
        userRole: req.user.role,
      }
    });
    
    return res.status(403).json({ 
      success: false, 
      error: 'Super Admin access required',
      code: 'FORBIDDEN'
    });
  }
  
  next();
  return;
});

// Helper for async route handlers
const asyncHandler = (fn: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>) => 
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// ============================================
// Factory Stats
// ============================================

router.get('/stats', asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  const stats = await iaiFactoryService.getFactoryStats();
  res.json({ success: true, stats });
  return;
}));

// ============================================
// Blueprint Routes (v2.3.0 Classification support)
// ============================================

router.get('/blueprints', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const isActive = sanitizeBoolean(req.query.isActive);
  const type = sanitizeString(req.query.type, 50);
  const limit = sanitizeInteger(req.query.limit, 1, 100) ?? 50;
  const offset = sanitizeInteger(req.query.offset, 0) ?? 0;
  
  // v2.3.0 Classification filters
  const genre = sanitizeString(req.query.genre, 20) as SoldierGenre | undefined;
  const source = sanitizeString(req.query.source, 20) as ExecutionSource | undefined;
  const mode = sanitizeString(req.query.mode, 20) as SoldierMode | undefined;
  const accountId = sanitizeUUID(req.query.accountId);

  const blueprints = await iaiFactoryService.listBlueprints({ 
    isActive, 
    type: type as typeof BLUEPRINT_TYPES[number] | undefined, 
    genre: genre && VALID_GENRES.includes(genre) ? genre : undefined,
    source: source && VALID_SOURCES.includes(source) ? source : undefined,
    mode: mode && VALID_MODES.includes(mode) ? mode : undefined,
    accountId,
    limit, 
    offset 
  });
  
  res.json({ 
    success: true, 
    blueprints,
    // v2.3.0 Filter options
    filters: {
      types: BLUEPRINT_TYPES,
      genres: VALID_GENRES,
      sources: VALID_SOURCES,
      modes: VALID_MODES,
    },
  });
  return;
}));

router.get('/blueprints/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = sanitizeUUID(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, error: 'Invalid blueprint ID format' });
    return;
  }

  const blueprint = await iaiFactoryService.getBlueprint(id);
  if (!blueprint) {
    res.status(404).json({ success: false, error: 'Blueprint not found' });
    return;
  }

  res.json({ success: true, blueprint });
  return;
}));

router.post('/blueprints', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const name = sanitizeString(req.body.name, 100);
  const description = sanitizeString(req.body.description, 500);
  const type = sanitizeString(req.body.type, 20) ?? 'STANDARD';
  
  // v2.3.0 Classification
  const targetGenre = (sanitizeString(req.body.targetGenre, 20) ?? 'SOLDIER') as SoldierGenre;
  const targetSource = (sanitizeString(req.body.targetSource, 20) ?? 'EXTENSION') as ExecutionSource;
  const targetMode = (sanitizeString(req.body.targetMode, 20) ?? 'USM') as SoldierMode;
  const accountId = sanitizeUUID(req.body.accountId) ?? req.user!.id; // Default to user's account
  
  const baseConfig = sanitizeJSON(req.body.baseConfig, 5000) ?? {};
  const containerIds = Array.isArray(req.body.containerIds) ? req.body.containerIds.map((id: string) => sanitizeUUID(id)).filter(Boolean) : [];
  const patternIds = Array.isArray(req.body.patternIds) ? req.body.patternIds.map((id: string) => sanitizeUUID(id)).filter(Boolean) : [];
  const hotSwapEnabled = sanitizeBoolean(req.body.hotSwapEnabled) ?? true;
  const hotSwapPatterns = Array.isArray(req.body.hotSwapPatterns) ? req.body.hotSwapPatterns.map((id: string) => sanitizeUUID(id)).filter(Boolean) : [];
  const creationRate = sanitizeInteger(req.body.creationRate, 1, 100) ?? 1;
  const maxConcurrent = sanitizeInteger(req.body.maxConcurrent, 1, 1000) ?? 10;
  const lifespan = sanitizeInteger(req.body.lifespan, 0, 10080) ?? 60; // max 7 days
  const autoRespawn = sanitizeBoolean(req.body.autoRespawn) ?? false;
  const targeting = sanitizeJSON(req.body.targeting, 5000) ?? { companyIds: [], userIds: [], conditions: {} };
  const schedule = sanitizeJSON(req.body.schedule, 2000) ?? { enabled: false, cronExpression: null, timezone: 'UTC', startDate: null, endDate: null };
  const isActive = sanitizeBoolean(req.body.isActive) ?? true;
  const priority = sanitizeInteger(req.body.priority, 0, 1000) ?? 100;
  const tags = Array.isArray(req.body.tags) ? req.body.tags.map((t: string) => sanitizeString(t, 50)).filter(Boolean).slice(0, 10) : [];

  if (!name) {
    res.status(400).json({ success: false, error: 'Blueprint name is required' });
    return;
  }

  if (type && !BLUEPRINT_TYPES.includes(type as typeof BLUEPRINT_TYPES[number])) {
    res.status(400).json({
      success: false,
      error: `Invalid type. Allowed: ${BLUEPRINT_TYPES.join(', ')}`
    });
    return;
  }
  
  // v2.3.0 Validate classification
  if (!VALID_GENRES.includes(targetGenre)) {
    res.status(400).json({
      success: false,
      error: `Invalid targetGenre. Allowed: ${VALID_GENRES.join(', ')}`
    });
    return;
  }
  
  if (!VALID_SOURCES.includes(targetSource)) {
    res.status(400).json({
      success: false,
      error: `Invalid targetSource. Allowed: ${VALID_SOURCES.join(', ')}`
    });
    return;
  }
  
  if (!VALID_MODES.includes(targetMode)) {
    res.status(400).json({
      success: false,
      error: `Invalid targetMode. Allowed: ${VALID_MODES.join(', ')}`
    });
    return;
  }

  const blueprint = await iaiFactoryService.createBlueprint({
    name,
    description,
    type: type as typeof BLUEPRINT_TYPES[number],
    targetGenre,
    targetSource,
    targetMode,
    accountId,
    baseConfig,
    containerIds,
    patternIds,
    hotSwapEnabled,
    hotSwapPatterns,
    creationRate,
    maxConcurrent,
    lifespan,
    autoRespawn,
    targeting,
    schedule,
    isActive,
    priority,
    tags,
    createdBy: req.user!.id,
  });

  createAuditLog({
    userId: req.user!.id,
    action: 'CREATE_IAI_BLUEPRINT',
    resource: 'iai_blueprint',
    resourceId: blueprint.id,
    newValue: { name, type, targetGenre, targetSource, targetMode, isActive, hotSwapEnabled },
    ipAddress: getRealIP(req),
    userAgent: getUserAgent(req),
    success: true,
    metadata: { severity: 'high', reason: 'iai_creation_capability', version: '2.3.0' }
  });

  res.status(201).json({ success: true, blueprint });
  return;
}));

router.put('/blueprints/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = sanitizeUUID(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, error: 'Invalid blueprint ID format' });
    return;
  }

  const existing = await iaiFactoryService.getBlueprint(id);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Blueprint not found' });
    return;
  }

  const name = sanitizeString(req.body.name, 100);
  const description = sanitizeString(req.body.description, 500);
  const type = sanitizeString(req.body.type, 20);
  const baseConfig = sanitizeJSON(req.body.baseConfig, 5000);
  const containerIds = Array.isArray(req.body.containerIds) ? req.body.containerIds.map((id: string) => sanitizeUUID(id)).filter(Boolean) : undefined;
  const patternIds = Array.isArray(req.body.patternIds) ? req.body.patternIds.map((id: string) => sanitizeUUID(id)).filter(Boolean) : undefined;
  const hotSwapEnabled = sanitizeBoolean(req.body.hotSwapEnabled);
  const hotSwapPatterns = Array.isArray(req.body.hotSwapPatterns) ? req.body.hotSwapPatterns.map((id: string) => sanitizeUUID(id)).filter(Boolean) : undefined;
  const creationRate = sanitizeInteger(req.body.creationRate, 1, 100);
  const maxConcurrent = sanitizeInteger(req.body.maxConcurrent, 1, 1000);
  const lifespan = sanitizeInteger(req.body.lifespan, 0, 10080);
  const autoRespawn = sanitizeBoolean(req.body.autoRespawn);
  const targeting = sanitizeJSON(req.body.targeting, 5000);
  const schedule = sanitizeJSON(req.body.schedule, 2000);
  const isActive = sanitizeBoolean(req.body.isActive);
  const priority = sanitizeInteger(req.body.priority, 0, 1000);
  const tags = Array.isArray(req.body.tags) ? req.body.tags.map((t: string) => sanitizeString(t, 50)).filter(Boolean).slice(0, 10) : undefined;

  if (type && !ALLOWED_BLUEPRINT_TYPES.includes(type as any)) {
    res.status(400).json({
      success: false,
      error: `Invalid type. Allowed: ${ALLOWED_BLUEPRINT_TYPES.join(', ')}`
    });
    return;
  }

  const blueprint = await iaiFactoryService.updateBlueprint(id, {
    name, description, type: type as typeof ALLOWED_BLUEPRINT_TYPES[number] | undefined, baseConfig, containerIds, patternIds,
    hotSwapEnabled, hotSwapPatterns, creationRate, maxConcurrent,
    lifespan, autoRespawn, targeting, schedule, isActive, priority, tags
  });

  createAuditLog({
    userId: req.user!.id,
    action: 'UPDATE_IAI_BLUEPRINT',
    resource: 'iai_blueprint',
    resourceId: id,
    oldValue: { name: existing.name, isActive: existing.isActive },
    newValue: { name, isActive },
    ipAddress: getRealIP(req),
    userAgent: getUserAgent(req),
    success: true,
  });

  res.json({ success: true, blueprint });
  return;
}));

router.delete('/blueprints/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = sanitizeUUID(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, error: 'Invalid blueprint ID format' });
    return;
  }

  const existing = await iaiFactoryService.getBlueprint(id);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Blueprint not found' });
    return;
  }

  await iaiFactoryService.deleteBlueprint(id);

  createAuditLog({
    userId: req.user!.id,
    action: 'DELETE_IAI_BLUEPRINT',
    resource: 'iai_blueprint',
    resourceId: id,
    oldValue: { name: existing.name, type: existing.type },
    ipAddress: getRealIP(req),
    userAgent: getUserAgent(req),
    success: true,
    metadata: { severity: 'high' }
  });

  res.json({ success: true, message: 'Blueprint deleted' });
  return;
}));

router.post('/blueprints/:id/activate', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = sanitizeUUID(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, error: 'Invalid blueprint ID format' });
    return;
  }

  const blueprint = await iaiFactoryService.activateBlueprint(id);
  if (!blueprint) {
    res.status(404).json({ success: false, error: 'Blueprint not found' });
    return;
  }

  createAuditLog({
    userId: req.user!.id,
    action: 'ACTIVATE_IAI_BLUEPRINT',
    resource: 'iai_blueprint',
    resourceId: id,
    ipAddress: getRealIP(req),
    userAgent: getUserAgent(req),
    success: true,
  });

  res.json({ success: true, blueprint });
  return;
}));

router.post('/blueprints/:id/deactivate', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = sanitizeUUID(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, error: 'Invalid blueprint ID format' });
    return;
  }

  const blueprint = await iaiFactoryService.deactivateBlueprint(id);
  if (!blueprint) {
    res.status(404).json({ success: false, error: 'Blueprint not found' });
    return;
  }

  createAuditLog({
    userId: req.user!.id,
    action: 'DEACTIVATE_IAI_BLUEPRINT',
    resource: 'iai_blueprint',
    resourceId: id,
    ipAddress: getRealIP(req),
    userAgent: getUserAgent(req),
    success: true,
  });

  res.json({ success: true, blueprint });
  return;
}));

router.post('/blueprints/:id/spawn', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = sanitizeUUID(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, error: 'Invalid blueprint ID format' });
    return;
  }

  const count = sanitizeInteger(req.body.count, 1, 100) ?? 1;

  const blueprint = await iaiFactoryService.getBlueprint(id);
  if (!blueprint) {
    res.status(404).json({ success: false, error: 'Blueprint not found' });
    return;
  }

  if (!blueprint.isActive) {
    res.status(400).json({ success: false, error: 'Cannot spawn from inactive blueprint' });
    return;
  }

  const instances = await iaiFactoryService.spawnInstances(id, count);

  createAuditLog({
    userId: req.user!.id,
    action: 'SPAWN_IAI_INSTANCES',
    resource: 'iai_instance',
    resourceId: id,
    newValue: { count, instanceIds: instances.map(i => i.id) },
    ipAddress: getRealIP(req),
    userAgent: getUserAgent(req),
    success: true,
    metadata: { severity: 'high', reason: 'iai_spawning' }
  });

  res.json({ success: true, instances, count: instances.length });
  return;
}));

// ============================================
// Instance Routes
// ============================================

router.get('/instances', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const status = sanitizeString(req.query.status, 20);
  const blueprintId = sanitizeUUID(req.query.blueprintId as string);
  const limit = sanitizeInteger(req.query.limit, 1, 500) ?? 100;
  const offset = sanitizeInteger(req.query.offset, 0) ?? 0;

  const instances = await iaiFactoryService.listInstances({ status, blueprintId, limit, offset });
  res.json({ success: true, instances });
  return;
}));

router.get('/instances/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = sanitizeUUID(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, error: 'Invalid instance ID format' });
    return;
  }

  const instance = await iaiFactoryService.getInstance(id);
  if (!instance) {
    res.status(404).json({ success: false, error: 'Instance not found' });
    return;
  }

  res.json({ success: true, instance });
  return;
}));

router.post('/instances/:id/terminate', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = sanitizeUUID(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, error: 'Invalid instance ID format' });
    return;
  }

  const instance = await iaiFactoryService.terminateInstance(id);
  if (!instance) {
    res.status(404).json({ success: false, error: 'Instance not found' });
    return;
  }

  createAuditLog({
    userId: req.user!.id,
    action: 'TERMINATE_IAI_INSTANCE',
    resource: 'iai_instance',
    resourceId: id,
    ipAddress: getRealIP(req),
    userAgent: getUserAgent(req),
    success: true,
  });

  res.json({ success: true, instance });
  return;
}));

router.post('/instances/terminate-all', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const blueprintId = sanitizeUUID(req.body.blueprintId);
  
  const result = await iaiFactoryService.terminateAllInstances(blueprintId);

  createAuditLog({
    userId: req.user!.id,
    action: 'TERMINATE_ALL_IAI_INSTANCES',
    resource: 'iai_instance',
    newValue: { terminated: result.terminated, blueprintId },
    ipAddress: getRealIP(req),
    userAgent: getUserAgent(req),
    success: true,
    metadata: { severity: 'critical', reason: 'mass_termination' }
  });

  res.json({ success: true, ...result });
  return;
}));

// ============================================
// Connection Map Routes (v2.3.0 - Server-side persistence)
// ============================================

router.get('/connection-maps', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const accountId = sanitizeUUID(req.query.accountId);
  const isTemplate = sanitizeBoolean(req.query.isTemplate);
  const isActive = sanitizeBoolean(req.query.isActive);
  
  const maps = await iaiFactoryService.listConnectionMaps({ accountId, isTemplate, isActive });
  res.json({ success: true, maps });
  return;
}));

router.get('/connection-maps/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = sanitizeUUID(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, error: 'Invalid connection map ID format' });
    return;
  }
  
  const map = await iaiFactoryService.getConnectionMap(id);
  if (!map) {
    res.status(404).json({ success: false, error: 'Connection map not found' });
    return;
  }
  
  res.json({ success: true, map });
  return;
}));

router.post('/connection-maps', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const name = sanitizeString(req.body.name, 100);
  const description = sanitizeString(req.body.description, 500);
  const nodes = sanitizeJSON(req.body.nodes, 50000) ?? {};
  const connections = sanitizeJSON(req.body.connections, 50000) ?? {};
  const viewport = sanitizeJSON(req.body.viewport, 1000) ?? {};
  const isTemplate = sanitizeBoolean(req.body.isTemplate) ?? false;
  const templateType = sanitizeString(req.body.templateType, 50);
  const templateTags = Array.isArray(req.body.templateTags) 
    ? req.body.templateTags.map((t: string) => sanitizeString(t, 30)).filter(Boolean).slice(0, 10) 
    : [];
  const accountId = sanitizeUUID(req.body.accountId) ?? req.user!.id;

  if (!name) {
    res.status(400).json({ success: false, error: 'Connection map name is required' });
    return;
  }

  const map = await iaiFactoryService.createConnectionMap({
    name,
    description,
    nodes,
    connections,
    viewport,
    isTemplate,
    templateType,
    templateTags,
    accountId,
    createdBy: req.user!.id,
  });

  createAuditLog({
    userId: req.user!.id,
    action: 'CREATE_CONNECTION_MAP',
    resource: 'iai_connection_map',
    resourceId: map.id,
    newValue: { name, isTemplate },
    ipAddress: getRealIP(req),
    userAgent: getUserAgent(req),
    success: true,
  });

  res.status(201).json({ success: true, map });
  return;
}));

router.put('/connection-maps/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = sanitizeUUID(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, error: 'Invalid connection map ID format' });
    return;
  }
  
  const existing = await iaiFactoryService.getConnectionMap(id);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Connection map not found' });
    return;
  }

  const name = sanitizeString(req.body.name, 100);
  const description = sanitizeString(req.body.description, 500);
  const nodes = sanitizeJSON(req.body.nodes, 50000);
  const connections = sanitizeJSON(req.body.connections, 50000);
  const viewport = sanitizeJSON(req.body.viewport, 1000);
  
  const map = await iaiFactoryService.updateConnectionMap(id, {
    name,
    description,
    nodes,
    connections,
    viewport,
  });

  createAuditLog({
    userId: req.user!.id,
    action: 'UPDATE_CONNECTION_MAP',
    resource: 'iai_connection_map',
    resourceId: id,
    oldValue: { name: existing.name },
    newValue: { name },
    ipAddress: getRealIP(req),
    userAgent: getUserAgent(req),
    success: true,
  });

  res.json({ success: true, map });
  return;
}));

router.delete('/connection-maps/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = sanitizeUUID(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, error: 'Invalid connection map ID format' });
    return;
  }

  await iaiFactoryService.deleteConnectionMap(id);
  res.json({ success: true, message: 'Connection map deleted' });
  return;
}));

// ============================================
// Predefined Templates Routes (v2.3.0)
// ============================================

router.get('/templates', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const category = sanitizeString(req.query.category, 50);
  const genre = sanitizeString(req.query.genre, 20) as SoldierGenre | undefined;
  const source = sanitizeString(req.query.source, 20) as ExecutionSource | undefined;
  const mode = sanitizeString(req.query.mode, 20) as SoldierMode | undefined;
  const isActive = sanitizeBoolean(req.query.isActive);
  
  const templates = await iaiFactoryService.listPredefinedTemplates({
    category,
    genre: genre && VALID_GENRES.includes(genre) ? genre : undefined,
    source: source && VALID_SOURCES.includes(source) ? source : undefined,
    mode: mode && VALID_MODES.includes(mode) ? mode : undefined,
    isActive,
  });
  
  res.json({ 
    success: true, 
    templates,
    // Categories available
    categories: ['fbm', 'messaging', 'intelligence', 'general', 'custom'],
  });
  return;
}));

router.get('/templates/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = sanitizeUUID(req.params.id) ?? sanitizeString(req.params.id, 100);
  if (!id) {
    res.status(400).json({ success: false, error: 'Invalid template ID format' });
    return;
  }
  
  // Try to get by ID first, then by name
  let template = await iaiFactoryService.getPredefinedTemplate(id);
  if (!template) {
    template = await iaiFactoryService.getPredefinedTemplateByName(id);
  }
  
  if (!template) {
    res.status(404).json({ success: false, error: 'Template not found' });
    return;
  }
  
  res.json({ success: true, template });
  return;
}));

router.post('/templates/:id/use', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = sanitizeUUID(req.params.id) ?? sanitizeString(req.params.id, 100);
  if (!id) {
    res.status(400).json({ success: false, error: 'Invalid template ID format' });
    return;
  }
  
  const result = await iaiFactoryService.usePredefinedTemplate(id);
  if (!result.success || !result.template) {
    res.status(404).json({ success: false, error: 'Template not found' });
    return;
  }
  
  createAuditLog({
    userId: req.user!.id,
    action: 'USE_PREDEFINED_TEMPLATE',
    resource: 'iai_predefined_template',
    resourceId: id,
    newValue: { templateName: result.template.name, popularity: result.template.popularity },
    ipAddress: getRealIP(req),
    userAgent: getUserAgent(req),
    success: true,
  });
  
  res.json({ success: true, template: result.template });
  return;
}));

// ============================================
// USM (Ultra Speed Mode) Preload Route
// ============================================

router.post('/usm/preload', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  // Import prisma dynamically to avoid circular deps
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  
  try {
    const result = await iaiFactoryService.preloadUSMPatterns(prisma);
    
    createAuditLog({
      userId: req.user!.id,
      action: 'USM_PATTERN_PRELOAD',
      resource: 'usm_container',
      newValue: {
        success: result.success,
        containerId: result.container?.id,
        patternCount: result.patterns.length,
      },
      ipAddress: getRealIP(req),
      userAgent: getUserAgent(req),
      success: result.success,
      metadata: { operation: 'usm_preload' }
    });

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        container: {
          id: result.container?.id,
          name: result.container?.name,
        },
        patterns: result.patterns.map((p: any) => ({
          id: p.id,
          name: p.name,
          isActive: p.isActive,
        })),
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.message,
      });
    }
  } finally {
    await prisma.$disconnect();
  }
  return;
}));

// Get USM container status
router.get('/usm/status', asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  
  try {
    const container = await prisma.injectionContainer.findFirst({
      where: { name: 'IAI Soldiers USM' },
      include: {
        patterns: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            weight: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    if (!container) {
      res.json({
        success: true,
        exists: false,
        message: 'USM container not found - run preload to create',
      });
      return;
    }

    res.json({
      success: true,
      exists: true,
      container: {
        id: container.id,
        name: container.name,
        isActive: container.isActive,
        patternCount: container.patterns.length,
        patterns: container.patterns,
      },
      hotSwapReady: container.isActive && container.patterns.length > 0,
    });
  } finally {
    await prisma.$disconnect();
  }
  return;
}));

export default router;
