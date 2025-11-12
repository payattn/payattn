# Peggy Manual Trigger - Clarified Requirements

**Date:** November 10, 2025  
**Status:** Requirements Confirmed - Ready to Build

---

## Confirmed Understanding

### Architecture Decision: Web UI (Not CLI)
**Location:** `/backend/app/advertisers/offer-queue/page.tsx` (Next.js page)

**Approach:** Clone `extension/ad-queue.html` → Convert to Next.js React component

---

## Offer Status Flow (CRITICAL)

### Status Lifecycle
```
1. User (Max) creates offer
   └─> Status: 'offer_made'
   └─> Stored in: offers table

2. Peggy evaluates & accepts offer
   └─> POST /api/advertiser/offers/:id/accept
   └─> Status: 'offer_made' → 'accepted'
   └─> Backend returns HTTP 402

3. Peggy funds escrow
   └─> Solana transaction
   └─> POST /api/advertiser/payments/verify
   └─> Status: 'accepted' → 'funded'

4. User picks up funded offer
   └─> Status: 'funded' (available for user to queue)
   └─> User validates escrow on-chain
   └─> User queues ad locally

5. User views ad → Settlement
   └─> Status: 'funded' → settling=true → settled_at populated
```

### Key Insight
**Peggy only sees offers with `status='offer_made'`**
- Each offer only seen once ✅
- No need for re-assessment logic ✅
- If offer rejected, status stays 'offer_made' (for now - may need 'rejected' status later)

---

## What Peggy Evaluates

### NOT "Campaign Criteria" (Old Terminology) 
The old implementation used hardcoded "campaign criteria":
```javascript
// OLD (in current peggy.js)
getCampaignCriteria() {
  return {
    campaignName: 'Nike Golf Championship 2025',
    targeting: { age: '40-60', interests: ['golf', 'sports'] },
    budgetRemaining: 1000,
    maxCpm: 0.030
  };
}
```

### NEW: Full Ad Creative Context 
Peggy should evaluate based on the **actual ad** from `ad_creative` table:

**Data Available in Offer:**
```javascript
{
  offer_id: 'offer_123',
  advertiser_id: 'adv_001',
  user_id: 'user_001',
  user_pubkey: '9kXH...',
  ad_id: 'ad_creative_123',  // ← References ad_creative table
  ad_creative_id: uuid,        // ← UUID FK to ad_creative
  amount_lamports: 25000000,
  status: 'offer_made',
  zk_proofs: { /* proof data */ },
  created_at: '2025-11-10T...'
}
```

**Ad Creative Data (from JOIN):**
```javascript
{
  ad_creative_id: 'ad_creative_123',
  advertiser_id: 'adv_001',
  campaign_id: 'campaign_xyz',
  type: 'text',
  headline: 'Play Like a Pro',
  body: 'New golf clubs for serious players',
  cta: 'Shop Now',
  destination_url: 'https://nike.com/golf',
  targeting: {
    age: '40-60',
    interests: ['golf', 'sports'],
    location: ['uk', 'us']
  },
  budget_per_impression_lamports: 30000000,  // Max willing to pay per impression
  total_budget_lamports: 1000000000,
  spent_lamports: 50000000,
  impressions_count: 123,
  status: 'active'
}
```

**ZK Proofs in Offer:**
```javascript
zk_proofs: {
  age: { proof: '0x...', publicSignals: [...] },
  interests: { proof: '0x...', publicSignals: [...] },
  location: { proof: '0x...', publicSignals: [...] }
}
```

### LLM Evaluation Context
Peggy's LLM should receive:
1. **Ad Details:** headline, body, targeting criteria, max CPM
2. **User Offer:** amount requested, ZK proofs submitted
3. **Budget Status:** total budget, spent, remaining
4. **Match Analysis:** Which proofs match which requirements

**Decision:** Accept if:
- User's price ≤ Ad's `budget_per_impression_lamports`
- Budget remaining (`total_budget_lamports - spent_lamports`) can cover it
- ZK proofs match targeting requirements
- Ad status is 'active'

---

## 🗂 Session Storage

### Location
```
/backend/advertiser-sessions/
  └── [advertiser_id]/
      ├── session_20251110_143000.json
      ├── session_20251110_150030.json
      └── ...
```

