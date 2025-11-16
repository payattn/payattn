# End-to-End Testing Guide

## Overview

This guide walks you through testing the complete ZK-SNARK proof verification flow from extension to backend.

## Prerequisites

- Extension loaded with circuits installed
- Backend running at `http://localhost:3000`
- Verification keys deployed to backend

##  Test Scenarios

### Test 1: Range Check (Income Proof)

**Scenario:** User proves income is $35,000, which is in range [$25,000, $50,000]

#### Step 1: Generate Proof in Extension

1. Open extension page: `chrome-extension://[YOUR_EXTENSION_ID]/age-proof-test.html`
2. Open browser console (F12)
3. Run:
   ```javascript
   await testRangeCheck(35000, 25000, 50000)
   ```
4. Copy the entire proof JSON from console output

#### Step 2: Verify on Backend

1. Navigate to: http://localhost:3000/advertisers
2. Select circuit: **Range Check (Generic)**
3. Set campaign requirements:
   - Min Value: `25000`
   - Max Value: `50000`
4. Paste proof JSON into text area
5. Click ** Verify Proof**

#### Expected Result

 **Proof Verified!**
- Circuit: `range_check`
- Public Signals: `["1", "25000", "50000"]`
- Message: "Proof verified successfully"

---

### Test 2: Set Membership (Location Proof)

**Scenario:** User proves they're in UK, which is in allowed set [US, UK, CA]

#### Step 1: Generate Proof in Extension

1. Open extension page: `chrome-extension://[YOUR_EXTENSION_ID]/age-proof-test.html`
2. Open browser console (F12)
3. Run:
   ```javascript
   await testSetMembership("uk", ["us", "uk", "ca"])
   ```
4. Copy the entire proof JSON from console output

#### Step 2: Verify on Backend

1. Navigate to: http://localhost:3000/advertisers
2. Select circuit: **Set Membership**
3. Set campaign requirements:
   - Allowed Values: `us,uk,ca`
4. Paste proof JSON into text area
5. Click ** Verify Proof**

#### Expected Result

 **Proof Verified!**
- Circuit: `set_membership`
- Public Signals: `["1", "hash(us)", "hash(uk)", "hash(ca)", "0", "0", "0", "0", "0", "0", "0"]`
- Message: "Proof verified successfully"

---

### Test 3: Age Range (Legacy)

**Scenario:** User proves age is 35, which is in range [18, 65]

#### Step 1: Generate Proof in Extension

1. Open extension page: `chrome-extension://[YOUR_EXTENSION_ID]/age-proof-test.html`
2. Open browser console (F12)
3. Run:
   ```javascript
   await testAgeRange(35, 18, 65)
   ```
4. Copy the entire proof JSON from console output

#### Step 2: Verify on Backend

1. Navigate to: http://localhost:3000/advertisers
2. Select circuit: **Age Range**
3. Set campaign requirements:
   - Min Value: `18`
   - Max Value: `65`
4. Paste proof JSON into text area
5. Click ** Verify Proof**

#### Expected Result

 **Proof Verified!**
- Circuit: `age_range`
- Public Signals: `["1", "18", "65"]`
- Message: "Proof verified successfully"

---

## Debugging

### Hash Verification

If you need to verify that hashing works correctly:

1. On the advertiser page, click ** Hash a string**
2. Enter a value (e.g., "uk")
3. Compare with extension console:
   ```javascript
   await hashToField("uk")
   ```

Both should produce the same hash.

### Common Issues

**Issue:** "Verification key not found"
- **Solution:** Ensure verification keys are in `public/circuits/verification_keys/`

**Issue:** "Public signals don't match campaign requirements"
- **Solution:** Check that min/max values match exactly between proof and form

**Issue:** "Public set does not match campaign requirements"
- **Solution:** Ensure allowed values list is identical (case-sensitive)

**Issue:** Proof verification fails
- **Solution:**
  1. Check console for detailed error
  2. Verify proof was generated successfully
  3. Ensure proof JSON is complete (not truncated)

---

## API Testing

You can also test the API directly using curl:

### Range Check Example

```bash
curl -X POST http://localhost:3000/api/verify-proof \
  -H "Content-Type: application/json" \
  -d '{
    "circuitName": "range_check",
    "proof": {...},
    "publicSignals": ["1", "25000", "50000"],
    "campaignRequirements": {
      "min": 25000,
      "max": 50000
    }
  }'
```

### Set Membership Example

```bash
curl -X POST http://localhost:3000/api/verify-proof \
  -H "Content-Type: application/json" \
  -d '{
    "circuitName": "set_membership",
    "proof": {...},
    "publicSignals": ["1", "hash1", "hash2", ...],
    "campaignRequirements": {
      "allowedValues": ["us", "uk", "ca"]
    }
  }'
```

---

## Success Criteria

All tests should pass with:
- Cryptographic proof verification succeeds
- Public signals match campaign requirements
- UI shows green success message
- No errors in browser console
- No errors in Next.js terminal

---

## Next Steps

After successful testing:

1. **Integration:** Add proof generation to `runAgentCycle()` for autonomous operation
2. **Optimization:** Implement proof caching to avoid regenerating identical proofs
3. **Production:** Deploy verification keys and update extension API URLs
4. **Monitoring:** Add logging and analytics for proof generation/verification

---

**Status:** Ready for testing!
**Backend URL:** http://localhost:3000/advertisers
**API Endpoint:** http://localhost:3000/api/verify-proof
