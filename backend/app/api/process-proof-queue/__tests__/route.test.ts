import { POST, GET } from '../route';
import { NextRequest } from 'next/server';
import { processProof } from '@/lib/zk/proof-queue-processor';

// Mock the proof processor
jest.mock('@/lib/zk/proof-queue-processor');

describe('/api/process-proof-queue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/process-proof-queue', () => {
    const validProofRequest = {
      circuitName: 'range_check',
      proof: {
        pi_a: ['1', '2', '1'],
        pi_b: [['1', '2'], ['3', '4'], ['5', '6']],
        pi_c: ['1', '2', '1'],
        protocol: 'groth16',
        curve: 'bn128'
      },
      publicSignals: ['1', '25000', '50000'],
      userId: 'test-user-123',
      campaignId: 'campaign-456',
      campaignRequirements: { min: 25000, max: 50000 }
    };

    it('should successfully process a valid proof', async () => {
      const mockResult = {
        proofId: 'proof_123',
        verified: true,
        result: {
          success: true,
          message: 'Proof verified successfully'
        }
      };

      (processProof as jest.Mock).mockResolvedValueOnce(mockResult);

      const request = new NextRequest('http://localhost:3000/api/process-proof-queue', {
        method: 'POST',
        body: JSON.stringify(validProofRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.result).toEqual(mockResult);

      expect(processProof).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user-123',
          campaignId: 'campaign-456',
          circuitName: 'range_check',
          proof: validProofRequest.proof,
          publicSignals: validProofRequest.publicSignals,
          campaignRequirements: validProofRequest.campaignRequirements
        })
      );
    });

    it('should generate default ID when not provided', async () => {
      const mockResult = {
        proofId: 'generated_123',
        verified: true,
        result: {
          success: true,
          message: 'Proof verified'
        }
      };

      (processProof as jest.Mock).mockResolvedValueOnce(mockResult);

      const requestWithoutId = { ...validProofRequest };
      delete (requestWithoutId as any).id;

      const request = new NextRequest('http://localhost:3000/api/process-proof-queue', {
        method: 'POST',
        body: JSON.stringify(requestWithoutId),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(processProof).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/^proof_\d+$/)
        })
      );
    });

    it('should use defaults for optional fields', async () => {
      const mockResult = {
        proofId: 'proof_123',
        verified: true,
        result: {
          success: true,
          message: 'Proof verified'
        }
      };

      (processProof as jest.Mock).mockResolvedValueOnce(mockResult);

      const minimalRequest = {
        circuitName: 'age_range',
        proof: validProofRequest.proof,
        publicSignals: ['1', '18', '65']
      };

      const request = new NextRequest('http://localhost:3000/api/process-proof-queue', {
        method: 'POST',
        body: JSON.stringify(minimalRequest),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(processProof).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test_user',
          campaignId: 'test_campaign'
        })
      );
    });

    it('should reject request without circuitName', async () => {
      const invalidRequest = {
        proof: validProofRequest.proof,
        publicSignals: validProofRequest.publicSignals
      };

      const request = new NextRequest('http://localhost:3000/api/process-proof-queue', {
        method: 'POST',
        body: JSON.stringify(invalidRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: circuitName, proof, publicSignals');
      expect(processProof).not.toHaveBeenCalled();
    });

    it('should reject request without proof', async () => {
      const invalidRequest = {
        circuitName: 'range_check',
        publicSignals: validProofRequest.publicSignals
      };

      const request = new NextRequest('http://localhost:3000/api/process-proof-queue', {
        method: 'POST',
        body: JSON.stringify(invalidRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: circuitName, proof, publicSignals');
      expect(processProof).not.toHaveBeenCalled();
    });

    it('should reject request without publicSignals', async () => {
      const invalidRequest = {
        circuitName: 'range_check',
        proof: validProofRequest.proof
      };

      const request = new NextRequest('http://localhost:3000/api/process-proof-queue', {
        method: 'POST',
        body: JSON.stringify(invalidRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: circuitName, proof, publicSignals');
      expect(processProof).not.toHaveBeenCalled();
    });

    it('should handle failed proof verification', async () => {
      const mockResult = {
        proofId: 'proof_123',
        verified: false,
        result: {
          success: false,
          message: 'Proof verification failed'
        }
      };

      (processProof as jest.Mock).mockResolvedValueOnce(mockResult);

      const request = new NextRequest('http://localhost:3000/api/process-proof-queue', {
        method: 'POST',
        body: JSON.stringify(validProofRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.result.verified).toBe(false);
      expect(data.result.result.message).toBe('Proof verification failed');
    });

    it('should handle proof processor errors', async () => {
      (processProof as jest.Mock).mockRejectedValueOnce(
        new Error('Verification service unavailable')
      );

      const request = new NextRequest('http://localhost:3000/api/process-proof-queue', {
        method: 'POST',
        body: JSON.stringify(validProofRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Verification service unavailable');
    });

    it('should handle non-Error exceptions', async () => {
      (processProof as jest.Mock).mockRejectedValueOnce('String error');

      const request = new NextRequest('http://localhost:3000/api/process-proof-queue', {
        method: 'POST',
        body: JSON.stringify(validProofRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unknown error');
    });

    it('should handle JSON parsing errors', async () => {
      const request = new NextRequest('http://localhost:3000/api/process-proof-queue', {
        method: 'POST',
        body: 'invalid json{',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(processProof).not.toHaveBeenCalled();
    });

    it('should support different circuit types', async () => {
      const circuits = ['range_check', 'set_membership', 'age_range'];

      for (const circuitName of circuits) {
        jest.clearAllMocks();

        const mockResult = {
          proofId: 'proof_123',
          verified: true,
          result: { success: true, message: 'Verified' }
        };

        (processProof as jest.Mock).mockResolvedValueOnce(mockResult);

        const request = new NextRequest('http://localhost:3000/api/process-proof-queue', {
          method: 'POST',
          body: JSON.stringify({
            ...validProofRequest,
            circuitName
          }),
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
        expect(processProof).toHaveBeenCalledWith(
          expect.objectContaining({ circuitName })
        );
      }
    });

    it('should handle campaign requirements for set_membership', async () => {
      const mockResult = {
        proofId: 'proof_123',
        verified: true,
        result: { success: true, message: 'Verified' }
      };

      (processProof as jest.Mock).mockResolvedValueOnce(mockResult);

      const requestWithSet = {
        ...validProofRequest,
        circuitName: 'set_membership',
        publicSignals: ['1', 'hashOfUS'],
        campaignRequirements: {
          allowedValues: ['us', 'uk', 'ca']
        }
      };

      const request = new NextRequest('http://localhost:3000/api/process-proof-queue', {
        method: 'POST',
        body: JSON.stringify(requestWithSet),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(processProof).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignRequirements: { allowedValues: ['us', 'uk', 'ca'] }
        })
      );
    });
  });

  describe('GET /api/process-proof-queue', () => {
    it('should return API documentation', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Proof Queue Processor');
      expect(data.endpoint).toBe('/api/process-proof-queue');
      expect(data.method).toBe('POST');
      expect(data.expectedBody).toHaveProperty('circuitName');
      expect(data.expectedBody).toHaveProperty('proof');
      expect(data.expectedBody).toHaveProperty('publicSignals');
    });

    it('should include example structure in documentation', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.expectedBody.circuitName).toBe('range_check | set_membership | age_range');
      expect(data.expectedBody.proof).toHaveProperty('pi_a');
      expect(data.expectedBody.campaignRequirements).toHaveProperty('min');
      expect(data.expectedBody.campaignRequirements).toHaveProperty('allowedValues');
    });
  });
});
