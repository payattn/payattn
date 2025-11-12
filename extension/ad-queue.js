/**
 * Ad Queue Assessment Script
 * Real Max-based assessment of ad campaigns using Venice AI
 * 
 * Note: Core assessment logic is in lib/max-assessor.js (shared with background.js)
 */

let walletName = 'User'; // Default, will be fetched
let currentSessionIndex = 0; // Track which session we're viewing
let allSessions = []; // Store all sessions
let currentFilter = 'all'; // Track current filter
let userProfile = null; // Loaded user profile for Max

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeAssessment);

async function initializeAssessment() {
  try {
    // Get wallet name for personalization
    const result = await chrome.storage.local.get(['payattn_walletAddress']);
    if (result.payattn_walletAddress) {
      walletName = result.payattn_walletAddress.slice(0, 6);
    }
    
    // Load user profile for Max
    await loadUserProfile();
    
    // Set up event listeners
    setupPaginationControls();
    setupFilterControls();
    setupFetchButton();
    
    // Load sessions from storage
    await loadSessions();
    
    // Display current session
    await displayCurrentSession();
  } catch (error) {
    console.error('Initialization error:', error);
    showError('Failed to initialize assessment');
  }
}

/**
 * Setup fetch ads button
 */
function setupFetchButton() {
  const fetchBtn = document.getElementById('fetchAdsBtn');
  if (fetchBtn) {
    fetchBtn.addEventListener('click', handleFetchAndAssess);
  }
}

/**
 * Load user profile from chrome.storage and decrypt if needed
 */
async function loadUserProfile() {
  try {
    console.log('[Max] Loading user profile...');
    
    // Get wallet address
    const result = await chrome.storage.local.get(['payattn_walletAddress', 'payattn_keyHash', 'payattn_authToken']);
    const walletAddress = result.payattn_walletAddress;
    const keyHash = result.payattn_keyHash;
    const authToken = result.payattn_authToken;
    
    if (!walletAddress) {
      console.warn('[Max] No wallet address found - user not authenticated');
      userProfile = null;
      return;
    }
    
    // Get encrypted profile
    const profileResult = await chrome.storage.local.get(`payattn_profile_${walletAddress}`);
    const profileData = profileResult[`payattn_profile_${walletAddress}`];
    
    if (!profileData || !profileData.encryptedData) {
      console.warn('[Max] No profile saved. User needs to create one first.');
      userProfile = null;
      return;
    }
    
    // Decrypt profile
    try {
      console.log('[Max] Decrypting profile...');
      
      const keyMaterial = await window.fetchKeyMaterial(keyHash, walletAddress, authToken);
      const decryptedJson = await window.decryptDataWithMaterial(
        profileData.encryptedData,
        keyMaterial,
        walletAddress
      );
      
      userProfile = JSON.parse(decryptedJson);
      console.log('[Max] User profile loaded successfully:', userProfile);
      
    } catch (decryptError) {
      console.error('[Max] Failed to decrypt profile:', decryptError);
      userProfile = null;
    }
    
  } catch (error) {
    console.error('[Max] Error loading profile:', error);
    userProfile = null;
  }
}

/**
 * Fetch ads from backend API
 */
