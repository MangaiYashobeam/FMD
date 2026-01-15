import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Save } from 'lucide-react';

interface AccountSettings {
  aiEnabled: boolean;
  aiModel: string;
  aiTemperature: number;
  aiMaxTokens: number;
  autoPostEnabled: boolean;
  autoPostInterval: number;
  ftpHost?: string;
  ftpPort?: number;
  ftpUsername?: string;
  csvPath?: string;
  autoSync: boolean;
  syncInterval: number;
}

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'ai' | 'ftp' | 'general'>('general');

  const { data: settings, isLoading } = useQuery({
    queryKey: ['accountSettings'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: AccountSettings }>('/accounts/settings');
      return response.data.data;
    },
  });

  const [formData, setFormData] = useState<Partial<AccountSettings>>(settings || {});

  React.useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<AccountSettings>) => {
      return api.put('/accounts/settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accountSettings'] });
    },
  });

  const handleSave = () => {
    updateSettingsMutation.mutate(formData);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your account preferences</p>
        </div>
        <button
          onClick={handleSave}
          disabled={updateSettingsMutation.isPending}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4 mr-2" />
          {updateSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('general')}
            className={`${
              activeTab === 'general'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`${
              activeTab === 'ai'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            AI Settings
          </button>
          <button
            onClick={() => setActiveTab('ftp')}
            className={`${
              activeTab === 'ftp'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            FTP Sync
          </button>
        </nav>
      </div>

      {/* General Settings */}
      {activeTab === 'general' && (
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">General Settings</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Auto Posting</label>
                  <p className="text-sm text-gray-500">Automatically post vehicles to Facebook Marketplace</p>
                </div>
                <button
                  onClick={() => setFormData({ ...formData, autoPostEnabled: !formData.autoPostEnabled })}
                  className={`${
                    formData.autoPostEnabled ? 'bg-primary-600' : 'bg-gray-200'
                  } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out`}
                >
                  <span
                    className={`${
                      formData.autoPostEnabled ? 'translate-x-6' : 'translate-x-1'
                    } inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out mt-1`}
                  />
                </button>
              </div>

              {formData.autoPostEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Auto Post Interval (hours)</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={formData.autoPostInterval || 3}
                    onChange={(e) => setFormData({ ...formData, autoPostInterval: parseInt(e.target.value) })}
                    className="mt-1 block w-full sm:w-32 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Settings */}
      {activeTab === 'ai' && (
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">AI-Powered Descriptions</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Enable AI</label>
                  <p className="text-sm text-gray-500">Use AI to enhance vehicle descriptions</p>
                </div>
                <button
                  onClick={() => setFormData({ ...formData, aiEnabled: !formData.aiEnabled })}
                  className={`${
                    formData.aiEnabled ? 'bg-primary-600' : 'bg-gray-200'
                  } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out`}
                >
                  <span
                    className={`${
                      formData.aiEnabled ? 'translate-x-6' : 'translate-x-1'
                    } inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out mt-1`}
                  />
                </button>
              </div>

              {formData.aiEnabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">AI Model</label>
                    <select
                      value={formData.aiModel || 'gpt-3.5-turbo'}
                      onChange={(e) => setFormData({ ...formData, aiModel: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                    >
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      <option value="gpt-4">GPT-4</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Temperature: {formData.aiTemperature || 0.7}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={formData.aiTemperature || 0.7}
                      onChange={(e) => setFormData({ ...formData, aiTemperature: parseFloat(e.target.value) })}
                      className="mt-1 block w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">Lower = More focused, Higher = More creative</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Max Tokens</label>
                    <input
                      type="number"
                      min="100"
                      max="4000"
                      step="100"
                      value={formData.aiMaxTokens || 500}
                      onChange={(e) => setFormData({ ...formData, aiMaxTokens: parseInt(e.target.value) })}
                      className="mt-1 block w-full sm:w-48 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                    />
                    <p className="text-xs text-gray-500 mt-1">Maximum length of generated descriptions</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FTP Settings */}
      {activeTab === 'ftp' && (
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">FTP Sync Configuration</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Auto Sync</label>
                  <p className="text-sm text-gray-500">Automatically sync inventory from FTP server</p>
                </div>
                <button
                  onClick={() => setFormData({ ...formData, autoSync: !formData.autoSync })}
                  className={`${
                    formData.autoSync ? 'bg-primary-600' : 'bg-gray-200'
                  } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out`}
                >
                  <span
                    className={`${
                      formData.autoSync ? 'translate-x-6' : 'translate-x-1'
                    } inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out mt-1`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">FTP Host</label>
                  <input
                    type="text"
                    value={formData.ftpHost || ''}
                    onChange={(e) => setFormData({ ...formData, ftpHost: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                    placeholder="ftp.example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">FTP Port</label>
                  <input
                    type="number"
                    value={formData.ftpPort || 21}
                    onChange={(e) => setFormData({ ...formData, ftpPort: parseInt(e.target.value) })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">FTP Username</label>
                  <input
                    type="text"
                    value={formData.ftpUsername || ''}
                    onChange={(e) => setFormData({ ...formData, ftpUsername: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">CSV File Path</label>
                  <input
                    type="text"
                    value={formData.csvPath || ''}
                    onChange={(e) => setFormData({ ...formData, csvPath: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                    placeholder="/path/to/inventory.csv"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Sync Interval (hours)</label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={formData.syncInterval || 3}
                  onChange={(e) => setFormData({ ...formData, syncInterval: parseInt(e.target.value) })}
                  className="mt-1 block w-full sm:w-32 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {updateSettingsMutation.isSuccess && (
        <div className="rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-800">Settings saved successfully!</p>
        </div>
      )}

      {updateSettingsMutation.isError && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">Failed to save settings. Please try again.</p>
        </div>
      )}
    </div>
  );
};
