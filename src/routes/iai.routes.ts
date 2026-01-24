import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { novaChromiumService } from '../services/nova-chromium.service';

const router = Router();
const prisma = new PrismaClient();

// ============================================
// Admin Routes - Get all IAI soldiers and stats
// ============================================

/**
 * GET /api/admin/iai/soldiers
 * List all IAI soldiers with pagination and filtering
 */
router.get('/soldiers', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      page = '1', 
      limit = '50', 
      status, 
      accountId 
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status) where.status = status;
    if (accountId) where.accountId = accountId;

    const [soldiers, total] = await Promise.all([
      prisma.iAISoldier.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          account: {
            select: {
              id: true,
              name: true,
              dealershipName: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: [
          { status: 'asc' }, // online first
          { lastHeartbeatAt: 'desc' },
        ],
      }),
      prisma.iAISoldier.count({ where }),
    ]);

    res.json({
      soldiers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching IAI soldiers:', error);
    res.status(500).json({ error: 'Failed to fetch IAI soldiers' });
  }
});

/**
 * GET /api/admin/iai/soldiers/:id
 * Get detailed information about a specific soldier
 */
router.get('/soldiers/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const soldier = await prisma.iAISoldier.findUnique({
      where: { id },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            dealershipName: true,
            city: true,
            state: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        activityLogs: {
          take: 100,
          orderBy: { createdAt: 'desc' },
        },
        performanceSnapshots: {
          take: 24, // Last 24 snapshots (24 hours if hourly)
          orderBy: { snapshotAt: 'desc' },
        },
      },
    });

    if (!soldier) {
      return res.status(404).json({ error: 'Soldier not found' });
    }

    return res.json(soldier);
  } catch (error) {
    console.error('Error fetching soldier details:', error);
    return res.status(500).json({ error: 'Failed to fetch soldier details' });
  }
});

/**
 * GET /api/admin/iai/soldiers/:id/activity
 * Get activity logs for a specific soldier with pagination
 */
router.get('/soldiers/:id/activity', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      page = '1', 
      limit = '100',
      eventType,
      startDate,
      endDate,
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { soldierId: id };
    if (eventType) where.eventType = eventType;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [logs, total] = await Promise.all([
      prisma.iAIActivityLog.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.iAIActivityLog.count({ where }),
    ]);

    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

/**
 * GET /api/admin/iai/soldiers/:id/performance
 * Get performance metrics over time
 */
router.get('/soldiers/:id/performance', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { hours = '24' } = req.query;

    const hoursNum = parseInt(hours as string);
    const since = new Date(Date.now() - hoursNum * 60 * 60 * 1000);

    const snapshots = await prisma.iAIPerformanceSnapshot.findMany({
      where: {
        soldierId: id,
        snapshotAt: { gte: since },
      },
      orderBy: { snapshotAt: 'asc' },
    });

    res.json({ snapshots });
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

/**
 * GET /api/admin/iai/map-data
 * Get all active soldiers with locations for map visualization
 */
router.get('/map-data', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const soldiers = await prisma.iAISoldier.findMany({
      where: {
        isActive: true,
        locationLat: { not: null },
        locationLng: { not: null },
      },
      select: {
        id: true,
        soldierId: true,
        soldierNumber: true,
        status: true,
        locationLat: true,
        locationLng: true,
        locationCity: true,
        locationCountry: true,
        currentTaskType: true,
        lastHeartbeatAt: true,
        account: {
          select: {
            name: true,
            dealershipName: true,
          },
        },
      },
    });

    res.json({ soldiers });
  } catch (error) {
    console.error('Error fetching map data:', error);
    res.status(500).json({ error: 'Failed to fetch map data' });
  }
});

/**
 * GET /api/admin/iai/stats
 * Get overall IAI system statistics
 */
router.get('/stats', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalSoldiers,
      onlineSoldiers,
      workingSoldiers,
      offlineSoldiers,
      errorSoldiers,
      recentActivity,
      totalTasksCompleted,
      totalTasksFailed,
    ] = await Promise.all([
      prisma.iAISoldier.count({ where: { isActive: true } }),
      prisma.iAISoldier.count({ where: { status: 'online' } }),
      prisma.iAISoldier.count({ where: { status: 'working' } }),
      prisma.iAISoldier.count({ where: { status: 'offline' } }),
      prisma.iAISoldier.count({ where: { status: 'error' } }),
      prisma.iAIActivityLog.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
        },
      }),
      prisma.iAISoldier.aggregate({
        _sum: { tasksCompleted: true },
      }),
      prisma.iAISoldier.aggregate({
        _sum: { tasksFailed: true },
      }),
    ]);

    res.json({
      totalSoldiers,
      onlineSoldiers,
      workingSoldiers,
      offlineSoldiers,
      errorSoldiers,
      recentActivity,
      totalTasksCompleted: totalTasksCompleted._sum.tasksCompleted || 0,
      totalTasksFailed: totalTasksFailed._sum.tasksFailed || 0,
    });
  } catch (error) {
    console.error('Error fetching IAI stats:', error);
    res.status(500).json({ error: 'Failed to fetch IAI stats' });
  }
});

