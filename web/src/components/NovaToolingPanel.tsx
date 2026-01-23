/**
 * Nova Tooling Panel
 * 
 * Advanced system management panel for Nova AI
 * Includes file browser, code editor, system health, and database tools
 */

import { useState, useCallback, useEffect } from 'react';
import NovaCodeEditor from './NovaCodeEditor';

interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
}

interface SystemHealth {
  timestamp: string;
  overall: 'healthy' | 'degraded' | 'critical';
  components: {
    name: string;
    status: string;
    latency?: number;
    message: string;
    details?: Record<string, any>;
  }[];
  metrics: {
    uptime: number;
    memoryUsage: {
      heapUsed: number;
      heapTotal: number;
      rss: number;
    };
  };
  recommendations: string[];
}

interface SearchResult {
  file: string;
  line: number;
  content: string;
}

type ToolTab = 'files' | 'editor' | 'health' | 'database' | 'search' | 'logs';

export function NovaToolingPanel() {
  const [activeTab, setActiveTab] = useState<ToolTab>('health');
  const [currentPath, setCurrentPath] = useState('src');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dbTable, setDbTable] = useState('users');
  const [dbResults, setDbResults] = useState<any[] | null>(null);
  const [recentErrors, setRecentErrors] = useState<any[]>([]);
  const [containerStatus, setContainerStatus] = useState<any[] | null>(null);

  // Get auth token
  const getAuthToken = () => {
    const stored = localStorage.getItem('auth_data');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.token;
      } catch {
        return null;
      }
    }
    return null;
  };

  // API helper
  const apiCall = useCallback(async (endpoint: string, method: string = 'GET', body?: any) => {
    const token = getAuthToken();
    const response = await fetch(`/api/ai-center${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return response.json();
  }, []);

  // Load directory contents
  const loadDirectory = useCallback(async (path: string) => {
    setIsLoading(true);
    try {
      const result = await apiCall('/nova/directory/list', 'POST', { path });
      if (result.success) {
        setFiles(result.data.entries || []);
        setCurrentPath(path);
      }
    } catch (error) {
      console.error('Failed to load directory:', error);
    } finally {
      setIsLoading(false);
    }
  }, [apiCall]);

  // Load file content
  const loadFile = useCallback(async (filePath: string) => {
    setIsLoading(true);
    try {
      const result = await apiCall('/nova/file/read', 'POST', { path: filePath });
      if (result.success && result.data.content) {
        setFileContent(result.data.content);
        setSelectedFile(filePath);
        setActiveTab('editor');
      }
    } catch (error) {
      console.error('Failed to load file:', error);
    } finally {
      setIsLoading(false);
    }
  }, [apiCall]);

  // Save file content
  const saveFile = useCallback(async (content: string) => {
    if (!selectedFile) return;
    
    try {
      const result = await apiCall('/nova/file/write', 'POST', { path: selectedFile, content });
      if (result.success) {
        alert('File saved successfully!');
      } else {
        alert(`Save failed: ${result.error || result.data?.error}`);
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      alert('Save failed!');
    }
  }, [apiCall, selectedFile]);

  // Load system health
  const loadSystemHealth = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await apiCall('/nova/health');
      if (result.success) {
        setSystemHealth(result.data);
      }
    } catch (error) {
      console.error('Failed to load health:', error);
    } finally {
      setIsLoading(false);
    }
  }, [apiCall]);

  // Search code
  const searchCode = useCallback(async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const result = await apiCall('/nova/code/search', 'POST', { query: searchQuery });
      if (result.success) {
        setSearchResults(result.data.results || []);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, [apiCall, searchQuery]);

  // Query database
  const queryDatabase = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await apiCall('/nova/database/query', 'POST', { table: dbTable, options: { limit: 50 } });
      if (result.success) {
        setDbResults(result.data.data || []);
      }
    } catch (error) {
      console.error('DB query failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [apiCall, dbTable]);

  // Load recent errors
  const loadRecentErrors = useCallback(async () => {
    try {
      const result = await apiCall('/nova/errors/recent?limit=30');
      if (result.success) {
        setRecentErrors(result.data.errors || []);
      }
    } catch (error) {
      console.error('Failed to load errors:', error);
    }
  }, [apiCall]);

  // Load container status
  const loadContainerStatus = useCallback(async () => {
    try {
      const result = await apiCall('/nova/containers/status');
      if (result.success) {
        setContainerStatus(result.data.containers || []);
      }
    } catch (error) {
      console.error('Failed to load container status:', error);
    }
  }, [apiCall]);

  // Initial load
  useEffect(() => {
    loadSystemHealth();
    loadContainerStatus();
  }, [loadSystemHealth, loadContainerStatus]);

  // Tab change handler
  useEffect(() => {
    if (activeTab === 'files' && files.length === 0) {
      loadDirectory('src');
    }
    if (activeTab === 'health') {
      loadSystemHealth();
      loadContainerStatus();
    }
    if (activeTab === 'logs') {
      loadRecentErrors();
    }
  }, [activeTab, files.length, loadDirectory, loadSystemHealth, loadContainerStatus, loadRecentErrors]);

  // Navigate directory
  const navigateTo = (entry: FileEntry) => {
    if (entry.type === 'directory') {
      loadDirectory(`${currentPath}/${entry.name}`);
    } else {
      loadFile(`${currentPath}/${entry.name}`);
    }
  };

  // Navigate up
  const navigateUp = () => {
    const parts = currentPath.split('/');
    if (parts.length > 1) {
      parts.pop();
      loadDirectory(parts.join('/') || 'src');
    }
  };

  // Format uptime
  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="nova-tooling-panel flex flex-col h-full bg-[#1e1e2e] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-900/50 to-blue-900/50 border-b border-purple-500/30">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🛠️</span>
          <div>
            <h1 className="text-lg font-bold text-purple-300">Nova Advanced Tooling</h1>
            <p className="text-xs text-gray-400">Production System Management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {systemHealth && (
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              systemHealth.overall === 'healthy' ? 'bg-green-500/20 text-green-400' :
              systemHealth.overall === 'degraded' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {systemHealth.overall === 'healthy' ? '✓ System Healthy' :
               systemHealth.overall === 'degraded' ? '! Degraded' : '✗ Critical'}
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-purple-500/30 bg-[#181825]">
        {[
          { id: 'health' as ToolTab, label: '📊 Health', icon: '📊' },
          { id: 'files' as ToolTab, label: '📁 Files', icon: '📁' },
          { id: 'editor' as ToolTab, label: '✏️ Editor', icon: '✏️' },
          { id: 'search' as ToolTab, label: '🔍 Search', icon: '🔍' },
          { id: 'database' as ToolTab, label: '🗄️ Database', icon: '🗄️' },
          { id: 'logs' as ToolTab, label: '📋 Logs', icon: '📋' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm transition-all ${
              activeTab === tab.id
                ? 'bg-[#1e1e2e] text-purple-300 border-b-2 border-purple-500'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#313244]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {/* Health Tab */}
        {activeTab === 'health' && (
          <div className="h-full overflow-auto p-4 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-purple-300">System Health Overview</h2>
              <button
                onClick={loadSystemHealth}
                disabled={isLoading}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Refreshing...' : '🔄 Refresh'}
              </button>
            </div>

            {systemHealth && (
              <>
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#313244] p-4 rounded-lg">
                    <div className="text-3xl font-bold text-green-400">
                      {formatUptime(systemHealth.metrics.uptime)}
                    </div>
                    <div className="text-sm text-gray-400">Uptime</div>
                  </div>
                  <div className="bg-[#313244] p-4 rounded-lg">
                    <div className="text-3xl font-bold text-blue-400">
                      {systemHealth.metrics.memoryUsage.heapUsed}MB
                    </div>
                    <div className="text-sm text-gray-400">
                      / {systemHealth.metrics.memoryUsage.heapTotal}MB Heap
                    </div>
                  </div>
                  <div className="bg-[#313244] p-4 rounded-lg">
                    <div className="text-3xl font-bold text-purple-400">
                      {systemHealth.components.length}
                    </div>
                    <div className="text-sm text-gray-400">Components</div>
                  </div>
                  <div className="bg-[#313244] p-4 rounded-lg">
                    <div className="text-3xl font-bold text-yellow-400">
                      {systemHealth.metrics.memoryUsage.rss}MB
                    </div>
                    <div className="text-sm text-gray-400">RSS Memory</div>
                  </div>
                </div>

                {/* Components */}
                <div className="bg-[#313244] rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-purple-300 mb-3">Components</h3>
                  <div className="space-y-2">
                    {systemHealth.components.map((comp, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-[#1e1e2e] rounded">
                        <div className="flex items-center gap-3">
                          <span className={`w-3 h-3 rounded-full ${
                            comp.status === 'healthy' ? 'bg-green-500' :
                            comp.status === 'degraded' ? 'bg-yellow-500' :
                            comp.status === 'unknown' ? 'bg-gray-500' :
                            'bg-red-500'
                          }`} />
                          <span className="font-medium">{comp.name}</span>
                        </div>
                        <div className="text-sm text-gray-400">
                          {comp.latency && `${comp.latency}ms`}
                          <span className="ml-2">{comp.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Containers */}
                {containerStatus && (
                  <div className="bg-[#313244] rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-purple-300 mb-3">Docker Containers</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {containerStatus.map((container, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-[#1e1e2e] rounded">
                          <span className="font-mono text-sm">{container.name}</span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            container.status === 'running' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {container.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {systemHealth.recommendations.length > 0 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-yellow-400 mb-2">⚠️ Recommendations</h3>
                    <ul className="space-y-1">
                      {systemHealth.recommendations.map((rec, i) => (
                        <li key={i} className="text-yellow-200">{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Files Tab */}
        {activeTab === 'files' && (
          <div className="h-full overflow-auto p-4">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={navigateUp}
                disabled={currentPath === 'src'}
                className="px-3 py-1 bg-[#313244] hover:bg-[#45475a] rounded disabled:opacity-50 transition-colors"
              >
                ⬆️ Up
              </button>
              <span className="text-purple-300 font-mono">{currentPath}</span>
              <button
                onClick={() => loadDirectory(currentPath)}
                className="ml-auto px-3 py-1 bg-purple-600 hover:bg-purple-500 rounded transition-colors"
              >
                🔄
              </button>
            </div>

            <div className="space-y-1">
              {files.map((entry) => (
                <button
                  key={entry.name}
                  onClick={() => navigateTo(entry)}
                  className="w-full flex items-center gap-3 p-3 bg-[#313244] hover:bg-[#45475a] rounded transition-colors text-left"
                >
                  <span className="text-xl">{entry.type === 'directory' ? '📁' : '📄'}</span>
                  <span className="flex-1 font-mono">{entry.name}</span>
                  {entry.size && (
                    <span className="text-sm text-gray-400">{(entry.size / 1024).toFixed(1)}KB</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Editor Tab */}
        {activeTab === 'editor' && (
          <div className="h-full">
            {selectedFile ? (
              <NovaCodeEditor
                initialValue={fileContent}
                language="html"
                filePath={selectedFile}
                onChange={(value) => setFileContent(value)}
                onSave={saveFile}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                Select a file from the Files tab to edit
              </div>
            )}
          </div>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="h-full overflow-auto p-4">
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchCode()}
                placeholder="Search code..."
                className="flex-1 px-4 py-2 bg-[#313244] text-white rounded-lg border border-purple-500/30 focus:border-purple-500 focus:outline-none"
              />
              <button
                onClick={searchCode}
                disabled={isSearching || !searchQuery.trim()}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg disabled:opacity-50 transition-colors"
              >
                {isSearching ? 'Searching...' : '🔍 Search'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-gray-400 mb-2">{searchResults.length} results found</div>
                {searchResults.map((result, i) => (
                  <button
                    key={i}
                    onClick={() => loadFile(result.file.startsWith('/') ? result.file.slice(1) : result.file)}
                    className="w-full p-3 bg-[#313244] hover:bg-[#45475a] rounded-lg text-left transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-purple-300 font-mono text-sm">{result.file}</span>
                      <span className="text-gray-500 text-xs">Line {result.line}</span>
                    </div>
                    <div className="text-sm text-gray-300 font-mono truncate">{result.content}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Database Tab */}
        {activeTab === 'database' && (
          <div className="h-full overflow-auto p-4">
            <div className="flex gap-2 mb-4">
              <select
                value={dbTable}
                onChange={(e) => setDbTable(e.target.value)}
                className="px-4 py-2 bg-[#313244] text-white rounded-lg border border-purple-500/30 focus:border-purple-500 focus:outline-none"
              >
                <option value="users">Users</option>
                <option value="accounts">Accounts</option>
                <option value="vehicles">Vehicles</option>
                <option value="leads">Leads</option>
                <option value="fb_accounts">FB Accounts</option>
                <option value="ai_user_memories">AI Memories</option>
                <option value="iai_soldiers">IAI Soldiers</option>
                <option value="error_logs">Error Logs</option>
              </select>
              <button
                onClick={queryDatabase}
                disabled={isLoading}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Querying...' : '🔍 Query'}
              </button>
            </div>

            {dbResults && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#313244]">
                      {dbResults[0] && Object.keys(dbResults[0]).map((key) => (
                        <th key={key} className="px-3 py-2 text-left text-purple-300 font-mono">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dbResults.map((row, i) => (
                      <tr key={i} className="border-t border-[#313244] hover:bg-[#313244]/50">
                        {Object.values(row).map((value: any, j) => (
                          <td key={j} className="px-3 py-2 font-mono text-gray-300 truncate max-w-xs">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 text-sm text-gray-400">{dbResults.length} records</div>
              </div>
            )}
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="h-full overflow-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-purple-300">Recent Errors</h2>
              <button
                onClick={loadRecentErrors}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
              >
                🔄 Refresh
              </button>
            </div>

            <div className="space-y-2">
              {recentErrors.length === 0 ? (
                <div className="text-center text-gray-400 py-10">No recent errors 🎉</div>
              ) : (
                recentErrors.map((error, i) => (
                  <div key={i} className="p-3 bg-red-500/10 border-l-4 border-red-500 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-red-400 font-medium">{error.level?.toUpperCase() || 'ERROR'}</span>
                      <span className="text-gray-500 text-xs">
                        {error.timestamp ? new Date(error.timestamp).toLocaleString() : ''}
                      </span>
                    </div>
                    <div className="text-gray-300">{error.message}</div>
                    {error.source && <div className="text-sm text-gray-500">Source: {error.source}</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default NovaToolingPanel;
