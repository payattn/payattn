/**
 * Solana Escrow Service
 * 
 * Handles all interactions with the Payattn escrow smart contract:
 * - Deriving escrow PDAs (Program Derived Addresses)
 * - Verifying escrow accounts on-chain
 * - Submitting settlement transactions
 * 
 * This is the DIY x402 facilitator for the Payattn platform.
 */

import { 
  Connection, 
  PublicKey, 
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet';
import idl from '../../solana/payattn_escrow/target/idl/payattn_escrow.json';
import type { PayattnEscrow } from '../../solana/payattn_escrow/target/types/payattn_escrow';
import fs from 'fs';

// Environment configuration
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey(process.env.SOLANA_PROGRAM_ID || '6ZEekbTJZ6D6KrfSGDY2ByoWENWfe8RzhvpBS4KtPdZr');
const PLATFORM_KEYPAIR_PATH = process.env.SOLANA_PLATFORM_KEYPAIR_PATH || 
  `${process.env.HOME}/.config/solana/payattn-backend.json`;

// Initialize Solana connection
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// Load platform wallet (used for signing settlement transactions)
let platformWallet: Keypair;
try {
  const keypairData = JSON.parse(fs.readFileSync(PLATFORM_KEYPAIR_PATH, 'utf-8'));
  platformWallet = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  console.log('✅ Platform wallet loaded:', platformWallet.publicKey.toBase58());
} catch (err) {
  console.error('❌ Failed to load platform wallet:', err);
  throw new Error('Platform wallet not configured');
}

// Initialize Anchor program
const wallet = new NodeWallet(platformWallet);
const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
const program = new Program(idl as any, provider) as Program<PayattnEscrow>;

/**
 * Derive the PDA (Program Derived Address) for an escrow account
 * Uses the same seeds as the smart contract: ["escrow", offer_id]
 */
export async function derivePDA(offerId: string): Promise<[PublicKey, number]> {
  const [pda, bump] = await PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), Buffer.from(offerId)],
    PROGRAM_ID
  );
  
  console.log(`PDA derived for offer ${offerId}:`, pda.toBase58());
  return [pda, bump];
}

/**
 * Verify an escrow account exists on-chain with expected parameters
 * This is called after Peggy (advertiser agent) funds the escrow
 */
export async function verifyEscrow(
  offerId: string,
  expectedAmount: number,
  expectedUserPubkey: string,
  expectedAdvertiserPubkey: string,
  expectedPublisherPubkey?: string  // Optional for now (will be removed from contract later)
): Promise<{ valid: boolean; escrowPda: string; error?: string }> {
  try {
    const [escrowPda] = await derivePDA(offerId);
    
    // Fetch escrow account data from blockchain
    const escrowAccount = await program.account.escrow.fetch(escrowPda);
    
    console.log('Escrow account data:', {
      offerId: escrowAccount.offerId,
      amount: escrowAccount.amount.toString(),
      userSettled: escrowAccount.userSettled,
      publisherSettled: escrowAccount.publisherSettled,
      platformSettled: escrowAccount.platformSettled,
      advertiser: escrowAccount.advertiser.toBase58(),
      user: escrowAccount.user.toBase58(),
      platform: escrowAccount.platform.toBase58()
    });
    
    // Verify escrow not fully settled
    if (escrowAccount.userSettled && escrowAccount.publisherSettled && escrowAccount.platformSettled) {
      return {
        valid: false,
        escrowPda: escrowPda.toBase58(),
        error: 'Escrow already fully settled'
      };
    }
    
    if (escrowAccount.amount.toNumber() !== expectedAmount) {
      return {
        valid: false,
        escrowPda: escrowPda.toBase58(),
        error: `Amount mismatch: expected ${expectedAmount}, got ${escrowAccount.amount.toNumber()}`
      };
    }
    
    if (escrowAccount.user.toBase58() !== expectedUserPubkey) {
      return {
        valid: false,
        escrowPda: escrowPda.toBase58(),
        error: 'User pubkey mismatch'
      };
    }
    
    if (escrowAccount.advertiser.toBase58() !== expectedAdvertiserPubkey) {
      return {
        valid: false,
        escrowPda: escrowPda.toBase58(),
        error: 'Advertiser pubkey mismatch'
      };
    }
    
    console.log('✅ Escrow verification passed');
    return {
      valid: true,
      escrowPda: escrowPda.toBase58()
    };
    
  } catch (err: any) {
    console.error('❌ Escrow verification failed:', err);
    return {
      valid: false,
      escrowPda: '',
      error: err.message || 'Escrow account not found'
    };
  }
}

/**
 * Settle user portion (70%) of escrow
 * Part of privacy-preserving 3-transaction settlement flow
 */
