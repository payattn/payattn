'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useState, useEffect, useCallback } from 'react';
import { AuthService, AuthSession } from '@/lib/auth';
import { syncAuthToExtension } from '@/lib/extension-sync';

export function useAuth() {
  const { publicKey, wallet, connected, connecting, disconnect } = useWallet();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  // Load existing session on mount
  useEffect(() => {
    const existingSession = AuthService.getSession();
    if (existingSession && AuthService.isSessionValid(existingSession)) {
      setSession(existingSession);
      
      // Sync existing session to extension if available
      if (existingSession.keyHash && existingSession.authToken) {
        syncAuthToExtension(existingSession.keyHash, existingSession.publicKey, existingSession.authToken).catch(err => {
          console.log('[useAuth] Could not sync existing session to extension:', err);
        });
      }
    }
    // Wait a bit for wallet to potentially auto-connect
    const timer = setTimeout(() => setIsRestoringSession(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Once wallet connects with valid session, mark restoration complete
  useEffect(() => {
    if (connected && session && publicKey?.toBase58() === session.publicKey) {
      setIsRestoringSession(false);
    }
  }, [connected, session, publicKey]);

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

      const walletAddress = publicKey.toBase58();

      // Request signature from wallet (with wallet address for consistent message)
      const signature = await AuthService.requestSignature(
        wallet.adapter,
        challenge,
        walletAddress
      );

      // Verify signature (with wallet address for consistent message)
      const isValid = AuthService.verifySignature(
        publicKey,
        signature,
        walletAddress
      );

      if (!isValid) {
        throw new Error('Signature verification failed');
      }

      // Create authenticated session with signature for KDS
      const newSession = await AuthService.createSession(walletAddress, signature);
      setSession(newSession);

      // Sync keyHash and authToken to extension if installed
      if (newSession.keyHash && newSession.authToken) {
        await syncAuthToExtension(newSession.keyHash, publicKey.toBase58(), newSession.authToken);
      }

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
    
    // Sync disconnect to extension
    syncAuthToExtension('', '').catch(err => {
      console.log('[useAuth] Could not sync disconnect to extension:', err);
    });
  }, []);

  // Auto-clear session only when explicitly disconnected (not during initial load)
  useEffect(() => {
    if (!connected && !connecting && !isRestoringSession) {
      clearAuth();
    }
  }, [connected, connecting, isRestoringSession, clearAuth]);

  // Check if user is authenticated
  // During session restoration, trust the valid session even if wallet not yet connected
  const isAuthenticated =
    session !== null &&
    AuthService.isSessionValid(session) &&
    (
      (connected && publicKey?.toBase58() === session.publicKey) ||
      (isRestoringSession && publicKey?.toBase58() === session.publicKey) ||
      (connecting && publicKey?.toBase58() === session.publicKey)
    );

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
