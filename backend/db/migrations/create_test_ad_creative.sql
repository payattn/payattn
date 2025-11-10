-- Create test_ad_creative table for development testing
-- Exact duplicate of ad_creative table structure for safe testing without touching production data

-- Drop table if exists (for re-running migration)
DROP TABLE IF EXISTS public.test_ad_creative CASCADE;

-- Create test_ad_creative table with identical structure to ad_creative
CREATE TABLE public.test_ad_creative (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ad_creative_id text NOT NULL UNIQUE,
  advertiser_id text NOT NULL,
  campaign_id text,
  type text NOT NULL DEFAULT 'text'::text CHECK (type = ANY (ARRAY['text'::text, 'image'::text, 'video'::text, 'html'::text])),
  headline text NOT NULL,
  body text NOT NULL,
  cta text NOT NULL,
  destination_url text NOT NULL,
  targeting jsonb NOT NULL DEFAULT '{}'::jsonb,
  budget_per_impression_lamports bigint NOT NULL CHECK (budget_per_impression_lamports > 0),
  total_budget_lamports bigint NOT NULL,
  spent_lamports bigint NOT NULL DEFAULT 0,
  impressions_count integer NOT NULL DEFAULT 0,
  clicks_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'paused'::text, 'completed'::text, 'rejected'::text])),
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT test_ad_creative_pkey PRIMARY KEY (id)
  -- NOTE: We intentionally omit the foreign key to campaigns table for flexibility in testing
  -- This allows us to create test ads without needing corresponding campaign records
);

-- Create indexes matching ad_creative table for performance
CREATE INDEX idx_test_ad_creative_advertiser ON public.test_ad_creative(advertiser_id);
CREATE INDEX idx_test_ad_creative_status ON public.test_ad_creative(status);
CREATE INDEX idx_test_ad_creative_created_at ON public.test_ad_creative(created_at);
CREATE INDEX idx_test_ad_creative_campaign ON public.test_ad_creative(campaign_id);

-- Add comment to table
COMMENT ON TABLE public.test_ad_creative IS 'Test table for ad_creative - used in development to test Max assessment logic without touching production ads';

-- Grant same permissions as ad_creative (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_ad_creative TO your_app_user;
