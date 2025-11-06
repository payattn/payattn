/**
 * Age Proof Generator Test Page
 * 
 * This is a comprehensive testing interface for the ZK-SNARK age proof system.
 * 
 * Flow:
 * 1. Load user profile from chrome.storage (encrypted)
 * 2. Decrypt using keyHash + authToken
 * 3. Extract age from profile
 * 4. Accept advertiser criteria (age range)
 * 5. Generate proof using extension/lib/zk-prover.js
 * 6. Send proof to backend /api/verify-proof
 * 7. Display verification result
 */

// ============================================================================
// STATE
// ============================================================================

let userProfile = null;
let userAge = null;
let walletAddress = null;
let keyHash = null;
let authToken = null;
let currentProof = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  logConsole('🚀 Test page initialized', 'info');
  setupEventListeners();
  loadProfile();
});

function setupEventListeners() {
  // Proof type selector
  document.getElementById('proofType').addEventListener('change', handleProofTypeChange);
  
  document.getElementById('generateProof').addEventListener('click', handleGenerateProof);
  document.getElementById('verifyProof').addEventListener('click', handleVerifyProof);
  document.getElementById('reloadProfile').addEventListener('click', () => {
    logConsole('🔄 User clicked reload profile', 'info');
    loadProfile();
  });
  document.getElementById('clearProof').addEventListener('click', handleClearProof);
  document.getElementById('copyProof').addEventListener('click', handleCopyProof);
  document.getElementById('resetConfig').addEventListener('click', handleResetConfig);
  document.getElementById('clearConsole').addEventListener('click', () => {
    document.getElementById('debugConsole').innerHTML = '';
    logConsole('Console cleared', 'log');
  });
}

function handleProofTypeChange() {
  const proofType = document.getElementById('proofType').value;
  
  // Hide all input sections
  document.getElementById('ageRangeInputs').style.display = 'none';
  document.getElementById('locationInputs').style.display = 'none';
  document.getElementById('interestInputs').style.display = 'none';
  
  // Show selected
  if (proofType === 'age_range') {
    document.getElementById('ageRangeInputs').style.display = 'block';
  } else if (proofType === 'location_check') {
    document.getElementById('locationInputs').style.display = 'block';
  } else if (proofType === 'interest_check') {
    document.getElementById('interestInputs').style.display = 'block';
  }
  
  logConsole(`📋 Proof type changed to: ${proofType}`, 'info');
}

// ============================================================================
// PROFILE LOADING
// ============================================================================

