/**
 * Peggy Database Client
 * Queries offers and ad creatives from Supabase
 * Moved from /advertiser-agent/lib/database.js with DATABASE_MODE support added
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface Offer {
  offer_id: string;
  user_id: string;
  ad_id: string;
  advertiser_id: string;
  amount_lamports: number;
  user_pubkey: string;
  status: string;
  zk_proofs?: any;
  created_at?: string;
}

export interface AdCreative {
  ad_creative_id: string;
  advertiser_id: string;
  headline?: string;
  description?: string;
  target_age_min?: number;
  target_age_max?: number;
  target_locations?: string[];
  target_interests?: string[];
  budget_per_impression_lamports: number;
  campaign_name?: string;
  campaign_goal?: string;
}

export interface OfferWithAd extends Offer {
  ad_creative?: AdCreative;
}

export interface Advertiser {
  advertiser_id: string;
  name: string;
  wallet_pubkey: string;
  created_at?: string;
}

export class DatabaseClient {
  private supabase: SupabaseClient;
  private adCreativeTable: string;
  
  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase credentials in environment variables');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Use DATABASE_MODE to determine which ad_creative table to use
    const databaseMode = process.env.DATABASE_MODE || 'production';
    this.adCreativeTable = databaseMode === 'test' ? 'test_ad_creative' : 'ad_creative';
    
    console.log(`[DatabaseClient] Using table: ${this.adCreativeTable} (mode: ${databaseMode})`);
  }
  
  /**
   * Fetch advertiser details from database
   * Note: advertiserId can be either the advertiser_id field OR wallet_pubkey
   */
  async getAdvertiser(advertiserId: string): Promise<Advertiser> {
    // Try by advertiser_id first
    let { data, error } = await this.supabase
      .from('advertisers')
      .select('*')
      .eq('advertiser_id', advertiserId)
      .maybeSingle();
    
    // If not found, try by wallet_pubkey
    if (!data && !error) {
      const result = await this.supabase
        .from('advertisers')
        .select('*')
        .eq('wallet_pubkey', advertiserId)
        .maybeSingle();
      
      data = result.data;
      error = result.error;
    }
    
    if (error) {
      throw new Error(`Failed to fetch advertiser: ${error.message}`);
    }
    
    if (!data) {
      throw new Error(`Advertiser ${advertiserId} not found`);
    }
    
    return data as Advertiser;
  }
  
  /**
   * Fetch pending offers for advertiser
   */
  async getPendingOffers(advertiserId: string, status = 'offer_made'): Promise<Offer[]> {
    const { data, error } = await this.supabase
      .from('offers')
      .select('*')
      .eq('advertiser_id', advertiserId)
      .eq('status', status)
      .order('created_at', { ascending: true });
    
    if (error) {
      throw new Error(`Failed to fetch offers: ${error.message}`);
    }
    
    return (data || []) as Offer[];
  }
  
  /**
   * Fetch pending offers with joined ad_creative data
   * Uses DATABASE_MODE to determine which table to query
   */
  async getPendingOffersWithAds(advertiserId: string, status = 'offer_made'): Promise<OfferWithAd[]> {
    // First get offers
    const offers = await this.getPendingOffers(advertiserId, status);
    
    if (offers.length === 0) {
      return [];
    }
    
    // Get unique ad IDs
    const adIds = [...new Set(offers.map(o => o.ad_id))];
    
    // Fetch ad creatives from appropriate table
    const { data: ads, error } = await this.supabase
      .from(this.adCreativeTable)
      .select('*')
      .in('ad_creative_id', adIds);
    
    if (error) {
      console.warn(`Failed to fetch ad creatives: ${error.message}`);
      // Return offers without ad data rather than failing
      return offers.map(offer => ({ ...offer, ad_creative: undefined }));
    }
    
    // Map ads to offers
    const adsMap = new Map((ads || []).map(ad => [ad.ad_creative_id, ad as AdCreative]));
    
    return offers.map(offer => ({
      ...offer,
      ad_creative: adsMap.get(offer.ad_id)
    }));
  }
  
  /**
   * Get ad creative by ID
   */
  async getAdCreative(adId: string): Promise<AdCreative | null> {
    const { data, error } = await this.supabase
      .from(this.adCreativeTable)
      .select('*')
      .eq('ad_creative_id', adId)
      .single();
    
    if (error) {
      console.warn(`Failed to fetch ad creative ${adId}: ${error.message}`);
      return null;
    }
    
    return data as AdCreative;
  }
  
  /**
   * Update offer status
   */
  async updateOfferStatus(offerId: string, status: string): Promise<void> {
    const { error } = await this.supabase
      .from('offers')
      .update({ status })
      .eq('offer_id', offerId);
    
    if (error) {
      throw new Error(`Failed to update offer status: ${error.message}`);
    }
  }
}
