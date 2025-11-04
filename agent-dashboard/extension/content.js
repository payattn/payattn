/**
 * Content Script - Bridges website and extension
 * Listens for auth events from the page and forwards to background script
 */

// Wait for DOM to be fully loaded before setting attributes (avoids React hydration mismatch)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectExtensionId);
} else {
  // DOM already loaded, wait a bit for React hydration
  setTimeout(injectExtensionId, 100);
}

function injectExtensionId() {
  // Inject extension ID into the page (via DOM attribute)
  document.documentElement.setAttribute('data-payattn-extension-id', chrome.runtime.id);
  console.log('[PayAttn Extension] Set extension ID:', chrome.runtime.id);
}

// Listen for messages from the page (website)
window.addEventListener('message', (event) => {
  // Only accept messages from same origin
  if (event.origin !== window.location.origin) {
    return;
  }

  // Check for PayAttn auth message
  if (event.data?.type === 'PAYATTN_SAVE_AUTH') {
    console.log('[PayAttn Content] Received auth from page, forwarding to background...');
    
    // Forward to background script
    chrome.runtime.sendMessage({
      type: 'SAVE_AUTH',
      keyHash: event.data.keyHash,
      walletAddress: event.data.walletAddress,
      authToken: event.data.authToken
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[PayAttn Content] Error:', chrome.runtime.lastError);
        // Send response back to page
        window.postMessage({
          type: 'PAYATTN_AUTH_RESPONSE',
          success: false,
          error: chrome.runtime.lastError.message
        }, window.location.origin);
      } else {
        console.log('[PayAttn Content] Auth saved successfully!');
        // Send response back to page
        window.postMessage({
          type: 'PAYATTN_AUTH_RESPONSE',
          success: true
        }, window.location.origin);
      }
    });
  }
  
  // Check for PayAttn profile message
  if (event.data?.type === 'PAYATTN_SAVE_PROFILE') {
    console.log('[PayAttn Content] Received profile from page, forwarding to background...');
    
    // Forward to background script
    chrome.runtime.sendMessage({
      type: 'SAVE_PROFILE',
      walletAddress: event.data.walletAddress,
      encryptedData: event.data.encryptedData,
      version: event.data.version,
      timestamp: event.data.timestamp
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[PayAttn Content] Profile save error:', chrome.runtime.lastError);
        window.postMessage({
          type: 'PAYATTN_PROFILE_RESPONSE',
          success: false,
          error: chrome.runtime.lastError.message
        }, window.location.origin);
      } else {
        console.log('[PayAttn Content] Profile saved successfully!');
        window.postMessage({
          type: 'PAYATTN_PROFILE_RESPONSE',
          success: true
        }, window.location.origin);
      }
    });
  }
}, false);
