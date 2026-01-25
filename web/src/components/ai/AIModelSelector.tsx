/**
 * AI Agent & Model Selector Component
 * 
 * Visual indicator showing which AI model is active
 * Allows switching between agents and models
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Bot,
  Cpu,
  Sparkles,
  ChevronDown,
  Check,
  Zap,
  Activity,
  Clock,
  Settings2,
  Loader2,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface AIAgent {
  id: string;
  name: string;
  codename: string;
  description: string;
  activeModel: string;
  modelDisplayName: string;
  provider: string;
  color: string;
  icon: string;
  role: string;
  status: string;
  lastActivity?: Date;
  totalRequests: number;
  avgResponseTime: number;
}

interface AIModel {
  id: string;
  provider: string;
  displayName: string;
  tier: string;
  contextWindow: number;
  maxOutputTokens: number;
  capabilities: string[];
}

interface AIProvider {
  provider: string;
  configured: boolean;
  healthy: boolean;
  modelCount: number;
}

// ============================================
// ICON MAPPING
// ============================================

const getProviderIcon = (provider: string, className?: string) => {
  switch (provider) {
    case 'anthropic':
      return <Sparkles className={className} />;
    case 'openai':
      return <Cpu className={className} />;
    case 'deepseek':
      return <Zap className={className} />;
    case 'google':
      return <Activity className={className} />;
    default:
      return <Bot className={className} />;
  }
};

const getTierColor = (tier: string) => {
  switch (tier) {
    case 'flagship':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'standard':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'economy':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'legacy':
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

// ============================================
// ACTIVE AGENT INDICATOR (Compact)
// ============================================

interface ActiveAgentIndicatorProps {
  className?: string;
  onClick?: () => void;
  showDetails?: boolean;
}

export const ActiveAgentIndicator: React.FC<ActiveAgentIndicatorProps> = ({
  className = '',
  onClick,
  showDetails = true,
}) => {
  const [agent, setAgent] = useState<AIAgent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActiveAgent = async () => {
      try {
        const response = await api.get('/ai-models/agents/active');
        if (response.data.success && response.data.data) {
          setAgent(response.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch active agent:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveAgent();
    const interval = setInterval(fetchActiveAgent, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-sm text-red-400">No Agent Active</span>
      </div>
    );
  }

  return (
    <motion.button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:border-gray-600 transition-colors ${className}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Status indicator */}
      <div
        className="w-2 h-2 rounded-full animate-pulse"
        style={{ backgroundColor: agent.color }}
      />

      {/* Agent icon */}
      <span className="text-lg">{agent.icon}</span>

      {/* Agent name */}
      <span className="text-sm font-medium text-white">{agent.name}</span>

      {showDetails && (
        <>
          <span className="text-gray-500">|</span>
          <span className="text-xs text-gray-400">{agent.modelDisplayName}</span>
        </>
      )}

      <ChevronDown className="w-3 h-3 text-gray-500" />
    </motion.button>
  );
};

// ============================================
// FULL AI MODEL SELECTOR PANEL
// ============================================

interface AIModelSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onModelChange?: (agentId: string, modelId: string) => void;
}

