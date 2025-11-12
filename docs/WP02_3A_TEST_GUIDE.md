# WP02.3a: Age Proof Test Page - Complete Guide

## Overview

You now have a full-featured, comprehensive test page for the ZK-SNARK age proof system. This page allows you to:

1. **Load & decrypt your profile** from chrome.storage
2. **Configure advertiser targeting criteria** (age range)
3. **Generate cryptographic proofs** that prove you match the criteria WITHOUT revealing your age
4. **Verify proofs** on the backend
5. **Debug every step** with detailed console logs

## Files Created

- `extension/age-proof-test.html` - UI with dark theme (matches ad-queue.html style)
- `extension/age-proof-test.js` - Full test logic with debug console

## Quick Start

### 1. Open the Test Page

In your Chrome extension (while debugging):
```
chrome-extension://YOUR_EXTENSION_ID/age-proof-test.html
```

Or navigate to it from popup.html if you add a button.

### 2. Prerequisites

You must have:
- Authenticated with Phantom wallet (saved to chrome.storage)
- Created a profile (age saved to profile.demographics.age)
- Backend running at `http://localhost:3000`

### 3. Test the Flow

**Step 1: Load Profile**
- Page automatically loads your profile on open
- Debug console shows:
  - ✅ Auth credentials fetched
  - ✅ Profile decrypted
  - 🎯 Age extracted (e.g., "User age: 35")
- Profile card displays all data (demographics, interests, location, etc.)

**Step 2: Configure Test**
- Min Age: 25 (advertiser wants people 25-65)
- Max Age: 65
- These are **public** - advertiser knows them
- Your actual age is **private** - only used inside proof generation

**Step 3: Generate Proof**
- Click "Generate Age Proof"
- Watch debug console for:
  - 📊 Configuration logged (user age, advertiser criteria, match status)
  - 🔄 Calling generateAgeProof()
  - ✅ Proof generated
- View proof details:
  - Circuit name (should be "age_range")
  - Public signals (shows [minAge, maxAge], NOT your age)
  - Full proof JSON

**Step 4: Verify on Backend**
- Click "Send to Backend & Verify"
- Watch console for:
  - 📤 Sending to /api/verify-proof
  - 📦 Payload shown (proof + public signals)
  - 📨 Backend response received
  - ✅ Valid: YES (or ❌ if something failed)
- View verification result

## Debug Console

All important events are logged with color coding:

- 🔵 **INFO** (blue) - Important events
- **SUCCESS** (green) - Operations completed
- ⚠️ **WARN** (yellow) - Important state changes
- **ERROR** (red) - Problems that need fixing
- 📄 **LOG** (gray) - Detailed data

### What to Look For

**Normal flow (all green):**
```
[TIME] 🚀 Test page initialized
[TIME] 📦 Loading profile from chrome.storage...
[TIME] ✅ Auth credentials loaded
[TIME] 🔓 Decrypting profile...
[TIME] ✅ Profile decrypted successfully
[TIME] 🎯 User age extracted: 35
[TIME] ⚡ PROOF GENERATION STARTED
[TIME] 🔄 Calling generateAgeProof(35, 25, 65)...
[TIME] ✅ Proof generated successfully
[TIME] ⚡ VERIFICATION STARTED
[TIME] 📤 Sending proof to backend: POST /api/verify-proof
[TIME] ✅ Response received from backend
[TIME] ✅ Valid: YES
```

**If something fails:**
- Look for ❌ ERROR messages
- Read the error message carefully
- Check the stack trace
- Common issues:
  - ❌ "Missing authentication credentials" → Need to authenticate with Phantom
  - ❌ "No profile found" → Need to create profile first
  - ❌ "Failed to decrypt profile" → Old profile key, recreate profile
  - ❌ "Backend error: 500" → Backend not running or has an issue

## Understanding the Proof

### What's Sent to Backend

```json
{
  "proof": {
    "pi_a": [...],
    "pi_b": [...],
    "pi_c": [...],
    "protocol": "groth16"
  },
  "publicSignals": [25, 65],
  "circuitName": "age_range"
}
```

### Privacy Guarantee

- **Your actual age (35)** - NOT in proof, NOT in publicSignals, NOT sent anywhere
- **publicSignals [25, 65]** - This is advertiser criteria, already known
- **proof** - Cryptographic evidence you fit the criteria, can't be forged

Backend can verify: "This person is age 25-65" without ever seeing "35"

