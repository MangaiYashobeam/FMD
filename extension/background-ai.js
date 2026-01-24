/**
 * DF-Auto Sim Background Service Worker
 * 
 * Handles:
 * 1. Facebook OAuth flow
 * 2. Task polling and distribution
 * 3. Message routing between content scripts and server
 * 4. Session management
 */

// ============================================
// Configuration
// ============================================

const CONFIG = {
  API_URL: 'https://dealersface.com/api', // Production via Cloudflare
  // API_URL: 'http://localhost:5000/api', // Development
  FACEBOOK_APP_ID: null, // Fetched from server - not hardcoded
  POLL_INTERVAL_MS: 10000,
  OAUTH_REDIRECT_URI: chrome.identity.getRedirectURL(), // No suffix - matches Facebook config
  TASK_POLL_INTERVAL: 5000, // 5 seconds - IAI Soldier task polling
  HEARTBEAT_CHECK_INTERVAL: 30000, // 30 seconds - Verify we're alive
};

console.log('OAuth Redirect URI:', CONFIG.OAUTH_REDIRECT_URI);

// ============================================
// IAI Soldier - Task Polling State
// ============================================

let taskPollingInterval = null;
let heartbeatCheckInterval = null;
let isPolling = false;
let isAwake = false;
let soldierInfo = null; // { id, soldierId, status }

// ============================================
// State
// ============================================

let authState = {
  isAuthenticated: false,
  accessToken: null,
  userId: null,
  dealerAccountId: null,
  tokenExpiry: null,
};

let facebookConfig = null; // Cached Facebook config from server
let activeTabs = new Map(); // tabId -> { accountId, url }

// ============================================
// Facebook Config Fetcher
// ============================================

/**
 * Fetch Facebook configuration from server
 * This allows the App ID to be managed from the web dashboard
 */
async function fetchFacebookConfig() {
  try {
    const response = await fetch(`${CONFIG.API_URL}/config/facebook`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (data.success && data.data) {
      facebookConfig = data.data;
      CONFIG.FACEBOOK_APP_ID = data.data.appId;
      console.log('Facebook config loaded:', { 
        appId: data.data.appId ? data.data.appId.slice(0, 5) + '...' : 'not set',
        configured: data.data.configured 
      });
      return data.data;
    }
    throw new Error('Invalid config response');
  } catch (error) {
    console.error('Failed to fetch Facebook config:', error);
    // Return cached config if available
    return facebookConfig;
  }
}

// ============================================
// IAI Soldier - Registration & Tracking
// ============================================

/**
 * Register this browser instance as an IAI Soldier
 */
async function registerIAISoldier() {
  try {
    const { authState: savedAuth, authToken } = await chrome.storage.local.get(['authState', 'authToken']);
    
    // Use authToken (server JWT) for API calls
    const token = authToken || savedAuth?.accessToken;
    const accountId = savedAuth?.dealerAccountId || savedAuth?.accountId;
    const userId = savedAuth?.userId || savedAuth?.user?.id;
    
    if (!token || !accountId) {
      console.log('❌ Cannot register IAI - not authenticated', { hasToken: !!token, hasAccountId: !!accountId });
      return null;
    }
    
    // Get browser ID from storage or generate new one
    let { browserId } = await chrome.storage.local.get(['browserId']);
    if (!browserId) {
      browserId = crypto.randomUUID();
      await chrome.storage.local.set({ browserId });
    }
    
    // Get geolocation (optional) - use ip-api.com which allows CORS
    let locationData = {};
    try {
      const ipResponse = await fetch('http://ip-api.com/json/');
      if (ipResponse.ok) {
        const ipData = await ipResponse.json();
        if (ipData.status === 'success') {
          locationData = {
            ipAddress: ipData.query,
            locationCountry: ipData.country,
            locationCity: ipData.city,
            locationLat: ipData.lat,
            locationLng: ipData.lon,
            timezone: ipData.timezone,
          };
        }
      }
    } catch (e) {
      console.log('Could not fetch location:', e.message);
      // Fallback: skip geolocation, it's optional
    }
    
    console.log('📡 Registering IAI Soldier...', { accountId, userId, browserId });
    
    const response = await fetch(
      `${CONFIG.API_URL.replace('/api', '')}/api/extension/iai/register`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          userId,
          browserId,
          extensionVersion: chrome.runtime.getManifest().version,
          userAgent: navigator.userAgent,
          ...locationData,
        }),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Registration failed:', response.status, errorText);
      
      // Try to refresh token if unauthorized
      if (response.status === 401) {
        console.log('🔄 Token expired, attempting refresh...');
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          // Retry registration with new token
          console.log('🔄 Retrying registration with new token...');
          return await registerIAISoldier();
        }
      }
      
      throw new Error(`Registration failed: ${response.status}`);
    }
    
    const data = await response.json();
    soldierInfo = data.soldier;
    
    console.log(`✅ IAI Soldier registered: ${soldierInfo.soldierId}`);
    
    // Store soldier info
    await chrome.storage.local.set({ soldierInfo });
    
    return soldierInfo;
  } catch (error) {
    console.error('❌ IAI registration error:', error);
    return null;
  }
}

