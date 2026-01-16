import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  TrendingUp,
  Car,
  Users,
  Eye,
  Share2,
  Calendar,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart,
  Activity,
  Target,
  Clock,
  Facebook,
  RefreshCw,
  Download,
  Loader2,
} from 'lucide-react';
import { cn } from '../lib/utils';

// Types
interface AnalyticsData {
  overview: {
    totalListings: number;
    totalLeads: number;
    totalViews: number;
    totalPosts: number;
    conversionRate: number;
    averageDaysOnMarket: number;
  };
  changes: {
    listings: number;
    leads: number;
    views: number;
    posts: number;
  };
  leadsChart: { date: string; value: number }[];
  viewsChart: { date: string; value: number }[];
  sourceBreakdown: { source: string; count: number; percentage: number }[];
  topVehicles: {
    id: string;
    vehicle: string;
    views: number;
    leads: number;
    status: string;
  }[];
  recentActivity: {
    id: string;
    type: string;
    message: string;
    timestamp: string;
  }[];
}

// Date range options
const dateRanges = [
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'Last 90 Days', value: '90d' },
  { label: 'This Year', value: 'year' },
];

// Simple chart component (bar chart)
function BarChartSimple({ data, color = 'blue' }: { data: { date: string; value: number }[]; color?: string }) {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  
  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((item, index) => (
        <div key={index} className="flex-1 flex flex-col items-center gap-1">
          <div
            className={cn('w-full rounded-t transition-all', `bg-${color}-500`)}
            style={{ 
              height: `${(item.value / maxValue) * 100}%`,
              minHeight: item.value > 0 ? '4px' : '0',
              backgroundColor: color === 'blue' ? '#3b82f6' : color === 'green' ? '#22c55e' : '#8b5cf6'
            }}
          />
          <span className="text-[10px] text-gray-500 truncate w-full text-center">
            {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      ))}
    </div>
  );
}

