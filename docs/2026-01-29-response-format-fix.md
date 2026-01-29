# Fix: Structured Output via Responses API

**Date**: 2026-01-29
**Issue**: Paper Analyzer was falling back to legacy "first 5 words" mode.
**Root Cause**: OpenAI API returned `400 Bad Request` with message "Unsupported parameter: 'response_format'". The `/v1/responses` endpoint requires structured output schema to be passed inside `text.format`, not `response_format`.

## The Fix
Updated `src/ai/openaiClient.ts` to use the correct payload structure:

```typescript
// BEFORE (Incorrect for Responses API)
body: JSON.stringify({
    response_format: { ... }
})

// AFTER (Correct)
body: JSON.stringify({
    text: {
        format: { ... }
    }
})
```

## Verification
1.  **Upload Text File**: The system should now successfully invoke the AI.
2.  **Labels**: Nodes should receive meaningful titles (not just the first 5 words).
3.  **Popups**: Clicking nodes should show detailed AI-generated summaries.

## Fallback Behavior
The fallback mechanism in `PaperAnalyzer` remains active as a safety net. If the API fails for any other reason (e.g., rate limits, network issues), the system will still degrade gracefully to the legacy behavior, keeping the app usable.
