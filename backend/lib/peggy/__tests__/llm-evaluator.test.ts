/**
 * Tests for LLMEvaluator
 * Tests Venice AI LLM evaluation and fallback logic
 */

import { LLMEvaluator, EvaluationResult, AdCreative, Offer } from '../llm-evaluator';

// Mock fetch globally
global.fetch = jest.fn();

describe('LLMEvaluator', () => {
  let evaluator: LLMEvaluator;
  let mockOffer: Offer;
  let mockAdCreative: AdCreative;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set valid API key by default
    process.env.VENICE_API_KEY = 'test_api_key_123';
    
    evaluator = new LLMEvaluator();
    
    mockOffer = {
      offer_id: 'offer_123',
      user_id: 'user_456',
      ad_id: 'ad_789',
      amount_lamports: 1000000, // 0.001 SOL
      user_pubkey: '4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi',
      status: 'pending'
    };
    
    mockAdCreative = {
      ad_creative_id: 'ad_789',
      advertiser_id: 'adv_123',
      headline: 'Test Ad Campaign',
      description: 'Test description',
      target_age_min: 25,
      target_age_max: 45,
      target_locations: ['US', 'CA'],
      target_interests: ['technology', 'gaming'],
      budget_per_impression_lamports: 2000000, // 0.002 SOL max
      campaign_name: 'Tech Campaign',
      campaign_goal: 'Drive product awareness'
    };
  });

  describe('Constructor', () => {
    it('should initialize with API key from environment', () => {
      process.env.VENICE_API_KEY = 'my_test_key';
      const evalInstance = new LLMEvaluator();
      expect(evalInstance).toBeDefined();
    });

    it('should warn when API key is not configured', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      delete process.env.VENICE_API_KEY;
      
      new LLMEvaluator();
      
      expect(consoleWarnSpy).toHaveBeenCalledWith('[OK][OK]  WARNING: Venice API key not configured');
      expect(consoleWarnSpy).toHaveBeenCalledWith('   LLM evaluation will use fallback rules only');
      consoleWarnSpy.mockRestore();
    });

    it('should warn when API key is placeholder value', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      process.env.VENICE_API_KEY = 'your_venice_api_key_here';
      
      new LLMEvaluator();
      
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('evaluateOffer - LLM Success', () => {
    it('should evaluate offer using Venice AI and return accept decision', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              decision: 'accept',
              reasoning: 'Price is fair and user meets targeting criteria',
              confidence: 0.85
            })
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      const result = await evaluator.evaluateOffer(mockOffer, mockAdCreative);

      expect(result.decision).toBe('accept');
      expect(result.reasoning).toContain('Price is fair');
      expect(result.confidence).toBe(0.85);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.venice.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test_api_key_123',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should evaluate offer and return reject decision', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              decision: 'reject',
              reasoning: 'Price exceeds budget',
              confidence: 0.92
            })
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      const result = await evaluator.evaluateOffer(mockOffer, mockAdCreative);

      expect(result.decision).toBe('reject');
      expect(result.reasoning).toContain('Price exceeds budget');
      expect(result.confidence).toBe(0.92);
    });

    it('should include ZK proof validation in evaluation', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              decision: 'accept',
              reasoning: 'Valid proofs and good price',
              confidence: 0.88
            })
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      const proofValidation = {
        isValid: true,
        summary: 'Age and location proofs verified'
      };

      const result = await evaluator.evaluateOffer(mockOffer, mockAdCreative, proofValidation);

      expect(result.decision).toBe('accept');
      expect(global.fetch).toHaveBeenCalled();
      
      // Check that prompt includes proof validation
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.messages[0].content).toContain('ZK PROOF VALIDATION');
      expect(body.messages[0].content).toContain('Age and location proofs verified');
    });

    it('should parse JSON from LLM response with extra text', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Here is my evaluation: {"decision": "accept", "reasoning": "Good fit", "confidence": 0.8} Hope this helps!'
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      const result = await evaluator.evaluateOffer(mockOffer, mockAdCreative);

      expect(result.decision).toBe('accept');
      expect(result.reasoning).toBe('Good fit');
      expect(result.confidence).toBe(0.8);
    });
  });

  describe('evaluateOffer - LLM Failures', () => {
    it('should fall back to rules when API key is missing', async () => {
      delete process.env.VENICE_API_KEY;
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      evaluator = new LLMEvaluator();
      
      const result = await evaluator.evaluateOffer(mockOffer, mockAdCreative);

      expect(result.decision).toBe('accept'); // 0.001 SOL < 0.002 SOL max
      expect(result.reasoning).toContain('fallback rule');
      expect(global.fetch).not.toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should fall back to rules when API returns error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });

      const result = await evaluator.evaluateOffer(mockOffer, mockAdCreative);

      expect(result.decision).toBe('accept');
      expect(result.reasoning).toContain('fallback rule');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'LLM evaluation failed:',
        expect.stringContaining('Venice API error')
      );
      
      consoleErrorSpy.mockRestore();
    });

    it('should fall back when API response has no JSON', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const mockResponse = {
        choices: [{
          message: {
            content: 'This is just plain text without any JSON'
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      const result = await evaluator.evaluateOffer(mockOffer, mockAdCreative);

      expect(result.decision).toBe('accept');
      expect(result.reasoning).toContain('fallback rule');
      
      consoleErrorSpy.mockRestore();
    });

    it('should fall back when API response has invalid format', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const mockResponse = {
        choices: [{
          message: {
            content: '{"decision": "accept"}' // Missing reasoning and confidence
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      const result = await evaluator.evaluateOffer(mockOffer, mockAdCreative);

      expect(result.decision).toBe('accept');
      expect(result.reasoning).toContain('fallback rule');
      
      consoleErrorSpy.mockRestore();
    });

    it('should fall back when fetch throws network error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network failure'));

      const result = await evaluator.evaluateOffer(mockOffer, mockAdCreative);

      expect(result.decision).toBe('accept');
      expect(result.reasoning).toContain('fallback rule');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'LLM evaluation failed:',
        'Network failure'
      );
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle non-Error exceptions', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      (global.fetch as jest.Mock).mockRejectedValue('String error');

      const result = await evaluator.evaluateOffer(mockOffer, mockAdCreative);

      expect(result.decision).toBe('accept');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'LLM evaluation failed:',
        'Unknown error'
      );
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Fallback Evaluation Rules', () => {
    beforeEach(() => {
      delete process.env.VENICE_API_KEY;
      jest.spyOn(console, 'warn').mockImplementation();
      jest.spyOn(console, 'error').mockImplementation();
      evaluator = new LLMEvaluator();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should reject when price exceeds max budget', async () => {
      mockOffer.amount_lamports = 3000000; // 0.003 SOL
      mockAdCreative.budget_per_impression_lamports = 2000000; // 0.002 SOL max

      const result = await evaluator.evaluateOffer(mockOffer, mockAdCreative);

      expect(result.decision).toBe('reject');
      expect(result.reasoning).toContain('exceeds max CPM');
      expect(result.reasoning).toContain('fallback rule');
      expect(result.confidence).toBe(0.95);
    });

    it('should accept when price is under 80% of max budget', async () => {
      mockOffer.amount_lamports = 1500000; // 0.0015 SOL
      mockAdCreative.budget_per_impression_lamports = 2000000; // 0.002 SOL max (80% = 0.0016)

      const result = await evaluator.evaluateOffer(mockOffer, mockAdCreative);

      expect(result.decision).toBe('accept');
      expect(result.reasoning).toContain('Good price');
      expect(result.confidence).toBe(0.85);
    });

    it('should accept when price is between 80% and 100% of max budget', async () => {
      mockOffer.amount_lamports = 1800000; // 0.0018 SOL
      mockAdCreative.budget_per_impression_lamports = 2000000; // 0.002 SOL max (80% = 0.0016, 90% = 0.0018)

      const result = await evaluator.evaluateOffer(mockOffer, mockAdCreative);

      expect(result.decision).toBe('accept');
      expect(result.reasoning).toContain('Acceptable price');
      expect(result.confidence).toBe(0.70);
    });

    it('should accept when price equals max budget', async () => {
      mockOffer.amount_lamports = 2000000; // 0.002 SOL
      mockAdCreative.budget_per_impression_lamports = 2000000; // 0.002 SOL max

      const result = await evaluator.evaluateOffer(mockOffer, mockAdCreative);

      expect(result.decision).toBe('accept');
      expect(result.reasoning).toContain('Acceptable price');
      expect(result.confidence).toBe(0.70);
    });
  });

  describe('Prompt Building', () => {
    it('should build prompt with all targeting criteria', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"decision": "accept", "reasoning": "test", "confidence": 0.8}'
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      await evaluator.evaluateOffer(mockOffer, mockAdCreative);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      const prompt = body.messages[0].content;

      expect(prompt).toContain('Age: 25-45');
      expect(prompt).toContain('Locations: US, CA');
      expect(prompt).toContain('Interests: technology, gaming');
      expect(prompt).toContain('Tech Campaign');
      expect(prompt).toContain('Drive product awareness');
    });

    it('should handle missing targeting criteria', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"decision": "accept", "reasoning": "test", "confidence": 0.8}'
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      const minimalAd: AdCreative = {
        ad_creative_id: 'ad_789',
        advertiser_id: 'adv_123',
        budget_per_impression_lamports: 2000000
      };

      await evaluator.evaluateOffer(mockOffer, minimalAd);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      const prompt = body.messages[0].content;

      expect(prompt).toContain('No specific targeting');
      expect(prompt).toContain('Untitled Campaign');
    });

    it('should include ZK proof validation status in prompt', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"decision": "accept", "reasoning": "test", "confidence": 0.8}'
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      const invalidProof = {
        isValid: false,
        summary: 'Age proof failed verification'
      };

      await evaluator.evaluateOffer(mockOffer, mockAdCreative, invalidProof);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      const prompt = body.messages[0].content;

      expect(prompt).toContain('ZK PROOF VALIDATION: Age proof failed verification');
      expect(prompt).toContain('ZK proofs INVALID - User does NOT meet requirements');
    });

    it('should handle missing ZK proof validation', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"decision": "accept", "reasoning": "test", "confidence": 0.8}'
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      await evaluator.evaluateOffer(mockOffer, mockAdCreative);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      const prompt = body.messages[0].content;

      expect(prompt).toContain('ZK PROOF VALIDATION: Not available');
      expect(prompt).toContain('No proof validation available');
    });
  });

  describe('API Request Format', () => {
    it('should send correct request format to Venice AI', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"decision": "accept", "reasoning": "test", "confidence": 0.8}'
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      await evaluator.evaluateOffer(mockOffer, mockAdCreative);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.venice.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test_api_key_123',
            'Content-Type': 'application/json'
          }
        })
      );

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.model).toBe('venice-uncensored');
      expect(body.temperature).toBe(0.7);
      expect(body.max_tokens).toBe(512);
      expect(body.messages).toHaveLength(1);
      expect(body.messages[0].role).toBe('user');
      expect(body.messages[0].content).toContain('You are Peggy');
    });
  });
});