async function loadProfile() {
  try {
    logConsole('📦 Loading profile from chrome.storage...', 'info');
    updateProfileStatus('⏳ Loading profile from chrome.storage...', 'loading');
    
    // Get auth credentials
    const result = await chrome.storage.local.get([
      'payattn_walletAddress',
      'payattn_keyHash',
      'payattn_authToken'
    ]);
    
    walletAddress = result.payattn_walletAddress;
    keyHash = result.payattn_keyHash;
    authToken = result.payattn_authToken;
    
    if (!walletAddress || !keyHash || !authToken) {
      throw new Error('Missing authentication credentials in chrome.storage');
    }
    
    logConsole(`✅ Auth credentials loaded (wallet: ${walletAddress.slice(0, 6)}...)`, 'success');
    
    // Get encrypted profile
    const profileResult = await chrome.storage.local.get(`payattn_profile_${walletAddress}`);
    const profileData = profileResult[`payattn_profile_${walletAddress}`];
    
    if (!profileData || !profileData.encryptedData) {
      throw new Error('No profile found in chrome.storage. Please create a profile first.');
    }
    
    logConsole('🔓 Decrypting profile...', 'info');
    
    // Decrypt profile
    try {
      const keyMaterial = await fetchKeyMaterial(keyHash, walletAddress, authToken);
      logConsole('✅ Key material fetched from backend', 'success');
      
      const decryptedJson = await decryptDataWithMaterial(
        profileData.encryptedData,
        keyMaterial,
        walletAddress
      );
      logConsole('✅ Profile decrypted successfully', 'success');
      
      userProfile = JSON.parse(decryptedJson);
      
      // DEBUG: Show full profile structure
      logConsole('🔍 Full profile structure:', 'info');
      logConsole(JSON.stringify(userProfile, null, 2), 'log');
      
      // Extract data from profile (robust to different structures)
      if (!userProfile.demographics && !userProfile.age) {
        throw new Error('Profile missing demographics data');
      }
      
      userAge = userProfile.demographics?.age || userProfile.age;
      
      let userLocation = userProfile.demographics?.location || 
                         userProfile.location || 
                         userProfile.demographics?.country ||
                         userProfile.country;
      
      // If location is an object, extract the actual string value
      if (userLocation && typeof userLocation === 'object') {
        logConsole(`📍 Location is object, extracting: ${JSON.stringify(userLocation)}`, 'info');
        userLocation = userLocation.code || userLocation.name || userLocation.country || userLocation.value;
      }
      
      const userInterests = userProfile.interests || [];
      
      if (!userAge) {
        throw new Error('Age not found in profile');
      }
      
      logConsole(`🎯 User age: ${userAge}`, 'success');
      logConsole(`📍 User location: ${userLocation || 'not set'}`, userLocation ? 'success' : 'warn');
      logConsole(`❤️ User interests: ${userInterests.length ? userInterests.join(', ') : 'none'}`, userInterests.length ? 'success' : 'warn');
      
      displayProfileData();
      updateProfileStatus('✅ Profile loaded successfully!', 'success');
      
      // Enable generate button
      document.getElementById('generateProof').disabled = false;
      
      // Update test values in UI
      updateTestValues();
      
    } catch (decryptError) {
      logConsole(`❌ Decryption error: ${decryptError.message}`, 'error');
      throw decryptError;
    }
    
  } catch (error) {
    logConsole(`❌ Failed to load profile: ${error.message}`, 'error');
    updateProfileStatus(`❌ Error: ${error.message}`, 'error');
    document.getElementById('generateProof').disabled = true;
  }
}

function updateTestValues() {
  // Update UI fields with profile data
  if (userProfile) {
    // Age
    const age = userProfile.demographics?.age || userProfile.age;
    document.getElementById('userAge').value = age || '';
    
    // Location - check multiple possible paths and extract string value
    let location = userProfile.demographics?.location || 
                   userProfile.location || 
                   userProfile.demographics?.country ||
                   userProfile.country;
    
    // If location is an object, try to extract the actual value
    if (location && typeof location === 'object') {
      logConsole(`📍 Location is an object: ${JSON.stringify(location)}`, 'info');
      location = location.code || location.name || location.country || location.value || String(location);
    }
    
    document.getElementById('userLocation').value = location || '';
    logConsole(`📍 Location field value: "${location}"`, location ? 'success' : 'error');
    
    // Interests
    const interests = userProfile.interests || [];
    document.getElementById('userInterests').value = interests.length ? interests.join(', ') : '';
    logConsole(`❤️ Interests field value: "${interests.join(', ')}"`, interests.length ? 'success' : 'error');
  }
}

function displayProfileData() {
  const profileDisplay = document.getElementById('profileData');
  
  const rows = [];
  
  // Wallet
  rows.push({
    label: 'Wallet',
    value: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
  });
  
  // Age
  if (userProfile.demographics) {
    rows.push({
      label: 'Age',
      value: userProfile.demographics.age
    });
    
    if (userProfile.demographics.gender) {
      rows.push({
        label: 'Gender',
        value: userProfile.demographics.gender
      });
    }
  }
  
  // Location
  if (userProfile.location) {
    const locStr = [userProfile.location.state, userProfile.location.country]
      .filter(Boolean)
      .join(', ');
    if (locStr) {
      rows.push({
        label: 'Location',
        value: locStr
      });
    }
  }
  
  // Income
  if (userProfile.financial?.incomeRange) {
    rows.push({
      label: 'Income Range',
      value: userProfile.financial.incomeRange
    });
  }
  
  // Interests
  if (userProfile.interests && userProfile.interests.length > 0) {
    rows.push({
      label: 'Interests',
      value: userProfile.interests.join(', ')
    });
  }
  
  // Preferences
  if (userProfile.preferences) {
    rows.push({
      label: 'Max Ads/Hour',
      value: userProfile.preferences.maxAdsPerHour
    });
    rows.push({
      label: 'Pain Threshold',
      value: `${userProfile.preferences.painThreshold}/10`
    });
  }
  
  profileDisplay.innerHTML = rows.map(row => `
    <div class="data-row">
      <span class="data-label">${row.label}:</span>
      <span class="data-value">${row.value}</span>
    </div>
  `).join('');
}

