/**
 * FMD Training Recorder - Background Service Worker
 * SUPER ADMIN ROOT CONSOLE v2.1
 * 
 * Handles:
 * - Recording session management
 * - API communication with backend
 * - Training data storage and retrieval
 * - Side panel management
 * - Keepalive mechanism for service worker
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  API_URL: 'https://dealersface.com/api',
  // API_URL: 'http://localhost:5000/api',
  AUTH_TOKEN_KEY: 'fmd_admin_token',
  KEEPALIVE_INTERVAL: 20000, // 20 seconds keepalive
  HEARTBEAT_INTERVAL: 10000, // 10 seconds heartbeat to backend
};

// ============================================
// SERVICE WORKER KEEPALIVE
// This prevents the service worker from going to sleep
// ============================================

let keepaliveInterval = null;
let heartbeatInterval = null;

function startKeepalive() {
  console.log('[Recorder BG] Starting keepalive mechanism');
  
  // Clear existing intervals
  if (keepaliveInterval) clearInterval(keepaliveInterval);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  
  // Internal keepalive - just to keep service worker alive
  keepaliveInterval = setInterval(() => {
    console.log('[Recorder BG] Keepalive tick', new Date().toISOString());
  }, CONFIG.KEEPALIVE_INTERVAL);
  
  // Backend heartbeat - to maintain connection with IAI Panel
  heartbeatInterval = setInterval(sendHeartbeatToBackend, CONFIG.HEARTBEAT_INTERVAL);
  
  // Send initial heartbeat
  sendHeartbeatToBackend();
}

async function sendHeartbeatToBackend() {
  try {
    const token = await getAuthToken();
    const browserId = await getBrowserId();
    
    const response = await fetch(`${CONFIG.API_URL}/training/console/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: JSON.stringify({
        browserId,
        version: '2.1.0',
        currentTab: 'active',
        recordingActive: TabManager?.isRecording || false,
        timestamp: Date.now(),
      }),
    });
    
    if (response.ok) {
      console.log('[Recorder BG] Heartbeat sent successfully');
      // Broadcast to sidebar that connection is alive
      chrome.runtime.sendMessage({ 
        type: 'BACKEND_HEARTBEAT_SUCCESS',
        timestamp: Date.now()
      }).catch(() => {});
    } else {
      console.warn('[Recorder BG] Heartbeat failed:', response.status);
      logToBackend('error', 'Heartbeat failed', { status: response.status });
    }
  } catch (error) {
    console.error('[Recorder BG] Heartbeat error:', error.message);
    logToBackend('error', `Heartbeat error: ${error.message}`);
  }
}

/**
 * Log a message to the backend health log system
 */
