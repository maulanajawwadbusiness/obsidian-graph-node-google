# Run 14d Report: Test Logger Noise Reduction (Test-Only)

Date: 2026-02-14
Scope: reduce noisy contract output without runtime behavior changes

## Added
- `src/server/scripts/_testLogger.mjs`
  - exports `createSilentLogger()` test helper

## Updated
- `src/server/scripts/test-saved-interfaces-contracts.mjs`
  - route deps now pass `logger: createSilentLogger()` instead of `logger: console`

## Why This Is Safe
1. Test-only files changed.
2. Runtime server code and route modules are unchanged.
3. Contract assertions are unchanged.
4. Only route-internal logging output in this script is suppressed.

## Intentionally Left As-Is
- `authRoutes` and `corsConfig` contract scripts still show some route/internal logs because those seams currently do not expose injectable logger deps. Keeping them unchanged avoids route-interface refactors in a cleanup run.

## Result
Contract output is quieter where logger injection already exists, with zero runtime-path impact.
