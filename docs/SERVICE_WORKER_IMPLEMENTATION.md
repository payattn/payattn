# Service Worker Implementation Guide

## Overview

The PayAttn autonomous agent runs as a Service Worker that wakes up every 30 minutes to:
1. Read encrypted user profiles from localStorage
2. Decrypt profiles using wallet public keys
3. Generate privacy-preserving ZK proofs
4. Submit bids to advertisers autonomously

## Architecture

### Security Model

**Zero-Dependency Service Worker**
- Service Worker (`/public/sw-agent.js`) has ZERO npm dependencies
- Uses only Web Crypto API (browser built-in)
- ~200 lines of code (fully auditable)
- Minimizes attack surface for XSS exploits

**Main Application**
- Can have 1000+ npm packages (Next.js, React, UI libraries, etc.)
- Writes encrypted blobs to localStorage
- Does not handle autonomous processing

**Isolation Strategy**
- Both run on same origin (payattn.org) - required for localStorage access
- Service Worker is minimal and isolated from main app's dependency tree
- Origin isolation protects localStorage from other websites
- Code-level isolation minimizes risk from compromised npm packages

### Files

```
/public/sw-agent.js                     # Service Worker (zero deps, ~250 lines)
/lib/crypto-pure.ts                     # Pure crypto functions (shared)
/lib/service-worker-manager.ts           # SW registration & management
/lib/storage.ts                         # Encrypted storage wrapper
/app/storage-test/page.tsx              # Test UI
SERVICE_WORKER_ARCHITECTURE.md          # Comprehensive architecture doc
```

## How It Works

### 1. Encryption

**Key Derivation (PBKDF2)**
```
Wallet Public Key (Base58)
  → Base58 Decode
  → PBKDF2-SHA256 (100,000 iterations, salt: "payattn.org")
  → AES-256 Key
```

**Encryption (AES-256-GCM)**
```
User Profile (JSON)
  → AES-256-GCM Encrypt (random IV per operation)
  → IV + Ciphertext
  → Base64 Encode
  → Store in localStorage
```

### 2. Storage Schema

**localStorage Key Format**
```
payattn_profile_v1_{walletPublicKey}
```

**Storage Data Structure**
```json
{
  "publicKey": "ABC123...",        // Base58 wallet public key
  "encryptedData": "XYZ789...",    // Base64 IV + ciphertext
  "version": "v1"                   // Storage schema version
}
```

### 3. Service Worker Lifecycle

**Registration (from main app)**
```javascript
navigator.serviceWorker.register('/sw-agent.js', { scope: '/' });
registration.periodicSync.register('payattn-agent', {
  minInterval: 30 * 60 * 1000  // 30 minutes
});
```

**Background Execution**
```
Browser wakes SW → 
  periodicSync event ('payattn-agent') →
    runAgentCycle() →
      loadAllProfiles() →
        [for each profile] decryptData() →
          processProfile() →
            (generate ZK proofs, submit bids)
```

### 4. Data Flow

```
┌─────────────────────────────────────────────────────────┐
│ Main App (Next.js, React, 1000+ packages)              │
│                                                          │
│ 1. User authenticates with Phantom wallet               │
│ 2. App derives encryption key from public key           │
│ 3. App encrypts profile data (AES-256-GCM)              │
│ 4. App writes encrypted blob to localStorage            │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ localStorage (origin-isolated)
                     │ Key: payattn_profile_v1_{wallet}
                     │ Value: {publicKey, encryptedData, version}
                     │
┌────────────────────▼────────────────────────────────────┐
│ Service Worker (ZERO deps, ~200 lines)                  │
│                                                          │
│ 1. Wakes up every 30 minutes (periodicSync)             │
│ 2. Reads encrypted blobs from localStorage              │
│ 3. Decrypts using wallet public key (Web Crypto API)    │
│ 4. Generates ZK proofs for ad targeting                 │
│ 5. Submits bids to advertisers                          │
│ 6. Logs activity for debugging                          │
└──────────────────────────────────────────────────────────┘
```

## Testing

### 1. Start Development Server

```bash
cd agent-dashboard
npm run dev
```

### 2. Open Test Page

Navigate to: `http://localhost:3000/storage-test`

### 3. Test Flow

**Authentication & Storage:**
1. Click "Connect Wallet" (Phantom)
2. Click "Authenticate" (sign message)
3. Enter profile data (name, email)
4. Click "Save Profile" (encrypted to localStorage)
5. Refresh page - profile auto-loads (24h session)

**Service Worker:**
1. Click "Register SW" 
2. Check "Periodic Sync Status" (should show enabled)
3. Click "Trigger Manual Sync" to test immediately
4. Open DevTools Console - watch SW logs

**Expected Console Output:**
```
[SW] Install event
[SW] Activate event
[SW] Manual sync requested
[SW] Starting agent cycle...
[SW] Found 1 profiles
[SW] Processing profile for wallet: ABC12345...
[SW] Profile processed: ABC12345...
[SW] Agent cycle completed successfully
```

### 4. Verify localStorage

**DevTools → Application → Local Storage → http://localhost:3000**

Should see:
```
payattn_profile_v1_ABC123...  →  {"publicKey":"ABC...","encryptedData":"XYZ...","version":"v1"}
payattn_wallet_verification   →  {"walletAddress":"ABC...","timestamp":1234567890}
```

### 5. Test Multi-Wallet Support

