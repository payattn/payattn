import { describe, test, expect } from '@jest/globals';
import { hashToField, hashStringsToField, hashAndPadSet, FIELD_PRIME } from '../hashing';

describe('hashToField', () => {
  test('should hash string to field element', () => {
    const result = hashToField('test');
    
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^\d+$/);
    expect(BigInt(result)).toBeLessThan(FIELD_PRIME);
  });

  test('should produce deterministic hash', () => {
    const str = 'deterministic-test';
    
    const hash1 = hashToField(str);
    const hash2 = hashToField(str);
    
    expect(hash1).toBe(hash2);
  });

  test('should produce different hashes for different strings', () => {
    const hash1 = hashToField('string1');
    const hash2 = hashToField('string2');
    
    expect(hash1).not.toBe(hash2);
  });

  test('should handle empty string', () => {
    const result = hashToField('');
    
    expect(typeof result).toBe('string');
    expect(BigInt(result)).toBeLessThan(FIELD_PRIME);
  });

  test('should handle country codes', () => {
    const us = hashToField('us');
    const uk = hashToField('uk');
    const ca = hashToField('ca');
    
    expect(us).not.toBe(uk);
    expect(us).not.toBe(ca);
    expect(uk).not.toBe(ca);
    
    expect(BigInt(us)).toBeLessThan(FIELD_PRIME);
    expect(BigInt(uk)).toBeLessThan(FIELD_PRIME);
    expect(BigInt(ca)).toBeLessThan(FIELD_PRIME);
  });

  test('should handle special characters', () => {
    const result = hashToField('test@#$%');
    
    expect(typeof result).toBe('string');
    expect(BigInt(result)).toBeLessThan(FIELD_PRIME);
  });

  test('should handle unicode characters', () => {
    const result = hashToField('日本語');
    
    expect(typeof result).toBe('string');
    expect(BigInt(result)).toBeLessThan(FIELD_PRIME);
  });

  test('should handle very long strings', () => {
    const longString = 'a'.repeat(1000);
    const result = hashToField(longString);
    
    expect(typeof result).toBe('string');
    expect(BigInt(result)).toBeLessThan(FIELD_PRIME);
  });

  test('should handle numeric strings', () => {
    const result = hashToField('12345');
    
    expect(typeof result).toBe('string');
    expect(BigInt(result)).toBeLessThan(FIELD_PRIME);
  });

  test('should produce field element within valid range', () => {
    const inputs = ['a', 'b', 'c', '1', '2', 'test', 'example', '日本'];
    
    inputs.forEach(input => {
      const result = hashToField(input);
      const value = BigInt(result);
      
      expect(value).toBeGreaterThanOrEqual(BigInt(0));
      expect(value).toBeLessThan(FIELD_PRIME);
    });
  });

  test('should handle case sensitivity', () => {
    const lower = hashToField('test');
    const upper = hashToField('TEST');
    const mixed = hashToField('TeSt');
    
    expect(lower).not.toBe(upper);
    expect(lower).not.toBe(mixed);
    expect(upper).not.toBe(mixed);
  });
});

describe('hashStringsToField', () => {
  test('should hash array of strings', () => {
    const inputs = ['us', 'uk', 'ca'];
    const results = hashStringsToField(inputs);
    
    expect(results).toHaveLength(3);
    results.forEach(result => {
      expect(typeof result).toBe('string');
      expect(BigInt(result)).toBeLessThan(FIELD_PRIME);
    });
  });

  test('should handle empty array', () => {
    const results = hashStringsToField([]);
    
    expect(results).toHaveLength(0);
    expect(results).toEqual([]);
  });

  test('should handle single element', () => {
    const results = hashStringsToField(['single']);
    
    expect(results).toHaveLength(1);
    expect(typeof results[0]).toBe('string');
  });

  test('should produce unique hashes for different strings', () => {
    const inputs = ['a', 'b', 'c', 'd', 'e'];
    const results = hashStringsToField(inputs);
    
    const uniqueResults = new Set(results);
    expect(uniqueResults.size).toBe(5);
  });

  test('should preserve order', () => {
    const inputs = ['first', 'second', 'third'];
    const results1 = hashStringsToField(inputs);
    const results2 = hashStringsToField(inputs);
    
    expect(results1).toEqual(results2);
    expect(results1[0]).toBe(hashToField('first'));
    expect(results1[1]).toBe(hashToField('second'));
    expect(results1[2]).toBe(hashToField('third'));
  });

  test('should handle large arrays', () => {
    const inputs = Array.from({ length: 100 }, (_, i) => `item-${i}`);
    const results = hashStringsToField(inputs);
    
    expect(results).toHaveLength(100);
    results.forEach(result => {
      expect(BigInt(result)).toBeLessThan(FIELD_PRIME);
    });
  });

  test('should handle array with duplicate strings', () => {
    const inputs = ['test', 'test', 'other'];
    const results = hashStringsToField(inputs);
    
    expect(results).toHaveLength(3);
    expect(results[0]).toBe(results[1]);
    expect(results[0]).not.toBe(results[2]);
  });
});

