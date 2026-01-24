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
  
  // IAI Sidepanel: Fill vehicle listing form
  if (message.type === 'IAI_FILL_LISTING') {
    console.log('🚗 IAI_FILL_LISTING received with vehicle:', message.vehicle);
    smartFillMarketplaceForm(message.vehicle)
      .then(result => {
        console.log('✅ IAI_FILL_LISTING completed:', result);
        sendResponse({ success: true, result });
      })
      .catch(error => {
        console.error('❌ IAI_FILL_LISTING failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  // IAI Sidepanel: Upload vehicle images
  if (message.type === 'IAI_UPLOAD_IMAGES') {
    console.log('📷 IAI_UPLOAD_IMAGES received with', message.images?.length, 'images');
    uploadPhotosFromUrls(message.images)
      .then(result => {
        console.log('✅ IAI_UPLOAD_IMAGES completed:', result);
        sendResponse({ success: true, result });
      })
      .catch(error => {
        console.error('❌ IAI_UPLOAD_IMAGES failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  // IAI Sidepanel: Publish the listing
  if (message.type === 'IAI_PUBLISH_LISTING') {
    console.log('🚀 IAI_PUBLISH_LISTING received');
    clickPublishButton()
      .then(result => {
        console.log('✅ IAI_PUBLISH_LISTING completed:', result);
        sendResponse({ success: true, result });
      })
      .catch(error => {
        console.error('❌ IAI_PUBLISH_LISTING failed:', error);
        sendResponse({ success: false, error: error.message });
      });
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
// ERROR DETECTION & REPORTING
// ============================================

// Track errors for AI assistance
let errorHistory = [];
let userStruggleIndicators = {
  failedAttempts: 0,
  lastAttemptTime: null,
  samePageTime: 0,
  idleTime: 0,
};

// Report error to server for Nova diagnostics
async function reportErrorToServer(error, context = {}) {
  try {
    const { authToken, accountId } = await chrome.storage.local.get(['authToken', 'accountId']);
    
    if (!authToken) return;
    
    const errorReport = {
      error: typeof error === 'string' ? error : error.message || 'Unknown error',
      stackTrace: error.stack || null,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      context: {
        ...context,
        accountId,
        pageState: await analyzePageState(),
        userStruggle: { ...userStruggleIndicators },
        errorHistory: errorHistory.slice(-5), // Last 5 errors
      },
    };
    
    // Add to local history
    errorHistory.push({
      time: Date.now(),
      error: errorReport.error,
    });
    if (errorHistory.length > 20) errorHistory.shift();
    
    const response = await fetch('https://dealersface.com/api/extension/report-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(errorReport),
    });
    
    if (response.ok) {
      const data = await response.json();
      // Show diagnostic to user via AI assistant
      if (data.diagnostic) {
        showAIAssistantForError(data.diagnostic);
      }
    }
  } catch (e) {
    console.error('Failed to report error:', e);
  }
}

// Detect user struggling with the interface
function detectUserStruggle() {
  // Reset if user succeeded
  if (userStruggleIndicators.failedAttempts >= 3) {
    showAIAssistantForError(`It looks like you're having trouble. I detected ${userStruggleIndicators.failedAttempts} failed attempts. Can I help?`);
    userStruggleIndicators.failedAttempts = 0;
  }
  
  // Check if user has been on the same page too long
  if (userStruggleIndicators.samePageTime > 60000) { // 1 minute
    showAIAssistantForError('Taking a while? I can help you fill this form faster. Click "Auto-Fill" to get started!');
    userStruggleIndicators.samePageTime = 0;
  }
}

// Track failed form interactions
function trackFailedAttempt() {
  userStruggleIndicators.failedAttempts++;
  userStruggleIndicators.lastAttemptTime = Date.now();
  detectUserStruggle();
}

// Global error handler
window.addEventListener('error', (event) => {
  if (event.message && event.message.includes('Dealers Face')) {
    reportErrorToServer(event.error || event.message, { type: 'window_error' });
  }
});

// Track time on page for struggle detection
let pageLoadTime = Date.now();
setInterval(() => {
  if (window.location.href.includes('/marketplace/create')) {
    userStruggleIndicators.samePageTime = Date.now() - pageLoadTime;
    detectUserStruggle();
  }
}, 30000); // Check every 30 seconds

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
    
    // Report error for Nova diagnostics
    await reportErrorToServer(error, {
      type: 'task_error',
      taskId: task.id,
      taskType: task.type,
      step: navigationState.currentStep,
    });
    
    // Track failed attempt
    trackFailedAttempt();
    
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

  // === INTERIOR COLOR ===
  if (vehicle.interiorColor) {
    const intColorResult = await smartSelectDropdown({
      buttonSelectors: [
        '[aria-label*="Interior color" i]',
      ],
      value: vehicle.interiorColor,
      fieldName: 'interiorColor',
    });
    if (intColorResult) filledFields.push('interiorColor');
  }
  
  // === TRANSMISSION ===
  if (vehicle.transmission || vehicle.transmissionType) {
    const transResult = await smartSelectDropdown({
      buttonSelectors: [
        '[aria-label*="Transmission" i]',
      ],
      value: vehicle.transmission || vehicle.transmissionType,
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

  // === DRIVETRAIN ===
  if (vehicle.drivetrain) {
    const driveResult = await smartSelectDropdown({
      buttonSelectors: [
        '[aria-label*="Drivetrain" i]',
        '[aria-label*="Drive type" i]',
      ],
      value: vehicle.drivetrain,
      fieldName: 'drivetrain',
    });
    if (driveResult) filledFields.push('drivetrain');
  }

  // === TITLE STATUS (Clean, Salvage, Rebuilt) ===
  if (vehicle.titleStatus) {
    const titleStatusResult = await smartSelectDropdown({
      buttonSelectors: [
        '[aria-label*="Title status" i]',
        '[aria-label*="Title" i][aria-label*="status" i]',
        '[aria-label*="Clean title" i]',
      ],
      value: vehicle.titleStatus,
      fieldName: 'titleStatus',
    });
    if (titleStatusResult) filledFields.push('titleStatus');
  }

  // === NUMBER OF DOORS ===
  if (vehicle.numberOfDoors) {
    const doorsResult = await smartSelectDropdown({
      buttonSelectors: [
        '[aria-label*="door" i]',
        '[aria-label*="Doors" i]',
      ],
      value: String(vehicle.numberOfDoors),
      fieldName: 'numberOfDoors',
    });
    if (doorsResult) filledFields.push('numberOfDoors');
  }

  // === ENGINE / CYLINDERS ===
  if (vehicle.cylinders || vehicle.engineDescription) {
    const engineResult = await smartSelectDropdown({
      buttonSelectors: [
        '[aria-label*="Engine" i]',
        '[aria-label*="Cylinder" i]',
      ],
      value: vehicle.cylinders || vehicle.engineDescription,
      fieldName: 'engine',
    });
    if (engineResult) filledFields.push('engine');
  }

  // === CONDITION (New/Used) ===
  if (vehicle.condition) {
    const conditionResult = await smartSelectDropdown({
      buttonSelectors: [
        '[aria-label*="Condition" i]',
        '[aria-label*="Vehicle condition" i]',
      ],
      value: vehicle.condition,
      fieldName: 'condition',
    });
    if (conditionResult) filledFields.push('condition');
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

/**
 * Upload photos from URL array (called from sidepanel IAI)
 */
async function uploadPhotosFromUrls(imageUrls) {
  if (!imageUrls || imageUrls.length === 0) {
    console.log('📷 No images to upload');
    return { uploaded: 0 };
  }
  
  console.log('📷 Attempting to upload', imageUrls.length, 'images from URLs');
  logNavigationEvent('upload_photos_urls', { count: imageUrls.length });
  
  // Find the photo upload input
  const uploadSelectors = [
    'input[type="file"][accept*="image"]',
    '[aria-label*="photo" i] input[type="file"]',
    '[data-testid*="photo"] input[type="file"]',
    'input[type="file"]',
  ];
  
  let fileInput = null;
  for (const selector of uploadSelectors) {
    fileInput = document.querySelector(selector);
    if (fileInput) break;
  }
  
  if (!fileInput) {
    // Try to click "Add photos" button first
    const addPhotoButtons = await findClickableElements(['Add photos', 'Add photo', 'Upload', 'Photos']);
    if (addPhotoButtons.length > 0) {
      await smartClick(addPhotoButtons[0]);
      await sleep(currentSpeed.action);
      
      // Try to find file input again
      for (const selector of uploadSelectors) {
        fileInput = document.querySelector(selector);
        if (fileInput) break;
      }
    }
  }
  
  if (!fileInput) {
    console.warn('📷 Could not find photo upload input');
    return { uploaded: 0, error: 'No file input found' };
  }
  
  // Download images and create File objects
  try {
    const files = await Promise.all(imageUrls.slice(0, 10).map(async (url, index) => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const filename = `vehicle_photo_${index + 1}.jpg`;
        return new File([blob], filename, { type: blob.type || 'image/jpeg' });
      } catch (e) {
        console.warn(`Failed to fetch image ${index}:`, e);
        return null;
      }
    }));
    
    const validFiles = files.filter(f => f !== null);
    
    if (validFiles.length === 0) {
      console.warn('📷 No images could be downloaded');
      return { uploaded: 0, error: 'Failed to download images' };
    }
    
    // Create a DataTransfer to simulate file selection
    const dataTransfer = new DataTransfer();
    validFiles.forEach(file => dataTransfer.items.add(file));
    fileInput.files = dataTransfer.files;
    
    // Dispatch change event
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    
    console.log(`✅ Uploaded ${validFiles.length} photos`);
    return { uploaded: validFiles.length };
  } catch (error) {
    console.error('📷 Photo upload error:', error);
    return { uploaded: 0, error: error.message };
  }
}

/**
 * Click the publish/post button
 */
async function clickPublishButton() {
  console.log('🚀 Looking for publish button...');
  logNavigationEvent('click_publish', {});
  
  // Wait a moment for any pending operations
  await sleep(1000);
  
  // Common publish button selectors
  const publishSelectors = [
    '[aria-label*="Publish" i]',
    '[aria-label*="Post" i]',
    '[aria-label*="Submit" i]',
    'div[role="button"]:has-text("Publish")',
    'div[role="button"]:has-text("Post")',
    'div[role="button"]:has-text("Submit")',
    'button[type="submit"]',
  ];
  
  // First try direct selector matches
  for (const selector of publishSelectors) {
    try {
      const btn = document.querySelector(selector);
      if (btn && btn.offsetParent !== null) {
        console.log('🚀 Found publish button via selector:', selector);
        await smartClick(btn);
        await sleep(2000);
        return { clicked: true, method: 'selector' };
      }
    } catch (e) {
      // Selector might be invalid, continue
    }
  }
  
  // Search by text content
  const publishTexts = ['Publish', 'Post', 'Submit', 'Next', 'List'];
  const buttons = await findClickableElements(publishTexts);
  
  if (buttons.length > 0) {
    // Prefer buttons with "Publish" or "Post" text
    const priorityBtn = buttons.find(btn => 
      /publish|post/i.test(btn.textContent)
    ) || buttons[0];
    
    console.log('🚀 Found publish button via text search:', priorityBtn.textContent?.trim());
    await smartClick(priorityBtn);
    await sleep(2000);
    return { clicked: true, method: 'text-search' };
  }
  
  console.warn('🚀 Could not find publish button');
  return { clicked: false, error: 'Publish button not found' };
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
// AI ASSISTANT WIDGET
// ============================================

let aiAssistantVisible = false;
let aiAssistantContainer = null;

function createAIAssistantWidget() {
  if (aiAssistantContainer) return;
  
  aiAssistantContainer = document.createElement('div');
  aiAssistantContainer.id = 'df-ai-assistant';
  aiAssistantContainer.innerHTML = `
    <style>
      #df-ai-widget {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      #df-ai-toggle {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, #6366F1 0%, #3B82F6 100%);
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      #df-ai-toggle:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 25px rgba(99, 102, 241, 0.5);
      }
      #df-ai-toggle svg { width: 28px; height: 28px; color: white; }
      #df-ai-badge {
        position: absolute;
        top: -5px;
        right: -5px;
        background: #EF4444;
        color: white;
        font-size: 10px;
        font-weight: bold;
        min-width: 18px;
        height: 18px;
        border-radius: 9px;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 0 5px;
      }
      #df-ai-panel {
        position: absolute;
        bottom: 65px;
        right: 0;
        width: 350px;
        max-height: 500px;
        background: white;
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        display: none;
        flex-direction: column;
        overflow: hidden;
      }
      #df-ai-panel.visible { display: flex; }
      #df-ai-header {
        padding: 16px;
        background: linear-gradient(135deg, #6366F1 0%, #3B82F6 100%);
        color: white;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      #df-ai-header-icon {
        width: 40px;
        height: 40px;
        background: rgba(255,255,255,0.2);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #df-ai-header h3 { margin: 0; font-size: 16px; font-weight: 600; }
      #df-ai-header p { margin: 4px 0 0; font-size: 12px; opacity: 0.9; }
      #df-ai-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        max-height: 300px;
      }
      .df-ai-msg {
        margin-bottom: 12px;
        padding: 10px 14px;
        border-radius: 12px;
        font-size: 14px;
        line-height: 1.4;
      }
      .df-ai-msg.assistant {
        background: #F3F4F6;
        border-bottom-left-radius: 4px;
      }
      .df-ai-msg.user {
        background: #3B82F6;
        color: white;
        margin-left: 40px;
        border-bottom-right-radius: 4px;
      }
      .df-ai-msg.error {
        background: #FEE2E2;
        color: #991B1B;
        border-left: 3px solid #EF4444;
      }
      .df-ai-msg.success {
        background: #D1FAE5;
        color: #065F46;
        border-left: 3px solid #10B981;
      }
      #df-ai-input-area {
        padding: 12px;
        border-top: 1px solid #E5E7EB;
        display: flex;
        gap: 8px;
      }
      #df-ai-input {
        flex: 1;
        padding: 10px 14px;
        border: 1px solid #D1D5DB;
        border-radius: 20px;
        font-size: 14px;
        outline: none;
      }
      #df-ai-input:focus { border-color: #6366F1; }
      #df-ai-send {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #6366F1;
        border: none;
        cursor: pointer;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #df-ai-send:hover { background: #4F46E5; }
      .df-quick-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 0 16px 12px;
      }
      .df-quick-btn {
        padding: 6px 12px;
        border: 1px solid #D1D5DB;
        border-radius: 16px;
        background: white;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .df-quick-btn:hover {
        background: #F3F4F6;
        border-color: #6366F1;
        color: #6366F1;
      }
    </style>
    <div id="df-ai-widget">
      <button id="df-ai-toggle" title="Dealers Face AI Assistant">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span id="df-ai-badge">!</span>
      </button>
      <div id="df-ai-panel">
        <div id="df-ai-header">
          <div id="df-ai-header-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div>
            <h3>Nexus - AI Assistant</h3>
            <p>Here to help with Facebook Marketplace</p>
          </div>
        </div>
        <div id="df-ai-messages">
          <div class="df-ai-msg assistant">
            👋 Hi! I'm Nexus, your AI assistant for Facebook Marketplace. I can help you with:
            <ul style="margin: 8px 0 0; padding-left: 20px;">
              <li>Posting vehicle listings</li>
              <li>Fixing form errors</li>
              <li>Understanding Facebook's requirements</li>
              <li>Troubleshooting issues</li>
            </ul>
          </div>
        </div>
        <div class="df-quick-actions">
          <button class="df-quick-btn" onclick="dfAIQuickAction('help')">🆘 Help</button>
          <button class="df-quick-btn" onclick="dfAIQuickAction('status')">📊 Status</button>
          <button class="df-quick-btn" onclick="dfAIQuickAction('retry')">🔄 Retry</button>
          <button class="df-quick-btn" onclick="dfAIQuickAction('fill')">📝 Auto-Fill</button>
        </div>
        <div id="df-ai-input-area">
          <input id="df-ai-input" type="text" placeholder="Ask me anything..." onkeypress="if(event.key==='Enter') dfAISend()">
          <button id="df-ai-send" onclick="dfAISend()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(aiAssistantContainer);
  
  // Toggle panel
  document.getElementById('df-ai-toggle').addEventListener('click', () => {
    const panel = document.getElementById('df-ai-panel');
    panel.classList.toggle('visible');
    aiAssistantVisible = panel.classList.contains('visible');
  });
}

// Global functions for the widget
window.dfAISend = async function() {
  const input = document.getElementById('df-ai-input');
  const message = input.value.trim();
  if (!message) return;
  
  addAIMessage(message, 'user');
  input.value = '';
  
  // Get AI response from server
  try {
    const response = await fetchAIResponse(message);
    addAIMessage(response, 'assistant');
  } catch (error) {
    addAIMessage(`Sorry, I encountered an error: ${error.message}`, 'error');
  }
};

window.dfAIQuickAction = async function(action) {
  switch (action) {
    case 'help':
      addAIMessage('I need help with this page', 'user');
      const pageState = await analyzePageState();
      const helpText = generateHelpForPage(pageState);
      addAIMessage(helpText, 'assistant');
      break;
    case 'status':
      addAIMessage('Show current status', 'user');
      const status = getTaskStatus();
      addAIMessage(status, 'assistant');
      break;
    case 'retry':
      addAIMessage('Retry the last action', 'user');
      addAIMessage('🔄 Retrying last action...', 'assistant');
      // Retry logic
      break;
    case 'fill':
      addAIMessage('Auto-fill the form', 'user');
      if (pendingTasks.length > 0) {
        await executeIAITask(pendingTasks[0]);
        addAIMessage('✅ Form auto-fill started!', 'success');
      } else {
        addAIMessage('No pending tasks to fill. Queue a vehicle from the app first.', 'assistant');
      }
      break;
  }
};

function addAIMessage(text, type = 'assistant') {
  const container = document.getElementById('df-ai-messages');
  if (!container) return;
  
  const msg = document.createElement('div');
  msg.className = `df-ai-msg ${type}`;
  msg.innerHTML = text;
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

async function fetchAIResponse(message) {
  // Get credentials
  const { authToken, accountId } = await chrome.storage.local.get(['authToken', 'accountId']);
  
  if (!authToken) {
    return 'Please log in to the Dealers Face extension first to use AI assistance.';
  }
  
  const response = await fetch('https://dealersface.com/api/extension/ai-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      message,
      context: {
        url: window.location.href,
        pageType: window.location.href.includes('/marketplace') ? 'marketplace' : 'facebook',
        accountId,
      },
    }),
  });
  
  if (!response.ok) throw new Error('AI service unavailable');
  
  const data = await response.json();
  return data.response || 'I couldn\'t process that request.';
}

function generateHelpForPage(pageState) {
  if (pageState.isCreateListingPage) {
    if (pageState.errors.length > 0) {
      return `⚠️ I see some issues on this form:\n\n${pageState.errors.map(e => `• ${e}`).join('\n')}\n\nWould you like me to help fix these?`;
    }
    return `You're on the vehicle listing page. I can see ${pageState.formElements.length} form fields.\n\nClick "Auto-Fill" to populate the form with your queued vehicle, or ask me specific questions!`;
  }
  
  if (pageState.isMarketplace) {
    return 'You\'re browsing Marketplace. Navigate to "Sell" or "Create New Listing" to post a vehicle.';
  }
  
  return 'I\'m here to help with Facebook Marketplace. What would you like to do?';
}

function getTaskStatus() {
  if (pendingTasks.length === 0) {
    return '📭 No pending tasks. Queue a vehicle from the Dealers Face app to get started.';
  }
  return `📋 ${pendingTasks.length} task(s) pending:\n\n${pendingTasks.map((t, i) => `${i+1}. ${t.type} - ${t.status}`).join('\n')}`;
}

// Show AI assistant when errors are detected
function showAIAssistantForError(errorDetails) {
  createAIAssistantWidget();
  
  // Show badge
  const badge = document.getElementById('df-ai-badge');
  if (badge) {
    badge.style.display = 'flex';
    badge.textContent = '!';
  }
  
  // Open panel and add error message
  const panel = document.getElementById('df-ai-panel');
  if (panel) {
    panel.classList.add('visible');
    addAIMessage(`🚨 I detected an issue: ${errorDetails}\n\nWould you like me to help fix this?`, 'error');
  }
}

// ============================================
// INITIALIZATION
// ============================================

// Create AI assistant widget on marketplace pages
if (window.location.href.includes('facebook.com/marketplace')) {
  setTimeout(createAIAssistantWidget, 2000);
}

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