async function fetchAdsFromBackend() {
  try {
    // Get wallet address for authentication
    const result = await chrome.storage.local.get(['payattn_walletAddress', 'payattn_last_ad_sync']);
    const walletAddress = result.payattn_walletAddress;
    
    if (!walletAddress) {
      console.warn('[Ad Queue] No wallet address found');
      return [];
    }
    
    // Use last sync time or epoch if first time
    const lastChecked = result.payattn_last_ad_sync || new Date(0).toISOString();
    console.log(`[Ad Queue] Fetching ads since: ${lastChecked}`);
    
    // Fetch from backend API
    const API_BASE = 'http://localhost:3000'; // TODO: Make configurable
    const response = await fetch(`${API_BASE}/api/user/adstream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': walletAddress
      },
      body: JSON.stringify({
        last_checked: lastChecked
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ads: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`[Ad Queue] Received ${data.count} ads from backend`);
    
    // Update last sync timestamp
    await chrome.storage.local.set({
      payattn_last_ad_sync: new Date().toISOString()
    });
    
    return data.ads || [];
    
  } catch (error) {
    console.error('[Ad Queue] Error fetching ads:', error);
    throw error; // Let caller handle error display
  }
}

function setupPaginationControls() {
  const prevBtns = [document.getElementById('prevSession'), document.getElementById('prevSessionBottom')];
  const nextBtns = [document.getElementById('nextSession'), document.getElementById('nextSessionBottom')];
  
  prevBtns.forEach(btn => {
    if (btn) btn.addEventListener('click', handlePreviousSession);
  });
  
  nextBtns.forEach(btn => {
    if (btn) btn.addEventListener('click', handleNextSession);
  });
}

function setupFilterControls() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class from all buttons
      filterBtns.forEach(b => b.classList.remove('filter-active'));
      // Add active class to clicked button
      btn.classList.add('filter-active');
      // Update filter and refresh display
      currentFilter = btn.dataset.filter;
      displayCurrentSession();
    });
  });
}

function handlePreviousSession() {
  // Backward = older sessions (higher index)
  if (currentSessionIndex < allSessions.length - 1) {
    currentSessionIndex++;
    displayCurrentSession();
  }
}

function handleNextSession() {
  // Forward = newer sessions (lower index)
  if (currentSessionIndex > 0) {
    currentSessionIndex--;
    displayCurrentSession();
  }
}

async function loadSessions() {
  /**
   * Load all sessions from chrome storage
   * Filter out empty sessions (automated checks with 0 ads) for ad-queue display
   */
  const result = await chrome.storage.local.get('payattn_max_sessions');
  const allStoredSessions = result.payattn_max_sessions || [];
  
  // Filter to only sessions with ads (exclude empty automated checks)
  allSessions = allStoredSessions.filter(session => session.ads.length > 0);
  
  // Sort by timestamp desc (newest first)
  allSessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // Always show the latest session first
  currentSessionIndex = 0;
  
  console.log(`[Ad Queue] Loaded ${allSessions.length} sessions with ads (${allStoredSessions.length} total sessions in storage)`);
}

/**
 * Handle fetch and assess button click
 * This creates a LIVE assessment session that user can watch
 */
async function handleFetchAndAssess() {
  const fetchBtn = document.getElementById('fetchAdsBtn');
  const statusBanner = document.getElementById('statusBanner');
  const contentDiv = document.getElementById('content');
  
  // Show status banner when fetch is clicked
  statusBanner.classList.add('visible');
  
  // Check if LLM provider is configured
  const hasConfigured = await window.LLMService.hasLLMConfigured();
  if (!hasConfigured) {
    statusBanner.className = 'status-banner visible';
    statusBanner.style.background = '#dc2626';
    statusBanner.style.borderColor = '#ef4444';
    statusBanner.innerHTML = `
      <p class="status-text"> LLM Provider Not Configured</p>
      <p class="status-subtext">Configure your AI provider in extension settings to use Max</p>
    `;
    
    contentDiv.innerHTML = `
      <div class="error" style="text-align: center; padding: 40px 20px;">
        <div style="font-size: 48px; margin-bottom: 16px;"></div>
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 12px;">AI Provider Not Configured</div>
        <div style="font-size: 14px; margin-bottom: 24px;">
          Max needs an AI provider to evaluate ads. Choose Venice AI or local LM Studio.
        </div>
        <a href="settings.html" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; transition: all 0.2s;">
           Open Settings
        </a>
        <div style="margin-top: 24px; font-size: 12px; color: #cbd5e1;">
          Venice AI: <a href="https://docs.venice.ai/overview/getting-started" target="_blank" style="color: #60a5fa; text-decoration: none;">Get free API key</a> | 
          Local: <a href="https://lmstudio.ai" target="_blank" style="color: #60a5fa; text-decoration: none;">Download LM Studio</a>
        </div>
      </div>
    `;
    return;
  }
  
  // Disable button
  fetchBtn.disabled = true;
  fetchBtn.textContent = ' Fetching ads...';
  
  try {
    // Create new session
    const newSession = {
      id: generateSessionId(),
      timestamp: new Date().toISOString(),
      triggerType: 'manual', // User clicked button
      ads: [],
    };
    
    // Update status
    statusBanner.innerHTML = `
      <p class="status-text"> Fetching ad campaigns...</p>
      <p class="status-subtext">Loading from database</p>
    `;
    statusBanner.className = 'status-banner processing';
    
    // Fetch ads from backend API
    let campaigns;
    try {
      campaigns = await fetchAdsFromBackend();
    } catch (fetchError) {
      console.error('[Ad Queue] Failed to fetch ads:', fetchError);
      statusBanner.className = 'status-banner visible';
      statusBanner.style.background = '#dc2626';
      statusBanner.style.borderColor = '#ef4444';
      statusBanner.innerHTML = `
        <p class="status-text"> Failed to fetch ads</p>
        <p class="status-subtext">${fetchError.message}</p>
      `;
      contentDiv.innerHTML = `
        <div class="error" style="text-align: center; padding: 40px 20px;">
          <div style="font-size: 48px; margin-bottom: 16px;"></div>
          <div style="font-size: 18px; font-weight: 600; margin-bottom: 12px;">Backend Connection Error</div>
          <div style="font-size: 14px; margin-bottom: 24px;">
            ${fetchError.message}
          </div>
          <div style="font-size: 12px; color: #64686e;">
            Make sure the backend server is running at http://localhost:3000
          </div>
        </div>
      `;
      fetchBtn.disabled = false;
      fetchBtn.textContent = ' Fetch & Assess New Ads';
      return;
    }
    
    if (campaigns.length === 0) {
      contentDiv.innerHTML = '<div class="info">No new ad campaigns available at this time</div>';
      statusBanner.innerHTML = `
        <p class="status-text"> All caught up!</p>
        <p class="status-subtext">No new ads to assess right now</p>
      `;
      statusBanner.className = 'status-banner success';
      fetchBtn.disabled = false;
      fetchBtn.textContent = ' Fetch & Assess New Ads';
      return;
    }
    
    console.log(`[Ad Queue] Fetched ${campaigns.length} campaigns, starting live assessment`);
    
    // Show all ads in "pending" state initially
    contentDiv.innerHTML = '<div class="ads-container"></div>';
    const adsContainer = contentDiv.querySelector('.ads-container');
    
    // Create placeholder cards for all ads (grey state)
    const adElements = [];
    campaigns.forEach((campaign, index) => {
      const adElement = createPendingAdElement(campaign, index);
      adsContainer.appendChild(adElement);
      adElements.push(adElement);
    });
    
    // Update status
    statusBanner.innerHTML = `
      <p class="status-text"> Max is assessing opportunities...</p>
      <p class="status-subtext">Evaluating ad 1 of ${campaigns.length}</p>
    `;
    
    // Assess each ad one by one with visual updates
    for (let i = 0; i < campaigns.length; i++) {
      const campaign = campaigns[i];
      const adElement = adElements[i];
      
      // Update status
      statusBanner.innerHTML = `
        <p class="status-text"> Max is assessing opportunities...</p>
        <p class="status-subtext">Evaluating ad ${i + 1} of ${campaigns.length}</p>
      `;
      
      // Mark as "processing" (amber) - but DON'T scroll yet
      adElement.classList.add('processing');
      
      // Call Venice AI to assess
      const assessment = await assessCampaign(campaign);
      
      // Update assessment in session
      newSession.ads.push({
        campaign,
        assessment,
      });
      
      // Replace placeholder with real assessment card
      const finalAdElement = createAdElement(campaign, assessment);
      adElement.replaceWith(finalAdElement);
      
      // NOW scroll after decision is made - scroll so top of decided ad is 10px from viewport top
      const elementTop = finalAdElement.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: elementTop - 10,
        behavior: 'smooth'
      });
      
      // Small delay for visual effect (optional, can remove)
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Save session to storage
    await saveSession(newSession);
    
    // Update status - complete
    statusBanner.className = 'status-banner complete';
    statusBanner.innerHTML = `
      <p class="status-text"> Assessment Complete</p>
      <p class="status-subtext">Evaluated ${campaigns.length} campaigns</p>
    `;
    
    // Add summary
    const offeredCount = newSession.ads.filter(a => a.assessment.decision === 'MAKING OFFER').length;
    const rejectedCount = newSession.ads.filter(a => a.assessment.decision === 'REJECT').length;
    addSummary(campaigns.length, offeredCount, rejectedCount, adsContainer);
    
    // Reload sessions to include new one
    await loadSessions();
    
    // Switch to viewing the new session
    currentSessionIndex = 0; // Newest session
    updatePaginationInfo(newSession);
    updatePaginationButtons();
    
    console.log('[Ad Queue] Live assessment complete, session saved');
    
  } catch (error) {
    console.error('[Ad Queue] Fetch and assess failed:', error);
    showError(`Failed to assess ads: ${error.message}`);
  } finally {
    fetchBtn.disabled = false;
    fetchBtn.textContent = ' Fetch & Assess New Ads';
  }
}

/**
 * Create a pending (grey) ad card before assessment
 */
function createPendingAdElement(campaign, index) {
  const advertiser = campaign.advertiser || {};
  
  const adDiv = document.createElement('div');
  adDiv.className = 'ad-assessment pending';
  adDiv.style.opacity = '0.5';
  
  const adName = `${advertiser.name} - ${campaign.campaign?.metadata?.category || campaign.metadata?.category}` || campaign.campaign?.name || campaign.name;
  
  adDiv.innerHTML = `
    <div class="ad-header">
      <div class="ad-info">
        <p class="ad-name">${adName}</p>
        <p class="advertiser-name">${advertiser.domain || 'advertiser.com'}</p>
      </div>
    </div>
    
    <div class="ad-body">
      <div class="thinking-text" style="color: #64748b;">
         <strong>Max is considering the opportunity...</strong><br>
        Ad queued for assessment
      </div>
    </div>
    
    <div class="targeting-info">
      <div class="targeting-item">
         Pays: $${(advertiser.avgPaid30d || 0).toFixed(4)}
      </div>
      <div class="targeting-item">
         Account Age: ${advertiser.accountAge || 0}d
      </div>
    </div>
    
    <div class="decision queued">
       Max is looking at the ad...
    </div>
  `;
  
  return adDiv;
}

/**
 * Save session to chrome.storage
 */
async function saveSession(session) {
  return new Promise((resolve) => {
    // Get existing sessions
    chrome.storage.local.get('payattn_max_sessions', (result) => {
      const sessions = result.payattn_max_sessions || [];
      
      // Add new session at the beginning
      sessions.unshift(session);
      
      // Save back
      chrome.storage.local.set({ payattn_max_sessions: sessions }, () => {
        console.log(`[Ad Queue] Session saved: ${session.id}`);
        resolve();
      });
    });
  });
}

async function displayCurrentSession() {
  try {
    const session = allSessions[currentSessionIndex];
    if (!session) {
      showError('No session found');
      return;
    }
    
    // Update pagination info
    updatePaginationInfo(session);
    
    // Update button states
    updatePaginationButtons();
    
    // Fetch ads if not already loaded
    if (!session.ads) {
      await fetchAndAssessAds(session);
    } else {
      renderAds(session.ads);
    }
  } catch (error) {
    console.error('Error displaying session:', error);
    showError('Failed to display session');
  }
}

function updatePaginationInfo(session) {
  const date = new Date(session.timestamp);
  const formattedDate = date.toLocaleDateString('en-GB', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  
  // Update date displays (no Session ID)
  const sessionDate = document.getElementById('sessionDate');
  const sessionDateBottom = document.getElementById('sessionDateBottom');
  if (sessionDate) sessionDate.textContent = formattedDate;
  if (sessionDateBottom) sessionDateBottom.textContent = formattedDate;
  
  // Update subtle Session ID below nav (if it exists)
  const subtleSessionId = document.getElementById('subtleSessionId');
  if (subtleSessionId) subtleSessionId.textContent = `Session ID: ${session.id}`;
}

function updatePaginationButtons() {
  const prevBtns = [document.getElementById('prevSession'), document.getElementById('prevSessionBottom')];
  const nextBtns = [document.getElementById('nextSession'), document.getElementById('nextSessionBottom')];
  
  // "Older" button (prevSession) should be disabled if we're at the last (oldest) session
  prevBtns.forEach(btn => {
    if (btn) btn.disabled = currentSessionIndex >= allSessions.length - 1;
  });
  
  // "Newer" button (nextSession) should be disabled if we're at index 0 (newest/most recent session)
  nextBtns.forEach(btn => {
    if (btn) btn.disabled = currentSessionIndex === 0;
  });
}

async function fetchAndAssessAds(session) {
  try {
    const statusBanner = document.getElementById('statusBanner');
    const contentDiv = document.getElementById('content');
    
    // Update status
    statusBanner.innerHTML = `
      <p class="status-text"> Fetching ad opportunities...</p>
      <p class="status-subtext">Connecting to campaign server</p>
    `;
    
    // Fetch campaigns from the API
    const response = await fetch('http://localhost:3000/api/campaigns');
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    const campaigns = data.campaigns || [];
    
    if (campaigns.length === 0) {
      contentDiv.innerHTML = '<div class="error">No ad campaigns available</div>';
      return;
    }
    
    // Update status banner
    statusBanner.classList.add('processing');
    statusBanner.innerHTML = `
      <p class="status-text"> Max is assessing opportunities...</p>
      <p class="status-subtext">Found ${campaigns.length} ad opportunities</p>
    `;
    
    // Process each campaign with mock assessment
    const assessedAds = [];
    
    for (const campaign of campaigns) {
      const assessment = await assessCampaign(campaign);
      assessedAds.push({ ...campaign, assessment });
      
      // Small delay between assessments for visual effect
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    // Store in session
    if (session) {
      session.ads = assessedAds;
    }
    
    // Update final status
    statusBanner.classList.remove('processing');
    statusBanner.classList.add('complete');
    
    const offeredCount = assessedAds.filter(a => a.assessment.decision === 'MAKING OFFER').length;
    const rejectedCount = assessedAds.filter(a => a.assessment.decision === 'REJECT').length;
    
    statusBanner.innerHTML = `
      <p class="status-text"> Assessment complete!</p>
      <p class="status-subtext">Evaluated ${assessedAds.length} ads  ${offeredCount} offers  ${rejectedCount} rejected</p>
    `;
    
    // Render the ads
    renderAds(assessedAds);
    
  } catch (error) {
    console.error('Error fetching ads:', error);
    showError(`Failed to fetch ads: ${error.message}`);
  }
}

function renderAds(assessedAds) {
  /**
   * Render ads based on current filter
   */
  const contentDiv = document.getElementById('content');
  contentDiv.innerHTML = '<div class="ads-container"></div>';
  const adsContainer = contentDiv.querySelector('.ads-container');
  
  // Filter ads based on current filter
  let filteredAds = assessedAds;
  if (currentFilter !== 'all') {
    filteredAds = assessedAds.filter(ad => {
      const decision = ad.assessment.decision;
      if (currentFilter === 'offered') return decision === 'MAKING OFFER';
      if (currentFilter === 'rejected') return decision === 'REJECT';
      if (currentFilter === 'queued') return decision === 'QUEUED';
      return true;
    });
  }
  
  if (filteredAds.length === 0) {
    adsContainer.innerHTML = '<div class="error">No ads match the selected filter</div>';
    return;
  }
  
  // Render each ad
  filteredAds.forEach(ad => {
    const adElement = createAdElement(ad.campaign || ad, ad.assessment);
    adsContainer.appendChild(adElement);
  });
  
  // Add summary
  const offeredCount = assessedAds.filter(a => a.assessment.decision === 'MAKING OFFER').length;
  const rejectedCount = assessedAds.filter(a => a.assessment.decision === 'REJECT').length;
  addSummary(assessedAds.length, offeredCount, rejectedCount, adsContainer);
  
  // Add event listeners for "View Details" buttons using event delegation
  adsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('zk-proof-details-btn')) {
      const proofData = e.target.getAttribute('data-proof-details');
      const proofs = JSON.parse(decodeURIComponent(proofData));
      alert('ZK-Proof details:\n\n' + JSON.stringify(proofs, null, 2));
    }
  });
}

/**
 * Hash a string to a field element for ZK circuits
 * Simple hash function for demo - in production use proper cryptographic hash
 */
function hashToFieldElement(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Submit offer with ZK proofs to backend
 * @param {Object} campaign - Campaign object with id
 * @param {number} price - Offer price in USD
 * @param {Object} zkProofs - Object with proof packages keyed by requirement type
 * @returns {Promise<Object>} Backend response with offer_id
 */
async function submitOfferToBackend(campaign, price, zkProofs) {
  try {
    console.log('[Offer Submission] Submitting offer to backend...');
    console.log(`[Offer Submission] Campaign: ${campaign.campaign?.id || campaign.campaign_id}, Price: $${price.toFixed(4)}`);
    
    // Get user credentials from storage
    // User ID is the wallet address (wallet-based authentication)
    const result = await chrome.storage.local.get(['payattn_walletAddress']);
    const walletAddress = result.payattn_walletAddress;
    const userId = walletAddress; // User ID = wallet address
    
    if (!walletAddress) {
      throw new Error('User not authenticated - no wallet address found');
    }
    
    // Convert price from USD to lamports
    // TODO: Fetch real-time SOL price from oracle (Pyth, Chainlink, etc.)
    const solPrice = 160; // USD per SOL (hardcoded for demo)
    const lamports = Math.floor((price / solPrice) * 1e9);
    
    console.log(`[Offer Submission] Amount: ${lamports} lamports (${(lamports / 1e9).toFixed(6)} SOL)`);
    
    // Format ZK proofs for backend
    // Backend expects: { age: {...}, interests: {...}, location: {...}, income: {...} }
    const formattedProofs = {};
    if (zkProofs && Object.keys(zkProofs).length > 0) {
      Object.entries(zkProofs).forEach(([key, proofPackage]) => {
        formattedProofs[key] = {
          proof: proofPackage.proof,
          publicSignals: proofPackage.publicSignals,
          circuitName: proofPackage.circuitName
        };
      });
      console.log(`[Offer Submission] Including ${Object.keys(formattedProofs).length} ZK proofs`);
    } else {
      console.warn('[Offer Submission] No ZK proofs to submit (this is unusual)');
    }
    
    // Prepare request body
    // Use the UUID 'id' field from ad_creative table (not campaign_id)
    const requestBody = {
      ad_creative_id: campaign.id, // UUID 'id' field from ad_creative table
      amount_lamports: lamports,
      zk_proofs: formattedProofs
    };
    
    // Submit to backend
    const response = await fetch('http://localhost:3000/api/user/offer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Backend returned ${response.status}: ${errorData.error || 'Unknown error'}`);
    }
    
    const data = await response.json();
    
    console.log(`[OK][OK][OK] [Offer Submission] Success! Offer ID: ${data.offer_id}`);
    console.log(`[Offer Submission] Status: ${data.status}`);
    console.log(`[Offer Submission] Next: Peggy will evaluate and potentially fund escrow`);
    
    return data;
    
  } catch (error) {
    console.error('[OK][OK][OK] [Offer Submission] Failed:', error.message);
    throw error;
  }
}

