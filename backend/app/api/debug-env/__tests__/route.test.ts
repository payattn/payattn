import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('/api/debug-env', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('GET /api/debug-env', () => {
    it('should return environment variables when set', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

      const request = new NextRequest('http://localhost:3000/api/debug-env');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.supabaseUrl).toBe('https://test.supabase.co');
      expect(data.supabaseKeySet).toBe(true);
      expect(data.nodeEnv).toBeDefined();
    });

    it('should return NOT_SET when Supabase URL is not configured', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const request = new NextRequest('http://localhost:3000/api/debug-env');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.supabaseUrl).toBe('NOT_SET');
      expect(data.supabaseKeySet).toBe(false);
    });

    it('should handle missing Supabase key', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const request = new NextRequest('http://localhost:3000/api/debug-env');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.supabaseUrl).toBe('https://test.supabase.co');
      expect(data.supabaseKeySet).toBe(false);
    });

    it('should return NODE_ENV value', async () => {
      const request = new NextRequest('http://localhost:3000/api/debug-env');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.nodeEnv).toBeDefined();
    });
  });
});
