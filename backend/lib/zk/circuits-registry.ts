/**
 * ZK-SNARK Circuit Registry - BACKEND REFERENCE ONLY
 * 
 * Central registry of all available circuits with their metadata and artifact paths.
 * This file serves as reference for circuit configuration on the BACKEND.
 * 
 * NOTE: Proof generation happens in EXTENSION only (extension/lib/zk-prover.js)
 * Backend ONLY uses this for verification (loading verification keys)
 * 
 * This file helps document circuit metadata but actual proof generation
 * happens autonomously in the Chrome extension.
 */

export interface CircuitInputSchema {
  private: Record<string, 'number' | 'string' | 'boolean'>;
  public: Record<string, 'number' | 'string' | 'boolean'>;
}

export interface CircuitRegistry {
  /** Unique circuit identifier */
  name: string;

  /** Circuit category: helps organize and validate proof types */
  type: 'range' | 'set_membership' | 'custom';

  /** Path to WASM witness calculator (relative to extension/circuits or public) */
  wasmPath: string;

  /** Path to proving key (only needed in extension, for proof generation) */
  zKeyPath: string;

  /** Path to verification key (needed on backend for verification) */
  verificationKeyPath: string;

  /** Describes the circuit's expected inputs */
  inputSchema: CircuitInputSchema;

  /** Human-readable description */
  description: string;

  /** Size estimate for UI display */
  sizeBytes?: {
    wasm: number;
    zkey: number;
    verificationKey: number;
  };
}

/**
 * All registered circuits
 * 
 * Convention:
 * - WASM & witness files: bundled with extension, served from public/circuits/
 * - Proving keys: bundled with extension, NOT in git
 * - Verification keys: in public/circuits/, included in git (small files)
 */
export const CIRCUITS: Record<string, CircuitRegistry> = {
  /**
   * Age Range Proof
   * 
   * Proves: user's age is between minAge and maxAge (inclusive)
   * Private: actual age value
   * Public: minAge, maxAge (the bounds)
   * 
   * Use case: Campaign targeting by age range without revealing actual age
   * 
   * Example:
   *   Private: { age: 45 }
   *   Public: { minAge: 40, maxAge: 60 }
   *   Output: [1] (valid - 45 is between 40 and 60)
   */
  age_range: {
    name: 'age_range',
    type: 'range',
    wasmPath: '/circuits/age_range/age_range.wasm',
    zKeyPath: '/circuits/age_range/age_range_0000.zkey',
    verificationKeyPath: '/circuits/verification_keys/age_range_verification_key.json',
    inputSchema: {
      private: {
        age: 'number'
      },
      public: {
        minAge: 'number',
        maxAge: 'number'
      }
    },
    description: 'Proves user age is within specified range without revealing exact age',
    sizeBytes: {
      wasm: 34 * 1024,           // 34 KB
      zkey: 4.1 * 1024 * 1024,   // 4.1 MB
      verificationKey: 3.2 * 1024 // 3.2 KB
    }
  },

  /**
   * Range Check (Generic)
   * 
   * Proves: any numeric value is between min and max
   * Reusable for: age, income, score, etc.
   * 
   *  IMPLEMENTED
   * 
   * Example:
   *   Private: { value: 35000 }
   *   Public: { min: 25000, max: 50000 }
   *   Output: [1, 25000, 50000] (valid - 35000 is in range)
   */
  range_check: {
    name: 'range_check',
    type: 'range',
    wasmPath: '/circuits/range_check/range_check.wasm',
    zKeyPath: '/circuits/range_check/range_check_0000.zkey',
    verificationKeyPath: '/circuits/verification_keys/range_check_verification_key.json',
    inputSchema: {
      private: {
        value: 'number'
      },
      public: {
        min: 'number',
        max: 'number'
      }
    },
    description: 'Generic circuit for proving any numeric value is within bounds',
    sizeBytes: {
      wasm: 34 * 1024,
      zkey: 4 * 1024 * 1024,
      verificationKey: 3.2 * 1024
    }
  },

  /**
   * Set Membership Proof (Generic)
   * 
   * Proves: a hashed value is in an allowed set
   * Reusable for: countries, interests, categories, etc.
   * 
   *  IMPLEMENTED
   * 
   * IMPORTANT: Uses SHA-256 hashing for string-to-field conversion
   * 
   * Example:
   *   Private: { value: "uk" }  hashed to field element
   *   Public: { set: ["us", "uk", "ca"] }  each hashed to field element, padded to 10
   *   Output: [1, hash("us"), hash("uk"), hash("ca"), 0, 0, 0, 0, 0, 0, 0]
   * 
   * Backend MUST use identical hashing:
   *   hashToField(str) = SHA-256(str) mod FIELD_PRIME
   *   FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617
   */
  set_membership: {
    name: 'set_membership',
    type: 'set_membership',
    wasmPath: '/circuits/set_membership/set_membership.wasm',
    zKeyPath: '/circuits/set_membership/set_membership_0000.zkey',
    verificationKeyPath: '/circuits/verification_keys/set_membership_verification_key.json',
    inputSchema: {
      private: {
        value: 'string'  // Hash of the actual value
      },
      public: {
        set: 'string'  // Array of 10 hashed values (padded with "0")
      }
    },
    description: 'Generic circuit for proving a hashed value is in an allowed set (max 10 elements)',
    sizeBytes: {
      wasm: 42 * 1024,
      zkey: 4.6 * 1024 * 1024,
      verificationKey: 4.6 * 1024
    }
  }
};

