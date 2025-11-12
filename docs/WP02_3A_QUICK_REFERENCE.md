# WP02.3a Quick Reference Card

## Get Started in 2 Minutes

### 1. Open the Test Page
```
DevTools → Right-click extension → "Inspect"
Navigate to: age-proof-test.html
```

### 2. Watch It Work
```
✅ Profile auto-loads
✅ Your age displays
✅ Click "Generate Age Proof"
✅ Click "Send to Backend & Verify"
✅ See ✅ Valid result
```

### 3. Check the Console
```
📋 Debug Console on page shows everything
🔍 Look for ✅ symbols = success
❌ Look for ❌ symbols = problem
```

---

## Test Checklist

| Task | Expected Result | Where to Check |
|------|-----------------|-----------------|
| Open page | Profile loads automatically | Page shows profile data |
| See age extracted | Age displays (e.g., 35) | Profile card section |
| Generate proof | Proof JSON appears | Proof details section |
| Check privacy | Age ≠ in public signals | Show [25, 65] not [35] |
| Verify proof | ✅ Valid appears | Green verification box |
| Check console | All green ✅ messages | Debug console |

---

## Privacy Validation Checklist

```
User sees:
[DEBUG CONSOLE]
⚡ PROOF GENERATION STARTED
📊 Configuration:
  • User age (PRIVATE): 35      ← AGE SHOWS HERE ONLY
  • Advertiser wants: age 25-65 ← CRITERIA (PUBLIC)
  • Match: ✅ YES

📋 Proof details:
  • Public Signals: [25, 65]    ← NOT 35
  • Proof: {...}                ← NOT 35

[VERIFICATION]
✅ Valid: YES                    ← VERIFIED WITHOUT SHOWING 35
```

**✅ Privacy Validated:** Actual age never leaves extension or appears in proof

---

## If Something Fails

| Error | Solution |
|-------|----------|
| "Missing credentials" | Authenticate: popup.html → Setup Extension |
| "No profile found" | Create: popup.html → Manage Profile |
| "Failed to decrypt" | Recreate: popup.html → Manage Profile |
| "Cannot connect backend" | Check: `npm run dev` in agent-dashboard/ |
| "Proof generation failed" | Check: DevTools console (F12) for WASM errors |

---

## What Gets Tested

✅ **Profile loading** - Decryption works, age extracted
✅ **Proof generation** - Extension generates proof correctly
✅ **Privacy** - Age never appears outside extension
✅ **Backend** - Accepts and verifies proof
✅ **Integration** - Full flow works end-to-end

---

## 🎓 Architecture in 30 Seconds

```
Your Phone (Extension)
├─ Your age: 35 (PRIVATE) ← STAYS HERE
├─ Generate proof
└─ Send proof only

Advertiser Server
├─ Receives proof (not age)
├─ Verifies proof ✅
└─ Confirms: "age 25-65" (never sees 35)
```

**Privacy guarantee:** Advertiser verifies you match criteria without knowing actual age

---

## Key Files

| File | Purpose |
|------|---------|
| `age-proof-test.html` | Test UI |
| `age-proof-test.js` | Test logic |
| `lib/zk-prover.js` | Proof generation |
| `app/api/verify-proof/route.ts` | Backend verification |

---

## Success = All Green

When you see:
- Profile loads
- Proof generates  
- Backend verifies
- Console all green
- Privacy intact

→ **WP02.3a is ready** → Move to WP02.3b

---

## Notes

- Test page is **temporary** - will integrate into popup later
- Debug console is **intentionally verbose** - easier to debug
- Full proof JSON is shown - you can inspect it
- Multiple test runs - no cleanup needed
- Each run is independent - can test different scenarios

---

**Need help?** See `WP02_3A_TEST_GUIDE.md` for complete guide
