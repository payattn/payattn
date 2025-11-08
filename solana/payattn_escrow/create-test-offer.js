#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uytcohrqiqmtfdopdrpe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5dGNvaHJxaXFtdGZkb3BkcnBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0NjE3NTEsImV4cCI6MjA3ODAzNzc1MX0.KO7ekJzbeoz0AgLyltwVfzP3HOVJ4eFSVOgaJDODJg8';

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
