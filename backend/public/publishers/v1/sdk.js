/**
 * PayAttn Publisher SDK v1.0
 * 
 * Simple integration for publishers to display privacy-preserving ads.
 * 
 * Usage:
 *   <script src="http://localhost:3000/publishers/v1/sdk.js" 
 *           data-publisher-id="YOUR_PUBLISHER_ID"></script>
 *   <div id="payattn-ad-slot"></div>
 * 
 * The SDK will:
 *   1. Request ad from extension via postMessage
 *   2. Display ad in #payattn-ad-slot
 *   3. Track impression (1+ second visible via Intersection Observer)
 *   4. Report to backend for settlement
 *   5. Track clicks (reporting only, no payment)
 */

(function() {
  'use strict';

  // Configuration
  const API_BASE = 'http://localhost:3000';
  const IMPRESSION_MIN_DURATION = 1000; // milliseconds
  const IMPRESSION_VISIBILITY_THRESHOLD = 0.5; // 50% of ad must be visible

  // Get publisher ID from script tag
  const scriptTag = document.currentScript;
  const publisherId = scriptTag ? scriptTag.getAttribute('data-publisher-id') : null;

  if (!publisherId) {
    console.error('[PayAttn SDK] Missing data-publisher-id attribute');
    return;
  }

  console.log('[PayAttn SDK] Initialized for publisher:', publisherId);

  // State
  let currentAd = null;
  let impressionStartTime = null;
  let impressionReported = false;

  /**
   * Request ad from extension via postMessage
   */
  function requestAd() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Ad request timeout (extension not responding)'));
      }, 5000);

      // Listen for response from extension
      const handleMessage = (event) => {
        // Validate origin (in production, check event.origin)
        if (event.data.type === 'PAYATTN_AD_RESPONSE') {
          clearTimeout(timeout);
          window.removeEventListener('message', handleMessage);

          if (event.data.ad) {
            resolve(event.data.ad);
          } else {
            reject(new Error(event.data.error || 'No ad available'));
          }
        }
      };

      window.addEventListener('message', handleMessage);

      // Send request to extension (via content script)
      window.postMessage({
        type: 'PAYATTN_REQUEST_AD',
        publisher_id: publisherId
      }, '*');

      console.log('[PayAttn SDK] Requested ad from extension');
    });
  }

  /**
   * Display ad in the ad slot
   */
  function displayAd(ad) {
    const adSlot = document.getElementById('payattn-ad-slot');
    
    if (!adSlot) {
      console.error('[PayAttn SDK] #payattn-ad-slot not found in DOM');
      return;
    }

    // Render ad (publisher can customize styling)
    adSlot.innerHTML = `
      <div class="payattn-ad" data-offer-id="${ad.offer_id}" style="
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 16px;
        background: white;
        max-width: 600px;
        margin: 20px 0;
      ">
        <div style="margin-bottom: 12px;">
          <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #111827;">
            ${escapeHtml(ad.headline)}
          </h3>
          <p style="margin: 0; font-size: 14px; color: #4b5563; line-height: 1.5;">
            ${escapeHtml(ad.body)}
          </p>
        </div>
        <a href="${escapeHtml(ad.destination_url)}" 
           target="_blank"
           rel="noopener noreferrer"
           class="payattn-ad-cta"
           style="
             display: inline-block;
             padding: 10px 24px;
             background: #2563eb;
             color: white;
             text-decoration: none;
             border-radius: 6px;
             font-weight: 600;
             font-size: 14px;
             transition: background 0.2s;
           "
           onmouseover="this.style.background='#1d4ed8'"
           onmouseout="this.style.background='#2563eb'">
          ${escapeHtml(ad.cta)}
        </a>
        <div style="margin-top: 12px; font-size: 10px; color: #9ca3af;">
          Ad by PayAttn • Privacy-preserving advertising
        </div>
      </div>
    `;

    currentAd = ad;
    impressionReported = false;

    // Track impression with Intersection Observer
    trackImpression(adSlot);

    // Track clicks
    const ctaButton = adSlot.querySelector('.payattn-ad-cta');
    if (ctaButton) {
      ctaButton.addEventListener('click', () => trackClick(ad.offer_id));
    }

    console.log('[PayAttn SDK] Ad displayed:', ad.offer_id);
  }

  /**
   * Track impression using Intersection Observer
   * Reports impression after ad is visible for 1+ continuous second
   */
  function trackImpression(adElement) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= IMPRESSION_VISIBILITY_THRESHOLD) {
            // Ad became visible
            if (!impressionStartTime) {
              impressionStartTime = Date.now();
              console.log('[PayAttn SDK] Ad became visible, starting timer...');
            }
          } else {
            // Ad not visible or below threshold
            if (impressionStartTime && !impressionReported) {
              const duration = Date.now() - impressionStartTime;
              
              if (duration >= IMPRESSION_MIN_DURATION) {
                // Valid impression!
                reportImpression(currentAd.offer_id, duration);
                impressionReported = true;
                observer.disconnect();
              } else {
                console.log(`[PayAttn SDK] Ad hidden before 1 second (${duration}ms), resetting timer`);
                impressionStartTime = null;
              }
            }
          }
        });
      },
      {
        threshold: IMPRESSION_VISIBILITY_THRESHOLD
      }
    );

    observer.observe(adElement);
  }

  /**
   * Report impression to backend for settlement
   */
  async function reportImpression(offerId, duration) {
    console.log(`[PayAttn SDK] 🎯 Reporting impression: ${offerId} (${duration}ms)`);

    try {
      const response = await fetch(`${API_BASE}/api/publisher/impressions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          offerId: offerId,
          publisherId: publisherId,
          duration: duration
        })
      });

      const result = await response.json();

      if (result.settled) {
        console.log('✅ [PayAttn SDK] Settlement completed!');
        console.log('💰 Transactions:', result.transactions);
        
        // Show settlement success message (optional)
        showSettlementResult(result);
      } else {
        console.warn('⚠️ [PayAttn SDK] Settlement incomplete:', result.message);
      }

    } catch (err) {
      console.error('❌ [PayAttn SDK] Failed to report impression:', err);
    }
  }

  /**
   * Track click (reporting only, no payment)
   */
  async function trackClick(offerId) {
    console.log(`[PayAttn SDK] 🖱️ Ad clicked: ${offerId}`);

    try {
      await fetch(`${API_BASE}/api/publisher/clicks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          offerId: offerId,
          publisherId: publisherId
        })
      });

      console.log('✅ [PayAttn SDK] Click tracked');
    } catch (err) {
      console.error('❌ [PayAttn SDK] Failed to track click:', err);
    }
  }

  /**
   * Show settlement result (optional visual feedback)
   */
  function showSettlementResult(result) {
    const adSlot = document.getElementById('payattn-ad-slot');
    if (!adSlot) return;

    const banner = document.createElement('div');
    banner.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 16px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      z-index: 10000;
      max-width: 300px;
      font-size: 14px;
    `;

    banner.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 8px;">✅ Payment Settled!</div>
      <div style="font-size: 12px; opacity: 0.9;">
        ${result.transactions.filter(t => t.success).length} of 3 transactions succeeded
      </div>
    `;

    document.body.appendChild(banner);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      banner.remove();
    }, 5000);
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Initialize SDK when DOM is ready
   */
  function init() {
    console.log('[PayAttn SDK] Requesting ad...');

    requestAd()
      .then((ad) => {
        displayAd(ad);
      })
      .catch((err) => {
        console.error('[PayAttn SDK] Failed to load ad:', err.message);
        
        // Show fallback message
        const adSlot = document.getElementById('payattn-ad-slot');
        if (adSlot) {
          adSlot.innerHTML = `
            <div style="padding: 20px; background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; text-align: center;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                💡 <strong>PayAttn Extension Required</strong><br>
                Install the PayAttn extension to see privacy-preserving ads and earn rewards.
              </p>
            </div>
          `;
        }
      });
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
