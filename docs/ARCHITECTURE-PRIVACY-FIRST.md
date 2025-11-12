# ZK-SNARK Architecture - Fixed (Privacy-First Design)

**Date:** November 5, 2025  
**Status:** Architecture Corrected - Extension-Side Proof Generation

---

## 🔒 Privacy-First Architecture

### Core Principle
**Private data NEVER leaves the extension. Only cryptographic proofs are transmitted.**

```
USER'S DEVICE
┌─────────────────────────────────────────────────────────┐
│  Chrome Extension (Autonomous, Self-Contained)          │
│                                                         │
│  1. User data stored locally                           │
│     - Age: 45 years old  ← PRIVATE, STAYS HERE        │
│     - Location: London   ← PRIVATE, STAYS HERE        │
│     - Interests: Golf    ← PRIVATE, STAYS HERE        │
│                                                         │
│  2. Proof generation (extension/lib/zk-prover.js)      │
│     - Load WASM witness calculator                     │
│     - Load proving key (bundled with extension)       │
│     - Generate cryptographic proof                     │
│                                                         │
│  3. Proof output (safe to transmit)                    │
│     - { pi_a, pi_b, pi_c, publicSignals }             │
│     - Public signals: [1, 40, 60] (age range bounds)  │
│     - Never reveals actual age                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
                           │
                      Sends proof only
                      (not private data)
                           │
                           ▼
ADVERTISER'S SERVER
┌─────────────────────────────────────────────────────────┐
│  Backend (/api/verify-proof)                            │
│                                                         │
│  1. Receives proof + public signals                    │
│     - NO private data received ✅                      │
│                                                         │
│  2. Verification (lib/zk/verifier.ts)                 │
│     - Load verification key                           │
│     - Verify proof cryptographically                  │
│                                                         │
│  3. Result                                             │
│     - ✅ Proof valid = user matches criteria          │
│     - ❌ Proof invalid = user doesn't match criteria  │
│     - Neither case reveals actual user data           │
│                                                         │
└─────────────────────────────────────────────────────────┘
                           │
                    Display result
                           │
                           ▼
    Advertiser sees: "User matched age 40-60 criteria"
    But never sees: Actual age (45)
```

---

## Correct File Organization

### Extension (Proof Generation)

```
extension/
├── manifest.json
├── background.js          (service worker - fires every 30min)
├── popup.js
├── content.js
├── lib/
│   └── zk-prover.js      ✅ NEW - All proof generation logic here
│       - generateProof()
│       - generateAgeProof()
│       - loadWasm()
│       - loadProvingKey()
│       - (Private data NEVER leaves this file)
│
└── circuits/             ✅ Bundled with extension
    ├── age_range/
    │   ├── age_range.wasm               (34 KB)
    │   ├── age_range_0000.zkey          (4.1 MB - PROVEN KEY)
    │   └── witness_calculator.js        (10 KB)
    ├── range_proof/                     (WP02.4)
    └── set_membership/                  (WP02.4)
```

**Key Point:** Extension is autonomous. Service worker can call `generateProof()` anytime without server.

### Backend (Verification Only)

```
agent-dashboard/
├── lib/zk/
│   ├── verifier.ts       ✅ VERIFICATION ONLY
│   │   - verifyProof()
│   │   - verifyProofBatch()
│   │   - (Loads verification keys only, never generates proofs)
│   │
│   ├── circuits-registry.ts  (Shared configuration)
│   │   - Circuit metadata
│   │   - NOT used for proof generation
│   │
│   └── witness.ts        ❌ DELETE from backend
│   └── prover.ts         ❌ DELETE from backend
│   (These should only exist in extension)
│
└── app/api/verify-proof/
    └── route.ts          ✅ Receives proof, verifies it
```

### Backend Verification Keys (Small, Public)

```
public/circuits/
├── age_range/
│   └── verification_key.json            (3.2 KB)
├── range_proof/                         (WP02.4)
│   └── verification_key.json
└── set_membership/                      (WP02.4)
    └── verification_key.json
```

**Key Point:** Verification keys are public and needed on backend. They're small (~3 KB).

---

## Data Flow: Age Proof Example

### Step 1: Extension Generates Proof
```javascript
// In extension/background.js (service worker)
// This runs autonomously every 30 minutes

const userAge = 45;  // Read from secure storage in extension
const campaignMinAge = 40;
const campaignMaxAge = 60;

const proofPackage = await window.ZKProver.generateAgeProof(
  userAge,                    // PRIVATE - never leaves extension
  campaignMinAge,            // PUBLIC - from campaign
  campaignMaxAge,            // PUBLIC - from campaign
  { verbose: true }
);

// proofPackage contains:
// {
//   circuitName: 'age_range',
//   proof: { pi_a, pi_b, pi_c },
//   publicSignals: ['1', '40', '60'],  // Bounds, not actual age
//   timestamp: 1730797634000
// }

// Age (45) NEVER appears in output ✅
```

### Step 2: Extension Sends Proof to Backend
```javascript
// Still in extension

const serialized = window.ZKProver.serializeProof(proofPackage);

const response = await fetch('https://advertiser.com/api/verify-proof', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: serialized
});

// Request body:
// {
//   circuitName: 'age_range',
//   proof: { pi_a: [...], pi_b: [...], pi_c: [...] },
//   publicSignals: ['1', '40', '60'],
//   timestamp: 1730797634000
// }
//
// Contains NO private data ✅
```

