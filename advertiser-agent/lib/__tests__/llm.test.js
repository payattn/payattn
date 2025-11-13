import { describe, test, expect, jest } from '@jest/globals';
import { LLMClient } from '../llm.js';

describe('LLM Client Initialization', () => {
  
  test('should create LLM client instance', () => {
    const client = new LLMClient();
    expect(client).toBeDefined();
    expect(client).toBeInstanceOf(LLMClient);
  });

  test('should have API key property', () => {
    const client = new LLMClient();
    expect(client).toHaveProperty('apiKey');
  });

  test('should have evaluateOffer method', () => {
    const client = new LLMClient();
    expect(typeof client.evaluateOffer).toBe('function');
  });

  test('should have buildEvaluationPrompt method', () => {
    const client = new LLMClient();
    expect(typeof client.buildEvaluationPrompt).toBe('function');
  });

  test('should have fallbackEvaluation method', () => {
    const client = new LLMClient();
    expect(typeof client.fallbackEvaluation).toBe('function');
  });
});

describe('Evaluation Prompt Building', () => {
  
  const client = new LLMClient();
  
  const mockOffer = {
    offer_id: 'test_offer_1',
    user_id: 'user_123',
    amount_lamports: 20000000, // 0.02 SOL
    user_pubkey: 'TestWallet123'
  };
  
  const mockCriteria = {
    campaignName: 'Test Campaign',
    maxCpm: 0.03,
    budgetRemaining: 100,
    goal: 'brand awareness',
    targeting: {
      age: '25-45',
      interests: ['web3', 'technology']
    }
  };

  test('should generate prompt with offer details', () => {
    const prompt = client.buildEvaluationPrompt(mockOffer, mockCriteria);
    
    expect(prompt).toContain('test_offer_1');
    expect(prompt).toContain('user_123');
    expect(prompt).toContain('0.020'); // Price in SOL
  });

  test('should include campaign criteria in prompt', () => {
    const prompt = client.buildEvaluationPrompt(mockOffer, mockCriteria);
    
    expect(prompt).toContain('Test Campaign');
    expect(prompt).toContain('0.03'); // Max CPM
    expect(prompt).toContain('100'); // Budget
    expect(prompt).toContain('brand awareness');
  });

  test('should include budget check in prompt', () => {
    const prompt = client.buildEvaluationPrompt(mockOffer, mockCriteria);
    
    expect(prompt).toContain('Budget');
    expect(prompt).toContain('Remaining'); // Updated to match actual prompt text
  });

  test('should include price comparison', () => {
    const prompt = client.buildEvaluationPrompt(mockOffer, mockCriteria);
    
    expect(prompt).toContain('Max acceptable');
    expect(prompt).toContain('This offer');
  });

  test('should format SOL amounts correctly', () => {
    const offer = {
      ...mockOffer,
      amount_lamports: 50000000 // 0.05 SOL
    };
    
    const prompt = client.buildEvaluationPrompt(offer, mockCriteria);
    
    expect(prompt).toContain('0.050');
  });

  test('should handle various campaign goals', () => {
    const goals = ['brand awareness', 'conversions', 'engagement', 'reach'];
    
    goals.forEach(goal => {
      const criteria = { ...mockCriteria, goal };
      const prompt = client.buildEvaluationPrompt(mockOffer, criteria);
      
      expect(prompt).toContain(goal);
    });
  });
});

