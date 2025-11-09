# Peggy - Advertiser Agent Build Tasks

**Target:** Complete autonomous advertiser agent for x402 protocol  
**Estimated Time:** 14 hours (1-1.5 days)  
**Priority:** HIGH  
**Deadline:** November 11, 2025

---

## 📋 Task Checklist

### Phase 0: Database Seeding (1 hour) ✅ COMPLETE
- [x] **0.1** Create `seed-test-data.js` script
  - [x] Connect to Supabase with credentials from backend
  - [x] Create test advertiser record (`adv_001`, wallet: `AE6uwbubDn9WyXrpzvqU58jfirvqZAxWCZCfDDwW5MMb`)
  - [x] Create test user record with wallet
  - [x] Create 3-5 test offers with varying match scores/prices
  - [x] Include mix of good and bad offers for testing
- [x] **0.2** Add cleanup function to clear test data
- [x] **0.3** Test seed script works end-to-end
- [x] **0.4** Document seed script usage in README

### Phase 1: Project Setup (2 hours) ✅ COMPLETE
- [x] **1.1** Create `/advertiser-agent/` directory structure
- [x] **1.2** Initialize npm project (`npm init -y`)
- [x] **1.3** Install dependencies:
  - [x] `@solana/web3.js`
  - [x] `@coral-xyz/anchor`
  - [x] `dotenv`
  - [x] `@supabase/supabase-js` (for fetching advertiser data)
  - [x] `bn.js` (for BigNumber support)
  - [x] Dev dependencies: `nodemon`, `@types/node`
- [x] **1.4** Create `config.js` with environment variables
- [x] **1.5** Create `.env.example` template
- [x] **1.6** Create actual `.env` file (in .gitignore, user adds Venice key manually)
- [x] **1.7** Test basic imports and config loading

### Phase 2: LLM Integration (2 hours) ✅ COMPLETE
- [x] **2.1** Create `lib/llm.js` file
- [x] **2.2** Implement `LLMClient` class with Venice AI support (reuse pattern from `/extension/venice-ai.js`)
- [x] **2.3** Implement `buildEvaluationPrompt()` method
  - [x] Include campaign criteria
  - [x] Include offer details
  - [x] Add evaluation criteria logic
  - [x] Format for JSON output
- [x] **2.4** Implement `callVeniceAI()` method
- [x] **2.5** Add JSON parsing with error handling
- [x] **2.6** Add fallback evaluation (simple rules if LLM fails)
- [x] **2.7** Test LLM evaluation with live Venice AI
- [x] **2.8** Verify JSON response format: `{decision, reasoning, confidence}`

### Phase 3: Backend API Client (1 hour) ✅ COMPLETE
- [x] **3.1** Create `lib/api.js` file
- [x] **3.2** Implement `BackendClient` class
- [x] **3.3** Implement `fetchPendingOffers()` method
  - [x] Query: `/api/advertiser/offers?status=offer_made&advertiser_id=adv_001`
  - [x] Handle empty results gracefully
- [x] **3.4** Implement `acceptOffer(offerId)` method
  - [x] POST to `/api/advertiser/offers/:id/accept`
  - [x] Handle HTTP 402 response
  - [x] Parse x402 headers correctly
- [x] **3.5** Implement `submitPaymentProof(offerId, txSignature)` method
  - [x] POST to `/api/advertiser/payments/verify`
  - [x] Handle verification response
- [x] **3.6** Test API calls with running backend

### Phase 4: Escrow Funding (3 hours) ✅ COMPLETE
- [x] **4.1** Create `lib/escrow.js` file
- [x] **4.2** Implement `EscrowFunder` class
- [x] **4.3** Implement `loadKeypair()` method
  - [x] Read advertiser keypair from path
  - [x] Handle file errors gracefully
- [x] **4.4** Implement `createProgram()` method
  - [x] Load IDL from `/solana/payattn_escrow/target/idl/payattn_escrow.json`
  - [x] Setup Anchor provider with WalletWrapper class
  - [x] Return Program instance
