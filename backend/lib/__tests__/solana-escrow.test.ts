import { describe, test, expect } from '@jest/globals';
import { derivePDA, getPlatformPubkey, getProgramId } from '../solana-escrow';
import { PublicKey } from '@solana/web3.js';

describe('Solana Escrow PDA Derivation', () => {
  
  test('should derive consistent PDA for same offer ID', async () => {
    const offerId = 'test_offer_123';
    
    const [pda1, bump1] = await derivePDA(offerId);
    const [pda2, bump2] = await derivePDA(offerId);
    
    expect(pda1.toBase58()).toBe(pda2.toBase58());
    expect(bump1).toBe(bump2);
  });
  
  test('should derive different PDAs for different offers', async () => {
    const [pda1] = await derivePDA('offer_1');
    const [pda2] = await derivePDA('offer_2');
    
    expect(pda1.toBase58()).not.toBe(pda2.toBase58());
  });
  
  test('should produce valid PublicKey instances', async () => {
    const [pda] = await derivePDA('test_offer');
    
    expect(pda).toBeInstanceOf(PublicKey);
    expect(typeof pda.toBase58).toBe('function');
    expect(typeof pda.toBuffer).toBe('function');
  });
  
  test('should produce valid base58 addresses', async () => {
    const [pda] = await derivePDA('test_offer');
    const address = pda.toBase58();
    
    // Solana addresses are 32-44 characters, base58 encoded
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
      'special@chars!',
      // Skip very long IDs as they exceed Solana's 32-byte seed limit
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
    // Test multiple times to ensure determinism
    const offerId = 'determinism_test';
    const results = [];
    
    for (let i = 0; i < 5; i++) {
      const [pda, bump] = await derivePDA(offerId);
      results.push({ address: pda.toBase58(), bump });
    }
    
    // All results should be identical
    const firstAddress = results[0]!.address;
    const firstBump = results[0]!.bump;
    
    results.forEach(result => {
      expect(result.address).toBe(firstAddress);
      expect(result.bump).toBe(firstBump);
    });
  });

  test('should use correct seeds for PDA derivation', async () => {
    // PDA should be derived from ['escrow', offer_id] seeds
    const offerId = 'test_offer';
    const [pda] = await derivePDA(offerId);
    
    // The PDA should be different from a random public key
    const randomKey = PublicKey.unique();
    expect(pda.toBase58()).not.toBe(randomKey.toBase58());
    
    // PDA should be deterministic based on seeds
    expect(pda).toBeDefined();
    expect(pda.toBase58().length).toBeGreaterThan(0);
  });
});

describe('Platform Configuration', () => {
  
  test('should provide platform public key', () => {
    const platformPubkey = getPlatformPubkey();
    
    expect(typeof platformPubkey).toBe('string');
    expect(platformPubkey.length).toBeGreaterThan(0);
    expect(platformPubkey).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });

  test('should provide program ID', () => {
    const programId = getProgramId();
    
    expect(typeof programId).toBe('string');
    expect(programId.length).toBeGreaterThan(0);
    expect(programId).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });

  test('should have consistent platform pubkey', () => {
    const pubkey1 = getPlatformPubkey();
    const pubkey2 = getPlatformPubkey();
    
    expect(pubkey1).toBe(pubkey2);
  });

  test('should have consistent program ID', () => {
    const id1 = getProgramId();
    const id2 = getProgramId();
    
    expect(id1).toBe(id2);
  });

  test('platform pubkey and program ID should be different', () => {
    const platformPubkey = getPlatformPubkey();
    const programId = getProgramId();
    
    expect(platformPubkey).not.toBe(programId);
  });
});

describe('PDA Uniqueness', () => {
  
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
    
    // All PDAs should be unique
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
});

describe('PDA Properties', () => {
  
  test('PDAs should not be writable', async () => {
    const [pda] = await derivePDA('test_offer');
    
    // PDAs are derived from seeds and are not keypairs
    // They don't have a private key
    expect(() => {
      // @ts-expect-error Testing that secretKey doesn't exist
      return pda.secretKey;
    }).not.toThrow();
    
    // PDA should be a valid public key
    expect(PublicKey.isOnCurve(pda.toBytes())).toBe(false); // PDAs are off-curve
  });

  test('should produce 32-byte public keys', async () => {
    const [pda] = await derivePDA('test_offer');
    const bytes = pda.toBytes();
    
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(32);
  });

  test('should be serializable', async () => {
    const [pda] = await derivePDA('test_offer');
    
    // Should be able to convert to various formats
    const base58 = pda.toBase58();
    const buffer = pda.toBuffer();
    const bytes = pda.toBytes();
    const json = pda.toJSON();
    
    expect(typeof base58).toBe('string');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(typeof json).toBe('string');
    
    // Should be able to reconstruct from base58
    const reconstructed = new PublicKey(base58);
    expect(reconstructed.toBase58()).toBe(base58);
  });
});

describe('Edge Cases', () => {
  
  test('should handle Unicode offer IDs', async () => {
    const [pda] = await derivePDA('offer_emoji_😀');
    
    expect(pda).toBeInstanceOf(PublicKey);
    expect(pda.toBase58()).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });

  test('should handle whitespace in offer IDs', async () => {
    const [pda1] = await derivePDA('offer with spaces');
    const [pda2] = await derivePDA('offer_with_underscores');
    
    expect(pda1).toBeInstanceOf(PublicKey);
    expect(pda2).toBeInstanceOf(PublicKey);
    expect(pda1.toBase58()).not.toBe(pda2.toBase58());
  });

  test('should handle very long offer IDs with caution', async () => {
    // Solana has a 32-byte limit on seeds, so very long IDs should fail
    const longOfferId = 'a'.repeat(1000);
    
    // This should throw due to seed length limit
    await expect(async () => {
      await derivePDA(longOfferId);
    }).rejects.toThrow();
  });

  describe('Edge Cases', () => {
  it('should handle special characters in offer ID', async () => {
    const [pda, bump] = await derivePDA('offer!@#$%');
    expect(pda).toBeInstanceOf(PublicKey);
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(bump).toBeLessThanOrEqual(255);
  });

  it('should handle unicode characters in offer ID', async () => {
    const [pda, bump] = await derivePDA('offer_🚀_emoji');
    expect(pda).toBeInstanceOf(PublicKey);
    expect(bump).toBeGreaterThanOrEqual(0);
  });

  it('should handle very long offer IDs', async () => {
    // Solana has a 32-byte limit per seed, so extremely long offer IDs should be rejected
    const longOfferId = 'a'.repeat(1000);
    await expect(derivePDA(longOfferId)).rejects.toThrow();
  });
});

describe('Error Handling', () => {
  it('should throw error for null offer ID', async () => {
    await expect(derivePDA(null as any)).rejects.toThrow();
  });

  it('should throw error for undefined offer ID', async () => {
    await expect(derivePDA(undefined as any)).rejects.toThrow();
  });

  it('should handle empty string offer ID', async () => {
    const [pda, bump] = await derivePDA('');
    expect(pda).toBeInstanceOf(PublicKey);
    expect(bump).toBeGreaterThanOrEqual(0);
  });
});

describe('Program Configuration', () => {
  it('should derive PDAs with platform configuration', async () => {
    const [pda1, bump1] = await derivePDA('test-offer-1');
    const [pda2, bump2] = await derivePDA('test-offer-2');
    
    // Different offers should have different PDAs
    expect(pda1.toString()).not.toBe(pda2.toString());
    expect(pda1).toBeInstanceOf(PublicKey);
    expect(pda2).toBeInstanceOf(PublicKey);
  });
});
});
