# Quick Start: Testing Database-Driven Ad Flow

## Setup (5 minutes)

### 1. Create Test Table

```bash
# From project root
cd backend

# Run migration
psql -U your_username -d your_database_name < db/migrations/create_test_ad_creative.sql

# Or using Supabase CLI:
supabase db push
```

### 2. Seed Test Data

```bash
# Make sure backend environment is configured with Supabase credentials
# The script reads from environment variables

# Option 1: Load .env.local and run
cd backend
export $(cat .env.local | grep -v '^#' | xargs)
node db/seed-test-ads.js

# Option 2: Set variables manually
cd backend
export NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
node db/seed-test-ads.js
```

Expected output:
```
🌱 Seeding test ads into test_ad_creative table...
🗑️  Clearing existing test ads...
📝 Inserting 12 test ads...

✅ Inserted test_crypto_exchange_001 (Trade Bitcoin with Zero Fees)
✅ Inserted test_football_betting_001 (Premier League Betting...)
... (10 more)

✨ Seeding complete!
   Success: 12/12
```

### 3. Configure Environment

**backend/.env.local:**
```bash
DATABASE_MODE=test  # Use test_ad_creative table
# OR
DATABASE_MODE=production  # Use ad_creative table
```

Copy from example:
```bash
cp backend/.env.example backend/.env.local
# Then edit .env.local and set DATABASE_MODE=test
```

### 4. Start Backend

```bash
cd backend
npm run dev
```

Verify backend is using test table:
```bash
# Open another terminal
curl -X POST http://localhost:3000/api/user/adstream \
  -H "Content-Type: application/json" \
  -H "x-user-id: test_user" \
  -d '{"last_checked": "2000-01-01T00:00:00.000Z"}' | jq

# Should return 12 test ads
```

## Testing Manual Flow (UI)

### 1. Load Extension

1. Open Chrome
2. Go to `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select `/extension` folder

### 2. Open Ad Queue UI

```
chrome-extension://YOUR_EXTENSION_ID/ad-queue.html
```

Or click extension icon → "View Ad Queue"

### 3. Run Assessment

1. Click **"🤖 Fetch & Assess New Ads"** button
2. Watch Max evaluate ads in real-time
3. Observe:
   - Status banner shows progress
   - Cards update from grey → amber → green/red
   - Offers submitted to backend (check console)

### 4. Verify Results

**In Browser Console (F12):**
```javascript
// Check last sync time
chrome.storage.local.get(['payattn_last_ad_sync'], console.log)

// Check ad queue
chrome.storage.local.get(['payattn_ad_queue'], console.log)

// Check Max sessions
chrome.storage.local.get(['payattn_max_sessions'], console.log)
```

**In Backend:**
```bash
# Check offers created
curl http://localhost:3000/api/advertiser/offers/test_adv_coinbase | jq
```

## Testing Automated Flow (Background Worker)

### 1. Check Service Worker

1. Go to `chrome://extensions`
2. Find PayAttn extension
3. Click **"Service Worker"** link
4. Opens DevTools for background.js

### 2. Trigger Manual Sync

**In Service Worker Console:**
```javascript
// Trigger ad sync immediately
syncNewAds().then(console.log)

// Check Chrome Alarms
chrome.alarms.getAll(console.log)

// Check next scheduled run
chrome.storage.local.get(['payattn_next_scheduled_run'], (r) => {
  console.log('Next run:', new Date(r.payattn_next_scheduled_run))
})
```

### 3. Observe Logs

Look for:
```
[AdSync] Starting ad sync...
[AdSync] Last checked: 2024-11-09T...
[AdSync] Querying table: test_ad_creative (DATABASE_MODE=test)
[AdSync] Received 12 new ads
[Max] Decrypting user profile...
[Max] Profile decrypted. Evaluating 12 ads...
[Max] Assessing campaign: test_crypto_exchange_001
[Max] Tool calls detected: 1
[Max] Generating ZK proofs...
[Offer Submission] Submitting offer to backend...
✅ [Offer Submission] Success! Offer ID: offer_xxx
[Max] Evaluation complete: 8 offers created from 12 ads
```

### 4. Wait for Automatic Run

Background worker runs every **30 minutes** automatically.

