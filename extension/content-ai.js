/**
 * AI-Powered Content Script for Facebook Automation
 * 
 * This runs IN the Facebook page context and:
 * 1. Receives commands from background script
 * 2. Uses AI-powered element finding
 * 3. Executes human-like interactions
 * 4. Scrapes data and sends back to server
 */

// ============================================
// Configuration
// ============================================

const CONFIG = {
  API_URL: 'https://dealersface.com/api', // Production via Cloudflare
  // API_URL: 'http://localhost:5000/api', // Development
  POLL_INTERVAL: 5000, // Check for tasks every 5 seconds
  HUMAN_TYPING_MIN_DELAY: 50,
  HUMAN_TYPING_MAX_DELAY: 150,
  ACTION_DELAY_MIN: 500,
  ACTION_DELAY_MAX: 2000,
};

// ============================================
// State
// ============================================

let isProcessing = false;
let accountId = null;
let authToken = null;

// ============================================
// Utility Functions
// ============================================

/**
 * Random delay for human-like behavior
 */
function randomDelay(min, max) {
  return new Promise(resolve => 
    setTimeout(resolve, min + Math.random() * (max - min))
  );
}

/**
 * Human-like typing
 */
async function typeHumanlike(element, text) {
  element.focus();
  
  for (const char of text) {
    // Simulate keydown, keypress, input events
    const keydownEvent = new KeyboardEvent('keydown', { key: char, bubbles: true });
    const keypressEvent = new KeyboardEvent('keypress', { key: char, bubbles: true });
    const inputEvent = new InputEvent('input', { data: char, bubbles: true });
    
    element.dispatchEvent(keydownEvent);
    element.dispatchEvent(keypressEvent);
    
    // Update value
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      element.value += char;
    } else if (element.isContentEditable) {
      element.textContent += char;
    }
    
    element.dispatchEvent(inputEvent);
    
    // Random delay between keystrokes
    await randomDelay(CONFIG.HUMAN_TYPING_MIN_DELAY, CONFIG.HUMAN_TYPING_MAX_DELAY);
    
    // Occasional typo and correction (2% chance)
    if (Math.random() < 0.02) {
      const wrongChar = String.fromCharCode(char.charCodeAt(0) + 1);
      element.value = element.value.slice(0, -1) + wrongChar;
      await randomDelay(200, 400);
      element.value = element.value.slice(0, -1) + char;
    }
  }
  
  // Trigger change event
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Human-like click
 */
async function clickHumanlike(element) {
  // Scroll element into view
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await randomDelay(300, 600);
  
  // Get element position
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2 + (Math.random() - 0.5) * 10;
  const y = rect.top + rect.height / 2 + (Math.random() - 0.5) * 10;
  
  // Dispatch mouse events
  const mouseEvents = ['mouseenter', 'mouseover', 'mousemove', 'mousedown', 'mouseup', 'click'];
  
  for (const eventType of mouseEvents) {
    const event = new MouseEvent(eventType, {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    });
    element.dispatchEvent(event);
    await randomDelay(10, 30);
  }
}

/**
 * Find element using multiple strategies
 */
async function findElement(target, useAI = false) {
  // Strategy 1: Direct CSS selector
  let element = document.querySelector(target);
  if (element) return element;
  
  // Strategy 2: Common Facebook selectors
  const facebookSelectors = {
    'listing title input': '[aria-label*="Title"], [aria-label*="title"], input[name="title"], [placeholder*="title"]',
    'price input': '[aria-label*="Price"], [aria-label*="price"], input[name="price"], [placeholder*="price"]',
    'year dropdown': '[aria-label*="Year"], [aria-label*="year"], select[name="year"]',
    'make dropdown': '[aria-label*="Make"], [aria-label*="make"], select[name="make"]',
    'model dropdown': '[aria-label*="Model"], [aria-label*="model"], select[name="model"]',
    'mileage input': '[aria-label*="Mileage"], [aria-label*="mileage"], input[name="mileage"]',
    'description textarea': '[aria-label*="Description"], [aria-label*="description"], textarea[name="description"]',
    'photo upload input': 'input[type="file"][accept*="image"]',
    'publish button': '[aria-label*="Publish"], [aria-label*="Next"], button[type="submit"]',
    'send button': '[aria-label*="Send"], [aria-label*="send"]',
    'message input': '[aria-label*="Message"], [contenteditable="true"]',
    'conversation list': '[role="listbox"], [role="list"]',
  };
  
  if (facebookSelectors[target.toLowerCase()]) {
    const selectors = facebookSelectors[target.toLowerCase()].split(', ');
    for (const sel of selectors) {
      element = document.querySelector(sel);
      if (element && isVisible(element)) return element;
    }
  }
  
  // Strategy 3: Text content matching
  const textMatch = target.match(/button|link|text/i);
  if (textMatch) {
    const elements = document.querySelectorAll('button, a, [role="button"]');
    for (const el of elements) {
      if (el.textContent.toLowerCase().includes(target.toLowerCase())) {
        return el;
      }
    }
  }
  
  // Strategy 4: AI-powered finding (send to server)
  if (useAI) {
    return await findElementWithAI(target);
  }
  
  return null;
}

/**
 * Check if element is visible
 */
function isVisible(element) {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0' &&
         element.offsetParent !== null;
}

/**
 * Find element using AI (calls server)
 */
