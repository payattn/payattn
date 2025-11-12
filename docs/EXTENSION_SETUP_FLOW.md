# Extension Setup Flow

## Problem Solved

Phantom wallet doesn't inject `window.solana` into Chrome extension pages, only into regular web pages.

## Solution

Extension redirects to website for authentication, then syncs credentials back.

## Flow

1. **Extension Setup Page** (`extension/setup.html`)
   - Shows "Open Website to Connect" button
   - Clicking opens website in new tab
   - Polls `chrome.storage.local` waiting for keyHash

2. **Website Authentication** (`http://localhost:3000/storage-test`)
   - User connects Phantom wallet (works normally on website)
   - User signs authentication message
   - Website computes keyHash from signature
   - **Website saves to chrome.storage.local** (via externally_connectable)

3. **Extension Detects Auth** (`extension/setup.js`)
   - Polls every second checking for keyHash
   - When found, shows success screen
   - Extension now authenticated!

4. **Background Script** (`extension/background.js`)
   - Reads keyHash from chrome.storage.local
   - Fetches key material from KDS
   - Decrypts profiles from IndexedDB
   - Runs autonomously every 30 minutes

## Files Modified

### Extension
- `extension/setup.html` - Changed button text
- `extension/setup.js` - Redirects to website instead of direct Phantom connection
- `extension/manifest.json` - Added `externally_connectable` for website communication

### Website
- `hooks/useAuth.ts` - Saves keyHash to chrome.storage.local after authentication

## Security

- keyHash only stored in chrome.storage.local (not IndexedDB)
- Website can write to extension storage (via externally_connectable)
- Malicious websites cannot access extension storage
- Only whitelisted origins (localhost:3000, *.payattn.org) can communicate

## Testing

1. **Install extension** in Chrome
2. **Click extension icon** → Shows "Setup Required"
3. **Click "Setup Extension"** → Opens setup page
4. **Click "Open Website to Connect"** → Opens localhost:3000
5. **Authenticate on website** with Phantom
6. **Watch setup page** - should detect auth and show success
7. **Open extension popup** - should show authenticated state
8. **Click "Run Now"** - should decrypt and process profiles

## Dev Server Must Be Running

```bash
cd agent-dashboard
npm run dev
```

The website at http://localhost:3000 must be running for authentication to work.