/**
 * Send IAI heartbeat + regular extension heartbeat
 * Both are needed: IAI heartbeat for the IAI Command Center, regular heartbeat for the Extension Status indicator
 */
async function sendIAIHeartbeat() {
  try {
    const { authState: savedAuth, authToken } = await chrome.storage.local.get(['authState', 'authToken']);
    const token = authToken || savedAuth?.accessToken;
    const accountId = savedAuth?.dealerAccountId || savedAuth?.accountId;
    
    if (!token || !accountId) {
      return;
    }
    
    const status = isPolling ? (isAwake ? 'working' : 'online') : 'idle';
    
    // Send IAI heartbeat (for IAI Command Center)
    if (soldierInfo) {
      await fetch(
        `${CONFIG.API_URL.replace('/api', '')}/api/extension/iai/heartbeat`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            soldierId: soldierInfo.soldierId,
            accountId,
            status,
          }),
        }
      );
    }
    
    // Also send regular extension heartbeat (for ExtensionStatus component in web app)
    await fetch(
      `${CONFIG.API_URL.replace('/api', '')}/api/extension/heartbeat`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
        }),
      }
    );
    
    console.log(`💓 Heartbeat sent for account ${accountId}`);
  } catch (error) {
    console.error('Heartbeat error:', error);
  }
}

/**
 * Log IAI activity
 */
async function logIAIActivity(eventType, data) {
  if (!soldierInfo) {
    return;
  }
  
  try {
    const { authState: savedAuth, authToken } = await chrome.storage.local.get(['authState', 'authToken']);
    const token = authToken || savedAuth?.accessToken;
    const accountId = savedAuth?.dealerAccountId || savedAuth?.accountId;
    
    if (!token || !accountId) {
      return;
    }
    
    await fetch(
      `${CONFIG.API_URL.replace('/api', '')}/api/extension/iai/log-activity`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          soldierId: soldierInfo.soldierId,
          accountId,
          eventType,
          ...data,
        }),
      }
    );
  } catch (error) {
    console.error('Log activity error:', error);
  }
}

// ============================================
// IAI Soldier - Task Polling Functions
// ============================================

/**
 * Start aggressive IAI task polling
 */
async function startIAITaskPolling() {
  if (isPolling) {
    console.log('✅ IAI Soldier already polling');
    return;
  }
  
  const { authState: savedAuth, authToken } = await chrome.storage.local.get(['authState', 'authToken']);
  const token = authToken || savedAuth?.accessToken;
  const accountId = savedAuth?.dealerAccountId || savedAuth?.accountId;
  
  if (!token || !accountId) {
    console.log('❌ Cannot start IAI - not authenticated (token:', !!token, 'accountId:', accountId, ')');
    return;
  }
  
  // Register as IAI Soldier
  if (!soldierInfo) {
    soldierInfo = await registerIAISoldier();
    if (!soldierInfo) {
      console.error('❌ Failed to register IAI Soldier');
      return;
    }
  }
  
  isPolling = true;
  isAwake = true;
  console.log(`🚀 IAI SOLDIER ${soldierInfo.soldierId} WAKING UP - Starting aggressive task polling...`);
  
  // Log wake-up event
  await logIAIActivity('status_change', {
    message: `Soldier ${soldierInfo.soldierId} came online`,
    eventData: { previousStatus: 'offline', newStatus: 'online' },
  });
  
  // Update badge to show we're active
  chrome.action.setBadgeText({ text: 'ON' });
  chrome.action.setBadgeBackgroundColor({ color: '#22C55E' });
  
  // Start polling immediately
  await pollForIAITasks();
  
  // Then poll every 5 seconds
  taskPollingInterval = setInterval(pollForIAITasks, CONFIG.TASK_POLL_INTERVAL);
  
  // Heartbeat check every 30 seconds
  heartbeatCheckInterval = setInterval(checkIAIHeartbeat, CONFIG.HEARTBEAT_CHECK_INTERVAL);
  
  console.log('✅ IAI Soldier active - polling every 5 seconds');
}

/**
 * Stop IAI task polling
 */
function stopIAITaskPolling() {
  if (!isPolling) {
    return;
  }
  
  isPolling = false;
  isAwake = false;
  
  if (taskPollingInterval) {
    clearInterval(taskPollingInterval);
    taskPollingInterval = null;
  }
  
  if (heartbeatCheckInterval) {
    clearInterval(heartbeatCheckInterval);
    heartbeatCheckInterval = null;
  }
  
  chrome.action.setBadgeText({ text: '' });
  console.log('😴 IAI Soldier stopped');
}

