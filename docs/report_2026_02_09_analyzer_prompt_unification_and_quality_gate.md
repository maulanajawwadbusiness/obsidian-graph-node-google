# Report: Analyzer Prompt Unification and Quality Gate
Date: 2026-02-09
Scope: Unify analyzer prompt source across backend and frontend DEV direct path, and harden validation to block weak graph outputs.

## 1. Root Cause
- Analyzer guidance drifted across paths:
  - Backend OpenAI structured path had no analysis-specific prompt framing.
  - OpenRouter path used a generic JSON-only instruction.
  - Frontend DEV direct path used a separate lightweight prompt.
- Validation only checked type shape, so low-quality or near-empty content could pass and still map to graph dots.

## 2. Changes Applied
### A. Single prompt source
- Added `src/server/src/llm/analyze/prompt.ts`.
- Exposes:
  - `buildStructuredAnalyzeInput(...)`
  - `buildOpenrouterAnalyzePrompt(...)`
- Prompt includes:
  - undercurrent analysis doctrine (not summary-only)
  - dynamic role remap by `nodeCount`
  - directed link requirements
  - language directive (`id` or `en`)
  - JSON-only contract.

### B. Backend wiring
- `src/server/src/index.ts` now builds OpenAI structured input via `buildStructuredAnalyzeInput`.
- `src/server/src/llm/analyze/openrouterAnalyze.ts` now uses `buildOpenrouterAnalyzePrompt` for first and retry passes.
- `src/server/src/llm/validate.ts` now accepts optional `lang` in paper-analyze payload.

### C. Frontend DEV direct wiring
- `src/ai/paperAnalyzer.ts` now uses shared `buildStructuredAnalyzeInput` for DEV direct OpenAI flow.
- Backend request now includes `lang` from i18n runtime.

### D. Strict semantic validation
- Strengthened backend validator in `src/server/src/llm/analyze/schema.ts`:
  - non-empty title/explanation/rationale checks
  - minimum lengths
  - unique and complete point indices
  - link index range checks
  - no self-links
  - no duplicate directed pairs
  - weight range `[0,1]`
  - minimum link count (`max(1, nodeCount - 1)`).
- Mirrored semantic guard in frontend `src/ai/paperAnalyzer.ts` for DEV direct and backend response acceptance.

## 3. Expected Effect
- Analyzer outputs become consistently analytical and structurally useful for graph topology.
- Weak outputs are rejected early instead of silently creating empty/flat dots.
- Prompt behavior parity is maintained across backend and DEV direct testing.

## 4. Verification
- Run root build: `npm run build`.
- Run server build: `npm run build` in `src/server`.
- Manual checks:
  - analyze with `nodeCount=4`, `5`, and `8`
  - verify no empty explanations
  - verify links are non-trivial and index-valid
  - verify invalid output paths fail with `structured_output_invalid`.

