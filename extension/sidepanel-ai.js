/**
 * DF-Auto Sim Sidepanel Script
 * 
 * Handles UI interactions and communicates with background script
 * Includes advanced vehicle posting with IAI Soldier integration
 */

// ============================================
// DOM Elements
// ============================================

const elements = {
  loadingState: document.getElementById('loadingState'),
  authSection: document.getElementById('authSection'),
  dashboard: document.getElementById('dashboard'),
  loginBtn: document.getElementById('loginBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  disconnectFbBtn: document.getElementById('disconnectFbBtn'),
  
  // User info
  userAvatar: document.getElementById('userAvatar'),
  userName: document.getElementById('userName'),
  userEmail: document.getElementById('userEmail'),
  
  // Stats
  postsCount: document.getElementById('postsCount'),
  leadsCount: document.getElementById('leadsCount'),
  responsesCount: document.getElementById('responsesCount'),
  pendingCount: document.getElementById('pendingCount'),
  
  // Actions
  scanInboxBtn: document.getElementById('scanInboxBtn'),
  postVehicleBtn: document.getElementById('postVehicleBtn'),
  openDashboardBtn: document.getElementById('openDashboardBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  unreadBadge: document.getElementById('unreadBadge'),
  
  // AI Chat
  toggleAiChatBtn: document.getElementById('toggleAiChatBtn'),
  aiChatSection: document.getElementById('aiChatSection'),
  closeAiChatBtn: document.getElementById('closeAiChatBtn'),
  aiChatMessages: document.getElementById('aiChatMessages'),
  aiChatInput: document.getElementById('aiChatInput'),
  sendAiChatBtn: document.getElementById('sendAiChatBtn'),
  
  // Activity
  activityList: document.getElementById('activityList'),
  clearActivityBtn: document.getElementById('clearActivityBtn'),
  
  // Modal Elements
  vehicleModal: document.getElementById('vehicleModal'),
  closeModal: document.getElementById('closeModal'),
  vehicleSearch: document.getElementById('vehicleSearch'),
  vehicleLoading: document.getElementById('vehicleLoading'),
  vehicleSkeleton: document.getElementById('vehicleSkeleton'),
  vehicleList: document.getElementById('vehicleList'),
  emptyState: document.getElementById('emptyState'),
  postingOptions: document.getElementById('postingOptions'),
  cancelPost: document.getElementById('cancelPost'),
  startPost: document.getElementById('startPost'),
  aiDescription: document.getElementById('aiDescription'),
  schedulePost: document.getElementById('schedulePost'),
  
  // Modal Views
  modalSelectView: document.getElementById('modalSelectView'),
  modalProgressView: document.getElementById('modalProgressView'),
  modalSuccessView: document.getElementById('modalSuccessView'),
  modalErrorView: document.getElementById('modalErrorView'),
  
  // Progress Elements
  progressCount: document.getElementById('progressCount'),
  currentVehicleTitle: document.getElementById('currentVehicleTitle'),
  currentVehicleMeta: document.getElementById('currentVehicleMeta'),
  progressStatus: document.getElementById('progressStatus'),
  progressPercent: document.getElementById('progressPercent'),
  progressFill: document.getElementById('progressFill'),
  progressSteps: document.getElementById('progressSteps'),
  cancelProgress: document.getElementById('cancelProgress'),
  
  // Result Elements
  successMessage: document.getElementById('successMessage'),
  errorMessage: document.getElementById('errorMessage'),
  closeSuccess: document.getElementById('closeSuccess'),
  retryPost: document.getElementById('retryPost'),
  closeError: document.getElementById('closeError'),
};

// ============================================
// State
// ============================================

let authState = null;
let activities = [];
let vehicles = [];
let selectedVehicles = new Set();
let postingInProgress = false;
let abortController = null;

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  showLoading();
  
  try {
    // Check authentication state
    const response = await sendMessage({ type: 'GET_AUTH_STATE' });
    authState = response.data;
    
    if (authState?.isAuthenticated) {
      await loadDashboard();
    } else {
      showAuthSection();
    }
  } catch (error) {
    console.error('Initialization error:', error);
    showAuthSection();
  }
});