async function findElementWithAI(description) {
  try {
    const response = await fetch(`${CONFIG.API_URL}/extension/find-element`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        description,
        pageHtml: document.documentElement.outerHTML.slice(0, 50000),
        url: window.location.href,
      }),
    });
    
    const result = await response.json();
    
    if (result.selector) {
      const element = document.querySelector(result.selector);
      if (element) return element;
      
      // Try alternative selectors
      for (const altSelector of result.alternativeSelectors || []) {
        const altElement = document.querySelector(altSelector);
        if (altElement) return altElement;
      }
    }
  } catch (error) {
    console.error('AI element finding failed:', error);
  }
  
  return null;
}

// ============================================
// Task Execution
// ============================================

/**
 * Execute a navigation command
 */
async function executeCommand(command) {
  console.log('Executing command:', command);
  
  switch (command.action) {
    case 'navigate':
      window.location.href = command.target;
      await new Promise(resolve => {
        window.addEventListener('load', resolve, { once: true });
      });
      break;
      
    case 'wait':
      const maxWait = command.options?.delay || 10000;
      const startTime = Date.now();
      while (Date.now() - startTime < maxWait) {
        const element = await findElement(command.target, command.options?.useAI);
        if (element && isVisible(element)) return element;
        await randomDelay(500, 1000);
      }
      throw new Error(`Timeout waiting for: ${command.target}`);
      
    case 'click':
      const clickTarget = await findElement(command.target, command.options?.useAI);
      if (!clickTarget) throw new Error(`Element not found: ${command.target}`);
      await clickHumanlike(clickTarget);
      await randomDelay(CONFIG.ACTION_DELAY_MIN, CONFIG.ACTION_DELAY_MAX);
      break;
      
    case 'type':
      const typeTarget = await findElement(command.target, command.options?.useAI);
      if (!typeTarget) throw new Error(`Element not found: ${command.target}`);
      if (command.options?.humanlike) {
        await typeHumanlike(typeTarget, command.value);
      } else {
        typeTarget.value = command.value;
        typeTarget.dispatchEvent(new Event('input', { bubbles: true }));
        typeTarget.dispatchEvent(new Event('change', { bubbles: true }));
      }
      await randomDelay(CONFIG.ACTION_DELAY_MIN, CONFIG.ACTION_DELAY_MAX);
      break;
      
    case 'select':
      const selectTarget = await findElement(command.target, command.options?.useAI);
      if (!selectTarget) throw new Error(`Element not found: ${command.target}`);
      await clickHumanlike(selectTarget);
      await randomDelay(300, 600);
      // Find and click option
      const option = document.querySelector(`[data-value="${command.value}"], option[value="${command.value}"]`);
      if (option) {
        await clickHumanlike(option);
      } else {
        // Try typing to search
        await typeHumanlike(selectTarget, command.value);
        await randomDelay(500, 1000);
        const firstOption = document.querySelector('[role="option"], [role="listbox"] > div');
        if (firstOption) await clickHumanlike(firstOption);
      }
      break;
      
    case 'upload':
      const uploadInput = await findElement(command.target, command.options?.useAI);
      if (!uploadInput) throw new Error(`Upload input not found: ${command.target}`);
      // Files are passed as URLs, need to fetch and convert
      const imageUrls = JSON.parse(command.value);
      const files = await Promise.all(imageUrls.map(async (url, i) => {
        const response = await fetch(url);
        const blob = await response.blob();
        return new File([blob], `image_${i}.jpg`, { type: 'image/jpeg' });
      }));
      const dataTransfer = new DataTransfer();
      files.forEach(f => dataTransfer.items.add(f));
      uploadInput.files = dataTransfer.files;
      uploadInput.dispatchEvent(new Event('change', { bubbles: true }));
      break;
      
    case 'scrape':
      return await scrapeData(command.target);
      
    case 'screenshot':
      // Send current state back to server
      return {
        html: document.documentElement.outerHTML,
        url: window.location.href,
        title: document.title,
      };
      
    default:
      console.warn('Unknown command action:', command.action);
  }
  
  return null;
}

/**
 * Scrape data from page
 */
async function scrapeData(target) {
  switch (target) {
    case 'all conversations':
    case 'marketplace_inbox':
      return scrapeInbox();
    case 'conversation':
      return scrapeConversation();
    default:
      return null;
  }
}

/**
 * Scrape Marketplace inbox
 */
function scrapeInbox() {
  const conversations = [];
  const conversationElements = document.querySelectorAll('[role="row"], [data-testid*="conversation"], [class*="conversation"]');
  
  conversationElements.forEach((el, index) => {
    try {
      const nameEl = el.querySelector('[class*="name"], [class*="title"], strong, b');
      const previewEl = el.querySelector('[class*="preview"], [class*="snippet"], [class*="message"]');
      const timeEl = el.querySelector('[class*="time"], time, [datetime]');
      const unreadIndicator = el.querySelector('[class*="unread"], [class*="badge"]');
      
      conversations.push({
        id: el.getAttribute('data-id') || `conv_${index}`,
        name: nameEl?.textContent?.trim() || 'Unknown',
        preview: previewEl?.textContent?.trim() || '',
        time: timeEl?.textContent?.trim() || timeEl?.getAttribute('datetime') || '',
        isUnread: !!unreadIndicator,
        element: el,
      });
    } catch (e) {
      console.error('Error scraping conversation:', e);
    }
  });
  
  return { conversations };
}

/**
 * Scrape current conversation messages
 */
