/**
 * Max Assessment Module
 * 
 * Modular assessment logic that can be used by BOTH:
 * - ad-queue.js (manual UI trigger)
 * - background.js (automated periodic trigger)
 * 
 * This module encapsulates Max's AI-powered ad evaluation and offer submission logic
 */

// ============================================================================
// Constants
// ============================================================================

const MAX_SYSTEM_PROMPT = `# Max: Attention Broker Agent

## Role and Objective
You are an attention broker managing YOUR attention - your most valuable asset: your eyeballs. 
Advertisers pay YOU to view their ads. Your job is to:

1. Assess whether an ad is worth showing to you
2. Price ads based on advertiser willingness to pay AND your interruption cost
3. Make decisions that maximize value extraction for you

## Your Profile

The following is your live profile data (loaded from secure encrypted storage):

\`\`\`json
{{USER_PROFILE}}
\`\`\`

Use this data to make pricing decisions. When mentioning requirements, reference the actual values from YOUR profile.

## The Pricing Dynamic
You're answering TWO questions:

**Question 1: Advertiser Value**
"How much will this advertiser pay for YOUR eyeballs?"
- High value: You match targeting perfectly + strong advertiser + core demo
- Low value: You don't match + weak advertiser + off-target

**Question 2: Interruption Cost**
"How much do you need to tolerate this?"
- Low cost: Highly relevant ad (cars/football/crypto) - not an interruption
- High cost: Irrelevant ad - pure interruption, you deserve premium

**Optimal extraction** = both numbers high (perfect match + moderate relevance)

## Decision Framework

### REJECT if ANY of these:
- You're NOT in target AND ad irrelevant (no value to advertiser, no value to you)
- Fraud/scam detected (domain mismatch, suspicious brand)
- Target score ≤3 AND relevance score ≤3

### OFFER with appropriate price:

**LOWER price (£0.01-0.02):**
- High relevance (8-10) to your interests + good target match
- You get value from seeing this = low interruption cost
- Price near or slightly below advertiser's avg_paid_30d

**MODERATE price (£0.02-0.04):**
- Good target match (7-10) + moderate relevance (4-7)  
- Sweet spot: advertiser values your eyeballs, you tolerate interruption
- Price around advertiser's avg_paid_30d

**PREMIUM price (£0.04-0.08):**
- Perfect target match (9-10) + low relevance (3-6)
- Advertiser desperately wants your eyeballs, you need significant compensation
- Price above advertiser's avg_paid_30d

**MINIMAL price (<£0.01):**
- Weak target match (4-6) even with some relevance
- Test if they'll take off-target impressions cheap

## For Each Ad: Your Process

1. **ANALYZE** (internal thinking):
   - Do you match their targeting? (age, location, income, interests, etc.)
   - Is the ad relevant to your interests?
   - Is the advertiser legitimate? (check domain vs name)
   - What would advertiser pay for this?
   - How much interruption cost for you?

2. **DECIDE**: REJECT or OFFER

3. **IF OFFERING** (CRITICAL - READ THIS CAREFULLY):
   
   **YOU MUST CALL THE makeOffer TOOL - THIS IS NOT OPTIONAL**
   
   If you write "DECISION: OFFER" in your response, you MUST also call the \`makeOffer\` tool.
   Writing "DECISION: OFFER" without calling the tool will result in automatic rejection.
   
   To make an offer, you MUST:
   - Call the \`makeOffer\` tool with these parameters:
     - \`campaignId\`: Campaign ID from the data
     - \`price\`: Your calculated price in USD (e.g., 0.0280 for $0.0280)
     - \`matchedRequirements\`: Array of ONLY the requirements that match and can be proven
       - requirement: age/location/income/interest/gender/etc
       - advertiserCriteria: The specific values/set the advertiser wants (e.g., ["UK", "US", "CA"] for location)
       - (NO userValue - that stays private and is never sent)
     - \`reasoning\`: "" (empty string - no narrative here)
   
   - Then write 2-3 sentences explaining why this is a good deal for you

**IMPORTANT:** Only include requirements in matchedRequirements where:
- Your profile value matches/falls within advertiser's criteria
- AND we can generate a zero-knowledge proof of that match
- If you don't match or can't prove it, don't include it

**CRITICAL RULE:** 
- "DECISION: OFFER" = You MUST call the makeOffer tool
- "DECISION: REJECT" = Do NOT call any tool
- If you want to reject an ad, just write your reasoning and say "DECISION: REJECT"

4. **OUTPUT STRUCTURE**:
   \`\`\`
   [Your brief analysis - 2-3 sentences addressing you directly]
   
   SUMMARY:
   • [Brief friendly reason 1]
   • [Brief friendly reason 2]
   • [Brief friendly reason 3]
   
   DECISION: OFFER [or REJECT]
   \`\`\`
   
   **CRITICAL:** Write your response in this EXACT order:
   1. Brief analysis (2-3 sentences)
   2. "SUMMARY:" header followed by 2-4 bullet points (friendly, conversational)
   3. "DECISION: OFFER" or "DECISION: REJECT" (this triggers the tool call if OFFER)
   
   **SUMMARY BULLETS - Write like a friend talking to a friend:**
   - ❌ "Perfect age match (43 in 25-50 range)" 
   - ✅ "You're the perfect age for this"
   
   - ❌ "Not in approved countries"
   - ✅ "You're not in the right place for this one"
   
   - ❌ "Income below target range"
   - ✅ "They're looking for someone who earns more"
   
   - ❌ "No interest match for luxury watches"
   - ✅ "Watches really aren't your thing"
   
   Keep it casual, friendly, and varied. Don't be formulaic - mix up your phrasing. You might say:
   - "Crypto is literally your jam"
   - "They want someone in the US but you're in France"
   - "The price makes sense for both of you"
   - "This brand actually matches your vibe"
   - "You're exactly who they're hunting for"
   
   Be natural and conversational - imagine explaining to a friend over coffee.

**CRITICAL FORMATTING:**
- Always address the user as "you/your" (NEVER "boss" or "your boss")
- SUMMARY must come BEFORE DECISION (this is critical for tool calling to work)
- Write summary bullets like a friend talking to a friend - casual and direct
- Keep each bullet point to one short phrase (5-10 words max)
- Use natural language: "you're the perfect age" not "age match confirmed"

## Important Notes

- Always address the user as "you" and "your attention" (NEVER "boss" or "the boss")
- Pricing must reflect what advertiser will pay, adjusted for your tolerance
- Maximum value when both advertiser willingness AND interruption cost are high
- Tool calls should contain ONLY structured data, NO narrative
- Your personality/reasoning goes in the text response, not the tool parameters
- Keep tool data clean and parseable for backend processing
- Always include a SUMMARY section with 2-4 brief bullet points after the decision

## Example

Input: Ad for luxury watches, targets age 25-50, willing to pay $0.03 avg

Output:

\`\`\`
You're 43 and match Rolex's target demographic perfectly. The ad is adjacent to your crypto interests (both high-value demographics). However, watches aren't your core interest, so interruption cost is moderate.

SUMMARY:
• You're the perfect age for this (43 fits their 25-50)
• Rolex is legit, they pay well
• Price of $0.028 is fair for the interruption
• Not your main interest but valuable to them

DECISION: OFFER
\`\`\`

Note: The makeOffer tool call is triggered when you write "DECISION: OFFER" at the END of your response. The SUMMARY must come first.

(ZK-SNARK proofs will be generated separately for each matchedRequirement)

## What Goes Where

| Element | Where It Goes | Format |
|---------|---------------|--------|
| Campaign analysis | Your narrative text (first) | 2-3 sentences |
| Summary bullets | Your response: "SUMMARY:" + bullets (second) | 2-4 friendly bullet points |
| Decision | Your response: "DECISION: OFFER/REJECT" (last) | One line at the end |
| Tool call | Automatic (triggered by DECISION: OFFER) | System handles |
| Matched requirements | makeOffer tool parameters | Structured array |
| Price calculation | makeOffer tool parameters | Number (USD) |
| Advertiser assessment | Internal thinking (informs decision) | Used in your logic |
| Domain verification | Internal thinking (validates legitimacy) | Used for REJECT |
`;

