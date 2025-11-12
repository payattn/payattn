# Advertiser Proof Verification - Design Constraints

**Created:** November 6, 2025  
**Purpose:** Document the architecture and constraints for advertiser-side ZK-SNARK proof verification to avoid circular design discussions.

---

## Core Architecture

```
Extension (Browser)                    Backend Server (Node.js)
─────────────────                      ────────────────────────
                                       
1. Generate Proof                      
   ↓ (works perfectly)                 
   Using: snarkjs-patched.js           
   Time: 1-3 seconds                   
   
2. Send Proof to Server ───────────→  3. Automated Cron Job
   (via API)                              ↓
                                       Runs every N minutes
                                       (no human interaction)
                                          ↓
                                       4. Verify Proof
                                          Must work in Node.js
                                          Must be automated
                                          NO browser available
                                          ↓
                                       5. Store Result / Pay User
```

---

## Hard Constraints (Non-Negotiable)

### 1. **Server-Side Verification ONLY**
- **CANNOT** use browser
- **CANNOT** use client-side JavaScript
- **CANNOT** rely on user interaction
- **MUST** work in Node.js server environment
- **MUST** work in automated cron job

### 2. **Automated Process**
- Runs on schedule (e.g., every 30 minutes)
- No human clicks "Verify" button
- No browser window opens
- Process runs server-side as background job

### 3. **Advertiser's Server**
- Verification happens on advertiser's infrastructure
- They control the cron job
- They process results automatically
- They credit users based on valid proofs

---

## What We Have

###  Working: Extension (Client-Side)
- **Location:** Chrome extension service worker
- **Library:** `snarkjs-patched.js` (6.6MB, browser-optimized)
- **Function:** Proof generation
- **Performance:** 1-3 seconds per proof
- **Status:** **PERFECT** - Do not modify!

###  Broken: Backend (Server-Side)
- **Location:** Next.js API routes (Node.js)
- **Attempted Libraries:**
  1. npm `snarkjs` - **HANGS** at verification (BN128 curve issue)
  2. Browser bundle (`snarkjs-patched.js`) - **CANNOT LOAD** (no `self`, `importScripts` in Node.js)
  3. `rapidsnark` npm package - **NOT A LIBRARY** (C++ source code, requires compilation)
  4. `@iden3/snarkjs-wasm` - **DOESN'T EXIST**

---

## Technical Problem

### The BN128 Curve Hang
- npm snarkjs uses WASM/native code for elliptic curve operations
- BN128 curve initialization **hangs indefinitely** in Node.js
- Not a timeout - actual infinite loop or deadlock
- Affects BOTH proof generation AND verification
- Observed: 8+ minutes, never completes

### Why Browser Bundle Doesn't Work
- Extension's `snarkjs-patched.js` is built for browsers
- Uses `self` global (service worker/browser specific)
- Uses `importScripts()` (Web Workers API)
- Node.js has neither - is a different runtime
- `require()` doesn't execute browser bundles correctly

---

## What We Need

A **Node.js-compatible Groth16 verifier** that:
1. ✅ Works in Node.js (not browser)
2. ✅ Doesn't hang on BN128 operations
3. ✅ Can verify proofs in reasonable time (<10 seconds)
4. ✅ Works with standard Groth16 format (our circuits use this)
5. ✅ Can be called from cron job / API route

---

## Failed Approaches (Do Not Retry)

| Approach | Why It Failed | Status |
|----------|---------------|--------|
| Use browser-based verification | Architecture constraint - must be server-side | ❌ Invalid |
| Copy `snarkjs-patched.js` to backend | Browser bundle incompatible with Node.js | ❌ Tried |
| Use npm `snarkjs` | Hangs indefinitely on verification | ❌ Tried |
| Install `rapidsnark` | Not a usable package (C++ source) | ❌ Tried |
| Install `@iden3/snarkjs-wasm` | Package doesn't exist | ❌ Tried |
| "Just do it in the browser" | Violates automated cron job constraint | ❌ Invalid |

---

## Valid Solution Directions

### Option 1: Pure JavaScript Groth16 Verifier
- Find or build a pure JS implementation (no WASM/native)
- May be slower, but shouldn't hang
- Libraries to explore:
  - `circomlibjs` - has pure JS crypto
  - `ffjavascript` - field operations in JS
  - Manual implementation using existing primitives

### Option 2: Web Service Wrapper
- Run verification in separate process/container
- Use browser environment (Puppeteer/Playwright)
- Cron job calls this service
- Isolates hanging issue

### Option 3: Alternative ZK System
- Switch from Groth16 to different proof system
- Consider PLONK, STARKs, or Bulletproofs
- **Major change** - requires circuit rewrite

### Option 4: Compiled Native Verifier
- Use actual compiled `rapidsnark` binary
- Shell out from Node.js to run verification
- Requires build process and deployment

### Option 5: snarkjs Fork/Patch
- Fork npm snarkjs
- Debug and fix the BN128 hanging issue
- Contribute fix upstream
- **Most effort** but cleanest solution

### Option 6: Cloudflare Workers (⭐ PROMISING!)
- **Why This Could Work:**
  - Cloudflare Workers run V8 JavaScript (same as Chrome extension!)
  - Support Web APIs (crypto.subtle, etc.) like browsers
  - Can use Python workers (py_ecc, mature crypto libraries)
  - Premium account = longer execution time
  - Edge compute = fast, distributed, scalable
  
- **Architecture:**
  ```
  Backend Cron Job → HTTP POST to Cloudflare Worker → Verification
                                    ↓
                            Returns { valid: true/false }
  ```

- **Key Advantages:**
  - ✅ Same V8 runtime as working extension (not Node.js!)
  - ✅ Could use SAME snarkjs-patched.js that works in extension
  - ✅ Avoids Node.js BN128 hanging entirely
  - ✅ Simple integration (just HTTP endpoint)
  - ✅ Maintains automated cron job architecture
  - ✅ Scalable (can handle concurrent verifications)
  - ✅ Fast (edge compute)

- **Potential Concerns:**
  - Size limits: snarkjs is 6.6MB (need to check worker limits)
  - Memory limits: Crypto operations can be heavy
  - Execution time: Premium account allows longer runs
  - WASM support: Should work like browser

- **Complexity:** LOW - Single HTTP endpoint, minimal code change in backend

---

## Current Status

**Blocker:** No working Node.js Groth16 verifier  
**Impact:** Cannot complete end-to-end testing  
**Chosen Solution:** **Option 6 - Cloudflare Workers** ✅  
**Status:** Worker created in `/cf-worker` directory, ready for deployment

### Implementation Details

**Location:** `/cf-worker/`
- `worker.js` - Main verification endpoint
- `snarkjs.js` - Copy of working extension library (6.6MB)
- `verification-keys/` - Public verification keys
- `README.md` - Complete setup documentation
- `DEPLOYMENT_CHECKLIST.md` - Step-by-step deployment guide

**Architecture:**
```
Extension → Backend Cron Job → POST to CF Worker → Verification Result
```

**Next Steps:**
1. Deploy worker to Cloudflare (`wrangler deploy`)
2. Get worker URL
3. Update backend `verifier.ts` to call worker endpoint
4. Test end-to-end verification

**Expected Performance:**
- Verification time: 100-250ms (faster than Node.js could ever be)
- No hanging issues (different runtime from Node.js)
- Scalable (edge compute, distributed globally)

---

## DO NOT
