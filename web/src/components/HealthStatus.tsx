import { useEffect, useState } from 'react';
import { Heart, Server, Database, Globe, Wifi, WifiOff, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  responseTime?: number;
  lastCheck?: string;
}

interface HealthStatusProps {
  variant?: 'full' | 'mini' | 'compact';
  className?: string;
}

export function HealthStatus({ variant = 'compact', className }: HealthStatusProps) {
  const [services, setServices] = useState<ServiceHealth[]>([
    { name: 'API', status: 'unknown' },
    { name: 'Database', status: 'unknown' },
    { name: 'WebSocket', status: 'unknown' },
    { name: 'Security', status: 'unknown' },
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [overallStatus, setOverallStatus] = useState<'healthy' | 'degraded' | 'down' | 'unknown'>('unknown');
  const [isAnimating, setIsAnimating] = useState(false);

  const checkHealth = async () => {
    setIsAnimating(true);
    try {
      const response = await api.get<{ 
        success: boolean; 
        data: {
          status: string;
          services: {
            api: { status: string; responseTime?: number };
            database: { status: string; responseTime?: number };
            websocket: { status: string };
            security: { status: string };
          };
        }
      }>('/api/health');
      
      if (response.data.success && response.data.data) {
        const { services: svc } = response.data.data;
        const newServices: ServiceHealth[] = [
          { 
            name: 'API', 
            status: svc.api?.status === 'ok' ? 'healthy' : svc.api?.status === 'degraded' ? 'degraded' : 'down',
            responseTime: svc.api?.responseTime,
            lastCheck: new Date().toISOString(),
          },
          { 
            name: 'Database', 
            status: svc.database?.status === 'ok' ? 'healthy' : svc.database?.status === 'degraded' ? 'degraded' : 'down',
            responseTime: svc.database?.responseTime,
            lastCheck: new Date().toISOString(),
          },
          { 
            name: 'WebSocket', 
            status: svc.websocket?.status === 'ok' ? 'healthy' : 'down',
            lastCheck: new Date().toISOString(),
          },
          { 
            name: 'Security', 
            status: svc.security?.status === 'ok' ? 'healthy' : svc.security?.status === 'degraded' ? 'degraded' : 'down',
            lastCheck: new Date().toISOString(),
          },
        ];
        setServices(newServices);

        // Calculate overall status
        const healthyCounts = newServices.filter(s => s.status === 'healthy').length;
        const downCounts = newServices.filter(s => s.status === 'down').length;
        
        if (downCounts > 0) {
          setOverallStatus('down');
        } else if (healthyCounts === newServices.length) {
          setOverallStatus('healthy');
        } else {
          setOverallStatus('degraded');
        }
      }
    } catch (error) {
      console.error('Health check error:', error);
      setOverallStatus('down');
      setServices(prev => prev.map(s => ({ ...s, status: 'down' as const })));
    } finally {
      setIsLoading(false);
      setTimeout(() => setIsAnimating(false), 500);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-500';
      case 'degraded':
        return 'text-amber-500';
      case 'down':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-amber-500';
      case 'down':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getServiceIcon = (name: string) => {
    switch (name) {
      case 'API':
        return Server;
      case 'Database':
        return Database;
      case 'WebSocket':
        return Wifi;
      case 'Security':
        return Globe;
      default:
        return Server;
    }
  };

  if (isLoading && variant === 'mini') {
    return (
      <div className={cn('flex items-center', className)}>
        <Heart className="w-4 h-4 text-gray-400 animate-pulse" />
      </div>
    );
  }

  // Mini variant - just a heartbeat icon
  if (variant === 'mini') {
    return (
      <div className={cn('flex items-center gap-1.5', className)} title={`System: ${overallStatus}`}>
        <Heart 
          className={cn(
            'w-4 h-4 transition-all',
            getStatusColor(overallStatus),
            isAnimating && 'animate-pulse scale-110',
            overallStatus === 'healthy' && 'fill-current'
          )} 
        />
      </div>
    );
  }

  // Compact variant - heartbeat with status text
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="relative">
          <Heart 
            className={cn(
              'w-4 h-4 transition-all',
              getStatusColor(overallStatus),
              isAnimating && 'animate-pulse scale-110',
              overallStatus === 'healthy' && 'fill-current'
            )} 
          />
          {overallStatus === 'down' && (
            <AlertTriangle className="absolute -top-1 -right-1 w-2.5 h-2.5 text-red-500" />
          )}
        </div>
        <div className="flex items-center gap-1">
          {services.map((service) => (
            <div
              key={service.name}
              title={`${service.name}: ${service.status}${service.responseTime ? ` (${service.responseTime}ms)` : ''}`}
              className={cn(
                'w-1.5 h-1.5 rounded-full transition-colors',
                getStatusBg(service.status)
              )}
            />
          ))}
        </div>
        <span className={cn('text-xs capitalize', getStatusColor(overallStatus))}>
          {overallStatus}
        </span>
      </div>
    );
  }

  // Full variant - detailed list
  return (
    <div className={cn('rounded-lg border bg-white p-4', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Heart 
            className={cn(
              'w-5 h-5 transition-all',
              getStatusColor(overallStatus),
              isAnimating && 'animate-pulse',
              overallStatus === 'healthy' && 'fill-current'
            )} 
          />
          <h3 className="font-medium text-gray-900">System Health</h3>
        </div>
        <span className={cn(
          'px-2 py-0.5 text-xs font-medium rounded-full capitalize',
          overallStatus === 'healthy' && 'bg-green-100 text-green-700',
          overallStatus === 'degraded' && 'bg-amber-100 text-amber-700',
          overallStatus === 'down' && 'bg-red-100 text-red-700',
          overallStatus === 'unknown' && 'bg-gray-100 text-gray-700'
        )}>
          {overallStatus}
        </span>
      </div>

      <div className="space-y-3">
        {services.map((service) => {
          const Icon = getServiceIcon(service.name);
          return (
            <div key={service.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className={cn('w-4 h-4', getStatusColor(service.status))} />
                <span className="text-sm text-gray-700">{service.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {service.responseTime && (
                  <span className="text-xs text-gray-400">{service.responseTime}ms</span>
                )}
                {service.status === 'healthy' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : service.status === 'degraded' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                ) : service.status === 'down' ? (
                  <WifiOff className="w-4 h-4 text-red-500" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-gray-200 animate-pulse" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={checkHealth}
        disabled={isAnimating}
        className="mt-4 w-full py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"
      >
        {isAnimating ? 'Checking...' : 'Refresh'}
      </button>
    </div>
  );
}
