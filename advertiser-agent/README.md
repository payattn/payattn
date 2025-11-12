# Peggy - Advertiser Agent

Autonomous AI agent that evaluates user offers and funds Solana escrows using the x402 "Payment Required" protocol.

## Overview

Peggy is the advertiser-side agent in the Payattn ecosystem. She autonomously:

1. 🔍 **Polls** the backend for pending offers (every 30s)
2. 🤔 **Evaluates** each offer using Venice AI with campaign criteria
3. ✅ **Accepts** matching offers (receives HTTP 402 response)
4. 💰 **Funds** escrow on Solana (locks advertiser funds on-chain)
5. 📝 **Submits** payment proof to backend
6. 🎯 **Enables** user to queue ad for viewing

## Architecture

```
┌─────────────┐
│   Peggy     │  (This agent)
│ (Advertiser)│
└──────┬──────┘
       │
       │ 1. Poll for offers
       ▼
┌─────────────┐
│   Backend   │  (x402 facilitator)
│  (Next.js)  │
└──────┬──────┘
       │
       │ 2. HTTP 402 Payment Required
       ▼
┌─────────────┐
│   Solana    │  (Escrow smart contract)
│   Devnet    │
└─────────────┘
```

## Setup

### Prerequisites

1. **Advertiser Wallet** (devnet SOL)
   ```bash
   # Create a new wallet or use existing
   solana-keygen new -o ~/.config/solana/advertiser.json
   
   # Check balance (replace with your actual wallet address)
   solana balance YOUR_WALLET_ADDRESS --url devnet
   
   # Request airdrop if needed
   solana airdrop 1 YOUR_WALLET_ADDRESS --url devnet
   ```

2. **Backend Running**
   ```bash
   cd ../backend
   npm run dev
   ```

3. **Venice AI API Key**
   - Get from: https://docs.venice.ai/overview/getting-started
   - Add to `.env` file (see below)

### Installation

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your VENICE_API_KEY

# Seed test data
npm run seed
```

### Environment Variables

Edit `.env` and configure:

```bash
# Venice AI (REQUIRED - add your key here)
VENICE_API_KEY=your_actual_api_key_here

# Backend API (should work as-is)
API_URL=http://localhost:3000
ADVERTISER_ID=adv_001

# Supabase (copy from backend/.env.local)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Solana (configure for your deployment)
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PROGRAM_ID=your_program_id_here
ADVERTISER_KEYPAIR_PATH=~/.config/solana/advertiser.json

# Agent behavior
POLL_INTERVAL=30000  # 30 seconds
```

## Usage

### Seed Test Data

Create test advertiser, users, and offers in the database:

```bash
npm run seed
```

Expected output:
```
✅ ACCEPT | offer_peggy_test_001
   Match: 5/5 | Price: 0.025 SOL ($0.025) | Rep: 92%
✅ ACCEPT | offer_peggy_test_002
   Match: 4/5 | Price: 0.020 SOL ($0.020) | Rep: 88%
❌ REJECT | offer_peggy_test_003
   Match: 3/5 | Price: 0.035 SOL ($0.035) | Rep: 75%
✅ ACCEPT | offer_peggy_test_004
   Match: 5/5 | Price: 0.015 SOL ($0.015) | Rep: 95%
❌ REJECT | offer_peggy_test_005
   Match: 2/5 | Price: 0.050 SOL ($0.050) | Rep: 65%

🚀 Ready to test Peggy! Run: npm start
```

### Run Peggy

```bash
npm start
```

Peggy will:
- Start up and display wallet info
- Poll for offers every 30 seconds
- Evaluate and process offers autonomously
- Log all decisions with reasoning

### Clean Test Data

```bash
npm run seed:clean
```

## Demo Flow

### Terminal 1: Backend
```bash
cd ../backend
npm run dev
```

### Terminal 2: Peggy
```bash
cd advertiser-agent
npm run seed    # Create test data
npm start       # Start Peggy
```

### Watch Peggy Work

```
🤖 Peggy starting up...
=========================================

