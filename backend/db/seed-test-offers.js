#!/usr/bin/env node

/**
 * Seed Test Offers for Peggy Testing
 * 
 * Creates test offers with status='offer_made' for Peggy to evaluate
 * Uses advertiser wallet: AE6uwbubDn9WyXrpzvqU58jfirvqZAxWCZCfDDwW5MMb
 */

const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('fs');
const { join } = require('path');

// Load environment variables from .env.local
const envPath = join(__dirname, '../.env.local');
try {
  const envFile = readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
} catch (error) {
  console.error('Warning: Could not load .env.local:', error.message);
}

// Read from environment variables (should be set by Next.js or manually)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('[Seed] Checking environment variables...');
console.log(`  NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '[OK][OK]' : '[OK][OK]'}`);
console.log(`  Supabase Key: ${supabaseKey ? '[OK][OK]' : '[OK][OK]'}\n`);

if (!supabaseUrl || !supabaseKey) {
  console.error('[OK][OK][OK] Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Advertiser wallet (Peggy's wallet)
const ADVERTISER_WALLET = 'AE6uwbubDn9WyXrpzvqU58jfirvqZAxWCZCfDDwW5MMb';

// Generate unique offer ID with timestamp and random string
// Keep it short to avoid PDA seed length limits (max 32 bytes)
function generateUniqueOfferId(baseName) {
  const timestamp = Date.now().toString(36); // Base36 for shorter representation
  const random = Math.random().toString(36).substring(2, 6); // Just 4 chars
  return `${baseName}_${timestamp}${random}`;
}

// Test offers data (templates - IDs will be generated at runtime)
// NOTE: Amounts are 15M-25M lamports (0.015-0.025 SOL) to match Peggy's maxCpm of $0.03
// NOTE: Location proofs use hashed country codes for UK, US, AU (Peggy's targeting)
//       UK: 15507270989273941579486529782961168076878965616246236476325961487637715879146
//       US: 11260266382097653814930211509845802813812259496447595992381006449603469395487
//       AU: 1081683769073763834824695852600735691366045530347044709687586422051138368041
function generateTestOffers() {
  return [
    {
      offer_id: generateUniqueOfferId('booking'),
      advertiser_id: ADVERTISER_WALLET,
      user_id: 'user_test_001',
      user_pubkey: 'Aiv9yEcriCQzE8YZu6sRopDzHw2ZgDzCWidAXaruwe7s',
      ad_id: 'test_travel_booking_001',
      amount_lamports: 25000000, // 25M lamports = 0.025 SOL = $0.025 (under maxCpm)
      status: 'offer_made',
      zk_proofs: {} // No proofs for demo - avoid verification failures
  },
  {
    offer_id: generateUniqueOfferId('nike'),
    advertiser_id: ADVERTISER_WALLET,
    user_id: 'user_test_002',
    user_pubkey: 'Aiv9yEcriCQzE8YZu6sRopDzHw2ZgDzCWidAXaruwe7s',
    ad_id: 'test_fashion_shoes_001',
    amount_lamports: 20000000, // 20M lamports = 0.020 SOL = $0.020 (under maxCpm)
    status: 'offer_made',
    zk_proofs: {} // No proofs for demo - avoid verification failures
  },
  {
    offer_id: generateUniqueOfferId('vpn'),
    advertiser_id: ADVERTISER_WALLET,
    user_id: 'user_test_003',
    user_pubkey: 'Aiv9yEcriCQzE8YZu6sRopDzHw2ZgDzCWidAXaruwe7s',
    ad_id: 'test_vpn_security_001',
    amount_lamports: 22000000, // 22M lamports = 0.022 SOL = $0.022 (under maxCpm)
    status: 'offer_made',
    zk_proofs: {} // No proofs for demo - avoid verification failures
  },
  {
    offer_id: generateUniqueOfferId('trading'),
    advertiser_id: ADVERTISER_WALLET,
    user_id: 'user_test_004',
    user_pubkey: 'Aiv9yEcriCQzE8YZu6sRopDzHw2ZgDzCWidAXaruwe7s',
    ad_id: 'test_investment_app_001',
    amount_lamports: 18000000, // 18M lamports = 0.018 SOL = $0.018 (under maxCpm)
    status: 'offer_made',
    zk_proofs: {} // No proofs for demo - avoid verification failures
  },
  {
    offer_id: generateUniqueOfferId('vpn'),
    advertiser_id: ADVERTISER_WALLET,
    user_id: 'user_test_005',
    user_pubkey: 'Aiv9yEcriCQzE8YZu6sRopDzHw2ZgDzCWidAXaruwe7s',
    ad_id: 'test_vpn_security_001',
    amount_lamports: 15000000, // 15M lamports = 0.015 SOL = $0.015 (under maxCpm)
    status: 'offer_made',
    zk_proofs: {} // No proofs for demo - avoid verification failures
  },
  {
    offer_id: generateUniqueOfferId('booking'),
    advertiser_id: ADVERTISER_WALLET,
    user_id: 'user_test_006',
    user_pubkey: 'Aiv9yEcriCQzE8YZu6sRopDzHw2ZgDzCWidAXaruwe7s',
    ad_id: 'test_travel_booking_001',
    amount_lamports: 23000000, // 23M lamports = 0.023 SOL = $0.023 (under maxCpm)
    status: 'offer_made',
    zk_proofs: {} // No proofs for demo - avoid verification failures
  },
  {
    offer_id: generateUniqueOfferId('trading'),
    advertiser_id: ADVERTISER_WALLET,
    user_id: 'user_test_007',
    user_pubkey: 'Aiv9yEcriCQzE8YZu6sRopDzHw2ZgDzCWidAXaruwe7s',
    ad_id: 'test_investment_app_001',
    amount_lamports: 19000000, // 19M lamports = 0.019 SOL = $0.019 (under maxCpm)
    status: 'offer_made',
    zk_proofs: {} // No proofs for demo - avoid verification failures
  }
  ];
}

async function seedOffers() {
  console.log('[OK][OK][OK] Seeding test offers for Peggy...');
  console.log(`Advertiser: ${ADVERTISER_WALLET}\n`);

  try {
    // Generate fresh offers with unique IDs
    const testOffers = generateTestOffers();
    
    console.log('Generated unique offer IDs:');
    testOffers.forEach(offer => {
      console.log(`  [OK][OK] ${offer.offer_id}`);
    });
    console.log('');

    // Insert offers
    for (const offer of testOffers) {
      console.log(`Creating offer: ${offer.offer_id}`);
      console.log(`  Ad: ${offer.ad_id}`);
      console.log(`  Amount: ${offer.amount_lamports} lamports (${(offer.amount_lamports / 1e9).toFixed(6)} SOL)`);
      console.log(`  ZK Proofs: ${Object.keys(offer.zk_proofs).join(', ')}`);

      const { error } = await supabase
        .from('offers')
        .insert({
          offer_id: offer.offer_id,
          advertiser_id: offer.advertiser_id,
          user_id: offer.user_id,
          user_pubkey: offer.user_pubkey,
          ad_id: offer.ad_id,
          amount_lamports: offer.amount_lamports,
          status: offer.status,
          zk_proofs: offer.zk_proofs,
          gas_fees_lamports: 15000
        });

      if (error) {
        // If already exists, skip
        if (error.code === '23505') {
          console.log(`  [SKIP] Already exists\n`);
        } else {
          throw error;
        }
      } else {
        console.log(`  [OK] Created\n`);
      }
    }

    console.log('*** Seeding complete! ***');
    
    console.log(`\nSummary:`);
    console.log(`  Total offers created: ${testOffers.length}`);
    console.log(`  Status: 'offer_made' (ready for Peggy)`);
    console.log(`  Advertiser: ${ADVERTISER_WALLET}`);
    console.log(`  Note: Each run generates unique offer IDs for repeatability`);
    
    console.log(`\nNext steps:`);
    console.log(`  1. Run Peggy: cd advertiser-agent && npm start`);
    console.log(`  2. Or use manual UI: http://localhost:3000/advertisers/offer-queue`);
    console.log(`  3. Check database: SELECT * FROM offers WHERE advertiser_id = '${ADVERTISER_WALLET}';`);

  } catch (error) {
    console.error('[ERROR] Seeding failed:', error);
    process.exit(1);
  }
}

async function cleanOffers() {
  console.log('Cleaning test offers...');
  
  try {
    const { error } = await supabase
      .from('offers')
      .delete()
      .eq('advertiser_id', ADVERTISER_WALLET);

    if (error) throw error;

    console.log('*** Test offers cleaned! ***');
  } catch (error) {
    console.error('[ERROR] Cleaning failed:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const shouldClean = args.includes('--clean');

if (shouldClean) {
  cleanOffers();
} else {
  seedOffers();
}
