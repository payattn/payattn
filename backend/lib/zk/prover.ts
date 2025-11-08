/**
 * ZK-SNARK Proof Generation
 * 
 * Handles generating cryptographic proofs using snarkjs and precompiled circuits.
 * This is the core function that creates zero-knowledge proofs.
 */

import * as snarkjs from 'snarkjs';
import { generateWitness, loadWitnessCalculator, witnessToStringArray } from './witness';
import { getCircuit, validateCircuitInputs } from '../zk/circuits-registry';

/**
 * Proof structure matching snarkjs Groth16 format
 */
export interface Groth16Proof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: string;
  curve: string;
}

/**
 * Complete proof package with metadata
 */
export interface ProofPackage {
  circuitName: string;
  proof: Groth16Proof;
  publicSignals: string[];
  timestamp: number;
  version: string;
}

/**
 * Options for proof generation
 */
export interface ProveOptions {
  /** Show progress during proof generation */
  verbose?: boolean;

  /** Cache proving key after first load */
  cacheKey?: boolean;

  /** Use web worker for proof generation (if available) */
  useWorker?: boolean;
}

/**
 * Internal cache for proving keys (large files, don't reload)
 */
const provingKeyCache = new Map<string, any>();

/**
 * Load proving key from file
 * 
 * @param zKeyPath - Path to .zkey file
 * @returns Parsed proving key
 */
async function loadProvingKey(zKeyPath: string): Promise<any> {
  // Check cache first
  if (provingKeyCache.has(zKeyPath)) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[ZK] Loaded proving key from cache: ${zKeyPath}`);
    }
    return provingKeyCache.get(zKeyPath);
  }

  try {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[ZK] Loading proving key from: ${zKeyPath}`);
    }

    const response = await fetch(zKeyPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch proving key: ${response.statusText}`);
    }

    const zKeyBuffer = await response.arrayBuffer();
    const zKeyBytes = new Uint8Array(zKeyBuffer);

    provingKeyCache.set(zKeyPath, zKeyBytes);
    return zKeyBytes;
  } catch (error) {
    throw new Error(`Failed to load proving key from ${zKeyPath}: ${error}`);
  }
}

/**
 * Main proof generation function
 * 
 * @param circuitName - Name of circuit to use (from registry)
 * @param privateInputs - Private inputs (kept secret, not sent to backend)
 * @param publicInputs - Public inputs (visible in proof, checked by backend)
 * @param options - Proof generation options
 * @returns Complete proof package ready to send to backend
 */
export async function generateProof(
  circuitName: string,
  privateInputs: Record<string, any>,
  publicInputs: Record<string, any>,
  options: ProveOptions = {}
): Promise<ProofPackage> {
  const { verbose = false, cacheKey = true, useWorker = false } = options;

  try {
    // 1. Validate inputs
    if (verbose) console.log(`[ZK] Validating inputs for circuit: ${circuitName}`);

    const validation = validateCircuitInputs(circuitName, privateInputs, publicInputs);
    if (!validation.valid) {
      throw new Error(`Invalid inputs: ${validation.errors.join(', ')}`);
    }

    // 2. Get circuit metadata
    const circuit = getCircuit(circuitName);
    if (verbose) console.log(`[ZK] Using circuit: ${circuit.description}`);

    // 3. Combine all inputs for witness calculation
    const allInputs = { ...privateInputs, ...publicInputs };

    // 4. Load witness calculator and generate witness
    if (verbose) console.log('[ZK] Loading witness calculator...');

    // For circom circuits, we need to load both the WASM and the JavaScript wrapper
    // The witness_calculator.js exports a factory function
    const witnessCalculatorPath = circuit.wasmPath.replace('.wasm', '_js/witness_calculator');
    const calculator = await loadWitnessCalculator(witnessCalculatorPath, circuit.wasmPath);

    if (verbose) console.log('[ZK] Generating witness...');
    const witness = await generateWitness(calculator, allInputs);

    if (verbose) console.log(`[ZK] Witness generated (${witness.length} field elements)`);

    // 5. Load proving key
    if (verbose) console.log('[ZK] Loading proving key...');
    const zKey = await loadProvingKey(circuit.zKeyPath);

    if (verbose) console.log('[ZK] Generating proof (this may take a moment)...');

    // 6. Generate Groth16 proof
    // Note: snarkjs.groth16.prove expects witness as array of strings for field elements
    const witnessStrings = witnessToStringArray(witness);

    const { proof, publicSignals } = await snarkjs.groth16.prove(
      zKey,
      witnessStrings as any  // Type compatibility with snarkjs
    );

    if (verbose) {
      console.log('[ZK] Proof generated successfully');
      console.log(`[ZK] Public signals: ${publicSignals.join(', ')}`);
    }

    // 7. Optionally cache the key
    if (cacheKey && !provingKeyCache.has(circuit.zKeyPath)) {
      provingKeyCache.set(circuit.zKeyPath, zKey);
    }

    // 8. Return complete proof package
    const proofPackage: ProofPackage = {
      circuitName,
      proof: proof as Groth16Proof,
      publicSignals,
      timestamp: Date.now(),
      version: '1.0'
    };

    return proofPackage;
  } catch (error) {
    throw new Error(
      `Failed to generate proof for circuit "${circuitName}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Convenience function for age range proofs
 * 
 * @param age - User's actual age (private)
 * @param minAge - Minimum age for campaign (public)
 * @param maxAge - Maximum age for campaign (public)
 * @param options - Proof generation options
 * @returns Proof package ready to send to backend
 */
export async function generateAgeProof(
  age: number,
  minAge: number,
  maxAge: number,
  options?: ProveOptions
): Promise<ProofPackage> {
  return generateProof(
    'age_range',
    { age },
    { minAge, maxAge },
    options
  );
}

/**
 * Clear proving key cache (for memory management)
 */
export function clearProvingKeyCache(): void {
  provingKeyCache.clear();
}

/**
 * Get proving key cache statistics
 */
export function getProvingKeyCacheStats(): { size: number; entries: string[] } {
  return {
    size: provingKeyCache.size,
    entries: Array.from(provingKeyCache.keys())
  };
}

/**
 * Serialize proof package to JSON (for sending to backend)
 */
export function serializeProof(pkg: ProofPackage): string {
  return JSON.stringify(pkg);
}

/**
 * Deserialize proof package from JSON (for backend receiving)
 */
export function deserializeProof(json: string): ProofPackage {
  return JSON.parse(json);
}
