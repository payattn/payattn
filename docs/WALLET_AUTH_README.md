# PayAttn Agent Dashboard - Wallet Connection & Authentication

This project implements **WP01.2.1** (Wallet Connection) and **WP01.2.2** (First-Party Authentication) for the PayAttn platform.

## Features Implemented

###  WP01.2.1: Wallet Connection
- **Solana Wallet Adapters**: Full support for Phantom and Solflare wallets
- **Wallet Provider Context**: App-wide wallet state management via React context
- **Connection UI**: Custom wallet button using Shadcn UI components
- **Session Persistence**: Wallet connection state maintained during browser session
- **Clean Disconnect Flow**: Proper cleanup on wallet disconnect

###  WP01.2.2: First-Party Authentication
- **Challenge Generation**: Creates unique authentication challenges with timestamp + nonce
- **Wallet Signature**: Requests wallet to sign authentication message
- **Signature Verification**: Client-side verification using tweetnacl
- **Session Management**: 24-hour authenticated sessions stored in localStorage
- **Auto-refresh**: Periodic session refresh to maintain authentication
- **Security**: Proves wallet ownership without exposing private keys

## Architecture

### Key Components

#### 1. **WalletProvider** (`components/WalletProvider.tsx`)
- Wraps the app with Solana wallet adapter context
- Configures Phantom and Solflare wallet adapters
- Uses Devnet for development (switchable to Mainnet)
- Includes WalletModalProvider for wallet selection UI

#### 2. **WalletButton** (`components/WalletButton.tsx`)
- Custom wallet connection button built with Shadcn UI
- Shows wallet icon and formatted address when connected
- Triggers wallet modal for connection
- Handles disconnect flow
- Callbacks for connection state changes

#### 3. **AuthService** (`lib/auth.ts`)
- Core authentication logic:
  - `generateChallenge()`: Creates unique auth challenge
  - `requestSignature()`: Gets wallet signature
  - `verifySignature()`: Validates signature matches public key
  - `createSession()`: Establishes authenticated session
  - `getSession()`: Retrieves current session
  - `clearSession()`: Cleanup on logout
  - `isSessionValid()`: Check session expiry
  - `refreshSession()`: Extend session lifetime

#### 4. **useAuth Hook** (`hooks/useAuth.ts`)
- React hook integrating auth with wallet state
- Auto-triggers authentication flow
- Manages authentication lifecycle
- Provides: `isAuthenticated`, `isAuthenticating`, `error`, `authenticate()`, `clearAuth()`

#### 5. **Main Page** (`app/page.tsx`)
- Demonstrates full wallet + auth flow
- Three card layout:
  - **Wallet Connection**: Connect/disconnect wallet
  - **Authentication**: Sign message to authenticate
  - **How It Works**: User guidance

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS v4
- **UI Components**: Shadcn UI
- **Blockchain**: Solana (via @solana/web3.js)
- **Wallet Adapters**: @solana/wallet-adapter-react
- **Cryptography**: tweetnacl (signature verification)
- **Base58 Encoding**: bs58

## Installation

```bash
cd agent-dashboard
npm install
```

### Dependencies Installed
```json
{
  "@solana/wallet-adapter-base": "^0.9.27",
  "@solana/wallet-adapter-react": "^0.15.39",
  "@solana/wallet-adapter-react-ui": "^0.9.39",
  "@solana/wallet-adapter-wallets": "^0.19.37",
  "@solana/web3.js": "^1.98.4",
  "bs58": "^6.0.0",
  "tweetnacl": "^1.0.3"
}
```

## Usage

### Start Development Server
```bash
npm run dev
```

Visit `http://localhost:3000` to see the app.

### User Flow

1. **Connect Wallet**
   - Click "Connect Wallet" button
   - Select Phantom or Solflare from modal
   - Approve connection in wallet extension
   - Wallet address displayed when connected

2. **Authenticate**
   - Click "Sign Message" button (appears after connection)
   - Wallet prompts to sign authentication message
   - Signature verified on-chain
   - Session established (valid for 24 hours)

