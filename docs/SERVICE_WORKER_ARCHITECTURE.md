# Service Worker Architecture
## Privacy-First Ad Agent with Minimal Attack Surface

**Last Updated:** November 2025  
**Status:** Implementation Phase

---

## Overview

This architecture implements a privacy-preserving ad agent that runs autonomously in the background while maintaining strong security boundaries through **code isolation** and **minimal attack surface**.

---

## Design Principles

### 1. **Separation of Concerns**
- **Main Application** (`payattn.org`): User interface, data entry, visualization
- **Service Worker** (`sw-agent.js`): Autonomous background processing, localStorage access

### 2. **Minimal Attack Surface**
- Service Worker has **ZERO npm dependencies**
- Only uses Web Crypto API (browser built-in)
- ~200 lines of auditable code
- No DOM access, no user input processing

### 3. **Data Flow Isolation**
```
User Input → Main App → Encrypt → localStorage
                                      ↓
Service Worker (background) ← Read encrypted data
     ↓
Decrypt locally → Process → Generate proofs → Submit offers
     ↓
Encrypt results → Write to localStorage
```

---

## Security Model

### Threat Model

**Protected Against:**
- ✅ Supply chain attacks in main app dependencies
- ✅ XSS in main application UI
- ✅ Compromised third-party scripts (analytics, UI libraries)
- ✅ Malicious browser extensions (origin-isolated)
- ✅ Physical device theft (data encrypted at rest)

**NOT Protected Against:**
- ❌ XSS in Service Worker itself (mitigated by minimal code)
- ❌ OS-level compromise (out of scope)
- ❌ Compromised browser (out of scope)

### Security Boundaries

```
┌─────────────────────────────────────────┐
│ Main App (payattn.org)                  │
│ ├── Next.js, React, shadcn/ui          │
│ ├── 1000+ npm packages                  │
│ ├── Complex UI logic                    │
│ └── Writes: ENCRYPTED data only         │
└─────────────────────────────────────────┘
         │ (encrypted blobs)
         ↓
    localStorage (origin: payattn.org)
         ↓
┌─────────────────────────────────────────┐
│ Service Worker (sw-agent.js)            │
│ ├── ZERO npm dependencies              │
│ ├── Only Web Crypto API                 │
│ ├── Only fetch API                      │
│ ├── ~200 lines of code                  │
│ └── Reads/Decrypts/Processes           │
└─────────────────────────────────────────┘
```

**Key Insight:** Even if main app is compromised, attacker must ALSO compromise the minimal SW code to access decrypted data autonomously.

---

## Architecture Components

### 1. Main Application (`app/`)

**Responsibilities:**
- User authentication (wallet connection + signature)
- Profile management UI (forms, display)
- Data encryption before storage
- Data decryption for display
- Service Worker registration

**Technology:**
- Next.js 16 (App Router)
- React 19
- Solana Wallet Adapter
- Encryption: Uses shared crypto functions from `lib/storage.ts`

**Security:**
- Content Security Policy (CSP)
- Input sanitization
- XSS mitigations (React auto-escaping)
- Regular dependency audits

### 2. Service Worker (`public/sw-agent.js`)

**Responsibilities:**
- Periodic background sync (every 30 minutes)
- Read encrypted data from localStorage
- Decrypt using wallet public key
- Fetch ad opportunities from API
- Generate ZK proofs (privacy-preserving)
- Submit offers to advertisers
- Cache results back to localStorage

**Technology:**
- **ZERO external dependencies**
- Web Crypto API (AES-256-GCM, PBKDF2)
- Fetch API
- Periodic Background Sync API

**Code Structure:**
```javascript
// sw-agent.js (~200 lines)
// 1. Event listeners (install, activate, periodicsync)
// 2. Pure crypto functions (copied from storage.ts)
// 3. Ad processing logic
// 4. API communication
```

**Security:**
- No npm packages → No supply chain risk
- No DOM access → No XSS vectors
- Stateless → No session hijacking
- Read-only config → Immutable behavior

### 3. Shared Crypto Library (`lib/storage.ts`)

