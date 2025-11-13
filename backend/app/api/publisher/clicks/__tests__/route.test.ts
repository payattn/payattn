import { POST } from '../route';
import { NextRequest } from 'next/server';
import { getSupabase } from '@/lib/supabase';

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  getSupabase: jest.fn()
}));

const mockGetSupabase = getSupabase as jest.MockedFunction<typeof getSupabase>;

describe('/api/publisher/clicks', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    // Setup mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      update: jest.fn().mockReturnThis()
    };

    mockGetSupabase.mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/publisher/clicks', () => {
    it('should track click and increment counter successfully', async () => {
      const mockOffer = {
        ad_creative_id: 'creative-123'
      };

      const mockAdCreative = {
        clicks_count: 5
      };

      // Mock offer lookup
      mockSupabase.single
        .mockResolvedValueOnce({ data: mockOffer, error: null })
        // Mock ad_creative clicks_count lookup
        .mockResolvedValueOnce({ data: mockAdCreative, error: null });

      // Mock update
      mockSupabase.update.mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: {}, error: null })
      });

      const request = new NextRequest('http://localhost:3000/api/publisher/clicks', {
        method: 'POST',
        body: JSON.stringify({
          offerId: 'offer-123',
          publisherId: 'pub-456'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        offerId: 'offer-123',
        publisherId: 'pub-456',
        message: 'Click tracked successfully (reporting only, no payment for clicks)'
      });

      // Verify offer was looked up
      expect(mockSupabase.from).toHaveBeenCalledWith('offers');
      expect(mockSupabase.select).toHaveBeenCalledWith('ad_creative_id');
      expect(mockSupabase.eq).toHaveBeenCalledWith('offer_id', 'offer-123');

      // Verify clicks counter was incremented (5 -> 6)
      expect(mockSupabase.update).toHaveBeenCalledWith({ clicks_count: 6 });
    });

    it('should initialize clicks_count to 1 when null', async () => {
      const mockOffer = {
        ad_creative_id: 'creative-123'
      };

      const mockAdCreative = {
        clicks_count: null
      };

      mockSupabase.single
        .mockResolvedValueOnce({ data: mockOffer, error: null })
        .mockResolvedValueOnce({ data: mockAdCreative, error: null });

      mockSupabase.update.mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: {}, error: null })
      });

      const request = new NextRequest('http://localhost:3000/api/publisher/clicks', {
        method: 'POST',
        body: JSON.stringify({
          offerId: 'offer-123',
          publisherId: 'pub-456'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Should initialize to 1 (0 + 1)
      expect(mockSupabase.update).toHaveBeenCalledWith({ clicks_count: 1 });
    });

    it('should return 400 when offerId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/publisher/clicks', {
        method: 'POST',
        body: JSON.stringify({
          publisherId: 'pub-456'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: offerId, publisherId');
    });

    it('should return 400 when publisherId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/publisher/clicks', {
        method: 'POST',
        body: JSON.stringify({
          offerId: 'offer-123'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: offerId, publisherId');
    });

    it('should return 400 when both fields are missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/publisher/clicks', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: offerId, publisherId');
    });

    it('should return 404 when offer not found', async () => {
      mockSupabase.single.mockResolvedValue({ 
        data: null, 
        error: { message: 'Not found' } 
      });

      const request = new NextRequest('http://localhost:3000/api/publisher/clicks', {
        method: 'POST',
        body: JSON.stringify({
          offerId: 'nonexistent-offer',
          publisherId: 'pub-456'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Offer not found');
      expect(data.offerId).toBe('nonexistent-offer');
    });

    it('should return 404 when offer data is null', async () => {
      mockSupabase.single.mockResolvedValue({ 
        data: null, 
        error: null 
      });

      const request = new NextRequest('http://localhost:3000/api/publisher/clicks', {
        method: 'POST',
        body: JSON.stringify({
          offerId: 'offer-123',
          publisherId: 'pub-456'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Offer not found');
      expect(data.offerId).toBe('offer-123');
    });

    it('should handle offer without ad_creative_id gracefully', async () => {
      const mockOffer = {
        ad_creative_id: null
      };

      mockSupabase.single.mockResolvedValue({ data: mockOffer, error: null });

      const request = new NextRequest('http://localhost:3000/api/publisher/clicks', {
        method: 'POST',
        body: JSON.stringify({
          offerId: 'offer-123',
          publisherId: 'pub-456'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Should not attempt to update ad_creative when ad_creative_id is null
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    it('should return 500 when click count update fails', async () => {
      const mockOffer = {
        ad_creative_id: 'creative-123'
      };

      const mockAdCreative = {
        clicks_count: 5
      };

      mockSupabase.single
        .mockResolvedValueOnce({ data: mockOffer, error: null })
        .mockResolvedValueOnce({ data: mockAdCreative, error: null });

      // Mock update failure
      mockSupabase.update.mockReturnValue({
        eq: jest.fn().mockResolvedValue({ 
          data: null, 
          error: { message: 'Database error' } 
        })
      });

      const request = new NextRequest('http://localhost:3000/api/publisher/clicks', {
        method: 'POST',
        body: JSON.stringify({
          offerId: 'offer-123',
          publisherId: 'pub-456'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to track click');
      expect(data.details).toBe('Database error');
    });

    it('should handle JSON parse errors', async () => {
      const request = new NextRequest('http://localhost:3000/api/publisher/clicks', {
        method: 'POST',
        body: 'invalid json'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to track click');
      expect(data.message).toBeDefined();
    });

    it('should log click tracking for monitoring', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      const mockOffer = {
        ad_creative_id: 'creative-123'
      };

      mockSupabase.single.mockResolvedValueOnce({ data: mockOffer, error: null });
      mockSupabase.single.mockResolvedValueOnce({ data: { clicks_count: 0 }, error: null });
      mockSupabase.update.mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: {}, error: null })
      });

      const request = new NextRequest('http://localhost:3000/api/publisher/clicks', {
        method: 'POST',
        body: JSON.stringify({
          offerId: 'offer-123',
          publisherId: 'pub-456'
        })
      });

      await POST(request);

      expect(consoleSpy).toHaveBeenCalledWith('[Click] Received click: offer-123 from publisher pub-456');
      expect(consoleSpy).toHaveBeenCalledWith('[OK][OK][OK] [Click] Incremented counter for ad_creative creative-123');
    });

    it('should log errors when offer lookup fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error');
      
      mockSupabase.single.mockResolvedValue({ 
        data: null, 
        error: { message: 'DB error' } 
      });

      const request = new NextRequest('http://localhost:3000/api/publisher/clicks', {
        method: 'POST',
        body: JSON.stringify({
          offerId: 'offer-123',
          publisherId: 'pub-456'
        })
      });

      await POST(request);

      expect(consoleSpy).toHaveBeenCalledWith('[Click] Offer not found:', 'offer-123');
    });

    it('should log errors when update fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error');
      
      const mockOffer = {
        ad_creative_id: 'creative-123'
      };

      mockSupabase.single
        .mockResolvedValueOnce({ data: mockOffer, error: null })
        .mockResolvedValueOnce({ data: { clicks_count: 5 }, error: null });

      const mockError = { message: 'Update failed' };
      mockSupabase.update.mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: mockError })
      });

      const request = new NextRequest('http://localhost:3000/api/publisher/clicks', {
        method: 'POST',
        body: JSON.stringify({
          offerId: 'offer-123',
          publisherId: 'pub-456'
        })
      });

      await POST(request);

      expect(consoleSpy).toHaveBeenCalledWith('[Click] Failed to update click count:', mockError);
    });

    it('should confirm that clicks are for reporting only (no payment)', async () => {
      const mockOffer = {
        ad_creative_id: 'creative-123'
      };

      mockSupabase.single
        .mockResolvedValueOnce({ data: mockOffer, error: null })
        .mockResolvedValueOnce({ data: { clicks_count: 10 }, error: null });

      mockSupabase.update.mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: {}, error: null })
      });

      const request = new NextRequest('http://localhost:3000/api/publisher/clicks', {
        method: 'POST',
        body: JSON.stringify({
          offerId: 'offer-123',
          publisherId: 'pub-456'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.message).toContain('reporting only, no payment for clicks');
    });
  });
});
