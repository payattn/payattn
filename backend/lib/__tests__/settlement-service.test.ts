import {
  settleWithPrivacy,
  retryFailedSettlements,
  getFailedSettlements
} from '../settlement-service';
import { settleUser, settlePublisher, settlePlatform } from '../solana-escrow';
import { getSupabase } from '../supabase';

jest.mock('../solana-escrow');
jest.mock('../supabase');

const mockSupabase = {
  from: jest.fn()
};

(getSupabase as jest.Mock).mockReturnValue(mockSupabase);
const mockSettleUser = settleUser as jest.MockedFunction<typeof settleUser>;
const mockSettlePublisher = settlePublisher as jest.MockedFunction<typeof settlePublisher>;
const mockSettlePlatform = settlePlatform as jest.MockedFunction<typeof settlePlatform>;

// Valid Solana public keys for testing
const TEST_USER_PUBKEY = '2ugGxUsedQTj4B9MRYwKxJbinGeekweFModqLaFqbVTa';
const TEST_PUBLISHER_PUBKEY = '9JCNNab2seSGi4teoq7ofnP5RkeQtbBiHqiU4vKWPyEF';
const TEST_PLATFORM_PUBKEY = 'H7dfsmgVXo3bLfkWLCd8KmyUqCiUi8n5qSasMYKWNp5T';

