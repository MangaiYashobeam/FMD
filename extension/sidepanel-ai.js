/**
 * DF-Auto Sim Sidepanel Script
 * 
 * Handles UI interactions and communicates with background script
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
  
  // Activity
  activityList: document.getElementById('activityList'),
  clearActivityBtn: document.getElementById('clearActivityBtn'),
};

// ============================================
// State
// ============================================

let authState = null;
let activities = [];

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

// Post Vehicle
elements.postVehicleBtn.addEventListener('click', async () => {
  try {
    // Open Dealers Face vehicle posting page
    await chrome.tabs.create({
      url: 'https://dealersface.com/dashboard/post',
      active: true,
    });
    addActivity('info', 'Opening vehicle posting interface...');
  } catch (error) {
    console.error('Post vehicle error:', error);
  }
});

// Open Dashboard
elements.openDashboardBtn.addEventListener('click', async () => {
  await chrome.tabs.create({
    url: 'https://dealersface.com/dashboard',
    active: true,
  });
});

// Settings
elements.settingsBtn.addEventListener('click', async () => {
  await chrome.tabs.create({
    url: 'https://dealersface.com/dashboard/settings',
    active: true,
  });
});

// Clear Activity
elements.clearActivityBtn.addEventListener('click', () => {
  activities = [];
  chrome.storage.local.set({ activities: [] });
  renderActivities();
});

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
