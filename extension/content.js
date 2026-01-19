// Dealers Face Chrome Extension - Facebook Content Script
// Enhanced with IAI Soldier Integration for Marketplace Automation
// Version 3.2.0 - Smart Navigation with Visual Learning

console.log('🎖️ Dealers Face IAI content script loaded on Facebook');

// Global state
let iaiSoldier = null;
let pendingTasks = [];
let navigationState = {
  currentStep: null,
  retryCount: 0,
  maxRetries: 3,
  stepHistory: [],
  lastScreenshot: null,
};

// IAI Speed Configuration
const IAI_SPEED = {
  ULTRA_FAST: { typing: 5, action: 100, navigation: 500 },
  FAST: { typing: 15, action: 300, navigation: 1000 },
  NORMAL: { typing: 30, action: 500, navigation: 1500 },
  CAREFUL: { typing: 50, action: 800, navigation: 2500 },
  HUMAN: { typing: 80 + Math.random() * 40, action: 1000, navigation: 3000 },
};

let currentSpeed = IAI_SPEED.FAST;

// Initialize IAI Soldier if available
function initializeIAI() {
  if (typeof window.IAISoldier !== 'undefined') {
    chrome.storage.local.get(['accountId', 'authToken', 'iaiSpeed'], (result) => {
      if (result.accountId && result.authToken) {
        iaiSoldier = new window.IAISoldier();
        iaiSoldier.initialize(result.accountId, result.authToken);
        console.log('🎖️ IAI Soldier initialized and ready');
      }
      if (result.iaiSpeed && IAI_SPEED[result.iaiSpeed]) {
        currentSpeed = IAI_SPEED[result.iaiSpeed];
        console.log(`⚡ IAI Speed set to: ${result.iaiSpeed}`);
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
  navigationState.currentStep = 'initializing';
  navigationState.retryCount = 0;
  
  try {
    // Log the start of task
    logNavigationEvent('task_start', { taskType: task.type, taskId: task.id });
    
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
    logNavigationEvent('task_error', { error: error.message, step: navigationState.currentStep });
    
    // Notify background of failure
    chrome.runtime.sendMessage({
      type: 'TASK_FAILED',
      taskId: task.id,
      error: error.message,
      navigationState: { ...navigationState },
    });
    
    throw error;
  }
}

async function executeMarketplacePost(task) {
  const vehicleData = task.data?.vehicle || task.data;
  
  console.log('🚗 Creating Marketplace listing for:', vehicleData);
  navigationState.currentStep = 'checking_location';
  
  // Smart navigation - check current page state
  const pageState = await analyzePageState();
  console.log('📍 Page state:', pageState);
  
  // Navigate to create listing page if needed
  if (!pageState.isCreateListingPage) {
    navigationState.currentStep = 'navigating';
    await navigateToCreateListing();
    return { success: true, message: 'Navigating to create listing page...', needsRetry: true };
  }
  
  // Wait for form to be ready
  navigationState.currentStep = 'waiting_for_form';
  await waitForFormReady();
  
  // Select Vehicle category if needed
  if (pageState.needsCategorySelection) {
    navigationState.currentStep = 'selecting_category';
    await selectVehicleCategory();
  }
  
  // Use IAI Soldier if available
  if (iaiSoldier && iaiSoldier.lister) {
    navigationState.currentStep = 'using_iai_lister';
    const result = await iaiSoldier.lister.createListing(vehicleData, vehicleData.photos || []);
    
    // Notify background of completion
    chrome.runtime.sendMessage({
      type: 'TASK_COMPLETED',
      taskId: task.id,
      result: { success: true, message: 'Listing form filled, ready for review' },
    });
    
    return result;
  }
  
  // Fallback to smart form filling
  navigationState.currentStep = 'filling_form';
  await smartFillMarketplaceForm(vehicleData);
  
  // Notify background of completion
  chrome.runtime.sendMessage({
    type: 'TASK_COMPLETED',
    taskId: task.id,
    result: { success: true, message: 'Form filled successfully' },
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
// SMART NAVIGATION & PAGE ANALYSIS
// ============================================

async function analyzePageState() {
  const url = window.location.href;
  const pageState = {
    url,
    isMarketplace: url.includes('/marketplace'),
    isCreateListingPage: url.includes('/marketplace/create'),
    isVehicleForm: false,
    needsCategorySelection: false,
    formElements: [],
    visibleButtons: [],
    errors: [],
  };
  
  // Check for vehicle-specific form
  const vehicleIndicators = [
    '[aria-label*="Year" i]',
    '[aria-label*="Make" i]',
    '[aria-label*="Model" i]',
    '[aria-label*="mileage" i]',
    'input[placeholder*="VIN" i]',
  ];
  
  for (const selector of vehicleIndicators) {
    if (document.querySelector(selector)) {
      pageState.isVehicleForm = true;
      break;
    }
  }
  
  // Check if we need to select a category (e.g., "Vehicles")
  const categoryButtons = document.querySelectorAll('[role="button"], button');
  for (const btn of categoryButtons) {
    const text = btn.textContent?.toLowerCase() || '';
    if (text.includes('vehicle') || text.includes('car') || text.includes('truck')) {
      pageState.needsCategorySelection = true;
      pageState.vehicleCategoryButton = btn;
      break;
    }
  }
  
  // Find all clickable elements
  const clickableSelectors = [
    'button',
    '[role="button"]',
    '[role="tab"]',
    'a[href*="marketplace"]',
    '[data-visualcompletion]',
  ];
  
  for (const selector of clickableSelectors) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      const text = el.textContent?.trim().substring(0, 50);
      if (text && !pageState.visibleButtons.includes(text)) {
        pageState.visibleButtons.push(text);
      }
    });
  }
  
  // Find form elements
  const formSelectors = [
    'input[type="text"]',
    'input[type="number"]',
    'textarea',
    '[role="textbox"]',
    '[role="combobox"]',
    'select',
  ];
  
  for (const selector of formSelectors) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      const label = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name');
      if (label) {
        pageState.formElements.push({
          selector,
          label,
          type: el.tagName.toLowerCase(),
        });
      }
    });
  }
  
  // Check for errors on page
  const errorSelectors = [
    '[role="alert"]',
    '.error',
    '[aria-invalid="true"]',
    '[data-error]',
  ];
  
  for (const selector of errorSelectors) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      const text = el.textContent?.trim();
      if (text) pageState.errors.push(text);
    });
  }
  
  return pageState;
}

