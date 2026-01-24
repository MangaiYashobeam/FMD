// Dealers Face Chrome Extension - Background Service Worker
// Enhanced with IAI Soldier Task Polling and Marketplace Automation

const API_BASE_URL = 'https://dealersface.com';
const TASK_POLL_INTERVAL = 5000; // 5 seconds - Production: Check frequently
const HEARTBEAT_INTERVAL = 30000; // 30 seconds - Send heartbeat to server
const HEARTBEAT_CHECK_INTERVAL = 3000; // 3 seconds - Verify we're alive

let taskPollingInterval = null;
let heartbeatInterval = null;
let heartbeatCheckInterval = null;
let isPolling = false;
let isAwake = false;

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
// TASK POLLING SYSTEM
// ============================================

async function sendHeartbeat() {
  try {
    const { authToken, accountId } = await chrome.storage.local.get(['authToken', 'accountId']);
    if (!authToken || !accountId) return;
    
    await fetch(`${API_BASE_URL}/api/extension/heartbeat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accountId }),
    });
    
    console.log('💓 Heartbeat sent');
  } catch (error) {
    console.error('Heartbeat error:', error);
  }
}

function startHeartbeat() {
  if (heartbeatInterval) return; // Already sending heartbeats
  
  console.log('💓 Starting heartbeat...');
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
  
  // Update task status to processing
  await updateTaskStatus(task.id, 'processing');
  
  // Find a Facebook tab to execute the task
  const tabs = await chrome.tabs.query({ url: '*://*.facebook.com/*' });
  
  if (tabs.length === 0) {
    // Open Facebook Marketplace if no tab exists
    const newTab = await chrome.tabs.create({
      url: 'https://www.facebook.com/marketplace/create/vehicle/',
    });
    
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
    
    return result;
  } catch (error) {
    console.error('Failed to execute task:', error);
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
