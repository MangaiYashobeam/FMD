/**
 * Nova Monitoring Integration Service
 * 
 * Integrates error monitoring with Nova AI:
 * - Monitors system errors in real-time
 * - Alerts Nova when errors are detected
 * - Sends proactive messages to admin via AI chat
 * - Maintains conversation history for recursive context
 * - Provides admin notification system
 */

import prisma from '@/config/database';
import { logger } from '@/utils/logger';
import { errorMonitoringEvents } from './error-monitoring.service';
import { aiInterventionEvents } from './ai-intervention.service';
import { EventEmitter } from 'events';
import Anthropic from '@anthropic-ai/sdk';

// AI client
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
}) : null;

// Event emitter for Nova monitoring events
export const novaMonitoringEvents = new EventEmitter();
novaMonitoringEvents.setMaxListeners(100);

// Types
interface ErrorAlert {
  id: string;
  ticketId: string;
  ticketNumber: string;
  severity: string;
  errorType: string;
  errorMessage: string;
  userId: string;
  userEmail?: string;
  errorCount: number;
  alertColor: string;
  createdAt: Date;
  isRead: boolean;
  isResolved: boolean;
}

interface AdminNotification {
  id: string;
  type: 'error_alert' | 'system_alert' | 'intervention_alert' | 'escalation' | 'daily_summary';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: Date;
}

interface ConversationMemory {
  sessionId: string;
  userId: string;
  context: string[];
  lastInteraction: Date;
  errorHistory: string[];
  resolvedIssues: string[];
}

class NovaMonitoringService {
  private alertQueue: ErrorAlert[] = [];
  private adminNotifications: Map<string, AdminNotification[]> = new Map();
  private conversationMemory: Map<string, ConversationMemory> = new Map();
  private isInitialized = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private alertProcessorInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize Nova Monitoring Service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    logger.info('🤖 Nova Monitoring Service initializing...');

    // Subscribe to error monitoring events
    this.subscribeToEvents();

    // Start health check cron
    this.startHealthCheckCron();

    // Start alert processor
    this.startAlertProcessor();

    // Load active alerts from database
    await this.loadActiveAlerts();