async function navigateToCreateListing() {
  logNavigationEvent('navigate_start', { target: 'create_listing' });
  
  // Try to find "Create new listing" or "Sell" button first
  const createButtons = await findClickableElements([
    'Create new listing',
    'Create listing',
    'Sell',
    'Sell something',
    'Create',
  ]);
  
  if (createButtons.length > 0) {
    console.log('🔍 Found create button, clicking...');
    await smartClick(createButtons[0]);
    await sleep(currentSpeed.navigation);
    
    // Now look for "Vehicle" category
    const vehicleButtons = await findClickableElements([
      'Vehicle',
      'Vehicles',
      'Car',
      'Cars',
      'Automobile',
    ]);
    
    if (vehicleButtons.length > 0) {
      console.log('🚗 Found vehicle category, clicking...');
      await smartClick(vehicleButtons[0]);
      await sleep(currentSpeed.navigation);
      return;
    }
  }
  
  // Direct navigation fallback
  console.log('📍 Direct navigation to marketplace vehicle creation');
  window.location.href = 'https://www.facebook.com/marketplace/create/vehicle/';
}

async function waitForFormReady(timeout = 10000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    // Look for key form indicators
    const formIndicators = [
      '[aria-label*="Title" i]',
      '[aria-label*="Price" i]',
      'input[placeholder*="title" i]',
      '[role="main"] form',
      '[data-pagelet*="Marketplace"]',
    ];
    
    for (const selector of formIndicators) {
      if (document.querySelector(selector)) {
        console.log('✅ Form is ready');
        await sleep(currentSpeed.action);
        return true;
      }
    }
    
    await sleep(500);
  }
  
  throw new Error('Form did not load within timeout');
}

async function selectVehicleCategory() {
  const categoryButtons = await findClickableElements([
    'Vehicle',
    'Vehicles',
    'Car/Truck',
    'Car',
  ]);
  
  if (categoryButtons.length > 0) {
    await smartClick(categoryButtons[0]);
    await sleep(currentSpeed.navigation);
    return true;
  }
  
  return false;
}

