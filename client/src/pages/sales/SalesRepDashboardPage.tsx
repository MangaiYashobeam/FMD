import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { Car, TrendingUp, CheckCircle, Clock } from 'lucide-react';

interface DashboardStats {
  totalVehicles: number;
  postsToday: number;
  activePosts: number;
  pendingPosts: number;
}

interface RecentPost {
  id: string;
  vehicleId: string;
  vehicle: {
    year: number;
    make: string;
    model: string;
    price: number;
  };
  status: string;
  createdAt: string;
}

export const SalesRepDashboardPage: React.FC = () => {
  const { data: stats } = useQuery({
    queryKey: ['salesRepStats'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: DashboardStats }>('/sales-rep/stats');
      return response.data.data;
    },
  });

  const { data: recentPosts } = useQuery({
    queryKey: ['recentPosts'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: RecentPost[] }>('/sales-rep/recent-posts');
      return response.data.data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Welcome back! Here's your posting overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Car className="h-8 w-8 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Available Vehicles</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{stats?.totalVehicles || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Posts Today</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{stats?.postsToday || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Posts</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{stats?.activePosts || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Pending</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{stats?.pendingPosts || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Posts */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Posts</h2>
        
        {recentPosts && recentPosts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vehicle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Posted
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentPosts.map((post) => (
                  <tr key={post.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {post.vehicle.year} {post.vehicle.make} {post.vehicle.model}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${post.vehicle.price.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        post.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                        post.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {post.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-8">No recent posts</p>
        )}
      </div>
    </div>
  );
};
