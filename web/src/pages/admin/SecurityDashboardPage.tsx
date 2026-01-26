/**
 * ============================================
 * FaceMyDealer - Security Dashboard (IntelliCeil Analytics)
 * ============================================
 * 
 * Admin dashboard for monitoring:
 * - Green Route requests & analytics
 * - Origin validation & blocked requests
 * - Account whitelist management
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Users,
  BarChart3,
  RefreshCw,
  Eye,
  X,
  Settings,
  Lock,
  Unlock
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../lib/api';

interface DashboardData {
  overview: {
    greenRouteRequests24h: number;
    blockedRequests24h: number;
    allowedRequests24h: number;
    whitelistedAccounts: number;
    greenRouteAccounts: number;
  };
  sourceBreakdown: Array<{ source: string; count: number }>;
  recentRequests: Array<any>;
  blockedRequests: Array<any>;
  topEndpoints: Array<any>;
}

interface LogDetail {
  log: any;
  account?: any;
  user?: any;
}

export function SecurityDashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'requests' | 'blocked' | 'whitelist'>('overview');
  const [selectedLog, setSelectedLog] = useState<LogDetail | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Check permissions
  const isSuperAdmin = user?.accounts?.some(a => a.role === 'SUPER_ADMIN');

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await api.get('/api/security/dashboard');
      setDashboardData(response.data);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDashboard();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  const viewLogDetail = async (logId: string) => {
    try {
      const response = await api.get(`/api/security/green-route/logs/${logId}`);
      setSelectedLog(response.data);
    } catch (error) {
      toast.error('Failed to load log details');
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400">Super Admin access required to view the Security Dashboard.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading security data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-xl">
              <Shield className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Security Dashboard</h1>
              <p className="text-gray-400">Green Route Analytics & Origin Validation</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <StatCard
            icon={<Activity className="w-5 h-5" />}
            label="Green Route (24h)"
            value={dashboardData?.overview.greenRouteRequests24h || 0}
            color="emerald"
          />
          <StatCard
            icon={<CheckCircle className="w-5 h-5" />}
            label="Allowed (24h)"
            value={dashboardData?.overview.allowedRequests24h || 0}
            color="blue"
          />
          <StatCard
            icon={<XCircle className="w-5 h-5" />}
            label="Blocked (24h)"
            value={dashboardData?.overview.blockedRequests24h || 0}
            color="red"
          />
          <StatCard
            icon={<Users className="w-5 h-5" />}
            label="Whitelisted"
            value={dashboardData?.overview.whitelistedAccounts || 0}
            color="purple"
          />
          <StatCard
            icon={<Lock className="w-5 h-5" />}
            label="Green Access"
            value={dashboardData?.overview.greenRouteAccounts || 0}
            color="yellow"
          />
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 border-b border-gray-700 pb-2">
          {[
            { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
            { id: 'requests', label: 'Green Route Logs', icon: <Activity className="w-4 h-4" /> },
            { id: 'blocked', label: 'Blocked Requests', icon: <AlertTriangle className="w-4 h-4" /> },
            { id: 'whitelist', label: 'Whitelist', icon: <Users className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid lg:grid-cols-2 gap-6"
            >
              {/* Source Breakdown */}
              <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Request Sources (24h)</h3>
                <div className="space-y-3">
                  {dashboardData?.sourceBreakdown.map((source, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          source.source === 'extension' ? 'bg-blue-500' :
                          source.source === 'webapp' ? 'bg-green-500' :
                          source.source === 'extension-hybrid' ? 'bg-purple-500' :
                          'bg-gray-500'
                        }`} />
                        <span className="text-gray-300 capitalize">{source.source || 'Unknown'}</span>
                      </div>
                      <span className="text-white font-mono">{source.count}</span>
                    </div>
                  ))}
                  {(!dashboardData?.sourceBreakdown || dashboardData.sourceBreakdown.length === 0) && (
                    <p className="text-gray-500 text-center py-4">No data available</p>
                  )}
                </div>
              </div>

              {/* Top Endpoints */}
              <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Top Endpoints</h3>
                <div className="space-y-2">
                  {dashboardData?.topEndpoints.slice(0, 10).map((endpoint, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-gray-700/50">
                      <div>
                        <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                          endpoint.method === 'GET' ? 'bg-green-500/20 text-green-400' :
                          endpoint.method === 'POST' ? 'bg-blue-500/20 text-blue-400' :
                          endpoint.method === 'PUT' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {endpoint.method}
                        </span>
                        <span className="text-gray-400 ml-2 text-sm">{endpoint.path}</span>
                      </div>
                      <span className="text-white font-mono text-sm">{endpoint.requestCount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'requests' && (
            <motion.div
              key="requests"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <RequestsTable 
                requests={dashboardData?.recentRequests || []} 
                onViewDetail={viewLogDetail}
              />
            </motion.div>
          )}

          {activeTab === 'blocked' && (
            <motion.div
              key="blocked"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <BlockedRequestsTable requests={dashboardData?.blockedRequests || []} />
            </motion.div>
          )}

          {activeTab === 'whitelist' && (
            <motion.div
              key="whitelist"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <WhitelistManager />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Log Detail Modal */}
        <AnimatePresence>
          {selectedLog && (
            <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ icon, label, value, color }: { 
  icon: React.ReactNode; 
  label: string; 
  value: number; 
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    emerald: 'from-emerald-500/20 to-emerald-600/10 text-emerald-400',
    blue: 'from-blue-500/20 to-blue-600/10 text-blue-400',
    red: 'from-red-500/20 to-red-600/10 text-red-400',
    purple: 'from-purple-500/20 to-purple-600/10 text-purple-400',
    yellow: 'from-yellow-500/20 to-yellow-600/10 text-yellow-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl border border-gray-700/50 p-4`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-gray-400 text-sm">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
    </div>
  );
}

