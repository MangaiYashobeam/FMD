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
 * 
 * ENHANCED v2.0 - Based on proven competitor patterns:
 * - Close open dropdowns before opening new ones
 * - Use aria-controls for reliable dropdown detection
 * - Full pointer event sequence for clicks
 * - Exact → case-insensitive → no-spaces matching
 * - Hardcoded fallback values for all dropdowns
 * - User-configurable delays
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
  
  // Human Behavior Simulation - ENHANCED with competitor patterns
  HUMAN: {
    TYPING: {
      // Fast typing for dropdowns (like competitor: 10-28ms)
      DROPDOWN_MIN_DELAY: 10,
      DROPDOWN_MAX_DELAY: 28,
      // Normal typing for inputs
      MIN_DELAY: 35,
      MAX_DELAY: 120,
      // Fast typing for descriptions (like competitor: 6-18ms)
      DESC_MIN_DELAY: 6,
      DESC_MAX_DELAY: 18,
      TYPO_RATE: 0.015,   // 1.5% typo rate
      PAUSE_RATE: 0.08,   // 8% chance of pause
      LONG_PAUSE_PROBABILITY: 0.12, // 12% like competitor
      PAUSE_DURATION: { MIN: 100, MAX: 300 },  // 5x faster
    },
    MOUSE: {
      JITTER: 12,         // Pixel jitter on clicks
      SCROLL_NOISE: 150,  // Random scroll variation
      HOVER_TIME: { MIN: 30, MAX: 80 },  // 5x faster
    },
    TIMING: {
      ACTION_DELAY: { MIN: 80, MAX: 360 },  // 5x faster
      PAGE_LOAD_WAIT: { MIN: 300, MAX: 700 },  // 5x faster
      THINK_TIME: { MIN: 80, MAX: 300 },  // 10x faster
      SESSION_BREAK: { MIN: 4500, MAX: 18000 },  // 10x faster
      // Dropdown specific timing
      DROPDOWN_WAIT: 50,        // 4x faster - wait between dropdown retries
      DROPDOWN_MAX_ATTEMPTS: 10, // Max retries for dropdown
    },
    SESSION: {
      MAX_ACTIONS_BEFORE_BREAK: { MIN: 50, MAX: 100 },  // More actions before break
      BREAK_CHANCE: 0.01,  // 5x less likely to take breaks
      OCCASIONAL_LONG_PAUSE_CHANCE: 0.02, // 4x less likely
    },
  },
  
  // Stealth Settings
  STEALTH: {
    RANDOMIZE_USER_AGENT: false,
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
  
  // FALLBACK VALUES - Hardcoded defaults (like competitor)
  FALLBACKS: {
    MAKE: 'Toyota',
    EXTERIOR_COLOR: 'Black',
    INTERIOR_COLOR: 'Black',
    BODY_STYLE: 'Other',
    FUEL_TYPE: 'Gasoline',
    CONDITION: 'Excellent',
    VEHICLE_TYPE: 'Car/Truck',
    YEAR: '2022',
  },
};

// ============================================
// INJECTION SYSTEM - DYNAMIC PATTERN LOADING
// ============================================

/**
 * Injection data storage - loaded from server injection API
 * This is the ONLY source of automation patterns - NO hardcoded workflows
 */
let IAI_INJECTION = {
  _loaded: false,
  _patternId: null,
  _patternName: null,
  _patternVersion: null,
  _containerId: null,
  _containerName: null,
  _loadedAt: null,
  
  // Workflow steps from injected pattern
  WORKFLOW: [],
  
  // Field selectors from injection
  FIELD_SELECTORS: {},
  
  // Timing configuration from injection
  TIMING: {
    averageDelay: 500,
    recommendedDelay: 400,
  },
  
  // Pattern metadata
  METADATA: {},
};

// Legacy alias for backwards compatibility
let IAI_TRAINING = IAI_INJECTION;

/**
 * Process pattern data from either public or authenticated endpoint
 */
function processPatternData(pattern, container) {
  try {
    // Parse workflow from pattern code
    let workflow = [];
    let patternCode = pattern.code;
    
    // Handle both string and object code formats
    if (typeof patternCode === 'string') {
      try {
        patternCode = JSON.parse(patternCode);
      } catch (e) {
        console.error('[IAI] Failed to parse pattern code string:', e);
      }
    }
    
    // Extract workflow steps
    if (patternCode?.workflow) {
      workflow = patternCode.workflow;
    } else if (patternCode?.steps) {
      workflow = patternCode.steps;
    } else if (patternCode?.STEPS) {
      workflow = patternCode.STEPS;
    }
    
    IAI_INJECTION = {
      _loaded: true,
      _patternId: pattern.id,
      _patternName: pattern.name,
      _patternVersion: pattern.version,
      _containerId: container?.id,
      _containerName: container?.name,
      _loadedAt: new Date(),
      WORKFLOW: workflow,
      FIELD_SELECTORS: patternCode?.fieldMappings || patternCode?.fieldSelectors || {},
      TIMING: patternCode?.timing || { averageDelay: 500, recommendedDelay: 400 },
      METADATA: {
        tags: pattern.tags,
        codeType: pattern.codeType || 'workflow',
        isDefault: pattern.isDefault,
        errorRecovery: patternCode?.errorRecovery || {},
        actions: patternCode?.actions || {},
      },
    };
    
    // Update legacy alias
    IAI_TRAINING = IAI_INJECTION;
    
    // Cache for offline use
    chrome.storage?.local?.set({ iaiInjection: IAI_INJECTION });
    
    console.log(`[IAI] ✅ Injection pattern loaded: ${pattern.name} v${pattern.version}`);
    console.log(`[IAI] 📋 Workflow steps: ${workflow.length}`);
    console.log(`[IAI] 📦 Container: ${container?.name || 'default'}`);
    
    return true;
  } catch (e) {
    console.error('[IAI] processPatternData error:', e);
    return false;
  }
}

/**
 * Load cached pattern from Chrome storage
 */
async function loadCachedPattern() {
  try {
    const cached = await chrome.storage?.local?.get('iaiInjection');
    if (cached?.iaiInjection?._loaded) {
      IAI_INJECTION = cached.iaiInjection;
      IAI_TRAINING = IAI_INJECTION;
      console.log('[IAI] ⚠️ Using cached injection pattern:', IAI_INJECTION._patternName);
      return true;
    }
    console.error('[IAI] ❌ No cached pattern available');
    return false;
  } catch (e) {
    console.error('[IAI] loadCachedPattern error:', e);
    return false;
  }
}

/**
 * Load injection pattern from server
 * Uses PUBLIC endpoint first (no auth required), falls back to authenticated endpoint
 */
async function loadInjectionPattern() {
  try {
    console.log('[IAI] 🔄 Loading injection pattern from server...');
    
    const apiUrl = window.location.hostname === 'localhost' 
      ? IAI_CONFIG.API.LOCAL 
      : IAI_CONFIG.API.PRODUCTION;
    
    // TRY PUBLIC ENDPOINT FIRST (no auth required)
    console.log('[IAI] 📡 Trying public pattern endpoint...');
    const publicResponse = await fetch(`${apiUrl}/iai/pattern`);
    
    if (publicResponse.ok) {
      const publicData = await publicResponse.json();
      if (publicData.success && publicData.pattern) {
        console.log('[IAI] ✅ Loaded pattern from public endpoint');
        return processPatternData(publicData.pattern, publicData.container);
      }
    }
    
    // FALLBACK: Try authenticated endpoint
    console.log('[IAI] 📡 Trying authenticated endpoint...');
    const token = await getAuthToken();
    if (!token) {
      console.warn('[IAI] ⚠️ No auth token - using cached pattern if available');
      return loadCachedPattern();
    }
    
    // Fetch active pattern from injection API
    const response = await fetch(`${apiUrl}/injection/slot/active`, {
      headers: { 'Authorization': `Bearer ${token}` }
      });
      
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data) {
        const { pattern, container } = data.data;
        
        // Parse workflow from pattern code
        let workflow = [];
        try {
          if (typeof pattern.code === 'string') {
            const parsed = JSON.parse(pattern.code);
            workflow = parsed.steps || parsed.workflow || parsed.STEPS || [];
          } else if (pattern.code?.steps || pattern.code?.workflow) {
            workflow = pattern.code.steps || pattern.code.workflow;
          }
        } catch (parseErr) {
          console.error('[IAI] Failed to parse pattern code:', parseErr);
        }
        
        IAI_INJECTION = {
          _loaded: true,
          _patternId: pattern.id,
          _patternName: pattern.name,
          _patternVersion: pattern.version,
          _containerId: container?.id,
          _containerName: container?.name,
          _loadedAt: new Date(),
          WORKFLOW: workflow,
          FIELD_SELECTORS: pattern.code?.fieldSelectors || {},
          TIMING: pattern.code?.timing || { averageDelay: 500, recommendedDelay: 400 },
          METADATA: {
            tags: pattern.tags,
            codeType: pattern.codeType,
            isDefault: pattern.isDefault,
          },
        };
        
        // Update legacy alias
        IAI_TRAINING = IAI_INJECTION;
        
        // Cache for offline use
        await chrome.storage?.local?.set({ iaiInjection: IAI_INJECTION });
        
        console.log(`[IAI] ✅ Injection pattern loaded: ${pattern.name} v${pattern.version}`);
        console.log(`[IAI] 📋 Workflow steps: ${workflow.length}`);
        console.log(`[IAI] 📦 Container: ${container?.name || 'default'}`);
        return true;
      }
    }
    
    // Try cached pattern if server unavailable
    const cached = await chrome.storage?.local?.get('iaiInjection');
    if (cached?.iaiInjection?._loaded) {
      IAI_INJECTION = cached.iaiInjection;
      IAI_TRAINING = IAI_INJECTION;
      console.log('[IAI] ⚠️ Using cached injection pattern');
      return true;
    }
    
    console.error('[IAI] ❌ No injection pattern available - IAI cannot operate without patterns');
    return false;
  } catch (e) {
    console.error('[IAI] Injection pattern load error:', e.message);
    return false;
  }
}

// Legacy function alias
const loadTrainingData = loadInjectionPattern;

/**
 * Execute workflow from injected pattern
 * This is the main pattern execution engine
 */
/**
 * Generic Facebook Marketplace dropdown selector
 * Finds dropdown by visible label text, clicks to open, selects option
 * Works for Year, Make, Model, Transmission, Fuel Type, etc.
 */
async function selectFBDropdown(labelText, value, stealth) {
  console.log(`[IAI] 🔽 Selecting "${labelText}" = "${value}"`);
  
  if (!value) {
    console.log(`[IAI] ⚠ No value provided for ${labelText}, skipping`);
    return false;
  }
  
  try {
    // Strategy 1: Find clickable element containing the label text
    let dropdown = null;
    
    // Look for spans/divs with the label text
    const findDropdownTrigger = () => {
      // Find span with exact label text
      const spans = document.querySelectorAll('span');
      for (const span of spans) {
        const text = span.textContent?.trim();
        if (text === labelText || text?.toLowerCase() === labelText.toLowerCase()) {
          // Walk up to find clickable parent
          let parent = span.parentElement;
          for (let i = 0; i < 6 && parent; i++) {
            if (parent.getAttribute('role') === 'button' ||
                parent.getAttribute('role') === 'combobox' ||
                parent.getAttribute('tabindex') === '0' ||
                parent.tagName === 'LABEL' ||
                parent.classList.contains('x1i10hfl')) {
              return parent;
            }
            parent = parent.parentElement;
          }
          // If no clickable parent, the span's parent might be clickable
          if (span.parentElement?.closest('[role="button"], [tabindex="0"], label')) {
            return span.parentElement.closest('[role="button"], [tabindex="0"], label');
          }
        }
      }
      
      // Try aria-label
      const ariaEl = document.querySelector(`[aria-label*="${labelText}"]`);
      if (ariaEl && isVisible(ariaEl)) return ariaEl;
      
      // Try label element
      const labels = document.querySelectorAll('label');
      for (const label of labels) {
        if (label.textContent?.trim().toLowerCase().includes(labelText.toLowerCase())) {
          return label;
        }
      }
      
      return null;
    };
    
    dropdown = findDropdownTrigger();
    
    if (!dropdown) {
      console.log(`[IAI] ✗ Dropdown trigger for "${labelText}" not found`);
      return false;
    }
    
    console.log(`[IAI] ✓ Found dropdown trigger for "${labelText}"`);
    
    // Click to open dropdown
    await stealth.click(dropdown);
    await stealth.delay(80, 120);
    
    // Wait for options to appear and select the value
    let optionFound = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      // Look for options in various containers
      const optionSelectors = [
        '[role="option"]',
        '[role="menuitem"]',
        '[role="listbox"] [role="option"]',
        '[role="menu"] span',
        '[data-visualcompletion="ignore-dynamic"] span',
      ];
      
      for (const selector of optionSelectors) {
        const options = document.querySelectorAll(selector);
        for (const option of options) {
          const optionText = option.textContent?.trim();
          // Exact match or contains match
          if (optionText === String(value) || 
              optionText?.toLowerCase() === String(value).toLowerCase() ||
              optionText?.includes(String(value))) {
            console.log(`[IAI] ✓ Found option: "${optionText}"`);
            await stealth.click(option);
            optionFound = true;
            break;
          }
        }
        if (optionFound) break;
      }
      
      if (optionFound) break;
      
      // Also try finding visible spans with the value
      if (!optionFound) {
        const allSpans = document.querySelectorAll('span');
        for (const span of allSpans) {
          const spanText = span.textContent?.trim();
          if (spanText === String(value) && isVisible(span)) {
            // Check if it's in a dropdown context (not the form itself)
            const inDropdown = span.closest('[role="listbox"], [role="menu"], [role="dialog"], [data-visualcompletion]');
            if (inDropdown) {
              console.log(`[IAI] ✓ Found option by span: "${spanText}"`);
              await stealth.click(span);
              optionFound = true;
              break;
            }
          }
        }
      }
      
      if (optionFound) break;
      await stealth.delay(20, 40);
    }
    
    if (!optionFound) {
      console.log(`[IAI] ✗ Option "${value}" not found for "${labelText}"`);
      // Press Escape to close any open dropdown
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await stealth.delay(40, 60);
      return false;
    }
    
    console.log(`[IAI] ✅ "${labelText}" = "${value}" selected successfully`);
    await stealth.delay(60, 100);
    return true;
    
  } catch (error) {
    console.error(`[IAI] Error selecting ${labelText}:`, error);
    return false;
  }
}