    this.isInitialized = true;
    logger.info('✅ Nova Monitoring Service initialized - Error monitoring wired to Nova AI');
  }

  /**
   * Subscribe to error monitoring and intervention events
   */
  private subscribeToEvents(): void {
    // New error detected
    errorMonitoringEvents.on('error:new', async (error) => {
      await this.handleNewError(error);
    });

    // Error updated (recurring)
    errorMonitoringEvents.on('error:updated', async (error) => {
      await this.handleErrorUpdate(error);
    });

    // Ticket created
    errorMonitoringEvents.on('ticket:created', async (ticket) => {
      await this.handleTicketCreated(ticket);
    });

    // Critical ticket
    errorMonitoringEvents.on('ticket:critical', async (ticket) => {
      await this.handleCriticalTicket(ticket);
    });

    // Scan complete
    errorMonitoringEvents.on('scan:complete', async (data) => {
      await this.handleScanComplete(data);
    });

    // AI intervention message sent
    aiInterventionEvents.on('message:sent', async (data) => {
      await this.recordInterventionSent(data);
    });

    // Ticket escalated
    aiInterventionEvents.on('ticket:escalated', async (data) => {
      await this.handleTicketEscalation(data);
    });

    logger.info('Subscribed to error monitoring and intervention events');
  }

  /**
   * Start health check cron - runs every 5 minutes
   */
  private startHealthCheckCron(): void {
    // Run every 5 minutes
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 5 * 60 * 1000);

    // Run initial check
    setTimeout(() => this.performHealthCheck(), 10000);
    
    logger.info('Health check cron started (5 min interval)');
  }

  /**
   * Start alert processor - processes alert queue every 30 seconds
   */
  private startAlertProcessor(): void {
    this.alertProcessorInterval = setInterval(async () => {
      await this.processAlertQueue();
    }, 30 * 1000);

    logger.info('Alert processor started (30s interval)');
  }

  /**
   * Load active alerts from database
   */
  private async loadActiveAlerts(): Promise<void> {
    try {
      const activeTickets = await prisma.errorTicket.findMany({
        where: {
          status: {
            in: ['DETECTED', 'ANALYZING', 'INTERVENING', 'ESCALATED'],
          },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        include: {
          errorLogs: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      for (const ticket of activeTickets) {
        // Get user email separately
        const user = await prisma.user.findUnique({
          where: { id: ticket.userId },
          select: { email: true },
        });

        this.alertQueue.push({
          id: `alert-${ticket.id}`,
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          severity: ticket.severity,
          errorType: ticket.errorLogs[0]?.errorType || 'unknown',
          errorMessage: ticket.errorLogs[0]?.errorMessage || ticket.description,
          userId: ticket.userId,
          userEmail: user?.email,
          errorCount: ticket.errorCount,
          alertColor: ticket.alertColor || 'yellow',
          createdAt: ticket.createdAt,
          isRead: false,
          isResolved: false,
        });
      }

      logger.info(`Loaded ${this.alertQueue.length} active alerts`);
    } catch (error) {
      logger.error('Failed to load active alerts:', error);
    }
  }

  /**
   * Handle new error event
   */
  private async handleNewError(error: any): Promise<void> {
    logger.debug(`Nova detected new error: ${error.errorType} - ${error.id}`);

    // For critical errors, alert admin immediately
    if (error.severity === 'CRITICAL' || error.severity === 'FATAL') {
      await this.alertAdminImmediately(error);
    }
  }

  /**
   * Handle error update event (recurring error)
   */
  private async handleErrorUpdate(error: any): Promise<void> {
    // Update existing alert count
    const existingAlert = this.alertQueue.find(a => 
      a.errorType === error.errorType && 
      a.userId === error.userId
    );

    if (existingAlert) {
      existingAlert.errorCount = error.occurenceCount;
      if (error.occurenceCount >= 5) {
        existingAlert.alertColor = 'red';
      } else if (error.occurenceCount >= 3) {
        existingAlert.alertColor = 'orange';
      }
    }
  }

  /**
   * Handle ticket created event
   */
  private async handleTicketCreated(ticket: any): Promise<void> {
    logger.info(`Nova tracking new ticket: ${ticket.ticketNumber}`);

    // Add to alert queue
    const user = await prisma.user.findUnique({
      where: { id: ticket.userId },
      select: { email: true },
    });

    this.alertQueue.push({
      id: `alert-${ticket.id}`,
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      severity: ticket.severity,
      errorType: ticket.affectedFeature || 'general',
      errorMessage: ticket.title,
      userId: ticket.userId,
      userEmail: user?.email,
      errorCount: ticket.errorCount,
      alertColor: ticket.alertColor,
      createdAt: new Date(),
      isRead: false,
      isResolved: false,
    });

    // Notify super admins
    await this.notifySuperAdmins({
      type: 'error_alert',
      severity: ticket.severity === 'CRITICAL' || ticket.severity === 'FATAL' ? 'critical' : 'warning',
      title: `Error Ticket: ${ticket.ticketNumber}`,
      message: `New error ticket created: ${ticket.title}`,
      data: {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        errorCount: ticket.errorCount,
        userId: ticket.userId,
      },
    });
  }

  /**
   * Handle critical ticket - immediate Nova response
   */
  private async handleCriticalTicket(ticket: any): Promise<void> {
    logger.warn(`🚨 CRITICAL ticket detected: ${ticket.ticketNumber}`);

    // Send immediate notification to all super admins
    await this.notifySuperAdmins({
      type: 'error_alert',
      severity: 'critical',
      title: `🚨 CRITICAL: ${ticket.ticketNumber}`,
      message: `Critical error requiring immediate attention: ${ticket.title}`,
      data: {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        severity: ticket.severity,
        userId: ticket.userId,
      },
    });

    // Start AI chat with admin about this issue
    await this.startAdminConversation(ticket);
  }

  /**
   * Handle scan complete event
   */
  private async handleScanComplete(data: { errorsProcessed: number; duration: number }): Promise<void> {
    if (data.errorsProcessed > 0) {
      logger.info(`Scan complete: ${data.errorsProcessed} errors processed in ${data.duration}ms`);
    }

    // Emit event for dashboard updates
    novaMonitoringEvents.emit('scan:complete', data);
  }

  /**
   * Record intervention sent
   */
  private async recordInterventionSent(data: any): Promise<void> {
    // Add to conversation memory
    const memory = this.conversationMemory.get(data.userId);
    if (memory) {
      memory.context.push(`Sent intervention for ticket ${data.ticketId}`);
      memory.lastInteraction = new Date();
    }

    logger.info(`Nova intervention recorded for user ${data.userId}`);
  }

  /**
   * Handle ticket escalation
   */
  private async handleTicketEscalation(data: any): Promise<void> {
    await this.notifySuperAdmins({
      type: 'escalation',
      severity: 'error',
      title: `Ticket Escalated`,
      message: `Ticket has been escalated: ${data.reason}`,
      data: {
        ticketId: data.ticketId,
        userId: data.userId,
        priority: data.priority,
      },
    });
  }

  /**
   * Alert admin immediately for critical errors
   */
  private async alertAdminImmediately(error: any): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: error.userId },
      select: { email: true, firstName: true },
    });

    await this.notifySuperAdmins({
      type: 'error_alert',
      severity: 'critical',
      title: `🚨 CRITICAL Error Detected`,
      message: `User ${user?.firstName || error.userId} encountered: ${error.errorMessage}`,
      data: {
        errorId: error.id,
        errorType: error.errorType,
        userId: error.userId,
        severity: error.severity,
      },
    });
  }

  /**
   * Notify all super admins
   */
  private async notifySuperAdmins(notification: Omit<AdminNotification, 'id' | 'isRead' | 'createdAt'>): Promise<void> {
    try {
      // Get all super admins
      const superAdmins = await prisma.accountUser.findMany({
        where: { role: 'SUPER_ADMIN' },
        include: { user: true },
      });

      const fullNotification: AdminNotification = {
        ...notification,
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        isRead: false,
        createdAt: new Date(),
      };

      for (const admin of superAdmins) {
        // Store notification
        if (!this.adminNotifications.has(admin.userId)) {
          this.adminNotifications.set(admin.userId, []);
        }
        this.adminNotifications.get(admin.userId)!.push(fullNotification);

        // Keep only last 100 notifications
        const notifications = this.adminNotifications.get(admin.userId)!;
        if (notifications.length > 100) {
          notifications.splice(0, notifications.length - 100);
        }

        // Emit real-time event
        novaMonitoringEvents.emit('admin:notification', {
          userId: admin.userId,
          notification: fullNotification,
        });
      }

      logger.info(`Notified ${superAdmins.length} super admins: ${notification.title}`);
    } catch (error) {
      logger.error('Failed to notify super admins:', error);
    }
  }

  /**
   * Start admin conversation about an issue
   */
  private async startAdminConversation(ticket: any): Promise<void> {
    try {
      // Get super admins
      const superAdmins = await prisma.accountUser.findMany({
        where: { role: 'SUPER_ADMIN' },
        select: { userId: true },
      });

      for (const admin of superAdmins) {
        // Create or get admin's chat session
        let session = await prisma.aIChatSession.findFirst({
          where: {
            userId: admin.userId,
            sessionType: 'admin_alerts',
            status: 'active',
          },
          orderBy: { createdAt: 'desc' },
        });

        if (!session) {
          session = await prisma.aIChatSession.create({
            data: {
              userId: admin.userId,
              title: '🚨 System Alerts & Monitoring',
              sessionType: 'admin_alerts',
              userRole: 'super_admin',
              status: 'active',
            },
          });
        }

        // Generate AI analysis of the issue
        const analysis = await this.analyzeIssueForAdmin(ticket);

        // Create message from Nova to admin
        await prisma.aIChatMessage.create({
          data: {
            sessionId: session.id,
            role: 'assistant',
            content: analysis,
          },
        });

        // Update session
        await prisma.aIChatSession.update({
          where: { id: session.id },
          data: {
            messageCount: { increment: 1 },
            lastMessageAt: new Date(),
          },
        });

        // Store in conversation memory
        this.conversationMemory.set(admin.userId, {
          sessionId: session.id,
          userId: admin.userId,
          context: [`Discussed ticket ${ticket.ticketNumber}`],
          lastInteraction: new Date(),
          errorHistory: [ticket.ticketNumber],
          resolvedIssues: [],
        });

        logger.info(`Started admin conversation about ticket ${ticket.ticketNumber}`);
      }
    } catch (error) {
      logger.error('Failed to start admin conversation:', error);
    }
  }

  /**
   * Analyze issue for admin using AI
   */
  private async analyzeIssueForAdmin(ticket: any): Promise<string> {
    // Get related errors
    const errorLogs = await prisma.userSessionErrorLog.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: ticket.userId },
      select: { email: true, firstName: true, lastName: true },
    });

    let analysis = `🚨 **Critical Alert - Ticket ${ticket.ticketNumber}**\n\n`;
    analysis += `**User:** ${user?.firstName || 'Unknown'} ${user?.lastName || ''} (${user?.email})\n`;
    analysis += `**Severity:** ${ticket.severity}\n`;
    analysis += `**Occurrences:** ${ticket.errorCount}\n\n`;
    analysis += `**Issue:** ${ticket.title}\n\n`;

    if (errorLogs.length > 0) {
      analysis += `**Error Details:**\n`;
      analysis += `- Type: ${errorLogs[0].errorType}\n`;
      analysis += `- Message: ${errorLogs[0].errorMessage}\n`;
      if (errorLogs[0].endpoint) {
        analysis += `- Endpoint: ${errorLogs[0].endpoint}\n`;
      }
      analysis += `\n`;
    }

    // If we have AI, generate smart analysis
    if (anthropic) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: `Analyze this error ticket and provide a brief admin summary:
            
Ticket: ${ticket.ticketNumber}
Error Type: ${errorLogs[0]?.errorType || 'Unknown'}
Message: ${errorLogs[0]?.errorMessage || ticket.title}
Severity: ${ticket.severity}
Occurrences: ${ticket.errorCount}

Provide:
1. Quick summary of the issue
2. Potential root cause
3. Recommended action`,
          }],
        });

        const content = response.content[0];
        if (content.type === 'text') {
          analysis += `**AI Analysis:**\n${content.text}\n\n`;
        }
      } catch (err) {
        logger.error('AI analysis failed:', err);
      }
    }

    analysis += `---\n`;
    analysis += `*Reply to this message to discuss or get more details about this issue.*`;

    return analysis;
  }

  /**
   * Perform system health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      // Check for unresolved critical errors
      const criticalCount = await prisma.errorTicket.count({
        where: {
          severity: { in: ['CRITICAL', 'FATAL'] },
          status: { notIn: ['RESOLVED', 'CLOSED'] },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      });

      // Check for high error rate in last hour
      const recentErrors = await prisma.userSessionErrorLog.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000),
          },
        },
      });

      // Check for unprocessed errors
      const unprocessedCount = await prisma.userSessionErrorLog.count({
        where: { processed: false },
      });

      // Log health status
      const status = {
        criticalTickets: criticalCount,
        recentErrors,
        unprocessedErrors: unprocessedCount,
        alertQueueSize: this.alertQueue.length,
        timestamp: new Date(),
      };

      logger.debug(`Health check: ${JSON.stringify(status)}`);

      // Alert if high error rate
      if (recentErrors > 50) {
        await this.notifySuperAdmins({
          type: 'system_alert',
          severity: 'warning',
          title: 'High Error Rate Detected',
          message: `${recentErrors} errors detected in the last hour`,
          data: status,
        });
      }

      // Alert if critical tickets unresolved
      if (criticalCount > 0) {
        await this.notifySuperAdmins({
          type: 'system_alert',
          severity: 'critical',
          title: 'Unresolved Critical Tickets',
          message: `${criticalCount} critical tickets require attention`,
          data: status,
        });
      }

      // Emit health status
      novaMonitoringEvents.emit('health:check', status);

    } catch (error) {
      logger.error('Health check failed:', error);
    }
  }

  /**
   * Process alert queue - send to admins via AI chat
   */
  private async processAlertQueue(): Promise<void> {
    const unreadAlerts = this.alertQueue.filter(a => !a.isRead && !a.isResolved);
    
    if (unreadAlerts.length === 0) return;

    // Group alerts by severity
    const critical = unreadAlerts.filter(a => a.severity === 'CRITICAL' || a.severity === 'FATAL');
    const errors = unreadAlerts.filter(a => a.severity === 'ERROR');
    
    if (critical.length > 0 || errors.length > 3) {
      // Send summary to admins
      await this.sendAlertSummaryToAdmins(unreadAlerts);
    }
  }

  /**
   * Send alert summary to admins
   */
  private async sendAlertSummaryToAdmins(alerts: ErrorAlert[]): Promise<void> {
    const summary = this.buildAlertSummary(alerts);

    await this.notifySuperAdmins({
      type: 'error_alert',
      severity: alerts.some(a => a.severity === 'CRITICAL' || a.severity === 'FATAL') ? 'critical' : 'error',
      title: `Alert Summary: ${alerts.length} issues`,
      message: summary,
      data: {
        alertCount: alerts.length,
        alerts: alerts.slice(0, 10).map(a => ({
          ticketNumber: a.ticketNumber,
          severity: a.severity,
          errorType: a.errorType,
        })),
      },
    });

    // Mark as read
    alerts.forEach(a => a.isRead = true);
  }

  /**
   * Build alert summary message
   */
  private buildAlertSummary(alerts: ErrorAlert[]): string {
    let summary = `## Active Alerts (${alerts.length})\n\n`;

    const bySeverity = {
      critical: alerts.filter(a => a.severity === 'CRITICAL' || a.severity === 'FATAL'),
      error: alerts.filter(a => a.severity === 'ERROR'),
      warning: alerts.filter(a => a.severity === 'WARNING'),
    };

    if (bySeverity.critical.length > 0) {
      summary += `### 🚨 Critical (${bySeverity.critical.length})\n`;
      bySeverity.critical.forEach(a => {
        summary += `- **${a.ticketNumber}**: ${a.errorMessage.substring(0, 100)}\n`;
      });
      summary += '\n';
    }

    if (bySeverity.error.length > 0) {
      summary += `### ❌ Errors (${bySeverity.error.length})\n`;
      bySeverity.error.slice(0, 5).forEach(a => {
        summary += `- **${a.ticketNumber}**: ${a.errorType} (${a.errorCount}x)\n`;
      });
      if (bySeverity.error.length > 5) {
        summary += `- ... and ${bySeverity.error.length - 5} more\n`;
      }
      summary += '\n';
    }

    if (bySeverity.warning.length > 0) {
      summary += `### ⚠️ Warnings (${bySeverity.warning.length})\n`;
    }

    return summary;
  }

  // ============================================
  // PUBLIC API - Chat History & Memory
  // ============================================

  /**
   * Get admin notifications
   */
  getAdminNotifications(userId: string): AdminNotification[] {
    return this.adminNotifications.get(userId) || [];
  }

  /**
   * Mark notification as read
   */
  markNotificationRead(userId: string, notificationId: string): void {
    const notifications = this.adminNotifications.get(userId);
    if (notifications) {
      const notification = notifications.find(n => n.id === notificationId);
      if (notification) {
        notification.isRead = true;
      }
    }
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): ErrorAlert[] {
    return this.alertQueue.filter(a => !a.isResolved);
  }

  /**
   * Get conversation memory for a user
   */
  getConversationMemory(userId: string): ConversationMemory | undefined {
    return this.conversationMemory.get(userId);
  }

  /**
   * Store conversation context for recursive conversations
   */
  async storeConversationContext(
    userId: string,
    sessionId: string,
    context: string
  ): Promise<void> {
    let memory = this.conversationMemory.get(userId);
    
    if (!memory) {
      memory = {
        sessionId,
        userId,
        context: [],
        lastInteraction: new Date(),
        errorHistory: [],
        resolvedIssues: [],
      };
      this.conversationMemory.set(userId, memory);
    }

    memory.context.push(context);
    memory.lastInteraction = new Date();

    // Keep only last 50 context entries
    if (memory.context.length > 50) {
      memory.context = memory.context.slice(-50);
    }

    // Also persist to database for long-term storage
    try {
      const key = `conversation_context_${sessionId}`;
      const existingMemory = await prisma.aIUserMemory.findFirst({
        where: {
          userId,
          scope: 'user',
          category: 'context',
          key,
        },
      });

      if (existingMemory) {
        await prisma.aIUserMemory.update({
          where: { id: existingMemory.id },
          data: {
            value: JSON.parse(JSON.stringify(memory)),
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.aIUserMemory.create({
          data: {
            userId,
            key,
            value: JSON.parse(JSON.stringify(memory)),
            category: 'context',
            scope: 'user',
            source: 'system',
          },
        });
      }
    } catch (error) {
      logger.error('Failed to persist conversation context:', error);
    }
  }

  /**
   * Get chat history for a session with full context
   */
  async getChatHistoryWithContext(
    sessionId: string,
    limit: number = 50
  ): Promise<{
    messages: any[];
    context: ConversationMemory | null;
    relatedErrors: any[];
  }> {
    try {
      const session = await prisma.aIChatSession.findUnique({
        where: { id: sessionId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: limit,
          },
        },
      });

      if (!session) {
        return { messages: [], context: null, relatedErrors: [] };
      }

      // Get conversation memory
      const memory = this.conversationMemory.get(session.userId);

      // Get related error tickets
      const relatedErrors = await prisma.errorTicket.findMany({
        where: {
          userId: session.userId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      return {
        messages: session.messages,
        context: memory || null,
        relatedErrors,
      };
    } catch (error) {
      logger.error('Failed to get chat history:', error);
      return { messages: [], context: null, relatedErrors: [] };
    }
  }

  /**
   * Get admin chat history - all admin alert sessions
   */
  async getAdminChatHistory(
    adminUserId: string,
    limit: number = 20
  ): Promise<any[]> {
    try {
      const sessions = await prisma.aIChatSession.findMany({
        where: {
          userId: adminUserId,
          sessionType: {
            in: ['admin_alerts', 'support', 'system'],
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        take: limit,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      });

      return sessions;
    } catch (error) {
      logger.error('Failed to get admin chat history:', error);
      return [];
    }
  }

  /**
   * Manually trigger error analysis
   */
  async analyzeCurrentErrors(): Promise<{
    totalErrors: number;
    criticalCount: number;
    summary: string;
  }> {
    const unprocessed = await prisma.userSessionErrorLog.findMany({
      where: { processed: false },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const critical = unprocessed.filter(e => 
      e.severity === 'CRITICAL' || e.severity === 'FATAL'
    );

    let summary = `## Error Analysis Report\n\n`;
    summary += `**Total Unprocessed:** ${unprocessed.length}\n`;
    summary += `**Critical/Fatal:** ${critical.length}\n\n`;

    if (critical.length > 0) {
      summary += `### Critical Errors\n`;
      critical.forEach(e => {
        summary += `- ${e.errorType}: ${e.errorMessage.substring(0, 80)}...\n`;
      });
    }

    // Trigger scan
    errorMonitoringEvents.emit('scan:requested');

    return {
      totalErrors: unprocessed.length,
      criticalCount: critical.length,
      summary,
    };
  }

  /**
   * Shutdown the service
   */
  shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.alertProcessorInterval) {
      clearInterval(this.alertProcessorInterval);
    }
    logger.info('Nova Monitoring Service shut down');
  }
}

export const novaMonitoringService = new NovaMonitoringService();
