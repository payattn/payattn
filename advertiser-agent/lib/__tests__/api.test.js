import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { BackendClient } from '../api.js';

// Mock config
jest.mock('../../config.js', () => ({
  config: {
    apiUrl: 'http://localhost:3000',
    advertiserId: 'test-advertiser-123'
  }
}));

// Mock global fetch
global.fetch = jest.fn();

describe('BackendClient', () => {
  let client;

  beforeEach(() => {
    client = new BackendClient();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with config values', () => {
      expect(client.baseUrl).toBeDefined();
      expect(client.advertiserId).toBeDefined();
    });
  });

  describe('fetchPendingOffers', () => {
    test('should fetch offers successfully', async () => {
      const mockOffers = [
        { id: 'offer-1', status: 'offer_made' },
        { id: 'offer-2', status: 'offer_made' }
      ];

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ offers: mockOffers })
      });

      const result = await client.fetchPendingOffers();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/advertiser/offers?status=offer_made&advertiser_id=')
      );
      expect(result).toEqual(mockOffers);
    });

    test('should return empty array when response has no offers', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({})
      });

      const result = await client.fetchPendingOffers();

      expect(result).toEqual([]);
    });

    test('should handle HTTP errors gracefully', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await client.fetchPendingOffers();

      expect(result).toEqual([]);
    });

    test('should handle fetch exceptions', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = await client.fetchPendingOffers();

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching offers:', 'Network error');
      
      consoleSpy.mockRestore();
    });

    test('should handle null offers in response', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ offers: null })
      });

      const result = await client.fetchPendingOffers();

      expect(result).toEqual([]);
    });
  });

  describe('acceptOffer', () => {
    test('should accept offer with valid 402 response', async () => {
      const mockHeaders = new Map([
        ['x-offer-id', 'offer-123'],
        ['x-escrow-pda', 'escrow-pda-address'],
        ['x-payment-amount', '1000000'],
        ['x-user-pubkey', 'user-pubkey-123'],
        ['x-platform-pubkey', 'platform-pubkey-123'],
        ['x-escrow-program', 'program-id-123'],
        ['x-verification-endpoint', 'http://localhost:3000/verify'],
        ['x-payment-chain', 'solana'],
        ['x-payment-network', 'devnet']
      ]);

      global.fetch.mockResolvedValue({
        status: 402,
        headers: {
          get: (key) => mockHeaders.get(key)
        }
      });

      const result = await client.acceptOffer('offer-123');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/advertiser/offers/offer-123/accept'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }
      );

      expect(result).toEqual({
        offerId: 'offer-123',
        escrowPda: 'escrow-pda-address',
        paymentAmount: 1000000,
        userPubkey: 'user-pubkey-123',
        platformPubkey: 'platform-pubkey-123',
        programId: 'program-id-123',
        verificationEndpoint: 'http://localhost:3000/verify',
        paymentChain: 'solana',
        paymentNetwork: 'devnet'
      });
    });

    test('should reject non-402 responses', async () => {
      global.fetch.mockResolvedValue({
        status: 200,
        json: async () => ({ error: 'Invalid request' })
      });

      await expect(client.acceptOffer('offer-123'))
        .rejects
        .toThrow('Expected 402, got 200: Invalid request');
    });

    test('should reject non-402 responses without error message', async () => {
      global.fetch.mockResolvedValue({
        status: 500,
        json: async () => ({})
      });

      await expect(client.acceptOffer('offer-123'))
        .rejects
        .toThrow('Expected 402, got 500: Unknown error');
    });

    test('should validate required x402 headers', async () => {
      const mockHeaders = new Map([
        ['x-offer-id', 'offer-123']
        // Missing required headers
      ]);

      global.fetch.mockResolvedValue({
        status: 402,
        headers: {
          get: (key) => mockHeaders.get(key)
        }
      });

      await expect(client.acceptOffer('offer-123'))
        .rejects
        .toThrow('Invalid x402 response - missing required headers');
    });

    test('should validate escrowPda header', async () => {
      const mockHeaders = new Map([
        ['x-offer-id', 'offer-123'],
        ['x-payment-amount', '1000000']
        // Missing escrowPda
      ]);

      global.fetch.mockResolvedValue({
        status: 402,
        headers: {
          get: (key) => mockHeaders.get(key)
        }
      });

      await expect(client.acceptOffer('offer-123'))
        .rejects
        .toThrow('Invalid x402 response - missing required headers');
    });

    test('should validate paymentAmount header', async () => {
      const mockHeaders = new Map([
        ['x-offer-id', 'offer-123'],
        ['x-escrow-pda', 'escrow-pda-address']
        // Missing paymentAmount
      ]);

      global.fetch.mockResolvedValue({
        status: 402,
        headers: {
          get: (key) => mockHeaders.get(key)
        }
      });

      await expect(client.acceptOffer('offer-123'))
        .rejects
        .toThrow('Invalid x402 response - missing required headers');
    });
  });

  describe('submitPaymentProof', () => {
    test('should submit payment proof successfully', async () => {
      const mockVerification = {
        verified: true,
        message: 'Payment verified'
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockVerification
      });

      const result = await client.submitPaymentProof('offer-123', 'tx-signature-abc');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/advertiser/payments/verify'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            offerId: 'offer-123',
            txSignature: 'tx-signature-abc'
          })
        }
      );

      expect(result).toEqual(mockVerification);
    });

    test('should handle verification failures', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Invalid signature' })
      });

      await expect(client.submitPaymentProof('offer-123', 'invalid-sig'))
        .rejects
        .toThrow('Payment verification failed: Invalid signature');
    });

    test('should handle verification failures without error message', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({})
      });

      await expect(client.submitPaymentProof('offer-123', 'tx-sig'))
        .rejects
        .toThrow('Payment verification failed: Unknown error');
    });

    test('should handle network errors during verification', async () => {
      global.fetch.mockRejectedValue(new Error('Connection timeout'));

      await expect(client.submitPaymentProof('offer-123', 'tx-sig'))
        .rejects
        .toThrow('Connection timeout');
    });

    test('should submit correct payload format', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ verified: true })
      });

      await client.submitPaymentProof('offer-456', 'sig-xyz-789');

      const callArgs = global.fetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body).toEqual({
        offerId: 'offer-456',
        txSignature: 'sig-xyz-789'
      });
    });
  });
});
