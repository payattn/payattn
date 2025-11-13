import { POST } from '../route';
import { getSupabase } from '@/lib/supabase';
import { NextRequest } from 'next/server';

jest.mock('@/lib/supabase');

const mockSupabase = {
  from: jest.fn()
};

(getSupabase as jest.Mock).mockReturnValue(mockSupabase);

describe('POST /api/user/offer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DATABASE_MODE = 'test';
  });

  describe('Request Validation', () => {
    it('should reject requests without x-user-id header', async () => {
      const request = {
        headers: {
          get: jest.fn().mockReturnValue(null)
        },
        json: jest.fn()
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing x-user-id header');
    });

    it('should reject requests without ad_creative_id', async () => {
      const request = {
        headers: {
          get: jest.fn().mockReturnValue('test-user-id')
        },
        json: jest.fn().mockResolvedValue({
          amount_lamports: 1000
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: ad_creative_id, amount_lamports');
    });

    it('should reject requests without amount_lamports', async () => {
      const request = {
        headers: {
          get: jest.fn().mockReturnValue('test-user-id')
        },
        json: jest.fn().mockResolvedValue({
          ad_creative_id: 'test-ad-id'
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: ad_creative_id, amount_lamports');
    });
  });

  describe('Ad Creative Validation', () => {
    it('should return 404 for non-existent ad creative', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
      };
      mockSupabase.from.mockReturnValue(mockFrom);

      const request = {
        headers: {
          get: jest.fn().mockReturnValue('test-user-id')
        },
        json: jest.fn().mockResolvedValue({
          ad_creative_id: 'nonexistent-ad',
          amount_lamports: 1000
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Ad creative not found or inactive');
    });

    it('should reject ads with exhausted budget', async () => {
      const mockFrom = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'test-ad',
              advertiser_id: 'advertiser-1',
              ad_creative_id: 'ad-123',
              total_budget_lamports: 10000,
              spent_lamports: 10000,
              status: 'active'
            },
            error: null
          })
        });
      
      mockSupabase.from = mockFrom;

      const request = {
        headers: {
          get: jest.fn().mockReturnValue('test-user-id')
        },
        json: jest.fn().mockResolvedValue({
          ad_creative_id: 'test-ad',
          amount_lamports: 1000
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Ad creative budget exhausted');
    });
  });

  describe('User Management', () => {
    it('should create offer for existing user', async () => {
      const mockAdCreative = {
        id: 'test-ad',
        advertiser_id: 'advertiser-1',
        ad_creative_id: 'ad-123',
        total_budget_lamports: 100000,
        spent_lamports: 5000,
        status: 'active'
      };

      const mockUser = {
        user_id: 'user-123',
        wallet_pubkey: 'test-user-id'
      };

      const mockOffer = {
        offer_id: 'offer-123',
        user_id: 'user-123',
        amount_lamports: 1000,
        status: 'offer_made'
      };

      let callCount = 0;
      mockSupabase.from = jest.fn((table) => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockAdCreative, error: null })
          };
        } else if (callCount === 2) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockUser, error: null })
          };
        } else if (callCount === 3) {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockOffer, error: null })
          };
        } else {
          return {
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: null, error: null })
          };
        }
      });

      const request = {
        headers: {
          get: jest.fn().mockReturnValue('test-user-id')
        },
        json: jest.fn().mockResolvedValue({
          ad_creative_id: 'test-ad',
          amount_lamports: 1000,
          zk_proofs: {
            age: { proof: {}, publicSignals: [], circuitName: 'age_range' }
          }
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.status).toBe('offer_made');
    });

    it('should create new user if not exists', async () => {
      const mockAdCreative = {
        id: 'test-ad',
        advertiser_id: 'advertiser-1',
        ad_creative_id: 'ad-123',
        total_budget_lamports: 100000,
        spent_lamports: 5000,
        status: 'active'
      };

      const mockNewUser = {
        user_id: 'user-new-123',
        wallet_pubkey: 'new-user-wallet'
      };

      const mockOffer = {
        offer_id: 'offer-123',
        user_id: 'user-new-123',
        amount_lamports: 1000,
        status: 'offer_made'
      };

      let callCount = 0;
      mockSupabase.from = jest.fn((table) => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockAdCreative, error: null })
          };
        } else if (callCount === 2) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
          };
        } else if (callCount === 3) {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockNewUser, error: null })
          };
        } else if (callCount === 4) {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockOffer, error: null })
          };
        } else {
          return {
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: null, error: null })
          };
        }
      });

      const request = {
        headers: {
          get: jest.fn().mockReturnValue('new-user-wallet')
        },
        json: jest.fn().mockResolvedValue({
          ad_creative_id: 'test-ad',
          amount_lamports: 1000
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle user creation failure', async () => {
      const mockAdCreative = {
        id: 'test-ad',
        advertiser_id: 'advertiser-1',
        ad_creative_id: 'ad-123',
        total_budget_lamports: 100000,
        spent_lamports: 5000,
        status: 'active'
      };

      let callCount = 0;
      mockSupabase.from = jest.fn((table) => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockAdCreative, error: null })
          };
        } else if (callCount === 2) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
          };
        } else {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ 
              data: null, 
              error: { message: 'Database error' } 
            })
          };
        }
      });

      const request = {
        headers: {
          get: jest.fn().mockReturnValue('new-user-wallet')
        },
        json: jest.fn().mockResolvedValue({
          ad_creative_id: 'test-ad',
          amount_lamports: 1000
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create user');
    });
  });

  describe('Offer Creation', () => {
    it('should include zk_proofs in offer data', async () => {
      const zkProofs = {
        age: { proof: { pi_a: [] }, publicSignals: ['1'], circuitName: 'age_range' },
        location: { proof: { pi_a: [] }, publicSignals: ['1'], circuitName: 'set_membership' }
      };

      const mockAdCreative = {
        id: 'test-ad',
        advertiser_id: 'advertiser-1',
        ad_creative_id: 'ad-123',
        total_budget_lamports: 100000,
        spent_lamports: 5000,
        status: 'active'
      };

      const mockUser = {
        user_id: 'user-123',
        wallet_pubkey: 'test-wallet'
      };

      let insertedData: any = null;

      let callCount = 0;
      mockSupabase.from = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockAdCreative, error: null })
          };
        } else if (callCount === 2) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockUser, error: null })
          };
        } else if (callCount === 3) {
          return {
            insert: jest.fn((data) => {
              insertedData = data;
              return {
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ 
                  data: { ...data, offer_id: 'offer-123' }, 
                  error: null 
                })
              };
            })
          };
        } else {
          return {
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: null, error: null })
          };
        }
      });

      const request = {
        headers: {
          get: jest.fn().mockReturnValue('test-wallet')
        },
        json: jest.fn().mockResolvedValue({
          ad_creative_id: 'test-ad',
          amount_lamports: 1000,
          zk_proofs: zkProofs
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(insertedData?.zk_proofs).toEqual(zkProofs);
    });

    it('should handle offer creation successfully with budget update', async () => {
      const mockAdCreative = {
        id: 'test-ad',
        advertiser_id: 'advertiser-1',
        ad_creative_id: 'ad-123',
        total_budget_lamports: 100000,
        spent_lamports: 5000,
        status: 'active'
      };

      const mockUser = {
        user_id: 'user-123',
        wallet_pubkey: 'test-wallet'
      };

      const mockOffer = {
        offer_id: 'offer-123',
        user_id: 'user-123',
        amount_lamports: 2000,
        status: 'offer_made'
      };

      let callCount = 0;
      mockSupabase.from = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          // First call: ad creative lookup
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockAdCreative, error: null })
          };
        } else if (callCount === 2) {
          // Second call: user lookup
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockUser, error: null })
          };
        } else if (callCount === 3) {
          // Third call: offer insert
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ 
              data: mockOffer, 
              error: null 
            })
          };
        } else {
          // Fourth call: update ad creative budget
          return {
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: null, error: null })
          };
        }
      });

      const request = {
        headers: {
          get: jest.fn().mockReturnValue('test-wallet')
        },
        json: jest.fn().mockResolvedValue({
          ad_creative_id: 'test-ad',
          amount_lamports: 2000
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.amount_lamports).toBe(2000);
    });

    it('should return next steps in response', async () => {
      const mockAdCreative = {
        id: 'test-ad',
        advertiser_id: 'advertiser-1',
        ad_creative_id: 'ad-123',
        total_budget_lamports: 100000,
        spent_lamports: 5000,
        status: 'active'
      };

      const mockUser = {
        user_id: 'user-123',
        wallet_pubkey: 'test-wallet'
      };

      let callCount = 0;
      mockSupabase.from = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockAdCreative, error: null })
          };
        } else if (callCount === 2) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockUser, error: null })
          };
        } else if (callCount === 3) {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ 
              data: { offer_id: 'offer-123' }, 
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

      const request = {
        headers: {
          get: jest.fn().mockReturnValue('test-wallet')
        },
        json: jest.fn().mockResolvedValue({
          ad_creative_id: 'test-ad',
          amount_lamports: 1000
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(data.next_steps).toBeDefined();
      expect(Array.isArray(data.next_steps)).toBe(true);
      expect(data.next_steps.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors during offer creation', async () => {
      const mockAdCreative = {
        id: 'test-ad',
        advertiser_id: 'advertiser-1',
        ad_creative_id: 'ad-123',
        total_budget_lamports: 100000,
        spent_lamports: 5000,
        status: 'active'
      };

      const mockUser = {
        user_id: 'user-123',
        wallet_pubkey: 'test-wallet'
      };

      let callCount = 0;
      mockSupabase.from = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockAdCreative, error: null })
          };
        } else if (callCount === 2) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockUser, error: null })
          };
        } else {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ 
              data: null, 
              error: { message: 'Insert failed' } 
            })
          };
        }
      });

      const request = {
        headers: {
          get: jest.fn().mockReturnValue('test-wallet')
        },
        json: jest.fn().mockResolvedValue({
          ad_creative_id: 'test-ad',
          amount_lamports: 1000
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create offer');
    });

    it('should handle JSON parsing errors', async () => {
      const request = {
        headers: {
          get: jest.fn().mockReturnValue('test-wallet')
        },
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create offer');
    });
  });
});
