# Offer Submission Implementation

**Date:** November 10, 2025  
**Status:** ✅ Complete  
**Developer:** Claude (GitHub Copilot)

---

## 🎯 Objective

Enable Max (extension) to submit offers with ZK-SNARK proofs to the backend so that Peggy (advertiser agent) can evaluate and fund them.

---

## 📋 Implementation Summary

### ✅ What Was Implemented

#### 1. **New Function: `submitOfferToBackend()` in `extension/ad-queue.js`**

**Purpose:** Submit Max's offer decision + ZK proofs to backend API

**Parameters:**
- `campaign` - Campaign object with id
- `price` - Offer price in USD
- `zkProofs` - Object with proof packages keyed by requirement type

**Functionality:**
- Gets user credentials from chrome.storage (wallet address, user_id)
- Converts price from USD to lamports (assumes $20/SOL for demo)
- Formats ZK proofs into backend-expected structure
- Submits to `POST /api/user/offer` with proper headers
- Returns offer_id and status from backend
- Comprehensive error handling and logging

**Request Format:**
```javascript
{
  ad_creative_id: "uuid",  // UUID from ad_creative.id field
  amount_lamports: 250000, // Price in lamports
  zk_proofs: {
    age: {
      proof: { pi_a: [...], pi_b: [...], pi_c: [...] },
      publicSignals: ["1", "40", "60"],
      circuitName: "age_range"
    },
    location: { ... },
    income: { ... },
    interest: { ... }
  }
}
```

**Headers:**
```
Content-Type: application/json
x-user-id: <user_id or wallet_address>
```

#### 2. **Modified Function: `generateProofsForOffer()` in `extension/ad-queue.js`**

**Changes:**
- Changed return type from `Array` to `Object` (keyed by requirement type)
- Backend expects `{ age: {...}, location: {...} }` not an array
- Converts internal array format to keyed object before returning
- Updated logging to show object keys instead of array length

#### 3. **Modified Function: `assessCampaign()` in `extension/ad-queue.js`**

**Changes:**
- After generating ZK proofs, now calls `submitOfferToBackend()`
- Stores backend response (offer_id, status) in assessment result
- Updates reason message to include offer_id
- Handles submission errors gracefully - continues with local assessment even if backend fails
- Comprehensive logging for debugging

#### 4. **Backend Fix: `POST /api/user/offer` in `backend/app/api/user/offer/route.ts`**

**Changes:**
- Added `advertiser_id` field to offer insertion (was missing, but required by schema)
- Added `ad_id` field to offer insertion (legacy text field for compatibility)
- Both fields pulled from `adCreative` object retrieved in validation step
- Fixes database constraint violation that would have occurred

---

## 🔄 Complete Flow

### Max → Backend → Peggy

```
1. USER OPENS ad-queue.html
   ↓
2. MAX EVALUATES ADS (Venice AI)
   - Calls assessCampaign()
   - Max decides: OFFER or REJECT
   ↓
3. IF OFFER:
   - Calls generateProofsForOffer()
   - Generates ZK-SNARKs for matched requirements
   ↓
4. SUBMIT TO BACKEND
   - Calls submitOfferToBackend()
   - POST /api/user/offer
   - Backend creates offer with status='offer_made'
   ↓
5. PEGGY POLLS DATABASE
   - Queries offers WHERE status='offer_made'
   - Evaluates with AI
   - Accepts good offers
   ↓
6. PEGGY FUNDS ESCROW
   - POST /api/advertiser/offers/:id/accept
   - Backend returns HTTP 402 (x402 protocol)
   - Peggy funds Solana escrow
   ↓
7. PAYMENT PROOF
   - Peggy submits tx signature
   - Offer status → 'funded'
   - User can now display ad
```

---

## 📊 Database Schema

### `offers` table structure:

