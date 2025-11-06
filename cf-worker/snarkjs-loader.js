/**
 * Loader for snarkjs browser bundle (IIFE format)
 * 
 * The snarkjs.js file is an IIFE that assigns to a global `var snarkjs`.
 * In ES module context, we need to load it as text and execute it to capture that variable.
 */

// Import snarkjs.js as raw text (we'll load it at runtime)
// Since CF Workers don't support import assertions, we'll use importScripts-like approach

let snarkjs = null;

// Function to load snarkjs synchronously
async function loadSnarkjs() {
  if (snarkjs) return snarkjs;
  
  // Import the file - when executed, it creates `var snarkjs` in its scope
  // We need to capture that by using eval or similar
  try {
    // Import as a side effect to execute the IIFE
    await import('./snarkjs.js');
    
    // The IIFE should have set window.snarkjs or global.snarkjs
    // In Cloudflare Workers, we can try globalThis
    snarkjs = globalThis.snarkjs;
    
    if (!snarkjs) {
      throw new Error('snarkjs failed to load - globalThis.snarkjs is undefined');
    }
    
    return snarkjs;
  } catch (error) {
    console.error('Failed to load snarkjs:', error);
    throw error;
  }
}

export default loadSnarkjs;
