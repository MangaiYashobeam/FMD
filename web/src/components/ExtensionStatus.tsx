import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Puzzle, Circle } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';

interface ExtensionStatusData {
  accountId: string;
  isOnline: boolean;
  lastPing: string | null;
  userEmail: string | null;
}

interface ExtensionStatusProps {
  variant?: 'full' | 'mini' | 'compact';
  className?: string;
}

export function ExtensionStatus({ variant = 'full', className }: ExtensionStatusProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState<ExtensionStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get primary account ID
  const accountId = user?.accounts?.[0]?.id;

  useEffect(() => {
    if (!accountId) return;

    const checkStatus = async () => {
      try {
        const response = await api.get<{ success: boolean; data: ExtensionStatusData }>(
          `/api/extension/status/${accountId}`
        );
        
        if (response.data.success) {
          setStatus(response.data.data);
          setError(null);
        }
      } catch (err: any) {
        console.error('Extension status check error:', err);
        setError(err.response?.data?.error || 'Failed to check extension status');
        setStatus(null);
      } finally {
        setLoading(false);
      }
    };

    // Check immediately
    checkStatus();

    // Check every 15 seconds
    const interval = setInterval(checkStatus, 15000);

    return () => clearInterval(interval);
  }, [accountId]);

  if (!accountId || loading) return null;

  if (error) {
    console.warn('Extension status error:', error);
    return null; // Fail silently
  }

  const isOnline = status?.isOnline ?? false;
  const lastPingTime = status?.lastPing ? new Date(status.lastPing) : null;

  // Format last ping time
  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Mini variant (small badge)
  if (variant === 'mini') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="relative">
          <Puzzle className="w-5 h-5 text-gray-500" />
          <Circle
            className={cn(
              'absolute -bottom-1 -right-1 w-2.5 h-2.5',
              isOnline ? 'text-green-500 fill-green-500' : 'text-gray-300 fill-gray-300'
            )}
          />
        </div>
      </div>
    );
  }

  // Compact variant (small status with text)
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2 text-xs', className)}>
        <div className="relative">
          <Puzzle className="w-4 h-4 text-gray-400" />
          <Circle
            className={cn(
              'absolute -bottom-0.5 -right-0.5 w-2 h-2',
              isOnline ? 'text-green-500 fill-green-500' : 'text-gray-300 fill-gray-300'
            )}
          />
        </div>
        <span className={cn(isOnline ? 'text-green-600' : 'text-gray-400')}>
          Extension {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>
    );
  }

  // Full variant (detailed card)
  return (
    <div className={cn('rounded-lg border bg-white p-4', className)}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            'rounded-full p-2',
            isOnline ? 'bg-green-100' : 'bg-gray-100'
          )}>
            <Puzzle className={cn(
              'w-5 h-5',
              isOnline ? 'text-green-600' : 'text-gray-400'
            )} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900">Chrome Extension</h3>
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                isOnline
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              )}>
                <Circle className={cn(
                  'w-1.5 h-1.5',
                  isOnline ? 'fill-green-600' : 'fill-gray-400'
                )} />
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            {lastPingTime && (
              <p className="text-sm text-gray-500 mt-1">
                Last ping: {getTimeAgo(lastPingTime)}
              </p>
            )}
          </div>
        </div>
      </div>

      {!isOnline && (
        <div className="mt-3 text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <p className="font-medium text-yellow-800">Extension Not Connected</p>
          <p className="mt-1 text-yellow-700">
            Install the Chrome extension to enable automated posting and lead management.
          </p>
        </div>
      )}
    </div>
  );
}
