# ZK-SNARK Circuits Architecture

**Last Updated:** November 5, 2025  
**Status:** Phase 1 - Age Range Circuit Complete ✅

---

## Overview

This document describes how ZK-SNARK circuit artifacts are organized, bundled, and used throughout the Pay Attention platform.

### Key Principle

Circuit artifacts are pre-compiled and never re-compiled at runtime. The compilation pipeline (expensive, ~2GB) lives in the test repo (`is.jmd.zksnark`). The main project repo only contains the outputs needed for proof generation and verification.

---

## File Organization

### Extension Circuits (In-Device Proof Generation)

**Location:** `extension/circuits/{circuit_name}/`

**Purpose:** Contains artifacts needed to generate ZK proofs on the user's device (browser/extension)

**Files per circuit:**
- `{circuit_name}.wasm` - WebAssembly witness calculator
  - Size: 10-50 KB per circuit
  - Execution: Fast (~100-500ms on modern CPU)
  - Status: **Include in version control** ✅
  
- `{circuit_name}.js` - JavaScript witness calculator wrapper (optional)
  - Size: ~10 KB
  - Execution: Calls WASM for computation
  - Status: **Include in version control** ✅

- `{circuit_name}_0000.zkey` - Proving key
  - Size: 3-5 MB per circuit
  - Security: Contains secret material, never expose
  - Status: **EXCLUDE from version control** (too large)
  - Deployment: Bundled with extension binary, not committed to Git
  
**Example structure:**
```
extension/circuits/
├── .gitignore          (excludes .zkey files)
├── age_range/
│   ├── age_range.wasm           (34 KB) ✅ in repo
│   ├── witness_calculator.js     (10 KB) ✅ in repo
│   ├── age_range_0000.zkey       (4.1 MB) ❌ not in repo
├── range_proof/        (planned WP02.4)
│   ├── range_proof.wasm
│   ├── witness_calculator.js
│   ├── range_proof_0000.zkey
└── set_membership/     (planned WP02.4)
    ├── set_membership.wasm
    ├── witness_calculator.js
    ├── set_membership_0000.zkey
```

### Backend Verification Keys

**Location:** `public/circuits/{circuit_name}/`

**Purpose:** Contains artifacts needed to verify ZK proofs on the backend/advertiser side

**Files per circuit:**
- `verification_key.json` - Verification key
  - Size: 3-5 KB per circuit (small!)
  - Security: Public - safe to expose
  - Status: **Include in version control** ✅
  - Usage: Backend verification endpoint loads these
  
**Example structure:**
```
public/circuits/
├── .gitignore          (allows verification_key.json in repo)
├── age_range/
│   └── verification_key.json     (3.2 KB) ✅ in repo
├── range_proof/        (planned WP02.4)
│   └── verification_key.json
└── set_membership/     (planned WP02.4)
    └── verification_key.json
```

---

## Artifact Sizes & Storage

### Current State (November 5, 2025)

| Circuit | WASM | Witness JS | Proving Key | Verification Key | **Total** |
|---------|------|------------|-----------|--------------------|-----------|
| age_range | 34 KB | 10 KB | 4.1 MB | 3.2 KB | ~4.1 MB |
| **Per-circuit average** | **30-50 KB** | **~10 KB** | **3-5 MB** | **3-5 KB** | **~5 MB** |

### Projected at Full Build (5 circuits)

| Component | Size | Notes |
|-----------|------|-------|
| Extension artifacts (5 circuits × 44 KB) | ~220 KB | In version control ✅ |
| Extension proving keys (5 circuits × 4 MB) | ~20 MB | **Bundled with extension, not in Git** |
| Backend verification keys (5 circuits × 4 KB) | ~20 KB | In version control ✅ |
| **Total in Git repo** | **~240 KB** | Easily manageable |
| **Total in extension bundle** | **~20 MB** | ~5-10% of typical extension size |

---

## Compilation Pipeline (Stays in Test Repo)

**Location:** `/Users/jmd/nosync/is.jmd.zksnark/`

