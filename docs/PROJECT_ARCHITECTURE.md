# Pay Attention - Project Architecture

## Overview

Pay Attention is a privacy-first advertising platform where users control their data and get paid for viewing relevant ads. The system consists of a Next.js website and a Chrome extension that work together to enable secure, private ad matching.

## System Components

### 1. Website (Next.js)
- **Purpose**: Wallet authentication and ad performance dashboard
- **URL**: `http://localhost:3000`
- **Tech Stack**: Next.js 16, React, TypeScript, Tailwind CSS, Solana wallet adapter

### 2. Chrome Extension
- **Purpose**: Profile management and automated ad matching
- **Architecture**: Popup UI + Background service worker
- **Storage**: Chrome local storage for encrypted profile data

## User Flow

### Initial Setup
1. User visits website at `/wallet-auth`
2. Connects Solana wallet (Phantom, etc.)
3. Signs authentication message
4. Website syncs authentication to extension
5. Extension is now authenticated and ready

### Profile Management
1. User opens extension popup
2. Clicks "Manage Profile" button
3. Opens full-page profile editor (`profile.html`)
4. Fills out demographic/interest data
5. Profile is encrypted and stored locally in extension
6. No profile data is sent to server

### Ad Dashboard
1. User clicks "Ad Dashboard" button in extension
2. Opens website at `/dashboard`
3. Views ad performance statistics
4. See earnings, impressions, clicks

### Automatic Ad Matching (Background)
1. Service worker runs periodically in background
2. Decrypts user profile from local storage
3. Fetches available ads from server
4. Matches ads against user preferences locally
5. Generates zero-knowledge proofs
6. Submits ad bids (future implementation)

## Page Structure

### Website Pages

#### `/wallet-auth`
- **Purpose**: Wallet authentication only
- **Features**:
  - Connect/disconnect Solana wallet
  - Sign authentication message
  - Sync auth status to extension
  - Minimal UI focused on authentication

#### `/dashboard`
- **Purpose**: View ad performance metrics
- **Features**:
  - Wallet connection status
  - Ad statistics (impressions, clicks, earnings)
  - Mock data for demo purposes
  - Clean card-based UI

#### `/` (Home)
- **Purpose**: Landing page
- **Status**: Basic placeholder

### Extension Pages

#### `popup.html`
- **Purpose**: Quick status and navigation
- **Features**:
  - Authentication status display
  - Wallet address badge
  - Three action buttons:
    - Manage Wallet → Opens `/wallet-auth`
    - Manage Profile → Opens `profile.html`
    - Ad Dashboard → Opens `/dashboard`
  - Profile preview (shows decrypted profile if available)

#### `profile.html`
- **Purpose**: Full profile editor
- **Features**:
  - Demographics (age, gender)
  - Interests (comma-separated tags)
  - Location (country, state)
  - Financial (income range)
  - Pain threshold (ad frequency tolerance)
  - Save/Load/Cancel buttons
  - All data encrypted before storage

## Data Flow

### Authentication Flow
```
Website (/wallet-auth)
  ↓ User connects wallet
  ↓ User signs message: "Sign in to Pay Attention\n\nWallet: {address}"
  ↓ Generate authToken = base64(signature)
  ↓ Compute keyHash = SHA-256("payattn:" + walletAddress)
  ↓ Store in localStorage
  ↓ Send to extension via postMessage
  ↓
Extension (content script)
  ↓ Receive auth data
  ↓ Forward to background script
  ↓
Extension (background)
  ↓ Store in chrome.storage.local:
    - walletAddress
    - keyHash (deterministic)
    - authToken (signature)
  ↓
Extension (popup)
  ↓ Listen for storage changes
  ↓ Update UI to show authenticated state
```

### Profile Encryption Flow
```
User enters profile data in extension
  ↓
Extension reads auth from chrome.storage.local:
  - keyHash
  - walletAddress  
  - authToken
  ↓
Call KDS endpoint: GET /api/k/{keyHash}
  Headers:
    - X-Wallet: {walletAddress}
    - X-Auth-Token: {authToken}
  ↓
Server verifies signature matches wallet
  ↓ If valid: return key material
  ↓ If invalid: return 403
  ↓
Extension derives encryption key:
  Key = PBKDF2(keyMaterial + walletAddress)
  ↓
Encrypt profile with AES-256-GCM
  ↓
Store encrypted profile in chrome.storage.local
```

### Profile Decryption Flow
```
Extension needs profile (popup or service worker)
  ↓
Read from chrome.storage.local:
  - Encrypted profile data
  - keyHash
  - walletAddress
  - authToken
  ↓
Call KDS endpoint with auth headers
  ↓
Server verifies signature → returns key material
  ↓
Derive decryption key from material + walletAddress
  ↓
Decrypt profile with AES-256-GCM
  ↓
Use profile data (display or match ads)
```