function updateProfileStatus(message, type) {
  const statusEl = document.getElementById('profileStatus');
  statusEl.textContent = message;
  statusEl.className = `status-box status-${type}`;
}

// ============================================================================
// PROOF GENERATION
// ============================================================================

async function handleGenerateProof() {
  try {
    // Validate
    if (!userProfile) {
      throw new Error('User profile not loaded');
    }
    
    const proofType = document.getElementById('proofType').value;
    let circuitName, privateInputs, publicInputs;
    
    // Build inputs based on proof type
    if (proofType === 'age_range') {
      const minAge = parseInt(document.getElementById('minAge').value);
      const maxAge = parseInt(document.getElementById('maxAge').value);
      
      if (isNaN(minAge) || isNaN(maxAge) || minAge >= maxAge) {
        throw new Error('Invalid age range values');
      }
      
      const age = userProfile.demographics.age;
      if (!age) {
        throw new Error('Age not found in profile');
      }
      
      circuitName = 'range_check';
      privateInputs = { value: age };
      publicInputs = { min: minAge, max: maxAge };
      
      logConsole(`📊 Age Range: ${age} in [${minAge}, ${maxAge}] = ${age >= minAge && age <= maxAge ? 'SHOULD BE VALID ✅' : 'SHOULD BE INVALID ❌'}`, 'info');
      
    } else if (proofType === 'location_check') {
      const allowedStr = document.getElementById('allowedCountries').value;
      const allowedCountries = allowedStr.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      
      if (allowedCountries.length === 0 || allowedCountries.length > 10) {
        throw new Error('Set must have 1-10 countries');
      }
      
      // Check multiple possible paths for location
      let userLocation = userProfile.demographics?.location || 
                         userProfile.location || 
                         userProfile.demographics?.country ||
                         userProfile.country;
      
      // If location is an object, extract the string value
      if (userLocation && typeof userLocation === 'object') {
        logConsole(`📍 Location is object: ${JSON.stringify(userLocation)}`, 'info');
        userLocation = userLocation.code || userLocation.name || userLocation.country || userLocation.value;
      }
      
      if (!userLocation) {
        logConsole('❌ Profile structure:', 'error');
        logConsole(JSON.stringify(userProfile, null, 2), 'log');
        throw new Error('Location not found in profile. Check console for profile structure.');
      }
      
      logConsole(`📍 Using location: "${userLocation}"`, 'success');
      
      // Hash the user's location and the allowed countries
      const userHash = await hashToFieldElement(userLocation.toUpperCase());
      const setHashes = await Promise.all(allowedCountries.map(v => hashToFieldElement(v)));
      
      // Pad to 10 values (circuit requirement)
      while (setHashes.length < 10) {
        setHashes.push('0');
      }
      
      circuitName = 'set_membership';
      privateInputs = { value: userHash };
      publicInputs = { set: setHashes };  // Array, not individual fields!
      
      const isInSet = allowedCountries.includes(userLocation.toUpperCase());
      logConsole(`📊 Location Check: "${userLocation}" in [${allowedCountries.join(', ')}] = ${isInSet ? 'SHOULD BE VALID ✅' : 'SHOULD BE INVALID ❌'}`, 'info');
      
    } else if (proofType === 'interest_check') {
      const targetStr = document.getElementById('targetInterests').value;
      const targetInterests = targetStr.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      
      if (targetInterests.length === 0 || targetInterests.length > 10) {
        throw new Error('Set must have 1-10 interests');
      }
      
      if (!userProfile.interests || userProfile.interests.length === 0) {
        throw new Error('No interests found in profile');
      }
      
      // PRE-PROCESSING: Find which of the user's interests matches the advertiser's target
      const userInterests = userProfile.interests.map(i => i.toLowerCase());
      
      logConsole(`🔍 User's interests: [${userInterests.join(', ')}]`, 'info');
      logConsole(`🎯 Advertiser targets: [${targetInterests.join(', ')}]`, 'info');
      
      // Find first matching interest
      const matchingInterest = userInterests.find(ui => targetInterests.includes(ui));
      
      if (!matchingInterest) {
        logConsole(`⚠️ No matching interest found!`, 'warn');
        logConsole(`   Using first user interest "${userInterests[0]}" (proof will be INVALID)`, 'warn');
      }
      
      // Use the matching interest, or first interest if no match (for testing invalid case)
      const interestToProve = matchingInterest || userInterests[0];
      logConsole(`✅ Pre-processing: Will prove "${interestToProve}" is in target set`, 'success');
      
      // Hash the selected interest and the target interests
      const userHash = await hashToFieldElement(interestToProve);
      const setHashes = await Promise.all(targetInterests.map(v => hashToFieldElement(v)));
      
      // Pad to 10 values (circuit requirement)
      while (setHashes.length < 10) {
        setHashes.push('0');
      }
      
      circuitName = 'set_membership';
      privateInputs = { value: userHash };
      publicInputs = { set: setHashes };  // Array, not individual fields!
      
      const isMatch = targetInterests.includes(interestToProve);
      logConsole(`📊 Interest Check: "${interestToProve}" in [${targetInterests.join(', ')}] = ${isMatch ? 'SHOULD BE VALID ✅' : 'SHOULD BE INVALID ❌'}`, 'info');
      
    } else {
      throw new Error(`Unknown proof type: ${proofType}`);
    }
    
    logConsole('', 'log');
    logConsole('═'.repeat(60), 'log');
    logConsole('⚡ PROOF GENERATION STARTED', 'info');
    logConsole('═'.repeat(60), 'log');
    
    // Disable button
    const generateBtn = document.getElementById('generateProof');
    generateBtn.disabled = true;
    generateBtn.textContent = '⏳ Generating...';
    
    // Show container
    const proofContainer = document.getElementById('proofContainer');
    proofContainer.style.display = 'block';
    
    // Reset previous result
    document.getElementById('verificationContainer').style.display = 'none';
    
    // Start progress
    updateProgress(10);
    logConsole(`🔄 Sending proof request to service worker...`, 'info');
    
    updateProgress(20);
    
    // Generate proof via service worker
    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_PROOF',
      circuitName,
      privateInputs,
      publicInputs,
      options: { verbose: true }
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Proof generation failed');
    }
    
    const proof = response.proof;
    
    updateProgress(60);
    logConsole('✅ Proof generated successfully', 'success');
    
    // Store for later use
    currentProof = proof;
    
    updateProgress(80);
    
    // Display proof
    displayProof(proof, publicInputs);
    
    updateProgress(100);
    logConsole('', 'log');
    logConsole('═'.repeat(60), 'log');
    logConsole('✅ PROOF GENERATION COMPLETE', 'success');
    logConsole('═'.repeat(60), 'log');
    logConsole('Next: Click "Send to Backend & Verify" to verify the proof', 'info');
    
  } catch (error) {
    logConsole(`❌ Proof generation failed: ${error.message}`, 'error');
    logConsole(`Stack: ${error.stack}`, 'error');
    
    const generationStatus = document.getElementById('generationStatus');
    generationStatus.innerHTML = `
      <div class="status-box status-error">
        <strong>❌ Error:</strong> ${error.message}
      </div>
    `;
    
    document.getElementById('proofContainer').style.display = 'none';
    
  } finally {
    const generateBtn = document.getElementById('generateProof');
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate Proof';
    updateProgress(0);
  }
}

