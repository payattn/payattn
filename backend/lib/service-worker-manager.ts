/**
 * Service Worker Registration and Management
 * 
 * Registers the autonomous agent Service Worker
 * Requests Periodic Background Sync permission (30-minute intervals)
 */

export interface ServiceWorkerStatus {
  registered: boolean;
  periodicSyncEnabled: boolean;
  error?: string;
}

/**
 * Register Service Worker and configure periodic sync
 */
export async function registerServiceWorker(): Promise<ServiceWorkerStatus> {
  // Check if Service Worker is supported
  if (!('serviceWorker' in navigator)) {
    return {
      registered: false,
      periodicSyncEnabled: false,
      error: 'Service Worker not supported in this browser',
    };
  }

  try {
    // Register the Service Worker
    await navigator.serviceWorker.register('/sw-agent.js', {
      scope: '/',
    });

    console.log('[App] Service Worker registered');

    // Wait for Service Worker to be active and get the active registration
    const registration = await navigator.serviceWorker.ready;
    console.log('[App] Service Worker is active and ready');

    // Check for Periodic Background Sync support
    if (!('periodicSync' in registration)) {
      return {
        registered: true,
        periodicSyncEnabled: false,
        error: 'Periodic Background Sync not supported in this browser',
      };
    }

    // Request periodic sync (30 minute intervals)
    try {
      // @ts-expect-error - periodicSync is not in TypeScript types yet
      await registration.periodicSync.register('payattn-agent', {
        minInterval: 30 * 60 * 1000, // 30 minutes in milliseconds
      });
      console.log('[App] Periodic sync registered');
      
      return {
        registered: true,
        periodicSyncEnabled: true,
      };
    } catch (syncError) {
      console.warn('[App] Periodic sync registration failed:', syncError);
      // Service Worker is registered but periodic sync failed (permission denied, etc.)
      return {
        registered: true,
        periodicSyncEnabled: false,
        error: 'Periodic sync not available (browser may have denied permission)',
      };
    }
  } catch (error) {
    console.error('[App] Service Worker registration failed:', error);
    return {
      registered: false,
      periodicSyncEnabled: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Unregister Service Worker (for testing/cleanup)
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    
    for (const registration of registrations) {
      await registration.unregister();
    }

    console.log('[App] Service Worker unregistered');
    return true;
  } catch (error) {
    console.error('[App] Failed to unregister Service Worker:', error);
    return false;
  }
}

/**
 * Get current Service Worker status
 */
export async function getServiceWorkerStatus(): Promise<ServiceWorkerStatus> {
  if (!('serviceWorker' in navigator)) {
    return {
      registered: false,
      periodicSyncEnabled: false,
      error: 'Service Worker not supported',
    };
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    
    if (!registration) {
      return {
        registered: false,
        periodicSyncEnabled: false,
      };
    }

    // Check periodic sync status
    let periodicSyncEnabled = false;
    if ('periodicSync' in registration) {
      try {
        // @ts-expect-error - periodicSync is not in TypeScript types yet
        const tags = await registration.periodicSync.getTags();
        periodicSyncEnabled = tags.includes('payattn-agent');
      } catch (error) {
        console.error('[App] Failed to check periodic sync status:', error);
      }
    }

    return {
      registered: true,
      periodicSyncEnabled,
    };
  } catch (error) {
    return {
      registered: false,
      periodicSyncEnabled: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Trigger a manual sync (for testing)
 * Note: Periodic sync can only be triggered by the browser in production
 * @param profiles - Array of decrypted profile data to send to SW
 * @param logs - Current execution logs
 */
export async function triggerManualSync(
  profiles: Array<{ publicKey: string; profile: any }> = [],
  logs: any[] = []
): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Send message to SW to trigger a manual sync with profile data
    if (registration.active) {
      registration.active.postMessage({
        type: 'MANUAL_SYNC',
        profiles,
        logs,
      });
      
      console.log('[App] Manual sync triggered');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[App] Failed to trigger manual sync:', error);
    return false;
  }
}
