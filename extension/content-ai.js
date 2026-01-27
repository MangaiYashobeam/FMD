/**
 * AI-Powered Content Script for Facebook Automation
 * 
 * This runs IN the Facebook page context and:
 * 1. Receives commands from background script
 * 2. Uses AI-powered element finding
 * 3. Executes human-like interactions
 * 4. Scrapes data and sends back to server
 * 
 * ENHANCED v2.0 - Based on proven competitor patterns:
 * - C(tag, text) simple element finder
 * - Close open dropdowns before opening new ones
 * - Use aria-controls for reliable dropdown detection
 * - Full pointer event sequence for clicks
 * - Exact → case-insensitive → no-spaces matching
 * - Hardcoded fallback values for all dropdowns
 * - User-configurable delays
 */

// ============================================
// Configuration
// ============================================

const CONFIG = {
  API_URL: 'https://dealersface.com/api', // Production via Cloudflare
  // API_URL: 'http://localhost:5000/api', // Development
  POLL_INTERVAL: 5000,
  HUMAN_TYPING_MIN_DELAY: 50,
  HUMAN_TYPING_MAX_DELAY: 150,
  ACTION_DELAY_MIN: 500,
  ACTION_DELAY_MAX: 2000,
  
  // ENHANCED: Typing speeds (competitor-proven)
  TYPING: {
    FAST_MIN: 10,      // For short inputs
    FAST_MAX: 28,
    SLOW_MIN: 25,      // For normal typing
    SLOW_MAX: 55,
    PAUSE_MIN: 150,    // Occasional pauses
    PAUSE_MAX: 400,
  },
  
  // ENHANCED: Dropdown timing (competitor-proven)
  DROPDOWN: {
    CLOSE_DELAY_MIN: 100,
    CLOSE_DELAY_MAX: 200,
    OPEN_DELAY_MIN: 400,
    OPEN_DELAY_MAX: 700,
    AFTER_SELECT_MIN: 300,
    AFTER_SELECT_MAX: 600,
    MAX_ATTEMPTS: 15,
  },
  
  // ENHANCED: Fallback values (like competitor)
  FALLBACKS: {
    MAKE: 'Toyota',
    COLOR: 'Black',
    EXTERIOR_COLOR: 'Black',
    INTERIOR_COLOR: 'Black',
    BODY_STYLE: 'Other',
    FUEL_TYPE: 'Gasoline',
    TRANSMISSION: 'Automatic',
    CONDITION: 'Excellent',
    VEHICLE_TYPE: 'Car/Truck',
    YEAR: String(new Date().getFullYear()),
  },
};

// ============================================
// CORE HELPER FUNCTIONS (Competitor-Proven)
// ============================================

/**
 * C(tagName, exactText) - The competitor's simple element finder
 * Finds element by tag name with exact innerText match
 * PROVEN to work reliably on Facebook
 */
function C(tagName, text) {
  try {
    const elements = Array.from(document.querySelectorAll(tagName));
    return elements.find(el => el instanceof HTMLElement && el.innerText?.trim() === text) || null;
  } catch (e) {
    console.error('[Content-AI] Error in C():', e);
    return null;
  }
}

/**
 * Close any open dropdowns before opening a new one
 * CRITICAL: Facebook only allows one dropdown open at a time
 */
async function closeOpenDropdowns(delay = 200) {
  try {
    const openDropdowns = document.querySelectorAll('[aria-expanded="true"][role="combobox"], [aria-expanded="true"][role="listbox"]');
    if (openDropdowns.length > 0) {
      console.log(`[Content-AI] Closing ${openDropdowns.length} open dropdown(s)...`);
      document.body.click();
      await new Promise(r => setTimeout(r, delay));
    }
  } catch (e) {
    console.debug('[Content-AI] Error closing dropdowns:', e);
  }
}

/**
 * Wait for user-configurable delay
 */
async function waitUserDelay() {
  try {
    const result = await chrome.storage?.local?.get('customInputDelaySeconds');
    const delay = Number(result?.customInputDelaySeconds);
    if (Number.isFinite(delay) && delay > 0) {
      const ms = Math.min(Math.max(delay, 0), 10) * 1000;
      await new Promise(r => setTimeout(r, ms));
    }
  } catch (e) {
    // Ignore
  }
}

