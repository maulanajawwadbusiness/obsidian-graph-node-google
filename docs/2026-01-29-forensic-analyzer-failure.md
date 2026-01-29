# Forensic Report: Paper Analyzer Legacy Fallback

**Date**: 2026-01-29
**Incident**: File upload triggers legacy "5-word label" fallback instead of AI analysis.
**Severity**: High (Feature Broken)

## 1. Symptom Analysis
The user observed that uploading a text file results in 5 nodes with labels derived from the first 5 words of the document.
- **Code Path**: This behavior is exactly defined in `createFallbackPoints` in `src/ai/paperAnalyzer.ts`.
- **Trigger**: `analyzeDocument` catches an error during execution and calls `createFallbackPoints`.

## 2. Root Cause Analysis
The failure occurs inside the `try/catch` block of `analyzeDocument`.

### The Mismatch
*   **The Schema (New)**: We defined a strict JSON schema expecting a root object:
    ```json
    {
      "paper_title": "string",
      "main_points": [...]
    }
    ```
*   **The Prompt (Old)**: The prompt string passed to the model still contains legacy instructions explicitly demanding a different format:
    ```text
    Output Format (Strict JSON):
    [
      { "title": "...", "summary": "..." },
      ...
    ]
    ```

### Failure Mechanism
1.  **Strict Mode Violation**: With `strict: true` in `json_schema`, OpenAI enforces the output to match the schema.
2.  **Contradictory Instructions**: The model receives a system/tool directive to output Object(title, points) but a user prompt directive to output Array(points).
3.  **Result**: The API layer likely returns a 400 Bad Request (due to schema/prompt incompatibility if validated) OR the model fails to produce the strictly required format, causing the client code to throw.
4.  **Fallback**: The `catch` block swallows the error (logging it to console, which the user can't easily see) and executes the fallback path.

## 3. Corrective Action
1.  **Clean the Prompt**: Remove all manual JSON formatting instructions from the prompt string in `paperAnalyzer.ts`. Let the schema definition drive the structure.
2.  **Align Instructions**: Explicitly ask for "a paper title and 5 key points" in natural language to match the schema fields.
3.  **Error Visibility**: (Optional) In the future, we should probably surface this error to the UI rather than silently falling back, or keep the fallback but add a toast notification. For now, fixing the cause is priority.

## 4. Verification
After applying the fix, the prompt will align with the schema, allowing `gpt-5-nano` to generate the correct structure, bypassing the fallback.
