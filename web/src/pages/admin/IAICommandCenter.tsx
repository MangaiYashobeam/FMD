import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  MapPin,
  Zap,
  XCircle,
  TrendingUp,
  Server,
  Eye,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface IAISoldier {
  id: string;
  soldierId: string;
  soldierNumber: number;
  status: 'online' | 'offline' | 'working' | 'idle' | 'error';
  accountId: string;
  userId: string | null;
  browserId: string | null;
  extensionVersion: string | null;
  locationCity: string | null;
  locationCountry: string | null;
  locationLat: number | null;
  locationLng: number | null;
  tasksCompleted: number;
  tasksFailed: number;
  successRate: number | null;
  avgTaskDurationSec: number | null;
  currentTaskType: string | null;
  lastHeartbeatAt: string | null;
  lastTaskAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  createdAt: string;
  account: {
    name: string;
    dealershipName: string | null;
  };
  user: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

// Stats interface removed - using inline typing

interface ActivityLog {
  id: string;
  eventType: string;
  message: string | null;
  eventData: any;
  taskId: string | null;
  taskType: string | null;
  createdAt: string;
}

interface PerformanceSnapshot {
  id: string;
  snapshotAt: string;
  tasksInPeriod: number;
  successCount: number;
  failureCount: number;
  avgDurationSec: number | null;
  status: string;
}

// ============================================
// API Functions
// ============================================

const API_URL = import.meta.env.VITE_API_URL || 'https://dealersface.com';

async function fetchWithAuth(url: string) {
  const token = localStorage.getItem('token');
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return response.json();
}

async function fetchSoldiers() {
  return fetchWithAuth(`${API_URL}/api/admin/iai/soldiers?limit=100`);
}

async function fetchStats() {
  return fetchWithAuth(`${API_URL}/api/admin/iai/stats`);
}

// fetchSoldierDetail removed - using soldierActivity query instead

async function fetchSoldierActivity(id: string) {
  return fetchWithAuth(`${API_URL}/api/admin/iai/soldiers/${id}/activity?limit=50`);
}

async function fetchSoldierPerformance(id: string) {
  return fetchWithAuth(`${API_URL}/api/admin/iai/soldiers/${id}/performance?hours=24`);
}

// ============================================
// Utility Functions
// ============================================

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    online: 'bg-green-100 text-green-800 border-green-200',
    working: 'bg-blue-100 text-blue-800 border-blue-200',
    offline: 'bg-gray-100 text-gray-800 border-gray-200',
    idle: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    error: 'bg-red-100 text-red-800 border-red-200',
  };
  return colors[status] || colors.offline;
}

function getStatusIcon(status: string) {
  const icons: Record<string, any> = {
    online: CheckCircle,
    working: Activity,
    offline: XCircle,
    idle: Clock,
    error: AlertCircle,
  };
  const Icon = icons[status] || XCircle;
  return <Icon className="w-4 h-4" />;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return 'N/A';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return `${Math.floor(diffMins / 1440)}d ago`;
}

// ============================================
// Components
// ============================================

function StatsCard({ title, value, icon: Icon, color, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg hover:border-blue-400 transition-all cursor-pointer group"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 font-medium group-hover:text-blue-600 transition-colors">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${color} group-hover:scale-110 transition-transform`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-2">Click to filter</p>
    </div>
  );
}

function SoldierCard({ soldier, onClick }: { soldier: IAISoldier; onClick: () => void }) {
  const isOnline = soldier.lastHeartbeatAt
    ? new Date().getTime() - new Date(soldier.lastHeartbeatAt).getTime() < 120000
    : false;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
              {soldier.soldierId}
            </h3>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                soldier.status
              )}`}
            >
              {getStatusIcon(soldier.status)}
              {soldier.status.toUpperCase()}
            </span>
            {isOnline && (
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                <span className="relative rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            )}
          </div>

          <div className="space-y-1 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              <span className="font-medium">{soldier.account.dealershipName || soldier.account.name}</span>
            </div>

            {soldier.locationCity && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>
                  {soldier.locationCity}, {soldier.locationCountry}
                </span>
              </div>
            )}

            {soldier.currentTaskType && (
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                <span className="text-blue-600 font-medium">Working: {soldier.currentTaskType}</span>
              </div>
            )}
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs text-gray-500">Completed</p>
          <p className="text-lg font-bold text-green-600">{soldier.tasksCompleted}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Failed</p>
          <p className="text-lg font-bold text-red-600">{soldier.tasksFailed}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Success Rate</p>
          <p className="text-lg font-bold text-gray-900">
            {soldier.successRate ? `${soldier.successRate.toFixed(0)}%` : 'N/A'}
          </p>
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-500 text-center">
        Last seen: {formatTimeAgo(soldier.lastHeartbeatAt)}
      </div>
    </div>
  );
}

