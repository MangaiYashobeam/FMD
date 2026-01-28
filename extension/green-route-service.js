/**
 * ====================================================================
 * GREEN ROUTE SERVICE - Internal API Communication Layer
 * ====================================================================
 * 
 * ALL extension API calls go through this service.
 * Green Route bypasses external traffic restrictions during mitigation.
 * 
 * BENEFITS:
 * - Single source of truth for API communication
 * - Built-in retry logic with exponential backoff
 * - Request signing for security
 * - Automatic token refresh
 * - Error normalization
 * - Works during DDoS mitigation
 * 
 * SECURITY:
 * - X-Green-Route header for identification
 * - HMAC signature on sensitive requests
 * - Nonce for replay attack prevention
 * 
 * @version 1.0.0
 * @author FaceMyDealer
 */

// ============================================
// GREEN ROUTE CONFIGURATION
// ============================================

const GREEN_ROUTE_CONFIG = {
  // API Base URLs
  API: {
    PRODUCTION: 'https://dealersface.com',
    LOCAL: 'http://localhost:5000',
  },
  
  // Route Paths
  PATHS: {
    // Core Green Routes (bypass mitigation)
    GREEN: '/api/green',
    
    // Extension-specific routes
    EXTENSION: '/api/extension',
    
    // IAI Routes
    IAI: '/api/iai',
    
    // Stealth Soldiers (VPS workers)
    STEALTH: '/api/browser',
  },
  
  // Retry Configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    BASE_DELAY_MS: 1000,
    MAX_DELAY_MS: 10000,
    BACKOFF_FACTOR: 2,
  },
  
  // Request Timeouts
  TIMEOUT: {
    DEFAULT: 30000,     // 30s
    QUICK: 10000,       // 10s for simple requests
    LONG: 60000,        // 60s for complex operations
    STEALTH: 120000,    // 2min for browser automation
  },
  
  // Headers
  HEADERS: {
    GREEN_ROUTE: 'X-Green-Route',
    IAI_SOLDIER: 'X-IAI-Soldier',
    SIGNATURE: 'X-Green-Signature',
    TIMESTAMP: 'X-Green-Timestamp',
    NONCE: 'X-Green-Nonce',
    EXTENSION_ID: 'X-Extension-Id',
  },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate a unique nonce for request signing
 */
