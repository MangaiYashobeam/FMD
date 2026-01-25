/**
 * AI Orchestrator Dashboard
 * 
 * Comprehensive dashboard for managing AI models, routing rules,
 * task assignments, and monitoring agent performance
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Brain,
  Settings,
  Zap,
  GitBranch,
  Activity,
  Plus,
  Trash2,
  Edit,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  Layers,
  Target,
  ArrowRight,
  Eye,
  Code,
  MessageSquare,
  Image as ImageIcon,
  Sparkles,
  Shield,
} from 'lucide-react';

interface CopilotModel {
  id: string;
  displayName: string;
  family: string;
  tier: string;
  multiplier: string;
  capabilities: string[];
  contextWindow: number;
  maxOutput: number;
  specializations: string[];
  isPreview: boolean;
  discount?: number;
}

interface RoutingRule {
  id: string;
  name: string;
  description: string;
  priority: number;
  conditions: any[];
  targetModel: string;
  fallbackModel: string;
  enabled: boolean;
  isCustom?: boolean;
}

interface TaskAssignment {
  id: string;
  taskType: string;
  primaryModel: string;
  fallbackModel: string;
  allowedModels: string[];
  assignedBy: string;
  assignmentLevel: string;
  priority: number;
  isDefault?: boolean;
}

interface DashboardData {
  models: {
    total: number;
    byFamily: Record<string, number>;
    byTier: Record<string, number>;
  };
  routing: {
    totalRules: number;
    enabledRules: number;
  };
  assignments: {
    total: number;
    taskTypes: string[];
  };
  sessions: {
    totalSessions: number;
    totalNotes: number;
    totalHandoffs: number;
    activeAssignments: number;
  };
  userRole: string;
}

const TASK_TYPE_ICONS: Record<string, React.ReactNode> = {
  screenshot_analysis: <ImageIcon className="w-4 h-4" />,
  image_recognition: <Eye className="w-4 h-4" />,
  customer_service: <MessageSquare className="w-4 h-4" />,
  code_generation: <Code className="w-4 h-4" />,
  code_review: <Code className="w-4 h-4" />,
  debugging: <AlertCircle className="w-4 h-4" />,
  content_writing: <Edit className="w-4 h-4" />,
  complex_reasoning: <Brain className="w-4 h-4" />,
  browser_automation: <Zap className="w-4 h-4" />,
};

const MODEL_FAMILY_COLORS: Record<string, string> = {
  gpt: 'bg-emerald-500',
  claude: 'bg-orange-500',
  gemini: 'bg-blue-500',
  codex: 'bg-purple-500',
  grok: 'bg-red-500',
  raptor: 'bg-yellow-500',
};

const TIER_BADGES: Record<string, { bg: string; text: string }> = {
  flagship: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  standard: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  preview: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
  economy: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
};

export default function AIOrchestratorPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'models' | 'routing' | 'assignments' | 'preferences'>('overview');
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [showNewRule, setShowNewRule] = useState(false);
  const [showNewAssignment, setShowNewAssignment] = useState(false);
  const queryClient = useQueryClient();

  // Fetch dashboard data
  const { data: dashboard, isLoading: dashboardLoading } = useQuery<{ success: boolean; data: DashboardData }>({
    queryKey: ['ai-orchestrator-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/ai-orchestrator/dashboard', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      return res.json();
    },
    refetchInterval: 30000,
  });

  // Fetch models
  const { data: modelsData } = useQuery<{ success: boolean; data: { models: CopilotModel[]; grouped: Record<string, CopilotModel[]> } }>({
    queryKey: ['ai-orchestrator-models'],
    queryFn: async () => {
      const res = await fetch('/api/ai-orchestrator/models', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      return res.json();
    },
  });

  // Fetch routing rules
  const { data: routingData } = useQuery<{ success: boolean; data: { rules: RoutingRule[] } }>({
    queryKey: ['ai-orchestrator-routing'],
    queryFn: async () => {
      const res = await fetch('/api/ai-orchestrator/routing/rules', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      return res.json();
    },
  });

  // Fetch assignments
  const { data: assignmentsData } = useQuery<{ success: boolean; data: { assignments: TaskAssignment[]; taskTypes: string[] } }>({
    queryKey: ['ai-orchestrator-assignments'],
    queryFn: async () => {
      const res = await fetch('/api/ai-orchestrator/assignments', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      return res.json();
    },
  });

  const models = modelsData?.data?.models || [];
  const groupedModels = modelsData?.data?.grouped || {};
  const rules = routingData?.data?.rules || [];
  const assignments = assignmentsData?.data?.assignments || [];
  const taskTypes = assignmentsData?.data?.taskTypes || [];
  const dashboardStats = dashboard?.data;

  if (dashboardLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-violet-500" />
          <span className="text-gray-600 dark:text-gray-400">Loading AI Orchestrator...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                <Brain className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">AI Orchestrator</h1>
                <p className="text-white/70">Copilot Models • Intelligent Routing • Task Management</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-white/10 rounded-full text-sm backdrop-blur-sm">
                {models.length} Models Available
              </span>
              <span className="px-3 py-1 bg-green-500/20 rounded-full text-sm backdrop-blur-sm flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                System Active
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-6 bg-white/10 p-1 rounded-xl backdrop-blur-sm w-fit">
            {[
              { id: 'overview', label: 'Overview', icon: Activity },
              { id: 'models', label: 'Models', icon: Layers },
              { id: 'routing', label: 'Routing', icon: GitBranch },
              { id: 'assignments', label: 'Assignments', icon: Target },
              { id: 'preferences', label: 'Preferences', icon: Settings },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-violet-600 shadow-lg'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={<Layers className="w-6 h-6" />}
                label="Total Models"
                value={dashboardStats?.models.total || 0}
                color="violet"
                subtext="Across all families"
              />
              <StatCard
                icon={<GitBranch className="w-6 h-6" />}
                label="Active Routing Rules"
                value={dashboardStats?.routing.enabledRules || 0}
                color="blue"
                subtext={`${dashboardStats?.routing.totalRules || 0} total rules`}
              />
              <StatCard
                icon={<Target className="w-6 h-6" />}
                label="Task Assignments"
                value={dashboardStats?.assignments.total || 0}
                color="emerald"
                subtext={`${taskTypes.length} task types`}
              />
              <StatCard
                icon={<Activity className="w-6 h-6" />}
                label="Active Sessions"
                value={dashboardStats?.sessions.totalSessions || 0}
                color="amber"
                subtext={`${dashboardStats?.sessions.totalHandoffs || 0} handoffs`}
              />
            </div>

            {/* Model Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* By Family */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-violet-500" />
                  Models by Family
                </h3>
                <div className="space-y-3">
                  {Object.entries(dashboardStats?.models.byFamily || {}).map(([family, count]) => (
                    <div key={family} className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${MODEL_FAMILY_COLORS[family] || 'bg-gray-400'}`} />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize w-24">{family}</span>
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${MODEL_FAMILY_COLORS[family] || 'bg-gray-400'}`}
                          style={{ width: `${((count as number) / (dashboardStats?.models.total || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400 w-8 text-right">{count as number}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Tier */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  Models by Tier
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(dashboardStats?.models.byTier || {}).map(([tier, count]) => {
                    const badge = TIER_BADGES[tier] || { bg: 'bg-gray-100', text: 'text-gray-600' };
                    return (
                      <div key={tier} className={`${badge.bg} rounded-lg p-4`}>
                        <div className={`text-2xl font-bold ${badge.text}`}>{count as number}</div>
                        <div className={`text-sm capitalize ${badge.text}`}>{tier}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <QuickActionCard
                  icon={<Plus className="w-5 h-5" />}
                  title="Create Routing Rule"
                  description="Add a new intelligent routing rule"
                  onClick={() => { setActiveTab('routing'); setShowNewRule(true); }}
                />
                <QuickActionCard
                  icon={<Target className="w-5 h-5" />}
                  title="Assign Task Model"
                  description="Configure model for specific tasks"
                  onClick={() => { setActiveTab('assignments'); setShowNewAssignment(true); }}
                />
                <QuickActionCard
                  icon={<Shield className="w-5 h-5" />}
                  title="Company Preferences"
                  description="Set company-wide AI policies"
                  onClick={() => setActiveTab('preferences')}
                />
              </div>
            </div>
          </div>
        )}

        {/* Models Tab */}
        {activeTab === 'models' && (
          <div className="space-y-6">
            {/* Family Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSelectedFamily(null)}
                className={`px-4 py-2 rounded-lg transition-all ${
                  !selectedFamily
                    ? 'bg-violet-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                All Models ({models.length})
              </button>
              {Object.entries(groupedModels).map(([family, familyModels]) => (
                <button
                  key={family}
                  onClick={() => setSelectedFamily(family)}
                  className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                    selectedFamily === family
                      ? 'bg-violet-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${MODEL_FAMILY_COLORS[family] || 'bg-gray-400'}`} />
                  <span className="capitalize">{family}</span>
                  <span className="text-xs opacity-60">({(familyModels as CopilotModel[]).length})</span>
                </button>
              ))}
            </div>

            {/* Models Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(selectedFamily ? (groupedModels[selectedFamily] || []) : models).map((model: CopilotModel) => (
                <ModelCard key={model.id} model={model} />
              ))}
            </div>
          </div>
        )}

        {/* Routing Tab */}
        {activeTab === 'routing' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Routing Rules</h2>
              <button
                onClick={() => setShowNewRule(true)}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Rule
              </button>
            </div>

            <div className="space-y-3">
              {rules.map((rule) => (
                <RoutingRuleCard key={rule.id} rule={rule} models={models} />
              ))}
            </div>

            {showNewRule && (
              <NewRoutingRuleModal
                models={models}
                onClose={() => setShowNewRule(false)}
                onCreated={() => {
                  setShowNewRule(false);
                  queryClient.invalidateQueries({ queryKey: ['ai-orchestrator-routing'] });
                }}
              />
            )}
          </div>
        )}

        {/* Assignments Tab */}
        {activeTab === 'assignments' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Task Assignments</h2>
              <button
                onClick={() => setShowNewAssignment(true)}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Assignment
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Task Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Primary Model</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Fallback</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Level</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Priority</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {assignments.map((assignment) => (
                      <TaskAssignmentRow key={assignment.id} assignment={assignment} models={models} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {showNewAssignment && (
              <NewAssignmentModal
                models={models}
                taskTypes={taskTypes}
                onClose={() => setShowNewAssignment(false)}
                onCreated={() => {
                  setShowNewAssignment(false);
                  queryClient.invalidateQueries({ queryKey: ['ai-orchestrator-assignments'] });
                }}
              />
            )}
          </div>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <CompanyPreferencesPanel models={models} />
        )}
      </div>
    </div>
  );
}

// Sub-components

function StatCard({ icon, label, value, color, subtext }: { icon: React.ReactNode; label: string; value: number; color: string; subtext: string }) {
  const colorClasses: Record<string, string> = {
    violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>{icon}</div>
        <div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500">{subtext}</div>
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({ icon, title, description, onClick }: { icon: React.ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-left group"
    >
      <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-lg text-violet-600 dark:text-violet-400 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div>
        <div className="font-medium text-gray-900 dark:text-white">{title}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">{description}</div>
      </div>
      <ArrowRight className="w-5 h-5 text-gray-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

function ModelCard({ model }: { model: CopilotModel }) {
  const badge = TIER_BADGES[model.tier] || { bg: 'bg-gray-100', text: 'text-gray-600' };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${MODEL_FAMILY_COLORS[model.family] || 'bg-gray-400'}`} />
          <span className="font-semibold text-gray-900 dark:text-white">{model.displayName}</span>
        </div>
        <div className="flex items-center gap-2">
          {model.isPreview && (
            <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs rounded-full">
              Preview
            </span>
          )}
          {model.discount && (
            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs rounded-full">
              {model.discount}% off
            </span>
          )}
          <span className={`px-2 py-0.5 rounded-full text-xs ${badge.bg} ${badge.text}`}>
            {model.tier}
          </span>
        </div>
      </div>

      <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        <span className="font-medium text-violet-600 dark:text-violet-400">{model.multiplier}</span> multiplier
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {model.capabilities.slice(0, 4).map((cap) => (
          <span key={cap} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded">
            {cap}
          </span>
        ))}
        {model.capabilities.length > 4 && (
          <span className="px-2 py-0.5 text-gray-400 text-xs">+{model.capabilities.length - 4}</span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-700">
        <span>{(model.contextWindow / 1000).toFixed(0)}K context</span>
        <span>{(model.maxOutput / 1000).toFixed(0)}K output</span>
      </div>
    </div>
  );
}

function RoutingRuleCard({ rule, models }: { rule: RoutingRule; models: CopilotModel[] }) {
  const targetModel = models.find(m => m.id === rule.targetModel);
  const fallbackModel = models.find(m => m.id === rule.fallbackModel);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 border-l-4 ${
      rule.enabled ? 'border-green-500' : 'border-gray-300 dark:border-gray-600'
    }`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900 dark:text-white">{rule.name}</h4>
            {!rule.isCustom && (
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs rounded-full">
                Default
              </span>
            )}
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded">
              Priority: {rule.priority}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{rule.description}</p>
        </div>
        <div className={`w-3 h-3 rounded-full ${rule.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
      </div>

      <div className="flex items-center gap-4 mt-4">
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <span className="text-xs text-gray-500 dark:text-gray-400">Target:</span>
          <div className={`w-2 h-2 rounded-full ${MODEL_FAMILY_COLORS[targetModel?.family || 'gpt']}`} />
          <span className="text-sm font-medium text-gray-900 dark:text-white">{targetModel?.displayName || rule.targetModel}</span>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-400" />
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <span className="text-xs text-gray-500 dark:text-gray-400">Fallback:</span>
          <div className={`w-2 h-2 rounded-full ${MODEL_FAMILY_COLORS[fallbackModel?.family || 'gpt']}`} />
          <span className="text-sm font-medium text-gray-900 dark:text-white">{fallbackModel?.displayName || rule.fallbackModel}</span>
        </div>
      </div>
    </div>
  );
}

function TaskAssignmentRow({ assignment, models }: { assignment: TaskAssignment; models: CopilotModel[] }) {
  const primaryModel = models.find(m => m.id === assignment.primaryModel);
  const fallbackModel = models.find(m => m.id === assignment.fallbackModel);
  const icon = TASK_TYPE_ICONS[assignment.taskType] || <Target className="w-4 h-4" />;

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-violet-100 dark:bg-violet-900/30 rounded text-violet-600 dark:text-violet-400">
            {icon}
          </div>
          <span className="font-medium text-gray-900 dark:text-white capitalize">
            {assignment.taskType.replace(/_/g, ' ')}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${MODEL_FAMILY_COLORS[primaryModel?.family || 'gpt']}`} />
          <span className="text-sm text-gray-700 dark:text-gray-300">{primaryModel?.displayName || assignment.primaryModel}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${MODEL_FAMILY_COLORS[fallbackModel?.family || 'gpt']}`} />
          <span className="text-sm text-gray-500 dark:text-gray-400">{fallbackModel?.displayName || assignment.fallbackModel}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`px-2 py-1 rounded-full text-xs ${
          assignment.assignmentLevel === 'global' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' :
          assignment.assignmentLevel === 'company' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
          'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
        }`}>
          {assignment.assignmentLevel}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{assignment.priority}</td>
      <td className="px-4 py-3">
        {assignment.isDefault ? (
          <span className="text-xs text-gray-400">Default</span>
        ) : (
          <div className="flex items-center gap-2">
            <button className="p-1 text-gray-400 hover:text-blue-500 transition-colors">
              <Edit className="w-4 h-4" />
            </button>
            <button className="p-1 text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function NewRoutingRuleModal({ models, onClose, onCreated }: { models: CopilotModel[]; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(50);
  const [targetModel, setTargetModel] = useState('');
  const [fallbackModel, setFallbackModel] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/ai-orchestrator/routing/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ name, description, priority, targetModel, fallbackModel, enabled: true }),
      });

      if (res.ok) {
        onCreated();
      }
    } catch (error) {
      console.error('Error creating rule:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">New Routing Rule</h3>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rule Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority (1-100)</label>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              min={1}
              max={100}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Model</label>
            <select
              value={targetModel}
              onChange={(e) => setTargetModel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            >
              <option value="">Select a model</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.displayName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fallback Model</label>
            <select
              value={fallbackModel}
              onChange={(e) => setFallbackModel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Same as target</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.displayName}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewAssignmentModal({ models, taskTypes, onClose, onCreated }: { models: CopilotModel[]; taskTypes: string[]; onClose: () => void; onCreated: () => void }) {
  const [taskType, setTaskType] = useState('');
  const [primaryModel, setPrimaryModel] = useState('');
  const [fallbackModel, setFallbackModel] = useState('');
  const [assignmentLevel, setAssignmentLevel] = useState('company');
  const [priority, setPriority] = useState(50);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/ai-orchestrator/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ taskType, primaryModel, fallbackModel, assignmentLevel, priority }),
      });

      if (res.ok) {
        onCreated();
      }
    } catch (error) {
      console.error('Error creating assignment:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">New Task Assignment</h3>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Task Type</label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            >
              <option value="">Select a task type</option>
              {taskTypes.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Primary Model</label>
            <select
              value={primaryModel}
              onChange={(e) => setPrimaryModel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            >
              <option value="">Select a model</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.displayName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fallback Model</label>
            <select
              value={fallbackModel}
              onChange={(e) => setFallbackModel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Same as primary</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.displayName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assignment Level</label>
            <select
              value={assignmentLevel}
              onChange={(e) => setAssignmentLevel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="global">Global (All Users)</option>
              <option value="company">Company</option>
              <option value="team">Team</option>
              <option value="user">User Only</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority (1-100)</label>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              min={1}
              max={100}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CompanyPreferencesPanel({ models }: { models: CopilotModel[] }) {
  const [prefs, setPrefs] = useState({
    defaultModel: '',
    allowedModels: [] as string[],
    blockedModels: [] as string[],
    maxTokensPerRequest: 0,
    maxRequestsPerDay: 0,
    enableVision: true,
    enableCodeGen: true,
    enableAutomation: true,
    customInstructions: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPrefs();
  }, []);

  const fetchPrefs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai-orchestrator/company/preferences', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (data.success && data.data) {
        setPrefs({
          defaultModel: data.data.defaultModel || '',
          allowedModels: data.data.allowedModels || [],
          blockedModels: data.data.blockedModels || [],
          maxTokensPerRequest: data.data.maxTokensPerRequest || 0,
          maxRequestsPerDay: data.data.maxRequestsPerDay || 0,
          enableVision: data.data.enableVision !== false,
          enableCodeGen: data.data.enableCodeGen !== false,
          enableAutomation: data.data.enableAutomation !== false,
          customInstructions: data.data.customInstructions || '',
        });
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePrefs = async () => {
    setSaving(true);
    try {
      await fetch('/api/ai-orchestrator/company/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(prefs),
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <Shield className="w-5 h-5 text-violet-500" />
          Company AI Preferences
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Model</label>
            <select
              value={prefs.defaultModel}
              onChange={(e) => setPrefs({ ...prefs, defaultModel: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Auto (Routing Based)</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.displayName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Tokens per Request</label>
            <input
              type="number"
              value={prefs.maxTokensPerRequest || ''}
              onChange={(e) => setPrefs({ ...prefs, maxTokensPerRequest: Number(e.target.value) })}
              placeholder="0 = unlimited"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Requests per Day</label>
            <input
              type="number"
              value={prefs.maxRequestsPerDay || ''}
              onChange={(e) => setPrefs({ ...prefs, maxRequestsPerDay: Number(e.target.value) })}
              placeholder="0 = unlimited"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Capabilities</label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.enableVision}
                onChange={(e) => setPrefs({ ...prefs, enableVision: e.target.checked })}
                className="w-4 h-4 text-violet-600 rounded"
              />
              <ImageIcon className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Vision/Image Analysis</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.enableCodeGen}
                onChange={(e) => setPrefs({ ...prefs, enableCodeGen: e.target.checked })}
                className="w-4 h-4 text-violet-600 rounded"
              />
              <Code className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Code Generation</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.enableAutomation}
                onChange={(e) => setPrefs({ ...prefs, enableAutomation: e.target.checked })}
                className="w-4 h-4 text-violet-600 rounded"
              />
              <Zap className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Browser Automation</span>
            </label>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Custom Instructions</label>
          <textarea
            value={prefs.customInstructions}
            onChange={(e) => setPrefs({ ...prefs, customInstructions: e.target.value })}
            placeholder="Add custom instructions for all AI interactions..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={savePrefs}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}
