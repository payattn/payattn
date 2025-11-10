# Universal Assessment Architecture - Fixed

## Problem Summary

### Issue 1: `window is not defined` in Service Worker
- `max-assessor.js` was hardcoded to use `window.VeniceAI`
- Service workers don't have `window` object → ReferenceError
- Background.js couldn't assess ads automatically

### Issue 2: Non-Universal Architecture
- Different code paths for manual (UI) vs automated (background) triggers
- Risk of behavior divergence during development
- Mental model mismatch: should be ONE way to assess ads

## Solution: True Universal Module

### Architecture Principle
**ONE assessment flow used by BOTH contexts:**
- Manual trigger (ad-queue.html) → calls `window.MaxAssessor.assessAds()`
- Automated trigger (background.js) → calls `self.MaxAssessor.assessAds()`
- **Same function, same logic, same behavior**

### Changes Made

#### 1. `/extension/venice-ai.js` - Universal Export
**Before:**
```javascript
// Only exported to window
if (typeof window !== 'undefined') {
  window.VeniceAI = {...};
}
```

**After:**
```javascript
// Create VeniceAI object once
const VeniceAI = {...};

// Export to window in browser context
if (typeof window !== 'undefined') {
  window.VeniceAI = VeniceAI;
}

// Export to self in service worker context
if (typeof self !== 'undefined') {
  self.VeniceAI = VeniceAI;
}
```

**Result:** VeniceAI works in both contexts

#### 2. `/extension/background.js` - Import Venice AI
**Before:**
```javascript
importScripts('lib/snarkjs-patched.js');
importScripts('lib/max-assessor.js');
// No venice-ai.js!
```

**After:**
```javascript
importScripts('lib/snarkjs-patched.js');
importScripts('venice-ai.js');              // ← Added
importScripts('lib/max-assessor.js');

console.log('[Extension] VeniceAI loaded:', typeof self.VeniceAI !== 'undefined' ? 'SUCCESS' : 'FAILED');
```

**Result:** Service worker has access to VeniceAI functions

#### 3. `/extension/lib/max-assessor.js` - Context-Agnostic
**Before:**
```javascript
async function assessAds(ads, userProfile, options = {}) {
  // Hardcoded to window.VeniceAI
  if (typeof window !== 'undefined' && window.VeniceAI) {
    const hasApiKey = await window.VeniceAI.hasVeniceAPIKey();
    // ...
  }
  
  // Later in assessSingleAd:
  const tools = window.VeniceAI.getVeniceTools();
  const response = await window.VeniceAI.callVeniceAI(...);
}
```

**After:**
```javascript
async function assessAds(ads, userProfile, options = {}) {
  // Get VeniceAI from correct context
  const VeniceAI = typeof window !== 'undefined' ? window.VeniceAI : self.VeniceAI;
  
  if (!VeniceAI) {
    throw new Error('VeniceAI not loaded - check script imports');
  }
  
  const hasApiKey = await VeniceAI.hasVeniceAPIKey();
  // ...
  
  // Pass VeniceAI to assessSingleAd
  const assessment = await assessSingleAd(ad, userProfile, {
    veniceModel,
    temperature,
    autoSubmit,
    VeniceAI  // ← Passed as dependency
  });
}

async function assessSingleAd(campaign, userProfile, options = {}) {
  const { veniceModel, temperature, autoSubmit, VeniceAI } = options;
  
  if (!VeniceAI) {
    throw new Error('VeniceAI instance required in options');
  }
  
  // Use passed VeniceAI (not global)
  const tools = VeniceAI.getVeniceTools();
  const response = await VeniceAI.callVeniceAI(...);
  const result = VeniceAI.processToolCall(...);
}
```

**Result:** No hardcoded globals, works in any context

## How It Works Now

### Universal Flow (Both Contexts)
1. **Import Order:**
   ```javascript
   // Both ad-queue.html and background.js:
   import venice-ai.js     → VeniceAI available
   import max-assessor.js  → MaxAssessor available
   ```

