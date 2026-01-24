/**
 * FMD Training Recorder - Popup UI Controller
 * With Multi-Tab Support
 */

// ============================================
// STATE
// ============================================

let isRecording = false;
let isMultiTabMode = false;
let currentMode = 'listing';
let currentType = 'iai';
let currentSessionData = null;
let recordingTabs = [];  // Active recording tabs

// ============================================
// DOM ELEMENTS
// ============================================

const authSection = document.getElementById('auth-section');
const mainSection = document.getElementById('main-section');
const authToken = document.getElementById('auth-token');
const authBtn = document.getElementById('auth-btn');

const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const eventCount = document.getElementById('event-count');
const markedCount = document.getElementById('marked-count');

const modeButtons = document.querySelectorAll('.mode-btn');
const recordBtn = document.getElementById('record-btn');
const recordBtnText = document.getElementById('record-btn-text');

const viewSessionBtn = document.getElementById('view-session-btn');
const saveSessionBtn = document.getElementById('save-session-btn');
const copyCodeBtn = document.getElementById('copy-code-btn');

const recentSessions = document.getElementById('recent-sessions');
const sessionsList = document.getElementById('sessions-list');

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Recorder Popup] Initializing...');
  
  // Always show main section first for usability
  showMainSection();
  
  // Try to check authentication in background
  try {
    const isAdmin = await checkAdminAuth();
    console.log('[Recorder Popup] Admin check result:', isAdmin);
  } catch (error) {
    console.log('[Recorder Popup] Auth check skipped:', error.message);
  }
  
  // Load status regardless of auth
  await loadRecordingStatus();
  await loadRecentSessions();
  
  // Setup event listeners
  setupEventListeners();
});

// ============================================
// AUTHENTICATION
// ============================================

async function checkAdminAuth() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CHECK_ADMIN' });
    return response.isAdmin;
  } catch (error) {
    console.error('[Recorder Popup] Auth check failed:', error);
    return false;
  }
}

function showAuthSection() {
  authSection.classList.remove('hidden');
  mainSection.classList.add('hidden');
}

function showMainSection() {
  authSection.classList.add('hidden');
  mainSection.classList.remove('hidden');
}

async function authenticate() {
  const token = authToken.value.trim();
  if (!token) return;
  
  authBtn.disabled = true;
  authBtn.textContent = 'Authenticating...';
  
  try {
    await chrome.runtime.sendMessage({
      type: 'SET_AUTH_TOKEN',
      token: token,
    });
    
    const isAdmin = await checkAdminAuth();
    
    if (isAdmin) {
      showMainSection();
      await loadRecordingStatus();
      await loadRecentSessions();
    } else {
      alert('Invalid token or insufficient permissions');
    }
  } catch (error) {
    console.error('[Recorder Popup] Auth failed:', error);
    alert('Authentication failed: ' + error.message);
  } finally {
    authBtn.disabled = false;
    authBtn.textContent = 'Authenticate';
  }
}

// ============================================
// RECORDING CONTROL
// ============================================

async function loadRecordingStatus() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url?.includes('facebook.com')) {
      if (statusText) statusText.textContent = 'Open Facebook to record';
      if (recordBtn) recordBtn.disabled = false; // Allow clicking to show instructions
      return;
    }
    
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' });
      
      if (response && response.isRecording) {
        isRecording = true;
        updateRecordingUI(true);
        if (eventCount) eventCount.textContent = response.eventCount || 0;
        if (markedCount) markedCount.textContent = response.markedCount || 0;
      }
    } catch (msgError) {
      console.log('[Recorder Popup] Content script not ready:', msgError.message);
      if (statusText) statusText.textContent = 'Ready - Navigate to Facebook';
    }
    
    if (recordBtn) recordBtn.disabled = false;
  } catch (error) {
    console.error('[Recorder Popup] Status check failed:', error);
    if (statusText) statusText.textContent = 'Ready to record';
    if (recordBtn) recordBtn.disabled = false;
  }
}

