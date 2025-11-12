/**
 * Venice AI Utility for Extension
 * 
 * Calls Venice AI directly from the extension (no backend involvement)
 * API key stored securely in chrome.storage.local
 * All user data stays local - only sent to Venice AI for processing
 * 
 * Docs: https://docs.venice.ai/overview/getting-started
 */

const VENICE_API_ENDPOINT = 'https://api.venice.ai/api/v1/chat/completions';

/**
 * Get Venice API key from secure storage
 * @returns {Promise<string|null>}
 */
async function getVeniceAPIKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get('payattn_venice_api_key', (result) => {
      resolve(result.payattn_venice_api_key || null);
    });
  });
}

/**
 * Call Venice AI directly from extension (no backend)
 * 
 * @param {Array<{role: string, content: string}>} messages - Array of messages in OpenAI format
 * @param {string} model - Model name (default: 'venice-uncensored')
 * @param {number} temperature - Randomness (0-1, default: 0.7)
 * @param {number} maxTokens - Max response length (default: 512)
 * @param {Array<Object>} tools - Optional tool definitions for function calling
 * @returns {Promise<Object>} Promise with AI response
 */
async function callVeniceAI(
  messages,
  model = 'venice-uncensored',
  temperature = 0.7,
  maxTokens = 512,
  tools = null
) {
  try {
    // Get API key from secure storage
    const apiKey = await getVeniceAPIKey();
    
    if (!apiKey) {
      return {
        success: false,
        model,
        content: '',
        error: 'Venice API key not configured',
        details: 'Set your API key in extension settings',
      };
    }

    console.log('[Venice] Sending request directly to Venice API:', {
      messageCount: messages.length,
      model,
      hasTools: !!tools,
    });

    const requestBody = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    // Add tools if provided
    if (tools && Array.isArray(tools)) {
      requestBody.tools = tools;
    }

    const response = await fetch(VENICE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }

      console.error('[Venice] Error response:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData.error,
      });

      return {
        success: false,
        model,
        content: '',
        error: errorData.error?.message || `Venice API error: ${response.statusText}`,
        details: errorText,
      };
    }

    const data = await response.json();
    
    const message = data.choices[0]?.message;
    if (!message) {
      return {
        success: false,
        model,
        content: '',
        error: 'No message in Venice response',
      };
    }

    // Check if model made a tool call (standard format)
    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log('[Venice] Tool calls detected:', message.tool_calls);
      
      return {
        success: true,
        model: data.model,
        content: message.content || '',
        toolCalls: message.tool_calls,
        usage: data.usage,
      };
    }

    // FALLBACK: Check for XML-style tool calls in content (some models output this)
    const completion = message.content || '';
    if (completion.includes('<tool_call>')) {
      console.log('[Venice] XML-style tool call detected in content, parsing...');
      
      try {
        // Extract JSON between <tool_call> tags (some models use same tag for open/close)
        const toolCallMatch = completion.match(/<tool_call>\s*(\{[\s\S]*?\})\s*<\/?tool_call>/);
        if (toolCallMatch) {
          const toolCallJson = JSON.parse(toolCallMatch[1]);
          
          // Convert to standard tool_calls format
          const standardToolCall = {
            id: 'xml_tool_' + Date.now(),
            type: 'function',
            function: {
              name: toolCallJson.name,
              arguments: typeof toolCallJson.arguments === 'string' 
                ? toolCallJson.arguments 
                : JSON.stringify(toolCallJson.arguments)
            }
          };
          
          // Remove tool call tags from content (handle both </tool_call> and <tool_call> as closing)
          const contentWithoutToolCall = completion
            .replace(/<tool_call>[\s\S]*?<\/?tool_call>/g, '')
            .trim();
          
          console.log('[Venice] Converted XML tool call to standard format');
          console.log('[Venice] Content after tool call removal:', contentWithoutToolCall.substring(0, 200));
          
          return {
            success: true,
            model: data.model,
            content: contentWithoutToolCall,
            toolCalls: [standardToolCall],
            usage: data.usage,
          };
        }
      } catch (error) {
        console.error('[Venice] Failed to parse XML tool call:', error);
      }
    }

    // Regular text response
    if (!completion) {
      return {
        success: false,
        model,
        content: '',
        error: 'No completion in Venice response',
      };
    }

    console.log('[Venice] Success response:', {
      model: data.model,
      contentLength: completion.length,
      tokensUsed: data.usage?.total_tokens,
    });

    return {
      success: true,
      model: data.model,
      content: completion,
      usage: data.usage,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Venice] Request failed:', errorMessage);

    return {
      success: false,
      model,
      content: '',
      error: 'Network error',
      details: errorMessage,
    };
  }
}

/**
 * Simple helper to send a user message with optional system prompt
 * 
 * @param {string} userMessage - The user's message
 * @param {string} systemPrompt - Optional system instruction
 * @returns {Promise<Object>} Promise with AI response
 */
