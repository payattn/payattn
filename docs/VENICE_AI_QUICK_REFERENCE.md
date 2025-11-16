# Venice AI Quick Reference

## Quick Start (5 minutes)

```bash
# 1. Get your API key from Venice AI
https://docs.venice.ai/overview/getting-started

# 2. Load extension
chrome://extensions  Load unpacked  select extension/ folder

# 3. Configure API key
Click extension  Ad Management  settings.html  Save key

# 4. Test it
Navigate to venice-test.html in the extension
```

##  Function Cheat Sheet

### Setup API Key
```javascript
// Save key (user does this in settings.html)
await window.VeniceAI.setVeniceAPIKey('sk_...');

// Check if configured
const hasKey = await window.VeniceAI.hasVeniceAPIKey();

// Clear key
await window.VeniceAI.clearVeniceAPIKey();
```

### Send Messages
```javascript
// Simple message
const response = await window.VeniceAI.sendMessage(
  'Your question here',
  'Optional system prompt'
);

// Full control
const response = await window.VeniceAI.callVeniceAI(
  [
    { role: 'system', content: 'You are helpful' },
    { role: 'user', content: 'Hello' }
  ],
  'venice-uncensored',  // model
  0.7,                  // temperature
  512                   // max tokens
);
```

### Match Ads to Users
```javascript
const result = await window.VeniceAI.analyzeAdMatch(
  {
    content: 'Ad text here',
    targeting: {
      ageRange: [45, 50],
      interests: ['privacy', 'security'],
      incomeRange: '$75,000+'
    }
  },
  {
    demographics: { age: 46, gender: 'M' },
    interests: ['technology', 'privacy'],
    financial: { incomeRange: '$100,000 - $150,000' }
  }
);

// Returns:
// {
//   success: true,
//   matches: true/false,
//   matchScore: 0-100,
//   reasoning: "explanation",
//   matchedCriteria: [...],
//   unmatchedCriteria: [...]
// }
```

### Analyze Ads
```javascript
const result = await window.VeniceAI.processAd(
  'Get 50% off today! Limited time offer. Click now!'
);

// Returns: main message, target audience, CTA, estimated targeting
```

## Response Format

```javascript
{
  success: true,
  model: 'venice-uncensored',
  content: 'The AI response text',
  usage: {
    prompt_tokens: 42,
    completion_tokens: 18,
    total_tokens: 60
  }
}

// Or on error:
{
  success: false,
  error: 'Error message',
  details: 'More info',
  content: ''
}
```

## Debugging

```javascript
// Check console for logs
// Look for [Venice] prefix

// Manually test:
const result = await window.VeniceAI.sendMessage('test');
console.log(result);

// If error, check:
// 1. API key configured? hasVeniceAPIKey()
// 2. Internet connection?
// 3. API key format? Should start with sk_
// 4. Venice API down? Try https://api.venice.ai/api/v1/models
```

## File Locations

- **Settings:** `settings.html` - Configure API key
- **Test UI:** `venice-test.html` - Test functionality
- **Utils:** `venice-ai.js` - Main code
- **Manifest:** `manifest.json` - Permissions
- **Docs:** `VENICE_AI_DIRECT_SETUP.md` - Full guide

## Where Your Data Goes

```
API Key:        chrome.storage.local (never leaves device)
User Profile:   IndexedDB (never leaves device)
Ad Data:         Venice AI (only when you call analyzeAdMatch)
Results:        IndexedDB (stored locally)
PayAttn:         Never sees any of this data
```

##  Common Issues

| Issue | Solution |
|-------|----------|
| "API key not configured" | Go to settings.html, paste key, click Save |
| "Network error" | Check internet, verify API key format (sk_...) |
| "Unauthorized" | Double-check API key, copy from Venice AI dashboard again |
| Can't find settings.html | Copy extension ID from chrome://extensions, use `chrome-extension://ID/settings.html` |
| Test page won't load | Same as above - use full chrome-extension:// URL |

## Integration Example

```javascript
// In your background.js or wherever you process ads:

async function analyzeIncomingAd(adContent, userProfile) {
  try {
    // 1. Check if Venice is configured
    const hasKey = await window.VeniceAI.hasVeniceAPIKey();
    if (!hasKey) {
      console.log('Venice not configured, skipping analysis');
      return null;
    }

    // 2. Analyze the match
    const result = await window.VeniceAI.analyzeAdMatch(
      {
        content: adContent.text,
        targeting: adContent.targetingInfo
      },
      userProfile
    );

    // 3. Return result
    return result;

  } catch (error) {
    console.error('Analysis failed:', error);
    return null;
  }
}

// Usage:
const result = await analyzeIncomingAd(ad, profile);
if (result?.success && result?.matches) {
  console.log(`Match score: ${result.matchScore}%`);
}
```

##  System Prompt Ideas

```javascript
// Privacy expert
"You are a privacy expert. Analyze this ad and identify any privacy risks or data collection concerns."

// Marketing analyst
"You are a marketing analyst. Determine if this ad's messaging aligns with the target audience based on their profile."

// Copywriter
"You are a copywriter. Rewrite this ad to be more compelling for a privacy-conscious audience."

// Data scientist
"You are a data scientist. Based on the user profile and ad targeting, calculate a match probability (0-100)."
```

## Resources

- [Venice AI Docs](https://docs.venice.ai)
- [Chrome Extension API](https://developer.chrome.com/docs/extensions/)
- [Full Setup Guide](./VENICE_AI_DIRECT_SETUP.md)
- [Integration Summary](./VENICE_AI_INTEGRATION_SUMMARY.md)

---

**Key Point:** Your API key and user data never leave your device. Only Venice AI sees the data you send for processing. PayAttn's servers have zero visibility.
