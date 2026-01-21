/**
 * IAI SOLDIER - Intelligent AI Assistant for Facebook Marketplace
 * 
 * A comprehensive, battle-tested automation system that:
 * - Impersonates user behavior exactly like they would
 * - Navigates FB Marketplace autonomously with fallback strategies
 * - Handles multiple languages (Irish, English, Spanish, etc.)
 * - Reads, analyzes, and responds to messages
 * - Lists vehicles with AI-powered descriptions
 * - Collects stats, metrics, and account health
 * 
 * STEALTH MODE ENGAGED - Maximum undetectability
 */

// ============================================
// IAI CORE CONFIGURATION
// ============================================

const IAI_CONFIG = {
  // API Endpoints
  API: {
    PRODUCTION: 'https://dealersface.com/api', // Production via Cloudflare
    LOCAL: 'http://localhost:5000/api',
    AI_SERVICE: 'https://sag.gemquery.com/api/v1',
  },
  
  // Human Behavior Simulation
  HUMAN: {
    TYPING: {
      MIN_DELAY: 35,      // Faster than before - real users vary
      MAX_DELAY: 120,
      TYPO_RATE: 0.015,   // 1.5% typo rate
      PAUSE_RATE: 0.08,   // 8% chance of pause
      PAUSE_DURATION: { MIN: 800, MAX: 2500 },
    },
    MOUSE: {
      JITTER: 12,         // Pixel jitter on clicks
      SCROLL_NOISE: 150,  // Random scroll variation
      HOVER_TIME: { MIN: 150, MAX: 400 },
    },
    TIMING: {
      ACTION_DELAY: { MIN: 400, MAX: 1800 },
      PAGE_LOAD_WAIT: { MIN: 1500, MAX: 3500 },
      THINK_TIME: { MIN: 800, MAX: 3000 },      // Simulates reading
      SESSION_BREAK: { MIN: 45000, MAX: 180000 }, // Random breaks
    },
    SESSION: {
      MAX_ACTIONS_BEFORE_BREAK: { MIN: 15, MAX: 35 },
      BREAK_CHANCE: 0.05, // 5% chance of random break
    },
  },
  
  // Stealth Settings
  STEALTH: {
    RANDOMIZE_USER_AGENT: false, // Keep native - changing is detectable
    INJECT_NOISE: true,
    AVOID_DETECTION_PATTERNS: true,
    NATURAL_SCROLL_BEHAVIOR: true,
  },
  
  // Task Polling
  POLLING: {
    INTERVAL: 5000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 2000,
  },
};

// ============================================
// MULTILINGUAL SUPPORT - Facebook UI Recognition
// ============================================

const FB_TRANSLATIONS = {
  // Navigation Labels (key: [English, Spanish, Portuguese, Irish, French, German])
  marketplace: ['marketplace', 'marketplace', 'marketplace', 'margadh', 'marketplace', 'marktplatz'],
  messages: ['messages', 'mensajes', 'mensagens', 'teachtaireachtaí', 'messages', 'nachrichten'],
  notifications: ['notifications', 'notificaciones', 'notificações', 'fógraí', 'notifications', 'benachrichtigungen'],
  selling: ['selling', 'vendiendo', 'vendendo', 'ag díol', 'ventes', 'verkaufen'],
  buying: ['buying', 'comprando', 'comprando', 'ag ceannach', 'achats', 'kaufen'],
  
  // Marketplace Form Labels
  vehicle_type: ['vehicle type', 'tipo de vehículo', 'tipo de veículo', 'cineál feithicle', 'type de véhicule', 'fahrzeugtyp'],
  year: ['year', 'año', 'ano', 'bliain', 'année', 'jahr'],
  make: ['make', 'marca', 'marca', 'déan', 'marque', 'marke'],
  model: ['model', 'modelo', 'modelo', 'múnla', 'modèle', 'modell'],
  price: ['price', 'precio', 'preço', 'praghas', 'prix', 'preis'],
  mileage: ['mileage', 'kilometraje', 'quilometragem', 'míleáiste', 'kilométrage', 'kilometerstand'],
  description: ['description', 'descripción', 'descrição', 'cur síos', 'description', 'beschreibung'],
  condition: ['condition', 'condición', 'condição', 'coinníoll', 'état', 'zustand'],
  
  // Buttons
  post: ['post', 'publicar', 'publicar', 'postáil', 'publier', 'posten'],
  publish: ['publish', 'publicar', 'publicar', 'foilsigh', 'publier', 'veröffentlichen'],
  next: ['next', 'siguiente', 'próximo', 'ar aghaidh', 'suivant', 'weiter'],
  send: ['send', 'enviar', 'enviar', 'seol', 'envoyer', 'senden'],
  confirm: ['confirm', 'confirmar', 'confirmar', 'deimhnigh', 'confirmer', 'bestätigen'],
  cancel: ['cancel', 'cancelar', 'cancelar', 'cealaigh', 'annuler', 'abbrechen'],
  
  // Messages
  inbox: ['inbox', 'bandeja de entrada', 'caixa de entrada', 'bosca isteach', 'boîte de réception', 'posteingang'],
  new_message: ['new message', 'nuevo mensaje', 'nova mensagem', 'teachtaireacht nua', 'nouveau message', 'neue nachricht'],
  reply: ['reply', 'responder', 'responder', 'freagair', 'répondre', 'antworten'],
};

// ============================================
// ADVANCED ELEMENT SELECTORS - With Fallbacks
// ============================================

