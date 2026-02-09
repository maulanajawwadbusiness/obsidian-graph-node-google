# Report: EnterPrompt Dev Direct OpenAI Analyzer
Date: 2026-02-09

## Summary
Implemented dev-only direct OpenAI analysis for EnterPrompt paste-to-map flow.

Goal achieved:
- In frontend dev mode, when `VITE_OPENAI_API_KEY` is present, pasted text analysis runs directly from frontend without backend auth/session dependency.
- Existing graph apply pipeline is unchanged (`applyAnalysisToNodes` and topology control APIs).
- Failure policy remains strict: if direct OpenAI fails, the existing error surface is shown.

## Why This Was Needed
Current backend path for `/api/llm/paper-analyze` is auth-gated (`requireAuth`).
In dev onboarding flow, prompt login overlay is disabled, so paste-to-analyze can dead-end on unauthorized.

## Scope
Files changed:
- `src/ai/paperAnalyzer.ts`
- `src/components/PromptCard.tsx`
- `src/screens/EnterPrompt.tsx`

## Changes
### 1) `src/ai/paperAnalyzer.ts`
- Added dev-only direct analyzer gate:
  - active when `import.meta.env.DEV` and `VITE_OPENAI_API_KEY` is non-empty.
- Added direct OpenAI structured analyze path:
  - uses existing `createLLMClient(... mode: 'openai')`
  - uses `generateStructured(...)`
  - uses analyzer model `AI_MODELS.ANALYZER`
- Added local schema builder and strict parser for analyze JSON shape:
  - `paper_title`
  - `main_points` length must equal requested node count
  - `links` with `from_index`, `to_index`, `type`, `weight`, `rationale`
- Dev direct path bypasses frontend balance precheck and backend API call.
- Non-dev or no-key behavior is unchanged (existing backend path, balance checks, and money notices).

### 2) `src/components/PromptCard.tsx`
- Submit now ignores empty/whitespace input.
- Submit payload is trimmed before calling `onSubmit`.

### 3) `src/screens/EnterPrompt.tsx`
- Added trimmed-text guard in submit handler.
- Keeps existing handoff behavior and graph transition.

## Runtime Behavior Matrix
1. DEV + `VITE_OPENAI_API_KEY` set:
   - EnterPrompt submit -> graph -> analyze runs via direct OpenAI in frontend.
2. DEV without key or non-DEV:
   - existing backend `/api/llm/paper-analyze` path remains.
3. Direct OpenAI failure:
   - strict failure behavior, no local fallback.

## Safety
- No backend auth/session behavior changed.
- No production behavior change.
- No topology mutation seam changes.

## Manual Verification Checklist
1. Start frontend dev with valid `VITE_OPENAI_API_KEY`.
2. Paste text in EnterPrompt and submit.
3. Confirm graph analysis runs and map is rebuilt.
4. Confirm whitespace-only submit does not trigger transition.
5. Temporarily break key and confirm error surface appears (strict failure).
