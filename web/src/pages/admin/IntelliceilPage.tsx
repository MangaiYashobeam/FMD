import { useState, lazy, Suspense } from 'react';
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
  X,
  ChevronDown,
  ChevronUp,
  Server,
  Eye,
  ExternalLink,
  Info,
  Bug,
  Bot,
  FileWarning,
  Fingerprint,
  ShieldAlert,
  Skull,
  Repeat,
  MousePointerClick,
} from 'lucide-react';
import { intelliceilApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

// Lazy load the map component to avoid SSR issues
const TrafficMap = lazy(() => import('../../components/TrafficMap'));

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
  // Enterprise Security Settings
  enableSignatureValidation: boolean;
  enableTokenFingerprinting: boolean;
  enableSQLInjectionDetection: boolean;
  enableXSSDetection: boolean;
  enableBotDetection: boolean;
  enableIPReputation: boolean;
  botDetectionThreshold: number;
}

interface SecurityMetrics {
  sqlInjectionAttempts: number;
  xssAttempts: number;
  botDetections: number;
  signatureFailures: number;
  replayAttempts: number;
  honeypotHits: number;
  ipReputationCacheSize: number;
  tokenFingerprintCacheSize: number;
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
  securityMetrics: SecurityMetrics;
}

type ThreatLevelKey = 'NORMAL' | 'ELEVATED' | 'ATTACK' | 'CRITICAL';

// Threat level colors and icons
const threatLevelConfig: Record<ThreatLevelKey, { color: string; textColor: string; icon: typeof CheckCircle; label: string }> = {
  NORMAL: { color: 'bg-green-500', textColor: 'text-green-500', icon: CheckCircle, label: 'Normal' },
  ELEVATED: { color: 'bg-yellow-500', textColor: 'text-yellow-500', icon: AlertTriangle, label: 'Elevated' },
  ATTACK: { color: 'bg-orange-500', textColor: 'text-orange-500', icon: AlertTriangle, label: 'Attack Detected' },
  CRITICAL: { color: 'bg-red-500', textColor: 'text-red-500', icon: XCircle, label: 'Critical' },
};

// Detail Modal Component
interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon: typeof Zap;
  children: React.ReactNode;
  iconBgColor?: string;
  iconColor?: string;
}

