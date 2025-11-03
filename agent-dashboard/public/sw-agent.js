/**
 * PayAttn Service Worker Agent
 * 
 * ZERO DEPENDENCIES - Pure JavaScript only
 * Runs autonomously every 30 minutes when browser permits
 * 
 * Security Model:
 * - Runs on same origin as main app (payattn.org)
 * - Can access localStorage (origin-isolated)
 * - Uses Web Crypto API only (no npm packages)
 * - Code should be ~200 lines (auditable, minimal attack surface)
 * 
 * Flow:
 * 1. Wake up on periodic sync (every 30 mins)
 * 2. Read encrypted profiles from localStorage
 * 3. Decrypt using wallet public key (via Web Crypto API)
 * 4. Fetch available ads from server
 * 5. Generate ZK proofs for ad targeting (privacy-preserving)
 * 6. Submit bids to advertisers
 * 7. Log activity for debugging
 */

// ============================================================================
// CRYPTO FUNCTIONS (Copied from crypto-pure.ts - ZERO external dependencies)
// ============================================================================

const CRYPTO_CONSTANTS = {
  PBKDF2_ITERATIONS: 100000,
  PBKDF2_HASH: 'SHA-256',
  AES_ALGORITHM: 'AES-GCM',
  AES_KEY_LENGTH: 256,
  IV_LENGTH: 12, // 12 bytes for GCM
};

/**
 * Derive encryption key from wallet public key
 */
