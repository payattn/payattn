/**
 * Extension Detection Utility
 * 
 * Detects if PayAttn extension is installed
 */

export async function isExtensionInstalled(): Promise<boolean> {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return false;
  }

  // Try to detect extension by checking if alarms API is available
  // Extensions have access to chrome.alarms, regular pages don't
  try {
    // Check if chrome runtime is available (indicates extension context)
    // @ts-ignore - chrome API not in types
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      return true;
    }
    
    // Alternative: Check IndexedDB for extension-specific markers
    // When extension runs, it creates certain data patterns
    const db = await openDB();
    const status = await getStatusFromDB(db);
    
    // If we have a very recent status update, extension is likely installed
    if (status && status.lastRunAt) {
      const lastRun = new Date(status.lastRunAt);
      const now = new Date();
      // If it ran in the last 35 minutes, extension is active
      return (now.getTime() - lastRun.getTime()) < 35 * 60 * 1000;
    }
    
    return false;
  } catch {
    return false;
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('payattn_db', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function getStatusFromDB(db: IDBDatabase): Promise<any> {
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(['status'], 'readonly');
      const request = transaction.objectStore('status').get('sw_status');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}
