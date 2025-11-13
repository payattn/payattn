import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { isExtensionInstalled } from '../extension-detection';

describe('Extension Detection', () => {
  const originalWindow = global.window;
  const originalChrome = (global as any).chrome;

  beforeEach(() => {
    delete (global as any).window;
    delete (global as any).chrome;
    delete (global as any).indexedDB;
  });

  afterEach(() => {
    if (originalWindow) {
      (global as any).window = originalWindow;
    }
    if (originalChrome) {
      (global as any).chrome = originalChrome;
    }
  });

  describe('Server Environment', () => {
    it('should return false when window is undefined', async () => {
      const result = await isExtensionInstalled();
      expect(result).toBe(false);
    });
  });

  describe('Browser Environment', () => {
    beforeEach(() => {
      (global as any).window = {};
    });

    it('should return true when chrome runtime is available', async () => {
      (global as any).chrome = {
        runtime: {
          id: 'test_extension_id'
        }
      };

      const result = await isExtensionInstalled();
      expect(result).toBe(true);
    });

    it('should return false when chrome runtime is missing', async () => {
      (global as any).chrome = {};

      const mockIndexedDB = {
        open: jest.fn().mockReturnValue({
          onerror: null,
          onsuccess: null,
          error: null,
          result: null
        })
      };
      (global as any).indexedDB = mockIndexedDB;

      mockIndexedDB.open.mockImplementation(() => {
        const request = {
          onerror: null as any,
          onsuccess: null as any,
          error: new Error('Database not found'),
          result: null
        };
        setTimeout(() => {
          if (request.onerror) {
            request.onerror();
          }
        }, 0);
        return request;
      });

      const result = await isExtensionInstalled();
      expect(result).toBe(false);
    });

    it('should return false when chrome is undefined', async () => {
      const mockIndexedDB = {
        open: jest.fn().mockReturnValue({
          onerror: null,
          onsuccess: null,
          error: null,
          result: null
        })
      };
      (global as any).indexedDB = mockIndexedDB;

      mockIndexedDB.open.mockImplementation(() => {
        const request = {
          onerror: null as any,
          onsuccess: null as any,
          error: new Error('Database not found'),
          result: null
        };
        setTimeout(() => {
          if (request.onerror) {
            request.onerror();
          }
        }, 0);
        return request;
      });

      const result = await isExtensionInstalled();
      expect(result).toBe(false);
    });

    it('should check IndexedDB when chrome runtime unavailable', async () => {
      (global as any).chrome = undefined;

      const mockGetRequest = {
        onsuccess: null as any,
        onerror: null as any,
        result: {
          lastRunAt: new Date(Date.now() - 10 * 60 * 1000).toISOString()
        }
      };

      const mockObjectStore = {
        get: jest.fn().mockReturnValue(mockGetRequest)
      };

      const mockTransaction = {
        objectStore: jest.fn().mockReturnValue(mockObjectStore)
      };

      const mockDB = {
        transaction: jest.fn().mockReturnValue(mockTransaction)
      };

      const mockOpenRequest = {
        onerror: null as any,
        onsuccess: null as any,
        error: null,
        result: mockDB
      };

      const mockIndexedDB = {
        open: jest.fn().mockReturnValue(mockOpenRequest)
      };
      (global as any).indexedDB = mockIndexedDB;

      const promise = isExtensionInstalled();
      
      setTimeout(() => {
        if (mockOpenRequest.onsuccess) {
          mockOpenRequest.onsuccess();
        }
        setTimeout(() => {
          if (mockGetRequest.onsuccess) {
            mockGetRequest.onsuccess();
          }
        }, 0);
      }, 0);

      const result = await promise;
      expect(result).toBe(true);
    });

    it('should return false for stale IndexedDB status', async () => {
      (global as any).chrome = undefined;

      const mockGetRequest = {
        onsuccess: null as any,
        onerror: null as any,
        result: {
          lastRunAt: new Date(Date.now() - 60 * 60 * 1000).toISOString()
        }
      };

      const mockObjectStore = {
        get: jest.fn().mockReturnValue(mockGetRequest)
      };

      const mockTransaction = {
        objectStore: jest.fn().mockReturnValue(mockObjectStore)
      };

      const mockDB = {
        transaction: jest.fn().mockReturnValue(mockTransaction)
      };

      const mockOpenRequest = {
        onerror: null as any,
        onsuccess: null as any,
        error: null,
        result: mockDB
      };

      const mockIndexedDB = {
        open: jest.fn().mockReturnValue(mockOpenRequest)
      };
      (global as any).indexedDB = mockIndexedDB;

      const promise = isExtensionInstalled();
      
      setTimeout(() => {
        if (mockOpenRequest.onsuccess) {
          mockOpenRequest.onsuccess();
        }
        setTimeout(() => {
          if (mockGetRequest.onsuccess) {
            mockGetRequest.onsuccess();
          }
        }, 0);
      }, 0);

      const result = await promise;
      expect(result).toBe(false);
    });

    it('should handle IndexedDB errors gracefully', async () => {
      (global as any).chrome = undefined;

      const mockIndexedDB = {
        open: jest.fn().mockImplementation(() => {
          const request = {
            onerror: null as any,
            onsuccess: null as any,
            error: new Error('IndexedDB error'),
            result: null
          };
          setTimeout(() => {
            if (request.onerror) {
              request.onerror();
            }
          }, 0);
          return request;
        })
      };
      (global as any).indexedDB = mockIndexedDB;

      const result = await isExtensionInstalled();
      expect(result).toBe(false);
    });

    it('should handle transaction error in getStatusFromDB', async () => {
      (global as any).chrome = undefined;

      const mockGetRequest = {
        onsuccess: null as any,
        onerror: null as any,
        result: null,
        error: new Error('Get request failed')
      };

      const mockObjectStore = {
        get: jest.fn().mockReturnValue(mockGetRequest)
      };

      const mockTransaction = {
        objectStore: jest.fn().mockReturnValue(mockObjectStore)
      };

      const mockDB = {
        transaction: jest.fn().mockReturnValue(mockTransaction)
      };

      const mockOpenRequest = {
        onerror: null as any,
        onsuccess: null as any,
        error: null,
        result: mockDB
      };

      const mockIndexedDB = {
        open: jest.fn().mockReturnValue(mockOpenRequest)
      };
      (global as any).indexedDB = mockIndexedDB;

      const promise = isExtensionInstalled();
      
      setTimeout(() => {
        if (mockOpenRequest.onsuccess) {
          mockOpenRequest.onsuccess();
        }
        setTimeout(() => {
          // Trigger error callback
          if (mockGetRequest.onerror) {
            mockGetRequest.onerror();
          }
        }, 0);
      }, 0);

      const result = await promise;
      // Should return false due to error, which resolves to null status
      expect(result).toBe(false);
    });

    it('should handle missing status data in IndexedDB', async () => {
      (global as any).chrome = undefined;

      const mockGetRequest = {
        onsuccess: null as any,
        onerror: null as any,
        result: null  // No status found
      };

      const mockObjectStore = {
        get: jest.fn().mockReturnValue(mockGetRequest)
      };

      const mockTransaction = {
        objectStore: jest.fn().mockReturnValue(mockObjectStore)
      };

      const mockDB = {
        transaction: jest.fn().mockReturnValue(mockTransaction)
      };

      const mockOpenRequest = {
        onerror: null as any,
        onsuccess: null as any,
        error: null,
        result: mockDB
      };

      const mockIndexedDB = {
        open: jest.fn().mockReturnValue(mockOpenRequest)
      };
      (global as any).indexedDB = mockIndexedDB;

      const promise = isExtensionInstalled();
      
      setTimeout(() => {
        if (mockOpenRequest.onsuccess) {
          mockOpenRequest.onsuccess();
        }
        setTimeout(() => {
          if (mockGetRequest.onsuccess) {
            mockGetRequest.onsuccess();
          }
        }, 0);
      }, 0);

      const result = await promise;
      expect(result).toBe(false);
    });
  });
});
