// Dealers Face Chrome Extension - Background Service Worker
// Enhanced with IAI Soldier Task Polling and Marketplace Automation
// 💓 THE HEARTBEAT OF THE IAI STEALTH SOLDIER 💓

const API_BASE_URL = 'https://dealersface.com';
const TASK_POLL_INTERVAL = 5000; // 5 seconds - Production: Check frequently
const HEARTBEAT_INTERVAL = 30000; // 30 seconds - Send heartbeat to server
const HEARTBEAT_CHECK_INTERVAL = 3000; // 3 seconds - Verify we're alive

let taskPollingInterval = null;
let heartbeatInterval = null;
let heartbeatCheckInterval = null;
let isPolling = false;
let isAwake = false;
let currentTask = null; // 💓 Track current task for heartbeat sync

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Dealers Face extension installed:', details.reason);
  
  // Open side panel on extension icon click
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  
  // Initialize badge
  chrome.action.setBadgeBackgroundColor({ color: '#3B82F6' });
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  if (message.type === 'API_REQUEST') {
    handleApiRequest(message.endpoint, message.method, message.data)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true; // Keep the message channel open for async response
  }
  
  if (message.type === 'GET_AUTH_TOKEN') {
    chrome.storage.local.get(['authToken'], (result) => {
      sendResponse({ token: result.authToken || null });
    });
    return true;
  }
  
  if (message.type === 'SET_AUTH_TOKEN') {
    chrome.storage.local.set({ authToken: message.token }, () => {
      sendResponse({ success: true });
      // Start polling when user logs in
      startTaskPolling();
    });
    return true;
  }
  
  if (message.type === 'CLEAR_AUTH') {
    chrome.storage.local.remove(['authToken', 'user', 'accountId'], () => {
      sendResponse({ success: true });
      // Stop polling when user logs out
      stopTaskPolling();
    });
    return true;
  }
  
  if (message.type === 'OPEN_FACEBOOK_TAB') {
    chrome.tabs.create({ url: message.url }, (tab) => {
      sendResponse({ tabId: tab.id });
    });
    return true;
  }
  
  if (message.type === 'START_TASK_POLLING') {
    startTaskPolling();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'STOP_TASK_POLLING') {
    stopTaskPolling();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'EXECUTE_IAI_TASK') {
    executeIAITask(message.task)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
  
  if (message.type === 'TASK_COMPLETED') {
    updateTaskStatus(message.taskId, 'completed', message.result)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
  
  if (message.type === 'TASK_FAILED') {
    updateTaskStatus(message.taskId, 'failed', { error: message.error })
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
  
  // ============================================
  // SESSION CAPTURE (Session-Based Auth)
  // ============================================
  
  if (message.type === 'CAPTURE_FB_SESSION') {
    captureFacebookSession()
      .then(sendResponse)
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.type === 'GET_SESSION_STATUS') {
    getSessionStatus()
      .then(sendResponse)
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.type === 'SYNC_SESSION') {
    syncSessionToServer()
      .then(sendResponse)
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  // ============================================
  // MULTI-TAB MANAGEMENT
  // ============================================
  
  if (message.type === 'GET_ALL_FACEBOOK_TABS') {
    getAllFacebookTabs()
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
  
  if (message.type === 'SWITCH_TO_TAB') {
    chrome.tabs.update(message.tabId, { active: true }, () => {
      sendResponse({ success: true, tabId: message.tabId });
    });
    return true;
  }
  
  if (message.type === 'OPEN_TAB') {
    openNewTab(message.url, message.tabType)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
  
  if (message.type === 'CLOSE_TAB') {
    chrome.tabs.remove(message.tabId, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'EXECUTE_IN_TAB') {
    executeInSpecificTab(message.tabId, message.action, message.data)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
  
  if (message.type === 'EXECUTE_MULTI_TAB_SEQUENCE') {
    executeMultiTabSequence(message.sequence)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
  
  // Training Data Injection
  if (message.type === 'INJECT_TRAINING_DATA') {
    injectTrainingDataToTabs(message.trainingData)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
  
  if (message.type === 'LOAD_TRAINING_DATA') {
    loadAndInjectTrainingData()
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
  
  if (message.type === 'GET_TRAINING_STATUS') {
    getTrainingStatus()
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
});

// ============================================
// TRAINING DATA INJECTION
// ============================================

/**
 * Inject training data to all Facebook tabs with IAI Soldier
 */
async function injectTrainingDataToTabs(trainingData) {
  try {
    // Save to storage first
    await chrome.storage.local.set({ iaiTraining: trainingData });
    console.log('[Background] Training data saved to storage');
    
    // Find all Facebook tabs
    const tabs = await chrome.tabs.query({ url: '*://*.facebook.com/*' });
    
    let injectedCount = 0;
    for (const tab of tabs) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (data) => {
            if (typeof window.__IAI_INJECT_TRAINING__ === 'function') {
              window.__IAI_INJECT_TRAINING__(data);
              console.log('[IAI] Training data injected into tab');
            }
          },
          args: [trainingData]
        });
        injectedCount++;
      } catch (e) {
        console.debug('[Background] Failed to inject to tab:', tab.id, e.message);
      }
    }
    
    console.log(`[Background] Training data injected to ${injectedCount}/${tabs.length} tabs`);
    return { success: true, injectedCount, totalTabs: tabs.length };
  } catch (error) {
    console.error('[Background] Training injection error:', error);
    throw error;
  }
}

// ============================================
// MULTI-TAB MANAGEMENT FUNCTIONS
// ============================================

/**
 * Get all Facebook tabs with their types
 */
async function getAllFacebookTabs() {
  const tabs = await chrome.tabs.query({ url: '*://*.facebook.com/*' });
  
  return {
    tabs: tabs.map(tab => ({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      active: tab.active,
      type: detectTabType(tab.url),
    })),
    count: tabs.length,
  };
}

/**
 * Detect tab type from URL
 */
function detectTabType(url) {
  if (!url) return 'unknown';
  
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('/marketplace/create')) return 'marketplace-create';
  if (urlLower.includes('/marketplace/item')) return 'marketplace-item';
  if (urlLower.includes('/marketplace')) return 'marketplace';
  if (urlLower.includes('/messages')) return 'messages';
  if (urlLower.includes('/groups')) return 'groups';
  if (urlLower.includes('/profile')) return 'profile';
  if (urlLower.includes('/notifications')) return 'notifications';
  
  return 'facebook-other';
}

/**
 * Open a new tab with specified URL and type
 */
async function openNewTab(url, tabType) {
  // Default URLs for tab types
  const defaultUrls = {
    'marketplace': 'https://www.facebook.com/marketplace',
    'marketplace-create': 'https://www.facebook.com/marketplace/create/vehicle/',
    'messages': 'https://www.facebook.com/messages/t/',
    'groups': 'https://www.facebook.com/groups/',
    'profile': 'https://www.facebook.com/me',
  };
  
  const targetUrl = url || defaultUrls[tabType] || 'https://www.facebook.com/';
  
  const tab = await chrome.tabs.create({
    url: targetUrl,
    active: true,
  });
  
  // Wait for page to load
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return {
    success: true,
    tab: {
      id: tab.id,
      url: tab.url,
      type: detectTabType(tab.url),
    },
  };
}

/**
 * Execute action in a specific tab
 */
async function executeInSpecificTab(tabId, action, data) {
  try {
    // First, switch to the tab
    await chrome.tabs.update(tabId, { active: true });
    
    // Wait a moment for tab to be active
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Send message to content script
    const result = await chrome.tabs.sendMessage(tabId, {
      type: action,
      ...data,
    });
    
    return { success: true, result };
  } catch (error) {
    console.error(`[Background] Execute in tab ${tabId} failed:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Execute a sequence of actions across multiple tabs
 * This is used for multi-tab training playback
 */
async function executeMultiTabSequence(sequence) {
  const results = [];
  const tabMap = new Map(); // Map old tabIds to new ones
  
  for (const step of sequence) {
    try {
      let tabId = step.tabId;
      
      // Handle tab creation
      if (step.action === 'createTab') {
        const newTab = await chrome.tabs.create({
          url: step.url || 'https://www.facebook.com/',
          active: true,
        });
        
        // Map the recorded tabId to the new one
        tabMap.set(step.originalTabId || step.tabId, newTab.id);
        tabId = newTab.id;
        
        // Wait for page to load
        await new Promise(resolve => setTimeout(resolve, step.delay || 3000));
        
        results.push({ step: step.stepIndex, action: 'createTab', tabId: newTab.id, success: true });
        continue;
      }
      
      // Handle tab switch
      if (step.action === 'switchTab') {
        const mappedTabId = tabMap.get(step.tabId) || step.tabId;
        await chrome.tabs.update(mappedTabId, { active: true });
        
        await new Promise(resolve => setTimeout(resolve, step.delay || 500));
        
        results.push({ step: step.stepIndex, action: 'switchTab', tabId: mappedTabId, success: true });
        continue;
      }
      
      // Handle tab close
      if (step.action === 'closeTab') {
        const mappedTabId = tabMap.get(step.tabId) || step.tabId;
        await chrome.tabs.remove(mappedTabId);
        
        results.push({ step: step.stepIndex, action: 'closeTab', tabId: mappedTabId, success: true });
        continue;
      }
      
      // Handle regular actions (click, type, etc.)
      const mappedTabId = tabMap.get(step.tabId) || step.tabId;
      
      // Execute the action in the tab
      const result = await chrome.tabs.sendMessage(mappedTabId, {
        type: 'EXECUTE_TRAINING_STEP',
        step: step,
      });
      
      // Wait between steps
      if (step.delay) {
        await new Promise(resolve => setTimeout(resolve, step.delay));
      }
      
      results.push({ 
        step: step.stepIndex, 
        action: step.action, 
        tabId: mappedTabId, 
        success: result?.success || true,
        result: result,
      });
      
    } catch (error) {
      console.error(`[Background] Step ${step.stepIndex} failed:`, error);
      results.push({ 
        step: step.stepIndex, 
        action: step.action, 
        success: false, 
        error: error.message,
      });
      
      // Continue or break based on step config
      if (!step.continueOnError) {
        break;
      }
    }
  }
  
  return {
    success: results.every(r => r.success),
    results: results,
    completedSteps: results.filter(r => r.success).length,
    totalSteps: sequence.length,
  };
}

/**
 * Load training data from API and inject to all tabs
 */
async function loadAndInjectTrainingData() {
  try {
    const result = await chrome.storage.local.get(['authToken']);
    if (!result.authToken) {
      return { success: false, error: 'Not authenticated' };
    }
    
    const response = await fetch(`${API_BASE_URL}/api/training/inject/iai`, {
      headers: { 'Authorization': `Bearer ${result.authToken}` }
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { success: false, error: error.error || 'Failed to load training data' };
    }
    
    const data = await response.json();
    if (!data.success || !data.code) {
      return { success: false, error: 'No active training configuration' };
    }
    
    // Inject to all tabs
    const injectionResult = await injectTrainingDataToTabs(data.code);
    return {
      success: true,
      sessionId: data.code._sessionId,
      version: data.code._trainingVersion,
      ...injectionResult
    };
  } catch (error) {
    console.error('[Background] Load training data error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get current training status
 */
async function getTrainingStatus() {
  try {
    const result = await chrome.storage.local.get(['iaiTraining']);
    if (result.iaiTraining) {
      return {
        loaded: true,
        sessionId: result.iaiTraining._sessionId,
        version: result.iaiTraining._trainingVersion || result.iaiTraining._version,
        fields: Object.keys(result.iaiTraining.FIELD_SELECTORS || {}),
        stepsCount: (result.iaiTraining.STEPS || []).length,
      };
    }
    return { loaded: false };
  } catch (error) {
    return { loaded: false, error: error.message };
  }
}

// Token Refresh Function
async function refreshAuthToken() {
  try {
    const result = await chrome.storage.local.get(['refreshToken']);
    
    if (!result.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: result.refreshToken }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Token refresh failed');
    }
    
    // Store new tokens
    await chrome.storage.local.set({
      authToken: data.data.accessToken,
      refreshToken: data.data.refreshToken || result.refreshToken,
    });
    
    console.log('✅ Token refreshed successfully');
    return data.data.accessToken;
  } catch (error) {
    console.error('❌ Token refresh failed:', error);
    throw error;
  }
}

// Handle API requests through background script (to avoid CORS issues)
async function handleApiRequest(endpoint, method = 'GET', data = null, isRetry = false) {
  const tokenResult = await chrome.storage.local.get(['authToken']);
  const token = tokenResult.authToken;
  
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const options = {
    method,
    headers,
  };
  
  if (data && method !== 'GET') {
    options.body = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const responseData = await response.json();
    
    if (!response.ok) {
      // Handle token expiration
      if (response.status === 401 && !isRetry) {
        try {
          await refreshAuthToken();
          // Retry the original request
          return handleApiRequest(endpoint, method, data, true);
        } catch (refreshError) {
          throw new Error('Session expired. Please login again.');
        }
      }
      throw new Error(responseData.message || 'API request failed');
    }
    
    return responseData;
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}

// ============================================
// IAI SOLDIER REGISTRATION & HEARTBEAT SYSTEM
// ============================================

// Store soldier info locally
let currentSoldierId = null;

/**
 * Register this extension as an IAI Soldier
 * Called once when extension starts with credentials
 */
async function registerAsSoldier() {
  try {
    const { authToken, accountId } = await chrome.storage.local.get(['authToken', 'accountId']);
    if (!authToken || !accountId) {
      console.log('❌ Cannot register soldier: Missing credentials');
      return null;
    }
    
    // Generate a unique browser ID based on extension instance
    const browserId = await getBrowserId();
    
    // Get location info (if available)
    let locationData = {};
    try {
      const geoResponse = await fetch('https://ipapi.co/json/');
      if (geoResponse.ok) {
        const geo = await geoResponse.json();
        locationData = {
          locationCountry: geo.country_name,
          locationCity: geo.city,
          locationLat: geo.latitude,
          locationLng: geo.longitude,
          timezone: geo.timezone,
        };
      }
    } catch (geoError) {
      console.warn('Could not get location:', geoError);
    }
    
    const response = await fetch(`${API_BASE_URL}/api/extension/iai/register`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountId,
        browserId,
        extensionVersion: chrome.runtime.getManifest().version,
        userAgent: navigator.userAgent,
        ...locationData,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      currentSoldierId = data.soldier?.soldierId;
      // Store in local storage for persistence
      await chrome.storage.local.set({ soldierId: currentSoldierId });
      console.log(`🎖️ IAI Soldier registered: ${currentSoldierId}`);
      return currentSoldierId;
    } else {
      console.error('❌ Failed to register soldier:', response.status);
      return null;
    }
  } catch (error) {
    console.error('❌ Error registering soldier:', error);
    return null;
  }
}

/**
 * Get or generate a unique browser ID for this extension instance
 */
async function getBrowserId() {
  const { browserId } = await chrome.storage.local.get(['browserId']);
  if (browserId) return browserId;
  
  // Generate a new unique ID
  const newId = 'browser_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  await chrome.storage.local.set({ browserId: newId });
  return newId;
}

/**
 * Send heartbeat to IAI Command Center
 * This keeps the soldier status online and tracks activity
 * 💓 THE HEART OF THE IAI STEALTH SOLDIER 💓
 */
async function sendHeartbeat() {
  try {
    const { authToken, accountId, soldierId } = await chrome.storage.local.get(['authToken', 'accountId', 'soldierId']);
    if (!authToken || !accountId) return;
    
    // If we don't have a soldier ID yet, register first
    if (!soldierId && !currentSoldierId) {
      console.log('📝 No soldier ID, registering...');
      await registerAsSoldier();
      return;
    }
    
    const activeSoldierId = soldierId || currentSoldierId;
    
    // 💓 Send heartbeat to IAI system
    const response = await fetch(`${API_BASE_URL}/api/extension/iai/heartbeat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        soldierId: activeSoldierId,
        accountId,
        status: 'online',
        currentTaskType: currentTask?.type || null,
        currentTaskId: currentTask?.id || null,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`💓 IAI Heartbeat: ${activeSoldierId} | ${data.timestamp}`);
      
      // Update badge to show heartbeat
      chrome.action.setBadgeText({ text: '💓' });
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 500);
      
      // Log heartbeat activity
      await logActivity('heartbeat', `💓 Heartbeat sync | Status: online`);
    } else if (response.status === 404) {
      // Soldier not found, re-register
      console.log('⚠️ Soldier not found, re-registering...');
      await chrome.storage.local.remove(['soldierId']);
      currentSoldierId = null;
      await registerAsSoldier();
    } else {
      console.log(`⚠️ Heartbeat failed: ${response.status}`);
    }
    
    // Also send to legacy heartbeat endpoint for backwards compatibility
    await fetch(`${API_BASE_URL}/api/extension/heartbeat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accountId }),
    });
  } catch (error) {
    console.error('💔 Heartbeat error:', error);
  }
}

/**
 * 📝 Log activity to IAI Command Center
 */
async function logActivity(eventType, message, taskData = {}) {
  try {
    const { authToken, accountId, soldierId } = await chrome.storage.local.get(['authToken', 'accountId', 'soldierId']);
    if (!authToken || !accountId || !soldierId) return;
    
    const response = await fetch(`${API_BASE_URL}/api/extension/iai/log-activity`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        soldierId: soldierId || currentSoldierId,
        accountId,
        eventType,
        message,
        taskId: taskData.id || null,
        taskType: taskData.type || null,
        eventData: taskData,
      }),
    });
    
    if (response.ok) {
      console.log(`📝 Activity logged: ${eventType}`);
    }
  } catch (error) {
    console.error('❌ Failed to log activity:', error);
  }
}

function startHeartbeat() {
  if (heartbeatInterval) return; // Already sending heartbeats
  
  console.log('💓 Starting IAI heartbeat...');
  sendHeartbeat(); // Send initial heartbeat
  heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  console.log('💔 Heartbeat stopped');
}

async function startTaskPolling() {
  if (taskPollingInterval) return; // Already polling
  
  const credentials = await chrome.storage.local.get(['authToken', 'accountId']);
  if (!credentials.authToken || !credentials.accountId) {
    console.log('Cannot start polling: Missing credentials');
    return;
  }
  
  console.log('🎖️ Starting IAI Task Polling...');
  isPolling = true;
  
  // Register as IAI Soldier first
  await registerAsSoldier();
  
  // Start heartbeat
  startHeartbeat();
  
  // Initial poll
  await pollForTasks();
  
  // Set up interval
  taskPollingInterval = setInterval(pollForTasks, TASK_POLL_INTERVAL);
}

function stopTaskPolling() {
  if (taskPollingInterval) {
    clearInterval(taskPollingInterval);
    taskPollingInterval = null;
  }
  isPolling = false;
  
  // Stop heartbeat
  stopHeartbeat();
  
  console.log('🛑 Task Polling stopped');
}

async function pollForTasks() {
  if (!isPolling) {
    console.log('⚠️ pollForTasks called but isPolling=false');
    return;
  }
  
  try {
    const { authToken, accountId } = await chrome.storage.local.get(['authToken', 'accountId']);
    if (!authToken || !accountId) {
      console.log('❌ No credentials - cannot poll');
      return;
    }
    
    const now = new Date().toLocaleTimeString();
    console.log(`🔍 [${now}] IAI SOLDIER CHECKING FOR TASKS (account: ${accountId})...`);
    
    let response = await fetch(
      `${API_BASE_URL}/api/extension/tasks/${accountId}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    // Handle token expiration
    if (response.status === 401) {
      console.log('🔄 Token expired during polling, refreshing...');
      try {
        const newToken = await refreshAuthToken();
        // Retry with new token
        response = await fetch(
          `${API_BASE_URL}/api/extension/tasks/${accountId}`,
          {
            headers: {
              'Authorization': `Bearer ${newToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (refreshError) {
        console.error('❌ Token refresh failed during polling:', refreshError);
        stopTaskPolling();
        return;
      }
    }
    
    if (!response.ok) {
      console.warn('Task polling failed:', response.status);
      return;
    }
    
    const tasks = await response.json();
    
    if (tasks && tasks.length > 0) {
      console.log(`📋 Found ${tasks.length} pending tasks:`, tasks.map(t => t.type));
      
      // Update badge
      chrome.action.setBadgeText({ text: String(tasks.length) });
      chrome.action.setBadgeBackgroundColor({ color: '#22C55E' });
      
      // Notify any open Facebook tabs about pending tasks
      await notifyFacebookTabs(tasks);
      
      // Auto-execute first pending task if we have a Facebook tab ready
      const pendingTask = tasks.find(t => t.status === 'pending');
      if (pendingTask) {
        console.log(`🎯 Auto-executing task: ${pendingTask.id} (${pendingTask.type})`);
        await autoExecuteTask(pendingTask);
      }
    } else {
      chrome.action.setBadgeText({ text: '' });
      console.log('📋 No pending tasks');
    }
  } catch (error) {
    console.debug('Task polling error:', error);
  }
}

async function autoExecuteTask(task) {
  // Find or create a Facebook tab
  let tabs = await chrome.tabs.query({ url: '*://*.facebook.com/*' });
  
  if (tabs.length === 0) {
    console.log('📍 Opening Facebook Marketplace...');
    const newTab = await chrome.tabs.create({
      url: 'https://www.facebook.com/marketplace/create/vehicle/',
      active: true,
    });
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 5000));
    tabs = [newTab];
  }
  
  // Send task to content script
  const targetTab = tabs[0];
  
  // Ensure tab is active
  await chrome.tabs.update(targetTab.id, { active: true });
  
  try {
    // Update task status to processing
    await updateTaskStatus(task.id, 'processing');
    
    console.log(`📤 Sending task to tab ${targetTab.id}...`);
    
    const result = await chrome.tabs.sendMessage(targetTab.id, {
      type: 'EXECUTE_IAI_TASK',
      task: task,
    });
    
    console.log('📥 Task execution result:', result);
    
    if (result?.success) {
      await updateTaskStatus(task.id, 'completed', result);
      console.log(`✅ Task ${task.id} completed`);
    }
    
    return result;
  } catch (error) {
    console.error('Failed to execute task:', error);
    
    // Retry with injected script
    try {
      console.log('🔄 Retrying with script injection...');
      await chrome.scripting.executeScript({
        target: { tabId: targetTab.id },
        files: ['content.js'],
      });
      
      // Wait for script to initialize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Try again
      const retryResult = await chrome.tabs.sendMessage(targetTab.id, {
        type: 'EXECUTE_IAI_TASK',
        task: task,
      });
      
      if (retryResult?.success) {
        await updateTaskStatus(task.id, 'completed', retryResult);
      }
      
      return retryResult;
    } catch (retryError) {
      console.error('Retry also failed:', retryError);
      await updateTaskStatus(task.id, 'failed', { error: retryError.message });
      throw retryError;
    }
  }
}

async function notifyFacebookTabs(tasks) {
  const tabs = await chrome.tabs.query({ url: '*://*.facebook.com/*' });
  
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'IAI_TASKS_AVAILABLE',
        tasks: tasks,
      });
    } catch (e) {
      // Tab might not have content script ready
    }
  }
}

async function executeIAITask(task) {
  console.log('🎯 Executing IAI Task:', task.type);
  
  // � Set current task for heartbeat sync
  currentTask = task;
  
  // �📝 Log task start
  await logActivity('task_start', `🚀 Starting task: ${task.type}`, { id: task.id, type: task.type });
  
  // Update task status to processing
  await updateTaskStatus(task.id, 'processing');
  
  // Find a Facebook tab to execute the task
  const tabs = await chrome.tabs.query({ url: '*://*.facebook.com/*' });
  
  if (tabs.length === 0) {
    // Open Facebook Marketplace if no tab exists
    const newTab = await chrome.tabs.create({
      url: 'https://www.facebook.com/marketplace/create/vehicle/',
    });
    
    // 📝 Log tab creation
    await logActivity('info', `📂 Opened new Facebook tab`, { tabId: newTab.id });
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    tabs.push(newTab);
  }
  
  // Send task to content script
  const targetTab = tabs[0];
  
  try {
    const result = await chrome.tabs.sendMessage(targetTab.id, {
      type: 'EXECUTE_IAI_TASK',
      task: task,
    });
    
    // 📝 Log task completion
    await logActivity('task_complete', `✅ Task completed: ${task.type}`, { id: task.id, type: task.type, result });
    
    // 💓 Clear current task
    currentTask = null;
    
    return result;
  } catch (error) {
    console.error('Failed to execute task:', error);
    
    // 📝 Log task failure
    await logActivity('task_fail', `❌ Task failed: ${error.message}`, { id: task.id, type: task.type, error: error.message });
    
    // 💓 Clear current task
    currentTask = null;
    
    await updateTaskStatus(task.id, 'failed', { error: error.message });
    throw error;
  }
}

async function updateTaskStatus(taskId, status, result = null) {
  const { authToken } = await chrome.storage.local.get(['authToken']);
  if (!authToken) return;
  
  try {
    await fetch(`${API_BASE_URL}/api/extension/tasks/${taskId}/status`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status, result }),
    });
    
    console.log(`Task ${taskId} status updated to: ${status}`);
  } catch (error) {
    console.error('Failed to update task status:', error);
  }
}

// ============================================
// TAB MONITORING
// ============================================

// Listen for tab updates to detect Facebook pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isFacebook = tab.url.includes('facebook.com');
    
    if (isFacebook) {
      // Notify the side panel that we're on Facebook
      chrome.runtime.sendMessage({
        type: 'FACEBOOK_TAB_READY',
        tabId,
        url: tab.url,
      }).catch(() => {
        // Side panel might not be open, that's ok
      });
      
      // Trigger task check when on Facebook
      if (isPolling) {
        pollForTasks();
      }
    }
  }
});

// ============================================
// SESSION CAPTURE FUNCTIONS (Session-Based Auth)
// ============================================

/**
 * Capture Facebook session cookies
 * This is the PRIMARY authentication method for Marketplace posting
 */
async function captureFacebookSession() {
  console.log('[Session] Capturing Facebook session...');
  
  try {
    // Get auth token and account ID
    const storage = await chrome.storage.local.get(['authToken', 'accountId']);
    if (!storage.authToken) {
      throw new Error('Not logged in. Please log in to DealersFace first.');
    }
    
    // Get all Facebook cookies
    const cookies = await chrome.cookies.getAll({ domain: '.facebook.com' });
    
    if (!cookies || cookies.length === 0) {
      throw new Error('No Facebook cookies found. Please log into Facebook first.');
    }
    
    // Check for required cookies
    const requiredCookies = ['c_user', 'xs', 'datr'];
    const foundCookies = cookies.map(c => c.name);
    const missingCookies = requiredCookies.filter(name => !foundCookies.includes(name));
    
    if (missingCookies.length > 0) {
      throw new Error(`Missing required Facebook cookies: ${missingCookies.join(', ')}. Please log into Facebook.`);
    }
    
    // Format cookies for sending to server
    const formattedCookies = cookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      expires: cookie.expirationDate,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite
    }));
    
    // Get browser user agent
    const userAgent = navigator.userAgent;
    
    // Generate a simple browser fingerprint
    const browserFingerprint = await generateBrowserFingerprint();
    
    // Send to server
    const response = await fetch(`${API_BASE_URL}/api/fb-session/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${storage.authToken}`
      },
      body: JSON.stringify({
        cookies: formattedCookies,
        userAgent,
        browserFingerprint
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Store session info locally
    await chrome.storage.local.set({
      fbSessionId: result.sessionId,
      fbUserId: result.fbUserId,
      fbSessionStatus: 'ACTIVE',
      fbSessionCapturedAt: new Date().toISOString()
    });
    
    console.log('[Session] Session captured successfully:', result);
    
    // Update badge to show session active
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
    
    return {
      success: true,
      sessionId: result.sessionId,
      fbUserId: result.fbUserId,
      expiresAt: result.expiresAt,
      recommendations: result.recommendations
    };
  } catch (error) {
    console.error('[Session] Capture error:', error);
    throw error;
  }
}

/**
 * Get current session status from server
 */
async function getSessionStatus() {
  try {
    const storage = await chrome.storage.local.get(['authToken', 'accountId']);
    if (!storage.authToken || !storage.accountId) {
      return { success: true, hasSession: false, reason: 'Not logged in' };
    }
    
    const response = await fetch(`${API_BASE_URL}/api/fb-session/status/${storage.accountId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${storage.authToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Update local storage
    if (result.hasSession) {
      await chrome.storage.local.set({
        fbSessionId: result.sessionId,
        fbUserId: result.fbUserId,
        fbSessionStatus: result.status,
        fbHas2FA: result.has2FA
      });
    }
    
    return result;
  } catch (error) {
    console.error('[Session] Status check error:', error);
    throw error;
  }
}

/**
 * Sync session to server (re-capture and send)
 */
async function syncSessionToServer() {
  console.log('[Session] Syncing session to server...');
  
  try {
    const storage = await chrome.storage.local.get(['authToken', 'accountId']);
    if (!storage.authToken || !storage.accountId) {
      throw new Error('Not logged in');
    }
    
    // Get fresh cookies
    const cookies = await chrome.cookies.getAll({ domain: '.facebook.com' });
    
    // Format for storage state
    const storageState = {
      cookies: cookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expirationDate,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite
      })),
      timestamp: Date.now()
    };
    
    // Send to server
    const response = await fetch(`${API_BASE_URL}/api/fb-session/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${storage.authToken}`,
        'x-browser-id': await getBrowserId()
      },
      body: JSON.stringify({
        accountId: storage.accountId,
        storageState,
        source: 'extension',
        timestamp: Date.now()
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Sync failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('[Session] Session synced:', result);
    
    return {
      success: true,
      sessionId: result.sessionId,
      syncedAt: result.syncedAt
    };
  } catch (error) {
    console.error('[Session] Sync error:', error);
    throw error;
  }
}

/**
 * Generate a simple browser fingerprint
 */
async function generateBrowserFingerprint() {
  const data = [
    navigator.userAgent,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.language
  ].join('|');
  
  // Simple hash
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(16);
}

/**
 * Get or generate a unique browser ID
 */
async function getBrowserId() {
  const storage = await chrome.storage.local.get(['browserId']);
  if (storage.browserId) {
    return storage.browserId;
  }
  
  const browserId = 'ext_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  await chrome.storage.local.set({ browserId });
  return browserId;
}

// ============================================
// STARTUP
// ============================================

// AGGRESSIVE AUTO-START: Wake up IAI soldiers immediately on browser launch
chrome.storage.local.get(['authToken', 'accountId'], (result) => {
  if (result.authToken && result.accountId) {
    console.log('🎖️ IAI SOLDIER AWAKE - Starting aggressive task polling...');
    isAwake = true;
    startTaskPolling();
    
    // Set badge to show we're active
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
  } else {
    console.log('⚠️ IAI waiting for credentials - Please log in');
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' });
  }
});

// Keep-alive ping every 30 seconds
setInterval(() => {
  console.log('💓 IAI Soldier heartbeat check');
  chrome.storage.local.get(['authToken'], (result) => {
    if (result.authToken && !isPolling) {
      console.log('⚠️ IAI was asleep! Waking up now...');
      startTaskPolling();
    }
  });
}, 30000);

console.log('🎖️ Dealers Face IAI SOLDIER - READY FOR PRODUCTION BATTLE');
