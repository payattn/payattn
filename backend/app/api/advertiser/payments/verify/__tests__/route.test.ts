/**
 * Tests for payment verification API (x402 protocol completion)
 * Focus on critical paths with simpler mocking
 */

import { NextRequest } from 'next/server';

// Mock Solana FIRST - need to create mock connection instance before module loads
const mockGetTransaction = jest.fn();
const mockConnection = {
  getTransaction: mockGetTransaction
};

jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn(() => mockConnection),
  PublicKey: jest.fn()
}));

jest.mock('@/lib/solana-escrow', () => ({
  verifyEscrow: jest.fn(),
}));

import { verifyEscrow } from '@/lib/solana-escrow';

// Setup Supabase mock
let mockQuery: any;
let mockSupabase: any;
let queryData: any = null;
let queryError: any = null;

mockQuery = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  then: (onfulfilled: any) => {
    return Promise.resolve({ data: queryData, error: queryError }).then(onfulfilled);
  }
};

mockSupabase = {
  from: jest.fn().mockReturnValue(mockQuery)
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

import { POST } from '../route';

describe('POST /api/advertiser/payments/verify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryData = null;
    queryError = null;
    mockGetTransaction.mockReset();
    
    (verifyEscrow as jest.Mock).mockReset();
    (verifyEscrow as jest.Mock).mockResolvedValue({
      valid: true,
      escrowPda: 'EscrowPDA123'
    });
  });
  
  describe('Request Validation', () => {
    it('should return 400 when offerId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/advertiser/payments/verify', {
        method: 'POST',
        body: JSON.stringify({ txSignature: 'sig123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: offerId, txSignature');
    });
    
    it('should return 400 when txSignature is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/advertiser/payments/verify', {
        method: 'POST',
        body: JSON.stringify({ offerId: 'offer_123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: offerId, txSignature');
    });
  });
  
  describe('Offer Validation', () => {
    it('should return 404 when offer not found', async () => {
      queryData = null;
      queryError = { message: 'Not found' };
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/payments/verify', {
        method: 'POST',
        body: JSON.stringify({ offerId: 'offer_999', txSignature: 'sig123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data.error).toBe('Offer not found');
    });
    
    it('should return 400 when offer status is wrong', async () => {
      queryData = {
        offer_id: 'offer_123',
        user_pubkey: 'UserWallet123',
        advertiser_id: 'adv_123',
        amount_lamports: 1000,
        status: 'pending'
      };
      queryError = null;
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/payments/verify', {
        method: 'POST',
        body: JSON.stringify({ offerId: 'offer_123', txSignature: 'sig123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid offer status: pending. Expected: accepted');
    });
  });
  
  describe('Transaction Verification', () => {
    it('should return 400 when transaction not found', async () => {
      queryData = {
        offer_id: 'offer_123',
        user_pubkey: 'UserWallet123',
        advertiser_id: 'adv_123',
        amount_lamports: 1000,
        status: 'accepted'
      };
      
      mockGetTransaction.mockResolvedValue(null);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/payments/verify', {
        method: 'POST',
        body: JSON.stringify({ offerId: 'offer_123', txSignature: 'sig123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Transaction not found on blockchain');
    });
    
    it('should return 400 when transaction failed', async () => {
      queryData = {
        offer_id: 'offer_123',
        user_pubkey: 'UserWallet123',
        advertiser_id: 'adv_123',
        amount_lamports: 1000,
        status: 'accepted'
      };
      
      mockGetTransaction.mockResolvedValue({
        meta: { err: { InstructionError: [0, 'Custom'] } }
      });
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/payments/verify', {
        method: 'POST',
        body: JSON.stringify({ offerId: 'offer_123', txSignature: 'sig123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Transaction failed on blockchain');
    });
    
    it('should return 400 when RPC throws error', async () => {
      queryData = {
        offer_id: 'offer_123',
        user_pubkey: 'UserWallet123',
        advertiser_id: 'adv_123',
        amount_lamports: 1000,
        status: 'accepted'
      };
      
      mockGetTransaction.mockRejectedValue(new Error('RPC timeout'));
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/payments/verify', {
        method: 'POST',
        body: JSON.stringify({ offerId: 'offer_123', txSignature: 'sig123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Failed to verify transaction');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle unexpected exceptions', async () => {
      mockSupabase.from = jest.fn(() => {
        throw new Error('Unexpected error');
      });
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/payments/verify', {
        method: 'POST',
        body: JSON.stringify({ offerId: 'offer_123', txSignature: 'sig123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Unexpected error');
    });
  });
});
