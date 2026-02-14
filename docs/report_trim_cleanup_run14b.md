# Run 14b Report: Cross-Platform Contract Suite Runner

Date: 2026-02-14
Scope: add one-command contract suite runner

## Added
- `src/server/scripts/run-contract-suite.mjs`
- npm script in `src/server/package.json`:
  - `test:contracts`: `node scripts/run-contract-suite.mjs`

## Runner Behavior
1. Executes contract scripts sequentially using `child_process.spawn`.
2. Uses cross-platform npm command:
- Windows: `npm.cmd`
- others: `npm`
3. Fails fast at first failing script.
4. Prints which script failed and exit code.
5. Treats `test:requestflow-contracts` as optional only if missing.

## Exact Script Order in test:contracts
1. `test:requestflow-contracts` (optional-if-missing)
2. `test:jsonparsers-contracts`
3. `test:cors-contracts`
4. `test:startupgates-contracts`
5. `test:health-contracts`
6. `test:auth-me-contracts`
7. `test:auth-google-contracts`
8. `test:profile-contracts`
9. `test:saved-interfaces-contracts`
10. `test:payments-contracts`
11. `test:depsbuilder-contracts`
12. `test:servermonolith-shell`

## Non-Changes
- No route code changed.
- No order wiring changed.
- No runtime server behavior changed.

## Result
`npm run test:contracts` now provides a single deterministic command for full contract verification without shell chaining quirks.
