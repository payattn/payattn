/**
 * PUT /api/publishers/[id]/wallet
 * 
 * Update publisher's Solana wallet address for receiving payments.
 * Validates address format before saving.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getSupabase } from '@/lib/supabase';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: publisherId } = await context.params;
    const body = await request.json();
    const { walletAddress } = body;

    // Validate required fields
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Validate Solana address format
    try {
      new PublicKey(walletAddress);
    } catch (err) {
      return NextResponse.json(
        { error: 'Invalid Solana wallet address' },
        { status: 400 }
      );
    }

    console.log(`[Publisher] Updating wallet for ${publisherId}: ${walletAddress}`);

    const supabase = getSupabase();

    // Update publisher wallet
    const { data, error } = await supabase
      .from('publishers')
      .update({
        wallet_address: walletAddress,
        wallet_verified: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', publisherId)
      .select()
      .single();

    if (error) {
      console.error('[Publisher] Failed to update wallet:', error);
      return NextResponse.json(
        { 
          error: 'Failed to save wallet address',
          message: error.message 
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Publisher not found' },
        { status: 404 }
      );
    }

    console.log(`[OK][OK][OK] [Publisher] Wallet updated for ${publisherId}`);

    return NextResponse.json({
      success: true,
      publisherId,
      walletAddress,
      explorerUrl: `https://explorer.solana.com/address/${walletAddress}?cluster=devnet`,
      message: 'Wallet address saved successfully'
    });

  } catch (err: any) {
    console.error('[Publisher] Error updating wallet:', err);
    return NextResponse.json(
      { 
        error: 'Failed to update wallet', 
        message: err.message 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/publishers/[id]/wallet
 * 
 * Get publisher's current wallet address.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: publisherId } = await context.params;

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('publishers')
      .select('wallet_address, wallet_verified')
      .eq('id', publisherId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Publisher not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      publisherId,
      walletAddress: data.wallet_address,
      walletVerified: data.wallet_verified,
      explorerUrl: data.wallet_address 
        ? `https://explorer.solana.com/address/${data.wallet_address}?cluster=devnet`
        : null
    });

  } catch (err: any) {
    console.error('[Publisher] Error fetching wallet:', err);
    return NextResponse.json(
      { 
        error: 'Failed to fetch wallet', 
        message: err.message 
      },
      { status: 500 }
    );
  }
}
