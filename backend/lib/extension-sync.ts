/**
 * Extension Sync Utilities
 * 
 * Syncs authentication data to PayAttn extension via content script
 */

/**
 * Sync authentication to extension
 */
export async function syncAuthToExtension(keyHash: string, walletAddress: string, authToken?: string): Promise<boolean> {
  try {
    console.log('[extension-sync] Attempting to sync auth to extension...');
    
    // Check if extension is installed by looking for the data attribute
    const extensionId = document.documentElement.getAttribute('data-payattn-extension-id');
    
    if (!extensionId) {
      console.log('[extension-sync] Extension not detected (no extension ID found)');
      return false;
    }
    
    console.log('[extension-sync] Extension detected:', extensionId);

    return new Promise((resolve) => {
      let resolved = false;
      
      // Set up listener for response
      const responseHandler = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) {
          return;
        }
        
        if (event.data?.type === 'PAYATTN_AUTH_RESPONSE') {
          if (resolved) return;
          resolved = true;
          
          window.removeEventListener('message', responseHandler);
          
          if (event.data.success) {
            console.log('[extension-sync] ✅ Successfully synced to extension!');
            resolve(true);
          } else {
            console.log('[extension-sync] Failed:', event.data.error);
            resolve(false);
          }
        }
      };
      
      window.addEventListener('message', responseHandler);
      
      // Send message to content script via postMessage
      window.postMessage({
        type: 'PAYATTN_SAVE_AUTH',
        keyHash,
        walletAddress,
        authToken
      }, window.location.origin);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (resolved) return;
        resolved = true;
        
        window.removeEventListener('message', responseHandler);
        console.log('[extension-sync] Timeout waiting for response');
        resolve(false);
      }, 5000);
    });
  } catch (err) {
    console.log('[extension-sync] Error:', err);
    return false;
  }
}

/**
 * Sync profile data to extension
 */
export async function syncProfileToExtension(
  walletAddress: string,
  encryptedData: string
): Promise<boolean> {
  try {
    console.log('[extension-sync] Attempting to sync profile to extension...');
    
    // Check if extension is installed
    const extensionId = document.documentElement.getAttribute('data-payattn-extension-id');
    
    if (!extensionId) {
      console.log('[extension-sync] Extension not detected');
      return false;
    }

    return new Promise((resolve) => {
      let resolved = false;
      
      // Set up listener for response
      const responseHandler = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) {
          return;
        }
        
        if (event.data?.type === 'PAYATTN_PROFILE_RESPONSE') {
          if (resolved) return;
          resolved = true;
          
          window.removeEventListener('message', responseHandler);
          
          if (event.data.success) {
            console.log('[extension-sync] ✅ Profile synced to extension!');
            resolve(true);
          } else {
            console.log('[extension-sync] Profile sync failed:', event.data.error);
            resolve(false);
          }
        }
      };
      
      window.addEventListener('message', responseHandler);
      
      // Send profile to content script via postMessage
      window.postMessage({
        type: 'PAYATTN_SAVE_PROFILE',
        walletAddress,
        encryptedData,
        version: 1,
        timestamp: Date.now()
      }, window.location.origin);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (resolved) return;
        resolved = true;
        
        window.removeEventListener('message', responseHandler);
        console.log('[extension-sync] Profile sync timeout');
        resolve(false);
      }, 5000);
    });
  } catch (err) {
    console.log('[extension-sync] Profile sync error:', err);
    return false;
  }
}

/**
 * Check if extension is installed
 */
export function isExtensionInstalled(): boolean {
  return !!document.documentElement.getAttribute('data-payattn-extension-id');
}

/**
 * Get extension ID if installed
 */
export function getExtensionId(): string | null {
  return document.documentElement.getAttribute('data-payattn-extension-id');
}
