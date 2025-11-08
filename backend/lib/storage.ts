/**
 * Encrypted Storage for User Profiles
 * 
 * Uses AES-256-GCM encryption with key derived from wallet public key
 * Data stored in localStorage, encrypted at rest
 * 
 * Security:
 * - Encryption key derived from wallet public key using PBKDF2 (100,000 iterations)
 * - Each encryption operation uses a fresh random IV
 * - AES-GCM provides authenticated encryption
 * - Data can only be decrypted with wallet public key
 * 
 * NOTE: Crypto functions imported from crypto-pure.ts
 * This allows Service Worker to use same crypto code with zero dependencies
 */

import { encryptData, decryptData } from './crypto-pure';

export interface UserProfile {
  demographics?: {
    age: number;
    gender?: string;
  };
  interests?: string[];
  location?: {
    country: string;
    state?: string;
  };
  financial?: {
    incomeRange?: string;
  };
  preferences?: {
    maxAdsPerHour: number;
    painThreshold: number;
  };
  encryptedAt?: string;
}

interface StorageData {
  publicKey: string;
  encryptedData: string;
  version: string;
}

const STORAGE_VERSION = 'v1';

/**
 * Generate wallet-specific storage key
 * Each wallet gets separate storage to prevent conflicts
 */
function getStorageKey(publicKey: string): string {
  return `payattn_profile_v1_${publicKey}`;
}

/**
 * Save encrypted profile for specific wallet
 */
export async function saveProfile(
  profile: UserProfile,
  publicKey: string
): Promise<void> {
  const profileWithTimestamp = {
    ...profile,
    encryptedAt: new Date().toISOString(),
  };

  const profileJson = JSON.stringify(profileWithTimestamp);
  const encrypted = await encryptData(profileJson, publicKey);

  const storageData: StorageData = {
    publicKey,
    encryptedData: encrypted,
    version: STORAGE_VERSION,
  };

  localStorage.setItem(getStorageKey(publicKey), JSON.stringify(storageData));
}

/**
 * Load encrypted profile for specific wallet
 */
export async function loadProfile(publicKey: string): Promise<UserProfile | null> {
  const stored = localStorage.getItem(getStorageKey(publicKey));
  if (!stored) {
    return null;
  }

  try {
    // Try new format first (wrapped in JSON)
    try {
      const storageData = JSON.parse(stored) as StorageData;

      // Version check
      if (storageData.version !== STORAGE_VERSION) {
        console.warn('Storage version mismatch, clearing data');
        localStorage.removeItem(getStorageKey(publicKey));
        return null;
      }

      // Decrypt
      const decrypted = await decryptData(storageData.encryptedData, publicKey);
      return JSON.parse(decrypted) as UserProfile;
    } catch (jsonError) {
      // If JSON parse fails, try old format (direct encrypted string)
      console.log('Attempting to load old format data...');
      const decrypted = await decryptData(stored, publicKey);
      const profile = JSON.parse(decrypted) as UserProfile;
      
      // Migrate to new format
      await saveProfile(profile, publicKey);
      console.log('Migrated old format to new format');
      
      return profile;
    }
  } catch (error) {
    console.error('Failed to decrypt profile:', error);
    return null;
  }
}

/**
 * Delete profile for specific wallet
 */
export function deleteProfile(publicKey: string): void {
  localStorage.removeItem(getStorageKey(publicKey));
}

/**
 * Delete ALL profiles (all wallets)
 */
export function deleteAllProfiles(): void {
  const keysToRemove: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('payattn_profile_v1_')) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
}

/**
 * Check if profile exists for specific wallet
 */
export function hasProfile(publicKey: string): boolean {
  return localStorage.getItem(getStorageKey(publicKey)) !== null;
}

/**
 * Get list of all wallets with stored profiles
 * Useful for dev/debugging
 */
export function getAllStoredWallets(): string[] {
  const wallets: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('payattn_profile_v1_')) {
      // Extract public key from storage key
      const publicKey = key.replace('payattn_profile_v1_', '');
      wallets.push(publicKey);
    }
  }
  
  return wallets;
}

/**
 * Service Worker execution log
 */
export interface SWExecutionLog {
  timestamp: string;
  profilesProcessed: number;
  success: boolean;
  error?: string;
}

/**
 * Service Worker Runtime Status
 * Tracks when SW last ran and when it will run next
 */
export interface SWRuntimeStatus {
  lastRunAt: string | null;
  nextRunAt: string | null;
  isActive: boolean;
}

/**
 * Save SW runtime status
 */
export function updateSWStatus(status: SWRuntimeStatus): void {
  localStorage.setItem('payattn_sw_status', JSON.stringify(status));
}

/**
 * Get SW runtime status
 */
export function getSWStatus(): SWRuntimeStatus {
  const stored = localStorage.getItem('payattn_sw_status');
  if (!stored) {
    return {
      lastRunAt: null,
      nextRunAt: null,
      isActive: false,
    };
  }
  
  try {
    return JSON.parse(stored) as SWRuntimeStatus;
  } catch {
    return {
      lastRunAt: null,
      nextRunAt: null,
      isActive: false,
    };
  }
}

/**
 * Save SW execution log entry
 */
export function logSWExecution(log: SWExecutionLog): void {
  const logs = getSWExecutionLogs();
  logs.push(log);
  
  // Keep only last 100 entries
  if (logs.length > 100) {
    logs.shift();
  }
  
  localStorage.setItem('payattn_sw_logs', JSON.stringify(logs));
}

/**
 * Get all SW execution logs
 */
export function getSWExecutionLogs(): SWExecutionLog[] {
  const stored = localStorage.getItem('payattn_sw_logs');
  if (!stored) {
    return [];
  }
  
  try {
    return JSON.parse(stored) as SWExecutionLog[];
  } catch {
    return [];
  }
}

/**
 * Clear SW execution logs
 */
export function clearSWExecutionLogs(): void {
  localStorage.removeItem('payattn_sw_logs');
}
