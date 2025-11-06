# Quick Start: Deploy Cloudflare Worker for ZK-SNARK Verification

## 5-Minute Setup

### 1. Install Wrangler & Login (2 minutes)

```bash
# Install Cloudflare Workers CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login
# This opens browser - click "Allow" to authorize
```

### 2. Configure Worker (1 minute)

```bash
cd cf-worker

# The wrangler.toml is already configured with your account_id
# Just verify it looks correct:
cat wrangler.toml

# You should see:
# account_id = "1bcc09d98bc0a5326d6050ad71e2afa6"
# 
# Note: account_id is NOT sensitive - it's public in your worker URLs
# Authentication is handled via: wrangler login (OAuth at machine level)
```

### 3. Deploy (2 minutes)

```bash
# Deploy to Cloudflare
wrangler deploy

# You'll see output like:
# ✨ Deployed to https://payattn-zk-verifier.your-subdomain.workers.dev
# 
# SAVE THIS URL! You'll need it for the backend.
```

### 4. Test It Works

```bash
# Health check (should return 200 OK)
curl https://your-worker-url.workers.dev/

# Expected response:
# {"status":"ok","service":"payattn-zk-verifier",...}
```

## Done! 🎉

Your worker is live and ready to verify proofs!

---

## Next: Connect to Backend

Add this to `/agent-dashboard/.env.local`:

```bash
CLOUDFLARE_WORKER_URL=https://your-worker-url.workers.dev
```

Then update `/agent-dashboard/lib/zk/verifier.ts` to call the worker instead of local verification.

See `DEPLOYMENT_CHECKLIST.md` for detailed steps.

---

## Troubleshooting

**"account_id not found"**
- Make sure you copied account_id from Cloudflare dashboard
- It's a 32-character hex string

**"not logged in"**
- Run `wrangler login` again
- Make sure you allowed access in browser

**"script too large"**
- You need a premium Cloudflare account (allows 10MB, we use 6.6MB)
- Free tier has 1MB limit

**Still stuck?**
- Check full docs in `README.md`
- Run `wrangler tail` to see live logs
- Contact in Slack/Discord
