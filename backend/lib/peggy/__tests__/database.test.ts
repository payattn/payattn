/**
 * Tests for Peggy Database Client
 * Queries offers and ad creatives from Supabase
 */

// Mock Supabase BEFORE importing database
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}));

import { DatabaseClient, Offer, AdCreative, Advertiser } from '../database';
import { createClient } from '@supabase/supabase-js';

const mockCreateClient = createClient as jest.Mock;

describe('DatabaseClient', () => {
  let mockSupabase: any;
  let databaseClient: DatabaseClient;

  beforeEach(() => {
    // Reset environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.DATABASE_MODE = 'production';

    // Create mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
      update: jest.fn().mockReturnThis()
    };

    mockCreateClient.mockReturnValue(mockSupabase);

    databaseClient = new DatabaseClient();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should throw error when SUPABASE_URL is missing', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      expect(() => new DatabaseClient()).toThrow('Missing Supabase credentials in environment variables');
    });

    it('should throw error when SUPABASE_ANON_KEY is missing', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      expect(() => new DatabaseClient()).toThrow('Missing Supabase credentials in environment variables');
    });

    it('should use ad_creative table in production mode', () => {
      process.env.DATABASE_MODE = 'production';
      const client = new DatabaseClient();
      expect(mockCreateClient).toHaveBeenCalledWith('https://test.supabase.co', 'test-anon-key');
    });

    it('should use test_ad_creative table in test mode', () => {
      process.env.DATABASE_MODE = 'test';
      new DatabaseClient();
      // Table selection is logged but we can't directly test private property
      // We'll verify this in getPendingOffersWithAds tests
    });

    it('should default to production mode when DATABASE_MODE not set', () => {
      delete process.env.DATABASE_MODE;
      new DatabaseClient();
      expect(mockCreateClient).toHaveBeenCalled();
    });
  });

  describe('getAdvertiser', () => {
    it('should fetch advertiser by advertiser_id', async () => {
      const advertiser: Advertiser = {
        advertiser_id: 'adv_123',
        name: 'Test Advertiser',
        wallet_pubkey: 'wallet123',
        created_at: '2025-01-01'
      };

      mockSupabase.maybeSingle.mockResolvedValue({ data: advertiser, error: null });

      const result = await databaseClient.getAdvertiser('adv_123');

      expect(mockSupabase.from).toHaveBeenCalledWith('advertisers');
      expect(mockSupabase.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.eq).toHaveBeenCalledWith('advertiser_id', 'adv_123');
      expect(result).toEqual(advertiser);
    });

    it('should fallback to wallet_pubkey if advertiser_id not found', async () => {
      const advertiser: Advertiser = {
        advertiser_id: 'adv_123',
        name: 'Test Advertiser',
        wallet_pubkey: 'wallet123'
      };

      // First call returns null (not found by advertiser_id)
      mockSupabase.maybeSingle
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: advertiser, error: null });

      const result = await databaseClient.getAdvertiser('wallet123');

      expect(mockSupabase.eq).toHaveBeenCalledWith('advertiser_id', 'wallet123');
      expect(mockSupabase.eq).toHaveBeenCalledWith('wallet_pubkey', 'wallet123');
      expect(result).toEqual(advertiser);
    });

    it('should throw error when database query fails', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      });

      await expect(databaseClient.getAdvertiser('adv_123')).rejects.toThrow(
        'Failed to fetch advertiser: Database connection failed'
      );
    });

    it('should throw error when advertiser not found', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });

      await expect(databaseClient.getAdvertiser('nonexistent')).rejects.toThrow(
        'Advertiser nonexistent not found'
      );
    });
  });

  describe('getPendingOffers', () => {
    it('should fetch offers with default status', async () => {
      const offers: Offer[] = [
        {
          offer_id: 'offer1',
          user_id: 'user1',
          ad_id: 'ad1',
          advertiser_id: 'adv_123',
          amount_lamports: 1000000,
          user_pubkey: 'wallet1',
          status: 'offer_made'
        }
      ];

      mockSupabase.order.mockResolvedValue({ data: offers, error: null });

      const result = await databaseClient.getPendingOffers('adv_123');

      expect(mockSupabase.from).toHaveBeenCalledWith('offers');
      expect(mockSupabase.eq).toHaveBeenCalledWith('advertiser_id', 'adv_123');
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'offer_made');
      expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: true });
      expect(result).toEqual(offers);
    });

    it('should fetch offers with custom status', async () => {
      const offers: Offer[] = [
        {
          offer_id: 'offer1',
          user_id: 'user1',
          ad_id: 'ad1',
          advertiser_id: 'adv_123',
          amount_lamports: 1000000,
          user_pubkey: 'wallet1',
          status: 'accepted'
        }
      ];

      mockSupabase.order.mockResolvedValue({ data: offers, error: null });

      const result = await databaseClient.getPendingOffers('adv_123', 'accepted');

      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'accepted');
      expect(result).toEqual(offers);
    });

    it('should return empty array when no offers found', async () => {
      mockSupabase.order.mockResolvedValue({ data: null, error: null });

      const result = await databaseClient.getPendingOffers('adv_123');

      expect(result).toEqual([]);
    });

    it('should throw error when database query fails', async () => {
      mockSupabase.order.mockResolvedValue({
        data: null,
        error: { message: 'Query failed' }
      });

      await expect(databaseClient.getPendingOffers('adv_123')).rejects.toThrow(
        'Failed to fetch offers: Query failed'
      );
    });
  });

  describe('getPendingOffersWithAds', () => {
    it('should return empty array when no offers found', async () => {
      mockSupabase.order.mockResolvedValue({ data: [], error: null });

      const result = await databaseClient.getPendingOffersWithAds('adv_123');

      expect(result).toEqual([]);
    });

    it('should fetch offers with ad creative data', async () => {
      const offers: Offer[] = [
        {
          offer_id: 'offer1',
          user_id: 'user1',
          ad_id: 'ad1',
          advertiser_id: 'adv_123',
          amount_lamports: 1000000,
          user_pubkey: 'wallet1',
          status: 'offer_made'
        }
      ];

      const ads: AdCreative[] = [
        {
          ad_creative_id: 'ad1',
          advertiser_id: 'adv_123',
          headline: 'Test Ad',
          description: 'Test Description',
          budget_per_impression_lamports: 1000
        }
      ];

      mockSupabase.order.mockResolvedValue({ data: offers, error: null });
      mockSupabase.in.mockResolvedValue({ data: ads, error: null });

      const result = await databaseClient.getPendingOffersWithAds('adv_123');

      expect(mockSupabase.from).toHaveBeenCalledWith('offers');
      expect(mockSupabase.from).toHaveBeenCalledWith('ad_creative');
      expect(mockSupabase.in).toHaveBeenCalledWith('ad_creative_id', ['ad1']);
      expect(result).toHaveLength(1);
      expect(result[0]?.ad_creative).toEqual(ads[0]);
    });

    it('should use test_ad_creative table in test mode', async () => {
      process.env.DATABASE_MODE = 'test';
      const testClient = new DatabaseClient();

      const offers: Offer[] = [
        {
          offer_id: 'offer1',
          user_id: 'user1',
          ad_id: 'ad1',
          advertiser_id: 'adv_123',
          amount_lamports: 1000000,
          user_pubkey: 'wallet1',
          status: 'offer_made'
        }
      ];

      mockSupabase.order.mockResolvedValue({ data: offers, error: null });
      mockSupabase.in.mockResolvedValue({ data: [], error: null });

      await testClient.getPendingOffersWithAds('adv_123');

      expect(mockSupabase.from).toHaveBeenCalledWith('test_ad_creative');
    });

    it('should handle multiple offers with same ad', async () => {
      const offers: Offer[] = [
        {
          offer_id: 'offer1',
          user_id: 'user1',
          ad_id: 'ad1',
          advertiser_id: 'adv_123',
          amount_lamports: 1000000,
          user_pubkey: 'wallet1',
          status: 'offer_made'
        },
        {
          offer_id: 'offer2',
          user_id: 'user2',
          ad_id: 'ad1',
          advertiser_id: 'adv_123',
          amount_lamports: 1000000,
          user_pubkey: 'wallet2',
          status: 'offer_made'
        }
      ];

      const ads: AdCreative[] = [
        {
          ad_creative_id: 'ad1',
          advertiser_id: 'adv_123',
          headline: 'Test Ad',
          budget_per_impression_lamports: 1000
        }
      ];

      mockSupabase.order.mockResolvedValue({ data: offers, error: null });
      mockSupabase.in.mockResolvedValue({ data: ads, error: null });

      const result = await databaseClient.getPendingOffersWithAds('adv_123');

      expect(result).toHaveLength(2);
      expect(result[0]?.ad_creative).toEqual(ads[0]);
      expect(result[1]?.ad_creative).toEqual(ads[0]);
      // Should only query once for unique ad IDs
      expect(mockSupabase.in).toHaveBeenCalledWith('ad_creative_id', ['ad1']);
    });

    it('should handle multiple offers with different ads', async () => {
      const offers: Offer[] = [
        {
          offer_id: 'offer1',
          user_id: 'user1',
          ad_id: 'ad1',
          advertiser_id: 'adv_123',
          amount_lamports: 1000000,
          user_pubkey: 'wallet1',
          status: 'offer_made'
        },
        {
          offer_id: 'offer2',
          user_id: 'user2',
          ad_id: 'ad2',
          advertiser_id: 'adv_123',
          amount_lamports: 2000000,
          user_pubkey: 'wallet2',
          status: 'offer_made'
        }
      ];

      const ads: AdCreative[] = [
        {
          ad_creative_id: 'ad1',
          advertiser_id: 'adv_123',
          headline: 'Ad 1',
          budget_per_impression_lamports: 1000
        },
        {
          ad_creative_id: 'ad2',
          advertiser_id: 'adv_123',
          headline: 'Ad 2',
          budget_per_impression_lamports: 2000
        }
      ];

      mockSupabase.order.mockResolvedValue({ data: offers, error: null });
      mockSupabase.in.mockResolvedValue({ data: ads, error: null });

      const result = await databaseClient.getPendingOffersWithAds('adv_123');

      expect(result).toHaveLength(2);
      expect(result[0]?.ad_creative?.ad_creative_id).toBe('ad1');
      expect(result[1]?.ad_creative?.ad_creative_id).toBe('ad2');
      expect(mockSupabase.in).toHaveBeenCalledWith('ad_creative_id', ['ad1', 'ad2']);
    });

    it('should return offers with undefined ad_creative when ad fetch fails', async () => {
      const offers: Offer[] = [
        {
          offer_id: 'offer1',
          user_id: 'user1',
          ad_id: 'ad1',
          advertiser_id: 'adv_123',
          amount_lamports: 1000000,
          user_pubkey: 'wallet1',
          status: 'offer_made'
        }
      ];

      mockSupabase.order.mockResolvedValue({ data: offers, error: null });
      mockSupabase.in.mockResolvedValue({
        data: null,
        error: { message: 'Failed to fetch ads' }
      });

      const result = await databaseClient.getPendingOffersWithAds('adv_123');

      expect(result).toHaveLength(1);
      expect(result[0]?.ad_creative).toBeUndefined();
    });

    it('should handle empty ad data array', async () => {
      const offers: Offer[] = [
        {
          offer_id: 'offer1',
          user_id: 'user1',
          ad_id: 'ad1',
          advertiser_id: 'adv_123',
          amount_lamports: 1000000,
          user_pubkey: 'wallet1',
          status: 'offer_made'
        }
      ];

      mockSupabase.order.mockResolvedValue({ data: offers, error: null });
      mockSupabase.in.mockResolvedValue({ data: [], error: null });

      const result = await databaseClient.getPendingOffersWithAds('adv_123');

      expect(result).toHaveLength(1);
      expect(result[0]?.ad_creative).toBeUndefined();
    });
  });

  describe('getAdCreative', () => {
    it('should fetch ad creative by ID', async () => {
      const ad: AdCreative = {
        ad_creative_id: 'ad1',
        advertiser_id: 'adv_123',
        headline: 'Test Ad',
        description: 'Test Description',
        budget_per_impression_lamports: 1000
      };

      mockSupabase.single.mockResolvedValue({ data: ad, error: null });

      const result = await databaseClient.getAdCreative('ad1');

      expect(mockSupabase.from).toHaveBeenCalledWith('ad_creative');
      expect(mockSupabase.eq).toHaveBeenCalledWith('ad_creative_id', 'ad1');
      expect(result).toEqual(ad);
    });

    it('should return null when ad not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' }
      });

      const result = await databaseClient.getAdCreative('nonexistent');

      expect(result).toBeNull();
    });

    it('should use test_ad_creative table in test mode', async () => {
      process.env.DATABASE_MODE = 'test';
      const testClient = new DatabaseClient();

      mockSupabase.single.mockResolvedValue({ data: null, error: null });

      await testClient.getAdCreative('ad1');

      expect(mockSupabase.from).toHaveBeenCalledWith('test_ad_creative');
    });
  });

  describe('updateOfferStatus', () => {
    it('should update offer status successfully', async () => {
      mockSupabase.eq.mockResolvedValue({ error: null });

      await databaseClient.updateOfferStatus('offer1', 'accepted');

      expect(mockSupabase.from).toHaveBeenCalledWith('offers');
      expect(mockSupabase.update).toHaveBeenCalledWith({ status: 'accepted' });
      expect(mockSupabase.eq).toHaveBeenCalledWith('offer_id', 'offer1');
    });

    it('should throw error when update fails', async () => {
      mockSupabase.eq.mockResolvedValue({
        error: { message: 'Update failed' }
      });

      await expect(databaseClient.updateOfferStatus('offer1', 'accepted')).rejects.toThrow(
        'Failed to update offer status: Update failed'
      );
    });
  });
});
