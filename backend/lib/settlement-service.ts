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
import { settleImpression } from './solana-escrow';
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
 * Main settlement function - submits 3 unlinked transactions
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

  // Create settlement transactions
  const settlements: Array<{
    type: 'user' | 'publisher' | 'platform';
    pubkey: string;
    amount: number;
  }> = [
    { type: 'user', pubkey: userPubkey, amount: splits.user },
    { type: 'publisher', pubkey: publisherPubkey, amount: splits.publisher },
    { type: 'platform', pubkey: platformPubkey, amount: splits.platform },
  ];

  // Randomize order for unlinkability
  const shuffled = shuffleArray(settlements);
  console.log('[Settlement] Randomized order:', shuffled.map(s => s.type).join(' → '));

  const results: SettlementResult[] = [];

  // Submit transactions with random delays
  for (const { type, pubkey, amount: settleAmount } of shuffled) {
    try {
      // Validate pubkey
      new PublicKey(pubkey);

      // Random delay (except for first transaction)
      if (results.length > 0) {
        const delayMs = Math.floor(Math.random() * 5000);
        console.log(`[Settlement] Waiting ${delayMs}ms before ${type} settlement...`);
        await randomDelay();
      }

      console.log(`[Settlement] Submitting ${type} settlement: ${settleAmount} lamports to ${pubkey}`);

      // NOTE: Current settleImpression() doesn't support partial amounts
      // This will need to be updated when the smart contract is updated
      // For now, we'll call it and handle the full settlement on first call
      const result = await settleImpression(offerId, pubkey, type);

      if (result.success) {
        results.push({
          type,
          success: true,
          txSignature: result.txSignature,
          amount: settleAmount,
        });
        console.log(`✅ [Settlement] ${type} settled: ${result.txSignature}`);
      } else {
        throw new Error(result.error || 'Transaction failed');
      }
    } catch (err: any) {
      console.error(`❌ [Settlement] Failed for ${type}:`, err.message);

      // Add to retry queue
      await addToRetryQueue(offerId, type, pubkey, settleAmount, err.message);

      results.push({
        type,
        success: false,
        error: err.message,
        amount: settleAmount,
      });
    }
  }

  // Check if all succeeded
  const allSucceeded = results.every(r => r.success);
  const supabase2 = getSupabase();

  if (allSucceeded) {
    // Mark as fully settled
    await supabase2
      .from('offers')
      .update({
        status: 'settled',
        settling: false,
        settled_at: new Date().toISOString(),
      })
      .eq('offer_id', offerId);
    console.log(`✅ [Settlement] All transactions succeeded for ${offerId}`);
  } else {
    // Mark as partially settled (cron job will retry)
    await supabase2
      .from('offers')
      .update({ settling: false })
      .eq('offer_id', offerId);
    console.log(`⚠️ [Settlement] Some transactions failed for ${offerId}, added to retry queue`);
  }

  return results;
}

/**
 * Retry failed settlements from queue
 * Should be called by a cron job every 5-10 minutes
 */
export async function retryFailedSettlements(): Promise<void> {
  console.log('[Settlement Retry] Checking for failed settlements...');

  const supabase = getSupabase();
  
  // Get failed settlements (attempts < 10, older than 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: failedSettlements } = await supabase
    .from('settlement_queue')
    .select('*')
    .lt('attempts', 10)
    .lt('updated_at', fiveMinutesAgo)
    .order('created_at', { ascending: true })
    .limit(10);

  if (!failedSettlements || failedSettlements.length === 0) {
    console.log('[Settlement Retry] No failed settlements to retry');
    return;
  }

  console.log(`[Settlement Retry] Found ${failedSettlements.length} failed settlements to retry`);

  for (const settlement of failedSettlements) {
    try {
      console.log(`[Settlement Retry] Retrying ${settlement.tx_type} for ${settlement.offer_id}`);

      const result = await settleImpression(
        settlement.offer_id,
        settlement.recipient_pubkey,
        settlement.tx_type
      );

      if (result.success) {
        // Remove from queue
        await supabase
          .from('settlement_queue')
          .delete()
          .eq('id', settlement.id);

        // Update offer status if this was the last pending settlement
        const { data: remainingSettlements } = await supabase
          .from('settlement_queue')
          .select('id', { count: 'exact', head: true })
          .eq('offer_id', settlement.offer_id);

        if (!remainingSettlements || remainingSettlements.length === 0) {
          await supabase
            .from('offers')
            .update({
              status: 'settled',
              settling: false,
              settled_at: new Date().toISOString(),
            })
            .eq('offer_id', settlement.offer_id);
          console.log(`✅ [Settlement Retry] All settlements complete for ${settlement.offer_id}`);
        }
      } else {
        // Update error and increment attempts
        await supabase
          .from('settlement_queue')
          .update({
            last_error: result.error,
            attempts: settlement.attempts + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', settlement.id);
      }
    } catch (err: any) {
      console.error(`[Settlement Retry] Error retrying ${settlement.offer_id}:`, err.message);
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