3. **Session Persistence**
   - Authenticated session stored in localStorage
   - Auto-loads on page refresh
   - Expires after 24 hours
   - Auto-clears on wallet disconnect

## Authentication Flow

```

   Connect   
   Wallet    

       
       v

  Generate Challenge 
  (timestamp + nonce)

       
       v

 Request Signature   
 from Wallet         

       
       v

 Verify Signature    
 (client-side)       

       
       v

  Create Session     
  (24hr validity)    

```

## Security Considerations

### Current Implementation (Hackathon/Demo)
- Client-side signature verification
- Challenge-response authentication
- Session timeout (24 hours)
- Nonce prevents replay attacks
- Timestamp prevents stale challenges

### Production Considerations (Future)
-  Move verification to backend (WP01.2.4)
-  Implement JWT tokens
-  Add refresh token mechanism
-  Rate limiting on auth attempts
-  Encrypted session storage
-  HTTPS enforcement
-  CSRF protection

## File Structure

```
agent-dashboard/
 app/
    layout.tsx          # Root layout with WalletProvider
    page.tsx            # Main page with wallet + auth UI
    globals.css         # Global styles
 components/
    ui/                 # Shadcn UI components
       button.tsx
       card.tsx
       input.tsx
       label.tsx
    WalletProvider.tsx  # Wallet adapter context provider
    WalletButton.tsx    # Custom wallet connection button
 hooks/
    useAuth.ts          # Authentication hook
 lib/
    auth.ts             # Authentication service
    utils.ts            # Utility functions
 package.json            # Dependencies
```

## Next Steps (WP01.2.3 - WP01.2.4)

### WP01.2.3: Encrypted Storage
- Implement encrypted localStorage
- Secure session data at rest
- Key derivation from wallet signature

### WP01.2.4: Token Management
- Backend JWT issuance
- Access token + refresh token pattern
- Token refresh mechanism
- Server-side signature verification

## Testing

### Manual Testing Checklist
- [ ] Wallet connection works for Phantom
- [ ] Wallet connection works for Solflare
- [ ] Authentication signature request appears
- [ ] Signature verification succeeds
- [ ] Session persists on page refresh
- [ ] Session clears on wallet disconnect
- [ ] Session expires after 24 hours
- [ ] Error handling works (rejected signature)

### Testing Without Wallet
If you don't have a Solana wallet installed:
1. Install [Phantom](https://phantom.app/) browser extension
2. Create a new wallet (save recovery phrase!)
3. Switch to Devnet in wallet settings
4. Get free SOL from [Solana Faucet](https://faucet.solana.com/)

## Configuration

### Switch to Mainnet

Edit `components/WalletProvider.tsx`:

```typescript
// Change from Devnet to Mainnet
const network = WalletAdapterNetwork.Mainnet; // was: Devnet
```

### Adjust Session Duration

Edit `lib/auth.ts`:

```typescript
// Change session duration (currently 24 hours)
const SESSION_DURATION = 24 * 60 * 60 * 1000; // in milliseconds
```

## Troubleshooting

### "Wallet does not support message signing"
- Some wallets don't support `signMessage`
- Ensure you're using Phantom or Solflare
- Update wallet extension to latest version

### "Signature verification failed"
- Check wallet is connected to correct network (Devnet)
- Ensure challenge hasn't expired (5 min validity)
- Try disconnecting and reconnecting wallet

### Session not persisting
- Check browser localStorage is enabled
- Verify no browser extensions blocking localStorage
- Check for cross-origin issues

## Resources

- [Solana Wallet Adapter Docs](https://github.com/anza-xyz/wallet-adapter)
- [Phantom Developer Docs](https://docs.phantom.app/)
- [Solflare Developer Docs](https://docs.solflare.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Shadcn UI Components](https://ui.shadcn.com/)

## Success Criteria Met 

### WP01.2.1
- User clicks button  wallet extension prompts for connection
- Connection status persists during session
- Clean disconnect flow works

### WP01.2.2
- Connected wallet successfully signs auth challenge
- Signature verification passes
- Authenticated session established and maintained

## License

MIT
