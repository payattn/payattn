/**
 * PayAttn Extension Background Script
 * 
 * Runs autonomously every 30 minutes using Chrome Alarms API
 * Uses IndexedDB (shared with website) for data access
 * Fetches encryption keys from KDS endpoint (no keys stored locally)
 * keyHash stored ONLY in chrome.storage.local (NOT in IndexedDB)
 */

// ============================================================================
// Import Libraries (Service Worker)
// ============================================================================

// Import PATCHED snarkjs for ZK proof generation
// This version forces singleThread=true in service worker context
// Original snarkjs tries to use Workers even with {singleThread: true} option
importScripts('lib/snarkjs-patched.js');

// Import LLM Service (Max's decision engine - supports Venice AI and local LM Studio)
importScripts('llm-service.js');

// Import Max Assessment Module (shared with ad-queue.js)
importScripts('lib/max-assessor.js');

console.log('[Extension] snarkjs loaded:', typeof self.snarkjs !== 'undefined' ? 'SUCCESS' : 'FAILED');
console.log('[Extension] LLMService loaded:', typeof self.LLMService !== 'undefined' ? 'SUCCESS' : 'FAILED');
console.log('[Extension] MaxAssessor loaded:', typeof self.MaxAssessor !== 'undefined' ? 'SUCCESS' : 'FAILED');

// ============================================================================
// Global State (Service Worker Scope)
// ============================================================================

// Store pending proof generation promises
// Service workers don't have window object, so we use module-level variable
let proofGenerationPromise = null;

// ============================================================================
// Chrome Storage Helpers
// ============================================================================

/**
 * Get keyHash from chrome.storage.local
 */
async function getKeyHash() {
  return new Promise((resolve) => {
    chrome.storage.local.get('payattn_keyHash', (result) => {
      resolve(result.payattn_keyHash || null);
    });
  });
}

/**
 * Get wallet address from chrome.storage.local
 */
async function getWalletAddress() {
  return new Promise((resolve) => {
    chrome.storage.local.get('payattn_walletAddress', (result) => {
      resolve(result.payattn_walletAddress || null);
    });
  });
}

// ============================================================================
// Crypto Utilities (inlined to avoid import issues)
// ============================================================================

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
    console.error('[Extension] Failed to fetch key material:', error);
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

// ============================================================================
// ZK-SNARK Proof Generation (Service Worker)
// ============================================================================

/**
 * BN128 field prime used in Groth16 proofs
 * This is the order of the scalar field for the BN128 elliptic curve
 */
const FIELD_PRIME = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

/**
 * Hash a string to a field element for ZK circuits
 * Used to convert strings (like country codes, interests) to numbers for circuits
 * 
 * IMPORTANT: Backend must use the SAME hashing algorithm for verification
 * Algorithm: SHA-256(string) mod FIELD_PRIME
 * 
 * @param {string} str - String to hash (e.g., "uk", "technology")
 * @returns {string} Field element as string (compatible with circom circuits)
 * 
 * @example
 * // Hash country code
 * const ukHash = hashToField("uk");
 * // Result: "15507270989273941579486529782961168076878965616246236476325961487637715879146"
 * 
 * // Hash interest
 * const techHash = hashToField("technology");
 * 
 * // Use in circuit
 * const proof = await generateProofInServiceWorker('set_membership', 
 *   { value: ukHash },
 *   { set: ["us", "uk", "ca"].map(hashToField) }
 * );
 */
async function hashToField(str) {
  // Encode string to UTF-8 bytes
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  
  // SHA-256 hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  
  // Convert to BigInt
  let num = BigInt(0);
  for (let i = 0; i < hashArray.length; i++) {
    num = (num << BigInt(8)) | BigInt(hashArray[i]);
  }
  
  // Modulo field prime to ensure it fits in the field
  const fieldElement = num % FIELD_PRIME;
  
  return fieldElement.toString();
}

/**
 * Hash multiple strings to field elements
 * Convenience function for hashing arrays
 * 
 * @param {string[]} strings - Array of strings to hash
 * @returns {Promise<string[]>} Array of field elements
 * 
 * @example
 * const countryHashes = await hashStringsToField(["us", "uk", "ca", "au"]);
 */