1. Save profile with Wallet A
2. Disconnect Wallet A
3. Connect Wallet B  
4. Save profile with Wallet B
5. Check "Dev Info" section - should show both wallets
6. Disconnect Wallet B, reconnect Wallet A
7. Profile A auto-loads (Wallet B's data preserved)

## Browser Compatibility

### Periodic Background Sync Support

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome 80+ | ✅ Yes | Full support |
| Edge 80+ | ✅ Yes | Chromium-based |
| Firefox | ❌ No | Not implemented |
| Safari | ❌ No | Not implemented |

**Fallback:** For browsers without Periodic Background Sync, implement:
- Manual sync button (already present)
- Foreground sync on page load
- Push notifications to wake SW

### Service Worker Support

| Browser | Support |
|---------|---------|
| Chrome 40+ | ✅ Yes |
| Edge 17+ | ✅ Yes |
| Firefox 44+ | ✅ Yes |
| Safari 11.1+ | ✅ Yes |

## Security Considerations

### Threat Model

**Protected Against:**
- Other websites accessing localStorage (origin isolation)
- Supply chain attacks in main app (SW has zero deps)
- Brute force attacks on encryption (PBKDF2 100k iterations)
- Man-in-the-middle (data encrypted at rest)

**NOT Protected Against:**
- XSS in Service Worker itself (code audit required)
- Malicious code injected into sw-agent.js
- Browser extensions with localStorage access
- Physical access to device while browser unlocked

### Best Practices

1. **Code Review:** Manually review sw-agent.js (only ~200 lines)
2. **Integrity Checks:** Consider Content Security Policy (CSP) headers
3. **Monitoring:** Log all SW activity, alert on anomalies
4. **Updates:** Never modify sw-agent.js without security review
5. **Dependencies:** NEVER add npm packages to Service Worker

### Incident Response

**If XSS Vulnerability Discovered in SW:**
1. Immediately unregister Service Worker
2. Rotate all encryption keys (users re-authenticate)
3. Patch vulnerability
4. Security audit before re-deployment
5. Notify affected users

## Implementation Checklist

- [x] Extract pure crypto functions (crypto-pure.ts)
- [x] Create Service Worker (sw-agent.js)
- [x] Implement SW registration (service-worker-manager.ts)
- [x] Update storage.ts to use pure crypto
- [x] Add SW controls to test page
- [x] Document architecture (SERVICE_WORKER_ARCHITECTURE.md)
- [x] Document implementation (this file)
- [ ] Add ZK proof generation (snarkjs integration)
- [ ] Implement ad fetching API
- [ ] Implement bid submission API
- [ ] Add SW monitoring/logging
- [ ] Security audit
- [ ] Browser compatibility testing
- [ ] Production deployment

## Next Steps

### 1. ZK Proof Integration

**Library:** snarkjs (https://github.com/iden3/snarkjs)

**Challenge:** snarkjs has dependencies - violates zero-dep policy

**Solution Options:**
- A) Allow snarkjs as single exception (carefully vetted)
- B) Use WebAssembly compiled circuit (no JS deps)
- C) Server-side proof generation (privacy compromise)

**Recommendation:** Option A (snarkjs is well-audited, widely used)

### 2. API Endpoints

**Required APIs:**
- `GET /api/ads/available` - Fetch available ad campaigns
- `POST /api/bids/submit` - Submit anonymous bids with ZK proofs
- `GET /api/agent/health` - SW health check

### 3. Monitoring

**Metrics to Track:**
- SW registration success rate
- Periodic sync execution rate
- Profile decryption failures
- Bid submission success rate
- Average processing time per cycle

**Logging Strategy:**
- SW logs to IndexedDB (persistent)
- Main app fetches logs via postMessage
- Server-side aggregation for analytics

### 4. Production Deployment

**Before Launch:**
1. Security audit of sw-agent.js
2. Load testing (100k+ users)
3. Browser compatibility verification
4. Fallback implementation for non-Chromium browsers
5. Incident response plan
6. User documentation
7. Privacy policy update

## Debugging

### View Service Worker State

**Chrome DevTools:**
1. Open DevTools (F12)
2. Application Tab → Service Workers
3. View status, update, unregister

### View Console Logs

**SW logs appear in:**
- DevTools Console (when DevTools open)
- chrome://serviceworker-internals (all SW logs)

### Common Issues

**SW not registering:**
- Check HTTPS (required for SW, localhost exempted)
- Check scope (must be '/' or parent of pages)
- Check browser support

**Periodic sync not working:**
- Only supported in Chromium browsers
- Requires user engagement (visited site recently)
- May be throttled by browser

**Decryption failing:**
- Wrong wallet connected
- Storage version mismatch
- Corrupted data in localStorage

## References

- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Periodic Background Sync](https://developer.mozilla.org/en-US/docs/Web/API/Web_Periodic_Background_Synchronization_API)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [SERVICE_WORKER_ARCHITECTURE.md](./SERVICE_WORKER_ARCHITECTURE.md) - Detailed architecture
- [snarkjs](https://github.com/iden3/snarkjs) - ZK proof library

## Support

For questions or issues:
- Check DevTools Console for error messages
- Review logs in chrome://serviceworker-internals
- Open GitHub issue with reproduction steps

---

**Status:** Service Worker skeleton implemented, crypto functions extracted, testing framework ready. Next: ZK proof integration.
