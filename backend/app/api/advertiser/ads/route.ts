/**
 * GET /api/advertiser/ads
 * 
 * List all ads for advertiser (for dashboard).
 * Can filter by campaign_id.
 * 
 * Headers:
 *   x-advertiser-id: Advertiser identifier
 * 
 * Query params:
 *   campaign_id: (optional) Filter by campaign
 *   status: (optional) Filter by status (active, paused, completed, rejected)
 * 
 * Returns list of ad_creatives with stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const advertiserId = request.headers.get('x-advertiser-id');
    
    if (!advertiserId) {
      return NextResponse.json(
        { error: 'Missing x-advertiser-id header' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaign_id');
    const status = searchParams.get('status');

    console.log(`[ListAds] Advertiser ${advertiserId} listing ads`);

    const supabase = getSupabase();

    // Build query
    let query = supabase
      .from('ad_creative')
      .select('*')
      .eq('advertiser_id', advertiserId)
      .order('created_at', { ascending: false });

    // Add filters
    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: ads, error } = await query;

    if (error) {
      console.error('[ListAds] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch ads', details: error.message },
        { status: 500 }
      );
    }

    // Calculate summary stats
    const summary = {
      total_ads: ads?.length || 0,
      active: ads?.filter(ad => ad.status === 'active').length || 0,
      paused: ads?.filter(ad => ad.status === 'paused').length || 0,
      total_impressions: ads?.reduce((sum, ad) => sum + (ad.impressions_count || 0), 0) || 0,
      total_clicks: ads?.reduce((sum, ad) => sum + (ad.clicks_count || 0), 0) || 0,
      total_spent: ads?.reduce((sum, ad) => sum + (ad.spent_lamports || 0), 0) || 0,
      total_budget: ads?.reduce((sum, ad) => sum + (ad.total_budget_lamports || 0), 0) || 0
    };

    console.log(`[ListAds] Returning ${ads?.length || 0} ads for advertiser ${advertiserId}`);

    return NextResponse.json({
      ads: ads || [],
      summary,
      filters: {
        campaign_id: campaignId,
        status
      }
    });

  } catch (err: any) {
    console.error('[ListAds] Error:', err);
    return NextResponse.json(
      { 
        error: 'Failed to list ads',
        message: err.message 
      },
      { status: 500 }
    );
  }
}