Advertiser: Nike Golf Championship Campaign
Advertiser ID: adv_001
Wallet: AE6uwbubDn9WyXrpzvqU58jfirvqZAxWCZCfDDwW5MMb
Balance: 4.4623 SOL

✅ Peggy initialized successfully!
Polling for offers every 30s...
=========================================

[14:32:15] 📋 Found 2 pending offer(s)

─────────────────────────────────────────
📋 Evaluating offer offer_peggy_test_001
   User: user_test_001
   Price: 0.0250 SOL ($0.025)
   User Wallet: 9kXHUnoYjB7eVUafsKFibrdHJWiYiX26vP7p7QX77nux

💭 Peggy thinking...

✅ Decision: ACCEPT
   Reasoning: Excellent match (5/5 criteria), price is fair ($0.025 
              vs $0.030 max CPM), user has strong reputation (92%) 
              and high historical CTR (15.2%). This is exactly our 
              target audience.
   Confidence: 95%

📤 Accepting offer offer_peggy_test_001...

💰 Received HTTP 402 Payment Required:
   Chain: solana (devnet)
   Escrow PDA: B6a1aL5g4oP9iAqCU1egBszdB1CBcYBmEBaUBeVQoeKo
   Amount: 25000000 lamports (0.0250 SOL)
   User: 9kXHUnoYjB7eVUafsKFibrdHJWiYiX26vP7p7QX77nux
   Platform: G6Lbdq9JyQ3QR5YvKqpVC9KjPqAd9hSwWtHv3bPDrWTY

💰 Funding escrow for offer offer_peggy_test_001...
   Amount: 25000000 lamports (0.0250 SOL)
   Escrow PDA: B6a1aL5g4oP9iAqCU1egBszdB1CBcYBmEBaUBeVQoeKo
   ✅ PDA verified (bump: 254)
   📤 Submitting transaction...
   ✅ Transaction submitted!
   Signature: 5tx1m2...
   Explorer: https://explorer.solana.com/tx/5tx1m2...?cluster=devnet
   ⏳ Waiting for confirmation...
   ✅ Transaction confirmed!

📝 Submitting payment proof...

✅ Offer offer_peggy_test_001 fully funded!
   Status: funded
   Escrow PDA: B6a1aL5g4oP9iAqCU1egBszdB1CBcYBmEBaUBeVQoeKo
   User can now queue ad for viewing
   Resource: /api/user/offers/offer_peggy_test_001
─────────────────────────────────────────
```

## Project Structure

```
advertiser-agent/
├── peggy.js              # Main agent (orchestrates everything)
├── config.js             # Environment configuration
├── seed-test-data.js     # Database seeding script
├── lib/
│   ├── llm.js           # Venice AI integration
│   ├── api.js           # Backend API client (x402 flow)
│   ├── escrow.js        # Solana escrow funding
│   └── database.js      # Supabase queries
├── package.json
├── .env                 # Environment variables (git ignored)
└── README.md           # This file
```

## How It Works

### 1. Offer Evaluation (LLM)

Peggy uses Venice AI to evaluate each offer based on:
- **Price fairness** (requested vs max CPM)
- **Budget availability** (remaining budget)
- **Strategic fit** (campaign goals)

The LLM provides:
- Decision: `accept` or `reject`
- Reasoning: Detailed explanation
- Confidence: 0.0-1.0

### 2. x402 Protocol Flow

```
Peggy → POST /api/advertiser/offers/:id/accept
Backend → HTTP 402 Payment Required
          Headers: X-Escrow-PDA, X-Payment-Amount, etc.