function scrapeConversation() {
  const messages = [];
  const messageElements = document.querySelectorAll('[class*="message"], [role="row"]');
  
  messageElements.forEach((el, index) => {
    try {
      const textEl = el.querySelector('[class*="text"], [class*="content"], p, span');
      const senderEl = el.querySelector('[class*="sender"], [class*="name"], strong');
      const timeEl = el.querySelector('[class*="time"], time');
      const isOutgoing = el.classList.contains('outgoing') || 
                         el.querySelector('[class*="outgoing"]') ||
                         el.getAttribute('data-is-outgoing') === 'true';
      
      if (textEl?.textContent?.trim()) {
        messages.push({
          id: `msg_${index}`,
          text: textEl.textContent.trim(),
          sender: senderEl?.textContent?.trim() || (isOutgoing ? 'Me' : 'Buyer'),
          time: timeEl?.textContent?.trim() || '',
          isOutgoing,
        });
      }
    } catch (e) {
      console.error('Error scraping message:', e);
    }
  });
  
  return { messages };
}

// ============================================
// Task Polling and Processing
// ============================================

/**
 * Poll server for pending tasks
 */
async function pollForTasks() {
  if (!accountId || !authToken || isProcessing) return;
  
  try {
    const response = await fetch(`${CONFIG.API_URL}/extension/tasks/${accountId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });
    
    if (!response.ok) return;
    
    const tasks = await response.json();
    
    for (const task of tasks) {
      await processTask(task);
    }
  } catch (error) {
    console.error('Error polling for tasks:', error);
  }
}

/**
 * Process a single task
 */
async function processTask(task) {
  isProcessing = true;
  
  try {
    console.log('Processing task:', task.id, task.type);
    
    // Update status to processing
    await updateTaskStatus(task.id, 'processing');
    
    let result = null;
    
    // Execute commands
    if (task.data?.commands) {
      for (const command of task.data.commands) {
        const commandResult = await executeCommand(command);
        if (commandResult) {
          result = { ...result, ...commandResult };
        }
        // Random delay between commands
        await randomDelay(1000, 3000);
      }
    }
    
    // Report success
    await updateTaskStatus(task.id, 'completed', result);
    
  } catch (error) {
    console.error('Task failed:', error);
    await updateTaskStatus(task.id, 'failed', { error: error.message });
  } finally {
    isProcessing = false;
  }
}

/**
 * Update task status on server
 */
async function updateTaskStatus(taskId, status, result = null) {
  try {
    await fetch(`${CONFIG.API_URL}/extension/tasks/${taskId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ status, result }),
    });
  } catch (error) {
    console.error('Failed to update task status:', error);
  }
}

// ============================================
// Message Handlers
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Content-AI received message:', message.type);
  
  // Handle async messages
  handleMessageAsync(message)
    .then(result => {
      console.log('✅ Message handled:', message.type, result);
      sendResponse(result);
    })
    .catch(error => {
      console.error('❌ Message handler error:', message.type, error);
      // Report error to background for AI/Nova analysis
      reportErrorToBackground(error, message.type);
      sendResponse({ success: false, error: error.message });
    });
  
  return true; // Keep channel open for async response
});

/**
 * Handle all message types asynchronously
 */
async function handleMessageAsync(message) {
  switch (message.type) {
    case 'INIT':
      accountId = message.accountId;
      authToken = message.authToken;
      console.log('Content script initialized for account:', accountId);
      return { success: true };
      
    case 'EXECUTE_COMMAND':
      const cmdResult = await executeCommand(message.command);
      return { success: true, result: cmdResult };
      
    case 'SCRAPE_INBOX':
      return { success: true, data: scrapeInbox() };
      
    case 'SCRAPE_CONVERSATION':
      return { success: true, data: scrapeConversation() };
      
    case 'GET_PAGE_STATE':
      return {
        success: true,
        data: getDetailedPageState()
      };
    
    // =============================================
    // IAI SIDEPANEL POSTING HANDLERS
    // =============================================
    
    case 'IAI_FILL_LISTING':
      console.log('🚗 IAI_FILL_LISTING: Filling vehicle form', message.vehicle);
      const fillResult = await fillMarketplaceVehicleForm(message.vehicle);
      // Report actual success based on critical fields
      if (!fillResult.success) {
        console.error('❌ IAI_FILL_LISTING failed:', fillResult.errors, fillResult.failedFields);
        reportErrorToBackground({
          type: 'IAI_FILL_LISTING_FAILED',
          message: `Form fill failed: ${fillResult.failedFields.join(', ')}`,
          details: fillResult
        });
      }
      return fillResult;
      
    case 'IAI_UPLOAD_IMAGES':
      console.log('📷 IAI_UPLOAD_IMAGES: Uploading', message.images?.length, 'images');
      const uploadResult = await uploadImagesFromUrls(message.images);
      return { success: uploadResult.uploaded > 0 || !message.images?.length, ...uploadResult };
      
    case 'IAI_PUBLISH_LISTING':
      console.log('🚀 IAI_PUBLISH_LISTING: Publishing listing');
      // Check if form is ready before publishing
      const formState = analyzeFormState();
      if (formState.requiredMissing && formState.requiredMissing.length > 0) {
        console.warn('⚠️ Cannot publish - required fields missing:', formState.requiredMissing);
        return { 
          success: false, 
          error: 'Required fields not filled',
          missingFields: formState.requiredMissing
        };
      }
      const publishResult = await clickPublishButton();
      return { success: publishResult.clicked, ...publishResult };
    
    case 'FILL_MARKETPLACE_FORM':
      console.log('📝 FILL_MARKETPLACE_FORM: Legacy handler');
      const legacyResult = await fillMarketplaceVehicleForm(message.vehicle);
      return { success: true, ...legacyResult };
    
    case 'CHECK_FACEBOOK_LOGIN':
      return { success: true, isLoggedIn: checkFacebookLogin() };
    
    case 'GET_FORM_STATUS':
      return { success: true, data: analyzeFormState() };
    
    default:
      console.warn('⚠️ Unhandled message type:', message.type);
      // Instead of failing, try to be helpful
      return { 
        success: false, 
        error: `Unhandled message type: ${message.type}`,
        availableTypes: [
          'INIT', 'EXECUTE_COMMAND', 'SCRAPE_INBOX', 'SCRAPE_CONVERSATION',
          'GET_PAGE_STATE', 'IAI_FILL_LISTING', 'IAI_UPLOAD_IMAGES', 
          'IAI_PUBLISH_LISTING', 'FILL_MARKETPLACE_FORM', 'CHECK_FACEBOOK_LOGIN'
        ]
      };
  }
}