/**
 * Generate ZK-SNARK proofs for matched requirements
 * @param {Object} offer - The offer object with matchedRequirements
 * @param {Object} campaign - The campaign being assessed
 * @returns {Promise<Object>} Object with proof packages keyed by requirement type
 */
async function generateProofsForOffer(offer, campaign) {
  const proofs = [];
  
  if (!offer.matchedRequirements || offer.matchedRequirements.length === 0) {
    console.log('[ZK-Proof] No matched requirements to prove');
    return {};
  }
  
  // Get user profile for private inputs
  const storageResult = await chrome.storage.local.get(['payattn_walletAddress', 'payattn_keyHash', 'payattn_authToken']);
  const walletAddress = storageResult.payattn_walletAddress;
  
  if (!walletAddress) {
    console.warn('[ZK-Proof] No wallet address found - user not authenticated');
    return {};
  }
  
  // Load encrypted profile
  const profileResult = await chrome.storage.local.get(`payattn_profile_${walletAddress}`);
  const encryptedProfile = profileResult[`payattn_profile_${walletAddress}`];
  
  if (!encryptedProfile) {
    console.warn('[ZK-Proof] No profile data available - cannot generate proofs');
    return {};
  }
  
  // Decrypt profile
  const keyHash = storageResult.payattn_keyHash;
  const authToken = storageResult.payattn_authToken;
  
  if (!keyHash || !authToken) {
    console.warn('[ZK-Proof] Missing keyHash or authToken - cannot decrypt profile');
    return {};
  }
  
  try {
    const keyMaterial = await window.fetchKeyMaterial(keyHash, walletAddress, authToken);
    
    // Extract the encryptedData string from the profile object
    const encryptedDataString = encryptedProfile.encryptedData;
    if (!encryptedDataString) {
      throw new Error('No encryptedData property found in profile');
    }
    
    const decryptedJson = await window.decryptDataWithMaterial(
      encryptedDataString,
      keyMaterial,
      walletAddress
    );
    
    const profileData = JSON.parse(decryptedJson);
    
    // Process each matched requirement
    for (const requirement of offer.matchedRequirements) {
      try {
        const reqType = requirement.requirement;
        const advertiserCriteria = requirement.advertiserCriteria;
        
        // AGE PROOF - Use range_check circuit
        if (reqType === 'age') {
          const userAge = profileData.demographics?.age;
          const minAge = advertiserCriteria[0];
          const maxAge = advertiserCriteria[1];
          
          if (userAge && minAge !== undefined && maxAge !== undefined) {
            const proofPackage = await window.ZKProver.generateProof(
              'range_check',
              { value: userAge },
              { min: minAge, max: maxAge },
              { verbose: false }
            );
            
            proofs.push({
              type: 'range_check',
              requirement: 'age',
              proof: proofPackage,
              publicSignals: proofPackage.publicSignals
            });
          }
        }
        
        // INCOME PROOF - Use range_check circuit
        if (reqType === 'income') {
          const userIncome = profileData.financial?.income;
          const minIncome = advertiserCriteria[0];
          // If only one value provided, it's a minimum threshold
          const maxIncome = advertiserCriteria[1] || 1000000;
          
          if (userIncome && minIncome !== undefined) {
            const proofPackage = await window.ZKProver.generateProof(
              'range_check',
              { value: userIncome },
              { min: minIncome, max: maxIncome },
              { verbose: false }
            );
            
            proofs.push({
              type: 'range_check',
              requirement: 'income',
              proof: proofPackage,
              publicSignals: proofPackage.publicSignals
            });
          }
        }
        
        // LOCATION PROOF - Use set_membership circuit (max 10 countries)
        if (reqType === 'location') {
          const userCountry = profileData.location?.country;
          const allowedCountries = advertiserCriteria;
          
          if (userCountry && Array.isArray(allowedCountries) && allowedCountries.length > 0) {
            // Limit to 10 countries (circuit constraint)
            const limitedCountries = allowedCountries.slice(0, 10);
            
            // Hash country codes to field elements
            const userCountryHash = hashToFieldElement(userCountry);
            const allowedHashes = limitedCountries.map(c => hashToFieldElement(c));
            
            // Pad to exactly 10 elements (circuit expects fixed size)
            while (allowedHashes.length < 10) {
              allowedHashes.push(0);
            }
            
            console.log('[ZK-Debug] Location proof inputs:', {
              userCountry,
              userCountryHash,
              allowedCountries: limitedCountries,
              allowedHashes,
              arrayLength: allowedHashes.length
            });
            
            const proofPackage = await window.ZKProver.generateProof(
              'set_membership',
              { value: userCountryHash },
              { set: allowedHashes },  // Note: parameter is 'set' not 'allowedSet'
              { verbose: false }
            );
            
            proofs.push({
              type: 'set_membership',
              requirement: 'location',
              proof: proofPackage,
              publicSignals: proofPackage.publicSignals
            });
          }
        }
        
        // INTEREST PROOF - Use set_membership circuit (max 10 interests)
        if (reqType === 'interest') {
          const userInterests = profileData.interests || [];
          const requiredInterests = advertiserCriteria;
          
          if (userInterests.length > 0 && Array.isArray(requiredInterests) && requiredInterests.length > 0) {
            // Check if any user interest matches required interests
            const matchedInterest = userInterests.find(ui => 
              requiredInterests.some(ri => ri.toLowerCase() === ui.toLowerCase())
            );
            
            if (matchedInterest) {
              // Limit to 10 interests (circuit constraint)
              const limitedInterests = requiredInterests.slice(0, 10);
              
              const userInterestHash = hashToFieldElement(matchedInterest.toLowerCase());
              const allowedHashes = limitedInterests.map(i => hashToFieldElement(i.toLowerCase()));
              
              // Pad to exactly 10 elements (circuit expects fixed size)
              while (allowedHashes.length < 10) {
                allowedHashes.push(0);
              }
              
              const proofPackage = await window.ZKProver.generateProof(
                'set_membership',
                { value: userInterestHash },
                { set: allowedHashes },  // Note: parameter is 'set' not 'allowedSet'
                { verbose: false }
              );
              
              proofs.push({
                type: 'set_membership',
                requirement: 'interest',
                proof: proofPackage,
                publicSignals: proofPackage.publicSignals
              });
            }
          }
        }
      } catch (reqError) {
        console.error(`[ZK-Proof] Error generating proof for ${requirement.requirement}:`, reqError);
      }
    }
  } catch (decryptError) {
    console.error('[ZK-Proof] Failed to decrypt profile:', decryptError.message);
    return {};
  }
  
  // Convert array of proofs to keyed object format for backend
  // Backend expects: { age: {...}, location: {...}, income: {...}, interest: {...} }
  const proofsObject = {};
  for (const proofItem of proofs) {
    const key = proofItem.requirement; // 'age', 'location', 'income', 'interest'
    proofsObject[key] = {
      proof: proofItem.proof.proof,
      publicSignals: proofItem.proof.publicSignals,
      circuitName: proofItem.proof.circuitName
    };
  }
  
  // Output generated proofs if any
  if (Object.keys(proofsObject).length > 0) {
    console.log(`\n[OK][OK] [ZK-SNARK] Campaign: ${campaign.campaign?.id || campaign.campaign_id} - Generated ${Object.keys(proofsObject).length} proof(s):`);
    Object.entries(proofsObject).forEach(([type, proofPackage]) => {
      console.log(`   - ${type}: ${proofPackage.circuitName} (${proofPackage.publicSignals.length} public signals)`);
    });
    console.log('');
  }
  
  return proofsObject;
}

