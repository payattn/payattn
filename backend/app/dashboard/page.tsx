'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useAuth } from '@/hooks/useAuth';
import { WalletButton } from '@/components/WalletButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardPage() {
  const { connected, publicKey } = useWallet();
  const { isAuthenticated, session } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black">
      {/* Header */}
      <header className="border-b bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">🎯 PayAttn Dashboard</h1>
          </div>
          <WalletButton />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {!connected ? (
          <Card>
            <CardHeader>
              <CardTitle>Connect Your Wallet</CardTitle>
              <CardDescription>
                Connect your wallet to view your ad performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Please connect your Phantom or Solflare wallet to access your dashboard.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Wallet Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>👛 Wallet Overview</CardTitle>
                <CardDescription>Your connected wallet and session status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Status</span>
                  <span className={`text-sm ${isAuthenticated ? 'text-green-600' : 'text-yellow-600'}`}>
                    {isAuthenticated ? '✅ Authenticated' : '⚠️ Not authenticated'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Wallet</span>
                  <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                    {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
                  </span>
                </div>
                {session && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Session Expires</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(session.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Ad Performance Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Ads Viewed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    No ads processed yet
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Ads Clicked
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click-through rate: 0%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Earnings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">$0.00</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Lifetime earnings
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>📊 Recent Activity</CardTitle>
                <CardDescription>Your recent ad interactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">No activity yet</p>
                  <p className="text-xs mt-2">
                    Install the PayAttn extension to start earning from ads
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Advertiser Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>🏢 Top Advertisers</CardTitle>
                <CardDescription>Ads by advertiser</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">No data available</p>
                  <p className="text-xs mt-2">
                    Start viewing ads to see advertiser breakdown
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
