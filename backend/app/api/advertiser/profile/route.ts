/**
 * Get or create advertiser profile
 * GET: Fetch advertiser by wallet address (x-wallet-address header)
 * POST: Create new advertiser profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address');
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Look up advertiser by advertiser_id (which IS the wallet address)
    const { data: advertiser, error } = await supabase
      .from('advertisers')
      .select('*')
      .eq('advertiser_id', walletAddress)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (not found)
      console.error('[API] Error fetching advertiser:', error);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }

    if (!advertiser) {
      // Advertiser not found
      return NextResponse.json(
        { 
          exists: false,
          wallet_address: walletAddress 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      exists: true,
      advertiser: {
        advertiser_id: advertiser.advertiser_id,
        name: advertiser.name,
        created_at: advertiser.created_at
      }
    });

  } catch (err) {
    console.error('[API] Advertiser profile error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet_address, name } = body;
    
    if (!wallet_address) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name required' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Check if advertiser already exists (advertiser_id IS the wallet address)
    const { data: existing } = await supabase
      .from('advertisers')
      .select('*')
      .eq('advertiser_id', wallet_address)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Advertiser already exists' },
        { status: 409 }
      );
    }

    // Create new advertiser (advertiser_id = wallet address)
    const { data: newAdvertiser, error } = await supabase
      .from('advertisers')
      .insert({
        advertiser_id: wallet_address,
        name: name.trim()
      })
      .select()
      .single();

    if (error) {
      console.error('[API] Error creating advertiser:', error);
      return NextResponse.json(
        { error: 'Failed to create advertiser profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      advertiser: {
        advertiser_id: newAdvertiser.advertiser_id,
        name: newAdvertiser.name,
        created_at: newAdvertiser.created_at
      }
    });

  } catch (err) {
    console.error('[API] Advertiser profile creation error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
