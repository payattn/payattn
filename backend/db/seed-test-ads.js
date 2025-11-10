/**
 * Seed Test Ads for Development
 * 
 * This script populates the test_ad_creative table with realistic test ads
 * for testing Max's assessment logic without touching production data.
 * 
 * Usage:
 *   Make sure backend/.env.local is configured with Supabase credentials
 *   Then run: node backend/db/seed-test-ads.js
 * 
 * Note: This script expects environment variables to be set.
 * If using .env.local, run it from the backend directory where Next.js will load them.
 */

const { createClient } = require('@supabase/supabase-js');

// Read from environment variables (should be set by Next.js or manually)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('[Seed] Checking environment variables...');
console.log(`  NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✓' : '✗'}`);
console.log(`  Supabase Key: ${supabaseKey ? '✓' : '✗'}\n`);

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test ad data with variety for Max's decision-making
const TEST_ADS = [
  {
    ad_creative_id: 'test_crypto_exchange_001',
    advertiser_id: 'test_adv_coinbase',
    campaign_id: 'test_camp_crypto_001',
    type: 'text',
    headline: 'Trade Bitcoin with Zero Fees',
    body: 'Get started with cryptocurrency trading on the most trusted platform. Sign up today and get $10 bonus.',
    cta: 'Start Trading',
    destination_url: 'https://test-coinbase.example.com/signup',
    targeting: {
      age: { min: 25, max: 35 },
      location: { countries: ['US', 'UK', 'CA'] },
      income: { min: 50000 },
      interests: [
        { category: 'cryptocurrency', weight: 'required' },
        { category: 'investing', weight: 'preferred' }
      ]
    },
    budget_per_impression_lamports: 200000, // ~$0.032 per impression at $160/SOL
    total_budget_lamports: 62500000, // 0.0625 SOL
    status: 'active'
  },
  {
    ad_creative_id: 'test_football_betting_001',
    advertiser_id: 'test_adv_bet365',
    campaign_id: 'test_camp_football_001',
    type: 'text',
    headline: 'Premier League Betting - Get £30 Free Bet',
    body: 'Bet on your favorite team and get a £30 welcome bonus. Best odds guaranteed.',
    cta: 'Claim Bonus',
    destination_url: 'https://test-bet365.example.com/football',
    targeting: {
      age: { min: 21, max: 45 },
      location: { countries: ['UK', 'IE'] },
      interests: [
        { category: 'football', weight: 'required' },
        { category: 'sports', weight: 'preferred' }
      ]
    },
    budget_per_impression_lamports: 250000, // ~$0.04 per impression
    total_budget_lamports: 125000000, // 0.125 SOL
    status: 'active'
  },
  {
    ad_creative_id: 'test_electric_car_001',
    advertiser_id: 'test_adv_tesla',
    campaign_id: 'test_camp_ev_001',
    type: 'text',
    headline: 'Test Drive the Future - Model 3 Now Available',
    body: 'Experience electric performance. Schedule your test drive today and get priority delivery.',
    cta: 'Book Test Drive',
    destination_url: 'https://test-tesla.example.com/model3',
    targeting: {
      age: { min: 30, max: 50 },
      location: { countries: ['US', 'UK', 'CA', 'AU'] },
      income: { min: 75000 },
      interests: [
        { category: 'electric_vehicles', weight: 'required' },
        { category: 'technology', weight: 'preferred' }
      ]
    },
    budget_per_impression_lamports: 300000, // ~$0.048 per impression
    total_budget_lamports: 187500000, // 0.1875 SOL
    status: 'active'
  },
  {
    ad_creative_id: 'test_fashion_shoes_001',
    advertiser_id: 'test_adv_nike',
    campaign_id: 'test_camp_fashion_001',
    type: 'text',
    headline: 'New Air Max Collection - 20% Off First Purchase',
    body: 'Step into style with the latest Air Max. Premium comfort meets iconic design.',
    cta: 'Shop Now',
    destination_url: 'https://test-nike.example.com/airmax',
    targeting: {
      age: { min: 18, max: 35 },
      location: { countries: ['US', 'UK', 'CA', 'FR', 'DE'] },
      interests: [
        { category: 'fashion', weight: 'required' },
        { category: 'fitness', weight: 'preferred' }
      ]
    },
    budget_per_impression_lamports: 150000, // ~$0.024 per impression
    total_budget_lamports: 93750000, // 0.09375 SOL
    status: 'active'
  },
  {
    ad_creative_id: 'test_vpn_security_001',
    advertiser_id: 'test_adv_nordvpn',
    campaign_id: 'test_camp_security_001',
    type: 'text',
    headline: 'Protect Your Privacy Online - 65% Off',
    body: 'Secure your internet connection with military-grade encryption. 30-day money-back guarantee.',
    cta: 'Get Protected',
    destination_url: 'https://test-nordvpn.example.com/deal',
    targeting: {
      age: { min: 25, max: 55 },
      location: { countries: ['US', 'UK', 'CA', 'AU', 'DE', 'FR'] },
      interests: [
        { category: 'technology', weight: 'required' },
        { category: 'privacy', weight: 'preferred' }
      ]
    },
    budget_per_impression_lamports: 125000, // ~$0.02 per impression
    total_budget_lamports: 62500000, // 0.0625 SOL
    status: 'active'
  },
  {
    ad_creative_id: 'test_travel_booking_001',
    advertiser_id: 'test_adv_booking',
    campaign_id: 'test_camp_travel_001',
    type: 'text',
    headline: 'Summer Holidays - Save Up to 40%',
    body: 'Book your dream vacation now. Free cancellation on most hotels.',
    cta: 'Browse Deals',
    destination_url: 'https://test-booking.example.com/summer',
    targeting: {
      age: { min: 25, max: 60 },
      location: { countries: ['UK', 'US', 'CA', 'AU', 'DE', 'FR', 'ES'] },
      income: { min: 40000 },
      interests: [
        { category: 'travel', weight: 'required' }
      ]
    },
    budget_per_impression_lamports: 175000, // ~$0.028 per impression
    total_budget_lamports: 109375000, // ~0.109 SOL
    status: 'active'
  },
  {
    ad_creative_id: 'test_investment_app_001',
    advertiser_id: 'test_adv_trading212',
    campaign_id: 'test_camp_investing_001',
    type: 'text',
    headline: 'Invest in Stocks & ETFs - Commission Free',
    body: 'Start your investment journey with fractional shares. No minimum deposit required.',
    cta: 'Open Account',
    destination_url: 'https://test-trading212.example.com/signup',
    targeting: {
      age: { min: 21, max: 45 },
      location: { countries: ['UK', 'EU'] },
      income: { min: 30000 },
      interests: [
        { category: 'investing', weight: 'required' },
        { category: 'finance', weight: 'preferred' }
      ]
    },
    budget_per_impression_lamports: 225000, // ~$0.036 per impression
    total_budget_lamports: 140625000, // ~0.141 SOL
    status: 'active'
  },
  {
    ad_creative_id: 'test_gaming_console_001',
    advertiser_id: 'test_adv_playstation',
    campaign_id: 'test_camp_gaming_001',
    type: 'text',
    headline: 'PlayStation 5 - Back in Stock',
    body: 'Experience next-gen gaming. Limited stock available. Order now for delivery this week.',
    cta: 'Buy Now',
    destination_url: 'https://test-playstation.example.com/ps5',
    targeting: {
      age: { min: 18, max: 40 },
      location: { countries: ['US', 'UK', 'CA', 'AU'] },
      interests: [
        { category: 'gaming', weight: 'required' },
        { category: 'entertainment', weight: 'preferred' }
      ]
    },
    budget_per_impression_lamports: 200000, // ~$0.032 per impression
    total_budget_lamports: 125000000, // 0.125 SOL
    status: 'active'
  },
  {
    ad_creative_id: 'test_fitness_app_001',
    advertiser_id: 'test_adv_peloton',
    campaign_id: 'test_camp_fitness_001',
    type: 'text',
    headline: 'Transform Your Home Workouts - 30 Day Free Trial',
    body: 'Join thousands of members achieving their fitness goals. Live and on-demand classes.',
    cta: 'Start Free Trial',
    destination_url: 'https://test-peloton.example.com/trial',
    targeting: {
      age: { min: 25, max: 50 },
      location: { countries: ['US', 'UK', 'CA'] },
      income: { min: 50000 },
      interests: [
        { category: 'fitness', weight: 'required' },
        { category: 'health', weight: 'preferred' }
      ]
    },
    budget_per_impression_lamports: 180000, // ~$0.0288 per impression
    total_budget_lamports: 112500000, // ~0.1125 SOL
    status: 'active'
  },
  {
    ad_creative_id: 'test_meal_delivery_001',
    advertiser_id: 'test_adv_hellofresh',
    campaign_id: 'test_camp_food_001',
    type: 'text',
    headline: 'Fresh Ingredients Delivered - 60% Off First Box',
    body: 'Cook delicious meals at home. Free delivery on your first order.',
    cta: 'Get Discount',
    destination_url: 'https://test-hellofresh.example.com/offer',
    targeting: {
      age: { min: 25, max: 45 },
      location: { countries: ['US', 'UK', 'CA', 'AU'] },
      income: { min: 40000 },
      interests: [
        { category: 'cooking', weight: 'preferred' },
        { category: 'food', weight: 'preferred' }
      ]
    },
    budget_per_impression_lamports: 160000, // ~$0.0256 per impression
    total_budget_lamports: 100000000, // 0.1 SOL
    status: 'active'
  },
  // Low-quality / poorly targeted ads that Max should reject
  {
    ad_creative_id: 'test_scammy_crypto_001',
    advertiser_id: 'test_adv_shadycrypto',
    campaign_id: 'test_camp_lowquality_001',
    type: 'text',
    headline: '🚀 GET RICH QUICK WITH DOGECOIN 🚀',
    body: 'Triple your money in 24 hours GUARANTEED! Limited spots available!!!',
    cta: 'JOIN NOW',
    destination_url: 'https://test-scam.example.com/getrich',
    targeting: {
      age: { min: 18, max: 99 }, // Very broad targeting
      location: { countries: ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'ES', 'IT'] },
      // No interest targeting = spray and pray
    },
    budget_per_impression_lamports: 50000, // Very low payment ~$0.008
    total_budget_lamports: 31250000, // 0.03125 SOL
    status: 'active'
  },
  {
    ad_creative_id: 'test_irrelevant_baby_001',
    advertiser_id: 'test_adv_pampers',
    campaign_id: 'test_camp_baby_001',
    type: 'text',
    headline: 'Premium Baby Diapers - 25% Off',
    body: 'Gentle on baby\'s skin. Subscribe and save even more.',
    cta: 'Shop Now',
    destination_url: 'https://test-pampers.example.com/diapers',
    targeting: {
      age: { min: 25, max: 40 }, // Right age but wrong interests
      location: { countries: ['US', 'UK', 'CA'] },
      interests: [
        { category: 'parenting', weight: 'required' } // Won't match single male profile
      ]
    },
    budget_per_impression_lamports: 100000, // ~$0.016 per impression
    total_budget_lamports: 62500000, // 0.0625 SOL
    status: 'active'
  }
];

