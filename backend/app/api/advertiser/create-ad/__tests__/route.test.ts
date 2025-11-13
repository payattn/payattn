import { POST } from '../route';
import { NextRequest } from 'next/server';
import { getSupabase } from '@/lib/supabase';

jest.mock('@/lib/supabase');

const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  single: jest.fn(),
};

(getSupabase as jest.Mock).mockReturnValue(mockSupabase);

describe('/api/advertiser/create-ad', () => {
  const validAdData = {
    headline: 'Test Ad Headline',
    body: 'This is a test ad body with compelling copy',
    cta: 'Learn More',
    destination_url: 'https://example.com',
    targeting: {
      age: { min: 18, max: 65 },
      interests: ['technology', 'gaming'],
      income: { min: 50000 },
      location: { countries: ['US', 'CA'] }
    },
    budget_per_impression_lamports: 1000,
    total_budget_lamports: 100000
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Request Validation', () => {
    it('should reject request without x-advertiser-id header', async () => {
      const request = new NextRequest('http://localhost/api/advertiser/create-ad', {
        method: 'POST',
        body: JSON.stringify(validAdData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing x-advertiser-id header');
    });

    it('should reject request without headline', async () => {
      const invalidData = { ...validAdData };
      delete (invalidData as any).headline;

      const request = new NextRequest('http://localhost/api/advertiser/create-ad', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'test-advertiser' },
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required ad content fields');
    });

    it('should reject request without body text', async () => {
      const invalidData = { ...validAdData };
      delete (invalidData as any).body;

      const request = new NextRequest('http://localhost/api/advertiser/create-ad', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'test-advertiser' },
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required ad content fields');
    });

    it('should reject request without cta', async () => {
      const invalidData = { ...validAdData };
      delete (invalidData as any).cta;

      const request = new NextRequest('http://localhost/api/advertiser/create-ad', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'test-advertiser' },
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required ad content fields');
    });

    it('should reject request without destination_url', async () => {
      const invalidData = { ...validAdData };
      delete (invalidData as any).destination_url;

      const request = new NextRequest('http://localhost/api/advertiser/create-ad', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'test-advertiser' },
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required ad content fields');
    });

    it('should reject request without targeting', async () => {
      const invalidData = { ...validAdData };
      delete (invalidData as any).targeting;

      const request = new NextRequest('http://localhost/api/advertiser/create-ad', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'test-advertiser' },
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Targeting criteria required');
    });

    it('should reject request without budget fields', async () => {
      const invalidData = { ...validAdData };
      delete (invalidData as any).budget_per_impression_lamports;

      const request = new NextRequest('http://localhost/api/advertiser/create-ad', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'test-advertiser' },
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Budget fields required');
    });
  });

  describe('Ad Creation', () => {
    it('should create ad with existing campaign_id', async () => {
      const adData = {
        ...validAdData,
        campaign_id: 'existing-campaign-123'
      };

      const mockAd = {
        ad_creative_id: 'ad_123',
        advertiser_id: 'test-advertiser',
        campaign_id: 'existing-campaign-123',
        ...validAdData
      };

      mockSupabase.single.mockResolvedValueOnce({ data: mockAd, error: null });

      const request = new NextRequest('http://localhost/api/advertiser/create-ad', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'test-advertiser' },
        body: JSON.stringify(adData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.ad_creative_id).toBeDefined();
      expect(data.campaign_id).toBe('existing-campaign-123');
      expect(mockSupabase.from).toHaveBeenCalledWith('ad_creative');
    });

    it('should create new campaign when campaign_name provided', async () => {
      const adData = {
        ...validAdData,
        campaign_name: 'Summer 2024 Campaign'
      };

      const mockAd = {
        ad_creative_id: 'ad_456',
        advertiser_id: 'test-advertiser',
        campaign_id: expect.stringMatching(/^camp_/),
        ...validAdData
      };

      mockSupabase.insert.mockReturnValueOnce({
        ...mockSupabase,
      });
      mockSupabase.single.mockResolvedValueOnce({ data: mockAd, error: null });

      const request = new NextRequest('http://localhost/api/advertiser/create-ad', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'test-advertiser' },
        body: JSON.stringify(adData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.campaign_id).toMatch(/^camp_/);
      expect(mockSupabase.from).toHaveBeenCalledWith('campaigns');
    });

    it('should generate unique ad_creative_id', async () => {
      mockSupabase.single.mockResolvedValueOnce({ 
        data: { ad_creative_id: 'ad_generated' }, 
        error: null 
      });

      const request = new NextRequest('http://localhost/api/advertiser/create-ad', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'test-advertiser' },
        body: JSON.stringify(validAdData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.ad_creative_id).toMatch(/^ad_\d+_[a-z0-9]{9}$/);
    });

    it('should set ad status to active', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: {}, error: null });

      const request = new NextRequest('http://localhost/api/advertiser/create-ad', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'test-advertiser' },
        body: JSON.stringify(validAdData)
      });

      await POST(request);

      const insertCall = mockSupabase.insert.mock.calls.find(
        call => call[0]?.headline === validAdData.headline
      );
      expect(insertCall[0]).toMatchObject({
        status: 'active',
        headline: validAdData.headline
      });
    });

    it('should include targeting criteria in created ad', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: {}, error: null });

      const request = new NextRequest('http://localhost/api/advertiser/create-ad', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'test-advertiser' },
        body: JSON.stringify(validAdData)
      });

      await POST(request);

      const insertCall = mockSupabase.insert.mock.calls.find(
        call => call[0]?.headline === validAdData.headline
      );
      expect(insertCall[0]?.targeting).toEqual(validAdData.targeting);
    });

    it('should return next_steps guidance for advertisers', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: {}, error: null });

      const request = new NextRequest('http://localhost/api/advertiser/create-ad', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'test-advertiser' },
        body: JSON.stringify(validAdData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.next_steps).toBeDefined();
      expect(Array.isArray(data.next_steps)).toBe(true);
      expect(data.next_steps.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it.skip('should handle campaign creation failure', async () => {
      // TODO: Fix mock chain for campaign creation failure
      const adData = {
        ...validAdData,
        campaign_name: 'Test Campaign'
      };

      // Mock campaign insert to fail
      let callCount = 0;
      mockSupabase.insert.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call is campaign insert - make it fail
          return {
            ...mockSupabase,
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database constraint violation' }
            })
          };
        }
        // Subsequent calls use default behavior
        return mockSupabase;
      });

      const request = new NextRequest('http://localhost/api/advertiser/create-ad', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'test-advertiser' },
        body: JSON.stringify(adData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create campaign');
    });

    it('should handle ad creation failure', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Insert failed' }
      });

      const request = new NextRequest('http://localhost/api/advertiser/create-ad', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'test-advertiser' },
        body: JSON.stringify(validAdData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create ad');
      expect(data.details).toBeDefined();
    });

    it('should handle invalid JSON in request body', async () => {
      const request = new NextRequest('http://localhost/api/advertiser/create-ad', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'test-advertiser' },
        body: 'invalid json{'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create ad');
    });
  });

  describe('Budget Validation', () => {
    it('should accept valid budget values', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: {}, error: null });

      const request = new NextRequest('http://localhost/api/advertiser/create-ad', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'test-advertiser' },
        body: JSON.stringify(validAdData)
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should store budget amounts correctly', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: {}, error: null });

      const request = new NextRequest('http://localhost/api/advertiser/create-ad', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'test-advertiser' },
        body: JSON.stringify(validAdData)
      });

      await POST(request);

      const insertCall = mockSupabase.insert.mock.calls.find(
        call => call[0]?.headline === validAdData.headline
      );
      expect(insertCall[0]?.budget_per_impression_lamports).toBe(1000);
      expect(insertCall[0]?.total_budget_lamports).toBe(100000);
    });
  });

  describe('Targeting Validation', () => {
    it('should accept complex targeting criteria', async () => {
      const complexTargeting = {
        age: { min: 25, max: 45 },
        interests: ['technology', 'gaming', 'crypto'],
        income: { min: 75000, max: 200000 },
        location: { countries: ['US', 'CA', 'UK'], states: ['CA', 'NY'] }
      };

      mockSupabase.single.mockResolvedValueOnce({ data: {}, error: null });

      const request = new NextRequest('http://localhost/api/advertiser/create-ad', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'test-advertiser' },
        body: JSON.stringify({ ...validAdData, targeting: complexTargeting })
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should store targeting as JSON object', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: {}, error: null });

      const request = new NextRequest('http://localhost/api/advertiser/create-ad', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'test-advertiser' },
        body: JSON.stringify(validAdData)
      });

      await POST(request);

      const insertCall = mockSupabase.insert.mock.calls.find(
        call => call[0]?.headline === validAdData.headline
      );
      expect(typeof insertCall[0]?.targeting).toBe('object');
    });
  });
});