/**
 * Select Facebook Marketplace Vehicle Type dropdown
 * This is a special dropdown that appears first on the form
 */
async function selectVehicleType(vehicleType, stealth) {
  console.log(`[IAI] 🚗 Selecting vehicle type: ${vehicleType}`);
  
  // Normalize vehicle type value
  const typeMap = {
    'car': 'Car/Truck',
    'car/truck': 'Car/Truck',
    'truck': 'Car/Truck',
    'motorcycle': 'Motorcycle',
    'powersport': 'Powersport',
    'rv': 'RV/Camper',
    'rv/camper': 'RV/Camper',
    'camper': 'RV/Camper',
    'trailer': 'Trailer',
    'boat': 'Boat',
    'commercial': 'Commercial/Industrial',
    'commercial/industrial': 'Commercial/Industrial',
    'other': 'Other',
  };
  
  const normalizedType = typeMap[vehicleType.toLowerCase()] || vehicleType;
  console.log(`[IAI] Normalized vehicle type: ${normalizedType}`);
  
  try {
    // Strategy 1: Find dropdown by "Vehicle type" text
    const vehicleTypeSelectors = [
      // Text-based selectors
      () => [...document.querySelectorAll('span')].find(s => s.textContent?.trim() === 'Vehicle type')?.closest('[role="button"], [role="combobox"], div[tabindex]'),
      () => [...document.querySelectorAll('div')].find(d => d.textContent?.trim() === 'Vehicle type' && d.querySelector('span'))?.closest('[role="button"], [tabindex="0"]'),
      // Aria-label based
      () => document.querySelector('[aria-label*="Vehicle type"]'),
      () => document.querySelector('[aria-label*="vehicle type"]'),
      // Role-based dropdown trigger
      () => document.querySelector('[role="combobox"][aria-haspopup="listbox"]'),
      // Common FB dropdown pattern - look for expandable div with "Vehicle type"
      () => {
        const spans = document.querySelectorAll('span');
        for (const span of spans) {
          if (span.textContent?.trim() === 'Vehicle type') {
            // Walk up to find the clickable parent
            let parent = span.parentElement;
            for (let i = 0; i < 5 && parent; i++) {
              if (parent.getAttribute('role') === 'button' || 
                  parent.getAttribute('tabindex') === '0' ||
                  parent.classList.contains('x1i10hfl')) {
                return parent;
              }
              parent = parent.parentElement;
            }
          }
        }
        return null;
      },
    ];
    
    let dropdownTrigger = null;
    for (const selector of vehicleTypeSelectors) {
      try {
        dropdownTrigger = selector();
        if (dropdownTrigger && isVisible(dropdownTrigger)) {
          console.log(`[IAI] ✓ Found vehicle type dropdown trigger`);
          break;
        }
      } catch (e) { /* continue */ }
    }
    
    if (!dropdownTrigger) {
      console.error('[IAI] ✗ Vehicle type dropdown not found');
      return false;
    }
    
    // Click to open dropdown
    await stealth.click(dropdownTrigger);
    await stealth.delay(80, 140);
    
    // Wait for dropdown options to appear
    let optionFound = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      // Look for the options in listbox or menu
      const options = document.querySelectorAll('[role="option"], [role="menuitem"], [role="listbox"] span, [role="menu"] span');
      
      for (const option of options) {
        const optionText = option.textContent?.trim();
        if (optionText && optionText.toLowerCase() === normalizedType.toLowerCase()) {
          console.log(`[IAI] ✓ Found option: "${optionText}"`);
          await stealth.click(option);
          optionFound = true;
          break;
        }
      }
      
      if (optionFound) break;
      
      // Also try finding by exact text match in any visible span
      if (!optionFound) {
        const allSpans = document.querySelectorAll('span');
        for (const span of allSpans) {
          if (span.textContent?.trim() === normalizedType && isVisible(span)) {
            // Make sure it's in a dropdown context (not the trigger itself)
            const parent = span.closest('[role="listbox"], [role="menu"], [role="dialog"]');
            if (parent || span.closest('[data-visualcompletion]')) {
              console.log(`[IAI] ✓ Found option by span text: "${normalizedType}"`);
              await stealth.click(span);
              optionFound = true;
              break;
            }
          }
        }
      }
      
      if (optionFound) break;
      await stealth.delay(30, 50);
    }
    
    if (!optionFound) {
      console.error(`[IAI] ✗ Option "${normalizedType}" not found in dropdown`);
      // Try pressing Escape to close dropdown
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return false;
    }
    
    console.log(`[IAI] ✅ Vehicle type "${normalizedType}" selected successfully`);
    await stealth.delay(100, 160); // Wait for form to update with new fields
    return true;
    
  } catch (error) {
    console.error('[IAI] Error selecting vehicle type:', error);
    return false;
  }
}

async function executeInjectedWorkflow(vehicleData) {
  if (!IAI_INJECTION._loaded) {
    console.error('[IAI] ❌ No injection pattern loaded - cannot execute workflow');
    return { success: false, error: 'No injection pattern loaded' };
  }
  
  console.log(`[IAI] 🚀 Executing injected workflow: ${IAI_INJECTION._patternName}`);
  
  const startTime = Date.now();
  const stealth = new IAIStealth();
  const filledFields = new Set(); // Track filled fields across all phases
  const results = {
    success: false,
    stepsExecuted: 0,
    stepsTotal: 0,
    errors: [],
    completed: [],
    duration: 0,
  };
  
  // === PHASE 0: Select Vehicle Type FIRST (required to reveal other fields) ===
  console.log('[IAI] 📋 Phase 0: Selecting vehicle type...');
  const vehicleType = vehicleData.vehicleType || vehicleData.type || 'Car/Truck';
  results.stepsTotal++;
  
  const vehicleTypeSuccess = await selectVehicleType(vehicleType, stealth);
  if (vehicleTypeSuccess) {
    results.completed.push({ field: 'vehicleType', value: vehicleType });
    results.stepsExecuted++;
    filledFields.add('vehicleType');
    console.log('[IAI] ✅ Vehicle type selected, waiting for form fields to load...');
    await stealth.delay(200, 300); // Give FB time to load additional fields
  } else {
    results.errors.push({ field: 'vehicleType', error: 'Failed to select vehicle type' });
    console.error('[IAI] ⚠️ Vehicle type selection failed, continuing anyway...');
  }
  
  // === PHASE 0.5: Fill key dropdowns (Year, Make, Model, Transmission, etc.) ===
  console.log('[IAI] 📋 Phase 0.5: Filling key dropdowns...');
  
  // These are the FB Marketplace dropdowns with their label text
  const dropdownFields = [
    { field: 'year', label: 'Year', value: vehicleData.year },
    { field: 'make', label: 'Make', value: vehicleData.make },
    { field: 'model', label: 'Model', value: vehicleData.model },
    { field: 'transmission', label: 'Transmission', value: vehicleData.transmission },
    { field: 'fuelType', label: 'Fuel type', value: vehicleData.fuelType || vehicleData.fuel },
    { field: 'bodyStyle', label: 'Body style', value: vehicleData.bodyStyle || vehicleData.body },
    { field: 'condition', label: 'Vehicle condition', value: vehicleData.condition },
    { field: 'exteriorColor', label: 'Exterior color', value: vehicleData.exteriorColor || vehicleData.color },
    { field: 'interiorColor', label: 'Interior color', value: vehicleData.interiorColor },
  ];
  
  for (const { field, label, value } of dropdownFields) {
    if (!value) continue;
    
    results.stepsTotal++;
    const success = await selectFBDropdown(label, value, stealth);
    
    if (success) {
      filledFields.add(field);
      results.completed.push({ field, value: String(value) });
      results.stepsExecuted++;
    } else {
      results.errors.push({ field, error: `Failed to select ${label}` });
    }
    
    await stealth.delay(80, 140);
  }
  
  console.log(`[IAI] Phase 0.5 complete: ${filledFields.size} dropdowns filled`);
  
  // === PHASE 1: Fill fields directly using fieldMappings (stable approach) ===
  console.log('[IAI] 📋 Phase 1: Filling fields via fieldMappings...');
  const fieldMappings = IAI_INJECTION.FIELD_SELECTORS || {};
  
  // Map vehicle data fields to form fields
  const fieldValueMap = {
    'year': vehicleData.year,
    'make': vehicleData.make,
    'model': vehicleData.model,
    'price': vehicleData.price,
    'mileage': vehicleData.mileage,
    'vin': vehicleData.vin,
    'title': vehicleData.title || `${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`,
    'description': vehicleData.description,
    'location': vehicleData.location || vehicleData.city,
    'transmission': vehicleData.transmission,
    'fuelType': vehicleData.fuelType || vehicleData.fuel,
    'bodyStyle': vehicleData.bodyStyle || vehicleData.body,
    'condition': vehicleData.condition,
    'color': vehicleData.color || vehicleData.exteriorColor,
    'exteriorColor': vehicleData.exteriorColor || vehicleData.color,
    'interiorColor': vehicleData.interiorColor,
  };
  
  for (const [fieldType, value] of Object.entries(fieldValueMap)) {
    if (value === null || value === undefined || value === '') continue;
    
    // Skip if already filled in Phase 0.5
    if (filledFields.has(fieldType)) {
      continue;
    }
    
    results.stepsTotal++;
    const mapping = fieldMappings[fieldType];
    
    if (!mapping || !mapping.selectors) {
      console.log(`[IAI] ⚠ No mapping for ${fieldType}, will try later...`);
      continue;
    }
    
    // Find element using stable selectors
    let element = null;
    for (const selector of mapping.selectors) {
      try {
        element = document.querySelector(selector);
        if (element && isVisible(element)) break;
      } catch (e) { /* invalid selector */ }
    }
    
    if (!element) {
      console.log(`[IAI] ⚠ Element not found for ${fieldType}`);
      results.errors.push({ field: fieldType, error: 'Element not found' });
      continue;
    }
    
    try {
      const inputType = mapping.type || 'input';
      console.log(`[IAI] 📝 Filling ${fieldType} = "${String(value).substring(0, 30)}..." (${inputType})`);
      
      if (inputType === 'dropdown' || inputType === 'select') {
        // Click to open dropdown
        await stealth.click(element);
        await stealth.delay(80, 120);
        
        // Find and select option
        const options = document.querySelectorAll('[role="option"], [role="listbox"] [role="option"]');
        let found = false;
        for (const opt of options) {
          if (opt.textContent?.toLowerCase().includes(String(value).toLowerCase())) {
            await stealth.click(opt);
            found = true;
            break;
          }
        }
        if (!found) {
          // Try typing in combobox
          const input = element.querySelector('input') || element;
          if (input) {
            await stealth.type(input, String(value));
            await stealth.delay(60, 100);
            // Press Enter or Tab
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
          }
        }
      } else if (inputType === 'contenteditable') {
        await stealth.click(element);
        await stealth.delay(40, 80);
        element.focus();
        element.innerHTML = '';
        document.execCommand('insertText', false, String(value));
      } else {
        // Standard input
        await stealth.click(element);
        await stealth.delay(20, 40);
        element.value = '';
        element.dispatchEvent(new Event('input', { bubbles: true }));
        await stealth.type(element, String(value));
      }
      
      filledFields.add(fieldType);
      results.completed.push({ field: fieldType, value: String(value).substring(0, 50) });
      results.stepsExecuted++;
      
      await stealth.delay(60, 120);
      
    } catch (err) {
      console.error(`[IAI] Error filling ${fieldType}:`, err);
      results.errors.push({ field: fieldType, error: err.message });
    }
  }
  
  console.log(`[IAI] Phase 1 complete: ${filledFields.size} fields filled`);
  
  // === PHASE 2: Execute remaining workflow steps (for clicks, navigation, etc.) ===
  if (IAI_INJECTION.WORKFLOW?.length > 0) {
    console.log('[IAI] 📋 Phase 2: Executing workflow steps for unfilled fields...');
    
    // Only process steps for fields not yet filled
    for (let i = 0; i < IAI_INJECTION.WORKFLOW.length; i++) {
      const step = IAI_INJECTION.WORKFLOW[i];
      const fieldType = step.fieldType || step.field;
      
      // Skip if already filled in Phase 1
      if (fieldType && filledFields.has(fieldType)) {
        continue;
      }
      
      // Skip pure click steps with no field association
      if (step.type === 'click' && !fieldType && !step.label && !step.ariaLabel) {
        continue;
      }
      
      results.stepsTotal++;
      
      try {
        const stepResult = await executeWorkflowStep(step, vehicleData, stealth);
        results.stepsExecuted++;
        
        if (stepResult.success) {
          if (fieldType) {
            filledFields.add(fieldType);
            results.completed.push({ step: i + 1, field: fieldType });
          }
        } else if (!stepResult.skipped) {
          results.errors.push({ step: i + 1, error: stepResult.error, field: fieldType });
        }
        
        // Delay between steps
        const delay = step.delay || IAI_INJECTION.TIMING?.recommendedDelay || 400;
        await stealth.delay(delay * 0.8, delay * 1.2);
        
      } catch (stepError) {
        console.error(`[IAI] Step ${i + 1} error:`, stepError);
        results.errors.push({ step: i + 1, error: stepError.message });
      }
    }
  }
  
  results.success = results.completed.length > 0 && (results.errors.length < results.completed.length);
  results.duration = Date.now() - startTime;
  console.log(`[IAI] ✅ Workflow complete: ${results.completed.length} fields filled, ${results.errors.length} errors in ${results.duration}ms`);
  
  return results;
}

/**
 * Execute a single workflow step
 * ENHANCED: Use fieldMappings type info to determine correct action
 */