async function assessCampaign(campaign) {
  /**
   * Wrapper function that uses the modular Max assessor
   * This function is kept for backward compatibility with ad-queue.html
   */
  
  // Use the modular MaxAssessor to assess this single ad
  // userProfile is already loaded globally, so use it
  const assessment = await window.MaxAssessor.assessSingleAd(campaign, userProfile, {
    veniceModel: 'qwen3-next-80b',
    temperature: 0.7,
    autoSubmit: true,
    LLMService: window.LLMService  // Pass LLMService instance
  });
  
  return assessment;
}

function evaluateTargeting(targeting) {
  /**
   * Simple heuristic: if targeting has too many required fields, it's restrictive
   */
  if (!targeting || Object.keys(targeting).length === 0) return true;
  
  const restrictiveFactors = [
    targeting.employment?.status,
    targeting.gender ? (targeting.gender.length === 1) : false,
  ].filter(Boolean).length;
  
  return restrictiveFactors < 2;
}

function generateThinkingProcess(campaign, factors) {
  /**
   * Generate Max's realistic thinking process with personality
   * Max is thoughtful, conversational, and has opinions
   */
  const advertiser = campaign.advertiser?.name || 'Unknown';
  const quality = factors.qualityRating;
  const payment = factors.avgPaid;
  const accountAge = factors.accountAge;
  
  const steps = [];
  
  steps.push(`Looking at ${advertiser}...`);
  
  // Quality assessment
  if (quality < 4) {
    steps.push(`Advertiser quality looks a bit concerning (${quality}/10)...`);
  } else if (quality < 7) {
    steps.push(`Advertiser quality is moderate (${quality}/10), nothing remarkable.`);
  } else if (quality < 9) {
    steps.push(`Good advertiser track record (${quality}/10). Solid reputation.`);
  } else {
    steps.push(`Excellent advertiser (${quality}/10). They know what they're doing.`);
  }
  
  // Payment assessment
  if (payment < 0.01) {
    steps.push(`Payment rate is quite low at $${payment.toFixed(4)}... hard to justify.`);
  } else if (payment < 0.02) {
    steps.push(`Fair payment at $${payment.toFixed(4)}, but not exceptional.`);
  } else if (payment < 0.04) {
    steps.push(`Decent offer - $${payment.toFixed(4)} per impression.`);
  } else {
    steps.push(`Strong payment rate at $${payment.toFixed(4)}. They're serious.`);
  }
  
  // Account age assessment
  if (accountAge < 100) {
    steps.push(`New advertiser (${accountAge} days old). They might be keen to spend more...`);
  } else if (accountAge < 500) {
    steps.push(`Established advertiser with some history.`);
  } else {
    steps.push(`Very experienced advertiser. They've been around.`);
  }
  
  return steps;
}

