# Publisher SDK Development Tasks

**Created:** November 9, 2025  
**Updated:** November 9, 2025 (Architecture Finalized)  
**Status:** ✅ READY TO BUILD  
**Priority:** CRITICAL PATH

---

## 🎯 ARCHITECTURE DECISIONS (FINALIZED)

All design questions have been resolved. This document captures the complete architecture and implementation plan.

---

## 📐 CORE ARCHITECTURE

### The Atomic Unit: ad_creative

**Key Insight:** Max evaluates individual **ad_creatives**, NOT campaigns.

```
Flow: Advertiser → ad_creative (with targeting) → Max evaluates → Offer (ad_creative + user) → Peggy funds → Settlement
```

**NOT:** ~~Advertiser → Campaign → Campaign has ads → Max evaluates campaign~~

### Three Core Tables

1. **ad_creative** - The atomic unit Max evaluates
   - Contains: headline, body, CTA, destination URL
   - Contains: targeting criteria (age, location, income, interests)
   - Contains: budget per impression
   - Contains: stats (impressions_count, clicks_count)
   - Max evaluates EACH ad_creative individually

2. **offers** - Max's decision for specific user + ad_creative
   - Links: `ad_creative_id` + `user_id`
   - Contains: `amount_lamports`, `status`, `escrow_pda`
   - Status flow: `offer_made` → `funded` → `settled`

3. **campaigns** (optional) - Organizational grouping only
   - For advertiser reporting/management
   - Multiple ad_creatives can belong to one campaign
   - Max does NOT evaluate campaigns (evaluates individual ads)

---

## 🔄 COMPLETE END-TO-END FLOW

### Phase 1: Ad Creation (Advertiser)

```
1. Advertiser logs into /advertisers/create-campaign
2. Fills form:
   - Campaign name (optional grouping)
   - Ad headline, body, CTA, destination URL
   - Targeting: age range, interests (max 8), income, location (countries)
   - Budget per impression (lamports)
3. Submit → POST /api/advertiser/create-ad
4. Backend creates ad_creative record in database
   - ad_creative_id: 'ad_rolex_crypto_001'
   - targeting: JSONB with criteria
   - status: 'active'
   - created_at: NOW()
```

### Phase 2: Extension Sync (User)

```
1. Extension runs periodic sync (every hour or on-demand)
2. Tracks last_checked timestamp in chrome.storage.local
3. GET /api/user/adstream
   Headers: { 'x-user-id': 'user_123' }
   Body: { last_checked: '2025-11-09T10:00:00Z' }
4. Backend queries:
   SELECT * FROM ad_creative 
   WHERE created_at > last_checked 
   AND status = 'active'
5. Returns NEW ad_creatives since last check
6. Extension stores in local queue
7. Extension updates last_checked timestamp
```

### Phase 3: Max Evaluation (Client-Side)

```
1. Max (running in extension) evaluates each new ad_creative
2. For each ad:
   - Loads user profile from chrome.storage.local (age, interests, income, location)
   - Checks targeting criteria against user profile
   - Determines which ZK-proofs are required
   - Generates ZK-proofs (age range, interests, income, location)
   - Decides: ACCEPT or REJECT
3. If ACCEPTED:
   - POST /api/user/offer
     Headers: { 'x-user-id': 'user_123' }
     Body: {
       ad_creative_id: 'uuid',
       amount_lamports: 10000,
       zk_proofs: {
         age_proof: { proof: {...}, publicSignals: [...] },
         interests_proof: { proof: {...}, publicSignals: [...] },
         income_proof: { proof: {...}, publicSignals: [...] },
         location_proof: { proof: {...}, publicSignals: [...] }
       }
     }
   - Backend validates ZK-proofs
   - Backend creates offer record (status: 'offer_made')
4. If REJECTED:
   - Log reason (for user transparency)
   - No offer created
```

### Phase 4: Escrow Funding (Peggy)

```
1. Peggy (advertiser agent) runs periodically
2. Queries: SELECT * FROM offers WHERE status = 'offer_made'
3. For each offer:
   - Validates offer details
   - Creates escrow PDA on Solana
   - Funds escrow from advertiser wallet
   - Updates offer: status = 'funded', escrow_pda = '...', escrow_tx_signature = '...'
4. Funded offers are now ready for publisher display
```

### Phase 5: Publisher SDK Integration (Publisher Website)

```
1. Publisher includes SDK on their website:
   <script src="http://localhost:3000/publishers/v1/sdk.js" 
           data-publisher-id="8k3m9x2p"></script>
   <div id="payattn-ad-slot"></div>

2. SDK initializes:
   - Reads publisher_id from data attribute
   - Sends postMessage to extension (via content script)
   - Message: { type: 'PAYATTN_REQUEST_AD', publisher_id: '8k3m9x2p' }

3. Extension receives request:
   - Queries funded offers from chrome.storage.local
   - Filters: status = 'funded'
   - Selects ad using FIFO (oldest funded offer first)
   - Responds via postMessage with ad_creative data:
     {
       type: 'PAYATTN_AD_RESPONSE',
       offer_id: 'offer_abc',
       ad: {
         headline: 'Get 20% off luxury watches',
         body: 'Swiss craftsmanship...',
         cta: 'Shop Now',
         destination_url: 'https://rolex.com/...'
       }
     }

4. SDK receives ad data:
   - Renders ad in publisher's div (publisher styles it)
   - Starts impression tracking (Intersection Observer)
   - Tracks visibility: must be on-screen for 1+ seconds
```

### Phase 6: Impression Tracking & Settlement

```
1. SDK monitors ad visibility (Intersection Observer)
2. When ad is visible for 1+ continuous second:
   - SDK reports: POST /api/publisher/impressions
     Body: {
       offer_id: 'offer_abc',
       publisher_id: '8k3m9x2p',
       duration: 1234 (milliseconds on screen)
     }
3. Backend validates and processes:
   - Finds offer by offer_id
   - Verifies status = 'funded'
   - Increments: ad_creative.impressions_count += 1
   - Triggers settlement: settleWithPrivacy()
4. Settlement executes:
   - 3 separate Solana transactions (privacy-preserving)
   - TX1: Platform → User (70%)
   - TX2: Platform → Publisher (25%)
   - TX3: Platform → Platform (5%)
   - Random order + delays (0-5s between)
5. Settlement completes:
   - Updates offer: status = 'settled', settled_at = NOW()
   - Returns transaction signatures to SDK
6. SDK logs results (optional):
   - Console: "✅ Settlement completed: 0.007 SOL to user"
   - Shows Solana Explorer links
```

### Phase 7: Click Tracking (Optional)

```
1. If user clicks ad:
   - SDK intercepts click
   - POST /api/publisher/clicks
     Body: { offer_id: 'offer_abc', publisher_id: '8k3m9x2p' }
   - Backend increments: ad_creative.clicks_count += 1
   - Redirects user to destination_url
2. Note: Clicks do NOT trigger payment (only impressions 1+ second)
3. Click data used for advertiser reporting only
```

---

## 🗄️ DATABASE SCHEMA

### New Tables

