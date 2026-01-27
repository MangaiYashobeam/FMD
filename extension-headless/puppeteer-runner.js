/**
 * DealersFace Pro - Puppeteer Automation Runner
 * 
 * Server-side automation for Facebook Marketplace posting
 * Uses headless Chromium with the DealersFace extension
 * 
 * Usage:
 *   node puppeteer-runner.js --vehicle <vehicle-id> --account <fb-account-id>
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');

// Add stealth plugin
puppeteer.use(StealthPlugin());

// Configuration
const CONFIG = {
  API_URL: process.env.API_URL || 'https://dealersface.com/api',
  EXTENSION_PATH: path.join(__dirname, '../extension-headless'),
  VIEWPORT: { width: 1366, height: 768 },
  TIMEOUT: 60000,
  HEADLESS: process.env.HEADLESS !== 'false', // Default headless
};

/**
 * Launch browser with extension
 */
async function launchBrowser() {
  const options = {
    headless: CONFIG.HEADLESS ? 'new' : false,
    args: [
      `--disable-extensions-except=${CONFIG.EXTENSION_PATH}`,
      `--load-extension=${CONFIG.EXTENSION_PATH}`,
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      `--window-size=${CONFIG.VIEWPORT.width},${CONFIG.VIEWPORT.height}`,
    ],
    defaultViewport: CONFIG.VIEWPORT,
    ignoreDefaultArgs: ['--enable-automation'],
  };

  const browser = await puppeteer.launch(options);
  return browser;
}

/**
 * Login to Facebook
 */
async function loginFacebook(page, cookies) {
  console.log('[PUPPETEER] Logging into Facebook...');
  
  // Set cookies if provided
  if (cookies?.length > 0) {
    await page.setCookie(...cookies);
    await page.goto('https://www.facebook.com', { waitUntil: 'networkidle2' });
    
    // Check if logged in
    const loggedIn = await page.evaluate(() => {
      return !!document.querySelector('[aria-label="Your profile"]') ||
             !!document.querySelector('[aria-label="Account"]');
    });
    
    if (loggedIn) {
      console.log('[PUPPETEER] Logged in via cookies');
      return true;
    }
  }
  
  // Manual login fallback
  console.log('[PUPPETEER] Cookie login failed, manual login required');
  return false;
}

/**
 * Navigate to Marketplace create vehicle page
 */
async function navigateToCreateVehicle(page) {
  console.log('[PUPPETEER] Navigating to create vehicle page...');
  
  await page.goto('https://www.facebook.com/marketplace/create/vehicle', {
    waitUntil: 'networkidle2',
    timeout: CONFIG.TIMEOUT,
  });
  
  // Wait for form to load
  await page.waitForSelector('[aria-label="Marketplace"]', { timeout: 10000 })
    .catch(() => console.log('[PUPPETEER] Marketplace label not found, continuing...'));
  
  return true;
}

/**
 * Execute mission using extension
 */
async function executeMission(page, vehicleData, authToken) {
  console.log('[PUPPETEER] Executing mission...');
  
  const missionId = `mission_${Date.now()}`;
  
  // Inject mission data and trigger execution
  const result = await page.evaluate(async (data) => {
    const { missionId, vehicleData, authToken } = data;
    
    // Wait for extension to load
    let attempts = 0;
    while (!window.__DEALERSFACE_HEADLESS__ && attempts < 20) {
      await new Promise(r => setTimeout(r, 500));
      attempts++;
    }
    
    if (!window.__DEALERSFACE_HEADLESS__) {
      return { success: false, error: 'Extension not loaded' };
    }
    
    // Execute mission
    return await window.__DEALERSFACE_HEADLESS__.executeMission(
      missionId,
      vehicleData,
      authToken,
      'FBM-Official-P1'
    );
  }, { missionId, vehicleData, authToken });
  
  return result;
}

/**
 * Main automation function
 */
