# Solana Escrow Implementation

## Why We're Doing This

**Problem:** Original plan was to hold advertiser funds in Payattn's wallet (requires trust).

**Solution:** Use Solana smart contracts to hold funds in escrow—nobody has to trust Payattn.

**Flow:**
1. Advertiser accepts offer → Backend creates escrow on Solana (funds locked in Program Derived Address)
2. Extension validates escrow exists on-chain before queueing ad
3. User views ad → Extension submits settlement transaction
4. Smart contract automatically splits funds: 70% user, 25% publisher, 5% platform

**Why this wins the hackathon:**
- Makes x402's "payment required" protocol real (not just a trust model)
- Demonstrates Solana's unique value (sub-second escrow verification)
- Trustless by design (judges can verify on-chain)
- Differentiates from Brave Ads (centralized, trust-based)

**Time investment:** 1.5 days (simple escrow pattern, well-documented by Anchor)

---

## Project Structure

**Location:** `/Users/jmd/nosync/org.payattn.main/solana/`

Create the Anchor project as a subdirectory of your main project:

```
/Users/jmd/nosync/org.payattn.main/
├── backend/              # Your existing backend
├── extension/            # Your existing extension
├── website/              # Your existing Next.js site
├── solana/               # ← NEW: Anchor project here
│   ├── programs/
│   │   └── payattn_escrow/
│   │       └── src/
│   │           └── lib.rs
│   ├── tests/
│   ├── target/
│   │   ├── idl/
│   │   │   └── payattn_escrow.json    # Auto-generated, import from backend/extension
│   │   └── types/
│   │       └── payattn_escrow.ts      # Auto-generated TypeScript types
│   ├── Anchor.toml
│   └── Cargo.toml
├── package.json
└── README.md
```

**Why subdirectory:**
- ✅ Shared dependencies (backend/extension can import from `../solana/target/idl/`)
- ✅ Unified deployment (one git repo, one hackathon submission)
- ✅ IDL stays in sync automatically (no manual copying)
- ✅ Easier for judges to navigate complete project

**Initialize the project:**
```bash
cd /Users/jmd/nosync/org.payattn.main
anchor init solana --program-name payattn_escrow
```

**Update .gitignore** (add to root `.gitignore`):
```gitignore
# Solana/Anchor
solana/target/
solana/.anchor/
solana/test-ledger/

# But keep IDL for convenience (judges can see interface)
!solana/target/idl/
!solana/target/types/
```

---

## Prerequisites

### Install Solana CLI
```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.18.18/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana --version  # Verify installation
```

### Install Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustc --version  # Verify installation
```

### Install Anchor Framework
```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest
anchor --version  # Should show 0.30.x or similar
```

### Configure Solana for Devnet
```bash
solana config set --url devnet
solana config get  # Verify RPC URL is devnet
```

### Create Test Wallets
```bash
# Backend wallet (deploys contracts, manages platform)
solana-keygen new --outfile ~/.config/solana/payattn-backend.json

# Test advertiser wallet (funds escrows)
solana-keygen new --outfile ~/.config/solana/advertiser.json

# Test user wallet (settles impressions)
solana-keygen new --outfile ~/.config/solana/test-user.json

# Test publisher wallet (receives 25%)
solana-keygen new --outfile ~/.config/solana/publisher.json

# Fund all wallets with devnet SOL (free test tokens)
solana airdrop 5 $(solana-keygen pubkey ~/.config/solana/payattn-backend.json)
solana airdrop 5 $(solana-keygen pubkey ~/.config/solana/advertiser.json)
solana airdrop 5 $(solana-keygen pubkey ~/.config/solana/test-user.json)
solana airdrop 5 $(solana-keygen pubkey ~/.config/solana/publisher.json)

