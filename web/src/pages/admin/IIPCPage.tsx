import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  Globe,
  Plus,
  Trash2,
  Edit,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
  Lock,
  Unlock,
  Network,
  Monitor,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { iipcApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

// Types
type IPAccessLevel = 'SUPER_ADMIN' | 'ADMIN' | 'DEALER' | 'SALES_REP' | 'USER';
type IPRuleScope = 'GLOBAL' | 'ROLE' | 'USER' | 'NETWORK';
type IPRuleType = 'WHITELIST' | 'BLACKLIST';

interface IPRule {
  id: string;
  ip: string;
  type: IPRuleType;
  scope: IPRuleScope;
  scopeValue?: string;
  computerName?: string;
  description?: string;
  canOverrideRateLimit: boolean;
  canOverrideLoginBlock: boolean;
  canOverrideAllSecurity: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  isActive: boolean;
}

interface RoleIPSettings {
  role: IPAccessLevel;
  canWhitelistOwnIP: boolean;
  canWhitelistForOAuth: boolean;
  requireIPMatch: boolean;
  allowEmailFallback: boolean;
  maxWhitelistedIPs: number;
}

interface IIPCStatus {
  config: {
    enabled: boolean;
    enforceIPMatching: boolean;
    allowEmergencyAccess: boolean;
    emergencyCodeExpireMinutes: number;
    defaultRoleSettings: Record<IPAccessLevel, RoleIPSettings>;
    globalWhitelistedIPs: string[];
    superAdminOverrideIPs: string[];
  };
  totalRules: number;
  rulesByScope: Record<IPRuleScope, number>;
  rulesByType: Record<IPRuleType, number>;
  superAdminIPs: string[];
  globalWhitelistIPs: string[];
  pendingEmergencyRequests: number;
  rules: IPRule[];
  clientIP: string;
}

const roleLabels: Record<IPAccessLevel, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  DEALER: 'Dealer',
  SALES_REP: 'Sales Rep',
  USER: 'User',
};

const scopeLabels: Record<IPRuleScope, string> = {
  GLOBAL: 'Global',
  ROLE: 'By Role',
  USER: 'By User',
  NETWORK: 'Network/LAN',
};

