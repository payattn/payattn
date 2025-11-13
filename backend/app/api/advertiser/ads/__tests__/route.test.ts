/**
 * Tests for advertiser ads listing API
 */

import { NextRequest } from 'next/server';
import { GET } from '../route';
import { getSupabase } from '@/lib/supabase';

// Mock Supabase
jest.mock('@/lib/supabase');

describe('GET /api/advertiser/ads', () => {
  let mockSupabase: any;
  let mockQuery: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create chainable query mock - ALL methods return a promise-like object that's also chainable
    let queryData: any = null;
    let queryError: any = null;
    
    const query: any = {
      from: jest.fn(),
      select: jest.fn(),
      eq: jest.fn(),
      order: jest.fn(),
      then: function(onfulfilled: any) {
        // Make it thenable so it can be awaited
        return Promise.resolve({ data: queryData, error: queryError }).then(onfulfilled);
      },
      // Helper to set what data/error the query should return
      __setResult: (data: any, error: any = null) => {
        queryData = data;
        queryError = error;
      }
    };
    
    // All methods return the same query object for chaining
    query.from.mockReturnValue(query);
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    
    mockQuery = query;
    mockSupabase = mockQuery;
    
    (getSupabase as jest.Mock).mockReturnValue(mockSupabase);
  });
  
  describe('Request Validation', () => {
    it('should return 400 when x-advertiser-id header is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/advertiser/ads');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing x-advertiser-id header');
    });
  });
  
  describe('List All Ads', () => {
    it('should return all ads for advertiser with summary stats', async () => {
      const mockAds = [
        {
          ad_creative_id: 'ad_1',
          advertiser_id: 'adv_123',
          campaign_id: 'camp_1',
          status: 'active',
          impressions_count: 100,
          clicks_count: 10,
          spent_lamports: 5000,
          total_budget_lamports: 10000,
          created_at: '2023-01-01T00:00:00Z'
        },
        {
          ad_creative_id: 'ad_2',
          advertiser_id: 'adv_123',
          campaign_id: 'camp_1',
          status: 'paused',
          impressions_count: 50,
          clicks_count: 5,
          spent_lamports: 2500,
          total_budget_lamports: 5000,
          created_at: '2023-01-02T00:00:00Z'
        }
      ];
      
      mockQuery.__setResult(mockAds);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/ads', {
        headers: { 'x-advertiser-id': 'adv_123' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.ads).toEqual(mockAds);
      expect(data.summary).toEqual({
        total_ads: 2,
        active: 1,
        paused: 1,
        total_impressions: 150,
        total_clicks: 15,
        total_spent: 7500,
        total_budget: 15000
      });
      expect(data.filters).toEqual({
        campaign_id: null,
        status: null
      });
    });
    
    it('should handle empty ads list', async () => {
      mockQuery.__setResult([]);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/ads', {
        headers: { 'x-advertiser-id': 'adv_new' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.ads).toEqual([]);
      expect(data.summary).toEqual({
        total_ads: 0,
        active: 0,
        paused: 0,
        total_impressions: 0,
        total_clicks: 0,
        total_spent: 0,
        total_budget: 0
      });
    });
    
    it('should handle ads with missing optional fields', async () => {
      const mockAds = [
        {
          ad_creative_id: 'ad_1',
          advertiser_id: 'adv_123',
          status: 'active',
          // Missing count fields
        }
      ];
      
      mockQuery.__setResult(mockAds);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/ads', {
        headers: { 'x-advertiser-id': 'adv_123' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.summary).toEqual({
        total_ads: 1,
        active: 1,
        paused: 0,
        total_impressions: 0,
        total_clicks: 0,
        total_spent: 0,
        total_budget: 0
      });
    });
  });
  
  describe('Filter by Campaign', () => {
    it('should filter ads by campaign_id query parameter', async () => {
      const mockAds = [
        {
          ad_creative_id: 'ad_1',
          advertiser_id: 'adv_123',
          campaign_id: 'camp_1',
          status: 'active'
        }
      ];
      
      mockQuery.__setResult(mockAds);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/ads?campaign_id=camp_1', {
        headers: { 'x-advertiser-id': 'adv_123' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.ads).toEqual(mockAds);
      expect(data.filters.campaign_id).toBe('camp_1');
      expect(mockQuery.eq).toHaveBeenCalledWith('campaign_id', 'camp_1');
    });
  });
  
  describe('Filter by Status', () => {
    it('should filter ads by status query parameter', async () => {
      const mockAds = [
        {
          ad_creative_id: 'ad_1',
          advertiser_id: 'adv_123',
          status: 'active'
        }
      ];
      
      mockQuery.__setResult(mockAds);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/ads?status=active', {
        headers: { 'x-advertiser-id': 'adv_123' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.ads).toEqual(mockAds);
      expect(data.filters.status).toBe('active');
      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'active');
    });
  });
  
  describe('Combined Filters', () => {
    it('should apply both campaign_id and status filters', async () => {
      const mockAds = [
        {
          ad_creative_id: 'ad_1',
          advertiser_id: 'adv_123',
          campaign_id: 'camp_1',
          status: 'active'
        }
      ];
      
      mockQuery.__setResult(mockAds);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/ads?campaign_id=camp_1&status=active', {
        headers: { 'x-advertiser-id': 'adv_123' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.filters).toEqual({
        campaign_id: 'camp_1',
        status: 'active'
      });
    });
  });
  
  describe('Summary Calculations', () => {
    it('should calculate correct summary with multiple ad statuses', async () => {
      const mockAds = [
        {
          ad_creative_id: 'ad_1',
          status: 'active',
          impressions_count: 100,
          clicks_count: 10,
          spent_lamports: 1000,
          total_budget_lamports: 2000
        },
        {
          ad_creative_id: 'ad_2',
          status: 'active',
          impressions_count: 200,
          clicks_count: 20,
          spent_lamports: 2000,
          total_budget_lamports: 3000
        },
        {
          ad_creative_id: 'ad_3',
          status: 'paused',
          impressions_count: 50,
          clicks_count: 5,
          spent_lamports: 500,
          total_budget_lamports: 1000
        }
      ];
      
      mockQuery.__setResult(mockAds);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/ads', {
        headers: { 'x-advertiser-id': 'adv_123' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(data.summary).toEqual({
        total_ads: 3,
        active: 2,
        paused: 1,
        total_impressions: 350,
        total_clicks: 35,
        total_spent: 3500,
        total_budget: 6000
      });
    });
  });
  
  describe('Error Handling', () => {
    it('should return 500 when database query fails', async () => {
      const dbError = { message: 'Database connection failed', code: 'DB_ERROR' };
      mockQuery.__setResult(null, dbError);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/ads', {
        headers: { 'x-advertiser-id': 'adv_123' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch ads');
      expect(data.details).toBe('Database connection failed');
    });
    
    it('should handle unexpected exceptions', async () => {
      mockQuery.order.mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/ads', {
        headers: { 'x-advertiser-id': 'adv_123' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to list ads');
      expect(data.message).toBe('Unexpected error');
    });
  });
  
  describe('Query Building', () => {
    it('should call Supabase with correct query chain', async () => {
      mockQuery.__setResult([]);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/ads', {
        headers: { 'x-advertiser-id': 'adv_123' }
      });
      
      await GET(request);
      
      expect(mockQuery.from).toHaveBeenCalledWith('ad_creative');
      expect(mockQuery.select).toHaveBeenCalledWith('*');
      expect(mockQuery.eq).toHaveBeenCalledWith('advertiser_id', 'adv_123');
      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });
  });
});
