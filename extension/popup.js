/**
 * Popup UI Script
 */

// Wait for DOM and Chrome APIs to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPopup);
} else {
  initPopup();
}

function initPopup() {
  console.log('[popup] Initializing...');
  checkAuth();
  
  // Listen for storage changes (when auth changes from website disconnect)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.payattn_keyHash || changes.payattn_walletAddress || changes.payattn_authToken) {
        console.log('[popup] Auth changed, reloading...');
        checkAuth();
      }
    }
  });
}

/**
 * Check if user is authenticated
 */
async function checkAuth() {
  try {
    console.log('[popup] Checking authentication...');
    
    // Use chrome.storage API properly
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      console.error('Chrome storage API not available');
      showNotAuthState();
      return;
    }
    
    chrome.storage.local.get(['payattn_keyHash', 'payattn_walletAddress', 'payattn_authToken'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Storage error:', chrome.runtime.lastError);
        showNotAuthState();
        return;
      }
      
      // Check for BOTH keyHash AND authToken - both required for authentication
      if (result.payattn_keyHash && result.payattn_authToken) {
        // Authenticated
        showAuthState(result.payattn_walletAddress);
        loadStatus();
      } else {
        // Not authenticated
        showNotAuthState();
      }
    });
  } catch (error) {
    console.error('Error checking auth:', error);
    showNotAuthState();
  }
}

/**
 * Show not authenticated state
 */
function showNotAuthState() {
  const notAuthState = document.getElementById('notAuthState');
  const authState = document.getElementById('authState');
  
  if (notAuthState) notAuthState.classList.remove('hidden');
  if (authState) authState.classList.add('hidden');
  
  // Setup button handler
  const setupButton = document.getElementById('setupButton');
  if (setupButton) {
    setupButton.addEventListener('click', () => {
      chrome.tabs.create({
        url: chrome.runtime.getURL('setup.html')
      });
    });
  }
}

/**
 * Show authenticated state
 */
