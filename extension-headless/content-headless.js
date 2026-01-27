/**
 * DealersFace Pro - Headless Content Script
 * 
 * Stripped-down version for server-side automation
 * Retains all core automation functionality without GUI dependencies
 * 
 * Compatible with Puppeteer/Playwright/headless Chromium
 */

// ============================================
// Configuration
// ============================================

const CONFIG = {
  API_URL: 'https://dealersface.com/api',
  
  TIMING: {
    FAST_TYPE: { MIN: 5, MAX: 15 },
    NORMAL_TYPE: { MIN: 15, MAX: 35 },
    ACTION_DELAY: { MIN: 100, MAX: 300 },
    DROPDOWN_WAIT: 200,
  },
  
  FALLBACKS: {
    MAKE: 'Toyota',
    COLOR: 'Black',
    BODY_STYLE: 'Other',
    FUEL_TYPE: 'Gasoline',
    TRANSMISSION: 'Automatic',
    CONDITION: 'Excellent',
    VEHICLE_TYPE: 'Car/Truck',
  },
};

// ============================================
// Core Utilities
// ============================================

function randomDelay(min, max) {
  return new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
}

function C(tagName, text) {
  const elements = Array.from(document.querySelectorAll(tagName));
  return elements.find(el => el.innerText?.trim() === text) || null;
}

function isVisible(element) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         element.offsetParent !== null;
}

// ============================================
// Human-like Interactions
// ============================================

async function clickHumanlike(element) {
  if (!element) return false;
  
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await randomDelay(100, 200);
  
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width * (0.3 + Math.random() * 0.4);
  const y = rect.top + rect.height * (0.3 + Math.random() * 0.4);
  
  const dispatch = (type) => {
    element.dispatchEvent(new MouseEvent(type, {
      view: window, bubbles: true, cancelable: true,
      clientX: x, clientY: y, buttons: 1
    }));
  };
  
  dispatch('pointerover');
  dispatch('mouseover');
  await randomDelay(20, 50);
  
  dispatch('pointerdown');
  dispatch('mousedown');
  await randomDelay(50, 100);
  
  if (element.focus) element.focus();
  
  dispatch('pointerup');
  dispatch('mouseup');
  dispatch('click');
  
  await randomDelay(100, 200);
  return true;
}

async function typeText(element, text, fast = false) {
  if (!element || !text) return false;
  
  element.focus();
  await randomDelay(50, 100);
  
  if (element.value !== undefined) {
    element.value = '';
  } else if (element.isContentEditable) {
    element.textContent = '';
  }
  
  const timing = fast ? CONFIG.TIMING.FAST_TYPE : CONFIG.TIMING.NORMAL_TYPE;
  const textStr = String(text);
  
  for (const char of textStr) {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
    
    if (element.value !== undefined) {
      element.value += char;
    } else if (element.isContentEditable) {
      element.textContent += char;
    }
    
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true, inputType: 'insertText', data: char
    }));
    element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
    
    await randomDelay(timing.MIN, timing.MAX);
  }
  
  element.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

async function closeOpenDropdowns() {
  const openDropdowns = document.querySelectorAll('[aria-expanded="true"]');
  if (openDropdowns.length > 0) {
    document.body.click();
    await randomDelay(100, 200);
  }
}

// ============================================
// Element Finding
// ============================================

function findByAriaLabel(label) {
  return document.querySelector(`[aria-label*="${label}" i]`);
}

function findByPlaceholder(text) {
  return document.querySelector(`[placeholder*="${text}" i]`);
}

function findByRole(role, text = null) {
  const elements = document.querySelectorAll(`[role="${role}"]`);
  if (!text) return elements[0];
  
  return Array.from(elements).find(el => 
    el.textContent?.toLowerCase().includes(text.toLowerCase())
  );
}

function findClickable(text) {
  const selectors = [
    `button:contains("${text}")`,
    `[role="button"]:contains("${text}")`,
    `a:contains("${text}")`,
    `span:contains("${text}")`
  ];
  
  // Use contains fallback
  const all = document.querySelectorAll('button, [role="button"], a, span, div[tabindex]');
  return Array.from(all).find(el => 
    el.textContent?.trim().toLowerCase().includes(text.toLowerCase()) &&
    isVisible(el)
  );
}

function findInput(label) {
  // Try aria-label
  let el = findByAriaLabel(label);
  if (el) return el;
  
  // Try placeholder
  el = findByPlaceholder(label);
  if (el) return el;
  
  // Try associated label
  const labels = document.querySelectorAll('label');
  for (const lbl of labels) {
    if (lbl.textContent?.toLowerCase().includes(label.toLowerCase())) {
      const forId = lbl.getAttribute('for');
      if (forId) return document.getElementById(forId);
      return lbl.querySelector('input, textarea');
    }
  }
  
  return null;
}

// ============================================
// Dropdown Handling
// ============================================