async function toggleRecording() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab) {
    alert('No active tab found');
    return;
  }
  
  try {
    // Check if multi-tab mode is selected
    if (currentMode === 'multi-tab') {
      await toggleMultiTabRecording();
      return;
    }
    
    if (isRecording) {
      // Stop recording
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'STOP_RECORDING' });
      
      if (response.success) {
        isRecording = false;
        currentSessionData = response.data;
        updateRecordingUI(false);
        
        // Enable action buttons
        viewSessionBtn.disabled = false;
        saveSessionBtn.disabled = false;
        copyCodeBtn.disabled = false;
        
        // Update tab display
        updateTabDisplay(currentSessionData);
        
        console.log('[Recorder Popup] Session data:', currentSessionData);
      }
    } else {
      // Start recording
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'START_RECORDING',
        options: {
          mode: currentMode,
          recordingType: currentType,
        },
      });
      
      if (response.success) {
        isRecording = true;
        updateRecordingUI(true);
        
        // Disable action buttons
        viewSessionBtn.disabled = true;
        saveSessionBtn.disabled = true;
        copyCodeBtn.disabled = true;
        
        // Start polling for event count
        startEventCountPolling(tab.id);
      }
    }
  } catch (error) {
    console.error('[Recorder Popup] Toggle recording failed:', error);
    alert('Failed to toggle recording: ' + error.message);
  }
}

/**
 * Toggle multi-tab recording mode
 */
async function toggleMultiTabRecording() {
  try {
    if (isRecording) {
      // Stop multi-tab recording
      const response = await chrome.runtime.sendMessage({ type: 'STOP_MULTI_TAB_RECORDING' });
      
      if (response.success) {
        isRecording = false;
        isMultiTabMode = false;
        currentSessionData = response.data;
        recordingTabs = [];
        
        updateRecordingUI(false);
        updateTabDisplay(currentSessionData);
        
        // Enable action buttons
        viewSessionBtn.disabled = false;
        saveSessionBtn.disabled = false;
        copyCodeBtn.disabled = false;
        
        console.log('[Recorder Popup] Multi-tab session data:', currentSessionData);
      }
    } else {
      // Start multi-tab recording
      const response = await chrome.runtime.sendMessage({
        type: 'START_MULTI_TAB_RECORDING',
        options: {
          mode: currentMode,
          recordingType: currentType,
        },
      });
      
      if (response.success) {
        isRecording = true;
        isMultiTabMode = true;
        recordingTabs = response.tabs || [];
        
        updateRecordingUI(true);
        updateActiveTabsDisplay(recordingTabs);
        
        // Disable action buttons
        viewSessionBtn.disabled = true;
        saveSessionBtn.disabled = true;
        copyCodeBtn.disabled = true;
        
        // Start polling for multi-tab status
        startMultiTabPolling();
        
        console.log('[Recorder Popup] Multi-tab recording started:', recordingTabs.length, 'tabs');
      }
    }
  } catch (error) {
    console.error('[Recorder Popup] Multi-tab toggle failed:', error);
    alert('Failed to toggle multi-tab recording: ' + error.message);
  }
}

/**
 * Poll for multi-tab recording status
 */
let multiTabPollInterval = null;

function startMultiTabPolling() {
  if (multiTabPollInterval) {
    clearInterval(multiTabPollInterval);
  }
  
  multiTabPollInterval = setInterval(async () => {
    if (!isRecording || !isMultiTabMode) {
      clearInterval(multiTabPollInterval);
      return;
    }
    
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_MULTI_TAB_STATUS' });
      
      recordingTabs = response.tabs || [];
      
      // Update counts
      let totalEvents = 0;
      let totalMarked = 0;
      
      for (const tab of recordingTabs) {
        totalEvents += tab.events?.length || 0;
      }
      
      eventCount.textContent = totalEvents;
      markedCount.textContent = response.tabSequence?.length || 0;
      
      // Update tab count display
      const tabCountEl = document.getElementById('tab-count');
      if (tabCountEl) {
        tabCountEl.textContent = recordingTabs.length;
      }
      
      updateActiveTabsDisplay(recordingTabs);
    } catch (error) {
      console.error('[Recorder Popup] Multi-tab polling failed:', error);
    }
  }, 1000);
}

/**
 * Update display of active recording tabs
 */