const IAI_SELECTORS = {
  // Navigation Elements (with multiple fallbacks)
  navigation: {
    marketplaceLink: [
      '[aria-label*="Marketplace" i]',
      '[href*="/marketplace"]',
      'a[role="link"][href*="marketplace"]',
      '[data-testid="marketplace_icon"]',
      // Text-based fallback
      () => findByText(['Marketplace', 'Margadh', 'Marktplatz']),
    ],
    messagesLink: [
      '[aria-label*="Messenger" i]',
      '[aria-label*="Messages" i]',
      '[href*="/messages"]',
      '[data-testid="messenger_icon"]',
    ],
    notificationsLink: [
      '[aria-label*="Notifications" i]',
      '[aria-label*="Fógraí" i]', // Irish
    ],
  },
  
  // Marketplace Form Elements
  marketplace: {
    createListing: [
      '[aria-label*="Create" i][aria-label*="listing" i]',
      '[aria-label*="Sell" i]',
      'a[href*="/marketplace/create"]',
      '[data-testid="marketplace_create_listing"]',
      () => findByText(['Create new listing', 'Sell Something', 'Cruthaigh liostú']),
    ],
    vehicleCategory: [
      '[aria-label*="Vehicle" i]',
      '[aria-label*="Car" i]',
      '[data-testid="marketplace_vehicle_category"]',
    ],
    titleInput: [
      '[aria-label*="Title" i]',
      'input[name="title"]',
      '[placeholder*="title" i]',
      'input[aria-describedby*="title"]',
    ],
    priceInput: [
      '[aria-label*="Price" i]',
      'input[name="price"]',
      '[placeholder*="price" i]',
      'input[type="number"][aria-label*="price" i]',
    ],
    yearDropdown: [
      '[aria-label*="Year" i]',
      'select[name="year"]',
      '[role="combobox"][aria-label*="year" i]',
      '[data-testid="year_selector"]',
    ],
    makeDropdown: [
      '[aria-label*="Make" i]',
      'select[name="make"]',
      '[role="combobox"][aria-label*="make" i]',
    ],
    modelDropdown: [
      '[aria-label*="Model" i]',
      'select[name="model"]',
      '[role="combobox"][aria-label*="model" i]',
    ],
    mileageInput: [
      '[aria-label*="Mileage" i]',
      '[aria-label*="Odometer" i]',
      'input[name="mileage"]',
      '[placeholder*="mileage" i]',
    ],
    descriptionInput: [
      '[aria-label*="Description" i]',
      'textarea[name="description"]',
      '[role="textbox"][aria-label*="description" i]',
      '[contenteditable="true"][aria-label*="description" i]',
    ],
    conditionDropdown: [
      '[aria-label*="Condition" i]',
      'select[name="condition"]',
      '[role="combobox"][aria-label*="condition" i]',
    ],
    photoUpload: [
      'input[type="file"][accept*="image"]',
      'input[type="file"][accept*="jpeg,png"]',
      '[data-testid="media-attachment-file-input"]',
    ],
    publishButton: [
      '[aria-label*="Publish" i]',
      '[aria-label*="Post" i]',
      'button[type="submit"]',
      '[role="button"][aria-label*="publish" i]',
    ],
  },
  
  // Messages/Inbox Elements
  messages: {
    conversationList: [
      '[role="listbox"]',
      '[role="list"]',
      '[aria-label*="Conversation" i]',
      '[data-testid="conversation-list"]',
    ],
    conversationItem: [
      '[role="row"]',
      '[data-testid*="conversation"]',
      '[class*="conversation"]',
    ],
    messageInput: [
      '[contenteditable="true"][role="textbox"]',
      '[aria-label*="Message" i][contenteditable]',
      '[aria-label*="Aa" i]',
      '[data-testid="message-input"]',
    ],
    sendButton: [
      '[aria-label*="Send" i]',
      '[aria-label*="Press enter to send" i]',
      '[data-testid="send-button"]',
    ],
    messageContainer: [
      '[data-testid="message-container"]',
      '[class*="message-row"]',
      '[role="row"][data-scope="messages"]',
    ],
  },
  
  // Profile & Account
  account: {
    profileMenu: [
      '[aria-label*="Account" i]',
      '[aria-label*="Your profile" i]',
      '[data-testid="profile-button"]',
    ],
    myListings: [
      '[href*="/marketplace/you"]',
      '[aria-label*="Your listings" i]',
      () => findByText(['Your Items', 'Selling', 'Ag Díol']),
    ],
    settings: [
      '[href*="/settings"]',
      '[aria-label*="Settings" i]',
    ],
  },
};

// ============================================
// IAI STEALTH LAYER - Undetectable Actions
// ============================================

class IAIStealth {
  constructor() {
    this.actionsCount = 0;
    this.sessionStart = Date.now();
    this.lastActionTime = Date.now();
    this.maxActionsBeforeBreak = this.randomInt(
      IAI_CONFIG.HUMAN.SESSION.MAX_ACTIONS_BEFORE_BREAK.MIN,
      IAI_CONFIG.HUMAN.SESSION.MAX_ACTIONS_BEFORE_BREAK.MAX
    );
  }
  
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  randomFloat(min, max) {
    return min + Math.random() * (max - min);
  }
  
