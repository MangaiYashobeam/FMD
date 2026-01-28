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
  Cpu,
  Ghost,
  Brain,
  Filter,
  Layers,
} from 'lucide-react';
import { api } from '../../lib/api';
import IAIPrototypePanel from './IAIPrototypePanel';
import IAITrainingPanel from './IAITrainingPanel';
import IAIInjectionPanel from './IAIInjectionPanel';
import IAIMissionControlPanel from './IAIMissionControlPanel';
import IAIFactoryControlPanel from './IAIFactoryControlPanel';

// ============================================
// v2.3.0 Classification Types
// ============================================

type SoldierGenre = 'SOLDIER' | 'STEALTH' | 'NOVA';
type ExecutionSource = 'EXTENSION' | 'CHROMIUM';
type SoldierMode = 'USM' | 'STEALTH' | 'HYBRID' | 'NOVA_AI';
type SoldierStatus = 'ONLINE' | 'OFFLINE' | 'WORKING' | 'IDLE' | 'ERROR' | 'SUSPENDED';
// Match database enum: FBM_LISTING, FBM_MESSAGES, FBM_FULL, TRAINING, INTELLIGENCE, CUSTOM
type MissionProfile = 'FBM_LISTING' | 'FBM_MESSAGES' | 'FBM_FULL' | 'TRAINING' | 'INTELLIGENCE' | 'CUSTOM';

// ============================================
// Types
// ============================================

interface IAISoldier {
  id: string;
  soldierId: string;
  soldierNumber: number;
  status: SoldierStatus;
  accountId: string;
  userId: string | null;
  browserId: string | null;
  extensionVersion: string | null;
  // v2.3.0 Classification
  genre: SoldierGenre;
  executionSource: ExecutionSource;
  mode: SoldierMode;
  missionProfile: MissionProfile;
  chromiumVersion: string | null;
  // Location
  locationCity: string | null;
  locationCountry: string | null;
  locationLat: number | null;
  locationLng: number | null;
  // Pattern tracking
  currentPatternId: string | null;
  currentPatternName: string | null;
  patternLoadedAt: string | null;
  patternSource: 'override' | 'default' | 'weighted' | 'usm' | 'nova' | null;
  // Performance
  tasksCompleted: number;
  tasksFailed: number;
  successRate: number | null;
  avgTaskDurationSec: number | null;
  currentTaskType: string | null;
  lastHeartbeatAt: string | null;
  lastTaskAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  // NOVA-specific
  novaIntelligenceScore: number | null;
  novaDecisionsMade: number | null;
  novaLearningCycles: number | null;
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

interface IAIStats {
  totalSoldiers: number;
  onlineSoldiers: number;
  workingSoldiers: number;
  offlineSoldiers: number;
  errorSoldiers: number;
  recentActivity: number;
  totalTasksCompleted: number;
  totalTasksFailed: number;
  // v2.3.0 Classification stats
  byGenre: Record<SoldierGenre, number>;
  bySource: Record<ExecutionSource, number>;
  byMode: Record<SoldierMode, number>;
}

interface SoldiersResponse {
  soldiers: IAISoldier[];
  pagination: { page: number; limit: number; total: number; pages: number };
  filters: {
    genres: SoldierGenre[];
    sources: ExecutionSource[];
    modes: SoldierMode[];
    missions: MissionProfile[];
  };
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

async function fetchSoldiers(params: {
  genre?: SoldierGenre;
  executionSource?: ExecutionSource;
  mode?: SoldierMode;
  missionProfile?: MissionProfile;
  status?: string;
  search?: string;
}): Promise<SoldiersResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('limit', '100');
  if (params.genre) searchParams.set('genre', params.genre);
  if (params.executionSource) searchParams.set('executionSource', params.executionSource);
  if (params.mode) searchParams.set('mode', params.mode);
  if (params.missionProfile) searchParams.set('missionProfile', params.missionProfile);
  if (params.status) searchParams.set('status', params.status);
  if (params.search) searchParams.set('search', params.search);
  
