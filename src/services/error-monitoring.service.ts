/**
 * Error Monitoring Service
 * 
 * Core service for:
 * - Logging user session errors
 * - Scanning for error patterns every 3 minutes
 * - Creating error tickets
 * - Triggering AI intervention
 * - Managing error thresholds and alerts
 */

import prisma from '@/config/database';
import { logger } from '@/utils/logger';
import crypto from 'crypto';
import { EventEmitter } from 'events';

// Types from Prisma
type ErrorSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL' | 'FATAL';
type ErrorTicketStatus = 'DETECTED' | 'ANALYZING' | 'INTERVENING' | 'RESOLVED' | 'ESCALATED' | 'CLOSED';

// Error event types
export interface ErrorLogEvent {
  userId: string;
  accountId?: string;
  sessionToken: string;
  errorType: string;
  errorCode?: string;
  errorMessage: string;
  stackTrace?: string;
  endpoint?: string;
  httpMethod?: string;
  httpStatus?: number;
  requestPayload?: any;
  responsePayload?: any;
  userAction?: string;
  pageUrl?: string;
  component?: string;
  severity?: ErrorSeverity;
}

interface ErrorPattern {
  errorType: string;
  errorCode?: string;
  endpoint?: string;
  messagePattern: string;
}

// Alert color based on error count
const getAlertColor = (errorCount: number, config: any): string => {
  if (errorCount === 0) return 'green';
  if (errorCount <= (config?.yellowThreshold || 2)) return 'yellow';
  if (errorCount <= (config?.orangeThreshold || 5)) return 'orange';
  if (errorCount <= (config?.redThreshold || 10)) return 'red';
  return 'purple'; // Critical
};

// Generate ticket number
const generateTicketNumber = async (): Promise<string> => {
  const count = await prisma.errorTicket.count();
  const paddedNumber = String(count + 1).padStart(5, '0');
  return `ERR-${paddedNumber}`;
};

