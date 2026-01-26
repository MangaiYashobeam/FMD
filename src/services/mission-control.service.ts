/**
 * Mission Control Service
 * 
 * Comprehensive mission management system for IAI.
 * Handles mission planning, scheduling, execution, and monitoring.
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';
import { injectionService } from './injection.service';
import * as cron from 'node-cron';

const prisma = new PrismaClient();

// Types
export interface Mission {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  priority: number;
  containerId: string | null;
  scheduleType: string | null;
  cronExpression: string | null;
  intervalMinutes: number | null;
  timezone: string;
  startDate: Date | null;
  endDate: Date | null;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  maxConcurrency: number;
  retryPolicy: string;
  maxRetries: number;
  alertOnFailure: boolean;
  alertOnSuccess: boolean;
  abortOnTaskFail: boolean;
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  avgDurationMs: number;
  tags: string[];
  config: Record<string, any>;
  metadata: Record<string, any>;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  tasks?: MissionTask[];
}

export interface MissionTask {
  id: string;
  missionId: string;
  patternId: string | null;
  name: string;
  description: string | null;
  taskType: string;
  order: number;
  config: Record<string, any>;
  input: Record<string, any>;
  timeout: number;
  retryCount: number;
  condition: string | null;
  skipOnCondition: boolean;
  dependsOn: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MissionExecution {
  id: string;
  missionId: string;
  status: string;
  triggeredBy: string | null;
  triggeredUserId: string | null;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  tasksTotal: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksSkipped: number;
  output: any;
  error: string | null;
  logs: any[];
  createdAt: Date;
}

export interface ExecutionResult {
  success: boolean;
  executionId: string;
  missionId: string;
  status: string;
  tasksTotal: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksSkipped: number;
  durationMs: number;
  error?: string;
}

// Events
class MissionEventEmitter extends EventEmitter {}
export const missionEvents = new MissionEventEmitter();

/**
 * Mission Control Service Class
 */
class MissionControlService {
  private static instance: MissionControlService;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private runningExecutions: Map<string, boolean> = new Map();

  private constructor() {
    logger.info('[MissionControl] Initialized');
    this.initializeScheduler();
  }

  static getInstance(): MissionControlService {
    if (!MissionControlService.instance) {
      MissionControlService.instance = new MissionControlService();
    }
    return MissionControlService.instance;
  }

  /**
   * Initialize the scheduler for all active scheduled missions
   */
  private async initializeScheduler(): Promise<void> {
    try {
      const missions = await prisma.mission.findMany({
        where: { 
          status: 'active',
          type: 'scheduled',
          cronExpression: { not: null }
        }
      });

      for (const mission of missions) {
        await this.scheduleMission(mission.id);
      }

      logger.info(`[MissionControl] Initialized ${missions.length} scheduled missions`);
    } catch (error) {
      logger.error('[MissionControl] Failed to initialize scheduler:', error);
    }
  }

  // ============================================
  // Mission Management
  // ============================================

