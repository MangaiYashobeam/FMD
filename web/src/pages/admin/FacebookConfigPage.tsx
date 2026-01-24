import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Table, type Column } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Facebook,
  Key,
  Link2,
  Loader2,
  RefreshCw,
  Settings,
  Shield,
  Trash2,
  Users,
  XCircle,
  Activity,
  Eye,
  EyeOff,
  Cookie,
  Upload,
  Calendar,
  Database,
  Lock,
  Unlock,
  Info,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// Session status interface
interface SessionStatus {
  accountId: string;
  hasSession: boolean;
  checkedAt: string;
  savedAt?: string;
  ageDays?: number;
  expiresAt?: string;
  cookieCount?: number;
  hasRequiredCookies?: boolean;
  facebookUserId?: string;
  cookieDetails?: Array<{
    name: string;
    domain: string;
    expires?: number;
    expires_at?: string;
    is_expired?: boolean;
    httpOnly: boolean;
    secure: boolean;
  }>;
}

interface FacebookConfig {
  appId: string;
  appSecret: string;
  hasSecret: boolean;
  configured: boolean;
  oauthRedirectUri: string;
  extensionRedirectPattern: string;
}

interface FacebookStats {
  totalProfiles: number;
  activeProfiles: number;
  totalPosts: number;
  recentPosts: number;
  expiringTokens: number;
  accountsWithFacebook: number;
}

interface FacebookProfile {
  id: string;
  pageName: string;
  pageId: string;
  facebookUserId: string;
  facebookUserName: string | null;
  category: string;
  isActive: boolean;
  tokenExpiresAt: string | null;
  tokenExpiring: boolean;
  lastSyncAt: string | null;
  postCount: number;
  account: { id: string; name: string };
  user: { id: string; email: string; firstName: string | null; lastName: string | null };
  createdAt: string;
}

interface ConnectedAccount {
  id: string;
  name: string;
  profiles: {
    id: string;
    pageName: string;
    facebookUserId: string;
    isActive: boolean;
    tokenExpiring: boolean;
    lastSync: string | null;
  }[];
}

type TabType = 'config' | 'connections' | 'profiles' | 'sessions';

