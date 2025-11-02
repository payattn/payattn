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

const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const CHALLENGE_VALIDITY = 5 * 60 * 1000; // 5 minutes

export class AuthService {
  private static SESSION_KEY = 'payattn_auth_session';

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
   */
  static async requestSignature(
    wallet: any,
    challenge: AuthChallenge
  ): Promise<Uint8Array> {
    if (!wallet.signMessage) {
      throw new Error('Wallet does not support message signing');
    }

    const encodedMessage = new TextEncoder().encode(challenge.message);
    const signature = await wallet.signMessage(encodedMessage);

    return signature;
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
}
