import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { derivePDA, getPlatformPubkey, getProgramId } from '@/lib/solana-escrow';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/advertiser/offers/:id/accept
 * 
 * Peggy (advertiser agent) accepts an offer.
 * Backend responds with HTTP 402 "Payment Required" with escrow details.
 * 
 * This is the core x402 protocol flow!
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const offerId = params.id;
    console.log('[x402] Accept request for offer:', offerId);
    
    // TODO: Add authentication - verify advertiser owns this offer
    // const advertiserId = request.headers.get('x-advertiser-id');
    // if (!advertiserId) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }
    
    // Fetch offer from database
    console.log('[x402] Querying Supabase for offer_id:', offerId);
    const { data: offers, error: fetchError } = await supabase
      .from('offers')
      .select('*')
      .eq('offer_id', offerId);
    
    console.log('[x402] Query result:', { offers, error: fetchError });
    
    if (fetchError) {
      console.error('[x402] Database error:', fetchError);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }
    
    if (!offers || offers.length === 0) {
      console.error('[x402] Offer not found');
      return NextResponse.json(
        { error: 'Offer not found' },
        { status: 404 }
      );
    }
    
    const offer = offers[0];
    
    // Check offer is in correct state
    if (offer.status !== 'offer_made') {
      return NextResponse.json(
        { error: `Invalid offer status: ${offer.status}. Expected: offer_made` },
        { status: 400 }
      );
    }
    
    // Update offer status to "accepted"
    const { error: updateError } = await supabase
      .from('offers')
      .update({ status: 'accepted' })
      .eq('offer_id', offerId);
    
    if (updateError) {
      console.error('Failed to update offer status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update offer' },
        { status: 500 }
      );
    }
    
    // Derive escrow PDA (Peggy will fund this address)
    const [escrowPda] = await derivePDA(offerId);
    
    console.log(`✅ Offer ${offerId} accepted, sending x402 response`);
    
    // Send HTTP 402 "Payment Required" with escrow details
    return new NextResponse(
      JSON.stringify({
        message: 'Payment Required',
        instructions: 'Fund escrow using createEscrow() instruction',
        offer: {
          offer_id: offerId,
          amount_lamports: offer.amount_lamports,
          user_pubkey: offer.user_pubkey
        }
      }),
      {
        status: 402, // HTTP 402 Payment Required
        headers: {
          'Content-Type': 'application/json',
          
          // x402 Standard Headers
          'X-Payment-Chain': 'solana',
          'X-Payment-Network': 'devnet',
          'X-Payment-Amount': offer.amount_lamports.toString(),
          'X-Payment-Token': 'SOL',
          
          // Payattn-specific headers
          'X-Offer-Id': offerId,
          'X-User-Pubkey': offer.user_pubkey,
          'X-Platform-Pubkey': getPlatformPubkey(),
          'X-Escrow-Program': getProgramId(),
          'X-Escrow-PDA': escrowPda.toBase58(),
          'X-Verification-Endpoint': '/api/advertiser/payments/verify'
        }
      }
    );
    
  } catch (error: any) {
    console.error('Error in offer accept:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
