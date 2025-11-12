# ZK-SNARK Developer Quick Reference

**Last Updated:** November 5, 2025

---

## Quick Start: Generate & Verify an Age Proof

### Client-Side (Extension/Browser)

```typescript
import { generateProof, generateAgeProof } from '@/lib/zk';

// Option 1: Using convenience function
const userAge = 45;
const campaignMinAge = 40;
const campaignMaxAge = 60;

const proof = await generateAgeProof(userAge, campaignMinAge, campaignMaxAge, {
  verbose: true  // Show progress logs
});

console.log('Proof generated:', proof);
// {
//   circuitName: 'age_range',
//   proof: { pi_a: [...], pi_b: [...], pi_c: [...] },
//   publicSignals: ['1', '40', '60'],
//   timestamp: 1730797634000,
//   version: '1.0'
// }

// Send to backend
const response = await fetch('/api/verify-proof', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(proof)
});

const result = await response.json();
console.log('Verification result:', result);
// { success: true, result: { valid: true, message: '...' } }
```

### Server-Side (Backend)

```typescript
import { verifyProof, verifyAgeProof } from '@/lib/zk';

// In your API route handler
const { circuitName, proof, publicSignals } = await request.json();

// Verify the proof
const result = await verifyProof(circuitName, proof, publicSignals);

if (result.valid) {
  console.log(` User is eligible! Age range: ${publicSignals[1]}-${publicSignals[2]}`);
} else {
  console.log(` Proof verification failed: ${result.message}`);
}
```

---

## Common Imports

```typescript
// Get all ZK utilities
export * from '@/lib/zk';

// Specific modules:
import { generateProof, generateAgeProof } from '@/lib/zk/prover';
import { verifyProof, verifyAgeProof } from '@/lib/zk/verifier';
import { getCircuit, validateCircuitInputs } from '@/lib/zk/circuits-registry';
import { generateWitness, loadWitnessCalculator } from '@/lib/zk/witness';
```

---

## Common Tasks

### 1. Generate a Proof

```typescript
import { generateProof } from '@/lib/zk';

const proof = await generateProof(
  'age_range',                    // Circuit name
  { age: 45 },                    // Private inputs
  { minAge: 40, maxAge: 60 },     // Public inputs
  { verbose: true }               // Options
);
```

### 2. Verify a Proof

```typescript
import { verifyProof } from '@/lib/zk';

const result = await verifyProof('age_range', proof.proof, proof.publicSignals);

if (result.valid) {
  // User proved they meet the criteria
}
```

### 3. Validate Inputs Before Proof Generation

```typescript
import { validateCircuitInputs } from '@/lib/zk';

const validation = validateCircuitInputs(
  'age_range',
  { age: 45 },
  { minAge: 40, maxAge: 60 }
);

if (!validation.valid) {
  console.error('Input validation failed:', validation.errors);
}
```

### 4. List Available Circuits

```typescript
import { listCircuits, getCircuit } from '@/lib/zk';

const allCircuits = listCircuits();
console.log('Available circuits:', allCircuits);
// ['age_range', 'range_proof', 'set_membership']

const ageCircuit = getCircuit('age_range');
console.log('Circuit description:', ageCircuit.description);
```

### 5. Verify Multiple Proofs (Batch)

```typescript
import { verifyProofBatch, allProofsValid } from '@/lib/zk';

const results = await verifyProofBatch([
  {
    circuitName: 'age_range',
    proof: agePr proof,
    publicSignals: ['1', '40', '60']
  },
  {
    circuitName: 'range_proof',
    proof: incomeProof,
    publicSignals: ['1', '50000', '200000']
  }
]);

if (allProofsValid(results)) {
  console.log(' All criteria met');
} else {
  console.log(' Some criteria not met');
}
```

---

## Security Considerations