  async createMission(data: {
    name: string;
    description?: string;
    type?: string;
    status?: string;
    priority?: number;
    containerId?: string;
    scheduleType?: string;
    cronExpression?: string;
    intervalMinutes?: number;
    timezone?: string;
    startDate?: Date;
    endDate?: Date;
    maxConcurrency?: number;
    retryPolicy?: string;
    maxRetries?: number;
    alertOnFailure?: boolean;
    alertOnSuccess?: boolean;
    abortOnTaskFail?: boolean;
    tags?: string[];
    config?: Record<string, any>;
    metadata?: Record<string, any>;
    createdBy?: string;
  }): Promise<Mission> {
    try {
      // Calculate next run time if scheduled
      let nextRunAt: Date | null = null;
      if (data.cronExpression && data.type === 'scheduled') {
        nextRunAt = this.calculateNextRun(data.cronExpression);
      }

      const mission = await prisma.mission.create({
        data: {
          name: data.name,
          description: data.description,
          type: data.type || 'manual',
          status: data.status || 'draft',
          priority: data.priority ?? 0,
          containerId: data.containerId,
          scheduleType: data.scheduleType,
          cronExpression: data.cronExpression,
          intervalMinutes: data.intervalMinutes,
          timezone: data.timezone || 'UTC',
          startDate: data.startDate,
          endDate: data.endDate,
          nextRunAt,
          maxConcurrency: data.maxConcurrency ?? 1,
          retryPolicy: data.retryPolicy || 'none',
          maxRetries: data.maxRetries ?? 3,
          alertOnFailure: data.alertOnFailure ?? true,
          alertOnSuccess: data.alertOnSuccess ?? false,
          abortOnTaskFail: data.abortOnTaskFail ?? false,
          tags: data.tags || [],
          config: data.config || {},
          metadata: data.metadata || {},
          createdBy: data.createdBy
        }
      });

      logger.info(`[MissionControl] Created mission: ${mission.name}`);
      missionEvents.emit('mission:created', mission);

      // Schedule if active
      if (mission.status === 'active' && mission.cronExpression) {
        await this.scheduleMission(mission.id);
      }

      return mission as Mission;
    } catch (error: any) {
      logger.error('[MissionControl] Failed to create mission:', error);
      throw error;
    }
  }

  async getMission(id: string, includeTasks = true): Promise<Mission | null> {
    const mission = await prisma.mission.findUnique({
      where: { id },
      include: includeTasks ? { 
        tasks: { orderBy: { order: 'asc' } }
      } : undefined
    });
    return mission as Mission | null;
  }

