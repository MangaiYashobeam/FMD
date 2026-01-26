import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Route,
  Shield,
  Zap,
  Clock,
  Activity,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Search,
  RefreshCw,
  Unlock,
  BarChart3,
  Globe,
  Layers,
  Database,
  Cpu,
  MessageCircle,
  Copy,
  Check,
} from 'lucide-react';
import { apiDashboardApi } from '../../lib/api';

// App Version
const APP_VERSION = '3.1.0';

// GREEN ROUTE endpoints - these bypass rate limiting
const GREEN_ROUTES = [
  {
    category: 'Extension',
    icon: Layers,
    color: 'blue',
    routes: [
      { path: '/api/extension/status/:accountId', method: 'GET', description: 'Check extension online status', pollingInterval: '15s', bypassReason: 'Real-time status tracking' },
      { path: '/api/extension/heartbeat', method: 'POST', description: 'Extension heartbeat ping', pollingInterval: '30s', bypassReason: 'Keep-alive connection' },
      { path: '/api/extension/tasks/:accountId', method: 'GET', description: 'Get pending automation tasks', pollingInterval: '5s', bypassReason: 'Task queue polling' },
    ]
  },
  {
    category: 'Admin Dashboard',
    icon: BarChart3,
    color: 'purple',
    routes: [
      { path: '/api/admin/stats', method: 'GET', description: 'Dashboard statistics', pollingInterval: '30s', bypassReason: 'Real-time metrics' },
      { path: '/api/admin/accounts', method: 'GET', description: 'Account list', pollingInterval: '60s', bypassReason: 'Admin monitoring' },
      { path: '/api/api-dashboard/*', method: 'GET', description: 'API dashboard data', pollingInterval: '30s', bypassReason: 'System monitoring' },
    ]
  },
  {
    category: 'AI Center',
    icon: Cpu,
    color: 'green',
    routes: [
      { path: '/api/ai-center/dashboard', method: 'GET', description: 'AI metrics dashboard', pollingInterval: '10s', bypassReason: 'Real-time AI status' },
      { path: '/api/ai-center/chat', method: 'POST', description: 'AI chat requests', pollingInterval: 'On-demand', bypassReason: 'User interaction' },
    ]
  },
  {
    category: 'IAI Training',
    icon: Zap,
    color: 'yellow',
    routes: [
      { path: '/api/iai/pattern', method: 'GET', description: 'IAI pattern detection', pollingInterval: '5s', bypassReason: 'Training data collection' },
      { path: '/api/training/console', method: 'GET', description: 'Training console output', pollingInterval: '2s', bypassReason: 'Live training feedback' },
    ]
  },
  {
    category: 'Injection System',
    icon: Database,
    color: 'indigo',
    routes: [
      { path: '/api/injection/stats', method: 'GET', description: 'Injection statistics', pollingInterval: '30s', bypassReason: 'Performance monitoring' },
      { path: '/api/injection/containers', method: 'GET', description: 'Container status', pollingInterval: '30s', bypassReason: 'Infrastructure monitoring' },
    ]
  },
  {
    category: 'Messages',
    icon: MessageCircle,
    color: 'pink',
    routes: [
      { path: '/api/messages/conversations', method: 'GET', description: 'Conversation list', pollingInterval: '30s', bypassReason: 'Real-time messaging' },
      { path: '/api/notifications/stream', method: 'GET', description: 'SSE notification stream', pollingInterval: 'Persistent', bypassReason: 'Server-sent events' },
    ]
  },
  {
    category: 'Facebook OAuth',
    icon: Globe,
    color: 'blue',
    routes: [
      { path: '/api/facebook/callback', method: 'GET', description: 'OAuth callback', pollingInterval: 'On-demand', bypassReason: 'Authentication flow' },
      { path: '/api/auth/facebook/callback', method: 'GET', description: 'FB auth callback', pollingInterval: 'On-demand', bypassReason: 'Authentication flow' },
      { path: '/api/config/facebook', method: 'GET', description: 'FB configuration', pollingInterval: '60s', bypassReason: 'Config caching' },
    ]
  },
  {
    category: 'Health Checks',
    icon: Activity,
    color: 'emerald',
    routes: [
      { path: '/api/health', method: 'GET', description: 'API health check', pollingInterval: '30s', bypassReason: 'Uptime monitoring' },
    ]
  },
];

// Calculate totals
const TOTAL_GREEN_ROUTES = GREEN_ROUTES.reduce((acc, cat) => acc + cat.routes.length, 0);

