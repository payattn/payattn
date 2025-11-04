/**
 * Venice AI Prompt Lab Script
 * Iterate on system prompts and test them with streaming responses
 */

// Global profile data
let userProfile = null;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('submitBtn').addEventListener('click', handleSubmit);
  document.getElementById('clearBtn').addEventListener('click', handleClear);
  
  // Load saved prompts and profile
  loadSavedPrompts();
  loadUserProfile();
});

// Load previously saved prompts
async function loadSavedPrompts() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['prompt_lab_system', 'prompt_lab_json'], (result) => {
      if (result.prompt_lab_system) {
        document.getElementById('systemPrompt').value = result.prompt_lab_system;
      }
      if (result.prompt_lab_json) {
        document.getElementById('jsonData').value = result.prompt_lab_json;
      }
      resolve();
    });
  });
}

/**
 * Load user profile from chrome.storage and decrypt if needed
 */
async function loadUserProfile() {
  try {
    const profileStatus = document.getElementById('profileStatus');
    
    // Get wallet address
    const result = await chrome.storage.local.get(['payattn_walletAddress', 'payattn_keyHash', 'payattn_authToken']);
    const walletAddress = result.payattn_walletAddress;
    const keyHash = result.payattn_keyHash;
    const authToken = result.payattn_authToken;
    
    if (!walletAddress) {
      profileStatus.innerHTML = '⚠️ No profile: User not authenticated';
      profileStatus.style.color = '#f59e0b';
      return;
    }
    
    // Get encrypted profile
    const profileResult = await chrome.storage.local.get(`payattn_profile_${walletAddress}`);
    const profileData = profileResult[`payattn_profile_${walletAddress}`];
    
    if (!profileData || !profileData.encryptedData) {
      profileStatus.innerHTML = '⚠️ No profile saved. User needs to create one first.';
      profileStatus.style.color = '#f59e0b';
      userProfile = null;
      return;
    }
    
    // Decrypt profile
    try {
      profileStatus.innerHTML = '🔓 Decrypting profile...';
      profileStatus.style.color = '#718096';
      
      const keyMaterial = await fetchKeyMaterial(keyHash, walletAddress, authToken);
      const decryptedJson = await decryptDataWithMaterial(
        profileData.encryptedData,
        keyMaterial,
        walletAddress
      );
      
      userProfile = JSON.parse(decryptedJson);
      
      // Format profile for display
      const profileSummary = formatProfileSummary(userProfile);
      profileStatus.innerHTML = `✅ Profile loaded: ${profileSummary}`;
      profileStatus.style.color = '#059669';
      
      console.log('[Prompt Lab] User profile loaded:', userProfile);
      
    } catch (decryptError) {
      console.error('Failed to decrypt profile:', decryptError);
      profileStatus.innerHTML = '❌ Failed to decrypt profile. You may need to re-authenticate.';
      profileStatus.style.color = '#dc2626';
      userProfile = null;
    }
    
  } catch (error) {
    console.error('Error loading profile:', error);
    profileStatus.innerHTML = '❌ Error loading profile';
    profileStatus.style.color = '#dc2626';
  }
}

/**
 * Format profile for display
 */
function formatProfileSummary(profile) {
  const parts = [];
  
  if (profile.demographics?.age) {
    parts.push(`${profile.demographics.age}yo`);
  }
  if (profile.interests && profile.interests.length > 0) {
    parts.push(profile.interests.slice(0, 2).join('/'));
  }
  if (profile.location?.country) {
    parts.push(profile.location.country);
  }
  
  return parts.join(' • ') || 'Ready';
}

/**
 * Build system prompt with live profile data
 */
