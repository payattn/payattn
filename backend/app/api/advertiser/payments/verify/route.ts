import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyEscrow } from '@/lib/solana-escrow';
import { Connection, PublicKey } from '@solana/web3.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const connection = new Connection(
  process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  'confirmed'
);

/**
 * POST /api/advertiser/payments/verify
 * 
 * Peggy submits payment proof after funding the escrow.
 * Backend verifies the escrow exists on-chain with correct parameters.
 * 
 * This completes the x402 protocol flow!
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { offerId, txSignature, escrowPda } = body;
    
    if (!offerId || !txSignature) {
      return NextResponse.json(
        { error: 'Missing required fields: offerId, txSignature' },
        { status: 400 }
      );
    }
    
    // TODO: Add authentication - verify advertiser owns this offer
    // const advertiserId = request.headers.get('x-advertiser-id');
    
    // Fetch offer from database
    const { data: offer, error: fetchError } = await supabase
      .from('offers')
      .select('*')
      .eq('offer_id', offerId)
      .single();
    
    if (fetchError || !offer) {
      return NextResponse.json(
        { error: 'Offer not found' },
        { status: 404 }
      );
    }
    
    // Check offer is in correct state
    if (offer.status !== 'accepted') {
      return NextResponse.json(
        { error: `Invalid offer status: ${offer.status}. Expected: accepted` },
        { status: 400 }
      );
    }
    
    console.log(`Verifying payment for offer ${offerId}...`);
    
    // Verify transaction exists on-chain
    try {
      const tx = await connection.getTransaction(txSignature, {
        maxSupportedTransactionVersion: 0
      });
      
      if (!tx) {
        return NextResponse.json(
          { error: 'Transaction not found on blockchain' },
          { status: 400 }
        );
      }
      
      if (tx.meta?.err) {
        return NextResponse.json(
          { error: 'Transaction failed on blockchain' },
          { status: 400 }
        );
      }
      
      console.log('[OK][OK][OK] Transaction verified on-chain');
      
    } catch (txError: any) {
      console.error('Transaction verification failed:', txError);
      return NextResponse.json(
        { error: 'Failed to verify transaction' },
        { status: 400 }
      );
    }
    
    // Fetch advertiser wallet to verify escrow
    const { data: advertiser } = await supabase
      .from('advertisers')
      .select('wallet_pubkey')
      .eq('advertiser_id', offer.advertiser_id)
      .single();
    
    if (!advertiser?.wallet_pubkey) {
      return NextResponse.json(
        { error: 'Advertiser wallet not found' },
        { status: 400 }
      );
    }
    
    // Verify escrow account on-chain
    const verification = await verifyEscrow(
      offerId,
      offer.amount_lamports,
      offer.user_pubkey,
      advertiser.wallet_pubkey
    );
    
    if (!verification.valid) {
      console.error('[OK][OK][OK] Escrow verification failed:', verification.error);
      return NextResponse.json(
        { 
          error: 'Escrow verification failed',
          details: verification.error
        },
        { status: 400 }
      );
    }
    
    console.log('[OK][OK][OK] Escrow verified on-chain:', verification.escrowPda);
    
    // Update offer status to "funded"
    const { error: updateError } = await supabase
      .from('offers')
      .update({
        status: 'funded',
        escrow_pda: verification.escrowPda,
        escrow_tx_signature: txSignature
      })
      .eq('offer_id', offerId);
    
    if (updateError) {
      console.error('Failed to update offer status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update offer status' },
        { status: 500 }
      );
    }
    
    console.log(`[OK][OK][OK] Offer ${offerId} marked as funded`);
    
    // Return success
    return NextResponse.json({
      verified: true,
      offerStatus: 'funded',
      escrowPda: verification.escrowPda,
      txSignature,
      resourceUrl: `/api/user/offers/${offerId}`,
      message: 'Payment verified successfully. Ad will be delivered to user.'
    });
    
  } catch (error: any) {
    console.error('Error in payment verification:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
