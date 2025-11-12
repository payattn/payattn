// Settings Page JavaScript - LLM Provider Configuration

console.log('[Settings] Initializing...');

const providerOptions = document.querySelectorAll('.provider-option');
const providerConfigs = document.querySelectorAll('.provider-config');
let selectedProvider = 'venice';

// Provider selection handlers
providerOptions.forEach(option => {
  option.addEventListener('click', () => {
    selectedProvider = option.dataset.provider;
    
    providerOptions.forEach(o => o.classList.remove('active'));
    option.classList.add('active');
    
    providerConfigs.forEach(c => c.classList.remove('active'));
    document.getElementById(`${selectedProvider}-config`).classList.add('active');
  });
});

// ========================================================================
// Refresh Models from LM Studio
// ========================================================================

document.getElementById('refreshModels').addEventListener('click', async (e) => {
  e.preventDefault(); // Prevent link navigation
  
  const refreshBtn = document.getElementById('refreshModels');
  const selectEl = document.getElementById('localModelName');
  const urlInput = document.getElementById('localUrl');
  const statusMsg = document.getElementById('statusMessage');
  
  try {
    const originalText = refreshBtn.textContent;
    refreshBtn.textContent = ' Loading...';
    refreshBtn.style.pointerEvents = 'none';
    
    const url = urlInput.value.trim();
    if (!url) {
      throw new Error('Enter Local Server URL first');
    }
    
    // Build models endpoint
    const baseUrl = url.replace(/\/v1\/?$/, ''); // Remove /v1 suffix if present
    const modelsEndpoint = `${baseUrl}/v1/models`;
    
    console.log('[Settings] Fetching models from:', modelsEndpoint);
    
    const response = await fetch(modelsEndpoint);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('[Settings] Models response:', data);
    
    // Clear existing options except the first one
    selectEl.innerHTML = '<option value="">-- Select a model --</option>';
    
    if (data.data && Array.isArray(data.data)) {
      data.data.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.id;
        selectEl.appendChild(option);
      });
      
      statusMsg.className = 'status-message success';
      statusMsg.textContent = ` Loaded ${data.data.length} model(s)`;
      statusMsg.style.display = 'block';
      
      setTimeout(() => {
        statusMsg.style.display = 'none';
      }, 3000);
    } else {
      throw new Error('Unexpected response format from Local Server');
    }
    
  } catch (error) {
    console.error('[Settings] Error fetching models:', error);
    statusMsg.className = 'status-message error';
    statusMsg.textContent = ` Failed to load models: ${error.message}`;
    statusMsg.style.display = 'block';
  } finally {
    refreshBtn.textContent = ' Refresh models';
    refreshBtn.style.pointerEvents = 'auto';
  }
});

// ========================================================================
// Load Current Configuration
// ========================================================================

// Load current configuration
async function loadConfiguration() {
  const config = await window.LLMService.getLLMConfig();
  
  selectedProvider = config.provider;
  providerOptions.forEach(o => {
    if (o.dataset.provider === selectedProvider) {
      o.classList.add('active');
    } else {
      o.classList.remove('active');
    }
  });
  
  providerConfigs.forEach(c => {
    if (c.id === `${selectedProvider}-config`) {
      c.classList.add('active');
    } else {
      c.classList.remove('active');
    }
  });
  
  if (config.veniceApiKey) {
    document.getElementById('veniceApiKey').value = config.veniceApiKey;
  }
  if (config.localUrl) {
    document.getElementById('localUrl').value = config.localUrl;
  }
  if (config.localModelName) {
    const selectEl = document.getElementById('localModelName');
    
    // Check if the saved model exists in the select options
    let optionExists = false;
    for (let i = 0; i < selectEl.options.length; i++) {
      if (selectEl.options[i].value === config.localModelName) {
        optionExists = true;
        break;
      }
    }
    
    // If saved model not in dropdown, add it
    if (!optionExists && config.localModelName) {
      const option = document.createElement('option');
      option.value = config.localModelName;
      option.textContent = config.localModelName + ' (saved)';
      selectEl.appendChild(option);
    }
    
    selectEl.value = config.localModelName;
  }
  
  updateStatus(config);
}

