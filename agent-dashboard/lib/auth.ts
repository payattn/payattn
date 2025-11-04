import { PublicKey } from '@solana/web3.js';
import * as nacl from 'tweetnacl';
import bs58 from 'bs58';
import { hashSignature, fetchKeyMaterial } from './crypto-pure';

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
  keyHash?: string; // SHA-256 hash of wallet address for KDS
  authToken?: string; // Base64 encoded signature for KDS authentication
  keyMaterial?: string; // Fetched from KDS endpoint (cached in session)
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
   * Message format must match what the KDS server expects for signature verification
   */
  static generateChallenge(): AuthChallenge {
    const timestamp = Date.now();
    const nonce = this.generateNonce();
    
    // Note: The actual message signed will be set when we have the wallet address
    // This is a placeholder - real message is generated in requestSignature
    const message = `Sign in to Pay Attention\n\nWallet: [will be set]`;

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
    challenge: AuthChallenge,
    walletAddress: string
  ): Promise<Uint8Array> {
    if (!wallet.signMessage) {
      throw new Error('Wallet does not support message signing');
    }

    try {
      // Use consistent message format that matches KDS server verification
      const message = `Sign in to Pay Attention\n\nWallet: ${walletAddress}`;
      const encodedMessage = new TextEncoder().encode(message);
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
   * Message format must match what was signed and what KDS server expects
   */
  static verifySignature(
    publicKey: PublicKey,
    signature: Uint8Array,
    walletAddress: string
  ): boolean {
    try {
      // Use consistent message format
      const message = `Sign in to Pay Attention\n\nWallet: ${walletAddress}`;
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
   * Uses wallet address as deterministic key (not signature)
   * Signature is only for proving ownership
   */
  static async createSession(publicKey: string, signature: Uint8Array): Promise<AuthSession> {
    const now = Date.now();
    
    // Compute DETERMINISTIC key hash from wallet address (not signature!)
    // This ensures same wallet always gets same keyHash
    const keyHash = await this.computeKeyHashFromWallet(publicKey);
    
    // Store signature as base64 auth token for KDS authentication
    const authToken = this.encodeSignature(signature);
    
    // Fetch key material from KDS endpoint
    let keyMaterial: string | undefined;
    try {
      keyMaterial = await fetchKeyMaterial(keyHash, publicKey, authToken);
    } catch (error) {
      console.error('Failed to fetch key material during session creation:', error);
      // Continue without key material - will be fetched when needed
    }
    
    const session: AuthSession = {
      publicKey,
      authenticated: true,
      timestamp: now,
      expiresAt: now + SESSION_DURATION,
      keyHash,
      authToken,
      keyMaterial, // Cached for session duration
    };

    // Store session in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    }

    return session;
  }
  
  /**
   * Compute deterministic keyHash from wallet address
   * Same wallet = same keyHash every time
   */
  private static async computeKeyHashFromWallet(publicKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(`payattn:${publicKey}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }
  
  /**
   * Encode signature as base64 for storage and transport
   */
  private static encodeSignature(signature: Uint8Array): string {
    return btoa(String.fromCharCode(...signature));
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
   * Get key material from session (cached) or fetch from KDS
   */
  static async getKeyMaterial(session: AuthSession): Promise<string> {
    // Return cached material if available
    if (session.keyMaterial) {
      return session.keyMaterial;
    }
    
    // Fetch from KDS if we have keyHash and authToken
    if (session.keyHash && session.authToken) {
      const material = await fetchKeyMaterial(
        session.keyHash, 
        session.publicKey, 
        session.authToken
      );
      
      // Cache in session
      session.keyMaterial = material;
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
      }
      
      return material;
    }
    
    throw new Error('No authentication available in session');
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
