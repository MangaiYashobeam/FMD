import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  RefreshCw,
  Edit,
  Trash2,
  RotateCcw,
  Database,
  Container,
  Settings,
  BarChart3,
  Chrome,
  Terminal,
  Boxes,
  Target,
} from 'lucide-react';
import { api } from '../../lib/api';
import IAIPrototypePanel from './IAIPrototypePanel';
import IAITrainingPanel from './IAITrainingPanel';
import IAIInjectionPanel from './IAIInjectionPanel';
import IAIMissionControlPanel from './IAIMissionControlPanel';

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

interface SystemInfo {
  containers: {
    api: { status: string; uptime: string; restarts: number };
    postgres: { status: string; uptime: string; restarts: number };
    redis: { status: string; uptime: string; restarts: number };
    traefik: { status: string; uptime: string; restarts: number };
  };
  database: {
    connected: boolean;
    totalTables: number;
    totalRecords: {
      soldiers: number;
      vehicles: number;
      accounts: number;
      users: number;
    };
  };
  chromium: {
    activeSessions: number;
    totalLaunched: number;
    memoryUsage: string;
  };
  environment: {
    nodeVersion: string;
    platform: string;
    uptime: string;
    memory: { used: string; total: string };
  };
}

// ============================================
// API Functions
// ============================================

async function fetchSoldiers() {
  const response = await api.get('/api/admin/iai/soldiers?limit=100');
  return response.data;
}

async function fetchStats() {
  const response = await api.get('/api/admin/iai/stats');
  return response.data;
}

async function fetchSystemInfo() {
  const response = await api.get('/api/admin/iai/system-info');
  // Return the data or a properly structured empty object
  const data = response.data?.data || response.data;
  return {
    containers: data?.containers || {},
    database: data?.database || { connected: false, totalTables: 0, totalRecords: { soldiers: 0, vehicles: 0, accounts: 0, users: 0 } },
    chromium: data?.chromium || { activeSessions: 0, totalLaunched: 0, memoryUsage: '0 MB' },
    environment: data?.environment || { nodeVersion: 'N/A', platform: 'N/A', uptime: 'N/A', memory: { used: '0', total: '0' } },
  };
}

async function deleteSoldier(id: string) {
  const response = await api.delete(`/api/admin/iai/soldiers/${id}`);
  return response.data;
}

async function restartSoldier(id: string) {
  const response = await api.post(`/api/admin/iai/soldiers/${id}/restart`);
  return response.data;
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

function StatsCard({ title, value, icon: Icon, color, onClick, subtitle }: any) {
  return (
    <div
      onClick={onClick}
      className="bg-slate-800 rounded-xl border border-slate-700 p-4 hover:shadow-lg hover:border-blue-500 transition-all cursor-pointer group"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400 font-medium group-hover:text-blue-400 transition-colors">
            {title}
          </p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${color} group-hover:scale-110 transition-transform shadow-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

function SoldierCard({
  soldier,
  onClick,
  onEdit,
  onDelete,
  onRestart,
}: {
  soldier: IAISoldier;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRestart: () => void;
}) {
  const isOnline = soldier.lastHeartbeatAt
    ? new Date().getTime() - new Date(soldier.lastHeartbeatAt).getTime() < 120000
    : false;

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 hover:shadow-lg hover:border-blue-500 transition-all group">
      <div className="flex items-start justify-between">
        <div className="flex-1" onClick={onClick} role="button">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors cursor-pointer">
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

          <div className="space-y-1 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              <span className="font-medium text-slate-300">{soldier.account.dealershipName || soldier.account.name}</span>
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
                <Activity className="w-4 h-4 text-blue-400" />
                <span className="text-blue-400 font-medium">Working: {soldier.currentTaskType}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-2 text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors"
            title="Edit soldier"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRestart();
            }}
            className="p-2 text-green-400 hover:bg-green-900/30 rounded-lg transition-colors"
            title="Restart soldier"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
            title="Delete soldier"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs text-slate-500">Completed</p>
          <p className="text-lg font-bold text-green-400">{soldier.tasksCompleted}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Failed</p>
          <p className="text-lg font-bold text-red-400">{soldier.tasksFailed}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Success Rate</p>
          <p className="text-lg font-bold text-white">
            {soldier.successRate ? `${soldier.successRate.toFixed(0)}%` : 'N/A'}
          </p>
        </div>
      </div>

      <div className="mt-2 text-xs text-slate-500 text-center">
        Last seen: {formatTimeAgo(soldier.lastHeartbeatAt)}
      </div>
    </div>
  );
}