/**
 * Get circuit by name
 * Throws if circuit not found
 */
export function getCircuit(name: string): CircuitRegistry {
  const circuit = CIRCUITS[name];
  if (!circuit) {
    throw new Error(`Circuit not found: ${name}. Available: ${Object.keys(CIRCUITS).join(', ')}`);
  }
  return circuit;
}

/**
 * Get all circuits of a specific type
 */
export function getCircuitsByType(type: CircuitRegistry['type']): CircuitRegistry[] {
  return Object.values(CIRCUITS).filter(c => c.type === type);
}

/**
 * Validate circuit inputs against schema
 */
export function validateCircuitInputs(
  circuitName: string,
  privateInputs: Record<string, any>,
  publicInputs: Record<string, any>
): { valid: boolean; errors: string[] } {
  const circuit = getCircuit(circuitName);
  const errors: string[] = [];

  // Validate private inputs
  for (const [key, expectedType] of Object.entries(circuit.inputSchema.private)) {
    if (!(key in privateInputs)) {
      errors.push(`Missing private input: ${key}`);
    } else if (typeof privateInputs[key] !== expectedType && expectedType !== 'string') {
      errors.push(
        `Invalid type for private input ${key}: expected ${expectedType}, got ${typeof privateInputs[key]}`
      );
    }
  }

  // Check for unexpected private inputs
  for (const key of Object.keys(privateInputs)) {
    if (!(key in circuit.inputSchema.private)) {
      errors.push(`Unexpected private input: ${key}`);
    }
  }

  // Validate public inputs
  for (const [key, expectedType] of Object.entries(circuit.inputSchema.public)) {
    if (!(key in publicInputs)) {
      errors.push(`Missing public input: ${key}`);
    } else if (typeof publicInputs[key] !== expectedType && expectedType !== 'string') {
      errors.push(
        `Invalid type for public input ${key}: expected ${expectedType}, got ${typeof publicInputs[key]}`
      );
    }
  }

  // Check for unexpected public inputs
  for (const key of Object.keys(publicInputs)) {
    if (!(key in circuit.inputSchema.public)) {
      errors.push(`Unexpected public input: ${key}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * List all available circuit names
 */
export function listCircuits(): string[] {
  return Object.keys(CIRCUITS);
}
