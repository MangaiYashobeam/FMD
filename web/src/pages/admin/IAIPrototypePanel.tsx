import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Zap,
  Eye,
  RefreshCw,
  Trash2,
  Database,
  Chrome,
  Play,
  Terminal,
  Download,
  Navigation,
  Skull,
  Plus,
  Pause,
  History,
  Monitor,
  Wifi,
  WifiOff,
  Code,
  Image,
  FileJson,
  Send,
  ArrowRight,
  Layers,
  Type,
  Filter,
  ChevronDown,
  ChevronRight,
  Box,
  Globe,
  FileText,
  Camera,
  Settings,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';
import { api } from '../../lib/api';

// ============================================
// Types
// ============================================

export interface PrototypeSoldier {
  id: string;
  status: 'idle' | 'running' | 'paused' | 'error' | 'killed' | 'connecting';
  currentUrl: string;
  createdAt: Date;
  lastActivity: Date;
  sessionId: string | null;
  browserInfo: {
    userAgent: string;
    viewport: { width: number; height: number };
    platform: string;
  } | null;
  actions: SoldierAction[];
  logs: SoldierLog[];
  harvestedData: HarvestedData[];
  screenshots: Screenshot[];
  htmlSnapshots: HTMLSnapshot[];
}

export interface SoldierAction {
  id: string;
  type: 'navigate' | 'click' | 'type' | 'extract' | 'wait' | 'screenshot' | 'scroll' | 'analyze_html' | 'custom' | 'hover' | 'select' | 'evaluate';
  target?: string;
  value?: string;
  timestamp: Date;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface SoldierLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug' | 'action' | 'data' | 'system';
  message: string;
  data?: unknown;
  source?: string;
}

export interface HarvestedData {
  id: string;
  timestamp: Date;
  actionId: string;
  type: 'text' | 'html' | 'attribute' | 'list' | 'table' | 'json' | 'image_url' | 'link';
  selector: string;
  value: unknown;
  metadata?: {
    elementTag?: string;
    elementId?: string;
    elementClasses?: string[];
    parentSelector?: string;
    childCount?: number;
  };
  processed: boolean;
  sentTo?: string[];
}

export interface Screenshot {
  id: string;
  timestamp: Date;
  actionId: string;
  dataUrl: string; // base64 JPG
  dimensions: { width: number; height: number };
  url: string;
  fullPage: boolean;
  selector?: string;
}

export interface HTMLSnapshot {
  id: string;
  timestamp: Date;
  actionId: string;
  url: string;
  html: string;
  selector?: string;
  analysis?: HTMLAnalysis;
}

export interface HTMLAnalysis {
  totalElements: number;
  elementCounts: Record<string, number>;
  forms: FormInfo[];
  links: LinkInfo[];
  images: ImageInfo[];
  scripts: number;
  styles: number;
  dataAttributes: string[];
  interactiveElements: InteractiveElement[];
}

interface FormInfo {
  id?: string;
  action?: string;
  method?: string;
  inputs: { name?: string; type: string; id?: string }[];
}

interface LinkInfo {
  href: string;
  text: string;
  isExternal: boolean;
}

interface ImageInfo {
  src: string;
  alt?: string;
  dimensions?: { width: number; height: number };
}

interface InteractiveElement {
  tag: string;
  selector: string;
  text?: string;
  type?: string;
}

export interface DataAction {
  id: string;
  name: string;
  description: string;
  type: 'send_to_api' | 'save_to_db' | 'export_json' | 'export_csv' | 'transform' | 'validate' | 'trigger_workflow';
  config: Record<string, unknown>;
}

// ============================================
// Utility Functions
// ============================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    fractionalSecondDigits: 3
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
}

function analyzeHTML(html: string): HTMLAnalysis {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const elementCounts: Record<string, number> = {};
  const allElements = doc.querySelectorAll('*');
  allElements.forEach(el => {
    const tag = el.tagName.toLowerCase();
    elementCounts[tag] = (elementCounts[tag] || 0) + 1;
  });

  const forms: FormInfo[] = Array.from(doc.querySelectorAll('form')).map(form => ({
    id: form.id || undefined,
    action: form.action || undefined,
    method: form.method || undefined,
    inputs: Array.from(form.querySelectorAll('input, select, textarea')).map(input => ({
      name: (input as HTMLInputElement).name || undefined,
      type: (input as HTMLInputElement).type || input.tagName.toLowerCase(),
      id: input.id || undefined,
    })),
  }));

  const links: LinkInfo[] = Array.from(doc.querySelectorAll('a[href]')).slice(0, 50).map(a => {
    const anchor = a as HTMLAnchorElement;
    return {
      href: anchor.href,
      text: anchor.textContent?.trim() || '',
      isExternal: anchor.host !== window.location.host,
    };
  });

  const images: ImageInfo[] = Array.from(doc.querySelectorAll('img')).slice(0, 50).map(img => ({
    src: (img as HTMLImageElement).src,
    alt: (img as HTMLImageElement).alt || undefined,
    dimensions: (img as HTMLImageElement).width && (img as HTMLImageElement).height 
      ? { width: (img as HTMLImageElement).width, height: (img as HTMLImageElement).height }
      : undefined,
  }));

  const dataAttributes: string[] = [];
  allElements.forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('data-') && !dataAttributes.includes(attr.name)) {
        dataAttributes.push(attr.name);
      }
    });
  });

  const interactiveSelectors = 'button, a, input, select, textarea, [role="button"], [onclick], [tabindex]';
  const interactiveElements: InteractiveElement[] = Array.from(doc.querySelectorAll(interactiveSelectors))
    .slice(0, 100)
    .map((el, idx) => {
      const htmlEl = el as HTMLElement;
      let selector = el.tagName.toLowerCase();
      if (el.id) selector = `#${el.id}`;
      else if (el.className) selector = `${el.tagName.toLowerCase()}.${el.className.split(' ')[0]}`;
      else selector = `${el.tagName.toLowerCase()}:nth-of-type(${idx + 1})`;
      
      return {
        tag: el.tagName.toLowerCase(),
        selector,
        text: htmlEl.textContent?.trim().substring(0, 50) || undefined,
        type: (el as HTMLInputElement).type || undefined,
      };
    });

  return {
    totalElements: allElements.length,
    elementCounts,
    forms,
    links,
    images,
    scripts: doc.querySelectorAll('script').length,
    styles: doc.querySelectorAll('style, link[rel="stylesheet"]').length,
    dataAttributes: dataAttributes.slice(0, 50),
    interactiveElements,
  };
}

// ============================================
// WebSocket Connection Manager
// ============================================

class IAIWebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();
  private messageQueue: Array<{ type: string; payload: unknown }> = [];
  private isConnected = false;
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        
        this.ws.onopen = () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.flushMessageQueue();
          this.emit('connected', { timestamp: new Date() });
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.emit(data.type, data.payload);
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', { error, timestamp: new Date() });
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.emit('disconnected', { timestamp: new Date() });
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      setTimeout(() => this.connect(), delay);
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const msg = this.messageQueue.shift();
      if (msg) this.send(msg.type, msg.payload);
    }
  }

  send(type: string, payload: unknown): void {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      this.messageQueue.push({ type, payload });
    }
  }

  on(event: string, callback: (data: unknown) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach(callback => callback(data));
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.isConnected = false;
  }

  getConnectionState(): boolean {
    return this.isConnected;
  }
}

