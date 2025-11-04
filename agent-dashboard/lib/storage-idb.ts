/**
 * IndexedDB Storage Layer
 * 
 * Shared between website and extension for seamless data access
 * Extension background script can read/write while website UI updates
 * 
 * SECURITY NOTE:
 * - keyHash is NOT stored in IndexedDB
 * - Website: keyHash stored in memory session only
 * - Extension: keyHash stored in chrome.storage.local only
 * 
 * Storage structure for profiles:
 * {
 *   walletAddress: string,
 *   encryptedData: string,  // Encrypted profile JSON
 *   version: number,
 *   timestamp: number
 * }
 */

const DB_NAME = 'payattn_db';
const DB_VERSION = 1;
const PROFILES_STORE = 'profiles';
const LOGS_STORE = 'logs';
const STATUS_STORE = 'status';

export interface ProfileRecord {
  walletAddress: string;
  encryptedData: string;
  version: number;
  timestamp: number;
}

/**
 * Open IndexedDB connection
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create stores if they don't exist
      if (!db.objectStoreNames.contains(PROFILES_STORE)) {
        db.createObjectStore(PROFILES_STORE); // key: payattn_profile_v1_{walletAddress}
      }

      if (!db.objectStoreNames.contains(LOGS_STORE)) {
        db.createObjectStore(LOGS_STORE); // key: 'sw_logs'
      }

      if (!db.objectStoreNames.contains(STATUS_STORE)) {
        db.createObjectStore(STATUS_STORE); // key: 'sw_status'
      }
    };
  });
}

/**
 * Save profile to IndexedDB
 */
export async function saveProfileIDB(
  walletAddress: string,
  encryptedData: string,
  version: number = 1
): Promise<void> {
  const db = await openDB();
  const key = `payattn_profile_v1_${walletAddress}`;
  
  const record: ProfileRecord = {
    walletAddress,
    encryptedData,
    version,
    timestamp: Date.now()
  };
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROFILES_STORE], 'readwrite');
    const store = transaction.objectStore(PROFILES_STORE);
    const request = store.put(record, key);

    request.onsuccess = () => {
      console.log('[storage-idb] Profile saved to IndexedDB:', {
        walletAddress: walletAddress.slice(0, 8) + '...',
        dataLength: encryptedData.length,
        version,
        timestamp: record.timestamp
      });
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get profile from IndexedDB
 */
export async function getProfileIDB(walletAddress: string): Promise<ProfileRecord | null> {
  const db = await openDB();
  const key = `payattn_profile_v1_${walletAddress}`;
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROFILES_STORE], 'readonly');
    const store = transaction.objectStore(PROFILES_STORE);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all profile records
 */
export async function getAllProfilesIDB(): Promise<ProfileRecord[]> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROFILES_STORE], 'readonly');
    const store = transaction.objectStore(PROFILES_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all profile keys
 */
export async function getAllProfileKeysIDB(): Promise<string[]> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROFILES_STORE], 'readonly');
    const store = transaction.objectStore(PROFILES_STORE);
    const request = store.getAllKeys();

    request.onsuccess = () => {
      const keys = (request.result as string[])
        .filter(key => key.startsWith('payattn_profile_v1_'))
        .map(key => key.replace('payattn_profile_v1_', ''));
      resolve(keys);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete profile from IndexedDB
 */
export async function deleteProfileIDB(walletAddress: string): Promise<void> {
  const db = await openDB();
  const key = `payattn_profile_v1_${walletAddress}`;
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROFILES_STORE], 'readwrite');
    const store = transaction.objectStore(PROFILES_STORE);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save execution logs
 */
export async function saveLogsIDB(logs: any[]): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([LOGS_STORE], 'readwrite');
    const store = transaction.objectStore(LOGS_STORE);
    const request = store.put(logs, 'sw_logs');

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get execution logs
 */
export async function getLogsIDB(): Promise<any[]> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([LOGS_STORE], 'readonly');
    const store = transaction.objectStore(LOGS_STORE);
    const request = store.get('sw_logs');

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear execution logs
 */
export async function clearLogsIDB(): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([LOGS_STORE], 'readwrite');
    const store = transaction.objectStore(LOGS_STORE);
    const request = store.delete('sw_logs');

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save runtime status
 */
export async function saveStatusIDB(status: any): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STATUS_STORE], 'readwrite');
    const store = transaction.objectStore(STATUS_STORE);
    const request = store.put(status, 'sw_status');

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get runtime status
 */
export async function getStatusIDB(): Promise<any | null> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STATUS_STORE], 'readonly');
    const store = transaction.objectStore(STATUS_STORE);
    const request = store.get('sw_status');

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}
