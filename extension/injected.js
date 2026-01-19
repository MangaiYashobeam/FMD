/**
 * Injected Script for DF-Auto Sim
 * 
 * This script gets injected into the page context to access
 * Facebook's internal APIs and React fiber data.
 * 
 * It communicates with the content script via custom events.
 */

(function() {
  'use strict';

  // Signal that injected script is ready
  window.dispatchEvent(new CustomEvent('dfautosim-injected-ready'));

  // Listen for commands from content script
  window.addEventListener('dfautosim-command', function(event) {
    const { command, data, requestId } = event.detail || {};
    
    let result = null;
    let error = null;

    try {
      switch (command) {
        case 'getReactFiber':
          // Get React fiber data from an element
          if (data?.selector) {
            const element = document.querySelector(data.selector);
            if (element) {
              const fiberKey = Object.keys(element).find(key => key.startsWith('__reactFiber$'));
              if (fiberKey) {
                result = { hasFiber: true };
              }
            }
          }
          break;

        case 'getPageData':
          // Get page-level data
          result = {
            url: window.location.href,
            title: document.title,
          };
          break;

        case 'ping':
          result = { status: 'ok', timestamp: Date.now() };
          break;

        default:
          error = `Unknown command: ${command}`;
      }
    } catch (e) {
      error = e.message;
    }

    // Send response back to content script
    window.dispatchEvent(new CustomEvent('dfautosim-response', {
      detail: { requestId, result, error }
    }));
  });

  console.log('[DF-Auto Sim] Injected script loaded');
})();
