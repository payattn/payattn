# Peggy Manual Trigger - Implementation Task List (REVISED)

**Date:** November 10, 2025  
**Goal:** Build web UI for Peggy to manually assess offers (similar to Max's ad-queue)  
**Estimated Time:** 3-4 hours (simplified approach!)

---

## 🎯 Overview

**What We're Building:**
- Web UI: `/backend/app/advertisers/offer-queue/page.tsx`
- **Reuse Peggy's existing code** by moving it to `/backend/lib/peggy/`
- Session Storage: `/backend/advertiser-sessions/[advertiser-id]/sessionX.json`
- Uses existing endpoints: `/api/advertiser/offers/[id]/accept`, `/api/advertiser/payments/verify`

**Key Architecture Decision:**
🚨 **NO DUPLICATION!** Move Peggy's working modules from `/advertiser-agent/lib/` to `/backend/lib/peggy/` instead of rewriting them. Both manual UI and autonomous agent can import from same location.

**Key Requirements:**
- ✅ Use DATABASE_MODE env var to switch between `test_ad_creative` and `ad_creative`
- ✅ Move (don't duplicate!) Peggy's LLM, escrow, and database logic
- ✅ Use existing `/backend/lib/zk/verifier.ts` for proof validation
- ✅ Auto-fund accepted offers (Peggy is autonomous)
- ✅ Clone Max's UI pattern from `extension/ad-queue.html`

---

## Phase 1: Move Peggy's Code to Backend (30 min)

### 1.1 Move LLM Evaluator ⬜
**File:** `/backend/lib/peggy/llm-evaluator.ts`

**Tasks:**
- [ ] Convert `/advertiser-agent/lib/llm.js` to TypeScript
- [ ] Keep all existing logic (Venice AI, prompt building, fallback)
- [ ] Adapt to accept ad_creative data instead of hardcoded criteria
- [ ] Export `LLMEvaluator` class with `evaluateOffer()` method
- [ ] Add TypeScript types for inputs/outputs

**Success Criteria:** LLM evaluation works in backend context

---

### 1.2 Move Escrow Funder ⬜
**File:** `/backend/lib/peggy/escrow-funder.ts`

**Tasks:**
- [ ] Convert `/advertiser-agent/lib/escrow.js` to TypeScript
- [ ] Keep all existing Solana/Anchor logic
- [ ] Read advertiser keypair from ADVERTISER_KEYPAIR_PATH env var
- [ ] Export `EscrowFunder` class with `fundEscrow()` method
- [ ] Add TypeScript types

**Success Criteria:** Can fund escrows from backend

---

### 1.3 Move Database Client with DATABASE_MODE ⬜
**File:** `/backend/lib/peggy/database.ts`

**Tasks:**
- [ ] Convert `/advertiser-agent/lib/database.js` to TypeScript
- [ ] Add DATABASE_MODE support to switch between tables:
  ```ts
  const tableName = process.env.DATABASE_MODE === 'test' ? 'test_ad_creative' : 'ad_creative';
  ```
- [ ] Create `getPendingOffersWithAds()` that JOINs offers + ad_creative
- [ ] Export `DatabaseClient` class
- [ ] Add TypeScript types

**Success Criteria:** Can query correct tables based on DATABASE_MODE

---

### 1.4 Create Session Manager ⬜
**File:** `/backend/lib/peggy/session-manager.ts`

**Tasks:**
- [ ] Create `SessionManager` class (new file, not moved)
- [ ] `saveSession(advertiserId, sessionData)` - Save to `/backend/advertiser-sessions/`
- [ ] `loadSessions(advertiserId)` - Read all sessions
- [ ] `getSessionById(advertiserId, sessionId)` - Load specific session
- [ ] Add error handling for file I/O

**Success Criteria:** Can save/load session JSON files

---

### 1.5 Add ZK Proof Validation Helper ⬜
**File:** `/backend/lib/peggy/proof-validator.ts`

**Tasks:**
- [ ] Import existing `verifyProof` from `/backend/lib/zk/verifier.ts`
- [ ] Create `validateOfferProofs(offer)` that:
  - Extracts zk_proofs from offer
  - Validates each using existing verifier
  - Returns human-readable summary
- [ ] Add TypeScript types

**Success Criteria:** Can verify proofs and return status summary

---

## Phase 2: Create API Endpoint (30 min)

### 2.1 Assessment API Route ⬜
**File:** `/backend/app/api/advertiser/assess/route.ts`

**Tasks:**
- [ ] Create POST endpoint
- [ ] Import Peggy modules from `/backend/lib/peggy/`
- [ ] Orchestrate flow:
  1. Get pending offers with ads
  2. Validate ZK proofs
  3. Evaluate with LLM
  4. Fund accepted offers
  5. Save session
- [ ] Return session data as JSON
- [ ] Add error handling

**Success Criteria:** API endpoint works end-to-end

---

### 2.2 Sessions API Route ⬜
**File:** `/backend/app/api/advertiser/sessions/route.ts`

**Tasks:**
- [ ] Create GET endpoint
- [ ] Return list of sessions for advertiser
- [ ] Use SessionManager.loadSessions()

**Success Criteria:** Can fetch session history

---

## Phase 2: Frontend UI (1.5 hours)

### 2.3 Create Offer Queue Page ⬜
**File:** `/backend/app/advertisers/offer-queue/page.tsx`

**Tasks:**
- [ ] Copy structure from `/extension/ad-queue.html`
- [ ] Convert to React/JSX with Tailwind CSS
- [ ] Add "🤖 Assess Pending Offers" button
- [ ] Add status banner, session navigation, filters
- [ ] Set up state management with TypeScript types

**Success Criteria:** Page renders with Max's visual structure

---

### 2.4 Create OfferCard Component ⬜
**File:** `/backend/app/advertisers/offer-queue/page.tsx`

**Tasks:**
- [ ] Display offer details (ID, user, price, ad headline)
- [ ] Show ZK proof validation status (not raw proofs!)
  - Example: "✅ 2 valid proofs: Age (25-60), Location (UK, US)"
- [ ] Show decision (ACCEPT/REJECT) with color coding
- [ ] Show LLM reasoning and confidence
- [ ] If funded: Show escrow PDA and Solana Explorer link
- [ ] Style like Max's ad cards

**Success Criteria:** Offer cards show all info clearly

---

### 2.5 Session Navigation & Filters ⬜
**File:** `/backend/app/advertisers/offer-queue/page.tsx`

**Tasks:**
- [ ] Add prev/next session navigation
- [ ] Add filter buttons (All | Accepted | Rejected)
- [ ] Implement filter logic
- [ ] Load sessions on mount from `/api/advertiser/sessions`

**Success Criteria:** Can navigate sessions and filter offers

---

## Phase 3: Integration & Testing (1 hour)

### 3.1 Test with Seed Data ⬜
**Tasks:**
- [ ] Run `node db/seed-test-offers.js`
- [ ] Start backend: `npm run dev`
- [ ] Navigate to `/advertisers/offer-queue`
- [ ] Test full flow: Assess → Fund → Display
- [ ] Verify DATABASE_MODE switches tables correctly
- [ ] Verify ZK proofs are validated
- [ ] Verify sessions are saved

**Success Criteria:** End-to-end flow works

---

### 3.2 Update Autonomous Peggy ⬜
**File:** `/advertiser-agent/peggy.js`

**Tasks:**
- [ ] Update imports to use `/backend/lib/peggy/` instead of local `./lib/`
- [ ] Verify autonomous polling still works
- [ ] Test that both manual and autonomous don't conflict

**Success Criteria:** Both modes work independently

---

### 3.3 Error Handling & Polish ⬜
**Tasks:**
- [ ] Test error cases (no offers, LLM failure, escrow failure)
- [ ] Add loading states and animations
- [ ] Match Max's color scheme
- [ ] Ensure responsive design

**Success Criteria:** UI is polished and handles errors

---

## 📊 Summary

### Simplified File Structure
```
/backend/
├── lib/
│   └── peggy/                        # MOVED from /advertiser-agent/lib/
│       ├── llm-evaluator.ts          # Moved + converted to TS
│       ├── escrow-funder.ts          # Moved + converted to TS
│       ├── database.ts               # Moved + converted to TS + DATABASE_MODE
│       ├── proof-validator.ts        # NEW (thin wrapper)
│       └── session-manager.ts        # NEW
├── app/
│   ├── advertisers/
│   │   └── offer-queue/
│   │       └── page.tsx              # NEW
│   └── api/
│       └── advertiser/
│           ├── assess/route.ts       # NEW
│           └── sessions/route.ts     # NEW
└── advertiser-sessions/              # NEW
    └── [advertiser-id]/
        └── sessionX.json

/advertiser-agent/
├── peggy.js                          # Updated imports → /backend/lib/peggy/
└── lib/                              # DEPRECATED (moved to backend)
```

### Key Differences from Original Plan
❌ **Before:** Duplicate LLM, escrow, database logic  
✅ **After:** Move existing working code, reuse everywhere

❌ **Before:** Create orchestrator API that calls separate process  
✅ **After:** API directly imports Peggy modules (same process)

❌ **Before:** 25 tasks, 6 hours  
✅ **After:** 12 tasks, 3-4 hours

### Checklist Progress
- [ ] Phase 1: Move Peggy's Code (5 tasks - 30 min)
- [ ] Phase 2: Create API Endpoints (2 tasks - 30 min)
- [ ] Phase 3: Build Frontend UI (3 tasks - 1.5 hours)
- [ ] Phase 4: Integration & Testing (3 tasks - 1 hour)

**Total: 13 tasks, 3-4 hours**

---

## 🚀 Ready to Start!
