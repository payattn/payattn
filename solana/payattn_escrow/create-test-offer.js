#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Load from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set');
  console.error('   Load from backend/.env.local: source <(grep -v "^#" ../backend/.env.local | sed "s/^/export /")');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestOffer() {
  console.log('Creating test offer...');
  
  const testOffer = {
    offer_id: 'offer_41f8f17d3b6bebd6',
    advertiser_id: 'adv_test_001',
    user_id: 'user_test_001',
    user_pubkey: '9kXHUnoYjB7eVUafsKFibrdHJWiYiX26vP7p7QX77nux',
    ad_id: 'ad_001',
    amount_lamports: 10000000,  // 0.01 SOL
    status: 'offer_made'
  };
  
  const { data, error } = await supabase
    .from('offers')
    .upsert(testOffer, { onConflict: 'offer_id' })
    .select();
  
  if (error) {
    console.error('❌ Error creating offer:', error);
    process.exit(1);
  }
  
  console.log('✅ Test offer created:', data);
}

createTestOffer();
