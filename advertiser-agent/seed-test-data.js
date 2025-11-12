#!/usr/bin/env node

/**
 * Seed Test Data for Peggy Development
 * 
 * Creates test advertiser, users, and offers in the database
 * so Peggy can fetch and evaluate them without needing Max agent.
 * 
 * Usage:
 *   npm run seed         # Create test data
 *   npm run seed:clean   # Clean up test data
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Test data configuration
const TEST_ADVERTISER = {
  advertiser_id: 'adv_001',
  name: 'Nike Golf Championship Campaign',
  wallet_pubkey: 'AE6uwbubDn9WyXrpzvqU58jfirvqZAxWCZCfDDwW5MMb'
};

const TEST_USERS = [
  {
    user_id: 'user_test_001',
    wallet_pubkey: '9kXHUnoYjB7eVUafsKFibrdHJWiYiX26vP7p7QX77nux'
  },
  {
    user_id: 'user_test_002',
    wallet_pubkey: 'BPqKfGj8vXZMwF3zYnVq7JCfZ4Rn9mLwKsHj6tPdU8Qx'
  },
  {
    user_id: 'user_test_003',
    wallet_pubkey: 'CRtLhKj9wY2NxG4aZoWr8KDgA5So0nMxLtIk7uQeV9Ry'
  }
];

const TEST_OFFERS = [
  {
    offer_id: 'offer_peggy_test_001',
    advertiser_id: 'adv_001',
    user_id: 'user_test_001',
    user_pubkey: '9kXHUnoYjB7eVUafsKFibrdHJWiYiX26vP7p7QX77nux',
    ad_id: 'ad_nike_golf_001',
    amount_lamports: 25000000, // 0.025 SOL = $0.025 @ $1/SOL (good price for 5/5 match)
    status: 'offer_made',
    match_score: 5,
    user_reputation: 0.92,
    historical_ctr: 15.2,
    historical_conversion: 3.8
  },
  {
    offer_id: 'offer_peggy_test_002',
    advertiser_id: 'adv_001',
    user_id: 'user_test_002',
    user_pubkey: 'BPqKfGj8vXZMwF3zYnVq7JCfZ4Rn9mLwKsHj6tPdU8Qx',
    ad_id: 'ad_nike_golf_001',
    amount_lamports: 20000000, // 0.020 SOL = $0.020 @ $1/SOL (excellent price for 4/5 match)
    status: 'offer_made',
    match_score: 4,
    user_reputation: 0.88,
    historical_ctr: 12.5,
    historical_conversion: 3.2
  },
  {
    offer_id: 'offer_peggy_test_003',
    advertiser_id: 'adv_001',
    user_id: 'user_test_003',
    user_pubkey: 'CRtLhKj9wY2NxG4aZoWr8KDgA5So0nMxLtIk7uQeV9Ry',
    ad_id: 'ad_nike_golf_001',
    amount_lamports: 35000000, // 0.035 SOL = $0.035 @ $1/SOL (overpriced for 3/5 match - should reject)
    status: 'offer_made',
    match_score: 3,
    user_reputation: 0.75,
    historical_ctr: 8.3,
    historical_conversion: 1.9
  },
  {
    offer_id: 'offer_peggy_test_004',
    advertiser_id: 'adv_001',
    user_id: 'user_test_001',
    user_pubkey: '9kXHUnoYjB7eVUafsKFibrdHJWiYiX26vP7p7QX77nux',
    ad_id: 'ad_nike_golf_001',
    amount_lamports: 15000000, // 0.015 SOL = $0.015 @ $1/SOL (great deal for 5/5 match - should accept)
    status: 'offer_made',
    match_score: 5,
    user_reputation: 0.95,
    historical_ctr: 18.7,
    historical_conversion: 4.5
  },
  {
    offer_id: 'offer_peggy_test_005',
    advertiser_id: 'adv_001',
    user_id: 'user_test_002',
    user_pubkey: 'BPqKfGj8vXZMwF3zYnVq7JCfZ4Rn9mLwKsHj6tPdU8Qx',
    ad_id: 'ad_nike_golf_001',
    amount_lamports: 50000000, // 0.050 SOL = $0.050 @ $1/SOL (way overpriced for 2/5 match - should reject)
    status: 'offer_made',
    match_score: 2,
    user_reputation: 0.65,
    historical_ctr: 5.1,
    historical_conversion: 0.8
  }
];

/**
 * Clean up test data
 */
