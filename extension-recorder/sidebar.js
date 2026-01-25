/**
 * SUPER ADMIN ROOT CONSOLE - SIDEBAR CONTROLLER
 * Futuristic cyberpunk interface for training recorder
 * v2.0 - Fully Functional Implementation
 */

// ============================================
// STATE MANAGEMENT
// ============================================

const ConsoleState = {
  isRecording: false,
  isPaused: false,
  currentMode: 'training',
  currentTab: 'record',
  sessionData: null,
  recordingTabId: null,
  eventCounts: { events: 0, clicks: 0, inputs: 0, marks: 0 },
  activeTabs: [],
  logs: [],
  savedSessions: [],
  config: {
    autoMark: true,
    captureScrolls: true,
    recordHovers: false,
    stealthMode: true,
    apiEndpoint: 'https://dealersface.com/api',
    healthEndpoint: 'https://dealersface.com/health',
    maxLogLines: 50
  },
  // Connection state
  webappConnected: false,
  contentScriptReady: false,
  lastHeartbeat: null,
  connectionRetries: 0,
  maxRetries: 5,
  // Rate limiting backoff
  heartbeatBackoffUntil: null,
  heartbeatFailCount: 0
};

// Heartbeat interval
let heartbeatInterval = null;
let connectionCheckInterval = null;

// ============================================
// DOM REFERENCES
// ============================================

let DOM = {};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Console] Initializing Super Admin Console...');
  
  initializeDOMReferences();
  initializeEventListeners();
  initializeResizing();
  startClock();
  await loadConfig();
  await loadSavedSessions();
  
  log('System initialized', 'success');
  
  // Test background script connection immediately
  try {
    console.log('[Console] Testing background script connection...');
    const testResponse = await sendMessageWithTimeout({ type: 'GET_ACTIVE_TAB' }, 3000);
    console.log('[Console] Background script test response:', testResponse);
    log('Background script connected', 'success');
  } catch (bgError) {
    console.error('[Console] Background script not responding:', bgError);
    log('Background script not responding - try reloading extension', 'error');
  }
  
  // Check and display current auth status
  const tokenCheck = await chrome.storage.local.get(['fmd_admin_token', 'fmd_token_synced_at']);
  if (tokenCheck.fmd_admin_token) {
    const age = tokenCheck.fmd_token_synced_at ? Math.round((Date.now() - tokenCheck.fmd_token_synced_at) / 1000) : null;
    console.log('[Console] Cached token found, age:', age, 'seconds');
    updateAuthStatusUI(true, age ? (age < 300 ? 'FRESH' : 'CACHED') : 'CACHED');
  } else {
    updateAuthStatusUI(false, 'NONE');
  }
  
  // Sync auth token from webapp
  await syncAuthTokenFromWebapp();
  
  // Start connection checks
  startConnectionMonitoring();
  
  // Check if content script is available on current tab
  await checkContentScriptStatus();
  
  log('Ready for recording operations', 'info');
});

/**
 * Send message to background with timeout
 */
async function sendMessageWithTimeout(message, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Message timeout after ${timeoutMs}ms for type: ${message.type}`));
    }, timeoutMs);
    
    chrome.runtime.sendMessage(message, (response) => {
      clearTimeout(timeout);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function initializeDOMReferences() {
  DOM = {
    // Header
    statusIndicator: document.getElementById('status-indicator'),
    statusText: document.getElementById('status-text'),
    systemClock: document.getElementById('system-clock'),
    collapseBtn: document.getElementById('collapse-btn'),
    
    // Navigation
    navTabs: document.querySelectorAll('.nav-tab'),
    tabPanels: document.querySelectorAll('.tab-panel'),
    
    // Mode selector
    modeCards: document.querySelectorAll('.mode-card'),
    
    // Record controls
    recordBtn: document.getElementById('record-btn'),
    recordIcon: document.getElementById('record-icon'),
    recordText: document.getElementById('record-text'),
    pauseBtn: document.getElementById('pause-btn'),
    markBtn: document.getElementById('mark-btn'),
    
    // Live Console (on record tab)
    liveConsole: document.getElementById('live-console'),
    liveConsoleContainer: document.getElementById('live-console-container'),
    consoleCount: document.getElementById('console-count'),
    
    // Stats
    liveStats: document.getElementById('live-stats'),
    statEvents: document.getElementById('stat-events'),
    statClicks: document.getElementById('stat-clicks'),
    statInputs: document.getElementById('stat-inputs'),
    statMarks: document.getElementById('stat-marks'),
    
    // Tabs section
    activeTabsSection: document.getElementById('active-tabs-section'),
    activeTabsList: document.getElementById('active-tabs-list'),
    
    // Session output
    sessionOutput: document.getElementById('session-output'),
    sessionJson: document.getElementById('session-json'),
    copyBtn: document.getElementById('copy-btn'),
    exportBtn: document.getElementById('export-btn'),
    uploadBtn: document.getElementById('upload-btn'),
    
    // Sessions list
    sessionsList: document.getElementById('sessions-list'),
    
    // Logs
    logsContainer: document.getElementById('logs-container'),
    clearLogsBtn: document.getElementById('clear-logs'),
    
    // Sidebar
    sidebarMinimized: document.getElementById('sidebar-minimized'),
    expandBtn: document.getElementById('expand-btn'),
    expandBadge: document.getElementById('expand-badge'),
    consoleWrapper: document.querySelector('.console-wrapper'),
    resizeHandle: document.getElementById('resize-handle'),
    sidebarContainer: document.querySelector('.sidebar-container')
  };
}

function initializeEventListeners() {
  // Navigation
  DOM.navTabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  
  // Mode selection
  DOM.modeCards.forEach(card => {
    card.addEventListener('click', () => selectMode(card.dataset.mode));
  });
  
  // Record controls
  DOM.recordBtn?.addEventListener('click', toggleRecording);
  DOM.pauseBtn?.addEventListener('click', togglePause);
  DOM.markBtn?.addEventListener('click', addMarker);
  
  // Session output
  DOM.copyBtn?.addEventListener('click', copySessionData);
  DOM.exportBtn?.addEventListener('click', exportSessionData);
  DOM.uploadBtn?.addEventListener('click', uploadSessionData);
  
  // Logs
  DOM.clearLogsBtn?.addEventListener('click', clearLogs);
  DOM.logsContainer?.addEventListener('click', handleLogClick);
  document.getElementById('copy-all-logs')?.addEventListener('click', copyAllLogs);
  
  // Collapse/Expand
  DOM.collapseBtn?.addEventListener('click', collapseSidebar);
  DOM.expandBtn?.addEventListener('click', expandSidebar);
  
  // Config toggles
  document.getElementById('config-automark')?.addEventListener('change', (e) => {
    ConsoleState.config.autoMark = e.target.checked;
    saveConfig();
    log(`Auto-mark ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
  });
  document.getElementById('config-scrolls')?.addEventListener('change', (e) => {
    ConsoleState.config.captureScrolls = e.target.checked;
    saveConfig();
    log(`Scroll capture ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
  });
  document.getElementById('config-hovers')?.addEventListener('change', (e) => {
    ConsoleState.config.recordHovers = e.target.checked;
    saveConfig();
    log(`Hover recording ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
  });
  document.getElementById('config-stealth')?.addEventListener('change', (e) => {
    ConsoleState.config.stealthMode = e.target.checked;
    saveConfig();
    log(`Stealth mode ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
  });
  
  // Log lines config
  document.getElementById('config-log-lines')?.addEventListener('change', (e) => {
    ConsoleState.config.maxLogLines = parseInt(e.target.value) || 50;
    saveConfig();
    trimLogs();
    log(`Log limit set to ${ConsoleState.config.maxLogLines} lines`, 'info');
  });
  
  // API test
  document.getElementById('test-api-btn')?.addEventListener('click', testApiConnection);
  document.getElementById('api-endpoint')?.addEventListener('change', (e) => {
    ConsoleState.config.apiEndpoint = e.target.value;
    saveConfig();
  });
  
  // Sync token button
  document.getElementById('sync-token-btn')?.addEventListener('click', async () => {
    log('Manual token sync requested...', 'info');
    await forceSyncAuthToken();
  });
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(handleBackgroundMessage);
}

// ============================================
// CONTENT SCRIPT STATUS CHECK
// ============================================

async function checkContentScriptStatus() {
  try {
    // Use background to get active tab
    const tabResponse = await chrome.runtime.sendMessage({ type: 'GET_ACTIVE_TAB' });
    if (!tabResponse?.success || !tabResponse.tab) {
      log('No active tab detected', 'warning');
      return false;
    }
    
    const tab = tabResponse.tab;
    
    // Check if this is a Facebook page
    if (!tab.url?.includes('facebook.com')) {
      log('Navigate to Facebook to enable recording', 'warning');
      updateStatusIndicator('warning', 'NAVIGATE TO FACEBOOK');
      return false;
    }
    
    // Try to ping the content script via background
    try {
      const response = await chrome.runtime.sendMessage({ 
        type: 'PING_TAB', 
        tabId: tab.id 
      });
      if (response?.pong) {
        log(`Content script active on tab ${tab.id}`, 'success');
        updateStatusIndicator('ready', 'SYSTEM READY');
        ConsoleState.recordingTabId = tab.id;
        return true;
      }
    } catch (e) {
      // Content script not loaded, try to inject it
      log('Injecting content script...', 'info');
      await injectContentScript(tab.id);
      return true;
    }
  } catch (error) {
    log(`Status check failed: ${error.message}`, 'error');
    return false;
  }
}

async function injectContentScript(tabId) {
  try {
    // Use background script to inject
    const result = await chrome.runtime.sendMessage({
      type: 'INJECT_CONTENT_SCRIPT',
      tabId
    });
    
    if (!result?.success) {
      throw new Error(result?.error || 'Injection failed');
    }
    
    // Wait a bit then verify
    await new Promise(r => setTimeout(r, 500));
    
    const response = await chrome.runtime.sendMessage({ 
      type: 'PING_TAB', 
      tabId 
    });
    if (response?.pong) {
      log('Content script injected successfully', 'success');
      updateStatusIndicator('ready', 'SYSTEM READY');
      ConsoleState.recordingTabId = tabId;
      return true;
    }
  } catch (error) {
    log(`Injection failed: ${error.message}`, 'error');
    updateStatusIndicator('error', 'INJECTION FAILED');
    return false;
  }
}

function updateStatusIndicator(status, text) {
  if (!DOM.statusIndicator || !DOM.statusText) return;
  
  DOM.statusIndicator.className = 'status-indicator';
  
  switch (status) {
    case 'recording':
      DOM.statusIndicator.classList.add('recording');
      break;
    case 'warning':
      DOM.statusIndicator.classList.add('warning');
      break;
    case 'error':
      DOM.statusIndicator.classList.add('error');
      break;
    case 'ready':
    default:
      // Default ready state
      break;
  }
  
  DOM.statusText.textContent = text;
}

// ============================================
// RESIZING
// ============================================

let isResizing = false;
let startX = 0;
let startWidth = 0;

function initializeResizing() {
  if (!DOM.resizeHandle) return;
  
  DOM.resizeHandle.addEventListener('mousedown', startResize);
  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', stopResize);
}

function startResize(e) {
  isResizing = true;
  startX = e.clientX;
  startWidth = DOM.sidebarContainer?.offsetWidth || 320;
  document.body.style.cursor = 'ew-resize';
  document.body.style.userSelect = 'none';
}

function handleResize(e) {
  if (!isResizing || !DOM.sidebarContainer) return;
  
  const delta = startX - e.clientX;
  const newWidth = Math.max(280, Math.min(500, startWidth + delta));
  DOM.sidebarContainer.style.width = `${newWidth}px`;
}

function stopResize() {
  if (isResizing) {
    isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
}

// ============================================
// NAVIGATION
// ============================================

function switchTab(tabId) {
  ConsoleState.currentTab = tabId;
  
  // Update nav
  DOM.navTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabId);
  });
  
  // Update panels
  DOM.tabPanels.forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-${tabId}`);
  });
  
  log(`Switched to ${tabId.toUpperCase()} tab`, 'info');
}