### Session Schema
```json
{
  "session_id": "session_20251110_143000",
  "timestamp": "2025-11-10T14:30:00Z",
  "trigger_type": "manual",
  "advertiser_id": "adv_001",
  "advertiser_name": "Nike Golf Championship",
  "offers_evaluated": 5,
  "accepted": 3,
  "rejected": 2,
  "total_funded_lamports": 75000000,
  "offers": [
    {
      "offer_id": "offer_001",
      "user_id": "user_001",
      "ad_creative_id": "ad_creative_123",
      "ad_headline": "Play Like a Pro",
      "amount_lamports": 25000000,
      "decision": "accept",
      "reasoning": "Excellent match (3/3 proofs), price fair ($0.025 vs $0.030 max)...",
      "confidence": 0.95,
      "funded": true,
      "escrow_pda": "B6a1aL...",
      "escrow_tx": "5tx1m2...",
      "timestamp": "2025-11-10T14:30:15Z"
    },
    {
      "offer_id": "offer_002",
      "user_id": "user_002",
      "ad_creative_id": "ad_creative_123",
      "ad_headline": "Play Like a Pro",
      "amount_lamports": 50000000,
      "decision": "reject",
      "reasoning": "Price too high ($0.050 vs $0.030 max CPM). Over budget.",
      "confidence": 0.92,
      "funded": false,
      "timestamp": "2025-11-10T14:30:20Z"
    }
  ]
}
```

---

## UI Requirements

### Clone Extension Pattern
**Source:** `/extension/ad-queue.html` + `/extension/ad-queue.js`  
**Target:** `/backend/app/advertisers/offer-queue/page.tsx` (Next.js)

### Key UI Elements to Port

1. **Header**
   - "PayAttn: Offer Management" (or similar)
   - Subtitle explaining what Peggy does