async function cleanupTestData() {
  console.log('[OK][OK] Cleaning up test data...\n');
  
  try {
    // Delete test offers
    const { error: offersError } = await supabase
      .from('offers')
      .delete()
      .like('offer_id', 'offer_peggy_test_%');
    
    if (offersError) {
      console.error('[OK][OK][OK] Error deleting offers:', offersError);
    } else {
      console.log('[OK][OK][OK] Deleted test offers');
    }
    
    // Delete test users
    const { error: usersError } = await supabase
      .from('users')
      .delete()
      .like('user_id', 'user_test_%');
    
    if (usersError) {
      console.error('[OK][OK][OK] Error deleting users:', usersError);
    } else {
      console.log('[OK][OK][OK] Deleted test users');
    }
    
    // Delete test advertiser
    const { error: advertiserError } = await supabase
      .from('advertisers')
      .delete()
      .eq('advertiser_id', 'adv_001');
    
    if (advertiserError) {
      console.error('[OK][OK][OK] Error deleting advertiser:', advertiserError);
    } else {
      console.log('[OK][OK][OK] Deleted test advertiser');
    }
    
    console.log('\n[OK][OK][OK] Cleanup complete!\n');
    
  } catch (error) {
    console.error('[OK][OK][OK] Cleanup failed:', error);
    process.exit(1);
  }
}

/**
 * Seed test data
 */
async function seedTestData() {
  console.log('[OK][OK][OK] Seeding test data for Peggy...\n');
  
  try {
    // 1. Create test advertiser
    console.log('Creating test advertiser...');
    const { data: advertiser, error: advertiserError } = await supabase
      .from('advertisers')
      .upsert(TEST_ADVERTISER, { onConflict: 'advertiser_id' })
      .select()
      .single();
    
    if (advertiserError) {
      console.error('[OK][OK][OK] Error creating advertiser:', advertiserError);
      throw advertiserError;
    }
    
    console.log('[OK][OK][OK] Advertiser created:', advertiser.advertiser_id);
    console.log(`   Name: ${advertiser.name}`);
    console.log(`   Wallet: ${advertiser.wallet_pubkey}\n`);
    
    // 2. Create test users
    console.log('Creating test users...');
    for (const user of TEST_USERS) {
      const { data, error } = await supabase
        .from('users')
        .upsert(user, { onConflict: 'user_id' })
        .select()
        .single();
      
      if (error) {
        console.error(`[OK][OK][OK] Error creating user ${user.user_id}:`, error);
      } else {
        console.log(`[OK][OK][OK] User created: ${data.user_id}`);
      }
    }
    console.log('');
    
    // 3. Create test offers
    console.log('Creating test offers...');
    console.log('Expected LLM decisions:\n');
    
    for (const offer of TEST_OFFERS) {
      // Note: We're storing extra fields (match_score, etc.) as metadata
      // The actual database only has the core fields from the schema
      const dbOffer = {
        offer_id: offer.offer_id,
        advertiser_id: offer.advertiser_id,
        user_id: offer.user_id,
        user_pubkey: offer.user_pubkey,
        ad_id: offer.ad_id,
        amount_lamports: offer.amount_lamports,
        status: offer.status
      };
      
      const { data, error } = await supabase
        .from('offers')
        .upsert(dbOffer, { onConflict: 'offer_id' })
        .select()
        .single();
      
      if (error) {
        console.error(`[OK][OK][OK] Error creating offer ${offer.offer_id}:`, error);
      } else {
        const priceSOL = (offer.amount_lamports / 1e9).toFixed(3);
        const priceUSD = (offer.amount_lamports / 1e9).toFixed(3);
        const expectedDecision = 
          (offer.match_score >= 4 && offer.amount_lamports <= 25000000) ? ' ACCEPT' :
          (offer.match_score === 3 && offer.amount_lamports <= 18000000) ? ' ACCEPT' :
          ' REJECT';
        
        console.log(`${expectedDecision} | ${data.offer_id}`);
        console.log(`   Match: ${offer.match_score}/5 | Price: ${priceSOL} SOL ($${priceUSD}) | Rep: ${(offer.user_reputation * 100).toFixed(0)}%`);
      }
    }
    
    console.log('\n[OK][OK][OK] Test data seeded successfully!\n');
    console.log('[OK][OK] Summary:');
    console.log(`   Advertiser: 1 (${TEST_ADVERTISER.advertiser_id})`);
    console.log(`   Users: ${TEST_USERS.length}`);
    console.log(`   Offers: ${TEST_OFFERS.length} (mix of good and bad offers)`);
    console.log('\n[OK][OK][OK][OK] Ready to test Peggy! Run: npm start\n');
    
  } catch (error) {
    console.error('[OK][OK][OK] Seeding failed:', error);
    process.exit(1);
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const isCleanup = args.includes('--clean');
  
  if (isCleanup) {
    await cleanupTestData();
  } else {
    // Clean first, then seed
    await cleanupTestData();
    console.log('---\n');
    await seedTestData();
  }
  
  process.exit(0);
}

main();