// ============================================
// UI State Management
// ============================================

function showLoading() {
  elements.loadingState.style.display = 'block';
  elements.authSection.style.display = 'none';
  elements.dashboard.classList.remove('active');
}

function showAuthSection() {
  elements.loadingState.style.display = 'none';
  elements.authSection.style.display = 'block';
  elements.dashboard.classList.remove('active');
}

function showDashboard() {
  elements.loadingState.style.display = 'none';
  elements.authSection.style.display = 'none';
  elements.dashboard.classList.add('active');
}

// ============================================
// Dashboard Loading
// ============================================

async function loadDashboard() {
  try {
    // Get account info
    const accountResponse = await sendMessage({ type: 'GET_ACCOUNT_INFO' });
    const account = accountResponse.data;
    
    if (account) {
      // Update user info
      elements.userName.textContent = account.name || 'Dealer Account';
      elements.userEmail.textContent = account.email || '';
      elements.userAvatar.textContent = (account.name?.[0] || 'D').toUpperCase();
      
      // Update stats
      elements.postsCount.textContent = formatNumber(account.stats?.listings || 0);
      elements.leadsCount.textContent = formatNumber(account.stats?.leads || 0);
      elements.responsesCount.textContent = formatNumber(account.stats?.responses || 0);
      elements.pendingCount.textContent = formatNumber(account.stats?.pendingTasks || 0);
      
      // Show unread badge if any
      if (account.stats?.unreadMessages > 0) {
        elements.unreadBadge.textContent = account.stats.unreadMessages;
        elements.unreadBadge.style.display = 'inline';
      }
    }
    
    // Load activities from storage
    const stored = await chrome.storage.local.get('activities');
    if (stored.activities) {
      activities = stored.activities;
      renderActivities();
    }
    
    showDashboard();
  } catch (error) {
    console.error('Dashboard loading error:', error);
    addActivity('error', 'Failed to load dashboard data');
  }
}

// ============================================
// Event Handlers
// ============================================