// Requests Table Component
function RequestsTable({ requests, onViewDetail }: { requests: any[]; onViewDetail: (id: string) => void }) {
  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-900/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Method</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Path</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Source</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Response Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {requests.map((request) => (
              <tr key={request.id} className="hover:bg-gray-700/20">
                <td className="px-4 py-3 text-sm text-gray-400">
                  {new Date(request.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                    request.method === 'GET' ? 'bg-green-500/20 text-green-400' :
                    request.method === 'POST' ? 'bg-blue-500/20 text-blue-400' :
                    request.method === 'PUT' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {request.method}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-300 font-mono max-w-xs truncate">
                  {request.path}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    request.source === 'extension' ? 'bg-blue-500/20 text-blue-400' :
                    request.source === 'webapp' ? 'bg-green-500/20 text-green-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {request.source}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                    request.responseStatus >= 200 && request.responseStatus < 300 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {request.responseStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {request.responseTimeMs}ms
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onViewDetail(request.id)}
                    className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-700"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No requests recorded
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Blocked Requests Table
function BlockedRequestsTable({ requests }: { requests: any[] }) {
  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-900/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Method</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Path</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">IP</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {requests.map((request) => (
              <tr key={request.id} className="hover:bg-gray-700/20">
                <td className="px-4 py-3 text-sm text-gray-400">
                  {new Date(request.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded text-xs font-mono bg-red-500/20 text-red-400">
                    {request.method}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-300 font-mono max-w-xs truncate">
                  {request.path}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400 font-mono">
                  {request.ipAddress}
                </td>
                <td className="px-4 py-3 text-sm text-red-400">
                  {request.reason || 'Unknown'}
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No blocked requests
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Whitelist Manager Component
function WhitelistManager() {
  const toast = useToast();
  const [whitelist, setWhitelist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWhitelist();
  }, []);

  const fetchWhitelist = async () => {
    try {
      const response = await api.get('/api/security/whitelist');
      setWhitelist(response.data.accounts || []);
    } catch (error) {
      toast.error('Failed to load whitelist');
    } finally {
      setLoading(false);
    }
  };

  const toggleGreenRoute = async (accountId: string, currentValue: boolean) => {
    try {
      await api.patch(`/api/security/whitelist/${accountId}`, {
        greenRouteAccess: !currentValue
      });
      toast.success(`Green Route access ${!currentValue ? 'enabled' : 'disabled'}`);
      fetchWhitelist();
    } catch (error) {
      toast.error('Failed to update whitelist');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-900/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Account</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Whitelisted</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Green Route</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Extension</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {whitelist.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-700/20">
                <td className="px-4 py-3">
                  <div>
                    <p className="text-white font-medium">{entry.account?.name || 'Unknown'}</p>
                    <p className="text-gray-500 text-sm">{entry.account?.dealershipName}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {entry.isWhitelisted ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400" />
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleGreenRoute(entry.accountId, entry.greenRouteAccess)}
                    className={`p-2 rounded-lg ${
                      entry.greenRouteAccess 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : 'bg-gray-700/50 text-gray-500'
                    }`}
                  >
                    {entry.greenRouteAccess ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </button>
                </td>
                <td className="px-4 py-3">
                  {entry.extensionAccess ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400" />
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {entry.whitelistedAt ? new Date(entry.whitelistedAt).toLocaleDateString() : '-'}
                </td>
                <td className="px-4 py-3">
                  <button className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-700">
                    <Settings className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {whitelist.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No whitelisted accounts
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Log Detail Modal
function LogDetailModal({ log, onClose }: { log: LogDetail; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-gray-800 rounded-2xl border border-gray-700 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Request Details</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Request Info */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Request</h3>
            <div className="bg-gray-900/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Method</span>
                <span className="text-white font-mono">{log.log.method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Path</span>
                <span className="text-white font-mono text-sm">{log.log.path}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Source</span>
                <span className="text-white">{log.log.source}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">IP Address</span>
                <span className="text-white font-mono">{log.log.ipAddress}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`font-mono ${
                  log.log.responseStatus >= 200 && log.log.responseStatus < 300 
                    ? 'text-green-400' 
                    : 'text-red-400'
                }`}>
                  {log.log.responseStatus}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Response Time</span>
                <span className="text-white">{log.log.responseTimeMs}ms</span>
              </div>
            </div>
          </div>

          {/* Account Info */}
          {log.account && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Account</h3>
              <div className="bg-gray-900/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Name</span>
                  <span className="text-white">{log.account.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Dealership</span>
                  <span className="text-white">{log.account.dealershipName || '-'}</span>
                </div>
              </div>
            </div>
          )}

          {/* User Info */}
          {log.user && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">User</h3>
              <div className="bg-gray-900/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Email</span>
                  <span className="text-white">{log.user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Name</span>
                  <span className="text-white">{log.user.firstName} {log.user.lastName}</span>
                </div>
              </div>
            </div>
          )}

          {/* User Agent */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">User Agent</h3>
            <div className="bg-gray-900/50 rounded-lg p-4">
              <p className="text-gray-400 text-sm font-mono break-all">{log.log.userAgent}</p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default SecurityDashboardPage;
