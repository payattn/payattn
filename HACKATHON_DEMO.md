# PayAttn - Hackathon Demo Guide

**Privacy-First Attention Verification Platform using ZK-SNARKs**

---

## 🎯 The Problem

Current online advertising has two major issues:
1. **For Users:** Companies track your exact age, location, browsing history, and personal data
2. **For Advertisers:** GDPR and privacy regulations make it risky to collect user data

**Result:** Broken ecosystem where users lose privacy and advertisers face compliance nightmares.

---

## 💡 The Solution (30-Second Pitch)

PayAttn lets users **prove demographic attributes without revealing the actual data**.

**Example:**
- User proves "I'm between 25-50 years old" (ZK-SNARK proof)
- Advertiser verifies the proof mathematically in 10ms
- But the advertiser **never learns the actual age** (cryptographically impossible to extract)

**All user data stays in the browser. Always.**

---

## 🔬 How It Works (Technical Overview)

### 1. User Generates Zero-Knowledge Proof (Browser Extension)
```
User enters: Age = 35
   ↓
Extension generates ZK-SNARK proof: "Age is 25-50"
   ↓
Proof generation: 1-3 seconds (Groth16 circuit)
   ↓
Proof is cryptographic - actual age CANNOT be extracted
```

### 2. Backend Verifies Proof (10-50ms)
```
Backend receives proof (NOT the age)
   ↓
Rapidsnark C++ verifier validates proof
   ↓
Result: VALID ✅ or INVALID ❌
   ↓
Backend knows "user is 25-50" but NOT "user is 35"
```

### 3. AI Agent Evaluates Offer (Autonomous)
```
Advertiser's AI agent (Peggy) sees user proof
   ↓
LLM: "Does this user match our campaign?"
   ↓
If YES → Fund Solana escrow (HTTP 402 "Payment Required")
   ↓
User sees ad → Gets paid automatically
```

### 4. Trustless Settlement (Solana Blockchain)
```
Escrow locked on-chain (advertiser funds)
   ↓
User views ad → Publisher reports impression
   ↓
Backend splits payment: 70% user, 25% publisher, 5% platform
   ↓
All transactions verified on Solana Devnet
```

---

## 🏗️ System Architecture

```
┌─────────────────┐
│ Chrome Extension│  (User's browser - data NEVER leaves)
│   ↓             │
│ ZK-SNARK Proof  │  (1-3 seconds to generate)
└────────┬────────┘
         │
         │ HTTPS POST (proof only)
         ▼
┌─────────────────┐
│  Next.js Backend│  (Verifies proof)
│   ↓             │
│ Rapidsnark C++  │  (10-50ms verification)
└────────┬────────┘
         │
         │ HTTP 402 "Payment Required"
         ▼
┌─────────────────┐
│ Peggy AI Agent  │  (Evaluates offers with LLM)
│   ↓             │
│ Fund Escrow     │  (Locks payment on Solana)
└────────┬────────┘
         │
         │ On-chain transaction
         ▼
┌─────────────────┐
│ Solana Escrow   │  (Trustless settlement)
│   ↓             │
│ 3-way split     │  (70% user, 25% pub, 5% platform)
└─────────────────┘
```

---

## 🔥 Key Technical Highlights

### 1. **Real ZK-SNARKs (Not a Mock)**
- Circom circuits compiled to WASM
- Groth16 proving system (BN128 curve)
- Trusted setup using Powers of Tau
- 1-3 second proof generation in browser

### 2. **Production-Grade Verification**
- Rapidsnark C++ verifier (426KB binary)
- 10-50ms verification time
- Supports age_range, set_membership, range_check circuits

### 3. **x402 "Payment Required" Protocol**
- Novel HTTP status code usage
- Coordinates blockchain payments with HTTP APIs
- Headers specify: chain, network, escrow PDA, amount

### 4. **Autonomous AI Agent**
- LLM evaluates offers automatically
- Polls backend every 30 seconds
- Makes funding decisions based on campaign criteria
- Interacts with Solana blockchain directly

### 5. **Privacy-Preserving Architecture**
- Zero user data leaves browser
- Backend never sees age/interests
- 3-transaction settlement prevents linking user to advertiser
- All proofs are non-interactive (no rounds of communication)

---

## 📊 Performance Metrics

| Metric | Value |
|--------|-------|
| **Proof Generation** | 1-3 seconds |
| **Proof Verification** | 10-50ms |
| **Verifier Binary Size** | 426KB |
| **Blockchain Settlement** | 3 transactions |
| **Privacy Guarantee** | Cryptographic (ZK-SNARK) |

---

## 🎬 Video Demo

Demonstrates:
1. User profile setup (browser extension)
2. ZK proof generation and verification
3. AI agent (Peggy) evaluating offers
4. Solana escrow funding and settlement
5. End-to-end privacy preservation

---

## 🧪 Try It Yourself

### Quick Start (5 Minutes)
```bash
# 1. Clone and setup
git clone https://github.com/payattn/payattn.git
cd payattn
./setup.sh

# 2. Configure environment
cp backend/.env.example backend/.env.local
# Edit backend/.env.local with your credentials

# 3. Start backend
cd backend
npm run dev

# 4. Load extension
# Open chrome://extensions/ → Load unpacked → Select extension/
```

### Test Data Available
- Pre-seeded advertisers, users, and offers
- Test campaigns with various targeting criteria
- Devnet Solana transactions (no real money)

---

## Highlights

### Innovation
- ✅ Real ZK-SNARKs
- ✅ Novel x402 protocol for blockchain coordination
- ✅ AI agent autonomously evaluating and funding offers
- ✅ Multi-chain architecture (browser → backend → Solana)

### Technical Dept
- ✅ Working Circom circuits with trusted setup
- ✅ C++ verifier integration (Rapidsnark)
- ✅ Solana smart contract with PDA-based escrow
- ✅ Chrome Manifest V3 extension with service workers
- ✅ TypeScript backend with Next.js 16

### Completeness
- ✅ Full end-to-end flow working
- ✅ Extension + Backend + Blockchain + AI agent
- ✅ Extensive documentation (168+ markdown files)
- ✅ Production-ready code quality

### Real-World Impact
- ✅ Solves actual GDPR/privacy problems
- ✅ Enables new advertising models
- ✅ Privacy-first by design (not bolted on)
- ✅ Cryptographic guarantees (not trust-based)

---

## 📖 Additional Resources

- **[Main README](README.md)** - Complete project documentation
- **[Architecture Guide](docs/ARCHITECTURE.md)** - System design details
- **[ZK Proof Flow](docs/ZK_PROOF_FLOW.md)** - How proofs work
- **[API Reference](docs/API.md)** - Backend API endpoints
- **[Testing Guide](docs/TESTING.md)** - How to test the system

---

## 💬 Questions?

**Common Questions:**

**Q: Is this production-ready?**  
A: The core ZK proof system is production-ready. The AI agent and settlement logic are hackathon prototypes that would need additional hardening for production.

**Q: Can the backend extract the user's real age from the proof?**  
A: No, it's cryptographically impossible. The proof only reveals "age is in range 25-50" without revealing the exact value.

**Q: Why Solana?**  
A: Low transaction fees (~$0.00025), fast finality (~400ms), and excellent support for escrow patterns via PDAs.

**Q: What about the trusted setup?**  
A: I used Powers of Tau ceremony artifacts. For production, I'd run a custom multi-party computation ceremony.

**Q: How do you prevent Sybil attacks?**  
A: User reputation scores based on historical behavior, verified on-chain. Low-rep users require higher proof thresholds.

---

**Built with privacy-first principles. Your data stays yours. Always.** 🔐
