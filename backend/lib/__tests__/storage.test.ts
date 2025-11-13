import { describe, test, expect, beforeEach } from '@jest/globals';
import { 
  saveProfile, 
  loadProfile, 
  deleteProfile, 
  hasProfile,
  getAllStoredWallets,
  deleteAllProfiles,
  updateSWStatus,
  getSWStatus,
  logSWExecution,
  getSWExecutionLogs,
  clearSWExecutionLogs
} from '../storage';
import type { UserProfile } from '../storage';

describe('Profile Encryption and Storage', () => {
  
  const testProfile: UserProfile = {
    demographics: { age: 30, gender: 'prefer not to say' },
    interests: ['web3', 'technology', 'ai'],
    location: { country: 'US', state: 'CA' },
    preferences: { maxAdsPerHour: 5, painThreshold: 3 }
  };
  
  // Valid Solana public key format (base58)
  const testPublicKey = '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR';
  const testPublicKey2 = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  test('should save and load profile correctly', async () => {
    await saveProfile(testProfile, testPublicKey);
    const loaded = await loadProfile(testPublicKey);
    
    expect(loaded).not.toBeNull();
    expect(loaded?.demographics?.age).toBe(30);
    expect(loaded?.interests).toContain('web3');
    expect(loaded?.location?.country).toBe('US');
  });

  test('should encrypt profile data', async () => {
    await saveProfile(testProfile, testPublicKey);
    
    // Check that stored data is not plain JSON
    const stored = localStorage.getItem(`payattn_profile_v1_${testPublicKey}`);
    expect(stored).toBeDefined();
    
    // Stored data should be JSON with encrypted field
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveProperty('encryptedData');
    expect(parsed).toHaveProperty('publicKey');
    expect(parsed).toHaveProperty('version');
    
    // Encrypted data should not contain plaintext profile
    expect(parsed.encryptedData).not.toContain('web3');
    expect(parsed.encryptedData).not.toContain('30');
  });

  test('should use different ciphertext for same data', async () => {
    // Due to random IV, same data should encrypt differently
    await saveProfile(testProfile, testPublicKey);
    const stored1 = localStorage.getItem(`payattn_profile_v1_${testPublicKey}`);
    
    // Clear and save again
    localStorage.clear();
    await saveProfile(testProfile, testPublicKey);
    const stored2 = localStorage.getItem(`payattn_profile_v1_${testPublicKey}`);
    
    expect(stored1).toBeDefined();
    expect(stored2).toBeDefined();
    expect(stored1).not.toBe(stored2); // Different IV should produce different ciphertext
  });

  test('should fail with wrong decryption key', async () => {
    await saveProfile(testProfile, testPublicKey);
    
    // Try to load with different key
    const loaded = await loadProfile(testPublicKey2);
    
    // Should return null on decryption failure
    expect(loaded).toBeNull();
  });

  test('should handle empty profile', async () => {
    const emptyProfile: UserProfile = {};
    await saveProfile(emptyProfile, testPublicKey);
    const loaded = await loadProfile(testPublicKey);
    
    expect(loaded).not.toBeNull();
    expect(Object.keys(loaded!).length).toBeGreaterThanOrEqual(1); // At least encryptedAt
  });

  test('should add timestamp when saving', async () => {
    await saveProfile(testProfile, testPublicKey);
    const loaded = await loadProfile(testPublicKey);
    
    expect(loaded).toHaveProperty('encryptedAt');
    expect(typeof loaded?.encryptedAt).toBe('string');
    
    // Should be valid ISO date
    const date = new Date(loaded!.encryptedAt!);
    expect(date.toString()).not.toBe('Invalid Date');
  });

  test('should handle special characters in profile', async () => {
    const specialProfile: UserProfile = {
      demographics: { age: 25, gender: '👤 @user #special' },
      interests: ['test<script>', 'emoji😀', '"quotes"'],
    };
    
    await saveProfile(specialProfile, testPublicKey);
    const loaded = await loadProfile(testPublicKey);
    
    expect(loaded).not.toBeNull();
    expect(loaded?.demographics?.gender).toBe('👤 @user #special');
    expect(loaded?.interests).toContain('emoji😀');
  });
});

