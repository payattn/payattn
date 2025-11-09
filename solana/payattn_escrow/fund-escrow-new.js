#!/usr/bin/env node

/**
 * Fund New Escrow with Updated Contract
 * Creates an escrow with the new 3-settlement structure
 */

const { Connection, Keypair, PublicKey, SystemProgram } = require('@solana/web3.js');
const { AnchorProvider, Program, Wallet, BN } = require('@coral-xyz/anchor');
const fs = require('fs');

// Configuration - NEW OFFER ID
const OFFER_ID = 'offer_test_v3_' + Date.now();
const AMOUNT_LAMPORTS = new BN(10_000_000); // 0.01 SOL
const RPC_URL = 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey('6ZEekbTJZ6D6KrfSGDY2ByoWENWfe8RzhvpBS4KtPdZr');
const ADVERTISER_KEYPAIR_PATH = `${process.env.HOME}/.config/solana/advertiser.json`;
const USER_PUBKEY = new PublicKey('9kXHUnoYjB7eVUafsKFibrdHJWiYiX26vP7p7QX77nux');
const PLATFORM_PUBKEY = new PublicKey('G6Lbdq9JyQ3QR5YvKqpVC9KjPqAd9hSwWtHv3bPDrWTY');

async function fundEscrow() {
  console.log('========================================');
  console.log('CREATING NEW ESCROW (Updated Contract)');
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

  console.log('Offer ID:', OFFER_ID);
  console.log('Escrow PDA:', escrowPda.toBase58());
  console.log('Amount:', AMOUNT_LAMPORTS.toString(), 'lamports (0.01 SOL)');
  console.log('User:', USER_PUBKEY.toBase58());
  console.log('Platform:', PLATFORM_PUBKEY.toBase58());
  console.log('\nCreating escrow on-chain...\n');

  try {
    // Create escrow instruction
    const tx = await program.methods
      .createEscrow(OFFER_ID, AMOUNT_LAMPORTS)
      .accounts({
        escrow: escrowPda,
        advertiser: advertiserKeypair.publicKey,
        user: USER_PUBKEY,
        platform: PLATFORM_PUBKEY,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log('✅ Escrow created!');
    console.log('Transaction:', tx);
    console.log('Explorer:', `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
    console.log('\nWaiting for confirmation...\n');

    // Wait for confirmation
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Fetch and verify escrow
    const escrowAccount = await program.account.escrow.fetch(escrowPda);
    console.log('✅ Escrow verified on-chain!');
    console.log('\nEscrow details:');
    console.log('  Offer ID:', escrowAccount.offerId);
    console.log('  Amount:', escrowAccount.amount.toString(), 'lamports');
    console.log('  User Settled:', escrowAccount.userSettled);
    console.log('  Publisher Settled:', escrowAccount.publisherSettled);
    console.log('  Platform Settled:', escrowAccount.platformSettled);
    console.log('  Advertiser:', escrowAccount.advertiser.toBase58());
    console.log('  User:', escrowAccount.user.toBase58());
    console.log('  Platform:', escrowAccount.platform.toBase58());

    console.log('\n========================================');
    console.log('✅ SUCCESS - NEW ESCROW CREATED');
    console.log('========================================');
    console.log(`\nOffer ID: ${OFFER_ID}`);
    console.log(`Escrow PDA: ${escrowPda.toBase58()}`);
    console.log(`Transaction: ${tx}`);
    console.log('\nTo test settlement, run:');
    console.log(`\ncurl -X POST "http://localhost:3000/api/publisher/impressions" \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"offerId": "${OFFER_ID}", "publisherId": "pub_001", "duration": 2000}'`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.logs) {
      console.error('\nProgram logs:');
      error.logs.forEach(log => console.error('  ', log));
    }
    process.exit(1);
  }
}

fundEscrow().catch(console.error);
