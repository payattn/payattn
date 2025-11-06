# ZK-SNARK Circuit Development Guide

**Last Updated:** November 5, 2025  
**Status:** Active Development

## Overview

This guide documents how to create new ZK-SNARK circuits for the PayAttn extension using your existing workflow in `/Users/jmd/nosync/is.jmd.zksnark`.

## Your Current Setup

### Development Environment
- **Location:** `/Users/jmd/nosync/is.jmd.zksnark`
- **Circom Compiler:** Installed (Rust-based)
- **snarkjs:** Available via CLI
- **Ceremony Files:** Powers of Tau files ready

### Existing Circuit

**`age_range.circom`** (507 bytes)
```circom
pragma circom 2.0.0;

template AgeInRange() {
    signal input age;
    signal input minAge;
    signal input maxAge;
    signal output valid;
    
    // Check age >= minAge
    signal ageOk;
    ageOk <-- (age >= minAge) ? 1 : 0;
    ageOk * (age - minAge) === age - minAge;
    
    // Check age <= maxAge  
    signal maxOk;
    maxOk <-- (age <= maxAge) ? 1 : 0;
    maxOk * (maxAge - age) === maxAge - age;
    
    valid <== ageOk * maxOk;
}

component main {public [minAge, maxAge]} = AgeInRange();
```

**Inputs:**
- `age` (private) - User's actual age
- `minAge` (public) - Lower bound from campaign
- `maxAge` (public) - Upper bound from campaign

**Output:**
- `valid` - 1 if age in range, 0 otherwise

**Public Signals:** `[minAge, maxAge]` - These appear in the proof and can be verified

## Complete Workflow

### 1. Create Circuit (Circom)

```bash
cd /Users/jmd/nosync/is.jmd.zksnark

# Create new circuit file
cat > my_circuit.circom << 'EOF'
pragma circom 2.0.0;

template MyCircuit() {
    signal input privateInput;
    signal input publicInput;
    signal output result;
    
    // Your circuit logic here
    result <== privateInput + publicInput;
}

component main {public [publicInput]} = MyCircuit();
EOF
```

### 2. Compile Circuit

```bash
# Compile to R1CS constraint system and WASM witness generator
circom my_circuit.circom --r1cs --wasm --sym --c

# This creates:
# - my_circuit.r1cs (constraint system)
# - my_circuit_js/my_circuit.wasm (witness calculator)
# - my_circuit.sym (symbol table)
```

### 3. Generate Proving Key

```bash
# Use existing pot12_final.ptau (already prepared)
snarkjs groth16 setup my_circuit.r1cs pot12_final.ptau my_circuit_0000.zkey

# Generate verification key
snarkjs zkey export verificationkey my_circuit_0000.zkey verification_key.json
```

**Note:** You already have `pot12_final.ptau` (4.7MB), so you don't need to download Powers of Tau again.

### 4. Test Circuit Locally

```bash
# Create test input
cat > input.json << 'EOF'
{
  "privateInput": 42,
  "publicInput": 10
}
EOF

# Generate witness
node my_circuit_js/generate_witness.js my_circuit_js/my_circuit.wasm input.json witness.wtns

# Generate proof
snarkjs groth16 prove my_circuit_0000.zkey witness.wtns proof.json public.json

# Verify proof
snarkjs groth16 verify verification_key.json public.json proof.json
# Should output: [INFO]  snarkJS: OK!
```

### 5. Copy to Extension

```bash
# Copy WASM and proving key to extension
cp my_circuit_js/my_circuit.wasm /Users/jmd/nosync/org.payattn.main/agent-dashboard/extension/circuits/my_circuit/
cp my_circuit_0000.zkey /Users/jmd/nosync/org.payattn.main/agent-dashboard/extension/circuits/my_circuit/

# Optional: Copy verification key for backend
cp verification_key.json /Users/jmd/nosync/org.payattn.main/agent-dashboard/extension/circuits/my_circuit/
```

### 6. Register Circuit in Extension

Edit `background.js` and add to `CIRCUITS_REGISTRY`:

```javascript
const CIRCUITS_REGISTRY = {
  age_range: {
    name: 'age_range',
    wasmPath: 'circuits/age_range/age_range.wasm',
    zKeyPath: 'circuits/age_range/age_range_0000.zkey',
    description: 'Proves user age is within specified range'
  },
  my_circuit: {
    name: 'my_circuit',
    wasmPath: 'circuits/my_circuit/my_circuit.wasm',
    zKeyPath: 'circuits/my_circuit/my_circuit_0000.zkey',
    description: 'Description of what this circuit proves'
  }
};
```

### 7. Test in Extension

