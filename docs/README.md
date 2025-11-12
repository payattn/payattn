# PayAttn Documentation

**Privacy-First Attention Verification Platform with Trustless Escrow**

This directory contains all project documentation.

---

## Quick Navigation

### Core System
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System overview and components
- **[API.md](./API.md)** - Backend API reference
- **[solana_dev.md](./solana_dev.md)** - Solana escrow implementation guide

### Zero-Knowledge Proofs
- **[ZK_PROOF_FLOW.md](./ZK_PROOF_FLOW.md)** - ZK-SNARK proof lifecycle
- **[BACKEND_VERIFICATION.md](./BACKEND_VERIFICATION.md)** - Rapidsnark verification
- **[ZK-SNARK-ANALYSIS.md](./ZK-SNARK-ANALYSIS.md)** - Circuit analysis
- **[HASHING_SCHEME.md](./HASHING_SCHEME.md)** - Hashing implementation

### Implementation
- **[PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md)** - Project structure
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Implementation status
- **[BACKEND_INTEGRATION_COMPLETE.md](./BACKEND_INTEGRATION_COMPLETE.md)** - Backend progress
- **[TESTING.md](./TESTING.md)** - Testing procedures

### Extension
- **[CIRCUIT_DEVELOPMENT_GUIDE.md](./CIRCUIT_DEVELOPMENT_GUIDE.md)** - Circuit development
- **[SERVICE_WORKER_ARCHITECTURE.md](./SERVICE_WORKER_ARCHITECTURE.md)** - Service worker design
- **[EXTENSION_SETUP_FLOW.md](./EXTENSION_SETUP_FLOW.md)** - Setup flow

### Authentication & Security
- **[AUTH_SECURITY.md](./AUTH_SECURITY.md)** - Authentication security
- **[WALLET_AUTH_README.md](./WALLET_AUTH_README.md)** - Wallet authentication
- **[KDS_ARCHITECTURE.md](./KDS_ARCHITECTURE.md)** - Key derivation storage

### Cloudflare Worker
- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** - CF Worker deployment
- **[QUICK_START.md](./QUICK_START.md)** - CF Worker quick start

### Work Packages (Historical)
- **[WP01_2_3_4_IMPLEMENTATION.md](./WP01_2_3_4_IMPLEMENTATION.md)** - WP01 implementation
- **[WP02-PHASE1-COMPLETE.md](./WP02-PHASE1-COMPLETE.md)** - WP02 Phase 1
- **[WP02_3A_CHECKLIST.md](./WP02_3A_CHECKLIST.md)** - WP02.3A checklist

### Venice AI Integration
- **[VENICE_AI_README.md](./VENICE_AI_README.md)** - Venice AI overview
- **[VENICE_AI_SETUP.md](./VENICE_AI_SETUP.md)** - Setup guide
- **[VENICE_AI_INTEGRATION_SUMMARY.md](./VENICE_AI_INTEGRATION_SUMMARY.md)** - Integration summary

---

##  System Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Backend** | `/backend/` | Next.js API server, Solana escrow verification |
| **Extension** | `/extension/` | Chrome extension, ZK proof generation, Max agent |
| **Smart Contract** | `/solana/payattn_escrow/` | Solana escrow program |
| **CF Worker** | `/cf-worker/` | Cloudflare Worker (experimental) |
| **Rapidsnark** | `/rapidsnark-server/` | Fast ZK verification |

---

## Recent Updates

### Solana Integration (November 2025)
- Trustless escrow smart contract deployed
- HTTP 402 "Payment Required" x402 protocol implementation
- Backend escrow verification via RPC
- Privacy-preserving settlement (3 unlinked transactions)

### ZK-SNARK Proofs
- 3 circuits working (age_range, location_check, interest_check)
- Extension proof generation (1-3 seconds)
- Backend Rapidsnark verification (10-50ms)

---

## Key Documents

### For New Developers
1. Start with **[PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md)**
2. Read **[ARCHITECTURE.md](./ARCHITECTURE.md)** for system overview
3. See **[solana_dev.md](./solana_dev.md)** for escrow implementation

### For Backend Work
- **[API.md](./API.md)** - API endpoints
- **[BACKEND_VERIFICATION.md](./BACKEND_VERIFICATION.md)** - Proof verification
- **[KDS_ARCHITECTURE.md](./KDS_ARCHITECTURE.md)** - Key storage

### For Extension Work
- **[CIRCUIT_DEVELOPMENT_GUIDE.md](./CIRCUIT_DEVELOPMENT.md)** - Circuit development
- **[prompt_max.md](./prompt_max.md)** - Max agent prompt
- **[SERVICE_WORKER_ZK_PROOF_GUIDE.md](./SERVICE_WORKER_ZK_PROOF_GUIDE.md)** - Service worker proofs

---

**Last Updated:** November 8, 2025
**Version:** 2.0 (Solana escrow + ZK proofs)
