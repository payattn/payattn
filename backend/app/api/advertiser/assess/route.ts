/**
 * Peggy Assessment API
 * Manually trigger Peggy to assess pending offers
 */

import { NextRequest, NextResponse } from 'next/server';
import { DatabaseClient } from '@/lib/peggy/database';
import { LLMEvaluator } from '@/lib/peggy/llm-evaluator';
import { EscrowFunder } from '@/lib/peggy/escrow-funder';
import { validateOfferProofs } from '@/lib/peggy/proof-validator';
import { SessionManager, AssessmentResult } from '@/lib/peggy/session-manager';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Get advertiser ID from headers
    const advertiserId = request.headers.get('x-advertiser-id');
    
    if (!advertiserId) {
      return NextResponse.json(
        { error: 'Missing x-advertiser-id header' },
        { status: 400 }
      );
    }
    
    console.log(`\n[PEGGY] Starting assessment for advertiser: ${advertiserId}`);
    console.log('=========================================\n');
    
    // Initialize Peggy modules
    const db = new DatabaseClient();
    const llm = new LLMEvaluator();
    const escrow = new EscrowFunder();
    const sessionManager = new SessionManager();
    
    // Try to get advertiser details (optional - may not exist in table)
    try {
      const advertiser = await db.getAdvertiser(advertiserId);
      console.log(`Advertiser: ${advertiser.name}`);
      console.log(`Wallet: ${advertiser.wallet_pubkey}\n`);
    } catch (error) {
      console.log(`Advertiser wallet: ${advertiserId}`);
      console.log(`(No advertiser record found in database - using wallet directly)\n`);
    }
    
    // Get pending offers with ad creative data
    const offers = await db.getPendingOffersWithAds(advertiserId);
    
    if (offers.length === 0) {
      console.log('No pending offers found\n');
      return NextResponse.json({
        message: 'No pending offers to assess',
        advertiserId,
        stats: { totalOffers: 0, accepted: 0, rejected: 0, funded: 0, errors: 0 }
      });
    }
    
    console.log(`[INFO] Found ${offers.length} pending offer(s)\n`);
    
    // Process each offer
    const results: AssessmentResult[] = [];
    
    for (const offer of offers) {
      console.log(`─────────────────────────────────────────`);
      console.log(`[PROCESS] Offer ${offer.offer_id}`);
      
      try {
        // Validate ZK proofs
        console.log(`   [VERIFY] Validating ZK proofs...`);
        const proofValidation = await validateOfferProofs(offer.zk_proofs);
        console.log(`   ${proofValidation.summary}`);
        
        // Check if ad creative exists
        if (!offer.ad_creative) {
          console.log(`   [ERROR] No ad creative found for ad_id: ${offer.ad_id}`);
          results.push({
            offerId: offer.offer_id,
            adId: offer.ad_id,
            userId: offer.user_id,
            userWallet: offer.user_pubkey,
            amountLamports: offer.amount_lamports,
            amountSOL: offer.amount_lamports / 1e9,
            proofValidation: {
              isValid: false,
              summary: 'Ad creative not found',
              validProofs: [],
              invalidProofs: []
            },
            decision: 'reject',
            reasoning: 'Ad creative not found in database',
            confidence: 1.0
          });
          continue;
        }
        
        // Evaluate offer with LLM
        console.log(`   [AI] Peggy thinking...`);
        const evaluation = await llm.evaluateOffer(offer, offer.ad_creative, {
          isValid: proofValidation.isValid,
          summary: proofValidation.summary
        });
        
        const emoji = evaluation.decision === 'accept' ? '✅' : '❌';
        console.log(`   ${emoji} Decision: ${evaluation.decision.toUpperCase()}`);
        console.log(`   Reasoning: ${evaluation.reasoning}`);
        console.log(`   Confidence: ${(evaluation.confidence * 100).toFixed(0)}%`);
        
        // Build result object
        const result: AssessmentResult = {
          offerId: offer.offer_id,
          adId: offer.ad_id,
          adHeadline: offer.ad_creative.headline,
          userId: offer.user_id,
          userWallet: offer.user_pubkey,
          amountLamports: offer.amount_lamports,
          amountSOL: offer.amount_lamports / 1e9,
          proofValidation: {
            isValid: proofValidation.isValid,
            summary: proofValidation.summary,
            validProofs: proofValidation.validProofs,
            invalidProofs: proofValidation.invalidProofs
          },
          decision: evaluation.decision,
          reasoning: evaluation.reasoning,
          confidence: evaluation.confidence
        };
        
        // If accepted, fund escrow
        if (evaluation.decision === 'accept') {
          console.log(`   [FUND] Funding escrow...`);
          
          try {
            // Call existing accept endpoint to get x402 response
            const acceptResponse = await fetch(
              `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/advertiser/offers/${offer.offer_id}/accept`,
              { method: 'POST' }
            );
            
            if (acceptResponse.status !== 402) {
              throw new Error(`Expected HTTP 402, got ${acceptResponse.status}`);
            }
            
            // Parse x402 headers
            const x402Data = {
              offerId: acceptResponse.headers.get('x-offer-id') || offer.offer_id,
              escrowPda: acceptResponse.headers.get('x-escrow-pda') || '',
              paymentAmount: parseInt(acceptResponse.headers.get('x-payment-amount') || '0'),
              userPubkey: acceptResponse.headers.get('x-user-pubkey') || offer.user_pubkey,
              platformPubkey: acceptResponse.headers.get('x-platform-pubkey') || '',
              programId: acceptResponse.headers.get('x-escrow-program') || ''
            };
            
            // Fund escrow on Solana
            const fundingResult = await escrow.fundEscrow(x402Data);
            
            if (fundingResult.success && fundingResult.txSignature) {
              // Submit payment proof
              const verifyResponse = await fetch(
                `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/advertiser/payments/verify`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    offerId: offer.offer_id,
                    txSignature: fundingResult.txSignature
                  })
                }
              );
              
              if (verifyResponse.ok) {
                console.log(`   [OK] Escrow funded successfully!`);
                console.log(`   TX: ${fundingResult.txSignature}`);
              }
            }
            
            result.funded = fundingResult;
            
          } catch (error) {
            console.error(`   ❌ Funding failed:`, error instanceof Error ? error.message : 'Unknown error');
            result.funded = {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        }
        
        results.push(result);
        console.log('─────────────────────────────────────────\n');
        
        // Update offer status in database based on decision
        try {
          const newStatus = evaluation.decision === 'accept' ? 'accepted' : 'rejected';
          await db.updateOfferStatus(offer.offer_id, newStatus);
          console.log(`   [DB] Updated offer status to: ${newStatus}`);
        } catch (statusError) {
          console.error(`   ⚠️  Failed to update offer status:`, statusError);
        }
        
      } catch (error) {
        console.error(`   ❌ Failed to process offer:`, error);
        results.push({
          offerId: offer.offer_id,
          adId: offer.ad_id,
          userId: offer.user_id,
          userWallet: offer.user_pubkey,
          amountLamports: offer.amount_lamports,
          amountSOL: offer.amount_lamports / 1e9,
          proofValidation: {
            isValid: false,
            summary: 'Processing error',
            validProofs: [],
            invalidProofs: []
          },
          decision: 'reject',
          reasoning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          confidence: 0,
          funded: {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    }
    
    // Save session
    const session = sessionManager.saveSession(advertiserId, results);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`*** Assessment complete in ${duration}s`);
    console.log(`   Total: ${session.stats.totalOffers}`);
    console.log(`   Accepted: ${session.stats.accepted}`);
    console.log(`   Rejected: ${session.stats.rejected}`);
    console.log(`   Funded: ${session.stats.funded}`);
    console.log('=========================================\n');
    
    return NextResponse.json(session);
    
  } catch (error) {
    console.error('❌ Assessment failed:', error);
    return NextResponse.json(
      { 
        error: 'Assessment failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