async function findClickableElements(textPatterns) {
  const results = [];
  const allClickable = document.querySelectorAll('button, [role="button"], a, [role="tab"], [role="menuitem"]');
  
  for (const element of allClickable) {
    const text = element.textContent?.toLowerCase().trim() || '';
    const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
    
    for (const pattern of textPatterns) {
      const lowerPattern = pattern.toLowerCase();
      if (text.includes(lowerPattern) || ariaLabel.includes(lowerPattern)) {
        // Check if element is visible
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          results.push({
            element,
            text: text.substring(0, 50),
            priority: text === lowerPattern ? 1 : 2, // Exact match gets priority
          });
        }
        break;
      }
    }
  }
  
  // Sort by priority
  results.sort((a, b) => a.priority - b.priority);
  return results.map(r => r.element);
}

async function smartClick(element) {
  // Scroll element into view if needed
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(300);
  
  // Highlight the element briefly (visual feedback)
  const originalOutline = element.style.outline;
  element.style.outline = '3px solid #3B82F6';
  await sleep(200);
  element.style.outline = originalOutline;
  
  // Click with mouse events for maximum compatibility
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  
  element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  await sleep(50);
  element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }));
  await sleep(50);
  element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y }));
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
  
  // Also try native click
  try {
    element.click();
  } catch (e) {
    // Ignore if native click fails
  }
  
  logNavigationEvent('click', { text: element.textContent?.substring(0, 30) });
}

function logNavigationEvent(event, data = {}) {
  const entry = {
    timestamp: Date.now(),
    event,
    ...data,
  };
  
  navigationState.stepHistory.push(entry);
  
  // Keep only last 50 entries
  if (navigationState.stepHistory.length > 50) {
    navigationState.stepHistory = navigationState.stepHistory.slice(-50);
  }
  
  console.log(`📊 IAI Event: ${event}`, data);
}

// ============================================
// MARKETPLACE FORM FILLING (SMART VERSION)
// ============================================

