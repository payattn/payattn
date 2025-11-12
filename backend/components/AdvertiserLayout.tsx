'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface AdvertiserData {
  advertiser_id: string;
  name: string;
  created_at: string;
}

interface AdvertiserLayoutProps {
  children: (advertiserData: AdvertiserData) => React.ReactNode;
}

export default function AdvertiserLayout({ children }: AdvertiserLayoutProps) {
  const { publicKey, connected, connecting } = useWallet();
  const router = useRouter();
  const [advertiserData, setAdvertiserData] = useState<AdvertiserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [advertiserName, setAdvertiserName] = useState('');
  const [creatingProfile, setCreatingProfile] = useState(false);

  // Fetch advertiser profile when wallet connects
  useEffect(() => {
    if (!connected || !publicKey) {
      setLoading(false);
      setAdvertiserData(null);
      return;
    }

    fetchAdvertiserProfile();
  }, [connected, publicKey]);

  const fetchAdvertiserProfile = async () => {
    if (!publicKey) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/advertiser/profile', {
        headers: {
          'x-wallet-address': publicKey.toBase58()
        }
      });

      const data = await response.json();

      if (response.status === 404) {
        // Advertiser not found - show onboarding
        setShowOnboarding(true);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch profile');
      }

      if (data.exists && data.advertiser) {
        setAdvertiserData(data.advertiser);
        setShowOnboarding(false);
      }

    } catch (err) {
      console.error('Error fetching advertiser:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey || !advertiserName.trim()) return;

    setCreatingProfile(true);
    setError('');

    try {
      const response = await fetch('/api/advertiser/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          wallet_address: publicKey.toBase58(),
          name: advertiserName.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create profile');
      }

      if (data.success && data.advertiser) {
        setAdvertiserData(data.advertiser);
        setShowOnboarding(false);
      }

    } catch (err) {
      console.error('Error creating profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setCreatingProfile(false);
    }
  };

  // Show wallet connection screen
  if (!connected && !connecting) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#000A30' }}>
        <div className="max-w-md w-full rounded-2xl shadow-xl p-8" style={{ background: '#1a1f3a', borderColor: '#334155' }}>
          <div className="text-center">
            <img 
              src="/payattn_logo_bar01_700x140_trans.png" 
              alt="PayAttn" 
              className="mx-auto h-12 w-auto mb-6"
            />
            <h1 className="text-3xl font-bold mb-3" style={{ color: '#FFD100' }}>
              Advertiser Dashboard
            </h1>
            <p className="mb-8" style={{ color: '#94a3b8' }}>
              Connect your Solana wallet to access your advertiser account and manage campaigns
            </p>
            <div className="flex justify-center">
              <WalletMultiButton style={{ background: '#FFD100', color: '#000A30' }} />
            </div>
            <p className="text-sm mt-6" style={{ color: '#94a3b8' }}>
               Your wallet address is your advertiser ID
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (connecting || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#000A30' }}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 mb-4" style={{ borderColor: '#FFD100' }}></div>
          <p style={{ color: '#94a3b8' }}>Loading advertiser profile...</p>
        </div>
      </div>
    );
  }

  // Show onboarding form
  if (showOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#000A30' }}>
        <div className="max-w-md w-full rounded-2xl shadow-xl p-8" style={{ background: '#1a1f3a' }}>
          <div className="text-center mb-8">
            <img 
              src="/payattn_logo_bar01_700x140_trans.png" 
              alt="PayAttn" 
              className="mx-auto h-12 w-auto mb-6"
            />
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#FFD100' }}>
              Welcome to PayAttn!
            </h2>
            <p className="mb-1" style={{ color: '#94a3b8' }}>
              Create your advertiser profile to get started
            </p>
            <p className="text-xs font-mono px-3 py-2 rounded mt-3 break-all" style={{ color: '#94a3b8', background: '#0f172a' }}>
              {publicKey?.toBase58()}
            </p>
          </div>

          <form onSubmit={handleCreateProfile} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#e2e8f0' }}>
                Advertiser Name *
              </label>
              <input
                type="text"
                value={advertiserName}
                onChange={(e) => setAdvertiserName(e.target.value)}
                placeholder="e.g., Acme Corp Marketing"
                required
                className="w-full px-4 py-3 border rounded-lg focus:ring-2"
                style={{ background: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }}
              />
              <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
                This name will appear on your dashboard
              </p>
            </div>

            {error && (
              <div className="p-3 border rounded-lg" style={{ background: '#7f1d1d', borderColor: '#991b1b' }}>
                <p className="text-sm" style={{ color: '#fca5a5' }}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={creatingProfile || !advertiserName.trim()}
              className="w-full py-3 px-4 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ background: '#FFD100', color: '#000A30' }}
            >
              {creatingProfile ? 'Creating Profile...' : 'Create Profile'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !advertiserData) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#000A30' }}>
        <div className="max-w-md w-full rounded-lg shadow-lg p-8" style={{ background: '#1a1f3a' }}>
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: '#7f1d1d' }}>
              <svg className="w-8 h-8" fill="none" stroke="#fca5a5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: '#FFD100' }}>
              Error Loading Profile
            </h2>
            <p className="mb-6" style={{ color: '#94a3b8' }}>{error}</p>
            <button
              onClick={fetchAdvertiserProfile}
              className="py-2 px-6 rounded-lg font-semibold hover:opacity-90"
              style={{ background: '#FFD100', color: '#000A30' }}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render children with advertiser data
  if (!advertiserData) return null;

  return (
    <div className="min-h-screen" style={{ background: '#000A30' }}>
      {/* Header with wallet */}
      <div className="border-b" style={{ background: '#1a1f3a', borderColor: '#334155' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <img 
                src="/payattn_logo_bar01_700x140_trans.png" 
                alt="PayAttn" 
                className="h-8 w-auto"
              />
              <span className="text-sm" style={{ color: '#94a3b8' }}>|</span>
              <span className="text-lg font-semibold" style={{ color: '#FFD100' }}>
                {advertiserData.name}
              </span>
            </div>
            <WalletMultiButton style={{ background: '#FFD100', color: '#000A30' }} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div>
        {children(advertiserData)}
      </div>
    </div>
  );
}
