/**
 * Crypto functions for extension
 * Simplified version of crypto-pure.ts
 */

const CRYPTO_CONSTANTS = {
  PBKDF2_ITERATIONS: 100000,
  PBKDF2_HASH: 'SHA-256',
  AES_ALGORITHM: 'AES-GCM',
  AES_KEY_LENGTH: 256,
  IV_LENGTH: 12,
  KDS_ENDPOINT: 'http://localhost:3000/api/k',
};

/**
 * Fetch key material from KDS endpoint
 */
async function fetchKeyMaterial(keyHash, walletAddress, authToken) {
  const endpoint = `${CRYPTO_CONSTANTS.KDS_ENDPOINT}/${keyHash}`;
  
  try {
    const response = await fetch(endpoint, {
      headers: {
        'X-Wallet': walletAddress,
        'X-Auth-Token': authToken,
      },
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required');
      }
      if (response.status === 403) {
        throw new Error('Invalid authentication');
      }
      throw new Error(`KDS returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.keyMaterial) {
      throw new Error('Invalid KDS response');
    }
    
    return data.keyMaterial;
  } catch (error) {
    console.error('Failed to fetch key material:', error);
    throw error;
  }
}

/**
 * Derive encryption key from key material and wallet address
 */
async function deriveKeyFromMaterial(keyMaterial, walletAddress) {
  const materialBytes = new TextEncoder().encode(keyMaterial);

  const importedMaterial = await crypto.subtle.importKey(
    'raw',
    materialBytes.buffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const saltBytes = new TextEncoder().encode(`payattn.org:${walletAddress}`);

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes.buffer,
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
 * Decrypt data using AES-256-GCM with KDS key material
 */
async function decryptDataWithMaterial(encryptedData, keyMaterial, walletAddress) {
  const key = await deriveKeyFromMaterial(keyMaterial, walletAddress);
  const combined = base64ToArrayBuffer(encryptedData);
  const iv = combined.slice(0, CRYPTO_CONSTANTS.IV_LENGTH);
  const ciphertext = combined.slice(CRYPTO_CONSTANTS.IV_LENGTH);

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
 * Encrypt data using AES-256-GCM with KDS key material
 */
async function encryptDataWithMaterial(data, keyMaterial, walletAddress) {
  const key = await deriveKeyFromMaterial(keyMaterial, walletAddress);
  const iv = crypto.getRandomValues(new Uint8Array(CRYPTO_CONSTANTS.IV_LENGTH));
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(data);

  const encrypted = await crypto.subtle.encrypt(
    {
      name: CRYPTO_CONSTANTS.AES_ALGORITHM,
      iv: iv,
    },
    key,
    encodedData.buffer
  );

  const encryptedBytes = new Uint8Array(encrypted);
  const combined = new Uint8Array(iv.length + encryptedBytes.length);
  combined.set(iv, 0);
  combined.set(encryptedBytes, iv.length);

  return arrayBufferToBase64(combined);
}

/**
 * Convert base64 string to ArrayBuffer
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

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer) {
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}