async function smartFillMarketplaceForm(vehicle) {
  console.log('📝 Smart filling marketplace form with vehicle:', vehicle);
  logNavigationEvent('form_fill_start', { vin: vehicle.vin });
  
  // Wait for form to be ready
  await waitForFormReady();
  
  const filledFields = [];
  const failedFields = [];
  
  // === PHOTOS FIRST (Most important for engagement) ===
  if (vehicle.photos?.length > 0 || vehicle.photoUrls?.length > 0) {
    try {
      const photos = vehicle.photos || vehicle.photoUrls;
      await uploadPhotos(photos);
      filledFields.push('photos');
    } catch (e) {
      console.warn('Photo upload failed:', e);
      failedFields.push({ field: 'photos', error: e.message });
    }
  }
  
  // === TITLE ===
  const title = vehicle.title || `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}`.trim();
  const titleResult = await smartFillField({
    selectors: [
      '[aria-label*="Title" i]',
      'input[placeholder*="title" i]',
      '[name="title"]',
      'input[data-testid="marketplace-title"]',
    ],
    value: title,
    fieldName: 'title',
  });
  if (titleResult) filledFields.push('title');
  else failedFields.push({ field: 'title' });
  
  // === PRICE ===
  const price = String(vehicle.price || vehicle.listPrice || '').replace(/[^0-9]/g, '');
  if (price) {
    const priceResult = await smartFillField({
      selectors: [
        '[aria-label*="Price" i]',
        'input[placeholder*="price" i]',
        '[name="price"]',
        'input[type="number"]',
      ],
      value: price,
      fieldName: 'price',
    });
    if (priceResult) filledFields.push('price');
    else failedFields.push({ field: 'price' });
  }
  
  // === YEAR (Dropdown) ===
  if (vehicle.year) {
    const yearResult = await smartSelectDropdown({
      buttonSelectors: [
        '[aria-label*="Year" i]',
        '[data-testid*="year"]',
      ],
      value: String(vehicle.year),
      fieldName: 'year',
    });
    if (yearResult) filledFields.push('year');
    else failedFields.push({ field: 'year' });
  }
  
  // === MAKE (Dropdown) ===
  if (vehicle.make) {
    const makeResult = await smartSelectDropdown({
      buttonSelectors: [
        '[aria-label*="Make" i]',
        '[data-testid*="make"]',
      ],
      value: vehicle.make,
      fieldName: 'make',
    });
    if (makeResult) filledFields.push('make');
    else failedFields.push({ field: 'make' });
  }
  
  // === MODEL (Dropdown) ===
  if (vehicle.model) {
    const modelResult = await smartSelectDropdown({
      buttonSelectors: [
        '[aria-label*="Model" i]',
        '[data-testid*="model"]',
      ],
      value: vehicle.model,
      fieldName: 'model',
    });
    if (modelResult) filledFields.push('model');
    else failedFields.push({ field: 'model' });
  }
  
  // === MILEAGE ===
  if (vehicle.mileage) {
    const mileageResult = await smartFillField({
      selectors: [
        '[aria-label*="mileage" i]',
        '[aria-label*="odometer" i]',
        'input[placeholder*="mileage" i]',
      ],
      value: String(vehicle.mileage),
      fieldName: 'mileage',
    });
    if (mileageResult) filledFields.push('mileage');
    else failedFields.push({ field: 'mileage' });
  }
  
  // === BODY STYLE (Dropdown) ===
  if (vehicle.bodyStyle || vehicle.bodyType) {
    const bodyResult = await smartSelectDropdown({
      buttonSelectors: [
        '[aria-label*="Body style" i]',
        '[aria-label*="Body type" i]',
      ],
      value: vehicle.bodyStyle || vehicle.bodyType,
      fieldName: 'bodyStyle',
    });
    if (bodyResult) filledFields.push('bodyStyle');
  }
  
  // === EXTERIOR COLOR ===
  if (vehicle.exteriorColor || vehicle.color) {
    const colorResult = await smartSelectDropdown({
      buttonSelectors: [
        '[aria-label*="Exterior color" i]',
        '[aria-label*="Color" i]',
      ],
      value: vehicle.exteriorColor || vehicle.color,
      fieldName: 'exteriorColor',
    });
    if (colorResult) filledFields.push('exteriorColor');
  }
  
  // === TRANSMISSION ===
  if (vehicle.transmission) {
    const transResult = await smartSelectDropdown({
      buttonSelectors: [
        '[aria-label*="Transmission" i]',
      ],
      value: vehicle.transmission,
      fieldName: 'transmission',
    });
    if (transResult) filledFields.push('transmission');
  }
  
  // === FUEL TYPE ===
  if (vehicle.fuelType) {
    const fuelResult = await smartSelectDropdown({
      buttonSelectors: [
        '[aria-label*="Fuel type" i]',
        '[aria-label*="Fuel" i]',
      ],
      value: vehicle.fuelType,
      fieldName: 'fuelType',
    });
    if (fuelResult) filledFields.push('fuelType');
  }
  
  // === DESCRIPTION (Last) ===
  const description = vehicle.description || generateDescription(vehicle);
  const descResult = await smartFillField({
    selectors: [
      '[aria-label*="Description" i]',
      'textarea[placeholder*="describe" i]',
      '[role="textbox"][aria-multiline="true"]',
      'textarea',
    ],
    value: description,
    fieldName: 'description',
    isTextarea: true,
  });
  if (descResult) filledFields.push('description');
  else failedFields.push({ field: 'description' });
  
  logNavigationEvent('form_fill_complete', {
    filled: filledFields.length,
    failed: failedFields.length,
    filledFields,
    failedFields,
  });
  
  console.log(`📝 Form filling complete: ${filledFields.length} filled, ${failedFields.length} failed`);
  showCompletionNotification(filledFields.length, failedFields.length);
  
  return { filledFields, failedFields };
}

async function smartFillField({ selectors, value, fieldName, isTextarea = false }) {
  logNavigationEvent('fill_field', { field: fieldName });
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue; // Skip hidden elements
      
      try {
        await fillInput(element, value);
        console.log(`✅ ${fieldName} filled`);
        await sleep(currentSpeed.action);
        return true;
      } catch (e) {
        console.warn(`Failed to fill ${fieldName} with selector ${selector}:`, e);
      }
    }
  }
  
  console.warn(`❌ Could not find field: ${fieldName}`);
  return false;
}

