import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountsApi, authApi, api } from '../lib/api';
import { sanitizeString } from '../lib/sanitize';
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
  Plus,
  Trash2,
  Copy,
  AlertTriangle,
  AlertCircle,
  X,
  Shield,
  Clock,
  RefreshCw,
  Upload,
  FileSpreadsheet,
  CloudUpload,
  FileText,
  Info,
  Send,
  Users,
  Globe,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

type SettingsTab = 'profile' | 'dealership' | 'ftp' | 'notifications' | 'billing' | 'security' | 'apikeys' | 'adf';

// API Key types
interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
  isActive: boolean;
}

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [showPassword, setShowPassword] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // API Keys state
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(['read:vehicles']);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Form states
  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
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

  // File upload state
  const [dataFeedMethod, setDataFeedMethod] = useState<'ftp' | 'upload'>('ftp');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadSettings, setUploadSettings] = useState({
    skipHeader: true,
    updateExisting: true,
    markMissingSold: false,
    delimiter: 'comma',
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
      const sanitizedHost = sanitizeString(ftpForm.host, { maxLength: 255 });
      const sanitizedUsername = sanitizeString(ftpForm.username, { maxLength: 255 });
      const sanitizedPath = sanitizeString(ftpForm.path, { maxLength: 500 });
      
      return accountsApi.testFtp({
        host: sanitizedHost,
        port: parseInt(ftpForm.port, 10) || 21,
        username: sanitizedUsername,
        password: ftpForm.password, // Don't sanitize passwords
        path: sanitizedPath,
      });
    },
    onError: (error: any) => {
      console.error('FTP test failed:', error?.response?.data || error.message);
      // Don't let 401 errors cause logout for this mutation
    },
  });

  // File upload mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const accountId = user?.accounts?.[0]?.id;
      if (!accountId) {
        throw new Error('No account found. Please contact support.');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('accountId', accountId);
      formData.append('skipHeader', String(uploadSettings.skipHeader));
      formData.append('updateExisting', String(uploadSettings.updateExisting));
      formData.append('markMissingSold', String(uploadSettings.markMissingSold));
      formData.append('delimiter', uploadSettings.delimiter);

      return api.post('/api/sync/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(progress);
        },
      });
    },
    onMutate: () => {
      setUploadStatus('uploading');
      setUploadProgress(0);
      setUploadError(null);
    },
    onSuccess: () => {
      setUploadStatus('success');
      setUploadProgress(100);
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      // Reset after success
      setTimeout(() => {
        setUploadFile(null);
        setUploadStatus('idle');
        setUploadProgress(0);
      }, 3000);
    },
    onError: (error: any) => {
      setUploadStatus('error');
      setUploadError(error?.response?.data?.message || 'Failed to upload file. Please try again.');
    },
  });

  // Handle file selection
  const handleFileSelect = (file: File) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/xml',
      'application/xml',
    ];
    const allowedExtensions = ['.csv', '.xlsx', '.xls', '.xml'];
    const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExt)) {
      setUploadError('Please upload a CSV, Excel, or XML file');
      return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      setUploadError('File size must be less than 50MB');
      return;
    }

    setUploadFile(file);
    setUploadError(null);
    setUploadStatus('idle');
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  // State for error messages
  const [saveError, setSaveError] = useState<string | null>(null);

  // Initialize profile form from user data
  useEffect(() => {
    if (user) {
      setProfileForm({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
      });
    }
  }, [user]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: () => authApi.updateProfile({
      firstName: profileForm.firstName,
      lastName: profileForm.lastName,
      email: profileForm.email,
      phone: profileForm.phone,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      if (refreshUser) refreshUser();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (error: any) => {
      setSaveError(error?.response?.data?.error || 'Failed to update profile');
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: () => authApi.changePassword(passwordForm.currentPassword, passwordForm.newPassword),
    onSuccess: () => {
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordError(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (error: any) => {
      setPasswordError(error?.response?.data?.error || 'Failed to change password');
    },
  });

  // Update dealership mutation
  const updateDealershipMutation = useMutation({
    mutationFn: async () => {
      const accountId = user?.accounts?.[0]?.id;
      if (!accountId) throw new Error('No account found');
      return accountsApi.updateDealership(accountId, dealershipForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-settings'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (error: any) => {
      setSaveError(error?.response?.data?.error || 'Failed to update dealership');
    },
  });

  // Update notification settings mutation
  const updateNotificationsMutation = useMutation({
    mutationFn: async () => {
      const accountId = user?.accounts?.[0]?.id;
      if (!accountId) throw new Error('No account found');
      return accountsApi.updateNotificationSettings(accountId, notificationSettings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (error: any) => {
      setSaveError(error?.response?.data?.error || 'Failed to update notification settings');
    },
  });

  // Revoke other sessions mutation
  const revokeSessionsMutation = useMutation({
    mutationFn: () => authApi.revokeOtherSessions(),
    onSuccess: () => {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (error: any) => {
      setSaveError(error?.response?.data?.error || 'Failed to revoke sessions');
    },
  });

  // Save settings - now properly formats data for FTP
  const saveMutation = useMutation({
    mutationFn: async () => {
      const accountId = user?.accounts?.[0]?.id;
      if (!accountId) {
        throw new Error('No account found');
      }
      
      // Build FTP settings object, only including non-empty values
      const ftpSettings: Record<string, any> = {};
      
      if (ftpForm.host.trim()) {
        ftpSettings.ftpHost = sanitizeString(ftpForm.host, { maxLength: 255 });
      }
      if (ftpForm.port) {
        ftpSettings.ftpPort = parseInt(ftpForm.port, 10) || 21;
      }
      if (ftpForm.username.trim()) {
        ftpSettings.ftpUsername = sanitizeString(ftpForm.username, { maxLength: 255 });
      }
      if (ftpForm.password) {
        ftpSettings.ftpPassword = ftpForm.password;
      }
      if (ftpForm.path.trim()) {
        ftpSettings.csvPath = sanitizeString(ftpForm.path, { maxLength: 500 });
      }
      
      // Always include these
      ftpSettings.autoSync = ftpForm.autoSync;
      // Convert hours to minutes (form stores hours, API expects minutes)
      const intervalHours = parseInt(ftpForm.syncInterval, 10) || 1;
      ftpSettings.syncInterval = Math.max(15, intervalHours * 60); // Minimum 15 minutes
      
      return accountsApi.updateSettings(accountId, ftpSettings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-settings'] });
      setSaveSuccess(true);
      setSaveError(null);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (error: any) => {
      console.error('Save settings failed:', error?.response?.data || error.message);
      const message = error?.response?.data?.message || error?.response?.data?.error || 'Failed to save settings. Please try again.';
      setSaveError(message);
      // Don't redirect to login on save errors
    },
  });

  // Handle save based on active tab
  const handleSave = () => {
    setSaveError(null);
    switch (activeTab) {
      case 'profile':
        updateProfileMutation.mutate();
        break;
      case 'dealership':
        updateDealershipMutation.mutate();
        break;
      case 'ftp':
        saveMutation.mutate();
        break;
      case 'notifications':
        updateNotificationsMutation.mutate();
        break;
      default:
        saveMutation.mutate();
    }
  };

  // Handle password change
  const handlePasswordChange = () => {
    setPasswordError(null);
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    changePasswordMutation.mutate();
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'dealership', label: 'Dealership', icon: Building2 },
    { id: 'ftp', label: 'FTP/Data Feed', icon: Server },
    { id: 'adf', label: 'ADF/DMS', icon: Send },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'security', label: 'Security', icon: Key },
    { id: 'apikeys', label: 'API Keys', icon: Shield },
  ];

  // Fetch API Keys
  const { data: apiKeysData, isLoading: apiKeysLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const response = await api.get('/api/api-keys');
      return response.data;
    },
    enabled: activeTab === 'apikeys',
  });

  // Mock API keys for demo
  const mockApiKeys: ApiKey[] = [
    {
      id: '1',
      name: 'Chrome Extension',
      keyPrefix: 'fmd_ext_',
      permissions: ['read:vehicles', 'write:vehicles', 'read:facebook'],
      lastUsedAt: new Date().toISOString(),
      createdAt: new Date(Date.now() - 604800000).toISOString(),
      isActive: true,
    },
    {
      id: '2',
      name: 'Inventory Sync',
      keyPrefix: 'fmd_sync_',
      permissions: ['read:vehicles', 'write:vehicles'],
      lastUsedAt: new Date(Date.now() - 3600000).toISOString(),
      expiresAt: new Date(Date.now() + 2592000000).toISOString(),
      createdAt: new Date(Date.now() - 2592000000).toISOString(),
      isActive: true,
    },
  ];

  const apiKeys: ApiKey[] = apiKeysData?.data?.keys || mockApiKeys;

  // Create API Key mutation
  const createKeyMutation = useMutation({
    mutationFn: async (data: { name: string; permissions: string[] }) => {
      const response = await api.post('/api/api-keys', data);
      return response.data;
    },
    onSuccess: (data) => {
      setGeneratedKey(data.data?.key || 'fmd_demo_key_xxxxxxxxxxxxx');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  // Revoke API Key mutation
  const revokeKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      return api.delete(`/api/api-keys/${keyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  const handleCreateKey = () => {
    const sanitizedName = sanitizeString(newKeyName, { maxLength: 50 });
    if (!sanitizedName) return;
    createKeyMutation.mutate({ name: sanitizedName, permissions: newKeyPermissions });
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const availablePermissions = [
    { value: 'read:vehicles', label: 'Read Vehicles', desc: 'View inventory listings' },
    { value: 'write:vehicles', label: 'Write Vehicles', desc: 'Create and update listings' },
    { value: 'read:facebook', label: 'Read Facebook', desc: 'View Facebook data' },
    { value: 'write:facebook', label: 'Write Facebook', desc: 'Post to Facebook' },
    { value: 'read:leads', label: 'Read Leads', desc: 'View lead information' },
    { value: 'write:leads', label: 'Write Leads', desc: 'Update lead status' },
  ];

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
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

      {/* Error message display */}
      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-red-800">Failed to save settings</h3>
            <p className="text-sm text-red-600 mt-1">{saveError}</p>
          </div>
          <button
            onClick={() => setSaveError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
                    First Name
                  </label>
                  <input
                    type="text"
                    value={profileForm.firstName}
                    onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={profileForm.lastName}
                    onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
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
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Data Feed Settings</h2>
                <p className="text-sm text-gray-500 mt-1">Import your inventory via FTP connection or file upload</p>
              </div>

              {/* Data Feed Method Selector */}
              <div className="flex gap-3 p-1 bg-gray-100 rounded-lg w-fit">
                <button
                  onClick={() => setDataFeedMethod('ftp')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all',
                    dataFeedMethod === 'ftp'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <Server className="w-4 h-4" />
                  FTP Connection
                </button>
                <button
                  onClick={() => setDataFeedMethod('upload')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all',
                    dataFeedMethod === 'upload'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <Upload className="w-4 h-4" />
                  File Upload
                </button>
              </div>

              {/* FTP Connection Section */}
              {dataFeedMethod === 'ftp' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">FTP Server Configuration</h3>
                    <button
                      onClick={() => testFtpMutation.mutate()}
                      disabled={testFtpMutation.isPending}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {testFtpMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      {testFtpMutation.isPending ? 'Testing...' : 'Test Connection'}
                    </button>
                  </div>
                  
                  {testFtpMutation.isSuccess && (
                    <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Connection successful! Your FTP settings are working correctly.
                    </div>
                  )}
                  {testFtpMutation.isError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Connection failed. Please verify your credentials and try again.
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
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                        placeholder="/inventory/feed.csv"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">Path to your inventory feed file on the FTP server</p>
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

              {/* File Upload Section */}
              {dataFeedMethod === 'upload' && (
                <div className="space-y-6">
                  {/* Upload Area */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                      'relative border-2 border-dashed rounded-xl p-8 transition-all',
                      isDragging
                        ? 'border-blue-500 bg-blue-50'
                        : uploadFile
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                    )}
                  >
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls,.xml"
                      onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    
                    <div className="text-center">
                      {uploadFile ? (
                        <>
                          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                            <FileSpreadsheet className="w-8 h-8 text-green-600" />
                          </div>
                          <p className="text-lg font-medium text-gray-900">{uploadFile.name}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setUploadFile(null);
                              setUploadStatus('idle');
                              setUploadError(null);
                            }}
                            className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium"
                          >
                            Remove file
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                            <CloudUpload className="w-8 h-8 text-blue-600" />
                          </div>
                          <p className="text-lg font-medium text-gray-900">
                            {isDragging ? 'Drop your file here' : 'Drag & drop your inventory file'}
                          </p>
                          <p className="text-sm text-gray-500 mt-2">or click to browse</p>
                          <div className="flex items-center justify-center gap-3 mt-4">
                            <span className="px-2 py-1 bg-white rounded text-xs font-medium text-gray-600 border">CSV</span>
                            <span className="px-2 py-1 bg-white rounded text-xs font-medium text-gray-600 border">Excel</span>
                            <span className="px-2 py-1 bg-white rounded text-xs font-medium text-gray-600 border">XML</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-3">Maximum file size: 50MB</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Upload Error */}
                  {uploadError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {uploadError}
                    </div>
                  )}

                  {/* Upload Progress */}
                  {uploadStatus === 'uploading' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-700">Uploading...</span>
                        <span className="text-sm text-blue-600">{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Upload Success */}
                  {uploadStatus === 'success' && (
                    <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-3">
                      <CheckCircle className="w-5 h-5" />
                      <div>
                        <p className="font-medium">Upload successful!</p>
                        <p className="text-sm text-green-600">Your inventory is being processed.</p>
                      </div>
                    </div>
                  )}

                  {/* Import Settings */}
                  <div className="border-t pt-6">
                    <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Import Settings
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            File Delimiter
                          </label>
                          <select
                            value={uploadSettings.delimiter}
                            onChange={(e) => setUploadSettings({ ...uploadSettings, delimiter: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="comma">Comma (,)</option>
                            <option value="semicolon">Semicolon (;)</option>
                            <option value="tab">Tab</option>
                            <option value="pipe">Pipe (|)</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={uploadSettings.skipHeader}
                            onChange={(e) => setUploadSettings({ ...uploadSettings, skipHeader: e.target.checked })}
                            className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div>
                            <p className="font-medium text-gray-700 text-sm">Skip first row (header)</p>
                            <p className="text-xs text-gray-500">Enable if your file has column headers in the first row</p>
                          </div>
                        </label>

                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={uploadSettings.updateExisting}
                            onChange={(e) => setUploadSettings({ ...uploadSettings, updateExisting: e.target.checked })}
                            className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div>
                            <p className="font-medium text-gray-700 text-sm">Update existing vehicles</p>
                            <p className="text-xs text-gray-500">Match by VIN and update existing records with new data</p>
                          </div>
                        </label>

                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={uploadSettings.markMissingSold}
                            onChange={(e) => setUploadSettings({ ...uploadSettings, markMissingSold: e.target.checked })}
                            className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div>
                            <p className="font-medium text-gray-700 text-sm">Mark missing vehicles as sold</p>
                            <p className="text-xs text-gray-500">Vehicles not in the file will be marked as sold</p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Upload Button */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Info className="w-4 h-4" />
                      <span>Supported formats: CSV, Excel (.xlsx, .xls), XML</span>
                    </div>
                    <button
                      onClick={() => uploadFile && uploadFileMutation.mutate(uploadFile)}
                      disabled={!uploadFile || uploadStatus === 'uploading'}
                      className={cn(
                        'inline-flex items-center gap-2 px-6 py-2.5 font-medium rounded-lg transition-all',
                        uploadFile && uploadStatus !== 'uploading'
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      )}
                    >
                      {uploadStatus === 'uploading' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload & Import'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ADF/DMS Configuration Tab */}
          {activeTab === 'adf' && (
            <ADFConfigurationTab />
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
                {passwordError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {passwordError}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <button 
                    onClick={handlePasswordChange}
                    disabled={changePasswordMutation.isPending}
                    className="w-fit px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {changePasswordMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
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
                <button 
                  onClick={() => revokeSessionsMutation.mutate()}
                  disabled={revokeSessionsMutation.isPending}
                  className="mt-4 text-red-600 text-sm hover:underline disabled:opacity-50 flex items-center gap-2"
                >
                  {revokeSessionsMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                  Sign out of all other sessions
                </button>
              </div>
            </div>
          )}

          {/* API Keys Tab */}
          {activeTab === 'apikeys' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
                  <p className="text-sm text-gray-500">Manage API keys for Chrome Extension and integrations</p>
                </div>
                <button
                  onClick={() => setShowNewKeyModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create New Key
                </button>
              </div>

              {/* Warning Banner */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">Keep your API keys secure</p>
                  <p className="text-sm text-amber-700 mt-1">
                    API keys provide full access to your account. Never share them publicly or commit them to version control.
                  </p>
                </div>
              </div>

              {/* API Keys List */}
              {apiKeysLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <Key className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No API Keys</h3>
                  <p className="text-gray-500 mb-4">Create an API key to use the Chrome Extension or other integrations</p>
                  <button
                    onClick={() => setShowNewKeyModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    Create Your First Key
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {apiKeys.map((key) => (
                    <div key={key.id} className="p-4 bg-white border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-gray-900">{key.name}</h3>
                            <span className={cn(
                              'px-2 py-0.5 text-xs font-medium rounded-full',
                              key.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                            )}>
                              {key.isActive ? 'Active' : 'Revoked'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mb-3">
                            <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono text-gray-700">
                              {key.keyPrefix}{'•'.repeat(20)}
                            </code>
                          </div>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {key.permissions.map((perm) => (
                              <span key={perm} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                                {perm}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Created: {formatDate(key.createdAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <RefreshCw className="w-3 h-3" />
                              Last used: {formatDate(key.lastUsedAt)}
                            </span>
                            {key.expiresAt && (
                              <span className="text-amber-600">
                                Expires: {new Date(key.expiresAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
                              revokeKeyMutation.mutate(key.id);
                            }
                          }}
                          disabled={!key.isActive || revokeKeyMutation.isPending}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Revoke Key"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Usage Guide */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-3">How to use API Keys</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p><strong>Chrome Extension:</strong> Enter your API key in the extension settings popup.</p>
                  <p><strong>API Requests:</strong> Include the key in the <code className="px-1 bg-gray-200 rounded">X-API-Key</code> header.</p>
                </div>
                <div className="mt-3 p-3 bg-gray-900 rounded-lg">
                  <code className="text-green-400 text-xs">
                    curl -H "X-API-Key: fmd_your_key_here" \<br />
                    &nbsp;&nbsp;https://fmd-production.up.railway.app/api/vehicles
                  </code>
                </div>
              </div>
            </div>
          )}

          {/* Create Key Modal */}
          {showNewKeyModal && (
            <div className="fixed inset-0 z-50 overflow-y-auto">
              <div className="flex items-center justify-center min-h-screen px-4">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => {
                  if (!generatedKey) {
                    setShowNewKeyModal(false);
                    setNewKeyName('');
                    setNewKeyPermissions(['read:vehicles']);
                  }
                }} />
                <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
                  {generatedKey ? (
                    <>
                      <div className="text-center mb-6">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">API Key Created!</h3>
                        <p className="text-sm text-gray-500 mt-2">
                          Make sure to copy your key now. You won't be able to see it again.
                        </p>
                      </div>
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Your API Key</label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 px-3 py-2 bg-gray-100 rounded-lg font-mono text-sm break-all">
                            {generatedKey}
                          </code>
                          <button
                            onClick={() => handleCopyKey(generatedKey)}
                            className={cn(
                              'p-2 rounded-lg transition-colors',
                              copiedKey ? 'bg-green-100 text-green-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                            )}
                          >
                            {copiedKey ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                          </button>
                        </div>
                        {copiedKey && <p className="text-sm text-green-600 mt-2">Copied to clipboard!</p>}
                      </div>
                      <button
                        onClick={() => {
                          setShowNewKeyModal(false);
                          setGeneratedKey(null);
                          setNewKeyName('');
                          setNewKeyPermissions(['read:vehicles']);
                        }}
                        className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Done
                      </button>
                    </>
                  ) : (
                    <>
                      <h3 className="text-xl font-bold text-gray-900 mb-6">Create New API Key</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Key Name</label>
                          <input
                            type="text"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(sanitizeString(e.target.value, { maxLength: 50 }))}
                            placeholder="e.g., Chrome Extension, Inventory Sync"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                          <div className="space-y-2">
                            {availablePermissions.map((perm) => (
                              <label key={perm.value} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                                <input
                                  type="checkbox"
                                  checked={newKeyPermissions.includes(perm.value)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setNewKeyPermissions([...newKeyPermissions, perm.value]);
                                    } else {
                                      setNewKeyPermissions(newKeyPermissions.filter(p => p !== perm.value));
                                    }
                                  }}
                                  className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <div>
                                  <p className="font-medium text-gray-900">{perm.label}</p>
                                  <p className="text-sm text-gray-500">{perm.desc}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-3 mt-6">
                        <button
                          onClick={() => {
                            setShowNewKeyModal(false);
                            setNewKeyName('');
                            setNewKeyPermissions(['read:vehicles']);
                          }}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleCreateKey}
                          disabled={!newKeyName.trim() || newKeyPermissions.length === 0 || createKeyMutation.isPending}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {createKeyMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                          Create Key
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ADF Configuration Tab Component
function ADFConfigurationTab() {
  const queryClient = useQueryClient();
  const [testingDms, setTestingDms] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // ADF Configuration state
  const [adfConfig, setAdfConfig] = useState({
    enabled: false,
    dmsProvider: '',
    dmsEndpoint: '',
    dmsApiKey: '',
    dmsUsername: '',
    dmsPassword: '',
    emailEnabled: false,
    emailRecipients: '',
    autoAssignEnabled: false,
    autoAssignMethod: 'round_robin',
    includeVehiclePhotos: true,
    includeTradeIn: true,
    defaultPriority: 'MEDIUM',
    aiAssistEnabled: false,
  });
  
  // Fetch ADF configuration
  const { data: configData } = useQuery({
    queryKey: ['adf-config'],
    queryFn: async () => {
      const response = await api.get('/api/leads/config/adf');
      return response.data;
    },
    retry: false,
  });

  // Update local state when config loads
  useState(() => {
    if (configData?.config) {
      setAdfConfig(prev => ({
        ...prev,
        enabled: configData.config.enabled ?? false,
        dmsProvider: configData.config.dmsProvider || '',
        dmsEndpoint: configData.config.dmsEndpoint || '',
        dmsApiKey: configData.config.dmsApiKey || '',
        dmsUsername: configData.config.dmsUsername || '',
        dmsPassword: configData.config.dmsPassword || '',
        emailEnabled: configData.config.emailEnabled ?? false,
        emailRecipients: configData.config.adfEmailRecipients?.join(', ') || '',
        autoAssignEnabled: configData.config.autoAssignEnabled ?? false,
        autoAssignMethod: configData.config.autoAssignMethod || 'round_robin',
        includeVehiclePhotos: configData.config.includeVehiclePhotos ?? true,
        includeTradeIn: configData.config.includeTradeIn ?? true,
        defaultPriority: configData.config.defaultPriority || 'MEDIUM',
        aiAssistEnabled: configData.config.aiAssistEnabled ?? false,
      }));
    }
  });

  // Sales rep mappings
  const { data: mappingsData } = useQuery({
    queryKey: ['sales-rep-mappings'],
    queryFn: async () => {
      const response = await api.get('/api/leads/config/adf');
      return response.data?.mappings || [];
    },
    retry: false,
  });
  
  const [newMapping, setNewMapping] = useState({
    facebookUsername: '',
    dmsRepId: '',
    dmsRepName: '',
  });

  // Save ADF configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (config: typeof adfConfig) => {
      const response = await api.put('/api/leads/config/adf', {
        enabled: config.enabled,
        dmsProvider: config.dmsProvider,
        dmsEndpoint: config.dmsEndpoint,
        dmsApiKey: config.dmsApiKey,
        dmsUsername: config.dmsUsername,
        dmsPassword: config.dmsPassword,
        emailEnabled: config.emailEnabled,
        adfEmailRecipients: config.emailRecipients.split(',').map(e => e.trim()).filter(Boolean),
        autoAssignEnabled: config.autoAssignEnabled,
        autoAssignMethod: config.autoAssignMethod,
        includeVehiclePhotos: config.includeVehiclePhotos,
        includeTradeIn: config.includeTradeIn,
        defaultPriority: config.defaultPriority,
        aiAssistEnabled: config.aiAssistEnabled,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adf-config'] });
    },
  });

  // Test DMS connection mutation
  const testDmsMutation = useMutation({
    mutationFn: async () => {
      setTestingDms(true);
      setTestResult(null);
      const response = await api.post('/api/leads/config/adf/test-dms', {
        endpoint: adfConfig.dmsEndpoint,
        method: 'POST',
        apiKey: adfConfig.dmsApiKey,
        username: adfConfig.dmsUsername,
        password: adfConfig.dmsPassword,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setTestingDms(false);
      setTestResult({ success: data.success, message: data.message || 'Connection successful!' });
    },
    onError: (error: any) => {
      setTestingDms(false);
      setTestResult({ success: false, message: error.response?.data?.message || 'Connection failed' });
    },
  });

  // Create mapping mutation
  const createMappingMutation = useMutation({
    mutationFn: async (mapping: typeof newMapping) => {
      const response = await api.post('/api/leads/config/adf/mappings', mapping);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-rep-mappings'] });
      setNewMapping({ facebookUsername: '', dmsRepId: '', dmsRepName: '' });
    },
  });

  // Delete mapping mutation
  const deleteMappingMutation = useMutation({
    mutationFn: async (mappingId: string) => {
      const response = await api.delete(`/api/leads/config/adf/mappings/${mappingId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-rep-mappings'] });
    },
  });

  const dmsProviders = [
    { value: '', label: 'Select DMS Provider' },
    { value: 'vinsolutions', label: 'VinSolutions' },
    { value: 'dealersocket', label: 'DealerSocket' },
    { value: 'elead', label: 'eLead CRM' },
    { value: 'dealertrack', label: 'DealerTrack' },
    { value: 'cdk', label: 'CDK Global' },
    { value: 'reynolds', label: 'Reynolds & Reynolds' },
    { value: 'automate', label: 'AutoMate' },
    { value: 'custom', label: 'Custom/Other' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">ADF/DMS Integration</h2>
          <p className="text-sm text-gray-500">Configure lead delivery to your DMS using ADF XML standard</p>
        </div>
        <button
          onClick={() => saveConfigMutation.mutate(adfConfig)}
          disabled={saveConfigMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saveConfigMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save ADF Settings
        </button>
      </div>

      {/* Enable ADF Toggle */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Send className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Enable ADF Lead Delivery</h3>
              <p className="text-sm text-gray-600">Automatically send leads to your DMS in ADF XML format</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={adfConfig.enabled}
              onChange={(e) => setAdfConfig({ ...adfConfig, enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
            <div className="absolute left-1 top-1 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-7"></div>
          </label>
        </div>
      </div>

      {/* DMS Configuration */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
          <Globe className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">DMS HTTP POST Configuration</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">DMS Provider</label>
            <select
              value={adfConfig.dmsProvider}
              onChange={(e) => setAdfConfig({ ...adfConfig, dmsProvider: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {dmsProviders.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">DMS Endpoint URL</label>
            <input
              type="url"
              value={adfConfig.dmsEndpoint}
              onChange={(e) => setAdfConfig({ ...adfConfig, dmsEndpoint: e.target.value })}
              placeholder="https://your-dms.com/api/adf"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">API Key (Optional)</label>
            <input
              type="password"
              value={adfConfig.dmsApiKey}
              onChange={(e) => setAdfConfig({ ...adfConfig, dmsApiKey: e.target.value })}
              placeholder="Your DMS API key"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
              <input
                type="text"
                value={adfConfig.dmsUsername}
                onChange={(e) => setAdfConfig({ ...adfConfig, dmsUsername: e.target.value })}
                placeholder="DMS Username"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={adfConfig.dmsPassword}
                onChange={(e) => setAdfConfig({ ...adfConfig, dmsPassword: e.target.value })}
                placeholder="DMS Password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 pt-4">
          <button
            onClick={() => testDmsMutation.mutate()}
            disabled={!adfConfig.dmsEndpoint || testingDms}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {testingDms ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Test Connection
          </button>
          {testResult && (
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg",
              testResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            )}>
              {testResult.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {testResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Email Configuration */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Email ADF Delivery</h3>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={adfConfig.emailEnabled}
              onChange={(e) => setAdfConfig({ ...adfConfig, emailEnabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
          </label>
        </div>

        {adfConfig.emailEnabled && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Recipients (comma-separated)
            </label>
            <textarea
              value={adfConfig.emailRecipients}
              onChange={(e) => setAdfConfig({ ...adfConfig, emailRecipients: e.target.value })}
              placeholder="leads@yourdealership.com, sales@yourdealership.com"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-sm text-gray-500 mt-2">
              ADF XML will be sent as an email attachment to these addresses
            </p>
          </div>
        )}
      </div>

      {/* Auto-Assignment Configuration */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Lead Auto-Assignment</h3>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={adfConfig.autoAssignEnabled}
              onChange={(e) => setAdfConfig({ ...adfConfig, autoAssignEnabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
          </label>
        </div>

        {adfConfig.autoAssignEnabled && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Assignment Method</label>
              <select
                value={adfConfig.autoAssignMethod}
                onChange={(e) => setAdfConfig({ ...adfConfig, autoAssignMethod: e.target.value })}
                className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="round_robin">Round Robin</option>
                <option value="facebook_match">Match by Facebook Username</option>
                <option value="least_assigned">Least Assigned</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Sales Rep Mappings */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
          <Users className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Sales Rep Mappings</h3>
          <span className="text-sm text-gray-500">(Facebook Username → DMS Rep)</span>
        </div>

        {/* Existing Mappings */}
        {mappingsData && mappingsData.length > 0 && (
          <div className="space-y-2">
            {mappingsData.map((mapping: any) => (
              <div key={mapping.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-700">@{mapping.facebookUsername}</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-sm text-gray-600">{mapping.dmsRepName || mapping.dmsRepId}</span>
                </div>
                <button
                  onClick={() => deleteMappingMutation.mutate(mapping.id)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add New Mapping */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
          <div>
            <input
              type="text"
              value={newMapping.facebookUsername}
              onChange={(e) => setNewMapping({ ...newMapping, facebookUsername: e.target.value })}
              placeholder="Facebook Username"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <input
              type="text"
              value={newMapping.dmsRepId}
              onChange={(e) => setNewMapping({ ...newMapping, dmsRepId: e.target.value })}
              placeholder="DMS Rep ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <input
              type="text"
              value={newMapping.dmsRepName}
              onChange={(e) => setNewMapping({ ...newMapping, dmsRepName: e.target.value })}
              placeholder="Rep Name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => createMappingMutation.mutate(newMapping)}
            disabled={!newMapping.facebookUsername || !newMapping.dmsRepId || createMappingMutation.isPending}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {createMappingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Mapping
          </button>
        </div>
      </div>

      {/* Advanced Options */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
          <Key className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Advanced Options</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Default Lead Priority</label>
            <select
              value={adfConfig.defaultPriority}
              onChange={(e) => setAdfConfig({ ...adfConfig, defaultPriority: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>

        <div className="space-y-4 pt-4">
          {[
            { key: 'includeVehiclePhotos', label: 'Include Vehicle Photos', desc: 'Attach vehicle photos in ADF submission' },
            { key: 'includeTradeIn', label: 'Include Trade-In Info', desc: 'Include trade-in details when available' },
            { key: 'aiAssistEnabled', label: 'AI Communication Assistant', desc: 'Enable AI to help draft lead responses' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="font-medium text-gray-700">{item.label}</p>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={(adfConfig as any)[item.key]}
                  onChange={(e) =>
                    setAdfConfig({
                      ...adfConfig,
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

      {/* Info Box */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <div className="flex gap-4">
          <Info className="w-6 h-6 text-amber-600 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-amber-900">About ADF XML Standard</h4>
            <p className="text-sm text-amber-800 mt-1">
              ADF (Auto-lead Data Format) is an industry-standard XML format for transmitting automotive leads between 
              systems. This integration allows seamless delivery of Facebook Marketplace leads to your DMS system.
            </p>
            <p className="text-sm text-amber-800 mt-2">
              <strong>Supported delivery methods:</strong> HTTP POST to DMS endpoint, or Email with XML attachment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
