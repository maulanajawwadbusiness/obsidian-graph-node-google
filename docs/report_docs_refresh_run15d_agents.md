# Run 15d Report: AGENTS.md Backend Onboarding Refresh

Date: 2026-02-15
Scope: update AGENTS.md for post-run14 backend architecture safety

## Exact Edits Made

1. Added backend runtime mental model section (`## 2.2 Backend Runtime Mental Model (Post-Run14)`)
- shell: `src/server/src/serverMonolith.ts`
- orchestration owner: `src/server/src/server/bootstrap.ts`
- wiring hub: `src/server/src/server/depsBuilder.ts`
- route ownership: `src/server/src/routes/*`
- server seams listed:
  - `envConfig.ts`, `jsonParsers.ts`, `corsConfig.ts`, `startupGates.ts`, `cookies.ts`

2. Added backend route add checklist section (`## 3.1 Backend Route Add Checklist`)
- create route module with `registerXRoutes(app, deps)`
- extend depsBuilder
- register in bootstrap with correct order
- add deterministic contract script in `src/server/scripts/`
- add npm script
- include in `run-contract-suite.mjs` (`npm run test:contracts`)
- update shell order guard markers if order-sensitive

3. Added windows-safe backend verification commands
- `npm run build`
- `npm run test:contracts`
- note that `run-contract-suite.mjs` resolves npm via shell to `npm.cmd` on Windows.

4. Added docs discipline clause for architecture work
- update `docs/system.md` and `docs/repo_xray.md` in the same PR when architecture changes
- keep per-run reports under `docs/` for major refactor blocks

## Non-Changes
- no runtime code changes
- no backend behavior changes
