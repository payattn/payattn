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
  signature?: string;
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
  const [pendingOffers, setPendingOffers] = useState<any[]>([]);
  const [assessingIndex, setAssessingIndex] = useState(-1);
  const [liveResults, setLiveResults] = useState<Map<string, AssessmentResult>>(new Map());
  
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
    setStatus(' Fetching pending offers...');
    setPendingOffers([]);
    setCurrentSession(null);
    setLiveResults(new Map());
    
    try {
      // First, fetch the pending offers to display them
      const fetchResponse = await fetch('/api/advertiser/offers/pending', {
        headers: {
          'x-advertiser-id': advertiserId
        }
      });
      
      if (!fetchResponse.ok) {
        throw new Error(`Failed to fetch offers: ${fetchResponse.statusText}`);
      }
      
      const { offers } = await fetchResponse.json();
      
      if (offers.length === 0) {
        setStatus(' No pending offers to assess');
        setLoading(false);
        return;
      }
      
      // Display offers as "pending"
      setPendingOffers(offers);
      setStatus(` Peggy is assessing ${offers.length} offer(s)...`);
      
      // Assess them one by one
      const results: AssessmentResult[] = [];
      
      for (let i = 0; i < offers.length; i++) {
        setAssessingIndex(i);
        setStatus(` Peggy is assessing offer ${i + 1} of ${offers.length}...`);
        
        // Assess single offer
        const assessResponse = await fetch('/api/advertiser/assess/single', {
          method: 'POST',
          headers: {
            'x-advertiser-id': advertiserId,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ offerId: offers[i].offer_id })
        });
        
        if (assessResponse.ok) {
          const result = await assessResponse.json();
          results.push(result);
          
          // Store result immediately so it displays
          setLiveResults(prev => {
            const newMap = new Map(prev);
            newMap.set(offers[i].offer_id, result);
            return newMap;
          });
        }
        
        // Small delay for visual effect
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Create session from results
      const session: AssessmentSession = {
        sessionId: `session_${Date.now()}`,
        advertiserId,
        timestamp: Date.now(),
        dateString: new Date().toISOString(),
        stats: {
          totalOffers: results.length,
          accepted: results.filter(r => r.decision === 'accept').length,
          rejected: results.filter(r => r.decision === 'reject').length,
          funded: results.filter(r => r.funded?.success).length,
          errors: results.filter(r => r.funded?.error).length
        },
        results
      };
      
      setCurrentSession(session);
      setPendingOffers([]);
      setAssessingIndex(-1);
      setLiveResults(new Map()); // Clear live results after session is complete
      setStatus(` Assessment complete! ${session.stats.accepted} accepted, ${session.stats.rejected} rejected`);
      
      // Reload sessions
      await loadSessions();
      
    } catch (error) {
      console.error('Assessment failed:', error);
      setStatus(` Assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setPendingOffers([]);
      setAssessingIndex(-1);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 text-slate-200">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 text-center">
          <img 
            src="/payattn_logo_bar01_700x140_trans.png" 
            alt="PayAttn" 
            className="w-full max-w-[350px] h-auto mx-auto mb-4"
          />
          <h2 className="text-2xl font-semibold text-slate-50 mb-2">
            Peggy's Activity
          </h2>
          <p className="text-slate-400 text-sm max-w-2xl mx-auto">
            Peggy is continuously evaluating offer opportunities on behalf of your advertising campaigns. 
            She verifies user credentials with zero-knowledge proofs and makes intelligent funding decisions. 
            Scroll through her decisions below or press "Assess Pending Offers" to see her work in realtime.
          </p>
        </div>
        
        {/* Assess Button */}
        <button
          onClick={handleAssess}
          disabled={loading}
          className="w-full py-4 mb-6 bg-gradient-to-r from-cyan-600 to-teal-600 text-white font-bold text-lg rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none hover:from-cyan-500 hover:to-teal-500"
        >
          {loading ? 'Assessing...' : 'Assess Pending Offers'}
        </button>
        
        {/* Status Banner */}
        {status && (
          <div className="mb-6 p-4 bg-cyan-900/20 border border-cyan-700/50 rounded-lg">
            <p className="text-center text-sm font-medium">{status}</p>
          </div>
        )}
        
        {/* Pending Offers (during assessment) */}
        {pendingOffers.length > 0 && (
          <div className="space-y-4 mb-6">
            {pendingOffers.map((offer, index) => {
              const isAssessing = index === assessingIndex;
              const isComplete = index < assessingIndex;
              const result = liveResults.get(offer.offer_id);
              
              // If result is available, show the full result card
              if (result) {
                return <OfferCard key={offer.offer_id} result={result} />;
              }
              
              // Otherwise show pending/assessing state
              return (
                <div
                  key={offer.offer_id}
                  className={`p-5 rounded-lg border-2 transition-all ${
                    isAssessing 
                      ? 'bg-amber-900/20 border-amber-500 shadow-lg animate-pulse' 
                      : 'bg-slate-800 border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Offer {index + 1} of {pendingOffers.length}</div>
                      <h3 className="text-lg font-bold text-slate-100">
                        {offer.ad_creative?.headline || 'No headline'}
                      </h3>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                      isAssessing 
                        ? 'bg-amber-600 text-white' 
                        : 'bg-slate-700 text-slate-400'
                    }`}>
                      {isAssessing ? ' ASSESSING' : ' PENDING'}
                    </div>
                  </div>
                  
                  <div className="text-sm text-slate-300">
                    <div className="font-mono text-xs text-slate-400 mb-1">
                      {offer.user_pubkey.slice(0, 8)}...{offer.user_pubkey.slice(-6)}
                    </div>
                    <div className="text-slate-400">
                      Offered: {(offer.amount_lamports / 1e9).toFixed(4)} SOL
                    </div>
                  </div>
                </div>
              );
            })}
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
               Previous
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
              Next 
            </button>
          </div>
        )}
        
        {/* Filter Buttons */}
        {currentSession && (
          <div className="mb-5 p-3 bg-slate-900/50 rounded-lg flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 text-xs font-medium rounded-md transition-all ${ 
                filter === 'all' 
                  ? 'bg-cyan-700 border border-cyan-500 text-white' 
                  : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All ({currentSession.stats.totalOffers})
            </button>
            <button
              onClick={() => setFilter('accepted')}
              className={`px-4 py-2 text-xs font-medium rounded-md transition-all ${
                filter === 'accepted'
                  ? 'bg-cyan-700 border border-cyan-500 text-white'
                  : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Accepted ({currentSession.stats.accepted})
            </button>
            <button
              onClick={() => setFilter('rejected')}
              className={`px-4 py-2 text-xs font-medium rounded-md transition-all ${
                filter === 'rejected'
                  ? 'bg-cyan-700 border border-cyan-500 text-white'
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
  const borderColor = isAccepted ? 'border-cyan-500' : 'border-orange-500';
  const bgColor = isAccepted ? 'bg-cyan-900/20' : 'bg-orange-900/20';
  
  return (
    <div className={`p-5 bg-slate-800 border-2 ${borderColor} ${bgColor} rounded-lg transition-all duration-300`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="text-xs text-slate-400 mb-1">Offer ID: {result.offerId}</div>
          <h3 className="text-lg font-bold text-slate-100">
            {result.adHeadline || 'No headline'}
          </h3>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-bold ${
          isAccepted ? 'bg-cyan-600 text-white' : 'bg-orange-600 text-white'
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
      <div className="mb-4 p-3 bg-slate-900/50 rounded-md">
        <div className="text-xs font-semibold text-slate-300 mb-2">ZK Proof Validation</div>
        <div className="text-sm">
          {result.proofValidation.isValid ? (
            <div className="text-cyan-400">
               {result.proofValidation.validProofs.length} valid proof(s): {result.proofValidation.validProofs.join(', ')}
            </div>
          ) : (
            <div className="text-orange-400">
               {result.proofValidation.invalidProofs.length} invalid proof(s): {result.proofValidation.invalidProofs.join(', ')}
            </div>
          )}
          <div className="text-xs text-slate-400 mt-1">{result.proofValidation.summary}</div>
        </div>
      </div>
      
      {/* LLM Reasoning */}
      <div className="mb-4 p-3 bg-slate-900/50 rounded-md">
        <div className="text-xs font-semibold text-slate-300 mb-2">
          Peggy's Reasoning ({(result.confidence * 100).toFixed(0)}% confidence)
        </div>
        <div className="text-sm text-slate-300">{result.reasoning}</div>
      </div>
      
      {/* Funding Details (if accepted) */}
      {result.funded && (
        <div className="p-3 bg-slate-900/50 rounded-md">
          <div className="text-xs font-semibold text-slate-300 mb-2">Escrow Funding</div>
          {result.funded.success ? (
            <div className="space-y-1 text-xs">
              <div className="text-cyan-400"> Funded successfully!</div>
              {result.funded.signature && (
                <>
                  <div className="text-slate-400">
                    TX: <span className="font-mono text-slate-300">{result.funded.signature.slice(0, 16)}...</span>
                  </div>
                  <a
                    href={`https://explorer.solana.com/tx/${result.funded.signature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 underline"
                  >
                    View on Solana Explorer 
                  </a>
                </>
              )}
            </div>
          ) : (
            <div className="text-orange-400 text-xs">
               Funding failed: {result.funded.error || 'Unknown error'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