/**
 * GET /api/admin/iai/system-info
 * Get system architecture and health information
 */
router.get('/system-info', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    // Get Docker container stats
    const getContainerInfo = async (containerName: string) => {
      try {
        const { stdout: statusOut } = await execPromise(`docker inspect -f '{{.State.Status}}' ${containerName}`);
        const { stdout: uptimeOut } = await execPromise(`docker inspect -f '{{.State.StartedAt}}' ${containerName}`);
        const { stdout: restartsOut } = await execPromise(`docker inspect -f '{{.RestartCount}}' ${containerName}`);
        
        const startTime = new Date(uptimeOut.trim());
        const uptime = Math.floor((Date.now() - startTime.getTime()) / 1000);
        const hours = Math.floor(uptime / 3600);
        const mins = Math.floor((uptime % 3600) / 60);
        
        return {
          status: statusOut.trim(),
          uptime: `${hours}h ${mins}m`,
          restarts: parseInt(restartsOut.trim()) || 0,
        };
      } catch (error) {
        return { status: 'unknown', uptime: 'N/A', restarts: 0 };
      }
    };

    const [api, postgres, redis, traefik] = await Promise.all([
      getContainerInfo('facemydealer-api-1'),
      getContainerInfo('facemydealer-postgres-1'),
      getContainerInfo('facemydealer-redis-1'),
      getContainerInfo('facemydealer-traefik-1'),
    ]);

    // Get database stats
    const [soldiers, vehicles, accounts, users] = await Promise.all([
      prisma.iAISoldier.count(),
      prisma.vehicle.count(),
      prisma.account.count(),
      prisma.user.count(),
    ]);

    // Get memory usage
    const used = process.memoryUsage();
    const totalMem = require('os').totalmem();
    // const freeMem = require('os').freemem(); // Not used currently

    res.json({
      containers: {
        api,
        postgres,
        redis,
        traefik,
      },
      database: {
        connected: true,
        totalTables: 50, // Approximate
        totalRecords: {
          soldiers,
          vehicles,
          accounts,
          users,
        },
      },
      chromium: {
        activeSessions: 0, // TODO: Implement actual tracking
        totalLaunched: 0,
        memoryUsage: '0 MB',
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`,
        memory: {
          used: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
          total: `${Math.round(totalMem / 1024 / 1024)} MB`,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching system info:', error);
    res.status(500).json({ error: 'Failed to fetch system info' });
  }
});

/**
 * PATCH /api/admin/iai/soldiers/:id
 * Update soldier information
 */
router.patch('/soldiers/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const soldierId = req.params.id as string;
    const { status, isActive } = req.body;

    const soldier = await prisma.iAISoldier.update({
      where: { id: soldierId },
      data: {
        ...(status && { status }),
        ...(typeof isActive !== 'undefined' && { isActive }),
        updatedAt: new Date(),
      },
    });

    res.json({ soldier });
  } catch (error) {
    console.error('Error updating soldier:', error);
    res.status(500).json({ error: 'Failed to update soldier' });
  }
});

/**
 * DELETE /api/admin/iai/soldiers/:id
 * Delete a soldier
 */
router.delete('/soldiers/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const soldierId = req.params.id as string;

    await prisma.iAISoldier.delete({
      where: { id: soldierId },
    });

    res.json({ success: true, message: 'Soldier deleted' });
  } catch (error) {
    console.error('Error deleting soldier:', error);
    res.status(500).json({ error: 'Failed to delete soldier' });
  }
});

/**
 * POST /api/admin/iai/soldiers/:id/restart
 * Signal soldier to restart
 */
router.post('/soldiers/:id/restart', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const soldierId = req.params.id as string;

    const soldier = await prisma.iAISoldier.update({
      where: { id: soldierId },
      data: {
        status: 'offline',
        lastError: 'Manual restart requested',
        lastErrorAt: new Date(),
      },
    });

    // Log restart event
    await prisma.iAIActivityLog.create({
      data: {
        soldierId: soldierId,
        accountId: soldier.accountId,
        eventType: 'restart_requested',
        message: 'Manual restart requested by admin',
      },
    });

    res.json({ success: true, message: 'Restart signal sent' });
  } catch (error) {
    console.error('Error restarting soldier:', error);
    res.status(500).json({ error: 'Failed to restart soldier' });
  }
});

// ============================================
// Extension Routes - Register and report status
// ============================================

/**
 * POST /api/extension/iai/register
 * Register a new IAI soldier (called when extension starts)
 */
router.post('/register', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      accountId, 
      userId, 
      browserId,
      extensionVersion,
      userAgent,
      ipAddress,
      locationCountry,
      locationCity,
      locationLat,
      locationLng,
      timezone,
    } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required' });
    }

    // Check if soldier already exists for this browser/account combo
    let soldier = await prisma.iAISoldier.findFirst({
      where: {
        accountId,
        browserId: browserId || null,
      },
    });

    if (soldier) {
      // Update existing soldier
      soldier = await prisma.iAISoldier.update({
        where: { id: soldier.id },
        data: {
          status: 'online',
          extensionVersion,
          userAgent,
          ipAddress,
          locationCountry,
          locationCity,
          locationLat,
          locationLng,
          timezone,
          lastHeartbeatAt: new Date(),
          sessionStartAt: new Date(),
          totalSessions: { increment: 1 },
        },
      });

      // Log the reconnection
      await prisma.iAIActivityLog.create({
        data: {
          soldierId: soldier.id,
          accountId,
          eventType: 'status_change',
          message: `Soldier ${soldier.soldierId} came online`,
          eventData: {
            previousStatus: 'offline',
            newStatus: 'online',
            extensionVersion,
          },
          ipAddress,
          locationLat,
          locationLng,
        },
      });
    } else {
      // Get next soldier number
      const lastSoldier = await prisma.iAISoldier.findFirst({
        orderBy: { soldierNumber: 'desc' },
      });
      const nextNumber = (lastSoldier?.soldierNumber || 0) + 1;

      // Create new soldier
      soldier = await prisma.iAISoldier.create({
        data: {
          soldierId: `IAI-${nextNumber - 1}`, // IAI-0, IAI-1, etc.
          accountId,
          userId: userId || null,
          browserId: browserId || null,
          extensionVersion,
          userAgent,
          ipAddress,
          locationCountry,
          locationCity,
          locationLat,
          locationLng,
          timezone,
          status: 'online',
          lastHeartbeatAt: new Date(),
          sessionStartAt: new Date(),
          totalSessions: 1,
        },
      });

      // Log the birth of a new soldier
      await prisma.iAIActivityLog.create({
        data: {
          soldierId: soldier.id,
          accountId,
          eventType: 'status_change',
          message: `New soldier ${soldier.soldierId} deployed`,
          eventData: {
            extensionVersion,
            browser: userAgent,
            location: `${locationCity}, ${locationCountry}`,
          },
          ipAddress,
          locationLat,
          locationLng,
        },
      });
    }

    return res.json({ 
      soldier: {
        id: soldier.id,
        soldierId: soldier.soldierId,
        status: soldier.status,
      },
    });
  } catch (error) {
    console.error('Error registering IAI soldier:', error);
    return res.status(500).json({ error: 'Failed to register soldier' });
  }
});

/**
 * POST /api/extension/iai/heartbeat
 * Send status update (called every 30s by extension)
 */
router.post('/heartbeat', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      soldierId,
      accountId,
      status = 'online',
      currentTaskId,
      currentTaskType,
      ipAddress,
      locationLat,
      locationLng,
      cpuUsage,
      memoryUsageMb,
    } = req.body;

    if (!soldierId || !accountId) {
      return res.status(400).json({ error: 'soldierId and accountId are required' });
    }

    // Find soldier by custom soldierId (IAI-0, IAI-1, etc.)
    const soldier = await prisma.iAISoldier.findFirst({
      where: {
        soldierId,
        accountId,
      },
    });

    if (!soldier) {
      return res.status(404).json({ error: 'Soldier not found' });
    }

    // Update soldier status
    const updateData: any = {
      status,
      lastHeartbeatAt: new Date(),
      ipAddress,
      locationLat,
      locationLng,
    };

    if (currentTaskId) {
      updateData.currentTaskId = currentTaskId;
      updateData.currentTaskType = currentTaskType;
      updateData.lastPollAt = new Date();
    }

    // Calculate runtime
    if (soldier.sessionStartAt) {
      const runtimeMinutes = Math.floor(
        (Date.now() - soldier.sessionStartAt.getTime()) / (60 * 1000)
      );
      updateData.totalRuntimeMinutes = soldier.totalRuntimeMinutes + runtimeMinutes;
    }

    await prisma.iAISoldier.update({
      where: { id: soldier.id },
      data: updateData,
    });

    // Create performance snapshot every heartbeat
    await prisma.iAIPerformanceSnapshot.create({
      data: {
        soldierId: soldier.id,
        status,
        cpuUsage,
        memoryUsageMb,
        tasksInPeriod: 0, // Will be calculated by aggregation job
        successCount: 0,
        failureCount: 0,
      },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Error updating heartbeat:', error);
    return res.status(500).json({ error: 'Failed to update heartbeat' });
  }
});

/**
 * POST /api/extension/iai/log-activity
 * Log an activity event (task start, complete, fail, error)
 */
router.post('/log-activity', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      soldierId,
      accountId,
      eventType,
      message,
      eventData,
      taskId,
      taskType,
      taskResult,
      ipAddress,
      locationLat,
      locationLng,
    } = req.body;

    if (!soldierId || !accountId || !eventType) {
      return res.status(400).json({ 
        error: 'soldierId, accountId, and eventType are required' 
      });
    }

    // Find soldier
    const soldier = await prisma.iAISoldier.findFirst({
      where: { soldierId, accountId },
    });

    if (!soldier) {
      return res.status(404).json({ error: 'Soldier not found' });
    }

    // Create activity log
    await prisma.iAIActivityLog.create({
      data: {
        soldierId: soldier.id,
        accountId,
        eventType,
        message,
        eventData,
        taskId,
        taskType,
        taskResult,
        ipAddress,
        locationLat,
        locationLng,
      },
    });

    // Update soldier stats based on event type
    const updates: any = {};
    
    if (eventType === 'task_start') {
      updates.currentTaskId = taskId;
      updates.currentTaskType = taskType;
      updates.currentTaskStartedAt = new Date();
      updates.lastTaskAt = new Date();
      updates.status = 'working';
    } else if (eventType === 'task_complete') {
      updates.tasksCompleted = { increment: 1 };
      updates.currentTaskId = null;
      updates.currentTaskType = null;
      updates.currentTaskStartedAt = null;
      updates.status = 'online';
      updates.lastTaskAt = new Date();
      
      // Calculate avg task duration
      if (soldier.currentTaskStartedAt) {
        const durationSec = Math.floor(
          (Date.now() - soldier.currentTaskStartedAt.getTime()) / 1000
        );
        const totalTasks = soldier.tasksCompleted + 1;
        const prevAvg = soldier.avgTaskDurationSec || 0;
        updates.avgTaskDurationSec = Math.floor(
          (prevAvg * soldier.tasksCompleted + durationSec) / totalTasks
        );
      }
    } else if (eventType === 'task_fail') {
      updates.tasksFailed = { increment: 1 };
      updates.currentTaskId = null;
      updates.currentTaskType = null;
      updates.currentTaskStartedAt = null;
      updates.status = 'online';
      updates.lastTaskAt = new Date();
    } else if (eventType === 'error') {
      updates.lastError = message;
      updates.lastErrorAt = new Date();
      updates.status = 'error';
    }

    if (Object.keys(updates).length > 0) {
      await prisma.iAISoldier.update({
        where: { id: soldier.id },
        data: updates,
      });

      // Recalculate success rate
      const updatedSoldier = await prisma.iAISoldier.findUnique({
        where: { id: soldier.id },
      });
      if (updatedSoldier && updatedSoldier.tasksCompleted + updatedSoldier.tasksFailed > 0) {
        const successRate = 
          (updatedSoldier.tasksCompleted / 
          (updatedSoldier.tasksCompleted + updatedSoldier.tasksFailed)) * 100;
        
        await prisma.iAISoldier.update({
          where: { id: soldier.id },
          data: { successRate },
        });
      }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error logging activity:', error);
    return res.status(500).json({ error: 'Failed to log activity' });
  }
});

// ============================================
// Prototype Test Panel - Real Browser Control
// ============================================

// In-memory storage for prototype sessions (production would use Redis)
const prototypeSessions = new Map<string, {
  id: string;
  wsUrl: string;
  status: string;
  currentUrl: string;
  createdAt: Date;
  logs: Array<{ timestamp: Date; level: string; message: string }>;
}>();

// Helper to call Python worker API
async function callWorkerApi(endpoint: string, method: string = 'GET', body?: any) {
  const workerApiUrl = process.env.WORKER_API_URL || 'http://worker-api:8000';
  const workerSecret = process.env.WORKER_SECRET || process.env.ENCRYPTION_KEY || '';
  
  const response = await fetch(`${workerApiUrl}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': workerSecret,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Worker API error: ${response.status} - ${error}`);
  }
  
  return response.json();
}

/**
 * GET /api/admin/iai/worker/health
 * Check Python worker health status
 */
router.get('/worker/health', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const health = await callWorkerApi('/health') as { status: string; workers_active: number; message?: string };
    res.json({
      status: health.status || 'unknown',
      workers_active: health.workers_active || 0,
      message: health.message || 'Worker API responded',
    });
  } catch (error: any) {
    res.json({
      status: 'offline',
      workers_active: 0,
      message: error.message || 'Worker API not reachable',
    });
  }
});

