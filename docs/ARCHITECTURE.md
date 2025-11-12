# PayAttn System Architecture

**Privacy-First Attention Verification Platform**

**Last Updated:** November 2025  
**Status:** Production

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Components](#core-components)
   - [Chrome Extension](#chrome-extension)
   - [Backend (Next.js)](#backend-nextjs)
   - [Database (Supabase)](#database-supabase)
   - [Peggy AI Agent](#peggy-ai-agent)
   - [Solana Smart Contracts](#solana-smart-contracts)
3. [ZK-SNARK Circuits](#zk-snark-circuits)
4. [Service Worker Architecture](#service-worker-architecture)
5. [Data Flow](#data-flow)
6. [Security Model](#security-model)
7. [Deployment Architecture](#deployment-architecture)

---

## System Overview

PayAttn is a privacy-preserving platform that allows users to prove demographic attributes (age, preferences, etc.) to advertisers **without revealing the actual data**. This is achieved using Zero-Knowledge Succinct Non-Interactive Arguments of Knowledge (ZK-SNARKs).

### Core Value Proposition

**For Users:**
- Prove you're in an age range without revealing your exact age
- All private data stays in your browser, never sent to servers
- Mathematical proof of attributes, not the attributes themselves
- No tracking, no cookies, no data harvesting
- Get paid for viewing relevant ads

**For Advertisers:**
- Verify user demographics without accessing personal data
- GDPR/privacy compliant by design
- Cryptographic proof of user attributes
- Fraud-resistant verification
- AI-powered offer evaluation via Peggy agent

---

## Core Components

### Chrome Extension

**Purpose:** User-facing interface for profile management and automated ad matching

**Architecture:** Manifest V3 extension with:
- **Popup UI** (`popup.html`): Quick status and navigation
- **Profile Editor** (`profile.html`): Full-page demographic/interest editor
- **Service Worker** (`sw-agent.js`): Autonomous background processing
- **Venice AI Integration** (`venice-ai.js`): Direct AI API calls for ad evaluation

**Key Features:**
- Wallet authentication sync with website
- Encrypted profile storage (Chrome local storage)
- ZK proof generation in-browser
- Periodic ad matching (background)
- Zero server-side profile data

**Storage:**
- Profile data: Encrypted in `chrome.storage.local`
- API keys: Encrypted in browser storage
- Never sends unencrypted profile to any server

**Code Structure:**
```
extension/
├── manifest.json           # Extension manifest
├── popup.html             # Quick access UI
├── profile.html           # Full profile editor
├── settings.html          # API key configuration
├── sw-agent.js            # Background worker (minimal, isolated)
├── venice-ai.js           # AI evaluation (client-side)
├── circuits/              # ZK-SNARK artifacts
│   ├── age_range/
│   ├── set_membership/
│   └── range_check/
└── lib/                   # Utility functions
```

### Backend (Next.js)

**Purpose:** API endpoints, wallet authentication, ad delivery, and Peggy agent hosting

**URL:** `http://localhost:3000` (dev), `https://payattn.org` (prod)

**Tech Stack:** Next.js 16, React, TypeScript, Tailwind CSS, Solana wallet adapter

**Key Routes:**

**User-Facing:**
- `/wallet-auth` - Wallet connection and authentication
- `/dashboard` - Ad performance metrics
- `/` - Landing page

**API Endpoints:**
- `POST /api/verify-proof` - Verify ZK proofs
- `POST /api/offers/{id}/submit` - Submit ad impressions
- `GET /api/ads` - Fetch available ads
- `POST /api/extension-sync` - Sync extension auth
- `POST /api/advertiser/assess` - Peggy automated assessment
- `POST /api/advertiser/assess/single` - Peggy manual evaluation

**Code Structure:**
```
backend/
├── app/
│   ├── api/               # API route handlers
│   ├── wallet-auth/       # Authentication pages
│   └── dashboard/         # User dashboard
├── lib/
│   ├── zk/                # ZK proof verification
│   ├── peggy/             # Peggy AI agent
│   ├── solana-escrow.ts   # Solana integration
│   └── settlement-service.ts  # Payment processing
├── db/                    # Database utilities
└── components/            # React components
```

### Database (Supabase)

**Purpose:** Persistent storage for ads, offers, publishers, and transactions

**Key Tables:**

**Content:**
- `ad_creative` - Ad campaigns with targeting criteria
- `test_ad_creative` - Test ads for development

**Offers & Transactions:**
- `offers` - User ad viewing offers with ZK proofs
- `settlement_queue` - Payment processing queue

**Publishers & Advertisers:**
- `publishers` - Publisher profiles and wallet addresses
- `advertisers` - Advertiser accounts (wallet-based)

**Sessions:**
- `advertiser_sessions` - Peggy assessment sessions

**Schema Features:**
- Row Level Security (RLS) for privacy
- JSON columns for ZK proofs and metadata
- Timestamp tracking for all records
- Foreign key relationships

### Peggy AI Agent

**Purpose:** Automated advertiser agent that evaluates ad offers using AI

**Capabilities:**
- Evaluates user offers based on targeting criteria
- Validates ZK proofs cryptographically
- Makes accept/reject decisions with reasoning
- Funds Solana escrow for accepted offers
- Tracks assessment sessions

**Components:**
- `DatabaseClient` - Supabase integration
- `LLMEvaluator` - Venice AI reasoning engine
- `EscrowFunder` - Solana escrow funding
- `SessionManager` - Assessment tracking

**Trigger Modes:**
- Automated: Periodic assessment of pending offers
- Manual: Single-offer evaluation via UI

**Decision Process:**
1. Fetch pending offers with ad creative
2. Validate ZK proofs
3. Evaluate offer with LLM reasoning
4. Accept (fund escrow) or reject (with reasoning)
5. Update offer status in database
6. Track session statistics

### Solana Smart Contracts

**Purpose:** Trustless escrow for advertiser payments

**Program:** `payattn_escrow` (Anchor framework)

**Accounts:**
- `Escrow` - Holds advertiser funds
- Program Derived Address (PDA) - Deterministic escrow addresses

**Instructions:**
- `create_escrow` - Lock funds for an offer
- `settle_user` - Pay user for viewing ad
- `settle_publisher` - Pay publisher for hosting
- `settle_platform` - Pay platform fee

**Key Features:**
- Funds locked until ad viewed (verified by proof)
- Three-way split: user, publisher, platform
- No trust required - math enforces rules
- Transaction signatures stored for auditing

---

## ZK-SNARK Circuits

### Overview

Circuit artifacts are pre-compiled and never re-compiled at runtime. The compilation pipeline lives in the test repo. The main project only contains outputs needed for proof generation and verification.

### Circuit Types

**1. Age Range Circuit** (`age_range`)
- Proves user age falls within specified range
- Public inputs: min_age, max_age
- Private inputs: actual_age
- Proof: Age is within [min, max] without revealing exact age

**2. Set Membership Circuit** (`set_membership`)
- Proves value exists in predefined set
- Example: Interest in ["sports", "tech", "fashion"]
- Public inputs: allowed_values[]
- Private inputs: user_value

**3. Range Check Circuit** (`range_check`)
- General numeric range validation
- Used for income brackets, engagement scores
- Public inputs: lower_bound, upper_bound
- Private inputs: actual_value

### File Organization

**Extension Circuits** (`extension/circuits/{circuit_name}/`):
- `{circuit_name}.wasm` - WebAssembly witness calculator (10-50 KB, in repo)
- `witness_calculator.js` - JS wrapper (10 KB, in repo)
- `{circuit_name}_0000.zkey` - Proving key (3-5 MB, excluded from repo)

**Backend Verification** (`public/circuits/{circuit_name}/`):
- `verification_key.json` - Verification key (3-5 KB, in repo)

### Proof Generation Flow

1. User profile data + targeting criteria → Circuit inputs
2. WASM witness calculator computes witness (~100-500ms)
3. Proving key + witness → Generate proof (~1-3 seconds)
4. Proof + public signals sent to backend
5. Backend verifies with verification key (~10-50ms)

### Security Properties

- **Zero-Knowledge:** Proof reveals nothing about private inputs
- **Soundness:** Cannot generate valid proof for false statement
- **Succinctness:** Proof size ~200 bytes, verification time <50ms
- **Non-Interactive:** No back-and-forth required

---

## Service Worker Architecture

### Design Principles

**1. Separation of Concerns**
- **Main Application** (`payattn.org`): User interface, data entry, visualization
- **Service Worker** (`sw-agent.js`): Autonomous background processing

**2. Minimal Attack Surface**
- Service Worker has **ZERO npm dependencies**
- Only uses Web Crypto API (browser built-in)
- ~200 lines of auditable code
- No DOM access, no user input processing

**3. Data Flow Isolation**
```
User Input → Main App → Encrypt → localStorage
                                      ↓
Service Worker (background) ← Read encrypted data
     ↓
Decrypt locally → Process → Generate proofs → Submit offers
     ↓
Encrypt results → Write to localStorage
```

### Security Boundaries

```
┌─────────────────────────────────────────┐
│ Main App (payattn.org)                  │
│ ├── Next.js, React, shadcn/ui          │
│ ├── 1000+ npm packages                  │
│ ├── Complex UI logic                    │
│ └── Writes: ENCRYPTED data only         │
└─────────────────────────────────────────┘
         │ (encrypted blobs)
         ↓
    localStorage (origin: payattn.org)
         ↓
┌─────────────────────────────────────────┐
│ Service Worker (sw-agent.js)            │
│ ├── ZERO npm dependencies              │
│ ├── Only Web Crypto API                 │
│ ├── Only fetch API                      │
│ ├── ~200 lines of code                  │
│ └── Reads/Decrypts/Processes           │
└─────────────────────────────────────────┘
```

**Key Insight:** Even if main app is compromised, attacker must ALSO compromise the minimal SW code to access decrypted data autonomously.

### Threat Model

**Protected Against:**
- Supply chain attacks in main app dependencies
- XSS in main application UI
- Compromised third-party scripts (analytics, UI libraries)
- Malicious browser extensions (origin-isolated)
- Physical device theft (data encrypted at rest)

**NOT Protected Against:**
- XSS in Service Worker itself (mitigated by minimal code)
- OS-level compromise (out of scope)
- Compromised browser (out of scope)

---

## Data Flow

### User Authentication Flow

```
1. User visits /wallet-auth on website
2. Connects Solana wallet (Phantom, etc.)
3. Signs authentication message
4. Backend validates signature
5. Website syncs auth status to extension
6. Extension stores encrypted auth token
```

### Ad Matching Flow (Automated)

```
1. Service worker wakes up (periodic alarm)
2. Reads encrypted profile from chrome.storage.local
3. Decrypts profile with wallet-derived key
4. Fetches available ads from /api/ads
5. For each ad:
   a. Check targeting criteria
   b. Generate ZK proof if match
   c. Send proof to /api/offers/{id}/submit
6. Encrypt and store results
7. Update badge icon with earnings
```

### Offer Evaluation Flow (Peggy)

```
1. User submits offer with ZK proof
2. Offer stored in database (status: pending)
3. Peggy wakes up (periodic or manual trigger)
4. Fetches pending offers for advertiser
5. For each offer:
   a. Validate ZK proof cryptographically
   b. Fetch ad creative from database
   c. Send to Venice AI for reasoning
   d. AI returns accept/reject + reasoning
   e. If accept:
      - Create x402 payment request
      - Fund Solana escrow
      - Verify funding on-chain
      - Update offer status: accepted
   f. If reject:
      - Store reasoning
      - Update offer status: rejected
6. Save assessment session
7. Return results to advertiser
```

### Settlement Flow

```
1. User views ad (verified by ZK proof)
2. Offer marked as "viewed" in database
3. Settlement service detects completed offer
4. Calls Solana escrow smart contract:
   - settle_user → Pay user
   - settle_publisher → Pay publisher
   - settle_platform → Pay platform fee
5. Transaction signatures stored
6. Offer marked as "settled"
7. User sees payment in wallet
```

---

## Security Model

### Privacy Guarantees

**1. User Data Never Leaves Browser**
- Profile data encrypted at rest
- Only ZK proofs sent to server
- Proofs reveal no private information

**2. Venice AI Privacy**
- API calls go directly from extension to Venice AI
- No PayAttn servers in the middle
- User controls their own API key
- Venice AI privacy policy: no data retention

**3. Wallet-Based Authentication**
- No passwords, no email, no accounts
- Cryptographic signature proves ownership
- Session tokens encrypted with wallet-derived keys

### Attack Surface Minimization

**Service Worker:**
- Zero npm dependencies
- Only Web Crypto API + fetch
- ~200 lines of auditable code
- No DOM access, no eval(), no dynamic code

**Extension:**
- Manifest V3 (strictest security model)
- Content Security Policy enforced
- No inline scripts
- Host permissions minimized

**Backend:**
- ZK proof verification only
- Never sees user profile data
- Row Level Security on database
- API rate limiting

### Cryptographic Foundations

**ZK-SNARKs (Groth16):**
- BN128 elliptic curve
- Trusted setup (Powers of Tau ceremony)
- Soundness: 2^-128 probability of fake proof
- Verification: ~10-50ms per proof

**Solana Smart Contracts:**
- Anchor framework (Rust)
- Program Derived Addresses for determinism
- No custody - math enforces rules
- Open source and auditable

---

## Deployment Architecture

### Production Components

**Frontend (Vercel):**
- Next.js 16 app
- CDN-cached static assets
- Edge middleware for routing

**Database (Supabase):**
- Postgres with extensions
- Row Level Security
- Realtime subscriptions
- Automatic backups

**Blockchain (Solana):**
- Devnet: Testing
- Mainnet: Production
- RPC endpoints via Helius/QuickNode

**AI (Venice AI):**
- Client-side API calls
- User-provided API keys
- Privacy-first provider

### Monitoring & Logging

**Backend:**
- Server logs for API requests
- ZK proof verification metrics
- Peggy assessment sessions

**Blockchain:**
- Transaction signatures stored
- On-chain verification of settlements
- Escrow balance monitoring

**Extension:**
- Local error logs only
- No telemetry sent to servers
- User consent for diagnostics

---

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm or npm
- Chrome browser
- Solana CLI (for smart contracts)
- Anchor framework (for smart contracts)

### Quick Start

1. **Clone repository**
   ```bash
   git clone https://github.com/payattn/payattn.git
   cd payattn
   ```

2. **Backend setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env.local
   # Configure Supabase URL and keys
   npm run dev
   ```

3. **Extension setup**
   ```bash
   cd extension
   # Load unpacked extension in Chrome
   # Go to chrome://extensions/
   # Enable Developer Mode
   # Click "Load unpacked" and select extension folder
   ```

4. **Smart contracts setup**
   ```bash
   cd solana/payattn_escrow
   anchor build
   anchor deploy
   ```

### Testing

**Backend:**
```bash
cd backend
npm test
```

**Extension:**
- Use `extension/venice-test.html` for Venice AI testing
- Use Chrome DevTools for debugging

**Smart Contracts:**
```bash
cd solana/payattn_escrow
anchor test
```

---

## API Reference

### POST /api/verify-proof

Verify a ZK-SNARK proof.

**Request:**
```json
{
  "circuitName": "age_range",
  "proof": { "pi_a": [...], "pi_b": [...], "pi_c": [...] },
  "publicSignals": ["18", "35"]
}
```

**Response:**
```json
{
  "valid": true,
  "circuitName": "age_range",
  "verificationTime": 42
}
```

### POST /api/offers/{id}/submit

Submit an ad viewing offer with ZK proof.

**Request:**
```json
{
  "offerId": "uuid",
  "zkProofs": [
    {
      "circuitName": "age_range",
      "proof": {...},
      "publicSignals": [...]
    }
  ],
  "userWallet": "solana_address"
}
```

**Response:**
```json
{
  "success": true,
  "offerId": "uuid",
  "status": "pending"
}
```

### POST /api/advertiser/assess

Peggy automated assessment endpoint.

**Headers:**
- `x-advertiser-id`: Advertiser wallet address

**Response:**
```json
{
  "sessionId": "uuid",
  "advertiserId": "wallet_address",
  "results": [
    {
      "offerId": "uuid",
      "decision": "accept",
      "reasoning": "...",
      "confidence": 0.85,
      "funded": {
        "success": true,
        "txSignature": "..."
      }
    }
  ],
  "stats": {
    "totalOffers": 5,
    "accepted": 3,
    "rejected": 2,
    "funded": 3
  }
}
```

---

## Glossary

**ZK-SNARK:** Zero-Knowledge Succinct Non-Interactive Argument of Knowledge - cryptographic proof system

**Groth16:** Specific ZK-SNARK construction used by PayAttn

**Witness:** Private inputs to a ZK circuit

**Public Signals:** Public outputs/inputs to a ZK circuit

**Proving Key:** Secret key used to generate proofs (never shared)

**Verification Key:** Public key used to verify proofs

**PDA:** Program Derived Address - deterministic Solana account address

**Escrow:** Smart contract holding funds until conditions met

**Peggy:** AI agent that evaluates ad offers for advertisers

**Venice AI:** Privacy-first AI provider used by Max and Peggy

---

## Further Reading

- [ZK-SNARK Analysis](./ZK-SNARK-ANALYSIS.md) - Deep dive into circuit design
- [Service Worker Implementation](./SERVICE_WORKER_IMPLEMENTATION.md) - Code walkthrough
- [Solana Development Guide](./solana_dev.md) - Smart contract details
- [Testing Guide](./TESTING.md) - How to test the system
- [Integration Guide](./INTEGRATION_GUIDE.md) - Publisher SDK integration

---

**Last Updated:** November 2025  
**Version:** 1.0  
**License:** MIT
