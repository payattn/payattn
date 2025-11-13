/**
 * Tests for advertiser profile API
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { getSupabase } from '@/lib/supabase';

// Mock Supabase
jest.mock('@/lib/supabase');

describe('GET /api/advertiser/profile', () => {
  let mockSupabase: any;
  let mockQuery: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create chainable query mock
    let queryData: any = null;
    let queryError: any = null;
    
    const query: any = {
      from: jest.fn(),
      select: jest.fn(),
      eq: jest.fn(),
      single: jest.fn(),
      then: function(onfulfilled: any) {
        return Promise.resolve({ data: queryData, error: queryError }).then(onfulfilled);
      },
      __setResult: (data: any, error: any = null) => {
        queryData = data;
        queryError = error;
      }
    };
    
    query.from.mockReturnValue(query);
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.single.mockReturnValue(query);
    
    mockQuery = query;
    mockSupabase = mockQuery;
    
    (getSupabase as jest.Mock).mockReturnValue(mockSupabase);
  });
  
  describe('Request Validation', () => {
    it('should return 400 when x-wallet-address header is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/advertiser/profile');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Wallet address required');
    });
  });
  
  describe('Fetch Existing Advertiser', () => {
    it('should return advertiser profile when found', async () => {
      const mockAdvertiser = {
        advertiser_id: '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR',
        name: 'Test Advertiser',
        created_at: '2023-01-01T00:00:00Z'
      };
      
      mockQuery.__setResult(mockAdvertiser);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/profile', {
        headers: { 'x-wallet-address': '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.exists).toBe(true);
      expect(data.advertiser).toEqual({
        advertiser_id: '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR',
        name: 'Test Advertiser',
        created_at: '2023-01-01T00:00:00Z'
      });
    });
    
    it('should query by advertiser_id matching wallet address', async () => {
      mockQuery.__setResult({ advertiser_id: 'test', name: 'Test', created_at: '2023-01-01' });
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/profile', {
        headers: { 'x-wallet-address': 'wallet123' }
      });
      
      await GET(request);
      
      expect(mockQuery.from).toHaveBeenCalledWith('advertisers');
      expect(mockQuery.select).toHaveBeenCalledWith('*');
      expect(mockQuery.eq).toHaveBeenCalledWith('advertiser_id', 'wallet123');
      expect(mockQuery.single).toHaveBeenCalled();
    });
  });
  
  describe('Advertiser Not Found', () => {
    it('should return 404 when advertiser does not exist', async () => {
      mockQuery.__setResult(null, { code: 'PGRST116', message: 'No rows returned' });
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/profile', {
        headers: { 'x-wallet-address': '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data.exists).toBe(false);
      expect(data.wallet_address).toBe('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');
    });
    
    it('should handle null data as not found', async () => {
      mockQuery.__setResult(null);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/profile', {
        headers: { 'x-wallet-address': 'nonexistent' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data.exists).toBe(false);
    });
  });
  
  describe('Error Handling', () => {
    it('should return 500 for database errors (non-PGRST116)', async () => {
      mockQuery.__setResult(null, { code: 'DB_ERROR', message: 'Connection failed' });
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/profile', {
        headers: { 'x-wallet-address': 'wallet123' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Database error');
    });
    
    it('should handle unexpected exceptions', async () => {
      mockQuery.single.mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/profile', {
        headers: { 'x-wallet-address': 'wallet123' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});

describe('POST /api/advertiser/profile', () => {
  let mockSupabase: any;
  let mockQuery: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create chainable query mock for POST operations
    let queryData: any = null;
    let queryError: any = null;
    
    const query: any = {
      from: jest.fn(),
      select: jest.fn(),
      eq: jest.fn(),
      single: jest.fn(),
      insert: jest.fn(),
      then: function(onfulfilled: any) {
        return Promise.resolve({ data: queryData, error: queryError }).then(onfulfilled);
      },
      __setResult: (data: any, error: any = null) => {
        queryData = data;
        queryError = error;
      }
    };
    
    query.from.mockReturnValue(query);
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.single.mockReturnValue(query);
    query.insert.mockReturnValue(query);
    
    mockQuery = query;
    mockSupabase = mockQuery;
    
    (getSupabase as jest.Mock).mockReturnValue(mockSupabase);
  });
  
  describe('Request Validation', () => {
    it('should return 400 when wallet_address is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/advertiser/profile', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Wallet address required');
    });
    
    it('should return 400 when name is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/advertiser/profile', {
        method: 'POST',
        body: JSON.stringify({ wallet_address: 'wallet123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Name required');
    });
    
    it('should return 400 when name is empty string', async () => {
      const request = new NextRequest('http://localhost:3000/api/advertiser/profile', {
        method: 'POST',
        body: JSON.stringify({ wallet_address: 'wallet123', name: '' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Name required');
    });
    
    it('should return 400 when name is only whitespace', async () => {
      const request = new NextRequest('http://localhost:3000/api/advertiser/profile', {
        method: 'POST',
        body: JSON.stringify({ wallet_address: 'wallet123', name: '   ' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Name required');
    });
  });
  
  describe('Duplicate Prevention', () => {
    it('should return 409 when advertiser already exists', async () => {
      const existingAdvertiser = {
        advertiser_id: 'wallet123',
        name: 'Existing Advertiser',
        created_at: '2023-01-01T00:00:00Z'
      };
      
      mockQuery.__setResult(existingAdvertiser);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/profile', {
        method: 'POST',
        body: JSON.stringify({ wallet_address: 'wallet123', name: 'New Advertiser' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(409);
      expect(data.error).toBe('Advertiser already exists');
    });
  });
  
  describe('Create New Advertiser', () => {
    it('should create new advertiser successfully', async () => {
      // First check returns null (not found)
      let isFirstCall = true;
      mockQuery.single.mockImplementation(() => {
        if (isFirstCall) {
          isFirstCall = false;
          return {
            ...mockQuery,
            then: (onfulfilled: any) => Promise.resolve({ data: null, error: null }).then(onfulfilled)
          };
        }
        return mockQuery;
      });
      
      const newAdvertiser = {
        advertiser_id: '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR',
        name: 'New Advertiser',
        created_at: '2023-01-01T00:00:00Z'
      };
      
      mockQuery.__setResult(newAdvertiser);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/profile', {
        method: 'POST',
        body: JSON.stringify({
          wallet_address: '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR',
          name: 'New Advertiser'
        })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.advertiser).toEqual({
        advertiser_id: '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR',
        name: 'New Advertiser',
        created_at: '2023-01-01T00:00:00Z'
      });
    });
    
    it('should trim whitespace from name', async () => {
      let isFirstCall = true;
      mockQuery.single.mockImplementation(() => {
        if (isFirstCall) {
          isFirstCall = false;
          return {
            ...mockQuery,
            then: (onfulfilled: any) => Promise.resolve({ data: null, error: null }).then(onfulfilled)
          };
        }
        return mockQuery;
      });
      
      mockQuery.__setResult({
        advertiser_id: 'wallet123',
        name: 'Trimmed Name',
        created_at: '2023-01-01'
      });
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/profile', {
        method: 'POST',
        body: JSON.stringify({ wallet_address: 'wallet123', name: '  Trimmed Name  ' })
      });
      
      await POST(request);
      
      expect(mockQuery.insert).toHaveBeenCalledWith({
        advertiser_id: 'wallet123',
        name: 'Trimmed Name'
      });
    });
    
    it('should use wallet_address as advertiser_id', async () => {
      let isFirstCall = true;
      mockQuery.single.mockImplementation(() => {
        if (isFirstCall) {
          isFirstCall = false;
          return {
            ...mockQuery,
            then: (onfulfilled: any) => Promise.resolve({ data: null, error: null }).then(onfulfilled)
          };
        }
        return mockQuery;
      });
      
      mockQuery.__setResult({
        advertiser_id: 'unique_wallet_address',
        name: 'Test',
        created_at: '2023-01-01'
      });
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/profile', {
        method: 'POST',
        body: JSON.stringify({ wallet_address: 'unique_wallet_address', name: 'Test' })
      });
      
      await POST(request);
      
      expect(mockQuery.insert).toHaveBeenCalledWith({
        advertiser_id: 'unique_wallet_address',
        name: 'Test'
      });
    });
  });
  
  describe('Error Handling', () => {
    it('should return 500 when insert fails', async () => {
      let isFirstCall = true;
      mockQuery.single.mockImplementation(() => {
        if (isFirstCall) {
          isFirstCall = false;
          return {
            ...mockQuery,
            then: (onfulfilled: any) => Promise.resolve({ data: null, error: null }).then(onfulfilled)
          };
        }
        return mockQuery;
      });
      
      mockQuery.__setResult(null, { message: 'Insert failed', code: 'DB_ERROR' });
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/profile', {
        method: 'POST',
        body: JSON.stringify({ wallet_address: 'wallet123', name: 'Test' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create advertiser profile');
    });
    
    it('should handle unexpected exceptions', async () => {
      mockQuery.single.mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/profile', {
        method: 'POST',
        body: JSON.stringify({ wallet_address: 'wallet123', name: 'Test' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});
