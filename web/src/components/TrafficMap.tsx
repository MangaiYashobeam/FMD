import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Popup, CircleMarker, useMap } from 'react-leaflet';
import { Ban, ExternalLink, FileText, X, ArrowRight, ArrowLeft, Clock, Code } from 'lucide-react';

// Fix for default marker icons in webpack/vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface GeoLocation {
  ip: string;
  country: string;
  countryCode: string;
  city: string;
  lat: number;
  lon: number;
  isTrusted: boolean;
  requestCount: number;
  lastSeen: string;
}

interface RequestLogEntry {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  status: number;
  responseTime: number;
  userAgent?: string;
  referer?: string;
  requestSize?: number;
  responseSize?: number;
}

interface TrafficMapProps {
  geoLocations: GeoLocation[];
  onBlockIP: (ip: string) => void;
  selectedIP: string | null;
  onSelectIP: (ip: string | null) => void;
  onViewRequestLogs?: (ip: string) => void;
  requestLogs?: Map<string, RequestLogEntry[]>;
}

// Component to auto-fit bounds ONLY on initial load
function FitBoundsOnce({ locations }: { locations: GeoLocation[] }) {
  const map = useMap();
  const hasFitted = useRef(false);
  
  useEffect(() => {
    // Only fit bounds once when we first get locations
    if (locations.length > 0 && !hasFitted.current) {
      const bounds = L.latLngBounds(
        locations.map(loc => [loc.lat, loc.lon] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 5 });
      hasFitted.current = true;
    }
  }, [locations, map]);
  
  return null;
}

export default function TrafficMap({ geoLocations, onBlockIP, selectedIP, onSelectIP, onViewRequestLogs, requestLogs }: TrafficMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const [showingLogsFor, setShowingLogsFor] = useState<string | null>(null);

  return (
    <div className="relative h-[500px] rounded-xl overflow-hidden border border-gray-200">
      <MapContainer
        center={[30, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={18}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
        scrollWheelZoom={true}
      >
        {/* OpenStreetMap Tiles - FREE, no API key needed */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Alternative: CartoDB Positron (cleaner look) */}
        {/* <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        /> */}

        {/* Auto fit bounds only on initial load */}
        {geoLocations.length > 0 && <FitBoundsOnce locations={geoLocations} />}

        {/* Traffic markers */}
        {geoLocations.map((loc) => (
          <CircleMarker
            key={loc.ip}
            center={[loc.lat, loc.lon]}
            radius={Math.min(8 + Math.log(loc.requestCount + 1) * 3, 20)}
            pathOptions={{
              color: loc.isTrusted ? '#22c55e' : '#3b82f6',
              fillColor: loc.isTrusted ? '#22c55e' : '#3b82f6',
              fillOpacity: 0.6,
              weight: selectedIP === loc.ip ? 3 : 1,
            }}
            eventHandlers={{
              click: () => onSelectIP(selectedIP === loc.ip ? null : loc.ip),
            }}
          >
            <Popup>
              <div className="min-w-[220px] p-1">
                <div className="flex items-center gap-2 mb-2">
                  <div 
                    className={`w-3 h-3 rounded-full ${loc.isTrusted ? 'bg-green-500' : 'bg-blue-500'}`} 
                  />
                  <span className="font-semibold text-gray-900">{loc.city || 'Unknown'}</span>
                </div>
                
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">IP:</span>
                    <span className="font-mono text-gray-900">{loc.ip}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Country:</span>
                    <span className="text-gray-900">{loc.country} ({loc.countryCode})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Requests:</span>
                    <span className="font-semibold text-gray-900">{loc.requestCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status:</span>
                    <span className={`font-medium ${loc.isTrusted ? 'text-green-600' : 'text-blue-600'}`}>
                      {loc.isTrusted ? '✓ Trusted' : 'Regular'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last Active:</span>
                    <span className="text-gray-900">{new Date(loc.lastSeen).toLocaleTimeString()}</span>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-3 pt-2 border-t border-gray-100">
                  <button
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      onBlockIP(loc.ip);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200 transition-colors"
                  >
                    <Ban className="w-3 h-3" />
                    Block
                  </button>
                  <a
                    href={`https://whatismyipaddress.com/ip/${loc.ip}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3" />
                    Lookup
                  </a>
                  <button
                    onClick={(e) => { 
                      e.stopPropagation();
                      setShowingLogsFor(loc.ip);
                      if (onViewRequestLogs) {
                        onViewRequestLogs(loc.ip);
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200 transition-colors"
                  >
                    <FileText className="w-3 h-3" />
                    Logs
                  </button>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Legend Overlay */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm p-3 rounded-lg shadow-lg border border-gray-100 z-[1000]">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Legend</h4>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm text-gray-700">Trusted Source</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-sm text-gray-700">Regular Traffic</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">Click markers for details</p>
      </div>

      {/* Stats Overlay */}
      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm p-3 rounded-lg shadow-lg border border-gray-100 z-[1000]">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-xl font-bold text-gray-900">{geoLocations.length}</p>
            <p className="text-xs text-gray-500">Active IPs</p>
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">
              {new Set(geoLocations.map(g => g.countryCode)).size}
            </p>
            <p className="text-xs text-gray-500">Countries</p>
          </div>
        </div>
      </div>

      {/* Request Logs Modal */}
      {showingLogsFor && (
        <div className="absolute inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Request Logs</h3>
                  <p className="text-sm text-gray-500 font-mono">{showingLogsFor}</p>
                </div>
              </div>
              <button
                onClick={() => setShowingLogsFor(null)}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Logs Content */}
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {requestLogs?.get(showingLogsFor)?.length ? (
                <div className="space-y-3">
                  {requestLogs.get(showingLogsFor)!.map((log, idx) => (
                    <div 
                      key={log.id || idx}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-xs font-mono rounded ${
                            log.method === 'GET' ? 'bg-green-100 text-green-700' :
                            log.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                            log.method === 'PUT' ? 'bg-amber-100 text-amber-700' :
                            log.method === 'DELETE' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {log.method}
                          </span>
                          <span className="font-mono text-sm text-gray-800 truncate max-w-[300px]">
                            {log.path}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                          log.status >= 200 && log.status < 300 ? 'bg-green-100 text-green-700' :
                          log.status >= 300 && log.status < 400 ? 'bg-blue-100 text-blue-700' :
                          log.status >= 400 && log.status < 500 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {log.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Code className="w-3 h-3" />
                          <span>{log.responseTime}ms</span>
                        </div>
                        {log.requestSize && (
                          <div className="flex items-center gap-1">
                            <ArrowRight className="w-3 h-3" />
                            <span>{(log.requestSize / 1024).toFixed(1)}KB req</span>
                          </div>
                        )}
                        {log.responseSize && (
                          <div className="flex items-center gap-1">
                            <ArrowLeft className="w-3 h-3" />
                            <span>{(log.responseSize / 1024).toFixed(1)}KB res</span>
                          </div>
                        )}
                      </div>
                      
                      {log.userAgent && (
                        <p className="mt-2 text-xs text-gray-400 truncate">
                          UA: {log.userAgent}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No request logs available for this IP</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Logs are collected in real-time during active monitoring
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
