/**
 * ZK-SNARK Proof Generation - Extension (Client-Side)
 * 
 * This runs entirely within the Chrome extension service worker.
 * All private data stays here. Only proofs are sent to the backend.
 * 
 * Design:
 * - No server calls during proof generation
 * - All WASM/proving keys bundled with extension
 * - Private inputs never leave this process
 * - Only proof is exported for transmission
 */

/**
 * Load WASM module from extension bundle
 * Path relative to extension folder
 */
async function loadWasmFromBundle(wasmPath) {
  try {
    // In extension context, use chrome.runtime.getURL for bundled resources
    const wasmUrl = chrome.runtime.getURL(wasmPath);
    const response = await fetch(wasmUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM: ${response.statusText}`);
    }

    const wasmBuffer = await response.arrayBuffer();
    const wasmModule = await WebAssembly.instantiate(wasmBuffer);

    return wasmModule.instance.exports;
  } catch (error) {
    throw new Error(`Failed to load WASM from ${wasmPath}: ${error.message}`);
  }
}

/**
 * Get snarkjs from global scope (loaded via UMD build)
 * The snarkjs.min.js file must be loaded before this script
 */
function getSnarkjs() {
  if (typeof window.snarkjs === 'undefined') {
    throw new Error(
      'snarkjs not found! Make sure snarkjs.min.js is loaded before zk-prover.js.\n' +
      'Add to HTML: <script src="lib/snarkjs.min.js"></script>'
    );
  }
  return window.snarkjs;
}

/**
 * Generate witness using snarkjs directly
 * snarkjs handles WASM loading internally
 */

/**
 * Generate witness using snarkjs directly
 * snarkjs handles WASM loading internally
 */
async function generateWitness(wasmPath, inputs) {
  try {
    const snarkjs = getSnarkjs();
    
    // Load WASM file as buffer
    const wasmUrl = chrome.runtime.getURL(wasmPath);
    const wasmResponse = await fetch(wasmUrl);
    
    if (!wasmResponse.ok) {
      throw new Error(`Failed to fetch WASM: ${wasmResponse.statusText}`);
    }
    
    const wasmBuffer = await wasmResponse.arrayBuffer();
    
    // Convert inputs to the format snarkjs expects
    const stringInputs = {};
    for (const [key, value] of Object.entries(inputs)) {
      if (typeof value === 'number') {
        stringInputs[key] = value.toString();
      } else if (typeof value === 'bigint') {
        stringInputs[key] = value.toString();
      } else if (typeof value === 'string') {
        stringInputs[key] = value;
      } else if (Array.isArray(value)) {
        stringInputs[key] = value.map(v => v.toString());
      } else {
        stringInputs[key] = String(value);
      }
    }
    
    // Calculate witness buffer using snarkjs wtns API
    const wtnsBuffer = await snarkjs.wtns.calculate(stringInputs, wasmBuffer);
    
    // Export witness to array format for proof generation
    const witnessArray = await snarkjs.wtns.exportJson(wtnsBuffer);
    
    return witnessArray;
  } catch (error) {
    throw new Error(`Failed to generate witness: ${error.message}`);
  }
}

/**
 * Load proving key from extension bundle
 * These are bundled with the extension, never exposed externally
 */
async function loadProvingKey(zKeyPath) {
  try {
    const zkeyUrl = chrome.runtime.getURL(zKeyPath);
    const response = await fetch(zkeyUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch proving key: ${response.statusText}`);
    }

    const zKeyBuffer = await response.arrayBuffer();
    const zKeyBytes = new Uint8Array(zKeyBuffer);

    return zKeyBytes;
  } catch (error) {
    throw new Error(`Failed to load proving key from ${zKeyPath}: ${error.message}`);
  }
}

/**
 * Main proof generation function
 * All private data is processed here - nothing leaves the extension
 * Uses manual witness calculation to avoid Web Workers (CSP restriction)
 */
