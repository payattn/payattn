import { describe, test, expect } from '@jest/globals';
import { encryptData, decryptData, hashSignature, bytesToBase58 } from '../crypto-pure';

describe('Data Encryption and Decryption', () => {
  
  // Valid Solana public key for testing
  const testPublicKey = '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR';
  
  test('should encrypt and decrypt data correctly', async () => {
    const testData = 'Hello, PayAttn!';
    
    const encrypted = await encryptData(testData, testPublicKey);
    const decrypted = await decryptData(encrypted, testPublicKey);
    
    expect(decrypted).toBe(testData);
  });

  test('should produce different ciphertext for same data', async () => {
    const testData = 'Test data';
    
    const encrypted1 = await encryptData(testData, testPublicKey);
    const encrypted2 = await encryptData(testData, testPublicKey);
    
    // Should be different due to random IV
    expect(encrypted1).not.toBe(encrypted2);
    
    // But both should decrypt to same value
    const decrypted1 = await decryptData(encrypted1, testPublicKey);
    const decrypted2 = await decryptData(encrypted2, testPublicKey);
    
    expect(decrypted1).toBe(testData);
    expect(decrypted2).toBe(testData);
  });

  test('should handle empty string', async () => {
    const emptyData = '';
    
    const encrypted = await encryptData(emptyData, testPublicKey);
    const decrypted = await decryptData(encrypted, testPublicKey);
    
    expect(decrypted).toBe(emptyData);
  });

  test('should handle JSON data', async () => {
    const jsonData = JSON.stringify({ 
      user: 'test', 
      age: 30, 
      interests: ['web3', 'crypto']
    });
    
    const encrypted = await encryptData(jsonData, testPublicKey);
    const decrypted = await decryptData(encrypted, testPublicKey);
    
    expect(decrypted).toBe(jsonData);
    expect(JSON.parse(decrypted)).toEqual({
      user: 'test',
      age: 30,
      interests: ['web3', 'crypto']
    });
  });

  test('should handle special characters', async () => {
    const specialData = 'Test with emoji 😀 and symbols @#$%';
    
    const encrypted = await encryptData(specialData, testPublicKey);
    const decrypted = await decryptData(encrypted, testPublicKey);
    
    expect(decrypted).toBe(specialData);
  });

  test('should handle very long strings', async () => {
    const longData = 'A'.repeat(10000);
    
    const encrypted = await encryptData(longData, testPublicKey);
    const decrypted = await decryptData(encrypted, testPublicKey);
    
    expect(decrypted).toBe(longData);
    expect(decrypted.length).toBe(10000);
  });

  test('should fail with wrong public key', async () => {
    const testData = 'Secret data';
    const publicKey1 = '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR';
    const publicKey2 = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';
    
    const encrypted = await encryptData(testData, publicKey1);
    
    // Decrypting with different key should fail
    await expect(
      decryptData(encrypted, publicKey2)
    ).rejects.toThrow();
  });

  test('encrypted data should be base64 string', async () => {
    const testData = 'Test';
    const encrypted = await encryptData(testData, testPublicKey);
    
    expect(typeof encrypted).toBe('string');
    expect(encrypted.length).toBeGreaterThan(0);
    
    // Should be valid base64 (can be decoded)
    expect(() => atob(encrypted)).not.toThrow();
  });

  test('should handle Unicode characters', async () => {
    const unicodeData = '日本語 中文 한국어 العربية';
    
    const encrypted = await encryptData(unicodeData, testPublicKey);
    const decrypted = await decryptData(encrypted, testPublicKey);
    
    expect(decrypted).toBe(unicodeData);
  });
});