```sql
-- 1. ad_creative (core table)
CREATE TABLE ad_creative (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_creative_id VARCHAR UNIQUE NOT NULL,
  advertiser_id VARCHAR NOT NULL REFERENCES advertisers(advertiser_id),
  campaign_id VARCHAR REFERENCES campaigns(campaign_id), -- optional grouping
  
  -- Creative content
  type VARCHAR NOT NULL DEFAULT 'text', -- text, image, video (future)
  headline VARCHAR(100) NOT NULL,
  body TEXT,
  cta VARCHAR(30),
  destination_url TEXT NOT NULL,
  image_url TEXT, -- future
  video_url TEXT, -- future
  
  -- Targeting criteria (what Max evaluates)
  targeting JSONB NOT NULL,
  -- Example:
  -- {
  --   "age": {"min": 25, "max": 45},
  --   "location": {"countries": ["GB", "DE", "FR"]},
  --   "income": {"min": 50000},
  --   "interests": [
  --     {"category": "cryptocurrency", "weight": "required"},
  --     {"category": "luxury", "weight": "preferred"}
  --   ],
  --   "gender": ["any"],
  --   "employment": {"status": ["employed", "self-employed"]}
  -- }
  
  -- Budget
  budget_per_impression_lamports BIGINT NOT NULL,
  total_budget_lamports BIGINT,
  spent_lamports BIGINT DEFAULT 0,
  
  -- Stats (privacy-preserving counters only)
  impressions_count INT DEFAULT 0,
  clicks_count INT DEFAULT 0,
  
  -- Status
  status VARCHAR DEFAULT 'active', -- active, paused, completed
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_budget CHECK (budget_per_impression_lamports > 0)
);

CREATE INDEX idx_ad_creative_created_at ON ad_creative(created_at);
CREATE INDEX idx_ad_creative_status ON ad_creative(status);
CREATE INDEX idx_ad_creative_advertiser ON ad_creative(advertiser_id);

-- 2. campaigns (optional, for advertiser grouping)
CREATE TABLE campaigns (
  id SERIAL PRIMARY KEY,
  campaign_id VARCHAR UNIQUE NOT NULL,
  advertiser_id VARCHAR NOT NULL REFERENCES advertisers(advertiser_id),
  name VARCHAR NOT NULL,
  description TEXT,
  total_budget_lamports BIGINT,
  status VARCHAR DEFAULT 'active', -- active, paused, completed
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_campaigns_advertiser ON campaigns(advertiser_id);
```

### Updated Tables

```sql
-- Update offers table to reference ad_creative
ALTER TABLE offers 
  DROP COLUMN ad_id,
  ADD COLUMN ad_creative_id UUID REFERENCES ad_creative(id),
  ADD COLUMN zk_proofs JSONB; -- Store ZK-proof data

-- Example zk_proofs structure:
-- {
--   "age": {
--     "proof": {...},
--     "publicSignals": ["1", "25", "45"],
--     "circuitName": "age_range"
--   },
--   "interests": {...},
--   "income": {...},
--   "location": {...}
-- }

CREATE INDEX idx_offers_ad_creative ON offers(ad_creative_id);
CREATE INDEX idx_offers_status ON offers(status);
```

---

## 🔌 API ENDPOINTS

### 1. GET /api/user/adstream

**Purpose:** Extension fetches new ad_creatives for Max to evaluate

**Request:**
```javascript
GET /api/user/adstream
Headers: {
  'x-user-id': 'user_123'
}
Body: {
  last_checked: '2025-11-09T10:00:00Z' // ISO timestamp
}
```

**Backend Logic:**
```typescript
// /backend/app/api/user/adstream/route.ts
export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id');
  const { last_checked } = await request.json();
  
  // Query new ads
  const { data: ads } = await supabase
    .from('ad_creative')
    .select('*')
    .eq('status', 'active')
    .gt('created_at', last_checked)
    .order('created_at', { ascending: true });
  
  return Response.json({
    ads,
    server_time: new Date().toISOString()
  });
}
```

**Response:**
```json
{
  "ads": [
    {
      "id": "uuid",
      "ad_creative_id": "ad_rolex_001",
      "advertiser_id": "adv_rolex",
      "headline": "Get 20% off luxury watches",
      "body": "Swiss craftsmanship...",
      "cta": "Shop Now",
      "destination_url": "https://rolex.com/...",
      "targeting": {
        "age": {"min": 25, "max": 45},
        "interests": [{"category": "cryptocurrency", "weight": "required"}],
        "income": {"min": 50000},
        "location": {"countries": ["GB", "DE"]}
      },
      "budget_per_impression_lamports": 10000,
      "impressions_count": 42,
      "clicks_count": 5,
      "created_at": "2025-11-09T11:00:00Z"
    }
  ],
  "server_time": "2025-11-09T12:00:00Z"
}
```

---

### 2. POST /api/user/offer

**Purpose:** Max (client-side) creates offer after approving ad + generating ZK-proofs

**Request:**
```javascript
POST /api/user/offer
Headers: {
  'x-user-id': 'user_123'
}
Body: {
  ad_creative_id: 'uuid-here',
  amount_lamports: 10000,
  zk_proofs: {
    age: {
      proof: { pi_a: [...], pi_b: [...], pi_c: [...] },
      publicSignals: ["1", "25", "45"],
      circuitName: "age_range"
    },
    interests: {
      proof: {...},
      publicSignals: [...],
      circuitName: "set_membership"
    },
    income: {
      proof: {...},
      publicSignals: ["1", "50000", "100000"],
      circuitName: "range_check"
    },
    location: {
      proof: {...},
      publicSignals: [...],
      circuitName: "set_membership"
    }
  }
}
```

