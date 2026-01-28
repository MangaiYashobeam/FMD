/**
 * ====================================================================
 * GREEN ROUTE CONNECTIVITY TEST
 * ====================================================================
 * 
 * Tests all Green Route endpoints to verify internal connectivity.
 * ALL calls stay within the system - no external network required.
 * 
 * Run: node scripts/test-green-route.cjs
 */

const https = require('https');
const http = require('http');

// Configuration
const CONFIG = {
  BASE_URL: process.env.API_BASE_URL || 'https://dealersface.com',
  WORKER_API_BASE: process.env.WORKER_API_BASE || 'http://worker-api:8000',
  AUTH_TOKEN: process.env.AUTH_TOKEN || null,
  TIMEOUT: 30000,
};

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: [],
};

// Helper to make HTTP requests
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const lib = isHttps ? https : http;
    
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Green-Route': 'true',
        ...options.headers,
      },
      timeout: CONFIG.TIMEOUT,
    };

    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data),
          });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

// Test runner
async function runTest(name, testFn) {
  process.stdout.write(`  Testing: ${name}... `);
  const startTime = Date.now();
  
  try {
    const result = await testFn();
    const elapsed = Date.now() - startTime;
    
    if (result.success) {
      console.log(`✅ PASS (${elapsed}ms)`);
      results.passed++;
      results.tests.push({ name, status: 'PASS', elapsed, details: result.details });
    } else {
      console.log(`❌ FAIL: ${result.error}`);
      results.failed++;
      results.tests.push({ name, status: 'FAIL', elapsed, error: result.error });
    }
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.log(`❌ ERROR: ${error.message}`);
    results.failed++;
    results.tests.push({ name, status: 'ERROR', elapsed, error: error.message });
  }
}

// Skip test
function skipTest(name, reason) {
  console.log(`  Testing: ${name}... ⏭️ SKIP: ${reason}`);
  results.skipped++;
  results.tests.push({ name, status: 'SKIP', reason });
}

// ============================================
// GREEN ROUTE TESTS
// ============================================

