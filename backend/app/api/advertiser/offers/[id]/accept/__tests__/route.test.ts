/**
 * Tests for offer acceptance API (x402 protocol)
 */

import { NextRequest } from 'next/server';
import { derivePDA, getPlatformPubkey, getProgramId } from '@/lib/solana-escrow';

// Mock dependencies BEFORE importing route
jest.mock('@/lib/solana-escrow');

// Setup Supabase mock
let mockQuery: any;
let mockSupabase: any;

// Create chainable query mock
let queryData: any = null;
let queryError: any = null;

mockQuery = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  then: (onfulfilled: any) => {
    return Promise.resolve({ data: queryData, error: queryError }).then(onfulfilled);
  },
  __setResult: (data: any, error: any) => {
    queryData = data;
    queryError = error;
  }
};

mockSupabase = {
  from: jest.fn().mockReturnValue(mockQuery)
};

// Mock createClient to return our mock
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

// NOW import the route after mocks are set up
import { POST } from '../route';

describe('POST /api/advertiser/offers/[id]/accept', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset query state
    queryData = null;
    queryError = null;
    
    // Mock Solana functions
    (derivePDA as jest.Mock).mockResolvedValue([
      { toBase58: () => 'EscrowPDA123' }
    ]);
    (getPlatformPubkey as jest.Mock).mockReturnValue('PlatformPubkey123');
    (getProgramId as jest.Mock).mockReturnValue('ProgramId123');
  });
  
  describe('Fetch Offer', () => {
    it('should fetch offer by id', async () => {
      const mockOffer = {
        offer_id: 'offer_123',
        user_pubkey: 'UserWallet123',
        amount_lamports: 1000,
        status: 'offer_made'
      };
      
      mockQuery.__setResult([mockOffer], null);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/offers/offer_123/accept', {
        method: 'POST'
      });
      
      const response = await POST(request, { params: Promise.resolve({ id: 'offer_123' }) });
      
      expect(response.status).toBe(402);
      expect(mockSupabase.from).toHaveBeenCalledWith('offers');
      expect(mockQuery.select).toHaveBeenCalledWith('*');
      expect(mockQuery.eq).toHaveBeenCalledWith('offer_id', 'offer_123');
    });
    
    it('should return 404 when offer not found', async () => {
      mockQuery.__setResult([], null);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/offers/offer_999/accept', {
        method: 'POST'
      });
      
      const response = await POST(request, { params: Promise.resolve({ id: 'offer_999' }) });
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data.error).toBe('Offer not found');
    });
    
    it('should return 404 when offers is null', async () => {
      mockQuery.__setResult(null, null);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/offers/offer_999/accept', {
        method: 'POST'
      });
      
      const response = await POST(request, { params: Promise.resolve({ id: 'offer_999' }) });
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data.error).toBe('Offer not found');
    });
    
    it('should return 500 on database fetch error', async () => {
      mockQuery.__setResult(null, { message: 'Connection lost', code: 'ECONNREFUSED' });
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/offers/offer_123/accept', {
        method: 'POST'
      });
      
      const response = await POST(request, { params: Promise.resolve({ id: 'offer_123' }) });
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Database error');
    });
  });
  
  describe('Offer Status Validation', () => {
    it('should reject offer with invalid status', async () => {
      const mockOffer = {
        offer_id: 'offer_123',
        user_pubkey: 'UserWallet123',
        amount_lamports: 1000,
        status: 'pending'
      };
      
      mockQuery.__setResult([mockOffer], null);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/offers/offer_123/accept', {
        method: 'POST'
      });
      
      const response = await POST(request, { params: Promise.resolve({ id: 'offer_123' }) });
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid offer status: pending. Expected: offer_made');
    });
    
    it('should accept offer with offer_made status', async () => {
      const mockOffer = {
        offer_id: 'offer_123',
        user_pubkey: 'UserWallet123',
        amount_lamports: 1000,
        status: 'offer_made'
      };
      
      // First call returns offer, second call (update) returns success
      let isFirstCall = true;
      mockQuery.then = (onfulfilled: any) => {
        if (isFirstCall) {
          isFirstCall = false;
          return Promise.resolve({ data: [mockOffer], error: null }).then(onfulfilled);
        } else {
          return Promise.resolve({ data: null, error: null }).then(onfulfilled);
        }
      };
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/offers/offer_123/accept', {
        method: 'POST'
      });
      
      const response = await POST(request, { params: Promise.resolve({ id: 'offer_123' }) });
      
      expect(response.status).toBe(402);
    });
  });
  
  describe('Update Offer Status', () => {
    it('should update offer status to accepted', async () => {
      const mockOffer = {
        offer_id: 'offer_123',
        user_pubkey: 'UserWallet123',
        amount_lamports: 1000,
        status: 'offer_made'
      };
      
      // First call returns offer, second call (update) returns success
      let isFirstCall = true;
      mockQuery.then = (onfulfilled: any) => {
        if (isFirstCall) {
          isFirstCall = false;
          return Promise.resolve({ data: [mockOffer], error: null }).then(onfulfilled);
        } else {
          return Promise.resolve({ data: null, error: null }).then(onfulfilled);
        }
      };
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/offers/offer_123/accept', {
        method: 'POST'
      });
      
      await POST(request, { params: Promise.resolve({ id: 'offer_123' }) });
      
      expect(mockQuery.update).toHaveBeenCalledWith({ status: 'accepted' });
      expect(mockQuery.eq).toHaveBeenCalledWith('offer_id', 'offer_123');
    });
    
    it('should return 500 when update fails', async () => {
      const mockOffer = {
        offer_id: 'offer_123',
        user_pubkey: 'UserWallet123',
        amount_lamports: 1000,
        status: 'offer_made'
      };
      
      // First call returns offer, second call (update) returns error
      let isFirstCall = true;
      mockQuery.then = (onfulfilled: any) => {
        if (isFirstCall) {
          isFirstCall = false;
          return Promise.resolve({ data: [mockOffer], error: null }).then(onfulfilled);
        } else {
          return Promise.resolve({ data: null, error: { message: 'Update failed' } }).then(onfulfilled);
        }
      };
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/offers/offer_123/accept', {
        method: 'POST'
      });
      
      const response = await POST(request, { params: Promise.resolve({ id: 'offer_123' }) });
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update offer');
    });
  });
  
  describe('x402 Response', () => {
    it('should return 402 Payment Required with x402 headers', async () => {
      const mockOffer = {
        offer_id: 'offer_123',
        user_pubkey: 'UserWallet123',
        amount_lamports: 1000,
        status: 'offer_made'
      };
      
      // First call returns offer, second call (update) returns success
      let isFirstCall = true;
      mockQuery.then = (onfulfilled: any) => {
        if (isFirstCall) {
          isFirstCall = false;
          return Promise.resolve({ data: [mockOffer], error: null }).then(onfulfilled);
        } else {
          return Promise.resolve({ data: null, error: null }).then(onfulfilled);
        }
      };
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/offers/offer_123/accept', {
        method: 'POST'
      });
      
      const response = await POST(request, { params: Promise.resolve({ id: 'offer_123' }) });
      const data = await response.json();
      
      expect(response.status).toBe(402);
      expect(data.message).toBe('Payment Required');
      expect(data.offer.offer_id).toBe('offer_123');
      expect(data.offer.amount_lamports).toBe(1000);
      expect(data.offer.user_pubkey).toBe('UserWallet123');
      
      // Check x402 standard headers
      expect(response.headers.get('X-Payment-Chain')).toBe('solana');
      expect(response.headers.get('X-Payment-Network')).toBe('devnet');
      expect(response.headers.get('X-Payment-Amount')).toBe('1000');
      expect(response.headers.get('X-Payment-Token')).toBe('SOL');
    });
    
    it('should include escrow details in headers', async () => {
      const mockOffer = {
        offer_id: 'offer_123',
        user_pubkey: 'UserWallet123',
        amount_lamports: 1000,
        status: 'offer_made'
      };
      
      // First call returns offer, second call (update) returns success
      let isFirstCall = true;
      mockQuery.then = (onfulfilled: any) => {
        if (isFirstCall) {
          isFirstCall = false;
          return Promise.resolve({ data: [mockOffer], error: null }).then(onfulfilled);
        } else {
          return Promise.resolve({ data: null, error: null }).then(onfulfilled);
        }
      };
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/offers/offer_123/accept', {
        method: 'POST'
      });
      
      const response = await POST(request, { params: Promise.resolve({ id: 'offer_123' }) });
      
      expect(response.headers.get('X-Offer-Id')).toBe('offer_123');
      expect(response.headers.get('X-User-Pubkey')).toBe('UserWallet123');
      expect(response.headers.get('X-Platform-Pubkey')).toBe('PlatformPubkey123');
      expect(response.headers.get('X-Escrow-Program')).toBe('ProgramId123');
      expect(response.headers.get('X-Escrow-PDA')).toBe('EscrowPDA123');
      expect(response.headers.get('X-Verification-Endpoint')).toBe('/api/advertiser/payments/verify');
    });
    
    it('should derive escrow PDA for offer', async () => {
      const mockOffer = {
        offer_id: 'offer_123',
        user_pubkey: 'UserWallet123',
        amount_lamports: 1000,
        status: 'offer_made'
      };
      
      // First call returns offer, second call (update) returns success
      let isFirstCall = true;
      mockQuery.then = (onfulfilled: any) => {
        if (isFirstCall) {
          isFirstCall = false;
          return Promise.resolve({ data: [mockOffer], error: null }).then(onfulfilled);
        } else {
          return Promise.resolve({ data: null, error: null }).then(onfulfilled);
        }
      };
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/offers/offer_123/accept', {
        method: 'POST'
      });
      
      await POST(request, { params: Promise.resolve({ id: 'offer_123' }) });
      
      expect(derivePDA).toHaveBeenCalledWith('offer_123');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle unexpected exceptions', async () => {
      // Make from() throw an error
      mockSupabase.from = jest.fn(() => {
        throw new Error('Unexpected database error');
      });
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/offers/offer_123/accept', {
        method: 'POST'
      });
      
      const response = await POST(request, { params: Promise.resolve({ id: 'offer_123' }) });
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Unexpected database error');
    });
    
    it('should handle non-Error exceptions', async () => {
      // Make from() throw a non-Error
      mockSupabase.from = jest.fn(() => {
        throw 'String error';
      });
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/offers/offer_123/accept', {
        method: 'POST'
      });
      
      const response = await POST(request, { params: Promise.resolve({ id: 'offer_123' }) });
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});