// ============================================
// MODE SELECTION
// ============================================

function selectMode(mode) {
  if (ConsoleState.isRecording) {
    log('Cannot change mode while recording', 'warning');
    return;
  }
  
  ConsoleState.currentMode = mode;
  
  DOM.modeCards.forEach(card => {
    card.classList.toggle('active', card.dataset.mode === mode);
  });
  
  // Show/hide multi-tab section
  if (DOM.activeTabsSection) {
    DOM.activeTabsSection.style.display = mode === 'multi-tab' ? 'block' : 'none';
  }
  
  log(`Mode set to: ${mode.toUpperCase()}`, 'info');
}

// ============================================
// RECORDING CONTROLS
// ============================================

async function toggleRecording() {
  console.log('[DEBUG TOGGLE] toggleRecording called, isRecording:', ConsoleState.isRecording);
  log(`Toggle recording clicked - currently ${ConsoleState.isRecording ? 'recording' : 'not recording'}`, 'info');
  
  // Prevent double-clicks
  DOM.recordBtn.disabled = true;
  
  try {
    if (ConsoleState.isRecording) {
      console.log('[DEBUG TOGGLE] Calling stopRecording...');
      await stopRecording();
    } else {
      console.log('[DEBUG TOGGLE] Calling startRecording...');
      await startRecording();
    }
  } catch (error) {
    console.error('[DEBUG TOGGLE] Error in toggleRecording:', error);
    log(`Toggle recording error: ${error.message}`, 'error');
  } finally {
    console.log('[DEBUG TOGGLE] Re-enabling button');
    DOM.recordBtn.disabled = false;
  }
}