function SoldierDetailModal({ soldier, onClose }: { soldier: IAISoldier; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'performance'>('overview');

  const { data: activityData } = useQuery({
    queryKey: ['soldierActivity', soldier.id],
    queryFn: () => fetchSoldierActivity(soldier.id),
    refetchInterval: 30000, // Reduced from 10s - modal polling
    staleTime: 20000,
  });

  const { data: performanceData } = useQuery({
    queryKey: ['soldierPerformance', soldier.id],
    queryFn: () => fetchSoldierPerformance(soldier.id),
    refetchInterval: 60000, // Reduced from 30s - performance data doesn't change often
    staleTime: 30000,
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{soldier.soldierId}</h2>
            <p className="text-blue-100 mt-1">
              {soldier.account.dealershipName || soldier.account.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-500 rounded-lg p-2 transition-colors"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="flex gap-1 px-6">
            {['overview', 'activity', 'performance'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-3 font-medium text-sm capitalize transition-colors border-b-2 ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Status Grid */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-4 h-4 text-gray-600" />
                    <p className="text-xs text-gray-600 font-medium">Status</p>
                  </div>
                  <p
                    className={`text-lg font-bold capitalize px-2 py-1 rounded inline-block ${getStatusColor(
                      soldier.status
                    )}`}
                  >
                    {soldier.status}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <p className="text-xs text-gray-600 font-medium">Completed</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{soldier.tasksCompleted}</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-1">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <p className="text-xs text-gray-600 font-medium">Failed</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{soldier.tasksFailed}</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    <p className="text-xs text-gray-600 font-medium">Success Rate</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {soldier.successRate ? `${soldier.successRate.toFixed(1)}%` : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900">Details</h3>
                  <div className="space-y-3">
                    <DetailRow label="Soldier Number" value={soldier.soldierNumber.toString()} />
                    <DetailRow label="Extension Version" value={soldier.extensionVersion || 'Unknown'} />
                    <DetailRow
                      label="Browser ID"
                      value={soldier.browserId?.slice(0, 8) + '...' || 'N/A'}
                    />
                    <DetailRow
                      label="Avg Task Duration"
                      value={formatDuration(soldier.avgTaskDurationSec)}
                    />
                    <DetailRow label="Created" value={new Date(soldier.createdAt).toLocaleString()} />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900">Location & Status</h3>
                  <div className="space-y-3">
                    <DetailRow
                      label="Location"
                      value={
                        soldier.locationCity
                          ? `${soldier.locationCity}, ${soldier.locationCountry}`
                          : 'Unknown'
                      }
                    />
                    <DetailRow
                      label="Coordinates"
                      value={
                        soldier.locationLat && soldier.locationLng
                          ? `${soldier.locationLat}, ${soldier.locationLng}`
                          : 'N/A'
                      }
                    />
                    <DetailRow label="Last Heartbeat" value={formatTimeAgo(soldier.lastHeartbeatAt)} />
                    <DetailRow label="Last Task" value={formatTimeAgo(soldier.lastTaskAt)} />
                    <DetailRow
                      label="Current Task"
                      value={soldier.currentTaskType || 'None'}
                      highlight={!!soldier.currentTaskType}
                    />
                  </div>
                </div>
              </div>

              {/* Error Display */}
              {soldier.lastError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-red-900">Last Error</h4>
                      <p className="text-sm text-red-700 mt-1">{soldier.lastError}</p>
                      <p className="text-xs text-red-600 mt-2">{formatTimeAgo(soldier.lastErrorAt)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Activity Log</h3>
                <span className="text-sm text-gray-500">
                  {activityData?.logs?.length || 0} events (last 50)
                </span>
              </div>

              <div className="space-y-2">
                {activityData?.logs?.map((log: ActivityLog) => (
                  <div
                    key={log.id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono font-bold text-blue-600 uppercase">
                            {log.eventType}
                          </span>
                          {log.taskType && (
                            <span className="text-xs text-gray-500">→ {log.taskType}</span>
                          )}
                        </div>
                        {log.message && (
                          <p className="text-sm text-gray-700">{log.message}</p>
                        )}
                        {log.eventData && (
                          <details className="mt-2">
                            <summary className="text-xs text-blue-600 cursor-pointer hover:underline">
                              View Data
                            </summary>
                            <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                              {JSON.stringify(log.eventData, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}

                {(!activityData?.logs || activityData.logs.length === 0) && (
                  <div className="text-center py-12">
                    <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">No activity logs yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Performance Metrics (24h)</h3>
                <span className="text-sm text-gray-500">
                  {performanceData?.snapshots?.length || 0} snapshots
                </span>
              </div>

              {performanceData?.snapshots && performanceData.snapshots.length > 0 ? (
                <div className="space-y-3">
                  {performanceData.snapshots
                    .slice(0, 20)
                    .map((snapshot: PerformanceSnapshot) => (
                      <div
                        key={snapshot.id}
                        className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-xs text-gray-500">Time</p>
                              <p className="font-medium text-gray-900">
                                {new Date(snapshot.snapshotAt).toLocaleTimeString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Status</p>
                              <p className={`font-medium capitalize ${getStatusColor(snapshot.status)}`}>
                                {snapshot.status}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Tasks</p>
                              <p className="font-medium text-gray-900">
                                {snapshot.successCount}/{snapshot.tasksInPeriod}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Avg Duration</p>
                              <p className="font-medium text-gray-900">
                                {formatDuration(snapshot.avgDurationSec)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No performance data yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-gray-100">
      <span className="text-sm text-gray-600 font-medium">{label}</span>
      <span
        className={`text-sm font-mono ${
          highlight ? 'text-blue-600 font-bold' : 'text-gray-900'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function IAICommandCenter() {
  const [selectedSoldier, setSelectedSoldier] = useState<IAISoldier | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const {
    data: soldiersData,
    isLoading: soldiersLoading,
    refetch: refetchSoldiers,
  } = useQuery({
    queryKey: ['soldiers'],
    queryFn: fetchSoldiers,
    refetchInterval: 15000, // Reduced from 5s to prevent DOM freezing
    staleTime: 10000,
  });

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['iaiStats'],
    queryFn: fetchStats,
    refetchInterval: 30000, // Reduced from 10s to prevent DOM freezing
    staleTime: 15000,
  });

  const soldiers = soldiersData?.soldiers || [];
  const filteredSoldiers =
    statusFilter === 'all' ? soldiers : soldiers.filter((s: IAISoldier) => s.status === statusFilter);

  const handleRefresh = () => {
    refetchSoldiers();
    refetchStats();
  };

  if (soldiersLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading IAI Command Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Zap className="w-8 h-8" />
                IAI Command Center
              </h1>
              <p className="text-blue-100 mt-2">Real-time monitoring and control of all IAI soldiers</p>
            </div>
            <button
              onClick={handleRefresh}
              className="bg-blue-500 hover:bg-blue-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-6">
          <StatsCard
            title="Total Soldiers"
            value={stats?.totalSoldiers || 0}
            icon={Server}
            color="bg-blue-600"
            onClick={() => setStatusFilter('all')}
          />
          <StatsCard
            title="Online"
            value={stats?.onlineSoldiers || 0}
            icon={CheckCircle}
            color="bg-green-600"
            onClick={() => setStatusFilter('online')}
          />
          <StatsCard
            title="Working"
            value={stats?.workingSoldiers || 0}
            icon={Activity}
            color="bg-purple-600"
            onClick={() => setStatusFilter('working')}
          />
          <StatsCard
            title="Tasks Completed"
            value={stats?.totalTasksCompleted || 0}
            icon={TrendingUp}
            color="bg-emerald-600"
            onClick={() => setStatusFilter('all')}
          />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Filter by Status:</span>
            <div className="flex gap-2">
              {['all', 'online', 'working', 'idle', 'offline', 'error'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
            <div className="ml-auto text-sm text-gray-500">
              Showing {filteredSoldiers.length} of {soldiers.length} soldiers
            </div>
          </div>
        </div>

        {/* Soldiers Grid */}
        {filteredSoldiers.length > 0 ? (
          <div className="grid grid-cols-3 gap-6">
            {filteredSoldiers.map((soldier: IAISoldier) => (
              <SoldierCard
                key={soldier.id}
                soldier={soldier}
                onClick={() => setSelectedSoldier(soldier)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Eye className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">No Soldiers Found</h3>
            <p className="text-gray-600">
              {statusFilter === 'all'
                ? 'No IAI soldiers have been registered yet. Install and authenticate the extension to see soldiers here.'
                : `No soldiers with status "${statusFilter}"`}
            </p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedSoldier && (
        <SoldierDetailModal
          soldier={selectedSoldier}
          onClose={() => setSelectedSoldier(null)}
        />
      )}
    </div>
  );
}
