// Dealers Face Chrome Extension - Facebook Content Script
// Enhanced with IAI Soldier Integration for Marketplace Automation

console.log('🎖️ Dealers Face IAI content script loaded on Facebook');

// Global state
let iaiSoldier = null;
let pendingTasks = [];

// Initialize IAI Soldier if available
function initializeIAI() {
  if (typeof window.IAISoldier !== 'undefined') {
    chrome.storage.local.get(['accountId', 'authToken'], (result) => {
      if (result.accountId && result.authToken) {
        iaiSoldier = new window.IAISoldier();
        iaiSoldier.initialize(result.accountId, result.authToken);
        console.log('🎖️ IAI Soldier initialized and ready');
      }
    });
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content received message:', message.type);
  
  if (message.type === 'FILL_MARKETPLACE_FORM') {
    fillMarketplaceForm(message.vehicle)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.type === 'CHECK_FACEBOOK_LOGIN') {
    const isLoggedIn = checkFacebookLogin();
    sendResponse({ isLoggedIn });
    return true;
  }
  
  if (message.type === 'IAI_TASKS_AVAILABLE') {
    pendingTasks = message.tasks || [];
    console.log(`📋 ${pendingTasks.length} IAI tasks available`);
    showTaskNotification(pendingTasks.length);
    sendResponse({ received: true });
    return true;
  }
  
  if (message.type === 'EXECUTE_IAI_TASK') {
    executeIAITask(message.task)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.type === 'GET_PAGE_STATE') {
    sendResponse({
      url: window.location.href,
      isMarketplace: window.location.href.includes('/marketplace'),
      isCreateListing: window.location.href.includes('/marketplace/create'),
      isLoggedIn: checkFacebookLogin(),
      iaiReady: !!iaiSoldier,
    });
    return true;
  }
  
  return true;
});

// Check if user is logged into Facebook
function checkFacebookLogin() {
  const navElement = document.querySelector('[role="navigation"]');
  const profileLink = document.querySelector('[aria-label*="profile" i], [aria-label*="Account" i]');
  const messengerIcon = document.querySelector('[aria-label*="Messenger" i]');
  return !!(navElement || profileLink || messengerIcon);
}

// ============================================
// IAI TASK EXECUTION
// ============================================

