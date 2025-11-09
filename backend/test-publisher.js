const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  // Check publisher
  const { data: publisher, error: pubError } = await supabase
    .from('publishers')
    .select('*')
    .eq('publisher_id', 'pub_001')
    .single();
  
  console.log('Publisher pub_001:');
  if (pubError) {
    console.log('  Error:', pubError.message);
  } else if (!publisher) {
    console.log('  Not found');
  } else {
    console.log('  Found:', JSON.stringify(publisher, null, 2));
  }
})();
