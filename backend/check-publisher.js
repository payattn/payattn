const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  // First check what exists
  const { data: existing, error: fetchError } = await supabase
    .from('publishers')
    .select('*')
    .eq('publisher_id', 'pub_001')
    .single();
  
  console.log('Existing publisher:', JSON.stringify(existing, null, 2));
  
  if (existing && !existing.wallet_address) {
    console.log('\nPublisher exists but has no wallet. Updating...');
    const { data: updated, error: updateError } = await supabase
      .from('publishers')
      .update({ wallet_address: 'ELD9PKHo5qwyt3o5agPPMuQLRzidDnR2g4DmJDfH55Z7' })
      .eq('publisher_id', 'pub_001')
      .select();
    
    if (updateError) {
      console.error('Update error:', updateError);
    } else {
      console.log('Updated:', JSON.stringify(updated, null, 2));
    }
  }
})();
