/**
 * Ad Queue Assessment Script
 * Mock Max-based assessment of ad campaigns
 */

let walletName = 'User'; // Default, will be fetched
let currentSessionIndex = 0; // Track which session we're viewing
let allSessions = []; // Store all sessions
let currentFilter = 'all'; // Track current filter

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeAssessment);

async function initializeAssessment() {
  try {
    // Get wallet name for personalization
    const result = await chrome.storage.local.get(['payattn_walletAddress']);
    if (result.payattn_walletAddress) {
      walletName = result.payattn_walletAddress.slice(0, 6);
    }
    
    // Set up event listeners
    setupPaginationControls();
    setupFilterControls();
    
    // Load sessions from storage
    await loadSessions();
    
    // Display current session
    await displayCurrentSession();
  } catch (error) {
    console.error('Initialization error:', error);
    showError('Failed to initialize assessment');
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
  if (currentSessionIndex > 0) {
    currentSessionIndex--;
    displayCurrentSession();
  }
}

function handleNextSession() {
  if (currentSessionIndex < allSessions.length - 1) {
    currentSessionIndex++;
    displayCurrentSession();
  }
}

async function loadSessions() {
  /**
   * Load all sessions from chrome storage
   * For now, we'll create a demo session with current ads
   */
  const sessions = await chrome.storage.local.get('payattn_sessions');
  allSessions = sessions.payattn_sessions || [];
  
  // If no sessions exist, create current session placeholder
  if (allSessions.length === 0) {
    // We'll fetch and create a session on demand
    allSessions = [{ id: generateSessionId(), timestamp: new Date().toISOString(), ads: null }];
  }
  
  // Always show the latest session first
  allSessions.reverse();
  currentSessionIndex = 0;
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
  
  const sessionElements = [
    { date: document.getElementById('sessionDate'), id: document.getElementById('sessionId') },
    { date: document.getElementById('sessionDateBottom'), id: document.getElementById('sessionIdBottom') },
  ];
  
  sessionElements.forEach(({ date, id }) => {
    if (date) date.textContent = formattedDate;
    if (id) id.textContent = `Session ID: ${session.id}`;
  });
}

function updatePaginationButtons() {
  const prevBtns = [document.getElementById('prevSession'), document.getElementById('prevSessionBottom')];
  const nextBtns = [document.getElementById('nextSession'), document.getElementById('nextSessionBottom')];
  
  prevBtns.forEach(btn => {
    if (btn) btn.disabled = currentSessionIndex === 0;
  });
  
  nextBtns.forEach(btn => {
    if (btn) btn.disabled = currentSessionIndex === allSessions.length - 1;
  });
}

async function fetchAndAssessAds(session) {
  try {
    const statusBanner = document.getElementById('statusBanner');
    const contentDiv = document.getElementById('content');
    
    // Update status
    statusBanner.innerHTML = `
      <p class="status-text">⏳ Fetching ad opportunities...</p>
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
      <p class="status-text">🤖 Max is assessing opportunities...</p>
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
      <p class="status-text">✅ Assessment complete!</p>
      <p class="status-subtext">Evaluated ${assessedAds.length} ads • ${offeredCount} offers • ${rejectedCount} rejected</p>
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
}

async function assessCampaign(campaign) {
  /**
   * Mock Max assessment logic
   * Max is an autonomous agent with personality who evaluates ads
   */
  
  const advertiser = campaign.advertiser || {};
  const targeting = campaign.targeting?.criteria || {};
  
  // Decision factors (mock analysis)
  const factors = {
    qualityRating: advertiser.qualityRating || 5,
    avgPaid: advertiser.avgPaid30d || 0,
    accountAge: advertiser.accountAge || 0,
    targetingMatch: evaluateTargeting(targeting),
  };
  
  // Mock thinking process
  const thinkingSteps = generateThinkingProcess(campaign, factors);
  
  // Decision logic with Max's personality
  let decision = 'REJECT';
  let reason = '';
  let offer = null;
  let thinkingFollowUp = '';
  
  // Quality rating threshold
  if (factors.qualityRating < 3) {
    reason = `Max says: Quality is too low. Not worth the risk.`;
    decision = 'REJECT';
  }
  // Payment threshold
  else if (factors.avgPaid < 0.008) {
    reason = `Max says: Payment's not enough. I can do better.`;
    decision = 'REJECT';
  }
  // Targeting criteria issues
  else if (!factors.targetingMatch) {
    reason = `Max says: Their targeting doesn't fit your profile.`;
    decision = 'REJECT';
  }
  // Good candidates - let's go strong
  else if (factors.qualityRating >= 8 && factors.avgPaid >= 0.03) {
    decision = 'MAKING OFFER';
    // New advertisers get strong offers, established ones get competitive
    if (factors.accountAge < 100) {
      offer = (Math.random() * 0.025 + 0.025).toFixed(4); // 0.025-0.05
      reason = `New player, let's go strong with £${offer}. They'll bite.`;
    } else {
      offer = (factors.avgPaid * 1.2).toFixed(4);
      reason = `Max says: £${offer} - fair and competitive for this caliber.`;
    }
  }
  // Moderate candidates
  else if (factors.qualityRating >= 6 && factors.avgPaid >= 0.015) {
    decision = 'MAKING OFFER';
    if (factors.accountAge < 100) {
      offer = (factors.avgPaid * 1.5).toFixed(4);
      reason = `New advertiser - they might be keen to spend. Offering £${offer}.`;
    } else {
      offer = (factors.avgPaid * 0.9).toFixed(4);
      reason = `Max says: Solid opportunity at £${offer}.`;
    }
  }
  // Borderline - targeting mismatch
  else if (targeting.age && targeting.age.min) {
    const age = Math.floor(Math.random() * 50) + 20; // Mock user age
    if (age < targeting.age.min || age > targeting.age.max) {
      reason = `Max says: Wrong demographic fit. They want ${targeting.age.min}-${targeting.age.max}, I'm ${age}.`;
      decision = 'REJECT';
    }
  } else {
    reason = `Max says: Not quite there. Let's skip this one.`;
    decision = 'REJECT';
  }
  
  return {
    decision,
    reason,
    offer,
    thinkingSteps,
  };
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
    steps.push(`Payment rate is quite low at £${payment.toFixed(4)}... hard to justify.`);
  } else if (payment < 0.02) {
    steps.push(`Fair payment at £${payment.toFixed(4)}, but not exceptional.`);
  } else if (payment < 0.04) {
    steps.push(`Decent offer - £${payment.toFixed(4)} per impression.`);
  } else {
    steps.push(`Strong payment rate at £${payment.toFixed(4)}. They're serious.`);
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
  
  // Color scheme: red=rejected, amber=offered, green=queued
  let statusClass = isRejected ? 'rejected' : isAccepted ? 'offered' : 'queued';
  let statusColor = isRejected ? 'red' : isAccepted ? 'amber' : 'green';
  
  const adDiv = document.createElement('div');
  adDiv.className = `ad-assessment ${statusClass}`;
  
  // Advertiser name for emoji approximation
  const adName = `${advertiser.name} - ${campaign.metadata?.category}` || campaign.name;
  
  adDiv.innerHTML = `
    <div class="ad-header">
      <div class="advertiser-logo">${getAdvertiserEmoji(advertiser.name)}</div>
      <div class="ad-info">
        <p class="ad-name">${adName}</p>
        <p class="advertiser-name">${advertiser.domain || 'advertiser.com'}</p>
      </div>
    </div>
    
    <div class="ad-body">
      <div class="thinking-text">
        💭 <strong>Max's thinking:</strong><br>
        ${assessment.thinkingSteps.map(step => `• ${step}`).join('<br>')}
      </div>
    </div>
    
    <div class="targeting-info">
      <div class="targeting-item">
        💰 Rating: ${advertiser.qualityRating || 5}/10
      </div>
      <div class="targeting-item">
        💵 Pays: £${(advertiser.avgPaid30d || 0).toFixed(4)}
      </div>
      <div class="targeting-item">
        📊 Account age: ${advertiser.accountAge || 0}d
      </div>
    </div>
    
    <div class="decision ${statusClass}">
      ${isRejected ? '❌' : isAccepted ? '💰' : '⏳'} ${assessment.decision}
      <br><span style="font-weight: normal; font-size: 12px; margin-top: 4px; display: block;">${assessment.reason}</span>
    </div>
    
    ${isAccepted ? `
      <div class="zk-proof">
        🔐 Ready to send ZK-Proofs for age, interests & income
        <span class="zk-badge">
          PENDING
        </span>
      </div>
    ` : ''}
  `;
  
  return adDiv;
}

function getAdvertiserEmoji(advertiserName) {
  /**
   * Simple mapping of advertiser names to emojis
   */
  const emojiMap = {
    'Tesla': '🚗',
    'Nike': '👟',
    'Rolex': '⌚',
    'Spotify': '🎵',
    'Apple': '🍎',
    'Microsoft': '💻',
    'BMW': '🏎️',
    'Audi': '🏎️',
    'Amazon': '📦',
    'Google': '🔍',
    'Meta': '📱',
    'Netflix': '🎬',
    'Uber': '🚕',
    'Airbnb': '🏠',
    'Masterclass': '🎓',
    'Udemy': '📚',
    'HelloFresh': '🍽️',
    'Shopify': '🛍️',
    'Coinbase': '₿',
    'Binance': '💹',
    'Phantom': '👻',
    'Revolut': '💳',
    'Monzo': '🏦',
    'Salesforce': '☁️',
    'Square': '▭',
    'Blue Apron': '👨‍🍳',
    'Patagonia': '🏔️',
    'REI': '🎒',
    'Headspace': '🧘',
  };
  
  // Find matching emoji or return default
  for (const [name, emoji] of Object.entries(emojiMap)) {
    if (advertiserName?.includes(name)) {
      return emoji;
    }
  }
  
  return '🏢'; // Default business emoji
}

function addSummary(total, offered, rejected, container) {
  /**
   * Add a summary statistics section at the end
   */
  const summaryDiv = document.createElement('div');
  summaryDiv.className = 'complete-summary';
  
  const queued = total - offered - rejected;
  
  summaryDiv.innerHTML = `
    <p class="summary-title">📊 Session Summary</p>
    <div class="summary-stats">
      <div class="summary-stat">
        <div class="stat-number">${total}</div>
        <div class="stat-label">Total Reviewed</div>
      </div>
      <div class="summary-stat">
        <div class="stat-number" style="color: #fed7aa;">💰 ${offered}</div>
        <div class="stat-label">Offers Made</div>
      </div>
      <div class="summary-stat">
        <div class="stat-number" style="color: #fca5a5;">❌ ${rejected}</div>
        <div class="stat-label">Rejected</div>
      </div>
      <div class="summary-stat">
        <div class="stat-number" style="color: #86efac;">⏳ ${queued}</div>
        <div class="stat-label">Queued</div>
      </div>
    </div>
  `;
  
  container.parentElement.appendChild(summaryDiv);
}

function showError(message) {
  const contentDiv = document.getElementById('content');
  const statusBanner = document.getElementById('statusBanner');
  
  statusBanner.innerHTML = `
    <p class="status-text">⚠️ Error</p>
    <p class="status-subtext">${message}</p>
  `;
  
  contentDiv.innerHTML = `<div class="error">❌ ${message}</div>`;
}

function generateSessionId() {
  /**
   * Generate a unique session ID
   */
  return `max_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
