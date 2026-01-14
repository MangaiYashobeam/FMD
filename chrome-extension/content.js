// Content script that runs on Facebook Marketplace pages

console.log('FaceMyDealer content script loaded');

let pendingVehicle = null;
let fbCredentials = null;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received:', request);

  switch (request.action) {
    case 'checkPendingPost':
      checkAndAutofill();
      sendResponse({ success: true });
      break;
  }
});

// Check if there's a pending post and start autofill
async function checkAndAutofill() {
  try {
    const data = await chrome.storage.local.get(['pendingPost']);
    
    if (!data.pendingPost) {
      return;
    }

    const { vehicle, credentials, timestamp } = data.pendingPost;

    // Check if post is still valid (within 5 minutes)
    if (Date.now() - timestamp > 5 * 60 * 1000) {
      console.log('Pending post expired');
      await chrome.storage.local.remove(['pendingPost']);
      return;
    }

    pendingVehicle = vehicle;
    fbCredentials = credentials;

    // Wait for page to be fully loaded
    await waitForElement('body');

    // Check if we're logged in
    const isLoggedIn = await checkFacebookLogin();

    if (!isLoggedIn && credentials.username && credentials.password) {
      await performLogin(credentials.username, credentials.password);
    }

    // Wait for marketplace form to load
    await waitForMarketplaceForm();

    // Start autofill process
    await autofillMarketplaceForm(vehicle);

    // Show confirmation dialog
    showConfirmationDialog();

  } catch (error) {
    console.error('Autofill error:', error);
    showError(error.message);
  }
}

// Check if user is logged into Facebook
async function checkFacebookLogin() {
  // Look for common elements that appear when logged in
  const profileButton = document.querySelector('[aria-label*="Your profile"]') || 
                        document.querySelector('[data-click="profile_icon"]');
  
  return !!profileButton;
}

// Perform Facebook login
async function performLogin(username, password) {
  console.log('Attempting auto-login...');

  try {
    // Find email input
    const emailInput = await waitForElement('input[name="email"], input[type="email"]', 10000);
    emailInput.value = username;
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Find password input
    const passwordInput = await waitForElement('input[name="pass"], input[type="password"]', 2000);
    passwordInput.value = password;
    passwordInput.dispatchEvent(new Event('input', { bubbles: true }));

    await sleep(500);

    // Find and click login button
    const loginButton = document.querySelector('button[name="login"], button[type="submit"]');
    if (loginButton) {
      loginButton.click();
      
      // Wait for potential 2FA prompt
      await sleep(3000);
      
      // Check for 2FA
      const twoFAInput = document.querySelector('input[name="approvals_code"]');
      if (twoFAInput && fbCredentials.twoFactorCodes.length > 0) {
        await handle2FA(fbCredentials.twoFactorCodes);
      }
    }

  } catch (error) {
    console.error('Login failed:', error);
    throw new Error('Auto-login failed. Please log in manually.');
  }
}

// Handle 2FA code entry
async function handle2FA(codes) {
  console.log('Handling 2FA...');

  const twoFAInput = document.querySelector('input[name="approvals_code"]');
  if (!twoFAInput) return;

  // Use the first available code
  const code = codes[0];
  twoFAInput.value = code;
  twoFAInput.dispatchEvent(new Event('input', { bubbles: true }));

  await sleep(500);

  // Click continue button
  const continueButton = document.querySelector('button[type="submit"]');
  if (continueButton) {
    continueButton.click();

    // Mark code as used in backend
    chrome.runtime.sendMessage({
      action: 'markCodeUsed',
      code: code
    });
  }
}

// Wait for marketplace form to load
async function waitForMarketplaceForm() {
  console.log('Waiting for marketplace form...');
  
  // Wait for common marketplace form elements
  await waitForElement('[aria-label*="Title"], input[placeholder*="Title"]', 15000);
}

// Autofill the marketplace listing form
async function autofillMarketplaceForm(vehicle) {
  console.log('Auto-filling marketplace form...', vehicle);

  try {
    // Title
    await fillInput('Title', `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}`);

    // Price
    await fillInput('Price', vehicle.price.toString());

    // Category - select "Vehicles"
    await selectCategory('Vehicles');

    // Condition
    await selectCondition(vehicle.isNew ? 'New' : 'Used');

    // Description
    const description = generateDescription(vehicle);
    await fillTextarea('Description', description);

    // Vehicle details
    if (vehicle.mileage) {
      await fillInput('Mileage', vehicle.mileage.toString());
    }

    await fillInput('Year', vehicle.year.toString());
    await fillInput('Make', vehicle.make);
    await fillInput('Model', vehicle.model);

    if (vehicle.vin) {
      await fillInput('VIN', vehicle.vin);
    }

    // Upload photos
    if (vehicle.imageUrls && vehicle.imageUrls.length > 0) {
      await uploadPhotos(vehicle.imageUrls);
    }

    console.log('Form autofill complete!');

  } catch (error) {
    console.error('Autofill error:', error);
    throw error;
  }
}