- [x] **4.5** Implement `fundEscrow(x402Data)` method
  - [x] Derive PDA and verify it matches x402 escrowPda
  - [x] Call `createEscrow` instruction with correct accounts
  - [x] Use `BN` for lamports amount
  - [x] Wait for transaction confirmation
  - [x] Return transaction signature
- [x] **4.6** Implement `getBalance()` helper method
- [x] **4.7** Add comprehensive error handling
- [x] **4.8** Test escrow funding on Solana devnet
- [x] **4.9** Verify escrow creation in Solana Explorer

### Phase 5: Main Agent Loop (2 hours) ✅ COMPLETE
- [x] **5.1** Create `peggy.js` main file
- [x] **5.2** Implement `PeggyAgent` class
- [x] **5.3** Initialize all clients (LLM, API, Escrow, Database) in constructor
- [x] **5.4** Implement `start()` method
  - [x] Display startup info (advertiser ID, wallet, balance)
  - [x] Warn if balance is low (<0.1 SOL)
  - [x] Start polling loop
- [x] **5.5** Implement `processOffers()` method
  - [x] Fetch pending offers from database
  - [x] Log offer count
  - [x] Loop through each offer
  - [x] Skip already-processed offers
- [x] **5.6** Implement `handleOffer(offer)` method
  - [x] Get campaign criteria
  - [x] Call LLM evaluation
  - [x] Log decision with reasoning
  - [x] If rejected, return early
  - [x] If accepted, proceed with funding
- [x] **5.7** Integrate full x402 flow in `handleOffer()`
  - [x] Accept offer (get x402 response)
  - [x] Fund escrow on Solana
  - [x] Submit payment proof
  - [x] Log success
- [x] **5.8** Implement `getCampaignCriteria()` helper
  - [x] Return hardcoded criteria for hackathon
  - [x] Add TODO for database integration
- [x] **5.9** Add `sleep()` utility method
- [x] **5.10** Implement processed offers tracking (Set)
- [x] **5.11** Add graceful error handling in main loop

### Phase 6: Demo Integration (1 hour) ✅ COMPLETE
- [x] **6.1** Update `package.json` with scripts
  - [x] `"start": "node peggy.js"`
  - [x] `"dev": "nodemon peggy.js"`
  - [x] `"seed": "node seed-test-data.js"`
  - [x] Set `"type": "module"` for ES6 imports
- [x] **6.2** Create comprehensive `README.md`
  - [x] Setup instructions
  - [x] Environment configuration guide
  - [x] Running instructions
  - [x] Demo flow explanation
  - [x] Monitoring tips
- [x] **6.3** Add helpful console logging with emojis
  - [x] 🤖 Startup
  - [x] 📋 Evaluating offers
  - [x] 💭 LLM thinking
  - [x] ✅/❌ Decisions
  - [x] 💰 x402 responses
  - [x] 📝 Payment proofs
- [x] **6.4** Add Solana Explorer links to transaction logs
- [x] **6.5** Test full startup flow
- [x] **6.6** Verify README instructions work

### Phase 7: Testing & Validation (3 hours) ✅ COMPLETE
- [x] **7.1** Unit Tests
  - [x] Test config loading
  - [x] Test database connection
  - [x] Test escrow module initialization
- [x] **7.2** Integration Tests
  - [x] Test backend API calls (with running backend)
  - [x] Test escrow funding (Solana devnet)
  - [x] Test payment verification
- [x] **7.3** End-to-End Test
  - [x] Start backend server
  - [x] Seed test data in database
  - [x] Run Peggy successfully
  - [x] Verify offers are evaluated with LLM
  - [x] Verify accepted offers are funded (3/5 accepted as expected)
  - [x] Verify payment proofs submitted
  - [x] Check backend marks offers as "funded"
- [x] **7.4** Error Handling Tests
  - [x] Low wallet balance (warns but continues)
  - [x] Wallet mismatch warning implemented
  - [x] Invalid x402 response (logs error and continues)
  - [x] LLM API errors (fallback evaluation works)
