# Cloudflare Worker: ZK-SNARK Proof Verifier (ABANDONED)

**⚠️ THIS APPROACH WAS ABANDONED - See `../rapidsnark-server` for the working solution.**

**Purpose:** This was an attempt to implement server-side ZK-SNARK proof verification using Cloudflare Workers (V8 runtime).

## Why This Failed

After 8 deployment iterations, we discovered that Cloudflare Workers is incompatible with snarkjs/ffjavascript for ZK-SNARK verification:

1. **Missing Browser APIs:** CF Workers doesn't support `URL.createObjectURL()` which ffjavascript uses for Web Worker initialization
2. **No Web Workers:** BN128 curve operations in ffjavascript try to spawn Web Workers via `buildBn128()`
3. **Edge Runtime Limitations:** CF Workers is neither full Node.js nor full browser - it's missing APIs that both snarkjs paths depend on

## Attempts Made

1. ❌ **Browser bundle (IIFE)** - Export issues, couldn't access `snarkjs.groth16`
2. ❌ **Custom loader** - Tried wrapping browser bundle, still IIFE problems
3. ❌ **npm package** - Hit `URL.createObjectURL()` error in ffjavascript
4. ❌ **`process.browser = false`** - Didn't prevent Worker initialization
5. ❌ **`{singleThread: true}` option** - Only works for `prove()`, not `verify()`
6. ❌ **Hiding `globalThis.Worker`** - ffjavascript still tried to use Workers
7. ❌ **Patched curves.js** - Would require complex module replacement
8. ❌ **Multiple wrangler versions** - Not a tooling issue

## Current Solution

**Use Rapidsnark C++ verifier CLI instead** (see `/rapidsnark-server`):
- Native C++ binary, no JavaScript runtime issues
- Fast verification (~10-50ms)
- Called as child process from Next.js backend
- Production-proven (used by Polygon ID, iden3 ecosystem)

## Files in This Directory

This directory contains the abandoned CF Worker attempt and should be archived or removed in production:
- `worker.js` - Failed worker implementation (8 versions deployed)
- `verification-keys-embedded.js` - Embedded vkeys (worked fine)
- `snarkjs-loader.js` - Custom loader attempt (failed)
- `package.json` - npm snarkjs dependency
- `wrangler.toml` - CF Worker configuration

## Lessons Learned

1. **ZK-SNARK libraries are Node.js/Browser-specific** - Edge runtimes like CF Workers often lack required APIs
2. **snarkjs has no official edge runtime support** - The `{singleThread: true}` option is undocumented and only for proving
3. **Native solutions (C++/Rust) are more portable** - Rapidsnark works everywhere without runtime issues
4. **Always verify platform compatibility early** - Would have saved 8 deployment iterations

## For Future Reference

If you need server-side ZK-SNARK verification:
1. ✅ **Use Rapidsnark** (C++) - Works on any platform
2. ✅ **Use Arkworks** (Rust) - Can compile to WASM without Workers
3. ⚠️ **Use snarkjs CLI** - Works in Node.js but avoid BN128 curves (hang issues)
4. ❌ **Avoid CF Workers** - Incompatible with current ZK-SNARK JavaScript libraries

---

**This directory is kept for documentation purposes only.**

This worker solves the Node.js verification hanging issue by running in a V8 environment (same as Chrome extension) instead of Node.js.

---

## Architecture

```
Extension (generates proof)
     ↓
Backend Cron Job (automated)
     ↓
POST request → Cloudflare Worker → Verifies proof
     ↓
Returns { valid: true/false }
     ↓
Backend processes result
```

---

## Why Cloudflare Workers?

1. **V8 Runtime** - Same JavaScript engine as Chrome extension (not Node.js)
2. **No BN128 Hang** - Avoids Node.js-specific issues
3. **Fast** - Edge compute, distributed globally
4. **Scalable** - Can handle concurrent verification requests
5. **Simple** - Single HTTP endpoint

---

## Files in This Directory

- `worker.js` - Main Cloudflare Worker script (verification logic)
- `wrangler.toml.example` - Template configuration (copy to wrangler.toml)
- `.dev.vars.example` - Template for local dev secrets (copy to .dev.vars)
- `package.json` - Dependencies for local development/testing
- `verification-keys/` - Verification keys for each circuit
- `lib/` - snarkjs library and utilities

---

## Setup Instructions

### 1. Prerequisites

```bash
# Install Wrangler CLI (Cloudflare Workers tool)
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### 2. Configure Worker

```bash
cd cf-worker

