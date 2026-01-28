/**
 * IAI Injection Routes
 * API endpoints for managing injection containers, patterns, and executions.
 * 
 * ⚠️ SECURITY: These routes manage executable code patterns.
 * ALL routes require SUPER_ADMIN role - no exceptions.
 */

import { Router, Response, NextFunction } from 'express';
import { injectionService } from '../services/injection.service';
import { AuthRequest, authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { 
  sanitizeString,
  sanitizeUUID,
  sanitizeContainerId,
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
// SECURITY: Authenticate ALL requests first
// ============================================
router.use(authenticate);

// ============================================
// SECURITY: Require SUPER_ADMIN for ALL routes
// ============================================
router.use((req: AuthRequest, res: Response, next: NextFunction) => {
  // Fail-closed: No user = deny
  if (!req.user) {
    logger.warn('[INJECTION_SECURITY] Unauthenticated access attempt', {
      path: req.path,
      ip: getRealIP(req),
    });
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  // Fail-closed: Non-super-admin = deny
  if (!isSuperAdmin(req)) {
    logger.warn('[INJECTION_SECURITY] Non-admin access attempt blocked', {
      userId: req.user.id,
      role: req.user.role,
      path: req.path,
      method: req.method,
      ip: getRealIP(req),
    });
    
    // Audit this security event
    createAuditLog({
      userId: req.user.id,
      action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      resource: 'injection',
      ipAddress: getRealIP(req),
      userAgent: getUserAgent(req),
      success: false,
      errorMessage: 'Non-super-admin attempted to access injection routes',
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

// Helper for async route handlers - ensures explicit void return
const asyncHandler = (fn: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>) => 
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Helper to safely get string from query/params
const getString = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0) return String(value[0]);
  return undefined;
};

const getRequiredString = (value: unknown): string => {
  const str = getString(value);
  if (!str) throw new Error('Required parameter is missing');
  return str;
};

const getInt = (value: unknown): number | undefined => {
  const str = getString(value);
  return str ? parseInt(str, 10) : undefined;
};

// Allowed container categories (whitelist)
const ALLOWED_CATEGORIES = [
  'scraping', 'posting', 'messaging', 'analytics', 
  'automation', 'integration', 'utility', 'security', 'custom'
] as const;

// Allowed failure actions
const ALLOWED_FAILURE_ACTIONS = ['skip', 'retry', 'abort', 'fallback'] as const;

// ============================================
// Container Routes (SUPER_ADMIN only - enforced above)
// ============================================

router.post('/containers', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  // Sanitize all inputs
  const name = sanitizeString(req.body.name, 100);
  const description = sanitizeString(req.body.description, 500);
  const category = sanitizeString(req.body.category, 50);
  const icon = sanitizeString(req.body.icon, 50);
  const color = sanitizeString(req.body.color, 20);
  const isActive = sanitizeBoolean(req.body.isActive) ?? true;
  const isDefault = sanitizeBoolean(req.body.isDefault) ?? false;
  const priority = sanitizeInteger(req.body.priority, 0, 1000);
  const config = sanitizeJSON(req.body.config, 5000);
  const metadata = sanitizeJSON(req.body.metadata, 2000);

  // Validate required fields
  if (!name) {
    res.status(400).json({ success: false, error: 'Container name is required' });
    return;
  }
  
  // Validate category if provided
  if (category && !ALLOWED_CATEGORIES.includes(category as any)) {
    res.status(400).json({ 
      success: false, 
      error: `Invalid category. Allowed: ${ALLOWED_CATEGORIES.join(', ')}` 
    });
    return;
  }

  try {
    const container = await injectionService.createContainer({
      name,
      description,
      category,
      icon,
      color,
      isActive,
      isDefault,
      priority,
      config,
      metadata,
      createdBy: req.user!.id // Guaranteed by middleware
    });

    // Audit log
    createAuditLog({
      userId: req.user!.id,
      action: 'CREATE_CONTAINER',
      resource: 'injection_container',
      resourceId: container.id,
      newValue: { name, category, isActive },
      ipAddress: getRealIP(req),
      userAgent: getUserAgent(req),
      success: true,
    });

    res.status(201).json({ success: true, data: container });
    return;
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'P2002') {
      res.status(409).json({ success: false, error: 'Container with this name already exists' });
      return;
    }
    throw error;
  }
}));

router.get('/containers', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  // Sanitize query params
  const category = sanitizeString(req.query.category, 50);
  const isActive = sanitizeBoolean(req.query.isActive);
  const includePatterns = sanitizeBoolean(req.query.includePatterns) ?? true;
  const limit = sanitizeInteger(req.query.limit, 1, 100) ?? 50;
  const offset = sanitizeInteger(req.query.offset, 0) ?? 0;

  const result = await injectionService.listContainers({
    category,
    isActive,
    includePatterns,
    limit,
    offset
  });

  res.json({ success: true, data: result.containers, total: result.total });
  return;
}));

router.get('/containers/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = sanitizeContainerId(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, error: 'Invalid container ID format' });
    return;
  }
  
  const includePatterns = sanitizeBoolean(req.query.includePatterns) ?? true;

  const container = await injectionService.getContainer(id, includePatterns);

  if (!container) {
    res.status(404).json({ success: false, error: 'Container not found' });
    return;
  }

  const stats = await injectionService.getContainerStats(id);
  res.json({ success: true, data: { ...container, stats } });
  return;
}));