**Backend Logic:**
```typescript
// /backend/app/api/user/offer/route.ts
export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id');
  const { ad_creative_id, amount_lamports, zk_proofs } = await request.json();
  
  // 1. Validate ZK-proofs
  for (const [proofType, proofData] of Object.entries(zk_proofs)) {
    const isValid = await verifyProof(
      proofData.circuitName,
      proofData.proof,
      proofData.publicSignals
    );
    if (!isValid) {
      return Response.json(
        { error: `Invalid ${proofType} proof` },
        { status: 400 }
      );
    }
  }
  
  // 2. Get ad_creative details
  const { data: ad } = await supabase
    .from('ad_creative')
    .select('*')
    .eq('id', ad_creative_id)
    .single();
  
  // 3. Get user pubkey
  const { data: user } = await supabase
    .from('users')
    .select('wallet_pubkey')
    .eq('user_id', userId)
    .single();
  
  // 4. Create offer
  const offerId = `offer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const { data: offer } = await supabase
    .from('offers')
    .insert({
      offer_id: offerId,
      advertiser_id: ad.advertiser_id,
      user_id: userId,
      user_pubkey: user.wallet_pubkey,
      ad_creative_id: ad_creative_id,
      amount_lamports: amount_lamports,
      status: 'offer_made',
      zk_proofs: zk_proofs
    })
    .select()
    .single();
  
  return Response.json({
    success: true,
    offer_id: offerId,
    status: 'offer_made',
    message: 'Offer created, waiting for Peggy to fund escrow'
  });
}
```

**Response:**
```json
{
  "success": true,
  "offer_id": "offer_1731153600000_abc123",
  "status": "offer_made",
  "message": "Offer created, waiting for Peggy to fund escrow"
}
```

---

### 3. POST /api/advertiser/create-ad

**Purpose:** Advertiser creates new ad_creative

**Request:**
```javascript
POST /api/advertiser/create-ad
Headers: {
  'x-advertiser-id': 'adv_rolex'
}
Body: {
  campaign_id: 'camp_luxury_001', // optional
  campaign_name: 'Luxury Watch Campaign Q4', // if creating new campaign
  headline: 'Get 20% off luxury watches',
  body: 'Swiss craftsmanship, lifetime warranty. Limited time offer.',
  cta: 'Shop Now',
  destination_url: 'https://rolex.com/campaign?utm_source=payattn',
  targeting: {
    age: { min: 25, max: 45 },
    interests: [
      { category: 'cryptocurrency', weight: 'required' },
      { category: 'luxury', weight: 'preferred' }
    ],
    income: { min: 50000 },
    location: { countries: ['GB', 'DE', 'FR'] }
  },
  budget_per_impression_lamports: 10000,
  total_budget_lamports: 1000000
}
```

**Backend Logic:**
```typescript
// /backend/app/api/advertiser/create-ad/route.ts
export async function POST(request: Request) {
  const advertiserId = request.headers.get('x-advertiser-id');
  const body = await request.json();
  
  // 1. Create campaign if needed
  let campaignId = body.campaign_id;
  if (!campaignId && body.campaign_name) {
    campaignId = `camp_${Date.now()}`;
    await supabase.from('campaigns').insert({
      campaign_id: campaignId,
      advertiser_id: advertiserId,
      name: body.campaign_name,
      total_budget_lamports: body.total_budget_lamports,
      status: 'active'
    });
  }
  
  // 2. Create ad_creative
  const adCreativeId = `ad_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const { data: ad } = await supabase
    .from('ad_creative')
    .insert({
      ad_creative_id: adCreativeId,
      advertiser_id: advertiserId,
      campaign_id: campaignId,
      type: 'text',
      headline: body.headline,
      body: body.body,
      cta: body.cta,
      destination_url: body.destination_url,
      targeting: body.targeting,
      budget_per_impression_lamports: body.budget_per_impression_lamports,
      total_budget_lamports: body.total_budget_lamports,
      status: 'active'
    })
    .select()
    .single();
  
  return Response.json({
    success: true,
    ad_creative_id: adCreativeId,
    message: 'Ad created successfully. Max will evaluate and make offers to matching users.'
  });
}
```

**Response:**
```json
{
  "success": true,
  "ad_creative_id": "ad_1731153600000_xyz789",
  "message": "Ad created successfully. Max will evaluate and make offers to matching users."
}
```

---

### 4. GET /api/advertiser/ads

**Purpose:** List all ads for advertiser (for dashboard)

**Request:**
```javascript
GET /api/advertiser/ads?campaign_id=camp_luxury_001
Headers: {
  'x-advertiser-id': 'adv_rolex'
}
```

**Response:**
```json
{
  "ads": [
    {
      "ad_creative_id": "ad_001",
      "headline": "Get 20% off luxury watches",
      "status": "active",
      "impressions_count": 142,
      "clicks_count": 23,
      "spent_lamports": 1420000,
      "created_at": "2025-11-09T10:00:00Z"
    }
  ]
}
```

---

### 5. POST /api/publisher/impressions (✅ EXISTING - FULLY FUNCTIONAL)

**Purpose:** SDK reports ad impression and triggers settlement

**Status:** ✅ **This endpoint already exists and is fully functional.** It calls `settleWithPrivacy()` which handles 3 privacy-preserving Solana transactions (70/25/5 split). **No changes needed to settlement logic.**

**Request:**
```javascript
POST /api/publisher/impressions
Body: {
  offer_id: 'offer_abc',
  publisher_id: '8k3m9x2p',
  duration: 1234 // milliseconds
}
```

**What It Currently Does:**
1. Validates duration >= 1000ms
2. Looks up offer (must be status='funded')
3. Looks up publisher wallet
4. Calls `settleWithPrivacy()` which:
   - Marks offer as settling
   - Calculates splits (70% user, 25% publisher, 5% platform)
   - Submits 3 separate Solana transactions in random order with random delays
   - Updates offer status to 'settled'
   - Failed transactions go to settlement_queue for retry

**ONLY CHANGE NEEDED:** Add counter increment for ad_creative

```typescript
// ADD THIS to existing /backend/app/api/publisher/impressions/route.ts
// After fetching offer, before calling settleWithPrivacy():

// Increment impression counter (NEW)
const { data: adCreative } = await supabase
  .from('ad_creative')
  .select('impressions_count')
  .eq('id', offer.ad_creative_id)
  .single();

await supabase
  .from('ad_creative')
  .update({ 
    impressions_count: (adCreative?.impressions_count || 0) + 1 
  })
  .eq('id', offer.ad_creative_id);

// Rest of existing code (settleWithPrivacy call) remains unchanged
```

**Current Response Format:**
```json
{
  "settled": true,
  "offerId": "offer_abc",
  "duration": 1234,
  "transactions": [
    {
      "type": "user",
      "success": true,
      "txSignature": "5XYZ...",
      "amount": 7000,
      "explorerUrl": "https://explorer.solana.com/tx/5XYZ...?cluster=devnet"
    },
    {
      "type": "publisher",
      "success": true,
      "txSignature": "6ABC...",
      "amount": 2500,
      "explorerUrl": "https://explorer.solana.com/tx/6ABC...?cluster=devnet"
    },
    {
      "type": "platform",
      "success": true,
      "txSignature": "7DEF...",
      "amount": 500,
      "explorerUrl": "https://explorer.solana.com/tx/7DEF...?cluster=devnet"
    }
  ],
  "message": "Payment sent to all parties"
}
```

---

### 6. POST /api/publisher/clicks (NEW)

**Purpose:** SDK reports ad click

**Request:**
```javascript
POST /api/publisher/clicks
Body: {
  offer_id: 'offer_abc',
  publisher_id: '8k3m9x2p'
}
```

**Backend Logic:**
```typescript
// /backend/app/api/publisher/clicks/route.ts
export async function POST(request: Request) {
  const { offerId, publisherId } = await request.json();
  
  const { data: offer } = await supabase
    .from('offers')
    .select('ad_creative_id')
    .eq('offer_id', offerId)
    .single();
  
  if (offer) {
    await supabase.rpc('increment_clicks', {
      ad_id: offer.ad_creative_id
    });
  }
  
  return Response.json({ success: true });
}
```

---

## 🎨 FRONTEND PAGES

### 1. /backend/app/advertisers/create-campaign/page.tsx

**Purpose:** Advertiser creates new ad

**Features:**
- Campaign selection (optional, dropdown of existing campaigns)
- Or create new campaign
- Ad creative form:
  - Headline (max 100 chars)
  - Body (textarea, max 500 chars)
  - CTA button text (max 30 chars)
  - Destination URL
- Targeting criteria:
  - Age range (sliders: min/max)
  - Interests (multi-select, max 8)
  - Income (dropdown ranges)
  - Location (multi-select countries)
- Budget:
  - Per impression (lamports)
  - Total budget (lamports)
- Preview section (shows what ad will look like)
- Submit button

**Hardcoded:** `advertiser_id = 'adv_rolex'` (for demo)

---

### 2. /backend/app/publishers/page.tsx (UPDATE)

**Purpose:** Publisher portal with SDK snippet

**Update SDK snippet to:**
```html
<script src="http://localhost:3000/publishers/v1/sdk.js" 
        data-publisher-id="8k3m9x2p"></script>
<div id="payattn-ad-slot"></div>
```

**Hardcoded:** `publisher_id = '8k3m9x2p'` (for demo)

---

### 3. /backend/app/advertisers/page.tsx (UPDATE)

**Purpose:** Add link to create campaign page

**Add button:**
```html
<a href="/advertisers/create-campaign" class="btn-primary">
  Create New Ad Campaign
</a>
```

---

## 📦 PUBLISHER SDK

### File: /backend/public/publishers/v1/sdk.js

**Purpose:** Client-side JavaScript for publisher websites

**Features:**

1. **Initialization:**
```javascript
(function() {
  const publisherId = document.currentScript.getAttribute('data-publisher-id');
  
  window.PayAttn = {
    publisherId,
    requestAd: function() { /* ... */ },
    trackImpression: function(offerId, element) { /* ... */ }
  };
})();
```

2. **Ad Request (via postMessage):**
```javascript
requestAd: function() {
  return new Promise((resolve, reject) => {
    const messageId = Math.random().toString(36);
    
    // Listen for response
    window.addEventListener('message', function handler(event) {
      if (event.data.type === 'PAYATTN_AD_RESPONSE' && 
          event.data.messageId === messageId) {
        window.removeEventListener('message', handler);
        resolve(event.data.ad);
      }
    });
    
    // Send request to extension
    window.postMessage({
      type: 'PAYATTN_REQUEST_AD',
      messageId: messageId,
      publisher_id: this.publisherId
    }, '*');
    
    // Timeout after 5 seconds
    setTimeout(() => reject(new Error('Timeout')), 5000);
  });
}
```

3. **Impression Tracking (Intersection Observer):**
```javascript
trackImpression: function(offerId, element) {
  let startTime = null;
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Ad became visible
        startTime = Date.now();
      } else if (startTime) {
        // Ad became invisible
        const duration = Date.now() - startTime;
        if (duration >= 1000) {
          // Trigger impression report
          this.reportImpression(offerId, duration);
        }
        startTime = null;
      }
    });
  }, { threshold: 0.5 }); // 50% visible
  
  observer.observe(element);
}
```

4. **Report Impression:**
```javascript
reportImpression: async function(offerId, duration) {
  const response = await fetch('http://localhost:3000/api/publisher/impressions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      offer_id: offerId,
      publisher_id: this.publisherId,
      duration: duration
    })
  });
  
  const result = await response.json();
  
  if (result.settled) {
    console.log('✅ PayAttn: Settlement completed');
    result.transactions.forEach(tx => {
      console.log(`${tx.recipient}: ${tx.amount / 1e9} SOL`);
      console.log(`View: https://explorer.solana.com/tx/${tx.txSignature}?cluster=devnet`);
    });
  }
}
```

5. **Click Tracking:**
```javascript
trackClick: async function(offerId) {
  await fetch('http://localhost:3000/api/publisher/clicks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      offer_id: offerId,
      publisher_id: this.publisherId
    })
  });
}
```

---

## 🔧 EXTENSION UPDATES

### 1. Ad Sync (background.js)

```javascript
// Set up periodic alarm for ad sync (every hour)
chrome.alarms.create('adSync', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'adSync') {
    await syncNewAds();
  }
});