describe('Profile Management', () => {
  
  const testProfile: UserProfile = {
    demographics: { age: 30 },
    interests: ['test']
  };
  
  const testPublicKey = '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR';

  beforeEach(() => {
    localStorage.clear();
  });

  test('should check if profile exists', async () => {
    expect(hasProfile(testPublicKey)).toBe(false);
    
    await saveProfile(testProfile, testPublicKey);
    
    expect(hasProfile(testPublicKey)).toBe(true);
  });

  test('should delete profile', async () => {
    await saveProfile(testProfile, testPublicKey);
    expect(hasProfile(testPublicKey)).toBe(true);
    
    deleteProfile(testPublicKey);
    
    expect(hasProfile(testPublicKey)).toBe(false);
    const loaded = await loadProfile(testPublicKey);
    expect(loaded).toBeNull();
  });

  test('should handle deleting non-existent profile', () => {
    expect(() => {
      deleteProfile('NonExistentWallet');
    }).not.toThrow();
  });

  test('should track multiple wallet profiles', async () => {
    await saveProfile(testProfile, '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR');
    await saveProfile(testProfile, '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');
    await saveProfile(testProfile, 'So11111111111111111111111111111111111111112');
    
    const wallets = getAllStoredWallets();
    
    expect(wallets.length).toBe(3);
    expect(wallets).toContain('7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR');
    expect(wallets).toContain('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');
    expect(wallets).toContain('So11111111111111111111111111111111111111112');
  });

  test('should delete all profiles', async () => {
    await saveProfile(testProfile, '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR');
    await saveProfile(testProfile, '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');
    await saveProfile(testProfile, 'So11111111111111111111111111111111111111112');
    
    expect(getAllStoredWallets().length).toBe(3);
    
    deleteAllProfiles();
    
    expect(getAllStoredWallets().length).toBe(0);
    expect(hasProfile('7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR')).toBe(false);
    expect(hasProfile('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin')).toBe(false);
  });

  test('should isolate profiles by wallet', async () => {
    const profile1: UserProfile = { demographics: { age: 25 } };
    const profile2: UserProfile = { demographics: { age: 35 } };
    
    await saveProfile(profile1, '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR');
    await saveProfile(profile2, '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');
    
    const loaded1 = await loadProfile('7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR');
    const loaded2 = await loadProfile('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');
    
    expect(loaded1?.demographics?.age).toBe(25);
    expect(loaded2?.demographics?.age).toBe(35);
  });
});

describe('Service Worker Status Tracking', () => {
  
  beforeEach(() => {
    localStorage.clear();
  });

  test('should save and load SW status', () => {
    const status = {
      lastRunAt: new Date().toISOString(),
      nextRunAt: new Date(Date.now() + 3600000).toISOString(),
      isActive: true
    };
    
    updateSWStatus(status);
    const loaded = getSWStatus();
    
    expect(loaded.lastRunAt).toBe(status.lastRunAt);
    expect(loaded.nextRunAt).toBe(status.nextRunAt);
    expect(loaded.isActive).toBe(true);
  });

  test('should return default status when not set', () => {
    const status = getSWStatus();
    
    expect(status.lastRunAt).toBeNull();
    expect(status.nextRunAt).toBeNull();
    expect(status.isActive).toBe(false);
  });

  test('should handle corrupted SW status data', () => {
    localStorage.setItem('payattn_sw_status', 'invalid json');
    
    const status = getSWStatus();
    
    expect(status.lastRunAt).toBeNull();
    expect(status.isActive).toBe(false);
  });
});

