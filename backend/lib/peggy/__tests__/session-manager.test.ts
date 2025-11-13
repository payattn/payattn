/**
 * Tests for Peggy Session Manager
 * Manages assessment sessions stored as JSON files
 */

import { vol } from 'memfs';

// Mock fs BEFORE importing session-manager
jest.mock('fs', () => {
  const memfs = require('memfs');
  return memfs.fs;
});

import { SessionManager, AssessmentResult } from '../session-manager';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  const testDir = '/test-sessions';
  const advertiserId = 'test-advertiser-123';

  beforeEach(() => {
    // Reset memfs
    vol.reset();
    
    // Create test directory
    vol.mkdirSync(testDir, { recursive: true });
    
    sessionManager = new SessionManager(testDir);
  });

  afterEach(() => {
    vol.reset();
  });

  describe('Constructor', () => {
    it('should create base directory if it does not exist', () => {
      vol.reset();
      const newManager = new SessionManager('/new-test-dir');
      expect(vol.existsSync('/new-test-dir')).toBe(true);
    });

    it('should use default directory when no baseDir provided', () => {
      const defaultManager = new SessionManager();
      // Should create advertiser-sessions in cwd
      const defaultPath = `${process.cwd()}/advertiser-sessions`;
      expect(vol.existsSync(defaultPath)).toBe(true);
    });

    it('should not throw if directory already exists', () => {
      vol.mkdirSync('/existing-dir', { recursive: true });
      expect(() => new SessionManager('/existing-dir')).not.toThrow();
    });
  });

  describe('saveSession', () => {
    it('should save session with single result', () => {
      const results: AssessmentResult[] = [{
        offerId: 'offer1',
        adId: 'ad1',
        adHeadline: 'Test Ad',
        userId: 'user1',
        userWallet: 'wallet1',
        amountLamports: 1000000,
        amountSOL: 0.001,
        proofValidation: {
          isValid: true,
          summary: 'Valid',
          validProofs: ['age'],
          invalidProofs: []
        },
        decision: 'accept',
        reasoning: 'Good match',
        confidence: 0.95,
        funded: {
          success: true,
          txSignature: 'tx123',
          escrowPda: 'escrow123'
        }
      }];

      const session = sessionManager.saveSession(advertiserId, results);

      expect(session.advertiserId).toBe(advertiserId);
      expect(session.sessionId).toMatch(/^session_\d+$/);
      expect(session.results).toEqual(results);
      expect(session.stats).toEqual({
        totalOffers: 1,
        accepted: 1,
        rejected: 0,
        funded: 1,
        errors: 0
      });
      
      // Verify file was created
      const filePath = `${testDir}/${advertiserId}/${session.sessionId}.json`;
      expect(vol.existsSync(filePath)).toBe(true);
    });

    it('should calculate stats correctly for multiple results', () => {
      const results: AssessmentResult[] = [
        {
          offerId: 'offer1',
          adId: 'ad1',
          userId: 'user1',
          userWallet: 'wallet1',
          amountLamports: 1000000,
          amountSOL: 0.001,
          proofValidation: {
            isValid: true,
            summary: 'Valid',
            validProofs: ['age'],
            invalidProofs: []
          },
          decision: 'accept',
          reasoning: 'Good',
          confidence: 0.9,
          funded: {
            success: true,
            txSignature: 'tx1'
          }
        },
        {
          offerId: 'offer2',
          adId: 'ad2',
          userId: 'user2',
          userWallet: 'wallet2',
          amountLamports: 2000000,
          amountSOL: 0.002,
          proofValidation: {
            isValid: false,
            summary: 'Invalid',
            validProofs: [],
            invalidProofs: ['age']
          },
          decision: 'reject',
          reasoning: 'Not a match',
          confidence: 0.8
        },
        {
          offerId: 'offer3',
          adId: 'ad3',
          userId: 'user3',
          userWallet: 'wallet3',
          amountLamports: 3000000,
          amountSOL: 0.003,
          proofValidation: {
            isValid: true,
            summary: 'Valid',
            validProofs: ['age', 'location'],
            invalidProofs: []
          },
          decision: 'accept',
          reasoning: 'Perfect',
          confidence: 0.95,
          funded: {
            success: false,
            error: 'Insufficient funds'
          }
        }
      ];

      const session = sessionManager.saveSession(advertiserId, results);

      expect(session.stats).toEqual({
        totalOffers: 3,
        accepted: 2,
        rejected: 1,
        funded: 1,
        errors: 1
      });
    });

    it('should create advertiser directory if it does not exist', () => {
      const results: AssessmentResult[] = [{
        offerId: 'offer1',
        adId: 'ad1',
        userId: 'user1',
        userWallet: 'wallet1',
        amountLamports: 1000000,
        amountSOL: 0.001,
        proofValidation: {
          isValid: true,
          summary: 'Valid',
          validProofs: [],
          invalidProofs: []
        },
        decision: 'accept',
        reasoning: 'Good',
        confidence: 0.9
      }];

      const newAdvertiserId = 'new-advertiser-456';
      expect(vol.existsSync(`${testDir}/${newAdvertiserId}`)).toBe(false);

      sessionManager.saveSession(newAdvertiserId, results);

      expect(vol.existsSync(`${testDir}/${newAdvertiserId}`)).toBe(true);
    });

    it('should include timestamp and dateString in session', () => {
      const results: AssessmentResult[] = [{
        offerId: 'offer1',
        adId: 'ad1',
        userId: 'user1',
        userWallet: 'wallet1',
        amountLamports: 1000000,
        amountSOL: 0.001,
        proofValidation: {
          isValid: true,
          summary: 'Valid',
          validProofs: [],
          invalidProofs: []
        },
        decision: 'accept',
        reasoning: 'Good',
        confidence: 0.9
      }];

      const beforeTime = Date.now();
      const session = sessionManager.saveSession(advertiserId, results);
      const afterTime = Date.now();

      expect(session.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(session.timestamp).toBeLessThanOrEqual(afterTime);
      expect(session.dateString).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should save session as formatted JSON', () => {
      const results: AssessmentResult[] = [{
        offerId: 'offer1',
        adId: 'ad1',
        userId: 'user1',
        userWallet: 'wallet1',
        amountLamports: 1000000,
        amountSOL: 0.001,
        proofValidation: {
          isValid: true,
          summary: 'Valid',
          validProofs: [],
          invalidProofs: []
        },
        decision: 'accept',
        reasoning: 'Good',
        confidence: 0.9
      }];

      const session = sessionManager.saveSession(advertiserId, results);
      const filePath = `${testDir}/${advertiserId}/${session.sessionId}.json`;
      const content = vol.readFileSync(filePath, 'utf8') as string;
      
      expect(content).toContain('\n');  // Should be formatted with newlines
      const parsed = JSON.parse(content);
      expect(parsed.sessionId).toBe(session.sessionId);
    });
  });

  describe('loadSessions', () => {
    it('should return empty array when advertiser has no sessions', () => {
      const sessions = sessionManager.loadSessions('nonexistent-advertiser');
      expect(sessions).toEqual([]);
    });

    it('should load single session', () => {
      const results: AssessmentResult[] = [{
        offerId: 'offer1',
        adId: 'ad1',
        userId: 'user1',
        userWallet: 'wallet1',
        amountLamports: 1000000,
        amountSOL: 0.001,
        proofValidation: {
          isValid: true,
          summary: 'Valid',
          validProofs: [],
          invalidProofs: []
        },
        decision: 'accept',
        reasoning: 'Good',
        confidence: 0.9
      }];

      const savedSession = sessionManager.saveSession(advertiserId, results);
      const loadedSessions = sessionManager.loadSessions(advertiserId);

      expect(loadedSessions).toHaveLength(1);
      expect(loadedSessions[0]?.sessionId).toBe(savedSession.sessionId);
      expect(loadedSessions[0]?.results).toEqual(results);
    });

    it('should load multiple sessions in reverse chronological order', async () => {
      const results1: AssessmentResult[] = [{
        offerId: 'offer1',
        adId: 'ad1',
        userId: 'user1',
        userWallet: 'wallet1',
        amountLamports: 1000000,
        amountSOL: 0.001,
        proofValidation: {
          isValid: true,
          summary: 'Valid',
          validProofs: [],
          invalidProofs: []
        },
        decision: 'accept',
        reasoning: 'Good',
        confidence: 0.9
      }];

      const results2: AssessmentResult[] = [{
        offerId: 'offer2',
        adId: 'ad2',
        userId: 'user2',
        userWallet: 'wallet2',
        amountLamports: 2000000,
        amountSOL: 0.002,
        proofValidation: {
          isValid: true,
          summary: 'Valid',
          validProofs: [],
          invalidProofs: []
        },
        decision: 'reject',
        reasoning: 'Not good',
        confidence: 0.5
      }];

      const session1 = sessionManager.saveSession(advertiserId, results1);
      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 5));
      const session2 = sessionManager.saveSession(advertiserId, results2);

      const loadedSessions = sessionManager.loadSessions(advertiserId);

      expect(loadedSessions).toHaveLength(2);
      // Newer session should be first
      expect(loadedSessions[0]?.sessionId).toBe(session2.sessionId);
      expect(loadedSessions[1]?.sessionId).toBe(session1.sessionId);
    });

    it('should skip files that are not session JSON files', () => {
      const results: AssessmentResult[] = [{
        offerId: 'offer1',
        adId: 'ad1',
        userId: 'user1',
        userWallet: 'wallet1',
        amountLamports: 1000000,
        amountSOL: 0.001,
        proofValidation: {
          isValid: true,
          summary: 'Valid',
          validProofs: [],
          invalidProofs: []
        },
        decision: 'accept',
        reasoning: 'Good',
        confidence: 0.9
      }];

      sessionManager.saveSession(advertiserId, results);

      // Create non-session files
      const advertiserDir = `${testDir}/${advertiserId}`;
      vol.writeFileSync(`${advertiserDir}/readme.txt`, 'test');
      vol.writeFileSync(`${advertiserDir}/other.json`, '{}');

      const sessions = sessionManager.loadSessions(advertiserId);

      expect(sessions).toHaveLength(1);
    });

    it('should handle corrupted session files gracefully', () => {
      const advertiserDir = `${testDir}/${advertiserId}`;
      vol.mkdirSync(advertiserDir, { recursive: true });
      
      // Create valid session
      const results: AssessmentResult[] = [{
        offerId: 'offer1',
        adId: 'ad1',
        userId: 'user1',
        userWallet: 'wallet1',
        amountLamports: 1000000,
        amountSOL: 0.001,
        proofValidation: {
          isValid: true,
          summary: 'Valid',
          validProofs: [],
          invalidProofs: []
        },
        decision: 'accept',
        reasoning: 'Good',
        confidence: 0.9
      }];
      sessionManager.saveSession(advertiserId, results);

      // Create corrupted session file
      vol.writeFileSync(`${advertiserDir}/session_123.json`, 'invalid json{');

      const sessions = sessionManager.loadSessions(advertiserId);

      // Should only load the valid session
      expect(sessions).toHaveLength(1);
    });
  });

  describe('getSessionById', () => {
    it('should return null when session does not exist', () => {
      const session = sessionManager.getSessionById(advertiserId, 'nonexistent-session');
      expect(session).toBeNull();
    });

    it('should load specific session by ID', () => {
      const results: AssessmentResult[] = [{
        offerId: 'offer1',
        adId: 'ad1',
        userId: 'user1',
        userWallet: 'wallet1',
        amountLamports: 1000000,
        amountSOL: 0.001,
        proofValidation: {
          isValid: true,
          summary: 'Valid',
          validProofs: [],
          invalidProofs: []
        },
        decision: 'accept',
        reasoning: 'Good',
        confidence: 0.9
      }];

      const savedSession = sessionManager.saveSession(advertiserId, results);
      const loadedSession = sessionManager.getSessionById(advertiserId, savedSession.sessionId);

      expect(loadedSession).not.toBeNull();
      expect(loadedSession?.sessionId).toBe(savedSession.sessionId);
      expect(loadedSession?.results).toEqual(results);
    });

    it('should return null when session file is corrupted', () => {
      const advertiserDir = `${testDir}/${advertiserId}`;
      vol.mkdirSync(advertiserDir, { recursive: true });
      vol.writeFileSync(`${advertiserDir}/session_corrupt.json`, 'invalid json{');

      const session = sessionManager.getSessionById(advertiserId, 'session_corrupt');
      expect(session).toBeNull();
    });
  });

  describe('getSessionSummaries', () => {
    it('should return empty array when advertiser has no sessions', () => {
      const summaries = sessionManager.getSessionSummaries('nonexistent-advertiser');
      expect(summaries).toEqual([]);
    });

    it('should return summaries without full result details', () => {
      const results: AssessmentResult[] = [{
        offerId: 'offer1',
        adId: 'ad1',
        userId: 'user1',
        userWallet: 'wallet1',
        amountLamports: 1000000,
        amountSOL: 0.001,
        proofValidation: {
          isValid: true,
          summary: 'Valid',
          validProofs: [],
          invalidProofs: []
        },
        decision: 'accept',
        reasoning: 'Good',
        confidence: 0.9,
        funded: {
          success: true,
          txSignature: 'tx123'
        }
      }];

      const savedSession = sessionManager.saveSession(advertiserId, results);
      const summaries = sessionManager.getSessionSummaries(advertiserId);

      expect(summaries).toHaveLength(1);
      expect(summaries[0]).toEqual({
        sessionId: savedSession.sessionId,
        timestamp: savedSession.timestamp,
        dateString: savedSession.dateString,
        stats: savedSession.stats
      });
      // Should NOT include results
      expect(summaries[0]).not.toHaveProperty('results');
    });

    it('should return multiple summaries in reverse chronological order', async () => {
      const results1: AssessmentResult[] = [{
        offerId: 'offer1',
        adId: 'ad1',
        userId: 'user1',
        userWallet: 'wallet1',
        amountLamports: 1000000,
        amountSOL: 0.001,
        proofValidation: {
          isValid: true,
          summary: 'Valid',
          validProofs: [],
          invalidProofs: []
        },
        decision: 'accept',
        reasoning: 'Good',
        confidence: 0.9
      }];

      const results2: AssessmentResult[] = [{
        offerId: 'offer2',
        adId: 'ad2',
        userId: 'user2',
        userWallet: 'wallet2',
        amountLamports: 2000000,
        amountSOL: 0.002,
        proofValidation: {
          isValid: true,
          summary: 'Valid',
          validProofs: [],
          invalidProofs: []
        },
        decision: 'reject',
        reasoning: 'Not good',
        confidence: 0.5
      }];

      const session1 = sessionManager.saveSession(advertiserId, results1);
      await new Promise(resolve => setTimeout(resolve, 5));
      const session2 = sessionManager.saveSession(advertiserId, results2);

      const summaries = sessionManager.getSessionSummaries(advertiserId);

      expect(summaries).toHaveLength(2);
      expect(summaries[0]?.sessionId).toBe(session2.sessionId);
      expect(summaries[1]?.sessionId).toBe(session1.sessionId);
    });

    it('should filter out corrupted sessions', () => {
      const advertiserDir = `${testDir}/${advertiserId}`;
      vol.mkdirSync(advertiserDir, { recursive: true });

      // Create valid session
      const results: AssessmentResult[] = [{
        offerId: 'offer1',
        adId: 'ad1',
        userId: 'user1',
        userWallet: 'wallet1',
        amountLamports: 1000000,
        amountSOL: 0.001,
        proofValidation: {
          isValid: true,
          summary: 'Valid',
          validProofs: [],
          invalidProofs: []
        },
        decision: 'accept',
        reasoning: 'Good',
        confidence: 0.9
      }];
      sessionManager.saveSession(advertiserId, results);

      // Create corrupted session file
      vol.writeFileSync(`${advertiserDir}/session_corrupt.json`, 'invalid json{');

      const summaries = sessionManager.getSessionSummaries(advertiserId);

      // Should only include valid session
      expect(summaries).toHaveLength(1);
    });
  });
});
