/**
 * Proof Verification Endpoint
 * 
 * POST /api/verify-proof
 * 
 * Accepts a zero-knowledge proof from the user and verifies it.
 * This endpoint is called by advertisers to confirm user eligibility
 * without ever seeing the raw data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyProof, verifyProofBatch, allProofsValid } from '@/lib/zk/verifier';
import { hashAndPadSet } from '@/lib/zk/hashing';

/**
 * Campaign requirements for validation
 */
interface CampaignRequirements {
  // For range circuits
  min?: number;
  max?: number;
  
  // For set_membership circuit
  allowedValues?: string[];
}

/**
 * Request body for single proof verification
 */
interface VerifyProofRequest {
  circuitName: string;
  proof: any;  // snarkjs proof format
  publicSignals: string[];
  campaignRequirements?: CampaignRequirements;
  metadata?: {
    userId?: string;
    campaignId?: string;
    timestamp?: number;
  };
}

/**
 * Request body for batch proof verification
 */
interface VerifyProofBatchRequest {
  proofs: Array<{
    circuitName: string;
    proof: any;  // snarkjs proof format
    publicSignals: string[];
  }>;
  metadata?: {
    userId?: string;
    campaignId?: string;
    timestamp?: number;
  };
}

/**
 * POST /api/verify-proof
 * 
 * Verify a single or batch of proofs
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check if this is a batch request
    const isBatch = Array.isArray(body.proofs);

    if (isBatch) {
      // Batch verification
      const batchRequest = body as VerifyProofBatchRequest;

      if (!batchRequest.proofs || batchRequest.proofs.length === 0) {
        return NextResponse.json(
          { error: 'proofs array is required and must not be empty' },
          { status: 400 }
        );
      }

      // Verify all proofs
      const results = await verifyProofBatch(batchRequest.proofs);

      // Check if all are valid
      const allValid = allProofsValid(results);

      return NextResponse.json({
        success: allValid,
        message: allValid ? 'All proofs verified successfully' : 'Some proofs failed verification',
        results,
        metadata: batchRequest.metadata
      });
    } else {
      // Single proof verification
      const singleRequest = body as VerifyProofRequest;

      // Validate required fields
      if (!singleRequest.circuitName) {
        return NextResponse.json({ error: 'circuitName is required' }, { status: 400 });
      }

      if (!singleRequest.proof || !singleRequest.proof.pi_a || !singleRequest.proof.pi_b || !singleRequest.proof.pi_c) {
        return NextResponse.json(
          { error: 'proof object must contain pi_a, pi_b, and pi_c arrays' },
          { status: 400 }
        );
      }

      if (!Array.isArray(singleRequest.publicSignals)) {
        return NextResponse.json(
          { error: 'publicSignals must be an array' },
          { status: 400 }
        );
      }

      // Verify the proof
      const result = await verifyProof(
        singleRequest.circuitName,
        singleRequest.proof,
        singleRequest.publicSignals
      );

      // Additional campaign requirements validation
      if (result.valid && singleRequest.campaignRequirements) {
        const req = singleRequest.campaignRequirements;
        const signals = singleRequest.publicSignals;

        // Validate range circuits (age_range, range_check)
        if ((singleRequest.circuitName === 'age_range' || singleRequest.circuitName === 'range_check') &&
            req.min !== undefined && req.max !== undefined) {
          // Public signals: [valid, min, max]
          const proofMin = signals[1];
          const proofMax = signals[2];

          if (proofMin !== req.min.toString() || proofMax !== req.max.toString()) {
            return NextResponse.json({
              success: false,
              result: {
                ...result,
                valid: false,
                message: `Public signals don't match campaign requirements. Expected [${req.min}, ${req.max}], got [${proofMin}, ${proofMax}]`
              }
            });
          }
        }

        // Validate set_membership circuit
        if (singleRequest.circuitName === 'set_membership' && req.allowedValues && Array.isArray(req.allowedValues)) {
          // Public signals: [isMember, ...set[10]]
          const expectedSet = hashAndPadSet(req.allowedValues);
          const proofSet = signals.slice(1); // Skip isMember flag

          const setsMatch = proofSet.every((val, i) => val === expectedSet[i]);

          if (!setsMatch) {
            return NextResponse.json({
              success: false,
              result: {
                ...result,
                valid: false,
                message: 'Public set does not match campaign requirements'
              }
            });
          }
        }
      }

      return NextResponse.json({
        success: result.valid,
        result,
        metadata: singleRequest.metadata
      });
    }
  } catch (error) {
    console.error('[ZK Verify] Error:', error);

    return NextResponse.json(
      {
        error: 'Proof verification failed',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/verify-proof (for health check)
 */
export async function GET() {
  return NextResponse.json({
    message: 'ZK Proof Verification Endpoint',
    description: 'POST a proof object to verify ZK-SNARK proofs',
    endpoint: '/api/verify-proof',
    methods: ['POST'],
    availableCircuits: ['age_range', 'range_check', 'set_membership'],
    examples: {
      singleProof: {
        circuitName: 'range_check',
        proof: {
          pi_a: ['...', '...', '1'],
          pi_b: [['...', '...'], ['...', '...'], ['...', '...']],
          pi_c: ['...', '...', '1']
        },
        publicSignals: ['1', '25000', '50000'],
        campaignRequirements: {
          min: 25000,
          max: 50000
        },
        metadata: {
          userId: 'user123',
          campaignId: 'campaign456'
        }
      },
      setMembership: {
        circuitName: 'set_membership',
        proof: { /* ... */ },
        publicSignals: ['1', 'hash1', 'hash2', 'hash3', '0', '0', '0', '0', '0', '0', '0'],
        campaignRequirements: {
          allowedValues: ['us', 'uk', 'ca']
        }
      }
    }
  });
}