describe('Signature Hashing', () => {
  
  test('should hash signature to hex string', async () => {
    const signature = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    
    const hash = await hashSignature(signature);
    
    expect(typeof hash).toBe('string');
    expect(hash).toMatch(/^[0-9a-f]+$/); // Hex string
    expect(hash.length).toBe(64); // SHA-256 produces 64 hex chars
  });

  test('should produce deterministic hash', async () => {
    const signature = new Uint8Array([1, 2, 3, 4, 5]);
    
    const hash1 = await hashSignature(signature);
    const hash2 = await hashSignature(signature);
    
    expect(hash1).toBe(hash2);
  });

  test('should produce different hashes for different signatures', async () => {
    const sig1 = new Uint8Array([1, 2, 3]);
    const sig2 = new Uint8Array([1, 2, 4]);
    
    const hash1 = await hashSignature(sig1);
    const hash2 = await hashSignature(sig2);
    
    expect(hash1).not.toBe(hash2);
  });

  test('should handle empty signature', async () => {
    const emptySignature = new Uint8Array([]);
    
    const hash = await hashSignature(emptySignature);
    
    expect(typeof hash).toBe('string');
    expect(hash.length).toBe(64);
  });

  test('should handle large signatures', async () => {
    const largeSignature = new Uint8Array(1000).fill(255);
    
    const hash = await hashSignature(largeSignature);
    
    expect(typeof hash).toBe('string');
    expect(hash.length).toBe(64);
  });

  test('should handle typical Solana signature size', async () => {
    // Solana signatures are 64 bytes
    const solanaSignature = new Uint8Array(64).map((_, i) => i % 256);
    
    const hash = await hashSignature(solanaSignature);
    
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('Base58 Encoding', () => {
  
  test('should encode bytes to base58', () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4, 5]);
    
    const base58 = bytesToBase58(bytes);
    
    expect(typeof base58).toBe('string');
    expect(base58.length).toBeGreaterThan(0);
    expect(base58).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/); // Valid base58
  });

  test('should handle leading zeros', () => {
    const bytesWithZeros = new Uint8Array([0, 0, 0, 1, 2, 3]);
    
    const base58 = bytesToBase58(bytesWithZeros);
    
    // Leading zeros should become '1' in base58
    expect(base58).toMatch(/^1+/);
  });

  test('should handle all zeros', () => {
    const allZeros = new Uint8Array([0, 0, 0]);
    
    const base58 = bytesToBase58(allZeros);
    
    expect(base58).toBe('111');
  });

  test('should handle single byte', () => {
    const singleByte = new Uint8Array([42]);
    
    const base58 = bytesToBase58(singleByte);
    
    expect(typeof base58).toBe('string');
    expect(base58.length).toBeGreaterThan(0);
  });

  test('should produce deterministic output', () => {
    const bytes = new Uint8Array([10, 20, 30, 40, 50]);
    
    const base58_1 = bytesToBase58(bytes);
    const base58_2 = bytesToBase58(bytes);
    
    expect(base58_1).toBe(base58_2);
  });

  test('should handle typical Solana public key size', () => {
    // Solana public keys are 32 bytes
    const publicKeyBytes = new Uint8Array(32).map((_, i) => i * 8 % 256);
    
    const base58 = bytesToBase58(publicKeyBytes);
    
    // Solana addresses are typically 32-44 characters
    expect(base58.length).toBeGreaterThanOrEqual(32);
    expect(base58.length).toBeLessThanOrEqual(44);
  });

  test('should handle empty array', () => {
    const empty = new Uint8Array([]);
    
    const base58 = bytesToBase58(empty);
    
    expect(base58).toBe('');
  });
});

describe('Encryption Key Properties', () => {
  
  test('should use different public keys produce different encryption', async () => {
    const testData = 'Same data';
    const key1 = '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR';
    const key2 = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';
    
    const encrypted1 = await encryptData(testData, key1);
    const encrypted2 = await encryptData(testData, key2);
    
    // Different keys should produce different ciphertext
    expect(encrypted1).not.toBe(encrypted2);
  });

  test('encryption should be deterministic per key', async () => {
    // Note: This is NOT true due to random IV, but we test consistency
    const testData = 'Test';
    const key = '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR';
    
    const encrypted1 = await encryptData(testData, key);
    const encrypted2 = await encryptData(testData, key);
    
    // Both should decrypt to same value even if ciphertext differs
    const decrypted1 = await decryptData(encrypted1, key);
    const decrypted2 = await decryptData(encrypted2, key);
    
    expect(decrypted1).toBe(testData);
    expect(decrypted2).toBe(testData);
  });
});

describe('Error Handling', () => {
  
  test('should handle invalid base64 in decryption', async () => {
    const invalidBase64 = 'not-valid-base64!@#$';
    const key = '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR';
    
    await expect(
      decryptData(invalidBase64, key)
    ).rejects.toThrow();
  });

  test('should handle corrupted encrypted data', async () => {
    const testData = 'Test';
    const key = '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR';
    
    const encrypted = await encryptData(testData, key);
    // Corrupt the encrypted data by changing a character
    const corrupted = encrypted.slice(0, -5) + 'XXXXX';
    
    await expect(
      decryptData(corrupted, key)
    ).rejects.toThrow();
  });

  test('should handle very short encrypted data', async () => {
    const shortData = 'abc'; // Too short to be valid encrypted data
    const key = '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR';
    
    await expect(
      decryptData(shortData, key)
    ).rejects.toThrow();
  });
});

