'use client';

import { useState } from 'react';
import { WalletContextProvider } from '@/components/WalletProvider';
import AdvertiserLayout from '@/components/AdvertiserLayout';

const INTEREST_CATEGORIES = [
  'cryptocurrency', 'luxury', 'investment', 'technology', 'finance',
  'music', 'entertainment', 'podcasts', 'streaming',
  'sports', 'fitness', 'health', 'running', 'wellness',
  'fashion', 'travel', 'food', 'gaming', 'education'
];

const INCOME_OPTIONS = [
  { value: 0, label: 'Any income' },
  { value: 25000, label: '$25,000+' },
  { value: 50000, label: '$50,000+' },
  { value: 75000, label: '$75,000+' },
  { value: 100000, label: '$100,000+' }
];

const COUNTRIES = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'NZ', 'IE', 'NL', 'SE', 'NO', 'DK'];

function CreateCampaignForm({ advertiser_id }: { advertiser_id: string }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [createdAdId, setCreatedAdId] = useState('');

  // Form state
  const [campaignName, setCampaignName] = useState('');
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [cta, setCta] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');
  
  // Targeting
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(65);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [minIncome, setMinIncome] = useState(0);
  const [selectedCountries, setSelectedCountries] = useState<string[]>(['US', 'GB']);
  
  // Budget (hidden from UI, use defaults)
  const budgetPerImpression = 10000; // lamports
  const totalBudget = 1000000; // lamports

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else {
      if (selectedInterests.length < 8) {
        setSelectedInterests([...selectedInterests, interest]);
      }
    }
  };

  const toggleCountry = (country: string) => {
    if (selectedCountries.includes(country)) {
      setSelectedCountries(selectedCountries.filter(c => c !== country));
    } else {
      setSelectedCountries([...selectedCountries, country]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      // Build targeting object
      const targeting = {
        age: { min: ageMin, max: ageMax },
        interests: selectedInterests.map(cat => ({ category: cat, weight: 'required' })),
        income: { min: minIncome },
        location: { countries: selectedCountries }
      };

      const response = await fetch('/api/advertiser/create-ad', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-advertiser-id': advertiser_id // Use wallet address from auth
        },
        body: JSON.stringify({
          campaign_name: campaignName || 'Default Campaign',
          headline,
          body,
          cta,
          destination_url: destinationUrl,
          targeting,
          budget_per_impression_lamports: budgetPerImpression,
          total_budget_lamports: totalBudget
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create ad');
      }

      setSuccess(true);
      setCreatedAdId(data.ad_creative_id);
      console.log('✅ Ad created:', data);

    } catch (err: any) {
      setError(err.message);
      console.error('❌ Failed to create ad:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-8" style={{ background: '#000A30' }}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: '#FFD100' }}>Create Ad Campaign</h1>
          <p className="mt-2" style={{ color: '#94a3b8' }}>
            Create a new ad that will be evaluated by Max and shown to matching users
          </p>
        </div>

        {success ? (
          <div className="border rounded-lg p-6 mb-6" style={{ background: '#064e3b', borderColor: '#065f46' }}>
            <h2 className="text-xl font-semibold mb-2" style={{ color: '#6ee7b7' }}>✅ Ad Created Successfully!</h2>
            <p className="mb-4" style={{ color: '#a7f3d0' }}>
              Ad ID: <code className="px-2 py-1 rounded" style={{ background: '#047857' }}>{createdAdId}</code>
            </p>
            <div className="space-y-2 text-sm" style={{ color: '#a7f3d0' }}>
              <p>🔄 <strong>Next steps:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Extension will sync this ad via /api/user/adstream</li>
                <li>Max will evaluate against user profiles</li>
                <li>If targeting matches, Max creates offer with ZK-proofs</li>
                <li>Peggy will fund matching offers</li>
                <li>Publishers can then display this ad</li>
              </ul>
            </div>
            <button
              onClick={() => {
                setSuccess(false);
                setCreatedAdId('');
              }}
              className="mt-4 px-4 py-2 rounded hover:opacity-90"
              style={{ background: '#FFD100', color: '#000A30' }}
            >
              Create Another Ad
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form */}
            <div className="lg:col-span-2">
              <form onSubmit={handleSubmit} className="rounded-lg shadow p-6 space-y-6" style={{ background: '#1a1f3a', borderColor: '#334155' }}>
                {/* Campaign Info */}
                <div>
                  <h2 className="text-xl font-semibold mb-4" style={{ color: '#FFD100' }}>Campaign Details</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: '#e2e8f0' }}>
                        Campaign Name (optional)
                      </label>
                      <input
                        type="text"
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md focus:ring-2"
                        style={{ background: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }}
                        placeholder="Q4 Luxury Campaign"
                      />
                    </div>
                  </div>
                </div>

                {/* Ad Creative */}
                <div>
                  <h2 className="text-xl font-semibold mb-4" style={{ color: '#FFD100' }}>Ad Creative</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: '#e2e8f0' }}>
                        Headline *
                      </label>
                      <input
                        type="text"
                        value={headline}
                        onChange={(e) => setHeadline(e.target.value)}
                        maxLength={100}
                        required
                        className="w-full px-3 py-2 border rounded-md focus:ring-2"
                        style={{ background: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }}
                        placeholder="Get 20% off luxury watches"
                      />
                      <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>{headline.length}/100 characters</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: '#e2e8f0' }}>
                        Body Text *
                      </label>
                      <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        required
                        rows={3}
                        className="w-full px-3 py-2 border rounded-md focus:ring-2"
                        style={{ background: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }}
                        placeholder="Swiss craftsmanship meets digital age. Exclusive offer for crypto enthusiasts."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: '#e2e8f0' }}>
                          Call-to-Action *
                        </label>
                        <input
                          type="text"
                          value={cta}
                          onChange={(e) => setCta(e.target.value)}
                          required
                          className="w-full px-3 py-2 border rounded-md focus:ring-2"
                          style={{ background: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }}
                          placeholder="Shop Now"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: '#e2e8f0' }}>
                          Destination URL *
                        </label>
                        <input
                          type="url"
                          value={destinationUrl}
                          onChange={(e) => setDestinationUrl(e.target.value)}
                          required
                          className="w-full px-3 py-2 border rounded-md focus:ring-2"
                          style={{ background: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }}
                          placeholder="https://example.com/campaign"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Targeting */}
                <div>
                  <h2 className="text-xl font-semibold mb-4" style={{ color: '#FFD100' }}>Targeting Criteria</h2>
                  
                  {/* Age Range */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2" style={{ color: '#e2e8f0' }}>
                      Age Range: {ageMin} - {ageMax}
                    </label>
                    <div className="flex gap-4">
                      <input
                        type="range"
                        min="18"
                        max="65"
                        value={ageMin}
                        onChange={(e) => setAgeMin(Math.min(parseInt(e.target.value), ageMax - 1))}
                        className="flex-1"
                      />
                      <input
                        type="range"
                        min="18"
                        max="65"
                        value={ageMax}
                        onChange={(e) => setAgeMax(Math.max(parseInt(e.target.value), ageMin + 1))}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  {/* Interests */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2" style={{ color: '#e2e8f0' }}>
                      Interests (select up to 8)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {INTEREST_CATEGORIES.map(interest => (
                        <button
                          key={interest}
                          type="button"
                          onClick={() => toggleInterest(interest)}
                          className={`px-3 py-1 rounded-full text-sm ${
                            selectedInterests.includes(interest)
                              ? 'text-black'
                              : 'hover:opacity-80'
                          }`}
                          style={{
                            background: selectedInterests.includes(interest) ? '#FFD100' : '#334155',
                            color: selectedInterests.includes(interest) ? '#000A30' : '#e2e8f0'
                          }}
                        >
                          {interest}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
                      {selectedInterests.length}/8 selected
                    </p>
                  </div>

                  {/* Income */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2" style={{ color: '#e2e8f0' }}>
                      Minimum Income
                    </label>
                    <select
                      value={minIncome}
                      onChange={(e) => setMinIncome(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border rounded-md focus:ring-2"
                      style={{ background: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }}
                    >
                      {INCOME_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Countries */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2" style={{ color: '#e2e8f0' }}>
                      Target Countries
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {COUNTRIES.map(country => (
                        <button
                          key={country}
                          type="button"
                          onClick={() => toggleCountry(country)}
                          className={`px-3 py-1 rounded text-sm font-mono ${
                            selectedCountries.includes(country)
                              ? ''
                              : 'hover:opacity-80'
                          }`}
                          style={{
                            background: selectedCountries.includes(country) ? '#FFD100' : '#334155',
                            color: selectedCountries.includes(country) ? '#000A30' : '#e2e8f0'
                          }}
                        >
                          {country}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
                      {selectedCountries.length} countries selected
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="border rounded-lg p-4" style={{ background: '#7f1d1d', borderColor: '#991b1b', color: '#fca5a5' }}>
                    ❌ {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#FFD100', color: '#000A30' }}
                >
                  {loading ? 'Creating Ad...' : 'Create Ad Campaign'}
                </button>
              </form>
            </div>

            {/* Preview */}
            <div className="lg:col-span-1">
              <div className="rounded-lg shadow p-6 sticky top-8" style={{ background: '#1a1f3a', borderColor: '#334155' }}>
                <h2 className="text-xl font-semibold mb-4" style={{ color: '#FFD100' }}>Preview</h2>
                <div className="border rounded-lg p-4" style={{ borderColor: '#334155', background: '#0f172a' }}>
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg" style={{ color: '#e2e8f0' }}>
                      {headline || 'Your headline here'}
                    </h3>
                    <p className="text-sm" style={{ color: '#94a3b8' }}>
                      {body || 'Your ad body text will appear here...'}
                    </p>
                    <button className="w-full py-2 rounded font-medium hover:opacity-90" style={{ background: '#FFD100', color: '#000A30' }}>
                      {cta || 'Call to Action'}
                    </button>
                  </div>
                </div>

                <div className="mt-6 space-y-3 text-sm" style={{ color: '#94a3b8' }}>
                  <div>
                    <span className="font-medium" style={{ color: '#e2e8f0' }}>Age:</span> {ageMin}-{ageMax}
                  </div>
                  <div>
                    <span className="font-medium" style={{ color: '#e2e8f0' }}>Interests:</span>{' '}
                    {selectedInterests.length > 0 ? selectedInterests.join(', ') : 'None selected'}
                  </div>
                  <div>
                    <span className="font-medium" style={{ color: '#e2e8f0' }}>Min Income:</span> {
                      INCOME_OPTIONS.find(o => o.value === minIncome)?.label
                    }
                  </div>
                  <div>
                    <span className="font-medium" style={{ color: '#e2e8f0' }}>Countries:</span> {selectedCountries.join(', ')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CreateCampaignPage() {
  return (
    <WalletContextProvider>
      <AdvertiserLayout>
        {(advertiserData) => (
          <CreateCampaignForm advertiser_id={advertiserData.advertiser_id} />
        )}
      </AdvertiserLayout>
    </WalletContextProvider>
  );
}
