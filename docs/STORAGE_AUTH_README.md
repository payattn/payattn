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
- Chrome 37+
- Firefox 34+
- Safari 11+
- Edge 79+

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
- Client-side encryption (data never transmitted in plaintext)
- AES-256-GCM (authenticated encryption)
- Random IV per encryption
- ⚠️ Deterministic key derivation (acceptable for MVP)
- ⚠️ Unsigned JWT tokens (acceptable for MVP)

### Production Requirements
- 🔒 User passphrase for key derivation
- 🔒 Signed JWT tokens with server verification
- 🔒 Secure key storage (consider Web Crypto non-extractable keys)
- 🔒 Rate limiting on decryption attempts
- 🔒 Audit logging for security events

---

## Chrome Extension Profile Storage

**Updated:** November 9, 2025

The Chrome extension uses a different storage format than the web dashboard due to `chrome.storage.local` API requirements.

### Storage Format

**Storage Key:** `payattn_profile_{walletAddress}`

**Value Structure:**
```javascript
{
  walletAddress: string,      // Owner's wallet address
  encryptedData: string,      // Base64-encoded (IV + ciphertext) - ENTIRE encrypted blob
  version: number,            // Schema version (currently 1)
  timestamp: number           // Unix timestamp (milliseconds)
}
```

### Critical Implementation Details

⚠️ **IMPORTANT:** The `encryptedData` field contains the complete base64 string that includes both IV and ciphertext concatenated together. This is the output from `encryptDataWithMaterial()`.

**File:** `extension/crypto.js`

#### Encryption (Saving Profile)

```javascript
// In extension/profile.js
const profileJson = JSON.stringify(profile);
const encrypted = await encryptDataWithMaterial(
  profileJson,      // Plain JSON string
  keyMaterial,      // From KDS
  walletAddress     // Salt for key derivation
);

// encrypted is a base64 string: base64(IV + ciphertext)

const profileData = {
  walletAddress: walletAddress,
  encryptedData: encrypted,  // ← Store the complete base64 string
  version: 1,
  timestamp: Date.now()
};

await chrome.storage.local.set({
  [`payattn_profile_${walletAddress}`]: profileData
});
```

#### Decryption (Loading Profile)

```javascript
// WRONG ❌ - Don't pass the entire object
const profileData = await decryptDataWithMaterial(
  encryptedProfile,           // This is an object!
  keyMaterial,
  walletAddress
);

// CORRECT ✅ - Extract encryptedData string first
const encryptedDataString = encryptedProfile.encryptedData;  // Just the base64 string
const decryptedJson = await decryptDataWithMaterial(
  encryptedDataString,        // Pass only the base64 string
  keyMaterial,
  walletAddress
);
const profileData = JSON.parse(decryptedJson);  // Parse JSON string to object
```

### Common Mistakes

1. **Passing entire object to decrypt function**
   - ❌ `decryptDataWithMaterial(encryptedProfile, ...)`
   - ✅ `decryptDataWithMaterial(encryptedProfile.encryptedData, ...)`

2. **Forgetting to parse JSON after decryption**
   - ❌ `const profile = await decryptDataWithMaterial(...)`
   - ✅ `const json = await decryptDataWithMaterial(...); const profile = JSON.parse(json);`

3. **Mixing up storage formats**
   - Dashboard uses: `{encryptedData, iv}` as separate fields
   - Extension uses: `encryptedData` as single concatenated base64 string

### Base64 Encoding Details

The `encryptDataWithMaterial()` function in `crypto.js` returns a base64-encoded string where:

```
encryptedData = base64(IV || ciphertext)
              = base64(12 bytes || encrypted bytes)
```

The `decryptDataWithMaterial()` function expects this exact format:
1. Decode base64 to get raw bytes
2. Extract first 12 bytes as IV
3. Remaining bytes are ciphertext
4. Decrypt using AES-256-GCM
5. Return decrypted UTF-8 string (which is JSON)

**File Reference:** `extension/crypto.js` lines 85-105

```javascript
async function decryptDataWithMaterial(encryptedData, keyMaterial, walletAddress) {
  const key = await deriveKeyFromMaterial(keyMaterial, walletAddress);
  const combined = base64ToArrayBuffer(encryptedData);  // ← Expects base64 string
  const iv = combined.slice(0, CRYPTO_CONSTANTS.IV_LENGTH);
  const ciphertext = combined.slice(CRYPTO_CONSTANTS.IV_LENGTH);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: CRYPTO_CONSTANTS.AES_ALGORITHM, iv: iv },
    key,
    ciphertext
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);  // ← Returns JSON string, not object
}
```

### ZK-SNARK Proof Generation Integration

When generating ZK-SNARK proofs (in `ad-queue.js`), the profile must be decrypted correctly:

```javascript
// Load encrypted profile from storage
const profileResult = await chrome.storage.local.get(`payattn_profile_${walletAddress}`);
const encryptedProfile = profileResult[`payattn_profile_${walletAddress}`];

// Fetch key material from backend
const keyMaterial = await window.fetchKeyMaterial(keyHash, walletAddress, authToken);

// Decrypt profile - extract encryptedData string first
const encryptedDataString = encryptedProfile.encryptedData;
const decryptedJson = await window.decryptDataWithMaterial(
  encryptedDataString,
  keyMaterial,
  walletAddress
);
const profileData = JSON.parse(decryptedJson);

// Now access profile fields for proof generation
const userAge = profileData.demographics?.age;
const proofPackage = await window.ZKProver.generateAgeProof(userAge, minAge, maxAge);
```

### Debugging Tips

If you encounter `InvalidCharacterError` from `atob()`:

1. **Check what you're passing to decrypt:**
   ```javascript
   console.log('Type:', typeof encryptedProfile);
   console.log('Has encryptedData?:', 'encryptedData' in encryptedProfile);
   console.log('encryptedData type:', typeof encryptedProfile.encryptedData);
   console.log('Sample:', encryptedProfile.encryptedData.substring(0, 50));
   ```

2. **Verify base64 format:**
   - Should only contain: `A-Z a-z 0-9 + / =`
   - No whitespace, newlines, or special characters
   - Length should be multiple of 4 (with padding)

3. **Check storage structure:**
   ```javascript
   const stored = await chrome.storage.local.get(`payattn_profile_${walletAddress}`);
   console.log(JSON.stringify(stored, null, 2));
   ```

### Related Files

- `extension/crypto.js` - Encryption/decryption functions
- `extension/profile.js` - Profile save/load UI
- `extension/ad-queue.js` - ZK proof generation (uses decryption)
- `docs/KDS_ARCHITECTURE.md` - Key Derivation Service details

## Support

For questions or issues with this implementation, refer to:
- Main README: `/agent-dashboard/README.md`
- Wallet Auth README: `/agent-dashboard/WALLET_AUTH_README.md`
- Implementation Summary: `/agent-dashboard/IMPLEMENTATION_SUMMARY.md`
