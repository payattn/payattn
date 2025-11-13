/**
 * Tests for single offer assessment API
 */

import { NextRequest } from 'next/server';
import { PublicKey } from '@solana/web3.js';

// Mock all dependencies BEFORE importing the route
jest.mock('@/lib/peggy/database');
jest.mock('@/lib/peggy/proof-validator');
jest.mock('@/lib/peggy/llm-evaluator');
jest.mock('@/lib/peggy/escrow-funder');
jest.mock('@/lib/solana-escrow', () => ({
  derivePDA: jest.fn()
}));

// Now import the route and other modules
import { POST } from '../route';
import { DatabaseClient } from '@/lib/peggy/database';
import { validateOfferProofs } from '@/lib/peggy/proof-validator';
import { LLMEvaluator } from '@/lib/peggy/llm-evaluator';
import { EscrowFunder } from '@/lib/peggy/escrow-funder';
import { derivePDA } from '@/lib/solana-escrow';

describe('POST /api/advertiser/assess/single', () => {
  let mockDb: jest.Mocked<DatabaseClient>;
  let mockLlmEvaluator: jest.Mocked<LLMEvaluator>;
  let mockEscrowFunder: jest.Mocked<EscrowFunder>;
  
  const mockOffer = {
    offer_id: 'offer_123',
    user_id: 'user_123',
    user_pubkey: 'UserWallet123',
    ad_id: 'ad_123',
    advertiser_id: 'adv_123',
    amount_lamports: 1000000,
    status: 'offer_made',
    zk_proofs: { age_proof: 'proof_data' },
    ad_creative: {
      ad_creative_id: 'ad_123',
      advertiser_id: 'adv_123',
      headline: 'Test Ad',
      body: 'Test body',
      destination_url: 'https://test.com',
      targeting: { age_range: '18-35' }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock DatabaseClient
    mockDb = {
      getPendingOffersWithAds: jest.fn(),
      updateOfferStatus: jest.fn()
    } as any;
    (DatabaseClient as jest.Mock).mockImplementation(() => mockDb);
    
    // Mock LLMEvaluator
    mockLlmEvaluator = {
      evaluateOffer: jest.fn()
    } as any;
    (LLMEvaluator as jest.Mock).mockImplementation(() => mockLlmEvaluator);
    
    // Mock EscrowFunder
    mockEscrowFunder = {
      fundEscrow: jest.fn()
    } as any;
    (EscrowFunder as jest.Mock).mockImplementation(() => mockEscrowFunder);
    
    // Mock validateOfferProofs
    (validateOfferProofs as jest.Mock).mockResolvedValue({
      allValid: true,
      summary: 'All proofs valid'
    });
    
    // Mock derivePDA with valid base58-encoded public key
    (derivePDA as jest.Mock).mockResolvedValue([
      new PublicKey('11111111111111111111111111111111'),
      255
    ]);
    
    // Set environment variable with valid base58 public keys
    process.env.SOLANA_PLATFORM_PUBKEY = '11111111111111111111111111111111';
    process.env.SOLANA_PROGRAM_ID = '11111111111111111111111111111111';
  });

  describe('Request Validation', () => {
    it('should return 400 when x-advertiser-id header is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess/single', {
        method: 'POST',
        body: JSON.stringify({ offerId: 'offer_123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('x-advertiser-id header required');
    });

    it('should return 400 when offerId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess/single', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_123' },
        body: JSON.stringify({})
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('offerId required in request body');
    });
  });

  describe('Offer Lookup', () => {
    it('should return 404 when offer not found', async () => {
      mockDb.getPendingOffersWithAds.mockResolvedValue([]);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess/single', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_123' },
        body: JSON.stringify({ offerId: 'offer_123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data.error).toBe('Offer not found or not pending');
    });

    it('should return 400 when offer missing ad creative data', async () => {
      const offerWithoutAd = { ...mockOffer, ad_creative: null };
      mockDb.getPendingOffersWithAds.mockResolvedValue([offerWithoutAd as any]);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess/single', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_123' },
        body: JSON.stringify({ offerId: 'offer_123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Offer missing ad creative data');
    });
  });

  describe('Offer Assessment - Rejection', () => {
    it('should reject offer and update status', async () => {
      mockDb.getPendingOffersWithAds.mockResolvedValue([mockOffer as any]);
      mockLlmEvaluator.evaluateOffer.mockResolvedValue({
        decision: 'reject',
        reasoning: 'Not a good match',
        confidence: 0.85
      });
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess/single', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_123' },
        body: JSON.stringify({ offerId: 'offer_123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.offerId).toBe('offer_123');
      expect(data.decision).toBe('reject');
      expect(data.reasoning).toBe('Not a good match');
      expect(data.confidence).toBe(0.85);
      expect(data.funded).toBeNull();
      
      expect(mockDb.updateOfferStatus).toHaveBeenCalledWith('offer_123', 'rejected');
      expect(mockEscrowFunder.fundEscrow).not.toHaveBeenCalled();
    });
  });

  describe('Offer Assessment - Acceptance without Funding', () => {
    it('should accept offer but not fund if escrow funding fails', async () => {
      mockDb.getPendingOffersWithAds.mockResolvedValue([mockOffer as any]);
      mockLlmEvaluator.evaluateOffer.mockResolvedValue({
        decision: 'accept',
        reasoning: 'Perfect match',
        confidence: 0.95
      });
      mockEscrowFunder.fundEscrow.mockResolvedValue({
        success: false,
        error: 'Insufficient funds',
        escrowPda: 'EscrowPDA111111111111111111111111111111111'
      });
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess/single', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_123' },
        body: JSON.stringify({ offerId: 'offer_123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.decision).toBe('accept');
      expect(data.funded).toEqual({
        success: false,
        escrowPda: 'EscrowPDA111111111111111111111111111111111',
        signature: undefined,
        error: 'Insufficient funds'
      });
      
      expect(mockDb.updateOfferStatus).toHaveBeenCalledWith('offer_123', 'accepted');
      expect(mockEscrowFunder.fundEscrow).toHaveBeenCalled();
    });

    it('should handle escrow funding exception', async () => {
      mockDb.getPendingOffersWithAds.mockResolvedValue([mockOffer as any]);
      mockLlmEvaluator.evaluateOffer.mockResolvedValue({
        decision: 'accept',
        reasoning: 'Good match',
        confidence: 0.90
      });
      mockEscrowFunder.fundEscrow.mockRejectedValue(new Error('Network error'));
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess/single', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_123' },
        body: JSON.stringify({ offerId: 'offer_123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.decision).toBe('accept');
      expect(data.funded).toEqual({
        success: false,
        error: 'Network error'
      });
    });

    it('should handle missing SOLANA_PLATFORM_PUBKEY', async () => {
      delete process.env.SOLANA_PLATFORM_PUBKEY;
      
      mockDb.getPendingOffersWithAds.mockResolvedValue([mockOffer as any]);
      mockLlmEvaluator.evaluateOffer.mockResolvedValue({
        decision: 'accept',
        reasoning: 'Good match',
        confidence: 0.90
      });
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess/single', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_123' },
        body: JSON.stringify({ offerId: 'offer_123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.decision).toBe('accept');
      expect(data.funded).toEqual({
        success: false,
        error: 'SOLANA_PLATFORM_PUBKEY not configured in environment'
      });
      
      // Restore for other tests
      process.env.SOLANA_PLATFORM_PUBKEY = 'PlatformPubkey111111111111111111111111111';
    });
  });

  describe('Offer Assessment - Acceptance with Successful Funding', () => {
    it('should accept offer and fund escrow successfully', async () => {
      mockDb.getPendingOffersWithAds.mockResolvedValue([mockOffer as any]);
      mockLlmEvaluator.evaluateOffer.mockResolvedValue({
        decision: 'accept',
        reasoning: 'Perfect match',
        confidence: 0.95
      });
      mockEscrowFunder.fundEscrow.mockResolvedValue({
        success: true,
        escrowPda: 'EscrowPDA111111111111111111111111111111111',
        txSignature: 'TxSignature123'
      });
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess/single', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_123' },
        body: JSON.stringify({ offerId: 'offer_123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.offerId).toBe('offer_123');
      expect(data.decision).toBe('accept');
      expect(data.reasoning).toBe('Perfect match');
      expect(data.confidence).toBe(0.95);
      expect(data.userWallet).toBe('UserWallet123');
      expect(data.amountSOL).toBe(0.001);
      expect(data.adHeadline).toBe('Test Ad');
      expect(data.funded).toEqual({
        success: true,
        escrowPda: 'EscrowPDA111111111111111111111111111111111',
        signature: 'TxSignature123',
        error: undefined
      });
      
      expect(mockDb.updateOfferStatus).toHaveBeenCalledWith('offer_123', 'accepted');
      expect(mockEscrowFunder.fundEscrow).toHaveBeenCalledWith({
        offerId: 'offer_123',
        escrowPda: '11111111111111111111111111111111',
        paymentAmount: 1000000,
        userPubkey: 'UserWallet123',
        platformPubkey: '11111111111111111111111111111111',
        programId: '11111111111111111111111111111111'
      });
    });

    it('should accept offer and handle idempotent escrow funding (already funded)', async () => {
      mockDb.getPendingOffersWithAds.mockResolvedValue([mockOffer as any]);
      mockLlmEvaluator.evaluateOffer.mockResolvedValue({
        decision: 'accept',
        reasoning: 'Perfect match',
        confidence: 0.95
      });
      // No txSignature means already funded (idempotent)
      mockEscrowFunder.fundEscrow.mockResolvedValue({
        success: true,
        escrowPda: 'EscrowPDA111111111111111111111111111111111'
      });
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess/single', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_123' },
        body: JSON.stringify({ offerId: 'offer_123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.funded).toEqual({
        success: true,
        escrowPda: 'EscrowPDA111111111111111111111111111111111',
        signature: undefined,
        error: undefined
      });
    });
  });

  describe('Proof Validation', () => {
    it('should include proof validation results in response', async () => {
      const proofValidation = {
        allValid: true,
        summary: '2 proofs validated',
        details: {
          age_proof: { valid: true },
          location_proof: { valid: true }
        }
      };
      
      mockDb.getPendingOffersWithAds.mockResolvedValue([mockOffer as any]);
      (validateOfferProofs as jest.Mock).mockResolvedValue(proofValidation);
      mockLlmEvaluator.evaluateOffer.mockResolvedValue({
        decision: 'reject',
        reasoning: 'Test',
        confidence: 0.5
      });
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess/single', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_123' },
        body: JSON.stringify({ offerId: 'offer_123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.proofValidation).toEqual(proofValidation);
      expect(mockLlmEvaluator.evaluateOffer).toHaveBeenCalledWith(
        mockOffer,
        mockOffer.ad_creative,
        proofValidation
      );
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when database throws error', async () => {
      mockDb.getPendingOffersWithAds.mockRejectedValue(new Error('Database error'));
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess/single', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_123' },
        body: JSON.stringify({ offerId: 'offer_123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(data.details).toBe('Database error');
    });

    it('should return 500 when LLM evaluator throws error', async () => {
      mockDb.getPendingOffersWithAds.mockResolvedValue([mockOffer as any]);
      mockLlmEvaluator.evaluateOffer.mockRejectedValue(new Error('LLM service unavailable'));
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess/single', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_123' },
        body: JSON.stringify({ offerId: 'offer_123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(data.details).toBe('LLM service unavailable');
    });

    it('should return 500 when updateOfferStatus throws error', async () => {
      mockDb.getPendingOffersWithAds.mockResolvedValue([mockOffer as any]);
      mockLlmEvaluator.evaluateOffer.mockResolvedValue({
        decision: 'reject',
        reasoning: 'Test',
        confidence: 0.5
      });
      mockDb.updateOfferStatus.mockRejectedValue(new Error('Database write failed'));
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess/single', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_123' },
        body: JSON.stringify({ offerId: 'offer_123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(data.details).toBe('Database write failed');
    });

    it('should handle non-Error exceptions', async () => {
      mockDb.getPendingOffersWithAds.mockRejectedValue('String error');
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/assess/single', {
        method: 'POST',
        headers: { 'x-advertiser-id': 'adv_123' },
        body: JSON.stringify({ offerId: 'offer_123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(data.details).toBe('Unknown error');
    });
  });
});