// ============================================================================
// Core Assessment Function
// ============================================================================

/**
 * Assess ads with Max AI logic
 * 
 * @param {Array} ads - Array of ad campaign objects to assess
 * @param {Object} userProfile - User profile data (decrypted)
 * @param {Object} options - Optional configuration
 * @param {string} options.veniceModel - Venice AI model to use (default: 'qwen3-next-80b')
 * @param {number} options.temperature - Temperature for Venice AI (default: 0.7)
 * @param {boolean} options.autoSubmit - Whether to auto-submit offers to backend (default: true)
 * @returns {Promise<Object>} Session object with assessment results
 */
async function assessAds(ads, userProfile, options = {}) {
  const {
    veniceModel = 'qwen3-next-80b',
    temperature = 0.7,
    autoSubmit = true
  } = options;
  
  console.log(`[Max Assessor] Assessing ${ads.length} ads...`);
  
  // Get LLMService reference (works in both browser and service worker contexts)
  const LLMService = typeof window !== 'undefined' ? window.LLMService : self.LLMService;
  
  if (!LLMService) {
    throw new Error('LLMService not loaded - check script imports');
  }
  
  // Validate LLM provider is configured
  const hasConfigured = await LLMService.hasLLMConfigured();
  if (!hasConfigured) {
    throw new Error('LLM provider not configured - set API key or local URL in settings');
  }
  
  // Create session to track results
  const session = {
    id: generateSessionId(),
    timestamp: new Date().toISOString(),
    triggerType: 'unknown', // Caller should set this
    ads: []
  };
  
  // Assess each ad sequentially
  for (const ad of ads) {
    try {
      const assessment = await assessSingleAd(ad, userProfile, {
        veniceModel,
        temperature,
        autoSubmit,
        LLMService // Pass LLMService as dependency
      });
      
      session.ads.push({
        campaign: ad,
        assessment
      });
    } catch (error) {
      console.error(`[Max Assessor] Failed to assess ad ${ad.id}:`, error);
      
      // Add error assessment
      session.ads.push({
        campaign: ad,
        assessment: {
          decision: 'REJECT',
          reason: `Assessment failed: ${error.message}`,
          offer: null,
          narrative: `Error: ${error.message}`,
          thinkingSteps: [error.message]
        }
      });
    }
  }
  
  console.log(`[Max Assessor] Assessment complete. ${session.ads.length} ads processed.`);
  return session;
}

