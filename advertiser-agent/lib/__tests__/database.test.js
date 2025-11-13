import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Setup mocks BEFORE importing the module
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();
const mockSingle = jest.fn();

const mockSupabaseClient = {
  from: mockFrom
};

jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}));

jest.unstable_mockModule('../../config.js', () => ({
  config: {
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'test-anon-key'
  }
}));

// Now import after mocks are set up
const { DatabaseClient } = await import('../database.js');

describe('DatabaseClient', () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new DatabaseClient();
  });

  describe('constructor', () => {
    test('should initialize Supabase client', () => {
      expect(client.supabase).toBeDefined();
    });
  });

  describe('getAdvertiser', () => {
    beforeEach(() => {
      // Setup complete chain for getAdvertiser
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ single: mockSingle });
    });

    test('should fetch advertiser successfully', async () => {
      const mockAdvertiser = {
        advertiser_id: 'adv_001',
        name: 'Test Advertiser',
        wallet_address: 'wallet123'
      };

      mockSingle.mockResolvedValue({
        data: mockAdvertiser,
        error: null
      });

      const result = await client.getAdvertiser('adv_001');

      expect(result).toEqual(mockAdvertiser);
      expect(mockFrom).toHaveBeenCalledWith('advertisers');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('advertiser_id', 'adv_001');
    });

    test('should throw error when database query fails', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Connection failed' }
      });

      await expect(client.getAdvertiser('adv_001'))
        .rejects
        .toThrow('Failed to fetch advertiser: Connection failed');
    });

    test('should throw error when advertiser not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: null
      });

      await expect(client.getAdvertiser('adv_999'))
        .rejects
        .toThrow('Advertiser adv_999 not found');
    });
  });

  describe('getPendingOffers', () => {
    beforeEach(() => {
      // Setup complete chain for getPendingOffers
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      // First eq() for advertiser_id returns object with second eq()
      mockEq.mockReturnValueOnce({ eq: mockEq });
      // Second eq() for status returns object with order()
      mockEq.mockReturnValue({ order: mockOrder });
    });

    test('should fetch pending offers successfully', async () => {
      const mockOffers = [
        { id: 'offer-1', status: 'offer_made', created_at: '2025-01-01' },
        { id: 'offer-2', status: 'offer_made', created_at: '2025-01-02' }
      ];

      mockOrder.mockResolvedValue({
        data: mockOffers,
        error: null
      });

      const result = await client.getPendingOffers('adv_001');

      expect(result).toEqual(mockOffers);
      expect(mockFrom).toHaveBeenCalledWith('offers');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: true });
    });

    test('should use custom status filter', async () => {
      mockOrder.mockResolvedValue({
        data: [],
        error: null
      });

      await client.getPendingOffers('adv_001', 'accepted');

      expect(mockFrom).toHaveBeenCalledWith('offers');
    });

    test('should return empty array when no offers found', async () => {
      mockOrder.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await client.getPendingOffers('adv_001');

      expect(result).toEqual([]);
    });

    test('should handle database errors', async () => {
      mockOrder.mockResolvedValue({
        data: null,
        error: { message: 'Query timeout' }
      });

      await expect(client.getPendingOffers('adv_001'))
        .rejects
        .toThrow('Failed to fetch offers: Query timeout');
    });

    test('should use default status offer_made', async () => {
      mockOrder.mockResolvedValue({
        data: [],
        error: null
      });

      await client.getPendingOffers('adv_001');

      expect(mockFrom).toHaveBeenCalledWith('offers');
    });

    test('should order results by created_at ascending', async () => {
      mockOrder.mockResolvedValue({
        data: [],
        error: null
      });

      await client.getPendingOffers('adv_001', 'pending');

      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: true });
    });
  });
});
