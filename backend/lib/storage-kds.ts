/**
 * KDS-based Encrypted Storage with IndexedDB
 * 
 * Uses Key Derivation Service (KDS) for secure key management
 * Encryption keys fetched from /api/k/[keyHash] endpoint
 * No encryption keys stored locally
 * 
 * Security:
 * - keyHash = SHA-256(wallet_signature) stored in IndexedDB
 * - Key material fetched from KDS endpoint (deterministic)
 * - Encryption key derived from: KDS_material + wallet_address
 * - AES-256-GCM authenticated encryption
 */

import { encryptDataWithMaterial, decryptDataWithMaterial } from './crypto-pure';
import { saveProfileIDB, getProfileIDB, deleteProfileIDB, getAllProfilesIDB } from './storage-idb';
import { AuthService } from './auth';

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

/**
 * Save encrypted profile with KDS
 * Requires active session with keyHash and keyMaterial
 * keyHash is NOT stored in IndexedDB (only in session for website, chrome.storage for extension)
 */
export async function saveProfile(
  profile: UserProfile,
  walletAddress: string
): Promise<void> {
  const session = AuthService.getSession();
  if (!session || !session.keyHash) {
    throw new Error('No active session with key hash');
  }

  // Get key material from session (cached) or fetch from KDS
  const keyMaterial = await AuthService.getKeyMaterial(session);

  // Add timestamp
  const profileWithTimestamp = {
    ...profile,
    encryptedAt: new Date().toISOString(),
  };

  // Encrypt using KDS key material
  const profileJson = JSON.stringify(profileWithTimestamp);
  const encrypted = await encryptDataWithMaterial(
    profileJson,
    keyMaterial,
    walletAddress
  );

  console.log('[storage-kds] Profile encrypted, saving to IndexedDB (no keyHash stored)');

  // Save to IndexedDB WITHOUT keyHash
  await saveProfileIDB(walletAddress, encrypted);
  
  console.log('[storage-kds] Profile saved successfully to IndexedDB');
  console.log('[storage-kds] Save complete');
}

/**
 * Load and decrypt profile with KDS
 * Requires active session with keyHash
 */
export async function loadProfile(walletAddress: string): Promise<UserProfile | null> {
  const session = AuthService.getSession();
  if (!session || !session.keyHash) {
    throw new Error('No active session with key hash');
  }

  // Get profile record from IndexedDB
  const record = await getProfileIDB(walletAddress);
  if (!record) {
    return null;
  }

  try {
    // Get key material from session (cached) or fetch from KDS
    const keyMaterial = await AuthService.getKeyMaterial(session);

    // Decrypt
    const decrypted = await decryptDataWithMaterial(
      record.encryptedData,
      keyMaterial,
      walletAddress
    );

    return JSON.parse(decrypted) as UserProfile;
  } catch (error) {
    console.error('Failed to decrypt profile:', error);
    return null;
  }
}

/**
 * Delete profile
 */
export async function deleteProfile(walletAddress: string): Promise<void> {
  await deleteProfileIDB(walletAddress);
}

/**
 * Check if profile exists
 */
export async function hasProfile(walletAddress: string): Promise<boolean> {
  const record = await getProfileIDB(walletAddress);
  return record !== null;
}

/**
 * Get all wallet addresses with profiles
 */
export async function getAllStoredWallets(): Promise<string[]> {
  const profiles = await getAllProfilesIDB();
  return profiles.map(p => p.walletAddress);
}

/**
 * Service Worker execution log
 */
export interface SWExecutionLog {
  timestamp: string;
  profilesProcessed: number;
  success: boolean;
  error?: string;
  runId?: number;
}

/**
 * Service Worker Runtime Status
 */
export interface SWRuntimeStatus {
  lastRunAt: string | null;
  nextRunAt: string | null;
  isActive: boolean;
}
