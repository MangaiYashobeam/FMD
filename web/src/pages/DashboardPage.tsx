import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Car,
  TrendingUp,
  Facebook,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

// Stat card component
function StatCard({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'increase' | 'decrease';
  icon: React.ElementType;
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        {change && (
          <div
            className={`flex items-center text-sm font-medium ${
              changeType === 'increase' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {changeType === 'increase' ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )}
            {change}
          </div>
        )}
      </div>
      <div className="mt-4">
        <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
        <p className="text-sm text-gray-500 mt-1">{title}</p>
      </div>
    </div>
  );
}

// Recent activity item
function ActivityItem({
  title,
  description,
  time,
  status,
}: {
  title: string;
  description: string;
  time: string;
  status: 'success' | 'pending' | 'error';
}) {
  const statusIcons = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    pending: <Clock className="w-5 h-5 text-yellow-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
  };

  return (
    <div className="flex items-start gap-3 py-3">
      {statusIcons[status]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-sm text-gray-500 truncate">{description}</p>
      </div>
      <span className="text-xs text-gray-400">{time}</span>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold">Welcome back, {user?.name?.split(' ')[0]}! 👋</h1>
        <p className="text-blue-100 mt-1">
          Here's what's happening with your inventory today.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Vehicles"
          value="156"
          change="+12%"
          changeType="increase"
          icon={Car}
          color="blue"
        />
        <StatCard
          title="Active Listings"
          value="142"
          change="+8%"
          changeType="increase"
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Facebook Posts"
          value="89"
          change="+15%"
          changeType="increase"
          icon={Facebook}
          color="purple"
        />
        <StatCard
          title="Last Sync"
          value="2h ago"
          icon={RefreshCw}
          color="orange"
        />
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div className="p-6 divide-y divide-gray-100">
            <ActivityItem
              title="Inventory Synced"
              description="156 vehicles synced from DMS"
              time="2h ago"
              status="success"
            />
            <ActivityItem
              title="New Listing Posted"
              description="2024 Honda Accord EX posted to Facebook"
              time="3h ago"
              status="success"
            />
            <ActivityItem
              title="Price Updated"
              description="2023 Toyota Camry price changed to $28,500"
              time="5h ago"
              status="success"
            />
            <ActivityItem
              title="Vehicle Sold"
              description="2022 Ford F-150 marked as sold"
              time="Yesterday"
              status="success"
            />
            <ActivityItem
              title="Sync Scheduled"
              description="Next auto-sync in 4 hours"
              time="Upcoming"
              status="pending"
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="p-4 space-y-2">
            <button className="w-full flex items-center gap-3 p-3 text-left rounded-lg hover:bg-gray-50 transition-colors">
              <div className="p-2 bg-blue-100 rounded-lg">
                <RefreshCw className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Sync Now</p>
                <p className="text-sm text-gray-500">Update inventory from DMS</p>
              </div>
            </button>
            <button className="w-full flex items-center gap-3 p-3 text-left rounded-lg hover:bg-gray-50 transition-colors">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Facebook className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Post to Facebook</p>
                <p className="text-sm text-gray-500">Share new listings</p>
              </div>
            </button>
            <button className="w-full flex items-center gap-3 p-3 text-left rounded-lg hover:bg-gray-50 transition-colors">
              <div className="p-2 bg-green-100 rounded-lg">
                <Car className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">View Inventory</p>
                <p className="text-sm text-gray-500">Manage your vehicles</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
