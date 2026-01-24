/**
 * Session Analytics Dashboard
 * 
 * Comprehensive dashboard for user sessions, visitor analytics,
 * IP intelligence, and bot detection
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Activity,
  Eye,
  Globe,
  Bot,
  Shield,
  Flame,
  TrendingUp,
  Clock,
  MapPin,
  Monitor,
  Smartphone,
  Tablet,
  Chrome,
  Laptop,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Ban,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Download,
  Zap,
  UserCheck,
  UserX,
  Skull,
  Radio,
  Thermometer,
  Target,
  History,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import api from '../../lib/api';

// Types
interface SessionStats {
  overview: {
    activeSessions: number;
    sessionsToday: number;
    sessionsWeek: number;
    sessionsMonth: number;
    avgDuration: number;
    uniqueUsersMonth: number;
  };
  distribution: {
    byDevice: Record<string, number>;
    byCountry: { country: string; count: number }[];
    byBrowser: { browser: string; count: number }[];
  };
}

interface UserSession {
  id: string;
  userId: string;
  sessionToken: string;
  ipAddress: string;
  userAgent: string;
  deviceType: string;
  browser: string;
  os: string;
  loginAt: string;
  lastActiveAt: string;
  logoutAt: string | null;
  duration: number | null;
  isActive: boolean;
  loginMethod: string;
  botScore: number;
  threatLevel: string;
  country: string;
  city: string;
  user?: {
    email: string;
    firstName: string;
    lastName: string;
    role?: string;
  };
}

interface VisitorAnalytics {
  totalVisitors: number;
  byType: Record<string, number>;
  potentialUsers: number;
  confirmedBots: number;
  heatDistribution: { range: string; count: number }[];
  recentVisitors: Visitor[];
  conversionRate: number;
}

interface Visitor {
  id: string;
  fingerprint: string;
  visitCount: number;
  heatScore: number;
  visitorType: string;
  potentialUser: boolean;
  potentialScore: number;
  lastIpAddress: string;
  lastCountry: string;
  lastCity: string;
  isBotConfirmed: boolean;
  botName: string | null;
  firstVisitAt: string;
  lastVisitAt: string;
}

interface IPSummary {
  totalIPs: number;
  blockedIPs: number;
  bots: { confirmed: number; suspected: number };
  threatLevels: Record<string, number>;
  topCountries: { country: string; count: number }[];
  recentActivity: IPRecord[];
}

interface IPRecord {
  ipAddress: string;
  country: string;
  city: string;
  threatScore: number;
  threatLevel: string;
  isBotConfirmed: boolean;
  botName: string | null;
  isBlocked: boolean;
  totalRequests: number;
  lastRequestAt: string;
}

interface UserAnalytics {
  overview: {
    totalUsers: number;
    activeToday: number;
    activeWeek: number;
  };
  byRole: Record<string, number>;
  heatDistribution: { range: string; count: number }[];
  topUsers: TopUser[];
}

interface TopUser {
  id: string;
  email: string;
  name: string;
  role: string;
  heatScore: number;
  loginCount: number;
  lastLoginAt: string;
  lastActiveAt: string;
}

interface AdminLogin {
  id: string;
  userId: string;
  email: string;
  role: string;
  ipAddress: string;
  userAgent: string;
  loginMethod: string;
  success: boolean;
  failureReason: string | null;
  country: string;
  city: string;
  suspicious: boolean;
  suspiciousReasons: string[];
  timestamp: string;
}

// Helper functions
const formatDuration = (seconds: number | null): string => {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
};

const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

const getHeatColor = (score: number): string => {
  if (score >= 80) return 'text-red-500 bg-red-500/20';
  if (score >= 60) return 'text-orange-500 bg-orange-500/20';
  if (score >= 40) return 'text-yellow-500 bg-yellow-500/20';
  if (score >= 20) return 'text-blue-500 bg-blue-500/20';
  return 'text-gray-500 bg-gray-500/20';
};

const getThreatColor = (level: string): string => {
  switch (level) {
    case 'CRITICAL': return 'text-red-500 bg-red-500/20';
    case 'HIGH': return 'text-orange-500 bg-orange-500/20';
    case 'MEDIUM': return 'text-yellow-500 bg-yellow-500/20';
    case 'LOW': return 'text-blue-500 bg-blue-500/20';
    default: return 'text-green-500 bg-green-500/20';
  }
};

const getDeviceIcon = (type: string | null) => {
  switch (type?.toLowerCase()) {
    case 'mobile': return Smartphone;
    case 'tablet': return Tablet;
    default: return Monitor;
  }
};

// API calls
const sessionAnalyticsApi = {
  getSessionStats: () => api.get<{ data: SessionStats }>('/session-analytics/sessions/stats').then(r => r.data.data),
  getActiveSessions: () => api.get<{ data: UserSession[] }>('/session-analytics/sessions/active').then(r => r.data.data),
  getSessionHistory: (params: any) => api.get<{ data: UserSession[]; pagination: any }>('/session-analytics/sessions/history', { params }).then(r => r.data),
  terminateSession: (sessionId: string) => api.post(`/session-analytics/sessions/${sessionId}/terminate`),
  getVisitorAnalytics: () => api.get<{ data: VisitorAnalytics }>('/session-analytics/visitors/analytics').then(r => r.data.data),
  getVisitors: (params: any) => api.get<{ data: Visitor[]; pagination: any }>('/session-analytics/visitors', { params }).then(r => r.data),
  getIPSummary: () => api.get<{ data: IPSummary }>('/session-analytics/ip/summary').then(r => r.data.data),
  getIPList: (params: any) => api.get<{ data: IPRecord[]; pagination: any }>('/session-analytics/ip/list', { params }).then(r => r.data),
  blockIP: (ipAddress: string, reason?: string) => api.post('/session-analytics/ip/block', { ipAddress, reason }),
  unblockIP: (ipAddress: string) => api.post('/session-analytics/ip/unblock', { ipAddress }),
  getUserAnalytics: () => api.get<{ data: UserAnalytics }>('/session-analytics/users/analytics').then(r => r.data.data),
  getAdminLogins: (params: any) => api.get<{ data: AdminLogin[]; pagination: any }>('/session-analytics/admin-logins', { params }).then(r => r.data),
};

// Components
const StatCard = ({ 
  icon: Icon, 
  label, 
  value, 
  subValue, 
  trend,
  color = 'cyan'
}: { 
  icon: any; 
  label: string; 
  value: string | number; 
  subValue?: string;
  trend?: 'up' | 'down';
  color?: string;
}) => (
  <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
    <div className="flex items-center justify-between">
      <div className={`p-2 rounded-lg bg-${color}-500/20`}>
        <Icon className={`w-5 h-5 text-${color}-400`} />
      </div>
      {trend && (
        <span className={`flex items-center text-xs ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
          {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        </span>
      )}
    </div>
    <div className="mt-3">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-400">{label}</p>
      {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
    </div>
  </div>
);

const HeatBadge = ({ score }: { score: number }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getHeatColor(score)}`}>
    <Flame className="w-3 h-3" />
    {score}
  </span>
);

const ThreatBadge = ({ level }: { level: string }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getThreatColor(level)}`}>
    <Shield className="w-3 h-3" />
    {level}
  </span>
);

const VisitorTypeBadge = ({ type }: { type: string }) => {
  const config: Record<string, { color: string; label: string }> = {
    first_time: { color: 'text-blue-400 bg-blue-500/20', label: 'First Time' },
    returning: { color: 'text-green-400 bg-green-500/20', label: 'Returning' },
    frequent: { color: 'text-yellow-400 bg-yellow-500/20', label: 'Frequent' },
    loyal: { color: 'text-purple-400 bg-purple-500/20', label: 'Loyal' },
  };
  const { color, label } = config[type] || { color: 'text-gray-400 bg-gray-500/20', label: type };
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
};

export default function SessionAnalyticsPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'sessions' | 'visitors' | 'ips' | 'users' | 'logins'>('sessions');
  const [selectedSession, setSelectedSession] = useState<UserSession | null>(null);
  
  // Queries
  const { data: sessionStats, isLoading: statsLoading } = useQuery({
    queryKey: ['session-stats'],
    queryFn: sessionAnalyticsApi.getSessionStats,
    refetchInterval: 30000,
  });
  
  const { data: activeSessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['active-sessions'],
    queryFn: sessionAnalyticsApi.getActiveSessions,
    refetchInterval: 10000,
  });
  
  const { data: visitorAnalytics, isLoading: visitorsLoading } = useQuery({
    queryKey: ['visitor-analytics'],
    queryFn: sessionAnalyticsApi.getVisitorAnalytics,
    enabled: activeTab === 'visitors',
  });
  
  const { data: ipSummary, isLoading: ipsLoading } = useQuery({
    queryKey: ['ip-summary'],
    queryFn: sessionAnalyticsApi.getIPSummary,
    enabled: activeTab === 'ips',
  });
  
  const { data: userAnalytics, isLoading: usersLoading } = useQuery({
    queryKey: ['user-analytics'],
    queryFn: sessionAnalyticsApi.getUserAnalytics,
    enabled: activeTab === 'users',
  });
  
  const { data: adminLogins, isLoading: loginsLoading } = useQuery({
    queryKey: ['admin-logins'],
    queryFn: () => sessionAnalyticsApi.getAdminLogins({ limit: 50 }),
    enabled: activeTab === 'logins',
  });
  
  // Mutations
  const terminateSessionMutation = useMutation({
    mutationFn: sessionAnalyticsApi.terminateSession,
    onSuccess: () => {
      showToast('Session terminated', 'success');
      queryClient.invalidateQueries({ queryKey: ['active-sessions'] });
    },
    onError: () => showToast('Failed to terminate session', 'error'),
  });
  
  const blockIPMutation = useMutation({
    mutationFn: ({ ip, reason }: { ip: string; reason?: string }) => sessionAnalyticsApi.blockIP(ip, reason),
    onSuccess: () => {
      showToast('IP blocked', 'success');
      queryClient.invalidateQueries({ queryKey: ['ip-summary'] });
    },
    onError: () => showToast('Failed to block IP', 'error'),
  });

  const tabs = [
    { id: 'sessions', label: 'Active Sessions', icon: Radio, count: activeSessions?.length },
    { id: 'visitors', label: 'Visitors', icon: Eye },
    { id: 'ips', label: 'IP Intelligence', icon: Globe },
    { id: 'users', label: 'User Analytics', icon: Users },
    { id: 'logins', label: 'Login Audit', icon: History },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-cyan-500/20 rounded-lg">
            <Activity className="w-8 h-8 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Session Analytics</h1>
            <p className="text-gray-400">Real-time monitoring of users, visitors, and IP intelligence</p>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        <StatCard
          icon={Radio}
          label="Active Sessions"
          value={sessionStats?.overview.activeSessions || 0}
          color="green"
        />
        <StatCard
          icon={Users}
          label="Sessions Today"
          value={sessionStats?.overview.sessionsToday || 0}
          color="cyan"
        />
        <StatCard
          icon={Clock}
          label="Avg Duration"
          value={formatDuration(sessionStats?.overview.avgDuration || 0)}
          color="purple"
        />
        <StatCard
          icon={Eye}
          label="Unique Users (Month)"
          value={sessionStats?.overview.uniqueUsersMonth || 0}
          color="blue"
        />
        <StatCard
          icon={Bot}
          label="Bots Detected"
          value={(ipSummary?.bots.confirmed || 0) + (ipSummary?.bots.suspected || 0)}
          subValue={`${ipSummary?.bots.confirmed || 0} confirmed`}
          color="orange"
        />
        <StatCard
          icon={Shield}
          label="Blocked IPs"
          value={ipSummary?.blockedIPs || 0}
          color="red"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:border-gray-600'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && (
              <span className="px-2 py-0.5 bg-cyan-500/30 text-cyan-300 text-xs rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6">
        {/* Active Sessions Tab */}
        {activeTab === 'sessions' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-green-400" />
                Active Sessions
              </h2>
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ['active-sessions'] })}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-700/50 hover:bg-gray-600/50 rounded-lg text-gray-300 text-sm transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
            
            {sessionsLoading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-8 h-8 text-gray-500 animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700/50">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">User</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Device</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Location</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">IP Address</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Login</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Last Active</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Threat</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSessions?.map((session) => {
                      const DeviceIcon = getDeviceIcon(session.deviceType);
                      return (
                        <tr key={session.id} className="border-b border-gray-700/30 hover:bg-gray-700/20">
                          <td className="py-3 px-4">
                            <div>
                              <p className="text-white font-medium">
                                {session.user?.firstName || session.user?.lastName
                                  ? `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim()
                                  : session.user?.email || 'Unknown'}
                              </p>
                              <p className="text-gray-500 text-xs">{session.user?.email}</p>
                              {session.user?.role && (
                                <span className="inline-block mt-1 px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
                                  {session.user.role}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <DeviceIcon className="w-4 h-4 text-gray-400" />
                              <div>
                                <p className="text-gray-300 text-sm">{session.browser || 'Unknown'}</p>
                                <p className="text-gray-500 text-xs">{session.os || 'Unknown'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-gray-500" />
                              <span className="text-gray-300 text-sm">
                                {session.city ? `${session.city}, ` : ''}{session.country || 'Unknown'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <code className="text-cyan-400 text-sm">{session.ipAddress}</code>
                          </td>
                          <td className="py-3 px-4 text-gray-400 text-sm">
                            {formatTimeAgo(session.loginAt)}
                          </td>
                          <td className="py-3 px-4 text-gray-400 text-sm">
                            {formatTimeAgo(session.lastActiveAt)}
                          </td>
                          <td className="py-3 px-4">
                            <ThreatBadge level={session.threatLevel} />
                            {session.botScore > 50 && (
                              <span className="ml-2 text-orange-400 text-xs">🤖 {session.botScore}%</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => terminateSessionMutation.mutate(session.id)}
                              disabled={terminateSessionMutation.isPending}
                              className="flex items-center gap-1 px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm transition-colors"
                            >
                              <XCircle className="w-3 h-3" />
                              End
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {(!activeSessions || activeSessions.length === 0) && (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-gray-500">
                          No active sessions
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Visitors Tab */}
        {activeTab === 'visitors' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-400" />
                Visitor Analytics
              </h2>
            </div>
            
            {visitorsLoading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-8 h-8 text-gray-500 animate-spin" />
              </div>
            ) : (
              <div>
                {/* Visitor Overview Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <StatCard
                    icon={Eye}
                    label="Total Visitors"
                    value={visitorAnalytics?.totalVisitors || 0}
                    color="blue"
                  />
                  <StatCard
                    icon={Target}
                    label="Potential Users"
                    value={visitorAnalytics?.potentialUsers || 0}
                    subValue={`${visitorAnalytics?.conversionRate?.toFixed(1) || 0}% conversion`}
                    color="green"
                  />
                  <StatCard
                    icon={Bot}
                    label="Confirmed Bots"
                    value={visitorAnalytics?.confirmedBots || 0}
                    color="orange"
                  />
                  <StatCard
                    icon={TrendingUp}
                    label="Returning"
                    value={
                      (visitorAnalytics?.byType?.returning || 0) +
                      (visitorAnalytics?.byType?.frequent || 0) +
                      (visitorAnalytics?.byType?.loyal || 0)
                    }
                    color="purple"
                  />
                </div>

                {/* Heat Score Distribution */}
                <div className="mb-8">
                  <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                    <Thermometer className="w-5 h-5 text-orange-400" />
                    Heat Score Distribution
                  </h3>
                  <div className="grid grid-cols-5 gap-2">
                    {visitorAnalytics?.heatDistribution?.map((range, idx) => (
                      <div key={idx} className="bg-gray-700/30 rounded-lg p-3 text-center">
                        <div className="flex items-center justify-center mb-2">
                          <Flame className={`w-5 h-5 ${
                            idx === 0 ? 'text-gray-400' :
                            idx === 1 ? 'text-blue-400' :
                            idx === 2 ? 'text-yellow-400' :
                            idx === 3 ? 'text-orange-400' :
                            'text-red-400'
                          }`} />
                        </div>
                        <p className="text-2xl font-bold text-white">{range.count}</p>
                        <p className="text-xs text-gray-400">{range.range}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Visitor Type Breakdown */}
                <div className="mb-8">
                  <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-cyan-400" />
                    Visitor Types
                  </h3>
                  <div className="grid grid-cols-4 gap-4">
                    {Object.entries(visitorAnalytics?.byType || {}).map(([type, count]) => (
                      <div key={type} className="bg-gray-700/30 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <VisitorTypeBadge type={type} />
                          <span className="text-2xl font-bold text-white">{count}</span>
                        </div>
                        <p className="text-sm text-gray-400 capitalize">{type.replace('_', ' ')}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Visitors */}
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">Recent Visitors</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-700/50">
                          <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Fingerprint</th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Type</th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Visits</th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Heat</th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Location</th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Bot?</th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">First Visit</th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Last Visit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visitorAnalytics?.recentVisitors?.map((visitor) => (
                          <tr key={visitor.id} className="border-b border-gray-700/30 hover:bg-gray-700/20">
                            <td className="py-3 px-4">
                              <code className="text-cyan-400 text-xs">{visitor.fingerprint.substring(0, 12)}...</code>
                            </td>
                            <td className="py-3 px-4">
                              <VisitorTypeBadge type={visitor.visitorType} />
                            </td>
                            <td className="py-3 px-4 text-white font-medium">{visitor.visitCount}</td>
                            <td className="py-3 px-4">
                              <HeatBadge score={visitor.heatScore} />
                            </td>
                            <td className="py-3 px-4 text-gray-300 text-sm">
                              {visitor.lastCity ? `${visitor.lastCity}, ` : ''}{visitor.lastCountry || 'Unknown'}
                            </td>
                            <td className="py-3 px-4">
                              {visitor.isBotConfirmed ? (
                                <span className="flex items-center gap-1 text-orange-400 text-sm">
                                  <Bot className="w-4 h-4" />
                                  {visitor.botName || 'Bot'}
                                </span>
                              ) : visitor.potentialUser ? (
                                <span className="flex items-center gap-1 text-green-400 text-sm">
                                  <UserCheck className="w-4 h-4" />
                                  Potential
                                </span>
                              ) : (
                                <span className="text-gray-500 text-sm">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-gray-400 text-sm">
                              {formatTimeAgo(visitor.firstVisitAt)}
                            </td>
                            <td className="py-3 px-4 text-gray-400 text-sm">
                              {formatTimeAgo(visitor.lastVisitAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* IP Intelligence Tab */}
        {activeTab === 'ips' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-green-400" />
                IP Intelligence
              </h2>
            </div>
            
            {ipsLoading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-8 h-8 text-gray-500 animate-spin" />
              </div>
            ) : (
              <div>
                {/* IP Overview */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                  <StatCard icon={Globe} label="Total IPs" value={ipSummary?.totalIPs || 0} color="cyan" />
                  <StatCard icon={Ban} label="Blocked" value={ipSummary?.blockedIPs || 0} color="red" />
                  <StatCard icon={Bot} label="Confirmed Bots" value={ipSummary?.bots.confirmed || 0} color="orange" />
                  <StatCard icon={AlertTriangle} label="Suspected Bots" value={ipSummary?.bots.suspected || 0} color="yellow" />
                  <StatCard 
                    icon={Shield} 
                    label="High Threat" 
                    value={(ipSummary?.threatLevels?.HIGH || 0) + (ipSummary?.threatLevels?.CRITICAL || 0)} 
                    color="red" 
                  />
                </div>

                {/* Threat Level Breakdown */}
                <div className="mb-8">
                  <h3 className="text-lg font-medium text-white mb-4">Threat Level Distribution</h3>
                  <div className="flex gap-4">
                    {['NORMAL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((level) => (
                      <div key={level} className={`flex-1 p-3 rounded-lg ${getThreatColor(level).replace('text-', 'border-').replace('/20', '/50')} border`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-medium ${getThreatColor(level).split(' ')[0]}`}>{level}</span>
                          <span className="text-lg font-bold text-white">{ipSummary?.threatLevels?.[level] || 0}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Countries */}
                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div>
                    <h3 className="text-lg font-medium text-white mb-4">Top Countries</h3>
                    <div className="space-y-2">
                      {ipSummary?.topCountries?.slice(0, 8).map((c, idx) => (
                        <div key={c.country} className="flex items-center justify-between bg-gray-700/30 rounded-lg px-4 py-2">
                          <div className="flex items-center gap-3">
                            <span className="text-gray-500 text-sm w-6">{idx + 1}.</span>
                            <span className="text-white">{c.country}</span>
                          </div>
                          <span className="text-cyan-400 font-medium">{c.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent IP Activity */}
                  <div>
                    <h3 className="text-lg font-medium text-white mb-4">Recent Activity</h3>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {ipSummary?.recentActivity?.slice(0, 10).map((ip) => (
                        <div key={ip.ipAddress} className="flex items-center justify-between bg-gray-700/30 rounded-lg px-4 py-2">
                          <div>
                            <code className="text-cyan-400 text-sm">{ip.ipAddress}</code>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-gray-500 text-xs">{ip.country}</span>
                              <ThreatBadge level={ip.threatLevel} />
                              {ip.isBotConfirmed && <Bot className="w-3 h-3 text-orange-400" />}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-xs">{ip.totalRequests} req</span>
                            {!ip.isBlocked ? (
                              <button
                                onClick={() => blockIPMutation.mutate({ ip: ip.ipAddress })}
                                className="p-1 hover:bg-red-500/20 rounded text-red-400"
                                title="Block IP"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            ) : (
                              <CheckCircle className="w-4 h-4 text-red-400" title="Blocked" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* User Analytics Tab */}
        {activeTab === 'users' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                User Analytics
              </h2>
            </div>
            
            {usersLoading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-8 h-8 text-gray-500 animate-spin" />
              </div>
            ) : (
              <div>
                {/* User Overview */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <StatCard icon={Users} label="Total Users" value={userAnalytics?.overview.totalUsers || 0} color="purple" />
                  <StatCard icon={Activity} label="Active Today" value={userAnalytics?.overview.activeToday || 0} color="green" />
                  <StatCard icon={TrendingUp} label="Active This Week" value={userAnalytics?.overview.activeWeek || 0} color="cyan" />
                </div>

                {/* Role Distribution */}
                <div className="mb-8">
                  <h3 className="text-lg font-medium text-white mb-4">Users by Role</h3>
                  <div className="grid grid-cols-5 gap-3">
                    {Object.entries(userAnalytics?.byRole || {}).map(([role, count]) => (
                      <div key={role} className="bg-gray-700/30 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-white">{count}</p>
                        <p className="text-sm text-gray-400">{role.replace('_', ' ')}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Heat Distribution */}
                <div className="mb-8">
                  <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                    <Flame className="w-5 h-5 text-orange-400" />
                    User Engagement Heat
                  </h3>
                  <div className="grid grid-cols-5 gap-2">
                    {userAnalytics?.heatDistribution?.map((range, idx) => (
                      <div key={idx} className="bg-gray-700/30 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-white">{range.count}</p>
                        <p className="text-xs text-gray-400">{range.range}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Users */}
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">Top Active Users</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-700/50">
                          <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">User</th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Role</th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Heat Score</th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Login Count</th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Last Login</th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Last Active</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userAnalytics?.topUsers?.map((user) => (
                          <tr key={user.id} className="border-b border-gray-700/30 hover:bg-gray-700/20">
                            <td className="py-3 px-4">
                              <div>
                                <p className="text-white font-medium">{user.name || user.email}</p>
                                <p className="text-gray-500 text-xs">{user.email}</p>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
                                {user.role}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <HeatBadge score={user.heatScore} />
                            </td>
                            <td className="py-3 px-4 text-white">{user.loginCount}</td>
                            <td className="py-3 px-4 text-gray-400 text-sm">
                              {user.lastLoginAt ? formatTimeAgo(user.lastLoginAt) : '-'}
                            </td>
                            <td className="py-3 px-4 text-gray-400 text-sm">
                              {user.lastActiveAt ? formatTimeAgo(user.lastActiveAt) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Admin Login Audit Tab */}
        {activeTab === 'logins' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-yellow-400" />
                Admin Login Audit
              </h2>
            </div>
            
            {loginsLoading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-8 h-8 text-gray-500 animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700/50">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">User</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Role</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Status</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">IP</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Location</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Method</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Time</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminLogins?.data?.map((login) => (
                      <tr key={login.id} className={`border-b border-gray-700/30 hover:bg-gray-700/20 ${login.suspicious ? 'bg-red-500/5' : ''}`}>
                        <td className="py-3 px-4">
                          <p className="text-white font-medium">{login.email}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
                            {login.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {login.success ? (
                            <span className="flex items-center gap-1 text-green-400 text-sm">
                              <CheckCircle className="w-4 h-4" />
                              Success
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-400 text-sm">
                              <XCircle className="w-4 h-4" />
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <code className="text-cyan-400 text-xs">{login.ipAddress}</code>
                        </td>
                        <td className="py-3 px-4 text-gray-300 text-sm">
                          {login.city ? `${login.city}, ` : ''}{login.country || 'Unknown'}
                        </td>
                        <td className="py-3 px-4 text-gray-400 text-sm capitalize">
                          {login.loginMethod}
                        </td>
                        <td className="py-3 px-4 text-gray-400 text-sm">
                          {formatTimeAgo(login.timestamp)}
                        </td>
                        <td className="py-3 px-4">
                          {login.suspicious ? (
                            <div className="flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4 text-red-400" />
                              <span className="text-red-400 text-xs">
                                {login.suspiciousReasons?.join(', ')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
