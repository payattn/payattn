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
    <div className="flex min-h-screen items-center justify-center p-4" style={{ background: '#000A30' }}>
      <main className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <img 
            src="/payattn_logo_bar01_700x140_trans.png" 
            alt="PayAttn" 
            className="mx-auto h-16 w-auto"
          />
          <p className="text-gray-300">
            Connect your Solana wallet to get started
          </p>
        </div>

        {/* Wallet Connection Card */}
        <Card style={{ background: '#1a1f3a', borderColor: '#334155' }}>
          <CardHeader>
            <CardTitle style={{ color: '#FFD100' }}>Wallet Connection</CardTitle>
            <CardDescription style={{ color: '#94a3b8' }}>
              Connect your Phantom or Solflare wallet
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium" style={{ color: '#e2e8f0' }}>Status</p>
                <p className="text-sm" style={{ color: '#94a3b8' }}>
                  {connected ? 'Connected' : 'Not connected'}
                </p>
              </div>
              <WalletButton />
            </div>

            {connected && publicKey && (
              <div className="space-y-1 pt-4 border-t" style={{ borderColor: '#334155' }}>
                <p className="text-sm font-medium" style={{ color: '#e2e8f0' }}>Wallet Address</p>
                <p className="text-xs font-mono p-2 rounded break-all" style={{ background: '#0f172a', color: '#94a3b8' }}>
                  {publicKey.toBase58()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Authentication Card */}
        {connected && (
          <Card style={{ background: '#1a1f3a', borderColor: '#334155' }}>
            <CardHeader>
              <CardTitle style={{ color: '#FFD100' }}>Authentication</CardTitle>
              <CardDescription style={{ color: '#94a3b8' }}>
                Sign a message to authenticate with PayAttn
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium" style={{ color: '#e2e8f0' }}>Auth Status</p>
                  <p className="text-sm" style={{ color: '#94a3b8' }}>
                    {isAuthenticated ? 'Authenticated' : 'Not authenticated'}
                  </p>
                </div>
                {!isAuthenticated && (
                  <Button
                    onClick={authenticate}
                    disabled={isAuthenticating || !connected}
                    style={{ background: '#FFD100', color: '#000A30' }}
                    className="hover:opacity-90"
                  >
                    {isAuthenticating ? 'Authenticating...' : 'Sign Message'}
                  </Button>
                )}
              </div>

              {error && (
                <div className="text-sm p-3 rounded" style={{ background: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b' }}>
                  {error}
                </div>
              )}

              {isAuthenticated && session && (
                <div className="space-y-3 pt-4 border-t" style={{ borderColor: '#334155' }}>
                  <div className="space-y-1">
                    <p className="text-sm font-medium" style={{ color: '#e2e8f0' }}>Session Expires</p>
                    <p className="text-xs" style={{ color: '#94a3b8' }}>
                      {new Date(session.expiresAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-sm p-3 rounded" style={{ background: '#064e3b', color: '#6ee7b7', border: '1px solid #065f46' }}>
                     Successfully authenticated with wallet signature
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card style={{ background: '#1a1f3a', borderColor: '#334155' }}>
          <CardHeader>
            <CardTitle style={{ color: '#FFD100' }}>How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm" style={{ color: '#94a3b8' }}>
            <p>
              <strong style={{ color: '#e2e8f0' }}>1. Connect Wallet:</strong> Click
              the button to connect your Phantom or Solflare wallet.
            </p>
            <p>
              <strong style={{ color: '#e2e8f0' }}>2. Sign Message:</strong> Authenticate
              by signing a challenge message with your wallet.
            </p>
            <p>
              <strong style={{ color: '#e2e8f0' }}>3. Verified Session:</strong> Your
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
