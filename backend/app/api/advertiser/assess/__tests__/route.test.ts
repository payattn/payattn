/**
 * Tests for Peggy Assessment API
 * Tests the AI assessment engine for evaluating pending offers
 */

import { NextRequest } from 'next/server';

// Mock all Peggy modules
jest.mock('@/lib/peggy/database');
jest.mock('@/lib/peggy/llm-evaluator');
jest.mock('@/lib/peggy/escrow-funder');
jest.mock('@/lib/peggy/proof-validator');
jest.mock('@/lib/peggy/session-manager');

import { POST } from '../route';
import { DatabaseClient } from '@/lib/peggy/database';
import { LLMEvaluator } from '@/lib/peggy/llm-evaluator';
import { EscrowFunder } from '@/lib/peggy/escrow-funder';
import { validateOfferProofs } from '@/lib/peggy/proof-validator';
import { SessionManager } from '@/lib/peggy/session-manager';

// Mock fetch globally
global.fetch = jest.fn();

describe('POST /api/advertiser/assess', () => {
  let mockDb: jest.Mocked<DatabaseClient>;
  let mockLlm: jest.Mocked<LLMEvaluator>;
  let mockEscrow: jest.Mocked<EscrowFunder>;
  let mockSessionManager: jest.Mocked<SessionManager>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup DatabaseClient mock
    mockDb = {
      getAdvertiser: jest.fn(),
      getPendingOffersWithAds: jest.fn(),
      updateOfferStatus: jest.fn()
    } as any;
    (DatabaseClient as jest.Mock).mockImplementation(() => mockDb);
    
    // Setup LLMEvaluator mock
    mockLlm = {
      evaluateOffer: jest.fn()
    } as any;
    (LLMEvaluator as jest.Mock).mockImplementation(() => mockLlm);
    
    // Setup EscrowFunder mock
    mockEscrow = {
      fundEscrow: jest.fn()
    } as any;
    (EscrowFunder as jest.Mock).mockImplementation(() => mockEscrow);
    
    // Setup SessionManager mock
    mockSessionManager = {
      saveSession: jest.fn()
    } as any;
    (SessionManager as jest.Mock).mockImplementation(() => mockSessionManager);
    
    // Default mock implementations
    (validateOfferProofs as jest.Mock).mockResolvedValue({
      isValid: true,
      summary: 'All proofs valid',
      validProofs: ['age_proof', 'interest_proof'],
      invalidProofs: []
    });
    
    mockSessionManager.saveSession.mockReturnValue({
      sessionId: 'session_123',
      advertiserId: 'adv_123',
      timestamp: Date.now(),
      dateString: new Date().toISOString(),
      stats: {
        totalOffers: 1,
        accepted: 1,
        rejected: 0,
        funded: 0,
        errors: 0
      },
      results: []
    });
  });
  
  describe('Request Validation', () => {
    it('should return 400 when x-advertiser-id header is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess', {
        method: 'POST'
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing x-advertiser-id header');
    });
  });
  
  describe('No Pending Offers', () => {
    it('should return message when no pending offers found', async () => {
      mockDb.getPendingOffersWithAds.mockResolvedValue([]);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_123' }
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.message).toBe('No pending offers to assess');
      expect(data.advertiserId).toBe('adv_123');
      expect(data.stats).toEqual({
        totalOffers: 0,
        accepted: 0,
        rejected: 0,
        funded: 0,
        errors: 0
      });
    });
  });
  
  describe('Offer Processing - Rejection Cases', () => {
    it('should reject offer when ad creative is missing', async () => {
      const offer = {
        offer_id: 'offer_123',
        ad_id: 'ad_123',
        advertiser_id: 'adv_123',
        user_id: 'user_123',
        user_pubkey: 'UserWallet123',
        amount_lamports: 1000000,
        status: 'offer_made',
        zk_proofs: { age_proof: 'proof1' },
        ad_creative: null
      } as any;
      
      mockDb.getPendingOffersWithAds.mockResolvedValue([offer]);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_123' }
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      expect(mockLlm.evaluateOffer).not.toHaveBeenCalled();
      // Note: When ad_creative is null, it adds to results but doesn't update DB (continues to next offer)
      expect(mockDb.updateOfferStatus).not.toHaveBeenCalled();
    });
    
    it('should reject offer when LLM decides to reject', async () => {
      const offer = {
        offer_id: 'offer_123',
        ad_id: 'ad_123',
        advertiser_id: 'adv_123',
        user_id: 'user_123',
        user_pubkey: 'UserWallet123',
        amount_lamports: 1000000,
        status: 'offer_made',
        zk_proofs: { age_proof: 'proof1' },
        ad_creative: {
          headline: 'Test Ad',
          body: 'Test body',
          target_url: 'https://example.com'
        }
      } as any;
      
      mockDb.getPendingOffersWithAds.mockResolvedValue([offer]);
      mockLlm.evaluateOffer.mockResolvedValue({
        decision: 'reject',
        reasoning: 'User not in target demographic',
        confidence: 0.95
      });
      mockDb.updateOfferStatus.mockResolvedValue(undefined);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_123' }
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      expect(mockLlm.evaluateOffer).toHaveBeenCalledWith(
        offer,
        offer.ad_creative,
        expect.objectContaining({ isValid: true })
      );
      expect(mockDb.updateOfferStatus).toHaveBeenCalledWith('offer_123', 'rejected');
      expect(mockEscrow.fundEscrow).not.toHaveBeenCalled();
    });
  });
  
  describe('Offer Processing - Acceptance and Funding', () => {
    it('should accept and update status when LLM decides to accept (funding skipped in test)', async () => {
      const offer = {
        offer_id: 'offer_456',
        ad_id: 'ad_456',
        user_id: 'user_456',
        user_pubkey: 'UserWallet456',
        amount_lamports: 2000000,
        zk_proofs: { age_proof: 'proof2' },
        ad_creative: {
          headline: 'Great Product',
          body: 'Buy now',
          target_url: 'https://shop.example.com'
        }
      } as any;
      
      mockDb.getPendingOffersWithAds.mockResolvedValue([offer]);
      mockLlm.evaluateOffer.mockResolvedValue({
        decision: 'accept',
        reasoning: 'Perfect match for target audience',
        confidence: 0.98
      });
      mockDb.updateOfferStatus.mockResolvedValue(undefined);
      
      // Mock x402 accept endpoint
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 402,
        headers: new Map([
          ['x-offer-id', 'offer_456'],
          ['x-escrow-pda', 'EscrowPDA456'],
          ['x-payment-amount', '2000000'],
          ['x-user-pubkey', 'UserWallet456'],
          ['x-platform-pubkey', 'PlatformWallet'],
          ['x-escrow-program', 'EscrowProgram123']
        ]),
        get: function(key: string) { return this.headers.get(key); }
      } as any);
      
      // Mock escrow funding
      mockEscrow.fundEscrow.mockResolvedValue({
        success: true,
        txSignature: 'TxSig456'
      });
      
      // Mock payment verification endpoint
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200
      } as any);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_456' }
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      expect(mockLlm.evaluateOffer).toHaveBeenCalled();
      expect(mockDb.updateOfferStatus).toHaveBeenCalledWith('offer_456', 'accepted');
      expect(mockEscrow.fundEscrow).toHaveBeenCalled();
    });
    
    it('should handle funding failure gracefully', async () => {
      const offer = {
        offer_id: 'offer_789',
        ad_id: 'ad_789',
        user_id: 'user_789',
        user_pubkey: 'UserWallet789',
        amount_lamports: 3000000,
        zk_proofs: { age_proof: 'proof3' },
        ad_creative: {
          headline: 'Another Ad',
          body: 'Click here',
          target_url: 'https://example.com'
        }
      } as any;
      
      mockDb.getPendingOffersWithAds.mockResolvedValue([offer]);
      mockLlm.evaluateOffer.mockResolvedValue({
        decision: 'accept',
        reasoning: 'Good match',
        confidence: 0.9
      });
      mockDb.updateOfferStatus.mockResolvedValue(undefined);
      
      // Mock x402 accept endpoint failure
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 500
      } as any);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_789' }
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(200); // Assessment itself succeeds
      expect(mockDb.updateOfferStatus).toHaveBeenCalledWith('offer_789', 'accepted');
    });
  });
  
  describe('Proof Validation', () => {
    it('should validate ZK proofs for each offer', async () => {
      const offer = {
        offer_id: 'offer_proof',
        ad_id: 'ad_proof',
        user_id: 'user_proof',
        user_pubkey: 'UserWalletProof',
        amount_lamports: 500000,
        zk_proofs: { age_proof: 'proof_data' },
        ad_creative: {
          headline: 'Test',
          body: 'Test',
          target_url: 'https://test.com'
        }
      } as any;
      
      mockDb.getPendingOffersWithAds.mockResolvedValue([offer]);
      mockLlm.evaluateOffer.mockResolvedValue({
        decision: 'reject',
        reasoning: 'Test',
        confidence: 0.5
      });
      mockDb.updateOfferStatus.mockResolvedValue(undefined);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_proof' }
      });
      
      await POST(request);
      
      expect(validateOfferProofs).toHaveBeenCalledWith({ age_proof: 'proof_data' });
      expect(mockLlm.evaluateOffer).toHaveBeenCalledWith(
        offer,
        offer.ad_creative,
        expect.objectContaining({ isValid: true, summary: 'All proofs valid' })
      );
    });
  });
  
  describe('Session Management', () => {
    it('should save session with results and stats', async () => {
      const offer = {
        offer_id: 'offer_session',
        ad_id: 'ad_session',
        user_id: 'user_session',
        user_pubkey: 'UserWalletSession',
        amount_lamports: 1500000,
        zk_proofs: { age_proof: 'proof' },
        ad_creative: {
          headline: 'Session Test',
          body: 'Test',
          target_url: 'https://session.com'
        }
      } as any;
      
      mockDb.getPendingOffersWithAds.mockResolvedValue([offer]);
      mockLlm.evaluateOffer.mockResolvedValue({
        decision: 'reject',
        reasoning: 'Test rejection',
        confidence: 0.8
      });
      mockDb.updateOfferStatus.mockResolvedValue(undefined);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_session' }
      });
      
      await POST(request);
      
      expect(mockSessionManager.saveSession).toHaveBeenCalledWith(
        'adv_session',
        expect.arrayContaining([
          expect.objectContaining({
            offerId: 'offer_session',
            decision: 'reject'
          })
        ])
      );
    });
  });
  
  describe('Error Handling', () => {
    it('should handle offer processing errors gracefully', async () => {
      const offer = {
        offer_id: 'offer_error',
        ad_id: 'ad_error',
        user_id: 'user_error',
        user_pubkey: 'UserWalletError',
        amount_lamports: 1000000,
        zk_proofs: { age_proof: 'proof' },
        ad_creative: {
          headline: 'Error Test',
          body: 'Test',
          target_url: 'https://error.com'
        }
      } as any;
      
      mockDb.getPendingOffersWithAds.mockResolvedValue([offer]);
      (validateOfferProofs as jest.Mock).mockRejectedValue(new Error('Proof validation failed'));
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_error' }
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      expect(mockSessionManager.saveSession).toHaveBeenCalled();
    });
    
    it('should handle database errors when updating offer status', async () => {
      const offer = {
        offer_id: 'offer_db_error',
        ad_id: 'ad_db_error',
        user_id: 'user_db_error',
        user_pubkey: 'UserWalletDbError',
        amount_lamports: 800000,
        zk_proofs: { age_proof: 'proof' },
        ad_creative: {
          headline: 'DB Error Test',
          body: 'Test',
          target_url: 'https://dberror.com'
        }
      } as any;
      
      mockDb.getPendingOffersWithAds.mockResolvedValue([offer]);
      mockLlm.evaluateOffer.mockResolvedValue({
        decision: 'reject',
        reasoning: 'Test',
        confidence: 0.7
      });
      mockDb.updateOfferStatus.mockRejectedValue(new Error('Database update failed'));
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_db_error' }
      });
      
      const response = await POST(request);
      
      // Should still return 200 and save session despite DB error
      expect(response.status).toBe(200);
      expect(mockSessionManager.saveSession).toHaveBeenCalled();
    });
    
    it('should handle top-level exceptions', async () => {
      mockDb.getPendingOffersWithAds.mockRejectedValue(new Error('Database connection failed'));
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_fatal' }
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Assessment failed');
      expect(data.message).toBe('Database connection failed');
    });
    
    it('should handle non-Error exceptions', async () => {
      mockDb.getPendingOffersWithAds.mockRejectedValue('String error');
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_string_error' }
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Assessment failed');
      expect(data.message).toBe('Unknown error');
    });
  });
  
  describe('Advertiser Lookup', () => {
    it('should handle missing advertiser record gracefully', async () => {
      mockDb.getAdvertiser.mockRejectedValue(new Error('Advertiser not found'));
      mockDb.getPendingOffersWithAds.mockResolvedValue([]);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_missing' }
      });
      
      const response = await POST(request);
      
      // Should continue processing despite missing advertiser record
      expect(response.status).toBe(200);
      expect(mockDb.getPendingOffersWithAds).toHaveBeenCalledWith('adv_missing');
    });
  });
});