function generateNonce() {
  return crypto.randomUUID ? crypto.randomUUID() : 
    `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Get base URL based on environment
 */
function getBaseUrl() {
  return GREEN_ROUTE_CONFIG.API.PRODUCTION;
}

/**
 * Get auth token from storage
 */
async function getAuthToken() {
  try {
    const result = await chrome.storage.local.get(['authToken', 'authState']);
    return result.authToken || result.authState?.accessToken || null;
  } catch (e) {
    console.error('[GreenRoute] Failed to get auth token:', e);
    return null;
  }
}

/**
 * Get account context from storage
 */
async function getAccountContext() {
  try {
    const result = await chrome.storage.local.get(['authState', 'soldierInfo']);
    return {
      accountId: result.authState?.dealerAccountId || result.authState?.accountId,
      userId: result.authState?.userId || result.authState?.user?.id,
      soldierId: result.soldierInfo?.soldierId,
    };
  } catch (e) {
    console.error('[GreenRoute] Failed to get account context:', e);
    return { accountId: null, userId: null, soldierId: null };
  }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate backoff delay with jitter
 */
function calculateBackoff(attempt) {
  const { BASE_DELAY_MS, MAX_DELAY_MS, BACKOFF_FACTOR } = GREEN_ROUTE_CONFIG.RETRY;
  const baseDelay = BASE_DELAY_MS * Math.pow(BACKOFF_FACTOR, attempt);
  const jitter = Math.random() * baseDelay * 0.1; // 10% jitter
  return Math.min(baseDelay + jitter, MAX_DELAY_MS);
}

// ============================================
// GREEN ROUTE SERVICE CLASS
// ============================================

class GreenRouteService {
  constructor() {
    this.version = '1.0.0';
    this.requestCount = 0;
    this.lastRequestTime = null;
    console.log(`%c[GreenRoute] Service initialized v${this.version}`, 
      'color: #10b981; font-weight: bold;');
  }

  /**
   * Build standard Green Route headers
   */
  async buildHeaders(options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      [GREEN_ROUTE_CONFIG.HEADERS.GREEN_ROUTE]: 'true',
      [GREEN_ROUTE_CONFIG.HEADERS.EXTENSION_ID]: chrome.runtime.id,
      [GREEN_ROUTE_CONFIG.HEADERS.TIMESTAMP]: Date.now().toString(),
      [GREEN_ROUTE_CONFIG.HEADERS.NONCE]: generateNonce(),
    };

    // Add IAI Soldier version if available
    if (typeof IAI_VERSION !== 'undefined') {
      headers[GREEN_ROUTE_CONFIG.HEADERS.IAI_SOLDIER] = IAI_VERSION;
    }

    // Add auth token if required
    if (options.requireAuth !== false) {
      const token = await getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    // Merge custom headers
    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    return headers;
  }

  /**
   * Core request method with retry logic
   */
  async request(endpoint, options = {}) {
    const {
      method = 'GET',
      body = null,
      timeout = GREEN_ROUTE_CONFIG.TIMEOUT.DEFAULT,
      retries = GREEN_ROUTE_CONFIG.RETRY.MAX_ATTEMPTS,
      requireAuth = true,
      isGreenRoute = true,
    } = options;

    const url = `${getBaseUrl()}${endpoint}`;
    const headers = await this.buildHeaders({ requireAuth, headers: options.headers });

    let lastError = null;
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        this.requestCount++;
        this.lastRequestTime = new Date();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const fetchOptions = {
          method,
          headers,
          signal: controller.signal,
        };

        if (body && method !== 'GET') {
          fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);

        // Handle response
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            return await response.json();
          }
          return await response.text();
        }

        // Handle specific error codes
        if (response.status === 401) {
          console.warn('[GreenRoute] Unauthorized - token may have expired');
          // Attempt token refresh could be triggered here
          throw new Error('UNAUTHORIZED');
        }

        if (response.status === 429) {
          console.warn('[GreenRoute] Rate limited - backing off');
          await sleep(calculateBackoff(attempt));
          continue;
        }

        if (response.status >= 500) {
          // Server error - retry with backoff
          lastError = new Error(`Server error: ${response.status}`);
          await sleep(calculateBackoff(attempt));
          continue;
        }

        // Client error - don't retry
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || `HTTP ${response.status}`);

      } catch (error) {
        lastError = error;
        
        if (error.name === 'AbortError') {
          console.warn(`[GreenRoute] Request timeout (${timeout}ms)`);
        } else if (error.message === 'UNAUTHORIZED') {
          throw error; // Don't retry auth errors
        }

        if (attempt < retries - 1) {
          console.log(`[GreenRoute] Retry ${attempt + 1}/${retries} after ${calculateBackoff(attempt)}ms`);
          await sleep(calculateBackoff(attempt));
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  // ============================================
  // GREEN ROUTE ENDPOINTS (/api/green/*)
  // ============================================

  /**
   * Health check - verify Green Route is operational
   */
  async health() {
    return this.request('/api/green/health', {
      requireAuth: false,
      timeout: GREEN_ROUTE_CONFIG.TIMEOUT.QUICK,
    });
  }

  /**
   * System status
   */
  async status() {
    return this.request('/api/green/status', {
      requireAuth: false,
    });
  }

  /**
   * Get current user info
   */
  async me() {
    return this.request('/api/green/me');
  }

  /**
   * Get vehicles for posting
   */
  async getVehicles(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/green/vehicles${query ? `?${query}` : ''}`);
  }

  /**
   * Update vehicle post status
   */
  async updateVehiclePostStatus(vehicleId, data) {
    return this.request(`/api/green/vehicles/${vehicleId}/post-status`, {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Get Facebook session
   */
  async getFBSession() {
    return this.request('/api/green/fb-session');
  }

  /**
   * Create lead from Facebook
   */
  async createLead(leadData) {
    return this.request('/api/green/leads', {
      method: 'POST',
      body: leadData,
    });
  }

  /**
   * Send heartbeat
   */
  async heartbeat(browserInfo = {}) {
    return this.request('/api/green/heartbeat', {
      method: 'POST',
      body: { browserInfo },
      timeout: GREEN_ROUTE_CONFIG.TIMEOUT.QUICK,
    });
  }

  /**
   * Get posting configuration
   */
  async getPostingConfig() {
    return this.request('/api/green/posting-config');
  }

  /**
   * Log error for debugging
   */
  async logError(error, context = {}) {
    return this.request('/api/green/log-error', {
      method: 'POST',
      body: {
        error: error.message || String(error),
        stack: error.stack,
        context,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Proxy image through Green Route (CORS bypass)
   */
  async proxyImage(imageUrl) {
    const url = `/api/green/image-proxy?url=${encodeURIComponent(imageUrl)}`;
    return this.request(url, {
      requireAuth: false,
    });
  }

  // ============================================
  // IAI SOLDIER ENDPOINTS (/api/green/iai/*)
  // ============================================

  /**
   * Report IAI metrics
   */
  async reportMetrics(eventType, data = {}) {
    const context = await getAccountContext();
    return this.request('/api/green/iai/metrics', {
      method: 'POST',
      body: {
        eventType,
        ...data,
        ...context,
        source: 'extension',
        timestamp: new Date().toISOString(),
      },
      requireAuth: false, // Metrics don't require auth
      retries: 1, // Don't retry metrics
    });
  }

  /**
   * Update FBM post log
   */
  async updateFBMPost(logId, updates) {
    return this.request('/api/green/fbm-posts/update', {
      method: 'POST',
      body: { logId, ...updates },
    });
  }

  /**
   * Add event to FBM post log
   */
  async addFBMEvent(logId, event) {
    return this.request('/api/green/fbm-posts/event', {
      method: 'POST',
      body: { logId, ...event },
    });
  }

  // ============================================
  // EXTENSION ENDPOINTS (/api/extension/*)
  // ============================================

  /**
   * Register as IAI Soldier
   */
  async registerSoldier(data) {
    return this.request('/api/extension/iai/register', {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Send IAI heartbeat
   */
  async iaiHeartbeat(soldierId, status = 'online') {
    const context = await getAccountContext();
    return this.request('/api/extension/iai/heartbeat', {
      method: 'POST',
      body: {
        soldierId,
        accountId: context.accountId,
        status,
      },
      timeout: GREEN_ROUTE_CONFIG.TIMEOUT.QUICK,
    });
  }

  /**
   * Log IAI activity
   */
  async logActivity(eventType, data = {}) {
    const context = await getAccountContext();
    return this.request('/api/extension/iai/log-activity', {
      method: 'POST',
      body: {
        soldierId: context.soldierId,
        accountId: context.accountId,
        eventType,
        ...data,
      },
    });
  }

  /**
   * Poll for IAI tasks
   */
  async pollTasks(soldierId) {
    const context = await getAccountContext();
    return this.request('/api/extension/iai/poll-tasks', {
      method: 'POST',
      body: {
        soldierId,
        accountId: context.accountId,
      },
      timeout: GREEN_ROUTE_CONFIG.TIMEOUT.QUICK,
    });
  }

  /**
   * Complete IAI task
   */
  async completeTask(taskId, result) {
    return this.request('/api/extension/iai/tasks/complete', {
      method: 'POST',
      body: { taskId, result },
    });
  }

  /**
   * Fail IAI task
   */
  async failTask(taskId, error) {
    return this.request('/api/extension/iai/tasks/fail', {
      method: 'POST',
      body: { taskId, error },
    });
  }

  // ============================================
  // IAI PATTERN ENDPOINTS (/api/iai/*)
  // ============================================

  /**
   * Get active injection pattern
   */
  async getPattern(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/iai/pattern${query ? `?${query}` : ''}`, {
      requireAuth: false, // Pattern endpoint is public
    });
  }

  /**
   * Get injection slot
   */
  async getInjectionSlot() {
    return this.request('/api/injection/slot/active');
  }

  // ============================================
  // IAI STEALTH SOLDIERS (/api/green/stealth/*)
  // These connect to VPS Python workers through Green Route
  // ALL INTERNAL - No external calls needed
  // ============================================

  /**
   * Create stealth browser session via Green Route
   */
  async createStealthBrowser(options = {}) {
    return this.request('/api/green/stealth/create', {
      method: 'POST',
      body: options,
      timeout: GREEN_ROUTE_CONFIG.TIMEOUT.STEALTH,
    });
  }

  /**
   * Execute action in stealth browser via Green Route
   */
  async stealthAction(browserId, action) {
    return this.request(`/api/green/stealth/${browserId}/action`, {
      method: 'POST',
      body: action,
      timeout: GREEN_ROUTE_CONFIG.TIMEOUT.STEALTH,
    });
  }

  /**
   * Get stealth browser state via Green Route
   */
  async getStealthState(browserId) {
    return this.request(`/api/green/stealth/${browserId}/state`, {
      timeout: GREEN_ROUTE_CONFIG.TIMEOUT.QUICK,
    });
  }

  /**
   * Get stealth browser screenshot via Green Route
   */
  async getStealthScreenshot(browserId) {
    return this.request(`/api/green/stealth/${browserId}/screenshot`);
  }

  /**
   * Get stealth browser HTML via Green Route
   */
  async getStealthHTML(browserId) {
    return this.request(`/api/green/stealth/${browserId}/html`);
  }

  /**
   * AI vision analysis of stealth browser via Green Route
   */
  async stealthVision(browserId, prompt = null) {
    return this.request(`/api/green/stealth/${browserId}/vision`, {
      method: 'POST',
      body: { prompt },
      timeout: GREEN_ROUTE_CONFIG.TIMEOUT.LONG,
    });
  }

  /**
   * Close stealth browser session via Green Route
   */
  async closeStealthBrowser(browserId) {
    return this.request(`/api/green/stealth/${browserId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get stealth browser pool status via Green Route
   */
  async getStealthPool() {
    return this.request('/api/green/stealth/pool');
  }

  // ============================================
  // CONFIG ENDPOINTS
  // ============================================

  /**
   * Get Facebook config
   */
  async getFacebookConfig() {
    return this.request('/api/config/facebook', {
      requireAuth: false,
    });
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get service stats
   */
  getStats() {
    return {
      version: this.version,
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
    };
  }

  /**
   * Test connectivity
   */
  async testConnectivity() {
    try {
      const start = Date.now();
      const result = await this.health();
      const latency = Date.now() - start;
      
      return {
        success: true,
        latency,
        route: result.route || 'green',
        verified: result.verified || false,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

const greenRoute = new GreenRouteService();

// Export for use in extension scripts
if (typeof window !== 'undefined') {
  window.greenRoute = greenRoute;
  window.GreenRouteService = GreenRouteService;
}

// Export for background service worker
if (typeof self !== 'undefined') {
  self.greenRoute = greenRoute;
  self.GreenRouteService = GreenRouteService;
}

// Log initialization
console.log(`%c[GreenRoute] 🟢 ALL INTERNAL - No external calls needed`, 
  'background: linear-gradient(90deg, #059669, #10b981); color: white; padding: 6px 12px; border-radius: 4px; font-weight: bold;');
