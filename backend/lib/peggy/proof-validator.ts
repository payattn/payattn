/**
 * Peggy Proof Validator
 * Validates ZK proofs for offers using existing verifier
 * Thin wrapper around /backend/lib/zk/verifier.ts
 */

import { verifyProof, VerificationResult } from '../zk/verifier';

export interface ProofValidationResult {
  isValid: boolean;
  validProofs: string[];
  invalidProofs: string[];
  summary: string;
  details: VerificationResult[];
}

export interface ZKProof {
  circuit: string;
  proof: any;
  publicSignals: string[];
}

/**
 * Validate all ZK proofs in an offer
 */
export async function validateOfferProofs(
  zkProofs: ZKProof[] | any
): Promise<ProofValidationResult> {
  
  // Handle case where proofs might be stored differently
  let proofsArray: ZKProof[] = [];
  
  if (!zkProofs) {
    return {
      isValid: false,
      validProofs: [],
      invalidProofs: [],
      summary: '❌ No ZK proofs provided',
      details: []
    };
  }
  
  // If it's already an array, use it
  if (Array.isArray(zkProofs)) {
    proofsArray = zkProofs;
  } 
  // If it's an object with circuit properties
  else if (typeof zkProofs === 'object') {
    // Try to extract proofs from object structure
    // Common formats: { age: {...}, location: {...} } or { proofs: [...] }
    if (zkProofs.proofs && Array.isArray(zkProofs.proofs)) {
      proofsArray = zkProofs.proofs;
    } else {
      // Convert object properties to array
      // Each proof object should have a circuitName field - use that!
      proofsArray = Object.entries(zkProofs).map(([key, value]: [string, any]) => ({
        circuit: value.circuitName || value.circuit || key,
        proof: value.proof || value,
        publicSignals: value.publicSignals || []
      }));
    }
  }
  
  if (proofsArray.length === 0) {
    return {
      isValid: false,
      validProofs: [],
      invalidProofs: [],
      summary: '❌ No valid ZK proofs found',
      details: []
    };
  }
  
  // Verify each proof
  const results: VerificationResult[] = [];
  const validProofs: string[] = [];
  const invalidProofs: string[] = [];
  
  for (const zkProof of proofsArray) {
    try {
      const result = await verifyProof(
        zkProof.circuit,
        zkProof.proof,
        zkProof.publicSignals
      );
      
      results.push(result);
      
      if (result.valid) {
        validProofs.push(getProofDisplayName(zkProof.circuit));
      } else {
        invalidProofs.push(getProofDisplayName(zkProof.circuit));
      }
    } catch (error) {
      console.error(`Failed to verify proof ${zkProof.circuit}:`, error);
      invalidProofs.push(getProofDisplayName(zkProof.circuit));
      results.push({
        valid: false,
        circuitName: zkProof.circuit,
        publicSignals: zkProof.publicSignals,
        message: `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      });
    }
  }
  
  // Build summary
  const isValid = invalidProofs.length === 0 && validProofs.length > 0;
  let summary = '';
  
  if (isValid) {
    summary = `✅ ${validProofs.length} valid proof${validProofs.length > 1 ? 's' : ''}: ${validProofs.join(', ')} - User meets targeting requirements`;
  } else if (validProofs.length > 0) {
    summary = `⚠️ Partial validation: ${validProofs.length} valid (${validProofs.join(', ')}), ${invalidProofs.length} invalid (${invalidProofs.join(', ')})`;
  } else {
    summary = `❌ All proofs invalid: ${invalidProofs.join(', ')} - User does NOT meet targeting requirements`;
  }
  
  return {
    isValid,
    validProofs,
    invalidProofs,
    summary,
    details: results
  };
}

/**
 * Get human-readable name for circuit
 */
function getProofDisplayName(circuit: string): string {
  const displayNames: Record<string, string> = {
    'age_range': 'Age',
    'age': 'Age',
    'location': 'Location',
    'interest': 'Interest',
    'geo': 'Geography',
    'time': 'Timestamp'
  };
  
  return displayNames[circuit.toLowerCase()] || circuit;
}