**Responsibilities:**
- Provides pure cryptographic functions
- Used by BOTH main app AND service worker
- No external dependencies (only Web Crypto API)

**Functions:**
```typescript
// Pure functions (no dependencies):
- deriveKeyFromPublicKey(publicKey: string): Promise<CryptoKey>
- encrypt(data: string, publicKey: string): Promise<string>
- decrypt(encryptedData: string, publicKey: string): Promise<string>
```

**Security:**
- Functions are **deterministic** (same input = same output)
- Can be copied into SW as pure JS (no TypeScript, no imports)
- Easy to audit (crypto primitives only)

---

## Data Storage Schema

### localStorage Keys

```javascript
// Profile data (encrypted)
`payattn_profile_v1_{walletAddress}`
→ AES-256-GCM encrypted JSON blob

// Public key (for decryption)
`payattn_pubkey_{walletAddress}`
→ Base58 encoded wallet public key (deterministic)

// Wallet verification (session token)
`payattn_wallet_verification`
→ { walletAddress, timestamp } (24h TTL)

// Service Worker state
`payattn_sw_last_run`
→ Timestamp of last successful sync

// Ad processing results (encrypted)
`payattn_offers_{walletAddress}`
→ Encrypted array of submitted offers
```

### Encryption Scheme

**Algorithm:** AES-256-GCM (Authenticated Encryption)

**Key Derivation:**
```
Wallet Public Key (Base58)
    ↓ (decode to bytes)
PBKDF2-SHA256 (100,000 iterations)
    ↓
256-bit Encryption Key
    ↓
AES-256-GCM (random IV per encryption)
```

**Security Properties:**
- ✅ Authenticated (detects tampering)
- ✅ Deterministic key (same wallet = same key)
- ✅ Random IV (different ciphertext each encryption)
- ✅ Computational difficulty (100k PBKDF2 iterations)

---

## Service Worker Lifecycle

### Registration (Main App)

```javascript
// app/layout.tsx or useEffect
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw-agent.js')
    .then(reg => {
      console.log('SW registered');
      // Request periodic sync permission
      return reg.periodicSync.register('fetch-ads', {
        minInterval: 30 * 60 * 1000 // 30 minutes
      });
    });
}
```

### Periodic Sync (Every 30 Minutes)

```javascript
// sw-agent.js
self.addEventListener('periodicsync', async (event) => {
  if (event.tag === 'fetch-ads') {
    event.waitUntil(processAdOpportunities());
  }
});
```

### Background Processing Flow

```
1. Check session validity
   ↓
2. Read encrypted data from localStorage
   ↓
3. Read public key from localStorage
   ↓
4. Decrypt user profile locally
   ↓
5. Fetch new ad opportunities (API call)
   ↓
6. Filter ads based on user preferences
   ↓
7. Generate ZK proofs (privacy-preserving)
   ↓
8. Submit offers to advertisers
   ↓
9. Store results in localStorage (encrypted)
   ↓
10. Update last run timestamp
```

---

## API Communication

### Endpoints

**Ad Opportunities:**
```
GET https://api.payattn.org/ads/opportunities
Response: [{ id, category, requirements, bid_range }]
```

**Submit Offers:**
```
POST https://api.payattn.org/offers
Body: {
  ad_id: string,
  proof: ZKProof,
  bid_amount: number,
  wallet_address: string
}
```

### Privacy Guarantees

- ❌ Personal data NEVER sent in plaintext
- ✅ Only ZK proofs sent (proves properties without revealing data)
- ✅ Wallet address is public (on-chain anyway)
- ✅ Bid amounts don't reveal identity

---

## Security Best Practices

### For Main Application

1. **Content Security Policy (CSP)**
   ```
   Content-Security-Policy:
     default-src 'self';
     script-src 'self' 'strict-dynamic';
     connect-src 'self' https://api.payattn.org;
     img-src 'self' data: https:;
     style-src 'self' 'unsafe-inline';
   ```

2. **Dependency Management**
   - Run `npm audit` weekly
   - Use `npm ci` in production
   - Pin dependency versions
   - Review supply chain (Snyk, Socket)

