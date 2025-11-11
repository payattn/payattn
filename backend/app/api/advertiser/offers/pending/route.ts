import { NextRequest, NextResponse } from 'next/server';
import { DatabaseClient } from '@/lib/peggy/database';

/**
 * GET /api/advertiser/offers/pending
 * Fetch pending offers for an advertiser without assessing them
 * Headers: x-advertiser-id
 */
export async function GET(request: NextRequest) {
  try {
    const advertiserId = request.headers.get('x-advertiser-id');
    
    if (!advertiserId) {
      return NextResponse.json(
        { error: 'x-advertiser-id header required' },
        { status: 400 }
      );
    }
    
    console.log('\n=== Fetching Pending Offers ===');
    console.log('Advertiser ID:', advertiserId);
    
    const db = new DatabaseClient();
    
    // Verify advertiser exists
    const advertiser = await db.getAdvertiser(advertiserId);
    if (!advertiser) {
      console.error('Advertiser not found:', advertiserId);
      return NextResponse.json(
        { error: 'Advertiser not found' },
        { status: 404 }
      );
    }
    
    // Get pending offers
    const offers = await db.getPendingOffersWithAds(advertiserId);
    
    console.log(`Found ${offers.length} pending offer(s)`);
    
    return NextResponse.json({
      offers,
      count: offers.length
    });
    
  } catch (error) {
    console.error('Error fetching pending offers:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