### Step 3: Backend Verifies Proof
```typescript
// In backend /api/verify-proof

import { verifyProof } from '@/lib/zk/verifier';

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // Verify the proof
  const result = await verifyProof(
    body.circuitName,        // 'age_range'
    body.proof,              // Cryptographic proof
    body.publicSignals       // [1, 40, 60]
  );

  return NextResponse.json({
    success: result.valid,
    message: 'Proof verified successfully'
  });
}
```

### Step 4: Advertiser Sees Result
```
User matched: Age 40-60 criteria ✅

User's actual age (45) was NEVER revealed to advertiser.
Only the fact that they're in the range was proven.
```

---

## Verification Checklist

### Privacy (Core Requirement)
- Private inputs processed only in extension
- Private inputs never sent to backend
- Only proofs transmitted
- Backend never sees raw data
- Cryptographic guarantee of privacy

### Generic Circuits (Production Pattern)
- `age_range` - Initial validation circuit (test/reference)
- `range_proof` - Generic circuit for ANY numeric range (production)
  - Use for: age, income, score, etc.
- `set_membership` - Generic circuit for ANY category set (production)
  - Use for: location, interests, categories, etc.

### Extension Autonomy
- Extension self-contained (no server dependency for proof generation)
- Service worker can call proof generation anytime
- All WASM and proving keys bundled
- Proof generation doesn't require network calls

---

##  Implementation Tasks

### Task 1: Extension Proof Generation 
**File:** `extension/lib/zk-prover.js` (NEW)
- Loads WASM witness calculators
- Loads proving keys from bundled circuits
- Generates proofs from private data
- Returns proof (no private data)

### Task 2: Backend Verification Only 
**File:** `lib/zk/verifier.ts` (KEPT)
- Loads verification keys
- Verifies proofs from extension
- Returns verification result

### Task 3: Remove Proof Generation from Backend
**Files to DELETE:**
- `lib/zk/witness.ts` - Backend should NOT generate witnesses
- `lib/zk/prover.ts` - Backend should NOT generate proofs

**Why?** Backend doesn't have access to private data, so it can't generate proofs anyway. Keeping these files suggests wrong architecture.

### Task 4: Update Registry/Config
**File:** `lib/zk/circuits-registry.ts` (MODIFY)
- Keep as reference for circuit metadata
- Update to make clear backend uses this for verification only
- Extension uses its own copy with local paths

---

## Service Worker Use Case (Future)

This architecture enables autonomous proof generation:

```javascript
// extension/background.js - Runs every 30 minutes

chrome.alarms.create('proofGenerator', { periodInMinutes: 30 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'proofGenerator') {
    // Get user data from secure storage
    const userData = await chrome.storage.local.get(['age', 'location', 'interests']);
    
    // Get available campaigns from storage
    const campaigns = await chrome.storage.local.get('campaigns');
    
    // For each campaign, generate required proofs
    for (const campaign of campaigns) {
      if (campaign.targetAge) {
        const proof = await window.ZKProver.generateAgeProof(
          userData.age,
          campaign.targetAge.min,
          campaign.targetAge.max
        );
        
        // Send proof to advertiser
        await submitProofToAdvertiser(campaign.id, proof);
      }
    }
  }
});
```

**Key:** All private data stays in extension throughout.

---

## Security Guarantees

| Requirement | Before (❌) | After (✅) |
|------------|-----------|---------|
| Private data in extension only | Backend had access | Extension only |
| Private data never transmitted | Unclear | Guaranteed - only proofs sent |
| Proving keys secret | At risk | Only in extension, never exposed |
| Verification keys public | OK | Still public, needed on backend |
| Proof generation autonomous | Unclear | Yes - no server dependency |
| Batch proof generation | Risky | Safe - all in extension |

---

## Code Examples

### Extension Usage
```javascript
// In extension background.js or popup.js

const proof = await window.ZKProver.generateAgeProof(
  userAge,        // Private - from secure storage
  minAge,         // Public - from campaign
  maxAge,         // Public - from campaign
  { verbose: true }
);

// Proof now contains only:
// - circuitName
// - proof (pi_a, pi_b, pi_c)
// - publicSignals (age bounds, not actual age)
// - timestamp

// Send to backend
const response = await fetch('/api/verify-proof', {
  method: 'POST',
  body: JSON.stringify(proof)
});
```

### Backend Usage
```typescript
// In app/api/verify-proof/route.ts

const result = await verifyProof(
  proof.circuitName,
  proof.proof,
  proof.publicSignals
);

if (result.valid) {
  // User proved they match the criteria
}
```

---

## Why This Architecture Works

1. **Privacy-First:** Private data never leaves extension
2. **Autonomous:** Extension doesn't need server to generate proofs
3. **Scalable:** Multiple proofs can be generated offline, sent later
4. **Simple:** Clear separation of concerns
5. **Secure:** Cryptographic proofs can't be forged
6. **Generic:** Same circuits for all similar criteria

---

## Next: WP02.3

With this architecture confirmed:
1. Build age proof UI in extension
2. Test end-to-end (generate → send → verify)
3. Build advertiser display interface

All confident that privacy is maintained throughout.
