/**
 * Extension Setup Script
 * Handles Phantom wallet authentication and keyHash storage
 */

// Debug logging
const DEBUG = true;
function log(message, data) {
  if (DEBUG) {
    console.log(`[setup] ${message}`, data || '');
    const debugLog = document.getElementById('debugLog');
    if (debugLog) {
      debugLog.style.display = 'block';
      const entry = document.createElement('div');
      entry.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
      debugLog.appendChild(entry);
      debugLog.scrollTop = debugLog.scrollHeight;
    }
  }
}

// UI helpers
function showStatus(message, type = 'info') {
  const status = document.getElementById('connectStatus');
  status.textContent = message;
  status.className = `status ${type}`;
  log(`Status: ${type} - ${message}`);
}

function showStep(stepId) {
  document.querySelectorAll('.step').forEach(step => {
    step.classList.remove('active');
  });
  document.getElementById(stepId).classList.add('active');
}

// Crypto utilities (copied from crypto-pure.ts)
async function hashSignature(signature) {
  log('Hashing signature with SHA-256');
  const msgBuffer = typeof signature === 'string' 
    ? new TextEncoder().encode(signature)
    : signature;
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  log('Signature hashed', { hashPrefix: hashHex.slice(0, 16) + '...' });
  return hashHex;
}

// Chrome storage helpers
async function saveKeyHash(keyHash) {
  log('Saving keyHash to chrome.storage.local');
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ payattn_keyHash: keyHash }, () => {
      if (chrome.runtime.lastError) {
        log('ERROR saving keyHash', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        log('keyHash saved successfully');
        resolve();
      }
    });
  });
}

async function getKeyHash() {
  return new Promise((resolve) => {
    chrome.storage.local.get('payattn_keyHash', (result) => {
      resolve(result.payattn_keyHash || null);
    });
  });
}

// Main authentication flow - redirects to website
async function authenticateWithPhantom() {
  const connectButton = document.getElementById('connectButton');
  connectButton.disabled = true;
  connectButton.innerHTML = '<span class="loading"></span> Opening website...';
  
  try {
    log('Opening website for authentication');
    showStatus('Opening PayAttn website...', 'info');
    
    // Open the website's wallet-auth page where user can authenticate
    const websiteUrl = 'http://localhost:3000/wallet-auth';
    
    // Store a flag that we're waiting for auth
    await chrome.storage.local.set({ 
      payattn_auth_pending: true,
      payattn_auth_timestamp: Date.now()
    });
    
    log('Opening website in new tab');
    showStatus('Please authenticate on the website...', 'info');
    
    // Open website
    chrome.tabs.create({ url: websiteUrl }, (tab) => {
      log('Website opened in tab: ' + tab.id);
      
      // Set up a listener for when auth completes
      pollForAuth();
    });
    
  } catch (error) {
    log('ERROR during setup', error);
    
    let errorMessage = 'Setup failed. ';
    if (error.message) {
      errorMessage += error.message;
    } else {
      errorMessage += 'Please try again.';
    }
    
    showStatus(errorMessage, 'error');
    connectButton.disabled = false;
    connectButton.textContent = 'Try Again';
  }
}

// Poll for authentication completion
function pollForAuth() {
  const checkInterval = setInterval(async () => {
    const result = await chrome.storage.local.get(['payattn_keyHash', 'payattn_auth_pending']);
    
    if (result.payattn_keyHash) {
      // Auth completed!
      clearInterval(checkInterval);
      await chrome.storage.local.remove('payattn_auth_pending');
      
      log('Authentication completed!');
      showStatus('Authentication successful! ', 'success');
      
      // Show success step
      setTimeout(() => {
        showStep('step-success');
      }, 1000);
    }
  }, 1000); // Check every second
  
  // Stop polling after 5 minutes
  setTimeout(() => {
    clearInterval(checkInterval);
  }, 5 * 60 * 1000);
}

// Event listeners
document.getElementById('connectButton').addEventListener('click', authenticateWithPhantom);

document.getElementById('closeButton').addEventListener('click', () => {
  log('Closing setup tab');
  window.close();
});

// Check if already authenticated
(async () => {
  const existingKeyHash = await getKeyHash();
  if (existingKeyHash) {
    log('Already authenticated', { keyHashPrefix: existingKeyHash.slice(0, 16) + '...' });
    showStep('step-success');
  } else {
    log('No existing authentication found');
  }
})();