router.put('/containers/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = sanitizeContainerId(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, error: 'Invalid container ID format' });
    return;
  }

  // Sanitize all inputs
  const name = sanitizeString(req.body.name, 100);
  const description = sanitizeString(req.body.description, 500);
  const category = sanitizeString(req.body.category, 50);
  const icon = sanitizeString(req.body.icon, 50);
  const color = sanitizeString(req.body.color, 20);
  const isActive = sanitizeBoolean(req.body.isActive);
  const isDefault = sanitizeBoolean(req.body.isDefault);
  const priority = sanitizeInteger(req.body.priority, 0, 1000);
  const config = sanitizeJSON(req.body.config, 5000);
  const metadata = sanitizeJSON(req.body.metadata, 2000);
  
  // Validate category if provided
  if (category && !ALLOWED_CATEGORIES.includes(category as any)) {
    res.status(400).json({ 
      success: false, 
      error: `Invalid category. Allowed: ${ALLOWED_CATEGORIES.join(', ')}` 
    });
    return;
  }

  const existing = await injectionService.getContainer(id, false);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Container not found' });
    return;
  }

  const container = await injectionService.updateContainer(id, {
    name, description, category, icon, color, isActive, isDefault, priority, config, metadata
  });

  // Audit log
  createAuditLog({
    userId: req.user!.id,
    action: 'UPDATE_CONTAINER',
    resource: 'injection_container',
    resourceId: id,
    oldValue: { name: existing.name, isActive: existing.isActive },
    newValue: { name, isActive },
    ipAddress: getRealIP(req),
    userAgent: getUserAgent(req),
    success: true,
  });

  res.json({ success: true, data: container });
  return;
}));

router.delete('/containers/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = sanitizeContainerId(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, error: 'Invalid container ID format' });
    return;
  }

  const existing = await injectionService.getContainer(id, false);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Container not found' });
    return;
  }

  await injectionService.deleteContainer(id);
  
  // Audit log - deletion is high-risk
  createAuditLog({
    userId: req.user!.id,
    action: 'DELETE_CONTAINER',
    resource: 'injection_container',
    resourceId: id,
    oldValue: { name: existing.name, category: existing.category },
    ipAddress: getRealIP(req),
    userAgent: getUserAgent(req),
    success: true,
    metadata: { severity: 'high' }
  });
  
  res.json({ success: true, message: 'Container deleted successfully' });
  return;
}));

// ============================================
// Pattern Routes (SUPER_ADMIN only - code execution capability)
// ============================================

// Allowed code types (whitelist)
const ALLOWED_CODE_TYPES = ['javascript', 'json', 'workflow', 'selector', 'template', 'injection', 'action', 'extractor', 'transformer', 'hybrid'] as const;