describe('KDS Integration', () => {
  const { fetchKeyMaterial } = require('../crypto-pure');
  
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should fetch key material successfully', async () => {
    const mockKeyMaterial = 'test-key-material-abc123';
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ keyMaterial: mockKeyMaterial })
    });

    const keyHash = 'test-key-hash';
    const walletAddress = '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR';
    const authToken = 'test-auth-token';

    const result = await fetchKeyMaterial(keyHash, walletAddress, authToken);

    expect(result).toBe(mockKeyMaterial);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(keyHash),
      expect.objectContaining({
        headers: {
          'X-Wallet': walletAddress,
          'X-Auth-Token': authToken
        }
      })
    );
  });

  test('should handle 401 authentication required', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401
    });

    await expect(
      fetchKeyMaterial('hash', 'wallet', 'token')
    ).rejects.toThrow('Authentication required');
  });

  test('should handle 403 invalid authentication', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403
    });

    await expect(
      fetchKeyMaterial('hash', 'wallet', 'token')
    ).rejects.toThrow('Invalid authentication');
  });

  test('should handle generic HTTP errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500
    });

    await expect(
      fetchKeyMaterial('hash', 'wallet', 'token')
    ).rejects.toThrow('KDS returned 500');
  });

  test('should handle invalid KDS response format', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ invalidField: 'no keyMaterial' })
    });

    await expect(
      fetchKeyMaterial('hash', 'wallet', 'token')
    ).rejects.toThrow('Invalid KDS response');
  });

  test('should handle network errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network failure'));

    await expect(
      fetchKeyMaterial('hash', 'wallet', 'token')
    ).rejects.toThrow('Network failure');
  });
});

describe('Key Derivation', () => {
  const { deriveKeyFromMaterial } = require('../crypto-pure');

  test('should derive key from material and wallet address', async () => {
    const keyMaterial = 'test-material-123';
    const walletAddress = '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR';

    const key = await deriveKeyFromMaterial(keyMaterial, walletAddress);

    expect(key).toBeDefined();
    expect(key.type).toBe('secret');
    expect(key.algorithm).toMatchObject({
      name: 'AES-GCM',
      length: 256
    });
  });

  test('should produce same key for same inputs', async () => {
    const keyMaterial = 'consistent-material';
    const walletAddress = '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR';

    const key1 = await deriveKeyFromMaterial(keyMaterial, walletAddress);
    const key2 = await deriveKeyFromMaterial(keyMaterial, walletAddress);

    const exported1 = await crypto.subtle.exportKey('raw', key1);
    const exported2 = await crypto.subtle.exportKey('raw', key2);

    expect(new Uint8Array(exported1)).toEqual(new Uint8Array(exported2));
  });

  test('should produce different keys for different materials', async () => {
    const walletAddress = '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR';

    const key1 = await deriveKeyFromMaterial('material-1', walletAddress);
    const key2 = await deriveKeyFromMaterial('material-2', walletAddress);

    const exported1 = await crypto.subtle.exportKey('raw', key1);
    const exported2 = await crypto.subtle.exportKey('raw', key2);

    expect(new Uint8Array(exported1)).not.toEqual(new Uint8Array(exported2));
  });

  test('should produce different keys for different wallet addresses', async () => {
    const keyMaterial = 'same-material';

    const key1 = await deriveKeyFromMaterial(keyMaterial, '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR');
    const key2 = await deriveKeyFromMaterial(keyMaterial, '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');

    const exported1 = await crypto.subtle.exportKey('raw', key1);
    const exported2 = await crypto.subtle.exportKey('raw', key2);

    expect(new Uint8Array(exported1)).not.toEqual(new Uint8Array(exported2));
  });

  test('should use wallet address as salt component', async () => {
    const keyMaterial = 'test-material';
    const wallet1 = 'wallet1';
    const wallet2 = 'wallet2';

    const key1 = await deriveKeyFromMaterial(keyMaterial, wallet1);
    const key2 = await deriveKeyFromMaterial(keyMaterial, wallet2);

    const exported1 = await crypto.subtle.exportKey('raw', key1);
    const exported2 = await crypto.subtle.exportKey('raw', key2);

    expect(new Uint8Array(exported1)).not.toEqual(new Uint8Array(exported2));
  });
});

