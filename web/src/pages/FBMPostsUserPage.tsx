/**
 * FBM Posts Page - User/Admin Dashboard
 * 
 * Tracking and debugging for Facebook Marketplace posts within user's account
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Eye,
  RotateCcw,
  Zap,
  Bot,
  Laptop,
  Filter,
  TrendingUp,
  Loader2,
  X,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';
import api from '../lib/api';

interface FBMStats {
  total: number;
  succeeded: number;
  failed: number;
  pending: number;
  successRate: number;
  byStatus: Record<string, number>;
  byMethod: Record<string, number>;
  byRisk: Record<string, number>;
  recentFails: any[];
}

interface FBMLog {
  id: string;
  vehicleId: string;
  method: string;
  triggerType: string;
  status: string;
  stage: string;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  attemptNumber: number;
  retryCount: number;
  riskLevel: string;
  duration?: number;
  initiatedAt: string;
  completedAt?: string;
  createdAt: string;
  vehicle: {
    id: string;
    year: number;
    make: string;
    model: string;
    vin: string;
    stockNumber?: string;
    imageUrls?: string[];
  };
  events?: any[];
  _count?: {
    events: number;
    retryLogs: number;
  };
}

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  initiated: { color: 'bg-gray-100 text-gray-800', icon: Clock, label: 'Initiated' },
  queued: { color: 'bg-blue-100 text-blue-800', icon: Clock, label: 'Queued' },
  processing: { color: 'bg-yellow-100 text-yellow-800', icon: Loader2, label: 'Processing' },
  posting: { color: 'bg-purple-100 text-purple-800', icon: Activity, label: 'Posting' },
  verifying: { color: 'bg-indigo-100 text-indigo-800', icon: Eye, label: 'Verifying' },
  completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Completed' },
  failed: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Failed' },
  cancelled: { color: 'bg-gray-100 text-gray-500', icon: X, label: 'Cancelled' },
};

const methodConfig: Record<string, { color: string; icon: any; label: string }> = {
  iai: { color: 'bg-blue-100 text-blue-800', icon: Laptop, label: 'IAI (Extension)' },
  soldier: { color: 'bg-purple-100 text-purple-800', icon: Bot, label: 'Soldier (Worker)' },
  hybrid: { color: 'bg-orange-100 text-orange-800', icon: Zap, label: 'Hybrid' },
};

export default function FBMPostsUserPage() {
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState('24h');
  const [selectedLog, setSelectedLog] = useState<FBMLog | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    method: '',
  });

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['fbm-posts-stats', timeRange],
    queryFn: async () => {
      const response = await api.get(`/api/fbm-posts/stats?timeRange=${timeRange}`);
      return response.data.data as FBMStats;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch logs
  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['fbm-posts-logs', timeRange, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        timeRange,
        limit: '50',
        ...(filters.status && { status: filters.status }),
        ...(filters.method && { method: filters.method }),
      });
      const response = await api.get(`/api/fbm-posts/logs?${params}`);
      return response.data.data;
    },
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: async (logId: string) => {
      const response = await api.post(`/api/fbm-posts/logs/${logId}/retry`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fbm-posts-logs'] });
      queryClient.invalidateQueries({ queryKey: ['fbm-posts-stats'] });
    },
  });

  const stats = statsData || { total: 0, succeeded: 0, failed: 0, pending: 0, successRate: 0, byStatus: {}, byMethod: {}, byRisk: {}, recentFails: [] };
  const logs = logsData?.logs || [];

  const handleViewDetail = (log: FBMLog) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const handleRetry = (logId: string) => {
    retryMutation.mutate(logId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">FBM Post History</h1>
          <p className="text-gray-500">Track your Facebook Marketplace posting activity</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button
            onClick={() => refetchLogs()}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Posts</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Successful</p>
              <p className="text-2xl font-bold text-green-600">{stats.succeeded}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Failed</p>
              <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Success Rate</p>
              <p className="text-2xl font-bold text-purple-600">{stats.successRate.toFixed(1)}%</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Failures Alert */}
      {stats.recentFails && stats.recentFails.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-800">Recent Failures ({stats.recentFails.length})</h3>
              <ul className="mt-2 space-y-1 text-sm text-red-700">
                {stats.recentFails.slice(0, 3).map((fail: any) => (
                  <li key={fail.id} className="flex items-center gap-2">
                    <span>• {fail.vehicle?.year} {fail.vehicle?.make} {fail.vehicle?.model}</span>
                    <span className="text-red-500">- {fail.errorMessage || 'Unknown error'}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Statuses</option>
            {Object.entries(statusConfig).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          <select
            value={filters.method}
            onChange={(e) => setFilters({ ...filters, method: e.target.value })}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Methods</option>
            {Object.entries(methodConfig).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {logsLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Activity className="w-12 h-12 mb-3 text-gray-300" />
            <p>No posts found</p>
            <p className="text-sm">Try a post from the Inventory page!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stage</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log: FBMLog) => {
                  const statusCfg = statusConfig[log.status] || statusConfig.initiated;
                  const methodCfg = methodConfig[log.method] || methodConfig.iai;
                  const StatusIcon = statusCfg.icon;
                  const MethodIcon = methodCfg.icon;

                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {log.vehicle?.imageUrls?.[0] ? (
                            <img
                              src={log.vehicle.imageUrls[0]}
                              alt=""
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                              <Activity className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900">
                              {log.vehicle?.year} {log.vehicle?.make} {log.vehicle?.model}
                            </p>
                            <p className="text-xs text-gray-500">
                              {log.vehicle?.stockNumber || log.vehicle?.vin?.slice(-6)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium', methodCfg.color)}>
                          <MethodIcon className="w-3 h-3" />
                          {methodCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium', statusCfg.color)}>
                          <StatusIcon className={cn('w-3 h-3', log.status === 'processing' && 'animate-spin')} />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {log.stage}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewDetail(log)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {log.status === 'failed' && (
                            <button
                              onClick={() => handleRetry(log.id)}
                              disabled={retryMutation.isPending}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                              title="Retry"
                            >
                              <RotateCcw className={cn('w-4 h-4', retryMutation.isPending && 'animate-spin')} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedLog && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowDetailModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Post Details</h2>
                <button onClick={() => setShowDetailModal(false)} className="p-2 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {/* Vehicle Info */}
                <div className="flex items-start gap-4">
                  {selectedLog.vehicle?.imageUrls?.[0] && (
                    <img
                      src={selectedLog.vehicle.imageUrls[0]}
                      alt=""
                      className="w-20 h-20 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {selectedLog.vehicle?.year} {selectedLog.vehicle?.make} {selectedLog.vehicle?.model}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Stock: {selectedLog.vehicle?.stockNumber} | VIN: {selectedLog.vehicle?.vin}
                    </p>
                  </div>
                </div>

                {/* Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Status</p>
                    <p className="font-medium">{selectedLog.status}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Stage</p>
                    <p className="font-medium">{selectedLog.stage}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Method</p>
                    <p className="font-medium">{selectedLog.method}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Trigger</p>
                    <p className="font-medium">{selectedLog.triggerType}</p>
                  </div>
                </div>

                {/* Error if any */}
                {selectedLog.errorMessage && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-red-800">Error: {selectedLog.errorCode || 'Unknown'}</p>
                        <p className="text-sm text-red-700 mt-1">{selectedLog.errorMessage}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Timestamps */}
                <div className="text-sm text-gray-500 space-y-1">
                  <p>Created: {format(new Date(selectedLog.createdAt), 'PPpp')}</p>
                  {selectedLog.completedAt && (
                    <p>Completed: {format(new Date(selectedLog.completedAt), 'PPpp')}</p>
                  )}
                  {selectedLog.duration && (
                    <p>Duration: {selectedLog.duration}s</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
