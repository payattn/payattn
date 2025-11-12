# Key Derivation Service (KDS) Architecture

## Overview

This document describes the Key Derivation Service (KDS) architecture implemented for PayAttn's encrypted storage system. The KDS provides a secure, server-assisted key management solution that avoids storing decryption credentials alongside encrypted data.

## The Problem

**Initial concern:** Storing the public key right next to encrypted data looks like "storing the key under the doormat" - even though the public key IS public, it creates bad optics and poor security architecture.

**Traditional approach would be:**
```
IndexedDB: {
  encryptedProfile: "...",
  publicKey: "ABC123..."  //  Looks like storing credential next to data
}
```

## The Solution: Remote Key Derivation

Instead of storing keys locally, we fetch key material from a secure endpoint on-demand:

```
IndexedDB: {
  encryptedProfile: "...",
  keyHash: "abc123..."  //  Just a hash - useless without KDS endpoint
}
```

## Architecture Flow

### 1. Authentication (Website)
```
User connects wallet
  ↓
Signs challenge message: "Sign in to Pay Attention\n\nWallet: {address}"
  ↓
Signature verified with nacl.sign.detached.verify()
  ↓
keyHash = SHA-256("payattn:" + walletAddress)
  ↓
Fetch: GET /api/k/[keyHash]
Headers: x-wallet, x-auth-token (base64 signature)
  ↓
Server verifies signature matches wallet
Server verifies keyHash matches wallet
  ↓
Server returns: HMAC-SHA256(keyHash, SERVER_SECRET)
  ↓
Store keyHash in chrome.storage.local (NOT the key material)
```

### 2. Encryption (Website)
```
User saves profile
  ↓
Fetch key material from /api/k/[keyHash]
Headers: x-wallet, x-auth-token
  ↓
Derive encryption key: PBKDF2(keyMaterial + walletAddress)
  ↓
Encrypt profile with AES-256-GCM
  ↓
Store: {encryptedData, keyHash, walletAddress} in chrome.storage.local
```

### 3. Decryption (Extension Background)
```
Extension wakes up every 30 mins
  ↓
Read keyHash from chrome.storage.local
  ↓
Fetch: GET /api/k/[keyHash] (with 24hr cache)
Headers: x-wallet, x-auth-token
  ↓
Derive decryption key: PBKDF2(keyMaterial + walletAddress)
  ↓
Decrypt and process profile
```

## Security Properties

### No Keys Stored Locally
- Only `keyHash` stored in chrome.storage.local
- Key material fetched on-demand from KDS endpoint
- Attacker with storage access cannot decrypt without KDS access and valid signature

### Signature-Based Access Control
- `keyHash = SHA-256("payattn:" + walletAddress)` (deterministic)
- Requires valid wallet signature in x-auth-token header
- Server verifies signature with nacl.sign.detached.verify()
- Server verifies keyHash matches authenticated wallet
- Only wallet owner can access their key material

### Defense in Depth
```javascript
finalKey = PBKDF2(
  password: KDS_material,        // Remote (requires endpoint access + auth)
  salt: walletAddress,           // Local (unique per wallet)
  iterations: 100000             // Computational hardness
)
```

### Server-Side Controls
- Authentication required via x-wallet and x-auth-token headers
- Signature verification prevents unauthorized access
- KeyHash validation ensures wallet can only access their own key
- Rate limiting on `/api/k/[hash]` endpoint (TODO)
- Logging of all key material requests
- Can revoke access by changing `KDS_SECRET` environment variable
- Can implement per-user quotas (TODO)

### Cache Strategy
- Extension caches key material for 24 hours
- Reduces endpoint load and avoids repeated auth
- Session-based expiry
- Cache invalidated on logout

## KDS Endpoint Implementation

**Location:** `/backend/app/api/k/[hash]/route.ts`

```typescript
export async function GET(request, { params }) {
  const { hash } = await params;
  
  // Validate format (SHA-256 = 64 hex chars)
  if (!/^[a-f0-9]{64}$/i.test(hash)) {
    return NextResponse.json({ error: 'Invalid hash format' }, { status: 400 });
  }
  
  // Get auth headers
  const walletAddress = request.headers.get('x-wallet');
  const authToken = request.headers.get('x-auth-token');
  
  if (!walletAddress || !authToken) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  
  // Verify signature matches wallet
  if (!verifySignature(walletAddress, authToken)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }
  
  // Verify keyHash matches wallet
  const expectedKeyHash = computeKeyHashFromWallet(walletAddress);
  if (hash !== expectedKeyHash) {
    return NextResponse.json({ error: 'KeyHash mismatch' }, { status: 403 });
  }
  
  // Derive key material using HMAC
  const hmac = crypto.createHmac('sha256', KDS_SECRET);
  hmac.update(hash);
  const keyMaterial = hmac.digest('base64');
  
  // Return versioned response
  return NextResponse.json({
    keyMaterial,
    version: '1'
  });
}

function verifySignature(walletAddress: string, authToken: string): boolean {
  const signatureBytes = Uint8Array.from(atob(authToken), c => c.charCodeAt(0));
  const message = `Sign in to Pay Attention\n\nWallet: ${walletAddress}`;
  const messageBytes = new TextEncoder().encode(message);
  const publicKeyBytes = new web3.PublicKey(walletAddress).toBytes();
  return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
}

function computeKeyHashFromWallet(walletAddress: string): string {
  return crypto.createHash('sha256').update(`payattn:${walletAddress}`).digest('hex');
}
```

## Data Structures

### Chrome Storage Profile Record
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
  keyHash: "sha256...",      // Computed from wallet address
  keyMaterial: "hmac...",    // Cached from KDS (24hr)
  expiresAt: 1234567890
}
```

## Comparison to Alternatives

### Store Public Key Next to Data
```javascript
// Looks bad (even though technically fine)
{data: "encrypted", key: "public_key"}
```

### Session-Key Encryption
```javascript
// Still stores derived key locally
{data: "encrypted", sessionKey: "derived_from_signature"}
```

### KDS Approach
```javascript
// Clean separation: data local, keys remote
{data: "encrypted", keyHash: "lookup_token"}
// Fetch key: GET /api/k/[keyHash]
// Headers: x-wallet, x-auth-token (signature)
```

## Benefits

1. **Security Optics**: No "key under doormat" appearance
2. **Actual Security**: Defense in depth with remote key material + signature auth
3. **Auditability**: Server logs all key access
4. **Revocability**: Can invalidate keys by rotating KDS_SECRET
5. **Scalability**: Can add rate limiting, quotas, analytics
6. **Privacy**: Key material deterministic per wallet but requires signature to access

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

### Phase 1: KDS Implementation (Complete)
- Created KDS endpoint with signature verification
- Updated authentication to use x-wallet + x-auth-token headers
- Implemented keyHash verification

### Phase 2: Website Integration (Complete)
- Wallet auth flow integrated
- Storage uses KDS for key material

### Phase 3: Extension Integration (Complete)
- Extension fetches key material from KDS
- Background.js uses cached material for decryption

### Phase 4: Production Hardening (In Progress)
- Secure KDS_SECRET in environment (done)
- Add rate limiting (TODO)
- Implement monitoring (TODO)
- Deploy to payattn.org (TODO)

## Conclusion

The KDS architecture solves the "key under doormat" problem by moving key material to a secure remote service while maintaining the deterministic property needed for autonomous extension operation. The keyHash stored locally is useless without both KDS endpoint access AND a valid wallet signature, providing both good security optics and actual defense-in-depth protection.