// ============================================
// API Functions for IAI Prototype (PRODUCTION)
// ============================================

// Production mode - connects to real backend
const PRODUCTION_MODE = true;

// Mode types
export type IAIMode = 'live' | 'simulation';

interface WorkerHealthResponse {
  status: string;
  workers_active: number;
  message?: string;
}

interface CreateSoldierResponse {
  success: boolean;
  sessionId: string;
  workerConnected: boolean;
  message: string;
  mode: IAIMode;
}

interface ActionResult {
  success: boolean;
  url?: string;
  screenshot?: string;
  html?: string;
  analysis?: HTMLAnalysis;
  data?: Array<{ type: string; content: string; selector: string }>;
  clicked?: string;
  typed?: string;
  into?: string;
  waited?: string;
  scrolled?: number;
  hovered?: string;
  selected?: string;
  result?: unknown;
  error?: string;
}

async function checkWorkerHealth(): Promise<WorkerHealthResponse> {
  try {
    const response = await api.get('/api/admin/iai/worker/health');
    return response.data;
  } catch (error: any) {
    return { status: 'offline', workers_active: 0, message: error.message };
  }
}

async function createPrototypeSoldier(targetUrl?: string, forceMode?: IAIMode): Promise<CreateSoldierResponse> {
  try {
    const response = await api.post('/api/admin/iai/prototype/create', { targetUrl, forceMode });
    return response.data;
  } catch (error: any) {
    console.error('Failed to create prototype soldier:', error);
    throw new Error(error.response?.data?.error || error.message || 'Failed to create soldier');
  }
}

async function executePrototypeAction(
  sessionId: string, 
  action: string, 
  target?: string, 
  value?: string, 
  script?: string
): Promise<ActionResult> {
  try {
    const response = await api.post(`/api/admin/iai/prototype/${sessionId}/action`, {
      action,
      target,
      value,
      script,
    });
    return response.data;
  } catch (error: any) {
    console.error('Failed to execute action:', error);
    throw new Error(error.response?.data?.error || error.message || 'Failed to execute action');
  }
}

// @ts-ignore - Future use for session status polling
async function _getPrototypeStatus(sessionId: string): Promise<{
  sessionId: string;
  status: string;
  currentUrl: string;
  logs: Array<{ timestamp: Date; level: string; message: string }>;
}> {
  try {
    const response = await api.get(`/api/admin/iai/prototype/${sessionId}/status`);
    return response.data;
  } catch (error: any) {
    console.error('Failed to get session status:', error);
    throw new Error(error.response?.data?.error || error.message || 'Failed to get status');
  }
}
// Export to avoid unused error
export { _getPrototypeStatus as getPrototypeStatus };

async function killSoldierSession(sessionId: string): Promise<void> {
  try {
    await api.delete(`/api/admin/iai/prototype/${sessionId}`);
  } catch (error: any) {
    console.error('Failed to kill session:', error);
    throw new Error(error.response?.data?.error || error.message || 'Failed to kill session');
  }
}

// @ts-ignore - Future use for session listing
async function _listPrototypeSessions(): Promise<{
  sessions: Array<{
    id: string;
    status: string;
    currentUrl: string;
    createdAt: string;
    logCount: number;
  }>;
  total: number;
}> {
  try {
    const response = await api.get('/api/admin/iai/prototype/sessions');
    return response.data;
  } catch (error: any) {
    console.error('Failed to list sessions:', error);
    throw new Error(error.response?.data?.error || error.message || 'Failed to list sessions');
  }
}
// Export to avoid unused error
export { _listPrototypeSessions as listPrototypeSessions };

async function sendDataToEndpoint(endpoint: string, data: unknown): Promise<unknown> {
  try {
    const response = await api.post('/api/admin/iai/prototype/send-data', { endpoint, data });
    return response.data;
  } catch (error: any) {
    // Fallback for custom endpoint
    const externalResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return externalResponse.json();
  }
}

async function saveHarvestedData(sessionId: string, data: HarvestedData[]): Promise<void> {
  try {
    await api.post(`/api/admin/iai/prototype/${sessionId}/save-data`, { data });
  } catch (error: any) {
    console.error('Failed to save harvested data:', error);
    // Non-critical - continue
  }
}

// ============================================
// Components
// ============================================