/**
 * Report errors to background script for AI/Nova analysis
 */
async function reportErrorToBackground(error, messageType) {
  try {
    await chrome.runtime.sendMessage({
      type: 'CONTENT_SCRIPT_ERROR',
      error: {
        message: error.message || String(error),
        stack: error.stack,
        messageType,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        pageState: getDetailedPageState(),
        formState: analyzeFormState()
      }
    });
  } catch (e) {
    console.error('Failed to report error to background:', e);
  }
}

/**
 * Get detailed page state for diagnostics
 */
function getDetailedPageState() {
  const url = window.location.href;
  return {
    url,
    title: document.title,
    isMarketplace: url.includes('marketplace'),
    isCreateListing: url.includes('/marketplace/create'),
    isVehicleListing: url.includes('/create/vehicle'),
    isInbox: url.includes('inbox'),
    isLoggedIn: checkFacebookLogin(),
    bodyClasses: document.body.className,
    hasForm: !!document.querySelector('form'),
    formElements: document.querySelectorAll('input, select, textarea, [contenteditable]').length,
    visibleButtons: document.querySelectorAll('div[role="button"], button').length,
    timestamp: new Date().toISOString()
  };
}

/**
 * Check if user is logged into Facebook
 */
function checkFacebookLogin() {
  const indicators = [
    '[role="navigation"]',
    '[aria-label*="profile" i]',
    '[aria-label*="Account" i]',
    '[aria-label*="Messenger" i]',
    '[data-testid="royal_email"]'
  ];
  return indicators.some(sel => document.querySelector(sel));
}

/**
 * Analyze form state for debugging
 */
function analyzeFormState() {
  const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea, [contenteditable="true"]');
  const fields = [];
  
  inputs.forEach((el, idx) => {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      fields.push({
        index: idx,
        tag: el.tagName,
        type: el.type || el.getAttribute('role'),
        ariaLabel: el.getAttribute('aria-label'),
        placeholder: el.placeholder,
        name: el.name,
        value: el.value?.substring(0, 50),
        visible: rect.width > 0 && rect.height > 0
      });
    }
  });
  
  return { fields, count: fields.length };
}

// ============================================
// MARKETPLACE FORM FILLING (Production Version)
// Based on actual Facebook Marketplace DOM (Jan 2026)
// ============================================

/**
 * Fill Facebook Marketplace vehicle listing form
 * CRITICAL: Must follow Facebook's specific form flow
 */