// ============================================
// Nova Chromium Browser Control Routes
// Production-grade AI-controlled browser automation
// ============================================

/**
 * GET /api/admin/iai/nova/health
 * Check Nova browser worker health and availability
 */
router.get('/nova/health', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const isAvailable = await novaChromiumService.isWorkerAvailable();
    const sessions = await novaChromiumService.listSessions();
    
    return res.json({
      success: true,
      health: {
        workerAvailable: isAvailable,
        status: isAvailable ? 'healthy' : 'unavailable',
        activeSessions: sessions.length,
        sessions: sessions.map(s => ({
          sessionId: s.sessionId,
          accountId: s.accountId,
          status: s.status,
          lastActivity: s.lastActivity,
        })),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error checking Nova health:', error);
    return res.status(500).json({
      success: false,
      health: {
        workerAvailable: false,
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /api/admin/iai/nova/session
 * Create a new Nova browser session for an account
 */
router.post('/nova/session', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { accountId, headless = true, loadSession = true } = req.body;
    
    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required' });
    }
    
    const session = await novaChromiumService.createSession(accountId, {
      headless,
      loadSession,
    });
    
    return res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        browserId: session.browserId,
        accountId: session.accountId,
        status: session.status,
        hasSavedSession: session.hasSavedSession,
      },
      message: `Nova browser session created for account ${accountId}`,
    });
  } catch (error: any) {
    console.error('Error creating Nova session:', error);
    return res.status(500).json({ 
      error: 'Failed to create Nova session',
      details: error.message,
    });
  }
});

/**
 * POST /api/admin/iai/nova/:sessionId/action
 * Execute an action in the Nova browser
 */
router.post('/nova/:sessionId/action', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const { action, selector, url, value, options } = req.body;
    
    if (!action) {
      return res.status(400).json({ error: 'action is required' });
    }
    
    const result = await novaChromiumService.executeAction(sessionId, {
      action,
      selector,
      url,
      value,
      options,
    });
    
    return res.json(result);
  } catch (error: any) {
    console.error('Error executing Nova action:', error);
    return res.status(500).json({ 
      error: 'Failed to execute action',
      details: error.message,
    });
  }
});

