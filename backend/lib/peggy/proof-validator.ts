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
  proofType?: string; // What's being proven (age, location, interest, etc.)
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
    // DEMO MODE: Skip proof validation if no proofs provided
    console.log('[Proof Validator] No proofs provided - skipping validation (demo mode)');
    return {
      isValid: true, // Accept without proofs for demo
      validProofs: [],
      invalidProofs: [],
      summary: ' No ZK proofs provided (accepted for demo)',
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
      // Key (age, location, etc.) tells us WHAT is being proven
      // circuitName (range_check, set_membership) tells us HOW it's proven
      proofsArray = Object.entries(zkProofs).map(([key, value]: [string, any]) => ({
        circuit: value.circuitName || value.circuit || key,
        proof: value.proof || value,
        publicSignals: value.publicSignals || [],
        proofType: key // Store what's being proven (age, location, etc.)
      }));
    }
  }
  
  if (proofsArray.length === 0) {
    // DEMO MODE: Skip proof validation if empty proofs object
    console.log('[Proof Validator] Empty proofs object - skipping validation (demo mode)');
    return {
      isValid: true, // Accept without proofs for demo
      validProofs: [],
      invalidProofs: [],
      summary: ' No ZK proofs to validate (accepted for demo)',
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
        validProofs.push(getProofDisplayName(zkProof));
      } else {
        invalidProofs.push(getProofDisplayName(zkProof));
      }
    } catch (error) {
      console.error(`Failed to verify proof ${zkProof.circuit}:`, error);
      invalidProofs.push(getProofDisplayName(zkProof));
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
    summary = ` ${validProofs.length} valid proof${validProofs.length > 1 ? 's' : ''}: ${validProofs.join(', ')} - User meets targeting requirements`;
  } else if (validProofs.length > 0) {
    summary = ` Partial validation: ${validProofs.length} valid (${validProofs.join(', ')}), ${invalidProofs.length} invalid (${invalidProofs.join(', ')})`;
  } else {
    summary = ` All proofs invalid: ${invalidProofs.join(', ')} - User does NOT meet targeting requirements`;
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
 * Get human-readable name for what's being proven
 * Uses proofType (what) over circuit name (how)
 * 
 * Examples:
 * - proofType='age', circuit='range_check'  'Age (range proof)'
 * - proofType='location', circuit='set_membership'  'Location (set membership)'
 */
function getProofDisplayName(zkProof: ZKProof): string {
  // If we know what's being proven, use that
  if (zkProof.proofType) {
    const proofTypeNames: Record<string, string> = {
      'age': 'Age',
      'age_range': 'Age',
      'location': 'Location',
      'interest': 'Interest',
      'interests': 'Interests',
      'geo': 'Geography',
      'income': 'Income',
      'time': 'Timestamp'
    };
    
    const displayName = proofTypeNames[zkProof.proofType.toLowerCase()] || zkProof.proofType;
    
    // Add circuit type for clarity in logs
    const circuitTypeNames: Record<string, string> = {
      'range_check': 'range proof',
      'set_membership': 'set membership'
    };
    
    const circuitType = circuitTypeNames[zkProof.circuit.toLowerCase()];
    return circuitType ? `${displayName} (${circuitType})` : displayName;
  }
  
  // Fallback to circuit name if proofType not available
  const fallbackNames: Record<string, string> = {
    'range_check': 'Range Proof',
    'set_membership': 'Set Membership',
    'age_range': 'Age',
    'location': 'Location'
  };
  
  return fallbackNames[zkProof.circuit.toLowerCase()] || zkProof.circuit;
}
