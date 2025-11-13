import { AuthService } from '../auth';
import { PublicKey, Keypair } from '@solana/web3.js';
import * as nacl from 'tweetnacl';
import { fetchKeyMaterial } from '../crypto-pure';

jest.mock('../crypto-pure');

const mockFetchKeyMaterial = fetchKeyMaterial as jest.MockedFunction<typeof fetchKeyMaterial>;

describe('AuthService', () => {
  let testKeypair: Keypair;
  let testPublicKey: PublicKey;
  let testWalletAddress: string;

  beforeEach(() => {
    jest.clearAllMocks();
    testKeypair = Keypair.generate();
    testPublicKey = testKeypair.publicKey;
    testWalletAddress = testPublicKey.toString();
    
    // Mock crypto.subtle for tests
    global.crypto = {
      subtle: {
        digest: jest.fn().mockImplementation(async () => {
          return new ArrayBuffer(32);
        })
      },
      getRandomValues: jest.fn().mockImplementation((arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      })
    } as any;
  });

  describe('generateChallenge', () => {
    it('should generate challenge with message, timestamp, and nonce', () => {
      const challenge = AuthService.generateChallenge();

      expect(challenge).toHaveProperty('message');
      expect(challenge).toHaveProperty('timestamp');
      expect(challenge).toHaveProperty('nonce');
      expect(typeof challenge.timestamp).toBe('number');
      expect(typeof challenge.nonce).toBe('string');
      expect(challenge.nonce.length).toBeGreaterThan(0);
    });

    it('should generate unique nonces for each challenge', () => {
      const challenge1 = AuthService.generateChallenge();
      const challenge2 = AuthService.generateChallenge();

      expect(challenge1.nonce).not.toBe(challenge2.nonce);
    });

    it('should include current timestamp', () => {
      const before = Date.now();
      const challenge = AuthService.generateChallenge();
      const after = Date.now();

      expect(challenge.timestamp).toBeGreaterThanOrEqual(before);
      expect(challenge.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('verifySignature', () => {
    it('should verify valid signature', () => {
      const message = `Sign in to Pay Attention\n\nWallet: ${testWalletAddress}`;
      const encodedMessage = new TextEncoder().encode(message);
      const signature = nacl.sign.detached(encodedMessage, testKeypair.secretKey);

      const isValid = AuthService.verifySignature(
        testPublicKey,
        signature,
        testWalletAddress
      );

      expect(isValid).toBe(true);
    });

    it('should reject signature with wrong public key', () => {
      const wrongKeypair = Keypair.generate();
      const message = `Sign in to Pay Attention\n\nWallet: ${testWalletAddress}`;
      const encodedMessage = new TextEncoder().encode(message);
      const signature = nacl.sign.detached(encodedMessage, wrongKeypair.secretKey);

      const isValid = AuthService.verifySignature(
        testPublicKey,
        signature,
        testWalletAddress
      );

      expect(isValid).toBe(false);
    });

    it('should reject signature with tampered message', () => {
      const message = `Sign in to Pay Attention\n\nWallet: ${testWalletAddress}`;
      const encodedMessage = new TextEncoder().encode(message);
      const signature = nacl.sign.detached(encodedMessage, testKeypair.secretKey);

      const wrongAddress = Keypair.generate().publicKey.toString();
      const isValid = AuthService.verifySignature(
        testPublicKey,
        signature,
        wrongAddress
      );

      expect(isValid).toBe(false);
    });

    it('should reject invalid signature bytes', () => {
      const invalidSignature = new Uint8Array(64);
      
      const isValid = AuthService.verifySignature(
        testPublicKey,
        invalidSignature,
        testWalletAddress
      );

      expect(isValid).toBe(false);
    });

    it('should handle signature verification errors gracefully', () => {
      const malformedSignature = new Uint8Array(10);

      const isValid = AuthService.verifySignature(
        testPublicKey,
        malformedSignature,
        testWalletAddress
      );

      expect(isValid).toBe(false);
    });
  });

  describe('isChallengeValid', () => {
    it('should validate recent challenge', () => {
      const challenge = {
        message: 'test',
        timestamp: Date.now(),
        nonce: 'abc123'
      };

      expect(AuthService.isChallengeValid(challenge)).toBe(true);
    });

    it('should reject expired challenge', () => {
      const challenge = {
        message: 'test',
        timestamp: Date.now() - (6 * 60 * 1000), // 6 minutes ago
        nonce: 'abc123'
      };

      expect(AuthService.isChallengeValid(challenge)).toBe(false);
    });

    it('should validate challenge within 5 minute window', () => {
      const challenge = {
        message: 'test',
        timestamp: Date.now() - (4 * 60 * 1000), // 4 minutes ago
        nonce: 'abc123'
      };

      expect(AuthService.isChallengeValid(challenge)).toBe(true);
    });
  });

  describe('isSessionValid', () => {
    it('should validate authenticated non-expired session', () => {
      const session = {
        publicKey: testWalletAddress,
        authenticated: true,
        timestamp: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000)
      };

      expect(AuthService.isSessionValid(session)).toBe(true);
    });

    it('should reject null session', () => {
      expect(AuthService.isSessionValid(null)).toBe(false);
    });

    it('should reject unauthenticated session', () => {
      const session = {
        publicKey: testWalletAddress,
        authenticated: false,
        timestamp: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000)
      };

      expect(AuthService.isSessionValid(session)).toBe(false);
    });

    it('should reject expired session', () => {
      const session = {
        publicKey: testWalletAddress,
        authenticated: true,
        timestamp: Date.now() - (25 * 60 * 60 * 1000),
        expiresAt: Date.now() - (1 * 60 * 60 * 1000)
      };

      expect(AuthService.isSessionValid(session)).toBe(false);
    });
  });

  describe('requestSignature', () => {
    it('should throw error if wallet does not support signing', async () => {
      const wallet = {}; // No signMessage method

      const challenge = AuthService.generateChallenge();

      await expect(
        AuthService.requestSignature(wallet, challenge, testWalletAddress)
      ).rejects.toThrow('Wallet does not support message signing');
    });

    it('should request signature with correct message format', async () => {
      const mockSignature = new Uint8Array(64);
      const wallet = {
        signMessage: jest.fn().mockResolvedValue(mockSignature)
      };

      const challenge = AuthService.generateChallenge();
      const signature = await AuthService.requestSignature(
        wallet,
        challenge,
        testWalletAddress
      );

      expect(wallet.signMessage).toHaveBeenCalled();
      const calledWith = wallet.signMessage.mock.calls[0][0];
      const decodedMessage = new TextDecoder().decode(calledWith);
      expect(decodedMessage).toContain('Sign in to Pay Attention');
      expect(decodedMessage).toContain(testWalletAddress);
      expect(signature).toBe(mockSignature);
    });

    it('should throw error when user cancels signature', async () => {
      const wallet = {
        signMessage: jest.fn().mockRejectedValue(new Error('User rejected'))
      };

      const challenge = AuthService.generateChallenge();

      await expect(
        AuthService.requestSignature(wallet, challenge, testWalletAddress)
      ).rejects.toThrow('Signature request cancelled');
    });
  });

  describe('createSessionToken', () => {
    it('should create token with wallet info and expiry', () => {
      const token = AuthService.createSessionToken(
        testWalletAddress,
        testWalletAddress
      );

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      
      // Decode token to verify structure (format: header.payload)
      const parts = token.split('.');
      expect(parts.length).toBe(2);
      
      const payload = JSON.parse(atob(parts[1]!));
      expect(payload.walletAddress).toBe(testWalletAddress);
      expect(payload.publicKey).toBe(testWalletAddress);
      expect(payload.issuedAt).toBeDefined();
      expect(payload.expiresAt).toBeGreaterThan(payload.issuedAt);
    });

    it('should create token that expires in 24 hours', () => {
      const before = Date.now();
      const token = AuthService.createSessionToken(
        testWalletAddress,
        testWalletAddress
      );
      const after = Date.now();

      const parts = token.split('.');
      const payload = JSON.parse(atob(parts[1]!));
      
      const expectedExpiry = 24 * 60 * 60 * 1000;
      const actualDuration = payload.expiresAt - payload.issuedAt;
      
      expect(actualDuration).toBe(expectedExpiry);
      expect(payload.issuedAt).toBeGreaterThanOrEqual(before);
      expect(payload.issuedAt).toBeLessThanOrEqual(after);
    });

    it('should include JWT header with correct format', () => {
      const token = AuthService.createSessionToken(
        testWalletAddress,
        testWalletAddress
      );

      const parts = token.split('.');
      const header = JSON.parse(atob(parts[0]!));
      
      expect(header.alg).toBe('none');
      expect(header.typ).toBe('JWT');
    });
  });

  describe('createSession', () => {
    it('should create session with authentication details', async () => {
      const signature = new Uint8Array(64);
      mockFetchKeyMaterial.mockResolvedValue('mock-key-material');

      const session = await AuthService.createSession(testWalletAddress, signature);

      expect(session.publicKey).toBe(testWalletAddress);
      expect(session.authenticated).toBe(true);
      expect(session.timestamp).toBeDefined();
      expect(session.expiresAt).toBeGreaterThan(session.timestamp);
      expect(session.keyHash).toBeDefined();
      expect(session.authToken).toBeDefined();
      expect(session.keyMaterial).toBe('mock-key-material');
    });

    it('should encode signature as base64 authToken', async () => {
      const signature = new Uint8Array([1, 2, 3, 4, 5]);
      mockFetchKeyMaterial.mockResolvedValue('mock-key-material');

      const session = await AuthService.createSession(testWalletAddress, signature);

      expect(session.authToken).toBeDefined();
      expect(typeof session.authToken).toBe('string');
      // Verify it's valid base64
      expect(() => atob(session.authToken!)).not.toThrow();
    });

    it('should compute deterministic keyHash from wallet', async () => {
      const signature = new Uint8Array(64);
      mockFetchKeyMaterial.mockResolvedValue('mock-key-material');

      const session1 = await AuthService.createSession(testWalletAddress, signature);
      const session2 = await AuthService.createSession(testWalletAddress, signature);

      expect(session1.keyHash).toBe(session2.keyHash);
      expect(session1.keyHash).toBeDefined();
      expect(session1.keyHash!.length).toBe(64); // SHA-256 hex = 64 chars
    });

    it('should fetch key material from KDS', async () => {
      const signature = new Uint8Array(64);
      const mockKeyMaterial = 'test-key-material-123';
      mockFetchKeyMaterial.mockResolvedValue(mockKeyMaterial);

      const session = await AuthService.createSession(testWalletAddress, signature);

      expect(mockFetchKeyMaterial).toHaveBeenCalled();
      expect(session.keyMaterial).toBe(mockKeyMaterial);
    });

    it('should continue without key material if KDS fetch fails', async () => {
      const signature = new Uint8Array(64);
      mockFetchKeyMaterial.mockRejectedValue(new Error('KDS unavailable'));

      const session = await AuthService.createSession(testWalletAddress, signature);

      expect(session.authenticated).toBe(true);
      expect(session.keyMaterial).toBeUndefined();
    });

    it('should set session expiry to 24 hours', async () => {
      const signature = new Uint8Array(64);
      mockFetchKeyMaterial.mockResolvedValue('mock-key-material');
      const before = Date.now();

      const session = await AuthService.createSession(testWalletAddress, signature);

      const expectedDuration = 24 * 60 * 60 * 1000;
      const actualDuration = session.expiresAt - session.timestamp;
      
      expect(actualDuration).toBe(expectedDuration);
      expect(session.timestamp).toBeGreaterThanOrEqual(before);
    });
  });

  describe('getKeyMaterial', () => {
    it('should return cached material if available', async () => {
      const session = {
        publicKey: testWalletAddress,
        authenticated: true,
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000,
        keyMaterial: 'cached-material',
      };

      const material = await AuthService.getKeyMaterial(session);

      expect(material).toBe('cached-material');
      expect(mockFetchKeyMaterial).not.toHaveBeenCalled();
    });

    it('should fetch from KDS if no cached material', async () => {
      const session = {
        publicKey: testWalletAddress,
        authenticated: true,
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000,
        keyHash: 'test-hash',
        authToken: 'test-token',
      };
      mockFetchKeyMaterial.mockResolvedValue('fetched-material');

      const material = await AuthService.getKeyMaterial(session);

      expect(material).toBe('fetched-material');
      expect(mockFetchKeyMaterial).toHaveBeenCalledWith(
        'test-hash',
        testWalletAddress,
        'test-token'
      );
    });

    it('should cache fetched material in session', async () => {
      const session: any = {
        publicKey: testWalletAddress,
        authenticated: true,
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000,
        keyHash: 'test-hash',
        authToken: 'test-token',
      };
      mockFetchKeyMaterial.mockResolvedValue('new-material');

      await AuthService.getKeyMaterial(session);

      expect(session.keyMaterial).toBe('new-material');
    });

    it('should throw error if no authentication available', async () => {
      const session = {
        publicKey: testWalletAddress,
        authenticated: true,
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      await expect(AuthService.getKeyMaterial(session)).rejects.toThrow(
        'No authentication available in session'
      );
    });
  });

  describe('getSession', () => {
    beforeEach(() => {
      // Mock localStorage
      const localStorageMock = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      };
      Object.defineProperty(global, 'localStorage', {
        value: localStorageMock,
        writable: true
      });
      Object.defineProperty(global, 'window', {
        value: global,
        writable: true
      });
    });

    it('should return null if window is undefined', () => {
      Object.defineProperty(global, 'window', {
        value: undefined,
        writable: true
      });

      const session = AuthService.getSession();
      expect(session).toBeNull();
    });

    it('should return null if no session stored', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(null);

      const session = AuthService.getSession();
      expect(session).toBeNull();
    });

    it('should return session if valid and not expired', () => {
      const validSession = {
        publicKey: testWalletAddress,
        authenticated: true,
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000,
      };
      (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(validSession));

      const session = AuthService.getSession();
      expect(session).toEqual(validSession);
    });

    it('should clear and return null if session is expired', () => {
      const expiredSession = {
        publicKey: testWalletAddress,
        authenticated: true,
        timestamp: Date.now() - 7200000,
        expiresAt: Date.now() - 3600000, // expired 1 hour ago
      };
      (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(expiredSession));

      const session = AuthService.getSession();
      expect(session).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalled();
    });

    it('should return null if session JSON is invalid', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue('invalid json');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const session = AuthService.getSession();
      expect(session).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('clearSession', () => {
    beforeEach(() => {
      const localStorageMock = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      };
      Object.defineProperty(global, 'localStorage', {
        value: localStorageMock,
        writable: true
      });
      Object.defineProperty(global, 'window', {
        value: global,
        writable: true
      });
    });

    it('should remove session from localStorage', () => {
      AuthService.clearSession();

      expect(localStorage.removeItem).toHaveBeenCalledWith('payattn_auth_session');
    });

    it('should not error if window is undefined', () => {
      Object.defineProperty(global, 'window', {
        value: undefined,
        writable: true
      });

      expect(() => AuthService.clearSession()).not.toThrow();
    });
  });

  describe('refreshSession', () => {
    beforeEach(() => {
      const localStorageMock = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      };
      Object.defineProperty(global, 'localStorage', {
        value: localStorageMock,
        writable: true
      });
      Object.defineProperty(global, 'window', {
        value: global,
        writable: true
      });
    });

    it('should return null if no session exists', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(null);

      const refreshed = AuthService.refreshSession();
      expect(refreshed).toBeNull();
    });

    it('should return null if session is invalid', () => {
      const invalidSession = {
        publicKey: testWalletAddress,
        authenticated: false,
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000,
      };
      (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(invalidSession));

      const refreshed = AuthService.refreshSession();
      expect(refreshed).toBeNull();
    });

    it('should return null if session is expired', () => {
      const expiredSession = {
        publicKey: testWalletAddress,
        authenticated: true,
        timestamp: Date.now() - 7200000,
        expiresAt: Date.now() - 1000, // expired
      };
      (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(expiredSession));

      const refreshed = AuthService.refreshSession();
      expect(refreshed).toBeNull();
    });

    it('should refresh valid session and update expiry', () => {
      const validSession = {
        publicKey: testWalletAddress,
        authenticated: true,
        timestamp: Date.now(),
        expiresAt: Date.now() + 1000000,
      };
      (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(validSession));

      const beforeRefresh = Date.now();
      const refreshed = AuthService.refreshSession();
      const afterRefresh = Date.now();

      expect(refreshed).not.toBeNull();
      expect(refreshed!.expiresAt).toBeGreaterThan(beforeRefresh + 24 * 60 * 60 * 1000 - 1000);
      expect(refreshed!.expiresAt).toBeLessThan(afterRefresh + 24 * 60 * 60 * 1000 + 1000);
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('should save refreshed session to localStorage', () => {
      const validSession = {
        publicKey: testWalletAddress,
        authenticated: true,
        timestamp: Date.now(),
        expiresAt: Date.now() + 1000000,
      };
      (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(validSession));

      AuthService.refreshSession();

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'payattn_auth_session',
        expect.any(String)
      );
    });
  });

  describe('getSessionToken', () => {
    beforeEach(() => {
      const localStorageMock = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      };
      Object.defineProperty(global, 'localStorage', {
        value: localStorageMock,
        writable: true
      });
      Object.defineProperty(global, 'window', {
        value: global,
        writable: true
      });
      (global as any).atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
    });

    it('should return null if window is undefined', () => {
      Object.defineProperty(global, 'window', {
        value: undefined,
        writable: true
      });

      const token = AuthService.getSessionToken();
      expect(token).toBeNull();
    });

    it('should return null if no JWT stored', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(null);

      const token = AuthService.getSessionToken();
      expect(token).toBeNull();
    });

    it('should return token if valid and not expired', () => {
      const validToken = {
        walletAddress: testWalletAddress,
        publicKey: testWalletAddress,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000
      };
      const payload = Buffer.from(JSON.stringify(validToken)).toString('base64');
      const jwt = `header.${payload}`;
      (localStorage.getItem as jest.Mock).mockReturnValue(jwt);

      const token = AuthService.getSessionToken();
      expect(token).toEqual(validToken);
    });

    it('should return null and clear if JWT format is invalid', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue('invalid.jwt.format');

      const token = AuthService.getSessionToken();
      expect(token).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith('payattn_session');
    });

    it('should return null and clear if payload is missing', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue('header.');

      const token = AuthService.getSessionToken();
      expect(token).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalled();
    });

    it('should return null and clear if token is expired', () => {
      const expiredToken = {
        walletAddress: testWalletAddress,
        publicKey: testWalletAddress,
        issuedAt: Date.now() - 7200000,
        expiresAt: Date.now() - 3600000
      };
      const payload = Buffer.from(JSON.stringify(expiredToken)).toString('base64');
      const jwt = `header.${payload}`;
      (localStorage.getItem as jest.Mock).mockReturnValue(jwt);

      const token = AuthService.getSessionToken();
      expect(token).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalled();
    });

    it('should return null and clear if JSON parsing fails', () => {
      const payload = Buffer.from('invalid json').toString('base64');
      const jwt = `header.${payload}`;
      (localStorage.getItem as jest.Mock).mockReturnValue(jwt);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const token = AuthService.getSessionToken();
      expect(token).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('clearSessionToken', () => {
    beforeEach(() => {
      const localStorageMock = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      };
      Object.defineProperty(global, 'localStorage', {
        value: localStorageMock,
        writable: true
      });
      Object.defineProperty(global, 'window', {
        value: global,
        writable: true
      });
    });

    it('should remove JWT session from localStorage', () => {
      AuthService.clearSessionToken();

      expect(localStorage.removeItem).toHaveBeenCalledWith('payattn_session');
    });

    it('should not error if window is undefined', () => {
      Object.defineProperty(global, 'window', {
        value: undefined,
        writable: true
      });

      expect(() => AuthService.clearSessionToken()).not.toThrow();
    });
  });

  describe('isSessionTokenValid', () => {
    beforeEach(() => {
      const localStorageMock = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      };
      Object.defineProperty(global, 'localStorage', {
        value: localStorageMock,
        writable: true
      });
      Object.defineProperty(global, 'window', {
        value: global,
        writable: true
      });
      (global as any).atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
    });

    it('should return true if token is valid and not expired', () => {
      const validToken = {
        walletAddress: testWalletAddress,
        publicKey: testWalletAddress,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000
      };
      const payload = Buffer.from(JSON.stringify(validToken)).toString('base64');
      const jwt = `header.${payload}`;
      (localStorage.getItem as jest.Mock).mockReturnValue(jwt);

      const isValid = AuthService.isSessionTokenValid();
      expect(isValid).toBe(true);
    });

    it('should return false if no token exists', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(null);

      const isValid = AuthService.isSessionTokenValid();
      expect(isValid).toBe(false);
    });

    it('should return false if token is expired', () => {
      const expiredToken = {
        walletAddress: testWalletAddress,
        publicKey: testWalletAddress,
        issuedAt: Date.now() - 7200000,
        expiresAt: Date.now() - 1000
      };
      const payload = Buffer.from(JSON.stringify(expiredToken)).toString('base64');
      const jwt = `header.${payload}`;
      (localStorage.getItem as jest.Mock).mockReturnValue(jwt);

      const isValid = AuthService.isSessionTokenValid();
      expect(isValid).toBe(false);
    });

    it('should return false if token is invalid format', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue('invalid');

      const isValid = AuthService.isSessionTokenValid();
      expect(isValid).toBe(false);
    });
  });

});
