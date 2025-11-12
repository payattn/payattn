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
- **Service Worker** (`background.js`): Autonomous background processing with Max agent
- **Max Agent** (`lib/max-assessor.js`): AI-powered ad evaluation logic
- **Venice AI Client** (`venice-ai.js`): Direct AI API calls (no PayAttn server intermediary)
- **LLM Service** (`llm-service.js`): Supports Venice AI and local LM Studio

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
 manifest.json           # Extension manifest
 popup.html             # Quick access UI
 profile.html           # Full profile editor
 settings.html          # API key configuration
 background.js          # Service worker with autonomous agent
 venice-ai.js           # Venice AI client
 llm-service.js         # LLM provider abstraction
 circuits/              # ZK-SNARK artifacts
    age_range/
    set_membership/
    range_check/
 lib/                   # Utility functions
    max-assessor.js     # Max's ad evaluation logic
    zk-prover.js        # ZK proof generation
    snarkjs-patched.js  # Patched snarkjs for service workers
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
- `POST /api/user/offer` - Submit ad viewing offers
- `GET /api/user/adstream` - Fetch available ads for Max
- `POST /api/advertiser/assess` - Peggy automated assessment
- `POST /api/advertiser/offers/{id}/accept` - Accept offer (x402 protocol)
- `POST /api/advertiser/payments/verify` - Verify escrow funding
- `POST /api/publisher/impressions` - Report impressions and trigger settlement
- `GET /api/k/{hash}` - Key-derivation storage (KDS)

**Code Structure:**
```
backend/
 app/
    api/               # API route handlers
       user/           # User agent (Max) endpoints
       advertiser/     # Advertiser agent (Peggy) endpoints
       publisher/      # Publisher endpoints
       k/              # Key-derivation storage
       verify-proof/   # ZK proof verification
    wallet-auth/       # Authentication pages
    dashboard/         # User dashboard
 lib/
    zk/                # ZK proof verification
    solana/            # Solana integration
       escrow-funder.ts    # Peggy's escrow funding logic
       settlement-service.ts  # Privacy-preserving settlement
    peggy-evaluator.ts  # Peggy's LLM evaluation logic
    extension-sync.ts   # Extension auth sync utilities
 db/                    # Database utilities
    schema.sql         # Database schema
 components/            # React components
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
- `LLMEvaluator` - Venice AI reasoning engine (`lib/peggy-evaluator.ts` in backend)
- `EscrowFunder` - Solana escrow funding (`lib/solana/escrow-funder.ts`)
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
- `settle_user` - Pay user (70%)
- `settle_publisher` - Pay publisher (25%)
- `settle_platform` - Pay platform fee (5%)
- `refund_escrow` - Return funds if ad not viewed (after 14 days)

**Key Features:**
- Funds locked until ad viewed (verified by impression report)
- Three-way split: 70% user, 25% publisher, 5% platform
- No trust required - math enforces rules
- Privacy-preserving: 3 separate unlinkable transactions
- 14-day expiry for refunds if ad not viewed
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

1. User profile data + targeting criteria  Circuit inputs
2. WASM witness calculator computes witness (~100-500ms)
3. Proving key + witness  Generate proof (~1-3 seconds)
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
- **Service Worker** (`background.js`): Autonomous background processing with Max agent

**2. Minimal Attack Surface**
- Service Worker uses patched snarkjs (singleThread mode)
- Imports: snarkjs-patched.js, llm-service.js, max-assessor.js
- ~1200 lines of code in background.js
- No DOM access, no user input processing

**3. Data Flow Isolation**
```
User Input → Main App → Encrypt → chrome.storage.local
                                      ↓
Service Worker (background) → Read encrypted data
     ↓
Decrypt locally → Process → Generate proofs → Submit offers
     ↓
Encrypt results → Write to chrome.storage.local
```

### Security Boundaries

```
┌─────────────────────────────────────────┐
│ Main App (payattn.org)                  │
│  Next.js, React, shadcn/ui          │
│  1000+ npm packages                  │
│  Complex UI logic                    │
│  Writes: ENCRYPTED data only         │
└──────────────────────────────────────────┘
          ↕ (encrypted blobs)
