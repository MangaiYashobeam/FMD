import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Lock, AlertCircle, CheckCircle, Chrome } from 'lucide-react';

interface CredentialsStatus {
  hasCredentials: boolean;
  email?: string;
  lastUpdated?: string;
}

export const FacebookSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { data: status } = useQuery({
    queryKey: ['fbCredentialsStatus'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: CredentialsStatus }>('/users/me/credentials/status');
      return response.data.data;
    },
  });

  const saveCredentialsMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; twoFactorCode?: string }) => {
      return api.post('/users/me/credentials', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fbCredentialsStatus'] });
      setEmail('');
      setPassword('');
      setTwoFactorCode('');
    },
  });

  const deleteCredentialsMutation = useMutation({
    mutationFn: async () => {
      return api.delete('/users/me/credentials');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fbCredentialsStatus'] });
    },
  });

  const handleSave = () => {
    saveCredentialsMutation.mutate({
      email,
      password,
      twoFactorCode: twoFactorCode || undefined,
    });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to remove your Facebook credentials?')) {
      deleteCredentialsMutation.mutate();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Facebook Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Configure your personal Facebook Marketplace credentials</p>
      </div>

      {/* Security Notice */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
        <div className="flex">
          <Lock className="h-5 w-5 text-blue-400" />
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              Your credentials are encrypted with AES-256 encryption and stored securely. They are only used to automate posting to your personal Facebook Marketplace account.
            </p>
          </div>
        </div>
      </div>

      {/* Chrome Extension Notice */}
      <div className="bg-purple-50 border-l-4 border-purple-400 p-4">
        <div className="flex">
          <Chrome className="h-5 w-5 text-purple-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-purple-800">Chrome Extension Required</h3>
            <p className="mt-1 text-sm text-purple-700">
              To post to Facebook Marketplace, you need to install the FaceMyDealer Chrome extension. The extension will use these credentials to automate posting on your behalf.
            </p>
            <a
              href="/chrome-extension/2.5_0"
              className="mt-2 inline-flex items-center text-sm font-medium text-purple-700 hover:text-purple-600"
            >
              Download Chrome Extension →
            </a>
          </div>
        </div>
      </div>

      {/* Current Status */}
      {status?.hasCredentials && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Credentials Configured</h3>
                <p className="text-sm text-gray-500">
                  Email: {status.email} • Last updated: {status.lastUpdated ? new Date(status.lastUpdated).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
            <button
              onClick={handleDelete}
              disabled={deleteCredentialsMutation.isPending}
              className="inline-flex items-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
            >
              Remove Credentials
            </button>
          </div>
        </div>
      )}

      {/* Credentials Form */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          {status?.hasCredentials ? 'Update' : 'Add'} Facebook Credentials
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Facebook Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Facebook Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm text-gray-600 hover:text-gray-900"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              2FA Code (Optional)
            </label>
            <input
              type="text"
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value)}
              placeholder="If you have 2FA enabled"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saveCredentialsMutation.isPending || !email || !password}
            className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saveCredentialsMutation.isPending ? 'Saving...' : 'Save Credentials'}
          </button>

          {saveCredentialsMutation.isSuccess && (
            <div className="rounded-md bg-green-50 p-4">
              <p className="text-sm text-green-800">Credentials saved successfully!</p>
            </div>
          )}

          {saveCredentialsMutation.isError && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">Failed to save credentials. Please try again.</p>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">How It Works</h2>
        
        <ol className="list-decimal list-inside space-y-3 text-sm text-gray-700">
          <li>Save your Facebook credentials using the form above</li>
          <li>Install the FaceMyDealer Chrome extension</li>
          <li>Select a vehicle from the Vehicles page</li>
          <li>Configure your post (description, template, etc.)</li>
          <li>Click "Post to Facebook" - the extension will handle the rest!</li>
        </ol>

        <div className="mt-4 p-4 bg-yellow-50 rounded-md">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Important:</strong> Make sure your Facebook account doesn't have unusual security restrictions and that you're using the latest version of Chrome.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