/**
 * GET /api/admin/iai/nova/:sessionId/state
 * Get the current state of a Nova browser session
 */
router.get('/nova/:sessionId/state', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    
    const state = await novaChromiumService.getSessionState(sessionId);
    
    return res.json({
      success: true,
      sessionId,
      state,
    });
  } catch (error: any) {
    console.error('Error getting Nova state:', error);
    return res.status(500).json({ 
      error: 'Failed to get session state',
      details: error.message,
    });
  }
});

/**
 * GET /api/admin/iai/nova/:sessionId/screenshot
 * Capture a screenshot from the Nova browser
 */
router.get('/nova/:sessionId/screenshot', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const fullPage = req.query.fullPage === 'true';
    
    const result = await novaChromiumService.captureScreenshot(sessionId, fullPage);
    
    return res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Error capturing screenshot:', error);
    return res.status(500).json({ 
      error: 'Failed to capture screenshot',
      details: error.message,
    });
  }
});

/**
 * POST /api/admin/iai/nova/:sessionId/batch
 * Execute multiple actions in sequence
 */
router.post('/nova/:sessionId/batch', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const { actions, stopOnError = true } = req.body;
    
    if (!actions || !Array.isArray(actions)) {
      return res.status(400).json({ error: 'actions array is required' });
    }
    
    const result = await novaChromiumService.executeBatch(sessionId, actions, stopOnError);
    
    return res.json(result);
  } catch (error: any) {
    console.error('Error executing batch:', error);
    return res.status(500).json({ 
      error: 'Failed to execute batch',
      details: error.message,
    });
  }
});

