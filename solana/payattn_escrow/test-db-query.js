#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uytcohrqiqmtfdopdrpe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5dGNvaHJxaXFtdGZkb3BkcnBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0NjE3NTEsImV4cCI6MjA3ODAzNzc1MX0.KO7ekJzbeoz0AgLyltwVfzP3HOVJ4eFSVOgaJDODJg8';

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
