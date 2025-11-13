import { POST } from '../route';
import { NextRequest } from 'next/server';

describe('/api/test/[id]', () => {
  describe('POST /api/test/[id]', () => {
    it('should return test response with offer ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/test/offer-123', {
        method: 'POST',
      });

      const response = await POST(request, { params: { id: 'offer-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Test route working');
      expect(data.offerId).toBe('offer-123');
      expect(data.url).toBe('http://localhost:3000/api/test/offer-123');
    });

    it('should work with different offer IDs', async () => {
      const testIds = ['offer-1', 'offer-abc', 'test-123'];

      for (const id of testIds) {
        const request = new NextRequest(`http://localhost:3000/api/test/${id}`, {
          method: 'POST',
        });

        const response = await POST(request, { params: { id } });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.offerId).toBe(id);
      }
    });
  });
});
