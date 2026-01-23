/**
 * Nova Monitoring Service (Frontend)
 * 
 * Provides access to:
 * - Admin notifications stream
 * - Active alerts
 * - Chat history with context
 * - Conversation memory
 * - Health status
 */

import { api } from '../lib/api';

interface AdminNotification {
  id: string;
  type: 'error_alert' | 'system_alert' | 'intervention_alert' | 'escalation' | 'daily_summary';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

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
  createdAt: string;
  isRead: boolean;
  isResolved: boolean;
}

interface ChatSessionWithMessages {
  id: string;
  title: string;
  sessionType: string;
  status: string;
  lastMessageAt: string;
  messageCount: number;
  messages: any[];
  _count?: { messages: number };
}

interface ConversationMemory {
  sessionId: string;
  userId: string;
  context: string[];
  lastInteraction: string;
  errorHistory: string[];
  resolvedIssues: string[];
}

interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  metrics: {
    totalErrors24h: number;
    criticalTickets: number;
    unprocessedErrors: number;
    recentInterventions: number;
    activeAlerts: number;
  };
  timestamp: string;
}

class NovaMonitoringService {
  private eventSource: EventSource | null = null;
  private notificationListeners: ((notification: AdminNotification) => void)[] = [];
  private healthListeners: ((health: any) => void)[] = [];

  /**
   * Connect to the admin notification stream
   */
  connectToNotificationStream(token: string): void {
    if (this.eventSource) {
      this.eventSource.close();
    }

    const url = `/api/nova/notifications/stream?token=${encodeURIComponent(token)}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'notification') {
          this.notificationListeners.forEach(listener => listener(data.notification));
        } else if (data.type === 'health') {
          this.healthListeners.forEach(listener => listener(data.data));
        } else if (data.type === 'connected') {
          // Process existing notifications on connect
          data.notifications?.forEach((notification: AdminNotification) => {
            if (!notification.isRead) {
              this.notificationListeners.forEach(listener => listener(notification));
            }
          });
        }
      } catch (error) {
        console.error('Failed to parse Nova notification:', error);
      }
    };

    this.eventSource.onerror = () => {
      console.error('Nova notification stream error');
      // Reconnect after 5 seconds
      setTimeout(() => {
        if (this.eventSource?.readyState === EventSource.CLOSED) {
          this.connectToNotificationStream(token);
        }
      }, 5000);
    };
  }

  /**
   * Disconnect from notification stream
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /**
   * Add notification listener
   */
  onNotification(callback: (notification: AdminNotification) => void): () => void {
    this.notificationListeners.push(callback);
    return () => {
      const index = this.notificationListeners.indexOf(callback);
      if (index > -1) {
        this.notificationListeners.splice(index, 1);
      }
    };
  }

  /**
   * Add health check listener
   */
  onHealthCheck(callback: (health: any) => void): () => void {
    this.healthListeners.push(callback);
    return () => {
      const index = this.healthListeners.indexOf(callback);
      if (index > -1) {
        this.healthListeners.splice(index, 1);
      }
    };
  }

  /**
   * Get all notifications
   */
  async getNotifications(): Promise<{ notifications: AdminNotification[]; unreadCount: number }> {
    const response = await api.get('/api/nova/notifications');
    return response.data.data;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await api.put(`/api/nova/notifications/${notificationId}/read`);
  }

  /**
   * Get active alerts
   */
  async getAlerts(): Promise<{ alerts: ErrorAlert[]; total: number; criticalCount: number }> {
    const response = await api.get('/api/nova/alerts');
    return response.data.data;
  }

  /**
   * Trigger error analysis
   */
  async analyzeErrors(): Promise<{ totalErrors: number; criticalCount: number; summary: string }> {
    const response = await api.post('/api/nova/alerts/analyze');
    return response.data.data;
  }

  /**
   * Get admin chat history
   */
  async getAdminHistory(limit = 20): Promise<{ sessions: ChatSessionWithMessages[]; total: number }> {
    const response = await api.get(`/api/nova/history?limit=${limit}`);
    return response.data.data;
  }

  /**
   * Get full session history with context
   */
  async getSessionHistory(sessionId: string, limit = 50): Promise<{
    messages: any[];
    context: ConversationMemory | null;
    relatedErrors: any[];
  }> {
    const response = await api.get(`/api/nova/history/${sessionId}?limit=${limit}`);
    return response.data.data;
  }

  /**
   * Get user sessions
   */
  async getUserSessions(userId: string, options?: { type?: string; status?: string }): Promise<{
    sessions: ChatSessionWithMessages[];
    total: number;
  }> {
    const params = new URLSearchParams();
    if (options?.type) params.set('type', options.type);
    if (options?.status) params.set('status', options.status);
    
    const response = await api.get(`/api/nova/history/user/${userId}/sessions?${params.toString()}`);
    return response.data.data;
  }

  /**
   * Get conversation memory for a user
   */
  async getConversationMemory(userId: string): Promise<{
    currentMemory: ConversationMemory | null;
    persistedMemories: any[];
  }> {
    const response = await api.get(`/api/nova/memory/${userId}`);
    return response.data.data;
  }

  /**
   * Store conversation context
   */
  async storeContext(sessionId: string, context: string): Promise<void> {
    await api.post('/api/nova/memory', { sessionId, context });
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const response = await api.get('/api/nova/health');
    return response.data.data;
  }
}

export const novaMonitoringService = new NovaMonitoringService();
export type { AdminNotification, ErrorAlert, ChatSessionWithMessages, ConversationMemory, HealthStatus };