export const AIModelSelector: React.FC<AIModelSelectorProps> = ({
  isOpen,
  onClose,
  onModelChange,
}) => {
  const toast = useToast();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [agentsRes, modelsRes, providersRes] = await Promise.all([
        api.get('/ai-models/agents'),
        api.get('/ai-models/models'),
        api.get('/ai-models/providers'),
      ]);

      if (agentsRes.data.success) {
        setAgents(agentsRes.data.data.agents);
        // Select primary agent by default
        const primary = agentsRes.data.data.agents.find((a: AIAgent) => a.role === 'primary');
        if (primary) setSelectedAgent(primary.id);
      }

      if (modelsRes.data.success) {
        setModels(modelsRes.data.data);
      }

      if (providersRes.data.success) {
        setProviders(providersRes.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch AI data:', error);
      toast.error('Failed to load AI configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleModelChange = async (agentId: string, modelId: string) => {
    setChanging(true);
    try {
      const response = await api.put(`/ai-models/agents/${agentId}/model`, { modelId });

      if (response.data.success) {
        toast.success(
          `${response.data.data.newModelName} now powering ${agentId.charAt(0).toUpperCase() + agentId.slice(1)}`
        );

        // Update local state
        setAgents(prev =>
          prev.map(a =>
            a.id === agentId
              ? {
                  ...a,
                  activeModel: modelId,
                  modelDisplayName: models.find(m => m.id === modelId)?.displayName || modelId,
                }
              : a
          )
        );

        onModelChange?.(agentId, modelId);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to change model');
    } finally {
      setChanging(false);
    }
  };

  const activeAgent = agents.find(a => a.id === selectedAgent);

  if (!isOpen) return null;

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
          className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Brain className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">AI Model Configuration</h2>
                <p className="text-sm text-gray-400">Select which models power each AI agent</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Settings2 className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
          ) : (
            <div className="flex h-[600px]">
              {/* Agents Sidebar */}
              <div className="w-64 border-r border-gray-700 p-4 space-y-2 overflow-y-auto">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  AI Agents
                </h3>
                {agents.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent.id)}
                    className={`w-full p-3 rounded-xl text-left transition-all ${
                      selectedAgent === agent.id
                        ? 'bg-gray-800 border-2'
                        : 'hover:bg-gray-800/50 border-2 border-transparent'
                    }`}
                    style={{
                      borderColor: selectedAgent === agent.id ? agent.color : 'transparent',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{agent.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{agent.name}</span>
                          <div
                            className={`w-2 h-2 rounded-full ${
                              agent.status === 'active'
                                ? 'bg-green-500'
                                : agent.status === 'standby'
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                          />
                        </div>
                        <p className="text-xs text-gray-500 truncate">{agent.modelDisplayName}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                      <span>{agent.totalRequests} requests</span>
                      <span>{agent.avgResponseTime}ms avg</span>
                    </div>
                  </button>
                ))}

                {/* Provider Status */}
                <div className="pt-4 mt-4 border-t border-gray-700">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Providers
                  </h3>
                  {providers.map(provider => (
                    <div
                      key={provider.provider}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        {getProviderIcon(provider.provider, 'w-4 h-4 text-gray-400')}
                        <span className="text-gray-300 capitalize">{provider.provider}</span>
                      </div>
                      <div
                        className={`w-2 h-2 rounded-full ${
                          provider.configured ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Model Selection */}
              <div className="flex-1 p-6 overflow-y-auto">
                {activeAgent && (
                  <>
                    <div className="mb-6">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl">{activeAgent.icon}</span>
                        <div>
                          <h3 className="text-xl font-semibold text-white">
                            {activeAgent.name}
                            <span className="ml-2 text-sm font-normal text-gray-500">
                              ({activeAgent.codename})
                            </span>
                          </h3>
                          <p className="text-sm text-gray-400">{activeAgent.description}</p>
                        </div>
                      </div>
                    </div>

                    {/* Models grouped by provider */}
                    {['anthropic', 'openai', 'deepseek', 'google'].map(provider => {
                      const providerModels = models.filter(m => m.provider === provider);
                      const providerConfig = providers.find(p => p.provider === provider);

                      if (providerModels.length === 0) return null;

                      return (
                        <div key={provider} className="mb-6">
                          <div className="flex items-center gap-2 mb-3">
                            {getProviderIcon(provider, 'w-4 h-4 text-gray-400')}
                            <h4 className="text-sm font-semibold text-gray-300 uppercase">
                              {provider}
                            </h4>
                            {!providerConfig?.configured && (
                              <span className="text-xs text-red-400">(Not Configured)</span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            {providerModels.map(model => {
                              const isActive = activeAgent.activeModel === model.id;
                              const isDisabled = !providerConfig?.configured;

                              return (
                                <button
                                  key={model.id}
                                  onClick={() =>
                                    !isDisabled &&
                                    !changing &&
                                    handleModelChange(activeAgent.id, model.id)
                                  }
                                  disabled={isDisabled || changing}
                                  className={`relative p-4 rounded-xl text-left transition-all ${
                                    isActive
                                      ? 'bg-purple-500/20 border-2 border-purple-500'
                                      : isDisabled
                                      ? 'bg-gray-800/30 border border-gray-700/50 opacity-50 cursor-not-allowed'
                                      : 'bg-gray-800/50 border border-gray-700 hover:border-gray-600'
                                  }`}
                                >
                                  {isActive && (
                                    <div className="absolute top-2 right-2">
                                      <Check className="w-4 h-4 text-purple-400" />
                                    </div>
                                  )}

                                  <div className="flex items-start justify-between mb-2">
                                    <span className="font-medium text-white">
                                      {model.displayName}
                                    </span>
                                    <span
                                      className={`text-xs px-2 py-0.5 rounded-full border ${getTierColor(
                                        model.tier
                                      )}`}
                                    >
                                      {model.tier}
                                    </span>
                                  </div>

                                  <div className="space-y-1 text-xs text-gray-500">
                                    <div className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      <span>{(model.contextWindow / 1000).toFixed(0)}K context</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {model.capabilities.slice(0, 3).map(cap => (
                                        <span
                                          key={cap}
                                          className="px-1.5 py-0.5 bg-gray-700/50 rounded text-gray-400"
                                        >
                                          {cap}
                                        </span>
                                      ))}
                                      {model.capabilities.length > 3 && (
                                        <span className="text-gray-500">
                                          +{model.capabilities.length - 3}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ============================================
// HEADER AGENT BADGE (For TopNav)
// ============================================

interface HeaderAgentBadgeProps {
  className?: string;
}

export const HeaderAgentBadge: React.FC<HeaderAgentBadgeProps> = ({ className = '' }) => {
  const [agent, setAgent] = useState<AIAgent | null>(null);
  const [showSelector, setShowSelector] = useState(false);

  useEffect(() => {
    const fetchAgent = async () => {
      try {
        const response = await api.get('/ai-models/agents/active');
        if (response.data.success && response.data.data) {
          setAgent(response.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch agent:', error);
      }
    };

    fetchAgent();
    const interval = setInterval(fetchAgent, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!agent) return null;

  return (
    <>
      <motion.button
        onClick={() => setShowSelector(true)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${className}`}
        style={{ backgroundColor: `${agent.color}20`, borderColor: `${agent.color}40` }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ backgroundColor: agent.color }}
        />
        <span className="text-xl">{agent.icon}</span>
        <span className="text-sm font-medium" style={{ color: agent.color }}>
          {agent.name}
        </span>
        <span className="text-xs text-gray-500">via {agent.modelDisplayName}</span>
      </motion.button>

      <AIModelSelector
        isOpen={showSelector}
        onClose={() => setShowSelector(false)}
      />
    </>
  );
};

export default AIModelSelector;