# Copy example config
cp wrangler.toml.example wrangler.toml

# Edit wrangler.toml:
# - Set your account_id (get from Cloudflare dashboard)
# - Set your worker name (e.g., "payattn-zk-verifier")
```

### 3. Set Environment Variables (Optional)

```bash
# Copy secrets template
cp .dev.vars.example .dev.vars

# Edit .dev.vars and add any API keys or secrets
# These are for LOCAL DEVELOPMENT ONLY
# For production, use: wrangler secret put SECRET_NAME
```

### 4. Deploy Worker

```bash
# Deploy to production
wrangler deploy

# You'll get a URL like: https://payattn-zk-verifier.your-subdomain.workers.dev
```

---

## API Endpoint

### POST /verify-proof

**Request Body:**
```json
{
  "proof": {
    "pi_a": ["...", "...", "..."],
    "pi_b": [["...", "..."], ["...", "..."], ["...", "..."]],
    "pi_c": ["...", "...", "..."],
    "protocol": "groth16",
    "curve": "bn128"
  },
  "publicSignals": ["...", "..."],
  "circuitName": "range_check"
}
```

**Response (Success):**
```json
{
  "valid": true,
  "circuitName": "range_check",
  "verificationTime": 145,
  "timestamp": 1762420800000
}
```

**Response (Invalid Proof):**
```json
{
  "valid": false,
  "circuitName": "range_check",
  "verificationTime": 142,
  "timestamp": 1762420800000
}
```

**Response (Error):**
```json
{
  "error": "Circuit not found: invalid_circuit",
  "circuitName": "invalid_circuit",
  "timestamp": 1762420800000
}
```

---

## Testing Locally

```bash
# Run local dev server
wrangler dev

# Test with curl
curl -X POST http://localhost:8787/verify-proof \
  -H "Content-Type: application/json" \
  -d @test-proof.json
```

---

## Backend Integration

Update your backend's `verifier.ts` to call this worker:

```typescript
// Instead of local verification:
const response = await fetch('https://your-worker.workers.dev/verify-proof', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    proof: proof,
    publicSignals: publicSignals,
    circuitName: circuitName
  })
});

const result = await response.json();
console.log('Verification result:', result.valid);
```

---

## Security Considerations

### ✅ Safe to Expose
- Verification keys (public by design)
- Worker endpoint URL
- Circuit names

### ❌ Keep Private (DO NOT commit to Git)
- `wrangler.toml` (contains account_id)
- `.dev.vars` (contains API keys/secrets)
- Any authentication tokens

### Protection Methods
1. **Rate Limiting** - Cloudflare has built-in DDoS protection
2. **Authentication** - Add API key header for backend requests
3. **CORS** - Restrict origins if needed

---

## Supported Circuits

- `age_range` - Age range membership proof
- `range_check` - Generic range proof (e.g., income)
- `set_membership` - Set membership proof (e.g., country)

---

## Performance

**Expected Verification Times:**
- Range check: ~100-200ms
- Set membership: ~150-250ms
- Age range: ~100-200ms

**Cloudflare Workers Limits (Premium):**
- Script size: Up to 10MB (snarkjs is 6.6MB ✅)
- CPU time: Up to 30s (we need <1s ✅)
- Memory: 128MB (sufficient for verification ✅)

---

## Troubleshooting

### Worker deployment fails
```bash
# Check you're logged in
wrangler whoami

# Check account_id is correct
wrangler tail
```

### Verification returns errors
- Check circuit name matches exactly
- Verify proof format is correct (Groth16)
- Check verification key is loaded

### Timeout errors
- Premium account should handle this
- Check worker execution time in Cloudflare dashboard

---

## Development Workflow

1. Make changes to `worker.js`
2. Test locally: `wrangler dev`
3. Deploy: `wrangler deploy`
4. Test production endpoint
5. Update backend to use new endpoint

---

## Cost

- **Free tier:** 100,000 requests/day
- **Premium tier:** Higher limits + longer CPU time
- **Current usage:** ~1 verification per proof (minimal cost)

---

## Next Steps

1. ✅ Deploy worker
2. ✅ Get worker URL
3. ✅ Update backend verifier.ts to call worker
4. ✅ Test end-to-end verification
5. ✅ Integrate with cron job

---

## Support

- Cloudflare Workers Docs: https://developers.cloudflare.com/workers/
- Wrangler CLI Docs: https://developers.cloudflare.com/workers/wrangler/
