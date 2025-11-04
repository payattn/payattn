# Venice AI Integration Guide

This guide explains how to set up and test the Venice AI (OpenAI-compatible) LLM endpoint integration for processing ads in the PayAttn extension.

## Overview

The integration consists of:
- **Backend API Route** (`/api/ai/complete`) - Securely calls Venice AI using your API key
- **Extension Utility** (`venice-ai.js`) - Simple interface for the extension to call the backend
- **Test UI** (`venice-test.html`) - Interactive test page to verify everything works

```
Extension UI/Background → Backend API Route → Venice AI API
```

## Setup

### 1. Get a Venice AI API Key

1. Visit: https://docs.venice.ai/overview/getting-started
2. Sign up for an account
3. Create an API key
4. Copy the key

### 2. Configure Environment Variable

Add your Venice AI API key to your `.env.local` file in the `agent-dashboard` directory:

```bash
# agent-dashboard/.env.local
VENICE_API_KEY=your_actual_api_key_here
```

**Important:** Never commit `.env.local` to version control. It's already in `.gitignore`.

### 3. Start the Development Server

```bash
cd agent-dashboard
npm run dev
```

The server will start at `http://localhost:3000`

## Testing

### Option A: Test UI (Easiest)

1. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `agent-dashboard/extension` folder

2. Click the extension icon and open the popup

3. Click "🎯 Ad Management" button (opens ad-queue.html)

4. In a new tab, navigate to:
   ```
   chrome-extension://YOUR_EXTENSION_ID/venice-test.html
   ```

5. Fill in a message and click "Send Message"

### Option B: Direct API Call

Test the backend endpoint directly:

```bash
curl http://localhost:3000/api/ai/complete \
  -H "Content-Type: application/json" \
  -d '{
    "model": "venice-uncensored",
    "messages": [
      {"role": "system", "content": "You are a helpful AI assistant"},
      {"role": "user", "content": "Why is privacy important?"}
    ]
  }'
```

### Option C: Extension Popup

From the extension's service worker or any extension script:

```javascript
// Get reference to Venice AI functions
const { sendMessage } = window.VeniceAI;

// Call with a message
const response = await sendMessage('Why is privacy important?');
console.log(response.content);
```

## API Reference

### Backend Endpoint: POST /api/ai/complete

**Request:**
```json
{
  "model": "venice-uncensored",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant"},
    {"role": "user", "content": "Hello!"}
  ],
  "temperature": 0.7,
  "max_tokens": 512
}
```

**Response (Success):**
```json
{
  "success": true,
  "model": "venice-uncensored",
  "content": "Hello! How can I help you?",
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 10,
    "total_tokens": 25
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "model": "venice-uncensored",
  "content": "",
  "error": "Venice API error: Unauthorized",
  "details": "Invalid API key"
}
```

### Extension Utility Functions

#### `sendMessage(userMessage, systemPrompt)`

Simple helper for a single user message:

```javascript
const response = await window.VeniceAI.sendMessage(
  'What are the benefits of VPNs?',
  'You are a privacy expert.'
);
console.log(response.content);
```

#### `callVeniceAI(messages, model, temperature, maxTokens)`

Lower-level function for full control:

```javascript
const response = await window.VeniceAI.callVeniceAI(
  [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'Hello!' },
    { role: 'assistant', content: 'Hi there!' },
    { role: 'user', content: 'How are you?' }
  ],
  'venice-uncensored',
  0.7,
  256
);
```

#### `processAd(adContent)`

Analyze ad content:

```javascript
const response = await window.VeniceAI.processAd(
  'Get 50% off today! Limited time offer. Click here now!'
);
console.log(response.content); // Returns analysis
```

#### `generatePreferencesFromProfile(profileData)`

Generate ad preferences from user profile:

```javascript
const response = await window.VeniceAI.generatePreferencesFromProfile({
  demographics: { age: 30, gender: 'M' },
  interests: ['technology', 'privacy']
});
console.log(response.content);
```

## File Locations

- **Backend Route:** `app/api/ai/complete/route.ts`
- **Extension Utility:** `extension/venice-ai.js`
- **Test UI:** `extension/venice-test.html`
- **Manifest Update:** `extension/manifest.json` (includes Venice API permissions)

## Common Issues

### "Venice API key not configured"
- Check that `VENICE_API_KEY` is set in `.env.local`
- Restart the dev server after adding the key
- Verify the key is valid at https://docs.venice.ai

### "Network error" from Extension
- Ensure dev server is running on `http://localhost:3000`
- Check browser console for CORS issues
- Verify extension has permissions for `http://localhost:3000/*`

### "Unauthorized" from Venice
- Double-check your API key - copy it again from Venice dashboard
- Ensure there are no extra spaces or characters
- Check if your Venice account has active credits

### Extension can't access test page
- Get the extension ID from `chrome://extensions/`
- Use the correct format: `chrome-extension://EXTENSION_ID/venice-test.html`

## Next Steps

Once you have this working, you can:

1. **Wire up the JSON** - Format ad data to send to Venice AI
2. **Add system prompts** - Create domain-specific prompts for ad analysis
3. **Process ads in background** - Call Venice AI from the agent cycle
4. **Store results** - Save analyzed ads in IndexedDB
5. **Show in UI** - Render results in the extension popup or dashboard

## Troubleshooting

**Check Extension Logs:**
```javascript
// In extension background.js or popup
console.log('[Venice] Test message');
```

**Check Backend Logs:**
```bash
# Terminal where dev server is running
# Look for: [Venice API] Sending request to Venice AI
```

**Test with Debug UI:**
- Open `venice-test.html` in the extension
- Fill in a test message
- Watch the debug info panel at the bottom
- Check the timestamp of the request

## Documentation

- [Venice AI Docs](https://docs.venice.ai/overview/getting-started)
- [OpenAI Compatibility](https://docs.venice.ai/guides/openai-compatibility)
- [Chrome Extension API](https://developer.chrome.com/docs/extensions/)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

## Security Notes

- ✅ API key stored on backend server only
- ✅ Extension calls backend endpoint (no direct Venice calls)
- ✅ Messages not logged to disk
- ✅ Consider rate limiting for production
- ⚠️ Remember to update manifest with production domains when deploying