**What's here (DO NOT copy to main repo):**
- `circom/` - Circom compiler source + build artifacts (~2+ GB) ⚠️
- `*.circom` - Circuit source files (reference, can copy if needed)
- `*.r1cs` - Compiled constraints (for development, not needed in browser)
- `*.ptau` - Powers of Tau parameters (very large, development only)
- `*.sym` - Symbol files (debugging, not needed in production)

**Workflow:**
1. Edit `.circom` file in test repo
2. Compile: `circom circuit.circom --r1cs --wasm --sym`
3. Generate trusted setup: `snarkjs setup ...`
4. **Copy outputs** → main repo `/extension/circuits/` and `/public/circuits/`
5. Commit to version control
6. Deploy with extension bundle

---

## Version Control Strategy

### `.gitignore` Configuration

**`extension/circuits/.gitignore`:**
```
# Exclude large proving keys
**/*.zkey
**/*.ptau
```

**`public/circuits/.gitignore`:**
```
# Verification keys ARE included
# Exclude only development artifacts
**/*.ptau
**/*.r1cs
**/*.sym
```

### What Goes in Git

✅ **Include (small, frequently needed):**
- `.wasm` files - Essential for browser proof generation
- `witness_calculator.js` - Calls WASM
- `verification_key.json` - Essential for backend verification

❌ **Exclude (large, rarely changed):**
- `.zkey` files - Need for proof generation, but bundled with extension binary
- `.ptau` files - Only for compilation, stays in test repo
- `.r1cs`, `.sym` - Development only

### Deployment Strategy

**For Hackathon MVP:**
- Bundle `.zkey` files directly with extension binary
- Compress with extension release
- No separate download needed

**Post-hackathon (recommended):**
- Host `.zkey` files on CDN with versioning
- Download on first extension install
- Cache locally in extension storage
- Reduces extension size, enables circuit updates without rebuilding

---

## Circuit Registry

Each circuit must register its metadata so the ZK library can find and use artifacts.

**File:** `lib/zk/circuits-registry.ts` (to be created)

```typescript
export interface CircuitRegistry {
  name: string;              // "age_range"
  type: 'range' | 'set' | 'custom';  // Circuit type
  wasmPath: string;          // "circuits/age_range/age_range.wasm"
  zKeyPath: string;          // "circuits/age_range/age_range_0000.zkey"
  verificationKeyPath: string; // "circuits/age_range/verification_key.json"
  inputSchema: {             // Describe inputs for validation
    private: Record<string, string>;    // e.g., { age: "number" }
    public: Record<string, string>;     // e.g., { minAge: "number", maxAge: "number" }
  };
  description: string;       // "Proves user's age is within range"
}

export const CIRCUITS: Record<string, CircuitRegistry> = {
  age_range: {
    name: 'age_range',
    type: 'range',
    wasmPath: '/circuits/age_range/age_range.wasm',
    zKeyPath: '/circuits/age_range/age_range_0000.zkey',
    verificationKeyPath: '/circuits/age_range/verification_key.json',
    inputSchema: {
      private: { age: 'number' },
      public: { minAge: 'number', maxAge: 'number' }
    },
    description: 'Proves user age is between minAge and maxAge without revealing exact age'
  },
  // range_proof, set_membership to be added in WP02.4
};
```

---

## Integration Points

### Extension (Client-Side)

1. **Proof Generation:**
   - Load WASM from `extension/circuits/{name}/{name}.wasm`
   - Load proving key from `extension/circuits/{name}/{name}_0000.zkey`
   - Generate witness using WASM
   - Create proof using snarkjs

2. **Local Verification (for debugging):**
   - Load verification key from bundled file
   - Verify proof matches public signals

### Backend (Server-Side)

1. **Proof Verification:**
   - Load verification key from `public/circuits/{name}/verification_key.json`
   - Verify proof from user request
   - Confirm public signals match expected criteria

### API Endpoint

**POST `/api/verify-proof`**
```typescript
{
  circuitName: string;      // "age_range"
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
  };
  publicSignals: string[];  // e.g., ["1", "40", "60"]
}
```

