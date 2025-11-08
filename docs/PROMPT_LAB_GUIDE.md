# Prompt Lab - Best Practices for Tool Calling

## Two-Part Response Structure

The Venice AI LLM should produce responses in TWO separate parts:

### Part 1: Tool Calls (Structured Data)
- **Purpose**: Machine-readable structured data for your backend
- **Format**: Use the `makeOffer` tool to submit ONLY:
  - `campaignId`: The campaign identifier
  - `price`: The offer price in GBP
  - `matchedRequirements`: Array of matched criteria (requirement type, user value, advertiser requirement, brief explanation)
  - `reasoning`: Optional brief technical reasoning (can be empty string)
- **Content**: NO narrative, NO storytelling - just clean data

### Part 2: Text Response (Narrative/Personality)
- **Purpose**: Human-readable explanation for the end user
- **Format**: Regular text response BEFORE or AFTER tool calls
- **Content**: 
  - Why Max accepted/rejected the ad
  - The "color" and personality of the decision
  - Narrative explanation of the pricing strategy
  - Any warnings or special considerations

## Example Structure

```
[Your system prompt here]

For EACH ad you assess:

1. THINK THROUGH THE DECISION (in your reasoning)
2. MAKE YOUR DECISION using the makeOffer tool
3. EXPLAIN in plain English what you decided and why

When you make an offer, ONLY use the tool for the data.
Then provide a 2-3 sentence explanation in text for why this is a good deal for your boss.
```

## Updated Prompt Template

```
You are Max, an attention broker for your boss.

For each ad, follow this process:

1. Assess whether to REJECT or OFFER
2. If OFFER: Call the makeOffer tool with ONLY:
   - campaignId
   - price (in GBP, e.g., 0.025)
   - matchedRequirements (array of what matches)
   - reasoning (empty string "" or very brief)

3. Then provide a SHORT narrative (2-3 sentences):
   - Why this is a good offer for your boss
   - Key insight about the match
   - Any standout consideration

DO NOT include narrative in the tool call parameters.
DO NOT include reasoning in matchedRequirements explanations for the tool call.
Use the text response for all personality and storytelling.
```

## Key Points

✅ **DO THIS:**
- Keep tool calls clean and data-only
- Put narrative/personality in the text response
- Use tool calls for backend processing
- Use text for user experience

❌ **DON'T DO THIS:**
- Include long narratives in tool parameters
- Mix structured data with storytelling
- Put reasoning in the wrong place
- Use text response for structured data

## Console Output Example

```
✅ [MAKEOFFER] Tool call received:
  Campaign ID: rolex-crypto_exchange-0-2025
  Price: £0.015
  Matched Requirements:
    1. age: 43 matches 25-45 ✓
    2. location: UK matches GB, DE, FR ✓
    3. income: £60k matches £50k+ ✓
    4. interest: crypto matches cryptocurrency ✓

[Separate Text Response]
"Max's Assessment: This is a premium crypto ad from a top-tier brand 
matching your exact demographic and interests. The price reflects 
perfect alignment with minimal interruption cost."
```
