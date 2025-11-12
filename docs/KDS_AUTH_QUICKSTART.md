# KDS Authentication Security - Quick Start

## What Was Implemented

Fixed critical security vulnerability in the Key Derivation Service (KDS) endpoint where anyone with a wallet address could access encryption key material.

### Security Flow (Now)
```
User  Signs message  authToken stored
Extension  Calls KDS with X-Wallet + X-Auth-Token headers
Server  Verifies signature  Returns key material (if valid)
```

## Quick Test

1. **Start dev server**:
```bash
npm run dev
```

2. **Authenticate**:
- Visit http://localhost:3000/wallet-auth
- Connect Phantom wallet
- Sign message

3. **Test KDS security**:
```bash
./test-kds-auth.sh
```

Expected results:
- Request without headers  401 Unauthorized
- Request with fake signature  403 Forbidden
- Extension with valid auth  Profile decrypts successfully

## Key Files

### Modified Server Files
- `app/api/k/[hash]/route.ts` - Added signature verification
- `lib/auth.ts` - Store and pass authToken
- `lib/crypto-pure.ts` - Send auth headers to KDS

### Modified Extension Files  
- `extension/background.js` - Store authToken, pass to KDS
- `extension/popup.js` - Read authToken from storage
- `extension/profile.js` - Pass authToken to KDS calls
- `extension/crypto.js` - Send auth headers

## How It Works

### 1. Deterministic Key Derivation
```javascript
keyHash = SHA-256("payattn:" + walletAddress)
```
- Same wallet always gets same keyHash
- Enables profile persistence across re-authentications

### 2. Authentication Token
```javascript
authToken = base64(signature)
```
- Proves ownership of wallet private key
- Required for every KDS request

### 3. Server Verification
```javascript
// On every KDS request:
1. Check X-Wallet and X-Auth-Token headers exist
2. Verify signature matches wallet using Ed25519
3. Verify keyHash matches wallet address  
4. Return key material if all checks pass
```

## Security Properties

 **Defense in Depth**
- Server-side signature verification
- Deterministic keys for persistence
- Client-side encryption
- Separate key material storage

 **Attack Prevention**
- Attacker with wallet address: CANNOT access KDS
- Attacker with keyHash: CANNOT access KDS
- Attacker with encrypted data: CANNOT decrypt

 **Valid User**
- Has wallet private key
- Can sign messages
- KDS verifies signature
- Gets key material
- Can decrypt profile

## Testing Checklist

- [ ] Start dev server
- [ ] Authenticate on /wallet-auth
- [ ] Check extension popup shows auth status
- [ ] Create profile in extension
- [ ] Verify profile decrypts
- [ ] Run `./test-kds-auth.sh` to verify 401/403 errors
- [ ] Disconnect and reconnect  profile should persist

## Next Steps

For production deployment:
- Add rate limiting to prevent brute force
- Implement request logging for auditing
- Consider JWT tokens instead of raw signatures
- Add token refresh mechanism
- Security audit

## Documentation

See `AUTH_SECURITY.md` for complete implementation details.
