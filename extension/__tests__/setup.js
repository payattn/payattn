/**
 * Test setup for Chrome extension
 * Mocks Chrome APIs and global objects
 */

import { jest } from '@jest/globals';

// Mock Chrome APIs
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    lastError: null,
    id: 'test-extension-id',
  },
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        callback({});
      }),
      set: jest.fn((items, callback) => {
        if (callback) callback();
      }),
      remove: jest.fn((keys, callback) => {
        if (callback) callback();
      }),
      clear: jest.fn((callback) => {
        if (callback) callback();
      }),
    },
    sync: {
      get: jest.fn((keys, callback) => {
        callback({});
      }),
      set: jest.fn((items, callback) => {
        if (callback) callback();
      }),
    },
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
    create: jest.fn(),
  },
  notifications: {
    create: jest.fn(),
  },
};

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  })
);

// Mock crypto.subtle
if (!global.crypto) {
  global.crypto = {};
}

if (!global.crypto.subtle) {
  global.crypto.subtle = {
    digest: jest.fn(),
    importKey: jest.fn(),
    deriveBits: jest.fn(),
    deriveKey: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    generateKey: jest.fn(),
  };
}

// Mock crypto.getRandomValues
if (!global.crypto.getRandomValues) {
  global.crypto.getRandomValues = jest.fn((array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  });
}

// Mock TextEncoder/TextDecoder
global.TextEncoder = class TextEncoder {
  encode(str) {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0; i < str.length; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return bufView;
  }
};

global.TextDecoder = class TextDecoder {
  decode(arr) {
    return String.fromCharCode.apply(null, new Uint8Array(arr));
  }
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  
  // Reset chrome.storage.local.get to default behavior
  global.chrome.storage.local.get.mockImplementation((keys, callback) => {
    callback({});
  });
  
  // Reset fetch to default behavior
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  });
});
