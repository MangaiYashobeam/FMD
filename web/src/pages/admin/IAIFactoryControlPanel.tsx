/**
 * IAI Factory Control Panel
 * 
 * Advanced IAI Creation and Orchestration System
 * Root admin interface for total control over IAI creation, connections,
 * and deployment with visual connection-based logic.
 * 
 * Features:
 * - Visual connection builder (IAI → Company/User/Pattern/Container)
 * - Rate control & scheduling for IAI creation
 * - Lifespan management and hot-swap at birth
 * - Batch IAI deployment orchestration
 * - Real-time creation monitoring
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Factory,
  Zap,
  Link,
  GitBranch,
  Package,
  Users,
  Building2,
  Clock,
  PlayCircle,
  StopCircle,
  RefreshCw,
  Settings,
  Plus,
  Trash2,
  Edit,
  Eye,
  XCircle,
  Activity,
  Target,
  Shuffle,
  Timer,
  Rocket,
  Box,
  Cpu,
  Network,
  MoreVertical,
  Save,
  ZoomIn,
  ZoomOut,
  Crosshair,
  AlertCircle,
  CheckCircle,
  MousePointer,
  Play,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { api } from '../../lib/api';

// ============================================
// Types
// ============================================

// Connection node types for visual builder
type NodeType = 'iai' | 'company' | 'user' | 'pattern' | 'container' | 'trigger' | 'condition' | 'action';

interface ConnectionNode {
  id: string;
  type: NodeType;
  label: string;
  data: Record<string, any>;
  position: { x: number; y: number };
  connections: string[]; // IDs of connected nodes
}

interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'assign' | 'inject' | 'deploy' | 'monitor' | 'trigger' | 'condition' | 'action';
  config: Record<string, any>;
}

// Targeting Trigger types
interface TargetingTrigger {
  id: string;
  name: string;
  type: 'schedule' | 'event' | 'threshold' | 'webhook' | 'manual';
  config: Record<string, any>;
  enabled: boolean;
}

// Targeting Condition types
interface TargetingCondition {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'not_in' | 'exists' | 'regex';
  value: any;
  logic: 'AND' | 'OR';
}

// Targeting Action types
interface TargetingAction {
  id: string;
  name: string;
  type: 'assign_pattern' | 'inject_container' | 'notify' | 'hot_swap' | 'terminate' | 'scale' | 'webhook';
  config: Record<string, any>;
  priority: number;
}

// User for targeting
interface TargetUser {
  id: string;
  email: string;
  name: string;
  companyId: string | null;
}

// IAI Blueprint - template for IAI creation
interface IAIBlueprint {
  id: string;
  name: string;
  description: string | null;
  type: 'standard' | 'ultra_speed' | 'stealth' | 'hybrid' | 'custom';
  baseConfig: Record<string, any>;
  containerIds: string[];
  patternIds: string[];
  hotSwapEnabled: boolean;
  hotSwapPatterns: string[];
  creationRate: number; // per minute
  maxConcurrent: number;
  lifespan: number; // minutes, 0 = infinite
  autoRespawn: boolean;
  targeting: {
    companyIds: string[];
    userIds: string[];
    conditions: TargetingCondition[];
    triggers: TargetingTrigger[];
    actions: TargetingAction[];
  };
  schedule: {
    enabled: boolean;
    cronExpression: string | null;
    timezone: string;
    startDate: string | null;
    endDate: string | null;
  };
  isActive: boolean;
  priority: number;
  tags: string[];
  stats: {
    totalCreated: number;
    activeCount: number;
    successRate: number;
    avgLifespan: number;
  };
  createdAt: string;
  updatedAt: string;
}

// IAI Instance - created from blueprint
interface IAIInstance {
  id: string;
  blueprintId: string;
  blueprintName: string;
  status: 'spawning' | 'active' | 'executing' | 'idle' | 'terminated' | 'error';
  currentPattern: string | null;
  assignedCompany: string | null;
  assignedUser: string | null;
  containerId: string | null;
  spawnedAt: string;
  lastActiveAt: string | null;
  expiresAt: string | null;
  executionCount: number;
  successCount: number;
  errorCount: number;
  config: Record<string, any>;
}

// Factory stats
interface FactoryStats {
  totalBlueprints: number;
  activeBlueprints: number;
  totalInstances: number;
  activeInstances: number;
  spawningRate: number;
  terminationRate: number;
  avgSuccessRate: number;
  avgLifespan: number;
  recentActivity: Array<{
    type: string;
    message: string;
    timestamp: string;
  }>;
}

// Containers and patterns for selection
interface Container {
  id: string;
  name: string;
  category: string;
  isActive: boolean;
  patternCount: number;
}

interface Pattern {
  id: string;
  containerId: string;
  name: string;
  codeType: string;
  isActive: boolean;
}

interface Company {
  id: string;
  name: string;
  userCount: number;
}

// ============================================
// API Functions
// ============================================

async function fetchFactoryStats(): Promise<FactoryStats> {
  const response = await api.get('/api/iai-factory/stats');
  return response.data.stats;
}

async function fetchBlueprints(options?: { isActive?: boolean; type?: string }): Promise<IAIBlueprint[]> {
  const params = new URLSearchParams();
  if (options?.isActive !== undefined) params.append('isActive', String(options.isActive));
  if (options?.type) params.append('type', options.type);
  const response = await api.get(`/api/iai-factory/blueprints?${params.toString()}`);
  return response.data.blueprints || [];
}

async function createBlueprint(data: Partial<IAIBlueprint>): Promise<IAIBlueprint> {
  const response = await api.post('/api/iai-factory/blueprints', data);
  return response.data.blueprint;
}

async function updateBlueprint(id: string, data: Partial<IAIBlueprint>): Promise<IAIBlueprint> {
  const response = await api.put(`/api/iai-factory/blueprints/${id}`, data);
  return response.data.blueprint;
}

async function deleteBlueprint(id: string): Promise<void> {
  await api.delete(`/api/iai-factory/blueprints/${id}`);
}

// activateBlueprint and deactivateBlueprint are available but currently
// using updateBlueprint with isActive flag instead

async function spawnInstances(blueprintId: string, count: number): Promise<IAIInstance[]> {
  const response = await api.post(`/api/iai-factory/blueprints/${blueprintId}/spawn`, { count });
  return response.data.instances;
}

async function fetchInstances(options?: { status?: string; blueprintId?: string }): Promise<IAIInstance[]> {
  const params = new URLSearchParams();
  if (options?.status) params.append('status', options.status);
  if (options?.blueprintId) params.append('blueprintId', options.blueprintId);
  const response = await api.get(`/api/iai-factory/instances?${params.toString()}`);
  return response.data.instances || [];
}

async function terminateInstance(id: string): Promise<void> {
  await api.post(`/api/iai-factory/instances/${id}/terminate`);
}

async function terminateAll(blueprintId?: string): Promise<{ terminated: number }> {
  const response = await api.post('/api/iai-factory/instances/terminate-all', { blueprintId });
  return response.data;
}

async function fetchContainers(): Promise<Container[]> {
  const response = await api.get('/api/injection/containers');
  return response.data.data || [];
}

async function fetchPatterns(containerId?: string): Promise<Pattern[]> {
  const params = containerId ? `?containerId=${containerId}` : '';
  const response = await api.get(`/api/injection/patterns${params}`);
  return response.data.data || [];
}

async function fetchCompanies(): Promise<Company[]> {
  try {
    // Use accounts endpoint (system uses "accounts" not "companies")
    const response = await api.get('/api/admin/accounts');
    // API returns { accounts: [...] } or { data: [...] }
    const accounts = response.data.accounts || response.data.data || response.data || [];
    // Map accounts to Company interface
    return Array.isArray(accounts) ? accounts.map((acc: any) => ({
      id: acc.id,
      name: acc.dealershipName || acc.name || 'Unknown Account',
      dealershipName: acc.dealershipName,
      status: acc.status,
      createdAt: acc.createdAt,
      ...acc
    })) : [];
  } catch (error) {
    console.warn('Failed to fetch accounts:', error);
    return [];
  }
}

async function fetchUsers(companyId?: string): Promise<TargetUser[]> {
  try {
    const params = companyId ? `?companyId=${companyId}` : '';
    const response = await api.get(`/api/admin/users${params}`);
    return response.data.users || response.data.data || [];
  } catch (error) {
    console.warn('Failed to fetch users');
    return [];
  }
}

// ============================================
// v2.3.0 Predefined Templates
// ============================================

interface PredefinedTemplate {
  id: string;
  name: string;
  description: string;
  category: 'SOLDIER' | 'STEALTH' | 'NOVA' | 'SYSTEM';
  targetGenre: 'SOLDIER' | 'STEALTH' | 'NOVA';
  targetSource: 'EXTENSION' | 'CHROMIUM';
  targetMode: 'USM' | 'STEALTH' | 'HYBRID' | 'NOVA_AI';
  nodeLayout: ConnectionNode[];
  connectionMap: Connection[];
  recommendedConfig: Record<string, unknown>;
  isDefault: boolean;
  usageCount: number;
}

async function fetchPredefinedTemplates(options?: {
  category?: string;
  genre?: string;
  source?: string;
  mode?: string;
}): Promise<PredefinedTemplate[]> {
  const params = new URLSearchParams();
  if (options?.category) params.append('category', options.category);
  if (options?.genre) params.append('genre', options.genre);
  if (options?.source) params.append('source', options.source);
  if (options?.mode) params.append('mode', options.mode);
  const response = await api.get(`/api/iai-factory/templates?${params.toString()}`);
  return response.data.templates || [];
}

async function saveConnectionMap(data: {
  name: string;
  description?: string;
  nodes: ConnectionNode[];
  connections: Connection[];
  isTemplate?: boolean;
  category?: string;
}): Promise<{ id: string }> {
  const response = await api.post('/api/iai-factory/connection-maps', data);
  return response.data;
}

async function loadConnectionMap(id: string): Promise<{
  nodes: ConnectionNode[];
  connections: Connection[];
}> {
  const response = await api.get(`/api/iai-factory/connection-maps/${id}`);
  return {
    nodes: response.data.map.nodes || [],
    connections: response.data.map.connections || [],
  };
}

async function fetchSavedConnectionMaps(): Promise<Array<{
  id: string;
  name: string;
  description: string | null;
  isTemplate: boolean;
  category: string | null;
  createdAt: string;
}>> {
  const response = await api.get('/api/iai-factory/connection-maps');
  return response.data.maps || [];
}

// fetchUsers available for future use when implementing user targeting
// async function fetchUsers(companyId?: string): Promise<User[]> { ... }

// ============================================
// Sub-Components
// ============================================

// Factory Stats Overview
function FactoryStatsGrid({ stats }: { stats: FactoryStats }) {
  const statCards = [
    {
      title: 'Active Blueprints',
      value: stats.activeBlueprints,
      total: stats.totalBlueprints,
      icon: Package,
      color: 'bg-blue-600',
    },
    {
      title: 'Active Instances',
      value: stats.activeInstances,
      total: stats.totalInstances,
      icon: Cpu,
      color: 'bg-green-600',
    },
    {
      title: 'Spawn Rate',
      value: `${stats.spawningRate}/min`,
      icon: Rocket,
      color: 'bg-purple-600',
    },
    {
      title: 'Success Rate',
      value: `${(stats.avgSuccessRate * 100).toFixed(1)}%`,
      icon: Target,
      color: 'bg-emerald-600',
    },
    {
      title: 'Avg Lifespan',
      value: `${stats.avgLifespan}m`,
      icon: Timer,
      color: 'bg-orange-600',
    },
    {
      title: 'Termination Rate',
      value: `${stats.terminationRate}/min`,
      icon: XCircle,
      color: 'bg-red-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {statCards.map((card, idx) => (
        <div
          key={idx}
          className="bg-slate-800 rounded-xl border border-slate-700 p-4 hover:border-slate-600 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <div className={`${card.color} rounded-lg p-2`}>
              <card.icon className="w-4 h-4 text-white" />
            </div>
            {card.total !== undefined && (
              <span className="text-xs text-slate-500">/ {card.total}</span>
            )}
          </div>
          <p className="text-lg font-bold text-white">{card.value}</p>
          <p className="text-xs text-slate-400">{card.title}</p>
        </div>
      ))}
    </div>
  );
}

// Status Badge
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    spawning: 'bg-yellow-600 text-white animate-pulse',
    active: 'bg-green-600 text-white',
    executing: 'bg-purple-600 text-white animate-pulse',
    idle: 'bg-slate-600 text-slate-200',
    terminated: 'bg-slate-700 text-slate-400',
    error: 'bg-red-600 text-white',
    standard: 'bg-blue-600 text-white',
    ultra_speed: 'bg-orange-600 text-white',
    stealth: 'bg-slate-600 text-white',
    hybrid: 'bg-purple-600 text-white',
    custom: 'bg-cyan-600 text-white',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-slate-600 text-slate-200'}`}>
      {status.replace('_', ' ').toUpperCase()}
    </span>
  );
}

// Type Badge
function TypeBadge({ type }: { type: string }) {
  const icons: Record<string, any> = {
    standard: Box,
    ultra_speed: Zap,
    stealth: Eye,
    hybrid: GitBranch,
    custom: Settings,
  };
  const Icon = icons[type] || Box;

  return (
    <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
      <Icon className="w-3 h-3" />
      {type.replace('_', ' ')}
    </span>
  );
}

// Connection Node Component (for visual builder) with drag support
interface NodeProps {
  node: ConnectionNode;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onConnect: (sourceId: string) => void;
  onPositionChange: (id: string, position: { x: number; y: number }) => void;
  onDelete: (id: string) => void;
  scale: number;
}

function ConnectionNodeComponent({ node, isSelected, onSelect, onConnect, onPositionChange, onDelete, scale }: NodeProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const typeConfig: Record<NodeType, { icon: any; color: string; label: string }> = {
    iai: { icon: Cpu, color: 'bg-purple-600 border-purple-400', label: 'IAI' },
    company: { icon: Building2, color: 'bg-blue-600 border-blue-400', label: 'Company' },
    user: { icon: Users, color: 'bg-green-600 border-green-400', label: 'User' },
    pattern: { icon: Package, color: 'bg-orange-600 border-orange-400', label: 'Pattern' },
    container: { icon: Box, color: 'bg-cyan-600 border-cyan-400', label: 'Container' },
    trigger: { icon: Zap, color: 'bg-yellow-600 border-yellow-400', label: 'Trigger' },
    condition: { icon: GitBranch, color: 'bg-pink-600 border-pink-400', label: 'Condition' },
    action: { icon: Play, color: 'bg-emerald-600 border-emerald-400', label: 'Action' },
  };

  const config = typeConfig[node.type];
  const Icon = config.icon;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - node.position.x * scale,
      y: e.clientY - node.position.y * scale
    });
    onSelect(node.id);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = (e.clientX - dragStart.x) / scale;
      const newY = (e.clientY - dragStart.y) / scale;
      onPositionChange(node.id, { 
        x: Math.max(0, newX), 
        y: Math.max(0, newY) 
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart, node.id, onPositionChange, scale]);

  return (
    <div
      ref={nodeRef}
      className={`
        absolute select-none
        ${isSelected ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-900 z-20' : 'z-10'}
        ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
      `}
      style={{ 
        left: node.position.x, 
        top: node.position.y,
        transform: `scale(${1})`,
      }}
      onMouseDown={handleMouseDown}
    >
      <div className={`${config.color} rounded-lg p-3 border-2 min-w-[140px] shadow-lg`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-white" />
            <span className="text-xs text-white/70 font-medium">{config.label}</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
            className="w-4 h-4 flex items-center justify-center rounded-full bg-red-500/50 hover:bg-red-500 text-white transition-colors"
            title="Delete node"
          >
            <XCircle className="w-3 h-3" />
          </button>
        </div>
        <p className="text-sm font-semibold text-white truncate">{node.label}</p>
        {node.connections.length > 0 && (
          <div className="mt-2 flex items-center gap-1 text-xs text-white/60">
            <Link className="w-3 h-3" />
            {node.connections.length} connections
          </div>
        )}
      </div>
      
      {/* Input port (left) */}
      <div
        className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full border-2 border-slate-900 cursor-pointer hover:bg-blue-400 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onConnect(node.id);
        }}
        title="Input port"
      />
      
      {/* Output port (right) */}
      <button
        className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-yellow-500 rounded-full border-2 border-slate-900 hover:bg-yellow-400 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onConnect(node.id);
        }}
        title="Output port - Click to connect"
      />
    </div>
  );
}

