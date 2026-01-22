import { useState } from 'react';
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
  Pause,
  Square,
  Eye,
  ChevronDown,
  ChevronUp,
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
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
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
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [showPanicConfirm, setShowPanicConfirm] = useState(false);
  const [panicReason, setPanicReason] = useState('');
  const [activeTab, setActiveTab] = useState<'endpoints' | 'services'>('endpoints');
  
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
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
            <span className="text-gray-600 text-sm">Services Stopped</span>
            <Square className="w-5 h-5 text-gray-500" />
          </div>
          <p className="text-2xl font-bold text-gray-600 mt-1">{dashboard?.summary?.stoppedServices || 0}</p>
        </div>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
        {categories.map((cat: CategorySummary) => (
          <button
            key={cat.category}
            onClick={() => setSelectedCategory(selectedCategory === cat.category ? null : cat.category)}
            className={`p-3 rounded-lg border transition-all ${
              selectedCategory === cat.category
                ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
                : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-center mb-2">
              <CategoryIcon category={cat.category} />
            </div>
            <p className="text-xs font-medium text-gray-700 capitalize truncate">{cat.category}</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              {cat.healthy > 0 && <span className="w-2 h-2 rounded-full bg-green-500"></span>}
              {cat.degraded > 0 && <span className="w-2 h-2 rounded-full bg-yellow-500"></span>}
              {cat.down > 0 && <span className="w-2 h-2 rounded-full bg-red-500"></span>}
              <span className="text-xs text-gray-500">{cat.totalEndpoints}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('endpoints')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'endpoints'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Network className="w-4 h-4 inline mr-2" />
            Endpoints ({dashboard?.endpoints?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('services')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'services'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Server className="w-4 h-4 inline mr-2" />
            Services ({dashboard?.services?.length || 0})
          </button>
        </nav>
      </div>

      {/* Search */}
      {activeTab === 'endpoints' && (
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search endpoints by path or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      {/* Endpoints Tab */}
      {activeTab === 'endpoints' && (
        <div className="space-y-4">
          {Object.entries(groupedEndpoints).map(([category, endpoints]: [string, EndpointInfo[]]) => (
            <div key={category} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                <CategoryIcon category={category} />
                <span className="font-semibold text-gray-700 capitalize">{category}</span>
                <span className="text-sm text-gray-500">({endpoints.length} endpoints)</span>
              </div>
              <div className="divide-y divide-gray-100">
                {endpoints.map((endpoint: EndpointInfo) => (
                  <div key={endpoint.id} className="hover:bg-gray-50 transition-colors">
                    <div 
                      className="px-4 py-3 flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedEndpoint(expandedEndpoint === endpoint.id ? null : endpoint.id)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <MethodBadge method={endpoint.method} />
                        <code className="text-sm font-mono text-gray-700 truncate">{endpoint.path}</code>
                        <span className="text-sm text-gray-500 hidden lg:inline">- {endpoint.description}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {endpoint.protected && (
                          <span title="Protected endpoint">
                            <Lock className="w-4 h-4 text-gray-400" />
                          </span>
                        )}
                        {endpoint.rateLimit && (
                          <span className="text-xs text-gray-400" title="Rate limit">
                            {endpoint.rateLimit}/min
                          </span>
                        )}
                        {endpoint.avgResponseTime > 0 && (
                          <span className={`text-xs ${
                            endpoint.avgResponseTime < 200 ? 'text-green-600' :
                            endpoint.avgResponseTime < 500 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {endpoint.avgResponseTime}ms
                          </span>
                        )}
                        <StatusBadge status={endpoint.status} />
                        {expandedEndpoint === endpoint.id ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                    
                    {/* Expanded Details */}
                    {expandedEndpoint === endpoint.id && (
                      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Total Requests</span>
                            <p className="font-semibold">{endpoint.requestCount.toLocaleString()}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Errors</span>
                            <p className="font-semibold text-red-600">{endpoint.errorCount.toLocaleString()}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Avg Response</span>
                            <p className="font-semibold">{endpoint.avgResponseTime}ms</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Last Checked</span>
                            <p className="font-semibold">
                              {endpoint.lastChecked 
                                ? formatDistanceToNow(new Date(endpoint.lastChecked), { addSuffix: true })
                                : 'Never'}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              healthCheckMutation.mutate(endpoint.id);
                            }}
                            disabled={healthCheckMutation.isPending}
                            className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors flex items-center gap-1"
                          >
                            <Activity className="w-3 h-3" />
                            Health Check
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`${window.location.origin}${endpoint.path.replace(/:[\w]+/g, 'test')}`, '_blank');
                            }}
                            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Open
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {filteredEndpoints.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Network className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No endpoints found matching your criteria</p>
            </div>
          )}
        </div>
      )}

      {/* Services Tab */}
      {activeTab === 'services' && (
        <div className="grid gap-4 md:grid-cols-2">
          {dashboard?.services?.map((service: ServiceInfo) => (
            <div 
              key={service.id} 
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <div 
                className="p-4 cursor-pointer"
                onClick={() => setExpandedService(expandedService === service.id ? null : service.id)}
              >
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
                    {expandedService === service.id ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
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

              {/* Expanded Controls */}
              {expandedService === service.id && (
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
                        className="px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg text-sm font-medium hover:bg-yellow-200 transition-colors flex items-center gap-1"
                      >
                        <Pause className="w-3 h-3" />
                        Pause
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
                    {service.canStop && (
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // View details action - could open a modal or navigate
                      }}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      View Details
                    </button>
                  </div>
                  
                  <div className="mt-3 text-xs text-gray-500">
                    Last health check: {service.lastHealthCheck 
                      ? formatDistanceToNow(new Date(service.lastHealthCheck), { addSuffix: true })
                      : 'Never'}
                  </div>
                </div>
              )}
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
