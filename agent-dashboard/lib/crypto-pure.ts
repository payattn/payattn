/**
 * Pure Cryptographic Functions
 * ZERO external dependencies - only Web Crypto API
 * 
 * These functions can be used by:
 * - Main application (storage.ts imports this)
 * - Service Worker (copies these as plain JS)
 * 
 * SECURITY: These are pure functions - no side effects, deterministic
 */

/**
 * Constants for encryption
 */
export const CRYPTO_CONSTANTS = {
  PBKDF2_ITERATIONS: 100000,
  PBKDF2_HASH: 'SHA-256',
  AES_ALGORITHM: 'AES-GCM',
  AES_KEY_LENGTH: 256,
  IV_LENGTH: 12, // 12 bytes for GCM
} as const;

/**
 * Derive encryption key from wallet public key
 * Uses PBKDF2 with 100,000 iterations for computational difficulty
 * 
 * @param publicKeyString - Base58 encoded public key from wallet
 * @returns CryptoKey suitable for AES-256-GCM encryption
 */
export async function deriveKeyFromPublicKey(
  publicKeyString: string
): Promise<CryptoKey> {
  // Decode base58 public key to bytes
  const publicKeyBytes = base58ToBytes(publicKeyString);

  // Import as raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    publicKeyBytes.buffer as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Static salt for deterministic key derivation
  const saltBytes = new TextEncoder().encode('payattn.org');

  // Derive 256-bit key using PBKDF2
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes.buffer as ArrayBuffer,
      iterations: CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
      hash: CRYPTO_CONSTANTS.PBKDF2_HASH,
    },
    keyMaterial,
    {
      name: CRYPTO_CONSTANTS.AES_ALGORITHM,
      length: CRYPTO_CONSTANTS.AES_KEY_LENGTH,
    },
    true,
    ['encrypt', 'decrypt']
  );

  return key;
}

/**
 * Encrypt data using AES-256-GCM
 * 
 * @param data - Plaintext string to encrypt
 * @param publicKey - Base58 public key string for key derivation
 * @returns Base64 encoded encrypted data (format: iv:ciphertext)
 */
export async function encryptData(
  data: string,
  publicKey: string
): Promise<string> {
  // Derive encryption key
  const key = await deriveKeyFromPublicKey(publicKey);

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(CRYPTO_CONSTANTS.IV_LENGTH));

  // Encode plaintext
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(data);

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    {
      name: CRYPTO_CONSTANTS.AES_ALGORITHM,
      iv: iv,
    },
    key,
    encodedData.buffer as ArrayBuffer
  );

  // Combine IV + ciphertext and encode as base64
  const encryptedBytes = new Uint8Array(encrypted);
  const combined = new Uint8Array(iv.length + encryptedBytes.length);
  combined.set(iv, 0);
  combined.set(encryptedBytes, iv.length);

  return arrayBufferToBase64(combined);
}

/**
 * Decrypt data using AES-256-GCM
 * 
 * @param encryptedData - Base64 encoded encrypted data (format: iv:ciphertext)
 * @param publicKey - Base58 public key string for key derivation
 * @returns Decrypted plaintext string
 */
export async function decryptData(
  encryptedData: string,
  publicKey: string
): Promise<string> {
  // Derive decryption key (same as encryption)
  const key = await deriveKeyFromPublicKey(publicKey);

  // Decode base64
  const combined = base64ToArrayBuffer(encryptedData);

  // Extract IV (first 12 bytes) and ciphertext (rest)
  const iv = combined.slice(0, CRYPTO_CONSTANTS.IV_LENGTH);
  const ciphertext = combined.slice(CRYPTO_CONSTANTS.IV_LENGTH);

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    {
      name: CRYPTO_CONSTANTS.AES_ALGORITHM,
      iv: iv,
    },
    key,
    ciphertext
  );

  // Decode to string
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: Uint8Array): string {
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
function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decode base58 string to bytes
 * (Simplified version for Solana public keys)
 */
function base58ToBytes(base58: string): Uint8Array {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const BASE = 58;

  let num = BigInt(0);
  for (let i = 0; i < base58.length; i++) {
    const char = base58[i];
    const index = ALPHABET.indexOf(char!);
    if (index === -1) {
      throw new Error(`Invalid base58 character: ${char}`);
    }
    num = num * BigInt(BASE) + BigInt(index);
  }

  // Convert BigInt to bytes
  const hex = num.toString(16);
  const paddedHex = hex.length % 2 === 0 ? hex : '0' + hex;
  const bytes = new Uint8Array(paddedHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(paddedHex.substr(i * 2, 2), 16);
  }

  // Handle leading zeros
  let leadingZeros = 0;
  for (let i = 0; i < base58.length && base58[i] === '1'; i++) {
    leadingZeros++;
  }

  const result = new Uint8Array(leadingZeros + bytes.length);
  result.set(bytes, leadingZeros);

  return result;
}

/**
 * Encode bytes to base58 string
 * (Simplified version for Solana public keys)
 */
export function bytesToBase58(bytes: Uint8Array): string {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const BASE = 58;

  // Convert bytes to BigInt
  let num = BigInt(0);
  for (let i = 0; i < bytes.length; i++) {
    num = num * BigInt(256) + BigInt(bytes[i]!);
  }

  // Convert to base58
  let result = '';
  while (num > 0) {
    const remainder = Number(num % BigInt(BASE));
    result = ALPHABET[remainder] + result;
    num = num / BigInt(BASE);
  }

  // Handle leading zeros
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    result = '1' + result;
  }

  return result;
}
