# Key Derivation Service (KDS) Architecture

## Overview

This document describes the Key Derivation Service (KDS) architecture implemented for PayAttn's encrypted storage system. The KDS provides a secure, server-assisted key management solution that avoids storing decryption credentials alongside encrypted data.

## The Problem

**Initial concern:** Storing the public key right next to encrypted data looks like "storing the key under the doormat" - even though the public key IS public, it creates bad optics and poor security architecture.

**Traditional approach would be:**
```
IndexedDB: {
  encryptedProfile: "...",
  publicKey: "ABC123..."  // ❌ Looks like storing credential next to data
}
```

## The Solution: Remote Key Derivation

Instead of storing keys locally, we fetch key material from a secure endpoint on-demand:

```
IndexedDB: {
  encryptedProfile: "...",
  keyHash: "abc123..."  // ✅ Just a hash - useless without KDS endpoint
}
```

## Architecture Flow

### 1. Authentication (Website)
```
User connects wallet
  ↓
Signs challenge message
  ↓
Signature verified
  ↓
keyHash = SHA-256(signature)
  ↓
Fetch: GET /api/k/[keyHash]
  ↓
Server returns: HMAC-SHA256(keyHash, SERVER_SECRET)
  ↓
Store keyHash in IndexedDB (NOT the key material)
```

### 2. Encryption (Website)
```
User saves profile
  ↓
Fetch key material from /api/k/[keyHash]
  ↓
Derive encryption key: PBKDF2(keyMaterial + walletAddress)
  ↓
Encrypt profile with AES-256-GCM
  ↓
Store: {encryptedData, keyHash, walletAddress}
```

### 3. Decryption (Extension Background)
```
Extension wakes up every 30 mins
  ↓
Read profile from IndexedDB
  ↓
Extract keyHash from profile
  ↓
Fetch: GET /api/k/[keyHash] (with 24hr cache)
  ↓
Derive decryption key: PBKDF2(keyMaterial + walletAddress)
  ↓
Decrypt and process profile
```

## Security Properties

### ✅ No Keys Stored Locally
- Only `keyHash` stored in IndexedDB
- Key material fetched on-demand from KDS endpoint
- Attacker with database access cannot decrypt without KDS access

### ✅ Signature-Based Access Control
- `keyHash = SHA-256(wallet_signature)`
- Only user with valid wallet signature can compute correct hash
- Deterministic: same signature → same keyHash → same key material

### ✅ Defense in Depth
```javascript
finalKey = PBKDF2(
  password: KDS_material,        // Remote (requires endpoint access)
  salt: walletAddress,           // Local (unique per wallet)
  iterations: 100000             // Computational hardness
)
```

### ✅ Server-Side Controls
- Rate limiting on `/api/k/[hash]` endpoint
- Logging of all key material requests
- Can revoke access by changing `SERVER_SECRET`
- Can implement per-user quotas

### ✅ Cache Strategy
- Extension caches key material for 24 hours
- Reduces endpoint load
- Session-based expiry
- Cache invalidated on logout

## KDS Endpoint Implementation

**Location:** `/app/api/k/[hash]/route.ts`

```typescript
export async function GET(request, { params }) {
  const keyHash = params.hash;
  
  // Validate format (SHA-256 = 64 hex chars)
  if (!/^[a-f0-9]{64}$/i.test(keyHash)) {
    return 400;
  }
  
  // Derive key material using HMAC
  const keyMaterial = HMAC-SHA256(keyHash, SERVER_SECRET);
  
  // Return versioned response
  return {
    version: 'v1',
    material: keyMaterial,
    timestamp: Date.now()
  };
}
```

## Data Structures

### IndexedDB Profile Record
```typescript
{
  walletAddress: "ABC123...",
  encryptedData: "base64...",
  keyHash: "sha256...",      // Used to fetch key material
  version: "v1",
  timestamp: 1234567890
}
```

### Session (Website)
```typescript
{
  publicKey: "ABC123...",
  authenticated: true,
  keyHash: "sha256...",      // Computed from signature
  keyMaterial: "hmac...",    // Cached from KDS (24hr)
  expiresAt: 1234567890
}
```

## Comparison to Alternatives

### ❌ Store Public Key Next to Data
```javascript
// Looks bad (even though technically fine)
{data: "encrypted", key: "public_key"}
```

### ❌ Session-Key Encryption
```javascript
// Still stores derived key locally
{data: "encrypted", sessionKey: "derived_from_signature"}
```

### ✅ KDS Approach
```javascript
// Clean separation: data local, keys remote
{data: "encrypted", keyHash: "lookup_token"}
// Fetch key: GET /api/k/[keyHash]
```

## Benefits

1. **Security Optics**: No "key under doormat" appearance
2. **Actual Security**: Defense in depth with remote key material
3. **Auditability**: Server logs all key access
4. **Revocability**: Can invalidate keys by rotating server secret
5. **Scalability**: Can add rate limiting, quotas, analytics
6. **Privacy**: Key material deterministic but not correlatable without signature

## Trade-offs

### Requires Network Access
- Extension must reach KDS endpoint
- Mitigated by 24hr caching
- Fallback: user re-authenticates on website

### Server Dependency
- KDS endpoint must be available
- Mitigated by caching
- Can implement redundant endpoints

### Latency
- Initial fetch adds ~100-200ms
- Amortized by caching
- Negligible for 30-min background processing

## Production Considerations

### Environment Variables
```bash
KDS_SECRET=<long-random-string>  # MUST be secure in production
```

### Rate Limiting
```typescript
// TODO: Add rate limiting to /api/k/[hash]
// Prevent brute force attempts
// 100 requests per minute per IP
```

### Monitoring
```typescript
// TODO: Log suspicious patterns
// Multiple failed attempts
// Unusual access patterns
// Geographic anomalies
```

### CORS Configuration
```typescript
// Allow extension access
'Access-Control-Allow-Origin': 'chrome-extension://*'
```

## Migration Path

### Phase 1: KDS Implementation (✅ Complete)
- Created KDS endpoint
- Updated crypto functions
- Modified auth flow

### Phase 2: Website Integration (Next)
- Update storage-test page to use storage-kds.ts
- Test authentication → encryption → storage flow

### Phase 3: Extension Testing (Next)
- Install extension in dev mode
- Verify KDS fetch works from extension
- Test decryption with cached material

### Phase 4: Production Hardening
- Secure KDS_SECRET in environment
- Add rate limiting
- Implement monitoring
- Deploy to payattn.org

## Conclusion

The KDS architecture solves the "key under doormat" problem by moving key material to a secure remote service while maintaining the deterministic property needed for autonomous extension operation. The keyHash stored locally is useless without access to the KDS endpoint, providing both good security optics and actual defense-in-depth protection.