describe('settlement-service', () => {
  const originalEnv = process.env;
  const originalRandom = Math.random;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.SOLANA_PLATFORM_PUBKEY = TEST_PLATFORM_PUBKEY;
    Math.random = jest.fn().mockReturnValue(0);
  });

  afterEach(() => {
    process.env = originalEnv;
    Math.random = originalRandom;
  });

  describe('settleWithPrivacy', () => {
    it('should split amounts with 70/25/5 ratio', async () => {
      mockSupabase.from = jest.fn()
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: null, error: null })
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: null, error: null })
        });

      mockSettleUser.mockResolvedValue({ success: true, txSignature: 'user-sig' });
      mockSettlePublisher.mockResolvedValue({ success: true, txSignature: 'pub-sig' });
      mockSettlePlatform.mockResolvedValue({ success: true, txSignature: 'plat-sig' });

      const results = await settleWithPrivacy({
        offerId: 'offer-1',
        userPubkey: TEST_USER_PUBKEY,
        publisherPubkey: TEST_PUBLISHER_PUBKEY,
        amount: 1000
      });

      const userResult = results.find(r => r.type === 'user');
      const pubResult = results.find(r => r.type === 'publisher');
      const platResult = results.find(r => r.type === 'platform');

      expect(userResult?.amount).toBe(700);
      expect(pubResult?.amount).toBe(250);
      expect(platResult?.amount).toBe(50);
      expect(userResult!.amount + pubResult!.amount + platResult!.amount).toBe(1000);
    });

    it('should throw error if SOLANA_PLATFORM_PUBKEY not configured', async () => {
      delete process.env.SOLANA_PLATFORM_PUBKEY;

      await expect(settleWithPrivacy({
        offerId: 'offer-1',
        userPubkey: TEST_USER_PUBKEY,
        publisherPubkey: TEST_PUBLISHER_PUBKEY,
        amount: 1000
      })).rejects.toThrow('SOLANA_PLATFORM_PUBKEY not configured');
    });

    it('should mark offer as settling before transactions', async () => {
      let settlingUpdateCalled = false;

      mockSupabase.from = jest.fn()
        .mockReturnValueOnce({
          update: jest.fn((data) => {
            if (data.settling === true) {
              settlingUpdateCalled = true;
            }
            return {
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            };
          })
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: null, error: null })
        });

      mockSettleUser.mockResolvedValue({ success: true, txSignature: 'user-sig' });
      mockSettlePublisher.mockResolvedValue({ success: true, txSignature: 'pub-sig' });
      mockSettlePlatform.mockResolvedValue({ success: true, txSignature: 'plat-sig' });

      await settleWithPrivacy({
        offerId: 'offer-1',
        userPubkey: TEST_USER_PUBKEY,
        publisherPubkey: TEST_PUBLISHER_PUBKEY,
        amount: 1000
      });

      expect(settlingUpdateCalled).toBe(true);
    });

    it('should mark offer as settled when all transactions succeed', async () => {
      let settledData: any = null;

      mockSupabase.from = jest.fn()
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: null, error: null })
        })
        .mockReturnValueOnce({
          update: jest.fn((data) => {
            settledData = data;
            return {
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            };
          })
        });

      mockSettleUser.mockResolvedValue({ success: true, txSignature: 'user-sig' });
      mockSettlePublisher.mockResolvedValue({ success: true, txSignature: 'pub-sig' });
      mockSettlePlatform.mockResolvedValue({ success: true, txSignature: 'plat-sig' });

      await settleWithPrivacy({
        offerId: 'offer-1',
        userPubkey: TEST_USER_PUBKEY,
        publisherPubkey: TEST_PUBLISHER_PUBKEY,
        amount: 1000
      });

      expect(settledData.status).toBe('settled');
      expect(settledData.settling).toBe(false);
      expect(settledData.settled_at).toBeDefined();
    });

    it('should add failed transactions to retry queue', async () => {
      let queueInsert: any = null;

      mockSupabase.from = jest.fn()
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: null, error: null })
        })
        .mockReturnValueOnce({
          upsert: jest.fn((data) => {
            queueInsert = data;
            return Promise.resolve({ data: null, error: null });
          })
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: null, error: null })
        });

      mockSettleUser.mockResolvedValue({ success: true, txSignature: 'user-sig' });
      mockSettlePublisher.mockResolvedValue({ success: false, error: 'Network timeout' });
      mockSettlePlatform.mockResolvedValue({ success: true, txSignature: 'plat-sig' });

      await settleWithPrivacy({
        offerId: 'offer-1',
        userPubkey: TEST_USER_PUBKEY,
        publisherPubkey: TEST_PUBLISHER_PUBKEY,
        amount: 1000
      });

      expect(queueInsert.offer_id).toBe('offer-1');
      expect(queueInsert.tx_type).toBe('publisher');
      expect(queueInsert.recipient_pubkey).toBe(TEST_PUBLISHER_PUBKEY);
      expect(queueInsert.amount).toBe(250);
      expect(queueInsert.last_error).toBe('Network timeout');
    });

    it('should call settlement functions with correct parameters', async () => {
      mockSupabase.from = jest.fn()
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: null, error: null })
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: null, error: null })
        });

      mockSettleUser.mockResolvedValue({ success: true, txSignature: 'user-sig' });
      mockSettlePublisher.mockResolvedValue({ success: true, txSignature: 'pub-sig' });
      mockSettlePlatform.mockResolvedValue({ success: true, txSignature: 'plat-sig' });

      await settleWithPrivacy({
        offerId: 'offer-123',
        userPubkey: TEST_USER_PUBKEY,
        publisherPubkey: TEST_PUBLISHER_PUBKEY,
        amount: 1000
      });

      expect(mockSettleUser).toHaveBeenCalledWith('offer-123', TEST_USER_PUBKEY);
      expect(mockSettlePublisher).toHaveBeenCalledWith('offer-123', TEST_PUBLISHER_PUBKEY);
      expect(mockSettlePlatform).toHaveBeenCalledWith('offer-123', TEST_PLATFORM_PUBKEY);
    });

    it('should return all transaction results', async () => {
      mockSupabase.from = jest.fn()
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: null, error: null })
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: null, error: null })
        });

      mockSettleUser.mockResolvedValue({ success: true, txSignature: 'user-sig-abc' });
      mockSettlePublisher.mockResolvedValue({ success: true, txSignature: 'pub-sig-def' });
      mockSettlePlatform.mockResolvedValue({ success: true, txSignature: 'plat-sig-ghi' });

      const results = await settleWithPrivacy({
        offerId: 'offer-1',
        userPubkey: TEST_USER_PUBKEY,
        publisherPubkey: TEST_PUBLISHER_PUBKEY,
        amount: 1000
      });

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      
      const userResult = results.find(r => r.type === 'user');
      expect(userResult?.txSignature).toBe('user-sig-abc');
      expect(userResult?.amount).toBe(700);
    });
  });

  describe('retryFailedSettlements', () => {
    it('should not retry if no failed settlements', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      await retryFailedSettlements();

      expect(mockSettleUser).not.toHaveBeenCalled();
      expect(mockSettlePublisher).not.toHaveBeenCalled();
      expect(mockSettlePlatform).not.toHaveBeenCalled();
    });

    it('should retry user settlement', async () => {
      mockSupabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [{
              id: 1,
              offer_id: 'offer-1',
              tx_type: 'user',
              recipient_pubkey: TEST_USER_PUBKEY,
              amount: 700,
              attempts: 1
            }],
            error: null
          })
        })
        .mockReturnValueOnce({
          delete: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: null, error: null })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: [], error: null })
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: null, error: null })
        });

      mockSettleUser.mockResolvedValue({ success: true, txSignature: 'retry-sig' });

      await retryFailedSettlements();

      expect(mockSettleUser).toHaveBeenCalledWith('offer-1', TEST_USER_PUBKEY);
    });

    it('should increment attempts on failed retry', async () => {
      let updateData: any = null;

      mockSupabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [{
              id: 1,
              offer_id: 'offer-1',
              tx_type: 'user',
              recipient_pubkey: TEST_USER_PUBKEY,
              amount: 700,
              attempts: 3
            }],
            error: null
          })
        })
        .mockReturnValueOnce({
          update: jest.fn((data) => {
            updateData = data;
            return {
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            };
          })
        });

      mockSettleUser.mockResolvedValue({ success: false, error: 'Still failing' });

      await retryFailedSettlements();

      expect(updateData.attempts).toBe(4);
      expect(updateData.last_error).toBe('Still failing');
    });
  });

  describe('getFailedSettlements', () => {
    it('should return empty array when no failures', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await getFailedSettlements();

      expect(result).toEqual([]);
    });

    it('should return failed settlements with details', async () => {
      const mockData = [
        {
          id: 1,
          offer_id: 'offer-1',
          tx_type: 'user',
          amount: 700,
          attempts: 2
        }
      ];

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockData, error: null })
      });

      const result = await getFailedSettlements();

      expect(result).toEqual(mockData);
    });
  });
});
