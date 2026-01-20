// Dealers Face Chrome Extension - Side Panel JavaScript

const API_BASE_URL = 'https://fmd-production.up.railway.app';

// Sanitize HTML to prevent XSS attacks
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// State
let state = {
  user: null,
  vehicles: [],
  groups: [],
  queue: [],
  searchQuery: '',
};

// DOM Elements
const elements = {
  loginView: document.getElementById('login-view'),
  dashboardView: document.getElementById('dashboard-view'),
  loginForm: document.getElementById('login-form'),
  loginError: document.getElementById('login-error'),
  loginBtn: document.getElementById('login-btn'),
  logoutBtn: document.getElementById('logout-btn'),
  refreshBtn: document.getElementById('refresh-btn'),
  
  // User info
  userAvatar: document.getElementById('user-avatar'),
  userName: document.getElementById('user-name'),
  userDealership: document.getElementById('user-dealership'),
  
  // Stats
  statVehicles: document.getElementById('stat-vehicles'),
  statPosted: document.getElementById('stat-posted'),
  statPending: document.getElementById('stat-pending'),
  
  // Tabs
  tabs: document.querySelectorAll('.tab'),
  vehiclesTab: document.getElementById('vehicles-tab'),
  queueTab: document.getElementById('queue-tab'),
  groupsTab: document.getElementById('groups-tab'),
  
  // Lists
  vehiclesList: document.getElementById('vehicles-list'),
  queueList: document.getElementById('queue-list'),
  groupsList: document.getElementById('groups-list'),
  
  // Search
  searchVehicles: document.getElementById('search-vehicles'),
  
  // Buttons
  postQueueBtn: document.getElementById('post-queue-btn'),
  addGroupBtn: document.getElementById('add-group-btn'),
  
  // Modal
  postModal: document.getElementById('post-modal'),
  closeModal: document.getElementById('close-modal'),
  cancelPost: document.getElementById('cancel-post'),
  confirmPost: document.getElementById('confirm-post'),
  modalVehicleInfo: document.getElementById('modal-vehicle-info'),
  modalGroupsList: document.getElementById('modal-groups-list'),
};

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  await checkAuth();
  setupEventListeners();
}

// Auth Functions
async function checkAuth() {
  try {
    const result = await chrome.storage.local.get(['authToken', 'user']);
    
    if (result.authToken && result.user) {
      state.user = result.user;
      showDashboard();
      loadData();
    } else {
      showLogin();
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    showLogin();
  }
}

async function login(email, password) {
  try {
    showLoginLoading(true);
    hideLoginError();
    
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }
    
    // Store token and user
    await chrome.storage.local.set({
      authToken: data.data.accessToken,
      refreshToken: data.data.refreshToken,
      user: data.data.user,
    });
    
    state.user = data.data.user;
    showDashboard();
    loadData();
  } catch (error) {
    showLoginError(error.message);
  } finally {
    showLoginLoading(false);
  }
}

async function logout() {
  await chrome.storage.local.remove(['authToken', 'refreshToken', 'user']);
  state = { user: null, vehicles: [], groups: [], queue: [], searchQuery: '' };
  showLogin();
}

// API Functions
async function apiRequest(endpoint, method = 'GET', body = null) {
  const result = await chrome.storage.local.get(['authToken']);
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  if (result.authToken) {
    options.headers['Authorization'] = `Bearer ${result.authToken}`;
  }
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  const data = await response.json();
  
  if (!response.ok) {
    if (response.status === 401) {
      // Token expired, logout
      await logout();
      throw new Error('Session expired. Please login again.');
    }
    throw new Error(data.message || 'API request failed');
  }
  
  return data;
}

async function loadData() {
  await Promise.all([
    loadVehicles(),
    loadGroups(),
  ]);
  updateStats();
}

