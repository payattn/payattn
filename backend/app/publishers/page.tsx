'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function PublishersPage() {
  const publisherId = '8k3m9x2p'; // Fixed for demo
  const [copied, setCopied] = useState(false);

  const sdkSnippet = `<!-- PayAttn SDK - Add this before closing </body> tag -->
<script src="http://localhost:3000/publishers/v1/sdk.js" 
        data-publisher-id="${publisherId}"></script>
<div id="payattn-ad-slot"></div>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sdkSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white shadow rounded-lg p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Welcome to PayAttn Publisher Portal
          </h1>
          <p className="text-lg text-gray-700 mb-6">
            PayAttn is the world's first privacy-preserving advertising platform powered by Solana blockchain.
          </p>
          
          {/* Key Points */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <div className="font-semibold text-gray-900">Simple Integration</div>
                <div className="text-sm text-gray-600">Copy just a few lines of code</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <div className="font-semibold text-gray-900">No More Adblockers</div>
                <div className="text-sm text-gray-600">Users earn rewards for viewing ads</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <div className="font-semibold text-gray-900">Instant Payment</div>
                <div className="text-sm text-gray-600">Receive SOL within seconds of ad views</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <div className="font-semibold text-gray-900">Trustless System</div>
                <div className="text-sm text-gray-600">Payment guaranteed by math, not middlemen</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <div className="font-semibold text-gray-900">No Cookies</div>
                <div className="text-sm text-gray-600">Privacy-first, no tracking or user data collection</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <div className="font-semibold text-gray-900">Zero-Knowledge Proofs</div>
                <div className="text-sm text-gray-600">Cryptographic privacy for all transactions</div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
            <p className="text-sm text-blue-900">
              <span className="font-semibold">Your Publisher ID:</span> <code className="bg-blue-100 px-2 py-1 rounded">{publisherId}</code>
            </p>
          </div>
        </div>

        {/* SDK Integration */}
        <div className="bg-white shadow rounded-lg p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            🚀 Get Started in 60 Seconds
          </h2>
          <p className="text-gray-700 mb-6">
            All you need to do to start showing PayAttn ads on your website is paste this snippet into your HTML. 
            The SDK is pre-configured with your Publisher ID and will automatically handle ad delivery, impression 
            tracking, and payment settlement.
          </p>

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SDK Snippet (Copy & Paste into your website)
            </label>
            <textarea
              value={sdkSnippet}
              readOnly
              rows={8}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={handleCopy}
              className="absolute top-8 right-3 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>

          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-900">
              <span className="font-semibold">💡 Tip:</span> Add this snippet right before your closing <code className="bg-yellow-100 px-1">&lt;/body&gt;</code> tag 
              for optimal performance.
            </p>
          </div>
        </div>

        {/* Wallet Setup */}
        <div className="bg-white shadow rounded-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            💰 Set Up Your Wallet
          </h2>
          <p className="text-gray-700 mb-6">
            To receive payments, you need to connect your Solana wallet. Your earnings (25% of each impression) 
            are automatically settled to this wallet within seconds of users viewing ads on your site.
          </p>

          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
              1
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Create or Connect Wallet</h3>
              <p className="text-sm text-gray-600">
                If you don't have a Solana wallet yet, get one from{' '}
                <a href="https://phantom.app" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Phantom
                </a>{' '}
                or{' '}
                <a href="https://solflare.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Solflare
                </a>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
              2
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Add Your Wallet Address</h3>
              <p className="text-sm text-gray-600">
                Copy your Solana wallet address and paste it in the settings page
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 mb-8">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
              3
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Start Earning!</h3>
              <p className="text-sm text-gray-600">
                Once your wallet is configured, you'll automatically receive payments as users view ads
              </p>
            </div>
          </div>

          <Link
            href="/publishers/settings"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Configure Wallet in Settings
          </Link>

          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-600">
              <span className="font-semibold">Note:</span> Your wallet address is stored securely and only used for payment settlement. 
              We never have access to your private keys or funds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