// Screenshot Viewer Modal
function ScreenshotViewer({ 
  screenshot, 
  onClose 
}: { 
  screenshot: Screenshot; 
  onClose: () => void;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div 
        className={`bg-white rounded-lg overflow-hidden ${isFullscreen ? 'w-full h-full' : 'max-w-4xl max-h-[90vh]'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
          <div className="text-white text-sm">
            <span className="font-medium">Screenshot</span>
            <span className="text-gray-400 ml-2">{screenshot.dimensions.width}x{screenshot.dimensions.height}</span>
            <span className="text-gray-400 ml-2">{formatTimestamp(screenshot.timestamp)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1 text-gray-400 hover:text-white"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <a
              href={screenshot.dataUrl}
              download={`screenshot-${screenshot.id}.jpg`}
              className="p-1 text-gray-400 hover:text-white"
            >
              <Download className="w-4 h-4" />
            </a>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="overflow-auto">
          <img 
            src={screenshot.dataUrl} 
            alt="Screenshot" 
            className="max-w-full h-auto"
          />
        </div>
        <div className="bg-gray-100 px-4 py-2 text-xs text-gray-600 truncate">
          URL: {screenshot.url}
        </div>
      </div>
    </div>
  );
}

// HTML Analysis Panel
function HTMLAnalysisPanel({ analysis }: { analysis: HTMLAnalysis }) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary']));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const Section = ({ id, title, count, children }: { id: string; title: string; count?: number; children: React.ReactNode }) => (
    <div className="border-b border-gray-700 last:border-0">
      <button
        onClick={() => toggleSection(id)}
        className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-gray-800"
      >
        <span className="text-gray-300 font-medium text-sm">
          {title}
          {count !== undefined && <span className="text-gray-500 ml-2">({count})</span>}
        </span>
        {expandedSections.has(id) ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
      </button>
      {expandedSections.has(id) && (
        <div className="px-3 pb-3 text-xs">
          {children}
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
      <div className="bg-gray-800 px-3 py-2 border-b border-gray-700">
        <h4 className="text-white font-medium text-sm flex items-center gap-2">
          <Code className="w-4 h-4" />
          HTML Structure Analysis
        </h4>
      </div>
      
      <Section id="summary" title="Summary">
        <div className="grid grid-cols-2 gap-2 text-gray-400">
          <div>Total Elements: <span className="text-white">{analysis.totalElements}</span></div>
          <div>Forms: <span className="text-white">{analysis.forms.length}</span></div>
          <div>Links: <span className="text-white">{analysis.links.length}</span></div>
          <div>Images: <span className="text-white">{analysis.images.length}</span></div>
          <div>Scripts: <span className="text-white">{analysis.scripts}</span></div>
          <div>Styles: <span className="text-white">{analysis.styles}</span></div>
        </div>
      </Section>

      <Section id="elements" title="Element Counts" count={Object.keys(analysis.elementCounts).length}>
        <div className="flex flex-wrap gap-1">
          {Object.entries(analysis.elementCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([tag, count]) => (
              <span key={tag} className="px-2 py-0.5 bg-gray-800 rounded text-gray-300">
                {tag}: {count}
              </span>
            ))}
        </div>
      </Section>

      <Section id="forms" title="Forms" count={analysis.forms.length}>
        {analysis.forms.map((form, idx) => (
          <div key={idx} className="mb-2 p-2 bg-gray-800 rounded">
            <div className="text-gray-300">
              {form.id && <span className="text-blue-400">#{form.id}</span>}
              <span className="text-gray-500 ml-2">{form.method?.toUpperCase() || 'GET'}</span>
            </div>
            <div className="text-gray-500 text-xs truncate">{form.action}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {form.inputs.map((input, iIdx) => (
                <span key={iIdx} className="px-1 bg-gray-700 rounded text-gray-400">
                  {input.name || input.type}
                </span>
              ))}
            </div>
          </div>
        ))}
        {analysis.forms.length === 0 && <span className="text-gray-500">No forms found</span>}
      </Section>

      <Section id="interactive" title="Interactive Elements" count={analysis.interactiveElements.length}>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {analysis.interactiveElements.slice(0, 30).map((el, idx) => (
            <div key={idx} className="flex items-center gap-2 p-1 hover:bg-gray-800 rounded">
              <span className="text-purple-400">{el.tag}</span>
              <span className="text-gray-500 truncate flex-1">{el.selector}</span>
              {el.text && <span className="text-gray-600 truncate max-w-[100px]">{el.text}</span>}
            </div>
          ))}
        </div>
      </Section>

      <Section id="data-attrs" title="Data Attributes" count={analysis.dataAttributes.length}>
        <div className="flex flex-wrap gap-1">
          {analysis.dataAttributes.map((attr, idx) => (
            <span key={idx} className="px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded">
              {attr}
            </span>
          ))}
          {analysis.dataAttributes.length === 0 && <span className="text-gray-500">No data attributes</span>}
        </div>
      </Section>
    </div>
  );
}

// Data Action Menu
function DataActionMenu({
  data,
  onAction,
  onClose,
}: {
  data: HarvestedData;
  onAction: (action: DataAction, data: HarvestedData) => void;
  onClose: () => void;
}) {
  const actions: DataAction[] = [
    {
      id: 'send_api',
      name: 'Send to API Endpoint',
      description: 'POST data to custom endpoint',
      type: 'send_to_api',
      config: { endpoint: '' },
    },
    {
      id: 'save_db',
      name: 'Save to Database',
      description: 'Store in IAI data collection',
      type: 'save_to_db',
      config: { collection: 'harvested_data' },
    },
    {
      id: 'export_json',
      name: 'Export as JSON',
      description: 'Download as JSON file',
      type: 'export_json',
      config: {},
    },
    {
      id: 'export_csv',
      name: 'Export as CSV',
      description: 'Download as CSV file',
      type: 'export_csv',
      config: {},
    },
    {
      id: 'transform',
      name: 'Transform Data',
      description: 'Apply transformation rules',
      type: 'transform',
      config: { rules: [] },
    },
    {
      id: 'trigger_workflow',
      name: 'Trigger Workflow',
      description: 'Start automated workflow',
      type: 'trigger_workflow',
      config: { workflowId: '' },
    },
  ];

  return (
    <div className="absolute right-0 top-full mt-1 w-64 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50">
      <div className="p-2 border-b border-gray-700">
        <h4 className="text-white font-medium text-sm">Actions for Data</h4>
        <p className="text-gray-500 text-xs truncate">{data.selector}</p>
      </div>
      <div className="p-1">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => {
              onAction(action, data);
              onClose();
            }}
            className="w-full px-3 py-2 text-left hover:bg-gray-700 rounded flex items-center gap-2"
          >
            {action.type === 'send_to_api' && <Send className="w-4 h-4 text-blue-400" />}
            {action.type === 'save_to_db' && <Database className="w-4 h-4 text-green-400" />}
            {action.type === 'export_json' && <FileJson className="w-4 h-4 text-yellow-400" />}
            {action.type === 'export_csv' && <FileText className="w-4 h-4 text-orange-400" />}
            {action.type === 'transform' && <Settings className="w-4 h-4 text-purple-400" />}
            {action.type === 'trigger_workflow' && <Zap className="w-4 h-4 text-cyan-400" />}
            <div>
              <div className="text-gray-200 text-sm">{action.name}</div>
              <div className="text-gray-500 text-xs">{action.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Data Card Component
function HarvestedDataCard({
  data,
  onAction,
  screenshots,
}: {
  data: HarvestedData;
  onAction: (action: DataAction, data: HarvestedData) => void;
  screenshots: Screenshot[];
}) {
  const [showActions, setShowActions] = useState(false);
  const [showScreenshot, setShowScreenshot] = useState<Screenshot | null>(null);
  
  const relatedScreenshot = screenshots.find(s => s.actionId === data.actionId);

  const getTypeIcon = () => {
    switch (data.type) {
      case 'text': return <Type className="w-4 h-4 text-blue-400" />;
      case 'html': return <Code className="w-4 h-4 text-purple-400" />;
      case 'image_url': return <Image className="w-4 h-4 text-green-400" />;
      case 'link': return <Globe className="w-4 h-4 text-cyan-400" />;
      case 'table': return <Layers className="w-4 h-4 text-orange-400" />;
      case 'json': return <FileJson className="w-4 h-4 text-yellow-400" />;
      default: return <Box className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-3 relative group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {getTypeIcon()}
          <span className="text-gray-200 font-medium text-sm">{data.type}</span>
          {data.processed && (
            <span className="px-1.5 py-0.5 bg-green-900/30 text-green-400 text-xs rounded">Processed</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500 text-xs">{formatTimestamp(data.timestamp)}</span>
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-1 hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </button>
            {showActions && (
              <DataActionMenu data={data} onAction={onAction} onClose={() => setShowActions(false)} />
            )}
          </div>
        </div>
      </div>
      
      <div className="text-gray-500 text-xs mb-2 font-mono truncate">{data.selector}</div>
      
      <div className="bg-gray-900 rounded p-2 max-h-32 overflow-auto">
        {data.type === 'image_url' && typeof data.value === 'string' ? (
          <img src={data.value} alt="Harvested" className="max-w-full h-auto rounded" />
        ) : (
          <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap break-all">
            {typeof data.value === 'string' ? data.value : JSON.stringify(data.value, null, 2)}
          </pre>
        )}
      </div>

      {relatedScreenshot && (
        <button
          onClick={() => setShowScreenshot(relatedScreenshot)}
          className="mt-2 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
        >
          <Camera className="w-3 h-3" />
          View Screenshot
        </button>
      )}

      {data.sentTo && data.sentTo.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {data.sentTo.map((dest, idx) => (
            <span key={idx} className="px-1.5 py-0.5 bg-blue-900/30 text-blue-400 text-xs rounded">
              → {dest}
            </span>
          ))}
        </div>
      )}

      {showScreenshot && (
        <ScreenshotViewer screenshot={showScreenshot} onClose={() => setShowScreenshot(null)} />
      )}
    </div>
  );
}

// ============================================
// Main Prototype Test Panel Component
// ============================================

export default function IAIPrototypePanel() {
  // State
  const [soldiers, setSoldiers] = useState<PrototypeSoldier[]>([]);
  const [selectedSoldier, setSelectedSoldier] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState('https://www.facebook.com/marketplace');
  const [actionType, setActionType] = useState<SoldierAction['type']>('navigate');
  const [actionTarget, setActionTarget] = useState('');
  const [actionValue, setActionValue] = useState('');
  const [customScript, setCustomScript] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [dataFilter, setDataFilter] = useState<string>('all');
  const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null);
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [showApiConfig, setShowApiConfig] = useState(false);
  
  // LIVE vs SIMULATION mode
  const [iaiMode, setIaiMode] = useState<IAIMode>('live');
  const [workerStatus, setWorkerStatus] = useState<WorkerHealthResponse | null>(null);
  const [checkingWorker, setCheckingWorker] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<IAIWebSocketManager | null>(null);

  const activeSoldier = soldiers.find((s) => s.id === selectedSoldier);

  // Check worker health on mount and periodically
  const checkWorker = useCallback(async () => {
    setCheckingWorker(true);
    try {
      const health = await checkWorkerHealth();
      setWorkerStatus(health);
      if (health.status !== 'healthy' && health.workers_active === 0 && iaiMode === 'live') {
        setLastError('Python Worker not connected. Switch to Simulation mode or start the worker.');
      } else {
        setLastError(null);
      }
    } catch (error) {
      setWorkerStatus({ status: 'offline', workers_active: 0, message: 'Failed to check worker' });
      if (iaiMode === 'live') {
        setLastError('Cannot connect to Python Worker API');
      }
    } finally {
      setCheckingWorker(false);
    }
  }, [iaiMode]);

  useEffect(() => {
    checkWorker();
    const interval = setInterval(checkWorker, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [checkWorker]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSoldier?.logs]);

  // Initialize WebSocket connection
  useEffect(() => {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/iai-prototype`;
    wsRef.current = new IAIWebSocketManager(wsUrl);
    
    wsRef.current.on('connected', () => {
      setWsConnected(true);
      addLog('system', 'info', '🔌 WebSocket connected to IAI Prototype server');
    });

    wsRef.current.on('disconnected', () => {
      setWsConnected(false);
      addLog('system', 'warn', '🔌 WebSocket disconnected');
    });

    wsRef.current.on('soldier_update', (data: unknown) => {
      const update = data as { soldierId: string; status?: string; log?: SoldierLog; data?: HarvestedData; screenshot?: Screenshot; html?: HTMLSnapshot };
      
      setSoldiers(prev => prev.map(s => {
        if (s.id !== update.soldierId) return s;
        
        const updated = { ...s, lastActivity: new Date() };
        if (update.status) updated.status = update.status as PrototypeSoldier['status'];
        if (update.log) updated.logs = [...updated.logs, update.log];
        if (update.data) updated.harvestedData = [...updated.harvestedData, update.data];
        if (update.screenshot) updated.screenshots = [...updated.screenshots, update.screenshot];
        if (update.html) updated.htmlSnapshots = [...updated.htmlSnapshots, update.html];
        
        return updated;
      }));
    });

    wsRef.current.on('action_result', (data: unknown) => {
      const result = data as { soldierId: string; actionId: string; status: string; result?: string; error?: string; duration?: number };
      
      setSoldiers(prev => prev.map(s => {
        if (s.id !== result.soldierId) return s;
        
        return {
          ...s,
          actions: s.actions.map(a => 
            a.id === result.actionId 
              ? { ...a, status: result.status as SoldierAction['status'], result: result.result, error: result.error, duration: result.duration }
              : a
          ),
        };
      }));
    });

    // Connect WebSocket
    wsRef.current.connect().catch(err => {
      console.error('WebSocket connection failed:', err);
    });

    return () => {
      wsRef.current?.disconnect();
    };
  }, []);

  const addLog = useCallback((soldierId: string, level: SoldierLog['level'], message: string, data?: unknown) => {
    const log: SoldierLog = {
      id: generateId(),
      timestamp: new Date(),
      level,
      message,
      data,
      source: soldierId === 'system' ? 'system' : 'soldier',
    };

    if (soldierId === 'system') {
      // System-wide log - add to all soldiers or handle separately
      console.log(`[SYSTEM] ${message}`, data);
      return;
    }

    setSoldiers((prev) =>
      prev.map((s) =>
        s.id === soldierId
          ? { ...s, logs: [...s.logs, log], lastActivity: new Date() }
          : s
      )
    );
  }, []);

  const createSoldier = async () => {
    // In LIVE mode, check if worker is available first
    if (iaiMode === 'live' && workerStatus?.status !== 'healthy' && workerStatus?.workers_active === 0) {
      setLastError('❌ Cannot create LIVE soldier: Python Worker not connected. Start the worker or switch to Simulation mode.');
      return;
    }
    
    setIsConnecting(true);
    setLastError(null);
    
    const newSoldier: PrototypeSoldier = {
      id: generateId(),
      status: 'connecting',
      currentUrl: '',
      createdAt: new Date(),
      lastActivity: new Date(),
      sessionId: null,
      browserInfo: null,
      actions: [],
      logs: [],
      harvestedData: [],
      screenshots: [],
      htmlSnapshots: [],
    };

    setSoldiers((prev) => [...prev, newSoldier]);
    setSelectedSoldier(newSoldier.id);

    try {
      // Request backend to create actual browser session
      addLog(newSoldier.id, 'system', `🤖 Creating IAI Prototype Soldier in ${iaiMode.toUpperCase()} mode...`);
      addLog(newSoldier.id, 'info', iaiMode === 'live' ? '🌐 Connecting to Python Worker API...' : '🎭 Running in SIMULATION mode (no real browser)');
      
      const response = await createPrototypeSoldier(targetUrl, iaiMode);
      
      // Check if we got a live connection when we requested live mode
      if (iaiMode === 'live' && !response.workerConnected) {
        addLog(newSoldier.id, 'error', '❌ LIVE MODE FAILED: Python Worker not available!');
        addLog(newSoldier.id, 'warn', '⚠️ Switch to Simulation mode or start the Python Worker');
        setLastError('LIVE mode failed: Python Worker not connected');
        setSoldiers(prev => prev.map(s => 
          s.id === newSoldier.id 
            ? { ...s, status: 'error' }
            : s
        ));
        return;
      }
      
      setSoldiers(prev => prev.map(s => 
        s.id === newSoldier.id 
          ? { 
              ...s, 
              sessionId: response.sessionId, 
              status: 'idle',
              browserInfo: {
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1920, height: 1080 },
                platform: iaiMode === 'live' ? 'Linux (Python Worker)' : 'Simulation',
              },
            }
          : s
      ));
      
      // Update mode from response (in case backend changed it)
      if (response.mode && response.mode !== iaiMode) {
        setIaiMode(response.mode);
        addLog(newSoldier.id, 'warn', `⚠️ Mode changed to ${response.mode.toUpperCase()} by backend`);
      }
      
      if (response.workerConnected) {
        addLog(newSoldier.id, 'info', '✅ LIVE MODE: Connected to Python Worker with real Chromium browser');
        addLog(newSoldier.id, 'info', '📸 Real screenshots and browser automation enabled');
      } else {
        addLog(newSoldier.id, 'warn', '🎭 SIMULATION MODE: No real browser - actions are simulated');
        addLog(newSoldier.id, 'info', '⚠️ Screenshots will be placeholders');
      }
      addLog(newSoldier.id, 'debug', `Session ID: ${response.sessionId}`);
      addLog(newSoldier.id, 'system', `🟢 Soldier ready for commands (${response.mode?.toUpperCase() || iaiMode.toUpperCase()})`);
      
      // Subscribe to soldier updates via WebSocket
      if (PRODUCTION_MODE) {
        wsRef.current?.send('subscribe', { soldierId: newSoldier.id, sessionId: response.sessionId });
      }
      
    } catch (error) {
      addLog(newSoldier.id, 'error', `❌ Failed to create soldier: ${(error as Error).message}`);
      setLastError((error as Error).message);
      setSoldiers(prev => prev.map(s => 
        s.id === newSoldier.id 
          ? { ...s, status: 'error' }
          : s
      ));
    } finally {
      setIsConnecting(false);
    }
  };

  const executeAction = async (soldierId: string) => {
    const soldier = soldiers.find((s) => s.id === soldierId);
    if (!soldier || soldier.status === 'killed') {
      addLog(soldierId, 'error', '❌ Cannot execute action: Soldier not ready');
      return;
    }
    
    if (!soldier.sessionId) {
      addLog(soldierId, 'error', '❌ Cannot execute action: No session');
      return;
    }

    const action: SoldierAction = {
      id: generateId(),
      type: actionType,
      target: actionTarget || undefined,
      value: actionValue || (actionType === 'custom' ? customScript : undefined),
      timestamp: new Date(),
      status: 'queued',
    };

    // Add action to queue
    setSoldiers((prev) =>
      prev.map((s) =>
        s.id === soldierId
          ? { ...s, actions: [...s.actions, action], status: 'running' }
          : s
      )
    );

    addLog(soldierId, 'action', `▶️ Executing: ${actionType}`, {
      target: actionTarget,
      value: actionValue,
    });

    const startTime = Date.now();

    try {
      // Call the real backend API
      const result = await executePrototypeAction(
        soldier.sessionId,
        actionType,
        actionTarget || targetUrl,
        actionValue,
        actionType === 'custom' ? customScript : undefined
      );

      const duration = Date.now() - startTime;
      let newUrl = soldier.currentUrl;
      let screenshots = [...soldier.screenshots];
      let htmlSnapshots = [...soldier.htmlSnapshots];
      let harvestedData = [...soldier.harvestedData];

      // Process results based on action type with try-catch to prevent crashes
      try {
        if (actionType === 'navigate' && result.url) {
          newUrl = result.url;
          addLog(soldierId, 'info', `📍 Navigated to: ${newUrl}`);
        } else if (actionType === 'screenshot' && result.screenshot) {
          const screenshot: Screenshot = {
            id: generateId(),
            timestamp: new Date(),
            actionId: action.id,
            dataUrl: result.screenshot,
            dimensions: { width: 1920, height: 1080 },
            url: soldier.currentUrl || targetUrl,
            fullPage: false,
          };
          screenshots = [...screenshots, screenshot];
          addLog(soldierId, 'data', '📷 Screenshot captured');
        } else if (actionType === 'analyze_html') {
          // Safe HTML analysis with error handling
          let analysis: HTMLAnalysis;
          if (result.analysis) {
            analysis = result.analysis;
          } else if (result.html) {
            try {
              analysis = analyzeHTML(result.html);
            } catch (parseError) {
              console.error('HTML parsing error:', parseError);
              analysis = {
                totalElements: 0,
                elementCounts: {},
                forms: [],
                links: [],
                images: [],
                scripts: 0,
                styles: 0,
                dataAttributes: [],
                interactiveElements: [],
              };
              addLog(soldierId, 'warn', `⚠️ HTML parsing failed: ${(parseError as Error).message}`);
            }
          } else {
            analysis = {
              totalElements: 0,
              elementCounts: {},
              forms: [],
              links: [],
              images: [],
              scripts: 0,
              styles: 0,
              dataAttributes: [],
              interactiveElements: [],
            };
          }
          const htmlSnapshot: HTMLSnapshot = {
            id: generateId(),
            timestamp: new Date(),
            actionId: action.id,
            url: soldier.currentUrl || targetUrl,
            html: result.html || '<html><body>No HTML captured</body></html>',
            analysis,
          };
          htmlSnapshots = [...htmlSnapshots, htmlSnapshot];
          addLog(soldierId, 'data', `🔍 HTML analyzed: ${analysis.totalElements} elements, ${analysis.forms.length} forms`);
        } else if (actionType === 'extract' && result.data) {
          for (const item of result.data) {
            const extractedData: HarvestedData = {
              id: generateId(),
              timestamp: new Date(),
              actionId: action.id,
              type: item.type as HarvestedData['type'] || 'text',
              selector: item.selector || actionTarget || '',
              value: item.content,
              processed: false,
            };
            harvestedData = [...harvestedData, extractedData];
          }
          addLog(soldierId, 'data', `📦 Data extracted from: ${actionTarget}`);
        } else if (actionType === 'click') {
          addLog(soldierId, 'info', `🖱️ Clicked: ${result.clicked || actionTarget}`);
        } else if (actionType === 'type') {
          addLog(soldierId, 'info', `⌨️ Typed "${result.typed || actionValue}" into ${result.into || actionTarget}`);
        } else if (actionType === 'wait') {
          addLog(soldierId, 'info', `⏳ Waited ${result.waited || actionValue}ms`);
        } else if (actionType === 'scroll') {
          addLog(soldierId, 'info', `📜 Scrolled by ${result.scrolled || actionValue}px`);
        } else if (actionType === 'hover') {
          addLog(soldierId, 'info', `👆 Hovered over: ${result.hovered || actionTarget}`);
        } else if (actionType === 'select') {
          addLog(soldierId, 'info', `📋 Selected "${result.selected || actionValue}" from ${actionTarget}`);
        } else if (actionType === 'custom' || actionType === 'evaluate') {
          addLog(soldierId, 'info', '⚡ Script executed successfully');
          if (result.result) {
            addLog(soldierId, 'data', `Result: ${JSON.stringify(result.result).substring(0, 200)}`);
          }
        }
      } catch (processError) {
        console.error('Error processing action result:', processError);
        addLog(soldierId, 'warn', `⚠️ Result processing error: ${(processError as Error).message}`);
      }

      // Update soldier state
      setSoldiers(prev => prev.map(s => {
        if (s.id !== soldierId) return s;
        return {
          ...s,
          currentUrl: newUrl,
          status: 'idle',
          screenshots,
          htmlSnapshots,
          harvestedData,
          actions: s.actions.map(a => 
            a.id === action.id 
              ? { ...a, status: 'completed' as const, duration }
              : a
          ),
        };
      }));

      addLog(soldierId, 'info', `✅ ${actionType} completed in ${duration}ms`);
    } catch (error) {
      console.error('Action execution error:', error);
      setLastError((error as Error).message);
      setSoldiers(prev => prev.map(s => {
        if (s.id !== soldierId) return s;
        return {
          ...s,
          status: 'idle',
          actions: s.actions.map(a => 
            a.id === action.id 
              ? { ...a, status: 'failed' as const, error: (error as Error).message }
              : a
          ),
        };
      }));
      addLog(soldierId, 'error', `❌ ${actionType} failed: ${(error as Error).message}`);
    }

    // Clear inputs
    setActionTarget('');
    setActionValue('');
  };

  const handleDataAction = async (action: DataAction, data: HarvestedData) => {
    const soldier = activeSoldier;
    if (!soldier) return;

    switch (action.type) {
      case 'send_to_api':
        if (!apiEndpoint) {
          setShowApiConfig(true);
          return;
        }
        try {
          await sendDataToEndpoint(apiEndpoint, data);
          setSoldiers(prev => prev.map(s => {
            if (s.id !== soldier.id) return s;
            return {
              ...s,
              harvestedData: s.harvestedData.map(d => 
                d.id === data.id 
                  ? { ...d, sentTo: [...(d.sentTo || []), apiEndpoint], processed: true }
                  : d
              ),
            };
          }));
          addLog(soldier.id, 'info', `📤 Data sent to ${apiEndpoint}`);
        } catch (error) {
          addLog(soldier.id, 'error', `❌ Failed to send data: ${(error as Error).message}`);
        }
        break;

      case 'save_to_db':
        try {
          await saveHarvestedData(soldier.sessionId || soldier.id, [data]);
          setSoldiers(prev => prev.map(s => {
            if (s.id !== soldier.id) return s;
            return {
              ...s,
              harvestedData: s.harvestedData.map(d => 
                d.id === data.id 
                  ? { ...d, sentTo: [...(d.sentTo || []), 'database'], processed: true }
                  : d
              ),
            };
          }));
          addLog(soldier.id, 'info', '💾 Data saved to database');
        } catch (error) {
          addLog(soldier.id, 'error', `❌ Failed to save data: ${(error as Error).message}`);
        }
        break;

      case 'export_json':
        const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const jsonUrl = URL.createObjectURL(jsonBlob);
        const jsonLink = document.createElement('a');
        jsonLink.href = jsonUrl;
        jsonLink.download = `harvested-data-${data.id}.json`;
        jsonLink.click();
        URL.revokeObjectURL(jsonUrl);
        addLog(soldier.id, 'info', '📥 Data exported as JSON');
        break;

      case 'export_csv':
        const csvContent = `"timestamp","type","selector","value"\n"${data.timestamp}","${data.type}","${data.selector}","${JSON.stringify(data.value).replace(/"/g, '""')}"`;
        const csvBlob = new Blob([csvContent], { type: 'text/csv' });
        const csvUrl = URL.createObjectURL(csvBlob);
        const csvLink = document.createElement('a');
        csvLink.href = csvUrl;
        csvLink.download = `harvested-data-${data.id}.csv`;
        csvLink.click();
        URL.revokeObjectURL(csvUrl);
        addLog(soldier.id, 'info', '📥 Data exported as CSV');
        break;

      default:
        addLog(soldier.id, 'warn', `⚠️ Action type "${action.type}" not yet implemented`);
    }
  };

  const pauseSoldier = async (soldierId: string) => {
    const soldier = soldiers.find(s => s.id === soldierId);
    if (!soldier?.sessionId) {
      addLog(soldierId, 'error', '❌ Cannot pause: No session');
      return;
    }
    try {
      await executePrototypeAction(soldier.sessionId, 'pause', undefined, undefined, undefined);
      setSoldiers((prev) =>
        prev.map((s) =>
          s.id === soldierId ? { ...s, status: 'paused' } : s
        )
      );
      addLog(soldierId, 'warn', '⏸️ Soldier paused');
    } catch (error) {
      addLog(soldierId, 'error', `❌ Failed to pause: ${(error as Error).message}`);
    }
  };

  const resumeSoldier = async (soldierId: string) => {
    const soldier = soldiers.find(s => s.id === soldierId);
    if (!soldier?.sessionId) {
      addLog(soldierId, 'error', '❌ Cannot resume: No session');
      return;
    }
    try {
      await executePrototypeAction(soldier.sessionId, 'resume', undefined, undefined, undefined);
      setSoldiers((prev) =>
        prev.map((s) =>
          s.id === soldierId ? { ...s, status: 'idle' } : s
        )
      );
      addLog(soldierId, 'info', '▶️ Soldier resumed');
    } catch (error) {
      addLog(soldierId, 'error', `❌ Failed to resume: ${(error as Error).message}`);
    }
  };

  const killSoldier = async (soldierId: string) => {
    if (!confirm('Are you sure you want to kill this soldier? This action cannot be undone.')) return;

    const soldier = soldiers.find(s => s.id === soldierId);
    
    addLog(soldierId, 'error', '💀 KILL SIGNAL RECEIVED');
    addLog(soldierId, 'info', '🔌 Terminating Chromium session...');

    try {
      if (soldier?.sessionId) {
        await killSoldierSession(soldier.sessionId);
      }
      
      wsRef.current?.send('unsubscribe', { soldierId });
      
      setSoldiers((prev) =>
        prev.map((s) =>
          s.id === soldierId ? { ...s, status: 'killed', sessionId: null } : s
        )
      );
      addLog(soldierId, 'warn', '☠️ Soldier terminated');
    } catch (error) {
      addLog(soldierId, 'error', `❌ Kill failed: ${(error as Error).message}`);
    }
  };

  const removeSoldier = (soldierId: string) => {
    setSoldiers((prev) => prev.filter((s) => s.id !== soldierId));
    if (selectedSoldier === soldierId) {
      setSelectedSoldier(null);
    }
  };

  const exportAllLogs = (soldierId: string) => {
    const soldier = soldiers.find((s) => s.id === soldierId);
    if (!soldier) return;

    const exportData = {
      soldierId: soldier.id,
      sessionId: soldier.sessionId,
      createdAt: soldier.createdAt,
      status: soldier.status,
      currentUrl: soldier.currentUrl,
      browserInfo: soldier.browserInfo,
      logs: soldier.logs,
      actions: soldier.actions,
      harvestedData: soldier.harvestedData,
      screenshots: soldier.screenshots.map(s => ({ ...s, dataUrl: '[BASE64_DATA]' })), // Don't include full image data
      htmlSnapshots: soldier.htmlSnapshots.map(h => ({ ...h, html: `[${h.html.length} chars]` })), // Truncate HTML
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iai-soldier-${soldierId}-full-export.json`;
    a.click();
    URL.revokeObjectURL(url);

    addLog(soldierId, 'info', '📥 Full export completed');
  };

  const getStatusBadge = (status: PrototypeSoldier['status']) => {
    const badges: Record<string, { color: string; icon: typeof CheckCircle; label: string }> = {
      idle: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Ready' },
      running: { color: 'bg-blue-100 text-blue-800', icon: Activity, label: 'Running' },
      paused: { color: 'bg-yellow-100 text-yellow-800', icon: Pause, label: 'Paused' },
      error: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'Error' },
      killed: { color: 'bg-gray-100 text-gray-800', icon: Skull, label: 'Killed' },
      connecting: { color: 'bg-purple-100 text-purple-800', icon: RefreshCw, label: 'Connecting' },
    };
    const badge = badges[status] || badges.idle;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className={`w-3 h-3 ${status === 'connecting' ? 'animate-spin' : ''}`} />
        {badge.label}
      </span>
    );
  };

  const getLogColor = (level: SoldierLog['level']) => {
    const colors: Record<string, string> = {
      info: 'text-blue-400',
      warn: 'text-yellow-400',
      error: 'text-red-400',
      debug: 'text-gray-500',
      action: 'text-purple-400',
      data: 'text-green-400',
      system: 'text-cyan-400',
    };
    return colors[level] || 'text-gray-400';
  };

  const filteredData = activeSoldier?.harvestedData.filter(d => 
    dataFilter === 'all' || d.type === dataFilter
  ) || [];

  const latestHtmlSnapshot = activeSoldier?.htmlSnapshots[activeSoldier.htmlSnapshots.length - 1];

  const isWorkerOnline = workerStatus?.status === 'healthy' || (workerStatus?.workers_active ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {lastError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-800">{lastError}</span>
          </div>
          <button onClick={() => setLastError(null)} className="text-red-600 hover:text-red-800">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Control Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Terminal className="w-6 h-6 text-purple-600" />
              IAI Prototype Test Console
              {wsConnected ? (
                <span className="flex items-center gap-1 text-green-600 text-sm font-normal">
                  <Wifi className="w-4 h-4" />
                  WS Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-600 text-sm font-normal">
                  <WifiOff className="w-4 h-4" />
                  WS Disconnected
                </span>
              )}
            </h3>
            <p className="text-gray-600 mt-1">
              {iaiMode === 'live' 
                ? '🟢 LIVE MODE: Real browser automation with Python Worker' 
                : '🎭 SIMULATION MODE: Testing without real browser'}
            </p>
          </div>
          <button
            onClick={createSoldier}
            disabled={isConnecting || (iaiMode === 'live' && !isWorkerOnline)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 ${
              iaiMode === 'live' 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-orange-600 hover:bg-orange-700 text-white'
            }`}
          >
            {isConnecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create {iaiMode === 'live' ? 'LIVE' : 'SIMULATION'} Soldier
          </button>
        </div>

        {/* Mode Toggle & Worker Status */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 mb-4 border border-gray-200">
          <div className="flex items-center justify-between">
            {/* Mode Toggle */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">IAI Mode:</span>
              <div className="flex rounded-lg overflow-hidden border border-gray-300">
                <button
                  onClick={() => setIaiMode('live')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    iaiMode === 'live'
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  🟢 LIVE
                </button>
                <button
                  onClick={() => setIaiMode('simulation')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    iaiMode === 'simulation'
                      ? 'bg-orange-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  🎭 SIMULATION
                </button>
              </div>
            </div>

            {/* Worker Status */}
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                isWorkerOnline 
                  ? 'bg-green-100 text-green-800 border border-green-200' 
                  : 'bg-red-100 text-red-800 border border-red-200'
              }`}>
                <div className={`w-2 h-2 rounded-full ${isWorkerOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-sm font-medium">
                  Python Worker: {isWorkerOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
                {isWorkerOnline && workerStatus?.workers_active !== undefined && (
                  <span className="text-xs">({workerStatus.workers_active} active)</span>
                )}
              </div>
              <button
                onClick={checkWorker}
                disabled={checkingWorker}
                className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                title="Refresh worker status"
              >
                <RefreshCw className={`w-4 h-4 ${checkingWorker ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Mode Description */}
          <div className="mt-3 text-sm text-gray-600">
            {iaiMode === 'live' ? (
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                <div>
                  <strong>LIVE Mode</strong>: Real Chromium browser via Python Worker. 
                  {isWorkerOnline 
                    ? ' Ready for real screenshots, clicks, and FB Marketplace automation.'
                    : ' ⚠️ Worker not connected - start Python Worker to use LIVE mode.'}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5" />
                <div>
                  <strong>SIMULATION Mode</strong>: No real browser. Actions are simulated, screenshots are placeholders.
                  Useful for testing UI and workflow without Python Worker.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Target URL Configuration */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Default Target URL
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            <button
              onClick={() => setTargetUrl('https://www.facebook.com/marketplace')}
              className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm"
            >
              FB Marketplace
            </button>
            <button
              onClick={() => setTargetUrl('https://www.google.com')}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
            >
              Google
            </button>
          </div>
        </div>

        {/* API Endpoint Config */}
        {showApiConfig && (
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Endpoint for Data Sending
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={apiEndpoint}
                onChange={(e) => setApiEndpoint(e.target.value)}
                placeholder="https://your-api.com/endpoint"
                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={() => setShowApiConfig(false)}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Soldiers List */}
        {soldiers.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {soldiers.map((soldier) => (
              <button
                key={soldier.id}
                onClick={() => setSelectedSoldier(soldier.id)}
                className={`px-4 py-2 rounded-lg border transition-all flex items-center gap-2 ${
                  selectedSoldier === soldier.id
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span className="font-mono text-sm">#{soldier.id.slice(0, 8)}</span>
                {getStatusBadge(soldier.status)}
              </button>
            ))}
          </div>
        )}

        {soldiers.length === 0 && (
          <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <Chrome className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-2">No active soldiers</p>
            <p className="text-gray-500 text-sm">Click "Create Soldier" to spawn a new IAI soldier with real browser control</p>
          </div>
        )}
      </div>

      {/* Active Soldier Control */}
      {activeSoldier && (
        <div className="grid grid-cols-12 gap-4">
          {/* Left Panel - Controls */}
          <div className="col-span-3 space-y-4">
            {/* Status Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-gray-900">Soldier Status</h4>
                {getStatusBadge(activeSoldier.status)}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">ID:</span>
                  <span className="font-mono text-xs">{activeSoldier.id.slice(0, 12)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Session:</span>
                  <span className="font-mono text-xs">{activeSoldier.sessionId?.slice(0, 8) || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Created:</span>
                  <span>{activeSoldier.createdAt.toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Actions:</span>
                  <span>{activeSoldier.actions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Data Items:</span>
                  <span>{activeSoldier.harvestedData.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Screenshots:</span>
                  <span>{activeSoldier.screenshots.length}</span>
                </div>
              </div>
              {activeSoldier.currentUrl && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-gray-500 mb-1">Current URL:</p>
                  <p className="text-xs font-mono bg-gray-100 p-2 rounded truncate">
                    {activeSoldier.currentUrl}
                  </p>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h4 className="font-bold text-gray-900 mb-3">Quick Actions</h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setActionType('navigate');
                    setActionTarget(targetUrl);
                    executeAction(activeSoldier.id);
                  }}
                  disabled={activeSoldier.status === 'killed' || activeSoldier.status === 'running' || !activeSoldier.sessionId}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <Navigation className="w-4 h-4" />
                  Navigate
                </button>
                {activeSoldier.status === 'paused' ? (
                  <button
                    onClick={() => resumeSoldier(activeSoldier.id)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    <Play className="w-4 h-4" />
                    Resume
                  </button>
                ) : (
                  <button
                    onClick={() => pauseSoldier(activeSoldier.id)}
                    disabled={activeSoldier.status === 'killed'}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 text-sm"
                  >
                    <Pause className="w-4 h-4" />
                    Pause
                  </button>
                )}
                <button
                  onClick={() => {
                    setActionType('screenshot');
                    executeAction(activeSoldier.id);
                  }}
                  disabled={activeSoldier.status === 'killed' || !activeSoldier.sessionId}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
                >
                  <Camera className="w-4 h-4" />
                  Screenshot
                </button>
                <button
                  onClick={() => {
                    setActionType('analyze_html');
                    executeAction(activeSoldier.id);
                  }}
                  disabled={activeSoldier.status === 'killed' || !activeSoldier.sessionId}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
                >
                  <Code className="w-4 h-4" />
                  Analyze HTML
                </button>
                <button
                  onClick={() => exportAllLogs(activeSoldier.id)}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
                >
                  <Download className="w-4 h-4" />
                  Export All
                </button>
                <button
                  onClick={() => killSoldier(activeSoldier.id)}
                  disabled={activeSoldier.status === 'killed'}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
                >
                  <Skull className="w-4 h-4" />
                  Kill
                </button>
              </div>
              {activeSoldier.status === 'killed' && (
                <button
                  onClick={() => removeSoldier(activeSoldier.id)}
                  className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </button>
              )}
            </div>

            {/* Custom Action */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h4 className="font-bold text-gray-900 mb-3">Execute Action</h4>
              <div className="space-y-3">
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as SoldierAction['type'])}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="navigate">🌐 Navigate</option>
                  <option value="click">🖱️ Click Element</option>
                  <option value="type">⌨️ Type Text</option>
                  <option value="extract">📦 Extract Data</option>
                  <option value="hover">👆 Hover Element</option>
                  <option value="select">📋 Select Option</option>
                  <option value="wait">⏳ Wait</option>
                  <option value="screenshot">📷 Screenshot</option>
                  <option value="scroll">📜 Scroll</option>
                  <option value="analyze_html">🔍 Analyze HTML</option>
                  <option value="custom">⚡ Custom Script</option>
                </select>

                {actionType !== 'wait' && actionType !== 'screenshot' && actionType !== 'analyze_html' && actionType !== 'custom' && (
                  <input
                    type="text"
                    value={actionTarget}
                    onChange={(e) => setActionTarget(e.target.value)}
                    placeholder={
                      actionType === 'navigate'
                        ? 'URL or path'
                        : 'CSS selector (e.g., #id, .class, button)'
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                )}

                {(actionType === 'type' || actionType === 'wait' || actionType === 'scroll' || actionType === 'select') && (
                  <input
                    type="text"
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    placeholder={
                      actionType === 'type'
                        ? 'Text to type'
                        : actionType === 'wait'
                        ? 'Milliseconds (e.g., 2000)'
                        : actionType === 'select'
                        ? 'Option value'
                        : 'Pixels to scroll'
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                )}

                {actionType === 'custom' && (
                  <textarea
                    value={customScript}
                    onChange={(e) => setCustomScript(e.target.value)}
                    placeholder="// Custom JavaScript to execute in page context..."
                    rows={4}
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                  />
                )}

                <button
                  onClick={() => executeAction(activeSoldier.id)}
                  disabled={activeSoldier.status === 'killed' || activeSoldier.status === 'running' || !activeSoldier.sessionId}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4" />
                  Execute
                </button>
              </div>
            </div>
          </div>

          {/* Center Panel - Logs & Data */}
          <div className="col-span-6 space-y-4">
            {/* Live Logs */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-green-400" />
                  <span className="text-white font-medium">Live Logs</span>
                  <span className="text-gray-400 text-sm">({activeSoldier.logs.length} entries)</span>
                </div>
                <div className="flex items-center gap-2">
                  {activeSoldier.status === 'running' && (
                    <span className="flex items-center gap-1 text-green-400 text-sm">
                      <Wifi className="w-3 h-3 animate-pulse" />
                      Active
                    </span>
                  )}
                </div>
              </div>
              <div className="h-[300px] overflow-y-auto p-4 font-mono text-xs">
                {activeSoldier.logs.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Waiting for activity...
                  </p>
                ) : (
                  activeSoldier.logs.map((log) => (
                    <div key={log.id} className="flex gap-2 mb-1 hover:bg-gray-800 px-2 py-1 rounded">
                      <span className="text-gray-600 shrink-0">
                        [{formatTimestamp(log.timestamp)}]
                      </span>
                      <span className={`shrink-0 ${getLogColor(log.level)}`}>
                        [{log.level.toUpperCase()}]
                      </span>
                      <span className="text-gray-300">{log.message}</span>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>

            {/* Harvested Data */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-green-600" />
                  <span className="font-medium">Harvested Data</span>
                  <span className="text-gray-500 text-sm">({activeSoldier.harvestedData.length} items)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={dataFilter}
                    onChange={(e) => setDataFilter(e.target.value)}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="all">All Types</option>
                    <option value="text">Text</option>
                    <option value="html">HTML</option>
                    <option value="link">Links</option>
                    <option value="image_url">Images</option>
                    <option value="json">JSON</option>
                  </select>
                  <button
                    onClick={() => setShowApiConfig(!showApiConfig)}
                    className="p-1 hover:bg-gray-200 rounded"
                    title="Configure API Endpoint"
                  >
                    <Settings className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
              <div className="p-4 max-h-[400px] overflow-y-auto">
                {filteredData.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No data harvested yet. Use "Extract Data" action to capture content.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredData.map((data) => (
                      <HarvestedDataCard
                        key={data.id}
                        data={data}
                        onAction={handleDataAction}
                        screenshots={activeSoldier.screenshots}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Screenshots & HTML Analysis */}
          <div className="col-span-3 space-y-4">
            {/* Screenshots */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b flex items-center gap-2">
                <Image className="w-4 h-4 text-indigo-600" />
                <span className="font-medium">Screenshots</span>
                <span className="text-gray-500 text-sm">({activeSoldier.screenshots.length})</span>
              </div>
              <div className="p-3 max-h-[300px] overflow-y-auto">
                {activeSoldier.screenshots.length === 0 ? (
                  <p className="text-gray-500 text-center py-4 text-sm">
                    No screenshots yet
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {activeSoldier.screenshots.map((screenshot) => (
                      <button
                        key={screenshot.id}
                        onClick={() => setSelectedScreenshot(screenshot)}
                        className="relative group overflow-hidden rounded border hover:border-indigo-500"
                      >
                        <img
                          src={screenshot.dataUrl}
                          alt="Screenshot"
                          className="w-full h-20 object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Eye className="w-5 h-5 text-white" />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 truncate">
                          {formatTimestamp(screenshot.timestamp)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* HTML Analysis */}
            {latestHtmlSnapshot?.analysis && (
              <HTMLAnalysisPanel analysis={latestHtmlSnapshot.analysis} />
            )}

            {/* Action History */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b flex items-center gap-2">
                <History className="w-4 h-4 text-gray-600" />
                <span className="font-medium">Action History</span>
              </div>
              <div className="p-3 max-h-[200px] overflow-y-auto">
                {activeSoldier.actions.length === 0 ? (
                  <p className="text-gray-500 text-center py-4 text-sm">
                    No actions yet
                  </p>
                ) : (
                  <div className="space-y-1">
                    {activeSoldier.actions.slice().reverse().map((action) => (
                      <div
                        key={action.id}
                        className="flex items-center gap-2 text-sm p-2 hover:bg-gray-50 rounded"
                      >
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            action.status === 'completed'
                              ? 'bg-green-500'
                              : action.status === 'failed'
                              ? 'bg-red-500'
                              : action.status === 'running'
                              ? 'bg-blue-500 animate-pulse'
                              : 'bg-gray-300'
                          }`}
                        />
                        <span className="text-gray-700 font-medium">{action.type}</span>
                        {action.target && (
                          <span className="text-gray-500 truncate text-xs flex-1">
                            → {action.target}
                          </span>
                        )}
                        {action.duration && (
                          <span className="text-gray-400 text-xs">
                            {formatDuration(action.duration)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instructions when no soldier selected */}
      {!selectedSoldier && soldiers.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
          <Eye className="w-8 h-8 text-blue-500 mx-auto mb-2" />
          <p className="text-blue-800 font-medium">Select a soldier above to control it</p>
          <p className="text-blue-600 text-sm mt-1">
            Click on any soldier card to access controls, logs, and harvested data
          </p>
        </div>
      )}

      {/* Screenshot Viewer Modal */}
      {selectedScreenshot && (
        <ScreenshotViewer
          screenshot={selectedScreenshot}
          onClose={() => setSelectedScreenshot(null)}
        />
      )}
    </div>
  );
}
