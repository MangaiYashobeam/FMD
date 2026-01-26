/**
 * IAI Mission Control Panel
 * 
 * Comprehensive mission planning and execution management interface.
 * Part of the IAI Command Center.
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Target,
  Plus,
  Edit,
  Trash2,
  Play,
  Pause,
  XCircle,
  Clock,
  Calendar,
  RefreshCw,
  Zap,
  ListChecks,
  Layers,
  Rocket,
  GripVertical,
  Activity,
  TrendingUp,
} from 'lucide-react';
import { api } from '../../lib/api';

// ============================================
// Types
// ============================================

interface Mission {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  priority: number;
  containerId: string | null;
  scheduleType: string | null;
  cronExpression: string | null;
  intervalMinutes: number | null;
  timezone: string;
  startDate: string | null;
  endDate: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  maxConcurrency: number;
  retryPolicy: string;
  maxRetries: number;
  alertOnFailure: boolean;
  alertOnSuccess: boolean;
  abortOnTaskFail: boolean;
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  avgDurationMs: number;
  tags: string[];
  config: Record<string, any>;
  createdAt: string;
  tasks?: MissionTask[];
}

interface MissionTask {
  id: string;
  missionId: string;
  patternId: string | null;
  name: string;
  description: string | null;
  taskType: string;
  order: number;
  config: Record<string, any>;
  input: Record<string, any>;
  timeout: number;
  retryCount: number;
  condition: string | null;
  skipOnCondition: boolean;
  dependsOn: string[];
  isActive: boolean;
}

interface MissionExecution {
  id: string;
  missionId: string;
  status: string;
  triggeredBy: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  tasksTotal: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksSkipped: number;
  error: string | null;
  logs: any[];
}

interface MissionStats {
  totalMissions: number;
  activeMissions: number;
  scheduledMissions: number;
  totalExecutions: number;
  successRate: number;
  avgDuration: number;
  recentExecutions: any[];
}

interface MissionTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  suggestedCron?: string;
  taskTypes: string[];
  config: Record<string, any>;
}

// ============================================
// API Functions
// ============================================

async function fetchMissions(options?: { status?: string; type?: string }) {
  const params = new URLSearchParams();
  if (options?.status) params.append('status', options.status);
  if (options?.type) params.append('type', options.type);
  params.append('includeTasks', 'true');
  const response = await api.get(`/api/mission-control/missions?${params.toString()}`);
  return response.data.missions || [];
}

async function fetchMissionStats(): Promise<MissionStats> {
  const response = await api.get('/api/mission-control/stats');
  return response.data.stats;
}

async function fetchTemplates(): Promise<MissionTemplate[]> {
  const response = await api.get('/api/mission-control/templates');
  return response.data.templates || [];
}

async function fetchMissionExecutions(missionId: string) {
  const response = await api.get(`/api/mission-control/missions/${missionId}/executions`);
  return response.data.executions || [];
}

async function createMission(data: Partial<Mission>) {
  const response = await api.post('/api/mission-control/missions', data);
  return response.data.mission;
}

async function updateMission(id: string, data: Partial<Mission>) {
  const response = await api.put(`/api/mission-control/missions/${id}`, data);
  return response.data.mission;
}

async function deleteMission(id: string) {
  const response = await api.delete(`/api/mission-control/missions/${id}`);
  return response.data;
}

async function executeMission(id: string, input?: Record<string, any>) {
  const response = await api.post(`/api/mission-control/missions/${id}/execute`, { input });
  return response.data.result;
}

async function pauseMission(id: string) {
  const response = await api.post(`/api/mission-control/missions/${id}/pause`);
  return response.data.mission;
}

async function resumeMission(id: string) {
  const response = await api.post(`/api/mission-control/missions/${id}/resume`);
  return response.data.mission;
}

async function addTask(missionId: string, data: Partial<MissionTask>) {
  const response = await api.post(`/api/mission-control/missions/${missionId}/tasks`, data);
  return response.data.task;
}

async function updateTask(taskId: string, data: Partial<MissionTask>) {
  const response = await api.put(`/api/mission-control/tasks/${taskId}`, data);
  return response.data.task;
}

async function deleteTask(taskId: string) {
  const response = await api.delete(`/api/mission-control/tasks/${taskId}`);
  return response.data;
}

async function createFromTemplate(templateId: string, name: string, containerId?: string, cronExpression?: string) {
  const response = await api.post('/api/mission-control/missions/from-template', {
    templateId,
    name,
    containerId,
    cronExpression
  });
  return response.data.mission;
}

// ============================================
// Components
// ============================================

// Stats Card
function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  color,
}: { 
  title: string; 
  value: number | string; 
  subtitle?: string;
  icon: any;
  color: string;
}) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-slate-600 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400 font-medium">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`${color} rounded-xl p-3`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

// Status Badge
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-slate-600 text-slate-200',
    active: 'bg-green-600 text-white',
    paused: 'bg-yellow-600 text-white',
    completed: 'bg-blue-600 text-white',
    archived: 'bg-slate-700 text-slate-300',
    running: 'bg-purple-600 text-white animate-pulse',
    failed: 'bg-red-600 text-white',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] || colors.draft}`}>
      {status}
    </span>
  );
}

// Mission Card
function MissionCard({
  mission,
  onView,
  onEdit,
  onDelete,
  onExecute,
  onPause,
  onResume,
}: {
  mission: Mission;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onExecute: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const successRate = mission.totalRuns > 0 
    ? ((mission.successRuns / mission.totalRuns) * 100).toFixed(1)
    : '0';

  const getTypeIcon = () => {
    switch (mission.type) {
      case 'scheduled': return <Calendar className="w-4 h-4" />;
      case 'event': return <Zap className="w-4 h-4" />;
      default: return <Target className="w-4 h-4" />;
    }
  };

  return (
    <div 
      onClick={onView}
      className="bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-slate-500 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-orange-600 rounded-lg p-2">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white">{mission.name}</h3>
              <StatusBadge status={mission.status} />
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-sm mt-1">
              {getTypeIcon()}
              <span className="capitalize">{mission.type}</span>
              {mission.cronExpression && (
                <span className="text-slate-500">• {mission.cronExpression}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {mission.status === 'active' ? (
            <button 
              onClick={(e) => { e.stopPropagation(); onPause(); }}
              className="p-1.5 rounded-lg bg-slate-700 text-yellow-400 hover:bg-yellow-600 hover:text-white transition-colors"
              title="Pause Mission"
            >
              <Pause className="w-4 h-4" />
            </button>
          ) : mission.status === 'paused' ? (
            <button 
              onClick={(e) => { e.stopPropagation(); onResume(); }}
              className="p-1.5 rounded-lg bg-slate-700 text-green-400 hover:bg-green-600 hover:text-white transition-colors"
              title="Resume Mission"
            >
              <Play className="w-4 h-4" />
            </button>
          ) : null}
          <button 
            onClick={(e) => { e.stopPropagation(); onExecute(); }}
            className="p-1.5 rounded-lg bg-slate-700 text-green-400 hover:bg-green-600 hover:text-white transition-colors"
            title="Execute Now"
          >
            <Rocket className="w-4 h-4" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
            title="Edit Mission"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-red-600 hover:text-white transition-colors"
            title="Delete Mission"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {mission.description && (
        <p className="text-slate-400 text-sm mb-4 line-clamp-2">{mission.description}</p>
      )}

      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="text-center">
          <p className="text-lg font-bold text-white">{mission.tasks?.length || 0}</p>
          <p className="text-xs text-slate-500">Tasks</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-white">{mission.totalRuns}</p>
          <p className="text-xs text-slate-500">Runs</p>
        </div>
        <div className="text-center">
          <p className={`text-lg font-bold ${parseFloat(successRate) >= 80 ? 'text-green-400' : parseFloat(successRate) >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
            {successRate}%
          </p>
          <p className="text-xs text-slate-500">Success</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-white">{(mission.avgDurationMs / 1000).toFixed(1)}s</p>
          <p className="text-xs text-slate-500">Avg Time</p>
        </div>
      </div>

      {mission.nextRunAt && (
        <div className="flex items-center gap-2 text-sm text-slate-400 border-t border-slate-700 pt-3">
          <Clock className="w-4 h-4" />
          Next run: {new Date(mission.nextRunAt).toLocaleString()}
        </div>
      )}

      {mission.lastRunAt && !mission.nextRunAt && (
        <div className="flex items-center gap-2 text-sm text-slate-400 border-t border-slate-700 pt-3">
          <Clock className="w-4 h-4" />
          Last run: {new Date(mission.lastRunAt).toLocaleString()}
        </div>
      )}

      {mission.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-slate-700">
          {mission.tags.slice(0, 4).map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Mission Modal
function MissionModal({
  mission,
  onClose,
  onSave,
}: {
  mission: Mission | null;
  onClose: () => void;
  onSave: (data: Partial<Mission>) => void;
}) {
  const [formData, setFormData] = useState({
    name: mission?.name || '',
    description: mission?.description || '',
    type: mission?.type || 'manual',
    status: mission?.status || 'draft',
    priority: mission?.priority ?? 0,
    scheduleType: mission?.scheduleType || 'cron',
    cronExpression: mission?.cronExpression || '',
    timezone: mission?.timezone || 'UTC',
    maxConcurrency: mission?.maxConcurrency ?? 1,
    retryPolicy: mission?.retryPolicy || 'none',
    maxRetries: mission?.maxRetries ?? 3,
    alertOnFailure: mission?.alertOnFailure ?? true,
    alertOnSuccess: mission?.alertOnSuccess ?? false,
    abortOnTaskFail: mission?.abortOnTaskFail ?? false,
    tags: mission?.tags?.join(', ') || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      cronExpression: formData.type === 'scheduled' ? formData.cronExpression : null,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-6">
          {mission ? 'Edit Mission' : 'Create Mission'}
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
              <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
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
              <label className="block text-sm font-medium text-slate-300 mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="manual">Manual</option>
                <option value="scheduled">Scheduled</option>
                <option value="event">Event-Triggered</option>
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
                max="10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Max Concurrency</label>
              <input
                type="number"
                value={formData.maxConcurrency}
                onChange={(e) => setFormData({ ...formData, maxConcurrency: parseInt(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                min="1"
                max="10"
              />
            </div>
          </div>

          {formData.type === 'scheduled' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Cron Expression</label>
                <input
                  type="text"
                  value={formData.cronExpression}
                  onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  placeholder="0 */4 * * *"
                />
                <p className="text-xs text-slate-500 mt-1">e.g., "0 */4 * * *" = every 4 hours</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Timezone</label>
                <select
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Retry Policy</label>
              <select
                value={formData.retryPolicy}
                onChange={(e) => setFormData({ ...formData, retryPolicy: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="none">No Retry</option>
                <option value="fixed">Fixed Delay</option>
                <option value="exponential">Exponential Backoff</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Max Retries</label>
              <input
                type="number"
                value={formData.maxRetries}
                onChange={(e) => setFormData({ ...formData, maxRetries: parseInt(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                min="0"
                max="10"
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
              placeholder="inventory, sync, automated"
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.alertOnFailure}
                onChange={(e) => setFormData({ ...formData, alertOnFailure: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm text-slate-300">Alert on failure</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.alertOnSuccess}
                onChange={(e) => setFormData({ ...formData, alertOnSuccess: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm text-slate-300">Alert on success</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.abortOnTaskFail}
                onChange={(e) => setFormData({ ...formData, abortOnTaskFail: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm text-slate-300">Abort on task failure</span>
            </label>
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
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              {mission ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Task Modal
function TaskModal({
  task,
  patterns,
  onClose,
  onSave,
}: {
  task: MissionTask | null;
  patterns: any[];
  onClose: () => void;
  onSave: (data: Partial<MissionTask>) => void;
}) {
  const [formData, setFormData] = useState({
    name: task?.name || '',
    description: task?.description || '',
    taskType: task?.taskType || 'pattern',
    patternId: task?.patternId || '',
    timeout: task?.timeout ?? 30000,
    retryCount: task?.retryCount ?? 0,
    condition: task?.condition || '',
    skipOnCondition: task?.skipOnCondition ?? false,
    isActive: task?.isActive ?? true,
    config: JSON.stringify(task?.config || {}, null, 2),
    input: JSON.stringify(task?.input || {}, null, 2),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      onSave({
        ...formData,
        patternId: formData.taskType === 'pattern' ? formData.patternId : null,
        config: JSON.parse(formData.config),
        input: JSON.parse(formData.input),
      });
    } catch {
      alert('Invalid JSON in config or input');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-6">
          {task ? 'Edit Task' : 'Add Task'}
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
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 h-16"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Task Type</label>
              <select
                value={formData.taskType}
                onChange={(e) => setFormData({ ...formData, taskType: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="pattern">Pattern</option>
                <option value="delay">Delay</option>
                <option value="webhook">Webhook</option>
                <option value="condition">Condition</option>
              </select>
            </div>
            {formData.taskType === 'pattern' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Pattern</label>
                <select
                  value={formData.patternId}
                  onChange={(e) => setFormData({ ...formData, patternId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select pattern...</option>
                  {patterns.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Timeout (ms)</label>
              <input
                type="number"
                value={formData.timeout}
                onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                min="1000"
                max="300000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Retry Count</label>
              <input
                type="number"
                value={formData.retryCount}
                onChange={(e) => setFormData({ ...formData, retryCount: parseInt(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                min="0"
                max="5"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Config (JSON)</label>
            <textarea
              value={formData.config}
              onChange={(e) => setFormData({ ...formData, config: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 font-mono text-sm h-20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Input (JSON)</label>
            <textarea
              value={formData.input}
              onChange={(e) => setFormData({ ...formData, input: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 font-mono text-sm h-20"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4"
              id="taskIsActive"
            />
            <label htmlFor="taskIsActive" className="text-sm text-slate-300">Task is active</label>
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
              {task ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Mission Detail Panel
function MissionDetailPanel({
  mission,
  onClose,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: {
  mission: Mission;
  onClose: () => void;
  onAddTask: () => void;
  onEditTask: (task: MissionTask) => void;
  onDeleteTask: (taskId: string) => void;
}) {
  const { data: executions = [] } = useQuery({
    queryKey: ['mission-executions', mission.id],
    queryFn: () => fetchMissionExecutions(mission.id),
    refetchInterval: 10000,
  });

  const successRate = mission.totalRuns > 0 
    ? ((mission.successRuns / mission.totalRuns) * 100).toFixed(1)
    : '0';

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">{mission.name}</h2>
            <StatusBadge status={mission.status} />
          </div>
          <p className="text-slate-400 text-sm">{mission.description}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white">
          <XCircle className="w-6 h-6" />
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-slate-900 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-white">{mission.totalRuns}</p>
          <p className="text-xs text-slate-400">Total Runs</p>
        </div>
        <div className="bg-slate-900 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-green-400">{mission.successRuns}</p>
          <p className="text-xs text-slate-400">Successful</p>
        </div>
        <div className="bg-slate-900 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-red-400">{mission.failedRuns}</p>
          <p className="text-xs text-slate-400">Failed</p>
        </div>
        <div className="bg-slate-900 rounded-lg p-3 text-center">
          <p className={`text-xl font-bold ${parseFloat(successRate) >= 80 ? 'text-green-400' : parseFloat(successRate) >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
            {successRate}%
          </p>
          <p className="text-xs text-slate-400">Success Rate</p>
        </div>
      </div>

      {/* Tasks */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-white flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-blue-400" />
            Tasks ({mission.tasks?.length || 0})
          </h3>
          <button
            onClick={onAddTask}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        </div>

        {mission.tasks && mission.tasks.length > 0 ? (
          <div className="space-y-2">
            {mission.tasks.sort((a, b) => a.order - b.order).map((task, index) => (
              <div
                key={task.id}
                className={`bg-slate-900 rounded-lg p-3 ${!task.isActive ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-slate-500">
                    <GripVertical className="w-4 h-4" />
                    <span className="text-xs font-mono">{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{task.name}</span>
                      <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded">
                        {task.taskType}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-slate-400 text-xs mt-1">{task.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEditTask(task)}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete task "${task.name}"?`)) {
                          onDeleteTask(task.id);
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <ListChecks className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No tasks defined</p>
            <p className="text-xs">Add tasks to build your mission workflow</p>
          </div>
        )}
      </div>

      {/* Recent Executions */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <h3 className="font-medium text-white mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-400" />
          Recent Executions
        </h3>
        {executions.length > 0 ? (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {executions.slice(0, 5).map((exec: MissionExecution) => (
              <div key={exec.id} className="flex items-center justify-between text-sm bg-slate-900 rounded p-2">
                <div className="flex items-center gap-2">
                  <StatusBadge status={exec.status} />
                  <span className="text-slate-400">{new Date(exec.startedAt).toLocaleString()}</span>
                </div>
                <div className="text-slate-400">
                  {exec.durationMs ? `${(exec.durationMs / 1000).toFixed(1)}s` : '-'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 text-sm text-center py-4">No executions yet</p>
        )}
      </div>
    </div>
  );
}

// Template Picker
function TemplatePicker({
  templates,
  onSelect,
  onClose,
}: {
  templates: MissionTemplate[];
  onSelect: (template: MissionTemplate) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Create from Template</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
          {templates.map(template => (
            <div
              key={template.id}
              onClick={() => onSelect(template)}
              className="bg-slate-900 rounded-lg p-4 border border-slate-700 hover:border-orange-500 cursor-pointer transition-colors"
            >
              <h3 className="font-bold text-white mb-2">{template.name}</h3>
              <p className="text-slate-400 text-sm mb-3">{template.description}</p>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded capitalize">
                  {template.type}
                </span>
                {template.suggestedCron && (
                  <span className="text-slate-500 text-xs">{template.suggestedCron}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function IAIMissionControlPanel() {
  const queryClient = useQueryClient();
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [missionModal, setMissionModal] = useState<{ open: boolean; mission: Mission | null }>({ open: false, mission: null });
  const [taskModal, setTaskModal] = useState<{ open: boolean; task: MissionTask | null }>({ open: false, task: null });
  const [showTemplates, setShowTemplates] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Queries
  const { data: missions = [], isLoading: missionsLoading, refetch: refetchMissions } = useQuery({
    queryKey: ['missions', statusFilter, typeFilter],
    queryFn: () => fetchMissions({ 
      status: statusFilter !== 'all' ? statusFilter : undefined,
      type: typeFilter !== 'all' ? typeFilter : undefined 
    }),
    refetchInterval: 15000,
  });

  const { data: stats } = useQuery({
    queryKey: ['mission-stats'],
    queryFn: fetchMissionStats,
    refetchInterval: 30000,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['mission-templates'],
    queryFn: fetchTemplates,
  });

  const { data: allPatterns = [] } = useQuery({
    queryKey: ['all-patterns'],
    queryFn: async () => {
      const res = await api.get('/api/injection/patterns?limit=1000');
      return res.data.patterns || [];
    },
  });

  // Mutations
  const createMissionMutation = useMutation({
    mutationFn: createMission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      setMissionModal({ open: false, mission: null });
    },
  });

  const updateMissionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Mission> }) => updateMission(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      setMissionModal({ open: false, mission: null });
      if (selectedMission) {
        refetchMissions();
      }
    },
  });

  const deleteMissionMutation = useMutation({
    mutationFn: deleteMission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      if (selectedMission) setSelectedMission(null);
    },
  });

  const executeMissionMutation = useMutation({
    mutationFn: (id: string) => executeMission(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      alert(result.success ? 'Mission executed successfully!' : `Mission failed: ${result.error}`);
    },
  });

  const pauseMissionMutation = useMutation({
    mutationFn: pauseMission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
    },
  });

  const resumeMissionMutation = useMutation({
    mutationFn: resumeMission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
    },
  });

  const addTaskMutation = useMutation({
    mutationFn: ({ missionId, data }: { missionId: string; data: Partial<MissionTask> }) => addTask(missionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      setTaskModal({ open: false, task: null });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: Partial<MissionTask> }) => updateTask(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      setTaskModal({ open: false, task: null });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
    },
  });

  const createFromTemplateMutation = useMutation({
    mutationFn: ({ templateId, name }: { templateId: string; name: string }) => createFromTemplate(templateId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      setShowTemplates(false);
    },
  });

  // Update selected mission when missions change
  useEffect(() => {
    if (selectedMission) {
      const updated = missions.find((m: Mission) => m.id === selectedMission.id);
      if (updated) setSelectedMission(updated);
    }
  }, [missions]);

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-5 gap-4">
        <StatsCard
          title="Total Missions"
          value={stats?.totalMissions || 0}
          icon={Target}
          color="bg-orange-600"
        />
        <StatsCard
          title="Active Missions"
          value={stats?.activeMissions || 0}
          icon={Rocket}
          color="bg-green-600"
        />
        <StatsCard
          title="Scheduled"
          value={stats?.scheduledMissions || 0}
          icon={Calendar}
          color="bg-blue-600"
        />
        <StatsCard
          title="Executions"
          value={stats?.totalExecutions || 0}
          icon={Zap}
          color="bg-purple-600"
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
        {/* Missions List */}
        <div className={selectedMission ? 'col-span-2' : 'col-span-3'}>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-orange-400" />
                Missions
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTemplates(true)}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors flex items-center gap-2"
                >
                  <Layers className="w-4 h-4" />
                  From Template
                </button>
                <button
                  onClick={() => setMissionModal({ open: true, mission: null })}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Mission
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 mb-5">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Types</option>
                <option value="manual">Manual</option>
                <option value="scheduled">Scheduled</option>
                <option value="event">Event-Triggered</option>
              </select>
              <button
                onClick={() => refetchMissions()}
                className="p-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {/* Missions Grid */}
            {missionsLoading ? (
              <div className="flex items-center justify-center h-48 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                Loading missions...
              </div>
            ) : missions.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No missions found</p>
                <p className="text-sm">Create your first mission or use a template</p>
              </div>
            ) : (
              <div className={`grid ${selectedMission ? 'grid-cols-1' : 'grid-cols-3'} gap-4`}>
                {missions.map((mission: Mission) => (
                  <MissionCard
                    key={mission.id}
                    mission={mission}
                    onView={() => setSelectedMission(mission)}
                    onEdit={() => setMissionModal({ open: true, mission })}
                    onDelete={() => {
                      if (confirm(`Delete mission "${mission.name}"?`)) {
                        deleteMissionMutation.mutate(mission.id);
                      }
                    }}
                    onExecute={() => {
                      if (confirm(`Execute mission "${mission.name}" now?`)) {
                        executeMissionMutation.mutate(mission.id);
                      }
                    }}
                    onPause={() => pauseMissionMutation.mutate(mission.id)}
                    onResume={() => resumeMissionMutation.mutate(mission.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mission Detail */}
        {selectedMission && (
          <div className="col-span-1">
            <MissionDetailPanel
              mission={selectedMission}
              onClose={() => setSelectedMission(null)}
              onAddTask={() => setTaskModal({ open: true, task: null })}
              onEditTask={(task) => setTaskModal({ open: true, task })}
              onDeleteTask={(taskId) => deleteTaskMutation.mutate(taskId)}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {missionModal.open && (
        <MissionModal
          mission={missionModal.mission}
          onClose={() => setMissionModal({ open: false, mission: null })}
          onSave={(data) => {
            if (missionModal.mission) {
              updateMissionMutation.mutate({ id: missionModal.mission.id, data });
            } else {
              createMissionMutation.mutate(data);
            }
          }}
        />
      )}

      {taskModal.open && selectedMission && (
        <TaskModal
          task={taskModal.task}
          patterns={allPatterns}
          onClose={() => setTaskModal({ open: false, task: null })}
          onSave={(data) => {
            if (taskModal.task) {
              updateTaskMutation.mutate({ taskId: taskModal.task.id, data });
            } else {
              addTaskMutation.mutate({ missionId: selectedMission.id, data });
            }
          }}
        />
      )}

      {showTemplates && (
        <TemplatePicker
          templates={templates}
          onSelect={(template) => {
            const name = prompt(`Enter name for mission based on "${template.name}":`);
            if (name) {
              createFromTemplateMutation.mutate({ templateId: template.id, name });
            }
          }}
          onClose={() => setShowTemplates(false)}
        />
      )}
    </div>
  );
}
