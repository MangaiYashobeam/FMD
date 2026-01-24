/**
 * FMD Training Recorder - DOM Interaction Tracker
 * 
 * Records EVERY user interaction for training the IAI and Soldier workers:
 * - Clicks (with Ctrl+Click for high-interest elements)
 * - Typing (keystrokes with timing)
 * - Scrolling (positions and timing)
 * - File uploads (image handling)
 * - Element selectors and attributes
 * - Timing between actions
 * - Page navigation
 * 
 * SUPER ADMIN ONLY - For training system updates
 */

(function() {
  'use strict';

  // ============================================
  // STATE
  // ============================================
  
  const RecorderState = {
    isRecording: false,
    sessionId: null,
    startTime: null,
    events: [],
    markedElements: [], // Ctrl+Click marked elements
    currentMode: 'listing', // 'listing' | 'messages' | 'navigation'
    metadata: {
      url: window.location.href,
      userAgent: navigator.userAgent,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      recordingType: 'iai' // 'iai' | 'soldier'
    }
  };

  // ============================================
  // CONFIGURATION
  // ============================================
  
  const CONFIG = {
    API_URL: 'https://dealersface.com/api',
    // API_URL: 'http://localhost:5000/api',
    MAX_EVENTS: 10000,
    DEBOUNCE_SCROLL: 100,
    DEBOUNCE_MOUSE: 50,
    CAPTURE_SCREENSHOTS: false,
    LOG_TO_CONSOLE: true,
  };

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  
  function generateId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  function getTimestamp() {
    return Date.now();
  }

  function getRelativeTime() {
    if (!RecorderState.startTime) return 0;
    return Date.now() - RecorderState.startTime;
  }

  function log(...args) {
    if (CONFIG.LOG_TO_CONSOLE) {
      console.log('[FMD Recorder]', ...args);
    }
  }

  /**
   * Generate a robust CSS selector for an element
   */
  function generateSelector(element) {
    if (!element || element === document) return null;
    
    const selectors = [];
    
    // Strategy 1: ID (most reliable)
    if (element.id) {
      return `#${CSS.escape(element.id)}`;
    }
    
    // Strategy 2: aria-label (Facebook uses these heavily)
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      selectors.push(`[aria-label="${CSS.escape(ariaLabel)}"]`);
    }
    
    // Strategy 3: data attributes
    const dataTestId = element.getAttribute('data-testid');
    if (dataTestId) {
      selectors.push(`[data-testid="${CSS.escape(dataTestId)}"]`);
    }
    
    // Strategy 4: role + text content
    const role = element.getAttribute('role');
    if (role) {
      selectors.push(`[role="${role}"]`);
    }
    
    // Strategy 5: Tag + classes (fallback)
    const tag = element.tagName.toLowerCase();
    const classes = Array.from(element.classList).slice(0, 3).join('.');
    if (classes) {
      selectors.push(`${tag}.${classes}`);
    }
    
    // Strategy 6: Build path from parent
    const path = [];
    let current = element;
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        selector = `#${CSS.escape(current.id)}`;
        path.unshift(selector);
        break;
      }
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }
      path.unshift(selector);
      current = parent;
      if (path.length > 5) break;
    }
    
    selectors.push(path.join(' > '));
    
    return selectors;
  }

  /**
   * Extract comprehensive element information
   */
  function extractElementInfo(element) {
    if (!element || element === document || element === window) {
      return null;
    }
    
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);
    
    return {
      // Basic info
      tagName: element.tagName?.toLowerCase(),
      id: element.id || null,
      className: element.className || null,
      
      // Accessibility attributes (critical for Facebook)
      ariaLabel: element.getAttribute('aria-label'),
      ariaHaspopup: element.getAttribute('aria-haspopup'),
      ariaExpanded: element.getAttribute('aria-expanded'),
      ariaControls: element.getAttribute('aria-controls'),
      role: element.getAttribute('role'),
      tabIndex: element.getAttribute('tabindex'),
      
      // Form-related
      name: element.name || null,
      type: element.type || null,
      placeholder: element.placeholder || null,
      value: element.value?.substring(0, 100) || null, // Truncate for privacy
      
      // Content
      textContent: element.textContent?.trim().substring(0, 200) || null,
      innerText: element.innerText?.trim().substring(0, 200) || null,
      
      // Position and size
      rect: {
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
      },
      
      // Visibility
      isVisible: rect.width > 0 && rect.height > 0 && computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden',
      
      // Data attributes
      dataAttributes: extractDataAttributes(element),
      
      // Selectors (multiple strategies)
      selectors: generateSelector(element),
      
      // Parent context
      parentInfo: extractParentContext(element),
      
      // Is this an input/editable element?
      isInput: ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName),
      isContentEditable: element.isContentEditable,
      
      // Is dropdown/listbox?
      isDropdown: element.getAttribute('aria-haspopup') === 'listbox' || 
                  element.getAttribute('role') === 'combobox' ||
                  element.getAttribute('aria-expanded') !== null,
    };
  }

  function extractDataAttributes(element) {
    const data = {};
    for (const attr of element.attributes) {
      if (attr.name.startsWith('data-')) {
        data[attr.name] = attr.value;
      }
    }
    return Object.keys(data).length > 0 ? data : null;
  }

  function extractParentContext(element, depth = 3) {
    const context = [];
    let current = element.parentElement;
    let i = 0;
    
    while (current && i < depth && current !== document.body) {
      context.push({
        tagName: current.tagName.toLowerCase(),
        role: current.getAttribute('role'),
        ariaLabel: current.getAttribute('aria-label'),
        className: current.className?.split(' ').slice(0, 3).join(' '),
      });
      current = current.parentElement;
      i++;
    }
    
    return context;
  }

  /**
   * Detect field type based on element and context
   */
  function detectFieldType(elementInfo) {
    const text = (elementInfo.textContent || elementInfo.ariaLabel || elementInfo.placeholder || '').toLowerCase();
    const parentText = elementInfo.parentInfo?.map(p => p.ariaLabel || '').join(' ').toLowerCase();
    
    const fieldPatterns = {
      vehicleType: /vehicle\s*type|car.*truck|motorcycle/i,
      year: /^year$|vehicle\s*year/i,
      make: /^make$|manufacturer/i,
      model: /^model$/i,
      trim: /^trim$|package/i,
      price: /^price$|asking\s*price/i,
      mileage: /mileage|odometer/i,
      bodyStyle: /body\s*style|body\s*type/i,
      exteriorColor: /exterior\s*color|color/i,
      interiorColor: /interior\s*color/i,
      transmission: /transmission/i,
      fuelType: /fuel\s*type|fuel/i,
      condition: /^condition$/i,
      description: /description|details/i,
      title: /^title$|listing\s*title/i,
      location: /location|city|zip/i,
      vin: /^vin$|vehicle\s*identification/i,
      photos: /photo|image|upload/i,
      publish: /publish|post|submit|list\s*item/i,
      next: /^next$/i,
    };
    
    const combined = `${text} ${parentText}`;
    
    for (const [field, pattern] of Object.entries(fieldPatterns)) {
      if (pattern.test(combined)) {
        return field;
      }
    }
    
    return null;
  }

  // ============================================
  // EVENT RECORDING
  // ============================================
  
  function recordEvent(type, data) {
    if (!RecorderState.isRecording) return;
    
    const event = {
      id: generateId(),
      type: type,
      timestamp: getTimestamp(),
      relativeTime: getRelativeTime(),
      url: window.location.href,
      ...data
    };
    
    RecorderState.events.push(event);
    
    // Limit events to prevent memory issues
    if (RecorderState.events.length > CONFIG.MAX_EVENTS) {
      RecorderState.events = RecorderState.events.slice(-CONFIG.MAX_EVENTS);
    }
    
    log(`Event recorded: ${type}`, event);
    
    // Send to background for live preview
    chrome.runtime.sendMessage({
      type: 'RECORDER_EVENT',
      event: event
    }).catch(() => {});
  }

  // ============================================
  // CLICK HANDLER
  // ============================================
  
  function handleClick(e) {
    if (!RecorderState.isRecording) return;
    
    const element = e.target;
    const elementInfo = extractElementInfo(element);
    const fieldType = detectFieldType(elementInfo);
    
    // Check if Ctrl+Click (mark as high-interest)
    const isMarked = e.ctrlKey || e.metaKey;
    
    if (isMarked) {
      // Mark this element as high-interest field
      RecorderState.markedElements.push({
        elementInfo,
        fieldType,
        timestamp: getTimestamp(),
        relativeTime: getRelativeTime(),
        markedAs: fieldType || 'unknown',
      });
      
      // Visual feedback
      showMarkedFeedback(element, fieldType);
    }
    
    recordEvent('click', {
      element: elementInfo,
      fieldType: fieldType,
      isMarked: isMarked,
      markedAs: isMarked ? (fieldType || 'unknown') : null,
      mousePosition: {
        clientX: e.clientX,
        clientY: e.clientY,
        pageX: e.pageX,
        pageY: e.pageY,
      },
      modifiers: {
        ctrl: e.ctrlKey,
        shift: e.shiftKey,
        alt: e.altKey,
        meta: e.metaKey,
      },
      button: e.button,
    });
  }

  function showMarkedFeedback(element, fieldType) {
    const overlay = document.createElement('div');
    overlay.className = 'fmd-recorder-marked';
    overlay.textContent = `✓ MARKED: ${fieldType || 'element'}`;
    
    const rect = element.getBoundingClientRect();
    overlay.style.cssText = `
      position: fixed;
      top: ${rect.top - 30}px;
      left: ${rect.left}px;
      background: #22c55e;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      z-index: 999999;
      pointer-events: none;
      animation: fadeOut 2s forwards;
    `;
    
    document.body.appendChild(overlay);
    
    // Highlight element temporarily
    const originalOutline = element.style.outline;
    element.style.outline = '3px solid #22c55e';
    
    setTimeout(() => {
      overlay.remove();
      element.style.outline = originalOutline;
    }, 2000);
  }

  // ============================================
  // KEYBOARD HANDLER
  // ============================================
  
  let keyBuffer = '';
  let keyBufferTimeout = null;
  let lastKeyTarget = null;

  function handleKeyDown(e) {
    if (!RecorderState.isRecording) return;
    
    // Special keys to record immediately
    const specialKeys = ['Enter', 'Tab', 'Escape', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    
    if (specialKeys.includes(e.key)) {
      recordEvent('keypress', {
        key: e.key,
        code: e.code,
        isSpecial: true,
        element: extractElementInfo(e.target),
        modifiers: {
          ctrl: e.ctrlKey,
          shift: e.shiftKey,
          alt: e.altKey,
          meta: e.metaKey,
        },
      });
      return;
    }
    
    // Buffer regular typing
    if (e.key.length === 1) {
      if (lastKeyTarget !== e.target) {
        // New target - flush previous buffer
        flushKeyBuffer();
        lastKeyTarget = e.target;
      }
      
      keyBuffer += e.key;
      
      clearTimeout(keyBufferTimeout);
      keyBufferTimeout = setTimeout(flushKeyBuffer, 500);
    }
  }

  function flushKeyBuffer() {
    if (keyBuffer && RecorderState.isRecording) {
      recordEvent('typing', {
        text: keyBuffer,
        element: extractElementInfo(lastKeyTarget),
        fieldType: lastKeyTarget ? detectFieldType(extractElementInfo(lastKeyTarget)) : null,
        textLength: keyBuffer.length,
      });
    }
    keyBuffer = '';
    lastKeyTarget = null;
  }

  // ============================================
  // INPUT CHANGE HANDLER
  // ============================================
  
  function handleInput(e) {
    if (!RecorderState.isRecording) return;
    
    const element = e.target;
    const elementInfo = extractElementInfo(element);
    
    recordEvent('input', {
      element: elementInfo,
      fieldType: detectFieldType(elementInfo),
      value: element.value?.substring(0, 200) || element.textContent?.substring(0, 200),
      inputType: e.inputType,
    });
  }

  function handleChange(e) {
    if (!RecorderState.isRecording) return;
    
    const element = e.target;
    const elementInfo = extractElementInfo(element);
    
    recordEvent('change', {
      element: elementInfo,
      fieldType: detectFieldType(elementInfo),
      value: element.value?.substring(0, 200) || '',
      selectedIndex: element.selectedIndex,
      selectedText: element.options?.[element.selectedIndex]?.text,
    });
  }

  // ============================================
  // SCROLL HANDLER
  // ============================================
  
  let scrollTimeout = null;
  let lastScrollPosition = { x: 0, y: 0 };

  function handleScroll(e) {
    if (!RecorderState.isRecording) return;
    
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const newPosition = {
        x: window.scrollX,
        y: window.scrollY,
      };
      
      const delta = {
        x: newPosition.x - lastScrollPosition.x,
        y: newPosition.y - lastScrollPosition.y,
      };
      
      recordEvent('scroll', {
        position: newPosition,
        delta: delta,
        viewportHeight: window.innerHeight,
        documentHeight: document.documentElement.scrollHeight,
      });
      
      lastScrollPosition = newPosition;
    }, CONFIG.DEBOUNCE_SCROLL);
  }

  // ============================================
  // FOCUS HANDLER
  // ============================================
  
  function handleFocus(e) {
    if (!RecorderState.isRecording) return;
    
    const elementInfo = extractElementInfo(e.target);
    
    recordEvent('focus', {
      element: elementInfo,
      fieldType: detectFieldType(elementInfo),
    });
  }

  function handleBlur(e) {
    if (!RecorderState.isRecording) return;
    
    flushKeyBuffer();
    
    const elementInfo = extractElementInfo(e.target);
    
    recordEvent('blur', {
      element: elementInfo,
      fieldType: detectFieldType(elementInfo),
      finalValue: e.target.value?.substring(0, 200) || e.target.textContent?.substring(0, 200),
    });
  }

  // ============================================
  // FILE UPLOAD HANDLER
  // ============================================
  
  function handleFileSelect(e) {
    if (!RecorderState.isRecording) return;
    
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const fileInfo = Array.from(files).map(f => ({
      name: f.name,
      size: f.size,
      type: f.type,
      lastModified: f.lastModified,
    }));
    
    recordEvent('fileUpload', {
      element: extractElementInfo(e.target),
      files: fileInfo,
      fileCount: files.length,
      totalSize: fileInfo.reduce((sum, f) => sum + f.size, 0),
    });
  }

  // ============================================
  // DRAG & DROP HANDLER
  // ============================================
  
  function handleDrop(e) {
    if (!RecorderState.isRecording) return;
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const fileInfo = Array.from(files).map(f => ({
        name: f.name,
        size: f.size,
        type: f.type,
      }));
      
      recordEvent('fileDrop', {
        element: extractElementInfo(e.target),
        files: fileInfo,
        fileCount: files.length,
        dropPosition: {
          clientX: e.clientX,
          clientY: e.clientY,
        },
      });
    }
  }

  // ============================================
  // MUTATION OBSERVER (DOM Changes)
  // ============================================
  
  let mutationObserver = null;
  let mutationTimeout = null;
  let pendingMutations = [];

  function setupMutationObserver() {
    mutationObserver = new MutationObserver((mutations) => {
      if (!RecorderState.isRecording) return;
      
      for (const mutation of mutations) {
        // Track added nodes (new elements appearing)
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const role = node.getAttribute?.('role');
              const ariaLabel = node.getAttribute?.('aria-label');
              
              // Track dropdown panels appearing
              if (role === 'listbox' || role === 'menu' || node.querySelector?.('[role="option"]')) {
                pendingMutations.push({
                  type: 'dropdown_opened',
                  element: extractElementInfo(node),
                  options: extractDropdownOptions(node),
                });
              }
              
              // Track dialogs/modals
              if (role === 'dialog' || ariaLabel?.includes('dialog')) {
                pendingMutations.push({
                  type: 'dialog_opened',
                  element: extractElementInfo(node),
                });
              }
            }
          }
        }
        
        // Track attribute changes (e.g., aria-expanded changing)
        if (mutation.type === 'attributes' && mutation.attributeName === 'aria-expanded') {
          pendingMutations.push({
            type: 'dropdown_toggle',
            element: extractElementInfo(mutation.target),
            expanded: mutation.target.getAttribute('aria-expanded') === 'true',
          });
        }
      }
      
      // Debounce mutation recording
      clearTimeout(mutationTimeout);
      mutationTimeout = setTimeout(flushMutations, 100);
    });
    
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-expanded', 'aria-hidden'],
    });
  }

  function flushMutations() {
    if (pendingMutations.length > 0 && RecorderState.isRecording) {
      for (const mutation of pendingMutations) {
        recordEvent('domChange', mutation);
      }
      pendingMutations = [];
    }
  }

  function extractDropdownOptions(container) {
    const options = container.querySelectorAll('[role="option"], [role="menuitem"], [tabindex="-1"]');
    return Array.from(options).slice(0, 20).map(opt => ({
      text: opt.textContent?.trim().substring(0, 100),
      ariaLabel: opt.getAttribute('aria-label'),
      selected: opt.getAttribute('aria-selected') === 'true',
    }));
  }

  // ============================================
  // URL CHANGE HANDLER
  // ============================================
  
  let lastUrl = window.location.href;

  function checkUrlChange() {
    if (window.location.href !== lastUrl) {
      const oldUrl = lastUrl;
      lastUrl = window.location.href;
      
      if (RecorderState.isRecording) {
        recordEvent('navigation', {
          fromUrl: oldUrl,
          toUrl: lastUrl,
          navigationType: detectNavigationType(lastUrl),
        });
      }
    }
  }

  function detectNavigationType(url) {
    if (url.includes('/marketplace/create')) return 'create_listing';
    if (url.includes('/marketplace/inbox')) return 'messages';
    if (url.includes('/marketplace/you/selling')) return 'my_listings';
    if (url.includes('/marketplace/item')) return 'view_listing';
    if (url.includes('/marketplace')) return 'marketplace_home';
    return 'other';
  }

  // ============================================
  // RECORDING CONTROL
  // ============================================
  
  function startRecording(options = {}) {
    if (RecorderState.isRecording) {
      log('Already recording');
      return;
    }
    
    RecorderState.isRecording = true;
    RecorderState.sessionId = `session_${Date.now()}`;
    RecorderState.startTime = Date.now();
    RecorderState.events = [];
    RecorderState.markedElements = [];
    RecorderState.currentMode = options.mode || 'listing';
    RecorderState.metadata.recordingType = options.recordingType || 'iai';
    RecorderState.metadata.url = window.location.href;
    
    // Add event listeners
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('change', handleChange, true);
    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('focus', handleFocus, true);
    document.addEventListener('blur', handleBlur, true);
    document.addEventListener('drop', handleDrop, true);
    
    // File inputs
    document.querySelectorAll('input[type="file"]').forEach(input => {
      input.addEventListener('change', handleFileSelect);
    });
    
    // Setup observers
    setupMutationObserver();
    
    // URL change polling
    setInterval(checkUrlChange, 500);
    
    // Show recording indicator
    showRecordingIndicator();
    
    // Record session start
    recordEvent('sessionStart', {
      mode: RecorderState.currentMode,
      recordingType: RecorderState.metadata.recordingType,
      url: window.location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    });
    
    log('Recording started', RecorderState.sessionId);
  }

  function stopRecording() {
    if (!RecorderState.isRecording) {
      log('Not recording');
      return null;
    }
    
    // Flush any pending data
    flushKeyBuffer();
    flushMutations();
    
    // Record session end
    recordEvent('sessionEnd', {
      totalEvents: RecorderState.events.length,
      markedElements: RecorderState.markedElements.length,
      duration: getRelativeTime(),
    });
    
    RecorderState.isRecording = false;
    
    // Remove event listeners
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('input', handleInput, true);
    document.removeEventListener('change', handleChange, true);
    document.removeEventListener('scroll', handleScroll, true);
    document.removeEventListener('focus', handleFocus, true);
    document.removeEventListener('blur', handleBlur, true);
    document.removeEventListener('drop', handleDrop, true);
    
    // Stop mutation observer
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
    
    // Hide recording indicator
    hideRecordingIndicator();
    
    // Compile session data
    const sessionData = compileSessionData();
    
    log('Recording stopped', sessionData);
    
    return sessionData;
  }

  function compileSessionData() {
    return {
      sessionId: RecorderState.sessionId,
      startTime: RecorderState.startTime,
      endTime: Date.now(),
      duration: getRelativeTime(),
      metadata: RecorderState.metadata,
      mode: RecorderState.currentMode,
      recordingType: RecorderState.metadata.recordingType,
      
      // All events
      events: RecorderState.events,
      totalEvents: RecorderState.events.length,
      
      // Marked elements (Ctrl+Click)
      markedElements: RecorderState.markedElements,
      
      // Extracted patterns
      patterns: extractPatterns(),
      
      // Field mappings
      fieldMappings: extractFieldMappings(),
      
      // Click sequence (order matters for training)
      clickSequence: extractClickSequence(),
      
      // Typing patterns
      typingPatterns: extractTypingPatterns(),
      
      // Generated automation code
      automationCode: generateAutomationCode(),
    };
  }

  // ============================================
  // PATTERN EXTRACTION
  // ============================================
  
  function extractPatterns() {
    const patterns = {
      dropdowns: [],
      inputs: [],
      buttons: [],
      navigation: [],
      fileUploads: [],
      timing: {
        averageClickInterval: 0,
        averageTypingSpeed: 0,
        totalDuration: getRelativeTime(),
      },
    };
    
    const clickEvents = RecorderState.events.filter(e => e.type === 'click');
    const typingEvents = RecorderState.events.filter(e => e.type === 'typing');
    
    // Calculate average click interval
    if (clickEvents.length > 1) {
      const intervals = [];
      for (let i = 1; i < clickEvents.length; i++) {
        intervals.push(clickEvents[i].relativeTime - clickEvents[i-1].relativeTime);
      }
      patterns.timing.averageClickInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    }
    
    // Extract dropdown patterns
    for (const event of RecorderState.events) {
      if (event.type === 'click' && event.element?.isDropdown) {
        patterns.dropdowns.push({
          fieldType: event.fieldType,
          selectors: event.element.selectors,
          ariaLabel: event.element.ariaLabel,
          timestamp: event.relativeTime,
        });
      }
      
      if (event.type === 'click' && event.element?.isInput) {
        patterns.inputs.push({
          fieldType: event.fieldType,
          selectors: event.element.selectors,
          placeholder: event.element.placeholder,
          timestamp: event.relativeTime,
        });
      }
      
      if (event.type === 'click' && event.element?.role === 'button') {
        patterns.buttons.push({
          text: event.element.textContent,
          fieldType: event.fieldType,
          selectors: event.element.selectors,
          timestamp: event.relativeTime,
        });
      }
      
      if (event.type === 'navigation') {
        patterns.navigation.push({
          from: event.fromUrl,
          to: event.toUrl,
          type: event.navigationType,
          timestamp: event.relativeTime,
        });
      }
      
      if (event.type === 'fileUpload' || event.type === 'fileDrop') {
        patterns.fileUploads.push({
          selectors: event.element?.selectors,
          fileCount: event.fileCount,
          timestamp: event.relativeTime,
        });
      }
    }
    
    return patterns;
  }

  function extractFieldMappings() {
    const mappings = {};
    
    // From marked elements (Ctrl+Click)
    for (const marked of RecorderState.markedElements) {
      const fieldType = marked.fieldType || marked.markedAs;
      if (fieldType && fieldType !== 'unknown') {
        mappings[fieldType] = {
          selectors: marked.elementInfo.selectors,
          ariaLabel: marked.elementInfo.ariaLabel,
          role: marked.elementInfo.role,
          isDropdown: marked.elementInfo.isDropdown,
          isInput: marked.elementInfo.isInput,
          placeholder: marked.elementInfo.placeholder,
          parentContext: marked.elementInfo.parentInfo,
          recordedAt: marked.relativeTime,
        };
      }
    }
    
    // From detected field types in events
    for (const event of RecorderState.events) {
      if (event.fieldType && !mappings[event.fieldType]) {
        mappings[event.fieldType] = {
          selectors: event.element?.selectors,
          ariaLabel: event.element?.ariaLabel,
          role: event.element?.role,
          isDropdown: event.element?.isDropdown,
          isInput: event.element?.isInput,
          detectedFrom: 'auto',
        };
      }
    }
    
    return mappings;
  }

  function extractClickSequence() {
    const clicks = RecorderState.events
      .filter(e => e.type === 'click')
      .map((event, index) => ({
        order: index + 1,
        fieldType: event.fieldType,
        isMarked: event.isMarked,
        text: event.element?.textContent?.substring(0, 50),
        selectors: event.element?.selectors,
        timeSincePrevious: index > 0 ? 
          event.relativeTime - RecorderState.events.filter(e => e.type === 'click')[index - 1]?.relativeTime : 0,
        timestamp: event.relativeTime,
      }));
    
    return clicks;
  }

  function extractTypingPatterns() {
    return RecorderState.events
      .filter(e => e.type === 'typing' || e.type === 'input')
      .map(event => ({
        fieldType: event.fieldType,
        textLength: event.text?.length || event.value?.length || 0,
        selectors: event.element?.selectors,
        timestamp: event.relativeTime,
      }));
  }

  // ============================================
  // AUTOMATION CODE GENERATION
  // ============================================
  
  function generateAutomationCode() {
    const code = {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      type: RecorderState.metadata.recordingType,
      mode: RecorderState.currentMode,
      
      // Step-by-step automation
      steps: [],
      
      // Field selector mappings
      selectors: {},
      
      // Timing recommendations
      timing: {},
    };
    
    // Extract marked elements as selectors
    for (const marked of RecorderState.markedElements) {
      const fieldType = marked.fieldType || marked.markedAs;
      if (fieldType && fieldType !== 'unknown') {
        code.selectors[fieldType] = {
          primary: marked.elementInfo.selectors?.[0] || null,
          fallbacks: marked.elementInfo.selectors?.slice(1) || [],
          ariaLabel: marked.elementInfo.ariaLabel,
          role: marked.elementInfo.role,
          type: marked.elementInfo.isDropdown ? 'dropdown' : 
                marked.elementInfo.isInput ? 'input' : 'button',
        };
      }
    }
    
    // Generate steps from events
    let stepIndex = 0;
    for (const event of RecorderState.events) {
      if (event.type === 'click' && event.fieldType) {
        code.steps.push({
          step: ++stepIndex,
          action: event.element?.isDropdown ? 'selectDropdown' : 
                  event.element?.isInput ? 'fillInput' : 'click',
          field: event.fieldType,
          waitBefore: event.relativeTime > 0 ? 
            Math.min(event.relativeTime - (code.steps[stepIndex - 2]?.timestamp || 0), 2000) : 500,
          selector: event.element?.selectors?.[0],
          timestamp: event.relativeTime,
        });
      }
      
      if (event.type === 'typing' && event.fieldType) {
        // Find corresponding step and add typing info
        const lastStep = code.steps[code.steps.length - 1];
        if (lastStep && lastStep.field === event.fieldType) {
          lastStep.value = '{{' + event.fieldType + '}}';
          lastStep.exampleValue = event.text;
        }
      }
    }
    
    // Calculate timing recommendations
    const clickEvents = RecorderState.events.filter(e => e.type === 'click');
    if (clickEvents.length > 1) {
      const intervals = [];
      for (let i = 1; i < clickEvents.length; i++) {
        intervals.push(clickEvents[i].relativeTime - clickEvents[i-1].relativeTime);
      }
      code.timing.averageDelay = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
      code.timing.minDelay = Math.min(...intervals);
      code.timing.maxDelay = Math.max(...intervals);
      code.timing.recommendedDelay = Math.round(code.timing.averageDelay * 0.8);
    }
    
    return code;
  }

  // ============================================
  // UI COMPONENTS
  // ============================================
  
  function showRecordingIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'fmd-recording-indicator';
    indicator.innerHTML = `
      <div class="fmd-rec-pulse"></div>
      <span class="fmd-rec-text">🔴 RECORDING</span>
      <span class="fmd-rec-mode">${RecorderState.currentMode.toUpperCase()}</span>
      <span class="fmd-rec-events">0 events</span>
      <div class="fmd-rec-hint">Ctrl+Click to mark fields</div>
    `;
    document.body.appendChild(indicator);
    
    // Update event count
    setInterval(() => {
      const eventsSpan = indicator.querySelector('.fmd-rec-events');
      if (eventsSpan && RecorderState.isRecording) {
        eventsSpan.textContent = `${RecorderState.events.length} events`;
      }
    }, 500);
  }

  function hideRecordingIndicator() {
    const indicator = document.getElementById('fmd-recording-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  // ============================================
  // MESSAGE HANDLER
  // ============================================
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    log('Message received:', message.type);
    
    switch (message.type) {
      case 'START_RECORDING':
        startRecording(message.options || {});
        sendResponse({ success: true, sessionId: RecorderState.sessionId });
        break;
        
      case 'STOP_RECORDING':
        const data = stopRecording();
        sendResponse({ success: true, data });
        break;
        
      case 'GET_STATUS':
        sendResponse({
          isRecording: RecorderState.isRecording,
          sessionId: RecorderState.sessionId,
          eventCount: RecorderState.events.length,
          markedCount: RecorderState.markedElements.length,
          mode: RecorderState.currentMode,
        });
        break;
        
      case 'GET_EVENTS':
        sendResponse({
          events: RecorderState.events.slice(-100),
          markedElements: RecorderState.markedElements,
        });
        break;
        
      case 'MARK_FIELD':
        // Programmatically mark a field
        if (message.fieldType && message.selector) {
          const element = document.querySelector(message.selector);
          if (element) {
            RecorderState.markedElements.push({
              elementInfo: extractElementInfo(element),
              fieldType: message.fieldType,
              timestamp: getTimestamp(),
              relativeTime: getRelativeTime(),
              markedAs: message.fieldType,
            });
            showMarkedFeedback(element, message.fieldType);
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Element not found' });
          }
        }
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
    
    return true;
  });

  // ============================================
  // INITIALIZATION
  // ============================================
  
  log('FMD Training Recorder loaded');
  
  // Expose for debugging
  window.__FMD_RECORDER__ = {
    getState: () => RecorderState,
    startRecording,
    stopRecording,
    getEvents: () => RecorderState.events,
    getMarkedElements: () => RecorderState.markedElements,
  };
  
})();