async function hashStringsToField(strings) {
  return Promise.all(strings.map(s => hashToField(s)));
}

/**
 * Circuit registry - maps circuit names to file paths
 */
const CIRCUITS_REGISTRY = {
  age_range: {
    name: 'age_range',
    wasmPath: 'circuits/age_range/age_range.wasm',
    zKeyPath: 'circuits/age_range/age_range_0000.zkey',
    description: 'Proves user age is within specified range'
  },
  range_check: {
    name: 'range_check',
    wasmPath: 'circuits/range_check/range_check.wasm',
    zKeyPath: 'circuits/range_check/range_check_0000.zkey',
    description: 'Proves a value is within a range (age, income, credit score, etc.)'
  },
  set_membership: {
    name: 'set_membership',
    wasmPath: 'circuits/set_membership/set_membership.wasm',
    zKeyPath: 'circuits/set_membership/set_membership_0000.zkey',
    description: 'Proves a hashed value exists in a set (countries, interests, etc.)'
  }
};

/**
 * Generate ZK-SNARK proof in service worker
 * All private data stays here - only proof is exported
 * 
 * @param {string} circuitName - Name of circuit from registry
 * @param {Object} privateInputs - Private inputs (never leave extension)
 * @param {Object} publicInputs - Public inputs (included in proof)
 * @param {Object} options - Generation options (e.g., {verbose: true})
 * @returns {Promise<Object>} Proof package ready for backend verification
 */
async function generateProofInServiceWorker(circuitName, privateInputs, publicInputs, options = {}) {
  const { verbose = false } = options;

  try {
    if (verbose) console.log(`[Service Worker ZK] Generating proof for: ${circuitName}`);

    // Get circuit metadata
    const circuit = CIRCUITS_REGISTRY[circuitName];
    if (!circuit) {
      throw new Error(`Circuit not found: ${circuitName}`);
    }

    // Combine inputs
    const allInputs = { ...privateInputs, ...publicInputs };

    if (verbose) console.log(`[Service Worker ZK] Loading WASM...`);

    // Load WASM file - convert to Uint8Array for snarkjs
    const wasmUrl = chrome.runtime.getURL(circuit.wasmPath);
    const wasmResponse = await fetch(wasmUrl);
    if (!wasmResponse.ok) {
      throw new Error(`Failed to fetch WASM: ${wasmResponse.statusText}`);
    }
    const wasmArrayBuffer = await wasmResponse.arrayBuffer();
    const wasmCode = new Uint8Array(wasmArrayBuffer);
    
    if (verbose) console.log(`[Service Worker ZK] Loading proving key...`);
    
    // Load proving key as Uint8Array
    const zKeyUrl = chrome.runtime.getURL(circuit.zKeyPath);
    const zKeyResponse = await fetch(zKeyUrl);
    if (!zKeyResponse.ok) {
      throw new Error(`Failed to fetch proving key: ${zKeyResponse.statusText}`);
    }
    const zKeyArrayBuffer = await zKeyResponse.arrayBuffer();
    const zKeyCode = new Uint8Array(zKeyArrayBuffer);

    if (verbose) console.log(`[Service Worker ZK] Generating proof using fullProve()...`);

    // Create a simple logger for snarkjs
    const logger = {
      debug: (msg) => { if (verbose) console.log(`[snarkjs] ${msg}`); },
      info: (msg) => { if (verbose) console.log(`[snarkjs] ${msg}`); },
      warn: (msg) => { if (verbose) console.warn(`[snarkjs] ${msg}`); },
      error: (msg) => { console.error(`[snarkjs] ${msg}`); }
    };

    // Use groth16.fullProve() which does witness calculation + proof generation
    // Pass Uint8Arrays directly for both WASM and zkey
    // CRITICAL: Use {singleThread: true} for service worker compatibility
    const { proof, publicSignals } = await self.snarkjs.groth16.fullProve(
      allInputs,
      wasmCode,
      zKeyCode,
      logger,
      { singleThread: true }
    );

    if (verbose) {
      console.log(`[Service Worker ZK] Proof generated successfully`);
      console.log(`[Service Worker ZK] Public signals:`, publicSignals);
    }

    // Return proof package (ready to send to backend)
    // Note: privateInputs are NOT included
    return {
      circuitName,
      proof: {
        pi_a: proof.pi_a,
        pi_b: proof.pi_b,
        pi_c: proof.pi_c,
        protocol: proof.protocol,
        curve: proof.curve
      },
      publicSignals,
      timestamp: Date.now(),
      version: '1.0'
    };

  } catch (error) {
    console.error(`[Service Worker ZK] Proof generation failed:`, error);
    throw new Error(`Failed to generate proof: ${error.message}`);
  }
}