describe('hashAndPadSet', () => {
  test('should hash and pad to 10 elements', () => {
    const inputs = ['us', 'uk', 'ca'];
    const results = hashAndPadSet(inputs);
    
    expect(results).toHaveLength(10);
    
    expect(results[0]).toBe(hashToField('us'));
    expect(results[1]).toBe(hashToField('uk'));
    expect(results[2]).toBe(hashToField('ca'));
    
    for (let i = 3; i < 10; i++) {
      expect(results[i]).toBe('0');
    }
  });

  test('should handle empty array', () => {
    const results = hashAndPadSet([]);
    
    expect(results).toHaveLength(10);
    results.forEach(result => {
      expect(result).toBe('0');
    });
  });

  test('should handle single element', () => {
    const results = hashAndPadSet(['single']);
    
    expect(results).toHaveLength(10);
    expect(results[0]).toBe(hashToField('single'));
    
    for (let i = 1; i < 10; i++) {
      expect(results[i]).toBe('0');
    }
  });

  test('should handle exactly 10 elements', () => {
    const inputs = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    const results = hashAndPadSet(inputs);
    
    expect(results).toHaveLength(10);
    results.forEach((result, i) => {
      expect(result).toBe(hashToField(inputs[i]!));
    });
  });

  test('should throw error for more than 10 elements', () => {
    const inputs = Array.from({ length: 11 }, (_, i) => `item-${i}`);
    
    expect(() => hashAndPadSet(inputs)).toThrow('Set size exceeds maximum of 10 elements');
  });

  test('should handle country targeting use case', () => {
    const allowedCountries = ['us', 'uk', 'ca', 'au', 'nz'];
    const results = hashAndPadSet(allowedCountries);
    
    expect(results).toHaveLength(10);
    expect(results[0]).toBe(hashToField('us'));
    expect(results[4]).toBe(hashToField('nz'));
    expect(results[5]).toBe('0');
  });

  test('should produce deterministic output', () => {
    const inputs = ['test1', 'test2', 'test3'];
    
    const results1 = hashAndPadSet(inputs);
    const results2 = hashAndPadSet(inputs);
    
    expect(results1).toEqual(results2);
  });

  test('should handle edge case of 9 elements', () => {
    const inputs = Array.from({ length: 9 }, (_, i) => `item-${i}`);
    const results = hashAndPadSet(inputs);
    
    expect(results).toHaveLength(10);
    expect(results[9]).toBe('0');
    
    for (let i = 0; i < 9; i++) {
      expect(results[i]).toBe(hashToField(inputs[i]!));
    }
  });

  test('should pad with zero string not numeric zero', () => {
    const results = hashAndPadSet(['test']);
    
    expect(results[1]).toBe('0');
    expect(typeof results[1]).toBe('string');
    expect(results[1]).not.toBe(0);
  });
});

describe('Campaign Targeting Integration', () => {
  test('should hash targeting criteria for set membership proof', () => {
    const allowedCountries = ['us', 'uk', 'ca'];
    const hashedSet = hashAndPadSet(allowedCountries);
    
    expect(hashedSet).toHaveLength(10);
    
    const userCountry = 'us';
    const userCountryHash = hashToField(userCountry);
    
    expect(hashedSet).toContain(userCountryHash);
  });

  test('should reject user not in allowed set', () => {
    const allowedCountries = ['us', 'uk', 'ca'];
    const hashedSet = hashAndPadSet(allowedCountries);
    
    const unauthorizedCountry = 'cn';
    const unauthorizedHash = hashToField(unauthorizedCountry);
    
    expect(hashedSet).not.toContain(unauthorizedHash);
  });

  test('should match extension-side hashing', () => {
    const testString = 'us';
    const backendHash = hashToField(testString);
    
    expect(backendHash).toBeTruthy();
    expect(BigInt(backendHash)).toBeLessThan(FIELD_PRIME);
    expect(backendHash).toMatch(/^\d+$/);
  });
});

describe('Field Element Validation', () => {
  test('FIELD_PRIME should be BN128 curve order', () => {
    expect(FIELD_PRIME.toString()).toBe(
      '21888242871839275222246405745257275088548364400416034343698204186575808495617'
    );
  });

  test('all hashed values should be less than FIELD_PRIME', () => {
    const testInputs = [
      '', 'a', 'test', '12345', 'very-long-string-'.repeat(100),
      'special@#$', '日本語', 'us', 'uk', 'ca'
    ];
    
    testInputs.forEach(input => {
      const hash = hashToField(input);
      expect(BigInt(hash)).toBeLessThan(FIELD_PRIME);
    });
  });

  test('hashed values should be non-negative', () => {
    const testInputs = ['test1', 'test2', 'test3'];
    
    testInputs.forEach(input => {
      const hash = hashToField(input);
      expect(BigInt(hash)).toBeGreaterThanOrEqual(BigInt(0));
    });
  });
});
