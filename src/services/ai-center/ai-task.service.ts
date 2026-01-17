/**
 * AI Task/Todo Service
 * 
 * Complete task management system for AI autonomy:
 * - Task creation and scheduling
 * - Dependency management
 * - Autonomy level control
 * - Progress tracking
 * - Recurring tasks
 * - Priority management
 * - Approval workflows
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '@/utils/logger';
import { aiMemoryService } from './ai-memory.service';

const prisma = new PrismaClient();

// ============================================
// Types
// ============================================

export type TaskType =
  | 'respond_to_message'
  | 'follow_up'
  | 'post_listing'
  | 'update_listing'
  | 'fetch_report'
  | 'analyze_conversation'
  | 'generate_response'
  | 'schedule_appointment'
  | 'send_notification'
  | 'update_inventory'
  | 'run_training'
  | 'cleanup_data'
  | 'generate_report'
  | 'custom';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'waiting_approval';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type AutonomyLevel = 'full' | 'supervised' | 'manual_approval';

export interface TaskInput {
  type: TaskType;
  title: string;
  description?: string;
  priority?: TaskPriority;
  autonomyLevel?: AutonomyLevel;
  accountId: string;
  providerId?: string;
  assignedTo?: string;
  dueAt?: Date;
  scheduledFor?: Date;
  parameters?: Record<string, unknown>;
  dependencies?: string[];
  isRecurring?: boolean;
  recurringPattern?: {
    frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
    interval: number;
    endDate?: Date;
    maxOccurrences?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface TaskResult {
  success: boolean;
  output?: unknown;
  error?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface TaskSummary {
  total: number;
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
  byType: Record<string, number>;
  overdue: number;
  completedToday: number;
  avgCompletionTime: number;
}

export interface TaskApprovalRequest {
  taskId: string;
  type: TaskType;
  title: string;
  description?: string;
  proposedAction: string;
  parameters?: Record<string, unknown>;
  requestedBy: string;
  requestedAt: Date;
}

// ============================================
// Task Capability Definitions
// ============================================

const TASK_CAPABILITIES: Record<TaskType, {
  description: string;
  requiredPermissions: string[];
  defaultAutonomy: AutonomyLevel;
  maxExecutionTime: number; // seconds
  retriesAllowed: number;
}> = {
  respond_to_message: {
    description: 'Generate and send response to customer message',
    requiredPermissions: ['message:write'],
    defaultAutonomy: 'full',
    maxExecutionTime: 30,
    retriesAllowed: 2,
  },
  follow_up: {
    description: 'Send follow-up message to customer',
    requiredPermissions: ['message:write'],
    defaultAutonomy: 'supervised',
    maxExecutionTime: 30,
    retriesAllowed: 2,
  },
  post_listing: {
    description: 'Create new vehicle listing on marketplace',
    requiredPermissions: ['listing:create'],
    defaultAutonomy: 'manual_approval',
    maxExecutionTime: 60,
    retriesAllowed: 1,
  },
  update_listing: {
    description: 'Update existing vehicle listing',
    requiredPermissions: ['listing:update'],
    defaultAutonomy: 'supervised',
    maxExecutionTime: 60,
    retriesAllowed: 1,
  },
  fetch_report: {
    description: 'Fetch external report (Carfax, AutoCheck, etc.)',
    requiredPermissions: ['external:read'],
    defaultAutonomy: 'full',
    maxExecutionTime: 120,
    retriesAllowed: 3,
  },
  analyze_conversation: {
    description: 'Analyze conversation for insights and patterns',
    requiredPermissions: ['conversation:read'],
    defaultAutonomy: 'full',
    maxExecutionTime: 60,
    retriesAllowed: 2,
  },
  generate_response: {
    description: 'Generate response without sending',
    requiredPermissions: ['conversation:read'],
    defaultAutonomy: 'full',
    maxExecutionTime: 30,
    retriesAllowed: 2,
  },
  schedule_appointment: {
    description: 'Schedule customer appointment',
    requiredPermissions: ['calendar:write'],
    defaultAutonomy: 'manual_approval',
    maxExecutionTime: 30,
    retriesAllowed: 1,
  },
  send_notification: {
    description: 'Send notification to staff',
    requiredPermissions: ['notification:write'],
    defaultAutonomy: 'full',
    maxExecutionTime: 10,
    retriesAllowed: 3,
  },
  update_inventory: {
    description: 'Update vehicle inventory data',
    requiredPermissions: ['inventory:write'],
    defaultAutonomy: 'supervised',
    maxExecutionTime: 60,
    retriesAllowed: 2,
  },
  run_training: {
    description: 'Run AI training session',
    requiredPermissions: ['training:execute'],
    defaultAutonomy: 'manual_approval',
    maxExecutionTime: 3600,
    retriesAllowed: 1,
  },
  cleanup_data: {
    description: 'Clean up old/expired data',
    requiredPermissions: ['data:delete'],
    defaultAutonomy: 'manual_approval',
    maxExecutionTime: 300,
    retriesAllowed: 1,
  },
  generate_report: {
    description: 'Generate analytics report',
    requiredPermissions: ['analytics:read'],
    defaultAutonomy: 'full',
    maxExecutionTime: 120,
    retriesAllowed: 2,
  },
  custom: {
    description: 'Custom task type',
    requiredPermissions: [],
    defaultAutonomy: 'manual_approval',
    maxExecutionTime: 60,
    retriesAllowed: 1,
  },
};

// ============================================
// AI Task Service
// ============================================

// Helper to convert TaskPriority string to number
const priorityToNumber = (priority: TaskPriority): number => {
  const map: Record<TaskPriority, number> = {
    low: 3,
    medium: 5,
    high: 7,
    urgent: 10,
  };
  return map[priority] || 5;
};

// Helper to convert number to TaskPriority
const numberToPriority = (num: number): TaskPriority => {
  if (num >= 9) return 'urgent';
  if (num >= 7) return 'high';
  if (num >= 4) return 'medium';
  return 'low';
};

export class AITaskService {
  private pendingApprovals: Map<string, TaskApprovalRequest> = new Map();

  constructor() {
    this.startTaskProcessor();
  }

  /**
   * Start background task processor
   */
  private startTaskProcessor(): void {
    // Process tasks every 30 seconds
    setInterval(() => this.processPendingTasks(), 30000);
    logger.info('AI Task processor started');
  }

  // ============================================
  // Task Creation
  // ============================================

  /**
   * Create a new task
   */
  async createTask(input: TaskInput): Promise<string> {
    try {
      const capability = TASK_CAPABILITIES[input.type];
      const autonomyLevel = input.autonomyLevel || capability.defaultAutonomy;

      // Check if task needs approval
      const needsApproval = autonomyLevel === 'manual_approval';

      const task = await prisma.aITask.create({
        data: {
          accountId: input.accountId,
          providerId: input.providerId,
          taskType: input.type,
          title: input.title,
          description: input.description,
          priority: priorityToNumber(input.priority || 'medium'),
          autonomyLevel,
          status: needsApproval ? 'waiting_approval' : 'pending',
          inputData: input.parameters as any,
          dependsOn: input.dependencies || [],
          dueAt: input.dueAt,
          scheduledFor: input.scheduledFor,
          recurringConfig: input.recurringPattern as any,
          maxRetries: capability.retriesAllowed,
        },
      });

      // If needs approval, add to pending approvals
      if (needsApproval) {
        this.pendingApprovals.set(task.id, {
          taskId: task.id,
          type: input.type,
          title: input.title,
          description: input.description,
          proposedAction: this.describeAction(input),
          parameters: input.parameters,
          requestedBy: input.assignedTo || 'system',
          requestedAt: new Date(),
        });

        // Log audit
        await this.logAudit(task.id, 'task_created_pending_approval', {
          type: input.type,
          autonomyLevel,
        });
      } else {
        await this.logAudit(task.id, 'task_created', { type: input.type });
      }

      logger.info(`Task created: ${task.id} - ${input.title}`);
      return task.id;
    } catch (error) {
      logger.error('Failed to create task:', error);
      throw error;
    }
  }

  /**
   * Create batch of tasks
   */
  async createBatchTasks(inputs: TaskInput[]): Promise<string[]> {
    const taskIds: string[] = [];
    
    for (const input of inputs) {
      const taskId = await this.createTask(input);
      taskIds.push(taskId);
    }

    return taskIds;
  }

  /**
   * Schedule recurring task
   */
  async scheduleRecurringTask(
    input: TaskInput,
    pattern: {
      frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
      interval: number;
      startDate?: Date;
      endDate?: Date;
      maxOccurrences?: number;
    }
  ): Promise<string> {
    const taskId = await this.createTask({
      ...input,
      isRecurring: true,
      recurringPattern: pattern,
      scheduledFor: pattern.startDate || new Date(),
    });

    return taskId;
  }

  // ============================================
  // Task Execution
  // ============================================

  /**
   * Process pending tasks
   */
  private async processPendingTasks(): Promise<void> {
    try {
      // Get tasks that are ready to execute
      const tasks = await prisma.aITask.findMany({
        where: {
          status: 'pending',
          OR: [
            { scheduledFor: null },
            { scheduledFor: { lte: new Date() } },
          ],
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
        take: 10, // Process 10 tasks at a time
      });

      for (const task of tasks) {
        // Check dependencies
        const dependenciesMet = await this.checkDependencies(task.dependsOn as string[] || []);
        
        if (dependenciesMet) {
          await this.executeTask(task.id);
        }
      }
    } catch (error) {
      logger.error('Error processing pending tasks:', error);
    }
  }

  /**
   * Execute a single task
   */
  async executeTask(taskId: string): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      const task = await prisma.aITask.findUnique({
        where: { id: taskId },
      });

      if (!task) {
        return { success: false, error: 'Task not found' };
      }

      // Mark as in progress
      await prisma.aITask.update({
        where: { id: taskId },
        data: {
          status: 'in_progress',
          startedAt: new Date(),
        },
      });

      await this.logAudit(taskId, 'task_started', {});

      // Execute based on task type
      const result = await this.executeTaskType(
        task.taskType as TaskType,
        task.inputData as Record<string, unknown>,
        task.accountId
      );

      const duration = Date.now() - startTime;

      // Update task status
      await prisma.aITask.update({
        where: { id: taskId },
        data: {
          status: result.success ? 'completed' : 'failed',
          completedAt: new Date(),
          result: result as any,
          errorLog: result.error ? { error: result.error } : undefined,
        },
      });

      await this.logAudit(taskId, result.success ? 'task_completed' : 'task_failed', {
        duration,
        error: result.error,
      });

      // Handle recurring tasks
      if (task.recurringConfig && result.success) {
        await this.scheduleNextRecurrence(task);
      }

      return { ...result, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Update task as failed
      await prisma.aITask.update({
        where: { id: taskId },
        data: {
          status: 'failed',
          errorLog: { error: String(error) },
          retryCount: { increment: 1 },
        },
      });

      await this.logAudit(taskId, 'task_error', { error: String(error) });

      // Check if should retry
      const task = await prisma.aITask.findUnique({ where: { id: taskId } });
      if (task && task.retryCount < task.maxRetries) {
        // Schedule retry
        setTimeout(() => this.executeTask(taskId), 60000 * task.retryCount);
      }

      return { success: false, error: String(error), duration };
    }
  }

  /**
   * Execute specific task type
   */
  private async executeTaskType(
    type: TaskType,
    parameters: Record<string, unknown>,
    accountId: string
  ): Promise<TaskResult> {
    switch (type) {
      case 'respond_to_message':
        return this.executeRespondToMessage(parameters);

      case 'follow_up':
        return this.executeFollowUp(parameters);

      case 'fetch_report':
        return this.executeFetchReport(parameters);

      case 'analyze_conversation':
        return this.executeAnalyzeConversation(parameters);

      case 'generate_response':
        return this.executeGenerateResponse(parameters);

      case 'send_notification':
        return this.executeSendNotification(parameters);

      case 'generate_report':
        return this.executeGenerateReport(parameters, accountId);

      case 'cleanup_data':
        return this.executeCleanupData(parameters, accountId);

      default:
        return { success: false, error: `Unsupported task type: ${type}` };
    }
  }

  // Task executors
  private async executeRespondToMessage(params: Record<string, unknown>): Promise<TaskResult> {
    // In production, this would integrate with the messaging system
    const { conversationId, responseText } = params;
    
    if (!conversationId || !responseText) {
      return { success: false, error: 'Missing required parameters' };
    }

    // Simulate sending message
    logger.info(`[Task] Sending response to conversation ${conversationId}`);
    
    return {
      success: true,
      output: { messageId: `msg_${Date.now()}`, conversationId },
    };
  }

  private async executeFollowUp(params: Record<string, unknown>): Promise<TaskResult> {
    const { conversationId, followUpMessage } = params;
    
    if (!conversationId || !followUpMessage) {
      return { success: false, error: 'Missing required parameters' };
    }

    logger.info(`[Task] Sending follow-up to conversation ${conversationId}`);
    
    return {
      success: true,
      output: { followUpSent: true, conversationId },
    };
  }

  private async executeFetchReport(params: Record<string, unknown>): Promise<TaskResult> {
    const { vin, reportType } = params;
    
    if (!vin) {
      return { success: false, error: 'VIN is required' };
    }

    // In production, this would call external API (Carfax, AutoCheck, etc.)
    logger.info(`[Task] Fetching ${reportType || 'Carfax'} report for VIN: ${vin}`);
    
    return {
      success: true,
      output: {
        vin,
        reportType: reportType || 'carfax',
        reportUrl: `https://reports.example.com/${vin}`,
        summary: {
          accidents: 0,
          owners: 2,
          serviceRecords: 15,
        },
      },
    };
  }

  private async executeAnalyzeConversation(params: Record<string, unknown>): Promise<TaskResult> {
    const { conversationId } = params;
    
    if (!conversationId) {
      return { success: false, error: 'Conversation ID is required' };
    }

    // In production, this would analyze the conversation
    logger.info(`[Task] Analyzing conversation ${conversationId}`);
    
    return {
      success: true,
      output: {
        conversationId,
        sentiment: 'positive',
        intent: 'purchase_inquiry',
        buyerReadiness: 0.75,
        suggestedNextAction: 'follow_up',
      },
    };
  }

  private async executeGenerateResponse(params: Record<string, unknown>): Promise<TaskResult> {
    const { message } = params;
    
    if (!message) {
      return { success: false, error: 'Message is required' };
    }

    // In production, this would use AI to generate response
    logger.info(`[Task] Generating response for message`);
    
    return {
      success: true,
      output: {
        generatedResponse: 'Thank you for your interest! The vehicle is still available.',
        confidence: 0.92,
        usedPattern: 'availability_response',
      },
    };
  }

  private async executeSendNotification(params: Record<string, unknown>): Promise<TaskResult> {
    const { recipientId, title } = params;
    
    if (!recipientId || !title) {
      return { success: false, error: 'Recipient and title are required' };
    }

    // In production, this would send actual notification
    logger.info(`[Task] Sending notification to ${recipientId}: ${title}`);
    
    return {
      success: true,
      output: { notificationId: `notif_${Date.now()}`, sent: true },
    };
  }

  private async executeGenerateReport(
    params: Record<string, unknown>,
    accountId: string
  ): Promise<TaskResult> {
    const { reportType } = params;
    
    // In production, this would generate actual report
    logger.info(`[Task] Generating ${reportType} report for account ${accountId}`);
    
    return {
      success: true,
      output: {
        reportType,
        accountId,
        generatedAt: new Date().toISOString(),
        data: {
          totalConversations: 150,
          responsesGenerated: 120,
          successfulClosings: 15,
        },
      },
    };
  }

  private async executeCleanupData(
    params: Record<string, unknown>,
    accountId: string
  ): Promise<TaskResult> {
    const { dataType, olderThanDays } = params;
    
    logger.info(`[Task] Cleaning up ${dataType} data older than ${olderThanDays} days`);
    
    // In production, this would actually clean up data
    await aiMemoryService.cleanupExpired(accountId);
    
    return {
      success: true,
      output: { cleanedRecords: 0, dataType },
    };
  }

  // ============================================
  // Task Management
  // ============================================

  /**
   * Approve task
   */
  async approveTask(taskId: string, approvedBy: string): Promise<void> {
    await prisma.aITask.update({
      where: { id: taskId },
      data: {
        status: 'pending',
        approvedBy,
        approvedAt: new Date(),
      },
    });

    this.pendingApprovals.delete(taskId);
    await this.logAudit(taskId, 'task_approved', { approvedBy });

    // Execute immediately
    await this.executeTask(taskId);
  }

  /**
   * Reject task
   */
  async rejectTask(taskId: string, rejectedBy: string, reason?: string): Promise<void> {
    await prisma.aITask.update({
      where: { id: taskId },
      data: {
        status: 'cancelled',
        errorLog: {
          rejectedBy,
          rejectedAt: new Date().toISOString(),
          rejectionReason: reason,
        },
      },
    });

    this.pendingApprovals.delete(taskId);
    await this.logAudit(taskId, 'task_rejected', { rejectedBy, reason });
  }

  /**
   * Cancel task
   */
  async cancelTask(taskId: string, cancelledBy?: string): Promise<void> {
    await prisma.aITask.update({
      where: { id: taskId },
      data: {
        status: 'cancelled',
        errorLog: {
          cancelledBy: cancelledBy || 'system',
          cancelledAt: new Date().toISOString(),
        },
      },
    });

    await this.logAudit(taskId, 'task_cancelled', { cancelledBy });
  }

  /**
   * Retry failed task
   */
  async retryTask(taskId: string): Promise<void> {
    await prisma.aITask.update({
      where: { id: taskId },
      data: {
        status: 'pending',
        errorLog: Prisma.JsonNull,
      },
    });

    await this.logAudit(taskId, 'task_retry_scheduled', {});
    await this.executeTask(taskId);
  }

  /**
   * Update task priority
   */
  async updatePriority(taskId: string, priority: TaskPriority): Promise<void> {
    await prisma.aITask.update({
      where: { id: taskId },
      data: { priority: priorityToNumber(priority) },
    });
  }

  // ============================================
  // Task Queries
  // ============================================

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<any> {
    return prisma.aITask.findUnique({
      where: { id: taskId },
    });
  }

  /**
   * Get tasks for account
   */
  async getTasks(
    accountId: string,
    options?: {
      status?: TaskStatus;
      type?: TaskType;
      priority?: TaskPriority;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<any[]> {
    const where: Prisma.AITaskWhereInput = { accountId };

    if (options?.status) where.status = options.status;
    if (options?.type) where.taskType = options.type;
    if (options?.priority) where.priority = priorityToNumber(options.priority);
    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    return prisma.aITask.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      take: options?.limit || 100,
    });
  }

  /**
   * Get pending approvals
   */
  async getPendingApprovals(accountId?: string): Promise<TaskApprovalRequest[]> {
    const tasks = await prisma.aITask.findMany({
      where: {
        status: 'waiting_approval',
        ...(accountId && { accountId }),
      },
      orderBy: { createdAt: 'asc' },
    });

    return tasks.map(task => ({
      taskId: task.id,
      type: task.taskType as TaskType,
      title: task.title,
      description: task.description || undefined,
      proposedAction: this.describeAction({
        type: task.taskType as TaskType,
        title: task.title,
        parameters: task.inputData as Record<string, unknown>,
      } as TaskInput),
      parameters: task.inputData as Record<string, unknown>,
      requestedBy: 'system',
      requestedAt: task.createdAt,
    }));
  }

  /**
   * Get task summary
   */
  async getTaskSummary(accountId: string): Promise<TaskSummary> {
    const tasks = await prisma.aITask.findMany({
      where: { accountId },
    });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const summary: TaskSummary = {
      total: tasks.length,
      byStatus: {
        pending: 0,
        in_progress: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        waiting_approval: 0,
      },
      byPriority: { low: 0, medium: 0, high: 0, urgent: 0 },
      byType: {},
      overdue: 0,
      completedToday: 0,
      avgCompletionTime: 0,
    };

    let totalCompletionTime = 0;
    let completedCount = 0;

    tasks.forEach(task => {
      summary.byStatus[task.status as TaskStatus]++;
      summary.byPriority[numberToPriority(task.priority)]++;
      summary.byType[task.taskType] = (summary.byType[task.taskType] || 0) + 1;

      if (task.dueAt && task.dueAt < now && task.status !== 'completed') {
        summary.overdue++;
      }

      if (task.completedAt && task.completedAt >= todayStart) {
        summary.completedToday++;
      }

      if (task.completedAt && task.startedAt) {
        totalCompletionTime += task.completedAt.getTime() - task.startedAt.getTime();
        completedCount++;
      }
    });

    summary.avgCompletionTime = completedCount > 0 ? totalCompletionTime / completedCount : 0;

    return summary;
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Check if dependencies are met
   */
  private async checkDependencies(dependencies: string[]): Promise<boolean> {
    if (dependencies.length === 0) return true;

    const depTasks = await prisma.aITask.findMany({
      where: { id: { in: dependencies } },
    });

    return depTasks.every(task => task.status === 'completed');
  }

  /**
   * Schedule next recurrence of task
   */
  private async scheduleNextRecurrence(task: any): Promise<void> {
    const pattern = task.recurringConfig as any;
    if (!pattern) return;

    // Check if max occurrences reached
    const occurrences = await prisma.aITask.count({
      where: {
        accountId: task.accountId,
        taskType: task.taskType,
        title: task.title,
        recurringConfig: { not: Prisma.JsonNull },
      },
    });

    if (pattern.maxOccurrences && occurrences >= pattern.maxOccurrences) {
      return;
    }

    // Check if end date passed
    if (pattern.endDate && new Date(pattern.endDate) < new Date()) {
      return;
    }

    // Calculate next scheduled time
    const now = new Date();
    let nextRun: Date;

    switch (pattern.frequency) {
      case 'hourly':
        nextRun = new Date(now.getTime() + pattern.interval * 60 * 60 * 1000);
        break;
      case 'daily':
        nextRun = new Date(now.getTime() + pattern.interval * 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        nextRun = new Date(now.getTime() + pattern.interval * 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        nextRun = new Date(now.setMonth(now.getMonth() + pattern.interval));
        break;
      default:
        return;
    }

    // Create next occurrence
    await this.createTask({
      accountId: task.accountId,
      providerId: task.providerId,
      type: task.taskType as TaskType,
      title: task.title,
      description: task.description || undefined,
      priority: numberToPriority(task.priority),
      autonomyLevel: task.autonomyLevel as AutonomyLevel,
      parameters: task.inputData as Record<string, unknown>,
      scheduledFor: nextRun,
      isRecurring: true,
      recurringPattern: pattern,
    });
  }

  /**
   * Describe task action in human-readable format
   */
  private describeAction(input: TaskInput): string {
    const params = input.parameters || {};
    
    switch (input.type) {
      case 'respond_to_message':
        return `Send response to conversation ${params.conversationId}`;
      case 'follow_up':
        return `Send follow-up to customer ${params.customerId}`;
      case 'post_listing':
        return `Create new listing for ${params.vehicleTitle || 'vehicle'}`;
      case 'update_listing':
        return `Update listing ${params.listingId}`;
      case 'fetch_report':
        return `Fetch ${params.reportType || 'Carfax'} report for VIN ${params.vin}`;
      case 'schedule_appointment':
        return `Schedule appointment for ${params.customerName}`;
      default:
        return input.title;
    }
  }

  /**
   * Log audit entry
   */
  private async logAudit(
    taskId: string,
    action: string,
    details: Record<string, unknown>
  ): Promise<void> {
    try {
      const task = await prisma.aITask.findUnique({
        where: { id: taskId },
        select: { accountId: true, providerId: true },
      });

      if (!task) return;

      await prisma.aIAuditLog.create({
        data: {
          accountId: task.accountId,
          providerId: task.providerId,
          action,
          category: 'task',
          targetType: 'task',
          targetId: taskId,
          request: details as any,
          status: details.error ? 'failed' : 'success',
          errorMessage: details.error as string | undefined,
        },
      });
    } catch (error) {
      logger.error('Failed to log audit:', error);
    }
  }

  /**
   * Get task capabilities
   */
  getTaskCapabilities(): Record<TaskType, typeof TASK_CAPABILITIES[TaskType]> {
    return TASK_CAPABILITIES;
  }
}

// Export singleton instance
export const aiTaskService = new AITaskService();
export default aiTaskService;