async function sendMessage(
  userMessage,
  systemPrompt
) {
  const messages = [];

  if (systemPrompt) {
    messages.push({
      role: 'system',
      content: systemPrompt,
    });
  }

  messages.push({
    role: 'user',
    content: userMessage,
  });

  return callVeniceAI(messages);
}

/**
 * Analyze if user matches ad targeting criteria
 * Uses full user profile to match against advertiser targeting
 * 
 * @param {Object} adData - Ad with targeting info: { content, targeting: { ageRange, interests, etc } }
 * @param {Object} userProfile - User's full profile: { demographics, interests, financial, preferences, etc }
 * @returns {Promise<Object>} Analysis with match score and reasoning
 */
async function analyzeAdMatch(adData, userProfile) {
  const systemPrompt = `You are an ad matching expert. Analyze if a user matches the advertiser's target audience.

Your response MUST be JSON in this exact format (and NOTHING else):
{
  "matches": true/false,
  "matchScore": 0-100,
  "reasoning": "brief explanation of why they match or don't match",
  "matchedCriteria": ["array", "of", "matched", "criteria"],
  "unmatchedCriteria": ["array", "of", "unmatched", "criteria"]
}`;

  const userMessage = `
Ad Targeting: ${JSON.stringify(adData.targeting)}

User Profile:
${JSON.stringify(userProfile, null, 2)}

Ad Content: ${adData.content}

Determine if this user matches the ad's target audience. Consider age ranges, interests, income level, and other demographic factors.`;

  const response = await sendMessage(userMessage, systemPrompt);
  
  if (!response.success) {
    return response;
  }

  // Parse JSON response
  try {
    const parsed = JSON.parse(response.content);
    return {
      success: true,
      ...parsed,
      raw: response.content,
      usage: response.usage,
    };
  } catch (e) {
    console.error('[Venice] Failed to parse ad match response:', e);
    return {
      success: false,
      error: 'Failed to parse response',
      details: response.content,
    };
  }
}

/**
 * Process ad content with Venice AI
 * 
 * @param {string} adContent - Ad text to process
 * @returns {Promise<Object>} Promise with analysis/processing result
 */
async function processAd(adContent) {
  const systemPrompt = `You are an ad analysis assistant. Analyze the provided ad and provide a brief summary of:
1. Main message
2. Target audience  
3. Call to action
4. Estimated targeting criteria (age range, interests, etc.)

Keep your response concise (3-4 sentences).`;

  return sendMessage(adContent, systemPrompt);
}

/**
 * Generate ad preference prompt based on profile
 * 
 * @param {Object} profileData - User's ad profile/preferences
 * @returns {Promise<Object>} Promise with AI-generated preferences
 */
async function generatePreferencesFromProfile(profileData) {
  const systemPrompt = `You are a helpful assistant that understands user preferences. 
Based on the provided user profile, generate a concise set of ad preferences (3-5 bullet points) 
that would result in more relevant ad recommendations.`;

  const userMessage = `Profile data: ${JSON.stringify(profileData)}`;
  return sendMessage(userMessage, systemPrompt);
}

/**
 * Generate ad preference prompt based on profile
 * 
 * @param {Object} profileData - User's ad profile/preferences
 * @returns {Promise<Object>} Promise with AI-generated preferences
 */
async function generatePreferencesFromProfile(profileData) {
  const systemPrompt = `You are a helpful assistant that understands user preferences. 
Based on the provided user profile, generate a concise set of ad preferences (3-5 bullet points) 
that would result in more relevant ad recommendations.`;

  const userMessage = `Profile data: ${JSON.stringify(profileData)}`;
  return sendMessage(userMessage, systemPrompt);
}

/**
 * Save Venice API key to secure storage
 * @param {string} apiKey
 * @returns {Promise<boolean>} true if saved successfully
 */
async function setVeniceAPIKey(apiKey) {
  return new Promise((resolve) => {
    if (!apiKey || typeof apiKey !== 'string') {
      chrome.storage.local.remove('payattn_venice_api_key', () => {
        resolve(true);
      });
      return;
    }

    chrome.storage.local.set({ payattn_venice_api_key: apiKey }, () => {
      if (chrome.runtime.lastError) {
        console.error('[Venice] Failed to save API key:', chrome.runtime.lastError);
        resolve(false);
      } else {
        console.log('[Venice] API key saved successfully');
        resolve(true);
      }
    });
  });
}

/**
 * Check if Venice API key is configured
 * @returns {Promise<boolean>}
 */
async function hasVeniceAPIKey() {
  const key = await getVeniceAPIKey();
  return !!key;
}

/**
 * Clear Venice API key (for logout/reset)
 * @returns {Promise<boolean>}
 */
async function clearVeniceAPIKey() {
  return new Promise((resolve) => {
    chrome.storage.local.remove('payattn_venice_api_key', () => {
      console.log('[Venice] API key cleared');
      resolve(true);
    });
  });
}

