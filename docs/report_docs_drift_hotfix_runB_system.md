# Docs Drift Hotfix Run B - system.md

Date: 2026-02-14
Target: docs/system.md

## Exact Edits

1) Backend order invariants made explicit in architecture section
- File: `docs/system.md`
- Section: Backend Runtime Architecture
- Added three explicit invariants:
  - payments webhook route is registered before CORS middleware
  - JSON parser chain is registered before route modules
  - startup gates complete before `app.listen(...)`

2) Shell/order guard script named explicitly in contract test coverage
- File: `docs/system.md`
- Section: Backend Contract Tests
- Replaced generic wording with explicit script reference:
  - `npm run test:servermonolith-shell`

## Why This Is Safe
- Docs-only clarification and precision alignment.
- No runtime behavior or command semantics changed.

## Verification
- `git diff --name-only` after this run shows only markdown docs files.
- Script reference checked against `src/server/package.json`:
  - `test:servermonolith-shell` exists.
