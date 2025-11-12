/**
 * Simple x402 Flow Test
 * 
 * Tests: Accept offer → Fund escrow → Verify payment
 * 
 * Run: node solana/payattn_escrow/test-x402-simple.js
 */

const BACKEND_URL = 'http://localhost:3000';

// Test offer ID from database
const offerId = 'offer_41f8f17d3b6bebd6';

console.log('🧪 Testing x402 Payment Required Flow\n');
console.log('='.repeat(60));
console.log('Backend URL:', BACKEND_URL);
console.log('Offer ID:', offerId);
console.log('='.repeat(60), '\n');

async function testX402Flow() {
  try {
    // Step 1: Accept offer (get 402 response)
    console.log('[STEP 1] Accepting offer...');
    
    const acceptResponse = await fetch(`${BACKEND_URL}/api/advertiser/offers/${offerId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('Status:', acceptResponse.status, acceptResponse.statusText);
    
    if (acceptResponse.status !== 402) {
      const error = await acceptResponse.json();
      throw new Error(`Expected 402, got ${acceptResponse.status}: ${JSON.stringify(error)}`);
    }
    
    // Extract x402 headers
    const x402Headers = {
      paymentChain: acceptResponse.headers.get('x-payment-chain'),
      paymentNetwork: acceptResponse.headers.get('x-payment-network'),
      paymentAmount: acceptResponse.headers.get('x-payment-amount'),
      paymentToken: acceptResponse.headers.get('x-payment-token'),
      offerId: acceptResponse.headers.get('x-offer-id'),
      userPubkey: acceptResponse.headers.get('x-user-pubkey'),
      platformPubkey: acceptResponse.headers.get('x-platform-pubkey'),
      escrowProgram: acceptResponse.headers.get('x-escrow-program'),
      escrowPda: acceptResponse.headers.get('x-escrow-pda'),
      verificationEndpoint: acceptResponse.headers.get('x-verification-endpoint')
    };
    
    const body = await acceptResponse.json();
    
    console.log('[OK] Received 402 Payment Required');
    console.log('Response Body:', JSON.stringify(body, null, 2));
    console.log('x402 Headers:', JSON.stringify(x402Headers, null, 2), '\n');
    
    // Step 2 & 3 would require Solana wallet to fund escrow
    console.log('*** Next steps (manual):');
    console.log('  1. Fund escrow at PDA:', x402Headers.escrowPda);
    console.log('  2. Amount:', x402Headers.paymentAmount, 'lamports');
    console.log('  3. Use advertiser wallet to call createEscrow()');
    console.log('  4. Submit tx signature to:', x402Headers.verificationEndpoint);
    
    console.log('\n='.repeat(60));
    console.log('*** x402 Response Test PASSED!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    process.exit(1);
  }
}

testX402Flow();
