import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Server,
  Database,
  Zap,
  Globe,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Play,
  Square,
  Eye,
  AlertOctagon,
  Shield,
  Cloud,
  Cpu,
  HardDrive,
  Network,
  Lock,
  Terminal,
  Code,
  Layers,
  Box,
  ExternalLink,
  Search,
  RotateCcw,
  PowerOff,
  X,
  Info,
  TrendingUp,
  BarChart3,
  History,
  ShieldCheck,
  ShieldAlert,
  Timer,
  Gauge,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { apiDashboardApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

// Simple time ago formatter (replaces date-fns)
function formatDistanceToNow(date: Date, options?: { addSuffix?: boolean }): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  let result: string;
  if (diffSecs < 60) {
    result = 'less than a minute';
  } else if (diffMins < 60) {
    result = `${diffMins} minute${diffMins === 1 ? '' : 's'}`;
  } else if (diffHours < 24) {
    result = `${diffHours} hour${diffHours === 1 ? '' : 's'}`;
  } else if (diffDays < 30) {
    result = `${diffDays} day${diffDays === 1 ? '' : 's'}`;
  } else {
    result = 'over a month';
  }
  
  return options?.addSuffix ? `${result} ago` : result;
}

// ============================================
// Types
// ============================================

interface EndpointInfo {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description: string;
  category: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  lastChecked: string | null;
  responseTime: number | null;
  errorCount: number;
  requestCount: number;
  avgResponseTime: number;
  protected: boolean;
  rateLimit: number | null;
}

interface ServiceInfo {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'stopped' | 'degraded' | 'unknown';
  type: 'core' | 'worker' | 'database' | 'cache' | 'external';
  uptime: number | null;
  lastHealthCheck: string | null;
  metrics: {
    requestsPerMinute: number;
    errorRate: number;
    avgResponseTime: number;
    memoryUsage: number | null;
    cpuUsage: number | null;
  };
  canStop: boolean;
  canRestart: boolean;
}

interface CategorySummary {
  category: string;
  totalEndpoints: number;
  healthy: number;
  degraded: number;
  down: number;
  unknown: number;
}

interface ServerRuntime {
  uptime: number;
  startedAt: string;
}

// ============================================
// Helper Components
// ============================================

