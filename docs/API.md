# API Reference

**PayAttn Backend API Documentation**

This document reflects the actual implementation of all API endpoints in the system.

---

## Base URL

- **Development:** `http://localhost:3000`
- **Production:** TBD

---

## Authentication

Authentication varies by endpoint:

### User Endpoints
- **Header:** `x-user-id` (wallet public key from extension)
- **Used by:** `/api/user/adstream`, `/api/user/offer`

### Advertiser Endpoints
- **Header:** `x-advertiser-id` (advertiser wallet public key)
- **Used by:** `/api/advertiser/assess`, `/api/advertiser/sessions`, `/api/advertiser/profile`

### Key-Derivation Storage (KDS)
- **Headers:** 
  - `x-wallet` (Solana wallet address)
  - `x-auth-token` (base64-encoded wallet signature)
- **Used by:** `/api/k/{hash}`

### Unauthenticated Endpoints
- `/api/verify-proof` - Proof verification
- `/api/advertiser/offers/{id}/accept` - x402 protocol (TODO: add auth)
- `/api/publisher/*` - Publisher endpoints
- Dashboard pages - HTML pages

---

## Core Endpoints

### Zero-Knowledge Proof Verification

#### `POST /api/verify-proof`
Verifies ZK-SNARK proofs for set membership and targeting criteria.

**Authentication:** None (publicly accessible)

**Request Body:**
```json
{
  "proof": "...",
  "publicSignals": [...],
  "campaignId": "optional-uuid"
}
```

Or batch mode:
```json
{
  "proofs": [
    {
      "proof": "...",
      "publicSignals": [...],
      "metadata": {...}
    }
  ]
}
```

**Response:**
```json
{
  "valid": true,
  "message": "Proof verified successfully"
}
```

Or batch mode:
```json
{
  "results": [
    { "valid": true, "message": "..." },
    { "valid": false, "message": "..." }
  ]
}
```

**Implementation Notes:**
- Supports single proof or batch verification
- Validates campaign targeting requirements if `campaignId` provided
- Uses Rapidsnark verifier for cryptographic verification

---

#### `GET /api/verify-proof`
Health check for proof verification service.

**Response:**
```json
{
  "status": "Proof verification endpoint is operational"
}
```

---

### Key-Derivation Storage (KDS)

#### `GET /api/k/{hash}`
Retrieves encrypted key material for local storage.

**Authentication:** REQUIRED
- `x-wallet` - Solana wallet address
- `x-auth-token` - Base64-encoded signature of the hash

**Response:**
```json
{
  "keyMaterial": "encrypted-base64-string"
}
```

**Implementation Notes:**
- Signature verification using `nacl.sign.detached.verify()`
- Hash computed as `SHA-256(wallet || nonce || timestamp)`
- Returns 401 if signature invalid
- Returns 404 if key material not found

---

## User Agent (Max) Endpoints

These endpoints serve the browser extension's autonomous agent.

#### `POST /api/user/adstream`
Fetches available ads for Max to evaluate.

**Authentication:** REQUIRED
- `x-user-id` - User's wallet public key

**Request Body:**
```json
{
  "context": {
    "browsing_history": [...],
    "interests": [...]
  }
}
```

**Response:**
```json
{
  "ads": [
    {
      "id": "uuid",
      "title": "Ad Title",
      "description": "...",
      "targeting": {...},
      "budget_remaining": 1000.50,
      "advertiser": {...},
      "campaign": {...}
    }
  ]
}
```

**Implementation Notes:**
- Queries `ad_creative` table (or `test_ad_creative` if `DATABASE_MODE=test`)
- Filters ads with `budget_remaining > 0`
- Includes advertiser and campaign objects

---

#### `POST /api/user/offer`
Creates a new offer from Max to an advertiser.

**Authentication:** REQUIRED
- `x-user-id` - User's wallet public key

**Request Body:**
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
    "ad_id": "uuid",
    "user_id": "wallet-pubkey",
    "terms": {...},
    "zk_proofs": {...},
    "status": "offer_made",
    "created_at": "2025-11-12T..."
  }
}
```

**Implementation Notes:**
- Creates offer with `status='offer_made'`
- Stores ZK proofs for Peggy verification
- Triggers Peggy assessment workflow

---

## Advertiser Agent (Peggy) Endpoints

#### `POST /api/advertiser/assess`
Peggy evaluates pending offers for an advertiser.

**Authentication:** REQUIRED
- `x-advertiser-id` - Advertiser's wallet public key

**Request Body:**
```json
{
  "auto_accept": false
}
```

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

**Implementation Notes:**
- Queries offers with `status='offer_made'`
- Validates ZK proofs via `/api/verify-proof`
- Calls LLM evaluator with campaign context
- Funds escrow via `EscrowFunder` if accepted
- Submits funding to `/api/advertiser/payments/verify`
- Updates offer status to `accepted` or `rejected`

---

#### `POST /api/advertiser/offers/{id}/accept`
Accepts an offer and returns x402 payment protocol details.

**Authentication:** TODO (currently unauthenticated)

**Response (HTTP 402):**
```json
{
  "message": "Payment required",
  "offer": {...}
}
```

**Headers:**
```
X-Payment-Chain: solana-mainnet
X-Escrow-PDA: <base58-encoded-address>
X-Amount-Lamports: 50000000
X-Recipient: <publisher-wallet>
```

**Implementation Notes:**
- Returns HTTP 402 status code (Payment Required)
- Provides x402 protocol headers for blockchain settlement
- Escrow PDA derived from campaign and offer IDs

---

#### `POST /api/advertiser/payments/verify`
Verifies escrow funding for accepted offers.

**Authentication:** REQUIRED
- `x-advertiser-id` - Advertiser's wallet public key

**Request Body:**
```json
{
  "offer_id": "uuid",
  "transaction_signature": "base58-signature"
}
```

**Response:**
```json
{
  "verified": true,
  "escrow_balance": 50000000
}
```

---

#### `GET /api/advertiser/sessions`
Lists advertiser's active ad sessions.

**Authentication:** REQUIRED
- `x-advertiser-id` - Advertiser's wallet public key

**Response:**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "campaign_id": "uuid",
      "status": "active",
      "impressions": 1234,
      "budget_spent": 56.78
    }
  ]
}
```

