/**
 * Privacy-Preserving Settlement Service
 * 
 * Implements WP-SOL-04: Submit 3 unlinked transactions after user views ad
 * - 70% to user
 * - 25% to publisher
 * - 5% to platform
 * 
 * Privacy Features:
 * - Transactions submitted in random order
 * - Random delays between submissions (0-5 seconds)
 * - Makes it harder to link transactions to specific impression
 * 
 * Reliability:
 * - Tracks settlement status in database
 * - Failed transactions added to retry queue
 * - Prevents refunds during settlement process
 */

import { PublicKey } from '@solana/web3.js';
import { settleUser, settlePublisher, settlePlatform } from './solana-escrow';
import { getSupabase } from './supabase';

export interface SettlementRequest {
  offerId: string;
  userPubkey: string;
  publisherPubkey: string;
  amount: number; // total escrow amount in lamports
}

export interface SettlementResult {
  type: 'user' | 'publisher' | 'platform';
  success: boolean;
  txSignature?: string;
  error?: string;
  amount: number;
}

/**
 * Calculate settlement amounts (70% user, 25% publisher, 5% platform)
 */
function calculateSplits(totalAmount: number): {
  user: number;
  publisher: number;
  platform: number;
} {
  const userAmount = Math.floor(totalAmount * 0.70);
  const publisherAmount = Math.floor(totalAmount * 0.25);
  const platformAmount = totalAmount - userAmount - publisherAmount; // remainder

  return { user: userAmount, publisher: publisherAmount, platform: platformAmount };
}

/**
 * Shuffle array for random transaction ordering
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp!;
  }
  return shuffled;
}

/**
 * Random delay between transactions (0-5 seconds)
 */
