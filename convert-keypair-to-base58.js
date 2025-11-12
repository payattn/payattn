#!/usr/bin/env node

/**
 * Convert Solana CLI keypair (JSON array) to Base58 private key for Phantom import
 * Usage: node convert-keypair-to-base58.js ~/.config/solana/advertiser.json
 */

const fs = require('fs');
const path = require('path');

// Parse command line argument
const keypairPath = process.argv[2] || path.join(process.env.HOME, '.config/solana/advertiser.json');

try {
  console.log('Reading keypair from:', keypairPath);
  
  // Read the JSON file
  const keypairData = fs.readFileSync(keypairPath, 'utf8');
  const keypairArray = JSON.parse(keypairData);
  
  // Convert to Uint8Array
  const keypairBytes = new Uint8Array(keypairArray);
  
  // Base58 encode (simple implementation)
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  
  function base58Encode(buffer) {
    if (buffer.length === 0) return '';
    
    let digits = [0];
    for (let i = 0; i < buffer.length; i++) {
      let carry = buffer[i];
      for (let j = 0; j < digits.length; j++) {
        carry += digits[j] << 8;
        digits[j] = carry % 58;
        carry = (carry / 58) | 0;
      }
      while (carry > 0) {
        digits.push(carry % 58);
        carry = (carry / 58) | 0;
      }
    }
    
    // Deal with leading zeros
    for (let i = 0; buffer[i] === 0 && i < buffer.length - 1; i++) {
      digits.push(0);
    }
    
    return digits.reverse().map(digit => ALPHABET[digit]).join('');
  }
  
  const privateKeyBase58 = base58Encode(keypairBytes);
  
  console.log('\n*** SUCCESS!\n');
  console.log('='.repeat(80));
  console.log('BASE58 PRIVATE KEY (for Phantom import):');
  console.log('='.repeat(80));
  console.log(privateKeyBase58);
  console.log('='.repeat(80));
  console.log('\n*** INSTRUCTIONS:');
  console.log('1. Copy the private key above (the long string)');
  console.log('2. Open Phantom wallet');
  console.log('3. Click Settings → Add / Connect Wallet → Import Private Key');
  console.log('4. Paste the private key');
  console.log('5. Make sure network is set to DEVNET');
  console.log('6. You should see address: AE6uwbubDn9WyXrpzvqU58jfirvqZAxWCZCfDDwW5MMb\n');
  
} catch (error) {
  console.error('❌ ERROR:', error.message);
  console.log('\nUsage: node convert-keypair-to-base58.js [path-to-keypair.json]');
  console.log('Example: node convert-keypair-to-base58.js ~/.config/solana/advertiser.json');
  process.exit(1);
}
