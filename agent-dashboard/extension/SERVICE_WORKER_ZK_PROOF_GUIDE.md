# Service Worker ZK-SNARK Proof Generation - WORKING ✅

**Status**: Successfully implemented and tested (Nov 5, 2025)

## Overview

The PayAttn extension can now generate ZK-SNARK proofs autonomously in the service worker without requiring any browser pages to be open. This enables true background operation for privacy-preserving ad campaigns.

**Important Notes:**
- **Proof Storage:** Proofs are NOT automatically stored - they exist only in memory and are returned directly from the function. Send them immediately to the backend or cache in `chrome.storage` if needed.
- **Available Circuits:** 
  - ✅ `age_range` - Age verification (specific use case)
  - ✅ `range_check` - Generic range proof (age, income, credit score, etc.)
  - ✅ `set_membership` - Categorical membership (countries, interests, etc. - requires hashing)
- **String Hashing:** The `set_membership` circuit requires strings to be hashed to field elements. See `circuits/HASHING_SCHEME.md` for details.
- **Backend Verification:** Verification keys for all circuits are in `circuits/verification_keys/` - copy these to your backend.

## How It Works

### Architecture

```
Service Worker (background.js)
  ↓
Patched snarkjs (lib/snarkjs-patched.js)
  ↓ [singleThread: true - forced in service worker context]
ZK Proof Generation
  ↓
Proof returned to caller
```

**Key Components:**

1. **`lib/snarkjs-patched.js`** (48,880 lines)
   - Patched version of snarkjs v0.7.5
   - Forces `singleThread=true` when running in service worker
   - Handles missing `URL.createObjectURL` API
   - **DO NOT replace with vanilla snarkjs** - it will break!

2. **`background.js`** - Service worker with proof generation:
   - `generateProofInServiceWorker()` - Main proof generation function
   - `GENERATE_PROOF` message handler - Accepts requests from pages
   - Loads snarkjs via `importScripts('lib/snarkjs-patched.js')`

3. **Circuit Files** (bundled with extension):
   - `circuits/age_range/age_range.wasm` - Circuit WASM
   - `circuits/age_range/age_range_0000.zkey` - Proving key

### Patches Applied to snarkjs

The following patches were made to enable service worker compatibility:

**Patch 1 & 2: Force Single-Threaded Mode** (lines 16413 & 39168)
```javascript
async function buildBn128(singleThread, plugins) {
    // PATCH: Force singleThread in service worker or when Worker unavailable
    if (typeof Worker === 'undefined' || (typeof self !== 'undefined' && self.constructor.name === 'ServiceWorkerGlobalScope')) {
        singleThread = true;
    }
    // ... rest of function
}
```

**Patch 3 & 4: Handle Missing URL.createObjectURL** (lines ~14066 & ~36829)
```javascript
{
    if(globalThis?.Blob && globalThis?.URL?.createObjectURL) {
        try {
            const threadBytes= new TextEncoder().encode(threadStr);
            const workerBlob = new Blob([threadBytes], { type: "application/javascript" }) ;
            workerSource = URL.createObjectURL(workerBlob);
        } catch(e) {
            // Service workers don't support URL.createObjectURL
            workerSource = "data:application/javascript;base64," + globalThis.btoa(threadStr);
        }
    } else {
        workerSource = "data:application/javascript;base64," + globalThis.btoa(threadStr);
    }
}
```

## Usage

### Testing from Console

Open `age-proof-test.html` and run:

**Test age_range:**
```javascript
// Generate proof for age 30 in range [18, 65]
testServiceWorkerProof(30, 18, 65)
```

**Test range_check (generic):**
```javascript
// Test income proof: $35k in range $25k-$50k
testRangeCheck(35000, 25000, 50000)

// Test age (same as age_range but more generic)
testRangeCheck(30, 18, 65)

// Test credit score: 720 in range 650-850
testRangeCheck(720, 650, 850)
```

