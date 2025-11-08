'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useAuth } from '@/hooks/useAuth';
import { WalletButton } from '@/components/WalletButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  const { connected, publicKey } = useWallet();
  const { isAuthenticated, isAuthenticating, error, authenticate, session } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black p-4">
      <main className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">
            PayAttn Agent Dashboard
          </h1>
          <p className="text-muted-foreground">
            Connect your Solana wallet to get started
          </p>
        </div>

        {/* Wallet Connection Card */}
        <Card>
          <CardHeader>
            <CardTitle>Wallet Connection</CardTitle>
            <CardDescription>
              Connect your Phantom or Solflare wallet
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Status</p>
                <p className="text-sm text-muted-foreground">
                  {connected ? 'Connected' : 'Not connected'}
                </p>
              </div>
              <WalletButton />
            </div>

            {connected && publicKey && (
              <div className="space-y-1 pt-4 border-t">
                <p className="text-sm font-medium">Wallet Address</p>
                <p className="text-xs font-mono bg-muted p-2 rounded break-all">
                  {publicKey.toBase58()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Authentication Card */}
        {connected && (
          <Card>
            <CardHeader>
              <CardTitle>Authentication</CardTitle>
              <CardDescription>
                Sign a message to authenticate with PayAttn
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Auth Status</p>
                  <p className="text-sm text-muted-foreground">
                    {isAuthenticated ? 'Authenticated' : 'Not authenticated'}
                  </p>
                </div>
                {!isAuthenticated && (
                  <Button
                    onClick={authenticate}
                    disabled={isAuthenticating || !connected}
                  >
                    {isAuthenticating ? 'Authenticating...' : 'Sign Message'}
                  </Button>
                )}
              </div>

              {error && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded">
                  {error}
                </div>
              )}

              {isAuthenticated && session && (
                <div className="space-y-3 pt-4 border-t">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Session Expires</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(session.expiresAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-green-500/10 text-green-700 dark:text-green-400 text-sm p-3 rounded">
                    ✓ Successfully authenticated with wallet signature
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">1. Connect Wallet:</strong> Click
              the button to connect your Phantom or Solflare wallet.
            </p>
            <p>
              <strong className="text-foreground">2. Sign Message:</strong> Authenticate
              by signing a challenge message with your wallet.
            </p>
            <p>
              <strong className="text-foreground">3. Verified Session:</strong> Your
              signature proves wallet ownership without exposing your private key.
            </p>
            <p className="pt-2 text-xs">
              Session persists for 24 hours. Your wallet address becomes your account
              identifier on payattn.org.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
