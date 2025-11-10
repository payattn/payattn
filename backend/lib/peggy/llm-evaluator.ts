/**
 * Peggy LLM Evaluator
 * Evaluates user offers using Venice AI LLM reasoning
 * Moved from /advertiser-agent/lib/llm.js
 */

const VENICE_API_ENDPOINT = 'https://api.venice.ai/api/v1/chat/completions';

export interface EvaluationResult {
  decision: 'accept' | 'reject';
  reasoning: string;
  confidence: number;
}

export interface AdCreative {
  ad_creative_id: string;
  advertiser_id: string;
  headline?: string;
  description?: string;
  target_age_min?: number;
  target_age_max?: number;
  target_locations?: string[];
  target_interests?: string[];
  budget_per_impression_lamports: number;
  campaign_name?: string;
  campaign_goal?: string;
}

export interface Offer {
  offer_id: string;
  user_id: string;
  ad_id: string;
  amount_lamports: number;
  user_pubkey: string;
  status: string;
  zk_proofs?: any;
}

export class LLMEvaluator {
  private apiKey: string;
  
  constructor() {
    this.apiKey = process.env.VENICE_API_KEY || '';
    
    if (!this.apiKey || this.apiKey === 'your_venice_api_key_here') {
      console.warn('⚠️  WARNING: Venice API key not configured');
      console.warn('   LLM evaluation will use fallback rules only');
    }
  }
  
  /**
   * Evaluate an offer using LLM reasoning
   */
  async evaluateOffer(
    offer: Offer, 
    adCreative: AdCreative,
    proofValidation?: { isValid: boolean; summary: string }
  ): Promise<EvaluationResult> {
    const prompt = this.buildEvaluationPrompt(offer, adCreative, proofValidation);
    
    try {
      const response = await this.callVeniceAI(prompt);
      return response;
    } catch (error) {
      console.error('LLM evaluation failed:', error instanceof Error ? error.message : 'Unknown error');
      // Fallback to simple rules if LLM fails
      return this.fallbackEvaluation(offer, adCreative);
    }
  }
  
  /**
   * Build evaluation prompt for LLM
   */
  private buildEvaluationPrompt(
    offer: Offer, 
    adCreative: AdCreative,
    proofValidation?: { isValid: boolean; summary: string }
  ): string {
    const priceSOL = (offer.amount_lamports / 1e9).toFixed(4);
    const priceUSD = priceSOL; // Simplified: 1 SOL = $1
    const maxCPM = (adCreative.budget_per_impression_lamports / 1e9).toFixed(4);
    
    const campaignName = adCreative.campaign_name || adCreative.headline || 'Untitled Campaign';
    const campaignGoal = adCreative.campaign_goal || 'Drive awareness and engagement';
    
    // Build targeting criteria string
    const targeting: string[] = [];
    if (adCreative.target_age_min && adCreative.target_age_max) {
      targeting.push(`Age: ${adCreative.target_age_min}-${adCreative.target_age_max}`);
    }
    if (adCreative.target_locations && adCreative.target_locations.length > 0) {
      targeting.push(`Locations: ${adCreative.target_locations.join(', ')}`);
    }
    if (adCreative.target_interests && adCreative.target_interests.length > 0) {
      targeting.push(`Interests: ${adCreative.target_interests.join(', ')}`);
    }
    
    const targetingStr = targeting.length > 0 ? targeting.join(' | ') : 'No specific targeting';
    
    // Add ZK proof validation context
    const proofContext = proofValidation 
      ? `\nZK PROOF VALIDATION: ${proofValidation.summary}`
      : '\nZK PROOF VALIDATION: Not available';
    
    return `You are Peggy, an AI agent working for an advertiser to evaluate user offers.

Your goal: Maximize ROI by only accepting offers that match campaign criteria and provide good value.

CAMPAIGN CONTEXT:
Name: ${campaignName}
Target Audience: ${targetingStr}
Max CPM: $${maxCPM} per impression
Campaign Goal: ${campaignGoal}

OFFER DETAILS:
Offer ID: ${offer.offer_id}
User ID: ${offer.user_id}
Requested Price: ${priceSOL} SOL ($${priceUSD})
User Wallet: ${offer.user_pubkey}
${proofContext}

EVALUATION CRITERIA:
1. Price Fairness: Is the requested price reasonable?
   - Max acceptable: $${maxCPM}
   - This offer: $${priceUSD}
   - Over budget? ${parseFloat(priceUSD) > parseFloat(maxCPM) ? 'YES - REJECT' : 'NO - OK'}

2. Targeting Match: Does user meet targeting criteria?
   ${proofValidation ? (proofValidation.isValid ? '- ZK proofs VALID - User meets requirements ✅' : '- ZK proofs INVALID - User does NOT meet requirements ❌') : '- No proof validation available'}

3. Strategic Value: Does this help campaign goals?
   - Campaign goal: ${campaignGoal}

DECISION GUIDELINES:
- ACCEPT if: Price <= Max CPM AND User meets targeting AND strategically valuable
- REJECT if: Overpriced OR Poor targeting match OR Poor fit

OUTPUT FORMAT (JSON only, no other text):
{
  "decision": "accept",
  "reasoning": "Price is fair at $${priceUSD} vs max $${maxCPM}. User meets targeting criteria (validated via ZK proofs). Good strategic fit for ${campaignGoal}.",
  "confidence": 0.85
}

OR

{
  "decision": "reject",
  "reasoning": "Price of $${priceUSD} exceeds max CPM of $${maxCPM}. Not worth the premium.",
  "confidence": 0.92
}

Remember: You're spending real money. Be selective but fair. Respond with ONLY the JSON object.`;
  }
  
  /**
   * Call Venice AI API
   */
  private async callVeniceAI(prompt: string): Promise<EvaluationResult> {
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
    
    return result as EvaluationResult;
  }
  
  /**
   * Fallback evaluation if LLM fails (simple rules)
   */
  private fallbackEvaluation(offer: Offer, adCreative: AdCreative): EvaluationResult {
    const priceSOL = offer.amount_lamports / 1e9;
    const maxPrice = adCreative.budget_per_impression_lamports / 1e9;
    
    if (priceSOL > maxPrice) {
      return {
        decision: 'reject',
        reasoning: `Price ${priceSOL.toFixed(4)} SOL exceeds max CPM ${maxPrice.toFixed(4)} SOL (fallback rule)`,
        confidence: 0.95
      };
    }
    
    if (priceSOL <= maxPrice * 0.8) {
      return {
        decision: 'accept',
        reasoning: `Good price ${priceSOL.toFixed(4)} SOL vs max ${maxPrice.toFixed(4)} SOL (fallback rule)`,
        confidence: 0.85
      };
    }
    
    return {
      decision: 'accept',
      reasoning: `Acceptable price ${priceSOL.toFixed(4)} SOL vs max ${maxPrice.toFixed(4)} SOL (fallback rule)`,
      confidence: 0.70
    };
  }
}