// Login
elements.loginBtn.addEventListener('click', async () => {
  elements.loginBtn.disabled = true;
  elements.loginBtn.innerHTML = `
    <div class="spinner" style="width: 20px; height: 20px; border-width: 2px; margin: 0;"></div>
    Connecting...
  `;
  
  try {
    const response = await sendMessage({ type: 'LOGIN' });
    
    if (response.success) {
      addActivity('success', 'Successfully connected to Facebook');
      await loadDashboard();
    } else {
      throw new Error(response.error || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    addActivity('error', `Login failed: ${error.message}`);
    alert('Failed to connect. Please try again.');
  } finally {
    elements.loginBtn.disabled = false;
    elements.loginBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"/>
      </svg>
      Connect with Facebook
    `;
  }
});

// Logout
elements.logoutBtn.addEventListener('click', async () => {
  if (confirm('Are you sure you want to disconnect?')) {
    try {
      await sendMessage({ type: 'LOGOUT' });
      addActivity('info', 'Disconnected from Facebook');
      authState = null;
      showAuthSection();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
});

// Disconnect Facebook & Connect Another Account
elements.disconnectFbBtn?.addEventListener('click', async () => {
  if (confirm('Disconnect current Facebook account and connect a different one?')) {
    try {
      // First disconnect
      await sendMessage({ type: 'DISCONNECT_FACEBOOK' });
      addActivity('info', 'Facebook account disconnected');
      
      // Clear local state
      authState = null;
      await chrome.storage.local.remove(['authState', 'accountId', 'authToken']);
      
      // Then immediately show login again
      showAuthSection();
      
      // Optionally auto-trigger login
      setTimeout(() => {
        elements.loginBtn.click();
      }, 500);
    } catch (error) {
      console.error('Disconnect error:', error);
      addActivity('error', `Disconnect failed: ${error.message}`);
    }
  }
});

// Scan Inbox
elements.scanInboxBtn.addEventListener('click', async () => {
  try {
    elements.scanInboxBtn.disabled = true;
    addActivity('info', 'Scanning Marketplace inbox...');
    
    // Open Facebook Marketplace inbox
    const tabs = await chrome.tabs.query({ url: '*://*.facebook.com/*' });
    
    if (tabs.length === 0) {
      // Open new tab
      await chrome.tabs.create({
        url: 'https://www.facebook.com/marketplace/inbox',
        active: true,
      });
    } else {
      // Navigate existing tab
      await chrome.tabs.update(tabs[0].id, {
        url: 'https://www.facebook.com/marketplace/inbox',
        active: true,
      });
    }
    
    // Wait a bit then request scrape
    setTimeout(async () => {
      const tabs = await chrome.tabs.query({ url: '*://*.facebook.com/marketplace/inbox*' });
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'SCRAPE_INBOX' }, (response) => {
          if (response?.success) {
            const count = response.data.conversations?.length || 0;
            addActivity('success', `Found ${count} conversations`);
            
            // Send to server
            sendMessage({
              type: 'SCRAPE_RESULT',
              data: {
                type: 'inbox',
                ...response.data,
              },
            });
          }
        });
      }
    }, 3000);
    
  } catch (error) {
    console.error('Scan error:', error);
    addActivity('error', `Scan failed: ${error.message}`);
  } finally {
    elements.scanInboxBtn.disabled = false;
  }
});

// Post Vehicle - Open Modal
elements.postVehicleBtn.addEventListener('click', async () => {
  try {
    openVehicleModal();
  } catch (error) {
    console.error('Post vehicle error:', error);
    addActivity('error', `Failed to open posting: ${error.message}`);
  }
});

// Open Dashboard - with auth token for auto-login
elements.openDashboardBtn.addEventListener('click', async () => {
  try {
    const { authToken, refreshToken } = await chrome.storage.local.get(['authToken', 'refreshToken']);
    
    // Use the API extension-login route which sets localStorage and redirects
    let url = 'https://dealersface.com/dashboard';
    if (authToken) {
      url = `https://dealersface.com/api/auth/extension-login?token=${encodeURIComponent(authToken)}${refreshToken ? `&refreshToken=${encodeURIComponent(refreshToken)}` : ''}&redirect=/dashboard`;
    }
    
    await chrome.tabs.create({
      url,
      active: true,
    });
  } catch (error) {
    console.error('Open dashboard error:', error);
    await chrome.tabs.create({
      url: 'https://dealersface.com/dashboard',
      active: true,
    });
  }
});

// Settings - with auth token for auto-login
elements.settingsBtn.addEventListener('click', async () => {
  try {
    const { authToken, refreshToken } = await chrome.storage.local.get(['authToken', 'refreshToken']);
    
    // Use the API extension-login route which sets localStorage and redirects
    let url = 'https://dealersface.com/dashboard/settings';
    if (authToken) {
      url = `https://dealersface.com/api/auth/extension-login?token=${encodeURIComponent(authToken)}${refreshToken ? `&refreshToken=${encodeURIComponent(refreshToken)}` : ''}&redirect=/dashboard/settings`;
    }
    
    await chrome.tabs.create({
      url,
      active: true,
    });
  } catch (error) {
    console.error('Open settings error:', error);
    await chrome.tabs.create({
      url: 'https://dealersface.com/dashboard/settings',
      active: true,
    });
  }
});

// Clear Activity
elements.clearActivityBtn.addEventListener('click', () => {
  activities = [];
  chrome.storage.local.set({ activities: [] });
  renderActivities();
});

// ============================================
// AI Chat
// ============================================

let aiChatVisible = false;

// Toggle AI Chat section
elements.toggleAiChatBtn?.addEventListener('click', () => {
  aiChatVisible = !aiChatVisible;
  elements.aiChatSection.style.display = aiChatVisible ? 'block' : 'none';
  
  if (aiChatVisible) {
    elements.aiChatInput.focus();
  }
});

// Close AI Chat
elements.closeAiChatBtn?.addEventListener('click', () => {
  aiChatVisible = false;
  elements.aiChatSection.style.display = 'none';
});

// Send AI Chat message
elements.sendAiChatBtn?.addEventListener('click', sendAiMessage);

// Send on Enter key
elements.aiChatInput?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendAiMessage();
  }
});

