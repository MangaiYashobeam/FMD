/**
 * FMD Training Recorder - Background Service Worker
 * SUPER ADMIN ROOT CONSOLE v2.1.3
 * 
 * Handles:
 * - Recording session management
 * - API communication with backend
 * - Training data storage and retrieval
 * - Side panel management
 * - Keepalive mechanism for service worker
 */

// ============================================
// IMMEDIATE STARTUP - LOG AND REGISTER LISTENER FIRST
// ============================================

console.log('[Recorder BG] ========================================');
console.log('[Recorder BG] Background service worker LOADING v2.1.3');
console.log('[Recorder BG] Timestamp:', new Date().toISOString());
console.log('[Recorder BG] ========================================');

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  API_URL: 'https://dealersface.com/api',
  // API_URL: 'http://localhost:5000/api',
  AUTH_TOKEN_KEY: 'fmd_admin_token',
  KEEPALIVE_INTERVAL: 20000,
  HEARTBEAT_INTERVAL: 60000,
};

// ============================================
// GLOBAL STATE
// ============================================

const TabManager = {
  isRecording: false,
  sessionId: null,
  recordingTabs: new Map(),
  tabSequence: [],
  allEvents: [],
};

let keepaliveInterval = null;
let heartbeatInterval = null;
let heartbeatBackoffUntil = null;
let heartbeatFailCount = 0;
let currentSession = null;
let liveEvents = [];

// ============================================
// REGISTER MESSAGE LISTENER IMMEDIATELY
// This MUST be at the top before any async code
// ============================================

console.log('[Recorder BG] Registering message listener...');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const messageTime = new Date().toISOString();
  console.log(`[Recorder BG ${messageTime}] Message received:`, message.type);
  
  try {
    // Handle messages synchronously where possible
    switch (message.type) {
      case 'PING':
        console.log('[Recorder BG] PING received - responding with PONG');
        sendResponse({ pong: true, timestamp: Date.now() });
        return true;
        
      case 'CONTENT_SCRIPT_READY':
        console.log('[Recorder BG] Content script ready on tab:', sender.tab?.id);
        sendResponse({ acknowledged: true });
        return true;
        
      case 'HEALTH_CHECK':
        console.log('[Recorder BG] Health check received');
        sendResponse({ 
          alive: true, 
          timestamp: Date.now(),
          recording: TabManager.isRecording || false,
          tabs: TabManager.recordingTabs?.size || 0
        });
        return true;
        
      case 'GET_ACTIVE_TAB':
        console.log('[Recorder BG] GET_ACTIVE_TAB received');
        handleGetActiveTab(sendResponse);
        return true;
        
      case 'GET_FACEBOOK_TABS':
        console.log('[Recorder BG] GET_FACEBOOK_TABS received');
        handleGetFacebookTabs(sendResponse);
        return true;
        
      default:
        // Handle other messages asynchronously
        handleAsyncMessage(message, sender, sendResponse);
        return true;
    }
  } catch (error) {
    console.error('[Recorder BG] Message handler error:', error);
    sendResponse({ success: false, error: error.message });
    return true;
  }
});

console.log('[Recorder BG] Message listener registered successfully');

// ============================================
// TAB QUERY HANDLERS (simple async functions)
// ============================================