  /**
   * Human-like delay with natural variation
   */
  async delay(min, max) {
    const baseDelay = this.randomInt(min, max);
    // Add occasional longer pause (thinking time)
    const thinkPause = Math.random() < IAI_CONFIG.HUMAN.TYPING.PAUSE_RATE 
      ? this.randomInt(IAI_CONFIG.HUMAN.TIMING.THINK_TIME.MIN, IAI_CONFIG.HUMAN.TIMING.THINK_TIME.MAX)
      : 0;
    await new Promise(r => setTimeout(r, baseDelay + thinkPause));
  }
  
  /**
   * Check if we need a break (like a real human)
   */
  async checkForBreak() {
    this.actionsCount++;
    
    if (this.actionsCount >= this.maxActionsBeforeBreak || Math.random() < IAI_CONFIG.HUMAN.SESSION.BREAK_CHANCE) {
      console.log('🧘 IAI taking a human-like break...');
      await this.delay(
        IAI_CONFIG.HUMAN.TIMING.SESSION_BREAK.MIN,
        IAI_CONFIG.HUMAN.TIMING.SESSION_BREAK.MAX
      );
      this.actionsCount = 0;
      this.maxActionsBeforeBreak = this.randomInt(
        IAI_CONFIG.HUMAN.SESSION.MAX_ACTIONS_BEFORE_BREAK.MIN,
        IAI_CONFIG.HUMAN.SESSION.MAX_ACTIONS_BEFORE_BREAK.MAX
      );
    }
  }
  
  /**
   * Natural mouse movement simulation
   */
  generateMousePath(startX, startY, endX, endY, steps = 10) {
    const path = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Bezier curve for natural movement
      const noise = (1 - t) * t * (Math.random() - 0.5) * 50;
      path.push({
        x: startX + (endX - startX) * t + noise,
        y: startY + (endY - startY) * t + noise * 0.7,
      });
    }
    return path;
  }
  
  /**
   * Inject random noise (scrolls, mouse movements)
   */
  async injectNoise() {
    if (!IAI_CONFIG.STEALTH.INJECT_NOISE) return;
    
    const actions = [
      // Random small scroll
      () => window.scrollBy(0, this.randomInt(-50, 50)),
      // Move mouse randomly
      () => this.dispatchMouseEvent(
        document.body,
        'mousemove',
        this.randomInt(0, window.innerWidth),
        this.randomInt(0, window.innerHeight)
      ),
      // Nothing (most common - humans don't always fidget)
      () => {},
      () => {},
      () => {},
    ];
    
    const action = actions[Math.floor(Math.random() * actions.length)];
    action();
    await this.delay(50, 200);
  }
  
  /**
   * Dispatch mouse event
   */
  dispatchMouseEvent(element, type, x, y) {
    const event = new MouseEvent(type, {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    });
    element.dispatchEvent(event);
  }
  
  /**
   * Human-like click with full event sequence
   */
  async click(element) {
    await this.checkForBreak();
    
    // Scroll into view naturally
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.delay(300, 700);
    
    // Get element position with jitter
    const rect = element.getBoundingClientRect();
    const jitter = IAI_CONFIG.HUMAN.MOUSE.JITTER;
    const x = rect.left + rect.width / 2 + (Math.random() - 0.5) * jitter;
    const y = rect.top + rect.height / 2 + (Math.random() - 0.5) * jitter;
    
    // Simulate mouse path to element
    const currentX = window.innerWidth / 2;
    const currentY = window.innerHeight / 2;
    const path = this.generateMousePath(currentX, currentY, x, y);
    
    for (const point of path) {
      this.dispatchMouseEvent(element, 'mousemove', point.x, point.y);
      await this.delay(5, 15);
    }
    
    // Hover briefly
    this.dispatchMouseEvent(element, 'mouseenter', x, y);
    this.dispatchMouseEvent(element, 'mouseover', x, y);
    await this.delay(
      IAI_CONFIG.HUMAN.MOUSE.HOVER_TIME.MIN,
      IAI_CONFIG.HUMAN.MOUSE.HOVER_TIME.MAX
    );
    
    // Click sequence
    this.dispatchMouseEvent(element, 'mousedown', x, y);
    await this.delay(50, 150);
    this.dispatchMouseEvent(element, 'mouseup', x, y);
    this.dispatchMouseEvent(element, 'click', x, y);
    
    // Focus if needed
    if (element.focus) element.focus();
    
    await this.delay(
      IAI_CONFIG.HUMAN.TIMING.ACTION_DELAY.MIN,
      IAI_CONFIG.HUMAN.TIMING.ACTION_DELAY.MAX
    );
    
    await this.injectNoise();
  }
  
  /**
   * Human-like typing with typos and corrections
   */
  async type(element, text) {
    await this.checkForBreak();
    
    // Focus element
    element.focus();
    await this.delay(100, 300);
    
    // Clear existing content if needed
    if (element.value) {
      element.value = '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    const chars = text.split('');
    let currentText = '';
    
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      
      // Occasional typo and correction
      if (Math.random() < IAI_CONFIG.HUMAN.TYPING.TYPO_RATE && i > 0) {
        // Type wrong character
        const wrongChar = String.fromCharCode(char.charCodeAt(0) + (Math.random() > 0.5 ? 1 : -1));
        await this.typeChar(element, wrongChar, currentText);
        currentText += wrongChar;
        await this.delay(150, 400);
        
        // Delete it
        currentText = currentText.slice(0, -1);
        await this.typeBackspace(element, currentText);
        await this.delay(100, 250);
      }
      
      // Type correct character
      await this.typeChar(element, char, currentText);
      currentText += char;
      
      // Variable delay
      let delay = this.randomInt(
        IAI_CONFIG.HUMAN.TYPING.MIN_DELAY,
        IAI_CONFIG.HUMAN.TYPING.MAX_DELAY
      );
      
      // Longer pause after punctuation or space
      if (['.', ',', '!', '?', ' '].includes(char)) {
        delay += this.randomInt(50, 200);
      }
      
      // Occasional thinking pause
      if (Math.random() < IAI_CONFIG.HUMAN.TYPING.PAUSE_RATE) {
        delay += this.randomInt(
          IAI_CONFIG.HUMAN.TIMING.THINK_TIME.MIN,
          IAI_CONFIG.HUMAN.TIMING.THINK_TIME.MAX
        );
      }
      
      await this.delay(delay, delay + 20);
    }
    
    // Trigger final events
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    
    await this.injectNoise();
  }
  
  async typeChar(element, char, currentText) {
    // Key events
    const keydown = new KeyboardEvent('keydown', { key: char, bubbles: true });
    const keypress = new KeyboardEvent('keypress', { key: char, bubbles: true });
    const keyup = new KeyboardEvent('keyup', { key: char, bubbles: true });
    
    element.dispatchEvent(keydown);
    element.dispatchEvent(keypress);
    
    // Update value
    if (element.isContentEditable) {
      element.textContent = currentText + char;
    } else {
      element.value = currentText + char;
    }
    
    element.dispatchEvent(new InputEvent('input', { data: char, bubbles: true }));
    element.dispatchEvent(keyup);
  }
  
  async typeBackspace(element, resultText) {
    const keydown = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true });
    const keyup = new KeyboardEvent('keyup', { key: 'Backspace', bubbles: true });
    
    element.dispatchEvent(keydown);
    
    if (element.isContentEditable) {
      element.textContent = resultText;
    } else {
      element.value = resultText;
    }
    
    element.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));
    element.dispatchEvent(keyup);
  }
  
  /**
   * Natural scroll behavior
   */
  async scroll(direction = 'down', amount = 300) {
    const steps = this.randomInt(5, 15);
    const stepAmount = (direction === 'down' ? 1 : -1) * amount / steps;
    
    for (let i = 0; i < steps; i++) {
      window.scrollBy({
        top: stepAmount + (Math.random() - 0.5) * 20,
        behavior: 'instant',
      });
      await this.delay(10, 30);
    }
    
    await this.delay(200, 500);
  }
}