async function sendAiMessage() {
  const message = elements.aiChatInput.value.trim();
  if (!message) return;
  
  // Add user message to chat
  addAiMessage('user', message);
  elements.aiChatInput.value = '';
  
  // Show typing indicator
  showTypingIndicator();
  
  try {
    const response = await sendMessage({ type: 'AI_CHAT', content: message });
    console.log('AI chat response:', response);
    
    // Remove typing indicator
    removeTypingIndicator();
    
    // Handle both wrapped {success, data} and direct response formats
    const aiResponse = response?.data?.response || response?.response || response?.data || null;
    
    if (aiResponse && typeof aiResponse === 'string') {
      addAiMessage('assistant', aiResponse);
    } else if (response.success === false) {
      addAiMessage('assistant', response.error || 'Sorry, I encountered an error. Please try again.');
    } else {
      addAiMessage('assistant', 'I received your message but couldn\'t generate a proper response. Please try again.');
    }
  } catch (error) {
    console.error('AI chat error:', error);
    removeTypingIndicator();
    addAiMessage('assistant', 'Sorry, I\'m having trouble connecting. Please try again.');
  }
}

function addAiMessage(role, content) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `ai-message ${role}`;
  
  const avatar = role === 'user' ? '👤' : '🤖';
  
  messageDiv.innerHTML = `
    <span class="ai-msg-avatar">${avatar}</span>
    <div class="ai-msg-content">${escapeHtml(content).replace(/\n/g, '<br>')}</div>
  `;
  
  elements.aiChatMessages.appendChild(messageDiv);
  elements.aiChatMessages.scrollTop = elements.aiChatMessages.scrollHeight;
}

