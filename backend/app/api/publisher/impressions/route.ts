/**
 * POST /api/publisher/impressions
 * 
 * Report ad impression and trigger privacy-preserving settlement.
 * Called by Publisher SDK after user views ad for >= 1 second.
 * 
 * Triggers settleWithPrivacy() which submits 3 unlinked transactions:
 * - 70% to user
 * - 25% to publisher
 * - 5% to platform
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { settleWithPrivacy } from '@/lib/settlement-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { offerId, publisherId, duration } = body;

    // Validate required fields
    if (!offerId || !publisherId || !duration) {
      return NextResponse.json(
        { error: 'Missing required fields: offerId, publisherId, duration' },
        { status: 400 }
      );
    }

    // Verify impression duration (must be >= 1 second)
    if (duration < 1000) {
      return NextResponse.json(
        { error: 'Duration too short', minDuration: 1000 },
        { status: 400 }
      );
    }

    console.log(`[Impression] Received: ${offerId} from publisher ${publisherId}, duration ${duration}ms`);

    const supabase = getSupabase();

    // Get offer details
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select('*')
      .eq('offer_id', offerId)
      .eq('status', 'funded')
      .single();

    if (offerError || !offer) {
      console.error('[Impression] Offer not found or not funded:', offerId);
      return NextResponse.json(
        { 
          error: 'Offer not found or not funded',
          offerId,
          suggestion: 'Check that escrow was funded and verified'
        },
        { status: 404 }
      );
    }

    // Look up publisher wallet
    const { data: publisher, error: pubError } = await supabase
      .from('publishers')
      .select('wallet_address, wallet_verified')
      .eq('publisher_id', publisherId)
      .single();

    if (pubError || !publisher) {
      console.error('[Impression] Publisher not found:', publisherId);
      return NextResponse.json(
        { 
          error: 'Publisher not found',
          publisherId 
        },
        { status: 404 }
      );
    }

    if (!publisher.wallet_address) {
      console.error('[Impression] Publisher wallet not registered:', publisherId);
      return NextResponse.json(
        { 
          error: 'Publisher wallet not registered',
          action: 'Please add wallet address in publisher dashboard',
          publisherId
        },
        { status: 400 }
      );
    }

    console.log(`[Impression] Triggering settlement for ${offerId}`);
    console.log(`[Impression] User: ${offer.user_pubkey}`);
    console.log(`[Impression] Publisher: ${publisher.wallet_address}`);
    console.log(`[Impression] Amount: ${offer.amount_lamports} lamports`);

    // Trigger privacy-preserving settlement
    const results = await settleWithPrivacy({
      offerId,
      userPubkey: offer.user_pubkey,
      publisherPubkey: publisher.wallet_address,
      amount: offer.amount_lamports,
    });

    const allSucceeded = results.every(r => r.success);

    return NextResponse.json({
      settled: allSucceeded,
      offerId,
      duration,
      transactions: results.map(r => ({
        type: r.type,
        success: r.success,
        txSignature: r.txSignature,
        amount: r.amount,
        error: r.error,
        explorerUrl: r.txSignature 
          ? `https://explorer.solana.com/tx/${r.txSignature}?cluster=devnet`
          : undefined
      })),
      message: allSucceeded
        ? 'Payment sent to all parties'
        : 'Some transactions failed, added to retry queue',
      summary: {
        user: results.find(r => r.type === 'user'),
        publisher: results.find(r => r.type === 'publisher'),
        platform: results.find(r => r.type === 'platform'),
      }
    });

  } catch (err: any) {
    console.error('[Impression] Settlement error:', err);
    return NextResponse.json(
      { 
        error: 'Settlement failed', 
        message: err.message,
        suggestion: 'Transaction may be retried automatically'
      },
      { status: 500 }
    );
  }
}
