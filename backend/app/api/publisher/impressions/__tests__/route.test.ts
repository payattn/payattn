import { POST } from '../route';
import { getSupabase } from '@/lib/supabase';
import { settleWithPrivacy } from '@/lib/settlement-service';
import { NextRequest } from 'next/server';

jest.mock('@/lib/supabase');
jest.mock('@/lib/settlement-service');

const mockSupabase = {
  from: jest.fn()
};

(getSupabase as jest.Mock).mockReturnValue(mockSupabase);
const mockSettleWithPrivacy = settleWithPrivacy as jest.MockedFunction<typeof settleWithPrivacy>;

describe('POST /api/publisher/impressions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Request Validation', () => {
    it('should reject requests without offerId', async () => {
      const request = {
        json: jest.fn().mockResolvedValue({
          publisherId: 'pub-123',
          duration: 2000
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: offerId, publisherId, duration');
    });

    it('should reject requests without publisherId', async () => {
      const request = {
        json: jest.fn().mockResolvedValue({
          offerId: 'offer-123',
          duration: 2000
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: offerId, publisherId, duration');
    });

    it('should reject requests without duration', async () => {
      const request = {
        json: jest.fn().mockResolvedValue({
          offerId: 'offer-123',
          publisherId: 'pub-123'
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: offerId, publisherId, duration');
    });

    it('should reject impressions with duration less than 1 second', async () => {
      const request = {
        json: jest.fn().mockResolvedValue({
          offerId: 'offer-123',
          publisherId: 'pub-123',
          duration: 500
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Duration too short');
      expect(data.minDuration).toBe(1000);
    });

    it('should accept impressions with exactly 1 second duration', async () => {
      mockSupabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              offer_id: 'offer-123',
              user_pubkey: 'user-wallet',
              amount_lamports: 1000,
              status: 'funded',
              ad_creative_id: 'ad-123'
            },
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              publisher_id: 'pub-123',
              wallet_address: 'pub-wallet',
              wallet_verified: true
            },
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { impressions_count: 0 },
            error: null
          })
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: null, error: null })
        });

      mockSettleWithPrivacy.mockResolvedValue([
        { type: 'user', success: true, txSignature: 'sig1', amount: 700 },
        { type: 'publisher', success: true, txSignature: 'sig2', amount: 250 },
        { type: 'platform', success: true, txSignature: 'sig3', amount: 50 }
      ]);

      const request = {
        json: jest.fn().mockResolvedValue({
          offerId: 'offer-123',
          publisherId: 'pub-123',
          duration: 1000
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.settled).toBe(true);
    });
  });

  describe('Offer Validation', () => {
    it('should return 404 for non-existent offer', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' }
        })
      });

      const request = {
        json: jest.fn().mockResolvedValue({
          offerId: 'nonexistent',
          publisherId: 'pub-123',
          duration: 2000
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Offer not found or not funded');
      expect(data.suggestion).toContain('escrow');
    });

    it('should reject offers that are not funded', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      });

      const request = {
        json: jest.fn().mockResolvedValue({
          offerId: 'unfunded-offer',
          publisherId: 'pub-123',
          duration: 2000
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Offer not found or not funded');
    });
  });

  describe('Publisher Validation', () => {
    it('should return 404 for non-existent publisher', async () => {
      let callCount = 0;
      mockSupabase.from = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                offer_id: 'offer-123',
                user_pubkey: 'user-wallet',
                amount_lamports: 1000,
                status: 'funded'
              },
              error: null
            })
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' }
          })
        };
      });

      const request = {
        json: jest.fn().mockResolvedValue({
          offerId: 'offer-123',
          publisherId: 'nonexistent',
          duration: 2000
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Publisher not found');
    });

    it('should reject publishers without wallet address', async () => {
      let callCount = 0;
      mockSupabase.from = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                offer_id: 'offer-123',
                user_pubkey: 'user-wallet',
                amount_lamports: 1000,
                status: 'funded'
              },
              error: null
            })
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              publisher_id: 'pub-123',
              wallet_address: null,
              wallet_verified: false
            },
            error: null
          })
        };
      });

      const request = {
        json: jest.fn().mockResolvedValue({
          offerId: 'offer-123',
          publisherId: 'pub-123',
          duration: 2000
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Publisher wallet not registered');
      expect(data.action).toContain('dashboard');
    });
  });

  describe('Impression Tracking', () => {
    it('should increment impression count for ad creative', async () => {
      let updateCalled = false;
      let updatedCount = 0;

      let callCount = 0;
      mockSupabase.from = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                offer_id: 'offer-123',
                user_pubkey: 'user-wallet',
                amount_lamports: 1000,
                status: 'funded',
                ad_creative_id: 'ad-123'
              },
              error: null
            })
          };
        } else if (callCount === 2) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                publisher_id: 'pub-123',
                wallet_address: 'pub-wallet',
                wallet_verified: true
              },
              error: null
            })
          };
        } else if (callCount === 3) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { impressions_count: 5 },
              error: null
            })
          };
        } else {
          return {
            update: jest.fn((data) => {
              updateCalled = true;
              updatedCount = data.impressions_count;
              return {
                eq: jest.fn().mockResolvedValue({ data: null, error: null })
              };
            })
          };
        }
      });

      mockSettleWithPrivacy.mockResolvedValue([
        { type: 'user', success: true, txSignature: 'sig1', amount: 700 },
        { type: 'publisher', success: true, txSignature: 'sig2', amount: 250 },
        { type: 'platform', success: true, txSignature: 'sig3', amount: 50 }
      ]);

      const request = {
        json: jest.fn().mockResolvedValue({
          offerId: 'offer-123',
          publisherId: 'pub-123',
          duration: 2000
        })
      } as unknown as NextRequest;

      await POST(request);

      expect(updateCalled).toBe(true);
      expect(updatedCount).toBe(6);
    });

    it('should handle missing ad_creative_id gracefully', async () => {
      let callCount = 0;
      mockSupabase.from = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                offer_id: 'offer-123',
                user_pubkey: 'user-wallet',
                amount_lamports: 1000,
                status: 'funded',
                ad_creative_id: null
              },
              error: null
            })
          };
        } else {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                publisher_id: 'pub-123',
                wallet_address: 'pub-wallet',
                wallet_verified: true
              },
              error: null
            })
          };
        }
      });

      mockSettleWithPrivacy.mockResolvedValue([
        { type: 'user', success: true, txSignature: 'sig1', amount: 700 },
        { type: 'publisher', success: true, txSignature: 'sig2', amount: 250 },
        { type: 'platform', success: true, txSignature: 'sig3', amount: 50 }
      ]);

      const request = {
        json: jest.fn().mockResolvedValue({
          offerId: 'offer-123',
          publisherId: 'pub-123',
          duration: 2000
        })
      } as unknown as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Settlement Processing', () => {
    it('should trigger settlement with correct parameters', async () => {
      let callCount = 0;
      mockSupabase.from = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                offer_id: 'offer-123',
                user_pubkey: 'user-wallet-pubkey',
                amount_lamports: 1000,
                status: 'funded',
                ad_creative_id: 'ad-123'
              },
              error: null
            })
          };
        } else if (callCount === 2) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                publisher_id: 'pub-123',
                wallet_address: 'publisher-wallet-pubkey',
                wallet_verified: true
              },
              error: null
            })
          };
        } else if (callCount === 3) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { impressions_count: 0 },
              error: null
            })
          };
        } else {
          return {
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: null, error: null })
          };
        }
      });

      mockSettleWithPrivacy.mockResolvedValue([
        { type: 'user', success: true, txSignature: 'sig1', amount: 700 },
        { type: 'publisher', success: true, txSignature: 'sig2', amount: 250 },
        { type: 'platform', success: true, txSignature: 'sig3', amount: 50 }
      ]);

      const request = {
        json: jest.fn().mockResolvedValue({
          offerId: 'offer-123',
          publisherId: 'pub-123',
          duration: 2000
        })
      } as unknown as NextRequest;

      await POST(request);

      expect(mockSettleWithPrivacy).toHaveBeenCalledWith({
        offerId: 'offer-123',
        userPubkey: 'user-wallet-pubkey',
        publisherPubkey: 'publisher-wallet-pubkey',
        amount: 1000
      });
    });

    it('should return success when all settlements succeed', async () => {
      let callCount = 0;
      mockSupabase.from = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                offer_id: 'offer-123',
                user_pubkey: 'user-wallet',
                amount_lamports: 1000,
                status: 'funded',
                ad_creative_id: 'ad-123'
              },
              error: null
            })
          };
        } else if (callCount === 2) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                publisher_id: 'pub-123',
                wallet_address: 'pub-wallet',
                wallet_verified: true
              },
              error: null
            })
          };
        } else if (callCount === 3) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { impressions_count: 0 },
              error: null
            })
          };
        } else {
          return {
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: null, error: null })
          };
        }
      });

      mockSettleWithPrivacy.mockResolvedValue([
        { type: 'user', success: true, txSignature: 'user-tx', amount: 700 },
        { type: 'publisher', success: true, txSignature: 'pub-tx', amount: 250 },
        { type: 'platform', success: true, txSignature: 'plat-tx', amount: 50 }
      ]);

      const request = {
        json: jest.fn().mockResolvedValue({
          offerId: 'offer-123',
          publisherId: 'pub-123',
          duration: 2000
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.settled).toBe(true);
      expect(data.message).toBe('Payment sent to all parties');
      expect(data.transactions).toHaveLength(3);
      expect(data.summary.user?.success).toBe(true);
      expect(data.summary.publisher?.success).toBe(true);
      expect(data.summary.platform?.success).toBe(true);
    });

    it('should handle partial settlement failures', async () => {
      let callCount = 0;
      mockSupabase.from = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                offer_id: 'offer-123',
                user_pubkey: 'user-wallet',
                amount_lamports: 1000,
                status: 'funded',
                ad_creative_id: 'ad-123'
              },
              error: null
            })
          };
        } else if (callCount === 2) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                publisher_id: 'pub-123',
                wallet_address: 'pub-wallet',
                wallet_verified: true
              },
              error: null
            })
          };
        } else if (callCount === 3) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { impressions_count: 0 },
              error: null
            })
          };
        } else {
          return {
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: null, error: null })
          };
        }
      });

      mockSettleWithPrivacy.mockResolvedValue([
        { type: 'user', success: true, txSignature: 'user-tx', amount: 700 },
        { type: 'publisher', success: false, error: 'Insufficient funds', amount: 250 },
        { type: 'platform', success: true, txSignature: 'plat-tx', amount: 50 }
      ]);

      const request = {
        json: jest.fn().mockResolvedValue({
          offerId: 'offer-123',
          publisherId: 'pub-123',
          duration: 2000
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.settled).toBe(false);
      expect(data.message).toContain('retry queue');
      expect(data.transactions[1]?.success).toBe(false);
    });

    it('should include explorer URLs in response', async () => {
      let callCount = 0;
      mockSupabase.from = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                offer_id: 'offer-123',
                user_pubkey: 'user-wallet',
                amount_lamports: 1000,
                status: 'funded',
                ad_creative_id: 'ad-123'
              },
              error: null
            })
          };
        } else if (callCount === 2) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                publisher_id: 'pub-123',
                wallet_address: 'pub-wallet',
                wallet_verified: true
              },
              error: null
            })
          };
        } else if (callCount === 3) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { impressions_count: 0 },
              error: null
            })
          };
        } else {
          return {
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: null, error: null })
          };
        }
      });

      mockSettleWithPrivacy.mockResolvedValue([
        { type: 'user', success: true, txSignature: 'user-tx-sig', amount: 700 },
        { type: 'publisher', success: true, txSignature: 'pub-tx-sig', amount: 250 },
        { type: 'platform', success: true, txSignature: 'plat-tx-sig', amount: 50 }
      ]);

      const request = {
        json: jest.fn().mockResolvedValue({
          offerId: 'offer-123',
          publisherId: 'pub-123',
          duration: 2000
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(data.transactions[0]?.explorerUrl).toContain('explorer.solana.com');
      expect(data.transactions[0]?.explorerUrl).toContain('user-tx-sig');
    });
  });

  describe('Error Handling', () => {
    it('should handle settlement service errors', async () => {
      let callCount = 0;
      mockSupabase.from = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                offer_id: 'offer-123',
                user_pubkey: 'user-wallet',
                amount_lamports: 1000,
                status: 'funded',
                ad_creative_id: 'ad-123'
              },
              error: null
            })
          };
        } else if (callCount === 2) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                publisher_id: 'pub-123',
                wallet_address: 'pub-wallet',
                wallet_verified: true
              },
              error: null
            })
          };
        } else if (callCount === 3) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { impressions_count: 0 },
              error: null
            })
          };
        } else {
          return {
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: null, error: null })
          };
        }
      });

      mockSettleWithPrivacy.mockRejectedValue(new Error('Network timeout'));

      const request = {
        json: jest.fn().mockResolvedValue({
          offerId: 'offer-123',
          publisherId: 'pub-123',
          duration: 2000
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Settlement failed');
      expect(data.message).toBe('Network timeout');
      expect(data.suggestion).toContain('retried');
    });

    it('should handle JSON parsing errors', async () => {
      const request = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Settlement failed');
    });
  });
});