  async listMissions(options?: {
    status?: string;
    type?: string;
    containerId?: string;
    includeTasks?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ missions: Mission[]; total: number }> {
    const where: any = {};
    if (options?.status) where.status = options.status;
    if (options?.type) where.type = options.type;
    if (options?.containerId) where.containerId = options.containerId;

    const [missions, total] = await Promise.all([
      prisma.mission.findMany({
        where,
        include: options?.includeTasks ? { tasks: { orderBy: { order: 'asc' } } } : undefined,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: options?.limit,
        skip: options?.offset
      }),
      prisma.mission.count({ where })
    ]);

    return { missions: missions as Mission[], total };
  }

  async updateMission(id: string, data: Partial<{
    name: string;
    description: string;
    type: string;
    status: string;
    priority: number;
    containerId: string;
    scheduleType: string;
    cronExpression: string;
    intervalMinutes: number;
    timezone: string;
    startDate: Date;
    endDate: Date;
    maxConcurrency: number;
    retryPolicy: string;
    maxRetries: number;
    alertOnFailure: boolean;
    alertOnSuccess: boolean;
    abortOnTaskFail: boolean;
    tags: string[];
    config: Record<string, any>;
    metadata: Record<string, any>;
  }>): Promise<Mission> {
    const existing = await this.getMission(id, false);
    if (!existing) throw new Error('Mission not found');

    // Calculate next run if schedule changed
    let nextRunAt = existing.nextRunAt;
    if (data.cronExpression && data.cronExpression !== existing.cronExpression) {
      nextRunAt = this.calculateNextRun(data.cronExpression);
    }

    const mission = await prisma.mission.update({
      where: { id },
      data: { ...data, nextRunAt }
    });

    // Update scheduler
    if (data.status === 'active' && mission.cronExpression) {
      await this.scheduleMission(id);
    } else if (data.status !== 'active' || !mission.cronExpression) {
      this.unscheduleMission(id);
    }

    logger.info(`[MissionControl] Updated mission: ${mission.name}`);
    missionEvents.emit('mission:updated', mission);

    return mission as Mission;
  }

  async deleteMission(id: string): Promise<void> {
    const mission = await this.getMission(id, false);
    if (mission) {
      this.unscheduleMission(id);
      await prisma.mission.delete({ where: { id } });
      logger.info(`[MissionControl] Deleted mission: ${mission.name}`);
      missionEvents.emit('mission:deleted', mission);
    }
  }

  // ============================================
  // Task Management
  // ============================================

  async addTask(missionId: string, data: {
    patternId?: string;
    name: string;
    description?: string;
    taskType?: string;
    order?: number;
    config?: Record<string, any>;
    input?: Record<string, any>;
    timeout?: number;
    retryCount?: number;
    condition?: string;
    skipOnCondition?: boolean;
    dependsOn?: string[];
    isActive?: boolean;
  }): Promise<MissionTask> {
    // Get current max order
    const tasks = await prisma.missionTask.findMany({
      where: { missionId },
      orderBy: { order: 'desc' },
      take: 1
    });
    const maxOrder = tasks.length > 0 ? tasks[0].order : -1;

    const task = await prisma.missionTask.create({
      data: {
        missionId,
        patternId: data.patternId,
        name: data.name,
        description: data.description,
        taskType: data.taskType || 'pattern',
        order: data.order ?? maxOrder + 1,
        config: data.config || {},
        input: data.input || {},
        timeout: data.timeout ?? 30000,
        retryCount: data.retryCount ?? 0,
        condition: data.condition,
        skipOnCondition: data.skipOnCondition ?? false,
        dependsOn: data.dependsOn || [],
        isActive: data.isActive ?? true
      }
    });

    logger.info(`[MissionControl] Added task: ${task.name} to mission ${missionId}`);
    return task as MissionTask;
  }

  async updateTask(taskId: string, data: Partial<{
    patternId: string;
    name: string;
    description: string;
    taskType: string;
    order: number;
    config: Record<string, any>;
    input: Record<string, any>;
    timeout: number;
    retryCount: number;
    condition: string;
    skipOnCondition: boolean;
    dependsOn: string[];
    isActive: boolean;
  }>): Promise<MissionTask> {
    const task = await prisma.missionTask.update({
      where: { id: taskId },
      data
    });
    return task as MissionTask;
  }

  async deleteTask(taskId: string): Promise<void> {
    await prisma.missionTask.delete({ where: { id: taskId } });
  }

  async reorderTasks(_missionId: string, taskIds: string[]): Promise<void> {
    await Promise.all(
      taskIds.map((id, index) => 
        prisma.missionTask.update({
          where: { id },
          data: { order: index }
        })
      )
    );
  }

  // ============================================
  // Mission Execution
  // ============================================

  async executeMission(missionId: string, options?: {
    triggeredBy?: string;
    triggeredUserId?: string;
    input?: Record<string, any>;
  }): Promise<ExecutionResult> {
    const mission = await this.getMission(missionId, true);
    if (!mission) throw new Error('Mission not found');
    if (!mission.tasks || mission.tasks.length === 0) {
      throw new Error('Mission has no tasks to execute');
    }

    // Check if already running
    if (this.runningExecutions.get(missionId)) {
      throw new Error('Mission is already running');
    }

    this.runningExecutions.set(missionId, true);
    const startTime = Date.now();

    // Create execution record
    const execution = await prisma.missionExecution.create({
      data: {
        missionId,
        status: 'running',
        triggeredBy: options?.triggeredBy || 'manual',
        triggeredUserId: options?.triggeredUserId,
        tasksTotal: mission.tasks.filter(t => t.isActive).length,
        logs: []
      }
    });

    const logs: any[] = [];
    let tasksCompleted = 0;
    let tasksFailed = 0;
    let tasksSkipped = 0;
    let finalStatus = 'completed';
    let error: string | undefined;
    const taskOutputs: Map<string, any> = new Map();

    missionEvents.emit('mission:started', { mission, execution });

    try {
      // Execute tasks in order, respecting dependencies
      const activeTasks = mission.tasks.filter(t => t.isActive).sort((a, b) => a.order - b.order);

      for (const task of activeTasks) {
        // Check dependencies
        const dependenciesMet = task.dependsOn.every(depId => {
          const depOutput = taskOutputs.get(depId);
          return depOutput !== undefined;
        });

        if (!dependenciesMet) {
          logs.push({ task: task.name, status: 'skipped', reason: 'Dependencies not met', timestamp: new Date() });
          tasksSkipped++;
          continue;
        }

        // Check condition
        if (task.condition && task.skipOnCondition) {
          try {
            const conditionResult = await this.evaluateCondition(task.condition, {
              input: options?.input,
              taskOutputs: Object.fromEntries(taskOutputs)
            });
            if (conditionResult) {
              logs.push({ task: task.name, status: 'skipped', reason: 'Condition evaluated to true', timestamp: new Date() });
              tasksSkipped++;
              continue;
            }
          } catch (condError: any) {
            logs.push({ task: task.name, status: 'warning', message: `Condition evaluation failed: ${condError.message}`, timestamp: new Date() });
          }
        }

        // Create task run record
        const taskRun = await prisma.missionTaskRun.create({
          data: {
            executionId: execution.id,
            taskId: task.id,
            status: 'running',
            startedAt: new Date(),
            input: { ...task.input, ...(options?.input || {}) }
          }
        });

        const taskStartTime = Date.now();
        let taskSuccess = false;
        let taskOutput: any;
        let taskError: string | undefined;

        try {
          // Execute based on task type
          switch (task.taskType) {
            case 'pattern':
              if (task.patternId) {
                const result = await injectionService.inject({
                  patternId: task.patternId,
                  input: { ...task.input, ...(options?.input || {}), taskOutputs: Object.fromEntries(taskOutputs) },
                  timeout: task.timeout,
                  missionId,
                  taskId: task.id
                });
                taskSuccess = result.success;
                taskOutput = result.output;
                taskError = result.error;
              }
              break;

            case 'delay':
              const delayMs = task.config.delayMs || 1000;
              await new Promise(resolve => setTimeout(resolve, delayMs));
              taskSuccess = true;
              taskOutput = { delayed: delayMs };
              break;

            case 'webhook':
              const webhookUrl = task.config.url;
              if (webhookUrl) {
                const response = await fetch(webhookUrl, {
                  method: task.config.method || 'POST',
                  headers: { 'Content-Type': 'application/json', ...task.config.headers },
                  body: JSON.stringify({ ...task.input, ...(options?.input || {}) })
                });
                taskSuccess = response.ok;
                taskOutput = await response.json().catch(() => ({ status: response.status }));
                if (!taskSuccess) taskError = `Webhook returned ${response.status}`;
              }
              break;

            case 'condition':
              taskSuccess = await this.evaluateCondition(task.config.expression, {
                input: options?.input,
                taskOutputs: Object.fromEntries(taskOutputs)
              });
              taskOutput = { conditionResult: taskSuccess };
              break;

            default:
              taskError = `Unknown task type: ${task.taskType}`;
          }
        } catch (execError: any) {
          taskError = execError.message;
        }

        const taskDuration = Date.now() - taskStartTime;

        // Update task run
        await prisma.missionTaskRun.update({
          where: { id: taskRun.id },
          data: {
            status: taskSuccess ? 'completed' : 'failed',
            completedAt: new Date(),
            durationMs: taskDuration,
            output: taskOutput,
            error: taskError
          }
        });

        // Store output for dependent tasks
        if (taskSuccess && taskOutput !== undefined) {
          taskOutputs.set(task.id, taskOutput);
        }

        // Log
        logs.push({
          task: task.name,
          status: taskSuccess ? 'completed' : 'failed',
          durationMs: taskDuration,
          output: taskOutput,
          error: taskError,
          timestamp: new Date()
        });

        if (taskSuccess) {
          tasksCompleted++;
        } else {
          tasksFailed++;
          if (mission.abortOnTaskFail) {
            finalStatus = 'failed';
            error = `Task "${task.name}" failed: ${taskError}`;
            break;
          }
        }
      }

      // Determine final status
      if (finalStatus !== 'failed') {
        finalStatus = tasksFailed > 0 ? 'completed_with_errors' : 'completed';
      }

    } catch (execError: any) {
      finalStatus = 'failed';
      error = execError.message;
      logs.push({ status: 'error', message: error, timestamp: new Date() });
    }

    const durationMs = Date.now() - startTime;

    // Update execution record
    await prisma.missionExecution.update({
      where: { id: execution.id },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        durationMs,
        tasksCompleted,
        tasksFailed,
        tasksSkipped,
        output: Object.fromEntries(taskOutputs),
        error,
        logs
      }
    });

    // Update mission statistics
    const newTotalRuns = mission.totalRuns + 1;
    const newSuccessRuns = mission.successRuns + (finalStatus === 'completed' ? 1 : 0);
    const newFailedRuns = mission.failedRuns + (finalStatus === 'failed' ? 1 : 0);
    const newAvgDuration = Math.round((mission.avgDurationMs * mission.totalRuns + durationMs) / newTotalRuns);

    await prisma.mission.update({
      where: { id: missionId },
      data: {
        totalRuns: newTotalRuns,
        successRuns: newSuccessRuns,
        failedRuns: newFailedRuns,
        avgDurationMs: newAvgDuration,
        lastRunAt: new Date(),
        nextRunAt: mission.cronExpression ? this.calculateNextRun(mission.cronExpression) : null
      }
    });

    this.runningExecutions.delete(missionId);

    const result: ExecutionResult = {
      success: finalStatus === 'completed',
      executionId: execution.id,
      missionId,
      status: finalStatus,
      tasksTotal: execution.tasksTotal,
      tasksCompleted,
      tasksFailed,
      tasksSkipped,
      durationMs,
      error
    };

    missionEvents.emit('mission:completed', result);

    // Send alerts if configured
    if (mission.alertOnFailure && finalStatus === 'failed') {
      missionEvents.emit('mission:alert', { type: 'failure', mission, result });
    }
    if (mission.alertOnSuccess && finalStatus === 'completed') {
      missionEvents.emit('mission:alert', { type: 'success', mission, result });
    }

    return result;
  }