function showTypingIndicator() {
  const typingDiv = document.createElement('div');
  typingDiv.className = 'ai-message assistant';
  typingDiv.id = 'ai-typing-indicator';
  typingDiv.innerHTML = `
    <span class="ai-msg-avatar">🤖</span>
    <div class="ai-msg-content">
      <div class="ai-typing">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;
  elements.aiChatMessages.appendChild(typingDiv);
  elements.aiChatMessages.scrollTop = elements.aiChatMessages.scrollHeight;
}

function removeTypingIndicator() {
  const typingIndicator = document.getElementById('ai-typing-indicator');
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

// ============================================
// Activity Log
// ============================================

function addActivity(type, message) {
  const activity = {
    type,
    message,
    timestamp: new Date().toISOString(),
  };
  
  activities.unshift(activity);
  
  // Keep only last 50
  if (activities.length > 50) {
    activities = activities.slice(0, 50);
  }
  
  // Save to storage
  chrome.storage.local.set({ activities });
  
  renderActivities();
}

function renderActivities() {
  elements.activityList.innerHTML = activities.map(activity => {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    };
    
    const iconClasses = {
      success: 'success',
      error: 'error',
      warning: 'warning',
      info: 'info',
    };
    
    const timeAgo = getTimeAgo(new Date(activity.timestamp));
    
    return `
      <div class="activity-item">
        <div class="activity-icon ${iconClasses[activity.type] || 'info'}">
          ${icons[activity.type] || 'ℹ️'}
        </div>
        <div class="activity-content">
          <p>${escapeHtml(activity.message)}</p>
          <span>${timeAgo}</span>
        </div>
      </div>
    `;
  }).join('');
  
  if (activities.length === 0) {
    elements.activityList.innerHTML = `
      <div class="activity-item">
        <div class="activity-icon info">📋</div>
        <div class="activity-content">
          <p>No recent activity</p>
          <span>Activities will appear here</span>
        </div>
      </div>
    `;
  }
}

// ============================================
// Utilities
// ============================================

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  
  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// Listen for Updates
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'STATS_UPDATE':
      elements.postsCount.textContent = formatNumber(message.stats.listings || 0);
      elements.leadsCount.textContent = formatNumber(message.stats.leads || 0);
      elements.responsesCount.textContent = formatNumber(message.stats.responses || 0);
      elements.pendingCount.textContent = formatNumber(message.stats.pendingTasks || 0);
      break;
      
    case 'ACTIVITY':
      addActivity(message.activityType, message.message);
      break;
      
    case 'AUTH_CHANGED':
      if (message.isAuthenticated) {
        loadDashboard();
      } else {
        showAuthSection();
      }
      break;
  }
});

// Refresh stats periodically
setInterval(async () => {
  if (authState?.isAuthenticated) {
    try {
      const response = await sendMessage({ type: 'GET_ACCOUNT_INFO' });
      if (response.data?.stats) {
        elements.postsCount.textContent = formatNumber(response.data.stats.listings || 0);
        elements.leadsCount.textContent = formatNumber(response.data.stats.leads || 0);
        elements.responsesCount.textContent = formatNumber(response.data.stats.responses || 0);
        elements.pendingCount.textContent = formatNumber(response.data.stats.pendingTasks || 0);
      }
    } catch (error) {
      // Silent fail for periodic updates
    }
  }
}, 30000);

// ============================================
// Vehicle Posting System
// ============================================

/**
 * Open the vehicle posting modal
 */
async function openVehicleModal() {
  // Reset state
  selectedVehicles.clear();
  vehicles = [];
  
  // Show modal
  elements.vehicleModal.classList.add('active');
  showModalView('select');
  
  // Show skeleton loading
  elements.vehicleSkeleton.style.display = 'block';
  elements.vehicleList.innerHTML = '';
  elements.emptyState.style.display = 'none';
  elements.postingOptions.style.display = 'none';
  
  // Fetch vehicles
  await fetchVehicles();
}

/**
 * Close the modal
 */
function closeVehicleModal() {
  elements.vehicleModal.classList.remove('active');
  
  // Cancel any ongoing operation
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  
  postingInProgress = false;
}

/**
 * Switch between modal views
 */
function showModalView(view) {
  elements.modalSelectView.style.display = view === 'select' ? 'block' : 'none';
  elements.modalProgressView.style.display = view === 'progress' ? 'block' : 'none';
  elements.modalSuccessView.style.display = view === 'success' ? 'block' : 'none';
  elements.modalErrorView.style.display = view === 'error' ? 'block' : 'none';
}

/**
 * Fetch vehicles from API
 */
async function fetchVehicles() {
  try {
    console.log('🚗 [Sidepanel] Fetching vehicles...');
    const response = await sendMessage({ type: 'GET_VEHICLES' });
    
    console.log('🚗 [Sidepanel] Response received:', JSON.stringify(response).substring(0, 300));
    console.log('🚗 [Sidepanel] response.success:', response?.success);
    console.log('🚗 [Sidepanel] response.data:', response?.data);
    console.log('🚗 [Sidepanel] response.data?.length:', response?.data?.length);
    
    elements.vehicleSkeleton.style.display = 'none';
    
    if (response && response.success && response.data && response.data.length > 0) {
      console.log('🚗 [Sidepanel] ✅ Rendering', response.data.length, 'vehicles');
      vehicles = response.data;
      renderVehicleList(vehicles);
      elements.postingOptions.style.display = 'block';
    } else {
      console.log('🚗 [Sidepanel] ❌ No vehicles or unsuccessful response');
      elements.emptyState.style.display = 'block';
    }
  } catch (error) {
    console.error('🚗 [Sidepanel] Failed to fetch vehicles:', error);
    elements.vehicleSkeleton.style.display = 'none';
    elements.emptyState.style.display = 'block';
    elements.emptyState.querySelector('p').textContent = 
      'Failed to load vehicles. Please check your connection.';
  }
}

/**
 * Render the vehicle list
 */
function renderVehicleList(vehiclesToRender) {
  elements.vehicleList.innerHTML = vehiclesToRender.map(vehicle => {
    const isSelected = selectedVehicles.has(vehicle.id);
    const thumbUrl = vehicle.images?.[0]?.url || vehicle.imageUrl || '';
    const stockNum = vehicle.stockNumber || vehicle.stock || vehicle.stockNum || '';
    const vinLast6 = vehicle.vin ? vehicle.vin.slice(-6) : '';
    
    return `
      <div class="vehicle-item ${isSelected ? 'selected' : ''}" data-id="${vehicle.id}">
        <div class="vehicle-thumb">
          ${thumbUrl 
            ? `<img src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(vehicle.title || '')}" onerror="this.parentElement.innerHTML='<div class=vehicle-thumb-placeholder>🚗</div>'">`
            : '<div class="vehicle-thumb-placeholder">🚗</div>'
          }
        </div>
        <div class="vehicle-details">
          <div class="vehicle-title">${escapeHtml(vehicle.year || '')} ${escapeHtml(vehicle.make || '')} ${escapeHtml(vehicle.model || '')}</div>
          <div class="vehicle-meta">
            <span class="vehicle-price">$${formatNumber(vehicle.price || 0)}</span>
            <span>${formatNumber(vehicle.mileage || 0)} mi</span>
            ${stockNum ? `<span class="vehicle-stock">#${escapeHtml(stockNum)}</span>` : ''}
            ${vinLast6 ? `<span class="vehicle-vin" title="VIN: ${escapeHtml(vehicle.vin || '')}">...${escapeHtml(vinLast6)}</span>` : ''}
          </div>
        </div>
        <div class="vehicle-checkbox">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
      </div>
    `;
  }).join('');
  
  // Add click handlers
  elements.vehicleList.querySelectorAll('.vehicle-item').forEach(item => {
    item.addEventListener('click', () => toggleVehicleSelection(item.dataset.id));
  });
  
  updateStartButton();
}

/**
 * Toggle vehicle selection
 */
function toggleVehicleSelection(vehicleId) {
  if (selectedVehicles.has(vehicleId)) {
    selectedVehicles.delete(vehicleId);
  } else {
    selectedVehicles.add(vehicleId);
  }
  
  // Update UI
  const item = elements.vehicleList.querySelector(`[data-id="${vehicleId}"]`);
  if (item) {
    item.classList.toggle('selected', selectedVehicles.has(vehicleId));
  }
  
  updateStartButton();
}

/**
 * Update the Start Posting button state
 */
function updateStartButton() {
  const count = selectedVehicles.size;
  elements.startPost.disabled = count === 0;
  elements.startPost.innerHTML = count > 0 
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg> Post ${count} Vehicle${count > 1 ? 's' : ''}`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg> Start Posting`;
}

/**
 * Start the posting process
 */
async function startPosting() {
  if (selectedVehicles.size === 0 || postingInProgress) return;
  
  postingInProgress = true;
  abortController = new AbortController();
  
  const selectedList = Array.from(selectedVehicles);
  const vehiclesToPost = vehicles.filter(v => selectedList.includes(v.id));
  const useAI = elements.aiDescription.checked;
  const scheduled = elements.schedulePost.checked;
  
  // Switch to progress view
  showModalView('progress');
  elements.progressCount.textContent = `0/${vehiclesToPost.length}`;
  
  let completed = 0;
  let failed = 0;
  const errors = [];
  
  for (let i = 0; i < vehiclesToPost.length; i++) {
    if (abortController.signal.aborted) {
      addActivity('warning', 'Posting cancelled by user');
      break;
    }
    
    const vehicle = vehiclesToPost[i];
    
    // Update current vehicle display
    updateProgressVehicle(vehicle);
    elements.progressCount.textContent = `${i}/${vehiclesToPost.length}`;
    
    try {
      // Add random delay if scheduled
      if (scheduled && i > 0) {
        const delay = Math.floor(Math.random() * 30000) + 10000; // 10-40 seconds
        updateProgressStatus('Waiting before next post...', (i / vehiclesToPost.length) * 100);
        await sleep(delay);
      }
      
      // Post the vehicle
      await postVehicle(vehicle, useAI);
      completed++;
      addActivity('success', `Posted: ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
      
    } catch (error) {
      console.error(`Failed to post vehicle ${vehicle.id}:`, error);
      failed++;
      errors.push({ vehicle, error: error.message });
      addActivity('error', `Failed: ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
    }
    
    // Update progress
    const progress = ((i + 1) / vehiclesToPost.length) * 100;
    updateProgressStatus(`Posted ${completed} of ${vehiclesToPost.length}`, progress);
  }
  
  postingInProgress = false;
  
  // Show result
  if (completed > 0 && failed === 0) {
    elements.successMessage.textContent = 
      `Successfully posted ${completed} vehicle${completed > 1 ? 's' : ''} to Facebook Marketplace!`;
    showModalView('success');
  } else if (completed > 0 && failed > 0) {
    elements.successMessage.textContent = 
      `Posted ${completed} vehicle${completed > 1 ? 's' : ''}, ${failed} failed. Check activity log for details.`;
    showModalView('success');
  } else {
    elements.errorMessage.textContent = errors[0]?.error || 'Failed to post vehicles. Please try again.';
    showModalView('error');
  }
}

/**
 * Post a single vehicle
 */
async function postVehicle(vehicle, useAI) {
  // Update progress steps
  setProgressStep('navigate', 'active');
  updateProgressStatus('Opening Facebook Marketplace...', 10);
  
  // Find or open Facebook tab
  let tab = await getOrCreateFacebookTab();
  
  // Navigate to create listing
  await chrome.tabs.update(tab.id, { 
    url: 'https://www.facebook.com/marketplace/create/vehicle/',
    active: true 
  });
  
  await waitForTabLoad(tab.id);
  setProgressStep('navigate', 'completed');
  
  // Fill form
  setProgressStep('form', 'active');
  updateProgressStatus('Filling vehicle details...', 30);
  
  // Prepare vehicle data with optional AI description
  let description = vehicle.description || '';
  if (useAI && (!description || description.length < 50)) {
    updateProgressStatus('Generating AI description...', 35);
    try {
      const aiResponse = await sendMessage({
        type: 'GENERATE_DESCRIPTION',
        vehicle: vehicle
      });
      if (aiResponse.success && aiResponse.description) {
        description = aiResponse.description;
      }
    } catch (e) {
      console.warn('AI description failed, using original:', e);
    }
  }
  
  const vehicleData = {
    ...vehicle,
    description: description
  };
  
  // Send to content script to fill the form
  await sendToTab(tab.id, {
    type: 'IAI_FILL_LISTING',
    vehicle: vehicleData
  });
  
  await sleep(2000);
  setProgressStep('form', 'completed');
  
  // Upload images
  setProgressStep('images', 'active');
  updateProgressStatus('Uploading photos...', 60);
  
  if (vehicle.images?.length > 0 || vehicle.imageUrl) {
    const images = vehicle.images?.map(i => i.url) || [vehicle.imageUrl];
    await sendToTab(tab.id, {
      type: 'IAI_UPLOAD_IMAGES',
      images: images.filter(Boolean)
    });
    await sleep(3000);
  }
  
  setProgressStep('images', 'completed');
  
  // Publish
  setProgressStep('publish', 'active');
  updateProgressStatus('Publishing listing...', 85);
  
  await sendToTab(tab.id, { type: 'IAI_PUBLISH_LISTING' });
  await sleep(3000);
  
  setProgressStep('publish', 'completed');
  updateProgressStatus('Complete!', 100);
  
  // Record the posting
  await sendMessage({
    type: 'RECORD_POSTING',
    vehicleId: vehicle.id,
    platform: 'facebook_marketplace',
    status: 'completed'
  });
  
  await sleep(1000);
}

/**
 * Update progress display
 */
function updateProgressVehicle(vehicle) {
  const thumb = document.querySelector('#currentVehicle .vehicle-thumb');
  if (vehicle.images?.[0]?.url || vehicle.imageUrl) {
    thumb.innerHTML = `<img src="${vehicle.images?.[0]?.url || vehicle.imageUrl}" alt="">`;
  } else {
    thumb.innerHTML = '<div class="vehicle-thumb-placeholder">🚗</div>';
  }
  
  elements.currentVehicleTitle.textContent = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  elements.currentVehicleMeta.textContent = `$${formatNumber(vehicle.price)} • ${formatNumber(vehicle.mileage)} mi`;
}

function updateProgressStatus(status, percent) {
  elements.progressStatus.textContent = status;
  elements.progressPercent.textContent = `${Math.round(percent)}%`;
  elements.progressFill.style.width = `${percent}%`;
}

function setProgressStep(stepName, status) {
  const steps = elements.progressSteps.querySelectorAll('.progress-step');
  steps.forEach(step => {
    const isTarget = step.dataset.step === stepName;
    step.classList.remove('active', 'completed');
    
    if (isTarget && status === 'active') {
      step.classList.add('active');
      step.querySelector('.step-icon').innerHTML = '<div class="step-spinner"></div>';
    } else if (isTarget && status === 'completed') {
      step.classList.add('completed');
      step.querySelector('.step-icon').innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>`;
    }
  });
}