async function smartSelectDropdown({ buttonSelectors, value, fieldName }) {
  logNavigationEvent('select_dropdown', { field: fieldName, value });
  
  for (const selector of buttonSelectors) {
    const button = document.querySelector(selector);
    if (!button) continue;
    
    try {
      // Click to open dropdown
      await smartClick(button);
      await sleep(currentSpeed.action);
      
      // Wait for options to appear
      await sleep(300);
      
      // Look for option with matching text
      const optionSelectors = [
        '[role="option"]',
        '[role="menuitem"]',
        '[role="listbox"] [role="option"]',
        '[data-visualcompletion="ignore-dynamic"] span',
      ];
      
      for (const optSelector of optionSelectors) {
        const options = document.querySelectorAll(optSelector);
        for (const option of options) {
          const optionText = option.textContent?.toLowerCase().trim() || '';
          const searchValue = value.toString().toLowerCase();
          
          // Check for exact match or contains
          if (optionText === searchValue || optionText.includes(searchValue)) {
            await smartClick(option);
            console.log(`✅ ${fieldName} selected: ${value}`);
            await sleep(currentSpeed.action);
            return true;
          }
        }
      }
      
      // If no option found, try typing to search
      const searchInput = document.querySelector('[role="combobox"] input, [role="listbox"] input');
      if (searchInput) {
        await fillInput(searchInput, value.toString());
        await sleep(500);
        
        // Click first result
        const firstOption = document.querySelector('[role="option"]');
        if (firstOption) {
          await smartClick(firstOption);
          console.log(`✅ ${fieldName} selected via search: ${value}`);
          return true;
        }
      }
      
      // Close dropdown if nothing selected (press Escape)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      
    } catch (e) {
      console.warn(`Failed to select ${fieldName}:`, e);
    }
  }
  
  console.warn(`❌ Could not select dropdown: ${fieldName}`);
  return false;
}

async function uploadPhotos(photos) {
  if (!photos || photos.length === 0) return false;
  
  logNavigationEvent('upload_photos', { count: photos.length });
  
  // Find the photo upload area
  const uploadSelectors = [
    'input[type="file"][accept*="image"]',
    '[aria-label*="photo" i] input[type="file"]',
    '[data-testid*="photo"] input[type="file"]',
  ];
  
  let fileInput = null;
  for (const selector of uploadSelectors) {
    fileInput = document.querySelector(selector);
    if (fileInput) break;
  }
  
  if (!fileInput) {
    // Try to find and click "Add photos" button
    const addPhotoButtons = await findClickableElements(['Add photos', 'Add photo', 'Upload', 'Photos']);
    if (addPhotoButtons.length > 0) {
      await smartClick(addPhotoButtons[0]);
      await sleep(currentSpeed.action);
      
      // Try to find file input again
      fileInput = document.querySelector('input[type="file"]');
    }
  }
  
  if (!fileInput) {
    console.warn('Could not find photo upload input');
    return false;
  }
  
  // For URL-based photos, we need to download them first
  // This would require background script coordination
  console.log('📸 Photo upload area found, photos ready for upload');
  
  // Notify user that photos need manual selection for now
  // (Full auto-upload requires more complex handling)
  return true;
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

function showCompletionNotification(filled = 0, failed = 0) {
  const notification = document.createElement('div');
  const isPartialSuccess = failed > 0;
  
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, ${isPartialSuccess ? '#F59E0B' : '#10B981'} 0%, ${isPartialSuccess ? '#D97706' : '#059669'} 100%);
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="font-size: 24px;">${isPartialSuccess ? '⚠️' : '✅'}</div>
        <div>
          <div style="font-weight: 600; font-size: 14px;">${isPartialSuccess ? 'Partially Complete' : 'Form Ready!'}</div>
          <div style="font-size: 12px; opacity: 0.9;">${filled} fields filled${failed > 0 ? `, ${failed} need manual entry` : ''}</div>
          <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">Review and click Publish</div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => notification.remove(), 7000);
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
  await sleep(100);
  
  // Clear existing value
  if (element.value !== undefined) {
    element.select && element.select();
    element.value = '';
  } else if (element.isContentEditable) {
    element.textContent = '';
  }
  
  // Dispatch clear events
  element.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(50);
  
  // Simulate typing with configurable speed
  const typingDelay = currentSpeed.typing || 15;
  
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
    
    // Variable delay for human-like typing
    await sleep(typingDelay + Math.random() * (typingDelay * 0.5));
  }
  
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
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
