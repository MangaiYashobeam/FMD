import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSystemStats, getRevenueAnalytics } from '@/services/adminService';
import { TrendingUp, TrendingDown, Users, DollarSign, Building2, UserCheck } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const StatCard: React.FC<{
  title: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  iconColor: string;
}> = ({ title, value, change, icon: Icon, iconColor }) => (
  <div className="bg-white overflow-hidden shadow rounded-lg">
    <div className="p-5">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
            <dd className="flex items-baseline">
              <div className="text-2xl font-semibold text-gray-900">{value}</div>
              {change !== undefined && (
                <div className={`ml-2 flex items-baseline text-sm font-semibold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {change >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                  {Math.abs(change).toFixed(1)}%
                </div>
              )}
            </dd>
          </dl>
        </div>
      </div>
    </div>
  </div>
);

export const DashboardPage: React.FC = () => {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['systemStats'],
    queryFn: getSystemStats,
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['revenueAnalytics'],
    queryFn: () => getRevenueAnalytics('12m'),
  });

  if (statsLoading || revenueLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          System overview and key metrics
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Accounts"
          value={stats?.totalAccounts || 0}
          change={stats?.accountsGrowth}
          icon={Building2}
          iconColor="text-blue-600"
        />
        <StatCard
          title="Active Accounts"
          value={stats?.activeAccounts || 0}
          icon={UserCheck}
          iconColor="text-green-600"
        />
        <StatCard
          title="Total Users"
          value={stats?.totalUsers || 0}
          icon={Users}
          iconColor="text-purple-600"
        />
        <StatCard
          title="Monthly Revenue"
          value={`$${(stats?.monthlyRevenue || 0).toLocaleString()}`}
          change={stats?.revenueGrowth}
          icon={DollarSign}
          iconColor="text-yellow-600"
        />
      </div>

      {/* Revenue Chart */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Revenue Trend (Last 12 Months)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={revenueData || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip 
              formatter={(value) => [`$${(value || 0).toLocaleString()}`, 'Revenue']}
            />
            <Line 
              type="monotone" 
              dataKey="revenue" 
              stroke="#2563eb" 
              strokeWidth={2}
              dot={{ fill: '#2563eb' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">System Health</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Active Users</span>
              <span className="text-sm font-medium text-gray-900">{stats?.activeUsers || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Account Utilization</span>
              <span className="text-sm font-medium text-gray-900">
                {stats?.activeAccounts && stats?.totalAccounts 
                  ? `${((stats.activeAccounts / stats.totalAccounts) * 100).toFixed(1)}%`
                  : '0%'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Total Revenue</span>
              <span className="text-sm font-medium text-gray-900">${(stats?.totalRevenue || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Growth Metrics</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Account Growth</span>
              <span className={`text-sm font-medium ${(stats?.accountsGrowth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(stats?.accountsGrowth || 0) >= 0 ? '+' : ''}{(stats?.accountsGrowth || 0).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Revenue Growth</span>
              <span className={`text-sm font-medium ${(stats?.revenueGrowth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(stats?.revenueGrowth || 0) >= 0 ? '+' : ''}{(stats?.revenueGrowth || 0).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
