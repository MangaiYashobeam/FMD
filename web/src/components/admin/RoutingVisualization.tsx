/**
 * RoutingVisualization - Interactive System Routing Map
 * 
 * A comprehensive visual representation of all API routes and security layers
 * with interactive modals showing live data and AI-powered summaries.
 * 
 * @version 2.1.0
 * @author DealersFace Engineering
 */

import React, { useState, useMemo } from 'react';
import {
  Shield,
  Lock,
  Key,
  Globe,
  Server,
  Database,
  Zap,
  Activity,
  ArrowRight,
  Eye,
  Bug,
  FileWarning,
  Fingerprint,
  Network,
  Layers,
  Cloud,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  X,
  Sparkles,
  MessageSquare,
  Users,
  Car,
  Settings,
  CreditCard,
  BarChart3,
  Brain,
  Radio,
  Facebook,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Route category types
type RouteCategory = 
  | 'security'
  | 'auth'
  | 'user'
  | 'vehicle'
  | 'social'
  | 'messaging'
  | 'ai'
  | 'analytics'
  | 'admin'
  | 'system'
  | 'extension'
  | 'payments';

interface RouteNode {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  name: string;
  description: string;
  category: RouteCategory;
  securityLayers: string[];
  rateLimit?: string;
  authRequired: boolean;
  adminOnly?: boolean;
  metrics?: {
    totalRequests: number;
    avgResponseTime: number;
    errorRate: number;
  };
}

interface SecurityLayer {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  order: number;
  enabled: boolean;
}

interface RouteModalProps {
  route: RouteNode;
  isOpen: boolean;
  onClose: () => void;
}

// Security Layers Configuration
const SECURITY_LAYERS: SecurityLayer[] = [
  {
    id: 'cloudflare',
    name: 'Cloudflare CDN',
    description: 'DDoS protection, WAF, SSL termination, global edge caching',
    icon: Cloud,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    order: 1,
    enabled: true,
  },
  {
    id: 'intelliceil',
    name: 'Intelliceil Monitor',
    description: 'Traffic analysis, baseline monitoring, geo-IP tracking',
    icon: Activity,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    order: 2,
    enabled: true,
  },
  {
    id: 'iipc',
    name: 'IIPC Controller',
    description: 'Internal IP access control, super admin IP whitelist',
    icon: Network,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    order: 3,
    enabled: true,
  },
  {
    id: 'honeypot',
    name: 'Honeypot Traps',
    description: 'Fake endpoints to catch scanners and attackers',
    icon: Bug,
    color: 'text-rose-600',
    bgColor: 'bg-rose-100',
    order: 4,
    enabled: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise Security',
    description: 'SQL injection, XSS detection, bot detection, IP reputation',
    icon: Shield,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    order: 5,
    enabled: true,
  },
  {
    id: 'validation',
    name: 'Input Validation',
    description: 'Deep request body scanning for malicious payloads',
    icon: FileWarning,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    order: 6,
    enabled: true,
  },
  {
    id: 'ratelimit',
    name: 'Rate Limiting',
    description: 'Request throttling per IP, user, and endpoint',
    icon: Zap,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    order: 7,
    enabled: true,
  },
  {
    id: 'csrf',
    name: 'CSRF Protection',
    description: 'Cross-site request forgery token validation',
    icon: Key,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100',
    order: 8,
    enabled: true,
  },
  {
    id: 'jwt',
    name: 'JWT Authentication',
    description: 'Token-based auth with fingerprinting and refresh rotation',
    icon: Fingerprint,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    order: 9,
    enabled: true,
  },
  {
    id: 'rbac',
    name: 'Role-Based Access',
    description: 'USER, ADMIN, SUPER_ADMIN, ROOT permission levels',
    icon: Users,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
    order: 10,
    enabled: true,
  },
];

// Category configuration
const CATEGORY_CONFIG: Record<RouteCategory, { icon: LucideIcon; label: string; color: string; bgColor: string }> = {
  security: { icon: Shield, label: 'Security', color: 'text-red-600', bgColor: 'bg-red-50' },
  auth: { icon: Lock, label: 'Authentication', color: 'text-purple-600', bgColor: 'bg-purple-50' },
  user: { icon: Users, label: 'User Management', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  vehicle: { icon: Car, label: 'Inventory', color: 'text-green-600', bgColor: 'bg-green-50' },
  social: { icon: Facebook, label: 'Social Media', color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  messaging: { icon: MessageSquare, label: 'Messaging', color: 'text-cyan-600', bgColor: 'bg-cyan-50' },
  ai: { icon: Brain, label: 'AI Services', color: 'text-pink-600', bgColor: 'bg-pink-50' },
  analytics: { icon: BarChart3, label: 'Analytics', color: 'text-amber-600', bgColor: 'bg-amber-50' },
  admin: { icon: Settings, label: 'Administration', color: 'text-slate-600', bgColor: 'bg-slate-50' },
  system: { icon: Server, label: 'System', color: 'text-gray-600', bgColor: 'bg-gray-50' },
  extension: { icon: Radio, label: 'Extension', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  payments: { icon: CreditCard, label: 'Payments', color: 'text-teal-600', bgColor: 'bg-teal-50' },
};

// System routes data (would be fetched from API in production)
const SYSTEM_ROUTES: RouteNode[] = [
  // Security Routes
  {
    id: 'intelliceil-status',
    path: '/api/intelliceil/status',
    method: 'GET',
    name: 'Intelliceil Status',
    description: 'Get real-time security metrics, traffic analysis, and threat levels',
    category: 'security',
    securityLayers: ['cloudflare', 'intelliceil', 'jwt', 'rbac'],
    authRequired: true,
    adminOnly: true,
  },
  {
    id: 'intelliceil-config',
    path: '/api/intelliceil/config',
    method: 'PUT',
    name: 'Update Security Config',
    description: 'Modify Intelliceil thresholds, toggles, and trusted domains',
    category: 'security',
    securityLayers: ['cloudflare', 'intelliceil', 'enterprise', 'validation', 'jwt', 'rbac'],
    authRequired: true,
    adminOnly: true,
  },
  {
    id: 'iipc-rules',
    path: '/api/iipc/rules',
    method: 'GET',
    name: 'IP Access Rules',
    description: 'Manage IP whitelist/blacklist rules for access control',
    category: 'security',
    securityLayers: ['cloudflare', 'intelliceil', 'iipc', 'jwt', 'rbac'],
    authRequired: true,
    adminOnly: true,
  },
  // Auth Routes
  {
    id: 'auth-login',
    path: '/api/auth/login',
    method: 'POST',
    name: 'User Login',
    description: 'Authenticate user with email/password, returns JWT tokens',
    category: 'auth',
    securityLayers: ['cloudflare', 'intelliceil', 'enterprise', 'ratelimit', 'csrf'],
    rateLimit: '5 req/min',
    authRequired: false,
  },
  {
    id: 'auth-register',
    path: '/api/auth/register',
    method: 'POST',
    name: 'User Registration',
    description: 'Create new user account with email verification',
    category: 'auth',
    securityLayers: ['cloudflare', 'intelliceil', 'enterprise', 'validation', 'ratelimit'],
    rateLimit: '3 req/hour',
    authRequired: false,
  },
  {
    id: 'auth-2fa',
    path: '/api/two-factor/verify',
    method: 'POST',
    name: '2FA Verification',
    description: 'Verify TOTP code for two-factor authentication',
    category: 'auth',
    securityLayers: ['cloudflare', 'intelliceil', 'enterprise', 'ratelimit', 'jwt'],
    rateLimit: '10 req/min',
    authRequired: true,
  },
  // Vehicle Routes
  {
    id: 'vehicles-list',
    path: '/api/vehicles',
    method: 'GET',
    name: 'List Vehicles',
    description: 'Get paginated inventory with filters and sorting',
    category: 'vehicle',
    securityLayers: ['cloudflare', 'intelliceil', 'jwt', 'rbac'],
    authRequired: true,
  },
  {
    id: 'vehicles-sync',
    path: '/api/sync/ftp',
    method: 'POST',
    name: 'FTP Sync',
    description: 'Sync inventory from DMS via FTP/SFTP connection',
    category: 'vehicle',
    securityLayers: ['cloudflare', 'intelliceil', 'enterprise', 'jwt', 'rbac'],
    authRequired: true,
    adminOnly: true,
  },
  // Social Media Routes
  {
    id: 'fb-post',
    path: '/api/facebook/post',
    method: 'POST',
    name: 'Create FB Post',
    description: 'Post vehicle listing to Facebook Marketplace',
    category: 'social',
    securityLayers: ['cloudflare', 'intelliceil', 'enterprise', 'jwt', 'rbac'],
    authRequired: true,
  },
  {
    id: 'fb-auth',
    path: '/api/facebook/auth',
    method: 'GET',
    name: 'Facebook OAuth',
    description: 'Initiate Facebook OAuth2 authentication flow',
    category: 'social',
    securityLayers: ['cloudflare', 'intelliceil', 'csrf'],
    authRequired: true,
  },
  // AI Routes
  {
    id: 'ai-chat',
    path: '/api/ai-center/chat',
    method: 'POST',
    name: 'AI Chat',
    description: 'Interactive chat with AI for vehicle inquiries',
    category: 'ai',
    securityLayers: ['cloudflare', 'intelliceil', 'enterprise', 'validation', 'jwt', 'rbac'],
    authRequired: true,
  },
  {
    id: 'ai-generate',
    path: '/api/extension/generate-description',
    method: 'POST',
    name: 'AI Description',
    description: 'Generate vehicle descriptions using AI models',
    category: 'ai',
    securityLayers: ['cloudflare', 'intelliceil', 'jwt'],
    authRequired: true,
  },
  // Extension Routes
  {
    id: 'extension-heartbeat',
    path: '/api/extension/heartbeat',
    method: 'POST',
    name: 'Extension Heartbeat',
    description: 'Keep-alive signal from browser extension',
    category: 'extension',
    securityLayers: ['cloudflare', 'intelliceil'],
    authRequired: true,
  },
  {
    id: 'extension-tasks',
    path: '/api/extension/tasks',
    method: 'GET',
    name: 'Get Tasks',
    description: 'Retrieve pending posting tasks for extension',
    category: 'extension',
    securityLayers: ['cloudflare', 'intelliceil', 'jwt'],
    authRequired: true,
  },
  {
    id: 'iai-register',
    path: '/api/iai/register',
    method: 'POST',
    name: 'IAI Register',
    description: 'Register IAI soldier with fingerprint',
    category: 'extension',
    securityLayers: ['cloudflare', 'intelliceil', 'enterprise'],
    authRequired: true,
  },
  // Admin Routes
  {
    id: 'admin-stats',
    path: '/api/admin/stats',
    method: 'GET',
    name: 'Admin Stats',
    description: 'Dashboard statistics and metrics',
    category: 'admin',
    securityLayers: ['cloudflare', 'intelliceil', 'jwt', 'rbac'],
    authRequired: true,
    adminOnly: true,
  },
  {
    id: 'admin-users',
    path: '/api/admin/users',
    method: 'GET',
    name: 'User Management',
    description: 'List and manage all system users',
    category: 'admin',
    securityLayers: ['cloudflare', 'intelliceil', 'enterprise', 'jwt', 'rbac'],
    authRequired: true,
    adminOnly: true,
  },
  // Analytics Routes
  {
    id: 'analytics-reports',
    path: '/api/reports',
    method: 'GET',
    name: 'Analytics Reports',
    description: 'Generate and download analytics reports',
    category: 'analytics',
    securityLayers: ['cloudflare', 'intelliceil', 'jwt', 'rbac'],
    authRequired: true,
  },
  {
    id: 'session-analytics',
    path: '/api/session-analytics',
    method: 'GET',
    name: 'Session Analytics',
    description: 'User session and heat map data',
    category: 'analytics',
    securityLayers: ['cloudflare', 'intelliceil', 'jwt', 'rbac'],
    authRequired: true,
    adminOnly: true,
  },
  // Messaging Routes
  {
    id: 'messages-conversations',
    path: '/api/messages/conversations',
    method: 'GET',
    name: 'Conversations',
    description: 'List all message conversations',
    category: 'messaging',
    securityLayers: ['cloudflare', 'intelliceil', 'jwt', 'rbac'],
    authRequired: true,
  },
  {
    id: 'email-send',
    path: '/api/email/send',
    method: 'POST',
    name: 'Send Email',
    description: 'Send transactional email via mail engine',
    category: 'messaging',
    securityLayers: ['cloudflare', 'intelliceil', 'enterprise', 'validation', 'jwt', 'rbac'],
    authRequired: true,
    adminOnly: true,
  },
  // Payments Routes
  {
    id: 'subscription-plans',
    path: '/api/subscriptions/plans',
    method: 'GET',
    name: 'Subscription Plans',
    description: 'Get available subscription tiers',
    category: 'payments',
    securityLayers: ['cloudflare', 'intelliceil'],
    authRequired: false,
  },
  {
    id: 'stripe-webhook',
    path: '/api/subscriptions/webhook',
    method: 'POST',
    name: 'Stripe Webhook',
    description: 'Handle Stripe payment events',
    category: 'payments',
    securityLayers: ['cloudflare', 'intelliceil'],
    authRequired: false,
  },
];

// Route Detail Modal Component
function RouteDetailModal({ route, isOpen, onClose }: RouteModalProps) {
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  
  if (!isOpen) return null;
  
  const categoryConfig = CATEGORY_CONFIG[route.category];
  const CategoryIcon = categoryConfig.icon;
  
  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-green-100 text-green-700';
      case 'POST': return 'bg-blue-100 text-blue-700';
      case 'PUT': return 'bg-amber-100 text-amber-700';
      case 'PATCH': return 'bg-purple-100 text-purple-700';
      case 'DELETE': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const generateAISummary = async () => {
    setIsGeneratingAI(true);
    // Simulate AI generation - in production, this would call your AI endpoint
    await new Promise(resolve => setTimeout(resolve, 1500));
    setAiSummary(
      `**Route Analysis for ${route.name}**\n\n` +
      `This endpoint handles ${route.description.toLowerCase()}. ` +
      `It is protected by ${route.securityLayers.length} security layers including ` +
      `${route.securityLayers.slice(0, 3).map(l => SECURITY_LAYERS.find(s => s.id === l)?.name).join(', ')}.\n\n` +
      `**Security Assessment:** ${route.adminOnly ? 'High' : 'Standard'} security level with ` +
      `${route.authRequired ? 'mandatory authentication' : 'public access'}.\n\n` +
      `**Recommendations:**\n` +
      `- Monitor for unusual traffic patterns\n` +
      `- ${route.rateLimit ? `Rate limit is set to ${route.rateLimit}` : 'Consider adding rate limiting'}\n` +
      `- Review access logs regularly`
    );
    setIsGeneratingAI(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${categoryConfig.bgColor}`}>
                <CategoryIcon className={`w-6 h-6 ${categoryConfig.color}`} />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-bold text-gray-900">{route.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 text-xs font-bold rounded ${getMethodColor(route.method)}`}>
                    {route.method}
                  </span>
                  <code className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                    {route.path}
                  </code>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          
          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
            {/* Description */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="text-sm font-medium text-gray-500 mb-2">Description</h4>
              <p className="text-gray-700">{route.description}</p>
            </div>
            
            {/* Security Layers */}
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Security Layers ({route.securityLayers.length})
              </h4>
              <div className="space-y-2">
                {route.securityLayers.map((layerId, index) => {
                  const layer = SECURITY_LAYERS.find(l => l.id === layerId);
                  if (!layer) return null;
                  const LayerIcon = layer.icon;
                  return (
                    <div
                      key={layerId}
                      className={`flex items-center gap-3 p-3 rounded-lg ${layer.bgColor} border border-${layer.color.replace('text-', '')}/20`}
                    >
                      <div className="flex items-center justify-center w-8 h-8 bg-white rounded-lg shadow-sm">
                        <span className="text-xs font-bold text-gray-500">{index + 1}</span>
                      </div>
                      <div className={`p-2 rounded-lg bg-white shadow-sm`}>
                        <LayerIcon className={`w-4 h-4 ${layer.color}`} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-gray-900 text-sm">{layer.name}</p>
                        <p className="text-xs text-gray-500">{layer.description}</p>
                      </div>
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Attributes */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-sm font-medium text-gray-500 mb-2">Authentication</h4>
                <div className="flex items-center gap-2">
                  {route.authRequired ? (
                    <>
                      <Lock className="w-4 h-4 text-green-600" />
                      <span className="text-green-700 font-medium">Required</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-4 h-4 text-blue-600" />
                      <span className="text-blue-700 font-medium">Public</span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-sm font-medium text-gray-500 mb-2">Access Level</h4>
                <div className="flex items-center gap-2">
                  {route.adminOnly ? (
                    <>
                      <Shield className="w-4 h-4 text-red-600" />
                      <span className="text-red-700 font-medium">Admin Only</span>
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4 text-blue-600" />
                      <span className="text-blue-700 font-medium">All Users</span>
                    </>
                  )}
                </div>
              </div>
              
              {route.rateLimit && (
                <div className="bg-gray-50 rounded-xl p-4 col-span-2">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Rate Limit</h4>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-600" />
                    <span className="text-amber-700 font-medium">{route.rateLimit}</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* AI Summary Section */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  AI Analysis
                </h4>
                {!aiSummary && (
                  <button
                    onClick={generateAISummary}
                    disabled={isGeneratingAI}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50"
                  >
                    {isGeneratingAI ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Brain className="w-4 h-4" />
                        Generate AI Summary
                      </>
                    )}
                  </button>
                )}
              </div>
              
              {aiSummary && (
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                  <div className="prose prose-sm max-w-none">
                    {aiSummary.split('\n').map((line, i) => (
                      <p key={i} className="text-gray-700 text-sm mb-2">
                        {line.startsWith('**') ? (
                          <strong>{line.replace(/\*\*/g, '')}</strong>
                        ) : line.startsWith('-') ? (
                          <span className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                            {line.replace('-', '').trim()}
                          </span>
                        ) : (
                          line
                        )}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Routing Visualization Component
export default function RoutingVisualization() {
  const [selectedRoute, setSelectedRoute] = useState<RouteNode | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<RouteCategory>>(
    new Set(['security', 'auth'])
  );
  const [filterCategory, setFilterCategory] = useState<RouteCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Group routes by category
  const routesByCategory = useMemo(() => {
    const grouped: Record<RouteCategory, RouteNode[]> = {} as Record<RouteCategory, RouteNode[]>;
    
    SYSTEM_ROUTES
      .filter(route => {
        if (filterCategory !== 'all' && route.category !== filterCategory) return false;
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return (
            route.name.toLowerCase().includes(query) ||
            route.path.toLowerCase().includes(query) ||
            route.description.toLowerCase().includes(query)
          );
        }
        return true;
      })
      .forEach(route => {
        if (!grouped[route.category]) {
          grouped[route.category] = [];
        }
        grouped[route.category].push(route);
      });
    
    return grouped;
  }, [filterCategory, searchQuery]);

  const toggleCategory = (category: RouteCategory) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-green-100 text-green-700 border-green-200';
      case 'POST': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'PUT': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'PATCH': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'DELETE': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Security Pipeline Visualization */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white overflow-x-auto">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-400" />
          Security Pipeline
          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full ml-2">
            All Layers Active
          </span>
        </h3>
        
        <div className="flex items-center gap-2 min-w-max pb-4">
          {/* Internet */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Globe className="w-8 h-8" />
            </div>
            <span className="text-xs mt-2 text-gray-400">Internet</span>
          </div>
          
          {/* Arrow */}
          <ArrowRight className="w-6 h-6 text-gray-500 flex-shrink-0" />
          
          {/* Security Layers */}
          {SECURITY_LAYERS.slice(0, 6).map((layer, index) => {
            const LayerIcon = layer.icon;
            return (
              <React.Fragment key={layer.id}>
                <div className="flex flex-col items-center group cursor-pointer">
                  <div className={`w-14 h-14 rounded-xl ${layer.bgColor} flex items-center justify-center shadow-lg transition-transform group-hover:scale-110`}>
                    <LayerIcon className={`w-6 h-6 ${layer.color}`} />
                  </div>
                  <span className="text-xs mt-2 text-gray-400 text-center max-w-[80px] leading-tight">
                    {layer.name}
                  </span>
                </div>
                {index < 5 && <ArrowRight className="w-4 h-4 text-gray-500 flex-shrink-0" />}
              </React.Fragment>
            );
          })}
          
          {/* More layers indicator */}
          <ArrowRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-xl bg-gray-700 flex items-center justify-center text-gray-400">
              <span className="text-sm font-bold">+4</span>
            </div>
            <span className="text-xs mt-2 text-gray-400">More</span>
          </div>
          
          {/* Arrow */}
          <ArrowRight className="w-6 h-6 text-gray-500 flex-shrink-0" />
          
          {/* Application */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
              <Server className="w-8 h-8" />
            </div>
            <span className="text-xs mt-2 text-gray-400">Application</span>
          </div>
          
          {/* Arrow */}
          <ArrowRight className="w-6 h-6 text-gray-500 flex-shrink-0" />
          
          {/* Database */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Database className="w-8 h-8" />
            </div>
            <span className="text-xs mt-2 text-gray-400">Database</span>
          </div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <input
              type="text"
              placeholder="Search routes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <Eye className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Routes
          </button>
          {Object.entries(CATEGORY_CONFIG).slice(0, 6).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <button
                key={key}
                onClick={() => setFilterCategory(key as RouteCategory)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterCategory === key
                    ? `${config.bgColor} ${config.color}`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {config.label}
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Routes List */}
      <div className="space-y-4">
        {Object.entries(routesByCategory).map(([category, routes]) => {
          const config = CATEGORY_CONFIG[category as RouteCategory];
          const Icon = config.icon;
          const isExpanded = expandedCategories.has(category as RouteCategory);
          
          return (
            <div key={category} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category as RouteCategory)}
                className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${config.bgColor}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-white shadow-sm`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">{config.label}</h3>
                    <p className="text-sm text-gray-500">{routes.length} endpoints</p>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
              </button>
              
              {/* Routes */}
              {isExpanded && (
                <div className="divide-y divide-gray-100">
                  {routes.map(route => (
                    <button
                      key={route.id}
                      onClick={() => setSelectedRoute(route)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left group"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <span className={`px-2 py-1 text-xs font-bold rounded border ${getMethodColor(route.method)}`}>
                          {route.method}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{route.name}</span>
                            {route.adminOnly && (
                              <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                                Admin
                              </span>
                            )}
                          </div>
                          <code className="text-sm text-gray-500 truncate block">{route.path}</code>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {/* Security layers indicator */}
                        <div className="flex items-center gap-1">
                          {route.securityLayers.slice(0, 4).map(layerId => {
                            const layer = SECURITY_LAYERS.find(l => l.id === layerId);
                            if (!layer) return null;
                            const LayerIcon = layer.icon;
                            return (
                              <div
                                key={layerId}
                                className={`w-6 h-6 rounded ${layer.bgColor} flex items-center justify-center`}
                                title={layer.name}
                              >
                                <LayerIcon className={`w-3 h-3 ${layer.color}`} />
                              </div>
                            );
                          })}
                          {route.securityLayers.length > 4 && (
                            <span className="text-xs text-gray-500">
                              +{route.securityLayers.length - 4}
                            </span>
                          )}
                        </div>
                        
                        <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        
        {Object.keys(routesByCategory).length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-xl">
            <Eye className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No routes found matching your criteria</p>
          </div>
        )}
      </div>
      
      {/* Route Detail Modal */}
      {selectedRoute && (
        <RouteDetailModal
          route={selectedRoute}
          isOpen={!!selectedRoute}
          onClose={() => setSelectedRoute(null)}
        />
      )}
    </div>
  );
}