// ============================================
// IAI NAVIGATOR - Facebook Page Navigation
// ============================================

class IAINavigator {
  constructor(stealth) {
    this.stealth = stealth;
    this.currentPage = 'unknown';
    this.pageHistory = [];
  }
  
  /**
   * Detect current page context
   */
  detectCurrentPage() {
    const url = window.location.href;
    const path = window.location.pathname;
    
    if (url.includes('/marketplace/create')) return 'create_listing';
    if (url.includes('/marketplace/you')) return 'my_listings';
    if (url.includes('/marketplace/inbox') || url.includes('/messages/t/')) return 'messages';
    if (url.includes('/marketplace')) return 'marketplace';
    if (url.includes('/notifications')) return 'notifications';
    if (path === '/' || path === '/home.php') return 'home';
    
    return 'other';
  }
  
  /**
   * Wait for page to be ready
   */
  async waitForPageReady(timeout = 10000) {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      // Check for loading indicators gone
      const loadingSpinner = document.querySelector('[role="progressbar"], [class*="loading"]');
      const mainContent = document.querySelector('[role="main"], [id="content"]');
      
      if (!loadingSpinner && mainContent) {
        await this.stealth.delay(500, 1000);
        return true;
      }
      
      await this.stealth.delay(200, 400);
    }
    
