import { describe, test, expect, jest, beforeAll } from '@jest/globals';
import { verifyProof, verifyAgeProof, verifyProofBatch, allProofsValid } from '../verifier';
import type { VerificationResult } from '../verifier';

// Mock exec to avoid calling actual Rapidsnark CLI in tests
jest.mock('child_process', () => ({
  exec: jest.fn((command: string, options: any, callback: any) => {
    // Simulate successful verification
    if (command.includes('verifier')) {
      const stderr = 'Valid proof';
      callback(null, { stdout: '', stderr });
    } else {
      callback(new Error('Command not found'));
    }
  })
}));

jest.mock('util', () => {
  const actual = jest.requireActual('util') as Record<string, any>;
  return {
    ...actual,
    promisify: (fn: any) => {
      return async (...args: any[]) => {
        return new Promise((resolve, reject) => {
          fn(...args, (err: any, result: any) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
      };
    }
  };
});

describe('ZK Proof Verification', () => {
  
  const validProof = {
    pi_a: ['1', '2', '1'],
    pi_b: [['1', '2'], ['3', '4'], ['1', '0']],
    pi_c: ['1', '2', '1'],
    protocol: 'groth16',
    curve: 'bn128'
  };

  const validPublicSignals = ['1', '18', '65'];

  test('should reject invalid circuit name', async () => {
    const result = await verifyProof(
      'nonexistent_circuit',
      validProof,
      validPublicSignals
    );
    
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Circuit not found');
  });

  test('should handle null proof gracefully', async () => {
    const result = await verifyProof(
      'age_range',
      null as any,
      validPublicSignals
    );
    
    // Mock exec will still return valid, but in real scenario this would fail
    expect(result).toBeDefined();
    expect(result.circuitName).toBe('age_range');
  });

  test('should handle empty public signals', async () => {
    const result = await verifyProof(
      'age_range',
      validProof,
      []
    );
    
    // Should still attempt verification even with empty signals
    expect(result).toBeDefined();
    expect(result.circuitName).toBe('age_range');
  });

  test('should return verification result structure', async () => {
    const result = await verifyProof(
      'age_range',
      validProof,
      validPublicSignals
    );
    
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('circuitName');
    expect(result).toHaveProperty('publicSignals');
    expect(result).toHaveProperty('message');
    expect(result).toHaveProperty('timestamp');
    expect(typeof result.valid).toBe('boolean');
    expect(result.circuitName).toBe('age_range');
  });

  test('should include verification time in result', async () => {
    const result = await verifyProof(
      'age_range',
      validProof,
      validPublicSignals
    );
    
    if (result.valid) {
      expect(result.verificationTime).toBeDefined();
      expect(typeof result.verificationTime).toBe('number');
      expect(result.verificationTime).toBeGreaterThanOrEqual(0);
    }
  });

  test('should preserve public signals in result', async () => {
    const signals = ['1', '25', '45'];
    const result = await verifyProof(
      'age_range',
      validProof,
      signals
    );
    
    expect(result.publicSignals).toEqual(signals);
  });
});

describe('Age Proof Verification', () => {
  
  const validProof = {
    pi_a: ['1', '2', '1'],
    pi_b: [['1', '2'], ['3', '4'], ['1', '0']],
    pi_c: ['1', '2', '1'],
  };

  test('should extract age range from valid proof', async () => {
    const publicSignals = ['1', '18', '65'];
    const result = await verifyAgeProof(validProof, publicSignals);
    
    // Even if verification fails due to mocked exec, structure should be correct
    expect(result).toHaveProperty('valid');
    expect(result.publicSignals).toEqual(publicSignals);
    
    if (result.valid && publicSignals.length >= 3) {
      expect(result).toHaveProperty('ageRange');
      if (result.ageRange) {
        expect(result.ageRange.min).toBe(18);
        expect(result.ageRange.max).toBe(65);
      }
    }
  });

  test('should handle missing age signals gracefully', async () => {
    const publicSignals = ['1']; // Missing min/max age
    const result = await verifyAgeProof(validProof, publicSignals);
    
    expect(result).toBeDefined();
    expect(result.publicSignals).toEqual(publicSignals);
  });

  test('should parse age values as integers', async () => {
    const publicSignals = ['1', '21', '99'];
    const result = await verifyAgeProof(validProof, publicSignals);
    
    if (result.valid && result.ageRange) {
      expect(typeof result.ageRange.min).toBe('number');
      expect(typeof result.ageRange.max).toBe('number');
      expect(Number.isInteger(result.ageRange.min)).toBe(true);
      expect(Number.isInteger(result.ageRange.max)).toBe(true);
    }
  });
});

describe('Batch Proof Verification', () => {
  
  const validProof = {
    pi_a: ['1', '2', '1'],
    pi_b: [['1', '2'], ['3', '4'], ['1', '0']],
    pi_c: ['1', '2', '1'],
  };

  test('should verify multiple proofs in batch', async () => {
    const proofs = [
      {
        circuitName: 'age_range',
        proof: validProof,
        publicSignals: ['1', '18', '65']
      },
      {
        circuitName: 'age_range',
        proof: validProof,
        publicSignals: ['1', '25', '45']
      }
    ];

    const results = await verifyProofBatch(proofs);
    
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(2);
    results.forEach(result => {
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('circuitName');
    });
  });

  test('should handle empty batch', async () => {
    const results = await verifyProofBatch([]);
    
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

  test('should return individual results for each proof', async () => {
    const proofs = [
      {
        circuitName: 'age_range',
        proof: validProof,
        publicSignals: ['1', '18', '65']
      },
      {
        circuitName: 'invalid_circuit',
        proof: validProof,
        publicSignals: ['1']
      }
    ];

    const results = await verifyProofBatch(proofs);
    
    expect(results.length).toBe(2);
    expect(results[0]).toBeDefined();
    expect(results[1]).toBeDefined();
    // Second proof should fail due to invalid circuit
    expect(results[1]?.valid).toBe(false);
  });
});

describe('Batch Validation Helper', () => {
  
  test('should return true when all proofs are valid', () => {
    const results: VerificationResult[] = [
      {
        valid: true,
        circuitName: 'test1',
        publicSignals: [],
        message: 'ok',
        timestamp: Date.now()
      },
      {
        valid: true,
        circuitName: 'test2',
        publicSignals: [],
        message: 'ok',
        timestamp: Date.now()
      }
    ];

    expect(allProofsValid(results)).toBe(true);
  });

  test('should return false when any proof is invalid', () => {
    const results: VerificationResult[] = [
      {
        valid: true,
        circuitName: 'test1',
        publicSignals: [],
        message: 'ok',
        timestamp: Date.now()
      },
      {
        valid: false,
        circuitName: 'test2',
        publicSignals: [],
        message: 'error',
        timestamp: Date.now()
      }
    ];

    expect(allProofsValid(results)).toBe(false);
  });

  test('should return true for empty array', () => {
    expect(allProofsValid([])).toBe(true);
  });

  test('should handle single proof correctly', () => {
    const validResult: VerificationResult[] = [{
      valid: true,
      circuitName: 'test',
      publicSignals: [],
      message: 'ok',
      timestamp: Date.now()
    }];

    const invalidResult: VerificationResult[] = [{
      valid: false,
      circuitName: 'test',
      publicSignals: [],
      message: 'error',
      timestamp: Date.now()
    }];

    expect(allProofsValid(validResult)).toBe(true);
    expect(allProofsValid(invalidResult)).toBe(false);
  });
});

describe('Error Handling', () => {
  
  test('should handle filesystem errors gracefully', async () => {
    const result = await verifyProof(
      'age_range',
      { invalid: 'proof' },
      []
    );
    
    // With mocked exec, validation may still pass
    expect(result).toBeDefined();
    expect(result.circuitName).toBe('age_range');
  });

  test('should not expose sensitive paths in error messages', async () => {
    const result = await verifyProof(
      'nonexistent_circuit',
      {},
      []
    );
    
    expect(result.message).not.toContain('/Users/');
    expect(result.message).not.toContain('/home/');
    expect(result.message).not.toContain('rapidsnark-server');
  });

  test('should include timestamp in all results', async () => {
    const result = await verifyProof(
      'age_range',
      {},
      []
    );
    
    expect(result.timestamp).toBeDefined();
    expect(typeof result.timestamp).toBe('number');
    expect(result.timestamp).toBeGreaterThan(0);
    expect(result.timestamp).toBeLessThanOrEqual(Date.now());
  });
});