```javascript
// In browser console (with extension loaded)
const proof = await chrome.runtime.sendMessage({
  type: 'GENERATE_PROOF',
  circuitName: 'my_circuit',
  privateInputs: { privateInput: 42 },
  publicInputs: { publicInput: 10 }
});

console.log('Proof:', proof);
```

## Utility Circuits to Create

Based on your earlier discussion, here are utility circuits you may need:

### 1. Range Check (Generic)

**Purpose:** Prove a value is within a range without revealing the value

```circom
pragma circom 2.0.0;

template RangeCheck() {
    signal input value;      // Private
    signal input min;        // Public
    signal input max;        // Public
    signal output valid;
    
    // value >= min
    signal minOk;
    minOk <-- (value >= min) ? 1 : 0;
    minOk * (value - min) === value - min;
    
    // value <= max
    signal maxOk;
    maxOk <-- (value <= max) ? 1 : 0;
    maxOk * (max - value) === max - value;
    
    valid <== minOk * maxOk;
}

component main {public [min, max]} = RangeCheck();
```

**Use Cases:**
- Age verification (already done)
- Income verification
- Credit score verification
- Any numeric range proof

### 2. Bit Comparison

**Purpose:** Compare two values without revealing them

```circom
pragma circom 2.0.0;

template BitComparison(n) {
    signal input a;
    signal input b;
    signal output greater;
    signal output equal;
    signal output less;
    
    // Convert to bits
    signal aBits[n];
    signal bBits[n];
    
    var tempA = a;
    var tempB = b;
    for (var i = 0; i < n; i++) {
        aBits[i] <-- tempA % 2;
        bBits[i] <-- tempB % 2;
        tempA = tempA \ 2;
        tempB = tempB \ 2;
    }
    
    // Compare bit by bit from MSB to LSB
    signal result;
    result <-- (a > b) ? 1 : ((a == b) ? 0 : -1);
    
    greater <== (result == 1) ? 1 : 0;
    equal <== (result == 0) ? 1 : 0;
    less <== (result == -1) ? 1 : 0;
}

component main = BitComparison(32);
```

### 3. Set Membership

**Purpose:** Prove a value is in a set without revealing which one

```circom
pragma circom 2.0.0;

template SetMembership(n) {
    signal input value;          // Private
    signal input set[n];         // Public
    signal output isMember;
    
    signal matches[n];
    signal partialSums[n+1];
    partialSums[0] <== 0;
    
    for (var i = 0; i < n; i++) {
        matches[i] <== (value == set[i]) ? 1 : 0;
        partialSums[i+1] <== partialSums[i] + matches[i];
    }
    
    // At least one match
    isMember <== partialSums[n];
}

component main {public [set]} = SetMembership(10);
```

