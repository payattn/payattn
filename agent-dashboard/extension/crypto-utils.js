/**
 * Crypto utilities for extension
 * Simplified version for use in extension background script
 */

const CRYPTO_CONSTANTS = {
  PBKDF2_ITERATIONS: 100000,
  PBKDF2_HASH: 'SHA-256',
  AES_ALGORITHM: 'AES-GCM',
  AES_KEY_LENGTH: 256,
  IV_LENGTH: 12,
  KDS_ENDPOINT: 'http://localhost:3000/api/k', // Will be updated to payattn.org in production
};

/**
 * Fetch key material from KDS endpoint
 */
async function fetchKeyMaterial(keyHash) {
  const endpoint = `${CRYPTO_CONSTANTS.KDS_ENDPOINT}/${keyHash}`;
  
  try {
    const response = await fetch(endpoint);
    
    if (!response.ok) {
      throw new Error(`KDS returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.material) {
      throw new Error('Invalid KDS response');
    }
    
    return data.material;
  } catch (error) {
    console.error('[Extension] Failed to fetch key material:', error);
    throw new Error('Key derivation service unavailable');
  }
}

/**
 * Derive encryption key from key material and wallet address
 */
async function deriveKeyFromMaterial(keyMaterial, walletAddress) {
  const materialBytes = new TextEncoder().encode(keyMaterial);

  const importedMaterial = await crypto.subtle.importKey(
    'raw',
    materialBytes,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const saltBytes = new TextEncoder().encode(`payattn.org:${walletAddress}`);

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
      hash: CRYPTO_CONSTANTS.PBKDF2_HASH,
    },
    importedMaterial,
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
 * Decrypt data using key material
 */
async function decryptDataWithMaterial(encryptedData, keyMaterial, walletAddress) {
  const key = await deriveKeyFromMaterial(keyMaterial, walletAddress);

  // Decode base64
  const combined = base64ToArrayBuffer(encryptedData);

  // Extract IV and ciphertext
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

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Convert base64 to ArrayBuffer
 */
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
