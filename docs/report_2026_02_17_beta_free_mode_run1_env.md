# Run 1 Report: Backend Env Plumbing for Beta Free Mode
Date: 2026-02-17
Run scope: Add `BETA_FREE_MODE` env parsing in backend config only. No behavior change.

## Changes made
- Updated `src/server/src/server/envConfig.ts`.
- Added `betaFreeModeEnabled: boolean` to `ServerEnvConfig`.
- Added parsing:
  - `betaFreeModeEnabled: process.env.BETA_FREE_MODE === "1"`

## Behavior impact
- No runtime behavior change in this run.
- No route logic changed.
- No billing gate decision changed.

## Defaults and safety
- Default is `false` when env is unset or not equal to `"1"`.
- Flag is prod-safe by design because it is parsed independently from `isProd`.
- This run only prepares config plumbing; usage wiring comes in later runs.

## Cloud Run env setting notes
- Enable in backend service env:
  - `BETA_FREE_MODE=1`
- Disable and return default:
  - unset `BETA_FREE_MODE` or set `BETA_FREE_MODE=0`

## Verification
- Command run from `src/server`:
  - `npm run build`
- Result: pass.