export async function settleUser(
  offerId: string,
  userPubkey: string
): Promise<{ success: boolean; txSignature?: string; error?: string }> {
  try {
    const [escrowPda] = await derivePDA(offerId);
    const user = new PublicKey(userPubkey);
    
    console.log(`Settling user (70%):`, {
      offerId,
      escrowPda: escrowPda.toBase58(),
      user: userPubkey
    });
    
    const accounts = {
      escrow: escrowPda,
      user,
      systemProgram: SystemProgram.programId,
    };
    
    const txSignature = await program.methods
      .settleUser()
      .accounts(accounts)
      .rpc();
    
    console.log(`✅ User settlement tx:`, txSignature);
    await connection.confirmTransaction(txSignature, 'confirmed');
    
    return { success: true, txSignature };
    
  } catch (err: any) {
    console.error(`❌ User settlement failed:`, err);
    return { success: false, error: err.message || 'Transaction failed' };
  }
}

/**
 * Settle publisher portion (25%) of escrow
 * Part of privacy-preserving 3-transaction settlement flow
 */
export async function settlePublisher(
  offerId: string,
  publisherPubkey: string
): Promise<{ success: boolean; txSignature?: string; error?: string }> {
  try {
    const [escrowPda] = await derivePDA(offerId);
    const publisher = new PublicKey(publisherPubkey);
    
    console.log(`Settling publisher (25%):`, {
      offerId,
      escrowPda: escrowPda.toBase58(),
      publisher: publisherPubkey
    });
    
    const accounts = {
      escrow: escrowPda,
      publisher,
      systemProgram: SystemProgram.programId,
    };
    
    const txSignature = await program.methods
      .settlePublisher()
      .accounts(accounts)
      .rpc();
    
    console.log(`✅ Publisher settlement tx:`, txSignature);
    await connection.confirmTransaction(txSignature, 'confirmed');
    
    return { success: true, txSignature };
    
  } catch (err: any) {
    console.error(`❌ Publisher settlement failed:`, err);
    return { success: false, error: err.message || 'Transaction failed' };
  }
}

/**
 * Settle platform portion (5%) of escrow
 * Part of privacy-preserving 3-transaction settlement flow
 * This should be called LAST as it validates all parties have been settled
 */
export async function settlePlatform(
  offerId: string,
  platformPubkey: string
): Promise<{ success: boolean; txSignature?: string; error?: string }> {
  try {
    const [escrowPda] = await derivePDA(offerId);
    const platform = new PublicKey(platformPubkey);
    
    console.log(`Settling platform (5%):`, {
      offerId,
      escrowPda: escrowPda.toBase58(),
      platform: platformPubkey
    });
    
    const accounts = {
      escrow: escrowPda,
      platform,
      systemProgram: SystemProgram.programId,
    };
    
    const txSignature = await program.methods
      .settlePlatform()
      .accounts(accounts)
      .rpc();
    
    console.log(`✅ Platform settlement tx:`, txSignature);
    await connection.confirmTransaction(txSignature, 'confirmed');
    
    return { success: true, txSignature };
    
  } catch (err: any) {
    console.error(`❌ Platform settlement failed:`, err);
    return { success: false, error: err.message || 'Transaction failed' };
  }
}

/**
 * Get the current balance of an escrow account
 */
export async function getEscrowBalance(offerId: string): Promise<number> {
  try {
    const [escrowPda] = await derivePDA(offerId);
    const balance = await connection.getBalance(escrowPda);
    return balance;
  } catch (err) {
    console.error('Failed to get escrow balance:', err);
    return 0;
  }
}

/**
 * Get escrow account details
 */
export async function getEscrowDetails(offerId: string) {
  try {
    const [escrowPda] = await derivePDA(offerId);
    const escrowAccount = await program.account.escrow.fetch(escrowPda);
    const balance = await connection.getBalance(escrowPda);
    
    return {
      offerId: escrowAccount.offerId,
      advertiser: escrowAccount.advertiser.toBase58(),
      user: escrowAccount.user.toBase58(),
      platform: escrowAccount.platform.toBase58(),
      amount: escrowAccount.amount.toNumber(),
      createdAt: escrowAccount.createdAt.toNumber(),
      userSettled: escrowAccount.userSettled,
      publisherSettled: escrowAccount.publisherSettled,
      platformSettled: escrowAccount.platformSettled,
      bump: escrowAccount.bump,
      balance,
      pda: escrowPda.toBase58()
    };
  } catch (err) {
    console.error('Failed to get escrow details:', err);
    return null;
  }
}

/**
 * Export platform wallet pubkey for x402 headers
 */
export function getPlatformPubkey(): string {
  return platformWallet.publicKey.toBase58();
}

/**
 * Export program ID for x402 headers
 */
export function getProgramId(): string {
  return PROGRAM_ID.toBase58();
}

// Export connection for use in other modules
export { connection, program, PROGRAM_ID };