// Helper function for hashing (same as in console test functions)
async function hashToFieldElement(str) {
  const FIELD_PRIME = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  
  let num = BigInt(0);
  for (let i = 0; i < hashArray.length; i++) {
    num = (num << BigInt(8)) | BigInt(hashArray[i]);
  }
  
  return (num % FIELD_PRIME).toString();
}

function displayProof(proof, publicInputs) {
  logConsole('📋 Proof details:', 'log');
  
  // Details table
  const details = [
    { label: 'Circuit Name', value: proof.circuitName },
    { label: 'Proof Type', value: 'Groth16' },
    { label: 'Public Signals Count', value: proof.publicSignals.length },
  ];
  
  const detailsHtml = details.map(d => `
    <div class="data-row">
      <span class="data-label">${d.label}:</span>
      <span class="data-value">${d.value}</span>
    </div>
  `).join('');
  
  document.getElementById('proofDetails').innerHTML = detailsHtml;
  
  // Full JSON
  const proofJson = JSON.stringify(proof, null, 2);
  document.getElementById('proofJson').textContent = proofJson;
  
  logConsole(`  • Circuit: ${proof.circuitName}`, 'log');
  logConsole(`  • Public signals: [${proof.publicSignals.join(', ')}]`, 'log');
  logConsole(`  • Proof (first 50 chars): ${JSON.stringify(proof.proof).slice(0, 50)}...`, 'log');
  logConsole(`  • ℹ️ Public inputs: ${JSON.stringify(publicInputs)}`, 'info');
  logConsole(`  • ℹ️ Private data (age ${userAge}) is NOT in the proof`, 'success');
}