// Donut chart component
function DonutChart({ data }: { data: { source: string; count: number; percentage: number }[] }) {
  const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444'];
  let accumulatedPercentage = 0;
  
  // Calculate stroke dash for each segment
  const segments = data.map((item, index) => {
    const strokeDasharray = `${item.percentage} ${100 - item.percentage}`;
    const strokeDashoffset = -accumulatedPercentage;
    accumulatedPercentage += item.percentage;
    return {
      ...item,
      color: colors[index % colors.length],
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div className="relative w-40 h-40">
      <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
        {segments.map((segment, index) => (
          <circle
            key={index}
            cx="20"
            cy="20"
            r="15.915"
            fill="none"
            stroke={segment.color}
            strokeWidth="5"
            strokeDasharray={segment.strokeDasharray}
            strokeDashoffset={segment.strokeDashoffset}
            className="transition-all duration-500"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">
            {data.reduce((acc, d) => acc + d.count, 0)}
          </p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState('30d');
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  // Fetch analytics data
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['analytics', dateRange],
    queryFn: async () => {
      const response = await api.get('/api/analytics', { params: { period: dateRange } });
      return response.data;
    },
  });

  // Mock data for demo
  const mockData: AnalyticsData = useMemo(() => ({
    overview: {
      totalListings: 156,
      totalLeads: 89,
      totalViews: 12450,
      totalPosts: 234,
      conversionRate: 3.2,
      averageDaysOnMarket: 18,
    },
    changes: {
      listings: 12,
      leads: 23,
      views: 15,
      posts: 8,
    },
    leadsChart: [
      { date: '2026-01-09', value: 5 },
      { date: '2026-01-10', value: 8 },
      { date: '2026-01-11', value: 12 },
      { date: '2026-01-12', value: 7 },
      { date: '2026-01-13', value: 15 },
      { date: '2026-01-14', value: 10 },
      { date: '2026-01-15', value: 18 },
    ],
    viewsChart: [
      { date: '2026-01-09', value: 1200 },
      { date: '2026-01-10', value: 1450 },
      { date: '2026-01-11', value: 1800 },
      { date: '2026-01-12', value: 1350 },
      { date: '2026-01-13', value: 2100 },
      { date: '2026-01-14', value: 1900 },
      { date: '2026-01-15', value: 2650 },
    ],
    sourceBreakdown: [
      { source: 'Facebook Marketplace', count: 45, percentage: 51 },
      { source: 'Facebook Groups', count: 28, percentage: 31 },
      { source: 'Website', count: 12, percentage: 14 },
      { source: 'Other', count: 4, percentage: 4 },
    ],
    topVehicles: [
      { id: '1', vehicle: '2024 Toyota Camry', views: 2340, leads: 12, status: 'active' },
      { id: '2', vehicle: '2024 Ford F-150', views: 1890, leads: 8, status: 'active' },
      { id: '3', vehicle: '2023 Honda Accord', views: 1560, leads: 6, status: 'active' },
      { id: '4', vehicle: '2024 Chevrolet Silverado', views: 1340, leads: 5, status: 'active' },
      { id: '5', vehicle: '2023 Nissan Altima', views: 980, leads: 4, status: 'sold' },
    ],
    recentActivity: [
      { id: '1', type: 'lead', message: 'New lead from Facebook for 2024 Toyota Camry', timestamp: new Date().toISOString() },
      { id: '2', type: 'post', message: 'Posted 3 vehicles to Marketplace', timestamp: new Date(Date.now() - 3600000).toISOString() },
      { id: '3', type: 'view', message: '2024 Ford F-150 reached 1000+ views', timestamp: new Date(Date.now() - 7200000).toISOString() },
      { id: '4', type: 'sync', message: 'Inventory sync completed successfully', timestamp: new Date(Date.now() - 14400000).toISOString() },
    ],
  }), []);

  const analytics = data?.data || mockData;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatTimestamp = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const handleExport = () => {
    // Generate CSV export of analytics
    const csvContent = `Dealers Face Analytics Report - ${new Date().toLocaleDateString()}
    
Overview Metrics:
Total Listings,${analytics.overview.totalListings}
Total Leads,${analytics.overview.totalLeads}
Total Views,${analytics.overview.totalViews}
Total Posts,${analytics.overview.totalPosts}
Conversion Rate,${analytics.overview.conversionRate}%
Avg Days on Market,${analytics.overview.averageDaysOnMarket}

Top Vehicles:
Vehicle,Views,Leads,Status
${analytics.topVehicles.map((v: { vehicle: string; views: number; leads: number; status: string }) => `${v.vehicle},${v.views},${v.leads},${v.status}`).join('\n')}

Lead Sources:
${analytics.sourceBreakdown.map((s: { source: string; count: number; percentage: number }) => `${s.source},${s.count},${s.percentage}%`).join('\n')}
`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-500">Track your Facebook Marketplace performance</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date Range Selector */}
          <div className="relative">
            <button
              onClick={() => setShowDateDropdown(!showDateDropdown)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              <Calendar className="w-4 h-4" />
              {dateRanges.find(d => d.value === dateRange)?.label}
              <ChevronDown className={cn('w-4 h-4 transition-transform', showDateDropdown && 'rotate-180')} />
            </button>
            {showDateDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-10">
                {dateRanges.map((range) => (
                  <button
                    key={range.value}
                    onClick={() => {
                      setDateRange(range.value);
                      setShowDateDropdown(false);
                    }}
                    className={cn(
                      'w-full text-left px-4 py-2 text-sm hover:bg-gray-50',
                      dateRange === range.value && 'bg-blue-50 text-blue-700'
                    )}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={cn('w-5 h-5', isFetching && 'animate-spin')} />
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Car className="w-5 h-5 text-blue-600" />
            </div>
            <span className={cn(
              'inline-flex items-center gap-1 text-sm font-medium',
              analytics.changes.listings >= 0 ? 'text-green-600' : 'text-red-600'
            )}>
              {analytics.changes.listings >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {Math.abs(analytics.changes.listings)}%
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(analytics.overview.totalListings)}</p>
          <p className="text-sm text-gray-500">Active Listings</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <span className={cn(
              'inline-flex items-center gap-1 text-sm font-medium',
              analytics.changes.leads >= 0 ? 'text-green-600' : 'text-red-600'
            )}>
              {analytics.changes.leads >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {Math.abs(analytics.changes.leads)}%
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(analytics.overview.totalLeads)}</p>
          <p className="text-sm text-gray-500">Total Leads</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Eye className="w-5 h-5 text-purple-600" />
            </div>
            <span className={cn(
              'inline-flex items-center gap-1 text-sm font-medium',
              analytics.changes.views >= 0 ? 'text-green-600' : 'text-red-600'
            )}>
              {analytics.changes.views >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {Math.abs(analytics.changes.views)}%
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(analytics.overview.totalViews)}</p>
          <p className="text-sm text-gray-500">Total Views</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Share2 className="w-5 h-5 text-orange-600" />
            </div>
            <span className={cn(
              'inline-flex items-center gap-1 text-sm font-medium',
              analytics.changes.posts >= 0 ? 'text-green-600' : 'text-red-600'
            )}>
              {analytics.changes.posts >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {Math.abs(analytics.changes.posts)}%
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(analytics.overview.totalPosts)}</p>
          <p className="text-sm text-gray-500">Facebook Posts</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Leads Over Time</h3>
              <p className="text-sm text-gray-500">Daily lead generation trend</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <BarChart3 className="w-4 h-4" />
              <span>{analytics.leadsChart.reduce((acc: number, d: { date: string; value: number }) => acc + d.value, 0)} total</span>
            </div>
          </div>
          <BarChartSimple data={analytics.leadsChart} color="blue" />
        </div>

        {/* Views Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Views Over Time</h3>
              <p className="text-sm text-gray-500">Daily listing views trend</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Activity className="w-4 h-4" />
              <span>{formatNumber(analytics.viewsChart.reduce((acc: number, d: { date: string; value: number }) => acc + d.value, 0))} total</span>
            </div>
          </div>
          <BarChartSimple data={analytics.viewsChart} color="green" />
        </div>
      </div>

      {/* Source Breakdown & Top Vehicles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead Sources */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <PieChart className="w-5 h-5 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900">Lead Sources</h3>
          </div>
          <div className="flex items-center justify-center mb-6">
            <DonutChart data={analytics.sourceBreakdown} />
          </div>
          <div className="space-y-3">
            {analytics.sourceBreakdown.map((source: { source: string; count: number; percentage: number }, index: number) => {
              const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-red-500'];
              return (
                <div key={source.source} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-3 h-3 rounded-full', colors[index % colors.length])} />
                    <span className="text-sm text-gray-600">{source.source}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{source.count}</span>
                    <span className="text-xs text-gray-500">({source.percentage}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Performing Vehicles */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900">Top Performing Vehicles</h3>
            </div>
            <span className="text-sm text-gray-500">By views</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                  <th className="pb-3 font-medium">Vehicle</th>
                  <th className="pb-3 font-medium text-right">Views</th>
                  <th className="pb-3 font-medium text-right">Leads</th>
                  <th className="pb-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {analytics.topVehicles.map((vehicle: { id: string; vehicle: string; views: number; leads: number; status: string }, index: number) => (
                  <tr key={vehicle.id} className="border-b border-gray-50">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                          {index + 1}
                        </span>
                        <span className="font-medium text-gray-900">{vehicle.vehicle}</span>
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      <span className="font-medium text-gray-900">{formatNumber(vehicle.views)}</span>
                    </td>
                    <td className="py-3 text-right">
                      <span className="font-medium text-gray-900">{vehicle.leads}</span>
                    </td>
                    <td className="py-3 text-right">
                      <span className={cn(
                        'inline-flex px-2 py-1 text-xs font-medium rounded-full',
                        vehicle.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      )}>
                        {vehicle.status === 'active' ? 'Active' : 'Sold'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Performance Metrics & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Metrics */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Target className="w-5 h-5 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900">Key Metrics</h3>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
              <p className="text-sm text-blue-600 mb-1">Conversion Rate</p>
              <p className="text-2xl font-bold text-blue-700">{analytics.overview.conversionRate}%</p>
              <p className="text-xs text-blue-500 mt-1">Views to leads</p>
            </div>
            <div className="p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
              <p className="text-sm text-green-600 mb-1">Avg. Days on Market</p>
              <p className="text-2xl font-bold text-green-700">{analytics.overview.averageDaysOnMarket}</p>
              <p className="text-xs text-green-500 mt-1">Until sold</p>
            </div>
            <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
              <p className="text-sm text-purple-600 mb-1">Response Rate</p>
              <p className="text-2xl font-bold text-purple-700">94%</p>
              <p className="text-xs text-purple-500 mt-1">Messages answered</p>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            </div>
            <button className="text-sm text-blue-600 hover:text-blue-700">View all</button>
          </div>
          <div className="space-y-4">
            {analytics.recentActivity.map((activity: { id: string; type: string; message: string; timestamp: string }) => {
              const iconMap: Record<string, typeof Users> = {
                lead: Users,
                post: Facebook,
                view: Eye,
                sync: RefreshCw,
              };
              const colorMap: Record<string, string> = {
                lead: 'bg-green-100 text-green-600',
                post: 'bg-blue-100 text-blue-600',
                view: 'bg-purple-100 text-purple-600',
                sync: 'bg-orange-100 text-orange-600',
              };
              const Icon = iconMap[activity.type] || Activity;
              
              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', colorMap[activity.type])}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{activity.message}</p>
                    <p className="text-xs text-gray-500 mt-1">{formatTimestamp(activity.timestamp)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