async function fillMarketplaceVehicleForm(vehicle) {
  console.log('🚗 Starting form fill for:', vehicle.year, vehicle.make, vehicle.model);
  
  const filledFields = [];
  const failedFields = [];
  const errors = [];
  const steps = [];
  
  // Wait for form to be ready
  await waitForFormReady();
  await randomDelay(500, 800);
  
  // === STEP 1: VEHICLE TYPE (REQUIRED FIRST) ===
  // Facebook requires vehicle type selection before other fields appear
  console.log('📋 Step 1: Selecting vehicle type...');
  const vehicleType = getVehicleType(vehicle);
  if (await selectFacebookDropdown('Vehicle type', vehicleType)) {
    filledFields.push('vehicleType');
    steps.push({ field: 'vehicleType', success: true });
    await randomDelay(800, 1200); // Wait for form to update
  } else {
    failedFields.push('vehicleType');
    errors.push('Could not select vehicle type - form may not load correctly');
    steps.push({ field: 'vehicleType', success: false });
  }
  
  // === STEP 2: YEAR (Dropdown) ===
  console.log('📋 Step 2: Selecting year...');
  if (vehicle.year) {
    if (await selectFacebookDropdown('Year', String(vehicle.year))) {
      filledFields.push('year');
      steps.push({ field: 'year', success: true });
      await randomDelay(600, 1000);
    } else {
      failedFields.push('year');
      steps.push({ field: 'year', success: false });
    }
  }
  
  // === STEP 3: MAKE (Dropdown or Input) ===
  console.log('📋 Step 3: Entering make...');
  if (vehicle.make) {
    // Try dropdown first, then input
    if (await selectFacebookDropdown('Make', vehicle.make) || 
        await fillFacebookInput('Make', vehicle.make)) {
      filledFields.push('make');
      steps.push({ field: 'make', success: true });
      await randomDelay(600, 1000);
    } else {
      failedFields.push('make');
      steps.push({ field: 'make', success: false });
    }
  }
  
  // === STEP 4: MODEL (Dropdown or Input) ===
  console.log('📋 Step 4: Entering model...');
  if (vehicle.model) {
    if (await selectFacebookDropdown('Model', vehicle.model) ||
        await fillFacebookInput('Model', vehicle.model)) {
      filledFields.push('model');
      steps.push({ field: 'model', success: true });
      await randomDelay(600, 1000);
    } else {
      failedFields.push('model');
      steps.push({ field: 'model', success: false });
    }
  }
  
  // === STEP 5: TRIM (Optional) ===
  if (vehicle.trim) {
    console.log('📋 Step 5: Entering trim...');
    if (await fillFacebookInput('Trim', vehicle.trim)) {
      filledFields.push('trim');
      steps.push({ field: 'trim', success: true });
    }
    await randomDelay(300, 500);
  }
  
  // === STEP 6: PRICE ===
  console.log('📋 Step 6: Entering price...');
  const price = String(vehicle.price || '').replace(/[^0-9]/g, '');
  if (price) {
    if (await fillFacebookInput('Price', price)) {
      filledFields.push('price');
      steps.push({ field: 'price', success: true });
    } else {
      failedFields.push('price');
      errors.push('Could not fill price field');
      steps.push({ field: 'price', success: false });
    }
    await randomDelay(300, 500);
  }
  
  // === STEP 7: MILEAGE ===
  console.log('📋 Step 7: Entering mileage...');
  if (vehicle.mileage) {
    const mileage = String(vehicle.mileage).replace(/[^0-9]/g, '');
    if (await fillFacebookInput('Mileage', mileage) ||
        await fillFacebookInput('Vehicle mileage', mileage)) {
      filledFields.push('mileage');
      steps.push({ field: 'mileage', success: true });
    } else {
      failedFields.push('mileage');
      steps.push({ field: 'mileage', success: false });
    }
    await randomDelay(300, 500);
  }
  
  // === STEP 8: BODY STYLE (Optional) ===
  if (vehicle.bodyStyle || vehicle.bodyType) {
    console.log('📋 Step 8: Selecting body style...');
    const bodyStyle = vehicle.bodyStyle || vehicle.bodyType;
    if (await selectFacebookDropdown('Body style', bodyStyle)) {
      filledFields.push('bodyStyle');
      steps.push({ field: 'bodyStyle', success: true });
    }
    await randomDelay(300, 500);
  }
  
  // === STEP 9: EXTERIOR COLOR (Optional) ===
  if (vehicle.exteriorColor || vehicle.color) {
    console.log('📋 Step 9: Selecting exterior color...');
    const color = vehicle.exteriorColor || vehicle.color;
    if (await selectFacebookDropdown('Exterior color', color)) {
      filledFields.push('exteriorColor');
      steps.push({ field: 'exteriorColor', success: true });
    }
    await randomDelay(300, 500);
  }
  
  // === STEP 10: TRANSMISSION (Optional) ===
  if (vehicle.transmission) {
    console.log('📋 Step 10: Selecting transmission...');
    if (await selectFacebookDropdown('Transmission', vehicle.transmission)) {
      filledFields.push('transmission');
      steps.push({ field: 'transmission', success: true });
    }
    await randomDelay(300, 500);
  }
  
  // === STEP 11: FUEL TYPE (Optional) ===
  if (vehicle.fuelType) {
    console.log('📋 Step 11: Selecting fuel type...');
    if (await selectFacebookDropdown('Fuel type', vehicle.fuelType)) {
      filledFields.push('fuelType');
      steps.push({ field: 'fuelType', success: true });
    }
    await randomDelay(300, 500);
  }
  
  // === STEP 12: CONDITION (Optional) ===
  if (vehicle.condition) {
    console.log('📋 Step 12: Selecting condition...');
    if (await selectFacebookDropdown('Condition', vehicle.condition)) {
      filledFields.push('condition');
      steps.push({ field: 'condition', success: true });
    }
    await randomDelay(300, 500);
  }
  
  // === STEP 13: DESCRIPTION (Last) ===
  console.log('📋 Step 13: Entering description...');
  const description = vehicle.description || generateVehicleDescription(vehicle);
  if (await fillFacebookTextarea(description)) {
    filledFields.push('description');
    steps.push({ field: 'description', success: true });
  } else {
    failedFields.push('description');
    errors.push('Could not fill description field');
    steps.push({ field: 'description', success: false });
  }
  
  // === RESULT ANALYSIS ===
  const criticalFields = ['vehicleType', 'year', 'make', 'model', 'price'];
  const criticalFailed = failedFields.filter(f => criticalFields.includes(f));
  const isSuccess = criticalFailed.length === 0 && filledFields.length >= 3;
  
  console.log(`📝 Form fill complete: ${filledFields.length} filled, ${failedFields.length} failed`);
  console.log(`📝 Critical fields failed: ${criticalFailed.join(', ') || 'none'}`);
  
  // Report errors to background if critical failures
  if (criticalFailed.length > 0) {
    reportErrorToBackground({
      type: 'FORM_FILL_CRITICAL_FAILURE',
      message: `Critical fields failed: ${criticalFailed.join(', ')}`,
      details: { steps, filledFields, failedFields, errors }
    });
  }
  
  return {
    filledFields,
    failedFields,
    errors,
    steps,
    success: isSuccess
  };
}

/**
 * Determine vehicle type from vehicle data
 */
