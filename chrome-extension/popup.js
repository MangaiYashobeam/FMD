// Popup script for Dealers Face Chrome Extension

const loginForm = document.getElementById('loginForm');
const mainContent = document.getElementById('mainContent');
const loader = document.getElementById('loader');

// Login method tabs
const tabPassword = document.getElementById('tabPassword');
const tabApiKey = document.getElementById('tabApiKey');
const passwordLogin = document.getElementById('passwordLogin');
const apiKeyLogin = document.getElementById('apiKeyLogin');

const apiUrlSelect = document.getElementById('apiUrl');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const apiKeyInput = document.getElementById('apiKey');
const apiKeyLoginBtn = document.getElementById('apiKeyLoginBtn');
const loginError = document.getElementById('loginError');

const userInfo = document.getElementById('userInfo');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const statusMessage = document.getElementById('statusMessage');
const logoutBtn = document.getElementById('logoutBtn');

// Quick action buttons
const openDashboardBtn = document.getElementById('openDashboard');
const viewVehiclesBtn = document.getElementById('viewVehicles');
const checkCredentialsBtn = document.getElementById('checkCredentials');
const settingsBtn = document.getElementById('settings');

// Tab switching
tabPassword.addEventListener('click', () => {
  tabPassword.classList.add('active');
  tabApiKey.classList.remove('active');
  passwordLogin.classList.remove('hidden');
  apiKeyLogin.classList.add('hidden');
  hideError();
});

tabApiKey.addEventListener('click', () => {
  tabApiKey.classList.add('active');
  tabPassword.classList.remove('active');
  apiKeyLogin.classList.remove('hidden');
  passwordLogin.classList.add('hidden');
  hideError();
});

// Check if user is already logged in
chrome.storage.local.get(['authToken', 'apiKey', 'user', 'apiUrl'], (result) => {
  if ((result.authToken || result.apiKey) && result.user) {
    showMainContent(result.user);
  } else if (result.apiKey) {
    // API key auth - show simple connected state
    showMainContent({ firstName: 'API Key', lastName: 'User', email: 'Connected via API' });
  }
  
  if (result.apiUrl) {
    apiUrlSelect.value = result.apiUrl;
  }
});

// Login handler (email/password)
loginBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const apiEndpoint = apiUrlSelect.value;

  if (!email || !password) {
    showError('Please enter email and password');
    return;
  }

  showLoader(true);
  loginBtn.disabled = true;
  hideError();

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'login',
      data: { email, password, apiEndpoint }
    });

    if (response.success) {
      await chrome.storage.local.set({ user: response.user });
      showMainContent(response.user);
      showStatus('Logged in successfully!', 'success');
    } else {
      showError(response.error || 'Login failed');
    }
  } catch (error) {
    showError(error.message || 'Login failed');
  } finally {
    showLoader(false);
    loginBtn.disabled = false;
  }
});

// API Key login handler
apiKeyLoginBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  const apiEndpoint = apiUrlSelect.value;

  if (!key) {
    showError('Please enter your API key');
    return;
  }

  if (!key.startsWith('fmd_')) {
    showError('Invalid API key format (should start with fmd_)');
    return;
  }

  showLoader(true);
  apiKeyLoginBtn.disabled = true;
  hideError();

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'loginWithApiKey',
      data: { key, apiEndpoint }
    });

    if (response.success) {
      const user = { firstName: 'API Key', lastName: 'Connection', email: 'Connected via API Key' };
      await chrome.storage.local.set({ user });
      showMainContent(user);
      showStatus('Connected with API key!', 'success');
    } else {
      showError(response.error || 'API key validation failed');
    }
  } catch (error) {
    showError(error.message || 'Connection failed');
  } finally {
    showLoader(false);
    apiKeyLoginBtn.disabled = false;
  }
});

// Logout handler
logoutBtn.addEventListener('click', async () => {
  showLoader(true);

  try {
    await chrome.runtime.sendMessage({ action: 'logout' });
    await chrome.storage.local.remove(['user']);
    
    emailInput.value = '';
    passwordInput.value = '';
    
    loginForm.classList.add('active');
    mainContent.classList.remove('active');
    
    showStatus('Logged out successfully', 'info');
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    showLoader(false);
  }
});

// Open dashboard
openDashboardBtn.addEventListener('click', () => {
  const apiUrl = apiUrlSelect.value.replace('/api', '');
  chrome.tabs.create({ url: `${apiUrl}/dashboard` });
});

// View vehicles
viewVehiclesBtn.addEventListener('click', () => {
  const apiUrl = apiUrlSelect.value.replace('/api', '');
  chrome.tabs.create({ url: `${apiUrl}/dashboard/vehicles` });
});

// Check Facebook credentials
checkCredentialsBtn.addEventListener('click', async () => {
  showLoader(true);

  try {
    const response = await chrome.runtime.sendMessage({ action: 'getCredentials' });

    if (response.success) {
      const creds = response.credentials;
      
      if (creds.hasCredentials) {
        showStatus(
          `✅ Facebook credentials configured\n2FA Codes: ${creds.twoFactorCodes.length} remaining`,
          'success'
        );
      } else {
        showStatus(
          '⚠️ No Facebook credentials found.\nPlease configure them in dashboard settings.',
          'error'
        );
      }
    } else {
      showStatus(response.error || 'Failed to check credentials', 'error');
    }
  } catch (error) {
    showStatus(error.message, 'error');
  } finally {
    showLoader(false);
  }
});

// Settings
settingsBtn.addEventListener('click', () => {
  const apiUrl = apiUrlSelect.value.replace('/api', '');
  chrome.tabs.create({ url: `${apiUrl}/dashboard/settings` });
});

// Show main content after login
function showMainContent(user) {
  loginForm.classList.remove('active');
  mainContent.classList.add('active');
  
  userName.textContent = user.firstName && user.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : 'User';
  userEmail.textContent = user.email;
}

// Show loader
function showLoader(show) {
  if (show) {
    loader.classList.remove('hidden');
  } else {
    loader.classList.add('hidden');
  }
}

// Show error message
function showError(message) {
  loginError.textContent = message;
  loginError.classList.remove('hidden');
}

// Hide error message
function hideError() {
  loginError.classList.add('hidden');
}

// Show status message
function showStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`;
  statusMessage.classList.remove('hidden');

  setTimeout(() => {
    statusMessage.classList.add('hidden');
  }, 5000);
}

// Listen for keyboard events
emailInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    passwordInput.focus();
  }
});

passwordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    loginBtn.click();
  }
});