2. **Call Pattern:**
   ```javascript
   // Both contexts use same function:
   const session = await MaxAssessor.assessAds(ads, userProfile, options);
   ```

3. **Context Detection:**
   ```javascript
   // max-assessor.js automatically detects context:
   const VeniceAI = typeof window !== 'undefined' 
     ? window.VeniceAI   // Browser
     : self.VeniceAI;    // Service Worker
   ```

4. **Dependency Injection:**
   ```javascript
   // VeniceAI passed to assessSingleAd (not accessed as global)
   assessSingleAd(ad, profile, { VeniceAI, ... });
   ```

### Manual Trigger (ad-queue.html)
```
User clicks button
  ↓
ad-queue.js calls window.MaxAssessor.assessAds()
  ↓
max-assessor.js gets window.VeniceAI
  ↓
Assesses ads using Venice AI
  ↓
Returns session with results
```

### Automated Trigger (background.js)
```
Chrome Alarm fires (every 30 min)
  ↓
background.js calls self.MaxAssessor.assessAds()
  ↓
max-assessor.js gets self.VeniceAI
  ↓
Assesses ads using Venice AI (same logic!)
  ↓
Returns session with results
```

## Benefits of This Architecture

### 1. **Single Source of Truth**
- ✅ ONE assessment function (`assessAds`)
- ✅ ONE decision logic (Max's prompt)
- ✅ ONE Venice AI integration
- ✅ Change once, applies everywhere

### 2. **Context Agnostic**
- ✅ Works in browser (window)
- ✅ Works in service worker (self)
- ✅ No context-specific branches
- ✅ No duplicate code

### 3. **Dependency Injection**
- ✅ VeniceAI passed as parameter (not global)
- ✅ Easy to test (can mock VeniceAI)
- ✅ Clear dependencies
- ✅ No hidden coupling

### 4. **Maintainability**
- ✅ Update Max's logic in ONE place
- ✅ Update Venice AI calls in ONE place
- ✅ Bug fixes apply to both triggers
- ✅ No behavior divergence risk

## Testing Checklist

### Manual Trigger (UI)
- [ ] Open ad-queue.html
- [ ] Click "Fetch & Assess New Ads"
- [ ] Console shows: `[Extension] VeniceAI loaded: SUCCESS`
- [ ] Console shows: `[Max Assessor] Assessing 12 ads...`
- [ ] No `window is not defined` errors
- [ ] Max assesses each ad sequentially
- [ ] Offers submitted to backend

### Automated Trigger (Background Worker)
- [ ] Extension reloads (or waits 30 min)
- [ ] Console shows: `[Extension] VeniceAI loaded: SUCCESS`
- [ ] Console shows: `[AdSync] Received X new ads`
- [ ] Console shows: `[Max] Evaluating ad queue...`
- [ ] No `window is not defined` errors
- [ ] Same assessment behavior as manual
- [ ] Offers submitted to backend

### Consistency Check
- [ ] Manual and automated produce same decisions for same ads
- [ ] Same Venice AI model used (`qwen3-next-80b`)
- [ ] Same temperature (0.7)
- [ ] Same offer prices for equivalent scenarios

## Files Modified

1. `/extension/venice-ai.js` - Export to both window and self
2. `/extension/background.js` - Import venice-ai.js
3. `/extension/lib/max-assessor.js` - Context-agnostic VeniceAI access

## Mental Model Confirmation

**Your requirement:**
> "have a universal script that does it and that same script is called from the background worker and from the extension. that way during testing can change it in one place and both triggers will work"

**Implementation:**
✅ Universal script: `/extension/lib/max-assessor.js`
✅ Called by background.js: `self.MaxAssessor.assessAds()`
✅ Called by ad-queue.js: `window.MaxAssessor.assessAds()`
✅ ONE place to change: Update `max-assessor.js`
✅ Both triggers use identical logic
✅ Zero code duplication

**Result:** Architecture matches your mental model exactly! 🎯
