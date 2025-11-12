# PayAttn

**Privacy-First Attention Verification Platform**

Pay Attention allows users to prove demographic attributes (age, preferences, etc.) to advertisers **without revealing the actual data**, using Zero-Knowledge Succinct Non-Interactive Arguments of Knowledge (ZK-SNARKs).

---

## 🎯 Quick Links

- **[📚 Documentation](/docs)** - Complete system documentation
- **[🏗️ Architecture](/docs/ARCHITECTURE.md)** - System overview and components
- **[🔐 ZK Proof Flow](/docs/ZK_PROOF_FLOW.md)** - How proofs work
- **[🚀 Backend Verification](/docs/BACKEND_VERIFICATION.md)** - Rapidsnark setup
- **[📡 API Reference](/docs/API.md)** - API endpoints
- **[🧪 Testing Guide](/docs/TESTING.md)** - Testing procedures

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Chrome (for extension development)
- macOS/Linux (for Rapidsnark compilation ...I used a docker container on MacOS)

### 1. Clone Repository
```bash
git clone https://github.com/payattn/payattn.git
cd payattn
```

### 2. Install Dependencies
```bash
cd backend
npm install
```

### 3. Set Up Rapidsnark (Backend Verification)
```bash
cd ../rapidsnark-server
# Follow instructions in rapidsnark-server/README.md
```

### 4. Start Development Server
```bash
cd ../backend
npm run dev
# Server runs at http://localhost:3000
```

### 5. Load Chrome Extension
1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `extension/` directory (at root level, NOT in backend)

---

## 📁 Project Structure

```
payattn/
├── docs/                          # 📚 Comprehensive documentation
│   ├── README.md                  # Documentation index
│   ├── ARCHITECTURE.md            # System architecture
│   ├── ZK_PROOF_FLOW.md          # ZK-SNARK proof lifecycle
│   ├── BACKEND_VERIFICATION.md    # Rapidsnark setup & usage
│   ├── API.md                     # API reference
│   └── TESTING.md                 # Testing guide
│
├── backend/                       # 🎨 Next.js backend + dashboard
│   ├── app/                       # Next.js 16 App Router
│   │   ├── api/                   # API routes
│   │   │   ├── verify-proof/     # POST /api/verify-proof
│   │   │   └── k/                 # GET/PUT /api/k/{hash}
│   │   ├── advertisers/           # Advertiser dashboard
│   │   └── dashboard/             # User dashboard
│   ├── lib/                       # Utilities
│   │   └── zk/                    # ZK verification logic
│   │       ├── verifier.ts        # Rapidsnark integration
│   │       └── circuits-registry.ts
│
├── extension/                     # 🔐 Chrome Extension (Max agent)
│   ├── manifest.json              # Manifest V3
│   ├── background.js              # Service worker
│   ├── content.js                 # Content script
│   ├── popup.html/js              # Extension popup
│   ├── crypto-utils.js            # ZK proof generation
│   ├── node_modules/              # Extension dependencies (separate)
│   └── circuits/                  # Circom circuits
│       ├── range_check.circom
│       ├── age_range.circom
│       └── set_membership.circom
│
├── solana/                        # 🔗 Solana smart contracts
│   └── payattn_escrow/           # Trustless escrow program
│       ├── programs/              # Anchor program
│       ├── tests/                 # Integration tests
│       └── schema.sql             # Database schema
│
├── rapidsnark-server/             # ⚡ C++ verification server
│   ├── rapidsnark/                # Compiled Rapidsnark binary
│   │   └── package_macos_arm64/
│   │       └── bin/verifier       # CLI verifier (426KB)
│   ├── keys/                      # Verification keys (JSON)
│   │   ├── range_check_verification_key.json
│   │   ├── age_range_verification_key.json
│   │   └── set_membership_verification_key.json
│   └── README.md                  # Rapidsnark setup guide
│
└── cf-worker/                     # ❌ ABANDONED (Cloudflare Worker)
    └── README.md                  # Why it failed
```

---

## 🔐 How It Works

### 1. User Privacy (Extension)
```
User enters age: 35
   ↓
[Stored in browser IndexedDB - NEVER sent to server]
   ↓
User clicks "Generate Proof"
   ↓
Extension generates ZK-SNARK proof (1-3 seconds)
   ↓
Proof: "Age is between 25 and 50" (but NOT the actual age!)
```

### 2. Backend Verification
```
Extension sends proof → Backend (Next.js)
   ↓
Backend validates format
   ↓
Rapidsnark C++ verifier executes (10-50ms)
   ↓
Result: VALID ✅ or INVALID ❌
   ↓
Backend returns result (does NOT learn actual age)
```

### 3. Privacy Guarantee
- ✅ User's age (35) **never leaves the browser**
- ✅ Backend only sees: "Someone proved their age is 25-50"
- ✅ Cryptographically impossible to extract actual age from proof
- ✅ No tracking, no cookies, no data harvesting

---

## 🛠️ Technology Stack

| Component | Technology |
|-----------|-----------|
| **Extension** | Chrome Manifest V3, snarkjs, IndexedDB |
| **Circuits** | Circom 2.0, Groth16 (BN128 curve) |
| **Backend** | Next.js 16, TypeScript, Node.js 18+ |
| **Verifier** | Rapidsnark (C++), ~10-50ms verification |
| **Wallet** | Solana Web3.js |
| **Storage** | IndexedDB (browser), Key-derivation (backend) |

---

## 📊 Current Status

✅ **Extension:** 3 circuits working, 1-3 second proof generation  
✅ **Backend:** Rapidsnark verification, 10-50ms per proof  
✅ **Privacy:** Zero user data leaves browser  
✅ **Performance:** Production-ready  

---

## 🧪 Testing

See [docs/TESTING.md](/docs/TESTING.md) for complete testing guide.

**Quick test:**
```bash
# 1. Generate proof in extension (age-proof-test.html)
# 2. Verify proof:
curl -X POST http://localhost:3000/api/verify-proof \
  -H "Content-Type: application/json" \
  -d @proof.json

# Expected: {"valid": true, "verificationTime": 47}
```

---

## 📖 Documentation

All documentation is in the [`/docs`](/docs) directory:

- **[README.md](/docs/README.md)** - Documentation index
- **[ARCHITECTURE.md](/docs/ARCHITECTURE.md)** - System architecture and data flow
- **[ZK_PROOF_FLOW.md](/docs/ZK_PROOF_FLOW.md)** - Complete ZK-SNARK lifecycle
- **[BACKEND_VERIFICATION.md](/docs/BACKEND_VERIFICATION.md)** - Rapidsnark implementation
- **[API.md](/docs/API.md)** - API endpoints and usage
- **[TESTING.md](/docs/TESTING.md)** - Testing procedures

---

## 🤝 Contributing

1. Read [docs/ARCHITECTURE.md](/docs/ARCHITECTURE.md) to understand the system
2. Check [docs/ZK_PROOF_FLOW.md](/docs/ZK_PROOF_FLOW.md) for ZK-SNARK details
3. Follow TypeScript/ESLint standards
4. Update documentation for any architectural changes

---

## 📝 License

TBD

---

## 🔗 Links

- **Documentation:** [/docs](/docs)
- **Extension:** [/extension](/extension)
- **Backend:** [/backend](/backend)
- **Rapidsnark:** [/rapidsnark-server](/rapidsnark-server)

---

**Built with privacy-first principles. Your data stays yours. Always.** 🔐
