import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import * as web3 from '@solana/web3.js';
import * as nacl from 'tweetnacl';

const SERVER_SECRET = process.env.KDS_SECRET || 'default-secret-for-development-only';
const KEY_VERSION = '1';

/**
 * Verify that the signature matches the wallet address
 */
function verifySignature(walletAddress: string, authToken: string): boolean {
  try {
    // Decode the base64 authToken to get signature bytes
    const signatureBytes = Uint8Array.from(atob(authToken), c => c.charCodeAt(0));
    
    console.log('[KDS] Signature details:', {
      authTokenLength: authToken.length,
      signatureBytesLength: signatureBytes.length,
      walletAddress
    });
    
    // Create the message that was signed
    const message = `Sign in to Pay Attention\n\nWallet: ${walletAddress}`;
    const messageBytes = new TextEncoder().encode(message);
    
    console.log('[KDS] Message details:', {
      message,
      messageBytesLength: messageBytes.length
    });
    
    // Parse wallet address to get public key
    const publicKey = new web3.PublicKey(walletAddress);
    const publicKeyBytes = publicKey.toBytes();
    
    console.log('[KDS] Public key bytes length:', publicKeyBytes.length);
    
    // Verify signature
    const verified = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    console.log('[KDS] Signature verification:', { walletAddress, verified });
    
    return verified;
  } catch (error) {
    console.error('[KDS] Signature verification error:', error);
    return false;
  }
}

/**
 * Compute the keyHash from wallet address (deterministic)
 */
function computeKeyHashFromWallet(walletAddress: string): string {
  const input = `payattn:${walletAddress}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  const { hash } = await params;
  
  console.log('[KDS] Received hash:', hash);
  console.log('[KDS] Hash length:', hash.length);
  console.log('[KDS] Hash matches pattern:', /^[a-f0-9]{64}$/.test(hash));

  // Validate hash format
  if (!hash || !/^[a-f0-9]{64}$/.test(hash)) {
    return NextResponse.json(
      { error: 'Invalid hash format' },
      { status: 400 }
    );
  }

  // Get auth headers
  const walletAddress = request.headers.get('x-wallet');
  const authToken = request.headers.get('x-auth-token');

  console.log('[KDS] Auth headers:', { 
    hasWallet: !!walletAddress, 
    hasAuthToken: !!authToken 
  });

  // Require authentication
  if (!walletAddress || !authToken) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Verify signature matches wallet
  if (!verifySignature(walletAddress, authToken)) {
    return NextResponse.json(
      { error: 'Invalid authentication signature' },
      { status: 403 }
    );
  }

  // Verify requested keyHash matches wallet address
  const expectedKeyHash = computeKeyHashFromWallet(walletAddress);
  if (hash !== expectedKeyHash) {
    console.log('[KDS] KeyHash mismatch:', { requested: hash, expected: expectedKeyHash });
    return NextResponse.json(
      { error: 'KeyHash does not match authenticated wallet' },
      { status: 403 }
    );
  }

  // Generate key material using HMAC
  const hmac = crypto.createHmac('sha256', SERVER_SECRET);
  hmac.update(hash);
  const keyMaterial = hmac.digest('base64');

  return NextResponse.json({
    keyMaterial,
    version: KEY_VERSION
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Wallet, X-Auth-Token',
    },
  });
}
