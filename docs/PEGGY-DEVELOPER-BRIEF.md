# Peggy - Advertiser Agent Developer Brief

**Work Package:** WP06  
**Estimated Time:** 14 hours (1-1.5 days)  
**Priority:** HIGH - Critical for demonstrating complete x402 protocol  
**Date:** November 9, 2025  
**Deadline:** November 11, 2025

---

## 🎯 Executive Summary

Build **Peggy**, an autonomous advertiser agent that evaluates user offers and funds escrows on Solana using the x402 "Payment Required" protocol. Peggy mirrors Max (the user agent) but operates from the advertiser's perspective.

**What Peggy Does:**
1. Polls backend for pending offers (every 30s)
2. Evaluates each offer using LLM (accept/reject based on campaign criteria)
3. Accepts offers → Receives HTTP 402 from backend
4. Funds escrow on Solana (locks advertiser funds on-chain)
5. Submits payment proof → Offer marked as "funded"

**Why Peggy Matters:**
- ✅ Completes x402 protocol (DIY facilitator with agents on both sides)
- ✅ Demonstrates agent-to-agent economy (core hackathon theme)
- ✅ Shows trustless escrow workflow (advertiser funds locked on Solana)
- ✅ Much more impressive than manual `curl` commands

---

## 🏗️ Architecture Context

### Current State (Working)
- ✅ **Max (user agent):** Evaluates campaigns, makes offers, generates ZK-SNARKs
- ✅ **Backend (x402 facilitator):** HTTP 402 responses, payment verification
- ✅ **Smart contract:** Escrow deployed on Solana (3-tx privacy-preserving settlement)
- ✅ **Settlement service:** Automatic payouts after user views ad

### What's Missing
- ❌ **Peggy (advertiser agent):** Nobody is accepting offers and funding escrows

### Project Structure
```
/Users/jmd/nosync/org.payattn.main/
├── backend/              # Next.js (API endpoints, x402 facilitator)
├── extension/            # Chrome extension (Max - user agent)
├── solana/               # Anchor smart contracts
└── advertiser-agent/     # NEW - Peggy goes here
    ├── package.json
    ├── peggy.js          # Main agent script
    ├── lib/
    │   ├── llm.js        # LLM wrapper (reuse from extension)
    │   ├── escrow.js     # Solana escrow funding
    │   └── api.js        # Backend API client
    ├── config.js         # Environment config
    └── README.md
```

---

## 📋 Detailed Requirements

### WP06.1: Core Structure (2 hours)

**Create `/advertiser-agent/` directory:**

```bash
cd /Users/jmd/nosync/org.payattn.main
mkdir advertiser-agent
cd advertiser-agent
npm init -y
```

**Install dependencies:**
```bash
npm install @solana/web3.js @coral-xyz/anchor dotenv
npm install --save-dev @types/node typescript
```

**Create `config.js`:**
```javascript
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Backend API
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  advertiserId: process.env.ADVERTISER_ID || 'adv_001',
  
  // Solana
  solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  advertiserKeypairPath: process.env.ADVERTISER_KEYPAIR_PATH || 
    `${process.env.HOME}/.config/solana/advertiser.json`,
  programId: process.env.SOLANA_PROGRAM_ID || 
    '6ZEekbTJZ6D6KrfSGDY2ByoWENWfe8RzhvpBS4KtPdZr',
  
  // LLM
  llmProvider: process.env.LLM_PROVIDER || 'gemini', // or 'claude'
  llmApiKey: process.env.LLM_API_KEY,
  
  // Agent behavior
  pollInterval: 30000, // 30 seconds
  maxRetries: 3,
};
```

**Create `.env` template:**
```bash
API_URL=http://localhost:3000
ADVERTISER_ID=adv_001
SOLANA_RPC_URL=https://api.devnet.solana.com
ADVERTISER_KEYPAIR_PATH=/Users/jmd/.config/solana/advertiser.json
SOLANA_PROGRAM_ID=6ZEekbTJZ6D6KrfSGDY2ByoWENWfe8RzhvpBS4KtPdZr
LLM_PROVIDER=gemini
LLM_API_KEY=your_key_here
```