    console.warn('Page load timeout');
    return false;
  }
  
  /**
   * Navigate to a Facebook page
   */
  async navigateTo(destination) {
    console.log(`🧭 Navigating to: ${destination}`);
    
    const urls = {
      marketplace: 'https://www.facebook.com/marketplace/',
      create_listing: 'https://www.facebook.com/marketplace/create/vehicle/',
      my_listings: 'https://www.facebook.com/marketplace/you/selling/',
      messages: 'https://www.facebook.com/marketplace/inbox/',
      home: 'https://www.facebook.com/',
      notifications: 'https://www.facebook.com/notifications',
    };
    
    if (urls[destination]) {
      window.location.href = urls[destination];
      await this.waitForPageReady();
    }
    
    this.currentPage = destination;
    this.pageHistory.push(destination);
  }
  
  /**
   * Find element using multiple strategies with fallbacks
   */
  async findElement(selectorList, options = {}) {
    const { timeout = 10000, useAI = false, description = '' } = options;
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      // Try each selector
      for (const selector of selectorList) {
        try {
          let element = null;
          
          if (typeof selector === 'function') {
            // Custom finder function
            element = selector();
          } else if (typeof selector === 'string') {
            element = document.querySelector(selector);
          }
          
          if (element && this.isVisible(element) && this.isInteractable(element)) {
            return element;
          }
        } catch (e) {
          console.debug(`Selector failed: ${selector}`, e);
        }
      }
      
      // Try AI-powered finding as last resort
      if (useAI && description) {
        const aiElement = await this.findWithAI(description);
        if (aiElement) return aiElement;
      }
      
      await this.stealth.delay(300, 500);
    }
    
    console.warn(`Element not found: ${description || selectorList[0]}`);
    return null;
  }
  
  /**
   * Check if element is visible
   */
  isVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           rect.width > 0 &&
           rect.height > 0;
  }
  
  /**
   * Check if element is interactable
   */
  isInteractable(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.pointerEvents !== 'none' && !element.disabled;
  }
  
  /**
   * AI-powered element finding (server-side)
   */
  async findWithAI(description) {
    try {
      const response = await fetch(`${IAI_CONFIG.API.PRODUCTION}/extension/find-element`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.iaiAuthToken}`,
        },
        body: JSON.stringify({
          description,
          pageHtml: document.documentElement.outerHTML.slice(0, 100000),
          url: window.location.href,
        }),
      });
      
      const result = await response.json();
      if (result.selector) {
        return document.querySelector(result.selector);
      }
    } catch (e) {
      console.debug('AI element finding failed:', e);
    }
    return null;
  }
}

// ============================================
// IAI MESSENGER - Message Reading & Replies
// ============================================

class IAIMessenger {
  constructor(stealth, navigator) {
    this.stealth = stealth;
    this.navigator = navigator;
    this.conversations = [];
    this.currentConversation = null;
  }
  
  /**
   * Navigate to messages inbox
   */
  async goToInbox() {
    if (this.navigator.detectCurrentPage() !== 'messages') {
      await this.navigator.navigateTo('messages');
    }
  }
  
  /**
   * Scrape all conversations from inbox
   */
  async scrapeConversations() {
    await this.goToInbox();
    await this.stealth.delay(1000, 2000);
    
    const conversations = [];
    
    // Multiple selector strategies
    const conversationSelectors = [
      '[role="gridcell"] [role="row"]',
      '[data-testid*="conversation"]',
      '[class*="x1n2onr6"][class*="x1ja2u2z"]', // FB dynamic classes
      '[role="row"][tabindex="0"]',
    ];
    
    let elements = [];
    for (const selector of conversationSelectors) {
      elements = document.querySelectorAll(selector);
      if (elements.length > 0) break;
    }
    
    // Fallback: Find any clickable items in conversation area
    if (elements.length === 0) {
      const mainArea = document.querySelector('[role="main"]');
      if (mainArea) {
        elements = mainArea.querySelectorAll('[role="button"], a[role="link"]');
      }
    }
    
    for (let i = 0; i < elements.length && i < 50; i++) {
      const el = elements[i];
      try {
        const conv = this.parseConversationElement(el, i);
        if (conv) conversations.push(conv);
      } catch (e) {
        console.debug('Error parsing conversation:', e);
      }
    }
    
    this.conversations = conversations;
    return conversations;
  }
  
  /**
   * Parse a conversation element into structured data
   */
  parseConversationElement(element, index) {
    const getText = (el, selectors) => {
      for (const sel of selectors) {
        const found = el.querySelector(sel);
        if (found?.textContent) return found.textContent.trim();
      }
      return '';
    };
    
    const nameSelectors = ['strong', 'span[dir="auto"]', '[class*="name"]', 'b'];
    const previewSelectors = ['span[class*="x1lliihq"]', '[class*="preview"]', 'span:last-child'];
    const timeSelectors = ['time', '[datetime]', 'abbr', '[class*="timestamp"]'];
    
    const name = getText(element, nameSelectors);
    const preview = getText(element, previewSelectors);
    const time = getText(element, timeSelectors);
    
    // Check for unread indicator
    const hasUnread = !!element.querySelector(
      '[class*="unread"], [aria-label*="unread"], [style*="font-weight: bold"], [class*="x1s688f"]'
    );
    
    if (!name) return null;
    
    return {
      id: element.getAttribute('data-testid') || `conv_${index}`,
      name,
      preview: preview.replace(name, '').trim(),
      time,
      isUnread: hasUnread,
      element,
    };
  }
  
  /**
   * Open a specific conversation
   */
  async openConversation(conversationOrIndex) {
    const conv = typeof conversationOrIndex === 'number' 
      ? this.conversations[conversationOrIndex]
      : conversationOrIndex;
    
    if (!conv?.element) {
      console.error('Invalid conversation');
      return false;
    }
    
    await this.stealth.click(conv.element);
    await this.stealth.delay(1500, 3000);
    
    this.currentConversation = conv;
    return true;
  }
  
  /**
   * Scrape messages from current conversation
   */
  async scrapeMessages() {
    const messages = [];
    
    const messageSelectors = [
      '[data-scope="messages"] [role="row"]',
      '[class*="__fb-light-mode"] [dir="auto"]',
      '[role="row"][class*="message"]',
      '[class*="x78zum5"] [dir="auto"]',
    ];
    
    let elements = [];
    for (const selector of messageSelectors) {
      elements = document.querySelectorAll(selector);
      if (elements.length > 0) break;
    }
    
    // Process messages
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const text = el.textContent?.trim();
      if (!text || text.length < 2) continue;
      
      // Determine if outgoing (usually on right side or has specific class)
      const isOutgoing = this.isOutgoingMessage(el);
      
      messages.push({
        id: `msg_${i}`,
        text,
        isOutgoing,
        sender: isOutgoing ? 'Me' : (this.currentConversation?.name || 'Buyer'),
        element: el,
      });
    }
    
    return messages;
  }
  
  /**
   * Detect if a message is outgoing
   */
  isOutgoingMessage(element) {
    // Check position (outgoing usually on right)
    const rect = element.getBoundingClientRect();
    const parent = element.closest('[role="row"]') || element.parentElement;
    const parentRect = parent?.getBoundingClientRect();
    
    if (parentRect && rect.left > parentRect.left + parentRect.width / 2) {
      return true;
    }
    
    // Check for blue background (outgoing messages)
    const style = window.getComputedStyle(element);
    const bgColor = style.backgroundColor;
    if (bgColor.includes('0, 132, 255') || bgColor.includes('rgb(0, 132, 255)')) {
      return true;
    }
    
    // Check for specific classes
    return !!element.closest('[class*="outgoing"], [class*="x1ey2m1c"]');
  }
  
  /**
   * Send a message in current conversation
   */
  async sendMessage(text) {
    // Find message input
    const inputElement = await this.navigator.findElement(
      IAI_SELECTORS.messages.messageInput,
      { description: 'message input field' }
    );
    
    if (!inputElement) {
      console.error('Could not find message input');
      return false;
    }
    
    // Type message
    await this.stealth.type(inputElement, text);
    await this.stealth.delay(500, 1000);
    
    // Send (Enter key or button)
    const sendButton = await this.navigator.findElement(
      IAI_SELECTORS.messages.sendButton,
      { timeout: 3000 }
    );
    
    if (sendButton) {
      await this.stealth.click(sendButton);
    } else {
      // Use Enter key
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true });
      inputElement.dispatchEvent(enterEvent);
    }
    
    await this.stealth.delay(1000, 2000);
    return true;
  }
  
  /**
   * Generate AI response for a conversation
   */
  async generateAIResponse(messages, dealerContext) {
    try {
      const response = await fetch(`${IAI_CONFIG.API.AI_SERVICE}/generate-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: this.buildResponsePrompt(messages, dealerContext),
          maxTokens: 200,
          temperature: 0.7,
        }),
      });
      
      const result = await response.json();
      return result.text || result.content || '';
    } catch (e) {
      console.error('AI response generation failed:', e);
      return null;
    }
  }
  
  buildResponsePrompt(messages, context) {
    return `You are a professional car dealership assistant responding to a buyer inquiry.

Dealership: ${context.dealerName || 'Auto Dealer'}
Current conversation:
${messages.map(m => `${m.sender}: ${m.text}`).join('\n')}

Write a brief, professional response that:
1. Answers any questions directly
2. Is friendly but professional
3. Encourages them to visit or call
4. Keeps response under 100 words

Response:`;
  }
}

