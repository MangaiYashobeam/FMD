/**
 * Abstraction Center - Unified IAI Extension & Nova Soldiers Dashboard
 * =====================================================================
 * 
 * Production-grade monitoring and control center for:
 * - IAI Extension (Chrome/Chromium instances)
 * - Nova Soldiers (Python browser workers)
 * - Session synchronization
 * - Task coordination
 * 
 * Features:
 * - Real-time status monitoring
 * - Comprehensive analytics
 * - Clickable items with detailed modals
 * - Ticket system for issue tracking
 * - Live logs viewer
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  Chrome,
  Server,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Cpu,
  HardDrive,
  MemoryStick,
  Globe,
  Zap,
  BarChart3,
  Eye,
  Terminal,
  FileText,
  Plus,
  Filter,
  Download,
  Search,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MapPin,
  Shield,
  KeyRound,
  Link2,
  Unlink,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  X,
  Send,
  MessageSquare,
  Bug,
  Settings2,
  Users,
  Hash,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface ExtensionInstance {
  id: string;
  instanceId: string;
  accountId: string;
  userId: string;
  userEmail: string;
  browserId: string;
  extensionVersion: string;
  status: 'online' | 'offline' | 'working' | 'idle' | 'error';
  lastHeartbeat: string | null;
  tasksCompleted: number;
  tasksFailed: number;
  successRate: number;
  currentTask: string | null;
  sessionStatus: 'active' | 'expired' | 'none';
  sessionExpiresAt: string | null;
  has2FA: boolean;
  createdAt: string;
  location?: {
    city: string | null;
    country: string | null;
    ip: string | null;
  };
}

interface ExtensionStats {
  totalInstances: number;
  onlineInstances: number;
  offlineInstances: number;
  tasksToday: number;
  tasksThisWeek: number;
  failedTasksThisWeek: number;
  successRate: number;
  activityBreakdown: Record<string, number>;
  activeSessions: number;
  sessionsExpiringSoon: number;
  instancesWith2FA: number;
}

interface NovaWorker {
  id: string;
  workerId: string;
  status: 'healthy' | 'unhealthy' | 'starting' | 'stopped';
  activeSessions: number;
  maxSessions: number;
  memoryUsage: string;
  cpuUsage: string;
  uptime: string;
  lastHeartbeat: string;
  tasksProcessed: number;
  tasksFailed: number;
  avgTaskDuration: number;
}

interface NovaSession {
  sessionId: string;
  browserId: string;
  accountId: string;
  accountName: string;
  status: 'ready' | 'busy' | 'error' | 'closed';
  currentUrl: string | null;
  pageTitle: string | null;
  createdAt: string;
  lastActivity: string;
  taskCount: number;
  errorCount: number;
  screenshots: number;
}

interface NovaStats {
  workers: {
    totalWorkers: number;
    healthyWorkers: number;
    totalCapacity: number;
    usedCapacity: number;
  };
  sessions: {
    active: number;
    idle: number;
    total: number;
  };
  tasks: {
    today: number;
    thisWeek: number;
    failed: number;
    successRate: number;
  };
  uptime: string;
  avgResponseTime: string;
  memoryUsage: string;
  cpuUsage: string;
}

interface NovaLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source: string;
  metadata?: any;
}

interface NovaTicket {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  workerId?: string;
  sessionId?: string;
  createdAt: string;
  createdBy: string;
}

interface ExtensionActivity {
  id: string;
  soldierId: string;
  soldier?: {
    soldierId: string;
    account?: {
      name: string;
      dealershipName: string;
    };
  };
  eventType: string;
  message: string;
  eventData?: any;
  createdAt: string;
}

// ============================================
// API Functions
// ============================================

const fetchExtensionInstances = async (): Promise<{ data: ExtensionInstance[]; total: number; online: number; offline: number }> => {
  const res = await fetch('/api/abstraction/extension/instances', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch extension instances');
  return res.json().then(r => r);
};

const fetchExtensionStats = async (): Promise<ExtensionStats> => {
  const res = await fetch('/api/abstraction/extension/stats', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch extension stats');
  return res.json().then(r => r.data);
};

const fetchExtensionActivities = async (page = 1, limit = 50): Promise<{ data: ExtensionActivity[]; pagination: any }> => {
  const res = await fetch(`/api/abstraction/extension/activities?page=${page}&limit=${limit}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch extension activities');
  return res.json();
};

const fetchNovaWorkers = async (): Promise<{ data: NovaWorker[]; total: number; healthy: number; unhealthy: number }> => {
  const res = await fetch('/api/abstraction/nova/workers', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch Nova workers');
  return res.json();
};

const fetchNovaSessions = async (): Promise<{ data: NovaSession[]; total: number; active: number }> => {
  const res = await fetch('/api/abstraction/nova/sessions', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch Nova sessions');
  return res.json();
};

const fetchNovaStats = async (): Promise<NovaStats> => {
  const res = await fetch('/api/abstraction/nova/stats', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch Nova stats');
  return res.json().then(r => r.data);
};

const fetchNovaLogs = async (page = 1, limit = 100, level?: string): Promise<{ data: NovaLog[]; pagination: any }> => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (level) params.append('level', level);
  const res = await fetch(`/api/abstraction/nova/logs?${params}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch Nova logs');
  return res.json();
};

const fetchNovaTickets = async (): Promise<{ data: NovaTicket[] }> => {
  const res = await fetch('/api/abstraction/nova/tickets', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch Nova tickets');
  return res.json();
};

const createNovaTicket = async (ticket: Partial<NovaTicket>): Promise<{ ticketId: string }> => {
  const res = await fetch('/api/abstraction/nova/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(ticket),
  });
  if (!res.ok) throw new Error('Failed to create ticket');
  return res.json().then(r => r.data);
};

// ============================================
// Utility Functions
// ============================================

const formatDate = (date: string | null | undefined): string => {
  if (!date) return 'Never';
  const d = new Date(date);
  return d.toLocaleString();
};

const formatRelativeTime = (date: string | null | undefined): string => {
  if (!date) return 'Never';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'online':
    case 'healthy':
    case 'active':
    case 'ready':
      return 'text-green-400';
    case 'working':
    case 'busy':
    case 'starting':
    case 'in-progress':
      return 'text-yellow-400';
    case 'offline':
    case 'stopped':
    case 'closed':
    case 'expired':
      return 'text-gray-400';
    case 'error':
    case 'unhealthy':
    case 'critical':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
};

const getStatusBgColor = (status: string): string => {
  switch (status) {
    case 'online':
    case 'healthy':
    case 'active':
    case 'ready':
      return 'bg-green-500/20 border-green-500/30';
    case 'working':
    case 'busy':
    case 'starting':
    case 'in-progress':
      return 'bg-yellow-500/20 border-yellow-500/30';
    case 'offline':
    case 'stopped':
    case 'closed':
    case 'expired':
      return 'bg-gray-500/20 border-gray-500/30';
    case 'error':
    case 'unhealthy':
    case 'critical':
      return 'bg-red-500/20 border-red-500/30';
    default:
      return 'bg-gray-500/20 border-gray-500/30';
  }
};

// ============================================
// Components
// ============================================

// Stats Card Component
const StatsCard = ({ 
  icon: Icon, 
  label, 
  value, 
  subValue, 
  color = 'blue',
  onClick,
}: { 
  icon: any; 
  label: string; 
  value: string | number; 
  subValue?: string; 
  color?: string;
  onClick?: () => void;
}) => {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  };

  return (
    <div 
      className={`bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 ${onClick ? 'cursor-pointer hover:bg-gray-800/70 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg border ${colorClasses[color] || colorClasses.blue}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-gray-400 text-sm">{label}</p>
          <p className="text-white text-xl font-bold">{value}</p>
          {subValue && <p className="text-gray-500 text-xs">{subValue}</p>}
        </div>
      </div>
    </div>
  );
};

// Extension Instance Card
const ExtensionInstanceCard = ({ instance, onClick }: { instance: ExtensionInstance; onClick: () => void }) => {
  const statusIcon = {
    online: <CheckCircle2 className="w-4 h-4 text-green-400" />,
    offline: <XCircle className="w-4 h-4 text-gray-400" />,
    working: <Activity className="w-4 h-4 text-yellow-400 animate-pulse" />,
    idle: <Clock className="w-4 h-4 text-blue-400" />,
    error: <AlertTriangle className="w-4 h-4 text-red-400" />,
  };

  return (
    <div 
      className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 hover:border-gray-600 cursor-pointer transition-all"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg border ${getStatusBgColor(instance.status)}`}>
            <Chrome className="w-5 h-5 text-gray-300" />
          </div>
          <div>
            <p className="text-white font-medium truncate max-w-[150px]">{instance.instanceId.slice(0, 12)}...</p>
            <p className="text-gray-500 text-xs">{instance.userEmail}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {statusIcon[instance.status] || statusIcon.offline}
          <span className={`text-xs capitalize ${getStatusColor(instance.status)}`}>{instance.status}</span>
        </div>
      </div>
      
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-500">Tasks:</span>
          <span className="text-white ml-1">{instance.tasksCompleted} / {instance.tasksFailed} fail</span>
        </div>
        <div>
          <span className="text-gray-500">Rate:</span>
          <span className={`ml-1 ${instance.successRate >= 90 ? 'text-green-400' : instance.successRate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
            {instance.successRate.toFixed(1)}%
          </span>
        </div>
        <div className="col-span-2">
          <span className="text-gray-500">Last seen:</span>
          <span className="text-gray-300 ml-1">{formatRelativeTime(instance.lastHeartbeat)}</span>
        </div>
      </div>

      {instance.currentTask && (
        <div className="mt-2 p-2 bg-yellow-500/10 rounded border border-yellow-500/20">
          <p className="text-yellow-400 text-xs truncate">
            <Zap className="w-3 h-3 inline mr-1" />
            {instance.currentTask}
          </p>
        </div>
      )}
    </div>
  );
};

// Nova Worker Card
const NovaWorkerCard = ({ worker, onClick }: { worker: NovaWorker; onClick: () => void }) => {
  return (
    <div 
      className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 hover:border-gray-600 cursor-pointer transition-all"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg border ${getStatusBgColor(worker.status)}`}>
            <Server className="w-5 h-5 text-gray-300" />
          </div>
          <div>
            <p className="text-white font-medium">{worker.workerId}</p>
            <p className="text-gray-500 text-xs">Uptime: {worker.uptime}</p>
          </div>
        </div>
        <div className={`px-2 py-1 rounded text-xs ${getStatusBgColor(worker.status)}`}>
          <span className={getStatusColor(worker.status)}>{worker.status}</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3 text-gray-500" />
          <span className="text-gray-400">Sessions:</span>
          <span className="text-white">{worker.activeSessions}/{worker.maxSessions}</span>
        </div>
        <div className="flex items-center gap-1">
          <MemoryStick className="w-3 h-3 text-gray-500" />
          <span className="text-gray-400">RAM:</span>
          <span className="text-white">{worker.memoryUsage}</span>
        </div>
        <div className="flex items-center gap-1">
          <Cpu className="w-3 h-3 text-gray-500" />
          <span className="text-gray-400">CPU:</span>
          <span className="text-white">{worker.cpuUsage}</span>
        </div>
        <div className="flex items-center gap-1">
          <Activity className="w-3 h-3 text-gray-500" />
          <span className="text-gray-400">Tasks:</span>
          <span className="text-white">{worker.tasksProcessed}</span>
        </div>
      </div>

      {/* Capacity bar */}
      <div className="mt-3">
        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all ${
              (worker.activeSessions / worker.maxSessions) > 0.8 ? 'bg-red-500' : 
              (worker.activeSessions / worker.maxSessions) > 0.5 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${(worker.activeSessions / worker.maxSessions) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

// Nova Session Card
const NovaSessionCard = ({ session, onClick }: { session: NovaSession; onClick: () => void }) => {
  return (
    <div 
      className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50 hover:border-gray-600 cursor-pointer transition-all"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            session.status === 'ready' ? 'bg-green-400' :
            session.status === 'busy' ? 'bg-yellow-400 animate-pulse' :
            session.status === 'error' ? 'bg-red-400' : 'bg-gray-400'
          }`} />
          <span className="text-white text-sm font-mono truncate max-w-[120px]">{session.sessionId.slice(0, 10)}...</span>
        </div>
        <span className={`text-xs ${getStatusColor(session.status)}`}>{session.status}</span>
      </div>
      {session.currentUrl && (
        <p className="text-gray-500 text-xs mt-1 truncate">
          <Globe className="w-3 h-3 inline mr-1" />
          {session.currentUrl}
        </p>
      )}
    </div>
  );
};

// Activity Log Item
const ActivityLogItem = ({ activity }: { activity: ExtensionActivity }) => {
  const getEventIcon = (type: string) => {
    if (type.includes('task')) return <Zap className="w-3 h-3" />;
    if (type.includes('error')) return <AlertTriangle className="w-3 h-3" />;
    if (type.includes('login') || type.includes('session')) return <KeyRound className="w-3 h-3" />;
    return <Activity className="w-3 h-3" />;
  };

  return (
    <div className="flex items-start gap-3 p-2 hover:bg-gray-800/30 rounded">
      <div className={`p-1.5 rounded ${
        activity.eventType.includes('error') ? 'bg-red-500/20 text-red-400' :
        activity.eventType.includes('success') ? 'bg-green-500/20 text-green-400' :
        'bg-gray-500/20 text-gray-400'
      }`}>
        {getEventIcon(activity.eventType)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm">{activity.message || activity.eventType}</p>
        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
          <span>{activity.soldier?.soldierId?.slice(0, 8) || 'Unknown'}</span>
          <span>•</span>
          <span>{formatRelativeTime(activity.createdAt)}</span>
        </div>
      </div>
    </div>
  );
};

// Log Entry
const LogEntry = ({ log }: { log: NovaLog }) => {
  const levelColors: Record<string, string> = {
    info: 'text-blue-400 bg-blue-500/20',
    warn: 'text-yellow-400 bg-yellow-500/20',
    error: 'text-red-400 bg-red-500/20',
    debug: 'text-gray-400 bg-gray-500/20',
  };

  return (
    <div className="flex items-start gap-2 font-mono text-xs hover:bg-gray-800/30 p-1 rounded">
      <span className="text-gray-500 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
      <span className={`px-1.5 py-0.5 rounded uppercase ${levelColors[log.level] || levelColors.info}`}>
        {log.level}
      </span>
      <span className="text-gray-300 break-all">{log.message}</span>
    </div>
  );
};

// Ticket Card
const TicketCard = ({ ticket, onClick }: { ticket: NovaTicket; onClick: () => void }) => {
  const priorityColors: Record<string, string> = {
    low: 'bg-gray-500/20 text-gray-400',
    medium: 'bg-blue-500/20 text-blue-400',
    high: 'bg-yellow-500/20 text-yellow-400',
    critical: 'bg-red-500/20 text-red-400',
  };

  return (
    <div 
      className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50 hover:border-gray-600 cursor-pointer transition-all"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-white font-medium">{ticket.title}</p>
          <p className="text-gray-500 text-xs mt-1 line-clamp-2">{ticket.description}</p>
        </div>
        <span className={`px-2 py-0.5 rounded text-xs shrink-0 ml-2 ${priorityColors[ticket.priority]}`}>
          {ticket.priority}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Hash className="w-3 h-3" />
          {ticket.id.slice(0, 8)}
        </span>
        <span>{formatRelativeTime(ticket.createdAt)}</span>
        <span className={`px-1.5 py-0.5 rounded ${getStatusBgColor(ticket.status)}`}>{ticket.status}</span>
      </div>
    </div>
  );
};

// Instance Detail Modal
const InstanceDetailModal = ({ 
  instance, 
  onClose 
}: { 
  instance: ExtensionInstance; 
  onClose: () => void;
}) => {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg border ${getStatusBgColor(instance.status)}`}>
              <Chrome className="w-6 h-6 text-gray-300" />
            </div>
            <div>
              <h3 className="text-white font-bold">Extension Instance</h3>
              <p className="text-gray-500 text-sm font-mono">{instance.instanceId}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Status Banner */}
          <div className={`p-3 rounded-lg border ${getStatusBgColor(instance.status)}`}>
            <div className="flex items-center justify-between">
              <span className={`font-medium capitalize ${getStatusColor(instance.status)}`}>
                Status: {instance.status}
              </span>
              <span className="text-gray-400 text-sm">
                Last seen: {formatRelativeTime(instance.lastHeartbeat)}
              </span>
            </div>
            {instance.currentTask && (
              <p className="text-yellow-400 text-sm mt-2">
                <Zap className="w-4 h-4 inline mr-1" />
                Current task: {instance.currentTask}
              </p>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-gray-500 text-xs mb-1">Account ID</p>
              <p className="text-white font-mono text-sm">{instance.accountId}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-gray-500 text-xs mb-1">User Email</p>
              <p className="text-white text-sm">{instance.userEmail}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-gray-500 text-xs mb-1">Browser ID</p>
              <p className="text-white font-mono text-sm">{instance.browserId || 'N/A'}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-gray-500 text-xs mb-1">Extension Version</p>
              <p className="text-white text-sm">{instance.extensionVersion}</p>
            </div>
          </div>

          {/* Performance Stats */}
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h4 className="text-white font-medium mb-3">Performance</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">{instance.tasksCompleted}</p>
                <p className="text-gray-500 text-xs">Completed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-400">{instance.tasksFailed}</p>
                <p className="text-gray-500 text-xs">Failed</p>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-bold ${
                  instance.successRate >= 90 ? 'text-green-400' : 
                  instance.successRate >= 70 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {instance.successRate.toFixed(1)}%
                </p>
                <p className="text-gray-500 text-xs">Success Rate</p>
              </div>
            </div>
          </div>

          {/* Session Info */}
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h4 className="text-white font-medium mb-3">Session Status</h4>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {instance.sessionStatus === 'active' ? (
                  <Link2 className="w-4 h-4 text-green-400" />
                ) : (
                  <Unlink className="w-4 h-4 text-gray-400" />
                )}
                <span className={`capitalize ${getStatusColor(instance.sessionStatus)}`}>
                  {instance.sessionStatus}
                </span>
              </div>
              {instance.has2FA && (
                <span className="flex items-center gap-1 text-purple-400 text-sm">
                  <Shield className="w-4 h-4" />
                  2FA Enabled
                </span>
              )}
            </div>
            {instance.sessionExpiresAt && (
              <p className="text-gray-500 text-sm mt-2">
                Expires: {formatDate(instance.sessionExpiresAt)}
              </p>
            )}
          </div>

          {/* Location */}
          {instance.location?.ip && (
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Location
              </h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">IP Address</p>
                  <p className="text-white font-mono">{instance.location.ip}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">City</p>
                  <p className="text-white">{instance.location.city || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Country</p>
                  <p className="text-white">{instance.location.country || 'Unknown'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Created At */}
          <div className="text-gray-500 text-xs">
            Created: {formatDate(instance.createdAt)}
          </div>
        </div>
      </div>
    </div>
  );
};

// Worker Detail Modal
const WorkerDetailModal = ({ 
  worker, 
  onClose 
}: { 
  worker: NovaWorker; 
  onClose: () => void;
}) => {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg border ${getStatusBgColor(worker.status)}`}>
              <Server className="w-6 h-6 text-gray-300" />
            </div>
            <div>
              <h3 className="text-white font-bold">Nova Worker</h3>
              <p className="text-gray-500 text-sm">{worker.workerId}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Status Banner */}
          <div className={`p-3 rounded-lg border ${getStatusBgColor(worker.status)}`}>
            <div className="flex items-center justify-between">
              <span className={`font-medium capitalize ${getStatusColor(worker.status)}`}>
                Status: {worker.status}
              </span>
              <span className="text-gray-400 text-sm">
                Uptime: {worker.uptime}
              </span>
            </div>
          </div>

          {/* Resource Usage */}
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h4 className="text-white font-medium mb-3">Resource Usage</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-500 text-sm flex items-center gap-1">
                    <Cpu className="w-4 h-4" /> CPU
                  </span>
                  <span className="text-white">{worker.cpuUsage}</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-cyan-500 transition-all"
                    style={{ width: worker.cpuUsage }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-500 text-sm flex items-center gap-1">
                    <MemoryStick className="w-4 h-4" /> Memory
                  </span>
                  <span className="text-white">{worker.memoryUsage}</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 transition-all"
                    style={{ width: '30%' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Session Capacity */}
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h4 className="text-white font-medium mb-3">Session Capacity</h4>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400">
                {worker.activeSessions} / {worker.maxSessions} sessions
              </span>
              <span className={
                (worker.activeSessions / worker.maxSessions) > 0.8 ? 'text-red-400' :
                (worker.activeSessions / worker.maxSessions) > 0.5 ? 'text-yellow-400' : 'text-green-400'
              }>
                {((worker.activeSessions / worker.maxSessions) * 100).toFixed(0)}% used
              </span>
            </div>
            <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${
                  (worker.activeSessions / worker.maxSessions) > 0.8 ? 'bg-red-500' :
                  (worker.activeSessions / worker.maxSessions) > 0.5 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${(worker.activeSessions / worker.maxSessions) * 100}%` }}
              />
            </div>
          </div>

          {/* Task Stats */}
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h4 className="text-white font-medium mb-3">Task Statistics</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-400">{worker.tasksProcessed}</p>
                <p className="text-gray-500 text-xs">Processed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-400">{worker.tasksFailed}</p>
                <p className="text-gray-500 text-xs">Failed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-cyan-400">{worker.avgTaskDuration}s</p>
                <p className="text-gray-500 text-xs">Avg Duration</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button className="flex-1 flex items-center justify-center gap-2 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-white transition-colors">
              <RotateCcw className="w-4 h-4" />
              Restart Worker
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors">
              <Terminal className="w-4 h-4" />
              View Logs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Create Ticket Modal
const CreateTicketModal = ({ 
  onClose, 
  onSubmit,
  workerId,
  sessionId,
}: { 
  onClose: () => void;
  onSubmit: (ticket: Partial<NovaTicket>) => void;
  workerId?: string;
  sessionId?: string;
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [category, setCategory] = useState('general');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      description,
      priority,
      category,
      workerId,
      sessionId,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 max-w-lg w-full">
        <div className="border-b border-gray-700 p-4 flex items-center justify-between">
          <h3 className="text-white font-bold flex items-center gap-2">
            <Bug className="w-5 h-5" />
            Create Support Ticket
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder="Brief description of the issue"
              required
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 min-h-[100px]"
              placeholder="Detailed description of the issue..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="general">General</option>
                <option value="session">Session Issue</option>
                <option value="worker">Worker Issue</option>
                <option value="task">Task Failure</option>
                <option value="performance">Performance</option>
                <option value="integration">Integration</option>
              </select>
            </div>
          </div>

          {(workerId || sessionId) && (
            <div className="bg-gray-800/50 rounded-lg p-3 text-sm">
              {workerId && (
                <p className="text-gray-400">
                  Worker: <span className="text-white font-mono">{workerId}</span>
                </p>
              )}
              {sessionId && (
                <p className="text-gray-400">
                  Session: <span className="text-white font-mono">{sessionId}</span>
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              Submit Ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// Main Dashboard Tabs
// ============================================

// IAI Extension Dashboard Tab
const IAIExtensionDashboard = () => {
  const [selectedInstance, setSelectedInstance] = useState<ExtensionInstance | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: instancesData, isLoading: loadingInstances, refetch: refetchInstances } = useQuery({
    queryKey: ['abstraction-extension-instances'],
    queryFn: fetchExtensionInstances,
    refetchInterval: 30000,
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['abstraction-extension-stats'],
    queryFn: fetchExtensionStats,
    refetchInterval: 30000,
  });

  const { data: activitiesData } = useQuery({
    queryKey: ['abstraction-extension-activities'],
    queryFn: () => fetchExtensionActivities(1, 20),
    refetchInterval: 15000,
  });

  const filteredInstances = instancesData?.data?.filter(instance => {
    const matchesSearch = 
      instance.instanceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      instance.userEmail.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || instance.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatsCard
          icon={Chrome}
          label="Total Instances"
          value={stats?.totalInstances || 0}
          color="blue"
        />
        <StatsCard
          icon={CheckCircle2}
          label="Online"
          value={stats?.onlineInstances || 0}
          subValue={`${stats?.offlineInstances || 0} offline`}
          color="green"
        />
        <StatsCard
          icon={Zap}
          label="Tasks Today"
          value={stats?.tasksToday || 0}
          subValue={`${stats?.tasksThisWeek || 0} this week`}
          color="yellow"
        />
        <StatsCard
          icon={XCircle}
          label="Failed"
          value={stats?.failedTasksThisWeek || 0}
          subValue="this week"
          color="red"
        />
        <StatsCard
          icon={Activity}
          label="Success Rate"
          value={`${stats?.successRate || 100}%`}
          color={stats?.successRate && stats.successRate < 90 ? 'yellow' : 'green'}
        />
        <StatsCard
          icon={Link2}
          label="Active Sessions"
          value={stats?.activeSessions || 0}
          subValue={stats?.sessionsExpiringSoon ? `${stats.sessionsExpiringSoon} expiring` : undefined}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Instances List */}
        <div className="lg:col-span-2 bg-gray-800/30 rounded-xl border border-gray-700/50 overflow-hidden">
          <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
            <h3 className="text-white font-medium flex items-center gap-2">
              <Chrome className="w-5 h-5" />
              Extension Instances
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 w-40"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="working">Working</option>
                <option value="error">Error</option>
              </select>
              <button
                onClick={() => refetchInstances()}
                className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-4 max-h-[500px] overflow-y-auto">
            {loadingInstances ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
              </div>
            ) : filteredInstances.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Chrome className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No extension instances found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredInstances.map(instance => (
                  <ExtensionInstanceCard
                    key={instance.id}
                    instance={instance}
                    onClick={() => setSelectedInstance(instance)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-gray-800/30 rounded-xl border border-gray-700/50 overflow-hidden">
          <div className="p-4 border-b border-gray-700/50">
            <h3 className="text-white font-medium flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Recent Activity
            </h3>
          </div>
          <div className="p-2 max-h-[500px] overflow-y-auto">
            {activitiesData?.data?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No recent activity</p>
              </div>
            ) : (
              <div className="space-y-1">
                {activitiesData?.data?.map(activity => (
                  <ActivityLogItem key={activity.id} activity={activity} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Instance Detail Modal */}
      {selectedInstance && (
        <InstanceDetailModal
          instance={selectedInstance}
          onClose={() => setSelectedInstance(null)}
        />
      )}
    </div>
  );
};

// Nova Soldiers Dashboard Tab
const NovaSoldiersDashboard = () => {
  const queryClient = useQueryClient();
  const [selectedWorker, setSelectedWorker] = useState<NovaWorker | null>(null);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [logLevel, setLogLevel] = useState<string>('');
  const [ticketContext, setTicketContext] = useState<{ workerId?: string; sessionId?: string }>({});

  const { data: workersData, isLoading: loadingWorkers, refetch: refetchWorkers } = useQuery({
    queryKey: ['abstraction-nova-workers'],
    queryFn: fetchNovaWorkers,
    refetchInterval: 10000,
  });

  const { data: sessionsData, isLoading: loadingSessions } = useQuery({
    queryKey: ['abstraction-nova-sessions'],
    queryFn: fetchNovaSessions,
    refetchInterval: 10000,
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['abstraction-nova-stats'],
    queryFn: fetchNovaStats,
    refetchInterval: 15000,
  });

  const { data: logsData, refetch: refetchLogs } = useQuery({
    queryKey: ['abstraction-nova-logs', logLevel],
    queryFn: () => fetchNovaLogs(1, 100, logLevel || undefined),
    refetchInterval: 5000,
  });

  const { data: ticketsData, refetch: refetchTickets } = useQuery({
    queryKey: ['abstraction-nova-tickets'],
    queryFn: fetchNovaTickets,
  });

  const createTicketMutation = useMutation({
    mutationFn: createNovaTicket,
    onSuccess: () => {
      refetchTickets();
      setShowCreateTicket(false);
    },
  });

  const handleCreateTicket = (workerId?: string, sessionId?: string) => {
    setTicketContext({ workerId, sessionId });
    setShowCreateTicket(true);
  };

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatsCard
          icon={Server}
          label="Workers"
          value={`${stats?.workers.healthyWorkers || 0}/${stats?.workers.totalWorkers || 0}`}
          subValue="healthy"
          color="green"
        />
        <StatsCard
          icon={Users}
          label="Sessions"
          value={stats?.sessions.active || 0}
          subValue={`${stats?.workers.totalCapacity || 0} capacity`}
          color="blue"
        />
        <StatsCard
          icon={Zap}
          label="Tasks Today"
          value={stats?.tasks.today || 0}
          subValue={`${stats?.tasks.thisWeek || 0} this week`}
          color="yellow"
        />
        <StatsCard
          icon={XCircle}
          label="Failed"
          value={stats?.tasks.failed || 0}
          color="red"
        />
        <StatsCard
          icon={Clock}
          label="Avg Response"
          value={stats?.avgResponseTime || '0s'}
          color="cyan"
        />
        <StatsCard
          icon={MemoryStick}
          label="Memory"
          value={stats?.memoryUsage || '0 MB'}
          subValue={`CPU: ${stats?.cpuUsage || '0%'}`}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workers & Sessions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Workers */}
          <div className="bg-gray-800/30 rounded-xl border border-gray-700/50 overflow-hidden">
            <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
              <h3 className="text-white font-medium flex items-center gap-2">
                <Server className="w-5 h-5" />
                Browser Workers
              </h3>
              <button
                onClick={() => refetchWorkers()}
                className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              {loadingWorkers ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
                </div>
              ) : workersData?.data?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Server className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No workers running</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {workersData?.data?.map(worker => (
                    <NovaWorkerCard
                      key={worker.id}
                      worker={worker}
                      onClick={() => setSelectedWorker(worker)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sessions */}
          <div className="bg-gray-800/30 rounded-xl border border-gray-700/50 overflow-hidden">
            <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
              <h3 className="text-white font-medium flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Active Sessions
                <span className="text-gray-500 text-sm">({sessionsData?.total || 0})</span>
              </h3>
            </div>
            <div className="p-4 max-h-[250px] overflow-y-auto">
              {loadingSessions ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="w-5 h-5 text-gray-500 animate-spin" />
                </div>
              ) : sessionsData?.data?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Globe className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No active sessions</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {sessionsData?.data?.map(session => (
                    <NovaSessionCard
                      key={session.sessionId}
                      session={session}
                      onClick={() => handleCreateTicket(undefined, session.sessionId)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar: Logs & Tickets */}
        <div className="space-y-6">
          {/* Tickets */}
          <div className="bg-gray-800/30 rounded-xl border border-gray-700/50 overflow-hidden">
            <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
              <h3 className="text-white font-medium flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Support Tickets
              </h3>
              <button
                onClick={() => handleCreateTicket()}
                className="p-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 max-h-[200px] overflow-y-auto">
              {ticketsData?.data?.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No open tickets
                </div>
              ) : (
                <div className="space-y-2">
                  {ticketsData?.data?.slice(0, 5).map(ticket => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      onClick={() => {}}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Logs */}
          <div className="bg-gray-800/30 rounded-xl border border-gray-700/50 overflow-hidden">
            <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
              <h3 className="text-white font-medium flex items-center gap-2">
                <Terminal className="w-5 h-5" />
                Live Logs
              </h3>
              <div className="flex items-center gap-2">
                <select
                  value={logLevel}
                  onChange={(e) => setLogLevel(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
                >
                  <option value="">All Levels</option>
                  <option value="info">Info</option>
                  <option value="warn">Warn</option>
                  <option value="error">Error</option>
                  <option value="debug">Debug</option>
                </select>
                <button
                  onClick={() => refetchLogs()}
                  className="p-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-400 hover:text-white transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="p-2 max-h-[300px] overflow-y-auto bg-gray-900/50">
              {logsData?.data?.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No logs available
                </div>
              ) : (
                <div className="space-y-1">
                  {logsData?.data?.map((log, i) => (
                    <LogEntry key={i} log={log} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Worker Detail Modal */}
      {selectedWorker && (
        <WorkerDetailModal
          worker={selectedWorker}
          onClose={() => setSelectedWorker(null)}
        />
      )}

      {/* Create Ticket Modal */}
      {showCreateTicket && (
        <CreateTicketModal
          onClose={() => setShowCreateTicket(false)}
          onSubmit={(ticket) => createTicketMutation.mutate(ticket)}
          workerId={ticketContext.workerId}
          sessionId={ticketContext.sessionId}
        />
      )}
    </div>
  );
};

// ============================================
// Main Component
// ============================================

export default function AbstractionCenterPage() {
  const [activeTab, setActiveTab] = useState<'extension' | 'nova'>('extension');

  // Auto-refresh timestamp
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Abstraction Center</h1>
                <p className="text-gray-500 text-sm">Unified IAI Extension & Nova Soldiers Control</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-gray-500 text-xs">
                Last refresh: {lastRefresh.toLocaleTimeString()}
              </div>
              <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('extension')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'extension'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  <Chrome className="w-4 h-4" />
                  IAI Extension
                </button>
                <button
                  onClick={() => setActiveTab('nova')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'nova'
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  <Server className="w-4 h-4" />
                  Nova Soldiers
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'extension' ? <IAIExtensionDashboard /> : <NovaSoldiersDashboard />}
      </div>
    </div>
  );
}