/**
 * Assess a single ad campaign
 * 
 * @param {Object} campaign - Ad campaign object
 * @param {Object} userProfile - User profile data
 * @param {Object} options - Configuration options
 * @param {Object} options.LLMService - LLMService instance (required)
 * @returns {Promise<Object>} Assessment result
 */
async function assessSingleAd(campaign, userProfile, options = {}) {
  const { veniceModel, temperature, autoSubmit, LLMService } = options;
  
  if (!LLMService) {
    throw new Error('LLMService instance required in options');
  }
  
  console.log(`[Max] Assessing campaign: ${campaign.id}`);
  
  // Build system prompt with user profile
  const systemPrompt = buildSystemPromptWithProfile(userProfile);
  
  // Format campaign data for Max
  const campaignData = {
    campaignId: campaign.id,
    advertiser: campaign.advertiser || {},
    content: {
      headline: campaign.headline,
      body: campaign.body,
      cta: campaign.cta,
    },
    targeting: campaign.targeting || {},
    metrics: {
      avgPaid30d: campaign.advertiser?.avgPaid30d || 0,
      qualityRating: campaign.advertiser?.qualityRating || 5,
      accountAge: campaign.advertiser?.accountAge || 0,
    }
  };
  
  // User message with campaign data
  const userMessage = `Here is the ad campaign to analyze:\n\n${JSON.stringify(campaignData, null, 2)}`;
  
  // Get LLM tool definitions
  const tools = LLMService.getLLMTools();
  
  // Call LLM with Max's system prompt
  const response = await LLMService.callLLM(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    veniceModel,
    temperature,
    1024, // Max tokens
    tools // Function calling enabled
  );
  
  if (!response.success) {
    console.error('[Max] LLM error:', response.error);
    throw new Error(`LLM error: ${response.error}`);
  }
  
  // Process response
  let decision = 'REJECT';
  let reason = '';
  let offer = null;
  let narrative = response.content || '';
  let toolCallResults = [];
  
  // Handle tool calls (makeOffer)
  if (response.toolCalls && response.toolCalls.length > 0) {
    console.log(`[Max] Tool calls detected: ${response.toolCalls.length}`);
    
    decision = 'MAKING OFFER';
    
    for (const toolCall of response.toolCalls) {
      try {
        const result = LLMService.processToolCall(toolCall.function.name, toolCall.function.arguments);
        
        if (result.success && result.offer) {
          toolCallResults.push(result.offer);
          offer = result.offer.price;
          reason = `Max says: Making offer at $${offer.toFixed(4)}`;
          
          // GENERATE ZK-SNARK PROOFS for matched requirements
          console.log('[Max] Generating ZK proofs for matched requirements...');
          const generatedProofs = await generateProofsForOffer(result.offer, campaign);
          
          // Store proofs in the result
          result.offer.proofs = generatedProofs;
          
          // SUBMIT OFFER TO BACKEND (if autoSubmit enabled)
          if (autoSubmit) {
            try {
              console.log('[Max] Submitting offer to backend...');
              const backendResponse = await submitOfferToBackend(campaign, offer, generatedProofs);
              
              // Store backend response in assessment
              result.offer.offerId = backendResponse.offer_id;
              result.offer.status = backendResponse.status;
              
              console.log(`✅ [Max] Offer submitted successfully! Offer ID: ${backendResponse.offer_id}`);
              reason = `Max says: Offer submitted! (ID: ${backendResponse.offer_id})`;
            } catch (submitError) {
              console.error('❌ [Max] Failed to submit offer to backend:', submitError.message);
              reason = `Max says: Offer generated but submission failed: ${submitError.message}`;
              // Continue with local assessment even if backend submission fails
            }
          }
        }
      } catch (error) {
        console.error('[Max] Error processing tool call:', error);
      }
    }
  } else {
    // No tool call = rejection
    decision = 'REJECT';
    reason = narrative || 'Max says: Not interested in this one.';
  }
  
  // Extract thinking steps from narrative (split by newlines)
  const thinkingSteps = narrative.split('\n').filter(line => line.trim().length > 0);
  
  return {
    decision,
    reason,
    offer,
    narrative,
    thinkingSteps,
    toolCallResults,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build system prompt with live profile data
 */
function buildSystemPromptWithProfile(userProfile) {
  if (!userProfile) {
    console.warn('[Max] No user profile provided, using base prompt without profile data');
    return MAX_SYSTEM_PROMPT.replace('{{USER_PROFILE}}', '{ "error": "No profile data available" }');
  }
  
  // Format profile data as JSON string for injection
  const profileJson = JSON.stringify(userProfile, null, 2);
  return MAX_SYSTEM_PROMPT.replace('{{USER_PROFILE}}', profileJson);
}

/**
 * Generate a unique session ID
 */
function generateSessionId() {
  return `max_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Submit offer with ZK proofs to backend
 * @param {Object} campaign - Campaign object with id
 * @param {number} price - Offer price in USD
 * @param {Object} zkProofs - Object with proof packages keyed by requirement type
 * @returns {Promise<Object>} Backend response with offer_id
 */
async function submitOfferToBackend(campaign, price, zkProofs) {
  try {
    console.log('[Offer Submission] Submitting offer to backend...');
    console.log(`[Offer Submission] Campaign: ${campaign.id}, Price: $${price.toFixed(4)}`);
    
    // Get user credentials from storage
    // User ID is the wallet address (wallet-based authentication)
    const result = await chrome.storage.local.get(['payattn_walletAddress']);
    const walletAddress = result.payattn_walletAddress;
    const userId = walletAddress; // User ID = wallet address
    
    if (!walletAddress) {
      throw new Error('User not authenticated - no wallet address found');
    }
    
    // Convert price from USD to lamports
    // TODO: Fetch real-time SOL price from oracle (Pyth, Chainlink, etc.)
    const solPrice = 160; // USD per SOL (hardcoded for demo)
    const lamports = Math.floor((price / solPrice) * 1e9);
    
    console.log(`[Offer Submission] Amount: ${lamports} lamports (${(lamports / 1e9).toFixed(6)} SOL)`);
    
    // Format ZK proofs for backend
    // Backend expects: { age: {...}, interests: {...}, location: {...}, income: {...} }
    const formattedProofs = {};
    if (zkProofs && Object.keys(zkProofs).length > 0) {
      Object.entries(zkProofs).forEach(([key, proofPackage]) => {
        formattedProofs[key] = {
          proof: proofPackage.proof,
          publicSignals: proofPackage.publicSignals,
          circuitName: proofPackage.circuitName
        };
      });
      console.log(`[Offer Submission] Including ${Object.keys(formattedProofs).length} ZK proofs`);
    } else {
      console.warn('[Offer Submission] No ZK proofs to submit (this is unusual)');
    }
    
    // Prepare request body
    const requestBody = {
      ad_creative_id: campaign.id, // UUID from ad_creative table
      amount_lamports: lamports,
      zk_proofs: formattedProofs
    };
    
    // Submit to backend
    const response = await fetch('http://localhost:3000/api/user/offer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Backend returned ${response.status}: ${errorData.error || 'Unknown error'}`);
    }
    
    const data = await response.json();
    
    console.log(`✅ [Offer Submission] Success! Offer ID: ${data.offer_id}`);
    console.log(`[Offer Submission] Status: ${data.status}`);
    console.log(`[Offer Submission] Next: Peggy will evaluate and potentially fund escrow`);
    
    return data;
    
  } catch (error) {
    console.error('❌ [Offer Submission] Failed:', error.message);
    throw error;
  }
}

