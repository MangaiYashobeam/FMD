/**
 * IAI Injection Routes
 * API endpoints for managing injection containers, patterns, and executions.
 */

import { Router, Response, NextFunction } from 'express';
import { injectionService } from '../services/injection.service';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Helper for async route handlers
const asyncHandler = (fn: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>) => 
  (req: AuthRequest, res: Response, next: NextFunction) => {
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

// ============================================
// Container Routes
// ============================================

router.post('/containers', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, description, category, icon, color, isActive, isDefault, priority, config, metadata } = req.body;

  if (!name) {
    res.status(400).json({ success: false, error: 'Container name is required' });
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
      createdBy: req.user?.id
    });

    res.status(201).json({ success: true, data: container });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'P2002') {
      res.status(409).json({ success: false, error: 'Container with this name already exists' });
      return;
    }
    throw error;
  }
}));

router.get('/containers', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { category, isActive, includePatterns, limit, offset } = req.query;

  const result = await injectionService.listContainers({
    category: getString(category),
    isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    includePatterns: includePatterns !== 'false',
    limit: getInt(limit),
    offset: getInt(offset)
  });

  res.json({ success: true, data: result.containers, total: result.total });
}));

router.get('/containers/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = getRequiredString(req.params.id);
  const includePatterns = req.query.includePatterns !== 'false';

  const container = await injectionService.getContainer(id, includePatterns);

  if (!container) {
    res.status(404).json({ success: false, error: 'Container not found' });
    return;
  }

  const stats = await injectionService.getContainerStats(id);
  res.json({ success: true, data: { ...container, stats } });
}));

router.put('/containers/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = getRequiredString(req.params.id);
  const { name, description, category, icon, color, isActive, isDefault, priority, config, metadata } = req.body;

  const existing = await injectionService.getContainer(id, false);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Container not found' });
    return;
  }

  const container = await injectionService.updateContainer(id, {
    name, description, category, icon, color, isActive, isDefault, priority, config, metadata
  });

  res.json({ success: true, data: container });
}));

router.delete('/containers/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = getRequiredString(req.params.id);

  const existing = await injectionService.getContainer(id, false);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Container not found' });
    return;
  }

  await injectionService.deleteContainer(id);
  res.json({ success: true, message: 'Container deleted successfully' });
}));

// ============================================
// Pattern Routes
// ============================================

router.post('/patterns', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { 
    containerId, name, description, code, codeType, version,
    isDefault, isActive, priority, weight, timeout, retryCount,
    failureAction, preConditions, postActions, tags, metadata 
  } = req.body;

  if (!containerId || !name || !code) {
    res.status(400).json({ success: false, error: 'containerId, name, and code are required' });
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
      createdBy: req.user?.id
    });

    res.status(201).json({ success: true, data: pattern });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'P2002') {
      res.status(409).json({ success: false, error: 'Pattern with this name already exists in the container' });
      return;
    }
    throw error;
  }
}));

router.get('/patterns', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { containerId, isActive, tags, limit, offset } = req.query;
  const tagsStr = getString(tags);

  const result = await injectionService.listPatterns({
    containerId: getString(containerId),
    isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    tags: tagsStr ? tagsStr.split(',') : undefined,
    limit: getInt(limit),
    offset: getInt(offset)
  });

  res.json({ success: true, data: result.patterns, total: result.total });
}));

router.get('/patterns/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = getRequiredString(req.params.id);

  const pattern = await injectionService.getPattern(id);

  if (!pattern) {
    res.status(404).json({ success: false, error: 'Pattern not found' });
    return;
  }

  const successRate = pattern.totalExecutions > 0 
    ? (pattern.successCount / pattern.totalExecutions) * 100 
    : 0;

  res.json({ success: true, data: { ...pattern, successRate: Math.round(successRate * 100) / 100 } });
}));

router.put('/patterns/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = getRequiredString(req.params.id);
  const {
    name, description, code, codeType, version,
    isDefault, isActive, priority, weight, timeout, retryCount,
    failureAction, preConditions, postActions, tags, metadata
  } = req.body;

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

  res.json({ success: true, data: pattern });
}));

router.delete('/patterns/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = getRequiredString(req.params.id);

  const existing = await injectionService.getPattern(id);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Pattern not found' });
    return;
  }

  await injectionService.deletePattern(id);
  res.json({ success: true, message: 'Pattern deleted successfully' });
}));

// ============================================
// Injection Execution Routes
// ============================================

router.post('/inject', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { containerId, patternId, forceDefault, selectionStrategy, input, timeout, iaiInstanceId, missionId, taskId } = req.body;

  if (!containerId && !patternId) {
    res.status(400).json({ success: false, error: 'Either containerId or patternId is required' });
    return;
  }

  const result = await injectionService.inject({
    containerId, patternId, forceDefault, selectionStrategy, input, timeout, iaiInstanceId, missionId, taskId
  });

  res.json({ success: true, data: result });
}));

router.post('/test-pattern/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = getRequiredString(req.params.id);
  const { input } = req.body;

  const pattern = await injectionService.getPattern(id);
  if (!pattern) {
    res.status(404).json({ success: false, error: 'Pattern not found' });
    return;
  }

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
    error = e.message;
  }

  res.json({
    success: true,
    data: { testSuccess: success, executionTimeMs: Date.now() - startTime, output, error }
  });
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

// Error handler
router.use((error: Error, _req: AuthRequest, res: Response, _next: NextFunction) => {
  logger.error('[InjectionRoutes] Error:', error);
  res.status(500).json({ success: false, error: error.message || 'Internal server error' });
});

export default router;
