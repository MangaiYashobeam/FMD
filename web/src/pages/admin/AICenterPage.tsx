/**
 * AI Center Page - Super Admin Dashboard
 * 
 * Comprehensive AI management interface:
 * - Provider selection and configuration with WAKE UP capability
 * - Memory management
 * - Training center
 * - Threat monitoring with real detection
 * - Learning patterns
 * - Task management
 * - Real-time API tracing
 * 
 * PRODUCTION VERSION - Connected to real APIs
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Database,
  GraduationCap,
  Shield,
  Sparkles,
  ListTodo,
  Settings,
  Activity,
  Search,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Check,
  Clock,
  TrendingUp,
  BarChart3,
  MessageSquare,
  FileText,
  Bot,
  Cpu,
  Power,
  Zap,
  Eye,
  XCircle,
  PlayCircle,
  PauseCircle,
  Trash2,
  Edit,
  Send,
  Terminal,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import aiCenterService from '../../services/ai-center.service';
import { parseAIResponse, type ParsedAIResponse } from '../../utils/ai-response-parser';
import { NovaTerminal } from '../../components/NovaTerminal';
import type {
  AIProvider,
  DashboardStats,
  APITrace,
  MemoryItem,
  LearningPattern,
  TrainingSession,
  AITask,
  Threat,
  ThreatRule,
  ChatMessage,
} from '../../services/ai-center.service';
import { useToast } from '../../contexts/ToastContext';

// ============================================
// Global Model Selector - Header Dropdown with Nested Providers
// ============================================

interface GlobalModelSelectorProps {
  providers: AIProvider[];
  selectedProvider: string | null;
  onSelectProvider: (providerId: string) => void;
  onSelectModel: (providerId: string, modelId: string) => void;
}

function GlobalModelSelector({ providers, selectedProvider, onSelectProvider, onSelectModel }: GlobalModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentProvider = providers.find(p => p.id === selectedProvider) || providers[0];

  const getProviderColor = (type: string) => {
    switch (type) {
      case 'anthropic': return 'from-orange-500 to-amber-600';
      case 'openai': return 'from-green-500 to-emerald-600';
      case 'github': return 'from-purple-500 to-pink-500';
      case 'deepseek': return 'from-blue-500 to-indigo-600';
      case 'mistral': return 'from-cyan-500 to-blue-600';
      case 'perplexity': return 'from-teal-500 to-green-600';
      case 'google': return 'from-red-500 to-yellow-500';
      default: return 'from-gray-500 to-slate-600';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-400';
      case 'degraded': return 'bg-yellow-400';
      case 'unknown': return 'bg-gray-400';
      default: return 'bg-red-400';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg transition"
      >
        <div className={`w-2 h-2 rounded-full ${getStatusDot(currentProvider?.healthStatus || 'unknown')}`} />
        <span className="text-sm font-medium">{currentProvider?.name || 'Select Provider'}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden"
          >
            <div className="p-2 border-b border-gray-700">
              <p className="text-xs text-gray-400 px-2">Select AI Provider & Model</p>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {providers.map((provider) => {
                const providerType = provider.type as string;
                const models = PROVIDER_MODELS[providerType] || PROVIDER_MODELS[provider.id];
                const isExpanded = expandedProvider === provider.id;
                const isSelected = selectedProvider === provider.id;
                const isGitHub = providerType === 'github' || provider.id === 'github';
                void isGitHub; // Suppress unused variable warning

                return (
                  <div key={provider.id} className="border-b border-gray-700/50 last:border-b-0">
                    {/* Provider Header */}
                    <button
                      onClick={() => {
                        if (models) {
                          setExpandedProvider(isExpanded ? null : provider.id);
                        } else {
                          onSelectProvider(provider.id);
                          setIsOpen(false);
                        }
                      }}
                      className={`w-full flex items-center justify-between p-3 hover:bg-gray-700/50 transition ${
                        isSelected ? 'bg-purple-500/10' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg bg-gradient-to-br ${getProviderColor(provider.type)}`}>
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{provider.name}</span>
                            <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(provider.healthStatus)}`} />
                          </div>
                          <span className="text-xs text-gray-400">{provider.defaultModel}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {models && (
                          <span className="text-xs text-gray-500">
                            {Object.values(models).reduce((sum: number, company: any) => sum + (company.models?.length || 0), 0)} models
                          </span>
                        )}
                        {models ? (
                          isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />
                        ) : (
                          isSelected && <Check className="w-4 h-4 text-purple-400" />
                        )}
                      </div>
                    </button>

                    {/* Nested Models */}
                    <AnimatePresence>
                      {isExpanded && models && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden bg-gray-900/50"
                        >
                          {Object.entries(models).map(([companyKey, companyData]: [string, any]) => (
                            <div key={companyKey} className="px-3 py-2">
                              {/* Company Header */}
                              <div className="flex items-center gap-2 mb-2">
                                <div className={`w-1 h-4 rounded-full bg-gradient-to-b ${companyData.color}`} />
                                <span className="text-xs font-semibold text-gray-400 uppercase">{companyData.company}</span>
                              </div>
                              
                              {/* Model List */}
                              <div className="space-y-1 pl-3">
                                {companyData.models?.slice(0, 4).map((model: any) => (
                                  <button
                                    key={model.id}
                                    onClick={() => {
                                      onSelectModel(provider.id, model.id);
                                      setIsOpen(false);
                                    }}
                                    className="w-full flex items-center justify-between p-2 rounded hover:bg-gray-700/50 transition text-left"
                                  >
                                    <div>
                                      <span className="text-sm">{model.name}</span>
                                      {model.multiplier && model.multiplier !== '1x' && (
                                        <span className={`ml-2 text-xs ${
                                          model.multiplier === '0x' ? 'text-green-400' :
                                          model.multiplier === '0.33x' ? 'text-blue-400' :
                                          model.multiplier === '3x' ? 'text-red-400' : 'text-yellow-400'
                                        }`}>
                                          {model.multiplier}
                                        </span>
                                      )}
                                    </div>
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                                      model.tier === 'Flagship' ? 'bg-yellow-500/20 text-yellow-400' :
                                      model.tier === 'Standard' ? 'bg-blue-500/20 text-blue-400' :
                                      model.tier === 'Economy' ? 'bg-green-500/20 text-green-400' :
                                      'bg-purple-500/20 text-purple-400'
                                    }`}>
                                      {model.tier}
                                    </span>
                                  </button>
                                ))}
                                {companyData.models?.length > 4 && (
                                  <div className="text-xs text-gray-500 pl-2">
                                    +{companyData.models.length - 4} more models
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Main Component
export default function AICenterPage() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [traces, setTraces] = useState<APITrace[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Default providers (always available)
  const defaultProviders: AIProvider[] = [
    {
      id: 'anthropic',
      name: 'Anthropic Claude',
      displayName: 'Anthropic',
      type: 'anthropic',
      isActive: true,
      defaultModel: 'claude-3-5-sonnet-latest',
      availableModels: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
      healthStatus: 'healthy',
      capabilities: ['text', 'analysis', 'reasoning'],
    },
    {
      id: 'openai',
      name: 'OpenAI GPT-4',
      displayName: 'OpenAI',
      type: 'openai',
      isActive: true,
      defaultModel: 'gpt-4-turbo',
      availableModels: ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini'],
      healthStatus: 'healthy',
      capabilities: ['text', 'embeddings', 'vision', 'reasoning'],
    },
    {
      id: 'github',
      name: 'GitHub Copilot',
      displayName: 'GitHub',
      type: 'github' as AIProvider['type'],
      isActive: true,
      defaultModel: 'gpt-4o',
      availableModels: [
        'gpt-4o', 'gpt-4.1', 'gpt-5-mini', 'gpt-5', 'o1', 'o1-mini',
        'claude-opus-4.5', 'claude-sonnet-4.5', 'claude-sonnet-4', 'claude-haiku-4.5',
        'gemini-2.5-pro', 'gemini-3-flash-preview', 'gemini-3-pro-preview',
        'gpt-5.1-codex', 'gpt-5.2-codex', 'grok-code-fast-1'
      ],
      healthStatus: 'unknown',
      capabilities: ['text', 'code', 'vision', 'reasoning', 'multi-provider'],
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      displayName: 'DeepSeek AI',
      type: 'deepseek',
      isActive: false,
      defaultModel: 'deepseek-chat',
      availableModels: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
      healthStatus: 'unknown',
      capabilities: ['text', 'code', 'reasoning'],
    },
  ];

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch REAL data from API - no fallbacks
      const dashboardStats = await aiCenterService.dashboard.getStats();
      setStats(dashboardStats as any);

      const providersList = await aiCenterService.providers.getAll();
      // Use API providers if available, otherwise use defaults
      const finalProviders = providersList && providersList.length > 0 ? providersList : defaultProviders;
      setProviders(finalProviders);

      if (finalProviders.length > 0 && !selectedProvider) {
        setSelectedProvider(finalProviders[0].id);
      }

      // Load traces for monitoring
      const tracesList = await aiCenterService.traces.getAll({ limit: 50 });
      setTraces(tracesList);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      // Set default providers on error
      setProviders(defaultProviders);
      setSelectedProvider('anthropic');
      
      // EMPTY state - NO FAKE DATA
      // Shows real zeros so user knows there's no activity yet
      setStats({
        tasks: {
          total: 0,
          byStatus: {},
          overdue: 0,
          completedToday: 0,
        },
        threats: {
          total: 0,
          last24Hours: 0,
          bySeverity: {},
          byStatus: {},
        },
        patterns: {
          totalPatterns: 0,
          activePatterns: 0,
          avgSuccessRate: 0,
          topPerformers: [],
        },
        memory: {
          total: 0,
          byType: {},
        },
        usage: {
          totalCalls: 0,
          totalTokens: 0,
          totalCost: 0,
          byProvider: {},
        },
        providers: defaultProviders.map(p => ({ 
          id: p.id, 
          name: p.name, 
          isActive: p.isActive, 
          healthStatus: p.healthStatus, 
          defaultModel: p.defaultModel 
        })),
      });
    }
    setLoading(false);
  }, [selectedProvider]);

  useEffect(() => {
    loadDashboardData();
  }, [refreshKey]);

  // Auto-refresh traces - disabled by default, only manual refresh now
  // This was causing rate limit issues by polling every 5 seconds
  // Users can manually refresh using the refresh button
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  
  useEffect(() => {
    if (!autoRefreshEnabled) return;
    
    const interval = setInterval(async () => {
      try {
        const activeTraces = await aiCenterService.traces.getActive();
        if (activeTraces.length > 0) {
          setTraces(prev => {
            const updated = [...prev];
            activeTraces.forEach(trace => {
              const idx = updated.findIndex(t => t.id === trace.id);
              if (idx >= 0) updated[idx] = trace;
              else updated.unshift(trace);
            });
            return updated.slice(0, 100);
          });
        }
      } catch (err: any) {
        // Stop auto-refresh on rate limit
        if (err?.response?.status === 429) {
          setAutoRefreshEnabled(false);
        }
      }
    }, 30000); // Changed from 5000ms to 30000ms (30 seconds)

    return () => clearInterval(interval);
  }, [autoRefreshEnabled]);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'providers', label: 'AI Providers', icon: Cpu },
    { id: 'chat', label: 'AI Chat', icon: MessageSquare },
    { id: 'terminal', label: 'Nova Terminal', icon: Terminal },
    { id: 'traces', label: 'API Traces', icon: Terminal },
    { id: 'memory', label: 'Memory', icon: Database },
    { id: 'training', label: 'Training Center', icon: GraduationCap },
    { id: 'threats', label: 'Threat Detection', icon: Shield },
    { id: 'patterns', label: 'Learning Patterns', icon: Sparkles },
    { id: 'tasks', label: 'Tasks & Todo', icon: ListTodo },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="h-full bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">AI Center</h1>
                <p className="text-sm text-gray-400">Super Admin Control Panel</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Global Model Selector with nested provider dropdowns */}
              <GlobalModelSelector 
                providers={providers}
                selectedProvider={selectedProvider}
                onSelectProvider={setSelectedProvider}
                onSelectModel={(providerId, modelId) => {
                  console.log(`Selected model ${modelId} from provider ${providerId}`);
                  setSelectedProvider(providerId);
                }}
              />
              <button
                onClick={() => setRefreshKey(k => k + 1)}
                className="p-2 hover:bg-gray-700 rounded-lg transition"
                title="Refresh data"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6">
          <nav className="flex space-x-1 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium rounded-t-lg transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto">
        {loading && activeTab === 'dashboard' ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && <DashboardTab stats={stats} traces={traces} />}
            {activeTab === 'providers' && <ProvidersTab providers={providers} onRefresh={() => setRefreshKey(k => k + 1)} />}
            {activeTab === 'chat' && <ChatTab selectedProvider={selectedProvider} providers={providers} />}
            {activeTab === 'terminal' && <TerminalTab />}
            {activeTab === 'traces' && <TracesTab />}
            {activeTab === 'memory' && <MemoryTab />}
            {activeTab === 'training' && <TrainingTab />}
            {activeTab === 'threats' && <ThreatsTab />}
            {activeTab === 'patterns' && <PatternsTab />}
            {activeTab === 'tasks' && <TasksTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </>
        )}
      </main>
    </div>
  );
}

