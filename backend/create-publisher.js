const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const { data, error } = await supabase
    .from('publishers')
    .upsert({
      publisher_id: 'pub_001',
      name: 'Test Publisher',
      wallet_address: 'ELD9PKHo5qwyt3o5agPPMuQLRzidDnR2g4DmJDfH55Z7'
    })
    .select();
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Publisher created:', JSON.stringify(data, null, 2));
  }
})();