// Visual Connection Builder with Zoom & Pan
interface ConnectionBuilderProps {
  nodes: ConnectionNode[];
  connections: Connection[];
  onNodesChange: (nodes: ConnectionNode[]) => void;
  onConnectionsChange: (connections: Connection[]) => void;
  onAddNode: (type: NodeType, data?: Record<string, any>) => void;
  containers: Container[];
  patterns: Pattern[];
  companies: Company[];
  users: TargetUser[];
}

function ConnectionBuilder({
  nodes,
  connections,
  onNodesChange,
  onConnectionsChange,
  onAddNode,
  containers,
  patterns,
  companies,
  users,
}: ConnectionBuilderProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const [showNodePicker, setShowNodePicker] = useState<NodeType | null>(null);

  const handleConnect = (sourceId: string) => {
    if (connectingFrom === null) {
      setConnectingFrom(sourceId);
    } else if (connectingFrom !== sourceId) {
      // Create connection
      const newConnection: Connection = {
        id: `conn-${Date.now()}`,
        sourceId: connectingFrom,
        targetId: sourceId,
        type: 'assign',
        config: {},
      };
      onConnectionsChange([...connections, newConnection]);
      
      // Update node connections
      const updatedNodes = nodes.map(n => {
        if (n.id === connectingFrom) {
          return { ...n, connections: [...n.connections, sourceId] };
        }
        return n;
      });
      onNodesChange(updatedNodes);
      setConnectingFrom(null);
    }
  };

  const handlePositionChange = useCallback((id: string, position: { x: number; y: number }) => {
    onNodesChange(nodes.map(n => n.id === id ? { ...n, position } : n));
  }, [nodes, onNodesChange]);

  const handleDeleteNode = (id: string) => {
    onNodesChange(nodes.filter(n => n.id !== id));
    onConnectionsChange(connections.filter(c => c.sourceId !== id && c.targetId !== id));
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.min(2, Math.max(0.25, prev + delta)));
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) { // Middle click or Shift+Left click
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  useEffect(() => {
    if (!isPanning) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    };

    const handleMouseUp = () => setIsPanning(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning, panStart]);

  const nodeTypes: { type: NodeType; icon: any; label: string; color: string }[] = [
    { type: 'iai', icon: Cpu, label: 'IAI', color: 'bg-purple-600' },
    { type: 'company', icon: Building2, label: 'Company', color: 'bg-blue-600' },
    { type: 'user', icon: Users, label: 'User', color: 'bg-green-600' },
    { type: 'pattern', icon: Package, label: 'Pattern', color: 'bg-orange-600' },
    { type: 'container', icon: Box, label: 'Container', color: 'bg-cyan-600' },
    { type: 'trigger', icon: Zap, label: 'Trigger', color: 'bg-yellow-600' },
    { type: 'condition', icon: GitBranch, label: 'Condition', color: 'bg-pink-600' },
    { type: 'action', icon: Play, label: 'Action', color: 'bg-emerald-600' },
  ];

  const handleAddNodeWithData = (type: NodeType, item?: any) => {
    const data = item ? { id: item.id, name: item.name || item.email } : {};
    const label = item ? (item.name || item.email || `New ${type}`) : `New ${type}`;
    onAddNode(type, { ...data, label });
    setShowNodePicker(null);
  };

  const renderNodePicker = () => {
    if (!showNodePicker) return null;

    let items: any[] = [];
    let title = '';

    switch (showNodePicker) {
      case 'company':
        items = companies;
        title = 'Select Company';
        break;
      case 'user':
        items = users;
        title = 'Select User';
        break;
      case 'pattern':
        items = patterns;
        title = 'Select Pattern';
        break;
      case 'container':
        items = containers;
        title = 'Select Container';
        break;
      default:
        handleAddNodeWithData(showNodePicker);
        return null;
    }

    return (
      <div className="absolute top-16 left-4 z-30 bg-slate-800 rounded-lg border border-slate-600 shadow-xl max-h-60 overflow-y-auto min-w-[200px]">
        <div className="sticky top-0 bg-slate-800 px-3 py-2 border-b border-slate-700 flex justify-between items-center">
          <span className="text-sm font-medium text-white">{title}</span>
          <button onClick={() => setShowNodePicker(null)} className="text-slate-400 hover:text-white">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
        <div className="p-2 space-y-1">
          <button
            onClick={() => handleAddNodeWithData(showNodePicker)}
            className="w-full px-3 py-2 text-left text-sm text-yellow-400 hover:bg-slate-700 rounded flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Generic {showNodePicker}
          </button>
          {items.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">No items available</p>
          ) : (
            items.map(item => (
              <button
                key={item.id}
                onClick={() => handleAddNodeWithData(showNodePicker, item)}
                className="w-full px-3 py-2 text-left text-sm text-white hover:bg-slate-700 rounded truncate"
              >
                {item.name || item.email}
              </button>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      {/* Toolbar */}
      <div className="bg-slate-800 border-b border-slate-700 p-3 flex items-center gap-2 flex-wrap">
        <span className="text-sm text-slate-400 mr-2 flex items-center gap-1">
          <Plus className="w-4 h-4" /> Add:
        </span>
        {nodeTypes.map(({ type, icon: Icon, label, color }) => (
          <button
            key={type}
            onClick={() => ['company', 'user', 'pattern', 'container'].includes(type) ? setShowNodePicker(type) : handleAddNodeWithData(type)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded ${color} hover:opacity-80 text-xs text-white font-medium transition-all`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
        
        <div className="flex-1" />
        
        {/* Zoom controls */}
        <div className="flex items-center gap-2 bg-slate-700 rounded-lg px-2 py-1">
          <button
            onClick={() => setScale(prev => Math.max(0.25, prev - 0.1))}
            className="p-1 hover:bg-slate-600 rounded text-white"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-white min-w-[45px] text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale(prev => Math.min(2, prev + 0.1))}
            className="p-1 hover:bg-slate-600 rounded text-white"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }}
            className="p-1 hover:bg-slate-600 rounded text-white"
            title="Reset View"
          >
            <Crosshair className="w-4 h-4" />
          </button>
        </div>
        
        {connectingFrom && (
          <span className="text-sm text-yellow-400 animate-pulse flex items-center gap-2">
            <MousePointer className="w-4 h-4" />
            Click another node to connect
            <button
              onClick={() => setConnectingFrom(null)}
              className="text-slate-400 hover:text-white underline"
            >
              Cancel
            </button>
          </span>
        )}
      </div>

      {/* Canvas */}
      <div 
        ref={canvasRef}
        className={`relative h-[500px] overflow-hidden ${isPanning ? 'cursor-grabbing' : 'cursor-default'}`}
        onWheel={handleWheel}
        onMouseDown={handleCanvasMouseDown}
        style={{
          backgroundImage: `radial-gradient(circle, #334155 1px, transparent 1px)`,
          backgroundSize: `${20 * scale}px ${20 * scale}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        {renderNodePicker()}
        
        {/* Transformable content */}
        <div 
          style={{ 
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            width: '2000px',
            height: '2000px',
          }}
        >
          {/* Draw connections */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#facc15" />
              </marker>
            </defs>
            {connections.map(conn => {
              const source = nodes.find(n => n.id === conn.sourceId);
              const target = nodes.find(n => n.id === conn.targetId);
              if (!source || !target) return null;
              
              const x1 = source.position.x + 150;
              const y1 = source.position.y + 35;
              const x2 = target.position.x;
              const y2 = target.position.y + 35;
              
              // Bezier curve for smoother connections
              const midX = (x1 + x2) / 2;
              
              return (
                <g key={conn.id}>
                  <path
                    d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                    stroke="#facc15"
                    strokeWidth="2"
                    fill="none"
                    markerEnd="url(#arrowhead)"
                  />
                </g>
              );
            })}
          </svg>

          {/* Render nodes */}
          {nodes.map(node => (
            <ConnectionNodeComponent
              key={node.id}
              node={node}
              isSelected={selectedNode === node.id}
              onSelect={setSelectedNode}
              onConnect={handleConnect}
              onPositionChange={handlePositionChange}
              onDelete={handleDeleteNode}
              scale={scale}
            />
          ))}
        </div>

        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500 pointer-events-none">
            <div className="text-center">
              <Network className="w-16 h-16 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">Visual Connection Builder</p>
              <p className="text-sm mt-1">Click buttons above to add nodes</p>
              <p className="text-xs mt-2 text-slate-600">Drag nodes to position • Scroll to zoom • Shift+drag to pan</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Blueprint Card
interface BlueprintCardProps {
  blueprint: IAIBlueprint;
  onEdit: (blueprint: IAIBlueprint) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  onSpawn: (id: string) => void;
}

function BlueprintCard({ blueprint, onEdit, onDelete, onToggleActive, onSpawn }: BlueprintCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 hover:border-slate-600 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <TypeBadge type={blueprint.type} />
          {blueprint.isActive && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Active
            </span>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-slate-700 rounded-lg shadow-xl border border-slate-600 py-1 z-10 min-w-[120px]">
              <button
                onClick={() => { onEdit(blueprint); setShowMenu(false); }}
                className="w-full px-3 py-1.5 text-left text-sm text-white hover:bg-slate-600 flex items-center gap-2"
              >
                <Edit className="w-3 h-3" /> Edit
              </button>
              <button
                onClick={() => { onToggleActive(blueprint.id, !blueprint.isActive); setShowMenu(false); }}
                className="w-full px-3 py-1.5 text-left text-sm text-white hover:bg-slate-600 flex items-center gap-2"
              >
                {blueprint.isActive ? <StopCircle className="w-3 h-3" /> : <PlayCircle className="w-3 h-3" />}
                {blueprint.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={() => { onDelete(blueprint.id); setShowMenu(false); }}
                className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-slate-600 flex items-center gap-2"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <h3 className="text-lg font-semibold text-white mb-1">{blueprint.name}</h3>
      {blueprint.description && (
        <p className="text-sm text-slate-400 mb-3 line-clamp-2">{blueprint.description}</p>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-slate-900 rounded-lg p-2">
          <p className="text-xs text-slate-500">Created</p>
          <p className="text-sm font-medium text-white">{blueprint.stats.totalCreated}</p>
        </div>
        <div className="bg-slate-900 rounded-lg p-2">
          <p className="text-xs text-slate-500">Active</p>
          <p className="text-sm font-medium text-green-400">{blueprint.stats.activeCount}</p>
        </div>
        <div className="bg-slate-900 rounded-lg p-2">
          <p className="text-xs text-slate-500">Success Rate</p>
          <p className="text-sm font-medium text-white">{(blueprint.stats.successRate * 100).toFixed(0)}%</p>
        </div>
        <div className="bg-slate-900 rounded-lg p-2">
          <p className="text-xs text-slate-500">Avg Lifespan</p>
          <p className="text-sm font-medium text-white">{blueprint.stats.avgLifespan}m</p>
        </div>
      </div>

      {/* Config Summary */}
      <div className="flex flex-wrap gap-1 mb-3">
        <span className="px-2 py-0.5 rounded bg-slate-700 text-xs text-slate-300">
          Rate: {blueprint.creationRate}/min
        </span>
        <span className="px-2 py-0.5 rounded bg-slate-700 text-xs text-slate-300">
          Max: {blueprint.maxConcurrent}
        </span>
        {blueprint.lifespan > 0 && (
          <span className="px-2 py-0.5 rounded bg-slate-700 text-xs text-slate-300">
            Life: {blueprint.lifespan}m
          </span>
        )}
        {blueprint.hotSwapEnabled && (
          <span className="px-2 py-0.5 rounded bg-yellow-600/30 text-xs text-yellow-400 flex items-center gap-1">
            <Shuffle className="w-3 h-3" /> Hot-Swap
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onSpawn(blueprint.id)}
          disabled={!blueprint.isActive}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium transition-colors"
        >
          <Rocket className="w-4 h-4" />
          Spawn
        </button>
        <button
          onClick={() => onEdit(blueprint)}
          className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Instance Row
interface InstanceRowProps {
  instance: IAIInstance;
  onTerminate: (id: string) => void;
}

function InstanceRow({ instance, onTerminate }: InstanceRowProps) {
  return (
    <tr className="border-b border-slate-700 hover:bg-slate-800/50">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-mono text-white">{instance.id.slice(0, 8)}...</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className="text-sm text-slate-300">{instance.blueprintName}</span>
      </td>
      <td className="py-3 px-4">
        <StatusBadge status={instance.status} />
      </td>
      <td className="py-3 px-4">
        <span className="text-sm text-slate-400">
          {instance.executionCount} / {instance.successCount} / {instance.errorCount}
        </span>
      </td>
      <td className="py-3 px-4">
        <span className="text-sm text-slate-400">
          {instance.expiresAt ? new Date(instance.expiresAt).toLocaleTimeString() : '∞'}
        </span>
      </td>
      <td className="py-3 px-4">
        <button
          onClick={() => onTerminate(instance.id)}
          disabled={instance.status === 'terminated'}
          className="p-1 rounded hover:bg-red-600/20 text-slate-400 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Terminate"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

// Blueprint Modal
interface BlueprintModalProps {
  blueprint?: IAIBlueprint | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<IAIBlueprint>) => void;
  containers: Container[];
  patterns: Pattern[];
  companies: Company[];
  users: TargetUser[];
  isLoading?: boolean;
}

function BlueprintModal({
  blueprint,
  isOpen,
  onClose,
  onSave,
  containers,
  patterns: _patterns, // Reserved for pattern selection feature
  companies,
  users,
  isLoading = false,
}: BlueprintModalProps) {
  const [formData, setFormData] = useState<Partial<IAIBlueprint>>({
    name: '',
    description: '',
    type: 'standard',
    containerIds: [],
    patternIds: [],
    hotSwapEnabled: true,
    hotSwapPatterns: [],
    creationRate: 1,
    maxConcurrent: 10,
    lifespan: 60,
    autoRespawn: false,
    targeting: {
      companyIds: [],
      userIds: [],
      conditions: [],
      triggers: [],
      actions: [],
    },
    schedule: {
      enabled: false,
      cronExpression: null,
      timezone: 'UTC',
      startDate: null,
      endDate: null,
    },
    isActive: true,
    priority: 100,
    tags: [],
  });

  const [activeTab, setActiveTab] = useState<'basic' | 'targeting' | 'schedule' | 'advanced'>('basic');
  const [selectedCompanyForUsers, setSelectedCompanyForUsers] = useState<string | null>(null);

  useEffect(() => {
    if (blueprint) {
      setFormData({
        ...blueprint,
        targeting: {
          companyIds: blueprint.targeting?.companyIds || [],
          userIds: blueprint.targeting?.userIds || [],
          conditions: Array.isArray(blueprint.targeting?.conditions) ? blueprint.targeting.conditions : [],
          triggers: blueprint.targeting?.triggers || [],
          actions: blueprint.targeting?.actions || [],
        },
      });
    } else {
      setFormData({
        name: '',
        description: '',
        type: 'standard',
        containerIds: [],
        patternIds: [],
        hotSwapEnabled: true,
        hotSwapPatterns: [],
        creationRate: 1,
        maxConcurrent: 10,
        lifespan: 60,
        autoRespawn: false,
        targeting: {
          companyIds: [],
          userIds: [],
          conditions: [],
          triggers: [],
          actions: [],
        },
        schedule: {
          enabled: false,
          cronExpression: null,
          timezone: 'UTC',
          startDate: null,
          endDate: null,
        },
        isActive: true,
        priority: 100,
        tags: [],
      });
    }
  }, [blueprint]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    onSave(formData);
    onClose();
  };

  const addCondition = () => {
    const newCondition: TargetingCondition = {
      id: `cond-${Date.now()}`,
      field: '',
      operator: 'equals',
      value: '',
      logic: 'AND',
    };
    setFormData({
      ...formData,
      targeting: {
        ...formData.targeting!,
        conditions: [...(formData.targeting?.conditions || []), newCondition],
      },
    });
  };

  const updateCondition = (id: string, updates: Partial<TargetingCondition>) => {
    setFormData({
      ...formData,
      targeting: {
        ...formData.targeting!,
        conditions: (formData.targeting?.conditions || []).map(c =>
          c.id === id ? { ...c, ...updates } : c
        ),
      },
    });
  };

  const removeCondition = (id: string) => {
    setFormData({
      ...formData,
      targeting: {
        ...formData.targeting!,
        conditions: (formData.targeting?.conditions || []).filter(c => c.id !== id),
      },
    });
  };

  const addTrigger = () => {
    const newTrigger: TargetingTrigger = {
      id: `trig-${Date.now()}`,
      name: 'New Trigger',
      type: 'event',
      config: {},
      enabled: true,
    };
    setFormData({
      ...formData,
      targeting: {
        ...formData.targeting!,
        triggers: [...(formData.targeting?.triggers || []), newTrigger],
      },
    });
  };

  const updateTrigger = (id: string, updates: Partial<TargetingTrigger>) => {
    setFormData({
      ...formData,
      targeting: {
        ...formData.targeting!,
        triggers: (formData.targeting?.triggers || []).map(t =>
          t.id === id ? { ...t, ...updates } : t
        ),
      },
    });
  };

  const removeTrigger = (id: string) => {
    setFormData({
      ...formData,
      targeting: {
        ...formData.targeting!,
        triggers: (formData.targeting?.triggers || []).filter(t => t.id !== id),
      },
    });
  };

  const addAction = () => {
    const newAction: TargetingAction = {
      id: `act-${Date.now()}`,
      name: 'New Action',
      type: 'assign_pattern',
      config: {},
      priority: 100,
    };
    setFormData({
      ...formData,
      targeting: {
        ...formData.targeting!,
        actions: [...(formData.targeting?.actions || []), newAction],
      },
    });
  };

  const updateAction = (id: string, updates: Partial<TargetingAction>) => {
    setFormData({
      ...formData,
      targeting: {
        ...formData.targeting!,
        actions: (formData.targeting?.actions || []).map(a =>
          a.id === id ? { ...a, ...updates } : a
        ),
      },
    });
  };

  const removeAction = (id: string) => {
    setFormData({
      ...formData,
      targeting: {
        ...formData.targeting!,
        actions: (formData.targeting?.actions || []).filter(a => a.id !== id),
      },
    });
  };

  const filteredUsers = selectedCompanyForUsers
    ? users.filter(u => u.companyId === selectedCompanyForUsers)
    : users;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Factory className="w-6 h-6 text-purple-400" />
              {blueprint ? 'Edit Blueprint' : 'Create IAI Blueprint'}
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <XCircle className="w-6 h-6" />
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {(['basic', 'targeting', 'schedule', 'advanced'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                  placeholder="e.g., Ultra Speed Soldier"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none resize-none"
                  rows={3}
                  placeholder="Describe this IAI blueprint..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Type</label>
                  <select
                    value={formData.type || 'standard'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value="standard">Standard</option>
                    <option value="ultra_speed">Ultra Speed (USM)</option>
                    <option value="stealth">Stealth</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Priority</label>
                  <input
                    type="number"
                    value={formData.priority || 100}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                    min={0}
                    max={1000}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Creation Rate <span className="text-slate-500">/min</span>
                  </label>
                  <input
                    type="number"
                    value={formData.creationRate || 1}
                    onChange={(e) => setFormData({ ...formData, creationRate: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                    min={1}
                    max={100}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Max Concurrent</label>
                  <input
                    type="number"
                    value={formData.maxConcurrent || 10}
                    onChange={(e) => setFormData({ ...formData, maxConcurrent: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                    min={1}
                    max={1000}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Lifespan <span className="text-slate-500">min (0=∞)</span>
                  </label>
                  <input
                    type="number"
                    value={formData.lifespan || 0}
                    onChange={(e) => setFormData({ ...formData, lifespan: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                    min={0}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Containers</label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto bg-slate-900 rounded-lg p-2">
                  {containers.length === 0 ? (
                    <p className="text-sm text-slate-500 col-span-2 p-2">No containers available</p>
                  ) : containers.map(c => (
                    <label key={c.id} className="flex items-center gap-2 p-2 rounded hover:bg-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.containerIds?.includes(c.id) || false}
                        onChange={(e) => {
                          const ids = formData.containerIds || [];
                          setFormData({
                            ...formData,
                            containerIds: e.target.checked
                              ? [...ids, c.id]
                              : ids.filter(id => id !== c.id)
                          });
                        }}
                        className="rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
                      />
                      <span className="text-sm text-white">{c.name}</span>
                      <span className="text-xs text-slate-500">({c.patternCount} patterns)</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hotSwapEnabled || false}
                    onChange={(e) => setFormData({ ...formData, hotSwapEnabled: e.target.checked })}
                    className="rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-sm text-white">Enable Hot-Swap at Birth</span>
                  <Shuffle className="w-4 h-4 text-yellow-400" />
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.autoRespawn || false}
                    onChange={(e) => setFormData({ ...formData, autoRespawn: e.target.checked })}
                    className="rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-sm text-white">Auto-Respawn on Termination</span>
                  <RefreshCw className="w-4 h-4 text-green-400" />
                </label>
              </div>
            </div>
          )}

          {activeTab === 'targeting' && (
            <div className="space-y-6">
              {/* Target Companies */}
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  Target Companies
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                </h3>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {companies.length === 0 ? (
                    <div className="col-span-2 text-center py-4">
                      <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">No companies available</p>
                      <p className="text-xs text-slate-600">Companies will appear here once created</p>
                    </div>
                  ) : companies.map(c => (
                    <label 
                      key={c.id} 
                      className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all ${
                        formData.targeting?.companyIds?.includes(c.id) 
                          ? 'bg-blue-600/20 border border-blue-500' 
                          : 'bg-slate-800 border border-transparent hover:bg-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.targeting?.companyIds?.includes(c.id) || false}
                        onChange={(e) => {
                          const ids = formData.targeting?.companyIds || [];
                          setFormData({
                            ...formData,
                            targeting: {
                              ...formData.targeting!,
                              companyIds: e.target.checked
                                ? [...ids, c.id]
                                : ids.filter(id => id !== c.id)
                            }
                          });
                        }}
                        className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-white font-medium block truncate">{c.name}</span>
                        <span className="text-xs text-slate-400">{c.userCount} users</span>
                      </div>
                      {formData.targeting?.companyIds?.includes(c.id) && (
                        <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Target Users */}
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-green-400" />
                  Target Users
                </h3>
                <div className="mb-3">
                  <select
                    value={selectedCompanyForUsers || ''}
                    onChange={(e) => setSelectedCompanyForUsers(e.target.value || null)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white"
                  >
                    <option value="">All Companies</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {filteredUsers.length === 0 ? (
                    <p className="text-sm text-slate-500 col-span-2 text-center py-4">No users available</p>
                  ) : filteredUsers.map(u => (
                    <label 
                      key={u.id} 
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                        formData.targeting?.userIds?.includes(u.id)
                          ? 'bg-green-600/20 border border-green-500'
                          : 'bg-slate-800 border border-transparent hover:bg-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.targeting?.userIds?.includes(u.id) || false}
                        onChange={(e) => {
                          const ids = formData.targeting?.userIds || [];
                          setFormData({
                            ...formData,
                            targeting: {
                              ...formData.targeting!,
                              userIds: e.target.checked
                                ? [...ids, u.id]
                                : ids.filter(id => id !== u.id)
                            }
                          });
                        }}
                        className="rounded border-slate-600 bg-slate-800 text-green-500 focus:ring-green-500"
                      />
                      <span className="text-sm text-white truncate">{u.name || u.email}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Triggers */}
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    Triggers
                  </h3>
                  <button
                    onClick={addTrigger}
                    className="px-2 py-1 text-xs bg-yellow-600 hover:bg-yellow-500 text-white rounded flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Trigger
                  </button>
                </div>
                <div className="space-y-2">
                  {(formData.targeting?.triggers || []).length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No triggers configured</p>
                  ) : (formData.targeting?.triggers || []).map(trigger => (
                    <div key={trigger.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          value={trigger.name}
                          onChange={(e) => updateTrigger(trigger.id, { name: e.target.value })}
                          className="flex-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                          placeholder="Trigger name"
                        />
                        <select
                          value={trigger.type}
                          onChange={(e) => updateTrigger(trigger.id, { type: e.target.value as any })}
                          className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                        >
                          <option value="schedule">Schedule</option>
                          <option value="event">Event</option>
                          <option value="threshold">Threshold</option>
                          <option value="webhook">Webhook</option>
                          <option value="manual">Manual</option>
                        </select>
                        <label className="flex items-center gap-1 text-xs text-white">
                          <input
                            type="checkbox"
                            checked={trigger.enabled}
                            onChange={(e) => updateTrigger(trigger.id, { enabled: e.target.checked })}
                            className="rounded border-slate-600 bg-slate-800 text-yellow-500"
                          />
                          Active
                        </label>
                        <button
                          onClick={() => removeTrigger(trigger.id)}
                          className="p-1 text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conditions */}
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-pink-400" />
                    Conditions
                  </h3>
                  <button
                    onClick={addCondition}
                    className="px-2 py-1 text-xs bg-pink-600 hover:bg-pink-500 text-white rounded flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Condition
                  </button>
                </div>
                <div className="space-y-2">
                  {(formData.targeting?.conditions || []).length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No conditions configured</p>
                  ) : (formData.targeting?.conditions || []).map((condition, idx) => (
                    <div key={condition.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                      <div className="flex items-center gap-2 flex-wrap">
                        {idx > 0 && (
                          <select
                            value={condition.logic}
                            onChange={(e) => updateCondition(condition.id, { logic: e.target.value as any })}
                            className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-white"
                          >
                            <option value="AND">AND</option>
                            <option value="OR">OR</option>
                          </select>
                        )}
                        <input
                          type="text"
                          value={condition.field}
                          onChange={(e) => updateCondition(condition.id, { field: e.target.value })}
                          className="flex-1 min-w-[100px] px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                          placeholder="Field (e.g., user.role)"
                        />
                        <select
                          value={condition.operator}
                          onChange={(e) => updateCondition(condition.id, { operator: e.target.value as any })}
                          className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                        >
                          <option value="equals">=</option>
                          <option value="not_equals">≠</option>
                          <option value="contains">contains</option>
                          <option value="gt">&gt;</option>
                          <option value="lt">&lt;</option>
                          <option value="gte">≥</option>
                          <option value="lte">≤</option>
                          <option value="in">in</option>
                          <option value="not_in">not in</option>
                          <option value="exists">exists</option>
                          <option value="regex">regex</option>
                        </select>
                        <input
                          type="text"
                          value={condition.value}
                          onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                          className="flex-1 min-w-[100px] px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                          placeholder="Value"
                        />
                        <button
                          onClick={() => removeCondition(condition.id)}
                          className="p-1 text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Play className="w-4 h-4 text-emerald-400" />
                    Actions
                  </h3>
                  <button
                    onClick={addAction}
                    className="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Action
                  </button>
                </div>
                <div className="space-y-2">
                  {(formData.targeting?.actions || []).length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No actions configured</p>
                  ) : (formData.targeting?.actions || []).map(action => (
                    <div key={action.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={action.name}
                          onChange={(e) => updateAction(action.id, { name: e.target.value })}
                          className="flex-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                          placeholder="Action name"
                        />
                        <select
                          value={action.type}
                          onChange={(e) => updateAction(action.id, { type: e.target.value as any })}
                          className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                        >
                          <option value="assign_pattern">Assign Pattern</option>
                          <option value="inject_container">Inject Container</option>
                          <option value="notify">Send Notification</option>
                          <option value="hot_swap">Hot Swap</option>
                          <option value="terminate">Terminate</option>
                          <option value="scale">Scale</option>
                          <option value="webhook">Webhook</option>
                        </select>
                        <input
                          type="number"
                          value={action.priority}
                          onChange={(e) => updateAction(action.id, { priority: parseInt(e.target.value) })}
                          className="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                          placeholder="Priority"
                        />
                        <button
                          onClick={() => removeAction(action.id)}
                          className="p-1 text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.schedule?.enabled || false}
                  onChange={(e) => setFormData({
                    ...formData,
                    schedule: { ...formData.schedule!, enabled: e.target.checked }
                  })}
                  className="rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
                />
                <span className="text-sm text-white">Enable Scheduled Creation</span>
                <Clock className="w-4 h-4 text-blue-400" />
              </label>

              {formData.schedule?.enabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Cron Expression</label>
                    <input
                      type="text"
                      value={formData.schedule?.cronExpression || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        schedule: { ...formData.schedule!, cronExpression: e.target.value }
                      })}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white font-mono focus:border-purple-500 focus:outline-none"
                      placeholder="0 */5 * * * (every 5 minutes)"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Format: minute hour day month weekday
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Start Date</label>
                      <input
                        type="datetime-local"
                        value={formData.schedule?.startDate?.slice(0, 16) || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          schedule: { ...formData.schedule!, startDate: e.target.value ? new Date(e.target.value).toISOString() : null }
                        })}
                        className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">End Date</label>
                      <input
                        type="datetime-local"
                        value={formData.schedule?.endDate?.slice(0, 16) || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          schedule: { ...formData.schedule!, endDate: e.target.value ? new Date(e.target.value).toISOString() : null }
                        })}
                        className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Timezone</label>
                    <select
                      value={formData.schedule?.timezone || 'UTC'}
                      onChange={(e) => setFormData({
                        ...formData,
                        schedule: { ...formData.schedule!, timezone: e.target.value }
                      })}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">Eastern Time</option>
                      <option value="America/Chicago">Central Time</option>
                      <option value="America/Denver">Mountain Time</option>
                      <option value="America/Los_Angeles">Pacific Time</option>
                      <option value="Europe/London">London</option>
                      <option value="Europe/Paris">Paris</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-4">
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <h3 className="text-sm font-medium text-white mb-3">Base Configuration (JSON)</h3>
                <textarea
                  value={JSON.stringify(formData.baseConfig || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const baseConfig = JSON.parse(e.target.value);
                      setFormData({ ...formData, baseConfig });
                    } catch {}
                  }}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white font-mono text-sm focus:border-purple-500 focus:outline-none resize-none"
                  rows={6}
                  placeholder='{ "speedMultiplier": 3, "stealthMode": false }'
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Tags</label>
                <input
                  type="text"
                  value={formData.tags?.join(', ') || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                  })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                  placeholder="usm, soldier, high-priority"
                />
                <p className="text-xs text-slate-500 mt-1">Comma-separated tags</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-900 px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!formData.name}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {blueprint ? 'Update Blueprint' : 'Create Blueprint'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Spawn Modal
interface SpawnModalProps {
  blueprint: IAIBlueprint | null;
  isOpen: boolean;
  onClose: () => void;
  onSpawn: (count: number) => void;
}

function SpawnModal({ blueprint, isOpen, onClose, onSpawn }: SpawnModalProps) {
  const [count, setCount] = useState(1);

  if (!isOpen || !blueprint) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Rocket className="w-6 h-6 text-purple-400" />
            Spawn IAI Instances
          </h2>
          
          <p className="text-slate-400 mb-4">
            Spawning from: <span className="text-white font-medium">{blueprint.name}</span>
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">Number of Instances</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value))}
                className="flex-1"
              />
              <input
                type="number"
                min={1}
                max={100}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                className="w-20 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-center focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="bg-slate-900 rounded-lg p-3 mb-6">
            <p className="text-xs text-slate-500 mb-1">Configuration Summary</p>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 rounded bg-slate-700 text-xs text-white">
                Max Concurrent: {blueprint.maxConcurrent}
              </span>
              <span className="px-2 py-1 rounded bg-slate-700 text-xs text-white">
                Lifespan: {blueprint.lifespan > 0 ? `${blueprint.lifespan}m` : '∞'}
              </span>
              {blueprint.hotSwapEnabled && (
                <span className="px-2 py-1 rounded bg-yellow-600/30 text-xs text-yellow-400">
                  Hot-Swap Enabled
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { onSpawn(count); onClose(); }}
              className="flex-1 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Rocket className="w-4 h-4" />
              Spawn {count} Instance{count > 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function IAIFactoryControlPanel() {
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<'overview' | 'blueprints' | 'instances' | 'connections'>('overview');
  const [selectedBlueprint, setSelectedBlueprint] = useState<IAIBlueprint | null>(null);
  const [showBlueprintModal, setShowBlueprintModal] = useState(false);
  const [showSpawnModal, setShowSpawnModal] = useState(false);
  const [spawnBlueprint, setSpawnBlueprint] = useState<IAIBlueprint | null>(null);
  
  // Connection builder state
  const [nodes, setNodes] = useState<ConnectionNode[]>([]);
  const [connectionsList, setConnectionsList] = useState<Connection[]>([]);
  
  // v2.3.0 Templates state
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [selectedTemplateCategory, setSelectedTemplateCategory] = useState<'SOLDIER' | 'STEALTH' | 'NOVA' | 'SYSTEM' | 'all'>('all');
  const [showSaveMapModal, setShowSaveMapModal] = useState(false);
  const [saveMapName, setSaveMapName] = useState('');
  const [saveMapDescription, setSaveMapDescription] = useState('');

  // Queries
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['iai-factory-stats'],
    queryFn: fetchFactoryStats,
    refetchInterval: 10000,
  });

  const { data: blueprints = [], isLoading: blueprintsLoading } = useQuery({
    queryKey: ['iai-blueprints'],
    queryFn: () => fetchBlueprints(),
  });

  const { data: instances = [], isLoading: instancesLoading } = useQuery({
    queryKey: ['iai-instances'],
    queryFn: () => fetchInstances(),
    refetchInterval: 5000,
  });

  const { data: containers = [] } = useQuery({
    queryKey: ['injection-containers'],
    queryFn: fetchContainers,
  });

  const { data: patterns = [] } = useQuery({
    queryKey: ['injection-patterns'],
    queryFn: () => fetchPatterns(),
  });

  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['admin-companies'],
    queryFn: fetchCompanies,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => fetchUsers(),
  });

  // v2.3.0 Templates queries
  const { data: predefinedTemplates = [] } = useQuery({
    queryKey: ['iai-factory-templates', selectedTemplateCategory],
    queryFn: () => fetchPredefinedTemplates(
      selectedTemplateCategory !== 'all' ? { category: selectedTemplateCategory } : undefined
    ),
    enabled: showTemplateSelector,
  });

  const { data: savedMaps = [] } = useQuery({
    queryKey: ['iai-factory-saved-maps'],
    queryFn: fetchSavedConnectionMaps,
    enabled: showTemplateSelector,
  });

  // Mutations
  const createBlueprintMutation = useMutation({
    mutationFn: createBlueprint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iai-blueprints'] });
      queryClient.invalidateQueries({ queryKey: ['iai-factory-stats'] });
    },
  });

  const updateBlueprintMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<IAIBlueprint> }) => updateBlueprint(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iai-blueprints'] });
    },
  });

  const deleteBlueprintMutation = useMutation({
    mutationFn: deleteBlueprint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iai-blueprints'] });
      queryClient.invalidateQueries({ queryKey: ['iai-factory-stats'] });
    },
  });

  const spawnMutation = useMutation({
    mutationFn: ({ blueprintId, count }: { blueprintId: string; count: number }) => 
      spawnInstances(blueprintId, count),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iai-instances'] });
      queryClient.invalidateQueries({ queryKey: ['iai-factory-stats'] });
    },
  });

  const terminateMutation = useMutation({
    mutationFn: terminateInstance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iai-instances'] });
      queryClient.invalidateQueries({ queryKey: ['iai-factory-stats'] });
    },
  });

  // v2.3.0 Save connection map mutation
  const saveMapMutation = useMutation({
    mutationFn: saveConnectionMap,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iai-factory-saved-maps'] });
      setShowSaveMapModal(false);
      setSaveMapName('');
      setSaveMapDescription('');
    },
  });

  // v2.3.0 Template/Map handlers
  const handleLoadTemplate = useCallback((template: PredefinedTemplate) => {
    setNodes(template.nodeLayout || []);
    setConnectionsList(template.connectionMap || []);
    setShowTemplateSelector(false);
  }, []);

  const handleLoadSavedMap = useCallback(async (mapId: string) => {
    try {
      const { nodes: loadedNodes, connections } = await loadConnectionMap(mapId);
      setNodes(loadedNodes);
      setConnectionsList(connections);
      setShowTemplateSelector(false);
    } catch (error) {
      console.error('Failed to load connection map:', error);
    }
  }, []);

  const handleSaveCurrentMap = () => {
    if (!saveMapName.trim()) return;
    saveMapMutation.mutate({
      name: saveMapName,
      description: saveMapDescription || undefined,
      nodes,
      connections: connectionsList,
      isTemplate: false,
    });
  };

  const handleAddNode = useCallback((type: NodeType, data?: Record<string, any>) => {
    const existingCount = nodes.filter(n => n.type === type).length;
    // Spread nodes out better - use grid positioning
    const col = nodes.length % 4;
    const row = Math.floor(nodes.length / 4);
    const newNode: ConnectionNode = {
      id: `node-${Date.now()}`,
      type,
      label: data?.label || `${type.charAt(0).toUpperCase() + type.slice(1)} ${existingCount + 1}`,
      data: data || {},
      position: { 
        x: 80 + col * 200, 
        y: 80 + row * 120 
      },
      connections: [],
    };
    setNodes(prev => [...prev, newNode]);
  }, [nodes]);

  const handleSaveBlueprint = (data: Partial<IAIBlueprint>) => {
    if (selectedBlueprint) {
      updateBlueprintMutation.mutate({ id: selectedBlueprint.id, data });
    } else {
      createBlueprintMutation.mutate(data);
    }
    setSelectedBlueprint(null);
  };

  // Default stats if loading
  const displayStats: FactoryStats = stats || {
    totalBlueprints: 0,
    activeBlueprints: 0,
    totalInstances: 0,
    activeInstances: 0,
    spawningRate: 0,
    terminationRate: 0,
    avgSuccessRate: 0,
    avgLifespan: 0,
    recentActivity: [],
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-xl">
            <Factory className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">IAI Factory Control</h1>
            <p className="text-slate-400">Advanced IAI creation and orchestration</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['iai-factory-stats'] });
              queryClient.invalidateQueries({ queryKey: ['iai-blueprints'] });
              queryClient.invalidateQueries({ queryKey: ['iai-instances'] });
            }}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => { setSelectedBlueprint(null); setShowBlueprintModal(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Blueprint
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 bg-slate-800 rounded-xl p-1">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'blueprints', label: 'Blueprints', icon: Package },
          { id: 'instances', label: 'Instances', icon: Cpu },
          { id: 'connections', label: 'Connection Builder', icon: Network },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeView === tab.id
                ? 'bg-purple-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Stats Grid (always visible) */}
      {!statsLoading && <FactoryStatsGrid stats={displayStats} />}

      {/* View Content */}
      {activeView === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Blueprints */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-400" />
              Active Blueprints
            </h2>
            <div className="space-y-3">
              {blueprints.filter(b => b.isActive).slice(0, 5).map(blueprint => (
                <div key={blueprint.id} className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                  <div className="flex items-center gap-3">
                    <TypeBadge type={blueprint.type} />
                    <div>
                      <p className="text-sm font-medium text-white">{blueprint.name}</p>
                      <p className="text-xs text-slate-500">
                        {blueprint.stats.activeCount} active / {blueprint.stats.totalCreated} total
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setSpawnBlueprint(blueprint); setShowSpawnModal(true); }}
                    className="p-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 transition-colors"
                  >
                    <Rocket className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {blueprints.filter(b => b.isActive).length === 0 && (
                <p className="text-slate-500 text-center py-4">No active blueprints</p>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-400" />
              Recent Activity
            </h2>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {displayStats.recentActivity.map((activity, idx) => (
                <div key={idx} className="flex items-start gap-3 p-2 rounded hover:bg-slate-700/50">
                  <Zap className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-white">{activity.message}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {displayStats.recentActivity.length === 0 && (
                <p className="text-slate-500 text-center py-4">No recent activity</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeView === 'blueprints' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {blueprintsLoading ? (
            <p className="text-slate-400 col-span-full text-center py-8">Loading blueprints...</p>
          ) : blueprints.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 mb-4">No blueprints created yet</p>
              <button
                onClick={() => { setSelectedBlueprint(null); setShowBlueprintModal(true); }}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors"
              >
                Create Your First Blueprint
              </button>
            </div>
          ) : (
            blueprints.map(blueprint => (
              <BlueprintCard
                key={blueprint.id}
                blueprint={blueprint}
                onEdit={(bp) => { setSelectedBlueprint(bp); setShowBlueprintModal(true); }}
                onDelete={(id) => {
                  if (confirm('Delete this blueprint?')) {
                    deleteBlueprintMutation.mutate(id);
                  }
                }}
                onToggleActive={(id, isActive) => {
                  updateBlueprintMutation.mutate({ id, data: { isActive } });
                }}
                onSpawn={(id) => {
                  const bp = blueprints.find(b => b.id === id);
                  if (bp) { setSpawnBlueprint(bp); setShowSpawnModal(true); }
                }}
              />
            ))
          )}
        </div>
      )}

      {activeView === 'instances' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-purple-400" />
              Active Instances ({instances.filter(i => i.status !== 'terminated').length})
            </h2>
            <button
              onClick={() => {
                if (confirm('Terminate ALL instances?')) {
                  terminateAll();
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 text-sm font-medium transition-colors flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              Terminate All
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900">
                <tr className="text-left text-xs text-slate-400 uppercase">
                  <th className="py-3 px-4">Instance ID</th>
                  <th className="py-3 px-4">Blueprint</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Exec/Success/Error</th>
                  <th className="py-3 px-4">Expires</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {instancesLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">Loading...</td>
                  </tr>
                ) : instances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">No instances running</td>
                  </tr>
                ) : (
                  instances.map(instance => (
                    <InstanceRow
                      key={instance.id}
                      instance={instance}
                      onTerminate={(id) => terminateMutation.mutate(id)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeView === 'connections' && (
        <div className="space-y-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Network className="w-5 h-5 text-cyan-400" />
                Visual Connection Builder
              </h2>
              <button
                onClick={() => setShowTemplateSelector(!showTemplateSelector)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  showTemplateSelector
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
              >
                <Package className="w-4 h-4" />
                Templates & Saved Maps
              </button>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Design IAI routing and connections visually. Connect IAI blueprints to companies, users, patterns, and containers.
            </p>

            {/* v2.3.0 Template Selector Panel */}
            {showTemplateSelector && (
              <div className="mb-4 bg-slate-900 rounded-lg border border-slate-600 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    Predefined Templates
                  </h3>
                  <div className="flex gap-1">
                    {(['all', 'SOLDIER', 'STEALTH', 'NOVA', 'SYSTEM'] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedTemplateCategory(cat)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          selectedTemplateCategory === cat
                            ? cat === 'SOLDIER' ? 'bg-blue-600 text-white'
                              : cat === 'STEALTH' ? 'bg-purple-600 text-white'
                              : cat === 'NOVA' ? 'bg-amber-600 text-white'
                              : cat === 'SYSTEM' ? 'bg-slate-600 text-white'
                              : 'bg-cyan-600 text-white'
                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                        }`}
                      >
                        {cat === 'all' ? 'All' : cat}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {predefinedTemplates.length === 0 ? (
                    <div className="col-span-3 text-center py-4 text-slate-500 text-sm">
                      No templates in this category
                    </div>
                  ) : (
                    predefinedTemplates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleLoadTemplate(template)}
                        className="bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg p-3 text-left transition-colors group"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            template.targetGenre === 'SOLDIER' ? 'bg-blue-900/30 text-blue-400'
                            : template.targetGenre === 'STEALTH' ? 'bg-purple-900/30 text-purple-400'
                            : 'bg-amber-900/30 text-amber-400'
                          }`}>
                            {template.targetGenre}
                          </span>
                          <span className="text-xs text-slate-500">{template.targetSource}</span>
                        </div>
                        <p className="font-medium text-white group-hover:text-cyan-400 text-sm">
                          {template.name}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                          {template.description}
                        </p>
                        {template.isDefault && (
                          <span className="text-[10px] text-green-400 mt-1 inline-block">★ Default</span>
                        )}
                      </button>
                    ))
                  )}
                </div>

                {/* Saved Maps */}
                <div className="border-t border-slate-700 pt-3">
                  <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                    <Save className="w-3.5 h-3.5" />
                    Your Saved Maps
                  </h4>
                  <div className="flex gap-2 flex-wrap">
                    {savedMaps.length === 0 ? (
                      <span className="text-xs text-slate-500">No saved maps yet</span>
                    ) : (
                      savedMaps.map((map) => (
                        <button
                          key={map.id}
                          onClick={() => handleLoadSavedMap(map.id)}
                          className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-300 transition-colors"
                        >
                          {map.name}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <ConnectionBuilder
              nodes={nodes}
              connections={connectionsList}
              onNodesChange={setNodes}
              onConnectionsChange={setConnectionsList}
              onAddNode={handleAddNode}
              containers={containers}
              patterns={patterns}
              companies={companies}
              users={users}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setNodes([]); setConnectionsList([]); }}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Clear All
            </button>
            <button
              onClick={() => setShowSaveMapModal(true)}
              disabled={nodes.length === 0}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              Save Connection Map
            </button>
          </div>

          {/* Save Map Modal */}
          {showSaveMapModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold text-white mb-4">Save Connection Map</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Name *</label>
                    <input
                      type="text"
                      value={saveMapName}
                      onChange={(e) => setSaveMapName(e.target.value)}
                      placeholder="My connection map"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Description</label>
                    <textarea
                      value={saveMapDescription}
                      onChange={(e) => setSaveMapDescription(e.target.value)}
                      placeholder="Optional description..."
                      rows={3}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 resize-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    onClick={() => { setShowSaveMapModal(false); setSaveMapName(''); setSaveMapDescription(''); }}
                    className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveCurrentMap}
                    disabled={!saveMapName.trim() || saveMapMutation.isPending}
                    className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {saveMapMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <BlueprintModal
        blueprint={selectedBlueprint}
        isOpen={showBlueprintModal}
        onClose={() => { setShowBlueprintModal(false); setSelectedBlueprint(null); }}
        onSave={handleSaveBlueprint}
        containers={containers}
        patterns={patterns}
        companies={companies}
        users={users}
        isLoading={companiesLoading}
      />

      <SpawnModal
        blueprint={spawnBlueprint}
        isOpen={showSpawnModal}
        onClose={() => { setShowSpawnModal(false); setSpawnBlueprint(null); }}
        onSpawn={(count) => {
          if (spawnBlueprint) {
            spawnMutation.mutate({ blueprintId: spawnBlueprint.id, count });
          }
        }}
      />
    </div>
  );
}
