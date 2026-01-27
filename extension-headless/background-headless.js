/**
 * DealersFace Pro - Headless Background Service Worker
 * 
 * Stripped-down version for server-side automation with Puppeteer/Chromium
 * No GUI - Pure automation functionality
 */

const API_BASE = 'https://dealersface.com/api';
const LOCAL_API = 'http://localhost:5000/api';

// Active mission state
let activeMissions = new Map();

// Listen for external commands (from Puppeteer or API)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[HEADLESS] Received message:', message.action);
  
  switch (message.action) {
    case 'START_MISSION':
      handleStartMission(message, sender, sendResponse);
      return true;
      
    case 'EXECUTE_PATTERN':
      handleExecutePattern(message, sender, sendResponse);
      return true;
      
    case 'GET_STATUS':
      handleGetStatus(message, sender, sendResponse);
      return true;
      
    case 'STOP_MISSION':
      handleStopMission(message, sender, sendResponse);
      return true;
      
    case 'IAI_MISSION_COMPLETE':
      handleMissionComplete(message, sender, sendResponse);
      return true;
      
    case 'IAI_MISSION_FAILED':
      handleMissionFailed(message, sender, sendResponse);
      return true;
      
    case 'IAI_PROGRESS':
      handleProgress(message, sender, sendResponse);
      return true;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
      return false;
  }
});

async function handleStartMission(message, sender, sendResponse) {
  try {
    const { missionId, vehicleData, authToken, patternName } = message;
    
    // Store mission state
    activeMissions.set(missionId, {
      status: 'starting',
      startTime: Date.now(),
      vehicleData,
      patternName,
      progress: []
    });
    
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      sendResponse({ success: false, error: 'No active tab found' });
      return;
    }
    
    // Navigate to FB Marketplace if needed
    if (!tab.url?.includes('facebook.com/marketplace')) {
      await chrome.tabs.update(tab.id, { 
        url: 'https://www.facebook.com/marketplace/create/vehicle' 
      });
      await new Promise(r => setTimeout(r, 3000));
    }
    
    // Send mission to content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'IAI_START_MISSION',
      missionId,
      vehicleData,
      authToken,
      patternName: patternName || 'FBM-Official-P1'
    });
    
    activeMissions.get(missionId).status = 'running';
    sendResponse({ success: true, missionId, response });
    
  } catch (error) {
    console.error('[HEADLESS] Start mission error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleExecutePattern(message, sender, sendResponse) {
  try {
    const { patternName, vehicleData, authToken } = message;
    const missionId = `mission_${Date.now()}`;
    
    // Delegate to START_MISSION
    handleStartMission({
      missionId,
      vehicleData,
      authToken,
      patternName
    }, sender, sendResponse);
    
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetStatus(message, sender, sendResponse) {
  try {
    const { missionId } = message;
    
    if (missionId) {
      const mission = activeMissions.get(missionId);
      sendResponse({ 
        success: true, 
        mission: mission || null,
        active: !!mission 
      });
    } else {
      // Return all missions
      const missions = {};
      activeMissions.forEach((v, k) => missions[k] = v);
      sendResponse({ 
        success: true, 
        missions,
        activeCount: activeMissions.size 
      });
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleStopMission(message, sender, sendResponse) {
  try {
    const { missionId } = message;
    
    if (activeMissions.has(missionId)) {
      const mission = activeMissions.get(missionId);
      mission.status = 'stopped';
      mission.endTime = Date.now();
      
      // Send stop signal to content script
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'IAI_STOP_MISSION',
          missionId
        });
      }
      
      sendResponse({ success: true, missionId });
    } else {
      sendResponse({ success: false, error: 'Mission not found' });
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

function handleMissionComplete(message, sender, sendResponse) {
  const { missionId, result } = message;
  
  if (activeMissions.has(missionId)) {
    const mission = activeMissions.get(missionId);
    mission.status = 'completed';
    mission.endTime = Date.now();
    mission.result = result;
    
    console.log('[HEADLESS] Mission completed:', missionId, result);
    
    // Report to API
    reportMissionResult(missionId, 'completed', result);
  }
  
  sendResponse({ success: true });
}

function handleMissionFailed(message, sender, sendResponse) {
  const { missionId, error } = message;
  
  if (activeMissions.has(missionId)) {
    const mission = activeMissions.get(missionId);
    mission.status = 'failed';
    mission.endTime = Date.now();
    mission.error = error;
    
    console.error('[HEADLESS] Mission failed:', missionId, error);
    
    // Report to API
    reportMissionResult(missionId, 'failed', null, error);
  }
  
  sendResponse({ success: true });
}

function handleProgress(message, sender, sendResponse) {
  const { missionId, progress } = message;
  
  if (activeMissions.has(missionId)) {
    const mission = activeMissions.get(missionId);
    mission.progress.push({
      timestamp: Date.now(),
      ...progress
    });
    
    console.log('[HEADLESS] Progress:', missionId, progress);
  }
  
  sendResponse({ success: true });
}

async function reportMissionResult(missionId, status, result, error = null) {
  try {
    // Get auth token from storage
    const { authToken } = await chrome.storage.local.get('authToken');
    
    await fetch(`${API_BASE}/missions/${missionId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ status, result, error })
    });
  } catch (e) {
    console.error('[HEADLESS] Failed to report result:', e);
  }
}

// External command interface for Puppeteer
chrome.runtime.onMessageExternal?.addListener((message, sender, sendResponse) => {
  console.log('[HEADLESS] External message from:', sender.origin);
  
  // Validate sender origin
  const allowedOrigins = [
    'https://dealersface.com',
    'http://localhost:5000',
    'http://localhost:3000'
  ];
  
  if (!allowedOrigins.some(o => sender.origin?.startsWith(o))) {
    sendResponse({ success: false, error: 'Unauthorized origin' });
    return false;
  }
  
  // Route to internal handler
  chrome.runtime.onMessage.dispatch(message, sender, sendResponse);
  return true;
});

console.log('[HEADLESS] Background service worker initialized');