// Generate pattern hash for grouping similar errors
const generatePatternHash = (pattern: ErrorPattern): string => {
  const data = `${pattern.errorType}:${pattern.errorCode || ''}:${pattern.endpoint || ''}:${pattern.messagePattern.substring(0, 100)}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
};

// Error monitoring event emitter for real-time updates
export const errorMonitoringEvents = new EventEmitter();
errorMonitoringEvents.setMaxListeners(100);

class ErrorMonitoringService {
  private scannerInterval: NodeJS.Timeout | null = null;
  private isScanning = false;
  private defaultConfig = {
    scanIntervalSeconds: 180, // 3 minutes
    isEnabled: true,
    minSeverityForAlert: 'ERROR' as ErrorSeverity,
    errorCountThreshold: 3,
    errorWindowMinutes: 5,
    maxInterventionDelaySeconds: 300,
    greenThreshold: 0,
    yellowThreshold: 2,
    orangeThreshold: 5,
    redThreshold: 10,
    autoIntervene: true,
    autoEscalate: true,
    escalationDelay: 900,
    notifyEmail: true,
    notifyInApp: true,
  };

  /**
   * Initialize the error monitoring service
   */
  async initialize(): Promise<void> {
    logger.info('🔍 Error Monitoring Service initializing...');
    
    // Ensure global config exists
    await this.ensureGlobalConfig();
    
    // Start the scanner
    await this.startScanner();
    
    logger.info('✅ Error Monitoring Service initialized');
  }

  /**
   * Ensure global monitoring config exists
   */
  private async ensureGlobalConfig(): Promise<void> {
    const existing = await prisma.errorMonitoringConfig.findFirst({
      where: { accountId: null },
    });

    if (!existing) {
      await prisma.errorMonitoringConfig.create({
        data: {
          accountId: null,
          ...this.defaultConfig,
        },
      });
      logger.info('Created default error monitoring configuration');
    }
  }

  /**
   * Get monitoring config (account-specific or global default)
   */
  async getConfig(accountId?: string): Promise<any> {
    if (accountId) {
      const accountConfig = await prisma.errorMonitoringConfig.findFirst({
        where: { accountId },
      });
      if (accountConfig) return accountConfig;
    }

    // Fall back to global config
    const globalConfig = await prisma.errorMonitoringConfig.findFirst({
      where: { accountId: null },
    });
    
    return globalConfig || this.defaultConfig;
  }

  /**
   * Update monitoring config
   */
  async updateConfig(accountId: string | null, updates: Partial<typeof this.defaultConfig>): Promise<any> {
    const existing = await prisma.errorMonitoringConfig.findFirst({
      where: { accountId },
    });

    if (existing) {
      return prisma.errorMonitoringConfig.update({
        where: { id: existing.id },
        data: updates,
      });
    } else {
      return prisma.errorMonitoringConfig.create({
        data: {
          accountId,
          ...this.defaultConfig,
          ...updates,
        },
      });
    }
  }

  /**
   * Log an error from user session
   */
  async logError(event: ErrorLogEvent): Promise<any> {
    try {
      // Check for existing similar error in this session
      const existingError = await prisma.userSessionErrorLog.findFirst({
        where: {
          userId: event.userId,
          sessionToken: event.sessionToken,
          errorType: event.errorType,
          errorCode: event.errorCode || null,
          endpoint: event.endpoint || null,
          processed: false,
          createdAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
          },
        },
      });

      if (existingError) {
        // Update existing error with incremented count
        const updated = await prisma.userSessionErrorLog.update({
          where: { id: existingError.id },
          data: {
            occurenceCount: existingError.occurenceCount + 1,
            lastOccurrence: new Date(),
            isRecurring: true,
          },
        });

        logger.debug(`Error occurrence incremented: ${updated.id} (count: ${updated.occurenceCount})`);
        
        // Emit event
        errorMonitoringEvents.emit('error:updated', updated);
        
        return updated;
      }

      // Create new error log
      const errorLog = await prisma.userSessionErrorLog.create({
        data: {
          userId: event.userId,
          accountId: event.accountId,
          sessionToken: event.sessionToken,
          errorType: event.errorType,
          errorCode: event.errorCode,
          errorMessage: event.errorMessage,
          stackTrace: event.stackTrace,
          endpoint: event.endpoint,
          httpMethod: event.httpMethod,
          httpStatus: event.httpStatus,
          requestPayload: event.requestPayload,
          responsePayload: event.responsePayload,
          userAction: event.userAction,
          pageUrl: event.pageUrl,
          component: event.component,
          severity: event.severity || 'ERROR',
        },
      });

      logger.info(`New error logged: ${errorLog.id} (${event.errorType}) for user ${event.userId}`);
      
      // Emit event
      errorMonitoringEvents.emit('error:new', errorLog);
      
      // Check if immediate intervention is needed (CRITICAL or FATAL)
      if (event.severity === 'CRITICAL' || event.severity === 'FATAL') {
        await this.triggerImmediateIntervention(errorLog);
      }

      return errorLog;
    } catch (error) {
      logger.error('Failed to log error:', error);
      throw error;
    }
  }

  /**
   * Start the error scanning scheduler
   */
  async startScanner(): Promise<void> {
    const config = await this.getConfig();
    
    if (!config.isEnabled) {
      logger.info('Error monitoring scanner is disabled');
      return;
    }

    const intervalMs = (config.scanIntervalSeconds || 180) * 1000;
    
    logger.info(`Starting error scanner (interval: ${config.scanIntervalSeconds}s)`);
    
    // Run initial scan
    await this.scanForErrors();
    
    // Schedule periodic scans
    this.scannerInterval = setInterval(async () => {
      await this.scanForErrors();
    }, intervalMs);
  }

  /**
   * Stop the error scanner
   */
  stopScanner(): void {
    if (this.scannerInterval) {
      clearInterval(this.scannerInterval);
      this.scannerInterval = null;
      logger.info('Error scanner stopped');
    }
  }

  /**
   * Shutdown the error monitoring service
   */
  shutdown(): void {
    logger.info('Shutting down Error Monitoring Service...');
    this.stopScanner();
  }

  /**
   * Main error scanning logic - runs every 3 minutes
   */
  async scanForErrors(): Promise<void> {
    if (this.isScanning) {
      logger.debug('Scan already in progress, skipping...');
      return;
    }

    this.isScanning = true;
    const scanStartTime = Date.now();

    try {
      logger.debug('🔍 Starting error scan...');
      
      const config = await this.getConfig();
      const windowStart = new Date(Date.now() - (config.errorWindowMinutes || 5) * 60 * 1000);
      
      // Get unprocessed errors grouped by user session
      const unprocessedErrors = await prisma.userSessionErrorLog.findMany({
        where: {
          processed: false,
          createdAt: { gte: windowStart },
          severity: {
            in: this.getSeveritiesAboveThreshold(config.minSeverityForAlert),
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (unprocessedErrors.length === 0) {
        logger.debug('No unprocessed errors found');
        this.isScanning = false;
        return;
      }

      logger.info(`Found ${unprocessedErrors.length} unprocessed errors`);

      // Group errors by user session
      const errorsByUser = new Map<string, typeof unprocessedErrors>();
      for (const error of unprocessedErrors) {
        const key = `${error.userId}:${error.sessionToken}`;
        if (!errorsByUser.has(key)) {
          errorsByUser.set(key, []);
        }
        errorsByUser.get(key)!.push(error);
      }

      // Process each user's errors
      for (const [userKey, errors] of errorsByUser) {
        const [userId, sessionToken] = userKey.split(':');
        const errorCount = errors.reduce((sum, e) => sum + e.occurenceCount, 0);
        
        // Check if error count exceeds threshold
        if (errorCount >= (config.errorCountThreshold || 3)) {
          await this.createTicketAndIntervene(userId, sessionToken, errors, config);
        }
      }

      const scanDuration = Date.now() - scanStartTime;
      logger.debug(`Error scan completed in ${scanDuration}ms`);
      
      // Emit scan complete event
      errorMonitoringEvents.emit('scan:complete', {
        errorsProcessed: unprocessedErrors.length,
        duration: scanDuration,
      });

    } catch (error) {
      logger.error('Error during scan:', error);
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Get severities at or above threshold
   */
  private getSeveritiesAboveThreshold(threshold: ErrorSeverity): ErrorSeverity[] {
    const severityOrder: ErrorSeverity[] = ['INFO', 'WARNING', 'ERROR', 'CRITICAL', 'FATAL'];
    const thresholdIndex = severityOrder.indexOf(threshold);
    return severityOrder.slice(thresholdIndex);
  }

  /**
   * Create ticket and trigger AI intervention
   */
  private async createTicketAndIntervene(
    userId: string,
    _sessionToken: string, // Preserved for future session-specific tracking
    errors: any[],
    config: any
  ): Promise<void> {
    try {
      // Check if ticket already exists for this pattern
      const primaryError = errors[0];
      const patternHash = generatePatternHash({
        errorType: primaryError.errorType,
        errorCode: primaryError.errorCode,
        endpoint: primaryError.endpoint,
        messagePattern: primaryError.errorMessage,
      });

      const existingTicket = await prisma.errorTicket.findFirst({
        where: {
          userId,
          errorPattern: patternHash,
          status: {
            in: ['DETECTED', 'ANALYZING', 'INTERVENING'],
          },
          createdAt: {
            gte: new Date(Date.now() - 30 * 60 * 1000), // Last 30 min
          },
        },
      });

      if (existingTicket) {
        // Update existing ticket
        await prisma.errorTicket.update({
          where: { id: existingTicket.id },
          data: {
            errorCount: existingTicket.errorCount + errors.length,
            alertColor: getAlertColor(existingTicket.errorCount + errors.length, config),
          },
        });

        // Link errors to existing ticket
        await prisma.userSessionErrorLog.updateMany({
          where: { id: { in: errors.map(e => e.id) } },
          data: { 
            ticketId: existingTicket.id,
            processed: true,
            processedAt: new Date(),
          },
        });

        logger.info(`Updated existing ticket ${existingTicket.ticketNumber} with ${errors.length} new errors`);
        return;
      }

      // Create new ticket
      const totalErrorCount = errors.reduce((sum, e) => sum + e.occurenceCount, 0);
      const ticketNumber = await generateTicketNumber();

      // Get user info for better ticket context
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true, lastName: true },
      });

      const ticket = await prisma.errorTicket.create({
        data: {
          userId,
          accountId: primaryError.accountId,
          ticketNumber,
          title: this.generateTicketTitle(errors),
          description: this.generateTicketDescription(errors, user),
          severity: this.getHighestSeverity(errors),
          status: 'DETECTED',
          errorPattern: patternHash,
          errorCount: totalErrorCount,
          affectedFeature: this.inferAffectedFeature(errors),
          alertColor: getAlertColor(totalErrorCount, config),
        },
      });

      // Link errors to ticket
      await prisma.userSessionErrorLog.updateMany({
        where: { id: { in: errors.map(e => e.id) } },
        data: { 
          ticketId: ticket.id,
          processed: true,
          processedAt: new Date(),
        },
      });

      logger.info(`Created ticket ${ticket.ticketNumber} for user ${userId} with ${errors.length} errors`);

      // Emit ticket created event
      errorMonitoringEvents.emit('ticket:created', ticket);

      // Update or create error pattern
      await this.updateErrorPattern(patternHash, primaryError);

      // Trigger AI intervention if auto-intervene is enabled
      if (config.autoIntervene) {
        await this.requestAIIntervention(ticket);
      }

    } catch (error) {
      logger.error('Failed to create ticket and intervene:', error);
    }
  }

  /**
   * Trigger immediate intervention for critical errors
   */
  private async triggerImmediateIntervention(errorLog: any): Promise<void> {
    // Config may be needed for future customization
    // const config = await this.getConfig(errorLog.accountId);
    
    const ticketNumber = await generateTicketNumber();
    
    const ticket = await prisma.errorTicket.create({
      data: {
        userId: errorLog.userId,
        accountId: errorLog.accountId,
        ticketNumber,
        title: `URGENT: ${errorLog.errorType} - ${errorLog.errorMessage.substring(0, 100)}`,
        description: `Critical error requiring immediate attention:\n\n${errorLog.errorMessage}`,
        severity: errorLog.severity,
        status: 'DETECTED',
        errorPattern: generatePatternHash({
          errorType: errorLog.errorType,
          errorCode: errorLog.errorCode,
          endpoint: errorLog.endpoint,
          messagePattern: errorLog.errorMessage,
        }),
        errorCount: 1,
        priority: 1, // Highest priority
        alertColor: 'purple', // Critical color
      },
    });

    await prisma.userSessionErrorLog.update({
      where: { id: errorLog.id },
      data: { 
        ticketId: ticket.id,
        processed: true,
        processedAt: new Date(),
      },
    });

    logger.warn(`Created CRITICAL ticket ${ticket.ticketNumber} for immediate intervention`);
    
    errorMonitoringEvents.emit('ticket:critical', ticket);

    // Request immediate AI intervention
    await this.requestAIIntervention(ticket);
  }

  /**
   * Request AI intervention for a ticket
   */
  async requestAIIntervention(ticket: any): Promise<void> {
    const analysisStartTime = Date.now();
    
    try {
      // Update ticket status to analyzing
      await prisma.errorTicket.update({
        where: { id: ticket.id },
        data: { status: 'ANALYZING' },
      });

      // Emit event for AI intervention service to handle
      errorMonitoringEvents.emit('intervention:requested', {
        ticketId: ticket.id,
        userId: ticket.userId,
        severity: ticket.severity,
        errorPattern: ticket.errorPattern,
        detectionToAnalysisMs: Date.now() - analysisStartTime,
      });

      logger.info(`AI intervention requested for ticket ${ticket.ticketNumber}`);

    } catch (error) {
      logger.error('Failed to request AI intervention:', error);
    }
  }

  /**
   * Generate ticket title from errors
   */
  private generateTicketTitle(errors: any[]): string {
    const primaryError = errors[0];
    const count = errors.reduce((sum, e) => sum + e.occurenceCount, 0);
    
    const actionMap: Record<string, string> = {
      'api_error': 'API Request Failed',
      'auth_error': 'Authentication Issue',
      'sync_error': 'Sync Operation Failed',
      'validation_error': 'Data Validation Error',
      'network_error': 'Network Connection Issue',
      'ui_error': 'Interface Error',
    };

    const action = actionMap[primaryError.errorType] || 'Error Detected';
    return `${action} (${count} occurrence${count > 1 ? 's' : ''})`;
  }

  /**
   * Generate ticket description
   */
  private generateTicketDescription(errors: any[], user: any): string {
    const primaryError = errors[0];
    const totalCount = errors.reduce((sum, e) => sum + e.occurenceCount, 0);
    
    let description = `## Error Summary\n\n`;
    description += `**User:** ${user?.firstName || ''} ${user?.lastName || ''} (${user?.email || primaryError.userId})\n`;
    description += `**Total Occurrences:** ${totalCount}\n`;
    description += `**Error Type:** ${primaryError.errorType}\n`;
    description += `**First Seen:** ${primaryError.firstOccurrence}\n`;
    description += `**Last Seen:** ${primaryError.lastOccurrence}\n\n`;
    
    description += `## Error Details\n\n`;
    description += `**Message:** ${primaryError.errorMessage}\n\n`;
    
    if (primaryError.endpoint) {
      description += `**Endpoint:** ${primaryError.httpMethod || 'N/A'} ${primaryError.endpoint}\n`;
    }
    
    if (primaryError.httpStatus) {
      description += `**HTTP Status:** ${primaryError.httpStatus}\n`;
    }
    
    if (primaryError.userAction) {
      description += `**User Action:** ${primaryError.userAction}\n`;
    }
    
    if (primaryError.pageUrl) {
      description += `**Page:** ${primaryError.pageUrl}\n`;
    }

    return description;
  }

  /**
   * Get highest severity from errors
   */
  private getHighestSeverity(errors: any[]): ErrorSeverity {
    const severityOrder: ErrorSeverity[] = ['INFO', 'WARNING', 'ERROR', 'CRITICAL', 'FATAL'];
    let highest = 0;
    
    for (const error of errors) {
      const index = severityOrder.indexOf(error.severity);
      if (index > highest) highest = index;
    }
    
    return severityOrder[highest];
  }

  /**
   * Infer affected feature from errors
   */
  private inferAffectedFeature(errors: any[]): string {
    const endpoints = errors.map(e => e.endpoint).filter(Boolean);
    
    const featurePatterns: Record<string, string[]> = {
      'Inventory Management': ['/vehicles', '/sync', '/inventory'],
      'Facebook Integration': ['/facebook', '/posting'],
      'User Authentication': ['/auth', '/login', '/register'],
      'Settings': ['/settings', '/accounts'],
      'Leads & Messages': ['/leads', '/messages'],
      'Analytics': ['/analytics', '/reports'],
    };

    for (const [feature, patterns] of Object.entries(featurePatterns)) {
      for (const pattern of patterns) {
        if (endpoints.some(e => e?.includes(pattern))) {
          return feature;
        }
      }
    }

    // Check page URLs
    const pageUrls = errors.map(e => e.pageUrl).filter(Boolean);
    if (pageUrls.some(p => p?.includes('/inventory'))) return 'Inventory Management';
    if (pageUrls.some(p => p?.includes('/settings'))) return 'Settings';
    if (pageUrls.some(p => p?.includes('/facebook'))) return 'Facebook Integration';

    return 'General';
  }

  /**
   * Update or create error pattern for learning
   */
  private async updateErrorPattern(patternHash: string, error: any): Promise<void> {
    try {
      const existing = await prisma.errorPattern.findUnique({
        where: { patternHash },
      });

      if (existing) {
        await prisma.errorPattern.update({
          where: { patternHash },
          data: {
            totalOccurrences: existing.totalOccurrences + 1,
            lastUpdated: new Date(),
          },
        });
      } else {
        await prisma.errorPattern.create({
          data: {
            patternHash,
            patternName: `${error.errorType}: ${error.errorMessage.substring(0, 50)}`,
            errorType: error.errorType,
            errorCodePattern: error.errorCode,
            messagePattern: error.errorMessage.substring(0, 500),
            endpointPattern: error.endpoint,
            severity: error.severity,
            category: this.categorizeError(error),
          },
        });
      }
    } catch (err) {
      logger.error('Failed to update error pattern:', err);
    }
  }

  /**
   * Categorize error type
   */
  private categorizeError(error: any): string {
    if (error.errorType === 'auth_error' || error.httpStatus === 401 || error.httpStatus === 403) {
      return 'authentication';
    }
    if (error.errorType === 'sync_error' || error.endpoint?.includes('/sync')) {
      return 'data_sync';
    }
    if (error.httpStatus === 429) {
      return 'api_limit';
    }
    if (error.errorType === 'validation_error' || error.httpStatus === 400) {
      return 'validation';
    }
    if (error.errorType === 'network_error' || error.errorMessage?.includes('network')) {
      return 'network';
    }
    return 'unknown';
  }

  /**
   * Get user's active errors (for real-time monitoring)
   */
  async getUserActiveErrors(userId: string): Promise<any[]> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    return prisma.userSessionErrorLog.findMany({
      where: {
        userId,
        createdAt: { gte: fiveMinutesAgo },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  /**
   * Get active tickets for a user
   */
  async getUserActiveTickets(userId: string): Promise<any[]> {
    return prisma.errorTicket.findMany({
      where: {
        userId,
        status: { in: ['DETECTED', 'ANALYZING', 'INTERVENING'] },
      },
      include: {
        interventions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get system-wide error statistics
   */
  async getErrorStats(accountId?: string): Promise<any> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const whereClause = accountId ? { accountId } : {};

    const [
      last24hErrors,
      lastHourErrors,
      activeTickets,
      resolvedToday,
      bySeverity,
      byType,
    ] = await Promise.all([
      prisma.userSessionErrorLog.count({
        where: { ...whereClause, createdAt: { gte: twentyFourHoursAgo } },
      }),
      prisma.userSessionErrorLog.count({
        where: { ...whereClause, createdAt: { gte: oneHourAgo } },
      }),
      prisma.errorTicket.count({
        where: {
          ...whereClause,
          status: { in: ['DETECTED', 'ANALYZING', 'INTERVENING'] },
        },
      }),
      prisma.errorTicket.count({
        where: {
          ...whereClause,
          status: { in: ['RESOLVED', 'CLOSED'] },
          resolvedAt: { gte: twentyFourHoursAgo },
        },
      }),
      prisma.userSessionErrorLog.groupBy({
        by: ['severity'],
        where: { ...whereClause, createdAt: { gte: twentyFourHoursAgo } },
        _count: { id: true },
      }),
      prisma.userSessionErrorLog.groupBy({
        by: ['errorType'],
        where: { ...whereClause, createdAt: { gte: twentyFourHoursAgo } },
        _count: { id: true },
      }),
    ]);

    return {
      summary: {
        last24h: last24hErrors,
        lastHour: lastHourErrors,
        activeTickets,
        resolvedToday,
      },
      bySeverity: bySeverity.reduce((acc: any, item) => {
        acc[item.severity] = item._count.id;
        return acc;
      }, {}),
      byType: byType.reduce((acc: any, item) => {
        acc[item.errorType] = item._count.id;
        return acc;
      }, {}),
    };
  }

  /**
   * Get all tickets with filters
   */
  async getTickets(filters: {
    status?: ErrorTicketStatus[];
    severity?: ErrorSeverity[];
    alertColor?: string[];
    accountId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ tickets: any[]; total: number }> {
    const whereClause: any = {};
    
    if (filters.status?.length) whereClause.status = { in: filters.status };
    if (filters.severity?.length) whereClause.severity = { in: filters.severity };
    if (filters.alertColor?.length) whereClause.alertColor = { in: filters.alertColor };
    if (filters.accountId) whereClause.accountId = filters.accountId;

    const [tickets, total] = await Promise.all([
      prisma.errorTicket.findMany({
        where: whereClause,
        include: {
          interventions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          errorLogs: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
        orderBy: [
          { severity: 'desc' },
          { priority: 'asc' },
          { createdAt: 'desc' },
        ],
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      prisma.errorTicket.count({ where: whereClause }),
    ]);

    return { tickets, total };
  }

  /**
   * Update ticket status
   */
  async updateTicketStatus(
    ticketId: string,
    status: ErrorTicketStatus,
    additionalData?: {
      resolutionMethod?: string;
      resolutionNotes?: string;
      escalatedTo?: string;
      escalationReason?: string;
    }
  ): Promise<any> {
    const updateData: any = { status };
    
    if (status === 'RESOLVED' || status === 'CLOSED') {
      updateData.resolvedAt = new Date();
      const ticket = await prisma.errorTicket.findUnique({ where: { id: ticketId } });
      if (ticket) {
        updateData.totalResolutionMs = Date.now() - ticket.detectedAt.getTime();
      }
    }
    
    if (status === 'ESCALATED' && additionalData) {
      updateData.escalatedTo = additionalData.escalatedTo;
      updateData.escalatedAt = new Date();
      updateData.escalationReason = additionalData.escalationReason;
    }
    
    if (additionalData?.resolutionMethod) {
      updateData.resolutionMethod = additionalData.resolutionMethod;
    }
    if (additionalData?.resolutionNotes) {
      updateData.resolutionNotes = additionalData.resolutionNotes;
    }

    const updated = await prisma.errorTicket.update({
      where: { id: ticketId },
      data: updateData,
    });

    errorMonitoringEvents.emit('ticket:updated', updated);
    
    return updated;
  }

  /**
   * Generate daily summary
   */
  async generateDailySummary(accountId?: string): Promise<any> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const whereClause = accountId ? { accountId } : {};

    const [tickets, interventions, errors] = await Promise.all([
      prisma.errorTicket.findMany({
        where: {
          ...whereClause,
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
      prisma.aIIntervention.findMany({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
          ...(accountId ? { ticket: { accountId } } : {}),
        },
      }),
      prisma.userSessionErrorLog.findMany({
        where: {
          ...whereClause,
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
    ]);

    return prisma.aIInterventionSummary.create({
      data: {
        summaryType: 'daily',
        periodStart: startOfDay,
        periodEnd: endOfDay,
        accountId,
        totalErrors: errors.length,
        totalTickets: tickets.length,
        totalInterventions: interventions.length,
        resolvedCount: tickets.filter(t => t.status === 'RESOLVED').length,
        escalatedCount: tickets.filter(t => t.status === 'ESCALATED').length,
        criticalCount: errors.filter(e => e.severity === 'CRITICAL' || e.severity === 'FATAL').length,
        errorCount: errors.filter(e => e.severity === 'ERROR').length,
        warningCount: errors.filter(e => e.severity === 'WARNING').length,
        infoCount: errors.filter(e => e.severity === 'INFO').length,
        agentSummary: this.generateAgentSummaryText(tickets, interventions),
      },
    });
  }

  /**
   * Generate summary text for AI agent
   */
  private generateAgentSummaryText(tickets: any[], interventions: any[]): string {
    return `
## Daily Error Monitoring Summary

### Overview
- Total Tickets Created: ${tickets.length}
- Total AI Interventions: ${interventions.length}
- Resolution Rate: ${tickets.length > 0 ? ((tickets.filter(t => t.status === 'RESOLVED').length / tickets.length) * 100).toFixed(1) : 0}%
- Escalation Rate: ${tickets.length > 0 ? ((tickets.filter(t => t.status === 'ESCALATED').length / tickets.length) * 100).toFixed(1) : 0}%

### Severity Distribution
${Object.entries(tickets.reduce((acc: any, t) => {
  acc[t.severity] = (acc[t.severity] || 0) + 1;
  return acc;
}, {})).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

### Most Affected Features
${Object.entries(tickets.reduce((acc: any, t) => {
  if (t.affectedFeature) {
    acc[t.affectedFeature] = (acc[t.affectedFeature] || 0) + 1;
  }
  return acc;
}, {})).map(([k, v]) => `- ${k}: ${v}`).join('\n') || '- None recorded'}
    `.trim();
  }
}

// Singleton instance
export const errorMonitoringService = new ErrorMonitoringService();
