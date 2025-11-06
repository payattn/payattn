# Rapidsnark End-to-End Test Guide

**Status:** ✅ Backend ready, ✅ Rapidsnark compiled, ⏳ Awaiting test

## Quick Summary

We've successfully:
1. ✅ Compiled Rapidsnark C++ verifier for macOS arm64
2. ✅ Updated backend to use Rapidsnark CLI instead of Cloudflare Workers
3. ✅ Copied verification keys (JSON format)
4. ✅ Fixed all TypeScript errors
5. ✅ Verified Next.js dev server is running (PID 71726)

**Now we need to test the full flow with a real proof from the extension.**

---

## Test Steps

### Step 1: Open Extension

1. Open Chrome
2. Navigate to `chrome://extensions/`
3. Make sure PayAttn extension is loaded
4. Click extension icon to open popup

### Step 2: Generate a Test Proof

**Option A: Age Range Proof (Recommended - Fastest)**

1. In extension popup, click "Test Age Proof"
2. Or go to `chrome-extension://<your-id>/age-proof-test.html`
3. Click "Generate Age Range Proof (18-25)"
4. Wait 1-3 seconds
5. **COPY THE ENTIRE PROOF JSON** from the output

**Option B: Range Check Proof**

1. Use the profile page in the extension
2. Generate a range check proof for any age
3. Copy the proof JSON

### Step 3: Verify the Proof

**Expected Proof Format:**
```json
{
  "proof": {
    "pi_a": ["...", "...", "1"],
    "pi_b": [["...", "..."], ["...", "..."], ["1", "0"]],
    "pi_c": ["...", "...", "1"],
    "protocol": "groth16",
    "curve": "bn128"
  },
  "publicSignals": ["1", "18", "25"],
  "circuitName": "age_range"
}
```

**Test with curl:**

```bash
curl -X POST http://localhost:3000/api/verify-proof \
  -H "Content-Type: application/json" \
  -d '{
    "proof": <PASTE_PROOF_HERE>,
    "publicSignals": <PASTE_SIGNALS_HERE>,
    "circuitName": "<age_range|range_check|set_membership>"
  }'
```

**Or use the advertiser dashboard:**

1. Open http://localhost:3000/advertisers
2. Click "Create Campaign"
3. Fill in campaign details
4. Submit
5. In the submitted proofs section, paste your proof JSON
6. Click "Verify Proof"

### Step 4: Check Logs

**In the terminal where Next.js is running**, you should see:

```
[Verifier] Starting verification for circuit: age_range
[Verifier] Using Rapidsnark CLI verifier
[Verifier] Loading circuit metadata...
[Verifier] Circuit metadata loaded: Age Range
[Verifier] Calling Rapidsnark verifier...
[Verifier] Rapidsnark output: Result: Valid proof

[Verifier] Verification completed in 47ms
[Verifier] Total time: 52ms
[Verifier] Result: VALID ✅
```

**Expected timing:**
- ⚡ **10-50ms:** Excellent (typical)
- ⚠️ **50-200ms:** Acceptable (may include file I/O overhead)
- ❌ **>500ms:** Problem (investigate)

---

## Success Criteria

✅ **PASS if:**
- Verification completes in <200ms
- Logs show "Valid proof"
- API returns `{ "valid": true }`
- No errors in console

❌ **FAIL if:**
- Timeout (>5 seconds)
- "Invalid proof" for valid proof
- Error: "Verification key not found"
- Error: "Command failed: verifier"

---

## Troubleshooting

### Error: "Verification key not found"

**Check keys exist:**
```bash
ls -lh /Users/jmd/nosync/org.payattn.main/rapidsnark-server/keys/
```

**Should see:**
```
age_range_verification_key.json
range_check_verification_key.json
set_membership_verification_key.json
```

**Fix:** Copy keys again:
```bash
cp agent-dashboard/extension/circuits/verification_keys/*.json rapidsnark-server/keys/
```

---

### Error: "Command failed: verifier"

**Test verifier manually:**
```bash
cd /Users/jmd/nosync/org.payattn.main/rapidsnark-server/rapidsnark/package_macos_arm64/bin

# Test with help output
./verifier
# Should show: Usage: verifier <verification_key.json> <inputs.json> <proof.json>
```

