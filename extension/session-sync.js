/**
 * Session Sync Module
 * ===================
 * 
 * Handles Facebook session capture and sync to server.
 * REPLACES OAuth flow with direct cookie capture.
 * 
 * Features:
 * - Capture Facebook cookies from browser
 * - Encrypt and sync to server
 * - Auto-sync on cookie changes
 * - Session validation
 * - 2FA setup support
 */

// ============================================
// Session Sync Configuration
// ============================================

const SESSION_CONFIG = {
  // Required Facebook cookies for valid session
  REQUIRED_COOKIES: ['c_user', 'xs', 'datr'],
  
  // Auto-sync interval (4 hours)
  AUTO_SYNC_INTERVAL_MS: 4 * 60 * 60 * 1000,
  
  // Debounce for cookie changes (5 seconds)
  SYNC_DEBOUNCE_MS: 5000,
  
  // Session status check interval (30 minutes)
  SESSION_CHECK_INTERVAL_MS: 30 * 60 * 1000,
};

// State
let syncTimeout = null;
let autoSyncInterval = null;
let sessionCheckInterval = null;
let currentSessionInfo = null;

// ============================================
// Cookie Capture Functions
// ============================================

/**
 * Capture all Facebook cookies
 * @returns {Promise<Array>} Array of cookie objects
 */
async function captureFacebookCookies() {
  try {
    const cookies = await chrome.cookies.getAll({ domain: '.facebook.com' });
    
    // Also get www.facebook.com cookies
    const wwwCookies = await chrome.cookies.getAll({ domain: 'www.facebook.com' });
    
    // Merge and deduplicate
    const allCookies = [...cookies];
    for (const cookie of wwwCookies) {
      if (!allCookies.some(c => c.name === cookie.name && c.domain === cookie.domain)) {
        allCookies.push(cookie);
      }
    }
    
    // Transform to storage format
    return allCookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.expirationDate,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite
    }));
  } catch (error) {
    console.error('Failed to capture Facebook cookies:', error);
    throw error;
  }
}

/**
 * Validate captured cookies have required session data
 * @param {Array} cookies 
 * @returns {Object} { isValid, reason, fbUserId, expiresAt }
 */
function validateCapturedCookies(cookies) {
  const fbCookies = cookies.filter(c => 
    c.domain?.includes('facebook.com')
  );
  
  if (fbCookies.length === 0) {
    return { isValid: false, reason: 'No Facebook cookies found' };
  }
  
  // Check required cookies
  const missing = SESSION_CONFIG.REQUIRED_COOKIES.filter(name =>
    !fbCookies.some(c => c.name === name)
  );
  
  if (missing.length > 0) {
    return { 
      isValid: false, 
      reason: `Missing required cookies: ${missing.join(', ')}. Please log in to Facebook.`
    };
  }
  
  // Extract user ID
  const cUser = fbCookies.find(c => c.name === 'c_user');
  const fbUserId = cUser?.value;
  
  // Find earliest expiry
  const expiries = fbCookies
    .filter(c => c.expires)
    .map(c => c.expires);
  const expiresAt = expiries.length > 0 
    ? new Date(Math.min(...expiries) * 1000)
    : null;
  
  return {
    isValid: true,
    fbUserId,
    expiresAt,
    cookieCount: fbCookies.length
  };
}

/**
 * Check if user is logged into Facebook
 * @returns {Promise<boolean>}
 */
async function isLoggedIntoFacebook() {
  const cookies = await captureFacebookCookies();
  const validation = validateCapturedCookies(cookies);
  return validation.isValid;
}

// ============================================
// Session Sync Functions
// ============================================

/**
 * Capture and send session to server
 * @returns {Promise<Object>} Server response
 */
