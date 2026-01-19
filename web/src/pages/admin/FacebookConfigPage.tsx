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
} from 'lucide-react';
import { cn } from '../../lib/utils';

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

type TabType = 'config' | 'connections' | 'profiles';

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