function showAuthState(walletAddress) {
  const notAuthState = document.getElementById('notAuthState');
  const authState = document.getElementById('authState');
  
  if (notAuthState) notAuthState.classList.add('hidden');
  if (authState) authState.classList.remove('hidden');
  
  // Show wallet address
  if (walletAddress) {
    const walletAddrEl = document.getElementById('walletAddr');
    if (walletAddrEl) {
      walletAddrEl.textContent = 
        `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
    }
  }
  
  // Set up event listeners
  const runNowBtn = document.getElementById('runNow');
  const refreshBtn = document.getElementById('refresh');
  const manageWalletBtn = document.getElementById('manageWallet');
  const manageProfileBtn = document.getElementById('manageProfile');
  const adDashboardBtn = document.getElementById('adDashboard');
  const adQueueBtn = document.getElementById('adQueue');
  const openDashboardLink = document.getElementById('openDashboard');
  
  if (runNowBtn) {
    runNowBtn.addEventListener('click', handleRunNow);
  }
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadStatus);
  }
  if (manageWalletBtn) {
    manageWalletBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'http://localhost:3000/wallet-auth' });
    });
  }
  if (manageProfileBtn) {
    manageProfileBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('profile.html') });
    });
  }
  if (adDashboardBtn) {
    adDashboardBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'http://localhost:3000/dashboard' });
    });
  }
  if (adQueueBtn) {
    adQueueBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('ad-queue.html') });
    });
  }
  if (openDashboardLink) {
    openDashboardLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'http://localhost:3000/dashboard' });
    });
  }
}

/**
 * Load current status and logs
 */
async function loadStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    
    // Update status
    if (response.status) {
      const lastRun = new Date(response.status.lastRunAt);
      const nextRun = new Date(response.status.nextRunAt);
      
      document.getElementById('lastRun').textContent = lastRun.toLocaleString();
      document.getElementById('nextRun').textContent = nextRun.toLocaleString();
    } else {
      document.getElementById('lastRun').textContent = 'Never';
      document.getElementById('nextRun').textContent = 'Waiting...';
    }
    
    // Update logs
    const logsContainer = document.getElementById('logsContainer');
    logsContainer.innerHTML = '';
    
    if (response.logs && response.logs.length > 0) {
      // Show last 5 logs
      const recentLogs = response.logs.slice(-5).reverse();
      
      recentLogs.forEach(log => {
        const div = document.createElement('div');
        div.className = `log-entry ${log.success ? 'log-success' : 'log-error'}`;
        
        const time = new Date(log.timestamp).toLocaleString();
        const icon = log.success ? '✅' : '❌';
        
        div.innerHTML = `
          <div><strong>${icon} ${time}</strong></div>
          <div>${log.error || `Processed ${log.profilesProcessed} profile(s)`}</div>
        `;
        
        logsContainer.appendChild(div);
      });
    } else {
      logsContainer.innerHTML = '<div style="padding: 8px; color: #64748b;">No executions yet</div>';
    }
    
    // Load and display profile data
    await loadProfileData();
    
  } catch (error) {
    console.error('Failed to load status:', error);
  }
}

/**
 * Load profile data from chrome.storage and decrypt it
 */
async function loadProfileData() {
  try {
    // Get wallet address and keyHash
    const result = await chrome.storage.local.get(['payattn_walletAddress', 'payattn_keyHash']);
    const walletAddress = result.payattn_walletAddress;
    const keyHash = result.payattn_keyHash;
    
    const profileCardEl = document.getElementById('profileCard');
    
    if (!walletAddress || !keyHash) {
      profileCardEl.innerHTML = '<span style="color: #94a3b8;">Authentication required</span>';
      return;
    }
    
    // Get profile from chrome.storage
    const profileResult = await chrome.storage.local.get(`payattn_profile_${walletAddress}`);
    const profileData = profileResult[`payattn_profile_${walletAddress}`];
    
    if (!profileData || !profileData.encryptedData) {
      profileCardEl.innerHTML = '<span style="color: #64748b;">No profile saved yet. Click "Manage Profile" to create one!</span>';
      return;
    }
    
    // Show loading state
    profileCardEl.innerHTML = '<span style="color: #94a3b8;">🔓 Decrypting profile...</span>';
    
    // Get authToken from storage
    const authResult = await chrome.storage.local.get(['payattn_authToken']);
    const authToken = authResult.payattn_authToken;
    
    if (!authToken) {
      profileCardEl.innerHTML = '<span style="color: #f59e0b;">⚠️ Authentication required</span>';
      return;
    }
    
    // Fetch key material and decrypt
    try {
      const keyMaterial = await fetchKeyMaterial(keyHash, walletAddress, authToken);
      const decryptedJson = await decryptDataWithMaterial(
        profileData.encryptedData,
        keyMaterial,
        walletAddress
      );
      const profile = JSON.parse(decryptedJson);
      
      // Render profile card (same style as website)
      profileCardEl.innerHTML = renderProfileCard(profile);
      
    } catch (decryptError) {
      console.error('Failed to decrypt profile:', decryptError);
      
      // Check if it's a decryption error (wrong key)
      const errorMessage = decryptError.message || decryptError.toString();
      const isDecryptionError = errorMessage.includes('decrypt') || 
                                errorMessage.includes('OperationError') ||
                                decryptError.name === 'OperationError';
      
      if (isDecryptionError) {
        profileCardEl.innerHTML = `
          <span style="color: #f59e0b;">⚠️ Profile encrypted with old key</span>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">
            Your profile was encrypted with a previous wallet signature. 
            <a href="#" id="recreateProfile" style="color: #0ea5e9; text-decoration: underline;">
              Create new profile
            </a>
          </div>
        `;
        
        // Add click handler for recreate link
        setTimeout(() => {
          const recreateLink = document.getElementById('recreateProfile');
          if (recreateLink) {
            recreateLink.addEventListener('click', (e) => {
              e.preventDefault();
              chrome.tabs.create({ url: chrome.runtime.getURL('profile.html') });
            });
          }
        }, 100);
      } else {
        profileCardEl.innerHTML = `
          <span style="color: #ef4444;">Failed to decrypt profile</span>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">
            ${errorMessage}
          </div>
        `;
      }
    }
    
  } catch (error) {
    console.error('Failed to load profile data:', error);
    document.getElementById('profileCard').innerHTML = 
      '<span style="color: #ef4444;">Error loading profile</span>';
  }
}

/**
 * Render profile card (matches website styling)
 */
function renderProfileCard(profile) {
  const parts = [];
  
  // Demographics
  if (profile.demographics) {
    const demo = profile.demographics;
    const demoStr = [
      demo.age ? `${demo.age}yo` : null,
      demo.gender
    ].filter(Boolean).join(', ');
    if (demoStr) parts.push(`👤 ${demoStr}`);
  }
  
  // Interests
  if (profile.interests && profile.interests.length > 0) {
    parts.push(`💭 ${profile.interests.join(', ')}`);
  }
  
  // Location
  if (profile.location) {
    const loc = profile.location;
    const locStr = [loc.state, loc.country].filter(Boolean).join(', ');
    if (locStr) parts.push(`📍 ${locStr}`);
  }
  
  // Financial
  if (profile.financial?.incomeRange) {
    parts.push(`💰 ${profile.financial.incomeRange}`);
  }
  
  // Preferences
  if (profile.preferences) {
    const prefs = profile.preferences;
    if (prefs.maxAdsPerHour) {
      parts.push(`📊 Max ${prefs.maxAdsPerHour} ads/hour`);
    }
    if (prefs.painThreshold !== undefined) {
      parts.push(`🎚️ Pain threshold: ${prefs.painThreshold}/10`);
    }
  }
  
  if (parts.length === 0) {
    return '<span style="color: #94a3b8;">Empty profile</span>';
  }
  
  return `
    <div style="font-size: 12px; line-height: 1.6;">
      ${parts.map(p => `<div style="margin-bottom: 4px;">${p}</div>`).join('')}
    </div>
    <div style="font-size: 10px; color: #94a3b8; margin-top: 8px;">
      Saved: ${profile.encryptedAt ? new Date(profile.encryptedAt).toLocaleString() : 'Unknown'}
    </div>
  `;
}

/**
 * Handle manual run
 */
async function handleRunNow() {
  const button = document.getElementById('runNow');
  button.disabled = true;
  button.textContent = '⏳ Running...';
  
  try {
    const response = await chrome.runtime.sendMessage({ type: 'MANUAL_SYNC' });
    
    if (response.success) {
      console.log('Manual sync completed:', response.result);
    } else {
      console.error('Manual sync failed:', response.error);
    }
    
    // Reload status after a moment
    setTimeout(loadStatus, 1000);
    
  } catch (error) {
    console.error('Failed to trigger sync:', error);
  } finally {
    button.disabled = false;
    button.textContent = '🔄 Run Now';
  }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  // Remove any existing toasts
  const existingToasts = document.querySelectorAll('.toast');
  existingToasts.forEach(toast => toast.remove());
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  // Add to body
  document.body.appendChild(toast);
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'slideUp 0.3s ease-out reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
