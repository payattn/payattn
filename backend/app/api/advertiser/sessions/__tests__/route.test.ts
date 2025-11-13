/**
 * Tests for advertiser sessions API
 */

import { NextRequest } from 'next/server';
import { GET } from '../route';
import { SessionManager } from '@/lib/peggy/session-manager';

// Mock SessionManager
jest.mock('@/lib/peggy/session-manager');

describe('GET /api/advertiser/sessions', () => {
  let mockSessionManager: jest.Mocked<SessionManager>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSessionManager = {
      getSessionById: jest.fn(),
      getSessionSummaries: jest.fn(),
    } as any;
    
    (SessionManager as jest.Mock).mockImplementation(() => mockSessionManager);
  });
  
  describe('Request Validation', () => {
    it('should return 400 when x-advertiser-id header is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/advertiser/sessions');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing x-advertiser-id header');
    });
  });
  
  describe('Get Specific Session', () => {
    it('should return specific session when x-session-id header is provided', async () => {
      const mockSession = {
        sessionId: 'session_1234',
        advertiserId: 'adv_123',
        timestamp: 1234567890,
        dateString: '2023-01-01T00:00:00Z',
        stats: {
          totalOffers: 5,
          accepted: 3,
          rejected: 2,
          funded: 2,
          errors: 0
        },
        results: []
      };
      
      mockSessionManager.getSessionById.mockReturnValue(mockSession);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/sessions', {
        headers: {
          'x-advertiser-id': 'adv_123',
          'x-session-id': 'session_1234'
        }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toEqual(mockSession);
      expect(mockSessionManager.getSessionById).toHaveBeenCalledWith('adv_123', 'session_1234');
    });
    
    it('should return 404 when session is not found', async () => {
      mockSessionManager.getSessionById.mockReturnValue(null);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/sessions', {
        headers: {
          'x-advertiser-id': 'adv_123',
          'x-session-id': 'session_nonexistent'
        }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data.error).toBe('Session not found');
      expect(mockSessionManager.getSessionById).toHaveBeenCalledWith('adv_123', 'session_nonexistent');
    });
  });
  
  describe('Get All Sessions (Summary)', () => {
    it('should return all session summaries when no x-session-id header', async () => {
      const mockSummaries = [
        {
          sessionId: 'session_1234',
          timestamp: 1234567890,
          dateString: '2023-01-01T00:00:00Z',
          stats: {
            totalOffers: 5,
            accepted: 3,
            rejected: 2,
            funded: 2,
            errors: 0
          }
        },
        {
          sessionId: 'session_5678',
          timestamp: 1234567900,
          dateString: '2023-01-02T00:00:00Z',
          stats: {
            totalOffers: 3,
            accepted: 2,
            rejected: 1,
            funded: 1,
            errors: 0
          }
        }
      ];
      
      mockSessionManager.getSessionSummaries.mockReturnValue(mockSummaries);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/sessions', {
        headers: {
          'x-advertiser-id': 'adv_123'
        }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.advertiserId).toBe('adv_123');
      expect(data.totalSessions).toBe(2);
      expect(data.sessions).toEqual(mockSummaries);
      expect(mockSessionManager.getSessionSummaries).toHaveBeenCalledWith('adv_123');
    });
    
    it('should return empty array when advertiser has no sessions', async () => {
      mockSessionManager.getSessionSummaries.mockReturnValue([]);
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/sessions', {
        headers: {
          'x-advertiser-id': 'adv_new'
        }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.advertiserId).toBe('adv_new');
      expect(data.totalSessions).toBe(0);
      expect(data.sessions).toEqual([]);
    });
  });
  
  describe('Error Handling', () => {
    it('should return 500 when getSessionById throws an error', async () => {
      const testError = new Error('Database connection failed');
      mockSessionManager.getSessionById.mockImplementation(() => {
        throw testError;
      });
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/sessions', {
        headers: {
          'x-advertiser-id': 'adv_123',
          'x-session-id': 'session_1234'
        }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch sessions');
      expect(data.message).toBe('Database connection failed');
    });
    
    it('should return 500 when getSessionSummaries throws an error', async () => {
      const testError = new Error('File system error');
      mockSessionManager.getSessionSummaries.mockImplementation(() => {
        throw testError;
      });
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/sessions', {
        headers: {
          'x-advertiser-id': 'adv_123'
        }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch sessions');
      expect(data.message).toBe('File system error');
    });
    
    it('should handle non-Error exceptions', async () => {
      mockSessionManager.getSessionSummaries.mockImplementation(() => {
        throw 'String error';
      });
      
      const request = new NextRequest('http://localhost:3000/api/advertiser/sessions', {
        headers: {
          'x-advertiser-id': 'adv_123'
        }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch sessions');
      expect(data.message).toBe('Unknown error');
    });
  });
});