**Success criteria:** Project structure created with dependencies installed

---

### WP06.2: LLM Integration (2 hours)

**Context:** Max (user agent) already has LLM integration. You can reuse the pattern but from advertiser's perspective.

**Create `lib/llm.js`:**
```javascript
import { config } from '../config.js';

export class LLMClient {
  constructor() {
    this.provider = config.llmProvider;
    this.apiKey = config.llmApiKey;
  }
  
  async evaluateOffer(offer, campaignCriteria) {
    const prompt = this.buildEvaluationPrompt(offer, campaignCriteria);
    
    if (this.provider === 'gemini') {
      return await this.callGemini(prompt);
    } else if (this.provider === 'claude') {
      return await this.callClaude(prompt);
    }
    
    throw new Error(`Unsupported LLM provider: ${this.provider}`);
  }
  
  buildEvaluationPrompt(offer, campaignCriteria) {
    return `You are Peggy, an AI agent working for an advertiser to evaluate user offers.

Your goal: Maximize ROI (only accept offers that match campaign criteria and provide good value).

CAMPAIGN CONTEXT:
Name: ${campaignCriteria.campaignName}
Target Audience: ${JSON.stringify(campaignCriteria.targeting)}
Budget Remaining: $${campaignCriteria.budgetRemaining}
Max CPM: $${campaignCriteria.maxCpm}
Campaign Goal: ${campaignCriteria.goal}

OFFER DETAILS:
User ID: ${offer.userId}
Requested Price: $${offer.requestedPrice}
Match Score: ${offer.matchScore}/5 (based on targeting criteria)
User Reputation: ${offer.userReputation}
Historical CTR: ${offer.historicalCtr}%
Historical Conversion: ${offer.historicalConversion}%

EVALUATION CRITERIA:
1. Price Fairness: Is requested price reasonable for match quality?
   - 5/5 match: Accept up to ${campaignCriteria.maxCpm}
   - 4/5 match: Accept up to ${campaignCriteria.maxCpm * 0.8}
   - 3/5 match: Accept up to ${campaignCriteria.maxCpm * 0.6}
   - <3/5 match: Usually reject

2. Budget: Do we have budget remaining?

3. ROI Potential: User's historical performance vs price

4. Strategic Value: Does this help campaign goals?

OUTPUT FORMAT (JSON only):
{
  "decision": "accept" | "reject",
  "reasoning": "Detailed explanation of decision",
  "confidence": 0.0-1.0
}

Remember: You're spending real money. Be selective but fair.`;
  }
  
  async callGemini(prompt) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          }
        })
      }
    );
    
    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    
    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse LLM response');
    
    return JSON.parse(jsonMatch[0]);
  }
  
  async callClaude(prompt) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    const data = await response.json();
    const text = data.content[0].text;
    
    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse LLM response');
    
    return JSON.parse(jsonMatch[0]);
  }
}
```

**Success criteria:** LLM evaluates offers and returns JSON decisions

---

### WP06.3: Offer Fetching (1 hour)

**Create `lib/api.js`:**
```javascript
import { config } from '../config.js';

export class BackendClient {
  constructor() {
    this.baseUrl = config.apiUrl;
    this.advertiserId = config.advertiserId;
  }
  
  async fetchPendingOffers() {
    const url = `${this.baseUrl}/api/advertiser/offers?status=offer_made&advertiser_id=${this.advertiserId}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch offers: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.offers || [];
  }
  
  async acceptOffer(offerId) {
    const url = `${this.baseUrl}/api/advertiser/offers/${offerId}/accept`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    // Expect HTTP 402 Payment Required
    if (response.status !== 402) {
      throw new Error(`Expected 402, got ${response.status}`);
    }
    
    // Parse x402 headers
    return {
      offerId: response.headers.get('x-offer-id'),
      escrowPda: response.headers.get('x-escrow-pda'),
      paymentAmount: parseInt(response.headers.get('x-payment-amount')),
      userPubkey: response.headers.get('x-user-pubkey'),
      platformPubkey: response.headers.get('x-platform-pubkey'),
      programId: response.headers.get('x-escrow-program'),
      verificationEndpoint: response.headers.get('x-verification-endpoint')
    };
  }
  
  async submitPaymentProof(offerId, txSignature) {
    const url = `${this.baseUrl}/api/advertiser/payments/verify`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offerId, txSignature })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Payment verification failed: ${error.message}`);
    }
    
    return await response.json();
  }
}
```

**Success criteria:** Can fetch offers and handle x402 responses

---

### WP06.4-06.5: Escrow Funding (3 hours)

**Create `lib/escrow.js`:**
```javascript
import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { readFileSync } from 'fs';
import { config } from '../config.js';

