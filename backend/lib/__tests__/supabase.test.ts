import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

const mockCreateClient = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: any[]) => mockCreateClient(...args),
}));

describe('Supabase Client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    mockCreateClient.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Environment Validation', () => {
    it('should throw error if SUPABASE_URL is missing', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_key';

      expect(() => {
        require('../supabase');
      }).toThrow('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
    });

    it('should throw error if SUPABASE_ANON_KEY is missing', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      expect(() => {
        require('../supabase');
      }).toThrow('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
    });

    it('should not throw error if both environment variables are present', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_key';

      expect(() => {
        require('../supabase');
      }).not.toThrow();
    });
  });

  describe('getSupabase', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_key';
    });

    it('should create client with correct credentials', () => {
      const mockClient = { from: jest.fn() };
      mockCreateClient.mockReturnValue(mockClient);

      const { getSupabase } = require('../supabase');
      const client = getSupabase();

      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test_key'
      );
      expect(client).toBe(mockClient);
    });

    it('should return singleton instance on subsequent calls', () => {
      const mockClient = { from: jest.fn() };
      mockCreateClient.mockReturnValue(mockClient);

      const { getSupabase } = require('../supabase');
      const client1 = getSupabase();
      const client2 = getSupabase();

      expect(mockCreateClient).toHaveBeenCalledTimes(1);
      expect(client1).toBe(client2);
    });
  });

  describe('query function', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_key';
    });

    it('should return mock result structure', async () => {
      const { query } = require('../supabase');
      const result = await query('SELECT * FROM users', []);

      expect(result).toHaveProperty('rows');
      expect(result).toHaveProperty('rowCount');
      expect(Array.isArray(result.rows)).toBe(true);
      expect(result.rowCount).toBe(0);
    });

    it('should handle queries with parameters', async () => {
      const { query } = require('../supabase');
      const result = await query('SELECT * FROM users WHERE id = $1', ['123']);

      expect(result).toHaveProperty('rows');
      expect(result).toHaveProperty('rowCount');
    });

    it('should handle queries without parameters', async () => {
      const { query } = require('../supabase');
      const result = await query('SELECT * FROM users');

      expect(result).toHaveProperty('rows');
    });
  });
});