/**
 * Match option text with cascading strategies (like competitor)
 */
function matchOptionText(optionText, searchValue) {
  if (!optionText || !searchValue) return false;
  
  const opt = optionText.trim();
  const search = searchValue.trim();
  
  if (opt === search) return true;
  if (opt.toLowerCase() === search.toLowerCase()) return true;
  if (opt.toLowerCase().replace(/\s+/g, '') === search.toLowerCase().replace(/\s+/g, '')) return true;
  
  return false;
}

/**
 * Clean string utility (like competitor)
 */
function cleanString(str) {
  try {
    if (typeof str !== 'string') return str?.toString() || '';
    return str.replace(/\\|"|\\r/g, '');
  } catch (e) {
    return '';
  }
}

/**
 * Process Make name with special cases (like competitor)
 */
function processMakeName(make) {
  if (!make) return 'Toyota';
  
  try {
    const preserveCase = ['SRT', 'MINI', 'CODA', 'BMW', 'GMC', 'Land Rover', 'KTM', 'MV Agusta', 'CFMoto'];
    if (preserveCase.includes(make)) return make;
    
    return make.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  } catch (e) {
    return make || 'Toyota';
  }
}

/**
 * Get fallback value for a field
 */
function getFallbackValue(labelText) {
  const lower = labelText.toLowerCase();
  if (lower.includes('make')) return CONFIG.FALLBACKS.MAKE;
  if (lower.includes('exterior')) return CONFIG.FALLBACKS.EXTERIOR_COLOR;
  if (lower.includes('interior')) return CONFIG.FALLBACKS.INTERIOR_COLOR;
  if (lower.includes('body')) return CONFIG.FALLBACKS.BODY_STYLE;
  if (lower.includes('fuel')) return CONFIG.FALLBACKS.FUEL_TYPE;
  if (lower.includes('condition')) return CONFIG.FALLBACKS.CONDITION;
  if (lower.includes('vehicle type')) return CONFIG.FALLBACKS.VEHICLE_TYPE;
  if (lower.includes('year')) return CONFIG.FALLBACKS.YEAR;
  return null;
}

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
 * Type text human-like - ENHANCED with variable speeds (like competitor)
 */
async function typeHumanlike(element, text) {
  if (!text || !element) return;
  
  element.focus();
  await randomDelay(100, 250);
  
  // Clear existing content (like competitor)
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    element.value = '';
  } else if (element.isContentEditable) {
    element.textContent = '';
  }
  
  // Dispatch initial events
  element.dispatchEvent(new Event('focus', { bubbles: true }));
  
  const textStr = String(text);
  for (let i = 0; i < textStr.length; i++) {
    const char = textStr[i];
    
    // Type the character
    element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
    
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      element.value += char;
    } else if (element.isContentEditable) {
      element.textContent += char;
    }
    
    element.dispatchEvent(new InputEvent('input', { 
      bubbles: true, 
      inputType: 'insertText', 
      data: char 
    }));
    
    element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
    
    // Variable typing speed - occasionally pause (like competitor)
    if (Math.random() < 0.08) {
      await randomDelay(CONFIG.TYPING.PAUSE_MIN, CONFIG.TYPING.PAUSE_MAX);
    } else if (Math.random() < 0.25) {
      await randomDelay(CONFIG.TYPING.SLOW_MIN, CONFIG.TYPING.SLOW_MAX);
    } else {
      await randomDelay(CONFIG.TYPING.FAST_MIN, CONFIG.TYPING.FAST_MAX);
    }
  }
  
  // Final events
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
  await randomDelay(150, 400);
}

/**
 * Fast type for dropdown search (like competitor)
 */