// ============================================================================
// Extension Logic
// ============================================================================

const DB_NAME = 'payattn_db';
const DB_VERSION = 1;
const PROFILES_STORE = 'profiles';
const LOGS_STORE = 'logs';
const STATUS_STORE = 'status';

// Cache key materials (valid for session duration)
const keyMaterialCache = new Map(); // keyHash -> {material, expiresAt}
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const API_BASE = 'http://localhost:3000'; // Backend API base URL

console.log('[Extension] PayAttn Agent loaded');

// Set up polling alarm to check for scheduled runs
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Extension] Setting up scheduled run system');
  
  // Create a single polling alarm that checks every 60 seconds
  chrome.alarms.create('payattn-poll', {
    periodInMinutes: 1, // Check every minute
  });
  
  // Initialize next scheduled run (30 mins from now)
  const now = Date.now();
  const nextRun = now + (30 * 60 * 1000);
  chrome.storage.local.set({
    payattn_next_scheduled_run: nextRun
  }, () => {
    console.log(`[Extension] Next run scheduled for: ${new Date(nextRun).toLocaleString()}`);
  });
  
  console.log('[Extension] Extension installed and polling alarm set!');
  
  // Run initial ad sync
  syncNewAds();
});

// Listen for alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'payattn-poll') {
    // Check if it's time to run
    chrome.storage.local.get(['payattn_next_scheduled_run'], (result) => {
      const nextScheduledRun = result.payattn_next_scheduled_run;
      const now = Date.now();
      
      if (nextScheduledRun && now >= nextScheduledRun) {
        console.log('[Extension] Scheduled time reached - running ad sync');
        
        // Run ad sync (it will schedule next run in its finally block)
        syncNewAds().catch(err => {
          console.error('[Extension] Ad sync failed:', err);
        });
      }
    });
  }
});

