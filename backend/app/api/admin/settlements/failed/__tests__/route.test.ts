import { GET } from '../route';
import { NextRequest } from 'next/server';
import { getFailedSettlements } from '@/lib/settlement-service';

// Mock the settlement service
jest.mock('@/lib/settlement-service', () => ({
  getFailedSettlements: jest.fn()
}));

const mockGetFailedSettlements = getFailedSettlements as jest.MockedFunction<typeof getFailedSettlements>;

describe('/api/admin/settlements/failed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/admin/settlements/failed', () => {
    it('should return empty list when no failed settlements', async () => {
      mockGetFailedSettlements.mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        count: 0,
        failed: [],
        message: 'No failed settlements'
      });
      expect(mockGetFailedSettlements).toHaveBeenCalledTimes(1);
    });

    it('should return list of failed settlements with count', async () => {
      const mockFailedSettlements = [
        {
          id: 'settlement-1',
          transaction_hash: 'hash1',
          error: 'Network timeout',
          retry_count: 2,
          created_at: '2025-01-01T00:00:00Z'
        },
        {
          id: 'settlement-2',
          transaction_hash: 'hash2',
          error: 'Insufficient funds',
          retry_count: 1,
          created_at: '2025-01-02T00:00:00Z'
        },
        {
          id: 'settlement-3',
          transaction_hash: 'hash3',
          error: 'RPC error',
          retry_count: 3,
          created_at: '2025-01-03T00:00:00Z'
        }
      ];

      mockGetFailedSettlements.mockResolvedValue(mockFailedSettlements);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        count: 3,
        failed: mockFailedSettlements,
        message: '3 settlements pending retry'
      });
      expect(mockGetFailedSettlements).toHaveBeenCalledTimes(1);
    });

    it('should include all settlement details in response', async () => {
      const mockSettlement = {
        id: 'settlement-1',
        transaction_hash: 'abc123',
        error: 'Transaction failed',
        retry_count: 5,
        created_at: '2025-01-01T00:00:00Z',
        last_retry_at: '2025-01-01T01:00:00Z'
      };

      mockGetFailedSettlements.mockResolvedValue([mockSettlement]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.failed[0]).toMatchObject({
        id: 'settlement-1',
        transaction_hash: 'abc123',
        error: 'Transaction failed',
        retry_count: 5
      });
    });

    it('should handle service errors gracefully', async () => {
      const mockError = new Error('Database connection failed');
      mockGetFailedSettlements.mockRejectedValue(mockError);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Failed to fetch settlements',
        message: 'Database connection failed'
      });
      expect(mockGetFailedSettlements).toHaveBeenCalledTimes(1);
    });

    it('should handle unknown errors', async () => {
      mockGetFailedSettlements.mockRejectedValue({ message: 'Unknown error' });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch settlements');
      expect(data.message).toBe('Unknown error');
    });

    it('should log API access for monitoring', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      mockGetFailedSettlements.mockResolvedValue([]);

      await GET();

      expect(consoleSpy).toHaveBeenCalledWith('[Admin] Fetching failed settlements...');
    });

    it('should log errors for debugging', async () => {
      const consoleSpy = jest.spyOn(console, 'error');
      const mockError = new Error('Test error');
      mockGetFailedSettlements.mockRejectedValue(mockError);

      await GET();

      expect(consoleSpy).toHaveBeenCalledWith('[Admin] Error fetching failed settlements:', mockError);
    });
  });
});