// Import IDL from smart contract
const idl = JSON.parse(
  readFileSync('../solana/payattn_escrow/target/idl/payattn_escrow.json', 'utf8')
);

export class EscrowFunder {
  constructor() {
    this.connection = new Connection(config.solanaRpcUrl, 'confirmed');
    this.advertiserKeypair = this.loadKeypair();
    this.programId = new PublicKey(config.programId);
    this.program = this.createProgram();
  }
  
  loadKeypair() {
    const secretKey = JSON.parse(
      readFileSync(config.advertiserKeypairPath, 'utf8')
    );
    return Keypair.fromSecretKey(new Uint8Array(secretKey));
  }
  
  createProgram() {
    const wallet = {
      publicKey: this.advertiserKeypair.publicKey,
      signTransaction: async (tx) => {
        tx.partialSign(this.advertiserKeypair);
        return tx;
      },
      signAllTransactions: async (txs) => {
        return txs.map(tx => {
          tx.partialSign(this.advertiserKeypair);
          return tx;
        });
      }
    };
    
    const provider = new AnchorProvider(
      this.connection,
      wallet,
      { commitment: 'confirmed' }
    );
    
    return new Program(idl, this.programId, provider);
  }
  
  async fundEscrow(x402Data) {
    const { offerId, escrowPda, paymentAmount, userPubkey, platformPubkey } = x402Data;
    
    console.log(`Funding escrow for offer ${offerId}...`);
    console.log(`Amount: ${paymentAmount} lamports (${paymentAmount / 1e9} SOL)`);
    console.log(`Escrow PDA: ${escrowPda}`);
    
    try {
      // Derive PDA (should match escrowPda from backend)
      const [derivedPda, bump] = await PublicKey.findProgramAddressSync(
        [Buffer.from('escrow'), Buffer.from(offerId)],
        this.programId
      );
      
      if (derivedPda.toBase58() !== escrowPda) {
        throw new Error('PDA mismatch - backend and client derived different addresses');
      }
      
      // Call createEscrow instruction
      const tx = await this.program.methods
        .createEscrow(
          offerId,
          new BN(paymentAmount)
        )
        .accounts({
          escrow: new PublicKey(escrowPda),
          advertiser: this.advertiserKeypair.publicKey,
          user: new PublicKey(userPubkey),
          platform: new PublicKey(platformPubkey),
          systemProgram: SystemProgram.programId
        })
        .rpc();
      
      console.log(`✅ Escrow funded successfully!`);
      console.log(`Transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
      
      // Wait for confirmation
      await this.connection.confirmTransaction(tx, 'confirmed');
      
      return tx;
      
    } catch (error) {
      console.error('❌ Escrow funding failed:', error);
      throw error;
    }
  }
  
  async getBalance() {
    const balance = await this.connection.getBalance(this.advertiserKeypair.publicKey);
    return balance / 1e9; // Convert to SOL
  }
}
```

**Important:** Import `BN` (Big Number) from `@coral-xyz/anchor` for handling lamports:
```javascript
import { BN } from '@coral-xyz/anchor';
```

**Success criteria:** Can fund escrows on Solana devnet

---

### WP06.6-06.7: Main Agent Loop (2 hours)

**Create `peggy.js`:**
```javascript
import { LLMClient } from './lib/llm.js';
import { BackendClient } from './lib/api.js';
import { EscrowFunder } from './lib/escrow.js';
import { config } from './config.js';

class PeggyAgent {
  constructor() {
    this.llm = new LLMClient();
    this.api = new BackendClient();
    this.escrow = new EscrowFunder();
    this.processedOffers = new Set();
  }
  
  async start() {
    console.log('🤖 Peggy starting up...');
    console.log(`Advertiser: ${config.advertiserId}`);
    console.log(`Wallet: ${this.escrow.advertiserKeypair.publicKey.toBase58()}`);
    
    const balance = await this.escrow.getBalance();
    console.log(`Balance: ${balance} SOL`);
    
    if (balance < 1) {
      console.warn('⚠️  Low balance! Request airdrop:');
      console.warn(`solana airdrop 5 ${this.escrow.advertiserKeypair.publicKey.toBase58()} --url devnet`);
    }
    
    console.log(`\nPolling for offers every ${config.pollInterval / 1000}s...\n`);
    
    // Main loop
    while (true) {
      try {
        await this.processOffers();
      } catch (error) {
        console.error('Error in main loop:', error);
      }
      
      await this.sleep(config.pollInterval);
    }
  }
  
  async processOffers() {
    // 1. Fetch pending offers
    const offers = await this.api.fetchPendingOffers();
    
    if (offers.length === 0) {
      console.log(`[${new Date().toLocaleTimeString()}] No pending offers`);
      return;
    }
    
    console.log(`\n[${new Date().toLocaleTimeString()}] Found ${offers.length} pending offer(s)`);
    
    // 2. Evaluate each offer
    for (const offer of offers) {
      // Skip if already processed
      if (this.processedOffers.has(offer.offerId)) {
        continue;
      }
      
      try {
        await this.handleOffer(offer);
        this.processedOffers.add(offer.offerId);
      } catch (error) {
        console.error(`Failed to handle offer ${offer.offerId}:`, error);
      }
    }
  }
  
  async handleOffer(offer) {
    console.log(`\n📋 Evaluating offer ${offer.offerId}...`);
    console.log(`   User: ${offer.userId}`);
    console.log(`   Price: $${offer.requestedPrice}`);
    console.log(`   Match: ${offer.matchScore}/5`);
    
    // Get campaign criteria (in real system, this would come from database)
    const campaignCriteria = this.getCampaignCriteria(offer.campaignId);
    
    // 3. LLM evaluation
    console.log(`\n💭 Peggy thinking...`);
    const decision = await this.llm.evaluateOffer(offer, campaignCriteria);
    
    console.log(`\n${decision.decision === 'accept' ? '✅' : '❌'} Decision: ${decision.decision.toUpperCase()}`);
    console.log(`   Reasoning: ${decision.reasoning}`);
    console.log(`   Confidence: ${(decision.confidence * 100).toFixed(0)}%`);
    
    if (decision.decision === 'reject') {
      return;
    }
    
    // 4. Accept offer (get x402 response)
    console.log(`\n📤 Accepting offer ${offer.offerId}...`);
    const x402 = await this.api.acceptOffer(offer.offerId);
    
    console.log(`\n💰 Received x402 Payment Required:`);
    console.log(`   Escrow PDA: ${x402.escrowPda}`);
    console.log(`   Amount: ${x402.paymentAmount} lamports (${x402.paymentAmount / 1e9} SOL)`);
    
    // 5. Fund escrow on Solana
    const txSignature = await this.escrow.fundEscrow(x402);
    
    // 6. Submit payment proof
    console.log(`\n📝 Submitting payment proof...`);
    const verification = await this.api.submitPaymentProof(offer.offerId, txSignature);
    
    console.log(`\n✅ Offer ${offer.offerId} fully funded!`);
    console.log(`   Status: ${verification.offerStatus}`);
    console.log(`   User can now queue ad for viewing`);
  }
  
  getCampaignCriteria(campaignId) {
    // TODO: In production, fetch from database
    // For hackathon, use hardcoded criteria
    return {
      campaignName: 'Nike Golf Championship',
      targeting: {
        age: '40-60',
        interests: ['golf', 'sports'],
        location: ['uk', 'us']
      },
      budgetRemaining: 1000,
      maxCpm: 0.030,
      goal: 'Drive awareness for new golf club line'
    };
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Start Peggy
const peggy = new PeggyAgent();
peggy.start().catch(console.error);
```

**Success criteria:** Peggy runs autonomously, funding escrows for accepted offers

---

### WP06.8: Demo Integration (1 hour)

**Update `package.json`:**
```json
{
  "name": "peggy-advertiser-agent",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node peggy.js",
    "dev": "nodemon peggy.js"
  },
  "dependencies": {
    "@solana/web3.js": "^1.87.6",
    "@coral-xyz/anchor": "^0.30.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

**Create `README.md`:**
```markdown
# Peggy - Advertiser Agent

Autonomous AI agent that evaluates user offers and funds Solana escrows using x402 protocol.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. Ensure advertiser wallet has SOL:
   ```bash
   solana airdrop 5 $(solana-keygen pubkey ~/.config/solana/advertiser.json) --url devnet
   ```

## Running

```bash
npm start
```

## Demo Flow

1. Max (user agent) makes offers → Backend
2. Peggy polls backend every 30s
3. Peggy evaluates offers with LLM
4. Peggy accepts good offers
5. Backend responds with HTTP 402
6. Peggy funds escrow on Solana
7. Peggy submits payment proof
8. Max validates escrow & queues ad

## Monitoring

Peggy logs all decisions with reasoning:
```
✅ ACCEPT: Nike Golf - Strong match (5/5), price fair ($0.025 vs $0.030 max)
❌ REJECT: Random Sneakers - Weak match (1/5), overpriced ($0.020 vs $0.005 max)
```
```

**Success criteria:** Peggy can be run with `npm start` for demo

---

### WP06.9: Testing (1 hour)

**Test Plan:**

1. **Unit Test - LLM Evaluation:**
   ```bash
   # Test with mock offer
   node -e "
   import { LLMClient } from './lib/llm.js';
   const llm = new LLMClient();
   const result = await llm.evaluateOffer({
     userId: 'user_001',
     offerId: 'offer_test_001',
     requestedPrice: 0.025,
     matchScore: 5,
     userReputation: 0.9,
     historicalCtr: 12.5,
     historicalConversion: 3.2
   }, {
     campaignName: 'Nike Golf',
     maxCpm: 0.030,
     budgetRemaining: 1000
   });
   console.log(result);
   "
   ```

2. **Integration Test - API Calls:**
   ```bash
   # Start backend
   cd ../backend && npm run dev &
   
   # Test offer fetching
   node -e "
   import { BackendClient } from './lib/api.js';
   const api = new BackendClient();
   const offers = await api.fetchPendingOffers();
   console.log('Offers:', offers);
   "
   ```

3. **End-to-End Test:**
   ```bash
   # Run Peggy for 5 minutes
   timeout 300 npm start
   
   # Check:
   # - Peggy polls every 30s
   # - Offers evaluated with reasoning
   # - Accepted offers funded on Solana
   # - Payment proofs submitted
   # - Backend marks offers as "funded"
   ```

4. **Error Handling Test:**
   - Low wallet balance → Should warn but not crash
   - Network errors → Should retry with backoff
   - Invalid x402 response → Should log error and continue
   - Escrow funding failure → Should log and skip offer

**Success criteria:** Peggy runs reliably for 5+ minutes, funding multiple escrows

---

## 🔧 Technical Constraints

### Solana Smart Contract
- **Program ID:** `6ZEekbTJZ6D6KrfSGDY2ByoWENWfe8RzhvpBS4KtPdZr`
- **Instruction:** `createEscrow(offerId: string, amount: u64)`
- **Accounts required:**
  - `escrow` (PDA derived from offerId)
  - `advertiser` (signer - Peggy's wallet)
  - `user` (from x402 headers)
  - `platform` (from x402 headers)
  - `systemProgram`

### x402 Protocol
- **Status Code:** 402 Payment Required
- **Required Headers:**
  - `X-Offer-Id`
  - `X-Escrow-PDA`
  - `X-Payment-Amount` (in lamports)
  - `X-User-Pubkey`
  - `X-Platform-Pubkey`
  - `X-Escrow-Program`

### Backend API Endpoints

**GET /api/advertiser/offers**
- Query params: `status=offer_made`, `advertiser_id=adv_001`
- Returns: `{ offers: [...] }`

**POST /api/advertiser/offers/:id/accept**
- Returns: HTTP 402 with x402 headers

**POST /api/advertiser/payments/verify**
- Body: `{ offerId, txSignature }`
- Returns: `{ verified: true, offerStatus: "funded" }`

---

## 🎯 Design Decisions

### Why These Choices?

1. **Separate Process (Not Backend Integrated):**
   - Shows Peggy as truly autonomous agent
   - Easier to demo (start/stop independently)
   - Clear separation of concerns

2. **30-Second Polling:**
   - Reasonable for demo (not too spammy)
   - Users can see Peggy respond quickly
   - In production, use webhooks/websockets

3. **LLM-Based Evaluation:**
   - Demonstrates AI decision-making
   - More interesting than hardcoded rules
   - Can explain reasoning (transparency)

4. **Reuse Extension LLM Pattern:**
   - Consistent architecture with Max
   - Proven approach
   - Easy for judges to understand

5. **Simple Campaign Criteria (Hardcoded):**
   - No advertiser portal needed for hackathon
   - Focus on agent behavior, not CRUD
   - Can add database integration post-hackathon

---

## 📚 Reference Materials

### Max Agent (Similar Pattern)
- Location: `/extension/max-agent.js` (if exists)
- Review for LLM evaluation patterns
- Reuse prompt engineering approach

### Solana Smart Contract
- IDL: `/solana/payattn_escrow/target/idl/payattn_escrow.json`
- Test script: `/solana/payattn_escrow/fund-escrow-new.js`
- Documentation: `solana_dev.md`

### Backend API
- Routes: `/backend/app/api/advertiser/**`
- x402 implementation: `/backend/app/api/advertiser/offers/[id]/accept/route.ts`
- Payment verification: `/backend/app/api/advertiser/payments/verify/route.ts`

### Architecture Documents
- `solana_dev.md` - Complete Solana integration guide
- `TASKS.md` - WP06 section (this brief is based on it)
- `agents.md` - Max and Peggy personalities

---

## 🚨 Critical Gotchas

### 1. PDA Derivation Must Match Backend
```javascript
// Backend and Peggy MUST use same seeds
const [pda] = await PublicKey.findProgramAddressSync(
  [Buffer.from('escrow'), Buffer.from(offerId)],
  programId
);
```

### 2. Lamports vs SOL
```javascript
// Backend sends amount in lamports (1 SOL = 1e9 lamports)
const lamports = 10000000; // 0.01 SOL
const sol = lamports / 1e9;
```

### 3. Anchor BN Type
```javascript
import { BN } from '@coral-xyz/anchor';
// Use BN for large numbers
const amount = new BN(paymentAmount);
```

### 4. Transaction Confirmation
```javascript
// ALWAYS wait for confirmation
await connection.confirmTransaction(txSignature, 'confirmed');
// Otherwise payment verification may fail
```

### 5. Wallet Balance
```javascript
// Check balance before funding
const balance = await connection.getBalance(advertiserPubkey);
if (balance < paymentAmount + 5000) {
  throw new Error('Insufficient funds');
}
```

### 6. Rate Limiting
```javascript
// Don't spam backend
await sleep(pollInterval);
// Track processed offers to avoid duplicates
this.processedOffers.add(offerId);
```

---

## 📊 Success Metrics

### Functional Requirements
- ✅ Peggy polls backend every 30s
- ✅ Evaluates offers with LLM reasoning
- ✅ Accepts offers matching campaign criteria
- ✅ Funds escrows on Solana successfully
- ✅ Submits payment proofs to backend
- ✅ Runs autonomously for 5+ minutes
- ✅ Handles errors gracefully (no crashes)

### Demo Quality
- ✅ Clear console logging with emojis
- ✅ Shows Peggy's reasoning for each decision
- ✅ Displays Solana Explorer links
- ✅ Easy to start/stop (`npm start`)
- ✅ README explains setup clearly

### Code Quality
- ✅ Modular structure (lib/ for reusable code)
- ✅ Error handling at all API boundaries
- ✅ Environment configuration via .env
- ✅ Comments explaining complex logic
- ✅ Consistent with Max agent patterns

---

## 🎬 Demo Script for Judges

**Terminal 1: Backend**
```bash
cd backend
npm run dev
```

**Terminal 2: Max (User Agent)**
```bash
cd extension
# Load extension in Chrome, make offers
```

**Terminal 3: Peggy (Advertiser Agent)**
```bash
cd advertiser-agent
npm start
```

**Watch Peggy work:**
```
🤖 Peggy starting up...
Advertiser: adv_001
Wallet: AE6uwbubDn9WyXrpzvqU58jfirvqZAxWCZCfDDwW5MMb
Balance: 4.46 SOL

Polling for offers every 30s...

[14:32:15] Found 2 pending offer(s)

📋 Evaluating offer offer_abc123...
   User: user_001
   Price: $0.025
   Match: 5/5

💭 Peggy thinking...

✅ Decision: ACCEPT
   Reasoning: Excellent match (5/5 criteria), price is fair ($0.025 
              vs $0.030 max CPM), user has strong reputation (92%) 
              and high historical CTR (15.2%). This is exactly our 
              target audience.
   Confidence: 95%

📤 Accepting offer offer_abc123...

💰 Received x402 Payment Required:
   Escrow PDA: B6a1aL5g4oP9iAqCU1egBszdB1CBcYBmEBaUBeVQoeKo
   Amount: 10000000 lamports (0.01 SOL)

Funding escrow for offer offer_abc123...
✅ Escrow funded successfully!
Transaction: https://explorer.solana.com/tx/5tx1m...?cluster=devnet

📝 Submitting payment proof...

✅ Offer offer_abc123 fully funded!
   Status: funded
   User can now queue ad for viewing
```

---

## ⏱️ Time Breakdown

| Task | Estimated Time |
|------|----------------|
| WP06.1: Core structure & dependencies | 2 hours |
| WP06.2: LLM integration | 2 hours |
| WP06.3: Offer fetching & polling | 1 hour |
| WP06.4-06.5: Escrow funding | 3 hours |
| WP06.6-06.7: Main agent loop | 2 hours |
| WP06.8: Demo integration & docs | 1 hour |
| WP06.9: Testing & debugging | 2 hours |
| Buffer for integration issues | 1 hour |
| **TOTAL** | **14 hours** |

**Realistic schedule:** 1.5 days (Nov 9-10)

---

## 📞 Support Resources

### If You Get Stuck

1. **Check existing implementations:**
   - Backend x402 flow: `/backend/app/api/advertiser/offers/[id]/accept/route.ts`
   - Escrow test script: `/solana/payattn_escrow/fund-escrow-new.js`
   - Settlement test: `/solana/payattn_escrow/test-impression-settlement.sh`

2. **Reference documentation:**
   - `solana_dev.md` - Complete Solana guide with troubleshooting
   - `TASKS.md` - WP06 section with all requirements
   - `agents.md` - Peggy personality and behavior

3. **Test incrementally:**
   - Test LLM evaluation first (mock data)
   - Test API calls separately (no escrow)
   - Test escrow funding in isolation
   - Combine everything last

4. **Use existing wallet keys:**
   - Advertiser: `~/.config/solana/advertiser.json`
   - Backend/Platform: `~/.config/solana/payattn-backend.json`
   - Test user: `~/.config/solana/test-user.json`

---

## ✅ Definition of Done

Peggy is complete when:
1. Can be started with `npm start`
2. Polls backend every 30s for offers
3. Evaluates offers with LLM (shows reasoning)
4. Accepts matching offers (rejects bad ones)
5. Funds Solana escrows successfully
6. Submits payment proofs to backend
7. Runs reliably for 5+ minutes without crashes
8. Includes README with setup instructions
9. Demo-ready console output (clear, informative)
10. Tested end-to-end with real backend and Solana devnet

---

## 🚀 Go Build!

You have everything you need. The backend is ready, the smart contract is deployed, and Max is making offers. Now build Peggy to complete the x402 agent economy!

**Questions before starting?** Review:
- `solana_dev.md` for Solana details
- `TASKS.md` WP06 for requirements
- `/solana/payattn_escrow/fund-escrow-new.js` for working escrow code

**Good luck! 🎉**