async function seedTestAds() {
  console.log('🌱 Seeding test ads into test_ad_creative table...\n');
  
  try {
    // Check if test_ad_creative table exists
    const { data: tableCheck, error: tableError } = await supabase
      .from('test_ad_creative')
      .select('id')
      .limit(1);
    
    if (tableError && tableError.code === '42P01') {
      console.error('❌ test_ad_creative table does not exist!');
      console.error('   Run the migration first: psql < backend/db/migrations/create_test_ad_creative.sql');
      process.exit(1);
    }
    
    // Clear existing test ads
    console.log('🗑️  Clearing existing test ads...');
    const { error: deleteError } = await supabase
      .from('test_ad_creative')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (deleteError) {
      console.error('Warning: Could not clear existing ads:', deleteError.message);
    }
    
    // Insert test ads
    console.log(`📝 Inserting ${TEST_ADS.length} test ads...\n`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const ad of TEST_ADS) {
      const { data, error } = await supabase
        .from('test_ad_creative')
        .insert([ad])
        .select();
      
      if (error) {
        console.error(`❌ Failed to insert ${ad.ad_creative_id}:`, error.message);
        failCount++;
      } else {
        console.log(`✅ Inserted ${ad.ad_creative_id} (${ad.headline})`);
        successCount++;
      }
    }
    
    console.log(`\n✨ Seeding complete!`);
    console.log(`   Success: ${successCount}/${TEST_ADS.length}`);
    if (failCount > 0) {
      console.log(`   Failed: ${failCount}/${TEST_ADS.length}`);
    }
    console.log(`\n💡 Test ads are now available in test_ad_creative table`);
    console.log(`   Backend will automatically use this table if DATABASE_MODE=test is set in .env.local`);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run seeding
seedTestAds();
