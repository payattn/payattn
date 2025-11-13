/**
 * Tests for ZK-SNARK Witness Generation (witness.ts)
 * 
 * Tests witness calculator loading, witness generation, and utility functions
 */

import {
  loadWitnessCalculator,
  generateWitness,
  witnessToStringArray,
  extractPublicSignals,
  clearWasmCache,
  getWasmCacheStats
} from '../witness';

// Mock global fetch
global.fetch = jest.fn();

// Mock WebAssembly
global.WebAssembly = {
  instantiate: jest.fn()
} as any;

describe('witness.ts - ZK-SNARK Witness Generation', () => {
  const mockWasmPath = '/circuits/age_range.wasm';
  const mockCalculatorPath = '/circuits/age_range_js/witness_calculator';

  const mockCalculator = {
    calculateWitness: jest.fn().mockResolvedValue([
      BigInt(1),
      BigInt(25),
      BigInt(18),
      BigInt(65)
    ])
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearWasmCache();

    // Reset fetch mock
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      statusText: 'OK',
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(100))
    });

    // Reset WebAssembly mock
    (global.WebAssembly.instantiate as jest.Mock).mockResolvedValue({
      instance: {
        exports: mockCalculator
      }
    });
  });

  describe('loadWitnessCalculator()', () => {
    test('should throw error if module import fails', async () => {
      // Dynamic import fails in test environment - this documents the error handling
      await expect(
        loadWitnessCalculator('/nonexistent/path', '/nonexistent/wasm')
      ).rejects.toThrow();
    });

    test('should throw error if calculator factory not found', async () => {
      // Documents error when module doesn't export expected interface
      await expect(
        loadWitnessCalculator('/invalid/module', mockWasmPath)
      ).rejects.toThrow();
    });

    test('should handle errors in calculator loading', async () => {
      // Documents error handling for various failure modes
      await expect(
        loadWitnessCalculator('/error/path', '/error/wasm')
      ).rejects.toThrow('Failed to load witness calculator');
    });
  });

  describe('generateWitness()', () => {
    test('should generate witness from calculator and inputs', async () => {
      const inputs = { age: 25, minAge: 18, maxAge: 65 };
      const witness = await generateWitness(mockCalculator, inputs);

      expect(mockCalculator.calculateWitness).toHaveBeenCalled();
      expect(Array.isArray(witness)).toBe(true);
      expect(witness.length).toBeGreaterThan(0);
    });

    test('should convert number inputs to strings', async () => {
      const inputs = { age: 25, minAge: 18, maxAge: 65 };
      await generateWitness(mockCalculator, inputs);

      expect(mockCalculator.calculateWitness).toHaveBeenCalledWith(
        {
          age: '25',
          minAge: '18',
          maxAge: '65'
        },
        true
      );
    });

    test('should convert bigint inputs to strings', async () => {
      const inputs = { value: BigInt(12345) };
      await generateWitness(mockCalculator, inputs);

      expect(mockCalculator.calculateWitness).toHaveBeenCalledWith(
        { value: '12345' },
        true
      );
    });

    test('should handle string inputs directly', async () => {
      const inputs = { hash: '0x123abc' };
      await generateWitness(mockCalculator, inputs);

      expect(mockCalculator.calculateWitness).toHaveBeenCalledWith(
        { hash: '0x123abc' },
        true
      );
    });

    test('should convert array inputs to strings', async () => {
      const inputs = { values: [1, 2, 3] };
      await generateWitness(mockCalculator, inputs);

      expect(mockCalculator.calculateWitness).toHaveBeenCalledWith(
        { values: '1,2,3' },
        true
      );
    });

    test('should handle mixed input types', async () => {
      const inputs = {
        number: 42,
        bigint: BigInt(99),
        string: 'test',
        array: [1, 2]
      };

      await generateWitness(mockCalculator, inputs);

      expect(mockCalculator.calculateWitness).toHaveBeenCalledWith(
        {
          number: '42',
          bigint: '99',
          string: 'test',
          array: '1,2'
        },
        true
      );
    });

    test('should enable sanity check by default', async () => {
      await generateWitness(mockCalculator, { age: 25 });

      expect(mockCalculator.calculateWitness).toHaveBeenCalledWith(
        expect.any(Object),
        true
      );
    });

    test('should return bigint array', async () => {
      const witness = await generateWitness(mockCalculator, { age: 25 });

      expect(Array.isArray(witness)).toBe(true);
      witness.forEach((w: bigint) => {
        expect(typeof w).toBe('bigint');
      });
    });

    test('should throw error if witness calculation fails', async () => {
      mockCalculator.calculateWitness.mockRejectedValue(
        new Error('Constraint not satisfied')
      );

      await expect(
        generateWitness(mockCalculator, { age: 25 })
      ).rejects.toThrow('Failed to generate witness');
    });

    test('should handle empty inputs', async () => {
      mockCalculator.calculateWitness.mockResolvedValue([BigInt(1)]);
      await generateWitness(mockCalculator, {});

      expect(mockCalculator.calculateWitness).toHaveBeenCalledWith({}, true);
    });

    test('should convert object inputs to strings', async () => {
      mockCalculator.calculateWitness.mockResolvedValue([BigInt(1)]);
      const inputs = { config: { setting: 'value' } };
      await generateWitness(mockCalculator, inputs);

      expect(mockCalculator.calculateWitness).toHaveBeenCalledWith(
        { config: '[object Object]' },
        true
      );
    });
  });

  describe('witnessToStringArray()', () => {
    test('should convert bigint array to string array', () => {
      const witness = [BigInt(1), BigInt(25), BigInt(18), BigInt(65)];
      const result = witnessToStringArray(witness);

      expect(result).toEqual(['1', '25', '18', '65']);
    });

    test('should handle large bigint values', () => {
      const witness = [
        BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617')
      ];
      const result = witnessToStringArray(witness);

      expect(result[0]).toBe('21888242871839275222246405745257275088548364400416034343698204186575808495617');
    });

    test('should handle empty witness', () => {
      const witness: bigint[] = [];
      const result = witnessToStringArray(witness);

      expect(result).toEqual([]);
    });

    test('should preserve witness order', () => {
      const witness = [BigInt(3), BigInt(1), BigInt(4), BigInt(1), BigInt(5)];
      const result = witnessToStringArray(witness);

      expect(result).toEqual(['3', '1', '4', '1', '5']);
    });

    test('should handle single element witness', () => {
      const witness = [BigInt(1)];
      const result = witnessToStringArray(witness);

      expect(result).toEqual(['1']);
    });
  });

  describe('extractPublicSignals()', () => {
    const witness = [
      BigInt(1),   // Index 0: constant
      BigInt(25),  // Index 1: output signal
      BigInt(18),  // Index 2: public input
      BigInt(65),  // Index 3: public input
      BigInt(42),  // Index 4: internal signal
      BigInt(99)   // Index 5: internal signal
    ];

    test('should extract public signals at specified indices', () => {
      const publicIndices = [1, 2, 3];
      const signals = extractPublicSignals(witness, publicIndices);

      expect(signals).toEqual([BigInt(25), BigInt(18), BigInt(65)]);
    });

    test('should handle single public signal', () => {
      const publicIndices = [1];
      const signals = extractPublicSignals(witness, publicIndices);

      expect(signals).toEqual([BigInt(25)]);
    });

    test('should handle empty indices array', () => {
      const signals = extractPublicSignals(witness, []);

      expect(signals).toEqual([]);
    });

    test('should preserve order of indices', () => {
      const publicIndices = [3, 1, 2]; // Out of order
      const signals = extractPublicSignals(witness, publicIndices);

      expect(signals).toEqual([BigInt(65), BigInt(25), BigInt(18)]);
    });

    test('should throw error for out-of-bounds index', () => {
      const publicIndices = [99];

      expect(() => extractPublicSignals(witness, publicIndices)).toThrow(
        'Public signal index 99 out of bounds'
      );
    });

    test('should handle index at witness boundary', () => {
      const publicIndices = [5]; // Last valid index
      const signals = extractPublicSignals(witness, publicIndices);

      expect(signals).toEqual([BigInt(99)]);
    });

    test('should extract constant at index 0', () => {
      const publicIndices = [0];
      const signals = extractPublicSignals(witness, publicIndices);

      expect(signals).toEqual([BigInt(1)]);
    });

    test('should handle duplicate indices', () => {
      const publicIndices = [1, 1, 2];
      const signals = extractPublicSignals(witness, publicIndices);

      expect(signals).toEqual([BigInt(25), BigInt(25), BigInt(18)]);
    });

    test('should work with minimal witness', () => {
      const minimalWitness = [BigInt(1), BigInt(42)];
      const signals = extractPublicSignals(minimalWitness, [1]);

      expect(signals).toEqual([BigInt(42)]);
    });
  });

  describe('WASM cache management', () => {
    test('clearWasmCache() should clear the cache', () => {
      clearWasmCache();

      const stats = getWasmCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.entries).toEqual([]);
    });

    test('getWasmCacheStats() should return cache statistics', () => {
      const stats = getWasmCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('entries');
      expect(typeof stats.size).toBe('number');
      expect(Array.isArray(stats.entries)).toBe(true);
    });

    test('cache entries should be empty after clear', () => {
      clearWasmCache();

      const stats = getWasmCacheStats();
      expect(stats.entries.length).toBe(0);
    });

    test('clearing cache should remove all entries', () => {
      clearWasmCache();

      const stats = getWasmCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('WitnessCalculator interface', () => {
    test('calculator should have calculateWitness method', () => {
      expect(mockCalculator).toHaveProperty('calculateWitness');
      expect(typeof mockCalculator.calculateWitness).toBe('function');
    });

    test('calculateWitness should return promise of bigint array', async () => {
      const result = await mockCalculator.calculateWitness({}, true);

      expect(Array.isArray(result)).toBe(true);
      result.forEach((value: bigint) => {
        expect(typeof value).toBe('bigint');
      });
    });

    test('calculator may have optional loadSymbols method', () => {
      const calculatorWithSymbols = {
        ...mockCalculator,
        loadSymbols: jest.fn()
      };

      expect(calculatorWithSymbols.loadSymbols).toBeDefined();
    });

    test('calculator may have optional getVersion method', () => {
      const calculatorWithVersion = {
        ...mockCalculator,
        getVersion: jest.fn().mockReturnValue('1.0.0')
      };

      expect(calculatorWithVersion.getVersion).toBeDefined();
      expect(calculatorWithVersion.getVersion()).toBe('1.0.0');
    });
  });

  describe('Error handling', () => {
    test('should handle calculator loading errors gracefully', async () => {
      await expect(
        loadWitnessCalculator('/invalid/path', '/invalid/wasm')
      ).rejects.toThrow();
    });

    test('should provide descriptive error messages', async () => {
      mockCalculator.calculateWitness.mockRejectedValue(
        new Error('Invalid input for signal "age"')
      );

      await expect(
        generateWitness(mockCalculator, { age: 'invalid' })
      ).rejects.toThrow('Failed to generate witness');
    });

    test('should handle missing required inputs', async () => {
      mockCalculator.calculateWitness.mockRejectedValue(
        new Error('Missing input: age')
      );

      await expect(
        generateWitness(mockCalculator, {})
      ).rejects.toThrow('Failed to generate witness');
    });

    test('should handle constraint violations', async () => {
      mockCalculator.calculateWitness.mockRejectedValue(
        new Error('Constraint not satisfied')
      );

      await expect(
        generateWitness(mockCalculator, { age: 150 })
      ).rejects.toThrow('Failed to generate witness');
    });
  });

  describe('Input conversion edge cases', () => {
    beforeEach(() => {
      // Reset mock to return success for edge case tests
      mockCalculator.calculateWitness.mockResolvedValue([BigInt(1)]);
    });

    test('should handle zero values', async () => {
      await generateWitness(mockCalculator, { value: 0 });

      expect(mockCalculator.calculateWitness).toHaveBeenCalledWith(
        { value: '0' },
        true
      );
    });

    test('should handle negative numbers', async () => {
      await generateWitness(mockCalculator, { value: -42 });

      expect(mockCalculator.calculateWitness).toHaveBeenCalledWith(
        { value: '-42' },
        true
      );
    });

    test('should handle very large numbers', async () => {
      const largeNumber = BigInt('999999999999999999999');
      await generateWitness(mockCalculator, { value: largeNumber });

      expect(mockCalculator.calculateWitness).toHaveBeenCalledWith(
        { value: '999999999999999999999' },
        true
      );
    });

    test('should handle boolean values', async () => {
      await generateWitness(mockCalculator, { flag: true });

      expect(mockCalculator.calculateWitness).toHaveBeenCalledWith(
        { flag: 'true' },
        true
      );
    });

    test('should handle null values', async () => {
      await generateWitness(mockCalculator, { value: null });

      expect(mockCalculator.calculateWitness).toHaveBeenCalledWith(
        { value: 'null' },
        true
      );
    });

    test('should handle undefined values', async () => {
      await generateWitness(mockCalculator, { value: undefined });

      expect(mockCalculator.calculateWitness).toHaveBeenCalledWith(
        { value: 'undefined' },
        true
      );
    });
  });
});
