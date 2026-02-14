# Docs Drift Hotfix Run C - repo_xray.md

Date: 2026-02-14
Target: docs/repo_xray.md

## Exact Edits

1) Canonical backend ownership map tightened
- File: `docs/repo_xray.md`
- Section: `7.4 Important Files and Seams (Current)`
- Updated heading wording to make the section the canonical ownership map.
- Added missing post-shell seams and route module references:
  - `src/server/src/server/envConfig.ts`
  - `src/server/src/server/jsonParsers.ts`
  - `src/server/src/server/corsConfig.ts`
  - `src/server/src/server/startupGates.ts`
  - `src/server/src/server/cookies.ts`
  - `src/server/src/routes/healthRoutes.ts`

2) Contract command references made explicit in invariants section
- File: `docs/repo_xray.md`
- Section: `7.6 Backend Order Invariants`
- Added full suite command:
  - `npm run test:contracts`
- Retained shell/order guard command:
  - `npm run test:servermonolith-shell`

## Why This Is Safe
- Docs-only map and command clarity; no runtime behavior changes.

## Verification
- `git diff --name-only` for this run shows docs-only files.
- Script names verified in `src/server/package.json`:
  - `test:contracts`
  - `test:servermonolith-shell`