async function logToBackend(type, message, data = null) {
  try {
    await fetch(`${CONFIG.API_URL}/training/console/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type,
        source: 'extension',
        message,
        data,
      }),
    });
  } catch (error) {
    console.error('[Recorder BG] Failed to log to backend:', error.message);
  }
}

async function getBrowserId() {
  const result = await chrome.storage.local.get('fmd_browser_id');
  if (result.fmd_browser_id) {
    return result.fmd_browser_id;
  }
  const browserId = 'browser_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  await chrome.storage.local.set({ fmd_browser_id: browserId });
  return browserId;
}

// Start keepalive when background script loads
startKeepalive();

// Log startup
logToBackend('connection', 'Extension background script started');

// ============================================
// SIDE PANEL INITIALIZATION
// ============================================

// Enable side panel when extension is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('[Recorder] Side panel error:', error));

// Set default side panel path
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({
    path: 'sidebar.html',
    enabled: true
  });
  console.log('[Recorder] Super Admin Console installed');
});

// ============================================
// STATE
// ============================================

let currentSession = null;
let liveEvents = [];

// ============================================
// API FUNCTIONS
// ============================================

async function getAuthToken() {
  const result = await chrome.storage.local.get(CONFIG.AUTH_TOKEN_KEY);
  return result[CONFIG.AUTH_TOKEN_KEY] || null;
}

async function apiRequest(endpoint, method = 'GET', data = null) {
  const token = await getAuthToken();
  
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
  
  const response = await fetch(`${CONFIG.API_URL}${endpoint}`, options);
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return response.json();
}

// ============================================
// SESSION MANAGEMENT
// ============================================

async function saveTrainingSession(sessionData) {
  try {
    const result = await apiRequest('/training/sessions', 'POST', sessionData);
    console.log('[Recorder BG] Session saved:', result);
    return result;
  } catch (error) {
    console.error('[Recorder BG] Failed to save session:', error);
    
    // Store locally as backup
    const localSessions = await getLocalSessions();
    localSessions.push({
      ...sessionData,
      savedLocally: true,
      savedAt: Date.now(),
    });
    await chrome.storage.local.set({ 'fmd_training_sessions': localSessions });
    
    return { success: false, savedLocally: true, error: error.message };
  }
}

async function getLocalSessions() {
  const result = await chrome.storage.local.get('fmd_training_sessions');
  return result.fmd_training_sessions || [];
}

async function syncLocalSessions() {
  const localSessions = await getLocalSessions();
  const unsyncedSessions = localSessions.filter(s => s.savedLocally);
  
  for (const session of unsyncedSessions) {
    try {
      await apiRequest('/training/sessions', 'POST', session);
      session.savedLocally = false;
      session.syncedAt = Date.now();
    } catch (error) {
      console.error('[Recorder BG] Failed to sync session:', error);
    }
  }
  
  await chrome.storage.local.set({ 'fmd_training_sessions': localSessions });
  return { synced: unsyncedSessions.filter(s => !s.savedLocally).length };
}

// ============================================
// MESSAGE HANDLERS
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const messageTime = new Date().toISOString();
  console.log(`[Recorder BG ${messageTime}] Message:`, message.type, 'from:', sender.tab?.id || 'sidebar');
  
  // Handle synchronous messages that need immediate response
  switch (message.type) {
    case 'PING':
      console.log('[Recorder BG] PING received - responding with PONG');
      sendResponse({ pong: true, timestamp: Date.now() });
      return true;
      
    case 'CONTENT_SCRIPT_READY':
      console.log('[Recorder BG] Content script ready on tab:', sender.tab?.id, 'url:', message.url);
      sendResponse({ acknowledged: true });
      return true;
      
    case 'HEALTH_CHECK':
      console.log('[Recorder BG] Health check received');
      sendResponse({ 
        alive: true, 
        timestamp: Date.now(),
        recording: TabManager?.isRecording || false,
        tabs: TabManager?.recordingTabs?.size || 0
      });
      return true;
  }
  
  // Handle async messages
  handleMessage(message, sender)
    .then(response => {
      console.log(`[Recorder BG] Response for ${message.type}:`, response);
      sendResponse(response);
    })
    .catch(error => {
      console.error(`[Recorder BG] Error handling ${message.type}:`, error);
      sendResponse({ success: false, error: error.message });
    });
  
  return true;
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'RECORDER_EVENT':
      // Live event from content script
      liveEvents.push(message.event);
      if (liveEvents.length > 500) {
        liveEvents = liveEvents.slice(-500);
      }
      
      // Forward event counts to sidebar
      if (message.counts) {
        try {
          chrome.runtime.sendMessage({
            type: 'EVENT_RECORDED',
            counts: message.counts
          }).catch(() => {}); // Ignore if sidebar not open
        } catch (e) {}
      }
      
      return { received: true };
      
    case 'SAVE_SESSION':
      const saveResult = await saveTrainingSession(message.sessionData);
      return saveResult;
      
    case 'GET_LIVE_EVENTS':
      return { events: liveEvents };
      
    case 'CLEAR_LIVE_EVENTS':
      liveEvents = [];
      return { success: true };
      
    case 'GET_TRAINING_SESSIONS':
      try {
        const sessions = await apiRequest('/training/sessions');
        return sessions;
      } catch (error) {
        const localSessions = await getLocalSessions();
        return { sessions: localSessions, fromLocal: true };
      }
      
    case 'GET_TRAINING_SESSION':
      const session = await apiRequest(`/training/sessions/${message.sessionId}`);
      return session;
      
    case 'DELETE_TRAINING_SESSION':
      await apiRequest(`/training/sessions/${message.sessionId}`, 'DELETE');
      return { success: true };
      
    case 'INJECT_TRAINING':
      // Send training data to IAI extension
      return await injectTrainingData(message.trainingData);
      
    case 'SYNC_LOCAL_SESSIONS':
      return await syncLocalSessions();
      
    case 'SET_AUTH_TOKEN':
      await chrome.storage.local.set({ [CONFIG.AUTH_TOKEN_KEY]: message.token });
      return { success: true };
      
    case 'CHECK_ADMIN':
      try {
        const user = await apiRequest('/auth/me');
        return { isAdmin: user.role === 'SUPER_ADMIN' || user.role === 'ADMIN', user };
      } catch (error) {
        return { isAdmin: false, error: error.message };
      }
    
    // MULTI-TAB RECORDING COMMANDS
    case 'START_MULTI_TAB_RECORDING':
      return await startMultiTabRecording(message.options || {});
      
    case 'STOP_MULTI_TAB_RECORDING':
      const multiTabData = await stopMultiTabRecording();
      return { success: true, data: multiTabData };
      
    case 'GET_MULTI_TAB_STATUS':
      return {
        isRecording: TabManager.isRecording,
        sessionId: TabManager.sessionId,
        tabCount: TabManager.recordingTabs.size,
        tabs: Array.from(TabManager.recordingTabs.entries()).map(([id, info]) => ({
          tabId: id,
          ...info,
        })),
        tabSequence: TabManager.tabSequence,
      };
      
    case 'GET_RECORDING_TABS':
      return {
        tabs: Array.from(TabManager.recordingTabs.entries()).map(([id, info]) => ({
          tabId: id,
          type: info.type,
          url: info.url,
          title: info.title,
          index: info.index,
        })),
      };
      
    case 'SWITCH_TO_TAB':
      // Switch to a specific tab
      if (message.tabId) {
        await chrome.tabs.update(message.tabId, { active: true });
        return { success: true, tabId: message.tabId };
      }
      return { success: false, error: 'No tabId provided' };
      
    case 'OPEN_NEW_TAB':
      // Open a new tab and start recording
      const newTab = await chrome.tabs.create({
        url: message.url || 'https://www.facebook.com/marketplace',
        active: message.active !== false,
      });
      return { success: true, tabId: newTab.id, url: newTab.url };
    
    // ========================================
    // SIDEBAR -> CONTENT SCRIPT RELAY HANDLERS
    // ========================================
    
    case 'PING_TAB':
      // Relay PING to content script
      console.log('[BG DEBUG] PING_TAB received for tab:', message.tabId);
      try {
        const pingResult = await chrome.tabs.sendMessage(message.tabId, { type: 'PING' });
        console.log('[BG DEBUG] PING response:', pingResult);
        return { success: true, pong: pingResult?.pong };
      } catch (error) {
        console.error('[BG DEBUG] PING_TAB error:', error);
        return { success: false, error: error.message };
      }
    
    case 'START_RECORDING_TAB':
      // Start recording on a specific tab
      console.log('[BG DEBUG] START_RECORDING_TAB received:', {
        tabId: message.tabId,
        mode: message.mode,
        config: message.config
      });
      try {
        console.log('[BG DEBUG] Sending START_RECORDING to tab', message.tabId);
        const startResult = await chrome.tabs.sendMessage(message.tabId, {
          type: 'START_RECORDING',
          mode: message.mode || 'training',
          config: message.config || {}
        });
        console.log('[BG DEBUG] START_RECORDING response from content script:', startResult);
        return startResult;
      } catch (error) {
        console.error('[BG DEBUG] START_RECORDING_TAB error:', error);
        return { success: false, error: error.message };
      }
    
    case 'STOP_RECORDING_TAB':
      // Stop recording on a specific tab
      console.log('[BG DEBUG] STOP_RECORDING_TAB received for tab:', message.tabId);
      try {
        const stopResult = await chrome.tabs.sendMessage(message.tabId, { type: 'STOP_RECORDING' });
        console.log('[BG DEBUG] STOP_RECORDING response:', stopResult);
        return stopResult;
        return stopResult;
      } catch (error) {
        return { success: false, error: error.message };
      }
    
    case 'PAUSE_RECORDING_TAB':
      // Pause recording on a specific tab
      try {
        const pauseResult = await chrome.tabs.sendMessage(message.tabId, { type: 'PAUSE_RECORDING' });
        return pauseResult;
      } catch (error) {
        return { success: false, error: error.message };
      }
    
    case 'RESUME_RECORDING_TAB':
      // Resume recording on a specific tab
      try {
        const resumeResult = await chrome.tabs.sendMessage(message.tabId, { type: 'RESUME_RECORDING' });
        return resumeResult;
      } catch (error) {
        return { success: false, error: error.message };
      }
    
    case 'ADD_MARKER_TAB':
      // Add marker on a specific tab
      try {
        const markerResult = await chrome.tabs.sendMessage(message.tabId, {
          type: 'ADD_MARKER',
          label: message.label
        });
        return markerResult;
      } catch (error) {
        return { success: false, error: error.message };
      }
    
    case 'GET_RECORDING_STATUS_TAB':
      // Get recording status from a specific tab
      console.log('[BG DEBUG] GET_RECORDING_STATUS_TAB for tab:', message.tabId);
      try {
        const statusResult = await chrome.tabs.sendMessage(message.tabId, { type: 'GET_RECORDING_STATUS' });
        console.log('[BG DEBUG] GET_RECORDING_STATUS_TAB response:', statusResult);
        return statusResult;
      } catch (error) {
        console.error('[BG DEBUG] GET_RECORDING_STATUS_TAB error:', error);
        return { success: false, error: error.message };
      }
    
    case 'INJECT_CONTENT_SCRIPT':
      // Inject content script into a tab
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
    
    case 'GET_ACTIVE_TAB':
      // Get the currently active tab
      console.log('[BG DEBUG] GET_ACTIVE_TAB received');
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log('[BG DEBUG] GET_ACTIVE_TAB result:', tab ? { id: tab.id, url: tab.url } : 'no tab');
        if (!tab) {
          // Fallback: try to get any visible tab
          const [visibleTab] = await chrome.tabs.query({ status: 'complete', windowType: 'normal' });
          console.log('[BG DEBUG] Fallback visible tab:', visibleTab ? { id: visibleTab.id, url: visibleTab.url } : 'no tab');
          return { success: !!visibleTab, tab: visibleTab };
        }
        return { success: true, tab };
      } catch (error) {
        console.error('[BG DEBUG] GET_ACTIVE_TAB error:', error);
        return { success: false, error: error.message };
      }
    
    case 'GET_FACEBOOK_TABS':
      // Get all Facebook tabs
      try {
        const fbTabs = await chrome.tabs.query({ url: '*://*.facebook.com/*' });
        return { success: true, tabs: fbTabs };
      } catch (error) {
        return { success: false, error: error.message };
      }
      
    default:
      return { success: false, error: 'Unknown message type' };
  }
}

// ============================================
// TRAINING INJECTION
// ============================================

async function injectTrainingData(trainingData) {
  try {
    // Find the main FMD extension tab
    const tabs = await chrome.tabs.query({ url: '*://*.facebook.com/*' });
    
    if (tabs.length === 0) {
      return { success: false, error: 'No Facebook tabs found' };
    }
    
    // Send training data to each tab
    const results = [];
    for (const tab of tabs) {
      try {
        const result = await chrome.tabs.sendMessage(tab.id, {
          type: 'INJECT_TRAINING_DATA',
          trainingData: trainingData,
        });
        results.push({ tabId: tab.id, success: true, result });
      } catch (error) {
        results.push({ tabId: tab.id, success: false, error: error.message });
      }
    }
    
    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================
// MULTI-TAB MANAGEMENT
// ============================================

// Track recording state across tabs
const TabManager = {
  isRecording: false,
  sessionId: null,
  recordingTabs: new Map(), // tabId -> { index, type, url, events }
  tabSequence: [],          // Order of tab switches
  allEvents: [],            // All events from all tabs (merged)
};

/**
 * Start recording across all Facebook tabs
 */
async function startMultiTabRecording(options = {}) {
  const tabs = await chrome.tabs.query({ url: '*://*.facebook.com/*' });
  
  TabManager.isRecording = true;
  TabManager.sessionId = `session_${Date.now()}`;
  TabManager.recordingTabs.clear();
  TabManager.tabSequence = [];
  TabManager.allEvents = [];
  
  let tabIndex = 0;
  for (const tab of tabs) {
    try {
      // Set tab info in content script
      await chrome.tabs.sendMessage(tab.id, {
        type: 'SET_TAB_INFO',
        tabId: tab.id,
        tabIndex: tabIndex,
      });
      
      // Start recording
      await chrome.tabs.sendMessage(tab.id, {
        type: 'START_RECORDING',
        options: options,
      });
      
      TabManager.recordingTabs.set(tab.id, {
        index: tabIndex,
        type: detectTabTypeFromUrl(tab.url),
        url: tab.url,
        title: tab.title,
        events: [],
      });
      
      tabIndex++;
    } catch (error) {
      console.error(`[Recorder BG] Failed to start recording in tab ${tab.id}:`, error);
    }
  }
  
  console.log(`[Recorder BG] Multi-tab recording started: ${TabManager.recordingTabs.size} tabs`);
  
  return {
    success: true,
    sessionId: TabManager.sessionId,
    tabCount: TabManager.recordingTabs.size,
    tabs: Array.from(TabManager.recordingTabs.entries()).map(([id, info]) => ({
      tabId: id,
      ...info,
    })),
  };
}

/**
 * Stop recording across all tabs and compile data
 */
async function stopMultiTabRecording() {
  const allTabData = {};
  
  for (const [tabId, tabInfo] of TabManager.recordingTabs) {
    try {
      const result = await chrome.tabs.sendMessage(tabId, {
        type: 'STOP_RECORDING',
      });
      
      if (result.success && result.data) {
        allTabData[tabId] = {
          ...tabInfo,
          sessionData: result.data,
        };
      }
    } catch (error) {
      console.error(`[Recorder BG] Failed to stop recording in tab ${tabId}:`, error);
    }
  }
  
  // Compile multi-tab session
  const multiTabSession = compileMultiTabSession(allTabData);
  
  TabManager.isRecording = false;
  TabManager.recordingTabs.clear();
  
  return multiTabSession;
}

/**
 * Compile data from multiple tabs into a unified session
 */
function compileMultiTabSession(allTabData) {
  const session = {
    sessionId: TabManager.sessionId,
    isMultiTab: true,
    startTime: null,
    endTime: Date.now(),
    duration: 0,
    
    // Tab data
    tabs: {},
    tabSequence: TabManager.tabSequence,
    tabCount: Object.keys(allTabData).length,
    
    // Merged events (sorted by timestamp)
    allEvents: [],
    totalEvents: 0,
    
    // Merged marked elements
    allMarkedElements: [],
    
    // Per-tab summaries
    tabSummaries: {},
  };
  
  // Merge data from all tabs
  for (const [tabId, tabData] of Object.entries(allTabData)) {
    const sessionData = tabData.sessionData;
    
    if (sessionData) {
      // Store tab-specific data
      session.tabs[tabId] = {
        tabId: tabId,
        type: tabData.type,
        url: tabData.url,
        title: tabData.title,
        events: sessionData.events || [],
        markedElements: sessionData.markedElements || [],
        patterns: sessionData.patterns,
        automationCode: sessionData.automationCode,
      };
      
      // Merge events
      if (sessionData.events) {
        session.allEvents.push(...sessionData.events);
      }
      
      // Merge marked elements
      if (sessionData.markedElements) {
        session.allMarkedElements.push(...sessionData.markedElements.map(m => ({
          ...m,
          tabId: tabId,
          tabType: tabData.type,
        })));
      }
      
      // Track timing
      if (!session.startTime || sessionData.startTime < session.startTime) {
        session.startTime = sessionData.startTime;
      }
      
      // Tab summary
      session.tabSummaries[tabId] = {
        type: tabData.type,
        url: tabData.url,
        eventCount: sessionData.events?.length || 0,
        markedCount: sessionData.markedElements?.length || 0,
        duration: sessionData.duration,
      };
    }
  }
  
  // Sort all events by timestamp
  session.allEvents.sort((a, b) => a.timestamp - b.timestamp);
  session.totalEvents = session.allEvents.length;
  session.duration = session.endTime - (session.startTime || session.endTime);
  
  return session;
}

/**
 * Detect tab type from URL
 */
function detectTabTypeFromUrl(url) {
  if (!url) return 'unknown';
  
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('/marketplace/create')) return 'marketplace-create';
  if (urlLower.includes('/marketplace/item')) return 'marketplace-item';
  if (urlLower.includes('/marketplace')) return 'marketplace';
  if (urlLower.includes('/messages')) return 'messages';
  if (urlLower.includes('/groups')) return 'groups';
  if (urlLower.includes('/profile')) return 'profile';
  
  return 'facebook-other';
}

// ============================================
// TAB EVENT LISTENERS
// ============================================

// Track tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (!TabManager.isRecording) return;
  
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (!tab.url?.includes('facebook.com')) return;
  
  // Notify the tab it was activated
  try {
    await chrome.tabs.sendMessage(activeInfo.tabId, {
      type: 'TAB_ACTIVATED',
      tabId: activeInfo.tabId,
    });
    
    TabManager.tabSequence.push({
      action: 'activated',
      tabId: activeInfo.tabId,
      url: tab.url,
      timestamp: Date.now(),
    });
  } catch (error) {
    // Tab might not have content script yet
  }
});

// Track new tab creation
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!TabManager.isRecording) return;
  
  // Wait for URL to be set
  setTimeout(async () => {
    const updatedTab = await chrome.tabs.get(tab.id).catch(() => null);
    if (!updatedTab?.url?.includes('facebook.com')) return;
    
    // Inject content script and start recording
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['recorder.js'],
      });
      
      await chrome.tabs.sendMessage(tab.id, {
        type: 'SET_TAB_INFO',
        tabId: tab.id,
        tabIndex: TabManager.recordingTabs.size,
      });
      
      await chrome.tabs.sendMessage(tab.id, {
        type: 'START_RECORDING',
        options: { continueSession: true },
      });
      
      TabManager.recordingTabs.set(tab.id, {
        index: TabManager.recordingTabs.size,
        type: detectTabTypeFromUrl(updatedTab.url),
        url: updatedTab.url,
        title: updatedTab.title,
        events: [],
      });
      
      // Notify existing tabs
      for (const [existingTabId] of TabManager.recordingTabs) {
        if (existingTabId !== tab.id) {
          chrome.tabs.sendMessage(existingTabId, {
            type: 'TAB_CREATED',
            newTabId: tab.id,
            openerTabId: tab.openerTabId,
            url: updatedTab.url,
          }).catch(() => {});
        }
      }
      
      TabManager.tabSequence.push({
        action: 'created',
        tabId: tab.id,
        url: updatedTab.url,
        openerTabId: tab.openerTabId,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[Recorder BG] Failed to start recording in new tab:', error);
    }
  }, 1000);
});

// Track tab close
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (!TabManager.isRecording) return;
  
  if (TabManager.recordingTabs.has(tabId)) {
    TabManager.recordingTabs.delete(tabId);
    
    TabManager.tabSequence.push({
      action: 'closed',
      tabId: tabId,
      timestamp: Date.now(),
    });
    
    // Notify remaining tabs
    for (const [existingTabId] of TabManager.recordingTabs) {
      chrome.tabs.sendMessage(existingTabId, {
        type: 'TAB_CLOSED',
        tabId: tabId,
      }).catch(() => {});
    }
  }
});

// Track tab URL changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!TabManager.isRecording) return;
  if (!changeInfo.url) return;
  
  if (TabManager.recordingTabs.has(tabId)) {
    const tabInfo = TabManager.recordingTabs.get(tabId);
    tabInfo.url = changeInfo.url;
    tabInfo.type = detectTabTypeFromUrl(changeInfo.url);
  }
});

// ============================================
// EXTENSION LIFECYCLE
// ============================================

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Recorder BG] FMD Training Recorder installed');
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[Recorder BG] FMD Training Recorder started');
  syncLocalSessions().catch(console.error);
});

// ============================================
// CONTEXT MENU
// ============================================

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'fmd-mark-field',
    title: 'Mark as Field...',
    contexts: ['all'],
    documentUrlPatterns: ['*://*.facebook.com/*'],
  });
  
  // Field type submenu
  const fieldTypes = [
    'vehicleType', 'year', 'make', 'model', 'trim',
    'price', 'mileage', 'bodyStyle', 'exteriorColor',
    'transmission', 'fuelType', 'condition', 'description',
    'photos', 'publish', 'next', 'location'
  ];
  
  for (const fieldType of fieldTypes) {
    chrome.contextMenus.create({
      id: `fmd-mark-${fieldType}`,
      parentId: 'fmd-mark-field',
      title: fieldType,
      contexts: ['all'],
      documentUrlPatterns: ['*://*.facebook.com/*'],
    });
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId.startsWith('fmd-mark-')) {
    const fieldType = info.menuItemId.replace('fmd-mark-', '');
    
    // Get the clicked element from the content script
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'MARK_CLICKED_ELEMENT',
        fieldType: fieldType,
      });
    } catch (error) {
      console.error('[Recorder BG] Failed to mark element:', error);
    }
  }
});
