/**
 * Peggy Session Manager
 * Manages assessment sessions stored as JSON files
 */

import { writeFileSync, readFileSync, readdirSync, mkdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';

export interface AssessmentResult {
  offerId: string;
  adId: string;
  adHeadline?: string;
  userId: string;
  userWallet: string;
  amountLamports: number;
  amountSOL: number;
  proofValidation: {
    isValid: boolean;
    summary: string;
    validProofs: string[];
    invalidProofs: string[];
  };
  decision: 'accept' | 'reject';
  reasoning: string;
  confidence: number;
  funded?: {
    success: boolean;
    txSignature?: string;
    escrowPda?: string;
    error?: string;
  };
}

export interface AssessmentSession {
  sessionId: string;
  advertiserId: string;
  timestamp: number;
  dateString: string;
  stats: {
    totalOffers: number;
    accepted: number;
    rejected: number;
    funded: number;
    errors: number;
  };
  results: AssessmentResult[];
}

export class SessionManager {
  private baseDir: string;
  
  constructor(baseDir?: string) {
    // Default to backend/advertiser-sessions
    this.baseDir = baseDir || join(process.cwd(), 'advertiser-sessions');
    
    // Ensure base directory exists
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
  }
  
  /**
   * Save a new assessment session
   */
  saveSession(advertiserId: string, results: AssessmentResult[]): AssessmentSession {
    const timestamp = Date.now();
    const sessionId = `session_${timestamp}`;
    
    // Calculate stats
    const stats = {
      totalOffers: results.length,
      accepted: results.filter(r => r.decision === 'accept').length,
      rejected: results.filter(r => r.decision === 'reject').length,
      funded: results.filter(r => r.funded?.success).length,
      errors: results.filter(r => r.funded?.error).length
    };
    
    const session: AssessmentSession = {
      sessionId,
      advertiserId,
      timestamp,
      dateString: new Date(timestamp).toISOString(),
      stats,
      results
    };
    
    // Ensure advertiser directory exists
    const advertiserDir = join(this.baseDir, advertiserId);
    if (!existsSync(advertiserDir)) {
      mkdirSync(advertiserDir, { recursive: true });
    }
    
    // Save session file
    const filePath = join(advertiserDir, `${sessionId}.json`);
    writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf8');
    
    console.log(`[SessionManager] Saved session: ${filePath}`);
    
    return session;
  }
  
  /**
   * Load all sessions for an advertiser
   */
  loadSessions(advertiserId: string): AssessmentSession[] {
    const advertiserDir = join(this.baseDir, advertiserId);
    
    if (!existsSync(advertiserDir)) {
      return [];
    }
    
    const files = readdirSync(advertiserDir)
      .filter(f => f.startsWith('session_') && f.endsWith('.json'))
      .sort()
      .reverse(); // Newest first
    
    const sessions: AssessmentSession[] = [];
    
    for (const file of files) {
      try {
        const filePath = join(advertiserDir, file);
        const content = readFileSync(filePath, 'utf8');
        const session = JSON.parse(content) as AssessmentSession;
        sessions.push(session);
      } catch (error) {
        console.error(`[SessionManager] Failed to load session ${file}:`, error);
      }
    }
    
    return sessions;
  }
  
  /**
   * Load a specific session by ID
   */
  getSessionById(advertiserId: string, sessionId: string): AssessmentSession | null {
    const filePath = join(this.baseDir, advertiserId, `${sessionId}.json`);
    
    if (!existsSync(filePath)) {
      return null;
    }
    
    try {
      const content = readFileSync(filePath, 'utf8');
      return JSON.parse(content) as AssessmentSession;
    } catch (error) {
      console.error(`[SessionManager] Failed to load session ${sessionId}:`, error);
      return null;
    }
  }
  
  /**
   * Get session summary (for listing without full details)
   */
  getSessionSummaries(advertiserId: string): Array<{
    sessionId: string;
    timestamp: number;
    dateString: string;
    stats: AssessmentSession['stats'];
  }> {
    const advertiserDir = join(this.baseDir, advertiserId);
    
    if (!existsSync(advertiserDir)) {
      return [];
    }
    
    const files = readdirSync(advertiserDir)
      .filter(f => f.startsWith('session_') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    return files.map(file => {
      try {
        const filePath = join(advertiserDir, file);
        const content = readFileSync(filePath, 'utf8');
        const session = JSON.parse(content) as AssessmentSession;
        
        return {
          sessionId: session.sessionId,
          timestamp: session.timestamp,
          dateString: session.dateString,
          stats: session.stats
        };
      } catch (error) {
        console.error(`[SessionManager] Failed to read session summary ${file}:`, error);
        return null;
      }
    }).filter((s): s is NonNullable<typeof s> => s !== null);
  }
}