// ============================================
// IAI LISTER - Vehicle Listing Automation
// ============================================

class IAILister {
  constructor(stealth, navigator) {
    this.stealth = stealth;
    this.navigator = navigator;
  }
  
  /**
   * Create a new vehicle listing
   */
  async createListing(vehicleData, images = []) {
    console.log('🚗 Creating vehicle listing:', vehicleData);
    
    // Navigate to create listing page
    await this.navigator.navigateTo('create_listing');
    await this.stealth.delay(2000, 3000);
    
    // Fill in form fields
    const formFields = [
      { selectors: IAI_SELECTORS.marketplace.yearDropdown, value: vehicleData.year, type: 'select' },
      { selectors: IAI_SELECTORS.marketplace.makeDropdown, value: vehicleData.make, type: 'select' },
      { selectors: IAI_SELECTORS.marketplace.modelDropdown, value: vehicleData.model, type: 'select' },
      { selectors: IAI_SELECTORS.marketplace.priceInput, value: vehicleData.price, type: 'input' },
      { selectors: IAI_SELECTORS.marketplace.mileageInput, value: vehicleData.mileage, type: 'input' },
      { selectors: IAI_SELECTORS.marketplace.descriptionInput, value: vehicleData.description, type: 'textarea' },
      { selectors: IAI_SELECTORS.marketplace.conditionDropdown, value: vehicleData.condition, type: 'select' },
    ];
    
    for (const field of formFields) {
      if (!field.value) continue;
      
      const element = await this.navigator.findElement(field.selectors, {
        description: `${field.type} field`,
        useAI: true,
      });
      
      if (element) {
        if (field.type === 'select') {
          await this.fillDropdown(element, field.value);
        } else {
          await this.stealth.click(element);
          await this.stealth.type(element, String(field.value));
        }
        await this.stealth.delay(500, 1500);
      } else {
        console.warn(`Field not found for: ${field.value}`);
      }
    }
    
    // Upload images
    if (images.length > 0) {
      await this.uploadImages(images);
    }
    
    console.log('✅ Listing form filled. Ready for review.');
    return true;
  }
  
  /**
   * Fill a dropdown/select field
   */
  async fillDropdown(element, value) {
    await this.stealth.click(element);
    await this.stealth.delay(500, 1000);
    
    // Wait for dropdown options to appear
    await this.stealth.delay(300, 600);
    
    // Try to find and click the option
    const optionSelectors = [
      `[role="option"][aria-label*="${value}" i]`,
      `[role="option"]:contains("${value}")`,
      `[data-value="${value}"]`,
      `option[value="${value}"]`,
    ];
    
    // Also try text search
    const allOptions = document.querySelectorAll('[role="option"], [role="listbox"] > div');
    for (const opt of allOptions) {
      if (opt.textContent?.toLowerCase().includes(value.toLowerCase())) {
        await this.stealth.click(opt);
        return;
      }
    }
    
    // Fallback: type to search
    await this.stealth.type(element, value);
    await this.stealth.delay(500, 1000);
    
    const firstOption = document.querySelector('[role="option"], [role="listbox"] [role="option"]:first-child');
    if (firstOption) {
      await this.stealth.click(firstOption);
    }
  }
  
