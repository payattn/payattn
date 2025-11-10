/**
 * LLM Service - Provider-Agnostic AI Interface
 * 
 * Supports multiple LLM providers:
 * - Venice AI (cloud, default)
 * - Local LM Studio (OpenAI-compatible endpoint)
 * 
 * Provider configuration stored in chrome.storage.local
 * All user data stays local - only sent to chosen provider
 */

// ============================================================================
// Provider Configuration
// ============================================================================

/**
 * Get current LLM provider configuration
 * @returns {Promise<Object>} Provider config { provider, veniceApiKey, localUrl }
 */
async function getLLMConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get([
      'payattn_llm_provider',      // 'venice' or 'local'
      'payattn_venice_api_key',     // Venice API key
      'payattn_local_llm_url',      // Local LM Studio URL
      'payattn_local_model_name'    // Local model name
    ], (result) => {
      resolve({
        provider: result.payattn_llm_provider || 'venice',
        veniceApiKey: result.payattn_venice_api_key || null,
        localUrl: result.payattn_local_llm_url || 'http://localhost:1234/v1',
        localModelName: result.payattn_local_model_name || null
      });
    });
  });
}

/**
 * Set LLM provider configuration
 * @param {Object} config - { provider, veniceApiKey, localUrl }
 * @returns {Promise<void>}
 */
async function setLLMConfig(config) {
  return new Promise((resolve) => {
    const storageData = {};
    
    if (config.provider) {
      storageData.payattn_llm_provider = config.provider;
    }
    if (config.veniceApiKey !== undefined) {
      storageData.payattn_venice_api_key = config.veniceApiKey;
    }
    if (config.localUrl !== undefined) {
      storageData.payattn_local_llm_url = config.localUrl;
    }
    if (config.localModelName !== undefined) {
      storageData.payattn_local_model_name = config.localModelName;
    }
    
    chrome.storage.local.set(storageData, resolve);
  });
}

/**
 * Check if LLM provider is configured
 * @returns {Promise<boolean>}
 */
async function hasLLMConfigured() {
  const config = await getLLMConfig();
  
  if (config.provider === 'venice') {
    return !!config.veniceApiKey;
  } else if (config.provider === 'local') {
    return !!config.localUrl;
  }
  
  return false;
}

// ============================================================================
// Universal LLM Interface
// ============================================================================

/**
 * Call LLM (provider-agnostic)
 * 
 * @param {Array<{role: string, content: string}>} messages - Array of messages in OpenAI format
 * @param {string} model - Model name (provider-specific)
 * @param {number} temperature - Randomness (0-1, default: 0.7)
 * @param {number} maxTokens - Max response length (default: 512)
 * @param {Array<Object>} tools - Optional tool definitions for function calling
 * @returns {Promise<Object>} Promise with AI response
 */
async function callLLM(
  messages,
  model = 'qwen3-next-80b',
  temperature = 0.7,
  maxTokens = 512,
  tools = null
) {
  const config = await getLLMConfig();
  
  console.log(`[LLM Service] Using provider: ${config.provider}`);
  
  if (config.provider === 'venice') {
    return callVeniceAI(messages, model, temperature, maxTokens, tools, config.veniceApiKey);
  } else if (config.provider === 'local') {
    // Use configured model name for local LLM, fallback to parameter
    const localModel = config.localModelName || model;
    return callLocalLLM(messages, localModel, temperature, maxTokens, tools, config.localUrl);
  } else {
    return {
      success: false,
      model,
      content: '',
      error: 'Unknown LLM provider',
      details: `Provider '${config.provider}' not supported`
    };
  }
}

// ============================================================================
// Venice AI Provider
// ============================================================================

const VENICE_API_ENDPOINT = 'https://api.venice.ai/api/v1/chat/completions';

/**
 * Call Venice AI
 */
async function callVeniceAI(messages, model, temperature, maxTokens, tools, apiKey) {
  try {
    if (!apiKey) {
      return {
        success: false,
        model,
        content: '',
        error: 'Venice API key not configured',
        details: 'Set your API key in extension settings',
      };
    }

    console.log('[Venice] Sending request:', {
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
        error: `Venice API error: ${response.status}`,
        details: errorData.error || response.statusText,
      };
    }

    const data = await response.json();

    // Extract response
    const choice = data.choices?.[0];
    const message = choice?.message;

    // Check for tool calls (function calling)
    const toolCalls = message?.tool_calls;

    return {
      success: true,
      model: data.model || model,
      content: message?.content || '',
      toolCalls: toolCalls || null,
      usage: data.usage,
    };

  } catch (err) {
    console.error('[Venice] Request failed:', err);
    return {
      success: false,
      model,
      content: '',
      error: 'Venice request failed',
      details: err.message,
    };
  }
}

// ============================================================================
// Local LM Studio Provider
// ============================================================================

/**
 * Call Local LM Studio (OpenAI-compatible endpoint)
 */