/**
 * Tool Definitions for Venice AI function calling
 */
const VENICE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'makeOffer',
      description: 'Make an offer for an advertising campaign. Called when Max decides to accept an ad and price it.',
      parameters: {
        type: 'object',
        properties: {
          campaignId: {
            type: 'string',
            description: 'Unique identifier for the advertising campaign'
          },
          price: {
            type: 'number',
            description: 'The price offered in GBP (e.g., 0.05 for 5 pence)'
          },
          matchedRequirements: {
            type: 'array',
            description: 'Array of ONLY the requirements that matched and can be proven. Each requirement must match the user profile and be provable.',
            items: {
              type: 'object',
              properties: {
                requirement: {
                  type: 'string',
                  description: 'The requirement type (e.g., "age", "interest", "income", "location", "gender")'
                },
                advertiserCriteria: {
                  type: 'array',
                  description: 'The specific criteria values the advertiser wants (e.g., [25, 50] for age range, ["UK", "US", "CA"] for location). This is what gets sent to ZK-SNARK circuits - NOT the user value.'
                }
              },
              required: ['requirement', 'advertiserCriteria']
            }
          },
          reasoning: {
            type: 'string',
            description: 'Brief explanation of the pricing strategy and offer'
          }
        },
        required: ['campaignId', 'price', 'matchedRequirements']
      }
    }
  }
];

/**
 * Process a tool call from Venice AI
 * @param {string} toolName - Name of the tool being called
 * @param {Object|string} toolArgs - Arguments passed to the tool (may be object or JSON string)
 * @returns {Object} Result of tool execution
 */
function processToolCall(toolName, toolArgs) {
  // Parse tool arguments if they're a string (JSON)
  let parsedArgs = toolArgs;
  if (typeof toolArgs === 'string') {
    try {
      parsedArgs = JSON.parse(toolArgs);
    } catch (error) {
      console.error('[Venice] Failed to parse tool arguments:', error);
      return {
        success: false,
        error: `Failed to parse tool arguments: ${error.message}`
      };
    }
  }

  if (toolName === 'makeOffer') {
    return handleMakeOfferToolCall(parsedArgs);
  }
  
  console.warn(`[Venice] Unknown tool called: ${toolName}`);
  return {
    success: false,
    error: `Unknown tool: ${toolName}`
  };
}

/**
 * Handle makeOffer tool call
 * @param {Object} args - Tool arguments (already parsed)
 * @returns {Object} Tool execution result
 */
function handleMakeOfferToolCall(args) {
  // Validate required fields
  if (!args.campaignId || args.price === undefined) {
    console.error('[MAKEOFFER] Missing required fields:', args);
    return {
      success: false,
      error: 'Missing required fields: campaignId and price'
    };
  }

  const priceFormatted = typeof args.price === 'number' ? args.price.toFixed(4) : args.price;

  console.log('\n[OK][OK][OK] [MAKEOFFER] OFFER SUBMITTED');
  console.log('[OK]'.repeat(60));
  console.log(`Campaign: ${args.campaignId}`);
  console.log(`Price: ${priceFormatted}`);
  console.log(`Provable Requirements: ${args.matchedRequirements?.length || 0}`);
  
  if (args.matchedRequirements && Array.isArray(args.matchedRequirements)) {
    args.matchedRequirements.forEach((req, idx) => {
      console.log(`\n  ${idx + 1}. ${req.requirement}`);
      console.log(`     Advertiser Criteria: ${JSON.stringify(req.advertiserCriteria)}`);
      console.log(`     [OK][OK] ZK-SNARK proof to be generated`);
    });
  }
  
  console.log('\n' + '[OK]'.repeat(60) + '\n');

  return {
    success: true,
    message: `Offer submitted: ${priceFormatted} for ${args.campaignId} with ${args.matchedRequirements?.length || 0} provable requirements`,
    offer: {
      campaignId: args.campaignId,
      price: args.price,
      matchedRequirements: args.matchedRequirements,
      timestamp: new Date().toISOString(),
      proofsNeeded: args.matchedRequirements?.length || 0
    }
  };
}

/**
 * Get tool definitions for Venice AI
 * @returns {Array} Array of tool definitions
 */
function getVeniceTools() {
  return VENICE_TOOLS;
}

// Export for use in extension (both browser context and service worker)
const VeniceAI = {
  callVeniceAI,
  sendMessage,
  processAd,
  analyzeAdMatch,
  generatePreferencesFromProfile,
  setVeniceAPIKey,
  getVeniceAPIKey,
  hasVeniceAPIKey,
  clearVeniceAPIKey,
  getVeniceTools,
  processToolCall,
};

// Export to window in browser context
if (typeof window !== 'undefined') {
  window.VeniceAI = VeniceAI;
}

// Export to self in service worker context
if (typeof self !== 'undefined') {
  self.VeniceAI = VeniceAI;
}