// Generate vehicle description
function generateDescription(vehicle) {
  let desc = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  
  if (vehicle.trim) desc += ` ${vehicle.trim}`;
  desc += '\n\n';
  
  if (vehicle.mileage) desc += `Mileage: ${vehicle.mileage.toLocaleString()} miles\n`;
  if (vehicle.vin) desc += `VIN: ${vehicle.vin}\n`;
  if (vehicle.exteriorColor) desc += `Color: ${vehicle.exteriorColor}\n`;
  if (vehicle.transmission) desc += `Transmission: ${vehicle.transmission}\n`;
  if (vehicle.drivetrain) desc += `Drivetrain: ${vehicle.drivetrain}\n`;
  if (vehicle.fuelType) desc += `Fuel Type: ${vehicle.fuelType}\n`;
  
  if (vehicle.description) {
    desc += `\n${vehicle.description}\n`;
  }
  
  desc += '\n📍 Contact us for more details!';
  
  return desc;
}

// Fill input field by label or placeholder
async function fillInput(label, value) {
  const selectors = [
    `input[aria-label*="${label}"]`,
    `input[placeholder*="${label}"]`,
    `input[name*="${label.toLowerCase()}"]`,
    `label:contains("${label}") + input`,
  ];

  for (const selector of selectors) {
    const input = document.querySelector(selector);
    if (input) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(200);
      return true;
    }
  }

  console.warn(`Could not find input for: ${label}`);
  return false;
}

// Fill textarea
async function fillTextarea(label, value) {
  const textarea = document.querySelector(`textarea[aria-label*="${label}"], textarea[placeholder*="${label}"]`);
  
  if (textarea) {
    textarea.value = value;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(200);
    return true;
  }

  return false;
}

// Select category
async function selectCategory(category) {
  // Click category dropdown
  const categoryButton = document.querySelector('[aria-label*="Category"]');
  if (categoryButton) {
    categoryButton.click();
    await sleep(500);

    // Find and click the category option
    const categoryOption = Array.from(document.querySelectorAll('[role="option"]'))
      .find(el => el.textContent.includes(category));
    
    if (categoryOption) {
      categoryOption.click();
      await sleep(300);
    }
  }
}

// Select condition
async function selectCondition(condition) {
  const conditionButton = document.querySelector('[aria-label*="Condition"]');
  if (conditionButton) {
    conditionButton.click();
    await sleep(500);

    const conditionOption = Array.from(document.querySelectorAll('[role="option"]'))
      .find(el => el.textContent.includes(condition));
    
    if (conditionOption) {
      conditionOption.click();
      await sleep(300);
    }
  }
}

// Upload photos from URLs
async function uploadPhotos(imageUrls) {
  console.log('Photo upload not yet implemented - please add photos manually');
  // TODO: Download images and upload to file input
}

// Show confirmation dialog
function showConfirmationDialog() {
  const dialog = document.createElement('div');
  dialog.id = 'fmd-confirm-dialog';
  dialog.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      z-index: 999999;
      max-width: 300px;
    ">
      <h3 style="margin: 0 0 10px 0;">✅ Form Auto-Filled!</h3>
      <p style="margin: 0 0 15px 0;">
        Review the listing details and click the "Publish" button when ready.
      </p>
      <button id="fmd-close-dialog" style="
        background: white;
        color: #4CAF50;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
      ">OK</button>
    </div>
  `;

  document.body.appendChild(dialog);

  document.getElementById('fmd-close-dialog').addEventListener('click', () => {
    dialog.remove();
    watchForPublishButton();
  });

  // Auto-close after 10 seconds
  setTimeout(() => {
    if (document.getElementById('fmd-confirm-dialog')) {
      dialog.remove();
      watchForPublishButton();
    }
  }, 10000);
}

// Watch for publish button click
function watchForPublishButton() {
  // Monitor for successful post
  const observer = new MutationObserver(() => {
    const url = window.location.href;
    if (url.includes('/marketplace/item/')) {
      // Post was successful
      capturePostSuccess(url);
      observer.disconnect();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Capture successful post
async function capturePostSuccess(postUrl) {
  console.log('Post successful!', postUrl);

  // Take screenshot (optional)
  // const screenshot = await captureScreenshot();

  // Send confirmation to backend
  chrome.runtime.sendMessage({
    action: 'confirmPost',
    data: {
      vehicleId: pendingVehicle.id,
      postUrl: postUrl,
      screenshot: null
    }
  }, (response) => {
    if (response.success) {
      showSuccessNotification();
      chrome.storage.local.remove(['pendingPost']);
    }
  });
}

// Show success notification
function showSuccessNotification() {
  const notification = document.createElement('div');
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      z-index: 999999;
    ">
      <h3 style="margin: 0 0 10px 0;">🎉 Success!</h3>
      <p style="margin: 0;">Vehicle posted to Marketplace and tracked in FaceMyDealer.</p>
    </div>
  `;

  document.body.appendChild(notification);

  setTimeout(() => notification.remove(), 5000);
}

// Show error message
function showError(message) {
  const error = document.createElement('div');
  error.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      z-index: 999999;
      max-width: 300px;
    ">
      <h3 style="margin: 0 0 10px 0;">❌ Error</h3>
      <p style="margin: 0;">${message}</p>
    </div>
  `;

  document.body.appendChild(error);

  setTimeout(() => error.remove(), 8000);
}

// Utility: Wait for element to appear
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      return resolve(element);
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for element: ${selector}`));
    }, timeout);
  });
}

// Utility: Sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start checking on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkAndAutofill);
} else {
  checkAndAutofill();
}
