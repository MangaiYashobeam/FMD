/**
 * Posting Settings Page
 * 
 * Glo3D-style interface for configuring Facebook Marketplace auto-posting
 * Features: Day selector, hours, frequency, limits, auto-renew, auto-repost
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { cn } from '../lib/utils';
import {
  Play,
  Pause,
  RefreshCw,
  Settings,
  Clock,
  RotateCw,
  TrendingUp,
  Save,
  Info,
  Send,
  Calendar,
  Target,
  Video,
  MapPin,
  DollarSign,
} from 'lucide-react';

interface PostingSettings {
  postOnSunday: boolean;
  postOnMonday: boolean;
  postOnTuesday: boolean;
  postOnWednesday: boolean;
  postOnThursday: boolean;
  postOnFriday: boolean;
  postOnSaturday: boolean;
  postFromHour: number;
  postUntilHour: number;
  postIntervalMinutes: number;
  dailyPostLimit: number;
  postingPriority: string;
  includeVideos: boolean;
  videoSource: string;
  conditionTemplate: string | null;
  postingLocation: string | null;
  postingRadius: number;
  autoRenewEnabled: boolean;
  renewFrequencyDays: number;
  autoRepostEnabled: boolean;
  repostFrequencyDays: number;
  autoUpdatePrices: boolean;
  priceChangeThreshold: number;
  isActive: boolean;
  postsToday: number;
  totalPosts: number;
  lastPostAt: string | null;
}

interface PostingStatus {
  stats: {
    totalVehicles: number;
    postedVehicles: number;
    unpostedVehicles: number;
    pendingTasks: number;
  };
  recentPosts: Array<{
    id: string;
    vehicle: string;
    stockNumber: string;
    status: string;
    postedAt: string;
    postUrl: string;
  }>;
}

const DAYS = [
  { key: 'postOnSunday', label: 'Sun', full: 'Sunday' },
  { key: 'postOnMonday', label: 'Mon', full: 'Monday' },
  { key: 'postOnTuesday', label: 'Tue', full: 'Tuesday' },
  { key: 'postOnWednesday', label: 'Wed', full: 'Wednesday' },
  { key: 'postOnThursday', label: 'Thu', full: 'Thursday' },
  { key: 'postOnFriday', label: 'Fri', full: 'Friday' },
  { key: 'postOnSaturday', label: 'Sat', full: 'Saturday' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i === 0 ? '12 AM' : i === 12 ? '12 PM' : i < 12 ? `${i} AM` : `${i - 12} PM`,
}));

export default function PostingSettingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [settings, setSettings] = useState<PostingSettings | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch settings
  const { data: settingsData, isLoading: loadingSettings } = useQuery({
    queryKey: ['posting-settings'],
    queryFn: async () => {
      const res = await api.get('/posting/settings');
      return res.data.data.settings;
    },
  });

  // Fetch status
  const { data: statusData, refetch: refetchStatus } = useQuery({
    queryKey: ['posting-status'],
    queryFn: async () => {
      const res = await api.get('/posting/status');
      return res.data.data as PostingStatus;
    },
  });

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<PostingSettings>) => {
      const res = await api.put('/posting/settings', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posting-settings'] });
      toast.success('Settings saved!');
      setHasChanges(false);
    },
    onError: () => {
      toast.error('Failed to save settings');
    },
  });

  // Toggle active mutation
  const toggleMutation = useMutation({
    mutationFn: async (active: boolean) => {
      if (active) {
        await api.post('/posting/resume');
      } else {
        await api.post('/posting/pause');
      }
    },
    onSuccess: (_, active) => {
      queryClient.invalidateQueries({ queryKey: ['posting-settings'] });
      toast.success(active ? 'Auto-posting resumed!' : 'Auto-posting paused');
    },
    onError: () => {
      toast.error('Failed to update posting status');
    },
  });

  // Trigger manual post mutation
  const triggerMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/posting/trigger');
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Posting queued: ${data.data.vehicle.title}`);
      refetchStatus();
    },
    onError: (err: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || 'Failed to trigger post');
    },
  });

  // Initialize settings from fetch
  useEffect(() => {
    if (settingsData && !settings) {
      setSettings(settingsData);
    }
  }, [settingsData, settings]);

  const updateSetting = <K extends keyof PostingSettings>(key: K, value: PostingSettings[K]) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    setHasChanges(true);
  };

  const handleSave = () => {
    if (settings) {
      saveMutation.mutate(settings);
    }
  };

  const handleToggle = () => {
    if (settings) {
      toggleMutation.mutate(!settings.isActive);
      setSettings({ ...settings, isActive: !settings.isActive });
    }
  };

  if (loadingSettings || !settings) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Auto-Posting Settings
          </h1>
          <p className="text-gray-500 mt-1">
            Configure automatic Facebook Marketplace posting (Glo3D-style)
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleToggle}
            className={cn(
              'px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors',
              settings.isActive
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            )}
          >
            {settings.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {settings.isActive ? 'Pause' : 'Start'}
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Status Banner */}
      <div
        className={cn(
          'rounded-xl p-4 mb-6 text-white',
          settings.isActive ? 'bg-green-600' : 'bg-gray-600'
        )}
      >
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-center">
          <div>
            <p className="text-lg font-semibold">
              {settings.isActive ? '🟢 Active' : '⏸️ Paused'}
            </p>
            <p className="text-sm opacity-90">
              Posts today: {settings.postsToday} / {settings.dailyPostLimit || '∞'}
            </p>
          </div>
          {statusData && (
            <>
              <div className="text-center">
                <p className="text-3xl font-bold">{statusData.stats.totalVehicles}</p>
                <p className="text-sm opacity-90">Total Vehicles</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">{statusData.stats.postedVehicles}</p>
                <p className="text-sm opacity-90">Posted</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">{statusData.stats.unpostedVehicles}</p>
                <p className="text-sm opacity-90">Ready to Post</p>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={() => triggerMutation.mutate()}
                  disabled={triggerMutation.isPending}
                  className="px-4 py-2 bg-white/20 rounded-lg font-medium hover:bg-white/30 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Post Next Now
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Schedule Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Posting Schedule
          </h2>

          {/* Day Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Post On Days:
            </label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => (
                <button
                  key={day.key}
                  onClick={() =>
                    updateSetting(
                      day.key as keyof PostingSettings,
                      !settings[day.key as keyof PostingSettings]
                    )
                  }
                  className={cn(
                    'px-3 py-2 rounded-lg font-medium text-sm transition-colors',
                    settings[day.key as keyof PostingSettings]
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Hour Range */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <select
                value={settings.postFromHour}
                onChange={(e) => updateSetting('postFromHour', Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {HOURS.map((hour) => (
                  <option key={hour.value} value={hour.value}>
                    {hour.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Until</label>
              <select
                value={settings.postUntilHour}
                onChange={(e) => updateSetting('postUntilHour', Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {HOURS.map((hour) => (
                  <option key={hour.value} value={hour.value}>
                    {hour.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Posting Frequency */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Post Every: {settings.postIntervalMinutes} minutes
            </label>
            <input
              type="range"
              min={5}
              max={120}
              step={5}
              value={settings.postIntervalMinutes}
              onChange={(e) => updateSetting('postIntervalMinutes', Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>5m</span>
              <span>30m</span>
              <span>1h</span>
              <span>2h</span>
            </div>
          </div>

          {/* Daily Limit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Target className="w-4 h-4" />
              Daily Post Limit: {settings.dailyPostLimit || 'Unlimited'}
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={settings.dailyPostLimit}
              onChange={(e) => updateSetting('dailyPostLimit', Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>∞</span>
              <span>25</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>
        </div>

        {/* Posting Options */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            Posting Options
          </h2>

          {/* Priority */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Posting Priority</label>
            <select
              value={settings.postingPriority}
              onChange={(e) => updateSetting('postingPriority', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="descending">Newest First (Descending)</option>
              <option value="ascending">Oldest First (Ascending)</option>
              <option value="price_high">Highest Price First</option>
              <option value="price_low">Lowest Price First</option>
            </select>
          </div>

          {/* Videos Toggle */}
          <div className="mb-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={settings.includeVideos}
                  onChange={(e) => updateSetting('includeVideos', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </div>
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Include Videos in Posts</span>
              </div>
            </label>
          </div>

          {settings.includeVideos && (
            <div className="mb-4 ml-14">
              <label className="block text-sm font-medium text-gray-700 mb-1">Video Source</label>
              <select
                value={settings.videoSource}
                onChange={(e) => updateSetting('videoSource', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="walkaround">Walk-around Video</option>
                <option value="videotour">Video Tour</option>
              </select>
            </div>
          )}

          {/* Location */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              Posting Location
            </label>
            <input
              type="text"
              value={settings.postingLocation || ''}
              onChange={(e) => updateSetting('postingLocation', e.target.value)}
              placeholder="Enter city or ZIP code"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          {/* Radius */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Posting Radius: {settings.postingRadius} miles
            </label>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={settings.postingRadius}
              onChange={(e) => updateSetting('postingRadius', Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>5mi</span>
              <span>25mi</span>
              <span>50mi</span>
              <span>100mi</span>
            </div>
          </div>
        </div>

        {/* Auto-Renewal Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <RotateCw className="w-5 h-5 text-indigo-600" />
            Auto-Renewal & Repost
          </h2>

          {/* Auto-Renew */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <div className="relative mt-1">
                <input
                  type="checkbox"
                  checked={settings.autoRenewEnabled}
                  onChange={(e) => updateSetting('autoRenewEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Auto-Renew Listings</span>
                <p className="text-sm text-gray-500">
                  Automatically renew active listings to stay at the top
                </p>
              </div>
            </label>
            {settings.autoRenewEnabled && (
              <div className="mt-4 ml-14">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Renew Every: {settings.renewFrequencyDays} days
                </label>
                <input
                  type="range"
                  min={1}
                  max={14}
                  step={1}
                  value={settings.renewFrequencyDays}
                  onChange={(e) => updateSetting('renewFrequencyDays', Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1d</span>
                  <span>7d</span>
                  <span>14d</span>
                </div>
              </div>
            )}
          </div>

          {/* Auto-Repost */}
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <div className="relative mt-1">
                <input
                  type="checkbox"
                  checked={settings.autoRepostEnabled}
                  onChange={(e) => updateSetting('autoRepostEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Auto-Repost Expired Listings</span>
                <p className="text-sm text-gray-500">
                  Re-create listings that have been archived or removed
                </p>
              </div>
            </label>
            {settings.autoRepostEnabled && (
              <div className="mt-4 ml-14">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Repost After: {settings.repostFrequencyDays} days
                </label>
                <input
                  type="range"
                  min={7}
                  max={90}
                  step={1}
                  value={settings.repostFrequencyDays}
                  onChange={(e) => updateSetting('repostFrequencyDays', Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>7d</span>
                  <span>30d</span>
                  <span>60d</span>
                  <span>90d</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Price Updates */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            Price Synchronization
          </h2>

          <div className="bg-gray-50 rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <div className="relative mt-1">
                <input
                  type="checkbox"
                  checked={settings.autoUpdatePrices}
                  onChange={(e) => updateSetting('autoUpdatePrices', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Auto-Update Prices</span>
                <p className="text-sm text-gray-500">
                  Automatically update Facebook listing prices when inventory changes
                </p>
              </div>
            </label>
            {settings.autoUpdatePrices && (
              <div className="mt-4 ml-14">
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  Price Change Threshold: ${settings.priceChangeThreshold}
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Only update if price changed by more than this amount
                </p>
                <input
                  type="range"
                  min={0}
                  max={1000}
                  step={50}
                  value={settings.priceChangeThreshold}
                  onChange={(e) => updateSetting('priceChangeThreshold', Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>$0</span>
                  <span>$250</span>
                  <span>$500</span>
                  <span>$1k</span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-800">
                <strong>How it works:</strong> When your inventory feed updates with a new price,
                the system will automatically update the Facebook Marketplace listing to match.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {statusData && statusData.recentPosts.length > 0 && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-indigo-600" />
              Recent Posting Activity
            </h2>
            <button
              onClick={() => refetchStatus()}
              className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {statusData.recentPosts.map((post) => (
              <div key={post.id} className="border border-gray-200 rounded-lg p-4">
                <p className="font-medium text-gray-900 truncate">{post.vehicle}</p>
                <p className="text-sm text-gray-500">Stock: {post.stockNumber || 'N/A'}</p>
                <div className="flex justify-between items-center mt-2">
                  <span
                    className={cn(
                      'px-2 py-1 text-xs rounded-full font-medium',
                      post.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700'
                        : post.status === 'PENDING'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-700'
                    )}
                  >
                    {post.status}
                  </span>
                  <span className="text-xs text-gray-500">
                    {post.postedAt ? new Date(post.postedAt).toLocaleDateString() : 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save Reminder */}
      {hasChanges && (
        <div className="fixed bottom-4 right-4 bg-amber-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-4 z-50">
          <span className="font-medium">You have unsaved changes</span>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="px-4 py-2 bg-white text-amber-600 rounded-lg font-medium hover:bg-amber-50"
          >
            Save Now
          </button>
        </div>
      )}
    </div>
  );
}
