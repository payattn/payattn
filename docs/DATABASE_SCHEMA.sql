-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.advertisers (
  id integer NOT NULL DEFAULT nextval('advertisers_id_seq'::regclass),
  advertiser_id character varying NOT NULL UNIQUE,
  name character varying,
  wallet_pubkey character varying,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT advertisers_pkey PRIMARY KEY (id)
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
  CONSTRAINT offers_pkey PRIMARY KEY (id)
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