function handleClearProof() {
  document.getElementById('proofContainer').style.display = 'none';
  document.getElementById('verificationContainer').style.display = 'none';
  document.getElementById('generationStatus').innerHTML = '';
  currentProof = null;
  logConsole('🗑️ Proof cleared', 'log');
}

function handleCopyProof() {
  if (!currentProof) {
    logConsole('❌ No proof to copy', 'error');
    return;
  }
  
  const proofJson = JSON.stringify(currentProof, null, 2);
  navigator.clipboard.writeText(proofJson).then(() => {
    logConsole('📋 Proof JSON copied to clipboard', 'success');
  }).catch(err => {
    logConsole(`❌ Failed to copy: ${err.message}`, 'error');
  });
}

// ============================================================================
// VERIFICATION
// ============================================================================

async function handleVerifyProof() {
  try {
    if (!currentProof) {
      throw new Error('No proof generated');
    }
    
    logConsole('', 'log');
    logConsole('═'.repeat(60), 'log');
    logConsole('🔐 VERIFICATION STARTED', 'info');
    logConsole('═'.repeat(60), 'log');
    
    const verifyBtn = document.getElementById('verifyProof');
    verifyBtn.disabled = true;
    verifyBtn.textContent = '⏳ Verifying...';
    
    logConsole('📤 Sending proof to backend: POST /api/verify-proof', 'info');
    
    // Prepare payload
    const payload = {
      proof: currentProof.proof,
      publicSignals: currentProof.publicSignals,
      circuitName: currentProof.circuitName
    };
    
    logConsole('📦 Payload:', 'log');
    logConsole(`  • Circuit: ${payload.circuitName}`, 'log');
    logConsole(`  • Public Signals: [${payload.publicSignals.join(', ')}]`, 'log');
    logConsole(`  • Proof: ${JSON.stringify(payload.proof).slice(0, 80)}...`, 'log');
    
    // Send to backend
    const response = await fetch('http://localhost:3000/api/verify-proof', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    logConsole(`📨 Backend response: ${response.status} ${response.statusText}`, 'info');
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend error: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    
    logConsole('✅ Response received from backend', 'success');
    logConsole(`📋 Full response: ${JSON.stringify(result)}`, 'log');
    
    // Backend returns: { success: boolean, result: { valid: boolean, ... }, metadata: {...} }
    // Check multiple possible field names for the validity result
    const isValid = result.success !== undefined ? result.success : 
                    result.result?.valid !== undefined ? result.result.valid :
                    result.isValid !== undefined ? result.isValid : 
                    result.valid;
    
    logConsole(`  • success field: ${result.success}`, 'log');
    logConsole(`  • result.valid field: ${result.result?.valid}`, 'log');
    logConsole(`  • isValid field: ${result.isValid}`, 'log');
    logConsole(`  • valid field: ${result.valid}`, 'log');
    logConsole(`  • Computed isValid: ${isValid}`, isValid ? 'success' : 'error');
    
    if (result.message || result.result?.message) {
      logConsole(`  • Message: ${result.message || result.result?.message}`, 'log');
    }
    
    if (result.result?.verificationTime) {
      logConsole(`  • Time: ${result.result.verificationTime}ms`, 'log');
    }
    
    // Display result
    displayVerificationResult(result);
    
    logConsole('', 'log');
    logConsole('═'.repeat(60), 'log');
    logConsole('✅ VERIFICATION COMPLETE', 'success');
    logConsole('═'.repeat(60), 'log');
    
  } catch (error) {
    logConsole(`❌ Verification failed: ${error.message}`, 'error');
    logConsole(`Stack: ${error.stack}`, 'error');
    
    displayVerificationError(error);
    
  } finally {
    const verifyBtn = document.getElementById('verifyProof');
    verifyBtn.disabled = false;
    verifyBtn.textContent = 'Send to Backend & Verify';
  }
}

function displayVerificationResult(result) {
  const container = document.getElementById('verificationContainer');
  container.style.display = 'block';
  
  const resultDiv = document.getElementById('verificationResult');
  
  // Backend returns: { success: boolean, result: { valid: boolean, verificationTime: number }, ... }
  // Check multiple possible field names
  const isValid = result.success !== undefined ? result.success : 
                  result.result?.valid !== undefined ? result.result.valid :
                  result.isValid !== undefined ? result.isValid : 
                  result.valid;
  
  const verificationTime = result.result?.verificationTime || result.verificationTime;
  const message = result.message || result.result?.message;
  
  if (isValid) {
    resultDiv.className = 'verification-result valid';
    resultDiv.innerHTML = `
      <h3>✅ Proof Valid!</h3>
      <p>The zero-knowledge proof was successfully verified by the backend.</p>
      ${verificationTime ? `<p style="margin-top: 4px; font-size: 11px; color: #cbd5e1;">Verified in ${verificationTime}ms</p>` : ''}
      <p style="margin-top: 8px; font-size: 12px; color: #cbd5e1;">
        The backend confirmed the proof without learning your private data.
      </p>
    `;
  } else {
    resultDiv.className = 'verification-result invalid';
    resultDiv.innerHTML = `
      <h3>❌ Proof Invalid</h3>
      <p>The backend rejected the proof.</p>
      ${message || result.error ? `<p style="margin-top: 8px; font-size: 12px;">${message || result.error}</p>` : ''}
    `;
  }
}

function displayVerificationError(error) {
  const container = document.getElementById('verificationContainer');
  container.style.display = 'block';
  
  const resultDiv = document.getElementById('verificationResult');
  resultDiv.className = 'verification-result invalid';
  resultDiv.innerHTML = `
    <h3>❌ Verification Error</h3>
    <p>${error.message}</p>
    <p style="margin-top: 8px; font-size: 11px; color: #cbd5e1;">
      Check the console for details. Make sure the backend is running at http://localhost:3000
    </p>
  `;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

function handleResetConfig() {
  document.getElementById('minAge').value = 25;
  document.getElementById('maxAge').value = 65;
  document.getElementById('allowedCountries').value = 'US,UK,CA,AU,DE';
  document.getElementById('targetInterests').value = 'cars,sports,technology,travel,food';
  logConsole('↻ Configuration reset to defaults', 'log');
}

// ============================================================================
// UI UTILITIES
// ============================================================================

function updateProgress(percent) {
  const fill = document.getElementById('progressFill');
  fill.style.width = percent + '%';
}

function logConsole(message, type = 'log') {
  const consoleEl = document.getElementById('debugConsole');
  
  if (!message) {
    consoleEl.innerHTML += '<div class="console-line">&nbsp;</div>';
    return;
  }
  
  const timestamp = new Date().toLocaleTimeString();
  const line = document.createElement('div');
  line.className = `console-line console-${type}`;
  line.textContent = `[${timestamp}] ${message}`;
  
  consoleEl.appendChild(line);
  
  // Auto-scroll to bottom
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

// ============================================================================
// SERVICE WORKER MESSAGING
// ============================================================================

/**
 * Listen for proof generation requests from service worker
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GENERATE_PROOF_REQUEST') {
    console.log('[Helper Page] Received proof generation request from service worker');
    logConsole('Proof request received from background service worker', 'info');
    
    // Generate the proof asynchronously
    (async () => {
      try {
        const proofPackage = await window.generateProof(
          message.circuitName,
          message.privateInputs,
          message.publicInputs,
          { verbose: true }
        );
        
        console.log('[Helper Page] Proof generated successfully');
        logConsole('✓ Proof generated for background service', 'success');
        
        // Send response back to service worker
        chrome.runtime.sendMessage({
          type: 'GENERATE_PROOF_RESPONSE',
          success: true,
          proof: proofPackage
        });
        
      } catch (error) {
        console.error('[Helper Page] Proof generation failed:', error);
        logConsole(`✗ Proof generation failed: ${error.message}`, 'error');
        
        // Send error response
        chrome.runtime.sendMessage({
          type: 'GENERATE_PROOF_RESPONSE',
          success: false,
          error: error.message
        });
      }
    })();
    
    // Return true to keep the message channel open for async response
    return true;
  }
});

console.log('[Helper Page] Message listener registered - ready to handle proof requests');

// ============================================================================
// SERVICE WORKER TEST FUNCTION
// ============================================================================

/**
 * Test proof generation in service worker
 * Call from console: testServiceWorkerProof(30, 18, 65)
 */
window.testServiceWorkerProof = async function(age, minAge, maxAge) {
  console.log(`[Test] Requesting proof from service worker...`);
  console.log(`[Test] Inputs: age=${age}, range=[${minAge}, ${maxAge}]`);
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_PROOF',
      circuitName: 'age_range',
      privateInputs: { age },
      publicInputs: { minAge, maxAge },
      options: { verbose: true }
    });
    
    if (response.success) {
      console.log('[Test] ✅ Proof generated successfully!');
      console.log('[Test] Proof:', response.proof);
      return response.proof;
    } else {
      console.error('[Test] ❌ Proof generation failed:', response.error);
      throw new Error(response.error);
    }
  } catch (error) {
    console.error('[Test] ❌ Service worker communication failed:', error);
    throw error;
  }
};