function randomDelay(): Promise<void> {
  const delayMs = Math.floor(Math.random() * 5000);
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

/**
 * Add failed settlement to retry queue
 */
async function addToRetryQueue(
  offerId: string,
  txType: 'user' | 'publisher' | 'platform',
  recipientPubkey: string,
  amount: number,
  error: string
): Promise<void> {
  const supabase = getSupabase();
  
  await supabase
    .from('settlement_queue')
    .upsert({
      offer_id: offerId,
      tx_type: txType,
      recipient_pubkey: recipientPubkey,
      amount,
      last_error: error,
      attempts: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'offer_id,tx_type',
    });
}

/**
 * Main settlement function - submits 3 separate privacy-preserving transactions
 * 
 * Implements the privacy-preserving approach with:
 * - 3 separate transactions (user, publisher, platform)
 * - Random ordering of transactions
 * - Random delays between transactions (0-5 seconds)
 * 
 * This makes it harder to link transactions and track user/publisher relationships
 */
export async function settleWithPrivacy(
  settlement: SettlementRequest
): Promise<SettlementResult[]> {
  const { offerId, userPubkey, publisherPubkey, amount } = settlement;
  
  // Get platform pubkey from environment
  const platformPubkey = process.env.SOLANA_PLATFORM_PUBKEY;
  if (!platformPubkey) {
    throw new Error('SOLANA_PLATFORM_PUBKEY not configured');
  }

  console.log(`[Settlement] Starting privacy-preserving settlement for ${offerId}`);
  console.log(`[Settlement] Total amount: ${amount} lamports`);

  // Calculate splits
  const splits = calculateSplits(amount);
  console.log('[Settlement] Splits:', splits);

  // Mark as "settling" to prevent refunds during process
  const supabase = getSupabase();
  await supabase
    .from('offers')
    .update({ settling: true })
    .eq('offer_id', offerId);

  // Create 3 separate settlement tasks with random order
  const settlements = [
    { type: 'user' as const, pubkey: userPubkey, amount: splits.user, fn: settleUser },
    { type: 'publisher' as const, pubkey: publisherPubkey, amount: splits.publisher, fn: settlePublisher },
    { type: 'platform' as const, pubkey: platformPubkey, amount: splits.platform, fn: settlePlatform }
  ];

  // Randomize order for unlinkability
  const shuffled = shuffleArray(settlements);
  console.log('[Settlement] Random order:', shuffled.map(s => s.type).join(' [OK] '));

  const results: SettlementResult[] = [];

  for (const { type, pubkey, amount, fn } of shuffled) {
    try {
      // Validate pubkey
      new PublicKey(pubkey);

      // Random delay before each transaction (0-5 seconds)
      if (results.length > 0) {
        const delayMs = Math.floor(Math.random() * 5000);
        console.log(`[Settlement] Waiting ${delayMs}ms before ${type} settlement...`);
        await randomDelay();
      }

      console.log(`[Settlement] Settling ${type}: ${pubkey} (${amount} lamports)`);
      const result = await fn(offerId, pubkey);

      if (result.success) {
        results.push({
          type,
          success: true,
          txSignature: result.txSignature,
          amount,
        });
        // Demo-friendly logging
        const amountSOL = (amount / 1e9).toFixed(6);
        if (type === 'user') {
          console.log(`[PAID] USER HAS BEEN PAID: ${amountSOL} SOL (${amount} lamports)`);
        } else if (type === 'publisher') {
          console.log(`[PAID] PUBLISHER HAS BEEN PAID: ${amountSOL} SOL (${amount} lamports)`);
        } else if (type === 'platform') {
          console.log(`[PAID] PLATFORM HAS BEEN PAID: ${amountSOL} SOL (${amount} lamports)`);
        }
        console.log(`   Transaction: ${result.txSignature}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${result.txSignature}?cluster=devnet`);
      } else {
        throw new Error(result.error || 'Transaction failed');
      }

    } catch (err: any) {
      console.error(`[OK][OK][OK] [Settlement] ${type} settlement failed:`, err.message);

      // Add to retry queue
      await addToRetryQueue(offerId, type, pubkey, amount, err.message);

      results.push({
        type,
        success: false,
        error: err.message,
        amount,
      });
    }
  }

  // Check if all succeeded
  const allSucceeded = results.every(r => r.success);

  if (allSucceeded) {
    // Mark as fully settled
    await supabase
      .from('offers')
      .update({
        status: 'settled',
        settling: false,
        settled_at: new Date().toISOString(),
      })
      .eq('offer_id', offerId);
    
    console.log(`\n*** ALL PAYMENTS COMPLETE FOR ${offerId}`);
    console.log(`   [OK][OK] User paid (70%)`);
    console.log(`   [OK][OK] Publisher paid (25%)`);
    console.log(`   [OK][OK] Platform paid (5%)`);
    console.log(`   Total distributed: ${amount} lamports (${(amount / 1e9).toFixed(6)} SOL)\n`);
  } else {
    // Mark as not settling (cron job will retry)
    await supabase
      .from('offers')
      .update({ settling: false })
      .eq('offer_id', offerId);
    
    console.log(`[OK][OK] [Settlement] Some transactions failed for ${offerId}, added to retry queue`);
  }

  return results;
}

/**
 * Retry failed settlements from queue
 * Should be called by a cron job every 5-10 minutes
 * 
 * Retries individual failed transactions (user, publisher, or platform)
 */
export async function retryFailedSettlements(): Promise<void> {
  console.log('[Settlement Retry] Checking for failed settlements...');

  const supabase = getSupabase();
  
  // Get failed settlements
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: failedSettlements } = await supabase
    .from('settlement_queue')
    .select('*')
    .lt('attempts', 10)
    .lt('updated_at', fiveMinutesAgo)
    .order('created_at', { ascending: true })
    .limit(50);

  if (!failedSettlements || failedSettlements.length === 0) {
    console.log('[Settlement Retry] No failed settlements to retry');
    return;
  }

  console.log(`[Settlement Retry] Found ${failedSettlements.length} failed settlements to retry`);

  for (const entry of failedSettlements) {
    try {
      console.log(`[Settlement Retry] Retrying ${entry.tx_type} settlement for ${entry.offer_id}`);

      // Choose the appropriate settlement function
      let result;
      if (entry.tx_type === 'user') {
        result = await settleUser(entry.offer_id, entry.recipient_pubkey);
      } else if (entry.tx_type === 'publisher') {
        result = await settlePublisher(entry.offer_id, entry.recipient_pubkey);
      } else if (entry.tx_type === 'platform') {
        result = await settlePlatform(entry.offer_id, entry.recipient_pubkey);
      } else {
        console.error(`[Settlement Retry] Unknown tx_type: ${entry.tx_type}`);
        continue;
      }

      if (result.success) {
        // Remove from queue
        await supabase
          .from('settlement_queue')
          .delete()
          .eq('id', entry.id);

        console.log(`[OK][OK][OK] [Settlement Retry] ${entry.tx_type} settlement complete for ${entry.offer_id}`);

        // Check if all settlements are complete
        const { data: remaining } = await supabase
          .from('settlement_queue')
          .select('id')
          .eq('offer_id', entry.offer_id);

        if (!remaining || remaining.length === 0) {
          // All settlements complete
          await supabase
            .from('offers')
            .update({
              status: 'settled',
              settling: false,
              settled_at: new Date().toISOString(),
            })
            .eq('offer_id', entry.offer_id);
          
          console.log(`[OK][OK][OK] [Settlement Retry] All settlements complete for ${entry.offer_id}`);
        }
      } else {
        // Update error and increment attempts
        await supabase
          .from('settlement_queue')
          .update({
            last_error: result.error,
            attempts: entry.attempts + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', entry.id);
        
        console.log(`[OK][OK] [Settlement Retry] ${entry.tx_type} settlement still failing for ${entry.offer_id}`);
      }
    } catch (err: any) {
      console.error(`[Settlement Retry] Error retrying ${entry.offer_id}:`, err.message);
      
      // Increment attempts
      await supabase
        .from('settlement_queue')
        .update({
          last_error: err.message,
          attempts: entry.attempts + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entry.id);
    }
  }
}

/**
 * Get failed settlements for admin dashboard
 */
export async function getFailedSettlements(): Promise<any[]> {
  const supabase = getSupabase();
  
  const { data } = await supabase
    .from('settlement_queue')
    .select(`
      *,
      offers:offer_id (
        amount_lamports,
        status
      )
    `)
    .lt('attempts', 10)
    .order('created_at', { ascending: false })
    .limit(100);

  return data || [];
}
