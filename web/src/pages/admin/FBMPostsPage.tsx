/**
 * FBM Posts Page - Super Admin Dashboard
 * 
 * Comprehensive tracking and debugging for all Facebook Marketplace posts
 * across all accounts, users, and methods.
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
  Building2,
  User,
  Zap,
  Bot,
  Laptop,
  Filter,
  Search,
  TrendingUp,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  X,
  AlertCircle,
  Info,
  Bug,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import api from '../../lib/api';

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
  accountId: string;
  vehicleId: string;
  userId: string;
  method: string;
  triggerType: string;
  status: string;
  stage: string;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  errorDetails?: any;
  vehicleData?: any;
  requestData?: any;
  responseData?: any;
  stageHistory?: any[];
  attemptNumber: number;
  retryCount: number;
  riskLevel: string;
  riskFactors?: any[];
  duration?: number;
  initiatedAt: string;
  queuedAt?: string;
  processingAt?: string;
  completedAt?: string;
  createdAt: string;
  extensionTaskId?: string;
  facebookPostId?: string;
  fbPostId?: string;
  vehicle: {
    id: string;
    year: number;
    make: string;
    model: string;
    vin: string;
    stockNumber?: string;
    imageUrls?: string[];
  };
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  account: {
    id: string;
    name: string;
    dealershipName?: string;
  };
  extensionTask?: any;
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

const riskConfig: Record<string, { color: string; label: string }> = {
  low: { color: 'bg-green-100 text-green-800', label: 'Low' },
  medium: { color: 'bg-yellow-100 text-yellow-800', label: 'Medium' },
  high: { color: 'bg-orange-100 text-orange-800', label: 'High' },
  critical: { color: 'bg-red-100 text-red-800', label: 'Critical' },
};

const triggerConfig: Record<string, string> = {
  manual: 'Manual',
  auto_post: 'Auto Post',
  scheduled: 'Scheduled',
  retry: 'Retry',
};

export default function FBMPostsPage() {
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState('24h');
  const [selectedLog, setSelectedLog] = useState<FBMLog | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    method: '',
    triggerType: '',
    riskLevel: '',
    accountId: '',
    search: '',
  });
  const [page, setPage] = useState(1);

  // Fetch stats
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<FBMStats>({
    queryKey: ['fbm-admin-stats', timeRange],
    queryFn: async () => {
      const response = await api.get(`/fbm-posts/admin/stats?timeRange=${timeRange}`);
      return response.data.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch logs
  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['fbm-admin-logs', timeRange, page, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        timeRange,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)),
      });
      const response = await api.get(`/fbm-posts/admin/logs?${params}`);
      return response.data.data;
    },
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Fetch accounts
  const { data: accounts } = useQuery({
    queryKey: ['fbm-admin-accounts', timeRange],
    queryFn: async () => {
      const response = await api.get(`/fbm-posts/admin/accounts?timeRange=${timeRange}`);
      return response.data.data;
    },
  });

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: async ({ logId, method }: { logId: string; method?: string }) => {
      return api.post(`/fbm-posts/admin/logs/${logId}/retry`, { method });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fbm-admin-logs'] });
      queryClient.invalidateQueries({ queryKey: ['fbm-admin-stats'] });
    },
  });

  // Fetch log detail
  const fetchLogDetail = async (logId: string) => {
    const response = await api.get(`/fbm-posts/admin/logs/${logId}`);
    setSelectedLog(response.data.data);
    setShowDetailModal(true);
  };

  const logs = logsData?.logs || [];
  const pagination = logsData?.pagination || { page: 1, pages: 1, total: 0 };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Activity className="w-7 h-7 text-blue-600" />
              FBM Posts Monitor
            </h1>
            <p className="text-gray-500 mt-1">
              Track and debug Facebook Marketplace posts across all accounts
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 border rounded-lg bg-white text-sm"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
            <button
              onClick={() => {
                refetchStats();
                refetchLogs();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          title="Total Posts"
          value={stats?.total || 0}
          icon={BarChart3}
          color="blue"
          loading={statsLoading}
        />
        <StatCard
          title="Succeeded"
          value={stats?.succeeded || 0}
          icon={CheckCircle}
          color="green"
          loading={statsLoading}
          trend={stats?.successRate ? `${stats.successRate}%` : undefined}
          trendUp={true}
        />
        <StatCard
          title="Failed"
          value={stats?.failed || 0}
          icon={XCircle}
          color="red"
          loading={statsLoading}
        />
        <StatCard
          title="Pending"
          value={stats?.pending || 0}
          icon={Clock}
          color="yellow"
          loading={statsLoading}
        />
        <StatCard
          title="Success Rate"
          value={`${stats?.successRate || 0}%`}
          icon={TrendingUp}
          color="indigo"
          loading={statsLoading}
        />
      </div>

      {/* Method & Risk Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* By Method */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-600" />
            By Method
          </h3>
          <div className="space-y-2">
            {Object.entries(stats?.byMethod || {}).map(([method, count]) => {
              const config = methodConfig[method] || { color: 'bg-gray-100 text-gray-800', label: method, icon: Activity };
              const Icon = config.icon;
              return (
                <div key={method} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn('px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1', config.color)}>
                      <Icon className="w-3 h-3" />
                      {config.label}
                    </span>
                  </div>
                  <span className="font-semibold">{count as number}</span>
                </div>
              );
            })}
            {!stats?.byMethod || Object.keys(stats.byMethod).length === 0 && (
              <p className="text-gray-400 text-sm">No data</p>
            )}
          </div>
        </div>

        {/* By Risk Level */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            By Risk Level
          </h3>
          <div className="space-y-2">
            {Object.entries(stats?.byRisk || {}).map(([risk, count]) => {
              const config = riskConfig[risk] || { color: 'bg-gray-100 text-gray-800', label: risk };
              return (
                <div key={risk} className="flex items-center justify-between">
                  <span className={cn('px-2 py-1 rounded-full text-xs font-medium', config.color)}>
                    {config.label}
                  </span>
                  <span className="font-semibold">{count as number}</span>
                </div>
              );
            })}
            {!stats?.byRisk || Object.keys(stats.byRisk).length === 0 && (
              <p className="text-gray-400 text-sm">No data</p>
            )}
          </div>
        </div>

        {/* Top Accounts */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-600" />
            Active Accounts
          </h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {accounts?.slice(0, 5).map((acc: any) => (
              <div key={acc.id} className="flex items-center justify-between text-sm">
                <span className="truncate max-w-[150px]">{acc.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">{acc.succeeded}</span>
                  <span className="text-gray-300">/</span>
                  <span className="text-red-600">{acc.failed}</span>
                </div>
              </div>
            ))}
            {!accounts || accounts.length === 0 && (
              <p className="text-gray-400 text-sm">No active accounts</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Failures Alert */}
      {stats?.recentFails && stats.recentFails.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Recent Failures ({stats.recentFails.length})
          </h3>
          <div className="space-y-2">
            {stats.recentFails.slice(0, 3).map((fail: any) => (
              <div
                key={fail.id}
                className="flex items-center justify-between bg-white rounded-lg p-3 cursor-pointer hover:bg-red-50"
                onClick={() => fetchLogDetail(fail.id)}
              >
                <div className="flex items-center gap-3">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <div>
                    <p className="font-medium text-sm">
                      {fail.vehicle?.year} {fail.vehicle?.make} {fail.vehicle?.model}
                    </p>
                    <p className="text-xs text-gray-500 truncate max-w-[300px]">
                      {fail.errorMessage || 'Unknown error'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{fail.account?.name}</p>
                  <p className="text-xs text-gray-400">{formatDistanceToNow(new Date(fail.createdAt))} ago</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-1.5 border rounded-lg text-sm bg-white"
          >
            <option value="">All Status</option>
            <option value="initiated">Initiated</option>
            <option value="queued">Queued</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>

          <select
            value={filters.method}
            onChange={(e) => setFilters({ ...filters, method: e.target.value })}
            className="px-3 py-1.5 border rounded-lg text-sm bg-white"
          >
            <option value="">All Methods</option>
            <option value="iai">IAI (Extension)</option>
            <option value="soldier">Soldier (Worker)</option>
            <option value="hybrid">Hybrid</option>
          </select>

          <select
            value={filters.triggerType}
            onChange={(e) => setFilters({ ...filters, triggerType: e.target.value })}
            className="px-3 py-1.5 border rounded-lg text-sm bg-white"
          >
            <option value="">All Triggers</option>
            <option value="manual">Manual</option>
            <option value="auto_post">Auto Post</option>
            <option value="scheduled">Scheduled</option>
            <option value="retry">Retry</option>
          </select>

          <select
            value={filters.riskLevel}
            onChange={(e) => setFilters({ ...filters, riskLevel: e.target.value })}
            className="px-3 py-1.5 border rounded-lg text-sm bg-white"
          >
            <option value="">All Risk</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search VIN, make, model..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-9 pr-4 py-1.5 border rounded-lg text-sm"
            />
          </div>

          {Object.values(filters).some(v => v) && (
            <button
              onClick={() => setFilters({ status: '', method: '', triggerType: '', riskLevel: '', accountId: '', search: '' })}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Vehicle</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Account</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Method</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Trigger</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Risk</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logsLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No FBM posts found for the selected filters
                  </td>
                </tr>
              ) : (
                logs.map((log: FBMLog) => {
                  const statusCfg = statusConfig[log.status] || statusConfig.initiated;
                  const methodCfg = methodConfig[log.method] || methodConfig.iai;
                  const riskCfg = riskConfig[log.riskLevel] || riskConfig.low;
                  const StatusIcon = statusCfg.icon;
                  const MethodIcon = methodCfg.icon;

                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium', statusCfg.color)}>
                          <StatusIcon className={cn('w-3 h-3', log.status === 'processing' && 'animate-spin')} />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-sm">
                            {log.vehicle?.year} {log.vehicle?.make} {log.vehicle?.model}
                          </p>
                          <p className="text-xs text-gray-500">{log.vehicle?.vin?.slice(-8)}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm truncate max-w-[150px]">{log.account?.name || log.account?.dealershipName}</p>
                          <p className="text-xs text-gray-500 truncate max-w-[150px]">{log.user?.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium', methodCfg.color)}>
                          <MethodIcon className="w-3 h-3" />
                          {methodCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600">
                          {triggerConfig[log.triggerType] || log.triggerType}
                          {log.attemptNumber > 1 && (
                            <span className="ml-1 text-orange-600">(#{log.attemptNumber})</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-1 rounded-full text-xs font-medium', riskCfg.color)}>
                          {riskCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-600">
                          {formatDistanceToNow(new Date(log.createdAt))} ago
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-600">
                          {log.duration ? `${log.duration}s` : '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => fetchLogDetail(log.id)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {log.status === 'failed' && (
                            <button
                              onClick={() => retryMutation.mutate({ logId: log.id })}
                              disabled={retryMutation.isPending}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50"
                              title="Retry"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {((page - 1) * 50) + 1} to {Math.min(page * 50, pagination.total)} of {pagination.total} results
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {pagination.pages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedLog && (
        <FBMLogDetailModal
          log={selectedLog}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedLog(null);
          }}
          onRetry={(method) => {
            retryMutation.mutate({ logId: selectedLog.id, method });
          }}
        />
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({
  title,
  value,
  icon: Icon,
  color,
  loading,
  trend,
  trendUp,
}: {
  title: string;
  value: number | string;
  icon: any;
  color: string;
  loading?: boolean;
  trend?: string;
  trendUp?: boolean;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">{title}</span>
        <div className={cn('p-2 rounded-lg', colorClasses[color])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      {loading ? (
        <div className="h-8 bg-gray-100 rounded animate-pulse" />
      ) : (
        <div className="flex items-end justify-between">
          <span className="text-2xl font-bold text-gray-900">{value}</span>
          {trend && (
            <span className={cn('text-sm flex items-center', trendUp ? 'text-green-600' : 'text-red-600')}>
              {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {trend}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Detail Modal Component
function FBMLogDetailModal({
  log,
  onClose,
  onRetry,
}: {
  log: FBMLog;
  onClose: () => void;
  onRetry: (method?: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'data' | 'debug'>('overview');
  const statusCfg = statusConfig[log.status] || statusConfig.initiated;
  const methodCfg = methodConfig[log.method] || methodConfig.iai;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-4">
              <span className={cn('inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium', statusCfg.color)}>
                <StatusIcon className={cn('w-4 h-4', log.status === 'processing' && 'animate-spin')} />
                {statusCfg.label}
              </span>
              <div>
                <h2 className="font-semibold text-gray-900">
                  {log.vehicle?.year} {log.vehicle?.make} {log.vehicle?.model}
                </h2>
                <p className="text-sm text-gray-500">VIN: {log.vehicle?.vin}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="px-6 border-b">
            <div className="flex gap-4">
              {(['overview', 'timeline', 'data', 'debug'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                    activeTab === tab
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  )}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Error Alert */}
                {log.status === 'failed' && log.errorMessage && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-800">
                          {log.errorCode || 'Error'}
                        </p>
                        <p className="text-sm text-red-600 mt-1">{log.errorMessage}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <InfoCard title="Method" icon={Zap}>
                    <span className={cn('px-2 py-1 rounded-full text-xs font-medium', methodCfg.color)}>
                      {methodCfg.label}
                    </span>
                  </InfoCard>
                  <InfoCard title="Trigger" icon={Activity}>
                    {triggerConfig[log.triggerType] || log.triggerType}
                    {log.attemptNumber > 1 && (
                      <span className="ml-2 text-orange-600">(Attempt #{log.attemptNumber})</span>
                    )}
                  </InfoCard>
                  <InfoCard title="Account" icon={Building2}>
                    {log.account?.name || log.account?.dealershipName}
                  </InfoCard>
                  <InfoCard title="User" icon={User}>
                    {log.user?.firstName} {log.user?.lastName} ({log.user?.email})
                  </InfoCard>
                  <InfoCard title="Duration" icon={Clock}>
                    {log.duration ? `${log.duration} seconds` : 'In progress...'}
                  </InfoCard>
                  <InfoCard title="Risk Level" icon={AlertTriangle}>
                    <span className={cn('px-2 py-1 rounded-full text-xs font-medium', riskConfig[log.riskLevel]?.color)}>
                      {riskConfig[log.riskLevel]?.label || log.riskLevel}
                    </span>
                  </InfoCard>
                </div>

                {/* Risk Factors */}
                {log.riskFactors && (log.riskFactors as any[]).length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <h4 className="font-medium text-orange-800 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Risk Factors
                    </h4>
                    <ul className="space-y-1">
                      {(log.riskFactors as any[]).map((factor: any, idx: number) => (
                        <li key={idx} className="text-sm text-orange-700 flex items-center gap-2">
                          <span className={cn(
                            'w-2 h-2 rounded-full',
                            factor.severity === 'critical' ? 'bg-red-500' :
                            factor.severity === 'high' ? 'bg-orange-500' :
                            factor.severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                          )} />
                          {factor.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Timestamps */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Timestamps</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Initiated:</span>
                      <span className="ml-2">{format(new Date(log.initiatedAt), 'PPpp')}</span>
                    </div>
                    {log.queuedAt && (
                      <div>
                        <span className="text-gray-500">Queued:</span>
                        <span className="ml-2">{format(new Date(log.queuedAt), 'PPpp')}</span>
                      </div>
                    )}
                    {log.processingAt && (
                      <div>
                        <span className="text-gray-500">Processing:</span>
                        <span className="ml-2">{format(new Date(log.processingAt), 'PPpp')}</span>
                      </div>
                    )}
                    {log.completedAt && (
                      <div>
                        <span className="text-gray-500">Completed:</span>
                        <span className="ml-2">{format(new Date(log.completedAt), 'PPpp')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'timeline' && (
              <div className="space-y-4">
                {/* Stage History */}
                {log.stageHistory && (log.stageHistory as any[]).length > 0 ? (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                    {(log.stageHistory as any[]).map((stage: any, idx: number) => (
                      <div key={idx} className="relative pl-10 pb-4">
                        <div className="absolute left-2.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900">{stage.stage}</span>
                            <span className="text-xs text-gray-500">
                              {format(new Date(stage.timestamp), 'HH:mm:ss')}
                            </span>
                          </div>
                          {stage.message && (
                            <p className="text-sm text-gray-600 mt-1">{stage.message}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No stage history available</p>
                )}

                {/* Events */}
                {log.events && log.events.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-medium text-gray-900 mb-3">Events ({log.events.length})</h4>
                    <div className="space-y-2">
                      {log.events.map((event: any) => {
                        const eventIcons: Record<string, any> = {
                          error: XCircle,
                          warning: AlertTriangle,
                          info: Info,
                          debug: Bug,
                          stage_change: Activity,
                        };
                        const eventColors: Record<string, string> = {
                          error: 'text-red-500',
                          warning: 'text-yellow-500',
                          info: 'text-blue-500',
                          debug: 'text-gray-500',
                          stage_change: 'text-green-500',
                        };
                        const EventIcon = eventIcons[event.eventType] || Info;
                        return (
                          <div key={event.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                            <EventIcon className={cn('w-4 h-4 mt-0.5', eventColors[event.eventType])} />
                            <div className="flex-1">
                              <p className="text-sm">{event.message}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                {format(new Date(event.timestamp), 'HH:mm:ss')} • {event.source}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'data' && (
              <div className="space-y-6">
                {/* Vehicle Data */}
                {log.vehicleData && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Vehicle Data (Snapshot)</h4>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                      {JSON.stringify(log.vehicleData, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Request Data */}
                {log.requestData && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Request Data</h4>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                      {JSON.stringify(log.requestData, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Response Data */}
                {log.responseData && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Response Data</h4>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                      {JSON.stringify(log.responseData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'debug' && (
              <div className="space-y-6">
                {/* Extension Task */}
                {log.extensionTask && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Extension Task</h4>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                      {JSON.stringify(log.extensionTask, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Error Details */}
                {log.errorDetails && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Error Details</h4>
                    <pre className="bg-red-900 text-red-100 p-4 rounded-lg overflow-x-auto text-xs">
                      {JSON.stringify(log.errorDetails, null, 2)}
                    </pre>
                  </div>
                )}

                {/* IDs */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Reference IDs</h4>
                  <div className="grid grid-cols-1 gap-2 text-sm font-mono">
                    <div><span className="text-gray-500">Log ID:</span> {log.id}</div>
                    <div><span className="text-gray-500">Vehicle ID:</span> {log.vehicleId}</div>
                    <div><span className="text-gray-500">Account ID:</span> {log.accountId}</div>
                    <div><span className="text-gray-500">User ID:</span> {log.userId}</div>
                    {log.extensionTaskId && (
                      <div><span className="text-gray-500">Task ID:</span> {log.extensionTaskId}</div>
                    )}
                    {log.facebookPostId && (
                      <div><span className="text-gray-500">FB Post Record:</span> {log.facebookPostId}</div>
                    )}
                    {log.fbPostId && (
                      <div><span className="text-gray-500">Facebook Post ID:</span> {log.fbPostId}</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Log ID: <span className="font-mono">{log.id.slice(0, 8)}...</span>
            </div>
            <div className="flex items-center gap-3">
              {log.status === 'failed' && (
                <button
                  onClick={() => onRetry()}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Retry with Same Method
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Info Card Component
function InfoCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
        <Icon className="w-3.5 h-3.5" />
        {title}
      </div>
      <div className="font-medium text-gray-900">{children}</div>
    </div>
  );
}
