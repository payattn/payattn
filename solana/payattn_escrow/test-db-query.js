#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Load from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? '✓' : '✗');
  console.error('\nLoad from .env.local: source <(grep -v "^#" ../../backend/.env.local | sed \'s/^/export /\')');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
  const offerId = 'offer_41f8f17d3b6bebd6';
  
  console.log(`\nQuerying for offer_id: ${offerId}`);
  
  const { data: offer, error } = await supabase
    .from('offers')
    .select('*')
    .eq('offer_id', offerId)
    .single();
  
  if (error) {
    console.error('❌ Query error:', error);
  } else if (!offer) {
    console.log('❌ No offer found');
  } else {
    console.log('✅ Offer found:', JSON.stringify(offer, null, 2));
  }
  
  // Also try listing all offers
  console.log('\n--- All offers in database ---');
  const { data: allOffers, error: listError } = await supabase
    .from('offers')
    .select('offer_id, status, amount_lamports');
  
  if (listError) {
    console.error('❌ List error:', listError);
  } else {
    console.log(`Found ${allOffers.length} offers:`);
    allOffers.forEach(o => {
      console.log(`  - ${o.offer_id}: ${o.status}, ${o.amount_lamports} lamports`);
    });
  }
}

testQuery();
