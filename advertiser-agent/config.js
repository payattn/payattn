import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Backend API
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  advertiserId: process.env.ADVERTISER_ID || 'adv_001',
  
  // Supabase
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  
  // Solana
  solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  advertiserKeypairPath: process.env.ADVERTISER_KEYPAIR_PATH || 
    `${process.env.HOME}/.config/solana/advertiser.json`,
  programId: process.env.SOLANA_PROGRAM_ID || 
    '6ZEekbTJZ6D6KrfSGDY2ByoWENWfe8RzhvpBS4KtPdZr',
  
  // Venice AI
  veniceApiKey: process.env.VENICE_API_KEY,
  
  // Agent behavior
  pollInterval: parseInt(process.env.POLL_INTERVAL) || 30000, // 30 seconds
  maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
};

// Validate required config
if (!config.supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL in .env');
}

if (!config.supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY in .env');
}

if (!config.veniceApiKey || config.veniceApiKey === 'your_venice_api_key_here') {
  console.warn('⚠️  WARNING: Venice API key not configured in .env');
  console.warn('   Peggy will not be able to evaluate offers without it.');
  console.warn('   Add VENICE_API_KEY to .env file before running.\n');
}