async function startRecording() {
  console.log('[DEBUG START] startRecording called');
  try {
    log('Initiating recording sequence...', 'info');
    console.log('[DEBUG START] Step 1: Updating status indicator');
    updateStatusIndicator('loading', 'INITIALIZING...');
    
    // Wake up background script first with a ping
    console.log('[DEBUG START] Step 1.5: Waking up background script...');
    try {
      const pingResponse = await sendMessageWithTimeout({ type: 'PING' }, 2000);
      console.log('[DEBUG START] Background woke up:', pingResponse);
    } catch (pingErr) {
      console.warn('[DEBUG START] Background ping failed, continuing anyway:', pingErr.message);
    }
    
    // Check webapp connection first (with short timeout)
    log('Checking webapp connection...', 'info');
    console.log('[DEBUG START] Step 2: Checking webapp connection');
    try {
      const connected = await Promise.race([
        checkWebappConnection(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection check timeout')), 3000))
      ]);
      if (connected) {
        log('Webapp connection confirmed', 'success');
        console.log('[DEBUG START] Webapp connected:', connected);
      }
    } catch (connErr) {
      log('Webapp offline - recordings will be saved locally', 'warning');
      console.log('[DEBUG START] Webapp connection failed:', connErr.message);
    }
    
    // Get current tab via background
    log('Requesting active tab info...', 'info');
    console.log('[DEBUG START] Step 3: Getting active tab');
    updateStatusIndicator('loading', 'GETTING TAB...');
    
    let tabResponse;
    try {
      // Use the new sendMessageWithTimeout for better error handling
      console.log('[DEBUG START] Sending GET_ACTIVE_TAB via sendMessageWithTimeout...');
      tabResponse = await sendMessageWithTimeout({ type: 'GET_ACTIVE_TAB' }, 8000); // Increased timeout
      console.log('[DEBUG START] Tab response:', tabResponse);
    } catch (tabError) {
      console.error('[DEBUG START] GET_ACTIVE_TAB error:', tabError);
      log(`Tab query error: ${tabError.message}`, 'error');
      
      // Fallback: Try to get Facebook tabs directly
      log('Trying fallback: querying Facebook tabs...', 'info');
      updateStatusIndicator('loading', 'FINDING FACEBOOK...');
      try {
        const fbResponse = await sendMessageWithTimeout({ type: 'GET_FACEBOOK_TABS' }, 8000); // Increased timeout
        console.log('[DEBUG START] Facebook tabs fallback:', fbResponse);
        if (fbResponse?.success && fbResponse.tabs?.length > 0) {
          tabResponse = { success: true, tab: fbResponse.tabs[0] };
          log(`Found Facebook tab via fallback: ${fbResponse.tabs[0].url?.substring(0, 40)}...`, 'success');
        } else {
          log('No Facebook tabs found - please open Facebook first', 'error');
          updateStatusIndicator('error', 'OPEN FACEBOOK FIRST');
          return;
        }
      } catch (fbError) {
        console.error('[DEBUG START] Facebook tabs fallback error:', fbError);
        log(`Fallback failed: ${fbError.message}`, 'error');
        updateStatusIndicator('error', 'TAB QUERY FAILED');
        return;
      }
    }
    
    console.log('[Console] Tab response:', tabResponse);
    
    if (!tabResponse?.success || !tabResponse.tab) {
      log('No active tab found - check browser permissions', 'error');
      updateStatusIndicator('error', 'NO TAB FOUND');
      return;
    }
    
    const currentTab = tabResponse.tab;
    log(`Active tab: ${currentTab.url?.substring(0, 50)}...`, 'info');
    
    // Check if Facebook
    if (!currentTab.url?.includes('facebook.com')) {
      log('Navigate to Facebook to start recording', 'error');
      updateStatusIndicator('warning', 'NAVIGATE TO FACEBOOK');
      return;
    }
    
    ConsoleState.recordingTabId = currentTab.id;
    log(`Tab ID: ${currentTab.id}`, 'info');
    
    // Ensure content script is loaded
    log('Injecting content script...', 'info');
    updateStatusIndicator('loading', 'INJECTING SCRIPT...');
    
    const scriptReady = await ensureContentScript(currentTab.id);
    
    if (!scriptReady) {
      log('Failed to initialize content script - try refreshing the page', 'error');
      updateStatusIndicator('error', 'SCRIPT INJECTION FAILED');
      return;
    }
    
    log('Content script ready', 'success');
    ConsoleState.contentScriptReady = true;
    updateStatusIndicator('loading', 'STARTING RECORDING...');
    
    // Start recording based on mode
    log(`Starting ${ConsoleState.currentMode.toUpperCase()} mode recording...`, 'info');
    
    if (ConsoleState.currentMode === 'multi-tab') {
      await startMultiTabRecording();
    } else {
      await startSingleTabRecording(currentTab);
    }
    
  } catch (error) {
    log(`Recording failed: ${error.message}`, 'error');
    console.error('Start recording error:', error);
    updateRecordingUI(false);
    updateStatusIndicator('error', 'RECORDING FAILED');
  }
}

async function ensureContentScript(tabId, retryCount = 0) {
  const MAX_RETRIES = 2;
  
  console.log('[Console] ensureContentScript called for tab:', tabId, 'retry:', retryCount);
  
  try {
    // Try to ping first via background
    log(`Pinging content script on tab ${tabId}...`, 'info');
    updateScriptConnectionUI('seeking');
    
    // Use sendMessageWithTimeout for ping
    let response;
    try {
      response = await sendMessageWithTimeout({ 
        type: 'PING_TAB', 
        tabId 
      }, 2000);
      console.log('[Console] Ping response:', response);
    } catch (pingError) {
      console.log('[Console] Ping timeout/error:', pingError.message);
      response = { timeout: true, error: pingError.message };
    }
    
    if (response?.success && response?.pong) {
      log('Content script responded to ping', 'success');
      updateScriptConnectionUI('ready');
      return true;
    } else if (response?.timeout) {
      log('Ping timed out, script may not be loaded', 'warning');
    } else if (response?.error) {
      log(`Ping failed: ${response.error}`, 'warning');
    }
  } catch (e) {
    console.error('[Console] Ping exception:', e);
    log(`Ping exception: ${e.message}`, 'warning');
  }
  
  // Need to inject
  log('Content script not responding, attempting injection...', 'info');
  updateScriptConnectionUI('injecting');
  
  try {
    // Use background to inject with timeout
    console.log('[Console] Sending INJECT_CONTENT_SCRIPT for tab:', tabId);
    const result = await sendMessageWithTimeout({
      type: 'INJECT_CONTENT_SCRIPT',
      tabId
    }, 5000);
    console.log('[Console] Injection result:', result);
    
    if (!result?.success) {
      const errorMsg = result?.error || 'Unknown error';
      log(`Injection failed: ${errorMsg}`, 'error');
      
      // Retry if not at max retries
      if (retryCount < MAX_RETRIES && !errorMsg.includes('Cannot access')) {
        log(`Retrying injection (${retryCount + 1}/${MAX_RETRIES})...`, 'warning');
        await new Promise(r => setTimeout(r, 1000));
        return ensureContentScript(tabId, retryCount + 1);
      }
      
      updateScriptConnectionUI('error');
      throw new Error(errorMsg);
    }
    
    log('Scripts injected, waiting for initialization...', 'info');
    
    // Wait for script to initialize (slightly longer)
    await new Promise(r => setTimeout(r, 800));
    
    // Verify injection via background with timeout
    log('Verifying injection...', 'info');
    let verifyResponse;
    try {
      verifyResponse = await sendMessageWithTimeout({ 
        type: 'PING_TAB', 
        tabId 
      }, 3000);
    } catch (verifyError) {
      console.log('[Console] Verification timeout:', verifyError.message);
      verifyResponse = { timeout: true };
    }
    
    console.log('[Console] Post-injection ping:', verifyResponse);
    
    if (verifyResponse?.success && verifyResponse?.pong) {
      log('Content script injection verified', 'success');
      updateScriptConnectionUI('ready');
      return true;
    } else {
      // Retry if not at max retries
      if (retryCount < MAX_RETRIES) {
        log(`Verification failed, retrying (${retryCount + 1}/${MAX_RETRIES})...`, 'warning');
        await new Promise(r => setTimeout(r, 1000));
        return ensureContentScript(tabId, retryCount + 1);
      }
      
      log('Content script not responding after injection', 'error');
      updateScriptConnectionUI('error');
      return false;
    }
    
  } catch (error) {
    log(`Script injection error: ${error.message}`, 'error');
    console.error('[Console] Injection error:', error);
    updateScriptConnectionUI('error');
    return false;
  }
}

async function startSingleTabRecording(tab) {
  console.log('[DEBUG SINGLE TAB] startSingleTabRecording called for tab:', tab.id, tab.url);
  try {
    log(`Sending START_RECORDING to tab ${tab.id}...`, 'info');
    
    console.log('[DEBUG SINGLE TAB] Preparing message:', {
      type: 'START_RECORDING_TAB',
      tabId: tab.id,
      mode: ConsoleState.currentMode,
      config: ConsoleState.config
    });
    
    // Send message via background with proper timeout handling
    let response;
    try {
      response = await sendMessageWithTimeout({
        type: 'START_RECORDING_TAB',
        tabId: tab.id,
        mode: ConsoleState.currentMode,
        config: ConsoleState.config
      }, 5000);
      console.log('[Console] Start recording response:', response);
    } catch (startError) {
      console.error('[Console] Start recording timeout/error:', startError);
      log(`Recording start error: ${startError.message}`, 'error');
      
      // Try re-injecting and starting again
      log('Retrying after re-injection...', 'warning');
      await ensureContentScript(tab.id);
      try {
        response = await sendMessageWithTimeout({
          type: 'START_RECORDING_TAB',
          tabId: tab.id,
          mode: ConsoleState.currentMode,
          config: ConsoleState.config
        }, 5000);
      } catch (retryError) {
        throw new Error('Failed after retry - refresh the Facebook page and try again');
      }
    }
    
    if (!response) {
      log('No response from content script - retrying injection...', 'warning');
      // Try re-injecting and starting again
      await ensureContentScript(tab.id);
      response = await sendMessageWithTimeout({
        type: 'START_RECORDING_TAB',
        tabId: tab.id,
        mode: ConsoleState.currentMode,
        config: ConsoleState.config
      }, 5000);
      if (!response?.success) {
        throw new Error('Failed after retry - refresh the Facebook page and try again');
      }
    } else if (!response.success) {
      const errorMsg = response.error || 'Failed to start recording';
      log(`Start recording failed: ${errorMsg}`, 'error');
      updateScriptConnectionUI('error');
      throw new Error(errorMsg);
    }
    
    ConsoleState.isRecording = true;
    ConsoleState.eventCounts = { events: 0, clicks: 0, inputs: 0, marks: 0 };
    
    updateRecordingUI(true);
    updateScriptConnectionUI('active');
    startStatsPolling();
    
    log(`Recording ACTIVE in ${ConsoleState.currentMode.toUpperCase()} mode`, 'success');
    log('Interact with the page - events will be captured', 'info');
    log('Click TERMINATE RECORDING when finished', 'info');
    updateStatusIndicator('recording', 'RECORDING...');
    
  } catch (error) {
    throw error;
  }
}

async function startMultiTabRecording() {
  try {
    // Get all Facebook tabs via background
    const fbTabsResponse = await chrome.runtime.sendMessage({
      type: 'GET_FACEBOOK_TABS'
    });
    
    if (!fbTabsResponse?.success || fbTabsResponse.tabs.length === 0) {
      throw new Error('No Facebook tabs found');
    }
    
    const allTabs = fbTabsResponse.tabs;
    log(`Found ${allTabs.length} Facebook tab(s)`, 'info');
    
    // Inject content script into all tabs
    for (const tab of allTabs) {
      await ensureContentScript(tab.id);
    }
    
    // Start recording in all tabs via background
    const response = await chrome.runtime.sendMessage({
      type: 'START_MULTI_TAB_RECORDING',
      config: ConsoleState.config
    });
    
    if (!response?.success) {
      throw new Error(response?.error || 'Failed to start multi-tab recording');
    }
    
    ConsoleState.isRecording = true;
    ConsoleState.eventCounts = { events: 0, clicks: 0, inputs: 0, marks: 0 };
    ConsoleState.activeTabs = response.tabs || [];
    
    updateRecordingUI(true);
    updateActiveTabsDisplay(ConsoleState.activeTabs);
    startStatsPolling();
    
    log(`Multi-tab recording started: ${allTabs.length} tabs`, 'success');
    
  } catch (error) {
    throw error;
  }
}

async function stopRecording() {
  console.log('[DEBUG STOP] stopRecording called');
  try {
    log('Stopping recording...', 'info');
    log('Gathering session data from content script...', 'info');
    console.log('[DEBUG STOP] currentMode:', ConsoleState.currentMode, 'recordingTabId:', ConsoleState.recordingTabId);
    
    let sessionData;
    
    if (ConsoleState.currentMode === 'multi-tab') {
      const response = await chrome.runtime.sendMessage({
        type: 'STOP_MULTI_TAB_RECORDING'
      });
      sessionData = response?.data;
    } else {
      // Use background relay
      const response = await chrome.runtime.sendMessage({
        type: 'STOP_RECORDING_TAB',
        tabId: ConsoleState.recordingTabId
      });
      sessionData = response?.data;
    }
    
    ConsoleState.isRecording = false;
    ConsoleState.sessionData = sessionData;
    
    updateRecordingUI(false);
    stopStatsPolling();
    
    if (sessionData) {
      const eventCount = sessionData?.events?.length || 0;
      const markedCount = sessionData?.markedElements?.length || 0;
      
      log(`Recording complete: ${eventCount} events, ${markedCount} marked`, 'success');
      displaySessionData(sessionData);
      updateScriptConnectionUI('ready');
      
      // Save locally first
      await saveSession(sessionData);
      log('Session saved locally', 'success');
      
      // Send to webapp/IAI Command Center
      log('Transmitting to IAI Command Center...', 'info');
      const uploadResult = await sendSessionToWebapp(sessionData);
      
      if (uploadResult.success) {
        log('Session uploaded to IAI Command Center', 'success');
        log(`Session ID: ${uploadResult.sessionId}`, 'info');
      } else if (uploadResult.queued) {
        log('Session queued for later upload', 'warning');
      } else {
        log(`Upload failed: ${uploadResult.error}`, 'error');
      }
    } else {
      log('No session data received from content script', 'warning');
      updateScriptConnectionUI('idle');
    }
    
  } catch (error) {
    log(`Stop recording error: ${error.message}`, 'error');
    console.error('Stop recording error:', error);
    ConsoleState.isRecording = false;
    updateRecordingUI(false);
    updateScriptConnectionUI('error');
    stopStatsPolling();
  }
}

async function sendSessionToWebapp(sessionData) {
  try {
    // Apply stealth mode filtering if enabled
    let filteredEvents = sessionData.events || [];
    if (ConsoleState.config.stealthMode) {
      console.log('[DEBUG] Stealth mode enabled, filtering events...');
      const originalCount = filteredEvents.length;
      filteredEvents = filteredEvents.filter(evt => {
        // Filter out Ctrl, Alt, Shift, Meta key presses (modifier keys)
        if (evt.type === 'keydown' || evt.type === 'keyup') {
          const key = evt.key?.toLowerCase() || '';
          const isModifierKey = ['control', 'ctrl', 'alt', 'shift', 'meta'].includes(key);
          if (isModifierKey) {
            return false; // Remove modifier key events
          }
        }
        return true;
      });
      console.log(`[DEBUG] Stealth filter: ${originalCount} -> ${filteredEvents.length} events`);
    }
    
    const payload = {
      sessionId: sessionData.sessionId || `session_${Date.now()}`,
      mode: sessionData.mode || ConsoleState.currentMode,
      recordingType: sessionData.recordingType || 'training',
      duration: sessionData.duration || 0,
      events: filteredEvents,
      markedElements: sessionData.markedElements || [],
      clickSequence: sessionData.clickSequence || [],
      typingPatterns: sessionData.typingPatterns || [],
      patterns: sessionData.patterns || {},
      fieldMappings: sessionData.fieldMappings || {},
      automationCode: sessionData.automationCode || {},
      metadata: {
        ...sessionData.metadata,
        tabUrl: sessionData.url || sessionData.metadata?.url || window.location.href,
        recordedAt: new Date().toISOString(),
        extensionVersion: '2.1.0',
        config: ConsoleState.config
      }
    };
    
    const result = await sendToWebapp('/training/sessions', payload);
    
    if (result.success) {
      return { 
        success: true, 
        sessionId: result.data?.session?.id || result.data?.sessionId 
      };
    } else {
      return result;
    }
  } catch (error) {
    log(`Webapp transmission error: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

async function togglePause() {
  if (!ConsoleState.isRecording) return;
  
  ConsoleState.isPaused = !ConsoleState.isPaused;
  
  try {
    // Use background relay
    await chrome.runtime.sendMessage({
      type: ConsoleState.isPaused ? 'PAUSE_RECORDING_TAB' : 'RESUME_RECORDING_TAB',
      tabId: ConsoleState.recordingTabId
    });
    
    DOM.pauseBtn.querySelector('.btn-text').textContent = 
      ConsoleState.isPaused ? 'RESUME' : 'PAUSE';
    DOM.pauseBtn.querySelector('.btn-icon').textContent = 
      ConsoleState.isPaused ? '▶' : '❚❚';
    
    log(ConsoleState.isPaused ? 'Recording paused' : 'Recording resumed', 'info');
  } catch (error) {
    log(`Pause failed: ${error.message}`, 'error');
  }
}

async function addMarker() {
  if (!ConsoleState.isRecording) return;
  
  try {
    // Use background relay
    const response = await chrome.runtime.sendMessage({
      type: 'ADD_MARKER_TAB',
      tabId: ConsoleState.recordingTabId,
      label: `Marker ${ConsoleState.eventCounts.marks + 1}`
    });
    
    if (response?.success) {
      ConsoleState.eventCounts.marks++;
      updateStats();
      log('Marker added', 'success');
    }
  } catch (error) {
    log(`Failed to add marker: ${error.message}`, 'error');
  }
}

function updateRecordingUI(isRecording) {
  // Update status
  updateStatusIndicator(
    isRecording ? 'recording' : 'ready',
    isRecording ? 'RECORDING...' : 'SYSTEM READY'
  );
  
  // Update button
  DOM.recordBtn?.classList.toggle('recording', isRecording);
  if (DOM.recordIcon) DOM.recordIcon.textContent = isRecording ? '■' : '●';
  if (DOM.recordText) DOM.recordText.textContent = isRecording ? 'TERMINATE RECORDING' : 'INITIATE RECORDING';
  
  // Enable/disable secondary buttons
  if (DOM.pauseBtn) DOM.pauseBtn.disabled = !isRecording;
  if (DOM.markBtn) DOM.markBtn.disabled = !isRecording;
  
  // Reset pause state
  if (!isRecording) {
    ConsoleState.isPaused = false;
    if (DOM.pauseBtn) {
      DOM.pauseBtn.querySelector('.btn-text').textContent = 'PAUSE';
      DOM.pauseBtn.querySelector('.btn-icon').textContent = '❚❚';
    }
  }
  
  // Show/hide stats
  if (DOM.liveStats) DOM.liveStats.style.display = isRecording ? 'block' : 'none';
  
  // Show/hide session output
  if (DOM.sessionOutput) {
    DOM.sessionOutput.style.display = !isRecording && ConsoleState.sessionData ? 'block' : 'none';
  }
}

// ============================================
// STATS POLLING
// ============================================

let statsInterval = null;

function startStatsPolling() {
  console.log('[DEBUG STATS] startStatsPolling called');
  stopStatsPolling(); // Clear any existing interval
  
  statsInterval = setInterval(async () => {
    if (!ConsoleState.isRecording) {
      console.log('[DEBUG STATS] Not recording, stopping polling');
      stopStatsPolling();
      return;
    }
    
    try {
      let response;
      
      if (ConsoleState.currentMode === 'multi-tab') {
        response = await chrome.runtime.sendMessage({
          type: 'GET_MULTI_TAB_STATUS'
        });
        if (response?.tabs) {
          updateActiveTabsDisplay(response.tabs);
        }
      } else {
        // Use background relay for single tab status
        console.log('[DEBUG STATS] Polling status for tab:', ConsoleState.recordingTabId);
        response = await chrome.runtime.sendMessage({
          type: 'GET_RECORDING_STATUS_TAB',
          tabId: ConsoleState.recordingTabId
        });
        console.log('[DEBUG STATS] Status response:', response);
      }
      
      if (response?.counts) {
        ConsoleState.eventCounts = response.counts;
        updateStats();
        console.log('[DEBUG STATS] Updated counts:', response.counts);
      }
    } catch (error) {
      // Tab might be closed or navigated away
      console.warn('[DEBUG STATS] Stats polling error:', error);
    }
  }, 500);
}

function stopStatsPolling() {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
}

function updateStats() {
  const counts = ConsoleState.eventCounts;
  
  if (DOM.statEvents) DOM.statEvents.textContent = counts.events || 0;
  if (DOM.statClicks) DOM.statClicks.textContent = counts.clicks || 0;
  if (DOM.statInputs) DOM.statInputs.textContent = counts.inputs || 0;
  if (DOM.statMarks) DOM.statMarks.textContent = counts.marks || 0;
  
  // Update progress bars (max 100)
  const fillEvents = document.getElementById('fill-events');
  const fillClicks = document.getElementById('fill-clicks');
  const fillInputs = document.getElementById('fill-inputs');
  const fillMarks = document.getElementById('fill-marks');
  
  if (fillEvents) fillEvents.style.width = `${Math.min((counts.events / 100) * 100, 100)}%`;
  if (fillClicks) fillClicks.style.width = `${Math.min((counts.clicks / 50) * 100, 100)}%`;
  if (fillInputs) fillInputs.style.width = `${Math.min((counts.inputs / 30) * 100, 100)}%`;
  if (fillMarks) fillMarks.style.width = `${Math.min((counts.marks / 10) * 100, 100)}%`;
  
  // Update minimized badge if collapsed
  if (DOM.expandBadge && ConsoleState.isRecording) {
    DOM.expandBadge.textContent = counts.events || 0;
  }
}

// ============================================
// ACTIVE TABS DISPLAY
// ============================================

function updateActiveTabsDisplay(tabs) {
  ConsoleState.activeTabs = tabs;
  
  if (!DOM.activeTabsList) return;
  
  if (!tabs || !tabs.length) {
    DOM.activeTabsList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">◎</span>
        <span class="empty-text">No active tabs</span>
      </div>`;
    return;
  }
  
  DOM.activeTabsList.innerHTML = tabs.map(tab => `
    <div class="tab-item ${tab.active ? 'active' : ''}">
      <span class="tab-type-icon">${getTabIcon(tab.type)}</span>
      <div class="tab-info">
        <div class="tab-type">${tab.type || 'Unknown'}</div>
        <div class="tab-url">${truncateUrl(tab.url)}</div>
      </div>
      <span class="tab-events">${tab.eventCount || 0}</span>
    </div>
  `).join('');
}

function getTabIcon(type) {
  const icons = {
    'marketplace': '🛒',
    'marketplace-create': '➕',
    'marketplace-item': '📦',
    'messages': '💬',
    'groups': '👥',
    'profile': '👤',
    'notifications': '🔔',
    'facebook-other': '📘'
  };
  return icons[type] || '📄';
}

function truncateUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return u.pathname.substring(0, 30) + (u.pathname.length > 30 ? '...' : '');
  } catch {
    return url.substring(0, 30);
  }
}