function buildSystemPromptWithProfile(basePrompt) {
  if (!userProfile) {
    console.warn('[Prompt Lab] No user profile loaded, using base prompt');
    return basePrompt;
  }
  
  // Format profile data as JSON string for injection
  const profileJson = JSON.stringify(userProfile, null, 2);
  
  // Replace placeholder or append profile
  let finalPrompt = basePrompt;
  
  if (basePrompt.includes('{{USER_PROFILE}}')) {
    finalPrompt = basePrompt.replace('{{USER_PROFILE}}', profileJson);
  } else if (basePrompt.includes('{{PROFILE_DATA}}')) {
    finalPrompt = basePrompt.replace('{{PROFILE_DATA}}', profileJson);
  } else if (basePrompt.includes('Boss Profile')) {
    // If prompt mentions "Boss Profile", replace the hardcoded section
    finalPrompt = basePrompt.replace(
      /Boss Profile[\s\S]*?(?=\n\n|Decision Framework)/,
      `Boss Profile (Live Data)\n${profileJson}\n\n`
    );
  } else {
    // No placeholder found, just use base prompt as-is
    console.log('[Prompt Lab] No profile placeholder found in prompt');
  }
  
  return finalPrompt;
}

// Save prompts to storage
async function savePrompts() {
  const systemPrompt = document.getElementById('systemPrompt').value;
  const jsonData = document.getElementById('jsonData').value;
  
  return new Promise((resolve) => {
    chrome.storage.local.set({
      prompt_lab_system: systemPrompt,
      prompt_lab_json: jsonData
    }, resolve);
  });
}