  const response = await api.get(`/api/admin/iai/soldiers?${searchParams.toString()}`);
  return response.data;
}

async function fetchStats(): Promise<IAIStats> {
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

async function updateSoldier(id: string, data: Partial<IAISoldier>) {
  const response = await api.patch(`/api/admin/iai/soldiers/${id}`, data);
  return response.data;
}

// ============================================
// Utility Functions
// ============================================

// v2.3.0 Genre icons and colors
function getGenreIcon(genre: SoldierGenre) {
  const icons: Record<SoldierGenre, React.ReactNode> = {
    SOLDIER: <Zap className="w-4 h-4" />,
    STEALTH: <Ghost className="w-4 h-4" />,
    NOVA: <Brain className="w-4 h-4" />,
  };
  return icons[genre] || icons.SOLDIER;
}

function getGenreColor(genre: SoldierGenre): string {
  const colors: Record<SoldierGenre, string> = {
    SOLDIER: 'bg-blue-100 text-blue-800 border-blue-300',
    STEALTH: 'bg-purple-100 text-purple-800 border-purple-300',
    NOVA: 'bg-amber-100 text-amber-800 border-amber-300',
  };
  return colors[genre] || colors.SOLDIER;
}

function getModeColor(mode: SoldierMode): string {
  const colors: Record<SoldierMode, string> = {
    USM: 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30',
    STEALTH: 'bg-purple-900/30 text-purple-400 border-purple-500/30',
    HYBRID: 'bg-green-900/30 text-green-400 border-green-500/30',
    NOVA_AI: 'bg-amber-900/30 text-amber-400 border-amber-500/30',
  };
  return colors[mode] || colors.USM;
}

function getSourceBadge(source: ExecutionSource): string {
  const colors: Record<ExecutionSource, string> = {
    EXTENSION: 'bg-blue-900/30 text-blue-400 border-blue-500/30',
    CHROMIUM: 'bg-cyan-900/30 text-cyan-400 border-cyan-500/30',
  };
  return colors[source] || colors.EXTENSION;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ONLINE: 'bg-green-100 text-green-800 border-green-200',
    WORKING: 'bg-blue-100 text-blue-800 border-blue-200',
    OFFLINE: 'bg-gray-100 text-gray-800 border-gray-200',
    IDLE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    ERROR: 'bg-red-100 text-red-800 border-red-200',
    SUSPENDED: 'bg-orange-100 text-orange-800 border-orange-200',
    // Legacy lowercase support
    online: 'bg-green-100 text-green-800 border-green-200',
    working: 'bg-blue-100 text-blue-800 border-blue-200',
    offline: 'bg-gray-100 text-gray-800 border-gray-200',
    idle: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    error: 'bg-red-100 text-red-800 border-red-200',
  };
  return colors[status] || colors.OFFLINE;
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

  // Get pattern source badge color
  const getPatternSourceBadge = (source: string | null) => {
    const styles: Record<string, string> = {
      override: 'bg-purple-900/30 text-purple-400 border-purple-500/30',
      usm: 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30',
      weighted: 'bg-blue-900/30 text-blue-400 border-blue-500/30',
      default: 'bg-slate-700 text-slate-400 border-slate-600',
    };
    return styles[source || 'default'] || styles.default;
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 hover:shadow-lg hover:border-blue-500 transition-all group">
      <div className="flex items-start justify-between">
        <div className="flex-1" onClick={onClick} role="button">
          {/* v2.3.0 Genre/Source/Mode badges */}
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            {soldier.genre && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getGenreColor(soldier.genre)}`}>
                {getGenreIcon(soldier.genre)}
                {soldier.genre}
              </span>
            )}
            {soldier.executionSource && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${getSourceBadge(soldier.executionSource)}`}>
                {soldier.executionSource === 'EXTENSION' ? (
                  <Zap className="w-3 h-3" />
                ) : (
                  <Chrome className="w-3 h-3" />
                )}
                {soldier.executionSource}
              </span>
            )}
            {soldier.mode && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${getModeColor(soldier.mode)}`}>
                {soldier.mode}
              </span>
            )}
          </div>

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
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
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

            {/* NOVA Intelligence Score */}
            {soldier.genre === 'NOVA' && soldier.novaIntelligenceScore && (
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-amber-400" />
                <span className="text-amber-300 font-medium">
                  NOVA IQ: {soldier.novaIntelligenceScore.toFixed(1)}
                </span>
                {soldier.novaDecisionsMade && (
                  <span className="text-slate-500 text-xs">
                    ({soldier.novaDecisionsMade} decisions)
                  </span>
                )}
              </div>
            )}

            {/* Current Pattern */}
            {soldier.currentPatternName && (
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-400" />
                <span className="text-purple-300 font-medium">{soldier.currentPatternName}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] border ${getPatternSourceBadge(soldier.patternSource)}`}>
                  {soldier.patternSource?.toUpperCase() || 'DEFAULT'}
                </span>
              </div>
            )}

            {/* Mission Profile */}
            {soldier.missionProfile && (
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-orange-400" />
                <span className="text-orange-300 font-medium">{soldier.missionProfile}</span>
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

      {/* Minimalistic Progress Indicator */}
      <div className="mt-3 flex items-center gap-2 text-xs">
        <span className="text-slate-500">Progress:</span>
        <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full ${
              soldier.currentTaskType ? 'bg-blue-500 animate-pulse' :
              soldier.status === 'ERROR' ? 'bg-red-500' :
              soldier.tasksCompleted > 0 ? 'bg-green-500' : 'bg-slate-600'
            }`}
            style={{ 
              width: `${soldier.currentTaskType ? 60 : soldier.status === 'ERROR' ? 0 : soldier.tasksCompleted > 0 ? 100 : 20}%` 
            }}
          />
        </div>
        <span className={`font-medium ${
          soldier.currentTaskType ? 'text-blue-400' :
          soldier.status === 'ERROR' ? 'text-red-400' :
          soldier.tasksCompleted > 0 ? 'text-green-400' : 'text-slate-400'
        }`}>
          {soldier.currentTaskType ? 'Working' :
           soldier.status === 'ERROR' ? 'Error' :
           soldier.tasksCompleted > 0 ? 'Complete' : 'Ready'}
        </span>
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

// ============================================
// Soldier Edit Modal - Minimalistic Design
// ============================================

interface SoldierEditModalProps {
  soldier: IAISoldier;
  onClose: () => void;
  onSave: (data: Partial<IAISoldier>) => void;
}

function SoldierEditModal({ soldier, onClose, onSave }: SoldierEditModalProps) {
  const [formData, setFormData] = useState({
    status: soldier.status,
    genre: soldier.genre,
    mode: soldier.mode,
    missionProfile: soldier.missionProfile,
  });
  const [saving, setSaving] = useState(false);

  // Calculate completion percentage based on soldier progress
  const getCompletionStatus = () => {
    if (soldier.currentTaskType) return { pct: 50, label: 'Working' };
    if (soldier.status === 'ERROR') return { pct: 0, label: 'Error' };
    if (soldier.status === 'OFFLINE') return { pct: 0, label: 'Offline' };
    if (soldier.tasksCompleted > 0) return { pct: 100, label: 'Complete' };
    return { pct: 25, label: 'Ready' };
  };

  const completion = getCompletionStatus();

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            {getGenreIcon(soldier.genre)}
            <div>
              <h3 className="text-lg font-bold text-white">{soldier.soldierId}</h3>
              <p className="text-xs text-slate-400">{soldier.account?.dealershipName || 'Unknown Account'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Completion Status - Minimalistic */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Progress</span>
            <span className={`text-sm font-medium ${
              completion.pct === 100 ? 'text-green-400' :
              completion.pct >= 50 ? 'text-blue-400' :
              completion.pct > 0 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {completion.label} ({completion.pct}%)
            </span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                completion.pct === 100 ? 'bg-green-500' :
                completion.pct >= 50 ? 'bg-blue-500' :
                completion.pct > 0 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${completion.pct}%` }}
            />
          </div>
          {soldier.currentTaskType && (
            <p className="text-xs text-blue-400 mt-2 flex items-center gap-1">
              <Activity className="w-3 h-3" />
              Currently: {soldier.currentTaskType}
            </p>
          )}
        </div>

        {/* Edit Form - Minimalistic */}
        <div className="p-4 space-y-4">
          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as SoldierStatus })}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ONLINE">🟢 Online</option>
              <option value="WORKING">🔵 Working</option>
              <option value="IDLE">🟡 Idle</option>
              <option value="OFFLINE">⚫ Offline</option>
              <option value="ERROR">🔴 Error</option>
              <option value="SUSPENDED">🟠 Suspended</option>
            </select>
          </div>

          {/* Genre */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Type</label>
            <select
              value={formData.genre}
              onChange={(e) => setFormData({ ...formData, genre: e.target.value as SoldierGenre })}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="SOLDIER">⚡ IAI Soldier</option>
              <option value="STEALTH">👻 Stealth Soldier</option>
              <option value="NOVA">🧠 NOVA Soldier</option>
            </select>
          </div>

          {/* Mode */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Mode</label>
            <select
              value={formData.mode}
              onChange={(e) => setFormData({ ...formData, mode: e.target.value as SoldierMode })}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="USM">⚡ USM (Ultra Speed)</option>
              <option value="STEALTH">🥷 Stealth</option>
              <option value="HYBRID">🔄 Hybrid</option>
              <option value="NOVA_AI">🤖 NOVA AI</option>
            </select>
          </div>

          {/* Mission Profile */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Mission</label>
            <select
              value={formData.missionProfile}
              onChange={(e) => setFormData({ ...formData, missionProfile: e.target.value as MissionProfile })}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="FBM_LISTING">🚗 FBM Listing</option>
              <option value="FBM_MESSAGES">💬 FBM Messages</option>
              <option value="FBM_FULL">🔄 FBM Full</option>
              <option value="TRAINING">📚 Training</option>
              <option value="INTELLIGENCE">🔍 Intelligence</option>
              <option value="CUSTOM">⚙️ Custom</option>
            </select>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="px-4 pb-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-700/50 rounded-lg p-2">
              <p className="text-xs text-slate-500">Tasks</p>
              <p className="text-sm font-bold text-green-400">{soldier.tasksCompleted}</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-2">
              <p className="text-xs text-slate-500">Failed</p>
              <p className="text-sm font-bold text-red-400">{soldier.tasksFailed}</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-2">
              <p className="text-xs text-slate-500">Rate</p>
              <p className="text-sm font-bold text-white">{soldier.successRate?.toFixed(0) || 0}%</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
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
  // v2.3.0 Enhanced Filter State
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [genreFilter, setGenreFilter] = useState<SoldierGenre | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<ExecutionSource | 'all'>('all');
  const [modeFilter, setModeFilter] = useState<SoldierMode | 'all'>('all');
  const [missionFilter, setMissionFilter] = useState<MissionProfile | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'soldiers' | 'system' | 'prototype' | 'training' | 'injection' | 'mission-control' | 'factory'>('soldiers');
  const queryClient = useQueryClient();

  // Build filter params for API call
  const filterParams = {
    status: statusFilter !== 'all' ? statusFilter : undefined,
    genre: genreFilter !== 'all' ? genreFilter : undefined,
    executionSource: sourceFilter !== 'all' ? sourceFilter : undefined,
    mode: modeFilter !== 'all' ? modeFilter : undefined,
    missionProfile: missionFilter !== 'all' ? missionFilter : undefined,
    search: searchQuery || undefined,
  };

  const {
    data: soldiersData,
    isLoading: soldiersLoading,
    error: soldiersError,
  } = useQuery({
    queryKey: ['soldiers', filterParams],
    queryFn: () => fetchSoldiers(filterParams),
    refetchInterval: 5000, // 5 seconds for faster soldier visibility
    retry: 2,
    staleTime: 2000,
    refetchOnWindowFocus: true,
  });

  const {
    data: stats,
    isLoading: statsLoading,
  } = useQuery({
    queryKey: ['iaiStats'],
    queryFn: fetchStats,
    refetchInterval: 5000, // Match soldiers refresh
    retry: 2,
    staleTime: 2000,
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

  // Edit Soldier State & Mutation
  const [editingSoldier, setEditingSoldier] = useState<IAISoldier | null>(null);
  
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<IAISoldier> }) => updateSoldier(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soldiers'] });
      queryClient.invalidateQueries({ queryKey: ['iaiStats'] });
      setEditingSoldier(null);
    },
    onError: (error) => {
      console.error('Failed to update soldier:', error);
    },
  });

  const handleEditSave = (data: Partial<IAISoldier>) => {
    if (editingSoldier) {
      updateMutation.mutate({ id: editingSoldier.id, data });
    }
  };

  const soldiers = soldiersData?.soldiers || [];
  // Client-side filtering no longer needed - server handles it
  const filteredSoldiers = soldiers;

  // Reset all filters
  const handleResetFilters = () => {
    setStatusFilter('all');
    setGenreFilter('all');
    setSourceFilter('all');
    setModeFilter('all');
    setMissionFilter('all');
    setSearchQuery('');
  };

  // Count active filters
  const activeFilterCount = [
    statusFilter !== 'all',
    genreFilter !== 'all',
    sourceFilter !== 'all',
    modeFilter !== 'all',
    missionFilter !== 'all',
    searchQuery.length > 0,
  ].filter(Boolean).length;

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
            <button
              onClick={() => setActiveTab('factory')}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
                activeTab === 'factory'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <Cpu className="w-4 h-4 inline mr-2" />
              IAI Factory
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-900">
        <div className="w-full px-6 py-6 space-y-6">
        {activeTab === 'soldiers' ? (
          <>
            {/* Primary Stats Grid */}
            <div className="grid grid-cols-4 gap-4">
              <StatsCard
                title="Total Soldiers"
                value={stats?.totalSoldiers || 0}
                icon={Server}
                color="bg-blue-600"
                onClick={() => handleResetFilters()}
              />
              <StatsCard
                title="Online"
                value={stats?.onlineSoldiers || 0}
                icon={CheckCircle}
                color="bg-green-600"
                onClick={() => { handleResetFilters(); setStatusFilter('ONLINE'); }}
              />
              <StatsCard
                title="Working"
                value={stats?.workingSoldiers || 0}
                icon={Activity}
                color="bg-purple-600"
                onClick={() => { handleResetFilters(); setStatusFilter('WORKING'); }}
              />
              <StatsCard
                title="Tasks Completed"
                value={stats?.totalTasksCompleted || 0}
                subtitle="All time"
                icon={TrendingUp}
                color="bg-emerald-600"
                onClick={() => handleResetFilters()}
              />
            </div>

            {/* v2.3.0 Classification Stats */}
            {stats?.byGenre && (
              <div className="grid grid-cols-3 gap-4">
                {/* By Genre */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                  <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    By Genre
                  </h4>
                  <div className="space-y-2">
                    <div 
                      className="flex items-center justify-between cursor-pointer hover:bg-slate-700/50 p-2 rounded-lg transition-colors"
                      onClick={() => { handleResetFilters(); setGenreFilter('SOLDIER'); }}
                    >
                      <span className="flex items-center gap-2 text-blue-400">
                        <Zap className="w-4 h-4" />
                        IAI Soldiers
                      </span>
                      <span className="text-lg font-bold text-white">{stats.byGenre.SOLDIER || 0}</span>
                    </div>
                    <div 
                      className="flex items-center justify-between cursor-pointer hover:bg-slate-700/50 p-2 rounded-lg transition-colors"
                      onClick={() => { handleResetFilters(); setGenreFilter('STEALTH'); }}
                    >
                      <span className="flex items-center gap-2 text-purple-400">
                        <Ghost className="w-4 h-4" />
                        Stealth Soldiers
                      </span>
                      <span className="text-lg font-bold text-white">{stats.byGenre.STEALTH || 0}</span>
                    </div>
                    <div 
                      className="flex items-center justify-between cursor-pointer hover:bg-slate-700/50 p-2 rounded-lg transition-colors"
                      onClick={() => { handleResetFilters(); setGenreFilter('NOVA'); }}
                    >
                      <span className="flex items-center gap-2 text-amber-400">
                        <Brain className="w-4 h-4" />
                        NOVA Soldiers
                      </span>
                      <span className="text-lg font-bold text-white">{stats.byGenre.NOVA || 0}</span>
                    </div>
                  </div>
                </div>

                {/* By Execution Source */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                  <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                    <Server className="w-4 h-4" />
                    By Execution Source
                  </h4>
                  <div className="space-y-2">
                    <div 
                      className="flex items-center justify-between cursor-pointer hover:bg-slate-700/50 p-2 rounded-lg transition-colors"
                      onClick={() => { handleResetFilters(); setSourceFilter('EXTENSION'); }}
                    >
                      <span className="flex items-center gap-2 text-blue-400">
                        <Zap className="w-4 h-4" />
                        Extension (User Browser)
                      </span>
                      <span className="text-lg font-bold text-white">{stats.bySource?.EXTENSION || 0}</span>
                    </div>
                    <div 
                      className="flex items-center justify-between cursor-pointer hover:bg-slate-700/50 p-2 rounded-lg transition-colors"
                      onClick={() => { handleResetFilters(); setSourceFilter('CHROMIUM'); }}
                    >
                      <span className="flex items-center gap-2 text-cyan-400">
                        <Chrome className="w-4 h-4" />
                        Chromium (Server)
                      </span>
                      <span className="text-lg font-bold text-white">{stats.bySource?.CHROMIUM || 0}</span>
                    </div>
                  </div>
                </div>

                {/* By Mode */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                  <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    By Mode
                  </h4>
                  <div className="space-y-2">
                    <div 
                      className="flex items-center justify-between cursor-pointer hover:bg-slate-700/50 p-2 rounded-lg transition-colors"
                      onClick={() => { handleResetFilters(); setModeFilter('USM'); }}
                    >
                      <span className="text-yellow-400">Ultra Speed (USM)</span>
                      <span className="text-lg font-bold text-white">{stats.byMode?.USM || 0}</span>
                    </div>
                    <div 
                      className="flex items-center justify-between cursor-pointer hover:bg-slate-700/50 p-2 rounded-lg transition-colors"
                      onClick={() => { handleResetFilters(); setModeFilter('STEALTH'); }}
                    >
                      <span className="text-purple-400">Stealth Mode</span>
                      <span className="text-lg font-bold text-white">{stats.byMode?.STEALTH || 0}</span>
                    </div>
                    <div 
                      className="flex items-center justify-between cursor-pointer hover:bg-slate-700/50 p-2 rounded-lg transition-colors"
                      onClick={() => { handleResetFilters(); setModeFilter('HYBRID'); }}
                    >
                      <span className="text-green-400">Hybrid Mode</span>
                      <span className="text-lg font-bold text-white">{stats.byMode?.HYBRID || 0}</span>
                    </div>
                    <div 
                      className="flex items-center justify-between cursor-pointer hover:bg-slate-700/50 p-2 rounded-lg transition-colors"
                      onClick={() => { handleResetFilters(); setModeFilter('NOVA_AI'); }}
                    >
                      <span className="text-amber-400">NOVA AI</span>
                      <span className="text-lg font-bold text-white">{stats.byMode?.NOVA_AI || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* v2.3.0 Enhanced Filters */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-4">
              {/* Search and Toggle */}
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search soldiers by ID or account..."
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 pl-10 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                  <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    showAdvancedFilters || activeFilterCount > 0
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">{activeFilterCount}</span>
                  )}
                </button>
                {activeFilterCount > 0 && (
                  <button
                    onClick={handleResetFilters}
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Clear all
                  </button>
                )}
                <div className="ml-auto text-sm text-slate-400">
                  Showing {filteredSoldiers.length} soldiers
                </div>
              </div>

              {/* Status Filter - Always visible */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-slate-300">Status:</span>
                <div className="flex gap-2 flex-wrap">
                  {['all', 'ONLINE', 'WORKING', 'IDLE', 'OFFLINE', 'ERROR'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        statusFilter === status
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {status === 'all' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Filters - Collapsible */}
              {showAdvancedFilters && (
                <div className="pt-4 border-t border-slate-700 space-y-4">
                  {/* Genre Filter */}
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-300 w-20">Genre:</span>
                    <div className="flex gap-2">
                      {(['all', 'SOLDIER', 'STEALTH', 'NOVA'] as const).map((genre) => (
                        <button
                          key={genre}
                          onClick={() => setGenreFilter(genre)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                            genreFilter === genre
                              ? genre === 'SOLDIER' ? 'bg-blue-600 text-white'
                              : genre === 'STEALTH' ? 'bg-purple-600 text-white'
                              : genre === 'NOVA' ? 'bg-amber-600 text-white'
                              : 'bg-blue-600 text-white'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          {genre === 'SOLDIER' && <Zap className="w-3.5 h-3.5" />}
                          {genre === 'STEALTH' && <Ghost className="w-3.5 h-3.5" />}
                          {genre === 'NOVA' && <Brain className="w-3.5 h-3.5" />}
                          {genre === 'all' ? 'All' : genre}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Execution Source Filter */}
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-300 w-20">Source:</span>
                    <div className="flex gap-2">
                      {(['all', 'EXTENSION', 'CHROMIUM'] as const).map((source) => (
                        <button
                          key={source}
                          onClick={() => setSourceFilter(source)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                            sourceFilter === source
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          {source === 'EXTENSION' && <Zap className="w-3.5 h-3.5" />}
                          {source === 'CHROMIUM' && <Chrome className="w-3.5 h-3.5" />}
                          {source === 'all' ? 'All Sources' : source}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mode Filter */}
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-300 w-20">Mode:</span>
                    <div className="flex gap-2">
                      {(['all', 'USM', 'STEALTH', 'HYBRID', 'NOVA_AI'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setModeFilter(mode)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            modeFilter === mode
                              ? mode === 'USM' ? 'bg-yellow-600 text-white'
                              : mode === 'STEALTH' ? 'bg-purple-600 text-white'
                              : mode === 'HYBRID' ? 'bg-green-600 text-white'
                              : mode === 'NOVA_AI' ? 'bg-amber-600 text-white'
                              : 'bg-blue-600 text-white'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          {mode === 'all' ? 'All Modes' : mode.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mission Profile Filter */}
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-300 w-20">Mission:</span>
                    <div className="flex gap-2 flex-wrap">
                      {(['all', 'FBM_LISTING', 'FBM_MESSAGES', 'FBM_FULL', 'TRAINING', 'INTELLIGENCE', 'CUSTOM'] as (MissionProfile | 'all')[]).map((mission) => (
                        <button
                          key={mission}
                          onClick={() => setMissionFilter(mission)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            missionFilter === mission
                              ? 'bg-orange-600 text-white'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          {mission === 'all' ? 'All Missions' : mission.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Edit Soldier Modal */}
            {editingSoldier && (
              <SoldierEditModal
                soldier={editingSoldier}
                onClose={() => setEditingSoldier(null)}
                onSave={handleEditSave}
              />
            )}

            {/* Soldiers Grid */}
            {filteredSoldiers.length > 0 ? (
              <div className="grid grid-cols-3 gap-4">
                {filteredSoldiers.map((soldier: IAISoldier) => (
                  <SoldierCard
                    key={soldier.id}
                    soldier={soldier}
                    onClick={() => {/* View soldier details */}}
                    onEdit={() => setEditingSoldier(soldier)}
                    onDelete={() => handleDelete(soldier)}
                    onRestart={() => handleRestart(soldier)}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
                <Eye className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">No Soldiers Found</h3>
                <p className="text-slate-400 mb-4">
                  {statusFilter === 'all'
                    ? 'No IAI soldiers registered yet. Install and authenticate the extension to see soldiers here.'
                    : `No soldiers with status "${statusFilter}"`}
                </p>
                {statusFilter === 'all' && (
                  <div className="bg-slate-700/50 rounded-lg p-4 mt-4 border border-slate-600">
                    <p className="text-slate-300 text-sm mb-3">
                      <strong>💡 Using USM (Ultra Speed Mode)?</strong>
                    </p>
                    <p className="text-slate-400 text-sm mb-3">
                      USM instances run through the <strong>IAI Factory</strong> panel, not here.
                      The Soldiers tab is for browser extension-based automation.
                    </p>
                    <button
                      onClick={() => setActiveTab('factory')}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Cpu className="w-4 h-4 inline mr-2" />
                      Go to IAI Factory
                    </button>
                  </div>
                )}
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
        ) : activeTab === 'factory' ? (
          <IAIFactoryControlPanel />
        ) : (
          <IAIPrototypePanel />
        )}
        </div>
      </div>
    </div>
  );
}
