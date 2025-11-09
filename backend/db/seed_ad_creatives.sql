-- Seed Data: Test Ad Creatives
-- Date: 2025-11-09
-- Purpose: Create test campaigns and ad_creatives for development and demo

-- =====================================================
-- 1. SEED CAMPAIGNS
-- =====================================================

INSERT INTO campaigns (campaign_id, advertiser_id, name, total_budget_lamports, status)
VALUES
  ('camp_crypto_001', 'adv_rolex', 'Crypto Exchange Campaign Q4', 5000000, 'active'),
  ('camp_sports_001', 'adv_nike', 'Sports Equipment Campaign Q4', 4000000, 'active'),
  ('camp_streaming_001', 'adv_spotify', 'Streaming Entertainment Q4', 3000000, 'active')
ON CONFLICT (campaign_id) DO NOTHING;

-- =====================================================
-- 2. SEED AD CREATIVES
-- =====================================================

-- Ad 1: Rolex - Crypto/Luxury targeting
INSERT INTO ad_creative (
  ad_creative_id, 
  advertiser_id, 
  campaign_id,
  type,
  headline,
  body,
  cta,
  destination_url,
  targeting,
  budget_per_impression_lamports,
  total_budget_lamports,
  status
)
VALUES (
  'ad_rolex_crypto_001',
  'adv_rolex',
  'camp_crypto_001',
  'text',
  'Get 20% off luxury watches',
  'Swiss craftsmanship meets digital age. Exclusive offer for crypto enthusiasts. Lifetime warranty.',
  'Shop Now',
  'https://rolex.com/campaign?utm_source=payattn&utm_campaign=crypto_001',
  '{
    "age": {"min": 25, "max": 45},
    "interests": [
      {"category": "cryptocurrency", "weight": "required"},
      {"category": "luxury", "weight": "preferred"},
      {"category": "investment", "weight": "preferred"}
    ],
    "income": {"min": 50000},
    "location": {"countries": ["GB", "DE", "FR", "US", "CA"]}
  }'::jsonb,
  10000,
  5000000,
  'active'
)
ON CONFLICT (ad_creative_id) DO NOTHING;

-- Ad 2: Spotify - Streaming/Entertainment targeting
INSERT INTO ad_creative (
  ad_creative_id,
  advertiser_id,
  campaign_id,
  type,
  headline,
  body,
  cta,
  destination_url,
  targeting,
  budget_per_impression_lamports,
  total_budget_lamports,
  status
)
VALUES (
  'ad_spotify_streaming_001',
  'adv_spotify',
  'camp_streaming_001',
  'text',
  '3 months of Premium for free',
  '100 million songs, ad-free. Download and listen offline. Cancel anytime.',
  'Try Premium Free',
  'https://spotify.com/premium?utm_source=payattn&utm_campaign=streaming_001',
  '{
    "age": {"min": 18, "max": 35},
    "interests": [
      {"category": "music", "weight": "required"},
      {"category": "entertainment", "weight": "preferred"},
      {"category": "podcasts", "weight": "optional"}
    ],
    "income": {"min": 0},
    "location": {"countries": ["GB", "US", "CA", "AU", "NZ", "IE"]}
  }'::jsonb,
  8000,
  3000000,
  'active'
)
ON CONFLICT (ad_creative_id) DO NOTHING;

-- Ad 3: Nike - Sports/Fitness targeting
INSERT INTO ad_creative (
  ad_creative_id,
  advertiser_id,
  campaign_id,
  type,
  headline,
  body,
  cta,
  destination_url,
  targeting,
  budget_per_impression_lamports,
  total_budget_lamports,
  status
)
VALUES (
  'ad_nike_sports_001',
  'adv_nike',
  'camp_sports_001',
  'text',
  'New running shoes - 30% off',
  'Latest tech for your best run yet. Lightweight, breathable, responsive. Free shipping & returns.',
  'Shop Collection',
  'https://nike.com/running?utm_source=payattn&utm_campaign=sports_001',
  '{
    "age": {"min": 18, "max": 50},
    "interests": [
      {"category": "sports", "weight": "required"},
      {"category": "fitness", "weight": "required"},
      {"category": "health", "weight": "preferred"},
      {"category": "running", "weight": "optional"}
    ],
    "income": {"min": 25000},
    "location": {"countries": ["GB", "US", "CA", "AU", "DE", "FR", "IT", "ES"]}
  }'::jsonb,
  9000,
  4000000,
  'active'
)
ON CONFLICT (ad_creative_id) DO NOTHING;

-- =====================================================
-- 3. SEED PUBLISHER (if not exists)
-- =====================================================

INSERT INTO publishers (publisher_id, name, domain, wallet_address, wallet_verified)
VALUES
  ('8k3m9x2p', 'Tech News Daily', 'technews.example.com', '9feDsS77QobmdVfYME1uKc3XnZSvUDaohAg3fwErYZB2', true)
ON CONFLICT (publisher_id) DO NOTHING;

-- =====================================================
-- 4. SEED TEST USER (for testing offers)
-- =====================================================

INSERT INTO users (user_id, wallet_pubkey)
VALUES
  ('user_test_001', 'UserWallet1234567890abcdefghijklmnopqrstuvwxyz')
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Show created campaigns
SELECT 
  campaign_id,
  name,
  advertiser_id,
  total_budget_lamports,
  status,
  created_at
FROM campaigns
ORDER BY created_at DESC;

-- Show created ad_creatives
SELECT 
  ad_creative_id,
  headline,
  advertiser_id,
  campaign_id,
  budget_per_impression_lamports,
  impressions_count,
  clicks_count,
  status,
  created_at
FROM ad_creative
ORDER BY created_at DESC;

-- Summary stats
SELECT 
  'Total Campaigns' as metric,
  COUNT(*)::text as value
FROM campaigns
UNION ALL
SELECT 
  'Total Ad Creatives' as metric,
  COUNT(*)::text as value
FROM ad_creative
UNION ALL
SELECT 
  'Active Ads' as metric,
  COUNT(*)::text as value
FROM ad_creative
WHERE status = 'active'
UNION ALL
SELECT 
  'Total Budget (lamports)' as metric,
  SUM(total_budget_lamports)::text as value
FROM ad_creative;