function SystemDashboard({ systemInfo }: { systemInfo: SystemInfo | undefined }) {
  if (!systemInfo || !systemInfo.containers) {
    return (
      <div className="text-center py-12">
        <Database className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">Loading system information...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Containers */}
      <div>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Container className="w-5 h-5 text-cyan-400" />
          Docker Containers
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {Object.keys(systemInfo.containers).length > 0 ? (
            Object.entries(systemInfo.containers).map(([name, info]) => (
              <div key={name} className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-white capitalize">{name}</h4>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium border ${
                      info.status === 'running'
                        ? 'bg-green-900/30 text-green-400 border-green-500/30'
                        : 'bg-red-900/30 text-red-400 border-red-500/30'
                    }`}
                  >
                    {info.status}
                  </span>
                </div>
                <div className="space-y-1 text-sm text-slate-400">
                  <div className="flex justify-between">
                    <span>Uptime:</span>
                    <span className="font-medium text-slate-300">{info.uptime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Restarts:</span>
                    <span className="font-medium text-slate-300">{info.restarts}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-2 text-center py-4 text-slate-500">
              No container data available
            </div>
          )}
        </div>
      </div>

      {/* Database */}
      <div>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-400" />
          Database Status
        </h3>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-500">Connection</p>
              <p className="text-lg font-bold text-green-400">
                {systemInfo.database.connected ? 'Connected' : 'Disconnected'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Soldiers</p>
              <p className="text-lg font-bold text-white">
                {systemInfo.database.totalRecords.soldiers}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Vehicles</p>
              <p className="text-lg font-bold text-white">
                {systemInfo.database.totalRecords.vehicles}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Users</p>
              <p className="text-lg font-bold text-white">
                {systemInfo.database.totalRecords.users}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Chromium Sessions */}
      <div>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Chrome className="w-5 h-5 text-green-400" />
          Chromium Sessions
        </h3>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-500">Active Sessions</p>
              <p className="text-2xl font-bold text-blue-400">
                {systemInfo.chromium.activeSessions}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Launched</p>
              <p className="text-2xl font-bold text-white">
                {systemInfo.chromium.totalLaunched}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Memory Usage</p>
              <p className="text-2xl font-bold text-white">{systemInfo.chromium.memoryUsage}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Environment */}
      <div>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-purple-400" />
          Environment
        </h3>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Node Version:</span>
              <span className="font-mono font-medium text-slate-200">{systemInfo.environment.nodeVersion}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Platform:</span>
              <span className="font-mono font-medium text-slate-200">{systemInfo.environment.platform}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Uptime:</span>
              <span className="font-mono font-medium text-slate-200">{systemInfo.environment.uptime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Memory:</span>
              <span className="font-mono font-medium text-slate-200">
                {systemInfo.environment.memory.used} / {systemInfo.environment.memory.total}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function IAICommandCenterV2() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'soldiers' | 'system' | 'prototype' | 'training' | 'injection' | 'mission-control'>('soldiers');
  const queryClient = useQueryClient();

  const {
    data: soldiersData,
    isLoading: soldiersLoading,
    error: soldiersError,
  } = useQuery({
    queryKey: ['soldiers'],
    queryFn: fetchSoldiers,
    refetchInterval: 30000, // 30 seconds - much more reasonable
    retry: 1,
    staleTime: 10000,
  });

  const {
    data: stats,
    isLoading: statsLoading,
  } = useQuery({
    queryKey: ['iaiStats'],
    queryFn: fetchStats,
    refetchInterval: 30000,
    retry: 1,
    staleTime: 10000,
  });

  const {
    data: systemInfo,
  } = useQuery({
    queryKey: ['systemInfo'],
    queryFn: fetchSystemInfo,
    refetchInterval: 60000, // 1 minute
    retry: 1,
    enabled: activeTab === 'system',
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSoldier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soldiers'] });
      queryClient.invalidateQueries({ queryKey: ['iaiStats'] });
    },
  });

  const restartMutation = useMutation({
    mutationFn: restartSoldier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soldiers'] });
    },
  });

  const soldiers = soldiersData?.soldiers || [];
  const filteredSoldiers =
    statusFilter === 'all' ? soldiers : soldiers.filter((s: IAISoldier) => s.status === statusFilter);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['soldiers'] });
    queryClient.invalidateQueries({ queryKey: ['iaiStats'] });
    queryClient.invalidateQueries({ queryKey: ['systemInfo'] });
  };

  const handleDelete = (soldier: IAISoldier) => {
    if (confirm(`Are you sure you want to delete ${soldier.soldierId}?`)) {
      deleteMutation.mutate(soldier.id);
    }
  };

  const handleRestart = (soldier: IAISoldier) => {
    if (confirm(`Restart ${soldier.soldierId}?`)) {
      restartMutation.mutate(soldier.id);
    }
  };

  if (soldiersError) {
    // Check if it's actually an auth error vs other error
    const isAuthError = (soldiersError as any)?.response?.status === 401;
    const errorMessage = (soldiersError as any)?.response?.data?.message || 
                        (soldiersError as any)?.message || 
                        'Unknown error';
    
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {isAuthError ? 'Authentication Error' : 'Error Loading IAI Data'}
          </h2>
          <p className="text-gray-600 mb-4">
            {isAuthError 
              ? 'Your session has expired. Please login again.'
              : `Failed to load soldiers: ${errorMessage}`
            }
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleRefresh}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Try Again
            </button>
            {isAuthError && (
              <button
                onClick={() => (window.location.href = '/login')}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300"
              >
                Go to Login
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (soldiersLoading || statsLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading IAI Command Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-screen bg-gray-900">
      {/* Header - Full Width Dark Theme */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-purple-900 text-white shadow-2xl flex-shrink-0 border-b border-slate-700">
        <div className="w-full px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <Zap className="w-7 h-7" />
                </div>
                IAI Command Center
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full border border-green-500/30 ml-2">
                  LIVE
                </span>
              </h1>
              <p className="text-slate-400 mt-1 text-sm">Real-time monitoring and control of all IAI soldiers</p>
            </div>
            <button
              onClick={handleRefresh}
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors border border-slate-600"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex gap-2">
            <button
              onClick={() => setActiveTab('soldiers')}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
                activeTab === 'soldiers'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <Server className="w-4 h-4 inline mr-2" />
              Soldiers
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
                activeTab === 'system'
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline mr-2" />
              System
            </button>
            <button
              onClick={() => setActiveTab('training')}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
                activeTab === 'training'
                  ? 'bg-green-600 text-white shadow-lg shadow-green-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <Eye className="w-4 h-4 inline mr-2" />
              Training
            </button>
            <button
              onClick={() => setActiveTab('prototype')}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
                activeTab === 'prototype'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <Terminal className="w-4 h-4 inline mr-2" />
              Prototype Test
            </button>
            <button
              onClick={() => setActiveTab('injection')}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
                activeTab === 'injection'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <Boxes className="w-4 h-4 inline mr-2" />
              Injection
            </button>
            <button
              onClick={() => setActiveTab('mission-control')}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
                activeTab === 'mission-control'
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <Target className="w-4 h-4 inline mr-2" />
              Mission Control
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-900">
        <div className="w-full px-6 py-6 space-y-6">
        {activeTab === 'soldiers' ? (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4">
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
                subtitle="All time"
                icon={TrendingUp}
                color="bg-emerald-600"
                onClick={() => setStatusFilter('all')}
              />
            </div>

            {/* Filters */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-slate-300">Filter by Status:</span>
                <div className="flex gap-2">
                  {['all', 'online', 'working', 'idle', 'offline', 'error'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        statusFilter === status
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="ml-auto text-sm text-slate-400">
                  Showing {filteredSoldiers.length} of {soldiers.length} soldiers
                </div>
              </div>
            </div>

            {/* Soldiers Grid */}
            {filteredSoldiers.length > 0 ? (
              <div className="grid grid-cols-3 gap-4">
                {filteredSoldiers.map((soldier: IAISoldier) => (
                  <SoldierCard
                    key={soldier.id}
                    soldier={soldier}
                    onClick={() => {/* View soldier details */}}
                    onEdit={() => alert('Edit functionality coming soon')}
                    onDelete={() => handleDelete(soldier)}
                    onRestart={() => handleRestart(soldier)}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
                <Eye className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">No Soldiers Found</h3>
                <p className="text-slate-400">
                  {statusFilter === 'all'
                    ? 'No IAI soldiers registered yet. Install and authenticate the extension to see soldiers here.'
                    : `No soldiers with status "${statusFilter}"`}
                </p>
              </div>
            )}
          </>
        ) : activeTab === 'system' ? (
          <SystemDashboard systemInfo={systemInfo} />
        ) : activeTab === 'training' ? (
          <IAITrainingPanel />
        ) : activeTab === 'injection' ? (
          <IAIInjectionPanel />
        ) : activeTab === 'mission-control' ? (
          <IAIMissionControlPanel />
        ) : (
          <IAIPrototypePanel />
        )}
        </div>
      </div>
    </div>
  );
}