function DetailModal({ isOpen, onClose, title, icon: Icon, children, iconBgColor = 'bg-blue-100', iconColor = 'text-blue-600' }: DetailModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className={`p-2 ${iconBgColor} rounded-lg`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// IP Details Card Component
interface IPDetailsCardProps {
  location: GeoLocation;
  onBlock: (ip: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

function IPDetailsCard({ location, onBlock, isExpanded, onToggle }: IPDetailsCardProps) {
  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${location.isTrusted ? 'border-green-200 bg-green-50/50' : 'border-gray-200'}`}>
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${location.isTrusted ? 'bg-green-500' : 'bg-blue-500'} animate-pulse`} />
          <div>
            <span className="font-mono text-sm text-gray-900">{location.ip}</span>
            <span className="ml-2 text-sm text-gray-500">{location.city}, {location.country}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
            {location.requestCount} requests
          </span>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>
      
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Country Code:</span>
              <span className="ml-2 font-medium">{location.countryCode}</span>
            </div>
            <div>
              <span className="text-gray-500">Coordinates:</span>
              <span className="ml-2 font-medium">{location.lat.toFixed(2)}, {location.lon.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-500">Status:</span>
              <span className={`ml-2 font-medium ${location.isTrusted ? 'text-green-600' : 'text-blue-600'}`}>
                {location.isTrusted ? 'Trusted' : 'Regular'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Last Seen:</span>
              <span className="ml-2 font-medium">{new Date(location.lastSeen).toLocaleTimeString()}</span>
            </div>
          </div>
          
          <div className="flex gap-2 pt-2">
            <button
              onClick={(e) => { e.stopPropagation(); onBlock(location.ip); }}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200 transition-colors"
            >
              <Ban className="w-3 h-3" />
              Block IP
            </button>
            <a
              href={`https://whatismyipaddress.com/ip/${location.ip}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Lookup
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IntelliceilPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'map' | 'config' | 'logs' | 'security'>('overview');
  const [newBlockIP, setNewBlockIP] = useState('');
  const [newTrustedDomain, setNewTrustedDomain] = useState('');
  
  // Modal states for clickable stat cards
  const [activeModal, setActiveModal] = useState<'rps' | 'ips' | 'allowed' | 'blocked' | null>(null);
  
  // Expanded IP cards state
  const [expandedIPs, setExpandedIPs] = useState<Set<string>>(new Set());
  
  // Selected map marker state
  const [selectedMapMarker, setSelectedMapMarker] = useState<GeoLocation | null>(null);

  // Fetch status with auto-refresh every 2 seconds
  const { data: statusResponse, isLoading, error } = useQuery({
    queryKey: ['intelliceil-status'],
    queryFn: () => intelliceilApi.getStatus(),
    refetchInterval: 2000, // Real-time updates
  });

  const intelliceil: IntelliceilStatus | undefined = statusResponse?.data?.data;
  const threatLevel: ThreatLevelKey = intelliceil?.threatLevel?.level ?? 'NORMAL';
  const threatConfig = threatLevelConfig[threatLevel];
  
  // Helper to toggle IP expansion
  const toggleIPExpansion = (ip: string) => {
    setExpandedIPs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ip)) {
        newSet.delete(ip);
      } else {
        newSet.add(ip);
      }
      return newSet;
    });
  };

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
            { id: 'security' as const, label: 'Security Metrics', icon: ShieldAlert },
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
          {/* Stats Grid - Clickable Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Current RPS - Clickable */}
            <button
              onClick={() => setActiveModal('rps')}
              className="bg-white p-6 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all text-left group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm flex items-center gap-1">
                    Requests/Second
                    <Eye className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                  <p className="text-3xl font-bold text-gray-900">{intelliceil.currentRps}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <Zap className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Baseline: {intelliceil.baseline.avgRequestsPerSecond.toFixed(1)} req/s
              </p>
              <p className="text-xs text-blue-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                Click for details →
              </p>
            </button>

            {/* Unique IPs - Clickable */}
            <button
              onClick={() => setActiveModal('ips')}
              className="bg-white p-6 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all text-left group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm flex items-center gap-1">
                    Unique IPs
                    <Eye className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                  <p className="text-3xl font-bold text-gray-900">{intelliceil.uniqueIPs}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                  <Globe className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {intelliceil.geoLocations.filter((g: GeoLocation) => g.isTrusted).length} trusted
              </p>
              <p className="text-xs text-purple-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                Click for IP details →
              </p>
            </button>

            {/* Allowed Requests - Clickable */}
            <button
              onClick={() => setActiveModal('allowed')}
              className="bg-white p-6 rounded-xl border border-gray-200 hover:border-green-300 hover:shadow-lg transition-all text-left group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm flex items-center gap-1">
                    Allowed
                    <Eye className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                  <p className="text-3xl font-bold text-green-600">{intelliceil.allowedRequests.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <p className="text-xs text-green-500 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                Click for traffic sources →
              </p>
            </button>

            {/* Blocked Requests - Clickable */}
            <button
              onClick={() => setActiveModal('blocked')}
              className="bg-white p-6 rounded-xl border border-gray-200 hover:border-red-300 hover:shadow-lg transition-all text-left group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm flex items-center gap-1">
                    Blocked
                    <Eye className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                  <p className="text-3xl font-bold text-red-600">{intelliceil.blockedRequests.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-red-100 rounded-lg group-hover:bg-red-200 transition-colors">
                  <Ban className="w-6 h-6 text-red-600" />
                </div>
              </div>
              <p className="text-xs text-red-500 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                Click for blocked details →
              </p>
            </button>
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
        <div className="space-y-6">
          {/* Interactive World Map with OpenStreetMap */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Live Traffic Map</h3>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span>Live updates every 2s</span>
              </div>
            </div>
            
            <Suspense fallback={
              <div className="h-[500px] bg-slate-100 rounded-xl flex items-center justify-center">
                <div className="text-center">
                  <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
                  <p className="text-gray-500">Loading map...</p>
                </div>
              </div>
            }>
              <TrafficMap
                geoLocations={intelliceil.geoLocations}
                onBlockIP={(ip) => blockIPMutation.mutate(ip)}
                selectedIP={selectedMapMarker?.ip || null}
                onSelectIP={(ip) => {
                  if (ip) {
                    const loc = intelliceil.geoLocations.find((g: GeoLocation) => g.ip === ip);
                    setSelectedMapMarker(loc || null);
                  } else {
                    setSelectedMapMarker(null);
                  }
                }}
              />
            </Suspense>
          </div>

          {/* Active Connections List with Expandable Cards */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-900">Active Connections</h4>
              <span className="text-sm text-gray-500">{intelliceil.geoLocations.length} connections</span>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {intelliceil.geoLocations.map((loc: GeoLocation) => (
                <IPDetailsCard
                  key={loc.ip}
                  location={loc}
                  onBlock={(ip) => blockIPMutation.mutate(ip)}
                  isExpanded={expandedIPs.has(loc.ip)}
                  onToggle={() => toggleIPExpansion(loc.ip)}
                />
              ))}
              {intelliceil.geoLocations.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Globe className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>No active connections</p>
                </div>
              )}
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

      {/* Security Metrics Tab - Enterprise Security Features */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Security Threat Metrics */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Security Threat Metrics</h3>
                  <p className="text-sm text-gray-500">Real-time attack detection statistics</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                SUPER_ADMIN Only
              </span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* SQL Injection Attempts */}
              <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl border border-red-200">
                <div className="flex items-center gap-2 mb-2">
                  <Bug className="w-4 h-4 text-red-600" />
                  <span className="text-xs font-medium text-red-700">SQL Injection</span>
                </div>
                <p className="text-2xl font-bold text-red-600">
                  {intelliceil.securityMetrics?.sqlInjectionAttempts || 0}
                </p>
                <p className="text-xs text-red-500 mt-1">Attempts Blocked</p>
              </div>

              {/* XSS Attempts */}
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
                <div className="flex items-center gap-2 mb-2">
                  <FileWarning className="w-4 h-4 text-orange-600" />
                  <span className="text-xs font-medium text-orange-700">XSS Attacks</span>
                </div>
                <p className="text-2xl font-bold text-orange-600">
                  {intelliceil.securityMetrics?.xssAttempts || 0}
                </p>
                <p className="text-xs text-orange-500 mt-1">Attempts Blocked</p>
              </div>

              {/* Bot Detections */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-medium text-purple-700">Bot Traffic</span>
                </div>
                <p className="text-2xl font-bold text-purple-600">
                  {intelliceil.securityMetrics?.botDetections || 0}
                </p>
                <p className="text-xs text-purple-500 mt-1">Bots Detected</p>
              </div>

              {/* Signature Failures */}
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-xl border border-amber-200">
                <div className="flex items-center gap-2 mb-2">
                  <Fingerprint className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-medium text-amber-700">Signatures</span>
                </div>
                <p className="text-2xl font-bold text-amber-600">
                  {intelliceil.securityMetrics?.signatureFailures || 0}
                </p>
                <p className="text-xs text-amber-500 mt-1">Invalid Signatures</p>
              </div>

              {/* Replay Attempts */}
              <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-4 rounded-xl border border-pink-200">
                <div className="flex items-center gap-2 mb-2">
                  <Repeat className="w-4 h-4 text-pink-600" />
                  <span className="text-xs font-medium text-pink-700">Replay Attacks</span>
                </div>
                <p className="text-2xl font-bold text-pink-600">
                  {intelliceil.securityMetrics?.replayAttempts || 0}
                </p>
                <p className="text-xs text-pink-500 mt-1">Attempts Blocked</p>
              </div>

              {/* Honeypot Hits */}
              <div className="bg-gradient-to-br from-rose-50 to-rose-100 p-4 rounded-xl border border-rose-200">
                <div className="flex items-center gap-2 mb-2">
                  <MousePointerClick className="w-4 h-4 text-rose-600" />
                  <span className="text-xs font-medium text-rose-700">Honeypot</span>
                </div>
                <p className="text-2xl font-bold text-rose-600">
                  {intelliceil.securityMetrics?.honeypotHits || 0}
                </p>
                <p className="text-xs text-rose-500 mt-1">Traps Triggered</p>
              </div>
            </div>
          </div>

          {/* Enterprise Security Features Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Security Features Toggle */}
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Shield className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Enterprise Security Features</h3>
                  <p className="text-sm text-gray-500">Toggle security modules on/off</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* HMAC Signature Validation */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Fingerprint className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="font-medium text-gray-900">HMAC Signature Validation</p>
                      <p className="text-xs text-gray-500">Validates request authenticity with SHA-256</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateConfigMutation.mutate({ enableSignatureValidation: !intelliceil.config.enableSignatureValidation })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      intelliceil.config.enableSignatureValidation ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      intelliceil.config.enableSignatureValidation ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {/* Token Fingerprinting */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-purple-500" />
                    <div>
                      <p className="font-medium text-gray-900">Token Fingerprinting</p>
                      <p className="text-xs text-gray-500">Binds tokens to device/browser to prevent theft</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateConfigMutation.mutate({ enableTokenFingerprinting: !intelliceil.config.enableTokenFingerprinting })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      intelliceil.config.enableTokenFingerprinting ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      intelliceil.config.enableTokenFingerprinting ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {/* SQL Injection Detection */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Bug className="w-5 h-5 text-red-500" />
                    <div>
                      <p className="font-medium text-gray-900">SQL Injection Detection</p>
                      <p className="text-xs text-gray-500">24 pattern detection for SQL attacks</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateConfigMutation.mutate({ enableSQLInjectionDetection: !intelliceil.config.enableSQLInjectionDetection })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      intelliceil.config.enableSQLInjectionDetection ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      intelliceil.config.enableSQLInjectionDetection ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {/* XSS Detection */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileWarning className="w-5 h-5 text-orange-500" />
                    <div>
                      <p className="font-medium text-gray-900">XSS Attack Detection</p>
                      <p className="text-xs text-gray-500">24 pattern detection for cross-site scripting</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateConfigMutation.mutate({ enableXSSDetection: !intelliceil.config.enableXSSDetection })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      intelliceil.config.enableXSSDetection ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      intelliceil.config.enableXSSDetection ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {/* Bot Detection */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Bot className="w-5 h-5 text-purple-500" />
                    <div>
                      <p className="font-medium text-gray-900">Bot Detection</p>
                      <p className="text-xs text-gray-500">User-agent + timing analysis for automation</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateConfigMutation.mutate({ enableBotDetection: !intelliceil.config.enableBotDetection })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      intelliceil.config.enableBotDetection ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      intelliceil.config.enableBotDetection ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {/* IP Reputation */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-cyan-500" />
                    <div>
                      <p className="font-medium text-gray-900">IP Reputation Check</p>
                      <p className="text-xs text-gray-500">Threat intelligence lookup for malicious IPs</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateConfigMutation.mutate({ enableIPReputation: !intelliceil.config.enableIPReputation })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      intelliceil.config.enableIPReputation ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      intelliceil.config.enableIPReputation ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Security System Info */}
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Server className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">System Information</h3>
                  <p className="text-sm text-gray-500">Cache sizes and thresholds</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* IP Reputation Cache */}
                <div className="flex items-center justify-between p-4 bg-cyan-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">IP Reputation Cache</p>
                    <p className="text-sm text-gray-500">Cached IP lookups (1 hour TTL)</p>
                  </div>
                  <span className="text-2xl font-bold text-cyan-600">
                    {intelliceil.securityMetrics?.ipReputationCacheSize || 0}
                  </span>
                </div>

                {/* Token Fingerprint Cache */}
                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Token Fingerprints</p>
                    <p className="text-sm text-gray-500">Active session fingerprints</p>
                  </div>
                  <span className="text-2xl font-bold text-purple-600">
                    {intelliceil.securityMetrics?.tokenFingerprintCacheSize || 0}
                  </span>
                </div>

                {/* Bot Detection Threshold */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900">Bot Detection Threshold</p>
                    <span className="text-lg font-bold text-gray-700">
                      {intelliceil.config.botDetectionThreshold || 70}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={intelliceil.config.botDetectionThreshold || 70}
                    onChange={(e) => updateConfigMutation.mutate({ botDetectionThreshold: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Lenient (0%)</span>
                    <span>Strict (100%)</span>
                  </div>
                </div>

                {/* Security Score */}
                <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-100 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Security Score</p>
                      <p className="text-sm text-gray-500">Based on active features</p>
                    </div>
                    <div className="text-center">
                      <span className="text-3xl font-bold text-green-600">
                        {(() => {
                          let score = 0;
                          if (intelliceil.config.enableSignatureValidation) score += 15;
                          if (intelliceil.config.enableTokenFingerprinting) score += 15;
                          if (intelliceil.config.enableSQLInjectionDetection) score += 20;
                          if (intelliceil.config.enableXSSDetection) score += 15;
                          if (intelliceil.config.enableBotDetection) score += 15;
                          if (intelliceil.config.enableIPReputation) score += 10;
                          if (intelliceil.config.autoMitigate) score += 10;
                          return score;
                        })()}
                      </span>
                      <span className="text-lg text-green-600">/100</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Honeypot Endpoints Info */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-rose-100 rounded-lg">
                <Skull className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Honeypot Trap Endpoints</h3>
                <p className="text-sm text-gray-500">These fake endpoints catch attackers and scanners</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {[
                '/admin.php',
                '/wp-admin',
                '/wp-login.php',
                '/phpmyadmin',
                '/.env',
                '/.git/config',
                '/config.php',
                '/backup.sql',
                '/database.sql',
                '/shell.php',
                '/c99.php',
                '/r57.php',
              ].map((endpoint) => (
                <div
                  key={endpoint}
                  className="px-3 py-2 bg-rose-50 text-rose-700 text-xs font-mono rounded-lg border border-rose-200"
                >
                  {endpoint}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* DETAIL MODALS FOR CLICKABLE STAT CARDS */}
      {/* ============================================ */}

      {/* Requests Per Second Modal */}
      <DetailModal
        isOpen={activeModal === 'rps'}
        onClose={() => setActiveModal(null)}
        title="Request Rate Details"
        icon={Zap}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
      >
        <div className="space-y-6">
          {/* Current Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">{intelliceil.currentRps}</p>
              <p className="text-sm text-blue-700">Current RPS</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-gray-700">{intelliceil.baseline.avgRequestsPerSecond.toFixed(1)}</p>
              <p className="text-sm text-gray-500">Baseline RPS</p>
            </div>
          </div>

          {/* Baseline Info */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Baseline Statistics
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Peak RPS:</span>
                <span className="ml-2 font-medium">{intelliceil.baseline.peakRequestsPerSecond.toFixed(1)}</span>
              </div>
              <div>
                <span className="text-gray-500">Sample Count:</span>
                <span className="ml-2 font-medium">{intelliceil.baseline.sampleCount}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">Last Updated:</span>
                <span className="ml-2 font-medium">{new Date(intelliceil.baseline.lastUpdated).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Top Endpoints */}
          <div>
            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Server className="w-4 h-4" />
              Top Endpoints
            </h4>
            <div className="space-y-2">
              {intelliceil.topEndpoints?.slice(0, 10).map((ep: { endpoint: string; count: number }, i: number) => (
                <div key={ep.endpoint} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-xs w-5">#{i + 1}</span>
                    <code className="text-sm text-gray-700 truncate max-w-[300px]">{ep.endpoint}</code>
                  </div>
                  <span className="text-sm font-medium text-gray-600">{ep.count}</span>
                </div>
              ))}
              {(!intelliceil.topEndpoints || intelliceil.topEndpoints.length === 0) && (
                <p className="text-gray-500 text-sm text-center py-4">No endpoint data available</p>
              )}
            </div>
          </div>
        </div>
      </DetailModal>

      {/* Unique IPs Modal */}
      <DetailModal
        isOpen={activeModal === 'ips'}
        onClose={() => setActiveModal(null)}
        title="IP Address Details"
        icon={Globe}
        iconBgColor="bg-purple-100"
        iconColor="text-purple-600"
      >
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-purple-600">{intelliceil.uniqueIPs}</p>
              <p className="text-xs text-purple-700">Total IPs</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-600">
                {intelliceil.geoLocations.filter((g: GeoLocation) => g.isTrusted).length}
              </p>
              <p className="text-xs text-green-700">Trusted</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">
                {intelliceil.geoLocations.filter((g: GeoLocation) => !g.isTrusted).length}
              </p>
              <p className="text-xs text-blue-700">Regular</p>
            </div>
          </div>

          {/* IP List with Expandable Details */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {intelliceil.geoLocations.map((loc: GeoLocation) => (
              <IPDetailsCard
                key={loc.ip}
                location={loc}
                onBlock={(ip) => { blockIPMutation.mutate(ip); }}
                isExpanded={expandedIPs.has(loc.ip)}
                onToggle={() => toggleIPExpansion(loc.ip)}
              />
            ))}
          </div>
        </div>
      </DetailModal>

      {/* Allowed Requests Modal */}
      <DetailModal
        isOpen={activeModal === 'allowed'}
        onClose={() => setActiveModal(null)}
        title="Allowed Traffic Details"
        icon={CheckCircle}
        iconBgColor="bg-green-100"
        iconColor="text-green-600"
      >
        <div className="space-y-6">
          {/* Stats */}
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <p className="text-4xl font-bold text-green-600">{intelliceil.allowedRequests.toLocaleString()}</p>
            <p className="text-sm text-green-700">Total Allowed Requests</p>
          </div>

          {/* Top Sources */}
          <div>
            <h4 className="font-medium text-gray-700 mb-3">Top Traffic Sources</h4>
            <div className="space-y-2">
              {intelliceil.topSources.map((source: SourceCount, i: number) => {
                const percentage = Math.round((source.count / intelliceil.allowedRequests) * 100) || 0;
                return (
                  <div key={source.source} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-700">#{i + 1} {source.source}</span>
                      <span className="text-sm text-gray-500">{source.count.toLocaleString()} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {intelliceil.topSources.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">No source data available</p>
              )}
            </div>
          </div>

          {/* Top Countries */}
          <div>
            <h4 className="font-medium text-gray-700 mb-3">Traffic by Country</h4>
            <div className="grid grid-cols-2 gap-2">
              {intelliceil.topCountries.map((country: CountryCount) => (
                <div key={country.country} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-700">{country.country || 'Unknown'}</span>
                  <span className="text-sm font-medium text-gray-600">{country.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DetailModal>

      {/* Blocked Requests Modal */}
      <DetailModal
        isOpen={activeModal === 'blocked'}
        onClose={() => setActiveModal(null)}
        title="Blocked Traffic Details"
        icon={Ban}
        iconBgColor="bg-red-100"
        iconColor="text-red-600"
      >
        <div className="space-y-6">
          {/* Stats */}
          <div className="bg-red-50 rounded-xl p-4 text-center">
            <p className="text-4xl font-bold text-red-600">{intelliceil.blockedRequests.toLocaleString()}</p>
            <p className="text-sm text-red-700">Total Blocked Requests</p>
          </div>

          {/* Threat Info */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Current Threat Status
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Threat Level:</span>
                <span className={`font-medium ${threatConfig.textColor}`}>{threatConfig.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Above Baseline:</span>
                <span className="font-medium">{intelliceil.threatLevel.percentage.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Mitigation Active:</span>
                <span className={`font-medium ${intelliceil.threatLevel.mitigationActive ? 'text-red-600' : 'text-green-600'}`}>
                  {intelliceil.threatLevel.mitigationActive ? 'Yes' : 'No'}
                </span>
              </div>
              {intelliceil.threatLevel.triggeredAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Triggered At:</span>
                  <span className="font-medium">{new Date(intelliceil.threatLevel.triggeredAt).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Blocked IPs List */}
          <div>
            <h4 className="font-medium text-gray-700 mb-3">Blocked IP Addresses</h4>
            {intelliceil.config.blockedIPs.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <Ban className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No IPs currently blocked</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {intelliceil.config.blockedIPs.map((ip: string) => (
                  <div key={ip} className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
                    <span className="font-mono text-sm text-red-800">{ip}</span>
                    <button
                      onClick={() => unblockIPMutation.mutate(ip)}
                      className="text-xs text-red-600 hover:text-red-800 hover:underline"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DetailModal>
    </div>
  );
}