  /**
   * Upload images to listing
   */
  async uploadImages(imageUrls) {
    const fileInput = await this.navigator.findElement(
      IAI_SELECTORS.marketplace.photoUpload,
      { description: 'photo upload input' }
    );
    
    if (!fileInput) {
      console.error('File input not found');
      return false;
    }
    
    // Fetch images and create File objects
    const files = [];
    for (let i = 0; i < imageUrls.length; i++) {
      try {
        const response = await fetch(imageUrls[i]);
        const blob = await response.blob();
        const file = new File([blob], `vehicle_${i}.jpg`, { type: 'image/jpeg' });
        files.push(file);
      } catch (e) {
        console.error(`Failed to fetch image ${i}:`, e);
      }
    }
    
    if (files.length === 0) return false;
    
    // Create DataTransfer and set files
    const dataTransfer = new DataTransfer();
    files.forEach(f => dataTransfer.items.add(f));
    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Wait for upload
    await this.stealth.delay(2000, 4000);
    
    return true;
  }
  
  /**
   * Generate AI description for vehicle
   */
  async generateDescription(vehicleData) {
    try {
      const response = await fetch(`${IAI_CONFIG.API.AI_SERVICE}/generate-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Write a compelling Facebook Marketplace listing description for this vehicle:

Year: ${vehicleData.year}
Make: ${vehicleData.make}
Model: ${vehicleData.model}
Mileage: ${vehicleData.mileage} miles
Price: $${vehicleData.price}
Condition: ${vehicleData.condition}
Additional features: ${vehicleData.features || 'Standard features'}

Requirements:
- Professional but friendly tone
- Highlight key features and condition
- Include call-to-action
- Keep under 300 words
- Use emojis sparingly

Description:`,
          maxTokens: 400,
        }),
      });
      
      const result = await response.json();
      return result.text || result.content || '';
    } catch (e) {
      console.error('Description generation failed:', e);
      return '';
    }
  }
}

// ============================================
// IAI STATS COLLECTOR - Account Metrics
// ============================================

class IAIStatsCollector {
  constructor(stealth, navigator) {
    this.stealth = stealth;
    this.navigator = navigator;
  }
  
  /**
   * Collect comprehensive account statistics
   */
  async collectStats() {
    const stats = {
      timestamp: new Date().toISOString(),
      account: await this.getAccountInfo(),
      listings: await this.getListingsStats(),
      messages: await this.getMessagesStats(),
      notifications: await this.getNotificationsCount(),
    };
    
    return stats;
  }
  
  /**
   * Get account information
   */
  async getAccountInfo() {
    const info = {
      profileName: '',
      profileUrl: '',
      marketplaceRating: '',
      memberSince: '',
    };
    
    // Get profile name from header
    const profileLink = document.querySelector('[aria-label*="profile" i] img, [data-testid="profile-picture"]');
    if (profileLink) {
      info.profileName = profileLink.getAttribute('alt') || '';
    }
    
    return info;
  }
  
  /**
   * Get listings statistics
   */
  async getListingsStats() {
    // Navigate to my listings
    await this.navigator.navigateTo('my_listings');
    await this.stealth.delay(2000, 3000);
    
    const stats = {
      activeListings: 0,
      pendingListings: 0,
      soldListings: 0,
      totalViews: 0,
    };
    
    // Count listings by status
    const listings = document.querySelectorAll('[role="listitem"], [class*="listing-card"]');
    stats.activeListings = listings.length;
    
    // Try to find view counts
    for (const listing of listings) {
      const viewText = listing.querySelector('[class*="views"], [aria-label*="views"]');
      if (viewText) {
        const views = parseInt(viewText.textContent.replace(/\D/g, ''), 10);
        if (!isNaN(views)) stats.totalViews += views;
      }
    }
    
    return stats;
  }
  
  /**
   * Get messages statistics
   */
  async getMessagesStats() {
    await this.navigator.navigateTo('messages');
    await this.stealth.delay(1500, 2500);
    
    const stats = {
      unreadCount: 0,
      totalConversations: 0,
    };
    
    // Count unread
    const unreadBadge = document.querySelector('[aria-label*="unread" i], [class*="badge"]');
    if (unreadBadge) {
      const count = parseInt(unreadBadge.textContent.replace(/\D/g, ''), 10);
      if (!isNaN(count)) stats.unreadCount = count;
    }
    
    // Count conversations
    const conversations = document.querySelectorAll('[role="row"], [data-testid*="conversation"]');
    stats.totalConversations = conversations.length;
    
    return stats;
  }
  
  /**
   * Get notifications count
   */
  async getNotificationsCount() {
    const notifBadge = document.querySelector(
      '[aria-label*="notification" i] [class*="badge"], ' +
      '[data-testid="notification-badge"]'
    );
    
    if (notifBadge) {
      const count = parseInt(notifBadge.textContent.replace(/\D/g, ''), 10);
      return isNaN(count) ? 0 : count;
    }
    
    return 0;
  }
}

// ============================================
// IAI SOLDIER - Main Controller
// ============================================

class IAISoldier {
  constructor() {
    this.stealth = new IAIStealth();
    this.navigator = new IAINavigator(this.stealth);
    this.messenger = new IAIMessenger(this.stealth, this.navigator);
    this.lister = new IAILister(this.stealth, this.navigator);
    this.stats = new IAIStatsCollector(this.stealth, this.navigator);
    
    this.isActive = false;
    this.taskQueue = [];
    this.accountId = null;
    this.authToken = null;
  }
  
