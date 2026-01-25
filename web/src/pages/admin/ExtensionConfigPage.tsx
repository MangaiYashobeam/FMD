import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import {
  AlertCircle,
  CheckCircle,
  Chrome,
  Key,
  Link2,
  Loader2,
  RefreshCw,
  Settings,
  Shield,
  Activity,
  Eye,
  EyeOff,
  ExternalLink,
  Globe,
  Puzzle,
  Zap,
} from 'lucide-react';

interface ExtensionConfig {
  extensionId: string;
  facebookAppId: string;
  facebookAppSecret: string;
  hasSecret: boolean;
  configured: boolean;
  apiUrl: string;
  sessionRedirectPattern: string;
  chromeWebStoreUrl: string | null;
}

interface ExtensionStatus {
  extensionId: 'configured' | 'not-configured';
  facebookAppId: 'configured' | 'not-configured';
  facebookAppSecret: 'configured' | 'not-configured';
  sessionReady: boolean;
}

interface ExtensionStats {
  totalSessions: number;
  activeSessions: number;
  totalPosts: number;
  recentPosts: number;
}

export default function ExtensionConfigPage() {
  const queryClient = useQueryClient();
  const [showSecret, setShowSecret] = useState(false);
  const [formData, setFormData] = useState({
    extensionId: '',
    facebookAppId: '',
    facebookAppSecret: '',
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch Extension configuration
  const { data: configData, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'extension', 'config'],
    queryFn: async () => {
      const res = await adminApi.getExtensionConfig();
      return res.data.data as {
        config: ExtensionConfig;
        status: ExtensionStatus;
        stats: ExtensionStats;
      };
    },
  });

  // Update Extension config
  const updateConfigMutation = useMutation({
    mutationFn: async (data: { extensionId?: string; facebookAppId?: string; facebookAppSecret?: string }) => {
      const res = await adminApi.updateExtensionConfig(data);
      return res.data;
    },
    onSuccess: () => {
      setSuccessMessage('Extension configuration updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      queryClient.invalidateQueries({ queryKey: ['admin', 'extension'] });
    },
    onError: (error: any) => {
      setErrorMessage(error.response?.data?.error || 'Failed to update configuration');
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  // Test Extension config
  const testConfigMutation = useMutation({
    mutationFn: async () => {
      const res = await adminApi.testExtensionConfig();
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

  // Initialize form with current config
  useEffect(() => {
    if (configData?.config) {
      setFormData({
        extensionId: configData.config.extensionId || '',
        facebookAppId: configData.config.facebookAppId || '',
        facebookAppSecret: configData.config.hasSecret ? '********' : '',
      });
    }
  }, [configData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfigMutation.mutate(formData);
  };

  const config = configData?.config;
  const status = configData?.status;
  const stats = configData?.stats;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

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
            <Puzzle className="h-8 w-8 text-purple-600" />
            Extension Configuration
          </h1>
          <p className="text-gray-500 mt-1">
            Manage Chrome Extension settings and Facebook session integration
          </p>
        </div>
        <Button variant="secondary" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Activity className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats?.totalSessions || 0}</div>
              <p className="text-xs text-gray-500">Total Sessions</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Zap className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{stats?.activeSessions || 0}</div>
              <p className="text-xs text-gray-500">Active (24h)</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Globe className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats?.totalPosts || 0}</div>
              <p className="text-xs text-gray-500">Extension Posts</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Activity className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats?.recentPosts || 0}</div>
              <p className="text-xs text-gray-500">Posts (7 days)</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Chrome className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Extension Credentials</h2>
                <p className="text-sm text-gray-500">Configure your Chrome Extension and Facebook App</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Chrome Extension ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chrome Extension ID
                </label>
                <Input
                  value={formData.extensionId}
                  onChange={(e) => setFormData({ ...formData, extensionId: e.target.value })}
                  placeholder="gaoomjjnpalpcdidnanolccoaacookdm"
                  className="font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Found in <code className="bg-gray-100 px-1 rounded">chrome://extensions</code> when developer mode is enabled
                </p>
              </div>

              {/* Facebook App ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Facebook App ID (Extension)
                </label>
                <Input
                  value={formData.facebookAppId}
                  onChange={(e) => setFormData({ ...formData, facebookAppId: e.target.value })}
                  placeholder="1234567890123456"
                  className="font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Facebook App for extension session validation (can be same as web app)
                </p>
              </div>

              {/* Facebook App Secret */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Facebook App Secret (Extension)
                </label>
                <div className="relative">
                  <Input
                    type={showSecret ? 'text' : 'password'}
                    value={formData.facebookAppSecret}
                    onChange={(e) => setFormData({ ...formData, facebookAppSecret: e.target.value })}
                    placeholder="Leave blank to keep existing"
                    className="font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Leave blank to keep existing secret
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={updateConfigMutation.isPending}
                >
                  {updateConfigMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Settings className="h-4 w-4 mr-2" />
                      Save Configuration
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => testConfigMutation.mutate()}
                  disabled={testConfigMutation.isPending}
                >
                  {testConfigMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Test Connection
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card>

          {/* Setup Instructions */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Setup Instructions</h3>
            <div className="space-y-4 text-sm">
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                <div>
                  <p className="font-medium">Create a Facebook App for Extension</p>
                  <p className="text-gray-500">Go to developers.facebook.com and create a new app for the Chrome Extension</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <div>
                  <p className="font-medium">Configure Extension Permissions</p>
                  <p className="text-gray-500">Ensure the extension has permission to access Facebook cookies for session capture</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <div>
                  <p className="font-medium">Get Chrome Extension ID</p>
                  <p className="text-gray-500">Load unpacked extension or publish to get the Extension ID</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold">4</span>
                <div>
                  <p className="font-medium">Enter credentials above and test connection</p>
                  <p className="text-gray-500">Save the configuration and verify with Test Connection</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Connection Status Sidebar */}
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">Connection Status</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">Current extension integration status</p>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Chrome className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">Extension ID</span>
                </div>
                <Badge variant={status?.extensionId === 'configured' ? 'success' : 'default'}>
                  {status?.extensionId === 'configured' ? (
                    <><CheckCircle className="h-3 w-3 mr-1" /> Configured</>
                  ) : (
                    'Not Configured'
                  )}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">App ID</span>
                </div>
                <Badge variant={status?.facebookAppId === 'configured' ? 'success' : 'default'}>
                  {status?.facebookAppId === 'configured' ? (
                    <><CheckCircle className="h-3 w-3 mr-1" /> Configured</>
                  ) : (
                    'Not Configured'
                  )}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">App Secret</span>
                </div>
                <Badge variant={status?.facebookAppSecret === 'configured' ? 'success' : 'default'}>
                  {status?.facebookAppSecret === 'configured' ? (
                    <><CheckCircle className="h-3 w-3 mr-1" /> Configured</>
                  ) : (
                    'Not Configured'
                  )}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">Session Ready</span>
                </div>
                <Badge variant={status?.sessionReady ? 'success' : 'danger'}>
                  {status?.sessionReady ? (
                    <><CheckCircle className="h-3 w-3 mr-1" /> Ready</>
                  ) : (
                    <><AlertCircle className="h-3 w-3 mr-1" /> Not Ready</>
                  )}
                </Badge>
              </div>
            </div>
          </Card>

          {/* Session Configuration */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Session Configuration</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Chrome Extension Pattern:</p>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded block break-all">
                  {config?.sessionRedirectPattern || 'https://*.chromiumapp.org/*'}
                </code>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">API Base URL:</p>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded block break-all">
                  {config?.apiUrl || 'https://dealersface.com'}
                </code>
              </div>
            </div>
          </Card>

          {/* Web Store Link */}
          {config?.chromeWebStoreUrl && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Chrome Web Store</h3>
              <a
                href={config.chromeWebStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
              >
                <ExternalLink className="h-4 w-4" />
                View Extension in Web Store
              </a>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
