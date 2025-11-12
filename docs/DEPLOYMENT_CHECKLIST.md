# Cloudflare Worker Deployment Checklist

## Prerequisites

- [ ] Cloudflare account with premium plan (for extended CPU time)
- [ ] Wrangler CLI installed (`npm install -g wrangler`)
- [ ] Logged into Cloudflare (`wrangler login`)

## Setup Steps

### 1. Configure Worker

```bash
cd cf-worker

# Copy configuration template
cp wrangler.toml.example wrangler.toml

# Edit wrangler.toml and set:
# - account_id (from Cloudflare dashboard)
# - worker name (e.g., "payattn-zk-verifier")
```

**Get your account_id:**
1. Go to https://dash.cloudflare.com/
2. Click on Workers & Pages
3. Your account ID is in the URL or right sidebar

### 2. Test Locally (Optional)

```bash
# Install dependencies
npm install

# Run local dev server
wrangler dev

# Test health endpoint
curl http://localhost:8787/

# Test verification (use a real proof from extension)
curl -X POST http://localhost:8787/verify-proof \
  -H "Content-Type: application/json" \
  -d @../test-proof.json
```

### 3. Deploy to Production

```bash
# Deploy worker
wrangler deploy

# You'll get a URL like:
# https://payattn-zk-verifier.your-subdomain.workers.dev
```

### 4. Test Production Endpoint

```bash
# Health check
curl https://your-worker-url.workers.dev/

# Expected response:
# {"status":"ok","service":"payattn-zk-verifier","version":"1.0.0","circuits":[...]}

# Verify a proof
curl -X POST https://your-worker-url.workers.dev/verify-proof \
  -H "Content-Type: application/json" \
  -d '{
    "proof": {...},
    "publicSignals": [...],
    "circuitName": "range_check"
  }'
```

### 5. Update Backend

Edit `/agent-dashboard/lib/zk/verifier.ts`:

```typescript
// Add at top of file
const CLOUDFLARE_WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https://your-worker-url.workers.dev';

// In verifyProof function, replace local verification with:
const response = await fetch(`${CLOUDFLARE_WORKER_URL}/verify-proof`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    proof,
    publicSignals,
    circuitName
  })
});

const result = await response.json();
if (!response.ok) {
  throw new Error(result.error || 'Verification failed');
}

return result;
```

### 6. Set Environment Variable

In your backend (Next.js):

```bash
# Add to .env.local
CLOUDFLARE_WORKER_URL=https://your-worker-url.workers.dev
```

### 7. Test End-to-End

1. Generate proof in extension
2. Copy proof to advertiser UI (http://localhost:3000/advertisers)
3. Click "Verify Proof"
4. Should complete in <1 second with result

## Troubleshooting

### Worker deployment fails
```bash
# Check login status
wrangler whoami

# Check account_id is correct in wrangler.toml
# Get it from: https://dash.cloudflare.com/
```

### Verification returns errors
- Check circuit name matches exactly (case-sensitive)
- Verify proof format is correct Groth16 structure
- Check worker logs: `wrangler tail`

### "Script too large" error
The snarkjs.js file is 6.6MB. If deployment fails:
1. Verify you have premium Cloudflare plan (10MB limit vs 1MB)
2. Consider minifying snarkjs.js further
3. Contact Cloudflare support for script size increase

### Verification hangs in worker
This is the issue we're trying to solve! If it still hangs:
- Check Cloudflare Workers dashboard for timeout
- Premium plan should allow 30s CPU time
- May need to explore Python worker alternative

## Monitoring

```bash
# Watch live logs
wrangler tail

# Check worker analytics
# Go to Cloudflare Dashboard > Workers > your-worker > Analytics
```

## Security

### DO NOT commit:
- `wrangler.toml` (contains account_id)
- `.dev.vars` (contains secrets)
- Any API keys or tokens

### DO commit:
- `wrangler.toml.example` (template)
- `.dev.vars.example` (template)
- `worker.js` (code)
- Verification keys (public by design)

## Next Steps After Deployment

1. [ ] Save worker URL in environment variables
2. [ ] Update backend verifier.ts to use worker
3. [ ] Test with real proofs from extension
4. [ ] Monitor performance in Cloudflare dashboard
5. [ ] Set up alerts for errors/timeouts
6. [ ] Document worker URL for team

## Success Criteria

- [ ] Worker deploys successfully
- [ ] Health check returns 200 OK
- [ ] Verification completes in <1 second
- [ ] Backend cron job can call worker
- [ ] No hanging or timeout issues
- [ ] Valid proofs return `{"valid": true}`
- [ ] Invalid proofs return `{"valid": false}`
