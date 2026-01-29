# Forensic Report: Paper Analyzer Legacy Fallback

**Date**: 2026-01-29
**Subject**: "First 5 Words" Behavior on File Upload
**Outcome**: Confirmed intended fallback behavior triggered by AI failure.

## 1. The Symptom
When uploading a text file, the system bypasses AI analysis and instead labels the first 5 nodes with the first 5 words of the document. The user identified this as "legacy parser" behavior.

## 2. The Mechanism (Root Cause)
The behavior is explicitly coded in `src/ai/paperAnalyzer.ts` as a safety fallback.

```typescript
// src/ai/paperAnalyzer.ts

function createFallbackPoints(words: string[]): AnalysisPoint[] {
    return words.slice(0, 5).map(word => ({
        title: word, // <--- DIRECT WORD MAPPING
        summary: `This is a key concept derived from "${word}"...`
    }));
}
```

This function is called in two scenarios:
1.  **Missing API Key**: `if (!apiKey) { ... return createFallbackPoints(...) }`
2.  **AI Failure**: Inside the `catch (err)` block of `analyzeDocument`.

## 3. The Trigger
Since the system was recently migrated to the **Responses API** with `gpt-5-nano`, the fallback is likely triggering due to a failure in the new `client.generateStructured` call.

Possible failure modes:
1.  **Model Access**: `gpt-5-nano` may not be available to the current API key (returning 404 or 403).
2.  **Schema Rejection**: The new `response_format` JSON schema might be malformed or unsupported by the specific model version (returning 400).
3.  **Endpoint**: The `/v1/responses` endpoint might be rejecting the request structure.

## 4. Evidence Trail
*   **Call Site**: `src/document/nodeBinding.ts` -> `applyAnalysisToNodes` calls `analyzeDocument`.
*   **Error Handling**: `analyzeDocument` catches *any* error from the AI client and silently switches to `createFallbackPoints` to prevent the UI from crashing.
*   **Console Logs**: You should see `[PaperAnalyzer] Analysis failed:` in the browser console, followed by the specific error (e.g., "OpenAI API error (404)").

## 5. Conclusion
The system is working as designed (fail-safe), but the AI layer is failing to execute the new structured request. The "legacy parser" is actually the error handler keeping the app alive.