3. **Input Sanitization**
   - Never `dangerouslySetInnerHTML` with user input
   - Use React's auto-escaping
   - Validate all form inputs

### For Service Worker

1. **Zero Dependencies**
   - Never import npm packages
   - Only use Web Crypto API
   - Copy pure functions from storage.ts

2. **Code Review**
   - Every change reviewed by 2+ people
   - Security audit before deployment
   - Diff checking (ensure no unexpected changes)

3. **Monitoring**
   - Log decryption attempts
   - Alert on suspicious patterns
   - Rate limit crypto operations

---

## Implementation Checklist

### Phase 1: Preparation
- [x] Design architecture (this document)
- [ ] Extract pure crypto functions from storage.ts
- [ ] Write sw-agent.js skeleton
- [ ] Set up CSP headers

### Phase 2: Service Worker
- [ ] Implement periodic sync
- [ ] Implement localStorage read/write
- [ ] Implement decryption logic
- [ ] Test with encrypted test data

### Phase 3: Integration
- [ ] Register SW from main app
- [ ] Test full flow (UI → encrypt → SW → decrypt)
- [ ] Test multi-wallet scenarios
- [ ] Test browser close/reopen

### Phase 4: Security
- [ ] Security audit of sw-agent.js
- [ ] Penetration testing
- [ ] Set up monitoring/logging
- [ ] Document incident response

### Phase 5: Production
- [ ] Deploy to staging
- [ ] User acceptance testing
- [ ] Performance monitoring
- [ ] Production rollout

---

## Testing Strategy

### Unit Tests
- Crypto functions (encrypt/decrypt)
- Key derivation (PBKDF2)
- Multi-wallet isolation

### Integration Tests
- Main app ↔ localStorage
- SW ↔ localStorage
- End-to-end encryption flow

### Security Tests
- XSS injection attempts
- localStorage isolation
- Session expiry handling
- Malformed data handling

### Performance Tests
- Decryption speed (should be < 100ms)
- SW startup time
- Memory usage during sync

---

## Monitoring & Observability

### Metrics to Track

1. **Service Worker Health**
   - Registration success rate
   - Sync frequency (should be ~30 min)
   - Decryption success rate
   - API call success rate

2. **Security Events**
   - Failed decryption attempts
   - Session expiry events
   - Suspicious API calls
   - localStorage size anomalies

3. **Performance**
   - Sync duration (target: < 5s)
   - Decryption time (target: < 100ms)
   - API response time

---

## Future Enhancements

### Short Term
- Add ZK proof generation library (snarkjs)
- Implement offer negotiation logic
- Add result notifications to UI

### Medium Term
- Hardware security module integration (TPM/Secure Enclave)
- Multi-device sync (encrypted)
- Backup/restore functionality

### Long Term
- Federated learning (local ML models)
- Advanced privacy techniques (differential privacy)
- Decentralized offer matching

---

## FAQ

**Q: Can other websites access the encrypted data?**  
A: No. localStorage is origin-isolated. Only `payattn.org` can access it.

**Q: What if the Service Worker is compromised?**  
A: The minimal code (200 lines, zero deps) makes this very hard. Regular audits required.

**Q: Can the data be decrypted without the public key?**  
A: No. PBKDF2 with 100k iterations makes brute-forcing computationally infeasible.

**Q: What happens if I lose my wallet?**  
A: Data is encrypted with that wallet's public key. New wallet = new storage.

**Q: Does the SW work when browser is fully closed?**  
A: Depends on browser. Chrome: yes (background sync). Safari: limited. Firefox: partial.

---

## Conclusion

This architecture achieves:
- ✅ Privacy (data stays local, encrypted)
- ✅ Security (minimal attack surface)
- ✅ Autonomy (SW runs in background)
- ✅ Scalability (works offline, multiple wallets)

The key innovation is **code isolation** - keeping sensitive operations (decryption, processing) in a minimal, auditable Service Worker separate from the complex main application.

**Next Steps:** Implement sw-agent.js and integrate with existing storage layer.