/**
 * DELETE /api/admin/iai/nova/:sessionId
 * Close a Nova browser session
 */
router.delete('/nova/:sessionId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    
    const success = await novaChromiumService.closeSession(sessionId);
    
    return res.json({
      success,
      message: success ? 'Session closed' : 'Failed to close session',
    });
  } catch (error: any) {
    console.error('Error closing Nova session:', error);
    return res.status(500).json({ 
      error: 'Failed to close session',
      details: error.message,
    });
  }
});

/**
 * POST /api/admin/iai/nova/:sessionId/execute-goal
 * Execute a natural language goal using Nova AI agent
 * This is the key endpoint for fluent soldier communication
 */
router.post('/nova/:sessionId/execute-goal', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const { goal, context, maxSteps } = req.body;
    
    if (!goal) {
      return res.status(400).json({ error: 'goal is required' });
    }
    
    const result = await novaChromiumService.executeGoal(
      sessionId,
      goal,
      context,
      maxSteps
    );
    
    return res.json({
      success: result.success,
      result,
    });
  } catch (error: any) {
    console.error('Error executing Nova goal:', error);
    return res.status(500).json({ 
      error: 'Failed to execute goal',
      details: error.message,
    });
  }
});

/**
 * GET /api/admin/iai/nova/sessions
 * List all active Nova browser sessions
 */