async function syncNewAds() {
  // Get last_checked timestamp
  const { last_checked, user_id } = await chrome.storage.local.get([
    'last_checked',
    'payattn_userId'
  ]);
  
  // Fetch new ads
  const response = await fetch('http://localhost:3000/api/user/adstream', {
    method: 'GET',
    headers: {
      'x-user-id': user_id,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      last_checked: last_checked || '2020-01-01T00:00:00Z'
    })
  });
  
  const { ads, server_time } = await response.json();
  
  // Store ads in queue for Max to evaluate
  const { ad_queue = [] } = await chrome.storage.local.get('ad_queue');
  ad_queue.push(...ads);
  
  await chrome.storage.local.set({
    ad_queue,
    last_checked: server_time
  });
  
  console.log(`✅ Synced ${ads.length} new ads`);
  
  // Trigger Max evaluation
  chrome.runtime.sendMessage({ type: 'EVALUATE_ADS' });
}
```

### 2. Max Evaluation (background.js)

```javascript
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'EVALUATE_ADS') {
    await evaluateAdQueue();
  }
});

async function evaluateAdQueue() {
  const { ad_queue = [], user_profile } = await chrome.storage.local.get([
    'ad_queue',
    'payattn_userProfile'
  ]);
  
  if (!user_profile) {
    console.log('⚠️ No user profile, skipping evaluation');
    return;
  }
  
  for (const ad of ad_queue) {
    console.log(`🤖 Max evaluating: ${ad.headline}`);
    
    // Check targeting criteria
    const match = checkTargeting(ad.targeting, user_profile);
    
    if (match.approved) {
      console.log(`✅ Approved! Generating proofs...`);
      
      // Generate ZK-proofs
      const proofs = await generateProofs(ad.targeting, user_profile, match.required_proofs);
      
      // Create offer
      const response = await fetch('http://localhost:3000/api/user/offer', {
        method: 'POST',
        headers: {
          'x-user-id': user_profile.user_id,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ad_creative_id: ad.id,
          amount_lamports: ad.budget_per_impression_lamports,
          zk_proofs: proofs
        })
      });
      
      const result = await response.json();
      console.log(`📝 Offer created: ${result.offer_id}`);
    } else {
      console.log(`❌ Rejected: ${match.reason}`);
    }
  }
  
  // Clear queue
  await chrome.storage.local.set({ ad_queue: [] });
}

function checkTargeting(targeting, profile) {
  // Age check
  if (targeting.age) {
    if (profile.age < targeting.age.min || profile.age > targeting.age.max) {
      return { approved: false, reason: 'Age out of range' };
    }
  }
  
  // Income check
  if (targeting.income && profile.income < targeting.income.min) {
    return { approved: false, reason: 'Income too low' };
  }
  
  // Location check
  if (targeting.location && !targeting.location.countries.includes(profile.country)) {
    return { approved: false, reason: 'Location not targeted' };
  }
  
  // Interests check (required interests must match)
  const requiredInterests = targeting.interests
    .filter(i => i.weight === 'required')
    .map(i => i.category);
  
  const hasAllRequired = requiredInterests.every(cat =>
    profile.interests.includes(cat)
  );
  
  if (!hasAllRequired) {
    return { approved: false, reason: 'Missing required interests' };
  }
  
  // Determine which proofs are needed
  const required_proofs = [];
  if (targeting.age) required_proofs.push('age');
  if (targeting.income) required_proofs.push('income');
  if (targeting.location) required_proofs.push('location');
  if (targeting.interests.length > 0) required_proofs.push('interests');
  
  return { approved: true, required_proofs };
}
```

### 3. Content Script (content.js)

```javascript
// Listen for ad requests from publisher websites
window.addEventListener('message', async (event) => {
  if (event.data.type === 'PAYATTN_REQUEST_AD') {
    const { messageId, publisher_id } = event.data;
    
    // Get funded offers from storage
    const { funded_offers = [] } = await chrome.storage.local.get('funded_offers');
    
    if (funded_offers.length === 0) {
      window.postMessage({
        type: 'PAYATTN_AD_RESPONSE',
        messageId,
        error: 'No ads available'
      }, '*');
      return;
    }
    
    // FIFO: Select oldest funded offer
    const selectedOffer = funded_offers[0];
    
    // Respond with ad creative
    window.postMessage({
      type: 'PAYATTN_AD_RESPONSE',
      messageId,
      offer_id: selectedOffer.offer_id,
      ad: {
        headline: selectedOffer.ad_creative.headline,
        body: selectedOffer.ad_creative.body,
        cta: selectedOffer.ad_creative.cta,
        destination_url: selectedOffer.ad_creative.destination_url
      }
    }, '*');
  }
});
```

---

## 🌱 SEED DATA

### File: /backend/db/seed_ad_creatives.sql

```sql
-- Seed script: Generate test ad_creatives

