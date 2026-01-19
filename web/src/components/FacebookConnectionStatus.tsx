import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Badge } from './ui/Badge';
import {
  Facebook,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface FacebookPublicConfig {
  appId: string | null;
  configured: boolean;
  version: string;
}

interface FacebookConnectionStatusProps {
  variant?: 'compact' | 'detailed' | 'mini';
  className?: string;
  showRefresh?: boolean;
}

export function FacebookConnectionStatus({
  variant = 'compact',
  className,
  showRefresh = false,
}: FacebookConnectionStatusProps) {
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['facebook', 'public-config'],
    queryFn: async () => {
      const res = await api.get('/api/config/facebook');
      return res.data.data as FacebookPublicConfig;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  const getStatus = () => {
    if (isLoading) return 'loading';
    if (error) return 'error';
    if (!data?.configured) return 'unconfigured';
    return 'connected';
  };

  const status = getStatus();

  // Mini variant - just an icon with tooltip-like behavior
  if (variant === 'mini') {
    return (
      <div className={cn('inline-flex items-center', className)}>
        {status === 'loading' && (
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        )}
        {status === 'error' && (
          <span title="Facebook API Error">
            <XCircle className="h-4 w-4 text-red-500" />
          </span>
        )}
        {status === 'unconfigured' && (
          <span title="Facebook Not Configured">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </span>
        )}
        {status === 'connected' && (
          <span title="Facebook Connected">
            <CheckCircle className="h-4 w-4 text-green-500" />
          </span>
        )}
      </div>
    );
  }

  // Compact variant - badge style
  if (variant === 'compact') {
    return (
      <div className={cn('inline-flex items-center gap-2', className)}>
        <div className="flex items-center gap-1.5">
          <Facebook className="h-4 w-4 text-blue-600" />
          {status === 'loading' && (
            <Badge variant="default">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Checking...
            </Badge>
          )}
          {status === 'error' && (
            <Badge variant="danger">
              <XCircle className="h-3 w-3 mr-1" />
              API Error
            </Badge>
          )}
          {status === 'unconfigured' && (
            <Badge variant="warning">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Not Configured
            </Badge>
          )}
          {status === 'connected' && (
            <Badge variant="success">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
        </div>
        {showRefresh && (
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isRefetching && 'animate-spin')} />
          </button>
        )}
      </div>
    );
  }

  // Detailed variant - full card style
  return (
    <div className={cn('bg-white border rounded-lg p-4', className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Facebook className="h-5 w-5 text-blue-600" />
          <span className="font-medium">Facebook Integration</span>
        </div>
        {showRefresh && (
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', isRefetching && 'animate-spin')} />
          </button>
        )}
      </div>

      {status === 'loading' && (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Checking connection...</span>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-red-600">
            <XCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Connection Error</span>
          </div>
          <p className="text-xs text-gray-500">
            Unable to verify Facebook configuration. The API may be unavailable.
          </p>
        </div>
      )}

      {status === 'unconfigured' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Not Configured</span>
          </div>
          <p className="text-xs text-gray-500">
            Facebook App credentials have not been set. Contact a SUPER_ADMIN to configure.
          </p>
        </div>
      )}

      {status === 'connected' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Connected</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-50 rounded p-2">
              <span className="text-gray-500">App ID</span>
              <p className="font-mono truncate" title={data?.appId || ''}>
                {data?.appId ? `${data.appId.slice(0, 8)}...` : 'N/A'}
              </p>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <span className="text-gray-500">API Version</span>
              <p className="font-medium">{data?.version || 'v18.0'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Hook for checking Facebook configuration status
export function useFacebookConfigStatus() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['facebook', 'public-config'],
    queryFn: async () => {
      const res = await api.get('/api/config/facebook');
      return res.data.data as FacebookPublicConfig;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return {
    isConfigured: data?.configured ?? false,
    appId: data?.appId,
    version: data?.version,
    isLoading,
    error,
    refetch,
  };
}

export default FacebookConnectionStatus;
