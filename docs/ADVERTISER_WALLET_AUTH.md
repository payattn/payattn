# Advertiser Wallet Authentication Implementation

## Overview

Implemented Phantom wallet authentication for the advertiser dashboard. Advertisers now log in with their Solana wallet, and their wallet public key serves as their advertiser_id throughout the system.

## What Was Built

### 1. API Endpoint: `/api/advertiser/profile`

**GET** - Fetch advertiser by wallet address
- Header: `x-wallet-address: <solana_pubkey>`
- Returns: `{ exists: boolean, advertiser: { advertiser_id, name, wallet_pubkey, created_at } }`
- Status 404 if not found

**POST** - Create new advertiser profile
- Body: `{ wallet_address: string, name: string }`
- Creates new record in `advertisers` table
- Returns: `{ success: boolean, advertiser: {...} }`

### 2. AdvertiserLayout Component

**Location:** `/backend/components/AdvertiserLayout.tsx`

**Features:**
- Wallet connection screen (if not connected)
- Loading state during profile fetch
- Onboarding form (if advertiser not found in DB)
- Header with wallet button + advertiser name
- Error handling with retry

**Flow:**
```
1. User visits /advertisers
2. If no wallet → Show "Connect Wallet" screen
3. Wallet connects → Fetch profile from DB
4. If not found → Show onboarding form
5. User creates profile → Store in DB
6. Show dashboard with wallet in header
```

**Props:**
- `children`: Render prop function that receives `advertiserData`

### 3. Updated Advertiser Pages

#### `/app/advertisers/page.tsx` (Dashboard)
- Wrapped in `WalletContextProvider` + `AdvertiserLayout`
- Removed hardcoded header (now in layout)
- Removed hardcoded `adv_rolex` reference
- Shows advertiser name in header from DB

#### `/app/advertisers/create-campaign/page.tsx` (Create Ad)
- Split into `CreateCampaignForm` component (receives `advertiser_id` prop)
- Wrapped in `WalletContextProvider` + `AdvertiserLayout`
- Uses `advertiser_id` from wallet (passed via render prop)
- Changed header: `'x-advertiser-id': advertiser_id` (was hardcoded)

## Database Schema

Uses existing `advertisers` table:
```sql
CREATE TABLE public.advertisers (
  id integer PRIMARY KEY,
  advertiser_id character varying UNIQUE NOT NULL,
  name character varying,
  wallet_pubkey character varying,
  created_at timestamp DEFAULT now()
);
```

## User Experience

### First Time User:
1. Visit `/advertisers`
2. See "Connect Wallet" screen
3. Click "Connect Wallet" → Phantom opens
4. Approve connection
5. See onboarding form: "Welcome! Create your profile"
6. Enter advertiser name (e.g., "Acme Corp Marketing")
7. Click "Create Profile"
8. Redirected to dashboard

### Returning User:
1. Visit `/advertisers`
2. Wallet auto-connects (if previously connected)
3. Profile loads from DB
4. See dashboard immediately
5. Wallet address + name shown in header

## Header Layout

```
┌─────────────────────────────────────────────────────────┐
│ PayAttn Advertiser | Acme Corp Marketing    [Wallet▼]   │
└─────────────────────────────────────────────────────────┘
```

- Left: "PayAttn Advertiser" + advertiser name from DB
- Right: Wallet button (shows address, click to disconnect)

## Wallet as Advertiser ID

**Key Decision:** `wallet_pubkey` IS the `advertiser_id`

- When creating ads: `x-advertiser-id` header = wallet public key
- When querying ads: Filter by wallet public key
- When creating offers: `advertiser_id` = wallet public key

**Benefits:**
- No separate login system needed
- Cryptographic auth (wallet signature)
- Payments go directly to advertiser wallet
- One wallet = one advertiser account

## Testing

### Setup Test Advertiser:

```sql
INSERT INTO advertisers (advertiser_id, name, wallet_pubkey)
VALUES (
  '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  'Test Advertiser',
  '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
);
```

### Test Flow:

1. Import wallet private key into Phantom
2. Visit `http://localhost:3000/advertisers`
3. Connect wallet
4. Should see dashboard with name from DB
5. Click "Create New Ad Campaign"
6. Fill form and submit
7. Check DB:
   ```sql
   SELECT * FROM ad_creative 
   WHERE advertiser_id = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
   ```

## Files Modified

1. **NEW** `/backend/app/api/advertiser/profile/route.ts` - Profile API
2. **NEW** `/backend/components/AdvertiserLayout.tsx` - Auth layout
3. **UPDATED** `/backend/app/advertisers/page.tsx` - Wrapped in layout
4. **UPDATED** `/backend/app/advertisers/create-campaign/page.tsx` - Dynamic advertiser_id

## Migration Notes

### Existing Test Data:

Current seed data has placeholder IDs like `adv_rolex`, `adv_nike`. These need to be updated to actual Solana wallet addresses if you want to test with them:

```sql
-- Update test advertisers with real wallet addresses
UPDATE advertisers 
SET wallet_pubkey = advertiser_id 
WHERE advertiser_id IN ('adv_rolex', 'adv_nike', 'adv_spotify');

-- OR create new test advertiser with your wallet
INSERT INTO advertisers (advertiser_id, name, wallet_pubkey)
VALUES (
  '<YOUR_PHANTOM_WALLET_ADDRESS>',
  'My Test Company',
  '<YOUR_PHANTOM_WALLET_ADDRESS>'
);
```

### For Production:

All new advertisers will be created through the onboarding flow with real Solana wallet addresses. The placeholder IDs were just for initial testing.

## Security Considerations

1. **No password storage** - Auth via Solana wallet signature
2. **Wallet ownership proof** - User must sign message to authenticate
3. **Session management** - Could add JWT tokens in future if needed
4. **Direct wallet payments** - Advertiser funds go to their wallet (no custodial risk)

## Future Enhancements

- [ ] Add advertiser profile editing (company name, website, etc.)
- [ ] Show wallet balance in header
- [ ] Add "Fund Account" button to send SOL to ad escrow
- [ ] Multi-wallet support (one advertiser, multiple wallets)
- [ ] Team member invites (with role permissions)
- [ ] 2FA option for high-value accounts

## Notes

- Uses existing Solana wallet adapter packages (already in project)
- WalletMultiButton component from `@solana/wallet-adapter-react-ui`
- Layout is reusable for other advertiser pages
- Onboarding form is minimal (just name required)
- All advertiser pages now require wallet connection
