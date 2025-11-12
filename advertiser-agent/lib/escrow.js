import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { BN } from 'bn.js';
import { readFileSync } from 'fs';
import { config } from '../config.js';

// Import IDL from smart contract
const idl = JSON.parse(
  readFileSync('/Users/jmd/nosync/org.payattn.main/solana/payattn_escrow/target/idl/payattn_escrow.json', 'utf8')
);

export class EscrowFunder {
  constructor() {
    this.connection = new Connection(config.solanaRpcUrl, 'confirmed');
    this.advertiserKeypair = this.loadKeypair();
    this.programId = new PublicKey(config.programId);
    this.program = this.createProgram();
  }
  
  /**
   * Load advertiser keypair from file
   */
  loadKeypair() {
    try {
      const secretKey = JSON.parse(
        readFileSync(config.advertiserKeypairPath, 'utf8')
      );
      return Keypair.fromSecretKey(new Uint8Array(secretKey));
    } catch (error) {
      throw new Error(`Failed to load advertiser keypair: ${error.message}`);
    }
  }
  
  /**
   * Create Anchor program instance
   */
  createProgram() {
    // Create wallet wrapper
    class WalletWrapper {
      constructor(keypair) {
        this.keypair = keypair;
        this.publicKey = keypair.publicKey;
      }
      
      async signTransaction(tx) {
        tx.partialSign(this.keypair);
        return tx;
      }
      
      async signAllTransactions(txs) {
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
    
    // Create program without explicit program ID (it's in the IDL)
    return new Program(idl, provider);
  }
  
  /**
   * Fund an escrow on Solana
   * @param {Object} x402Data - Payment details from x402 response
   * @returns {Promise<string>} Transaction signature
   */
  async fundEscrow(x402Data) {
    const { offerId, escrowPda, paymentAmount, userPubkey, platformPubkey } = x402Data;
    
    console.log(`\n[OK][OK] Funding escrow for offer ${offerId}...`);
    console.log(`   Amount: ${paymentAmount} lamports (${(paymentAmount / 1e9).toFixed(4)} SOL)`);
    console.log(`   Escrow PDA: ${escrowPda}`);
    
    try {
      // Derive PDA (should match escrowPda from backend)
      const [derivedPda, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from('escrow'), Buffer.from(offerId)],
        this.programId
      );
      
      if (derivedPda.toBase58() !== escrowPda) {
        throw new Error(`PDA mismatch! Backend: ${escrowPda}, Derived: ${derivedPda.toBase58()}`);
      }
      
      console.log(`   [OK][OK][OK] PDA verified (bump: ${bump})`);
      
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
      console.log(`   [OK][OK] Submitting transaction...`);
      
      const tx = await this.program.methods
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
      
      console.log(`   [OK][OK][OK] Transaction submitted!`);
      console.log(`   Signature: ${tx}`);
      console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
      
      // Wait for confirmation
      console.log(`   [OK] Waiting for confirmation...`);
      await this.connection.confirmTransaction(tx, 'confirmed');
      console.log(`   [OK][OK][OK] Transaction confirmed!`);
      
      return tx;
      
    } catch (error) {
      console.error(`   [OK][OK][OK] Escrow funding failed:`, error.message);
      
      // Log more details for debugging
      if (error.logs) {
        console.error('   Program logs:');
        error.logs.forEach(log => console.error(`      ${log}`));
      }
      
      throw error;
    }
  }
  
  /**
   * Get advertiser wallet balance
   * @returns {Promise<number>} Balance in SOL
   */
  async getBalance() {
    const balance = await this.connection.getBalance(this.advertiserKeypair.publicKey);
    return balance / 1e9; // Convert to SOL
  }
  
  /**
   * Get advertiser public key
   * @returns {PublicKey}
   */
  getPublicKey() {
    return this.advertiserKeypair.publicKey;
  }
}
