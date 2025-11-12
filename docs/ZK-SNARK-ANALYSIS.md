# ZK-SNARK Implementation Analysis & WP02 Developer Brief

**Date:** 5 November 2025  
**Status:** Analysis Complete - Ready for WP02 Implementation

---

##  Current State Analysis

### What You've Built 

Your test repo (`is.jmd.zksnark` at /Users/jmd/nosync/is.jmd.zksnark ) successfully demonstrates the complete ZK-SNARK workflow:

1. **Circuit Definition** (`age_range.circom`)
   - Proves a private `age` is within a range without revealing the age
   - Public inputs: `minAge`, `maxAge`
   - Private input: `age`
   - Output: `valid` (1 = age in range, 0 = not in range)

2. **Compilation Pipeline** ✅
   - Compiled circuit → `age_range.r1cs` (constraint system)
   - Compiled circuit → `age_range_js/` (JavaScript witness calculator with WebAssembly)
   - Generated proving key: `age_range_0000.zkey`
   - Generated verification key: `verification_key.json`
   - Powers of Tau setup complete: `pot12_final.ptau`

3. **Proof Generation Flow** ✅
   - Input: `input.json` (private: age=45, public: minAge=40, maxAge=60)
   - Witness generation: `generate_witness.js` → `witness.wtns`
   - Proof generation: Groth16 → `proof.json`
   - Proof verification: Against `verification_key.json` ✅

### File Inventory (is.jmd.zksnark)

| File | Size | Purpose |
|------|------|---------|
| `age_range.circom` | 507 B | **Source circuit** - The logic we prove |
| `age_range.r1cs` | 672 B | Rank-1 Constraint System (compiled circuit) |
| `age_range_js/` | 2+ MB | JavaScript witness calculator (WASM-based) |
| `age_range_0000.zkey` | ~4 MB | Proving key (secret material needed for proofs) |
| `pot12_final.ptau` | ~4.7 MB | Powers of Tau (public parameters, large!) |
| `verification_key.json` | 3.3 KB | **Verification key** (all you need on-chain) |
| `proof.json` | 803 B | Example proof |
| `public.json` | 22 B | Example public inputs |
| `circom/` | **~2+ GB** | Circom compiler source + build artifacts (Rust) |

---

## Key Insight: Reuse Strategy

**YES, absolutely reuse your test repo's infrastructure.** Here's why:

### Circuit Compilation is Heavy
- Circom compiler (Rust) = **2+ GB of build artifacts**
- You've already compiled once - no need to repeat
- Circuits don't change per-deployment - they're like smart contracts

### What You Need in the Project Repo
**Only the outputs**, not the compiler:
- `*.circom` source files (10-100 KB)
- `*.r1cs` compiled circuits (few KB)
- `*.zkey` proving keys (few MB)
- `verification_key.json` (few KB)
- `*_js/` witness calculators (few MB per circuit)
- `pot12_final.ptau` (can be shared across circuits)

### What Stays in Test Repo
- Circom compiler (`circom/` directory)
- Build artifacts and intermediate files
- Development/testing toolchain

---

##  Proposed Architecture

```
org.payattn.main/
├── agent-dashboard/
│   ├── public/
│   │   └── circuits/          ← NEW: Pre-compiled circuit artifacts
│   │       ├── age_range/
│   │       │   ├── age_range.wasm
│   │       │   ├── age_range_0000.zkey
│   │       │   └── verification_key.json
│   │       ├── income_range/
│   │       ├── location_match/
│   │       └── ...
│   ├── lib/
│   │   └── zk/                ← NEW: ZK utilities
│   │       ├── prover.js      (Generate proofs using WASM)
│   │       ├── verifier.js    (Verify proofs client-side)
│   │       └── witness.js     (Wrapper around witness calculator)
│   └── ...
└── zk-circuit-build/          ← NEW: Symlink or copy from test repo
    └── circuits/
        ├── age_range/
        ├── income_range/
        └── ...

is.jmd.zksnark/ (stays as-is - dev/build repo)
├── circom/                    (keep compiler here)
├── age_range.circom           (source files)
├── age_range_js/              (generated, used for copying)
└── ...
```

---

## Workflow (Development & Deployment)

### Phase 1: Development (is.jmd.zksnark)
1. Write/modify `.circom` circuits
2. Compile: `circom circuit.circom --r1cs --wasm --sym`
3. Generate witness: `node generate_witness.js`
4. Generate proof: Use snarkjs or similar
5. **Test & verify** locally

