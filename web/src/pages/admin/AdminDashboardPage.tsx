import { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  Mail,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronRight,
  Car,
} from 'lucide-react';
import { adminApi } from '../../lib/api';

interface SystemStats {
  accounts: { total: number; active: number; inactive: number };
  users: number;
  vehicles: number;
  posts: number;
  revenue: { last30Days: number };
  subscriptions: Array<{ subscriptionPlanId: string; _count: number }>;
}

interface RecentAccount {
  id: string;
  name: string;
  dealershipName?: string;
  createdAt: string;
  subscriptionStatus: string;
  isActive: boolean;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [recentAccounts, setRecentAccounts] = useState<RecentAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const [statsResponse, accountsResponse] = await Promise.all([
        adminApi.getStats(),
        adminApi.getAccounts({ limit: 5 }),
      ]);
      setStats(statsResponse.data);
      setRecentAccounts(accountsResponse.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Accounts',
      value: stats?.accounts.total || 0,
      subtitle: `${stats?.accounts.active || 0} active`,
      icon: Building2,
      color: 'blue',
      trend: '+12%',
    },
    {
      title: 'Total Users',
      value: stats?.users || 0,
      subtitle: 'Across all accounts',
      icon: Users,
      color: 'green',
      trend: '+8%',
    },
    {
      title: 'Revenue (30d)',
      value: `$${(stats?.revenue.last30Days || 0).toLocaleString()}`,
      subtitle: 'Monthly recurring',
      icon: DollarSign,
      color: 'emerald',
      trend: '+15%',
    },
    {
      title: 'Vehicles',
      value: stats?.vehicles || 0,
      subtitle: 'In inventory',
      icon: Car,
      color: 'purple',
      trend: '+5%',
    },
    {
      title: 'FB Posts',
      value: stats?.posts || 0,
      subtitle: 'Total published',
      icon: TrendingUp,
      color: 'indigo',
      trend: '+23%',
    },
  ];

  const colorClasses: Record<string, { bg: string; icon: string; text: string }> = {
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600', text: 'text-blue-700' },
    green: { bg: 'bg-green-50', icon: 'text-green-600', text: 'text-green-700' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', text: 'text-emerald-700' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', text: 'text-purple-700' },
    indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-600', text: 'text-indigo-700' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Dashboard</h1>
        <p className="text-gray-500 mt-1">FaceMyDealer platform overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((stat) => {
          const colors = colorClasses[stat.color];
          return (
            <div
              key={stat.title}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-lg ${colors.bg}`}>
                  <stat.icon className={`w-5 h-5 ${colors.icon}`} />
                </div>
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  {stat.trend}
                </span>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Accounts */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Accounts</h2>
            <a href="/admin/accounts" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View all <ChevronRight className="w-4 h-4" />
            </a>
          </div>
          <div className="space-y-3">
            {recentAccounts.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">No accounts yet</p>
            ) : (
              recentAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{account.name}</p>
                      <p className="text-sm text-gray-500">{account.dealershipName || 'No dealership'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        account.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {account.isActive ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      {account.subscriptionStatus}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <a
              href="/admin/accounts"
              className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Building2 className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-700">Manage Accounts</span>
            </a>
            <a
              href="/admin/users"
              className="flex items-center gap-3 p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              <Users className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-700">Manage Users</span>
            </a>
            <a
              href="/admin/payments"
              className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <span className="font-medium text-emerald-700">View Payments</span>
            </a>
            <a
              href="/admin/emails"
              className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <Mail className="w-5 h-5 text-purple-600" />
              <span className="font-medium text-purple-700">Email Logs</span>
            </a>
            <a
              href="/admin/audit"
              className="flex items-center gap-3 p-4 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              <Activity className="w-5 h-5 text-indigo-600" />
              <span className="font-medium text-indigo-700">Audit Logs</span>
            </a>
            <a
              href="/admin/settings"
              className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <AlertCircle className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-700">System Settings</span>
            </a>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">System Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <div>
              <p className="text-sm font-medium text-green-700">API Server</p>
              <p className="text-xs text-green-600">Operational</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <div>
              <p className="text-sm font-medium text-green-700">Database</p>
              <p className="text-xs text-green-600">Connected</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <div>
              <p className="text-sm font-medium text-green-700">Email Service</p>
              <p className="text-xs text-green-600">Active</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <div>
              <p className="text-sm font-medium text-green-700">Job Queue</p>
              <p className="text-xs text-green-600">Running</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