async function typeFast(element, text) {
  if (!text || !element) return;
  
  element.focus();
  await randomDelay(50, 100);
  
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    element.value = '';
  } else if (element.isContentEditable) {
    element.textContent = '';
  }
  
  const textStr = String(text);
  for (let i = 0; i < textStr.length; i++) {
    const char = textStr[i];
    
    element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
    
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      element.value += char;
    } else if (element.isContentEditable) {
      element.textContent += char;
    }
    
    element.dispatchEvent(new InputEvent('input', { 
      bubbles: true, 
      inputType: 'insertText', 
      data: char 
    }));
    
    element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
    
    await randomDelay(10, 30);
  }
  
  element.dispatchEvent(new Event('change', { bubbles: true }));
  await randomDelay(100, 200);
}

/**
 * Type description with realistic pauses
 */
async function typeDescription(element, text) {
  if (!text || !element) return;
  
  element.focus();
  await randomDelay(200, 400);
  
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    element.value = '';
  } else if (element.isContentEditable) {
    element.textContent = '';
  }
  
  const textStr = String(text);
  for (let i = 0; i < textStr.length; i++) {
    const char = textStr[i];
    
    element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
    
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      element.value += char;
    } else if (element.isContentEditable) {
      element.textContent += char;
    }
    
    element.dispatchEvent(new InputEvent('input', { 
      bubbles: true, 
      inputType: 'insertText', 
      data: char 
    }));
    
    element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
    
    // Natural pauses at punctuation (like competitor)
    if ('.!?\n'.includes(char)) {
      await randomDelay(300, 700);
    } else if (',;:'.includes(char)) {
      await randomDelay(100, 250);
    } else if (char === ' ') {
      await randomDelay(30, 80);
    } else {
      await randomDelay(15, 50);
    }
  }
  
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
  await randomDelay(200, 500);
}

/**
 * Human-like click - ENHANCED with full pointer event sequence (like competitor)
 */
async function clickHumanlike(element) {
  // Perform human noise before clicking
  await performHumanNoise(element);
  
  // Scroll element into view
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await randomDelay(200, 400);
  
  // Get element position with random offset (like competitor)
  const rect = element.getBoundingClientRect();
  const x = Math.floor(rect.left + Math.max(1, rect.width * Math.random()));
  const y = Math.floor(rect.top + Math.max(1, rect.height * Math.random()));
  
  // Create event dispatcher
  const dispatchEvent = (type) => {
    const event = new MouseEvent(type, {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      buttons: 1,
    });
    element.dispatchEvent(event);
  };
  
  // FULL event sequence (like competitor)
  dispatchEvent('pointerover');
  await randomDelay(10, 40);
  
  dispatchEvent('mouseover');
  await randomDelay(10, 40);
  
  dispatchEvent('pointerdown');
  dispatchEvent('mousedown');
  await randomDelay(40, 120);
  
  // Focus if needed
  if (element.focus) element.focus();
  await randomDelay(30, 90);
  
  dispatchEvent('pointerup');
  dispatchEvent('mouseup');
  await randomDelay(20, 80);
  
  dispatchEvent('click');
  
  // Human delay after click
  await randomDelay(150, 600);
  
  // Occasional long pause (8% like competitor)
  if (Math.random() < 0.08) {
    await randomDelay(1000, 2000);
  }
}

/**
 * Perform human noise before action (like competitor)
 */
