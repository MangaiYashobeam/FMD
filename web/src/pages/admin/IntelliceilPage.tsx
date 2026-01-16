import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Globe,
  Zap,
  Settings,
  Lock,
  Unlock,
  Ban,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { intelliceilApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

// Types
interface ThreatLevel {
  level: 'NORMAL' | 'ELEVATED' | 'ATTACK' | 'CRITICAL';
  percentage: number;
  triggeredAt: string | null;
  mitigationActive: boolean;
  blockedRequests: number;
  allowedRequests: number;
}

interface Baseline {
  avgRequestsPerSecond: number;
  peakRequestsPerSecond: number;
  lastUpdated: string;
  sampleCount: number;
}

interface GeoLocation {
  ip: string;
  country: string;
  countryCode: string;
  city: string;
  lat: number;
  lon: number;
  isTrusted: boolean;
  requestCount: number;
  lastSeen: string;
}

interface TrafficPoint {
  timestamp: string;
  rps: number;
}

interface SourceCount {
  source: string;
  count: number;
}

interface CountryCount {
  country: string;
  count: number;
}

interface IntelliceilConfig {
  enabled: boolean;
  alertThreshold: number;
  mitigationThreshold: number;
  trustedDomains: string[];
  blockedIPs: string[];
  autoMitigate: boolean;
  notifyOnAttack: boolean;
  notifyEmail: string;
  maxRequestsPerIP: number;
  windowSeconds: number;
}

interface IntelliceilStatus {
  config: IntelliceilConfig;
  baseline: Baseline;
  threatLevel: ThreatLevel;
  currentRps: number;
  blockedRequests: number;
  allowedRequests: number;
  uniqueIPs: number;
  geoLocations: GeoLocation[];
  trafficHistory: TrafficPoint[];
  topSources: SourceCount[];
  topEndpoints: { endpoint: string; count: number }[];
  topCountries: CountryCount[];
}

type ThreatLevelKey = 'NORMAL' | 'ELEVATED' | 'ATTACK' | 'CRITICAL';

// Threat level colors and icons
const threatLevelConfig: Record<ThreatLevelKey, { color: string; textColor: string; icon: typeof CheckCircle; label: string }> = {
  NORMAL: { color: 'bg-green-500', textColor: 'text-green-500', icon: CheckCircle, label: 'Normal' },
  ELEVATED: { color: 'bg-yellow-500', textColor: 'text-yellow-500', icon: AlertTriangle, label: 'Elevated' },
  ATTACK: { color: 'bg-orange-500', textColor: 'text-orange-500', icon: AlertTriangle, label: 'Attack Detected' },
  CRITICAL: { color: 'bg-red-500', textColor: 'text-red-500', icon: XCircle, label: 'Critical' },
};

export default function IntelliceilPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'map' | 'config' | 'logs'>('overview');
  const [newBlockIP, setNewBlockIP] = useState('');
  const [newTrustedDomain, setNewTrustedDomain] = useState('');

  // Fetch status with auto-refresh every 2 seconds
  const { data: statusResponse, isLoading, error } = useQuery({
    queryKey: ['intelliceil-status'],
    queryFn: () => intelliceilApi.getStatus(),
    refetchInterval: 2000, // Real-time updates
  });

  const intelliceil: IntelliceilStatus | undefined = statusResponse?.data?.data;
  const threatLevel: ThreatLevelKey = intelliceil?.threatLevel?.level ?? 'NORMAL';
  const threatConfig = threatLevelConfig[threatLevel];

  // Mutations
  const updateConfigMutation = useMutation({
    mutationFn: intelliceilApi.updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intelliceil-status'] });
      toast.success('Configuration updated');
    },
    onError: () => toast.error('Failed to update configuration'),
  });

  const blockIPMutation = useMutation({
    mutationFn: intelliceilApi.blockIP,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intelliceil-status'] });
      toast.success('IP blocked');
      setNewBlockIP('');
    },
    onError: () => toast.error('Failed to block IP'),
  });

  const unblockIPMutation = useMutation({
    mutationFn: intelliceilApi.unblockIP,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intelliceil-status'] });
      toast.success('IP unblocked');
    },
    onError: () => toast.error('Failed to unblock IP'),
  });

  const activateMitigationMutation = useMutation({
    mutationFn: intelliceilApi.activateMitigation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intelliceil-status'] });
      toast.warning('Mitigation activated');
    },
    onError: () => toast.error('Failed to activate mitigation'),
  });

  const deactivateMitigationMutation = useMutation({
    mutationFn: intelliceilApi.deactivateMitigation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intelliceil-status'] });
      toast.success('Mitigation deactivated');
    },
    onError: () => toast.error('Failed to deactivate mitigation'),
  });

  const addTrustedDomainMutation = useMutation({
    mutationFn: intelliceilApi.addTrustedDomain,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intelliceil-status'] });
      toast.success('Trusted domain added');
      setNewTrustedDomain('');
    },
    onError: () => toast.error('Failed to add trusted domain'),
  });

  const removeTrustedDomainMutation = useMutation({
    mutationFn: intelliceilApi.removeTrustedDomain,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intelliceil-status'] });
      toast.success('Trusted domain removed');
    },
    onError: () => toast.error('Failed to remove trusted domain'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !intelliceil) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Failed to load Intelliceil status</p>
      </div>
    );
  }

  const ThreatIcon = threatConfig.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-xl">
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Intelliceil Security</h1>
            <p className="text-gray-500">Anti-DDoS &amp; Exchange Security System</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Threat Level Badge */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${threatConfig.color} text-white`}>
            <ThreatIcon className="w-5 h-5" />
            <span className="font-semibold">{threatConfig.label}</span>
            {intelliceil.threatLevel.percentage > 0 && (
              <span className="text-sm opacity-90">+{intelliceil.threatLevel.percentage.toFixed(1)}%</span>
            )}
          </div>
          {/* Toggle System */}
          <button
            onClick={() => updateConfigMutation.mutate({ enabled: !intelliceil.config.enabled })}
            className={`px-4 py-2 rounded-lg font-medium ${
              intelliceil.config.enabled
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {intelliceil.config.enabled ? 'System Active' : 'System Disabled'}
          </button>
        </div>
      </div>

      {/* Mitigation Alert */}
      {intelliceil.threatLevel.mitigationActive && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="w-6 h-6 text-red-600" />
              <div>
                <h3 className="font-bold text-red-800">Mitigation Mode Active</h3>
                <p className="text-red-600 text-sm">
                  Only trusted sources are being allowed through. Abnormal traffic is being blocked.
                </p>
              </div>
            </div>
            <button
              onClick={() => deactivateMitigationMutation.mutate()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <Unlock className="w-4 h-4 inline mr-2" />
              Deactivate
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            { id: 'overview' as const, label: 'Overview', icon: Activity },
            { id: 'map' as const, label: 'Traffic Map', icon: Globe },
            { id: 'config' as const, label: 'Configuration', icon: Settings },
            { id: 'logs' as const, label: 'Blocked IPs', icon: Ban },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Current RPS */}
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Requests/Second</p>
                  <p className="text-3xl font-bold text-gray-900">{intelliceil.currentRps}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Zap className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Baseline: {intelliceil.baseline.avgRequestsPerSecond.toFixed(1)} req/s
              </p>
            </div>

            {/* Unique IPs */}
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Unique IPs</p>
                  <p className="text-3xl font-bold text-gray-900">{intelliceil.uniqueIPs}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Globe className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {intelliceil.geoLocations.filter((g: GeoLocation) => g.isTrusted).length} trusted
              </p>
            </div>

            {/* Allowed Requests */}
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Allowed</p>
                  <p className="text-3xl font-bold text-green-600">{intelliceil.allowedRequests.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            {/* Blocked Requests */}
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Blocked</p>
                  <p className="text-3xl font-bold text-red-600">{intelliceil.blockedRequests.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-red-100 rounded-lg">
                  <Ban className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Traffic Chart */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Traffic History (Last 60 Seconds)</h3>
            <div className="h-48 flex items-end gap-1">
              {intelliceil.trafficHistory.slice(-60).map((point: TrafficPoint, i: number) => {
                const maxRps = Math.max(...intelliceil.trafficHistory.map((p: TrafficPoint) => p.rps), 1);
                const height = (point.rps / maxRps) * 100;
                const isAboveThreshold = point.rps > intelliceil.baseline.avgRequestsPerSecond * (1 + intelliceil.config.alertThreshold / 100);
                return (
                  <div
                    key={i}
                    className={`flex-1 min-w-1 rounded-t transition-all ${
                      isAboveThreshold ? 'bg-red-500' : 'bg-blue-500'
                    }`}
                    style={{ height: `${Math.max(height, 2)}%` }}
                    title={`${point.rps} req/s`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>60s ago</span>
              <span className="text-orange-500">— Alert threshold ({intelliceil.config.alertThreshold}%)</span>
              <span>Now</span>
            </div>
          </div>

          {/* Top Sources & Endpoints */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Sources */}
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Top Traffic Sources</h3>
              <div className="space-y-3">
                {intelliceil.topSources.slice(0, 5).map((source: SourceCount, i: number) => (
                  <div key={source.source} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 text-sm">#{i + 1}</span>
                      <span className="font-medium text-gray-700">{source.source}</span>
                    </div>
                    <span className="text-gray-500">{source.count.toLocaleString()}</span>
                  </div>
                ))}
                {intelliceil.topSources.length === 0 && (
                  <p className="text-gray-500 text-sm">No traffic data yet</p>
                )}
              </div>
            </div>

            {/* Top Countries */}
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Top Countries</h3>
              <div className="space-y-3">
                {intelliceil.topCountries.slice(0, 5).map((country: CountryCount, i: number) => (
                  <div key={country.country} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 text-sm">#{i + 1}</span>
                      <span className="font-medium text-gray-700">{country.country || 'Unknown'}</span>
                    </div>
                    <span className="text-gray-500">{country.count.toLocaleString()}</span>
                  </div>
                ))}
                {intelliceil.topCountries.length === 0 && (
                  <p className="text-gray-500 text-sm">No geographic data yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Manual Controls */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Manual Controls</h3>
            <div className="flex gap-4">
              {!intelliceil.threatLevel.mitigationActive ? (
                <button
                  onClick={() => activateMitigationMutation.mutate()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <Lock className="w-4 h-4 inline mr-2" />
                  Activate Mitigation
                </button>
              ) : (
                <button
                  onClick={() => deactivateMitigationMutation.mutate()}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Unlock className="w-4 h-4 inline mr-2" />
                  Deactivate Mitigation
                </button>
              )}
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ['intelliceil-status'] })}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                <RefreshCw className="w-4 h-4 inline mr-2" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map Tab */}
      {activeTab === 'map' && (
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">Live Traffic Map</h3>
          <div className="relative h-96 bg-gray-100 rounded-lg overflow-hidden">
            {/* World Map Background - Using a simple SVG placeholder */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Globe className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  Live traffic visualization
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  {intelliceil.geoLocations.length} active IPs from {intelliceil.topCountries.length} countries
                </p>
              </div>
            </div>
            
            {/* Traffic Points */}
            <div className="absolute inset-0">
              {intelliceil.geoLocations.slice(0, 50).map((loc: GeoLocation, i: number) => {
                // Simple mapping: lat/lon to % position
                const x = ((loc.lon + 180) / 360) * 100;
                const y = ((90 - loc.lat) / 180) * 100;
                return (
                  <div
                    key={loc.ip}
                    className={`absolute w-3 h-3 rounded-full transform -translate-x-1/2 -translate-y-1/2 ${
                      loc.isTrusted ? 'bg-green-500' : 'bg-blue-500'
                    } animate-ping`}
                    style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 100}ms` }}
                    title={`${loc.ip} (${loc.city}, ${loc.country})`}
                  />
                );
              })}
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-white/90 p-3 rounded-lg text-sm">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>Trusted Source</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span>Regular Traffic</span>
              </div>
            </div>
          </div>

          {/* Active Connections List */}
          <div className="mt-6">
            <h4 className="font-medium text-gray-700 mb-3">Active Connections</h4>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left">IP Address</th>
                    <th className="px-4 py-2 text-left">Location</th>
                    <th className="px-4 py-2 text-left">Requests</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {intelliceil.geoLocations.slice(0, 20).map((loc: GeoLocation) => (
                    <tr key={loc.ip} className="border-b">
                      <td className="px-4 py-2 font-mono text-xs">{loc.ip}</td>
                      <td className="px-4 py-2">{loc.city}, {loc.country}</td>
                      <td className="px-4 py-2">{loc.requestCount}</td>
                      <td className="px-4 py-2">
                        {loc.isTrusted ? (
                          <span className="text-green-600 text-xs font-medium">Trusted</span>
                        ) : (
                          <span className="text-gray-500 text-xs">Regular</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => blockIPMutation.mutate(loc.ip)}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          Block
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Tab */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          {/* Thresholds */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Threshold Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alert Threshold (%)
                </label>
                <input
                  type="number"
                  value={intelliceil.config.alertThreshold}
                  onChange={(e) => updateConfigMutation.mutate({ alertThreshold: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  min="1"
                  max="100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Alert when traffic exceeds baseline by this percentage
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mitigation Threshold (%)
                </label>
                <input
                  type="number"
                  value={intelliceil.config.mitigationThreshold}
                  onChange={(e) => updateConfigMutation.mutate({ mitigationThreshold: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  min="1"
                  max="100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Activate mitigation when traffic exceeds baseline by this percentage
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Requests per IP (per window)
                </label>
                <input
                  type="number"
                  value={intelliceil.config.maxRequestsPerIP}
                  onChange={(e) => updateConfigMutation.mutate({ maxRequestsPerIP: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  min="10"
                  max="10000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Window Duration (seconds)
                </label>
                <input
                  type="number"
                  value={intelliceil.config.windowSeconds}
                  onChange={(e) => updateConfigMutation.mutate({ windowSeconds: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  min="10"
                  max="3600"
                />
              </div>
            </div>
          </div>

          {/* Auto Settings */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Automation</h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-700">Auto-Mitigate</span>
                  <p className="text-sm text-gray-500">Automatically activate mitigation when threshold is exceeded</p>
                </div>
                <input
                  type="checkbox"
                  checked={intelliceil.config.autoMitigate}
                  onChange={(e) => updateConfigMutation.mutate({ autoMitigate: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded"
                />
              </label>
              <label className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-700">Attack Notifications</span>
                  <p className="text-sm text-gray-500">Send email alerts when attacks are detected</p>
                </div>
                <input
                  type="checkbox"
                  checked={intelliceil.config.notifyOnAttack}
                  onChange={(e) => updateConfigMutation.mutate({ notifyOnAttack: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded"
                />
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notification Email
                </label>
                <input
                  type="email"
                  value={intelliceil.config.notifyEmail}
                  onChange={(e) => updateConfigMutation.mutate({ notifyEmail: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Trusted Domains */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Trusted Domains</h3>
            <p className="text-sm text-gray-500 mb-4">
              These domains are always allowed through, even during mitigation mode.
            </p>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newTrustedDomain}
                onChange={(e) => setNewTrustedDomain(e.target.value)}
                placeholder="example.com"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
              />
              <button
                onClick={() => newTrustedDomain && addTrustedDomainMutation.mutate(newTrustedDomain)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {intelliceil.config.trustedDomains.map((domain: string) => (
                <span
                  key={domain}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm"
                >
                  {domain}
                  <button
                    onClick={() => removeTrustedDomainMutation.mutate(domain)}
                    className="hover:text-green-900"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Blocked IPs Tab */}
      {activeTab === 'logs' && (
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">Blocked IP Addresses</h3>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newBlockIP}
              onChange={(e) => setNewBlockIP(e.target.value)}
              placeholder="192.168.1.1"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
            />
            <button
              onClick={() => newBlockIP && blockIPMutation.mutate(newBlockIP)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <Ban className="w-4 h-4 inline mr-2" />
              Block IP
            </button>
          </div>
          <div className="space-y-2">
            {intelliceil.config.blockedIPs.length === 0 ? (
              <p className="text-gray-500 text-sm">No blocked IPs</p>
            ) : (
              intelliceil.config.blockedIPs.map((ip: string) => (
                <div key={ip} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <span className="font-mono text-sm">{ip}</span>
                  <button
                    onClick={() => unblockIPMutation.mutate(ip)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Unblock
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