async function captureAndSyncSession() {
  try {
    console.log('🔄 Starting session capture...');
    
    // Get auth token
    const { authToken, authState } = await chrome.storage.local.get(['authToken', 'authState']);
    const token = authToken || authState?.accessToken;
    
    if (!token) {
      throw new Error('Not authenticated. Please log in to DealersFace first.');
    }
    
    // Capture cookies
    const cookies = await captureFacebookCookies();
    
    // Validate
    const validation = validateCapturedCookies(cookies);
    if (!validation.isValid) {
      throw new Error(validation.reason);
    }
    
    // Get browser info
    const userAgent = navigator.userAgent;
    const browserFingerprint = await generateBrowserFingerprint();
    
    // Send to server
    const response = await fetch(`${CONFIG.API_URL}/fb-session/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Browser-ID': browserFingerprint
      },
      body: JSON.stringify({
        cookies,
        userAgent,
        browserFingerprint
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Session capture failed');
    }
    
    const result = await response.json();
    
    // Update local state
    currentSessionInfo = {
      sessionId: result.sessionId,
      fbUserId: result.fbUserId,
      expiresAt: result.expiresAt,
      status: result.status,
      capturedAt: new Date().toISOString()
    };
    
    // Save to storage
    await chrome.storage.local.set({ 
      fbSessionInfo: currentSessionInfo,
      fbSessionCapturedAt: Date.now()
    });
    
    console.log('✅ Session captured successfully:', {
      sessionId: result.sessionId,
      fbUserId: result.fbUserId
    });
    
    return result;
  } catch (error) {
    console.error('❌ Session capture failed:', error);
    throw error;
  }
}

/**
 * Sync session to server (for scheduled syncs)
 * @returns {Promise<Object>}
 */
async function syncSessionToServer() {
  try {
    console.log('🔄 Syncing session to server...');
    
    const { authToken, authState, accountId } = await chrome.storage.local.get([
      'authToken', 'authState', 'accountId'
    ]);
    
    const token = authToken || authState?.accessToken;
    const targetAccountId = accountId || authState?.dealerAccountId || authState?.accountId;
    
    if (!token || !targetAccountId) {
      console.log('⏭️ Skipping sync - not authenticated');
      return null;
    }
    
    // Capture current cookies
    const cookies = await captureFacebookCookies();
    const validation = validateCapturedCookies(cookies);
    
    if (!validation.isValid) {
      console.log('⏭️ Skipping sync - no valid session');
      return null;
    }
    
    // Get browser ID
    const browserFingerprint = await generateBrowserFingerprint();
    
    // Sync to server
    const response = await fetch(`${CONFIG.API_URL}/fb-session/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Browser-ID': browserFingerprint
      },
      body: JSON.stringify({
        accountId: targetAccountId,
        storageState: {
          cookies,
          origins: [] // localStorage can be added if needed
        },
        source: 'extension',
        timestamp: Date.now()
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Session sync failed');
    }
    
    const result = await response.json();
    
    // Update local state
    await chrome.storage.local.set({ 
      fbSessionLastSync: Date.now(),
      fbSessionExpiresAt: result.expiresAt
    });
    
    console.log('✅ Session synced:', {
      syncedAt: result.syncedAt,
      expiresAt: result.expiresAt
    });
    
    return result;
  } catch (error) {
    console.error('❌ Session sync failed:', error);
    return null;
  }
}

/**
 * Get current session status from server
 * @returns {Promise<Object>}
 */
async function getSessionStatus() {
  try {
    const { authToken, authState, accountId } = await chrome.storage.local.get([
      'authToken', 'authState', 'accountId'
    ]);
    
    const token = authToken || authState?.accessToken;
    const targetAccountId = accountId || authState?.dealerAccountId || authState?.accountId;
    
    if (!token || !targetAccountId) {
      return { hasSession: false, error: 'Not authenticated' };
    }
    
    const response = await fetch(`${CONFIG.API_URL}/fb-session/status/${targetAccountId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      return { hasSession: false, error: error.error };
    }
    
    const result = await response.json();
    
    // Update local state
    currentSessionInfo = result;
    await chrome.storage.local.set({ fbSessionInfo: result });
    
    return result;
  } catch (error) {
    console.error('Failed to get session status:', error);
    return { hasSession: false, error: error.message };
  }
}

// ============================================
// Auto-Sync & Cookie Monitoring
// ============================================

/**
 * Start auto-sync on cookie changes
 */
function startCookieMonitoring() {
  // Monitor cookie changes
  chrome.cookies.onChanged.addListener(async (changeInfo) => {
    if (changeInfo.cookie.domain.includes('facebook.com')) {
      console.log('🍪 Facebook cookie changed:', changeInfo.cookie.name, changeInfo.removed ? '(removed)' : '(updated)');
      
      // Debounce syncs
      clearTimeout(syncTimeout);
      syncTimeout = setTimeout(async () => {
        // Check if we have a valid session to sync
        const isLoggedIn = await isLoggedIntoFacebook();
        if (isLoggedIn) {
          const { authState } = await chrome.storage.local.get(['authState']);
          if (authState?.isAuthenticated) {
            await syncSessionToServer();
          }
        }
      }, SESSION_CONFIG.SYNC_DEBOUNCE_MS);
    }
  });
  
  console.log('🍪 Cookie monitoring started');
}

/**
 * Start periodic auto-sync
 */
function startAutoSync() {
  // Clear existing interval
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
  }
  
  // Start new interval
  autoSyncInterval = setInterval(async () => {
    console.log('⏰ Auto-sync triggered');
    
    // Check if there's an active Facebook tab
    const tabs = await chrome.tabs.query({ url: '*://*.facebook.com/*' });
    if (tabs.length > 0) {
      await syncSessionToServer();
    }
  }, SESSION_CONFIG.AUTO_SYNC_INTERVAL_MS);
  
  console.log('⏰ Auto-sync started (every 4 hours)');
}

/**
 * Start session status checks
 */
function startSessionChecks() {
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
  }
  
  sessionCheckInterval = setInterval(async () => {
    console.log('🔍 Checking session status...');
    const status = await getSessionStatus();
    
    // Notify if session needs attention
    if (status.hasSession && status.needsRefresh) {
      console.log('⚠️ Session needs refresh');
      // Could show notification here
    }
  }, SESSION_CONFIG.SESSION_CHECK_INTERVAL_MS);
  
  console.log('🔍 Session checks started (every 30 minutes)');
}

/**
 * Stop all auto-sync processes
 */
function stopAutoSync() {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
    syncTimeout = null;
  }
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
    sessionCheckInterval = null;
  }
  console.log('🛑 Auto-sync stopped');
}

// ============================================
// 2FA Setup Support
// ============================================

/**
 * Setup 2FA for session recovery
 * @param {string} existingSecret - Optional existing TOTP secret
 * @returns {Promise<Object>}
 */
async function setup2FA(existingSecret = null) {
  try {
    const { authToken, authState } = await chrome.storage.local.get(['authToken', 'authState']);
    const token = authToken || authState?.accessToken;
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const response = await fetch(`${CONFIG.API_URL}/fb-session/totp/setup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ existingSecret })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '2FA setup failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('2FA setup failed:', error);
    throw error;
  }
}