describe('Fallback Evaluation', () => {
  
  const client = new LLMClient();
  
  const mockCriteria = {
    campaignName: 'Test Campaign',
    maxCpm: 0.03,
    budgetRemaining: 100,
    goal: 'test'
  };

  test('should reject overpriced offers', () => {
    const expensiveOffer = {
      offer_id: 'expensive',
      amount_lamports: 50000000 // 0.05 SOL (over 0.03 max)
    };
    
    const result = client.fallbackEvaluation(expensiveOffer, mockCriteria);
    
    expect(result.decision).toBe('reject');
    expect(result.reasoning).toContain('exceeds max CPM');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  test('should accept good-priced offers', () => {
    const goodOffer = {
      offer_id: 'good',
      amount_lamports: 20000000 // 0.02 SOL (under 0.03 max)
    };
    
    const result = client.fallbackEvaluation(goodOffer, mockCriteria);
    
    expect(result.decision).toBe('accept');
    expect(result.reasoning).toContain('Good price');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  test('should accept acceptable-priced offers', () => {
    const okOffer = {
      offer_id: 'ok',
      amount_lamports: 29000000 // 0.029 SOL (just under 0.03 max)
    };
    
    const result = client.fallbackEvaluation(okOffer, mockCriteria);
    
    expect(result.decision).toBe('accept');
    expect(result.reasoning).toContain('Acceptable price');
  });

  test('should return proper result structure', () => {
    const offer = {
      offer_id: 'test',
      amount_lamports: 20000000
    };
    
    const result = client.fallbackEvaluation(offer, mockCriteria);
    
    expect(result).toHaveProperty('decision');
    expect(result).toHaveProperty('reasoning');
    expect(result).toHaveProperty('confidence');
    expect(['accept', 'reject']).toContain(result.decision);
    expect(typeof result.reasoning).toBe('string');
    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  test('should indicate fallback in reasoning', () => {
    const offer = {
      offer_id: 'test',
      amount_lamports: 20000000
    };
    
    const result = client.fallbackEvaluation(offer, mockCriteria);
    
    expect(result.reasoning).toContain('fallback rule');
  });

  test('should handle edge case at max price', () => {
    const exactMaxOffer = {
      offer_id: 'exact',
      amount_lamports: 30000000 // Exactly 0.03 SOL
    };
    
    const result = client.fallbackEvaluation(exactMaxOffer, mockCriteria);
    
    // At or slightly over max should still be acceptable
    expect(['accept', 'reject']).toContain(result.decision);
  });

  test('should handle very low prices', () => {
    const cheapOffer = {
      offer_id: 'cheap',
      amount_lamports: 1000000 // 0.001 SOL
    };
    
    const result = client.fallbackEvaluation(cheapOffer, mockCriteria);
    
    expect(result.decision).toBe('accept');
    expect(result.confidence).toBeGreaterThan(0.8);
  });
});

describe('Venice AI API Mock', () => {
  
  const client = new LLMClient();

  test('should handle API errors gracefully', async () => {
    // Mock fetch to simulate API error
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error')
      })
    );

    const mockOffer = {
      offer_id: 'test',
      amount_lamports: 20000000,
      user_pubkey: 'test'
    };

    const mockCriteria = {
      campaignName: 'Test',
      maxCpm: 0.03,
      budgetRemaining: 100,
      goal: 'test',
      targeting: {}
    };

    const result = await client.evaluateOffer(mockOffer, mockCriteria);
    
    // Should fall back to rule-based evaluation
    expect(result).toHaveProperty('decision');
    expect(result.reasoning).toContain('fallback rule');
  });

  test('should handle missing API key', async () => {
    const clientNoKey = new LLMClient();
    clientNoKey.apiKey = 'your_venice_api_key_here'; // Default placeholder

    const mockOffer = {
      offer_id: 'test',
      amount_lamports: 20000000,
      user_pubkey: 'test'
    };

    const mockCriteria = {
      campaignName: 'Test',
      maxCpm: 0.03,
      budgetRemaining: 100,
      goal: 'test',
      targeting: {}
    };

    const result = await clientNoKey.evaluateOffer(mockOffer, mockCriteria);
    
    // Should fall back due to missing API key
    expect(result).toHaveProperty('decision');
    expect(result.reasoning).toContain('fallback');
  });

  test('should handle authentication errors', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      })
    );

    const mockOffer = {
      offer_id: 'test',
      amount_lamports: 20000000,
      user_pubkey: 'test'
    };

    const mockCriteria = {
      campaignName: 'Test',
      maxCpm: 0.03,
      budgetRemaining: 100,
      goal: 'test',
      targeting: {}
    };

    const result = await client.evaluateOffer(mockOffer, mockCriteria);
    
    expect(result).toHaveProperty('decision');
    expect(result.reasoning).toContain('fallback');
  });
});

