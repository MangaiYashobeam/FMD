/**
 * AI Center Page - Super Admin Dashboard
 * 
 * Comprehensive AI management interface:
 * - Provider selection and configuration
 * - Memory management
 * - Training center
 * - Threat monitoring
 * - Learning patterns
 * - Task management
 */

import { useState, useEffect } from 'react';
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
  Clock,
  TrendingUp,
  BarChart3,
  MessageSquare,
  FileText,
  Bot,
  Cpu,
} from 'lucide-react';

// Types
interface AIProvider {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  defaultModel: string;
  healthStatus: string;
  capabilities: string[];
}

interface DashboardStats {
  tasks: {
    total: number;
    byStatus: Record<string, number>;
    overdue: number;
    completedToday: number;
  };
  threats: {
    total: number;
    last24Hours: number;
    bySeverity: Record<string, number>;
  };
  patterns: {
    totalPatterns: number;
    topPerformers: { pattern: { name: string }; successRate: number }[];
  };
  memory: {
    total: number;
    byType: Record<string, { count: number }>;
  };
}

// Main Component
export default function AICenterPage() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // In production, fetch from API
      // const response = await fetch('/api/ai-center/dashboard/account-id');
      // const data = await response.json();
      
      // Mock data for demonstration
      setStats({
        tasks: {
          total: 156,
          byStatus: { pending: 23, in_progress: 8, completed: 120, failed: 5 },
          overdue: 3,
          completedToday: 15,
        },
        threats: {
          total: 47,
          last24Hours: 3,
          bySeverity: { low: 12, medium: 20, high: 10, critical: 5 },
        },
        patterns: {
          totalPatterns: 28,
          topPerformers: [
            { pattern: { name: 'Warm Greeting' }, successRate: 0.92 },
            { pattern: { name: 'Price Justification' }, successRate: 0.88 },
            { pattern: { name: 'Availability Check' }, successRate: 0.85 },
          ],
        },
        memory: {
          total: 2345,
          byType: {
            dealer_profile: { count: 15 },
            inventory: { count: 450 },
            customer_patterns: { count: 890 },
            learned_responses: { count: 340 },
            threat_patterns: { count: 125 },
            conversation_context: { count: 525 },
          },
        },
      });

      setProviders([
        {
          id: '1',
          name: 'OpenAI GPT-4',
          type: 'openai',
          isActive: true,
          defaultModel: 'gpt-4-turbo',
          healthStatus: 'healthy',
          capabilities: ['text', 'embeddings', 'vision'],
        },
        {
          id: '2',
          name: 'Anthropic Claude',
          type: 'anthropic',
          isActive: true,
          defaultModel: 'claude-3-opus',
          healthStatus: 'healthy',
          capabilities: ['text', 'analysis'],
        },
      ]);

      setSelectedProvider('1');
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    }
    setLoading(false);
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'providers', label: 'AI Providers', icon: Cpu },
    { id: 'memory', label: 'Memory', icon: Database },
    { id: 'training', label: 'Training Center', icon: GraduationCap },
    { id: 'threats', label: 'Threat Detection', icon: Shield },
    { id: 'patterns', label: 'Learning Patterns', icon: Sparkles },
    { id: 'tasks', label: 'Tasks & Todo', icon: ListTodo },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
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
              {/* Provider Selector */}
              <select
                value={selectedProvider || ''}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                onClick={loadDashboardData}
                className="p-2 hover:bg-gray-700 rounded-lg transition"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6">
          <nav className="flex space-x-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium rounded-t-lg transition ${
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
      <main className="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && <DashboardTab stats={stats} />}
            {activeTab === 'providers' && <ProvidersTab providers={providers} />}
            {activeTab === 'memory' && <MemoryTab stats={stats?.memory} />}
            {activeTab === 'training' && <TrainingTab />}
            {activeTab === 'threats' && <ThreatsTab stats={stats?.threats} />}
            {activeTab === 'patterns' && <PatternsTab stats={stats?.patterns} />}
            {activeTab === 'tasks' && <TasksTab stats={stats?.tasks} />}
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

