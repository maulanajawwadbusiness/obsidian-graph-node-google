# Run 4 Caps Report
Date: 2026-02-18
Scope: server enforcement wiring on llm routes and error contract.

## Changes
### Route enforcement
- `src/server/src/routes/llmAnalyzeRoute.ts`
- `src/server/src/routes/llmChatRoute.ts`
- `src/server/src/routes/llmPrefillRoute.ts`

For all routes:
- Added caps check after validation and before provider call.
- Added 429 response when cap violated with code:
  - `beta_cap_exceeded`
  - `beta_daily_exceeded`
- Response includes metadata fields:
  - `per_doc_limit`
  - `daily_limit`
  - `submitted_word_count`
  - `daily_used`
  - `daily_remaining`
  - `date_key`
  - `reset_note`
- Added post-success usage recording using `recordUsage(...)`.
- Usage record is guarded and only attempted after successful provider flow path.

### Validation and request payload support
- `src/server/src/llm/validate.ts`
  - Added optional `submitted_word_count` on analyze/chat/prefill inputs.
  - Added strict integer validation (`>= 0`).
- `src/ai/paperAnalyzer.ts`
  - Sends `submitted_word_count` from original (untruncated) document text.
- `src/fullchat/fullChatAi.ts`
  - Sends `submitted_word_count` for chat prompt.
- `src/fullchat/prefillSuggestion.ts`
  - Sends `submitted_word_count` for prefill prompt basis.

### Shared contracts and deps
- `src/server/src/llm/requestFlow.ts`
  - Added new API codes in union: `beta_cap_exceeded`, `beta_daily_exceeded`.
  - Kept canonical error envelope and `sendApiError` behavior.
- `src/server/src/routes/llmRouteDeps.ts`
  - Added new API codes in route union.
  - Added llm deps: `getPool` and `isBetaCapsModeEnabled`.
- `src/server/src/server/bootstrap.ts`
  - Wired `getPool` and `isBetaCapsModeEnabled` into llm common deps.

## Counting policy implemented
- Analyze: uses `submitted_word_count` when provided, otherwise fallback server count from text field.
- Chat: uses `submitted_word_count` when provided, otherwise fallback from `userPrompt`.
- Prefill: uses `submitted_word_count` when provided, otherwise fallback from `nodeLabel + content.summary`.

## Off-mode behavior
- When `BETA_CAPS_MODE=0`, checks and writes are no-op via `capsEnabled` guard.
- Existing behavior remains unchanged.

## Verification
- `src/server`: `npm run build` passed.
- `src/server`: `npm run test:requestflow-contracts` passed.
- repo root: `npm run build` passed.
