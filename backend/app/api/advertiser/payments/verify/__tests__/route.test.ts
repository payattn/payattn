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

    it('should verify transaction and escrow successfully', async () => {
      // Mock offer lookup
      queryData = {
        offer_id: 'offer_123',
        status: 'accepted',  // Changed from 'pending' to 'accepted'
        amount_lamports: 1000000,
        user_pubkey: 'user_wallet_pubkey',
        advertiser_id: 'advertiser_123'
      };
      queryError = null;

      // Mock transaction verification (successful)
      mockGetTransaction.mockResolvedValue({
        meta: {
          err: null,
          fee: 5000
        },
        transaction: {
          message: {
            accountKeys: []
          }
        }
      });

      // Mock advertiser wallet lookup - need to create new mock chain
      const advertiserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            advertiser_id: 'advertiser_123',
            wallet_pubkey: 'advertiser_wallet_pubkey'
          },
          error: null
        })
      };
      
      // Mock update query for offer status
      const updateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: {},
          error: null
        })
      };

      // Setup mock to return different chains for different tables
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'offers') {
          // First call for offer lookup (already setup via queryData)
          // Second call for update
          if (mockSupabase.from.mock.calls.length > 1) {
            return updateQuery;
          }
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: queryData, error: queryError })
          };
        } else if (table === 'advertisers') {
          return advertiserQuery;
        }
        return {};
      });

      // Mock escrow verification
      const mockVerifyEscrow = verifyEscrow as jest.MockedFunction<typeof verifyEscrow>;
      mockVerifyEscrow.mockResolvedValue({
        valid: true,
        escrowPda: 'escrow_pda_address'
      });

      const request = new NextRequest('http://localhost:3000/api/advertiser/payments/verify', {
        method: 'POST',
        body: JSON.stringify({ 
          offerId: 'offer_123', 
          txSignature: 'valid_tx_signature',
          escrowPda: 'escrow_pda_address'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verified).toBe(true);
      expect(data.offerStatus).toBe('funded');
      expect(data.escrowPda).toBe('escrow_pda_address');
      expect(mockVerifyEscrow).toHaveBeenCalledWith(
        'offer_123',
        1000000,
        'user_wallet_pubkey',
        'advertiser_wallet_pubkey'
      );
    });

    it('should return 400 when advertiser wallet not found', async () => {
      // Mock offer lookup (success)
      queryData = {
        offer_id: 'offer_123',
        status: 'accepted',
        amount_lamports: 1000000,
        user_pubkey: 'user_wallet_pubkey',
        advertiser_id: 'advertiser_123'
      };
      queryError = null;

      // Mock transaction verification (successful)
      mockGetTransaction.mockResolvedValue({
        meta: { err: null },
        transaction: { message: { accountKeys: [] } }
      });

      // Mock advertiser wallet lookup (not found)
      const advertiserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      };

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'offers') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: queryData, error: queryError })
          };
        } else if (table === 'advertisers') {
          return advertiserQuery;
        }
        return {};
      });

      const request = new NextRequest('http://localhost:3000/api/advertiser/payments/verify', {
        method: 'POST',
        body: JSON.stringify({ offerId: 'offer_123', txSignature: 'sig123' })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Advertiser wallet not found');
    });

    it('should return 400 when escrow verification fails', async () => {
      // Mock offer lookup
      queryData = {
        offer_id: 'offer_123',
        status: 'accepted',
        amount_lamports: 1000000,
        user_pubkey: 'user_wallet_pubkey',
        advertiser_id: 'advertiser_123'
      };
      queryError = null;

      // Mock transaction verification (successful)
      mockGetTransaction.mockResolvedValue({
        meta: { err: null },
        transaction: { message: { accountKeys: [] } }
      });

      // Mock advertiser wallet lookup
      const advertiserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { wallet_pubkey: 'advertiser_wallet' },
          error: null
        })
      };

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'offers') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: queryData, error: queryError })
          };
        } else if (table === 'advertisers') {
          return advertiserQuery;
        }
        return {};
      });

      // Mock escrow verification (failed)
      const mockVerifyEscrow = verifyEscrow as jest.MockedFunction<typeof verifyEscrow>;
      mockVerifyEscrow.mockResolvedValue({
        valid: false,
        error: 'Escrow amount mismatch',
        escrowPda: 'invalid_pda'
      });

      const request = new NextRequest('http://localhost:3000/api/advertiser/payments/verify', {
        method: 'POST',
        body: JSON.stringify({ offerId: 'offer_123', txSignature: 'sig123' })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Escrow verification failed');
      expect(data.details).toBe('Escrow amount mismatch');
    });

    it('should return 500 when offer update fails', async () => {
      // Mock offer lookup
      queryData = {
        offer_id: 'offer_123',
        status: 'accepted',
        amount_lamports: 1000000,
        user_pubkey: 'user_wallet_pubkey',
        advertiser_id: 'advertiser_123'
      };
      queryError = null;

      // Mock transaction verification (successful)
      mockGetTransaction.mockResolvedValue({
        meta: { err: null },
        transaction: { message: { accountKeys: [] } }
      });

      // Mock advertiser wallet lookup
      const advertiserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { wallet_pubkey: 'advertiser_wallet' },
          error: null
        })
      };

      // Mock update query (failed)
      const updateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      };

      let fromCallCount = 0;
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'offers') {
          fromCallCount++;
          // First call is for offer lookup, second is for update
          if (fromCallCount === 1) {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: queryData, error: queryError })
            };
          } else {
            return updateQuery;
          }
        } else if (table === 'advertisers') {
          return advertiserQuery;
        }
        return {};
      });

      // Mock escrow verification (success)
      const mockVerifyEscrow = verifyEscrow as jest.MockedFunction<typeof verifyEscrow>;
      mockVerifyEscrow.mockResolvedValue({
        valid: true,
        escrowPda: 'escrow_pda'
      });

      const request = new NextRequest('http://localhost:3000/api/advertiser/payments/verify', {
        method: 'POST',
        body: JSON.stringify({ offerId: 'offer_123', txSignature: 'sig123' })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update offer status');
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
