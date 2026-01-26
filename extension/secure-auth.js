/**
 * Dealers Face Extension - Secure Authentication Module
 * 
 * SECURITY: This module handles authentication WITHOUT bundled secrets.
 * 
 * Architecture:
 * 1. User logs in with email/password → Receives user JWT
 * 2. Extension exchanges JWT for session token via /api/extension/token/exchange
 * 3. Session token is used for all API calls (24h validity)
 * 4. Per-session signing key used for sensitive operations
 * 
 * NO SECRETS BUNDLED IN EXTENSION CODE - All secrets are server-side.
 */

const API_BASE_URL = 'https://dealersface.com';

/**
 * Generate device fingerprint for session binding
 * This helps prevent session token theft
 */
async function generateDeviceFingerprint() {
  const ua = navigator.userAgent;
  const lang = navigator.language;
  const platform = navigator.platform;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Get extension ID
  const extensionId = chrome.runtime.id;
  
  // Combine into fingerprint
  const fingerprintData = `${ua}|${lang}|${platform}|${tz}|${extensionId}`;
  
  // Hash it
  const encoder = new TextEncoder();
  const data = encoder.encode(fingerprintData);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate unique nonce for replay prevention
 */
function generateNonce() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Sign a request payload using the session signing key
 * @param {string} signingKey - Per-session signing key from token exchange
 * @param {string} payload - JSON stringified payload
 * @returns {Promise<{timestamp: number, nonce: string, signature: string}>}
 */
async function signRequest(signingKey, payload) {
  const timestamp = Date.now();
  const nonce = generateNonce();
  const dataToSign = `${timestamp}:${nonce}:${payload}`;
  
  // Create HMAC-SHA256 signature
  const encoder = new TextEncoder();
  const keyData = encoder.encode(signingKey);
  const msgData = encoder.encode(dataToSign);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return { timestamp, nonce, signature: signatureHex };
}

/**
 * Exchange user JWT for extension session token
 * This is the SECURE way to authenticate - no bundled secrets!
 * 
 * @param {string} userJwt - User's authentication JWT from login
 * @returns {Promise<{success: boolean, sessionToken?: string, signingKey?: string, error?: string}>}
 */
async function exchangeForSessionToken(userJwt) {
  try {
    const deviceFingerprint = await generateDeviceFingerprint();
    const timestamp = Date.now();
    const nonce = generateNonce();
    const extensionId = chrome.runtime.id;
    const extensionVersion = chrome.runtime.getManifest().version;
    
    console.log('[SecureAuth] Exchanging JWT for session token...');
    
    const response = await fetch(`${API_BASE_URL}/api/extension/token/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-ID': extensionId,
      },
      body: JSON.stringify({
        userJwt,
        extensionId,
        extensionVersion,
        deviceFingerprint,
        timestamp,
        nonce,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      console.error('[SecureAuth] Token exchange failed:', data);
      return { success: false, error: data.message || 'Token exchange failed' };
    }
    
    console.log('[SecureAuth] ✅ Session token obtained');
    
    // Store session credentials
    await chrome.storage.local.set({
      sessionToken: data.data.sessionToken,
      signingKey: data.data.signingKey,
      sessionExpiresAt: data.data.expiresAt,
      sessionCapabilities: data.data.capabilities,
      deviceFingerprint,
    });
    
    return {
      success: true,
      sessionToken: data.data.sessionToken,
      signingKey: data.data.signingKey,
      expiresAt: data.data.expiresAt,
      capabilities: data.data.capabilities,
    };
    
  } catch (error) {
    console.error('[SecureAuth] Token exchange error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Make an authenticated API request using session token
 * @param {string} endpoint - API endpoint (e.g., '/api/vehicles')
 * @param {string} method - HTTP method
 * @param {object} body - Request body (optional)
 * @param {boolean} signed - Whether to sign the request (for sensitive operations)
 */
async function secureApiRequest(endpoint, method = 'GET', body = null, signed = false) {
  const storage = await chrome.storage.local.get([
    'sessionToken',
    'signingKey',
    'sessionExpiresAt',
    'authToken', // Fallback to legacy auth
  ]);
  
  // Check if session token is available and valid
  let token = storage.sessionToken;
  const expiresAt = storage.sessionExpiresAt;
  
  // Check expiry (refresh if within 2 hours of expiry)
  if (expiresAt && Date.now() > expiresAt - (2 * 60 * 60 * 1000)) {
    console.log('[SecureAuth] Session token expiring, refreshing...');
    const refreshResult = await refreshSessionToken();
    if (refreshResult.success) {
      token = refreshResult.sessionToken;
    } else {
      // Fall back to legacy auth token if available
      token = storage.authToken;
      if (!token) {
        throw new Error('Session expired. Please log in again.');
      }
    }
  }
  
  // Build headers
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Extension-ID': chrome.runtime.id,
  };
  
  // Sign request if required (for sensitive operations)
  if (signed && storage.signingKey && body) {
    const payload = JSON.stringify(body);
    const sig = await signRequest(storage.signingKey, payload);
    headers['X-Request-Timestamp'] = sig.timestamp.toString();
    headers['X-Request-Nonce'] = sig.nonce;
    headers['X-Request-Signature'] = sig.signature;
  }
  
  const options = {
    method,
    headers,
  };
  
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  
  // Handle auth errors
  if (response.status === 401) {
    // Try to refresh
    const refreshResult = await refreshSessionToken();
    if (refreshResult.success) {
      // Retry request with new token
      headers['Authorization'] = `Bearer ${refreshResult.sessionToken}`;
      return fetch(`${API_BASE_URL}${endpoint}`, options).then(r => r.json());
    }
    throw new Error('Authentication failed. Please log in again.');
  }
  
  return response.json();
}

/**
 * Refresh expiring session token
 */
async function refreshSessionToken() {
  try {
    const storage = await chrome.storage.local.get([
      'sessionToken',
      'deviceFingerprint',
    ]);
    
    if (!storage.sessionToken) {
      return { success: false, error: 'No session token' };
    }
    
    const response = await fetch(`${API_BASE_URL}/api/extension/token/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-ID': chrome.runtime.id,
      },
      body: JSON.stringify({
        sessionToken: storage.sessionToken,
        extensionId: chrome.runtime.id,
        deviceFingerprint: storage.deviceFingerprint,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      return { success: false, error: data.message };
    }
    
    if (data.data.refreshed) {
      // Store new credentials
      await chrome.storage.local.set({
        sessionToken: data.data.sessionToken,
        signingKey: data.data.signingKey,
        sessionExpiresAt: data.data.expiresAt,
        sessionCapabilities: data.data.capabilities,
      });
      
      console.log('[SecureAuth] ✅ Session token refreshed');
    }
    
    return {
      success: true,
      sessionToken: data.data.sessionToken || storage.sessionToken,
      refreshed: data.data.refreshed,
    };
    
  } catch (error) {
    console.error('[SecureAuth] Refresh error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Revoke current session (logout)
 */
async function revokeSession() {
  try {
    const storage = await chrome.storage.local.get(['sessionToken']);
    
    if (storage.sessionToken) {
      await fetch(`${API_BASE_URL}/api/extension/token/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Extension-ID': chrome.runtime.id,
        },
        body: JSON.stringify({
          sessionToken: storage.sessionToken,
        }),
      });
    }
    
    // Clear local storage
    await chrome.storage.local.remove([
      'sessionToken',
      'signingKey',
      'sessionExpiresAt',
      'sessionCapabilities',
      'deviceFingerprint',
      'authToken',
      'refreshToken',
      'user',
      'accountId',
      'authState',
    ]);
    
    console.log('[SecureAuth] ✅ Session revoked');
    return { success: true };
    
  } catch (error) {
    console.error('[SecureAuth] Revoke error:', error);
    // Clear local storage anyway
    await chrome.storage.local.remove([
      'sessionToken',
      'signingKey',
      'sessionExpiresAt',
      'sessionCapabilities',
      'deviceFingerprint',
    ]);
    return { success: true }; // Consider success even if server call failed
  }
}

/**
 * Check if user has required capability
 */
async function hasCapability(capability) {
  const storage = await chrome.storage.local.get(['sessionCapabilities']);
  return storage.sessionCapabilities?.includes(capability) || false;
}

/**
 * Get current session status
 */
async function getSessionStatus() {
  const storage = await chrome.storage.local.get([
    'sessionToken',
    'sessionExpiresAt',
    'sessionCapabilities',
    'user',
    'accountId',
  ]);
  
  if (!storage.sessionToken) {
    return { authenticated: false };
  }
  
  const expiresAt = storage.sessionExpiresAt;
  const isExpired = expiresAt && Date.now() > expiresAt;
  const expiresIn = expiresAt ? expiresAt - Date.now() : 0;
  
  return {
    authenticated: !isExpired,
    expiresAt,
    expiresIn,
    capabilities: storage.sessionCapabilities || [],
    user: storage.user,
    accountId: storage.accountId,
    needsRefresh: expiresIn < 2 * 60 * 60 * 1000, // Less than 2 hours
  };
}

// Export for use in background.js
if (typeof window !== 'undefined') {
  window.SecureAuth = {
    exchangeForSessionToken,
    secureApiRequest,
    refreshSessionToken,
    revokeSession,
    hasCapability,
    getSessionStatus,
    signRequest,
    generateDeviceFingerprint,
    generateNonce,
  };
}

// Also export for module environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    exchangeForSessionToken,
    secureApiRequest,
    refreshSessionToken,
    revokeSession,
    hasCapability,
    getSessionStatus,
    signRequest,
    generateDeviceFingerprint,
    generateNonce,
  };
}
