/**
 * ============================================
 * Enterprise Security Tab Component
 * ============================================
 * 
 * Comprehensive SSRF Prevention & Security Management UI
 * For root admin access to manage domain allowlists and IP blocking
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  ShieldCheck,
  ShieldX,
  Globe,
  Lock,
  Plus,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  RefreshCw,
  AlertTriangle,
  Check,
  Activity,
  BarChart3,
  Clock,
  FileText,
  ChevronDown,
  ChevronRight,
  Search,
  Download,
  Settings,
  Network,
  Ban,
  Wifi,
  Database,
  CloudOff,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import api from '../../lib/api';

// ============================================
// Types
// ============================================

interface SsrfDomain {
  id: string;
  domain: string;
  category: string;
  matchType: string;
  description: string | null;
  isActive: boolean;
  addedBy: string;
  createdAt: string;
  updatedAt: string | null;
  totalRequests?: number;
}

interface SsrfBlockedIP {
  id: string;
  ipPrefix: string;
  category: string;
  reason: string;
  isActive: boolean;
  addedBy: string;
  createdAt: string;
  totalBlocks?: number;
}

interface SsrfAnalytics {
  totalDomains: number;
  totalRequests: number;
  blockedRequests: number;
  last24hRequests: number;
  blockRate: string;
}

interface BlockedIPAnalytics {
  totalRules: number;
  totalBlocks: number;
  last24hBlocks: number;
}

interface EnterpriseSecurityConfig {
  id: string;
  ssrfProtectionEnabled: boolean;
  privateIPBlockingEnabled: boolean;
  domainAllowlistEnabled: boolean;
  strictModeEnabled: boolean;
  auditLoggingEnabled: boolean;
  realTimeAlertsEnabled: boolean;
  maxRequestsPerMinute: number;
  blockDuration: number;
}

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  userId: string;
  createdAt: string;
  metadata: any;
  user?: {
    email: string;
    firstName: string;
    lastName: string;
  };
}

// ============================================
// API Functions
// ============================================

const enterpriseSecurityApi = {
  // SSRF Domains
  getDomains: () => api.get('/api/enterprise-security/ssrf/domains'),
  addDomain: (data: { domain: string; category: string; description?: string; matchType?: string }) =>
    api.post('/api/enterprise-security/ssrf/domains', data),
  updateDomain: (id: string, data: { isActive?: boolean; category?: string; description?: string }) =>
    api.put(`/api/enterprise-security/ssrf/domains/${id}`, data),
  deleteDomain: (id: string) => api.delete(`/api/enterprise-security/ssrf/domains/${id}`),

  // Blocked IPs
  getBlockedIPs: () => api.get('/api/enterprise-security/ssrf/blocked-ips'),
  addBlockedIP: (data: { ipPrefix: string; reason: string; category: string }) =>
    api.post('/api/enterprise-security/ssrf/blocked-ips', data),
  deleteBlockedIP: (id: string) => api.delete(`/api/enterprise-security/ssrf/blocked-ips/${id}`),

  // Analytics
  getAnalytics: (timeRange: string) => api.get(`/api/enterprise-security/analytics?timeRange=${timeRange}`),
  getAuditLogs: (page: number, limit: number) =>
    api.get(`/api/enterprise-security/audit-logs?page=${page}&limit=${limit}`),

  // Config
  getConfig: () => api.get('/api/enterprise-security/config'),
  updateConfig: (data: Partial<EnterpriseSecurityConfig>) =>
    api.put('/api/enterprise-security/config', data),
};

// ============================================
// Category Badge Component
// ============================================

const CategoryBadge = ({ category }: { category: string }) => {
  const colors: Record<string, string> = {
    facebook: 'bg-blue-100 text-blue-800 border-blue-200',
    aws: 'bg-orange-100 text-orange-800 border-orange-200',
    cloudflare: 'bg-amber-100 text-amber-800 border-amber-200',
    dealer: 'bg-green-100 text-green-800 border-green-200',
    cdn: 'bg-purple-100 text-purple-800 border-purple-200',
    internal: 'bg-gray-100 text-gray-800 border-gray-200',
    private: 'bg-red-100 text-red-800 border-red-200',
    loopback: 'bg-pink-100 text-pink-800 border-pink-200',
    linklocal: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    cloud_metadata: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    custom: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    other: 'bg-slate-100 text-slate-800 border-slate-200',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${colors[category] || colors.other}`}>
      {category}
    </span>
  );
};

// ============================================
// Main Component
// ============================================

export default function EnterpriseSecurityTab() {
  const toast = useToast();
  const queryClient = useQueryClient();
  
  // Tab state
  const [activeSection, setActiveSection] = useState<'overview' | 'domains' | 'ips' | 'analytics' | 'config' | 'logs'>('overview');
  const [timeRange, setTimeRange] = useState('24h');
  
  // Domain form state
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [newDomain, setNewDomain] = useState({ domain: '', category: 'other', description: '', matchType: 'exact' });
  
  // IP form state
  const [showAddIP, setShowAddIP] = useState(false);
  const [newIP, setNewIP] = useState({ ipPrefix: '', reason: '', category: 'custom' });
  
  // Search state
  const [domainSearch, setDomainSearch] = useState('');
  const [ipSearch, setIpSearch] = useState('');
  
  // Expanded categories
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['facebook', 'aws']));

  // ============================================
  // Queries
  // ============================================

  const { data: domainsResponse } = useQuery({
    queryKey: ['enterprise-security-domains'],
    queryFn: enterpriseSecurityApi.getDomains,
    staleTime: 30000,
  });

  const { data: blockedIPsResponse } = useQuery({
    queryKey: ['enterprise-security-blocked-ips'],
    queryFn: enterpriseSecurityApi.getBlockedIPs,
    staleTime: 30000,
  });

  const { data: analyticsResponse } = useQuery({
    queryKey: ['enterprise-security-analytics', timeRange],
    queryFn: () => enterpriseSecurityApi.getAnalytics(timeRange),
    staleTime: 30000,
  });

  const { data: configResponse } = useQuery({
    queryKey: ['enterprise-security-config'],
    queryFn: enterpriseSecurityApi.getConfig,
    staleTime: 30000,
  });

  const { data: auditLogsResponse } = useQuery({
    queryKey: ['enterprise-security-audit-logs'],
    queryFn: () => enterpriseSecurityApi.getAuditLogs(1, 50),
    staleTime: 30000,
  });

  // Extract data
  const domains: SsrfDomain[] = domainsResponse?.data?.data?.domains || [];
  const groupedDomains: Record<string, SsrfDomain[]> = domainsResponse?.data?.data?.grouped || {};
  const domainAnalytics: SsrfAnalytics = domainsResponse?.data?.data?.analytics || {};
  const blockedIPs: SsrfBlockedIP[] = blockedIPsResponse?.data?.data?.blockedIPs || [];
  const ipAnalytics: BlockedIPAnalytics = blockedIPsResponse?.data?.data?.analytics || {};
  const config: EnterpriseSecurityConfig | null = configResponse?.data?.data || null;
  const analytics = analyticsResponse?.data?.data || {};
  const auditLogs: AuditLog[] = auditLogsResponse?.data?.data?.logs || [];

  // ============================================
  // Mutations
  // ============================================

  const addDomainMutation = useMutation({
    mutationFn: enterpriseSecurityApi.addDomain,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enterprise-security-domains'] });
      toast.success('Domain added to allowlist');
      setShowAddDomain(false);
      setNewDomain({ domain: '', category: 'other', description: '', matchType: 'exact' });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to add domain');
    },
  });

  const updateDomainMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => enterpriseSecurityApi.updateDomain(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enterprise-security-domains'] });
      toast.success('Domain updated');
    },
    onError: () => toast.error('Failed to update domain'),
  });

  const deleteDomainMutation = useMutation({
    mutationFn: enterpriseSecurityApi.deleteDomain,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enterprise-security-domains'] });
      toast.success('Domain removed from allowlist');
    },
    onError: () => toast.error('Failed to remove domain'),
  });

  const addIPMutation = useMutation({
    mutationFn: enterpriseSecurityApi.addBlockedIP,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enterprise-security-blocked-ips'] });
      toast.success('IP prefix added to block list');
      setShowAddIP(false);
      setNewIP({ ipPrefix: '', reason: '', category: 'custom' });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to add IP');
    },
  });

  const deleteIPMutation = useMutation({
    mutationFn: enterpriseSecurityApi.deleteBlockedIP,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enterprise-security-blocked-ips'] });
      toast.success('IP prefix removed from block list');
    },
    onError: () => toast.error('Failed to remove IP'),
  });

  const updateConfigMutation = useMutation({
    mutationFn: enterpriseSecurityApi.updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enterprise-security-config'] });
      toast.success('Configuration updated');
    },
    onError: () => toast.error('Failed to update configuration'),
  });

  // ============================================
  // Toggle category expansion
  // ============================================
  
  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Filter domains by search
  const filteredDomains = domains.filter((d) =>
    d.domain.toLowerCase().includes(domainSearch.toLowerCase())
  );

  // Filter IPs by search
  const filteredIPs = blockedIPs.filter((ip) =>
    ip.ipPrefix.toLowerCase().includes(ipSearch.toLowerCase()) ||
    ip.reason.toLowerCase().includes(ipSearch.toLowerCase())
  );

  // ============================================
  // Render
  // ============================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Enterprise Security</h2>
              <p className="text-purple-100">SSRF Prevention & Security Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-lg font-medium ${
              config?.ssrfProtectionEnabled ? 'bg-green-500/30 text-green-100' : 'bg-red-500/30 text-red-100'
            }`}>
              {config?.ssrfProtectionEnabled ? (
                <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Protection Active</span>
              ) : (
                <span className="flex items-center gap-2"><ShieldX className="w-4 h-4" /> Protection Disabled</span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 rounded-lg p-4">
            <p className="text-purple-200 text-sm">Allowed Domains</p>
            <p className="text-3xl font-bold">{domainAnalytics.totalDomains || 0}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <p className="text-purple-200 text-sm">Blocked IP Rules</p>
            <p className="text-3xl font-bold">{ipAnalytics.totalRules || 0}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <p className="text-purple-200 text-sm">Requests (24h)</p>
            <p className="text-3xl font-bold">{domainAnalytics.last24hRequests || 0}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <p className="text-purple-200 text-sm">Block Rate</p>
            <p className="text-3xl font-bold">{domainAnalytics.blockRate || '0'}%</p>
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            { id: 'overview' as const, label: 'Overview', icon: Activity },
            { id: 'domains' as const, label: 'Domain Allowlist', icon: Globe },
            { id: 'ips' as const, label: 'IP Blocking', icon: Ban },
            { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
            { id: 'config' as const, label: 'Configuration', icon: Settings },
            { id: 'logs' as const, label: 'Audit Logs', icon: FileText },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
                activeSection === tab.id
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Section */}
      {activeSection === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SSRF Protection Status */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900">SSRF Protection Status</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Network className="w-5 h-5 text-blue-500" />
                  <span className="font-medium">Domain Allowlist</span>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  config?.domainAllowlistEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {config?.domainAllowlistEnabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CloudOff className="w-5 h-5 text-red-500" />
                  <span className="font-medium">Private IP Blocking</span>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  config?.privateIPBlockingEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {config?.privateIPBlockingEnabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-orange-500" />
                  <span className="font-medium">Strict Mode</span>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  config?.strictModeEnabled ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {config?.strictModeEnabled ? 'Enabled' : 'Off'}
                </span>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Recent Security Activity</h3>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {auditLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`p-1.5 rounded-full ${
                    log.action.includes('ADDED') || log.action.includes('CREATED') ? 'bg-green-100' :
                    log.action.includes('DELETED') || log.action.includes('REMOVED') ? 'bg-red-100' :
                    'bg-blue-100'
                  }`}>
                    {log.action.includes('ADDED') || log.action.includes('CREATED') ? (
                      <Plus className="w-3 h-3 text-green-600" />
                    ) : log.action.includes('DELETED') || log.action.includes('REMOVED') ? (
                      <Trash2 className="w-3 h-3 text-red-600" />
                    ) : (
                      <Edit className="w-3 h-3 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {log.action.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {log.user?.email || 'System'} • {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {auditLogs.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No recent activity</p>
                </div>
              )}
            </div>
          </div>

          {/* Top Blocked Domains */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <ShieldX className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Top Blocked Domains</h3>
            </div>
            <div className="space-y-2">
              {analytics.ssrf?.topBlockedDomains?.slice(0, 5).map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
                  <span className="text-sm font-mono text-red-800 truncate">{item.domain}</span>
                  <span className="text-sm font-medium text-red-600">{item.count} blocks</span>
                </div>
              )) || (
                <div className="text-center py-6 text-gray-500">
                  <Check className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <p>No blocked requests</p>
                </div>
              )}
            </div>
          </div>

          {/* Domain Categories */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <Database className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Domains by Category</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(groupedDomains).map(([category, categoryDomains]) => (
                <div key={category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CategoryBadge category={category} />
                  </div>
                  <span className="text-sm font-medium text-gray-600">{categoryDomains.length}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Domain Allowlist Section */}
      {activeSection === 'domains' && (
        <div className="space-y-4">
          {/* Actions Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search domains..."
                  value={domainSearch}
                  onChange={(e) => setDomainSearch(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <span className="text-sm text-gray-500">
                {filteredDomains.length} of {domains.length} domains
              </span>
            </div>
            <button
              onClick={() => setShowAddDomain(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Domain
            </button>
          </div>

          {/* Add Domain Form */}
          {showAddDomain && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <h4 className="font-medium text-purple-900 mb-3">Add Domain to Allowlist</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input
                  type="text"
                  placeholder="Domain (e.g., *.fbcdn.net)"
                  value={newDomain.domain}
                  onChange={(e) => setNewDomain({ ...newDomain, domain: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
                <select
                  value={newDomain.category}
                  onChange={(e) => setNewDomain({ ...newDomain, category: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="facebook">Facebook</option>
                  <option value="aws">AWS</option>
                  <option value="cloudflare">Cloudflare</option>
                  <option value="dealer">Dealer</option>
                  <option value="cdn">CDN</option>
                  <option value="internal">Internal</option>
                  <option value="other">Other</option>
                </select>
                <select
                  value={newDomain.matchType}
                  onChange={(e) => setNewDomain({ ...newDomain, matchType: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="exact">Exact Match</option>
                  <option value="suffix">Suffix Match</option>
                  <option value="wildcard">Wildcard</option>
                </select>
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newDomain.description}
                  onChange={(e) => setNewDomain({ ...newDomain, description: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => addDomainMutation.mutate(newDomain)}
                  disabled={!newDomain.domain || addDomainMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {addDomainMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add Domain
                </button>
                <button
                  onClick={() => setShowAddDomain(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Domains by Category */}
          <div className="space-y-4">
            {Object.entries(groupedDomains).map(([category, categoryDomains]) => {
              const isExpanded = expandedCategories.has(category);
              const filteredCategoryDomains = categoryDomains.filter((d) =>
                d.domain.toLowerCase().includes(domainSearch.toLowerCase())
              );
              if (domainSearch && filteredCategoryDomains.length === 0) return null;

              return (
                <div key={category} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                      <CategoryBadge category={category} />
                      <span className="font-medium text-gray-900 capitalize">{category} Domains</span>
                      <span className="text-sm text-gray-500">({categoryDomains.length})</span>
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="border-t border-gray-200">
                      <div className="divide-y divide-gray-100">
                        {(domainSearch ? filteredCategoryDomains : categoryDomains).map((domain) => (
                          <div key={domain.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                            <div className="flex items-center gap-4">
                              <div className={`w-2 h-2 rounded-full ${domain.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                              <div>
                                <p className="font-mono text-sm text-gray-900">{domain.domain}</p>
                                {domain.description && (
                                  <p className="text-xs text-gray-500">{domain.description}</p>
                                )}
                              </div>
                              <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                                {domain.matchType}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">
                                {domain.totalRequests || 0} requests
                              </span>
                              <button
                                onClick={() => updateDomainMutation.mutate({ id: domain.id, data: { isActive: !domain.isActive } })}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  domain.isActive ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                                title={domain.isActive ? 'Disable' : 'Enable'}
                              >
                                {domain.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Remove ${domain.domain} from allowlist?`)) {
                                    deleteDomainMutation.mutate(domain.id);
                                  }
                                }}
                                className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* IP Blocking Section */}
      {activeSection === 'ips' && (
        <div className="space-y-4">
          {/* Actions Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search IP prefixes..."
                  value={ipSearch}
                  onChange={(e) => setIpSearch(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <span className="text-sm text-gray-500">
                {filteredIPs.length} of {blockedIPs.length} rules
              </span>
            </div>
            <button
              onClick={() => setShowAddIP(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add IP Rule
            </button>
          </div>

          {/* Info Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-900">Private IP Blocking</h4>
              <p className="text-sm text-amber-700 mt-1">
                These rules block requests to private/internal IP ranges, preventing SSRF attacks that could access internal services.
                Default rules block RFC 1918 addresses (10.x.x.x, 172.16-31.x.x, 192.168.x.x), loopback (127.x.x.x), 
                link-local (169.254.x.x), and cloud metadata endpoints (169.254.169.254).
              </p>
            </div>
          </div>

          {/* Add IP Form */}
          {showAddIP && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <h4 className="font-medium text-red-900 mb-3">Add IP Prefix to Block List</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  type="text"
                  placeholder="IP Prefix (e.g., 10., 192.168.)"
                  value={newIP.ipPrefix}
                  onChange={(e) => setNewIP({ ...newIP, ipPrefix: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
                <select
                  value={newIP.category}
                  onChange={(e) => setNewIP({ ...newIP, category: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                >
                  <option value="private">Private (RFC 1918)</option>
                  <option value="loopback">Loopback</option>
                  <option value="linklocal">Link-Local</option>
                  <option value="cloud_metadata">Cloud Metadata</option>
                  <option value="custom">Custom</option>
                </select>
                <input
                  type="text"
                  placeholder="Reason for blocking"
                  value={newIP.reason}
                  onChange={(e) => setNewIP({ ...newIP, reason: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => addIPMutation.mutate(newIP)}
                  disabled={!newIP.ipPrefix || !newIP.reason || addIPMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {addIPMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                  Block IP Prefix
                </button>
                <button
                  onClick={() => setShowAddIP(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* IP Rules List */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {filteredIPs.map((ip) => (
                <div key={ip.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${
                      ip.category === 'private' ? 'bg-red-100' :
                      ip.category === 'loopback' ? 'bg-pink-100' :
                      ip.category === 'cloud_metadata' ? 'bg-yellow-100' :
                      'bg-gray-100'
                    }`}>
                      <Ban className={`w-4 h-4 ${
                        ip.category === 'private' ? 'text-red-600' :
                        ip.category === 'loopback' ? 'text-pink-600' :
                        ip.category === 'cloud_metadata' ? 'text-yellow-600' :
                        'text-gray-600'
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm text-gray-900">{ip.ipPrefix}</p>
                        <CategoryBadge category={ip.category} />
                      </div>
                      <p className="text-xs text-gray-500">{ip.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {ip.totalBlocks || 0} blocks
                    </span>
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${ip.ipPrefix} from block list? This may expose the system to SSRF attacks.`)) {
                          deleteIPMutation.mutate(ip.id);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {filteredIPs.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Ban className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No IP blocking rules found</p>
                  <p className="text-sm mt-1">Add rules to prevent SSRF attacks</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Analytics Section */}
      {activeSection === 'analytics' && (
        <div className="space-y-6">
          {/* Time Range Selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Time Range:</span>
            {['1h', '6h', '24h', '7d', '30d'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  timeRange === range
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Analytics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Wifi className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Proxy Requests</h3>
              </div>
              <p className="text-4xl font-bold text-gray-900">{analytics.ssrf?.totalRequests || 0}</p>
              <p className="text-sm text-gray-500 mt-1">Total in {timeRange}</p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-lg">
                  <ShieldX className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Blocked Requests</h3>
              </div>
              <p className="text-4xl font-bold text-red-600">{analytics.ssrf?.blockedRequests || 0}</p>
              <p className="text-sm text-gray-500 mt-1">{analytics.ssrf?.blockRate || '0'}% block rate</p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Protection Status</h3>
              </div>
              <p className="text-4xl font-bold text-green-600">Active</p>
              <p className="text-sm text-gray-500 mt-1">{domainAnalytics.totalDomains || 0} domains allowed</p>
            </div>
          </div>

          {/* Recent Blocks */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Recent Blocked Requests</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Domain</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">IP</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Reason</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {analytics.ssrf?.recentBlocks?.slice(0, 10).map((block: any) => (
                    <tr key={block.id} className="hover:bg-gray-50">
                      <td className="py-2 px-3 text-sm font-mono text-gray-900">{block.domain || '-'}</td>
                      <td className="py-2 px-3 text-sm font-mono text-gray-600">{block.ip || '-'}</td>
                      <td className="py-2 px-3 text-sm text-red-600">{block.reason || 'Blocked'}</td>
                      <td className="py-2 px-3 text-xs text-gray-500">
                        {new Date(block.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  )) || (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-500">
                        <Check className="w-8 h-8 mx-auto mb-2 text-green-500" />
                        <p>No blocked requests in this period</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Section */}
      {activeSection === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Protection Settings */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Protection Settings</h3>
                <p className="text-sm text-gray-500">Core SSRF protection toggles</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">SSRF Protection</p>
                  <p className="text-xs text-gray-500">Master switch for all SSRF protection</p>
                </div>
                <button
                  onClick={() => updateConfigMutation.mutate({ ssrfProtectionEnabled: !config?.ssrfProtectionEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config?.ssrfProtectionEnabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config?.ssrfProtectionEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Domain Allowlist</p>
                  <p className="text-xs text-gray-500">Only allow requests to approved domains</p>
                </div>
                <button
                  onClick={() => updateConfigMutation.mutate({ domainAllowlistEnabled: !config?.domainAllowlistEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config?.domainAllowlistEnabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config?.domainAllowlistEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Private IP Blocking</p>
                  <p className="text-xs text-gray-500">Block requests to internal/private IPs</p>
                </div>
                <button
                  onClick={() => updateConfigMutation.mutate({ privateIPBlockingEnabled: !config?.privateIPBlockingEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config?.privateIPBlockingEnabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config?.privateIPBlockingEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div>
                  <p className="font-medium text-orange-900">Strict Mode</p>
                  <p className="text-xs text-orange-700">Block all non-allowlisted requests (may break features)</p>
                </div>
                <button
                  onClick={() => {
                    if (!config?.strictModeEnabled && !confirm('Enable strict mode? This will block ALL requests to non-allowlisted domains.')) return;
                    updateConfigMutation.mutate({ strictModeEnabled: !config?.strictModeEnabled });
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config?.strictModeEnabled ? 'bg-orange-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config?.strictModeEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          </div>

          {/* Logging & Monitoring */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Logging & Monitoring</h3>
                <p className="text-sm text-gray-500">Audit and alerting settings</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Audit Logging</p>
                  <p className="text-xs text-gray-500">Log all security configuration changes</p>
                </div>
                <button
                  onClick={() => updateConfigMutation.mutate({ auditLoggingEnabled: !config?.auditLoggingEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config?.auditLoggingEnabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config?.auditLoggingEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Real-Time Alerts</p>
                  <p className="text-xs text-gray-500">Send alerts for suspicious activity</p>
                </div>
                <button
                  onClick={() => updateConfigMutation.mutate({ realTimeAlertsEnabled: !config?.realTimeAlertsEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config?.realTimeAlertsEnabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config?.realTimeAlertsEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>

            {/* Rate Limits */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-4">Rate Limits</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Requests Per Minute
                  </label>
                  <input
                    type="number"
                    value={config?.maxRequestsPerMinute || 1000}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (val >= 10 && val <= 100000) {
                        updateConfigMutation.mutate({ maxRequestsPerMinute: val });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    min={10}
                    max={100000}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Block Duration (seconds)
                  </label>
                  <input
                    type="number"
                    value={config?.blockDuration || 3600}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (val >= 60 && val <= 2592000) {
                        updateConfigMutation.mutate({ blockDuration: val });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    min={60}
                    max={2592000}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Logs Section */}
      {activeSection === 'logs' && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <FileText className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Security Audit Logs</h3>
                  <p className="text-sm text-gray-500">All security configuration changes</p>
                </div>
              </div>
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
          
          <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      log.action.includes('ADDED') || log.action.includes('CREATED') ? 'bg-green-100' :
                      log.action.includes('DELETED') || log.action.includes('REMOVED') || log.action.includes('UNBLOCKED') ? 'bg-red-100' :
                      log.action.includes('UPDATED') ? 'bg-blue-100' :
                      log.action.includes('BLOCKED') ? 'bg-orange-100' :
                      'bg-gray-100'
                    }`}>
                      {log.action.includes('ADDED') || log.action.includes('CREATED') ? (
                        <Plus className={`w-4 h-4 text-green-600`} />
                      ) : log.action.includes('DELETED') || log.action.includes('REMOVED') || log.action.includes('UNBLOCKED') ? (
                        <Trash2 className={`w-4 h-4 text-red-600`} />
                      ) : log.action.includes('UPDATED') ? (
                        <Edit className={`w-4 h-4 text-blue-600`} />
                      ) : log.action.includes('BLOCKED') ? (
                        <Ban className={`w-4 h-4 text-orange-600`} />
                      ) : (
                        <Activity className={`w-4 h-4 text-gray-600`} />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{log.action.replace(/_/g, ' ')}</p>
                      <p className="text-sm text-gray-500">
                        {log.user?.email || 'System'} • {log.entityType}
                      </p>
                      {log.metadata && (
                        <pre className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-600 overflow-x-auto max-w-lg">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
            {auditLogs.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No audit logs found</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
