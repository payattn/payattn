# Testing the KDS Architecture

This guide walks through testing the complete Key Derivation Service (KDS) flow.

## Prerequisites

1. **Extension installed** in Chrome/Brave (load unpacked from `extension/` folder)
2. **Dev server running**: `npm run dev` in `agent-dashboard/`
3. **Phantom wallet** installed with some test SOL

## Test Flow

### 1. Website Authentication & Profile Creation

1. Navigate to http://localhost:3000/storage-test
2. Click "Connect Wallet" and connect Phantom
3. Click "Verify" to authenticate (signs message with wallet)
4. **Check console logs:**
   ```
   [Crypto] Hashing signature, length: 64
   [Crypto] Generated hash: f87b4d...  (64 chars)
   ```
5. Fill out profile form:
   - Age: 30
   - Interests: web3, defi, nfts
   - Country: US
6. Click " Save Profile"
7. **Verify in console:** No errors, "Profile saved successfully"

### 2. Verify IndexedDB Storage

1. Open Chrome DevTools  Application  IndexedDB  payattn_db
2. Check `profiles` store:
   ```javascript
   {
     walletAddress: "ABC123...",
     encryptedData: "base64...",  //  Encrypted
     keyHash: "f87b4d...",         //  Hash stored (not key!)
     version: "v1",
     timestamp: 1730678400000
   }
   ```
3. **Verify:** `keyHash` is 64 hex characters, NOT the actual decryption key

### 3. Test KDS Endpoint

1. Copy the `keyHash` from IndexedDB
2. In terminal:
   ```bash
   curl http://localhost:3000/api/k/[YOUR_KEY_HASH]
   ```
3. **Expected response:**
   ```json
   {
     "version": "v1",
     "material": "abc123...",
     "timestamp": 1730678400000
   }
   ```
4. **Check server console:**
   ```
   [KDS] Received hash: f87b4d...
   [KDS] Hash length: 64
   [KDS] Hash matches pattern: true
   ```

### 4. Test Profile Loading (Website)

1. Refresh the page (http://localhost:3000/storage-test)
2. Connect wallet again (session persisted)
3. Click " Load Profile"
4. **Verify:** Form fills with saved data
5. **Check console:**
   ```
   [Crypto] Fetching key material from KDS
   Profile decrypted successfully
   ```

### 5. Test Extension Background Script

1. Open Chrome  Extensions  PayAttn Extension  Background Page
2. **Check console logs:**
   ```
   [Extension] PayAttn Agent loaded
   [Extension] Setting up 30-minute alarm
   [Extension] Extension installed and alarm set!
   ```
3. Click extension icon  popup opens
4. Click "Run Now" button
5. **Expected console output:**
   ```
   [Extension] Starting agent cycle #1234
   [Extension] Found 1 profile records
   [Extension] Processing profile: ABC123...
   [Extension] Fetching key material from KDS
   [Extension] Decrypted profile: {demographics: {...}, interests: [...]}
   [Extension] Cycle #1234 completed
   ```

### 6. Verify KDS Caching

1. In extension background console:
   ```javascript
   // First call - fetches from KDS
   [Extension] Fetching key material from KDS
   
   // Second call (within 24hrs) - uses cache
   [Extension] Using cached key material
   ```

### 7. Test Cross-Context Access

**This is the key test - verifying website and extension share data!**

1. **Website:** Save a new profile with different interests
2. **Extension:** Click "Run Now"
3. **Expected:** Extension logs show NEW interests (not old ones)
4. **Verify:** Both website and extension can decrypt the same data

### 8. Security Verification

1. **In DevTools Application  IndexedDB:**
   -  `encryptedData` is base64 gibberish (can't read)
   -  `keyHash` is just a hash (useless without KDS endpoint)
   -  No plaintext keys stored anywhere

2. **Attacker scenario:**
   - Has database dump with `encryptedData` + `keyHash`
   - Cannot decrypt without:
     a) Access to KDS endpoint at /api/k/[hash]
     b) Valid wallet signature to generate correct hash
   
3. **Server-side controls:**
   - Can rate-limit KDS endpoint
   - Can log suspicious access patterns
   - Can revoke by rotating SERVER_SECRET

## Expected Outcomes

###  Success Indicators

- [ ] Wallet authentication works (signature prompt)
- [ ] Profile saves without errors
- [ ] Profile loads with correct data
- [ ] IndexedDB shows `keyHash` field (not public key)
- [ ] KDS endpoint returns key material (200 response)
- [ ] Extension can decrypt profiles
- [ ] Extension console shows decrypted profile data
- [ ] Website and extension see same data
- [ ] Cache works (second fetch faster)

###  Common Issues

**Issue:** `400 Bad Request` on `/api/k/[hash]`
- **Cause:** Hash format invalid
- **Fix:** Check signature type (should be Uint8Array)

**Issue:** Extension can't load
- **Cause:** `importScripts()` error with modules
- **Fix:** Remove `"type": "module"` from manifest.json

**Issue:** Profile won't decrypt
- **Cause:** Wrong keyHash or missing KDS material
- **Fix:** Re-authenticate to generate fresh keyHash

**Issue:** Extension can't fetch from KDS
- **Cause:** CORS or endpoint URL wrong
- **Fix:** Check CORS headers in route.ts, verify endpoint URL

## Performance Benchmarks

**Expected timings:**
- Wallet signature: ~2s (user interaction)
- KDS fetch (first): ~100-200ms
- KDS fetch (cached): <5ms
- Profile encryption: ~50ms
- Profile decryption: ~50ms
- Full save cycle: ~200-300ms
- Full load cycle: ~150-250ms
- Extension cycle: ~500ms per profile

## Production Checklist

Before deploying to payattn.org:

- [ ] Set `KDS_SECRET` environment variable (long random string)
- [ ] Update `CRYPTO_CONSTANTS.KDS_ENDPOINT` in extension to production URL
- [ ] Add rate limiting to KDS endpoint (100 req/min)
- [ ] Add monitoring/alerting for KDS errors
- [ ] Test on Brave browser (primary target)
- [ ] Verify CORS allows extension origin
- [ ] Test with multiple profiles
- [ ] Test 30-minute alarm works
- [ ] Verify cache expiry (24hr TTL)
- [ ] Load test KDS endpoint

## Debugging Tips

**View KDS requests:**
```javascript
// In browser console
performance.getEntriesByType('resource')
  .filter(r => r.name.includes('/api/k/'))
```

**Check extension storage:**
```javascript
// In extension background console
chrome.storage.local.get(null, console.log)
```

**Manually trigger extension:**
```javascript
// In extension background console
runAgentCycle()
```

**Clear all data:**
```javascript
// Website console
indexedDB.deleteDatabase('payattn_db')
```

## Success!

If all tests pass, you have:
1.  Secure key management (KDS)
2.  No "key under doormat" problem
3.  Autonomous extension operation
4.  Shared data between website and extension
5.  Defense-in-depth encryption
6.  Privacy-first architecture

**The KDS architecture is working!** 
