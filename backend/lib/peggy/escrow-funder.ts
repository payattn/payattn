/**
 * Peggy Escrow Funder
 * Funds Solana escrows for accepted offers
 * Moved from /advertiser-agent/lib/escrow.js
 */

import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import { readFileSync } from 'fs';

// Import IDL - adjust path as needed
const IDL_PATH = process.env.SOLANA_IDL_PATH || 
  '/Users/jmd/nosync/org.payattn.main/solana/payattn_escrow/target/idl/payattn_escrow.json';

export interface X402PaymentDetails {
  offerId: string;
  escrowPda: string;
  paymentAmount: number;
  userPubkey: string;
  platformPubkey: string;
  programId: string;
}

export interface FundingResult {
  success: boolean;
  txSignature?: string;
  escrowPda?: string;
  error?: string;
}

export class EscrowFunder {
  private connection: Connection;
  private advertiserKeypair: Keypair;
  private programId: PublicKey;
  private program: Program;
  
  constructor() {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    this.connection = new Connection(rpcUrl, 'confirmed');
    
    this.advertiserKeypair = this.loadKeypair();
    
    const programIdStr = process.env.SOLANA_PROGRAM_ID || 
      '6ZEekbTJZ6D6KrfSGDY2ByoWENWfe8RzhvpBS4KtPdZr';
    this.programId = new PublicKey(programIdStr);
    
    this.program = this.createProgram();
  }
  
  /**
   * Load advertiser keypair from file
   */
  private loadKeypair(): Keypair {
    const keypairPath = process.env.ADVERTISER_KEYPAIR_PATH || 
      `${process.env.HOME}/.config/solana/advertiser.json`;
    
    try {
      const secretKey = JSON.parse(
        readFileSync(keypairPath, 'utf8')
      );
      return Keypair.fromSecretKey(new Uint8Array(secretKey));
    } catch (error) {
      throw new Error(
        `Failed to load advertiser keypair from ${keypairPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  /**
   * Create Anchor program instance
   */
  private createProgram(): Program {
    // Load IDL
    const idl = JSON.parse(readFileSync(IDL_PATH, 'utf8'));
    
    // Create wallet wrapper for Anchor
    class WalletWrapper {
      constructor(public keypair: Keypair) {}
      
      get publicKey() {
        return this.keypair.publicKey;
      }
      
      async signTransaction(tx: any) {
        tx.partialSign(this.keypair);
        return tx;
      }
      
      async signAllTransactions(txs: any[]) {
        return txs.map(tx => {
          tx.partialSign(this.keypair);
          return tx;
        });
      }
    }
    
    const wallet = new WalletWrapper(this.advertiserKeypair);
    
    const provider = new AnchorProvider(
      this.connection,
      wallet,
      { commitment: 'confirmed' }
    );
    
    return new Program(idl, provider);
  }
  
  /**
   * Fund an escrow on Solana
   */
  async fundEscrow(x402Data: X402PaymentDetails): Promise<FundingResult> {
    const { offerId, escrowPda, paymentAmount, userPubkey, platformPubkey } = x402Data;
    
    console.log(`\n💰 Funding escrow for offer ${offerId}...`);
    console.log(`   Amount: ${paymentAmount} lamports (${(paymentAmount / 1e9).toFixed(4)} SOL)`);
    console.log(`   Escrow PDA: ${escrowPda}`);
    
    try {
      // Derive PDA (should match escrowPda from backend)
      const [derivedPda, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from('escrow'), Buffer.from(offerId)],
        this.programId
      );
      
      if (derivedPda.toBase58() !== escrowPda) {
        throw new Error(
          `PDA mismatch! Backend: ${escrowPda}, Derived: ${derivedPda.toBase58()}`
        );
      }
      
      console.log(`   ✅ PDA verified (bump: ${bump})`);
      
      // Check balance
      const balance = await this.connection.getBalance(this.advertiserKeypair.publicKey);
      const requiredBalance = paymentAmount + 10000000; // Payment + 0.01 SOL for fees
      
      if (balance < requiredBalance) {
        throw new Error(
          `Insufficient balance: ${(balance / 1e9).toFixed(4)} SOL, ` +
          `need ${(requiredBalance / 1e9).toFixed(4)} SOL`
        );
      }
      
      // Call createEscrow instruction
      console.log(`   📤 Submitting transaction...`);
      
      const tx = await (this.program.methods as any)
        .createEscrow(
          offerId,
          new BN(paymentAmount)
        )
        .accounts({
          escrow: new PublicKey(escrowPda),
          advertiser: this.advertiserKeypair.publicKey,
          user: new PublicKey(userPubkey),
          platform: new PublicKey(platformPubkey),
          systemProgram: SystemProgram.programId
        })
        .rpc();
      
      console.log(`   ✅ Transaction submitted!`);
      console.log(`   Signature: ${tx}`);
      console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
      
      // Wait for confirmation
      console.log(`   ⏳ Waiting for confirmation...`);
      await this.connection.confirmTransaction(tx, 'confirmed');
      console.log(`   ✅ Transaction confirmed!`);
      
      return {
        success: true,
        txSignature: tx,
        escrowPda: escrowPda
      };
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`   ❌ Escrow funding failed:`, errorMsg);
      
      // Log program logs if available
      if (error && typeof error === 'object' && 'logs' in error) {
        console.error('   Program logs:');
        (error as any).logs?.forEach((log: string) => console.error(`      ${log}`));
      }
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }
  
  /**
   * Get advertiser wallet balance
   */
  async getBalance(): Promise<number> {
    const balance = await this.connection.getBalance(this.advertiserKeypair.publicKey);
    return balance / 1e9; // Convert to SOL
  }
  
  /**
   * Get advertiser public key
   */
  getPublicKey(): PublicKey {
    return this.advertiserKeypair.publicKey;
  }
}
