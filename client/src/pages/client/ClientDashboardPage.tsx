import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { TrendingUp, Users, Car, Mail } from 'lucide-react';

const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
}> = ({ title, value, icon: Icon, iconColor }) => (
  <div className="bg-white overflow-hidden shadow rounded-lg">
    <div className="p-5">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
            <dd className="text-2xl font-semibold text-gray-900">{value}</dd>
          </dl>
        </div>
      </div>
    </div>
  </div>
);

export const ClientDashboardPage: React.FC = () => {
  const { data: account } = useQuery({
    queryKey: ['currentAccount'],
    queryFn: async () => {
      const response = await api.get('/accounts/current');
      return response.data.data;
    },
  });

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const response = await api.get('/vehicles');
      return response.data.data;
    },
  });

  const { data: users } = useQuery({
    queryKey: ['accountUsers'],
    queryFn: async () => {
      const response = await api.get('/accounts/users');
      return response.data.data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of {account?.name || 'your account'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Vehicles"
          value={vehicles?.length || 0}
          icon={Car}
          iconColor="text-blue-600"
        />
        <StatCard
          title="Team Members"
          value={users?.length || 0}
          icon={Users}
          iconColor="text-green-600"
        />
        <StatCard
          title="Active Posts"
          value="0"
          icon={TrendingUp}
          iconColor="text-purple-600"
        />
        <StatCard
          title="Messages"
          value="0"
          icon={Mail}
          iconColor="text-yellow-600"
        />
      </div>

      {/* Account Info */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Account Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Account Name</p>
            <p className="text-base font-medium text-gray-900">{account?.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Dealership</p>
            <p className="text-base font-medium text-gray-900">{account?.dealershipName || 'Not set'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Subscription Status</p>
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              account?.subscriptionStatus === 'active' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {account?.subscriptionStatus || 'Unknown'}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Active Users</p>
            <p className="text-base font-medium text-gray-900">{account?.activeUserCount || 0}</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
        <div className="text-center py-8 text-gray-500">
          No recent activity to display
        </div>
      </div>
    </div>
  );
};