/**
 * Poll for pending IAI tasks
 */
async function pollForIAITasks() {
  if (!isPolling) {
    return;
  }
  
  try {
    const { authState: savedAuth, authToken } = await chrome.storage.local.get(['authState', 'authToken']);
    const token = authToken || savedAuth?.accessToken;
    const accountId = savedAuth?.dealerAccountId || savedAuth?.accountId;
    
    if (!token || !accountId) {
      console.log('❌ No credentials - cannot poll (token:', !!token, 'accountId:', accountId, ')');
      return;
    }
    
    const now = new Date().toLocaleTimeString();
    console.log(`🔍 [${now}] IAI SOLDIER CHECKING FOR TASKS (account: ${accountId})...`);
    
    let response = await fetch(
      `${CONFIG.API_URL.replace('/api', '')}/api/extension/tasks/${accountId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    // Handle token expiration - try to refresh
    if (response.status === 401) {
      console.log('🔄 Token expired, attempting to refresh...');
      try {
        // Try to get a new token via the login flow
        const newAuth = await initiateOAuth();
        if (newAuth && newAuth.accessToken) {
          // Update storage
          authState = newAuth;
          await chrome.storage.local.set({ authState: newAuth });
          
          // Retry with new token
          response = await fetch(
            `${CONFIG.API_URL.replace('/api', '')}/api/extension/tasks/${newAuth.dealerAccountId}`,
            {
              headers: {
                'Authorization': `Bearer ${newAuth.accessToken}`,
                'Content-Type': 'application/json',
              },
            }
          );
          console.log('✅ Token refreshed, retrying task poll');
        }
      } catch (refreshError) {
        console.error('❌ Token refresh failed:', refreshError);
        console.log('⚠️ Please reload extension and log in again via side panel');
        stopIAITaskPolling();
        
        // Show notification to user
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.svg',
          title: 'IAI Soldier - Login Required',
          message: 'Your session expired. Please open the side panel and log in again.',
          priority: 2
        });
        return;
      }
    }
    
    if (!response.ok) {
      console.warn('Task polling failed:', response.status);
      return;
    }
    
    const tasks = await response.json();
    
    if (tasks && tasks.length > 0) {
      console.log(`📋 TASKS FOUND: ${tasks.length} READY TO EXECUTE`, tasks.map(t => t.type));
      
      // Update badge with task count
      chrome.action.setBadgeText({ text: String(tasks.length) });
      chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
      
      // Show notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.svg',
        title: 'IAI Soldier - Tasks Available',
        message: `${tasks.length} posting tasks ready to execute`,
        priority: 2
      });
      
      // Auto-execute first task
      const pendingTask = tasks.find(t => t.status === 'pending');
      if (pendingTask) {
        console.log(`🎯 Auto-executing task: ${pendingTask.id} (${pendingTask.type})`);
        await executeIAITask(pendingTask);
      }
    } else {
      console.log(`✓ Found ${tasks ? tasks.length : 0} tasks for account ${savedAuth.dealerAccountId}`);
      
      // Update badge to show we're still active
      chrome.action.setBadgeText({ text: 'ON' });
      chrome.action.setBadgeBackgroundColor({ color: '#22C55E' });
    }
    
  } catch (error) {
    console.error('❌ IAI polling error:', error);
  }
}

/**
 * Execute an IAI task
 */
async function executeIAITask(task) {
  try {
    console.log('🚀 Executing IAI task:', task.id, task.type);
    
    // Log task start
    await logIAIActivity('task_start', {
      taskId: task.id,
      taskType: task.type,
      message: `Starting task ${task.type} for vehicle ${task.data?.vehicle?.stockNumber || 'unknown'}`,
    });
    
    // Find or create a Facebook tab
    const tabs = await chrome.tabs.query({ url: 'https://www.facebook.com/*' });
    let fbTab = tabs[0];
    
    if (!fbTab) {
      // Create new Facebook tab
      fbTab = await chrome.tabs.create({ url: 'https://www.facebook.com/marketplace/create/vehicle' });
      // Wait for tab to load
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Send task to content script
    await chrome.tabs.sendMessage(fbTab.id, {
      type: 'EXECUTE_IAI_TASK',
      task: task
    });
    
    console.log('✅ Task sent to content script');
    
  } catch (error) {
    console.error('❌ Failed to execute IAI task:', error);
    
    // Log error
    await logIAIActivity('error', {
      taskId: task.id,
      taskType: task.type,
      message: `Task execution failed: ${error.message}`,
      eventData: { error: error.message, stack: error.stack },
    });
  }
}

/**
 * Check IAI heartbeat - ensure we're still alive
 * Sends heartbeat regardless of polling state so web app knows extension is online
 */
async function checkIAIHeartbeat() {
  console.log(`💓 Extension heartbeat check - isPolling: ${isPolling}, soldier: ${soldierInfo?.soldierId || 'unknown'}`);
  
  // Always send heartbeat to update extension status in web app
  await sendIAIHeartbeat();
}

// ============================================
// OAuth Flow
// ============================================

/**
 * Initiate Facebook OAuth login
 */
async function initiateOAuth() {
  // Ensure we have the latest Facebook config
  const config = await fetchFacebookConfig();
  
  console.log('OAuth initiate - config:', config);
  
  if (!CONFIG.FACEBOOK_APP_ID) {
    const errorMsg = 'Facebook App ID not configured. Please contact administrator to configure Facebook integration in the Admin Dashboard.';
    console.error('OAuth Error:', errorMsg);
    throw new Error(errorMsg);
  }
  
  const state = generateRandomState();
  
  const authUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
  authUrl.searchParams.set('client_id', CONFIG.FACEBOOK_APP_ID);
  authUrl.searchParams.set('redirect_uri', CONFIG.OAUTH_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'email,public_profile');
  authUrl.searchParams.set('state', state);
  
  console.log('OAuth URL:', authUrl.toString());
  console.log('Redirect URI:', CONFIG.OAUTH_REDIRECT_URI);
  
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl.toString(),
        interactive: true,
      },
      async (redirectUrl) => {
        if (chrome.runtime.lastError) {
          const errMsg = chrome.runtime.lastError.message;
          console.error('OAuth launchWebAuthFlow error:', errMsg);
          
          // Provide helpful error messages
          if (errMsg.includes('canceled') || errMsg.includes('closed')) {
            reject(new Error('Login was cancelled. Please try again.'));
          } else if (errMsg.includes('invalid_client') || errMsg.includes('App ID')) {
            reject(new Error('Invalid Facebook App configuration. Please contact administrator.'));
          } else {
            reject(new Error(`Facebook login failed: ${errMsg}`));
          }
          return;
        }
        
        if (!redirectUrl) {
          reject(new Error('No redirect URL received from Facebook. Please try again.'));
          return;
        }
        
        console.log('OAuth redirect received:', redirectUrl);
        
        try {
          const url = new URL(redirectUrl);
          const code = url.searchParams.get('code');
          const returnedState = url.searchParams.get('state');
          const error = url.searchParams.get('error');
          const errorDescription = url.searchParams.get('error_description');
          
          if (error) {
            throw new Error(errorDescription || `Facebook error: ${error}`);
          }
          
          if (returnedState !== state) {
            throw new Error('State mismatch - possible security issue. Please try again.');
          }
          
          if (!code) {
            throw new Error('No authorization code received from Facebook.');
          }
          
          // Exchange code for token via our server
          const tokenResult = await exchangeCodeForToken(code);
          resolve(tokenResult);
        } catch (error) {
          console.error('OAuth callback error:', error);
          reject(error);
        }
      }
    );
  });
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(code) {
  const response = await fetch(`${CONFIG.API_URL}/auth/facebook/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      redirectUri: CONFIG.OAUTH_REDIRECT_URI,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Token exchange failed');
  }
  
  const data = await response.json();
  
  // Update auth state - use serverToken as the main API token
  authState = {
    isAuthenticated: true,
    accessToken: data.serverToken, // Use server JWT token for API calls
    facebookAccessToken: data.accessToken, // Keep Facebook token separately
    userId: data.user.id,
    dealerAccountId: data.dealerAccount?.id,
    accountId: data.dealerAccount?.id,
    tokenExpiry: Date.now() + (24 * 60 * 60 * 1000), // 24 hours for server token
    user: data.user,
  };
  
  // Save to storage - include refresh token
  await chrome.storage.local.set({
    authState,
    accountId: data.dealerAccount?.id,
    authToken: data.serverToken,
    refreshToken: data.refreshToken, // Store refresh token for token renewal
  });
  
  console.log('✅ OAuth tokens saved successfully');
  
  return data;
}

/**
 * Generate random state for CSRF protection
 */
function generateRandomState() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Refresh access token if needed
 */
async function refreshTokenIfNeeded() {
  if (!authState.tokenExpiry) return;
  
  // Refresh 5 minutes before expiry
  if (Date.now() > authState.tokenExpiry - 300000) {
    try {
      const response = await fetch(`${CONFIG.API_URL}/auth/facebook/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: authState.accessToken,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        authState.accessToken = data.accessToken;
        authState.tokenExpiry = Date.now() + (data.expiresIn * 1000);
        await chrome.storage.local.set({ authState });
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
  }
}

/**
 * Refresh access token (force refresh)
 * Called when we get a 401 from API
 */
async function refreshAccessToken() {
  try {
    const { authState: savedAuth, refreshToken } = await chrome.storage.local.get(['authState', 'refreshToken']);
    
    if (!refreshToken) {
      console.log('No refresh token available');
      return false;
    }
    
    const response = await fetch(`${CONFIG.API_URL.replace('/api', '')}/api/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });
    
    if (!response.ok) {
      console.error('Token refresh failed:', response.status);
      return false;
    }
    
    const data = await response.json();
    
    if (data.success && data.data?.accessToken) {
      // Update authState with new token
      const newAuthState = {
        ...savedAuth,
        accessToken: data.data.accessToken,
        tokenExpiry: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      };
      
      await chrome.storage.local.set({ 
        authState: newAuthState,
        authToken: data.data.accessToken,
        refreshToken: data.data.refreshToken || refreshToken,
      });
      
      // Update in-memory state
      authState = newAuthState;
      
      console.log('✅ Token refreshed successfully');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Token refresh error:', error);
    return false;
  }
}

// ============================================
// Task Management
// ============================================

/**
 * Poll server for pending tasks
 */
async function pollForTasks() {
  if (!authState.dealerAccountId) return;
  
  try {
    await refreshTokenIfNeeded();
    
    const { authToken } = await chrome.storage.local.get('authToken');
    
    const response = await fetch(
      `${CONFIG.API_URL}/extension/tasks/${authState.dealerAccountId}/pending`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      }
    );
    
    if (!response.ok) return;
    
    const tasks = await response.json();
    
    // Distribute tasks to appropriate tabs
    for (const task of tasks) {
      await distributeTask(task);
    }
  } catch (error) {
    console.error('Task polling error:', error);
  }
}

/**
 * Distribute task to appropriate content script
 */
async function distributeTask(task) {
  // Find a tab that's on Facebook
  const tabs = await chrome.tabs.query({
    url: ['*://*.facebook.com/*', '*://www.facebook.com/*'],
  });
  
  if (tabs.length === 0) {
    // Open a new Facebook tab
    const newTab = await chrome.tabs.create({
      url: 'https://www.facebook.com/marketplace/you/selling',
      active: false,
    });
    
    // Wait for tab to load
    await new Promise(resolve => {
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === newTab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      });
    });
    
    tabs.push(newTab);
  }
  
  // Send task to content script
  const targetTab = tabs[0];
  
  try {
    await chrome.tabs.sendMessage(targetTab.id, {
      type: 'EXECUTE_TASK',
      task,
    });
  } catch (error) {
    console.error('Failed to send task to content script:', error);
  }
}

