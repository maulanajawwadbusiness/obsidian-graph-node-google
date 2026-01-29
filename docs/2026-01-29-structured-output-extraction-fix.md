# Fix: Robust Structured Output Extraction

**Date**: 2026-01-29
**Issue**: `generateStructured` failed with "No content in structured response" even on 200 OK.
**Root Cause**: The Responses API return payload shape was strictly assumed to be `output[].content[].text`. The actual shape can vary (e.g., `output_text`, flat content blocks, refusals).

## The Fix
Updated `src/ai/openaiClient.ts` to implement a multi-path extraction strategy:

1.  **Refusal Check**: Explicitly throws if `data.refusal` is present (preventing silent parsing failures).
2.  **Path A (`output_text`)**: Checks for a top-level string (common in some SDK modes).
3.  **Path B (`output` array)**: robustly iterates `output[]`:
    *   Handles `item.content[]` (standard message shape).
    *   Handles `item.type == 'text'` (flat output blocks).
4.  **Debug Logging**: Added a one-time console log of the response keys and shape to confirm strict validity in the browser console.

## Verification
1.  **Upload Text File**: The system should now successfully parse the JSON from the model.
2.  **Logs**: Check console for `[OpenAIClient] structured response shape` to verify the exact payload we are receiving.