export default function GreenRoutesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(GREEN_ROUTES.map(c => c.category)));
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<any | null>(null);

  // Fetch API dashboard data for metrics - query active for future use
  const { isLoading, refetch } = useQuery({
    queryKey: ['api-dashboard'],
    queryFn: apiDashboardApi.getDashboard,
    refetchInterval: 30000,
  });

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const copyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  // Filter routes by search
  const filteredRoutes = GREEN_ROUTES.map(category => ({
    ...category,
    routes: category.routes.filter(route =>
      route.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      route.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.routes.length > 0);

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string; light: string }> = {
      blue: { bg: 'bg-blue-600', text: 'text-blue-600', border: 'border-blue-600', light: 'bg-blue-50' },
      purple: { bg: 'bg-purple-600', text: 'text-purple-600', border: 'border-purple-600', light: 'bg-purple-50' },
      green: { bg: 'bg-green-600', text: 'text-green-600', border: 'border-green-600', light: 'bg-green-50' },
      yellow: { bg: 'bg-yellow-500', text: 'text-yellow-600', border: 'border-yellow-500', light: 'bg-yellow-50' },
      indigo: { bg: 'bg-indigo-600', text: 'text-indigo-600', border: 'border-indigo-600', light: 'bg-indigo-50' },
      pink: { bg: 'bg-pink-600', text: 'text-pink-600', border: 'border-pink-600', light: 'bg-pink-50' },
      emerald: { bg: 'bg-emerald-600', text: 'text-emerald-600', border: 'border-emerald-600', light: 'bg-emerald-50' },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Route className="w-7 h-7 text-green-600" />
            </div>
            Green Routes Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            High-frequency API endpoints that bypass rate limiting for real-time functionality
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            v{APP_VERSION}
          </div>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Route className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-green-100">Total Green Routes</p>
              <p className="text-2xl font-bold">{TOTAL_GREEN_ROUTES}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-blue-100">Categories</p>
              <p className="text-2xl font-bold">{GREEN_ROUTES.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-purple-100">Rate Limit Bypass</p>
              <p className="text-2xl font-bold">100%</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-emerald-100">Security Level</p>
              <p className="text-2xl font-bold">A+</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search routes by path or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
      </div>

      {/* Routes Grid */}
      <div className="space-y-4">
        {filteredRoutes.map((category) => {
          const colors = getColorClasses(category.color);
          const Icon = category.icon;
          const isExpanded = expandedCategories.has(category.category);

          return (
            <div key={category.category} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.category)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 ${colors.light} rounded-lg`}>
                    <Icon className={`w-5 h-5 ${colors.text}`} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">{category.category}</h3>
                    <p className="text-sm text-gray-500">{category.routes.length} endpoint{category.routes.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 ${colors.light} ${colors.text} text-xs font-medium rounded-full`}>
                    GREEN ROUTE
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Routes List */}
              {isExpanded && (
                <div className="border-t border-gray-200">
                  <div className="divide-y divide-gray-100">
                    {category.routes.map((route, idx) => (
                      <div
                        key={idx}
                        className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => setSelectedRoute(selectedRoute?.path === route.path ? null : route)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-0.5 text-xs font-mono font-semibold rounded ${
                                route.method === 'GET' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                              }`}>
                                {route.method}
                              </span>
                              <code className="text-sm font-mono text-gray-700">{route.path}</code>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyPath(route.path);
                                }}
                                className="p-1 hover:bg-gray-200 rounded"
                                title="Copy path"
                              >
                                {copiedPath === route.path ? (
                                  <Check className="w-4 h-4 text-green-500" />
                                ) : (
                                  <Copy className="w-4 h-4 text-gray-400" />
                                )}
                              </button>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{route.description}</p>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1 text-gray-500">
                              <Clock className="w-4 h-4" />
                              <span>{route.pollingInterval}</span>
                            </div>
                            <div className="flex items-center gap-1 text-green-600">
                              <Unlock className="w-4 h-4" />
                              <span>No Limit</span>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Route Details */}
                        {selectedRoute?.path === route.path && (
                          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Bypass Reason</h4>
                                <p className="text-sm text-gray-900">{route.bypassReason}</p>
                              </div>
                              <div>
                                <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Polling Interval</h4>
                                <p className="text-sm text-gray-900">{route.pollingInterval}</p>
                              </div>
                              <div>
                                <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Security</h4>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                    JWT Auth
                                  </span>
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                    CORS Protected
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Full Endpoint URL</h4>
                              <code className="block p-2 bg-gray-800 text-green-400 text-sm rounded font-mono break-all">
                                https://dealersface.com{route.path}
                              </code>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Security Note */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <Shield className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Enterprise Security v3.1.0</h3>
            <p className="text-gray-600 text-sm mb-3">
              Green Routes bypass rate limiting but maintain full security through:
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                JWT Token Authentication
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                CORS Origin Validation
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                7-Ring Security Gateway
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                PCI-DSS Audit Logging
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                IIPC Super Admin Bypass
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Request Signature Validation
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Rate Limit Configuration */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Rate Limit Configuration
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Standard Routes</p>
            <p className="text-2xl font-bold text-gray-900">500 req / 15min</p>
            <p className="text-xs text-gray-400 mt-1">Per IP address</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200">
            <p className="text-sm text-green-600">Green Routes</p>
            <p className="text-2xl font-bold text-green-700">∞ Unlimited</p>
            <p className="text-xs text-green-500 mt-1">No rate limiting</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-600">IIPC Super Admin</p>
            <p className="text-2xl font-bold text-purple-700">∞ Unlimited</p>
            <p className="text-xs text-purple-500 mt-1">All routes bypassed</p>
          </div>
        </div>
      </div>
    </div>
  );
}