const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    healthy: { bg: 'bg-green-100', text: 'text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
    running: { bg: 'bg-green-100', text: 'text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
    degraded: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <AlertTriangle className="w-3 h-3" /> },
    down: { bg: 'bg-red-100', text: 'text-red-800', icon: <XCircle className="w-3 h-3" /> },
    stopped: { bg: 'bg-gray-100', text: 'text-gray-800', icon: <Square className="w-3 h-3" /> },
    unknown: { bg: 'bg-gray-100', text: 'text-gray-600', icon: <Clock className="w-3 h-3" /> },
  };

  const { bg, text, icon } = config[status] || config.unknown;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      {icon}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const MethodBadge = ({ method }: { method: string }) => {
  const colors: Record<string, string> = {
    GET: 'bg-blue-100 text-blue-800',
    POST: 'bg-green-100 text-green-800',
    PUT: 'bg-yellow-100 text-yellow-800',
    DELETE: 'bg-red-100 text-red-800',
    PATCH: 'bg-purple-100 text-purple-800',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${colors[method] || 'bg-gray-100 text-gray-800'}`}>
      {method}
    </span>
  );
};

const CategoryIcon = ({ category }: { category: string }) => {
  const icons: Record<string, React.ReactNode> = {
    auth: <Lock className="w-4 h-4" />,
    facebook: <Globe className="w-4 h-4" />,
    extension: <Layers className="w-4 h-4" />,
    vehicle: <Box className="w-4 h-4" />,
    sync: <RefreshCw className="w-4 h-4" />,
    admin: <Shield className="w-4 h-4" />,
    subscription: <Zap className="w-4 h-4" />,
    ai: <Cpu className="w-4 h-4" />,
    security: <Shield className="w-4 h-4" />,
    other: <Code className="w-4 h-4" />,
  };

  return icons[category] || <Code className="w-4 h-4" />;
};

const ServiceIcon = ({ type }: { type: string }) => {
  const icons: Record<string, React.ReactNode> = {
    core: <Server className="w-5 h-5" />,
    worker: <Cpu className="w-5 h-5" />,
    database: <Database className="w-5 h-5" />,
    cache: <HardDrive className="w-5 h-5" />,
    external: <Cloud className="w-5 h-5" />,
  };

  return icons[type] || <Server className="w-5 h-5" />;
};

const formatUptime = (seconds: number | null): string => {
  if (seconds === null) return 'N/A';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
};

// ============================================
// Endpoint Detail Modal
// ============================================

interface EndpointDetailModalProps {
  endpoint: EndpointInfo;
  onClose: () => void;
  onHealthCheck: () => void;
  isHealthCheckPending: boolean;
}

const EndpointDetailModal = ({ endpoint, onClose, onHealthCheck, isHealthCheckPending }: EndpointDetailModalProps) => {
  const [detailsData, setDetailsData] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(true);

  // Fetch additional details
  useEffect(() => {
    apiDashboardApi.getEndpointDetails(endpoint.id)
      .then(data => {
        setDetailsData(data);
        setLoadingDetails(false);
      })
      .catch(() => setLoadingDetails(false));
  }, [endpoint.id]);

  const getResponseTimeColor = (time: number | null) => {
    if (time === null) return 'text-gray-500';
    if (time < 100) return 'text-green-600';
    if (time < 500) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getResponseTimeBg = (time: number | null) => {
    if (time === null) return 'bg-gray-100';
    if (time < 100) return 'bg-green-100';
    if (time < 500) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getTrendIcon = () => {
    if (endpoint.avgResponseTime === 0 || endpoint.responseTime === null) {
      return <Minus className="w-4 h-4 text-gray-400" />;
    }
    if (endpoint.responseTime < endpoint.avgResponseTime) {
      return <ArrowDownRight className="w-4 h-4 text-green-500" />;
    }
    return <ArrowUpRight className="w-4 h-4 text-red-500" />;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <CategoryIcon category={endpoint.category} />
              </div>
              <div>
                <h2 className="text-xl font-bold">{endpoint.description}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <MethodBadge method={endpoint.method} />
                  <code className="text-sm bg-white/20 px-2 py-0.5 rounded">{endpoint.path}</code>
                </div>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Status Row */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <StatusBadge status={endpoint.status} />
              <span className="text-sm text-gray-500">
                ID: <code className="bg-gray-100 px-2 py-0.5 rounded">{endpoint.id}</code>
              </span>
            </div>
            <button
              onClick={onHealthCheck}
              disabled={isHealthCheckPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Activity className={`w-4 h-4 ${isHealthCheckPending ? 'animate-pulse' : ''}`} />
              {isHealthCheckPending ? 'Checking...' : 'Run Health Check'}
            </button>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className={`p-4 rounded-xl ${getResponseTimeBg(endpoint.responseTime)}`}>
              <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                <Gauge className="w-4 h-4" />
                Last Response
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${getResponseTimeColor(endpoint.responseTime)}`}>
                  {endpoint.responseTime !== null ? `${endpoint.responseTime}ms` : 'N/A'}
                </span>
                {getTrendIcon()}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-blue-50">
              <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                <BarChart3 className="w-4 h-4" />
                Avg Response
              </div>
              <span className="text-2xl font-bold text-blue-600">
                {endpoint.avgResponseTime}ms
              </span>
            </div>

            <div className="p-4 rounded-xl bg-green-50">
              <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                <TrendingUp className="w-4 h-4" />
                Total Requests
              </div>
              <span className="text-2xl font-bold text-green-600">
                {endpoint.requestCount.toLocaleString()}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-red-50">
              <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                <AlertCircle className="w-4 h-4" />
                Errors
              </div>
              <span className="text-2xl font-bold text-red-600">
                {endpoint.errorCount}
              </span>
            </div>
          </div>

          {/* Security & Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Security Info */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                Security Configuration
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Authentication</span>
                  {endpoint.protected ? (
                    <span className="flex items-center gap-1 text-green-600 font-medium">
                      <Lock className="w-4 h-4" /> Required
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-yellow-600 font-medium">
                      <ShieldAlert className="w-4 h-4" /> Public
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Rate Limit</span>
                  <span className="font-medium">
                    {endpoint.rateLimit ? `${endpoint.rateLimit} req/min` : 'Unlimited'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Category</span>
                  <span className="flex items-center gap-1 font-medium capitalize">
                    <CategoryIcon category={endpoint.category} />
                    {endpoint.category}
                  </span>
                </div>
              </div>
            </div>

            {/* Timing Info */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Timer className="w-5 h-5 text-blue-600" />
                Timing Information
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Last Checked</span>
                  <span className="font-medium">
                    {endpoint.lastChecked 
                      ? formatDistanceToNow(new Date(endpoint.lastChecked), { addSuffix: true })
                      : 'Never'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Error Rate</span>
                  <span className={`font-medium ${
                    endpoint.requestCount > 0 && (endpoint.errorCount / endpoint.requestCount) > 0.05
                      ? 'text-red-600'
                      : 'text-green-600'
                  }`}>
                    {endpoint.requestCount > 0 
                      ? ((endpoint.errorCount / endpoint.requestCount) * 100).toFixed(2) + '%'
                      : '0%'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Success Rate</span>
                  <span className="font-medium text-green-600">
                    {endpoint.requestCount > 0 
                      ? (((endpoint.requestCount - endpoint.errorCount) / endpoint.requestCount) * 100).toFixed(2) + '%'
                      : '100%'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Requests - if we have detailed data */}
          {loadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : detailsData?.recentRequests?.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                Recent Activity
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {detailsData.recentRequests.slice(0, 10).map((req: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-sm bg-white p-2 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">
                        {new Date(req.createdAt).toLocaleTimeString()}
                      </span>
                      <span className="text-gray-600">
                        {req.user?.email || 'System'}
                      </span>
                    </div>
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                      {req.metadata?.statusCode || 'N/A'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Endpoint ID: {endpoint.id}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Service Detail Modal
// ============================================

interface ServiceDetailModalProps {
  service: ServiceInfo;
  onClose: () => void;
  onControl: (action: string) => void;
  isControlPending: boolean;
}

const ServiceDetailModal = ({ service, onClose, onControl, isControlPending }: ServiceDetailModalProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'from-green-500 to-emerald-600';
      case 'stopped': return 'from-gray-500 to-gray-600';
      case 'degraded': return 'from-yellow-500 to-orange-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`bg-gradient-to-r ${getStatusColor(service.status)} text-white px-6 py-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <ServiceIcon type={service.type} />
              </div>
              <div>
                <h2 className="text-xl font-bold">{service.name}</h2>
                <p className="text-sm opacity-90">{service.description}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Status & Controls */}
          <div className="flex items-center justify-between mb-6">
            <StatusBadge status={service.status} />
            <div className="flex gap-2">
              {service.canRestart && (
                <button
                  onClick={() => onControl('restart')}
                  disabled={isControlPending}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restart
                </button>
              )}
              {service.canStop && service.status === 'running' && (
                <button
                  onClick={() => onControl('stop')}
                  disabled={isControlPending}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Square className="w-4 h-4" />
                  Stop
                </button>
              )}
              {service.canStop && service.status === 'stopped' && (
                <button
                  onClick={() => onControl('start')}
                  disabled={isControlPending}
                  className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  Start
                </button>
              )}
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-blue-50">
              <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                <Timer className="w-4 h-4" />
                Uptime
              </div>
              <span className="text-2xl font-bold text-blue-600">
                {formatUptime(service.uptime)}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-green-50">
              <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                <Gauge className="w-4 h-4" />
                Avg Response
              </div>
              <span className="text-2xl font-bold text-green-600">
                {service.metrics.avgResponseTime}ms
              </span>
            </div>

            {service.metrics.memoryUsage !== null && (
              <div className="p-4 rounded-xl bg-purple-50">
                <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                  <HardDrive className="w-4 h-4" />
                  Memory
                </div>
                <span className="text-2xl font-bold text-purple-600">
                  {service.metrics.memoryUsage}MB
                </span>
              </div>
            )}

            <div className="p-4 rounded-xl bg-yellow-50">
              <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                <TrendingUp className="w-4 h-4" />
                Requests/min
              </div>
              <span className="text-2xl font-bold text-yellow-600">
                {service.metrics.requestsPerMinute}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-red-50">
              <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                <AlertCircle className="w-4 h-4" />
                Error Rate
              </div>
              <span className="text-2xl font-bold text-red-600">
                {(service.metrics.errorRate * 100).toFixed(2)}%
              </span>
            </div>

            {service.metrics.cpuUsage !== null && (
              <div className="p-4 rounded-xl bg-orange-50">
                <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                  <Cpu className="w-4 h-4" />
                  CPU Usage
                </div>
                <span className="text-2xl font-bold text-orange-600">
                  {service.metrics.cpuUsage}%
                </span>
              </div>
            )}
          </div>

          {/* Service Info */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              Service Configuration
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Type</span>
                <span className="flex items-center gap-1 font-medium capitalize">
                  <ServiceIcon type={service.type} />
                  {service.type}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Can Stop</span>
                <span className={`font-medium ${service.canStop ? 'text-green-600' : 'text-red-600'}`}>
                  {service.canStop ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Can Restart</span>
                <span className={`font-medium ${service.canRestart ? 'text-green-600' : 'text-red-600'}`}>
                  {service.canRestart ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Last Health Check</span>
                <span className="font-medium">
                  {service.lastHealthCheck 
                    ? formatDistanceToNow(new Date(service.lastHealthCheck), { addSuffix: true })
                    : 'Never'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Service ID: {service.id}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Main Component
// ============================================

export default function APIDashboardPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  
  // State
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPanicConfirm, setShowPanicConfirm] = useState(false);
  const [panicReason, setPanicReason] = useState('');
  const [activeTab, setActiveTab] = useState<'endpoints' | 'services'>('endpoints');
  const [selectedEndpointForModal, setSelectedEndpointForModal] = useState<EndpointInfo | null>(null);
  const [selectedServiceForModal, setSelectedServiceForModal] = useState<ServiceInfo | null>(null);
  
  // Queries
  const { data: dashboard, isLoading, refetch } = useQuery({
    queryKey: ['api-dashboard'],
    queryFn: apiDashboardApi.getDashboard,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['api-dashboard-categories'],
    queryFn: apiDashboardApi.getCategories,
    refetchInterval: 30000,
  });

  // Mutations
  const healthCheckMutation = useMutation({
    mutationFn: (endpointId: string) => apiDashboardApi.checkEndpointHealth(endpointId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-dashboard'] });
      toast.success('Health check completed');
    },
    onError: () => toast.error('Health check failed'),
  });

  const fullHealthCheckMutation = useMutation({
    mutationFn: apiDashboardApi.runFullHealthCheck,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['api-dashboard'] });
      toast.success(`Health check complete: ${data.summary.healthy} healthy, ${data.summary.down} down`);
    },
    onError: () => toast.error('Full health check failed'),
  });

  const serviceControlMutation = useMutation({
    mutationFn: ({ serviceId, action }: { serviceId: string; action: string }) =>
      apiDashboardApi.controlService(serviceId, action),
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['api-dashboard'] });
      toast.success(`Service ${action} command sent`);
    },
    onError: (error: Error) => toast.error(error.message || 'Service control failed'),
  });

  const panicModeMutation = useMutation({
    mutationFn: (reason?: string) => apiDashboardApi.activatePanicMode(reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-dashboard'] });
      toast.warning('🚨 PANIC MODE ACTIVATED - All non-essential services stopped');
      setShowPanicConfirm(false);
      setPanicReason('');
    },
    onError: () => toast.error('Failed to activate panic mode'),
  });

  const deactivatePanicMutation = useMutation({
    mutationFn: apiDashboardApi.deactivatePanicMode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-dashboard'] });
      toast.success('Panic mode deactivated - Services resuming');
    },
    onError: () => toast.error('Failed to deactivate panic mode'),
  });

  // Filter endpoints
  const filteredEndpoints: EndpointInfo[] = (dashboard?.endpoints || []).filter((ep: EndpointInfo) => {
    const matchesCategory = !selectedCategory || ep.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Group endpoints by category
  const groupedEndpoints = filteredEndpoints.reduce<Record<string, EndpointInfo[]>>((acc, ep) => {
    if (!acc[ep.category]) acc[ep.category] = [];
    acc[ep.category].push(ep);
    return acc;
  }, {});

  const categories = categoriesData?.categories || [];
  const serverRuntime: ServerRuntime | null = dashboard?.serverRuntime || null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Endpoint Detail Modal */}
      {selectedEndpointForModal && (
        <EndpointDetailModal
          endpoint={selectedEndpointForModal}
          onClose={() => setSelectedEndpointForModal(null)}
          onHealthCheck={() => healthCheckMutation.mutate(selectedEndpointForModal.id)}
          isHealthCheckPending={healthCheckMutation.isPending}
        />
      )}

      {/* Service Detail Modal */}
      {selectedServiceForModal && (
        <ServiceDetailModal
          service={selectedServiceForModal}
          onClose={() => setSelectedServiceForModal(null)}
          onControl={(action) => serviceControlMutation.mutate({ serviceId: selectedServiceForModal.id, action })}
          isControlPending={serviceControlMutation.isPending}
        />
      )}

      {/* Panic Mode Banner */}
      {dashboard?.panicMode?.active && (
        <div className="bg-red-600 text-white p-4 rounded-lg flex items-center justify-between shadow-lg animate-pulse">
          <div className="flex items-center gap-3">
            <AlertOctagon className="w-8 h-8" />
            <div>
              <h3 className="font-bold text-lg">🚨 PANIC MODE ACTIVE</h3>
              <p className="text-sm opacity-90">
                Activated by {dashboard.panicMode.activatedBy} • {' '}
                {dashboard.panicMode.activatedAt && formatDistanceToNow(new Date(dashboard.panicMode.activatedAt), { addSuffix: true })}
              </p>
            </div>
          </div>
          <button
            onClick={() => deactivatePanicMutation.mutate()}
            disabled={deactivatePanicMutation.isPending}
            className="px-4 py-2 bg-white text-red-600 font-semibold rounded-lg hover:bg-red-50 transition-colors"
          >
            {deactivatePanicMutation.isPending ? 'Deactivating...' : 'Deactivate Panic Mode'}
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Terminal className="w-7 h-7 text-blue-600" />
            API Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Monitor and manage all API endpoints and services
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <button
            onClick={() => fullHealthCheckMutation.mutate()}
            disabled={fullHealthCheckMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Activity className={`w-4 h-4 ${fullHealthCheckMutation.isPending ? 'animate-pulse' : ''}`} />
            {fullHealthCheckMutation.isPending ? 'Checking...' : 'Full Health Check'}
          </button>

          {!dashboard?.panicMode?.active && (
            <button
              onClick={() => setShowPanicConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 transition-colors"
            >
              <PowerOff className="w-4 h-4" />
              PANIC
            </button>
          )}
        </div>
      </div>

      {/* Server Runtime Card */}
      {serverRuntime && (
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-lg">
                <Server className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">API Server Running</h3>
                <p className="text-white/80 text-sm">
                  Started {formatDistanceToNow(new Date(serverRuntime.startedAt), { addSuffix: true })}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{formatUptime(serverRuntime.uptime)}</div>
              <div className="text-white/80 text-sm">Uptime</div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 text-sm">Total Endpoints</span>
            <Network className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold mt-1">{dashboard?.summary?.totalEndpoints || 0}</p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 text-sm">Healthy</span>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600 mt-1">{dashboard?.summary?.healthyEndpoints || 0}</p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 text-sm">Degraded</span>
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{dashboard?.summary?.degradedEndpoints || 0}</p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 text-sm">Down</span>
            <XCircle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600 mt-1">{dashboard?.summary?.downEndpoints || 0}</p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 text-sm">Services Running</span>
            <Server className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600 mt-1">{dashboard?.summary?.runningServices || 0}</p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 text-sm">Unknown</span>
            <Clock className="w-5 h-5 text-gray-500" />
          </div>
          <p className="text-2xl font-bold text-gray-600 mt-1">{dashboard?.summary?.unknownEndpoints || 0}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('endpoints')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'endpoints'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4" />
            API Endpoints ({dashboard?.endpoints?.length || 0})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('services')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'services'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4" />
            Services ({dashboard?.services?.length || 0})
          </div>
        </button>
      </div>

      {/* Endpoints Tab */}
      {activeTab === 'endpoints' && (
        <>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search endpoints..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  !selectedCategory
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {categories.map((cat: CategorySummary) => (
                <button
                  key={cat.category}
                  onClick={() => setSelectedCategory(cat.category)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                    selectedCategory === cat.category
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <CategoryIcon category={cat.category} />
                  <span className="capitalize">{cat.category}</span>
                  <span className="text-xs opacity-70">({cat.totalEndpoints})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Endpoints List */}
          <div className="space-y-6">
            {Object.entries(groupedEndpoints).map(([category, endpoints]) => (
              <div key={category} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                  <CategoryIcon category={category} />
                  <h3 className="font-semibold text-gray-900 capitalize">{category}</h3>
                  <span className="text-sm text-gray-500">({endpoints.length} endpoints)</span>
                </div>

                <div className="divide-y divide-gray-100">
                  {endpoints.map((endpoint: EndpointInfo) => (
                    <div 
                      key={endpoint.id} 
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedEndpointForModal(endpoint)}
                    >
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <MethodBadge method={endpoint.method} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <code className="text-sm font-mono text-gray-700 truncate">
                                {endpoint.path}
                              </code>
                              {endpoint.protected && (
                                <span title="Requires authentication">
                                  <Lock className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{endpoint.description}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 ml-4">
                          <div className="text-right text-xs text-gray-500 hidden md:block">
                            <div>{endpoint.responseTime !== null ? `${endpoint.responseTime}ms` : '-'}</div>
                            <div className="text-gray-400">{endpoint.requestCount} req</div>
                          </div>
                          <StatusBadge status={endpoint.status} />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              healthCheckMutation.mutate(endpoint.id);
                            }}
                            disabled={healthCheckMutation.isPending}
                            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                            title="Run health check"
                          >
                            <Activity className={`w-4 h-4 text-gray-500 ${healthCheckMutation.isPending ? 'animate-pulse' : ''}`} />
                          </button>
                          <ExternalLink className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Services Tab */}
      {activeTab === 'services' && (
        <div className="grid gap-4 md:grid-cols-2">
          {dashboard?.services?.map((service: ServiceInfo) => (
            <div 
              key={service.id} 
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedServiceForModal(service)}
            >
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      service.status === 'running' ? 'bg-green-100 text-green-600' :
                      service.status === 'stopped' ? 'bg-gray-100 text-gray-600' :
                      service.status === 'degraded' ? 'bg-yellow-100 text-yellow-600' :
                      'bg-gray-100 text-gray-400'
                    }`}>
                      <ServiceIcon type={service.type} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{service.name}</h3>
                      <p className="text-sm text-gray-500">{service.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={service.status} />
                    <Eye className="w-4 h-4 text-gray-400" />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Type</span>
                    <p className="font-medium capitalize">{service.type}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Uptime</span>
                    <p className="font-medium">{formatUptime(service.uptime)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Avg Response</span>
                    <p className="font-medium">{service.metrics.avgResponseTime}ms</p>
                  </div>
                </div>

                {service.metrics.memoryUsage !== null && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Memory Usage</span>
                      <span>{service.metrics.memoryUsage}MB</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full ${
                          service.metrics.memoryUsage < 500 ? 'bg-green-500' :
                          service.metrics.memoryUsage < 1000 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min((service.metrics.memoryUsage / 2000) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                <div className="flex flex-wrap gap-2">
                  {service.canRestart && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        serviceControlMutation.mutate({ serviceId: service.id, action: 'restart' });
                      }}
                      disabled={serviceControlMutation.isPending}
                      className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Restart
                    </button>
                  )}
                  {service.canStop && service.status === 'running' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        serviceControlMutation.mutate({ serviceId: service.id, action: 'stop' });
                      }}
                      disabled={serviceControlMutation.isPending}
                      className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors flex items-center gap-1"
                    >
                      <Square className="w-3 h-3" />
                      Stop
                    </button>
                  )}
                  {service.canStop && service.status === 'stopped' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        serviceControlMutation.mutate({ serviceId: service.id, action: 'start' });
                      }}
                      disabled={serviceControlMutation.isPending}
                      className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors flex items-center gap-1"
                    >
                      <Play className="w-3 h-3" />
                      Start
                    </button>
                  )}
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Last health check: {service.lastHealthCheck 
                    ? formatDistanceToNow(new Date(service.lastHealthCheck), { addSuffix: true })
                    : 'Never'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Panic Mode Confirmation Modal */}
      {showPanicConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertOctagon className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Activate Panic Mode?</h2>
                <p className="text-sm text-gray-500">This will stop all non-essential services</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-red-800 mb-2">The following will be stopped:</h4>
              <ul className="text-sm text-red-700 space-y-1">
                <li>• Browser Workers (posting automation)</li>
                <li>• Sync Scheduler (vehicle sync)</li>
                <li>• AutoPost Scheduler (scheduled posts)</li>
              </ul>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason (optional)
              </label>
              <textarea
                value={panicReason}
                onChange={(e) => setPanicReason(e.target.value)}
                placeholder="Enter reason for activating panic mode..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                rows={2}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPanicConfirm(false);
                  setPanicReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => panicModeMutation.mutate(panicReason || undefined)}
                disabled={panicModeMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors flex items-center justify-center gap-2"
              >
                <PowerOff className="w-4 h-4" />
                {panicModeMutation.isPending ? 'Activating...' : 'ACTIVATE PANIC'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Last Updated Footer */}
      <div className="text-center text-sm text-gray-500">
        Last updated: {dashboard?.lastUpdated 
          ? formatDistanceToNow(new Date(dashboard.lastUpdated), { addSuffix: true })
          : 'N/A'}
        <span className="mx-2">•</span>
        Auto-refresh every 30 seconds
      </div>
    </div>
  );
}