```sql
CREATE TABLE offers (
  id                              SERIAL PRIMARY KEY,
  offer_id                        VARCHAR UNIQUE NOT NULL,
  advertiser_id                   VARCHAR NOT NULL,        -- ✅ NOW SET
  user_id                         VARCHAR NOT NULL,
  user_pubkey                     VARCHAR NOT NULL,
  ad_id                           VARCHAR NOT NULL,        -- ✅ NOW SET
  ad_creative_id                  UUID REFERENCES ad_creative(id), -- ✅ ALREADY SET
  amount_lamports                 BIGINT NOT NULL,
  status                          VARCHAR DEFAULT 'offer_made',
  zk_proofs                       JSONB,                   -- ✅ ZK proofs stored here
  escrow_pda                      VARCHAR,
  escrow_tx_signature             VARCHAR,
  created_at                      TIMESTAMP DEFAULT NOW(),
  updated_at                      TIMESTAMP DEFAULT NOW()
);
```

**Status Flow:**
- `'offer_made'` - Max created offer, waiting for Peggy
- `'accepted'` - Peggy accepted, preparing to fund
- `'funded'` - Escrow funded, ready for display
- `'settled'` - Ad shown, payments distributed

---

## 🔐 ZK-SNARK Proof Structure

### Supported Proof Types:

| Requirement | Circuit Name | Status | Public Signals |
|-------------|--------------|--------|----------------|
| Age | `range_check` | ✅ Implemented | [min_age, max_age] |
| Income | `range_check` | ✅ Implemented | [min_income, max_income] |
| Location | `set_membership` | ✅ Implemented | [country_hashes...] (padded to 10) |
| Interests | `set_membership` | ✅ Implemented | [interest_hashes...] (padded to 10) |

### Proof Package Format:

```javascript
{
  proof: {
    pi_a: [x, y],
    pi_b: [[x1, y1], [x2, y2]],
    pi_c: [x, y]
  },
  publicSignals: ["signal1", "signal2", ...],
  circuitName: "range_check" | "set_membership"
}
```

---

## 🧪 Testing Checklist

### Manual Testing Steps:

1. **Start Backend Server**
   ```bash
   cd backend
   npm run dev
   ```

2. **Open Extension**
   - Load unpacked extension in Chrome
   - Ensure user is authenticated (wallet connected)
   - Ensure user profile exists in chrome.storage

3. **Open Ad Queue**
   - Navigate to `chrome-extension://<id>/ad-queue.html`
   - Click "Fetch & Assess New Ads"

4. **Verify Max Assessment**
   - Watch console logs for Max's reasoning
   - See offers being generated
   - Verify ZK proof generation (console logs)

5. **Check Backend Submission**
   - Watch for `[Offer Submission]` logs in console
   - Verify HTTP 200 response
   - Check offer_id is returned

6. **Verify Database**
   ```sql
   SELECT * FROM offers WHERE status = 'offer_made' ORDER BY created_at DESC LIMIT 5;
   ```

7. **Run Peggy**
   ```bash
   cd advertiser-agent
   node peggy.js
   ```
   - Verify Peggy sees pending offers
   - Watch evaluation and funding

### Expected Console Output:

```
[Max] Assessing campaign: ad_rolex_crypto_001
[Max] Tool calls detected: 1
[Max] Generating ZK proofs for matched requirements...
🔐 [ZK-SNARK] Campaign: ad_rolex_crypto_001 - Generated 3 proof(s):
   - age: range_check (2 public signals)
   - location: set_membership (10 public signals)
   - interest: set_membership (10 public signals)
[Max] Submitting offer to backend...
[Offer Submission] Submitting offer to backend...
[Offer Submission] Campaign: ad_rolex_crypto_001, Price: $0.0280
[Offer Submission] Amount: 1400000 lamports (0.001400 SOL)
[Offer Submission] Including 3 ZK proofs
✅ [Offer Submission] Success! Offer ID: offer_1731234567890_abc123
[Offer Submission] Status: offer_made
[Offer Submission] Next: Peggy will evaluate and potentially fund escrow
✅ [Max] Offer submitted successfully! Offer ID: offer_1731234567890_abc123
```

---

## ⚠️ Known Limitations & TODOs

