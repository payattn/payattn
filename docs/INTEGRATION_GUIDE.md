# Quick Integration Guide
## WP01.2.3 & WP01.2.4: Encrypted Storage + JWT Tokens

### Quick Start

The implementation is complete and ready to use. Integration steps:

## 1. Import the Libraries

```typescript
import { AuthService, SessionToken } from '@/lib/auth';
import { EncryptedStorage, UserProfile } from '@/lib/storage';
```

## 2. After Wallet Connection (Update Existing Flow)

In your wallet connection handler, add:

```typescript
// Existing: Verify wallet signature
const isValid = AuthService.verifySignature(publicKey, signature, message);

if (isValid) {
  // Existing session (keep for now)
  AuthService.createSession(publicKey.toString());
  
  // NEW: Create JWT session token
  const jwt = AuthService.createSessionToken(
    walletAddress,
    publicKey.toString()
  );
  
  console.log('Session token created:', jwt);
}
```

## 3. On App Initialization (Add to Layout/Root)

```typescript
'use client';

import { useEffect, useState } from 'react';
import { AuthService } from '@/lib/auth';
import { EncryptedStorage } from '@/lib/storage';

export default function AppInitializer() {
  useEffect(() => {
    // Check for existing session
    const token = AuthService.getSessionToken();
    
    if (token) {
      console.log('Found session for:', token.walletAddress);
      
      // Load user profile
      loadUserProfile(token.publicKey);
    } else {
      console.log('No active session');
    }
  }, []);
  
  async function loadUserProfile(publicKey: string) {
    const profile = await EncryptedStorage.loadProfile(publicKey);
    
    if (profile) {
      console.log('Profile loaded:', profile);
      // Update app state with profile data
    }
  }
  
  return null; // Or your app content
}
```

## 4. Saving User Profile

When user updates their profile:

```typescript
async function saveUserProfile(updates: UserProfile) {
  const token = AuthService.getSessionToken();
  
  if (!token) {
    throw new Error('Not authenticated');
  }
  
  await EncryptedStorage.saveProfile(updates, token.publicKey);
  console.log('Profile saved and encrypted');
}
```

## 5. Logout Flow

Update your logout handler:

```typescript
async function handleLogout() {
  // Clear session tokens
  AuthService.clearSession();       // Old session
  AuthService.clearSessionToken();  // New JWT token
  
  // Optionally clear encrypted profile
  await EncryptedStorage.deleteAllData();
  
  console.log('Logged out successfully');
}
```

## 6. Protected Routes/Components

```typescript
function ProtectedComponent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  useEffect(() => {
    const valid = AuthService.isSessionTokenValid();
    setIsAuthenticated(valid);
    
    if (!valid) {
      // Redirect to login or show connect wallet
    }
  }, []);
  
  if (!isAuthenticated) {
    return <div>Please connect your wallet</div>;
  }
  
  return <div>Protected content</div>;
}
```

## 7. Update WalletButton Component (Optional)

Add session info display:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { AuthService } from '@/lib/auth';

export function WalletButton() {
  const [sessionInfo, setSessionInfo] = useState<string>('');
  
  useEffect(() => {
    const token = AuthService.getSessionToken();
    if (token) {
      const expiresIn = Math.floor((token.expiresAt - Date.now()) / (1000 * 60));
      setSessionInfo(`Session expires in ${expiresIn} minutes`);
    }
  }, []);
  
  return (
    <div>
      {/* Your existing wallet button */}
      {sessionInfo && <p className="text-xs">{sessionInfo}</p>}
    </div>
  );
}
```

## 8. Testing

Visit the test dashboard:

```bash
npm run dev
# Open http://localhost:3000/storage-test
```

Test the following:
1. Create a session with test public key
2. Save a test profile
3. Refresh the page - data should persist
4. Load the profile - should decrypt successfully
5. Clear all data - localStorage should be empty

## Common Patterns

### Check if User Has Profile

```typescript
if (EncryptedStorage.hasProfile()) {
  // Load and use existing profile
} else {
  // Show profile setup wizard
}
```

### Session Expiry Notification

```typescript
function SessionTimer() {
  const [expiresIn, setExpiresIn] = useState<string>('');
  
  useEffect(() => {
    const interval = setInterval(() => {
      const token = AuthService.getSessionToken();
      if (token) {
        const ms = token.expiresAt - Date.now();
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        setExpiresIn(`${hours}h ${minutes}m`);
      }
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);
  
  return expiresIn ? <div>Session expires: {expiresIn}</div> : null;
}
```

### Handling Profile Updates

```typescript
async function updatePreferences(newPreferences: UserProfile['preferences']) {
  const token = AuthService.getSessionToken();
  if (!token) return;
  
  // Load existing profile
  const current = await EncryptedStorage.loadProfile(token.publicKey) || {};
  
  // Merge updates
  const updated: UserProfile = {
    ...current,
    preferences: newPreferences,
  };
  
  // Save
  await EncryptedStorage.saveProfile(updated, token.publicKey);
}
```

## Files Reference

- **Storage API:** `/lib/storage.ts`
- **Auth/JWT API:** `/lib/auth.ts`
- **Examples:** `/lib/storage-examples.ts`
- **Test Dashboard:** `/app/storage-test/page.tsx`
- **Documentation:** `/STORAGE_AUTH_README.md`

## Key Points

- All operations are client-side only
- Data is encrypted before storage
- Session tokens expire after 24 hours
- No external dependencies needed
- Backward compatible with existing auth
- ⚠️ Manual browser testing required

## Troubleshooting

### "Encryption only available in browser context"
- Make sure you're not calling encryption in server components
- Add `'use client'` directive at top of file

### "Not authenticated" errors
- Check session token exists: `AuthService.getSessionToken()`
- Verify token hasn't expired: `AuthService.isSessionTokenValid()`

### Profile won't decrypt
- Ensure you're using the same public key that encrypted it
- Check browser console for detailed errors
- Try deleting and re-saving the profile

### Session expires too quickly
- Modify `SESSION_DURATION` in `/lib/auth.ts`
- Default is 24 hours (86400000 ms)

## Next Steps

1. Run the test dashboard and verify all features work
2. Integrate session checking into your app layout
3. Add profile management UI
4. Test in multiple browsers
5. Implement profile backup/export feature (optional)

---

**Need Help?** Check the full documentation in `STORAGE_AUTH_README.md`
