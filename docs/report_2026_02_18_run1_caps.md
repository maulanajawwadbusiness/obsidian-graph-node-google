# Run 1 Caps Report
Date: 2026-02-18
Scope: env toggles and constants only, no behavior change.

## Changes
- Backend env parsing:
  - `src/server/src/server/envConfig.ts`
  - added `betaCapsModeEnabled: boolean`
  - parsed from `process.env.BETA_CAPS_MODE === "1"`
- Backend caps constants:
  - `src/server/src/llm/betaCapsConfig.ts`
  - `betaPerDocWordLimit = 7500`
  - `betaDailyWordLimit = 150000`
- Frontend caps env and constants:
  - `src/config/betaCaps.ts`
  - `BETA_CAPS_MODE_ENABLED = import.meta.env.VITE_BETA_CAPS_MODE === '1'`
  - `betaPerDocWordLimit = 7500`
  - `betaDailyWordLimit = 150000`

## Env names
- Backend: `BETA_CAPS_MODE`
- Frontend: `VITE_BETA_CAPS_MODE`

## Default behavior
- unchanged when env vars are unset or `0`.
- no routes or UI logic changed in this run.

## Verification
- `src/server`: `npm run build` passed.
- repo root: `npm run build` passed.