async function callLocalLLM(messages, model, temperature, maxTokens, tools, localUrl) {
  try {
    if (!localUrl) {
      return {
        success: false,
        model,
        content: '',
        error: 'Local LLM URL not configured',
        details: 'Set your LM Studio URL in extension settings',
      };
    }

    // LM Studio uses OpenAI-compatible API at /v1/chat/completions
    const endpoint = localUrl.endsWith('/chat/completions') 
      ? localUrl 
      : `${localUrl}/chat/completions`;

    console.log('[Local LLM] Sending request:', {
      endpoint,
      messageCount: messages.length,
      model,
      hasTools: !!tools,
    });

    const requestBody = {
      model: model || 'local-model', // LM Studio uses loaded model
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    if (tools && Array.isArray(tools)) {
      requestBody.tools = tools;
    }

    console.log('[Local LLM] Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Local LLM] Error response:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });

      return {
        success: false,
        model,
        content: '',
        error: `Local LLM error: ${response.status}`,
        details: errorText || response.statusText,
      };
    }

    const data = await response.json();

    // Extract response (OpenAI format)
    const choice = data.choices?.[0];
    const message = choice?.message;
    const toolCalls = message?.tool_calls;

    return {
      success: true,
      model: data.model || model,
      content: message?.content || '',
      toolCalls: toolCalls || null,
      usage: data.usage,
    };

  } catch (err) {
    console.error('[Local LLM] Request failed:', err);
    return {
      success: false,
      model,
      content: '',
      error: 'Local LLM request failed',
      details: err.message,
    };
  }
}

// ============================================================================
// Tool Calling (Shared across providers)
// ============================================================================

/**
 * Venice AI Tool Definitions (Max's decision tools)
 */
const MAX_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'makeOffer',
      description: 'Make an offer to view an ad based on your analysis',
      parameters: {
        type: 'object',
        properties: {
          campaignId: {
            type: 'string',
            description: 'Campaign ID from the ad data',
          },
          price: {
            type: 'number',
            description: 'Price in USD (e.g., 0.0280 for $0.0280). Should be between 0.005 and 0.10',
          },
          matchedRequirements: {
            type: 'array',
            description: 'Array of ONLY the requirements that match and can be proven with ZK-SNARKs',
            items: {
              type: 'object',
              properties: {
                requirement: {
                  type: 'string',
                  description: 'Type of requirement: age/location/income/interest/gender',
                },
                advertiserCriteria: {
                  description: 'The specific values/set the advertiser wants (e.g., ["UK", "US", "CA"] for location, or [25, 50] for age range)',
                },
              },
              required: ['requirement', 'advertiserCriteria'],
            },
          },
          reasoning: {
            type: 'string',
            description: 'Empty string (narrative goes in your text response, not here)',
          },
        },
        required: ['campaignId', 'price', 'matchedRequirements', 'reasoning'],
      },
    },
  },
];

/**
 * Get tool definitions for LLM
 * @returns {Array} Array of tool definitions
 */
function getLLMTools() {
  return MAX_TOOLS;
}

/**
 * Process tool call from LLM
 * @param {string} toolName - Name of the tool called
 * @param {string} argsJson - JSON string of arguments
 * @returns {Object} Result of tool execution
 */
function processToolCall(toolName, argsJson) {
  try {
    const args = typeof argsJson === 'string' ? JSON.parse(argsJson) : argsJson;

    if (toolName === 'makeOffer') {
      // Validate offer
      if (!args.campaignId) {
        return {
          success: false,
          error: 'Missing campaignId',
        };
      }

      if (!args.price || args.price < 0.005 || args.price > 0.10) {
        return {
          success: false,
          error: 'Invalid price (must be between $0.005 and $0.10)',
        };
      }

      if (!Array.isArray(args.matchedRequirements)) {
        return {
          success: false,
          error: 'matchedRequirements must be an array',
        };
      }

      return {
        success: true,
        offer: {
          campaignId: args.campaignId,
          price: args.price,
          matchedRequirements: args.matchedRequirements || [],
          reasoning: args.reasoning || '',
        },
      };
    }

    return {
      success: false,
      error: `Unknown tool: ${toolName}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Tool execution failed: ${error.message}`,
    };
  }
}

// ============================================================================
// Export Interface
// ============================================================================

const LLMService = {
  // Configuration
  getLLMConfig,
  setLLMConfig,
  hasLLMConfigured,
  
  // Main interface
  callLLM,
  getLLMTools,
  processToolCall,
  
  // Legacy Venice AI compatibility (deprecated, use callLLM)
  callVeniceAI: callLLM,
  getVeniceAPIKey: async () => (await getLLMConfig()).veniceApiKey,
  hasVeniceAPIKey: hasLLMConfigured,
  setVeniceAPIKey: async (key) => setLLMConfig({ veniceApiKey: key }),
  clearVeniceAPIKey: async () => setLLMConfig({ veniceApiKey: null }),
  getVeniceTools: getLLMTools,
};

// Export to window in browser context
if (typeof window !== 'undefined') {
  window.LLMService = LLMService;
  // Backward compatibility
  window.VeniceAI = LLMService;
}

// Export to self in service worker context
if (typeof self !== 'undefined') {
  self.LLMService = LLMService;
  // Backward compatibility
  self.VeniceAI = LLMService;
}