// ============================================
// Message Handlers
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(result => sendResponse({ success: true, data: result }))
    .catch(error => sendResponse({ success: false, error: error.message }));
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'LOGIN':
      const loginResult = await initiateOAuth();
      // Start IAI polling after successful login
      if (loginResult && loginResult.accessToken) {
        await startIAITaskPolling();
      }
      return loginResult;
      
    case 'LOGOUT':
      // Stop IAI polling on logout
      stopIAITaskPolling();
      authState = {
        isAuthenticated: false,
        accessToken: null,
        userId: null,
        dealerAccountId: null,
        tokenExpiry: null,
      };
      await chrome.storage.local.clear();
      return { success: true };
    
    case 'DISCONNECT_FACEBOOK':
      // Disconnect Facebook and clear all tokens
      try {
        const { authToken, accountId } = await chrome.storage.local.get(['authToken', 'accountId']);
        
        // Call server to disconnect
        if (authToken) {
          await fetch(`${CONFIG.API_URL}/auth/facebook/disconnect`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ accountId }),
          });
        }
        
        // Clear local state
        authState = {
          isAuthenticated: false,
          accessToken: null,
          userId: null,
          dealerAccountId: null,
          tokenExpiry: null,
        };
        await chrome.storage.local.clear();
        
        return { success: true, message: 'Facebook disconnected successfully' };
      } catch (error) {
        console.error('Disconnect error:', error);
        // Still clear local state even if server call fails
        authState = {
          isAuthenticated: false,
          accessToken: null,
          userId: null,
          dealerAccountId: null,
          tokenExpiry: null,
        };
        await chrome.storage.local.clear();
        return { success: true, message: 'Local state cleared' };
      }
      
    case 'GET_AUTH_STATE':
      return authState;
    
    case 'GET_FACEBOOK_CONFIG':
      // Return current Facebook config (fetch if not loaded)
      if (!facebookConfig) {
        await fetchFacebookConfig();
      }
      return {
        config: facebookConfig,
        configured: !!(CONFIG.FACEBOOK_APP_ID),
      };
      
    case 'SCRAPE_RESULT':
      // Forward scrape results to server
      return await sendScrapeResult(message.data);
      
    case 'TASK_COMPLETE':
      return await reportTaskComplete(message.taskId, message.result);
      
    case 'TASK_FAILED':
      return await reportTaskFailed(message.taskId, message.error);
      
    case 'GET_ACCOUNT_INFO':
      return await getAccountInfo();
      
    case 'GET_VEHICLES':
      return await getVehicles();
      
    case 'GENERATE_DESCRIPTION':
      return await generateVehicleDescription(message.vehicle);
      
    case 'RECORD_POSTING':
      return await recordPosting(message.vehicleId, message.platform, message.status);
      
    case 'INJECT_CONTENT_SCRIPT':
      if (sender.tab?.id) {
        await chrome.scripting.executeScript({
          target: { tabId: sender.tab.id },
          files: ['content-ai.js'],
        });
      }
      return { success: true };
    
    case 'START_IAI_POLLING':
      await startIAITaskPolling();
      return { success: true, message: 'IAI Soldier activated' };
    
    case 'STOP_IAI_POLLING':
      stopIAITaskPolling();
      return { success: true, message: 'IAI Soldier deactivated' };
    
    case 'IAI_TASK_COMPLETED':
      // Update task status on server
      try {
        const { authState: savedAuth } = await chrome.storage.local.get(['authState']);
        if (savedAuth && savedAuth.accessToken) {
          await fetch(`${CONFIG.API_URL.replace('/api', '')}/api/extension/tasks/${message.taskId}/complete`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${savedAuth.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ result: message.result })
          });
        }
        return { success: true };
      } catch (error) {
        console.error('Failed to report task completion:', error);
        return { success: false, error: error.message };
      }
    
    case 'IAI_TASK_FAILED':
      // Update task status on server
      try {
        const { authState: savedAuth } = await chrome.storage.local.get(['authState']);
        if (savedAuth && savedAuth.accessToken) {
          await fetch(`${CONFIG.API_URL.replace('/api', '')}/api/extension/tasks/${message.taskId}/failed`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${savedAuth.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ error: message.error })
          });
        }
        return { success: true };
      } catch (error) {
        console.error('Failed to report task failure:', error);
        return { success: false, error: error.message };
      }
    
    case 'AI_CHAT':
      // Send message to AI assistant (same layer as user)
      return await sendAIChatMessage(message.content, message.context);
      
    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

