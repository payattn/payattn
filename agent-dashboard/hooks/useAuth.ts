'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useState, useEffect, useCallback } from 'react';
import { AuthService, AuthSession } from '@/lib/auth';

export function useAuth() {
  const { publicKey, wallet, connected, disconnect } = useWallet();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing session on mount
  useEffect(() => {
    const existingSession = AuthService.getSession();
    if (existingSession && AuthService.isSessionValid(existingSession)) {
      setSession(existingSession);
    }
  }, []);

  // Authenticate when wallet connects
  const authenticate = useCallback(async () => {
    if (!publicKey || !wallet?.adapter || !connected) {
      setError('Wallet not connected');
      return false;
    }

    setIsAuthenticating(true);
    setError(null);

    try {
      // Generate challenge
      const challenge = AuthService.generateChallenge();

      // Check if challenge is valid
      if (!AuthService.isChallengeValid(challenge)) {
        throw new Error('Challenge expired');
      }

      // Request signature from wallet
      const signature = await AuthService.requestSignature(
        wallet.adapter,
        challenge
      );

      // Verify signature
      const isValid = AuthService.verifySignature(
        publicKey,
        signature,
        challenge.message
      );

      if (!isValid) {
        throw new Error('Signature verification failed');
      }

      // Create authenticated session
      const newSession = AuthService.createSession(publicKey.toBase58());
      setSession(newSession);

      return true;
    } catch (err: any) {
      // Check if user cancelled the signature request
      const isCancelled = err?.message?.includes('cancelled') || 
                          err?.message?.includes('rejected') ||
                          err?.message?.includes('User rejected');
      
      const errorMessage = isCancelled 
        ? 'Signature request cancelled'
        : (err instanceof Error ? err.message : 'Authentication failed');
      
      setError(errorMessage);
      
      // Only log non-cancellation errors
      if (!isCancelled) {
        console.error('Authentication error:', err);
      } else {
        console.log('User cancelled authentication');
      }
      
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  }, [publicKey, wallet, connected]);

  // Clear session on disconnect
  const clearAuth = useCallback(() => {
    AuthService.clearSession();
    setSession(null);
    setError(null);
  }, []);

  // Auto-clear session when wallet disconnects
  useEffect(() => {
    if (!connected) {
      clearAuth();
    }
  }, [connected, clearAuth]);

  // Check if user is authenticated
  const isAuthenticated =
    session !== null &&
    AuthService.isSessionValid(session) &&
    connected &&
    publicKey?.toBase58() === session.publicKey;

  // Refresh session periodically
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      const refreshed = AuthService.refreshSession();
      if (refreshed) {
        setSession(refreshed);
      } else {
        clearAuth();
      }
    }, 60 * 60 * 1000); // Refresh every hour

    return () => clearInterval(interval);
  }, [isAuthenticated, clearAuth]);

  return {
    session,
    isAuthenticated,
    isAuthenticating,
    error,
    authenticate,
    clearAuth,
  };
}
