/**
 * Tests for pending offers API
 */

import { NextRequest } from 'next/server';
import { GET } from '../route';
import { DatabaseClient } from '@/lib/peggy/database';

// Mock DatabaseClient
jest.mock('@/lib/peggy/database');

describe('GET /api/advertiser/offers/pending', () => {
  let mockDatabaseClient: jest.Mocked<DatabaseClient>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDatabaseClient = {
      getAdvertiser: jest.fn(),
      getPendingOffersWithAds: jest.fn(),
    } as any;
    
    (DatabaseClient as jest.Mock).mockImplementation(() => mockDatabaseClient);
  });
  
  describe('Request Validation', () => {
    it('should return 400 when x-advertiser-id header is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/advertiser/offers/pending');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('x-advertiser-id header required');
    });
  });
  
  describe('Advertiser Validation', () => {
    it('should return 404 when advertiser does not exist', async () => {
      mockDatabaseClient.getAdvertiser.mockResolvedValue(null as any);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/offers/pending', {
        headers: { 'x-advertiser-id': 'nonexistent' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data.error).toBe('Advertiser not found');
      expect(mockDatabaseClient.getAdvertiser).toHaveBeenCalledWith('nonexistent');
    });
  });
  
  describe('Fetch Pending Offers', () => {
    it('should return offers for valid advertiser', async () => {
      const mockAdvertiser = {
        advertiser_id: 'adv_123',
        name: 'Test Advertiser',
        wallet_pubkey: 'wallet_123'
      };
      
      mockDatabaseClient.getAdvertiser.mockResolvedValue(mockAdvertiser);
      mockDatabaseClient.getPendingOffersWithAds.mockResolvedValue([
        {
          offer_id: 'offer_1',
          advertiser_id: 'adv_123',
          user_id: 'user_1',
          ad_id: 'ad_1',
          user_pubkey: 'wallet_1',
          amount_lamports: 1000,
          status: 'offer_made'
        },
        {
          offer_id: 'offer_2',
          advertiser_id: 'adv_123',
          user_id: 'user_2',
          ad_id: 'ad_2',
          user_pubkey: 'wallet_2',
          amount_lamports: 2000,
          status: 'offer_made'
        }
      ] as any);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/offers/pending', {
        headers: { 'x-advertiser-id': 'adv_123' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.offers).toHaveLength(2);
      expect(data.count).toBe(2);
      expect(mockDatabaseClient.getAdvertiser).toHaveBeenCalledWith('adv_123');
      expect(mockDatabaseClient.getPendingOffersWithAds).toHaveBeenCalledWith('adv_123');
    });
    
    it('should return empty array when no pending offers', async () => {
      const mockAdvertiser = {
        advertiser_id: 'adv_123',
        name: 'Test Advertiser',
        wallet_pubkey: 'wallet_123'
      };
      
      mockDatabaseClient.getAdvertiser.mockResolvedValue(mockAdvertiser);
      mockDatabaseClient.getPendingOffersWithAds.mockResolvedValue([]);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/offers/pending', {
        headers: { 'x-advertiser-id': 'adv_123' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.offers).toEqual([]);
      expect(data.count).toBe(0);
    });
    
    it('should fetch offers with ad details', async () => {
      const mockAdvertiser = { advertiser_id: 'adv_123', name: 'Test', wallet_pubkey: 'wallet_123' };
      const mockOffersWithAds = [
        {
          offer_id: 'offer_1',
          user_id: 'user_1',
          user_wallet: 'wallet_1',
          user_pubkey: 'wallet_1',
          ad_id: 'ad_1',
          advertiser_id: 'adv_123',
          amount_lamports: 1000,
          status: 'offer_made',
          ad_creative: {
            ad_creative_id: 'ad_1',
            advertiser_id: 'adv_123',
            headline: 'Test Ad',
            description: 'Test Body',
            budget_per_impression_lamports: 1000
          }
        }
      ];
      
      mockDatabaseClient.getAdvertiser.mockResolvedValue(mockAdvertiser);
      mockDatabaseClient.getPendingOffersWithAds.mockResolvedValue(mockOffersWithAds);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/offers/pending', {
        headers: { 'x-advertiser-id': 'adv_123' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.offers).toEqual(mockOffersWithAds);
      // Verify we're calling the method that includes ad details
      expect(mockDatabaseClient.getPendingOffersWithAds).toHaveBeenCalled();
    });
  });
  
  describe('Error Handling', () => {
    it('should return 500 when getAdvertiser throws error', async () => {
      mockDatabaseClient.getAdvertiser.mockRejectedValue(new Error('Database connection failed'));
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/offers/pending', {
        headers: { 'x-advertiser-id': 'adv_123' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(data.details).toBe('Database connection failed');
    });
    
    it('should return 500 when getPendingOffersWithAds throws error', async () => {
      const mockAdvertiser = { advertiser_id: 'adv_123', name: 'Test', wallet_pubkey: 'wallet_123' };
      mockDatabaseClient.getAdvertiser.mockResolvedValue(mockAdvertiser);
      mockDatabaseClient.getPendingOffersWithAds.mockRejectedValue(new Error('Query failed'));
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/offers/pending', {
        headers: { 'x-advertiser-id': 'adv_123' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(data.details).toBe('Query failed');
    });
    
    it('should handle non-Error exceptions', async () => {
      mockDatabaseClient.getAdvertiser.mockRejectedValue('String error');
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/offers/pending', {
        headers: { 'x-advertiser-id': 'adv_123' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(data.details).toBe('Unknown error');
    });
  });
});