function getVehicleType(vehicle) {
  const bodyType = (vehicle.bodyType || vehicle.bodyStyle || '').toLowerCase();
  
  if (bodyType.includes('motorcycle') || bodyType.includes('bike')) {
    return 'Motorcycle';
  }
  if (bodyType.includes('rv') || bodyType.includes('camper') || bodyType.includes('motorhome')) {
    return 'RV/Camper';
  }
  if (bodyType.includes('trailer')) {
    return 'Trailer';
  }
  if (bodyType.includes('boat')) {
    return 'Boat';
  }
  if (bodyType.includes('commercial') || bodyType.includes('industrial')) {
    return 'Commercial/Industrial';
  }
  if (bodyType.includes('powersport') || bodyType.includes('atv') || bodyType.includes('utv')) {
    return 'Powersport';
  }
  
  // Default to Car/Truck for most vehicles
  return 'Car/Truck';
}

/**
 * Select a Facebook dropdown by finding the labeled element and clicking options
 */
async function selectFacebookDropdown(labelText, value) {
  console.log(`🔽 Selecting dropdown "${labelText}" = "${value}"`);
  
  try {
    // Strategy 1: Find label text and click the adjacent dropdown
    const dropdownButton = await findDropdownByLabel(labelText);
    
    if (!dropdownButton) {
      console.warn(`❌ Dropdown "${labelText}" not found`);
      return false;
    }
    
    // Scroll into view and click
    dropdownButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await randomDelay(300, 500);
    
    // Click to open dropdown
    await clickHumanlike(dropdownButton);
    await randomDelay(600, 1000);
    
    // Wait for dropdown options to appear
    const optionFound = await waitForAndSelectOption(value);
    
    if (optionFound) {
      console.log(`✅ Selected "${value}" for "${labelText}"`);
      return true;
    } else {
      // Close dropdown if option not found
      document.body.click();
      await randomDelay(200, 300);
      console.warn(`❌ Option "${value}" not found for "${labelText}"`);
      return false;
    }
  } catch (e) {
    console.error(`❌ Error selecting dropdown "${labelText}":`, e);
    return false;
  }
}

/**
 * Find dropdown button by its label text
 */
async function findDropdownByLabel(labelText) {
  const lowerLabel = labelText.toLowerCase();
  
  // Strategy 1: Find by aria-label
  const byAriaLabel = document.querySelector(`[aria-label*="${labelText}" i][role="combobox"], [aria-label*="${labelText}" i][aria-haspopup]`);
  if (byAriaLabel && isVisible(byAriaLabel)) return byAriaLabel;
  
  // Strategy 2: Find label span/div and get the clickable parent
  const allElements = document.querySelectorAll('span, div, label');
  for (const el of allElements) {
    if (el.textContent.trim().toLowerCase() === lowerLabel ||
        el.textContent.trim().toLowerCase().includes(lowerLabel)) {
      // Look for a clickable parent with dropdown indicators
      let parent = el.parentElement;
      for (let i = 0; i < 5 && parent; i++) {
        // Check if this parent has dropdown characteristics
        if (parent.querySelector('[data-visualcompletion="ignore-dynamic"]') ||
            parent.getAttribute('aria-haspopup') ||
            parent.getAttribute('aria-expanded') !== null ||
            parent.querySelector('svg') // Dropdown arrow icon
        ) {
          // Find the clickable element
          const clickable = parent.querySelector('[role="button"], [role="combobox"], [tabindex="0"]') || parent;
          if (isVisible(clickable)) {
            return clickable;
          }
        }
        parent = parent.parentElement;
      }
    }
  }
  
  // Strategy 3: Find all dropdown-like elements and match by nearby text
  const dropdowns = document.querySelectorAll('[aria-haspopup="listbox"], [aria-haspopup="menu"], [role="combobox"], [aria-expanded]');
  for (const dropdown of dropdowns) {
    const container = dropdown.closest('[data-visualcompletion="ignore-dynamic"]') || dropdown.parentElement?.parentElement;
    if (container && container.textContent.toLowerCase().includes(lowerLabel)) {
      if (isVisible(dropdown)) return dropdown;
    }
  }
  
  return null;
}

/**
 * Wait for dropdown options to appear and select the matching one
 */