async function performHumanNoise(element) {
  try {
    // Random small scroll
    const scrollX = Math.floor(Math.random() * 10) - 5;
    const scrollY = Math.floor(Math.random() * 60) - 30;
    window.scrollBy({ left: scrollX, top: scrollY, behavior: 'auto' });
    
    // Random mouse movements
    const mouseX = Math.floor(window.innerWidth / 2 + (Math.random() - 0.5) * 240);
    const mouseY = Math.floor(window.innerHeight / 2 + (Math.random() - 0.5) * 240);
    
    const moves = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < moves; i++) {
      const moveEvent = new MouseEvent('mousemove', {
        bubbles: true,
        clientX: mouseX + Math.floor(Math.random() * 16) - 8,
        clientY: mouseY + Math.floor(Math.random() * 16) - 8,
      });
      (element || document.body).dispatchEvent(moveEvent);
      await randomDelay(20, 60);
    }
  } catch (e) {
    // Ignore noise errors
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
  
  // IAI_FILL_LISTING is handled EXCLUSIVELY by iai-soldier.js
  // Return false immediately to let other listeners handle it
  if (message.type === 'IAI_FILL_LISTING') {
    console.log('🚗 IAI_FILL_LISTING - DEFERRING to iai-soldier.js (not responding)');
    return false; // Do not handle this message - let iai-soldier.js respond
  }
  
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
    // NOTE: IAI_FILL_LISTING is handled EXCLUSIVELY by iai-soldier.js
    // It is filtered out in the message listener above (returns false)
    // and never reaches this switch statement
      
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
  const vehicleType = getVehicleType(vehicle) || CONFIG.FALLBACKS.VEHICLE_TYPE;
  if (await selectFacebookDropdown('Vehicle type', vehicleType, 'vehicle_type')) {
    filledFields.push('vehicleType');
    steps.push({ field: 'vehicleType', success: true });
    await randomDelay(800, 1200); // Wait for form to update
  } else {
    failedFields.push('vehicleType');
    errors.push('Could not select vehicle type - form may not load correctly');
    steps.push({ field: 'vehicleType', success: false });
  }
  
  // === STEP 2: YEAR (Dropdown with fallback) ===
  console.log('📋 Step 2: Selecting year...');
  const year = vehicle.year || new Date().getFullYear();
  if (await selectFacebookDropdown('Year', String(year), 'year')) {
    filledFields.push('year');
    steps.push({ field: 'year', success: true });
    await randomDelay(600, 1000);
  } else {
    failedFields.push('year');
    steps.push({ field: 'year', success: false });
  }
  
  // === STEP 3: MAKE (Dropdown with fallback) ===
  console.log('📋 Step 3: Entering make...');
  const make = processMakeName(vehicle.make) || CONFIG.FALLBACKS.MAKE;
  if (await selectFacebookDropdown('Make', make, 'make') || 
      await fillFacebookInput('Make', make)) {
    filledFields.push('make');
    steps.push({ field: 'make', success: true });
    await randomDelay(600, 1000);
  } else {
    failedFields.push('make');
    steps.push({ field: 'make', success: false });
  }
  
  // === STEP 4: MODEL (Dropdown or Input) ===
  console.log('📋 Step 4: Entering model...');
  const model = vehicle.model || 'Other';
  if (await selectFacebookDropdown('Model', model, 'model') ||
      await fillFacebookInput('Model', model)) {
    filledFields.push('model');
    steps.push({ field: 'model', success: true });
    await randomDelay(600, 1000);
  } else {
    failedFields.push('model');
    steps.push({ field: 'model', success: false });
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
  // === STEP 8: BODY STYLE (with fallback) ===
  console.log('📋 Step 8: Selecting body style...');
  const bodyStyle = vehicle.bodyStyle || vehicle.bodyType || CONFIG.FALLBACKS.BODY_STYLE;
  if (await selectFacebookDropdown('Body style', bodyStyle, 'body_style')) {
    filledFields.push('bodyStyle');
    steps.push({ field: 'bodyStyle', success: true });
  }
  await randomDelay(300, 500);
  
  // === STEP 9: EXTERIOR COLOR (with fallback) ===
  console.log('📋 Step 9: Selecting exterior color...');
  const color = vehicle.exteriorColor || vehicle.color || CONFIG.FALLBACKS.COLOR;
  if (await selectFacebookDropdown('Exterior color', color, 'exterior_color')) {
    filledFields.push('exteriorColor');
    steps.push({ field: 'exteriorColor', success: true });
  }
  await randomDelay(300, 500);
  
  // === STEP 10: TRANSMISSION (with fallback) ===
  console.log('📋 Step 10: Selecting transmission...');
  const transmission = vehicle.transmission || CONFIG.FALLBACKS.TRANSMISSION;
  if (await selectFacebookDropdown('Transmission', transmission, 'transmission')) {
    filledFields.push('transmission');
    steps.push({ field: 'transmission', success: true });
  }
  await randomDelay(300, 500);
  
  // === STEP 11: FUEL TYPE (with fallback) ===
  console.log('📋 Step 11: Selecting fuel type...');
  const fuelType = vehicle.fuelType || CONFIG.FALLBACKS.FUEL_TYPE;
  if (await selectFacebookDropdown('Fuel type', fuelType, 'fuel_type')) {
    filledFields.push('fuelType');
    steps.push({ field: 'fuelType', success: true });
  }
  await randomDelay(300, 500);
  
  // === STEP 12: CONDITION (with fallback) ===
  console.log('📋 Step 12: Selecting condition...');
  const condition = vehicle.condition || CONFIG.FALLBACKS.CONDITION;
  if (await selectFacebookDropdown('Condition', condition, 'condition')) {
    filledFields.push('condition');
    steps.push({ field: 'condition', success: true });
  }
  await randomDelay(300, 500);
  
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
 * ENHANCED Select a Facebook dropdown (competitor-proven patterns)
 * Uses: closeOpenDropdowns, aria-controls, cascading match, fallbacks
 */
async function selectFacebookDropdown(labelText, value, fieldType = null) {
  console.log(`🔽 Selecting dropdown "${labelText}" = "${value}"`);
  
  try {
    // CRITICAL: Close any open dropdowns first (like competitor)
    await closeOpenDropdowns();
    await randomDelay(CONFIG.DROPDOWN.CLOSE_DELAY_MIN, CONFIG.DROPDOWN.CLOSE_DELAY_MAX);
    
    // Find the dropdown using multiple strategies
    const dropdownButton = await findDropdownByLabelEnhanced(labelText);
    
    if (!dropdownButton) {
      console.warn(`❌ Dropdown "${labelText}" not found`);
      return false;
    }
    
    // Scroll into view
    dropdownButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await randomDelay(200, 400);
    
    // Click to open dropdown with full pointer events
    await clickHumanlike(dropdownButton);
    await randomDelay(CONFIG.DROPDOWN.OPEN_DELAY_MIN, CONFIG.DROPDOWN.OPEN_DELAY_MAX);
    
    // Wait for user delay if configured
    await waitUserDelay();
    
    // Try to find panel using aria-controls (like competitor)
    const panelId = dropdownButton.getAttribute('aria-controls');
    let panel = null;
    if (panelId) {
      panel = document.getElementById(panelId);
      console.log(`📋 Found panel via aria-controls: ${panelId}`);
    }
    
    // If no panel found, look for visible listbox/menu
    if (!panel) {
      panel = document.querySelector('[role="listbox"]:not([aria-hidden="true"]), [role="menu"]:not([aria-hidden="true"])');
    }
    
    // Try to select the option with cascading match
    const optionFound = await selectOptionWithCascadingMatch(panel, value, fieldType);
    
    if (optionFound) {
      console.log(`✅ Selected "${value}" for "${labelText}"`);
      await randomDelay(CONFIG.DROPDOWN.AFTER_SELECT_MIN, CONFIG.DROPDOWN.AFTER_SELECT_MAX);
      return true;
    } else {
      // Try fallback value if available
      const fallback = getFallbackValue(fieldType || labelText.toLowerCase());
      if (fallback && fallback !== value) {
        console.log(`⚠️ Trying fallback value: "${fallback}"`);
        const fallbackFound = await selectOptionWithCascadingMatch(panel, fallback, fieldType);
        if (fallbackFound) {
          console.log(`✅ Selected fallback "${fallback}" for "${labelText}"`);
          return true;
        }
      }
      
      // Close dropdown if option not found
      await closeOpenDropdowns();
      console.warn(`❌ Option "${value}" not found for "${labelText}"`);
      return false;
    }
  } catch (e) {
    console.error(`❌ Error selecting dropdown "${labelText}":`, e);
    await closeOpenDropdowns();
    return false;
  }
}

/**
 * ENHANCED Find dropdown button by its label text
 */
async function findDropdownByLabelEnhanced(labelText) {
  const lowerLabel = labelText.toLowerCase();
  const cleanLabel = cleanString(labelText);
  
  // Strategy 1: Use C() helper to find by exact text (like competitor)
  const byExactText = C('span', labelText) || C('div', labelText);
  if (byExactText) {
    // Look for dropdown parent
    let parent = byExactText.parentElement;
    for (let i = 0; i < 6 && parent; i++) {
      const dropdown = parent.querySelector('[role="combobox"], [role="button"][aria-haspopup], [aria-expanded]');
      if (dropdown && isVisible(dropdown)) return dropdown;
      parent = parent.parentElement;
    }
  }
  
  // Strategy 2: Find by aria-label
  const byAriaLabel = document.querySelector(`[aria-label*="${labelText}" i][role="combobox"], [aria-label*="${labelText}" i][aria-haspopup]`);
  if (byAriaLabel && isVisible(byAriaLabel)) return byAriaLabel;
  
  // Strategy 3: Find label span/div and get the clickable parent
  const allElements = document.querySelectorAll('span, div, label');
  for (const el of allElements) {
    const elText = cleanString(el.textContent);
    if (elText === cleanLabel || elText.includes(cleanLabel)) {
      let parent = el.parentElement;
      for (let i = 0; i < 5 && parent; i++) {
        if (parent.querySelector('[data-visualcompletion="ignore-dynamic"]') ||
            parent.getAttribute('aria-haspopup') ||
            parent.getAttribute('aria-expanded') !== null ||
            parent.querySelector('svg')) {
          const clickable = parent.querySelector('[role="button"], [role="combobox"], [tabindex="0"]') || parent;
          if (isVisible(clickable)) return clickable;
        }
        parent = parent.parentElement;
      }
    }
  }
  
  // Strategy 4: Find all dropdown-like elements
  const dropdowns = document.querySelectorAll('[aria-haspopup="listbox"], [aria-haspopup="menu"], [role="combobox"], [aria-expanded]');
  for (const dropdown of dropdowns) {
    const container = dropdown.closest('[data-visualcompletion="ignore-dynamic"]') || dropdown.parentElement?.parentElement;
    if (container && cleanString(container.textContent).includes(cleanLabel)) {
      if (isVisible(dropdown)) return dropdown;
    }
  }
  
  return null;
}

/**
 * Select option using cascading match strategy (like competitor)
 * Exact -> Case-insensitive -> No spaces
 */
async function selectOptionWithCascadingMatch(panel, value, fieldType) {
  const searchValue = String(value).trim();
  
  // Wait up to 3 seconds for options to appear
  for (let attempt = 0; attempt < 15; attempt++) {
    await randomDelay(150, 250);
    
    // Get all option elements
    const options = getVisibleOptions(panel);
    
    // Try EXACT match first
    for (const option of options) {
      const optionText = option.textContent?.trim();
      if (optionText === searchValue) {
        await clickHumanlike(option);
        return true;
      }
    }
    
    // Try case-insensitive match
    const lowerValue = searchValue.toLowerCase();
    for (const option of options) {
      const optionText = option.textContent?.trim().toLowerCase();
      if (optionText === lowerValue) {
        await clickHumanlike(option);
        return true;
      }
    }
    
    // Try no-spaces match (like competitor)
    const noSpacesValue = lowerValue.replace(/\s/g, '');
    for (const option of options) {
      const optionNoSpaces = option.textContent?.trim().toLowerCase().replace(/\s/g, '');
      if (optionNoSpaces === noSpacesValue || optionNoSpaces.includes(noSpacesValue) || noSpacesValue.includes(optionNoSpaces)) {
        await clickHumanlike(option);
        return true;
      }
    }
    
    // Try partial/contains match
    for (const option of options) {
      const optionText = option.textContent?.trim().toLowerCase();
      if (optionText?.includes(lowerValue) || lowerValue.includes(optionText)) {
        await clickHumanlike(option);
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Get visible option elements from panel or page
 */
function getVisibleOptions(panel) {
  const optionSelectors = [
    '[role="option"]',
    '[role="menuitem"]',
    '[role="listbox"] [role="option"]',
    'div[tabindex="-1"]',
    'div[tabindex="0"]',
    'span[tabindex="-1"]'
  ];
  
  const options = [];
  const searchArea = panel || document;
  
  for (const selector of optionSelectors) {
    const found = searchArea.querySelectorAll(selector);
    for (const opt of found) {
      if (isVisible(opt) && opt.textContent?.trim()) {
        options.push(opt);
      }
    }
  }
  
  return options;
}

/**
 * ENHANCED Fill a Facebook input field by label (competitor patterns)
 */
async function fillFacebookInput(labelText, value) {
  console.log(`📝 Filling input "${labelText}" = "${value}"`);
  
  try {
    // Close any open dropdowns first
    await closeOpenDropdowns();
    await randomDelay(100, 200);
    
    // Find input using multiple strategies
    let input = await findInputByLabelEnhanced(labelText);
    
    if (!input || !isVisible(input)) {
      console.warn(`❌ Input "${labelText}" not found`);
      return false;
    }
    
    // Scroll into view
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await randomDelay(200, 400);
    
    // Human noise before action
    await performHumanNoise(input);
    
    // Click to focus (like competitor)
    await clickHumanlike(input);
    
    // Clear existing value
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await randomDelay(50, 100);
    
    // Type the value (fast for short inputs like price/mileage)
    const valStr = String(value);
    if (valStr.length < 10) {
      await typeFast(input, valStr);
    } else {
      await typeHumanlike(input, valStr);
    }
    
    // Blur and finalize
    input.blur();
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    await randomDelay(100, 200);
    
    // Wait for user delay if configured
    await waitUserDelay();
    
    console.log(`✅ Filled input "${labelText}"`);
    return true;
  } catch (e) {
    console.error(`❌ Error filling input "${labelText}":`, e);
    return false;
  }
}

/**
 * ENHANCED Find input by label text
 */
async function findInputByLabelEnhanced(labelText) {
  const cleanLabel = cleanString(labelText);
  
  // Strategy 1: Find by aria-label (exact and partial)
  let input = document.querySelector(`input[aria-label="${labelText}"]`);
  if (input && isVisible(input)) return input;
  
  input = document.querySelector(`input[aria-label*="${labelText}" i]`);
  if (input && isVisible(input)) return input;
  
  // Strategy 2: Find by placeholder
  input = document.querySelector(`input[placeholder*="${labelText}" i]`);
  if (input && isVisible(input)) return input;
  
  // Strategy 3: Use C() to find label, then find nearby input
  const label = C('span', labelText) || C('div', labelText) || C('label', labelText);
  if (label) {
    let parent = label.parentElement;
    for (let i = 0; i < 5 && parent; i++) {
      const foundInput = parent.querySelector('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])');
      if (foundInput && isVisible(foundInput)) return foundInput;
      parent = parent.parentElement;
    }
  }
  
  // Strategy 4: Find all labels and look for input nearby
  const labels = document.querySelectorAll('label, span, div');
  for (const lbl of labels) {
    if (cleanString(lbl.textContent).includes(cleanLabel)) {
      const container = lbl.closest('div[data-visualcompletion]') || lbl.parentElement;
      if (container) {
        const foundInput = container.querySelector('input:not([type="hidden"]):not([type="checkbox"])');
        if (foundInput && isVisible(foundInput)) return foundInput;
      }
    }
  }
  
  return null;
}

/**
 * ENHANCED Fill the description textarea (competitor patterns)
 */
async function fillFacebookTextarea(description) {
  console.log('📝 Filling description textarea...');
  
  try {
    // Close any open dropdowns first
    await closeOpenDropdowns();
    await randomDelay(200, 400);
    
    // Find textarea or contenteditable
    let textarea = await findDescriptionField();
    
    if (!textarea) {
      console.warn('❌ Description textarea not found');
      return false;
    }
    
    // Scroll into view
    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await randomDelay(300, 500);
    
    // Human noise before action
    await performHumanNoise(textarea);
    
    // Click to focus
    await clickHumanlike(textarea);
    
    // Handle contenteditable vs textarea
    if (textarea.isContentEditable) {
      textarea.innerHTML = '';
      textarea.textContent = '';
      // Use typeDescription for natural pauses
      await typeDescription(textarea, description);
    } else {
      textarea.value = '';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      await typeDescription(textarea, description);
    }
    
    // Blur and finalize
    textarea.blur();
    textarea.dispatchEvent(new Event('blur', { bubbles: true }));
    await randomDelay(200, 400);
    
    // Wait for user delay if configured
    await waitUserDelay();
    
    console.log('✅ Filled description');
    return true;
  } catch (e) {
    console.error('❌ Error filling description:', e);
    return false;
  }
}

/**
 * Find description field using multiple strategies
 */
async function findDescriptionField() {
  // Strategy 1: By aria-label
  let textarea = document.querySelector('textarea[aria-label*="Description" i]');
  if (textarea && isVisible(textarea)) return textarea;
  
  // Strategy 2: By placeholder
  textarea = document.querySelector('textarea[placeholder*="Description" i]');
  if (textarea && isVisible(textarea)) return textarea;
  
  // Strategy 3: Generic textarea
  textarea = document.querySelector('textarea');
  if (textarea && isVisible(textarea)) return textarea;
  
  // Strategy 4: Contenteditable with description label
  textarea = document.querySelector('[contenteditable="true"][aria-label*="Description" i]');
  if (textarea && isVisible(textarea)) return textarea;
  
  // Strategy 5: By role
  textarea = document.querySelector('[role="textbox"][aria-multiline="true"]');
  if (textarea && isVisible(textarea)) return textarea;
  
  // Strategy 6: Find using C() helper
  const descLabel = C('span', 'Description') || C('div', 'Description');
  if (descLabel) {
    let parent = descLabel.parentElement;
    for (let i = 0; i < 5 && parent; i++) {
      const found = parent.querySelector('textarea, [contenteditable="true"]');
      if (found && isVisible(found)) return found;
      parent = parent.parentElement;
    }
  }
  
  // Strategy 7: Last resort - any visible textarea/contenteditable
  const textareas = document.querySelectorAll('textarea, [contenteditable="true"]');
  for (const ta of textareas) {
    if (isVisible(ta)) return ta;
  }
  
  return null;
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
 * ENHANCED Click the publish/post button (competitor patterns)
 * IMPORTANT: Only clicks actual Publish/Post button, NEVER "Next"
 */
async function clickPublishButton() {
  console.log('🚀 Looking for publish button...');
  
  await closeOpenDropdowns();
  await randomDelay(500, 1000);
  
  // Priority 1: Use C() pattern to find exact button text (like competitor)
  const publishButtonTexts = ['Publish', 'Post', 'List item', 'List vehicle', 'Submit'];
  
  for (const text of publishButtonTexts) {
    const button = C('span', text) || C('div', text);
    if (button && isVisible(button)) {
      const clickable = button.closest('[role="button"]') || button.closest('button') || button;
      console.log(`🚀 Found publish button: "${text}" - clicking`);
      await clickHumanlike(clickable);
      await randomDelay(2000, 3000);
      return { clicked: true, buttonText: text };
    }
  }
  
  // Fallback: Search all buttons
  const allButtons = document.querySelectorAll('div[role="button"], button, [aria-label], [tabindex="0"]');
  let bestButton = null;
  let bestPriority = 999;
  
  for (const el of allButtons) {
    if (!isVisible(el) || el.disabled) continue;
    
    const text = el.textContent?.trim().toLowerCase() || '';
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    
    // Check for publish/post buttons (priority 1)
    for (const publishText of ['publish', 'post', 'list item', 'list vehicle', 'submit']) {
      if (text === publishText || ariaLabel.includes(publishText)) {
        if (bestPriority > 1) {
          bestButton = el;
          bestPriority = 1;
        }
        break;
      }
    }
  }
  
  if (bestButton) {
    const buttonText = bestButton.textContent?.trim();
    console.log(`🚀 Found publish button: "${buttonText}" - clicking`);
    await clickHumanlike(bestButton);
    await randomDelay(2000, 3000);
    return { clicked: true, buttonText };
  }
  
  // Check if "Next" is visible - click it to proceed through wizard
  // Facebook Marketplace uses multi-step wizard, Next is valid to click
  const nextButton = C('span', 'Next') || C('div', 'Next');
  if (nextButton && isVisible(nextButton)) {
    const clickable = nextButton.closest('[role="button"]') || nextButton.closest('button') || nextButton;
    console.log('🚀 Found "Next" button - clicking to proceed through wizard');
    await clickHumanlike(clickable);
    await randomDelay(2000, 3000);
    return { 
      clicked: true, 
      buttonText: 'Next',
      isWizardStep: true
    };
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
