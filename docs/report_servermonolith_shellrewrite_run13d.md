# Run 13d Report: ServerMonolith Shell Guard

Date: 2026-02-14
Scope: add lightweight shell/orchestration guard

## Added
- script: `src/server/scripts/test-servermonolith-shell.mjs`
- npm script: `test:servermonolith-shell`

## Guard Coverage
The guard performs low-maintenance source marker checks for:

1. Shell ownership
- `serverMonolith.ts` imports bootstrap `startServer`
- `serverMonolith.ts` calls `void startServer()`

2. Builder seam usage
- `bootstrap.ts` references `buildRouteDeps`
- `depsBuilder.ts` exports `buildRouteDeps`

3. Order-sensitive markers in bootstrap
- webhook registration appears before CORS middleware
- JSON parser seam appears before route registration markers
- LLM ordering markers:
  - analyze before payments status
  - payments status before prefill
  - prefill before chat
- startup gates marker appears before listen marker

## Intentional Non-Goals
- does not execute server runtime
- does not pin full code structure or exact formatting
- does not duplicate existing route contract tests

## Result
Added a stable shell-level regression detector for the most fragile ordering invariants with minimal maintenance cost.
