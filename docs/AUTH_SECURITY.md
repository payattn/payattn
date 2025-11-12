# Authentication Security Implementation

## Summary
Implemented auth token security for KDS (Key Derivation Service) endpoint to prevent unauthorized access to encryption key material.

## Problem
Previously, the KDS endpoint `/api/k/[keyHash]` had a security vulnerability:
- keyHash was deterministic based on wallet address: `SHA-256("payattn:" + walletAddress)`
- Anyone with a public wallet address could compute the keyHash
- No authentication required to fetch key material
- If attacker obtained encrypted data, they could decrypt it

## Solution
Auth token approach with server-side signature verification:
1. Store original wallet signature as `authToken` during authentication
2. Require `X-Wallet` and `X-Auth-Token` headers on KDS requests
3. Server verifies signature matches wallet before returning key material
4. Prevents unauthorized access even if keyHash is known

## Security Model

### Key Derivation
```
keyHash = SHA-256("payattn:" + walletAddress)
```
- Deterministic: same wallet always gets same keyHash
- Enables profile persistence across re-authentications
- Public information: anyone can compute this

### Authentication
```
authToken = base64(signature)
```
- Signature: Ed25519 signature from Solana wallet
- Message: "Sign in to Pay Attention\n\nWallet: ${walletAddress}"
- Proves ownership of wallet private key
- Required for every KDS request

### KDS Endpoint Security
```
GET /api/k/[keyHash]
Headers:
  X-Wallet: <wallet address>
  X-Auth-Token: <base64 signature>
```

Server verification process:
1. Check required headers present (401 if missing)
2. Verify signature matches wallet using nacl.sign.detached.verify (403 if invalid)
3. Compute expected keyHash from wallet address
4. Verify requested keyHash matches computed keyHash (403 if mismatch)
5. Return key material if all checks pass

## Implementation Details

### Files Modified

#### Server-Side (KDS Endpoint)
- **app/api/k/[hash]/route.ts**
  - Added `verifySignature()` function using @solana/web3.js and tweetnacl
  - Added `computeKeyHashFromWallet()` for deterministic key derivation
  - Modified `GET` handler to require X-Wallet and X-Auth-Token headers
  - Returns 401 for missing auth, 403 for invalid auth
  - Added OPTIONS handler for CORS

#### Website (Client)
- **lib/auth.ts**
  - Added `authToken` field to `AuthSession` interface
  - `createSession()` now stores signature as base64 authToken
  - Added `encodeSignature()` helper function
  - `getKeyMaterial()` passes authToken to fetchKeyMaterial()

- **lib/crypto-pure.ts**
  - Updated `fetchKeyMaterial()` signature: `(keyHash, walletAddress, authToken)`
  - Sends X-Wallet and X-Auth-Token headers
  - Better error handling for 401/403 responses

- **hooks/useAuth.ts**
  - `authenticate()` passes authToken to syncAuthToExtension()
  - Session restore syncs authToken on mount

- **lib/extension-sync.ts**
  - Updated `syncAuthToExtension()` to accept optional authToken parameter
  - Passes authToken via postMessage to content script

#### Extension
- **extension/content.js**
  - Forwards authToken from website to background script

- **extension/background.js**
  - SAVE_AUTH handler stores authToken in chrome.storage.local
  - Disconnect handler clears authToken
  - Updated `fetchKeyMaterial()` to accept and send auth headers
  - Updated `getKeyMaterial()` to pass auth parameters
  - Updated `processProfile()` to read authToken from storage

- **extension/popup.js**
  - Reads authToken from chrome.storage.local
  - Passes authToken to fetchKeyMaterial() calls
  - Shows error if authToken missing

- **extension/profile.js**
  - Reads authToken from chrome.storage.local on init
  - Passes authToken to all fetchKeyMaterial() calls (load and save)

- **extension/crypto.js**
  - Updated `fetchKeyMaterial()` to accept and send auth headers
  - Better error handling for auth failures