function DashboardTab({ stats }: { stats: DashboardStats | null }) {
  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Tasks"
          value={stats.tasks.byStatus.in_progress || 0}
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
          subtitle="Active patterns"
          icon={Sparkles}
          color="green"
        />
      </div>

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
              <div key={index} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center text-sm">
                    {index + 1}
                  </span>
                  <span>{item.pattern.name}</span>
                </div>
                <span className="text-green-400 font-medium">
                  {(item.successRate * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
// Providers Tab
// ============================================

function ProvidersTab({ providers }: { providers: AIProvider[] }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">AI Providers</h2>
        <button className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition">
          <Plus className="w-4 h-4" />
          <span>Add Provider</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {providers.map((provider) => (
          <div key={provider.id} className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${provider.type === 'openai' ? 'bg-green-500/20' : 'bg-orange-500/20'}`}>
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">{provider.name}</h3>
                  <p className="text-sm text-gray-400">{provider.defaultModel}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${
                provider.healthStatus === 'healthy' 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {provider.healthStatus}
              </span>
            </div>

            <div className="mb-4">
              <div className="text-sm text-gray-400 mb-2">Capabilities</div>
              <div className="flex flex-wrap gap-2">
                {provider.capabilities.map((cap) => (
                  <span key={cap} className="px-2 py-1 bg-gray-700 rounded text-xs">
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex space-x-2">
              <button className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition">
                Configure
              </button>
              <button className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition">
                Test Connection
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Memory Tab
// ============================================

function MemoryTab({ stats }: { stats: DashboardStats['memory'] | undefined }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  const memoryTypes = [
    { id: 'all', label: 'All Types' },
    { id: 'dealer_profile', label: 'Dealer Profile' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'customer_patterns', label: 'Customer Patterns' },
    { id: 'learned_responses', label: 'Learned Responses' },
    { id: 'threat_patterns', label: 'Threat Patterns' },
    { id: 'conversation_context', label: 'Conversation Context' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">AI Memory Management</h2>
        <button className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition">
          <Plus className="w-4 h-4" />
          <span>Add Memory</span>
        </button>
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
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition">
          Semantic Search
        </button>
      </div>

      {/* Memory Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats && Object.entries(stats.byType).map(([type, data]) => (
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

      {/* Memory Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Key</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Importance</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Access Count</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Last Accessed</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {/* Mock data rows */}
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i} className="hover:bg-gray-750">
                <td className="px-4 py-3 text-sm">dealer_info_{i}</td>
                <td className="px-4 py-3 text-sm">
                  <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
                    dealer_profile
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center">
                    <div className="w-16 bg-gray-700 rounded-full h-2 mr-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: `${85 - i * 10}%` }} />
                    </div>
                    <span>{0.85 - i * 0.1}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">{50 - i * 8}</td>
                <td className="px-4 py-3 text-sm text-gray-400">2 hours ago</td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex space-x-2">
                    <button className="p-1 hover:bg-gray-600 rounded">
                      <FileText className="w-4 h-4" />
                    </button>
                    <button className="p-1 hover:bg-gray-600 rounded text-red-400">
                      <AlertTriangle className="w-4 h-4" />
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
  const trainingTypes = [
    { id: 'fbm_specialist', name: 'Facebook Marketplace Specialist', progress: 92, status: 'completed' },
    { id: 'customer_service', name: 'Customer Service Excellence', progress: 78, status: 'in_progress' },
    { id: 'inventory_expert', name: 'Inventory Expert', progress: 45, status: 'in_progress' },
    { id: 'threat_detection', name: 'Threat Detection & Defense', progress: 100, status: 'completed' },
    { id: 'negotiation', name: 'Negotiation Mastery', progress: 30, status: 'pending' },
    { id: 'closing_techniques', name: 'Closing Techniques', progress: 0, status: 'not_started' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">AI Training Center</h2>
        <button className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition">
          <Plus className="w-4 h-4" />
          <span>New Training Session</span>
        </button>
      </div>

      {/* Training Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-lg p-6">
          <GraduationCap className="w-8 h-8 mb-2" />
          <div className="text-3xl font-bold">4</div>
          <div className="text-sm opacity-80">Completed Trainings</div>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg p-6">
          <Activity className="w-8 h-8 mb-2" />
          <div className="text-3xl font-bold">2</div>
          <div className="text-sm opacity-80">In Progress</div>
        </div>
        <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg p-6">
          <BarChart3 className="w-8 h-8 mb-2" />
          <div className="text-3xl font-bold">89%</div>
          <div className="text-sm opacity-80">Avg. Success Rate</div>
        </div>
      </div>

      {/* Training Modules */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Training Modules</h3>
        <div className="space-y-4">
          {trainingTypes.map((training) => (
            <div key={training.id} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{training.name}</span>
                  <span className={`px-2 py-1 rounded text-xs ${getTrainingStatusColor(training.status)}`}>
                    {training.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center">
                  <div className="flex-1 bg-gray-600 rounded-full h-2 mr-4">
                    <div
                      className={`h-2 rounded-full ${training.progress === 100 ? 'bg-green-500' : 'bg-purple-500'}`}
                      style={{ width: `${training.progress}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-400">{training.progress}%</span>
                </div>
              </div>
              <button className="ml-4 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-sm transition">
                {training.status === 'not_started' ? 'Start' : training.status === 'completed' ? 'Review' : 'Continue'}
              </button>
            </div>
          ))}
        </div>
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

function ThreatsTab({ stats }: { stats: DashboardStats['threats'] | undefined }) {
  const [filter, setFilter] = useState('all');

  const mockThreats = [
    { id: '1', type: 'scam', severity: 'critical', status: 'escalated', message: 'Overpayment scam attempt...', time: '2 hours ago' },
    { id: '2', type: 'harassment', severity: 'high', status: 'detected', message: 'Aggressive language detected...', time: '5 hours ago' },
    { id: '3', type: 'phishing', severity: 'medium', status: 'resolved', message: 'Suspicious link shared...', time: '1 day ago' },
    { id: '4', type: 'spam', severity: 'low', status: 'false_positive', message: 'Promotional content...', time: '2 days ago' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Threat Detection & Defense</h2>
        <button className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition">
          <Shield className="w-4 h-4" />
          <span>Manage Patterns</span>
        </button>
      </div>

      {/* Threat Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Object.entries(stats.bySeverity).map(([severity, count]) => (
            <div key={severity} className={`rounded-lg p-4 ${getSeverityBg(severity)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{count}</div>
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
        {['all', 'detected', 'escalated', 'resolved', 'false_positive'].map((f) => (
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
            {mockThreats.map((threat) => (
              <tr key={threat.id} className="hover:bg-gray-750">
                <td className="px-4 py-3 text-sm">{threat.message}</td>
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
                <td className="px-4 py-3 text-sm text-gray-400">{threat.time}</td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex space-x-2">
                    <button className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs">
                      View
                    </button>
                    <button className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs">
                      Escalate
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
// Patterns Tab
// ============================================

function PatternsTab({ stats }: { stats: DashboardStats['patterns'] | undefined }) {
  const categories = [
    'response_template',
    'negotiation_tactic',
    'objection_handler',
    'closing_technique',
    'rapport_builder',
    'follow_up_strategy',
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Learning Patterns</h2>
        <button className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition">
          <Plus className="w-4 h-4" />
          <span>Create Pattern</span>
        </button>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        <button className="px-4 py-2 bg-purple-600 rounded-lg text-sm">All</button>
        {categories.map((cat) => (
          <button key={cat} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition capitalize">
            {cat.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Top Performers */}
      {stats && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Top Performing Patterns</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.topPerformers.map((item, index) => (
              <div key={index} className="p-4 bg-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{item.pattern.name}</span>
                  <span className="text-green-400 font-bold">{(item.successRate * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${item.successRate * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Patterns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-medium">Pattern Name {i}</h4>
                <span className="text-xs text-gray-400">Response Template</span>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${i % 2 === 0 ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                {i % 2 === 0 ? 'High Performance' : 'Active'}
              </span>
            </div>
            <p className="text-sm text-gray-400 mb-3">
              Template for handling customer inquiries with personalized response...
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Used: {100 - i * 10} times</span>
              <span className="text-green-400">Success: {90 - i * 5}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Tasks Tab
// ============================================

function TasksTab({ stats }: { stats: DashboardStats['tasks'] | undefined }) {
  const [view, setView] = useState<'list' | 'board'>('list');

  const mockTasks = [
    { id: '1', title: 'Respond to inquiry #1234', type: 'respond_to_message', status: 'pending', priority: 'high', autonomy: 'full' },
    { id: '2', title: 'Follow up with John D.', type: 'follow_up', status: 'waiting_approval', priority: 'medium', autonomy: 'manual_approval' },
    { id: '3', title: 'Fetch Carfax for VIN...', type: 'fetch_report', status: 'in_progress', priority: 'low', autonomy: 'full' },
    { id: '4', title: 'Generate weekly report', type: 'generate_report', status: 'completed', priority: 'medium', autonomy: 'full' },
  ];

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
            <div className="text-2xl font-bold">{stats.byStatus.pending || 0}</div>
            <div className="text-sm text-blue-400">Pending</div>
          </div>
          <div className="bg-yellow-500/20 rounded-lg p-4">
            <div className="text-2xl font-bold">{stats.byStatus.in_progress || 0}</div>
            <div className="text-sm text-yellow-400">In Progress</div>
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

      {/* Pending Approvals */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-3">
          <Clock className="w-5 h-5 text-yellow-400" />
          <h3 className="font-semibold">Pending Approvals</h3>
          <span className="px-2 py-1 bg-yellow-500/20 rounded text-xs text-yellow-400">2</span>
        </div>
        <div className="space-y-2">
          {mockTasks.filter(t => t.status === 'waiting_approval').map((task) => (
            <div key={task.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
              <div>
                <div className="font-medium">{task.title}</div>
                <div className="text-xs text-gray-400">{task.type.replace(/_/g, ' ')}</div>
              </div>
              <div className="flex space-x-2">
                <button className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm">
                  Approve
                </button>
                <button className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm">
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Task List */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Task</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Priority</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Autonomy</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {mockTasks.map((task) => (
              <tr key={task.id} className="hover:bg-gray-750">
                <td className="px-4 py-3 text-sm">{task.title}</td>
                <td className="px-4 py-3 text-sm">
                  <span className="capitalize">{task.type.replace(/_/g, ' ')}</span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${getTaskStatusBadge(task.status)}`}>
                    {task.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${getPriorityBadge(task.priority)}`}>
                    {task.priority}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${getAutonomyBadge(task.autonomy)}`}>
                    {task.autonomy.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <button className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs">
                    View
                  </button>
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

function getAutonomyBadge(autonomy: string): string {
  const colors: Record<string, string> = {
    full: 'bg-green-500/20 text-green-400',
    supervised: 'bg-blue-500/20 text-blue-400',
    manual_approval: 'bg-yellow-500/20 text-yellow-400',
  };
  return colors[autonomy] || 'bg-gray-500/20 text-gray-400';
}
