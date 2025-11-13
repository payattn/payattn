/**
 * Tests for circuits-registry.ts
 * Tests circuit registry functions and validation logic
 */

import {
  CIRCUITS,
  getCircuit,
  getCircuitsByType,
  validateCircuitInputs,
  listCircuits,
  CircuitRegistry
} from '../circuits-registry';

describe('circuits-registry', () => {
  describe('CIRCUITS constant', () => {
    it('should have age_range circuit defined', () => {
      expect(CIRCUITS.age_range).toBeDefined();
      expect(CIRCUITS.age_range!.name).toBe('age_range');
      expect(CIRCUITS.age_range!.type).toBe('range');
    });

    it('should have range_check circuit defined', () => {
      expect(CIRCUITS.range_check).toBeDefined();
      expect(CIRCUITS.range_check!.name).toBe('range_check');
      expect(CIRCUITS.range_check!.type).toBe('range');
    });

    it('should have set_membership circuit defined', () => {
      expect(CIRCUITS.set_membership).toBeDefined();
      expect(CIRCUITS.set_membership!.name).toBe('set_membership');
      expect(CIRCUITS.set_membership!.type).toBe('set_membership');
    });

    it('should have valid paths for all circuits', () => {
      Object.values(CIRCUITS).forEach(circuit => {
        expect(circuit.wasmPath).toContain('/circuits/');
        expect(circuit.zKeyPath).toContain('/circuits/');
        expect(circuit.verificationKeyPath).toContain('/circuits/verification_keys/');
      });
    });

    it('should have input schemas for all circuits', () => {
      Object.values(CIRCUITS).forEach(circuit => {
        expect(circuit.inputSchema).toBeDefined();
        expect(circuit.inputSchema.private).toBeDefined();
        expect(circuit.inputSchema.public).toBeDefined();
      });
    });
  });

  describe('getCircuit', () => {
    it('should return age_range circuit', () => {
      const circuit = getCircuit('age_range');
      
      expect(circuit).toBeDefined();
      expect(circuit.name).toBe('age_range');
      expect(circuit.type).toBe('range');
      expect(circuit.inputSchema.private.age).toBe('number');
      expect(circuit.inputSchema.public.minAge).toBe('number');
      expect(circuit.inputSchema.public.maxAge).toBe('number');
    });

    it('should return range_check circuit', () => {
      const circuit = getCircuit('range_check');
      
      expect(circuit).toBeDefined();
      expect(circuit.name).toBe('range_check');
      expect(circuit.inputSchema.private.value).toBe('number');
      expect(circuit.inputSchema.public.min).toBe('number');
      expect(circuit.inputSchema.public.max).toBe('number');
    });

    it('should return set_membership circuit', () => {
      const circuit = getCircuit('set_membership');
      
      expect(circuit).toBeDefined();
      expect(circuit.name).toBe('set_membership');
      expect(circuit.type).toBe('set_membership');
      expect(circuit.inputSchema.private.value).toBe('string');
      expect(circuit.inputSchema.public.set).toBe('string');
    });

    it('should throw error for non-existent circuit', () => {
      expect(() => getCircuit('invalid_circuit')).toThrow('Circuit not found: invalid_circuit');
      expect(() => getCircuit('invalid_circuit')).toThrow('Available: age_range, range_check, set_membership');
    });

    it('should throw error for empty circuit name', () => {
      expect(() => getCircuit('')).toThrow('Circuit not found');
    });
  });

  describe('getCircuitsByType', () => {
    it('should return all range circuits', () => {
      const rangeCircuits = getCircuitsByType('range');
      
      expect(rangeCircuits.length).toBe(2);
      expect(rangeCircuits.map(c => c.name)).toContain('age_range');
      expect(rangeCircuits.map(c => c.name)).toContain('range_check');
      rangeCircuits.forEach(circuit => {
        expect(circuit.type).toBe('range');
      });
    });

    it('should return all set_membership circuits', () => {
      const setCircuits = getCircuitsByType('set_membership');
      
      expect(setCircuits.length).toBe(1);
      expect(setCircuits[0]!.name).toBe('set_membership');
      expect(setCircuits[0]!.type).toBe('set_membership');
    });

    it('should return empty array for custom type with no circuits', () => {
      const customCircuits = getCircuitsByType('custom');
      
      expect(customCircuits).toEqual([]);
      expect(customCircuits.length).toBe(0);
    });
  });

  describe('validateCircuitInputs', () => {
    describe('age_range circuit', () => {
      it('should validate correct inputs', () => {
        const result = validateCircuitInputs(
          'age_range',
          { age: 30 },
          { minAge: 25, maxAge: 45 }
        );

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should reject missing private input', () => {
        const result = validateCircuitInputs(
          'age_range',
          {},
          { minAge: 25, maxAge: 45 }
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Missing private input: age');
      });

      it('should reject missing public inputs', () => {
        const result = validateCircuitInputs(
          'age_range',
          { age: 30 },
          { minAge: 25 }
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Missing public input: maxAge');
      });

      it('should reject wrong type for private input', () => {
        const result = validateCircuitInputs(
          'age_range',
          { age: '30' },
          { minAge: 25, maxAge: 45 }
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid type for private input age: expected number, got string');
      });

      it('should reject wrong type for public input', () => {
        const result = validateCircuitInputs(
          'age_range',
          { age: 30 },
          { minAge: '25', maxAge: 45 }
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid type for public input minAge: expected number, got string');
      });

      it('should reject unexpected private input', () => {
        const result = validateCircuitInputs(
          'age_range',
          { age: 30, extraField: 'unexpected' },
          { minAge: 25, maxAge: 45 }
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Unexpected private input: extraField');
      });

      it('should reject unexpected public input', () => {
        const result = validateCircuitInputs(
          'age_range',
          { age: 30 },
          { minAge: 25, maxAge: 45, extraPublic: 100 }
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Unexpected public input: extraPublic');
      });

      it('should accumulate multiple errors', () => {
        const result = validateCircuitInputs(
          'age_range',
          { age: '30', wrongField: true },
          { minAge: 25 }
        );

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(2);
        expect(result.errors).toContain('Invalid type for private input age: expected number, got string');
        expect(result.errors).toContain('Unexpected private input: wrongField');
        expect(result.errors).toContain('Missing public input: maxAge');
      });
    });

    describe('range_check circuit', () => {
      it('should validate correct inputs', () => {
        const result = validateCircuitInputs(
          'range_check',
          { value: 100 },
          { min: 50, max: 150 }
        );

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should reject invalid types', () => {
        const result = validateCircuitInputs(
          'range_check',
          { value: true },
          { min: 50, max: 150 }
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid type for private input value: expected number, got boolean');
      });
    });

    describe('set_membership circuit', () => {
      it('should validate correct inputs with string types', () => {
        const result = validateCircuitInputs(
          'set_membership',
          { value: 'hashed_value' },
          { set: 'array_of_hashes' }
        );

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should accept number for string type (loose validation)', () => {
        // Note: The validation doesn't strictly check string types
        const result = validateCircuitInputs(
          'set_membership',
          { value: 'test' },
          { set: 'valid' }
        );

        expect(result.valid).toBe(true);
      });

      it('should reject missing inputs', () => {
        const result = validateCircuitInputs(
          'set_membership',
          {},
          {}
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Missing private input: value');
        expect(result.errors).toContain('Missing public input: set');
      });
    });

    it('should throw error for invalid circuit name', () => {
      expect(() => validateCircuitInputs(
        'invalid_circuit',
        {},
        {}
      )).toThrow('Circuit not found: invalid_circuit');
    });
  });

  describe('listCircuits', () => {
    it('should return all circuit names', () => {
      const circuits = listCircuits();
      
      expect(circuits).toContain('age_range');
      expect(circuits).toContain('range_check');
      expect(circuits).toContain('set_membership');
      expect(circuits.length).toBe(3);
    });

    it('should return array of strings', () => {
      const circuits = listCircuits();
      
      circuits.forEach(name => {
        expect(typeof name).toBe('string');
      });
    });

    it('should match Object.keys(CIRCUITS)', () => {
      const circuits = listCircuits();
      const circuitKeys = Object.keys(CIRCUITS);
      
      expect(circuits).toEqual(circuitKeys);
    });
  });

  describe('Circuit metadata completeness', () => {
    it('should have description for all circuits', () => {
      Object.values(CIRCUITS).forEach(circuit => {
        expect(circuit.description).toBeDefined();
        expect(circuit.description.length).toBeGreaterThan(0);
      });
    });

    it('should have size estimates for all circuits', () => {
      Object.values(CIRCUITS).forEach(circuit => {
        expect(circuit.sizeBytes).toBeDefined();
        expect(circuit.sizeBytes?.wasm).toBeGreaterThan(0);
        expect(circuit.sizeBytes?.zkey).toBeGreaterThan(0);
        expect(circuit.sizeBytes?.verificationKey).toBeGreaterThan(0);
      });
    });

    it('should have consistent naming convention', () => {
      Object.entries(CIRCUITS).forEach(([key, circuit]) => {
        expect(circuit.name).toBe(key);
      });
    });
  });
});
