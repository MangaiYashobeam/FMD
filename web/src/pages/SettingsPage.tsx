import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountsApi } from '../lib/api';
import {
  Building2,
  User,
  Bell,
  CreditCard,
  Key,
  Server,
  Save,
  Loader2,
  CheckCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

type SettingsTab = 'profile' | 'dealership' | 'ftp' | 'notifications' | 'billing' | 'security';

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [showPassword, setShowPassword] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form states
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
  });

  const [dealershipForm, setDealershipForm] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    website: '',
    logo: '',
  });

  const [ftpForm, setFtpForm] = useState({
    host: '',
    port: '21',
    username: '',
    password: '',
    path: '/inventory',
    autoSync: true,
    syncInterval: '6',
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailSyncComplete: true,
    emailSyncError: true,
    emailNewLead: true,
    pushNotifications: false,
  });

  // Fetch account data
  const { data: _accountData } = useQuery({
    queryKey: ['account-settings'],
    queryFn: async () => {
      const response = await accountsApi.getCurrent();
      return response.data;
    },
  });

  // Test FTP connection
  const testFtpMutation = useMutation({
    mutationFn: async () => {
      return accountsApi.testFtp({
        host: ftpForm.host,
        username: ftpForm.username,
        password: ftpForm.password,
        path: ftpForm.path,
      });
    },
  });

  // Save settings
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      return accountsApi.update(user?.accounts?.[0]?.id || '', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-settings'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'dealership', label: 'Dealership', icon: Building2 },
    { id: 'ftp', label: 'FTP/Data Feed', icon: Server },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'security', label: 'Security', icon: Key },
  ];

  const handleSave = () => {
    const data = {
      profile: profileForm,
      dealership: dealershipForm,
      ftp: ftpForm,
      notifications: notificationSettings,
    };
    saveMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500">Manage your account and dealership settings</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saveSuccess ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saveSuccess ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <nav className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                <tab.icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Profile Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="(555) 555-5555"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Dealership Tab */}
          {activeTab === 'dealership' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Dealership Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dealership Name
                  </label>
                  <input
                    type="text"
                    value={dealershipForm.name}
                    onChange={(e) => setDealershipForm({ ...dealershipForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Street Address
                  </label>
                  <input
                    type="text"
                    value={dealershipForm.address}
                    onChange={(e) => setDealershipForm({ ...dealershipForm, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={dealershipForm.city}
                    onChange={(e) => setDealershipForm({ ...dealershipForm, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={dealershipForm.state}
                      onChange={(e) => setDealershipForm({ ...dealershipForm, state: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                    <input
                      type="text"
                      value={dealershipForm.zip}
                      onChange={(e) => setDealershipForm({ ...dealershipForm, zip: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={dealershipForm.phone}
                    onChange={(e) => setDealershipForm({ ...dealershipForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                  <input
                    type="url"
                    value={dealershipForm.website}
                    onChange={(e) => setDealershipForm({ ...dealershipForm, website: e.target.value })}
                    placeholder="https://"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* FTP Tab */}
          {activeTab === 'ftp' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">FTP/Data Feed Settings</h2>
                <button
                  onClick={() => testFtpMutation.mutate()}
                  disabled={testFtpMutation.isPending}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  {testFtpMutation.isPending ? 'Testing...' : 'Test Connection'}
                </button>
              </div>
              
              {testFtpMutation.isSuccess && (
                <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">
                  ✓ Connection successful!
                </div>
              )}
              {testFtpMutation.isError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  ✗ Connection failed. Please check your credentials.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    FTP Host
                  </label>
                  <input
                    type="text"
                    value={ftpForm.host}
                    onChange={(e) => setFtpForm({ ...ftpForm, host: e.target.value })}
                    placeholder="ftp.example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                  <input
                    type="text"
                    value={ftpForm.port}
                    onChange={(e) => setFtpForm({ ...ftpForm, port: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={ftpForm.username}
                    onChange={(e) => setFtpForm({ ...ftpForm, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={ftpForm.password}
                      onChange={(e) => setFtpForm({ ...ftpForm, password: e.target.value })}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    File Path
                  </label>
                  <input
                    type="text"
                    value={ftpForm.path}
                    onChange={(e) => setFtpForm({ ...ftpForm, path: e.target.value })}
                    placeholder="/inventory/feed.xml"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-medium text-gray-900 mb-4">Auto-Sync Settings</h3>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-gray-700">Enable Auto-Sync</p>
                    <p className="text-sm text-gray-500">Automatically sync inventory on schedule</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ftpForm.autoSync}
                      onChange={(e) => setFtpForm({ ...ftpForm, autoSync: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sync Interval
                  </label>
                  <select
                    value={ftpForm.syncInterval}
                    onChange={(e) => setFtpForm({ ...ftpForm, syncInterval: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="1">Every hour</option>
                    <option value="3">Every 3 hours</option>
                    <option value="6">Every 6 hours</option>
                    <option value="12">Every 12 hours</option>
                    <option value="24">Once per day</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Notification Preferences</h2>
              <div className="space-y-4">
                {[
                  { key: 'emailSyncComplete', label: 'Sync Complete', desc: 'Receive email when inventory sync completes' },
                  { key: 'emailSyncError', label: 'Sync Errors', desc: 'Receive email when sync encounters errors' },
                  { key: 'emailNewLead', label: 'New Leads', desc: 'Receive email when new lead comes in from Facebook' },
                  { key: 'pushNotifications', label: 'Push Notifications', desc: 'Receive browser push notifications' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <p className="font-medium text-gray-700">{item.label}</p>
                      <p className="text-sm text-gray-500">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings[item.key as keyof typeof notificationSettings]}
                        onChange={(e) =>
                          setNotificationSettings({
                            ...notificationSettings,
                            [item.key]: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                      <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Billing Tab */}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Billing & Subscription</h2>
              
              <div className="p-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-80">Current Plan</p>
                    <p className="text-2xl font-bold">Professional</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm opacity-80">Monthly</p>
                    <p className="text-2xl font-bold">$99/mo</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/20">
                  <p className="text-sm opacity-80">Next billing date: February 15, 2026</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Plan Features</h3>
                <ul className="space-y-2">
                  {[
                    'Unlimited vehicle listings',
                    'Up to 10 Facebook groups',
                    'Auto-sync every hour',
                    'Priority support',
                    'Analytics dashboard',
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-3">
                <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Change Plan
                </button>
                <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Update Payment Method
                </button>
                <button className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                  Cancel Subscription
                </button>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Security Settings</h2>
              
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Change Password</h3>
                <div className="grid grid-cols-1 gap-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <button className="w-fit px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Update Password
                  </button>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-medium text-gray-900 mb-4">Two-Factor Authentication</h3>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-700">2FA is disabled</p>
                    <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
                  </div>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Enable 2FA
                  </button>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-medium text-gray-900 mb-4">Active Sessions</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-700">Current Session</p>
                      <p className="text-sm text-gray-500">Windows • Chrome • United States</p>
                    </div>
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                      Active
                    </span>
                  </div>
                </div>
                <button className="mt-4 text-red-600 text-sm hover:underline">
                  Sign out of all other sessions
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