async function selectDropdownOption(triggerElement, valueToSelect) {
  if (!triggerElement || !valueToSelect) return false;
  
  await closeOpenDropdowns();
  await randomDelay(100, 200);
  
  // Click to open dropdown
  await clickHumanlike(triggerElement);
  await randomDelay(300, 500);
  
  // Find the option
  const options = document.querySelectorAll('[role="option"], [role="menuitem"], li[data-value]');
  
  for (const opt of options) {
    const text = opt.textContent?.trim().toLowerCase();
    const value = opt.getAttribute('data-value')?.toLowerCase();
    const searchLower = valueToSelect.toLowerCase();
    
    if (text === searchLower || value === searchLower ||
        text?.includes(searchLower) || value?.includes(searchLower)) {
      await clickHumanlike(opt);
      await randomDelay(200, 400);
      return true;
    }
  }
  
  // Try typing to filter
  const input = triggerElement.querySelector('input') || 
                document.activeElement;
  if (input && input.tagName === 'INPUT') {
    await typeText(input, valueToSelect, true);
    await randomDelay(300, 500);
    
    // Click first visible option
    const filteredOpt = document.querySelector('[role="option"]:not([hidden])');
    if (filteredOpt) {
      await clickHumanlike(filteredOpt);
      return true;
    }
  }
  
  return false;
}

// ============================================
// Image Upload
// ============================================

async function uploadImages(imageUrls, proxyUrl) {
  if (!imageUrls?.length) return { uploaded: 0, failed: 0 };
  
  const fileInput = document.querySelector('input[type="file"][accept*="image"]');
  if (!fileInput) {
    console.error('[HEADLESS] No file input found');
    return { uploaded: 0, failed: imageUrls.length };
  }
  
  let uploaded = 0;
  let failed = 0;
  const files = [];
  
  for (let i = 0; i < Math.min(imageUrls.length, 10); i++) {
    try {
      let url = imageUrls[i];
      
      // Use proxy if provided
      if (proxyUrl && !url.startsWith('data:')) {
        url = `${proxyUrl}?url=${encodeURIComponent(url)}`;
      }
      
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], `image_${i + 1}.jpg`, { type: 'image/jpeg' });
      files.push(file);
      uploaded++;
    } catch (e) {
      console.error('[HEADLESS] Image fetch failed:', e);
      failed++;
    }
  }
  
  if (files.length > 0) {
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    await randomDelay(1000, 2000);
  }
  
  return { uploaded, failed };
}

// ============================================
// Form Actions
// ============================================

async function clickPublishButton() {
  // Try multiple selectors for publish/next button
  const selectors = [
    '[aria-label*="Publish"]',
    '[aria-label*="Next"]',
    'button[type="submit"]',
  ];
  
  for (const sel of selectors) {
    const btn = document.querySelector(sel);
    if (btn && isVisible(btn)) {
      await clickHumanlike(btn);
      return { clicked: true, selector: sel };
    }
  }
  
  // Fallback: find by text
  const texts = ['Publish', 'Next', 'Submit', 'Post'];
  for (const text of texts) {
    const btn = findClickable(text);
    if (btn) {
      await clickHumanlike(btn);
      return { clicked: true, text };
    }
  }
  
  return { clicked: false };
}

// ============================================
// Mission Execution
// ============================================

let currentMission = null;