/**
 * Verify 2FA code
 * @param {string} code - 6-digit TOTP code
 * @returns {Promise<Object>}
 */
async function verify2FA(code) {
  try {
    const { authToken, authState } = await chrome.storage.local.get(['authToken', 'authState']);
    const token = authToken || authState?.accessToken;
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const response = await fetch(`${CONFIG.API_URL}/fb-session/totp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ code })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Verification failed');
    }
    
    const result = await response.json();
    
    if (result.success) {
      // Update session info
      const { fbSessionInfo } = await chrome.storage.local.get(['fbSessionInfo']);
      if (fbSessionInfo) {
        fbSessionInfo.has2FA = true;
        await chrome.storage.local.set({ fbSessionInfo });
      }
    }
    
    return result;
  } catch (error) {
    console.error('2FA verification failed:', error);
    throw error;
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Generate browser fingerprint for identification
 * @returns {Promise<string>}
 */
async function generateBrowserFingerprint() {
  const { browserFingerprint } = await chrome.storage.local.get(['browserFingerprint']);
  
  if (browserFingerprint) {
    return browserFingerprint;
  }
  
  // Generate new fingerprint
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const newFingerprint = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  
  await chrome.storage.local.set({ browserFingerprint: newFingerprint });
  return newFingerprint;
}

/**
 * Initialize session sync module
 */
async function initSessionSync() {
  console.log('🔌 Initializing session sync module...');
  
  // Start cookie monitoring
  startCookieMonitoring();
  
  // Check initial session status
  const status = await getSessionStatus();
  console.log('📊 Initial session status:', status.hasSession ? 'Active' : 'None');
  
  // If authenticated, start auto-sync
  const { authState } = await chrome.storage.local.get(['authState']);
  if (authState?.isAuthenticated) {
    startAutoSync();
    startSessionChecks();
  }
  
  console.log('✅ Session sync module initialized');
}

// ============================================
// Exports (for use in background-ai.js)
// ============================================

// These are exposed as globals for the background script
window.sessionSync = {
  captureFacebookCookies,
  validateCapturedCookies,
  isLoggedIntoFacebook,
  captureAndSyncSession,
  syncSessionToServer,
  getSessionStatus,
  startAutoSync,
  stopAutoSync,
  setup2FA,
  verify2FA,
  initSessionSync
};

// Auto-initialize when script loads
initSessionSync();