-- Insert test campaigns
INSERT INTO campaigns (campaign_id, advertiser_id, name, total_budget_lamports, status)
VALUES
  ('camp_crypto_001', 'adv_rolex', 'Crypto Exchange Campaign Q4', 5000000, 'active'),
  ('camp_luxury_001', 'adv_rolex', 'Luxury Watch Campaign Q4', 10000000, 'active'),
  ('camp_streaming_001', 'adv_spotify', 'Streaming Entertainment Q4', 3000000, 'active');

-- Insert test ad_creatives
INSERT INTO ad_creative (
  ad_creative_id, advertiser_id, campaign_id,
  headline, body, cta, destination_url,
  targeting, budget_per_impression_lamports, total_budget_lamports, status
)
VALUES
  -- Rolex crypto ad
  (
    'ad_rolex_crypto_001',
    'adv_rolex',
    'camp_crypto_001',
    'Get 20% off Luxury Watches',
    'Swiss craftsmanship, lifetime warranty. Join the crypto revolution with Rolex.',
    'Shop Now',
    'https://rolex.com/crypto?utm_source=payattn&utm_campaign=crypto_001',
    '{"age": {"min": 25, "max": 45}, "location": {"countries": ["GB", "DE", "FR"]}, "income": {"min": 50000}, "interests": [{"category": "cryptocurrency", "weight": "required"}, {"category": "luxury", "weight": "preferred"}]}'::jsonb,
    10000,
    1000000,
    'active'
  ),
  -- Spotify streaming ad
  (
    'ad_spotify_stream_001',
    'adv_spotify',
    'camp_streaming_001',
    'Stream Without Limits',
    'Unlimited music streaming for just £9.99/month. First month free!',
    'Start Free Trial',
    'https://spotify.com/premium?utm_source=payattn&utm_campaign=stream_001',
    '{"age": {"min": 18, "max": 45}, "location": {"countries": ["GB", "US", "CA"]}, "income": {"min": 35000}, "interests": [{"category": "music", "weight": "required"}, {"category": "entertainment", "weight": "preferred"}]}'::jsonb,
    8000,
    800000,
    'active'
  ),
  -- Nike sports ad
  (
    'ad_nike_sports_001',
    'adv_nike',
    NULL,
    'Just Do It - New Collection',
    'Discover the latest Nike sportswear. Free shipping on orders over £50.',
    'Shop Now',
    'https://nike.com/new?utm_source=payattn&utm_campaign=sports_001',
    '{"age": {"min": 14, "max": 35}, "location": {"countries": ["GB", "US"]}, "interests": [{"category": "sports", "weight": "required"}, {"category": "fitness", "weight": "preferred"}]}'::jsonb,
    7000,
    700000,
    'active'
  );

-- Seed publisher data
INSERT INTO publishers (publisher_id, name, domain, wallet_address, wallet_verified)
VALUES
  ('8k3m9x2p', 'Tech News Daily', 'technews.example.com', '9feDsS77QobmdVfYME1uKc3XnZSvUDaohAg3fwErYZB2', true);

-- Seed user data (for testing)
INSERT INTO users (user_id, wallet_pubkey)
VALUES
  ('user_test_001', 'UserWallet1234567890abcdefghijklmnopqrstuvwxyz');
```

---

## ✅ IMPLEMENTATION CHECKLIST

### Phase 1: Database Setup (1 hour)
- [ ] Create migration: `001_create_ad_creative_tables.sql`
- [ ] Create seed script: `seed_ad_creatives.sql`
- [ ] Run migrations on local Supabase
- [ ] Verify tables created correctly
- [ ] Run seed script
- [ ] Verify seed data inserted

### Phase 2: Backend API (3 hours)
- [ ] Create `/api/user/adstream/route.ts`
- [ ] Create `/api/user/offer/route.ts`
- [ ] Create `/api/advertiser/create-ad/route.ts` (POST)
- [ ] Create `/api/advertiser/ads/route.ts` (GET)
- [ ] Update `/api/publisher/impressions/route.ts` (add ad_creative counter increment only)
- [ ] Create `/api/publisher/clicks/route.ts`
- [ ] Test all endpoints with curl

**Note:** `/api/publisher/impressions` settlement logic is already working - only add the counter increment!

### Phase 3: Advertiser UI (2 hours)
- [ ] Create `/app/advertisers/create-campaign/page.tsx`
- [ ] Form with validation
- [ ] Targeting criteria UI (age sliders, interest multi-select)
- [ ] Preview section
- [ ] Update `/app/advertisers/page.tsx` with "Create Ad" link
- [ ] Test form submission

### Phase 4: Publisher Portal Update (30 minutes)
- [ ] Update `/app/publishers/page.tsx`
- [ ] Fix SDK snippet URL: `http://localhost:3000/publishers/v1/sdk.js`
- [ ] Add `data-publisher-id` attribute

### Phase 5: Publisher SDK (3 hours)
- [ ] Create `/public/publishers/v1/sdk.js`
- [ ] Implement ad request (postMessage)
- [ ] Implement impression tracking (Intersection Observer)
- [ ] Implement click tracking
- [ ] Create demo HTML page for testing
- [ ] Test SDK on demo page

### Phase 6: Extension Updates (4 hours)
- [ ] Update `background.js` - add ad sync alarm
- [ ] Implement `syncNewAds()` function
- [ ] Implement `evaluateAdQueue()` (Max evaluation)
- [ ] Implement `checkTargeting()` logic
- [ ] Update `content.js` - handle ad requests
- [ ] Test extension → backend flow
- [ ] Test Max evaluation logic

### Phase 7: Integration Testing (2 hours)
- [ ] Test complete flow end-to-end:
  1. Advertiser creates ad
  2. Extension syncs new ad
  3. Max evaluates and creates offer
  4. Peggy funds offer (manual for demo)
  5. Publisher displays ad
  6. User views ad (1+ second)
  7. Settlement executes
  8. Verify 3 Solana transactions
- [ ] Test click tracking
- [ ] Test multiple ads on same page
- [ ] Test error cases

### Phase 8: Documentation (1 hour)
- [ ] Update README with new flow
- [ ] Document API endpoints
- [ ] Create demo video script
- [ ] Update architecture diagrams

---

## 📊 TIME ESTIMATE

