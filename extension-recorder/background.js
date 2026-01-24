/**
 * FMD Training Recorder - Background Service Worker
 * 
 * Handles:
 * - Recording session management
 * - API communication with backend
 * - Training data storage and retrieval
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  API_URL: 'https://dealersface.com/api',
  // API_URL: 'http://localhost:5000/api',
  AUTH_TOKEN_KEY: 'fmd_admin_token',
};

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
  console.log('[Recorder BG] Message:', message.type);
  
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(error => sendResponse({ success: false, error: error.message }));
  
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
