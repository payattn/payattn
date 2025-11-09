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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create Ad Campaign</h1>
          <p className="mt-2 text-gray-600">
            Create a new ad that will be evaluated by Max and shown to matching users
          </p>
        </div>

        {success ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-green-900 mb-2">✅ Ad Created Successfully!</h2>
            <p className="text-green-800 mb-4">
              Ad ID: <code className="bg-green-100 px-2 py-1 rounded">{createdAdId}</code>
            </p>
            <div className="space-y-2 text-sm text-green-700">
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
              className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Create Another Ad
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form */}
            <div className="lg:col-span-2">
              <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
                {/* Campaign Info */}
                <div>
                  <h2 className="text-xl font-semibold mb-4">Campaign Details</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Campaign Name (optional)
                      </label>
                      <input
                        type="text"
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="Q4 Luxury Campaign"
                      />
                    </div>
                  </div>
                </div>

                {/* Ad Creative */}
                <div>
                  <h2 className="text-xl font-semibold mb-4">Ad Creative</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Headline *
                      </label>
                      <input
                        type="text"
                        value={headline}
                        onChange={(e) => setHeadline(e.target.value)}
                        maxLength={100}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="Get 20% off luxury watches"
                      />
                      <p className="text-xs text-gray-500 mt-1">{headline.length}/100 characters</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Body Text *
                      </label>
                      <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        required
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="Swiss craftsmanship meets digital age. Exclusive offer for crypto enthusiasts."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Call-to-Action *
                        </label>
                        <input
                          type="text"
                          value={cta}
                          onChange={(e) => setCta(e.target.value)}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                          placeholder="Shop Now"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Destination URL *
                        </label>
                        <input
                          type="url"
                          value={destinationUrl}
                          onChange={(e) => setDestinationUrl(e.target.value)}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                          placeholder="https://example.com/campaign"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Targeting */}
                <div>
                  <h2 className="text-xl font-semibold mb-4">Targeting Criteria</h2>
                  
                  {/* Age Range */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {interest}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedInterests.length}/8 selected
                    </p>
                  </div>

                  {/* Income */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Minimum Income
                    </label>
                    <select
                      value={minIncome}
                      onChange={(e) => setMinIncome(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    >
                      {INCOME_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Countries */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {country}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedCountries.length} countries selected
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
                    ❌ {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating Ad...' : 'Create Ad Campaign'}
                </button>
              </form>
            </div>

            {/* Preview */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow p-6 sticky top-8">
                <h2 className="text-xl font-semibold mb-4">Preview</h2>
                <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg text-gray-900">
                      {headline || 'Your headline here'}
                    </h3>
                    <p className="text-sm text-gray-700">
                      {body || 'Your ad body text will appear here...'}
                    </p>
                    <button className="w-full py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700">
                      {cta || 'Call to Action'}
                    </button>
                  </div>
                </div>

                <div className="mt-6 space-y-3 text-sm">
                  <div>
                    <span className="font-medium">Age:</span> {ageMin}-{ageMax}
                  </div>
                  <div>
                    <span className="font-medium">Interests:</span>{' '}
                    {selectedInterests.length > 0 ? selectedInterests.join(', ') : 'None selected'}
                  </div>
                  <div>
                    <span className="font-medium">Min Income:</span> {
                      INCOME_OPTIONS.find(o => o.value === minIncome)?.label
                    }
                  </div>
                  <div>
                    <span className="font-medium">Countries:</span> {selectedCountries.join(', ')}
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