// ============================================
// SESSION DATA
// ============================================

function displaySessionData(data) {
  if (!data || !DOM.sessionOutput) return;
  
  DOM.sessionOutput.style.display = 'block';
  
  const preview = {
    mode: data.mode || ConsoleState.currentMode,
    events: data.events?.length || 0,
    markedElements: data.markedElements?.length || 0,
    duration: data.duration || 'N/A',
    tabs: data.tabData ? Object.keys(data.tabData.tabSummary || {}).length : 1,
    timestamp: new Date().toISOString()
  };
  
  if (DOM.sessionJson) {
    DOM.sessionJson.textContent = JSON.stringify(preview, null, 2);
  }
}

async function copySessionData() {
  if (!ConsoleState.sessionData) {
    log('No session data to copy', 'warning');
    return;
  }
  
  try {
    const dataStr = JSON.stringify(ConsoleState.sessionData, null, 2);
    await navigator.clipboard.writeText(dataStr);
    log(`Session data copied (${dataStr.length} bytes)`, 'success');
  } catch (error) {
    log('Failed to copy: ' + error.message, 'error');
  }
}

function exportSessionData() {
  if (!ConsoleState.sessionData) {
    log('No session data to export', 'warning');
    return;
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `session_${ConsoleState.currentMode}_${timestamp}.json`;
  
  const blob = new Blob([JSON.stringify(ConsoleState.sessionData, null, 2)], { 
    type: 'application/json' 
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  
  log(`Session exported: ${filename}`, 'success');
}

async function uploadSessionData() {
  if (!ConsoleState.sessionData) {
    log('No session data to upload', 'warning');
    return;
  }
  
  try {
    log('Uploading session to server...', 'info');
    
    // Use sendSessionToWebapp which formats the payload correctly
    const result = await sendSessionToWebapp(ConsoleState.sessionData);
    
    if (result.success) {
      log(`Session uploaded successfully: ID ${result.sessionId || 'N/A'}`, 'success');
    } else if (result.queued) {
      log('Session queued for upload when connected', 'warning');
    } else {
      log(`Upload failed: ${result.error || 'Unknown error'}`, 'error');
    }
    
  } catch (error) {
    log(`Upload failed: ${error.message}`, 'error');
  }
}

// ============================================
// SESSION MANAGEMENT
// ============================================

async function saveSession(sessionData) {
  try {
    const session = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      mode: sessionData.mode || ConsoleState.currentMode,
      eventCount: sessionData.events?.length || 0,
      markedCount: sessionData.markedElements?.length || 0,
      data: sessionData
    };
    
    ConsoleState.savedSessions.unshift(session);
    
    // Keep only last 20 sessions
    if (ConsoleState.savedSessions.length > 100) {
      ConsoleState.savedSessions = ConsoleState.savedSessions.slice(0, 100);
    }
    
    await chrome.storage.local.set({ savedSessions: ConsoleState.savedSessions });
    updateSessionsList();
    
  } catch (error) {
    console.error('Save session error:', error);
  }
}

async function loadSavedSessions() {
  try {
    const result = await chrome.storage.local.get(['savedSessions']);
    ConsoleState.savedSessions = result.savedSessions || [];
    updateSessionsList();
  } catch (error) {
    console.error('Load sessions error:', error);
  }
}

function updateSessionsList() {
  if (!DOM.sessionsList) return;
  
  if (!ConsoleState.savedSessions.length) {
    DOM.sessionsList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">◎</span>
        <span class="empty-text">No sessions recorded</span>
      </div>`;
    return;
  }
  
  DOM.sessionsList.innerHTML = ConsoleState.savedSessions.map(session => `
    <div class="session-item" data-id="${session.id}">
      <div class="session-header">
        <span class="session-name">${session.mode?.toUpperCase() || 'SESSION'}</span>
        <span class="session-date">${formatDate(session.timestamp)}</span>
      </div>
      <div class="session-stats">
        <span class="session-stat"><span>${session.eventCount}</span> events</span>
        <span class="session-stat"><span>${session.markedCount}</span> marks</span>
      </div>
      <div class="session-actions">
        <button class="session-action-btn load-btn" data-id="${session.id}">LOAD</button>
        <button class="session-action-btn delete-btn" data-id="${session.id}">DELETE</button>
      </div>
    </div>
  `).join('');
  
  // Add event listeners
  DOM.sessionsList.querySelectorAll('.load-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      loadSession(parseInt(btn.dataset.id));
    });
  });
  
  DOM.sessionsList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSession(parseInt(btn.dataset.id));
    });
  });
}

function loadSession(id) {
  const session = ConsoleState.savedSessions.find(s => s.id === id);
  if (!session) {
    log('Session not found', 'error');
    return;
  }
  
  ConsoleState.sessionData = session.data;
  displaySessionData(session.data);
  switchTab('record');
  log(`Session loaded: ${session.mode}`, 'success');
}

async function deleteSession(id) {
  ConsoleState.savedSessions = ConsoleState.savedSessions.filter(s => s.id !== id);
  await chrome.storage.local.set({ savedSessions: ConsoleState.savedSessions });
  updateSessionsList();
  log('Session deleted', 'info');
}

function formatDate(isoString) {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoString;
  }
}

// ============================================
// SIDEBAR COLLAPSE/EXPAND
// ============================================

function collapseSidebar() {
  if (DOM.consoleWrapper) DOM.consoleWrapper.style.display = 'none';
  if (DOM.resizeHandle) DOM.resizeHandle.style.display = 'none';
  if (DOM.sidebarMinimized) DOM.sidebarMinimized.style.display = 'block';
  
  // Show event count badge if recording
  if (ConsoleState.isRecording && DOM.expandBadge) {
    DOM.expandBadge.textContent = ConsoleState.eventCounts.events;
  }
  
  log('Console minimized', 'info');
}

function expandSidebar() {
  if (DOM.sidebarMinimized) DOM.sidebarMinimized.style.display = 'none';
  if (DOM.consoleWrapper) DOM.consoleWrapper.style.display = 'flex';
  if (DOM.resizeHandle) DOM.resizeHandle.style.display = 'flex';
  
  log('Console expanded', 'info');
}

// ============================================
// CLOCK
// ============================================

function startClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  if (DOM.systemClock) {
    const now = new Date();
    DOM.systemClock.textContent = now.toTimeString().split(' ')[0];
  }
}

// ============================================
// LOGGING
// ============================================

const LOG_TYPES = {
  info: { label: '[SYS]', class: 'info' },
  success: { label: '[OK]', class: 'success' },
  warning: { label: '[WRN]', class: 'warning' },
  error: { label: '[ERR]', class: 'error' }
};

function log(message, type = 'info') {
  const time = new Date().toTimeString().split(' ')[0];
  const logType = LOG_TYPES[type] || LOG_TYPES.info;
  
  const entry = { time, type, message };
  ConsoleState.logs.push(entry);
  
  // Trim logs to max lines
  trimLogs();
  
  // Update Logs Tab UI
  if (DOM.logsContainer) {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${logType.class}`;
    logEntry.dataset.index = ConsoleState.logs.length - 1;
    logEntry.innerHTML = `
      <span class="log-time">${time}</span>
      <span class="log-type">${logType.label}</span>
      <span class="log-msg">${escapeHtml(message)}</span>
    `;
    DOM.logsContainer.appendChild(logEntry);
    DOM.logsContainer.scrollTop = DOM.logsContainer.scrollHeight;
    
    // Remove excess DOM entries
    while (DOM.logsContainer.children.length > ConsoleState.config.maxLogLines) {
      DOM.logsContainer.removeChild(DOM.logsContainer.firstChild);
    }
  }
  
  // Update Live Console (on Record tab) - last 20 entries
  updateLiveConsole(time, message, type);
  
  console.log(`[Console ${type.toUpperCase()}] ${message}`);
}

function trimLogs() {
  const maxLines = ConsoleState.config.maxLogLines || 50;
  if (ConsoleState.logs.length > maxLines) {
    ConsoleState.logs = ConsoleState.logs.slice(-maxLines);
  }
}

function clearLogs() {
  ConsoleState.logs = [];
  if (DOM.logsContainer) {
    DOM.logsContainer.innerHTML = '';
  }
  // Clear live console too
  if (DOM.liveConsoleContainer) {
    DOM.liveConsoleContainer.innerHTML = '';
  }
  if (DOM.consoleCount) {
    DOM.consoleCount.textContent = '0';
  }
  log('Logs cleared', 'info');
}

// Update the live console on the Record tab
function updateLiveConsole(time, message, type) {
  if (!DOM.liveConsoleContainer) return;
  
  const entry = document.createElement('div');
  entry.className = `console-entry ${type}`;
  entry.innerHTML = `
    <span class="console-time">${time}</span>
    <span class="console-msg">${escapeHtml(message)}</span>
  `;
  
  DOM.liveConsoleContainer.appendChild(entry);
  DOM.liveConsoleContainer.scrollTop = DOM.liveConsoleContainer.scrollHeight;
  
  // Keep only last 20 entries in live console
  while (DOM.liveConsoleContainer.children.length > 20) {
    DOM.liveConsoleContainer.removeChild(DOM.liveConsoleContainer.firstChild);
  }
  
  // Update count
  if (DOM.consoleCount) {
    DOM.consoleCount.textContent = Math.min(ConsoleState.logs.length, 99);
  }
}

function handleLogClick(e) {
  const logEntry = e.target.closest('.log-entry');
  if (!logEntry) return;
  
  // If clicking on a single log, copy that log
  if (e.detail === 1) { // Single click
    const time = logEntry.querySelector('.log-time')?.textContent || '';
    const type = logEntry.querySelector('.log-type')?.textContent || '';
    const msg = logEntry.querySelector('.log-msg')?.textContent || '';
    const logText = `${time} ${type} ${msg}`;
    
    navigator.clipboard.writeText(logText).then(() => {
      showCopyFeedback(logEntry);
    }).catch(err => console.error('Copy failed:', err));
  }
}

function showCopyFeedback(element) {
  element.classList.add('copied');
  setTimeout(() => element.classList.remove('copied'), 500);
}

async function copyAllLogs() {
  const logsText = ConsoleState.logs.map(l => 
    `${l.time} ${LOG_TYPES[l.type]?.label || '[SYS]'} ${l.message}`
  ).join('\n');
  
  try {
    await navigator.clipboard.writeText(logsText);
    log('All logs copied to clipboard', 'success');
  } catch (error) {
    log('Failed to copy logs', 'error');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// CONFIG
// ============================================

async function loadConfig() {
  try {
    const result = await chrome.storage.local.get(['consoleConfig']);
    if (result.consoleConfig) {
      ConsoleState.config = { ...ConsoleState.config, ...result.consoleConfig };
    }
    
    // Update UI
    const automark = document.getElementById('config-automark');
    const scrolls = document.getElementById('config-scrolls');
    const hovers = document.getElementById('config-hovers');
    const stealth = document.getElementById('config-stealth');
    const apiInput = document.getElementById('api-endpoint');
    const logLines = document.getElementById('config-log-lines');
    
    if (automark) automark.checked = ConsoleState.config.autoMark;
    if (scrolls) scrolls.checked = ConsoleState.config.captureScrolls;
    if (hovers) hovers.checked = ConsoleState.config.recordHovers;
    if (stealth) stealth.checked = ConsoleState.config.stealthMode;
    if (apiInput) apiInput.value = ConsoleState.config.apiEndpoint;
    if (logLines) logLines.value = ConsoleState.config.maxLogLines;
    
  } catch (error) {
    console.error('Load config error:', error);
  }
}

async function saveConfig() {
  try {
    await chrome.storage.local.set({ consoleConfig: ConsoleState.config });
  } catch (error) {
    console.error('Save config error:', error);
  }
}

async function testApiConnection() {
  const indicator = document.getElementById('api-indicator');
  const apiText = indicator?.querySelector('.api-text');
  
  try {
    log('Testing API connection...', 'info');
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(ConsoleState.config.healthEndpoint, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (response.ok) {
      if (indicator) {
        indicator.classList.remove('disconnected');
        indicator.classList.add('connected');
      }
      if (apiText) apiText.textContent = 'CONNECTED';
      log('API connection successful', 'success');
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
    
  } catch (error) {
    if (indicator) {
      indicator.classList.remove('connected');
      indicator.classList.add('disconnected');
    }
    if (apiText) apiText.textContent = 'DISCONNECTED';
    log(`API connection failed: ${error.message}`, 'error');
  }
}

// ============================================
// CONNECTION MONITORING & WEBAPP SYNC
// ============================================

function startConnectionMonitoring() {
  // Check webapp connection immediately
  checkWebappConnection();
  
  // Set up periodic checks
  connectionCheckInterval = setInterval(async () => {
    await checkWebappConnection();
    
    // Also check content script if we have a tab
    if (ConsoleState.recordingTabId) {
      await checkContentScriptStatus();
    }
  }, 10000); // Every 10 seconds
  
  // Start heartbeat interval - sends to server every 30 seconds (reduced from 5 to avoid rate limiting)
  // IMPORTANT: Always send heartbeat regardless of webappConnected state
  // The heartbeat IS what establishes connection, not the other way around
  heartbeatInterval = setInterval(async () => {
    // Skip if we're in backoff period
    if (ConsoleState.heartbeatBackoffUntil && Date.now() < ConsoleState.heartbeatBackoffUntil) {
      console.log('[Console] Heartbeat skipped - in backoff period');
      return;
    }
    console.log('[Console] Heartbeat tick - sending heartbeat...');
    try {
      await sendHeartbeatToServer();
    } catch (e) {
      console.error('[Console] Heartbeat interval error:', e);
    }
  }, 30000); // Changed from 5000 to 30000 (30 seconds) to avoid rate limiting
  
  // Also send initial heartbeat immediately
  sendHeartbeatToServer().catch(e => console.error('[Console] Initial heartbeat error:', e));
  
  log('Connection monitoring started', 'info');
}

function stopConnectionMonitoring() {
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval);
    connectionCheckInterval = null;
  }
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/**
 * Sync auth token from webapp (dealersface.com) to extension storage
 * Tries multiple methods:
 * 1. Check if webapp-bridge already synced the token
 * 2. Try to send message to webapp tab to get token
 * 3. Check storage for previously synced token
 */
async function syncAuthTokenFromWebapp() {
  console.log('[Console] Syncing auth token from webapp...');
  
  try {
    // First check if we already have a token synced
    const existing = await chrome.storage.local.get(['fmd_admin_token', 'fmd_token_synced_at']);
    if (existing.fmd_admin_token) {
      const syncedAgo = existing.fmd_token_synced_at ? Date.now() - existing.fmd_token_synced_at : null;
      console.log('[Console] Existing token found, synced', syncedAgo ? `${Math.round(syncedAgo/1000)}s ago` : 'unknown time ago');
      
      // If token was synced recently (within 5 minutes), use it
      if (syncedAgo && syncedAgo < 5 * 60 * 1000) {
        log('Auth token loaded from sync', 'success');
        return true;
      }
    }
    
    // Try to find a webapp tab and get token from it
    console.log('[Console] Looking for webapp tabs to sync token...');
    const tabs = await chrome.tabs.query({
      url: ['https://dealersface.com/*', 'https://www.dealersface.com/*', 'http://localhost:3000/*', 'http://localhost:5173/*']
    });
    
    if (tabs.length > 0) {
      console.log('[Console] Found', tabs.length, 'webapp tab(s), requesting token sync...');
      
      for (const tab of tabs) {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { type: 'SYNC_AUTH_TOKEN' });
          if (response?.success) {
            console.log('[Console] Token synced from webapp tab:', tab.id);
            log('Auth token synced from webapp', 'success');
            return true;
          }
        } catch (err) {
          console.log('[Console] Tab', tab.id, 'did not respond:', err.message);
        }
      }
    }
    
    // No webapp tabs or sync failed
    if (existing.fmd_admin_token) {
      console.log('[Console] Using existing token (may be stale)');
      log('Using cached auth token', 'info');
      updateAuthStatusUI(true, 'CACHED');
      return true;
    }
    
    log('No auth token - open dealersface.com and login', 'warning');
    console.log('[Console] No auth token available');
    updateAuthStatusUI(false, 'NOT FOUND');
    return false;
    
  } catch (error) {
    console.error('[Console] Error syncing auth token:', error);
    updateAuthStatusUI(false, 'ERROR');
    return false;
  }
}

/**
 * Force sync auth token - tries harder including injecting script
 */
async function forceSyncAuthToken() {
  const authStatus = document.getElementById('auth-status');
  const authText = document.getElementById('auth-text');
  
  if (authStatus) authStatus.style.borderColor = 'rgba(0,150,255,0.5)';
  if (authText) authText.textContent = '⟳ SYNCING...';
  
  try {
    // First try normal sync
    console.log('[Console] Force sync: trying normal sync...');
    
    // Look for webapp tabs
    const tabs = await chrome.tabs.query({
      url: ['https://dealersface.com/*', 'https://www.dealersface.com/*', 'http://localhost:3000/*', 'http://localhost:5173/*']
    });
    
    console.log('[Console] Force sync: found', tabs.length, 'webapp tab(s)');
    
    if (tabs.length === 0) {
      log('No dealersface.com tabs open - please open the webapp', 'error');
      updateAuthStatusUI(false, 'OPEN WEBAPP');
      return false;
    }
    
    // Try to inject webapp-bridge if it's not responding
    for (const tab of tabs) {
      try {
        // First try direct message
        console.log('[Console] Force sync: pinging tab', tab.id);
        const response = await Promise.race([
          chrome.tabs.sendMessage(tab.id, { type: 'GET_AUTH_TOKEN' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
        ]);
        
        console.log('[Console] Force sync: got response:', response);
        
        if (response?.accessToken) {
          // Store the token directly
          await chrome.storage.local.set({
            fmd_admin_token: response.accessToken,
            fmd_refresh_token: response.refreshToken,
            fmd_user_id: response.userId,
            fmd_token_synced_at: Date.now()
          });
          
          log('Auth token synced successfully!', 'success');
          updateAuthStatusUI(true, 'SYNCED');
          return true;
        }
      } catch (err) {
        console.log('[Console] Force sync: tab', tab.id, 'error:', err.message);
        
        // Try to inject the bridge script
        if (err.message === 'timeout' || err.message.includes('Receiving end does not exist')) {
          console.log('[Console] Force sync: injecting bridge script into tab', tab.id);
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['webapp-bridge.js']
            });
            
            // Wait a moment for it to initialize
            await new Promise(r => setTimeout(r, 500));
            
            // Try again
            const retryResponse = await Promise.race([
              chrome.tabs.sendMessage(tab.id, { type: 'GET_AUTH_TOKEN' }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
            ]);
            
            console.log('[Console] Force sync: retry response:', retryResponse);
            
            if (retryResponse?.accessToken) {
              await chrome.storage.local.set({
                fmd_admin_token: retryResponse.accessToken,
                fmd_refresh_token: retryResponse.refreshToken,
                fmd_user_id: retryResponse.userId,
                fmd_token_synced_at: Date.now()
              });
              
              log('Auth token synced after script injection!', 'success');
              updateAuthStatusUI(true, 'SYNCED');
              return true;
            }
          } catch (injectErr) {
            console.error('[Console] Force sync: inject error:', injectErr);
          }
        }
      }
    }
    
    // Check if we have a cached token
    const cached = await chrome.storage.local.get('fmd_admin_token');
    if (cached.fmd_admin_token) {
      log('Using cached token (sync failed)', 'warning');
      updateAuthStatusUI(true, 'CACHED');
      return true;
    }
    
    log('Token sync failed - make sure you are logged in to dealersface.com', 'error');
    updateAuthStatusUI(false, 'FAILED');
    return false;
    
  } catch (error) {
    console.error('[Console] Force sync error:', error);
    log(`Token sync error: ${error.message}`, 'error');
    updateAuthStatusUI(false, 'ERROR');
    return false;
  }
}

/**
 * Update the auth status UI in CONFIG tab
 */
function updateAuthStatusUI(hasToken, status) {
  const authStatus = document.getElementById('auth-status');
  const authText = document.getElementById('auth-text');
  
  if (!authStatus || !authText) return;
  
  if (hasToken) {
    authStatus.style.borderColor = 'rgba(0,255,100,0.5)';
    authStatus.style.background = 'rgba(0,255,100,0.1)';
    authText.style.color = '#00ff64';
    authText.textContent = `✓ AUTH: ${status}`;
  } else {
    authStatus.style.borderColor = 'rgba(255,50,50,0.5)';
    authStatus.style.background = 'rgba(255,50,50,0.1)';
    authText.style.color = '#ff5050';
    authText.textContent = `✗ AUTH: ${status}`;
  }
}

async function checkWebappConnection() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    // First check health endpoint
    const response = await fetch(ConsoleState.config.healthEndpoint, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (response.ok) {
      if (!ConsoleState.webappConnected) {
        log('Connected to IAI Command Center', 'success');
        ConsoleState.connectionRetries = 0;
      }
      ConsoleState.webappConnected = true;
      ConsoleState.lastHeartbeat = Date.now();
      updateConnectionUI(true);
      
      // NOTE: Don't send heartbeat here - heartbeatInterval handles it
      // This prevents double-sending which causes rate limiting
      
      return true;
    }
  } catch (error) {
    ConsoleState.webappConnected = false;
    ConsoleState.connectionRetries++;
    updateConnectionUI(false);
    
    if (ConsoleState.connectionRetries <= ConsoleState.maxRetries) {
      log(`Webapp connection attempt ${ConsoleState.connectionRetries}/${ConsoleState.maxRetries}...`, 'warning');
    } else if (ConsoleState.connectionRetries === ConsoleState.maxRetries + 1) {
      log('Webapp connection failed - will keep retrying', 'error');
    }
  }
  return false;
}

/**
 * Send heartbeat to training console endpoint
 * This allows IAI Training Panel to detect real-time extension connection
 */
async function sendHeartbeatToServer() {
  try {
    // Check if we're still in backoff period
    if (ConsoleState.heartbeatBackoffUntil && Date.now() < ConsoleState.heartbeatBackoffUntil) {
      const remainingMs = ConsoleState.heartbeatBackoffUntil - Date.now();
      console.log(`[Console] Heartbeat skipped - in backoff for ${Math.ceil(remainingMs/1000)}s more`);
      return;
    }
    
    const heartbeatUrl = `${ConsoleState.config.apiEndpoint}/training/console/heartbeat`;
    console.log('[Console] Sending heartbeat to:', heartbeatUrl);
    
    // Get browser ID from chrome.runtime
    let browserId = null;
    try {
      const manifest = chrome.runtime.getManifest();
      browserId = chrome.runtime.id || 'unknown';
    } catch (e) {
      browserId = 'extension-recorder';
    }
    
    const heartbeatData = {
      browserId,
      version: '2.0',
      currentTab: ConsoleState.currentTab,
      recordingActive: ConsoleState.isRecording,
      recordingTabId: ConsoleState.recordingTabId,
      eventCounts: ConsoleState.eventCounts,
      mode: ConsoleState.currentMode,
    };
    
    console.log('[Console] Heartbeat data:', JSON.stringify(heartbeatData));
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(heartbeatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(heartbeatData),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    console.log('[Console] Heartbeat response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('[Console] Heartbeat response data:', data);
      // Reset backoff on success
      ConsoleState.heartbeatFailCount = 0;
      ConsoleState.heartbeatBackoffUntil = null;
      
      if (data.success) {
        // Update UI to show fully connected (server received heartbeat)
        const webappStatus = document.getElementById('webapp-status');
        if (webappStatus) {
          webappStatus.className = 'conn-status connected';
          webappStatus.textContent = 'SYNCED';
        }
        // Mark connection as established
        ConsoleState.webappConnected = true;
        ConsoleState.lastHeartbeat = Date.now();
      }
    } else if (response.status === 429) {
      // Rate limited - implement exponential backoff
      ConsoleState.heartbeatFailCount++;
      const backoffSeconds = Math.min(60, 30 * Math.pow(2, ConsoleState.heartbeatFailCount - 1)); // 30s, 60s, capped at 60s
      ConsoleState.heartbeatBackoffUntil = Date.now() + (backoffSeconds * 1000);
      console.warn(`[Console] Rate limited (429) - backing off for ${backoffSeconds}s`);
      log(`Heartbeat rate limited - backing off ${backoffSeconds}s`, 'warning');
    } else {
      const errorText = await response.text();
      console.error('[Console] Heartbeat failed:', response.status, errorText);
      // Increment fail count but use shorter backoff for non-429 errors
      ConsoleState.heartbeatFailCount++;
      if (ConsoleState.heartbeatFailCount >= 3) {
        const backoffSeconds = 15;
        ConsoleState.heartbeatBackoffUntil = Date.now() + (backoffSeconds * 1000);
        console.warn(`[Console] Multiple failures - backing off for ${backoffSeconds}s`);
      }
    }
  } catch (error) {
    // Log error but don't crash
    console.error('[Console] Heartbeat error:', error.message);
    ConsoleState.heartbeatFailCount++;
    // Backoff on network errors too
    if (ConsoleState.heartbeatFailCount >= 2) {
      const backoffSeconds = 20;
      ConsoleState.heartbeatBackoffUntil = Date.now() + (backoffSeconds * 1000);
    }
  }
}

function updateConnectionUI(connected) {
  // Update config tab indicator
  const indicator = document.getElementById('api-indicator');
  const apiText = indicator?.querySelector('.api-text');
  const connectionStatus = document.getElementById('connection-status');
  
  if (indicator) {
    indicator.classList.toggle('connected', connected);
    indicator.classList.toggle('disconnected', !connected);
  }
  if (apiText) {
    apiText.textContent = connected ? 'CONNECTED' : 'DISCONNECTED';
  }
  if (connectionStatus) {
    connectionStatus.innerHTML = connected 
      ? '<span style="color: var(--success);">● ONLINE</span>'
      : '<span style="color: var(--error);">● OFFLINE</span>';
  }
  
  // Update header connection bar
  const webappStatus = document.getElementById('webapp-status');
  if (webappStatus) {
    webappStatus.className = 'conn-status';
    if (connected) {
      webappStatus.classList.add('connected');
      webappStatus.textContent = 'CONNECTED';
    } else if (ConsoleState.connectionRetries > 0) {
      webappStatus.classList.add('seeking');
      webappStatus.textContent = 'SEEKING...';
    } else {
      webappStatus.classList.add('disconnected');
      webappStatus.textContent = 'OFFLINE';
    }
  }
}

function updateScriptConnectionUI(status) {
  const scriptStatus = document.getElementById('script-status');
  if (!scriptStatus) return;
  
  scriptStatus.className = 'conn-status';
  
  switch (status) {
    case 'active':
      scriptStatus.classList.add('active');
      scriptStatus.textContent = 'RECORDING';
      break;
    case 'ready':
      scriptStatus.classList.add('connected');
      scriptStatus.textContent = 'READY';
      break;
    case 'injecting':
      scriptStatus.classList.add('seeking');
      scriptStatus.textContent = 'INJECTING...';
      break;
    case 'error':
      scriptStatus.classList.add('disconnected');
      scriptStatus.textContent = 'ERROR';
      break;
    default:
      scriptStatus.classList.add('idle');
      scriptStatus.textContent = 'IDLE';
  }
}

async function sendToWebapp(endpoint, data) {
  console.log('[DEBUG SEND] sendToWebapp called:', endpoint, 'webappConnected:', ConsoleState.webappConnected);
  
  // Check for token first - don't require webappConnected if we have a valid token
  const tokenCheck = await chrome.storage.local.get('fmd_admin_token');
  const hasToken = !!tokenCheck.fmd_admin_token;
  console.log('[DEBUG SEND] hasToken:', hasToken);
  
  if (!hasToken && !ConsoleState.webappConnected) {
    log('No auth token and webapp not connected, queueing data locally', 'warning');
    console.log('[DEBUG SEND] No token and webapp not connected, queueing locally');
    await saveLocalQueue(data);
    return { success: false, queued: true };
  }
  
  try {
    // Get auth token
    let tokenResult = await chrome.storage.local.get('fmd_admin_token');
    let token = tokenResult.fmd_admin_token;
    console.log('[DEBUG SEND] Token found:', !!token);
    
    // If no token, try to sync from webapp
    if (!token) {
      log('No auth token cached - trying to sync from webapp...', 'warning');
      console.log('[DEBUG SEND] Attempting auth token sync...');
      const synced = await syncAuthTokenFromWebapp();
      if (synced) {
        tokenResult = await chrome.storage.local.get('fmd_admin_token');
        token = tokenResult.fmd_admin_token;
        console.log('[DEBUG SEND] Token after sync:', !!token);
      }
    }
    
    if (!token) {
      log('No auth token - please login at dealersface.com', 'error');
      console.log('[DEBUG SEND] No auth token after sync attempt!');
      return { success: false, error: 'Not authenticated' };
    }
    
    console.log('[DEBUG SEND] Sending to:', `${ConsoleState.config.apiEndpoint}${endpoint}`);
    const response = await fetch(`${ConsoleState.config.apiEndpoint}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    
    console.log('[DEBUG SEND] Response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log('[DEBUG SEND] Error response:', errorData);
      
      // If 401/403, clear cached token and suggest re-login
      if (response.status === 401 || response.status === 403) {
        await chrome.storage.local.remove(['fmd_admin_token', 'fmd_token_synced_at']);
        log('Auth token expired - please refresh dealersface.com and try again', 'error');
      }
      
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    const result = await response.json();
    console.log('[DEBUG SEND] Success result:', result);
    return { success: true, data: result };
    
  } catch (error) {
    console.error('[DEBUG SEND] Error:', error);
    log(`Send to webapp failed: ${error.message}`, 'error');
    await saveLocalQueue(data);
    return { success: false, error: error.message, queued: true };
  }
}

async function saveLocalQueue(data) {
  try {
    const result = await chrome.storage.local.get(['pendingUploads']);
    const queue = result.pendingUploads || [];
    queue.push({
      ...data,
      queuedAt: Date.now()
    });
    // Keep only last 10 queued items
    const trimmedQueue = queue.slice(-10);
    await chrome.storage.local.set({ pendingUploads: trimmedQueue });
    log('Data queued for upload when connected', 'info');
  } catch (error) {
    console.error('Failed to queue data:', error);
  }
}

async function syncPendingUploads() {
  if (!ConsoleState.webappConnected) return;
  
  try {
    const result = await chrome.storage.local.get(['pendingUploads']);
    const queue = result.pendingUploads || [];
    
    if (queue.length === 0) return;
    
    log(`Syncing ${queue.length} pending upload(s)...`, 'info');
    
    const synced = [];
    for (const item of queue) {
      const sendResult = await sendToWebapp('/training/sessions', item);
      if (sendResult.success) {
        synced.push(item);
      }
    }
    
    // Remove synced items
    const remaining = queue.filter(q => !synced.includes(q));
    await chrome.storage.local.set({ pendingUploads: remaining });
    
    if (synced.length > 0) {
      log(`Synced ${synced.length} session(s) to IAI Command Center`, 'success');
    }
  } catch (error) {
    console.error('Sync error:', error);
  }
}

// ============================================
// MESSAGE HANDLING
// ============================================

function handleBackgroundMessage(message, sender, sendResponse) {
  switch (message.type) {
    case 'EVENT_RECORDED':
      if (message.counts) {
        ConsoleState.eventCounts = message.counts;
        updateStats();
      }
      break;
      
    case 'RECORDING_STATUS_UPDATE':
      if (message.status) {
        ConsoleState.eventCounts = message.status.counts || ConsoleState.eventCounts;
        updateStats();
      }
      break;
      
    case 'ELEMENT_MARKED':
      log(`Element marked: ${message.element?.tagName || 'Unknown'}`, 'info');
      break;
      
    case 'TAB_CHANGED':
      log(`Tab switched: ${message.tabType || 'Unknown'}`, 'info');
      break;
      
    case 'RECORDING_ERROR':
      log(`Recording error: ${message.error}`, 'error');
      break;
      
    case 'TRIGGER_PUBLISH':
      // Publish button was pressed from Ctrl grid overlay
      log('Publish triggered from overlay', 'info');
      uploadSessionData();
      break;
  }
  
  sendResponse({ received: true });
  return true;
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener('keydown', (e) => {
  // Ctrl+Shift+R - Toggle recording
  if (e.ctrlKey && e.shiftKey && e.key === 'R') {
    e.preventDefault();
    toggleRecording();
  }
  
  // Ctrl+Shift+M - Add marker
  if (e.ctrlKey && e.shiftKey && e.key === 'M') {
    e.preventDefault();
    if (ConsoleState.isRecording) addMarker();
  }
  
  // Ctrl+Shift+L - Copy all logs
  if (e.ctrlKey && e.shiftKey && e.key === 'L') {
    e.preventDefault();
    copyAllLogs();
  }
});

