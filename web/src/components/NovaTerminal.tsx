/**
 * Nova Terminal Component
 * 
 * Production-grade terminal interface for Nova AI to execute commands
 * on VPS and local systems with full audit logging.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface TerminalResult {
  success: boolean;
  sessionId: string;
  command: string;
  output: string;
  error?: string;
  exitCode?: number;
  executionTime: number;
  dangerous: boolean;
  truncated: boolean;
}

interface CommandHistoryEntry {
  id: string;
  command: string;
  target: 'vps' | 'local' | 'docker';
  timestamp: Date;
  result?: TerminalResult;
  status: 'running' | 'completed' | 'error';
}

interface SystemInfo {
  hostname: string;
  uptime: string;
  load: string;
  memory: string;
  disk: string;
  dockerContainers: string;
}

type TerminalTarget = 'vps' | 'local' | 'docker';

export function NovaTerminal() {
  const [command, setCommand] = useState('');
  const [target, setTarget] = useState<TerminalTarget>('vps');
  const [history, setHistory] = useState<CommandHistoryEntry[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [commandHistoryIndex, setCommandHistoryIndex] = useState(-1);
  const [showQuickCommands, setShowQuickCommands] = useState(true);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Quick command presets
  const quickCommands = {
    vps: [
      { label: '📊 System Status', cmd: 'docker compose -f docker-compose.production.yml ps' },
      { label: '📋 API Logs', cmd: 'docker compose -f docker-compose.production.yml logs api --tail=50' },
      { label: '💾 Disk Space', cmd: 'df -h' },
      { label: '🧠 Memory', cmd: 'free -h' },
      { label: '⏱️ Uptime', cmd: 'uptime' },
      { label: '🔄 Git Status', cmd: 'git status' },
      { label: '📜 Git Log', cmd: 'git log --oneline -10' },
      { label: '🔄 Restart API', cmd: 'docker compose -f docker-compose.production.yml restart api' },
    ],
    docker: [
      { label: '📊 Container Status', cmd: 'ps' },
      { label: '📋 API Logs', cmd: 'logs api --tail=50' },
      { label: '📋 Postgres Logs', cmd: 'logs postgres --tail=30' },
      { label: '📋 Worker Logs', cmd: 'logs browser-worker --tail=30' },
      { label: '🔄 Restart API', cmd: 'restart api' },
      { label: '🔄 Restart Workers', cmd: 'restart browser-worker' },
      { label: '🗑️ Prune Images', cmd: 'image prune -f' },
    ],
    local: [
      { label: '📁 List Files', cmd: 'ls -la' },
      { label: '📊 Node Version', cmd: 'node --version' },
      { label: '📊 NPM Version', cmd: 'npm --version' },
      { label: '📁 Current Dir', cmd: 'pwd' },
    ],
  };

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

  // API call helper
  const apiCall = useCallback(async (endpoint: string, method: string = 'POST', body?: any) => {
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

  // Load system info
  const loadSystemInfo = useCallback(async () => {
    try {
      const result = await apiCall('/nova/terminal/system-info', 'GET');
      if (result.success && result.data?.data) {
        setSystemInfo(result.data.data);
      }
    } catch (error) {
      console.error('Failed to load system info:', error);
    }
  }, [apiCall]);

  // Execute command
  const executeCommand = useCallback(async (cmd?: string) => {
    const cmdToExecute = cmd || command;
    if (!cmdToExecute.trim()) return;

    const entryId = `cmd_${Date.now()}`;
    const entry: CommandHistoryEntry = {
      id: entryId,
      command: cmdToExecute,
      target,
      timestamp: new Date(),
      status: 'running',
    };

    setHistory(prev => [...prev, entry]);
    setIsExecuting(true);
    setCommand('');
    setCommandHistoryIndex(-1);

    try {
      let endpoint = '/nova/terminal/vps';
      let body: any = { command: cmdToExecute };

      if (target === 'local') {
        endpoint = '/nova/terminal/local';
      } else if (target === 'docker') {
        endpoint = '/nova/terminal/docker';
      }

      const result = await apiCall(endpoint, 'POST', body);
      const termResult = result.data as TerminalResult;

      setHistory(prev => prev.map(h => 
        h.id === entryId 
          ? { ...h, result: termResult, status: termResult.success ? 'completed' : 'error' }
          : h
      ));
    } catch (error: any) {
      setHistory(prev => prev.map(h => 
        h.id === entryId 
          ? { ...h, status: 'error', result: { 
              success: false, 
              sessionId: entryId, 
              command: cmdToExecute, 
              output: '', 
              error: error.message, 
              executionTime: 0, 
              dangerous: false, 
              truncated: false 
            } }
          : h
      ));
    } finally {
      setIsExecuting(false);
    }
  }, [command, target, apiCall]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isExecuting) {
      executeCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const commands = history.filter(h => h.target === target);
      if (commands.length > 0) {
        const newIndex = commandHistoryIndex < commands.length - 1 ? commandHistoryIndex + 1 : commandHistoryIndex;
        setCommandHistoryIndex(newIndex);
        setCommand(commands[commands.length - 1 - newIndex]?.command || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (commandHistoryIndex > 0) {
        const commands = history.filter(h => h.target === target);
        const newIndex = commandHistoryIndex - 1;
        setCommandHistoryIndex(newIndex);
        setCommand(commands[commands.length - 1 - newIndex]?.command || '');
      } else {
        setCommandHistoryIndex(-1);
        setCommand('');
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setHistory([]);
    }
  }, [isExecuting, executeCommand, history, commandHistoryIndex, target]);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  // Load system info on mount
  useEffect(() => {
    loadSystemInfo();
    const interval = setInterval(loadSystemInfo, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [loadSystemInfo]);

  // Focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, [target]);

  // Clear terminal
  const clearTerminal = () => setHistory([]);

  // Format output with ANSI-like colors
  const formatOutput = (text: string) => {
    return text
      .replace(/error/gi, '<span class="text-red-400">error</span>')
      .replace(/warning/gi, '<span class="text-yellow-400">warning</span>')
      .replace(/success/gi, '<span class="text-green-400">success</span>')
      .replace(/healthy/gi, '<span class="text-green-400">healthy</span>')
      .replace(/running/gi, '<span class="text-green-400">running</span>')
      .replace(/exited/gi, '<span class="text-red-400">exited</span>');
  };

  return (
    <div className="nova-terminal flex flex-col h-full bg-[#0d1117] text-gray-300 font-mono text-sm rounded-lg overflow-hidden border border-purple-500/30">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-purple-500/30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
          </div>
          <h2 className="text-purple-400 font-bold">Nova Terminal</h2>
          <span className="text-xs text-gray-500">Secure VPS Access</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Target selector */}
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as TerminalTarget)}
            className="px-3 py-1 bg-[#21262d] text-gray-300 rounded border border-gray-600 text-xs focus:border-purple-500 focus:outline-none"
          >
            <option value="vps">🖥️ VPS (SSH)</option>
            <option value="docker">🐳 Docker</option>
            <option value="local">💻 Local</option>
          </select>
          
          <button
            onClick={() => setShowQuickCommands(!showQuickCommands)}
            className={`px-2 py-1 rounded text-xs ${showQuickCommands ? 'bg-purple-600 text-white' : 'bg-[#21262d] text-gray-400'}`}
          >
            ⚡ Quick
          </button>
          
          <button
            onClick={clearTerminal}
            className="px-2 py-1 bg-[#21262d] hover:bg-[#30363d] text-gray-400 rounded text-xs"
            title="Clear (Ctrl+L)"
          >
            🗑️ Clear
          </button>
          
          <button
            onClick={loadSystemInfo}
            className="px-2 py-1 bg-[#21262d] hover:bg-[#30363d] text-gray-400 rounded text-xs"
          >
            🔄
          </button>
        </div>
      </div>

      {/* System Info Bar */}
      {systemInfo && (
        <div className="flex items-center gap-4 px-4 py-1 bg-[#161b22] border-b border-gray-800 text-xs text-gray-500 overflow-x-auto">
          <span>🖥️ {systemInfo.hostname}</span>
          <span>⏱️ {systemInfo.uptime}</span>
          <span>📊 Load: {systemInfo.load.split(' ').slice(0, 3).join(' ')}</span>
          <span>💾 {systemInfo.memory.split(/\s+/).slice(1, 4).join(' ')}</span>
          <span>💿 {systemInfo.disk.split(/\s+/).slice(2, 4).join(' ')}</span>
        </div>
      )}

      {/* Quick Commands */}
      {showQuickCommands && (
        <div className="flex flex-wrap gap-1 px-4 py-2 bg-[#161b22] border-b border-gray-800">
          {quickCommands[target].map((qc, i) => (
            <button
              key={i}
              onClick={() => executeCommand(qc.cmd)}
              disabled={isExecuting}
              className="px-2 py-1 bg-[#21262d] hover:bg-purple-600/20 text-gray-400 hover:text-purple-300 rounded text-xs transition-colors disabled:opacity-50"
            >
              {qc.label}
            </button>
          ))}
        </div>
      )}

      {/* Output Area */}
      <div 
        ref={outputRef}
        className="flex-1 overflow-auto p-4 space-y-4"
        onClick={() => inputRef.current?.focus()}
      >
        {/* Welcome message */}
        {history.length === 0 && (
          <div className="text-gray-500">
            <div className="text-purple-400 mb-2">╔══════════════════════════════════════════════════════════════╗</div>
            <div className="text-purple-400">║  🚀 Nova Terminal v1.0 - Production VPS Access                ║</div>
            <div className="text-purple-400">╚══════════════════════════════════════════════════════════════╝</div>
            <div className="mt-2 text-gray-400">
              <p>Connected to: <span className="text-green-400">46.4.224.182</span> (root@facemydealer)</p>
              <p>Project: <span className="text-cyan-400">/opt/facemydealer</span></p>
              <p className="mt-2">Type commands or use quick actions above. Press Enter to execute.</p>
              <p className="text-xs text-gray-600 mt-1">↑/↓ for history | Ctrl+L to clear | Commands are logged for audit</p>
            </div>
          </div>
        )}

        {/* Command history */}
        {history.map((entry) => (
          <div key={entry.id} className="space-y-1">
            {/* Command line */}
            <div className="flex items-center gap-2">
              <span className={`text-xs px-1 rounded ${
                entry.target === 'vps' ? 'bg-blue-500/20 text-blue-400' :
                entry.target === 'docker' ? 'bg-cyan-500/20 text-cyan-400' :
                'bg-green-500/20 text-green-400'
              }`}>
                {entry.target === 'vps' ? 'VPS' : entry.target === 'docker' ? 'DOCKER' : 'LOCAL'}
              </span>
              <span className="text-purple-400">$</span>
              <span className="text-white">{entry.command}</span>
              {entry.result?.dangerous && (
                <span className="text-xs px-1 bg-red-500/20 text-red-400 rounded">⚠️ DANGEROUS</span>
              )}
            </div>

            {/* Output */}
            {entry.status === 'running' ? (
              <div className="pl-4 text-yellow-400 animate-pulse">
                ⏳ Executing...
              </div>
            ) : entry.result && (
              <div className="pl-4">
                {entry.result.error ? (
                  <div className="text-red-400">
                    <span className="text-red-500">Error:</span> {entry.result.error}
                  </div>
                ) : (
                  <pre 
                    className="whitespace-pre-wrap text-gray-300 max-h-96 overflow-auto"
                    dangerouslySetInnerHTML={{ __html: formatOutput(entry.result.output) }}
                  />
                )}
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-600">
                  <span>Exit: {entry.result.exitCode}</span>
                  <span>Time: {entry.result.executionTime}ms</span>
                  {entry.result.truncated && <span className="text-yellow-500">⚠️ Output truncated</span>}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Current prompt */}
        <div className="flex items-center gap-2">
          <span className={`text-xs px-1 rounded ${
            target === 'vps' ? 'bg-blue-500/20 text-blue-400' :
            target === 'docker' ? 'bg-cyan-500/20 text-cyan-400' :
            'bg-green-500/20 text-green-400'
          }`}>
            {target === 'vps' ? 'VPS' : target === 'docker' ? 'DOCKER' : 'LOCAL'}
          </span>
          <span className="text-purple-400">$</span>
          <input
            ref={inputRef}
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isExecuting}
            placeholder={isExecuting ? 'Executing...' : 'Enter command...'}
            className="flex-1 bg-transparent text-white outline-none placeholder-gray-600 disabled:opacity-50"
            autoComplete="off"
            spellCheck={false}
          />
          {isExecuting && (
            <span className="animate-spin text-purple-400">⟳</span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-1 bg-[#161b22] border-t border-gray-800 text-xs text-gray-500">
        <span>Target: {target === 'vps' ? 'root@46.4.224.182:/opt/facemydealer' : target === 'docker' ? 'docker compose' : 'localhost'}</span>
        <span>{history.length} commands executed</span>
      </div>
    </div>
  );
}

export default NovaTerminal;