- [x] **7.5** Edge Cases
  - [x] Empty offers list (logs "No pending offers")
  - [x] Duplicate offer IDs (tracked and skipped)
  - [x] PDA verification (matches backend calculation)
- [x] **7.6** Run Peggy successfully with real offers
- [x] **7.7** Verified no crashes or memory leaks
- [x] **7.8** Verify logs are clear and informative

### Phase 8: Documentation & Polish (1 hour) ✅ COMPLETE
- [x] **8.1** Add inline comments to complex logic
- [x] **8.2** Document all environment variables
- [x] **8.3** Create troubleshooting section in README
- [x] **8.4** Add example console output to README
- [x] **8.5** Document integration with Max (user agent)
- [x] **8.6** Add demo script for judges
- [x] **8.7** Review all TODOs and mark as such
- [x] **8.8** Final code review

### BONUS Phase: Database Integration ✅ COMPLETE
- [x] Create `lib/database.js` for Supabase integration
- [x] Fetch real advertiser records from database
- [x] Fetch pending offers directly from database
- [x] Verify wallet matches database record

---

## 🔧 Prerequisites & Setup - ALL VERIFIED ✅

### Before Starting - Status Check:

#### 1. Advertiser Wallet ✅
- ✅ **Pubkey:** `AE6uwbubDn9WyXrpzvqU58jfirvqZAxWCZCfDDwW5MMb`
- ✅ **Keypair Location:** `~/.config/solana/advertiser.json`
- ✅ **Balance:** Sufficient devnet SOL for testing
- ✅ **Documented in:** `docs/solana_dev.md`

#### 2. Solana Smart Contract ✅
- ✅ **Program ID:** `6ZEekbTJZ6D6KrfSGDY2ByoWENWfe8RzhvpBS4KtPdZr` (deployed)
- ✅ **IDL File:** `/solana/payattn_escrow/target/idl/payattn_escrow.json` (exists)
- ✅ **Test Script:** `/solana/payattn_escrow/fund-escrow-new.js` (reference)
- ✅ **Network:** Solana devnet

#### 3. Backend API ✅
- ✅ **Endpoints Ready:**
  - `GET /api/advertiser/offers?status=offer_made&advertiser_id=X`
  - `POST /api/advertiser/offers/:id/accept` (returns HTTP 402)
  - `POST /api/advertiser/payments/verify` (verifies escrow)
- ✅ **Backend Start:** `cd backend && npm run dev`
- ✅ **Database:** Supabase configured
  - URL: `https://uytcohrqiqmtfdopdrpe.supabase.co`
  - Tables: `offers`, `advertisers`, `users`, `publishers`, `settlement_queue`

#### 4. Venice AI Integration ✅
- ✅ **Pattern:** Available in `/extension/venice-ai.js`
- ✅ **Endpoint:** `https://api.venice.ai/api/v1/chat/completions`
- ✅ **Model:** `venice-uncensored`
- ⏳ **API Key:** User will add manually to `.env` before testing

#### 5. Test Data Strategy ✅
- ✅ **Approach:** Seed script creates test data in database
- ✅ **Script:** `seed-test-data.js` (will create in Phase 0)
- ✅ **Contents:** Test advertiser + users + 3-5 sample offers
- ✅ **Cleanup:** Script includes cleanup function for re-testing
- ✅ **Max Integration:** Can test later after Peggy is working

---

## ✅ Knowledge Gaps RESOLVED

### All Questions Answered:

1. **Database Schema:** ✅ CONFIRMED
   - Schema provided: `offers`, `advertisers`, `users`, `publishers`, `settlement_queue`
   - `offers` table has: `offer_id`, `advertiser_id`, `user_id`, `user_pubkey`, `ad_id`, `amount_lamports`, `status`, `escrow_pda`, `escrow_tx_signature`
   - `advertisers` table has: `advertiser_id`, `name`, `wallet_pubkey`
   - **Action:** Fetch real advertiser from database using `advertiser_id`

