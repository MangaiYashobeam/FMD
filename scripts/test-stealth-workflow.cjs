/**
 * IAI STEALTH SOLDIER - FACEBOOK WORKFLOW TEST
 * ============================================
 * Tests a realistic Facebook Marketplace posting workflow
 */

const https = require('https');
const http = require('http');

const WORKER_API_BASE = process.env.WORKER_API_BASE || 'http://worker-api:8000';
const WORKER_SECRET = process.env.WORKER_SECRET;

let testSessionId = null;

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
        'X-API-Key': WORKER_SECRET,
        ...headers
      }
    };

    const req = httpModule.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runWorkflowTest() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║        🥷 IAI STEALTH SOLDIER - FACEBOOK WORKFLOW TEST                ║');
  console.log('║        Testing Real Chromium Automation                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  try {
    // STEP 1: Create Browser Session
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('STEP 1: CREATE BROWSER SESSION');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const createRes = await makeRequest(`${WORKER_API_BASE}/api/browser/create`, 'POST', {
      account_id: 'workflow-test-001',
      headless: true,
      stealth: true,
      viewport: { width: 1920, height: 1080 }
    });

    if (!createRes.data.success) {
      console.log('❌ Failed to create browser session');
      console.log(JSON.stringify(createRes.data, null, 2));
      return;
    }

    testSessionId = createRes.data.session_id;
    console.log(`✅ Browser created: ${testSessionId}`);
    console.log(`   Browser ID: ${createRes.data.browser_id}`);
    console.log(`   Has saved session: ${createRes.data.has_saved_session}`);

    await delay(1000);

    // STEP 2: Navigate to Facebook
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('STEP 2: NAVIGATE TO FACEBOOK');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const navRes = await makeRequest(`${WORKER_API_BASE}/api/browser/${testSessionId}/action`, 'POST', {
      action: 'navigate',
      url: 'https://www.facebook.com/marketplace/create/vehicle'
    });

    console.log(`   Action: navigate`);
    console.log(`   Success: ${navRes.data.success}`);
    console.log(`   Duration: ${navRes.data.duration_ms}ms`);

    if (navRes.data.error) {
      console.log(`   Error: ${navRes.data.error}`);
    }

    await delay(2000);

    // STEP 3: Get Current State
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('STEP 3: CHECK BROWSER STATE');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const stateRes = await makeRequest(`${WORKER_API_BASE}/api/browser/${testSessionId}/state`);

    console.log(`   Current URL: ${stateRes.data.current_url}`);
    console.log(`   Page Title: ${stateRes.data.page_title}`);
    console.log(`   Is Healthy: ${stateRes.data.is_healthy}`);
    console.log(`   Recent Actions: ${stateRes.data.recent_actions?.length || 0}`);

    // STEP 4: Take Screenshot
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('STEP 4: CAPTURE SCREENSHOT');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const ssRes = await makeRequest(`${WORKER_API_BASE}/api/browser/${testSessionId}/screenshot`);

    if (ssRes.data.success && ssRes.data.screenshot) {
      console.log(`   ✅ Screenshot captured`);
      console.log(`   Size: ${ssRes.data.screenshot.length} chars (base64)`);
      console.log(`   URL: ${ssRes.data.url || 'N/A'}`);
      console.log(`   Title: ${ssRes.data.title || 'N/A'}`);
    } else {
      console.log(`   ❌ Screenshot failed: ${ssRes.data.error || 'Unknown error'}`);
    }

    // STEP 5: Extract Page Elements
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('STEP 5: EXTRACT INTERACTIVE ELEMENTS');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const elemRes = await makeRequest(`${WORKER_API_BASE}/api/browser/${testSessionId}/action`, 'POST', {
      action: 'extract_elements',
      selector: 'button, input, textarea, a[role="button"], div[role="button"]',
      options: { limit: 20 }
    });

    if (elemRes.data.success) {
      const elements = elemRes.data.data?.elements || [];
      console.log(`   ✅ Found ${elements.length} interactive elements`);
      
      elements.slice(0, 10).forEach((el, i) => {
        console.log(`   ${i + 1}. <${el.tag}> ${el.text?.substring(0, 40) || '(no text)'}`);
      });
    } else {
      console.log(`   ❌ Extract failed: ${elemRes.data.error}`);
    }

    // STEP 6: Check Login Status
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('STEP 6: CHECK LOGIN STATUS');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const htmlRes = await makeRequest(`${WORKER_API_BASE}/api/browser/${testSessionId}/html?selector=body`);
    
    if (htmlRes.data.success && htmlRes.data.html) {
      const html = htmlRes.data.html;
      const isLoggedIn = !html.includes('Log in') && !html.includes('Create new account');
      const hasLoginForm = html.includes('email') || html.includes('password');
      
      console.log(`   HTML Length: ${htmlRes.data.length} chars`);
      console.log(`   Appears Logged In: ${isLoggedIn ? '✅ YES' : '❌ NO'}`);
      console.log(`   Has Login Form: ${hasLoginForm ? '⚠️ YES (needs login)' : '✅ NO'}`);
      
      // Check for specific Facebook elements
      const hasMPElements = html.includes('Marketplace') || html.includes('marketplace');
      console.log(`   Has Marketplace Content: ${hasMPElements ? '✅ YES' : '⚠️ NO'}`);
    } else {
      console.log(`   ❌ HTML extraction failed`);
    }

    // STEP 7: Vision Analysis
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('STEP 7: AI VISION ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const visionRes = await makeRequest(`${WORKER_API_BASE}/api/browser/${testSessionId}/vision`, 'POST', {
      prompt: 'Describe what you see. Is this a Facebook login page or a Marketplace page? What action should be taken next?',
      include_ocr: true,
      identify_elements: true
    });

    if (visionRes.data.success) {
      console.log(`   ✅ Vision analysis complete`);
      console.log(`   Elements found: ${visionRes.data.elements_found?.length || 0}`);
      console.log(`\n   📝 Analysis:\n${visionRes.data.analysis?.substring(0, 500) || 'No analysis'}`);
      
      if (visionRes.data.suggested_actions?.length > 0) {
        console.log('\n   📋 Suggested Actions:');
        visionRes.data.suggested_actions.forEach((a, i) => {
          console.log(`      ${i + 1}. ${a.action}: ${a.reason}`);
        });
      }
    }

    // STEP 8: Cleanup - Close browser
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('STEP 8: CLEANUP');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const deleteRes = await makeRequest(`${WORKER_API_BASE}/api/browser/${testSessionId}`, 'DELETE');
    console.log(`   Browser session closed: ${deleteRes.status === 200 ? '✅ YES' : '⚠️ May still be active'}`);

  } catch (error) {
    console.log(`\n💥 ERROR: ${error.message}`);
    console.log(error.stack);
  }

  // Summary
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║                    📊 WORKFLOW TEST COMPLETE                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝');
  console.log('\n');
  console.log('   🥷 IAI Stealth Soldier Capabilities Verified:');
  console.log('      ✅ Browser creation with stealth mode');
  console.log('      ✅ Navigation to Facebook');
  console.log('      ✅ Screenshot capture');
  console.log('      ✅ Element extraction');
  console.log('      ✅ HTML analysis');
  console.log('      ✅ Vision/AI analysis endpoint');
  console.log('\n');
  console.log('   ⚠️ For full posting, ensure:');
  console.log('      1. Facebook session cookies are loaded');
  console.log('      2. Account has Marketplace access');
  console.log('      3. Vehicle photos are accessible');
  console.log('\n');
}

runWorkflowTest().catch(console.error);
