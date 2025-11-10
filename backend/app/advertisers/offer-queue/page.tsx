'use client';

/**
 * Peggy Offer Queue Page
 * Manual trigger UI for Peggy to assess pending offers
 * Cloned from /extension/ad-queue.html
 */

import { useState, useEffect } from 'react';

interface ProofValidation {
  isValid: boolean;
  summary: string;
  validProofs: string[];
  invalidProofs: string[];
}

interface FundingResult {
  success: boolean;
  txSignature?: string;
  escrowPda?: string;
  error?: string;
}

interface AssessmentResult {
  offerId: string;
  adId: string;
  adHeadline?: string;
  userId: string;
  userWallet: string;
  amountLamports: number;
  amountSOL: number;
  proofValidation: ProofValidation;
  decision: 'accept' | 'reject';
  reasoning: string;
  confidence: number;
  funded?: FundingResult;
}

interface AssessmentSession {
  sessionId: string;
  advertiserId: string;
  timestamp: number;
  dateString: string;
  stats: {
    totalOffers: number;
    accepted: number;
    rejected: number;
    funded: number;
    errors: number;
  };
  results: AssessmentResult[];
}

type FilterType = 'all' | 'accepted' | 'rejected';

export default function OfferQueuePage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [currentSession, setCurrentSession] = useState<AssessmentSession | null>(null);
  const [sessions, setSessions] = useState<AssessmentSession[]>([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
  const [filter, setFilter] = useState<FilterType>('all');
  
  // Hardcoded advertiser wallet for hackathon (TODO: get from auth)
  // This should match the wallet in seed-test-offers.js
  const advertiserId = 'AE6uwbubDn9WyXrpzvqU58jfirvqZAxWCZCfDDwW5MMb';
  
  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);
  
  async function loadSessions() {
    try {
      const response = await fetch('/api/advertiser/sessions', {
        headers: {
          'x-advertiser-id': advertiserId
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.sessions && data.sessions.length > 0) {
          // Load full session details for each
          const fullSessions = await Promise.all(
            data.sessions.map(async (s: any) => {
              const sessionResponse = await fetch('/api/advertiser/sessions', {
                headers: {
                  'x-advertiser-id': advertiserId,
                  'x-session-id': s.sessionId
                }
              });
              return sessionResponse.ok ? await sessionResponse.json() : null;
            })
          );
          setSessions(fullSessions.filter(Boolean));
          if (fullSessions[0]) {
            setCurrentSession(fullSessions[0]);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }
  
  async function handleAssess() {
    setLoading(true);
    setStatus('🤖 Peggy is assessing offers...');
    
    try {
      const response = await fetch('/api/advertiser/assess', {
        method: 'POST',
        headers: {
          'x-advertiser-id': advertiserId
        }
      });
      
      if (!response.ok) {
        throw new Error(`Assessment failed: ${response.statusText}`);
      }
      
      const session = await response.json();
      setCurrentSession(session);
      setStatus(`✅ Assessment complete! ${session.stats.accepted} accepted, ${session.stats.rejected} rejected`);
      
      // Reload sessions
      await loadSessions();
      
    } catch (error) {
      console.error('Assessment failed:', error);
      setStatus(`❌ Assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }
  
  function handlePrevSession() {
    if (currentSessionIndex < sessions.length - 1) {
      const newIndex = currentSessionIndex + 1;
      setCurrentSessionIndex(newIndex);
      const session = sessions[newIndex];
      if (session) setCurrentSession(session);
    }
  }
  
  function handleNextSession() {
    if (currentSessionIndex > 0) {
      const newIndex = currentSessionIndex - 1;
      setCurrentSessionIndex(newIndex);
      const session = sessions[newIndex];
      if (session) setCurrentSession(session);
    }
  }
  
  const filteredResults = currentSession?.results.filter(result => {
    if (filter === 'all') return true;
    if (filter === 'accepted') return result.decision === 'accept';
    if (filter === 'rejected') return result.decision === 'reject';
    return true;
  }) || [];
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-slate-200">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-50 mb-2">
            PayAttn: Offer Management
          </h1>
          <p className="text-slate-400 text-sm">
            Peggy's offer assessment dashboard - Review ZK-verified user offers
          </p>
        </div>
        
        {/* Assess Button */}
        <button
          onClick={handleAssess}
          disabled={loading}
          className="w-full py-4 mb-6 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold text-lg rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
        >
          {loading ? '🤖 Assessing...' : '🤖 Assess Pending Offers'}
        </button>
        
        {/* Status Banner */}
        {status && (
          <div className="mb-6 p-4 bg-slate-700 border border-slate-600 rounded-lg">
            <p className="text-center text-sm font-medium">{status}</p>
          </div>
        )}
        
        {/* Session Navigation */}
        {sessions.length > 0 && (
          <div className="mb-5 p-4 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-between">
            <button
              onClick={handlePrevSession}
              disabled={currentSessionIndex >= sessions.length - 1}
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 text-sm font-medium hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            
            <div className="text-center">
              <div className="text-sm font-semibold text-slate-100">
                {currentSession && new Date(currentSession.timestamp).toLocaleString()}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {currentSession?.sessionId}
              </div>
            </div>
            
            <button
              onClick={handleNextSession}
              disabled={currentSessionIndex === 0}
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 text-sm font-medium hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        )}
        
        {/* Filter Buttons */}
        {currentSession && (
          <div className="mb-5 p-3 bg-slate-900 rounded-lg flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 text-xs font-medium rounded-md transition-all ${ 
                filter === 'all' 
                  ? 'bg-indigo-600 border border-purple-400 text-white' 
                  : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All ({currentSession.stats.totalOffers})
            </button>
            <button
              onClick={() => setFilter('accepted')}
              className={`px-4 py-2 text-xs font-medium rounded-md transition-all ${
                filter === 'accepted'
                  ? 'bg-indigo-600 border border-purple-400 text-white'
                  : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Accepted ({currentSession.stats.accepted})
            </button>
            <button
              onClick={() => setFilter('rejected')}
              className={`px-4 py-2 text-xs font-medium rounded-md transition-all ${
                filter === 'rejected'
                  ? 'bg-indigo-600 border border-purple-400 text-white'
                  : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Rejected ({currentSession.stats.rejected})
            </button>
          </div>
        )}
        
        {/* Offer Cards */}
        {filteredResults.length > 0 ? (
          <div className="space-y-4">
            {filteredResults.map((result) => (
              <OfferCard key={result.offerId} result={result} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">
            {currentSession 
              ? 'No offers match the current filter'
              : 'Click "Assess Pending Offers" to get started'}
          </div>
        )}
      </div>
    </div>
  );
}

function OfferCard({ result }: { result: AssessmentResult }) {
  const isAccepted = result.decision === 'accept';
  const borderColor = isAccepted ? 'border-green-500' : 'border-red-500';
  const bgColor = isAccepted ? 'bg-green-900/20' : 'bg-red-900/20';
  
  return (
    <div className={`p-5 bg-slate-800 border-2 ${borderColor} ${bgColor} rounded-lg`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="text-xs text-slate-400 mb-1">Offer ID: {result.offerId}</div>
          <h3 className="text-lg font-bold text-slate-100">
            {result.adHeadline || 'No headline'}
          </h3>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-bold ${
          isAccepted ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {result.decision.toUpperCase()}
        </div>
      </div>
      
      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <div className="text-slate-400 text-xs mb-1">User</div>
          <div className="font-mono text-xs text-slate-300">
            {result.userWallet.slice(0, 8)}...{result.userWallet.slice(-6)}
          </div>
        </div>
        <div>
          <div className="text-slate-400 text-xs mb-1">Price</div>
          <div className="font-semibold text-slate-100">
            {result.amountSOL.toFixed(4)} SOL
          </div>
        </div>
      </div>
      
      {/* ZK Proof Validation */}
      <div className="mb-4 p-3 bg-slate-900 rounded-md">
        <div className="text-xs font-semibold text-slate-300 mb-2">ZK Proof Validation</div>
        <div className="text-sm">
          {result.proofValidation.isValid ? (
            <div className="text-green-400">
              ✅ {result.proofValidation.validProofs.length} valid proof(s): {result.proofValidation.validProofs.join(', ')}
            </div>
          ) : (
            <div className="text-red-400">
              ❌ {result.proofValidation.invalidProofs.length} invalid proof(s): {result.proofValidation.invalidProofs.join(', ')}
            </div>
          )}
          <div className="text-xs text-slate-400 mt-1">{result.proofValidation.summary}</div>
        </div>
      </div>
      
      {/* LLM Reasoning */}
      <div className="mb-4 p-3 bg-slate-900 rounded-md">
        <div className="text-xs font-semibold text-slate-300 mb-2">
          Peggy's Reasoning ({(result.confidence * 100).toFixed(0)}% confidence)
        </div>
        <div className="text-sm text-slate-300">{result.reasoning}</div>
      </div>
      
      {/* Funding Details (if accepted) */}
      {result.funded && (
        <div className="p-3 bg-slate-900 rounded-md">
          <div className="text-xs font-semibold text-slate-300 mb-2">Escrow Funding</div>
          {result.funded.success ? (
            <div className="space-y-1 text-xs">
              <div className="text-green-400">✅ Funded successfully!</div>
              {result.funded.txSignature && (
                <>
                  <div className="text-slate-400">
                    TX: <span className="font-mono text-slate-300">{result.funded.txSignature.slice(0, 16)}...</span>
                  </div>
                  <a
                    href={`https://explorer.solana.com/tx/${result.funded.txSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    View on Solana Explorer →
                  </a>
                </>
              )}
            </div>
          ) : (
            <div className="text-red-400 text-xs">
              ❌ Funding failed: {result.funded.error || 'Unknown error'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
