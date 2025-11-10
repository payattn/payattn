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

    // Determine which table to query based on DATABASE_MODE env variable
    // "test" = use test_ad_creative for testing
    // "production" = use ad_creative for real ads
    const databaseMode = process.env.DATABASE_MODE || 'production';
    const tableName = databaseMode === 'test' ? 'test_ad_creative' : 'ad_creative';
    
    console.log(`[AdStream] Querying table: ${tableName} (DATABASE_MODE=${databaseMode})`);

    // Build query - get all active ads
    let query = supabase
      .from(tableName)
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

    // Transform ads to match the expected format for the extension UI
    const transformedAds = activeAds.map(ad => {
      // Calculate avg paid from budget_per_impression (convert lamports to USD at $160/SOL)
      const avgPaidUsd = (ad.budget_per_impression_lamports / 1_000_000_000) * 160;
      
      // Calculate account age (days since created_at)
      const accountAgeDays = Math.floor(
        (Date.now() - new Date(ad.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      return {
        // Keep all original fields including the UUID 'id' field
        ...ad,
        
        // Add advertiser object expected by UI
        advertiser: {
          id: ad.advertiser_id,
          name: ad.advertiser_id.replace('test_adv_', '').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          domain: new URL(ad.destination_url).hostname.replace('test-', ''),
          avgPaid30d: avgPaidUsd,
          accountAge: accountAgeDays
        },
        
        // Add campaign fields expected by UI
        // Note: Keep 'id' as the UUID for offer submission, use campaign object for campaign_id
        campaign: {
          id: ad.campaign_id,
          name: ad.headline,
          metadata: {
            category: ad.targeting?.interests?.[0]?.category || 'general'
          }
        },
        
        // Keep targeting as-is (already in correct format)
        targeting: ad.targeting || {}
      };
    });

    console.log(`[AdStream] Returning ${transformedAds.length} new ads to user ${userId}`);

    return NextResponse.json({
      ads: transformedAds,
      count: transformedAds.length,
      server_time: new Date().toISOString(),
      message: transformedAds.length > 0 
        ? `${transformedAds.length} new ads available for evaluation`
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