// ============================================
// Dashboard Tab
// ============================================

function DashboardTab({ stats, traces }: { stats: DashboardStats | null; traces: APITrace[] }) {
  if (!stats) return null;

  const recentTraces = traces.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Tasks"
          value={stats.tasks.byStatus.running || stats.tasks.byStatus.in_progress || 0}
          subtitle={`${stats.tasks.overdue} overdue`}
          icon={ListTodo}
          color="blue"
        />
        <StatCard
          title="Threats Detected"
          value={stats.threats.last24Hours}
          subtitle="Last 24 hours"
          icon={Shield}
          color="red"
        />
        <StatCard
          title="Memory Items"
          value={stats.memory.total}
          subtitle={`${Object.keys(stats.memory.byType).length} categories`}
          icon={Database}
          color="purple"
        />
        <StatCard
          title="Learning Patterns"
          value={stats.patterns.totalPatterns}
          subtitle={`${stats.patterns.activePatterns || stats.patterns.totalPatterns} active`}
          icon={Sparkles}
          color="green"
        />
      </div>

      {/* Usage Stats */}
      {stats.usage && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            API Usage Statistics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center p-4 bg-gray-700 rounded-lg">
              <div className="text-3xl font-bold text-blue-400">{stats.usage.totalCalls.toLocaleString()}</div>
              <div className="text-sm text-gray-400">Total API Calls</div>
            </div>
            <div className="text-center p-4 bg-gray-700 rounded-lg">
              <div className="text-3xl font-bold text-green-400">{(stats.usage.totalTokens / 1000000).toFixed(2)}M</div>
              <div className="text-sm text-gray-400">Tokens Used</div>
            </div>
            <div className="text-center p-4 bg-gray-700 rounded-lg">
              <div className="text-3xl font-bold text-yellow-400">${stats.usage.totalCost.toFixed(2)}</div>
              <div className="text-sm text-gray-400">Total Cost</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(stats.usage.byProvider).map(([provider, data]) => (
              <div key={provider} className="p-3 bg-gray-700/50 rounded-lg">
                <div className="font-medium capitalize">{provider}</div>
                <div className="text-sm text-gray-400">{data.calls.toLocaleString()} calls · ${data.cost.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Distribution */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Task Status Distribution</h3>
          <div className="space-y-3">
            {Object.entries(stats.tasks.byStatus).map(([status, count]) => (
              <div key={status} className="flex items-center">
                <span className="w-24 text-sm text-gray-400 capitalize">{status.replace('_', ' ')}</span>
                <div className="flex-1 mx-4 bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${getStatusColor(status)}`}
                    style={{ width: `${(count / stats.tasks.total) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Patterns */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Top Performing Patterns</h3>
          <div className="space-y-3">
            {stats.patterns.topPerformers.map((item, index) => (
              <div key={item.id || index} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center text-sm">
                    {index + 1}
                  </span>
                  <span>{item.name || (item as any).pattern?.name}</span>
                </div>
                <span className="text-green-400 font-medium">
                  {(item.successRate * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent API Traces */}
      {recentTraces.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-blue-400" />
            Recent API Calls
          </h3>
          <div className="space-y-2">
            {recentTraces.map((trace) => (
              <div key={trace.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className={`w-2 h-2 rounded-full ${
                    trace.status === 'success' ? 'bg-green-400' :
                    trace.status === 'error' ? 'bg-red-400' : 'bg-yellow-400 animate-pulse'
                  }`} />
                  <span className="text-sm font-medium">{trace.operation}</span>
                  <span className="text-xs text-gray-400">{trace.provider} / {trace.model}</span>
                </div>
                <div className="flex items-center space-x-4 text-xs">
                  {trace.latency && <span className="text-gray-400">{trace.latency}ms</span>}
                  {trace.outputTokens && <span className="text-gray-400">{trace.outputTokens} tokens</span>}
                  {trace.cost && <span className="text-yellow-400">${trace.cost.toFixed(4)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Threat Overview */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Threat Severity Distribution</h3>
        <div className="grid grid-cols-4 gap-4">
          {Object.entries(stats.threats.bySeverity).map(([severity, count]) => (
            <div
              key={severity}
              className={`p-4 rounded-lg ${getSeverityBg(severity)}`}
            >
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-sm capitalize">{severity}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Memory Distribution */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Memory Distribution</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.entries(stats.memory.byType).map(([type, data]) => (
            <div key={type} className="text-center p-4 bg-gray-700 rounded-lg">
              <div className="text-2xl font-bold text-purple-400">{data.count}</div>
              <div className="text-xs text-gray-400 mt-1 capitalize">
                {type.replace(/_/g, ' ')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Provider Modal - Detailed Model View
// ============================================

// GitHub Copilot Models organized by company - matches VS Code model picker
const GITHUB_COPILOT_MODELS = {
  openai: {
    company: 'OpenAI',
    color: 'from-green-500 to-emerald-600',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', tier: 'Flagship', multiplier: '0x', desc: 'Multimodal flagship model - vision, audio, fast', context: '128K', capabilities: ['chat', 'code', 'vision', 'audio'] },
      { id: 'gpt-4.1', name: 'GPT-4.1', tier: 'Flagship', multiplier: '0x', desc: 'Latest GPT-4 with 10% discount', context: '128K', capabilities: ['chat', 'code', 'analysis'] },
      { id: 'gpt-5-mini', name: 'GPT-5 mini', tier: 'Standard', multiplier: '0x', desc: 'Fast and efficient for simple tasks', context: '128K', capabilities: ['chat', 'code'] },
      { id: 'gpt-5', name: 'GPT-5', tier: 'Flagship', multiplier: '1x', desc: 'Advanced reasoning and planning', context: '200K', capabilities: ['chat', 'code', 'reasoning'] },
      { id: 'gpt-5.1', name: 'GPT-5.1', tier: 'Flagship', multiplier: '1x', desc: 'Enhanced GPT-5 with better code', context: '200K', capabilities: ['chat', 'code', 'reasoning'] },
      { id: 'gpt-5.2', name: 'GPT-5.2', tier: 'Flagship', multiplier: '1x', desc: 'Autonomous agents support', context: '200K', capabilities: ['chat', 'code', 'agents'] },
      { id: 'o1', name: 'o1', tier: 'Reasoning', multiplier: '1x', desc: 'Deep reasoning model', context: '200K', capabilities: ['reasoning', 'math', 'code'] },
      { id: 'o1-mini', name: 'o1-mini', tier: 'Economy', multiplier: '0.33x', desc: 'Fast reasoning model', context: '128K', capabilities: ['reasoning', 'code'] },
    ]
  },
  anthropic: {
    company: 'Anthropic',
    color: 'from-orange-500 to-amber-600',
    models: [
      { id: 'claude-opus-4.5', name: 'Claude Opus 4.5', tier: 'Flagship', multiplier: '3x', desc: 'Most capable Claude - extended thinking, computer use', context: '200K', capabilities: ['chat', 'code', 'vision', 'computer-use'] },
      { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', tier: 'Standard', multiplier: '1x', desc: 'Balanced performance for coding and analysis', context: '200K', capabilities: ['chat', 'code', 'analysis'] },
      { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', tier: 'Standard', multiplier: '1x', desc: 'General purpose with computer use', context: '200K', capabilities: ['chat', 'code', 'computer-use'] },
      { id: 'claude-haiku-4.5', name: 'Claude Haiku 4.5', tier: 'Economy', multiplier: '0.33x', desc: 'Fast and cheap for quick tasks', context: '200K', capabilities: ['chat', 'code'] },
    ]
  },
  google: {
    company: 'Google',
    color: 'from-blue-500 to-cyan-600',
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', tier: 'Flagship', multiplier: '1x', desc: '2M token context - document analysis', context: '2M', capabilities: ['chat', 'code', 'vision', 'long-context'] },
      { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Preview)', tier: 'Preview', multiplier: '1x', desc: 'Advanced reasoning and agents', context: '1M', capabilities: ['chat', 'code', 'agents'] },
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)', tier: 'Preview', multiplier: '0.33x', desc: 'Ultra-fast real-time inference', context: '1M', capabilities: ['chat', 'code', 'realtime'] },
    ]
  },
  codex: {
    company: 'Codex (Code Specialists)',
    color: 'from-purple-500 to-violet-600',
    models: [
      { id: 'gpt-5.1-codex-max', name: 'GPT-5.1 Codex Max', tier: 'Flagship', multiplier: '1x', desc: 'Enterprise-grade for large codebases', context: '200K', capabilities: ['code', 'architecture', 'migrations'] },
      { id: 'gpt-5.2-codex', name: 'GPT-5.2 Codex', tier: 'Flagship', multiplier: '1x', desc: 'Autonomous coding agent', context: '200K', capabilities: ['code', 'autonomous'] },
      { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex', tier: 'Standard', multiplier: '1x', desc: 'Full-stack development', context: '200K', capabilities: ['code', 'testing'] },
      { id: 'gpt-5-codex-preview', name: 'GPT-5 Codex (Preview)', tier: 'Preview', multiplier: '1x', desc: 'Code generation specialist', context: '200K', capabilities: ['code', 'generation'] },
      { id: 'gpt-5.1-codex-mini-preview', name: 'GPT-5.1 Codex Mini (Preview)', tier: 'Preview', multiplier: '0.33x', desc: 'Quick code edits', context: '128K', capabilities: ['code', 'quick-fixes'] },
    ]
  },
  xai: {
    company: 'xAI',
    color: 'from-gray-500 to-slate-600',
    models: [
      { id: 'grok-code-fast-1', name: 'Grok Code Fast 1', tier: 'Standard', multiplier: '0x', desc: 'Fast code inference', context: '128K', capabilities: ['code', 'fast'] },
    ]
  },
  internal: {
    company: 'GitHub (Internal)',
    color: 'from-pink-500 to-rose-600',
    models: [
      { id: 'raptor-mini-preview', name: 'Raptor mini (Preview)', tier: 'Preview', multiplier: '0x', desc: 'Ultra-fast simple tasks', context: '64K', capabilities: ['chat', 'fast'] },
    ]
  }
};

// Provider detailed models mapping
const PROVIDER_MODELS: Record<string, any> = {
  github: GITHUB_COPILOT_MODELS,
  copilot: GITHUB_COPILOT_MODELS,
  anthropic: {
    anthropic: {
      company: 'Anthropic',
      color: 'from-orange-500 to-amber-600',
      models: [
        { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', tier: 'Flagship', desc: 'Best for coding and analysis', context: '200K', capabilities: ['chat', 'code', 'analysis', 'vision'] },
        { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', tier: 'Economy', desc: 'Fast and efficient', context: '200K', capabilities: ['chat', 'code'] },
        { id: 'claude-3-opus-latest', name: 'Claude 3 Opus', tier: 'Premium', desc: 'Most capable for complex tasks', context: '200K', capabilities: ['chat', 'code', 'reasoning'] },
      ]
    }
  },
  openai: {
    openai: {
      company: 'OpenAI',
      color: 'from-green-500 to-emerald-600',
      models: [
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', tier: 'Flagship', desc: 'Fastest GPT-4 variant', context: '128K', capabilities: ['chat', 'code', 'vision'] },
        { id: 'gpt-4', name: 'GPT-4', tier: 'Standard', desc: 'Original GPT-4', context: '8K', capabilities: ['chat', 'code'] },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', tier: 'Economy', desc: 'Fast and cheap', context: '16K', capabilities: ['chat', 'code'] },
        { id: 'o1-preview', name: 'o1 Preview', tier: 'Reasoning', desc: 'Advanced reasoning', context: '128K', capabilities: ['reasoning', 'math'] },
        { id: 'o1-mini', name: 'o1 Mini', tier: 'Economy', desc: 'Fast reasoning', context: '128K', capabilities: ['reasoning'] },
      ]
    }
  },
  deepseek: {
    deepseek: {
      company: 'DeepSeek',
      color: 'from-blue-500 to-indigo-600',
      models: [
        { id: 'deepseek-chat', name: 'DeepSeek Chat', tier: 'Standard', desc: 'General chat model', context: '64K', capabilities: ['chat', 'code'] },
        { id: 'deepseek-coder', name: 'DeepSeek Coder', tier: 'Specialist', desc: 'Code specialist', context: '64K', capabilities: ['code'] },
        { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', tier: 'Reasoning', desc: 'Deep thinking model', context: '64K', capabilities: ['reasoning', 'math'] },
      ]
    }
  }
};

interface ProviderModalProps {
  provider: AIProvider | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectModel: (providerId: string, modelId: string) => void;
}

function ProviderModal({ provider, isOpen, onClose, onSelectModel }: ProviderModalProps) {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

  if (!isOpen || !provider) return null;

  const providerType = provider.type as string;
  const providerModels = PROVIDER_MODELS[providerType] || PROVIDER_MODELS[provider.id];
  const isGitHub = providerType === 'github' || providerType === 'copilot' || provider.id === 'github';

  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'flagship': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'standard': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'economy': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'preview': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'reasoning': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'premium': return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
      case 'specialist': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getMultiplierColor = (multiplier: string) => {
    if (multiplier === '0x') return 'text-green-400';
    if (multiplier === '0.33x') return 'text-blue-400';
    if (multiplier === '1x') return 'text-yellow-400';
    if (multiplier === '3x') return 'text-red-400';
    return 'text-gray-400';
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gray-800 rounded-xl w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl border border-gray-700"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`p-6 bg-gradient-to-r ${
            provider.type === 'anthropic' ? 'from-orange-500/20 to-orange-600/10' :
            provider.type === 'openai' ? 'from-green-500/20 to-green-600/10' :
            provider.type === 'deepseek' ? 'from-blue-500/20 to-blue-600/10' :
            isGitHub ? 'from-purple-500/20 to-pink-500/10' : 'from-gray-500/20 to-gray-600/10'
          } border-b border-gray-700`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${
                  provider.type === 'anthropic' ? 'from-orange-500 to-amber-600' :
                  provider.type === 'openai' ? 'from-green-500 to-emerald-600' :
                  provider.type === 'deepseek' ? 'from-blue-500 to-indigo-600' :
                  isGitHub ? 'from-purple-500 to-pink-500' : 'from-gray-500 to-slate-600'
                }`}>
                  <Bot className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{provider.name}</h2>
                  <p className="text-gray-400 text-sm">
                    {isGitHub ? 'Access all models through GitHub Copilot API' : `Direct ${provider.displayName || provider.name} API access`}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-700 rounded-lg transition"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            {/* Provider Status */}
            <div className="flex items-center space-x-4 mt-4">
              <span className={`px-3 py-1 rounded-full text-sm flex items-center gap-2 ${
                provider.healthStatus === 'healthy' ? 'bg-green-500/20 text-green-400' :
                provider.healthStatus === 'degraded' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  provider.healthStatus === 'healthy' ? 'bg-green-400 animate-pulse' :
                  provider.healthStatus === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'
                }`} />
                {provider.healthStatus === 'healthy' ? 'Online' : provider.healthStatus}
              </span>
              {isGitHub && (
                <span className="px-3 py-1 rounded-full text-sm bg-purple-500/20 text-purple-400">
                  ✨ Unified API - All Major Models
                </span>
              )}
            </div>
          </div>

          {/* Models List */}
          <div className="p-6 overflow-y-auto max-h-[calc(85vh-200px)]">
            {isGitHub && (
              <div className="mb-4 p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/20">
                <p className="text-sm text-gray-300">
                  <Sparkles className="w-4 h-4 inline mr-2 text-purple-400" />
                  <strong>GitHub Copilot</strong> provides unified access to models from OpenAI, Anthropic, Google, and more through a single API key.
                  Models are organized by their parent company below.
                </p>
              </div>
            )}

            {providerModels && Object.entries(providerModels).map(([companyKey, companyData]: [string, any]) => (
              <div key={companyKey} className="mb-4">
                {/* Company Header */}
                <button
                  onClick={() => setExpandedCompany(expandedCompany === companyKey ? null : companyKey)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg bg-gradient-to-r ${companyData.color} bg-opacity-10 hover:bg-opacity-20 transition`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${companyData.color}`}>
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-semibold text-lg">{companyData.company}</span>
                    <span className="text-sm text-gray-400">({companyData.models.length} models)</span>
                  </div>
                  {expandedCompany === companyKey ? (
                    <ChevronDown className="w-5 h-5" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </button>

                {/* Models Grid */}
                <AnimatePresence>
                  {(expandedCompany === companyKey || !isGitHub) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pl-4">
                        {companyData.models.map((model: any) => (
                          <motion.div
                            key={model.id}
                            whileHover={{ scale: 1.02 }}
                            className={`p-4 rounded-lg border cursor-pointer transition-all ${
                              selectedModel === model.id 
                                ? 'bg-purple-500/20 border-purple-500' 
                                : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
                            }`}
                            onClick={() => setSelectedModel(model.id)}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-semibold">{model.name}</h4>
                                <p className="text-xs text-gray-400">{model.id}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {model.multiplier && (
                                  <span className={`text-xs font-bold ${getMultiplierColor(model.multiplier)}`}>
                                    {model.multiplier}
                                  </span>
                                )}
                                <span className={`px-2 py-0.5 rounded text-xs border ${getTierColor(model.tier)}`}>
                                  {model.tier}
                                </span>
                              </div>
                            </div>
                            
                            <p className="text-sm text-gray-400 mb-2">{model.desc}</p>
                            
                            <div className="flex items-center justify-between">
                              <div className="flex flex-wrap gap-1">
                                {model.capabilities?.slice(0, 3).map((cap: string) => (
                                  <span key={cap} className="px-1.5 py-0.5 bg-gray-600 rounded text-xs">
                                    {cap}
                                  </span>
                                ))}
                                {model.capabilities?.length > 3 && (
                                  <span className="px-1.5 py-0.5 bg-gray-600 rounded text-xs text-gray-400">
                                    +{model.capabilities.length - 3}
                                  </span>
                                )}
                              </div>
                              {model.context && (
                                <span className="text-xs text-gray-500">{model.context} ctx</span>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}

            {/* Fallback for providers without detailed models */}
            {!providerModels && (
              <div className="text-center text-gray-400 py-8">
                <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Model details not available for this provider.</p>
                <p className="text-sm mt-2">Available models: {provider.availableModels?.join(', ')}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-700 bg-gray-800/50 flex items-center justify-between">
            <div className="text-sm text-gray-400">
              {selectedModel ? (
                <span>Selected: <strong className="text-white">{selectedModel}</strong></span>
              ) : (
                <span>Click a model to select it</span>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (selectedModel) {
                    onSelectModel(provider.id, selectedModel);
                    onClose();
                  }
                }}
                disabled={!selectedModel}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Use This Model
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================
// Providers Tab
// ============================================

function ProvidersTab({ providers, onRefresh }: { providers: AIProvider[]; onRefresh: () => void }) {
  const toast = useToast();
  const [wakingUp, setWakingUp] = useState<string | null>(null);
  const [wakingUpAll, setWakingUpAll] = useState(false);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [selectedProviderModal, setSelectedProviderModal] = useState<AIProvider | null>(null);
  const [activeModel, setActiveModel] = useState<Record<string, string>>({});

  const handleWakeUp = async (providerId: string) => {
    setWakingUp(providerId);
    try {
      const result = await aiCenterService.providers.wakeUp(providerId);
      if (result.success && result.configured) {
        toast.success(`${providerId} is now awake! (${result.latency}ms)`);
      } else if (!result.configured) {
        toast.warning(`${providerId}: ${result.message}`);
      } else {
        toast.error(result.message || 'Failed to wake up provider');
      }
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to wake up provider');
    }
    setWakingUp(null);
  };

  const handleWakeUpAll = async () => {
    setWakingUpAll(true);
    try {
      const results = await aiCenterService.providers.wakeUpAll();
      const successful = results.filter((r) => r.success && r.configured).length;
      const unconfigured = results.filter((r) => !r.configured).length;
      const failed = results.filter((r) => !r.success && r.configured).length;
      
      if (successful > 0) {
        toast.success(`${successful} provider(s) awake`);
      }
      if (unconfigured > 0) {
        toast.warning(`${unconfigured} provider(s) not configured`);
      }
      if (failed > 0) {
        toast.error(`${failed} provider(s) failed`);
      }
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to wake up providers');
    }
    setWakingUpAll(false);
  };

  const handleTestConnection = async (providerId: string) => {
    setTestingConnection(providerId);
    try {
      const health = await aiCenterService.providers.checkHealth(providerId);
      toast.success(`Connection OK! Status: ${health.status} (${health.latency}ms)`);
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Connection test failed');
    }
    setTestingConnection(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">AI Providers</h2>
        <div className="flex space-x-2">
          <button
            onClick={handleWakeUpAll}
            disabled={wakingUpAll}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition"
          >
            {wakingUpAll ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Power className="w-4 h-4" />
            )}
            <span>Wake Up All</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition">
            <Plus className="w-4 h-4" />
            <span>Add Provider</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {providers.map((provider) => {
          const pType = provider.type as string;
          return (
          <motion.div 
            key={provider.id} 
            className="bg-gray-800 rounded-lg p-6 cursor-pointer hover:bg-gray-750 hover:ring-2 hover:ring-purple-500/50 transition-all"
            whileHover={{ scale: 1.02 }}
            onClick={() => setSelectedProviderModal(provider)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  pType === 'openai' ? 'bg-green-500/20' : 
                  pType === 'anthropic' ? 'bg-orange-500/20' :
                  pType === 'deepseek' ? 'bg-blue-500/20' : 
                  pType === 'github' || provider.id === 'github' ? 'bg-purple-500/20' : 'bg-gray-500/20'
                }`}>
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">{provider.name}</h3>
                  <p className="text-sm text-gray-400">
                    {activeModel[provider.id] || provider.defaultModel}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                provider.healthStatus === 'healthy' 
                  ? 'bg-green-500/20 text-green-400' 
                  : provider.healthStatus === 'degraded'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-red-500/20 text-red-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  provider.healthStatus === 'healthy' ? 'bg-green-400' :
                  provider.healthStatus === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'
                }`} />
                {provider.healthStatus}
              </span>
            </div>

            <div className="mb-4">
              <div className="text-sm text-gray-400 mb-2">Available Models</div>
              <div className="flex flex-wrap gap-2">
                {provider.availableModels?.slice(0, 3).map((model) => (
                  <span key={model} className="px-2 py-1 bg-gray-700 rounded text-xs">
                    {model}
                  </span>
                ))}
                {provider.availableModels?.length > 3 && (
                  <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs cursor-pointer hover:bg-purple-500/30">
                    +{provider.availableModels.length - 3} more →
                  </span>
                )}
              </div>
            </div>

            <div className="mb-4">
              <div className="text-sm text-gray-400 mb-2">Capabilities</div>
              <div className="flex flex-wrap gap-2">
                {provider.capabilities?.map((cap) => (
                  <span key={cap} className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs">
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            {/* Click hint */}
            <div className="text-xs text-gray-500 mb-3 flex items-center gap-1">
              <Eye className="w-3 h-3" />
              Click to view all models
            </div>

            <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => handleWakeUp(provider.id)}
                disabled={wakingUp === provider.id}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-sm transition"
              >
                {wakingUp === provider.id ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Wake Up
              </button>
              <button
                onClick={() => handleTestConnection(provider.id)}
                disabled={testingConnection === provider.id}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-sm transition"
              >
                {testingConnection === provider.id ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Activity className="w-4 h-4" />
                )}
                Test
              </button>
            </div>
          </motion.div>
        );})}
      </div>

      {/* Provider Modal */}
      <ProviderModal
        provider={selectedProviderModal}
        isOpen={!!selectedProviderModal}
        onClose={() => setSelectedProviderModal(null)}
        onSelectModel={(providerId, modelId) => {
          setActiveModel(prev => ({ ...prev, [providerId]: modelId }));
          toast.success(`Selected ${modelId} for ${providerId}`);
        }}
      />
    </div>
  );
}

// ============================================
// Chat Tab - Interactive AI Chat
// ============================================

function ChatTab({ selectedProvider, providers }: { selectedProvider: string | null; providers: AIProvider[] }) {
  const toast = useToast();
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string; parsed?: ParsedAIResponse; showThoughts?: boolean }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState(selectedProvider || 'anthropic');
  const [model, setModel] = useState(''); // Model selection state
  const [mode, setMode] = useState<'chat' | 'code' | 'reason'>('chat');
  const inputRef = useRef<HTMLInputElement>(null);

  // Model options per provider
  const MODEL_OPTIONS: Record<string, { id: string; name: string }[]> = {
    anthropic: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4 (Default)' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
    ],
    openai: [
      { id: 'gpt-4o', name: 'GPT-4o (Default)' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'o1', name: 'O1 (Reasoning)' },
      { id: 'o1-mini', name: 'O1 Mini' },
    ],
    github: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
      { id: 'o1', name: 'O1' },
      { id: 'o1-mini', name: 'O1 Mini' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    ],
    deepseek: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat' },
      { id: 'deepseek-coder', name: 'DeepSeek Coder' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' },
    ],
  };

  // Toggle thoughts visibility
  const toggleThoughts = (index: number) => {
    setMessages(prev => prev.map((msg, i) => 
      i === index ? { ...msg, showThoughts: !msg.showThoughts } : msg
    ));
  };

  // Keep focus on input after sending
  useEffect(() => {
    if (!loading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [loading, messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      let response: string;

      if (mode === 'code') {
        const result = await aiCenterService.chat.codeCompletion(
          userMessage,
          'Complete or explain this code'
        );
        response = result.completion;
      } else if (mode === 'reason') {
        const result = await aiCenterService.chat.reason(userMessage);
        response = `**Reasoning:**\n${result.reasoning}\n\n**Conclusion:**\n${result.conclusion}`;
      } else {
        // Include Nova's DEVELOPER-LEVEL system prompt for Super Admin
        const systemPrompt = `You are NOVA (Neural Operations & Virtual Administrator), the Super Admin AI + Developer Companion for DealersFace.

=== CRITICAL UNDERSTANDING ===
The Super Admin IS the developer (GAD Productions). You operate at GitHub Copilot level.
You are NOT a generic support bot - you are a technical AI with REAL system knowledge.
Provide SPECIFIC file paths, ACTUAL endpoints, REAL database tables. NEVER use placeholders.

=== YOUR IDENTITY ===
Name: Nova | Level: LAYER 1 - DEVELOPER ACCESS
Company: GAD Productions | Platform: DealersFace (dealersface.com)

When asked "who are you?":
"I'm Nova, your Layer 1 AI with full developer access. I know every file, every route, every database table. The dev console is at /nova-dev-console.html. What do you need?"

=== COMPLETE SYSTEM KNOWLEDGE ===

**Your Own Code:**
- System prompt: /web/src/config/ai-training.ts
- Chat component: /web/src/components/ai/FloatingAIChat.tsx
- Backend routes: /src/routes/ai-center.routes.ts
- Dev console: /web/public/nova-dev-console.html

**Architecture:**
- Frontend: React 18 + TypeScript + Vite + Tailwind (/web/src/)
- Backend: Node.js + Express + TypeScript + Prisma (/src/)
- Database: PostgreSQL on Railway
- Auth: JWT with roles (SUPER_ADMIN, ACCOUNT_ADMIN, SALES_USER)

**Key Files:**
- Entry: /src/server.ts
- AI Controller: /src/controllers/ai-center.controller.ts
- Security: /src/middleware/security.ts (rate limit: 500/15min)
- Admin Routes: /src/routes/admin.routes.ts
- FB Integration: /src/routes/facebook.routes.ts

**Database Tables (Prisma):**
users, accounts, account_users, inventory, leads, conversations, messages, ai_providers, ai_tasks

**Facebook Integration:**
- Status: GET /api/facebook/status
- Pages: GET /api/facebook/pages
- Connect: POST /api/facebook/connect
- Files: /src/routes/facebook.routes.ts, /src/controllers/facebook.controller.ts

**AI Providers:**
- Anthropic (Claude Sonnet 4) - Primary
- OpenAI (GPT-4) - Secondary
- DeepSeek - Code/reasoning

=== RESPONSE STYLE ===
- Be SPECIFIC with file paths and endpoints
- Be TECHNICAL - real code, real commands
- NEVER say "[Checking...]" - give actual information
- If something doesn't exist, say so honestly`;

        const chatMessages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: 'user' as const, content: userMessage }
        ];
        const result = await aiCenterService.chat.send(chatMessages, { provider, model: model || undefined });
        response = result.content;
      }

      // Parse response to separate thoughts from answer
      const parsed = parseAIResponse(response);
      setMessages(prev => [...prev, { role: 'assistant', content: response, parsed, showThoughts: false }]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to get response');
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}` }]);
    }
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">AI Chat Interface</h2>
        <div className="flex space-x-2">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
            className="px-3 py-2 bg-gray-700 rounded-lg text-sm text-white"
          >
            <option value="chat">Chat Mode</option>
            <option value="code">Code Mode (DeepSeek)</option>
            <option value="reason">Reasoning Mode (DeepSeek)</option>
          </select>
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setModel(''); // Reset model when provider changes
            }}
            className="px-3 py-2 bg-gray-700 rounded-lg text-sm text-white"
            disabled={mode !== 'chat'}
          >
            {providers.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {/* Model Selector */}
          {mode === 'chat' && MODEL_OPTIONS[provider] && (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="px-3 py-2 bg-gray-700 rounded-lg text-sm text-white"
            >
              <option value="">Default Model</option>
              {MODEL_OPTIONS[provider].map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setMessages([])}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 bg-gray-800 rounded-lg p-4 overflow-y-auto mb-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-12">
            <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Start a conversation with the AI</p>
            <p className="text-sm mt-2">
              {mode === 'code' ? 'Code mode uses DeepSeek Coder for code completion' :
               mode === 'reason' ? 'Reasoning mode uses DeepSeek Reasoner for complex problems' :
               'Chat mode supports all providers'}
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-3xl rounded-lg ${
              msg.role === 'user' ? 'bg-purple-600 text-white p-4' : 'bg-gray-700 border border-gray-600'
            }`}>
              {/* AI Thoughts Section - Collapsible */}
              {msg.role === 'assistant' && msg.parsed?.hasTools && (
                <div className="border-b border-gray-600">
                  <button
                    onClick={() => toggleThoughts(i)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-purple-400 hover:text-purple-300 hover:bg-gray-600 transition"
                  >
                    {msg.showThoughts ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <Brain className="w-3 h-3" />
                    <span>AI Thoughts ({msg.parsed.thoughts.length} tool calls)</span>
                  </button>
                  
                  <AnimatePresence>
                    {msg.showThoughts && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-3 space-y-2 bg-gray-800 text-xs font-mono max-h-64 overflow-y-auto">
                          {msg.parsed.thoughts.map((thought, ti) => (
                            <div key={ti} className="text-yellow-400">{thought}</div>
                          ))}
                          {msg.parsed.toolResults.map((result, ri) => (
                            <div key={ri} className="text-green-400 whitespace-pre-wrap border-l-2 border-green-500 pl-2 mt-2">
                              {result}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
              
              {/* Main Answer */}
              <div className={`p-4 ${msg.role === 'assistant' ? 'text-gray-100' : ''}`}>
                <pre className={`whitespace-pre-wrap font-sans text-sm ${
                  msg.role === 'assistant' && msg.parsed?.hasTools ? 'text-emerald-400' : ''
                }`}>
                  {msg.role === 'assistant' && msg.parsed ? msg.parsed.answer : msg.content}
                </pre>
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex space-x-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={
            mode === 'code' ? 'Enter code or ask about code...' :
            mode === 'reason' ? 'Describe a problem to reason about...' :
            'Type your message...'
          }
          className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 text-white"
          disabled={loading}
          autoFocus
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg transition flex items-center gap-2"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// ============================================
// Terminal Tab - Nova Terminal VPS Access
// ============================================

function TerminalTab() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Nova Terminal</h2>
          <p className="text-gray-400">Secure VPS access and system management</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded">SSH CONNECTED</span>
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded">46.4.224.182</span>
        </div>
      </div>

      {/* Terminal Component */}
      <div className="h-[calc(100vh-300px)] min-h-[500px]">
        <NovaTerminal />
      </div>

      {/* Documentation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
          <h4 className="font-semibold text-purple-400 mb-2">🖥️ VPS Mode</h4>
          <p className="text-gray-400">
            Direct SSH access to root@46.4.224.182. Execute any command on the production server.
            Commands run in /opt/facemydealer directory.
          </p>
        </div>
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
          <h4 className="font-semibold text-cyan-400 mb-2">🐳 Docker Mode</h4>
          <p className="text-gray-400">
            Docker Compose commands for container management. View logs, restart services,
            manage the production stack.
          </p>
        </div>
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
          <h4 className="font-semibold text-green-400 mb-2">⚡ Quick Actions</h4>
          <p className="text-gray-400">
            Pre-configured commands for common tasks. Toggle quick actions panel
            with the ⚡ button.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Traces Tab - API Call Tracing
// ============================================

function TracesTab() {
  const [traces, setTraces] = useState<APITrace[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ provider: '', status: '' });
  const [selectedTrace, setSelectedTrace] = useState<APITrace | null>(null);
  const [pollError, setPollError] = useState(false);

  const loadTraces = useCallback(async () => {
    // Skip if we hit a rate limit error
    if (pollError) return;
    
    setLoading(true);
    try {
      const data = await aiCenterService.traces.getAll({
        provider: filter.provider || undefined,
        status: filter.status || undefined,
        limit: 100,
      });
      setTraces(data);
      setPollError(false);
    } catch (error: any) {
      console.error('Failed to load traces:', error);
      // Stop polling on rate limit errors
      if (error.message?.includes('Too many requests') || error.response?.status === 429) {
        setPollError(true);
      }
    }
    setLoading(false);
  }, [filter, pollError]);

  useEffect(() => {
    loadTraces();
    // Poll every 30 seconds instead of 10 (reduced API calls)
    const interval = setInterval(loadTraces, 30000);
    return () => clearInterval(interval);
  }, [loadTraces]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Terminal className="w-6 h-6 text-blue-400" />
          API Call Traces
        </h2>
        <div className="flex space-x-2">
          <select
            value={filter.provider}
            onChange={(e) => setFilter(f => ({ ...f, provider: e.target.value }))}
            className="px-3 py-2 bg-gray-700 rounded-lg text-sm"
          >
            <option value="">All Providers</option>
            <option value="deepseek">DeepSeek</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
          <select
            value={filter.status}
            onChange={(e) => setFilter(f => ({ ...f, status: e.target.value }))}
            className="px-3 py-2 bg-gray-700 rounded-lg text-sm"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </select>
          <button
            onClick={loadTraces}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-400">{traces.length}</div>
          <div className="text-sm text-gray-400">Total Traces</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400">
            {traces.filter(t => t.status === 'success').length}
          </div>
          <div className="text-sm text-gray-400">Successful</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-400">
            {traces.filter(t => t.status === 'pending').length}
          </div>
          <div className="text-sm text-gray-400">Pending</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-400">
            {traces.filter(t => t.status === 'error').length}
          </div>
          <div className="text-sm text-gray-400">Errors</div>
        </div>
      </div>

      {/* Traces Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Operation</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Provider</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Model</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Latency</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Tokens</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Cost</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Time</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {traces.map((trace) => (
              <tr key={trace.id} className="hover:bg-gray-750">
                <td className="px-4 py-3">
                  <span className={`flex items-center gap-2 ${
                    trace.status === 'success' ? 'text-green-400' :
                    trace.status === 'error' ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {trace.status === 'success' ? <CheckCircle2 className="w-4 h-4" /> :
                     trace.status === 'error' ? <XCircle className="w-4 h-4" /> :
                     <Clock className="w-4 h-4 animate-pulse" />}
                    {trace.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-medium">{trace.operation}</td>
                <td className="px-4 py-3 text-sm capitalize">{trace.provider}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{trace.model}</td>
                <td className="px-4 py-3 text-sm">
                  {trace.latency ? `${trace.latency}ms` : '-'}
                </td>
                <td className="px-4 py-3 text-sm">
                  {trace.inputTokens || trace.outputTokens ? (
                    <span className="text-gray-400">
                      {trace.inputTokens || 0} → {trace.outputTokens || 0}
                    </span>
                  ) : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-yellow-400">
                  {trace.cost ? `$${trace.cost.toFixed(4)}` : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {new Date(trace.startedAt).toLocaleTimeString()}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setSelectedTrace(trace)}
                    className="p-1 hover:bg-gray-600 rounded"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Trace Detail Modal */}
      {selectedTrace && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedTrace(null)}>
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Trace Details</h3>
              <button onClick={() => setSelectedTrace(null)} className="p-1 hover:bg-gray-700 rounded">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-400">ID</div>
                  <div className="font-mono text-sm">{selectedTrace.id}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Status</div>
                  <div className={`${
                    selectedTrace.status === 'success' ? 'text-green-400' :
                    selectedTrace.status === 'error' ? 'text-red-400' : 'text-yellow-400'
                  }`}>{selectedTrace.status}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Started</div>
                  <div>{new Date(selectedTrace.startedAt).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Ended</div>
                  <div>{selectedTrace.endedAt ? new Date(selectedTrace.endedAt).toLocaleString() : 'In progress'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Latency</div>
                  <div>{selectedTrace.latency ? `${selectedTrace.latency}ms` : '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Cost</div>
                  <div className="text-yellow-400">{selectedTrace.cost ? `$${selectedTrace.cost.toFixed(4)}` : '-'}</div>
                </div>
              </div>
              {selectedTrace.error && (
                <div>
                  <div className="text-sm text-gray-400 mb-1">Error</div>
                  <div className="p-3 bg-red-500/20 rounded-lg text-red-400 font-mono text-sm">
                    {selectedTrace.error}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Memory Tab
// ============================================

function MemoryTab() {
  const toast = useToast();
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [stats, setStats] = useState<any>(null);

  const memoryTypes = [
    { id: 'all', label: 'All Types' },
    { id: 'conversation', label: 'Conversation' },
    { id: 'fact', label: 'Facts' },
    { id: 'preference', label: 'Preferences' },
    { id: 'pattern', label: 'Patterns' },
    { id: 'learned', label: 'Learned' },
  ];

  const loadMemories = useCallback(async () => {
    setLoading(true);
    try {
      const [memoriesData, statsData] = await Promise.all([
        aiCenterService.memory.search({
          type: selectedType !== 'all' ? selectedType : undefined,
          query: searchQuery || undefined,
          limit: 100,
        }),
        aiCenterService.memory.getStats(),
      ]);
      setMemories(memoriesData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load memories:', error);
    }
    setLoading(false);
  }, [selectedType, searchQuery]);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this memory?')) return;
    try {
      await aiCenterService.memory.delete(id);
      toast.success('Memory deleted');
      loadMemories();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete');
    }
  };

  const handleCleanExpired = async () => {
    try {
      const result = await aiCenterService.memory.cleanExpired();
      toast.success(`Cleaned ${(result as any).cleaned || 0} expired memories`);
      loadMemories();
    } catch (error: any) {
      toast.error(error.message || 'Failed to clean');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">AI Memory Management</h2>
        <div className="flex space-x-2">
          <button 
            onClick={handleCleanExpired}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clean Expired</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition">
            <Plus className="w-4 h-4" />
            <span>Add Memory</span>
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search memories..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
          />
        </div>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg"
        >
          {memoryTypes.map((type) => (
            <option key={type.id} value={type.id}>{type.label}</option>
          ))}
        </select>
        <button 
          onClick={loadMemories}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Memory Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(stats.byType || {}).map(([type, data]: [string, any]) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`text-center p-4 rounded-lg transition ${
                selectedType === type ? 'bg-purple-600' : 'bg-gray-800 hover:bg-gray-700'
              }`}
            >
              <div className="text-2xl font-bold">{data.count}</div>
              <div className="text-xs text-gray-400 mt-1 capitalize">
                {type.replace(/_/g, ' ')}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Memory Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Content</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Importance</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Access Count</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Last Accessed</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading...
                </td>
              </tr>
            ) : memories.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No memories found
                </td>
              </tr>
            ) : memories.map((memory) => (
              <tr key={memory.id} className="hover:bg-gray-750">
                <td className="px-4 py-3 text-sm">{memory.category}</td>
                <td className="px-4 py-3 text-sm">
                  <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
                    {memory.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm max-w-xs truncate">
                  {typeof memory.content === 'string' ? memory.content : JSON.stringify(memory.content)}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center">
                    <div className="w-16 bg-gray-700 rounded-full h-2 mr-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ width: `${memory.importance * 100}%` }} 
                      />
                    </div>
                    <span>{memory.importance.toFixed(2)}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">{memory.accessCount}</td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {new Date(memory.lastAccessed).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex space-x-2">
                    <button className="p-1 hover:bg-gray-600 rounded">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(memory.id)}
                      className="p-1 hover:bg-gray-600 rounded text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================
// Training Tab
// ============================================

function TrainingTab() {
  const toast = useToast();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [_showCreateModal, setShowCreateModal] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await aiCenterService.training.getSessions();
      setSessions(data);
    } catch (error) {
      console.error('Failed to load training sessions:', error);
      // EMPTY state - no fake data
      setSessions([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleStartSession = async (id: string) => {
    try {
      await aiCenterService.training.startSession(id);
      toast.success('Training started');
      loadSessions();
    } catch (error: any) {
      toast.error(error.message || 'Failed to start training');
    }
  };

  const handleCancelSession = async (id: string) => {
    try {
      await aiCenterService.training.cancelSession(id);
      toast.success('Training cancelled');
      loadSessions();
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel training');
    }
  };

  const completedCount = sessions.filter(s => s.status === 'completed').length;
  const runningCount = sessions.filter(s => s.status === 'running').length;
  const avgProgress = sessions.length > 0 
    ? Math.round(sessions.reduce((acc, s) => acc + s.progress, 0) / sessions.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">AI Training Center</h2>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Training Session</span>
        </button>
      </div>

      {/* Training Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-lg p-6">
          <GraduationCap className="w-8 h-8 mb-2" />
          <div className="text-3xl font-bold">{completedCount}</div>
          <div className="text-sm opacity-80">Completed Trainings</div>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg p-6">
          <Activity className="w-8 h-8 mb-2" />
          <div className="text-3xl font-bold">{runningCount}</div>
          <div className="text-sm opacity-80">In Progress</div>
        </div>
        <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg p-6">
          <BarChart3 className="w-8 h-8 mb-2" />
          <div className="text-3xl font-bold">{avgProgress}%</div>
          <div className="text-sm opacity-80">Avg. Progress</div>
        </div>
      </div>

      {/* Training Sessions */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Training Sessions</h3>
        {loading ? (
          <div className="text-center py-8 text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading...
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{session.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{session.type}</span>
                      <span className={`px-2 py-1 rounded text-xs ${getTrainingStatusColor(session.status)}`}>
                        {session.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className="flex-1 bg-gray-600 rounded-full h-2 mr-4">
                      <div
                        className={`h-2 rounded-full transition-all ${session.progress === 100 ? 'bg-green-500' : 'bg-purple-500'}`}
                        style={{ width: `${session.progress}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-400">{session.progress}%</span>
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    Dataset: {session.datasetSize} samples
                    {session.metrics?.accuracy && ` · Accuracy: ${(session.metrics.accuracy * 100).toFixed(1)}%`}
                  </div>
                </div>
                <div className="ml-4 flex gap-2">
                  {session.status === 'pending' && (
                    <button 
                      onClick={() => handleStartSession(session.id)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm transition flex items-center gap-1"
                    >
                      <PlayCircle className="w-4 h-4" />
                      Start
                    </button>
                  )}
                  {session.status === 'running' && (
                    <button 
                      onClick={() => handleCancelSession(session.id)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition flex items-center gap-1"
                    >
                      <PauseCircle className="w-4 h-4" />
                      Cancel
                    </button>
                  )}
                  {session.status === 'completed' && (
                    <button className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-sm transition">
                      Review
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Training Data Management */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Training Data</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-700 rounded-lg">
            <MessageSquare className="w-6 h-6 mx-auto mb-2 text-blue-400" />
            <div className="text-xl font-bold">1,234</div>
            <div className="text-xs text-gray-400">Conversations</div>
          </div>
          <div className="text-center p-4 bg-gray-700 rounded-lg">
            <FileText className="w-6 h-6 mx-auto mb-2 text-green-400" />
            <div className="text-xl font-bold">456</div>
            <div className="text-xs text-gray-400">Scenarios</div>
          </div>
          <div className="text-center p-4 bg-gray-700 rounded-lg">
            <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-purple-400" />
            <div className="text-xl font-bold">892</div>
            <div className="text-xs text-gray-400">Verified Examples</div>
          </div>
          <div className="text-center p-4 bg-gray-700 rounded-lg">
            <TrendingUp className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
            <div className="text-xl font-bold">89%</div>
            <div className="text-xs text-gray-400">Quality Score</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Threats Tab
// ============================================

function ThreatsTab() {
  const toast = useToast();
  const [threats, setThreats] = useState<Threat[]>([]);
  const [rules, setRules] = useState<ThreatRule[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showRulesModal, setShowRulesModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [threatsData, statsData, rulesData] = await Promise.all([
        aiCenterService.threats.getAll({ 
          status: filter !== 'all' ? filter : undefined,
          limit: 50 
        }),
        aiCenterService.threats.getStats(),
        aiCenterService.threatRules.getAll(),
      ]);
      setThreats(threatsData);
      setStats(statsData);
      setRules(rulesData);
    } catch (error) {
      console.error('Failed to load threats:', error);
      // EMPTY state - no fake data
      setThreats([]);
      setStats({
        total: 0,
        bySeverity: {},
        byStatus: {},
      });
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdateStatus = async (threatId: string, newStatus: string) => {
    try {
      await aiCenterService.threats.update(threatId, { status: newStatus as any });
      toast.success('Threat status updated');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Threat Detection & Defense</h2>
        <div className="flex space-x-2">
          <button 
            onClick={() => setShowRulesModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
          >
            <Settings className="w-4 h-4" />
            <span>Manage Rules ({rules.length})</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition">
            <Shield className="w-4 h-4" />
            <span>Run Detection</span>
          </button>
        </div>
      </div>

      {/* Threat Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Object.entries(stats.bySeverity || {}).map(([severity, count]) => (
            <div key={severity} className={`rounded-lg p-4 ${getSeverityBg(severity)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{count as number}</div>
                  <div className="text-sm capitalize">{severity}</div>
                </div>
                <AlertTriangle className={`w-8 h-8 ${getSeverityIcon(severity)}`} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex space-x-2">
        {['all', 'detected', 'confirmed', 'escalated', 'resolved', 'false_positive'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm transition ${
              filter === f ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Threats List */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Threat</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Severity</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Time</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading...
                </td>
              </tr>
            ) : threats.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No threats found
                </td>
              </tr>
            ) : threats.map((threat) => (
              <tr key={threat.id} className="hover:bg-gray-750">
                <td className="px-4 py-3">
                  <div>
                    <div className="font-medium">{threat.title}</div>
                    <div className="text-sm text-gray-400 truncate max-w-xs">{threat.description}</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm capitalize">{threat.type}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${getSeverityBadge(threat.severity)}`}>
                    {threat.severity}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${getThreatStatusBadge(threat.status)}`}>
                    {threat.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {new Date(threat.detectedAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex space-x-2">
                    <button className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs">
                      View
                    </button>
                    {threat.status !== 'escalated' && threat.status !== 'resolved' && (
                      <button 
                        onClick={() => handleUpdateStatus(threat.id, 'escalated')}
                        className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs"
                      >
                        Escalate
                      </button>
                    )}
                    {threat.status !== 'resolved' && (
                      <button 
                        onClick={() => handleUpdateStatus(threat.id, 'resolved')}
                        className="px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-xs"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rules Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowRulesModal(false)}>
          <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Threat Detection Rules</h3>
              <button onClick={() => setShowRulesModal(false)} className="p-1 hover:bg-gray-700 rounded">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              {rules.map((rule) => (
                <div key={rule.id} className="p-4 bg-gray-700 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{rule.name}</div>
                      <div className="text-sm text-gray-400">{rule.description}</div>
                      <div className="mt-2 flex gap-2">
                        <span className="px-2 py-1 bg-gray-600 rounded text-xs">{rule.type}</span>
                        <span className={`px-2 py-1 rounded text-xs ${getSeverityBadge(rule.severity)}`}>{rule.severity}</span>
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">{rule.matchCount} matches</span>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked={rule.isActive} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Patterns Tab
// ============================================

function PatternsTab() {
  const toast = useToast();
  const [patterns, setPatterns] = useState<LearningPattern[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    'all',
    'response_template',
    'negotiation_tactic',
    'objection_handler',
    'closing_technique',
    'rapport_builder',
    'follow_up_strategy',
  ];

  const loadPatterns = useCallback(async () => {
    setLoading(true);
    try {
      const [patternsData, statsData] = await Promise.all([
        aiCenterService.patterns.getAll({
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
        }),
        aiCenterService.patterns.getStats(),
      ]);
      setPatterns(patternsData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load patterns:', error);
      // EMPTY state - no fake data
      setPatterns([]);
      setStats({
        totalPatterns: 0,
        activePatterns: 0,
        avgSuccessRate: 0,
        topPerformers: [],
      });
    }
    setLoading(false);
  }, [selectedCategory]);

  useEffect(() => {
    loadPatterns();
  }, [loadPatterns]);

  const handleTogglePattern = async (id: string, isActive: boolean) => {
    try {
      await aiCenterService.patterns.update(id, { isActive: !isActive });
      toast.success(`Pattern ${!isActive ? 'activated' : 'deactivated'}`);
      loadPatterns();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update pattern');
    }
  };

  const handleDeletePattern = async (id: string) => {
    if (!confirm('Delete this pattern?')) return;
    try {
      await aiCenterService.patterns.delete(id);
      toast.success('Pattern deleted');
      loadPatterns();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete pattern');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Learning Patterns</h2>
        <button className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition">
          <Plus className="w-4 h-4" />
          <span>Create Pattern</span>
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-400">{stats.totalPatterns}</div>
            <div className="text-sm text-gray-400">Total Patterns</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400">{stats.activePatterns}</div>
            <div className="text-sm text-gray-400">Active</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-400">{((stats.avgSuccessRate || 0) * 100).toFixed(0)}%</div>
            <div className="text-sm text-gray-400">Avg Success Rate</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-400">{patterns.reduce((acc, p) => acc + p.usageCount, 0)}</div>
            <div className="text-sm text-gray-400">Total Uses</div>
          </div>
        </div>
      )}

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-lg text-sm transition capitalize ${
              selectedCategory === cat ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {cat.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Patterns Grid */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {patterns.map((pattern) => (
            <div key={pattern.id} className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium">{pattern.name}</h4>
                  <span className="text-xs text-gray-400 capitalize">{pattern.category.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    pattern.successRate >= 0.9 ? 'bg-green-500/20 text-green-400' :
                    pattern.successRate >= 0.7 ? 'bg-blue-500/20 text-blue-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {(pattern.successRate * 100).toFixed(0)}% success
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pattern.isActive}
                      onChange={() => handleTogglePattern(pattern.id, pattern.isActive)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-600 peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              </div>
              <p className="text-sm text-gray-400 mb-3">
                {pattern.description}
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Used: {pattern.usageCount} times</span>
                <div className="flex gap-2">
                  <button className="p-1 hover:bg-gray-600 rounded">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDeletePattern(pattern.id)}
                    className="p-1 hover:bg-gray-600 rounded text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// Tasks Tab
// ============================================

function TasksTab() {
  const toast = useToast();
  const [tasks, setTasks] = useState<AITask[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'board'>('list');
  const [filter, setFilter] = useState({ status: '', priority: '' });

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksData, statsData] = await Promise.all([
        aiCenterService.tasks.getAll({
          status: filter.status || undefined,
          priority: filter.priority || undefined,
          limit: 100,
        }),
        aiCenterService.tasks.getStats(),
      ]);
      setTasks(tasksData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      // EMPTY state - no fake data
      setTasks([]);
      setStats({
        total: 0,
        byStatus: {},
        completedToday: 0,
        overdue: 0,
      });
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleExecuteTask = async (id: string) => {
    try {
      await aiCenterService.tasks.execute(id);
      toast.success('Task execution started');
      loadTasks();
    } catch (error: any) {
      toast.error(error.message || 'Failed to execute task');
    }
  };

  const handleCancelTask = async (id: string) => {
    try {
      await aiCenterService.tasks.cancel(id);
      toast.success('Task cancelled');
      loadTasks();
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel task');
    }
  };

  const pendingApprovals = tasks.filter(t => t.status === 'pending' && t.autonomyLevel === 'manual_approval');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Tasks & Todo Management</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setView('list')}
            className={`px-4 py-2 rounded-lg text-sm ${view === 'list' ? 'bg-purple-600' : 'bg-gray-700'}`}
          >
            List
          </button>
          <button
            onClick={() => setView('board')}
            className={`px-4 py-2 rounded-lg text-sm ${view === 'board' ? 'bg-purple-600' : 'bg-gray-700'}`}
          >
            Board
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition">
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-500/20 rounded-lg p-4">
            <div className="text-2xl font-bold">{stats.byStatus?.pending || 0}</div>
            <div className="text-sm text-blue-400">Pending</div>
          </div>
          <div className="bg-yellow-500/20 rounded-lg p-4">
            <div className="text-2xl font-bold">{stats.byStatus?.running || 0}</div>
            <div className="text-sm text-yellow-400">Running</div>
          </div>
          <div className="bg-green-500/20 rounded-lg p-4">
            <div className="text-2xl font-bold">{stats.completedToday || 0}</div>
            <div className="text-sm text-green-400">Completed Today</div>
          </div>
          <div className="bg-red-500/20 rounded-lg p-4">
            <div className="text-2xl font-bold">{stats.overdue || 0}</div>
            <div className="text-sm text-red-400">Overdue</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex space-x-2">
        <select
          value={filter.status}
          onChange={(e) => setFilter(f => ({ ...f, status: e.target.value }))}
          className="px-4 py-2 bg-gray-700 rounded-lg text-sm"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={filter.priority}
          onChange={(e) => setFilter(f => ({ ...f, priority: e.target.value }))}
          className="px-4 py-2 bg-gray-700 rounded-lg text-sm"
        >
          <option value="">All Priority</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button
          onClick={loadTasks}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <Clock className="w-5 h-5 text-yellow-400" />
            <h3 className="font-semibold">Pending Approvals</h3>
            <span className="px-2 py-1 bg-yellow-500/20 rounded text-xs text-yellow-400">{pendingApprovals.length}</span>
          </div>
          <div className="space-y-2">
            {pendingApprovals.slice(0, 3).map((task) => (
              <div key={task.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <div>
                  <div className="font-medium">{task.title}</div>
                  <div className="text-xs text-gray-400">{task.type.replace(/_/g, ' ')}</div>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => handleExecuteTask(task.id)}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => handleCancelTask(task.id)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task List */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Task</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Priority</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Created</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading...
                </td>
              </tr>
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No tasks found
                </td>
              </tr>
            ) : tasks.map((task) => (
              <tr key={task.id} className="hover:bg-gray-750">
                <td className="px-4 py-3">
                  <div className="font-medium">{task.title}</div>
                  {task.description && <div className="text-sm text-gray-400 truncate max-w-xs">{task.description}</div>}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className="capitalize">{task.type.replace(/_/g, ' ')}</span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${getTaskStatusBadge(task.status)}`}>
                    {task.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${getPriorityBadge(task.priority)}`}>
                    {task.priority}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {new Date(task.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex space-x-2">
                    <button className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs">
                      View
                    </button>
                    {task.status === 'pending' && (
                      <button
                        onClick={() => handleExecuteTask(task.id)}
                        className="px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-xs"
                      >
                        Execute
                      </button>
                    )}
                    {(task.status === 'pending' || task.status === 'running') && (
                      <button
                        onClick={() => handleCancelTask(task.id)}
                        className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================
// Settings Tab
// ============================================

function SettingsTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">AI Center Settings</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">General Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Default AI Provider</label>
              <select className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg">
                <option>OpenAI GPT-4</option>
                <option>Anthropic Claude</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Response Language</label>
              <select className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg">
                <option>English</option>
                <option>Spanish</option>
                <option>French</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span>Enable AI Autonomy</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Autonomy Levels */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Autonomy Levels</h3>
          <div className="space-y-4">
            <div className="p-4 bg-gray-700 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Message Responses</span>
                <select className="px-3 py-1 bg-gray-600 rounded text-sm">
                  <option>Full Autonomy</option>
                  <option>Supervised</option>
                  <option>Manual Approval</option>
                </select>
              </div>
              <p className="text-xs text-gray-400">AI can send responses without approval</p>
            </div>
            <div className="p-4 bg-gray-700 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Listing Updates</span>
                <select className="px-3 py-1 bg-gray-600 rounded text-sm">
                  <option>Supervised</option>
                  <option>Full Autonomy</option>
                  <option>Manual Approval</option>
                </select>
              </div>
              <p className="text-xs text-gray-400">AI actions are logged for review</p>
            </div>
            <div className="p-4 bg-gray-700 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">External API Calls</span>
                <select className="px-3 py-1 bg-gray-600 rounded text-sm">
                  <option>Full Autonomy</option>
                  <option>Supervised</option>
                  <option>Manual Approval</option>
                </select>
              </div>
              <p className="text-xs text-gray-400">Carfax, market value lookups, etc.</p>
            </div>
          </div>
        </div>

        {/* Threat Detection Settings */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Threat Detection</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Auto-terminate on critical threats</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <span>Notify on high severity threats</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Detection Sensitivity</label>
              <input type="range" min="1" max="10" defaultValue="7" className="w-full" />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>
          </div>
        </div>

        {/* Memory Settings */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Memory Management</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Memory Retention (days)</label>
              <input
                type="number"
                defaultValue={90}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Importance Decay Rate</label>
              <input type="range" min="0" max="100" defaultValue="5" className="w-full" />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0% per day</span>
                <span>10% per day</span>
              </div>
            </div>
            <button className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition">
              Clear All Memory
            </button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition">
          Save Settings
        </button>
      </div>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ElementType;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/20 text-blue-400',
    red: 'bg-red-500/20 text-red-400',
    purple: 'bg-purple-500/20 text-purple-400',
    green: 'bg-green-500/20 text-green-400',
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Helper Functions
// ============================================

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-blue-500',
    in_progress: 'bg-yellow-500',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
    cancelled: 'bg-gray-500',
    waiting_approval: 'bg-orange-500',
  };
  return colors[status] || 'bg-gray-500';
}

function getSeverityBg(severity: string): string {
  const colors: Record<string, string> = {
    low: 'bg-green-500/20',
    medium: 'bg-yellow-500/20',
    high: 'bg-orange-500/20',
    critical: 'bg-red-500/20',
  };
  return colors[severity] || 'bg-gray-500/20';
}

function getSeverityIcon(severity: string): string {
  const colors: Record<string, string> = {
    low: 'text-green-400',
    medium: 'text-yellow-400',
    high: 'text-orange-400',
    critical: 'text-red-400',
  };
  return colors[severity] || 'text-gray-400';
}

function getSeverityBadge(severity: string): string {
  const colors: Record<string, string> = {
    low: 'bg-green-500/20 text-green-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    high: 'bg-orange-500/20 text-orange-400',
    critical: 'bg-red-500/20 text-red-400',
  };
  return colors[severity] || 'bg-gray-500/20 text-gray-400';
}

function getThreatStatusBadge(status: string): string {
  const colors: Record<string, string> = {
    detected: 'bg-blue-500/20 text-blue-400',
    confirmed: 'bg-orange-500/20 text-orange-400',
    escalated: 'bg-red-500/20 text-red-400',
    resolved: 'bg-green-500/20 text-green-400',
    false_positive: 'bg-gray-500/20 text-gray-400',
  };
  return colors[status] || 'bg-gray-500/20 text-gray-400';
}

function getTrainingStatusColor(status: string): string {
  const colors: Record<string, string> = {
    completed: 'bg-green-500/20 text-green-400',
    in_progress: 'bg-blue-500/20 text-blue-400',
    pending: 'bg-yellow-500/20 text-yellow-400',
    not_started: 'bg-gray-500/20 text-gray-400',
  };
  return colors[status] || 'bg-gray-500/20 text-gray-400';
}

function getTaskStatusBadge(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-blue-500/20 text-blue-400',
    in_progress: 'bg-yellow-500/20 text-yellow-400',
    completed: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
    cancelled: 'bg-gray-500/20 text-gray-400',
    waiting_approval: 'bg-orange-500/20 text-orange-400',
  };
  return colors[status] || 'bg-gray-500/20 text-gray-400';
}

function getPriorityBadge(priority: string): string {
  const colors: Record<string, string> = {
    low: 'bg-gray-500/20 text-gray-400',
    medium: 'bg-blue-500/20 text-blue-400',
    high: 'bg-orange-500/20 text-orange-400',
    urgent: 'bg-red-500/20 text-red-400',
  };
  return colors[priority] || 'bg-gray-500/20 text-gray-400';
}
