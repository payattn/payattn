/**
 * Multi-Circuit Proof Generator Test Page
 * 
 * Supports all PayAttn ZK-SNARK circuits:
 * - age_range: Prove age is in a specified range
 * - range_check: Prove any numeric value is in a range
 * - set_membership: Prove a value exists in a set
 * 
 * Flow:
 * 1. Load user profile from chrome.storage (encrypted)
 * 2. Decrypt using keyHash + authToken
 * 3. Extract user data from profile
 * 4. Accept circuit type and parameters
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
  // Circuit selection
  document.getElementById('circuitSelect').addEventListener('change', handleCircuitChange);
  
  // Proof generation
  document.getElementById('generateProof').addEventListener('click', handleGenerateProof);
  document.getElementById('verifyProof').addEventListener('click', handleVerifyProof);
  document.getElementById('clearProof').addEventListener('click', handleClearProof);
  document.getElementById('copyProof').addEventListener('click', handleCopyProof);
  
  // Profile
  document.getElementById('reloadProfile').addEventListener('click', () => {
    logConsole('🔄 User clicked reload profile', 'info');
    loadProfile();
  });
  
  // Console
  document.getElementById('clearConsole').addEventListener('click', () => {
    document.getElementById('debugConsole').innerHTML = '';
    logConsole('Console cleared', 'log');
  });
}

function handleCircuitChange() {
  const circuit = document.getElementById('circuitSelect').value;
  
  // Hide all options
  document.getElementById('ageRangeOptions').classList.remove('active');
  document.getElementById('rangeCheckOptions').classList.remove('active');
  document.getElementById('setMembershipOptions').classList.remove('active');
  
  // Show selected
  document.getElementById(`${circuit}Options`).classList.add('active');
  
  logConsole(`📋 Circuit changed to: ${circuit}`, 'info');
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
      
      // Extract age
      if (userProfile.demographics && userProfile.demographics.age) {
        userAge = userProfile.demographics.age;
        logConsole(`🎯 User age extracted: ${userAge}`, 'success');
      } else {
        throw new Error('Age not found in profile. Please ensure profile has demographics.age');
      }
      
      displayProfileData();
      updateProfileStatus('✅ Profile loaded successfully!', 'success');
      
      // Enable generate button
      document.getElementById('generateProof').disabled = false;
      
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
    const circuit = document.getElementById('circuitSelect').value;
    
    if (!userAge) {
      throw new Error('User age not loaded');
    }
    
    logConsole('', 'log');
    logConsole('═'.repeat(60), 'log');
    logConsole('⚡ PROOF GENERATION STARTED', 'info');
    logConsole(`📌 Circuit: ${circuit}`, 'info');
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
    
    let proof;
    
    if (circuit === 'age_range') {
      proof = await generateAgeRangeProof();
    } else if (circuit === 'range_check') {
      proof = await generateRangeCheckProof();
    } else if (circuit === 'set_membership') {
      proof = await generateSetMembershipProof();
    } else {
      throw new Error(`Unknown circuit: ${circuit}`);
    }
    
    updateProgress(60);
    logConsole('✅ Proof generated successfully', 'success');
    
    // Store for later use
    currentProof = proof;
    
    updateProgress(80);
    
    // Display proof
    displayProof(proof);
    
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

async function generateAgeRangeProof() {
  const minAge = parseInt(document.getElementById('ageRangeMin').value);
  const maxAge = parseInt(document.getElementById('ageRangeMax').value);
  
  if (isNaN(minAge) || isNaN(maxAge)) {
    throw new Error('Invalid age range values');
  }
  
  if (minAge >= maxAge) {
    throw new Error('Min age must be less than max age');
  }
  
  logConsole(`📊 Age Range Configuration:`, 'info');
  logConsole(`  • User age (PRIVATE): ${userAge}`, 'log');
  logConsole(`  • Advertiser wants: age ${minAge}-${maxAge}`, 'log');
  logConsole(`  • Match: ${userAge >= minAge && userAge <= maxAge ? '✅ YES' : '❌ NO'}`, 'warn');
  
  updateProgress(20);
  logConsole(`🔄 Calling generateAgeProof(${userAge}, ${minAge}, ${maxAge})...`, 'info');
  
  updateProgress(30);
  const proof = await generateAgeProof(userAge, minAge, maxAge);
  
  return proof;
}

async function generateRangeCheckProof() {
  const minVal = parseInt(document.getElementById('rangeMin').value);
  const maxVal = parseInt(document.getElementById('rangeMax').value);
  
  if (isNaN(minVal) || isNaN(maxVal)) {
    throw new Error('Invalid range values');
  }
  
  if (minVal >= maxVal) {
    throw new Error('Min value must be less than max value');
  }
  
  logConsole(`📊 Range Check Configuration:`, 'info');
  logConsole(`  • Test value (PRIVATE): ${userAge}`, 'log');
  logConsole(`  • Range: ${minVal}-${maxVal}`, 'log');
  logConsole(`  • Match: ${userAge >= minVal && userAge <= maxVal ? '✅ YES' : '❌ NO'}`, 'warn');
  
  updateProgress(20);
  logConsole(`🔄 Calling generateRangeProof(${userAge}, ${minVal}, ${maxVal})...`, 'info');
  
  updateProgress(30);
  const proof = await generateRangeProof(userAge, minVal, maxVal);
  
  return proof;
}

async function generateSetMembershipProof() {
  const setValuesStr = document.getElementById('setValues').value;
  const setValues = setValuesStr.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
  
  if (setValues.length === 0) {
    throw new Error('Invalid set values');
  }
  
  if (setValues.length > 5) {
    throw new Error('Maximum 5 set values supported');
  }
  
  // Pad set to 5 values
  while (setValues.length < 5) {
    setValues.push(0);
  }
  
  logConsole(`📊 Set Membership Configuration:`, 'info');
  logConsole(`  • Test value (PRIVATE): ${userAge}`, 'log');
  logConsole(`  • Allowed set: [${setValues.slice(0, setValues.length - (setValues.length === 5 && setValues[4] === 0 ? 1 : 0)).join(', ')}]`, 'log');
  logConsole(`  • In set: ${setValues.includes(userAge) ? '✅ YES' : '❌ NO'}`, 'warn');
  
  updateProgress(20);
  logConsole(`🔄 Calling generateSetMembershipProof(${userAge}, [${setValues.join(', ')}])...`, 'info');
  
  updateProgress(30);
  const proof = await generateSetMembershipProof(userAge, setValues);
  
  return proof;
}

function displayProof(proof) {
  logConsole('📋 Proof details:', 'log');
  
  // Details table
  const details = [
    { label: 'Circuit Name', value: proof.circuitName },
    { label: 'Proof Type', value: 'Groth16' },
    { label: 'Public Signals Count', value: proof.publicSignals.length },
    { label: 'Proof Status', value: '✅ Generated (not yet verified)' },
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
  logConsole(`  • ℹ️ Your actual private data is NOT in the proof or signals`, 'success');
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
    logConsole(`  • Valid: ${result.valid ? '✅ YES' : '❌ NO'}`, result.valid ? 'success' : 'error');
    logConsole(`  • Verification Time: ${result.verificationTime}ms`, 'log');
    
    if (result.message) {
      logConsole(`  • Message: ${result.message}`, 'log');
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
  
  if (result.valid) {
    resultDiv.className = 'verification-result valid';
    resultDiv.innerHTML = `
      <h3>✅ Proof Valid!</h3>
      <p>The zero-knowledge proof was successfully verified by the backend in ${result.verificationTime}ms.</p>
      <p style="margin-top: 8px; font-size: 12px; color: #cbd5e1;">
        The backend confirmed the proof without learning your actual private data.
      </p>
    `;
  } else {
    resultDiv.className = 'verification-result invalid';
    resultDiv.innerHTML = `
      <h3>❌ Proof Invalid</h3>
      <p>The backend rejected the proof.</p>
      ${result.message ? `<p style="margin-top: 8px; font-size: 12px;">${result.message}</p>` : ''}
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

console.log('[Test Page] Loaded - Ready to generate proofs for all circuit types');
