/**
 * Error Monitoring Dashboard - Nova Super Admin
 * 
 * Comprehensive error detection, AI intervention, and ticketing system
 * Features:
 * - Real-time error scanning (3-minute cycles)
 * - Color-coded ticket alerts (green/yellow/orange/red/purple)
 * - AI intervention tracking
 * - Error pattern analysis
 * - Summary reports and diagnostics
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Activity, 
  TrendingUp, 
  Clock,
  User,
  Bot,
  RefreshCw,
  Eye,
  Check,
  Bell,
  Zap,
  FileText,
  BarChart3,
  Settings,
  ArrowUpRight,
  Circle,
  Timer,
  Hash,
  Filter,
  Sparkles
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface ErrorStats {
  last24h: number;
  lastWeek: number;
  lastMonth: number;
  total: number;
  bySeverity: Record<string, number>;
  bySource: Record<string, number>;
  byAlertColor: Record<string, number>;
  avgResolutionTime: number;
  patterns: {
    mostCommon: string[];
    recurring: number;
  };
}

interface InterventionStats {
  total: number;
  last24h: number;
  successRate: number;
  avgResponseTime: number;
  byOutcome: Record<string, number>;
  pendingEscalations: number;
}

interface ErrorTicket {
  id: string;
  ticketNumber: string;
  userId: string;
  accountId: string | null;
  title: string;
  description: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL' | 'FATAL';
  status: 'DETECTED' | 'ANALYZING' | 'INTERVENING' | 'RESOLVED' | 'ESCALATED' | 'CLOSED';
  alertColor: string;
  errorCount: number;
  errorType: string;
  firstOccurrence: string;
  lastOccurrence: string;
  detectionToInterventionMs: number | null;
  aiAnalysis: string | null;
  suggestedSolution: string | null;
  rootCause: string | null;
  userNotified: boolean;
  escalatedTo: string | null;
  escalationReason: string | null;
  resolutionMethod: string | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  interventions?: AIIntervention[];
  _count?: {
    errorLogs: number;
    interventions: number;
  };
}

interface AIIntervention {
  id: string;
  ticketId: string;
  chatSessionId: string | null;
  messageId: string | null;
  aiModel: string;
  promptUsed: string;
  analysis: string;
  suggestion: string | null;
  userMessage: string | null;
  userResponse: string | null;
  wasHelpful: boolean | null;
  userFeedback: string | null;
  responseTimeMs: number | null;
  escalatedToAdmin: boolean;
  escalationReason: string | null;
  stepsCompleted: string[];
  createdAt: string;
}

interface ErrorPattern {
  id: string;
  errorType: string;
  errorCode: string | null;
  pattern: string;
  severity: string;
  totalOccurrences: number;
  rootCause: string | null;
  solution: string | null;
  preventionTips: string | null;
  isVerified: boolean;
  lastUpdated: string;
}

interface MonitoringConfig {
  id: string;
  scanIntervalMs: number;
  enabled: boolean;
  autoInterventionEnabled: boolean;
  interventionDelayMs: number;
  errorThresholdWarning: number;
  errorThresholdCritical: number;
  severitySensitivity: Record<string, number>;
  alertColorConfig: Record<string, { threshold: number; color: string }>;
}

interface Summary {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalErrors: number;
  totalTickets: number;
  totalInterventions: number;
  resolutionRate: number;
  avgResponseTime: number;
  topErrorTypes: Record<string, number>;
  topAffectedUsers: string[];
  aiSummary: string;
  rootAISummary: string | null;
  recommendations: string[];
  createdAt: string;
}

// ============================================
// Tab Components
// ============================================

type TabType = 'overview' | 'tickets' | 'interventions' | 'patterns' | 'config' | 'summaries';

const ErrorMonitoringPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedTicket, setSelectedTicket] = useState<ErrorTicket | null>(null);
  const [ticketFilters, setTicketFilters] = useState<{
    status?: string[];
    severity?: string[];
    alertColor?: string[];
  }>({});
  const [isRealTimeConnected, setIsRealTimeConnected] = useState(false);

  // ============================================
  // Data Fetching
  // ============================================

  const { data: stats } = useQuery({
    queryKey: ['error-monitoring-stats'],
    queryFn: async () => {
      const response = await api.get('/error-monitoring/stats');
      return response.data.data as { errors: ErrorStats; interventions: InterventionStats };
    },
    refetchInterval: 30000,
  });

  const { data: ticketsData, isLoading: ticketsLoading } = useQuery({
    queryKey: ['error-tickets', ticketFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (ticketFilters.status?.length) params.append('status', ticketFilters.status.join(','));
      if (ticketFilters.severity?.length) params.append('severity', ticketFilters.severity.join(','));
      if (ticketFilters.alertColor?.length) params.append('alertColor', ticketFilters.alertColor.join(','));
      const response = await api.get(`/error-monitoring/tickets?${params.toString()}`);
      return response.data.data as { tickets: ErrorTicket[]; total: number };
    },
    refetchInterval: 30000,
  });

  const { data: interventions } = useQuery({
    queryKey: ['interventions'],
    queryFn: async () => {
      const response = await api.get('/error-monitoring/interventions?limit=50');
      return response.data.data.interventions as AIIntervention[];
    },
    refetchInterval: 60000,
  });

  const { data: patterns } = useQuery({
    queryKey: ['error-patterns'],
    queryFn: async () => {
      const response = await api.get('/error-monitoring/patterns');
      return response.data.data.patterns as ErrorPattern[];
    },
    refetchInterval: 120000,
  });

  const { data: config } = useQuery({
    queryKey: ['monitoring-config'],
    queryFn: async () => {
      const response = await api.get('/error-monitoring/config');
      return response.data.data as MonitoringConfig;
    },
  });

  const { data: summaries } = useQuery({
    queryKey: ['intervention-summaries'],
    queryFn: async () => {
      const response = await api.get('/error-monitoring/summaries');
      return response.data.data.summaries as Summary[];
    },
    refetchInterval: 300000,
  });

  // ============================================
  // Real-Time Event Stream
  // ============================================

  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/error-monitoring/stream', {
          withCredentials: true,
        });

        eventSource.onopen = () => {
          setIsRealTimeConnected(true);
        };

        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'error':
            case 'ticket':
              queryClient.invalidateQueries({ queryKey: ['error-monitoring-stats'] });
              queryClient.invalidateQueries({ queryKey: ['error-tickets'] });
              break;
            case 'intervention':
              queryClient.invalidateQueries({ queryKey: ['interventions'] });
              break;
            case 'scan':
              queryClient.invalidateQueries({ queryKey: ['error-monitoring-stats'] });
              queryClient.invalidateQueries({ queryKey: ['error-tickets'] });
              break;
          }
        };

        eventSource.onerror = () => {
          setIsRealTimeConnected(false);
          eventSource?.close();
          setTimeout(connectSSE, 5000);
        };
      } catch {
        setIsRealTimeConnected(false);
      }
    };

    connectSSE();

    return () => {
      eventSource?.close();
    };
  }, [queryClient]);

  // ============================================
  // Mutations
  // ============================================

  const updateTicketMutation = useMutation({
    mutationFn: async ({ ticketId, status, ...data }: { ticketId: string; status: string; [key: string]: unknown }) => {
      return api.put(`/error-monitoring/tickets/${ticketId}/status`, { status, ...data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['error-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['error-monitoring-stats'] });
      setSelectedTicket(null);
    },
  });

  const triggerInterventionMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      return api.post(`/error-monitoring/tickets/${ticketId}/intervene`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['error-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
    },
  });

  const escalateMutation = useMutation({
    mutationFn: async ({ ticketId, reason }: { ticketId: string; reason: string }) => {
      return api.post(`/error-monitoring/tickets/${ticketId}/escalate`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['error-tickets'] });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (configData: Partial<MonitoringConfig>) => {
      return api.put('/error-monitoring/config', configData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-config'] });
    },
  });

  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      return api.post('/error-monitoring/summaries/generate');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intervention-summaries'] });
    },
  });

  // ============================================
  // Helpers
  // ============================================

  const getAlertColorClass = (color: string) => {
    const colors: Record<string, string> = {
      green: 'bg-green-500',
      yellow: 'bg-yellow-500',
      orange: 'bg-orange-500',
      red: 'bg-red-500',
      purple: 'bg-purple-500',
    };
    return colors[color] || 'bg-gray-500';
  };

  const getAlertColorBorder = (color: string) => {
    const colors: Record<string, string> = {
      green: 'border-green-500',
      yellow: 'border-yellow-500',
      orange: 'border-orange-500',
      red: 'border-red-500',
      purple: 'border-purple-500',
    };
    return colors[color] || 'border-gray-500';
  };

  const getSeverityBadge = (severity: string) => {
    const badges: Record<string, string> = {
      INFO: 'bg-blue-100 text-blue-800',
      WARNING: 'bg-yellow-100 text-yellow-800',
      ERROR: 'bg-red-100 text-red-800',
      CRITICAL: 'bg-red-200 text-red-900',
      FATAL: 'bg-purple-200 text-purple-900',
    };
    return badges[severity] || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; icon: React.ReactNode }> = {
      DETECTED: { bg: 'bg-blue-100 text-blue-800', icon: <Circle className="w-3 h-3" /> },
      ANALYZING: { bg: 'bg-yellow-100 text-yellow-800', icon: <Activity className="w-3 h-3 animate-pulse" /> },
      INTERVENING: { bg: 'bg-indigo-100 text-indigo-800', icon: <Bot className="w-3 h-3" /> },
      RESOLVED: { bg: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
      ESCALATED: { bg: 'bg-orange-100 text-orange-800', icon: <ArrowUpRight className="w-3 h-3" /> },
      CLOSED: { bg: 'bg-gray-100 text-gray-800', icon: <XCircle className="w-3 h-3" /> },
    };
    return badges[status] || { bg: 'bg-gray-100 text-gray-800', icon: null };
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  };

  const formatTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // ============================================
  // Render Functions
  // ============================================

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Real-time Connection Status */}
      <div className={`flex items-center gap-2 text-sm ${isRealTimeConnected ? 'text-green-600' : 'text-yellow-600'}`}>
        <div className={`w-2 h-2 rounded-full ${isRealTimeConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
        {isRealTimeConnected ? 'Real-time updates connected' : 'Connecting to real-time updates...'}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Errors (24h)</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.errors.last24h || 0}</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">AI Interventions (24h)</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.interventions.last24h || 0}</p>
            </div>
            <Bot className="w-10 h-10 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Success Rate</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.interventions.successRate ? `${(stats.interventions.successRate * 100).toFixed(0)}%` : 'N/A'}
              </p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Avg Response Time</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.interventions.avgResponseTime ? formatDuration(stats.interventions.avgResponseTime) : 'N/A'}
              </p>
            </div>
            <Timer className="w-10 h-10 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Alert Color Distribution */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 text-indigo-600" />
          Alert Distribution (Color Coded)
        </h3>
        <div className="flex items-center gap-4 flex-wrap">
          {['green', 'yellow', 'orange', 'red', 'purple'].map((color) => (
            <div key={color} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full ${getAlertColorClass(color)}`} />
              <span className="text-gray-600 capitalize">{color}:</span>
              <span className="font-semibold">{stats?.errors.byAlertColor?.[color] || 0}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex h-4 rounded-full overflow-hidden bg-gray-100">
          {['green', 'yellow', 'orange', 'red', 'purple'].map((color) => {
            const count = stats?.errors.byAlertColor?.[color] || 0;
            const total = Object.values(stats?.errors.byAlertColor || {}).reduce((a, b) => a + b, 0) || 1;
            const percentage = (count / total) * 100;
            return (
              <div
                key={color}
                className={getAlertColorClass(color)}
                style={{ width: `${percentage}%` }}
              />
            );
          })}
        </div>
      </div>

      {/* Recent Critical Tickets */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Critical & Fatal Tickets
          </h3>
          <button
            onClick={() => {
              setTicketFilters({ severity: ['CRITICAL', 'FATAL'] });
              setActiveTab('tickets');
            }}
            className="text-indigo-600 hover:text-indigo-800 text-sm"
          >
            View all →
          </button>
        </div>
        <div className="space-y-2">
          {ticketsData?.tickets
            .filter(t => ['CRITICAL', 'FATAL'].includes(t.severity))
            .slice(0, 5)
            .map(ticket => (
              <div 
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-50 border-l-4 ${getAlertColorBorder(ticket.alertColor)}`}
              >
                <div className={`w-3 h-3 rounded-full ${getAlertColorClass(ticket.alertColor)}`} />
                <span className="text-gray-500 text-sm">{ticket.ticketNumber}</span>
                <span className="flex-1 truncate font-medium">{ticket.title}</span>
                <span className={`px-2 py-0.5 text-xs rounded ${getSeverityBadge(ticket.severity)}`}>
                  {ticket.severity}
                </span>
                <span className="text-gray-400 text-sm">{formatTimeAgo(ticket.createdAt)}</span>
              </div>
            ))}
          {!ticketsData?.tickets.some(t => ['CRITICAL', 'FATAL'].includes(t.severity)) && (
            <div className="text-center text-gray-500 py-4">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
              No critical or fatal tickets
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderTickets = () => (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">Filters:</span>
          </div>
          
          <select
            value={ticketFilters.severity?.join(',') || ''}
            onChange={(e) => setTicketFilters(prev => ({
              ...prev,
              severity: e.target.value ? e.target.value.split(',') : undefined
            }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Severities</option>
            <option value="FATAL,CRITICAL">Critical & Fatal</option>
            <option value="ERROR">Error</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Info</option>
          </select>

          <select
            value={ticketFilters.status?.join(',') || ''}
            onChange={(e) => setTicketFilters(prev => ({
              ...prev,
              status: e.target.value ? e.target.value.split(',') : undefined
            }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="DETECTED,ANALYZING,INTERVENING">Active</option>
            <option value="RESOLVED">Resolved</option>
            <option value="ESCALATED">Escalated</option>
            <option value="CLOSED">Closed</option>
          </select>

          <div className="flex items-center gap-2">
            {['green', 'yellow', 'orange', 'red', 'purple'].map((color) => (
              <button
                key={color}
                onClick={() => setTicketFilters(prev => ({
                  ...prev,
                  alertColor: prev.alertColor?.includes(color)
                    ? prev.alertColor.filter(c => c !== color)
                    : [...(prev.alertColor || []), color]
                }))}
                className={`w-6 h-6 rounded-full ${getAlertColorClass(color)} ${
                  ticketFilters.alertColor?.includes(color) ? 'ring-2 ring-offset-2 ring-gray-400' : 'opacity-50'
                }`}
                title={`Filter by ${color}`}
              />
            ))}
          </div>

          {(ticketFilters.severity || ticketFilters.status || ticketFilters.alertColor) && (
            <button
              onClick={() => setTicketFilters({})}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Tickets List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {ticketsLoading ? (
          <div className="p-8 text-center text-gray-500">Loading tickets...</div>
        ) : ticketsData?.tickets && ticketsData.tickets.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {ticketsData.tickets.map((ticket) => {
              const statusBadge = getStatusBadge(ticket.status);
              return (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={`p-4 hover:bg-gray-50 cursor-pointer border-l-4 ${getAlertColorBorder(ticket.alertColor)}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-4 h-4 mt-1 rounded-full ${getAlertColorClass(ticket.alertColor)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-gray-500 text-sm font-mono">{ticket.ticketNumber}</span>
                        <span className={`px-2 py-0.5 text-xs rounded ${getSeverityBadge(ticket.severity)}`}>
                          {ticket.severity}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded flex items-center gap-1 ${statusBadge.bg}`}>
                          {statusBadge.icon}
                          {ticket.status}
                        </span>
                      </div>
                      <h4 className="font-medium text-gray-900 truncate">{ticket.title}</h4>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          {ticket.errorCount} errors
                        </span>
                        {ticket.user && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {ticket.user.firstName} {ticket.user.lastName}
                          </span>
                        )}
                        {ticket.detectionToInterventionMs && (
                          <span className="flex items-center gap-1">
                            <Timer className="w-3 h-3" />
                            {formatDuration(ticket.detectionToInterventionMs)}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(ticket.lastOccurrence)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {ticket._count && ticket._count.interventions > 0 && (
                        <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                          <Bot className="w-3 h-3" />
                          {ticket._count.interventions}
                        </span>
                      )}
                      <Eye className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            No tickets found matching your filters
          </div>
        )}
      </div>
    </div>
  );

  const renderInterventions = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-600" />
            AI Intervention History
          </h3>
        </div>
        {interventions && interventions.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {interventions.map((intervention) => (
              <div key={intervention.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-gray-500">{intervention.aiModel}</span>
                      {intervention.wasHelpful !== null && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          intervention.wasHelpful ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {intervention.wasHelpful ? 'Helpful' : 'Not helpful'}
                        </span>
                      )}
                      {intervention.escalatedToAdmin && (
                        <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700 flex items-center gap-1">
                          <ArrowUpRight className="w-3 h-3" />
                          Escalated
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 text-sm line-clamp-2">{intervention.analysis}</p>
                    {intervention.suggestion && (
                      <p className="text-gray-500 text-sm mt-1 line-clamp-2">
                        <span className="font-medium">Suggestion:</span> {intervention.suggestion}
                      </p>
                    )}
                    {intervention.userFeedback && (
                      <p className="text-indigo-600 text-sm mt-1">
                        <span className="font-medium">User feedback:</span> {intervention.userFeedback}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      {intervention.responseTimeMs && (
                        <span>Response: {formatDuration(intervention.responseTimeMs)}</span>
                      )}
                      <span>{formatTimeAgo(intervention.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            No AI interventions recorded yet
          </div>
        )}
      </div>
    </div>
  );

  const renderPatterns = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            Error Patterns & Knowledge Base
          </h3>
        </div>
        {patterns && patterns.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {patterns.map((pattern) => (
              <div key={pattern.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-gray-900">{pattern.errorType}</span>
                      {pattern.errorCode && (
                        <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">{pattern.errorCode}</code>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded ${getSeverityBadge(pattern.severity)}`}>
                        {pattern.severity}
                      </span>
                      {pattern.isVerified && (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Verified
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 font-mono mb-2">{pattern.pattern}</p>
                    {pattern.rootCause && (
                      <p className="text-sm text-gray-700 mb-1">
                        <span className="font-medium">Root Cause:</span> {pattern.rootCause}
                      </p>
                    )}
                    {pattern.solution && (
                      <p className="text-sm text-green-700 mb-1">
                        <span className="font-medium">Solution:</span> {pattern.solution}
                      </p>
                    )}
                    {pattern.preventionTips && (
                      <p className="text-sm text-blue-700">
                        <span className="font-medium">Prevention:</span> {pattern.preventionTips}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">{pattern.totalOccurrences}</div>
                    <div className="text-xs text-gray-500">occurrences</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            No error patterns detected yet
          </div>
        )}
      </div>
    </div>
  );

  const renderConfig = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-600" />
          Monitoring Configuration
        </h3>
        {config ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scan Interval</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.scanIntervalMs / 1000}
                    onChange={(e) => updateConfigMutation.mutate({ scanIntervalMs: parseInt(e.target.value) * 1000 })}
                    className="border border-gray-300 rounded-lg px-3 py-2 w-24"
                  />
                  <span className="text-gray-500">seconds</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Intervention Delay</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.interventionDelayMs / 1000}
                    onChange={(e) => updateConfigMutation.mutate({ interventionDelayMs: parseInt(e.target.value) * 1000 })}
                    className="border border-gray-300 rounded-lg px-3 py-2 w-24"
                  />
                  <span className="text-gray-500">seconds</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between py-3 border-t border-gray-200">
              <div>
                <h4 className="font-medium text-gray-900">Error Monitoring</h4>
                <p className="text-sm text-gray-500">Enable automatic error scanning</p>
              </div>
              <button
                onClick={() => updateConfigMutation.mutate({ enabled: !config.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config.enabled ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.enabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between py-3 border-t border-gray-200">
              <div>
                <h4 className="font-medium text-gray-900">Auto AI Intervention</h4>
                <p className="text-sm text-gray-500">Automatically send AI help messages to users</p>
              </div>
              <button
                onClick={() => updateConfigMutation.mutate({ autoInterventionEnabled: !config.autoInterventionEnabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config.autoInterventionEnabled ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.autoInterventionEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-3">Error Thresholds</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Warning Threshold</label>
                  <input
                    type="number"
                    value={config.errorThresholdWarning}
                    onChange={(e) => updateConfigMutation.mutate({ errorThresholdWarning: parseInt(e.target.value) })}
                    className="border border-gray-300 rounded-lg px-3 py-2 w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Critical Threshold</label>
                  <input
                    type="number"
                    value={config.errorThresholdCritical}
                    onChange={(e) => updateConfigMutation.mutate({ errorThresholdCritical: parseInt(e.target.value) })}
                    className="border border-gray-300 rounded-lg px-3 py-2 w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-4">Loading configuration...</div>
        )}
      </div>
    </div>
  );

  const renderSummaries = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Intervention Summaries</h3>
        <button
          onClick={() => generateSummaryMutation.mutate()}
          disabled={generateSummaryMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          {generateSummaryMutation.isPending ? 'Generating...' : 'Generate Summary'}
        </button>
      </div>

      {summaries && summaries.length > 0 ? (
        <div className="space-y-4">
          {summaries.map((summary) => (
            <div key={summary.id} className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-medium text-gray-900">
                    {new Date(summary.periodStart).toLocaleDateString()} - {new Date(summary.periodEnd).toLocaleDateString()}
                  </h4>
                  <p className="text-sm text-gray-500">Generated {formatTimeAgo(summary.createdAt)}</p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-600">{summary.totalErrors} errors</span>
                  <span className="text-gray-600">{summary.totalTickets} tickets</span>
                  <span className="text-gray-600">{summary.totalInterventions} interventions</span>
                  <span className="text-green-600">{(summary.resolutionRate * 100).toFixed(0)}% resolved</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h5 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Bot className="w-4 h-4" />
                    AI Summary
                  </h5>
                  <p className="text-gray-600 text-sm bg-gray-50 p-3 rounded-lg">{summary.aiSummary}</p>
                </div>

                {summary.rootAISummary && (
                  <div>
                    <h5 className="font-medium text-purple-700 mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Root AI Analysis
                    </h5>
                    <p className="text-gray-600 text-sm bg-purple-50 p-3 rounded-lg">{summary.rootAISummary}</p>
                  </div>
                )}

                {summary.recommendations && summary.recommendations.length > 0 && (
                  <div>
                    <h5 className="font-medium text-gray-700 mb-2">Recommendations</h5>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      {summary.recommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          No summaries generated yet. Click "Generate Summary" to create one.
        </div>
      )}
    </div>
  );

  // ============================================
  // Main Render
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Activity className="w-8 h-8 text-indigo-600" />
              Error Monitoring & AI Intervention
            </h1>
            <p className="text-gray-600 mt-1">
              Real-time error detection with automatic AI assistance
            </p>
          </div>
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['error-monitoring-stats'] });
              queryClient.invalidateQueries({ queryKey: ['error-tickets'] });
              queryClient.invalidateQueries({ queryKey: ['interventions'] });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm mb-6">
        <div className="flex border-b border-gray-200">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'tickets', label: 'Tickets', icon: AlertTriangle },
            { id: 'interventions', label: 'AI Interventions', icon: Bot },
            { id: 'patterns', label: 'Patterns', icon: TrendingUp },
            { id: 'config', label: 'Configuration', icon: Settings },
            { id: 'summaries', label: 'Summaries', icon: FileText },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'tickets' && renderTickets()}
      {activeTab === 'interventions' && renderInterventions()}
      {activeTab === 'patterns' && renderPatterns()}
      {activeTab === 'config' && renderConfig()}
      {activeTab === 'summaries' && renderSummaries()}

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full ${getAlertColorClass(selectedTicket.alertColor)}`} />
                  <span className="text-gray-500 font-mono">{selectedTicket.ticketNumber}</span>
                  <span className={`px-2 py-0.5 text-xs rounded ${getSeverityBadge(selectedTicket.severity)}`}>
                    {selectedTicket.severity}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mt-2">{selectedTicket.title}</h3>
            </div>

            <div className="p-6 space-y-6">
              {/* Status & Timing */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-500">Status</p>
                  <div className={`mt-1 flex items-center gap-1 ${getStatusBadge(selectedTicket.status).bg} px-2 py-1 rounded w-fit`}>
                    {getStatusBadge(selectedTicket.status).icon}
                    {selectedTicket.status}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-500">Error Count</p>
                  <p className="text-xl font-bold text-gray-900">{selectedTicket.errorCount}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-500">Detection → Intervention</p>
                  <p className="text-xl font-bold text-gray-900">
                    {selectedTicket.detectionToInterventionMs 
                      ? formatDuration(selectedTicket.detectionToInterventionMs)
                      : 'Pending'}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">{selectedTicket.description}</p>
              </div>

              {/* AI Analysis */}
              {selectedTicket.aiAnalysis && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-purple-600" />
                    AI Analysis
                  </h4>
                  <p className="text-gray-600 bg-purple-50 p-3 rounded-lg">{selectedTicket.aiAnalysis}</p>
                </div>
              )}

              {/* Suggested Solution */}
              {selectedTicket.suggestedSolution && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-green-600" />
                    Suggested Solution
                  </h4>
                  <p className="text-gray-600 bg-green-50 p-3 rounded-lg">{selectedTicket.suggestedSolution}</p>
                </div>
              )}

              {/* Root Cause */}
              {selectedTicket.rootCause && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Root Cause</h4>
                  <p className="text-gray-600 bg-yellow-50 p-3 rounded-lg">{selectedTicket.rootCause}</p>
                </div>
              )}

              {/* User Info */}
              {selectedTicket.user && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Affected User
                  </h4>
                  <p className="text-gray-600">
                    {selectedTicket.user.firstName} {selectedTicket.user.lastName}
                    <span className="text-gray-400 ml-2">({selectedTicket.user.email})</span>
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    {selectedTicket.userNotified ? '✓ User notified' : '○ User not notified'}
                  </p>
                </div>
              )}

              {/* Resolution */}
              {selectedTicket.resolvedAt && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-2">Resolution</h4>
                  <p className="text-green-700">{selectedTicket.resolutionMethod}</p>
                  {selectedTicket.resolutionNotes && (
                    <p className="text-green-600 text-sm mt-2">{selectedTicket.resolutionNotes}</p>
                  )}
                  <p className="text-green-500 text-sm mt-2">
                    Resolved at {new Date(selectedTicket.resolvedAt).toLocaleString()}
                  </p>
                </div>
              )}

              {/* Escalation */}
              {selectedTicket.escalatedTo && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h4 className="font-medium text-orange-900 mb-2 flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4" />
                    Escalated
                  </h4>
                  <p className="text-orange-700">To: {selectedTicket.escalatedTo}</p>
                  {selectedTicket.escalationReason && (
                    <p className="text-orange-600 text-sm mt-1">Reason: {selectedTicket.escalationReason}</p>
                  )}
                </div>
              )}

              {/* Interventions */}
              {selectedTicket.interventions && selectedTicket.interventions.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Intervention History</h4>
                  <div className="space-y-2">
                    {selectedTicket.interventions.map((intervention) => (
                      <div key={intervention.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                          <Bot className="w-3 h-3" />
                          <span>{intervention.aiModel}</span>
                          <span>•</span>
                          <span>{formatTimeAgo(intervention.createdAt)}</span>
                          {intervention.wasHelpful !== null && (
                            <span className={intervention.wasHelpful ? 'text-green-600' : 'text-red-600'}>
                              {intervention.wasHelpful ? '✓ Helpful' : '✗ Not helpful'}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-700 text-sm">{intervention.analysis}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-gray-200 flex justify-between">
              <div className="flex gap-2">
                {!['RESOLVED', 'CLOSED'].includes(selectedTicket.status) && (
                  <>
                    <button
                      onClick={() => triggerInterventionMutation.mutate(selectedTicket.id)}
                      disabled={triggerInterventionMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      <Bot className="w-4 h-4" />
                      Trigger AI Intervention
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt('Escalation reason:');
                        if (reason) {
                          escalateMutation.mutate({ ticketId: selectedTicket.id, reason });
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      Escalate
                    </button>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                {!['RESOLVED', 'CLOSED'].includes(selectedTicket.status) && (
                  <button
                    onClick={() => {
                      const notes = prompt('Resolution notes:');
                      if (notes) {
                        updateTicketMutation.mutate({
                          ticketId: selectedTicket.id,
                          status: 'RESOLVED',
                          resolutionMethod: 'MANUAL',
                          resolutionNotes: notes,
                        });
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark Resolved
                  </button>
                )}
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ErrorMonitoringPage;
