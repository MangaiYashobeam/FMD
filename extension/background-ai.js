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
  API_URL: 'https://dealersface.com/api',
  // API_URL: 'http://localhost:5000/api', // Development
  FACEBOOK_APP_ID: null, // Fetched from server - not hardcoded
  POLL_INTERVAL_MS: 10000,
  OAUTH_REDIRECT_URI: chrome.identity.getRedirectURL(), // No suffix - matches Facebook config
};

console.log('OAuth Redirect URI:', CONFIG.OAUTH_REDIRECT_URI);

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
  
  // Update auth state
  authState = {
    isAuthenticated: true,
    accessToken: data.accessToken,
    userId: data.user.id,
    dealerAccountId: data.dealerAccount?.id,
    tokenExpiry: Date.now() + (data.expiresIn * 1000),
  };
  
  // Save to storage
  await chrome.storage.local.set({
    authState,
    accountId: data.dealerAccount?.id,
    authToken: data.serverToken,
  });
  
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
      return await initiateOAuth();
      
    case 'LOGOUT':
      authState = {
        isAuthenticated: false,
        accessToken: null,
        userId: null,
        dealerAccountId: null,
        tokenExpiry: null,
      };
      await chrome.storage.local.clear();
      return { success: true };
      
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
      
    case 'INJECT_CONTENT_SCRIPT':
      if (sender.tab?.id) {
        await chrome.scripting.executeScript({
          target: { tabId: sender.tab.id },
          files: ['content-ai.js'],
        });
      }
      return { success: true };
      
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
chrome.storage.local.get('authState', async (result) => {
  if (result.authState) {
    authState = result.authState;
    console.log('Auth state loaded:', authState.isAuthenticated);
  }
  
  // Fetch Facebook config from server
  await fetchFacebookConfig();
});

// Handle extension install/update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    // Open onboarding page
    chrome.tabs.create({
      url: 'https://dealersface.com/extension/welcome',
    });
  }
});

console.log('DF-Auto Sim background service worker started');
