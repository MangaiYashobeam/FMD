/**
 * Nova Chromium Service - Node.js Interface to Python Browser Workers
 * ===================================================================
 * 
 * This service provides the Node.js API with full control over Chromium browsers
 * running on the Python worker server. It acts as the bridge between:
 * 
 *   Frontend/API → Node.js → This Service → Python Worker → Chromium → Facebook
 * 
 * Key Features:
 * - Create and manage browser sessions
 * - Execute actions (click, type, navigate, etc.)
 * - Capture screenshots for AI vision analysis
 * - Track IAI soldiers and their browser assignments
 * - Handle session persistence and recovery
 * 
 * @version 1.0.0
 */

import { logger } from '@/utils/logger';
import prisma from '@/config/database';

// Configuration
const WORKER_API_URL = process.env.WORKER_API_URL || 'http://worker-api:8000';
const WORKER_SECRET = process.env.WORKER_SECRET || process.env.ENCRYPTION_KEY || '';

// Type definitions
export interface BrowserSession {
  sessionId: string;
  browserId: string;
  accountId: string;
  status: 'ready' | 'busy' | 'error' | 'closed';
  hasSavedSession: boolean;
  currentUrl?: string;
  pageTitle?: string;
  createdAt: Date;
  lastActivity: Date;
}

export interface BrowserAction {
  action: string;
  selector?: string;
  url?: string;
  value?: string;
  options?: Record<string, any>;
}

export interface ActionResult {
  success: boolean;
  action: string;
  data: Record<string, any>;
  error?: string;
  durationMs: number;
  screenshot?: string;
  timestamp: string;
}

export interface AgentGoalRequest {
  goal: string;
  context?: Record<string, any>;
  maxSteps?: number;
}

export interface AgentExecution {
  goal: string;
  success: boolean;
  steps: Array<{
    stepNumber: number;
    thought: string;
    action?: string;
    result?: Record<string, any>;
    error?: string;
  }>;
  totalDurationMs: number;
  finalState: string;
  error?: string;
}

// Active sessions cache
const activeSessions = new Map<string, BrowserSession>();

/**
 * Call the Python Worker API
 */
async function callWorkerApi<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
  body?: any
): Promise<T> {
  const url = `${WORKER_API_URL}${endpoint}`;
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': WORKER_SECRET,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Worker API error: ${response.status} - ${error}`);
  }
  
  return response.json() as Promise<T>;
}

/**
 * Nova Chromium Service
 * 
 * Provides full browser control capabilities for IAI instances.
 */
class NovaChromiumService {
  private isInitialized = false;
  
