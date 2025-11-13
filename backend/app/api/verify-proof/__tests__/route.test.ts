import { POST, GET } from '../route';
import { verifyProof, verifyProofBatch, allProofsValid } from '@/lib/zk/verifier';
import { NextRequest } from 'next/server';

jest.mock('@/lib/zk/verifier');

const mockVerifyProof = verifyProof as jest.MockedFunction<typeof verifyProof>;
const mockVerifyProofBatch = verifyProofBatch as jest.MockedFunction<typeof verifyProofBatch>;
const mockAllProofsValid = allProofsValid as jest.MockedFunction<typeof allProofsValid>;

const createMockVerificationResult = (
  valid: boolean,
  circuitName: string = 'age_range',
  publicSignals: string[] = ['1', '18', '65'],
  message: string = valid ? 'Proof verified successfully' : 'Proof verification failed'
) => ({
  valid,
  circuitName,
  publicSignals,
  message,
  timestamp: Date.now(),
  verificationTime: 100
});

describe('POST /api/verify-proof', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Request Validation', () => {
    it('should handle json parsing errors', async () => {
      const request = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Proof verification failed');
    });

    it('should reject single proofs without circuitName', async () => {
      const request = {
        json: jest.fn().mockResolvedValue({
          proof: { pi_a: [], pi_b: [], pi_c: [] },
          publicSignals: []
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('circuitName is required');
    });

    it('should reject proofs with incomplete proof structure', async () => {
      const request = {
        json: jest.fn().mockResolvedValue({
          circuitName: 'age_range',
          proof: { pi_a: [] },
          publicSignals: []
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('proof object must contain pi_a, pi_b, and pi_c arrays');
    });

    it('should reject proofs without publicSignals array', async () => {
      const request = {
        json: jest.fn().mockResolvedValue({
          circuitName: 'age_range',
          proof: {
            pi_a: ['1', '2', '1'],
            pi_b: [['1', '2'], ['3', '4'], ['5', '6']],
            pi_c: ['7', '8', '1']
          },
          publicSignals: 'invalid'
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('publicSignals must be an array');
    });

    it('should reject batch requests with empty proofs array', async () => {
      const request = {
        json: jest.fn().mockResolvedValue({
          proofs: []
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('proofs array is required and must not be empty');
    });
  });

  describe('Single Proof Verification', () => {
    it('should verify a valid proof successfully', async () => {
      const validProof = {
        circuitName: 'age_range',
        proof: {
          pi_a: ['1', '2', '1'],
          pi_b: [['1', '2'], ['3', '4'], ['5', '6']],
          pi_c: ['7', '8', '1']
        },
        publicSignals: ['1', '18', '65']
      };

      mockVerifyProof.mockResolvedValue(
        createMockVerificationResult(true, 'age_range', ['1', '18', '65'])
      );

      const request = {
        json: jest.fn().mockResolvedValue(validProof)
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(mockVerifyProof).toHaveBeenCalledWith(
        'age_range',
        validProof.proof,
        validProof.publicSignals
      );
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.result.valid).toBe(true);
    });

    it('should handle invalid proofs', async () => {
      mockVerifyProof.mockResolvedValue(
        createMockVerificationResult(false, 'age_range', ['0', '18', '65'])
      );

      const request = {
        json: jest.fn().mockResolvedValue({
          circuitName: 'age_range',
          proof: {
            pi_a: ['1', '2', '1'],
            pi_b: [['1', '2'], ['3', '4'], ['5', '6']],
            pi_c: ['7', '8', '1']
          },
          publicSignals: ['0', '18', '65']
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.result.valid).toBe(false);
    });

    it('should include metadata in response when provided', async () => {
      mockVerifyProof.mockResolvedValue(
        createMockVerificationResult(true, 'age_range', ['1', '18', '65'])
      );

      const request = {
        json: jest.fn().mockResolvedValue({
          circuitName: 'age_range',
          proof: {
            pi_a: ['1', '2', '1'],
            pi_b: [['1', '2'], ['3', '4'], ['5', '6']],
            pi_c: ['7', '8', '1']
          },
          publicSignals: ['1', '18', '65'],
          metadata: {
            userId: 'user123',
            campaignId: 'campaign456'
          }
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(data.metadata).toEqual({
        userId: 'user123',
        campaignId: 'campaign456'
      });
    });
  });

  describe('Campaign Requirements Validation', () => {
    it('should validate range circuit requirements', async () => {
      mockVerifyProof.mockResolvedValue(
        createMockVerificationResult(true, 'age_range', ['1', '25', '50'])
      );

      const request = {
        json: jest.fn().mockResolvedValue({
          circuitName: 'age_range',
          proof: {
            pi_a: ['1', '2', '1'],
            pi_b: [['1', '2'], ['3', '4'], ['5', '6']],
            pi_c: ['7', '8', '1']
          },
          publicSignals: ['1', '25', '50'],
          campaignRequirements: {
            min: 25,
            max: 50
          }
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.result.valid).toBe(true);
    });

    it('should reject proofs with mismatched range requirements', async () => {
      mockVerifyProof.mockResolvedValue(
        createMockVerificationResult(true, 'age_range', ['1', '18', '65'])
      );

      const request = {
        json: jest.fn().mockResolvedValue({
          circuitName: 'age_range',
          proof: {
            pi_a: ['1', '2', '1'],
            pi_b: [['1', '2'], ['3', '4'], ['5', '6']],
            pi_c: ['7', '8', '1']
          },
          publicSignals: ['1', '18', '65'],
          campaignRequirements: {
            min: 25,
            max: 50
          }
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.result.valid).toBe(false);
      expect(data.result.message).toContain("don't match campaign requirements");
    });

    it('should validate range_check circuit requirements', async () => {
      mockVerifyProof.mockResolvedValue(
        createMockVerificationResult(true, 'range_check', ['1', '25000', '50000'])
      );

      const request = {
        json: jest.fn().mockResolvedValue({
          circuitName: 'range_check',
          proof: {
            pi_a: ['1', '2', '1'],
            pi_b: [['1', '2'], ['3', '4'], ['5', '6']],
            pi_c: ['7', '8', '1']
          },
          publicSignals: ['1', '25000', '50000'],
          campaignRequirements: {
            min: 25000,
            max: 50000
          }
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.result.valid).toBe(true);
    });

    it('should validate set_membership circuit requirements with matching set', async () => {
      // Mock hashAndPadSet to return expected hashes
      const { hashAndPadSet } = require('@/lib/zk/hashing');
      jest.spyOn(require('@/lib/zk/hashing'), 'hashAndPadSet').mockReturnValue([
        'hash1', 'hash2', 'hash3', '0', '0', '0', '0', '0', '0', '0'
      ]);

      mockVerifyProof.mockResolvedValue(
        createMockVerificationResult(
          true,
          'set_membership',
          ['1', 'hash1', 'hash2', 'hash3', '0', '0', '0', '0', '0', '0', '0']
        )
      );

      const request = {
        json: jest.fn().mockResolvedValue({
          circuitName: 'set_membership',
          proof: {
            pi_a: ['1', '2', '1'],
            pi_b: [['1', '2'], ['3', '4'], ['5', '6']],
            pi_c: ['7', '8', '1']
          },
          publicSignals: ['1', 'hash1', 'hash2', 'hash3', '0', '0', '0', '0', '0', '0', '0'],
          campaignRequirements: {
            allowedValues: ['us', 'uk', 'ca']
          }
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.result.valid).toBe(true);
    });

    it('should reject set_membership proofs with mismatched set', async () => {
      // Mock hashAndPadSet to return different hashes
      jest.spyOn(require('@/lib/zk/hashing'), 'hashAndPadSet').mockReturnValue([
        'hashA', 'hashB', 'hashC', '0', '0', '0', '0', '0', '0', '0'
      ]);

      mockVerifyProof.mockResolvedValue(
        createMockVerificationResult(
          true,
          'set_membership',
          ['1', 'hash1', 'hash2', 'hash3', '0', '0', '0', '0', '0', '0', '0']
        )
      );

      const request = {
        json: jest.fn().mockResolvedValue({
          circuitName: 'set_membership',
          proof: {
            pi_a: ['1', '2', '1'],
            pi_b: [['1', '2'], ['3', '4'], ['5', '6']],
            pi_c: ['7', '8', '1']
          },
          publicSignals: ['1', 'hash1', 'hash2', 'hash3', '0', '0', '0', '0', '0', '0', '0'],
          campaignRequirements: {
            allowedValues: ['us', 'uk', 'ca']
          }
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.result.valid).toBe(false);
      expect(data.result.message).toContain('does not match campaign requirements');
    });
  });

  describe('Error Handling', () => {
    it('should handle verifyProof errors', async () => {
      mockVerifyProof.mockRejectedValue(new Error('Verification service unavailable'));

      const request = {
        json: jest.fn().mockResolvedValue({
          circuitName: 'age_range',
          proof: {
            pi_a: ['1', '2', '1'],
            pi_b: [['1', '2'], ['3', '4'], ['5', '6']],
            pi_c: ['7', '8', '1']
          },
          publicSignals: ['1', '18', '65']
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Proof verification failed');
      expect(data.message).toBe('Verification service unavailable');
    });
  });

  describe('Batch Proof Verification', () => {
    it('should verify multiple proofs successfully', async () => {
      const results = [
        createMockVerificationResult(true, 'age_range', ['1', '18', '65'], 'Proof 1 verified'),
        createMockVerificationResult(true, 'range_check', ['1', '25000', '50000'], 'Proof 2 verified')
      ];

      mockVerifyProofBatch.mockResolvedValue(results);
      mockAllProofsValid.mockReturnValue(true);

      const request = {
        json: jest.fn().mockResolvedValue({
          proofs: [
            {
              circuitName: 'age_range',
              proof: {
                pi_a: ['1', '2', '1'],
                pi_b: [['1', '2'], ['3', '4'], ['5', '6']],
                pi_c: ['7', '8', '1']
              },
              publicSignals: ['1', '18', '65']
            },
            {
              circuitName: 'range_check',
              proof: {
                pi_a: ['1', '2', '1'],
                pi_b: [['1', '2'], ['3', '4'], ['5', '6']],
                pi_c: ['7', '8', '1']
              },
              publicSignals: ['1', '25000', '50000']
            }
          ]
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results).toHaveLength(2);
      expect(data.message).toBe('All proofs verified successfully');
    });

    it('should handle mixed valid and invalid batch proofs', async () => {
      const results = [
        createMockVerificationResult(true, 'age_range', ['1', '18', '65'], 'Proof 1 verified'),
        createMockVerificationResult(false, 'age_range', ['0', '18', '65'], 'Proof 2 failed')
      ];

      mockVerifyProofBatch.mockResolvedValue(results);
      mockAllProofsValid.mockReturnValue(false);

      const request = {
        json: jest.fn().mockResolvedValue({
          proofs: [
            {
              circuitName: 'age_range',
              proof: {
                pi_a: ['1', '2', '1'],
                pi_b: [['1', '2'], ['3', '4'], ['5', '6']],
                pi_c: ['7', '8', '1']
              },
              publicSignals: ['1', '18', '65']
            },
            {
              circuitName: 'age_range',
              proof: {
                pi_a: ['1', '2', '1'],
                pi_b: [['1', '2'], ['3', '4'], ['5', '6']],
                pi_c: ['7', '8', '1']
              },
              publicSignals: ['0', '18', '65']
            }
          ]
        })
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.message).toBe('Some proofs failed verification');
      expect(data.results[0].valid).toBe(true);
      expect(data.results[1].valid).toBe(false);
    });
  });
});

describe('GET /api/verify-proof', () => {
  it('should return endpoint documentation', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('ZK Proof Verification Endpoint');
    expect(data.methods).toContain('POST');
    expect(data.availableCircuits).toContain('age_range');
    expect(data.availableCircuits).toContain('range_check');
    expect(data.availableCircuits).toContain('set_membership');
    expect(data.examples).toHaveProperty('singleProof');
    expect(data.examples).toHaveProperty('setMembership');
  });
});