Check when next run is scheduled:
```javascript
chrome.storage.local.get(['payattn_next_scheduled_run'], (r) => {
  const nextRun = new Date(r.payattn_next_scheduled_run);
  const now = new Date();
  const minsUntil = (nextRun - now) / 1000 / 60;
  console.log(`Next automatic run in ${minsUntil.toFixed(1)} minutes`);
})
```

## Verify End-to-End Flow

### 1. Check Offers Table

```bash
# In backend directory
psql -U your_username -d your_database_name

SELECT 
  offer_id,
  ad_id,
  amount_lamports,
  status,
  created_at
FROM offers
WHERE ad_id LIKE 'test_%'
ORDER BY created_at DESC
LIMIT 10;
```

### 2. Test Peggy Integration

```bash
# Check if Peggy can see offers
cd advertiser-agent
node peggy.js

# Peggy should:
# - Poll offers table
# - Find test offers
# - Evaluate and accept/reject
# - Fund escrow accounts for accepted offers
```

### 3. Check Max Sessions

**In Extension Console:**
```javascript
chrome.storage.local.get(['payattn_max_sessions'], (result) => {
  const sessions = result.payattn_max_sessions || [];
  console.log(`Total sessions: ${sessions.length}`);
  
  sessions.forEach(session => {
    const offers = session.ads.filter(a => a.assessment.decision === 'MAKING OFFER').length;
    const rejects = session.ads.filter(a => a.assessment.decision === 'REJECT').length;
    console.log(`${session.triggerType} @ ${session.timestamp}: ${offers} offers, ${rejects} rejects`);
  });
});
```

## Expected Results

### Good Ads (Should be OFFERED)
- ✅ test_crypto_exchange_001 (Crypto + good targeting)
- ✅ test_football_betting_001 (Football + UK targeting)
- ✅ test_electric_car_001 (Tesla + high income)
- ✅ test_vpn_security_001 (Tech + privacy)
- ✅ test_gaming_console_001 (Gaming interest)
- ✅ test_investment_app_001 (Investing + UK)

### Bad Ads (Should be REJECTED)
- ❌ test_scammy_crypto_001 (Low quality, suspicious)
- ❌ test_irrelevant_baby_001 (Wrong interests - parenting)
- ❌ Some others depending on user profile

### Typical Max Session Result
```
Total Ads Reviewed: 12
Offers Made: 7-9 (depends on profile match)
Rejected: 3-5
Average Offer Price: $0.025 - $0.035
```

## Troubleshooting

### No ads returned from API
```bash
# Check backend is using test table
# Look for log line: "Querying table: test_ad_creative (DATABASE_MODE=test)"

# Verify data exists
psql -U user -d db -c "SELECT COUNT(*) FROM test_ad_creative;"
```

### Venice AI errors
```javascript
// Check API key is configured
chrome.storage.local.get(['payattn_venice_api_key'], console.log)

// Should return: { payattn_venice_api_key: "your-key" }
```

### Timestamp not updating
```javascript
// Check timestamp logic in background.js line ~700
// Should update at START with -60s buffer

chrome.storage.local.get(['payattn_last_ad_sync'], (r) => {
  console.log('Last sync:', r.payattn_last_ad_sync);
  console.log('Age:', Date.now() - new Date(r.payattn_last_ad_sync).getTime(), 'ms');
})
```

### Background worker not running
```javascript
// Check alarms are set
chrome.alarms.getAll(alarms => {
  console.log('Active alarms:', alarms);
  // Should include: payattn-poll (every 60 seconds)
})
```

## Success Checklist

- [ ] Migration created test_ad_creative table
- [ ] Seeding script inserted 12 test ads
- [ ] Backend returns test ads when DATABASE_MODE=test
- [ ] Manual UI flow fetches and assesses ads
- [ ] Offers appear in backend database
- [ ] Background worker syncs every 30 minutes
- [ ] Timestamp updated at start (not end)
- [ ] Max sessions saved to chrome.storage
- [ ] Peggy can see and process offers

---

**Ready to test!** 🚀

For detailed architecture, see [DATABASE_DRIVEN_TESTING.md](./DATABASE_DRIVEN_TESTING.md)