// Listen for manual trigger from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Extension] Message received:', message);
  
  // Handle proof generation request
  if (message.type === 'GENERATE_PROOF') {
    console.log('[Service Worker] Generating proof:', message.circuitName);
    
    generateProofInServiceWorker(
      message.circuitName,
      message.privateInputs,
      message.publicInputs,
      message.options || {}
    ).then((proofPackage) => {
      console.log('[Service Worker] Proof generated successfully');
      sendResponse({ 
        success: true, 
        proof: proofPackage 
      });
    }).catch((error) => {
      console.error('[Service Worker] Proof generation failed:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    });
    
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'SAVE_AUTH') {
    // Save authentication from website
    console.log('[Extension] Saving auth from website:', {
      keyHashPrefix: message.keyHash?.slice(0, 16) + '...',
      walletAddress: message.walletAddress?.slice(0, 8) + '...',
      hasAuthToken: !!message.authToken
    });
    
    // Check if this is a disconnect (empty values)
    if (!message.keyHash || !message.walletAddress) {
      console.log('[Extension] Disconnect detected - clearing auth');
      chrome.storage.local.remove(['payattn_keyHash', 'payattn_walletAddress', 'payattn_authToken'], () => {
        if (chrome.runtime.lastError) {
          console.error('[Extension] Failed to clear auth:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log('[Extension] Auth cleared successfully!');
          sendResponse({ success: true });
        }
      });
      return true;
    }
    
    chrome.storage.local.set({
      payattn_keyHash: message.keyHash,
      payattn_walletAddress: message.walletAddress,
      payattn_authToken: message.authToken
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('[Extension] Failed to save auth:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log('[Extension] Auth saved successfully!');
        sendResponse({ success: true });
      }
    });
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'SAVE_PROFILE') {
    // Save profile from website
    console.log('[Extension] Saving profile from website:', {
      walletAddress: message.walletAddress?.slice(0, 8) + '...',
      dataSize: message.encryptedData?.length
    });
    
    const profileData = {
      walletAddress: message.walletAddress,
      encryptedData: message.encryptedData,
      version: message.version || 1,
      timestamp: message.timestamp || Date.now()
    };
    
    chrome.storage.local.set({
      [`payattn_profile_${message.walletAddress}`]: profileData
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('[Extension] Failed to save profile:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log('[Extension] Profile saved successfully!');
        sendResponse({ success: true });
      }
    });
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'MANUAL_SYNC') {
    console.log('[Extension] Manual sync requested');
    runAgentCycle().then((result) => {
      sendResponse({ success: true, result });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'CHECK_NEW_ADS') {
    console.log('[Extension] Check new ads requested (manual trigger)');
    syncNewAds().then((result) => {
      // syncNewAds will schedule next run in its finally block
      
      // result contains newAdsCount from syncNewAds
      sendResponse({ 
        success: true, 
        newAdsCount: result?.newAdsCount || 0 
      });
    }).catch((error) => {
      console.error('[Extension] Ad sync failed:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    });
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'GENERATE_PROOF_RESPONSE') {
    // Proof generation result from helper page
    console.log('[Extension] Received proof generation response:', 
      message.success ? 'Success' : 'Failed');
    
    // Store the response for the waiting request
    if (proofGenerationPromise) {
      if (message.success) {
        proofGenerationPromise.resolve(message.proof);
      } else {
        proofGenerationPromise.reject(new Error(message.error));
      }
      proofGenerationPromise = null;
    }
    
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'GET_STATUS') {
    getStatusFromIDB().then(data => {
      sendResponse(data);
    });
    return true;
  }
});

/**
 * IndexedDB Helper Functions
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(PROFILES_STORE)) {
        db.createObjectStore(PROFILES_STORE);
      }
      if (!db.objectStoreNames.contains(LOGS_STORE)) {
        db.createObjectStore(LOGS_STORE);
      }
      if (!db.objectStoreNames.contains(STATUS_STORE)) {
        db.createObjectStore(STATUS_STORE);
      }
    };
  });
}

async function getStatusFromIDB() {
  const db = await openDB();
  
  const logsPromise = new Promise((resolve) => {
    const transaction = db.transaction([LOGS_STORE], 'readonly');
    const request = transaction.objectStore(LOGS_STORE).get('sw_logs');
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
  
  const statusPromise = new Promise((resolve) => {
    const transaction = db.transaction([STATUS_STORE], 'readonly');
    const request = transaction.objectStore(STATUS_STORE).get('sw_status');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
  
  const [logs, status] = await Promise.all([logsPromise, statusPromise]);
  return { logs, status };
}

// ============================================================================
// ZK Proof Generation (via helper page)
// ============================================================================

/**
 * Generate ZK proof by delegating to a helper page
 * Service workers can't load snarkjs directly, so we use messaging
 */
async function generateProofViaHelper(circuitName, privateInputs, publicInputs) {
  return new Promise((resolve, reject) => {
    console.log('[Extension] Requesting proof generation for:', circuitName);
    
    // Store promise resolvers for the response handler
    // Use module-level variable (service workers don't have window object)
    proofGenerationPromise = { resolve, reject };
    
    // Send message to any open helper pages
    // The helper page will receive this and generate the proof
    chrome.runtime.sendMessage({
      type: 'GENERATE_PROOF_REQUEST',
      circuitName,
      privateInputs,
      publicInputs
    }).catch(error => {
      // If no helper page is open, we need to create one
      console.log('[Extension] No helper page found, would need to create offscreen document');
      console.log('[Extension] For now, proof generation requires test page to be open');
      reject(new Error('Proof helper page not available. Open age-proof-test.html first.'));
      proofGenerationPromise = null;
    });
    
    // Timeout after 60 seconds
    setTimeout(() => {
      if (proofGenerationPromise) {
        proofGenerationPromise = null;
        reject(new Error('Proof generation timed out after 60 seconds'));
      }
    }, 60000);
  });
}

// ============================================================================
// Ad Sync Functions (NEW)
// ============================================================================

/**
 * Sync new ads from backend
 * Called every hour or on-demand
 */
async function syncNewAds() {
  console.log('[AdSync] Starting ad sync...');

  try {
    const walletAddress = await getWalletAddress();
    if (!walletAddress) {
      console.log('[AdSync] No wallet found, skipping sync');
      return;
    }

    // Get last_checked timestamp from storage
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['payattn_last_ad_sync'], (data) => {
        resolve(data);
      });
    });

    const lastChecked = result.payattn_last_ad_sync || new Date(0).toISOString();
    console.log(`[AdSync] Last checked: ${lastChecked}`);

    // UPDATE TIMESTAMP AT START with 60-second buffer to avoid missing ads
    // This timestamp will be used for NEXT sync to query for ads created since now
    // The 60-second buffer ensures we don't miss ads if Max takes a couple mins to run
    const syncStartTime = new Date(Date.now() - 60000).toISOString(); // 60 seconds ago
    
    // Fetch new ads from backend
    const response = await fetch(`${API_BASE}/api/user/adstream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': walletAddress
      },
      body: JSON.stringify({
        last_checked: lastChecked
      })
    });

    if (!response.ok) {
      throw new Error(`Ad sync failed: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[AdSync] Received ${data.count} new ads`);

    // Always create a Max session to record the check, even if 0 ads
    const maxSession = {
      id: `max_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      triggerType: 'automated', // Background process
      ads: []
    };

    if (data.ads && data.ads.length > 0) {
      // Store ads in ad_queue for Max to evaluate
      await new Promise((resolve) => {
        chrome.storage.local.get(['payattn_ad_queue'], (result) => {
          const existingQueue = result.payattn_ad_queue || [];
          const newQueue = [...existingQueue, ...data.ads];
          
          chrome.storage.local.set({
            payattn_ad_queue: newQueue,
            payattn_last_ad_sync: syncStartTime  // Update to sync start time (with buffer)
          }, () => {
            console.log(`[AdSync] Stored ${newQueue.length} total ads in queue`);
            console.log(`[AdSync] Updated last_ad_sync to: ${syncStartTime}`);
            resolve();
          });
        });
      });

      // Trigger Max evaluation (this will update the session with results)
      console.log('[AdSync] Triggering Max evaluation...');
      await evaluateAdQueue();
      
      // Return count for UI feedback
      return { newAdsCount: data.count };
    } else {
      // No new ads - save empty session to show background check happened
      console.log('[AdSync] No new ads - recording empty session');
      await saveMaxSession(maxSession);
      
      // Update timestamp even if no new ads
      await new Promise((resolve) => {
        chrome.storage.local.set({
          payattn_last_ad_sync: syncStartTime  // Update to sync start time (with buffer)
        }, () => {
          console.log(`[AdSync] Updated last_ad_sync to: ${syncStartTime}`);
          resolve();
        });
      });
      
      // Return zero count
      return { newAdsCount: 0 };
    }

  } catch (err) {
    console.error('[AdSync] Sync failed:', err);
    throw err; // Propagate error for UI feedback
  } finally {
    // Always schedule next run after completion (success or failure)
    // This ensures consistency whether triggered manually or automatically
    const nextRun = Date.now() + (30 * 60 * 1000);
    await chrome.storage.local.set({
      payattn_next_scheduled_run: nextRun
    });
    console.log(`[AdSync] Next run scheduled for: ${new Date(nextRun).toLocaleString()}`);
  }
}

/**
 * Max evaluates ads in queue
 * Uses modular MaxAssessor for consistent assessment logic across manual and automated triggers
 */
async function evaluateAdQueue() {
  console.log('[Max] Evaluating ad queue...');

  try {
    const walletAddress = await getWalletAddress();
    if (!walletAddress) {
      console.log('[Max] No wallet found, skipping evaluation');
      return;
    }

    // Get user profile and ad queue
    const result = await new Promise((resolve) => {
      chrome.storage.local.get([
        `payattn_profile_${walletAddress}`,
        'payattn_ad_queue',
        'payattn_keyHash',
        'payattn_authToken'
      ], (data) => {
        resolve(data);
      });
    });

    const encryptedProfile = result[`payattn_profile_${walletAddress}`];
    const adQueue = result.payattn_ad_queue || [];
    const keyHash = result.payattn_keyHash;
    const authToken = result.payattn_authToken;

    if (!encryptedProfile) {
      console.log('[Max] No profile found, cannot evaluate ads');
      return;
    }

    if (adQueue.length === 0) {
      console.log('[Max] No ads in queue to evaluate');
      return;
    }

    // Decrypt profile
    console.log('[Max] Decrypting user profile...');
    const keyMaterial = await fetchKeyMaterial(keyHash, walletAddress, authToken);
    const encryptedDataString = encryptedProfile.encryptedData;
    
    if (!encryptedDataString) {
      throw new Error('No encryptedData property found in profile');
    }
    
    const decryptedJson = await decryptDataWithMaterial(
      encryptedDataString,
      keyMaterial,
      walletAddress
    );
    
    const userProfile = JSON.parse(decryptedJson);
    console.log(`[Max] Profile decrypted. Evaluating ${adQueue.length} ads...`);

    // Use modular MaxAssessor for consistent assessment logic
    const session = await self.MaxAssessor.assessAds(adQueue, userProfile, {
      veniceModel: 'qwen3-next-80b',
      temperature: 0.7,
      autoSubmit: true // Automatically submit offers to backend
    });

    // Update session metadata for background context
    session.triggerType = 'automated';
    
    // Count offers
    const offersCreated = session.ads.filter(a => a.assessment.decision === 'MAKING OFFER').length;

    // Save Max session
    await saveMaxSession(session);

    // Clear queue (all ads have been evaluated)
    await new Promise((resolve) => {
      chrome.storage.local.set({
        payattn_ad_queue: []
      }, resolve);
    });

    console.log(`[Max] Evaluation complete: ${offersCreated} offers created from ${adQueue.length} ads`);

  } catch (err) {
    console.error('[Max] Evaluation failed:', err);
  }
}

/**
 * Evaluate single ad against user profile
 */
async function evaluateSingleAd(ad, profileData, walletAddress) {
  const targeting = ad.targeting;

  // Check age
  if (targeting.age) {
    const userAge = profileData.age;
    if (userAge < targeting.age.min || userAge > targeting.age.max) {
      return { approved: false, reason: `Age ${userAge} not in range ${targeting.age.min}-${targeting.age.max}` };
    }
  }

  // Check interests (at least one required interest must match)
  if (targeting.interests && targeting.interests.length > 0) {
    const requiredInterests = targeting.interests
      .filter(i => i.weight === 'required')
      .map(i => i.category);
    
    if (requiredInterests.length > 0) {
      const userInterests = profileData.interests || [];
      const hasMatch = requiredInterests.some(req => 
        userInterests.some(ui => ui.category === req)
      );
      
      if (!hasMatch) {
        return { approved: false, reason: `No matching required interests` };
      }
    }
  }

  // Check income
  if (targeting.income && targeting.income.min) {
    const userIncome = profileData.income || 0;
    if (userIncome < targeting.income.min) {
      return { approved: false, reason: `Income ${userIncome} below minimum ${targeting.income.min}` };
    }
  }

  // Check location
  if (targeting.location && targeting.location.countries) {
    const userCountry = profileData.location?.country;
    if (!targeting.location.countries.includes(userCountry)) {
      return { approved: false, reason: `Country ${userCountry} not in target list` };
    }
  }

  // All checks passed - generate ZK-proofs and create offer
  console.log(`[Max] Ad ${ad.ad_creative_id} passed all checks, creating offer with ZK-proofs...`);

  // TODO: Generate actual ZK-proofs
  // For now, we'll create offers without proofs (can add proof generation later)
  const zkProofs = {
    age: { circuitName: 'age_range', proof: 'placeholder' },
    interests: { circuitName: 'set_membership', proof: 'placeholder' },
    income: { circuitName: 'range_check', proof: 'placeholder' },
    location: { circuitName: 'set_membership', proof: 'placeholder' }
  };

  // Create offer via backend API
  try {
    const response = await fetch(`${API_BASE}/api/user/offer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': walletAddress
      },
      body: JSON.stringify({
        ad_creative_id: ad.id,
        amount_lamports: ad.budget_per_impression_lamports,
        zk_proofs: zkProofs
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log(`[OK][OK][OK] [Max] Created offer: ${data.offer_id}`);
      return { approved: true, offerId: data.offer_id };
    } else {
      return { approved: false, reason: data.error };
    }
  } catch (err) {
    console.error('[Max] Failed to create offer:', err);
    return { approved: false, reason: err.message };
  }
}

/**
 * Main agent cycle
 */
async function runAgentCycle() {
  const runId = Math.floor(Math.random() * 10000);
  console.log(`[Extension] Starting agent cycle #${runId}`);
  
  try {
    // Get wallet address to find the profile
    const walletAddress = await getWalletAddress();
    
    if (!walletAddress) {
      throw new Error('No wallet address found - extension not properly authenticated');
    }
    
    console.log(`[Extension] Looking for profile: ${walletAddress.slice(0, 8)}...`);
    
    // Get profile from chrome.storage (shared with website)
    const profileData = await new Promise((resolve) => {
      chrome.storage.local.get([`payattn_profile_${walletAddress}`], (result) => {
        resolve(result[`payattn_profile_${walletAddress}`] || null);
      });
    });
    
    if (!profileData) {
      console.log('[Extension] No profile found in chrome.storage');
      const log = {
        timestamp: new Date().toISOString(),
        profilesProcessed: 0,
        success: true,
        error: `Run #${runId} - No profile data found`,
      };
      await saveLog(log);
      await updateStatus();
      return { profilesProcessed: 0, success: true };
    }
    
    console.log('[Extension] Found profile data:', {
      walletAddress: profileData.walletAddress?.slice(0, 8) + '...',
      dataLength: profileData.encryptedData?.length,
      version: profileData.version,
      timestamp: profileData.timestamp
    });
    
    // Process the profile
    let profilesProcessed = 0;
    try {
      await processProfile(profileData);
      profilesProcessed = 1;
    } catch (error) {
      console.error(`[Extension] Failed to process profile:`, error);
    }
    
    // Log execution
    const log = {
      timestamp: new Date().toISOString(),
      profilesProcessed,
      success: true,
      error: `Run #${runId} - Processed ${profilesProcessed} profile(s)`,
    };
    
    await saveLog(log);
    await updateStatus();
    
    console.log(`[Extension] Cycle #${runId} completed`);
    return { profilesProcessed, success: true };
    
  } catch (error) {
    console.error(`[Extension] Cycle failed:`, error);
    
    const log = {
      timestamp: new Date().toISOString(),
      profilesProcessed: 0,
      success: false,
      error: error.message,
    };
    
    await saveLog(log);
    throw error;
  }
}

/**
 * Get key material (with caching)
 */
async function getKeyMaterial(keyHash, walletAddress, authToken) {
  // Check cache
  const cached = keyMaterialCache.get(keyHash);
  if (cached && Date.now() < cached.expiresAt) {
    console.log('[Extension] Using cached key material');
    return cached.material;
  }
  
  // Fetch from KDS
  console.log('[Extension] Fetching key material from KDS');
  const material = await fetchKeyMaterial(keyHash, walletAddress, authToken);
  
  // Cache it
  keyMaterialCache.set(keyHash, {
    material,
    expiresAt: Date.now() + CACHE_TTL,
  });
  
  return material;
}

/**
 * Process a single profile
 */
async function processProfile(profileRecord) {
  const shortAddr = profileRecord.walletAddress.substring(0, 8) + '...';
  console.log(`[Extension] Processing profile: ${shortAddr}`);
  
  try {
    // Get keyHash and authToken from chrome.storage
    const result = await chrome.storage.local.get(['payattn_keyHash', 'payattn_authToken', 'payattn_walletAddress']);
    const keyHash = result.payattn_keyHash;
    const authToken = result.payattn_authToken;
    const walletAddress = result.payattn_walletAddress;
    
    if (!keyHash) {
      throw new Error('No keyHash found in chrome.storage - extension not authenticated');
    }
    
    if (!authToken) {
      throw new Error('No authToken found in chrome.storage - authentication required');
    }
    
    console.log(`[Extension] Using keyHash from chrome.storage:`, keyHash.substring(0, 16) + '...');
    
    // Get key material from KDS
    const keyMaterial = await getKeyMaterial(keyHash, walletAddress, authToken);
    
    // Decrypt profile
    try {
      const decryptedJson = await decryptDataWithMaterial(
        profileRecord.encryptedData,
        keyMaterial,
        profileRecord.walletAddress
      );
      
      const profile = JSON.parse(decryptedJson);
      console.log(`[Extension] Decrypted profile:`, profile);
      
      // TODO: Implement actual processing
      // 1. Fetch available ads
      // 2. Match against profile preferences
      
      // 3. Generate ZK proofs (example)
      // Example: Generate age proof if campaign requires it
      if (profile.age) {
        console.log(`[Extension] Profile has age data - proof generation available`);
        
        // Example proof generation (commented out - requires helper page to be open)
        // Uncomment when ready to test end-to-end
        /*
        try {
          const proof = await generateProofViaHelper('ageCheck', {
            age: profile.age
          }, {
            minAge: 21,
            maxAge: 65
          });
          console.log('[Extension] Age proof generated:', proof);
        } catch (proofError) {
          console.error('[Extension] Proof generation failed:', proofError.message);
          // Continue processing even if proof generation fails
        }
        */
      }
      
      // 4. Submit bids
      
      console.log(`[Extension] Profile processed successfully`);
      
    } catch (decryptError) {
      const errorMessage = decryptError.message || decryptError.toString();
      console.error('[Extension] Failed to decrypt profile:', errorMessage);
      throw new Error(`Decryption failed: ${errorMessage}`);
    }
    
  } catch (error) {
    console.error(`[Extension] Error processing profile ${shortAddr}:`, error);
    throw error;
  }
}

/**
 * Save execution log
 */
async function saveLog(log) {
  const db = await openDB();
  
  // Get existing logs
  const logs = await new Promise((resolve) => {
    const transaction = db.transaction([LOGS_STORE], 'readonly');
    const request = transaction.objectStore(LOGS_STORE).get('sw_logs');
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
  
  logs.push(log);
  
  // Keep only last 100
  if (logs.length > 100) {
    logs.shift();
  }
  
  // Save back
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([LOGS_STORE], 'readwrite');
    const request = transaction.objectStore(LOGS_STORE).put(logs, 'sw_logs');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save Max session to chrome.storage (unified with ad-queue.js)
 */
async function saveMaxSession(session) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('payattn_max_sessions', (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      
      const sessions = result.payattn_max_sessions || [];
      sessions.push(session);
      
      // Keep only last 50 sessions
      if (sessions.length > 50) {
        sessions.shift();
      }
      
      chrome.storage.local.set({ payattn_max_sessions: sessions }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          console.log('[Extension] Max session saved:', session.id);
          resolve();
        }
      });
    });
  });
}

/**
 * Update runtime status
 */
async function updateStatus() {
  const db = await openDB();
  const now = new Date();
  const nextRun = new Date(now.getTime() + 30 * 60 * 1000);
  
  const status = {
    lastRunAt: now.toISOString(),
    nextRunAt: nextRun.toISOString(),
    isActive: true,
  };
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STATUS_STORE], 'readwrite');
    const request = transaction.objectStore(STATUS_STORE).put(status, 'sw_status');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