### 1. **UUID vs Text ID Mismatch**
- Dummy ads use text IDs like `'ad_rolex_crypto_001'`
- Database primary key is UUID
- Backend expects UUID in `ad_creative_id` field
- **TODO:** Update dummy-ads.js to use UUIDs or add UUID generation
- **Workaround:** Use real database-seeded ads for testing

### 2. **SOL Price Oracle**
- Currently hardcoded to $20/SOL
- **TODO:** Integrate real price oracle (Pyth, Chainlink)
- For demo: Manual conversion is acceptable

### 3. **User ID Management**
- Falls back to wallet_address if user_id not found
- **TODO:** Ensure user_id is set during authentication flow
- Check: `extension/auth.js` or equivalent

### 4. **Error Recovery**
- If backend submission fails, assessment continues locally
- Offer is shown in UI but NOT in database
- **TODO:** Add retry logic or queue for later submission
- **TODO:** Visual indicator in UI when submission fails

### 5. **Proof Verification**
- Backend accepts proofs but doesn't verify them yet
- **TODO:** Implement proof verification in backend
- See: `backend/lib/zk/verifier.ts`

---

## 🚀 Next Steps

### Immediate (Required for Demo):

1. ✅ **Implement offer submission** (COMPLETE)
2. ✅ **Fix backend schema violations** (COMPLETE)
3. ⏳ **Test end-to-end flow**
   - Max → Backend → Peggy → Escrow
   - Verify offers appear in database
   - Verify Peggy can find and fund them

### Short Term (Hackathon MVP):

4. **Add UUID support to dummy ads**
   - Generate UUIDs in dummy-ads.js
   - Or seed database with test ads

5. **Test with Peggy**
   - Ensure Peggy can see offers
   - Verify funding flow works
   - Check payment proof submission

6. **UI Feedback**
   - Show "Submitted to Peggy" status in ad cards
   - Display offer_id in assessment
   - Add loading states during submission

### Medium Term (Post-Hackathon):

7. **Proof Verification**
   - Implement server-side proof verification
   - Reject invalid proofs
   - Log verification results

8. **Error Handling**
   - Retry failed submissions
   - Queue offers for later
   - Better error messages to user

9. **Real SOL Pricing**
   - Integrate Pyth or Chainlink oracle
   - Dynamic lamport conversion
   - Display real-time prices

---

## 📝 Files Modified

| File | Changes | Status |
|------|---------|--------|
| `extension/ad-queue.js` | Added `submitOfferToBackend()` | ✅ |
| `extension/ad-queue.js` | Modified `generateProofsForOffer()` return type | ✅ |
| `extension/ad-queue.js` | Modified `assessCampaign()` to call submission | ✅ |
| `backend/app/api/user/offer/route.ts` | Added `advertiser_id` and `ad_id` fields | ✅ |

---

## 🎓 Key Learnings

1. **Backend API contracts** - Must match database schema constraints
2. **UUID vs Text IDs** - Important to distinguish primary keys from human-readable IDs
3. **ZK Proof Formats** - Backend expects object with keys, not array
4. **Error Handling** - Graceful degradation allows demo to continue if backend fails
5. **Logging** - Comprehensive console logs essential for debugging complex flows

---

## 📚 References

- **Architecture:** `/docs/ARCHITECTURE-PRIVACY-FIRST.md`
- **SDK Flow:** `/docs/SDK_ARCHITECTURE.md`
- **Peggy:** `/docs/PEGGY-DEVELOPER-BRIEF.md`
- **Database:** `/docs/DATABASE_SCHEMA.sql`
- **API Endpoint:** `/backend/app/api/user/offer/route.ts`
- **Advertiser Agent:** `/advertiser-agent/peggy.js`

---

## ✅ Completion Status

**Implementation:** ✅ COMPLETE  
**Testing:** ⏳ PENDING  
**Integration:** ⏳ PENDING  
**Documentation:** ✅ COMPLETE

Ready for end-to-end testing with real backend and Peggy agent!
