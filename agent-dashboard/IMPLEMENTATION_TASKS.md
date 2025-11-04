# PayAttn KDS Implementation - Hackathon Sprint (2 Days)

**Goal:** Minimal changes to achieve secure architecture for hackathon demo.

**What's Changing:**
1. Remove keyHash from IndexedDB (security fix)
2. Add Phantom auth to extension (replicate website flow)
3. Store keyHash in chrome.storage.local only
4. Keep website UI working (shares data with extension)

**What's NOT Changing:**
- Website still works standalone
- Extension optional (for auto-refresh)
- Both use same IndexedDB for profiles

**Story:** "Website works great! Install extension to keep your ad queue topped up automatically."

---

## Day 1: Core Security Fix (4-6 hours)

### ✅ Task 1: Remove keyHash from IndexedDB Schema (30 min)

- [ ] Update `storage-idb.ts` ProfileRecord interface
  - Remove `keyHash` field
  - Keep: `{walletAddress, encryptedData, version, timestamp}`
- [ ] Update `saveProfileIDB()` to not require keyHash parameter
- [ ] Update storage-kds.ts to get keyHash from session instead

**Files:** `lib/storage-idb.ts`, `lib/storage-kds.ts`

---

### ✅ Task 2: Store keyHash in Session Only (Website) (30 min)
- [ ] Update `AuthSession` interface to keep keyHash
- [ ] Website stores keyHash in session (already does this!)
- [ ] Website uses keyHash from session when encrypting
- [ ] No changes needed to website UI

**Files:** `lib/auth.ts` (already done)

---

### ✅ Task 3: Create Extension Storage for keyHash (30 min)
- [ ] Add helper functions to `extension/background.js`:
  ```javascript
  async function saveKeyHash(keyHash) {
    await chrome.storage.local.set({ payattn_keyHash: keyHash });
  }
  
  async function getKeyHash() {
    const result = await chrome.storage.local.get('payattn_keyHash');
    return result.payattn_keyHash;
  }
  ```

**Files:** `extension/background.js`

---

### ✅ Task 4: Add Phantom Auth to Extension (2-3 hours)
- [ ] Create `extension/setup.html` (simple HTML page)
  - Copy wallet adapter setup from website
  - Simple form for wallet connection
  - "Sign In" button
  
- [ ] Create `extension/setup.js`
  - Include Solana wallet adapter via CDN
  - Connect Phantom wallet
  - Sign message (same as website)
  - Compute keyHash from signature
  - Save to chrome.storage.local
  - Show success + close tab

**Files:** `extension/setup.html` (new), `extension/setup.js` (new)

---

### ✅ Task 5: Update Extension Popup to Trigger Setup (30 min)
- [ ] Update `extension/popup.html`
  - Add "Authenticate" button if no keyHash found
  - Button opens setup.html in new tab
  
- [ ] Update `extension/popup.js`
  - Check if keyHash exists on load
  - If not: show "Please authenticate" message
  - Button click: `chrome.tabs.create({ url: 'setup.html' })`

**Files:** `extension/popup.html`, `extension/popup.js`

---

### ✅ Task 6: Update Background Script to Use chrome.storage (1 hour)
- [ ] Modify `processProfile()` in `extension/background.js`
  - Get keyHash from `chrome.storage.local` (not from profile record)
  - Fetch key material from KDS using keyHash
  - Get encrypted profile from IndexedDB (no keyHash in it)
  - Decrypt and process
  - Handle missing keyHash gracefully

**Files:** `extension/background.js`

---

## Day 2: Testing & Polish (4-6 hours)

### ✅ Task 7: Test Complete Flow (1 hour)
- [ ] Test website auth flow (should still work)
- [ ] Test extension installation
- [ ] Test extension setup (Phantom auth in new tab)
- [ ] Verify keyHash saved to chrome.storage.local
- [ ] Verify no keyHash in IndexedDB
- [ ] Test background script can decrypt
- [ ] Test "Run Now" in extension popup

---

### ✅ Task 8: Add Rate Limiting to KDS (30 min)
- [ ] Simple in-memory rate limiter in KDS endpoint
  ```typescript
  const rateLimits = new Map(); // IP -> {count, resetAt}
  // Allow 100 requests per hour per IP
  ```