router.post('/patterns', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  // Sanitize all inputs - patterns contain executable code so require super admin (enforced above)
  const containerId = sanitizeContainerId(req.body.containerId);
  const name = sanitizeString(req.body.name, 100);
  const description = sanitizeString(req.body.description, 500);
  const code = typeof req.body.code === 'string' ? req.body.code.substring(0, 50000) : null; // Allow longer code but limit
  const codeType = sanitizeString(req.body.codeType, 20);
  const version = sanitizeString(req.body.version, 20) ?? '1.0.0';
  const isDefault = sanitizeBoolean(req.body.isDefault) ?? false;
  const isActive = sanitizeBoolean(req.body.isActive) ?? true;
  const priority = sanitizeInteger(req.body.priority, 0, 1000) ?? 100;
  const weight = sanitizeInteger(req.body.weight, 0, 100) ?? 50;
  const timeout = sanitizeInteger(req.body.timeout, 1000, 300000) ?? 30000; // 1s - 5min
  const retryCount = sanitizeInteger(req.body.retryCount, 0, 5) ?? 0;
  const failureAction = sanitizeString(req.body.failureAction, 20);
  // preConditions and postActions are arrays - pass through if valid
  const preConditions = Array.isArray(req.body.preConditions) ? req.body.preConditions.slice(0, 100) : undefined;
  const postActions = Array.isArray(req.body.postActions) ? req.body.postActions.slice(0, 100) : undefined;
  const tags = Array.isArray(req.body.tags) 
    ? req.body.tags.map((t: unknown) => sanitizeString(t, 50)).filter(Boolean).slice(0, 10)
    : undefined;
  const metadata = sanitizeJSON(req.body.metadata, 2000);

  // Validate required fields
  if (!containerId || !name || !code) {
    res.status(400).json({ 
      success: false, 
      error: 'containerId, name, and code are required' 
    });
    return;
  }
  
  // Validate code type
  if (codeType && !ALLOWED_CODE_TYPES.includes(codeType as any)) {
    res.status(400).json({ 
      success: false, 
      error: `Invalid codeType. Allowed: ${ALLOWED_CODE_TYPES.join(', ')}` 
    });
    return;
  }
  
  // Validate failure action
  if (failureAction && !ALLOWED_FAILURE_ACTIONS.includes(failureAction as any)) {
    res.status(400).json({ 
      success: false, 
      error: `Invalid failureAction. Allowed: ${ALLOWED_FAILURE_ACTIONS.join(', ')}` 
    });
    return;
  }

  const container = await injectionService.getContainer(containerId, false);
  if (!container) {
    res.status(404).json({ success: false, error: 'Container not found' });
    return;
  }

  try {
    const pattern = await injectionService.createPattern({
      containerId, name, description, code, codeType, version,
      isDefault, isActive, priority, weight, timeout, retryCount,
      failureAction, preConditions, postActions, tags, metadata,
      createdBy: req.user!.id
    });

    // Audit log - pattern creation is security-sensitive
    createAuditLog({
      userId: req.user!.id,
      action: 'CREATE_PATTERN',
      resource: 'injection_pattern',
      resourceId: pattern.id,
      newValue: { name, containerId, codeType, isActive, codeLength: code.length },
      ipAddress: getRealIP(req),
      userAgent: getUserAgent(req),
      success: true,
      metadata: { severity: 'high', reason: 'executable_code_creation' }
    });

    res.status(201).json({ success: true, data: pattern });
    return;
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'P2002') {
      res.status(409).json({ success: false, error: 'Pattern with this name already exists in the container' });
      return;
    }
    throw error;
  }
}));

router.get('/patterns', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const containerId = sanitizeContainerId(req.query.containerId);
  const isActive = sanitizeBoolean(req.query.isActive);
  const tagsStr = sanitizeString(req.query.tags, 200);
  const limit = sanitizeInteger(req.query.limit, 1, 100) ?? 50;
  const offset = sanitizeInteger(req.query.offset, 0) ?? 0;

  const result = await injectionService.listPatterns({
    containerId,
    isActive,
    tags: tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : undefined,
    limit,
    offset
  });

  res.json({ success: true, data: result.patterns, total: result.total });
  return;
}));

router.get('/patterns/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = sanitizeUUID(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, error: 'Invalid pattern ID format' });
    return;
  }

  const pattern = await injectionService.getPattern(id);

  if (!pattern) {
    res.status(404).json({ success: false, error: 'Pattern not found' });
    return;
  }

  const successRate = pattern.totalExecutions > 0 
    ? (pattern.successCount / pattern.totalExecutions) * 100 
    : 0;

  res.json({ success: true, data: { ...pattern, successRate: Math.round(successRate * 100) / 100 } });
  return;
}));