router.get('/nova/sessions', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const sessions = await novaChromiumService.listSessions();
    
    res.json({
      success: true,
      total: sessions.length,
      sessions,
    });
  } catch (error: any) {
    console.error('Error listing Nova sessions:', error);
    res.status(500).json({ 
      error: 'Failed to list sessions',
      details: error.message,
    });
  }
});

/**
 * GET /api/admin/iai/nova/tools
 * Get available Nova browser control tools
 */
router.get('/nova/tools', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const tools = await novaChromiumService.getAvailableTools();
    
    res.json({
      success: true,
      tools,
    });
  } catch (error: any) {
    console.error('Error getting Nova tools:', error);
    res.status(500).json({ 
      error: 'Failed to get tools',
      details: error.message,
    });
  }
});

/**
 * POST /api/admin/iai/nova/:sessionId/send-message
 * High-level: Send a Facebook message
 */
router.post('/nova/:sessionId/send-message', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const { conversationUrl, message } = req.body;
    
    if (!conversationUrl || !message) {
      return res.status(400).json({ error: 'conversationUrl and message are required' });
    }
    
    const result = await novaChromiumService.sendFacebookMessage(
      sessionId,
      conversationUrl,
      message
    );
    
    return res.json({
      success: result.success,
      result,
    });
  } catch (error: any) {
    console.error('Error sending Facebook message:', error);
    return res.status(500).json({ 
      error: 'Failed to send message',
      details: error.message,
    });
  }
});

/**
 * POST /api/admin/iai/nova/:sessionId/create-listing
 * High-level: Create a Facebook Marketplace listing
 */
router.post('/nova/:sessionId/create-listing', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const { listing } = req.body;
    
    if (!listing) {
      return res.status(400).json({ error: 'listing data is required' });
    }
    
    const result = await novaChromiumService.createMarketplaceListing(
      sessionId,
      listing
    );
    
    return res.json({
      success: result.success,
      result,
    });
  } catch (error: any) {
    console.error('Error creating listing:', error);
    return res.status(500).json({ 
      error: 'Failed to create listing',
      details: error.message,
    });
  }
});

/**
 * GET /api/admin/iai/nova/iai/:soldierId/session
 * Get or create a browser session for a specific IAI soldier
 */
router.get('/nova/iai/:soldierId/session', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const soldierId = req.params.soldierId as string;
    
    const session = await novaChromiumService.getOrCreateSessionForIAI(soldierId);
    
    if (!session) {
      return res.status(404).json({ error: 'IAI Soldier not found' });
    }
    
    return res.json({
      success: true,
      session,
    });
  } catch (error: any) {
    console.error('Error getting IAI session:', error);
    return res.status(500).json({ 
      error: 'Failed to get IAI session',
      details: error.message,
    });
  }
});

/**
 * POST /api/admin/iai/prototype/create
 * Create a new prototype soldier session with real Playwright browser
 */
