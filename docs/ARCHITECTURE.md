# PayAttn System Architecture

**Privacy-First Attention Verification Platform**

---

## 🎯 System Overview

PayAttn is a privacy-preserving platform that allows users to prove demographic attributes (age, preferences, etc.) to advertisers **without revealing the actual data**. This is achieved using Zero-Knowledge Succinct Non-Interactive Arguments of Knowledge (ZK-SNARKs).

### Core Value Proposition

**For Users:**
- ✅ Prove you're in an age range without revealing your exact age
- ✅ All private data stays in your browser, never sent to servers
- ✅ Mathematical proof of attributes, not the attributes themselves
- ✅ No tracking, no cookies, no data harvesting

**For Advertisers:**
- ✅ Verify user demographics without accessing personal data
- ✅ GDPR/privacy compliant by design
- ✅ Cryptographic proof of user attributes
- ✅ Fraud-resistant verification

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Chrome Extension (Manifest V3)               │  │
│  │                                                            │  │
│  │  ┌──────────────┐    ┌─────────────────────────────┐    │  │
│  │  │  User Data   │    │   ZK-SNARK Circuits         │    │  │
│  │  │              │    │                              │    │  │
│  │  │  Age: 35     │───▶│  range_check.circom         │    │  │
│  │  │  Prefs: []   │    │  age_range.circom           │    │  │
│  │  │              │    │  set_membership.circom      │    │  │
│  │  └──────────────┘    └─────────────────────────────┘    │  │
│  │         │                         │                       │  │
│  │         │ NEVER SENT              │ Generates Proof       │  │
│  │         │ TO SERVER               │ (1-3 seconds)        │  │
│  │         │                         ▼                       │  │
│  │         │              ┌─────────────────┐               │  │
│  │         │              │  Proof Object   │               │  │
│  │         │              │  {pi_a, pi_b,   │               │  │
│  │         │              │   pi_c, ...}    │               │  │
│  │         │              └─────────────────┘               │  │
│  └──────────────────────────────│──────────────────────────┘  │
└────────────────────────────────│─────────────────────────────┘
                                  │
                                  │ HTTPS POST /api/verify-proof
                                  │ (proof only, NO user data)
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND SERVER (Next.js)                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    API Routes                             │  │
│  │                                                            │  │
│  │  POST /api/verify-proof                                   │  │
│  │    │                                                       │  │
│  │    └─▶ lib/zk/verifier.ts                                │  │
│  │           │                                                │  │
│  │           │ Writes temp files:                            │  │
│  │           │   - /tmp/proof.json                           │  │
│  │           │   - /tmp/public.json                          │  │
│  │           │                                                │  │
│  │           └─▶ Spawns Rapidsnark CLI                       │  │
│  └──────────────────────│──────────────────────────────────┘  │
└────────────────────────│─────────────────────────────────────┘
                          │
                          │ child_process.exec()
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              RAPIDSNARK VERIFIER (C++ Binary)                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Input:                                                    │  │
│  │    1. verification_key.json                               │  │
│  │    2. public.json (public signals)                        │  │
│  │    3. proof.json (proof to verify)                        │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────┐        │  │
│  │  │   Groth16 Verification Algorithm              │        │  │
│  │  │   (BN128 elliptic curve operations)           │        │  │
│  │  └──────────────────────────────────────────────┘        │  │
│  │                          │                                 │  │
│  │                          │ ~10-50ms                        │  │
│  │                          ▼                                 │  │
│  │  Output (stderr): "Result: Valid proof"                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                          │
                          │ Returns to backend
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND RESPONSE                             │
│  {                                                               │
│    "valid": true,                                               │
│    "circuitName": "range_check",                               │
│    "publicSignals": ["1", "25000", "50000"],                   │
│    "message": "Proof verified successfully",                   │
│    "verificationTime": 47                                      │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 System Components

### 1. Chrome Extension (`/agent-dashboard/extension/`)

**Purpose:** User interface and ZK-SNARK proof generation

**Key Files:**
- `manifest.json` - Extension configuration (Manifest V3)
- `background.js` - Service worker (event handling)
- `content.js` - Content script (page interaction)
- `popup.html/js` - Extension popup UI
- `crypto-utils.js` - ZK-SNARK proof generation
- `circuits/*.circom` - Circuit definitions

**Technology Stack:**
- Chrome Extension Manifest V3
- snarkjs (browser-patched version)
- IndexedDB for local storage
- Circom circuits (compiled to WASM)

**Privacy Guarantees:**
- All user data stored in IndexedDB (local only)
- Proofs generated entirely in browser
- No data sent to backend except proofs

### 2. ZK-SNARK Circuits (`/agent-dashboard/extension/circuits/`)

**Purpose:** Define what can be proven

**Available Circuits:**

| Circuit | Purpose | Inputs (Private) | Outputs (Public) |
|---------|---------|------------------|------------------|
| `range_check` | Prove value in range | `value`, `min`, `max` | `isValid` (1/0), `min`, `max` |
| `age_range` | Prove age in range | `age`, `minAge`, `maxAge` | `isValid` (1/0), `minAge`, `maxAge` |
| `set_membership` | Prove value in set | `value`, `set[5]` | `isValid` (1/0), `setHash` |

**Circuit Compilation:**
```bash
circom circuit.circom --r1cs --wasm --sym
snarkjs groth16 setup circuit.r1cs pot.ptau circuit_0000.zkey
snarkjs zkey contribute circuit_0000.zkey circuit_final.zkey
snarkjs zkey export verificationkey circuit_final.zkey verification_key.json
```

**Proof Generation (in browser):**
```javascript
const { proof, publicSignals } = await snarkjs.groth16.fullProve(
  { value: 35, min: 25, max: 50 },  // Private inputs
  wasmFile,
  zkeyFile
);
// Takes 1-3 seconds
```

### 3. Backend API (`/agent-dashboard/`)

**Purpose:** API server, proof verification, advertiser dashboard

**Key Routes:**

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/verify-proof` | POST | Verify ZK-SNARK proofs |
| `/api/k/{hash}` | GET | Key-derivation data storage |
| `/advertisers` | GET | Advertiser dashboard |
| `/dashboard` | GET | User dashboard |

**Technology Stack:**
- Next.js 16 (App Router)
- TypeScript
- Solana Web3.js (wallet authentication)
- Node.js child_process (Rapidsnark integration)

**Security:**
- Wallet-based authentication
- Request validation
- Rate limiting (planned)
- No user data storage (stateless verification)

### 4. Rapidsnark Verifier (`/rapidsnark-server/`)

**Purpose:** Fast, reliable ZK-SNARK proof verification

**Why Rapidsnark?**
- ❌ Node.js snarkjs: Hangs 8+ minutes on BN128 operations
- ❌ Cloudflare Workers: Incompatible with snarkjs (missing browser APIs)
- ✅ Rapidsnark: Native C++ with assembly optimizations, 10-50ms verification

**Architecture:**
```
rapidsnark-server/
├── rapidsnark/                    # Git clone (iden3/rapidsnark)
│   └── package_macos_arm64/
│       └── bin/verifier           # 426KB executable
├── keys/                          # Verification keys (JSON)
│   ├── range_check_verification_key.json
│   ├── age_range_verification_key.json
│   └── set_membership_verification_key.json
└── README.md
```

**Integration:**
```typescript
// Backend spawns CLI verifier
const { stderr } = await execAsync(
  `verifier vkey.json public.json proof.json`,
  { timeout: 5000 }
);
const isValid = stderr.includes('Valid proof');
```

---

## 🔄 Data Flow

### 1. User Proof Generation (Extension)

```
User Input (age: 35)
    ↓
IndexedDB Storage (encrypted, local only)
    ↓
Select Circuit (range_check: 25-50)
    ↓
Prepare Inputs { value: 35, min: 25, max: 50 }
    ↓
Load Circuit (WASM + zkey)
    ↓
Generate Witness (circuit evaluation)
    ↓
Generate Proof (Groth16, 1-3 seconds)
    ↓
Output:
  - proof: {pi_a, pi_b, pi_c, protocol, curve}
  - publicSignals: ["1", "25", "50"]  // isValid, min, max (NOT the age!)
```

**Privacy Note:** The age (35) is NEVER in the output. Only the range (25-50) and validity (1) are public.

### 2. Backend Verification Flow

```
Receive POST /api/verify-proof
    ↓
Extract { proof, publicSignals, circuitName }
    ↓
Validate Request (check circuit exists, format correct)
    ↓
Create Temp Directory /tmp/zk-verify-{timestamp}/
    ↓
Write Files:
  - proof.json
  - public.json
    ↓
Get Verification Key Path (keys/{circuitName}_verification_key.json)
    ↓
Spawn Rapidsnark CLI:
  verifier vkey.json public.json proof.json
    ↓
Wait for Response (timeout: 5 seconds)
    ↓
Parse stderr Output ("Valid proof" or "Invalid proof")
    ↓
Cleanup Temp Files
    ↓
Return Result { valid: true/false, verificationTime: 47ms }
```

### 3. Complete User Journey

```
1. User installs Chrome extension
      ↓
2. User enters age (35) in profile page
      ↓
      [Stored in IndexedDB, NEVER leaves browser]
      ↓
3. User visits advertiser's campaign (age requirement: 25-50)
      ↓
4. Extension detects requirement, prompts user
      ↓
5. User clicks "Generate Proof"
      ↓
      [Extension generates proof locally, 1-3 seconds]
      ↓
6. Extension sends proof to advertiser's backend
      ↓
      POST /api/verify-proof
      Body: {proof, publicSignals: ["1", "25", "50"], circuitName: "age_range"}
      ↓
7. Backend verifies proof (47ms)
      ↓
8. Backend returns: {"valid": true}
      ↓
9. Advertiser knows: "User is between 25-50" (but NOT the actual age)
      ↓
10. User sees ad / receives reward
```

---

## 🔐 Privacy Architecture

### What Backend NEVER Sees

- ❌ Actual age (e.g., 35)
- ❌ Exact demographic data
- ❌ User preferences
- ❌ Browsing history
- ❌ IP addresses (beyond standard HTTP)
- ❌ Any PII (Personally Identifiable Information)

### What Backend ONLY Sees

- ✅ Mathematical proof (cryptographic data)
- ✅ Public signals (e.g., "age is in range 25-50")
- ✅ Circuit name (e.g., "age_range")
- ✅ Verification result (valid/invalid)

### Privacy Guarantees (ZK-SNARK Properties)

1. **Zero-Knowledge:** Verifier learns nothing except "proof is valid"
2. **Soundness:** Cannot fake a proof for false statement
3. **Completeness:** Valid proofs always verify
4. **Non-Interactive:** No back-and-forth communication needed

### Threat Model

**What We Protect Against:**
- ✅ Data harvesting by advertisers
- ✅ Backend server compromise (no user data to steal)
- ✅ Man-in-the-middle attacks (proof reveals nothing)
- ✅ Database breaches (no user data stored)

**What We Don't Protect Against:**
- ⚠️ Browser extension malware (user must trust extension code)
- ⚠️ Compromised user device
- ⚠️ Side-channel attacks on proof timing (minimal risk)

---

## 🚀 Performance Characteristics

### Proof Generation (Extension)

| Circuit | Constraints | Proof Time | WASM Size | zkey Size |
|---------|-------------|------------|-----------|-----------|
| range_check | ~1,000 | 1-2 seconds | 50KB | 2MB |
| age_range | ~1,000 | 1-2 seconds | 50KB | 2MB |
| set_membership | ~5,000 | 2-3 seconds | 80KB | 5MB |

**Browser Performance:**
- Modern Chrome (V8): 1-3 seconds
- Memory usage: ~100MB during proof generation
- CPU: Single-threaded (main limitation)

### Proof Verification (Backend)

| Component | Time | Memory |
|-----------|------|--------|
| Temp file I/O | 10-20ms | Minimal |
| Rapidsnark execution | 10-50ms | ~50MB |
| **Total** | **30-100ms** | **<100MB** |

**Comparison:**
- ⚡ Rapidsnark (C++): 30-100ms
- 🐌 Node.js snarkjs: >8 minutes (HANGS)
- ❌ CF Workers: Doesn't work

---

## 🛠️ Technology Stack

### Frontend (Extension)
- **Runtime:** Chrome Extension Manifest V3
- **UI:** HTML5, CSS3, Vanilla JavaScript
- **Storage:** IndexedDB (encrypted)
- **Cryptography:** snarkjs (browser build), Circom WASM

### Backend (API)
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Runtime:** Node.js 18+
- **Authentication:** Solana Web3.js (wallet signatures)
- **Verification:** Rapidsnark (C++) via child_process

### ZK-SNARK Infrastructure
- **Circuit Language:** Circom 2.0
- **Proof System:** Groth16
- **Curve:** BN128 (bn254)
- **Prover:** snarkjs (browser) or Rapidsnark (server)
- **Verifier:** Rapidsnark (server only)

### Development Tools
- **Package Manager:** npm
- **Build:** Next.js turbopack
- **Linting:** ESLint
- **Testing:** Manual (automated tests planned)

---

## 📊 System Metrics

### Current Capacity
- **Proof Generation:** Limited by user's browser CPU
- **Verification Throughput:** ~100 proofs/second (single Rapidsnark instance)
- **Scalability:** Horizontal (spawn multiple verifier processes)

### Resource Requirements

**Extension:**
- Browser: Chrome 88+ (Manifest V3)
- Memory: ~100MB during proof generation
- Storage: ~10MB (circuits + user data)

**Backend:**
- CPU: 2+ cores recommended
- Memory: 512MB minimum, 2GB recommended
- Storage: ~50MB (Rapidsnark + verification keys)
- Network: <1KB per verification request

---

## 🔄 Deployment Architecture

### Development
```
localhost:3000 (Next.js dev server)
    ↓
Rapidsnark CLI (local binary)
    ↓
Extension (chrome://extensions)
```

### Production (Planned)
```
Load Balancer
    ↓
Next.js (Docker containers)
    ↓
Rapidsnark (sidecar or embedded)
    ↓
CDN (extension distribution)
```

---

## 🔍 Key Design Decisions

### Why Chrome Extension?
- ✅ Runs in user's browser (privacy)
- ✅ Can use Web Workers for proof generation
- ✅ Access to IndexedDB for local storage
- ✅ No server-side proof generation needed

### Why Rapidsnark?
- ✅ Production-proven (Polygon ID uses it)
- ✅ 100x faster than JavaScript implementations
- ✅ Native C++ with assembly optimizations
- ✅ Simple CLI interface

### Why Groth16 (not PLONK)?
- ✅ Smaller proof size (~200 bytes)
- ✅ Faster verification
- ✅ Better browser support
- ❌ Requires trusted setup (acceptable for our use case)

### Why Circom (not other languages)?
- ✅ Most mature ZK circuit language
- ✅ Large community and tooling
- ✅ Works well with snarkjs
- ✅ Good documentation

---

## 📈 Future Improvements

### Short-term
- [ ] Add automated testing
- [ ] Improve error handling
- [ ] Add rate limiting
- [ ] Batch verification support

### Medium-term
- [ ] More circuits for more sophisticated preferences
- [ ] Docker deployment
- [ ] Monitoring and alerting
- [ ] Performance optimization
- [ ] Additional 'connectors' for ad placement (in-world, multimodal etc)

### Long-term
- [ ] PLONK support (universal setup)
- [ ] Mobile app (React Native)
- [ ] Decentralized verification network
- [ ] Token incentives

---

## 🤝 Related Documents

- [ZK_PROOF_FLOW.md](./ZK_PROOF_FLOW.md) - Detailed proof lifecycle
- [BACKEND_VERIFICATION.md](./BACKEND_VERIFICATION.md) - Rapidsnark setup
- [API.md](./API.md) - API reference
- [EXTENSION.md](./EXTENSION.md) - Extension architecture

---

**Last Updated:** November 6, 2025  
**Status:** Production-ready (3 circuits, Rapidsnark verification working)