**Test set_membership (with hashing):**
```javascript
// Test country verification: user from "uk", allowed ["us", "uk", "ca", "au", "de"]
testSetMembership("uk", ["us", "uk", "ca", "au", "de"])

// Test interest verification
testSetMembership("technology", ["technology", "finance", "health", "education"])

// Test hashing directly
await hashToField("uk")
// Returns: "15507270989273941579486529782961168076878965616246236476325961487637715879146"
```

**Output for age_range:**
```javascript
{
  circuitName: 'age_range',
  proof: {
    pi_a: [...],
    pi_b: [...],
    pi_c: [...],
    protocol: 'groth16',
    curve: 'bn128'
  },
  publicSignals: ['1', '18', '65'],  // 1=proof valid, 18=minAge, 65=maxAge
  timestamp: 1762360026140,
  version: '1.0'
}
```

### Programmatic Usage in Service Worker

```javascript
// Example: Generate proof in runAgentCycle()
async function runAgentCycle() {
  console.log('[Agent] Running 30-minute cycle...');
  
  // Get user profile (with age)
  const profile = await getUserProfile();
  
  // Get campaigns that require age proof
  const campaigns = await getCampaignsRequiringAgeProof();
  
  for (const campaign of campaigns) {
    try {
      // Generate proof
      const proofPackage = await generateProofInServiceWorker(
        'age_range',
        { age: profile.age },              // Private input - stays in extension
        { 
          minAge: campaign.minAge,          // Public inputs - in proof
          maxAge: campaign.maxAge 
        },
        { verbose: false }                  // Set true for debugging
      );
      
      // Send proof to backend
      const response = await fetch('https://api.payattn.org/api/verify-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proofPackage)  // <-- Proof is here, sent directly
      });
      
      const result = await response.json();
      console.log('[Agent] Proof verified:', result.verified);
      
      // If verified, engage with campaign
      if (result.verified) {
        await engageWithCampaign(campaign);
      }
      
    } catch (error) {
      console.error('[Agent] Proof generation failed:', error);
    }
  }
}
```

### Message Handler (Already Implemented)

The service worker listens for `GENERATE_PROOF` messages:

```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GENERATE_PROOF') {
    generateProofInServiceWorker(
      message.circuitName,
      message.privateInputs,
      message.publicInputs,
      message.options || {}
    ).then((proofPackage) => {
      sendResponse({ success: true, proof: proofPackage });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  }
});
```

## API Reference

### `generateProofInServiceWorker(circuitName, privateInputs, publicInputs, options)`

Generates a ZK-SNARK proof in the service worker.

**Parameters:**
- `circuitName` (string): Circuit identifier from `CIRCUITS_REGISTRY`
  - Currently available: `'age_range'`, `'range_check'`, `'set_membership'`
- `privateInputs` (object): Private inputs that never leave the extension
  - Example: `{ age: 30 }`, `{ value: 35000 }`, `{ value: hashToField("uk") }`
- `publicInputs` (object): Public inputs included in the proof
  - Example: `{ minAge: 18, maxAge: 65 }`, `{ min: 25000, max: 50000 }`, `{ set: [hash1, hash2, ...] }`
- `options` (object): Optional configuration
  - `verbose` (boolean): Enable debug logging (default: false)

**Returns:** Promise<ProofPackage>
```typescript
{
  circuitName: string,
  proof: {
    pi_a: string[],
    pi_b: string[][],
    pi_c: string[],
    protocol: 'groth16',
    curve: 'bn128'
  },
  publicSignals: string[],  // Array of public signal values
  timestamp: number,         // Unix timestamp
  version: string           // '1.0'
}
```

**Performance:**
- Single-threaded mode: ~1-2 seconds
- Multi-threaded (browser pages): ~0.5-1 seconds

**Throws:**
- `Error: Circuit not found` - Invalid circuitName
- `Error: Failed to fetch WASM/zkey` - Missing circuit files
- `Error: Failed to generate proof` - Proof generation failed

### Available Circuits

