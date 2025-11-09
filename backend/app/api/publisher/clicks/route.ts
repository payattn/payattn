/**
 * POST /api/publisher/clicks
 * 
 * Track ad clicks for reporting purposes.
 * Note: Clicks do NOT trigger payment (only impressions >= 1 second).
 * This data is used for advertiser reporting and CTR analytics.
 * 
 * Body:
 *   offer_id: The offer that was clicked
 *   publisher_id: Publisher where click occurred
 * 
 * Returns success confirmation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { offerId, publisherId } = body;

    // Validate required fields
    if (!offerId || !publisherId) {
      return NextResponse.json(
        { error: 'Missing required fields: offerId, publisherId' },
        { status: 400 }
      );
    }

    console.log(`[Click] Received click: ${offerId} from publisher ${publisherId}`);

    const supabase = getSupabase();

    // Get offer to find ad_creative_id
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select('ad_creative_id')
      .eq('offer_id', offerId)
      .single();

    if (offerError || !offer) {
      console.error('[Click] Offer not found:', offerId);
      return NextResponse.json(
        { 
          error: 'Offer not found',
          offerId
        },
        { status: 404 }
      );
    }

    // Increment click counter on ad_creative
    if (offer.ad_creative_id) {
      const { data: adCreative } = await supabase
        .from('ad_creative')
        .select('clicks_count')
        .eq('id', offer.ad_creative_id)
        .single();

      const { error: updateError } = await supabase
        .from('ad_creative')
        .update({ 
          clicks_count: (adCreative?.clicks_count || 0) + 1 
        })
        .eq('id', offer.ad_creative_id);

      if (updateError) {
        console.error('[Click] Failed to update click count:', updateError);
        return NextResponse.json(
          { error: 'Failed to track click', details: updateError.message },
          { status: 500 }
        );
      }

      console.log(`✅ [Click] Incremented counter for ad_creative ${offer.ad_creative_id}`);
    }

    return NextResponse.json({
      success: true,
      offerId,
      publisherId,
      message: 'Click tracked successfully (reporting only, no payment for clicks)'
    });

  } catch (err: any) {
    console.error('[Click] Error:', err);
    return NextResponse.json(
      { 
        error: 'Failed to track click',
        message: err.message 
      },
      { status: 500 }
    );
  }
}
