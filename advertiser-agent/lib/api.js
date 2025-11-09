import { config } from '../config.js';

export class BackendClient {
  constructor() {
    this.baseUrl = config.apiUrl;
    this.advertiserId = config.advertiserId;
  }
  
  /**
   * Fetch pending offers from backend
   * @returns {Promise<Array>} Array of offer objects
   */
  async fetchPendingOffers() {
    const url = `${this.baseUrl}/api/advertiser/offers?status=offer_made&advertiser_id=${this.advertiserId}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch offers: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.offers || [];
      
    } catch (error) {
      console.error('Error fetching offers:', error.message);
      return [];
    }
  }
  
  /**
   * Accept an offer (triggers HTTP 402 response with escrow details)
   * @param {string} offerId - Offer ID to accept
   * @returns {Promise<Object>} x402 payment details
   */
  async acceptOffer(offerId) {
    const url = `${this.baseUrl}/api/advertiser/offers/${offerId}/accept`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    // Expect HTTP 402 Payment Required
    if (response.status !== 402) {
      const error = await response.json();
      throw new Error(`Expected 402, got ${response.status}: ${error.error || 'Unknown error'}`);
    }
    
    // Parse x402 headers
    const x402Data = {
      offerId: response.headers.get('x-offer-id'),
      escrowPda: response.headers.get('x-escrow-pda'),
      paymentAmount: parseInt(response.headers.get('x-payment-amount')),
      userPubkey: response.headers.get('x-user-pubkey'),
      platformPubkey: response.headers.get('x-platform-pubkey'),
      programId: response.headers.get('x-escrow-program'),
      verificationEndpoint: response.headers.get('x-verification-endpoint'),
      paymentChain: response.headers.get('x-payment-chain'),
      paymentNetwork: response.headers.get('x-payment-network'),
    };
    
    // Validate required fields
    if (!x402Data.offerId || !x402Data.escrowPda || !x402Data.paymentAmount) {
      throw new Error('Invalid x402 response - missing required headers');
    }
    
    return x402Data;
  }
  
  /**
   * Submit payment proof after funding escrow
   * @param {string} offerId - Offer ID
   * @param {string} txSignature - Solana transaction signature
   * @returns {Promise<Object>} Verification result
   */
  async submitPaymentProof(offerId, txSignature) {
    const url = `${this.baseUrl}/api/advertiser/payments/verify`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offerId, txSignature })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Payment verification failed: ${error.error || 'Unknown error'}`);
    }
    
    return await response.json();
  }
}
