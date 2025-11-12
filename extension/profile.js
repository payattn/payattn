/**
 * Profile Editor for Extension
 * Loads and saves profile data directly to chrome.storage
 */

let walletAddress = null;
let keyHash = null;
let authToken = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Load auth data
  const result = await chrome.storage.local.get(['payattn_walletAddress', 'payattn_keyHash', 'payattn_authToken']);
  walletAddress = result.payattn_walletAddress;
  keyHash = result.payattn_keyHash;
  authToken = result.payattn_authToken;
  
  // Update header
  if (walletAddress) {
    document.getElementById('walletBadge').textContent = 
      ` ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
  } else {
    document.getElementById('walletBadge').textContent = ' Not authenticated';
    showAlert('Please authenticate your wallet first', 'error');
  }
  
  // Update pain threshold display
  const painThresholdInput = document.getElementById('painThreshold');
  const painThresholdValue = document.getElementById('painThresholdValue');
  painThresholdInput.addEventListener('input', () => {
    painThresholdValue.textContent = painThresholdInput.value;
  });
  
  // Load existing profile if available
  await loadProfile();
  
  // Button handlers
  document.getElementById('saveButton').addEventListener('click', saveProfile);
  document.getElementById('loadButton').addEventListener('click', loadProfile);
  document.getElementById('cancelButton').addEventListener('click', () => {
    window.close();
  });
});

/**
 * Load existing profile from chrome.storage
 */
async function loadProfile() {
  if (!walletAddress || !keyHash) {
    showAlert('Authentication required', 'error');
    return;
  }
  
  try {
    // Get encrypted profile
    const profileResult = await chrome.storage.local.get(`payattn_profile_${walletAddress}`);
    const profileData = profileResult[`payattn_profile_${walletAddress}`];
    
    if (!profileData || !profileData.encryptedData) {
      showAlert('No saved profile found', 'info');
      return;
    }
    
    // Decrypt profile
    try {
      const keyMaterial = await fetchKeyMaterial(keyHash, walletAddress, authToken);
      const decryptedJson = await decryptDataWithMaterial(
        profileData.encryptedData,
        keyMaterial,
        walletAddress
      );
      const profile = JSON.parse(decryptedJson);
      
      // Populate form
      if (profile.demographics) {
        document.getElementById('age').value = profile.demographics.age || 25;
        document.getElementById('gender').value = profile.demographics.gender || 'prefer not to say';
      }
      
      if (profile.interests) {
        document.getElementById('interests').value = profile.interests.join(', ');
      }
      
      if (profile.location) {
        document.getElementById('country').value = profile.location.country || 'United States';
        document.getElementById('state').value = profile.location.state || '';
      }
      
      if (profile.financial) {
        document.getElementById('incomeRange').value = profile.financial.incomeRange || '';
      }
      
      if (profile.preferences) {
        document.getElementById('maxAdsPerHour').value = profile.preferences.maxAdsPerHour || 10;
        document.getElementById('painThreshold').value = profile.preferences.painThreshold || 5;
        document.getElementById('painThresholdValue').textContent = profile.preferences.painThreshold || 5;
      }
      
      showAlert(' Profile loaded successfully', 'success');
      
    } catch (decryptError) {
      console.error('Failed to decrypt profile:', decryptError);
      const errorMessage = decryptError.message || decryptError.toString();
      const isDecryptionError = errorMessage.includes('decrypt') || 
                                errorMessage.includes('OperationError') ||
                                decryptError.name === 'OperationError';
      
      if (isDecryptionError) {
        showAlert(' Profile was encrypted with an old wallet signature. You can create a new profile below.', 'error');
        // Clear the old profile
        await chrome.storage.local.remove(`payattn_profile_${walletAddress}`);
      } else {
        showAlert(`Failed to decrypt profile: ${errorMessage}`, 'error');
      }
    }
    
  } catch (error) {
    console.error('Failed to load profile:', error);
    showAlert(`Failed to load profile: ${error.message}`, 'error');
  }
}

/**
 * Save profile to chrome.storage
 */
async function saveProfile() {
  if (!walletAddress || !keyHash) {
    showAlert('Authentication required', 'error');
    return;
  }
  
  try {
    const saveButton = document.getElementById('saveButton');
    saveButton.disabled = true;
    saveButton.textContent = ' Saving...';
    
    // Collect form data
    const age = document.getElementById('age').value;
    const gender = document.getElementById('gender').value;
    const interests = document.getElementById('interests').value;
    const country = document.getElementById('country').value;
    const state = document.getElementById('state').value;
    const incomeRange = document.getElementById('incomeRange').value;
    const maxAdsPerHour = document.getElementById('maxAdsPerHour').value;
    const painThreshold = document.getElementById('painThreshold').value;
    
    // Build profile object
    const profile = {
      demographics: {
        age: parseInt(age) || 25,
        gender: gender
      },
      interests: interests.split(',').map(s => s.trim()).filter(Boolean),
      location: {
        country: country,
        state: state || undefined
      },
      financial: {
        incomeRange: incomeRange || undefined
      },
      preferences: {
        maxAdsPerHour: parseInt(maxAdsPerHour) || 10,
        painThreshold: parseInt(painThreshold) || 5
      },
      encryptedAt: new Date().toISOString()
    };
    
    // Fetch key material and encrypt
    const keyMaterial = await fetchKeyMaterial(keyHash, walletAddress, authToken);
    const profileJson = JSON.stringify(profile);
    const encrypted = await encryptDataWithMaterial(
      profileJson,
      keyMaterial,
      walletAddress
    );
    
    // Save to chrome.storage
    const profileData = {
      walletAddress: walletAddress,
      encryptedData: encrypted,
      version: 1,
      timestamp: Date.now()
    };
    
    await chrome.storage.local.set({
      [`payattn_profile_${walletAddress}`]: profileData
    });
    
    showAlert(' Profile saved successfully!', 'success');
    
    saveButton.disabled = false;
    saveButton.textContent = ' Save Profile';
    
  } catch (error) {
    console.error('Failed to save profile:', error);
    showAlert(`Failed to save profile: ${error.message}`, 'error');
    
    const saveButton = document.getElementById('saveButton');
    saveButton.disabled = false;
    saveButton.textContent = ' Save Profile';
  }
}

/**
 * Show alert message
 */
function showAlert(message, type = 'info') {
  const container = document.getElementById('alertContainer');
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  
  container.innerHTML = '';
  container.appendChild(alert);
  
  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    alert.classList.add('hidden');
  }, 5000);
}