async function deriveKeyFromPublicKey(publicKeyString) {
  const publicKeyBytes = base58ToBytes(publicKeyString);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    publicKeyBytes.buffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const saltBytes = new TextEncoder().encode('payattn.org');

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes.buffer,
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
 * Decrypt data using AES-256-GCM
 */
async function decryptData(encryptedData, publicKey) {
  const key = await deriveKeyFromPublicKey(publicKey);
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
 * Decode base58 string to bytes
 */
function base58ToBytes(base58) {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const BASE = 58;

  let num = BigInt(0);
  for (let i = 0; i < base58.length; i++) {
    const char = base58[i];
    const index = ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid base58 character: ${char}`);
    }
    num = num * BigInt(BASE) + BigInt(index);
  }

  const hex = num.toString(16);
  const paddedHex = hex.length % 2 === 0 ? hex : '0' + hex;
  const bytes = new Uint8Array(paddedHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(paddedHex.substr(i * 2, 2), 16);
  }

  let leadingZeros = 0;
  for (let i = 0; i < base58.length && base58[i] === '1'; i++) {
    leadingZeros++;
  }

  const result = new Uint8Array(leadingZeros + bytes.length);
  result.set(bytes, leadingZeros);

  return result;
}

// ============================================================================
// SERVICE WORKER LIFECYCLE
// ============================================================================

self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  self.skipWaiting(); // Activate immediately
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  event.waitUntil(clients.claim()); // Take control immediately
});

// ============================================================================
// PERIODIC BACKGROUND SYNC (Every 30 minutes)
// ============================================================================

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'payattn-agent') {
    console.log('[SW] Periodic sync triggered');
    event.waitUntil(runAgentCycle());
  }
});

// Handle manual sync messages from main app
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'MANUAL_SYNC') {
    console.log('[SW] Manual sync requested - starting agent cycle');
    const { profiles, logs } = event.data;
    
    event.waitUntil(
      runAgentCycle(profiles, logs).then((result) => {
        console.log('[SW] Manual sync completed');
        // Send response back to client with updated logs
        if (event.source) {
          event.source.postMessage({
            type: 'SYNC_COMPLETE',
            timestamp: new Date().toISOString(),
            logs: result.logs,
            status: result.status,
          });
        }
      }).catch(err => {
        console.error('[SW] Manual sync failed:', err);
        if (event.source) {
          event.source.postMessage({
            type: 'SYNC_ERROR',
            error: err.message,
          });
        }
      })
    );
  }
});

// ============================================================================
// AGENT PROCESSING LOGIC
// ============================================================================

/**
 * Main autonomous agent cycle
 * Runs every 30 minutes in the background
 * @param {Array} profiles - Array of {publicKey, profile} objects from main app
 * @param {Array} existingLogs - Existing execution logs from main app
 */
async function runAgentCycle(profiles = [], existingLogs = []) {
  const startTime = Date.now();
  const runId = Math.floor(Math.random() * 10000); // Random ID to track this run
  let profilesProcessed = 0;
  let error = null;
  let logs = [...existingLogs]; // Copy existing logs
  
  try {
    console.log(`[SW] Starting agent cycle #${runId}...`);
    console.log(`[SW] Cycle #${runId}: Received ${profiles.length} profiles from main app`);

    if (profiles.length === 0) {
      console.log(`[SW] Cycle #${runId}: No profiles to process`);
      const newLog = createLogEntry(runId, 0, true, 'No profiles to process');
      logs.push(newLog);
      
      // Keep only last 100 entries
      if (logs.length > 100) {
        logs.shift();
      }
      
      return {
        logs,
        status: updateStatus(),
      };
    }

    // Step 2: For each profile, process autonomously
    for (const profile of profiles) {
      await processProfile(profile);
      profilesProcessed++;
    }

    console.log(`[SW] Cycle #${runId}: Agent cycle completed successfully`);
    const newLog = createLogEntry(runId, profilesProcessed, true, `Processed ${profilesProcessed} profile(s)`);
    logs.push(newLog);
    
    // Keep only last 100 entries
    if (logs.length > 100) {
      logs.shift();
    }
    
    return {
      logs,
      status: updateStatus(),
    };
  } catch (err) {
    error = err.message || 'Unknown error';
    console.error(`[SW] Cycle #${runId}: Error in agent cycle:`, err);
    const newLog = createLogEntry(runId, profilesProcessed, false, error);
    logs.push(newLog);
    
    // Keep only last 100 entries
    if (logs.length > 100) {
      logs.shift();
    }
    
    return {
      logs,
      status: updateStatus(),
    };
  }
}

/**
 * Create a log entry
 */
function createLogEntry(runId, profilesProcessed, success, message) {
  return {
    timestamp: new Date().toISOString(),
    profilesProcessed,
    success,
    error: `Run #${runId} - ${message}`,
  };
}

/**
 * Create updated status object
 */
function updateStatus() {
  const now = new Date();
  const nextRun = new Date(now.getTime() + 30 * 60 * 1000); // 30 mins from now
  
  return {
    lastRunAt: now.toISOString(),
    nextRunAt: nextRun.toISOString(),
    isActive: true,
  };
}

/**
 * DEPRECATED: No longer used - SW cannot access localStorage
 * Keeping for reference only
 */
/*
function logExecution(profilesProcessed, success, error) {
  // REMOVED: Service Workers cannot access localStorage
  // Data now passed via postMessage
}

function getSWLogs() {
  // REMOVED: Service Workers cannot access localStorage
  // Data now passed via postMessage
}

async function loadAllProfiles() {
  // REMOVED: Service Workers cannot access localStorage
  // Data now passed via postMessage from main app
}
*/

/**
 * Process a single user profile autonomously
 */
async function processProfile(profileData) {
  const { publicKey, profile } = profileData;
  
  console.log(`[SW] Processing profile for wallet: ${publicKey.substring(0, 8)}...`);

  try {
    // Step 1: Fetch available ads from server
    // TODO: Implement API endpoint
    const ads = []; // await fetchAvailableAds();

    // Step 2: Generate ZK proofs for ad targeting
    // TODO: Integrate snarkjs or similar for privacy-preserving proofs
    // const proof = await generateZKProof(profile, ads);

    // Step 3: Submit bids to advertisers
    // TODO: Implement bid submission
    // await submitBids(publicKey, proof);

    console.log(`[SW] Profile processed: ${publicKey.substring(0, 8)}...`);
  } catch (error) {
    console.error(`[SW] Error processing profile ${publicKey.substring(0, 8)}...:`, error);
  }
}

/**
 * Fetch available ads from server
 * TODO: Implement this
 */
async function fetchAvailableAds() {
  // Placeholder - implement API call
  return [];
}

/**
 * Generate ZK proof for privacy-preserving ad targeting
 * TODO: Implement this (will require snarkjs or similar)
 */
async function generateZKProof(profile, ads) {
  // Placeholder - implement ZK proof generation
  return null;
}

/**
 * Submit bids to advertisers
 * TODO: Implement this
 */
async function submitBids(publicKey, proof) {
  // Placeholder - implement bid submission
  return;
}

console.log('[SW] PayAttn Service Worker loaded');
