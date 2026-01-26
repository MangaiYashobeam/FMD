/**
 * Mission Control Routes
 * API endpoints for mission planning, scheduling, and execution.
 */

import { Router, Response, NextFunction, Request } from 'express';
import { missionControlService, missionEvents } from '../services/mission-control.service';
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
// Mission Routes
// ============================================

router.post('/missions', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { 
    name, description, type, status, priority, containerId, scheduleType,
    cronExpression, intervalMinutes, timezone, startDate, endDate,
    maxConcurrency, retryPolicy, maxRetries, alertOnFailure, alertOnSuccess,
    abortOnTaskFail, tags, config, metadata 
  } = req.body;

  if (!name) {
    res.status(400).json({ success: false, error: 'Mission name is required' });
    return;
  }

  try {
    const mission = await missionControlService.createMission({
      name,
      description,
      type: type || 'manual',
      status,
      priority,
      containerId,
      scheduleType,
      cronExpression,
      intervalMinutes,
      timezone,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      maxConcurrency,
      retryPolicy,
      maxRetries,
      alertOnFailure,
      alertOnSuccess,
      abortOnTaskFail,
      tags,
      config,
      metadata,
      createdBy: req.user?.id
    });

    res.status(201).json({ success: true, data: mission });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'P2002') {
      res.status(409).json({ success: false, error: 'Mission with this name already exists' });
      return;
    }
    throw error;
  }
}));

router.get('/missions', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { type, status, containerId, includeTasks, limit, offset } = req.query;

  const result = await missionControlService.listMissions({
    type: getString(type),
    status: getString(status),
    containerId: getString(containerId),
    includeTasks: includeTasks !== 'false',
    limit: getInt(limit),
    offset: getInt(offset)
  });

  res.json({ success: true, data: result.missions, total: result.total });
}));

router.get('/missions/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = getRequiredString(req.params.id);
  const includeTasks = req.query.includeTasks !== 'false';

  const mission = await missionControlService.getMission(id, includeTasks);

  if (!mission) {
    res.status(404).json({ success: false, error: 'Mission not found' });
    return;
  }

  res.json({ success: true, data: mission });
}));

router.put('/missions/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = getRequiredString(req.params.id);
  const {
    name, description, type, status, priority, containerId, scheduleType,
    cronExpression, intervalMinutes, timezone, startDate, endDate,
    maxConcurrency, retryPolicy, maxRetries, alertOnFailure, alertOnSuccess,
    abortOnTaskFail, tags, config, metadata
  } = req.body;

  const existing = await missionControlService.getMission(id, false);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Mission not found' });
    return;
  }

  const mission = await missionControlService.updateMission(id, {
    name, description, type, status, priority, containerId, scheduleType,
    cronExpression, intervalMinutes, timezone,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    maxConcurrency, retryPolicy, maxRetries, alertOnFailure, alertOnSuccess,
    abortOnTaskFail, tags, config, metadata
  });

  res.json({ success: true, data: mission });
}));

router.delete('/missions/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = getRequiredString(req.params.id);

  const existing = await missionControlService.getMission(id, false);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Mission not found' });
    return;
  }

  if (existing.status === 'running') {
    res.status(400).json({ success: false, error: 'Cannot delete a running mission' });
    return;
  }

  await missionControlService.deleteMission(id);
  res.json({ success: true, message: 'Mission deleted successfully' });
}));

// ============================================
// Task Routes
// ============================================

router.post('/missions/:missionId/tasks', asyncHandler(async (req: AuthRequest, res: Response) => {
  const missionId = getRequiredString(req.params.missionId);
  const {
    name, description, patternId, taskType,
    order, timeout, retryCount, dependsOn,
    condition, skipOnCondition, config, input, isActive
  } = req.body;

  const mission = await missionControlService.getMission(missionId, false);
  if (!mission) {
    res.status(404).json({ success: false, error: 'Mission not found' });
    return;
  }

  if (!name) {
    res.status(400).json({ success: false, error: 'Task name is required' });
    return;
  }

  const task = await missionControlService.addTask(missionId, {
    name, description, patternId, taskType,
    order, timeout, retryCount, dependsOn,
    condition, skipOnCondition, config, input, isActive
  });

  res.status(201).json({ success: true, data: task });
}));

router.put('/tasks/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = getRequiredString(req.params.id);
  const {
    name, description, patternId, taskType,
    order, timeout, retryCount, dependsOn,
    condition, skipOnCondition, config, input, isActive
  } = req.body;

  const task = await missionControlService.updateTask(id, {
    name, description, patternId, taskType,
    order, timeout, retryCount, dependsOn,
    condition, skipOnCondition, config, input, isActive
  });

  if (!task) {
    res.status(404).json({ success: false, error: 'Task not found' });
    return;
  }

  res.json({ success: true, data: task });
}));

