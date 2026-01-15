// FaceMyDealer Chrome Extension - Facebook Content Script

console.log('FaceMyDealer content script loaded on Facebook');

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FILL_MARKETPLACE_FORM') {
    fillMarketplaceForm(message.vehicle);
    sendResponse({ success: true });
  }
  
  if (message.type === 'CHECK_FACEBOOK_LOGIN') {
    const isLoggedIn = checkFacebookLogin();
    sendResponse({ isLoggedIn });
  }
  
  return true;
});

// Check if user is logged into Facebook
function checkFacebookLogin() {
  // Check for common Facebook logged-in indicators
  const navElement = document.querySelector('[role="navigation"]');
  const profileLink = document.querySelector('[aria-label*="profile"], [aria-label*="Account"]');
  return !!(navElement || profileLink);
}

// Fill in Marketplace listing form
async function fillMarketplaceForm(vehicle) {
  console.log('Attempting to fill marketplace form with vehicle:', vehicle);
  
  // Wait for form to be ready
  await waitForElement('[aria-label="Title"], [aria-label="Price"], input[placeholder*="title" i]');
  
  // Fill title
  const titleInput = document.querySelector('[aria-label="Title"], input[placeholder*="title" i]');
  if (titleInput) {
    await fillInput(titleInput, `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}`);
  }
  
  // Fill price
  const priceInput = document.querySelector('[aria-label="Price"], input[placeholder*="price" i]');
  if (priceInput && vehicle.price) {
    await fillInput(priceInput, vehicle.price.toString());
  }
  
  // Fill description
  const descInput = document.querySelector('[aria-label="Description"], textarea[placeholder*="describe" i]');
  if (descInput) {
    const description = generateDescription(vehicle);
    await fillInput(descInput, description);
  }
  
  // Fill mileage if available
  const mileageInput = document.querySelector('[aria-label*="mileage" i], [aria-label*="odometer" i]');
  if (mileageInput && vehicle.mileage) {
    await fillInput(mileageInput, vehicle.mileage.toString());
  }
  
  console.log('Marketplace form filled');
}

// Generate vehicle description
function generateDescription(vehicle) {
  const parts = [];
  
  parts.push(`${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''}`);
  
  if (vehicle.mileage) {
    parts.push(`Mileage: ${vehicle.mileage.toLocaleString()} miles`);
  }
  
  if (vehicle.color) {
    parts.push(`Color: ${vehicle.color}`);
  }
  
  if (vehicle.vin) {
    parts.push(`VIN: ${vehicle.vin}`);
  }
  
  if (vehicle.stockNumber) {
    parts.push(`Stock #: ${vehicle.stockNumber}`);
  }
  
  if (vehicle.description) {
    parts.push('');
    parts.push(vehicle.description);
  }
  
  parts.push('');
  parts.push('Contact us for more information!');
  
  return parts.join('\n');
}

// Helper: Wait for element to appear
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

// Helper: Fill input with simulated typing
async function fillInput(element, value) {
  element.focus();
  element.value = '';
  
  // Dispatch input events to trigger React state updates
  for (const char of value) {
    element.value += char;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(10);
  }
  
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
}

// Helper: Sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Notify background that we're on a Facebook page
chrome.runtime.sendMessage({
  type: 'FACEBOOK_PAGE_LOADED',
  url: window.location.href,
  isMarketplace: window.location.href.includes('/marketplace'),
}).catch(() => {
  // Background might not be listening yet
});
