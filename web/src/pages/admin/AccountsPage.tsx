import { useState, useEffect } from 'react';
import {
  Building2,
  Search,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Car,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  LogIn,
  TrendingUp,
  Activity,
  RefreshCw,
  Calendar,
  DollarSign,
  X,
} from 'lucide-react';
import { adminApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

interface Account {
  id: string;
  name: string;
  dealershipName?: string;
  subscriptionStatus: string;
  subscriptionPlanId?: string;
  isActive: boolean;
  createdAt: string;
  trialEndsAt?: string;
  subscriptionPlan?: { name: string; basePrice: number };
  accountUsers?: Array<{ 
    role: string;
    user: { 
      id: string;
      email: string; 
      firstName: string; 
      lastName: string;
      isActive: boolean;
    } 
  }>;
  _count?: { vehicles: number; syncJobs: number; payments: number };
}

const roleColors: Record<string, { bg: string; text: string }> = {
  SUPER_ADMIN: { bg: 'bg-purple-100', text: 'text-purple-700' },
  ACCOUNT_OWNER: { bg: 'bg-blue-100', text: 'text-blue-700' },
  ADMIN: { bg: 'bg-green-100', text: 'text-green-700' },
  SALES_REP: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  VIEWER: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'analytics'>('overview');
  const limit = 10;
  
  const { impersonateUser } = useAuth();
  const toast = useToast();

  useEffect(() => {
    loadAccounts();
  }, [page, searchTerm, statusFilter]);

  const loadAccounts = async () => {
    try {
      setIsLoading(true);
      const response = await adminApi.getAccounts({
        limit,
        offset: (page - 1) * limit,
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setAccounts(response.data.data || []);
      setTotal(response.data.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (account: Account) => {
    try {
      await adminApi.updateAccountStatus(account.id, !account.isActive);
      loadAccounts();
    } catch (err) {
      console.error('Failed to update account status:', err);
    }
  };

  const handleDeleteAccount = async (account: Account) => {
    if (!confirm(`Are you sure you want to delete "${account.name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await adminApi.deleteAccount(account.id);
      loadAccounts();
    } catch (err) {
      console.error('Failed to delete account:', err);
    }
  };

  const handleImpersonateUser = async (userId: string, userEmail: string) => {
    setImpersonatingUserId(userId);
    try {
      await impersonateUser(userId);
      toast.success(`Now viewing as ${userEmail}`);
    } catch (error) {
      console.error('Failed to impersonate:', error);
      toast.error('Failed to impersonate user');
    } finally {
      setImpersonatingUserId(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const statusBadge = (account: Account) => {
    if (!account.isActive) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
          <XCircle className="w-3 h-3" /> Inactive
        </span>
      );
    }
    switch (account.subscriptionStatus) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" /> Active
          </span>
        );
      case 'trial':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <Clock className="w-3 h-3" /> Trial
          </span>
        );
      case 'past_due':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <XCircle className="w-3 h-3" /> Past Due
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {account.subscriptionStatus}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="text-gray-500 mt-1">Manage all dealership accounts</p>
        </div>
        <button
          onClick={() => alert('Create account modal coming soon')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Account
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search accounts..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="past_due">Past Due</option>
            <option value="canceled">Canceled</option>
          </select>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plan
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Users
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vehicles
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No accounts found
                  </td>
                </tr>
              ) : (
                accounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{account.name}</p>
                          <p className="text-sm text-gray-500">{account.dealershipName || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">{statusBadge(account)}</td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">
                        {account.subscriptionPlan?.name || 'No Plan'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Users className="w-4 h-4" />
                        {account.accountUsers?.length || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Car className="w-4 h-4" />
                        {account._count?.vehicles || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(account.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2 relative z-10">
                        <button
                          type="button"
                          onClick={() => { setSelectedAccount(account); setActiveTab('overview'); }}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSelectedAccount(account); setActiveTab('users'); }}
                          className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                          title="View Users & Impersonate"
                        >
                          <LogIn className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(account)}
                          className={`p-2 rounded-lg transition-colors cursor-pointer ${
                            account.isActive
                              ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                              : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                          }`}
                          title={account.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {account.isActive ? (
                            <XCircle className="w-4 h-4" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAccount(account)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete"
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} accounts
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Account Details Modal - Enhanced */}
      {selectedAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-blue-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                    <Building2 className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">{selectedAccount.name}</h2>
                    <p className="text-blue-100">{selectedAccount.dealershipName || 'Dealership Account'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAccount(null)}
                  className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Tabs */}
              <div className="flex gap-1 mt-4">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'overview'
                      ? 'bg-white text-blue-700'
                      : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'users'
                      ? 'bg-white text-blue-700'
                      : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  Users ({selectedAccount.accountUsers?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'analytics'
                      ? 'bg-white text-blue-700'
                      : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  Analytics
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-blue-50 rounded-xl text-center">
                      <Users className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-gray-900">{selectedAccount.accountUsers?.length || 0}</p>
                      <p className="text-sm text-gray-500">Users</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-xl text-center">
                      <Car className="w-6 h-6 text-green-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-gray-900">{selectedAccount._count?.vehicles || 0}</p>
                      <p className="text-sm text-gray-500">Vehicles</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-xl text-center">
                      <RefreshCw className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-gray-900">{selectedAccount._count?.syncJobs || 0}</p>
                      <p className="text-sm text-gray-500">Sync Jobs</p>
                    </div>
                    <div className="p-4 bg-amber-50 rounded-xl text-center">
                      <DollarSign className="w-6 h-6 text-amber-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-gray-900">{selectedAccount._count?.payments || 0}</p>
                      <p className="text-sm text-gray-500">Payments</p>
                    </div>
                  </div>

                  {/* Account Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <p className="text-sm text-gray-500 mb-1">Status</p>
                      <div>{statusBadge(selectedAccount)}</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <p className="text-sm text-gray-500 mb-1">Plan</p>
                      <p className="font-semibold text-gray-900">{selectedAccount.subscriptionPlan?.name || 'No Plan'}</p>
                      {selectedAccount.subscriptionPlan?.basePrice && (
                        <p className="text-sm text-gray-500">${selectedAccount.subscriptionPlan.basePrice}/month</p>
                      )}
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <p className="text-sm text-gray-500 mb-1">Created</p>
                      <p className="font-semibold text-gray-900">{new Date(selectedAccount.createdAt).toLocaleDateString()}</p>
                    </div>
                    {selectedAccount.trialEndsAt && (
                      <div className="p-4 bg-gray-50 rounded-xl">
                        <p className="text-sm text-gray-500 mb-1">Trial Ends</p>
                        <p className="font-semibold text-gray-900">{new Date(selectedAccount.trialEndsAt).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Users Tab */}
              {activeTab === 'users' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">Click the login icon to impersonate any user in this account.</p>
                  
                  {selectedAccount.accountUsers && selectedAccount.accountUsers.length > 0 ? (
                    <div className="space-y-3">
                      {selectedAccount.accountUsers.map((au, index) => {
                        const roleStyle = roleColors[au.role] || roleColors.VIEWER;
                        return (
                          <div
                            key={index}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                                {au.user.firstName?.[0]}{au.user.lastName?.[0]}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {au.user.firstName} {au.user.lastName}
                                </p>
                                <p className="text-sm text-gray-500">{au.user.email}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${roleStyle.bg} ${roleStyle.text}`}>
                                    {au.role.replace('_', ' ')}
                                  </span>
                                  {au.user.isActive ? (
                                    <span className="text-xs text-green-600">● Active</span>
                                  ) : (
                                    <span className="text-xs text-gray-400">● Inactive</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleImpersonateUser(au.user.id, au.user.email)}
                              disabled={impersonatingUserId === au.user.id}
                              className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50"
                              title="Login as this user"
                            >
                              {impersonatingUserId === au.user.id ? (
                                <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <LogIn className="w-4 h-4" />
                              )}
                              <span className="text-sm font-medium">Impersonate</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No users in this account</p>
                    </div>
                  )}
                </div>
              )}

              {/* Analytics Tab */}
              {activeTab === 'analytics' && (
                <div className="space-y-6">
                  {/* Usage Stats */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Account Usage Statistics
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 border border-gray-200 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-500">Inventory Listings</span>
                          <TrendingUp className="w-4 h-4 text-green-500" />
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{selectedAccount._count?.vehicles || 0}</p>
                        <p className="text-xs text-green-600 mt-1">Active vehicles</p>
                      </div>
                      <div className="p-4 border border-gray-200 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-500">Total Syncs</span>
                          <RefreshCw className="w-4 h-4 text-blue-500" />
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{selectedAccount._count?.syncJobs || 0}</p>
                        <p className="text-xs text-blue-600 mt-1">FTP sync jobs run</p>
                      </div>
                      <div className="p-4 border border-gray-200 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-500">Revenue</span>
                          <DollarSign className="w-4 h-4 text-amber-500" />
                        </div>
                        <p className="text-2xl font-bold text-gray-900">
                          ${((selectedAccount.subscriptionPlan?.basePrice || 0) * (selectedAccount._count?.payments || 0)).toFixed(0)}
                        </p>
                        <p className="text-xs text-amber-600 mt-1">Total payments</p>
                      </div>
                    </div>
                  </div>

                  {/* Activity Timeline Mock */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Recent Activity
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                        <div>
                          <p className="text-sm text-gray-900">Account created</p>
                          <p className="text-xs text-gray-500">{new Date(selectedAccount.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                      {selectedAccount._count?.syncJobs ? (
                        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                          <div>
                            <p className="text-sm text-gray-900">{selectedAccount._count.syncJobs} sync jobs completed</p>
                            <p className="text-xs text-gray-500">Inventory synchronization</p>
                          </div>
                        </div>
                      ) : null}
                      {selectedAccount._count?.vehicles ? (
                        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="w-2 h-2 rounded-full bg-purple-500 mt-2" />
                          <div>
                            <p className="text-sm text-gray-900">{selectedAccount._count.vehicles} vehicles in inventory</p>
                            <p className="text-xs text-gray-500">Current active listings</p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between">
              <button
                onClick={() => handleToggleStatus(selectedAccount)}
                className={`px-4 py-2 rounded-lg font-medium ${
                  selectedAccount.isActive
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                {selectedAccount.isActive ? 'Deactivate Account' : 'Activate Account'}
              </button>
              <button
                onClick={() => setSelectedAccount(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
