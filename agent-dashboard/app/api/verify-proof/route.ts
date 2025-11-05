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

/**
 * Request body for single proof verification
 */
interface VerifyProofRequest {
  circuitName: string;
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol?: string;
    curve?: string;
  };
  publicSignals: string[];
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
    proof: {
      pi_a: string[];
      pi_b: string[][];
      pi_c: string[];
      protocol?: string;
      curve?: string;
    };
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
    examples: {
      singleProof: {
        circuitName: 'age_range',
        proof: {
          pi_a: ['...', '...', '1'],
          pi_b: [['...', '...'], ['...', '...'], ['...', '...']],
          pi_c: ['...', '...', '1']
        },
        publicSignals: ['1', '40', '60'],
        metadata: {
          userId: 'user123',
          campaignId: 'campaign456'
        }
      },
      batchProofs: {
        proofs: [
          {
            circuitName: 'age_range',
            proof: { /* ... */ },
            publicSignals: ['1', '40', '60']
          },
          {
            circuitName: 'range_proof',
            proof: { /* ... */ },
            publicSignals: ['1', '50000', '200000']
          }
        ],
        metadata: {
          campaignId: 'campaign456'
        }
      }
    }
  });
}
