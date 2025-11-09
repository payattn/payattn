-- =====================================================
-- COMPREHENSIVE ADVERTISER DATA AUDIT
-- =====================================================

-- 1. Show all advertisers
SELECT 
  'ADVERTISERS' as section,
  advertiser_id,
  name,
  wallet_pubkey,
  created_at
FROM advertisers
ORDER BY created_at DESC;

-- 2. Show all campaigns with advertiser lookup
SELECT 
  'CAMPAIGNS' as section,
  c.campaign_id,
  c.advertiser_id,
  a.name as advertiser_name,
  c.name as campaign_name,
  c.total_budget_lamports,
  c.spent_lamports,
  c.status,
  c.created_at,
  CASE 
    WHEN a.advertiser_id IS NULL THEN '❌ ORPHANED (advertiser missing)'
    ELSE '✅ Valid'
  END as validation
FROM campaigns c
LEFT JOIN advertisers a ON c.advertiser_id = a.advertiser_id
ORDER BY c.created_at DESC;

-- 3. Show all ad_creatives with advertiser and campaign lookup
SELECT 
  'AD_CREATIVES' as section,
  ac.ad_creative_id,
  ac.advertiser_id,
  a.name as advertiser_name,
  ac.campaign_id,
  c.name as campaign_name,
  ac.headline,
  ac.budget_per_impression_lamports,
  ac.total_budget_lamports,
  ac.spent_lamports,
  ac.impressions_count,
  ac.clicks_count,
  ac.status,
  ac.created_at,
  CASE 
    WHEN a.advertiser_id IS NULL THEN '❌ ORPHANED (advertiser missing)'
    ELSE '✅ Valid'
  END as validation
FROM ad_creative ac
LEFT JOIN advertisers a ON ac.advertiser_id = a.advertiser_id
LEFT JOIN campaigns c ON ac.campaign_id = c.campaign_id
ORDER BY ac.created_at DESC;

-- 4. Summary: Count of records by advertiser
SELECT 
  'SUMMARY BY ADVERTISER' as section,
  COALESCE(a.advertiser_id, 'ORPHANED') as advertiser_id,
  COALESCE(a.name, 'N/A') as advertiser_name,
  COUNT(DISTINCT c.campaign_id) as campaign_count,
  COUNT(DISTINCT ac.ad_creative_id) as ad_creative_count
FROM advertisers a
LEFT JOIN campaigns c ON a.advertiser_id = c.advertiser_id
LEFT JOIN ad_creative ac ON a.advertiser_id = ac.advertiser_id
GROUP BY a.advertiser_id, a.name
ORDER BY campaign_count DESC, ad_creative_count DESC;

-- 5. Find orphaned advertiser_ids (used but not in advertisers table)
SELECT 
  'ORPHANED ADVERTISER IDs' as section,
  advertiser_id,
  'campaigns' as found_in,
  COUNT(*) as usage_count
FROM campaigns
WHERE advertiser_id NOT IN (SELECT advertiser_id FROM advertisers)
GROUP BY advertiser_id
UNION ALL
SELECT 
  'ORPHANED ADVERTISER IDs' as section,
  advertiser_id,
  'ad_creative' as found_in,
  COUNT(*) as usage_count
FROM ad_creative
WHERE advertiser_id NOT IN (SELECT advertiser_id FROM advertisers)
GROUP BY advertiser_id
ORDER BY found_in, advertiser_id;

-- 6. Show full details for easy copy-paste
SELECT 
  '--- FULL DATA DUMP ---' as divider;

SELECT 
  advertiser_id,
  name,
  wallet_pubkey
FROM advertisers;

SELECT 
  campaign_id,
  advertiser_id,
  name,
  total_budget_lamports,
  spent_lamports,
  status
FROM campaigns;

SELECT 
  ad_creative_id,
  advertiser_id,
  campaign_id,
  headline,
  body,
  cta,
  budget_per_impression_lamports,
  total_budget_lamports,
  spent_lamports,
  status
FROM ad_creative;