import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { processProof, processProofBatch, PendingProof } from '../proof-queue-processor';

// Mock the verifier
jest.mock('../verifier', () => ({
  verifyProof: jest.fn()
}));

// Mock hashing for set membership validation
jest.mock('../hashing', () => ({
  hashAndPadSet: jest.fn((values: string[]) => values.map(() => '123'))
}));

import { verifyProof } from '../verifier';

const mockVerifyProof = verifyProof as jest.MockedFunction<typeof verifyProof>;

describe('Proof Queue Processor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('processProof', () => {
    test('should process valid proof without campaign requirements', async () => {
      const pendingProof: PendingProof = {
        id: 'proof-1',
        userId: 'user-1',
        campaignId: 'campaign-1',
        circuitName: 'age_range',
        proof: { pi_a: ['1'], pi_b: [[]], pi_c: ['1'] },
        publicSignals: ['1', '18', '65'],
        createdAt: new Date()
      };

      mockVerifyProof.mockResolvedValue({
        valid: true,
        circuitName: 'age_range',
        publicSignals: ['1', '18', '65'],
        message: 'Proof verified',
        timestamp: Date.now()
      });

      const result = await processProof(pendingProof);

      expect(result.verified).toBe(true);
      expect(result.proofId).toBe('proof-1');
      expect(result.userId).toBe('user-1');
      expect(result.campaignId).toBe('campaign-1');
      expect(result.result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should process invalid proof', async () => {
      const pendingProof: PendingProof = {
        id: 'proof-2',
        userId: 'user-2',
        campaignId: 'campaign-2',
        circuitName: 'age_range',
        proof: { invalid: 'proof' },
        publicSignals: [],
        createdAt: new Date()
      };

      mockVerifyProof.mockResolvedValue({
        valid: false,
        circuitName: 'age_range',
        publicSignals: [],
        message: 'Invalid proof',
        timestamp: Date.now()
      });

      const result = await processProof(pendingProof);

      expect(result.verified).toBe(false);
      expect(result.result.valid).toBe(false);
      expect(result.result.message).toBe('Invalid proof');
    });

    test('should validate age_range campaign requirements', async () => {
      const pendingProof: PendingProof = {
        id: 'proof-3',
        userId: 'user-3',
        campaignId: 'campaign-3',
        circuitName: 'age_range',
        proof: { pi_a: ['1'], pi_b: [[]], pi_c: ['1'] },
        publicSignals: ['1', '18', '65'],
        createdAt: new Date(),
        campaignRequirements: {
          min: 18,
          max: 65
        }
      };

      mockVerifyProof.mockResolvedValue({
        valid: true,
        circuitName: 'age_range',
        publicSignals: ['1', '18', '65'],
        message: 'Proof verified',
        timestamp: Date.now()
      });

      const result = await processProof(pendingProof);

      expect(result.verified).toBe(true);
      expect(result.result.message).toBe('Proof verified');
    });

    test('should reject proof when campaign requirements dont match', async () => {
      const pendingProof: PendingProof = {
        id: 'proof-4',
        userId: 'user-4',
        campaignId: 'campaign-4',
        circuitName: 'age_range',
        proof: { pi_a: ['1'], pi_b: [[]], pi_c: ['1'] },
        publicSignals: ['1', '18', '65'],
        createdAt: new Date(),
        campaignRequirements: {
          min: 25,
          max: 45
        }
      };

      mockVerifyProof.mockResolvedValue({
        valid: true,
        circuitName: 'age_range',
        publicSignals: ['1', '18', '65'],
        message: 'Proof verified',
        timestamp: Date.now()
      });

      const result = await processProof(pendingProof);

      expect(result.verified).toBe(false);
      expect(result.result.message).toContain("don't match campaign requirements");
      expect(result.result.message).toContain('Expected [25, 45]');
      expect(result.result.message).toContain('got [18, 65]');
    });

    test('should validate range_check campaign requirements', async () => {
      const pendingProof: PendingProof = {
        id: 'proof-5',
        userId: 'user-5',
        campaignId: 'campaign-5',
        circuitName: 'range_check',
        proof: { pi_a: ['1'], pi_b: [[]], pi_c: ['1'] },
        publicSignals: ['1', '10', '100'],
        createdAt: new Date(),
        campaignRequirements: {
          min: 10,
          max: 100
        }
      };

      mockVerifyProof.mockResolvedValue({
        valid: true,
        circuitName: 'range_check',
        publicSignals: ['1', '10', '100'],
        message: 'Proof verified',
        timestamp: Date.now()
      });

      const result = await processProof(pendingProof);

      expect(result.verified).toBe(true);
    });

    test('should validate set_membership campaign requirements', async () => {
      const pendingProof: PendingProof = {
        id: 'proof-6',
        userId: 'user-6',
        campaignId: 'campaign-6',
        circuitName: 'set_membership',
        proof: { pi_a: ['1'], pi_b: [[]], pi_c: ['1'] },
        publicSignals: ['1', '123', '123', '123'],
        createdAt: new Date(),
        campaignRequirements: {
          allowedValues: ['us', 'uk', 'ca']
        }
      };

      mockVerifyProof.mockResolvedValue({
        valid: true,
        circuitName: 'set_membership',
        publicSignals: ['1', '123', '123', '123'],
        message: 'Proof verified',
        timestamp: Date.now()
      });

      const result = await processProof(pendingProof);

      expect(result.verified).toBe(true);
    });

    test('should reject set_membership when set doesnt match', async () => {
      const pendingProof: PendingProof = {
        id: 'proof-7',
        userId: 'user-7',
        campaignId: 'campaign-7',
        circuitName: 'set_membership',
        proof: { pi_a: ['1'], pi_b: [[]], pi_c: ['1'] },
        publicSignals: ['1', '999', '888', '777'],
        createdAt: new Date(),
        campaignRequirements: {
          allowedValues: ['us', 'uk', 'ca']
        }
      };

      mockVerifyProof.mockResolvedValue({
        valid: true,
        circuitName: 'set_membership',
        publicSignals: ['1', '999', '888', '777'],
        message: 'Proof verified',
        timestamp: Date.now()
      });

      const result = await processProof(pendingProof);

      expect(result.verified).toBe(false);
      expect(result.result.message).toBe('Public set does not match campaign requirements');
    });

    test('should handle verification errors gracefully', async () => {
      const pendingProof: PendingProof = {
        id: 'proof-8',
        userId: 'user-8',
        campaignId: 'campaign-8',
        circuitName: 'age_range',
        proof: {},
        publicSignals: [],
        createdAt: new Date()
      };

      mockVerifyProof.mockRejectedValue(new Error('Verification service unavailable'));

      const result = await processProof(pendingProof);

      expect(result.verified).toBe(false);
      expect(result.result.message).toBe('Verification failed');
      expect(result.error).toBe('Verification service unavailable');
    });

    test('should handle non-Error exceptions', async () => {
      const pendingProof: PendingProof = {
        id: 'proof-9',
        userId: 'user-9',
        campaignId: 'campaign-9',
        circuitName: 'age_range',
        proof: {},
        publicSignals: [],
        createdAt: new Date()
      };

      mockVerifyProof.mockRejectedValue('string error');

      const result = await processProof(pendingProof);

      expect(result.verified).toBe(false);
      expect(result.error).toBe('string error');
    });

    test('should log processing activity', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      const pendingProof: PendingProof = {
        id: 'proof-10',
        userId: 'user-10',
        campaignId: 'campaign-10',
        circuitName: 'age_range',
        proof: {},
        publicSignals: ['1', '18', '65'],
        createdAt: new Date()
      };

      mockVerifyProof.mockResolvedValue({
        valid: true,
        circuitName: 'age_range',
        publicSignals: ['1', '18', '65'],
        message: 'Verified',
        timestamp: Date.now()
      });

      await processProof(pendingProof);

      expect(consoleSpy).toHaveBeenCalledWith('[Queue] Processing proof proof-10 for user user-10');
    });

    test('should log errors during processing', async () => {
      const consoleSpy = jest.spyOn(console, 'error');
      
      const pendingProof: PendingProof = {
        id: 'proof-11',
        userId: 'user-11',
        campaignId: 'campaign-11',
        circuitName: 'age_range',
        proof: {},
        publicSignals: [],
        createdAt: new Date()
      };

      const error = new Error('Test error');
      mockVerifyProof.mockRejectedValue(error);

      await processProof(pendingProof);

      expect(consoleSpy).toHaveBeenCalledWith('[Queue] Error processing proof proof-11:', error);
    });
  });

  describe('processProofBatch', () => {
    test('should process multiple proofs in batch', async () => {
      const proofs: PendingProof[] = [
        {
          id: 'batch-1',
          userId: 'user-1',
          campaignId: 'campaign-1',
          circuitName: 'age_range',
          proof: {},
          publicSignals: ['1', '18', '65'],
          createdAt: new Date()
        },
        {
          id: 'batch-2',
          userId: 'user-2',
          campaignId: 'campaign-2',
          circuitName: 'age_range',
          proof: {},
          publicSignals: ['1', '25', '45'],
          createdAt: new Date()
        }
      ];

      mockVerifyProof.mockResolvedValue({
        valid: true,
        circuitName: 'age_range',
        publicSignals: [],
        message: 'Verified',
        timestamp: Date.now()
      });

      const results = await processProofBatch(proofs);

      expect(results).toHaveLength(2);
      expect(results[0]?.proofId).toBe('batch-1');
      expect(results[1]?.proofId).toBe('batch-2');
      expect(results.every((r: any) => r.verified)).toBe(true);
    });

    test('should handle empty batch', async () => {
      const results = await processProofBatch([]);

      expect(results).toHaveLength(0);
    });

    test('should process batch with mixed results', async () => {
      const proofs: PendingProof[] = [
        {
          id: 'batch-3',
          userId: 'user-3',
          campaignId: 'campaign-3',
          circuitName: 'age_range',
          proof: { valid: true },
          publicSignals: ['1', '18', '65'],
          createdAt: new Date()
        },
        {
          id: 'batch-4',
          userId: 'user-4',
          campaignId: 'campaign-4',
          circuitName: 'age_range',
          proof: { invalid: true },
          publicSignals: [],
          createdAt: new Date()
        }
      ];

      mockVerifyProof
        .mockResolvedValueOnce({
          valid: true,
          circuitName: 'age_range',
          publicSignals: ['1', '18', '65'],
          message: 'Verified',
          timestamp: Date.now()
        })
        .mockResolvedValueOnce({
          valid: false,
          circuitName: 'age_range',
          publicSignals: [],
          message: 'Invalid',
          timestamp: Date.now()
        });

      const results = await processProofBatch(proofs);

      expect(results).toHaveLength(2);
      expect(results[0]?.verified).toBe(true);
      expect(results[1]?.verified).toBe(false);
    });

    test('should handle batch errors individually', async () => {
      const proofs: PendingProof[] = [
        {
          id: 'batch-5',
          userId: 'user-5',
          campaignId: 'campaign-5',
          circuitName: 'age_range',
          proof: {},
          publicSignals: ['1', '18', '65'],
          createdAt: new Date()
        },
        {
          id: 'batch-6',
          userId: 'user-6',
          campaignId: 'campaign-6',
          circuitName: 'age_range',
          proof: {},
          publicSignals: [],
          createdAt: new Date()
        }
      ];

      mockVerifyProof
        .mockResolvedValueOnce({
          valid: true,
          circuitName: 'age_range',
          publicSignals: ['1', '18', '65'],
          message: 'Verified',
          timestamp: Date.now()
        })
        .mockRejectedValueOnce(new Error('Verification failed'));

      const results = await processProofBatch(proofs);

      expect(results).toHaveLength(2);
      expect(results[0]?.verified).toBe(true);
      expect(results[1]?.verified).toBe(false);
      expect(results[1]?.error).toBe('Verification failed');
    });
  });

  describe('runProofVerificationCron', () => {
    const { runProofVerificationCron } = require('../proof-queue-processor');

    test('should process pending proofs successfully', async () => {
      const mockProofs: PendingProof[] = [
        {
          id: 'cron-1',
          userId: 'user-1',
          campaignId: 'campaign-1',
          circuitName: 'age_range',
          proof: {},
          publicSignals: ['1', '18', '65'],
          createdAt: new Date()
        }
      ];

      const mockFetch = jest.fn<() => Promise<PendingProof[]>>().mockResolvedValue(mockProofs);
      const mockSave = jest.fn<(results: any[]) => Promise<void>>().mockResolvedValue(undefined);

      mockVerifyProof.mockResolvedValue({
        valid: true,
        circuitName: 'age_range',
        publicSignals: ['1', '18', '65'],
        message: 'Verified',
        timestamp: Date.now()
      });

      await runProofVerificationCron(mockFetch, mockSave);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(mockSave).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            proofId: 'cron-1',
            verified: true
          })
        ])
      );
    });

    test('should handle empty proof queue', async () => {
      const mockFetch = jest.fn<() => Promise<PendingProof[]>>().mockResolvedValue([]);
      const mockSave = jest.fn<(results: any[]) => Promise<void>>().mockResolvedValue(undefined);

      await runProofVerificationCron(mockFetch, mockSave);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockSave).not.toHaveBeenCalled();
    });

    test('should process multiple proofs in cron job', async () => {
      const mockProofs: PendingProof[] = [
        {
          id: 'cron-2',
          userId: 'user-2',
          campaignId: 'campaign-2',
          circuitName: 'age_range',
          proof: {},
          publicSignals: ['1', '18', '65'],
          createdAt: new Date()
        },
        {
          id: 'cron-3',
          userId: 'user-3',
          campaignId: 'campaign-3',
          circuitName: 'range_check',
          proof: {},
          publicSignals: ['1', '10', '100'],
          createdAt: new Date()
        }
      ];

      const mockFetch = jest.fn<() => Promise<PendingProof[]>>().mockResolvedValue(mockProofs);
      const mockSave = jest.fn<(results: any[]) => Promise<void>>().mockResolvedValue(undefined);

      mockVerifyProof.mockResolvedValue({
        valid: true,
        circuitName: 'test',
        publicSignals: [],
        message: 'Verified',
        timestamp: Date.now()
      });

      await runProofVerificationCron(mockFetch, mockSave);

      expect(mockSave).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ proofId: 'cron-2' }),
          expect.objectContaining({ proofId: 'cron-3' })
        ])
      );
    });

    test('should handle fetch errors', async () => {
      const mockFetch = jest.fn<() => Promise<PendingProof[]>>().mockRejectedValue(new Error('Database connection failed'));
      const mockSave = jest.fn<(results: any[]) => Promise<void>>().mockResolvedValue(undefined);

      await expect(runProofVerificationCron(mockFetch, mockSave)).rejects.toThrow('Database connection failed');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockSave).not.toHaveBeenCalled();
    });

    test('should handle save errors', async () => {
      const mockProofs: PendingProof[] = [
        {
          id: 'cron-4',
          userId: 'user-4',
          campaignId: 'campaign-4',
          circuitName: 'age_range',
          proof: {},
          publicSignals: ['1', '18', '65'],
          createdAt: new Date()
        }
      ];

      const mockFetch = jest.fn<() => Promise<PendingProof[]>>().mockResolvedValue(mockProofs);
      const mockSave = jest.fn<(results: any[]) => Promise<void>>().mockRejectedValue(new Error('Database write failed'));

      mockVerifyProof.mockResolvedValue({
        valid: true,
        circuitName: 'age_range',
        publicSignals: ['1', '18', '65'],
        message: 'Verified',
        timestamp: Date.now()
      });

      await expect(runProofVerificationCron(mockFetch, mockSave)).rejects.toThrow('Database write failed');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockSave).toHaveBeenCalledTimes(1);
    });

    test('should log cron job activity', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      const mockProofs: PendingProof[] = [
        {
          id: 'cron-5',
          userId: 'user-5',
          campaignId: 'campaign-5',
          circuitName: 'age_range',
          proof: {},
          publicSignals: ['1', '18', '65'],
          createdAt: new Date()
        }
      ];

      const mockFetch = jest.fn<() => Promise<PendingProof[]>>().mockResolvedValue(mockProofs);
      const mockSave = jest.fn<(results: any[]) => Promise<void>>().mockResolvedValue(undefined);

      mockVerifyProof.mockResolvedValue({
        valid: true,
        circuitName: 'age_range',
        publicSignals: ['1', '18', '65'],
        message: 'Verified',
        timestamp: Date.now()
      });

      await runProofVerificationCron(mockFetch, mockSave);

      expect(consoleSpy).toHaveBeenCalledWith('[Cron] Starting proof verification cron job');
      expect(consoleSpy).toHaveBeenCalledWith('[Cron] Found 1 pending proofs');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[Cron] Completed in'));
      expect(consoleSpy).toHaveBeenCalledWith('[Cron] Results: 1 verified, 0 failed');
    });

    test('should log errors in cron job', async () => {
      const consoleSpy = jest.spyOn(console, 'error');
      
      const mockFetch = jest.fn<() => Promise<PendingProof[]>>().mockRejectedValue(new Error('Connection error'));
      const mockSave = jest.fn<(results: any[]) => Promise<void>>().mockResolvedValue(undefined);

      await expect(runProofVerificationCron(mockFetch, mockSave)).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith('[Cron] Error running proof verification cron:', expect.any(Error));
    });

    test('should report verification statistics', async () => {
      const mockProofs: PendingProof[] = [
        {
          id: 'cron-6',
          userId: 'user-6',
          campaignId: 'campaign-6',
          circuitName: 'age_range',
          proof: { valid: true },
          publicSignals: ['1', '18', '65'],
          createdAt: new Date()
        },
        {
          id: 'cron-7',
          userId: 'user-7',
          campaignId: 'campaign-7',
          circuitName: 'age_range',
          proof: { invalid: true },
          publicSignals: [],
          createdAt: new Date()
        }
      ];

      const mockFetch = jest.fn<() => Promise<PendingProof[]>>().mockResolvedValue(mockProofs);
      const mockSave = jest.fn<(results: any[]) => Promise<void>>().mockResolvedValue(undefined);
      const consoleSpy = jest.spyOn(console, 'log');

      mockVerifyProof
        .mockResolvedValueOnce({
          valid: true,
          circuitName: 'age_range',
          publicSignals: ['1', '18', '65'],
          message: 'Verified',
          timestamp: Date.now()
        })
        .mockResolvedValueOnce({
          valid: false,
          circuitName: 'age_range',
          publicSignals: [],
          message: 'Invalid',
          timestamp: Date.now()
        });

      await runProofVerificationCron(mockFetch, mockSave);

      expect(consoleSpy).toHaveBeenCalledWith('[Cron] Results: 1 verified, 1 failed');
    });
  });
});
