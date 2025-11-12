import { NextRequest, NextResponse } from 'next/server';
import { DatabaseClient } from '@/lib/peggy/database';
import { validateOfferProofs } from '@/lib/peggy/proof-validator';
import { LLMEvaluator } from '@/lib/peggy/llm-evaluator';
import { EscrowFunder } from '@/lib/peggy/escrow-funder';
import { derivePDA } from '@/lib/solana-escrow';

/**
 * POST /api/advertiser/assess/single
 * Assess a single offer by ID
 * Headers: x-advertiser-id
 * Body: { offerId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const advertiserId = request.headers.get('x-advertiser-id');
    const body = await request.json();
    const { offerId } = body;
    
    if (!advertiserId) {
      return NextResponse.json(
        { error: 'x-advertiser-id header required' },
        { status: 400 }
      );
    }
    
    if (!offerId) {
      return NextResponse.json(
        { error: 'offerId required in request body' },
        { status: 400 }
      );
    }
    
    console.log('\n=== Assessing Single Offer ===');
    console.log('Advertiser ID:', advertiserId);
    console.log('Offer ID:', offerId);
    
    const db = new DatabaseClient();
    
    // Get the specific offer
    const allOffers = await db.getPendingOffersWithAds(advertiserId);
    const offer = allOffers.find(o => o.offer_id === offerId);
    
    if (!offer) {
      return NextResponse.json(
        { error: 'Offer not found or not pending' },
        { status: 404 }
      );
    }
    
    if (!offer.ad_creative) {
      return NextResponse.json(
        { error: 'Offer missing ad creative data' },
        { status: 400 }
      );
    }
    
    // Validate ZK proofs
    const proofValidation = await validateOfferProofs(offer.zk_proofs);
    
    console.log('Proof validation:', proofValidation.summary);
    
    // Evaluate with LLM
    const llmEvaluator = new LLMEvaluator();
    const evaluation = await llmEvaluator.evaluateOffer(offer, offer.ad_creative, proofValidation);
    
    console.log(`LLM decision: ${evaluation.decision} (${(evaluation.confidence * 100).toFixed(0)}% confidence)`);
    console.log(`Reasoning: ${evaluation.reasoning}`);
    
    // Prepare result
    const result = {
      offerId: offer.offer_id,
      userWallet: offer.user_pubkey,
      decision: evaluation.decision,
      reasoning: evaluation.reasoning,
      confidence: evaluation.confidence,
      amountSOL: offer.amount_lamports / 1e9,
      adHeadline: offer.ad_creative.headline,
      proofValidation,
      funded: null as { success: boolean; escrowPda?: string; signature?: string; error?: string } | null
    };
    
    // Update offer status
    const newStatus = evaluation.decision === 'accept' ? 'accepted' : 'rejected';
    await db.updateOfferStatus(offer.offer_id, newStatus);
    console.log(`Updated offer status to: ${newStatus}`);
    
    // If accepted, fund the escrow
    if (evaluation.decision === 'accept') {
      try {
        // Derive the correct escrow PDA from the offer ID
        const [escrowPda, bump] = await derivePDA(offer.offer_id);
        console.log(`   Derived escrow PDA: ${escrowPda.toBase58()} (bump: ${bump})`);
        
        // Validate platform pubkey
        const platformPubkey = process.env.SOLANA_PLATFORM_PUBKEY;
        if (!platformPubkey) {
          throw new Error('SOLANA_PLATFORM_PUBKEY not configured in environment');
        }
        
        // ====== X402 PAYMENT REQUEST ======
        console.log('\n🔷 X402 Payment Request:');
        console.log('   Protocol: x402 (Solana escrow-based payment)');
        console.log(`   Offer ID: ${offer.offer_id}`);
        console.log(`   Amount: ${offer.amount_lamports} lamports (${(offer.amount_lamports / 1e9).toFixed(6)} SOL)`);
        console.log(`   Escrow PDA: ${escrowPda.toBase58()}`);
        console.log(`   User Pubkey: ${offer.user_pubkey}`);
        console.log(`   Platform Pubkey: ${platformPubkey}`);
        console.log(`   Program ID: ${process.env.SOLANA_PROGRAM_ID || '6ZEekbTJZ6D6KrfSGDY2ByoWENWfe8RzhvpBS4KtPdZr'}`);
        console.log('==================================\n');
        
        const escrowFunder = new EscrowFunder();
        const fundResult = await escrowFunder.fundEscrow({
          offerId: offer.offer_id,
          escrowPda: escrowPda.toBase58(),
          paymentAmount: offer.amount_lamports,
          userPubkey: offer.user_pubkey,
          platformPubkey: platformPubkey,
          programId: process.env.SOLANA_PROGRAM_ID || '6ZEekbTJZ6D6KrfSGDY2ByoWENWfe8RzhvpBS4KtPdZr'
        });
        
        // ====== X402 PAYMENT SUCCESSFUL ======
        if (fundResult.success) {
          console.log('\n✅ X402 Payment Successful!');
          console.log('   Protocol: x402 (Solana escrow)');
          console.log(`   Offer ID: ${offer.offer_id}`);
          console.log(`   Escrow PDA: ${fundResult.escrowPda}`);
          if (fundResult.txSignature) {
            console.log(`   Transaction Signature: ${fundResult.txSignature}`);
            console.log(`   Explorer: https://explorer.solana.com/tx/${fundResult.txSignature}?cluster=devnet`);
          } else {
            console.log(`   Status: Escrow already funded (idempotent - no new transaction)`);
          }
          console.log('==================================\n');
        }
        
        result.funded = {
          success: fundResult.success,
          escrowPda: fundResult.escrowPda,
          signature: fundResult.txSignature,
          error: fundResult.error
        };
        
        if (!fundResult.success) {
          console.error('❌ X402 Payment Failed:', fundResult.error);
        }
      } catch (error) {
        console.error('❌ X402 Payment Exception:', error);
        result.funded = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error assessing offer:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
