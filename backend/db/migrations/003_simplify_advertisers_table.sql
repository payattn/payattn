-- Migration: Simplify advertisers table
-- Remove wallet_pubkey column (duplicate of advertiser_id)
-- advertiser_id IS the wallet public key

-- Drop the redundant wallet_pubkey column
ALTER TABLE advertisers DROP COLUMN IF EXISTS wallet_pubkey;

-- Add comment to clarify
COMMENT ON COLUMN advertisers.advertiser_id IS 'Solana wallet public key (serves as unique identifier)';

-- Update any existing records where they might differ
-- (This is a safety measure - in your case they should already be the same)
UPDATE advertisers 
SET advertiser_id = wallet_pubkey 
WHERE wallet_pubkey IS NOT NULL 
  AND advertiser_id != wallet_pubkey;
