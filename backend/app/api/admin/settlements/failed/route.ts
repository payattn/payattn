/**
 * GET /api/admin/settlements/failed
 * 
 * View failed settlements for admin dashboard monitoring.
 * Shows transactions that failed and are queued for retry.
 * 
 * TODO: Add proper admin authentication before production
 */

import { NextResponse } from 'next/server';
import { getFailedSettlements } from '@/lib/settlement-service';

export async function GET() {
  try {
    console.log('[Admin] Fetching failed settlements...');

    const failed = await getFailedSettlements();

    return NextResponse.json({
      count: failed.length,
      failed,
      message: failed.length === 0 
        ? 'No failed settlements' 
        : `${failed.length} settlements pending retry`
    });

  } catch (err: any) {
    console.error('[Admin] Error fetching failed settlements:', err);
    return NextResponse.json(
      { 
        error: 'Failed to fetch settlements', 
        message: err.message 
      },
      { status: 500 }
    );
  }
}