router.delete('/tasks/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = getRequiredString(req.params.id);

  await missionControlService.deleteTask(id);
  res.json({ success: true, message: 'Task deleted successfully' });
}));

// ============================================
// Mission Execution Routes
// ============================================

router.post('/missions/:id/execute', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = getRequiredString(req.params.id);
  const { input, triggeredBy } = req.body;

  const mission = await missionControlService.getMission(id, false);
  if (!mission) {
    res.status(404).json({ success: false, error: 'Mission not found' });
    return;
  }

  const execution = await missionControlService.executeMission(id, {
    input,
    triggeredBy,
    triggeredUserId: req.user?.id
  });
  res.json({ success: true, data: execution });
}));

router.post('/missions/:id/pause', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = getRequiredString(req.params.id);

  const mission = await missionControlService.getMission(id, false);
  if (!mission) {
    res.status(404).json({ success: false, error: 'Mission not found' });
    return;
  }

  if (mission.status !== 'running') {
    res.status(400).json({ success: false, error: 'Mission is not running' });
    return;
  }

  const paused = await missionControlService.pauseMission(id);
  res.json({ success: true, data: paused });
}));

router.post('/missions/:id/resume', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = getRequiredString(req.params.id);

  const mission = await missionControlService.getMission(id, false);
  if (!mission) {
    res.status(404).json({ success: false, error: 'Mission not found' });
    return;
  }

  if (mission.status !== 'paused') {
    res.status(400).json({ success: false, error: 'Mission is not paused' });
    return;
  }

  const resumed = await missionControlService.resumeMission(id);
  res.json({ success: true, data: resumed });
}));

// ============================================
// Execution Logs Routes
// ============================================

router.get('/missions/:id/executions', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = getRequiredString(req.params.id);
  const { limit, offset } = req.query;

  const result = await missionControlService.getExecutionLogs(id, {
    limit: getInt(limit),
    offset: getInt(offset)
  });

  res.json({ success: true, data: result.executions, total: result.total });
}));

// ============================================
// Template Routes
// ============================================

router.get('/templates', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const templates = [
    {
      id: 'fbm_posting',
      name: 'FBM Auto-Posting',
      description: 'Automated Facebook Marketplace posting flow',
      type: 'fbm_flow',
      defaultTasks: [
        { name: 'Load Inventory', taskType: 'pattern', order: 1 },
        { name: 'Select Items', taskType: 'pattern', order: 2 },
        { name: 'Generate Listings', taskType: 'pattern', order: 3 },
        { name: 'Post to FBM', taskType: 'pattern', order: 4 },
        { name: 'Verify Posts', taskType: 'pattern', order: 5 }
      ]
    },
    {
      id: 'message_response',
      name: 'Auto-Response System',
      description: 'Automated message response flow',
      type: 'messaging',
      defaultTasks: [
        { name: 'Fetch Messages', taskType: 'pattern', order: 1 },
        { name: 'Classify Intent', taskType: 'pattern', order: 2 },
        { name: 'Generate Response', taskType: 'pattern', order: 3 },
        { name: 'Send Response', taskType: 'pattern', order: 4 },
        { name: 'Log Interaction', taskType: 'pattern', order: 5 }
      ]
    },
    {
      id: 'analytics_collection',
      name: 'Analytics Collection',
      description: 'Data collection and analysis pipeline',
      type: 'analytics',
      defaultTasks: [
        { name: 'Collect Data', taskType: 'pattern', order: 1 },
        { name: 'Process Data', taskType: 'pattern', order: 2 },
        { name: 'Generate Report', taskType: 'pattern', order: 3 },
        { name: 'Store Results', taskType: 'pattern', order: 4 }
      ]
    }
  ];

  res.json({ success: true, data: templates });
}));

// ============================================
// Statistics Routes
// ============================================

router.get('/stats', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const stats = await missionControlService.getMissionStats();
  res.json({ success: true, data: stats });
}));

// ============================================
// Real-time Events (SSE)
// ============================================

router.get('/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('connected', { message: 'Connected to mission events' });

  const onMissionUpdate = (data: unknown) => sendEvent('mission-update', data);
  const onTaskUpdate = (data: unknown) => sendEvent('task-update', data);
  const onExecutionComplete = (data: unknown) => sendEvent('execution-complete', data);

  missionEvents.on('mission-update', onMissionUpdate);
  missionEvents.on('task-update', onTaskUpdate);
  missionEvents.on('execution-complete', onExecutionComplete);

  const keepAlive = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
    missionEvents.off('mission-update', onMissionUpdate);
    missionEvents.off('task-update', onTaskUpdate);
    missionEvents.off('execution-complete', onExecutionComplete);
  });
});

// Error handler
router.use((error: Error, _req: AuthRequest, res: Response, _next: NextFunction) => {
  logger.error('[MissionControlRoutes] Error:', error);
  res.status(500).json({ success: false, error: error.message || 'Internal server error' });
});

export default router;