router.put('/patterns/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = sanitizeUUID(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, error: 'Invalid pattern ID format' });
    return;
  }

  // Sanitize all inputs
  const name = sanitizeString(req.body.name, 100);
  const description = sanitizeString(req.body.description, 500);
  const code = typeof req.body.code === 'string' ? req.body.code.substring(0, 50000) : undefined;
  const codeType = sanitizeString(req.body.codeType, 20);
  const version = sanitizeString(req.body.version, 20);
  const isDefault = sanitizeBoolean(req.body.isDefault);
  const isActive = sanitizeBoolean(req.body.isActive);
  const priority = sanitizeInteger(req.body.priority, 0, 1000);
  const weight = sanitizeInteger(req.body.weight, 0, 100);
  const timeout = sanitizeInteger(req.body.timeout, 1000, 300000);
  const retryCount = sanitizeInteger(req.body.retryCount, 0, 5);
  const failureAction = sanitizeString(req.body.failureAction, 20);
  // preConditions and postActions are arrays
  const preConditions = Array.isArray(req.body.preConditions) ? req.body.preConditions.slice(0, 100) : undefined;
  const postActions = Array.isArray(req.body.postActions) ? req.body.postActions.slice(0, 100) : undefined;
  const tags = Array.isArray(req.body.tags) 
    ? req.body.tags.map((t: unknown) => sanitizeString(t, 50)).filter(Boolean).slice(0, 10)
    : undefined;
  const metadata = sanitizeJSON(req.body.metadata, 2000);
  
  // Validate code type if provided
  if (codeType && !ALLOWED_CODE_TYPES.includes(codeType as any)) {
    res.status(400).json({ 
      success: false, 
      error: `Invalid codeType. Allowed: ${ALLOWED_CODE_TYPES.join(', ')}` 
    });
    return;
  }
  
  // Validate failure action if provided
  if (failureAction && !ALLOWED_FAILURE_ACTIONS.includes(failureAction as any)) {
    res.status(400).json({ 
      success: false, 
      error: `Invalid failureAction. Allowed: ${ALLOWED_FAILURE_ACTIONS.join(', ')}` 
    });
    return;
  }

  const existing = await injectionService.getPattern(id);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Pattern not found' });
    return;
  }

  const pattern = await injectionService.updatePattern(id, {
    name, description, code, codeType, version,
    isDefault, isActive, priority, weight, timeout, retryCount,
    failureAction, preConditions, postActions, tags, metadata
  });

  // Audit log - pattern modification is high-risk
  createAuditLog({
    userId: req.user!.id,
    action: 'UPDATE_PATTERN',
    resource: 'injection_pattern',
    resourceId: id,
    oldValue: { name: existing.name, codeLength: existing.code?.length, isActive: existing.isActive },
    newValue: { name, codeLength: code?.length, isActive },
    ipAddress: getRealIP(req),
    userAgent: getUserAgent(req),
    success: true,
    metadata: { severity: 'high', codeChanged: code !== undefined }
  });

  res.json({ success: true, data: pattern });
  return;
}));

router.delete('/patterns/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = sanitizeUUID(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, error: 'Invalid pattern ID format' });
    return;
  }

  const existing = await injectionService.getPattern(id);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Pattern not found' });
    return;
  }

  await injectionService.deletePattern(id);
  
  // Audit log - pattern deletion is critical
  createAuditLog({
    userId: req.user!.id,
    action: 'DELETE_PATTERN',
    resource: 'injection_pattern',
    resourceId: id,
    oldValue: { name: existing.name, containerId: existing.containerId, codeType: existing.codeType },
    ipAddress: getRealIP(req),
    userAgent: getUserAgent(req),
    success: true,
    metadata: { severity: 'critical', reason: 'executable_code_deletion' }
  });
  
  res.json({ success: true, message: 'Pattern deleted successfully' });
}));

// ============================================
// Injection Execution Routes (CRITICAL - Code Execution)
// ============================================

// Allowed selection strategies
const ALLOWED_SELECTION_STRATEGIES = ['random', 'weighted', 'round-robin', 'priority'] as const;
type SelectionStrategy = typeof ALLOWED_SELECTION_STRATEGIES[number];

