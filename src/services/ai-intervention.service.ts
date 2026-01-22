/**
 * AI Intervention Service
 * 
 * Handles AI-driven error analysis and user intervention:
 * - Analyzes error tickets using AI
 * - Generates diagnoses and solutions
 * - Sends proactive messages to users via chat
 * - Tracks intervention effectiveness
 * - Manages escalation workflows
 */

import prisma from '@/config/database';
import { logger } from '@/utils/logger';
import { errorMonitoringEvents } from './error-monitoring.service';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { EventEmitter } from 'events';

// AI clients
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
}) : null;

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

// Types
type ErrorSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL' | 'FATAL';

interface AIAnalysisResult {
  diagnosis: string;
  rootCause: string;
  solution: string;
  steps: string[];
  confidence: number;
  escalationRecommended: boolean;
  escalationReason?: string;
}

interface InterventionMessage {
  greeting: string;
  problemIdentification: string;
  diagnosis: string;
  steps: string[];
  conclusion: string;
}

// Event emitter for intervention events
export const aiInterventionEvents = new EventEmitter();
aiInterventionEvents.setMaxListeners(100);

// AI Agent roles
const AI_AGENT_ROLES = {
  support_ai: {
    name: 'Nova Support',
    systemPrompt: `You are Nova Support, a friendly and helpful AI assistant for Dealers Face.
Your role is to help users resolve technical issues they're experiencing.
Be empathetic, professional, and provide clear step-by-step guidance.
Always acknowledge the user's frustration if they're having problems.
Keep responses concise but thorough enough to solve the problem.`,
  },
  admin_ai: {
    name: 'Nova Admin',
    systemPrompt: `You are Nova Admin, an AI assistant for dealership administrators.
You help with account-level issues, configurations, and technical problems.
Be professional and efficient, focusing on quick resolution.
Provide detailed technical explanations when appropriate.`,
  },
  root_ai: {
    name: 'Nova System',
    systemPrompt: `You are Nova System, the root-level AI for Dealers Face.
You analyze system-wide issues and generate comprehensive reports.
Your summaries should be technical, precise, and actionable.
Focus on diagnostics, patterns, and systemic improvements.`,
  },
};

class AIInterventionService {
  private processingQueue: Map<string, boolean> = new Map();

  /**
   * Initialize the service and subscribe to error monitoring events
   */
  initialize(): void {
    logger.info('🤖 AI Intervention Service initializing...');

    // Subscribe to error monitoring events
    errorMonitoringEvents.on('intervention:requested', async (data) => {
      await this.processInterventionRequest(data);
    });

    errorMonitoringEvents.on('ticket:critical', async (ticket) => {
      await this.processUrgentIntervention(ticket);
    });

    logger.info('✅ AI Intervention Service initialized');
  }

