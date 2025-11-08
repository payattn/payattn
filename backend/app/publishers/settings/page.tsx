'use client';

import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function PublisherSettingsPage() {
  const [walletAddress, setWalletAddress] = useState('');
  const [publisherId, setPublisherId] = useState('pub_001'); // Demo publisher ID
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [currentWallet, setCurrentWallet] = useState<string | null>(null);
  const [validationError, setValidationError] = useState('');

  // Load current wallet address
  useEffect(() => {
    loadCurrentWallet();
  }, []);

  const loadCurrentWallet = async () => {
    try {
      // Fetch from API
      const response = await fetch(`/api/publishers/${publisherId}/wallet`);
      if (response.ok) {
        const data = await response.json();
        if (data.walletAddress) {
          setCurrentWallet(data.walletAddress);
          setWalletAddress(data.walletAddress);
        }
      }
    } catch (err) {
      console.error('Failed to load wallet:', err);
      // Fallback to localStorage for demo
      const stored = localStorage.getItem('publisher_wallet');
      if (stored) {
        setCurrentWallet(stored);
        setWalletAddress(stored);
      }
    }
  };

  const validateSolanaAddress = (address: string): boolean => {
    if (!address || address.trim() === '') {
      setValidationError('Wallet address is required');
      return false;
    }

    try {
      // This will throw if invalid
      new PublicKey(address);
      setValidationError('');
      return true;
    } catch (err) {
      setValidationError('Invalid Solana wallet address');
      return false;
    }
  };

  const handleAddressChange = (value: string) => {
    setWalletAddress(value);
    setSaved(false);
    setError('');
    
    // Validate on change
    if (value.trim()) {
      validateSolanaAddress(value);
    } else {
      setValidationError('');
    }
  };

  const handleSave = async () => {
    setError('');
    setSaved(false);

    // Validate before saving
    if (!validateSolanaAddress(walletAddress)) {
      return;
    }

    setSaving(true);

    try {
      console.log('Saving wallet for publisher:', publisherId);
      console.log('Wallet address:', walletAddress);

      // Save to API
      const response = await fetch(`/api/publishers/${publisherId}/wallet`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ walletAddress }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save wallet address');
      }

      // Also store in localStorage as fallback
      localStorage.setItem('publisher_wallet', walletAddress);
      
      setCurrentWallet(walletAddress);
      setSaved(true);

      // Show success message for 3 seconds
      setTimeout(() => setSaved(false), 3000);

    } catch (err: any) {
      console.error('Failed to save wallet:', err);
      setError(err.message || 'Failed to save wallet address');
    } finally {
      setSaving(false);
    }
  };

  const handleTestWallets = (wallet: 'user' | 'publisher' | 'advertiser') => {
    const testWallets = {
      user: '9kXHUnoYjB7eVUafsKFibrdHJWiYiX26vP7p7QX77nux',
      publisher: 'ELD9PKHo5qwyt3o5agPPMuQLRzidDnR2g4DmJDfH55Z7',
      advertiser: 'AE6uwbubDn9WyXrpzvqU58jfirvqZAxWCZCfDDwW5MMb',
    };
    setWalletAddress(testWallets[wallet]);
    validateSolanaAddress(testWallets[wallet]);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">💼 Publisher Settings</h1>
        <p className="text-muted-foreground">
          Configure your Solana wallet to receive payments from ad impressions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Solana Wallet Address</CardTitle>
          <CardDescription>
            Payments will be sent to this wallet (25% of each impression)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Wallet Display */}
          {currentWallet && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm mb-1">Current Wallet:</div>
                  <div className="font-mono text-xs text-gray-600 break-all">
                    {currentWallet}
                  </div>
                </div>
                {currentWallet === walletAddress && (
                  <span className="text-green-600 text-sm">✓ Saved</span>
                )}
              </div>
            </div>
          )}

          {/* Wallet Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Wallet Address <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              placeholder="ELD9PKHo5qwyt3o5agPPMuQLRzidDnR2g4DmJDfH55Z7"
              value={walletAddress}
              onChange={(e) => handleAddressChange(e.target.value)}
              className={validationError ? 'border-red-500' : ''}
            />
            {validationError && (
              <p className="text-sm text-red-500">{validationError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Paste your Solana wallet address. Supports Phantom, Solflare, and any SPL wallet.
            </p>
          </div>

          {/* Test Wallets */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Quick Fill (Test Wallets):</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleTestWallets('publisher')}
              >
                Publisher Wallet
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleTestWallets('user')}
              >
                User Wallet
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleTestWallets('advertiser')}
              >
                Advertiser Wallet
              </Button>
            </div>
          </div>

          {/* Warning */}
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="space-y-2">
              <div className="font-semibold text-sm">⚠️ Important</div>
              <ul className="text-xs space-y-1 text-gray-600">
                <li>• Verify this address carefully - payments cannot be reversed</li>
                <li>• Make sure you control the private key for this wallet</li>
                <li>• Payments are sent on Solana devnet for demo purposes</li>
                <li>• You will receive 25% of each impression (~$0.0025 in test SOL)</li>
              </ul>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSave}
              disabled={saving || !!validationError || !walletAddress.trim()}
            >
              {saving ? 'Saving...' : 'Save Wallet Address'}
            </Button>
            {saved && (
              <span className="text-green-600 text-sm">✓ Saved successfully</span>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              {error}
            </div>
          )}

          {/* Payment Info */}
          <div className="mt-6 pt-6 border-t space-y-3">
            <h3 className="font-semibold text-sm">Payment Details</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-blue-600">70%</div>
                <div className="text-xs text-muted-foreground">User</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-green-600">25%</div>
                <div className="text-xs text-muted-foreground">Publisher (You)</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-purple-600">5%</div>
                <div className="text-xs text-muted-foreground">Platform</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Settlement occurs automatically when a user views your ad for ≥1 second
            </p>
          </div>

          {/* Solana Explorer Link */}
          {walletAddress && !validationError && (
            <div className="mt-4 pt-4 border-t">
              <a
                href={`https://explorer.solana.com/address/${walletAddress}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                View wallet on Solana Explorer →
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>How Settlement Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex gap-3">
            <div className="text-2xl">1️⃣</div>
            <div>
              <div className="font-semibold">User Views Ad</div>
              <div className="text-muted-foreground">
                User views ad on your site for at least 1 second
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="text-2xl">2️⃣</div>
            <div>
              <div className="font-semibold">SDK Reports Impression</div>
              <div className="text-muted-foreground">
                Publisher SDK sends impression event to backend
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="text-2xl">3️⃣</div>
            <div>
              <div className="font-semibold">Privacy-Preserving Settlement</div>
              <div className="text-muted-foreground">
                3 separate, unlinked transactions sent with random delays (0-5s)
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="text-2xl">4️⃣</div>
            <div>
              <div className="font-semibold">Payment Arrives</div>
              <div className="text-muted-foreground">
                SOL arrives in your wallet within seconds (devnet for demo)
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
