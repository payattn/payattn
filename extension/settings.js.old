/**
 * Settings Page Script
 * Manages Venice AI API key configuration
 */

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initSettings();
  
  // Attach event listeners
  document.getElementById('showKeyBtn').addEventListener('click', toggleShowKey);
  document.getElementById('saveKeyBtn').addEventListener('click', handleSaveKey);
  document.getElementById('testConnectionBtn').addEventListener('click', handleTestConnection);
  document.getElementById('clearKeyBtn').addEventListener('click', handleClearKey);
});

async function initSettings() {
  console.log('[Settings] Initializing...');
  await updateKeyStatus();
}

// Update key status display
async function updateKeyStatus() {
  const hasKey = await window.VeniceAI.hasVeniceAPIKey();
  const keyStatus = document.getElementById('keyStatus');
  const keyStatusText = document.getElementById('keyStatusText');

  if (hasKey) {
    keyStatus.className = 'key-status configured';
    keyStatusText.textContent = '✓ API key configured';
  } else {
    keyStatus.className = 'key-status not-configured';
    keyStatusText.textContent = '✗ API key not configured';
  }
}

// Toggle show/hide password
function toggleShowKey() {
  const input = document.getElementById('apiKey');
  const toggle = document.getElementById('showKeyToggle');
  
  if (input.type === 'password') {
    input.type = 'text';
    input.classList.remove('masked');
    toggle.textContent = '🙈 Hide';
  } else {
    input.type = 'password';
    input.classList.add('masked');
    toggle.textContent = '👁️ Show';
  }
}

// Save API key
async function handleSaveKey() {
  const apiKey = document.getElementById('apiKey').value.trim();
  
  if (!apiKey) {
    showStatus('Please enter an API key', 'error');
    return;
  }

  // Venice API keys are plain text strings (no specific format required)
  if (apiKey.length < 10) {
    showStatus('API key seems too short. Please verify.', 'error');
    return;
  }

  showStatus('Saving API key...', 'loading');
  
  const success = await window.VeniceAI.setVeniceAPIKey(apiKey);
  
  if (success) {
    showStatus('✓ API key saved successfully', 'success');
    document.getElementById('apiKey').value = '';
    await updateKeyStatus();
    setTimeout(() => hideStatus(), 3000);
  } else {
    showStatus('✗ Failed to save API key', 'error');
  }
}

// Test connection
async function handleTestConnection() {
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = '⏳ Testing...';

  try {
    const hasKey = await window.VeniceAI.hasVeniceAPIKey();
    
    if (!hasKey) {
      showStatus('✗ No API key configured. Save one first.', 'error');
      btn.disabled = false;
      btn.textContent = '🧪 Test Connection';
      return;
    }

    showStatus('Testing connection to Venice AI...', 'loading');

    const response = await window.VeniceAI.sendMessage(
      'Say "Connection successful" in one word'
    );

    if (response.success) {
      showStatus(`✓ Connection successful! Response: "${response.content}"`, 'success');
      console.log('[Settings] Test response:', response);
    } else {
      showStatus(`✗ Connection failed: ${response.error}`, 'error');
      console.error('[Settings] Error:', response);
    }
  } catch (error) {
    showStatus(`✗ Test failed: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🧪 Test Connection';
  }
}

// Clear API key
async function handleClearKey() {
  if (!confirm('Are you sure you want to clear your API key? You\'ll need to set it up again.')) {
    return;
  }

  showStatus('Clearing API key...', 'loading');
  
  const success = await window.VeniceAI.clearVeniceAPIKey();
  
  if (success) {
    showStatus('✓ API key cleared', 'success');
    document.getElementById('apiKey').value = '';
    await updateKeyStatus();
    setTimeout(() => hideStatus(), 3000);
  } else {
    showStatus('✗ Failed to clear API key', 'error');
  }
}

// Show status message
function showStatus(message, type) {
  const status = document.getElementById('statusMessage');
  status.textContent = message;
  status.className = `status ${type}`;
  status.style.display = 'block';
}

// Hide status message
function hideStatus() {
  document.getElementById('statusMessage').style.display = 'none';
}
