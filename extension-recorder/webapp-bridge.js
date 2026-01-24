/**
 * FMD Extension - Webapp Bridge
 * Syncs auth token from dealersface.com to the extension
 */

(function() {
  'use strict';
  
  const BRIDGE_ID = 'FMD_WEBAPP_BRIDGE';
  console.log(`[${BRIDGE_ID}] Initializing on`, window.location.href);
  
  // Function to get and sync auth token
  function syncAuthToken() {
    try {
      // Try both token storage keys the webapp might use
      const accessToken = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const refreshToken = localStorage.getItem('refreshToken');
      const userId = localStorage.getItem('userId');
      
      if (accessToken) {
        console.log(`[${BRIDGE_ID}] Found accessToken, syncing to extension storage`);
        
        // Store in extension's chrome.storage.local
        chrome.storage.local.set({
          fmd_admin_token: accessToken,
          fmd_refresh_token: refreshToken,
          fmd_user_id: userId,
          fmd_token_synced_at: Date.now()
        }, () => {
          if (chrome.runtime.lastError) {
            console.error(`[${BRIDGE_ID}] Storage error:`, chrome.runtime.lastError);
          } else {
            console.log(`[${BRIDGE_ID}] Token synced successfully to extension storage`);
            
            // Notify any open sidepanels
            chrome.runtime.sendMessage({
              type: 'AUTH_TOKEN_SYNCED',
              hasToken: true,
              timestamp: Date.now()
            }).catch(() => {
              // Sidebar might not be open, that's OK
            });
          }
        });
        
        return true;
      } else {
        console.log(`[${BRIDGE_ID}] No accessToken found in webapp localStorage`);
        
        // Clear extension storage if logged out
        chrome.storage.local.remove(['fmd_admin_token', 'fmd_refresh_token', 'fmd_user_id', 'fmd_token_synced_at'], () => {
          chrome.runtime.sendMessage({
            type: 'AUTH_TOKEN_CLEARED',
            timestamp: Date.now()
          }).catch(() => {});
        });
        
        return false;
      }
    } catch (error) {
      console.error(`[${BRIDGE_ID}] Error syncing token:`, error);
      return false;
    }
  }
  
  // Listen for messages from the extension
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log(`[${BRIDGE_ID}] Received message:`, message.type);
    
    if (message.type === 'GET_AUTH_TOKEN') {
      const accessToken = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const refreshToken = localStorage.getItem('refreshToken');
      const userId = localStorage.getItem('userId');
      
      sendResponse({
        success: !!accessToken,
        accessToken,
        refreshToken,
        userId
      });
      return true;
    }
    
    if (message.type === 'SYNC_AUTH_TOKEN') {
      const synced = syncAuthToken();
      sendResponse({ success: synced });
      return true;
    }
    
    if (message.type === 'PING') {
      sendResponse({ success: true, bridge: BRIDGE_ID });
      return true;
    }
  });
  
  // Initial sync on page load
  syncAuthToken();
  
  // Watch for localStorage changes (login/logout)
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function(key, value) {
    originalSetItem.apply(this, arguments);
    
    if (key === 'accessToken' || key === 'token') {
      console.log(`[${BRIDGE_ID}] Token updated in localStorage, syncing...`);
      setTimeout(syncAuthToken, 100);
    }
  };
  
  const originalRemoveItem = localStorage.removeItem;
  localStorage.removeItem = function(key) {
    originalRemoveItem.apply(this, arguments);
    
    if (key === 'accessToken' || key === 'token') {
      console.log(`[${BRIDGE_ID}] Token removed from localStorage, syncing...`);
      setTimeout(syncAuthToken, 100);
    }
  };
  
  // Periodic sync every 30 seconds
  setInterval(syncAuthToken, 30000);
  
  console.log(`[${BRIDGE_ID}] Ready and watching for auth changes`);
})();