// Update status display
function updateStatus(config) {
  const statusEl = document.getElementById('currentStatus');
  
  if (config.provider === 'venice') {
    const hasKey = !!config.veniceApiKey;
    statusEl.innerHTML = `
      <div style="font-size: 13px; margin-bottom: 6px;">
        <strong>Provider:</strong> Venice AI (Cloud)
      </div>
      <div style="font-size: 13px;">
        <strong>Status:</strong> ${hasKey ? ' Configured' : ' Not configured'}
      </div>
    `;
  } else if (config.provider === 'local') {
    const hasUrl = !!config.localUrl;
    const hasModel = !!config.localModelName;
    statusEl.innerHTML = `
      <div style="font-size: 13px; margin-bottom: 6px;">
        <strong>Provider:</strong> Local Server
      </div>
      <div style="font-size: 13px; margin-bottom: 6px;">
        <strong>URL:</strong> ${config.localUrl || 'Not set'}
      </div>
      <div style="font-size: 13px; margin-bottom: 6px;">
        <strong>Model:</strong> ${config.localModelName || 'Not set'}
      </div>
      <div style="font-size: 13px;">
        <strong>Status:</strong> ${hasUrl && hasModel ? ' Configured (test connection)' : ' Not configured'}
      </div>
    `;
  }
}

// Save configuration button
document.getElementById('saveProvider').addEventListener('click', async () => {
  const statusMsg = document.getElementById('statusMessage');
  const saveBtn = document.getElementById('saveProvider');
  
  try {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    const config = { provider: selectedProvider };
    
    if (selectedProvider === 'venice') {
      const apiKey = document.getElementById('veniceApiKey').value.trim();
      if (!apiKey) {
        throw new Error('Venice AI API key is required');
      }
      config.veniceApiKey = apiKey;
    } else if (selectedProvider === 'local') {
      const url = document.getElementById('localUrl').value.trim();
      const modelName = document.getElementById('localModelName').value.trim();
      if (!url) {
        throw new Error('Local Server URL is required');
      }
      if (!modelName) {
        throw new Error('Model name is required');
      }
      config.localUrl = url;
      config.localModelName = modelName;
    }
    
    await window.LLMService.setLLMConfig(config);
    
    statusMsg.className = 'status-message success';
    statusMsg.textContent = ' Configuration saved successfully!';
    statusMsg.style.display = 'block';
    
    await loadConfiguration();
    
  } catch (error) {
    statusMsg.className = 'status-message error';
    statusMsg.textContent = ` ${error.message}`;
    statusMsg.style.display = 'block';
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Configuration';
    
    setTimeout(() => {
      statusMsg.style.display = 'none';
    }, 3000);
  }
});

// Test connection button
document.getElementById('testConnection').addEventListener('click', async () => {
  const statusMsg = document.getElementById('statusMessage');
  const testBtn = document.getElementById('testConnection');
  
  try {
    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';
    
    statusMsg.className = 'status-message';
    statusMsg.style.display = 'block';
    statusMsg.textContent = ' Testing connection...';
    
    const response = await window.LLMService.callLLM(
      [{ role: 'user', content: 'Say "OK" if you can hear me.' }],
      'qwen3-next-80b',
      0.7,
      50
    );
    
    if (response.success) {
      statusMsg.className = 'status-message success';
      statusMsg.textContent = ` Connection successful! Response: "${response.content.substring(0, 50)}..."`;
      
      // Update the configuration status display
      const config = await window.LLMService.getLLMConfig();
      const statusEl = document.getElementById('currentStatus');
      
      if (config.provider === 'venice') {
        statusEl.innerHTML = `
          <div style="font-size: 13px; margin-bottom: 6px;">
            <strong>Provider:</strong> Venice AI (Cloud)
          </div>
          <div style="font-size: 13px;">
            <strong>Status:</strong>  Working
          </div>
        `;
      } else if (config.provider === 'local') {
        statusEl.innerHTML = `
          <div style="font-size: 13px; margin-bottom: 6px;">
            <strong>Provider:</strong> Local Server
          </div>
          <div style="font-size: 13px; margin-bottom: 6px;">
            <strong>URL:</strong> ${config.localUrl || 'Not set'}
          </div>
          <div style="font-size: 13px; margin-bottom: 6px;">
            <strong>Model:</strong> ${config.localModelName || 'Not set'}
          </div>
          <div style="font-size: 13px;">
            <strong>Status:</strong>  Working
          </div>
        `;
      }
    } else {
      throw new Error(response.error || 'Connection failed');
    }
    
  } catch (error) {
    statusMsg.className = 'status-message error';
    statusMsg.textContent = ` Connection failed: ${error.message}`;
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = 'Test Connection';
  }
});

// Initialize on page load
loadConfiguration();
