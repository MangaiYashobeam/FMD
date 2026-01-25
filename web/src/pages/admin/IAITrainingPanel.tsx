/**
 * IAI Training Panel
 * 
 * Super Admin panel for viewing, managing, and injecting training data
 * recorded from the Training Recorder Extension.
 * 
 * Features:
 * - View all training sessions
 * - Inspect recorded events and marked elements
 * - Extract and edit field mappings
 * - Activate/deactivate training configurations
 * - Generate and copy automation code
 * - Inject training data to IAI extensions
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play,
  Trash2,
  Eye,
  CheckCircle,
  Clock,
  Database,
  Code,
  Layers,
  Target,
  MousePointer,
  Keyboard,
  Copy,
  RefreshCw,
  Zap,
  Settings,
  Radio,
  WifiOff,
  Wifi,
  Activity,
  Terminal,
  Heart,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../lib/api';

// ============================================
// Types
// ============================================

interface TrainingSession {
  id: string;
  sessionId: string;
  mode: 'listing' | 'messages' | 'navigation' | 'full';
  recordingType: 'iai' | 'soldier';
  totalEvents: number;
  markedElementsCount: number;
  duration: number;
  createdAt: string;
  status: 'RECORDED' | 'PROCESSED' | 'ACTIVE' | 'ARCHIVED';
  isActive: boolean;
}

interface TrainingEvent {
  id: string;
  type: string;
  timestamp: string;
  relativeTime: number;
  fieldType: string | null;
  isMarked: boolean;
  elementData: any;
}

interface TrainingMarkedElement {
  id: string;
  fieldType: string;
  order: number;
  elementData: any;
  selectors: string[];
  ariaLabel: string | null;
  isDropdown: boolean;
  isInput: boolean;
}

interface TrainingFieldMapping {
  id: string;
  fieldType: string;
  primarySelector: string;
  fallbackSelectors: string[];
  ariaLabel: string | null;
  isDropdown: boolean;
  isInput: boolean;
}

interface SessionDetail {
  id: string;
  sessionId: string;
  mode: string;
  recordingType: string;
  duration: number;
  totalEvents: number;
  markedElementsCount: number;
  automationCode: any;
  clickSequence: any[];
  events: TrainingEvent[];
  markedElements: TrainingMarkedElement[];
  fieldMappings: TrainingFieldMapping[];
  patterns: any[];
}

interface HealthLogEntry {
  id: string;
  timestamp: Date;
  type: 'heartbeat' | 'recording' | 'error' | 'info' | 'connection';
  source: 'extension' | 'backend' | 'system';
  message: string;
  data?: any;
}

// ============================================
// API Functions
// ============================================

async function fetchSessions(type?: string) {
  const params = type ? `?type=${type}` : '';
  const response = await api.get(`/api/training/sessions${params}`);
  return response.data;
}

async function fetchSessionDetail(id: string) {
  const response = await api.get(`/api/training/sessions/${id}`);
  return response.data;
}

async function deleteSession(id: string) {
  const response = await api.delete(`/api/training/sessions/${id}`);
  return response.data;
}

async function processSession(id: string) {
  const response = await api.post(`/api/training/sessions/${id}/process`);
  return response.data;
}

async function activateSession(id: string, target: 'iai' | 'soldier' | 'both') {
  const response = await api.post(`/api/training/sessions/${id}/activate`, { target });
  return response.data;
}

async function fetchActiveTraining() {
  const response = await api.get('/api/training/active');
  return response.data;
}

async function sendHealthPing() {
  const response = await api.post('/api/training/console/health-ping', {
    source: 'iai-panel',
    timestamp: Date.now(),
  });
  return response.data;
}

// ============================================
// Utility Functions
// ============================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return `${Math.floor(diffMins / 1440)}d ago`;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    RECORDED: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    PROCESSED: 'bg-blue-100 text-blue-800 border-blue-200',
    ACTIVE: 'bg-green-100 text-green-800 border-green-200',
    ARCHIVED: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  return colors[status] || colors.RECORDED;
}

function getModeColor(mode: string): string {
  const colors: Record<string, string> = {
    listing: 'bg-blue-500',
    messages: 'bg-purple-500',
    navigation: 'bg-orange-500',
    full: 'bg-green-500',
  };
  return colors[mode] || 'bg-gray-500';
}

// ============================================
// Components
// ============================================

function SessionCard({
  session,
  onView,
  onProcess,
  onActivate,
  onDelete,
}: {
  session: TrainingSession;
  onView: () => void;
  onProcess: () => void;
  onActivate: () => void;
  onDelete: () => void;
  isActive?: boolean;
}) {
  return (
    <div
      className={`bg-slate-800 rounded-xl border p-4 hover:shadow-lg transition-all ${
        session.isActive ? 'border-green-500 shadow-green-500/20' : 'border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getModeColor(session.mode)} text-white`}>
              {session.mode}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(session.status)}`}>
              {session.status}
            </span>
            {session.isActive && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500 text-white flex items-center gap-1">
                <Zap className="w-3 h-3" /> Active
              </span>
            )}
          </div>
          <p className="text-white font-mono text-sm mt-2 truncate">{session.sessionId}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <MousePointer className="w-3 h-3" />
              {session.totalEvents} events
            </span>
            <span className="flex items-center gap-1">
              <Target className="w-3 h-3" />
              {session.markedElementsCount} marked
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(session.duration)}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{formatTimeAgo(session.createdAt)}</p>
        </div>
        
        <div className="flex flex-col gap-1 ml-4">
          <button
            onClick={onView}
            className="p-2 rounded-lg bg-slate-700 hover:bg-blue-600 text-slate-300 hover:text-white transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          {session.status === 'RECORDED' && (
            <button
              onClick={onProcess}
              className="p-2 rounded-lg bg-slate-700 hover:bg-purple-600 text-slate-300 hover:text-white transition-colors"
              title="Process Session"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          {session.status !== 'RECORDED' && !session.isActive && (
            <button
              onClick={onActivate}
              className="p-2 rounded-lg bg-slate-700 hover:bg-green-600 text-slate-300 hover:text-white transition-colors"
              title="Activate"
            >
              <Play className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-2 rounded-lg bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function EventTimeline({ events }: { events: TrainingEvent[] }) {
  const [expanded, setExpanded] = useState(false);
  const displayEvents = expanded ? events : events.slice(0, 10);

  return (
    <div className="space-y-2">
      {displayEvents.map((event, idx) => (
        <div
          key={event.id || idx}
          className={`flex items-start gap-3 p-2 rounded-lg ${
            event.isMarked ? 'bg-green-900/30 border border-green-700' : 'bg-slate-800/50'
          }`}
        >
          <div className="flex-shrink-0 w-16 text-xs text-slate-500 font-mono">
            +{(event.relativeTime / 1000).toFixed(2)}s
          </div>
          <div className={`flex-shrink-0 p-1 rounded ${
            event.type === 'click' ? 'bg-blue-600' :
            event.type === 'input' ? 'bg-purple-600' :
            event.type === 'scroll' ? 'bg-orange-600' :
            'bg-slate-600'
          }`}>
            {event.type === 'click' ? <MousePointer className="w-3 h-3 text-white" /> :
             event.type === 'input' || event.type === 'keydown' ? <Keyboard className="w-3 h-3 text-white" /> :
             <Layers className="w-3 h-3 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm text-white font-medium">{event.type}</span>
              {event.fieldType && (
                <span className="px-2 py-0.5 rounded text-xs bg-blue-500/30 text-blue-300">
                  {event.fieldType}
                </span>
              )}
              {event.isMarked && (
                <span className="px-2 py-0.5 rounded text-xs bg-green-500/30 text-green-300 flex items-center gap-1">
                  <Target className="w-3 h-3" /> Marked
                </span>
              )}
            </div>
            {event.elementData?.tagName && (
              <p className="text-xs text-slate-500 mt-1 font-mono truncate">
                {event.elementData.tagName.toLowerCase()}
                {event.elementData.id && `#${event.elementData.id}`}
                {event.elementData.className && `.${event.elementData.className.split(' ')[0]}`}
              </p>
            )}
          </div>
        </div>
      ))}
      
      {events.length > 10 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2 text-center text-sm text-slate-400 hover:text-white transition-colors"
        >
          {expanded ? 'Show Less' : `Show ${events.length - 10} More Events`}
        </button>
      )}
    </div>
  );
}

function FieldMappingsTable({ mappings }: { mappings: TrainingFieldMapping[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copySelector = (selector: string, id: string) => {
    navigator.clipboard.writeText(selector);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-2 px-3 text-slate-400 font-medium">Field</th>
            <th className="text-left py-2 px-3 text-slate-400 font-medium">Type</th>
            <th className="text-left py-2 px-3 text-slate-400 font-medium">Primary Selector</th>
            <th className="text-left py-2 px-3 text-slate-400 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {mappings.map((mapping) => (
            <tr key={mapping.id} className="border-b border-slate-800 hover:bg-slate-800/50">
              <td className="py-2 px-3">
                <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-300 font-medium">
                  {mapping.fieldType}
                </span>
              </td>
              <td className="py-2 px-3 text-slate-400">
                {mapping.isDropdown ? 'Dropdown' : mapping.isInput ? 'Input' : 'Element'}
              </td>
              <td className="py-2 px-3">
                <code className="text-xs text-slate-300 font-mono truncate max-w-xs block">
                  {mapping.primarySelector || mapping.ariaLabel || 'N/A'}
                </code>
              </td>
              <td className="py-2 px-3">
                <button
                  onClick={() => copySelector(mapping.primarySelector, mapping.id)}
                  className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                  title="Copy Selector"
                >
                  {copiedId === mapping.id ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SessionDetailModal({
  session,
  onClose,
}: {
  session: SessionDetail;
  onClose: () => void;
}) {
  const [activeSection, setActiveSection] = useState<'events' | 'mappings' | 'code'>('events');
  const [copied, setCopied] = useState(false);

  const copyAutomationCode = () => {
    const code = JSON.stringify(session.automationCode, null, 2);
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Session Details</h2>
              <p className="text-sm text-slate-400 font-mono mt-1">{session.sessionId}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
          
          {/* Stats */}
          <div className="flex items-center gap-6 mt-4">
            <div className="flex items-center gap-2 text-sm">
              <MousePointer className="w-4 h-4 text-blue-400" />
              <span className="text-slate-300">{session.totalEvents} events</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Target className="w-4 h-4 text-green-400" />
              <span className="text-slate-300">{session.markedElementsCount} marked</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Layers className="w-4 h-4 text-purple-400" />
              <span className="text-slate-300">{session.fieldMappings?.length || 0} field mappings</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-orange-400" />
              <span className="text-slate-300">{formatDuration(session.duration)}</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 px-6 pt-4 border-b border-slate-700">
          <button
            onClick={() => setActiveSection('events')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
              activeSection === 'events'
                ? 'bg-slate-800 text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MousePointer className="w-4 h-4 inline mr-2" />
            Events Timeline
          </button>
          <button
            onClick={() => setActiveSection('mappings')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
              activeSection === 'mappings'
                ? 'bg-slate-800 text-white border-b-2 border-green-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Target className="w-4 h-4 inline mr-2" />
            Field Mappings
          </button>
          <button
            onClick={() => setActiveSection('code')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
              activeSection === 'code'
                ? 'bg-slate-800 text-white border-b-2 border-purple-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code className="w-4 h-4 inline mr-2" />
            Automation Code
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeSection === 'events' && (
            <EventTimeline events={session.events || []} />
          )}
          
          {activeSection === 'mappings' && (
            <FieldMappingsTable mappings={session.fieldMappings || []} />
          )}
          
          {activeSection === 'code' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">Generated Automation Code</h3>
                <button
                  onClick={copyAutomationCode}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                  {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy Code'}
                </button>
              </div>
              <pre className="bg-slate-800 rounded-xl p-4 overflow-x-auto text-sm font-mono text-slate-300">
                {JSON.stringify(session.automationCode || {}, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActiveTrainingCard({ config, type }: { config: any; type: 'iai' | 'soldier' }) {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!config) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${type === 'iai' ? 'bg-blue-600' : 'bg-purple-600'}`}>
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-medium">{type === 'iai' ? 'IAI Extension' : 'Soldier Worker'}</h3>
            <p className="text-sm text-slate-500">No active training configuration</p>
          </div>
        </div>
      </div>
    );
  }

  const copyCode = async () => {
    try {
      const code = JSON.stringify(config, null, 2);
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-green-500/50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${type === 'iai' ? 'bg-blue-600' : 'bg-purple-600'}`}>
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-medium flex items-center gap-2">
              {type === 'iai' ? 'IAI Extension' : 'Soldier Worker'}
              <span className="px-2 py-0.5 rounded text-xs bg-green-500 text-white">Active</span>
            </h3>
            <p className="text-sm text-slate-400 font-mono">{config.sessionId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCode(!showCode)}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
          >
            <Code className="w-4 h-4" />
          </button>
          <button
            onClick={copyCode}
            className="p-2 rounded-lg bg-slate-700 hover:bg-blue-600 text-slate-300 hover:text-white transition-colors"
          >
            {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>
      
      {showCode && (
        <pre className="mt-4 bg-slate-900 rounded-lg p-3 text-xs font-mono text-slate-300 overflow-x-auto max-h-48 overflow-y-auto">
          {JSON.stringify(config, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ============================================
// Health Log Panel Component
// ============================================

function HealthLogPanel({ 
  logs, 
  isConnected, 
  onSendPing,
  onClear 
}: { 
  logs: HealthLogEntry[];
  isConnected: boolean;
  onSendPing: () => void;
  onClear: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const logContainerRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogIcon = (type: HealthLogEntry['type']) => {
    switch (type) {
      case 'heartbeat':
        return <Heart className="w-3 h-3 text-green-400" />;
      case 'recording':
        return <Radio className="w-3 h-3 text-red-400" />;
      case 'error':
        return <AlertCircle className="w-3 h-3 text-red-500" />;
      case 'connection':
        return <Wifi className="w-3 h-3 text-blue-400" />;
      default:
        return <Activity className="w-3 h-3 text-slate-400" />;
    }
  };

  const getLogColor = (type: HealthLogEntry['type']) => {
    switch (type) {
      case 'heartbeat':
        return 'text-green-400';
      case 'recording':
        return 'text-red-400';
      case 'error':
        return 'text-red-500';
      case 'connection':
        return 'text-blue-400';
      default:
        return 'text-slate-400';
    }
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 bg-slate-800 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-green-400" />
          <h3 className="text-white font-medium">Extension Health Log</h3>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {isConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onSendPing(); }}
            className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            Send Ping
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
          >
            Clear
          </button>
          <span className="text-slate-500 text-sm">{logs.length} entries</span>
        </div>
      </div>

      {/* Log Content */}
      {expanded && (
        <div 
          ref={logContainerRef}
          className="h-48 overflow-y-auto font-mono text-xs p-3 space-y-1 bg-black/30"
        >
          {logs.length === 0 ? (
            <div className="text-slate-500 text-center py-8">
              No health logs yet. Waiting for extension connection...
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 hover:bg-slate-800/50 px-2 py-1 rounded">
                <span className="text-slate-600 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                {getLogIcon(log.type)}
                <span className={`uppercase text-xs font-bold w-12 ${getLogColor(log.type)}`}>
                  [{log.source.substring(0, 3).toUpperCase()}]
                </span>
                <span className={`flex-1 ${getLogColor(log.type)}`}>
                  {log.message}
                </span>
                {log.data && (
                  <span className="text-slate-600 truncate max-w-[200px]" title={JSON.stringify(log.data)}>
                    {JSON.stringify(log.data)}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function IAITrainingPanel() {
  const [typeFilter, setTypeFilter] = useState<'all' | 'iai' | 'soldier'>('all');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<SessionDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [extensionStatus, setExtensionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [extensionInfo, setExtensionInfo] = useState<{
    browserId?: string;
    version?: string;
    currentTab?: string;
    recordingActive?: boolean;
    lastHeartbeat?: string;
  } | null>(null);
  const [lastSessionCheck, setLastSessionCheck] = useState<Date | null>(null);
  const [newSessionAlert, setNewSessionAlert] = useState(false);
  
  // Health log state
  const [healthLogs, setHealthLogs] = useState<HealthLogEntry[]>([]);
  const healthLogIdRef = useRef(0);
  
  const queryClient = useQueryClient();

  // Add a health log entry
  const addHealthLog = useCallback((
    type: HealthLogEntry['type'],
    source: HealthLogEntry['source'],
    message: string,
    data?: any
  ) => {
    const newLog: HealthLogEntry = {
      id: `log_${healthLogIdRef.current++}`,
      timestamp: new Date(),
      type,
      source,
      message,
      data,
    };
    setHealthLogs(prev => [...prev.slice(-99), newLog]); // Keep last 100 logs
  }, []);

  // Clear health logs
  const clearHealthLogs = useCallback(() => {
    setHealthLogs([]);
    addHealthLog('info', 'system', 'Logs cleared');
  }, [addHealthLog]);

  // Send health ping
  const sendHealthPingAction = useCallback(async () => {
    addHealthLog('info', 'system', 'Sending health ping to extension...');
    try {
      const response = await sendHealthPing();
      addHealthLog('heartbeat', 'backend', 'Health ping sent', response);
    } catch (error: any) {
      addHealthLog('error', 'system', `Ping failed: ${error.message}`);
    }
  }, [addHealthLog]);

  // Check for extension connection via heartbeat endpoint
  useEffect(() => {
    const checkExtension = async () => {
      try {
        // Check the ROOT console heartbeat status endpoint
        console.log('[IAI Training] Checking extension status...');
        const statusResponse = await api.get('/api/training/console/status');
        console.log('[IAI Training] Status response:', statusResponse.data);
        
        if (statusResponse.data?.success && statusResponse.data?.connected) {
          console.log('[IAI Training] Extension connected!', statusResponse.data);
          
          // Log the heartbeat
          addHealthLog('heartbeat', 'extension', 'Heartbeat received', {
            browserId: statusResponse.data.browserId,
            recording: statusResponse.data.recordingActive,
          });
          
          setExtensionStatus('connected');
          setExtensionInfo({
            browserId: statusResponse.data.browserId,
            version: statusResponse.data.version,
            currentTab: statusResponse.data.currentTab,
            recordingActive: statusResponse.data.recordingActive,
            lastHeartbeat: statusResponse.data.lastHeartbeat,
          });
        } else {
          console.log('[IAI Training] Extension not connected via heartbeat, checking sessions...');
          // Fallback: check if there are recent sessions
          const sessionResponse = await api.get('/api/training/sessions?limit=1');
          if (sessionResponse.data?.sessions?.length > 0) {
            const latestSession = sessionResponse.data.sessions[0];
            const sessionDate = new Date(latestSession.createdAt);
            
            // If session was created in the last 5 minutes, extension might be active
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            if (sessionDate > fiveMinutesAgo) {
              setExtensionStatus('connected');
              setExtensionInfo(null);
              
              // Check if this is a NEW session we haven't seen
              if (lastSessionCheck && sessionDate > lastSessionCheck) {
                setNewSessionAlert(true);
                queryClient.invalidateQueries({ queryKey: ['trainingSessions'] });
                setTimeout(() => setNewSessionAlert(false), 5000);
              }
              setLastSessionCheck(new Date());
              return;
            }
          }
          console.log('[IAI Training] Extension disconnected');
          setExtensionStatus('disconnected');
          setExtensionInfo(null);
        }
      } catch (error) {
        console.error('[IAI Training] Error checking extension:', error);
        setExtensionStatus('disconnected');
        setExtensionInfo(null);
      }
    };

    // Initial check
    checkExtension();

    // Poll every 5 seconds for connection status
    const interval = setInterval(checkExtension, 5000);
    return () => clearInterval(interval);
  }, [lastSessionCheck, queryClient]);

  // Queries
  const {
    data: sessionsData,
    isLoading: sessionsLoading,
  } = useQuery({
    queryKey: ['trainingSessions', typeFilter],
    queryFn: () => fetchSessions(typeFilter === 'all' ? undefined : typeFilter),
    refetchInterval: 30000,
  });

  const {
    data: activeData,
  } = useQuery({
    queryKey: ['activeTraining'],
    queryFn: fetchActiveTraining,
    refetchInterval: 60000,
  });

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: deleteSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainingSessions'] });
    },
  });

  const processMutation = useMutation({
    mutationFn: processSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainingSessions'] });
    },
  });

  const activateMutation = useMutation({
    mutationFn: ({ id, target }: { id: string; target: 'iai' | 'soldier' | 'both' }) =>
      activateSession(id, target),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainingSessions'] });
      queryClient.invalidateQueries({ queryKey: ['activeTraining'] });
    },
  });

  // Handlers
  const handleViewSession = async (id: string) => {
    setIsLoadingDetail(true);
    try {
      const data = await fetchSessionDetail(id);
      setDetailData(data.session);
      setSelectedSession(id);
    } catch (err) {
      console.error('Failed to load session details:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleDelete = (session: TrainingSession) => {
    if (confirm(`Delete training session "${session.sessionId}"?`)) {
      deleteMutation.mutate(session.id);
    }
  };

  const handleProcess = (session: TrainingSession) => {
    processMutation.mutate(session.id);
  };

  const handleActivate = (session: TrainingSession) => {
    const target = session.recordingType as 'iai' | 'soldier';
    activateMutation.mutate({ id: session.id, target });
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['trainingSessions'] });
    queryClient.invalidateQueries({ queryKey: ['activeTraining'] });
  };

  const sessions = sessionsData?.sessions || [];
  const activeConfig = activeData?.activeConfig || { iai: null, soldier: null };

  return (
    <div className="space-y-6">
      {/* New Session Alert */}
      {newSessionAlert && (
        <div className="fixed top-4 right-4 z-50 animate-pulse">
          <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <Activity className="w-5 h-5" />
            <span className="font-medium">New training session received from extension!</span>
          </div>
        </div>
      )}

      {/* Header with Extension Status */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Training System</h2>
          <p className="text-slate-400 mt-1">
            Record, process, and inject training configurations for IAI automation
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Extension Connection Status */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
            extensionStatus === 'connected' 
              ? 'bg-green-500/10 border-green-500/30 text-green-400' 
              : extensionStatus === 'connecting'
              ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 animate-pulse'
              : 'bg-slate-800 border-slate-700 text-slate-500'
          }`}>
            {extensionStatus === 'connected' ? (
              <>
                <Wifi className="w-4 h-4" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">ROOT Console Connected</span>
                  {extensionInfo && (
                    <span className="text-xs opacity-70">
                      {extensionInfo.recordingActive ? '● Recording' : '○ Idle'} | v{extensionInfo.version || '?'}
                    </span>
                  )}
                </div>
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              </>
            ) : extensionStatus === 'connecting' ? (
              <>
                <Radio className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">Seeking ROOT Console...</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" />
                <span className="text-sm font-medium">ROOT Console Offline</span>
              </>
            )}
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Active Training Configurations */}
      <div className="space-y-3">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-green-400" />
          Active Configurations
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <ActiveTrainingCard config={activeConfig.iai} type="iai" />
          <ActiveTrainingCard config={activeConfig.soldier} type="soldier" />
        </div>
      </div>

      {/* Health Log Panel */}
      <HealthLogPanel 
        logs={healthLogs}
        isConnected={extensionStatus === 'connected'}
        onSendPing={sendHealthPingAction}
        onClear={clearHealthLogs}
      />

      {/* Sessions List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-400" />
            Training Sessions
          </h3>
          <div className="flex gap-2">
            {['all', 'iai', 'soldier'].map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  typeFilter === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                {type === 'all' ? 'All' : type.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {sessionsLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
            <Database className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">
              No training sessions yet. Use the Training Recorder extension to record sessions.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sessions.map((session: TrainingSession) => (
              <SessionCard
                key={session.id}
                session={session}
                isActive={session.isActive}
                onView={() => handleViewSession(session.id)}
                onProcess={() => handleProcess(session)}
                onActivate={() => handleActivate(session)}
                onDelete={() => handleDelete(session)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Session Detail Modal */}
      {selectedSession && detailData && (
        <SessionDetailModal
          session={detailData}
          onClose={() => {
            setSelectedSession(null);
            setDetailData(null);
          }}
        />
      )}

      {/* Loading Overlay */}
      {isLoadingDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <RefreshCw className="w-12 h-12 text-blue-400 animate-spin" />
        </div>
      )}
    </div>
  );
}
