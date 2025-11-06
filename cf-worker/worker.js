/**
 * Cloudflare Worker: ZK-SNARK Proof Verifier
 * 
 * Verifies Groth16 ZK-SNARK proofs using snarkjs in V8 runtime
 * Solves Node.js BN128 hanging issue by running in Cloudflare Workers
 * 
 * API: POST /verify-proof
 * Body: { proof, publicSignals, circuitName }
 * Returns: { valid: boolean, circuitName: string, verificationTime: number }
 */

// Import embedded verification keys
import { VERIFICATION_KEYS } from './verification-keys-embedded.js';

/**
 * Get verification key for a circuit
 */
function getVerificationKey(circuitName) {
  const vkey = VERIFICATION_KEYS[circuitName];
  if (!vkey) {
    throw new Error(`Circuit not found: ${circuitName}`);
  }
  return vkey;
}

/**
 * Verify a ZK-SNARK proof using embedded snarkjs
 */
async function verifyProof(proof, publicSignals, circuitName, env) {
  const startTime = Date.now();
  
  console.log(`[Worker] Starting verification for circuit: ${circuitName}`);
  
  // Load verification key
  const verificationKey = getVerificationKey(circuitName);
  
  // CRITICAL: Force single-threaded mode by hiding Worker API
  // This must be done BEFORE importing snarkjs to affect ffjavascript initialization
  const originalWorker = globalThis.Worker;
  globalThis.Worker = undefined;
  
  try {
    // Import snarkjs from npm package (Node.js build, no WASM issues)
    const snarkjs = await import('snarkjs');
    
    console.log(`[Worker] snarkjs loaded, groth16:`, typeof snarkjs?.groth16);
    
    // Verify using snarkjs.groth16.verify
    console.log(`[Worker] Running groth16 verification (singleThread mode)...`);
    const isValid = await snarkjs.groth16.verify(verificationKey, publicSignals, proof);
    
    const verificationTime = Date.now() - startTime;
    console.log(`[Worker] Verification completed in ${verificationTime}ms - Result: ${isValid}`);
    
    return {
      valid: isValid,
      circuitName,
      verificationTime,
      timestamp: Date.now()
    };
  } finally {
    // Restore Worker global (cleanup)
    globalThis.Worker = originalWorker;
  }
}

/**
 * Main request handler
 */
async function handleRequest(request, env) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }
  
  // Health check
  if (request.method === 'GET') {
    return new Response(JSON.stringify({
      status: 'ok',
      service: 'payattn-zk-verifier',
      version: '1.0.0',
      circuits: ['age_range', 'range_check', 'set_membership']
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Only allow POST for verification
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Parse request body
    const body = await request.json();
    const { proof, publicSignals, circuitName } = body;
    
    // Validate input
    if (!proof || !publicSignals || !circuitName) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: proof, publicSignals, circuitName'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Verify proof
    const result = await verifyProof(proof, publicSignals, circuitName, env);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } catch (error) {
    console.error('[Worker] Verification error:', error);
    
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: Date.now()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Cloudflare Workers export
 */
export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  }
};
