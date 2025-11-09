/**
 * GET /api/user/adstream
 * 
 * Fetch new ad_creatives for extension to sync.
 * Extension calls this periodically (e.g., every hour) to get new ads for Max to evaluate.
 * 
 * Headers:
 *   x-user-id: User identifier from extension
 * 
 * Body:
 *   last_checked: ISO timestamp of last sync (optional)
 * 
 * Returns:
 *   - List of new ad_creatives created since last_checked
 *   - Only active ads with remaining budget
 *   - Ordered by created_at (oldest first)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

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
    const { last_checked } = body;

    console.log(`[AdStream] User ${userId} requesting ads since ${last_checked || 'beginning'}`);

    const supabase = getSupabase();

    // Build query - get all active ads
    let query = supabase
      .from('ad_creative')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    // Filter by last_checked if provided
    if (last_checked) {
      query = query.gt('created_at', last_checked);
    }

    const { data: ads, error } = await query;

    if (error) {
      console.error('[AdStream] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch ads', details: error.message },
        { status: 500 }
      );
    }

    // Filter ads that still have budget remaining
    const activeAds = (ads || []).filter(ad => 
      ad.spent_lamports < ad.total_budget_lamports
    );

    console.log(`[AdStream] Returning ${activeAds.length} new ads to user ${userId}`);

    return NextResponse.json({
      ads: activeAds,
      count: activeAds.length,
      server_time: new Date().toISOString(),
      message: activeAds.length > 0 
        ? `${activeAds.length} new ads available for evaluation`
        : 'No new ads since last check'
    });

  } catch (err: any) {
    console.error('[AdStream] Error:', err);
    return NextResponse.json(
      { 
        error: 'Failed to fetch ad stream',
        message: err.message 
      },
      { status: 500 }
    );
  }
}
