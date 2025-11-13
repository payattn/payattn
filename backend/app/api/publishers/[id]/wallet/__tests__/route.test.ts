import { PUT, GET } from '../route';
import { NextRequest } from 'next/server';
import { getSupabase } from '@/lib/supabase';

// Mock Supabase
jest.mock('@/lib/supabase');

const mockSupabase = {
  from: jest.fn(),
};

describe('/api/publishers/[id]/wallet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSupabase as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe('PUT /api/publishers/[id]/wallet', () => {
    it('should successfully update publisher wallet address', async () => {
      const mockPublisher = {
        id: 'pub-123',
        wallet_address: '7BgBvyjrZX1YKz4oh9mjb8ZScatkkwb8DzFx4M1Rh6sD',
        wallet_verified: true,
        updated_at: new Date().toISOString()
      };

      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockPublisher, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:3000/api/publishers/pub-123/wallet', {
        method: 'PUT',
        body: JSON.stringify({
          walletAddress: '7BgBvyjrZX1YKz4oh9mjb8ZScatkkwb8DzFx4M1Rh6sD'
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'pub-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.publisherId).toBe('pub-123');
      expect(data.walletAddress).toBe('7BgBvyjrZX1YKz4oh9mjb8ZScatkkwb8DzFx4M1Rh6sD');
      expect(data.explorerUrl).toContain('https://explorer.solana.com/address/');
      expect(data.message).toBe('Wallet address saved successfully');

      expect(mockSupabase.from).toHaveBeenCalledWith('publishers');
      expect(mockQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          wallet_address: '7BgBvyjrZX1YKz4oh9mjb8ZScatkkwb8DzFx4M1Rh6sD',
          wallet_verified: true,
        })
      );
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'pub-123');
    });

    it('should reject request without wallet address', async () => {
      const request = new NextRequest('http://localhost:3000/api/publishers/pub-123/wallet', {
        method: 'PUT',
        body: JSON.stringify({}),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'pub-123' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Wallet address is required');
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should reject invalid Solana wallet address', async () => {
      const request = new NextRequest('http://localhost:3000/api/publishers/pub-123/wallet', {
        method: 'PUT',
        body: JSON.stringify({
          walletAddress: 'invalid-address'
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'pub-123' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid Solana wallet address');
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should handle database update errors', async () => {
      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ 
          data: null, 
          error: { message: 'Database connection failed' } 
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:3000/api/publishers/pub-123/wallet', {
        method: 'PUT',
        body: JSON.stringify({
          walletAddress: '7BgBvyjrZX1YKz4oh9mjb8ZScatkkwb8DzFx4M1Rh6sD'
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'pub-123' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to save wallet address');
      expect(data.message).toBe('Database connection failed');
    });

    it('should return 404 when publisher not found', async () => {
      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:3000/api/publishers/nonexistent/wallet', {
        method: 'PUT',
        body: JSON.stringify({
          walletAddress: '7BgBvyjrZX1YKz4oh9mjb8ZScatkkwb8DzFx4M1Rh6sD'
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Publisher not found');
    });

    it('should handle JSON parsing errors', async () => {
      const request = new NextRequest('http://localhost:3000/api/publishers/pub-123/wallet', {
        method: 'PUT',
        body: 'invalid json{',
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'pub-123' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update wallet');
    });

    it('should accept different valid Solana addresses', async () => {
      const validAddresses = [
        '7BgBvyjrZX1YKz4oh9mjb8ZScatkkwb8DzFx4M1Rh6sD',
        'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy',
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      ];

      for (const address of validAddresses) {
        jest.clearAllMocks();

        const mockQuery = {
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ 
            data: { id: 'pub-123', wallet_address: address, wallet_verified: true }, 
            error: null 
          }),
        };
        mockSupabase.from.mockReturnValue(mockQuery);

        const request = new NextRequest('http://localhost:3000/api/publishers/pub-123/wallet', {
          method: 'PUT',
          body: JSON.stringify({ walletAddress: address }),
        });

        const response = await PUT(request, { params: Promise.resolve({ id: 'pub-123' }) });
        expect(response.status).toBe(200);
      }
    });
  });

  describe('GET /api/publishers/[id]/wallet', () => {
    it('should successfully fetch publisher wallet address', async () => {
      const mockData = {
        wallet_address: '7BgBvyjrZX1YKz4oh9mjb8ZScatkkwb8DzFx4M1Rh6sD',
        wallet_verified: true
      };

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:3000/api/publishers/pub-123/wallet');

      const response = await GET(request, { params: Promise.resolve({ id: 'pub-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.publisherId).toBe('pub-123');
      expect(data.walletAddress).toBe('7BgBvyjrZX1YKz4oh9mjb8ZScatkkwb8DzFx4M1Rh6sD');
      expect(data.walletVerified).toBe(true);
      expect(data.explorerUrl).toContain('https://explorer.solana.com/address/');

      expect(mockSupabase.from).toHaveBeenCalledWith('publishers');
      expect(mockQuery.select).toHaveBeenCalledWith('wallet_address, wallet_verified');
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'pub-123');
    });

    it('should return null explorerUrl when wallet address is not set', async () => {
      const mockData = {
        wallet_address: null,
        wallet_verified: false
      };

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:3000/api/publishers/pub-123/wallet');

      const response = await GET(request, { params: Promise.resolve({ id: 'pub-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.walletAddress).toBeNull();
      expect(data.walletVerified).toBe(false);
      expect(data.explorerUrl).toBeNull();
    });

    it('should return 404 when publisher not found (error)', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ 
          data: null, 
          error: { message: 'Not found' } 
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:3000/api/publishers/nonexistent/wallet');

      const response = await GET(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Publisher not found');
    });

    it('should return 404 when publisher not found (no data)', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:3000/api/publishers/nonexistent/wallet');

      const response = await GET(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Publisher not found');
    });

    it('should handle database errors', async () => {
      const mockQuery = {
        select: jest.fn().mockImplementation(() => {
          throw new Error('Database connection failed');
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:3000/api/publishers/pub-123/wallet');

      const response = await GET(request, { params: Promise.resolve({ id: 'pub-123' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch wallet');
      expect(data.message).toBe('Database connection failed');
    });
  });
});