### Phase 2: Export to Project
1. Copy compiled outputs to `org.payattn.main/public/circuits/`
   - WASM files
   - `.zkey` files
   - `verification_key.json`
2. Copy to source control
3. Tests run against these artifacts

### Phase 3: Runtime (org.payattn.main)
- Load WASM witness calculator from `public/circuits/age_range/age_range.wasm`
- Generate witness for user's data
- Generate proof (browser or backend)
- Send proof to verification endpoint
- Verify on-chain or backend

---

## Circuits Needed for Campaigns

Based on your campaign matching requirements:

| Circuit | Purpose | Inputs | Notes |
|---------|---------|--------|-------|
| **age_range** | Prove age within bounds | private: age, public: min/max | ✅ Already built |
| **income_range** | Prove income within bounds | private: income, public: min/max | TODO |
| **location_match** | Prove location in whitelist | private: location_hash, public: allowed_hashes[] | TODO |
| **interest_match** | Prove interest in set | private: interest_hash, public: allowed_hashes[] | TODO |
| **score_threshold** | Prove user score > threshold | private: score, public: threshold | TODO |

---

## WP02 Developer Brief

### WP02.1: ZK Infrastructure Setup
**Goal:** Set up circuit artifact pipeline in main project repo

**Tasks:**
- [ ] Create `/public/circuits/` directory structure
- [ ] Export age_range circuit artifacts from test repo:
  - Copy `age_range_js/age_range.wasm` → `public/circuits/age_range/age_range.wasm`
  - Copy `age_range_0000.zkey` → `public/circuits/age_range/age_range_0000.zkey`
  - Copy `verification_key.json` → `public/circuits/age_range/verification_key.json`
- [ ] Create `.gitignore` for circuits (exclude large `.ptau` files, keep others)
- [ ] Document circuit artifact versions in `CIRCUITS-VERSION.md`

**Deliverable:** Project repo with working age_range circuit artifacts

---

### WP02.2: ZK Utility Library
**Goal:** Build JavaScript wrappers for ZK operations

**Create:** `lib/zk/` module with:

```typescript
// lib/zk/witness.js
export async function generateWitness(circuitName, inputs) {
  // Load WASM: public/circuits/{circuitName}/{circuitName}.wasm
  // Use witness calculator
  // Return witness buffer
}

// lib/zk/prover.js
export async function generateProof(circuitName, inputs) {
  // 1. Generate witness via witness.js
  // 2. Load proving key: public/circuits/{circuitName}/{circuitName}_0000.zkey
  // 3. Generate proof (browser-side or call backend)
  // Return: { proof, publicSignals }
}

// lib/zk/verifier.js
export async function verifyProof(circuitName, proof, publicSignals) {
  // Load verification key: public/circuits/{circuitName}/verification_key.json
  // Verify proof against public signals
  // Return: boolean
}

// lib/zk/index.js - export all
export * from './witness.js';
export * from './prover.js';
export * from './verifier.js';
```

**Deliverable:** Modular ZK API that abstracts snarkjs complexity

---

### WP02.3: Age Range Circuit Integration
**Goal:** Integrate first proof into campaign matching

**Tasks:**
- [ ] Create `lib/zk/circuits/ageRange.js`
  - Input: userAge (private), minAge, maxAge (public)
  - Generate proof user age is in range without revealing exact age
- [ ] Create `/pages/api/verify-age-proof.js`
  - Accept proof + public signals
  - Verify client didn't cheat
  - Return: { valid: boolean }
- [ ] Update Max agent evaluation to accept age proofs
  - If campaign has age requirement → ask for age range proof
  - Verify proof before evaluating match
- [ ] Test: Create campaign with age targeting 40-60, verify with proof

**Deliverable:** End-to-end: user generates age proof → verification succeeds

---

### WP02.4: Income & Demographics Circuits
**Goal:** Extend to income, location, interests

**In test repo (is.jmd.zksnark), create:**
- [ ] `income_range.circom` - Similar to age_range
- [ ] `location_hash.circom` - Prove location in whitelist (using Poseidon hash)
- [ ] `interest_set.circom` - Prove interest in allowed set

**Export artifacts** → `org.payattn.main/public/circuits/`

**In project repo:**
- [ ] Create `lib/zk/circuits/incomeRange.js`
- [ ] Create `lib/zk/circuits/locationMatch.js`
- [ ] Create `lib/zk/circuits/interestMatch.js`

**Deliverable:** Multiple circuits available for campaign targeting

---

### WP02.5: Privacy-First Campaign Matching
**Goal:** Full workflow using ZK for all sensitive attributes

