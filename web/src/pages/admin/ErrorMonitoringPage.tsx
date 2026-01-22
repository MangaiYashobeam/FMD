/**
 * Error Monitoring Dashboard - Nova Super Admin
 * 
 * Provides real-time error detection, diagnostics, and alerting
 * for system-wide monitoring. Designed for Nova AI oversight.
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Activity, 
  TrendingUp, 
  Clock,
  User,
  Globe,
  Puzzle,
  Server,
  RefreshCw,
  Eye,
  Check,
  MessageSquare
} from 'lucide-react';

interface ErrorStats {
  summary: {
    last24h: number;
    lastWeek: number;
    lastMonth: number;
    total: number;
  };
  bySeverity: {
    high: number;
    medium: number;
    low: number;
  };
  bySource: Record<string, number>;
  topErrors: Array<{ message: string; count: number }>;
  healthStatus: 'healthy' | 'warning' | 'critical';
  alertThreshold: {
    critical: number;
    warning: number;
    current: number;
  };
}

interface SystemError {
  id: string;
  type: string;
  source: string;
  accountId: string;
  severity: 'high' | 'medium' | 'low';
  error: string;
  context: {
    url?: string;
    stackTrace?: string;
    userAgent?: string;
  };
  userStruggle?: {
    failedAttempts: number;
    samePageTime: number;
  };
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  timestamp: string;
  isResolved: boolean;
  resolution?: string;
}

interface ExtensionPattern {
  count: number;
  suggestions: string[];
}

const ErrorMonitoringPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedError, setSelectedError] = useState<SystemError | null>(null);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolution, setResolution] = useState('');
  const [preventionPlan, setPreventionPlan] = useState('');
  const [filter, setFilter] = useState<{
    severity?: string;
    source?: string;
    timeRange?: string;
  }>({});

  // Fetch error statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['error-stats'],
    queryFn: async () => {
      const response = await api.get('/admin/errors/stats');
      return response.data.data as ErrorStats;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch system errors
  const { data: errors, isLoading: errorsLoading } = useQuery({
    queryKey: ['system-errors', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter.severity) params.append('severity', filter.severity);
      if (filter.source) params.append('source', filter.source);
      const response = await api.get(`/admin/errors?${params.toString()}`);
      return response.data.data.errors as SystemError[];
    },
    refetchInterval: 30000,
  });

  // Fetch extension errors with patterns
  const { data: extensionData, isLoading: extensionLoading } = useQuery({
    queryKey: ['extension-errors'],
    queryFn: async () => {
      const response = await api.get('/admin/errors/extension');
      return response.data.data as {
        errors: SystemError[];
        patterns: Record<string, ExtensionPattern>;
      };
    },
    refetchInterval: 60000,
  });

  // Resolve error mutation
  const resolveMutation = useMutation({
    mutationFn: async ({ errorId, resolution, preventionPlan }: { 
      errorId: string; 
      resolution: string; 
      preventionPlan?: string;
    }) => {
      return api.post(`/admin/errors/${errorId}/resolve`, { resolution, preventionPlan });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-errors'] });
      queryClient.invalidateQueries({ queryKey: ['error-stats'] });
      setResolveModalOpen(false);
      setSelectedError(null);
      setResolution('');
      setPreventionPlan('');
    },
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'critical': return 'from-red-500 to-red-600';
      case 'warning': return 'from-yellow-500 to-yellow-600';
      case 'healthy': return 'from-green-500 to-green-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Activity className="w-8 h-8 text-indigo-600" />
              Nova Error Monitoring
            </h1>
            <p className="text-gray-600 mt-1">
              Real-time system diagnostics and error detection
            </p>
          </div>
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['error-stats'] });
              queryClient.invalidateQueries({ queryKey: ['system-errors'] });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Health Status Banner */}
      {stats && (
        <div className={`mb-8 p-6 rounded-2xl bg-gradient-to-r ${getHealthColor(stats.healthStatus)} text-white shadow-lg`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {stats.healthStatus === 'healthy' ? (
                <CheckCircle className="w-12 h-12" />
              ) : stats.healthStatus === 'warning' ? (
                <AlertTriangle className="w-12 h-12" />
              ) : (
                <XCircle className="w-12 h-12" />
              )}
              <div>
                <h2 className="text-2xl font-bold capitalize">{stats.healthStatus} Status</h2>
                <p className="opacity-90">
                  {stats.summary.last24h} errors in last 24 hours 
                  {stats.healthStatus !== 'healthy' && ` (threshold: ${stats.alertThreshold.warning})`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold">{stats.summary.last24h}</div>
              <div className="text-sm opacity-80">24h errors</div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Last 24 Hours</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.summary.last24h || 0}</p>
            </div>
            <Clock className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">This Week</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.summary.lastWeek || 0}</p>
            </div>
            <TrendingUp className="w-10 h-10 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">High Severity</p>
              <p className="text-3xl font-bold text-red-600">{stats?.bySeverity.high || 0}</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Extension Errors</p>
              <p className="text-3xl font-bold text-purple-600">
                {stats?.bySource?.extension || 0}
              </p>
            </div>
            <Puzzle className="w-10 h-10 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Extension Patterns */}
      {extensionData?.patterns && Object.keys(extensionData.patterns).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Puzzle className="w-5 h-5 text-indigo-600" />
            Extension Error Patterns Detected
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(extensionData.patterns).map(([key, pattern]) => (
              <div key={key} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900 capitalize">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="bg-red-100 text-red-700 text-sm px-2 py-1 rounded-full">
                    {pattern.count} issues
                  </span>
                </div>
                <ul className="text-sm text-gray-600 space-y-1">
                  {pattern.suggestions.slice(0, 2).map((suggestion, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-indigo-500">→</span>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Errors */}
      {stats?.topErrors && stats.topErrors.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Error Messages (24h)</h3>
          <div className="space-y-3">
            {stats.topErrors.map((err, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700 truncate flex-1 mr-4">{err.message}</span>
                <span className="bg-gray-200 text-gray-800 text-sm px-3 py-1 rounded-full font-medium">
                  {err.count}x
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <select
            value={filter.severity || ''}
            onChange={(e) => setFilter({ ...filter, severity: e.target.value || undefined })}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Severities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={filter.source || ''}
            onChange={(e) => setFilter({ ...filter, source: e.target.value || undefined })}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Sources</option>
            <option value="extension">Extension</option>
            <option value="api">API</option>
            <option value="system">System</option>
          </select>
        </div>
      </div>

      {/* Error List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Errors</h3>
        </div>
        
        {errorsLoading ? (
          <div className="p-8 text-center text-gray-500">Loading errors...</div>
        ) : errors && errors.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {errors.map((error) => (
              <div
                key={error.id}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  error.isResolved ? 'opacity-60' : ''
                }`}
                onClick={() => setSelectedError(error)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getSeverityColor(error.severity)}`}>
                        {error.severity}
                      </span>
                      <span className="text-gray-500 text-sm">
                        {error.source || 'unknown'}
                      </span>
                      <span className="text-gray-400 text-sm">
                        {formatTimeAgo(error.timestamp)}
                      </span>
                      {error.isResolved && (
                        <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Resolved
                        </span>
                      )}
                    </div>
                    <p className="text-gray-900 font-medium truncate">{error.error}</p>
                    {error.user && (
                      <p className="text-gray-500 text-sm flex items-center gap-1 mt-1">
                        <User className="w-3 h-3" />
                        {error.user.firstName} {error.user.lastName} ({error.user.email})
                      </p>
                    )}
                    {error.context?.url && (
                      <p className="text-gray-400 text-xs flex items-center gap-1 mt-1">
                        <Globe className="w-3 h-3" />
                        {error.context.url}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedError(error);
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {!error.isResolved && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedError(error);
                          setResolveModalOpen(true);
                        }}
                        className="p-2 text-green-500 hover:text-green-700"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            No errors found! System is running smoothly.
          </div>
        )}
      </div>

      {/* Error Detail Modal */}
      {selectedError && !resolveModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Error Details</h3>
                <button
                  onClick={() => setSelectedError(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Error Message</label>
                <p className="text-gray-900 mt-1">{selectedError.error}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Severity</label>
                  <p className={`mt-1 inline-block px-2 py-0.5 rounded-full text-sm ${getSeverityColor(selectedError.severity)}`}>
                    {selectedError.severity}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Source</label>
                  <p className="text-gray-900 mt-1">{selectedError.source}</p>
                </div>
              </div>

              {selectedError.context?.url && (
                <div>
                  <label className="text-sm font-medium text-gray-500">URL</label>
                  <p className="text-gray-900 mt-1 break-all">{selectedError.context.url}</p>
                </div>
              )}

              {selectedError.user && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Affected User</label>
                  <p className="text-gray-900 mt-1">
                    {selectedError.user.firstName} {selectedError.user.lastName} 
                    <span className="text-gray-500 ml-2">({selectedError.user.email})</span>
                  </p>
                </div>
              )}

              {selectedError.userStruggle && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="text-yellow-800 font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    User Struggle Detected
                  </h4>
                  <p className="text-yellow-700 text-sm">
                    {selectedError.userStruggle.failedAttempts} failed attempts, 
                    spent {Math.round(selectedError.userStruggle.samePageTime / 1000)}s on page
                  </p>
                </div>
              )}

              {selectedError.context?.stackTrace && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Stack Trace</label>
                  <pre className="mt-1 bg-gray-100 p-4 rounded-lg text-xs overflow-x-auto text-gray-700">
                    {selectedError.context.stackTrace}
                  </pre>
                </div>
              )}

              {selectedError.isResolved && selectedError.resolution && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="text-green-800 font-medium mb-2">Resolution</h4>
                  <p className="text-green-700">{selectedError.resolution}</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              {!selectedError.isResolved && (
                <button
                  onClick={() => setResolveModalOpen(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Mark as Resolved
                </button>
              )}
              <button
                onClick={() => setSelectedError(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {resolveModalOpen && selectedError && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Resolve Error</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Resolution Notes
                </label>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  placeholder="Describe how this error was resolved..."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Prevention Plan (Optional)
                </label>
                <textarea
                  value={preventionPlan}
                  onChange={(e) => setPreventionPlan(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  placeholder="Steps to prevent this from happening again..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setResolveModalOpen(false);
                  setResolution('');
                  setPreventionPlan('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  resolveMutation.mutate({
                    errorId: selectedError.id,
                    resolution,
                    preventionPlan,
                  });
                }}
                disabled={!resolution || resolveMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {resolveMutation.isPending ? 'Saving...' : 'Mark Resolved'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ErrorMonitoringPage;