describe('Service Worker Execution Logs', () => {
  
  beforeEach(() => {
    localStorage.clear();
  });

  test('should log SW execution', () => {
    const log = {
      timestamp: new Date().toISOString(),
      profilesProcessed: 5,
      success: true
    };
    
    logSWExecution(log);
    const logs = getSWExecutionLogs();
    
    expect(logs.length).toBe(1);
    expect(logs[0]).toMatchObject(log);
  });

  test('should log execution errors', () => {
    const log = {
      timestamp: new Date().toISOString(),
      profilesProcessed: 0,
      success: false,
      error: 'Test error message'
    };
    
    logSWExecution(log);
    const logs = getSWExecutionLogs();
    
    expect(logs[0]?.error).toBe('Test error message');
    expect(logs[0]?.success).toBe(false);
  });

  test('should maintain log history', () => {
    for (let i = 0; i < 10; i++) {
      logSWExecution({
        timestamp: new Date().toISOString(),
        profilesProcessed: i,
        success: true
      });
    }
    
    const logs = getSWExecutionLogs();
    expect(logs.length).toBe(10);
  });

  test('should limit logs to 100 entries', () => {
    for (let i = 0; i < 150; i++) {
      logSWExecution({
        timestamp: new Date().toISOString(),
        profilesProcessed: i,
        success: true
      });
    }
    
    const logs = getSWExecutionLogs();
    expect(logs.length).toBe(100);
    
    // Should keep most recent logs (removed oldest 50)
    expect(logs[0]?.profilesProcessed).toBe(50);
    expect(logs[logs.length - 1]?.profilesProcessed).toBe(149);
  });

  test('should clear all logs', () => {
    logSWExecution({
      timestamp: new Date().toISOString(),
      profilesProcessed: 1,
      success: true
    });
    
    expect(getSWExecutionLogs().length).toBe(1);
    
    clearSWExecutionLogs();
    
    expect(getSWExecutionLogs().length).toBe(0);
  });

  test('should return empty array when no logs exist', () => {
    const logs = getSWExecutionLogs();
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBe(0);
  });

  test('should handle corrupted log data', () => {
    localStorage.setItem('payattn_sw_logs', 'invalid json');
    
    const logs = getSWExecutionLogs();
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBe(0);
  });
});

describe('Profile Version Migration', () => {
  
  const testProfile: UserProfile = {
    demographics: { age: 30 }
  };
  
  beforeEach(() => {
    localStorage.clear();
  });

  test('should include version in stored data', async () => {
    await saveProfile(testProfile, '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR');
    
    const stored = localStorage.getItem('payattn_profile_v1_7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR');
    const parsed = JSON.parse(stored!);
    
    expect(parsed.version).toBe('v1');
  });

  test('should reject mismatched version', async () => {
    // Simulate old version data
    const oldData = {
      publicKey: '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR',
      encryptedData: 'fake_encrypted_data',
      version: 'v0' // Old version
    };
    
    localStorage.setItem('payattn_profile_v1_7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR', JSON.stringify(oldData));
    
    const loaded = await loadProfile('7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR');
    
    // Should return null and clear old data
    expect(loaded).toBeNull();
    expect(hasProfile('7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR')).toBe(false);
  });

  test('should migrate old format data (direct encrypted string)', async () => {
    const { encryptData } = await import('../crypto-pure');
    const testPublicKey = '7EqQdEUACv1u4UfuQ3KMC3ZpFqbQkXzJZpZ9M5aGNqgR';
    const testProfile: UserProfile = {
      demographics: { age: 25 }
    };
    
    // Store old format: direct encrypted string (no version wrapper)
    const oldFormatData = await encryptData(JSON.stringify(testProfile), testPublicKey);
    localStorage.setItem(`payattn_profile_v1_${testPublicKey}`, oldFormatData);
    
    // Try to load - should trigger migration
    const loaded = await loadProfile(testPublicKey);
    
    // Should successfully load and migrate
    expect(loaded).not.toBeNull();
    expect(loaded?.demographics?.age).toBe(25);
    
    // Verify new format is saved
    const stored = localStorage.getItem(`payattn_profile_v1_${testPublicKey}`);
    const parsed = JSON.parse(stored!);
    expect(parsed.version).toBe('v1');
  });
});