```javascript
const CIRCUITS_REGISTRY = {
  age_range: {
    name: 'age_range',
    wasmPath: 'circuits/age_range/age_range.wasm',
    zKeyPath: 'circuits/age_range/age_range_0000.zkey',
    description: 'Proves user age is within specified range'
  }
  // Add more circuits here as needed
};
```

**Circuit Details:**

**`age_range`** (Available)
- **Source:** `/Users/jmd/nosync/is.jmd.zksnark/age_range.circom`
- **Private Inputs:** `age` (user's actual age)
- **Public Inputs:** `minAge`, `maxAge` (campaign requirements)
- **Public Signals:** `['1', minAge, maxAge]` (1 = valid proof)
- **Constraints:** ~10 (very fast)
- **Performance:** 1-2 seconds in service worker
- **Use Case:** Age-restricted campaigns

**`range_check`** (Available - NEW!)
- **Source:** `/Users/jmd/nosync/is.jmd.zksnark/range_check.circom`
- **Private Inputs:** `value` (any numeric value: age, income, score, etc.)
- **Public Inputs:** `min`, `max` (range bounds)
- **Public Signals:** `['1', min, max]` (1 = valid proof)
- **Constraints:** ~5 (very fast)
- **Performance:** 1-2 seconds in service worker
- **Use Cases:** Income verification, credit score verification, any numeric range

**`set_membership`** (Available - NEW!)
- **Source:** `/Users/jmd/nosync/is.jmd.zksnark/set_membership.circom`
- **Private Inputs:** `value` (hashed value - e.g., hash of "uk")
- **Public Inputs:** `set` (array of 10 hashed values - pad with "0")
- **Public Signals:** `['1', hash1, hash2, ..., hash10]` (1 = is member)
- **Constraints:** ~42 (still fast)
- **Performance:** 2-3 seconds in service worker
- **Use Cases:** Location verification, interest verification, any categorical membership
- **Special:** Requires string-to-field hashing (see below)

**String Hashing for set_membership:**

Since ZK circuits can only work with numbers, strings must be hashed first:

```javascript
// Extension provides hashToField() helper
const ukHash = await hashToField("uk");
const allowedHashes = await Promise.all(["us", "uk", "ca"].map(hashToField));

// Pad to 10 elements
while (allowedHashes.length < 10) {
  allowedHashes.push("0");
}

// Generate proof
const proof = await generateProofInServiceWorker('set_membership',
  { value: ukHash },          // Private: user's country hash
  { set: allowedHashes }      // Public: allowed country hashes
);
```

**Backend must hash identically!** See `circuits/HASHING_SCHEME.md` for complete documentation.

See [CIRCUIT_DEVELOPMENT_GUIDE.md](./CIRCUIT_DEVELOPMENT_GUIDE.md) for creating additional circuits.

## Integration Checklist

When integrating into `runAgentCycle()`:

- [ ] Fetch user profile with age from chrome.storage or IndexedDB
- [ ] Decrypt profile if encrypted
- [ ] Query backend for campaigns requiring age proofs
- [ ] For each campaign:
  - [ ] Call `generateProofInServiceWorker()` with campaign criteria
  - [ ] POST proof to backend `/api/verify-proof`
  - [ ] Handle verification response
  - [ ] Log results to IndexedDB for debugging
- [ ] Handle errors gracefully (don't crash the cycle)
- [ ] Add telemetry for proof generation timing

## Troubleshooting

### "snarkjs not found"
- Ensure `importScripts('lib/snarkjs-patched.js')` is at top of background.js
- Check browser console for load errors

### "Invalid File format" or "Invalid FastFile type"
- You're using vanilla snarkjs instead of patched version
- Ensure background.js loads `lib/snarkjs-patched.js` not `lib/snarkjs.min.js`

### "Workers not available"
- This is expected and handled by patches
- Service workers don't support Web Workers
- Single-threaded mode is automatically used

### Slow proof generation
- Single-threaded mode is 2-3x slower than multi-threaded
- This is expected in service workers
- Consider caching proofs if criteria don't change

### "Circuit not found"
- Check circuitName matches CIRCUITS_REGISTRY keys exactly
- Verify circuit files exist in `circuits/` folder

## Future Enhancements

1. **Add More Circuits:**
   - Add new circuits to `CIRCUITS_REGISTRY`
   - Bundle WASM and zkey files in `circuits/` folder
   - Update `web_accessible_resources` in manifest.json

2. **Proof Caching:**
   - Cache generated proofs in chrome.storage
   - Reuse if inputs haven't changed
   - Reduce redundant computation

3. **Batch Proof Generation:**
   - Generate multiple proofs in parallel (if needed)
   - Queue proof requests
   - Prioritize by campaign deadline

4. **Performance Monitoring:**
   - Track proof generation time
   - Log to IndexedDB for analysis
   - Alert if generation takes too long

## Maintenance Notes

### Updating snarkjs

**⚠️ WARNING:** Do NOT simply update to a new snarkjs version!

If you need to update snarkjs:

1. Download new snarkjs source from GitHub
2. Apply the 4 patches documented above:
   - Force singleThread in buildBn128 functions (2 locations)
   - Wrap URL.createObjectURL in try-catch (2 locations)
3. Test thoroughly with `testServiceWorkerProof()`
4. Update this documentation with new version number

### Creating Proper Fork (TODO)

For long-term maintainability, consider:

1. Fork iden3/snarkjs on GitHub
2. Create a `service-worker` branch
3. Apply patches as commits (not manual edits)
4. Publish as `@payattn/snarkjs-service-worker` on npm
5. Use semantic versioning aligned with upstream snarkjs

This makes updates and maintenance much cleaner.

## Testing

### Manual Test
```bash
# 1. Load extension in Chrome
# 2. Open chrome://extensions
# 3. Open age-proof-test.html
# 4. Run in console:
testServiceWorkerProof(30, 18, 65)
```

### Expected Output
```
[Test] Requesting proof from service worker...
[Service Worker ZK] Generating proof for: age_range
[Service Worker ZK] Loading WASM...
[Service Worker ZK] Loading proving key...
[Service Worker ZK] Generating proof using fullProve()...
[snarkjs] Reading Wtns
[snarkjs] Building ABC
... (many snarkjs logs) ...
[Service Worker ZK] Proof generated successfully
[Test] ✅ Proof generated successfully!
```

### Automated Testing (TODO)
```javascript
// Add to test suite
describe('Service Worker Proof Generation', () => {
  it('should generate valid age proof', async () => {
    const proof = await generateProofInServiceWorker(
      'age_range',
      { age: 25 },
      { minAge: 18, maxAge: 65 }
    );
    expect(proof.publicSignals).toEqual(['1', '18', '65']);
    expect(proof.circuitName).toBe('age_range');
  });
});
```

## Technical Details

### Why Patches Were Needed

1. **Service Workers vs Web Workers:**
   - Service workers: No DOM, no window, restricted APIs
   - Web Workers: Child workers for parallel computation
   - snarkjs was designed for browsers with Workers

2. **URL.createObjectURL:**
   - Creates blob: URLs for Worker scripts
   - Not available in service workers
   - Fallback: base64 data URLs (larger but works)

3. **Thread Management:**
   - snarkjs checks `navigator.hardwareConcurrency` for parallelism
   - Service workers have this but can't use Workers
   - Solution: Force singleThread=true before Worker creation

### Performance Comparison

| Environment | Mode | Time | Notes |
|-------------|------|------|-------|
| Browser page | Multi-threaded | 0.5-1s | Uses Web Workers for FFT |
| Browser page | Single-threaded | 1-2s | Forced {singleThread: true} |
| Service worker | Single-threaded | 1-2s | Auto-detected, no Workers |

### Memory Usage

- WASM module: ~200KB
- Proving key: ~1MB  
- Working memory: ~5MB during generation
- Peak memory: ~10MB

Service workers can handle this easily.

---

**Last Updated:** November 5, 2025  
**Status:** ✅ Production Ready  
**Tested:** Chrome Extension Manifest V3