function updateActiveTabsDisplay(tabs) {
  let tabsContainer = document.getElementById('active-tabs');
  
  if (!tabsContainer) {
    // Create tabs container if it doesn't exist
    const statusCard = document.querySelector('.status-card');
    if (statusCard) {
      tabsContainer = document.createElement('div');
      tabsContainer.id = 'active-tabs';
      tabsContainer.className = 'active-tabs';
      tabsContainer.innerHTML = '<h4>📑 Recording Tabs (<span id="tab-count">0</span>)</h4><div id="tabs-list"></div>';
      statusCard.appendChild(tabsContainer);
    }
  }
  
  if (!tabsContainer) return;
  
  const tabsList = document.getElementById('tabs-list');
  if (!tabsList) return;
  
  if (tabs.length === 0) {
    tabsContainer.style.display = 'none';
    return;
  }
  
  tabsContainer.style.display = 'block';
  document.getElementById('tab-count').textContent = tabs.length;
  
  tabsList.innerHTML = tabs.map((tab, index) => `
    <div class="tab-item" data-tab-id="${tab.tabId}">
      <span class="tab-icon">${getTabTypeIcon(tab.type)}</span>
      <span class="tab-label">${tab.type || 'Tab ' + (index + 1)}</span>
      <span class="tab-events">${tab.events?.length || 0} events</span>
      <button class="tab-switch-btn" data-tab-id="${tab.tabId}" title="Switch to this tab">→</button>
    </div>
  `).join('');
  
  // Add click handlers for tab switching
  tabsList.querySelectorAll('.tab-switch-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const tabId = parseInt(btn.dataset.tabId);
      await chrome.runtime.sendMessage({ type: 'SWITCH_TO_TAB', tabId: tabId });
    });
  });
}

/**
 * Get icon for tab type
 */
function getTabTypeIcon(type) {
  const icons = {
    'marketplace-create': '🏪',
    'marketplace-item': '📦',
    'marketplace': '🛒',
    'messages': '💬',
    'groups': '👥',
    'profile': '👤',
    'notifications': '🔔',
    'facebook-other': '📱',
    'unknown': '🌐',
  };
  return icons[type] || icons['unknown'];
}

/**
 * Update display with tab-organized session data
 */
