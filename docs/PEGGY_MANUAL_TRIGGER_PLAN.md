# Peggy Manual Trigger & Offer Assessment - Development Plan

**Date:** November 10, 2025  
**Status:** Planning Phase  
**Goal:** Enable manual triggering of Peggy's offer assessment workflow (similar to Max's UX)

---

## Executive Summary

### Current State
Peggy is **fully implemented and operational** as an autonomous polling agent:
- Polls database every 30 seconds for `status='offer_made'` offers
- Evaluates offers using Venice AI with campaign criteria
- Funds escrows on Solana for accepted offers
- Submits payment proofs to backend
- Runs continuously via `npm start`

### What We Want
A **Max-like user experience** for Peggy where:
1. User can **manually trigger** Peggy to process her queue
2. Peggy reads all pending offers from the `offers` table (`status='offer_made'`)
3. For each offer, Peggy:
   - Evaluates it with LLM (accept/reject based on campaign criteria)
   - If suitable → Accept offer → Fund escrow → Submit payment proof
   - Display results with reasoning in a clear UI/console output
4. Similar flow to Max's `ad-queue.html` where user clicks "Assess Campaigns" button

### Key Question
**Where should this live?**
- **Option A:** Server-side CLI command (Node.js script)
- **Option B:** Web UI in backend (Next.js page)
- **Option C:** Separate advertiser portal/dashboard

You mentioned "Peggy lives on the server (for now)" so **Option A (CLI)** seems most aligned with current architecture.

---

## Current Architecture Analysis

### Peggy's Structure (All Complete)
```
/advertiser-agent/
├── peggy.js              # Main agent (polling loop)
├── lib/
│   ├── llm.js           # Venice AI evaluation
│   ├── api.js           # Backend HTTP client (x402 flow)
│   ├── escrow.js        # Solana escrow funding
│   └── database.js      # Supabase direct queries
└── seed-test-data.js    # Test data creation
```

### Current Flow (Autonomous Polling)
```
1. Peggy starts → `npm start`
2. Main loop runs every 30 seconds
3. Calls `processOffers()`:
   a. Fetch offers WHERE status='offer_made' AND advertiser_id='adv_001'
   b. For each offer not in processedOffers Set:
      - Call handleOffer(offer)
      - LLM evaluation
      - If ACCEPT → fund escrow
      - Add to processedOffers Set
4. Sleep 30s, repeat
```

### Max's UX Pattern (for comparison)
```
User clicks "Assess Campaigns" button in ad-queue.html
  ↓
handleFetchAndAssess() called
  ↓
1. Fetch ads from backend API
2. Create session object with timestamp
3. For each ad:
   - Call assessCampaign(ad) with Venice AI
   - Display decision + reasoning in UI
   - If OFFER → generate ZK proofs → submit to backend
4. Save session to chrome.storage
5. Display results in ad-queue.html
```

### Key Differences
| Aspect | Max (User Agent) | Peggy (Advertiser Agent) |
|--------|------------------|--------------------------|
| **Environment** | Chrome extension | Node.js server process |
| **Trigger** | Manual button click | Automatic polling (30s) |
| **UI** | HTML page (ad-queue.html) | Console logs |
| **Data Source** | Backend API `/api/user/adstream` | Database direct query |
| **State** | Chrome storage (sessions) | In-memory Set (processedOffers) |
| **Output** | Visual cards with decisions | Console text with emojis |

---

## Proposed Solution: Manual Trigger CLI

