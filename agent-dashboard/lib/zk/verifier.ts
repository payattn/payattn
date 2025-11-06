/**
 * ZK-SNARK Proof Verification (Backend Only)
 * 
 * VERIFICATION ONLY - Does NOT generate proofs
 * Receives proofs from extension, verifies them using Cloudflare Worker
 * 
 * Data Flow:
 *   Extension (proof generation) → private data stays here ✅
 *   Extension sends proof → /api/verify-proof → Cloudflare Worker → backend ✅
 *   Backend receives verified result → advertiser is notified ✅
 * 
 * Uses Cloudflare Workers (V8 runtime) to avoid Node.js BN128 hanging issue.
 */

import { getCircuit } from './circuits-registry';

// Cloudflare Worker endpoint for verification
const CLOUDFLARE_WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https://payattn-zk-verifier.jmd-1bc.workers.dev';

/**
 * Verification result with details
 */
export interface VerificationResult {
  valid: boolean;
  circuitName: string;
  publicSignals: string[];
  message: string;
  timestamp: number;
  verificationTime?: number;
}

/**
 * Internal cache for verification keys (small files, safe to cache)
 */
const verificationKeyCache = new Map<string, any>();

/**
 * Load verification key from file
 * 
 * @param keyPath - Path to verification_key.json (relative to public folder)
 * @returns Parsed verification key
 */
async function loadVerificationKey(keyPath: string): Promise<any> {
  // Check cache first
  if (verificationKeyCache.has(keyPath)) {
    return verificationKeyCache.get(keyPath);
  }

  try {
    // Convert public path to filesystem path
    // keyPath format: /circuits/verification_keys/range_check_verification_key.json
    const publicDir = path.join(process.cwd(), 'public');
    const fullPath = path.join(publicDir, keyPath);

    // Read file from filesystem
    const fileContent = fs.readFileSync(fullPath, 'utf8');
    const verificationKey = JSON.parse(fileContent);
    
    // Cache for future use
    verificationKeyCache.set(keyPath, verificationKey);

    return verificationKey;
  } catch (error) {
    throw new Error(`Failed to load verification key from ${keyPath}: ${error}`);
  }
}

/**
 * Verify a ZK proof using Cloudflare Worker
 * 
 * @param circuitName - Name of circuit (must match what user used to generate proof)
 * @param proof - Groth16 proof from user
 * @param publicSignals - Public signals from proof (what was proven)
 * @returns Verification result
 */
export async function verifyProof(
  circuitName: string,
  proof: any,  // snarkjs proof format
  publicSignals: string[]
): Promise<VerificationResult> {
  console.log('[Verifier] Starting verification for circuit:', circuitName);
  console.log('[Verifier] Using Cloudflare Worker:', CLOUDFLARE_WORKER_URL);
  const startTime = Date.now();
  
  try {
    // 1. Get circuit metadata (for validation)
    console.log('[Verifier] Loading circuit metadata...');
    const circuit = getCircuit(circuitName);
    console.log('[Verifier] Circuit metadata loaded:', circuit.name);

    // 2. Call Cloudflare Worker to verify proof
    console.log('[Verifier] Sending proof to Cloudflare Worker...');
    const verifyStartTime = Date.now();
    
    const response = await fetch(`${CLOUDFLARE_WORKER_URL}/verify-proof`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        proof,
        publicSignals,
        circuitName
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Worker returned ${response.status}`);
    }

    const result = await response.json();
    const verificationTime = Date.now() - verifyStartTime;
    
    console.log('[Verifier] Worker verification completed in', verificationTime, 'ms');
    console.log('[Verifier] Total verification time:', Date.now() - startTime, 'ms');
    console.log('[Verifier] Result:', result.valid ? 'VALID ✅' : 'INVALID ❌');

    return {
      valid: result.valid,
      circuitName,
      publicSignals,
      message: result.valid ? 'Proof verified successfully' : 'Proof verification failed',
      timestamp: Date.now(),
      verificationTime
    };
  } catch (error) {
    console.error('[Verifier] Error during verification:', error);
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
  proof: any,  // snarkjs proof format
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
    proof: any;  // snarkjs proof format
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
