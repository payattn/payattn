/**
 * ZK-SNARK Witness Generation
 * 
 * Handles loading WASM witness calculators and generating witnesses from user inputs.
 * Witness is the "computation trail" that proves the circuit logic was followed.
 */

/**
 * Witness calculator WASM module interface
 * Each compiled circuit exports a witness calculator with this interface
 */
interface WitnessCalculator {
  calculateWitness(inputs: Record<string, any>, sanityCheck?: boolean): Promise<bigint[]>;
  loadSymbols?(): void;
  getVersion?(): string;
}

/**
 * Cache for loaded WASM modules to avoid reloading
 */
const wasmCache = new Map<string, WitnessCalculator>();

/**
 * Load WASM witness calculator from a path
 * 
 * @param wasmPath - Path to .wasm file
 * @returns Loaded witness calculator
 */
async function loadWasmModule(wasmPath: string): Promise<WitnessCalculator> {
  // Check cache first
  if (wasmCache.has(wasmPath)) {
    return wasmCache.get(wasmPath)!;
  }

  try {
    // Fetch the WASM file
    const response = await fetch(wasmPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM: ${response.statusText}`);
    }

    const wasmBuffer = await response.arrayBuffer();

    // Instantiate the WASM module
    // Note: This assumes the WASM module exports the witness calculator interface
    // For circom-generated WASM, we need to use the witness_calculator.js wrapper
    const wasmModule = await WebAssembly.instantiate(wasmBuffer);

    // The witness calculator is exported as the WASM module instance
    // (This is simplified - actual implementation may need additional wrapping)
    const calculator = wasmModule.instance.exports as any;

    wasmCache.set(wasmPath, calculator);
    return calculator;
  } catch (error) {
    throw new Error(`Failed to load WASM module from ${wasmPath}: ${error}`);
  }
}

/**
 * Load witness calculator using the circom-generated witness_calculator.js
 * 
 * This is the more reliable method for circom circuits, which exports a proper interface
 * 
 * @param witnessCalculatorPath - Path to witness_calculator.js
 * @param wasmPath - Path to .wasm file
 * @returns Loaded witness calculator
 */
export async function loadWitnessCalculator(
  witnessCalculatorPath: string,
  wasmPath: string
): Promise<WitnessCalculator> {
  const cacheKey = `${witnessCalculatorPath}:${wasmPath}`;

  if (wasmCache.has(cacheKey)) {
    return wasmCache.get(cacheKey)!;
  }

  try {
    // Dynamic import of the witness calculator module
    // This assumes witness_calculator.js is bundled or available as a module
    const module = await import(witnessCalculatorPath);

    // Circom witness calculators export a factory function
    const calculatorFactory = module.default || module.WitnessCalculator;

    if (!calculatorFactory) {
      throw new Error('Witness calculator module does not export expected interface');
    }

    // Instantiate with the WASM path
    const calculator = await calculatorFactory(wasmPath);

    wasmCache.set(cacheKey, calculator);
    return calculator;
  } catch (error) {
    throw new Error(
      `Failed to load witness calculator from ${witnessCalculatorPath}: ${error}`
    );
  }
}

/**
 * Generate witness for circuit inputs
 * 
 * Witness is an array of field elements that prove the circuit logic
 * The first element is always 1 (the "constant" field element)
 * Subsequent elements correspond to signals in the circuit
 * 
 * @param calculator - Loaded witness calculator
 * @param inputs - Circuit inputs (private + public)
 * @returns Witness as array of bigint field elements
 */
export async function generateWitness(
  calculator: WitnessCalculator,
  inputs: Record<string, any>
): Promise<bigint[]> {
  try {
    // Convert all inputs to strings (circom expects string representation of numbers)
    const stringInputs: Record<string, string> = {};

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

    // Generate witness
    const witness = await calculator.calculateWitness(stringInputs, true);

    return witness;
  } catch (error) {
    throw new Error(`Failed to generate witness: ${error}`);
  }
}

/**
 * Convert witness array to format expected by snarkjs
 * 
 * Snarkjs works with strings representation of field elements
 * (to avoid JavaScript number precision issues with large field elements)
 * 
 * @param witness - Witness array from WASM calculator
 * @returns Stringified witness for snarkjs
 */
export function witnessToStringArray(witness: bigint[]): string[] {
  return witness.map(w => w.toString());
}

/**
 * Extract public signals from witness
 * 
 * For circom circuits, public inputs appear at fixed indices in the witness array
 * Index 0 is always "1" (one constraint)
 * Indices 1 to n are public inputs (if the circuit declares them)
 * Indices n+1 onwards are internal signals
 * 
 * You need to know the circuit's output indices (this varies per circuit)
 * 
 * @param witness - Full witness array
 * @param publicSignalIndices - Indices of public signals in witness (provided by circuit metadata)
 * @returns Extracted public signals
 */
export function extractPublicSignals(witness: bigint[], publicSignalIndices: number[]): bigint[] {
  const signals: bigint[] = [];
  for (const idx of publicSignalIndices) {
    if (idx >= witness.length) {
      throw new Error(
        `Public signal index ${idx} out of bounds (witness length: ${witness.length})`
      );
    }
    const signal = witness[idx];
    if (signal !== undefined) {
      signals.push(signal);
    }
  }
  return signals;
}

/**
 * Clear WASM cache (useful for memory management in long-running extensions)
 */
export function clearWasmCache(): void {
  wasmCache.clear();
}

/**
 * Get cache statistics (for debugging)
 */
export function getWasmCacheStats(): { size: number; entries: string[] } {
  return {
    size: wasmCache.size,
    entries: Array.from(wasmCache.keys())
  };
}