/**
 * Send scrape results to server
 */
async function sendScrapeResult(data) {
  const { authToken } = await chrome.storage.local.get('authToken');
  
  const response = await fetch(`${CONFIG.API_URL}/extension/scrape-result`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      accountId: authState.dealerAccountId,
      ...data,
    }),
  });
  
  return response.json();
}

/**
 * Report task completion
 */
async function reportTaskComplete(taskId, result) {
  const { authToken } = await chrome.storage.local.get('authToken');
  
  const response = await fetch(`${CONFIG.API_URL}/extension/tasks/${taskId}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({ result }),
  });
  
  return response.json();
}

/**
 * Report task failure
 */
async function reportTaskFailed(taskId, error) {
  const { authToken } = await chrome.storage.local.get('authToken');
  
  const response = await fetch(`${CONFIG.API_URL}/extension/tasks/${taskId}/failed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({ error }),
  });
  
  return response.json();
}

/**
 * Get account info from server
 */
async function getAccountInfo() {
  const { authToken } = await chrome.storage.local.get('authToken');
  
  const response = await fetch(`${CONFIG.API_URL}/extension/account`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
  });
  
  return response.json();
}

/**
 * Get vehicles from server inventory
 */
async function getVehicles() {
  const storage = await chrome.storage.local.get(['authState', 'authToken', 'accountId']);
  const { authState, authToken, accountId: storedAccountId } = storage;
  
  // Use authToken (server JWT) for API calls, fallback to authState.accessToken
  const token = authToken || authState?.accessToken;
  
  if (!token) {
    console.log('❌ No auth token available for getVehicles');
    return { success: false, error: 'Not authenticated' };
  }
  
  try {
    // Use dealersface.com API to fetch vehicles
    // Try multiple sources for accountId
    const accountId = storedAccountId || authState?.dealerAccountId || authState?.accountId;
    console.log('📦 Fetching vehicles for account:', accountId, 'token:', token?.substring(0, 20) + '...');
    
    if (!accountId) {
      console.log('❌ No accountId available for getVehicles');
      return { success: false, error: 'No account ID found. Please re-login.' };
    }
    
    // Fetch all vehicles (no status filter, server handles pagination)
    const url = `${CONFIG.API_URL.replace('/api', '')}/api/vehicles?accountId=${accountId}&limit=100`;
    console.log('📦 Fetching from URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    console.log('📦 Vehicle API response status:', response.status);
    
    if (!response.ok) {
      // Log the response body for debugging
      const errorText = await response.text();
      console.log('❌ Vehicle API error response:', errorText);
      
      // Try to refresh token if unauthorized
      if (response.status === 401) {
        console.log('🔄 Token expired, refreshing...');
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          // Retry with new token
          return await getVehicles();
        }
        // If refresh failed, clear auth and return error
        console.log('❌ Token refresh failed, clearing auth');
        return { success: false, error: 'Session expired. Please login again.' };
      }
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    console.log('✅ Fetched vehicles:', data.data?.vehicles?.length || data.data?.length || 0, 'from response:', JSON.stringify(data).substring(0, 200));
    return { 
      success: true, 
      data: data.data?.vehicles || data.data || data.vehicles || [] 
    };
  } catch (error) {
    console.error('Failed to fetch vehicles:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate AI description for a vehicle
 */
async function generateVehicleDescription(vehicle) {
  try {
    const prompt = `Write a compelling Facebook Marketplace listing description for this vehicle:

Year: ${vehicle.year}
Make: ${vehicle.make}
Model: ${vehicle.model}
Mileage: ${vehicle.mileage || 'N/A'} miles
Price: $${vehicle.price}
Condition: ${vehicle.condition || 'Good'}
Color: ${vehicle.exteriorColor || 'N/A'}
Transmission: ${vehicle.transmission || 'Automatic'}
Engine: ${vehicle.engine || 'N/A'}

Requirements:
- Professional but friendly tone
- Highlight key features and selling points
- Include a call-to-action
- Keep under 200 words
- Do not use excessive emojis

Description:`;

    // Try the AI service
    const response = await fetch('https://sag.gemquery.com/api/v1/generate-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        maxTokens: 400,
        temperature: 0.7,
      }),
    });
    
    if (response.ok) {
      const result = await response.json();
      return { 
        success: true, 
        description: result.text || result.content || result.response || ''
      };
    }
    
    // Fallback: generate a simple template
    return {
      success: true,
      description: generateFallbackDescription(vehicle)
    };
    
  } catch (error) {
    console.error('AI description generation failed:', error);
    return {
      success: true,
      description: generateFallbackDescription(vehicle)
    };
  }
}

/**
 * Fallback description generator
 */
function generateFallbackDescription(vehicle) {
  const year = vehicle.year || '';
  const make = vehicle.make || '';
  const model = vehicle.model || '';
  const mileage = vehicle.mileage ? `${vehicle.mileage.toLocaleString()} miles` : 'Low mileage';
  const price = vehicle.price ? `$${vehicle.price.toLocaleString()}` : 'Call for price';
  
  return `${year} ${make} ${model} FOR SALE!

✅ ${mileage}
✅ Clean title
✅ Well maintained
✅ Ready to drive today!

Price: ${price}

This ${year} ${make} ${model} is in excellent condition and has been well cared for. Perfect for anyone looking for a reliable vehicle.

Don't miss out on this great opportunity! Contact us today to schedule a test drive.

📞 Message us for more info!
🚗 Financing available`;
}

/**
 * Record a vehicle posting
 */
async function recordPosting(vehicleId, platform, status) {
  const { authToken, accountId } = await chrome.storage.local.get(['authToken', 'accountId']);
  
  if (!authToken) {
    return { success: false, error: 'Not authenticated' };
  }
  
  try {
    const response = await fetch(`${CONFIG.API_URL}/extension/posting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        vehicleId,
        accountId,
        platform,
        status,
        postedAt: new Date().toISOString(),
      }),
    });
    
    return await response.json();
  } catch (error) {
    console.error('Failed to record posting:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send AI Chat Message
 * Connects to the server's AI endpoint for user assistance
 * Uses the same auth layer as the user's session
 */
async function sendAIChatMessage(content, context = {}) {
  const { authToken, authState, accountId: storedAccountId } = await chrome.storage.local.get(['authToken', 'authState', 'accountId']);
  
  const token = authToken || authState?.accessToken;
  
  if (!token) {
    return { 
      success: false, 
      error: 'Not authenticated',
      response: 'Please log in to use the AI assistant.' 
    };
  }
  
  try {
    console.log('🤖 Sending AI chat message:', content.substring(0, 50) + '...');
    
    // Get current tab context
    let tabContext = { ...context };
    let activeFacebookTabs = [];
    let activeMarketplaceTabs = [];
    
    try {
      // Get current active tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab) {
        tabContext.url = activeTab.url;
        tabContext.title = activeTab.title;
        tabContext.pageType = detectPageType(activeTab.url);
      }
      
      // Get all tabs to understand user's full context
      const allTabs = await chrome.tabs.query({});
      activeFacebookTabs = allTabs.filter(t => t.url?.includes('facebook.com'));
      activeMarketplaceTabs = allTabs.filter(t => t.url?.includes('/marketplace'));
      
    } catch (e) {
      // Tab context is optional
    }
    
    const response = await fetch(`${CONFIG.API_URL.replace('/api', '')}/api/extension/ai-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: content,
        context: {
          accountId: storedAccountId || authState?.accountId || authState?.dealerAccountId,
          source: 'extension', // Explicitly identify source
          extensionVersion: chrome.runtime.getManifest().version,
          activeFacebookTabs: activeFacebookTabs.length,
          activeMarketplaceTabs: activeMarketplaceTabs.length,
          isSoldierActive: isPolling, // Is IAI Soldier active
          ...tabContext,
        },
      }),
    });
    
    if (!response.ok) {
      // Try refresh token if 401
      if (response.status === 401) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return await sendAIChatMessage(content, context);
        }
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ AI response received');
    
    return {
      success: true,
      response: data.response || data.content || data.message || 'No response received.',
    };
  } catch (error) {
    console.error('AI chat error:', error);
    return {
      success: false,
      error: error.message,
      response: 'Sorry, I\'m having trouble connecting. Please try again.',
    };
  }
}