Peggy → Fund escrow on Solana
Peggy → POST /api/advertiser/payments/verify
Backend → Verify escrow on-chain
Backend → Mark offer as "funded"
```

### 3. Escrow Funding (Solana)

```javascript
// Derive PDA
const [escrowPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('escrow'), Buffer.from(offerId)],
  programId
);

// Call createEscrow instruction
await program.methods
  .createEscrow(offerId, new BN(amount))
  .accounts({
    escrow: escrowPda,
    advertiser: advertiserKeypair.publicKey,
    user: userPubkey,
    platform: platformPubkey,
    systemProgram: SystemProgram.programId
  })
  .rpc();
```

### 4. Campaign Criteria (Hardcoded)

For the hackathon, campaign criteria are hardcoded in `peggy.js`:

```javascript
{
  campaignName: 'Nike Golf Championship 2025',
  targeting: {
    age: '40-60',
    interests: ['golf', 'sports', 'luxury goods'],
    location: ['uk', 'us', 'au']
  },
  budgetRemaining: 1000, // USD
  maxCpm: 0.030, // $0.03 max per impression
  goal: 'Drive awareness for new golf club line'
}
```

**TODO:** Load from database in production.

## Troubleshooting

### "Venice API key not configured"
- Edit `.env` and add your actual Venice API key
- Get one from: https://docs.venice.ai/overview/getting-started

### "Insufficient balance"
- Request devnet SOL:
  ```bash
  solana airdrop 1 AE6uwbubDn9WyXrpzvqU58jfirvqZAxWCZCfDDwW5MMb --url devnet
  ```

### "Failed to fetch offers"
- Make sure backend is running: `cd ../backend && npm run dev`
- Check database has test data: `npm run seed`

### "PDA mismatch"
- This indicates a bug in PDA derivation
- Backend and Peggy must use same seeds: `['escrow', offerId]`

### "Transaction failed on blockchain"
- Check Solana Explorer link in logs
- Common causes: Insufficient SOL, network issues, program errors

## Integration with Max (User Agent)

After Peggy funds an escrow:
1. Backend marks offer as `status: "funded"`
2. Max (user agent) can query funded offers
3. Max validates escrow on-chain
4. Max queues ad locally for user to view
5. User views ad → Publisher reports impression
6. Backend settles escrow (3 separate txs for privacy)

## Development

### Run in Development Mode (auto-restart)
```bash
npm run dev
```

### Test LLM Evaluation Only
```javascript
import { LLMClient } from './lib/llm.js';
const llm = new LLMClient();
const result = await llm.evaluateOffer(mockOffer, mockCriteria);
console.log(result);
```

### Test Escrow Funding Only
```bash
# See: /solana/payattn_escrow/fund-escrow-new.js
cd ../solana/payattn_escrow
node fund-escrow-new.js
```

## Technical Details

### Dependencies
- `@solana/web3.js` - Solana blockchain interaction
- `@coral-xyz/anchor` - Anchor framework for smart contracts
- `@supabase/supabase-js` - Database queries
- `dotenv` - Environment configuration

### Solana Smart Contract
- **Program ID:** `6ZEekbTJZ6D6KrfSGDY2ByoWENWfe8RzhvpBS4KtPdZr`
- **Network:** Devnet
- **Instruction:** `createEscrow(offerId: string, amount: u64)`
- **Settlement:** 3-transaction privacy-preserving split (70/25/5)

### x402 Headers
- `X-Payment-Chain`: `solana`
- `X-Payment-Network`: `devnet`
- `X-Escrow-PDA`: Program-derived address for escrow
- `X-Payment-Amount`: Amount in lamports
- `X-User-Pubkey`: User's wallet address
- `X-Platform-Pubkey`: Platform wallet address
- `X-Escrow-Program`: Program ID

## License

MIT

## Support

For issues or questions:
1. Check `docs/PEGGY-DEVELOPER-BRIEF.md` for detailed specifications
2. Review `docs/solana_dev.md` for Solana integration details
3. See `tasks_peggy.md` for development checklist