console.log('[Test] Service worker test function loaded. Call: testServiceWorkerProof(30, 18, 65)');

// ============================================================================
// NEW CIRCUITS TEST FUNCTIONS
// ============================================================================

/**
 * Test range_check circuit (generic range proof)
 * Works for any numeric value: age, income, credit score, etc.
 * 
 * @example
 * // Test income proof
 * testRangeCheck(35000, 25000, 50000)  // Prove income $35k is in range $25k-$50k
 * 
 * // Test age proof
 * testRangeCheck(30, 18, 65)  // Prove age 30 is in range 18-65
 */
window.testRangeCheck = async function(value, min, max) {
  console.log(`[Test] Testing range_check circuit...`);
  console.log(`[Test] Inputs: value=${value}, range=[${min}, ${max}]`);
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_PROOF',
      circuitName: 'range_check',
      privateInputs: { value },      // Private: actual value stays secret
      publicInputs: { min, max },    // Public: range bounds in proof
      options: { verbose: true }
    });
    
    if (response.success) {
      console.log('[Test] ✅ Range check proof generated!');
      console.log('[Test] Proof:', response.proof);
      console.log('[Test] Public signals:', response.proof.publicSignals);
      return response.proof;
    } else {
      console.error('[Test] ❌ Proof generation failed:', response.error);
      throw new Error(response.error);
    }
  } catch (error) {
    console.error('[Test] ❌ Test failed:', error);
    throw error;
  }
};

