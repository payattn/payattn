/**
 * Encrypted Storage Library
 * Implements AES-256-GCM encryption for client-side data storage
 * Uses Web Crypto API with PBKDF2 key derivation
 * REQUIRES wallet connection for verification (uses public key for deterministic encryption)
 */

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
}

const STORAGE_KEY_PREFIX = 'payattn_profile_v1';
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_HASH = 'SHA-256';
const AES_ALGORITHM = 'AES-GCM';
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12; // 12 bytes for GCM

export class EncryptedStorage {
  /**
   * Generate storage key for a specific wallet
   * Each wallet gets its own storage key to prevent data conflicts
   */
  private static getStorageKey(publicKey: string): string {
    return `${STORAGE_KEY_PREFIX}_${publicKey}`;
  }

  /**
   * Derive encryption key from wallet public key
   * SECURITY: Uses public key (deterministic) but requires wallet connection to verify
   * This allows same data to be encrypted/decrypted consistently
   * @param publicKeyString - Base58 encoded public key from wallet
   */
  private static async deriveKeyFromPublicKey(publicKeyString: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(publicKeyString);
    
    // Import as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBytes as BufferSource,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    // Static salt derived from app identifier (deterministic for MVP)
    const saltBytes = encoder.encode('payattn_v1_salt_2025');

    // Derive AES-GCM key
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes as BufferSource,
        iterations: PBKDF2_ITERATIONS,
        hash: PBKDF2_HASH,
      },
      keyMaterial,
      {
        name: AES_ALGORITHM,
        length: AES_KEY_LENGTH,
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt data using AES-256-GCM
   * Returns base64-encoded IV + ciphertext
   * @param data - Plain text to encrypt
   * @param publicKey - Base58 public key string from connected wallet
   */
  static async encrypt(data: string, publicKey: string): Promise<string> {
    if (typeof window === 'undefined') {
      throw new Error('Encryption only available in browser context');
    }

    const key = await this.deriveKeyFromPublicKey(publicKey);
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    // Encrypt
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: AES_ALGORITHM,
        iv,
      },
      key,
      dataBytes as BufferSource
    );

    // Combine IV + ciphertext
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    // Encode to base64
    return this.arrayBufferToBase64(combined);
  }

  /**
   * Decrypt data using AES-256-GCM
   * Expects base64-encoded IV + ciphertext
   * @param encryptedData - Base64 encrypted string
   * @param publicKey - Base58 public key string from connected wallet
   */
  static async decrypt(encryptedData: string, publicKey: string): Promise<string> {
    if (typeof window === 'undefined') {
      throw new Error('Decryption only available in browser context');
    }

    const key = await this.deriveKeyFromPublicKey(publicKey);
    
    // Decode from base64
    const combined = this.base64ToArrayBuffer(encryptedData);

    // Extract IV and ciphertext
    const iv = combined.slice(0, IV_LENGTH);
    const ciphertext = combined.slice(IV_LENGTH);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: AES_ALGORITHM,
        iv,
      },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * Save user profile with encryption
   * Requires wallet to be connected (uses public key for encryption)
   * Each wallet's data is stored separately
   * @param profile - User profile data
   * @param publicKey - Base58 public key string from connected wallet
   */
  static async saveProfile(profile: UserProfile, publicKey: string): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Storage only available in browser context');
    }

    try {
      const jsonData = JSON.stringify(profile);
      const encrypted = await this.encrypt(jsonData, publicKey);
      const storageKey = this.getStorageKey(publicKey);
      localStorage.setItem(storageKey, encrypted);
    } catch (error) {
      console.error('Failed to save profile:', error);
      throw new Error('Failed to save encrypted profile');
    }
  }

  /**
   * Load user profile with decryption
   * Requires wallet to be connected (uses public key for decryption)
   * Loads data specific to the connected wallet
   * @param publicKey - Base58 public key string from connected wallet
   */
  static async loadProfile(publicKey: string): Promise<UserProfile | null> {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const storageKey = this.getStorageKey(publicKey);
      const encrypted = localStorage.getItem(storageKey);
      if (!encrypted) {
        return null;
      }

      const decrypted = await this.decrypt(encrypted, publicKey);
      const profile: UserProfile = JSON.parse(decrypted);
      return profile;
    } catch (error) {
      console.error('Failed to load profile:', error);
      // If decryption fails, data may be corrupted or wrong wallet
      return null;
    }
  }

  /**
   * Delete profile data for a specific wallet
   * @param publicKey - Base58 public key string of wallet whose data to delete
   */
  static async deleteProfile(publicKey: string): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    const storageKey = this.getStorageKey(publicKey);
    localStorage.removeItem(storageKey);
  }

  /**
   * Delete ALL wallet profiles from storage
   * WARNING: This removes data for ALL wallets, not just the current one
   */
  static async deleteAllProfiles(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    // Find all keys that match our profile prefix
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    // Remove all profile keys
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private static arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    const len = buffer.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(buffer[i]!);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private static base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Check if profile exists for a specific wallet
   * @param publicKey - Base58 public key string to check
   */
  static hasProfile(publicKey: string): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    const storageKey = this.getStorageKey(publicKey);
    return localStorage.getItem(storageKey) !== null;
  }

  /**
   * Helper: Verify wallet is connected and get public key
   * In production, you'd verify the signature to ensure user owns the wallet
   * @param wallet - Connected wallet adapter
   * @returns Public key string (Base58 encoded)
   */
  static getWalletPublicKey(wallet: any): string {
    if (!wallet || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    return wallet.publicKey.toBase58();
  }
}