async function handleGetActiveTab(sendResponse) {
  try {
    console.log('[Recorder BG] handleGetActiveTab executing...');
    
    // Try active tab in current window
    let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    let tab = tabs[0];
    
    if (!tab) {
      // Try last focused window
      tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      tab = tabs[0];
    }
    
    if (!tab) {
      // Try any Facebook tab
      const fbTabs = await chrome.tabs.query({ url: '*://*.facebook.com/*' });
      if (fbTabs.length > 0) tab = fbTabs[0];
    }
    
    if (!tab) {
      // Last resort: any tab
      const allTabs = await chrome.tabs.query({});
      if (allTabs.length > 0) tab = allTabs[0];
    }
    
    console.log('[Recorder BG] GET_ACTIVE_TAB result:', tab ? { id: tab.id, url: tab.url?.substring(0, 50) } : 'none');
    sendResponse({ success: !!tab, tab: tab || null });
  } catch (error) {
    console.error('[Recorder BG] handleGetActiveTab error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetFacebookTabs(sendResponse) {
  try {
    console.log('[Recorder BG] handleGetFacebookTabs executing...');
    const fbTabs = await chrome.tabs.query({ url: '*://*.facebook.com/*' });
    console.log('[Recorder BG] Facebook tabs found:', fbTabs.length);
    sendResponse({ success: true, tabs: fbTabs });
  } catch (error) {
    console.error('[Recorder BG] handleGetFacebookTabs error:', error);
    sendResponse({ success: false, error: error.message, tabs: [] });
  }
}

// ============================================
// ASYNC MESSAGE HANDLER (for other messages)
// ============================================

async function handleAsyncMessage(message, sender, sendResponse) {
  try {
    const result = await processMessage(message, sender);
    sendResponse(result);
  } catch (error) {
    console.error('[Recorder BG] Async message error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function processMessage(message, sender) {
  switch (message.type) {
    case 'RECORDER_EVENT':
      liveEvents.push(message.event);
      if (liveEvents.length > 500) liveEvents = liveEvents.slice(-500);
      if (message.counts) {
        chrome.runtime.sendMessage({ type: 'EVENT_RECORDED', counts: message.counts }).catch(() => {});
      }
      return { received: true };
      
    case 'SAVE_SESSION':
      return await saveTrainingSession(message.sessionData);
      
    case 'GET_LIVE_EVENTS':
      return { events: liveEvents };
      
    case 'CLEAR_LIVE_EVENTS':
      liveEvents = [];
      return { success: true };
      
    case 'START_RECORDING_TAB':
      return await handleStartRecordingTab(message);
      
    case 'STOP_RECORDING_TAB':
      return await handleStopRecordingTab(message);
      
    case 'GET_RECORDING_STATUS_TAB':
      return await handleGetRecordingStatus(message);
      
    case 'INJECT_CONTENT_SCRIPT':
      return await handleInjectContentScript(message);
      
    case 'PING_TAB':
      return await handlePingTab(message);
      
    case 'PUBLISH_SESSION':
      // Forward publish request to sidebar
      chrome.runtime.sendMessage({ type: 'TRIGGER_PUBLISH' }).catch(() => {});
      return { success: true, message: 'Publish triggered' };
      
    default:
      console.log('[Recorder BG] Unknown message type:', message.type);
      return { success: false, error: 'Unknown message type' };
  }
}

// ============================================
// RECORDING HANDLERS
// ============================================

async function handleStartRecordingTab(message) {
  try {
    const result = await chrome.tabs.sendMessage(message.tabId, {
      type: 'START_RECORDING',
      mode: message.mode || 'training',
      config: message.config || {}
    });
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleStopRecordingTab(message) {
  try {
    const result = await chrome.tabs.sendMessage(message.tabId, { type: 'STOP_RECORDING' });
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleGetRecordingStatus(message) {
  try {
    const result = await chrome.tabs.sendMessage(message.tabId, { type: 'GET_RECORDING_STATUS' });
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleInjectContentScript(message) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      files: ['recorder.js']
    });
    await chrome.scripting.insertCSS({
      target: { tabId: message.tabId },
      files: ['recorder.css']
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handlePingTab(message) {
  try {
    console.log('[Recorder BG] Pinging tab:', message.tabId);
    const result = await chrome.tabs.sendMessage(message.tabId, { type: 'PING' });
    console.log('[Recorder BG] Ping response from tab:', result);
    return { success: true, ...result };
  } catch (error) {
    console.log('[Recorder BG] Ping tab failed:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================
// SESSION MANAGEMENT
// ============================================

async function saveTrainingSession(sessionData) {
  try {
    const token = await getAuthToken();
    // Use /training/upload endpoint which doesn't require auth
    const response = await fetch(`${CONFIG.API_URL}/training/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: JSON.stringify(sessionData),
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('[Recorder BG] Failed to save session:', error);
    // Store locally as backup
    const localSessions = await getLocalSessions();
    localSessions.push({ ...sessionData, savedLocally: true, savedAt: Date.now() });
    await chrome.storage.local.set({ 'fmd_training_sessions': localSessions });
    return { success: false, savedLocally: true, error: error.message };
  }
}

async function getLocalSessions() {
  const result = await chrome.storage.local.get('fmd_training_sessions');
  return result.fmd_training_sessions || [];
}

async function getAuthToken() {
  const result = await chrome.storage.local.get(CONFIG.AUTH_TOKEN_KEY);
  return result[CONFIG.AUTH_TOKEN_KEY] || null;
}

async function getBrowserId() {
  const result = await chrome.storage.local.get('fmd_browser_id');
  if (result.fmd_browser_id) return result.fmd_browser_id;
  const browserId = 'browser_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  await chrome.storage.local.set({ fmd_browser_id: browserId });
  return browserId;
}

// ============================================
// SIDE PANEL INITIALIZATION
// ============================================

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('[Recorder BG] Side panel error:', error));

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({ path: 'sidebar.html', enabled: true });
  console.log('[Recorder BG] Extension installed/updated');
});

// ============================================
// KEEPALIVE (start after everything is registered)
// ============================================

function startKeepalive() {
  console.log('[Recorder BG] Starting keepalive...');
  if (keepaliveInterval) clearInterval(keepaliveInterval);
  keepaliveInterval = setInterval(() => {
    console.log('[Recorder BG] Keepalive', new Date().toISOString());
  }, CONFIG.KEEPALIVE_INTERVAL);
}

// Start keepalive
startKeepalive();

console.log('[Recorder BG] ========================================');
console.log('[Recorder BG] Background script fully initialized');
console.log('[Recorder BG] ========================================');