router.post('/inject', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  // Sanitize all inputs
  const containerId = sanitizeContainerId(req.body.containerId);
  const patternId = sanitizeUUID(req.body.patternId);
  const forceDefault = sanitizeBoolean(req.body.forceDefault) ?? false;
  const rawStrategy = sanitizeString(req.body.selectionStrategy, 20);
  const selectionStrategy: SelectionStrategy | undefined = 
    rawStrategy && ALLOWED_SELECTION_STRATEGIES.includes(rawStrategy as any) 
      ? rawStrategy as SelectionStrategy 
      : undefined;
  const input = sanitizeJSON(req.body.input, 10000);
  const timeout = sanitizeInteger(req.body.timeout, 1000, 60000) ?? 30000; // 1s - 1min
  const iaiInstanceId = sanitizeUUID(req.body.iaiInstanceId);
  const missionId = sanitizeUUID(req.body.missionId);
  const taskId = sanitizeUUID(req.body.taskId);

  if (!containerId && !patternId) {
    res.status(400).json({ success: false, error: 'Either containerId or patternId is required' });
    return;
  }
  
  // Validate selection strategy
  if (rawStrategy && !selectionStrategy) {
    res.status(400).json({ 
      success: false, 
      error: `Invalid selectionStrategy. Allowed: ${ALLOWED_SELECTION_STRATEGIES.join(', ')}` 
    });
    return;
  }

  // Audit log before execution
  createAuditLog({
    userId: req.user!.id,
    action: 'EXECUTE_INJECTION',
    resource: 'injection_execution',
    resourceId: patternId || containerId || 'unknown',
    ipAddress: getRealIP(req),
    userAgent: getUserAgent(req),
    success: true,
    metadata: { 
      severity: 'high',
      containerId,
      patternId,
      iaiInstanceId,
      missionId,
      taskId,
      inputSize: JSON.stringify(input || {}).length
    }
  });

  const result = await injectionService.inject({
    containerId, 
    patternId, 
    forceDefault, 
    selectionStrategy, 
    input, 
    timeout, 
    iaiInstanceId, 
    missionId, 
    taskId
  });

  res.json({ success: true, data: result });
  return;
}));

router.post('/test-pattern/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = sanitizeUUID(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, error: 'Invalid pattern ID format' });
    return;
  }
  
  const input = sanitizeJSON(req.body.input, 10000);

  const pattern = await injectionService.getPattern(id);
  if (!pattern) {
    res.status(404).json({ success: false, error: 'Pattern not found' });
    return;
  }

  // Audit log - test execution is also security-sensitive
  createAuditLog({
    userId: req.user!.id,
    action: 'TEST_PATTERN_EXECUTION',
    resource: 'injection_pattern',
    resourceId: id,
    ipAddress: getRealIP(req),
    userAgent: getUserAgent(req),
    success: true,
    metadata: { 
      patternName: pattern.name,
      codeType: pattern.codeType,
      inputSize: JSON.stringify(input || {}).length
    }
  });

  const startTime = Date.now();
  let output: unknown;
  let error: string | undefined;
  let success = false;

  try {
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    
    if (pattern.codeType === 'json' || pattern.codeType === 'workflow') {
      output = JSON.parse(pattern.code);
      success = true;
    } else {
      const fn = new AsyncFunction('input', 'context', pattern.code);
      const context = {
        logger,
        patternId: pattern.id,
        patternName: pattern.name,
        containerId: pattern.containerId,
        timestamp: new Date().toISOString(),
        isTest: true
      };
      output = await Promise.race([
        fn(input || {}, context),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Test timeout')), 10000))
      ]);
      success = true;
    }
  } catch (err: unknown) {
    const e = err as Error;
    error = sanitizeString(e.message, 500) || 'Unknown error';
    
    // Log test failures
    logger.warn('[INJECTION] Pattern test failed', {
      patternId: id,
      patternName: pattern.name,
      error: error,
      userId: req.user!.id
    });
  }

  res.json({
    success: true,
    data: { testSuccess: success, executionTimeMs: Date.now() - startTime, output, error }
  });
}));

// ============================================
// Slot Routes - For Extension Pattern Loading
// ============================================

/**
 * GET /injection/slot/active
 * Returns the active/default pattern for the extension to use
 * This is the main endpoint IAI calls to load its workflow
 */