async function waitForAndSelectOption(value) {
  const searchValue = String(value).toLowerCase().trim();
  
  // Wait up to 3 seconds for options to appear
  for (let attempt = 0; attempt < 15; attempt++) {
    await randomDelay(150, 250);
    
    // Look for options in various Facebook dropdown patterns
    const optionSelectors = [
      '[role="option"]',
      '[role="menuitem"]',
      '[role="listbox"] [role="option"]',
      '[data-visualcompletion="ignore-dynamic"] div[tabindex="-1"]',
      '[aria-hidden="false"] div[role="option"]'
    ];
    
    for (const selector of optionSelectors) {
      const options = document.querySelectorAll(selector);
      
      for (const option of options) {
        if (!isVisible(option)) continue;
        
        const optionText = option.textContent?.trim().toLowerCase();
        
        // Exact match or contains
        if (optionText === searchValue || 
            optionText?.includes(searchValue) ||
            searchValue.includes(optionText)) {
          // Found the option - click it
          await clickHumanlike(option);
          await randomDelay(300, 500);
          return true;
        }
      }
    }
    
    // Also check for plain divs that look like options
    const allDivs = document.querySelectorAll('div[tabindex="-1"], div[tabindex="0"], span[tabindex="-1"]');
    for (const div of allDivs) {
      if (!isVisible(div)) continue;
      
      const text = div.textContent?.trim().toLowerCase();
      if (text === searchValue || text?.includes(searchValue)) {
        // Check if this looks like an option (in a dropdown context)
        const parent = div.closest('[role="listbox"], [role="menu"], [aria-expanded="true"]');
        if (parent || div.closest('[data-visualcompletion="ignore-dynamic"]')) {
          await clickHumanlike(div);
          await randomDelay(300, 500);
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * Fill a Facebook input field by label
 */
async function fillFacebookInput(labelText, value) {
  console.log(`📝 Filling input "${labelText}" = "${value}"`);
  
  try {
    // Find input by aria-label or nearby label text
    let input = document.querySelector(`input[aria-label*="${labelText}" i]`);
    
    if (!input) {
      // Find by placeholder
      input = document.querySelector(`input[placeholder*="${labelText}" i]`);
    }
    
    if (!input) {
      // Find label and then input
      const labels = document.querySelectorAll('label, span, div');
      for (const label of labels) {
        if (label.textContent.toLowerCase().includes(labelText.toLowerCase())) {
          const container = label.closest('div[data-visualcompletion]') || label.parentElement;
          if (container) {
            input = container.querySelector('input:not([type="hidden"]):not([type="checkbox"])');
            if (input && isVisible(input)) break;
          }
        }
      }
    }
    
    if (!input || !isVisible(input)) {
      console.warn(`❌ Input "${labelText}" not found`);
      return false;
    }
    
    // Fill the input
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await randomDelay(200, 400);
    
    input.focus();
    await randomDelay(100, 200);
    
    // Clear existing value
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Type the value
    await typeHumanlike(input, value);
    
    input.blur();
    await randomDelay(100, 200);
    
    console.log(`✅ Filled input "${labelText}"`);
    return true;
  } catch (e) {
    console.error(`❌ Error filling input "${labelText}":`, e);
    return false;
  }
}

/**
 * Fill the description textarea
 */
async function fillFacebookTextarea(description) {
  console.log('📝 Filling description textarea...');
  
  try {
    // Find textarea or contenteditable
    let textarea = document.querySelector('textarea[aria-label*="Description" i]');
    
    if (!textarea) {
      textarea = document.querySelector('textarea');
    }
    
    if (!textarea) {
      // Try contenteditable
      textarea = document.querySelector('[contenteditable="true"][aria-label*="Description" i]');
    }
    
    if (!textarea) {
      // Find by placeholder or role
      textarea = document.querySelector('[role="textbox"][aria-multiline="true"]');
    }
    
    if (!textarea) {
      // Last resort - any visible textarea
      const textareas = document.querySelectorAll('textarea, [contenteditable="true"]');
      for (const ta of textareas) {
        if (isVisible(ta)) {
          textarea = ta;
          break;
        }
      }
    }
    
    if (!textarea) {
      console.warn('❌ Description textarea not found');
      return false;
    }
    
    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await randomDelay(300, 500);
    
    textarea.focus();
    await randomDelay(100, 200);
    
    // Handle contenteditable vs textarea
    if (textarea.isContentEditable) {
      textarea.innerHTML = '';
      textarea.textContent = description;
      textarea.dispatchEvent(new InputEvent('input', { bubbles: true, data: description }));
    } else {
      textarea.value = '';
      await typeHumanlike(textarea, description);
    }
    
    textarea.blur();
    await randomDelay(100, 200);
    
    console.log('✅ Filled description');
    return true;
  } catch (e) {
    console.error('❌ Error filling description:', e);
    return false;
  }
}

/**
 * Wait for form to be ready
 */
async function waitForFormReady() {
  let attempts = 0;
  while (attempts < 20) {
    const hasInputs = document.querySelector('input, [contenteditable], textarea');
    if (hasInputs) return true;
    await randomDelay(250, 500);
    attempts++;
  }
  return false;
}

/**
 * Fill an input field with human-like typing
 */
async function fillInputField(selectors, value) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && isVisible(element)) {
      try {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await randomDelay(200, 400);
        
        element.focus();
        await randomDelay(100, 200);
        
        // Clear existing value
        if (element.value) {
          element.value = '';
          element.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        // Type value
        await typeHumanlike(element, value);
        
        // Blur to trigger validation
        element.blur();
        await randomDelay(100, 200);
        
        console.log(`✅ Filled field: ${selector} with "${value.substring(0, 30)}..."`);
        return true;
      } catch (e) {
        console.warn(`Failed to fill ${selector}:`, e);
      }
    }
  }
  return false;
}

/**
 * Fill a textarea/contenteditable field
 */
async function fillTextareaField(selectors, value) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && isVisible(element)) {
      try {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await randomDelay(200, 400);
        
        element.focus();
        await randomDelay(100, 200);
        
        // For contenteditable divs
        if (element.isContentEditable) {
          element.innerHTML = '';
          // Set text directly for contenteditables
          element.textContent = value;
          element.dispatchEvent(new InputEvent('input', { bubbles: true, data: value }));
        } else {
          element.value = '';
          await typeHumanlike(element, value);
        }
        
        element.blur();
        await randomDelay(100, 200);
        
        console.log(`✅ Filled textarea: ${selector}`);
        return true;
      } catch (e) {
        console.warn(`Failed to fill textarea ${selector}:`, e);
      }
    }
  }
  return false;
}

/**
 * Select dropdown option
 */