---

## Adding New Circuits (WP02.4+)

### Step 1: Develop in Test Repo
```bash
cd /Users/jmd/nosync/is.jmd.zksnark/
# Create new_circuit.circom
circom new_circuit.circom --r1cs --wasm --sym
# Generate setup (see ZK-SNARK-ANALYSIS.md)
```

### Step 2: Export Artifacts
```bash
# Copy to extension circuits
cp new_circuit_js/new_circuit.wasm \
  /path/to/org.payattn.main/agent-dashboard/extension/circuits/new_circuit/

cp new_circuit_0000.zkey \
  /path/to/org.payattn.main/agent-dashboard/extension/circuits/new_circuit/

# Copy to backend verification keys
cp verification_key.json \
  /path/to/org.payattn.main/agent-dashboard/public/circuits/new_circuit/
```

### Step 3: Register in Circuit Registry
Edit `lib/zk/circuits-registry.ts`:
```typescript
export const CIRCUITS: Record<string, CircuitRegistry> = {
  // ... existing circuits
  new_circuit: {
    name: 'new_circuit',
    type: 'custom',
    wasmPath: '/circuits/new_circuit/new_circuit.wasm',
    zKeyPath: '/circuits/new_circuit/new_circuit_0000.zkey',
    verificationKeyPath: '/circuits/new_circuit/verification_key.json',
    inputSchema: { /* ... */ },
    description: 'New circuit description'
  }
};
```

### Step 4: Commit to Version Control
```bash
git add extension/circuits/new_circuit/
git add public/circuits/new_circuit/
git add lib/zk/circuits-registry.ts
git commit -m "WP02.4: Add new_circuit circuit artifacts"
```

---

## Troubleshooting

### Issue: WASM File Not Loading in Browser

**Causes:**
- CORS blocking `.wasm` files
- Incorrect path in code
- File not deployed with extension

**Solutions:**
- Ensure Next.js serves from `/public/circuits/`
- Use correct relative/absolute paths
- Verify files copied to deployment directory
- Check browser DevTools Network tab

### Issue: Proof Generation Too Slow

**Causes:**
- Complex circuit (many constraints)
- Running on slow device
- No Web Worker parallelization

**Solutions:**
- Profile with browser DevTools
- Consider backend proof generation for complex circuits
- Use Web Workers for non-blocking UI
- Implement caching (see WP02.6)

### Issue: Verification Key Not Found

**Causes:**
- Wrong path to `verification_key.json`
- File not copied to backend
- Git accidentally excluded it

**Solutions:**
- Verify path in circuit registry
- Check `.gitignore` doesn't exclude `verification_key.json`
- Manually copy if missing
- Add to Git LFS if size becomes issue

---

## Checklist for WP02 Phases

### WP02.1 ✅ Complete
- [x] Create extension circuits directory structure
- [x] Create backend verification keys directory structure
- [x] Copy age_range artifacts from test repo
- [x] Create `.gitignore` files
- [x] Document file organization

### WP02.2 (Next)
- [ ] Create `lib/zk/` library module
- [ ] Create circuit registry
- [ ] Add snarkjs dependency
- [ ] Test with age_range circuit

### WP02.3 (Next)
- [ ] Build age proof UI component
- [ ] Create `/api/verify-proof` endpoint
- [ ] Create advertiser review interface
- [ ] End-to-end test

### WP02.4 (Future)
- [ ] Create `range_proof.circom` circuit
- [ ] Create `set_membership.circom` circuit
- [ ] Compile and export artifacts

### WP02.5+ (Future)
- [ ] Wire up generic circuits
- [ ] Update Max agent
- [ ] Add tests and docs

---

## References

- Test Repo: `/Users/jmd/nosync/is.jmd.zksnark/`
- Analysis Doc: `ZK-SNARK-ANALYSIS.md`
- Implementation Guide: `ZK-IMPLEMENTATION-GUIDE.md` (to be created)
- Circom Docs: https://docs.circom.io/
- snarkjs Docs: https://github.com/iden3/snarkjs
