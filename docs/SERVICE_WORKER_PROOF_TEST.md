# Service Worker Proof Generation Test Instructions

## Architecture Overview

We've implemented a **messaging-based architecture** where:
- Background service worker (`background.js`) requests proof generation
- Helper page (`age-proof-test.html`) actually generates proofs (has snarkjs loaded)
- Results are sent back to service worker via chrome.runtime.sendMessage()

This works around the Manifest V3 limitation that service workers can't load large UMD libraries like snarkjs directly.

## Test Steps

### 1. Reload Extension
```
1. Navigate to chrome://extensions/
2. Find "PayAttn" extension
3. Click the reload button
4. Check for any errors in the service worker console
```

### 2. Open Helper Page
```
1. Right-click the PayAttn extension icon
2. Click "age-proof-test.html" to open the test page
3. The page will register itself as a proof helper
4. Console should show: "Message listener registered - ready to handle proof requests"
```

### 3. Test from Service Worker Console
```
1. Go to chrome://extensions/
2. Click "service worker" link under PayAttn extension
3. In the console, run this command:

const testProof = async () => {
  try {
    const proof = await generateProofViaHelper('age_range', 
      { age: 30 }, 
      { minAge: 21, maxAge: 65 }
    );
    console.log('✅ Proof generated successfully:', proof);
  } catch (error) {
    console.error('❌ Proof generation failed:', error.message);
  }
};
testProof();
```

### 4. Observe the Flow
Watch for messages in both consoles:

**Service Worker Console:**
```
[Extension] Requesting proof generation for: ageCheck
[Extension] Received proof generation response: Success
```

**Helper Page Console:**
```
[Helper Page] Received proof generation request from service worker
[Extension ZK] Generating proof...
[Extension ZK] Proof generated successfully
[Helper Page] Proof generated successfully
```

## Expected Success Outcome

✅ **If it works:**
- Service worker sends message to helper page
- Helper page generates proof using snarkjs
- Proof is returned to service worker
- Service worker receives complete proof package
- Console shows successful proof generation

## Expected Failure Scenarios

❌ **Scenario 1: No helper page open**
```
Error: "Proof helper page not available. Open age-proof-test.html first."
```
**Solution:** Open age-proof-test.html before requesting proof

❌ **Scenario 2: snarkjs still fails with FastFile error**
```
Error: "[object Object]: Invalid File format"
```
**Solution:** This means the underlying snarkjs issue persists. But at least the messaging infrastructure works! We can:
- Try different ways to pass data to snarkjs
- Or use offscreen documents API
- Or generate proofs in a web worker

❌ **Scenario 3: Timeout after 60 seconds**
```
Error: "Proof generation timed out after 60 seconds"
```
**Solution:** Proof generation is taking too long or helper page isn't responding

## Next Steps Based on Results

### If Messaging Works But Proof Generation Fails
- The architecture is solid
- Need to debug the snarkjs FastFile issue specifically
- Could try converting snarkjs to ES module
- Could try using offscreen documents

### If Messaging Works AND Proof Generation Succeeds
- 🎉 **SUCCESS!** Proof generation working end-to-end
- Uncomment the proof generation code in `processProfile()` 
- Test autonomous 30-minute cycle with proof generation
- Proceed to WP02.3b end-to-end testing

### If Messaging Fails
- Check Chrome extension permissions
- Verify message listener is registered
- Check for CSP issues

## Background Context

We tried 15+ iterations to get snarkjs working directly in extension pages with various parameter formats. All failed with "Invalid FastFile type" errors. The `{singleThread: true}` option was documented for browser extensions but still didn't work.

This service worker messaging approach:
1. ✅ Avoids CSP restrictions on service workers
2. ✅ Allows helper pages to load snarkjs normally
3. ✅ Enables autonomous background proof generation
4. ✅ Matches the actual production architecture (30-minute cycle)

Even if snarkjs still fails, we'll know the messaging infrastructure works and can explore other solutions.