---

#### `GET /api/advertiser/profile`
Retrieves advertiser profile information.

**Authentication:** REQUIRED
- `x-advertiser-id` - Advertiser's wallet public key

**Response:**
```json
{
  "advertiser": {
    "id": "uuid",
    "wallet": "...",
    "company_name": "...",
    "campaigns": [...]
  }
}
```

---

## Publisher Endpoints

#### `POST /api/publisher/impressions`
Reports an ad impression and triggers settlement.

**Authentication:** None (TODO: add publisher auth)

**Request Body:**
```json
{
  "offer_id": "uuid",
  "publisher_id": "uuid",
  "proof_of_display": {...}
}
```

**Response:**
```json
{
  "settled": true,
  "transactions": [
    "signature1",
    "signature2",
    "signature3"
  ]
}
```

**Implementation Notes:**
- Calls `settleWithPrivacy()` for privacy-preserving settlement
- Creates 3 separate unlinkable transactions:
  - 70% to user wallet
  - 25% to publisher wallet
  - 5% to platform wallet
- Each transaction appears independent on-chain

---

#### `PUT /api/publishers/{id}/wallet`
Updates publisher's Solana wallet address.

**Authentication:** None (TODO: add publisher auth)

**Request Body:**
```json
{
  "wallet_address": "base58-solana-address"
}
```

**Response:**
```json
{
  "success": true,
  "publisher_id": "uuid",
  "wallet": "..."
}
```

**Implementation Notes:**
- Validates Solana address format
- Updates `publisher_wallet` in database

---

#### `GET /api/publishers/{id}/wallet`
Retrieves publisher's wallet address.

**Authentication:** None (TODO: add publisher auth)

**Response:**
```json
{
  "publisher_id": "uuid",
  "wallet": "base58-address"
}
```

---

## Utility Endpoints

#### `GET /api/debug-env`
Returns environment variable configuration (dev only).

**Response:**
```json
{
  "NODE_ENV": "development",
  "DATABASE_MODE": "test",
  "VENICE_API_KEY": "present"
}
```

---

#### `POST /api/process-proof-queue`
Processes queued proof verification tasks.

**Authentication:** None (internal cron job)

**Response:**
```json
{
  "processed": 5,
  "failed": 0
}
```

---

#### `POST /api/test/reset`
Resets test database to initial state.

**Authentication:** None (test mode only)

**Response:**
```json
{
  "success": true,
  "message": "Test database reset"
}
```

---

## Admin Endpoints

#### Dashboard Pages
Unauthenticated HTML pages for advertiser/publisher management:

- `GET /api/admin/dashboard` - Main admin dashboard
- `GET /api/admin/campaigns` - Campaign management
- `GET /api/admin/publishers` - Publisher management

---

## Agent Negotiation Flow

The complete flow between Max (user agent) and Peggy (advertiser agent):

1. **Max Requests Ads**
   - `POST /api/user/adstream` with user context
   - Returns available ads

2. **Max Evaluates & Makes Offer**
   - Assesses ads against user preferences
   - Generates ZK proofs (set membership, targeting)
   - `POST /api/user/offer` with terms and proofs

3. **Peggy Discovers Offer**
   - `POST /api/advertiser/assess` polls for new offers
   - Retrieves offers with `status='offer_made'`

4. **Peggy Validates Proofs**
   - Calls `POST /api/verify-proof` with offer's ZK proofs
   - Validates targeting criteria match campaign

5. **Peggy Evaluates with LLM**
   - Sends offer + campaign context to Venice AI
   - Receives accept/reject decision with reasoning

6. **Peggy Funds Escrow** (if accepted)
   - Calls `EscrowFunder.fundEscrow()`
   - Submits transaction to Solana
   - `POST /api/advertiser/payments/verify` confirms funding

7. **x402 Protocol Activated**
   - `POST /api/advertiser/offers/{id}/accept` returns HTTP 402
   - Headers contain escrow PDA and payment details
   - Extension receives payment-required response

8. **Settlement on Impression**
   - User views ad, publisher reports impression
   - `POST /api/publisher/impressions` triggers settlement
   - `settleWithPrivacy()` creates 3 unlinkable transactions
   - 70% user, 25% publisher, 5% platform

---

## Error Responses

All endpoints follow consistent error format:

```json
{
  "error": "Error message",
  "details": "Additional context"
}
```

Common status codes:
- `400` - Bad request (invalid parameters)
- `401` - Unauthorized (missing/invalid auth)
- `402` - Payment required (x402 protocol)
- `404` - Not found
- `500` - Internal server error

---

## Database Modes

The system supports two database modes via `DATABASE_MODE` env var:

- `test` - Uses `test_*` tables for development
- `production` - Uses production tables

Affected endpoints:
- `/api/user/adstream` - queries `test_ad_creative` vs `ad_creative`
- `/api/user/offer` - writes to `test_offers` vs `offers`

---

## Notes

- All timestamps are ISO 8601 format
- All amounts are in lamports (1 SOL = 1,000,000,000 lamports)
- Wallet addresses are base58-encoded Solana public keys
- ZK proofs follow Circom/SnarkJS format
- Settlement uses privacy-preserving protocol (3 unlinkable txns)
