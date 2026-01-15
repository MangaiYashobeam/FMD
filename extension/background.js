// FaceMyDealer Chrome Extension - Background Service Worker

const API_BASE_URL = 'https://fmd-production.up.railway.app';

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('FaceMyDealer extension installed:', details.reason);
  
  // Open side panel on extension icon click
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  if (message.type === 'API_REQUEST') {
    handleApiRequest(message.endpoint, message.method, message.data)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true; // Keep the message channel open for async response
  }
  
  if (message.type === 'GET_AUTH_TOKEN') {
    chrome.storage.local.get(['authToken'], (result) => {
      sendResponse({ token: result.authToken || null });
    });
    return true;
  }
  
  if (message.type === 'SET_AUTH_TOKEN') {
    chrome.storage.local.set({ authToken: message.token }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'CLEAR_AUTH') {
    chrome.storage.local.remove(['authToken', 'user'], () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'OPEN_FACEBOOK_TAB') {
    chrome.tabs.create({ url: message.url }, (tab) => {
      sendResponse({ tabId: tab.id });
    });
    return true;
  }
});

// Handle API requests through background script (to avoid CORS issues)
async function handleApiRequest(endpoint, method = 'GET', data = null) {
  const tokenResult = await chrome.storage.local.get(['authToken']);
  const token = tokenResult.authToken;
  
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
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const responseData = await response.json();
    
    if (!response.ok) {
      throw new Error(responseData.message || 'API request failed');
    }
    
    return responseData;
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}

// Listen for tab updates to detect Facebook pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isFacebook = tab.url.includes('facebook.com');
    
    if (isFacebook) {
      // Notify the side panel that we're on Facebook
      chrome.runtime.sendMessage({
        type: 'FACEBOOK_TAB_READY',
        tabId,
        url: tab.url,
      }).catch(() => {
        // Side panel might not be open, that's ok
      });
    }
  }
});

console.log('FaceMyDealer background script loaded');