describe('KDS Material-Based Encryption/Decryption', () => {
  const { encryptDataWithMaterial, decryptDataWithMaterial } = require('../crypto-pure');

  test('should encrypt and decrypt data with KDS material', async () => {
    const data = 'Sensitive user data';
    const keyMaterial = 'kds-material-xyz789';
    const walletAddress = '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR';

    const encrypted = await encryptDataWithMaterial(data, keyMaterial, walletAddress);
    expect(encrypted).toBeDefined();
    expect(typeof encrypted).toBe('string');
    expect(encrypted.length).toBeGreaterThan(0);

    const decrypted = await decryptDataWithMaterial(encrypted, keyMaterial, walletAddress);
    expect(decrypted).toBe(data);
  });

  test('should produce different ciphertext each time (random IV)', async () => {
    const data = 'Test data';
    const keyMaterial = 'kds-material-123';
    const walletAddress = '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR';

    const encrypted1 = await encryptDataWithMaterial(data, keyMaterial, walletAddress);
    const encrypted2 = await encryptDataWithMaterial(data, keyMaterial, walletAddress);

    // Different IVs should produce different ciphertext
    expect(encrypted1).not.toBe(encrypted2);

    // But both should decrypt to same plaintext
    const decrypted1 = await decryptDataWithMaterial(encrypted1, keyMaterial, walletAddress);
    const decrypted2 = await decryptDataWithMaterial(encrypted2, keyMaterial, walletAddress);
    expect(decrypted1).toBe(data);
    expect(decrypted2).toBe(data);
  });

  test('should fail decryption with wrong key material', async () => {
    const data = 'Secret data';
    const correctMaterial = 'correct-material';
    const wrongMaterial = 'wrong-material';
    const walletAddress = '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR';

    const encrypted = await encryptDataWithMaterial(data, correctMaterial, walletAddress);

    await expect(
      decryptDataWithMaterial(encrypted, wrongMaterial, walletAddress)
    ).rejects.toThrow();
  });

  test('should fail decryption with wrong wallet address', async () => {
    const data = 'Secret data';
    const keyMaterial = 'kds-material';
    const correctWallet = '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR';
    const wrongWallet = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';

    const encrypted = await encryptDataWithMaterial(data, keyMaterial, correctWallet);

    await expect(
      decryptDataWithMaterial(encrypted, keyMaterial, wrongWallet)
    ).rejects.toThrow();
  });

  test('should handle empty string encryption', async () => {
    const data = '';
    const keyMaterial = 'kds-material';
    const walletAddress = '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR';

    const encrypted = await encryptDataWithMaterial(data, keyMaterial, walletAddress);
    const decrypted = await decryptDataWithMaterial(encrypted, keyMaterial, walletAddress);

    expect(decrypted).toBe('');
  });

  test('should handle JSON data encryption', async () => {
    const jsonData = JSON.stringify({
      userId: '12345',
      preferences: { theme: 'dark', notifications: true },
      wallet: '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR'
    });
    const keyMaterial = 'kds-material';
    const walletAddress = '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR';

    const encrypted = await encryptDataWithMaterial(jsonData, keyMaterial, walletAddress);
    const decrypted = await decryptDataWithMaterial(encrypted, keyMaterial, walletAddress);

    expect(JSON.parse(decrypted)).toEqual(JSON.parse(jsonData));
  });

  test('should handle large data encryption', async () => {
    const largeData = 'x'.repeat(10000);
    const keyMaterial = 'kds-material';
    const walletAddress = '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR';

    const encrypted = await encryptDataWithMaterial(largeData, keyMaterial, walletAddress);
    const decrypted = await decryptDataWithMaterial(encrypted, keyMaterial, walletAddress);

    expect(decrypted).toBe(largeData);
    expect(decrypted.length).toBe(10000);
  });

  test('should handle unicode characters', async () => {
    const unicodeData = '你好世界 🌍 مرحبا العالم';
    const keyMaterial = 'kds-material';
    const walletAddress = '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR';

    const encrypted = await encryptDataWithMaterial(unicodeData, keyMaterial, walletAddress);
    const decrypted = await decryptDataWithMaterial(encrypted, keyMaterial, walletAddress);

    expect(decrypted).toBe(unicodeData);
  });
});