  /**
   * Process an intervention request
   */
  async processInterventionRequest(data: {
    ticketId: string;
    userId: string;
    severity: ErrorSeverity;
    errorPattern: string;
    detectionToAnalysisMs: number;
  }): Promise<void> {
    const { ticketId, userId } = data;

    // Prevent duplicate processing
    if (this.processingQueue.has(ticketId)) {
      logger.debug(`Ticket ${ticketId} already being processed`);
      return;
    }

    this.processingQueue.set(ticketId, true);

    try {
      logger.info(`Processing intervention for ticket ${ticketId}`);

      // Get full ticket data
      const ticket = await prisma.errorTicket.findUnique({
        where: { id: ticketId },
        include: {
          errorLogs: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      if (!ticket) {
        logger.error(`Ticket ${ticketId} not found`);
        return;
      }

      // Get error pattern knowledge
      const pattern = await prisma.errorPattern.findUnique({
        where: { patternHash: ticket.errorPattern },
      });

      // Analyze with AI
      const analysis = await this.analyzeError(ticket, pattern);

      // Update ticket with AI analysis
      const analysisTime = Date.now();
      await prisma.errorTicket.update({
        where: { id: ticketId },
        data: {
          status: 'INTERVENING',
          aiAnalysis: analysis.diagnosis,
          aiDiagnosis: analysis.rootCause,
          aiSolution: analysis.solution,
          aiConfidence: analysis.confidence,
          analyzedAt: new Date(),
          detectionToAnalysisMs: data.detectionToAnalysisMs,
        },
      });

      // Generate and send message to user
      const message = await this.generateInterventionMessage(ticket, analysis, userId);
      await this.sendInterventionMessage(ticketId, userId, message, analysis);

      // Calculate intervention timing
      const interventionTime = Date.now();
      await prisma.errorTicket.update({
        where: { id: ticketId },
        data: {
          interveneAt: new Date(),
          analysisToInterventionMs: interventionTime - analysisTime,
        },
      });

      // Check if escalation is recommended
      if (analysis.escalationRecommended) {
        await this.scheduleEscalation(ticketId, analysis.escalationReason);
      }

      // Update error pattern with new knowledge
      if (pattern) {
        await this.updatePatternKnowledge(pattern.id, analysis);
      }

      logger.info(`Intervention completed for ticket ${ticketId}`);

    } catch (error) {
      logger.error(`Failed to process intervention for ticket ${ticketId}:`, error);
    } finally {
      this.processingQueue.delete(ticketId);
    }
  }

  /**
   * Process urgent intervention for critical errors
   */
  async processUrgentIntervention(ticket: any): Promise<void> {
    logger.warn(`Processing URGENT intervention for ticket ${ticket.ticketNumber}`);

    try {
      // Fast-track analysis for critical errors
      const analysis: AIAnalysisResult = {
        diagnosis: 'Critical system error detected that requires immediate attention.',
        rootCause: `A ${ticket.severity} error occurred that may be affecting your ability to use the system.`,
        solution: 'Our support team has been automatically notified. Please try the following while we investigate.',
        steps: [
          'Refresh your browser page',
          'Clear your browser cache',
          'Try logging out and back in',
          'If the issue persists, our team will reach out shortly',
        ],
        confidence: 0.7,
        escalationRecommended: true,
        escalationReason: 'Critical error severity',
      };

      // Send immediate intervention message
      const message: InterventionMessage = {
        greeting: '🚨 **Urgent: We detected a critical issue**',
        problemIdentification: `We noticed you encountered a serious error while using our system.`,
        diagnosis: analysis.diagnosis,
        steps: analysis.steps,
        conclusion: 'Our team has been automatically notified and will investigate immediately. We apologize for any inconvenience.',
      };

      await this.sendInterventionMessage(ticket.id, ticket.userId, message, analysis);

      // Auto-escalate critical issues
      await this.escalateToAdmin(ticket.id, 'Critical error auto-escalation');

    } catch (error) {
      logger.error(`Failed urgent intervention for ticket ${ticket.id}:`, error);
    }
  }

  /**
   * Analyze error using AI
   */
  private async analyzeError(ticket: any, pattern: any | null): Promise<AIAnalysisResult> {
    const errorContext = this.buildErrorContext(ticket);

    // If we have existing pattern knowledge, use it
    if (pattern?.solution && pattern?.isVerified) {
      return {
        diagnosis: pattern.rootCause || 'Known issue pattern detected.',
        rootCause: pattern.rootCause || 'See pattern documentation.',
        solution: pattern.solution,
        steps: pattern.preventionTips?.split('\n').filter(Boolean) || [],
        confidence: 0.95,
        escalationRecommended: false,
      };
    }

    // Use AI for analysis
    const prompt = `Analyze this error and provide diagnosis and solution:

## Error Information
- Type: ${ticket.errorLogs[0]?.errorType || 'Unknown'}
- Message: ${ticket.errorLogs[0]?.errorMessage || ticket.description}
- Endpoint: ${ticket.errorLogs[0]?.endpoint || 'N/A'}
- HTTP Status: ${ticket.errorLogs[0]?.httpStatus || 'N/A'}
- User Action: ${ticket.errorLogs[0]?.userAction || 'N/A'}
- Occurrences: ${ticket.errorCount}
- Severity: ${ticket.severity}

## Context
${errorContext}

Provide a JSON response with:
{
  "diagnosis": "Brief explanation of what went wrong",
  "rootCause": "Technical root cause",
  "solution": "How to fix it",
  "steps": ["Step 1", "Step 2", ...],
  "confidence": 0.0-1.0,
  "escalationRecommended": true/false,
  "escalationReason": "reason if escalation needed"
}`;

    try {
      let result: AIAnalysisResult;

      if (anthropic) {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        const content = response.content[0];
        if (content.type === 'text') {
          // Extract JSON from response
          const jsonMatch = content.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            result = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No JSON found in response');
          }
        } else {
          throw new Error('Unexpected response type');
        }
      } else if (openai) {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          result = JSON.parse(content);
        } else {
          throw new Error('No content in response');
        }
      } else {
        // Fallback without AI
        result = this.generateFallbackAnalysis(ticket);
      }

      return result;

    } catch (error) {
      logger.error('AI analysis failed:', error);
      return this.generateFallbackAnalysis(ticket);
    }
  }

  /**
   * Build error context string
   */
  private buildErrorContext(ticket: any): string {
    const contexts: string[] = [];

    if (ticket.affectedFeature) {
      contexts.push(`Feature Affected: ${ticket.affectedFeature}`);
    }

    if (ticket.errorLogs?.length > 1) {
      contexts.push(`Multiple errors detected (${ticket.errorLogs.length} unique errors)`);
    }

    // Add common error patterns
    const errorMessages = ticket.errorLogs?.map((e: any) => e.errorMessage) || [];
    if (errorMessages.some((m: string) => m.includes('401') || m.includes('unauthorized'))) {
      contexts.push('Pattern: Authentication related issue');
    }
    if (errorMessages.some((m: string) => m.includes('network') || m.includes('timeout'))) {
      contexts.push('Pattern: Network connectivity issue');
    }
    if (errorMessages.some((m: string) => m.includes('sync') || m.includes('FTP'))) {
      contexts.push('Pattern: Data synchronization issue');
    }

    return contexts.join('\n') || 'No additional context available';
  }

  /**
   * Generate fallback analysis without AI
   */
  private generateFallbackAnalysis(ticket: any): AIAnalysisResult {
    const errorType = ticket.errorLogs?.[0]?.errorType || 'unknown';
    const httpStatus = ticket.errorLogs?.[0]?.httpStatus;

    const fallbackResponses: Record<string, Partial<AIAnalysisResult>> = {
      auth_error: {
        diagnosis: 'Authentication issue detected',
        rootCause: 'Your session may have expired or credentials are invalid',
        solution: 'Please try logging out and back in',
        steps: ['Log out of your account', 'Clear browser cache', 'Log back in', 'If issue persists, reset your password'],
      },
      sync_error: {
        diagnosis: 'Data synchronization issue',
        rootCause: 'There was a problem syncing your inventory data',
        solution: 'Check your FTP settings and try manual sync',
        steps: ['Go to Settings > Sync', 'Verify FTP credentials', 'Test connection', 'Trigger manual sync'],
      },
      api_error: {
        diagnosis: 'API request failed',
        rootCause: 'The server encountered an error processing your request',
        solution: 'Please try the action again',
        steps: ['Wait a few seconds', 'Refresh the page', 'Try the action again', 'Contact support if it continues'],
      },
      network_error: {
        diagnosis: 'Network connectivity issue',
        rootCause: 'Connection to the server was interrupted',
        solution: 'Check your internet connection',
        steps: ['Check your internet connection', 'Try refreshing the page', 'Disable VPN if using one', 'Try a different browser'],
      },
    };

    // HTTP status specific responses
    if (httpStatus === 404) {
      return {
        diagnosis: 'Resource not found',
        rootCause: 'The requested page or data does not exist',
        solution: 'Navigate back and try again',
        steps: ['Go back to the previous page', 'Check if the URL is correct', 'The item may have been deleted'],
        confidence: 0.8,
        escalationRecommended: false,
      };
    }

    if (httpStatus === 500) {
      return {
        diagnosis: 'Server error occurred',
        rootCause: 'An unexpected error happened on our servers',
        solution: 'We are investigating the issue',
        steps: ['Wait a minute and try again', 'If urgent, contact support', 'Our team has been notified'],
        confidence: 0.7,
        escalationRecommended: true,
        escalationReason: 'Server error (500)',
      };
    }

    const fallback = fallbackResponses[errorType] || {
      diagnosis: 'An error occurred',
      rootCause: 'We detected an issue with your recent action',
      solution: 'Please try again',
      steps: ['Refresh the page', 'Try the action again', 'Contact support if the issue persists'],
    };

    return {
      diagnosis: fallback.diagnosis!,
      rootCause: fallback.rootCause!,
      solution: fallback.solution!,
      steps: fallback.steps!,
      confidence: 0.6,
      escalationRecommended: ticket.severity === 'CRITICAL' || ticket.severity === 'FATAL',
      escalationReason: ticket.severity === 'CRITICAL' || ticket.severity === 'FATAL' ? 'High severity error' : undefined,
    };
  }

  /**
   * Generate intervention message for user
   */
  private async generateInterventionMessage(
    ticket: any,
    analysis: AIAnalysisResult,
    userId: string
  ): Promise<InterventionMessage> {
    // Get user's first name for personalization
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true },
    });

    const userName = user?.firstName || 'there';

    return {
      greeting: `👋 Hi ${userName}! I noticed you might be having some trouble.`,
      problemIdentification: `It looks like you've encountered ${ticket.errorCount > 1 ? 'some issues' : 'an issue'} ${ticket.affectedFeature ? `with ${ticket.affectedFeature}` : 'while using the system'}.`,
      diagnosis: analysis.diagnosis,
      steps: analysis.steps,
      conclusion: analysis.confidence >= 0.8
        ? `These steps should resolve the issue. Let me know if you need any more help!`
        : `If these steps don't help, I can connect you with our support team for more assistance.`,
    };
  }

  /**
   * Send intervention message to user via AI chat
   */
  async sendInterventionMessage(
    ticketId: string,
    userId: string,
    message: InterventionMessage,
    analysis: AIAnalysisResult
  ): Promise<void> {
    try {
      // Format the message
      const formattedMessage = this.formatInterventionMessage(message);

      // Get or create a chat session for interventions
      let session = await prisma.aIChatSession.findFirst({
        where: {
          userId,
          sessionType: 'support',
          status: 'active',
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!session) {
        session = await prisma.aIChatSession.create({
          data: {
            userId,
            title: 'Support Assistant',
            sessionType: 'support',
            userRole: 'sales', // Default, will be overwritten
            status: 'active',
          },
        });
      }

      // Create the AI message
      const aiMessage = await prisma.aIChatMessage.create({
        data: {
          sessionId: session.id,
          role: 'assistant',
          content: formattedMessage,
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

      // Record the intervention
      const intervention = await prisma.aIIntervention.create({
        data: {
          ticketId,
          userId,
          interventionType: 'proactive_message',
          messageToUser: formattedMessage,
          messageDelivered: true,
          aiAgentRole: 'support_ai',
          aiSessionId: session.id,
          stepsProvided: analysis.steps,
        },
      });

      // Emit event for real-time notification
      aiInterventionEvents.emit('message:sent', {
        userId,
        sessionId: session.id,
        messageId: aiMessage.id,
        interventionId: intervention.id,
        ticketId,
      });

      logger.info(`Intervention message sent to user ${userId} for ticket ${ticketId}`);

    } catch (error) {
      logger.error('Failed to send intervention message:', error);
    }
  }

  /**
   * Format intervention message for display
   */
  private formatInterventionMessage(message: InterventionMessage): string {
    let formatted = `${message.greeting}\n\n`;
    formatted += `${message.problemIdentification}\n\n`;
    formatted += `**What's happening:** ${message.diagnosis}\n\n`;
    
    if (message.steps.length > 0) {
      formatted += `**Here's what you can try:**\n`;
      message.steps.forEach((step, index) => {
        formatted += `${index + 1}. ${step}\n`;
      });
      formatted += '\n';
    }
    
    formatted += message.conclusion;
    
    return formatted;
  }

  /**
   * Schedule escalation for a ticket
   */
  private async scheduleEscalation(ticketId: string, reason?: string): Promise<void> {
    const config = await prisma.errorMonitoringConfig.findFirst({
      where: { accountId: null },
    });

    const delayMs = (config?.escalationDelay || 900) * 1000; // Default 15 min

    setTimeout(async () => {
      // Check if ticket is still unresolved
      const ticket = await prisma.errorTicket.findUnique({
        where: { id: ticketId },
      });

      if (ticket && ticket.status === 'INTERVENING') {
        await this.escalateToAdmin(ticketId, reason || 'Escalation timeout');
      }
    }, delayMs);

    logger.info(`Escalation scheduled for ticket ${ticketId} in ${delayMs / 1000}s`);
  }

  /**
   * Escalate ticket to admin
   */
  async escalateToAdmin(ticketId: string, reason: string): Promise<void> {
    try {
      const ticket = await prisma.errorTicket.findUnique({
        where: { id: ticketId },
        include: {
          interventions: true,
        },
      });

      if (!ticket) return;

      // Find available admin
      const adminUser = await prisma.accountUser.findFirst({
        where: {
          accountId: ticket.accountId || undefined,
          role: { in: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNT_OWNER'] },
        },
        include: {
          user: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      await prisma.errorTicket.update({
        where: { id: ticketId },
        data: {
          status: 'ESCALATED',
          escalatedTo: adminUser?.userId,
          escalatedAt: new Date(),
          escalationReason: reason,
          alertColor: 'red',
        },
      });

      // Notify admin
      if (adminUser) {
        await prisma.notification.create({
          data: {
            userId: adminUser.userId,
            type: 'error_escalation',
            title: `Error Escalated: ${ticket.ticketNumber}`,
            message: `A user error ticket has been escalated: ${ticket.title}\nReason: ${reason}`,
            metadata: {
              ticketId,
              ticketNumber: ticket.ticketNumber,
              severity: ticket.severity,
            },
          },
        });
      }

      logger.warn(`Ticket ${ticket.ticketNumber} escalated to admin. Reason: ${reason}`);

      aiInterventionEvents.emit('ticket:escalated', {
        ticketId,
        ticketNumber: ticket.ticketNumber,
        adminUserId: adminUser?.userId,
        reason,
      });

    } catch (error) {
      logger.error('Failed to escalate ticket:', error);
    }
  }

  /**
   * Update error pattern with new knowledge
   */
  private async updatePatternKnowledge(patternId: string, analysis: AIAnalysisResult): Promise<void> {
    try {
      await prisma.errorPattern.update({
        where: { id: patternId },
        data: {
          rootCause: analysis.rootCause,
          solution: analysis.solution,
          preventionTips: analysis.steps.join('\n'),
          lastUpdated: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to update pattern knowledge:', error);
    }
  }

  /**
   * Record user feedback on intervention
   */
  async recordFeedback(
    interventionId: string,
    feedback: {
      wasHelpful: boolean;
      userFeedback?: string;
      stepsCompleted?: number;
    }
  ): Promise<void> {
    await prisma.aIIntervention.update({
      where: { id: interventionId },
      data: {
        wasHelpful: feedback.wasHelpful,
        userFeedback: feedback.userFeedback,
        stepsCompleted: feedback.stepsCompleted,
        resolved: feedback.wasHelpful === true,
      },
    });

    // If helpful, mark ticket as resolved by AI
    const intervention = await prisma.aIIntervention.findUnique({
      where: { id: interventionId },
      include: { ticket: true },
    });

    if (intervention && feedback.wasHelpful) {
      await prisma.errorTicket.update({
        where: { id: intervention.ticketId },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          resolutionMethod: 'ai_auto',
          totalResolutionMs: Date.now() - intervention.ticket.detectedAt.getTime(),
        },
      });

      // Update pattern statistics
      const pattern = await prisma.errorPattern.findUnique({
        where: { patternHash: intervention.ticket.errorPattern },
      });

      if (pattern) {
        await prisma.errorPattern.update({
          where: { id: pattern.id },
          data: {
            resolvedCount: pattern.resolvedCount + 1,
          },
        });
      }
    }
  }

  /**
   * Generate Root AI summary of all interventions
   */
  async generateRootAISummary(summaryId: string): Promise<string> {
    const summary = await prisma.aIInterventionSummary.findUnique({
      where: { id: summaryId },
    });

    if (!summary) {
      throw new Error('Summary not found');
    }

    const prompt = `As the Root AI administrator, analyze and re-summarize this error intervention report:

## Original Agent Summary
${summary.agentSummary}

## Metrics
- Total Errors: ${summary.totalErrors}
- Total Tickets: ${summary.totalTickets}
- Interventions: ${summary.totalInterventions}
- Resolved: ${summary.resolvedCount}
- Escalated: ${summary.escalatedCount}
- Critical: ${summary.criticalCount}
- Errors: ${summary.errorCount}

Provide a comprehensive executive summary with:
1. Key findings
2. System health assessment
3. Patterns and trends
4. Recommended improvements
5. Priority action items`;

    try {
      let rootSummary = '';

      if (anthropic) {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          system: AI_AGENT_ROLES.root_ai.systemPrompt,
          messages: [
            { role: 'user', content: prompt },
          ],
        });

        const content = response.content[0];
        if (content.type === 'text') {
          rootSummary = content.text;
        }
      } else if (openai) {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: AI_AGENT_ROLES.root_ai.systemPrompt },
            { role: 'user', content: prompt },
          ],
        });

        rootSummary = response.choices[0]?.message?.content || '';
      } else {
        rootSummary = `## Root AI Summary\n\n${summary.agentSummary}\n\nNote: AI analysis unavailable. Manual review recommended.`;
      }

      // Update the summary
      await prisma.aIInterventionSummary.update({
        where: { id: summaryId },
        data: { rootAISummary: rootSummary },
      });

      return rootSummary;

    } catch (error) {
      logger.error('Failed to generate Root AI summary:', error);
      throw error;
    }
  }

  /**
   * Get intervention statistics
   */
  async getInterventionStats(accountId?: string): Promise<any> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const whereClause = accountId
      ? { ticket: { accountId } }
      : {};

    const [
      totalInterventions,
      successfulInterventions,
      avgResponseTime,
      byType,
    ] = await Promise.all([
      prisma.aIIntervention.count({
        where: {
          ...whereClause,
          createdAt: { gte: twentyFourHoursAgo },
        },
      }),
      prisma.aIIntervention.count({
        where: {
          ...whereClause,
          createdAt: { gte: twentyFourHoursAgo },
          wasHelpful: true,
        },
      }),
      prisma.errorTicket.aggregate({
        where: {
          ...(accountId ? { accountId } : {}),
          analysisToInterventionMs: { not: null },
          createdAt: { gte: twentyFourHoursAgo },
        },
        _avg: {
          analysisToInterventionMs: true,
        },
      }),
      prisma.aIIntervention.groupBy({
        by: ['interventionType'],
        where: {
          ...whereClause,
          createdAt: { gte: twentyFourHoursAgo },
        },
        _count: { id: true },
      }),
    ]);

    return {
      total: totalInterventions,
      successful: successfulInterventions,
      successRate: totalInterventions > 0
        ? (successfulInterventions / totalInterventions * 100).toFixed(1)
        : 0,
      avgResponseTimeMs: avgResponseTime._avg?.analysisToInterventionMs || 0,
      byType: byType.reduce((acc: any, item) => {
        acc[item.interventionType] = item._count.id;
        return acc;
      }, {}),
    };
  }
}

// Singleton instance
export const aiInterventionService = new AIInterventionService();