router.get('/slot/active', asyncHandler(async (_req: AuthRequest, res: Response) => {
  try {
    // Get the default container (FBM)
    const containers = await injectionService.listContainers({
      isActive: true,
      includePatterns: true,
      limit: 10
    });

    if (!containers.containers || containers.containers.length === 0) {
      res.status(404).json({ 
        success: false, 
        error: 'No active containers found',
        message: 'Please create and configure an injection container in the admin panel'
      });
      return;
    }

    // Find the default or first container
    const container = containers.containers.find(c => c.isDefault) || containers.containers[0];
    
    // Get patterns for this container
    const patterns = await injectionService.listPatterns({
      containerId: container.id,
      isActive: true,
      limit: 10
    });

    if (!patterns.patterns || patterns.patterns.length === 0) {
      res.status(404).json({ 
        success: false, 
        error: 'No active patterns found',
        message: 'Please create and configure an injection pattern in the admin panel'
      });
      return;
    }

    // Find the default or first pattern
    const pattern = patterns.patterns.find(p => p.isDefault) || patterns.patterns[0];
    
    logger.info(`[InjectionSlot] Serving pattern "${pattern.name}" v${pattern.version} from container "${container.name}"`);

    res.json({
      success: true,
      data: {
        container: {
          id: container.id,
          name: container.name,
          category: container.category,
        },
        pattern: {
          id: pattern.id,
          name: pattern.name,
          version: pattern.version,
          code: pattern.code,
          codeType: pattern.codeType,
          isDefault: pattern.isDefault,
          tags: pattern.tags,
        }
      }
    });
  } catch (error) {
    logger.error('[InjectionSlot] Error loading active pattern:', error);
    res.status(500).json({ success: false, error: 'Failed to load active pattern' });
  }
}));

// ============================================
// Statistics Routes
// ============================================

router.get('/stats', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { containerId, patternId, startDate, endDate } = req.query;
  const startDateStr = getString(startDate);
  const endDateStr = getString(endDate);

  const stats = await injectionService.getInjectionStats({
    containerId: getString(containerId),
    patternId: getString(patternId),
    startDate: startDateStr ? new Date(startDateStr) : undefined,
    endDate: endDateStr ? new Date(endDateStr) : undefined
  });

  res.json({ success: true, data: stats });
}));

router.get('/containers/:id/stats', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = getRequiredString(req.params.id);

  const container = await injectionService.getContainer(id, false);
  if (!container) {
    res.status(404).json({ success: false, error: 'Container not found' });
    return;
  }

  const stats = await injectionService.getContainerStats(id);
  res.json({ success: true, data: stats });
}));

// ============================================
// Metrics Routes - For Extension Telemetry
// ============================================

/**
 * POST /injection/metrics
 * Receives execution metrics from the browser extension
 * This is a PUBLIC endpoint - no auth required for extension reporting
 */
router.post('/metrics', asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { 
      eventType,        // e.g., 'pattern_execution_start', 'pattern_execution_complete', 'step_executed'
      patternId,
      patternName,
      containerId: _containerId,
      containerName: _containerName,
      stepIndex,
      totalSteps,
      duration,
      success,
      error: _error,
      metadata: _metadata,
      timestamp: _timestamp,
      instanceId: _instanceId,
      vehicleInfo: _vehicleInfo
    } = req.body;

    logger.info(`[IAI Metrics] Event: ${eventType}`, {
      patternId,
      patternName,
      success,
      duration,
      stepIndex,
      totalSteps
    });

    // If we have a patternId, update the pattern's execution statistics
    if (patternId && (eventType === 'pattern_execution_complete' || eventType === 'pattern_execution_end')) {
      try {
        const pattern = await injectionService.getPattern(patternId);
        if (pattern) {
          // Update pattern stats
          const updateData: Record<string, number | Date> = {
            totalExecutions: (pattern.totalExecutions || 0) + 1,
            lastExecutedAt: new Date()
          };
          
          if (success) {
            updateData.successCount = (pattern.successCount || 0) + 1;
            if (duration) {
              updateData.avgExecutionTime = pattern.avgExecutionTime 
                ? Math.round((pattern.avgExecutionTime + duration) / 2)
                : duration;
            }
          } else {
            updateData.failureCount = (pattern.failureCount || 0) + 1;
          }

          await injectionService.updatePattern(patternId, updateData);
          logger.info(`[IAI Metrics] Updated pattern stats for ${patternId}`);
        }
      } catch (err) {
        logger.error(`[IAI Metrics] Failed to update pattern stats:`, err);
      }
    }

    // Store metric in execution log if needed
    // TODO: Could add injectionService.logMetric() for detailed tracking

    res.json({ 
      success: true, 
      message: 'Metric recorded',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[IAI Metrics] Error recording metric:', error);
    res.status(500).json({ success: false, error: 'Failed to record metric' });
  }
}));

/**
 * GET /injection/metrics
 * Returns aggregated metrics for the dashboard
 */
