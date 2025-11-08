/**
 * Manual Proof Verification Endpoint (for testing)
 * 
 * POST /api/process-proof-queue
 * 
 * Simulates what the cron job would do:
 * - Accepts a proof submission
 * - Verifies it
 * - Returns the verification result
 * 
 * In production, this would fetch from a database queue instead.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processProof, PendingProof } from '@/lib/zk/proof-queue-processor';

export async function POST(request: NextRequest) {
  console.log('[Process Queue] Manual proof processing triggered');
  
  try {
    const body = await request.json();
    
    // Validate request
    if (!body.circuitName || !body.proof || !body.publicSignals) {
      return NextResponse.json({
        error: 'Missing required fields: circuitName, proof, publicSignals'
      }, { status: 400 });
    }
    
    // Create a pending proof object (simulating what would come from database)
    const pendingProof: PendingProof = {
      id: body.id || `proof_${Date.now()}`,
      userId: body.userId || 'test_user',
      campaignId: body.campaignId || 'test_campaign',
      circuitName: body.circuitName,
      proof: body.proof,
      publicSignals: body.publicSignals,
      createdAt: new Date(),
      campaignRequirements: body.campaignRequirements
    };
    
    console.log(`[Process Queue] Processing proof for campaign ${pendingProof.campaignId}`);
    
    // Process the proof (this is what the cron job would do)
    const result = await processProof(pendingProof);
    
    console.log(`[Process Queue] Verification complete:`, {
      proofId: result.proofId,
      verified: result.verified,
      message: result.result.message
    });
    
    // Return the result
    return NextResponse.json({
      success: true,
      result
    });
    
  } catch (error) {
    console.error('[Process Queue] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * GET endpoint for checking status
 */
export async function GET() {
  return NextResponse.json({
    message: 'Proof Queue Processor',
    description: 'POST a proof to this endpoint to simulate cron job processing',
    endpoint: '/api/process-proof-queue',
    method: 'POST',
    expectedBody: {
      circuitName: 'range_check | set_membership | age_range',
      proof: { pi_a: '...', pi_b: '...', pi_c: '...' },
      publicSignals: ['1', '25000', '50000'],
      userId: 'optional_user_id',
      campaignId: 'optional_campaign_id',
      campaignRequirements: {
        min: 25000,
        max: 50000,
        // OR
        allowedValues: ['us', 'uk', 'ca']
      }
    }
  });
}