async function executeWorkflowStep(step, vehicleData, stealth) {
  const action = step.action || step.type;
  const fieldType = step.fieldType || step.field;
  const value = resolveStepValue(step, vehicleData);
  
  // Get field mapping info for intelligent handling
  const fieldMapping = fieldType ? IAI_INJECTION.FIELD_SELECTORS?.[fieldType] : null;
  const fieldInputType = fieldMapping?.type || 'input';
  
  // Skip steps without fieldType if they're just clicks with no value
  if (action === 'click' && !fieldType && !step.label && !step.ariaLabel) {
    console.log(`[IAI] ⏭ Skipping non-field click step ${step.step}`);
    return { success: true, skipped: true };
  }
  
  // If we have a fieldType with a value, handle it intelligently
  if (fieldType && value !== null && value !== undefined && value !== '') {
    const el = await findElementForStep(step);
    if (!el) {
      return { success: false, error: `Element not found for ${fieldType}` };
    }
    
    console.log(`[IAI] 📝 Filling ${fieldType} = "${String(value).substring(0, 30)}..." (type: ${fieldInputType})`);
    
    switch (fieldInputType) {
      case 'dropdown':
      case 'select':
        // For dropdowns, click to open then select option
        await stealth.click(el);
        await stealth.delay(300, 500);
        const selectSuccess = await selectFacebookDropdownEnhancedV2(step.label || fieldType, value, stealth);
        return { success: selectSuccess };
        
      case 'contenteditable':
        // For description and rich text fields
        await stealth.click(el);
        await stealth.delay(200, 400);
        if (el.contentEditable === 'true' || el.getAttribute('role') === 'textbox') {
          el.innerHTML = '';
          el.focus();
          document.execCommand('insertText', false, String(value));
        } else {
          await stealth.type(el, String(value));
        }
        return { success: true };
        
      case 'input':
      default:
        // For regular inputs
        await stealth.click(el);
        await stealth.delay(100, 200);
        // Clear existing value
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        await stealth.type(el, String(value));
        return { success: true };
    }
  }
  
  // Fall back to action-based handling
  switch (action) {
    case 'click':
      const clickEl = await findElementForStep(step);
      if (clickEl) {
        await stealth.click(clickEl);
        return { success: true };
      }
      return { success: false, error: `Element not found for click: ${fieldType || step.selector || step.label}` };
      
    case 'type':
    case 'input':
      const inputEl = await findElementForStep(step);
      if (inputEl) {
        await stealth.click(inputEl);
        await stealth.type(inputEl, String(value || ''));
        return { success: true };
      }
      return { success: false, error: `Input not found: ${fieldType || step.selector || step.label}` };
      
    case 'select':
    case 'dropdown':
      const selectSuccess = await selectFacebookDropdownEnhancedV2(step.label || fieldType, value, stealth);
      return { success: selectSuccess };
      
    case 'wait':
      await stealth.delay(step.duration || 1000, (step.duration || 1000) + 500);
      return { success: true };
      
    case 'scroll':
      await stealth.scroll(step.direction || 'down', step.amount || 300);
      return { success: true };
      
    case 'navigate':
      window.location.href = step.url || step.destination;
      return { success: true };
      
    default:
      console.warn(`[IAI] Unknown step action: ${action}`);
      return { success: false, error: `Unknown action: ${action}` };
  }
}

/**
 * Find element for a workflow step
 * PRIORITY: Use stable fieldMappings (aria-label) FIRST, then fall back to recorded selectors
 */
async function findElementForStep(step) {
  const fieldType = step.fieldType || step.field;
  
  // === PRIORITY 1: Use stable fieldMappings (aria-label based selectors) ===
  if (fieldType && IAI_INJECTION.FIELD_SELECTORS?.[fieldType]) {
    const mapping = IAI_INJECTION.FIELD_SELECTORS[fieldType];
    if (mapping?.selectors && Array.isArray(mapping.selectors)) {
      for (const selector of mapping.selectors) {
        try {
          const el = document.querySelector(selector);
          if (el && isVisible(el)) {
            console.log(`[IAI] ✓ Found ${fieldType} via fieldMapping: ${selector}`);
            return el;
          }
        } catch (e) { /* invalid selector */ }
      }
    }
    // Also try primary from fieldMappings
    if (mapping?.primary) {
      try {
        const el = document.querySelector(mapping.primary);
        if (el && isVisible(el)) {
          console.log(`[IAI] ✓ Found ${fieldType} via fieldMapping.primary`);
          return el;
        }
      } catch (e) { /* invalid selector */ }
    }
  }
  
  // === PRIORITY 2: Try common aria-label patterns for vehicle fields ===
  const ariaLabelMap = {
    'year': 'Year',
    'make': 'Make',
    'model': 'Model',
    'price': 'Price',
    'mileage': 'Mileage',
    'vin': 'VIN',
    'title': 'Title',
    'description': 'Description',
    'location': 'Location',
    'transmission': 'Transmission',
    'fuelType': 'Fuel',
    'bodyStyle': 'Body',
    'condition': 'Condition',
    'color': 'Color',
    'exteriorColor': 'Exterior',
    'interiorColor': 'Interior',
  };
  
  if (fieldType && ariaLabelMap[fieldType]) {
    const label = ariaLabelMap[fieldType];
    const ariaSelectors = [
      `input[aria-label*="${label}"]`,
      `textarea[aria-label*="${label}"]`,
      `[aria-label*="${label}"] input`,
      `[aria-label*="${label}"] textarea`,
      `[role="combobox"][aria-label*="${label}"]`,
      `[role="textbox"][aria-label*="${label}"]`,
    ];
    for (const selector of ariaSelectors) {
      try {
        const el = document.querySelector(selector);
        if (el && isVisible(el)) {
          console.log(`[IAI] ✓ Found ${fieldType} via ariaLabel fallback: ${selector}`);
          return el;
        }
      } catch (e) { /* invalid selector */ }
    }
  }
  
  // === PRIORITY 3: Try label text search ===
  if (step.label || (fieldType && ariaLabelMap[fieldType])) {
    const labelText = step.label || ariaLabelMap[fieldType];
    const el = C('label', labelText) || C('span', labelText) || C('div', labelText);
    if (el) {
      // Find associated input
      const input = el.querySelector('input, textarea, [contenteditable="true"]');
      if (input && isVisible(input)) {
        console.log(`[IAI] ✓ Found ${fieldType} via label text: ${labelText}`);
        return input;
      }
      if (isVisible(el)) return el;
    }
  }
  
  // === PRIORITY 4: Try element.ariaLabel from recorded data ===
  if (step.element?.ariaLabel) {
    const el = document.querySelector(`[aria-label="${step.element.ariaLabel}"]`) ||
               document.querySelector(`[aria-label*="${step.element.ariaLabel}"]`);
    if (el && isVisible(el)) {
      console.log(`[IAI] ✓ Found element with ariaLabel: ${step.element.ariaLabel}`);
      return el;
    }
  }
  
  // === PRIORITY 5: Try direct selector property ===
  if (step.selector) {
    try {
      const el = document.querySelector(step.selector);
      if (el && isVisible(el)) {
        console.log(`[IAI] ✓ Found element with step.selector`);
        return el;
      }
    } catch (e) { /* invalid selector */ }
  }
  
  // === PRIORITY 6: Try step.ariaLabel directly ===
  if (step.ariaLabel) {
    const el = document.querySelector(`[aria-label="${step.ariaLabel}"]`) ||
               document.querySelector(`[aria-label*="${step.ariaLabel}"]`);
    if (el && isVisible(el)) {
      console.log(`[IAI] ✓ Found element with step.ariaLabel`);
      return el;
    }
  }
  
  // === PRIORITY 7: Try recorded element.selectors (last resort - often broken) ===
  if (step.element?.selectors && Array.isArray(step.element.selectors)) {
    for (const selector of step.element.selectors) {
      try {
        const el = document.querySelector(selector);
        if (el && isVisible(el)) {
          console.log(`[IAI] ✓ Found element with recorded selector: ${selector.substring(0, 50)}...`);
          return el;
        }
      } catch (e) { /* invalid selector */ }
    }
  }
  
  // === PRIORITY 8: Try element.className directly ===
  if (step.element?.className) {
    const classSelector = '.' + step.element.className.split(' ').join('.');
    try {
      const el = document.querySelector(classSelector);
      if (el && isVisible(el)) {
        console.log(`[IAI] ✓ Found element with className: ${classSelector.substring(0, 50)}...`);
        return el;
      }
    } catch (e) { /* invalid selector */ }
  }
  
  console.log(`[IAI] ✗ Element not found for step: ${fieldType || step.type || 'unknown'}`);
  return null;
}

/**
 * Resolve the value for a step from vehicle data
 */
function resolveStepValue(step, vehicleData) {
  if (step.value) return step.value;
  if (!step.fieldType || !vehicleData) return null;
  
  const fieldMap = {
    'vehicleType': vehicleData.vehicleType || 'Car/Truck',
    'year': vehicleData.year,
    'make': vehicleData.make,
    'model': vehicleData.model,
    'price': vehicleData.price,
    'mileage': vehicleData.mileage,
    'description': vehicleData.description,
    'condition': vehicleData.condition,
    'exteriorColor': vehicleData.exteriorColor || vehicleData.color,
    'interiorColor': vehicleData.interiorColor,
    'bodyStyle': vehicleData.bodyStyle || vehicleData.body,
    'fuelType': vehicleData.fuelType || vehicleData.fuel,
    'transmission': vehicleData.transmission,
    'trim': vehicleData.trim,
    'vin': vehicleData.vin,
  };
  
  return fieldMap[step.fieldType] || null;
}

/**
 * Get selector for a field from training data
 * Falls back to hardcoded selectors if training not available
 */
function getTrainedSelector(fieldType) {
  if (IAI_TRAINING._loaded && IAI_TRAINING.FIELD_SELECTORS?.[fieldType]) {
    const selector = IAI_TRAINING.FIELD_SELECTORS[fieldType];
    return {
      primary: selector.primary,
      fallbacks: selector.fallbacks || [],
      ariaLabel: selector.ariaLabel,
      role: selector.role,
      isDropdown: selector.isDropdown,
      isInput: selector.isInput,
    };
  }
  return null;
}

/**
 * Find element using trained selector
 */
function findWithTrainedSelector(fieldType) {
  const selector = getTrainedSelector(fieldType);
  if (!selector) return null;
  
  // Try primary selector
  if (selector.primary) {
    try {
      const el = document.querySelector(selector.primary);
      if (el) return el;
    } catch (e) { /* invalid selector */ }
  }
  
  // Try aria-label
  if (selector.ariaLabel) {
    const el = document.querySelector(`[aria-label="${selector.ariaLabel}"]`) ||
               document.querySelector(`[aria-label*="${selector.ariaLabel}"]`);
    if (el) return el;
  }
  
  // Try fallback selectors
  for (const fallback of (selector.fallbacks || [])) {
    try {
      const el = document.querySelector(fallback);
      if (el) return el;
    } catch (e) { /* invalid selector */ }
  }
  
  return null;
}

// Expose injection system to window for external control
if (typeof window !== 'undefined') {
  window.__IAI_INJECTION__ = IAI_INJECTION;
  window.__IAI_LOAD_PATTERN__ = loadInjectionPattern;
  window.__IAI_CLEAR_CACHE__ = clearInjectionCache;
  // Legacy aliases
  window.__IAI_INJECT_TRAINING__ = (data) => {
    console.warn('[IAI] __IAI_INJECT_TRAINING__ is deprecated, use injection API instead');
    return false;
  };
  window.__IAI_TRAINING__ = IAI_INJECTION;
}

/**
 * Clear cached injection pattern - forces fresh load from server
 */
async function clearInjectionCache() {
  console.log('[IAI] 🧹 Clearing injection cache...');
  try {
    await chrome.storage?.local?.remove('iaiInjection');
    IAI_INJECTION = {
      _loaded: false,
      _patternId: null,
      _patternName: null,
      _patternVersion: null,
      _containerId: null,
      _containerName: null,
      _loadedAt: null,
      WORKFLOW: [],
      FIELD_SELECTORS: {},
      TIMING: { averageDelay: 500, recommendedDelay: 400 },
      METADATA: {},
    };
    IAI_TRAINING = IAI_INJECTION;
    console.log('[IAI] ✅ Injection cache cleared');
    return true;
  } catch (e) {
    console.error('[IAI] Failed to clear cache:', e);
    return false;
  }
}

/**
 * Report IAI metrics to server for analytics
 */
