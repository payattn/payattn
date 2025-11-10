/**
 * Sessions API
 * List past Peggy assessment sessions
 */

import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/peggy/session-manager';

export async function GET(request: NextRequest) {
  try {
    // Get advertiser ID from headers
    const advertiserId = request.headers.get('x-advertiser-id');
    const sessionId = request.headers.get('x-session-id');
    
    if (!advertiserId) {
      return NextResponse.json(
        { error: 'Missing x-advertiser-id header' },
        { status: 400 }
      );
    }
    
    const sessionManager = new SessionManager();
    
    // If session_id provided, return specific session
    if (sessionId) {
      const session = sessionManager.getSessionById(advertiserId, sessionId);
      
      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json(session);
    }
    
    // Otherwise return all sessions (summary)
    const sessions = sessionManager.getSessionSummaries(advertiserId);
    
    return NextResponse.json({
      advertiserId,
      totalSessions: sessions.length,
      sessions
    });
    
  } catch (error) {
    console.error('Failed to fetch sessions:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch sessions',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
