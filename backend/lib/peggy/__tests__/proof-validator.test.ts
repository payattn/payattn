/**
 * Tests for Peggy Proof Validator
 * Validates ZK proofs for offers
 */

// Mock verifyProof BEFORE importing proof-validator
jest.mock('../../zk/verifier', () => ({
  verifyProof: jest.fn()
}));

import { validateOfferProofs, ZKProof } from '../proof-validator';
import { verifyProof } from '../../zk/verifier';

const mockVerifyProof = verifyProof as jest.Mock;

describe('validateOfferProofs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Demo Mode - No Proofs', () => {
    it('should accept when zkProofs is null', async () => {
      const result = await validateOfferProofs(null);
      
      expect(result).toEqual({
        isValid: true,
        validProofs: [],
        invalidProofs: [],
        summary: ' No ZK proofs provided (accepted for demo)',
        details: []
      });
      expect(mockVerifyProof).not.toHaveBeenCalled();
    });

    it('should accept when zkProofs is undefined', async () => {
      const result = await validateOfferProofs(undefined);
      
      expect(result).toEqual({
        isValid: true,
        validProofs: [],
        invalidProofs: [],
        summary: ' No ZK proofs provided (accepted for demo)',
        details: []
      });
      expect(mockVerifyProof).not.toHaveBeenCalled();
    });

    it('should accept when zkProofs is empty array', async () => {
      const result = await validateOfferProofs([]);
      
      expect(result).toEqual({
        isValid: true,
        validProofs: [],
        invalidProofs: [],
        summary: ' No ZK proofs to validate (accepted for demo)',
        details: []
      });
      expect(mockVerifyProof).not.toHaveBeenCalled();
    });

    it('should accept when zkProofs is empty object', async () => {
      const result = await validateOfferProofs({});
      
      expect(result).toEqual({
        isValid: true,
        validProofs: [],
        invalidProofs: [],
        summary: ' No ZK proofs to validate (accepted for demo)',
        details: []
      });
      expect(mockVerifyProof).not.toHaveBeenCalled();
    });
  });

  describe('Array Format', () => {
    it('should validate single proof successfully', async () => {
      const zkProofs: ZKProof[] = [{
        circuit: 'range_check',
        proof: { pi_a: [1, 2] },
        publicSignals: ['18', '100'],
        proofType: 'age'
      }];

      mockVerifyProof.mockResolvedValue({
        valid: true,
        circuitName: 'range_check',
        publicSignals: ['18', '100'],
        message: 'Valid proof',
        timestamp: Date.now()
      });

      const result = await validateOfferProofs(zkProofs);
      
      expect(result.isValid).toBe(true);
      expect(result.validProofs).toEqual(['Age (range proof)']);
      expect(result.invalidProofs).toEqual([]);
      expect(result.summary).toContain('1 valid proof');
      expect(result.summary).toContain('User meets targeting requirements');
      expect(mockVerifyProof).toHaveBeenCalledWith('range_check', { pi_a: [1, 2] }, ['18', '100']);
    });

    it('should validate multiple proofs successfully', async () => {
      const zkProofs: ZKProof[] = [
        {
          circuit: 'range_check',
          proof: { pi_a: [1, 2] },
          publicSignals: ['18', '100'],
          proofType: 'age'
        },
        {
          circuit: 'set_membership',
          proof: { pi_a: [3, 4] },
          publicSignals: ['US', 'CA'],
          proofType: 'location'
        }
      ];

      mockVerifyProof
        .mockResolvedValueOnce({
          valid: true,
          circuitName: 'range_check',
          publicSignals: ['18', '100'],
          message: 'Valid proof',
          timestamp: Date.now()
        })
        .mockResolvedValueOnce({
          valid: true,
          circuitName: 'set_membership',
          publicSignals: ['US', 'CA'],
          message: 'Valid proof',
          timestamp: Date.now()
        });

      const result = await validateOfferProofs(zkProofs);
      
      expect(result.isValid).toBe(true);
      expect(result.validProofs).toEqual(['Age (range proof)', 'Location (set membership)']);
      expect(result.invalidProofs).toEqual([]);
      expect(result.summary).toContain('2 valid proofs');
      expect(mockVerifyProof).toHaveBeenCalledTimes(2);
    });

    it('should handle invalid proof', async () => {
      const zkProofs: ZKProof[] = [{
        circuit: 'range_check',
        proof: { pi_a: [1, 2] },
        publicSignals: ['18', '100'],
        proofType: 'age'
      }];

      mockVerifyProof.mockResolvedValue({
        valid: false,
        circuitName: 'range_check',
        publicSignals: ['18', '100'],
        message: 'Invalid proof',
        timestamp: Date.now()
      });

      const result = await validateOfferProofs(zkProofs);
      
      expect(result.isValid).toBe(false);
      expect(result.validProofs).toEqual([]);
      expect(result.invalidProofs).toEqual(['Age (range proof)']);
      expect(result.summary).toContain('All proofs invalid');
      expect(result.summary).toContain('User does NOT meet targeting requirements');
    });

    it('should handle partial validation (some valid, some invalid)', async () => {
      const zkProofs: ZKProof[] = [
        {
          circuit: 'range_check',
          proof: { pi_a: [1, 2] },
          publicSignals: ['18', '100'],
          proofType: 'age'
        },
        {
          circuit: 'set_membership',
          proof: { pi_a: [3, 4] },
          publicSignals: ['US', 'CA'],
          proofType: 'location'
        }
      ];

      mockVerifyProof
        .mockResolvedValueOnce({
          valid: true,
          circuitName: 'range_check',
          publicSignals: ['18', '100'],
          message: 'Valid proof',
          timestamp: Date.now()
        })
        .mockResolvedValueOnce({
          valid: false,
          circuitName: 'set_membership',
          publicSignals: ['US', 'CA'],
          message: 'Invalid proof',
          timestamp: Date.now()
        });

      const result = await validateOfferProofs(zkProofs);
      
      expect(result.isValid).toBe(false);
      expect(result.validProofs).toEqual(['Age (range proof)']);
      expect(result.invalidProofs).toEqual(['Location (set membership)']);
      expect(result.summary).toContain('Partial validation');
      expect(result.summary).toContain('1 valid');
      expect(result.summary).toContain('1 invalid');
    });

    it('should handle verification exception', async () => {
      const zkProofs: ZKProof[] = [{
        circuit: 'range_check',
        proof: { pi_a: [1, 2] },
        publicSignals: ['18', '100'],
        proofType: 'age'
      }];

      mockVerifyProof.mockRejectedValue(new Error('Verification failed'));

      const result = await validateOfferProofs(zkProofs);
      
      expect(result.isValid).toBe(false);
      expect(result.validProofs).toEqual([]);
      expect(result.invalidProofs).toEqual(['Age (range proof)']);
      expect(result.details).toHaveLength(1);
      expect(result.details[0]?.valid).toBe(false);
      expect(result.details[0]?.message).toContain('Verification error: Verification failed');
    });

    it('should handle non-Error exception', async () => {
      const zkProofs: ZKProof[] = [{
        circuit: 'range_check',
        proof: { pi_a: [1, 2] },
        publicSignals: ['18', '100'],
        proofType: 'age'
      }];

      mockVerifyProof.mockRejectedValue('String error');

      const result = await validateOfferProofs(zkProofs);
      
      expect(result.isValid).toBe(false);
      expect(result.invalidProofs).toEqual(['Age (range proof)']);
      expect(result.details).toHaveLength(1);
      expect(result.details[0]?.message).toContain('Unknown error');
    });
  });

  describe('Object Format - proofs array', () => {
    it('should validate proofs from object with proofs array', async () => {
      const zkProofs = {
        proofs: [
          {
            circuit: 'range_check',
            proof: { pi_a: [1, 2] },
            publicSignals: ['18', '100'],
            proofType: 'age'
          }
        ]
      };

      mockVerifyProof.mockResolvedValue({
        valid: true,
        circuitName: 'range_check',
        publicSignals: ['18', '100'],
        message: 'Valid proof',
        timestamp: Date.now()
      });

      const result = await validateOfferProofs(zkProofs);
      
      expect(result.isValid).toBe(true);
      expect(result.validProofs).toEqual(['Age (range proof)']);
    });
  });

  describe('Object Format - key-value pairs', () => {
    it('should validate proofs from object key-value pairs with circuitName', async () => {
      const zkProofs = {
        age: {
          circuitName: 'range_check',
          proof: { pi_a: [1, 2] },
          publicSignals: ['18', '100']
        },
        location: {
          circuitName: 'set_membership',
          proof: { pi_a: [3, 4] },
          publicSignals: ['US', 'CA']
        }
      };

      mockVerifyProof
        .mockResolvedValueOnce({
          valid: true,
          circuitName: 'range_check',
          publicSignals: ['18', '100'],
          message: 'Valid',
          timestamp: Date.now()
        })
        .mockResolvedValueOnce({
          valid: true,
          circuitName: 'set_membership',
          publicSignals: ['US', 'CA'],
          message: 'Valid',
          timestamp: Date.now()
        });

      const result = await validateOfferProofs(zkProofs);
      
      expect(result.isValid).toBe(true);
      expect(result.validProofs).toEqual(['Age (range proof)', 'Location (set membership)']);
    });

    it('should validate proofs from object key-value pairs with circuit field', async () => {
      const zkProofs = {
        age: {
          circuit: 'range_check',
          proof: { pi_a: [1, 2] },
          publicSignals: ['18', '100']
        }
      };

      mockVerifyProof.mockResolvedValue({
        valid: true,
        circuitName: 'range_check',
        publicSignals: ['18', '100'],
        message: 'Valid',
        timestamp: Date.now()
      });

      const result = await validateOfferProofs(zkProofs);
      
      expect(result.isValid).toBe(true);
      expect(result.validProofs).toEqual(['Age (range proof)']);
    });

    it('should use key as circuit name if no circuitName or circuit field', async () => {
      const zkProofs = {
        range_check: {
          proof: { pi_a: [1, 2] },
          publicSignals: ['18', '100']
        }
      };

      mockVerifyProof.mockResolvedValue({
        valid: true,
        circuitName: 'range_check',
        publicSignals: ['18', '100'],
        message: 'Valid',
        timestamp: Date.now()
      });

      const result = await validateOfferProofs(zkProofs);
      
      expect(result.isValid).toBe(true);
      expect(result.validProofs).toEqual(['range_check (range proof)']);
      expect(mockVerifyProof).toHaveBeenCalledWith('range_check', expect.anything(), ['18', '100']);
    });
  });

  describe('Proof Display Names', () => {
    it('should display age proof correctly', async () => {
      const zkProofs: ZKProof[] = [{
        circuit: 'range_check',
        proof: {},
        publicSignals: [],
        proofType: 'age'
      }];

      mockVerifyProof.mockResolvedValue({ valid: true, circuitName: 'range_check', publicSignals: [], timestamp: Date.now() });
      const result = await validateOfferProofs(zkProofs);
      expect(result.validProofs).toEqual(['Age (range proof)']);
    });

    it('should display location proof correctly', async () => {
      const zkProofs: ZKProof[] = [{
        circuit: 'set_membership',
        proof: {},
        publicSignals: [],
        proofType: 'location'
      }];

      mockVerifyProof.mockResolvedValue({ valid: true, circuitName: 'set_membership', publicSignals: [], timestamp: Date.now() });
      const result = await validateOfferProofs(zkProofs);
      expect(result.validProofs).toEqual(['Location (set membership)']);
    });

    it('should display interest proof correctly', async () => {
      const zkProofs: ZKProof[] = [{
        circuit: 'set_membership',
        proof: {},
        publicSignals: [],
        proofType: 'interest'
      }];

      mockVerifyProof.mockResolvedValue({ valid: true, circuitName: 'set_membership', publicSignals: [], timestamp: Date.now() });
      const result = await validateOfferProofs(zkProofs);
      expect(result.validProofs).toEqual(['Interest (set membership)']);
    });

    it('should display proof without circuit type annotation', async () => {
      const zkProofs: ZKProof[] = [{
        circuit: 'custom_circuit',
        proof: {},
        publicSignals: [],
        proofType: 'age'
      }];

      mockVerifyProof.mockResolvedValue({ valid: true, circuitName: 'custom_circuit', publicSignals: [], timestamp: Date.now() });
      const result = await validateOfferProofs(zkProofs);
      expect(result.validProofs).toEqual(['Age']);
    });

    it('should display unknown proofType as-is', async () => {
      const zkProofs: ZKProof[] = [{
        circuit: 'range_check',
        proof: {},
        publicSignals: [],
        proofType: 'custom_proof'
      }];

      mockVerifyProof.mockResolvedValue({ valid: true, circuitName: 'range_check', publicSignals: [], timestamp: Date.now() });
      const result = await validateOfferProofs(zkProofs);
      expect(result.validProofs).toEqual(['custom_proof (range proof)']);
    });

    it('should fallback to circuit name when no proofType', async () => {
      const zkProofs: ZKProof[] = [{
        circuit: 'age_range',
        proof: {},
        publicSignals: []
      }];

      mockVerifyProof.mockResolvedValue({ valid: true, circuitName: 'age_range', publicSignals: [], timestamp: Date.now() });
      const result = await validateOfferProofs(zkProofs);
      expect(result.validProofs).toEqual(['Age']);
    });

    it('should use circuit name as-is if no mapping exists', async () => {
      const zkProofs: ZKProof[] = [{
        circuit: 'unknown_circuit',
        proof: {},
        publicSignals: []
      }];

      mockVerifyProof.mockResolvedValue({ valid: true, circuitName: 'unknown_circuit', publicSignals: [], timestamp: Date.now() });
      const result = await validateOfferProofs(zkProofs);
      expect(result.validProofs).toEqual(['unknown_circuit']);
    });

    it('should handle case-insensitive proofType mapping', async () => {
      const zkProofs: ZKProof[] = [{
        circuit: 'range_check',
        proof: {},
        publicSignals: [],
        proofType: 'AGE'
      }];

      mockVerifyProof.mockResolvedValue({ valid: true, circuitName: 'range_check', publicSignals: [], timestamp: Date.now() });
      const result = await validateOfferProofs(zkProofs);
      expect(result.validProofs).toEqual(['Age (range proof)']);
    });
  });
});