| Phase | Hours | Notes |
|-------|-------|-------|
| Database Setup | 1 | Migrations + seed data |
| Backend API | 3 | 5 endpoints |
| Advertiser UI | 2 | Form + validation |
| Publisher Portal | 0.5 | Update SDK snippet |
| Publisher SDK | 3 | Client-side JS |
| Extension Updates | 4 | Sync + Max evaluation |
| Integration Testing | 2 | End-to-end flow |
| Documentation | 1 | README + docs |
| **TOTAL** | **16.5 hours** | ~2 days |

---

## 🚀 READY TO BUILD!

All architecture decisions finalized. All knowledge gaps resolved. Let's start implementing! 🎉

### Gap 1: Ad Creative Storage & Delivery (BLOCKER)

**Current State:**
- ❌ No ad creative storage in database schema
- ❌ No ad creative in campaign/offer data structures
- ❌ No mechanism to deliver ad creative to extension
- ❌ Brief assumes publisher just "reports impressions" AFTER showing an ad

**Required Architecture Decisions:**

1. **Where is ad creative stored?**
   ```
   OPTIONS:
   A) Database (campaigns table) - Traditional approach
   B) IPFS/Arweave - Decentralized storage
   C) Extension local storage - Pre-synced from backend
   D) On-demand fetch from backend when publisher requests ad
   ```

2. **What format is ad creative?**
   ```
   OPTIONS:
   A) Text-only (headline + body) - Like AdSense text ads
   B) Image URL + text - Standard display ads
   C) Rich HTML/CSS - Full creative freedom
   D) Video URL - For video ads
   E) JSON schema with flexible components
   ```

3. **When does ad creative get attached to offers?**
   ```
   FLOW OPTIONS:
   A) Advertiser uploads creative → Campaign created with creative → Offers include creative reference
   B) Creative stored separately, referenced by campaign_id
   C) Creative generated dynamically by backend
   ```

**RECOMMENDATION:**
```json
// Add to database schema: campaigns table
{
  "campaign_id": "camp_123",
  "advertiser_id": "adv_456",
  "ad_creative": {
    "format": "text",  // text | image | html | video
    "headline": "Get 20% off premium watches",
    "body": "Luxury timepieces from Swiss manufacturers. Limited time offer.",
    "cta": "Shop Now",
    "image_url": "https://cdn.advertiser.com/ad-123.jpg",  // optional
    "destination_url": "https://advertiser.com/campaign-landing?ref=payattn"
  },
  "targeting": {...},
  "budget": {...}
}
```

---

### Gap 2: Extension ↔ Publisher SDK Communication (BLOCKER)

**Current State:**
- ✅ Extension exists (`/extension/`)
- ✅ Extension has `content.js` with `window.postMessage` support
- ✅ Extension has ad queue UI (`ad-queue.html`)
- ❌ No protocol defined for Publisher → Extension → Backend flow
- ❌ No security model for which websites can request ads

**Required Architecture Decisions:**

1. **Communication Protocol:**
   ```javascript
   // OPTION A: PostMessage (window ↔ content script ↔ background)
   // Publisher website code:
   window.postMessage({
     type: 'PAYATTN_REQUEST_AD',
     publisherId: 'pub_001',
     adSlotId: 'sidebar-1'
   }, '*');
   
   // Extension content.js responds:
   window.postMessage({
     type: 'PAYATTN_AD_RESPONSE',
     ad: { headline: '...', body: '...', offer_id: 'offer_123' }
   }, '*');
   
   // OPTION B: Chrome Extension messaging API
   chrome.runtime.sendMessage({
     type: 'REQUEST_AD',
     publisherId: 'pub_001'
   });
   
   // OPTION C: HTTP polling (publisher SDK polls extension's local server)
   // Extension runs localhost:9999, SDK fetches from there
   ```

2. **Security & Trust Model:**
   ```
   QUESTIONS:
   - Can any website request ads from extension?
   - Must publisher be pre-registered/verified?
   - How to prevent abuse (requesting 1000 ads but showing 0)?
   - How to verify impression actually happened?
   ```

3. **Ad Selection Logic:**
   ```
   WHO DECIDES WHICH AD TO SHOW?
   A) Backend (publisher SDK → backend → backend picks offer → SDK displays)
   B) Extension (has pre-loaded offers, picks based on user context)
   C) Publisher SDK (gets list of offers, chooses based on placement)
   ```

**RECOMMENDATION:**
```
ARCHITECTURE: Extension-Mediated Ad Serving

1. Extension pre-fetches funded offers from backend (every hour)
2. Extension stores offers in chrome.storage.local
3. Publisher website includes <script src="payattn-sdk.js"></script>
4. SDK uses postMessage to request ad from extension
5. Extension responds with ad creative + offer_id
6. Publisher renders ad in their UI
7. When user views ad (1+ seconds), SDK reports impression
8. Backend triggers settlement

SECURITY:
- Extension validates origin against registered publisher domains
- Rate limiting: 1 ad request per 10 seconds per domain
- Impression must be reported within 5 minutes of ad request
```

---

### Gap 3: Complete Ad Display Flow (DESIGN MISSING)

**Current Brief Shows:**
```
❌ INCOMPLETE FLOW:
User views ad → SDK reports impression → Backend settles
```

**Actual Required Flow:**
```
✅ COMPLETE FLOW:

1. SETUP PHASE (One-time):
   - Advertiser creates campaign with ad creative
   - Campaign stored in database with creative
   - Max evaluates offers (already implemented)
   - Peggy funds escrows (already implemented)

2. AD SYNC PHASE (Periodic):
   - Extension fetches funded offers from backend
   - GET /api/extension/offers?status=funded
   - Response includes ad creative for each offer
   - Extension stores in chrome.storage.local

3. AD REQUEST PHASE (On-demand):
   - Publisher website loads SDK: <script src="payattn-sdk.js"></script>
   - Publisher calls: PayattnSDK.requestAd({ publisherId: 'pub_001', slot: 'sidebar' })
   - SDK sends postMessage to extension
   - Extension picks matching offer (based on user profile + ZK proofs)
   - Extension responds with ad creative + offer_id
   - SDK returns to publisher: { headline, body, cta, destination_url, offer_id }

4. AD DISPLAY PHASE (Publisher renders):
   - Publisher renders ad in their UI (custom styling)
   - Publisher's responsibility to make it look good
   - SDK provides impression tracking

5. IMPRESSION TRACKING PHASE (Automatic):
   - SDK starts timer when ad becomes visible (Intersection Observer)
   - After 1+ seconds visible, SDK reports impression
   - POST /api/publisher/impressions { offerId, publisherId, duration }

6. SETTLEMENT PHASE (Backend):
   - Backend validates offer is funded
   - Backend calls settleWithPrivacy() (already implemented)
   - 3 Solana transactions executed
   - Funds distributed: 70% user / 25% publisher / 5% platform
```

---

### Gap 4: Publisher Integration Model (UNSPECIFIED)

**Questions:**

