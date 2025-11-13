import { POST } from '../route';
import { NextRequest } from 'next/server';
import { getSupabase } from '@/lib/supabase';

// Mock Supabase
jest.mock('@/lib/supabase');

const mockSupabase = {
  from: jest.fn(),
};

describe('/api/user/adstream', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSupabase as jest.Mock).mockReturnValue(mockSupabase);
    
    // Default mock chain
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
    };
    mockSupabase.from.mockReturnValue(mockQuery);
  });

  describe('POST /api/user/adstream', () => {
    it('should return ads for valid request', async () => {
      const mockAds = [
        {
          id: 'ad-1',
          advertiser_id: 'test_adv_acme',
          campaign_id: 'camp-1',
          headline: 'Test Ad',
          description: 'Test Description',
          destination_url: 'https://test-example.com',
          status: 'active',
          total_budget_lamports: 1000000000,
          spent_lamports: 0,
          budget_per_impression_lamports: 1000000,
          created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          targeting: {
            interests: [{ category: 'tech' }]
          }
        }
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnValue(Promise.resolve({ data: mockAds, error: null })),
        gt: jest.fn().mockReturnThis(),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:3000/api/user/adstream', {
        method: 'POST',
        headers: { 'x-user-id': 'test-user-123' },
        body: JSON.stringify({ last_checked: null }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ads).toHaveLength(1);
      expect(data.count).toBe(1);
      expect(data.ads[0]).toMatchObject({
        id: 'ad-1',
        headline: 'Test Ad',
      });
      expect(data.ads[0].advertiser).toMatchObject({
        id: 'test_adv_acme',
        name: 'Acme',
        domain: 'example.com',
      });
      expect(data.ads[0].campaign).toMatchObject({
        id: 'camp-1',
        name: 'Test Ad',
      });
    });

    it('should reject request without x-user-id header', async () => {
      const request = new NextRequest('http://localhost:3000/api/user/adstream', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing x-user-id header');
    });

    it('should filter ads by last_checked timestamp', async () => {
      const lastChecked = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
      
      const mockAds = [
        {
          id: 'ad-new',
          advertiser_id: 'test_adv_new',
          campaign_id: 'camp-1',
          headline: 'New Ad',
          description: 'New Description',
          destination_url: 'https://test-example.com',
          status: 'active',
          total_budget_lamports: 1000000000,
          spent_lamports: 0,
          budget_per_impression_lamports: 1000000,
          created_at: new Date().toISOString(), // Just created
          targeting: {}
        }
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnValue(Promise.resolve({ data: mockAds, error: null })),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:3000/api/user/adstream', {
        method: 'POST',
        headers: { 'x-user-id': 'test-user-123' },
        body: JSON.stringify({ last_checked: lastChecked }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockQuery.gt).toHaveBeenCalledWith('created_at', lastChecked);
      expect(data.ads).toHaveLength(1);
      expect(data.ads[0].id).toBe('ad-new');
    });

    it('should filter out ads with no remaining budget', async () => {
      const mockAds = [
        {
          id: 'ad-1',
          advertiser_id: 'test_adv_acme',
          campaign_id: 'camp-1',
          headline: 'Active Ad',
          description: 'Description',
          destination_url: 'https://test-example.com',
          status: 'active',
          total_budget_lamports: 1000000000,
          spent_lamports: 500000000, // Half spent, still has budget
          budget_per_impression_lamports: 1000000,
          created_at: new Date().toISOString(),
          targeting: {}
        },
        {
          id: 'ad-2',
          advertiser_id: 'test_adv_broke',
          campaign_id: 'camp-2',
          headline: 'Exhausted Ad',
          description: 'Description',
          destination_url: 'https://test-example.com',
          status: 'active',
          total_budget_lamports: 1000000000,
          spent_lamports: 1000000000, // Fully spent
          budget_per_impression_lamports: 1000000,
          created_at: new Date().toISOString(),
          targeting: {}
        }
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnValue(Promise.resolve({ data: mockAds, error: null })),
        gt: jest.fn().mockReturnThis(),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:3000/api/user/adstream', {
        method: 'POST',
        headers: { 'x-user-id': 'test-user-123' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ads).toHaveLength(1);
      expect(data.ads[0].id).toBe('ad-1');
      expect(data.message).toContain('1 new ads available');
    });

    it('should return empty array when no new ads', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnValue(Promise.resolve({ data: [], error: null })),
        gt: jest.fn().mockReturnThis(),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:3000/api/user/adstream', {
        method: 'POST',
        headers: { 'x-user-id': 'test-user-123' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ads).toHaveLength(0);
      expect(data.count).toBe(0);
      expect(data.message).toBe('No new ads since last check');
    });

    it('should handle database errors gracefully', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnValue(Promise.resolve({ 
          data: null, 
          error: { message: 'Database connection failed' } 
        })),
        gt: jest.fn().mockReturnThis(),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:3000/api/user/adstream', {
        method: 'POST',
        headers: { 'x-user-id': 'test-user-123' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch ads');
      expect(data.details).toBe('Database connection failed');
    });

    it('should use test_ad_creative table in test mode', async () => {
      process.env.DATABASE_MODE = 'test';

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnValue(Promise.resolve({ data: [], error: null })),
        gt: jest.fn().mockReturnThis(),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:3000/api/user/adstream', {
        method: 'POST',
        headers: { 'x-user-id': 'test-user-123' },
        body: JSON.stringify({}),
      });

      await POST(request);

      expect(mockSupabase.from).toHaveBeenCalledWith('test_ad_creative');
      
      // Reset env
      delete process.env.DATABASE_MODE;
    });

    it('should use ad_creative table in production mode', async () => {
      process.env.DATABASE_MODE = 'production';

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnValue(Promise.resolve({ data: [], error: null })),
        gt: jest.fn().mockReturnThis(),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:3000/api/user/adstream', {
        method: 'POST',
        headers: { 'x-user-id': 'test-user-123' },
        body: JSON.stringify({}),
      });

      await POST(request);

      expect(mockSupabase.from).toHaveBeenCalledWith('ad_creative');
      
      // Reset env
      delete process.env.DATABASE_MODE;
    });

    it('should transform advertiser name from id', async () => {
      const mockAds = [{
        id: 'ad-1',
        advertiser_id: 'test_adv_big_tech_company',
        campaign_id: 'camp-1',
        headline: 'Test',
        description: 'Desc',
        destination_url: 'https://test-example.com',
        status: 'active',
        total_budget_lamports: 1000000000,
        spent_lamports: 0,
        budget_per_impression_lamports: 1000000,
        created_at: new Date().toISOString(),
        targeting: {}
      }];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnValue(Promise.resolve({ data: mockAds, error: null })),
        gt: jest.fn().mockReturnThis(),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:3000/api/user/adstream', {
        method: 'POST',
        headers: { 'x-user-id': 'test-user' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.ads[0].advertiser.name).toBe('Big Tech Company');
    });

    it('should calculate avgPaid30d from budget_per_impression', async () => {
      const mockAds = [{
        id: 'ad-1',
        advertiser_id: 'test_adv_acme',
        campaign_id: 'camp-1',
        headline: 'Test',
        description: 'Desc',
        destination_url: 'https://test-example.com',
        status: 'active',
        total_budget_lamports: 1000000000,
        spent_lamports: 0,
        budget_per_impression_lamports: 10000000, // 0.01 SOL = $1.60 at $160/SOL
        created_at: new Date().toISOString(),
        targeting: {}
      }];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnValue(Promise.resolve({ data: mockAds, error: null })),
        gt: jest.fn().mockReturnThis(),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:3000/api/user/adstream', {
        method: 'POST',
        headers: { 'x-user-id': 'test-user' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.ads[0].advertiser.avgPaid30d).toBe(1.6);
    });

    it('should handle JSON parsing errors', async () => {
      const request = new NextRequest('http://localhost:3000/api/user/adstream', {
        method: 'POST',
        headers: { 
          'x-user-id': 'test-user',
          'content-type': 'application/json'
        },
        body: 'invalid json{',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch ad stream');
    });

    it('should include server_time in response', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnValue(Promise.resolve({ data: [], error: null })),
        gt: jest.fn().mockReturnThis(),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:3000/api/user/adstream', {
        method: 'POST',
        headers: { 'x-user-id': 'test-user-123' },
        body: JSON.stringify({}),
      });

      const beforeTime = Date.now();
      const response = await POST(request);
      const afterTime = Date.now();
      const data = await response.json();

      expect(data.server_time).toBeDefined();
      const serverTime = new Date(data.server_time).getTime();
      expect(serverTime).toBeGreaterThanOrEqual(beforeTime);
      expect(serverTime).toBeLessThanOrEqual(afterTime);
    });
  });
});
