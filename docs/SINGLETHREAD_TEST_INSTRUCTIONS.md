# Testing snarkjs with singleThread Option

## What Changed

We discovered the **official snarkjs API** for environments without Web Workers:

```javascript
const { proof, publicSignals } = await snarkjs.groth16.prove(
  zKeyBuffer,
  witnessData,
  undefined,
  { singleThread: true }  // ← This is the key!
);
```

Source: https://github.com/iden3/snarkjs#common-issues

## Files Modified

1. **extension/lib/zk-prover.js** - Now uses `{singleThread: true}` option
2. **extension/age-proof-test.html** - Removed `snarkjs-config.js` script
3. **extension/lib/snarkjs-config.js** - Deleted (no longer needed)

## Testing Steps

1. **Load the extension** in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `agent-dashboard/extension/` folder

2. **Open test page**:
   - Right-click extension icon → "Inspect popup"
   - Or navigate to: `chrome-extension://<your-extension-id>/age-proof-test.html`

3. **Generate a proof**:
   - Load a profile (should have age data)
   - Configure: minimum age 21, maximum age 65
   - Click **Generate Proof** button
   - Watch the debug console

## Expected Outcome

✅ **SUCCESS** - You should see:
```
[Extension ZK] Generating Groth16 proof...
[Extension ZK] Proof generated successfully
[Extension ZK] Public signals: ["1"]
```

❌ **FAILURE** - If you still see:
```
Error: Invalid FastFile type: undefined
```

Then we need to move proof generation to the service worker (background.js).

## Next Steps Based on Results

### If it works ✅
- Great! Proof generation works in extension pages
- We can proceed with WP02.3b testing
- The service worker can also use the same approach

### If it fails ❌
- Move proof generation logic to `background.js` service worker
- Service workers have different CSP context and might allow workers
- Use chrome.runtime.sendMessage() to communicate between pages and service worker

## Background Context

We spent ~15 iterations trying different approaches:
1. ❌ snarkjs.groth16.fullProve() - requires workers
2. ❌ Manual WASM loading with eval() - blocked by CSP  
3. ❌ Passing zkey as Uint8Array - FastFile error
4. ❌ Passing zkey as URL string - FastFile error
5. ❌ Passing zkey as {type: 'mem'} object - FastFile error
6. ✅ **Using official `{singleThread: true}` option** ← We are here

The official snarkjs documentation had the answer all along!
