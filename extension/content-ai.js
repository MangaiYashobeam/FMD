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
  API_URL: 'http://46.4.224.182:3000/api', // VPS Direct (Cloudflare not configured)
  // API_URL: 'https://dealersface.com/api', // Production (when Cloudflare is configured)
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
  switch (message.type) {
    case 'INIT':
      accountId = message.accountId;
      authToken = message.authToken;
      console.log('Content script initialized for account:', accountId);
      sendResponse({ success: true });
      break;
      
    case 'EXECUTE_COMMAND':
      executeCommand(message.command)
        .then(result => sendResponse({ success: true, result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open for async response
      
    case 'SCRAPE_INBOX':
      sendResponse({ success: true, data: scrapeInbox() });
      break;
      
    case 'SCRAPE_CONVERSATION':
      sendResponse({ success: true, data: scrapeConversation() });
      break;
      
    case 'GET_PAGE_STATE':
      sendResponse({
        success: true,
        data: {
          url: window.location.href,
          title: document.title,
          isMarketplace: window.location.href.includes('marketplace'),
          isInbox: window.location.href.includes('inbox'),
        },
      });
      break;
      
    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

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