async function executeIAITask(task) {
  console.log('🎯 Executing IAI task:', task.type, task);
  
  try {
    switch (task.type) {
      case 'POST_TO_MARKETPLACE':
        return await executeMarketplacePost(task);
      case 'scrape_inbox':
        return await scrapeInbox();
      case 'send_message':
        return await sendMessage(task.data);
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  } catch (error) {
    console.error('IAI task failed:', error);
    
    // Notify background of failure
    chrome.runtime.sendMessage({
      type: 'TASK_FAILED',
      taskId: task.id,
      error: error.message,
    });
    
    throw error;
  }
}

async function executeMarketplacePost(task) {
  const vehicleData = task.data?.vehicle || task.data;
  
  console.log('🚗 Creating Marketplace listing for:', vehicleData);
  
  // Navigate to create listing page if not already there
  if (!window.location.href.includes('/marketplace/create')) {
    window.location.href = 'https://www.facebook.com/marketplace/create/vehicle/';
    // The page will reload, task will be re-attempted
    throw new Error('Navigating to create listing page...');
  }
  
  // Wait for page to be ready
  await sleep(2000);
  
  // Use IAI Soldier if available
  if (iaiSoldier && iaiSoldier.lister) {
    const result = await iaiSoldier.lister.createListing(vehicleData, vehicleData.photos || []);
    
    // Notify background of completion
    chrome.runtime.sendMessage({
      type: 'TASK_COMPLETED',
      taskId: task.id,
      result: { success: true, message: 'Listing form filled, ready for review' },
    });
    
    return result;
  }
  
  // Fallback to basic form filling
  await fillMarketplaceForm(vehicleData);
  
  // Notify background of completion
  chrome.runtime.sendMessage({
    type: 'TASK_COMPLETED',
    taskId: task.id,
    result: { success: true, message: 'Basic form filled' },
  });
  
  return { success: true };
}

async function scrapeInbox() {
  if (iaiSoldier && iaiSoldier.messenger) {
    return await iaiSoldier.messenger.scrapeConversations();
  }
  throw new Error('IAI Soldier not initialized');
}

async function sendMessage(data) {
  if (iaiSoldier && iaiSoldier.messenger) {
    await iaiSoldier.messenger.openConversation(data.conversationIndex);
    return await iaiSoldier.messenger.sendMessage(data.message);
  }
  throw new Error('IAI Soldier not initialized');
}

// ============================================
// MARKETPLACE FORM FILLING
// ============================================

async function fillMarketplaceForm(vehicle) {
  console.log('📝 Filling marketplace form with vehicle:', vehicle);
  
  // Wait for form to be ready
  await waitForElement('[role="main"]', 5000);
  await sleep(1500);
  
  // Try to fill the title
  const titleSelectors = [
    '[aria-label*="Title" i]',
    'input[placeholder*="title" i]',
    '[name="title"]',
    'input[type="text"]:first-of-type',
  ];
  
  for (const selector of titleSelectors) {
    const titleInput = document.querySelector(selector);
    if (titleInput) {
      const title = vehicle.title || `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}`.trim();
      await fillInput(titleInput, title);
      console.log('✅ Title filled');
      break;
    }
  }
  
  await sleep(500);
  
  // Fill price
  const priceSelectors = [
    '[aria-label*="Price" i]',
    'input[placeholder*="price" i]',
    '[name="price"]',
    'input[type="number"]',
  ];
  
  for (const selector of priceSelectors) {
    const priceInput = document.querySelector(selector);
    if (priceInput && vehicle.price) {
      await fillInput(priceInput, String(vehicle.price).replace(/[^0-9]/g, ''));
      console.log('✅ Price filled');
      break;
    }
  }
  
  await sleep(500);
  
  // Fill mileage
  const mileageSelectors = [
    '[aria-label*="mileage" i]',
    '[aria-label*="odometer" i]',
    'input[placeholder*="mileage" i]',
  ];
  
  for (const selector of mileageSelectors) {
    const mileageInput = document.querySelector(selector);
    if (mileageInput && vehicle.mileage) {
      await fillInput(mileageInput, String(vehicle.mileage));
      console.log('✅ Mileage filled');
      break;
    }
  }
  
  await sleep(500);
  
  // Fill description
  const descSelectors = [
    '[aria-label*="Description" i]',
    'textarea[placeholder*="describe" i]',
    '[role="textbox"][aria-multiline="true"]',
    'textarea',
  ];
  
  for (const selector of descSelectors) {
    const descInput = document.querySelector(selector);
    if (descInput) {
      const description = vehicle.description || generateDescription(vehicle);
      await fillInput(descInput, description);
      console.log('✅ Description filled');
      break;
    }
  }
  
  // Handle Year dropdown
  await handleDropdown(['[aria-label*="Year" i]', '[name="year"]'], vehicle.year);
  
  // Handle Make dropdown
  await handleDropdown(['[aria-label*="Make" i]', '[name="make"]'], vehicle.make);
  
  // Handle Model dropdown
  await handleDropdown(['[aria-label*="Model" i]', '[name="model"]'], vehicle.model);
  
  console.log('📝 Marketplace form filling complete');
  
  // Show notification to user
  showCompletionNotification();
}

async function handleDropdown(selectors, value) {
  if (!value) return;
  
  for (const selector of selectors) {
    const dropdown = document.querySelector(selector);
    if (dropdown) {
      dropdown.click();
      await sleep(500);
      
      // Look for option with matching text
      const options = document.querySelectorAll('[role="option"], [role="listbox"] [role="option"]');
      for (const option of options) {
        if (option.textContent?.toLowerCase().includes(value.toString().toLowerCase())) {
          option.click();
          await sleep(300);
          console.log(`✅ Selected ${value} from dropdown`);
          return;
        }
      }
      
      // Type to search
      if (dropdown.tagName === 'INPUT') {
        await fillInput(dropdown, value.toString());
        await sleep(500);
        const firstOption = document.querySelector('[role="option"]');
        if (firstOption) firstOption.click();
      }
      
      break;
    }
  }
}

// Generate vehicle description
function generateDescription(vehicle) {
  const parts = [];
  
  parts.push(`🚗 ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''}`);
  parts.push('');
  
  if (vehicle.mileage) {
    parts.push(`📍 Mileage: ${Number(vehicle.mileage).toLocaleString()} miles`);
  }
  
  if (vehicle.exteriorColor || vehicle.color) {
    parts.push(`🎨 Color: ${vehicle.exteriorColor || vehicle.color}`);
  }
  
  if (vehicle.transmission) {
    parts.push(`⚙️ Transmission: ${vehicle.transmission}`);
  }
  
  if (vehicle.fuelType) {
    parts.push(`⛽ Fuel: ${vehicle.fuelType}`);
  }
  
  if (vehicle.vin) {
    parts.push(`🔑 VIN: ...${vehicle.vin.slice(-6)}`);
  }
  
  if (vehicle.stockNumber) {
    parts.push(`📋 Stock #: ${vehicle.stockNumber}`);
  }
  
  parts.push('');
  parts.push('✅ Financing Available');
  parts.push('✅ Trade-ins Welcome');
  parts.push('');
  parts.push('📞 Contact us for more information!');
  
  return parts.join('\n');
}

// ============================================
// UI NOTIFICATIONS
// ============================================

function showTaskNotification(count) {
  // Remove existing notification
  const existing = document.getElementById('iai-task-notification');
  if (existing) existing.remove();
  
  if (count === 0) return;
  
  const notification = document.createElement('div');
  notification.id = 'iai-task-notification';
  notification.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%);
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      cursor: pointer;
      transition: transform 0.2s;
    " onclick="this.parentElement.remove()">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="
          width: 40px;
          height: 40px;
          background: rgba(255,255,255,0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        ">🎖️</div>
        <div>
          <div style="font-weight: 600; font-size: 14px;">IAI Soldier Ready</div>
          <div style="font-size: 12px; opacity: 0.9;">${count} task${count > 1 ? 's' : ''} pending</div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => notification.remove(), 5000);
}

