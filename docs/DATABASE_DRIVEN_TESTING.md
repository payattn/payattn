# Database-Driven Testing Implementation

## Overview
Successfully implemented database-driven testing infrastructure to replace dummy JavaScript files with real PostgreSQL database queries. This provides production parity and easier debugging.

## What Was Built

### 1. Database Infrastructure 

**File:** `/backend/db/migrations/create_test_ad_creative.sql`

Created `test_ad_creative` table as exact duplicate of `ad_creative`:
- Same schema (UUID primary keys, JSONB targeting, etc.)
- Same indexes for performance
- Same constraints and checks
- NO foreign key to campaigns (allows flexible testing)

**File:** `/backend/db/seed-test-ads.js`

Seeding script with 12 realistic test ads:
- 10 high-quality ads (crypto, football, Tesla, Nike, VPN, travel, investing, gaming, fitness, meal delivery)
- 2 low-quality ads (scammy crypto, irrelevant baby products)
- Variety of targeting criteria to test Max's decision logic
- Realistic pricing ($0.008 - $0.048 per impression)

**Usage:**
```bash
# Run migration to create table
psql -d your_database < backend/db/migrations/create_test_ad_creative.sql

# Seed test data
cd backend
node db/seed-test-ads.js
```

### 2. Backend Table Switching 

**File:** `/backend/app/api/user/adstream/route.ts`

Modified to automatically switch between tables based on DATABASE_MODE:
- **Test Mode:** Uses `test_ad_creative` table (DATABASE_MODE=test)
- **Production Mode:** Uses `ad_creative` table (DATABASE_MODE=production)
- Simple environment variable configuration

```typescript
const databaseMode = process.env.DATABASE_MODE || 'production';
const tableName = databaseMode === 'test' ? 'test_ad_creative' : 'ad_creative';
```

### 3. Modular Assessment Logic 

**File:** `/extension/lib/max-assessor.js`

Created standalone assessment module with:
- `assessAds(ads, userProfile, options)` - Main entry point
- `assessSingleAd(campaign, userProfile, options)` - Individual ad assessment
- Venice AI integration with tool calling
- ZK-proof generation (placeholders for now)
- Offer submission to backend
- Profile decryption utilities
- Works in BOTH browser window AND service worker contexts

**Key Features:**
- Exports via `window.MaxAssessor` for ad-queue.js
- Exports via `self.MaxAssessor` for background.js
- Consistent assessment logic across manual and automated triggers
- Configurable (model, temperature, autoSubmit)

### 4. Updated UI Integration 

**File:** `/extension/ad-queue.html`
- Added `<script src="lib/max-assessor.js"></script>` import

**File:** `/extension/ad-queue.js`
- Replaced `assessCampaign()` with wrapper that calls `window.MaxAssessor.assessSingleAd()`
- Maintains backward compatibility with existing UI
- Still uses existing helper functions (submitOfferToBackend, generateProofsForOffer)

### 5. Updated Background Worker 

**File:** `/extension/background.js`

**Import:**
```javascript
importScripts('lib/max-assessor.js');
```

**Updated `evaluateAdQueue()`:**
- Now decrypts user profile (was using plaintext before)
- Calls `self.MaxAssessor.assessAds()` for consistent assessment
- Automatically submits offers to backend
- Saves complete session with assessment results

**Updated `syncNewAds()`:**
- Moved timestamp update to **START** of run (not end)
- Added 60-second buffer: `Date.now() - 60000`
- Prevents missing ads if Max takes a few minutes to complete
- Updates `payattn_last_ad_sync` before fetching (not after)

### 6. Timestamp Fix 

**Problem:** Timestamp was updated at END of run, could miss ads created during Max's evaluation.

**Solution:** Update timestamp at START with 60-second buffer:
```javascript
const syncStartTime = new Date(Date.now() - 60000).toISOString();
```

This ensures we don't miss any ads, even if Max takes 2-3 minutes to run.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                       │
│                                                              │
│  ┌──────────────────┐              ┌──────────────────┐    │
│  │  ad_creative     │              │ test_ad_creative │    │
│  │  (production)    │              │  (development)   │    │
│  └──────────────────┘              └──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ API Call
                          ▼
            ┌─────────────────────────────┐
            │   Backend API (Next.js)      │
            │                              │
            │  /api/user/adstream          │
            │  - Checks NODE_ENV           │
            │  - Returns test/prod ads     │
            └─────────────────────────────┘
                          │
                          │ Fetch Ads
                          ▼
      ┌────────────────────────────────────────────┐
      │       Chrome Extension (Service Worker)     │
      │                                            │
      │  background.js                             │
      │  ├─ 30-min Chrome Alarms                   │
      │  ├─ syncNewAds() - Fetch + update timestamp│
      │  └─ evaluateAdQueue() - Assess with Max    │
      │                                            │
      │  lib/max-assessor.js (shared module)      │
      │  ├─ assessAds() - Main logic              │
      │  ├─ assessSingleAd() - Per-ad logic       │
      │  ├─ Venice AI integration                 │
      │  ├─ ZK-proof generation                   │
      │  └─ Offer submission                      │
      └────────────────────────────────────────────┘
                          │
                          │ Also used by
                          ▼
      ┌────────────────────────────────────────────┐
      │       Extension UI (Browser Page)          │
      │                                            │
      │  ad-queue.html                            │
      │  ├─ Manual "Fetch & Assess" button       │
      │  └─ Real-time assessment display         │
      │                                            │
      │  ad-queue.js                              │
      │  └─ assessCampaign() wrapper              │
      │     └─ Calls window.MaxAssessor           │
      └────────────────────────────────────────────┘