**Update Max agent:**
- [ ] For each campaign requirement → request matching ZK proof
- [ ] Example:
  ```
  Campaign: Nike Golf (age 40-60, golf interest, UK, income >£75K)
  
  Max asks user for:
  1. Age range proof (40-60) ← WP02.3
  2. Interest membership proof (golf) ← WP02.4
  3. Location proof (UK) ← WP02.4
  4. Income proof (>£75K) ← WP02.4
  
  Result: Campaign evaluated WITHOUT seeing actual values
  ```

**Deliverable:** Campaign evaluation system that preserves user privacy

---

### WP02.6: Proof Caching & Optimization
**Goal:** Avoid regenerating proofs unnecessarily

**Implement:**
- [ ] Local proof cache (browser storage)
- [ ] Cache key: `{circuitName}_{publicSignals}` (public parts are cacheable!)
- [ ] TTL logic (cache for session or 24h)
- [ ] Clear cache on user data change

**Why?** If user's age hasn't changed, reuse the proof for multiple campaigns

**Deliverable:** Performance optimization, reduced computation

---

### WP02.7: Documentation & Testing
**Goal:** Enable other developers to work with ZK safely

**Create:**
- [ ] `ZK-SNARK-GUIDE.md` - How to add new circuits
  1. Write `.circom` in test repo
  2. Compile with circom
  3. Generate witness & proof
  4. Export artifacts
  5. Create JS wrapper in project
- [ ] `tests/zk/` - Unit tests for each circuit
  - Test witness generation
  - Test proof generation
  - Test proof verification
  - Test with valid/invalid inputs
- [ ] `docs/ZK-ARCHITECTURE.md` - Why we use ZK, how it works

**Deliverable:** Docs + test suite

---

## Implementation Order (Recommended)

1. **WP02.1** - Infrastructure (1-2 days)
   - Copy artifacts, set up directories, version tracking

2. **WP02.2** - Utility library (2-3 days)
   - Build JS wrappers, test with age_range circuit

3. **WP02.3** - Age integration (1-2 days)
   - End-to-end: user proof → campaign matching

4. **WP02.4** - More circuits (2-3 days)
   - Create circuits in test repo, export to project

5. **WP02.5** - Full privacy workflow (2-3 days)
   - Update Max agent to use all circuits

6. **WP02.6** - Caching (1 day)
   - Optimize proof reuse

7. **WP02.7** - Docs & tests (2-3 days)
   - Documentation, test coverage

**Total: ~10-15 days** for full implementation

---

##  Technical Gotchas

1. **WASM Loading:** Browser CORS might block loading `.wasm` from public/
   - Solution: Serve from same origin (Next.js `/public` does this)

2. **Witness Calculator:** Requires `BigInt` support
   - Solution: Modern browsers (2018+) and Node 16+

3. **Proof Size:** Groth16 proofs are ~250 bytes, verification key ~3KB
   - Fine for on-chain verification contracts

4. **Performance:** Proof generation is CPU-intensive
   - Age range: ~500ms on modern CPU
   - Complex circuits: 1-5 seconds
   - Solution: Web Workers or backend generation if needed

5. **Public Signals:** Must never contain private data
   - Good: `[1, minAge, maxAge]` (valid flag + public inputs)
   - Bad: `[1, age, ...]` (leaks private input)

---

## File Size Reference

For planning bandwidth/storage:

```
Artifacts per circuit (typical):
- WASM: 1-2 MB
- Proving key: 3-5 MB
- Verification key: 3-5 KB
- Total per circuit: ~5 MB

For 5 circuits (age, income, location, interest, score):
- Total: ~25 MB
- Deployable to CDN easily
```

---

## Checklist for Go/No-Go

Before starting WP02.1, verify:

- [ ] Test repo has successful proof generation (age_range example)
- [ ] Verification key can be exported and loaded in JS
- [ ] Witness calculator WASM works (test locally)
- [ ] Power of Tau parameters are accessible
- [ ] Project repo structure ready for `/public/circuits/`
- [ ] Team understands: proof generation ≠ verification (both needed)

---

## Key Takeaway

**You're NOT redoing setup costs.** Your test repo becomes the "build environment," and the main project consumes pre-built artifacts. This is exactly how real ZK projects work (e.g., Tornado Cash, Aztec, Aave Privacy Module).

The circuit definition and compilation happen once. Runtime is just loading WASM and computing witnesses/proofs with existing keys.

---

**Next Step:** Start WP02.1 by creating the artifact directory structure and copying age_range outputs. Then we validate the workflow end-to-end.