/**
 * Detect page type from URL
 */
function detectPageType(url) {
  if (!url) return 'unknown';
  
  if (url.includes('/marketplace/create')) return 'create-listing';
  if (url.includes('/marketplace/item')) return 'listing';
  if (url.includes('/marketplace/inbox')) return 'inbox';
  if (url.includes('/marketplace')) return 'marketplace';
  if (url.includes('facebook.com')) return 'facebook';
  if (url.includes('dealersface.com')) return 'dealersface';
  
  return 'other';
}

// ============================================
// Tab Management
// ============================================

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('facebook.com')) {
    // Initialize content script with credentials
    chrome.storage.local.get(['accountId', 'authToken'], (result) => {
      if (result.accountId && result.authToken) {
        chrome.tabs.sendMessage(tabId, {
          type: 'INIT',
          accountId: result.accountId,
          authToken: result.authToken,
        }).catch(() => {
          // Content script might not be loaded yet, that's OK
        });
      }
    });
    
    activeTabs.set(tabId, { url: tab.url });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  activeTabs.delete(tabId);
});

// ============================================
// Alarms for Background Tasks
// ============================================

chrome.alarms.create('pollTasks', { periodInMinutes: 0.5 });
chrome.alarms.create('refreshToken', { periodInMinutes: 30 });

