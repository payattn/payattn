# Encrypted Storage & JWT Token Management

## Implementation Summary: WP01.2.3 & WP01.2.4

This document describes the encrypted storage and JWT token management implementation for the payattn agent dashboard.

## Features Implemented

### WP01.2.3: AES-256-GCM Encrypted localStorage

**File:** `/lib/storage.ts`

Implements secure client-side storage using Web Crypto API with the following features:

- **Encryption Algorithm:** AES-256-GCM
- **Key Derivation:** PBKDF2 with 100,000 iterations, SHA-256 hash
- **IV Generation:** Random 12-byte initialization vector per encryption
- **Storage Format:** Base64-encoded (IV + ciphertext)

#### API Methods

```typescript
import { EncryptedStorage, UserProfile } from '@/lib/storage';

// Encrypt raw data
const encrypted = await EncryptedStorage.encrypt(data, publicKey);

// Decrypt data
const decrypted = await EncryptedStorage.decrypt(encrypted, publicKey);

// Save user profile (auto-encrypted)
const profile: UserProfile = {
  demographics: { age: 25, gender: 'other' },
  interests: ['tech', 'finance'],
  location: { country: 'US', state: 'CA' },
  preferences: { maxAdsPerHour: 10, painThreshold: 5 }
};
await EncryptedStorage.saveProfile(profile, publicKey);

// Load user profile (auto-decrypted)
const loaded = await EncryptedStorage.loadProfile(publicKey);

// Check if profile exists
const exists = EncryptedStorage.hasProfile();

// Delete all data
await EncryptedStorage.deleteAllData();
```

#### UserProfile Interface

```typescript
interface UserProfile {
  demographics?: {
    age: number;
    gender?: string;
  };
  interests?: string[];
  location?: {
    country: string;
    state?: string;
  };
  financial?: {
    incomeRange?: string;
  };
  preferences?: {
    maxAdsPerHour: number;
    painThreshold: number;
  };
}
```

#### Security Notes

- **MVP Implementation:** Encryption key is derived deterministically from wallet public key
- **Production Recommendation:** Use user-provided passphrase for key derivation
- **Data Never Transmitted:** All encryption/decryption happens client-side
- **Storage Key:** `payattn_profile_v1` in localStorage

### WP01.2.4: JWT Token Management

**File:** `/lib/auth.ts`

Implements session token management for maintaining authenticated state across page reloads.

#### API Methods

```typescript
import { AuthService, SessionToken } from '@/lib/auth';

// Create session token (after wallet authentication)
const jwt = AuthService.createSessionToken(walletAddress, publicKey);

// Get current session token
const token: SessionToken | null = AuthService.getSessionToken();

// Check if session is valid
const isValid = AuthService.isSessionTokenValid();

// Clear session (logout)
AuthService.clearSessionToken();
```

#### SessionToken Interface

```typescript
interface SessionToken {
  walletAddress: string;
  publicKey: string;
  issuedAt: number;      // Unix timestamp
  expiresAt: number;     // Unix timestamp
}
```

#### Token Details

- **Storage Key:** `payattn_session` in localStorage
- **Format:** Simplified JWT (header.payload, no signature for MVP)
- **Expiration:** 24 hours (configurable via `SESSION_DURATION`)
- **Validation:** Automatic expiration check on retrieval

#### Security Notes

- **MVP Implementation:** Uses base64-encoded JSON without cryptographic signature
- **Production Recommendation:** Use proper JWT library with HMAC/RSA signature
- **First-Party Only:** No cookies, all data in localStorage
- **Auto-Cleanup:** Expired tokens automatically removed on access

## Integration with Wallet Connection

The existing `AuthService` class has been extended with JWT token management while maintaining backward compatibility with the existing wallet authentication flow:

1. User connects wallet (WP01.2.1-2)
2. Wallet signs authentication challenge
3. Signature is verified
4. **NEW:** Session token is created via `createSessionToken()`
5. **NEW:** Session persists across page reloads via `getSessionToken()`

### Example Integration

```typescript
import { AuthService } from '@/lib/auth';
import { EncryptedStorage } from '@/lib/storage';

// After successful wallet authentication
const challenge = AuthService.generateChallenge();
const signature = await AuthService.requestSignature(wallet, challenge);

if (AuthService.verifySignature(publicKey, signature, challenge.message)) {
  // Create both old and new session formats
  AuthService.createSession(publicKey.toString()); // Existing
  AuthService.createSessionToken(walletAddress, publicKey.toString()); // NEW
  
  // Load user profile
  const profile = await EncryptedStorage.loadProfile(publicKey.toString());
}

// On page load, check session
const token = AuthService.getSessionToken();
if (token) {
  // User is authenticated, load their profile
  const profile = await EncryptedStorage.loadProfile(token.publicKey);
}

// On logout
AuthService.clearSession(); // Existing
AuthService.clearSessionToken(); // NEW
await EncryptedStorage.deleteAllData(); // Optional: clear profile
```

## Testing Checklist

- [x] ✅ Encrypt/decrypt profile data successfully
- [x] ✅ Data persists across page reloads
- [x] ✅ Session expires after 24 hours (via timestamp validation)
- [x] ✅ `deleteAllData()` removes all traces
- [ ] ⏳ Manual testing in Chrome, Firefox, Safari required

## Browser Compatibility

All features use standard Web Crypto API supported in:
- ✅ Chrome 37+
- ✅ Firefox 34+
- ✅ Safari 11+
- ✅ Edge 79+

No external dependencies required for encryption/JWT functionality.

## Dependencies

- **Web Crypto API** (native): AES-GCM encryption, PBKDF2 key derivation
- **localStorage** (native): Client-side storage
- **Base64 encoding** (native): `btoa()` / `atob()`

## File Structure

```
agent-dashboard/
├── lib/
│   ├── auth.ts           # JWT token management + existing auth
│   └── storage.ts        # NEW: Encrypted storage wrapper
└── STORAGE_AUTH_README.md # This file
```

## Next Steps

For production deployment, consider:

1. **Replace deterministic key derivation** with user passphrase-based encryption
2. **Add JWT signature verification** using HMAC-SHA256 or RSA
3. **Implement key rotation** for enhanced security
4. **Add encrypted backup/restore** functionality
5. **Consider IndexedDB** for larger data storage needs
6. **Add rate limiting** for failed decryption attempts

## Security Considerations

### Current MVP Approach
- ✅ Client-side encryption (data never transmitted in plaintext)
- ✅ AES-256-GCM (authenticated encryption)
- ✅ Random IV per encryption
- ⚠️ Deterministic key derivation (acceptable for MVP)
- ⚠️ Unsigned JWT tokens (acceptable for MVP)

### Production Requirements
- 🔒 User passphrase for key derivation
- 🔒 Signed JWT tokens with server verification
- 🔒 Secure key storage (consider Web Crypto non-extractable keys)
- 🔒 Rate limiting on decryption attempts
- 🔒 Audit logging for security events

## Support

For questions or issues with this implementation, refer to:
- Main README: `/agent-dashboard/README.md`
- Wallet Auth README: `/agent-dashboard/WALLET_AUTH_README.md`
- Implementation Summary: `/agent-dashboard/IMPLEMENTATION_SUMMARY.md`
