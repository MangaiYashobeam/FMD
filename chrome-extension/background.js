// Background service worker for Dealers Face Chrome Extension

let apiUrl = 'https://dealersface.com/api';
let authToken = null;
let apiKey = null; // API key for extension auth

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Dealers Face extension installed');
  
  // Load saved settings
  chrome.storage.local.get(['apiUrl', 'authToken', 'apiKey'], (result) => {
    if (result.apiUrl) apiUrl = result.apiUrl;
    if (result.authToken) authToken = result.authToken;
    if (result.apiKey) apiKey = result.apiKey;
  });
});

// Helper to get auth headers (supports both JWT and API key)
function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  
  // Prefer API key for extension operations
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  } else if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  return headers;
}

// Check if authenticated (either method)
function isAuthenticated() {
  return !!(authToken || apiKey);
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);

  switch (request.action) {
    case 'login':
      handleLogin(request.data)
        .then(sendResponse)
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open for async response

    case 'loginWithApiKey':
      handleApiKeyLogin(request.data)
        .then(sendResponse)
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'logout':
      handleLogout()
        .then(sendResponse)
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'getCredentials':
      getFacebookCredentials()
        .then(sendResponse)
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'getVehicles':
      getVehicles(request.accountId)
        .then(sendResponse)
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'postVehicle':
      initiateMarketplacePost(request.vehicleData)
        .then(sendResponse)
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'confirmPost':
      confirmPostSuccess(request.data)
        .then(sendResponse)
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'checkAuth':
      sendResponse({ 
        success: true, 
        authenticated: isAuthenticated(),
        method: apiKey ? 'apiKey' : (authToken ? 'jwt' : null)
      });
      return false;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Handle user login with email/password (JWT)
async function handleLogin({ email, password, apiEndpoint }) {
  try {
    if (apiEndpoint) {
      apiUrl = apiEndpoint;
      await chrome.storage.local.set({ apiUrl });
    }

    const response = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    authToken = data.data.accessToken;
    await chrome.storage.local.set({ authToken });

    return { success: true, user: data.data.user };
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

// Handle login with API key (simpler, no JWT refresh needed)
async function handleApiKeyLogin({ key, apiEndpoint }) {
  try {
    if (apiEndpoint) {
      apiUrl = apiEndpoint;
      await chrome.storage.local.set({ apiUrl });
    }

    // Validate the API key by making a test request
    const response = await fetch(`${apiUrl}/vehicles?limit=1`, {
      headers: {
        'X-API-Key': key,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Invalid API key');
    }

    // Store the API key
    apiKey = key;
    await chrome.storage.local.set({ apiKey });
    
    // Clear JWT if switching to API key
    authToken = null;
    await chrome.storage.local.remove(['authToken']);

    return { success: true, method: 'apiKey' };
  } catch (error) {
    console.error('API key login error:', error);
    throw error;
  }
}

// Handle logout
async function handleLogout() {
  authToken = null;
  apiKey = null;
  await chrome.storage.local.remove(['authToken', 'apiKey']);
  return { success: true };
}

// Get Facebook credentials from backend
async function getFacebookCredentials() {
  try {
    if (!isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${apiUrl}/users/me/facebook-credentials`, {
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to get credentials');
    }

    return { success: true, credentials: data.data };
  } catch (error) {
    console.error('Get credentials error:', error);
    throw error;
  }
}

// Get vehicles for the account
async function getVehicles(accountId) {
  try {
    if (!isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    const url = accountId 
      ? `${apiUrl}/vehicles?accountId=${accountId}`
      : `${apiUrl}/vehicles`;

    const response = await fetch(url, {
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to get vehicles');
    }

    return { success: true, vehicles: data.data };
  } catch (error) {
    console.error('Get vehicles error:', error);
    throw error;
  }
}

// Initiate Facebook Marketplace post
async function initiateMarketplacePost(vehicleData) {
  try {
    // Get Facebook credentials
    const credentialsResponse = await getFacebookCredentials();
    
    if (!credentialsResponse.credentials.hasCredentials) {
      throw new Error('Facebook credentials not configured. Please set them in settings.');
    }

    // Store vehicle data and credentials for content script
    await chrome.storage.local.set({
      pendingPost: {
        vehicle: vehicleData,
        credentials: credentialsResponse.credentials,
        timestamp: Date.now()
      }
    });

    // Open Facebook Marketplace create listing page
    const tab = await chrome.tabs.create({
      url: 'https://www.facebook.com/marketplace/create/vehicle'
    });

    return { 
      success: true, 
      message: 'Opening Facebook Marketplace...',
      tabId: tab.id 
    };
  } catch (error) {
    console.error('Initiate post error:', error);
    throw error;
  }
}

// Confirm successful post to backend
async function confirmPostSuccess({ vehicleId, postUrl, screenshot }) {
  try {
    if (!isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${apiUrl}/facebook/marketplace/confirm`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        vehicleId,
        postUrl,
        screenshot,
        postedAt: new Date().toISOString()
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to confirm post');
    }

    return { success: true, data: data.data };
  } catch (error) {
    console.error('Confirm post error:', error);
    throw error;
  }
}

// Listen for tab updates to detect when Facebook page loads
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('facebook.com/marketplace')) {
    // Inject content script if needed
    chrome.tabs.sendMessage(tabId, { action: 'checkPendingPost' });
  }
});
