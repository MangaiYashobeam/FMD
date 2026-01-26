/**
 * IAI Injection Panel
 * 
 * Comprehensive UI for managing injection containers and patterns.
 * Part of the IAI Command Center.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Boxes,
  Code2,
  Plus,
  Edit,
  Trash2,
  Play,
  XCircle,
  Zap,
  Search,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Eye,
  Copy,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { api } from '../../lib/api';

// ============================================
// Types
// ============================================

interface InjectionContainer {
  id: string;
  name: string;
  description: string | null;
  category: string;
  isDefault: boolean;
  isActive: boolean;
  selectionMode: string;
  totalPatterns: number;
  activePatterns: number;
  totalInjections: number;
  successfulInjections: number;
  failedInjections: number;
  avgDuration: number;
  weight: number;
  priority: number;
  config: Record<string, any>;
  metadata: Record<string, any>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  patterns?: InjectionPattern[];
}

interface InjectionPattern {
  id: string;
  containerId: string;
  name: string;
  description: string | null;
  version: string;
  code: string;
  codeType: string;
  language: string;
  isActive: boolean;
  weight: number;
  priority: number;
  executionCount: number;
  successCount: number;
  failCount: number;
  avgDurationMs: number;
  lastExecutedAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  config: Record<string, any>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface InjectionStats {
  totalContainers: number;
  activeContainers: number;
  totalPatterns: number;
  activePatterns: number;
  totalInjections: number;
  successRate: number;
  avgDuration: number;
  recentInjections: any[];
  topContainers: any[];
  topPatterns: any[];
}

// ============================================
// API Functions
// ============================================

async function fetchContainers() {
  const response = await api.get('/api/injection/containers');
  // API returns { success, data: [...], total } - data contains the containers array
  return response.data.data || [];
}

async function fetchStats(): Promise<InjectionStats> {
  const response = await api.get('/api/injection/stats');
  return response.data.data;
}

async function fetchPatterns(containerId: string) {
  const response = await api.get(`/api/injection/containers/${containerId}?includePatterns=true`);
  // API returns { success, data: container } - patterns are inside the container
  return response.data.data?.patterns || [];
}

async function createContainer(data: Partial<InjectionContainer>) {
  const response = await api.post('/api/injection/containers', data);
  return response.data.data;
}

async function updateContainer(id: string, data: Partial<InjectionContainer>) {
  const response = await api.put(`/api/injection/containers/${id}`, data);
  return response.data.data;
}

async function deleteContainer(id: string) {
  const response = await api.delete(`/api/injection/containers/${id}`);
  return response.data;
}

async function createPattern(data: Partial<InjectionPattern>) {
  const response = await api.post('/api/injection/patterns', data);
  return response.data.data;
}

async function updatePattern(id: string, data: Partial<InjectionPattern>) {
  const response = await api.put(`/api/injection/patterns/${id}`, data);
  return response.data.data;
}

async function deletePattern(id: string) {
  const response = await api.delete(`/api/injection/patterns/${id}`);
  return response.data;
}

async function testPattern(id: string, input: Record<string, any>) {
  const response = await api.post(`/api/injection/test-pattern/${id}`, { input });
  return response.data;
}

async function setDefaultContainer(id: string) {
  const response = await api.post(`/api/injection/containers/${id}/set-default`);
  return response.data.data;
}

// ============================================
// Components
// ============================================

// Stats Overview Card
function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  color,
  trend
}: { 
  title: string; 
  value: number | string; 
  subtitle?: string;
  icon: any;
  color: string;
  trend?: { value: number; positive: boolean };
}) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-slate-600 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400 font-medium">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          {trend && (
            <p className={`text-xs mt-1 ${trend.positive ? 'text-green-400' : 'text-red-400'}`}>
              {trend.positive ? '↑' : '↓'} {trend.value}% from last week
            </p>
          )}
        </div>
        <div className={`${color} rounded-xl p-3`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

// Container Card Component
function ContainerCard({
  container,
  onView,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  container: InjectionContainer;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  const successRate = container.totalInjections > 0 
    ? ((container.successfulInjections / container.totalInjections) * 100).toFixed(1)
    : '0';

  return (
    <div 
      onClick={onView}
      className={`bg-slate-800 rounded-xl border ${container.isDefault ? 'border-blue-500' : 'border-slate-700'} p-5 hover:border-slate-500 transition-all cursor-pointer group`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`${container.isActive ? 'bg-green-600' : 'bg-slate-600'} rounded-lg p-2`}>
            <Boxes className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-lg">{container.name}</h3>
              {container.isDefault && (
                <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">Default</span>
              )}
            </div>
            <p className="text-slate-400 text-sm">{container.category}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {!container.isDefault && (
            <button 
              onClick={(e) => { e.stopPropagation(); onSetDefault(); }}
              className="p-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-blue-600 hover:text-white transition-colors"
              title="Set as Default"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
            title="Edit Container"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-red-600 hover:text-white transition-colors"
            title="Delete Container"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {container.description && (
        <p className="text-slate-400 text-sm mb-4 line-clamp-2">{container.description}</p>
      )}

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{container.activePatterns}</p>
          <p className="text-xs text-slate-500">Active Patterns</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{container.totalInjections}</p>
          <p className="text-xs text-slate-500">Injections</p>
        </div>
        <div className="text-center">
          <p className={`text-2xl font-bold ${parseFloat(successRate) >= 80 ? 'text-green-400' : parseFloat(successRate) >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
            {successRate}%
          </p>
          <p className="text-xs text-slate-500">Success Rate</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">
          Mode: <span className="text-slate-300 capitalize">{container.selectionMode}</span>
        </span>
        <div className="flex items-center gap-1 text-slate-400">
          <ChevronRight className="w-4 h-4" />
          View Patterns
        </div>
      </div>

      {container.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-slate-700">
          {container.tags.slice(0, 5).map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded">
              {tag}
            </span>
          ))}
          {container.tags.length > 5 && (
            <span className="text-slate-500 text-xs">+{container.tags.length - 5} more</span>
          )}
        </div>
      )}
    </div>
  );
}

// Container Modal
function ContainerModal({
  container,
  onClose,
  onSave,
}: {
  container: InjectionContainer | null;
  onClose: () => void;
  onSave: (data: Partial<InjectionContainer>) => void;
}) {
  const [formData, setFormData] = useState({
    name: container?.name || '',
    description: container?.description || '',
    category: container?.category || 'general',
    selectionMode: container?.selectionMode || 'random',
    isActive: container?.isActive ?? true,
    weight: container?.weight ?? 100,
    priority: container?.priority ?? 0,
    tags: container?.tags?.join(', ') || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-6">
          {container ? 'Edit Container' : 'Create Container'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 h-24"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="general">General</option>
                <option value="listing">Listing</option>
                <option value="messaging">Messaging</option>
                <option value="navigation">Navigation</option>
                <option value="data-extraction">Data Extraction</option>
                <option value="automation">Automation</option>
                <option value="utility">Utility</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Selection Mode</label>
              <select
                value={formData.selectionMode}
                onChange={(e) => setFormData({ ...formData, selectionMode: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="random">Random</option>
                <option value="weighted">Weighted</option>
                <option value="priority">Priority</option>
                <option value="round-robin">Round Robin</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Weight</label>
              <input
                type="number"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: parseInt(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                min="0"
                max="1000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Priority</label>
              <input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                min="0"
                max="100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Tags (comma separated)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder="tag1, tag2, tag3"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4"
              id="isActive"
            />
            <label htmlFor="isActive" className="text-sm text-slate-300">Container is active</label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {container ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Pattern Modal
function PatternModal({
  pattern,
  containerId,
  onClose,
  onSave,
}: {
  pattern: InjectionPattern | null;
  containerId: string;
  onClose: () => void;
  onSave: (data: Partial<InjectionPattern>) => void;
}) {
  const [formData, setFormData] = useState({
    name: pattern?.name || '',
    description: pattern?.description || '',
    code: pattern?.code || '// Your pattern code here\nasync function execute(input) {\n  // Implementation\n  return { success: true };\n}',
    codeType: pattern?.codeType || 'injection',
    language: pattern?.language || 'javascript',
    version: pattern?.version || '1.0.0',
    isActive: pattern?.isActive ?? true,
    weight: pattern?.weight ?? 100,
    priority: pattern?.priority ?? 0,
    tags: pattern?.tags?.join(', ') || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      containerId,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-6">
          {pattern ? 'Edit Pattern' : 'Create Pattern'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Version</label>
              <input
                type="text"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 h-20"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Code Type</label>
              <select
                value={formData.codeType}
                onChange={(e) => setFormData({ ...formData, codeType: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="injection">Injection</option>
                <option value="action">Action</option>
                <option value="selector">Selector</option>
                <option value="extractor">Extractor</option>
                <option value="transformer">Transformer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Language</label>
              <select
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="json">JSON</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Priority</label>
              <input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                min="0"
                max="100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Code *</label>
            <textarea
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 font-mono text-sm h-64"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Weight</label>
              <input
                type="number"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: parseInt(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                min="0"
                max="1000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Tags (comma separated)</label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                placeholder="tag1, tag2, tag3"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4"
              id="patternIsActive"
            />
            <label htmlFor="patternIsActive" className="text-sm text-slate-300">Pattern is active</label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              {pattern ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Pattern Detail Modal
function PatternDetailModal({
  pattern,
  onClose,
  onTest,
}: {
  pattern: InjectionPattern;
  onClose: () => void;
  onTest: (input: Record<string, any>) => void;
}) {
  const [testInput, setTestInput] = useState('{}');
  const successRate = pattern.executionCount > 0 
    ? ((pattern.successCount / pattern.executionCount) * 100).toFixed(1)
    : '0';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">{pattern.name}</h2>
            <p className="text-slate-400">v{pattern.version} • {pattern.language}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        {pattern.description && (
          <p className="text-slate-300 mb-6">{pattern.description}</p>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-900 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-white">{pattern.executionCount}</p>
            <p className="text-sm text-slate-400">Total Executions</p>
          </div>
          <div className="bg-slate-900 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{pattern.successCount}</p>
            <p className="text-sm text-slate-400">Successful</p>
          </div>
          <div className="bg-slate-900 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{pattern.failCount}</p>
            <p className="text-sm text-slate-400">Failed</p>
          </div>
          <div className="bg-slate-900 rounded-lg p-4 text-center">
            <p className={`text-2xl font-bold ${parseFloat(successRate) >= 80 ? 'text-green-400' : parseFloat(successRate) >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
              {successRate}%
            </p>
            <p className="text-sm text-slate-400">Success Rate</p>
          </div>
        </div>

        {/* Performance */}
        <div className="bg-slate-900 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-white mb-3">Performance</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Average Duration:</span>
              <span className="text-white ml-2">{pattern.avgDurationMs}ms</span>
            </div>
            <div>
              <span className="text-slate-400">Last Executed:</span>
              <span className="text-white ml-2">
                {pattern.lastExecutedAt ? new Date(pattern.lastExecutedAt).toLocaleString() : 'Never'}
              </span>
            </div>
          </div>
        </div>

        {pattern.lastError && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-red-400 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Last Error</span>
            </div>
            <p className="text-red-300 text-sm">{pattern.lastError}</p>
            {pattern.lastErrorAt && (
              <p className="text-red-400/70 text-xs mt-1">
                at {new Date(pattern.lastErrorAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Code */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-white">Code</h3>
            <button 
              onClick={() => navigator.clipboard.writeText(pattern.code)}
              className="text-sm text-slate-400 hover:text-white flex items-center gap-1"
            >
              <Copy className="w-4 h-4" /> Copy
            </button>
          </div>
          <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
            <pre className="text-sm text-slate-300 font-mono">
              <code>{pattern.code}</code>
            </pre>
          </div>
        </div>

        {/* Test */}
        <div className="border-t border-slate-700 pt-6">
          <h3 className="font-medium text-white mb-3">Test Pattern</h3>
          <div className="mb-4">
            <label className="block text-sm text-slate-400 mb-1">Input (JSON)</label>
            <textarea
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 font-mono text-sm h-24"
              placeholder='{"key": "value"}'
            />
          </div>
          <button
            onClick={() => {
              try {
                const input = JSON.parse(testInput);
                onTest(input);
              } catch {
                alert('Invalid JSON input');
              }
            }}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" /> Run Test
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function IAIInjectionPanel() {
  const queryClient = useQueryClient();
  const [selectedContainer, setSelectedContainer] = useState<InjectionContainer | null>(null);
  const [containerModal, setContainerModal] = useState<{ open: boolean; container: InjectionContainer | null }>({ open: false, container: null });
  const [patternModal, setPatternModal] = useState<{ open: boolean; pattern: InjectionPattern | null }>({ open: false, pattern: null });
  const [patternDetailModal, setPatternDetailModal] = useState<InjectionPattern | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Queries
  const { data: containers = [], isLoading: containersLoading, refetch: refetchContainers } = useQuery({
    queryKey: ['injection-containers'],
    queryFn: fetchContainers,
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery({
    queryKey: ['injection-stats'],
    queryFn: fetchStats,
    refetchInterval: 30000,
  });

  const { data: patterns = [] } = useQuery({
    queryKey: ['injection-patterns', selectedContainer?.id],
    queryFn: () => selectedContainer ? fetchPatterns(selectedContainer.id) : Promise.resolve([]),
    enabled: !!selectedContainer,
  });

  // Mutations
  const createContainerMutation = useMutation({
    mutationFn: createContainer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['injection-containers'] });
      setContainerModal({ open: false, container: null });
    },
  });

  const updateContainerMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InjectionContainer> }) => updateContainer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['injection-containers'] });
      setContainerModal({ open: false, container: null });
    },
  });

  const deleteContainerMutation = useMutation({
    mutationFn: deleteContainer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['injection-containers'] });
      if (selectedContainer) setSelectedContainer(null);
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: setDefaultContainer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['injection-containers'] });
    },
  });

  const createPatternMutation = useMutation({
    mutationFn: createPattern,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['injection-patterns'] });
      setPatternModal({ open: false, pattern: null });
    },
  });

  const updatePatternMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InjectionPattern> }) => updatePattern(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['injection-patterns'] });
      setPatternModal({ open: false, pattern: null });
    },
  });

  const deletePatternMutation = useMutation({
    mutationFn: deletePattern,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['injection-patterns'] });
    },
  });

  const testPatternMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Record<string, any> }) => testPattern(id, input),
    onSuccess: (result) => {
      alert(result.success ? `Success! Output: ${JSON.stringify(result.output)}` : `Failed: ${result.error}`);
      queryClient.invalidateQueries({ queryKey: ['injection-patterns'] });
    },
  });

  // Filter containers
  const filteredContainers = containers.filter((container: InjectionContainer) => {
    const matchesSearch = container.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      container.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || container.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const containerCategories: string[] = containers.map((c: InjectionContainer) => c.category);
  const uniqueCategories: string[] = Array.from(new Set(containerCategories));
  const categories: string[] = ['all', ...uniqueCategories];

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-5 gap-4">
        <StatsCard
          title="Total Containers"
          value={stats?.totalContainers || 0}
          icon={Boxes}
          color="bg-blue-600"
        />
        <StatsCard
          title="Active Containers"
          value={stats?.activeContainers || 0}
          icon={Box}
          color="bg-green-600"
        />
        <StatsCard
          title="Total Patterns"
          value={stats?.totalPatterns || 0}
          icon={Code2}
          color="bg-purple-600"
        />
        <StatsCard
          title="Total Injections"
          value={stats?.totalInjections || 0}
          icon={Zap}
          color="bg-orange-600"
        />
        <StatsCard
          title="Success Rate"
          value={`${stats?.successRate?.toFixed(1) || 0}%`}
          icon={TrendingUp}
          color="bg-emerald-600"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Containers List */}
        <div className="col-span-2">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Boxes className="w-5 h-5 text-blue-400" />
                Injection Containers
              </h2>
              <button
                onClick={() => setContainerModal({ open: true, container: null })}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New Container
              </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 mb-5">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search containers..."
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>
                ))}
              </select>
              <button
                onClick={() => refetchContainers()}
                className="p-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {/* Container Grid */}
            {containersLoading ? (
              <div className="flex items-center justify-center h-48 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                Loading containers...
              </div>
            ) : filteredContainers.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Boxes className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No containers found</p>
                <p className="text-sm">Create your first injection container to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredContainers.map((container: InjectionContainer) => (
                  <ContainerCard
                    key={container.id}
                    container={container}
                    onView={() => setSelectedContainer(container)}
                    onEdit={() => setContainerModal({ open: true, container })}
                    onDelete={() => {
                      if (confirm(`Delete container "${container.name}"?`)) {
                        deleteContainerMutation.mutate(container.id);
                      }
                    }}
                    onSetDefault={() => setDefaultMutation.mutate(container.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Selected Container Patterns */}
        <div className="col-span-1">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 sticky top-6">
            {selectedContainer ? (
              <>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedContainer.name}</h2>
                    <p className="text-slate-400 text-sm">Patterns in container</p>
                  </div>
                  <button
                    onClick={() => setPatternModal({ open: true, pattern: null })}
                    className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Pattern
                  </button>
                </div>

                {patterns.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Code2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No patterns in this container</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {patterns.map((pattern: InjectionPattern) => (
                      <div
                        key={pattern.id}
                        className="bg-slate-900 rounded-lg p-3 cursor-pointer hover:bg-slate-700 transition-colors"
                        onClick={() => setPatternDetailModal(pattern)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-white">{pattern.name}</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); setPatternModal({ open: true, pattern }); }}
                              className="p-1 text-slate-400 hover:text-white"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Delete pattern "${pattern.name}"?`)) {
                                  deletePatternMutation.mutate(pattern.id);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-red-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span>{pattern.executionCount} runs</span>
                          <span className="text-green-400">{pattern.successCount} ✓</span>
                          <span className="text-red-400">{pattern.failCount} ✗</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Select a Container</p>
                <p className="text-sm mt-1">Click on a container to view its patterns</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {containerModal.open && (
        <ContainerModal
          container={containerModal.container}
          onClose={() => setContainerModal({ open: false, container: null })}
          onSave={(data) => {
            if (containerModal.container) {
              updateContainerMutation.mutate({ id: containerModal.container.id, data });
            } else {
              createContainerMutation.mutate(data);
            }
          }}
        />
      )}

      {patternModal.open && selectedContainer && (
        <PatternModal
          pattern={patternModal.pattern}
          containerId={selectedContainer.id}
          onClose={() => setPatternModal({ open: false, pattern: null })}
          onSave={(data) => {
            if (patternModal.pattern) {
              updatePatternMutation.mutate({ id: patternModal.pattern.id, data });
            } else {
              createPatternMutation.mutate(data);
            }
          }}
        />
      )}

      {patternDetailModal && (
        <PatternDetailModal
          pattern={patternDetailModal}
          onClose={() => setPatternDetailModal(null)}
          onTest={(input) => testPatternMutation.mutate({ id: patternDetailModal.id, input })}
        />
      )}
    </div>
  );
}