function updateTabDisplay(sessionData) {
  if (!sessionData?.tabData) return;
  
  let tabDataContainer = document.getElementById('session-tabs');
  
  if (!tabDataContainer) {
    // Create tab data container
    const content = document.querySelector('.content');
    if (content) {
      tabDataContainer = document.createElement('div');
      tabDataContainer.id = 'session-tabs';
      tabDataContainer.className = 'session-tabs';
      content.appendChild(tabDataContainer);
    }
  }
  
  if (!tabDataContainer) return;
  
  const tabSummary = sessionData.tabData.tabSummary || {};
  const tabCount = Object.keys(tabSummary).length;
  
  if (tabCount <= 1) {
    tabDataContainer.style.display = 'none';
    return;
  }
  
  tabDataContainer.style.display = 'block';
  tabDataContainer.innerHTML = `
    <h3>📊 Tab Summary (${tabCount} tabs)</h3>
    <div class="tab-summary-list">
      ${Object.entries(tabSummary).map(([tabId, summary]) => `
        <div class="tab-summary-item">
          <span class="tab-type-icon">${getTabTypeIcon(summary.tabType)}</span>
          <div class="tab-summary-info">
            <div class="tab-type">${summary.tabType}</div>
            <div class="tab-stats">
              ${summary.eventCount} events • 
              ${summary.clicks} clicks • 
              ${summary.typing} typing
            </div>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="tab-sequence">
      <h4>Tab Switch Sequence:</h4>
      <div class="sequence-timeline">
        ${(sessionData.tabData.tabSequence || []).slice(0, 10).map(seq => `
          <span class="sequence-item ${seq.action}">${seq.action === 'activated' ? '→' : seq.action === 'created' ? '+' : '×'} ${getTabTypeIcon(seq.tabType || 'unknown')}</span>
        `).join('')}
      </div>
    </div>
  `;
}

function updateRecordingUI(recording) {
  if (recording) {
    statusDot.className = 'status-dot recording';
    statusText.textContent = `Recording ${currentMode}...`;
    recordBtn.className = 'record-btn stop';
    recordBtnText.textContent = 'Stop Recording';
  } else {
    statusDot.className = 'status-dot ready';
    statusText.textContent = currentSessionData ? 'Recording complete!' : 'Ready to record';
    recordBtn.className = 'record-btn start';
    recordBtnText.textContent = 'Start Recording';
  }
}

let pollInterval = null;

function startEventCountPolling(tabId) {
  if (pollInterval) {
    clearInterval(pollInterval);
  }
  
  pollInterval = setInterval(async () => {
    if (!isRecording) {
      clearInterval(pollInterval);
      return;
    }
    
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_STATUS' });
      eventCount.textContent = response.eventCount || 0;
      markedCount.textContent = response.markedCount || 0;
    } catch (error) {
      console.error('[Recorder Popup] Polling failed:', error);
    }
  }, 500);
}

// ============================================
// MODE SELECTION
// ============================================

function selectMode(button) {
  modeButtons.forEach(btn => btn.classList.remove('active'));
  button.classList.add('active');
  
  currentMode = button.dataset.mode;
  currentType = button.dataset.type;
  
  console.log('[Recorder Popup] Mode selected:', currentMode, currentType);
}

// ============================================
// SESSION ACTIONS
// ============================================

async function viewSessionData() {
  if (!currentSessionData) {
    alert('No session data available');
    return;
  }
  
  // Open in new tab with session data
  const dataUrl = 'data:application/json;charset=utf-8,' + 
    encodeURIComponent(JSON.stringify(currentSessionData, null, 2));
  
  chrome.tabs.create({ url: dataUrl });
}

async function saveSession() {
  if (!currentSessionData) {
    alert('No session data available');
    return;
  }
  
  saveSessionBtn.disabled = true;
  saveSessionBtn.textContent = 'Saving...';
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_SESSION',
      sessionData: currentSessionData,
    });
    
    if (response.success || response.savedLocally) {
      alert('Session saved successfully!');
      await loadRecentSessions();
    } else {
      throw new Error(response.error || 'Unknown error');
    }
  } catch (error) {
    console.error('[Recorder Popup] Save failed:', error);
    alert('Failed to save session: ' + error.message);
  } finally {
    saveSessionBtn.disabled = false;
    saveSessionBtn.textContent = '💾 Save Session';
  }
}

async function copyAutomationCode() {
  if (!currentSessionData?.automationCode) {
    alert('No automation code available');
    return;
  }
  
  const code = JSON.stringify(currentSessionData.automationCode, null, 2);
  
  try {
    await navigator.clipboard.writeText(code);
    
    copyCodeBtn.textContent = '✓ Copied!';
    setTimeout(() => {
      copyCodeBtn.textContent = '📋 Copy Code';
    }, 2000);
  } catch (error) {
    console.error('[Recorder Popup] Copy failed:', error);
    alert('Failed to copy code');
  }
}

// ============================================
// RECENT SESSIONS
// ============================================

async function loadRecentSessions() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_TRAINING_SESSIONS' });
    
    const sessions = response.sessions || [];
    
    if (sessions.length === 0) {
      recentSessions.classList.add('hidden');
      return;
    }
    
    recentSessions.classList.remove('hidden');
    
    sessionsList.innerHTML = sessions.slice(0, 5).map(session => `
      <div class="session-item" data-session-id="${session.sessionId}">
        <div class="session-id">${session.sessionId}</div>
        <div class="session-meta">
          ${session.mode || 'unknown'} • ${session.totalEvents || 0} events • 
          ${new Date(session.startTime).toLocaleDateString()}
        </div>
      </div>
    `).join('');
    
    // Add click handlers
    sessionsList.querySelectorAll('.session-item').forEach(item => {
      item.addEventListener('click', () => {
        loadSession(item.dataset.sessionId);
      });
    });
  } catch (error) {
    console.error('[Recorder Popup] Load sessions failed:', error);
  }
}

async function loadSession(sessionId) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_TRAINING_SESSION',
      sessionId: sessionId,
    });
    
    if (response.session) {
      currentSessionData = response.session;
      viewSessionBtn.disabled = false;
      saveSessionBtn.disabled = false;
      copyCodeBtn.disabled = false;
      
      statusText.textContent = `Session loaded: ${sessionId}`;
    }
  } catch (error) {
    console.error('[Recorder Popup] Load session failed:', error);
    alert('Failed to load session');
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Auth
  authBtn.addEventListener('click', authenticate);
  authToken.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') authenticate();
  });
  
  // Mode buttons
  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => selectMode(btn));
  });
  
  // Record button
  recordBtn.addEventListener('click', toggleRecording);
  
  // Action buttons
  viewSessionBtn.addEventListener('click', viewSessionData);
  saveSessionBtn.addEventListener('click', saveSession);
  copyCodeBtn.addEventListener('click', copyAutomationCode);
}

console.log('[Recorder Popup] Loaded');