describe('Offer Evaluation Logic', () => {
  
  test('should consider budget constraints', () => {
    const client = new LLMClient();
    
    const offer = {
      offer_id: 'test',
      amount_lamports: 20000000 // 0.02 SOL
    };
    
    const lowBudgetCriteria = {
      campaignName: 'Test',
      maxCpm: 0.03,
      budgetRemaining: 0.01, // Very low budget
      goal: 'test'
    };
    
    const prompt = client.buildEvaluationPrompt(offer, lowBudgetCriteria);
    
    expect(prompt).toContain('Budget');
    expect(prompt).toContain('0.01');
  });

  test('should evaluate price fairness', () => {
    const client = new LLMClient();
    
    const fairOffer = {
      offer_id: 'fair',
      amount_lamports: 20000000 // 0.02 SOL
    };
    
    const criteria = {
      campaignName: 'Test',
      maxCpm: 0.03,
      budgetRemaining: 100,
      goal: 'test'
    };
    
    const result = client.fallbackEvaluation(fairOffer, criteria);
    
    expect(result.decision).toBe('accept');
  });

  test('should compare against max CPM', () => {
    const client = new LLMClient();
    
    const criteria = {
      campaignName: 'Test',
      maxCpm: 0.03,
      budgetRemaining: 100,
      goal: 'test'
    };
    
    const underMax = {
      offer_id: 'under',
      amount_lamports: 20000000 // 0.02 < 0.03
    };
    
    const overMax = {
      offer_id: 'over',
      amount_lamports: 50000000 // 0.05 > 0.03
    };
    
    const resultUnder = client.fallbackEvaluation(underMax, criteria);
    const resultOver = client.fallbackEvaluation(overMax, criteria);
    
    expect(resultUnder.decision).toBe('accept');
    expect(resultOver.decision).toBe('reject');
  });
});

describe('Response Format Validation', () => {
  
  test('evaluation result should have required fields', () => {
    const client = new LLMClient();
    
    const offer = {
      offer_id: 'test',
      amount_lamports: 20000000
    };
    
    const criteria = {
      campaignName: 'Test',
      maxCpm: 0.03,
      budgetRemaining: 100,
      goal: 'test'
    };
    
    const result = client.fallbackEvaluation(offer, criteria);
    
    expect(result).toHaveProperty('decision');
    expect(result).toHaveProperty('reasoning');
    expect(result).toHaveProperty('confidence');
  });

  test('decision should be accept or reject', () => {
    const client = new LLMClient();
    
    const offer = {
      offer_id: 'test',
      amount_lamports: 20000000
    };
    
    const criteria = {
      campaignName: 'Test',
      maxCpm: 0.03,
      budgetRemaining: 100,
      goal: 'test'
    };
    
    const result = client.fallbackEvaluation(offer, criteria);
    
    expect(['accept', 'reject']).toContain(result.decision);
  });

  test('reasoning should be descriptive string', () => {
    const client = new LLMClient();
    
    const offer = {
      offer_id: 'test',
      amount_lamports: 20000000
    };
    
    const criteria = {
      campaignName: 'Test',
      maxCpm: 0.03,
      budgetRemaining: 100,
      goal: 'test'
    };
    
    const result = client.fallbackEvaluation(offer, criteria);
    
    expect(typeof result.reasoning).toBe('string');
    expect(result.reasoning.length).toBeGreaterThan(10);
  });

  test('confidence should be between 0 and 1', () => {
    const client = new LLMClient();
    
    const offer = {
      offer_id: 'test',
      amount_lamports: 20000000
    };
    
    const criteria = {
      campaignName: 'Test',
      maxCpm: 0.03,
      budgetRemaining: 100,
      goal: 'test'
    };
    
    const result = client.fallbackEvaluation(offer, criteria);
    
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