async function runTests() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║          GREEN ROUTE CONNECTIVITY TEST                           ║');
  console.log('║          All Internal - No External Calls                        ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  
  console.log(`📍 Base URL: ${CONFIG.BASE_URL}`);
  console.log(`📍 Worker API: ${CONFIG.WORKER_API_BASE}`);
  console.log(`🔑 Auth Token: ${CONFIG.AUTH_TOKEN ? 'Provided' : 'Not provided'}\n`);

  // ============================================
  // PUBLIC GREEN ROUTES (No Auth Required)
  // ============================================
  console.log('🟢 PUBLIC GREEN ROUTES (No Auth Required)');
  console.log('─'.repeat(60));

  // Test 1: Health Check
  await runTest('Green Route Health', async () => {
    const res = await request(`${CONFIG.BASE_URL}/api/green/health`);
    if (res.status === 200 && res.data.success) {
      return { success: true, details: res.data };
    }
    return { success: false, error: `Status ${res.status}: ${JSON.stringify(res.data)}` };
  });

  // Test 2: System Status
  await runTest('Green Route Status', async () => {
    const res = await request(`${CONFIG.BASE_URL}/api/green/status`);
    if (res.status === 200 && res.data.success) {
      return { success: true, details: res.data.system };
    }
    return { success: false, error: `Status ${res.status}` };
  });

  // Test 3: IAI Metrics (No Auth)
  await runTest('IAI Metrics Endpoint', async () => {
    const res = await request(`${CONFIG.BASE_URL}/api/green/iai/metrics`, {
      method: 'POST',
      body: {
        eventType: 'pattern_loaded',
        patternId: 'test-pattern',
        containerId: 'test-container',
        soldierId: 'test-soldier',
        accountId: 'test-account',
        source: 'test-script',
      },
    });
    if (res.status === 200 && res.data.success) {
      return { success: true, details: res.data };
    }
    return { success: false, error: `Status ${res.status}` };
  });

  // Test 4: Image Proxy (Facebook CDN)
  await runTest('Image Proxy (Facebook CDN)', async () => {
    const testUrl = 'https://scontent.xx.fbcdn.net/v/t39.30808-6/123456789_123456789_123456789_n.jpg';
    const res = await request(`${CONFIG.BASE_URL}/api/green/image-proxy?url=${encodeURIComponent(testUrl)}`);
    // Even if image doesn't exist, we should get proper error handling
    if (res.status === 200 || res.status === 400 || res.status === 403) {
      return { success: true, details: { status: res.status } };
    }
    return { success: false, error: `Unexpected status ${res.status}` };
  });

  // ============================================
  // AUTHENTICATED GREEN ROUTES
  // ============================================
  console.log('\n🔐 AUTHENTICATED GREEN ROUTES');
  console.log('─'.repeat(60));

  if (!CONFIG.AUTH_TOKEN) {
    skipTest('Get Current User (/api/green/me)', 'No AUTH_TOKEN provided');
    skipTest('Get Vehicles', 'No AUTH_TOKEN provided');
    skipTest('Get FB Session', 'No AUTH_TOKEN provided');
    skipTest('Get Posting Config', 'No AUTH_TOKEN provided');
    skipTest('Send Heartbeat', 'No AUTH_TOKEN provided');
  } else {
    const authHeaders = { Authorization: `Bearer ${CONFIG.AUTH_TOKEN}` };

    await runTest('Get Current User (/api/green/me)', async () => {
      const res = await request(`${CONFIG.BASE_URL}/api/green/me`, { headers: authHeaders });
      if (res.status === 200 && res.data.success) {
        return { success: true, details: res.data.user };
      }
      return { success: false, error: `Status ${res.status}` };
    });

    await runTest('Get Vehicles', async () => {
      const res = await request(`${CONFIG.BASE_URL}/api/green/vehicles?limit=5`, { headers: authHeaders });
      if (res.status === 200 && res.data.success) {
        return { success: true, details: { count: res.data.vehicles?.length || 0 } };
      }
      return { success: false, error: `Status ${res.status}` };
    });

    await runTest('Get Posting Config', async () => {
      const res = await request(`${CONFIG.BASE_URL}/api/green/posting-config`, { headers: authHeaders });
      if (res.status === 200 && res.data.success) {
        return { success: true, details: res.data.config };
      }
      return { success: false, error: `Status ${res.status}` };
    });

    await runTest('Send Heartbeat', async () => {
      const res = await request(`${CONFIG.BASE_URL}/api/green/heartbeat`, {
        method: 'POST',
        headers: authHeaders,
        body: { browserInfo: { userAgent: 'TestScript/1.0' } },
      });
      if (res.status === 200 && res.data.success) {
        return { success: true, details: res.data };
      }
      return { success: false, error: `Status ${res.status}` };
    });
  }

  // ============================================
  // IAI STEALTH SOLDIERS (VPS Workers)
  // ============================================
  console.log('\n🥷 IAI STEALTH SOLDIERS (VPS Workers via Green Route)');
  console.log('─'.repeat(60));

  let stealthBrowserId = null;

  // Test: Create Stealth Browser
  await runTest('Create Stealth Browser', async () => {
    const res = await request(`${CONFIG.BASE_URL}/api/green/stealth/create`, {
      method: 'POST',
      body: { headless: true },
    });
    if (res.status === 200 && res.data.success && res.data.browserId) {
      stealthBrowserId = res.data.browserId;
      return { success: true, details: { browserId: stealthBrowserId } };
    }
    return { success: false, error: `Status ${res.status}: ${JSON.stringify(res.data)}` };
  });

  if (stealthBrowserId) {
    // Test: Navigate
    await runTest('Stealth Navigate', async () => {
      const res = await request(`${CONFIG.BASE_URL}/api/green/stealth/${stealthBrowserId}/action`, {
        method: 'POST',
        body: { action: 'navigate', url: 'https://www.google.com' },
      });
      if (res.status === 200 && res.data.success) {
        return { success: true, details: { url: res.data.url } };
      }
      return { success: false, error: `Status ${res.status}: ${JSON.stringify(res.data)}` };
    });

    // Test: Get State
    await runTest('Stealth Get State', async () => {
      const res = await request(`${CONFIG.BASE_URL}/api/green/stealth/${stealthBrowserId}/state`);
      if (res.status === 200 && res.data.success) {
        return { success: true, details: { url: res.data.state?.url } };
      }
      return { success: false, error: `Status ${res.status}` };
    });

    // Test: Screenshot
    await runTest('Stealth Screenshot', async () => {
      const res = await request(`${CONFIG.BASE_URL}/api/green/stealth/${stealthBrowserId}/screenshot`);
      if (res.status === 200 && res.data.success && res.data.screenshot) {
        return { success: true, details: { size: res.data.screenshot.length } };
      }
      return { success: false, error: `Status ${res.status}` };
    });

    // Test: Extract Elements
    await runTest('Stealth Extract Elements', async () => {
      const res = await request(`${CONFIG.BASE_URL}/api/green/stealth/${stealthBrowserId}/action`, {
        method: 'POST',
        body: { action: 'extract_elements', selector: 'a, button, input' },
      });
      if (res.status === 200 && res.data.success) {
        return { success: true, details: { elements: res.data.elements?.length || 0 } };
      }
      return { success: false, error: `Status ${res.status}: ${JSON.stringify(res.data)}` };
    });

    // Test: Close Browser
    await runTest('Stealth Close Browser', async () => {
      const res = await request(`${CONFIG.BASE_URL}/api/green/stealth/${stealthBrowserId}`, {
        method: 'DELETE',
      });
      if (res.status === 200 && res.data.success) {
        return { success: true, details: res.data };
      }
      return { success: false, error: `Status ${res.status}` };
    });
  } else {
    skipTest('Stealth Navigate', 'No browser created');
    skipTest('Stealth Get State', 'No browser created');
    skipTest('Stealth Screenshot', 'No browser created');
    skipTest('Stealth Extract Elements', 'No browser created');
    skipTest('Stealth Close Browser', 'No browser created');
  }

  // Test: Pool Status
  await runTest('Stealth Pool Status', async () => {
    const res = await request(`${CONFIG.BASE_URL}/api/green/stealth/pool`);
    if (res.status === 200) {
      return { success: true, details: res.data };
    }
    return { success: false, error: `Status ${res.status}` };
  });

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                        TEST SUMMARY                              ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  const total = results.passed + results.failed + results.skipped;
  const passRate = total > 0 ? ((results.passed / (total - results.skipped)) * 100).toFixed(1) : 0;

  console.log(`  ✅ Passed:  ${results.passed}`);
  console.log(`  ❌ Failed:  ${results.failed}`);
  console.log(`  ⏭️  Skipped: ${results.skipped}`);
  console.log(`  📊 Total:   ${total}`);
  console.log(`  📈 Pass Rate: ${passRate}%`);
  
  if (results.failed === 0 && results.passed > 0) {
    console.log('\n  🟢 ALL GREEN ROUTE TESTS PASSED - Internal connectivity verified!');
  } else if (results.failed > 0) {
    console.log('\n  🔴 SOME TESTS FAILED - Check connectivity');
  }

  console.log('\n' + '═'.repeat(66) + '\n');

  return results;
}

// Run tests
runTests()
  .then((results) => {
    process.exit(results.failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('Test suite error:', error);
    process.exit(1);
  });
