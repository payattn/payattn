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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Advertiser Dashboard
            </h1>
            <p className="text-gray-600 mb-8">
              Connect your Solana wallet to access your advertiser account and manage campaigns
            </p>
            <div className="flex justify-center">
              <WalletMultiButton className="!bg-blue-600 hover:!bg-blue-700" />
            </div>
            <p className="text-sm text-gray-500 mt-6">
              💡 Your wallet address is your advertiser ID
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (connecting || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading advertiser profile...</p>
        </div>
      </div>
    );
  }

  // Show onboarding form
  if (showOnboarding) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome to PayAttn!
            </h2>
            <p className="text-gray-600 mb-1">
              Create your advertiser profile to get started
            </p>
            <p className="text-xs text-gray-500 font-mono bg-gray-100 px-3 py-2 rounded mt-3 break-all">
              {publicKey?.toBase58()}
            </p>
          </div>

          <form onSubmit={handleCreateProfile} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Advertiser Name *
              </label>
              <input
                type="text"
                value={advertiserName}
                onChange={(e) => setAdvertiserName(e.target.value)}
                placeholder="e.g., Acme Corp Marketing"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                This name will appear on your dashboard
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={creatingProfile || !advertiserName.trim()}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Error Loading Profile
            </h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={fetchAdvertiserProfile}
              className="bg-blue-600 text-white py-2 px-6 rounded-lg font-semibold hover:bg-blue-700"
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
    <div className="min-h-screen bg-gray-50">
      {/* Header with wallet */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">
                PayAttn Advertiser
              </h1>
              <span className="text-sm text-gray-500">|</span>
              <span className="text-lg font-semibold text-blue-600">
                {advertiserData.name}
              </span>
            </div>
            <WalletMultiButton className="!bg-blue-600 hover:!bg-blue-700" />
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
