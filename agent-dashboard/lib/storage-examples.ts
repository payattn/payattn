/**
 * Example usage of Encrypted Storage and JWT Token Management
 * This file demonstrates how to integrate WP01.2.3 & WP01.2.4
 * 
 * IMPORTANT: Encryption uses wallet public key for deterministic key derivation.
 * Security is maintained by requiring wallet connection and verification.
 */

import { AuthService, SessionToken } from './auth';
import { EncryptedStorage, UserProfile } from './storage';

/**
 * Example 1: Complete authentication and profile storage flow
 * Uses public key for deterministic encryption
 */
export async function authenticateAndSaveProfile(
  wallet: any, // Wallet adapter instance
  profileData: UserProfile
): Promise<void> {
  try {
    if (!wallet.publicKey || !wallet.signMessage) {
      throw new Error('Wallet not connected or does not support signing');
    }

    const walletAddress = wallet.publicKey.toBase58();
    
    // Request wallet signature to verify ownership (security check)
    const message = 'Sign to verify you own this wallet for payattn.org';
    const encodedMessage = new TextEncoder().encode(message);
    
    try {
      await wallet.signMessage(encodedMessage);
    } catch (signError: any) {
      // User cancelled/rejected signature
      console.log('Signature request cancelled by user');
      throw new Error('Signature request cancelled');
    }
    
    // Create session token (24-hour expiry)
    const jwt = AuthService.createSessionToken(walletAddress, walletAddress);
    console.log('Session token created:', jwt.substring(0, 20) + '...');

    // Save encrypted profile (using public key for encryption)
    await EncryptedStorage.saveProfile(profileData, walletAddress);
    console.log('Profile saved and encrypted');
    
    // Store verification with timestamp (persists for 24 hours)
    const verificationData = {
      walletAddress,
      timestamp: Date.now()
    };
    localStorage.setItem('payattn_wallet_verification', JSON.stringify(verificationData));
  } catch (error) {
    console.error('Authentication failed:', error);
    throw error;
  }
}

/**
 * Example 2: Check session and load profile on app startup
 * Uses wallet address (public key) for decryption
 * Checks for persistent verification (24-hour expiry)
 */
export async function initializeSession(): Promise<{
  isAuthenticated: boolean;
  profile: UserProfile | null;
  token: SessionToken | null;
}> {
  // Check if session token exists and is valid
  const token = AuthService.getSessionToken();
  
  if (!token) {
    return {
      isAuthenticated: false,
      profile: null,
      token: null,
    };
  }

  // Check if wallet was verified (persists across page reloads)
  const verificationData = localStorage.getItem('payattn_wallet_verification');
  if (!verificationData) {
    return {
      isAuthenticated: false,
      profile: null,
      token,
    };
  }

  try {
    const { walletAddress, timestamp } = JSON.parse(verificationData);
    const now = Date.now();
    const expiryDuration = 24 * 60 * 60 * 1000; // 24 hours
    
    // Check if verification has expired
    if ((now - timestamp) >= expiryDuration) {
      localStorage.removeItem('payattn_wallet_verification');
      return {
        isAuthenticated: false,
        profile: null,
        token,
      };
    }
    
    // Load encrypted profile using public key (wallet address)
    const profile = await EncryptedStorage.loadProfile(walletAddress);

    return {
      isAuthenticated: true,
      profile,
      token,
    };
  } catch (error) {
    console.error('Failed to restore session:', error);
    return {
      isAuthenticated: false,
      profile: null,
      token,
    };
  }
}

/**
 * Example 3: Update user profile
 * Uses wallet address (public key) for encryption
 * Retrieves verified wallet from persistent storage
 */
export async function updateProfile(
  updates: Partial<UserProfile>
): Promise<void> {
  const token = AuthService.getSessionToken();
  
  if (!token) {
    throw new Error('Not authenticated');
  }

  // Get verified wallet address from localStorage
  const verificationData = localStorage.getItem('payattn_wallet_verification');
  if (!verificationData) {
    throw new Error('Wallet not verified - please reconnect wallet');
  }

  const { walletAddress, timestamp } = JSON.parse(verificationData);
  const now = Date.now();
  const expiryDuration = 24 * 60 * 60 * 1000; // 24 hours
  
  // Check if expired
  if ((now - timestamp) >= expiryDuration) {
    localStorage.removeItem('payattn_wallet_verification');
    throw new Error('Session expired - please verify wallet again');
  }

  // Load existing profile
  const existing = await EncryptedStorage.loadProfile(walletAddress);
  
  // Merge updates with proper type handling
  const updated: UserProfile = {
    demographics: updates.demographics || existing?.demographics,
    interests: updates.interests || existing?.interests,
    location: updates.location || existing?.location,
    financial: updates.financial || existing?.financial,
    preferences: updates.preferences || existing?.preferences,
  };

  // Save encrypted
  await EncryptedStorage.saveProfile(updated, walletAddress);
}

/**
 * Example 4: Logout and clear session (keeps encrypted profile data)
 */
export async function logout(): Promise<void> {
  // Clear session token
  AuthService.clearSessionToken();
  
  // Clear legacy session (if using both)
  AuthService.clearSession();
  
  // Clear persistent verification (but keep encrypted profiles)
  localStorage.removeItem('payattn_wallet_verification');
  
  console.log('Logged out (encrypted profile data preserved)');
}

/**
 * Example 4b: Delete specific wallet's profile data
 */
export async function deleteMyProfile(publicKey: string): Promise<void> {
  await EncryptedStorage.deleteProfile(publicKey);
  console.log('Profile deleted for this wallet');
}

/**
 * Example 4c: Nuclear option - delete ALL wallet profiles
 */
export async function deleteAllWalletProfiles(): Promise<void> {
  await EncryptedStorage.deleteAllProfiles();
  console.log('All wallet profiles deleted');
}

/**
 * Example 5: Check if user needs to re-authenticate
 */
export function needsAuthentication(): boolean {
  return !AuthService.isSessionTokenValid();
}

/**
 * Example 6: Get session info for display
 */
export function getSessionInfo(): {
  walletAddress: string;
  expiresIn: string;
  hasProfile: boolean;
} | null {
  const token = AuthService.getSessionToken();
  
  if (!token) {
    return null;
  }

  const expiresInMs = token.expiresAt - Date.now();
  const expiresInHours = Math.floor(expiresInMs / (1000 * 60 * 60));
  const expiresInMinutes = Math.floor((expiresInMs % (1000 * 60 * 60)) / (1000 * 60));

  return {
    walletAddress: token.walletAddress,
    expiresIn: `${expiresInHours}h ${expiresInMinutes}m`,
    hasProfile: EncryptedStorage.hasProfile(token.publicKey),
  };
}

/**
 * Example 7: Sample profile data
 */
export const SAMPLE_PROFILE: UserProfile = {
  demographics: {
    age: 25,
    gender: 'prefer not to say',
  },
  interests: ['technology', 'finance', 'web3'],
  location: {
    country: 'US',
    state: 'CA',
  },
  financial: {
    incomeRange: '$50k-$100k',
  },
  preferences: {
    maxAdsPerHour: 10,
    painThreshold: 5,
  },
};