/**
 * Generate ZK-SNARK proofs for matched requirements
 * @param {Object} offer - The offer object with matchedRequirements
 * @param {Object} campaign - The campaign being assessed
 * @returns {Promise<Object>} Object with proof packages keyed by requirement type
 */
async function generateProofsForOffer(offer, campaign) {
  const proofs = {};
  
  if (!offer.matchedRequirements || offer.matchedRequirements.length === 0) {
    console.log('[ZK-Proof] No matched requirements to prove');
    return proofs;
  }
  
  // Get user profile for private inputs
  const storageResult = await chrome.storage.local.get(['payattn_walletAddress', 'payattn_keyHash', 'payattn_authToken']);
  const walletAddress = storageResult.payattn_walletAddress;
  
  if (!walletAddress) {
    console.warn('[ZK-Proof] No wallet address found - user not authenticated');
    return proofs;
  }
  
  // Load encrypted profile
  const profileResult = await chrome.storage.local.get(`payattn_profile_${walletAddress}`);
  const encryptedProfile = profileResult[`payattn_profile_${walletAddress}`];
  
  if (!encryptedProfile) {
    console.warn('[ZK-Proof] No profile data available - cannot generate proofs');
    return proofs;
  }
  
  // Decrypt profile
  const keyHash = storageResult.payattn_keyHash;
  const authToken = storageResult.payattn_authToken;
  
  if (!keyHash || !authToken) {
    console.warn('[ZK-Proof] Missing keyHash or authToken - cannot decrypt profile');
    return proofs;
  }
  
  try {
    // Get crypto functions from global scope
    const crypto = getCryptoFunctions();
    
    // Fetch key material from KDS
    const keyMaterial = await crypto.fetchKeyMaterial(keyHash, walletAddress, authToken);
    
    // Extract the encryptedData string from the profile object
    const encryptedDataString = encryptedProfile.encryptedData;
    if (!encryptedDataString) {
      throw new Error('No encryptedData property found in profile');
    }
    
    // Decrypt profile data
    const decryptedJson = await crypto.decryptDataWithMaterial(
      encryptedDataString,
      keyMaterial,
      walletAddress
    );
    
    const profileData = JSON.parse(decryptedJson);
    
    // Process each matched requirement
    for (const requirement of offer.matchedRequirements) {
      try {
        const reqType = requirement.requirement;
        const advertiserCriteria = requirement.advertiserCriteria;
        
        console.log(`[ZK-Proof] Generating proof for: ${reqType}`);
        
        // Generate proof based on requirement type
        if (reqType === 'age') {
          const proof = await generateAgeProof(profileData, advertiserCriteria);
          if (proof) proofs.age = proof;
        } else if (reqType === 'location') {
          const proof = await generateLocationProof(profileData, advertiserCriteria);
          if (proof) proofs.location = proof;
        } else if (reqType === 'income') {
          const proof = await generateIncomeProof(profileData, advertiserCriteria);
          if (proof) proofs.income = proof;
        } else if (reqType === 'interests') {
          const proof = await generateInterestsProof(profileData, advertiserCriteria);
          if (proof) proofs.interests = proof;
        } else {
          console.warn(`[ZK-Proof] Unknown requirement type: ${reqType}`);
        }
      } catch (proofError) {
        console.error(`[ZK-Proof] Failed to generate proof for ${requirement.requirement}:`, proofError);
      }
    }
    
    console.log(`[ZK-Proof] Generated ${Object.keys(proofs).length} proofs`);
    return proofs;
    
  } catch (error) {
    console.error('[ZK-Proof] Failed to generate proofs:', error);
    return proofs;
  }
}

