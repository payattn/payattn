import { POST } from '../route';

// Mock fetch globally
global.fetch = jest.fn();

describe('/api/ai/complete', () => {
  const mockApiKey = 'test-venice-api-key';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.VENICE_API_KEY = mockApiKey;
  });

  afterEach(() => {
    delete process.env.VENICE_API_KEY;
  });

  describe('POST /api/ai/complete', () => {
    it('should successfully complete a request with default parameters', async () => {
      const mockVeniceResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'venice-uncensored',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'This is a test response from the AI.'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockVeniceResponse,
      });

      const request = new Request('http://localhost:3000/api/ai/complete', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Hello, AI!' }
          ]
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.model).toBe('venice-uncensored');
      expect(data.content).toBe('This is a test response from the AI.');
      expect(data.usage).toEqual({
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      });
      expect(data.raw).toEqual(mockVeniceResponse);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.venice.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'venice-uncensored',
            messages: [{ role: 'user', content: 'Hello, AI!' }],
            temperature: 0.7,
            max_tokens: 512,
          }),
        })
      );
    });

    it('should use custom model when specified', async () => {
      const mockVeniceResponse = {
        id: 'chatcmpl-456',
        object: 'chat.completion',
        created: 1677652288,
        model: 'custom-model',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Custom model response'
          },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockVeniceResponse,
      });

      const request = new Request('http://localhost:3000/api/ai/complete', {
        method: 'POST',
        body: JSON.stringify({
          model: 'custom-model',
          messages: [{ role: 'user', content: 'Test' }]
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.model).toBe('custom-model');

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);
      expect(payload.model).toBe('custom-model');
    });

    it('should use custom temperature and max_tokens when specified', async () => {
      const mockVeniceResponse = {
        id: 'chatcmpl-789',
        object: 'chat.completion',
        created: 1677652288,
        model: 'venice-uncensored',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Response' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockVeniceResponse,
      });

      const request = new Request('http://localhost:3000/api/ai/complete', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
          temperature: 0.9,
          max_tokens: 1024
        }),
      });

      await POST(request);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);
      expect(payload.temperature).toBe(0.9);
      expect(payload.max_tokens).toBe(1024);
    });

    it('should handle multiple messages in conversation', async () => {
      const mockVeniceResponse = {
        id: 'chatcmpl-multi',
        object: 'chat.completion',
        created: 1677652288,
        model: 'venice-uncensored',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Conversation response' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 20, completion_tokens: 15, total_tokens: 35 }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockVeniceResponse,
      });

      const request = new Request('http://localhost:3000/api/ai/complete', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'What is 2+2?' },
            { role: 'assistant', content: 'The answer is 4.' },
            { role: 'user', content: 'What about 3+3?' }
          ]
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);
      expect(payload.messages).toHaveLength(4);
    });

    it('should return error when Venice API key is not configured', async () => {
      delete process.env.VENICE_API_KEY;

      const request = new Request('http://localhost:3000/api/ai/complete', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }]
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Venice API key not configured');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should validate that messages array is required', async () => {
      const request = new Request('http://localhost:3000/api/ai/complete', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Messages array is required and must not be empty');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should validate that messages is an array', async () => {
      const request = new Request('http://localhost:3000/api/ai/complete', {
        method: 'POST',
        body: JSON.stringify({
          messages: 'not an array'
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Messages array is required and must not be empty');
    });

    it('should validate that messages array is not empty', async () => {
      const request = new Request('http://localhost:3000/api/ai/complete', {
        method: 'POST',
        body: JSON.stringify({
          messages: []
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Messages array is required and must not be empty');
    });

    it('should handle Venice API error responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key',
      });

      const request = new Request('http://localhost:3000/api/ai/complete', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }]
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Venice API error: Unauthorized');
      expect(data.details).toBe('Invalid API key');
    });

    it('should handle Venice API rate limit errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limit exceeded',
      });

      const request = new Request('http://localhost:3000/api/ai/complete', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }]
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Venice API error: Too Many Requests');
      expect(data.details).toBe('Rate limit exceeded');
    });

    it('should handle missing completion in Venice response', async () => {
      const mockVeniceResponse = {
        id: 'chatcmpl-empty',
        object: 'chat.completion',
        created: 1677652288,
        model: 'venice-uncensored',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: null // Missing content
          },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockVeniceResponse,
      });

      const request = new Request('http://localhost:3000/api/ai/complete', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }]
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('No completion in Venice response');
    });

    it('should handle empty choices array in Venice response', async () => {
      const mockVeniceResponse = {
        id: 'chatcmpl-no-choices',
        object: 'chat.completion',
        created: 1677652288,
        model: 'venice-uncensored',
        choices: [], // Empty choices
        usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockVeniceResponse,
      });

      const request = new Request('http://localhost:3000/api/ai/complete', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }]
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('No completion in Venice response');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network connection failed')
      );

      const request = new Request('http://localhost:3000/api/ai/complete', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }]
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to call Venice API');
      expect(data.details).toBe('Network connection failed');
    });

    it('should handle JSON parsing errors in request', async () => {
      const request = new Request('http://localhost:3000/api/ai/complete', {
        method: 'POST',
        body: 'invalid json{',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to call Venice API');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle non-Error exceptions', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce('String error');

      const request = new Request('http://localhost:3000/api/ai/complete', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }]
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to call Venice API');
      expect(data.details).toBe('String error');
    });
  });
});
