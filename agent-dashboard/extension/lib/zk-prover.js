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
 * Load witness calculator (circom-generated)
 * This is the JavaScript wrapper that calls WASM
 */
async function loadWitnessCalculator(wasmPath) {
  try {
    // Dynamic import the witness_calculator module
    const witnessCalculatorPath = wasmPath.replace('.wasm', '.js');
    
    // In extension context, we load it as a separate file
    const scriptUrl = chrome.runtime.getURL(witnessCalculatorPath);
    
    // Load the script in global scope
    const response = await fetch(scriptUrl);
    const scriptContent = await response.text();
    
    // Execute in extension context
    const module = {};
    eval(scriptContent);
    
    // Return the calculator factory or instance
    return module.WitnessCalculator || window.WitnessCalculator;
  } catch (error) {
    throw new Error(`Failed to load witness calculator: ${error.message}`);
  }
}

/**
 * Generate witness from inputs using WASM
 */
async function generateWitness(calculator, inputs) {
  try {
    // Convert inputs to strings (circom expects string representation)
    const stringInputs = {};
    
    for (const [key, value] of Object.entries(inputs)) {
      if (typeof value === 'number') {
        stringInputs[key] = value.toString();
      } else if (typeof value === 'bigint') {
        stringInputs[key] = value.toString();
      } else if (typeof value === 'string') {
        stringInputs[key] = value;
      } else if (Array.isArray(value)) {
        stringInputs[key] = value.map(v => v.toString()).toString();
      } else {
        stringInputs[key] = String(value);
      }
    }

    // Calculate witness using WASM
    const witness = await calculator.calculateWitness(stringInputs, true);

    return witness;
  } catch (error) {
    throw new Error(`Failed to generate witness: ${error.message}`);
  }
}

/**
 * Convert witness to format needed by snarkjs
 */
function witnessToStringArray(witness) {
  return witness.map(w => w.toString());
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

    if (verbose) console.log(`[Extension ZK] Loading witness calculator...`);

    // Load witness calculator (stays in extension)
    const calculator = await loadWitnessCalculator(circuit.wasmPath);

    // Combine inputs
    const allInputs = { ...privateInputs, ...publicInputs };

    if (verbose) console.log(`[Extension ZK] Generating witness...`);

    // Generate witness (stays in extension)
    const witness = await generateWitness(calculator, allInputs);

    if (verbose) console.log(`[Extension ZK] Loading proving key...`);

    // Load proving key (stays in extension, never transmitted)
    const zKey = await loadProvingKey(circuit.zKeyPath);

    if (verbose) console.log(`[Extension ZK] Generating Groth16 proof...`);

    // Need to dynamically import snarkjs for browser/extension
    // This is fetched at runtime
    const snarkjs = await importSnarkjs();

    // Generate proof
    const witnessStrings = witnessToStringArray(witness);
    const { proof, publicSignals } = await snarkjs.groth16.prove(
      zKey,
      witnessStrings
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
 * Import snarkjs at runtime (for browser/extension)
 */
async function importSnarkjs() {
  // In a browser extension, we need to handle this carefully
  // Option 1: Include snarkjs as bundled library
  // Option 2: Load from CDN
  
  if (typeof snarkjs !== 'undefined') {
    return snarkjs;
  }

  // Load from CDN as fallback (for development)
  return await import('https://cdn.jsdelivr.net/npm/snarkjs@0.7.0/main.js');
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
    loadWasmFromBundle,
    loadProvingKey,
    generateWitness,
    loadWitnessCalculator
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