###  DO:
- Keep private inputs on the client side
- Only send proofs and public signals to backend
- Verify proofs on backend (don't trust client verification)
- Cache verification keys (small, public)
- Use proving keys only on client side

###  DON'T:
- Send private inputs to the backend
- Expose proving keys (`.zkey` files)
- Trust client-side verification alone
- Commit `.zkey` files to version control
- Store private input values anywhere

---

## Data Flow Diagram

```
User (Browser/Extension)

 Private Input (age: 45)
   NEVER sent to server 

 Public Input (minAge: 40, maxAge: 60)
   Only in proof (hashed) 

 Generate Proof
   Load WASM from /circuits/age_range/age_range.wasm
   Load .zkey from /circuits/age_range/age_range_0000.zkey
   Calculate witness (using WASM)
   Create Groth16 proof 

 Send to Backend
    Proof object
    Public signals
    Circuit name
       
       
   Backend /api/verify-proof
   
    Load verification_key.json
    Verify proof cryptographically 
   
    Response: { valid: true/false }
       
       
   Advertiser: "User matches age criteria" 
   (Never knows actual age)
```

---

##  Debugging Tips

### Enable Verbose Logging

```typescript
const proof = await generateProof('age_range', privateInputs, publicInputs, {
  verbose: true  // Logs each step
});
```

### Check Circuit Registry

```typescript
import { getCircuit, CIRCUITS } from '@/lib/zk';

// See all circuit metadata
console.log(CIRCUITS);

// Get specific circuit info
const circuit = getCircuit('age_range');
console.log('Circuit paths:', {
  wasm: circuit.wasmPath,
  zkey: circuit.zKeyPath,
  verificationKey: circuit.verificationKeyPath
});
```

### Check Cache Statistics

```typescript
import { getWasmCacheStats, getProvingKeyCacheStats, getVerificationKeyCacheStats } from '@/lib/zk';

console.log('WASM cache:', getWasmCacheStats());
console.log('Proving key cache:', getProvingKeyCacheStats());
console.log('Verification key cache:', getVerificationKeyCacheStats());
```

### Clear Caches (if needed)

```typescript
import { clearWasmCache, clearProvingKeyCache, clearVerificationKeyCache } from '@/lib/zk';

clearWasmCache();
clearProvingKeyCache();
clearVerificationKeyCache();
```

---

## File Locations Quick Reference

```
Circuit Artifacts:
 extension/circuits/age_range/
    age_range.wasm            (WASM witness calculator)
    witness_calculator.js      (JS wrapper)
    age_range_0000.zkey        (Proving key - secret!)

 public/circuits/age_range/
     verification_key.json      (Verification key - public)

ZK Library:
 lib/zk/
     index.ts                   (Main exports)
     circuits-registry.ts       (Circuit metadata)
     witness.ts                 (WASM + witness generation)
     prover.ts                  (Proof generation)
     verifier.ts                (Proof verification)

API Endpoints:
 app/api/verify-proof/route.ts  (Proof verification endpoint)

Documentation:
 CIRCUITS-ARCHITECTURE.md       (Full architecture guide)
 WP02-PHASE1-COMPLETE.md        (Phase 1 completion report)
 ZK-SNARK-GUIDE.md              (This file!)
```

---

## Workflow: Adding a New Criterion Type

### Step 1: Create Circuit (in test repo)
```bash
cd /Users/jmd/nosync/is.jmd.zksnark/

# Create income_range.circom
circom income_range.circom --r1cs --wasm --sym
snarkjs groth16 setup ...  # See ZK-SNARK-ANALYSIS.md
```

### Step 2: Export Artifacts
```bash
# Copy to project repo
cp income_range_js/income_range.wasm \
  ~/org.payattn.main/agent-dashboard/extension/circuits/income_range/

cp income_range_0000.zkey \
  ~/org.payattn.main/agent-dashboard/extension/circuits/income_range/

cp verification_key.json \
  ~/org.payattn.main/agent-dashboard/public/circuits/income_range/
```

### Step 3: Register Circuit
Edit `lib/zk/circuits-registry.ts`:
```typescript
export const CIRCUITS: Record<string, CircuitRegistry> = {
  // ... existing circuits ...
  income_range: {
    name: 'income_range',
    type: 'range',
    wasmPath: '/circuits/income_range/income_range.wasm',
    zKeyPath: '/circuits/income_range/income_range_0000.zkey',
    verificationKeyPath: '/circuits/income_range/verification_key.json',
    inputSchema: {
      private: { income: 'number' },
      public: { minIncome: 'number', maxIncome: 'number' }
    },
    description: 'Proves income is within range'
  }
};
```

### Step 4: Create Convenience Function
Create `lib/zk/circuits/incomeRange.ts`:
```typescript
import { generateProof } from '../prover';

export async function generateIncomeProof(
  income: number,
  minIncome: number,
  maxIncome: number,
  options?: any
) {
  return generateProof(
    'income_range',
    { income },
    { minIncome, maxIncome },
    options
  );
}
```

### Step 5: Use It
```typescript
import { generateIncomeProof } from '@/lib/zk/circuits/incomeRange';

const proof = await generateIncomeProof(75000, 50000, 200000);
```

---

##  Learn More

- **Full Architecture:** `CIRCUITS-ARCHITECTURE.md`
- **ZK Theory:** `ZK-SNARK-ANALYSIS.md`
- **Test Repo:** `/Users/jmd/nosync/is.jmd.zksnark/`
- **snarkjs Docs:** https://github.com/iden3/snarkjs
- **Circom Docs:** https://docs.circom.io/

---

##  Common Questions

**Q: Why do I need both WASM and witness_calculator.js?**  
A: circom generates WASM for performance, and witness_calculator.js provides the proper interface for calling it.

**Q: Can I regenerate proofs with the same inputs?**  
A: No - Groth16 proofs are randomized. Each proof generation creates a different proof (still valid).

**Q: How large are the circuit artifacts?**  
A: WASM: 30-50 KB, Proving key: 3-5 MB, Verification key: 3-5 KB

**Q: Can I cache proofs?**  
A: Not recommended - proofs are randomized. Cache the inputs and regenerate as needed.

**Q: What if proof generation is slow?**  
A: Age range proofs take ~500ms on modern CPUs. Use Web Workers or backend generation for better UX.

**Q: Is it secure to send proofs over HTTP?**  
A: Yes - proofs can't be forged. Use HTTPS for confidentiality of public signals.

---

Last updated: November 5, 2025  
Phase: WP02 Phase 1 Complete 