// Handle submit
async function handleSubmit() {
  // Refresh profile data at start of process
  await loadUserProfile();
  
  // Update the profile status display with fresh data
  const profileStatus = document.getElementById('profileStatus');
  if (userProfile) {
    const profileSummary = formatProfileSummary(userProfile);
    profileStatus.innerHTML = `✅ Profile loaded: ${profileSummary}`;
    profileStatus.style.color = '#059669';
  }
  
  const systemPromptBase = document.getElementById('systemPrompt').value.trim();
  const jsonData = document.getElementById('jsonData').value.trim();
  const temperature = parseFloat(document.getElementById('temperature').value);
  const maxTokens = parseInt(document.getElementById('maxTokens').value);

  // Validation
  if (!systemPromptBase) {
    showStatus('Please enter a system prompt', 'error');
    return;
  }

  if (!jsonData) {
    showStatus('Please enter JSON data', 'error');
    return;
  }

  // Try to parse JSON
  let parsedData;
  try {
    parsedData = JSON.parse(jsonData);
  } catch (error) {
    showStatus(`Invalid JSON: ${error.message}`, 'error');
    return;
  }

  // Build final prompt with fresh profile data
  const systemPrompt = buildSystemPromptWithProfile(systemPromptBase);
  
  // Save prompts for next session
  await savePrompts();

  // Clear previous response
  const responseContent = document.getElementById('responseContent');
  responseContent.textContent = '';
  responseContent.classList.remove('empty');

  // Show loading status
  showStatus('Processing... streaming response', 'loading');
  document.getElementById('submitBtn').disabled = true;

  const startTime = Date.now();
  let totalTokens = 0;

  try {
    // Build the user message with the JSON data
    const userMessage = `Here is the data to analyze:\n\n${JSON.stringify(parsedData, null, 2)}`;

    // Get tool definitions
    const tools = window.VeniceAI.getVeniceTools();

    // Call Venice AI with tools for function calling
    const response = await window.VeniceAI.callVeniceAI(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      'qwen3-next-80b',
      temperature,
      maxTokens,
      tools  // Pass tools to enable function calling
    );

    if (response.success) {
      // Handle tool calls if they occurred
      if (response.toolCalls && response.toolCalls.length > 0) {
        console.log('[Prompt Lab] Tool calls detected:', response.toolCalls.length);
        
        // Separate structured data from narrative
        let structuredOffers = [];
        let narrativeResponse = response.content || '(No narrative provided)';
        
        response.toolCalls.forEach((toolCall, index) => {
          try {
            console.log(`[Prompt Lab] Processing tool call: ${toolCall.function.name}`, toolCall.function.arguments);
            const result = window.VeniceAI.processToolCall(toolCall.function.name, toolCall.function.arguments);
            
            if (result.success && result.offer) {
              structuredOffers.push(result.offer);
            }
          } catch (error) {
            console.error('[Prompt Lab] Error processing tool call:', error);
          }
        });

        // Build response display
        let responseDisplay = '';
        
        // Show which profile was used
        if (userProfile) {
          const profileSummary = formatProfileSummary(userProfile);
          responseDisplay += `🔍 PROFILE USED: ${profileSummary}\n`;
          responseDisplay += '─'.repeat(50) + '\n\n';
        }
        
        // Show narrative first
        if (narrativeResponse && narrativeResponse !== '(No narrative provided)') {
          responseDisplay += '📝 MAX\'S ASSESSMENT\n';
          responseDisplay += '─'.repeat(50) + '\n';
          responseDisplay += narrativeResponse + '\n\n';
        }

        // Show structured offers
        if (structuredOffers.length > 0) {
          responseDisplay += '✅ PROVABLE OFFERS (ZK-SNARK proof generation needed)\n';
          responseDisplay += '─'.repeat(50) + '\n';
          structuredOffers.forEach((offer, idx) => {
            responseDisplay += `\n[Offer ${idx + 1}] ${offer.campaignId}\n`;
            responseDisplay += `Price: £${offer.price.toFixed(4)}\n`;
            responseDisplay += `Requirements to Prove (${offer.matchedRequirements?.length || 0}):\n`;
            
            if (offer.matchedRequirements && Array.isArray(offer.matchedRequirements)) {
              offer.matchedRequirements.forEach((req) => {
                responseDisplay += `  • ${req.requirement}: [${req.advertiserCriteria.join(', ')}]\n`;
                responseDisplay += `    ⚡ Generate ZK-SNARK proof that your ${req.requirement} is in this set\n`;
              });
            }
            responseDisplay += '\n';
          });
          
          responseDisplay += '\n📋 RAW JSON (for API submission)\n';
          responseDisplay += '─'.repeat(50) + '\n';
          responseDisplay += JSON.stringify(structuredOffers, null, 2);
        }

        responseContent.textContent = responseDisplay;
      } else {
        // Display regular text response only
        responseContent.textContent = response.content;
      }
      
      // Update stats
      if (response.usage) {
        totalTokens = response.usage.total_tokens;
        document.getElementById('tokenCount').textContent = 
          `Tokens: ${response.usage.prompt_tokens} + ${response.usage.completion_tokens} = ${totalTokens}`;
      }

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
      document.getElementById('processingTime').textContent = `Time: ${elapsedTime}s`;

      showStatus('✓ Processing complete', 'success');
      setTimeout(() => hideStatus(), 3000);
    } else {
      responseContent.textContent = `Error: ${response.error}\n\n${response.details || ''}`;
      showStatus(`✗ Error: ${response.error}`, 'error');
    }
  } catch (error) {
    responseContent.textContent = `Exception: ${error.message}`;
    showStatus(`✗ Exception: ${error.message}`, 'error');
    console.error('[Prompt Lab] Error:', error);
  } finally {
    document.getElementById('submitBtn').disabled = false;
  }
}

// Clear all fields
function handleClear() {
  if (!confirm('Clear all fields and response?')) {
    return;
  }

  document.getElementById('systemPrompt').value = '';
  document.getElementById('jsonData').value = '';
  document.getElementById('responseContent').textContent = 'Submit a prompt and JSON to see the streamed response here...';
  document.getElementById('responseContent').classList.add('empty');
  document.getElementById('tokenCount').textContent = 'Tokens: —';
  document.getElementById('processingTime').textContent = 'Time: —';
  
  hideStatus();

  // Clear from storage
  chrome.storage.local.set({
    prompt_lab_system: '',
    prompt_lab_json: ''
  });
}

// Show status message
function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type} show`;
  
  if (type === 'loading') {
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    status.insertBefore(spinner, status.firstChild);
  }
}

// Hide status message
function hideStatus() {
  const status = document.getElementById('status');
  status.classList.remove('show');
}