async function loadVehicles() {
  try {
    elements.vehiclesList.innerHTML = `
      <div class="loading">
        <span class="spinner"></span>
        Loading vehicles...
      </div>
    `;
    
    const data = await apiRequest('/api/vehicles');
    state.vehicles = data.data?.vehicles || [];
    renderVehicles();
  } catch (error) {
    console.error('Failed to load vehicles:', error);
    elements.vehiclesList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">⚠️</span>
        <p>Failed to load vehicles</p>
      </div>
    `;
  }
}

async function loadGroups() {
  try {
    elements.groupsList.innerHTML = `
      <div class="loading">
        <span class="spinner"></span>
        Loading groups...
      </div>
    `;
    
    const data = await apiRequest('/api/facebook/groups');
    state.groups = data.data?.groups || [];
    renderGroups();
  } catch (error) {
    console.error('Failed to load groups:', error);
    state.groups = [];
    renderGroups();
  }
}

// Render Functions
function renderVehicles() {
  const filtered = state.vehicles.filter(v => {
    if (!state.searchQuery) return true;
    const search = state.searchQuery.toLowerCase();
    const title = `${v.year} ${v.make} ${v.model}`.toLowerCase();
    return title.includes(search) || v.stockNumber?.toLowerCase().includes(search);
  });
  
  if (filtered.length === 0) {
    elements.vehiclesList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🚗</span>
        <p>${state.searchQuery ? 'No vehicles found' : 'No vehicles in inventory'}</p>
      </div>
    `;
    return;
  }
  
  // Use escapeHtml to prevent XSS from vehicle data
  elements.vehiclesList.innerHTML = filtered.map(vehicle => `
    <div class="list-item" data-vehicle-id="${escapeHtml(vehicle.id)}">
      ${vehicle.photos?.[0] 
        ? `<img src="${escapeHtml(vehicle.photos[0])}" alt="${escapeHtml(vehicle.year)} ${escapeHtml(vehicle.make)}" class="vehicle-image">` 
        : '<div class="vehicle-image-placeholder">🚗</div>'
      }
      <div class="vehicle-info">
        <div class="vehicle-title">${escapeHtml(vehicle.year)} ${escapeHtml(vehicle.make)} ${escapeHtml(vehicle.model)}</div>
        <div class="vehicle-details">
          <span class="vehicle-price">$${vehicle.price?.toLocaleString() || 'N/A'}</span>
          <span>${escapeHtml(vehicle.stockNumber) || ''}</span>
        </div>
      </div>
      <div class="vehicle-status">
        <span class="status-dot ${vehicle.postedToFacebook ? 'posted' : 'not-posted'}"></span>
      </div>
    </div>
  `).join('');
  
  // Add click handlers
  elements.vehiclesList.querySelectorAll('.list-item').forEach(item => {
    item.addEventListener('click', () => {
      const vehicleId = item.dataset.vehicleId;
      const vehicle = state.vehicles.find(v => v.id === vehicleId);
      if (vehicle) {
        showPostModal(vehicle);
      }
    });
  });
}

function renderGroups() {
  if (state.groups.length === 0) {
    elements.groupsList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">👥</span>
        <p>No Facebook groups connected</p>
      </div>
    `;
    return;
  }
  
  // Use escapeHtml to prevent XSS from group data
  elements.groupsList.innerHTML = state.groups.map(group => `
    <div class="group-item" data-group-id="${escapeHtml(group.id)}">
      <div class="group-info">
        <div class="group-icon">👥</div>
        <div>
          <div class="group-name">${escapeHtml(group.name)}</div>
          <div class="group-members">${group.memberCount?.toLocaleString() || '?'} members</div>
        </div>
      </div>
      <label class="toggle">
        <input type="checkbox" ${group.autoPost ? 'checked' : ''} data-group-id="${escapeHtml(group.id)}">
        <span class="toggle-slider"></span>
      </label>
    </div>
  `).join('');
}

function renderQueue() {
  if (state.queue.length === 0) {
    elements.queueList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📋</span>
        <p>No vehicles in queue</p>
      </div>
    `;
    elements.postQueueBtn.disabled = true;
    return;
  }
  
  // Use escapeHtml to prevent XSS from queue data
  elements.queueList.innerHTML = state.queue.map(item => `
    <div class="list-item">
      <div class="vehicle-image-placeholder">🚗</div>
      <div class="vehicle-info">
        <div class="vehicle-title">${escapeHtml(item.vehicle.year)} ${escapeHtml(item.vehicle.make)} ${escapeHtml(item.vehicle.model)}</div>
        <div class="vehicle-details">
          <span>${item.groups.length} group(s)</span>
        </div>
      </div>
      <button class="btn btn-small btn-secondary" data-remove-queue="${item.vehicle.id}">×</button>
    </div>
  `).join('');
  
  elements.postQueueBtn.disabled = false;
}