  async pauseMission(missionId: string): Promise<Mission> {
    this.unscheduleMission(missionId);
    const mission = await prisma.mission.update({
      where: { id: missionId },
      data: { status: 'paused' }
    });
    missionEvents.emit('mission:paused', mission);
    return mission as Mission;
  }

  async resumeMission(missionId: string): Promise<Mission> {
    const mission = await prisma.mission.update({
      where: { id: missionId },
      data: { 
        status: 'active',
        nextRunAt: this.calculateNextRun((await this.getMission(missionId, false))?.cronExpression || '')
      }
    });
    if (mission.cronExpression) {
      await this.scheduleMission(missionId);
    }
    missionEvents.emit('mission:resumed', mission);
    return mission as Mission;
  }

  async getExecutionLogs(missionId: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ executions: MissionExecution[]; total: number }> {
    const [executions, total] = await Promise.all([
      prisma.missionExecution.findMany({
        where: { missionId },
        orderBy: { startedAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset
      }),
      prisma.missionExecution.count({ where: { missionId } })
    ]);
    return { executions: executions as MissionExecution[], total };
  }

  // ============================================
  // Scheduling
  // ============================================

  private async scheduleMission(missionId: string): Promise<void> {
    const mission = await this.getMission(missionId, false);
    if (!mission || !mission.cronExpression) return;

    // Remove existing job
    this.unscheduleMission(missionId);

    // Validate cron expression
    if (!cron.validate(mission.cronExpression)) {
      logger.error(`[MissionControl] Invalid cron expression for mission ${missionId}: ${mission.cronExpression}`);
      return;
    }

    // Create scheduled job
    const job = cron.schedule(mission.cronExpression, async () => {
      try {
        // Check date bounds
        const now = new Date();
        if (mission.startDate && now < mission.startDate) return;
        if (mission.endDate && now > mission.endDate) {
          this.unscheduleMission(missionId);
          await prisma.mission.update({
            where: { id: missionId },
            data: { status: 'completed' }
          });
          return;
        }

        await this.executeMission(missionId, { triggeredBy: 'scheduler' });
      } catch (error: any) {
        logger.error(`[MissionControl] Scheduled execution failed for mission ${missionId}:`, error);
      }
    }, {
      timezone: mission.timezone
    });

    this.scheduledJobs.set(missionId, job);
    logger.info(`[MissionControl] Scheduled mission: ${mission.name} with cron: ${mission.cronExpression}`);
  }

  private unscheduleMission(missionId: string): void {
    const job = this.scheduledJobs.get(missionId);
    if (job) {
      job.stop();
      this.scheduledJobs.delete(missionId);
      logger.info(`[MissionControl] Unscheduled mission: ${missionId}`);
    }
  }

  private calculateNextRun(cronExpression: string): Date | null {
    if (!cronExpression || !cron.validate(cronExpression)) return null;
    
    // Simple next run calculation based on cron expression
    // For more accurate calculation, consider adding cron-parser package
    // For now, estimate based on common patterns
    const now = new Date();
    const parts = cronExpression.split(' ');
    
    // Basic estimation - add appropriate interval
    // This is a simplified approach; for production use cron-parser
    if (parts.length >= 5) {
      const [minute, hour, _dayOfMonth, _month, _dayOfWeek] = parts;
      
      // If specific minute/hour, calculate next occurrence
      if (minute !== '*' && hour !== '*') {
        const targetMinute = parseInt(minute);
        const targetHour = parseInt(hour);
        const next = new Date(now);
        next.setHours(targetHour, targetMinute, 0, 0);
        if (next <= now) {
          next.setDate(next.getDate() + 1);
        }
        return next;
      }
      
      // Every X minutes pattern (*/X)
      if (minute.startsWith('*/')) {
        const interval = parseInt(minute.slice(2));
        const next = new Date(now);
        next.setMinutes(Math.ceil(now.getMinutes() / interval) * interval, 0, 0);
        if (next <= now) {
          next.setMinutes(next.getMinutes() + interval);
        }
        return next;
      }
      
      // Every X hours pattern
      if (hour.startsWith('*/')) {
        const interval = parseInt(hour.slice(2));
        const next = new Date(now);
        next.setHours(Math.ceil(now.getHours() / interval) * interval, 0, 0, 0);
        if (next <= now) {
          next.setHours(next.getHours() + interval);
        }
        return next;
      }
    }
    
    // Default: next hour
    const defaultNext = new Date(now);
    defaultNext.setHours(defaultNext.getHours() + 1, 0, 0, 0);
    return defaultNext;
  }

  private async evaluateCondition(expression: string, context: Record<string, any>): Promise<boolean> {
    try {
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction('context', `return (${expression})`);
      return await fn(context);
    } catch (error) {
      return false;
    }
  }

  // ============================================
  // Statistics
  // ============================================

  async getMissionStats(): Promise<{
    totalMissions: number;
    activeMissions: number;
    scheduledMissions: number;
    totalExecutions: number;
    successRate: number;
    avgDuration: number;
    recentExecutions: any[];
  }> {
    const [missions, executions, recentExecs] = await Promise.all([
      prisma.mission.findMany(),
      prisma.missionExecution.findMany({
        orderBy: { startedAt: 'desc' },
        take: 1000
      }),
      prisma.missionExecution.findMany({
        orderBy: { startedAt: 'desc' },
        take: 10,
        include: { mission: true }
      })
    ]);

    const activeMissions = missions.filter(m => m.status === 'active').length;
    const scheduledMissions = missions.filter(m => m.type === 'scheduled' && m.status === 'active').length;
    const successCount = executions.filter(e => e.status === 'completed').length;
    const successRate = executions.length > 0 ? (successCount / executions.length) * 100 : 0;
    const avgDuration = executions.length > 0
      ? executions.reduce((sum, e) => sum + (e.durationMs || 0), 0) / executions.length
      : 0;

    return {
      totalMissions: missions.length,
      activeMissions,
      scheduledMissions,
      totalExecutions: executions.length,
      successRate: Math.round(successRate * 100) / 100,
      avgDuration: Math.round(avgDuration),
      recentExecutions: recentExecs.map(e => ({
        id: e.id,
        missionName: (e as any).mission?.name || 'Unknown',
        status: e.status,
        durationMs: e.durationMs,
        startedAt: e.startedAt
      }))
    };
  }
}

// Export singleton instance
export const missionControlService = MissionControlService.getInstance();
export default missionControlService;
