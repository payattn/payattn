-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.ad_creative (
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
  CONSTRAINT ad_creative_pkey PRIMARY KEY (id),
  CONSTRAINT ad_creative_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(campaign_id)
);
CREATE TABLE public.advertisers (
  id integer NOT NULL DEFAULT nextval('advertisers_id_seq'::regclass),
  advertiser_id character varying NOT NULL UNIQUE,
  name character varying,
  wallet_pubkey character varying,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT advertisers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.campaigns (
  id integer NOT NULL DEFAULT nextval('campaigns_id_seq'::regclass),
  campaign_id text NOT NULL UNIQUE,
  advertiser_id text NOT NULL,
  name text NOT NULL,
  total_budget_lamports bigint NOT NULL DEFAULT 0,
  spent_lamports bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'paused'::text, 'completed'::text])),
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT campaigns_pkey PRIMARY KEY (id)
);
CREATE TABLE public.offers (
  id integer NOT NULL DEFAULT nextval('offers_id_seq'::regclass),
  offer_id character varying NOT NULL UNIQUE,
  advertiser_id character varying NOT NULL,
  user_id character varying NOT NULL,
  user_pubkey character varying NOT NULL,
  ad_id character varying NOT NULL,
  amount_lamports bigint NOT NULL,
  status character varying NOT NULL DEFAULT 'offer_made'::character varying,
  escrow_pda character varying,
  escrow_tx_signature character varying,
  settling boolean DEFAULT false,
  settled_at timestamp without time zone,
  gas_fees_lamports bigint DEFAULT 15000,
  platform_net_revenue_lamports bigint,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  ad_creative_id uuid,
  zk_proofs jsonb,
  CONSTRAINT offers_pkey PRIMARY KEY (id),
  CONSTRAINT offers_ad_creative_id_fkey FOREIGN KEY (ad_creative_id) REFERENCES public.ad_creative(id)
);
CREATE TABLE public.publishers (
  id integer NOT NULL DEFAULT nextval('publishers_id_seq'::regclass),
  publisher_id character varying NOT NULL UNIQUE,
  name character varying,
  domain character varying,
  created_at timestamp without time zone DEFAULT now(),
  wallet_address character varying,
  wallet_verified boolean DEFAULT false,
  CONSTRAINT publishers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.settlement_queue (
  id integer NOT NULL DEFAULT nextval('settlement_queue_id_seq'::regclass),
  offer_id character varying NOT NULL,
  tx_type character varying NOT NULL,
  recipient_pubkey character varying NOT NULL,
  amount bigint NOT NULL,
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 10,
  last_error text,
  last_attempt_at timestamp without time zone,
  status character varying DEFAULT 'pending'::character varying,
  success_tx_signature character varying,
  created_at timestamp without time zone DEFAULT now(),
  resolved_at timestamp without time zone,
  CONSTRAINT settlement_queue_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users (
  id integer NOT NULL DEFAULT nextval('users_id_seq'::regclass),
  user_id character varying NOT NULL UNIQUE,
  wallet_pubkey character varying,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);