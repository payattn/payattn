#!/usr/bin/env node

/**
 * Fund Escrow Test Script
 * 
 * This script:
 * 1. Funds the escrow using the advertiser wallet
 * 2. Verifies the escrow on-chain
 * 3. Calls the payment verification endpoint
 */

const { Connection, Keypair, PublicKey, SystemProgram } = require('@solana/web3.js');
const { AnchorProvider, Program, Wallet, BN } = require('@coral-xyz/anchor');
const fs = require('fs');

// Configuration
const OFFER_ID = 'offer_41f8f17d3b6bebd6';
const AMOUNT_LAMPORTS = new BN(10_000_000); // 0.01 SOL
const RPC_URL = 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey('6ZEekbTJZ6D6KrfSGDY2ByoWENWfe8RzhvpBS4KtPdZr');
const ADVERTISER_KEYPAIR_PATH = `${process.env.HOME}/.config/solana/advertiser.json`;
const USER_PUBKEY = new PublicKey('9kXHUnoYjB7eVUafsKFibrdHJWiYiX26vP7p7QX77nux');
const PLATFORM_PUBKEY = new PublicKey('G6Lbdq9JyQ3QR5YvKqpVC9KjPqAd9hSwWtHv3bPDrWTY');
const PUBLISHER_PUBKEY = new PublicKey('ELD9PKHo5qwyt3o5agPPMuQLRzidDnR2g4DmJDfH55Z7'); // Placeholder

async function fundEscrow() {
  console.log('========================================');
  console.log('FUNDING ESCROW TEST');
  console.log('========================================\n');

  // Load advertiser wallet
  const advertiserKeypairData = JSON.parse(fs.readFileSync(ADVERTISER_KEYPAIR_PATH, 'utf-8'));
  const advertiserKeypair = Keypair.fromSecretKey(Uint8Array.from(advertiserKeypairData));
  console.log('Advertiser:', advertiserKeypair.publicKey.toBase58());

  // Setup connection
  const connection = new Connection(RPC_URL, 'confirmed');
  const wallet = new Wallet(advertiserKeypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });

  // Load program IDL
  const idl = JSON.parse(fs.readFileSync('./target/idl/payattn_escrow.json', 'utf-8'));
  const program = new Program(idl, provider);

  // Derive escrow PDA
  const [escrowPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), Buffer.from(OFFER_ID)],
    PROGRAM_ID
  );

  console.log('Escrow PDA:', escrowPda.toBase58());
  console.log('Amount:', AMOUNT_LAMPORTS, 'lamports (0.01 SOL)');
  console.log('User:', USER_PUBKEY.toBase58());
  console.log('Publisher:', PUBLISHER_PUBKEY.toBase58(), '(placeholder)');
  console.log('Platform:', PLATFORM_PUBKEY.toBase58());
  console.log('\nStep 1: Creating escrow on-chain...\n');

  try {
    // Create escrow instruction
    const tx = await program.methods
      .createEscrow(OFFER_ID, AMOUNT_LAMPORTS)
      .accounts({
        escrow: escrowPda,
        advertiser: advertiserKeypair.publicKey,
        user: USER_PUBKEY,
        publisher: PUBLISHER_PUBKEY,
        platform: PLATFORM_PUBKEY,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log('✅ Escrow created!');
    console.log('Transaction:', tx);
    console.log('Explorer:', `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
    console.log('\nStep 2: Fetching escrow account...\n');

    // Wait for confirmation
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Fetch and verify escrow
    const escrowAccount = await program.account.escrow.fetch(escrowPda);
    console.log('Escrow details:');
    console.log('  Offer ID:', escrowAccount.offerId);
    console.log('  Advertiser:', escrowAccount.advertiser.toBase58());
    console.log('  User:', escrowAccount.user.toBase58());
    console.log('  Platform:', escrowAccount.platform.toBase58());
    console.log('  Amount:', escrowAccount.amount.toNumber(), 'lamports');
    console.log('  Settled:', escrowAccount.settled);
    console.log('  Created at:', new Date(escrowAccount.createdAt.toNumber() * 1000).toISOString());

    console.log('\n✅ Escrow verified on-chain!');
    console.log('\nStep 3: Call payment verification endpoint...\n');

    // Call backend verification endpoint
    const fetch = (await import('node-fetch')).default;
    const verifyResponse = await fetch('http://localhost:3000/api/advertiser/payments/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offerId: OFFER_ID,
        txSignature: tx,
        escrowPda: escrowPda.toBase58()
      })
    });

    const verifyResult = await verifyResponse.json();
    console.log('Verification response:', JSON.stringify(verifyResult, null, 2));

    if (verifyResponse.ok && verifyResult.verified) {
      console.log('\n========================================');
      console.log('✅ TEST PASSED - ESCROW FULLY FUNDED');
      console.log('========================================');
      console.log(`Offer status: ${verifyResult.offerStatus}`);
      console.log(`Escrow PDA: ${verifyResult.escrowPda}`);
      console.log(`Resource URL: ${verifyResult.resourceUrl}`);
      console.log('\nNext step: User can view ad and trigger settlement');
    } else {
      console.log('\n❌ Verification failed:', verifyResult);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.logs) {
      console.error('Program logs:', error.logs);
    }
    process.exit(1);
  }
}

fundEscrow().catch(console.error);
