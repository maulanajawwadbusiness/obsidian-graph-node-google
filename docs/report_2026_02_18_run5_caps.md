# Run 5 Caps Report
Date: 2026-02-18
Scope: daily usage endpoint for prompt preflight and contract wiring.

## Changes
### New route
- Added `src/server/src/routes/betaCapsRoutes.ts`
- Added endpoint: `GET /api/beta/usage/today`
- Auth: `requireAuth` guarded.
- Response shape:
  - `date_key`
  - `daily_limit`
  - `used_words`
  - `remaining_words`
  - `reset_note`
  - `caps_enabled`

### Guard behavior
- When `BETA_CAPS_MODE=0`:
  - returns `caps_enabled: false`
  - returns `used_words: 0`
  - returns full `remaining_words` from daily limit.
- When `BETA_CAPS_MODE=1`:
  - reads single usage row from `beta_daily_word_usage` via `getDailyUsedWords(...)`.

### Wiring
- `src/server/src/server/depsBuilder.ts`
  - added `betaCaps` deps block in `BuiltRouteDeps`.
- `src/server/src/server/bootstrap.ts`
  - registered `registerBetaCapsRoutes(app, routeDeps.betaCaps)`.

### Contracts
- Added script: `src/server/scripts/test-beta-caps-usage-contracts.mjs`
- Added npm script: `test:beta-caps-usage-contracts`
- Added to suite: `src/server/scripts/run-contract-suite.mjs`

## Verification
- `src/server`: `npm run build` passed.
- `src/server`: `npm run test:contracts` passed (including new beta caps endpoint contract).