async function selectDropdownOption(selectors, value) {
  for (const selector of selectors) {
    // Find the dropdown button
    const allElements = document.querySelectorAll(`${selector}, [aria-haspopup="listbox"]`);
    
    for (const element of allElements) {
      if (!isVisible(element)) continue;
      
      try {
        // Click to open dropdown
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await randomDelay(200, 400);
        await clickHumanlike(element);
        await randomDelay(500, 800);
        
        // Look for option in the dropdown
        const options = document.querySelectorAll('[role="option"], [role="menuitem"], [role="listbox"] div, [data-visualcompletion="ignore-dynamic"] div');
        
        for (const option of options) {
          const optionText = option.textContent?.trim().toLowerCase();
          const searchValue = String(value).toLowerCase();
          
          if (optionText === searchValue || optionText?.includes(searchValue)) {
            await clickHumanlike(option);
            await randomDelay(300, 500);
            console.log(`✅ Selected dropdown option: ${value}`);
            return true;
          }
        }
        
        // If not found, click elsewhere to close dropdown
        document.body.click();
        await randomDelay(200, 400);
        
      } catch (e) {
        console.warn(`Failed to select ${value} from ${selector}:`, e);
      }
    }
  }
  return false;
}

/**
 * Upload images from URLs
 */
async function uploadImagesFromUrls(imageUrls) {
  if (!imageUrls || imageUrls.length === 0) {
    console.log('📷 No images to upload');
    return { uploaded: 0 };
  }
  
  console.log('📷 Attempting to upload', imageUrls.length, 'images');
  
  // Find file input
  const fileInputSelectors = [
    'input[type="file"][accept*="image"]',
    'input[type="file"]'
  ];
  
  let fileInput = null;
  for (const selector of fileInputSelectors) {
    fileInput = document.querySelector(selector);
    if (fileInput) break;
  }
  
  if (!fileInput) {
    // Try clicking "Add photos" button first
    const addPhotoButtons = document.querySelectorAll('div[role="button"], span');
    for (const btn of addPhotoButtons) {
      if (/add photo|upload|photos/i.test(btn.textContent)) {
        await clickHumanlike(btn);
        await randomDelay(800, 1200);
        fileInput = document.querySelector('input[type="file"]');
        if (fileInput) break;
      }
    }
  }
  
  if (!fileInput) {
    console.warn('📷 Could not find file input');
    return { uploaded: 0, error: 'File input not found' };
  }
  
  try {
    // Download images and create File objects
    const files = await Promise.all(imageUrls.slice(0, 10).map(async (url, index) => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new File([blob], `vehicle_photo_${index + 1}.jpg`, { type: blob.type || 'image/jpeg' });
      } catch (e) {
        console.warn(`Failed to fetch image ${index}:`, e);
        return null;
      }
    }));
    
    const validFiles = files.filter(f => f !== null);
    
    if (validFiles.length === 0) {
      return { uploaded: 0, error: 'Failed to download images' };
    }
    
    // Create DataTransfer and set files
    const dataTransfer = new DataTransfer();
    validFiles.forEach(file => dataTransfer.items.add(file));
    fileInput.files = dataTransfer.files;
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
 * IMPORTANT: Only clicks actual Publish/Post button, NOT "Next"
 */
async function clickPublishButton() {
  console.log('🚀 Looking for publish button...');
  
  await randomDelay(500, 1000);
  
  // First, look for actual publish/post buttons (high priority)
  const publishButtonTexts = ['publish', 'post', 'list item', 'list vehicle', 'submit'];
  
  // Search all buttons
  const allButtons = document.querySelectorAll('div[role="button"], button, [aria-label], [tabindex="0"]');
  let bestButton = null;
  let bestPriority = 999;
  
  for (const el of allButtons) {
    if (!isVisible(el)) continue;
    
    const text = el.textContent?.trim().toLowerCase() || '';
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    
    // Check for publish/post buttons (priority 1)
    for (const publishText of publishButtonTexts) {
      if (text === publishText || ariaLabel.includes(publishText)) {
        if (bestPriority > 1) {
          bestButton = el;
          bestPriority = 1;
        }
        break;
      }
    }
    
    // "Next" button is only used as last resort (priority 3)
    if (text === 'next' && bestPriority > 3) {
      bestButton = el;
      bestPriority = 3;
    }
  }
  
  if (bestButton) {
    const buttonText = bestButton.textContent?.trim();
    
    // Warn if we're clicking Next instead of Publish
    if (buttonText?.toLowerCase() === 'next') {
      console.warn('⚠️ Only found "Next" button - form may need more steps');
      return { 
        clicked: false, 
        error: 'Only found Next button - form incomplete',
        suggestion: 'Fill all required fields first'
      };
    }
    
    console.log(`🚀 Found publish button: "${buttonText}" - clicking`);
    await clickHumanlike(bestButton);
    await randomDelay(2000, 3000);
    return { clicked: true, buttonText };
  }
  
  console.warn('🚀 Could not find publish button');
  return { clicked: false, error: 'Publish button not found' };
}

/**
 * Generate vehicle description
 */
function generateVehicleDescription(vehicle) {
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
  
  parts.push('');
  parts.push('✅ Financing Available');
  parts.push('✅ Trade-ins Welcome');
  parts.push('');
  parts.push('📞 Contact us for more information!');
  
  return parts.join('\n');
}

// ============================================
// Initialize
// ============================================

// Start polling when on Facebook
if (window.location.hostname.includes('facebook.com')) {
  // Get credentials from storage
  chrome.storage.local.get(['accountId', 'authToken'], (result) => {
    if (result.accountId && result.authToken) {
      accountId = result.accountId;
      authToken = result.authToken;
      
      // Start polling for tasks
      setInterval(pollForTasks, CONFIG.POLL_INTERVAL);
      
      console.log('DF-Auto Sim content script active');
    }
  });
}
