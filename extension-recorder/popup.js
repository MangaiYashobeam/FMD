/**
 * FMD Training Recorder - Popup UI Controller
 */

// ============================================
// STATE
// ============================================

let isRecording = false;
let currentMode = 'listing';
let currentType = 'iai';
let currentSessionData = null;

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
  
  // Check authentication
  const isAdmin = await checkAdminAuth();
  
  if (isAdmin) {
    showMainSection();
    await loadRecordingStatus();
    await loadRecentSessions();
  } else {
    showAuthSection();
  }
  
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
      statusText.textContent = 'Open Facebook to record';
      recordBtn.disabled = true;
      return;
    }
    
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' });
    
    if (response.isRecording) {
      isRecording = true;
      updateRecordingUI(true);
      eventCount.textContent = response.eventCount || 0;
      markedCount.textContent = response.markedCount || 0;
    }
    
    recordBtn.disabled = false;
  } catch (error) {
    console.error('[Recorder Popup] Status check failed:', error);
    statusText.textContent = 'Extension not loaded on this page';
    recordBtn.disabled = true;
  }
}

async function toggleRecording() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab) {
    alert('No active tab found');
    return;
  }
  
  try {
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