2. **Trigger Button**
   - "🤖 Assess Pending Offers" (replaces Max's "Assess Campaigns")
   - Triggers Peggy evaluation
   - Shows loading state during processing

3. **Status Banner**
   - Shows progress: "Fetching offers...", "Evaluating with AI...", "Funding escrows..."
   - Color-coded: grey (pending), amber (processing), green (success), red (error)

4. **Offer Cards** (similar to Max's ad cards)
   ```
   ┌─────────────────────────────────────────┐
   │ ✅ Offer #offer_001                     │
   │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
   │                                          │
   │ 👤 user_001 | 💰 0.025 SOL             │
   │ 📋 Ad: "Play Like a Pro"                │
   │                                          │
   │ DECISION: ACCEPT                         │
   │ Confidence: 95%                          │
   │                                          │
   │ Reasoning:                               │
   │ Excellent match (3/3 proofs verified).  │
   │ Price is fair ($0.025 vs $0.030 max).  │
   │ Budget allows it. Strong fit.           │
   │                                          │
   │ ✅ Escrow Funded                        │
   │ PDA: B6a1aL...                          │
   │ Tx: 5tx1m2... [View on Explorer]       │
   └─────────────────────────────────────────┘
   ```

5. **Session Navigation**
   - Pagination: "← Prev Session | Next Session →"
   - Session info: date, ID, summary stats
   - Filter buttons: All | Accepted | Rejected

6. **Summary Stats**
   ```
   Session: Nov 10, 2025 2:30 PM
   
   📊 Results:
   • Total Offers: 5
   • Accepted: 3 (✅)
   • Rejected: 2 (❌)
   • Total Funded: 0.075 SOL
   ```

---

## Technical Implementation

### Architecture

**Frontend:** Next.js page (React component)  
**Backend:** New API route for Peggy execution  
**Storage:** JSON files in `/backend/advertiser-sessions/`

### New Files to Create

1. **Frontend:**
   - `/backend/app/advertisers/offer-queue/page.tsx` - Main UI page

2. **Backend API:**
   - `/backend/app/api/advertiser/assess-offers/route.ts` - Trigger Peggy evaluation

3. **Peggy Server Module:**
   - `/backend/lib/peggy-assessor.ts` - Server-side Peggy logic (port from advertiser-agent)
   - `/backend/lib/session-manager.ts` - Session file management

4. **Utilities:**
   - `/backend/lib/offer-evaluator.ts` - LLM evaluation logic
   - `/backend/lib/escrow-funder.ts` - Solana escrow funding (port from advertiser-agent)

### Data Flow

```
1. User loads /advertisers/offer-queue
   ↓
2. Page fetches existing sessions (API: GET /api/advertiser/sessions)
   ↓
3. Displays latest session (or empty state)
   ↓
4. User clicks "Assess Pending Offers"
   ↓
5. POST /api/advertiser/assess-offers
   ↓
6. Server-side:
   a. Fetch offers WHERE status='offer_made'
   b. For each offer:
      - Join with ad_creative table
      - Call Venice AI for evaluation
      - If ACCEPT:
        * POST /api/advertiser/offers/:id/accept (x402)
        * Fund escrow on Solana
        * POST /api/advertiser/payments/verify
   c. Save session to JSON file
   d. Return session data
   ↓
7. Frontend displays results (offer cards)
   ↓
8. User can navigate to previous sessions
```

---

## Confirmed Requirements

### 1. Offer Status Flow
**Confirmed:**
```
'offer_made' → 'accepted' → 'funded' → 'settled'
```

- Peggy queries: `status='offer_made'`
- When Peggy accepts: status → 'accepted'
- After escrow funded: status → 'funded'
- After ad viewed: status → 'settled'

### 2. Ad Evaluation
**Confirmed:** Each offer evaluated against its specific ad_creative

**Implementation:**
```sql
SELECT offers.*, ad_creative.*
FROM offers
JOIN ad_creative ON offers.ad_creative_id = ad_creative.id
WHERE offers.advertiser_id = 'AE6uwbubDn9WyXrpzvqU58jfirvqZAxWCZCfDDwW5MMb'
  AND offers.status = 'offer_made'
```

### 3. Venice AI API Key
**Confirmed:** Store in backend `.env.local`
- Server-side only (secure)
- No client exposure
- Consistent with current pattern

### 4. Escrow Keypair
**Confirmed:** File path stored in backend `.env.local`
- Path: `~/.config/solana/advertiser.json`
- Backend has access to file system
- Works for `npm run dev` persistent server

### 5. Progress Updates
**Confirmed:** Simple wait pattern (like Max)
- User clicks button → loading state
- Backend processes everything
- Returns complete results
- No real-time streaming (for now)

### 6. Session Pagination
**Confirmed:** Full pagination like Max
- Navigate between assessment sessions
- "← Prev Session | Next Session →"
- Filter by decision (All | Accepted | Rejected)
- Session summary stats

---

## UI Adjustments for Offers (vs Ads)

**Important:** Peggy assesses **OFFERS**, not ads directly

**Terminology Changes:**
- Max: "Assess Campaigns" → Peggy: "Assess Pending Offers"
- Max: "Ad Queue" → Peggy: "Offer Queue"
- Max: Shows ads to evaluate → Peggy: Shows offers (user requests for specific ads)

**Card Content:**
```
┌─────────────────────────────────────────┐
│ ✅ Offer #offer_test_booking_001        │  ← Offer ID
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                          │
│ 👤 user_test_001                        │  ← User who made offer
│ 💰 0.156 SOL ($0.156)                   │  ← Offer amount
│ 📋 Ad: "Book Your Dream Vacation"      │  ← Which ad (from ad_creative)
│                                          │
│ DECISION: ACCEPT                         │
│ Confidence: 95%                          │
│                                          │
│ Reasoning:                               │
│ Price is fair (0.156 SOL vs max 0.200   │
│ SOL for this ad). User provided valid   │
│ ZK proofs for age (25-60) and location  │
│ (UK, US). Budget allows it.             │
│                                          │
│ ✅ Escrow Funded                        │
│ PDA: B6a1aL...                          │
│ Tx: 5tx1m2... [View on Explorer]       │
└─────────────────────────────────────────┘
```

---

## Test Data

**Seed Script Created:** `/backend/db/seed-test-offers.js`

**Usage:**
```bash
# Seed test offers
node db/seed-test-offers.js

# Clean test offers
node db/seed-test-offers.js --clean
```

**Test Offers:**
- 7 offers total
- All use advertiser: `AE6uwbubDn9WyXrpzvqU58jfirvqZAxWCZCfDDwW5MMb`
- All have `status='offer_made'`
- Mix of different ad types (booking, fashion, VPN, trading)
- Various price points (75K - 281K lamports)
- Real ZK proofs included

---

## Next Steps

1. **✅ Requirements confirmed** (All 6 questions answered)
2. **✅ Test data script created**
3. **Begin implementation:**
   - Phase 1: Port advertiser-agent Peggy logic to backend/lib/
   - Phase 2: Create API route `/api/advertiser/assess-offers`
   - Phase 3: Clone ad-queue.html → offer-queue page
   - Phase 4: Wire up UI to API
   - Phase 5: Session storage & pagination
   - Phase 6: Testing & polish

**Estimated Time:** 4-6 hours (full web UI with polished UX)

---

## Ready to Build!

All requirements confirmed and clarified:
- Web UI location: `/backend/app/advertisers/offer-queue/page.tsx`
- Session storage: `/backend/advertiser-sessions/[advertiser-id]/sessionX.json`
- Offer status flow understood
- Ad creative evaluation context clear
- Auto-fund behavior confirmed
- UI adjustments for offers vs ads documented
- Test data seed script created
- Venice AI + keypair storage confirmed
- Simple wait UX (like Max)
- Session pagination planned

**Implementation plan ready in original document:**
`/docs/PEGGY_MANUAL_TRIGGER_PLAN.md`

**Ready to build the manual trigger UI for Peggy.**