async function runAutomation(options) {
  const { vehicleData, fbCookies, authToken } = options;
  
  console.log('[PUPPETEER] Starting automation...');
  console.log('[PUPPETEER] Vehicle:', vehicleData.year, vehicleData.make, vehicleData.model);
  
  let browser;
  let page;
  
  try {
    // Launch browser
    browser = await launchBrowser();
    page = await browser.newPage();
    
    // Set user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    );
    
    // Login to Facebook
    const loggedIn = await loginFacebook(page, fbCookies);
    if (!loggedIn) {
      throw new Error('Facebook login failed');
    }
    
    // Navigate to create vehicle
    await navigateToCreateVehicle(page);
    
    // Wait for page to stabilize
    await page.waitForTimeout(2000);
    
    // Execute mission
    const result = await executeMission(page, vehicleData, authToken);
    
    console.log('[PUPPETEER] Mission result:', result);
    
    // Take screenshot on completion
    await page.screenshot({
      path: `./logs/mission_${Date.now()}.png`,
      fullPage: true,
    }).catch(() => {});
    
    return result;
    
  } catch (error) {
    console.error('[PUPPETEER] Automation failed:', error);
    
    // Take error screenshot
    if (page) {
      await page.screenshot({
        path: `./logs/error_${Date.now()}.png`,
        fullPage: true,
      }).catch(() => {});
    }
    
    return { success: false, error: error.message };
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Fetch vehicle data from API
 */
async function fetchVehicleData(vehicleId, authToken) {
  const response = await fetch(`${CONFIG.API_URL}/vehicles/${vehicleId}`, {
    headers: { 'Authorization': `Bearer ${authToken}` },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch vehicle: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Fetch Facebook cookies from API
 */
async function fetchFacebookCookies(accountId, authToken) {
  const response = await fetch(`${CONFIG.API_URL}/social-accounts/${accountId}/cookies`, {
    headers: { 'Authorization': `Bearer ${authToken}` },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch cookies: ${response.status}`);
  }
  
  const data = await response.json();
  return data.cookies;
}

/**
 * Report result to API
 */
async function reportResult(missionId, vehicleId, accountId, result, authToken) {
  await fetch(`${CONFIG.API_URL}/posting-logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      vehicleId,
      accountId,
      platform: 'facebook_marketplace',
      status: result.success ? 'completed' : 'failed',
      method: 'puppeteer_headless',
      details: result,
    }),
  });
}

// ============================================
// CLI Interface
// ============================================

async function main() {
  const args = process.argv.slice(2);
  
  const vehicleId = args.find((a, i) => args[i - 1] === '--vehicle');
  const accountId = args.find((a, i) => args[i - 1] === '--account');
  const authToken = process.env.AUTH_TOKEN || args.find((a, i) => args[i - 1] === '--token');
  
  if (!vehicleId || !accountId || !authToken) {
    console.log('Usage: node puppeteer-runner.js --vehicle <id> --account <id> --token <token>');
    console.log('Or set AUTH_TOKEN environment variable');
    process.exit(1);
  }
  
  try {
    // Fetch data
    console.log('[CLI] Fetching vehicle data...');
    const vehicleData = await fetchVehicleData(vehicleId, authToken);
    
    console.log('[CLI] Fetching Facebook cookies...');
    const fbCookies = await fetchFacebookCookies(accountId, authToken);
    
    // Run automation
    const result = await runAutomation({
      vehicleData,
      fbCookies,
      authToken,
    });
    
    // Report result
    await reportResult(
      `cli_${Date.now()}`,
      vehicleId,
      accountId,
      result,
      authToken
    );
    
    console.log('[CLI] Automation complete');
    process.exit(result.success ? 0 : 1);
    
  } catch (error) {
    console.error('[CLI] Error:', error);
    process.exit(1);
  }
}

// Export for programmatic use
module.exports = {
  runAutomation,
  launchBrowser,
  loginFacebook,
  navigateToCreateVehicle,
  executeMission,
};

// Run if called directly
if (require.main === module) {
  main();
}