function resetProgressSteps() {
  const icons = {
    navigate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>',
    form: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>',
    images: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
    publish: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>'
  };
  
  elements.progressSteps.querySelectorAll('.progress-step').forEach(step => {
    step.classList.remove('active', 'completed');
    step.querySelector('.step-icon').innerHTML = icons[step.dataset.step] || '';
  });
}

// ============================================
// Helper Functions for Posting
// ============================================

async function getOrCreateFacebookTab() {
  const tabs = await chrome.tabs.query({ url: '*://*.facebook.com/*' });
  
  if (tabs.length > 0) {
    return tabs[0];
  }
  
  return await chrome.tabs.create({
    url: 'https://www.facebook.com/marketplace/',
    active: true
  });
}

async function waitForTabLoad(tabId, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkTab = async () => {
      if (Date.now() - startTime > timeout) {
        reject(new Error('Tab load timeout'));
        return;
      }
      
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === 'complete') {
          await sleep(1000); // Extra wait for Facebook's JS
          resolve();
        } else {
          setTimeout(checkTab, 500);
        }
      } catch (e) {
        reject(e);
      }
    };
    
    checkTab();
  });
}

async function sendToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// Modal Event Listeners
// ============================================

// Close modal events
elements.closeModal?.addEventListener('click', closeVehicleModal);
elements.cancelPost?.addEventListener('click', closeVehicleModal);
elements.closeSuccess?.addEventListener('click', closeVehicleModal);
elements.closeError?.addEventListener('click', closeVehicleModal);