function showCompletionNotification() {
  const notification = document.createElement('div');
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #10B981 0%, #059669 100%);
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="font-size: 24px;">✅</div>
        <div>
          <div style="font-weight: 600; font-size: 14px;">Form Ready!</div>
          <div style="font-size: 12px; opacity: 0.9;">Review and click Publish</div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => notification.remove(), 5000);
}

// ============================================
// HELPERS
// ============================================

function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }
    
    const observer = new MutationObserver((mutations, obs) => {
      const el = document.querySelector(selector);
      if (el) {
        obs.disconnect();
        resolve(el);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

async function fillInput(element, value) {
  element.focus();
  
  // Clear existing value
  if (element.value !== undefined) {
    element.value = '';
  } else if (element.isContentEditable) {
    element.textContent = '';
  }
  
  // Simulate typing
  for (const char of value) {
    if (element.value !== undefined) {
      element.value += char;
    } else if (element.isContentEditable) {
      element.textContent += char;
    }
    
    element.dispatchEvent(new InputEvent('input', { 
      data: char, 
      bubbles: true,
      inputType: 'insertText',
    }));
    
    await sleep(15 + Math.random() * 25); // Random delay for human-like typing
  }
  
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// INITIALIZATION
// ============================================

// Notify background that we're on a Facebook page
chrome.runtime.sendMessage({
  type: 'FACEBOOK_PAGE_LOADED',
  url: window.location.href,
  isMarketplace: window.location.href.includes('/marketplace'),
  isCreateListing: window.location.href.includes('/marketplace/create'),
}).catch(() => {
  // Background might not be listening yet
});

// Initialize IAI Soldier after page load
if (document.readyState === 'complete') {
  initializeIAI();
} else {
  window.addEventListener('load', initializeIAI);
}

// Load IAI Soldier script
const script = document.createElement('script');
script.src = chrome.runtime.getURL('iai-soldier.js');
script.onload = () => {
  console.log('🎖️ IAI Soldier script injected');
  setTimeout(initializeIAI, 500);
};
(document.head || document.documentElement).appendChild(script);

console.log('🎖️ Dealers Face content script ready');
