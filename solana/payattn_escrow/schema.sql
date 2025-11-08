-- Payattn Solana Escrow Database Schema
-- Paste this into Supabase SQL Editor

-- ============================================================
-- OFFERS TABLE
-- Tracks the full lifecycle of ad impressions from offer to settlement
-- ============================================================
CREATE TABLE IF NOT EXISTS offers (
    id SERIAL PRIMARY KEY,
    offer_id VARCHAR(64) UNIQUE NOT NULL,
    
    -- Parties involved
    advertiser_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    user_pubkey VARCHAR(64) NOT NULL,
    
    -- Offer details
    ad_id VARCHAR(64) NOT NULL,
    amount_lamports BIGINT NOT NULL,
    
    -- Status state machine
    -- Flow: offer_made → accepted → funded → settling → settled
    status VARCHAR(20) NOT NULL DEFAULT 'offer_made',
    
    -- Escrow details (populated after funding)
    escrow_pda VARCHAR(64),
    escrow_tx_signature VARCHAR(128),
    
    -- Settlement tracking
    settling BOOLEAN DEFAULT false,
    settled_at TIMESTAMP,
    
    -- Gas fee tracking
    gas_fees_lamports BIGINT DEFAULT 15000, -- 3 txs × 5000 lamports
    platform_net_revenue_lamports BIGINT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_offers_status ON offers(status);
CREATE INDEX idx_offers_user_id ON offers(user_id);
CREATE INDEX idx_offers_advertiser_id ON offers(advertiser_id);
CREATE INDEX idx_offers_offer_id ON offers(offer_id);

-- ============================================================
-- SETTLEMENT_QUEUE TABLE
-- Tracks failed settlement transactions for retry
-- ============================================================
CREATE TABLE IF NOT EXISTS settlement_queue (
    id SERIAL PRIMARY KEY,
    
    -- Which offer and transaction type
    offer_id VARCHAR(64) NOT NULL,
    tx_type VARCHAR(20) NOT NULL, -- 'user', 'publisher', 'platform'
    
    -- Payment details
    recipient_pubkey VARCHAR(64) NOT NULL,
    amount BIGINT NOT NULL,
    
    -- Retry tracking
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 10,
    last_error TEXT,
    last_attempt_at TIMESTAMP,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'retrying', 'succeeded', 'failed'
    success_tx_signature VARCHAR(128),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_settlement_queue_offer_id ON settlement_queue(offer_id);
CREATE INDEX idx_settlement_queue_status ON settlement_queue(status);
CREATE INDEX idx_settlement_queue_pending ON settlement_queue(status, attempts) 
    WHERE status = 'pending' AND attempts < max_attempts;

-- ============================================================
-- PUBLISHERS TABLE (update existing or create new)
-- Add Solana wallet address for payment receiving
-- ============================================================
-- Check if table exists, if not create it
CREATE TABLE IF NOT EXISTS publishers (
    id SERIAL PRIMARY KEY,
    publisher_id VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255),
    domain VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add wallet columns (will skip if already exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='publishers' AND column_name='wallet_address') THEN
        ALTER TABLE publishers ADD COLUMN wallet_address VARCHAR(64);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='publishers' AND column_name='wallet_verified') THEN
        ALTER TABLE publishers ADD COLUMN wallet_verified BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Index for wallet lookup
CREATE INDEX IF NOT EXISTS idx_publishers_wallet ON publishers(wallet_address);

-- ============================================================
-- ADVERTISERS TABLE (update existing or create new)
-- Track advertiser wallets for escrow funding
-- ============================================================
CREATE TABLE IF NOT EXISTS advertisers (
    id SERIAL PRIMARY KEY,
    advertiser_id VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255),
    wallet_pubkey VARCHAR(64),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advertisers_id ON advertisers(advertiser_id);

-- ============================================================
-- USERS TABLE (update existing or create new)
-- Track user Solana wallets for payments
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) UNIQUE NOT NULL,
    wallet_pubkey VARCHAR(64),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_id ON users(user_id);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for offers table
DROP TRIGGER IF EXISTS update_offers_updated_at ON offers;
CREATE TRIGGER update_offers_updated_at
    BEFORE UPDATE ON offers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SAMPLE DATA (for testing)
-- ============================================================

-- Sample advertiser
INSERT INTO advertisers (advertiser_id, name, wallet_pubkey) 
VALUES (
    'adv_test_001',
    'Test Advertiser Co',
    'AE6uwbubDn9WyXrpzvqU58jfirvqZAxWCZCfDDwW5MMb'
) ON CONFLICT (advertiser_id) DO NOTHING;

-- Sample user
INSERT INTO users (user_id, wallet_pubkey)
VALUES (
    'user_test_001',
    '9kXHUnoYjB7eVUafsKFibrdHJWiYiX26vP7p7QX77nux'
) ON CONFLICT (user_id) DO NOTHING;

-- Sample publisher
INSERT INTO publishers (publisher_id, name, domain, wallet_address)
VALUES (
    'pub_test_001',
    'Test Publisher Site',
    'testpublisher.com',
    'ELD9PKHo5qwyt3o5agPPMuQLRzidDnR2g4DmJDfH55Z7'
) ON CONFLICT (publisher_id) DO NOTHING;

-- Sample offer (for testing the flow)
INSERT INTO offers (
    offer_id,
    advertiser_id,
    user_id,
    user_pubkey,
    ad_id,
    amount_lamports,
    status
) VALUES (
    'offer_' || SUBSTR(MD5(RANDOM()::TEXT), 1, 16),
    'adv_test_001',
    'user_test_001',
    '9kXHUnoYjB7eVUafsKFibrdHJWiYiX26vP7p7QX77nux',
    'ad_001',
    10000000, -- 0.01 SOL
    'offer_made'
) ON CONFLICT (offer_id) DO NOTHING;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check tables were created
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('offers', 'settlement_queue', 'publishers', 'advertisers', 'users')
ORDER BY tablename;

-- Check sample data
SELECT 'Offers' as table_name, COUNT(*) as count FROM offers
UNION ALL
SELECT 'Publishers', COUNT(*) FROM publishers
UNION ALL
SELECT 'Advertisers', COUNT(*) FROM advertisers
UNION ALL
SELECT 'Users', COUNT(*) FROM users;

-- Show sample offer
SELECT offer_id, status, amount_lamports, created_at 
FROM offers 
ORDER BY created_at DESC 
LIMIT 1;