export default function FacebookConfigPage() {
  const queryClient = useQueryClient();
  const [showSecret, setShowSecret] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('config');
  const [formData, setFormData] = useState({
    appId: '',
    appSecret: '',
  });
  const [profileFilter, setProfileFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [revokeModal, setRevokeModal] = useState<{ open: boolean; profile: FacebookProfile | null }>({
    open: false,
    profile: null,
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Session import state
  const [sessionAccountId, setSessionAccountId] = useState('');
  const [sessionCookiesJson, setSessionCookiesJson] = useState('');
  const [sessionImporting, setSessionImporting] = useState(false);
  const [lastImportResult, setLastImportResult] = useState<{success: boolean; message: string; timestamp: Date} | null>(null);

  // Fetch Facebook configuration
  const { data: configData, isLoading: configLoading, refetch: refetchConfig } = useQuery({
    queryKey: ['admin', 'facebook', 'config'],
    queryFn: async () => {
      const res = await adminApi.getFacebookConfig();
      return res.data.data as {
        config: FacebookConfig;
        stats: FacebookStats;
        accounts: ConnectedAccount[];
      };
    },
  });

  // Fetch session status for selected account
  const { data: sessionStatus, isLoading: sessionStatusLoading, refetch: refetchSessionStatus } = useQuery({
    queryKey: ['admin', 'facebook', 'session', sessionAccountId],
    queryFn: async () => {
      if (!sessionAccountId) return null;
      const res = await adminApi.getFacebookSessionStatus(sessionAccountId);
      return res.data.data as SessionStatus;
    },
    enabled: !!sessionAccountId && activeTab === 'sessions',
    refetchInterval: false, // Don't auto-refetch to prevent notification clearing
  });

  // Fetch all Facebook profiles
  const { data: profilesData, isLoading: profilesLoading } = useQuery({
    queryKey: ['admin', 'facebook', 'profiles', profileFilter, searchTerm],
    queryFn: async () => {
      const params: { status?: string; search?: string } = {};
      if (profileFilter !== 'all') params.status = profileFilter;
      if (searchTerm) params.search = searchTerm;
      const res = await adminApi.getFacebookProfiles(params);
      return res.data.data as {
        profiles: FacebookProfile[];
        pagination: { total: number; limit: number; offset: number; hasMore: boolean };
      };
    },
  });

  // Update Facebook config
  const updateConfigMutation = useMutation({
    mutationFn: async (data: { appId: string; appSecret: string }) => {
      const res = await adminApi.updateFacebookConfig(data);
      return res.data;
    },
    onSuccess: () => {
      setSuccessMessage('Facebook configuration updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      queryClient.invalidateQueries({ queryKey: ['admin', 'facebook'] });
    },
    onError: (error: any) => {
      setErrorMessage(error.response?.data?.error || 'Failed to update configuration');
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  // Test Facebook config
  const testConfigMutation = useMutation({
    mutationFn: async () => {
      const res = await adminApi.testFacebookConfig();
      return res.data;
    },
    onSuccess: (data) => {
      setSuccessMessage(data.message || 'Configuration is valid!');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (error: any) => {
      setErrorMessage(error.response?.data?.error || 'Configuration test failed');
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  // Revoke Facebook profile
  const revokeProfileMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const res = await adminApi.revokeFacebookProfile(profileId);
      return res.data;
    },
    onSuccess: (data) => {
      setSuccessMessage(data.message || 'Profile revoked');
      setTimeout(() => setSuccessMessage(null), 3000);
      setRevokeModal({ open: false, profile: null });
      queryClient.invalidateQueries({ queryKey: ['admin', 'facebook'] });
    },
    onError: (error: any) => {
      setErrorMessage(error.response?.data?.error || 'Failed to revoke profile');
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  // Initialize form with current config
  useEffect(() => {
    if (configData?.config) {
      setFormData({
        appId: configData.config.appId || '',
        appSecret: configData.config.hasSecret ? '********' : '',
      });
    }
  }, [configData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfigMutation.mutate(formData);
  };

  const stats = configData?.stats;
  const config = configData?.config;

  // Profile table columns
  const profileColumns: Column<FacebookProfile>[] = [
    {
      key: 'pageName',
      header: 'Profile',
      render: (profile) => (
        <div className="flex items-center gap-2">
          <Facebook className="h-4 w-4 text-blue-600" />
          <div>
            <div className="font-medium">{profile.pageName}</div>
            <div className="text-xs text-gray-500">{profile.category}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'account',
      header: 'Account',
      render: (profile) => profile.account.name,
    },
    {
      key: 'user',
      header: 'User',
      render: (profile) => (
        <div className="text-sm">
          <div>{profile.user.firstName} {profile.user.lastName}</div>
          <div className="text-xs text-gray-500">{profile.user.email}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (profile) => (
        profile.tokenExpiring ? (
          <Badge variant="danger">
            <AlertCircle className="h-3 w-3 mr-1" />
            Expiring
          </Badge>
        ) : profile.isActive ? (
          <Badge variant="success">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        ) : (
          <Badge variant="default">Inactive</Badge>
        )
      ),
    },
    {
      key: 'postCount',
      header: 'Posts',
      render: (profile) => <span>{profile.postCount}</span>,
    },
    {
      key: 'lastSyncAt',
      header: 'Last Sync',
      render: (profile) => (
        <span>
          {profile.lastSyncAt
            ? new Date(profile.lastSyncAt).toLocaleDateString()
            : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (profile) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setRevokeModal({ open: true, profile });
          }}
          disabled={!profile.isActive}
          className="text-red-600 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed p-1"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Notifications */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {errorMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Facebook className="h-8 w-8 text-blue-600" />
            Facebook Configuration
          </h1>
          <p className="text-gray-500 mt-1">
            Manage global Facebook integration settings for all dealerships
          </p>
        </div>
        <Button variant="secondary" onClick={() => refetchConfig()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats?.totalProfiles || 0}</div>
          <p className="text-xs text-gray-500">Total Profiles</p>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-600">{stats?.activeProfiles || 0}</div>
          <p className="text-xs text-gray-500">Active Profiles</p>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats?.accountsWithFacebook || 0}</div>
          <p className="text-xs text-gray-500">Connected Accounts</p>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats?.totalPosts || 0}</div>
          <p className="text-xs text-gray-500">Total Posts</p>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats?.recentPosts || 0}</div>
          <p className="text-xs text-gray-500">Posts (7 days)</p>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-amber-600">{stats?.expiringTokens || 0}</div>
          <p className="text-xs text-gray-500">Expiring Tokens</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4">
          {[
            { id: 'config', label: 'App Configuration', icon: Settings },
            { id: 'connections', label: 'Connected Accounts', icon: Link2 },
            { id: 'profiles', label: 'All Profiles', icon: Users },
            { id: 'sessions', label: 'Worker Sessions', icon: Cookie },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Configuration Tab */}
      {activeTab === 'config' && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Facebook App Settings */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Key className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Facebook App Credentials</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Configure your Facebook App ID and Secret from the Facebook Developer Console
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">App ID</label>
                <Input
                  placeholder="Enter Facebook App ID"
                  value={formData.appId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    setFormData({ ...formData, appId: e.target.value })
                  }
                />
                <p className="text-xs text-gray-500">
                  Found in your Facebook App Dashboard → Settings → Basic
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">App Secret</label>
                <div className="relative">
                  <Input
                    type={showSecret ? 'text' : 'password'}
                    placeholder={config?.hasSecret ? '••••••••' : 'Enter Facebook App Secret'}
                    value={formData.appSecret}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                      setFormData({ ...formData, appSecret: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Leave blank to keep existing secret
                </p>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={updateConfigMutation.isPending}>
                  {updateConfigMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Save Configuration
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => testConfigMutation.mutate()}
                  disabled={testConfigMutation.isPending || !config?.configured}
                >
                  {testConfigMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Test Connection
                </Button>
              </div>
            </form>
          </Card>

          {/* Connection Status */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Connection Status</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Current Facebook integration status
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-gray-500" />
                  <span>App ID</span>
                </div>
                {config?.appId ? (
                  <Badge variant="success">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Configured
                  </Badge>
                ) : (
                  <Badge variant="danger">
                    <XCircle className="h-3 w-3 mr-1" />
                    Not Set
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-gray-500" />
                  <span>App Secret</span>
                </div>
                {config?.hasSecret ? (
                  <Badge variant="success">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Configured
                  </Badge>
                ) : (
                  <Badge variant="danger">
                    <XCircle className="h-3 w-3 mr-1" />
                    Not Set
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Facebook className="h-4 w-4 text-gray-500" />
                  <span>OAuth Ready</span>
                </div>
                {config?.configured && config?.hasSecret ? (
                  <Badge variant="success">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Ready
                  </Badge>
                ) : (
                  <Badge variant="warning">
                    <Clock className="h-3 w-3 mr-1" />
                    Incomplete
                  </Badge>
                )}
              </div>
            </div>

            <div className="pt-4 mt-4 border-t space-y-2">
              <p className="text-sm font-medium">OAuth Redirect URIs</p>
              <div className="space-y-1">
                <p className="text-xs text-gray-500">Web App:</p>
                <code className="text-xs bg-gray-100 p-1 rounded block overflow-x-auto">
                  {config?.oauthRedirectUri || 'Not configured'}
                </code>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500">Chrome Extension:</p>
                <code className="text-xs bg-gray-100 p-1 rounded block overflow-x-auto">
                  {config?.extensionRedirectPattern || 'https://*.chromiumapp.org/*'}
                </code>
              </div>
            </div>
          </Card>

          {/* Setup Instructions */}
          <Card className="p-6 md:col-span-2">
            <h3 className="font-semibold mb-4">Setup Instructions</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
              <li>Go to <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Facebook Developer Console</a></li>
              <li>Create or select your app</li>
              <li>Go to Settings → Basic</li>
              <li>Copy the <strong>App ID</strong> and <strong>App Secret</strong></li>
              <li>Add the OAuth redirect URIs shown above to your app's Valid OAuth Redirect URIs</li>
              <li>For Chrome Extension, add <code className="bg-gray-100 px-1 rounded">https://&lt;extension-id&gt;.chromiumapp.org/</code> to Valid OAuth Redirect URIs</li>
              <li>Ensure your app has <strong>Facebook Login</strong> product added</li>
            </ol>
          </Card>
        </div>
      )}

      {/* Connected Accounts Tab */}
      {activeTab === 'connections' && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-2">Accounts with Facebook Connected</h2>
          <p className="text-sm text-gray-500 mb-4">
            Overview of dealerships with active Facebook integrations
          </p>
          {configLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : configData?.accounts?.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No accounts have connected Facebook yet
            </div>
          ) : (
            <div className="space-y-4">
              {configData?.accounts?.map((account) => (
                <div key={account.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">{account.name}</h4>
                    <Badge variant="default">
                      {account.profiles.length} profile{account.profiles.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {account.profiles.map((profile) => (
                      <div
                        key={profile.id}
                        className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded"
                      >
                        <div className="flex items-center gap-2">
                          <Facebook className="h-4 w-4 text-blue-600" />
                          <span>{profile.pageName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {profile.tokenExpiring ? (
                            <Badge variant="danger">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Token Expiring
                            </Badge>
                          ) : profile.isActive ? (
                            <Badge variant="success">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="default">Inactive</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* All Profiles Tab */}
      {activeTab === 'profiles' && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">All Facebook Profiles</h2>
              <p className="text-sm text-gray-500">
                Manage Facebook profiles across all accounts
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Search profiles..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="w-64"
              />
              <select
                value={profileFilter}
                onChange={(e) => setProfileFilter(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">All Profiles</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="expiring">Expiring Soon</option>
              </select>
            </div>
          </div>
          
          <Table<FacebookProfile>
            data={profilesData?.profiles || []}
            columns={profileColumns}
            loading={profilesLoading}
            emptyMessage="No Facebook profiles found"
          />
          
          {profilesData?.pagination && (
            <div className="mt-4 text-sm text-gray-500 text-center">
              Showing {profilesData.profiles.length} of {profilesData.pagination.total} profiles
            </div>
          )}
        </Card>
      )}

      {/* Worker Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="space-y-6">
          {/* Import Result Banner - Persistent */}
          {lastImportResult && (
            <div className={cn(
              "px-4 py-3 rounded-lg flex items-center justify-between",
              lastImportResult.success 
                ? "bg-green-50 border border-green-200 text-green-800" 
                : "bg-red-50 border border-red-200 text-red-800"
            )}>
              <div className="flex items-center gap-2">
                {lastImportResult.success ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <AlertCircle className="h-5 w-5" />
                )}
                <span>{lastImportResult.message}</span>
                <span className="text-xs opacity-70">
                  ({new Date(lastImportResult.timestamp).toLocaleTimeString()})
                </span>
              </div>
              <button 
                onClick={() => setLastImportResult(null)}
                className="text-sm hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {/* Import Session Card */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Upload className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold">Import Browser Session</h2>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Import Facebook session cookies from a browser to enable automated posting without manual login.
              </p>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-amber-800 mb-2">How to export cookies:</h4>
                <ol className="text-sm text-amber-700 list-decimal list-inside space-y-1">
                  <li>Login to Facebook in Chrome normally</li>
                  <li>Open Developer Tools (F12) → Application → Cookies</li>
                  <li>Select "https://www.facebook.com"</li>
                  <li>Right-click → Export all cookies as JSON</li>
                  <li>Or use "EditThisCookie" extension to export</li>
                </ol>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!sessionAccountId || !sessionCookiesJson) {
                  setLastImportResult({
                    success: false,
                    message: 'Please select an account and paste cookies JSON',
                    timestamp: new Date()
                  });
                  return;
                }
                
                try {
                  setSessionImporting(true);
                  setLastImportResult(null);
                  
                  // Parse cookies JSON
                  let cookies;
                  try {
                    cookies = JSON.parse(sessionCookiesJson);
                    if (!Array.isArray(cookies)) {
                      throw new Error('Cookies must be an array');
                    }
                    if (cookies.length === 0) {
                      throw new Error('Cookies array is empty');
                    }
                    // Validate cookie structure
                    const hasRequiredCookies = cookies.some((c: any) => 
                      c.name === 'c_user' || c.name === 'xs'
                    );
                    if (!hasRequiredCookies) {
                      console.warn('Warning: Missing critical Facebook cookies (c_user, xs)');
                    }
                  } catch (parseErr: any) {
                    setLastImportResult({
                      success: false,
                      message: `Invalid JSON format: ${parseErr.message}`,
                      timestamp: new Date()
                    });
                    setSessionImporting(false);
                    return;
                  }
                  
                  console.log(`[Session Import] Importing ${cookies.length} cookies for account ${sessionAccountId}`);
                  
                  // Call API to import
                  const response = await adminApi.importFacebookSession({
                    accountId: sessionAccountId,
                    cookies,
                  });
                  
                  console.log('[Session Import] Response:', response.data);
                  
                  if (response.data.success) {
                    setLastImportResult({
                      success: true,
                      message: `Session imported successfully! ${cookies.length} cookies saved for automation.`,
                      timestamp: new Date()
                    });
                    setSessionCookiesJson('');
                    // Refetch session status after import
                    setTimeout(() => refetchSessionStatus(), 500);
                  } else {
                    setLastImportResult({
                      success: false,
                      message: response.data.message || 'Import failed - server returned unsuccessful response',
                      timestamp: new Date()
                    });
                  }
                } catch (err: any) {
                  console.error('[Session Import] Error:', err);
                  const errorMsg = err.response?.data?.message 
                    || err.response?.data?.error 
                    || err.message 
                    || 'Failed to import session';
                  const statusCode = err.response?.status;
                  setLastImportResult({
                    success: false,
                    message: `Import failed${statusCode ? ` (${statusCode})` : ''}: ${errorMsg}`,
                    timestamp: new Date()
                  });
                } finally {
                  setSessionImporting(false);
                }
              }} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Account</label>
                  <select
                    value={sessionAccountId}
                    onChange={(e) => setSessionAccountId(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Select account...</option>
                    {configData?.accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Cookies JSON</label>
                  <textarea
                    value={sessionCookiesJson}
                    onChange={(e) => setSessionCookiesJson(e.target.value)}
                    placeholder='[{"name": "c_user", "value": "...", "domain": ".facebook.com"}, ...]'
                    rows={6}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                    required
                  />
                  <p className="text-xs text-gray-500">
                    Paste the exported cookies JSON array. Required cookies: c_user, xs, datr
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={sessionImporting || !sessionAccountId || !sessionCookiesJson}
                  className="w-full"
                >
                  {sessionImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Import Session Cookies
                </Button>
              </form>
            </Card>

            {/* Session Status Card */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-500" />
                  <h2 className="text-lg font-semibold">Session Status</h2>
                </div>
                {sessionAccountId && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => refetchSessionStatus()}
                    disabled={sessionStatusLoading}
                  >
                    {sessionStatusLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>

              {!sessionAccountId ? (
                <div className="text-center py-8 text-gray-500">
                  <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Select an account to view session status</p>
                </div>
              ) : sessionStatusLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : sessionStatus?.hasSession ? (
                <div className="space-y-4">
                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="font-medium text-green-700">Session Active</span>
                    {sessionStatus.hasRequiredCookies && (
                      <Badge variant="success" className="text-xs">All Required Cookies</Badge>
                    )}
                  </div>

                  {/* Session Details Grid */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-gray-500 text-xs mb-1">Facebook User ID</div>
                      <div className="font-mono font-medium">{sessionStatus.facebookUserId || 'N/A'}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-gray-500 text-xs mb-1">Cookies Stored</div>
                      <div className="font-medium">{sessionStatus.cookieCount || 0} cookies</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-gray-500 text-xs mb-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Imported
                      </div>
                      <div className="font-medium">
                        {sessionStatus.savedAt 
                          ? new Date(sessionStatus.savedAt).toLocaleDateString() 
                          : 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {sessionStatus.ageDays !== undefined && `${sessionStatus.ageDays} days ago`}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-gray-500 text-xs mb-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Expires
                      </div>
                      <div className="font-medium">
                        {sessionStatus.expiresAt 
                          ? new Date(sessionStatus.expiresAt).toLocaleDateString() 
                          : 'Unknown'}
                      </div>
                    </div>
                  </div>

                  {/* Cookie Details (Super Admin) */}
                  {sessionStatus.cookieDetails && sessionStatus.cookieDetails.length > 0 && (
                    <div className="border-t pt-4 mt-4">
                      <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                        <Info className="h-4 w-4" /> Cookie Details (Admin Only)
                      </h4>
                      <div className="max-h-48 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-2 py-1 text-left">Cookie</th>
                              <th className="px-2 py-1 text-left">Domain</th>
                              <th className="px-2 py-1 text-left">Expires</th>
                              <th className="px-2 py-1 text-center">Secure</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sessionStatus.cookieDetails.map((cookie, idx) => (
                              <tr key={idx} className={cn(
                                "border-b border-gray-100",
                                cookie.is_expired && "bg-red-50"
                              )}>
                                <td className="px-2 py-1 font-mono">
                                  {cookie.name}
                                  {cookie.name === 'c_user' && <Badge className="ml-1 text-xs" variant="default">ID</Badge>}
                                  {cookie.name === 'xs' && <Badge className="ml-1 text-xs" variant="default">Auth</Badge>}
                                </td>
                                <td className="px-2 py-1 text-gray-500">{cookie.domain}</td>
                                <td className="px-2 py-1">
                                  {cookie.expires_at ? (
                                    <span className={cookie.is_expired ? 'text-red-600' : ''}>
                                      {new Date(cookie.expires_at).toLocaleDateString()}
                                      {cookie.is_expired && ' (Expired!)'}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">Session</span>
                                  )}
                                </td>
                                <td className="px-2 py-1 text-center">
                                  {cookie.secure ? (
                                    <Lock className="h-3 w-3 text-green-600 inline" />
                                  ) : (
                                    <Unlock className="h-3 w-3 text-gray-400 inline" />
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <XCircle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-gray-600 font-medium">No Session Found</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Import cookies to enable automation for this account
                  </p>
                </div>
              )}
            </Card>
          </div>

          {/* Info Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-green-500" />
                <h2 className="text-lg font-semibold">Security Information</h2>
              </div>
              
              <div className="space-y-4 text-sm">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-medium text-purple-800 mb-2">Encryption & Storage:</h4>
                  <ul className="text-purple-700 space-y-1 list-disc list-inside">
                    <li>Cookies are encrypted with AES-256 at rest</li>
                    <li>PBKDF2 key derivation with 100k iterations</li>
                    <li>Sessions expire after 30 days automatically</li>
                    <li>Worker uses stealth browser to avoid detection</li>
                    <li>Sessions are isolated per account</li>
                  </ul>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-5 w-5 text-blue-500" />
                <h2 className="text-lg font-semibold">Required Cookies</h2>
              </div>
              
              <div className="space-y-4 text-sm">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <ul className="text-blue-700 space-y-2">
                    <li className="flex items-center gap-2">
                      <code className="bg-blue-100 px-2 py-0.5 rounded font-mono">c_user</code>
                      <span>Your Facebook user ID</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <code className="bg-blue-100 px-2 py-0.5 rounded font-mono">xs</code>
                      <span>Session authentication token</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <code className="bg-blue-100 px-2 py-0.5 rounded font-mono">datr</code>
                      <span>Browser fingerprint</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <code className="bg-blue-100 px-2 py-0.5 rounded font-mono">fr</code>
                      <span className="text-blue-500">(Optional) Facebook tracking</span>
                    </li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Revoke Modal */}
      <Modal
        isOpen={revokeModal.open}
        onClose={() => setRevokeModal({ open: false, profile: null })}
        title="Revoke Facebook Access?"
      >
        <p className="text-gray-600 mb-4">
          This will deactivate the Facebook profile "{revokeModal.profile?.pageName}" for{' '}
          {revokeModal.profile?.account.name}. The account will need to reconnect
          Facebook to continue posting.
        </p>
        <div className="flex gap-2 justify-end">
          <Button
            variant="secondary"
            onClick={() => setRevokeModal({ open: false, profile: null })}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => revokeModal.profile && revokeProfileMutation.mutate(revokeModal.profile.id)}
            disabled={revokeProfileMutation.isPending}
          >
            {revokeProfileMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Revoke Access
          </Button>
        </div>
      </Modal>
    </div>
  );
}