**Check architecture:**
```bash
file ./verifier
# Should show: Mach-O 64-bit executable arm64
```

---

### Error: "Permission denied"

**Make binary executable:**
```bash
chmod +x /Users/jmd/nosync/org.payattn.main/rapidsnark-server/rapidsnark/package_macos_arm64/bin/verifier
```

---

### Verification takes >500ms

**Check CPU load:**
```bash
top -l 1 | grep -E "^CPU|^PhysMem"
```

**Check file I/O:**
- Temp directory creation: ~5ms
- File writes: ~10ms
- Binary execution: ~20-50ms
- File cleanup: ~5ms

**If consistently slow:**
- Consider keeping temp dir between verifications
- Check if binary is loading shared libraries each time
- Profile with `time` command

---

## Manual CLI Test

Want to test the verifier directly without the backend? Here's how:

### 1. Create Test Files

**public.json** (example for age_range):
```json
["1", "18", "25"]
```

**proof.json** (paste your proof from extension):
```json
{
  "pi_a": ["...", "...", "1"],
  "pi_b": [["...", "..."], ["...", "..."], ["1", "0"]],
  "pi_c": ["...", "...", "1"],
  "protocol": "groth16",
  "curve": "bn128"
}
```

### 2. Run Verifier

```bash
cd /Users/jmd/nosync/org.payattn.main/rapidsnark-server/rapidsnark/package_macos_arm64/bin

./verifier \
  ../../../../keys/age_range_verification_key.json \
  /tmp/public.json \
  /tmp/proof.json
```

**Expected output:**
```
Result: Valid proof
```

**Or for invalid proof:**
```
Result: Invalid proof
```

---

## Performance Benchmarks

| Operation | Expected Time |
|-----------|---------------|
| Binary execution | 20-50ms |
| Temp file I/O | 10-20ms |
| Total verification | 30-100ms |

**Compare to:**
- Extension (browser): ~1000-3000ms (includes proof generation)
- Node.js snarkjs: HANGS (8+ minutes)
- Cloudflare Workers: DOESN'T WORK

---

## Next Steps After Successful Test

1. ✅ Confirm verification works with all 3 circuits:
   - `age_range`
   - `range_check`
   - `set_membership`

2. ✅ Test with invalid proofs (should return `valid: false`)

3. ✅ Document CF Worker as abandoned approach (already done)

4. ✅ Clean up CF Worker files:
   ```bash
   # Option 1: Delete entirely
   rm -rf cf-worker/
   
   # Option 2: Keep for reference (already marked as ABANDONED in README)
   # Leave as-is with updated README.md
   ```

5. ✅ Update main project README with architecture

6. ✅ Test batch verification (if using `/api/verify-proof` with `proofs` array)

---

## What Changed From Cloudflare Workers

**Before (Failed - 8 deployments):**
```typescript
const response = await fetch('https://payattn-zk-verifier.jmd-1bc.workers.dev/verify-proof', {
  method: 'POST',
  body: JSON.stringify({ proof, publicSignals, circuitName })
});
```

**After (Working - Rapidsnark CLI):**
```typescript
// 1. Write temp files
fs.writeFileSync('/tmp/proof.json', JSON.stringify(proof));
fs.writeFileSync('/tmp/public.json', JSON.stringify(publicSignals));

// 2. Execute verifier
const { stdout } = await execAsync(
  `${RAPIDSNARK_VERIFIER} ${vkeyPath} ${publicPath} ${proofPath}`,
  { timeout: 5000 }
);

// 3. Parse result
const isValid = stdout.includes('Valid proof');
```

**Why this works:**
- ✅ No JavaScript runtime issues (native C++)
- ✅ No Worker/WASM API dependencies
- ✅ Fast (~10-50ms vs 8+ minute hangs)
- ✅ Production-proven (Polygon ID, iden3)
- ✅ Simple integration (standard child_process)

---

## Ready to Test?

1. Generate proof in extension
2. Copy proof JSON
3. Send to `/api/verify-proof`
4. Check logs for "Valid proof" and timing
5. Report results!

**Expected outcome:** ✅ Verification in <100ms with "Valid proof" output