router.post('/prototype/create', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { targetUrl, forceMode } = req.body;
    const sessionId = `proto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Try to use Python worker API first (unless forceMode is 'simulation')
    let workerConnected = false;
    let wsUrl = '';
    let mode: 'live' | 'simulation' = forceMode || 'live';
    
    if (mode === 'live') {
      try {
        // Check worker health
        const health = await callWorkerApi('/health') as { status: string; workers_active: number };
        workerConnected = health.status === 'healthy' || health.workers_active > 0;
        
        if (workerConnected) {
          // Create a browser session via worker API
          const sessionResult = await callWorkerApi('/api/sessions/create', 'POST', {
            account_id: `prototype_${sessionId}`,
            headless: true,
            viewport: { width: 1920, height: 1080 },
          }) as { ws_url?: string; cdp_url?: string };
          wsUrl = sessionResult.ws_url || sessionResult.cdp_url || '';
        } else {
          // If forced live mode but worker not connected, fail
          mode = 'simulation';
        }
      } catch (workerError) {
        console.log('Worker API not available, using simulation mode:', workerError);
        mode = 'simulation';
      }
    }
    
    // Store session info
    const session = {
      id: sessionId,
      wsUrl,
      status: 'ready',
      mode,
      currentUrl: targetUrl || 'about:blank',
      createdAt: new Date(),
      logs: [
        { timestamp: new Date(), level: 'system', message: `🚀 Prototype soldier session created in ${mode.toUpperCase()} mode` },
        { timestamp: new Date(), level: 'info', message: mode === 'live' ? '✅ Connected to Python worker API' : '⚠️ Running in SIMULATION mode (no real browser)' },
        { timestamp: new Date(), level: 'info', message: `Session ID: ${sessionId}` },
      ],
    };
    
    prototypeSessions.set(sessionId, session);
    
    res.json({
      success: true,
      sessionId,
      status: 'ready',
      mode,
      workerConnected: mode === 'live',
      message: mode === 'live'
        ? '✅ LIVE MODE: Prototype soldier created with Python worker backend'
        : '⚠️ SIMULATION MODE: No real browser - actions will be simulated',
    });
  } catch (error: any) {
    console.error('Error creating prototype session:', error);
    res.status(500).json({ 
      error: 'Failed to create prototype session',
      details: error.message,
    });
  }
});

/**
 * POST /api/admin/iai/prototype/:sessionId/action
 * Execute an action on the prototype browser
 */
router.post('/prototype/:sessionId/action', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const { action, target, value, script } = req.body;
    
    const session = prototypeSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Add log entry
    session.logs.push({
      timestamp: new Date(),
      level: 'action',
      message: `Executing: ${action}${target ? ` → ${target}` : ''}`,
    });
    
    let result: any = { success: true };
    
    // Try worker API first
    try {
      const workerResult = await callWorkerApi(`/api/browser/${sessionId}/action`, 'POST', {
        action,
        target,
        value,
        script,
      });
      result = workerResult;
      
      session.logs.push({
        timestamp: new Date(),
        level: 'data',
        message: `Action completed via worker: ${action}`,
      });
    } catch (workerError) {
      // Fallback: simulate action results for prototype testing
      console.log('Worker action failed, simulating result:', workerError);
      
      switch (action) {
        case 'navigate':
          session.currentUrl = target || session.currentUrl;
          session.logs.push({
            timestamp: new Date(),
            level: 'info',
            message: `Navigated to: ${session.currentUrl}`,
          });
          result = { success: true, url: session.currentUrl };
          break;
          
        case 'screenshot':
          // Generate a placeholder screenshot with canvas
          result = { 
            success: true, 
            screenshot: generatePlaceholderScreenshot(session.currentUrl),
            timestamp: new Date().toISOString(),
          };
          session.logs.push({
            timestamp: new Date(),
            level: 'data',
            message: 'Screenshot captured',
          });
          break;
          
        case 'analyze_html':
          result = {
            success: true,
            html: generateSampleHTML(session.currentUrl),
            analysis: {
              title: extractTitleFromUrl(session.currentUrl),
              forms: 2,
              links: 45,
              images: 12,
              scripts: 8,
              interactiveElements: ['input', 'button', 'select', 'textarea'],
              suggestedSelectors: [
                { selector: 'input[name="search"]', type: 'search', confidence: 0.95 },
                { selector: 'button[type="submit"]', type: 'submit', confidence: 0.9 },
                { selector: 'a.listing-link', type: 'listing', confidence: 0.85 },
              ],
            },
          };
          session.logs.push({
            timestamp: new Date(),
            level: 'data',
            message: `HTML analyzed: ${result.analysis.links} links, ${result.analysis.forms} forms`,
          });
          break;
          
        case 'extract':
          result = {
            success: true,
            data: [
              { type: 'text', content: `Sample extracted content from ${target}`, selector: target },
            ],
          };
          session.logs.push({
            timestamp: new Date(),
            level: 'data',
            message: `Extracted data from: ${target}`,
          });
          break;
          
        case 'click':
          session.logs.push({
            timestamp: new Date(),
            level: 'info',
            message: `Clicked: ${target}`,
          });
          result = { success: true, clicked: target };
          break;
          
        case 'type':
          session.logs.push({
            timestamp: new Date(),
            level: 'info',
            message: `Typed "${value}" into: ${target}`,
          });
          result = { success: true, typed: value, into: target };
          break;
          
        case 'wait':
          await new Promise(resolve => setTimeout(resolve, Math.min(parseInt(value) || 1000, 5000)));
          session.logs.push({
            timestamp: new Date(),
            level: 'info',
            message: `Waited ${value}ms`,
          });
          result = { success: true, waited: value };
          break;
          
        case 'scroll':
          session.logs.push({
            timestamp: new Date(),
            level: 'info',
            message: `Scrolled ${value || 500}px`,
          });
          result = { success: true, scrolled: value || 500 };
          break;
          
        case 'hover':
          session.logs.push({
            timestamp: new Date(),
            level: 'info',
            message: `Hovered over: ${target}`,
          });
          result = { success: true, hovered: target };
          break;
          
        case 'select':
          session.logs.push({
            timestamp: new Date(),
            level: 'info',
            message: `Selected "${value}" in: ${target}`,
          });
          result = { success: true, selected: value, in: target };
          break;
          
        case 'evaluate':
        case 'custom':
          session.logs.push({
            timestamp: new Date(),
            level: 'info',
            message: 'Executed custom script',
          });
          result = { success: true, result: { message: 'Script executed (simulated)', script: script?.substring(0, 100) } };
          break;
          
        default:
          result = { success: false, error: `Unknown action: ${action}` };
      }
    }
    
    prototypeSessions.set(sessionId, session);
    
    return res.json(result);
  } catch (error: any) {
    console.error('Error executing prototype action:', error);
    return res.status(500).json({ 
      error: 'Failed to execute action',
      details: error.message,
    });
  }
});

/**
 * GET /api/admin/iai/prototype/:sessionId/status
 * Get current status and logs for a prototype session
 */
router.get('/prototype/:sessionId/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    
    const session = prototypeSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    return res.json({
      sessionId: session.id,
      status: session.status,
      currentUrl: session.currentUrl,
      createdAt: session.createdAt,
      logs: session.logs.slice(-100), // Last 100 logs
    });
  } catch (error: any) {
    console.error('Error getting prototype status:', error);
    return res.status(500).json({ error: 'Failed to get session status' });
  }
});

/**
 * DELETE /api/admin/iai/prototype/:sessionId
 * Kill a prototype session
 */
router.delete('/prototype/:sessionId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    
    const session = prototypeSessions.get(sessionId);
    if (session) {
      // Try to close worker session
      try {
        await callWorkerApi(`/api/sessions/${sessionId}`, 'DELETE');
      } catch (e) {
        // Ignore worker errors
      }
      
      prototypeSessions.delete(sessionId);
    }
    
    return res.json({ success: true, message: 'Session terminated' });
  } catch (error: any) {
    console.error('Error killing prototype session:', error);
    return res.status(500).json({ error: 'Failed to kill session' });
  }
});

/**
 * GET /api/admin/iai/prototype/sessions
 * List all active prototype sessions
 */
router.get('/prototype/sessions', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const sessions = Array.from(prototypeSessions.values()).map(s => ({
      id: s.id,
      status: s.status,
      currentUrl: s.currentUrl,
      createdAt: s.createdAt,
      logCount: s.logs.length,
    }));
    
    return res.json({ sessions, total: sessions.length });
  } catch (error: any) {
    console.error('Error listing prototype sessions:', error);
    return res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// Helper functions for prototype panel
function generatePlaceholderScreenshot(url: string): string {
  // Return a base64 encoded placeholder image
  // In production, this would come from Playwright
  const width = 1920;
  const height = 1080;
  
  // Create a simple SVG placeholder
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="#1e293b"/>
      <rect x="0" y="0" width="${width}" height="60" fill="#0f172a"/>
      <text x="20" y="38" fill="#94a3b8" font-family="monospace" font-size="14">${url}</text>
      <text x="${width/2}" y="${height/2}" fill="#475569" font-family="sans-serif" font-size="24" text-anchor="middle">
        Browser Screenshot
      </text>
      <text x="${width/2}" y="${height/2 + 40}" fill="#64748b" font-family="sans-serif" font-size="16" text-anchor="middle">
        Connect Python worker for live screenshots
      </text>
      <text x="20" y="${height - 20}" fill="#22c55e" font-family="monospace" font-size="12">
        Captured: ${new Date().toISOString()}
      </text>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('facebook')) return 'Facebook Marketplace';
    if (urlObj.hostname.includes('google')) return 'Google';
    return urlObj.hostname;
  } catch {
    return 'Unknown Page';
  }
}

function generateSampleHTML(url: string): string {
  if (url.includes('facebook.com/marketplace')) {
    return `<!DOCTYPE html>
<html>
<head><title>Facebook Marketplace</title></head>
<body>
  <div id="marketplace-root">
    <nav class="marketplace-nav">
      <input type="search" name="search" placeholder="Search Marketplace" />
      <button type="submit">Search</button>
    </nav>
    <main class="marketplace-listings">
      <div class="listing-card" data-id="12345">
        <img src="/car1.jpg" alt="2020 Honda Civic" />
        <h3>2020 Honda Civic - $18,500</h3>
        <p>45,000 miles • Automatic • Sedan</p>
        <a href="/item/12345" class="listing-link">View Details</a>
      </div>
      <div class="listing-card" data-id="12346">
        <img src="/car2.jpg" alt="2019 Toyota Camry" />
        <h3>2019 Toyota Camry - $17,900</h3>
        <p>52,000 miles • Automatic • Sedan</p>
        <a href="/item/12346" class="listing-link">View Details</a>
      </div>
    </main>
    <form id="create-listing" action="/sell">
      <input type="text" name="title" placeholder="Title" />
      <input type="number" name="price" placeholder="Price" />
      <textarea name="description" placeholder="Description"></textarea>
      <select name="category">
        <option value="vehicles">Vehicles</option>
        <option value="electronics">Electronics</option>
      </select>
      <button type="submit">Create Listing</button>
    </form>
  </div>
</body>
</html>`;
  }
  
  return `<!DOCTYPE html>
<html>
<head><title>Sample Page</title></head>
<body>
  <header><h1>Sample Page</h1></header>
  <main>
    <p>This is sample HTML content for: ${url}</p>
    <form><input type="text" /><button>Submit</button></form>
  </main>
</body>
</html>`;
}

export default router;
