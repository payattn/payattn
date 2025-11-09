import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

export class DatabaseClient {
  constructor() {
    this.supabase = createClient(
      config.supabaseUrl,
      config.supabaseAnonKey
    );
  }
  
  /**
   * Fetch advertiser details from database
   * @param {string} advertiserId - Advertiser ID
   * @returns {Promise<Object>} Advertiser data
   */
  async getAdvertiser(advertiserId) {
    const { data, error } = await this.supabase
      .from('advertisers')
      .select('*')
      .eq('advertiser_id', advertiserId)
      .single();
    
    if (error) {
      throw new Error(`Failed to fetch advertiser: ${error.message}`);
    }
    
    if (!data) {
      throw new Error(`Advertiser ${advertiserId} not found`);
    }
    
    return data;
  }
  
  /**
   * Fetch pending offers for advertiser
   * @param {string} advertiserId - Advertiser ID
   * @param {string} status - Offer status (default: 'offer_made')
   * @returns {Promise<Array>} Array of offers
   */
  async getPendingOffers(advertiserId, status = 'offer_made') {
    const { data, error } = await this.supabase
      .from('offers')
      .select('*')
      .eq('advertiser_id', advertiserId)
      .eq('status', status)
      .order('created_at', { ascending: true });
    
    if (error) {
      throw new Error(`Failed to fetch offers: ${error.message}`);
    }
    
    return data || [];
  }
}