router.get('/metrics', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { containerId, patternId: _patternId, startDate, endDate, limit } = req.query;
  const startDateStr = getString(startDate);
  const endDateStr = getString(endDate);

  try {
    // Get all patterns with execution stats
    const patterns = await injectionService.listPatterns({
      containerId: getString(containerId),
      isActive: undefined, // Get all
      limit: getInt(limit) || 50
    });

    // Calculate aggregated metrics
    let totalExecutions = 0;
    let totalSuccess = 0;
    let totalFailures = 0;
    let avgExecutionTime = 0;
    let executionCount = 0;

    const patternStats = patterns.patterns.map(p => {
      totalExecutions += p.totalExecutions || 0;
      totalSuccess += p.successCount || 0;
      totalFailures += p.failureCount || 0;
      if (p.avgExecutionTime) {
        avgExecutionTime += p.avgExecutionTime;
        executionCount++;
      }

      return {
        patternId: p.id,
        patternName: p.name,
        containerId: p.containerId,
        totalExecutions: p.totalExecutions || 0,
        successCount: p.successCount || 0,
        failureCount: p.failureCount || 0,
        successRate: p.totalExecutions > 0 
          ? Math.round(((p.successCount || 0) / p.totalExecutions) * 100) 
          : 0,
        avgExecutionTime: p.avgExecutionTime || 0,
        lastExecutedAt: p.lastExecutedAt
      };
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalExecutions,
          totalSuccess,
          totalFailures,
          successRate: totalExecutions > 0 
            ? Math.round((totalSuccess / totalExecutions) * 100) 
            : 0,
          avgExecutionTime: executionCount > 0 
            ? Math.round(avgExecutionTime / executionCount) 
            : 0
        },
        patterns: patternStats,
        period: {
          startDate: startDateStr || 'all-time',
          endDate: endDateStr || 'now'
        }
      }
    });
  } catch (error) {
    logger.error('[IAI Metrics] Error fetching metrics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch metrics' });
  }
}));

// ============================================
// Category Management
// ============================================

router.get('/categories', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const categories = [
    { id: 'fbm_flow', name: 'FBM Flow', description: 'Facebook Marketplace posting flows', icon: 'shopping-cart', color: '#4267B2' },
    { id: 'messaging', name: 'Messaging', description: 'Auto-response and messaging patterns', icon: 'message-circle', color: '#25D366' },
    { id: 'analytics', name: 'Analytics', description: 'Data collection and analysis patterns', icon: 'bar-chart', color: '#FF6B6B' },
    { id: 'automation', name: 'Automation', description: 'General automation workflows', icon: 'zap', color: '#FFD93D' },
    { id: 'custom', name: 'Custom', description: 'User-defined custom patterns', icon: 'code', color: '#6C5CE7' }
  ];

  res.json({ success: true, data: categories });
}));

// ============================================
// Pattern Override Routes (SUPER_ADMIN Only)
// Allows Super Admin to force specific patterns for accounts/users
// ============================================

router.get('/overrides', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  // Sanitize inputs
  const accountId = sanitizeUUID(req.query.accountId);
  const isActive = sanitizeBoolean(req.query.isActive);
  const limit = sanitizeInteger(req.query.limit, 1, 500) ?? 100;
  const offset = sanitizeInteger(req.query.offset, 0) ?? 0;
  
  const overrides = await injectionService.listPatternOverrides({
    accountId,
    isActive,
    limit,
    offset,
  });
  
  res.json({ success: true, data: overrides.overrides, total: overrides.total });
  return;
}));

router.get('/overrides/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = sanitizeUUID(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, error: 'Invalid override ID format' });
    return;
  }
  
  const override = await injectionService.getPatternOverride(id);
  
  if (!override) {
    res.status(404).json({ success: false, error: 'Pattern override not found' });
    return;
  }
  
  res.json({ success: true, data: override });
  return;
}));

