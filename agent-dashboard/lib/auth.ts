import { PublicKey } from '@solana/web3.js';
import * as nacl from 'tweetnacl';
import bs58 from 'bs58';

export interface AuthChallenge {
  message: string;
  timestamp: number;
  nonce: string;
}

export interface AuthSession {
  publicKey: string;
  authenticated: boolean;
  timestamp: number;
  expiresAt: number;
}

export interface SessionToken {
  walletAddress: string;
  publicKey: string;
  issuedAt: number;
  expiresAt: number;
}

const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const CHALLENGE_VALIDITY = 5 * 60 * 1000; // 5 minutes

export class AuthService {
  private static SESSION_KEY = 'payattn_auth_session';
  private static JWT_SESSION_KEY = 'payattn_session';

  /**
   * Generate an authentication challenge for the user to sign
   */
  static generateChallenge(): AuthChallenge {
    const timestamp = Date.now();
    const nonce = this.generateNonce();
    const message = `Sign this message to authenticate with payattn.org\n\nTimestamp: ${timestamp}\nNonce: ${nonce}`;

    return {
      message,
      timestamp,
      nonce,
    };
  }

  /**
   * Request wallet signature for authentication challenge
   * Throws error if user cancels/rejects signature request
   */
  static async requestSignature(
    wallet: any,
    challenge: AuthChallenge
  ): Promise<Uint8Array> {
    if (!wallet.signMessage) {
      throw new Error('Wallet does not support message signing');
    }

    try {
      const encodedMessage = new TextEncoder().encode(challenge.message);
      const signature = await wallet.signMessage(encodedMessage);
      return signature;
    } catch (error: any) {
      // User cancelled/rejected the signature request
      console.log('Signature request cancelled by user');
      throw new Error('Signature request cancelled');
    }
  }

  /**
   * Verify the signature matches the public key
   */
  static verifySignature(
    publicKey: PublicKey,
    signature: Uint8Array,
    message: string
  ): boolean {
    try {
      const encodedMessage = new TextEncoder().encode(message);
      const publicKeyBytes = publicKey.toBytes();

      return nacl.sign.detached.verify(
        encodedMessage,
        signature,
        publicKeyBytes
      );
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Create an authenticated session after successful verification
   */
  static createSession(publicKey: string): AuthSession {
    const now = Date.now();
    const session: AuthSession = {
      publicKey,
      authenticated: true,
      timestamp: now,
      expiresAt: now + SESSION_DURATION,
    };

    // Store session in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    }

    return session;
  }

  /**
   * Get current session from storage
   */
  static getSession(): AuthSession | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const stored = localStorage.getItem(this.SESSION_KEY);
    if (!stored) {
      return null;
    }

    try {
      const session: AuthSession = JSON.parse(stored);

      // Check if session is expired
      if (Date.now() > session.expiresAt) {
        this.clearSession();
        return null;
      }

      return session;
    } catch (error) {
      console.error('Failed to parse session:', error);
      return null;
    }
  }

  /**
   * Clear the current session
   */
  static clearSession(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.SESSION_KEY);
    }
  }

  /**
   * Check if session is valid and not expired
   */
  static isSessionValid(session: AuthSession | null): boolean {
    if (!session) {
      return false;
    }

    return session.authenticated && Date.now() < session.expiresAt;
  }

  /**
   * Refresh session expiry time
   */
  static refreshSession(): AuthSession | null {
    const session = this.getSession();
    if (!session || !this.isSessionValid(session)) {
      return null;
    }

    session.expiresAt = Date.now() + SESSION_DURATION;

    if (typeof window !== 'undefined') {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    }

    return session;
  }

  /**
   * Generate a random nonce for challenge
   */
  private static generateNonce(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join(
      ''
    );
  }

  /**
   * Validate challenge is not expired
   */
  static isChallengeValid(challenge: AuthChallenge): boolean {
    return Date.now() - challenge.timestamp < CHALLENGE_VALIDITY;
  }

  /**
   * Generate JWT session token (simplified JWT implementation)
   * For MVP: Using base64-encoded JSON without cryptographic signature
   * Production should use proper JWT library with signature verification
   */
  static createSessionToken(walletAddress: string, publicKey: string): string {
    const now = Date.now();
    const token: SessionToken = {
      walletAddress,
      publicKey,
      issuedAt: now,
      expiresAt: now + SESSION_DURATION,
    };

    // Simple JWT format: header.payload (no signature for MVP)
    const header = { alg: 'none', typ: 'JWT' };
    const headerEncoded = btoa(JSON.stringify(header));
    const payloadEncoded = btoa(JSON.stringify(token));
    const jwt = `${headerEncoded}.${payloadEncoded}`;

    // Store in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.JWT_SESSION_KEY, jwt);
    }

    return jwt;
  }

  /**
   * Get and validate current session token
   * Returns null if token is invalid or expired
   */
  static getSessionToken(): SessionToken | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const jwt = localStorage.getItem(this.JWT_SESSION_KEY);
    if (!jwt) {
      return null;
    }

    try {
      // Parse JWT (header.payload)
      const parts = jwt.split('.');
      if (parts.length !== 2) {
        this.clearSessionToken();
        return null;
      }

      const payloadEncoded = parts[1];
      if (!payloadEncoded) {
        this.clearSessionToken();
        return null;
      }

      const payload = JSON.parse(atob(payloadEncoded));
      const token: SessionToken = payload;

      // Validate expiration
      if (Date.now() > token.expiresAt) {
        this.clearSessionToken();
        return null;
      }

      return token;
    } catch (error) {
      console.error('Failed to parse session token:', error);
      this.clearSessionToken();
      return null;
    }
  }

  /**
   * Clear session token (logout)
   */
  static clearSessionToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.JWT_SESSION_KEY);
    }
  }

  /**
   * Check if session token is valid and not expired
   */
  static isSessionTokenValid(): boolean {
    const token = this.getSessionToken();
    return token !== null && Date.now() < token.expiresAt;
  }
}