1. **How does publisher integrate?**
   ```html
   <!-- OPTION A: Simple script tag (like AdSense) -->
   <script src="https://cdn.payattn.org/sdk.js"></script>
   <div id="payattn-ad-slot-1"></div>
   <script>
     Payattn.createAdSlot({
       slotId: 'payattn-ad-slot-1',
       publisherId: 'pub_001',
       width: 300,
       height: 250
     });
   </script>
   
   <!-- OPTION B: Manual SDK usage -->
   <script src="https://cdn.payattn.org/sdk.js"></script>
   <script>
     const sdk = new PayattnSDK({ publisherId: 'pub_001' });
     const ad = await sdk.requestAd();
     // Publisher renders ad manually
     document.getElementById('my-ad-container').innerHTML = `
       <h3>${ad.headline}</h3>
       <p>${ad.body}</p>
       <a href="${ad.destination_url}">${ad.cta}</a>
     `;
     // SDK auto-reports impression
   </script>
   ```

2. **Who styles the ad?**
   ```
   A) Publisher (SDK just provides data)
   B) SDK (provides pre-styled HTML)
   C) Hybrid (SDK provides default styles, publisher can override)
   ```

**RECOMMENDATION:**
- Start with Manual SDK (Option B)
- Provide ad data, let publisher render
- This gives maximum flexibility for demo

---

## 📋 REVISED TASK LIST

### Phase 0: Architecture Finalization (REQUIRED FIRST) 🚨

**Tasks:**
- [ ] **0.1** Define ad creative schema (add to database)
- [ ] **0.2** Design extension ↔ SDK communication protocol
- [ ] **0.3** Specify security model for ad requests
- [ ] **0.4** Document complete ad display flow (all 6 phases)
- [ ] **0.5** Create mock ad creative data for testing
- [ ] **0.6** Update database schema with ad_creative column

**Deliverables:**
- Architecture decision document (ADR)
- Updated database migration
- Protocol specification (postMessage format)
- Security requirements document

**Estimated Time:** 2-3 hours (BLOCKING)

---

### Phase 1: Backend - Ad Creative API (NEW)

**Tasks:**
- [ ] **1.1** Add `ad_creative` JSONB column to `campaigns` table
- [ ] **1.2** Create seed data: 5 campaigns with ad creative
- [ ] **1.3** Update `GET /api/campaigns` to include ad creative
- [ ] **1.4** Create `GET /api/extension/offers?status=funded` endpoint
  - Returns funded offers with ad creative
  - Used by extension to sync ads
- [ ] **1.5** Test campaign API returns creative correctly

**Files to Create/Modify:**
- `backend/db/migrations/add_ad_creative.sql`
- `backend/db/seed_campaigns_with_creative.sql`
- `backend/app/api/campaigns/route.ts` (update)
- `backend/app/api/extension/offers/route.ts` (new)

**Estimated Time:** 2 hours

---

### Phase 2: Extension - Ad Sync & Delivery (NEW)

**Tasks:**
- [ ] **2.1** Create `extension/lib/ad-sync.js`
  - Fetch funded offers from backend every hour
  - Store in chrome.storage.local
- [ ] **2.2** Update `extension/background.js`
  - Add alarm for periodic ad sync
  - Handle ad request messages from content script
- [ ] **2.3** Update `extension/content.js`
  - Listen for postMessage from publisher websites
  - Validate origin (check against registered publishers)
  - Respond with ad creative
- [ ] **2.4** Create `extension/lib/ad-selector.js`
  - Pick best offer based on user profile
  - Consider ZK-proof requirements
  - Rate limiting logic
- [ ] **2.5** Test extension ↔ content script communication

**Files to Create/Modify:**
- `extension/lib/ad-sync.js` (new)
- `extension/lib/ad-selector.js` (new)
- `extension/background.js` (update)
- `extension/content.js` (update)
- `extension/manifest.json` (add permissions if needed)

**Estimated Time:** 3 hours

---

### Phase 3: Publisher SDK - Core Implementation (REVISED)

**Tasks:**
- [ ] **3.1** Create `/publisher-sdk/` directory structure
  ```
  publisher-sdk/
  ├── src/
  │   ├── index.ts          # Main SDK class
  │   ├── ad-requester.ts   # postMessage to extension
  │   ├── impression-reporter.ts  # Reports to backend
  │   └── types.ts          # TypeScript definitions
  ├── dist/                 # Compiled output
  ├── test/
  │   └── demo.html         # Test page with SDK
  ├── package.json
  ├── tsconfig.json
  └── README.md
  ```

- [ ] **3.2** Implement `AdRequester` class
  - Send postMessage to extension
  - Listen for ad response
  - Handle timeouts (5 seconds)
  - Return ad creative to publisher

- [ ] **3.3** Implement `ImpressionReporter` class
  - Intersection Observer for visibility tracking
  - Timer for duration (1+ seconds)
  - POST to `/api/publisher/impressions`
  - Return settlement results

- [ ] **3.4** Implement `PayattnPublisherSDK` main class
  ```typescript
  class PayattnPublisherSDK {
    async requestAd(): Promise<AdCreative>
    async reportImpression(offerId, duration): Promise<SettlementResult>
    trackImpression(offerId, element): void  // Auto-reports when visible
  }
  ```

- [ ] **3.5** Add TypeScript types
  ```typescript
  interface AdCreative {
    offer_id: string;
    headline: string;
    body: string;
    cta: string;
    destination_url: string;
    image_url?: string;
  }
  
  interface SettlementResult {
    success: boolean;
    settled: boolean;
    transactions: SettlementTransaction[];
  }
  ```

**Files to Create:**
- `publisher-sdk/src/index.ts`
- `publisher-sdk/src/ad-requester.ts`
- `publisher-sdk/src/impression-reporter.ts`
- `publisher-sdk/src/types.ts`
- `publisher-sdk/package.json`
- `publisher-sdk/tsconfig.json`

**Estimated Time:** 4 hours

---

### Phase 4: Publisher SDK - Demo & Testing

**Tasks:**
- [ ] **4.1** Create `test/demo.html`
  - Load SDK from local build
  - Request ad button
  - Display ad creative
  - Track impression automatically
  - Show settlement results

- [ ] **4.2** Create `test/integration.html`
  - Test extension communication
  - Test multiple ad requests
  - Test rate limiting
  - Test error handling

- [ ] **4.3** Build SDK: `npm run build`
  - TypeScript → JavaScript
  - Generate type definitions
  - Bundle for browser use

- [ ] **4.4** Test complete flow:
  1. Extension syncs offers
  2. Publisher requests ad
  3. Extension responds with creative
  4. Publisher displays ad
  5. User views ad (1+ seconds)
  6. SDK reports impression
  7. Backend settles escrow
  8. Verify 3 Solana transactions

**Expected Demo Output:**
```javascript
// 1. Request ad
const ad = await sdk.requestAd();
console.log(ad);
// {
//   offer_id: 'offer_123',
//   headline: 'Get 20% off premium watches',
//   body: 'Luxury timepieces...',
//   cta: 'Shop Now',
//   destination_url: 'https://...'
// }

// 2. Display ad (publisher's code)
document.getElementById('ad-container').innerHTML = `
  <div class="ad">
    <h3>${ad.headline}</h3>
    <p>${ad.body}</p>
    <a href="${ad.destination_url}">${ad.cta}</a>
  </div>
`;

// 3. Track impression (automatic)
sdk.trackImpression(ad.offer_id, document.getElementById('ad-container'));

// 4. After 1+ seconds visible:
// ✅ Settlement completed
// 💰 user: 0.0070 SOL
// 💰 publisher: 0.0025 SOL
// 💰 platform: 0.0005 SOL
```

