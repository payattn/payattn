import { GET, OPTIONS } from '../route';
import { NextRequest } from 'next/server';
import * as nacl from 'tweetnacl';
import * as web3 from '@solana/web3.js';

// Mock environment
process.env.KDS_SECRET = 'test-secret-key';

describe('KDS /api/k/[hash] endpoint', () => {
  let testKeypair: web3.Keypair;
  let walletAddress: string;
  let validHash: string;
  let validAuthToken: string;

  beforeAll(() => {
    // Generate test keypair
    testKeypair = web3.Keypair.generate();
    walletAddress = testKeypair.publicKey.toBase58();
    
    // Compute expected hash
    const crypto = require('crypto');
    validHash = crypto.createHash('sha256')
      .update(`payattn:${walletAddress}`)
      .digest('hex');
    
    // Sign message to create valid authToken
    const message = `Sign in to Pay Attention\n\nWallet: ${walletAddress}`;
    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.sign.detached(messageBytes, testKeypair.secretKey);
    validAuthToken = btoa(String.fromCharCode(...signature));
  });

  describe('GET /api/k/[hash]', () => {
    it('should return key material for valid authenticated request', async () => {
      const request = new NextRequest('http://localhost:3000/api/k/' + validHash, {
        headers: {
          'x-wallet': walletAddress,
          'x-auth-token': validAuthToken,
        },
      });

      const response = await GET(request, { params: Promise.resolve({ hash: validHash }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('keyMaterial');
      expect(data).toHaveProperty('version');
      expect(data.version).toBe('1');
      expect(typeof data.keyMaterial).toBe('string');
      expect(data.keyMaterial.length).toBeGreaterThan(0);
    });

    it('should reject request with invalid hash format (too short)', async () => {
      const request = new NextRequest('http://localhost:3000/api/k/abc123', {
        headers: {
          'x-wallet': walletAddress,
          'x-auth-token': validAuthToken,
        },
      });

      const response = await GET(request, { params: Promise.resolve({ hash: 'abc123' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid hash format');
    });

    it('should reject request with invalid hash format (wrong characters)', async () => {
      const invalidHash = 'g'.repeat(64); // 'g' is not a valid hex character
      const request = new NextRequest('http://localhost:3000/api/k/' + invalidHash, {
        headers: {
          'x-wallet': walletAddress,
          'x-auth-token': validAuthToken,
        },
      });

      const response = await GET(request, { params: Promise.resolve({ hash: invalidHash }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid hash format');
    });

    it('should reject request without wallet header', async () => {
      const request = new NextRequest('http://localhost:3000/api/k/' + validHash, {
        headers: {
          'x-auth-token': validAuthToken,
        },
      });

      const response = await GET(request, { params: Promise.resolve({ hash: validHash }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });

    it('should reject request without auth token header', async () => {
      const request = new NextRequest('http://localhost:3000/api/k/' + validHash, {
        headers: {
          'x-wallet': walletAddress,
        },
      });

      const response = await GET(request, { params: Promise.resolve({ hash: validHash }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });

    it('should reject request with invalid signature', async () => {
      const request = new NextRequest('http://localhost:3000/api/k/' + validHash, {
        headers: {
          'x-wallet': walletAddress,
          'x-auth-token': 'invalid-signature',
        },
      });

      const response = await GET(request, { params: Promise.resolve({ hash: validHash }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Invalid authentication signature');
    });

    it('should reject request with signature from different wallet', async () => {
      // Generate a different keypair
      const otherKeypair = web3.Keypair.generate();
      const message = `Sign in to Pay Attention\n\nWallet: ${walletAddress}`;
      const messageBytes = new TextEncoder().encode(message);
      const signature = nacl.sign.detached(messageBytes, otherKeypair.secretKey);
      const wrongAuthToken = btoa(String.fromCharCode(...signature));

      const request = new NextRequest('http://localhost:3000/api/k/' + validHash, {
        headers: {
          'x-wallet': walletAddress,
          'x-auth-token': wrongAuthToken,
        },
      });

      const response = await GET(request, { params: Promise.resolve({ hash: validHash }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Invalid authentication signature');
    });

    it('should reject request when hash does not match wallet', async () => {
      // Use a different wallet's hash
      const otherKeypair = web3.Keypair.generate();
      const otherWallet = otherKeypair.publicKey.toBase58();
      const crypto = require('crypto');
      const otherHash = crypto.createHash('sha256')
        .update(`payattn:${otherWallet}`)
        .digest('hex');

      const request = new NextRequest('http://localhost:3000/api/k/' + otherHash, {
        headers: {
          'x-wallet': walletAddress,
          'x-auth-token': validAuthToken,
        },
      });

      const response = await GET(request, { params: Promise.resolve({ hash: otherHash }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('KeyHash does not match authenticated wallet');
    });

    it('should return same key material for same wallet (deterministic)', async () => {
      const request1 = new NextRequest('http://localhost:3000/api/k/' + validHash, {
        headers: {
          'x-wallet': walletAddress,
          'x-auth-token': validAuthToken,
        },
      });

      const request2 = new NextRequest('http://localhost:3000/api/k/' + validHash, {
        headers: {
          'x-wallet': walletAddress,
          'x-auth-token': validAuthToken,
        },
      });

      const response1 = await GET(request1, { params: Promise.resolve({ hash: validHash }) });
      const response2 = await GET(request2, { params: Promise.resolve({ hash: validHash }) });
      
      const data1 = await response1.json();
      const data2 = await response2.json();

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(data1.keyMaterial).toBe(data2.keyMaterial);
    });

    it('should return different key material for different wallets', async () => {
      // Create second wallet
      const keypair2 = web3.Keypair.generate();
      const wallet2 = keypair2.publicKey.toBase58();
      const crypto = require('crypto');
      const hash2 = crypto.createHash('sha256')
        .update(`payattn:${wallet2}`)
        .digest('hex');
      
      const message2 = `Sign in to Pay Attention\n\nWallet: ${wallet2}`;
      const message2Bytes = new TextEncoder().encode(message2);
      const signature2 = nacl.sign.detached(message2Bytes, keypair2.secretKey);
      const authToken2 = btoa(String.fromCharCode(...signature2));

      const request1 = new NextRequest('http://localhost:3000/api/k/' + validHash, {
        headers: {
          'x-wallet': walletAddress,
          'x-auth-token': validAuthToken,
        },
      });

      const request2 = new NextRequest('http://localhost:3000/api/k/' + hash2, {
        headers: {
          'x-wallet': wallet2,
          'x-auth-token': authToken2,
        },
      });

      const response1 = await GET(request1, { params: Promise.resolve({ hash: validHash }) });
      const response2 = await GET(request2, { params: Promise.resolve({ hash: hash2 }) });
      
      const data1 = await response1.json();
      const data2 = await response2.json();

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(data1.keyMaterial).not.toBe(data2.keyMaterial);
    });
  });

  describe('OPTIONS /api/k/[hash]', () => {
    it('should return CORS headers', async () => {
      const response = await OPTIONS();

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, X-Wallet, X-Auth-Token');
    });
  });
});
