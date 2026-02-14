# Docs Drift Hotfix Run D - AGENTS.md

Date: 2026-02-14
Target: AGENTS.md

## Exact Edits

1) Backend order invariants added to runtime mental model
- File: `AGENTS.md`
- Section: `2.2 Backend Runtime Mental Model (Post-Run14)`
- Added explicit invariant bullets:
  - payments webhook registration is pre-cors
  - JSON parsers are applied before route registration
  - startup gates complete before `app.listen(...)`

2) Route-add checklist step sharpened for order-sensitive registration
- File: `AGENTS.md`
- Section: `3.1 Backend Route Add Checklist`
- Step 3 now explicitly names required order invariants while registering in `bootstrap.ts`.

## Why This Is Safe
- Docs-only onboarding precision; no runtime changes.

## Verification
- `git diff --name-only` for this run shows markdown docs only.
- Existing checklist links remain valid for:
  - `src/server/src/server/depsBuilder.ts`
  - `src/server/src/server/bootstrap.ts`
  - `src/server/scripts/run-contract-suite.mjs`
  - `src/server/scripts/test-servermonolith-shell.mjs`
