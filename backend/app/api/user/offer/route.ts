/**
 * POST /api/user/offer
 * 
 * Max (client-side) creates an offer after evaluating an ad_creative.
 * This happens AFTER Max has:
 *   1. Downloaded ad_creative from /api/user/adstream
 *   2. Checked targeting criteria against user profile
 *   3. Generated ZK-proofs (age, interests, income, location)
 *   4. Decided to ACCEPT the ad
 * 
 * Headers:
 *   x-user-id: User identifier from extension
 * 
 * Body:
 *   ad_creative_id: UUID of the ad Max approved
 *   amount_lamports: Amount for this offer (from ad's budget_per_impression)
 *   zk_proofs: Object with proofs for age, interests, income, location
 * 
 * Creates offer with status='offer_made', waiting for Peggy to fund
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

interface ZKProof {
  proof: any;
  publicSignals: string[];
  circuitName: string;
}

interface ZKProofs {
  age?: ZKProof;
  interests?: ZKProof;
  income?: ZKProof;
  location?: ZKProof;
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing x-user-id header' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { ad_creative_id, amount_lamports, zk_proofs } = body;

    // Validate required fields
    if (!ad_creative_id || !amount_lamports) {
      return NextResponse.json(
        { error: 'Missing required fields: ad_creative_id, amount_lamports' },
        { status: 400 }
      );
    }

    console.log(`[Offer] Max creating offer for user ${userId}, ad ${ad_creative_id}`);

    const supabase = getSupabase();

    // Verify ad_creative exists and is active
    const { data: adCreative, error: adError } = await supabase
      .from('ad_creative')
      .select('*')
      .eq('id', ad_creative_id)
      .eq('status', 'active')
      .single();

    if (adError || !adCreative) {
      console.error('[Offer] Ad creative not found or inactive:', ad_creative_id);
      return NextResponse.json(
        { error: 'Ad creative not found or inactive' },
        { status: 404 }
      );
    }

    // Check budget available
    if (adCreative.spent_lamports >= adCreative.total_budget_lamports) {
      console.log('[Offer] Ad creative budget exhausted:', ad_creative_id);
      return NextResponse.json(
        { error: 'Ad creative budget exhausted' },
        { status: 400 }
      );
    }

    // Get user's wallet pubkey
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('wallet_pubkey')
      .eq('user_id', userId)
      .single();

    if (userError || !user) {
      console.error('[Offer] User not found:', userId);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Generate unique offer_id
    const offerId = `offer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create offer
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .insert({
        offer_id: offerId,
        user_id: userId,
        user_pubkey: user.wallet_pubkey,
        advertiser_id: adCreative.advertiser_id, // Required field from ad_creative
        ad_id: adCreative.ad_creative_id, // Legacy text field for compatibility
        ad_creative_id: ad_creative_id, // UUID reference to ad_creative table
        amount_lamports: amount_lamports,
        status: 'offer_made',
        zk_proofs: zk_proofs || {},
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (offerError) {
      console.error('[Offer] Failed to create offer:', offerError);
      return NextResponse.json(
        { error: 'Failed to create offer', details: offerError.message },
        { status: 500 }
      );
    }

    // Update ad_creative spent budget (optimistic - actual spend happens on settlement)
    await supabase
      .from('ad_creative')
      .update({
        spent_lamports: adCreative.spent_lamports + amount_lamports
      })
      .eq('id', ad_creative_id);

    console.log(`✅ [Offer] Created offer ${offerId} for ${amount_lamports} lamports`);
    console.log(`[Offer] Status: offer_made, waiting for Peggy to fund escrow`);

    return NextResponse.json({
      success: true,
      offer_id: offerId,
      status: 'offer_made',
      amount_lamports: amount_lamports,
      message: 'Offer created successfully. Waiting for Peggy to fund escrow.',
      next_steps: [
        'Peggy will query offers with status=offer_made',
        'Peggy will fund escrow on Solana',
        'Offer status will update to funded',
        'Extension will store funded offer locally',
        'Publisher can then display this ad'
      ]
    });

  } catch (err: any) {
    console.error('[Offer] Error:', err);
    return NextResponse.json(
      { 
        error: 'Failed to create offer',
        message: err.message 
      },
      { status: 500 }
    );
  }
}