chrome.alarms.onAlarm.addListener((alarm) => {
  switch (alarm.name) {
    case 'pollTasks':
      pollForTasks();
      break;
    case 'refreshToken':
      refreshTokenIfNeeded();
      break;
  }
});

// ============================================
// Initialize
// ============================================

// Handle extension icon click - open side panel
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (error) {
    console.error('Failed to open side panel:', error);
    // Fallback: try to open without tabId
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (e) {
      console.error('Fallback also failed:', e);
    }
  }
});

// Enable side panel for all tabs
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Failed to set panel behavior:', error));

// Load saved auth state and fetch Facebook config on startup
chrome.storage.local.get(['authState', 'authToken'], async (result) => {
  if (result.authState) {
    authState = result.authState;
    const accountId = authState.dealerAccountId || authState.accountId;
    console.log('Auth state loaded:', authState.isAuthenticated, 'accountId:', accountId);
    
    // Auto-start IAI polling if authenticated (check both dealerAccountId and accountId)
    if (authState.isAuthenticated && accountId) {
      console.log('🚀 Auto-starting IAI Soldier (user is authenticated)');
      await startIAITaskPolling();
      
      // Send initial heartbeat
      await sendIAIHeartbeat();
    } else if (result.authToken) {
      // Even if authState is incomplete, if we have a token, start heartbeat
      console.log('📡 Starting heartbeat with existing token');
      heartbeatCheckInterval = setInterval(checkIAIHeartbeat, CONFIG.HEARTBEAT_CHECK_INTERVAL);
      await sendIAIHeartbeat();
    }
  }
  
  // Fetch Facebook config from server
  await fetchFacebookConfig();
});

// Handle extension install/update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    // Open onboarding page
    chrome.tabs.create({
      url: 'https://dealersface.com/extension/welcome',
    });
  } else if (details.reason === 'update') {
    // On update, restart IAI polling if user is logged in
    const { authState: savedAuth, authToken } = await chrome.storage.local.get(['authState', 'authToken']);
    const accountId = savedAuth?.dealerAccountId || savedAuth?.accountId;
    if (savedAuth && savedAuth.isAuthenticated && accountId) {
      console.log('🔄 Extension updated - restarting IAI Soldier');
      await startIAITaskPolling();
    } else if (authToken) {
      // Start heartbeat if we have a token
      console.log('🔄 Extension updated - starting heartbeat');
      heartbeatCheckInterval = setInterval(checkIAIHeartbeat, CONFIG.HEARTBEAT_CHECK_INTERVAL);
    }
  }
});

console.log('DF-Auto Sim background service worker started');
console.log('🎯 IAI Soldier ready - will start polling on login');
