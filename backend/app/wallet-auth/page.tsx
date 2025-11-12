'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useAuth } from '@/hooks/useAuth';
import { WalletButton } from '@/components/WalletButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect } from 'react';

export default function WalletAuthPage() {
  const { connected, publicKey } = useWallet();
  const { isAuthenticated, isAuthenticating, error, authenticate, session, clearAuth } = useAuth();

  // Auto-close or show success if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Give user a moment to see success, then they can close the window
      // Don't auto-close as that can be jarring
    }
  }, [isAuthenticated]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-zinc-900 dark:to-black p-4">
      <main className="w-full max-w-md">
        {/* Header */}
        <div className="text-center space-y-2 mb-6">
          <h1 className="text-3xl font-bold tracking-tight">
             Wallet Authentication
          </h1>
          <p className="text-sm text-muted-foreground">
            Securely connect your wallet to use PayAttn
          </p>
        </div>

        {/* Wallet Connection Card */}
        {!isAuthenticated ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-center">
                {!connected ? 'Connect Wallet' : 'Sign Message'}
              </CardTitle>
              <CardDescription className="text-center">
                {!connected 
                  ? 'Connect your Phantom or Solflare wallet' 
                  : 'Sign a message to verify your identity'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!connected ? (
                <div className="flex justify-center">
                  <WalletButton />
                </div>
              ) : (
                <>
                  <div className="space-y-2 p-3 bg-muted rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground">
                      Wallet Address
                    </p>
                    <p className="text-xs font-mono break-all">
                      {publicKey?.toBase58()}
                    </p>
                  </div>
                  
                  <Button
                    onClick={authenticate}
                    disabled={isAuthenticating}
                    className="w-full"
                    size="lg"
                  >
                    {isAuthenticating ? (
                      <>
                        <span className="mr-2"></span>
                        Authenticating...
                      </>
                    ) : (
                      <>
                        <span className="mr-2"></span>
                        Sign Message
                      </>
                    )}
                  </Button>

                  {error && (
                    <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
                      {error}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-green-200 dark:border-green-900">
            <CardHeader>
              <CardTitle className="text-center text-green-600 dark:text-green-400">
                 Authentication Successful!
              </CardTitle>
              <CardDescription className="text-center">
                Your wallet is now connected to PayAttn
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-900">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  Wallet Address
                </p>
                <p className="text-xs font-mono text-green-700 dark:text-green-300 break-all">
                  {publicKey?.toBase58()}
                </p>
                {session && (
                  <p className="text-xs text-green-600 dark:text-green-400 pt-2 border-t border-green-200 dark:border-green-800">
                    Session expires: {new Date(session.expiresAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={clearAuth}
                  className="flex-1"
                >
                  Disconnect
                </Button>
                <Button
                  onClick={() => window.close()}
                  className="flex-1"
                >
                  Close Window
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                You can now close this window and return to the extension
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