2. **Advertiser Setup:** ✅ CONFIRMED
   - Use real database record (not hardcoded)
   - Peggy will query `advertisers` table for wallet info
   - Seed script will create test advertiser record

3. **Campaign Criteria:** ✅ CONFIRMED
   - Use hardcoded criteria in Peggy (no database)
   - Add TODO for future database integration

4. **LLM Provider:** ✅ CONFIRMED
   - Venice AI (same pattern as Max)
   - API key from `.env` file
   - Reference: `/extension/venice-ai.js`

5. **Offer Creation:** ✅ CONFIRMED
   - Seed script will create test offers in database
   - Max integration can be tested later
   - Seed script will be reusable for cleanup/re-testing

6. **Advertiser Wallet:** ✅ CONFIRMED
   - Pubkey: `AE6uwbubDn9WyXrpzvqU58jfirvqZAxWCZCfDDwW5MMb`
   - Keypair location: `~/.config/solana/advertiser.json`
   - Has sufficient devnet SOL for testing
   - Details in `solana_dev.md`

7. **x402 Headers:** ✅ CONFIRMED
   - All headers implemented in backend
   - Verified in `/backend/app/api/advertiser/offers/[id]/accept/route.ts`

8. **Supabase Connection:** ✅ CONFIRMED
   - URL: `https://uytcohrqiqmtfdopdrpe.supabase.co`
   - Anon Key: Available in backend `.env.local`
   - Will reuse for seed script

---

## 🎯 Success Criteria Checklist

When ALL of these are true, Peggy is complete:

- [x] ✅ Can start with single command: `npm start`
- [x] ✅ Polls backend every 30 seconds for pending offers
- [x] ✅ Evaluates each offer using LLM with clear reasoning
- [x] ✅ Accepts offers matching campaign criteria
- [x] ✅ Rejects offers not matching criteria (with reasoning)
- [x] ✅ Funds Solana escrows successfully for accepted offers
- [x] ✅ Submits payment proofs to backend after funding
- [x] ✅ Backend marks offers as "funded" after verification
- [x] ✅ Runs continuously without crashing
- [x] ✅ Handles errors gracefully (logs but continues)
- [x] ✅ Clear console output with emojis and formatting
- [x] ✅ README has complete setup instructions
- [x] ✅ All transactions visible in Solana Explorer
- [x] ✅ Integrates with Max agent for complete demo flow
- [x] ✅ Code is modular and well-commented

## ✅ PEGGY IS COMPLETE AND TESTED!

---

## 📊 Time Allocation Summary

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| 0. Database Seeding | 0.1-0.4 | 1 hour |
| 1. Project Setup | 1.1-1.7 | 2 hours |
| 2. LLM Integration | 2.1-2.8 | 2 hours |
| 3. Backend API | 3.1-3.6 | 1 hour |
| 4. Escrow Funding | 4.1-4.9 | 3 hours |
| 5. Main Agent Loop | 5.1-5.11 | 2 hours |
| 6. Demo Integration | 6.1-6.6 | 1 hour |
| 7. Testing | 7.1-7.8 | 3 hours |
| 8. Documentation | 8.1-8.8 | 1 hour |
| **TOTAL** | **86 tasks** | **15 hours** |

---

## 🚀 Ready to Start?

### Next Steps:
1. Review knowledge gaps above - confirm assumptions or clarify
2. Ensure all prerequisites are met (wallet, backend, API keys)
3. Start with Phase 1 (Project Setup)
4. Work through phases sequentially
5. Test frequently after each phase

### Recommended Working Order:
1. ✅ Setup project structure (Phase 1)
2. ✅ Build API client and test with backend (Phase 3) 
3. ✅ Add LLM evaluation (Phase 2)
4. ✅ Implement escrow funding (Phase 4)
5. ✅ Wire everything together in main loop (Phase 5)
6. ✅ Polish and document (Phases 6-8)

**Let's build Peggy! 🎉**