- [ ] Return 429 if exceeded

**Files:** `app/api/k/[hash]/route.ts`

---

### ✅ Task 9: Error Handling (1 hour)
- [ ] Extension setup: handle wallet rejection
- [ ] Extension setup: handle KDS errors
- [ ] Background script: handle missing keyHash
- [ ] Background script: handle KDS unavailable
- [ ] Show user-friendly error messages

**Files:** `extension/setup.js`, `extension/background.js`, `extension/popup.js`

---

### ✅ Task 10: UI Polish (1-2 hours)
- [ ] Style extension setup page (match website branding)
- [ ] Add loading states
- [ ] Add success confirmation
- [ ] Update popup to show:
  - "Authenticated ✓" status
  - Last run time
  - Next run time
  - "Re-authenticate" button if needed

**Files:** `extension/setup.html`, `extension/popup.html`

---

### ✅ Task 11: Documentation (1 hour)
- [ ] Update README with:
  - "Extension optional but recommended"
  - How to install extension
  - How to authenticate extension
  - Security model explanation
- [ ] Add comments to code
- [ ] Create simple SECURITY.md explaining the architecture

**Files:** `README.md`, `SECURITY.md` (new)

---

## Hackathon Demo Checklist

### Must Work:
- [x] Website: Connect wallet, create profile, save (ALREADY WORKS)
- [ ] Extension: Install, open setup, authenticate with Phantom
- [ ] Extension: keyHash stored in chrome.storage.local
- [ ] IndexedDB: No keyHash in profile records
- [ ] Extension: Background script decrypts and processes profiles
- [ ] Extension: "Run Now" button triggers cycle

### Demo Flow:
1. Show website - create profile (works today)
2. Show IndexedDB - data encrypted, no keyHash visible
3. Install extension
4. Click extension → opens setup
5. Authenticate with Phantom
6. Show chrome.storage.local has keyHash
7. Click "Run Now" in extension
8. Show console logs - profile decrypted successfully
9. Explain: "Malicious website can't access keyHash (different storage)"

---

## What's NOT Changing (Keep Simple)

- ❌ No website UI changes needed
- ❌ No extension-to-website messaging (not needed for hackathon)
- ❌ No dashboard redesign
- ❌ Website keeps working standalone
- ❌ Extension is purely optional enhancement

---

## Quick Implementation Notes

**Fastest approach for Task 4 (Extension auth):**
1. Copy the wallet adapter HTML from website's `page.tsx`
2. Use CDN links for wallet adapter (no bundling needed)
3. Minimal JavaScript to connect + sign + save
4. Total: ~100 lines of code

**Wallet Adapter CDN:**
```html
<script src="https://unpkg.com/@solana/web3.js@latest/lib/index.iife.min.js"></script>
<script src="https://unpkg.com/@solana/wallet-adapter-base@latest/lib/index.iife.min.js"></script>
<script src="https://unpkg.com/@solana/wallet-adapter-wallets@latest/lib/index.iife.min.js"></script>
```

---

## Time Estimate

**Day 1:** 4-6 hours
- Task 1-3: 1.5 hours (storage changes)
- Task 4: 2-3 hours (extension auth page)
- Task 5-6: 1.5 hours (popup + background updates)

**Day 2:** 4-6 hours  
- Task 7: 1 hour (testing)
- Task 8-9: 1.5 hours (rate limiting + errors)
- Task 10: 1-2 hours (UI polish)
- Task 11: 1 hour (docs)

**Total: 8-12 hours over 2 days**

---

## Priority Order

1. **CRITICAL:** Remove keyHash from IndexedDB (Task 1)
2. **CRITICAL:** Store keyHash in chrome.storage (Task 3)
3. **CRITICAL:** Extension auth page (Task 4)
4. **CRITICAL:** Background script uses chrome.storage (Task 6)
5. **IMPORTANT:** Testing (Task 7)
6. **NICE:** Error handling (Task 9)
7. **NICE:** UI polish (Task 10)
8. **NICE:** Rate limiting (Task 8)

**If time is tight:** Skip tasks 8, 10, 11. Focus on 1-7.