### Design Goals
1. **Mimic Max's UX** but for server-side (CLI instead of web UI)
2. **On-demand execution** (not continuous polling)
3. **Clear visual feedback** (similar to Max's assessment cards)
4. **Session tracking** (like Max's sessions, but in database or files)
5. **Idempotent** (can run multiple times safely)

### Recommended Approach: Separate CLI Command

Create a new script `peggy-assess.js` that:
- Runs once when called (no polling loop)
- Fetches all pending offers from database
- Evaluates each offer with LLM
- Displays results in formatted console output
- Optionally funds accepted offers (or show preview first)
- Saves assessment session to database/JSON file

**Why separate from `peggy.js`?**
- `peggy.js` = autonomous background process (cronjob-like)
- `peggy-assess.js` = manual on-demand tool (interactive)
- Cleaner separation of concerns
- Can reuse same classes (LLMClient, DatabaseClient, etc.)

---

##  Implementation Plan

### Phase 1: Create Manual Assessment Script (2 hours)

**File:** `/advertiser-agent/peggy-assess.js`

**Features:**
- Single-run mode (no polling loop)
- Fetch all pending offers for advertiser
- Interactive mode: Show preview before funding
- Display formatted results (similar to Max's ad cards)
- Save assessment session to file/database

**Command Interface:**
```bash
# Assess all pending offers (preview only, no funding)
npm run assess

# Assess and auto-fund accepted offers
npm run assess -- --auto-fund

# Assess specific offer ID
npm run assess -- --offer-id offer_123

# Show help
npm run assess -- --help
```

**Tasks:**
- [ ] 1.1 Create `peggy-assess.js` file
- [ ] 1.2 Import existing classes (LLMClient, DatabaseClient, EscrowFunder)
- [ ] 1.3 Implement `PeggyAssessor` class (single-run version of PeggyAgent)
- [ ] 1.4 Add CLI argument parsing (--auto-fund, --offer-id, --help)
- [ ] 1.5 Implement `assess()` main function
- [ ] 1.6 Add formatted console output (tables, colors, emojis)
- [ ] 1.7 Add preview mode (show decisions before funding)
- [ ] 1.8 Add confirmation prompt for funding
- [ ] 1.9 Save session to JSON file or database
- [ ] 1.10 Update package.json with `assess` script

### Phase 2: Enhanced Output Formatting (1 hour)

**Goal:** Make output visually similar to Max's ad-queue.html (but in terminal)

**Features:**
- Table layout for offers
- Color coding (green=accept, red=reject)
- Decision summary at end
- Session metadata (timestamp, trigger type)

**Libraries to Consider:**
- `chalk` - Terminal colors
- `cli-table3` - ASCII tables
- `ora` - Loading spinners
- `inquirer` - Interactive prompts

**Tasks:**
- [ ] 2.1 Install formatting libraries (`chalk`, `cli-table3`, `inquirer`)
- [ ] 2.2 Create `lib/formatter.js` for output helpers
- [ ] 2.3 Implement `formatOfferTable()` - Display offers in table
- [ ] 2.4 Implement `formatDecision()` - Color-coded decision display
- [ ] 2.5 Implement `formatSummary()` - Session summary
- [ ] 2.6 Add loading spinners for LLM calls
- [ ] 2.7 Add interactive confirmation prompts
- [ ] 2.8 Test output on various terminal sizes

### Phase 3: Session Management (1 hour)

**Goal:** Track assessment sessions like Max does (for history/debugging)

**Options:**
- **Option A:** JSON files in `/advertiser-agent/sessions/` (simpler, portable)
- **Option B:** Database table `peggy_sessions` (more robust, queryable)

**Recommended:** Start with Option A (JSON files), can add Option B later

**Session Structure:**
```json
{
  "session_id": "session_123",
  "timestamp": "2025-11-10T14:30:00Z",
  "trigger_type": "manual",
  "advertiser_id": "adv_001",
  "offers_evaluated": 5,
  "accepted": 3,
  "rejected": 2,
  "total_funded_lamports": 75000000,
  "offers": [
    {
      "offer_id": "offer_001",
      "user_id": "user_001",
      "amount_lamports": 25000000,
      "decision": "accept",
      "reasoning": "Excellent match...",
      "confidence": 0.95,
      "funded": true,
      "escrow_tx": "5tx1m2..."
    }
  ]
}
```

**Tasks:**
- [ ] 3.1 Create `lib/session-manager.js`
- [ ] 3.2 Implement `createSession()` - Initialize session object
- [ ] 3.3 Implement `addOfferResult()` - Add offer to session
- [ ] 3.4 Implement `saveSession()` - Write to JSON file
- [ ] 3.5 Implement `loadSessions()` - Read session history
- [ ] 3.6 Add session directory creation (ensure `/sessions/` exists)
- [ ] 3.7 Add `.gitignore` entry for `/sessions/` directory
- [ ] 3.8 Create `npm run sessions` command to list past sessions

### Phase 4: Integration with Existing Peggy (30 min)

**Goal:** Ensure manual and autonomous modes work together seamlessly

**Considerations:**
- `peggy.js` (autonomous) tracks `processedOffers` Set in memory
- `peggy-assess.js` (manual) runs independently
- Need to avoid duplicate processing

**Solutions:**
- Option A: Manual tool ignores `processedOffers` (processes all pending)
- Option B: Share state via database (add `last_assessed_at` column to `offers`)
- Option C: Manual tool can reset processed state with `--force` flag

**Recommended:** Option A + Option C
- Manual tool processes ALL pending offers (regardless of Set)
- Add `--force` flag to re-process already-processed offers
- `peggy.js` continues with its own Set (separate concerns)

**Tasks:**
- [ ] 4.1 Document interaction between `peggy.js` and `peggy-assess.js`
- [ ] 4.2 Add `--force` flag to re-process offers
- [ ] 4.3 Update README with usage examples
- [ ] 4.4 Test both modes running (autonomous + manual)

### Phase 5: Testing & Documentation (1 hour)

**Testing:**
- [ ] 5.1 Test manual assessment with no offers (empty state)
- [ ] 5.2 Test with mix of acceptable and rejectable offers
- [ ] 5.3 Test preview mode (no funding)
- [ ] 5.4 Test auto-fund mode
- [ ] 5.5 Test session saving and loading
- [ ] 5.6 Test concurrent execution with `peggy.js`
- [ ] 5.7 Test error handling (LLM failures, escrow failures)

**Documentation:**
- [ ] 5.8 Update `README.md` with manual trigger usage
- [ ] 5.9 Add examples to README
- [ ] 5.10 Document session file format
- [ ] 5.11 Add troubleshooting section
- [ ] 5.12 Create demo script for judges

---

## Example Usage & Output

### Command: Assess Offers (Preview Mode)
```bash
$ npm run assess

🤖 Peggy Manual Assessment
=========================================

Advertiser: Nike Golf Championship Campaign
Advertiser ID: adv_001
Wallet: AE6uwbubDn9WyXrpzvqU58jfirvqZAxWCZCfDDwW5MMb
Balance: 4.4592 SOL

📋 Found 5 pending offers

┌──────────────────────┬──────────────┬───────────┬──────────┬──────────────┐
│ Offer ID             │ User         │ Amount    │ Match    │ Decision     │
├──────────────────────┼──────────────┼───────────┼──────────┼──────────────┤
│ offer_001            │ user_001     │ 0.025 SOL │ 5/5      │ ✅ ACCEPT   │
│ offer_002            │ user_002     │ 0.020 SOL │ 4/5      │ ✅ ACCEPT   │
│ offer_003            │ user_003     │ 0.035 SOL │ 3/5      │ ❌ REJECT   │
│ offer_004            │ user_004     │ 0.015 SOL │ 5/5      │ ✅ ACCEPT   │
│ offer_005            │ user_005     │ 0.050 SOL │ 2/5      │ ❌ REJECT   │
└──────────────────────┴──────────────┴───────────┴──────────┴──────────────┘

─────────────────────────────────────────
📋 offer_001 - ACCEPT (95% confidence)

   Reasoning: Excellent match (5/5 criteria), price is fair 
   ($0.025 vs $0.030 max CPM), user has strong reputation (92%) 
   and high historical CTR (15.2%). This is exactly our target audience.

─────────────────────────────────────────

[... more detailed reasoning for each offer ...]

📊 Assessment Summary:
   Total Offers: 5
   Accepted: 3
   Rejected: 2
   Total to Fund: 0.060 SOL ($0.060)

? Would you like to fund the accepted offers? (Y/n)
```

### Command: Auto-Fund Mode
```bash
$ npm run assess -- --auto-fund

[... same output as above ...]

📊 Assessment Summary:
   Total Offers: 5
   Accepted: 3
   Rejected: 2
   Total to Fund: 0.060 SOL ($0.060)

💰 Auto-funding enabled. Processing accepted offers...

─────────────────────────────────────────
📤 Funding offer_001...

💰 Received HTTP 402 Payment Required
   Escrow PDA: B6a1aL5g4oP9iAqCU1egBszdB1CBcYBmEBaUBeVQoeKo
   Amount: 25000000 lamports (0.025 SOL)

📤 Submitting transaction...
✅ Transaction confirmed!
   Signature: 5tx1m2...
   Explorer: https://explorer.solana.com/tx/5tx1m2...?cluster=devnet

📝 Submitting payment proof...
✅ Offer funded successfully!

─────────────────────────────────────────

[... repeat for other accepted offers ...]

✅ All accepted offers funded!

Session saved: /advertiser-agent/sessions/session_20251110_143000.json
```

---

## Alternative Approaches Considered

### Alternative 1: Web UI in Backend
**Pros:**
- Visual interface (like Max's ad-queue.html)
- Accessible from browser
- Can show historical sessions in UI

**Cons:**
- More complex (need to build Next.js page + API routes)
- Requires authentication/authorization
- Not aligned with "Peggy lives on server" statement
- Adds scope beyond current hackathon timeline

**Recommendation:** Save for post-hackathon (Phase 2 feature)

### Alternative 2: Modify Existing peggy.js
**Pros:**
- Single codebase
- No new files

**Cons:**
- Mixes concerns (autonomous vs manual)
- Harder to test separately
- Polling loop interferes with manual mode
- Less clean architecture

**Recommendation:** Keep separate for clarity

### Alternative 3: API Endpoint + curl
**Pros:**
- RESTful
- Can trigger from anywhere

**Cons:**
- Still need to implement endpoint in backend
- curl output is ugly compared to formatted CLI
- User experience not as nice as interactive CLI

**Recommendation:** Could add later as HTTP wrapper around CLI tool

---

## ⏱ Time Estimate

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| 1. Manual Assessment Script | 1.1-1.10 | 2 hours |
| 2. Output Formatting | 2.1-2.8 | 1 hour |
| 3. Session Management | 3.1-3.8 | 1 hour |
| 4. Integration | 4.1-4.4 | 30 min |
| 5. Testing & Docs | 5.1-5.12 | 1 hour |
| **TOTAL** | **37 tasks** | **5.5 hours** |

**Realistic completion:** Half day of focused work

---

## Deliverables

### New Files
1. `/advertiser-agent/peggy-assess.js` - Manual assessment CLI tool
2. `/advertiser-agent/lib/formatter.js` - Terminal output formatting
3. `/advertiser-agent/lib/session-manager.js` - Session tracking
4. `/advertiser-agent/sessions/` - Directory for session JSON files (gitignored)

### Updated Files
1. `/advertiser-agent/package.json` - Add new npm scripts and dependencies
2. `/advertiser-agent/README.md` - Document manual trigger usage
3. `/advertiser-agent/.gitignore` - Exclude sessions directory

### New npm Commands
- `npm run assess` - Manual assessment (preview mode)
- `npm run assess -- --auto-fund` - Assess and fund
- `npm run assess -- --offer-id <id>` - Assess specific offer
- `npm run sessions` - List past assessment sessions

---

## Getting Started

### Prerequisites (Already Have)
- Peggy fully implemented (`peggy.js` + lib modules)
- Database connection working (Supabase)
- Venice AI integration working
- Solana escrow funding working
- Test data seed script working

### Step 1: Install New Dependencies
```bash
cd /Users/jmd/nosync/org.payattn.main/advertiser-agent
npm install chalk cli-table3 inquirer ora
```

### Step 2: Start Implementation
Begin with Phase 1, Task 1.1 (create `peggy-assess.js`)

---

## ❓ Questions to Clarify Before Implementation

1. **Session Storage:** JSON files vs database table?
   - Recommendation: Start with JSON files (simpler)
   - Can add database later if needed

2. **Funding Confirmation:** Always prompt, or allow `--yes` flag to skip?
   - Recommendation: Prompt by default, add `--yes` flag for automation

3. **Error Handling:** If one offer fails, continue with others?
   - Recommendation: Yes, log error and continue (like autonomous mode)

4. **Re-assessment:** Allow re-processing already-funded offers with `--force`?
   - Recommendation: Yes, useful for debugging/testing

5. **Campaign Criteria:** Still hardcoded or fetch from database?
   - Recommendation: Keep hardcoded for now (consistent with `peggy.js`)
   - Add TODO for database integration (post-hackathon)

6. **UI Preference:** Rich terminal UI (tables, colors) or simple text?
   - Recommendation: Rich UI (matches Max's visual quality)

---

##  Next Steps

1. **Review this plan** - Confirm approach makes sense for your use case
2. **Clarify questions** - Answer the 6 questions above
3. **Begin Phase 1** - Start with `peggy-assess.js` implementation
4. **Iterate** - Test frequently, adjust based on UX feedback

---

## Success Criteria

Peggy manual trigger is complete when:
- [ ] User can run `npm run assess` to see all pending offers
- [ ] Each offer shows LLM decision + reasoning (like Max)
- [ ] User can preview decisions before funding
- [ ] User can auto-fund with `--auto-fund` flag
- [ ] Sessions are saved for history/debugging
- [ ] Output is clear and well-formatted (tables, colors)
- [ ] Works alongside autonomous `peggy.js` without conflicts
- [ ] Documented in README with examples
- [ ] Tested with real offers from database

---

**Ready to discuss and refine this approach?** Let me know if you'd like to proceed with this plan or if you'd prefer a different direction!