**Use Cases:**
- Location verification (prove you're in allowed countries)
- Interest verification (prove you have one of the target interests)
- Category membership

### 4. Multi-Attribute Proof

**Purpose:** Prove multiple attributes simultaneously

```circom
pragma circom 2.0.0;

include "RangeCheck.circom";
include "SetMembership.circom";

template MultiAttribute() {
    // Age range
    signal input age;
    signal input minAge;
    signal input maxAge;
    
    // Location set
    signal input locationCode;
    signal input allowedLocations[5];
    
    // Income range
    signal input income;
    signal input minIncome;
    signal input maxIncome;
    
    signal output valid;
    
    // Check age
    component ageCheck = RangeCheck();
    ageCheck.value <== age;
    ageCheck.min <== minAge;
    ageCheck.max <== maxAge;
    
    // Check location
    component locationCheck = SetMembership(5);
    locationCheck.value <== locationCode;
    for (var i = 0; i < 5; i++) {
        locationCheck.set[i] <== allowedLocations[i];
    }
    
    // Check income
    component incomeCheck = RangeCheck();
    incomeCheck.value <== income;
    incomeCheck.min <== minIncome;
    incomeCheck.max <== maxIncome;
    
    // All must pass
    valid <== ageCheck.valid * locationCheck.isMember * incomeCheck.valid;
}

component main {public [minAge, maxAge, allowedLocations, minIncome, maxIncome]} = MultiAttribute();
```

## Powers of Tau Files

You have the following ceremony files:

| File | Size | Description |
|------|------|-------------|
| `powersOfTau28_hez_final_08.ptau` | 378 KB | Downloaded from Hermez ceremony |
| `pot12_0000.ptau` | 1.5 MB | Initial Phase 1 |
| `pot12_0001.ptau` | 1.5 MB | After contribution |
| `pot12_final.ptau` | 4.7 MB | **Use this one** - Ready for Phase 2 |

**Circuit Size Limits:**
- pot12 supports up to 2^12 = 4,096 constraints
- For larger circuits, use pot14 (16,384 constraints) or pot16 (65,536 constraints)

To download larger ceremony files:
```bash
# pot14 (16K constraints, ~6 MB)
curl -o powersOfTau28_hez_final_14.ptau https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau

# pot16 (65K constraints, ~23 MB)
curl -o powersOfTau28_hez_final_16.ptau https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_16.ptau
```

## Circuit Best Practices

### 1. Keep Circuits Small
- Each constraint adds computation time
- Target: < 1,000 constraints for fast proofs
- Current `age_range`: Very small (~10 constraints)

### 2. Separate Public and Private
- Make minimum public (just what needs verification)
- Keep sensitive data private
- Example: Age is private, min/max are public

### 3. Test Thoroughly
```bash
# Test valid case
echo '{"age": 30, "minAge": 18, "maxAge": 65}' > test_valid.json
node age_range_js/generate_witness.js age_range_js/age_range.wasm test_valid.json witness.wtns
snarkjs groth16 prove age_range_0000.zkey witness.wtns proof.json public.json
snarkjs groth16 verify verification_key.json public.json proof.json

# Test invalid case (should fail witness generation)
echo '{"age": 16, "minAge": 18, "maxAge": 65}' > test_invalid.json
node age_range_js/generate_witness.js age_range_js/age_range.wasm test_invalid.json witness.wtns
# Should error or produce invalid proof
```

### 4. Version Control
```bash
cd /Users/jmd/nosync/is.jmd.zksnark
git init
git add *.circom
git commit -m "Add age_range circuit"
```

## Troubleshooting

### "Error: Cannot find module 'snarkjs'"
```bash
npm install -g snarkjs
```

### "circom: command not found"
```bash
# Install circom from source
cd circom
cargo build --release
cargo install --path circom
```

### "Scalar size does not match"
- Check that all inputs match circuit definition
- Ensure input.json has correct field names

### "Constraint doesn't match"
- Circuit logic error
- Review circom code for constraint violations
- Use `--inspect` flag to debug

## Integration Checklist

After creating a new circuit:

- [ ] Compile circuit to WASM
- [ ] Generate proving key with pot12_final.ptau
- [ ] Test locally with sample inputs
- [ ] Verify proof locally
- [ ] Copy WASM and zkey to extension `circuits/` folder
- [ ] Add to `CIRCUITS_REGISTRY` in background.js
- [ ] Update `web_accessible_resources` in manifest.json if needed
- [ ] Test in extension with `testServiceWorkerProof()`
- [ ] Document inputs/outputs
- [ ] Create backend verification endpoint
- [ ] Deploy verification key to backend

## Backend Verification

The backend needs the verification key to verify proofs:

```javascript
// Example backend code (Node.js)
const snarkjs = require('snarkjs');
const fs = require('fs');

async function verifyProof(proof, publicSignals) {
  const vKey = JSON.parse(fs.readFileSync('verification_key.json'));
  
  const verified = await snarkjs.groth16.verify(
    vKey,
    publicSignals,
    proof
  );
  
  return verified;
}
```

## Resources

- **Circom Documentation:** https://docs.circom.io/
- **snarkjs Documentation:** https://github.com/iden3/snarkjs
- **Powers of Tau:** https://storage.googleapis.com/zkevm/ptau/
- **Circom Examples:** https://github.com/iden3/circomlib

## Quick Reference Commands

```bash
# Full workflow for new circuit
cd /Users/jmd/nosync/is.jmd.zksnark

# 1. Compile
circom my_circuit.circom --r1cs --wasm --sym

# 2. Setup
snarkjs groth16 setup my_circuit.r1cs pot12_final.ptau my_circuit_0000.zkey
snarkjs zkey export verificationkey my_circuit_0000.zkey verification_key.json

# 3. Test
echo '{"input": "value"}' > input.json
node my_circuit_js/generate_witness.js my_circuit_js/my_circuit.wasm input.json witness.wtns
snarkjs groth16 prove my_circuit_0000.zkey witness.wtns proof.json public.json
snarkjs groth16 verify verification_key.json public.json proof.json

# 4. Deploy
cp my_circuit_js/my_circuit.wasm ../org.payattn.main/agent-dashboard/extension/circuits/my_circuit/
cp my_circuit_0000.zkey ../org.payattn.main/agent-dashboard/extension/circuits/my_circuit/
cp verification_key.json ../org.payattn.main/agent-dashboard/extension/circuits/my_circuit/
```

---

**Next Steps:**
1. Create `range_check.circom` for generic range proofs
2. Create `set_membership.circom` for location/interest verification
3. Test circuits locally
4. Integrate with extension
5. Deploy verification keys to backend