### Disconnect Flow
```
User disconnects wallet on website
  ↓
Website sends empty auth to extension
  ↓
Extension clears chrome.storage.local
  ↓
Popup shows "Not Authenticated" state
```

## Security Architecture

### Key Derivation Service (KDS)
- **Endpoint**: `/api/k/{keyHash}`
- **Purpose**: Provide key material for encryption/decryption
- **Authentication**: Requires wallet signature verification

### Deterministic Key Generation
- **Formula**: `keyHash = SHA-256("payattn:" + walletAddress)`
- **Benefit**: Same wallet always gets same key → profile persists across reconnects
- **Public**: Anyone can compute keyHash from wallet address

### Authentication Token
- **Format**: `authToken = base64(signature)`
- **Purpose**: Proves ownership of wallet private key
- **Required**: Must be sent with every KDS request

### Server-Side Verification
1. Check X-Wallet and X-Auth-Token headers exist → 401 if missing
2. Verify signature matches wallet using Ed25519 → 403 if invalid
3. Verify requested keyHash matches wallet address → 403 if mismatch
4. Return key material if all checks pass

### Security Properties
- ✅ Server verifies wallet signature before providing key material
- ✅ Deterministic keys enable profile persistence
- ✅ Client-side encryption (profile never sent to server unencrypted)
- ✅ Defense in depth: auth + encryption + key separation
- ✅ Attack requires: encrypted data + valid wallet signature

## Technical Details

### Encryption
- **Algorithm**: AES-256-GCM
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **IV**: Random 12 bytes per encryption
- **Format**: Base64 encoded (IV + ciphertext)

### Storage
- **Website**: localStorage for session data
- **Extension**: chrome.storage.local for auth + encrypted profile
- **Server**: No user profile data stored

### Communication
- **Website ↔ Extension**: postMessage via content script
- **Extension ↔ Server**: Fetch API with auth headers
- **Real-time sync**: chrome.storage.onChanged listeners

## Extension Architecture

### Files
- `manifest.json` - Extension configuration
- `popup.html/js` - Quick access UI
- `profile.html/js` - Full profile editor
- `background.js` - Service worker for background processing
- `content.js` - Content script for website communication
- `crypto.js` - Encryption/decryption functions

### Background Service Worker
- Runs independently of popup
- Monitors for profile changes
- Will implement automatic ad matching
- Processes ads without user interaction

### Storage Structure
```javascript
chrome.storage.local = {
  payattn_walletAddress: "Base58 Solana address",
  payattn_keyHash: "SHA-256 hex string (64 chars)",
  payattn_authToken: "Base64 encoded signature",
  payattn_profile: {
    walletAddress: "...",
    encryptedData: "Base64 encrypted profile",
    version: 1,
    timestamp: 1234567890
  }
}
```

## API Endpoints

### `GET /api/k/{keyHash}`
- **Purpose**: Key Derivation Service
- **Auth Required**: Yes
- **Headers**:
  - `X-Wallet`: Wallet address
  - `X-Auth-Token`: Base64 signature
- **Response**: `{ keyMaterial: string, version: string }`
- **Errors**:
  - 401: Missing authentication
  - 403: Invalid signature or keyHash mismatch

### `OPTIONS /api/k/{keyHash}`
- **Purpose**: CORS preflight
- **Response**: CORS headers

## Development Setup

### Prerequisites
- Node.js 18+
- Chrome browser
- Solana wallet extension (Phantom recommended)

### Running the Website
```bash
cd agent-dashboard
npm install
npm run dev
# Visit http://localhost:3000
```

### Installing the Extension
1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `agent-dashboard/extension` directory
5. Extension icon appears in toolbar

### Testing
1. Visit `http://localhost:3000/wallet-auth`
2. Connect Phantom wallet
3. Sign authentication message
4. Open extension popup
5. Click "Manage Profile" to create profile
6. Profile should decrypt successfully in popup

## Environment Variables

### Required
- `KDS_SECRET` - Secret key for HMAC key material generation
  - Default: `'default-secret-for-development-only'`
  - Production: Set in environment

### Optional
- None currently

## Future Work

### Immediate
- Implement actual ad fetching/matching logic
- Add zero-knowledge proof generation
- Implement ad bidding system
- Add real earnings tracking

### Later
- Rate limiting on KDS endpoint
- Token refresh mechanism
- Request logging/auditing
- Production security audit
- Additional wallet support (beyond Solana)

## Known Limitations

1. **Development-only KDS secret**: Change for production
2. **Mock ad data**: Dashboard shows placeholder data
3. **No ad matching**: Service worker structure ready but logic not implemented
4. **Single wallet type**: Only Solana supported currently
5. **Chrome only**: Extension not tested in other browsers

## Questions?

Check the code or ask the team. Key files to understand:
- `lib/auth.ts` - Authentication logic
- `lib/crypto-pure.ts` - Encryption functions
- `app/api/k/[hash]/route.ts` - KDS endpoint
- `extension/background.js` - Service worker
- `extension/popup.js` - Extension UI
