/**
 * ZK-SNARK Proof Verification (Backend)
 * 
 * Handles verifying cryptographic proofs on the backend/advertiser side.
 * Uses verification keys (public, safe to expose) to confirm proofs are valid.
 */

import * as snarkjs from 'snarkjs';
import { getCircuit } from '../zk/circuits-registry';

/**
 * Verification result with details
 */
export interface VerificationResult {
  valid: boolean;
  circuitName: string;
  publicSignals: string[];
  message: string;
  timestamp: number;
}

/**
 * Internal cache for verification keys (small files, safe to cache)
 */
const verificationKeyCache = new Map<string, any>();

/**
 * Load verification key from file
 * 
 * @param keyPath - Path to verification_key.json
 * @returns Parsed verification key
 */
async function loadVerificationKey(keyPath: string): Promise<any> {
  // Check cache first
  if (verificationKeyCache.has(keyPath)) {
    return verificationKeyCache.get(keyPath);
  }

  try {
    const response = await fetch(keyPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch verification key: ${response.statusText}`);
    }

    const verificationKey = await response.json();
    verificationKeyCache.set(keyPath, verificationKey);

    return verificationKey;
  } catch (error) {
    throw new Error(`Failed to load verification key from ${keyPath}: ${error}`);
  }
}

/**
 * Verify a ZK proof
 * 
 * @param circuitName - Name of circuit (must match what user used to generate proof)
 * @param proof - Groth16 proof from user
 * @param publicSignals - Public signals from proof (what was proven)
 * @returns Verification result
 */
export async function verifyProof(
  circuitName: string,
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol?: string;
    curve?: string;
  },
  publicSignals: string[]
): Promise<VerificationResult> {
  try {
    // 1. Get circuit metadata
    const circuit = getCircuit(circuitName);

    // 2. Load verification key
    const verificationKey = await loadVerificationKey(circuit.verificationKeyPath);

    // 3. Verify the proof
    // snarkjs.groth16.verify expects proof and publicSignals as arrays/strings
    const isValid = await snarkjs.groth16.verify(verificationKey, publicSignals, proof);

    return {
      valid: isValid,
      circuitName,
      publicSignals,
      message: isValid ? 'Proof verified successfully' : 'Proof verification failed',
      timestamp: Date.now()
    };
  } catch (error) {
    return {
      valid: false,
      circuitName,
      publicSignals,
      message: `Verification error: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: Date.now()
    };
  }
}

/**
 * Verify and validate age proof specifically
 * 
 * @param proof - Groth16 proof
 * @param publicSignals - Public signals [1, minAge, maxAge]
 * @returns Verification result with age-specific validation
 */
export async function verifyAgeProof(
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol?: string;
    curve?: string;
  },
  publicSignals: string[]
): Promise<VerificationResult & { ageRange?: { min: number; max: number } }> {
  const result = await verifyProof('age_range', proof, publicSignals);

  if (result.valid && publicSignals.length >= 3) {
    // Extract age range from public signals
    // Note: depends on circuit's signal order
    // Typically: [valid, minAge, maxAge]
    const minAgeSignal = publicSignals[1];
    const maxAgeSignal = publicSignals[2];

    if (minAgeSignal && maxAgeSignal) {
      const minAge = parseInt(minAgeSignal, 10);
      const maxAge = parseInt(maxAgeSignal, 10);

      return {
        ...result,
        ageRange: { min: minAge, max: maxAge }
      };
    }
  }

  return result;
}

/**
 * Batch verify multiple proofs (useful for campaigns with multiple criteria)
 * 
 * @param proofs - Array of [circuitName, proof, publicSignals]
 * @returns Array of verification results
 */
export async function verifyProofBatch(
  proofs: Array<{
    circuitName: string;
    proof: {
      pi_a: string[];
      pi_b: string[][];
      pi_c: string[];
      protocol?: string;
      curve?: string;
    };
    publicSignals: string[];
  }>
): Promise<VerificationResult[]> {
  return Promise.all(
    proofs.map(p => verifyProof(p.circuitName, p.proof, p.publicSignals))
  );
}

/**
 * Check if all proofs in a batch are valid
 * 
 * @param results - Verification results from verifyProofBatch
 * @returns true if all proofs are valid
 */
export function allProofsValid(results: VerificationResult[]): boolean {
  return results.every(r => r.valid);
}

/**
 * Clear verification key cache
 */
export function clearVerificationKeyCache(): void {
  verificationKeyCache.clear();
}

/**
 * Get verification key cache statistics
 */
export function getVerificationKeyCacheStats(): { size: number; entries: string[] } {
  return {
    size: verificationKeyCache.size,
    entries: Array.from(verificationKeyCache.keys())
  };
}
