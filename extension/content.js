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
  // console.log('[PayAttn Extension] Set extension ID:', chrome.runtime.id);  // Debug only
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

  // Check for PayAttn ad request (from Publisher SDK)
  if (event.data?.type === 'PAYATTN_REQUEST_AD') {
    console.log('[PayAttn Content] Received ad request from publisher:', event.data.publisher_id);
    
    // Get funded offers from storage
    chrome.storage.local.get(['payattn_funded_offers'], (result) => {
      const fundedOffers = result.payattn_funded_offers || [];
      
      if (fundedOffers.length === 0) {
        console.log('[PayAttn Content] No funded offers available');
        window.postMessage({
          type: 'PAYATTN_AD_RESPONSE',
          ad: null,
          error: 'No ads available at this time'
        }, window.location.origin);
        return;
      }

      // Select first offer (FIFO)
      const selectedOffer = fundedOffers[0];
      console.log('[PayAttn Content] Selected offer:', selectedOffer.offer_id);

      // Return ad creative data to SDK
      window.postMessage({
        type: 'PAYATTN_AD_RESPONSE',
        ad: {
          offer_id: selectedOffer.offer_id,
          headline: selectedOffer.headline,
          body: selectedOffer.body,
          cta: selectedOffer.cta,
          destination_url: selectedOffer.destination_url
        }
      }, window.location.origin);
    });
  }
}, false);
