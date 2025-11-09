import { config } from '../config.js';

const VENICE_API_ENDPOINT = 'https://api.venice.ai/api/v1/chat/completions';

export class LLMClient {
  constructor() {
    this.apiKey = config.veniceApiKey;
  }
  
  /**
   * Evaluate an offer using LLM reasoning
   * @param {Object} offer - Offer details from database
   * @param {Object} campaignCriteria - Campaign targeting and budget criteria
   * @returns {Promise<{decision: string, reasoning: string, confidence: number}>}
   */
  async evaluateOffer(offer, campaignCriteria) {
    const prompt = this.buildEvaluationPrompt(offer, campaignCriteria);
    
    try {
      const response = await this.callVeniceAI(prompt);
      return response;
    } catch (error) {
      console.error('LLM evaluation failed:', error.message);
      // Fallback to simple rules if LLM fails
      return this.fallbackEvaluation(offer, campaignCriteria);
    }
  }
  
  /**
   * Build evaluation prompt for LLM
   */
  buildEvaluationPrompt(offer, campaignCriteria) {
    const priceSOL = (offer.amount_lamports / 1e9).toFixed(3);
    const priceUSD = priceSOL; // Assuming 1 SOL = $1 for simplicity
    
    return `You are Peggy, an AI agent working for an advertiser to evaluate user offers.

Your goal: Maximize ROI by only accepting offers that match campaign criteria and provide good value.

CAMPAIGN CONTEXT:
Name: ${campaignCriteria.campaignName}
Target Audience: ${JSON.stringify(campaignCriteria.targeting)}
Budget Remaining: $${campaignCriteria.budgetRemaining}
Max CPM: $${campaignCriteria.maxCpm}
Campaign Goal: ${campaignCriteria.goal}

OFFER DETAILS:
Offer ID: ${offer.offer_id}
User ID: ${offer.user_id}
Requested Price: ${priceSOL} SOL ($${priceUSD})
User Wallet: ${offer.user_pubkey}

EVALUATION CRITERIA:
1. Price Fairness: Is the requested price reasonable?
   - Max acceptable: $${campaignCriteria.maxCpm}
   - This offer: $${priceUSD}
   - Over budget? ${parseFloat(priceUSD) > campaignCriteria.maxCpm ? 'YES - REJECT' : 'NO - OK'}

2. Budget: Do we have budget remaining?
   - Remaining: $${campaignCriteria.budgetRemaining}
   - Enough for this offer? ${campaignCriteria.budgetRemaining >= parseFloat(priceUSD) ? 'YES' : 'NO - REJECT'}

3. Strategic Value: Does this help campaign goals?
   - Campaign goal: ${campaignCriteria.goal}

DECISION GUIDELINES:
- ACCEPT if: Price <= Max CPM AND Budget available AND strategically valuable
- REJECT if: Overpriced OR Budget exhausted OR Poor fit

OUTPUT FORMAT (JSON only, no other text):
{
  "decision": "accept",
  "reasoning": "Price is fair at $${priceUSD} vs max $${campaignCriteria.maxCpm}. Budget allows it. Good strategic fit for ${campaignCriteria.goal}.",
  "confidence": 0.85
}

OR

{
  "decision": "reject",
  "reasoning": "Price of $${priceUSD} exceeds max CPM of $${campaignCriteria.maxCpm}. Not worth the premium.",
  "confidence": 0.92
}

Remember: You're spending real money. Be selective but fair. Respond with ONLY the JSON object.`;
  }
  
  /**
   * Call Venice AI API
   */
  async callVeniceAI(prompt) {
    if (!this.apiKey || this.apiKey === 'your_venice_api_key_here') {
      throw new Error('Venice API key not configured');
    }
    
    const response = await fetch(VENICE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'venice-uncensored',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 512,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Venice API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON from LLM response');
    }
    
    const result = JSON.parse(jsonMatch[0]);
    
    // Validate response format
    if (!result.decision || !result.reasoning || result.confidence === undefined) {
      throw new Error('Invalid LLM response format');
    }
    
    return result;
  }
  
  /**
   * Fallback evaluation if LLM fails (simple rules)
   */
  fallbackEvaluation(offer, campaignCriteria) {
    const priceSOL = offer.amount_lamports / 1e9;
    const maxPrice = campaignCriteria.maxCpm;
    
    if (priceSOL > maxPrice) {
      return {
        decision: 'reject',
        reasoning: `Price ${priceSOL.toFixed(3)} SOL exceeds max CPM $${maxPrice} (fallback rule)`,
        confidence: 0.95
      };
    }
    
    if (priceSOL <= maxPrice * 0.8) {
      return {
        decision: 'accept',
        reasoning: `Good price ${priceSOL.toFixed(3)} SOL vs max $${maxPrice} (fallback rule)`,
        confidence: 0.85
      };
    }
    
    return {
      decision: 'accept',
      reasoning: `Acceptable price ${priceSOL.toFixed(3)} SOL vs max $${maxPrice} (fallback rule)`,
      confidence: 0.70
    };
  }
}