// Cancel progress
elements.cancelProgress?.addEventListener('click', () => {
  if (abortController) {
    abortController.abort();
  }
  closeVehicleModal();
});

// Retry after error
elements.retryPost?.addEventListener('click', () => {
  showModalView('select');
  resetProgressSteps();
});

// Start posting
elements.startPost?.addEventListener('click', startPosting);

// Search filter - supports stock#, VIN, year, make, model, and keywords
elements.vehicleSearch?.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  
  if (!query) {
    renderVehicleList(vehicles);
    return;
  }
  
  // Split query into terms for multi-word search
  const terms = query.split(/\s+/).filter(t => t.length > 0);
  
  const filtered = vehicles.filter(v => {
    // Build searchable text from multiple fields
    const searchFields = [
      v.year?.toString() || '',
      v.make || '',
      v.model || '',
      v.trim || '',
      v.vin || '',
      v.stockNumber || v.stock || v.stockNum || '',
      v.exteriorColor || v.color || '',
      v.transmission || '',
      v.engine || '',
      v.title || '',
      v.description || '',
    ].join(' ').toLowerCase();
    
    // All terms must match (AND search)
    return terms.every(term => searchFields.includes(term));
  });
  
  renderVehicleList(filtered);
});

// Posting options buttons
document.querySelectorAll('.option-btn[data-groups]')?.forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.option-btn[data-groups]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// Toggle switches
document.querySelectorAll('.toggle')?.forEach(toggle => {
  toggle.addEventListener('click', () => {
    const input = toggle.previousElementSibling;
    input.checked = !input.checked;
  });
});

// Close modal on overlay click
elements.vehicleModal?.addEventListener('click', (e) => {
  if (e.target === elements.vehicleModal) {
    closeVehicleModal();
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && elements.vehicleModal.classList.contains('active')) {
    closeVehicleModal();
  }
});