# Verify balances
solana balance $(solana-keygen pubkey ~/.config/solana/payattn-backend.json)
```

---

## Work Packages

### WP-SOL-01: Smart Contract Development (4 hours)

**Goal:** Create Anchor project and write escrow smart contract

- [x] **01.1** - Initialize Anchor project
  ```bash
  cd /Users/jmd/nosync/org.payattn.main
  anchor init solana --program-name payattn_escrow
  cd solana
  ```
  ✅ DONE: Project initialized at `/solana/payattn_escrow`

- [x] **01.2** - Write smart contract in `programs/payattn_escrow/src/lib.rs`
  - Two instructions: `create_escrow()` and `settle_impression()`
  - Escrow account stores: offer_id, advertiser, user, publisher, amount, settled flag
  - PDA seeds: `[b"escrow", offer_id.as_bytes()]`
  - Settlement splits funds: 70% user, 25% publisher, 5% platform
  ✅ DONE: Native SOL escrow implemented

- [x] **01.3** - Build the program
  ```bash
  anchor build
  ```
  ✅ DONE: Built with Docker (`anchor build --verifiable`)

- [x] **01.4** - Get program ID and update `lib.rs`
  ```bash
  solana address -k target/deploy/payattn_escrow-keypair.json
  # Copy this address and update declare_id!() in lib.rs
  anchor build  # Rebuild after updating ID
  ```
  ✅ DONE: Program ID `6ZEekbTJZ6D6KrfSGDY2ByoWENWfe8RzhvpBS4KtPdZr`

- [x] **01.5** - Deploy to devnet
  ```bash
  anchor deploy --provider.cluster devnet
  # Save program ID for backend integration
  ```
  ✅ DONE: Deployed to devnet
  - Program: https://explorer.solana.com/address/6ZEekbTJZ6D6KrfSGDY2ByoWENWfe8RzhvpBS4KtPdZr?cluster=devnet
  - IDL: `target/idl/payattn_escrow.json`

- [ ] **01.6** - Test with Anchor tests
  ```bash
  anchor test --skip-local-validator
  # Verify create_escrow and settle_impression work
  ```

**Success criteria:** Smart contract deployed to devnet, tests passing

---

### WP-SOL-02: Backend Integration (3 hours)

**Goal:** Backend can create escrows when advertisers accept offers

- [ ] **02.1** - Install dependencies
  ```bash
  npm install @coral-xyz/anchor @solana/web3.js
  # Or add to existing package.json
  ```

- [ ] **02.2** - Copy generated IDL to backend (auto-available after build)
  ```bash
  # After 'anchor build', IDL is at:
  # solana/target/idl/payattn_escrow.json
  # solana/target/types/payattn_escrow.ts
  
  # Backend can import directly:
  # import idl from '../solana/target/idl/payattn_escrow.json'
  # import { PayattnEscrow } from '../solana/target/types/payattn_escrow'
  ```

- [ ] **02.3** - Create Solana service module (`backend/lib/solana-escrow.ts`)
  - Initialize Anchor program with devnet connection
  - Load advertiser keypair from environment
  - Implement `createEscrow(offerId, amount, userPubkey, publisherPubkey)`
  - Return escrow PDA address + transaction signature

- [ ] **02.4** - Add environment variables
  ```bash
  # .env
  SOLANA_RPC_URL=https://api.devnet.solana.com
  SOLANA_PROGRAM_ID=<your_program_id>
  SOLANA_ADVERTISER_KEYPAIR_PATH=~/.config/solana/advertiser.json
  SOLANA_PLATFORM_WALLET=<platform_pubkey>
  ```

- [ ] **02.5** - Integrate into offer acceptance endpoint
  - When advertiser accepts offer, call `createEscrow()`
  - Store escrow address in database alongside offer
  - Send escrow address to extension with ad data

- [ ] **02.6** - Test with mock advertiser
  ```bash
  # Create test script that accepts offer and creates escrow
  # Verify escrow appears on Solana Explorer
  ```

**Success criteria:** Backend successfully creates escrows, visible on Solana Explorer

---

### WP-SOL-03: Extension Validation (2 hours)

**Goal:** Extension validates escrow before queueing ad

- [ ] **03.1** - Install Solana dependencies in extension
  ```bash
  # In extension directory
  npm install @solana/web3.js @coral-xyz/anchor
  ```

- [ ] **03.2** - Copy IDL to extension (auto-available after build)
  ```bash
  # After 'anchor build', IDL is at:
  # ../solana/target/idl/payattn_escrow.json
  
  # Extension can import directly:
  # import idl from '../solana/target/idl/payattn_escrow.json'
  ```

- [ ] **03.3** - Create validation module (`extension/lib/escrow-validator.js`)
  - Connect to Solana devnet
  - Derive escrow PDA from offer_id (same seeds as contract)
  - Fetch escrow account data
  - Verify: escrow exists, not settled, amount matches expected

- [ ] **03.4** - Integrate into queue logic
  - When receiving ad data from backend, extract escrow address
  - Call `validateEscrow()` before adding to queue
  - If validation fails, reject ad and log error
  - If validation passes, queue ad normally

- [ ] **03.5** - Add user feedback
  - Show "Validating escrow..." in popup during check
  - Show "✅ Escrow verified" on success
  - Show error message if escrow invalid

- [ ] **03.6** - Test validation flow
  - Create valid escrow → Verify ad queues successfully
  - Try queuing ad without escrow → Verify rejection
  - Try queuing ad with settled escrow → Verify rejection

**Success criteria:** Extension only queues ads with valid on-chain escrows

---

### WP-SOL-04: Extension Settlement (3 hours)

**Goal:** Extension submits settlement transaction after user views ad

- [ ] **04.1** - Wallet integration in extension
  - Use existing Phantom/Solflare wallet connection
  - Ensure wallet adapter works in extension context
  - Test signing transactions from extension

- [ ] **04.2** - Create settlement module (`extension/lib/escrow-settlement.js`)
  - Initialize Anchor program with user's wallet
  - Implement `settleImpression(offerId, publisherPubkey, platformPubkey)`
  - Submit settlement transaction to Solana
  - Wait for confirmation (~400ms)
  - Return transaction signature

- [ ] **04.3** - Integrate into ad view tracking
  - When user views ad for 5+ seconds, trigger settlement
  - Show "Processing payment..." notification
  - Submit settlement transaction
  - On success: show "✅ Earned X SOL" notification
  - On failure: show error and retry button

- [ ] **04.4** - Handle transaction errors
  - Network failures → Retry with exponential backoff
  - Insufficient SOL for fees → Show "Add SOL for transaction fees"
  - Already settled → Mark ad as complete, no retry
  - Log all errors for debugging

- [ ] **04.5** - Update local state
  - Mark impression as settled in extension storage
  - Remove ad from queue
  - Update earnings counter in popup

- [ ] **04.6** - Test settlement flow
  - View ad → Verify settlement tx submitted
  - Check user/publisher/platform wallets → Verify funds received
  - View Solana Explorer → Verify transaction details
  - Test with 5+ different ads → Verify all settle correctly

**Success criteria:** Users receive 70% payment automatically after viewing ads

---

### WP-SOL-05: Demo Polish (2 hours)

**Goal:** Make Solana integration impressive for judges

- [ ] **05.1** - Add Solana Explorer links
  - Extension popup: Link to escrow account on Solana Explorer
  - Extension popup: Link to settlement transaction after viewing
  - Dashboard: Link to user's wallet on Solana Explorer

- [ ] **05.2** - Visual feedback improvements
  - Animated "Verifying escrow on Solana..." loader
  - Checkmark animation when escrow validated
  - Animated transaction confirmation (0.4s countdown)
  - Show real-time balance updates in popup

- [ ] **05.3** - Create demo script
  - Script for showing judges: "Watch funds get locked in escrow"
  - Open Solana Explorer showing escrow PDA
  - View ad in extension
  - Show settlement transaction in Explorer
  - Show 70/25/5 split in transaction details

- [ ] **05.4** - Add metrics tracking
  - Count total escrows created
  - Count total impressions settled
  - Track average settlement time
  - Display in dashboard: "X impressions settled on Solana"

- [ ] **05.5** - Error handling polish
  - User-friendly error messages (no technical jargon)
  - Graceful fallbacks if Solana RPC is slow
  - Helpful suggestions ("Try again in a moment")

**Success criteria:** Demo flow is smooth and impressive for judges

---

### WP-SOL-06: Testing & Documentation (2 hours)

**Goal:** Verify everything works, document for judges

- [ ] **06.1** - End-to-end testing
  - Test full flow 10+ times with different offers
  - Test with multiple users simultaneously
  - Test network failure scenarios
  - Test with low wallet balances
  - Verify all transactions appear correctly on Explorer

- [ ] **06.2** - Performance testing
  - Measure escrow creation time (should be ~1-2s)
  - Measure escrow validation time (should be <500ms)
  - Measure settlement time (should be ~400ms)
  - Document actual metrics for demo

- [ ] **06.3** - Update README with Solana section
  - Explain escrow pattern (why it's trustless)
  - Show example escrow transaction on Explorer
  - Explain 70/25/5 split rationale
  - Link to smart contract code on GitHub

- [ ] **06.4** - Create judge-facing docs
  - One-page explainer: "Why Solana Makes x402 Possible"
  - Emphasis on sub-second escrow verification
  - Comparison: Ethereum would take 15 minutes per negotiation
  - Highlight: "Users negotiate 15 ads/hour = 15 escrows/hour"

- [ ] **06.5** - Security documentation
  - Explain PDA pattern (nobody controls escrow)
  - Document what Payattn CAN'T do (steal funds, fake settlements)
  - Show smart contract is auditable (open source)
  - Note: Simple escrow for hackathon, would add rate limiting for production

**Success criteria:** Complete, tested, documented Solana integration ready for demo

---

## Timeline

**Day 1 (Nov 7):**
- ✅ Prerequisites & Setup (Solana CLI, Rust, Anchor, test wallets funded)
- 🟡 WP-SOL-01 (Smart contract) - IN PROGRESS

**Day 2 (Nov 8):**
- Morning: WP-SOL-03 (Extension validation) ✅
- Afternoon: WP-SOL-04 (Extension settlement) ✅
- Evening: WP-SOL-05 (Demo polish) ✅

**Day 3 (Nov 9):**
- Morning: WP-SOL-06 (Testing & docs) ✅
- Afternoon: Buffer for fixes + practice demo

**Total: 1.5 days**

---

## Key Concepts

### Program Derived Address (PDA)
- Deterministic address created by smart contract
- Nobody has private key (not even Payattn)
- Only the smart contract code can move funds
- Created from seeds: `[b"escrow", offer_id.as_bytes()]`

### Why Solana (Not Any Chain)
- **Speed**: 400ms settlement (Ethereum = 15 minutes)
- **Cost**: $0.0001/tx (Ethereum = $5-50/tx)
- **UX**: Users negotiate 15 ads/hour = 15 escrows/hour
- **PDAs**: Elegant escrow pattern without deploy-per-escrow overhead

### Trust Model
- **Before:** Trust Payattn to hold funds and distribute fairly
- **After:** Trust smart contract code (open source, auditable)
- **Result:** Advertiser funds provably locked, settlement provably executed

---

## Troubleshooting

### "Insufficient funds" error
```bash
# Check wallet balance
solana balance <pubkey>

