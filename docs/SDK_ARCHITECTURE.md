# Publisher SDK Architecture

**Version:** 1.0  
**Date:** November 9, 2025  
**Status:** ✅ Finalized - Ready for Implementation

---

## Core Concept

**The Atomic Unit:** `ad_creative` (NOT campaigns)

Max evaluates individual ad creatives, not campaigns. An offer is made for a specific `ad_creative + user` combination.

```
Flow: Advertiser → ad_creative → Max evaluates → Offer → Peggy funds → Publisher displays → Settlement
```

---

##  Database Tables

### 1. ad_creative (CORE)
- Contains: headline, body, CTA, destination URL
- Contains: targeting criteria (age, interests, income, location)
- Contains: budget per impression
- Contains: stats (impressions_count, clicks_count)
- **This is what Max evaluates**

### 2. offers
- Links: ad_creative_id + user_id
- Contains: amount_lamports, status, zk_proofs
- Status: offer_made → funded → settled

### 3. campaigns (optional)
- Organizational grouping only
- For advertiser reporting
- Multiple ad_creatives can belong to one campaign

---

## Complete Flow

### 1. Advertiser Creates Ad
```
/advertisers/create-campaign → POST /api/advertiser/ads → Creates ad_creative in DB
```

### 2. Extension Syncs
```
GET /api/user/adstream (with last_checked timestamp)
→ Returns new ad_creatives since last check
→ Extension stores in local queue
```

### 3. Max Evaluates (Client-Side)
```
For each ad_creative:
  - Check targeting vs user profile
  - Generate ZK-proofs (age, interests, income, location)
  - POST /api/user/offer (with proofs)
  - Creates offer with status='offer_made'
```

### 4. Peggy Funds
```
Queries offers with status='offer_made'
→ Funds escrow on Solana
→ Updates status='funded'
```

### 5. Publisher Displays
```
Publisher includes SDK on website
→ SDK requests ad via postMessage
→ Extension responds with ad_creative data
→ Publisher renders ad
→ SDK tracks impression (1+ second visible)
```

### 6. Settlement
```
POST /api/publisher/impressions
→ Increments ad_creative.impressions_count
→ Triggers settleWithPrivacy()
→ 3 Solana transactions (70/25/5 split)
```

---

## Key Endpoints

| Endpoint | Purpose | Who Calls | Status |
|----------|---------|-----------|--------|
| `GET /api/user/adstream` | Fetch new ads to evaluate | Extension (periodic sync) | NEW |
| `POST /api/user/offer` | Create offer with ZK-proofs | Max (client-side) | NEW |
| `POST /api/advertiser/create-ad` | Create new ad_creative | Advertiser UI | NEW |
| `GET /api/advertiser/ads` | List ads for dashboard | Advertiser UI | NEW |
| `POST /api/publisher/impressions` | Report ad view & settle | Publisher SDK | ✅ EXISTING (fully functional) |
| `POST /api/publisher/clicks` | Track clicks (no payment) | Publisher SDK | NEW |

**Note:** `/api/publisher/impressions` already exists and handles settlement via `settleWithPrivacy()` - 3 privacy-preserving transactions (70/25/5 split). No changes needed.

---

## 🔒 Privacy Model

**No user tracking:**
- Only counters in ad_creative table (impressions_count, clicks_count)
- No individual impression records
- No user behavior tracking
- ZK-proofs prove targeting match without revealing user data

---

## 📍 Implementation Priority

1. ✅ **Database migrations** (ad_creative, campaigns tables)
2. ✅ **Backend APIs** (6 endpoints)
3. ✅ **Advertiser UI** (create ad form)
4. ✅ **Publisher SDK** (client-side JS)
5. ✅ **Extension updates** (sync + Max evaluation)
6. ✅ **Integration testing** (end-to-end flow)

---

See `sdk_tasks.md` for detailed implementation checklist.