## Test Scenarios

### Scenario 1: You Match (Should Pass)

User age: 35
Advertiser wants: 25-65

**Expected result:** ✅ Proof Valid

### Scenario 2: You Don't Match (Should Pass, But Show Non-Match)

User age: 20
Advertiser wants: 25-65

**Expected result:** 
- Proof generates (proof generation always works)
- Debug console shows: "⚠️ Match: ❌ NO"
- Backend should verify: ✅ Valid (but the constraints don't match)
  - Actually, this might fail verification because proof claims you're 25-65 when you're 20
  - If so: ❌ Proof Invalid (expected - fraud attempt blocked)

### Scenario 3: Very Broad Range (Should Pass)

User age: 45
Advertiser wants: 18-100

**Expected result:** ✅ Proof Valid

### Scenario 4: Edge Cases

User age: 25 (minimum)
Advertiser wants: 25-65

**Expected result:** ✅ Proof Valid (25 is included in [25, 65])

## Troubleshooting

### Issue: "Missing authentication credentials"

**Cause:** You're not logged in

**Fix:**
1. Open popup.html
2. Click "Setup Extension"
3. Connect Phantom wallet
4. Return to test page
5. Click "Reload Profile"

### Issue: "No profile found in chrome.storage"

**Cause:** Profile hasn't been created yet

**Fix:**
1. Open popup.html
2. Click "Manage Profile"
3. Fill in profile form
4. Click "Save Profile"
5. Return to test page
6. Click "Reload Profile"

### Issue: "Profile encrypted with old key"

**Cause:** You changed wallet and profile is from old wallet

**Fix:**
1. Open popup.html
2. Click "Manage Profile"
3. Create new profile (will overwrite old one)
4. Return to test page
5. Click "Reload Profile"

### Issue: "Backend error: 404" or Connection Refused

**Cause:** Backend not running at http://localhost:3000

**Fix:**
1. Make sure dev server is running: `npm run dev` in agent-dashboard/
2. Check it's accessible at http://localhost:3000/api/campaigns
3. Verify /api/verify-proof endpoint exists (check app/api/verify-proof/route.ts)

### Issue: "Proof generation failed"

**Cause:** Problem with zk-prover.js or WASM loading

**Fix:**
1. Check console for detailed error
2. Verify these files exist:
   - extension/lib/zk-prover.js
   - extension/circuits/age_range/age_range.wasm
   - extension/circuits/age_range/witness_calculator.js
   - extension/circuits/age_range/age_range_0000.zkey
3. Check chrome DevTools for WASM loading errors
4. Try clicking "Clear" and "Reload Profile" then try again

### Issue: Console shows no output

**Cause:** Maybe crypto functions not loading

**Fix:**
1. Check DevTools Console tab (F12)
2. Verify scripts are loaded: extension/crypto-utils.js, lib/zk-prover.js
3. Refresh page
4. Check for any script errors

## Next Steps (After Testing)

### When This Works Perfectly 

Integration is ready! The test page validates:

1. ✅ Profile loading and decryption works
2. ✅ Proof generation works end-to-end
3. ✅ Backend verification accepts proofs
4. ✅ No private data leakage (check console logs)
5. ✅ System is reliable

### Then Move To:

**WP02.3b: Production Integration**
- Move this logic to background service worker for autonomous 30-minute runs
- Create UI to show proof status in popup
- Add error recovery

**WP02.3c: Advertiser Interface**
- Integrate into ad-queue.js
- Show "Send ZK Proof" button on MAKING OFFER ads
- Display verification result in ad cards

## Architecture Reminder

This test validates the core privacy guarantee:

```
User Profile (Private)        Advertiser Constraints (Public)
├─ age: 35 (SECRET)          ├─ want: age 25-65 (PUBLIC)
├─ location: UK (SECRET)      ├─ want: location {UK, US} (PUBLIC)
└─ interests: [crypto]        └─ want: interests [tech, crypto]

                    ↓

            ZK-SNARK Proof
    (proves match WITHOUT revealing 35)

                    ↓

        Backend Verification
    ✅ "User matches criteria"
    ❌ "What's their age?" → "Won't tell!"
```

## Questions?

Check:
1. Debug console for detailed flow
2. Proof JSON to see structure
3. Backend logs (if running locally)
4. DevTools console (F12) for any JavaScript errors

Proceed to WP02.3b when you see ✅ repeatedly across all test scenarios!