# Airdrop more devnet SOL
solana airdrop 2 <pubkey>
```

### "Program failed to complete" error
- Check program logs: `solana logs <program_id>`
- Common issue: Account not initialized (did escrow creation succeed?)
- Common issue: Wrong signer (is user wallet connected?)

### Escrow validation fails
- Verify program ID matches in backend and extension
- Verify PDA derivation uses same seeds
- Check escrow actually exists: `solana account <escrow_pda>`

### Settlement transaction fails
- Verify user has SOL for transaction fees (~0.000005 SOL)
- Verify escrow not already settled
- Check publisher/platform pubkeys are valid

---

## Resources

- [Anchor Book](https://book.anchor-lang.com/) - Framework documentation
- [Solana Cookbook](https://solanacookbook.com/) - Code examples
- [Solana Explorer (Devnet)](https://explorer.solana.com/?cluster=devnet) - View transactions
- [Anchor Examples](https://github.com/coral-xyz/anchor/tree/master/tests) - Reference implementations


## Wallets

```
export PATH="/tmp/solana-release/bin:$PATH" && echo "=== WALLET ADDRESSES ===" && echo "" && echo "1. 
Backend/Platform Wallet:" && solana-keygen pubkey ~/.config/solana/payattn-backend.json && echo "" && echo "2. Advertiser Wallet:" && s
olana-keygen pubkey ~/.config/solana/advertiser.json && echo "" && echo "3. Test User Wallet:" && solana-keygen pubkey ~/.config/solana
/test-user.json && echo "" && echo "4. Publisher Wallet:" && solana-keygen pubkey ~/.config/solana/publisher.json && echo "" && echo "=
== CURRENT BALANCES ===" && echo "" && solana balance $(solana-keygen pubkey ~/.config/solana/payattn-backend.json) && solana balance $
(solana-keygen pubkey ~/.config/solana/advertiser.json) && solana balance $(solana-keygen pubkey ~/.config/solana/test-user.json) && so
lana balance $(solana-keygen pubkey ~/.config/solana/publisher.json)

```
=== WALLET ADDRESSES ===

1. Backend/Platform Wallet:
G6Lbdq9JyQ3QR5YvKqpVC9KjPqAd9hSwWtHv3bPDrWTY

2. Advertiser Wallet:
AE6uwbubDn9WyXrpzvqU58jfirvqZAxWCZCfDDwW5MMb

3. Test User Wallet:
9kXHUnoYjB7eVUafsKFibrdHJWiYiX26vP7p7QX77nux

4. Publisher Wallet:
ELD9PKHo5qwyt3o5agPPMuQLRzidDnR2g4DmJDfH55Z7