function createAdElement(campaign, assessment) {
  const advertiser = campaign.advertiser || {};
  const isAccepted = assessment.decision === 'MAKING OFFER';
  const isRejected = assessment.decision === 'REJECT';
  
  // Color scheme: grey=pending, amber=processing, red=rejected, green=offered
  let statusClass = isRejected ? 'rejected' : isAccepted ? 'offered' : 'queued';
  
  const adDiv = document.createElement('div');
  adDiv.className = `ad-assessment ${statusClass}`;
  
  const adName = `${advertiser.name} - ${campaign.campaign?.metadata?.category || campaign.metadata?.category}` || campaign.campaign?.name || campaign.name;
  
  // Extract main assessment text (before SUMMARY)
  let mainAssessment = '';
  let summaryBullets = [];
  
  if (assessment.narrative) {
    const lines = assessment.narrative.split('\n').filter(p => p.trim().length > 0);
    
    // Find SUMMARY and DECISION lines
    const summaryIndex = lines.findIndex(l => l.trim() === 'SUMMARY:');
    const decisionIndex = lines.findIndex(l => l.includes('DECISION:'));
    
    // Main assessment is everything before SUMMARY (new order: narrative  SUMMARY  DECISION)
    if (summaryIndex > 0) {
      mainAssessment = lines.slice(0, summaryIndex).join(' ').trim();
    } else if (decisionIndex > 0) {
      // Fallback for old format (narrative  DECISION  SUMMARY)
      mainAssessment = lines.slice(0, decisionIndex).join(' ').trim();
    } else {
      mainAssessment = lines[0] || '';
    }
    
    // Extract summary bullets (between SUMMARY: and DECISION:)
    if (summaryIndex >= 0) {
      const bulletLines = decisionIndex > summaryIndex 
        ? lines.slice(summaryIndex + 1, decisionIndex)
        : lines.slice(summaryIndex + 1);
      
      summaryBullets = bulletLines
        .filter(l => l.trim().startsWith(''))
        .map(l => l.trim().substring(1).trim());
    }
  }
  
  // Show offer details if tool call was made
  let offerDetailsHTML = '';
  if (isAccepted && assessment.toolCallResults && assessment.toolCallResults.length > 0) {
    const offer = assessment.toolCallResults[0];
    offerDetailsHTML = `
      <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; padding: 10px; margin-top: 8px;">
        <div style="font-weight: 600; font-size: 13px; color: #86efac; margin-bottom: 6px;">Offer: $${offer.price.toFixed(4)}</div>
        <div style="font-size: 11px; color: #94a3b8;">
          ${offer.matchedRequirements?.length || 0} provable requirement${offer.matchedRequirements?.length === 1 ? '' : 's'}
        </div>
      </div>
    `;
  } else if (isAccepted && assessment.offer) {
    offerDetailsHTML = `
      <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; padding: 10px; margin-top: 8px;">
        <div style="font-weight: 600; font-size: 13px; color: #86efac;">Offer: $${parseFloat(assessment.offer).toFixed(4)}</div>
      </div>
    `;
  }
  
  // Format summary bullets - ONLY SHOW FOR ACCEPTED ADS
  let summaryHTML = '';
  if (isAccepted && summaryBullets.length > 0) {
    summaryHTML = `
      <div style="margin-top: 8px; font-size: 12px; color: #cbd5e1;">
        ${summaryBullets.map(bullet => `<div style="margin: 4px 0;"> ${bullet}</div>`).join('')}
      </div>
    `;
  }
  // For REJECTED ads, don't show the summary at all
  
  adDiv.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
      <div class="ad-header" style="flex: 1; margin-bottom: 0;">
        <div class="ad-info">
          <p class="ad-name">${adName}</p>
          <p class="advertiser-name">${advertiser.domain || 'advertiser.com'}</p>
        </div>
      </div>
      
      <div class="targeting-info" style="flex-direction: column; gap: 6px; align-items: flex-end; margin: 0;">
        <div class="targeting-item" style="font-size: 11px;">
          Avg Paid: $${(advertiser.avgPaid30d || 0).toFixed(4)}
        </div>
        <div class="targeting-item" style="font-size: 11px;">
          Account Age: ${advertiser.accountAge || 0}d
        </div>
      </div>
    </div>
    
    <div class="ad-body">
      <div class="thinking-text" style="font-style: normal;">
        <strong>Max's Assessment:</strong><br>
        ${mainAssessment || 'Evaluating...'}
      </div>
    </div>
    
    <div class="decision ${statusClass}" style="margin-top: 12px;">
      <div style="font-weight: 700; font-size: 14px;">
        ${isRejected ? ' REJECTED' : isAccepted ? ' MAKING OFFER' : ' Max is thinking about this one...'}
      </div>
      ${isAccepted ? summaryHTML : ''}
      ${offerDetailsHTML}
      ${isRejected ? summaryHTML : ''}
    </div>
    
    ${isAccepted ? `
      <div class="zk-proof">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div style="flex: 1;">
             <strong>ZK-Proofs being sent:</strong> 
            ${assessment.toolCallResults && assessment.toolCallResults[0]?.matchedRequirements 
              ? assessment.toolCallResults[0].matchedRequirements.map(req => {
                  // Extract requirement type from string or object
                  let reqType = '';
                  if (typeof req === 'string') {
                    reqType = req;
                  } else if (req && req.requirement) {
                    reqType = req.requirement;
                  } else {
                    reqType = JSON.stringify(req);
                  }
                  
                  // Format requirement names nicely
                  const lowerType = reqType.toLowerCase();
                  if (lowerType.includes('age')) return 'Age';
                  if (lowerType.includes('location') || lowerType.includes('country')) return 'Location';
                  if (lowerType.includes('income')) return 'Income';
                  if (lowerType.includes('interest')) return 'Interests';
                  if (lowerType.includes('gender')) return 'Gender';
                  return reqType.charAt(0).toUpperCase() + reqType.slice(1);
                }).join(', ')
              : 'Generating...'
            }
          </div>
        </div>
      </div>
    ` : ''}
  `;
  
  return adDiv;
}

function getAdvertiserEmoji(advertiserName) {
  /**
   * Return initials instead of emojis for cleaner look
   */
  if (!advertiserName) return 'AD';
  
  // Get first two letters of advertiser name
  const initials = advertiserName.substring(0, 2).toUpperCase();
  return initials;
}

function addSummary(total, offered, rejected, container) {
  /**
   * Add a summary statistics section at the end with clickable filters
   */
  const summaryDiv = document.createElement('div');
  summaryDiv.className = 'complete-summary';
  
  summaryDiv.innerHTML = `
    <p class="summary-title">Session Summary</p>
    <div class="summary-stats">
      <div class="summary-stat" data-filter="all" style="cursor: pointer;">
        <div class="stat-number">${total}</div>
        <div class="stat-label">Total Reviewed</div>
      </div>
      <div class="summary-stat" data-filter="offered" style="cursor: pointer;">
        <div class="stat-number" style="color: #86efac;">${offered}</div>
        <div class="stat-label">Offers Made</div>
      </div>
      <div class="summary-stat" data-filter="rejected" style="cursor: pointer;">
        <div class="stat-number" style="color: #fca5a5;">${rejected}</div>
        <div class="stat-label">Rejected</div>
      </div>
    </div>
  `;
  
  container.parentElement.appendChild(summaryDiv);
  
  // Add click handlers to summary stats
  const statElements = summaryDiv.querySelectorAll('.summary-stat');
  statElements.forEach(stat => {
    stat.addEventListener('click', () => {
      const filter = stat.dataset.filter;
      
      // Update current filter
      currentFilter = filter;
      
      // Update filter buttons
      const filterBtns = document.querySelectorAll('.filter-btn');
      filterBtns.forEach(btn => {
        if (btn.dataset.filter === filter) {
          btn.classList.add('filter-active');
        } else {
          btn.classList.remove('filter-active');
        }
      });
      
      // Re-display session with new filter
      displayCurrentSession();
    });
    
    // Add hover effect
    stat.addEventListener('mouseenter', () => {
      stat.style.background = 'rgba(255, 255, 255, 0.1)';
      stat.style.transform = 'scale(1.05)';
      stat.style.transition = 'all 0.2s';
    });
    stat.addEventListener('mouseleave', () => {
      stat.style.background = 'rgba(0, 0, 0, 0.2)';
      stat.style.transform = 'scale(1)';
    });
  });
}

function showError(message) {
  const contentDiv = document.getElementById('content');
  const statusBanner = document.getElementById('statusBanner');
  
  statusBanner.innerHTML = `
    <p class="status-text"> Error</p>
    <p class="status-subtext">${message}</p>
  `;
  
  contentDiv.innerHTML = `<div class="error"> ${message}</div>`;
}

function generateSessionId() {
  /**
   * Generate a unique session ID
   */
  return `max_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
