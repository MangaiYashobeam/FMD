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

// Error handler
router.use((error: Error, _req: AuthRequest, res: Response, _next: NextFunction) => {
  logger.error('[InjectionRoutes] Error:', error);
  res.status(500).json({ success: false, error: error.message || 'Internal server error' });
});

export default router;
