# ZK-SNARK Proof Flow

**Complete lifecycle of zero-knowledge proofs in PayAttn**

---

## 🎯 Overview

This document describes the complete flow of ZK-SNARK proofs in PayAttn, from user data entry through proof generation, transmission, and verification.

---

## 📊 Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 1: DATA ENTRY                          │
│                   (User's Browser Only)                         │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    User enters age: 35
                            │
                            ▼
            IndexedDB.put('userProfile', {age: 35})
                            │
                [Data NEVER leaves browser]
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│               PHASE 2: PROOF GENERATION                         │
│            (Extension, 1-3 seconds, all local)                  │
└─────────────────────────────────────────────────────────────────┘
                            │
      User visits advertiser campaign
    "Show me proof: age 25-50"
                            │
                            ▼
        Extension detects requirement
                            │
                            ▼
    User clicks "Generate Proof" button
                            │
                            ▼
    ┌────────────────────────────────────┐
    │ Load Circuit Components            │
    │ - circuit.wasm (50KB-80KB)        │
    │ - circuit_final.zkey (2MB-5MB)    │
    └────────────────────────────────────┘
                            │
                            ▼
    ┌────────────────────────────────────┐
    │ Prepare Circuit Inputs             │
    │                                    │
    │ Private inputs:                    │
    │   value: 35                        │
    │   min: 25                          │
    │   max: 50                          │
    │                                    │
    │ Public inputs:                     │
    │   (automatically derived)          │
    └────────────────────────────────────┘
                            │
                            ▼
    ┌────────────────────────────────────┐
    │ Generate Witness                   │
    │ (Evaluate circuit with inputs)     │
    │                                    │
    │ circuit(35, 25, 50) = {            │
    │   isValid: 1,                      │
    │   min: 25,                         │
    │   max: 50                          │
    │ }                                  │
    └────────────────────────────────────┘
                            │
                            ▼
    ┌────────────────────────────────────┐
    │ Generate Groth16 Proof             │
    │ (CPU-intensive, 1-3 seconds)       │
    │                                    │
    │ Uses:                              │
    │ - Witness                          │
    │ - Proving key (.zkey)              │
    │ - BN128 curve operations           │
    │                                    │
    │ Output:                            │
    │ - pi_a (2 field elements)          │
    │ - pi_b (6 field elements)          │
    │ - pi_c (2 field elements)          │
    └────────────────────────────────────┘
                            │
                            ▼
    ┌────────────────────────────────────┐
    │ Proof Object Created               │
    │ {                                  │
    │   proof: {                         │
    │     pi_a: [...],                   │
    │     pi_b: [...],                   │
    │     pi_c: [...],                   │
    │     protocol: "groth16",           │
    │     curve: "bn128"                 │
    │   },                               │
    │   publicSignals: ["1","25","50"]   │
    │ }                                  │
    │                                    │
    │ Note: Age (35) NOT included!       │
    └────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│               PHASE 3: TRANSMISSION                             │
│            (Extension → Backend, HTTPS)                         │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
    POST /api/verify-proof
    Content-Type: application/json
    
    {
      "circuitName": "range_check",
      "proof": { /* proof object */ },
      "publicSignals": ["1", "25", "50"],
      "timestamp": 1762429784939,
      "version": "1.0"
    }
                            │
        [Network transmission]
        [~1KB payload size]
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              PHASE 4: VERIFICATION                              │
│         (Backend + Rapidsnark, 30-100ms)                        │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
    ┌────────────────────────────────────┐
    │ Backend Receives Request           │
    │ POST /api/verify-proof             │
    └────────────────────────────────────┘
                            │
                            ▼
    ┌────────────────────────────────────┐
    │ Validate Request Format            │
    │ - Check circuitName exists         │
    │ - Validate proof structure         │
    │ - Validate publicSignals format    │
    └────────────────────────────────────┘
                            │
                            ▼
    ┌────────────────────────────────────┐
    │ Prepare Verification               │
    │                                    │
    │ 1. Create temp directory           │
    │    /tmp/zk-verify-1762429784939/   │
    │                                    │
    │ 2. Write proof.json                │
    │    {pi_a, pi_b, pi_c, ...}        │
    │                                    │
    │ 3. Write public.json               │
    │    ["1", "25", "50"]              │
    │                                    │
    │ 4. Get verification key path       │
    │    keys/range_check_vkey.json     │
    └────────────────────────────────────┘
                            │
                            ▼
    ┌────────────────────────────────────┐
    │ Spawn Rapidsnark Verifier          │
    │                                    │
    │ Command:                           │
    │ ./verifier \                       │
    │   vkey.json \                      │
    │   public.json \                    │
    │   proof.json                       │
    │                                    │
    │ Timeout: 5 seconds                 │
    └────────────────────────────────────┘
                            │
                            ▼
    ┌────────────────────────────────────┐
    │ Rapidsnark Execution               │
    │ (C++ binary, 10-50ms)              │
    │                                    │
    │ 1. Load verification key           │
    │ 2. Load proof + public signals     │
    │ 3. Verify pairing equations:       │
    │                                    │
    │    e(pi_a, pi_b) =                │
    │      e(alpha, beta) *              │
    │      e(pub, gamma) *               │
    │      e(pi_c, delta)                │
    │                                    │
    │ 4. Output to stderr:               │
    │    "Result: Valid proof"           │
    └────────────────────────────────────┘
                            │
                            ▼
    ┌────────────────────────────────────┐
    │ Parse Rapidsnark Output            │
    │                                    │
    │ const isValid = stderr.includes(   │
    │   'Valid proof'                    │
    │ );                                 │
    │                                    │
    │ isValid = true ✅                  │
    └────────────────────────────────────┘
                            │
                            ▼
    ┌────────────────────────────────────┐
    │ Cleanup Temp Files                 │
    │                                    │
    │ fs.rmSync(tempDir, {               │
    │   recursive: true,                 │
    │   force: true                      │
    │ });                                │
    └────────────────────────────────────┘
                            │
                            ▼
    ┌────────────────────────────────────┐
    │ Return Verification Result         │
    │                                    │
    │ HTTP 200 OK                        │
    │ {                                  │
    │   "valid": true,                   │
    │   "circuitName": "range_check",    │
    │   "publicSignals": ["1","25","50"],│
    │   "message": "Proof verified",     │
    │   "verificationTime": 47           │
    │ }                                  │
    └────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              PHASE 5: RESULT HANDLING                           │
│            (Extension receives result)                          │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
    Extension receives: {valid: true}
                            │
                            ▼
    Show success message to user
                            │
                            ▼
    Advertiser knows: "User age is 25-50"
    (but NOT the actual age: 35)
```

---

## 🔬 Circuit Details

### Circuit: `range_check.circom`

**Purpose:** Prove that a value is within a specified range

**Circuit Code:**
```circom
pragma circom 2.0.0;

template RangeCheck() {
    signal input value;      // Private: the actual value (e.g., 35)
    signal input min;        // Private: minimum (e.g., 25)
    signal input max;        // Private: maximum (e.g., 50)
    
    signal output isValid;   // Public: 1 if valid, 0 if not
    signal output outMin;    // Public: echo min for verification
    signal output outMax;    // Public: echo max for verification
    
    // Check: value >= min
    signal aboveMin;
    aboveMin <== value - min;
    
    // Check: value <= max
    signal belowMax;
    belowMax <== max - value;
    
    // Both must be non-negative (proven via range constraints)
    // ... additional constraints ...
    
    isValid <== 1;  // If we get here, all constraints passed
    outMin <== min;
    outMax <== max;
}

component main = RangeCheck();
```

**Inputs:**
- **Private:** `value`, `min`, `max` (never revealed)
- **Public:** None (derived from circuit outputs)

**Outputs (Public Signals):**
- `isValid`: 1 if value is in range, 0 otherwise
- `outMin`: The minimum value (for verification)
- `outMax`: The maximum value (for verification)

**Example:**
```javascript
// User wants to prove: "My age (35) is between 25 and 50"

// Circuit inputs (private)
{
  value: 35,  // SECRET - never revealed
  min: 25,
  max: 50
}

// Circuit outputs (public signals)
["1", "25", "50"]  // [isValid, outMin, outMax]

// Verifier learns: "Someone proved their value is between 25 and 50"
// Verifier does NOT learn: The actual value (35)
```

### Circuit: `age_range.circom`

**Purpose:** Optimized version of range_check specifically for age verification

**Differences from range_check:**
- Additional constraints for age-specific validation
- Optimized for common age ranges (18-65)
- Better error messages

**Usage identical to range_check**

### Circuit: `set_membership.circom`

**Purpose:** Prove a value is in a predefined set

**Circuit Code:**
```circom
pragma circom 2.0.0;

template SetMembership() {
    signal input value;           // Private: the value to check
    signal input set[5];          // Private: allowed values
    
    signal output isValid;        // Public: 1 if in set
    signal output setHash;        // Public: hash of set (for verification)
    
    // Check if value matches any element in set
    signal matches[5];
    for (var i = 0; i < 5; i++) {
        matches[i] <== (value == set[i]) ? 1 : 0;
    }
    
    // At least one match required
    signal sum;
    sum <== matches[0] + matches[1] + matches[2] + matches[3] + matches[4];
    isValid <== (sum > 0) ? 1 : 0;
    
    // Hash the set for verification
    // ... hashing logic ...
}

component main = SetMembership();
```

**Example:**
```javascript
// User wants to prove: "My preference is in allowed set"

// Circuit inputs (private)
{
  value: 3,                    // SECRET
  set: [1, 3, 5, 7, 9]        // SECRET
}

// Circuit outputs (public signals)
["1", "0x1234..."]  // [isValid, setHash]

// Verifier learns: "Someone's value is in the set with hash 0x1234..."
// Verifier does NOT learn: Which value, or what the set contains
```

---

## 🔒 Privacy Analysis

### What Each Party Knows

**User (Extension):**
- ✅ Own private data (age: 35)
- ✅ Proof requirements (25-50)
- ✅ Generated proof
- ✅ Verification result

**Backend/Advertiser:**
- ✅ Proof is valid or invalid
- ✅ Public signals (range: 25-50, isValid: 1)
- ✅ Circuit used (range_check)
- ❌ Actual age (35) - **NEVER revealed**
- ❌ Any other private data

**Network Observer (MITM):**
- ✅ Encrypted HTTPS traffic
- ✅ Request/response sizes (~1KB)
- ❌ Cannot decrypt without TLS keys
- ❌ Cannot fake proofs (cryptographically secure)

### Information Leakage Analysis

**What can be inferred:**
1. **Request timing:** ~30-100ms per verification
   - **Mitigation:** Constant-time verification (not implemented yet)
   
2. **Request size:** ~1KB JSON
   - **Mitigation:** Padding (not needed, minimal info leakage)
   
3. **Circuit name:** Reveals what type of proof
   - **Mitigation:** None needed (circuit type is not sensitive)

4. **Public signals:** Reveal the range being proven
   - **Mitigation:** None possible (necessary for verification)
   - **Note:** This is by design - advertisers need to know the range

**What CANNOT be inferred:**
- ❌ Actual private values (cryptographically impossible)
- ❌ Other user attributes
- ❌ User identity (unless combined with other data)
- ❌ Previous proofs (stateless verification)

---

## ⚡ Performance Analysis

### Proof Generation (Extension)

**Time Breakdown:**
```
Load circuit files:        100-200ms (cached after first load)
Prepare inputs:            <1ms
Generate witness:          50-100ms
Generate proof:            800-2500ms (depends on circuit size)
Format output:             <1ms
────────────────────────────────────
Total:                     1000-3000ms
```

**Optimization opportunities:**
- ✅ Circuit caching (implemented)
- ✅ Web Worker offloading (implemented)
- ⚠️ WASM optimization (potential 20% improvement)
- ⚠️ Multi-threading (blocked by snarkjs limitation)

### Proof Verification (Backend)

**Time Breakdown:**
```
Request validation:        <1ms
Create temp directory:     5-10ms
Write files (2x):          10-20ms
Spawn Rapidsnark:          5-10ms
Rapidsnark execution:      10-50ms
Parse output:              <1ms
Cleanup files:             5-10ms
────────────────────────────────────
Total:                     35-100ms
```

**Comparison to alternatives:**
- ⚡ Rapidsnark (C++): **35-100ms**
- 🐌 Node.js snarkjs: **>8 minutes** (HANGS)
- ❌ Cloudflare Workers: **Doesn't work**

---

## 🔧 Error Handling

### Extension Errors

**1. Circuit loading failure**
```javascript
Error: Failed to load circuit.wasm
Cause: File not found or corrupted
Fix: Reinstall extension
```

**2. Invalid inputs**
```javascript
Error: Input value out of range
Cause: age < 0 or age > 200
Fix: Validate inputs before proof generation
```

**3. Proof generation timeout**
```javascript
Error: Proof generation timed out
Cause: CPU too slow or circuit too large
Fix: Increase timeout or optimize circuit
```

### Backend Errors

**1. Missing verification key**
```javascript
Error: Verification key not found: range_check_verification_key.json
Cause: Key file missing or wrong circuit name
Fix: Check keys/ directory and circuit name
```

**2. Rapidsnark execution failure**
```javascript
Error: Verification failed: Command failed
Cause: Binary not executable or wrong architecture
Fix: Recompile Rapidsnark for target platform
```

**3. Invalid proof format**
```javascript
Error: Invalid proof structure
Cause: Malformed JSON or missing fields
Fix: Check extension proof generation code
```

### Verification Failures (Not Errors)

**Valid proof, but verification returns false:**
```javascript
Result: { valid: false }
Cause: Proof was for different inputs than claimed
Example: Proved age 35 is in range 18-25 (false statement)
```

This is **not an error** - it's the correct behavior when someone tries to prove a false statement.

---

## 🧪 Testing Scenarios

### Happy Path

```javascript
// 1. User enters age: 35
// 2. Campaign requires: 25-50
// 3. Generate proof (should succeed)
// 4. Verify proof (should return valid: true)

Input:  { value: 35, min: 25, max: 50 }
Output: { valid: true, publicSignals: ["1", "25", "50"] }
```

### Edge Cases

**1. Minimum boundary**
```javascript
Input:  { value: 25, min: 25, max: 50 }
Output: { valid: true, publicSignals: ["1", "25", "50"] }
```

**2. Maximum boundary**
```javascript
Input:  { value: 50, min: 25, max: 50 }
Output: { valid: true, publicSignals: ["1", "25", "50"] }
```

**3. Below minimum**
```javascript
Input:  { value: 24, min: 25, max: 50 }
Output: { valid: false }  // or circuit constraint fails
```

**4. Above maximum**
```javascript
Input:  { value: 51, min: 25, max: 50 }
Output: { valid: false }  // or circuit constraint fails
```

### Malicious Attempts

**1. Fake proof (random data)**
```javascript
{
  proof: { pi_a: ["123", "456", "1"], ... },  // Random numbers
  publicSignals: ["1", "25", "50"]
}
Result: { valid: false }  // Rapidsnark will detect
```

**2. Modified public signals**
```javascript
// User generates proof for 25-50
// But submits with modified signals claiming 18-30
{
  proof: { /* valid proof for 25-50 */ },
  publicSignals: ["1", "18", "30"]  // TAMPERED
}
Result: { valid: false }  // Public signals don't match proof
```

**3. Replay attack (reuse old proof)**
```javascript
// User generates proof once
// Tries to use same proof for different campaign
Result: ✅ Actually works - but that's OK!
       The proof is still valid for the same statement
       Advertisers can add nonces if needed
```

---

## 📝 Implementation Notes

### Extension Implementation

**File: `/agent-dashboard/extension/crypto-utils.js`**
```javascript
async function generateProof(circuitName, inputs) {
  // 1. Load circuit (cached)
  const { wasm, zkey } = await loadCircuit(circuitName);
  
  // 2. Generate proof
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    inputs,
    wasm,
    zkey
  );
  
  // 3. Return formatted proof
  return { proof, publicSignals };
}
```

### Backend Implementation

**File: `/agent-dashboard/lib/zk/verifier.ts`**
```typescript
export async function verifyProof(
  circuitName: string,
  proof: any,
  publicSignals: string[]
): Promise<VerificationResult> {
  // 1. Prepare temp files
  const tempDir = path.join(tmpdir(), `zk-verify-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  fs.writeFileSync(proofPath, JSON.stringify(proof));
  fs.writeFileSync(publicPath, JSON.stringify(publicSignals));
  
  // 2. Execute Rapidsnark
  const { stderr } = await execAsync(
    `"${RAPIDSNARK_VERIFIER}" "${vkeyPath}" "${publicPath}" "${proofPath}"`,
    { timeout: 5000 }
  );
  
  // 3. Parse result
  const isValid = stderr.includes('Valid proof');
  
  // 4. Cleanup
  fs.rmSync(tempDir, { recursive: true, force: true });
  
  return { valid: isValid, ... };
}
```

---

## 🔗 Related Documents

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System overview
- [BACKEND_VERIFICATION.md](./BACKEND_VERIFICATION.md) - Rapidsnark details
- [API.md](./API.md) - API reference
- [TESTING.md](./TESTING.md) - Testing guide

---

**Last Updated:** November 6, 2025  
**Status:** Production (3 circuits operational, verification working)
