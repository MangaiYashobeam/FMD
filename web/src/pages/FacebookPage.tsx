import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facebookApi } from '../lib/api';
import {
  Facebook,
  Link,
  Users,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  ExternalLink,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface FacebookGroup {
  id: string;
  groupId: string;
  name: string;
  url: string;
  memberCount?: number;
  isActive: boolean;
  autoPost: boolean;
  lastPosted?: string;
}

// FacebookAccount interface reserved for future use

function GroupCard({
  group,
  onToggleAutoPost,
  onRemove,
}: {
  group: FacebookGroup;
  onToggleAutoPost: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h4 className="font-medium text-gray-900">{group.name}</h4>
            <p className="text-sm text-gray-500">
              {group.memberCount?.toLocaleString() || '?'} members
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={group.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={onRemove}
            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {group.isActive ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <XCircle className="w-4 h-4 text-red-500" />
          )}
          <span className={cn('text-sm', group.isActive ? 'text-green-700' : 'text-red-700')}>
            {group.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-gray-600">Auto-post</span>
          <div className="relative">
            <input
              type="checkbox"
              checked={group.autoPost}
              onChange={onToggleAutoPost}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
          </div>
        </label>
      </div>

      {group.lastPosted && (
        <p className="mt-3 text-xs text-gray-500">
          Last posted: {new Date(group.lastPosted).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

export default function FacebookPage() {
  const queryClient = useQueryClient();
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [newGroupUrl, setNewGroupUrl] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  // Handle Facebook Connect button
  const handleConnectFacebook = async () => {
    try {
      setIsConnecting(true);
      const response = await facebookApi.getAuthUrl();
      const authUrl = response.data?.data?.url;
      if (authUrl) {
        // Redirect to Facebook OAuth
        window.location.href = authUrl;
      } else {
        console.error('No auth URL received from server');
        alert('Failed to get Facebook authorization URL. Please try again.');
      }
    } catch (error: any) {
      console.error('Failed to connect to Facebook:', error?.response?.data || error.message);
      alert('Failed to connect to Facebook. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  // Fetch connected Facebook accounts/groups
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['facebook-groups'],
    queryFn: async () => {
      const response = await facebookApi.getGroups();
      return response.data;
    },
  });

  // Fetch Facebook connection status
  const { data: connectionData, isLoading: isLoadingConnection } = useQuery({
    queryKey: ['facebook-connections'],
    queryFn: async () => {
      const response = await facebookApi.getConnections();
      return response.data;
    },
  });

  const groups: FacebookGroup[] = data?.data?.groups || [];
  const connections = connectionData?.data?.connections || [];
  const isConnected = connections.length > 0;

  // Add group mutation
  const addGroupMutation = useMutation({
    mutationFn: async (url: string) => {
      // Extract group ID and name from URL (simplified)
      const groupId = url.split('/groups/')[1]?.split('/')[0] || url;
      return facebookApi.addGroup({ groupId, groupName: 'Facebook Group' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facebook-groups'] });
      setShowAddGroupModal(false);
      setNewGroupUrl('');
    },
    onError: (error: any) => {
      console.error('Add group failed:', error?.response?.data || error.message);
    },
  });

  // Remove group mutation
  const removeGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      return facebookApi.removeGroup(groupId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facebook-groups'] });
    },
    onError: (error: any) => {
      console.error('Remove group failed:', error?.response?.data || error.message);
    },
  });

  const handleAddGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (newGroupUrl) {
      addGroupMutation.mutate(newGroupUrl);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facebook Marketplace</h1>
          <p className="text-gray-500">Manage your Facebook groups and posting settings</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowAddGroupModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Group
          </button>
        </div>
      </div>

      {/* Connection status card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            isConnected ? "bg-green-100" : "bg-blue-100"
          )}>
            <Facebook className={cn("w-6 h-6", isConnected ? "text-green-600" : "text-blue-600")} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Facebook Connection</h3>
              {isConnected && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  <CheckCircle className="w-3 h-3" />
                  Connected
                </span>
              )}
            </div>
            {isLoadingConnection ? (
              <p className="text-gray-500">Checking connection status...</p>
            ) : isConnected ? (
              <p className="text-gray-500">
                Connected as <span className="font-medium">{connections[0]?.pageName || connections[0]?.facebookUserName}</span>
                {connections.length > 1 && ` (+${connections.length - 1} more)`}
              </p>
            ) : (
              <p className="text-gray-500">
                Connect your Facebook account to post vehicles to Marketplace groups
              </p>
            )}
          </div>
          <button 
            onClick={handleConnectFacebook}
            disabled={isConnecting}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors disabled:opacity-50",
              isConnected 
                ? "bg-gray-100 hover:bg-gray-200 text-gray-700" 
                : "bg-[#1877F2] hover:bg-[#166FE5] text-white"
            )}
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Link className="w-4 h-4" />
                {isConnected ? 'Reconnect' : 'Connect Facebook'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Groups */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Facebook Groups</h3>
          <span className="text-sm text-gray-500">{groups.length} groups connected</span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
            <p className="mt-2 text-gray-500">Loading groups...</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
            <p className="mt-2 text-gray-500">Failed to load Facebook groups</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto" />
            <h4 className="mt-4 text-lg font-medium text-gray-900">No groups connected</h4>
            <p className="mt-1 text-gray-500">
              Add Facebook Marketplace groups to start posting your vehicles
            </p>
            <button
              onClick={() => setShowAddGroupModal(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Your First Group
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                onToggleAutoPost={() => {
                  // Toggle auto-post
                }}
                onRemove={() => removeGroupMutation.mutate(group.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Posting Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Posting Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="font-medium text-gray-900">Auto-post new vehicles</p>
              <p className="text-sm text-gray-500">
                Automatically post new vehicles to selected groups
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="font-medium text-gray-900">Include price in listing</p>
              <p className="text-sm text-gray-500">Show vehicle price in Facebook posts</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-gray-900">Post scheduling</p>
              <p className="text-sm text-gray-500">Spread posts throughout the day</p>
            </div>
            <select className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option value="immediate">Post immediately</option>
              <option value="hourly">Every hour</option>
              <option value="daily">Once per day</option>
            </select>
          </div>
        </div>
      </div>

      {/* Add Group Modal */}
      {showAddGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Facebook Group</h3>
            <form onSubmit={handleAddGroup}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Group URL
                </label>
                <input
                  type="url"
                  value={newGroupUrl}
                  onChange={(e) => setNewGroupUrl(e.target.value)}
                  placeholder="https://www.facebook.com/groups/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <p className="mt-1 text-sm text-gray-500">
                  Paste the URL of the Facebook Marketplace group you want to post to
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddGroupModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addGroupMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {addGroupMutation.isPending ? 'Adding...' : 'Add Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