export default function IIPCPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'rules' | 'roles' | 'superadmin'>('overview');
  const [showAddRule, setShowAddRule] = useState(false);
  const [_editingRule, setEditingRule] = useState<IPRule | null>(null); // Reserved for edit modal
  const [expandedRoles, setExpandedRoles] = useState<Set<IPAccessLevel>>(new Set(['SUPER_ADMIN']));

  // New rule form state
  const [newRule, setNewRule] = useState({
    ip: '',
    type: 'WHITELIST' as IPRuleType,
    scope: 'USER' as IPRuleScope,
    scopeValue: '',
    computerName: '',
    description: '',
    canOverrideRateLimit: true,
    canOverrideLoginBlock: false,
    canOverrideAllSecurity: false,
    expiresAt: '',
  });

  // New super admin IP
  const [newSuperAdminIP, setNewSuperAdminIP] = useState('');

  // Fetch status
  const { data: statusResponse, isLoading, error } = useQuery({
    queryKey: ['iipc-status'],
    queryFn: () => iipcApi.getStatus(),
    refetchInterval: 5000,
  });

  const status: IIPCStatus | undefined = statusResponse?.data?.data;

  // Mutations
  const updateConfigMutation = useMutation({
    mutationFn: iipcApi.updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iipc-status'] });
      toast.success('Configuration updated');
    },
    onError: () => toast.error('Failed to update configuration'),
  });

  const addRuleMutation = useMutation({
    mutationFn: iipcApi.addRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iipc-status'] });
      toast.success('IP rule added');
      setShowAddRule(false);
      resetNewRule();
    },
    onError: () => toast.error('Failed to add rule'),
  });

  const updateRuleMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<IPRule> }) => 
      iipcApi.updateRule(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iipc-status'] });
      toast.success('Rule updated');
      setEditingRule(null);
    },
    onError: () => toast.error('Failed to update rule'),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: iipcApi.deleteRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iipc-status'] });
      toast.success('Rule deleted');
    },
    onError: () => toast.error('Failed to delete rule'),
  });

  const addSuperAdminIPMutation = useMutation({
    mutationFn: iipcApi.addSuperAdminIP,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iipc-status'] });
      toast.success('Super admin IP added');
      setNewSuperAdminIP('');
    },
    onError: () => toast.error('Failed to add super admin IP'),
  });

  const removeSuperAdminIPMutation = useMutation({
    mutationFn: iipcApi.removeSuperAdminIP,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iipc-status'] });
      toast.success('Super admin IP removed');
    },
    onError: () => toast.error('Failed to remove super admin IP'),
  });

  const updateRoleSettingsMutation = useMutation({
    mutationFn: iipcApi.updateRoleSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iipc-status'] });
      toast.success('Role settings updated');
    },
    onError: () => toast.error('Failed to update role settings'),
  });

  const resetNewRule = () => {
    setNewRule({
      ip: '',
      type: 'WHITELIST',
      scope: 'USER',
      scopeValue: '',
      computerName: '',
      description: '',
      canOverrideRateLimit: true,
      canOverrideLoginBlock: false,
      canOverrideAllSecurity: false,
      expiresAt: '',
    });
  };

  const toggleRoleExpand = (role: IPAccessLevel) => {
    const newExpanded = new Set(expandedRoles);
    if (newExpanded.has(role)) {
      newExpanded.delete(role);
    } else {
      newExpanded.add(role);
    }
    setExpandedRoles(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Failed to load IIPC status</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 rounded-xl">
            <Shield className="w-8 h-8 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">IIPC - IP Access Control</h1>
            <p className="text-gray-500">Internal IP Controller - Manage access by IP address</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Current IP Badge */}
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
            <Globe className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-mono">{status.clientIP}</span>
          </div>
          {/* Toggle System */}
          <button
            onClick={() => updateConfigMutation.mutate({ enabled: !status.config.enabled })}
            className={`px-4 py-2 rounded-lg font-medium ${
              status.config.enabled
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status.config.enabled ? 'System Active' : 'System Disabled'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            { id: 'overview' as const, label: 'Overview', icon: Monitor },
            { id: 'rules' as const, label: 'IP Rules', icon: Network },
            { id: 'roles' as const, label: 'Role Settings', icon: Users },
            { id: 'superadmin' as const, label: 'Super Admin IPs', icon: Lock },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
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
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Total Rules</p>
                  <p className="text-3xl font-bold text-gray-900">{status.totalRules}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Network className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Whitelist Rules</p>
                  <p className="text-3xl font-bold text-green-600">{status.rulesByType.WHITELIST || 0}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Blacklist Rules</p>
                  <p className="text-3xl font-bold text-red-600">{status.rulesByType.BLACKLIST || 0}</p>
                </div>
                <div className="p-3 bg-red-100 rounded-lg">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Super Admin IPs</p>
                  <p className="text-3xl font-bold text-indigo-600">{status.superAdminIPs.length}</p>
                </div>
                <div className="p-3 bg-indigo-100 rounded-lg">
                  <Lock className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Global Settings */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Global Settings</h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-700">Enforce IP Matching</span>
                  <p className="text-sm text-gray-500">Require IP to be whitelisted for roles that have it enabled</p>
                </div>
                <input
                  type="checkbox"
                  checked={status.config.enforceIPMatching}
                  onChange={(e) => updateConfigMutation.mutate({ enforceIPMatching: e.target.checked })}
                  className="w-5 h-5 text-indigo-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-700">Allow Emergency Access</span>
                  <p className="text-sm text-gray-500">Allow users to verify via email when IP doesn't match</p>
                </div>
                <input
                  type="checkbox"
                  checked={status.config.allowEmergencyAccess}
                  onChange={(e) => updateConfigMutation.mutate({ allowEmergencyAccess: e.target.checked })}
                  className="w-5 h-5 text-indigo-600 rounded"
                />
              </label>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Emergency Code Expiry (minutes)
                  </label>
                  <input
                    type="number"
                    value={status.config.emergencyCodeExpireMinutes}
                    onChange={(e) => updateConfigMutation.mutate({ emergencyCodeExpireMinutes: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    min="5"
                    max="60"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Rules by Scope */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Rules by Scope</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(status.rulesByScope).map(([scope, count]) => (
                <div key={scope} className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                  <p className="text-sm text-gray-500">{scopeLabels[scope as IPRuleScope]}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* IP Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          {/* Add Rule Button */}
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">IP Access Rules</h3>
            <button
              onClick={() => setShowAddRule(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" />
              Add Rule
            </button>
          </div>

          {/* Add Rule Form */}
          {showAddRule && (
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-4">New IP Rule</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IP Address / CIDR</label>
                  <input
                    type="text"
                    value={newRule.ip}
                    onChange={(e) => setNewRule({ ...newRule, ip: e.target.value })}
                    placeholder="192.168.1.1 or 192.168.1.0/24"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rule Type</label>
                  <select
                    value={newRule.type}
                    onChange={(e) => setNewRule({ ...newRule, type: e.target.value as IPRuleType })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="WHITELIST">Whitelist (Allow)</option>
                    <option value="BLACKLIST">Blacklist (Block)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                  <select
                    value={newRule.scope}
                    onChange={(e) => setNewRule({ ...newRule, scope: e.target.value as IPRuleScope })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="GLOBAL">Global (All Users)</option>
                    <option value="ROLE">By Role</option>
                    <option value="USER">Specific User</option>
                    <option value="NETWORK">Network/LAN Range</option>
                  </select>
                </div>

                {(newRule.scope === 'ROLE' || newRule.scope === 'USER') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {newRule.scope === 'ROLE' ? 'Role' : 'User ID'}
                    </label>
                    {newRule.scope === 'ROLE' ? (
                      <select
                        value={newRule.scopeValue}
                        onChange={(e) => setNewRule({ ...newRule, scopeValue: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">Select Role</option>
                        {Object.entries(roleLabels).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={newRule.scopeValue}
                        onChange={(e) => setNewRule({ ...newRule, scopeValue: e.target.value })}
                        placeholder="User ID"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Computer Name (Optional)</label>
                  <input
                    type="text"
                    value={newRule.computerName}
                    onChange={(e) => setNewRule({ ...newRule, computerName: e.target.value })}
                    placeholder="WORKSTATION-01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={newRule.description}
                    onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                    placeholder="Office main network"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expires At (Optional)</label>
                  <input
                    type="datetime-local"
                    value={newRule.expiresAt}
                    onChange={(e) => setNewRule({ ...newRule, expiresAt: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Override Permissions */}
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-gray-700">Override Permissions</p>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newRule.canOverrideRateLimit}
                      onChange={(e) => setNewRule({ ...newRule, canOverrideRateLimit: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span className="text-sm text-gray-700">Rate Limit</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newRule.canOverrideLoginBlock}
                      onChange={(e) => setNewRule({ ...newRule, canOverrideLoginBlock: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span className="text-sm text-gray-700">Login Block</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newRule.canOverrideAllSecurity}
                      onChange={(e) => setNewRule({ ...newRule, canOverrideAllSecurity: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span className="text-sm text-gray-700">All Security</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => { setShowAddRule(false); resetNewRule(); }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => addRuleMutation.mutate(newRule)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  disabled={!newRule.ip}
                >
                  Add Rule
                </button>
              </div>
            </div>
          )}

          {/* Rules List */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">IP/Range</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Scope</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Overrides</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {status.rules.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No IP rules configured
                    </td>
                  </tr>
                ) : (
                  status.rules.map((rule) => (
                    <tr key={rule.id} className="border-t border-gray-100">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-mono text-sm">{rule.ip}</p>
                          {rule.description && (
                            <p className="text-xs text-gray-500">{rule.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          rule.type === 'WHITELIST' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {rule.type === 'WHITELIST' ? 'Allow' : 'Block'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm">{scopeLabels[rule.scope]}</p>
                          {rule.scopeValue && (
                            <p className="text-xs text-gray-500">{rule.scopeValue}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {rule.canOverrideRateLimit && (
                            <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">Rate</span>
                          )}
                          {rule.canOverrideLoginBlock && (
                            <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">Login</span>
                          )}
                          {rule.canOverrideAllSecurity && (
                            <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">All</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => updateRuleMutation.mutate({ id: rule.id, updates: { isActive: !rule.isActive } })}
                          className={`inline-flex items-center gap-1 text-sm ${
                            rule.isActive ? 'text-green-600' : 'text-gray-400'
                          }`}
                        >
                          {rule.isActive ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingRule(rule)}
                            className="text-gray-500 hover:text-indigo-600"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteRuleMutation.mutate(rule.id)}
                            className="text-gray-500 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Role Settings Tab */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Role IP Settings</h3>
            <p className="text-sm text-gray-500">Configure IP access permissions for each role</p>
          </div>

          {Object.entries(status.config.defaultRoleSettings).map(([role, settings]) => (
            <div key={role} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => toggleRoleExpand(role as IPAccessLevel)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  {expandedRoles.has(role as IPAccessLevel) ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                  <div className="text-left">
                    <h4 className="font-medium text-gray-900">{roleLabels[role as IPAccessLevel]}</h4>
                    <p className="text-sm text-gray-500">
                      Max IPs: {settings.maxWhitelistedIPs} • 
                      {settings.canWhitelistOwnIP ? ' Can whitelist own IP' : ' Cannot whitelist'} •
                      {settings.requireIPMatch ? ' IP required' : ' IP optional'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {settings.canWhitelistOwnIP && (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">Self-whitelist</span>
                  )}
                  {settings.requireIPMatch && (
                    <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">Required</span>
                  )}
                </div>
              </button>

              {expandedRoles.has(role as IPAccessLevel) && (
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={settings.canWhitelistOwnIP}
                        onChange={(e) => updateRoleSettingsMutation.mutate({
                          role,
                          settings: { canWhitelistOwnIP: e.target.checked }
                        })}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      <span className="text-sm text-gray-700">Can whitelist own IP</span>
                    </label>

                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={settings.canWhitelistForOAuth}
                        onChange={(e) => updateRoleSettingsMutation.mutate({
                          role,
                          settings: { canWhitelistForOAuth: e.target.checked }
                        })}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      <span className="text-sm text-gray-700">Can whitelist for OAuth</span>
                    </label>

                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={settings.requireIPMatch}
                        onChange={(e) => updateRoleSettingsMutation.mutate({
                          role,
                          settings: { requireIPMatch: e.target.checked }
                        })}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      <span className="text-sm text-gray-700">Require IP match for login</span>
                    </label>

                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={settings.allowEmailFallback}
                        onChange={(e) => updateRoleSettingsMutation.mutate({
                          role,
                          settings: { allowEmailFallback: e.target.checked }
                        })}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      <span className="text-sm text-gray-700">Allow email fallback</span>
                    </label>

                    <div className="md:col-span-2">
                      <label className="block text-sm text-gray-700 mb-1">Max whitelisted IPs</label>
                      <input
                        type="number"
                        value={settings.maxWhitelistedIPs}
                        onChange={(e) => updateRoleSettingsMutation.mutate({
                          role,
                          settings: { maxWhitelistedIPs: parseInt(e.target.value) }
                        })}
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
                        min="0"
                        max="100"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Super Admin IPs Tab */}
      {activeTab === 'superadmin' && (
        <div className="space-y-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-800">Super Admin Override IPs</h4>
                <p className="text-sm text-yellow-700">
                  These IPs can bypass ALL security measures including rate limits, login blocks, and authentication limits.
                  Use with extreme caution.
                </p>
              </div>
            </div>
          </div>

          {/* Add New IP */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Add Super Admin IP</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newSuperAdminIP}
                onChange={(e) => setNewSuperAdminIP(e.target.value)}
                placeholder="Enter IP address (e.g., 86.40.131.65)"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
              />
              <button
                onClick={() => newSuperAdminIP && addSuperAdminIPMutation.mutate(newSuperAdminIP)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                disabled={!newSuperAdminIP}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Current Super Admin IPs */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Current Super Admin IPs</h3>
            <div className="space-y-2">
              {status.superAdminIPs.length === 0 ? (
                <p className="text-gray-500 text-sm">No super admin IPs configured</p>
              ) : (
                status.superAdminIPs.map((ip) => (
                  <div key={ip} className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Lock className="w-5 h-5 text-indigo-600" />
                      <span className="font-mono text-sm">{ip}</span>
                      {ip === status.clientIP && (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">Your IP</span>
                      )}
                    </div>
                    <button
                      onClick={() => removeSuperAdminIPMutation.mutate(ip)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Privileges Info */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Super Admin IP Privileges</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600 mb-2" />
                <h4 className="font-medium text-green-800">Rate Limit Override</h4>
                <p className="text-sm text-green-700">Bypass all rate limiting restrictions</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <Unlock className="w-6 h-6 text-blue-600 mb-2" />
                <h4 className="font-medium text-blue-800">Login Block Override</h4>
                <p className="text-sm text-blue-700">Bypass "Too many attempts" blocks</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <Shield className="w-6 h-6 text-purple-600 mb-2" />
                <h4 className="font-medium text-purple-800">All Security Override</h4>
                <p className="text-sm text-purple-700">Bypass all security measures</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <div className="flex justify-center">
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['iipc-status'] })}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Data
        </button>
      </div>
    </div>
  );
}
