'use client';

import { useState } from 'react';
import { WalletContextProvider } from '@/components/WalletProvider';
import AdvertiserLayout from '@/components/AdvertiserLayout';

// BN128 field prime (must match extension)
const FIELD_PRIME = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

/**
 * Hash string to field element (browser-compatible version using Web Crypto API)
 */
async function hashToField(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data as BufferSource);
  const hashArray = new Uint8Array(hashBuffer);
  
  let num = BigInt(0);
  for (let i = 0; i < hashArray.length; i++) {
    const byte = hashArray[i];
    if (byte !== undefined) {
      num = (num << BigInt(8)) | BigInt(byte);
    }
  }
  
  const fieldElement = num % FIELD_PRIME;
  return fieldElement.toString();
}

export default function AdvertisersPage() {
  const [proofJson, setProofJson] = useState('');
  const [circuitName, setCircuitName] = useState('range_check');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  // Campaign requirements for validation
  const [rangeMin, setRangeMin] = useState('25000');
  const [rangeMax, setRangeMax] = useState('50000');
  const [allowedValues, setAllowedValues] = useState('us,uk,ca');

  const handleVerify = async () => {
    setVerifying(true);
    setError('');
    setResult(null);

    try {
      // Parse proof JSON
      const proofData = JSON.parse(proofJson);
      
      if (!proofData.proof || !proofData.publicSignals) {
        throw new Error('Invalid proof format. Expected { proof: {...}, publicSignals: [...] }');
      }

      // Build request with campaign requirements
      const requestBody: any = {
        circuitName,
        proof: proofData.proof,
        publicSignals: proofData.publicSignals
      };

      // Add campaign-specific requirements
      if (circuitName === 'range_check' || circuitName === 'age_range') {
        requestBody.campaignRequirements = {
          min: parseInt(rangeMin),
          max: parseInt(rangeMax)
        };
      } else if (circuitName === 'set_membership') {
        const values = allowedValues.split(',').map(v => v.trim());
        requestBody.campaignRequirements = {
          allowedValues: values
        };
      }

      // Call verification API (simulates cron job processing)
      const response = await fetch('/api/process-proof-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      if (data.success) {
        setResult(data.result);
      } else {
        setError(data.error || data.result?.message || 'Verification failed');
        setResult(data.result);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setVerifying(false);
    }
  };

  const handleHashString = async (str: string) => {
    try {
      const hash = await hashToField(str);
      alert(`Hash of "${str}":\n${hash}`);
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <WalletContextProvider>
      <AdvertiserLayout>
        {(advertiserData) => (
          <div className="py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              {/* Header with Create Ad Button */}
              <div className="mb-6 flex justify-between items-center">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    🔒 Dashboard
                  </h1>
                  <p className="text-gray-600 mt-2">
                    Manage campaigns and verify zero-knowledge proofs
                  </p>
                </div>
                <a
                  href="/advertisers/create-campaign"
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 shadow-md"
                >
                  + Create New Ad Campaign
                </a>
              </div>

        <div className="bg-white shadow rounded-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Proof Verification
          </h2>
          
          <p className="text-gray-600 mb-8">
            This page simulates an advertiser verifying zero-knowledge proofs from users.
            Users prove they meet campaign criteria (age, income, location) without revealing private data.
          </p>

          {/* Circuit Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Circuit Type
            </label>
            <select
              value={circuitName}
              onChange={(e) => setCircuitName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="age_range">Age Range</option>
              <option value="range_check">Range Check (Generic)</option>
              <option value="set_membership">Set Membership</option>
            </select>
          </div>

          {/* Campaign Requirements */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="text-sm font-medium text-blue-900 mb-3">Campaign Requirements</h3>
            
            {(circuitName === 'range_check' || circuitName === 'age_range') && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Min Value
                  </label>
                  <input
                    type="number"
                    value={rangeMin}
                    onChange={(e) => setRangeMin(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Max Value
                  </label>
                  <input
                    type="number"
                    value={rangeMax}
                    onChange={(e) => setRangeMax(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>
            )}

            {circuitName === 'set_membership' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Allowed Values (comma-separated)
                </label>
                <input
                  type="text"
                  value={allowedValues}
                  onChange={(e) => setAllowedValues(e.target.value)}
                  placeholder="us,uk,ca,au"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <button
                  onClick={() => {
                    const val = prompt('Enter value to hash:');
                    if (val) handleHashString(val);
                  }}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                >
                  🔍 Hash a string
                </button>
              </div>
            )}
          </div>

          {/* Proof Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Proof JSON (paste from extension console)
            </label>
            <textarea
              value={proofJson}
              onChange={(e) => setProofJson(e.target.value)}
              placeholder='{"proof": {...}, "publicSignals": [...]}'
              rows={12}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-xs"
            />
          </div>

          {/* Verify Button */}
          <button
            onClick={handleVerify}
            disabled={verifying || !proofJson}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {verifying ? '⏳ Verifying... (First verification may take 1-3 min)' : '✓ Verify Proof'}
          </button>

          {verifying && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                ⏳ <strong>Note:</strong> The first proof verification takes 1-3 minutes while the server initializes cryptographic libraries. Subsequent verifications will be much faster (under 1 second).
              </p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <h3 className="text-sm font-medium text-red-900 mb-2">❌ Verification Failed</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Success Display */}
          {result && result.valid && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
              <h3 className="text-sm font-medium text-green-900 mb-2">✅ Proof Verified!</h3>
              <p className="text-sm text-green-700 mb-3">{result.message}</p>
              
              <div className="text-xs text-gray-600 space-y-1">
                <p><strong>Circuit:</strong> {result.circuitName}</p>
                <p><strong>Timestamp:</strong> {new Date(result.timestamp).toLocaleString()}</p>
                <p><strong>Public Signals:</strong></p>
                <pre className="bg-white p-2 rounded border border-green-200 mt-1 overflow-x-auto">
                  {JSON.stringify(result.publicSignals, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-md">
            <h3 className="text-sm font-medium text-gray-900 mb-2">📋 Testing Instructions</h3>
            <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
              <li>Open the extension page: <code className="bg-gray-200 px-1 rounded">chrome-extension://[id]/age-proof-test.html</code></li>
              <li>Open browser console (F12)</li>
              <li>Generate a proof:
                <ul className="ml-6 mt-1 space-y-1 list-disc list-inside text-xs">
                  <li>Range: <code className="bg-gray-200 px-1 rounded">await testRangeCheck(35000, 25000, 50000)</code></li>
                  <li>Set: <code className="bg-gray-200 px-1 rounded">await testSetMembership("uk", ["us", "uk", "ca"])</code></li>
                </ul>
              </li>
              <li>Copy the proof JSON from console</li>
              <li>Paste it above and click "Verify Proof"</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
        )}
      </AdvertiserLayout>
    </WalletContextProvider>
  );
}
