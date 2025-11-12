/**
 * ZK-SNARK Proof Verification (Backend Only)
 * 
 * VERIFICATION ONLY - Does NOT generate proofs
 * Receives proofs from extension, verifies them using Rapidsnark CLI
 * 
 * Data Flow:
 *   Extension (proof generation)  private data stays here 
 *   Extension sends proof  /api/verify-proof  Rapidsnark verifier (CLI)  backend 
 *   Backend receives verified result  advertiser is notified 
 * 
 * Uses Rapidsnark C++ verifier CLI for fast, reliable verification.
 */

import { getCircuit } from './circuits-registry';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

// Rapidsnark verifier binary path (relative to project root)
const RAPIDSNARK_VERIFIER = path.join(
  process.cwd(),
  '../rapidsnark-server/rapidsnark/package_macos_arm64/bin/verifier'
);

// Verification keys directory
const VERIFICATION_KEYS_DIR = path.join(
  process.cwd(),
  '../rapidsnark-server/keys'
);

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
 * Verify a ZK proof using Rapidsnark CLI verifier
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
  console.log('[Verifier] Using Rapidsnark CLI verifier');
  const startTime = Date.now();
  
  // Temporary directory for proof/public signal files
  const tempDir = path.join(tmpdir(), `zk-verify-${Date.now()}`);
  const proofPath = path.join(tempDir, 'proof.json');
  const publicPath = path.join(tempDir, 'public.json');
  
  try {
    // 1. Get circuit metadata (for validation)
    console.log('[Verifier] Loading circuit metadata...');
    const circuit = getCircuit(circuitName);
    console.log('[Verifier] Circuit metadata loaded:', circuit.name);

    // 2. Get verification key path
    const vkeyPath = path.join(
      VERIFICATION_KEYS_DIR,
      `${circuitName}_verification_key.json`
    );

    // Verify verification key exists
    if (!fs.existsSync(vkeyPath)) {
      throw new Error(`Verification key not found: ${vkeyPath}`);
    }

    // 3. Create temp directory and write proof/signals
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(proofPath, JSON.stringify(proof));
    fs.writeFileSync(publicPath, JSON.stringify(publicSignals));

    // 4. Call rapidsnark verifier CLI
    console.log('[Verifier] Calling Rapidsnark verifier...');
    const verifyStartTime = Date.now();
    
    try {
      const { stdout, stderr } = await execAsync(
        `"${RAPIDSNARK_VERIFIER}" "${vkeyPath}" "${publicPath}" "${proofPath}"`,
        { timeout: 5000 } // 5 second timeout
      );
      
      const verificationTime = Date.now() - verifyStartTime;
      console.log('[Verifier] Rapidsnark output:', stderr.trim());
      
      // Check if proof is valid (rapidsnark outputs to stderr)
      const isValid = stderr.includes('Valid proof');
      
      console.log('[Verifier] Verification completed in', verificationTime, 'ms');
      console.log('[Verifier] Total time:', Date.now() - startTime, 'ms');
      console.log('[Verifier] Result:', isValid ? 'VALID [OK][OK][OK]' : 'INVALID [OK][OK][OK]');

      return {
        valid: isValid,
        circuitName,
        publicSignals,
        message: isValid ? 'Proof verified successfully' : 'Proof verification failed',
        timestamp: Date.now(),
        verificationTime
      };
    } catch (execError) {
      // Rapidsnark execution error (invalid proof or binary error)
      const verificationTime = Date.now() - verifyStartTime;
      console.error('[Verifier] Rapidsnark error:', execError);
      
      // Extract minimal error information without exposing paths
      let errorMessage = 'Invalid proof';
      
      if (execError instanceof Error) {
        const errorStr = execError.message.toLowerCase();
        
        // Check for specific error patterns and provide minimal context
        if (errorStr.includes('invalid proof')) {
          errorMessage = 'Invalid proof';
        } else if (errorStr.includes('timeout')) {
          errorMessage = 'Verification timeout';
        } else if (errorStr.includes('not found')) {
          errorMessage = 'Verification key not found';
        } else {
          // Generic error - don't expose details
          errorMessage = 'Verification failed';
        }
      }
      
      console.log('[Verifier] Verification completed in', verificationTime, 'ms');
      console.log('[Verifier] Total time:', Date.now() - startTime, 'ms');
      console.log('[Verifier] Result: INVALID [OK][OK][OK]');
      
      return {
        valid: false,
        circuitName,
        publicSignals,
        message: errorMessage,
        timestamp: Date.now(),
        verificationTime
      };
    }
  } catch (error) {
    console.error('[Verifier] Error during verification:', error);
    return {
      valid: false,
      circuitName,
      publicSignals,
      message: `Verification error: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: Date.now()
    };
  } finally {
    // Cleanup temp files
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.warn('[Verifier] Failed to cleanup temp files:', cleanupError);
    }
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
