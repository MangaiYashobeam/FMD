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
  FACEBOOK_APP_ID: '505778791605869',
  POLL_INTERVAL_MS: 10000,
  OAUTH_REDIRECT_URI: chrome.identity.getRedirectURL('oauth2'),
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

let activeTabs = new Map(); // tabId -> { accountId, url }

// ============================================
// OAuth Flow
// ============================================

/**
 * Initiate Facebook OAuth login
 */
async function initiateOAuth() {
  const state = generateRandomState();
  
  const authUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
  authUrl.searchParams.set('client_id', CONFIG.FACEBOOK_APP_ID);
  authUrl.searchParams.set('redirect_uri', CONFIG.OAUTH_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'email,public_profile');
  authUrl.searchParams.set('state', state);
  
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl.toString(),
        interactive: true,
      },
      async (redirectUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        try {
          const url = new URL(redirectUrl);
          const code = url.searchParams.get('code');
          const returnedState = url.searchParams.get('state');
          
          if (returnedState !== state) {
            throw new Error('State mismatch - possible CSRF attack');
          }
          
          if (!code) {
            throw new Error('No authorization code received');
          }
          
          // Exchange code for token via our server
          const tokenResult = await exchangeCodeForToken(code);
          resolve(tokenResult);
        } catch (error) {
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

// Load saved auth state on startup
chrome.storage.local.get('authState', (result) => {
  if (result.authState) {
    authState = result.authState;
    console.log('Auth state loaded:', authState.isAuthenticated);
  }
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
