# PayAttn Documentation

**Privacy-First Attention Verification Platform**

This directory contains comprehensive documentation for the PayAttn system.

---

## 📚 Documentation Index

### Core Architecture
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System overview, components, and data flow
- **[ZK_PROOF_FLOW.md](./ZK_PROOF_FLOW.md)** - Complete ZK-SNARK proof lifecycle

### Implementation Guides
- **[BACKEND_VERIFICATION.md](./BACKEND_VERIFICATION.md)** - Rapidsnark verification setup and usage
- **[EXTENSION.md](./EXTENSION.md)** - Chrome extension architecture and circuits
- **[API.md](./API.md)** - Backend API endpoints and usage

### Operations
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment guide for production
- **[TESTING.md](./TESTING.md)** - Testing procedures and guidelines

---

## 🎯 Quick Start

1. **Understanding the System:** Start with [ARCHITECTURE.md](./ARCHITECTURE.md)
2. **ZK-SNARK Flow:** Read [ZK_PROOF_FLOW.md](./ZK_PROOF_FLOW.md)
3. **Backend Setup:** Follow [BACKEND_VERIFICATION.md](./BACKEND_VERIFICATION.md)
4. **Testing:** See [TESTING.md](./TESTING.md)

---

## 🔐 Core Principles

### Privacy-First Design
- **User data NEVER leaves the browser** - All private data (age, preferences) stays in extension
- **Zero-knowledge proofs only** - Backend receives mathematical proofs, not actual data
- **No tracking** - No cookies, no analytics, no user profiling

### Verification Architecture
```
User's Browser (Chrome Extension)
    ↓
    Private Data (age: 35)
    ↓
    ZK-SNARK Circuit (proves: "age is between 25-50")
    ↓
    Generates Proof (mathematical proof, ~1-3 seconds)
    ↓
Backend (Next.js)
    ↓
    Receives Proof (NOT the actual age)
    ↓
    Rapidsnark Verifier (C++ binary, ~10-50ms)
    ↓
    Result: VALID ✅ (knows "proof is valid" but NOT the actual age)
```

---

## 🏗️ System Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Extension** | Chrome Extension (V3) | User interface, proof generation |
| **Circuits** | Circom 2.0 + Groth16 | ZK-SNARK proof circuits |
| **Backend** | Next.js 16 + TypeScript | API server, proof verification |
| **Verifier** | Rapidsnark (C++) | Fast ZK-SNARK proof verification |
| **Wallet** | Solana Web3.js | User authentication |
| **Storage** | IndexedDB (browser) | Private data storage |

---

## 📖 Document Summaries

### ARCHITECTURE.md
Complete system overview including:
- Component relationships
- Data flow diagrams
- Privacy guarantees
- Technology stack details

### ZK_PROOF_FLOW.md
Detailed ZK-SNARK lifecycle:
- Proof generation in extension
- Circuit types and inputs
- Verification in backend
- Error handling and edge cases

### BACKEND_VERIFICATION.md
Rapidsnark implementation:
- Why we use Rapidsnark (vs Node.js snarkjs)
- Compilation and setup
- CLI integration via child_process
- Performance characteristics

### EXTENSION.md
Extension architecture:
- Manifest V3 structure
- Circuit implementation
- Service worker architecture
- Content scripts and popup

### API.md
Backend API reference:
- `/api/verify-proof` - Proof verification
- `/api/k/{hash}` - Key-derivation storage
- Authentication and security
- Request/response formats

### DEPLOYMENT.md
Production deployment:
- Environment configuration
- Rapidsnark compilation for Linux
- Docker setup (optional)
- Monitoring and maintenance

### TESTING.md
Testing procedures:
- End-to-end proof testing
- Circuit testing
- Backend verification testing
- Performance benchmarks

---

## 🚀 Current Status

✅ **Extension:** All 3 circuits working (1-3 second proof generation)
✅ **Backend:** Rapidsnark verification working (10-50ms verification)
✅ **Privacy:** Zero user data leaves browser
✅ **Performance:** Fast enough for production use

---

## 📝 Related Documentation

### In Project Root
- `/README.md` - Project overview and quick start
- `/BACKEND_VERIFICATION_COMPLETE.md` - Implementation summary
- `/RAPIDSNARK_TEST_GUIDE.md` - Testing guide

### Component-Specific
- `/agent-dashboard/README.md` - Backend/dashboard setup
- `/rapidsnark-server/README.md` - Rapidsnark server details
- `/cf-worker/README.md` - Cloudflare Worker (abandoned approach)

### Extension Documentation
- `/agent-dashboard/extension/CIRCUIT_DEVELOPMENT_GUIDE.md` - Circuit development
- Various markdown files in `/agent-dashboard/` directory

---

## 🤝 Contributing

When adding new features or making changes:
1. Update relevant documentation in `/docs`
2. Add architectural diagrams if needed
3. Document API changes in `API.md`
4. Update testing procedures in `TESTING.md`

---

## 📞 Support

For questions about:
- **Architecture/Design:** See `ARCHITECTURE.md`
- **ZK-SNARK Circuits:** See `ZK_PROOF_FLOW.md` and extension docs
- **Backend/Verification:** See `BACKEND_VERIFICATION.md`
- **Deployment:** See `DEPLOYMENT.md`

---

**Last Updated:** November 6, 2025
**Version:** 1.0 (Rapidsnark verification, 3 circuits live)
