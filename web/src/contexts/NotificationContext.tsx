/**
 * NotificationContext - Real-time AI Notification System
 * 
 * Provides:
 * - SSE connection to receive AI intervention messages
 * - Toast notifications when AI has a message
 * - Navigation to AI chat when user clicks notification
 * - Unread notification counter
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useToast } from './ToastContext';
import { useAuth } from './AuthContext';

interface AINotification {
  id: string;
  type: 'ai_intervention' | 'ticket_escalated' | 'system';
  sessionId?: string;
  messageId?: string;
  ticketId?: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

interface NotificationContextType {
  notifications: AINotification[];
  unreadCount: number;
  isConnected: boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const toast = useToast();
  const [notifications, setNotifications] = useState<AINotification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Handle incoming notification
  const handleNotification = useCallback((data: { type: string; data?: { sessionId?: string; messageId?: string; ticketId?: string; message?: string; priority?: string } }) => {
    const notification: AINotification = {
      id: data.data?.messageId || data.data?.ticketId || Date.now().toString(),
      type: data.type as AINotification['type'],
      sessionId: data.data?.sessionId,
      messageId: data.data?.messageId,
      ticketId: data.data?.ticketId,
      message: data.data?.message || 'You have a new notification',
      timestamp: new Date(),
      read: false,
    };

    setNotifications(prev => [notification, ...prev].slice(0, 50)); // Keep last 50

    // Show toast notification
    if (data.type === 'ai_intervention') {
      toast.info(
        '🤖 Nova has a message for you',
        notification.message + ' - Click the AI Chat to see it.'
      );
      // Also navigate to AI chat if they're not there
      setTimeout(() => {
        if (window.location.pathname !== '/ai-chat') {
          // Don't auto-navigate, just show the toast
          // User can click on the AI chat icon
        }
      }, 0);
    } else if (data.type === 'ticket_escalated') {
      toast.warning(
        'Support Ticket Escalated',
        notification.message
      );
    }
  }, [toast]);

  // Connect to SSE stream
  useEffect(() => {
    if (!user || !isAuthenticated) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const connect = () => {
      try {
        // Get token from localStorage
        const token = localStorage.getItem('accessToken');
        if (!token) {
          console.warn('No access token for notification stream');
          return;
        }

        const apiBase = import.meta.env.VITE_API_URL || '';
        const url = `${apiBase}/api/ai/notifications/stream?token=${encodeURIComponent(token)}`;
        
        eventSourceRef.current = new EventSource(url);

        eventSourceRef.current.onopen = () => {
          setIsConnected(true);
          console.log('🔔 Notification stream connected');
        };

        eventSourceRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'connected') {
              console.log('🔔 Notification stream authenticated');
              return;
            }
            
            if (data.type === 'heartbeat') {
              return; // Ignore heartbeats
            }

            // Handle actual notifications
            if (data.type === 'ai_intervention' || data.type === 'ticket_escalated') {
              handleNotification(data);
            }
          } catch (e) {
            console.error('Failed to parse notification:', e);
          }
        };

        eventSourceRef.current.onerror = (error) => {
          console.error('EventSource error:', error);
          setIsConnected(false);
          eventSourceRef.current?.close();
          eventSourceRef.current = null;
          
          // Reconnect after 5 seconds with fresh token
          if (!reconnectTimeoutRef.current) {
            reconnectTimeoutRef.current = setTimeout(async () => {
              reconnectTimeoutRef.current = null;
              
              // Try to refresh token before reconnecting
              try {
                const refreshToken = localStorage.getItem('refreshToken');
                if (refreshToken) {
                  const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken }),
                  });
                  
                  if (response.ok) {
                    const data = await response.json();
                    if (data.accessToken) {
                      localStorage.setItem('accessToken', data.accessToken);
                      console.log('🔄 Token refreshed before SSE reconnect');
                    }
                  }
                }
              } catch (err) {
                console.error('Token refresh error before SSE reconnect:', err);
              }
              
              connect();
            }, 5000);
          }
        };

      } catch (error) {
        console.error('Failed to connect to notification stream:', error);
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [user, isAuthenticated, handleNotification]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isConnected,
        markAsRead,
        markAllAsRead,
        clearNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
