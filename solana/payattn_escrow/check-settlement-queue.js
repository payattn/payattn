#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[OK][OK][OK] Missing Supabase environment variables');
  console.error('Run: source <(grep -v "^#" ../../backend/.env.local | sed \'s/^/export /\')');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Checking Supabase schema...\n');

  // Check if settlement_queue table exists
  console.log('1. Checking settlement_queue table...');
  const { data: queueData, error: queueError } = await supabase
    .from('settlement_queue')
    .select('*')
    .limit(1);

  if (queueError) {
    if (queueError.message.includes('does not exist')) {
      console.log('[ERROR] settlement_queue table does NOT exist');
    } else {
      console.log('[WARN] Error querying settlement_queue:', queueError.message);
    }
  } else {
    console.log('[OK] settlement_queue table exists');
    console.log('   Columns:', Object.keys(queueData[0] || {}));
  }

  // Check offers table for settlement columns
  console.log('\n2. Checking offers table columns...');
  const { data: offersData, error: offersError } = await supabase
    .from('offers')
    .select('*')
    .limit(1);

  if (offersError) {
    console.log('[ERROR] Error querying offers:', offersError.message);
  } else {
    const columns = Object.keys(offersData[0] || {});
    console.log('[OK] offers table exists');
    console.log('   Has settling column?', columns.includes('settling') ? '[OK]' : '[NO]');
    console.log('   Has settled_at column?', columns.includes('settled_at') ? '[OK]' : '[NO]');
    console.log('   Has gas_fees_lamports column?', columns.includes('gas_fees_lamports') ? '[OK]' : '[NO]');
  }

  // Check publishers table for wallet_address
  console.log('\n3. Checking publishers table...');
  const { data: pubData, error: pubError } = await supabase
    .from('publishers')
    .select('*')
    .limit(1);

  if (pubError) {
    if (pubError.message.includes('does not exist')) {
      console.log('[ERROR] publishers table does NOT exist');
    } else {
      console.log('[WARN] Error querying publishers:', pubError.message);
    }
  } else {
    const columns = Object.keys(pubData[0] || {});
    console.log('[OK] publishers table exists');
    console.log('   Has wallet_address column?', columns.includes('wallet_address') ? '[OK]' : '[NO]');
    console.log('   Has wallet_verified column?', columns.includes('wallet_verified') ? '[OK]' : '[NO]');
  }

  console.log('\n--- Schema Check Complete ---');
}

checkSchema();