function updateStats() {
  elements.statVehicles.textContent = state.vehicles.length;
  elements.statPosted.textContent = state.vehicles.filter(v => v.postedToFacebook).length;
  elements.statPending.textContent = state.queue.length;
}

// UI Functions
function showLogin() {
  elements.loginView.classList.remove('hidden');
  elements.dashboardView.classList.add('hidden');
}

function showDashboard() {
  elements.loginView.classList.add('hidden');
  elements.dashboardView.classList.remove('hidden');
  
  if (state.user) {
    const initials = state.user.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
    elements.userAvatar.textContent = initials;
    elements.userName.textContent = state.user.name || 'User';
    elements.userDealership.textContent = state.user.dealership?.name || 'Dealership';
  }
}

function showLoginLoading(loading) {
  const btnText = elements.loginBtn.querySelector('.btn-text');
  const btnLoading = elements.loginBtn.querySelector('.btn-loading');
  
  if (loading) {
    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');
    elements.loginBtn.disabled = true;
  } else {
    btnText.classList.remove('hidden');
    btnLoading.classList.add('hidden');
    elements.loginBtn.disabled = false;
  }
}

function showLoginError(message) {
  elements.loginError.textContent = message;
  elements.loginError.classList.remove('hidden');
}

function hideLoginError() {
  elements.loginError.classList.add('hidden');
}

function showPostModal(vehicle) {
  elements.modalVehicleInfo.innerHTML = `
    ${vehicle.photos?.[0] 
      ? `<img src="${vehicle.photos[0]}" alt="" class="vehicle-image">` 
      : '<div class="vehicle-image-placeholder">🚗</div>'
    }
    <div class="vehicle-info">
      <div class="vehicle-title">${vehicle.year} ${vehicle.make} ${vehicle.model}</div>
      <div class="vehicle-details">
        <span class="vehicle-price">$${vehicle.price?.toLocaleString() || 'N/A'}</span>
      </div>
    </div>
  `;
  
  elements.modalGroupsList.innerHTML = state.groups.length > 0 
    ? state.groups.map(group => `
        <label class="checkbox-item">
          <input type="checkbox" value="${group.id}" ${group.autoPost ? 'checked' : ''}>
          <span>${group.name}</span>
        </label>
      `).join('')
    : '<p style="color: #64748b; text-align: center;">No groups connected</p>';
  
  elements.postModal.classList.remove('hidden');
  elements.postModal.dataset.vehicleId = vehicle.id;
}

function hidePostModal() {
  elements.postModal.classList.add('hidden');
  delete elements.postModal.dataset.vehicleId;
}

function switchTab(tabName) {
  elements.tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  
  elements.vehiclesTab.classList.toggle('hidden', tabName !== 'vehicles');
  elements.queueTab.classList.toggle('hidden', tabName !== 'queue');
  elements.groupsTab.classList.toggle('hidden', tabName !== 'groups');
}

// Event Listeners
function setupEventListeners() {
  // Login form
  elements.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    await login(email, password);
  });
  
  // Logout
  elements.logoutBtn.addEventListener('click', logout);
  
  // Refresh
  elements.refreshBtn.addEventListener('click', loadData);
  
  // Tabs
  elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  
  // Search
  elements.searchVehicles.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderVehicles();
  });
  
  // Modal
  elements.closeModal.addEventListener('click', hidePostModal);
  elements.cancelPost.addEventListener('click', hidePostModal);
  elements.postModal.addEventListener('click', (e) => {
    if (e.target === elements.postModal) hidePostModal();
  });
  
  // Confirm post
  elements.confirmPost.addEventListener('click', async () => {
    const vehicleId = elements.postModal.dataset.vehicleId;
    const selectedGroups = Array.from(
      elements.modalGroupsList.querySelectorAll('input:checked')
    ).map(input => input.value);
    
    if (selectedGroups.length === 0) {
      alert('Please select at least one group');
      return;
    }
    
    const vehicle = state.vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      state.queue.push({ vehicle, groups: selectedGroups });
      updateStats();
      renderQueue();
      hidePostModal();
    }
  });
  
  // Add group
  elements.addGroupBtn.addEventListener('click', () => {
    // Open Facebook groups page
    chrome.tabs.create({ url: 'https://www.facebook.com/groups/' });
  });
}

console.log('Dealers Face side panel loaded');