async function reportIAIMetric(eventType, data) {
  try {
    const token = await getAuthToken();
    // Flatten data into the request body for server compatibility
    await fetch(`${IAI_CONFIG.API.PRODUCTION}/iai/metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        eventType,
        // Spread the data directly so server gets patternId, containerId, etc. at top level
        ...data,
        source: 'extension',
        extensionVersion: '3.4.0',
        timestamp: data.timestamp || new Date().toISOString(),
      }),
    });
    console.log(`[IAI] 📊 Metric reported: ${eventType}`);
  } catch (e) {
    console.debug('[IAI] Metric report failed:', e.message);
  }
}

/**
 * Get auth token from storage
 */
async function getAuthToken() {
  try {
    const result = await chrome.storage?.local?.get('authToken');
    return result?.authToken || null;
  } catch (e) {
    return null;
  }
}

// Load injection pattern on initialization (but don't use cache)
loadInjectionPattern().catch(console.debug);

// ============================================
// CORE HELPER FUNCTIONS (Competitor-Proven)
// ============================================

/**
 * C(tagName, exactText) - The competitor's simple element finder
 * Finds element by tag name with exact innerText match
 * This is PROVEN to work reliably on Facebook
 */
function C(tagName, text) {
  try {
    const elements = Array.from(document.querySelectorAll(tagName));
    return elements.find(el => el instanceof HTMLElement && el.innerText?.trim() === text) || null;
  } catch (e) {
    console.error('[IAI] Error in C():', e);
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
      console.log(`[IAI] Closing ${openDropdowns.length} open dropdown(s)...`);
      document.body.click();
      await new Promise(r => setTimeout(r, delay));
    }
  } catch (e) {
    console.debug('[IAI] Error closing dropdowns:', e);
  }
}

/**
 * Wait for user-configurable delay (like competitor's waitUserDelay)
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
    // Ignore - no custom delay configured
  }
}

/**
 * Find dropdown panel using aria-controls (like competitor)
 */
function findDropdownPanelByAriaControls(labelElement) {
  try {
    const ariaControls = labelElement.getAttribute('aria-controls');
    if (ariaControls) {
      return document.getElementById(ariaControls);
    }
  } catch (e) {
    console.debug('[IAI] Error finding dropdown panel:', e);
  }
  return null;
}

/**
 * Check if dropdown is expanded
 */
function isDropdownExpanded(element) {
  return element?.getAttribute('aria-expanded') === 'true';
}

/**
 * Match option text with cascading strategies (like competitor)
 * 1. Exact match
 * 2. Case-insensitive match  
 * 3. No-spaces match
 */
function matchOptionText(optionText, searchValue) {
  if (!optionText || !searchValue) return false;
  
  const opt = optionText.trim();
  const search = searchValue.trim();
  
  // Strategy 1: Exact match
  if (opt === search) return true;
  
  // Strategy 2: Case-insensitive
  if (opt.toLowerCase() === search.toLowerCase()) return true;
  
  // Strategy 3: No-spaces match
  if (opt.toLowerCase().replace(/\s+/g, '') === search.toLowerCase().replace(/\s+/g, '')) return true;
  
  return false;
}

/**
 * Clean string utility (like competitor's x() function)
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
    // Special cases that should not be title-cased
    const preserveCase = ['SRT', 'MINI', 'CODA', 'BMW', 'GMC', 'Land Rover', 'KTM', 'MV Agusta', 'CFMoto'];
    if (preserveCase.includes(make)) return make;
    
    // Title case for others
    return make.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  } catch (e) {
    return make || 'Toyota';
  }
}

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
    // Add occasional longer pause (thinking time) - 12% like competitor
    const thinkPause = Math.random() < IAI_CONFIG.HUMAN.TYPING.LONG_PAUSE_PROBABILITY
      ? this.randomInt(1000, 2000)
      : 0;
    await new Promise(r => setTimeout(r, baseDelay + thinkPause));
  }
  
  /**
   * Occasional long pause after action (like competitor)
   */
  async occasionalLongPause(probability = 0.08) {
    if (Math.random() < probability) {
      await new Promise(r => setTimeout(r, this.randomInt(1000, 2000)));
    }
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
   * Human-like click with FULL event sequence (like competitor)
   * Includes: pointerover, mouseover, pointerdown, mousedown, focus, pointerup, mouseup, click
   */
  async click(element) {
    await this.checkForBreak();
    
    // Perform human noise before clicking (like competitor)
    await this.performHumanNoise(element);
    
    // Scroll into view naturally
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.delay(200, 400);
    
    // Get element position with random offset within bounds (like competitor)
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
    
    // Full event sequence (like competitor)
    dispatchEvent('pointerover');
    await new Promise(r => setTimeout(r, this.randomInt(10, 40)));
    
    dispatchEvent('mouseover');
    await new Promise(r => setTimeout(r, this.randomInt(10, 40)));
    
    dispatchEvent('pointerdown');
    dispatchEvent('mousedown');
    await new Promise(r => setTimeout(r, this.randomInt(40, 120)));
    
    // Focus if needed
    if (element.focus) element.focus();
    await new Promise(r => setTimeout(r, this.randomInt(30, 90)));
    
    dispatchEvent('pointerup');
    dispatchEvent('mouseup');
    await new Promise(r => setTimeout(r, this.randomInt(20, 80)));
    
    dispatchEvent('click');
    
    // Human delay after click
    await this.delay(150, 600);
    
    // Occasional long pause after click (8% like competitor)
    await this.occasionalLongPause(0.08);
    
    await this.injectNoise();
  }
  
  /**
   * Perform human noise before action (like competitor)
   * Random scroll and mouse movements
   */
  async performHumanNoise(element) {
    try {
      // Random small scroll
      const scrollX = this.randomInt(-5, 5);
      const scrollY = this.randomInt(-30, 30);
      window.scrollBy({ left: scrollX, top: scrollY, behavior: 'auto' });
      
      // Random mouse movement
      const mouseX = Math.max(0, Math.min(window.innerWidth, 
        Math.floor(window.innerWidth / 2 + this.randomInt(-120, 120))));
      const mouseY = Math.max(0, Math.min(window.innerHeight,
        Math.floor(window.innerHeight / 2 + this.randomInt(-120, 120))));
      
      const moves = this.randomInt(1, 3);
      for (let i = 0; i < moves; i++) {
        const moveEvent = new MouseEvent('mousemove', {
          bubbles: true,
          clientX: mouseX + this.randomInt(-8, 8),
          clientY: mouseY + this.randomInt(-8, 8),
        });
        (element || document.body).dispatchEvent(moveEvent);
        await new Promise(r => setTimeout(r, this.randomInt(20, 60)));
      }
    } catch (e) {
      // Ignore noise errors
    }
  }
  
  /**
   * Human-like click with full event sequence (original preserved for compatibility)
   */
  async clickOriginal(element) {
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
   * Human-like typing with typos, corrections, and variable speed
   * Enhanced with competitor patterns
   */
  async type(element, text, options = {}) {
    await this.checkForBreak();
    
    // Options for different typing speeds
    const minDelay = options.minDelay || IAI_CONFIG.HUMAN.TYPING.MIN_DELAY;
    const maxDelay = options.maxDelay || IAI_CONFIG.HUMAN.TYPING.MAX_DELAY;
    const longPauseProbability = options.longPauseProbability || IAI_CONFIG.HUMAN.TYPING.LONG_PAUSE_PROBABILITY;
    
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
      
      // Occasional typo and correction (competitor pattern)
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
      let delay = this.randomInt(minDelay, maxDelay);
      
      // Longer pause after punctuation or space
      if (['.', ',', '!', '?', ' '].includes(char)) {
        delay += this.randomInt(50, 200);
      }
      
      // Occasional long pause (like competitor: every 7-14 chars)
      if (i > 0 && i % this.randomInt(7, 14) === 0 && Math.random() < longPauseProbability) {
        delay += this.randomInt(1000, 2000);
      }
      
      await this.delay(delay, delay + 20);
    }
    
    // Trigger final events
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    
    // Wait for user delay if configured
    await waitUserDelay();
    
    await this.injectNoise();
  }
  
  /**
   * Fast typing for dropdown selections (like competitor: 10-28ms)
   */
  async typeFast(element, text) {
    return this.type(element, text, {
      minDelay: IAI_CONFIG.HUMAN.TYPING.DROPDOWN_MIN_DELAY,
      maxDelay: IAI_CONFIG.HUMAN.TYPING.DROPDOWN_MAX_DELAY,
      longPauseProbability: 0.03
    });
  }
  
  /**
   * Fast typing for descriptions (like competitor: 6-18ms)
   */
  async typeDescription(element, text) {
    return this.type(element, text, {
      minDelay: IAI_CONFIG.HUMAN.TYPING.DESC_MIN_DELAY,
      maxDelay: IAI_CONFIG.HUMAN.TYPING.DESC_MAX_DELAY,
      longPauseProbability: 0.02
    });
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
   * Create a new vehicle listing using INJECTED PATTERNS ONLY
   * No hardcoded workflow - patterns must be loaded from injection system
   */
  async createListing(vehicleData, images = []) {
    console.log('🚗 Creating vehicle listing with injection system:', vehicleData);
    
    // CRITICAL: Load injection pattern if not loaded
    if (!IAI_INJECTION._loaded) {
      console.log('[IAI] 🔄 Loading injection pattern before listing...');
      const loaded = await loadInjectionPattern();
      if (!loaded) {
        console.error('[IAI] ❌ Cannot create listing - no injection pattern available');
        return { 
          success: false, 
          error: 'No injection pattern loaded',
          message: 'IAI requires an injected pattern to operate. Please configure a pattern in the admin panel.'
        };
      }
    }
    
    // Log pattern info
    console.log(`[IAI] 📦 Using pattern: ${IAI_INJECTION._patternName} v${IAI_INJECTION._patternVersion}`);
    console.log(`[IAI] 📋 Workflow steps: ${IAI_INJECTION.WORKFLOW.length}`);
    
    // Navigate to create listing page
    await this.navigator.navigateTo('create_listing');
    await this.stealth.delay(2000, 3000);
    
    // Execute injected workflow - this is the ONLY way to fill forms
    const workflowResult = await executeInjectedWorkflow(vehicleData);
    
    if (!workflowResult.success && workflowResult.errors.length > 0) {
      console.warn('[IAI] Workflow completed with errors:', workflowResult.errors);
    }
    
    // Upload images after form is filled
    if (images.length > 0) {
      await this.uploadImages(images);
    }
    
    console.log(`✅ Listing workflow complete: ${workflowResult.stepsExecuted}/${workflowResult.stepsTotal} steps`);
    return {
      success: workflowResult.success,
      stepsExecuted: workflowResult.stepsExecuted,
      stepsTotal: workflowResult.stepsTotal,
      errors: workflowResult.errors,
      patternUsed: IAI_INJECTION._patternName,
      patternVersion: IAI_INJECTION._patternVersion,
    };
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
    
    // Extract fbmLogId for tracking if present
    const fbmLogId = task.data?.fbmLogId || null;
    
    try {
      await this.updateTaskStatus(task.id, 'processing', null, fbmLogId);
      
      // Report stage change to FBM log
      if (fbmLogId) {
        await this.reportFBMEvent(fbmLogId, 'stage_change', 'extension_received', 'Task received by extension');
      }
      
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
          
        case 'POST_TO_MARKETPLACE':
        case 'create_listing':
          // Report navigation stage
          if (fbmLogId) {
            await this.reportFBMEvent(fbmLogId, 'stage_change', 'fb_navigated', 'Navigating to Facebook Marketplace');
          }
          
          result = await this.lister.createListing(task.data.vehicle, task.data.images || task.data.vehicle?.photos);
          
          // Report completion stage
          if (fbmLogId && result?.success) {
            await this.reportFBMEvent(fbmLogId, 'stage_change', 'submit', 'Listing form submitted', result);
          }
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
      
      await this.updateTaskStatus(task.id, 'completed', result, fbmLogId);
      
    } catch (error) {
      console.error('Task execution failed:', error);
      
      // Report error to FBM log
      if (fbmLogId) {
        await this.reportFBMEvent(fbmLogId, 'error', 'form_filling', `Task failed: ${error.message}`, { 
          stack: error.stack,
          taskType: task.type,
        });
      }
      
      await this.updateTaskStatus(task.id, 'failed', { error: error.message }, fbmLogId);
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
  async updateTaskStatus(taskId, status, result = null, fbmLogId = null) {
    try {
      await fetch(`${IAI_CONFIG.API.PRODUCTION}/extension/tasks/${taskId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({ status, result }),
      });
      
      // Also update FBM Post Log if we have a log ID
      if (fbmLogId) {
        await this.updateFBMLog(fbmLogId, status, result);
      }
    } catch (e) {
      console.debug('Failed to update task status:', e);
    }
  }
  
  /**
   * Update FBM Post Log for tracking/debugging
   */
  async updateFBMLog(logId, status, result = null) {
    try {
      const statusMap = {
        'processing': 'processing',
        'completed': 'completed',
        'failed': 'failed',
        'pending': 'queued',
      };
      
      const stageMap = {
        'processing': 'extension_received',
        'completed': 'verify',
        'failed': 'form_filling',
      };
      
      const payload = {
        status: statusMap[status] || status,
        stage: stageMap[status] || 'processing',
        source: 'extension',
      };
      
      if (result) {
        if (result.error) {
          payload.errorCode = 'IAI_ERROR';
          payload.errorMessage = result.error;
          payload.errorDetails = result;
        } else {
          payload.responseData = result;
          if (result.postId || result.fbPostId) {
            payload.fbPostId = result.postId || result.fbPostId;
          }
        }
      }
      
      await fetch(`${IAI_CONFIG.API.PRODUCTION}/fbm-posts/internal/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({ logId, ...payload }),
      });
      
      console.debug('FBM log updated:', logId, payload);
    } catch (e) {
      console.debug('Failed to update FBM log:', e);
    }
  }
  
  /**
   * Report FBM stage progress event
   */
  async reportFBMEvent(logId, eventType, stage, message, details = null) {
    try {
      await fetch(`${IAI_CONFIG.API.PRODUCTION}/fbm-posts/internal/event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          logId,
          eventType,  // stage_change, error, warning, info, debug
          stage,
          message,
          details,
          source: 'extension',
        }),
      });
    } catch (e) {
      console.debug('Failed to report FBM event:', e);
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
// MESSAGE HANDLERS FOR SIDEPANEL INTEGRATION
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'IAI_FILL_LISTING':
          // FIXED: Use injection system ONLY - NO HARDCODED FALLBACK
          console.log('[IAI] 🚗 IAI_FILL_LISTING received');
          
          // Clear any stale cached patterns first
          await chrome.storage?.local?.remove('iaiInjection');
          IAI_INJECTION._loaded = false;
          
          // Load fresh injection pattern from server
          console.log('[IAI] 🔄 Loading fresh injection pattern from server...');
          const loaded = await loadInjectionPattern();
          
          if (!loaded || !IAI_INJECTION._loaded || !IAI_INJECTION.WORKFLOW?.length) {
            console.error('[IAI] ❌ NO INJECTION PATTERN AVAILABLE - CANNOT PROCEED');
            console.error('[IAI] ❌ Please configure a pattern in IAI Command Center first');
            
            // Report failure to server
            await reportIAIMetric('pattern_load_failed', {
              error: 'No injection pattern available',
              timestamp: new Date().toISOString(),
            });
            
            sendResponse({
              success: false,
              error: 'No injection pattern available. Please configure a pattern in IAI Command Center.',
              requiresPattern: true,
            });
            break;
          }
          
          // Use injection workflow ONLY
          console.log(`[IAI] ✅ Using pattern: ${IAI_INJECTION._patternName} v${IAI_INJECTION._patternVersion}`);
          console.log(`[IAI] 📋 Workflow steps: ${IAI_INJECTION.WORKFLOW.length}`);
          
          // Report pattern execution start
          await reportIAIMetric('pattern_execution_start', {
            patternId: IAI_INJECTION._patternId,
            patternName: IAI_INJECTION._patternName,
            patternVersion: IAI_INJECTION._patternVersion,
            containerId: IAI_INJECTION._containerId,
            containerName: IAI_INJECTION._containerName,
            workflowSteps: IAI_INJECTION.WORKFLOW.length,
            vehicleData: message.vehicle,
            timestamp: new Date().toISOString(),
          });
          
          const workflowResult = await executeInjectedWorkflow(message.vehicle);
          
          // Report pattern execution result
          await reportIAIMetric('pattern_execution_complete', {
            patternId: IAI_INJECTION._patternId,
            patternName: IAI_INJECTION._patternName,
            patternVersion: IAI_INJECTION._patternVersion,
            containerId: IAI_INJECTION._containerId,
            containerName: IAI_INJECTION._containerName,
            success: workflowResult.success,
            stepsExecuted: workflowResult.stepsExecuted,
            stepsTotal: workflowResult.stepsTotal,
            errors: workflowResult.errors,
            duration: workflowResult.duration || 0,
            timestamp: new Date().toISOString(),
          });
          
          sendResponse({
            success: workflowResult.success,
            filledFields: workflowResult.completed.map(s => s.field),
            failedFields: workflowResult.errors.map(e => e.action),
            stepsExecuted: workflowResult.stepsExecuted,
            stepsTotal: workflowResult.stepsTotal,
            patternUsed: IAI_INJECTION._patternName,
            patternVersion: IAI_INJECTION._patternVersion,
          });
          break;
          
        case 'IAI_UPLOAD_IMAGES':
          const uploadResult = await uploadVehicleImages(message.images);
          sendResponse({ success: uploadResult.uploaded > 0, result: uploadResult });
          break;
          
        case 'IAI_PUBLISH_LISTING':
          const publishResult = await publishListing();
          sendResponse({ success: publishResult.clicked, result: publishResult });
          break;
          
        case 'IAI_GET_STATUS':
          sendResponse({ 
            success: true, 
            active: window.iaiSoldier?.isActive || false,
            page: detectCurrentPage(),
            url: window.location.href,
            tabType: detectPageTabType(),
            // Include injection status
            injection: {
              loaded: IAI_INJECTION._loaded,
              patternName: IAI_INJECTION._patternName,
              patternVersion: IAI_INJECTION._patternVersion,
              workflowSteps: IAI_INJECTION.WORKFLOW?.length || 0,
              containerName: IAI_INJECTION._containerName,
              loadedAt: IAI_INJECTION._loadedAt,
            },
          });
          break;
        
        case 'IAI_RELOAD_PATTERN':
          // Force reload injection pattern (clears cache first)
          console.log('[IAI] 🔄 Force reloading injection pattern...');
          await clearInjectionCache();
          const reloaded = await loadInjectionPattern();
          sendResponse({
            success: reloaded,
            patternName: IAI_INJECTION._patternName,
            patternVersion: IAI_INJECTION._patternVersion,
            workflowSteps: IAI_INJECTION.WORKFLOW?.length || 0,
          });
          break;
        
        case 'IAI_CLEAR_CACHE':
          // Clear all cached patterns
          console.log('[IAI] 🧹 Clearing all IAI cache...');
          const cleared = await clearInjectionCache();
          sendResponse({ success: cleared });
          break;
        
        // ============================================
        // TRAINING STEP EXECUTION
        // ============================================
        
        case 'EXECUTE_TRAINING_STEP':
          const stepResult = await executeTrainingStep(message.step);
          sendResponse(stepResult);
          break;
          
        case 'GET_TAB_TYPE':
          sendResponse({
            success: true,
            tabType: detectPageTabType(),
            url: window.location.href,
          });
          break;
          
        case 'EXECUTE_CLICK':
          const clickResult = await executeRecordedClick(message);
          sendResponse(clickResult);
          break;
          
        case 'EXECUTE_TYPE':
          const typeResult = await executeRecordedType(message);
          sendResponse(typeResult);
          break;
          
        case 'EXECUTE_SCROLL':
          const scrollResult = await executeRecordedScroll(message);
          sendResponse(scrollResult);
          break;
          
        default:
          // Let other handlers process
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('IAI message handler error:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  
  return true; // Keep message channel open for async response
});

