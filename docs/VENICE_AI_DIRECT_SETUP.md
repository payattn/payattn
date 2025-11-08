# Venice AI Integration Guide (Direct Extension Calls)

This guide explains how to set up Venice AI for processing ads directly from the extension, keeping all user data local and secure.

## Architecture

**Privacy-First Design:**
```
Your Device (User Profile) → Extension (LLM Processing) → Venice AI
                 ↓
         PayAttn Servers: Zero access to your data or API key
```

- ✅ API key stored **only in your browser** (chrome.storage.local)
- ✅ User profiles stay **local on your device**
- ✅ Only profile + ad data sent to **privacy-respecting Venice AI**
- ✅ PayAttn servers never see sensitive data
- ✅ No backend dependency

## Setup

### 1. Get a Venice AI API Key

1. Visit: https://docs.venice.ai/overview/getting-started
2. Sign up for an account
3. Create an API key
4. Copy the key (format: `sk_...`)

### 2. Load the Extension

1. Open `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select the `agent-dashboard/extension` folder

### 3. Configure Your API Key

1. Click the PayAttn extension icon in Chrome
2. You'll see the popup - click "🎯 Ad Management"
3. In the new tab, navigate to: `chrome-extension://YOUR_EXTENSION_ID/settings.html`
   - To find your extension ID: right-click the extension icon → "Manage extension"
4. Paste your Venice AI API key
5. Click "💾 Save API Key"
6. Click "🧪 Test Connection" to verify it works

### 4. Start Testing

1. Go to: `chrome-extension://YOUR_EXTENSION_ID/venice-test.html`
2. Try the "Simple Chat" tab first
3. Use templates or write your own prompts
4. Switch to "Ad Matching" tab to test user/ad matching

## How It Works

### Simple Message Processing

```javascript
// From your extension code
const response = await window.VeniceAI.sendMessage(
  'Analyze this ad: Get 50% off today!',
  'You are an ad analysis expert.'
);
console.log(response.content); // AI response
```

### Ad Matching with User Profile

The extension can now match users to ads using their full profile:

```javascript
const userProfile = {
  demographics: { age: 46, gender: 'M' },
  interests: ['technology', 'privacy'],
  financial: { incomeRange: '$100,000 - $150,000' }
};

const adData = {
  content: 'Secure your privacy with our VPN',
  targeting: {
    ageRange: [45, 50],
    interests: ['privacy', 'security'],
    incomeRange: '$75,000+'
  }
};

const result = await window.VeniceAI.analyzeAdMatch(adData, userProfile);
console.log(result.matches);     // true/false
console.log(result.matchScore);  // 0-100
console.log(result.reasoning);   // explanation
```

## API Reference

### Storage Functions

#### `setVeniceAPIKey(apiKey)`
Save Venice API key to secure local storage.
```javascript
const success = await window.VeniceAI.setVeniceAPIKey('sk_...');
```

#### `getVeniceAPIKey()`
Retrieve the API key from storage (only available to extension).
```javascript
const apiKey = await window.VeniceAI.getVeniceAPIKey();
```

#### `hasVeniceAPIKey()`
Check if API key is configured.
```javascript
const configured = await window.VeniceAI.hasVeniceAPIKey();
```

#### `clearVeniceAPIKey()`
Delete the API key (for logout/reset).
```javascript
await window.VeniceAI.clearVeniceAPIKey();
```

### Processing Functions

#### `callVeniceAI(messages, model, temperature, maxTokens)`
Direct call to Venice AI with full message history.
```javascript
const response = await window.VeniceAI.callVeniceAI(
  [
    { role: 'system', content: 'You are helpful' },
    { role: 'user', content: 'Hello!' }
  ],
  'venice-uncensored',
  0.7,
  512
);

if (response.success) {
  console.log(response.content);      // AI response
  console.log(response.usage);        // token usage
} else {
  console.log(response.error);        // error message
}
```

#### `sendMessage(userMessage, systemPrompt)`
Simple wrapper for a single message.
```javascript
const response = await window.VeniceAI.sendMessage(
  'Why is privacy important?',
  'You are a privacy expert.'
);
```

#### `processAd(adContent)`
Analyze ad content for targeting info.
```javascript
const response = await window.VeniceAI.processAd(
  'Get 50% off premium today! Limited time.'
);
// Returns: main message, target audience, CTA, estimated targeting
```

