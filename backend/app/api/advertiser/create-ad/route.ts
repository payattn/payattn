/**
 * POST /api/advertiser/create-ad
 * 
 * Advertiser creates a new ad_creative.
 * This is the first step in the ad lifecycle.
 * 
 * Headers:
 *   x-advertiser-id: Advertiser identifier
 * 
 * Body:
 *   campaign_id: (optional) Existing campaign to attach to
 *   campaign_name: (optional) Create new campaign with this name
 *   headline: Ad headline (max 100 chars)
 *   body: Ad body text
 *   cta: Call-to-action text
 *   destination_url: Where user goes when clicking
 *   targeting: Object with age, interests, income, location criteria
 *   budget_per_impression_lamports: Amount to pay per impression
 *   total_budget_lamports: Total budget for this ad
 * 
 * Returns newly created ad_creative
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const advertiserId = request.headers.get('x-advertiser-id');
    
    if (!advertiserId) {
      return NextResponse.json(
        { error: 'Missing x-advertiser-id header' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      campaign_id,
      campaign_name,
      headline,
      body: adBody,
      cta,
      destination_url,
      targeting,
      budget_per_impression_lamports,
      total_budget_lamports
    } = body;

    // Validate required fields
    if (!headline || !adBody || !cta || !destination_url) {
      return NextResponse.json(
        { error: 'Missing required ad content fields' },
        { status: 400 }
      );
    }

    if (!targeting) {
      return NextResponse.json(
        { error: 'Targeting criteria required' },
        { status: 400 }
      );
    }

    if (!budget_per_impression_lamports || !total_budget_lamports) {
      return NextResponse.json(
        { error: 'Budget fields required' },
        { status: 400 }
      );
    }

    console.log(`[CreateAd] Advertiser ${advertiserId} creating new ad: "${headline}"`);

    const supabase = getSupabase();
    let finalCampaignId = campaign_id;

    // Create campaign if campaign_name provided
    if (!campaign_id && campaign_name) {
      const newCampaignId = `camp_${Date.now()}`;
      console.log(`[CreateAd] Creating new campaign: ${campaign_name} (${newCampaignId})`);

      const { error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          campaign_id: newCampaignId,
          advertiser_id: advertiserId,
          name: campaign_name,
          total_budget_lamports: total_budget_lamports,
          status: 'active'
        });

      if (campaignError) {
        console.error('[CreateAd] Failed to create campaign:', campaignError);
        return NextResponse.json(
          { error: 'Failed to create campaign', details: campaignError.message },
          { status: 500 }
        );
      }

      finalCampaignId = newCampaignId;
    }

    // Create ad_creative
    const adCreativeId = `ad_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const { data: ad, error: adError } = await supabase
      .from('ad_creative')
      .insert({
        ad_creative_id: adCreativeId,
        advertiser_id: advertiserId,
        campaign_id: finalCampaignId,
        type: 'text',
        headline: headline,
        body: adBody,
        cta: cta,
        destination_url: destination_url,
        targeting: targeting,
        budget_per_impression_lamports: budget_per_impression_lamports,
        total_budget_lamports: total_budget_lamports,
        status: 'active'
      })
      .select()
      .single();

    if (adError) {
      console.error('[CreateAd] Failed to create ad:', adError);
      return NextResponse.json(
        { error: 'Failed to create ad', details: adError.message },
        { status: 500 }
      );
    }

    console.log(`✅ [CreateAd] Created ad_creative ${adCreativeId}`);
    console.log(`[CreateAd] Targeting: age=${targeting.age?.min}-${targeting.age?.max}, interests=${targeting.interests?.length || 0}`);

    return NextResponse.json({
      success: true,
      ad_creative_id: adCreativeId,
      campaign_id: finalCampaignId,
      message: 'Ad created successfully. Max will evaluate and make offers to matching users.',
      ad: ad,
      next_steps: [
        'Extension will sync this ad via /api/user/adstream',
        'Max will evaluate against user profiles',
        'If targeting matches, Max creates offer with ZK-proofs',
        'Peggy will fund matching offers',
        'Publishers can then display this ad'
      ]
    });

  } catch (err: any) {
    console.error('[CreateAd] Error:', err);
    return NextResponse.json(
      { 
        error: 'Failed to create ad',
        message: err.message 
      },
      { status: 500 }
    );
  }
}
