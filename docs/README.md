# PayAttn Documentation

**Autonomous Agents for Privacy-Preserving Ad Negotiation**

This directory contains technical documentation for the PayAttn system - a platform where AI agents autonomously negotiate ad prices using zero-knowledge proofs for privacy.

---

## Getting Started

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Agent negotiation system and architecture
- **[API.md](./API.md)** - Backend API reference
- **[ZK_PROOF_FLOW.md](./ZK_PROOF_FLOW.md)** - Zero-knowledge proof system

---

## Core Documentation

### Autonomous Agent System
- **[prompt_max_tools.md](./prompt_max_tools.md)** - Max agent (user-side) prompt and capabilities
- **[LLM_PROVIDER_ABSTRACTION.md](./LLM_PROVIDER_ABSTRACTION.md)** - LLM integration for agents
- **[VENICE_AI_README.md](./VENICE_AI_README.md)** - Venice AI setup for Peggy agent
- **[VENICE_AI_QUICK_REFERENCE.md](./VENICE_AI_QUICK_REFERENCE.md)** - Venice AI quick reference

### Zero-Knowledge Privacy Layer
- **[ZK_PROOF_FLOW.md](./ZK_PROOF_FLOW.md)** - ZK-SNARK proof lifecycle enabling private negotiation
- **[BACKEND_VERIFICATION.md](./BACKEND_VERIFICATION.md)** - Rapidsnark verification implementation
- **[CIRCUIT_DEVELOPMENT_GUIDE.md](./CIRCUIT_DEVELOPMENT_GUIDE.md)** - Building privacy-preserving circuits
- **[SERVICE_WORKER_ZK_PROOF_GUIDE.md](./SERVICE_WORKER_ZK_PROOF_GUIDE.md)** - Service worker proof generation
- **[HASHING_SCHEME.md](./HASHING_SCHEME.md)** - String hashing for ZK circuits
- **[ZK-SNARK-QUICK-REFERENCE.md](./ZK-SNARK-QUICK-REFERENCE.md)** - Circuit usage and examples

### Blockchain Settlement
- **[solana_dev.md](./solana_dev.md)** - Solana escrow for automatic payment settlement and x402 protocol

### Authentication & Security
- **[AUTH_SECURITY.md](./AUTH_SECURITY.md)** - Authentication architecture
- **[WALLET_AUTH_README.md](./WALLET_AUTH_README.md)** - Wallet-based authentication
- **[ADVERTISER_WALLET_AUTH.md](./ADVERTISER_WALLET_AUTH.md)** - Advertiser authentication
- **[STORAGE_AUTH_README.md](./STORAGE_AUTH_README.md)** - Storage and encryption
- **[KDS_ARCHITECTURE.md](./KDS_ARCHITECTURE.md)** - Key derivation system
- **[KDS_AUTH_QUICKSTART.md](./KDS_AUTH_QUICKSTART.md)** - KDS quick start
- **[KDS_TESTING.md](./KDS_TESTING.md)** - KDS testing guide

### SDK & Integration
- **[SDK_ARCHITECTURE.md](./SDK_ARCHITECTURE.md)** - Publisher SDK architecture

### Testing
- **[TESTING.md](./TESTING.md)** - Testing procedures and guidelines
- **[END_TO_END_TEST_GUIDE.md](./END_TO_END_TEST_GUIDE.md)** - End-to-end testing

---

## Architecture Overview

| Component | Location | Purpose |
|-----------|----------|---------|
| **Max Agent** | `/extension/` | User-side autonomous agent, ZK proof generation |
| **Peggy Agent** | `/advertiser-agent/` | Advertiser-side autonomous agent, offer evaluation |
| **Backend** | `/backend/` | Next.js API server, proof verification, x402 protocol |
| **Smart Contract** | `/solana/payattn_escrow/` | Trustless escrow for automatic settlement |
| **Rapidsnark** | `/rapidsnark-server/` | C++ proof verification server |

---

## Quick Links by Role

### For New Developers
1. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Understand agent negotiation architecture
2. **[API.md](./API.md)** - Learn the API endpoints
3. **[prompt_max_tools.md](./prompt_max_tools.md)** - Learn how Max agent works

### For Agent Development
- **[prompt_max_tools.md](./prompt_max_tools.md)** - Max agent configuration
- **[VENICE_AI_README.md](./VENICE_AI_README.md)** - Peggy agent LLM setup
- **[LLM_PROVIDER_ABSTRACTION.md](./LLM_PROVIDER_ABSTRACTION.md)** - LLM integration

### For Privacy/ZK Development
- **[ZK_PROOF_FLOW.md](./ZK_PROOF_FLOW.md)** - How privacy layer works
- **[BACKEND_VERIFICATION.md](./BACKEND_VERIFICATION.md)** - Proof verification
- **[CIRCUIT_DEVELOPMENT_GUIDE.md](./CIRCUIT_DEVELOPMENT_GUIDE.md)** - Circuit development

### For Backend Development
- **[API.md](./API.md)** - API endpoints and usage
- **[solana_dev.md](./solana_dev.md)** - Blockchain integration and x402 protocol
- **[AUTH_SECURITY.md](./AUTH_SECURITY.md)** - Authentication

---

**Last Updated:** November 2025