  /**
   * Initialize the IAI Soldier
   */
  async initialize(accountId, authToken) {
    console.log('🎖️ IAI Soldier initializing...');
    
    this.accountId = accountId;
    this.authToken = authToken;
    window.iaiAuthToken = authToken; // For navigator to use
    
    // Verify we're on Facebook
    if (!window.location.hostname.includes('facebook.com')) {
      console.error('IAI Soldier must be deployed on Facebook');
      return false;
    }
    
    this.isActive = true;
    
    // Start task polling
    this.startTaskPolling();
    
    console.log('🎖️ IAI Soldier ready for duty!');
    return true;
  }
  
  /**
   * Start polling server for tasks
   */
  startTaskPolling() {
    setInterval(async () => {
      if (!this.isActive) return;
      await this.pollForTasks();
    }, IAI_CONFIG.POLLING.INTERVAL);
  }
  
  /**
   * Poll server for pending tasks
   */
  async pollForTasks() {
    try {
      const response = await fetch(
        `${IAI_CONFIG.API.PRODUCTION}/extension/tasks/${this.accountId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
          },
        }
      );
      
      if (!response.ok) return;
      
      const tasks = await response.json();
      
      for (const task of tasks) {
        await this.executeTask(task);
      }
    } catch (e) {
      console.debug('Task polling error:', e);
    }
  }
  
  /**
   * Execute a task from the server
   */
  async executeTask(task) {
    console.log('🎯 Executing task:', task.type);
    
    try {
      await this.updateTaskStatus(task.id, 'processing');
      
      let result = null;
      
      switch (task.type) {
        case 'scrape_inbox':
          result = await this.messenger.scrapeConversations();
          break;
          
        case 'scrape_messages':
          await this.messenger.openConversation(task.data.conversationIndex);
          result = await this.messenger.scrapeMessages();
          break;
          
        case 'send_message':
          result = await this.messenger.sendMessage(task.data.message);
          break;
          
        case 'create_listing':
          result = await this.lister.createListing(task.data.vehicle, task.data.images);
          break;
          
        case 'collect_stats':
          result = await this.stats.collectStats();
          break;
          
        case 'navigate':
          await this.navigator.navigateTo(task.data.destination);
          result = { success: true, page: task.data.destination };
          break;
          
        case 'execute_commands':
          result = await this.executeCommands(task.data.commands);
          break;
          
        default:
          console.warn('Unknown task type:', task.type);
      }
      
      await this.updateTaskStatus(task.id, 'completed', result);
      
    } catch (error) {
      console.error('Task execution failed:', error);
      await this.updateTaskStatus(task.id, 'failed', { error: error.message });
    }
  }
  
  /**
   * Execute a sequence of commands
   */
  async executeCommands(commands) {
    const results = [];
    
    for (const cmd of commands) {
      const result = await this.executeCommand(cmd);
      results.push(result);
      await this.stealth.delay(500, 1500);
    }
    
    return results;
  }
  
  /**
   * Execute a single command
   */
  async executeCommand(command) {
    const { action, target, value, options = {} } = command;
    
    switch (action) {
      case 'click':
        const clickEl = await this.navigator.findElement(
          Array.isArray(target) ? target : [target],
          { useAI: options.useAI }
        );
        if (clickEl) await this.stealth.click(clickEl);
        return { action, success: !!clickEl };
        
      case 'type':
        const typeEl = await this.navigator.findElement(
          Array.isArray(target) ? target : [target],
          { useAI: options.useAI }
        );
        if (typeEl) await this.stealth.type(typeEl, value);
        return { action, success: !!typeEl };
        
      case 'scroll':
        await this.stealth.scroll(target || 'down', value || 300);
        return { action, success: true };
        
      case 'wait':
        await this.stealth.delay(value || 1000, (value || 1000) + 500);
        return { action, success: true };
        
      case 'navigate':
        await this.navigator.navigateTo(target);
        return { action, success: true };
        
      default:
        return { action, success: false, error: 'Unknown action' };
    }
  }
  
  /**
   * Update task status on server
   */
  async updateTaskStatus(taskId, status, result = null) {
    try {
      await fetch(`${IAI_CONFIG.API.PRODUCTION}/extension/tasks/${taskId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({ status, result }),
      });
    } catch (e) {
      console.debug('Failed to update task status:', e);
    }
  }
  
  /**
   * Emergency stop
   */
  stop() {
    console.log('🛑 IAI Soldier standing down');
    this.isActive = false;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Find element by text content (multilingual)
 */
function findByText(textOptions) {
  const allElements = document.querySelectorAll('a, button, span, div, [role="button"], [role="link"]');
  
  for (const el of allElements) {
    const text = el.textContent?.toLowerCase().trim();
    if (!text) continue;
    
    for (const option of textOptions) {
      if (text.includes(option.toLowerCase())) {
        return el;
      }
    }
  }
  
  return null;
}

// ============================================
// EXPORTS & INITIALIZATION
// ============================================

window.IAISoldier = IAISoldier;
window.IAI_CONFIG = IAI_CONFIG;
window.FB_TRANSLATIONS = FB_TRANSLATIONS;

// Auto-initialize if credentials are available
if (window.location.hostname.includes('facebook.com')) {
  chrome.storage?.local?.get(['accountId', 'authToken'], (result) => {
    if (result?.accountId && result?.authToken) {
      const soldier = new IAISoldier();
      soldier.initialize(result.accountId, result.authToken);
      window.iaiSoldier = soldier;
    }
  });
}

console.log('🎖️ IAI Soldier module loaded - Stealth Mode Active');