/**
 * Hash a string to field element (for set_membership circuit)
 * Uses SHA-256 mod FIELD_PRIME
 * 
 * @param {string} str - String to hash
 * @returns {Promise<string>} Field element as string
 * 
 * @example
 * const ukHash = await hashToField("uk");
 * console.log(ukHash);  // "15507270989273941579486529782961168076878965616246236476325961487637715879146"
 */
window.hashToField = async function(str) {
  const FIELD_PRIME = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
  
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  
  let num = BigInt(0);
  for (let i = 0; i < hashArray.length; i++) {
    num = (num << BigInt(8)) | BigInt(hashArray[i]);
  }
  
  const fieldElement = num % FIELD_PRIME;
  return fieldElement.toString();
};

/**
 * Test set_membership circuit
 * Proves a value exists in a set without revealing which one
 * Works with hashed strings (countries, interests, etc.)
 * 
 * @param {string} userValue - User's actual value (e.g., "uk", "technology")
 * @param {string[]} allowedSet - Array of allowed values (max 10)
 * 
 * @example
 * // Test country verification
 * testSetMembership("uk", ["us", "uk", "ca", "au", "de"])
 * 
 * // Test interest verification
 * testSetMembership("technology", ["technology", "finance", "health"])
 */
window.testSetMembership = async function(userValue, allowedSet) {
  console.log(`[Test] Testing set_membership circuit...`);
  console.log(`[Test] User value: "${userValue}" (will be hashed)`);
  console.log(`[Test] Allowed set: [${allowedSet.map(v => `"${v}"`).join(', ')}]`);
  
  try {
    // Hash everything
    console.log(`[Test] Hashing values...`);
    const userHash = await window.hashToField(userValue);
    console.log(`[Test] User hash: ${userHash}`);
    
    const setHashes = await Promise.all(allowedSet.map(v => window.hashToField(v)));
    console.log(`[Test] Set hashes:`, setHashes);
    
    // Pad to size 10 (circuit parameter)
    while (setHashes.length < 10) {
      setHashes.push("0");
    }
    
    if (setHashes.length > 10) {
      throw new Error('Set too large! Maximum 10 elements');
    }
    
    console.log(`[Test] Generating proof...`);
    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_PROOF',
      circuitName: 'set_membership',
      privateInputs: { value: userHash },    // Private: user's hashed value
      publicInputs: { set: setHashes },      // Public: hashed allowed values
      options: { verbose: true }
    });
    
    if (response.success) {
      console.log('[Test] ✅ Set membership proof generated!');
      console.log('[Test] Proof:', response.proof);
      console.log('[Test] Public signals:', response.proof.publicSignals);
      
      // Decode the result
      const isMember = response.proof.publicSignals[0] === '1';
      console.log(`[Test] Is member: ${isMember ? 'YES' : 'NO'}`);
      
      return response.proof;
    } else {
      console.error('[Test] ❌ Proof generation failed:', response.error);
      throw new Error(response.error);
    }
  } catch (error) {
    console.error('[Test] ❌ Test failed:', error);
    throw error;
  }
};

console.log('[Test] New circuit test functions loaded:');
console.log('  - testRangeCheck(value, min, max)');
console.log('  - testSetMembership(userValue, allowedSet)');
console.log('  - hashToField(string)');
console.log('');
console.log('Examples:');
console.log('  testRangeCheck(35000, 25000, 50000)  // Income proof');
console.log('  testSetMembership("uk", ["us", "uk", "ca"])  // Country proof');
console.log('  hashToField("technology")  // Hash a string');

