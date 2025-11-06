/**
 * Proof Queue Processor
 * 
 * This would be called by a cron job to process pending proof verifications.
 * 
 * Usage:
 *   - Cron job runs every N minutes
 *   - Fetches pending proofs from database
 *   - Verifies each proof
 *   - Updates database with results
 */

import { verifyProof, VerificationResult } from './verifier';

export interface PendingProof {
  id: string;
  userId: string;
  campaignId: string;
  circuitName: string;
  proof: any;
  publicSignals: string[];
  createdAt: Date;
  campaignRequirements?: {
    min?: number;
    max?: number;
    allowedValues?: string[];
  };
}

export interface VerificationRecord {
  proofId: string;
  userId: string;
  campaignId: string;
  verified: boolean;
  verifiedAt: Date;
  result: VerificationResult;
  error?: string;
}

/**
 * Process a single proof from the queue
 */
export async function processProof(pendingProof: PendingProof): Promise<VerificationRecord> {
  console.log(`[Queue] Processing proof ${pendingProof.id} for user ${pendingProof.userId}`);
  
  try {
    // Verify the proof cryptographically
    const result = await verifyProof(
      pendingProof.circuitName,
      pendingProof.proof,
      pendingProof.publicSignals
    );

    // Additional validation based on campaign requirements
    let finalVerified = result.valid;
    let validationMessage = result.message;

    if (result.valid && pendingProof.campaignRequirements) {
      const validation = validateCampaignRequirements(
        pendingProof.circuitName,
        pendingProof.publicSignals,
        pendingProof.campaignRequirements
      );
      
      finalVerified = validation.valid;
      if (!validation.valid) {
        validationMessage = validation.message;
      }
    }

    return {
      proofId: pendingProof.id,
      userId: pendingProof.userId,
      campaignId: pendingProof.campaignId,
      verified: finalVerified,
      verifiedAt: new Date(),
      result: {
        ...result,
        valid: finalVerified,
        message: validationMessage
      }
    };
  } catch (error) {
    console.error(`[Queue] Error processing proof ${pendingProof.id}:`, error);
    
    return {
      proofId: pendingProof.id,
      userId: pendingProof.userId,
      campaignId: pendingProof.campaignId,
      verified: false,
      verifiedAt: new Date(),
      result: {
        valid: false,
        circuitName: pendingProof.circuitName,
        publicSignals: pendingProof.publicSignals,
        message: 'Verification failed',
        timestamp: Date.now()
      },
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Validate public signals against campaign requirements
 */
function validateCampaignRequirements(
  circuitName: string,
  publicSignals: string[],
  requirements: { min?: number; max?: number; allowedValues?: string[] }
): { valid: boolean; message: string } {
  
  // Range circuits (age_range, range_check)
  if ((circuitName === 'age_range' || circuitName === 'range_check') &&
      requirements.min !== undefined && requirements.max !== undefined) {
    
    const proofMin = publicSignals[1];
    const proofMax = publicSignals[2];

    if (proofMin !== requirements.min.toString() || proofMax !== requirements.max.toString()) {
      return {
        valid: false,
        message: `Public signals don't match campaign requirements. Expected [${requirements.min}, ${requirements.max}], got [${proofMin}, ${proofMax}]`
      };
    }
  }

  // Set membership circuit
  if (circuitName === 'set_membership' && requirements.allowedValues && Array.isArray(requirements.allowedValues)) {
    // Import hashing utilities
    const { hashAndPadSet } = require('./hashing');
    const expectedSet = hashAndPadSet(requirements.allowedValues);
    const proofSet = publicSignals.slice(1); // Skip isMember flag

    const setsMatch = proofSet.every((val, i) => val === expectedSet[i]);

    if (!setsMatch) {
      return {
        valid: false,
        message: 'Public set does not match campaign requirements'
      };
    }
  }

  return { valid: true, message: 'Campaign requirements validated' };
}

/**
 * Process multiple proofs in batch
 * 
 * @param proofs - Array of pending proofs to verify
 * @param maxConcurrent - Maximum number of proofs to verify concurrently (default: 5)
 * @returns Array of verification records
 */
export async function processProofBatch(
  proofs: PendingProof[],
  maxConcurrent: number = 5
): Promise<VerificationRecord[]> {
  console.log(`[Queue] Processing batch of ${proofs.length} proofs (max concurrent: ${maxConcurrent})`);
  
  const results: VerificationRecord[] = [];
  
  // Process in chunks to avoid overwhelming the system
  for (let i = 0; i < proofs.length; i += maxConcurrent) {
    const chunk = proofs.slice(i, i + maxConcurrent);
    console.log(`[Queue] Processing chunk ${i / maxConcurrent + 1} (${chunk.length} proofs)`);
    
    const chunkResults = await Promise.all(
      chunk.map(proof => processProof(proof))
    );
    
    results.push(...chunkResults);
  }
  
  const successCount = results.filter(r => r.verified).length;
  console.log(`[Queue] Batch complete: ${successCount}/${proofs.length} verified successfully`);
  
  return results;
}

/**
 * Main cron job entry point
 * 
 * This function would be called by your cron scheduler.
 * It fetches pending proofs, processes them, and updates the database.
 */
export async function runProofVerificationCron(
  fetchPendingProofs: () => Promise<PendingProof[]>,
  saveVerificationResults: (results: VerificationRecord[]) => Promise<void>
): Promise<void> {
  console.log('[Cron] Starting proof verification cron job');
  const startTime = Date.now();
  
  try {
    // Fetch pending proofs from database
    const pendingProofs = await fetchPendingProofs();
    
    if (pendingProofs.length === 0) {
      console.log('[Cron] No pending proofs to process');
      return;
    }
    
    console.log(`[Cron] Found ${pendingProofs.length} pending proofs`);
    
    // Process all proofs
    const results = await processProofBatch(pendingProofs);
    
    // Save results to database
    await saveVerificationResults(results);
    
    const duration = Date.now() - startTime;
    console.log(`[Cron] Completed in ${duration}ms`);
    console.log(`[Cron] Results: ${results.filter(r => r.verified).length} verified, ${results.filter(r => !r.verified).length} failed`);
    
  } catch (error) {
    console.error('[Cron] Error running proof verification cron:', error);
    throw error;
  }
}