async function executeMission(missionId, vehicleData, authToken, patternName) {
  console.log('[HEADLESS] Starting mission:', missionId);
  
  currentMission = {
    id: missionId,
    status: 'running',
    startTime: Date.now(),
    progress: [],
    vehicleData
  };
  
  try {
    // Report progress
    const report = (step, status, details = {}) => {
      const progress = { step, status, timestamp: Date.now(), ...details };
      currentMission.progress.push(progress);
      console.log('[HEADLESS] Progress:', progress);
      
      chrome.runtime?.sendMessage({
        action: 'IAI_PROGRESS',
        missionId,
        progress
      });
    };
    
    // Step 1: Ensure we're on create vehicle page
    report('navigation', 'starting');
    
    if (!window.location.href.includes('marketplace/create')) {
      window.location.href = 'https://www.facebook.com/marketplace/create/vehicle';
      await new Promise(r => setTimeout(r, 3000));
    }
    
    report('navigation', 'complete');
    
    // Step 2: Select vehicle type
    report('vehicleType', 'starting');
    const vehicleTypeBtn = C('span', 'Vehicles');
    if (vehicleTypeBtn) {
      await clickHumanlike(vehicleTypeBtn);
      await randomDelay(500, 1000);
    }
    report('vehicleType', 'complete');
    
    // Step 3: Fill form fields
    const fields = [
      { label: 'Year', value: vehicleData.year },
      { label: 'Make', value: vehicleData.make },
      { label: 'Model', value: vehicleData.model },
      { label: 'Mileage', value: vehicleData.mileage },
      { label: 'Price', value: vehicleData.price },
      { label: 'VIN', value: vehicleData.vin },
    ];
    
    for (const field of fields) {
      if (!field.value) continue;
      
      report(`field_${field.label}`, 'starting');
      
      const input = findInput(field.label);
      if (input) {
        await clickHumanlike(input);
        await typeText(input, String(field.value));
        report(`field_${field.label}`, 'complete');
      } else {
        report(`field_${field.label}`, 'skipped', { reason: 'not found' });
      }
    }
    
    // Step 4: Dropdowns
    const dropdowns = [
      { label: 'Body Style', value: vehicleData.bodyStyle || CONFIG.FALLBACKS.BODY_STYLE },
      { label: 'Fuel Type', value: vehicleData.fuelType || CONFIG.FALLBACKS.FUEL_TYPE },
      { label: 'Transmission', value: vehicleData.transmission || CONFIG.FALLBACKS.TRANSMISSION },
      { label: 'Condition', value: vehicleData.condition || CONFIG.FALLBACKS.CONDITION },
      { label: 'Exterior Color', value: vehicleData.color || CONFIG.FALLBACKS.COLOR },
    ];
    
    for (const dd of dropdowns) {
      if (!dd.value) continue;
      
      report(`dropdown_${dd.label}`, 'starting');
      
      const trigger = findByAriaLabel(dd.label) || findClickable(dd.label);
      if (trigger) {
        await selectDropdownOption(trigger, dd.value);
        report(`dropdown_${dd.label}`, 'complete');
      } else {
        report(`dropdown_${dd.label}`, 'skipped', { reason: 'not found' });
      }
    }
    
    // Step 5: Description
    report('description', 'starting');
    const descField = findInput('Description') || 
                      document.querySelector('[contenteditable="true"]');
    if (descField && vehicleData.description) {
      await clickHumanlike(descField);
      await typeText(descField, vehicleData.description);
      report('description', 'complete');
    }
    
    // Step 6: Upload images
    if (vehicleData.imageUrls?.length > 0) {
      report('images', 'starting');
      const uploadResult = await uploadImages(
        vehicleData.imageUrls,
        vehicleData.imageProxyUrl || 'https://dealersface.com/api/image-proxy'
      );
      report('images', 'complete', uploadResult);
    }
    
    // Step 7: Click Next/Publish
    report('publish', 'starting');
    await randomDelay(500, 1000);
    
    // Handle multi-step wizard
    let step = 0;
    while (step < 5) {
      const result = await clickPublishButton();
      if (!result.clicked) break;
      
      step++;
      report(`wizard_step_${step}`, 'clicked');
      await randomDelay(1000, 2000);
      
      // Check for success indicators
      if (document.body.textContent?.includes('Your listing is live') ||
          document.body.textContent?.includes('has been published')) {
        report('publish', 'success');
        break;
      }
    }
    
    // Mission complete
    currentMission.status = 'completed';
    currentMission.endTime = Date.now();
    
    chrome.runtime?.sendMessage({
      action: 'IAI_MISSION_COMPLETE',
      missionId,
      result: {
        success: true,
        duration: currentMission.endTime - currentMission.startTime,
        progress: currentMission.progress
      }
    });
    
    console.log('[HEADLESS] Mission completed successfully');
    return { success: true, mission: currentMission };
    
  } catch (error) {
    console.error('[HEADLESS] Mission failed:', error);
    currentMission.status = 'failed';
    currentMission.error = error.message;
    
    chrome.runtime?.sendMessage({
      action: 'IAI_MISSION_FAILED',
      missionId,
      error: error.message
    });
    
    return { success: false, error: error.message };
  }
}

// ============================================
// Message Handler
// ============================================

chrome.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
  console.log('[HEADLESS] Received message:', message.action);
  
  switch (message.action) {
    case 'IAI_START_MISSION':
      executeMission(
        message.missionId,
        message.vehicleData,
        message.authToken,
        message.patternName
      ).then(sendResponse);
      return true;
      
    case 'IAI_STOP_MISSION':
      if (currentMission && currentMission.id === message.missionId) {
        currentMission.status = 'stopped';
      }
      sendResponse({ success: true });
      return false;
      
    case 'IAI_GET_STATUS':
      sendResponse({
        success: true,
        mission: currentMission,
        url: window.location.href
      });
      return false;
      
    case 'PING':
      sendResponse({ pong: true, timestamp: Date.now() });
      return false;
      
    default:
      return false;
  }
});

// ============================================
// Expose to Page (for Puppeteer control)
// ============================================

window.__DEALERSFACE_HEADLESS__ = {
  version: '3.4.0',
  mode: 'headless',
  
  // Direct function access for Puppeteer
  executeMission,
  clickHumanlike,
  typeText,
  findInput,
  selectDropdownOption,
  uploadImages,
  clickPublishButton,
  
  // Utilities
  findByAriaLabel,
  findByPlaceholder,
  findClickable,
  isVisible,
  C,
  
  // Status
  getMission: () => currentMission,
};

console.log('[HEADLESS] DealersFace Headless Content Script loaded');