## Data Flow

### Authentication Flow
1. User signs message with Phantom wallet on website
2. Website:
   - Computes keyHash = SHA-256("payattn:" + walletAddress)
   - Stores authToken = base64(signature)
   - Saves to localStorage
   - Sends to extension via postMessage
3. Extension:
   - Receives keyHash, walletAddress, authToken
   - Stores all three in chrome.storage.local
   - Updates popup UI

### Profile Encryption Flow
1. Extension reads keyHash, walletAddress, authToken from storage
2. Calls KDS: GET /api/k/[keyHash] with X-Wallet and X-Auth-Token headers
3. Server verifies signature → returns key material
4. Extension derives encryption key from material + wallet address
5. Encrypts profile data with AES-256-GCM
6. Stores encrypted data in chrome.storage.local

### Profile Decryption Flow
1. Extension reads encrypted data, keyHash, walletAddress, authToken
2. Calls KDS with authentication headers
3. Server verifies → returns key material
4. Extension derives decryption key
5. Decrypts profile data
6. Displays in popup

### Disconnect Flow
1. User disconnects wallet on website
2. Website calls clearAuth()
3. Sends empty auth values to extension
4. Extension clears chrome.storage.local
5. Popup shows setup screen

## Security Properties

### Defense in Depth
1. **Server-side authentication**: Signature verification prevents unauthorized KDS access
2. **Deterministic keys**: Same wallet = same keyHash enables profile persistence
3. **Client-side encryption**: Profile data encrypted in extension storage
4. **Key material separation**: Server holds material, client has wallet-specific salt
5. **Session management**: Auth tokens cached with expiration

### Attack Scenarios

####  Attacker knows wallet address
- Can compute keyHash ✓
- CANNOT access KDS without valid signature ✗
- No key material → cannot decrypt

####  Attacker intercepts encrypted data
- Has encrypted profile ✓
- CANNOT compute keyHash without wallet address ✗
- CANNOT access KDS without signature ✗
- No key material → cannot decrypt

####  Attacker has keyHash + encrypted data
- Knows keyHash ✓
- Has encrypted data ✓
- CANNOT access KDS without signature ✗
- No key material → cannot decrypt

####  Valid user with signature
- Has wallet address ✓
- Can compute keyHash ✓
- Can sign message (has private key) ✓
- KDS verifies signature ✓
- Gets key material ✓
- Can decrypt profile ✓

## Testing

### Manual Tests
1. **Valid authentication**:
   - Authenticate on localhost:3000/wallet-auth
   - Check extension popup shows auth status
   - Create/edit profile in extension
   - Disconnect and reconnect → profile should persist

2. **Unauthorized access**:
   ```bash
   # Should return 401
   curl http://localhost:3000/api/k/[keyHash]
   
   # Should return 403 (invalid signature)
   curl -H "X-Wallet: invalid" -H "X-Auth-Token: fake" \
        http://localhost:3000/api/k/[keyHash]
   ```

3. **Profile persistence**:
   - Create profile while authenticated
   - Disconnect wallet
   - Reconnect wallet (new signature!)
   - Profile should still decrypt (deterministic keyHash)

### Chrome DevTools Checks
```javascript
// Check storage
chrome.storage.local.get(['payattn_walletAddress', 'payattn_keyHash', 'payattn_authToken'])

// Should have all three after authentication
// Should be empty after disconnect
```

## Remaining Work
- [ ] Add rate limiting to KDS endpoint (prevent brute force)
- [ ] Add request logging for security auditing
- [ ] Consider adding nonce/timestamp to prevent replay attacks
- [ ] Add authToken refresh mechanism for long sessions
- [ ] Add error telemetry for failed auth attempts

## Notes
- Hackathon implementation - suitable for demo
- Production would benefit from:
  - JWT tokens instead of raw signatures
  - Token refresh mechanism
  - Better rate limiting
  - DDoS protection
  - Security audit
