/**
 * Venice AI Test Page Script
 * Interactive testing interface for Venice AI integration
 */

// Initialize event listeners on DOM load
document.addEventListener('DOMContentLoaded', () => {
  // Tab buttons
  document.getElementById('tabSimple').addEventListener('click', () => switchTab('simple'));
  document.getElementById('tabMatching').addEventListener('click', () => switchTab('matching'));
  
  // Template buttons
  document.getElementById('templateSimple').addEventListener('click', () => loadTemplate('simple'));
  document.getElementById('templateAdAnalysis').addEventListener('click', () => loadTemplate('ad-analysis'));
  document.getElementById('templateCreative').addEventListener('click', () => loadTemplate('creative'));
  document.getElementById('templateSummary').addEventListener('click', () => loadTemplate('summary'));
  
  // Simple Chat buttons
  document.getElementById('sendBtn').addEventListener('click', handleSend);
  document.getElementById('clearBtn').addEventListener('click', handleClear);
  
  // Ad Matching buttons
  document.getElementById('analyzeMatchBtn').addEventListener('click', handleAnalyzeMatch);
  document.getElementById('clearMatchingBtn').addEventListener('click', handleClearMatching);
});

// Tab switching
function switchTab(tab) {
  // Update buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const tabBtn = document.querySelector(`[data-tab="${tab}"]`);
  if (tabBtn) {
    tabBtn.classList.add('active');
  }

  // Update content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.style.display = 'none';
  });
  
  const tabContent = document.getElementById(tab + 'Tab');
  if (tabContent) {
    tabContent.style.display = 'block';
  }

  setStatus('Ready to test', 'idle');
  document.getElementById('responseContainer').style.display = 'none';
}

// Template loader
function loadTemplate(type) {
  const templates = {
    simple: {
      user: 'Why is privacy important?',
      system: 'You are a helpful AI assistant.'
    },
    'ad-analysis': {
      user: 'Analyze this ad: "Get 50% off premium features today! Limited time offer. Click here now!"',
      system: 'You are an ad analysis expert. Analyze the ad and identify: 1) Main message, 2) Target audience, 3) Call to action.'
    },
    creative: {
      user: 'Generate 3 creative headlines for a privacy-focused browser extension.',
      system: 'You are a creative copywriter specializing in tech products.'
    },
    summary: {
      user: 'Summarize this text in 2-3 sentences: "Privacy is the right to be left alone. It\'s a fundamental human right that allows people to maintain autonomy and dignity."',
      system: 'You are a summarization expert. Provide concise summaries while preserving key information.'
    }
  };

  const template = templates[type];
  if (template) {
    document.getElementById('userMessage').value = template.user;
    document.getElementById('systemPrompt').value = template.system;
  }
}

// Send message
async function handleSend() {
  const userMessage = document.getElementById('userMessage').value.trim();
  const systemPrompt = document.getElementById('systemPrompt').value.trim();
  const model = document.getElementById('model').value.trim();
  const temperature = parseFloat(document.getElementById('temperature').value);

  if (!userMessage) {
    setStatus('Please enter a message', 'error');
    return;
  }

  setStatus('Sending request to Venice AI...', 'loading');
  document.getElementById('sendBtn').disabled = true;

  try {
    updateDebug('Calling Venice API directly...');

    const response = await window.VeniceAI.callVeniceAI(
      systemPrompt
        ? [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ]
        : [{ role: 'user', content: userMessage }],
      model,
      temperature
    );

    if (response.success) {
      showResponse(response);
      setStatus(' Response received successfully', 'success');
      updateDebug(`Tokens used: ${response.usage?.total_tokens || 'N/A'}`);
    } else {
      setStatus(`Error: ${response.error || 'Unknown error'}`, 'error');
      updateDebug(`Error: ${response.error}\n${response.details || ''}`);
      showErrorResponse(response);
    }
  } catch (error) {
    setStatus(`Error: ${error.message}`, 'error');
    updateDebug(`Exception: ${error.message}`);
  } finally {
    document.getElementById('sendBtn').disabled = false;
  }
}

// Analyze ad match
async function handleAnalyzeMatch() {
  const profileText = document.getElementById('userProfile').value.trim();
  const adText = document.getElementById('adData').value.trim();

  if (!profileText || !adText) {
    setStatus('Please enter both user profile and ad data', 'error');
    return;
  }

  let userProfile, adData;
  try {
    userProfile = JSON.parse(profileText);
    adData = JSON.parse(adText);
  } catch (error) {
    setStatus('Invalid JSON: ' + error.message, 'error');
    return;
  }

  setStatus('Analyzing ad match...', 'loading');

  try {
    updateDebug('Analyzing if user matches ad targeting...');

    const response = await window.VeniceAI.analyzeAdMatch(adData, userProfile);

    if (response.success) {
      const matchDisplay = response.matches ? ' MATCH' : ' NO MATCH';
      const content = `${matchDisplay} (Score: ${response.matchScore}%)

Reasoning: ${response.reasoning}

Matched Criteria: ${response.matchedCriteria?.join(', ') || 'None'}
Unmatched Criteria: ${response.unmatchedCriteria?.join(', ') || 'None'}`;

      showResponse({ ...response, content });
      setStatus(' Analysis complete', 'success');
      updateDebug(`Match Score: ${response.matchScore}%`);
    } else {
      setStatus(`Error: ${response.error || 'Unknown error'}`, 'error');
      showErrorResponse(response);
    }
  } catch (error) {
    setStatus(`Error: ${error.message}`, 'error');
    updateDebug(`Exception: ${error.message}`);
  }
}

// Show response
function showResponse(response) {
  const container = document.getElementById('responseContainer');
  const content = document.getElementById('responseContent');
  const usage = document.getElementById('responseUsage');

  content.textContent = response.content || response.raw || JSON.stringify(response, null, 2);
  content.className = 'response-content';

  if (response.usage) {
    usage.innerHTML = `
      Model: ${response.model} | 
      Prompt: ${response.usage.prompt_tokens} tokens | 
      Completion: ${response.usage.completion_tokens} tokens | 
      Total: ${response.usage.total_tokens} tokens
    `;
    usage.style.display = 'block';
  }

  container.style.display = 'block';
}

// Show error response
function showErrorResponse(response) {
  const container = document.getElementById('responseContainer');
  const content = document.getElementById('responseContent');
  const usage = document.getElementById('responseUsage');

  content.innerHTML = `<span class="response-error">Error: ${response.error}</span>\n${response.details || ''}`;
  usage.style.display = 'none';
  container.style.display = 'block';
}

// Clear form
function handleClear() {
  document.getElementById('userMessage').value = '';
  document.getElementById('systemPrompt').value = 'You are a helpful AI assistant.';
  document.getElementById('responseContainer').style.display = 'none';
  setStatus('Ready to test', 'idle');
}

function handleClearMatching() {
  document.getElementById('userProfile').value = '';
  document.getElementById('adData').value = '';
  document.getElementById('responseContainer').style.display = 'none';
  setStatus('Ready to test', 'idle');
}

// Status helper
function setStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
}

// Debug helper
function updateDebug(message) {
  const debug = document.getElementById('debugInfo');
  const now = new Date().toLocaleTimeString();
  debug.textContent = `[${now}] ${message}`;
}
