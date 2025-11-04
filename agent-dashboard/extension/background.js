/**
 * PayAttn Extension Background Script
 * 
 * Runs autonomously every 30 minutes using Chrome Alarms API
 * Uses IndexedDB (shared with website) for data access
 * Fetches encryption keys from KDS endpoint (no keys stored locally)
 * keyHash stored ONLY in chrome.storage.local (NOT in IndexedDB)
 */

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

console.log('[Extension] PayAttn Agent loaded');

// Set up alarm to run every 30 minutes
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Extension] Setting up 30-minute alarm');
  
  chrome.alarms.create('payattn-agent', {
    periodInMinutes: 30,
  });
  
  console.log('[Extension] Extension installed and alarm set!');
});

// Listen for alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'payattn-agent') {
    console.log('[Extension] Alarm triggered - running agent cycle');
    runAgentCycle();
  }
});

// Listen for manual trigger from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Extension] Message received:', message);
  
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
      // 3. Generate ZK proofs
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