  /**
   * Initialize the service and check worker connectivity
   */
  async initialize(): Promise<boolean> {
    try {
      const health = await callWorkerApi<{ status: string; workers_active: number }>('/health');
      this.isInitialized = health.status === 'healthy';
      
      logger.info('🧠 Nova Chromium Service initialized', {
        workerApiUrl: WORKER_API_URL,
        workerStatus: health.status,
        workersActive: health.workers_active
      });
      
      return this.isInitialized;
    } catch (error) {
      logger.warn('Nova Chromium Service initialization failed - worker may be offline', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }
  
  /**
   * Create a new browser session for an IAI instance
   */
  async createSession(accountId: string, options?: {
    headless?: boolean;
    loadSession?: boolean;
    viewport?: { width: number; height: number };
  }): Promise<BrowserSession> {
    logger.info('Creating Nova browser session', { accountId });
    
    const response = await callWorkerApi<{
      success: boolean;
      session_id: string;
      browser_id: string;
      account_id: string;
      status: string;
      has_saved_session: boolean;
      message: string;
    }>('/api/browser/create', 'POST', {
      account_id: accountId,
      headless: options?.headless ?? true,
      load_session: options?.loadSession ?? true,
      viewport: options?.viewport ?? { width: 1920, height: 1080 },
    });
    
    const session: BrowserSession = {
      sessionId: response.session_id,
      browserId: response.browser_id,
      accountId: response.account_id,
      status: response.status as any,
      hasSavedSession: response.has_saved_session,
      createdAt: new Date(),
      lastActivity: new Date(),
    };
    
    // Cache the session
    activeSessions.set(session.sessionId, session);
    
    // Update IAI soldier record if exists
    await this.updateIAISoldierSession(accountId, session.sessionId);
    
    logger.info('Nova browser session created', {
      sessionId: session.sessionId,
      hasSavedSession: session.hasSavedSession
    });
    
    return session;
  }
  
  /**
   * Execute an action in the browser
   */
  async executeAction(sessionId: string, action: BrowserAction): Promise<ActionResult> {
    logger.debug('Executing browser action', { sessionId, action: action.action });
    
    const response = await callWorkerApi<{
      success: boolean;
      action: string;
      data: Record<string, any>;
      error?: string;
      duration_ms: number;
      screenshot?: string;
      timestamp: string;
    }>(`/api/browser/${sessionId}/action`, 'POST', {
      action: action.action,
      selector: action.selector,
      url: action.url,
      value: action.value,
      options: action.options || {},
    });
    
    // Update session activity
    const session = activeSessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
      if (response.data?.url) {
        session.currentUrl = response.data.url;
      }
    }
    
    return {
      success: response.success,
      action: response.action,
      data: response.data,
      error: response.error,
      durationMs: response.duration_ms,
      screenshot: response.screenshot,
      timestamp: response.timestamp,
    };
  }
  
  /**
   * Get current browser state
   */
  async getSessionState(sessionId: string): Promise<{
    currentUrl: string;
    pageTitle: string;
    isHealthy: boolean;
    recentActions: Array<{ action: string; success: boolean }>;
  }> {
    const response = await callWorkerApi<{
      session_id: string;
      browser_id: string;
      account_id: string;
      current_url: string;
      page_title: string;
      is_healthy: boolean;
      task_count: number;
      recent_actions: Array<{ action: string; success: boolean }>;
    }>(`/api/browser/${sessionId}/state`);
    
    return {
      currentUrl: response.current_url,
      pageTitle: response.page_title,
      isHealthy: response.is_healthy,
      recentActions: response.recent_actions,
    };
  }
  
  /**
   * Capture a screenshot
   */
  async captureScreenshot(sessionId: string, fullPage = false): Promise<{
    screenshot: string;
    url: string;
    title: string;
  }> {
    const response = await callWorkerApi<{
      success: boolean;
      screenshot: string;
      url: string;
      title: string;
    }>(`/api/browser/${sessionId}/screenshot?full_page=${fullPage}`);
    
    return {
      screenshot: response.screenshot,
      url: response.url,
      title: response.title,
    };
  }
  
  /**
   * Get page HTML for analysis
   */
  async getPageHtml(sessionId: string, selector = 'body'): Promise<{
    html: string;
    length: number;
  }> {
    const response = await callWorkerApi<{
      success: boolean;
      html: string;
      length: number;
      selector: string;
    }>(`/api/browser/${sessionId}/html?selector=${encodeURIComponent(selector)}`);
    
    return {
      html: response.html,
      length: response.length,
    };
  }
  
  /**
   * Execute a batch of actions in sequence
   */
  async executeBatch(sessionId: string, actions: BrowserAction[], stopOnError = true): Promise<{
    success: boolean;
    completedCount: number;
    results: ActionResult[];
  }> {
    const response = await callWorkerApi<{
      success: boolean;
      total_actions: number;
      completed: number;
      success_count: number;
      results: Array<{
        success: boolean;
        action: string;
        data: Record<string, any>;
        error?: string;
        duration_ms: number;
      }>;
    }>(`/api/browser/${sessionId}/batch`, 'POST', {
      actions: actions.map(a => ({
        action: a.action,
        selector: a.selector,
        url: a.url,
        value: a.value,
        options: a.options || {},
      })),
      stop_on_error: stopOnError,
    });
    
    return {
      success: response.success,
      completedCount: response.completed,
      results: response.results.map(r => ({
        success: r.success,
        action: r.action,
        data: r.data,
        error: r.error,
        durationMs: r.duration_ms,
        timestamp: new Date().toISOString(),
      })),
    };
  }
  
  /**
   * Close a browser session
   */
  async closeSession(sessionId: string): Promise<boolean> {
    logger.info('Closing Nova browser session', { sessionId });
    
    try {
      await callWorkerApi<{ success: boolean; session_saved: boolean }>(
        `/api/browser/${sessionId}`,
        'DELETE'
      );
      
      activeSessions.delete(sessionId);
      return true;
    } catch (error) {
      logger.error('Failed to close browser session', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }
  
  /**
   * List all active browser sessions
   */
  async listSessions(): Promise<BrowserSession[]> {
    const response = await callWorkerApi<{
      total_sessions: number;
      max_sessions: number;
      sessions: Array<{
        session_id: string;
        browser_id: string;
        account_id: string;
        is_busy: boolean;
        is_healthy: boolean;
        task_count: number;
      }>;
    }>('/api/browser/sessions');
    
    return response.sessions.map(s => ({
      sessionId: s.session_id,
      browserId: s.browser_id,
      accountId: s.account_id,
      status: s.is_busy ? 'busy' : 'ready',
      hasSavedSession: false, // Not returned by list endpoint
      createdAt: new Date(),
      lastActivity: new Date(),
    }));
  }
  
  /**
   * Get available browser control tools
   */
  async getAvailableTools(): Promise<{
    name: string;
    description: string;
    tools: Array<{
      name: string;
      description: string;
      parameters: Record<string, any>;
    }>;
  }> {
    return callWorkerApi('/api/browser/tools');
  }
  
  /**
   * Execute a natural language goal using Nova AI agent
   * This is the core method for fluent communication with soldiers
   */
  async executeGoal(
    sessionId: string,
    goal: string,
    context?: Record<string, any>,
    maxSteps?: number
  ): Promise<AgentExecution> {
    logger.info('Executing Nova agent goal', { sessionId, goal: goal.substring(0, 100) });
    
    const response = await callWorkerApi<{
      success: boolean;
      goal: string;
      steps_taken: number;
      final_state: string;
      history: Array<{
        step: number;
        thought: string;
        action?: string;
        result?: Record<string, any>;
        error?: string;
      }>;
      total_duration_ms: number;
      error?: string;
    }>(`/api/browser/${sessionId}/execute-goal`, 'POST', {
      goal,
      context: context || {},
      max_steps: maxSteps || 20,
    });
    
    return {
      goal: response.goal,
      success: response.success,
      steps: response.history.map(h => ({
        stepNumber: h.step,
        thought: h.thought,
        action: h.action,
        result: h.result,
        error: h.error,
      })),
      totalDurationMs: response.total_duration_ms,
      finalState: response.final_state,
      error: response.error,
    };
  }
  
  // ========== High-Level Task Methods ==========
  
  /**
   * Send a Facebook message using Nova agent
   */
  async sendFacebookMessage(
    sessionId: string,
    conversationUrl: string,
    message: string
  ): Promise<ActionResult> {
    // Navigate to conversation
    await this.executeAction(sessionId, {
      action: 'navigate',
      url: conversationUrl,
    });
    
    // Wait for messenger to load
    await this.executeAction(sessionId, {
      action: 'wait_for',
      selector: 'div[aria-label="Message"]',
    });
    
    // Send the message
    return this.executeAction(sessionId, {
      action: 'fb_send_message',
      value: message,
    });
  }
  
  /**
   * Create a Facebook Marketplace listing using Nova agent
   */
  async createMarketplaceListing(
    sessionId: string,
    listingData: {
      year: number;
      make: string;
      model: string;
      price: number;
      mileage?: number;
      description?: string;
      location: string;
      photos?: string[];
    }
  ): Promise<ActionResult> {
    // Navigate to create listing page
    await this.executeAction(sessionId, {
      action: 'navigate',
      url: 'https://www.facebook.com/marketplace/create/vehicle',
    });
    
    // Wait for form to load
    await this.executeAction(sessionId, {
      action: 'wait_for',
      options: { state: 'networkidle' },
    });
    
    // Start listing creation
    return this.executeAction(sessionId, {
      action: 'fb_create_listing',
      options: { listing: listingData },
    });
  }
  
  // ========== IAI Integration ==========
  
  /**
   * Update IAI Soldier record with browser session
   */
  private async updateIAISoldierSession(accountId: string, sessionId: string): Promise<void> {
    try {
      await prisma.iAISoldier.updateMany({
        where: { accountId },
        data: {
          currentTaskId: sessionId,
          status: 'ONLINE',
          lastHeartbeatAt: new Date(),
        },
      });
    } catch (error) {
      // Soldier might not exist yet, that's okay
      logger.debug('Could not update IAI Soldier record', { accountId });
    }
  }
  
  /**
   * Get or create browser session for an IAI soldier
   */
  async getOrCreateSessionForIAI(soldierId: string): Promise<BrowserSession | null> {
    // Find the soldier
    const soldier = await prisma.iAISoldier.findFirst({
      where: { soldierId },
    });
    
    if (!soldier) {
      logger.warn('IAI Soldier not found', { soldierId });
      return null;
    }
    
    // Check if we have an active session
    const existingSessions = await this.listSessions();
    const existingSession = existingSessions.find(s => s.accountId === soldier.accountId);
    
    if (existingSession) {
      return existingSession;
    }
    
    // Create new session
    return this.createSession(soldier.accountId);
  }
  
  /**
   * Check if worker API is available
   */
  async isWorkerAvailable(): Promise<boolean> {
    try {
      const health = await callWorkerApi<{ status: string }>('/health');
      return health.status === 'healthy';
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const novaChromiumService = new NovaChromiumService();

// Export class for testing
export { NovaChromiumService };