async function generateProof(circuitName, privateInputs, publicInputs, options = {}) {
  const { verbose = false } = options;

  try {
    if (verbose) console.log(`[Extension ZK] Generating proof for: ${circuitName}`);

    // Get circuit metadata
    const circuit = CIRCUITS_REGISTRY[circuitName];
    if (!circuit) {
      throw new Error(`Circuit not found: ${circuitName}`);
    }

    // Combine inputs
    const allInputs = { ...privateInputs, ...publicInputs };

    if (verbose) console.log(`[Extension ZK] Loading WASM...`);

    // Get snarkjs from global scope
    const snarkjs = getSnarkjs();
    
    // Load WASM file - convert to Uint8Array for snarkjs
    const wasmUrl = chrome.runtime.getURL(circuit.wasmPath);
    const wasmResponse = await fetch(wasmUrl);
    if (!wasmResponse.ok) {
      throw new Error(`Failed to fetch WASM: ${wasmResponse.statusText}`);
    }
    const wasmArrayBuffer = await wasmResponse.arrayBuffer();
    const wasmCode = new Uint8Array(wasmArrayBuffer);
    
    if (verbose) console.log(`[Extension ZK] Loading proving key...`);
    
    // Load proving key as Uint8Array
    const zKeyUrl = chrome.runtime.getURL(circuit.zKeyPath);
    const zKeyResponse = await fetch(zKeyUrl);
    if (!zKeyResponse.ok) {
      throw new Error(`Failed to fetch proving key: ${zKeyResponse.statusText}`);
    }
    const zKeyArrayBuffer = await zKeyResponse.arrayBuffer();
    const zKeyCode = new Uint8Array(zKeyArrayBuffer);

    if (verbose) console.log(`[Extension ZK] Generating proof using fullProve()...`);

    // Create a simple logger for snarkjs (4th parameter)
    const logger = {
      debug: (msg) => { if (verbose) console.log(`[snarkjs] ${msg}`); },
      info: (msg) => { if (verbose) console.log(`[snarkjs] ${msg}`); },
      warn: (msg) => { if (verbose) console.warn(`[snarkjs] ${msg}`); },
      error: (msg) => { console.error(`[snarkjs] ${msg}`); }
    };

    // Use groth16.fullProve() which does witness calculation + proof generation
    // Pass Uint8Arrays directly for both WASM and zkey
    // See: https://github.com/iden3/snarkjs#in-the-browser
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      allInputs,
      wasmCode,
      zKeyCode,
      logger,
      { singleThread: true }
    );

    if (verbose) {
      console.log(`[Extension ZK] Proof generated successfully`);
      console.log(`[Extension ZK] Public signals:`, publicSignals);
    }

    // Return proof package (ready to send to backend)
    // Note: privateInputs are NOT included
    return {
      circuitName,
      proof: {
        pi_a: proof.pi_a,
        pi_b: proof.pi_b,
        pi_c: proof.pi_c,
        protocol: proof.protocol,
        curve: proof.curve
      },
      publicSignals,
      timestamp: Date.now(),
      version: '1.0'
    };

  } catch (error) {
    console.error(`[Extension ZK] Proof generation failed:`, error);
    throw new Error(`Failed to generate proof: ${error.message}`);
  }
}

/**
 * Convenience function for age proofs
 * Private data stays in extension
 */
async function generateAgeProof(userAge, minAge, maxAge, options = {}) {
  return generateProof(
    'age_range',
    { age: userAge },           // PRIVATE - never leaves extension
    { minAge, maxAge },         // PUBLIC - only in proof
    options
  );
}

/**
 * Get snarkjs from global scope (loaded via UMD build)
 * The snarkjs.min.js file must be loaded before this script
 */
function getSnarkjs() {
  if (typeof window.snarkjs === 'undefined') {
    throw new Error(
      'snarkjs not found! Make sure snarkjs.min.js is loaded before zk-prover.js.\n' +
      'Add to HTML: <script src="lib/snarkjs.min.js"></script>'
    );
  }
  return window.snarkjs;
}

/**
 * Serialize proof for transmission to backend
 */
function serializeProof(proofPackage) {
  return JSON.stringify(proofPackage);
}

/**
 * Deserialize proof from backend response
 */
function deserializeProof(json) {
  return JSON.parse(json);
}

/**
 * Circuit registry (shared configuration)
 * Maps circuit names to artifact paths (relative to extension)
 */
const CIRCUITS_REGISTRY = {
  age_range: {
    name: 'age_range',
    type: 'range',
    wasmPath: 'circuits/age_range/age_range.wasm',
    zKeyPath: 'circuits/age_range/age_range_0000.zkey',
    verificationKeyPath: 'circuits/age_range/verification_key.json',
    description: 'Proves user age is within specified range'
  },
  
  range_proof: {
    name: 'range_proof',
    type: 'range',
    wasmPath: 'circuits/range_proof/range_proof.wasm',
    zKeyPath: 'circuits/range_proof/range_proof_0000.zkey',
    verificationKeyPath: 'circuits/range_proof/verification_key.json',
    description: 'Generic circuit for proving any numeric value is within bounds'
  },

  set_membership: {
    name: 'set_membership',
    type: 'set_membership',
    wasmPath: 'circuits/set_membership/set_membership.wasm',
    zKeyPath: 'circuits/set_membership/set_membership_0000.zkey',
    verificationKeyPath: 'circuits/set_membership/verification_key.json',
    description: 'Generic circuit for proving a value is in an allowed set'
  }
};

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateProof,
    generateAgeProof,
    serializeProof,
    deserializeProof,
    CIRCUITS_REGISTRY,
    loadProvingKey,
    generateWitness
  };
}

// Also expose globally in extension context
window.ZKProver = {
  generateProof,
  generateAgeProof,
  serializeProof,
  deserializeProof,
  CIRCUITS_REGISTRY
};
