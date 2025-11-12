/**
 * Test x402 Payment Required Flow
 * 
 * This script tests the complete x402 protocol implementation:
 * 1. Peggy accepts an offer → Backend sends 402 Payment Required
 * 2. Peggy funds escrow on Solana
 * 3. Peggy submits payment proof → Backend verifies on-chain
 * 
 * Run: tsx solana/payattn_escrow/test-x402-flow.ts
 */

import { Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor';
import { connection, program, PROGRAM_ID, derivePDA } from '../../backend/lib/solana-escrow';
import fs from 'fs';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

// Load test wallets
const advertiserKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(`${process.env.HOME}/.config/solana/advertiser.json`, 'utf-8')))
);

console.log('🧪 Testing x402 Payment Required Flow\n');
console.log('='.repeat(60));
console.log('Advertiser:', advertiserKeypair.publicKey.toBase58());
console.log('='.repeat(60), '\n');

async function testX402Flow() {
  try {
    // Step 1: Peggy accepts an offer
    console.log('[STEP 1] Accepting offer...');
    
    // Use the test offer from database (offer_41f8f17d3b6bebd6)
    const offerId = 'offer_41f8f17d3b6bebd6';
    
    const acceptResponse = await fetch(`${BACKEND_URL}/api/advertiser/offers/${offerId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 'X-Advertiser-Id': 'adv_test_001' // TODO: Add when auth is implemented
      }
    });
    
    console.log('Status:', acceptResponse.status, acceptResponse.statusText);
    
    if (acceptResponse.status !== 402) {
      const error = await acceptResponse.json();
      throw new Error(`Expected 402, got ${acceptResponse.status}: ${JSON.stringify(error)}`);
    }
    
    // Extract x402 headers
    const x402Headers = {
      paymentChain: acceptResponse.headers.get('X-Payment-Chain'),
      paymentNetwork: acceptResponse.headers.get('X-Payment-Network'),
      paymentAmount: acceptResponse.headers.get('X-Payment-Amount'),
      paymentToken: acceptResponse.headers.get('X-Payment-Token'),
      offerId: acceptResponse.headers.get('X-Offer-Id'),
      userPubkey: acceptResponse.headers.get('X-User-Pubkey'),
      platformPubkey: acceptResponse.headers.get('X-Platform-Pubkey'),
      escrowProgram: acceptResponse.headers.get('X-Escrow-Program'),
      escrowPda: acceptResponse.headers.get('X-Escrow-PDA'),
      verificationEndpoint: acceptResponse.headers.get('X-Verification-Endpoint')
    };
    
    console.log('[OK] Received 402 Payment Required');
    console.log('x402 Headers:', JSON.stringify(x402Headers, null, 2), '\n');
    
    // Step 2: Peggy funds the escrow
    console.log('[STEP 2] Funding escrow on Solana...');
    
    const amount = parseInt(x402Headers.paymentAmount!);
    const userPubkey = new PublicKey(x402Headers.userPubkey!);
    const platformPubkey = new PublicKey(x402Headers.platformPubkey!);
    
    // For now, use test publisher wallet (will be removed from contract later)
    const publisherPubkey = new PublicKey('ELD9PKHo5qwyt3o5agPPMuQLRzidDnR2g4DmJDfH55Z7');
    
    const [escrowPda, bump] = await derivePDA(offerId);
    
    console.log('Escrow PDA:', escrowPda.toBase58());
    console.log('Amount:', amount, 'lamports');
    
    // Call createEscrow instruction
    const tx = await program.methods
      .createEscrow(offerId, amount)
      .accounts({
        escrow: escrowPda,
        advertiser: advertiserKeypair.publicKey,
        user: userPubkey,
        publisher: publisherPubkey,
        platform: platformPubkey,
        systemProgram: SystemProgram.programId,
      })
      .signers([advertiserKeypair])
      .rpc();
    
    console.log('[OK] Escrow funded! TX:', tx);
    console.log('Waiting for confirmation...');
    
    await connection.confirmTransaction(tx, 'confirmed');
    console.log('[OK] Transaction confirmed\n');
    
    // Step 3: Peggy submits payment proof
    console.log('[STEP 3] Submitting payment proof...');
    
    const verifyResponse = await fetch(`${BACKEND_URL}${x402Headers.verificationEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 'X-Advertiser-Id': 'adv_test_001' // TODO: Add when auth is implemented
      },
      body: JSON.stringify({
        offerId: x402Headers.offerId,
        txSignature: tx,
        escrowPda: escrowPda.toBase58()
      })
    });
    
    const verifyResult = await verifyResponse.json();
    
    if (!verifyResponse.ok) {
      throw new Error(`Verification failed: ${JSON.stringify(verifyResult)}`);
    }
    
    console.log('[OK] Payment verified!');
    console.log('Result:', JSON.stringify(verifyResult, null, 2), '\n');
    
    console.log('='.repeat(60));
    console.log('*** x402 Flow Test PASSED!');
    console.log('='.repeat(60));
    console.log('\nOffer Status:', verifyResult.offerStatus);
    console.log('Escrow PDA:', verifyResult.escrowPda);
    console.log('TX Signature:', verifyResult.txSignature);
    console.log('Resource URL:', verifyResult.resourceUrl);
    
  } catch (error) {
    console.error('\n❌ Test Failed:', error);
    process.exit(1);
  }
}

testX402Flow();