#### `analyzeAdMatch(adData, userProfile)`
Determine if user matches ad targeting criteria.
```javascript
const result = await window.VeniceAI.analyzeAdMatch(
  {
    content: '...',
    targeting: { ageRange: [45, 50], interests: ['tech'] }
  },
  {
    demographics: { age: 46 },
    interests: ['technology']
  }
);

// Returns:
// {
//   matches: true,
//   matchScore: 92,
//   reasoning: "User is within age range and shares interests",
//   matchedCriteria: ["age", "interests"],
//   unmatchedCriteria: []
// }
```

#### `generatePreferencesFromProfile(profileData)`
Generate ad preferences based on user profile.
```javascript
const response = await window.VeniceAI.generatePreferencesFromProfile({
  demographics: { age: 30 },
  interests: ['tech', 'privacy']
});
```

## File Locations

- **Settings Page:** `extension/settings.html`
- **Test UI:** `extension/venice-test.html`
- **Utility Functions:** `extension/venice-ai.js`
- **Extension Manifest:** `extension/manifest.json`

## Security

### API Key Protection
- ✅ Stored in `chrome.storage.local` (browser sandbox)
- ✅ Never transmitted to PayAttn servers
- ✅ Only accessible by extension
- ✅ Deleted when extension is uninstalled

### Data Privacy
- ✅ All user profiles stay on local device
- ✅ Only sent to Venice AI for processing
- ✅ Venice AI doesn't log requests (privacy-first service)
- ✅ PayAttn never sees sensitive data

### Message Format
When calling Venice AI, messages are sent directly:
```
Extension → Venice AI API (https://api.venice.ai/api/v1/chat/completions)
         ↓
    Authorization: Bearer <YOUR_API_KEY>
    Content-Type: application/json
    {
      "model": "venice-uncensored",
      "messages": [...],
      "temperature": 0.7,
      "max_tokens": 512
    }
```

## Common Questions

### Q: Can PayAttn see my API key?
**A:** No. Your API key is stored exclusively in Chrome's local storage on your device. PayAttn servers never have access to it.

### Q: Can PayAttn see my user profile?
**A:** No. User profiles are stored locally in IndexedDB on your device and are never transmitted to PayAttn servers. Only you, through the extension, control what data is sent where.

### Q: What data goes to Venice AI?
**A:** Only the data you explicitly send for processing. When you run ad matching, both the user profile and ad data go to Venice AI for analysis. Nothing else is transmitted.

### Q: Is Venice AI safe?
**A:** Venice AI is a privacy-respecting LLM provider. They don't log requests and run uncensored models. See: https://docs.venice.ai

### Q: What if I uninstall the extension?
**A:** All data is automatically deleted:
- API key removed from chrome.storage
- User profiles removed from IndexedDB
- No traces remain on your device

### Q: Can I use this on production websites?
**A:** Yes, once you set your API key. The extension only processes data through Venice AI - no backend involved.

## Troubleshooting

### "Venice API key not configured"
- Go to `settings.html`
- Paste your API key
- Click "Save API Key"
- Try "Test Connection" to verify

### "Network error" or "Connection failed"
- Check your internet connection
- Verify your API key is correct (starts with `sk_`)
- Check if Venice AI API is accessible: https://api.venice.ai/api/v1/models
- Check browser console for detailed error messages

### "Invalid API key"
- Copy your key again from Venice AI dashboard
- Make sure there are no extra spaces
- Verify your Venice account has active credits

### Test page won't load
- Get your extension ID from `chrome://extensions/`
- Use correct URL: `chrome-extension://EXTENSION_ID/venice-test.html`
- Make sure extension is loaded and enabled

### Still having issues?
- Check browser console: Right-click → Inspect → Console tab
- Look for `[Venice]` log messages
- Test with simple messages first before complex operations

## Next Steps

1. **Create system prompts** for specific use cases
   - Ad analysis prompts
   - User interest detection prompts
   - Privacy scoring prompts

2. **Wire up the background script** to process ads
   - Fetch ads from storage
   - Run through Venice AI
   - Store results locally

3. **Build the matching logic**
   - Store user profiles
   - Match incoming ads
   - Calculate match scores
   - Show results in UI

4. **Optimize for performance**
   - Batch similar requests
   - Cache common prompts
   - Rate limiting for free tier

## Resources

- [Venice AI Documentation](https://docs.venice.ai/overview/getting-started)
- [OpenAI Compatibility](https://docs.venice.ai/guides/openai-compatibility)
- [Chrome Extension API Docs](https://developer.chrome.com/docs/extensions/)
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage/)
- [Privacy-First Architecture](./PRIVACY.md)

## Support

For issues with:
- **Venice AI API:** https://docs.venice.ai
- **Chrome Extension Development:** https://developer.chrome.com
- **PayAttn Extension:** Check the extension console logs