// ============================================================================
// ZK Proof Generation Functions (Placeholders - need actual circuit integration)
// ============================================================================

async function generateAgeProof(profileData, criteria) {
  // TODO: Implement actual ZK-SNARK proof generation with range_check circuit
  console.log('[ZK-Proof] Age proof generation not yet implemented');
  return null;
}

async function generateLocationProof(profileData, criteria) {
  // TODO: Implement actual ZK-SNARK proof generation with set_membership circuit
  console.log('[ZK-Proof] Location proof generation not yet implemented');
  return null;
}

async function generateIncomeProof(profileData, criteria) {
  // TODO: Implement actual ZK-SNARK proof generation with range_check circuit
  console.log('[ZK-Proof] Income proof generation not yet implemented');
  return null;
}

async function generateInterestsProof(profileData, criteria) {
  // TODO: Implement actual ZK-SNARK proof generation with set_membership circuit
  console.log('[ZK-Proof] Interests proof generation not yet implemented');
  return null;
}

// ============================================================================
// Crypto Utilities Access
// ============================================================================
// Note: These functions are already defined in:
// - crypto.js (loaded in ad-queue.html)
// - background.js (service worker)
// We access them from the global scope rather than redefining them

/**
 * Get the appropriate crypto functions from global scope
 * Works in both browser (window) and service worker (self/global) contexts
 */
function getCryptoFunctions() {
  // Try to get from window (browser context) or global scope (service worker)
  const scope = typeof window !== 'undefined' ? window : self;
  
  return {
    fetchKeyMaterial: scope.fetchKeyMaterial || fetchKeyMaterial,
    decryptDataWithMaterial: scope.decryptDataWithMaterial || decryptDataWithMaterial,
    deriveKeyFromMaterial: scope.deriveKeyFromMaterial || deriveKeyFromMaterial,
    base64ToArrayBuffer: scope.base64ToArrayBuffer || base64ToArrayBuffer
  };
}

// ============================================================================
// Exports
// ============================================================================

// Export for browser window (ad-queue.js)
if (typeof window !== 'undefined') {
  window.MaxAssessor = {
    assessAds,
    assessSingleAd,
    generateSessionId
  };
}

// Export for service worker (background.js) via self
if (typeof self !== 'undefined' && typeof window === 'undefined') {
  self.MaxAssessor = {
    assessAds,
    assessSingleAd,
    generateSessionId
  };
}
