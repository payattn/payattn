import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { derivePDA, getPlatformPubkey, getProgramId } from '../solana-escrow';
import { PublicKey } from '@solana/web3.js';

const TEST_OFFER_ID = 'offer_test_12345';
const TEST_USER_PUBKEY = '2ugGxUsedQTj4B9MRYwKxJbinGeekweFModqLaFqbVTa';
const TEST_PUBLISHER_PUBKEY = '9JCNNab2seSGi4teoq7ofnP5RkeQtbBiHqiU4vKWPyEF';
const TEST_PLATFORM_PUBKEY = 'H7dfsmgVXo3bLfkWLCd8KmyUqCiUi8n5qSasMYKWNp5T';
const TEST_ADVERTISER_PUBKEY = 'AdvertiserPubkey11111111111111111111111';

describe('derivePDA', () => {
  test('should derive PDA with correct seeds', async () => {
    const [pda, bump] = await derivePDA(TEST_OFFER_ID);
    
    expect(pda).toBeInstanceOf(PublicKey);
    expect(typeof bump).toBe('number');
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(bump).toBeLessThanOrEqual(255);
  });

  test('should derive same PDA for same offerId', async () => {
    const [pda1] = await derivePDA(TEST_OFFER_ID);
    const [pda2] = await derivePDA(TEST_OFFER_ID);
    
    expect(pda1.toBase58()).toBe(pda2.toBase58());
  });

  test('should derive different PDAs for different offerIds', async () => {
    const [pda1] = await derivePDA('offer_1');
    const [pda2] = await derivePDA('offer_2');
    
    expect(pda1.toBase58()).not.toBe(pda2.toBase58());
  });

  test('should produce valid base58 addresses', async () => {
    const [pda] = await derivePDA('test_offer');
    const address = pda.toBase58();
    
    expect(address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(address.length).toBeGreaterThanOrEqual(32);
    expect(address.length).toBeLessThanOrEqual(44);
  });

  test('should have bump in valid range', async () => {
    const [, bump] = await derivePDA('test_offer');
    
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(bump).toBeLessThanOrEqual(255);
    expect(Number.isInteger(bump)).toBe(true);
  });

  test('should handle various offer ID formats', async () => {
    const offerIds = [
      'simple',
      'offer_with_underscores',
      'offer-with-hyphens',
      '12345',
      'UPPERCASE',
      'MixedCase',
    ];

    for (const offerId of offerIds) {
      const [pda, bump] = await derivePDA(offerId);
      
      expect(pda).toBeInstanceOf(PublicKey);
      expect(bump).toBeGreaterThanOrEqual(0);
      expect(bump).toBeLessThanOrEqual(255);
    }
  });

  test('should handle empty string offer ID', async () => {
    const [pda, bump] = await derivePDA('');
    
    expect(pda).toBeInstanceOf(PublicKey);
    expect(bump).toBeGreaterThanOrEqual(0);
  });

  test('should derive deterministic PDAs', async () => {
    const offerId = 'determinism_test';
    const results = [];
    
    for (let i = 0; i < 5; i++) {
      const [pda, bump] = await derivePDA(offerId);
      results.push({ address: pda.toBase58(), bump });
    }
    
    const firstAddress = results[0]!.address;
    const firstBump = results[0]!.bump;
    
    results.forEach(result => {
      expect(result.address).toBe(firstAddress);
      expect(result.bump).toBe(firstBump);
    });
  });

  test('should generate unique PDAs for similar offer IDs', async () => {
    const offerIds = [
      'offer_1',
      'offer_2',
      'offer_3',
      'offer_10',
      'offer_11'
    ];

    const pdas = new Set<string>();
    
    for (const offerId of offerIds) {
      const [pda] = await derivePDA(offerId);
      pdas.add(pda.toBase58());
    }
    
    expect(pdas.size).toBe(offerIds.length);
  });

  test('should generate different PDAs for numeric variations', async () => {
    const [pda1] = await derivePDA('1');
    const [pda2] = await derivePDA('01');
    const [pda3] = await derivePDA('001');
    
    expect(pda1.toBase58()).not.toBe(pda2.toBase58());
    expect(pda2.toBase58()).not.toBe(pda3.toBase58());
    expect(pda1.toBase58()).not.toBe(pda3.toBase58());
  });

  test('should be case-sensitive for offer IDs', async () => {
    const [pdaLower] = await derivePDA('offer');
    const [pdaUpper] = await derivePDA('OFFER');
    const [pdaMixed] = await derivePDA('Offer');
    
    expect(pdaLower.toBase58()).not.toBe(pdaUpper.toBase58());
    expect(pdaUpper.toBase58()).not.toBe(pdaMixed.toBase58());
    expect(pdaLower.toBase58()).not.toBe(pdaMixed.toBase58());
  });

  test('PDAs should be off-curve public keys', async () => {
    const [pda] = await derivePDA('test_offer');
    
    expect(PublicKey.isOnCurve(pda.toBytes())).toBe(false);
  });

  test('should produce 32-byte public keys', async () => {
    const [pda] = await derivePDA('test_offer');
    const bytes = pda.toBytes();
    
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(32);
  });

  test('should be serializable', async () => {
    const [pda] = await derivePDA('test_offer');
    
    const base58 = pda.toBase58();
    const buffer = pda.toBuffer();
    const bytes = pda.toBytes();
    const json = pda.toJSON();
    
    expect(typeof base58).toBe('string');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(typeof json).toBe('string');
    
    const reconstructed = new PublicKey(base58);
    expect(reconstructed.toBase58()).toBe(base58);
  });

  test('should handle whitespace in offer IDs', async () => {
    const [pda1] = await derivePDA('offer with spaces');
    const [pda2] = await derivePDA('offer_with_underscores');
    
    expect(pda1).toBeInstanceOf(PublicKey);
    expect(pda2).toBeInstanceOf(PublicKey);
    expect(pda1.toBase58()).not.toBe(pda2.toBase58());
  });

  test('should reject very long offer IDs exceeding seed limit', async () => {
    const longOfferId = 'a'.repeat(1000);
    
    await expect(derivePDA(longOfferId)).rejects.toThrow();
  });

  test('should throw error for null offer ID', async () => {
    await expect(derivePDA(null as any)).rejects.toThrow();
  });

  test('should throw error for undefined offer ID', async () => {
    await expect(derivePDA(undefined as any)).rejects.toThrow();
  });

  test('should handle special characters in offer ID', async () => {
    const [pda, bump] = await derivePDA('offer!@#$%');
    
    expect(pda).toBeInstanceOf(PublicKey);
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(bump).toBeLessThanOrEqual(255);
  });
});

describe('getPlatformPubkey', () => {
  test('should return valid platform pubkey string', () => {
    const platformPubkey = getPlatformPubkey();
    
    expect(typeof platformPubkey).toBe('string');
    expect(platformPubkey.length).toBeGreaterThan(0);
    expect(platformPubkey).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });

  test('should return consistent platform pubkey', () => {
    const pubkey1 = getPlatformPubkey();
    const pubkey2 = getPlatformPubkey();
    
    expect(pubkey1).toBe(pubkey2);
  });

  test('should be a valid Solana public key', () => {
    const platformPubkey = getPlatformPubkey();
    
    expect(() => new PublicKey(platformPubkey)).not.toThrow();
  });
});

describe('getProgramId', () => {
  test('should return valid program ID string', () => {
    const programId = getProgramId();
    
    expect(typeof programId).toBe('string');
    expect(programId.length).toBeGreaterThan(0);
    expect(programId).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });

  test('should return consistent program ID', () => {
    const id1 = getProgramId();
    const id2 = getProgramId();
    
    expect(id1).toBe(id2);
  });

  test('platform pubkey and program ID should be different', () => {
    const platformPubkey = getPlatformPubkey();
    const programId = getProgramId();
    
    expect(platformPubkey).not.toBe(programId);
  });

  test('should be a valid Solana public key', () => {
    const programId = getProgramId();
    
    expect(() => new PublicKey(programId)).not.toThrow();
  });
});

describe('PDA Integration', () => {
  test('should derive PDAs using correct program ID', async () => {
    const [pda1] = await derivePDA('test-offer-1');
    const [pda2] = await derivePDA('test-offer-2');
    
    expect(pda1.toString()).not.toBe(pda2.toString());
    expect(pda1).toBeInstanceOf(PublicKey);
    expect(pda2).toBeInstanceOf(PublicKey);
  });

  test('PDA derivation should be deterministic across calls', async () => {
    const offerId = 'integration_test_offer';
    const iterations = 10;
    const pdaAddresses = [];
    
    for (let i = 0; i < iterations; i++) {
      const [pda] = await derivePDA(offerId);
      pdaAddresses.push(pda.toBase58());
    }
    
    const uniqueAddresses = new Set(pdaAddresses);
    expect(uniqueAddresses.size).toBe(1);
  });

  test('should handle concurrent PDA derivations', async () => {
    const offerIds = Array.from({ length: 20 }, (_, i) => `offer_${i}`);
    
    const results = await Promise.all(
      offerIds.map(id => derivePDA(id))
    );
    
    const addresses = results.map(([pda]) => pda.toBase58());
    const uniqueAddresses = new Set(addresses);
    
    expect(uniqueAddresses.size).toBe(offerIds.length);
  });
});
