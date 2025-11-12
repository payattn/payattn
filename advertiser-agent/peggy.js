#!/usr/bin/env node

/**
 * Peggy - Autonomous Advertiser Agent
 * 
 * Evaluates user offers using AI and funds Solana escrows via x402 protocol.
 * 
 * Flow:
 * 1. Poll backend for pending offers (every 30s)
 * 2. Evaluate each offer with LLM reasoning
 * 3. Accept good offers → Receive HTTP 402 response
 * 4. Fund escrow on Solana (locks advertiser funds)
 * 5. Submit payment proof → Backend marks offer as "funded"
 * 6. User can now queue ad for viewing
 */

import { LLMClient } from './lib/llm.js';
import { BackendClient } from './lib/api.js';
import { EscrowFunder } from './lib/escrow.js';
import { DatabaseClient } from './lib/database.js';
import { config } from './config.js';

class PeggyAgent {
  constructor() {
    this.llm = new LLMClient();
    this.api = new BackendClient();
    this.escrow = new EscrowFunder();
    this.db = new DatabaseClient();
    this.processedOffers = new Set();
    this.advertiser = null;
  }
  
  /**
   * Start Peggy agent
   */
  async start() {
    console.log('🤖 Peggy starting up...');
    console.log('=========================================\n');
    
    try {
      // Load advertiser from database
      this.advertiser = await this.db.getAdvertiser(config.advertiserId);
      console.log(`Advertiser: ${this.advertiser.name}`);
      console.log(`Advertiser ID: ${this.advertiser.advertiser_id}`);
      console.log(`Wallet: ${this.escrow.getPublicKey().toBase58()}`);
      
      // Verify wallet matches database
      if (this.advertiser.wallet_pubkey !== this.escrow.getPublicKey().toBase58()) {
        console.warn(`⚠️  WARNING: Wallet mismatch!`);
        console.warn(`   Database: ${this.advertiser.wallet_pubkey}`);
        console.warn(`   Keypair:  ${this.escrow.getPublicKey().toBase58()}`);
        console.warn(`   Proceeding anyway...\n`);
      }
      
      // Check balance
      const balance = await this.escrow.getBalance();
      console.log(`Balance: ${balance.toFixed(4)} SOL`);
      
      if (balance < 0.1) {
        console.warn('\n⚠️  WARNING: Low balance!');
        console.warn(`   Current: ${balance.toFixed(4)} SOL`);
        console.warn(`   Recommended: At least 0.5 SOL for testing`);
        console.warn(`   Request airdrop:`);
        console.warn(`   solana airdrop 1 ${this.escrow.getPublicKey().toBase58()} --url devnet\n`);
      }
      
      console.log(`\n✅ Peggy initialized successfully!`);
      console.log(`Polling for offers every ${config.pollInterval / 1000}s...`);
      console.log('=========================================\n');
      
      // Main polling loop
      while (true) {
        try {
          await this.processOffers();
        } catch (error) {
          console.error('❌ Error in main loop:', error.message);
          console.error('   Continuing in 10 seconds...\n');
          await this.sleep(10000);
        }
        
        await this.sleep(config.pollInterval);
      }
      
    } catch (error) {
      console.error('❌ Peggy startup failed:', error.message);
      process.exit(1);
    }
  }
  
  /**
   * Process all pending offers
   */
  async processOffers() {
    const timestamp = new Date().toLocaleTimeString();
    
    // Fetch pending offers from database
    const offers = await this.db.getPendingOffers(config.advertiserId);
    
    if (offers.length === 0) {
      console.log(`[${timestamp}] No pending offers`);
      return;
    }
    
    console.log(`\n[${timestamp}] 📋 Found ${offers.length} pending offer(s)\n`);
    
    // Process each offer
    for (const offer of offers) {
      // Skip if already processed
      if (this.processedOffers.has(offer.offer_id)) {
        continue;
      }
      
      try {
        await this.handleOffer(offer);
        this.processedOffers.add(offer.offer_id);
      } catch (error) {
        console.error(`❌ Failed to handle offer ${offer.offer_id}:`, error.message);
        console.error('   Skipping to next offer...\n');
      }
    }
  }
  
  /**
   * Handle a single offer (evaluate, accept, fund)
   */
  async handleOffer(offer) {
    console.log('─────────────────────────────────────────');
    console.log(`📋 Evaluating offer ${offer.offer_id}`);
    console.log(`   User: ${offer.user_id}`);
    console.log(`   Price: ${(offer.amount_lamports / 1e9).toFixed(4)} SOL ($${(offer.amount_lamports / 1e9).toFixed(3)})`);
    console.log(`   User Wallet: ${offer.user_pubkey}`);
    
    // Get campaign criteria
    const campaignCriteria = this.getCampaignCriteria();
    
    // Evaluate offer with LLM
    console.log(`\n💭 Peggy thinking...`);
    const decision = await this.llm.evaluateOffer(offer, campaignCriteria);
    
    const emoji = decision.decision === 'accept' ? '✅' : '❌';
    console.log(`\n${emoji} Decision: ${decision.decision.toUpperCase()}`);
    console.log(`   Reasoning: ${decision.reasoning}`);
    console.log(`   Confidence: ${(decision.confidence * 100).toFixed(0)}%`);
    
    if (decision.decision === 'reject') {
      console.log(`\n❌ Offer ${offer.offer_id} rejected\n`);
      return;
    }
    
    // Accept offer (get x402 response)
    console.log(`\n📤 Accepting offer ${offer.offer_id}...`);
    const x402 = await this.api.acceptOffer(offer.offer_id);
    
    console.log(`\n💰 Received HTTP 402 Payment Required:`);
    console.log(`   Chain: ${x402.paymentChain} (${x402.paymentNetwork})`);
    console.log(`   Escrow PDA: ${x402.escrowPda}`);
    console.log(`   Amount: ${x402.paymentAmount} lamports (${(x402.paymentAmount / 1e9).toFixed(4)} SOL)`);
    console.log(`   User: ${x402.userPubkey}`);
    console.log(`   Platform: ${x402.platformPubkey}`);
    
    // Fund escrow on Solana
    const txSignature = await this.escrow.fundEscrow(x402);
    
    // Submit payment proof
    console.log(`\n📝 Submitting payment proof...`);
    const verification = await this.api.submitPaymentProof(offer.offer_id, txSignature);
    
    console.log(`\n✅ Offer ${offer.offer_id} fully funded!`);
    console.log(`   Status: ${verification.offerStatus}`);
    console.log(`   Escrow PDA: ${verification.escrowPda}`);
    console.log(`   User can now queue ad for viewing`);
    console.log(`   Resource: ${verification.resourceUrl}`);
    console.log('─────────────────────────────────────────\n');
  }
  
  /**
   * Get campaign criteria (hardcoded for hackathon)
   * TODO: Load from database in production
   */
  getCampaignCriteria() {
    return {
      campaignName: 'Nike Golf Championship 2025',
      targeting: {
        age: '40-60',
        interests: ['golf', 'sports', 'luxury goods'],
        location: ['uk', 'us', 'au']
      },
      budgetRemaining: 1000, // USD
      maxCpm: 1.000, // $1.00 max per impression (high for demo/testing)
      goal: 'Drive awareness for new golf club line among affluent golfers'
    };
  }
  
  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Start Peggy
const peggy = new PeggyAgent();
peggy.start().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