┌─────────────────────────────────────────┐
│    chrome.storage.local (extension)     │
└─────────────────────────────────────────┘
          ↕
┌─────────────────────────────────────────┐
│ Service Worker (background.js)           │
│  Patched snarkjs (singleThread)     │
│  LLMService + MaxAssessor modules    │
│  ~1200 lines of code                 │
│  Reads/Decrypts/Processes           │
└─────────────────────────────────────────┘
```

**Key Insight:** Service worker runs autonomously with Max's decision-making logic, using encrypted profile data fetched via Key-Derivation Storage (KDS) endpoint.

### Threat Model

**Protected Against:**
- Supply chain attacks in main app dependencies
- XSS in main application UI
- Compromised third-party scripts (analytics, UI libraries)
- Malicious browser extensions (origin-isolated storage)
- Physical device theft (data encrypted at rest with KDS)

**NOT Protected Against:**
- XSS in Service Worker itself (mitigated by code review)
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
1. Service worker wakes up (periodic alarm, every 30 minutes)
2. Reads keyHash from chrome.storage.local
3. Fetches encryption key from backend /api/k/{keyHash}
4. Decrypts profile data locally
5. Fetches available ads from /api/user/adstream
6. For each ad:
   a. MaxAssessor evaluates with LLMService (Venice AI or LM Studio)
   b. Generates ZK proof if match
   c. Creates offer via /api/user/offer
7. Encrypt and store results in chrome.storage.local
8. Update popup badge with earnings
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
1. User views ad (verified by impression report)
2. Publisher reports impression via /api/publisher/impressions
3. Settlement service calls settleWithPrivacy():
   a. settle_user → Pay user 70%
   b. (random delay 0-5 seconds)
   c. settle_publisher → Pay publisher 25%
   d. (random delay 0-5 seconds)
   e. settle_platform → Pay platform 5%
4. Each transaction appears independent on-chain
5. Transaction signatures stored in database
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
- Patched snarkjs for singleThread mode
- LLMService + MaxAssessor modules
- ~1200 lines of code in background.js
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

See [API.md](./API.md) for complete endpoint documentation.

### Key Endpoints

#### `POST /api/verify-proof`
Verify ZK-SNARK proofs.

**Request:**
```json
{
  "proof": {...},
  "publicSignals": [...],
  "campaignId": "optional-uuid"
}
```

**Response:**
```json
{
  "valid": true,
  "message": "Proof verified successfully"
}
```

#### `POST /api/user/offer`
Submit an ad viewing offer with ZK proof.

**Headers:** `x-user-id` (user wallet public key)

**Request:**
```json
{
  "ad_id": "uuid",
  "terms": {
    "price": 0.05,
    "placement": "sidebar"
  },
  "zk_proofs": {
    "set_membership": {...},
    "targeting": {...}
  }
}
```

**Response:**
```json
{
  "offer": {
    "id": "uuid",
    "status": "offer_made",
    "created_at": "2025-11-12T..."
  }
}
```

#### `POST /api/advertiser/assess`
Peggy automated assessment endpoint.

**Headers:** `x-advertiser-id` (advertiser wallet public key)

**Response:**
```json
{
  "assessed": [
    {
      "offer_id": "uuid",
      "decision": "accept",
      "reasoning": "...",
      "escrow_funded": true
    }
  ]
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

- [API Reference](./API.md) - Complete API endpoint documentation
- [Service Worker Implementation](./SERVICE_WORKER_IMPLEMENTATION.md) - Code walkthrough
- [Solana Development Guide](./solana_dev.md) - Smart contract details
- [Testing Guide](./TESTING.md) - How to test the system
- [Integration Guide](./INTEGRATION_GUIDE.md) - Publisher SDK integration

---

**Last Updated:** November 2025  
**Version:** 1.0  
**License:** MIT
