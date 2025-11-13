import { GET } from '../route';
import { NextRequest } from 'next/server';

// Mock the campaigns JSON file - actual file has campaigns array at top level
// Dynamic import will wrap it in { default: <file contents> }
jest.mock('@/public/mock-campaigns.json', () => ({
  campaigns: [
    {
      id: 'camp-1',
      name: 'Test Campaign 1',
      status: 'active'
    },
    {
      id: 'camp-2',
      name: 'Test Campaign 2',
      status: 'paused'
    }
  ]
}), { virtual: true });

describe('/api/campaigns', () => {
  describe('GET /api/campaigns', () => {
    it('should return mock campaigns data', async () => {
      const request = new NextRequest('http://localhost:3000/api/campaigns');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(data).toHaveProperty('campaigns');
      expect(Array.isArray(data.campaigns)).toBe(true);
      expect(data.campaigns).toHaveLength(2);
      expect(data.campaigns[0]).toMatchObject({
        id: 'camp-1',
        name: 'Test Campaign 1',
        status: 'active'
      });
    });

    it('should handle import errors', async () => {
      // Override the mock to throw an error
      jest.doMock('@/public/mock-campaigns.json', () => {
        throw new Error('Mock import failed');
      });

      // Clear module cache and re-import to trigger error
      jest.resetModules();
      const { GET: FailingGET } = await import('../route');

      const request = new NextRequest('http://localhost:3000/api/campaigns');
      const response = await FailingGET(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch campaigns');
    });
  });
});