**Estimated Time:** 2 hours

---

### Phase 5: Documentation & Polish

**Tasks:**
- [ ] **5.1** Write `publisher-sdk/README.md`
  - Installation instructions
  - Quick start guide
  - API reference
  - Complete example
  - Troubleshooting

- [ ] **5.2** Write `docs/AD_CREATIVE_FLOW.md`
  - Document complete flow (all 6 phases)
  - Architecture diagrams
  - Security model
  - Integration guide

- [ ] **5.3** Update `docs/PUBLISHER-SDK-BRIEF.md`
  - Add ad creative section
  - Add extension integration section
  - Add complete flow diagram

- [ ] **5.4** Create demo video (optional)
  - Screen recording of complete flow
  - Show extension syncing offers
  - Show publisher requesting ad
  - Show settlement on Solana Explorer

**Estimated Time:** 2 hours

---

## 🎯 TOTAL TIME ESTIMATE

| Phase | Hours |
|-------|-------|
| Phase 0: Architecture Finalization | 2-3 hours |
| Phase 1: Backend - Ad Creative API | 2 hours |
| Phase 2: Extension - Ad Sync & Delivery | 3 hours |
| Phase 3: Publisher SDK - Core | 4 hours |
| Phase 4: Demo & Testing | 2 hours |
| Phase 5: Documentation | 2 hours |
| **TOTAL** | **15-16 hours** |

**Realistic Schedule:** 2 days (Nov 9-10)

---

## 🚨 BLOCKERS & RISKS

### CRITICAL BLOCKERS (Must Resolve First)

1. **❌ Ad Creative Schema Not Defined**
   - Cannot implement backend API without schema
   - Cannot create seed data
   - **BLOCKER for all other work**

2. **❌ Extension Communication Protocol Not Specified**
   - Cannot implement SDK without knowing how to talk to extension
   - **BLOCKER for Phase 2 & 3**

3. **❌ Security Model Not Defined**
   - Which websites can request ads?
   - How to verify publisher identity?
   - How to prevent abuse?

### MEDIUM RISKS

1. **⚠️ Extension May Not Be Ready**
   - Need to verify extension can handle new messages
   - May need manifest.json updates
   - May need new permissions

2. **⚠️ Cross-Origin Communication**
   - PostMessage requires careful origin checking
   - Extension content script must validate sender
   - Security implications if done wrong

3. **⚠️ Impression Tracking Accuracy**
   - Intersection Observer may not work in all scenarios
   - iframes, hidden tabs, scrolling issues
   - Need robust visibility detection

---

## 📞 QUESTIONS FOR STAKEHOLDERS

Before proceeding, we need answers to:

1. **Ad Creative:**
   - What format? (text, image, video, HTML?)
   - Where stored? (database, IPFS, CDN?)
   - Who creates? (advertiser uploads, or system generates?)

2. **Extension Integration:**
   - Can we modify extension code?
   - Do we have time to add new features to extension?
   - Or must SDK work with extension as-is?

3. **Publisher Experience:**
   - How technical is publisher? (can they write JavaScript?)
   - Do they want turnkey solution? (like AdSense auto-insert)
   - Or do they want full control? (manual rendering)

4. **Security:**
   - Do publishers pre-register domains?
   - How to verify publisher identity?
   - Rate limiting strategy?

5. **Demo Scope:**
   - Is this for judges demo only? (can be hacky)
   - Or production-ready? (needs more polish)

---

## 🎬 RECOMMENDED NEXT STEPS

**IMMEDIATE (Today):**
1. ✅ Review this document with team
2. ✅ Make architecture decisions (answer questions above)
3. ✅ Define ad creative schema
4. ✅ Define extension ↔ SDK protocol
5. ✅ Create ADR (Architecture Decision Record)

**TOMORROW:**
1. Implement Phase 0 (architecture)
2. Implement Phase 1 (backend ad creative API)
3. Implement Phase 2 (extension updates)

**DAY 3:**
1. Implement Phase 3 (publisher SDK)
2. Implement Phase 4 (demo & testing)
3. Implement Phase 5 (documentation)

---

## 💡 SIMPLIFIED MVP APPROACH (If Time-Constrained)

If we need to demo faster, here's a minimal viable approach:

### MVP: Hardcoded Ad Creative (Skip Database)

```javascript
// extension/lib/mock-ads.js
const MOCK_FUNDED_OFFERS = [
  {
    offer_id: 'offer_test_v3_1762636084025',
    ad_creative: {
      headline: 'Get 20% off Luxury Watches',
      body: 'Swiss craftsmanship, lifetime warranty',
      cta: 'Shop Now',
      destination_url: 'https://example.com'
    }
  },
  // ... 2 more offers from Peggy
];

// Extension returns these when publisher requests
```

### MVP Flow:
1. ✅ Extension has hardcoded offers (skip backend sync)
2. ✅ SDK requests ad via postMessage
3. ✅ Extension responds with hardcoded creative
4. ✅ Publisher displays ad
5. ✅ SDK reports impression (existing backend)
6. ✅ Backend settles (already working)

**Time Saved:** ~6 hours (skip Phase 0, 1, 2)  
**Trade-off:** Not production-ready, but proves concept

---

## 📚 REFERENCE MATERIALS

### Existing Working Code:
- ✅ Backend settlement: `/backend/app/api/publisher/impressions/route.ts`
- ✅ Extension messaging: `/extension/content.js` (postMessage support)
- ✅ Ad queue UI: `/extension/ad-queue.html` (shows offer assessment)
- ✅ Peggy's funded escrows: `PEGGY_COMPLETION_REPORT.md`

### Architecture Docs:
- `docs/ARCHITECTURE.md` - System overview
- `docs/solana_dev.md` - Settlement implementation
- `docs/END_TO_END_TEST_GUIDE.md` - Testing flows

### Similar Implementations:
- Google AdSense SDK (publisher integration model)
- Carbon Ads (simple text ad format)
- AdButler (JavaScript ad server)

---

## ✅ SUCCESS CRITERIA

Publisher SDK is complete when:

### Functional:
- ✅ SDK can request ad from extension (postMessage)
- ✅ Extension responds with ad creative
- ✅ Publisher can display ad in their UI
- ✅ SDK auto-tracks impressions (Intersection Observer)
- ✅ SDK reports to backend after 1+ seconds visible
- ✅ Backend settles escrow (3 Solana transactions)
- ✅ All parties receive funds (70/25/5 split)

### Technical:
- ✅ TypeScript with full type definitions
- ✅ Builds without errors
- ✅ Works in Chrome, Firefox, Safari
- ✅ Error handling for all edge cases
- ✅ Security: origin validation, rate limiting

### Demo:
- ✅ Complete flow works end-to-end
- ✅ Solana Explorer links show 3 transactions
- ✅ Clear console output with emojis
- ✅ Impressive for judges

---

**Status:** 🚨 AWAITING ARCHITECTURE DECISIONS  
**Next Action:** Review this document and answer questions in Section "QUESTIONS FOR STAKEHOLDERS"

---

_This task list supersedes PUBLISHER-SDK-BRIEF.md until architecture decisions are finalized._
