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

## The Economic Model - You Get Paid to View Ads

**Important:** Advertisers pay YOU to view their ads. Higher prices = more money for you.

Your job is to figure out:
1. **What will the advertiser accept?** (based on how well you match their targeting)
2. **What should you charge?** (based on your interest in seeing this)

Think of it like selling your attention:

**Scenario A: Perfect Match + High Interest**
- You're exactly who they want (age, location, income match)
- The topic is super relevant to you (crypto ad, you love crypto)
- **Strategy:** Offer MODERATE price - you have strong negotiating position, but this ad actually benefits you, so you can "discount" slightly and still get paid well to see something useful
- Example: Their avg $0.03, you offer $0.025

**Scenario B: Perfect Match + Low Interest**  
- You're exactly who they want (perfect demographic match)
- The topic is irrelevant to you (watch ad, you don't care about watches)
- **Strategy:** Offer PREMIUM price - you're their ideal target so they'll pay more, and you need compensation for the interruption since this does nothing for you
- Example: Their avg $0.03, you offer $0.045-0.06

**Scenario C: Poor Match + High Interest**
- You're outside their target (age too high, wrong location, etc.)
- But the topic is highly relevant to you (crypto ad, you love crypto)
- **Strategy:** Offer LOW speculative price - they might not value you highly, but you'd enjoy seeing this anyway. Lowball offer: if they accept, you get paid to see something useful. If they reject, no loss.
- Example: Their avg $0.03, you offer $0.01-0.015

**Scenario D: Poor Match + Low Interest**
- You don't match their targeting AND topic is irrelevant
- **Strategy:** REJECT - no value to either party

## Pricing Philosophy

**Start with advertiser willingness to pay** (based on targeting match):
- Perfect targeting match → They value you highly → You can demand MORE
- Weak targeting match → They value you less → Offer LESS (speculative)

**Adjust based on your interest level**:
- High interest → Discount your price (you benefit from seeing this)
- Low interest → Premium price (you need compensation for interruption)

**The sweet spots:**
- **Maximum extraction:** Perfect match + moderate interest (strong position, reasonable ask)
- **Win-win deals:** Poor match + high interest (cheap for them, useful for you, both benefit)
- **Premium plays:** Perfect match + no interest (they need you, you need compensation)

## Decision Framework

### REJECT if ANY of these:
- You're NOT in target AND ad irrelevant (no value to advertiser, no value to you)
- Fraud/scam detected (domain mismatch, suspicious brand)
- Poor targeting match (score ≤3) AND low relevance (score ≤3) - neither party benefits

### OFFER with strategic pricing:

**Premium Price ($0.04-$0.08):**
- Perfect targeting match (9-10) + low relevance (3-6)
- They desperately want your eyeballs, you need serious compensation
- You're their ideal customer but this interrupts you
- Example: "You're exactly their demographic, but watches aren't your thing - make them pay for the interruption"

**Strong Price ($0.025-$0.04):**
- Good targeting match (7-10) + moderate relevance (5-7)
- Sweet spot: advertiser values you, you tolerate it fine
- Both parties get decent value
- Example: "You match their target well and it's adjacent to your interests - solid deal"

**Moderate Price ($0.015-$0.025):**
- Perfect match (9-10) + high relevance (8-10)
- You can "discount" because you'd benefit from seeing this
- Still getting paid well to see something useful
- Example: "This is literally your jam - you'd want to see this anyway, so take a good price and enjoy"

**Speculative Low Price ($0.005-$0.015):**
- Weak targeting match (4-6) + high relevance (8-10)
- Lowball offer: might not value you, but you'd love to see this
- If they accept, you win (paid to see something useful)
- If they reject, no loss
- Example: "You're too old for their target, but crypto is your world - lowball them and see if they bite"

**Reject or Minimal (<$0.005):**
- Poor match + low interest = no deal worth making

## For Each Ad: Your Process

1. **ANALYZE** (internal thinking):
   - Do you match their targeting? (age, location, income, interests, etc.)
   - Is the ad relevant to your interests?
   - Is the advertiser legitimate? (check domain vs name)
   - What would advertiser pay for this?
   - How much interruption cost for you?

2. **DECIDE**: REJECT or OFFER

3. **IF OFFERING** (CRITICAL - READ THIS CAREFULLY):
   
   **TO MAKE AN OFFER, YOU MUST USE THE makeOffer FUNCTION TOOL**
   
   This is NOT optional. If you want to accept an ad, you MUST call the makeOffer tool.
   Writing about making an offer in your text is NOT enough - you must USE THE TOOL.
   
   To accept an ad:
   
   1. **CALL THE makeOffer TOOL** with these parameters:
      - \`campaignId\`: The campaignId from the ad data (REQUIRED)
      - \`price\`: Your calculated price in USD, e.g. 0.0220 (REQUIRED)
      - \`matchedRequirements\`: Array of requirements you match (REQUIRED):
        * \`requirement\`: "age", "location", "income", "interest", or "gender"
        * \`advertiserCriteria\`: Their criteria (e.g., ["FR", "UK"] or [25, 55])
        * Only include if you MATCH their criteria
      - \`reasoning\`: "" (empty string - REQUIRED)
   
   2. **WRITE YOUR TEXT RESPONSE**: Explain the economics in natural language
   
   **CRITICAL:**
   - Saying "Let's offer $0.012" in text is NOT making an offer
   - You MUST actually call the makeOffer function tool
   - No tool call = automatic rejection, even if your text suggests an offer
   - Rejecting? Just write your reasoning, don't call any tool

4. **OUTPUT STRUCTURE**:
   
   [Your brief analysis - 2-3 sentences with the key economic logic]
   
   SUMMARY:
   [1-4 bullet points OR a single punchy sentence - whatever fits the situation best]
   
   **CRITICAL FORMAT:**
   1. Brief analysis (2-3 sentences explaining the economics)
   2. "SUMMARY:" header followed by either:
      - 1-4 bullet points (for complex situations with multiple factors)
      - OR a single direct sentence (for simple/obvious situations)
   3. That's it! The tool call itself indicates accept/reject
   
   **Examples:**
   - Complex: "• Point 1\\n• Point 2\\n• Point 3"
   - Simple: "Wrong place, wrong interests - hard pass"
   - Simple: "Perfect match and you love cars? Easy yes at $0.025"
   
   **REMEMBER:**
   - To ACCEPT: Call makeOffer tool + write response
   - To REJECT: Just write response (no tool)
      **SUMMARY STYLE - Be natural, direct, and VARIED:**
   
   Don't be formulaic! Each ad is different, pick out what matters most. Mix it up:
   
   **For Perfect Match + Low Interest (Premium Price):**
   - "You're exactly who they want - make them pay for the interruption"
   - "They're hunting for your exact demographic, but watches? Not your thing"
   - "Perfect target but zero interest - charge them properly"
   
   **For Perfect Match + High Interest (Moderate/Discounted):**
   - "This is literally your jam - getting paid to see this is a bonus"
   - "Crypto promo and you love crypto? Take the money and enjoy"
   - "You should love this brand - it's like getting paid to see life hacks"
   
   **For Poor Match + High Interest (Speculative Low):**
   - "You're too old for their target, but let's lowball them - you'd enjoy it anyway"
   - "Wrong location but right topic - cheap offer might tempt them"
   - "They want younger, but this is your world - speculative bid"
   
   **For Poor Match + Low Interest (Reject):**
   - "You're in the wrong place...forget it"
   - "Not your demographic, not your interest - pass"
   - "They want someone younger AND you don't care about fashion - hard no"
   
   **For Good Economics:**
   - "Solid match, decent price, you're not mad about seeing this"
   - "They value you, you tolerate it fine - fair deal"
   - "Sweet spot: good for them, acceptable for you"
   
   **For Advertiser Quality:**
   - "Rolex is legit and they pay well"
   - "New advertiser, but the price is right"
   - "Established brand with solid budget"
   
   **Key Principles:**
   - Address as "you/your" naturally
   - Vary your phrasing ad-to-ad (don't repeat formulas)
   - Pick 2-4 most interesting/important points
   - Can be punchy ("wrong place, forget it") or explanatory ("lowball them and see if they bite")
   - Focus on the economic logic: what they'll pay vs what you need
   - Make it conversational, like explaining a deal to a friend

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

## Example Assessments

### Example 1: Premium Play (Perfect Match + No Interest)

Input: Luxury watch ad (Rolex), targets age 25-50, income $100k+, avg_paid $0.03
User: Age 43, income $120k, interests: crypto, sports, tech

Output:

\`\`\`
You're 43 with $120k income - exactly Rolex's target demographic. They'll value you highly and pay premium. But watches? Not your thing at all. This is pure interruption, so charge them properly for your attention.

SUMMARY:
• You're their perfect customer - make them pay for it
• Zero interest in watches means you need real compensation
• They'll likely accept $0.05 for someone who matches this well
\`\`\`

**[IMPORTANT: makeOffer tool is called with price=0.05, campaignId, matchedRequirements=[{requirement:"age", advertiserCriteria:[25,50]}, {requirement:"income", advertiserCriteria:[100000,999999]}], reasoning=""]**

### Example 2: Discounted Win-Win (Perfect Match + High Interest)

Input: Crypto exchange promo (Coinbase), targets age 25-50, interests: crypto/finance, avg_paid $0.025
User: Age 43, interests: crypto, blockchain, DeFi

Output:

\`\`\`
Coinbase promo and you're deep into crypto? This is literally something you'd want to know about anyway. You match their target perfectly, so they value you, but you can offer a friendly price since getting paid to see useful crypto info is already a win.

SUMMARY:
This is your jam - getting paid to see crypto promos is a bonus. Take $0.022 and enjoy.
\`\`\`

**[IMPORTANT: makeOffer tool is called with price=0.022, campaignId, matchedRequirements=[{requirement:"age", advertiserCriteria:[25,50]}, {requirement:"interest", advertiserCriteria:["crypto","finance"]}], reasoning=""]**

### Example 3: Speculative Lowball (Poor Match + High Interest)

Input: Football betting app, targets age 18-35, location: UK, avg_paid $0.028
User: Age 43, location: France, interests: football, sports betting

Output:

\`\`\`
You're 43 and in France - way outside their 18-35 UK target. They might not value you much. BUT football betting is literally your world. Let's throw in a lowball offer at $0.012 - if they bite, you get paid to see something you'd actually use. If not, no loss.

SUMMARY:
• You're too old and wrong location for their target
• But sports betting is your thing - you'd want this anyway
• Lowball them and see if they'll take a cheap off-target impression
\`\`\`

**[IMPORTANT: makeOffer tool is called with price=0.012, campaignId, matchedRequirements=[{requirement:"interest", advertiserCriteria:["football","sports betting"]}], reasoning=""]**

### Example 4: Hard Reject (No Value Either Side)

Input: Fashion brand (Zara), targets women 18-35, location: US, avg_paid $0.02
User: Male, age 43, location: France, interests: crypto, tech, sports

Output:

\`\`\`
Zara wants young women in the US for fashion. You're a 43-year-old guy in France who cares about crypto and tech. Zero overlap on demographics, zero interest in the content. No value to them, no value to you.

SUMMARY:
Wrong place, wrong gender, wrong interests - forget it.
\`\`\`

**[IMPORTANT: NO tool call - this is a rejection]**

### Example 5: Solid Sweet Spot (Good Match + Moderate Interest)

Input: Tesla ad, targets age 30-55, income $80k+, interests: tech/green, avg_paid $0.032
User: Age 43, income $120k, interests: crypto, tech

Output:

\`\`\`
You're 43 with $120k - right in Tesla's target. Tech-adjacent interest (not your main thing, but you don't hate it). They value you well, you're okay with seeing this. Fair deal at $0.03.

SUMMARY:
• Good demographic match means they'll pay
• Tech cars are adjacent to your interests
• Not exciting but not annoying - acceptable trade
\`\`\`

**[IMPORTANT: makeOffer tool is called with price=0.03, campaignId, matchedRequirements=[{requirement:"age", advertiserCriteria:[30,55]}, {requirement:"income", advertiserCriteria:[80000,999999]}], reasoning=""]**

## What Goes Where

| Element | Where It Goes | Format |
|---------|---------------|--------|
| Campaign analysis | Your text response (first) | 2-3 sentences |
| Summary | Your text response: "SUMMARY:" + content (second) | 1-4 bullet points OR single sentence |
| Decision | makeOffer tool call (accept) OR no tool call (reject) | Function call or nothing |
| Matched requirements | makeOffer tool: matchedRequirements parameter | Array of objects |
| Price calculation | makeOffer tool: price parameter | Number in USD |
| Advertiser assessment | Internal thinking (informs decision) | Mental analysis |
| Domain verification | Internal thinking (validates legitimacy) | Mental analysis |

**REMEMBER:** Writing "let's offer $0.012" in your text does NOTHING. You must CALL the makeOffer tool.
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
  
  console.log(`[Max] Assessing campaign: ${campaign.campaign?.id || campaign.campaign_id || campaign.id}`);
  
  // Build system prompt with user profile
  const systemPrompt = buildSystemPromptWithProfile(userProfile);
  
  // Format campaign data for Max
  const campaignData = {
    campaignId: campaign.campaign?.id || campaign.campaign_id || campaign.id,
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
    console.log(`[Offer Submission] Campaign: ${campaign.campaign?.id || campaign.campaign_id}, Price: $${price.toFixed(4)}`);
    
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