```

## Testing Workflow

### 1. Setup (One Time)

```bash
# Create test_ad_creative table
psql -d payattn_db < backend/db/migrations/create_test_ad_creative.sql

# Seed test data
cd backend
node db/seed-test-ads.js

# Verify NODE_ENV is set to "development"
# In backend/.env.local:
NODE_ENV=development
```

### 2. Manual Testing (UI)

1. Open extension: `chrome-extension://.../ad-queue.html`
2. Click "🤖 Fetch & Assess New Ads"
3. Watch Max evaluate test ads in real-time
4. Check offers submitted to backend
5. Verify Peggy can see offers in advertiser portal

### 3. Automated Testing (Background)

1. Install extension in Chrome
2. Wait for next 30-minute alarm (or trigger manually via DevTools)
3. Check console logs: `chrome://extensions` → PayAttn → "Service Worker"
4. Verify:
   - Ads fetched from test_ad_creative
   - Max assessment runs automatically
   - Offers submitted to backend
   - Timestamp updated at start (not end)

### 4. Check Backend

```bash
# View offers created by Max
curl http://localhost:3000/api/advertiser/offers/test_adv_coinbase | jq
```

## Key Improvements

### Before (Dummy Data)
- Hardcoded JavaScript arrays
- No UUID support (text IDs only)
- No production parity
- Hard to update test data
- Assessment logic duplicated
- Timestamp updated at END (could miss ads)

### After (Database-Driven)
- Real PostgreSQL queries
- UUID primary keys (matches production)
- Production-identical schema
- Easy to update via SQL or seeding script
- Modular assessment logic (DRY principle)
- Timestamp updated at START with buffer

## Configuration

### Environment Variables

**Backend (`backend/.env.local`):**
```bash
DATABASE_MODE=test        # Use test_ad_creative table
# OR
DATABASE_MODE=production  # Use ad_creative table
```

Copy from the example and edit:
```bash
cp backend/.env.example backend/.env.local
# Edit .env.local and set DATABASE_MODE=test
```

The extension doesn't need any configuration - it calls the backend API directly.

### Extension Settings

Extension uses same config for both manual and automated:
- Venice AI model: `qwen3-next-80b`
- Temperature: `0.7`
- Auto-submit offers: `true`

Configured in `max-assessor.js` defaults.

## File Summary

### Created Files
1. `/backend/db/migrations/create_test_ad_creative.sql` - Table schema
2. `/backend/db/seed-test-ads.js` - Test data seeding
3. `/extension/lib/max-assessor.js` - Modular assessment logic

### Modified Files
1. `/backend/app/api/user/adstream/route.ts` - Added table switching
2. `/extension/ad-queue.html` - Added max-assessor.js import
3. `/extension/ad-queue.js` - Wrapped assessCampaign() to use module
4. `/extension/background.js` - Imported module, updated evaluateAdQueue(), fixed timestamp

## Next Steps

### Testing Phase
- [ ] Run migration to create test_ad_creative table
- [ ] Seed test data with seed-test-ads.js
- [ ] Test manual flow (ad-queue.html UI)
- [ ] Test automated flow (30-min background worker)
- [ ] Verify offers appear in Peggy's dashboard

### Future Enhancements
- [ ] Implement actual ZK-SNARK proof generation (currently placeholders)
- [ ] Add Venice AI API key validation in background worker
- [ ] Implement user notification when background creates offers
- [ ] Add test data for more edge cases (age boundaries, income thresholds)
- [ ] Create admin UI for managing test_ad_creative table

## Troubleshooting

### "Table test_ad_creative does not exist"
Run migration: `psql -d your_db < backend/db/migrations/create_test_ad_creative.sql`

### "MaxAssessor is not defined"
Check that `lib/max-assessor.js` is loaded before ad-queue.js or background.js

### "Venice AI API key not configured"
Set API key in extension settings (settings.html)

### Ads not appearing in UI
1. Check NODE_ENV is "development"
2. Verify test data was seeded
3. Check backend logs for table name being queried
4. Confirm `payattn_last_ad_sync` timestamp allows new ads

### Background worker not running
1. Open `chrome://extensions`
2. Find PayAttn → "Service Worker" → "Inspect"
3. Check console logs for errors
4. Verify Chrome Alarms are set: `chrome.alarms.getAll(console.log)`

## Success Criteria

✅ Database-driven testing replaces dummy-ads.js
✅ Production parity with UUID primary keys
✅ Modular assessment logic (no duplication)
✅ Manual and automated triggers use same logic
✅ Timestamp updated correctly to avoid missing ads
✅ Seeding script provides realistic test data
✅ Automatic table switching via NODE_ENV

---

**Implementation Complete!** 🎉

The system is now ready for end-to-end testing with real database integration.
