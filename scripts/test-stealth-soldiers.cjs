/**
 * IAI STEALTH SOLDIERS - ENDPOINT TEST SUITE
 * ==========================================
 * Tests all worker/browser endpoints for Chromium automation
 */

const https = require('https');
const http = require('http');

// Configuration
const API_BASE = process.env.API_BASE || 'https://dealersface.com';
const WORKER_API_BASE = process.env.WORKER_API_BASE || 'http://localhost:8000';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
const WORKER_SECRET = process.env.WORKER_SECRET || '';

// Test results storage
const testResults = {
  passed: 0,
  failed: 0,
  errors: [],
  details: []
};

// Helper: Make HTTP request
function makeRequest(url, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = httpModule.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Test helper
async function runTest(name, testFn) {
  console.log(`\n🧪 Testing: ${name}`);
  console.log('─'.repeat(60));
  
  try {
    const result = await testFn();
    if (result.success) {
      console.log(`   ✅ PASSED: ${result.message}`);
      testResults.passed++;
      testResults.details.push({ name, status: 'PASSED', message: result.message });
    } else {
      console.log(`   ❌ FAILED: ${result.message}`);
      testResults.failed++;
      testResults.details.push({ name, status: 'FAILED', message: result.message });
    }
    return result;
  } catch (error) {
    console.log(`   💥 ERROR: ${error.message}`);
    testResults.failed++;
    testResults.errors.push({ name, error: error.message });
    testResults.details.push({ name, status: 'ERROR', message: error.message });
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN API TESTS (Node.js Backend)
// ═══════════════════════════════════════════════════════════════════

async function testMainApiHealth() {
  return runTest('Main API Health Check', async () => {
    const res = await makeRequest(`${API_BASE}/api/health`);
    if (res.status === 200) {
      return { success: true, message: `API healthy - Status: ${JSON.stringify(res.data)}` };
    }
    return { success: false, message: `Unexpected status: ${res.status}` };
  });
}

async function testWorkerStatus() {
  return runTest('Worker Queue Status (/api/workers/status)', async () => {
    const res = await makeRequest(`${API_BASE}/api/workers/status`, 'GET', null, {
      'Authorization': `Bearer ${AUTH_TOKEN}`
    });
    
    console.log(`   📊 Response status: ${res.status}`);
    
    if (res.status === 200) {
      const data = res.data;
      if (data.available) {
        return { 
          success: true, 
          message: `Workers available - Active: ${data.workers?.length || 0}, Queue stats: ${JSON.stringify(data.stats || {})}` 
        };
      }
      return { success: true, message: `Queue not configured: ${data.message}` };
    } else if (res.status === 401) {
      return { success: false, message: 'Authentication required (need valid token)' };
    } else if (res.status === 403) {
      return { success: false, message: 'Super admin access required' };
    }
    return { success: false, message: `Unexpected status: ${res.status} - ${JSON.stringify(res.data)}` };
  });
}

// ═══════════════════════════════════════════════════════════════════
// PYTHON WORKER API TESTS (FastAPI Backend)
// ═══════════════════════════════════════════════════════════════════

async function testWorkerApiHealth() {
  return runTest('Worker API Health (/health)', async () => {
    const res = await makeRequest(`${WORKER_API_BASE}/health`);
    
    if (res.status === 200) {
      return { 
        success: true, 
        message: `Worker API healthy - ${JSON.stringify(res.data)}` 
      };
    }
    return { success: false, message: `Worker API unhealthy: ${res.status}` };
  });
}

async function testBrowserCreateEndpoint() {
  return runTest('Browser Create Endpoint (/api/browser/create)', async () => {
    const res = await makeRequest(`${WORKER_API_BASE}/api/browser/create`, 'POST', {
      account_id: 'test-account-001',
      headless: true,
      stealth: true,
      load_session: false
    }, {
      'X-API-Key': WORKER_SECRET
    });
    
    console.log(`   📊 Response: ${res.status} - ${JSON.stringify(res.data).substring(0, 200)}`);
    
    if (res.status === 200 && res.data.success) {
      return { 
        success: true, 
        message: `Browser created - Session ID: ${res.data.session_id}` 
      };
    } else if (res.status === 401) {
      return { success: false, message: 'Authentication required (need WORKER_SECRET)' };
    } else if (res.status === 503) {
      return { success: false, message: 'Browser pool at capacity or not initialized' };
    }
    return { success: false, message: `Failed: ${JSON.stringify(res.data)}` };
  });
}

async function testBrowserActionEndpoint() {
  return runTest('Browser Action Endpoint (/api/browser/{id}/action)', async () => {
    // First create a browser
    const createRes = await makeRequest(`${WORKER_API_BASE}/api/browser/create`, 'POST', {
      account_id: 'test-account-002',
      headless: true
    }, {
      'X-API-Key': WORKER_SECRET
    });
    
    if (createRes.status !== 200 || !createRes.data.success) {
      return { success: false, message: `Cannot create browser for test: ${JSON.stringify(createRes.data)}` };
    }
    
    const sessionId = createRes.data.session_id;
    console.log(`   📌 Created session: ${sessionId}`);
    
    // Execute navigate action
    const actionRes = await makeRequest(`${WORKER_API_BASE}/api/browser/${sessionId}/action`, 'POST', {
      action: 'navigate',
      url: 'https://www.facebook.com'
    }, {
      'X-API-Key': WORKER_SECRET
    });
    
    if (actionRes.status === 200 && actionRes.data.success) {
      return { 
        success: true, 
        message: `Action executed - Duration: ${actionRes.data.duration_ms}ms` 
      };
    }
    return { success: false, message: `Action failed: ${JSON.stringify(actionRes.data)}` };
  });
}

async function testBrowserStateEndpoint() {
  return runTest('Browser State Endpoint (/api/browser/{id}/state)', async () => {
    // First create a browser
    const createRes = await makeRequest(`${WORKER_API_BASE}/api/browser/create`, 'POST', {
      account_id: 'test-account-003',
      headless: true
    }, {
      'X-API-Key': WORKER_SECRET
    });
    
    if (createRes.status !== 200 || !createRes.data.success) {
      return { success: false, message: `Cannot create browser: ${JSON.stringify(createRes.data)}` };
    }
    
    const sessionId = createRes.data.session_id;
    
    const stateRes = await makeRequest(`${WORKER_API_BASE}/api/browser/${sessionId}/state`, 'GET', null, {
      'X-API-Key': WORKER_SECRET
    });
    
    if (stateRes.status === 200) {
      return { 
        success: true, 
        message: `State retrieved - URL: ${stateRes.data.current_url}, Healthy: ${stateRes.data.is_healthy}` 
      };
    }
    return { success: false, message: `Failed: ${JSON.stringify(stateRes.data)}` };
  });
}

async function testBrowserScreenshotEndpoint() {
  return runTest('Browser Screenshot Endpoint (/api/browser/{id}/screenshot)', async () => {
    // First create a browser
    const createRes = await makeRequest(`${WORKER_API_BASE}/api/browser/create`, 'POST', {
      account_id: 'test-account-004',
      headless: true
    }, {
      'X-API-Key': WORKER_SECRET
    });
    
    if (createRes.status !== 200 || !createRes.data.success) {
      return { success: false, message: `Cannot create browser: ${JSON.stringify(createRes.data)}` };
    }
    
    const sessionId = createRes.data.session_id;
    
    const ssRes = await makeRequest(`${WORKER_API_BASE}/api/browser/${sessionId}/screenshot`, 'GET', null, {
      'X-API-Key': WORKER_SECRET
    });
    
    if (ssRes.status === 200 && ssRes.data.success) {
      const hasScreenshot = ssRes.data.screenshot && ssRes.data.screenshot.length > 100;
      return { 
        success: hasScreenshot, 
        message: hasScreenshot 
          ? `Screenshot captured - Size: ${ssRes.data.screenshot.length} chars` 
          : 'No screenshot data returned'
      };
    }
    return { success: false, message: `Failed: ${JSON.stringify(ssRes.data)}` };
  });
}

async function testBrowserVisionEndpoint() {
  return runTest('Browser Vision/AI Endpoint (/api/browser/{id}/vision)', async () => {
    const createRes = await makeRequest(`${WORKER_API_BASE}/api/browser/create`, 'POST', {
      account_id: 'test-account-005',
      headless: true
    }, {
      'X-API-Key': WORKER_SECRET
    });
    
    if (createRes.status !== 200 || !createRes.data.success) {
      return { success: false, message: `Cannot create browser: ${JSON.stringify(createRes.data)}` };
    }
    
    const sessionId = createRes.data.session_id;
    
    const visionRes = await makeRequest(`${WORKER_API_BASE}/api/browser/${sessionId}/vision`, 'POST', {
      prompt: 'Describe what you see on this page',
      include_ocr: true,
      identify_elements: true
    }, {
      'X-API-Key': WORKER_SECRET
    });
    
    if (visionRes.status === 200 && visionRes.data.success) {
      return { 
        success: true, 
        message: `Vision analysis complete - Elements found: ${visionRes.data.elements_found?.length || 0}` 
      };
    }
    return { success: false, message: `Failed: ${JSON.stringify(visionRes.data)}` };
  });
}

// ═══════════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════════

async function runAllTests() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║        🥷 IAI STEALTH SOLDIERS - ENDPOINT TEST SUITE                 ║');
  console.log('║        Testing Chromium Automation Infrastructure                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  console.log('📍 Configuration:');
  console.log(`   Main API: ${API_BASE}`);
  console.log(`   Worker API: ${WORKER_API_BASE}`);
  console.log(`   Auth Token: ${AUTH_TOKEN ? '***configured***' : '❌ NOT SET'}`);
  console.log(`   Worker Secret: ${WORKER_SECRET ? '***configured***' : '❌ NOT SET'}`);
  console.log('\n');

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 1: Main API Tests
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('SECTION 1: MAIN API ENDPOINTS (Node.js Backend)');
  console.log('═══════════════════════════════════════════════════════════════════');
  
  await testMainApiHealth();
  await testWorkerStatus();

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 2: Python Worker API Tests
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('SECTION 2: PYTHON WORKER API ENDPOINTS (FastAPI)');
  console.log('═══════════════════════════════════════════════════════════════════');
  
  await testWorkerApiHealth();
  await testBrowserCreateEndpoint();
  await testBrowserActionEndpoint();
  await testBrowserStateEndpoint();
  await testBrowserScreenshotEndpoint();
  await testBrowserVisionEndpoint();

  // ═══════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║                    📊 TEST SUMMARY                                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝');
  console.log(`\n   ✅ Passed: ${testResults.passed}`);
  console.log(`   ❌ Failed: ${testResults.failed}`);
  console.log(`   📈 Success Rate: ${Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100)}%`);

  if (testResults.errors.length > 0) {
    console.log('\n   💥 Errors:');
    testResults.errors.forEach(e => {
      console.log(`      - ${e.name}: ${e.error}`);
    });
  }

  console.log('\n   📋 All Results:');
  testResults.details.forEach(d => {
    const icon = d.status === 'PASSED' ? '✅' : d.status === 'FAILED' ? '❌' : '💥';
    console.log(`      ${icon} ${d.name}`);
  });

  console.log('\n');
}

runAllTests().catch(console.error);