/**
 * Detect page tab type
 */
function detectPageTabType() {
  const url = window.location.href.toLowerCase();
  
  if (url.includes('/marketplace/create')) return 'marketplace-create';
  if (url.includes('/marketplace/item')) return 'marketplace-item';
  if (url.includes('/marketplace')) return 'marketplace';
  if (url.includes('/messages')) return 'messages';
  if (url.includes('/groups')) return 'groups';
  if (url.includes('/profile')) return 'profile';
  
  return 'facebook-other';
}

/**
 * Execute a training step (from recorded session)
 */
async function executeTrainingStep(step) {
  const stealth = new IAIStealth();
  
  try {
    console.log(`[IAI Training] Executing step: ${step.action || step.type}`, step);
    
    switch (step.action || step.type) {
      case 'click':
        return await executeRecordedClick(step);
        
      case 'type':
      case 'typing':
        return await executeRecordedType(step);
        
      case 'scroll':
        return await executeRecordedScroll(step);
        
      case 'focus':
        return await executeRecordedFocus(step);
        
      case 'select':
        return await executeRecordedSelect(step);
        
      case 'wait':
        await stealth.delay(step.duration || 1000, (step.duration || 1000) + 500);
        return { success: true, action: 'wait' };
        
      case 'navigate':
        window.location.href = step.url;
        return { success: true, action: 'navigate', url: step.url };
        
      default:
        console.warn(`[IAI Training] Unknown action type: ${step.action || step.type}`);
        return { success: false, error: `Unknown action: ${step.action || step.type}` };
    }
  } catch (error) {
    console.error('[IAI Training] Step execution error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Execute a recorded click action
 */
async function executeRecordedClick(step) {
  const stealth = new IAIStealth();
  const element = findElementByRecordedData(step.element || step);
  
  if (!element) {
    return { success: false, error: 'Element not found', selectors: step.element?.selectors };
  }
  
  // Scroll element into view
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await stealth.delay(200, 400);
  
  // Execute click with human-like behavior
  await stealth.click(element);
  
  return { success: true, action: 'click', element: element.tagName };
}

/**
 * Execute a recorded type action
 */
async function executeRecordedType(step) {
  const stealth = new IAIStealth();
  const element = findElementByRecordedData(step.element || step);
  
  if (!element) {
    return { success: false, error: 'Element not found' };
  }
  
  // Focus the element
  element.focus();
  await stealth.delay(100, 200);
  
  // Get the text to type (use value from training data or placeholder)
  const text = step.value || step.text || step.exampleValue || '';
  
  if (!text) {
    return { success: false, error: 'No text to type' };
  }
  
  // Type with human-like delays
  await stealth.typeWithHumanBehavior(element, text);
  
  return { success: true, action: 'type', length: text.length };
}

/**
 * Execute a recorded scroll action
 */
async function executeRecordedScroll(step) {
  const stealth = new IAIStealth();
  
  const scrollTo = step.scrollPosition || step.position || {};
  
  window.scrollTo({
    top: scrollTo.scrollTop || scrollTo.y || 0,
    left: scrollTo.scrollLeft || scrollTo.x || 0,
    behavior: 'smooth',
  });
  
  await stealth.delay(300, 500);
  
  return { success: true, action: 'scroll', position: scrollTo };
}

/**
 * Execute a recorded focus action
 */
async function executeRecordedFocus(step) {
  const element = findElementByRecordedData(step.element || step);
  
  if (!element) {
    return { success: false, error: 'Element not found' };
  }
  
  element.focus();
  
  return { success: true, action: 'focus' };
}

/**
 * Execute a recorded select action (dropdown)
 */
async function executeRecordedSelect(step) {
  const stealth = new IAIStealth();
  
  // If fieldType is specified, use the enhanced dropdown selection
  if (step.fieldType) {
    const value = step.value || step.selectedValue;
    const success = await selectFacebookDropdownEnhancedV2(step.fieldType, value, stealth);
    return { success, action: 'select', fieldType: step.fieldType };
  }
  
  // Otherwise try to find and click the dropdown then the option
  const dropdown = findElementByRecordedData(step.element || step.dropdown);
  
  if (!dropdown) {
    return { success: false, error: 'Dropdown not found' };
  }
  
  await stealth.click(dropdown);
  await stealth.delay(500, 800);
  
  // Find and click the option
  const optionText = step.value || step.optionText;
  const option = findElementByText(optionText, ['span', 'div', '[role="option"]']);
  
  if (option) {
    await stealth.click(option);
    return { success: true, action: 'select', value: optionText };
  }
  
  return { success: false, error: 'Option not found' };
}

/**
 * Find element using recorded selector data
 * Tries multiple strategies from the recorded selectors
 */
function findElementByRecordedData(elementData) {
  if (!elementData) return null;
  
  // Strategy 1: Try selectors array
  const selectors = elementData.selectors;
  if (selectors) {
    const selectorList = Array.isArray(selectors) ? selectors : [selectors];
    
    for (const selector of selectorList) {
      try {
        const element = document.querySelector(selector);
        if (element && isVisible(element)) {
          return element;
        }
      } catch (e) {
        // Invalid selector, try next
      }
    }
  }
  
  // Strategy 2: Try by aria-label
  if (elementData.ariaLabel) {
    const element = document.querySelector(`[aria-label="${CSS.escape(elementData.ariaLabel)}"]`);
    if (element && isVisible(element)) {
      return element;
    }
  }
  
  // Strategy 3: Try by role
  if (elementData.role) {
    const elements = document.querySelectorAll(`[role="${elementData.role}"]`);
    for (const el of elements) {
      if (isVisible(el) && elementMatchesText(el, elementData.textContent)) {
        return el;
      }
    }
  }
  
  // Strategy 4: Try by text content
  if (elementData.textContent) {
    const element = findElementByText(elementData.textContent, ['button', 'span', 'div', 'label', 'a']);
    if (element) {
      return element;
    }
  }
  
  // Strategy 5: Try by data-testid
  if (elementData.dataAttributes?.['data-testid']) {
    const element = document.querySelector(`[data-testid="${elementData.dataAttributes['data-testid']}"]`);
    if (element && isVisible(element)) {
      return element;
    }
  }
  
  return null;
}

/**
 * Check if element matches expected text
 */
function elementMatchesText(element, text) {
  if (!text || !element) return true; // If no text to match, consider it a match
  
  const elementText = (element.textContent || element.innerText || '').trim().toLowerCase();
  const searchText = text.trim().toLowerCase();
  
  return elementText.includes(searchText) || searchText.includes(elementText);
}

/**
 * Find element by text content
 */
function findElementByText(text, tagNames = ['span', 'div', 'button', 'label']) {
  if (!text) return null;
  
  const searchText = text.trim().toLowerCase();
  
  for (const tagName of tagNames) {
    const elements = document.querySelectorAll(tagName);
    for (const el of elements) {
      const elText = (el.textContent || el.innerText || '').trim().toLowerCase();
      if (elText === searchText || elText.includes(searchText)) {
        if (isVisible(el)) {
          return el;
        }
      }
    }
  }
  
  return null;
}

/**
 * Check if element is visible
 */
function isVisible(element) {
  if (!element) return false;
  
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    rect.width > 0 &&
    rect.height > 0
  );
}

/**
 * Enhanced vehicle listing fill with ALL competitor patterns:
 * - Close open dropdowns before opening new ones
 * - Use C(tag, text) for element finding
 * - Use aria-controls for dropdown panels
 * - Cascading match strategy (exact → case-insensitive → no-spaces)
 * - Hardcoded fallback values
 * - Try-catch per field with continuation
 * - Different field flow for Car/Truck vs Motorcycle
 */
async function fillVehicleListingEnhanced(vehicle) {
  console.log('🚗 [IAI Enhanced] Starting vehicle listing fill:', vehicle);
  
  const stealth = new IAIStealth();
  const filledFields = [];
  const failedFields = [];
  const errors = [];
  const steps = [];
  
  // Wait for page to be ready
  await stealth.delay(1000, 1500);
  
  // Determine vehicle category for conditional field flow
  const vehicleCategory = getVehicleTypeFromData(vehicle);
  console.log(`[IAI] Vehicle category: ${vehicleCategory}`);
  
  // === STEP 1: VEHICLE TYPE (MUST BE FIRST - like competitor) ===
  console.log('📋 Step 1: Selecting vehicle type...');
  try {
    await closeOpenDropdowns();
    
    const vehicleTypeLabel = C('label', 'Vehicle type');
    if (vehicleTypeLabel) {
      await stealth.click(vehicleTypeLabel);
      await stealth.delay(500, 800);
      
      const vehicleTypeOption = C('span', cleanString(vehicleCategory)) || C('span', 'Car/Truck');
      if (vehicleTypeOption) {
        await stealth.click(vehicleTypeOption);
        filledFields.push('vehicleType');
        steps.push({ field: 'vehicleType', success: true, value: vehicleCategory });
        console.log(`✅ Vehicle type selected: ${vehicleCategory}`);
      } else {
        // Fallback - try 'Other'
        const fallbackOption = C('span', 'Other');
        if (fallbackOption) {
          await stealth.click(fallbackOption);
          filledFields.push('vehicleType');
          steps.push({ field: 'vehicleType', success: true, value: 'Other (fallback)' });
        } else {
          failedFields.push('vehicleType');
          steps.push({ field: 'vehicleType', success: false });
        }
      }
    } else {
      // Try enhanced dropdown selection as fallback
      if (await selectFacebookDropdownEnhancedV2('Vehicle type', vehicleCategory, stealth)) {
        filledFields.push('vehicleType');
        steps.push({ field: 'vehicleType', success: true });
      } else {
        failedFields.push('vehicleType');
        steps.push({ field: 'vehicleType', success: false });
        errors.push('Could not find vehicle type dropdown');
      }
    }
    await waitUserDelay();
  } catch (e) {
    console.error('[IAI] Error selecting vehicle type:', e);
    failedFields.push('vehicleType');
    steps.push({ field: 'vehicleType', success: false, error: e.message });
  }
  
  await stealth.delay(800, 1200);
  
  // === STEP 2: YEAR (Dropdown) ===
  console.log('📋 Step 2: Selecting year...');
  try {
    await closeOpenDropdowns();
    
    const yearLabel = C('label', 'Year');
    const yearValue = String(vehicle.year || '').trim() || IAI_CONFIG.FALLBACKS.YEAR;
    
    if (yearLabel) {
      await stealth.click(yearLabel);
      await stealth.delay(500, 800);
      
      const yearOption = C('span', cleanString(yearValue)) || C('span', IAI_CONFIG.FALLBACKS.YEAR);
      if (yearOption) {
        await stealth.click(yearOption);
        filledFields.push('year');
        steps.push({ field: 'year', success: true, value: yearValue });
        console.log(`✅ Year selected: ${yearValue}`);
      } else {
        failedFields.push('year');
        steps.push({ field: 'year', success: false });
      }
    } else if (await selectFacebookDropdownEnhancedV2('Year', yearValue, stealth)) {
      filledFields.push('year');
      steps.push({ field: 'year', success: true });
    } else {
      failedFields.push('year');
      steps.push({ field: 'year', success: false });
    }
    await waitUserDelay();
  } catch (e) {
    console.error('[IAI] Error selecting year:', e);
    failedFields.push('year');
    steps.push({ field: 'year', success: false, error: e.message });
  }
  
  await stealth.delay(600, 1000);
  
  // === STEP 3: MAKE (Conditional on vehicle type - like competitor) ===
  console.log('📋 Step 3: Selecting make...');
  try {
    await closeOpenDropdowns();
    
    const makeValue = processMakeName(vehicle.make) || IAI_CONFIG.FALLBACKS.MAKE;
    const makeLabel = C('label', 'Make');
    
    if (vehicleCategory === 'Car/Truck' || vehicleCategory === 'Motorcycle') {
      // Dropdown selection for Car/Truck and Motorcycle
      if (makeLabel) {
        await stealth.click(makeLabel);
        await stealth.delay(500, 800);
        
        // Try to find make option with cascading match
        let makeOption = findOptionWithCascadingMatch(makeValue);
        
        if (makeOption) {
          await stealth.click(makeOption);
          filledFields.push('make');
          steps.push({ field: 'make', success: true, value: makeValue });
          console.log(`✅ Make selected: ${makeValue}`);
        } else {
          // Try fallback
          const fallbackMake = C('span', IAI_CONFIG.FALLBACKS.MAKE);
          if (fallbackMake) {
            console.warn(`[IAI] Make '${makeValue}' not found, using fallback '${IAI_CONFIG.FALLBACKS.MAKE}'`);
            await stealth.click(fallbackMake);
            filledFields.push('make');
            steps.push({ field: 'make', success: true, value: IAI_CONFIG.FALLBACKS.MAKE + ' (fallback)' });
          } else {
            failedFields.push('make');
            steps.push({ field: 'make', success: false });
          }
        }
      } else if (await selectFacebookDropdownEnhancedV2('Make', makeValue, stealth)) {
        filledFields.push('make');
        steps.push({ field: 'make', success: true });
      } else {
        failedFields.push('make');
        steps.push({ field: 'make', success: false });
      }
    } else {
      // Text input for other vehicle types (like competitor)
      if (makeLabel) {
        await stealth.typeFast(makeLabel, cleanString(makeValue) || 'n/a');
        filledFields.push('make');
        steps.push({ field: 'make', success: true, value: makeValue });
      } else if (await fillFacebookInputEnhancedV2('Make', makeValue, stealth)) {
        filledFields.push('make');
        steps.push({ field: 'make', success: true });
      } else {
        failedFields.push('make');
        steps.push({ field: 'make', success: false });
      }
    }
    await waitUserDelay();
  } catch (e) {
    console.error('[IAI] Error selecting make:', e);
    failedFields.push('make');
    steps.push({ field: 'make', success: false, error: e.message });
  }
  
  await stealth.delay(600, 1000);
  
  // === STEP 4: VEHICLE CONDITION (Car/Truck only - like competitor) ===
  if (vehicleCategory === 'Car/Truck') {
    console.log('📋 Step 4: Selecting vehicle condition...');
    try {
      await closeOpenDropdowns();
      
      const conditionLabel = C('label', 'Vehicle condition');
      if (conditionLabel) {
        await stealth.click(conditionLabel);
        await stealth.delay(500, 800);
        
        const conditionOption = C('span', vehicle.condition || IAI_CONFIG.FALLBACKS.CONDITION);
        if (conditionOption) {
          await stealth.click(conditionOption);
          filledFields.push('condition');
          steps.push({ field: 'condition', success: true });
          console.log('✅ Condition selected');
        }
      }
      await waitUserDelay();
    } catch (e) {
      console.error('[IAI] Error selecting condition:', e);
    }
    
    await stealth.delay(300, 500);
  }
  
  // === STEP 5: MILEAGE ===
  console.log('📋 Step 5: Entering mileage...');
  try {
    const mileageValue = String(vehicle.mileage || '0').replace(/,/g, '').replace(/[^0-9]/g, '');
    const mileageLabel = C('label', 'Mileage');
    
    if (mileageLabel) {
      await stealth.typeFast(mileageLabel, cleanString(mileageValue) || '0');
      filledFields.push('mileage');
      steps.push({ field: 'mileage', success: true, value: mileageValue });
      console.log(`✅ Mileage entered: ${mileageValue}`);
    } else if (await fillFacebookInputEnhancedV2('Mileage', mileageValue, stealth)) {
      filledFields.push('mileage');
      steps.push({ field: 'mileage', success: true });
    } else {
      failedFields.push('mileage');
      steps.push({ field: 'mileage', success: false });
    }
    await waitUserDelay();
  } catch (e) {
    console.error('[IAI] Error entering mileage:', e);
    failedFields.push('mileage');
    steps.push({ field: 'mileage', success: false, error: e.message });
  }
  
  await stealth.delay(300, 500);
  
  // === STEP 6: EXTERIOR COLOR (Car/Truck - like competitor) ===
  if (vehicleCategory === 'Car/Truck' || vehicleCategory === 'Motorcycle') {
    console.log('📋 Step 6: Selecting exterior color...');
    try {
      await closeOpenDropdowns();
      
      const colorValue = vehicle.exteriorColor || vehicle.color || IAI_CONFIG.FALLBACKS.EXTERIOR_COLOR;
      const colorLabel = C('label', 'Exterior color');
      
      if (colorLabel) {
        await stealth.click(colorLabel);
        await stealth.delay(500, 800);
        
        let colorOption = findOptionWithCascadingMatch(colorValue);
        if (colorOption) {
          await stealth.click(colorOption);
          filledFields.push('exteriorColor');
          steps.push({ field: 'exteriorColor', success: true, value: colorValue });
          console.log(`✅ Exterior color selected: ${colorValue}`);
        } else {
          // Fallback to Black
          const fallbackColor = C('span', IAI_CONFIG.FALLBACKS.EXTERIOR_COLOR);
          if (fallbackColor) {
            await stealth.click(fallbackColor);
            filledFields.push('exteriorColor');
            steps.push({ field: 'exteriorColor', success: true, value: IAI_CONFIG.FALLBACKS.EXTERIOR_COLOR + ' (fallback)' });
          }
        }
      }
      await waitUserDelay();
    } catch (e) {
      console.error('[IAI] Error selecting exterior color:', e);
    }
    
    await stealth.delay(300, 500);
  }
  
  // === STEP 7: BODY STYLE (Car/Truck only - like competitor) ===
  if (vehicleCategory === 'Car/Truck') {
    console.log('📋 Step 7: Selecting body style...');
    try {
      await closeOpenDropdowns();
      
      const bodyStyleValue = vehicle.bodyStyle || vehicle.bodyType || IAI_CONFIG.FALLBACKS.BODY_STYLE;
      const bodyStyleLabel = C('label', 'Body style');
      
      if (bodyStyleLabel) {
        await stealth.click(bodyStyleLabel);
        await stealth.delay(500, 800);
        
        let bodyOption = findOptionWithCascadingMatch(bodyStyleValue);
        if (bodyOption) {
          await stealth.click(bodyOption);
          filledFields.push('bodyStyle');
          steps.push({ field: 'bodyStyle', success: true });
        } else {
          const fallbackBody = C('span', IAI_CONFIG.FALLBACKS.BODY_STYLE);
          if (fallbackBody) {
            await stealth.click(fallbackBody);
            filledFields.push('bodyStyle');
          }
        }
      }
      await waitUserDelay();
    } catch (e) {
      console.error('[IAI] Error selecting body style:', e);
    }
    
    await stealth.delay(300, 500);
  }
  
  // === STEP 8: FUEL TYPE ===
  console.log('📋 Step 8: Selecting fuel type...');
  try {
    await closeOpenDropdowns();
    
    const fuelValue = vehicle.fuelType || IAI_CONFIG.FALLBACKS.FUEL_TYPE;
    const fuelLabel = C('label', 'Fuel type');
    
    if (fuelLabel) {
      await stealth.click(fuelLabel);
      await stealth.delay(500, 800);
      
      let fuelOption = findOptionWithCascadingMatch(fuelValue);
      if (fuelOption) {
        await stealth.click(fuelOption);
        filledFields.push('fuelType');
        steps.push({ field: 'fuelType', success: true });
      } else {
        const fallbackFuel = C('span', IAI_CONFIG.FALLBACKS.FUEL_TYPE);
        if (fallbackFuel) {
          await stealth.click(fallbackFuel);
          filledFields.push('fuelType');
        }
      }
    }
    await waitUserDelay();
  } catch (e) {
    console.error('[IAI] Error selecting fuel type:', e);
  }
  
  await stealth.delay(300, 500);
  
  // === STEP 9: INTERIOR COLOR (Car/Truck only - like competitor) ===
  if (vehicleCategory === 'Car/Truck') {
    console.log('📋 Step 9: Selecting interior color...');
    try {
      await closeOpenDropdowns();
      
      const intColorValue = vehicle.interiorColor || IAI_CONFIG.FALLBACKS.INTERIOR_COLOR;
      const intColorLabel = C('label', 'Interior color');
      
      if (intColorLabel) {
        await stealth.click(intColorLabel);
        await stealth.delay(500, 800);
        
        let intColorOption = findOptionWithCascadingMatch(intColorValue);
        if (intColorOption) {
          await stealth.click(intColorOption);
          filledFields.push('interiorColor');
          steps.push({ field: 'interiorColor', success: true });
        } else {
          const fallbackIntColor = C('span', IAI_CONFIG.FALLBACKS.INTERIOR_COLOR);
          if (fallbackIntColor) {
            await stealth.click(fallbackIntColor);
            filledFields.push('interiorColor');
          }
        }
      }
      await waitUserDelay();
    } catch (e) {
      console.error('[IAI] Error selecting interior color:', e);
    }
    
    await stealth.delay(300, 500);
  }
  
  // === STEP 10: MODEL (Entered after other dropdowns - like competitor) ===
  console.log('📋 Step 10: Entering model...');
  try {
    await closeOpenDropdowns();
    
    // Build model string like competitor: Model + Trim + Emoji
    let modelValue = vehicle.model || '';
    if (vehicle.trim) modelValue += ` ${vehicle.trim}`;
    
    const modelLabel = C('label', 'Model');
    if (modelLabel) {
      await stealth.typeFast(modelLabel, cleanString(modelValue) || 'n/a');
      filledFields.push('model');
      steps.push({ field: 'model', success: true, value: modelValue });
      console.log(`✅ Model entered: ${modelValue}`);
    } else if (await fillFacebookInputEnhancedV2('Model', modelValue, stealth)) {
      filledFields.push('model');
      steps.push({ field: 'model', success: true });
    } else {
      failedFields.push('model');
      steps.push({ field: 'model', success: false });
    }
    await waitUserDelay();
  } catch (e) {
    console.error('[IAI] Error entering model:', e);
    failedFields.push('model');
    steps.push({ field: 'model', success: false, error: e.message });
  }
  
  await stealth.delay(300, 500);
  
  // === STEP 11: PRICE ===
  console.log('📋 Step 11: Entering price...');
  try {
    const priceValue = String(vehicle.price || '').replace(/[^0-9]/g, '');
    const priceLabel = C('label', 'Price');
    
    if (priceLabel) {
      await stealth.typeFast(priceLabel, cleanString(priceValue) || '0');
      filledFields.push('price');
      steps.push({ field: 'price', success: true, value: priceValue });
      console.log(`✅ Price entered: ${priceValue}`);
    } else if (await fillFacebookInputEnhancedV2('Price', priceValue, stealth)) {
      filledFields.push('price');
      steps.push({ field: 'price', success: true });
    } else {
      failedFields.push('price');
      steps.push({ field: 'price', success: false });
      errors.push('Could not fill price field');
    }
    await waitUserDelay();
  } catch (e) {
    console.error('[IAI] Error entering price:', e);
    failedFields.push('price');
    steps.push({ field: 'price', success: false, error: e.message });
  }
  
  await stealth.delay(300, 500);
  
  // === STEP 12: DESCRIPTION (Last - like competitor) ===
  console.log('📋 Step 12: Entering description...');
  try {
    const description = vehicle.description || generateVehicleDescriptionIAI(vehicle);
    const descLabel = C('label', 'Description');
    
    if (descLabel) {
      await stealth.typeDescription(descLabel, cleanString(description));
      filledFields.push('description');
      steps.push({ field: 'description', success: true });
      console.log('✅ Description entered');
    } else if (await fillDescriptionEnhancedV2(description, stealth)) {
      filledFields.push('description');
      steps.push({ field: 'description', success: true });
    } else {
      failedFields.push('description');
      steps.push({ field: 'description', success: false });
      errors.push('Could not fill description field');
    }
    await waitUserDelay();
  } catch (e) {
    console.error('[IAI] Error entering description:', e);
    failedFields.push('description');
    steps.push({ field: 'description', success: false, error: e.message });
  }
  
  // === RESULT ANALYSIS ===
  const criticalFields = ['vehicleType', 'year', 'make', 'model', 'price'];
  const criticalFailed = failedFields.filter(f => criticalFields.includes(f));
  const isSuccess = criticalFailed.length <= 1 && filledFields.length >= 4;
  
  console.log(`📝 [IAI Enhanced] Form fill complete:
    - Filled: ${filledFields.length} (${filledFields.join(', ')})
    - Failed: ${failedFields.length} (${failedFields.join(', ') || 'none'})
    - Critical Failed: ${criticalFailed.join(', ') || 'none'}
    - Success: ${isSuccess}`);
  
  return { 
    success: isSuccess, 
    filledFields, 
    failedFields, 
    errors, 
    steps,
    vehicleCategory
  };
}

/**
 * Find option with cascading match strategy (like competitor)
 */
function findOptionWithCascadingMatch(value) {
  if (!value) return null;
  
  const searchValue = String(value).trim();
  
  // Strategy 1: Exact match with C()
  let option = C('span', searchValue);
  if (option) return option;
  
  // Strategy 2: Case-insensitive search in all spans
  const allSpans = document.querySelectorAll('span');
  for (const span of allSpans) {
    if (matchOptionText(span.textContent, searchValue)) {
      return span;
    }
  }
  
  // Strategy 3: Search in role="option" elements
  const options = document.querySelectorAll('[role="option"], [role="menuitem"]');
  for (const opt of options) {
    if (matchOptionText(opt.textContent, searchValue)) {
      return opt;
    }
  }
  
  return null;
}

/**
 * Enhanced dropdown selection V2 with aria-controls (like competitor)
 */
async function selectFacebookDropdownEnhancedV2(labelText, value, stealth) {
  console.log(`🔽 [IAI V2] Selecting dropdown "${labelText}" = "${value}"`);
  
  try {
    // CRITICAL: Close any open dropdowns first (like competitor)
    await closeOpenDropdowns();
    
    // Find the dropdown label
    const label = C('label', labelText);
    if (!label) {
      console.warn(`❌ Dropdown label "${labelText}" not found`);
      return false;
    }
    
    console.log(`[IAI V2] Found label for "${labelText}", clicking...`);
    await stealth.click(label);
    
    // Wait and poll for dropdown to open (like competitor: 10 attempts, 200ms each)
    let dropdownPanel = null;
    let dropdownFound = false;
    let ariaControlsId = null;
    
    for (let attempt = 0; attempt < IAI_CONFIG.HUMAN.TIMING.DROPDOWN_MAX_ATTEMPTS; attempt++) {
      await new Promise(r => setTimeout(r, IAI_CONFIG.HUMAN.TIMING.DROPDOWN_WAIT));
      
      // Check if label is now expanded
      const expanded = isDropdownExpanded(label);
      
      // Get aria-controls ID (like competitor)
      if (expanded && !ariaControlsId) {
        ariaControlsId = label.getAttribute('aria-controls');
        console.log(`[IAI V2] Label expanded, aria-controls: ${ariaControlsId}`);
      }
      
      // Find dropdown panel by aria-controls ID
      if (ariaControlsId) {
        dropdownPanel = document.getElementById(ariaControlsId);
        if (dropdownPanel) {
          dropdownFound = true;
          console.log(`[IAI V2] Dropdown panel found by aria-controls at attempt ${attempt + 1}`);
          break;
        }
      }
      
      // Fallback: Find by role="listbox" or role="menu" near label
      const container = label.closest('form') || label.parentElement?.parentElement;
      if (container) {
        const listbox = container.querySelector('[role="listbox"], [role="menu"]');
        if (listbox && listbox.querySelectorAll('span').length > 0) {
          dropdownPanel = listbox;
          dropdownFound = true;
          console.log(`[IAI V2] Dropdown panel found near label at attempt ${attempt + 1}`);
          break;
        }
      }
      
      // Global fallback
      if (!dropdownPanel) {
        const globalListbox = document.querySelector('[role="listbox"], [role="menu"]');
        if (globalListbox) {
          dropdownPanel = globalListbox;
          dropdownFound = true;
          console.warn(`[IAI V2] Found generic dropdown at attempt ${attempt + 1}`);
          break;
        }
      }
      
      if (attempt === 4) {
        console.log(`[IAI V2] Still waiting for dropdown (attempt 5/10)...`);
      }
    }
    
    if (!dropdownFound) {
      console.warn(`[IAI V2] Dropdown for "${labelText}" may not have opened, continuing anyway...`);
    }
    
    // Search for option with cascading match
    const searchValue = String(value).trim();
    let targetOption = null;
    
    if (dropdownPanel) {
      const spans = dropdownPanel.querySelectorAll('span');
      console.log(`[IAI V2] Available options in dropdown:`, Array.from(spans).slice(0, 10).map(s => s.textContent?.trim()));
      
      // Exact match
      targetOption = Array.from(spans).find(s => s.textContent?.trim() === searchValue);
      
      // Case-insensitive
      if (!targetOption) {
        targetOption = Array.from(spans).find(s => 
          s.textContent?.trim().toLowerCase() === searchValue.toLowerCase()
        );
      }
      
      // No-spaces match
      if (!targetOption) {
        targetOption = Array.from(spans).find(s => 
          s.textContent?.trim().toLowerCase().replace(/\s+/g, '') === 
          searchValue.toLowerCase().replace(/\s+/g, '')
        );
      }
    }
    
    // Fallback: Search entire document
    if (!targetOption) {
      console.log(`[IAI V2] Option not found in dropdown, searching document...`);
      targetOption = C('span', searchValue);
      
      if (!targetOption) {
        const allSpans = document.querySelectorAll('span');
        targetOption = Array.from(allSpans).find(s => 
          s.textContent?.trim().toLowerCase() === searchValue.toLowerCase()
        );
      }
    }
    
    if (targetOption) {
      console.log(`[IAI V2] Option found: "${targetOption.textContent?.trim()}", clicking...`);
      await stealth.click(targetOption);
      await stealth.delay(300, 500);
      console.log(`✅ [IAI V2] Selected "${value}" for "${labelText}"`);
      return true;
    }
    
    // Try fallback value if applicable
    const fallbackValue = getFallbackValue(labelText);
    if (fallbackValue && fallbackValue !== value) {
      console.warn(`[IAI V2] Option '${value}' not found, trying fallback '${fallbackValue}'`);
      const fallbackOption = C('span', fallbackValue);
      if (fallbackOption) {
        await stealth.click(fallbackOption);
        await stealth.delay(300, 500);
        console.log(`✅ [IAI V2] Selected fallback "${fallbackValue}" for "${labelText}"`);
        return true;
      }
    }
    
    // Close dropdown if nothing selected
    document.body.click();
    await stealth.delay(200, 300);
    console.warn(`❌ [IAI V2] Could not select option for "${labelText}"`);
    return false;
    
  } catch (e) {
    console.error(`❌ [IAI V2] Error selecting dropdown "${labelText}":`, e);
    return false;
  }
}

/**
 * Get fallback value for a field (like competitor)
 */
function getFallbackValue(labelText) {
  const lower = labelText.toLowerCase();
  if (lower.includes('make')) return IAI_CONFIG.FALLBACKS.MAKE;
  if (lower.includes('exterior')) return IAI_CONFIG.FALLBACKS.EXTERIOR_COLOR;
  if (lower.includes('interior')) return IAI_CONFIG.FALLBACKS.INTERIOR_COLOR;
  if (lower.includes('body')) return IAI_CONFIG.FALLBACKS.BODY_STYLE;
  if (lower.includes('fuel')) return IAI_CONFIG.FALLBACKS.FUEL_TYPE;
  if (lower.includes('condition')) return IAI_CONFIG.FALLBACKS.CONDITION;
  if (lower.includes('vehicle type')) return IAI_CONFIG.FALLBACKS.VEHICLE_TYPE;
  if (lower.includes('year')) return IAI_CONFIG.FALLBACKS.YEAR;
  return null;
}

/**
 * Enhanced input fill V2 (like competitor's humanTypeText)
 */
async function fillFacebookInputEnhancedV2(labelText, value, stealth) {
  console.log(`📝 [IAI V2] Filling input "${labelText}" = "${value}"`);
  
  try {
    // Find input using C() pattern or aria-label
    let input = document.querySelector(`input[aria-label*="${labelText}" i]`);
    
    if (!input) {
      input = document.querySelector(`input[placeholder*="${labelText}" i]`);
    }
    
    if (!input) {
      // Find by nearby label (like competitor)
      const labels = document.querySelectorAll('label, span, div');
      for (const label of labels) {
        if (label.textContent?.toLowerCase().includes(labelText.toLowerCase())) {
          const container = label.closest('div[data-visualcompletion]') || label.parentElement;
          if (container) {
            input = container.querySelector('input:not([type="hidden"]):not([type="checkbox"])');
            if (input && isVisible(input)) break;
          }
        }
      }
    }
    
    if (!input || !isVisible(input)) {
      console.warn(`❌ [IAI V2] Input "${labelText}" not found`);
      return false;
    }
    
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await stealth.delay(200, 400);
    
    await stealth.click(input);
    await stealth.delay(100, 200);
    
    // Clear and type (like competitor)
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    
    await stealth.typeFast(input, value);
    
    input.blur();
    await stealth.delay(100, 200);
    
    console.log(`✅ [IAI V2] Filled input "${labelText}"`);
    return true;
    
  } catch (e) {
    console.error(`❌ [IAI V2] Error filling input "${labelText}":`, e);
    return false;
  }
}

/**
 * Enhanced description fill V2
 */
async function fillDescriptionEnhancedV2(description, stealth) {
  try {
    let textarea = document.querySelector('textarea[aria-label*="Description" i]');
    if (!textarea) textarea = document.querySelector('textarea');
    if (!textarea) textarea = document.querySelector('[contenteditable="true"][aria-label*="Description" i]');
    if (!textarea) textarea = document.querySelector('[role="textbox"][aria-multiline="true"]');
    
    if (!textarea) {
      const textareas = document.querySelectorAll('textarea, [contenteditable="true"]');
      for (const ta of textareas) {
        if (isVisible(ta)) {
          textarea = ta;
          break;
        }
      }
    }
    
    if (!textarea) {
      console.warn('❌ [IAI V2] Description textarea not found');
      return false;
    }
    
    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await stealth.delay(300, 500);
    
    await stealth.click(textarea);
    await stealth.delay(100, 200);
    
    if (textarea.isContentEditable) {
      textarea.innerHTML = '';
      textarea.textContent = description;
      textarea.dispatchEvent(new InputEvent('input', { bubbles: true, data: description }));
    } else {
      textarea.value = '';
      await stealth.typeDescription(textarea, description);
    }
    
    textarea.blur();
    console.log('✅ [IAI V2] Description filled');
    return true;
    
  } catch (e) {
    console.error('❌ [IAI V2] Error filling description:', e);
    return false;
  }
}

/**
 * Get vehicle type from data
 */
function getVehicleTypeFromData(vehicle) {
  const bodyType = (vehicle.bodyType || vehicle.bodyStyle || '').toLowerCase();
  if (bodyType.includes('motorcycle')) return 'Motorcycle';
  if (bodyType.includes('rv') || bodyType.includes('camper')) return 'RV/Camper';
  if (bodyType.includes('trailer')) return 'Trailer';
  if (bodyType.includes('boat')) return 'Boat';
  if (bodyType.includes('powersport') || bodyType.includes('atv')) return 'Powersport';
  return 'Car/Truck';
}

/**
 * Select a Facebook dropdown - enhanced version
 */
async function selectFacebookDropdownEnhanced(labelText, value, stealth) {
  console.log(`🔽 Selecting dropdown "${labelText}" = "${value}"`);
  
  try {
    // Find the dropdown by looking for the label text
    const lowerLabel = labelText.toLowerCase();
    let dropdownButton = null;
    
    // Strategy 1: Find by aria-label containing the label text
    dropdownButton = document.querySelector(`[aria-label*="${labelText}" i][role="combobox"], [aria-label*="${labelText}" i][aria-haspopup]`);
    
    // Strategy 2: Find label text and look for adjacent dropdown
    if (!dropdownButton) {
      const allElements = document.querySelectorAll('span, div, label');
      for (const el of allElements) {
        const text = el.textContent?.trim().toLowerCase();
        if (text === lowerLabel || text?.includes(lowerLabel)) {
          // Look upward for a clickable container
          let parent = el.parentElement;
          for (let i = 0; i < 6 && parent; i++) {
            if (parent.getAttribute('aria-haspopup') || 
                parent.getAttribute('aria-expanded') !== null ||
                parent.querySelector('[aria-haspopup]') ||
                parent.querySelector('svg')) {
              const clickable = parent.querySelector('[role="button"], [tabindex="0"]') || parent;
              if (isVisible(clickable)) {
                dropdownButton = clickable;
                break;
              }
            }
            parent = parent.parentElement;
          }
          if (dropdownButton) break;
        }
      }
    }
    
    if (!dropdownButton || !isVisible(dropdownButton)) {
      console.warn(`❌ Dropdown "${labelText}" not found`);
      return false;
    }
    
    // Click to open dropdown
    dropdownButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await stealth.delay(300, 500);
    await stealth.click(dropdownButton);
    await stealth.delay(600, 1000);
    
    // Wait for options and select
    const searchValue = value.toLowerCase().trim();
    
    for (let attempt = 0; attempt < 12; attempt++) {
      await stealth.delay(150, 250);
      
      // Look for options
      const options = document.querySelectorAll('[role="option"], [role="menuitem"], [role="listbox"] [role="option"]');
      
      for (const option of options) {
        if (!isVisible(option)) continue;
        const optionText = option.textContent?.trim().toLowerCase();
        
        if (optionText === searchValue || optionText?.includes(searchValue) || searchValue.includes(optionText)) {
          await stealth.click(option);
          await stealth.delay(300, 500);
          console.log(`✅ Selected "${value}" for "${labelText}"`);
          return true;
        }
      }
      
      // Also check for plain divs
      const allDivs = document.querySelectorAll('div[tabindex="-1"], span[tabindex="-1"]');
      for (const div of allDivs) {
        if (!isVisible(div)) continue;
        const text = div.textContent?.trim().toLowerCase();
        if (text === searchValue || text?.includes(searchValue)) {
          const parent = div.closest('[role="listbox"], [role="menu"], [aria-expanded="true"], [data-visualcompletion="ignore-dynamic"]');
          if (parent) {
            await stealth.click(div);
            await stealth.delay(300, 500);
            console.log(`✅ Selected "${value}" for "${labelText}"`);
            return true;
          }
        }
      }
    }
    
    // Close dropdown if option not found
    document.body.click();
    await stealth.delay(200, 300);
    console.warn(`❌ Option "${value}" not found for "${labelText}"`);
    return false;
  } catch (e) {
    console.error(`❌ Error selecting dropdown "${labelText}":`, e);
    return false;
  }
}

/**
 * Fill a Facebook input field - enhanced version
 */
async function fillFacebookInputEnhanced(labelText, value, stealth) {
  console.log(`📝 Filling input "${labelText}" = "${value}"`);
  
  try {
    let input = document.querySelector(`input[aria-label*="${labelText}" i]`);
    
    if (!input) {
      input = document.querySelector(`input[placeholder*="${labelText}" i]`);
    }
    
    if (!input) {
      // Find by nearby label
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
    
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await stealth.delay(200, 400);
    
    await stealth.click(input);
    await stealth.delay(100, 200);
    
    // Clear and type
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await stealth.type(input, value);
    
    input.blur();
    await stealth.delay(100, 200);
    
    console.log(`✅ Filled input "${labelText}"`);
    return true;
  } catch (e) {
    console.error(`❌ Error filling input "${labelText}":`, e);
    return false;
  }
}

/**
 * Fill description textarea - enhanced version
 */
async function fillDescriptionEnhanced(description, stealth) {
  try {
    let textarea = document.querySelector('textarea[aria-label*="Description" i]');
    if (!textarea) textarea = document.querySelector('textarea');
    if (!textarea) textarea = document.querySelector('[contenteditable="true"][aria-label*="Description" i]');
    if (!textarea) textarea = document.querySelector('[role="textbox"][aria-multiline="true"]');
    
    if (!textarea) {
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
    await stealth.delay(300, 500);
    
    await stealth.click(textarea);
    await stealth.delay(100, 200);
    
    if (textarea.isContentEditable) {
      textarea.innerHTML = '';
      textarea.textContent = description;
      textarea.dispatchEvent(new InputEvent('input', { bubbles: true, data: description }));
    } else {
      textarea.value = '';
      await stealth.type(textarea, description);
    }
    
    textarea.blur();
    return true;
  } catch (e) {
    console.error('❌ Error filling description:', e);
    return false;
  }
}

/**
 * Generate vehicle description
 */
function generateVehicleDescriptionIAI(vehicle) {
  const parts = [];
  parts.push(`🚗 ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''}`);
  parts.push('');
  if (vehicle.mileage) parts.push(`📍 Mileage: ${Number(vehicle.mileage).toLocaleString()} miles`);
  if (vehicle.exteriorColor || vehicle.color) parts.push(`🎨 Color: ${vehicle.exteriorColor || vehicle.color}`);
  if (vehicle.transmission) parts.push(`⚙️ Transmission: ${vehicle.transmission}`);
  if (vehicle.fuelType) parts.push(`⛽ Fuel: ${vehicle.fuelType}`);
  parts.push('');
  parts.push('✅ Financing Available');
  parts.push('✅ Trade-ins Welcome');
  parts.push('');
  parts.push('📞 Contact us for more information!');
  return parts.join('\n');
}

/**
 * Fill vehicle listing form on Facebook Marketplace (Legacy)
 */
async function fillVehicleListing(vehicle) {
  console.log('🚗 IAI Filling vehicle listing:', vehicle);
  
  const stealth = new IAIStealth();
  const steps = [];
  
  // Wait for page to be ready
  await stealth.delay(1500, 2500);
  
  // Helper to find and fill input
  async function fillField(selectors, value, fieldName) {
    if (!value) return false;
    
    for (const selector of selectors) {
      try {
        let element = null;
        
        if (typeof selector === 'function') {
          element = selector();
        } else {
          element = document.querySelector(selector);
        }
        
        if (element && isVisible(element)) {
          await stealth.click(element);
          await stealth.delay(200, 400);
          
          // Clear existing value
          element.value = '';
          element.dispatchEvent(new Event('input', { bubbles: true }));
          
          // Type new value
          await stealth.type(element, String(value));
          
          steps.push({ field: fieldName, success: true });
          console.log(`✅ Filled ${fieldName}:`, value);
          return true;
        }
      } catch (e) {
        console.debug(`Selector failed for ${fieldName}:`, e);
      }
    }
    
    steps.push({ field: fieldName, success: false });
    console.warn(`⚠️ Could not fill ${fieldName}`);
    return false;
  }
  
  // Helper to select dropdown option
  async function selectOption(buttonSelectors, optionValue, fieldName) {
    if (!optionValue) return false;
    
    for (const selector of buttonSelectors) {
      try {
        const button = document.querySelector(selector);
        if (button && isVisible(button)) {
          await stealth.click(button);
          await stealth.delay(500, 800);
          
          // Find option in dropdown
          const options = document.querySelectorAll('[role="option"], [role="listbox"] [role="option"], [role="menuitem"]');
          for (const opt of options) {
            if (opt.textContent?.toLowerCase().includes(optionValue.toLowerCase())) {
              await stealth.click(opt);
              steps.push({ field: fieldName, success: true });
              console.log(`✅ Selected ${fieldName}:`, optionValue);
              return true;
            }
          }
          
          // Try typing to search
          const searchInput = document.querySelector('[role="combobox"], [role="listbox"] input');
          if (searchInput) {
            await stealth.type(searchInput, optionValue);
            await stealth.delay(500, 800);
            
            const firstOption = document.querySelector('[role="option"]');
            if (firstOption) {
              await stealth.click(firstOption);
              steps.push({ field: fieldName, success: true });
              return true;
            }
          }
        }
      } catch (e) {
        console.debug(`Selector failed for ${fieldName}:`, e);
      }
    }
    
    steps.push({ field: fieldName, success: false });
    return false;
  }
  
  // Fill the form fields
  // Year
  await selectOption(
    ['[aria-label*="Year" i]', '[aria-label*="año" i]', 'label[id*="year"] + div'],
    vehicle.year,
    'year'
  );
  await stealth.delay(300, 600);
  
  // Make
  await selectOption(
    ['[aria-label*="Make" i]', '[aria-label*="marca" i]', 'label[id*="make"] + div'],
    vehicle.make,
    'make'
  );
  await stealth.delay(300, 600);
  
  // Model
  await selectOption(
    ['[aria-label*="Model" i]', '[aria-label*="modelo" i]', 'label[id*="model"] + div'],
    vehicle.model,
    'model'
  );
  await stealth.delay(300, 600);
  
  // Price
  await fillField(
    ['[aria-label*="Price" i]', '[aria-label*="precio" i]', 'input[name="price"]', 'input[placeholder*="price" i]'],
    vehicle.price,
    'price'
  );
  await stealth.delay(300, 600);
  
  // Mileage
  await fillField(
    ['[aria-label*="Mileage" i]', '[aria-label*="kilometraje" i]', 'input[name="mileage"]', 'input[placeholder*="mileage" i]'],
    vehicle.mileage,
    'mileage'
  );
  await stealth.delay(300, 600);
  
  // Description
  await fillField(
    ['[aria-label*="Description" i]', '[aria-label*="descripción" i]', 'textarea', '[contenteditable="true"]'],
    vehicle.description,
    'description'
  );
  await stealth.delay(300, 600);
  
  // Vehicle Type (if available)
  if (vehicle.bodyType) {
    await selectOption(
      ['[aria-label*="Vehicle type" i]', '[aria-label*="Body" i]'],
      vehicle.bodyType,
      'vehicleType'
    );
    await stealth.delay(300, 600);
  }
  
  // Transmission
  if (vehicle.transmission) {
    await selectOption(
      ['[aria-label*="Transmission" i]', '[aria-label*="transmisión" i]'],
      vehicle.transmission,
      'transmission'
    );
    await stealth.delay(300, 600);
  }
  
  // Fuel Type
  if (vehicle.fuelType) {
    await selectOption(
      ['[aria-label*="Fuel" i]', '[aria-label*="combustible" i]'],
      vehicle.fuelType,
      'fuelType'
    );
    await stealth.delay(300, 600);
  }
  
  // Exterior Color
  if (vehicle.exteriorColor) {
    await selectOption(
      ['[aria-label*="Exterior color" i]', '[aria-label*="color exterior" i]'],
      vehicle.exteriorColor,
      'exteriorColor'
    );
    await stealth.delay(300, 600);
  }
  
  console.log('✅ Form filling complete. Steps:', steps);
  return { success: true, steps };
}

/**
 * Upload images to the listing
 */
async function uploadVehicleImages(imageUrls) {
  console.log('📷 IAI Uploading images:', imageUrls.length);
  
  const stealth = new IAIStealth();
  
  // Find file input
  const fileInput = document.querySelector('input[type="file"][accept*="image"]');
  
  if (!fileInput) {
    // Try clicking add photo button first
    const addPhotoBtn = document.querySelector('[aria-label*="Add photo" i], [aria-label*="photo" i]');
    if (addPhotoBtn) {
      await stealth.click(addPhotoBtn);
      await stealth.delay(500, 1000);
    }
    
    // Check again for file input
    const newFileInput = document.querySelector('input[type="file"][accept*="image"]');
    if (!newFileInput) {
      console.error('Could not find file input');
      return { success: false, error: 'File input not found' };
    }
  }
  
  const input = document.querySelector('input[type="file"][accept*="image"]');
  
  // Fetch and convert images
  const files = [];
  for (let i = 0; i < Math.min(imageUrls.length, 10); i++) {
    try {
      const response = await fetch(imageUrls[i]);
      const blob = await response.blob();
      const file = new File([blob], `vehicle_${i}.jpg`, { type: 'image/jpeg' });
      files.push(file);
    } catch (e) {
      console.warn(`Failed to fetch image ${i}:`, e);
    }
  }
  
  if (files.length === 0) {
    return { success: false, error: 'No images could be loaded' };
  }
  
  // Create DataTransfer and assign files
  const dataTransfer = new DataTransfer();
  files.forEach(f => dataTransfer.items.add(f));
  input.files = dataTransfer.files;
  
  // Dispatch change event
  input.dispatchEvent(new Event('change', { bubbles: true }));
  
  // Wait for upload
  await stealth.delay(2000, 4000);
  
  console.log(`✅ Uploaded ${files.length} images`);
  return { success: true, count: files.length };
}

/**
 * Click the publish/post button - Enhanced V2
 * IMPORTANT: Only clicks actual Publish/Post, NEVER "Next" button
 * Like competitor: Refuses to click Next - means form is incomplete
 */
async function publishListing() {
  console.log('📤 [IAI V2] Publishing listing...');
  
  const stealth = new IAIStealth();
  
  // Priority 1: Look for actual publish/post buttons using C() pattern
  const publishButtonTexts = ['Publish', 'Post', 'List item', 'List vehicle', 'Submit'];
  
  // Try C() pattern first (like competitor)
  for (const text of publishButtonTexts) {
    const button = C('span', text) || C('div', text);
    if (button && isVisible(button)) {
      const clickable = button.closest('[role="button"]') || button.closest('button') || button;
      console.log(`📤 [IAI V2] Found publish button: "${text}" - clicking`);
      await stealth.click(clickable);
      await stealth.delay(2000, 3000);
      console.log('✅ [IAI V2] Publish button clicked');
      return { success: true, clicked: true, buttonText: text };
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
    
    // "Next" is NOT clicked - form is incomplete if only Next is visible
    // This is like competitor behavior
  }
  
  if (bestButton) {
    const buttonText = bestButton.textContent?.trim();
    console.log(`📤 [IAI V2] Found publish button: "${buttonText}" - clicking`);
    await stealth.click(bestButton);
    await stealth.delay(2000, 3000);
    console.log('✅ [IAI V2] Publish button clicked');
    return { success: true, clicked: true, buttonText };
  }
  
  // Check if "Next" is visible - means form is incomplete (like competitor)
  const nextButton = C('span', 'Next') || C('div', 'Next');
  if (nextButton && isVisible(nextButton)) {
    console.warn('⚠️ [IAI V2] Only "Next" button found - form incomplete');
    return { 
      success: false, 
      clicked: false,
      error: 'Form incomplete - only Next button found',
      suggestion: 'Fill all required fields before publishing'
    };
  }
  
  console.warn('⚠️ [IAI V2] Publish button not found');
  return { success: false, clicked: false, error: 'Publish button not found' };
}

/**
 * Detect current page type
 */
function detectCurrentPage() {
  const url = window.location.href;
  
  if (url.includes('/marketplace/create')) return 'create_listing';
  if (url.includes('/marketplace/inbox')) return 'messages';
  if (url.includes('/marketplace/you/selling')) return 'my_listings';
  if (url.includes('/marketplace')) return 'marketplace';
  if (url.includes('facebook.com')) return 'facebook';
  
  return 'unknown';
}

/**
 * Check if element is visible
 */
function isVisible(element) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  
  return style.display !== 'none' &&
         style.visibility !== 'hidden' &&
         style.opacity !== '0' &&
         rect.width > 0 &&
         rect.height > 0;
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