router.post('/overrides', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  // Sanitize all inputs
  const accountId = sanitizeUUID(req.body.accountId);
  const userId = sanitizeUUID(req.body.userId);
  const containerId = sanitizeContainerId(req.body.containerId);
  const patternId = sanitizeUUID(req.body.patternId);
  const isActive = sanitizeBoolean(req.body.isActive) ?? true;
  const priority = sanitizeInteger(req.body.priority, 0, 1000) ?? 100;
  const reason = sanitizeString(req.body.reason, 500);
  const expiresAtStr = sanitizeString(req.body.expiresAt, 30);
  
  // Validate required fields
  if (!accountId || !containerId || !patternId) {
    res.status(400).json({ 
      success: false, 
      error: 'accountId, containerId, and patternId are required' 
    });
    return;
  }
  
  // Validate expiresAt if provided
  let expiresAt: Date | undefined;
  if (expiresAtStr) {
    const parsed = new Date(expiresAtStr);
    if (isNaN(parsed.getTime())) {
      res.status(400).json({ success: false, error: 'Invalid expiresAt date format' });
      return;
    }
    expiresAt = parsed;
  }
  
  try {
    const override = await injectionService.createPatternOverride({
      accountId,
      userId,
      containerId,
      patternId,
      isActive,
      priority,
      reason,
      expiresAt,
      createdBy: req.user!.id,
    });
    
    // Audit log
    createAuditLog({
      userId: req.user!.id,
      accountId,
      action: 'CREATE_PATTERN_OVERRIDE',
      resource: 'pattern_override',
      resourceId: override.id,
      newValue: { accountId, patternId, isActive, priority, reason },
      ipAddress: getRealIP(req),
      userAgent: getUserAgent(req),
      success: true,
      metadata: { targetUserId: userId }
    });
    
    res.status(201).json({ success: true, data: override });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'P2002') {
      res.status(409).json({ success: false, error: 'Override already exists for this account/user/container combination' });
      return;
    }
    throw error;
  }
}));

router.put('/overrides/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = sanitizeUUID(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, error: 'Invalid override ID format' });
    return;
  }
  
  // Sanitize inputs
  const patternId = sanitizeUUID(req.body.patternId);
  const isActive = sanitizeBoolean(req.body.isActive);
  const priority = sanitizeInteger(req.body.priority, 0, 1000);
  const reason = sanitizeString(req.body.reason, 500);
  const expiresAtStr = req.body.expiresAt;
  
  // Handle expiresAt - can be date string, null (to clear), or undefined (no change)
  let expiresAt: Date | null | undefined;
  if (expiresAtStr === null) {
    expiresAt = null;
  } else if (expiresAtStr !== undefined) {
    const parsed = new Date(sanitizeString(expiresAtStr, 30) || '');
    if (isNaN(parsed.getTime())) {
      res.status(400).json({ success: false, error: 'Invalid expiresAt date format' });
      return;
    }
    expiresAt = parsed;
  }
  
  const existing = await injectionService.getPatternOverride(id);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Pattern override not found' });
    return;
  }
  
  const override = await injectionService.updatePatternOverride(id, {
    patternId,
    isActive,
    priority,
    reason,
    expiresAt,
  });
  
  // Audit log
  createAuditLog({
    userId: req.user!.id,
    accountId: existing.accountId,
    action: 'UPDATE_PATTERN_OVERRIDE',
    resource: 'pattern_override',
    resourceId: id,
    oldValue: { patternId: existing.patternId, isActive: existing.isActive, priority: existing.priority },
    newValue: { patternId, isActive, priority },
    ipAddress: getRealIP(req),
    userAgent: getUserAgent(req),
    success: true,
  });
  
  res.json({ success: true, data: override });
  return;
}));

router.delete('/overrides/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = sanitizeUUID(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, error: 'Invalid override ID format' });
    return;
  }
  
  const existing = await injectionService.getPatternOverride(id);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Pattern override not found' });
    return;
  }
  
  await injectionService.deletePatternOverride(id);
  
  // Audit log
  createAuditLog({
    userId: req.user!.id,
    accountId: existing.accountId,
    action: 'DELETE_PATTERN_OVERRIDE',
    resource: 'pattern_override',
    resourceId: id,
    oldValue: { accountId: existing.accountId, patternId: existing.patternId },
    ipAddress: getRealIP(req),
    userAgent: getUserAgent(req),
    success: true,
    metadata: { severity: 'high' }
  });
  
  res.json({ success: true, message: 'Pattern override deleted successfully' });
  return;
}));

// Get effective pattern for an account (considering overrides)
router.get('/overrides/effective/:accountId', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const accountId = sanitizeUUID(req.params.accountId);
  if (!accountId) {
    res.status(400).json({ success: false, error: 'Invalid account ID format' });
    return;
  }
  
  const containerId = sanitizeUUID(req.query.containerId);
  const userId = sanitizeUUID(req.query.userId);
  
  const effectivePattern = await injectionService.getEffectivePattern(
    accountId,
    containerId,
    userId
  );
  
  res.json({ success: true, data: effectivePattern });
  return;
}));

// Error handler
router.use((error: Error, _req: AuthRequest, res: Response, _next: NextFunction) => {
  logger.error('[InjectionRoutes] Error:', error);
  res.status(500).json({ success: false, error: error.message || 'Internal server error' });
});

export default router;
